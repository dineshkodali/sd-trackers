/**
 * Monthly attendance calendar for ONE Service User (pure).
 *
 * Source: su_attendance_records (the same rows the Attendance page writes). The database allows one record per
 * resident per day; if a duplicate ever arrives the most recently updated record is the day's value, so the calendar and
 * the Attendance page agree. Records for another Service User are ignored, never mixed in.
 * Unrecorded days are "no record" - never absent - and future days are never counted.
 */

export type AttendanceStatus = 'Present' | 'Absent';

export interface AttendanceRow {
  id: string;
  suId: string;
  attendanceDate: string;
  attendanceStatus: AttendanceStatus | string;
  additionalNotes?: string;
  recordedBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CalendarDay {
  /** 'YYYY-MM-DD' */
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  record: AttendanceRow | null;
  status: AttendanceStatus | null;
}

export interface MonthSummary {
  recorded: number;
  present: number;
  absent: number;
  /** present / recorded, whole percent; null when nothing is recorded */
  percent: number | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const fromUtc = (dt: Date) => iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());

export const monthKey = (date: string) => date.slice(0, 7);
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`;
}

/** The record that represents each day for this Service User only. */
export function dailyRecords(rows: AttendanceRow[], suId: string): Map<string, AttendanceRow> {
  const out = new Map<string, AttendanceRow>();
  for (const r of rows) {
    if (r.suId !== suId) continue;
    if (r.attendanceStatus !== 'Present' && r.attendanceStatus !== 'Absent') continue;
    const date = String(r.attendanceDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const cur = out.get(date);
    const stamp = (x: AttendanceRow) => `${x.updatedAt || x.createdAt || ''}|${x.id}`;
    if (!cur || stamp(r) > stamp(cur)) out.set(date, { ...r, attendanceDate: date });
  }
  return out;
}

/** Monday-first grid of whole weeks covering `month` ('YYYY-MM'). */
export function buildMonth(month: string, rows: AttendanceRow[], suId: string, today: string): CalendarDay[] {
  const [y, m] = month.split('-').map(Number);
  const byDate = dailyRecords(rows, suId);
  const first = utc(y, m, 1);
  const lead = (first.getUTCDay() + 6) % 7;             // Monday = 0
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;
  const days: CalendarDay[] = [];
  for (let i = 0; i < total; i++) {
    const dt = new Date(first.getTime() + (i - lead) * 86_400_000);
    const date = fromUtc(dt);
    const record = byDate.get(date) ?? null;
    days.push({
      date, day: dt.getUTCDate(), inMonth: date.slice(0, 7) === month, isToday: date === today, isFuture: date > today,
      record, status: record ? (record.attendanceStatus as AttendanceStatus) : null
    });
  }
  return days;
}

/** Counts for the days of `month` only. Unrecorded and future days are not in the count. */
export function summariseMonth(days: CalendarDay[]): MonthSummary {
  let present = 0; let absent = 0;
  for (const d of days) {
    if (!d.inMonth || d.isFuture || !d.record) continue;
    if (d.status === 'Present') present++; else if (d.status === 'Absent') absent++;
  }
  const recorded = present + absent;
  return { recorded, present, absent, percent: recorded > 0 ? Math.round((present / recorded) * 100) : null };
}
