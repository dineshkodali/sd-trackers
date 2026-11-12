/**
 * Service User profile resolution and form autofill - the one shared implementation (pure, no I/O).
 *
 * Every form that needs to pick a Service User uses these functions through the ServiceUserPicker component and the
 * useServiceUserSelection hook, so there is no page-specific copy of the logic:
 *   - the selected person is stored by id, never by typed name;
 *   - site / property / room come from the person's ACTIVE PLACEMENT (the authoritative record), not a stale field;
 *   - archived people are not offered; people outside the user's sites are not offered;
 *   - autofill never overwrites something the user typed by hand.
 */

import type {
  Placement, PropertyMaster, PropertyRoom, ServiceUserContact, ServiceUserMaster
} from '../types/masterData';

export interface SuMasterData {
  serviceUsers: ServiceUserMaster[];
  placements: Placement[];
  properties: PropertyMaster[];
  rooms: PropertyRoom[];
  contacts?: ServiceUserContact[];
  sites: Array<{ id: string; name: string }>;
}

export interface ServiceUserProfile {
  suId: string;
  suReference: string;
  /** Home Office / port reference */
  externalReference: string;
  fullName: string;
  firstName: string;
  lastName: string;
  /** Initials of first and last name, e.g. "JS" */
  initials: string;
  dob: string;
  gender: string;
  nationality: string;
  language: string;
  interpreterRequired: boolean;
  siteId: string;
  siteName: string;
  propertyId: string;
  propertyName: string;
  /** One line: address, city, postcode */
  propertyAddress: string;
  propertyAddressLine: string;
  propertyCity: string;
  propertyPostcode: string;
  roomId: string;
  roomNumber: string;
  phone: string;
  email: string;
  vulnerable: boolean;
  archived: boolean;
  /** True when the person has an active placement (so site / property / room are current) */
  placed: boolean;
  /** Profile fields that have no value, so a form can say "not on the profile" instead of leaving a silent blank */
  missing: string[];
}

const clean = (v: unknown) => String(v ?? '').trim();

export function initialsOf(first: string, last: string): string {
  return `${clean(first).charAt(0)}${clean(last).charAt(0)}`.toUpperCase();
}

/** The newest active placement for each person (a person should have one; if not, the latest start wins). */
function activePlacementBySu(placements: Placement[]): Map<string, Placement> {
  const out = new Map<string, Placement>();
  for (const p of placements) {
    if (p.status !== 'Active') continue;
    const prev = out.get(p.suId);
    if (!prev || String(p.startDate) > String(prev.startDate)) out.set(p.suId, p);
  }
  return out;
}

export interface ResolveIndex {
  placementBySu: Map<string, Placement>;
  propertyById: Map<string, PropertyMaster>;
  roomById: Map<string, PropertyRoom>;
  siteNameById: Map<string, string>;
  contactBySu: Map<string, ServiceUserContact>;
}

export function buildIndex(data: SuMasterData): ResolveIndex {
  return {
    placementBySu: activePlacementBySu(data.placements),
    propertyById: new Map(data.properties.map(p => [p.id, p])),
    roomById: new Map(data.rooms.map(r => [r.id, r])),
    siteNameById: new Map(data.sites.map(s => [s.id, s.name])),
    contactBySu: new Map((data.contacts || []).map(c => [c.suId, c]))
  };
}

export function profileOf(su: ServiceUserMaster, idx: ResolveIndex): ServiceUserProfile {
  const placement = idx.placementBySu.get(su.id);
  const property = placement ? idx.propertyById.get(placement.propertyId) : undefined;
  const room = placement ? idx.roomById.get(placement.roomId) : undefined;
  const siteId = clean(placement?.siteId || su.siteId);
  const contact = idx.contactBySu.get(su.id);
  const first = clean(su.firstName);
  const last = clean(su.lastName);
  const fullName = [first, clean(su.middleName), last].filter(Boolean).join(' ');
  const line = clean(property?.addressLine1);
  const city = clean(property?.city);
  const postcode = clean(property?.postcode);

  const profile: ServiceUserProfile = {
    suId: su.id,
    suReference: clean(su.suReference),
    externalReference: clean(su.externalReference),
    fullName,
    firstName: first,
    lastName: last,
    initials: initialsOf(first, last),
    dob: clean(su.dateOfBirth).slice(0, 10),
    gender: clean(su.gender),
    nationality: clean(su.nationality),
    language: clean(su.preferredLanguage),
    interpreterRequired: su.interpreterRequired === true,
    siteId,
    siteName: idx.siteNameById.get(siteId) || '',
    propertyId: clean(placement?.propertyId),
    propertyName: clean(property?.propertyName),
    propertyAddress: [line, clean(property?.addressLine2), city, postcode].filter(Boolean).join(', '),
    propertyAddressLine: line,
    propertyCity: city,
    propertyPostcode: postcode,
    roomId: clean(placement?.roomId),
    roomNumber: clean(room?.roomNumber),
    phone: clean(contact?.mobile || contact?.alternativePhone),
    email: clean(contact?.email),
    vulnerable: clean(su.vulnerable).toLowerCase() === 'yes',
    archived: su.status === 'Archived' || su.archiveStatus === 'Archived',
    placed: !!placement,
    missing: []
  };
  const required: Array<[keyof ServiceUserProfile, string]> = [
    ['externalReference', 'port reference'], ['dob', 'date of birth'], ['roomNumber', 'room'], ['propertyName', 'property'], ['phone', 'phone number']
  ];
  profile.missing = required.filter(([k]) => !clean(profile[k] as string)).map(([, label]) => label);
  return profile;
}

/** One person's profile by id, or null when no such person is in the data. */
export function resolveServiceUserProfile(suId: string | undefined | null, data: SuMasterData): ServiceUserProfile | null {
  if (!suId) return null;
  const su = data.serviceUsers.find(s => s.id === suId);
  return su ? profileOf(su, buildIndex(data)) : null;
}

export interface SelectScope {
  /** Site ids the user may see, or 'all' */
  allowedSiteIds: Set<string> | 'all';
  /** Restrict to one site (a form's own site field), or undefined for any permitted site */
  siteId?: string;
}

/**
 * The people a user may choose from: not archived, inside their sites, and (by default) currently placed so that site /
 * property / room are known. Sorted by name. `query` matches name, SU reference, port reference and room.
 */
export function listSelectableProfiles(data: SuMasterData, scope: SelectScope, query = '', opts: { includeUnplaced?: boolean } = {}): ServiceUserProfile[] {
  const idx = buildIndex(data);
  const q = clean(query).toLowerCase();
  const out: ServiceUserProfile[] = [];
  for (const su of data.serviceUsers) {
    const p = profileOf(su, idx);
    if (p.archived) continue;
    if (!p.placed && !opts.includeUnplaced) continue;
    if (scope.allowedSiteIds !== 'all' && !scope.allowedSiteIds.has(p.siteId)) continue;
    if (scope.siteId && p.siteId !== scope.siteId) continue;
    if (q && ![p.fullName, p.suReference, p.externalReference, p.roomNumber, p.propertyName].join(' ').toLowerCase().includes(q)) continue;
    out.push(p);
  }
  return out.sort((a, b) => a.fullName.localeCompare(b.fullName) || a.suReference.localeCompare(b.suReference));
}

/* ------------------------------------------------------------------ autofill */

/** form field -> profile field, or a function building the value */
export type FieldMap<F extends string = string> = Record<F, keyof ServiceUserProfile | ((p: ServiceUserProfile) => string)>;

const valueFor = (p: ServiceUserProfile, source: keyof ServiceUserProfile | ((p: ServiceUserProfile) => string)) =>
  typeof source === 'function' ? source(p) : String(p[source] ?? '');

export interface AutofillResult {
  /** Fields to set on the form */
  changes: Record<string, string>;
  /** Fields left alone because the user typed in them */
  skipped: string[];
}

/**
 * Works out which form fields to fill from a profile.
 *  - a field the user has edited by hand (`touched`) is never overwritten;
 *  - a profile value that is empty does not blank out an existing field (the form is told via `profile.missing`);
 *  - when a different person is chosen, fields that were filled from the previous profile (`autofilled`) ARE refreshed.
 */
export function computeAutofill(
  profile: ServiceUserProfile,
  fieldMap: FieldMap,
  state: { touched: ReadonlySet<string>; autofilled: ReadonlySet<string> },
  current: Record<string, unknown>
): AutofillResult {
  const changes: Record<string, string> = {};
  const skipped: string[] = [];
  for (const [field, source] of Object.entries(fieldMap)) {
    const next = valueFor(profile, source as any);
    const existing = clean(current[field]);
    const userEdited = state.touched.has(field) || (existing !== '' && !state.autofilled.has(field));
    if (userEdited) { if (existing !== next) skipped.push(field); continue; }
    if (next === '') continue;
    if (existing !== next) changes[field] = next;
  }
  return { changes, skipped };
}

/**
 * For an edit form: has the person's profile moved on since this record was saved? Returns the field names whose stored
 * value no longer matches the current profile (for a "profile has changed" hint), without changing anything.
 */
export function staleFields(profile: ServiceUserProfile, fieldMap: FieldMap, current: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [field, source] of Object.entries(fieldMap)) {
    const next = valueFor(profile, source as any);
    const existing = clean(current[field]);
    if (next !== '' && existing !== '' && existing !== next) out.push(field);
  }
  return out;
}
