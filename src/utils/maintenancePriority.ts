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

/** Resolves the clock-start from a form's reported date/time, falling back to now. */
export const reportedAt = (date?: string, time?: string): Date => {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(`${date}T${/^\d{1,2}:\d{2}$/.test(time || '') ? time!.padStart(5, '0') : '00:00'}:00`);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
};
