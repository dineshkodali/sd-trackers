/**
 * Central Operations Dashboard - shared rules (pure functions, no I/O).
 *
 * Every number on the dashboard is built from these definitions so it can be reproduced
 * from the rows behind it. See docs/SDTRACKER_CENTRAL_DASHBOARD_AUDIT_AND_DESIGN.md §7.2.
 *
 * Time: the business runs on Europe/London wall-clock time. Dates and times here are compared as
 * 'YYYY-MM-DD' / 'YYYY-MM-DD HH:MM' strings in that zone, so results do not depend on the time
 * zone of the machine (browser or server) doing the calculation.
 */

export const BUSINESS_TIME_ZONE = 'Europe/London';

const londonParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
});

/** The current London wall-clock date and time. */
export function londonNow(now: Date = new Date()): { date: string; time: string; wall: string } {
  const p: Record<string, string> = {};
  for (const part of londonParts.formatToParts(now)) if (part.type !== 'literal') p[part.type] = part.value;
  const date = `${p.year}-${p.month}-${p.day}`;
  const time = `${p.hour}:${p.minute}`;
  return { date, time, wall: `${date} ${time}` };
}

export const londonToday = (now: Date = new Date()) => londonNow(now).date;

const DAY_MS = 86_400_000;
const utcDay = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

export function addDaysIso(iso: string, n: number): string {
  return new Date(utcDay(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string) => Math.round((utcDay(to) - utcDay(from)) / DAY_MS);

/**
 * A stored date as 'YYYY-MM-DD', or null when it is missing or not a real calendar date.
 * Accepts a leading ISO date ('2026-11-12', '2026-11-12T10:00', '2026-11-12 10:00'). Anything
 * else (including day-first or month-first text) is rejected, never guessed.
 */
export function parseIsoDate(value: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?![\d])/.exec(String(value ?? '').trim());
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return new Date(utcDay(iso)).toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * A stored due time as London 'YYYY-MM-DD HH:MM'. A date with no time is due at the end of that day.
 * Null when unreadable.
 */
export function parseWall(value: unknown): string | null {
  const text = String(value ?? '').trim();
  const date = parseIsoDate(text);
  if (!date) return null;
  const t = /^\d{4}-\d{2}-\d{2}[ T](\d{1,2}):(\d{2})/.exec(text);
  if (!t) return `${date} 23:59`;
  const h = Number(t[1]);
  const mi = Number(t[2]);
  if (h > 23 || mi > 59) return null;
  return `${date} ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

/** Minutes from `from` to `to`, both London wall strings ('YYYY-MM-DD HH:MM'). */
export function wallMinutesBetween(from: string, to: string): number {
  const f = (w: string) => utcDay(w.slice(0, 10)) / 60000 + Number(w.slice(11, 13)) * 60 + Number(w.slice(14, 16));
  return f(to) - f(from);
}

export type PeriodKind = 'today' | '7d' | '30d' | 'month';

export const PERIOD_LABELS: Record<PeriodKind, string> = { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', month: 'This month' };

/** Inclusive London date range for a reporting period ending today. '7d' is today and the 6 days before it. */
export function periodRange(kind: PeriodKind, today: string): { from: string; to: string } {
  switch (kind) {
    case 'today': return { from: today, to: today };
    case '7d': return { from: addDaysIso(today, -6), to: today };
    case '30d': return { from: addDaysIso(today, -29), to: today };
    case 'month': return { from: `${today.slice(0, 7)}-01`, to: today };
  }
}

/** 'Today', 'Tomorrow', 'in 3 d', 'Yesterday', '3 d ago' for a date relative to `today` (both 'YYYY-MM-DD'). */
export function relativeDay(date: string, today: string): string {
  const n = daysBetween(today, date);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `in ${n} d` : `${-n} d ago`;
}

/* ------------------------------------------------------------------ sites */

const alnum = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

export interface SiteRef { id: string; name: string }

/**
 * Resolves a site written as an id ("site-519") or a name ("Brit Hotel") to the site id.
 * Matching is exact after removing case and punctuation. It is deliberately NOT the substring match
 * used by isSitePermitted, which would let "Brit" match "Brit Hotel 2". Returns null when no site
 * matches, so the record can be reported instead of being counted against the wrong site.
 */
export function createSiteResolver(sites: SiteRef[]): (value: unknown) => string | null {
  const byKey = new Map<string, string>();
  const ambiguous = new Set<string>();
  const add = (key: string, id: string) => {
    if (!key) return;
    const prev = byKey.get(key);
    if (prev && prev !== id) ambiguous.add(key);
    else byKey.set(key, id);
  };
  for (const s of sites) { add(alnum(s.id), s.id); add(alnum(s.name), s.id); }
  return (value: unknown) => {
    const key = alnum(value);
    if (!key || ambiguous.has(key)) return null;
    return byKey.get(key) ?? null;
  };
}

/* ------------------------------------------------------------------ compliance */

export type ComplianceState = 'expired' | 'due-30' | 'due-90' | 'valid' | 'unknown';

export interface ComplianceInfo { state: ComplianceState; expiry: string | null; days: number | null }

/**
 * Compliance state from the expiry DATE. The tracker's own "status" is picked by hand from a
 * dropdown, so a lapsed certificate can still read "Compliant"; it is ignored here.
 * Expiring on `today` is still valid today (due in 0 days).
 */
export function complianceInfo(expiryDate: unknown, today: string): ComplianceInfo {
  const expiry = parseIsoDate(expiryDate);
  if (!expiry) return { state: 'unknown', expiry: null, days: null };
  const days = daysBetween(today, expiry);
  const state: ComplianceState = days < 0 ? 'expired' : days <= 30 ? 'due-30' : days <= 90 ? 'due-90' : 'valid';
  return { state, expiry, days };
}

/* ------------------------------------------------------------------ small shared predicates */

/** Open escalations are everything not Resolved. */
export const isEscalationOpen = (e: { status?: string }) => e.status !== 'Resolved';

export const isIssueOpen = (i: { status?: string }) => i.status === 'Open' || i.status === 'In Progress';

export const isFollowUpOpen = (f: { status?: string }) => f.status !== 'Resolved';

/** A date-only value (or the date part of a timestamp) is overdue when it is before today. */
export function isDatePast(value: unknown, today: string): boolean {
  const d = parseIsoDate(value);
  return d !== null && d < today;
}

export function isDateWithin(value: unknown, today: string, days: number): boolean {
  const d = parseIsoDate(value);
  return d !== null && d >= today && d <= addDaysIso(today, days);
}
