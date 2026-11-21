/**
 * Operations Dashboard - the ONE list of actionable work and deadlines (pure, no I/O, no React).
 *
 * Every open task from every module that has a genuine deadline or outstanding action is turned into one row here, once,
 * keyed by its source record. The KPI "Outstanding" is the length of this list and "Overdue" is the rows in the overdue
 * bucket, so the numbers always equal the rows behind them and no task can be counted or shown twice.
 *
 * Deadlines are the ones stored on the record or defined by the module's own rule (room/welfare checks: first review by
 * the 10th, second by the 25th). A record without a deadline is classed "No deadline"; a deadline is never invented.
 * Dated work further than UPCOMING_DAYS away is not listed (it is not yet actionable and would drown the real work).
 *
 * Modules with no deadline and no outstanding state (laundry, meals, catering, food logs, reports, daily-register
 * snapshots, new arrivals) are intentionally absent. See docs/SDTRACKER_OPERATIONS_DASHBOARD_REFINEMENT.md.
 */

import type { FinanceBill } from '../types/finance';
import type { TransportFundingRequestRecord } from '../types';
import type { CheckRow } from './checkObligations';
import { collectFacts, type OpsInput, type OpsScope } from './operationsSelectors';
import { collectFlowFacts, parseFlexDate, type FlowInput } from './operationsDepartments';
import { isMaintenanceClosed } from './maintenancePriority';
import { isEscalationOpen, addDaysIso, daysBetween, createSiteResolver, londonNow, parseIsoDate, parseWall, wallMinutesBetween } from './operationsRules';

export const UPCOMING_DAYS = 30;
export const WEEK_DAYS = 6; // "this week" = after tomorrow, up to 6 days from today

export type Bucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'upcoming' | 'none';
export const BUCKET_ORDER: Record<Bucket, number> = { overdue: 0, today: 1, tomorrow: 2, week: 3, upcoming: 4, none: 5 };
export const BUCKET_LABEL: Record<Bucket, string> = { overdue: 'Overdue', today: 'Due today', tomorrow: 'Due tomorrow', week: 'Due this week', upcoming: 'Upcoming', none: 'No deadline' };

export type TaskPriority = 'Critical' | 'High' | 'Normal';
const PRIORITY_ORDER: Record<TaskPriority, number> = { Critical: 0, High: 1, Normal: 2 };

export type TaskModule =
  | 'Maintenance' | 'Compliance' | 'Escalations' | 'PEEP' | 'Absence follow-up' | 'Room inspection' | 'Room issue'
  | 'Room check' | 'Welfare check' | 'Dispersal' | 'Eviction' | 'Finance' | 'Transport';

export interface UnifiedTask {
  /** `${module}:${source id}` - unique, stable, used for de-duplication and React keys */
  key: string;
  module: TaskModule;
  /** page that owns the record */
  page: string;
  filters?: Record<string, string>;
  recordId?: string;
  openId?: string;
  priority: TaskPriority;
  task: string;
  siteId: string;
  siteName: string;
  location: string;
  assignedTo: string;
  /** 'YYYY-MM-DD' or '' when the source does not store one */
  created: string;
  /** 'YYYY-MM-DD HH:MM' (London) or '' */
  due: string;
  bucket: Bucket;
  /** "3 d overdue", "in 4 h", "Tomorrow" ... */
  remaining: string;
  status: string;
}

export interface TaskInput extends OpsInput, FlowInput {
  roomRows: CheckRow[];
  welfareRows: CheckRow[];
  bills: FinanceBill[];
  transport: TransportFundingRequestRecord[];
  /** Modules the user may open; a module not listed is not read at all */
  visible: Partial<Record<TaskModule, boolean>>;
}

/* ------------------------------------------------------------------ classification */

function durationText(totalMinutes: number): string {
  const m = Math.abs(totalMinutes);
  if (m < 60) return `${Math.max(1, Math.round(m))} m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

/** Bucket and wording for a deadline ('YYYY-MM-DD' or 'YYYY-MM-DD HH:MM'; a bare date is due at the end of that day). */
export function classifyDeadline(due: string | null, nowWall: string): { bucket: Bucket; remaining: string; due: string } {
  if (!due) return { bucket: 'none', remaining: '—', due: '' };
  const wall = due.length > 10 ? due : `${due} 23:59`;
  const today = nowWall.slice(0, 10);
  const dueDate = wall.slice(0, 10);
  const mins = wallMinutesBetween(nowWall, wall);
  const timed = due.length > 10 && !due.endsWith('23:59');
  if (mins < 0) return { bucket: 'overdue', remaining: `${durationText(mins)} overdue`, due: wall };
  const days = daysBetween(today, dueDate);
  if (days === 0) return { bucket: 'today', remaining: timed ? `in ${durationText(mins)}` : 'Due today', due: wall };
  if (days === 1) return { bucket: 'tomorrow', remaining: 'Tomorrow', due: wall };
  if (days <= WEEK_DAYS) return { bucket: 'week', remaining: `in ${days} d`, due: wall };
  return { bucket: 'upcoming', remaining: `in ${days} d`, due: wall };
}

const bump = (priority: TaskPriority, bucket: Bucket): TaskPriority =>
  bucket === 'overdue' && priority === 'Normal' ? 'High' : priority;

/* ------------------------------------------------------------------ the list */

const BILL_OUTSTANDING = new Set(['submitted', 'under_review', 'verification_pending', 'query_raised', 'awaiting_approval', 'payment_pending', 'partially_paid', 'reconciliation_pending']);
const TRANSPORT_OUTSTANDING = new Set(['Submitted', 'Under Review', 'Clarification Required', 'Approved', 'Issued']);

export function selectUnifiedTasks(input: TaskInput, scope: OpsScope, now: Date = new Date()): { tasks: UnifiedTask[]; unreadableDates: Record<string, number> } {
  const facts = collectFacts(input, scope, now);
  const { ctx } = facts;
  const { wall: nowWall, date: today } = londonNow(now);
  const horizon = addDaysIso(today, UPCOMING_DAYS);
  const resolve = createSiteResolver(input.sites);
  const scoped = (siteId: string | null) =>
    siteId !== null && (scope.allowedSiteIds === 'all' || scope.allowedSiteIds.has(siteId)) && (scope.siteId === 'all' || scope.siteId === siteId);
  const v = input.visible;
  const found = new Map<string, UnifiedTask>();
  const unreadable: Record<string, number> = {};

  const add = (t: Omit<UnifiedTask, 'siteName' | 'bucket' | 'remaining' | 'due' | 'priority'> & { dueRaw: string | null; priority: TaskPriority; keepFarFuture?: boolean }) => {
    const c = classifyDeadline(t.dueRaw, nowWall);
    if (c.bucket === 'upcoming' && c.due.slice(0, 10) > horizon && !t.keepFarFuture) return;
    const { dueRaw: _d, keepFarFuture: _k, ...rest } = t;
    found.set(t.key, { ...rest, siteName: ctx.siteName(t.siteId), bucket: c.bucket, remaining: c.remaining, due: c.due, priority: bump(t.priority, c.bucket) });
  };

  if (v.Maintenance) {
    for (const m of facts.maintenance) {
      if (isMaintenanceClosed(m.r)) continue;
      const pr: TaskPriority = m.r.priority === 'CAT 1' ? 'Critical' : m.r.priority === 'CAT 2 - Interim' ? 'High' : 'Normal';
      add({
        key: `Maintenance:${m.r.id}`, module: 'Maintenance', page: 'maintenance', recordId: m.r.id, priority: pr,
        task: m.r.description || 'Maintenance defect', siteId: m.siteId, location: [m.r.room, m.r.location].filter(Boolean).join(' · '),
        assignedTo: '', created: parseIsoDate(m.r.date) || '', dueRaw: m.due, status: m.r.defectStatus
      });
    }
  }

  if (v.Compliance) {
    for (const c of facts.compliance) {
      if (c.info.state === 'valid' || c.info.state === 'unknown' || !c.info.expiry) continue;
      const pr: TaskPriority = c.info.state === 'expired' ? 'Critical' : (c.info.days as number) <= 7 ? 'High' : 'Normal';
      add({
        key: `Compliance:${c.r.id}`, module: 'Compliance', page: 'compliance', recordId: c.r.id, priority: pr,
        task: `${c.r.complianceType || 'Compliance item'} - ${c.info.state === 'expired' ? 'expired' : 'renewal due'}`, siteId: c.siteId, location: '',
        assignedTo: c.r.contractorName || '', created: parseIsoDate(c.r.createdAt) || '', dueRaw: c.info.expiry, status: c.r.status
      });
    }
  }

  if (v.Escalations) {
    for (const e of facts.escalations) {
      if (!isEscalationOpen(e.r)) continue;
      const pr: TaskPriority = e.r.urgency === 'Critical' ? 'Critical' : e.r.urgency === 'High' ? 'High' : 'Normal';
      add({
        key: `Escalations:${e.r.id}`, module: 'Escalations', page: 'escalations', recordId: e.r.id, priority: pr,
        task: `${e.r.incidentType || e.r.incidentTitle || 'Escalation'}`, siteId: e.siteId, location: '',
        assignedTo: e.r.escalatedTo || '', created: parseIsoDate(e.r.createdAt) || '', dueRaw: null, status: e.r.status
      });
    }
  }

  const actionModule: Record<string, [TaskModule, string]> = {
    peep: ['PEEP', 'peepTracker'], followUp: ['Absence follow-up', 'suAttendance'], inspection: ['Room inspection', 'propertyManagement'], issue: ['Room issue', 'propertyManagement']
  };
  for (const a of facts.actions) {
    const [module, page] = actionModule[a.kind];
    if (!v[module] || !a.dueDate) continue;
    add({
      key: `${module}:${a.recordId}`, module, page, recordId: a.recordId, openId: a.openId, priority: 'Normal',
      task: a.label, siteId: a.siteId, location: a.location, assignedTo: a.owner, created: '', dueRaw: a.dueDate,
      status: a.overdue ? 'Overdue' : 'Open'
    });
  }

  // Room and welfare checks: two a month, by the 10th and 25th (dates come from the obligations, i.e. the settings).
  const checkTasks = (rows: CheckRow[], module: 'Room check' | 'Welfare check', page: 'roomChecks' | 'welfareChecks') => {
    if (!v[module]) return;
    for (const row of rows) {
      if (!row.siteId || !scoped(row.siteId)) continue;
      for (const o of [row.first, row.second]) {
        if (!o || (o.status !== 'pending' && o.status !== 'overdue')) continue;
        add({
          key: `${module}:${o.key}`, module, page, filters: { due: o.status === 'overdue' ? 'overdue' : 'pending', month: o.month }, priority: 'Normal',
          task: `${module === 'Room check' ? 'Room check' : 'Welfare check'} - ${o.period === 1 ? 'first review (by the 10th)' : 'second review (by the 25th)'}${o.suName ? ` - ${o.suName}` : ''}`,
          siteId: o.siteId, location: [o.propertyName, o.roomNumber && `Room ${o.roomNumber}`].filter(Boolean).join(' · '),
          assignedTo: o.responsible.name, created: '', dueRaw: o.deadline, status: o.status === 'overdue' ? 'Overdue' : 'Pending'
        });
      }
    }
  };
  checkTasks(input.roomRows, 'Room check', 'roomChecks');
  checkTasks(input.welfareRows, 'Welfare check', 'welfareChecks');

  if (v.Dispersal || v.Eviction) {
    const flow = collectFlowFacts(input, scope);
    for (const [k, n] of Object.entries(flow.quality.unreadableDate)) unreadable[k] = (unreadable[k] || 0) + n;
    if (v.Dispersal) {
      for (const d of flow.dispersals) {
        if (d.left || !d.dueDate) continue;
        add({
          key: `Dispersal:${d.r.id}`, module: 'Dispersal', page: 'dispersal', recordId: d.r.id, priority: 'Normal',
          task: `Dispersal${d.r.typeOfDispersal ? ` (${d.r.typeOfDispersal})` : ''}${d.r.suName ? ` - ${d.r.suName}` : ''}`, siteId: d.siteId, location: d.r.flatRoomNumber ? `Room ${d.r.flatRoomNumber}` : '',
          assignedTo: '', created: parseIsoDate(d.r.createdAt) || '', dueRaw: d.dueDate, status: 'Awaiting departure'
        });
      }
    }
    if (v.Eviction) {
      for (const e of flow.evictions) {
        if (e.r.status !== 'Notice Issued' && e.r.status !== 'Appeal Pending') continue;
        add({
          key: `Eviction:${e.r.id}`, module: 'Eviction', page: 'dispersal', recordId: e.r.id, priority: 'Normal',
          task: `Eviction - ${e.r.status.toLowerCase()}${e.r.suName ? ` - ${e.r.suName}` : ''}`, siteId: e.siteId, location: e.r.roomNo ? `Room ${e.r.roomNo}` : '',
          assignedTo: '', created: parseIsoDate(e.r.createdAt) || '', dueRaw: e.date, status: e.r.status
        });
      }
    }
  }

  if (v.Finance) {
    for (const b of input.bills) {
      if (!BILL_OUTSTANDING.has(String(b.status))) continue;
      const siteId = resolve(b.siteName || b.siteId);
      if (!scoped(siteId)) continue;
      add({
        key: `Finance:${b.id}`, module: 'Finance', page: 'finance', recordId: b.id, priority: 'Normal',
        task: `Bill ${b.billNumber}${b.vendorName ? ` - ${b.vendorName}` : ''} (${String(b.status).replace(/_/g, ' ')})`, siteId: siteId!, location: '',
        assignedTo: b.assignedApproverName || '', created: parseIsoDate(b.submittedAt) || '', dueRaw: parseIsoDate(b.dueDate), status: String(b.status).replace(/_/g, ' ')
      });
    }
  }

  if (v.Transport) {
    for (const t of input.transport) {
      if (!TRANSPORT_OUTSTANDING.has(String(t.status))) continue;
      const siteId = resolve(t.siteName);
      if (!scoped(siteId)) continue;
      const appt = parseFlexDate(t.appointmentDate);
      add({
        key: `Transport:${t.id}`, module: 'Transport', page: 'publicTransport', recordId: t.id, priority: 'Normal',
        task: `Transport funding (${t.status})`, siteId: siteId!, location: '', assignedTo: t.requestedBy || '',
        created: parseIsoDate(t.requestDatetime) || '', dueRaw: appt ? `${appt}${t.appointmentTime && /^\d{1,2}:\d{2}/.test(t.appointmentTime) ? ` ${String(t.appointmentTime).slice(0, 5).padStart(5, '0')}` : ''}` : null, status: String(t.status)
      });
    }
  }

  const tasks = [...found.values()].sort((a, b) =>
    BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    (a.due || '9').localeCompare(b.due || '9') || a.siteName.localeCompare(b.siteName) || a.key.localeCompare(b.key));
  return { tasks, unreadableDates: unreadable };
}

/* ------------------------------------------------------------------ KPIs and filters (same list, same numbers) */

export interface TaskCounts { outstanding: number; overdue: number; dueToday: number; dueThisWeek: number }

export function countTasks(tasks: UnifiedTask[]): TaskCounts {
  return {
    outstanding: tasks.length,
    overdue: tasks.filter(t => t.bucket === 'overdue').length,
    dueToday: tasks.filter(t => t.bucket === 'today').length,
    dueThisWeek: tasks.filter(t => t.bucket === 'tomorrow' || t.bucket === 'week').length
  };
}

export interface TaskFilter {
  site: string | 'all';
  module: TaskModule | 'all';
  status: string | 'all';
  /** 'all' | 'overdue' | 'today' | 'week' (tomorrow + this week) */
  when: 'all' | 'overdue' | 'today' | 'week';
  assignedTo: string | 'all';
}

export const NO_TASK_FILTER: TaskFilter = { site: 'all', module: 'all', status: 'all', when: 'all', assignedTo: 'all' };

export function filterTasks(tasks: UnifiedTask[], f: TaskFilter): UnifiedTask[] {
  return tasks.filter(t =>
    (f.site === 'all' || t.siteId === f.site) &&
    (f.module === 'all' || t.module === f.module) &&
    (f.status === 'all' || t.status === f.status) &&
    (f.assignedTo === 'all' || t.assignedTo === f.assignedTo) &&
    (f.when === 'all' || (f.when === 'overdue' ? t.bucket === 'overdue' : f.when === 'today' ? t.bucket === 'today' : t.bucket === 'tomorrow' || t.bucket === 'week' || t.bucket === 'today')));
}

/* ------------------------------------------------------------------ "view all" landing per module */

/** Where "View all" goes for a module: the owning page, filtered as far as that page can be (never a filter it cannot apply). */
export function moduleLanding(module: TaskModule, overdueOnly: boolean): { page: string; filters?: Record<string, string> } {
  switch (module) {
    case 'Maintenance': return { page: 'maintenance', filters: overdueOnly ? { sla: 'overdue' } : { open: '1' } };
    case 'Compliance': return { page: 'compliance', filters: { expiry: overdueOnly ? 'expired' : 'expired,due-30,due-90' } };
    case 'Escalations': return { page: 'escalations', filters: { open: '1' } };
    case 'Room check': return { page: 'roomChecks', filters: { due: overdueOnly ? 'overdue' : 'all' } };
    case 'Welfare check': return { page: 'welfareChecks', filters: { due: overdueOnly ? 'overdue' : 'all' } };
    case 'PEEP': return { page: 'peepTracker' };
    case 'Absence follow-up': return { page: 'suAttendance' };
    case 'Room inspection':
    case 'Room issue': return { page: 'propertyManagement' };
    case 'Dispersal':
    case 'Eviction': return { page: 'dispersal' };
    case 'Finance': return { page: 'finance' };
    case 'Transport': return { page: 'publicTransport' };
  }
}
