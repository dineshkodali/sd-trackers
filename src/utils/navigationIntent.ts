/**
 * Navigation intent - "open this page already filtered" and "open this record".
 *
 * The app switches pages by name only (`setActivePage`). A dashboard that says "6 overdue" must land
 * on the page showing exactly those 6, so a link can carry filters and a record id. The intent is
 * held in context, picked up once by the page it names, then cleared.
 *
 * Pure functions only; the context and the page hook use them.
 */

export interface NavigationIntent {
  id: number;
  page: string;
  filters: Record<string, string>;
  recordId?: string;
  /** Epoch ms when it was raised; a stale intent is ignored so it can never surprise a later visit. */
  at: number;
}

/** Filters a page accepts. Anything else in a link is dropped. */
export const INTENT_FILTERS: Record<string, readonly string[]> = {
  // sla: overdue | due-soon | on-track | completed-on-time | completed-late
  // open: '1' = not Completed and not Closed (the tracker's own rule)
  maintenance: ['sla', 'priority', 'open'],
  // expiry: comma list of expired | due-30 | due-90, decided from the expiry date
  compliance: ['expiry'],
  // open: '1' = not Resolved; urgency: Critical | High | Medium | Low
  escalations: ['open', 'urgency']
};

export const INTENT_MAX_AGE_MS = 10_000;
const MAX_VALUE_LENGTH = 100;

export function sanitizeIntentFilters(page: string, filters?: Record<string, unknown>): Record<string, string> {
  const allowed = INTENT_FILTERS[page] || [];
  const out: Record<string, string> = {};
  if (!filters || typeof filters !== 'object') return out;
  for (const key of allowed) {
    const v = filters[key];
    if (typeof v === 'string' && v.trim() !== '' && v.length <= MAX_VALUE_LENGTH) out[key] = v.trim();
  }
  return out;
}

export function makeIntent(
  page: string,
  opts: { filters?: Record<string, unknown>; recordId?: string } | undefined,
  now: number,
  id: number
): NavigationIntent {
  const recordId = typeof opts?.recordId === 'string' && opts.recordId.trim() !== '' ? opts.recordId.trim() : undefined;
  return { id, page, filters: sanitizeIntentFilters(page, opts?.filters), recordId, at: now };
}

export const isIntentFresh = (intent: NavigationIntent, page: string, now: number) =>
  intent.page === page && now - intent.at >= 0 && now - intent.at <= INTENT_MAX_AGE_MS;

/** 'expired,due-30' -> ['expired', 'due-30'] (empty entries removed) */
export const splitList = (value?: string): string[] => (value ? value.split(',').map(s => s.trim()).filter(Boolean) : []);
