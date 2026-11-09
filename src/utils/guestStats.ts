import type { DailyRegisterRecord, NewArrivalRecord } from '../types';

/**
 * Guest statistics and filters for the Daily Register and the Dashboard.
 *
 * One set of rules is used by both places, so a number on the Dashboard always matches the
 * rows the Daily Register shows after you click it. Everything here is pure.
 *
 * Assumptions (change here, nowhere else):
 *  - Children are under 18, elderly are 65 and over, everyone else is an adult.
 *  - Age comes from the date of birth, then the stored age, then the stored age group.
 *  - Family size is the number of active members of the guest's family group. A guest who is not
 *    in a family group is sized by the people sharing their room (their SU allocation).
 */

export const CHILD_MAX_AGE = 17;
export const ELDERLY_MIN_AGE = 65;

const norm = (v?: string | null) => (v ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

export type AgeCategory = 'child' | 'adult' | 'elderly' | 'unknown';
export type GenderCategory = 'male' | 'female' | 'other' | 'unknown';

export const AGE_LABEL: Record<AgeCategory, string> = { child: 'Children', adult: 'Adults', elderly: 'Elderly', unknown: 'Age not recorded' };
export const GENDER_LABEL: Record<GenderCategory, string> = { male: 'Male', female: 'Female', other: 'Other', unknown: 'Not specified' };

/* --------------------------------------------------------------------------------------------- age */

function parseDob(dob?: string | null): Date | null {
  const s = (dob ?? '').toString().trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (match) { y = +match[1]; m = +match[2]; d = +match[3]; }
  else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) { d = +match[1]; m = +match[2]; y = +match[3]; }
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** Age in whole years on `onDate` (YYYY-MM-DD, default today), or null when it cannot be worked out. */
export function ageOf(rec: Pick<DailyRegisterRecord, 'dob' | 'age'>, onDate?: string): number | null {
  const dob = parseDob(rec.dob);
  if (dob) {
    const ref = parseDob(onDate) ?? new Date();
    let age = ref.getUTCFullYear() - dob.getUTCFullYear();
    const beforeBirthday = ref.getUTCMonth() < dob.getUTCMonth() || (ref.getUTCMonth() === dob.getUTCMonth() && ref.getUTCDate() < dob.getUTCDate());
    if (beforeBirthday) age -= 1;
    return age >= 0 && age <= 120 ? age : null;
  }
  const stored = Number(rec.age);
  return rec.age !== undefined && rec.age !== null && Number.isFinite(stored) && stored >= 0 && stored <= 120 ? Math.floor(stored) : null;
}

export function ageCategoryOf(rec: Pick<DailyRegisterRecord, 'dob' | 'age' | 'ageGroup'>, onDate?: string): AgeCategory {
  const age = ageOf(rec, onDate);
  if (age !== null) return age <= CHILD_MAX_AGE ? 'child' : age >= ELDERLY_MIN_AGE ? 'elderly' : 'adult';
  const group = norm(rec.ageGroup);
  if (group === '0-17') return 'child';
  if (group === '60+' || group === '65+') return 'elderly';
  if (group) return 'adult';
  return 'unknown';
}

/* ------------------------------------------------------------------------------------------- gender */

export function genderOf(rec: Pick<DailyRegisterRecord, 'gender'>): GenderCategory {
  const g = norm(rec.gender);
  if (!g) return 'unknown';
  if (g === 'm' || g === 'male' || g === 'man' || g === 'boy') return 'male';
  if (g === 'f' || g === 'female' || g === 'woman' || g === 'girl') return 'female';
  if (['unknown', 'not specified', 'unspecified', 'not stated', 'prefer not to say', 'n/a', 'na', '-'].includes(g)) return 'unknown';
  return 'other';
}

/* --------------------------------------------------------------------------------------- aspen card */

const NOT_A_CARD = new Set(['no', 'none', 'n/a', 'na', 'nil', 'false', '0', '-', 'unknown', 'not issued', 'not applicable', 'pending', 'requested', 'awaiting', 'lost', 'cancelled', 'expired']);

/** True when the value records a card the guest actually holds. */
export function isAspenValue(value?: string | null): boolean {
  const v = norm(value);
  return !!v && !NOT_A_CARD.has(v);
}

/** New Arrivals hold the original Aspen card entry, so a register row falls back to its arrival by Port Ref. */
export function buildAspenLookup(arrivals: Pick<NewArrivalRecord, 'portReference' | 'aspenCard'>[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of arrivals) {
    const ref = norm(a.portReference);
    if (ref && a.aspenCard && !map.has(ref)) map.set(ref, a.aspenCard);
  }
  return map;
}

/* ----------------------------------------------------------------------------------------- families */

export interface GuestContext {
  /** Port Ref (normalised) -> family group id, for guests in a family group. */
  familyIdByRef: Map<string, string>;
  /** Family group id -> number of active members. */
  familySize: Map<string, number>;
  /** Port Ref (normalised) -> Aspen card text from New Arrivals. */
  aspenByRef: Map<string, string>;
}

export const emptyGuestContext = (): GuestContext => ({ familyIdByRef: new Map(), familySize: new Map(), aspenByRef: new Map() });

export type FamilyBucket = '1' | '2' | '3' | '4' | '5+';
export const FAMILY_BUCKETS: FamilyBucket[] = ['1', '2', '3', '4', '5+'];
export const bucketOf = (size: number): FamilyBucket => (size >= 5 ? '5+' : (String(Math.max(1, size)) as FamilyBucket));

export interface Guest {
  key: string;
  record: DailyRegisterRecord;
  age: number | null;
  ageCategory: AgeCategory;
  gender: GenderCategory;
  aspen: boolean;
  /** Identifies the family or room group this guest is counted in. */
  familyKey: string;
  familySize: number;
}

/* ------------------------------------------------------------------------------------ active guests */

/** Is this register row a person staying on `date`? Rows marked vacant or checked out are not. */
export function isStayingOn(rec: DailyRegisterRecord, date?: string): boolean {
  if (rec.occupied === 'No') return false;
  if (!date) return true;
  const history = rec.dailyOccupancy;
  if (history && Object.prototype.hasOwnProperty.call(history, date)) return history[date] === 'Occupied';
  const checkIn = (rec.checkInDate || '').slice(0, 10);
  return !checkIn || checkIn <= date;
}

const guestKey = (rec: DailyRegisterRecord) => norm(rec.portRef) || (norm(rec.name) ? `${norm(rec.name)}|${norm(rec.dob)}` : `id:${rec.id}`);

const roomGroupKey = (rec: DailyRegisterRecord) => `room:${norm(rec.hotel)}::${norm(rec.roomNo)}`;

/**
 * The people staying on `date`, each counted once. If the same person appears twice (a moved
 * guest, or a duplicate row) the most recent check-in wins.
 */
export function buildGuests(records: DailyRegisterRecord[], ctx: GuestContext, date?: string): Guest[] {
  const unique = new Map<string, DailyRegisterRecord>();
  for (const rec of records) {
    if (!isStayingOn(rec, date)) continue;
    const key = guestKey(rec);
    const seen = unique.get(key);
    if (!seen || (rec.checkInDate || '') > (seen.checkInDate || '')) unique.set(key, rec);
  }

  const roomCount = new Map<string, number>();
  for (const rec of unique.values()) roomCount.set(roomGroupKey(rec), (roomCount.get(roomGroupKey(rec)) || 0) + 1);

  const guests: Guest[] = [];
  for (const [key, rec] of unique) {
    const ref = norm(rec.portRef);
    const familyId = ref ? ctx.familyIdByRef.get(ref) : undefined;
    const inFamily = familyId !== undefined && (ctx.familySize.get(familyId) || 0) > 0;
    const familyKey = inFamily ? `family:${familyId}` : roomGroupKey(rec);
    const familySize = inFamily ? Math.max(1, ctx.familySize.get(familyId!) || 1) : Math.max(1, roomCount.get(roomGroupKey(rec)) || 1);
    const aspenText = (rec as DailyRegisterRecord & { aspenCard?: string }).aspenCard || (ref ? ctx.aspenByRef.get(ref) : undefined);
    guests.push({
      key,
      record: rec,
      age: ageOf(rec, date),
      ageCategory: ageCategoryOf(rec, date),
      gender: genderOf(rec),
      aspen: isAspenValue(aspenText),
      familyKey,
      familySize,
    });
  }
  return guests;
}

/* ----------------------------------------------------------------------------------------- filters */

export type AgeFilter = 'all' | AgeCategory | 'custom';
export type GenderFilter = 'all' | GenderCategory | 'other_unknown';
export type FamilyFilter = 'all' | FamilyBucket | 'custom';
export type AspenFilter = 'all' | 'yes' | 'no';

export interface GuestFilter {
  age: AgeFilter;
  /** Used with age = custom. Either end may be blank. */
  ageMin: number | null;
  ageMax: number | null;
  gender: GenderFilter;
  family: FamilyFilter;
  /** Used with family = custom: families of at least this size. */
  familyMin: number | null;
  aspen: AspenFilter;
}

export const NO_GUEST_FILTER: GuestFilter = { age: 'all', ageMin: null, ageMax: null, gender: 'all', family: 'all', familyMin: null, aspen: 'all' };

export const isGuestFilterActive = (f: GuestFilter) => f.age !== 'all' || f.gender !== 'all' || f.family !== 'all' || f.aspen !== 'all';

export function matchesGuestFilter(g: Guest, f: GuestFilter): boolean {
  if (f.age !== 'all') {
    if (f.age === 'custom') {
      if (g.age === null) return false;
      if (f.ageMin !== null && g.age < f.ageMin) return false;
      if (f.ageMax !== null && g.age > f.ageMax) return false;
    } else if (g.ageCategory !== f.age) return false;
  }
  if (f.gender !== 'all') {
    if (f.gender === 'other_unknown') { if (g.gender !== 'other' && g.gender !== 'unknown') return false; }
    else if (g.gender !== f.gender) return false;
  }
  if (f.family !== 'all') {
    if (f.family === 'custom') { if (g.familySize < Math.max(1, f.familyMin ?? 1)) return false; }
    else if (bucketOf(g.familySize) !== f.family) return false;
  }
  if (f.aspen === 'yes' && !g.aspen) return false;
  if (f.aspen === 'no' && g.aspen) return false;
  return true;
}

/** Register rows to show for a filter. With no filter every row is kept (including rows not staying). */
export function filterRegisterRecords(records: DailyRegisterRecord[], ctx: GuestContext, f: GuestFilter, date?: string): DailyRegisterRecord[] {
  if (!isGuestFilterActive(f)) return records;
  const keep = new Set(buildGuests(records, ctx, date).filter(g => matchesGuestFilter(g, f)).map(g => g.record.id));
  return records.filter(r => keep.has(r.id));
}

/* ------------------------------------------------------------------------------------------- stats */

export interface GuestStats {
  total: number;
  male: number;
  female: number;
  other: number;
  unknownGender: number;
  /** Other + not specified, as shown on the summary card. */
  otherOrUnspecified: number;
  child: number;
  adult: number;
  elderly: number;
  unknownAge: number;
  aspenHolders: number;
  noAspen: number;
  /** Families (or room groups) by size. Size 1 is an individual. */
  familiesBySize: Record<FamilyBucket, number>;
  /** Guests living in a family of each size. */
  guestsBySize: Record<FamilyBucket, number>;
}

export function computeGuestStats(guests: Guest[]): GuestStats {
  const stats: GuestStats = {
    total: guests.length, male: 0, female: 0, other: 0, unknownGender: 0, otherOrUnspecified: 0,
    child: 0, adult: 0, elderly: 0, unknownAge: 0, aspenHolders: 0, noAspen: 0,
    familiesBySize: { '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 },
    guestsBySize: { '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 },
  };
  const families = new Map<string, number>();
  for (const g of guests) {
    if (g.gender === 'male') stats.male++;
    else if (g.gender === 'female') stats.female++;
    else if (g.gender === 'other') stats.other++;
    else stats.unknownGender++;
    stats[g.ageCategory === 'unknown' ? 'unknownAge' : g.ageCategory]++;
    if (g.aspen) stats.aspenHolders++; else stats.noAspen++;
    stats.guestsBySize[bucketOf(g.familySize)]++;
    if (!families.has(g.familyKey)) families.set(g.familyKey, g.familySize);
  }
  stats.otherOrUnspecified = stats.other + stats.unknownGender;
  for (const size of families.values()) stats.familiesBySize[bucketOf(size)]++;
  return stats;
}

/* ----------------------------------------------------------------- hand-off Dashboard -> Register */

const INTENT_KEY = 'sdtracker.registerFilterIntent';

export interface RegisterFilterIntent {
  filter: GuestFilter;
  site?: string;
  date?: string;
}

const AGE_VALUES: AgeFilter[] = ['all', 'child', 'adult', 'elderly', 'unknown', 'custom'];
const GENDER_VALUES: GenderFilter[] = ['all', 'male', 'female', 'other', 'unknown', 'other_unknown'];
const FAMILY_VALUES: FamilyFilter[] = ['all', '1', '2', '3', '4', '5+', 'custom'];
const ASPEN_VALUES: AspenFilter[] = ['all', 'yes', 'no'];
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 120 ? Math.floor(v) : null);

/** Accepts anything and returns a safe filter; unknown values fall back to "all". */
export function sanitizeGuestFilter(input: unknown): GuestFilter {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  return {
    age: pick(o.age, AGE_VALUES, 'all'),
    ageMin: numOrNull(o.ageMin),
    ageMax: numOrNull(o.ageMax),
    gender: pick(o.gender, GENDER_VALUES, 'all'),
    family: pick(o.family, FAMILY_VALUES, 'all'),
    familyMin: numOrNull(o.familyMin),
    aspen: pick(o.aspen, ASPEN_VALUES, 'all'),
  };
}

export function saveRegisterFilterIntent(intent: RegisterFilterIntent): void {
  try { sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent)); } catch { /* storage unavailable: the register opens unfiltered */ }
}

/** Removes the hand-off, so a later visit to the register is not filtered by mistake. */
export function clearRegisterFilterIntent(): void {
  try { sessionStorage.removeItem(INTENT_KEY); } catch { /* nothing to clear */ }
}

/** Reads the hand-off without removing it (safe to call from a render-time initialiser). */
export function readRegisterFilterIntent(): RegisterFilterIntent | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      filter: sanitizeGuestFilter(o.filter),
      site: typeof o.site === 'string' ? o.site.slice(0, 120) : undefined,
      date: typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : undefined,
    };
  } catch {
    return null;
  }
}

export function describeGuestFilter(f: GuestFilter): string[] {
  const parts: string[] = [];
  if (f.age === 'custom') parts.push(`Age ${f.ageMin ?? 0}–${f.ageMax ?? '+'}`);
  else if (f.age !== 'all') parts.push(AGE_LABEL[f.age]);
  if (f.gender === 'other_unknown') parts.push('Other / not specified');
  else if (f.gender !== 'all') parts.push(GENDER_LABEL[f.gender]);
  if (f.family === 'custom') parts.push(`Family of ${Math.max(1, f.familyMin ?? 1)}+`);
  else if (f.family !== 'all') parts.push(`Family of ${f.family}`);
  if (f.aspen === 'yes') parts.push('Aspen card: yes');
  if (f.aspen === 'no') parts.push('Aspen card: no');
  return parts;
}
