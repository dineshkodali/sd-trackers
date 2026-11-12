/**
 * Central Operations Dashboard - selectors (pure functions, no I/O, no React).
 *
 * One input snapshot goes in; KPIs, the attention list, upcoming deadlines, the overview matrix and the
 * site table come out. All of them share the same scope, the same "now" and the same definitions
 * (operationsRules.ts), so a KPI always equals the number of rows behind it.
 *
 * Deliberately NOT calculated, because the data does not exist yet: missed room checks, missed welfare
 * checks, a universal "overdue tasks" total, outstanding NTV actions, team totals.
 * See docs/SDTRACKER_CENTRAL_DASHBOARD_AUDIT_AND_DESIGN.md.
 */

import type { MaintenanceRecord, SDComplianceRecord, EscalationRecord } from '../types';
import type { Placement, PropertyMaster, PropertyRoom } from '../types/masterData';
import type { RoomIssue } from '../types/roomManagement';
import type { AbsenceFollowUp, PeepPlan } from '../services/suTrackerService';
import { isMaintenanceClosed } from './maintenancePriority';
import { isOutOfUse, isPlaceholderRoom, propertyOccupancy } from './roomManagementLogic';
import {
  addDaysIso, complianceInfo, createSiteResolver, daysBetween, isDatePast, isEscalationOpen, isFollowUpOpen,
  isIssueOpen, londonNow, parseIsoDate, parseWall, wallMinutesBetween, type SiteRef
} from './operationsRules';

/* ------------------------------------------------------------------ input and scope */

export interface OpsInput {
  sites: SiteRef[];
  maintenance: MaintenanceRecord[];
  compliance: SDComplianceRecord[];
  escalations: EscalationRecord[];
  properties: PropertyMaster[];
  rooms: PropertyRoom[];
  placements: Placement[];
  roomIssues: RoomIssue[];
  peepPlans: PeepPlan[];
  followUps: AbsenceFollowUp[];
}

export interface OpsScope {
  /** Site ids the user may see, or 'all'. */
  allowedSiteIds: Set<string> | 'all';
  /** Selected site id, or 'all'. */
  siteId: string | 'all';
}

export interface OpsPeriod { from: string; to: string } // inclusive 'YYYY-MM-DD'

export type DashboardPage =
  | 'maintenance' | 'compliance' | 'escalations' | 'peepTracker' | 'suAttendance' | 'propertyManagement' | 'suUsers' | 'properties';

export type AttentionReason =
  | 'CAT 1 open' | 'Maintenance overdue' | 'Compliance expired' | 'Escalation' | 'Absence follow-up overdue'
  | 'PEEP review overdue' | 'Room issue overdue' | 'Room inspection overdue' | 'Compliance due in 7 days';

const REASON_PRIORITY: Record<AttentionReason, number> = {
  'CAT 1 open': 1, 'Maintenance overdue': 2, 'Compliance expired': 3, 'Escalation': 4,
  'Absence follow-up overdue': 5, 'PEEP review overdue': 6, 'Room issue overdue': 7,
  'Room inspection overdue': 8, 'Compliance due in 7 days': 9
};

export interface AttentionItem {
  /** `${source}:${id}` - one row per source record */
  key: string;
  reason: AttentionReason;
  priority: number;
  label: string;
  siteId: string;
  siteName: string;
  location: string;
  /** Overdue: positive days overdue. Not yet due: negative days until due. */
  daysOverdue: number | null;
  dueText: string;
  owner: string;
  page: DashboardPage;
  recordId: string;
  /** What to open when it differs from the record: room items open their property */
  openId?: string;
}

export interface DeadlineItem {
  key: string;
  type: 'Maintenance Complete By' | 'Compliance expiry' | 'PEEP review' | 'Room inspection' | 'Room issue due';
  /** London wall 'YYYY-MM-DD HH:MM' used for sorting */
  due: string;
  label: string;
  siteId: string;
  siteName: string;
  page: DashboardPage;
  recordId: string;
  openId?: string;
}

export interface DataQuality {
  /** Records excluded because they match no known site (by source) */
  unresolvedSite: Record<string, number>;
  /** Records excluded from date rules because the date could not be read (by source) */
  unreadableDate: Record<string, number>;
}

/* ------------------------------------------------------------------ shared context */

interface Ctx {
  input: OpsInput;
  scope: OpsScope;
  today: string;
  nowWall: string;
  resolveSite: (v: unknown) => string | null;
  siteName: (id: string) => string;
  quality: DataQuality;
  inScope: (siteId: string | null) => boolean;
  propertySite: Map<string, string>;
  roomById: Map<string, PropertyRoom>;
  /** su id -> site id, from the active placement */
  suSite: Map<string, string>;
  /** su id -> room number */
  suRoom: Map<string, string>;
}

const bump = (rec: Record<string, number>, key: string) => { rec[key] = (rec[key] || 0) + 1; };

function buildCtx(input: OpsInput, scope: OpsScope, now: Date): Ctx {
  const { date: today, wall: nowWall } = londonNow(now);
  const resolveSite = createSiteResolver(input.sites);
  const names = new Map(input.sites.map(s => [s.id, s.name]));
  const inScope = (siteId: string | null) =>
    siteId !== null &&
    (scope.allowedSiteIds === 'all' || scope.allowedSiteIds.has(siteId)) &&
    (scope.siteId === 'all' || scope.siteId === siteId);

  const propertySite = new Map<string, string>();
  for (const p of input.properties) {
    const sid = p.siteId ? resolveSite(p.siteId) : null;
    if (sid) propertySite.set(p.id, sid);
  }
  const roomById = new Map(input.rooms.map(r => [r.id, r]));

  const suSite = new Map<string, string>();
  const suRoom = new Map<string, string>();
  for (const p of input.placements) {
    if (p.status !== 'Active') continue;
    const sid = resolveSite(p.siteId);
    if (sid) suSite.set(p.suId, sid);
    const room = roomById.get(p.roomId);
    if (room) suRoom.set(p.suId, room.roomNumber);
  }

  return {
    input, scope, today, nowWall, resolveSite, inScope, propertySite, roomById, suSite, suRoom,
    siteName: id => names.get(id) || id,
    quality: { unresolvedSite: {}, unreadableDate: {} }
  };
}

/* ------------------------------------------------------------------ per-source facts (computed once) */

interface MaintFact { r: MaintenanceRecord; siteId: string; overdue: boolean; dueSoon24: boolean; due: string | null; minutesLate: number }
interface ComplFact { r: SDComplianceRecord; siteId: string; info: ReturnType<typeof complianceInfo> }
interface ActionFact { key: string; kind: 'peep' | 'followUp' | 'inspection' | 'issue'; siteId: string; recordId: string; overdue: boolean; dueDate: string | null; label: string; location: string; owner: string; openId?: string }

interface Facts {
  ctx: Ctx;
  maintenance: MaintFact[];
  compliance: ComplFact[];
  escalations: Array<{ r: EscalationRecord; siteId: string }>;
  actions: ActionFact[];
  placements: Array<{ p: Placement; siteId: string }>;
}

function collectFacts(input: OpsInput, scope: OpsScope, now: Date): Facts {
  const ctx = buildCtx(input, scope, now);
  const { today, nowWall, quality } = ctx;

  // Maintenance: open/closed uses the tracker's own rule (Completed OR Closed).
  const maintenance: MaintFact[] = [];
  for (const r of input.maintenance) {
    const siteId = ctx.resolveSite(r.site);
    if (!siteId) { bump(quality.unresolvedSite, 'maintenance'); continue; }
    if (!ctx.inScope(siteId)) continue;
    const closed = isMaintenanceClosed(r);
    const due = closed ? null : parseWall(r.closeDueDate);
    if (!closed && !due) bump(quality.unreadableDate, 'maintenance');
    const minutes = due ? wallMinutesBetween(nowWall, due) : 0;
    maintenance.push({
      r, siteId, due,
      overdue: !!due && minutes < 0,
      dueSoon24: !!due && minutes >= 0 && minutes <= 24 * 60,
      minutesLate: due && minutes < 0 ? -minutes : 0
    });
  }

  const compliance: ComplFact[] = [];
  for (const r of input.compliance) {
    const siteId = ctx.resolveSite(r.siteName);
    if (!siteId) { bump(quality.unresolvedSite, 'compliance'); continue; }
    if (!ctx.inScope(siteId)) continue;
    const info = complianceInfo(r.expiryDate, today);
    if (info.state === 'unknown') bump(quality.unreadableDate, 'compliance');
    compliance.push({ r, siteId, info });
  }

  const escalations: Facts['escalations'] = [];
  for (const r of input.escalations) {
    const siteId = ctx.resolveSite(r.siteName || r.site);
    if (!siteId) { bump(quality.unresolvedSite, 'escalations'); continue; }
    if (!ctx.inScope(siteId)) continue;
    escalations.push({ r, siteId });
  }

  const openMaintIds = new Set(maintenance.filter(m => !isMaintenanceClosed(m.r)).map(m => m.r.id));
  const actions: ActionFact[] = [];

  for (const plan of input.peepPlans) {
    if (plan.status !== 'Active') continue;
    const siteId = ctx.suSite.get(plan.suId) ?? null;
    if (!siteId) { bump(quality.unresolvedSite, 'peep'); continue; }
    if (!ctx.inScope(siteId)) continue;
    if (plan.reviewDate && !parseIsoDate(plan.reviewDate)) bump(quality.unreadableDate, 'peep');
    actions.push({
      key: `peep:${plan.id}`, kind: 'peep', siteId, recordId: plan.id,
      overdue: isDatePast(plan.reviewDate, today), dueDate: parseIsoDate(plan.reviewDate),
      label: `PEEP review (${plan.riskLevel} risk)`, location: ctx.suRoom.get(plan.suId) ? `Room ${ctx.suRoom.get(plan.suId)}` : '', owner: plan.developedBy || ''
    });
  }

  for (const f of input.followUps) {
    if (!isFollowUpOpen(f)) continue;
    const siteId = ctx.suSite.get(f.suId) ?? null;
    if (!siteId) { bump(quality.unresolvedSite, 'followUps'); continue; }
    if (!ctx.inScope(siteId)) continue;
    if (f.dueDate && !parseIsoDate(f.dueDate)) bump(quality.unreadableDate, 'followUps');
    actions.push({
      key: `followUp:${f.id}`, kind: 'followUp', siteId, recordId: f.id,
      overdue: isDatePast(f.dueDate, today), dueDate: parseIsoDate(f.dueDate),
      label: `${f.thresholdDays}-day absence follow-up`, location: ctx.suRoom.get(f.suId) ? `Room ${ctx.suRoom.get(f.suId)}` : '', owner: f.assignedTo || ''
    });
  }

  for (const room of input.rooms) {
    if (isPlaceholderRoom(room) || isOutOfUse(room.status)) continue;
    const siteId = ctx.propertySite.get(room.propertyId) ?? null;
    if (!siteId) { bump(quality.unresolvedSite, 'rooms'); continue; }
    if (!ctx.inScope(siteId)) continue;
    if (!room.nextInspectionDue) continue;
    if (!parseIsoDate(room.nextInspectionDue)) { bump(quality.unreadableDate, 'rooms'); continue; }
    actions.push({
      key: `inspection:${room.id}`, kind: 'inspection', siteId, recordId: room.id, openId: room.propertyId,
      overdue: isDatePast(room.nextInspectionDue, today), dueDate: parseIsoDate(room.nextInspectionDue),
      label: 'Room inspection due', location: `Room ${room.roomNumber}`, owner: ''
    });
  }

  for (const issue of input.roomIssues) {
    if (!isIssueOpen(issue)) continue;
    // An issue linked to an open maintenance defect is already counted as that defect.
    if (issue.maintenanceRecordId && openMaintIds.has(issue.maintenanceRecordId)) continue;
    const siteId = ctx.propertySite.get(issue.propertyId) ?? null;
    if (!siteId) { bump(quality.unresolvedSite, 'roomIssues'); continue; }
    if (!ctx.inScope(siteId)) continue;
    if (!issue.dueDate) continue;
    if (!parseIsoDate(issue.dueDate)) { bump(quality.unreadableDate, 'roomIssues'); continue; }
    const room = ctx.roomById.get(issue.roomId);
    actions.push({
      key: `issue:${issue.id}`, kind: 'issue', siteId, recordId: issue.id, openId: issue.propertyId,
      overdue: isDatePast(issue.dueDate, today), dueDate: parseIsoDate(issue.dueDate),
      label: issue.title || 'Room issue', location: room ? `Room ${room.roomNumber}` : '', owner: issue.assignedTo || ''
    });
  }

  // Active placements, only where the room exists and is real (no orphans, no seeded placeholders).
  const placements: Facts['placements'] = [];
  for (const p of input.placements) {
    if (p.status !== 'Active') continue;
    const room = ctx.roomById.get(p.roomId);
    if (!room || isPlaceholderRoom(room)) continue;
    const siteId = ctx.resolveSite(p.siteId);
    if (!siteId || !ctx.inScope(siteId)) continue;
    placements.push({ p, siteId });
  }

  return { ctx, maintenance, compliance, escalations, actions, placements };
}

/* ------------------------------------------------------------------ occupancy */

function occupancyFor(facts: Facts, siteId?: string) {
  const { ctx } = facts;
  const propsOfSite = new Set(ctx.input.properties.filter(p => ctx.propertySite.get(p.id) === siteId).map(p => p.id));
  const rooms = ctx.input.rooms.filter(r =>
    !isPlaceholderRoom(r) &&
    (siteId ? propsOfSite.has(r.propertyId) : ctx.inScope(ctx.propertySite.get(r.propertyId) ?? null)));
  const roomIds = new Set(rooms.map(r => r.id));
  const placements = facts.placements.filter(x => roomIds.has(x.p.roomId) && (!siteId || x.siteId === siteId)).map(x => x.p);
  return propertyOccupancy(rooms, placements);
}

/* ------------------------------------------------------------------ KPIs */

export interface OpsKpis {
  /** Sites in the user's scope. Per-site "active" status is not on the data the selectors receive, so this is a count of sites, not of operational ones. */
  activeSites: number;
  occupancy: { residents: number; beds: number; pct: number | null; freeBeds: number; roomsOutOfUse: number };
  activeResidents: number;
  openMaintenance: number;
  openCat1: number;
  overdueMaintenance: number;
  maintenanceDueIn24h: number;
  complianceExpired: number;
  complianceDue30: number;
  overdueActions: { total: number; peep: number; followUps: number; inspections: number; roomIssues: number };
  openEscalations: number;
  criticalEscalations: number;
}

export function selectKpis(input: OpsInput, scope: OpsScope, now: Date = new Date()): OpsKpis {
  return kpisFrom(collectFacts(input, scope, now));
}

function kpisFrom(facts: Facts): OpsKpis {
  const { ctx } = facts;
  const sitesInScope = ctx.input.sites.filter(s => ctx.inScope(s.id));
  const open = facts.maintenance.filter(m => !isMaintenanceClosed(m.r));
  const occ = occupancyFor(facts);
  const overdue = (kind: ActionFact['kind']) => facts.actions.filter(a => a.kind === kind && a.overdue).length;
  const od = { peep: overdue('peep'), followUps: overdue('followUp'), inspections: overdue('inspection'), roomIssues: overdue('issue') };
  const escOpen = facts.escalations.filter(e => isEscalationOpen(e.r));
  return {
    activeSites: sitesInScope.length,
    occupancy: { residents: occ.residents, beds: occ.beds, pct: occ.occupancyPct, freeBeds: occ.freeBeds, roomsOutOfUse: occ.outOfUse },
    activeResidents: facts.placements.length,
    openMaintenance: open.length,
    openCat1: open.filter(m => m.r.priority === 'CAT 1').length,
    overdueMaintenance: open.filter(m => m.overdue).length,
    maintenanceDueIn24h: open.filter(m => m.dueSoon24).length,
    complianceExpired: facts.compliance.filter(c => c.info.state === 'expired').length,
    complianceDue30: facts.compliance.filter(c => c.info.state === 'due-30').length,
    overdueActions: { total: od.peep + od.followUps + od.inspections + od.roomIssues, ...od },
    openEscalations: escOpen.length,
    criticalEscalations: escOpen.filter(e => e.r.urgency === 'Critical').length
  };
}

/* ------------------------------------------------------------------ attention required */

export function selectAttention(input: OpsInput, scope: OpsScope, now: Date = new Date()): AttentionItem[] {
  return attentionFrom(collectFacts(input, scope, now));
}

function attentionFrom(facts: Facts): AttentionItem[] {
  const { ctx } = facts;
  const found = new Map<string, AttentionItem>();
  const offer = (item: AttentionItem) => {
    const prev = found.get(item.key);
    if (!prev || item.priority < prev.priority) found.set(item.key, item); // one row per record, highest priority wins
  };
  const item = (p: Omit<AttentionItem, 'priority' | 'siteName'>): AttentionItem =>
    ({ ...p, priority: REASON_PRIORITY[p.reason], siteName: ctx.siteName(p.siteId) });

  for (const m of facts.maintenance) {
    if (isMaintenanceClosed(m.r)) continue;
    const base = {
      key: `maintenance:${m.r.id}`, siteId: m.siteId, label: m.r.description || 'Maintenance defect',
      location: [m.r.room || m.r.location].filter(Boolean).join(' '), owner: '', page: 'maintenance' as const, recordId: m.r.id
    };
    const days = m.due ? Math.floor(m.minutesLate / 1440) : null;
    if (m.r.priority === 'CAT 1') {
      offer(item({ ...base, reason: 'CAT 1 open', daysOverdue: m.overdue ? days : null, dueText: m.due ? (m.overdue ? `Overdue ${fmtMinutes(m.minutesLate)}` : `Due ${m.due}`) : 'No Complete By' }));
    } else if (m.overdue) {
      offer(item({ ...base, reason: 'Maintenance overdue', daysOverdue: days, dueText: `Overdue ${fmtMinutes(m.minutesLate)}` }));
    }
  }

  for (const c of facts.compliance) {
    const base = {
      key: `compliance:${c.r.id}`, siteId: c.siteId, label: c.r.complianceType || 'Compliance item',
      location: '', owner: c.r.contractorName || '', page: 'compliance' as const, recordId: c.r.id
    };
    if (c.info.state === 'expired') {
      offer(item({ ...base, reason: 'Compliance expired', daysOverdue: -(c.info.days as number), dueText: `Expired ${c.info.expiry}` }));
    } else if (c.info.state === 'due-30' && (c.info.days as number) <= 7) {
      offer(item({ ...base, reason: 'Compliance due in 7 days', daysOverdue: -(c.info.days as number), dueText: `Expires ${c.info.expiry}` }));
    }
  }

  for (const e of facts.escalations) {
    if (!isEscalationOpen(e.r)) continue;
    if (e.r.urgency !== 'Critical' && e.r.urgency !== 'High') continue;
    offer(item({
      key: `escalation:${e.r.id}`, reason: 'Escalation', siteId: e.siteId,
      label: `${e.r.urgency} ${e.r.incidentType || e.r.incidentTitle || 'escalation'}`.trim(),
      location: '', daysOverdue: null, dueText: e.r.status || 'Open', owner: e.r.escalatedTo || '', page: 'escalations', recordId: e.r.id
    }));
  }

  const actionReason: Record<ActionFact['kind'], [AttentionReason, DashboardPage]> = {
    followUp: ['Absence follow-up overdue', 'suAttendance'],
    peep: ['PEEP review overdue', 'peepTracker'],
    issue: ['Room issue overdue', 'propertyManagement'],
    inspection: ['Room inspection overdue', 'propertyManagement']
  };
  for (const a of facts.actions) {
    if (!a.overdue || !a.dueDate) continue;
    const [reason, page] = actionReason[a.kind];
    offer(item({
      key: a.key, reason, siteId: a.siteId, label: a.label, location: a.location,
      daysOverdue: daysBetween(a.dueDate, ctx.today), dueText: `Due ${a.dueDate}`, owner: a.owner, page, recordId: a.recordId, openId: a.openId
    }));
  }

  return [...found.values()].sort((a, b) =>
    a.priority - b.priority ||
    (b.daysOverdue ?? -9999) - (a.daysOverdue ?? -9999) ||
    a.siteName.localeCompare(b.siteName) ||
    a.key.localeCompare(b.key));
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${Math.max(1, Math.round(min))}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

/* ------------------------------------------------------------------ upcoming deadlines */

export function selectDeadlines(input: OpsInput, scope: OpsScope, windowDays = 14, now: Date = new Date()): DeadlineItem[] {
  const facts = collectFacts(input, scope, now);
  const { ctx } = facts;
  const lastDay = addDaysIso(ctx.today, windowDays);
  const out: DeadlineItem[] = [];
  const add = (d: Omit<DeadlineItem, 'siteName'>) => out.push({ ...d, siteName: ctx.siteName(d.siteId) });

  for (const m of facts.maintenance) {
    if (isMaintenanceClosed(m.r) || !m.due || m.overdue) continue;
    if (m.due.slice(0, 10) > lastDay) continue;
    add({ key: `maintenance:${m.r.id}`, type: 'Maintenance Complete By', due: m.due, label: m.r.description || 'Maintenance defect', siteId: m.siteId, page: 'maintenance', recordId: m.r.id });
  }
  for (const c of facts.compliance) {
    if (c.info.state === 'unknown' || c.info.state === 'expired' || !c.info.expiry || c.info.expiry > lastDay) continue;
    add({ key: `compliance:${c.r.id}`, type: 'Compliance expiry', due: `${c.info.expiry} 23:59`, label: c.r.complianceType || 'Compliance item', siteId: c.siteId, page: 'compliance', recordId: c.r.id });
  }
  const typeOf: Record<ActionFact['kind'], [DeadlineItem['type'], DashboardPage]> = {
    peep: ['PEEP review', 'peepTracker'], inspection: ['Room inspection', 'propertyManagement'],
    issue: ['Room issue due', 'propertyManagement'], followUp: ['Room issue due', 'suAttendance']
  };
  for (const a of facts.actions) {
    if (a.kind === 'followUp' || a.overdue || !a.dueDate || a.dueDate > lastDay) continue;
    const [type, page] = typeOf[a.kind];
    add({ key: a.key, type, due: `${a.dueDate} 23:59`, label: a.label + (a.location ? ` - ${a.location}` : ''), siteId: a.siteId, page, recordId: a.recordId, openId: a.openId });
  }
  return out.sort((x, y) => x.due.localeCompare(y.due) || x.key.localeCompare(y.key));
}

/* ------------------------------------------------------------------ site table */

export interface SiteRow {
  siteId: string;
  siteName: string;
  residents: number;
  beds: number;
  occupancyPct: number | null;
  openMaintenance: number;
  overdueMaintenance: number;
  openCat1: number;
  complianceExpired: number;
  complianceDue30: number;
  overdueActions: number;
  openEscalations: number;
  /** Transparent ranking: overdue maintenance + CAT 1 + expired compliance + overdue actions (not a weighted score). */
  attentionCount: number;
}

export function selectSiteRows(input: OpsInput, scope: OpsScope, now: Date = new Date()): SiteRow[] {
  return siteRowsFrom(collectFacts(input, scope, now));
}

function siteRowsFrom(facts: Facts): SiteRow[] {
  const { ctx } = facts;
  const rows = ctx.input.sites.filter(s => ctx.inScope(s.id)).map((s): SiteRow => {
    const open = facts.maintenance.filter(m => m.siteId === s.id && !isMaintenanceClosed(m.r));
    const occ = occupancyFor(facts, s.id);
    const row: SiteRow = {
      siteId: s.id, siteName: s.name,
      residents: occ.residents, beds: occ.beds, occupancyPct: occ.occupancyPct,
      openMaintenance: open.length,
      overdueMaintenance: open.filter(m => m.overdue).length,
      openCat1: open.filter(m => m.r.priority === 'CAT 1').length,
      complianceExpired: facts.compliance.filter(c => c.siteId === s.id && c.info.state === 'expired').length,
      complianceDue30: facts.compliance.filter(c => c.siteId === s.id && c.info.state === 'due-30').length,
      overdueActions: facts.actions.filter(a => a.siteId === s.id && a.overdue).length,
      openEscalations: facts.escalations.filter(e => e.siteId === s.id && isEscalationOpen(e.r)).length,
      attentionCount: 0
    };
    row.attentionCount = row.overdueMaintenance + row.openCat1 + row.complianceExpired + row.overdueActions;
    return row;
  });
  return rows.sort((a, b) => b.attentionCount - a.attentionCount || a.siteName.localeCompare(b.siteName));
}

/* ------------------------------------------------------------------ overview matrix */

export interface OverviewRow {
  key: 'maintenance' | 'compliance' | 'peep' | 'followUps' | 'inspections' | 'roomIssues' | 'escalations';
  label: string;
  /** null = not calculable for this row (shown as a dash, never zero) */
  outstanding: number | null;
  overdue: number | null;
  dueSoon: number | null;
  completedInPeriod: number | null;
}

export function selectOverview(input: OpsInput, scope: OpsScope, period: OpsPeriod, now: Date = new Date(), dueSoonDays = 7): OverviewRow[] {
  const facts = collectFacts(input, scope, now);
  const { ctx } = facts;
  const soonEnd = addDaysIso(ctx.today, dueSoonDays);
  const inPeriod = (v: unknown) => { const d = parseIsoDate(v); return d !== null && d >= period.from && d <= period.to; };

  const open = facts.maintenance.filter(m => !isMaintenanceClosed(m.r));
  const actionRow = (kind: ActionFact['kind']) => {
    const rows = facts.actions.filter(a => a.kind === kind);
    return {
      outstanding: rows.length,
      overdue: rows.filter(a => a.overdue).length,
      dueSoon: rows.filter(a => !a.overdue && a.dueDate !== null && a.dueDate <= soonEnd).length
    };
  };

  const peepDone = input.peepPlans.filter(p => p.status === 'Active' && ctx.inScope(ctx.suSite.get(p.suId) ?? null) && inPeriod(p.lastReviewedAt)).length;
  const fuDone = input.followUps.filter(f => f.status === 'Resolved' && ctx.inScope(ctx.suSite.get(f.suId) ?? null) && inPeriod(f.resolvedAt)).length;
  const inspDone = input.rooms.filter(r => !isPlaceholderRoom(r) && ctx.inScope(ctx.propertySite.get(r.propertyId) ?? null) && inPeriod(r.lastInspectedAt)).length;
  const issueDone = input.roomIssues.filter(i => (i.status === 'Resolved' || i.status === 'Closed') && ctx.inScope(ctx.propertySite.get(i.propertyId) ?? null) && inPeriod(i.resolvedAt)).length;
  const maintDone = facts.maintenance.filter(m => isMaintenanceClosed(m.r) && inPeriod(m.r.actualClosedDate)).length;

  return [
    { key: 'maintenance', label: 'Maintenance', outstanding: open.length, overdue: open.filter(m => m.overdue).length, dueSoon: open.filter(m => m.dueSoon24).length, completedInPeriod: maintDone },
    { key: 'compliance', label: 'Compliance', outstanding: facts.compliance.filter(c => c.info.state !== 'valid' && c.info.state !== 'unknown').length, overdue: facts.compliance.filter(c => c.info.state === 'expired').length, dueSoon: facts.compliance.filter(c => c.info.state === 'due-30').length, completedInPeriod: null },
    { key: 'peep', label: 'PEEP reviews', ...actionRow('peep'), completedInPeriod: peepDone },
    { key: 'followUps', label: 'Absence follow-ups', ...actionRow('followUp'), completedInPeriod: fuDone },
    { key: 'inspections', label: 'Room inspections', ...actionRow('inspection'), completedInPeriod: inspDone },
    { key: 'roomIssues', label: 'Room issues', ...actionRow('issue'), completedInPeriod: issueDone },
    { key: 'escalations', label: 'Escalations', outstanding: facts.escalations.filter(e => isEscalationOpen(e.r)).length, overdue: null, dueSoon: null, completedInPeriod: null }
  ];
}

/* ------------------------------------------------------------------ everything at once */

export interface OpsSnapshot {
  asOf: string;
  kpis: OpsKpis;
  attention: AttentionItem[];
  sites: SiteRow[];
  dataQuality: DataQuality;
}

/** KPIs, attention list and site table from one pass over the data (deadlines/overview take extra parameters). */
export function buildSnapshot(input: OpsInput, scope: OpsScope, now: Date = new Date()): OpsSnapshot {
  const facts = collectFacts(input, scope, now);
  return {
    asOf: londonNow(now).wall,
    kpis: kpisFrom(facts),
    attention: attentionFrom(facts),
    sites: siteRowsFrom(facts),
    dataQuality: facts.ctx.quality
  };
}
