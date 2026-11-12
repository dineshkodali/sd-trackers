import type { MaintenancePriority } from '../types';

export interface MaintenancePriorityRule {
  value: MaintenancePriority;
  label: string;
  timescale: string;
  hours?: number;
  workingDays?: number;
}

export const MAINTENANCE_PRIORITY_RULES: MaintenancePriorityRule[] = [
  { value: 'CAT 1', label: 'Cat 1 (4 Hours)', timescale: '4 Hours', hours: 4 },
  { value: 'CAT 2 - Interim', label: 'Cat 2 - Interim (24 Hours)', timescale: '24 Hours', hours: 24 },
  { value: 'CAT 2', label: 'Cat 2 (5 Working Days)', timescale: '5 Working Days', workingDays: 5 },
  { value: 'CAT 3', label: 'Cat 3 (28 Working Days)', timescale: '28 Working Days', workingDays: 28 }
];

export const getPriorityRule = (priority?: string) =>
  MAINTENANCE_PRIORITY_RULES.find(r => r.value === priority);

const addWorkingDays = (from: Date, days: number): Date => {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return d;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Formats as 'YYYY-MM-DD HH:MM' in local time, matching the stored closeDueDate format. */
export const formatDueDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const calculateDueDate = (priority: string | undefined, from: Date = new Date()): string => {
  const rule = getPriorityRule(priority);
  if (!rule) return '';
  const due = rule.hours !== undefined
    ? new Date(from.getTime() + rule.hours * 3600 * 1000)
    : addWorkingDays(from, rule.workingDays || 0);
  return formatDueDate(due);
};

/* ------------------------------------------------------------------ Complete By / SLA state */

/** A defect is due soon when its Complete By time is within this many hours. */
export const DUE_SOON_HOURS = 24;

export type SlaState = 'overdue' | 'due-soon' | 'on-track' | 'completed-on-time' | 'completed-late' | 'completed' | 'none';

export interface SlaInfo {
  state: SlaState;
  /** Open defects: time until Complete By (negative once overdue). Closed defects: how late it was closed (0 or less = on time). */
  ms: number | null;
}

interface SlaRecord {
  closeDueDate?: string;
  defectStatus?: string;
  action?: string;
  actualClosedDate?: string;
  actualClosedTime?: string;
}

/**
 * Parses a stored date ('YYYY-MM-DD HH:MM', 'YYYY-MM-DDTHH:MM' or 'YYYY-MM-DD') as local time.
 * A date with no time means the end of that day.
 */
export const parseLocalDateTime = (value?: string): { at: Date; hasTime: boolean } | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(String(value || '').trim());
  if (!m) return null;
  const hasTime = m[4] !== undefined;
  const at = hasTime
    ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0)
    : new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999);
  if (isNaN(at.getTime()) || at.getMonth() !== +m[2] - 1 || at.getDate() !== +m[3]) return null;
  return { at, hasTime };
};

export const isMaintenanceClosed = (r: SlaRecord) => r.defectStatus === 'Completed' || r.action === 'Closed';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Where a defect stands against its Complete By time.
 * A closed defect with no recorded closing time is compared by calendar day, so it is only
 * called late when it was closed on a later day than it was due.
 */
export const getSlaInfo = (r: SlaRecord, now: Date = new Date()): SlaInfo => {
  const due = parseLocalDateTime(r.closeDueDate);

  if (isMaintenanceClosed(r)) {
    if (!due) return { state: 'completed', ms: null };
    const closedTime = /^\d{1,2}:\d{2}$/.test(r.actualClosedTime || '') ? r.actualClosedTime : undefined;
    const closed = parseLocalDateTime(closedTime ? `${r.actualClosedDate} ${closedTime}` : r.actualClosedDate);
    if (!closed) return { state: 'completed', ms: null };
    const ms = closed.hasTime && due.hasTime
      ? closed.at.getTime() - due.at.getTime()
      : startOfDay(closed.at) - startOfDay(due.at);
    return { state: ms > 0 ? 'completed-late' : 'completed-on-time', ms };
  }

  if (!due) return { state: 'none', ms: null };
  const ms = due.at.getTime() - now.getTime();
  if (ms < 0) return { state: 'overdue', ms };
  return { state: ms <= DUE_SOON_HOURS * 3600 * 1000 ? 'due-soon' : 'on-track', ms };
};

/** '45m', '3h', '2d 4h' — sign is ignored. */
export const formatDuration = (ms: number): string => {
  const mins = Math.max(1, Math.round(Math.abs(ms) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${days}d ${rest}h` : `${days}d`;
};

/** Plain-text status for exports and tooltips. */
export const slaLabel = (info: SlaInfo): string => {
  switch (info.state) {
    case 'overdue': return `Overdue by ${formatDuration(info.ms!)}`;
    case 'due-soon': return `Due in ${formatDuration(info.ms!)}`;
    case 'on-track': return 'On track';
    case 'completed-late': return `Completed late by ${formatDuration(info.ms!)}`;
    case 'completed-on-time': return 'Completed on time';
    case 'completed': return 'Completed';
    default: return '—';
  }
};

/** Current local time as 'HH:MM', for stamping when a defect was closed. */
export const nowTime = (d: Date = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Resolves the clock-start from a form's reported date/time, falling back to now. */
export const reportedAt = (date?: string, time?: string): Date => {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(`${date}T${/^\d{1,2}:\d{2}$/.test(time || '') ? time!.padStart(5, '0') : '00:00'}:00`);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
};
