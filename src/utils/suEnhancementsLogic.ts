/**
 * Pure rules for the Service User enhancements (HC2, Oyster cards, per-SU meals, education, families, archive).
 * No React and no network: the same rules are used by the screens, the server and the unit tests.
 */

/* ------------------------------------------------------------------------------------------------ child status */
/** A child is a Service User under 18 on the given day, by date of birth. No (or invalid) DOB means unknown, never "child". */
export function isChildByDob(dateOfBirth?: string | null, today: Date = new Date()): boolean {
  if (!dateOfBirth) return false;
  const m = String(dateOfBirth).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < mo || (today.getUTCMonth() + 1 === mo && today.getUTCDate() < d)) age -= 1;
  return age >= 0 && age < 18;
}

/* ------------------------------------------------------------------------------------------------------- HC2 */
export const HC2_STATUSES = ['Not applied', 'Applied', 'Issued', 'Active', 'Expired', 'Rejected', 'Renewal due'] as const;
export type Hc2Status = typeof HC2_STATUSES[number];

/** Days of notice before an HC2 expiry is flagged as due for renewal. */
export const HC2_RENEWAL_NOTICE_DAYS = 30;

/**
 * The status to show: a stored status of Issued/Active is shown as Expired once the expiry date has passed, and as
 * Renewal due inside the notice window. Other statuses (Not applied, Applied, Rejected) are shown as recorded.
 */
export function hc2DisplayStatus(status: string | undefined, expiryDate: string | undefined, today: string): string {
  if (!status) return 'Not recorded';
  if ((status === 'Issued' || status === 'Active' || status === 'Renewal due') && expiryDate) {
    if (expiryDate < today) return 'Expired';
    const days = Math.round((Date.parse(expiryDate) - Date.parse(today)) / 86_400_000);
    if (days <= HC2_RENEWAL_NOTICE_DAYS) return 'Renewal due';
  }
  return status;
}

export function validateHc2(input: { status?: string; issueDate?: string; expiryDate?: string; referenceNumber?: string }): string | null {
  if (!input.status || !(HC2_STATUSES as readonly string[]).includes(input.status)) return 'Choose an HC2 status.';
  if (input.issueDate && input.expiryDate && input.expiryDate < input.issueDate) return 'The expiry date cannot be before the issue date.';
  if ((input.status === 'Issued' || input.status === 'Active') && !input.issueDate) return 'Enter the issue date for an issued HC2.';
  if (input.referenceNumber && input.referenceNumber.length > 60) return 'The reference number is too long.';
  return null;
}

/* ------------------------------------------------------------------------------------------------- Meals */
export const MEAL_PERIODS = ['Breakfast', 'Lunch', 'Dinner'] as const;
export type MealPeriod = typeof MEAL_PERIODS[number];
export const MEAL_STATUSES = ['Pending', 'Provided', 'Accepted', 'Declined', 'Not available', 'Not applicable'] as const;
export type MealStatus = typeof MEAL_STATUSES[number];

/** Statuses that need a note explaining what happened, so a gap is never silent. */
export const MEAL_NOTE_STATUSES: readonly string[] = ['Declined', 'Not available'];

/** Deterministic id: one record per SU, date and meal, so a repeated save can only ever update the same row. */
export const mealRecordId = (suId: string, date: string, period: string) => `smr-${suId}-${date}-${period}`;

/**
 * Whether a meal slot is finished. Provided/Accepted/Declined are final answers; Not available/Not applicable are
 * recorded outcomes; Pending (or no record) is outstanding.
 */
export const isMealResolved = (status?: string) => !!status && status !== 'Pending';

export type MealDayStatus = 'Complete' | 'Incomplete' | 'Not started';

export function mealDayStatus(statusByPeriod: Partial<Record<MealPeriod, string | undefined>>): MealDayStatus {
  const resolved = MEAL_PERIODS.filter(p => isMealResolved(statusByPeriod[p])).length;
  if (resolved === MEAL_PERIODS.length) return 'Complete';
  return resolved === 0 ? 'Not started' : 'Incomplete';
}

export function validateMealEntry(status: string, notes?: string): string | null {
  if (!(MEAL_STATUSES as readonly string[]).includes(status)) return 'Choose a meal status.';
  if (MEAL_NOTE_STATUSES.includes(status) && !(notes || '').trim()) return `Add a note explaining why the meal was ${status.toLowerCase()}.`;
  return null;
}

/* --------------------------------------------------------------------------------------------- Education */
export const EDUCATION_STATUSES = ['Not enrolled', 'Application in progress', 'Enrolled', 'Details pending', 'No longer attending'] as const;
export type EducationStatus = typeof EDUCATION_STATUSES[number];

export function validateEducation(input: { educationStatus?: string; schoolName?: string; startDate?: string; endDate?: string }): string | null {
  if (!input.educationStatus || !(EDUCATION_STATUSES as readonly string[]).includes(input.educationStatus)) return 'Choose an education status.';
  if (input.educationStatus === 'Enrolled' && !(input.schoolName || '').trim()) return 'Enter the school name for an enrolled child.';
  if (input.startDate && input.endDate && input.endDate < input.startDate) return 'The end date cannot be before the start date.';
  return null;
}

/** Wording for the profile: missing information is never presented as a confirmed non-enrolment. */
export function educationSummary(current?: { educationStatus: string; schoolName?: string } | null): string {
  if (!current) return 'Not recorded';
  return current.schoolName ? `${current.educationStatus} - ${current.schoolName}` : current.educationStatus;
}

/* --------------------------------------------------------------------------------------------------- Family */
/** How a member is described in a household. Older values (Parent, Child, Sibling...) recorded earlier still display. */
export const HOUSEHOLD_RELATIONSHIPS = [
  'Father', 'Mother', 'Husband', 'Wife', 'Partner', 'Son', 'Daughter', 'Brother', 'Sister', 'Grandparent', 'Grandchild', 'Guardian', 'Other relative', 'Other'
] as const;
export const FAMILY_RELATIONSHIPS = HOUSEHOLD_RELATIONSHIPS;

export interface FamilyMemberLike { id: string; familyId: string; suId: string; status: string }

/** Active family membership of one SU, if any. An SU can be in only one active family. */
export function activeFamilyOf<T extends FamilyMemberLike>(members: T[], suId: string): T | null {
  return members.find(m => m.suId === suId && m.status === 'Active') || null;
}

/** Service Users that can still be added to a family: not already in any active family, and not already archived. */
export function addableToFamily<S extends { id: string; archiveStatus?: string; status?: string }>(sus: S[], members: FamilyMemberLike[]): S[] {
  const taken = new Set(members.filter(m => m.status === 'Active').map(m => m.suId));
  return sus.filter(s => !taken.has(s.id) && s.status !== 'Archived' && s.archiveStatus !== 'Archived');
}

export interface HouseholdCandidate<S> { su: S; inOtherHousehold: boolean }

/**
 * Existing Service Users that can be searched for when adding to a household: matches by name or reference (at least two characters),
 * never the person themselves, anyone already in this household, or anyone archived. People who already belong to a different
 * household are listed but marked, because they must leave it first.
 */
export function searchableForHousehold<S extends { id: string; firstName: string; lastName: string; suReference?: string; externalReference?: string; status?: string; archiveStatus?: string }>(
  people: S[], query: string, selfId: string, thisHousehold: FamilyMemberLike[], allMemberships: FamilyMemberLike[], limit = 50
): HouseholdCandidate<S>[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const inThis = new Set(thisHousehold.filter(m => m.status === 'Active').map(m => m.suId));
  const inAny = new Set(allMemberships.filter(m => m.status === 'Active').map(m => m.suId));
  return people
    .filter(p => p.id !== selfId && !inThis.has(p.id) && p.status !== 'Archived' && p.archiveStatus !== 'Archived')
    .filter(p => `${p.firstName} ${p.lastName} ${p.suReference || ''} ${p.externalReference || ''}`.toLowerCase().includes(q))
    .slice(0, limit)
    .map(p => ({ su: p, inOtherHousehold: inAny.has(p.id) }));
}

/* ------------------------------------------------------------------------------------------------- Archive */
export const ARCHIVE_STATUSES = ['Active', 'Pending approval', 'Archived', 'Restoration pending'] as const;
export const isArchivedSu = (su?: { status?: string; archiveStatus?: string } | null) => !!su && (su.status === 'Archived' || su.archiveStatus === 'Archived');

/** What a signed-in user can do about an SU's archive state (the server and database enforce the same rules). */
export function archiveActionsFor(
  su: { archiveStatus?: string; status?: string },
  can: { request: boolean; decide: boolean },
  pending?: { id: string; requestedById: string } | null,
  userId?: string
): { canRequestArchive: boolean; canRequestRestore: boolean; canDecide: boolean; canCancel: boolean } {
  const state = su.archiveStatus || 'Active';
  return {
    canRequestArchive: can.request && state === 'Active',
    canRequestRestore: can.request && state === 'Archived',
    canDecide: can.decide && !!pending && pending.requestedById !== userId && (state === 'Pending approval' || state === 'Restoration pending'),
    canCancel: !!pending && pending.requestedById === userId
  };
}
