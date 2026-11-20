/**
 * Operations Dashboard - department, flow and check-monitoring selectors (pure, no I/O, no React).
 *
 * Complements operationsSelectors.ts (maintenance / compliance / reviews / escalations). Everything here follows the
 * same rules: London dates, exact site matching (never substring), and a figure that cannot be worked out is `null`
 * (shown as a dash), never zero.
 *
 * Date formats: New Arrivals use YYYY-MM-DD. Dispersal and Eviction sheets are typed text; the Dispersal sheet is
 * documented (and written by the app) as MM/DD/YYYY, so that and ISO are the only two formats read. Anything else is
 * counted as unreadable and left out of date-based figures - it is never guessed.
 */

import type { DispersalRecord, EvictionRecord, LaundryRecord, MaintenanceRecord, NewArrivalRecord } from '../types';
import type { CheckObligation, CheckRow } from './checkObligations';
import { isMaintenanceClosed } from './maintenancePriority';
import { addDaysIso, createSiteResolver, parseIsoDate, parseWall, wallMinutesBetween, londonNow, type SiteRef } from './operationsRules';

/* ------------------------------------------------------------------ dates */

/** 'YYYY-MM-DD' from an ISO date or a strict MM/DD/YYYY; null for anything else (including day-first text). */
export function parseFlexDate(value: unknown): string | null {
  const iso = parseIsoDate(value);
  if (iso) return iso;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return parseIsoDate(`${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
}

/* ------------------------------------------------------------------ scope */

export interface DeptScope {
  /** Site ids the user may see, or 'all'. */
  allowedSiteIds: Set<string> | 'all';
  /** Selected site id, or 'all'. */
  siteId: string | 'all';
}

const inScope = (scope: DeptScope, siteId: string | null) =>
  siteId !== null &&
  (scope.allowedSiteIds === 'all' || scope.allowedSiteIds.has(siteId)) &&
  (scope.siteId === 'all' || scope.siteId === siteId);

const bump = (rec: Record<string, number>, key: string) => { rec[key] = (rec[key] || 0) + 1; };

/* ------------------------------------------------------------------ flows: arrivals, dispersals, evictions */

export interface FlowInput {
  sites: SiteRef[];
  newArrivals: NewArrivalRecord[];
  dispersals: DispersalRecord[];
  evictions: EvictionRecord[];
}

export interface DispersalFact {
  r: DispersalRecord;
  siteId: string;
  /** the date the person is due to go (second cycle when there is one) */
  dueDate: string | null;
  /** has left the property / travelled */
  left: boolean;
}

/** One cycle at a time: a second cycle exists only when its own date has been entered. */
export function dispersalFact(r: DispersalRecord, siteId: string): DispersalFact {
  const second = parseFlexDate(r.secondDispersalDate);
  if (second) {
    return { r, siteId, dueDate: second, left: r.secondDispersalTravelled === 'Yes' || parseFlexDate(r.secondDateLeftProperty) !== null };
  }
  return { r, siteId, dueDate: parseFlexDate(r.dispersalDate), left: r.travelled === 'Yes' || parseFlexDate(r.dateLeftProperty) !== null };
}

const EVICTION_OPEN = ['Notice Issued', 'Appeal Pending'];

export interface FlowFacts {
  arrivals: Array<{ r: NewArrivalRecord; siteId: string; date: string | null }>;
  dispersals: DispersalFact[];
  evictions: Array<{ r: EvictionRecord; siteId: string; date: string | null; noticeDate: string | null }>;
  quality: { unresolvedSite: Record<string, number>; unreadableDate: Record<string, number> };
}

export function collectFlowFacts(input: FlowInput, scope: DeptScope): FlowFacts {
  const resolve = createSiteResolver(input.sites);
  const quality: FlowFacts['quality'] = { unresolvedSite: {}, unreadableDate: {} };

  const arrivals: FlowFacts['arrivals'] = [];
  for (const r of input.newArrivals) {
    const siteId = resolve(r.hotel);
    if (!siteId) { bump(quality.unresolvedSite, 'new arrivals'); continue; }
    if (!inScope(scope, siteId)) continue;
    const date = parseFlexDate(r.checkInDate);
    if (!date) bump(quality.unreadableDate, 'new arrivals');
    arrivals.push({ r, siteId, date });
  }

  const dispersals: DispersalFact[] = [];
  for (const r of input.dispersals) {
    const siteId = resolve(r.siteName);
    if (!siteId) { bump(quality.unresolvedSite, 'dispersals'); continue; }
    if (!inScope(scope, siteId)) continue;
    const f = dispersalFact(r, siteId);
    if (!f.dueDate) bump(quality.unreadableDate, 'dispersals');
    dispersals.push(f);
  }

  const evictions: FlowFacts['evictions'] = [];
  for (const r of input.evictions) {
    const siteId = resolve(r.hotel);
    if (!siteId) { bump(quality.unresolvedSite, 'evictions'); continue; }
    if (!inScope(scope, siteId)) continue;
    const date = parseFlexDate(r.evictionDate);
    if (!date && EVICTION_OPEN.includes(r.status)) bump(quality.unreadableDate, 'evictions');
    evictions.push({ r, siteId, date, noticeDate: parseFlexDate(r.noticeDate) });
  }
  return { arrivals, dispersals, evictions, quality };
}

export interface FlowKpi { today: number; yesterday: number }

export interface FlowCounts {
  newArrivals: FlowKpi;
  /** Dispersals whose dispersal date is the day (any outcome) */
  dispersals: FlowKpi;
  evictions: FlowKpi;
}

const onDay = (dates: Array<string | null>, day: string) => dates.filter(d => d === day).length;

export function selectFlowCounts(input: FlowInput, scope: DeptScope, today: string): FlowCounts {
  const f = collectFlowFacts(input, scope);
  const yesterday = addDaysIso(today, -1);
  const arr = f.arrivals.map(a => a.date);
  const dis = f.dispersals.map(d => d.dueDate);
  const evi = f.evictions.filter(e => e.r.status !== 'Cancelled').map(e => e.date);
  return {
    newArrivals: { today: onDay(arr, today), yesterday: onDay(arr, yesterday) },
    dispersals: { today: onDay(dis, today), yesterday: onDay(dis, yesterday) },
    evictions: { today: onDay(evi, today), yesterday: onDay(evi, yesterday) }
  };
}

/* ------------------------------------------------------------------ department table */

export type DeptKey =
  | 'newArrivals' | 'dispersals' | 'evictions' | 'roomChecks' | 'welfareChecks' | 'maintenance' | 'laundry' | 'escalations';

export interface DeptRow {
  key: DeptKey;
  label: string;
  /** null = not defined for this module (shown as a dash, never zero) */
  total: number | null;
  completed: number | null;
  pending: number | null;
  dueToday: number | null;
  overdue: number | null;
  inProgress: number | null;
  /** What "Total" means for this row, shown as a tooltip so the number can be reproduced */
  totalMeans: string;
}

const emptyRow = (key: DeptKey, label: string, totalMeans: string): DeptRow =>
  ({ key, label, total: null, completed: null, pending: null, dueToday: null, overdue: null, inProgress: null, totalMeans });

export interface DeptInput extends FlowInput {
  maintenance: MaintenanceRecord[];
  laundry: LaundryRecord[];
  /** Escalation statuses only (site is resolved by the caller's scope) */
  escalations: Array<{ status?: string; site?: string; siteName?: string }>;
  roomRows: CheckRow[];
  welfareRows: CheckRow[];
  /** Which rows the user may see; a hidden module is not computed */
  visible: Record<DeptKey, boolean>;
}

export interface DeptPeriod { from: string; to: string }

const inRange = (d: string | null, p: DeptPeriod) => d !== null && d >= p.from && d <= p.to;

/** Check rows -> counts of individual obligations (each row carries up to two). */
export function checkCounts(rows: CheckRow[], today: string) {
  const obs: CheckObligation[] = [];
  for (const r of rows) { if (r.first) obs.push(r.first); if (r.second) obs.push(r.second); }
  const done = (o: CheckObligation) => o.status === 'completed' || o.status === 'completed_late' || o.status === 'exempt';
  return {
    total: obs.length,
    completed: obs.filter(done).length,
    pending: obs.filter(o => o.status === 'pending').length,
    overdue: obs.filter(o => o.status === 'overdue').length,
    dueToday: obs.filter(o => o.status === 'pending' && o.deadline === today).length
  };
}

export function selectDepartmentRows(input: DeptInput, scope: DeptScope, period: DeptPeriod, now: Date): DeptRow[] {
  const { date: today, wall } = londonNow(now);
  const resolve = createSiteResolver(input.sites);
  const flow = collectFlowFacts(input, scope);
  const rows: DeptRow[] = [];
  const v = input.visible;

  if (v.newArrivals) {
    const r = emptyRow('newArrivals', 'New arrivals', 'Check-ins dated within the reporting period');
    const inP = flow.arrivals.filter(a => inRange(a.date, period));
    r.total = inP.length;
    r.dueToday = flow.arrivals.filter(a => a.date === today).length;
    rows.push(r);
  }

  if (v.dispersals) {
    const r = emptyRow('dispersals', 'Dispersals', 'Dispersals not yet departed, plus those departed within the period');
    const open = flow.dispersals.filter(d => !d.left && d.dueDate !== null);
    const leftInP = flow.dispersals.filter(d => d.left && inRange(d.dueDate, period));
    r.total = open.length + leftInP.length;
    r.completed = leftInP.length;
    r.pending = open.filter(d => d.dueDate! > today).length;
    r.dueToday = open.filter(d => d.dueDate === today).length;
    r.overdue = open.filter(d => d.dueDate! < today).length;
    rows.push(r);
  }

  if (v.evictions) {
    const r = emptyRow('evictions', 'Evictions', 'Notices open (Notice Issued, Appeal Pending) plus those evicted within the period');
    const open = flow.evictions.filter(e => EVICTION_OPEN.includes(e.r.status));
    const doneInP = flow.evictions.filter(e => e.r.status === 'Evicted' && inRange(e.date, period));
    r.total = open.length + doneInP.length;
    r.completed = doneInP.length;
    r.pending = open.filter(e => e.r.status === 'Notice Issued' && (e.date === null || e.date > today)).length;
    r.inProgress = open.filter(e => e.r.status === 'Appeal Pending').length;
    r.dueToday = open.filter(e => e.date === today).length;
    r.overdue = open.filter(e => e.r.status === 'Notice Issued' && e.date !== null && e.date < today).length;
    rows.push(r);
  }

  const checkRow = (key: 'roomChecks' | 'welfareChecks', label: string, src: CheckRow[]) => {
    const r = emptyRow(key, label, 'Checks owed this month: two per occupied room / placed resident (by the 10th and 25th)');
    const c = checkCounts(src.filter(x => inScope(scope, x.siteId || null)), today);
    r.total = c.total; r.completed = c.completed; r.pending = c.pending; r.dueToday = c.dueToday; r.overdue = c.overdue;
    rows.push(r);
  };
  if (v.welfareChecks) checkRow('welfareChecks', 'Welfare checks', input.welfareRows);
  if (v.roomChecks) checkRow('roomChecks', 'Room checks', input.roomRows);

  if (v.maintenance) {
    const r = emptyRow('maintenance', 'Maintenance', 'Open defects (not Completed and not Closed); Completed counts those closed within the period');
    let open = 0; let overdue = 0; let dueToday = 0; let done = 0;
    for (const m of input.maintenance) {
      const siteId = resolve(m.site);
      if (!inScope(scope, siteId)) continue;
      if (isMaintenanceClosed(m)) { if (inRange(parseIsoDate(m.actualClosedDate), period)) done++; continue; }
      open++;
      const due = parseWall(m.closeDueDate);
      if (!due) continue;
      if (wallMinutesBetween(wall, due) < 0) overdue++;
      else if (due.slice(0, 10) === today) dueToday++;
    }
    r.total = open; r.completed = done; r.overdue = overdue; r.dueToday = dueToday;
    rows.push(r);
  }

  if (v.laundry) {
    const r = emptyRow('laundry', 'Laundry', 'Resident laundry jobs dated within the reporting period');
    const inP = input.laundry.filter(l => inScope(scope, resolve(l.site)) && inRange(parseIsoDate(l.date), period));
    r.total = inP.length;
    r.completed = inP.filter(l => l.status === 'Collected').length;
    r.pending = inP.filter(l => l.status === 'Queued').length;
    r.inProgress = inP.filter(l => l.status === 'Washing' || l.status === 'Drying' || l.status === 'Ready for Collection').length;
    rows.push(r);
  }

  if (v.escalations) {
    const r = emptyRow('escalations', 'Escalations', 'Escalations not yet Resolved');
    const open = input.escalations.filter(e => inScope(scope, resolve(e.siteName || e.site)) && e.status !== 'Resolved');
    r.total = open.length;
    r.pending = open.filter(e => e.status === 'Active').length;
    r.inProgress = open.filter(e => e.status !== 'Active').length;
    rows.push(r);
  }
  return rows;
}

/* ------------------------------------------------------------------ welfare and room check monitoring */

export interface CheckPeriodCounts { completed: number; pending: number; overdue: number }

export interface CheckMonitor {
  /** Distinct rooms (room checks) or placed residents (welfare checks) that owe checks this month */
  eligible: number;
  first: CheckPeriodCounts;
  second: CheckPeriodCounts;
  /** Subjects with 0, 1 or 2 of their checks done (ratio "n/2 completed") */
  ratio: { none: number; one: number; both: number };
}

export function monitorChecks(rows: CheckRow[]): CheckMonitor {
  const blank = (): CheckPeriodCounts => ({ completed: 0, pending: 0, overdue: 0 });
  const out: CheckMonitor = { eligible: rows.length, first: blank(), second: blank(), ratio: { none: 0, one: 0, both: 0 } };
  const add = (bucket: CheckPeriodCounts, o: CheckObligation | null) => {
    if (!o) return;
    if (o.status === 'completed' || o.status === 'completed_late' || o.status === 'exempt') bucket.completed++;
    else if (o.status === 'overdue') bucket.overdue++;
    else bucket.pending++;
  };
  for (const r of rows) {
    add(out.first, r.first); add(out.second, r.second);
    const done = [r.first, r.second].filter(o => o && (o.status === 'completed' || o.status === 'completed_late' || o.status === 'exempt')).length;
    if (done === 2) out.ratio.both++; else if (done === 1) out.ratio.one++; else out.ratio.none++;
  }
  return out;
}

export interface OverdueCheck {
  key: string;
  checkType: 'Room check' | 'Welfare check';
  period: 'First (by the 10th)' | 'Second (by the 25th)';
  siteName: string;
  propertyName: string;
  roomNumber: string;
  suName: string;
  assignedTo: string;
  dueDate: string;
  daysLate: number;
  status: 'Overdue';
}

/** Every overdue obligation, oldest deadline first. Only rooms/residents that owe a check can appear. */
export function listOverdueChecks(room: CheckRow[], welfare: CheckRow[]): OverdueCheck[] {
  const out: OverdueCheck[] = [];
  const take = (rows: CheckRow[], type: OverdueCheck['checkType']) => {
    for (const r of rows) {
      for (const o of [r.first, r.second]) {
        if (!o || o.status !== 'overdue') continue;
        out.push({
          key: o.key, checkType: type, period: o.period === 1 ? 'First (by the 10th)' : 'Second (by the 25th)',
          siteName: o.siteName, propertyName: o.propertyName, roomNumber: o.roomNumber, suName: o.suName,
          assignedTo: o.responsible.name, dueDate: o.deadline, daysLate: o.daysLate ?? 0, status: 'Overdue'
        });
      }
    }
  };
  take(room, 'Room check');
  take(welfare, 'Welfare check');
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.siteName.localeCompare(b.siteName) || a.key.localeCompare(b.key));
}

/* ------------------------------------------------------------------ maintenance overview */

export interface MaintenanceOverview {
  open: number;
  newToday: number;
  /** Open and not yet past Complete By (the tracker has one open status, "In Process") */
  inProgress: number;
  overdue: number;
  completedToday: number;
  /** Mean hours from report to closure for jobs closed in the period, or null when no job has both timestamps */
  avgCompletionHours: number | null;
  avgSampleSize: number;
}

export interface MaintenanceRow {
  id: string;
  site: string;
  location: string;
  category: string;
  priority: string;
  created: string;
  due: string;
  status: string;
  overdue: boolean;
}

/** report date + time -> London wall string, or null */
const reported = (m: MaintenanceRecord) => parseWall(`${m.date}${m.reportedTime ? ` ${m.reportedTime}` : ''}`);
const closedAt = (m: MaintenanceRecord) =>
  parseWall(`${m.actualClosedDate || ''}${m.actualClosedTime ? ` ${m.actualClosedTime}` : ''}`) ||
  (m.closureDateTime ? parseWall(String(m.closureDateTime).replace('T', ' ').slice(0, 16)) : null);

export function selectMaintenanceOverview(records: MaintenanceRecord[], sites: SiteRef[], scope: DeptScope, period: DeptPeriod, now: Date): { overview: MaintenanceOverview; rows: MaintenanceRow[] } {
  const { date: today, wall } = londonNow(now);
  const resolve = createSiteResolver(sites);
  const names = new Map(sites.map(s => [s.id, s.name]));
  const ov: MaintenanceOverview = { open: 0, newToday: 0, inProgress: 0, overdue: 0, completedToday: 0, avgCompletionHours: null, avgSampleSize: 0 };
  const rows: MaintenanceRow[] = [];
  let hours = 0;

  for (const m of records) {
    const siteId = resolve(m.site);
    if (!inScope(scope, siteId)) continue;
    if (parseIsoDate(m.date) === today) ov.newToday++;
    if (isMaintenanceClosed(m)) {
      const doneDate = parseIsoDate(m.actualClosedDate);
      if (doneDate === today) ov.completedToday++;
      if (doneDate && doneDate >= period.from && doneDate <= period.to) {
        const a = reported(m); const b = closedAt(m);
        if (a && b && wallMinutesBetween(a, b) >= 0) { hours += wallMinutesBetween(a, b) / 60; ov.avgSampleSize++; }
      }
      continue;
    }
    ov.open++;
    const due = parseWall(m.closeDueDate);
    const overdue = !!due && wallMinutesBetween(wall, due) < 0;
    if (overdue) ov.overdue++; else ov.inProgress++;
    rows.push({
      id: m.id, site: names.get(siteId!) || m.site, location: [m.room, m.location].filter(Boolean).join(' · '),
      category: m.criteriaCode || m.priority, priority: m.priority, created: parseIsoDate(m.date) || '', due: due || '',
      status: m.defectStatus, overdue
    });
  }
  if (ov.avgSampleSize > 0) ov.avgCompletionHours = Math.round((hours / ov.avgSampleSize) * 10) / 10;
  rows.sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.due || '9').localeCompare(b.due || '9') || a.id.localeCompare(b.id));
  return { overview: ov, rows };
}

/* ------------------------------------------------------------------ site table additions */

export interface SiteFlowRow { siteId: string; newArrivalsToday: number; dispersalsToday: number; dispersalsOverdue: number; evictionsOverdue: number; overdueChecks: number }

export function selectSiteFlowRows(input: FlowInput, roomRows: CheckRow[], welfareRows: CheckRow[], scope: DeptScope, today: string): Map<string, SiteFlowRow> {
  const f = collectFlowFacts(input, scope);
  const out = new Map<string, SiteFlowRow>();
  const row = (siteId: string) => {
    let r = out.get(siteId);
    if (!r) { r = { siteId, newArrivalsToday: 0, dispersalsToday: 0, dispersalsOverdue: 0, evictionsOverdue: 0, overdueChecks: 0 }; out.set(siteId, r); }
    return r;
  };
  for (const a of f.arrivals) if (a.date === today) row(a.siteId).newArrivalsToday++;
  for (const d of f.dispersals) {
    if (d.left || !d.dueDate) continue;
    if (d.dueDate === today) row(d.siteId).dispersalsToday++;
    else if (d.dueDate < today) row(d.siteId).dispersalsOverdue++;
  }
  for (const e of f.evictions) if (e.r.status === 'Notice Issued' && e.date !== null && e.date < today) row(e.siteId).evictionsOverdue++;
  for (const cr of [...roomRows, ...welfareRows]) {
    if (!inScope(scope, cr.siteId || null)) continue;
    const n = [cr.first, cr.second].filter(o => o && o.status === 'overdue').length;
    if (n > 0) row(cr.siteId).overdueChecks += n;
  }
  return out;
}

/* ------------------------------------------------------------------ resident and property profile (aggregate only) */

export interface ResidentProfile {
  /** Active service users that have an active placement at an in-scope site */
  activeResidents: number;
  vulnerable: number;
  /** A disability category or type is recorded (and is not "None" / "No") */
  disabilities: number;
  peep: number;
  geep: number;
  /** Active residents with no evacuation plan type recorded */
  noEvacuationPlan: number;
  /** Interconnecting rooms configured in the register, and the groups they form */
  interconnectingRooms: number;
  interconnectGroups: number;
}

const NO_VALUES = new Set(['', 'no', 'none', 'n/a', 'na', 'nil', 'not applicable']);

export interface ProfileInput {
  sites: SiteRef[];
  serviceUsers: Array<{ id: string; status?: string; archiveStatus?: string; vulnerable?: string; disabilityCategory?: string; disabilityType?: string; personalEvacuationPlan?: string }>;
  placements: Array<{ suId: string; siteId: string; status: string }>;
  registerRooms: Array<{ hotel: string; roomCategory?: string; interconnectGroup?: string }>;
}

/** Counts only - no names or identifiers leave this function, so the aggregate view exposes no personal data. */
export function selectResidentProfile(input: ProfileInput, scope: DeptScope): ResidentProfile {
  const resolve = createSiteResolver(input.sites);
  const siteBySu = new Map<string, string>();
  for (const p of input.placements) {
    if (p.status !== 'Active') continue;
    const sid = resolve(p.siteId);
    if (sid && inScope(scope, sid)) siteBySu.set(p.suId, sid);
  }
  const out: ResidentProfile = { activeResidents: 0, vulnerable: 0, disabilities: 0, peep: 0, geep: 0, noEvacuationPlan: 0, interconnectingRooms: 0, interconnectGroups: 0 };
  for (const su of input.serviceUsers) {
    if (!siteBySu.has(su.id)) continue;
    if (su.archiveStatus === 'Archived' || su.status === 'Archived' || su.status === 'Discharged' || su.status === 'Inactive') continue;
    out.activeResidents++;
    if (String(su.vulnerable || '').trim().toLowerCase() === 'yes') out.vulnerable++;
    const cat = String(su.disabilityCategory || '').trim().toLowerCase();
    const typ = String(su.disabilityType || '').trim().toLowerCase();
    if (!NO_VALUES.has(cat) || !NO_VALUES.has(typ)) out.disabilities++;
    const plan = String(su.personalEvacuationPlan || '').trim().toUpperCase();
    if (plan.startsWith('PEEP')) out.peep++;
    else if (plan.startsWith('GEEP')) out.geep++;
    else out.noEvacuationPlan++;
  }
  const groups = new Set<string>();
  for (const r of input.registerRooms) {
    const sid = resolve(r.hotel);
    if (!inScope(scope, sid) || String(r.roomCategory || '') !== 'Interconnecting') continue;
    out.interconnectingRooms++;
    const g = String(r.interconnectGroup || '').trim();
    if (g) groups.add(`${sid}|${g}`);
  }
  out.interconnectGroups = groups.size;
  return out;
}
