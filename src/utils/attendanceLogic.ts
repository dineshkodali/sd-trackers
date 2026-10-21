/**
 * Attendance and absence-monitoring rules (pure functions, no I/O).
 *
 * Principles
 *  - Only RECORDED absences count. A day with no record is "Not recorded" and is never treated as an absence.
 *  - A run of absences is counted in dates (consecutive expected attendance days), not in database rows,
 *    so a duplicated record cannot inflate it.
 *  - A recorded "Present" ends the run. A missing record on an expected day also ends it, because nobody
 *    has confirmed that day.
 *  - Which days are expected, and the 3-day / 7-day thresholds, come from an AbsencePolicy so the SOP can
 *    be changed without touching this code.
 */

export type AttendanceStatus = 'Present' | 'Absent';

export interface AttendanceEntry {
  suId: string;
  /** YYYY-MM-DD */
  date: string;
  status: AttendanceStatus;
  updatedAt?: string;
}

export interface AbsencePolicy {
  /** Consecutive recorded absent days that raise a follow-up (SOP: 3 and 7). */
  thresholds: number[];
  /** Days that are not expected attendance days (0 = Sunday ... 6 = Saturday). Empty = every day counts. */
  nonAttendanceWeekdays: number[];
  /** YYYY-MM-DD dates (e.g. bank holidays) that are not expected attendance days. */
  nonAttendanceDates: string[];
}

export const DEFAULT_ABSENCE_POLICY: AbsencePolicy = {
  thresholds: [3, 7],
  nonAttendanceWeekdays: [],
  nonAttendanceDates: []
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parse = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const format = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (date: string, n: number) => format(parse(date) + n * DAY_MS);
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const isIsoDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(parse(d));

export function isExpectedDay(date: string, policy: AbsencePolicy = DEFAULT_ABSENCE_POLICY): boolean {
  if (policy.nonAttendanceDates.includes(date)) return false;
  const weekday = new Date(parse(date)).getUTCDay();
  return !policy.nonAttendanceWeekdays.includes(weekday);
}

/** The previous expected attendance day before `date` (never more than 14 days back, so a bad policy cannot loop). */
export function previousExpectedDay(date: string, policy: AbsencePolicy = DEFAULT_ABSENCE_POLICY): string {
  let d = addDays(date, -1);
  for (let i = 0; i < 14 && !isExpectedDay(d, policy); i++) d = addDays(d, -1);
  return d;
}

/** One entry per resident + date (the most recently updated wins), so duplicates cannot be counted twice. */
export function dedupeEntries(entries: AttendanceEntry[]): AttendanceEntry[] {
  const byKey = new Map<string, AttendanceEntry>();
  for (const e of entries) {
    if (!isIsoDate(e.date)) continue;
    const key = `${e.suId}|${e.date}`;
    const prev = byKey.get(key);
    if (!prev || (e.updatedAt || '') >= (prev.updatedAt || '')) byKey.set(key, e);
  }
  return Array.from(byKey.values());
}

export interface AbsenceEpisode {
  suId: string;
  /** First day of the unbroken run of recorded absences. */
  startDate: string;
  /** Last day of the run. */
  endDate: string;
  /** Consecutive recorded absent days in the run. */
  days: number;
  /** Thresholds the run has reached (ascending). */
  thresholdsReached: number[];
  /** The next threshold not yet reached, if any. */
  nextThreshold: number | null;
  /** Latest date with any record for this resident (Present or Absent). */
  lastRecordedDate: string | null;
  /** Latest recorded Present date, if any. */
  lastPresentDate: string | null;
  /** True when the run reaches the most recent expected day (nothing unconfirmed since). */
  isCurrent: boolean;
}

/**
 * The absence run that ends at the resident's most recent recorded absence on or before `asOf`.
 * Returns null when the latest recorded status is Present, or there are no absences.
 */
export function currentAbsenceEpisode(
  suId: string,
  entries: AttendanceEntry[],
  asOf: string,
  policy: AbsencePolicy = DEFAULT_ABSENCE_POLICY
): AbsenceEpisode | null {
  const mine = dedupeEntries(entries.filter(e => e.suId === suId && e.date <= asOf))
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  if (mine.length === 0) return null;

  const lastRecordedDate = mine[0].date;
  const lastPresent = mine.find(e => e.status === 'Present');
  const byDate = new Map(mine.map(e => [e.date, e.status] as const));

  const latestAbsent = mine.find(e => e.status === 'Absent');
  // The run only exists if the most recent recorded day is an absence
  if (!latestAbsent || latestAbsent.date !== lastRecordedDate) return null;

  // Walk back through expected days while each one is a recorded absence
  let days = 0;
  let start = latestAbsent.date;
  let cursor = latestAbsent.date;
  while (byDate.get(cursor) === 'Absent') {
    days++;
    start = cursor;
    cursor = previousExpectedDay(cursor, policy);
  }

  const thresholds = [...policy.thresholds].sort((a, b) => a - b);
  const thresholdsReached = thresholds.filter(t => days >= t);
  const nextThreshold = thresholds.find(t => days < t) ?? null;

  // Current = no expected day after the run's end is still unconfirmed up to asOf
  let isCurrent = true;
  for (let d = addDays(latestAbsent.date, 1); d <= asOf; d = addDays(d, 1)) {
    if (isExpectedDay(d, policy) && !byDate.has(d)) { isCurrent = false; break; }
  }

  return {
    suId,
    startDate: start,
    endDate: latestAbsent.date,
    days,
    thresholdsReached,
    nextThreshold,
    lastRecordedDate,
    lastPresentDate: lastPresent?.date ?? null,
    isCurrent
  };
}

/** Stable identity of one follow-up: the same resident, episode and threshold always give the same key. */
export const followUpKey = (suId: string, startDate: string, thresholdDays: number) => `${suId}|${startDate}|${thresholdDays}`;

export interface ExistingFollowUp { suId: string; absenceStartDate: string; thresholdDays: number }
export interface NewFollowUp { suId: string; absenceStartDate: string; thresholdDays: number; consecutiveDays: number }

/**
 * Follow-ups that should exist but do not yet. Running this again with the follow-ups it produced returns
 * nothing, so repeated processing never creates duplicates.
 */
export function followUpsToCreate(
  suIds: string[],
  entries: AttendanceEntry[],
  existing: ExistingFollowUp[],
  asOf: string,
  policy: AbsencePolicy = DEFAULT_ABSENCE_POLICY
): NewFollowUp[] {
  const have = new Set(existing.map(f => followUpKey(f.suId, String(f.absenceStartDate).slice(0, 10), f.thresholdDays)));
  const out: NewFollowUp[] = [];
  for (const suId of suIds) {
    const episode = currentAbsenceEpisode(suId, entries, asOf, policy);
    if (!episode) continue;
    for (const threshold of episode.thresholdsReached) {
      if (!have.has(followUpKey(suId, episode.startDate, threshold))) {
        out.push({ suId, absenceStartDate: episode.startDate, thresholdDays: threshold, consecutiveDays: episode.days });
      }
    }
  }
  return out;
}

export interface DayCounts { present: number; absent: number; notRecorded: number }

/** Present / absent / not recorded for one day across the given residents. */
export function dayCounts(suIds: string[], entries: AttendanceEntry[], date: string): DayCounts {
  const status = new Map(dedupeEntries(entries.filter(e => e.date === date)).map(e => [e.suId, e.status] as const));
  let present = 0, absent = 0, notRecorded = 0;
  for (const id of suIds) {
    const s = status.get(id);
    if (s === 'Present') present++;
    else if (s === 'Absent') absent++;
    else notRecorded++;
  }
  return { present, absent, notRecorded };
}
