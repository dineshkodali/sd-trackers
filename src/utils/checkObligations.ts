/**
 * Twice-monthly Room Checks and Welfare Checks - the obligation rules (pure, no I/O).
 *
 * Every month a room that is occupied, and every resident who is placed, owes TWO checks:
 *   Check 1 - by the 10th   (window: 1st to 10th)
 *   Check 2 - by the 25th   (window: 11th to 25th)
 * The days come from settings; nothing is hard-coded to 10 and 25. Dates are London calendar dates.
 *
 * Each obligation is tracked on its own. A visit satisfies at most one obligation, so two visits in the same window can
 * never both count, and completing the first check does not complete the second.
 *
 * Nothing here creates or changes a visit record. A missing check is reported as missed; it is never recorded as done.
 * Obligations are DERIVED from rooms, placements and the visits that exist, for any month, current or past.
 */

import { addDaysIso, daysBetween, londonNow, parseIsoDate, createSiteResolver } from './operationsRules';
import { isOutOfUse, isPlaceholderRoom } from './roomManagementLogic';
import type { Placement, PropertyMaster, PropertyRoom, ServiceUserMaster } from '../types/masterData';

/* ------------------------------------------------------------------ settings */

export interface CheckSettings {
  /** Day of the month each check is due by (inclusive, end of that day). */
  firstDeadlineDay: number;
  secondDeadlineDay: number;
  /** A room / resident owes a check for a window only if they were in place for at least this many days of it. */
  minOccupiedDays: number;
}

export const DEFAULT_CHECK_SETTINGS: CheckSettings = { firstDeadlineDay: 10, secondDeadlineDay: 25, minOccupiedDays: 3 };

export function normaliseSettings(input?: Partial<CheckSettings> | null): CheckSettings {
  const d = DEFAULT_CHECK_SETTINGS;
  const first = Number(input?.firstDeadlineDay);
  const second = Number(input?.secondDeadlineDay);
  const min = Number(input?.minOccupiedDays);
  const f = Number.isInteger(first) && first >= 1 && first <= 27 ? first : d.firstDeadlineDay;
  const s = Number.isInteger(second) && second > f && second <= 28 ? second : (f < d.secondDeadlineDay ? d.secondDeadlineDay : Math.min(28, f + 15));
  const m = Number.isInteger(min) && min >= 1 && min <= 10 ? min : d.minOccupiedDays;
  return { firstDeadlineDay: f, secondDeadlineDay: s, minOccupiedDays: m };
}

/* ------------------------------------------------------------------ periods */

export type CheckType = 'room' | 'welfare';
export type CheckPeriod = 1 | 2;

export interface CheckWindow {
  period: CheckPeriod;
  /** 'YYYY-MM-DD', inclusive */
  start: string;
  end: string;
  /** Same as end: due by the end of this day */
  deadline: string;
}

/** 'YYYY-MM' of a London date. */
export const monthOf = (isoDate: string) => isoDate.slice(0, 7);

export function monthWindows(month: string, settings: CheckSettings = DEFAULT_CHECK_SETTINGS): [CheckWindow, CheckWindow] {
  const d = (day: number) => `${month}-${String(day).padStart(2, '0')}`;
  return [
    { period: 1, start: d(1), end: d(settings.firstDeadlineDay), deadline: d(settings.firstDeadlineDay) },
    { period: 2, start: d(settings.firstDeadlineDay + 1), end: d(settings.secondDeadlineDay), deadline: d(settings.secondDeadlineDay) }
  ];
}

export const lastDayOfMonth = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

export const previousMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
};

/* ------------------------------------------------------------------ statuses */

export type ObligationStatus =
  | 'pending'          // deadline not reached, not done
  | 'completed'        // done by the deadline
  | 'completed_late'   // done, but after the deadline
  | 'overdue'          // deadline passed, no visit
  | 'exempt';          // excused (reserved: needs the persisted ledger)

export const isSatisfied = (s: ObligationStatus) => s === 'completed' || s === 'completed_late' || s === 'exempt';

/* ------------------------------------------------------------------ visits */

/** A completed visit, reduced to what the rules need. Built from room_checks / welfare_checks by the helpers below. */
export interface Visit {
  id: string;
  /** room id (room checks) or Service User id (welfare checks) */
  subjectId: string;
  /** London calendar date of the visit */
  date: string;
  completedBy: string;
}

export interface UnmatchedVisit { id: string; date: string; reason: string; label: string }

/* ------------------------------------------------------------------ occupancy */

export interface Occupancy { start: string; end: string | null }

const placementRange = (p: Placement): Occupancy | null => {
  const start = parseIsoDate(p.startDate);
  if (!start) return null;
  const end = p.endDate ? parseIsoDate(p.endDate) : null;
  // Cancelled placements never happened. Completed / transferred ones ended on their end date.
  if (p.status === 'Cancelled') return null;
  if (p.status !== 'Active' && !end) return null;
  return { start, end };
};

/** Days (inclusive) that `occ` overlaps `[from, to]`. */
function overlapDays(occ: Occupancy, from: string, to: string): number {
  const s = occ.start > from ? occ.start : from;
  const e = occ.end && occ.end < to ? occ.end : to;
  return e < s ? 0 : daysBetween(s, e) + 1;
}

/** Whether any of the periods of occupancy covers at least `minDays` of the window. Overlapping periods are not double counted. */
export function occupiedEnough(periods: Occupancy[], w: CheckWindow, minDays: number): boolean {
  // Merge so two people sharing a room, or back-to-back placements, count each day once.
  const clipped = periods
    .map(o => ({ s: o.start > w.start ? o.start : w.start, e: o.end && o.end < w.end ? o.end : w.end }))
    .filter(r => r.e >= r.s)
    .sort((a, b) => (a.s < b.s ? -1 : 1));
  let total = 0;
  let curS: string | null = null;
  let curE: string | null = null;
  for (const r of clipped) {
    if (curS === null) { curS = r.s; curE = r.e; continue; }
    if (r.s <= addDaysIso(curE!, 1)) { if (r.e > curE!) curE = r.e; }
    else { total += daysBetween(curS, curE!) + 1; curS = r.s; curE = r.e; }
  }
  if (curS !== null) total += daysBetween(curS, curE!) + 1;
  return total >= minDays;
}

/* ------------------------------------------------------------------ obligations */

export interface ResponsiblePerson { name: string; source: 'property manager' | 'site lead officer' | 'site manager' | 'none' }

/** Who was in a room, and when (taken from placements; a person can appear more than once). */
export interface RoomOccupant { suId: string; name: string; reference: string; start: string; end: string | null }

export type OccupancyState = 'occupied' | 'vacated' | 'vacant';

export interface CheckObligation {
  key: string;
  type: CheckType;
  month: string;
  period: CheckPeriod;
  deadline: string;
  status: ObligationStatus;
  siteId: string;
  siteName: string;
  propertyId: string;
  propertyName: string;
  roomId: string;
  roomNumber: string;
  suId: string;
  suName: string;
  suReference: string;
  responsible: ResponsiblePerson;
  /** Visit that satisfied it (date and who), when there is one */
  visitDate: string | null;
  completedBy: string;
  visitId: string | null;
  /** Days after the deadline: for completed_late the lateness, for overdue the days overdue so far; otherwise null */
  daysLate: number | null;
  /** Rooms only: who is in the room as at the reference date (today, or month end for a past month) */
  occupancy?: OccupancyState;
  /** Rooms only: when the last occupant left, if the room was occupied earlier in the month but is empty now */
  vacatedOn?: string | null;
  /** Rooms only: the date the occupant names are as at */
  occupantAsAt?: string;
}

export interface CheckSubject {
  id: string;
  type: CheckType;
  siteId: string;
  propertyId: string;
  roomId: string;
  roomNumber: string;
  suId: string;
  suName: string;
  suReference: string;
  occupancy: Occupancy[];
  /** Rooms only: everyone who has had a placement in the room */
  occupants?: RoomOccupant[];
}

/**
 * Decide, for one subject and one month, which visit satisfies which check.
 *   1. A visit inside a window satisfies that window's check, if it is still open (on time).
 *   2. A visit that cannot do that (after its window, or its window's check is already done) satisfies the EARLIEST
 *      open check whose deadline has already passed (completed late).
 *   3. Anything else is surplus: it satisfies nothing.
 * Visits are taken in date order, so the result does not depend on the order they arrive in.
 */
export function allocateVisits(
  windows: [CheckWindow, CheckWindow],
  required: [boolean, boolean],
  visits: Visit[]
): Array<{ visit: Visit; onTime: boolean } | null> {
  const result: Array<{ visit: Visit; onTime: boolean } | null> = [null, null];
  const sorted = [...visits].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));
  for (const v of sorted) {
    const idx = windows.findIndex(w => v.date >= w.start && v.date <= w.end);
    if (idx >= 0 && required[idx] && !result[idx]) { result[idx] = { visit: v, onTime: true }; continue; }
    const lateIdx = windows.findIndex((w, i) => required[i] && !result[i] && w.deadline < v.date);
    if (lateIdx >= 0) result[lateIdx] = { visit: v, onTime: false };
  }
  return result;
}

export function statusAt(deadline: string, today: string, done: { onTime: boolean } | null): ObligationStatus {
  if (done) return done.onTime ? 'completed' : 'completed_late';
  return today > deadline ? 'overdue' : 'pending';
}

/* ------------------------------------------------------------------ building everything */

export interface CheckInput {
  sites: Array<{ id: string; name: string; managerName?: string; leadOfficer?: string }>;
  properties: PropertyMaster[];
  rooms: PropertyRoom[];
  /** ALL placements (any status) so past months can be worked out */
  placements: Placement[];
  serviceUsers: ServiceUserMaster[];
  roomVisits: Visit[];
  welfareVisits: Visit[];
  settings?: Partial<CheckSettings> | null;
}

export interface CheckResult {
  month: string;
  settings: CheckSettings;
  obligations: CheckObligation[];
  /** Completed checks that could not be matched to a room / resident, so they were left out (never guessed) */
  unmatched: UnmatchedVisit[];
}

function responsibleFor(site: CheckInput['sites'][number] | undefined, property: PropertyMaster | undefined): ResponsiblePerson {
  const pm = String(property?.propertyManager || '').trim();
  if (pm && pm.toLowerCase() !== 'unassigned') return { name: pm, source: 'property manager' };
  const lead = String(site?.leadOfficer || '').trim();
  if (lead && lead.toLowerCase() !== 'unassigned' && lead.toLowerCase() !== 'assigned lead') return { name: lead, source: 'site lead officer' };
  const mgr = String(site?.managerName || '').trim();
  if (mgr) return { name: mgr, source: 'site manager' };
  return { name: '', source: 'none' };
}

/** Everyone who owes checks: occupied rooms and placed residents, with when they were in place. */
export function buildSubjects(input: CheckInput): CheckSubject[] {
  const resolveSite = createSiteResolver(input.sites.map(s => ({ id: s.id, name: s.name })));
  const propertyById = new Map(input.properties.map(p => [p.id, p]));
  const roomById = new Map(input.rooms.map(r => [r.id, r]));
  const suById = new Map(input.serviceUsers.map(s => [s.id, s]));
  const out: CheckSubject[] = [];

  const byRoom = new Map<string, Occupancy[]>();
  const occupantsByRoom = new Map<string, RoomOccupant[]>();
  const bySu = new Map<string, { occ: Occupancy[]; last: Placement }>();
  for (const p of input.placements) {
    const range = placementRange(p);
    if (!range) continue;
    const room = roomById.get(p.roomId);
    if (room && !isPlaceholderRoom(room) && !isOutOfUse(room.status)) {
      byRoom.set(p.roomId, [...(byRoom.get(p.roomId) || []), range]);
      const person = suById.get(p.suId);
      // A placement whose person record is missing still means the room is occupied; it just has no name to show.
      occupantsByRoom.set(p.roomId, [...(occupantsByRoom.get(p.roomId) || []), {
        suId: p.suId,
        name: person ? [person.firstName, person.lastName].filter(Boolean).join(' ') : '',
        reference: person ? (person.externalReference || person.suReference || '') : '',
        start: range.start,
        end: range.end
      }]);
    }
    const cur = bySu.get(p.suId);
    bySu.set(p.suId, { occ: [...(cur?.occ || []), range], last: !cur || String(p.startDate) > String(cur.last.startDate) ? p : cur.last });
  }

  for (const [roomId, occupancy] of byRoom) {
    const room = roomById.get(roomId)!;
    const property = propertyById.get(room.propertyId);
    const siteId = (property?.siteId && resolveSite(property.siteId)) || '';
    out.push({ id: roomId, type: 'room', siteId, propertyId: room.propertyId, roomId, roomNumber: room.roomNumber, suId: '', suName: '', suReference: '', occupancy, occupants: occupantsByRoom.get(roomId) || [] });
  }
  for (const [suId, { occ, last }] of bySu) {
    const su = suById.get(suId);
    if (!su) continue;
    const room = roomById.get(last.roomId);
    out.push({
      id: suId, type: 'welfare', siteId: resolveSite(last.siteId) || '', propertyId: last.propertyId, roomId: last.roomId, roomNumber: room?.roomNumber || '',
      suId, suName: [su.firstName, su.lastName].filter(Boolean).join(' '), suReference: su.externalReference || su.suReference, occupancy: occ
    });
  }
  return out;
}

/**
 * Who is in a room on `asAt`. Everyone whose placement covers that date (shared rooms list all of them). If nobody does,
 * the room is "vacated" when someone was there earlier in the month, otherwise "vacant". A past check is never given
 * today's occupant: the caller passes the reference date for the month being shown.
 */
export function occupantsAsAt(occupants: RoomOccupant[], asAt: string, monthStart: string): {
  state: OccupancyState; people: RoomOccupant[]; vacatedOn: string | null;
} {
  const here = occupants.filter(o => o.start <= asAt && (!o.end || o.end >= asAt));
  if (here.length > 0) {
    const seen = new Set<string>();
    return { state: 'occupied', people: here.filter(o => (seen.has(o.suId) ? false : (seen.add(o.suId), true))), vacatedOn: null };
  }
  const earlier = occupants.filter(o => o.start <= asAt && o.end && o.end >= monthStart).sort((a, b) => String(b.end).localeCompare(String(a.end)));
  if (earlier.length > 0) return { state: 'vacated', people: [earlier[0]], vacatedOn: earlier[0].end };
  return { state: 'vacant', people: [], vacatedOn: null };
}

/**
 * All check obligations for one month and one check type, with their status as at `today`.
 * Only deadlines up to the end of the current month are produced (a future month has none).
 */
export function buildObligations(input: CheckInput, month: string, type: CheckType, now: Date = new Date()): CheckResult {
  const settings = normaliseSettings(input.settings);
  const today = londonNow(now).date;
  const windows = monthWindows(month, settings);
  const subjects = buildSubjects(input).filter(s => s.type === type);
  const visitsAll = type === 'room' ? input.roomVisits : input.welfareVisits;
  const known = new Set(subjects.map(s => s.id));
  const siteById = new Map(input.sites.map(s => [s.id, s]));
  const propertyById = new Map(input.properties.map(p => [p.id, p]));

  const visitsBySubject = new Map<string, Visit[]>();
  const unmatched: UnmatchedVisit[] = [];
  for (const v of visitsAll) {
    if (monthOf(v.date) !== month) continue;
    if (!v.subjectId || !known.has(v.subjectId)) { unmatched.push({ id: v.id, date: v.date, reason: v.subjectId ? 'no matching occupied room or placed resident that month' : 'could not be matched to a room or resident', label: v.id }); continue; }
    visitsBySubject.set(v.subjectId, [...(visitsBySubject.get(v.subjectId) || []), v]);
  }

  const obligations: CheckObligation[] = [];
  for (const s of subjects) {
    // A month still to come has no obligations yet. The current month lists both (the second as pending until its deadline).
    const future = month > monthOf(today);
    const reqs: [boolean, boolean] = future
      ? [false, false]
      : [occupiedEnough(s.occupancy, windows[0], settings.minOccupiedDays), occupiedEnough(s.occupancy, windows[1], settings.minOccupiedDays)];
    if (!reqs[0] && !reqs[1]) continue;

    const asAt = month === monthOf(today) ? today : lastDayOfMonth(month);
    const occ = type === 'room' ? occupantsAsAt(s.occupants || [], asAt, windows[0].start) : null;
    const roomPeople = occ ? occ.people : [];
    const allocation = allocateVisits(windows, reqs, visitsBySubject.get(s.id) || []);
    const site = siteById.get(s.siteId);
    const property = propertyById.get(s.propertyId);
    const responsible = responsibleFor(site, property);

    windows.forEach((w, i) => {
      if (!reqs[i]) return;
      const done = allocation[i];
      const status = statusAt(w.deadline, today, done);
      obligations.push({
        key: `${type}|${s.id}|${month}|${w.period}`,
        type, month, period: w.period, deadline: w.deadline, status,
        siteId: s.siteId, siteName: site?.name || '', propertyId: s.propertyId, propertyName: property?.propertyName || '',
        roomId: s.roomId, roomNumber: s.roomNumber,
        suId: occ ? (roomPeople[0]?.suId || '') : s.suId,
        suName: occ ? roomPeople.map(x => x.name).filter(Boolean).join(', ') : s.suName,
        suReference: occ ? roomPeople.map(x => x.reference).filter(Boolean).join(', ') : s.suReference,
        occupancy: occ?.state, vacatedOn: occ?.vacatedOn ?? null, occupantAsAt: occ ? asAt : undefined,
        responsible,
        visitDate: done?.visit.date || null, completedBy: done?.visit.completedBy || '', visitId: done?.visit.id || null,
        daysLate: done ? (done.onTime ? null : daysBetween(w.deadline, done.visit.date)) : (status === 'overdue' ? daysBetween(w.deadline, today) : null)
      });
    });
  }

  obligations.sort((a, b) => a.siteName.localeCompare(b.siteName) || a.propertyName.localeCompare(b.propertyName) ||
    a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }) || a.suName.localeCompare(b.suName) || a.period - b.period);
  return { month, settings, obligations, unmatched };
}

/* ------------------------------------------------------------------ rows and totals */

export interface CheckRow {
  subjectKey: string;
  type: CheckType;
  siteId: string;
  siteName: string;
  propertyName: string;
  roomNumber: string;
  suId: string;
  suName: string;
  suReference: string;
  responsible: ResponsiblePerson;
  /** Rooms only: occupied / vacated / vacant as at the reference date, and when the last occupant left */
  occupancy?: OccupancyState;
  vacatedOn?: string | null;
  first: CheckObligation | null;
  second: CheckObligation | null;
  overall: 'complete' | 'incomplete';
}

/** One row per room / resident with the two checks side by side. Each check keeps its own status. */
export function toRows(obligations: CheckObligation[]): CheckRow[] {
  const map = new Map<string, CheckRow>();
  for (const o of obligations) {
    const subjectKey = `${o.type}|${o.type === 'room' ? o.roomId : o.suId}`;
    let row = map.get(subjectKey);
    if (!row) {
      row = { subjectKey, type: o.type, siteId: o.siteId, siteName: o.siteName, propertyName: o.propertyName, roomNumber: o.roomNumber, suId: o.suId, suName: o.suName, suReference: o.suReference, responsible: o.responsible, occupancy: o.occupancy, vacatedOn: o.vacatedOn, first: null, second: null, overall: 'incomplete' };
      map.set(subjectKey, row);
    }
    if (o.period === 1) row.first = o; else row.second = o;
  }
  const rows = [...map.values()];
  for (const r of rows) {
    const need = [r.first, r.second].filter((x): x is CheckObligation => !!x);
    r.overall = need.length > 0 && need.every(o => isSatisfied(o.status)) ? 'complete' : 'incomplete';
  }
  return rows;
}

export interface CheckTotals {
  required: number;
  completed: number;       // on time
  completedLate: number;
  pending: number;
  overdue: number;
  exempt: number;
  /** completed on time / (required - exempt), as a whole percent; null when nothing is required */
  completionPct: number | null;
  /** (completed + completed late) / (required - exempt) */
  doneAnyTimePct: number | null;
}

export function summarise(obligations: CheckObligation[]): CheckTotals {
  const count = (s: ObligationStatus) => obligations.filter(o => o.status === s).length;
  const required = obligations.length;
  const t: CheckTotals = { required, completed: count('completed'), completedLate: count('completed_late'), pending: count('pending'), overdue: count('overdue'), exempt: count('exempt'), completionPct: null, doneAnyTimePct: null };
  const base = required - t.exempt;
  if (base > 0) {
    t.completionPct = Math.round((t.completed / base) * 100);
    t.doneAnyTimePct = Math.round(((t.completed + t.completedLate) / base) * 100);
  }
  return t;
}

/* ------------------------------------------------------------------ turning stored checks into visits */

const normRoom = (v: unknown) => String(v ?? '').toLowerCase().replace(/^room\s*/i, '').replace(/[^a-z0-9]/g, '');
const normRef = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** London calendar date of a stored date or timestamp, or null. */
export function visitDate(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return parseIsoDate(text);
  const d = new Date(text);
  return isNaN(d.getTime()) ? parseIsoDate(text) : londonNow(d).date;
}

interface StoredRoomCheck { id: string; roomId?: string; roomNumber?: string; siteId?: string; siteName?: string; inspectionDate?: string; officerName?: string; createdByName?: string }
interface StoredWelfareCheck { id: string; suId?: string; serviceUserId?: string; portReference?: string; siteName?: string; checkDatetime?: string; officerName?: string; createdByName?: string }

/**
 * Room checks -> visits. A check is tied to a room by its room id; if it has none, by site + room number, and only when
 * exactly one room matches. Otherwise it is returned in `unmatched` (never guessed).
 */
export function roomChecksToVisits(
  checks: StoredRoomCheck[],
  rooms: PropertyRoom[],
  properties: PropertyMaster[],
  sites: Array<{ id: string; name: string }>
): { visits: Visit[]; unmatched: UnmatchedVisit[] } {
  const resolveSite = createSiteResolver(sites);
  const propertySite = new Map(properties.map(p => [p.id, p.siteId ? resolveSite(p.siteId) : null]));
  const byId = new Map(rooms.map(r => [r.id, r]));
  const visits: Visit[] = [];
  const unmatched: UnmatchedVisit[] = [];
  for (const c of checks) {
    const date = visitDate(c.inspectionDate);
    if (!date) { unmatched.push({ id: c.id, date: '', reason: 'no readable inspection date', label: `Room ${c.roomNumber || ''}`.trim() }); continue; }
    let room = c.roomId ? byId.get(c.roomId) : undefined;
    if (!room) {
      const siteId = resolveSite(c.siteId) || resolveSite(c.siteName);
      const candidates = rooms.filter(r => normRoom(r.roomNumber) === normRoom(c.roomNumber) && (!siteId || propertySite.get(r.propertyId) === siteId));
      if (candidates.length === 1 && normRoom(c.roomNumber)) room = candidates[0];
    }
    if (!room) { unmatched.push({ id: c.id, date, reason: 'no single room matches the site and room number', label: `Room ${c.roomNumber || ''} (${c.siteName || 'no site'})`.trim() }); continue; }
    visits.push({ id: c.id, subjectId: room.id, date, completedBy: c.officerName || c.createdByName || '' });
  }
  return { visits, unmatched };
}

/** Welfare checks -> visits, tied to a resident by id, else by port / SU reference when exactly one resident has it. */
export function welfareChecksToVisits(
  checks: StoredWelfareCheck[],
  serviceUsers: ServiceUserMaster[]
): { visits: Visit[]; unmatched: UnmatchedVisit[] } {
  const byId = new Set(serviceUsers.map(s => s.id));
  const byRef = new Map<string, string[]>();
  for (const s of serviceUsers) for (const ref of [s.externalReference, s.suReference, s.caseReference]) {
    const k = normRef(ref);
    if (k) byRef.set(k, [...(byRef.get(k) || []), s.id]);
  }
  const visits: Visit[] = [];
  const unmatched: UnmatchedVisit[] = [];
  for (const c of checks) {
    const date = visitDate(c.checkDatetime);
    if (!date) { unmatched.push({ id: c.id, date: '', reason: 'no readable check date', label: c.portReference || c.id }); continue; }
    const direct = c.serviceUserId || c.suId;
    let suId = direct && byId.has(direct) ? direct : '';
    if (!suId) {
      const ids = byRef.get(normRef(c.portReference)) || [];
      if (ids.length === 1) suId = ids[0];
    }
    if (!suId) { unmatched.push({ id: c.id, date, reason: 'no single resident matches the reference', label: c.portReference || c.id }); continue; }
    visits.push({ id: c.id, subjectId: suId, date, completedBy: c.officerName || c.createdByName || '' });
  }
  return { visits, unmatched };
}

/* ------------------------------------------------------------------ filtering rows by how many checks are done */

export type DueFilter = 'all' | 'completed' | 'pending' | 'one_done' | 'none_done' | 'overdue';

/** How many of the month's two checks are done (on time or late): 0, 1 or 2. */
export const doneCount = (row: Pick<CheckRow, 'first' | 'second'>): 0 | 1 | 2 =>
  ((row.first && isSatisfied(row.first.status) ? 1 : 0) + (row.second && isSatisfied(row.second.status) ? 1 : 0)) as 0 | 1 | 2;

export const hasOverdue = (row: Pick<CheckRow, 'first' | 'second'>): boolean =>
  row.first?.status === 'overdue' || row.second?.status === 'overdue';

/**
 * Which rows a status filter keeps. The count of checks done decides it, whether or not one of the open checks is also
 * overdue (an overdue check is still a check that is due):
 *   completed 2/2 · pending = due (0/2 or 1/2) · one_done 1/2 · none_done 0/2 · overdue = any check overdue.
 */
export function matchesDueFilter(row: Pick<CheckRow, 'first' | 'second'>, filter: DueFilter): boolean {
  const done = doneCount(row);
  switch (filter) {
    case 'completed': return done === 2;
    case 'pending': return done < 2;
    case 'one_done': return done === 1;
    case 'none_done': return done === 0;
    case 'overdue': return hasOverdue(row);
    default: return true;
  }
}

/** Counts for the summary cards, using the same rules as the filter. */
export function dueCounts(rows: Array<Pick<CheckRow, 'first' | 'second'>>) {
  const count = (f: DueFilter) => rows.filter(r => matchesDueFilter(r, f)).length;
  return { total: rows.length, completed: count('completed'), oneDone: count('one_done'), noneDone: count('none_done'), due: count('pending'), overdue: count('overdue') };
}
