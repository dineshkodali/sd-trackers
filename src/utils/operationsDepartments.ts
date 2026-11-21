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

import type { DispersalRecord, EvictionRecord, NewArrivalRecord } from '../types';
import { addDaysIso, createSiteResolver, parseIsoDate, type SiteRef } from './operationsRules';

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
