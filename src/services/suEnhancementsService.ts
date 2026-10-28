import { apiService, authHeaders, getApiUrl } from './apiService';
import {
  validateHc2, validateMealEntry, validateEducation, mealRecordId
} from '../utils/suEnhancementsLogic';
import { validateRegisterCard, validateIssue, validateReturn } from '../utils/oysterLogic';
import { todayIso } from '../utils/attendanceLogic';

/* --------------------------------------------------------------------------------------------------------------
 * Data access for HC2, Oyster cards, per-SU meals, education, family groups and SU archive requests.
 * Every record points at the canonical Service User id. The server decides who may read or write each one
 * (see ENTITY_REGISTRY in server/routes/db.ts) and the database enforces integrity; checks here only give
 * the user a clear message before a request is sent.
 * ------------------------------------------------------------------------------------------------------------ */

export interface Hc2Details {
  id: string; suId: string; referenceNumber?: string | null; issueDate?: string | null; expiryDate?: string | null; status: string;
  notes?: string | null; documentPath?: string | null; documentName?: string | null; documentUploadedAt?: string | null;
  createdBy?: string; updatedBy?: string; createdAt?: string; updatedAt?: string;
}
/** A physical card held by a property. su_id fields describe the current holder while it is issued. */
export interface OysterCard {
  id: string; cardRef: string; siteName: string; status: string; currentBalance?: number | null; balanceUpdatedAt?: string | null; balanceUpdatedBy?: string | null;
  suId?: string | null; issuedDate?: string | null; issuedBy?: string | null; notes?: string | null; createdBy?: string; updatedBy?: string; createdAt?: string; updatedAt?: string;
}
/** One loan of a card: the record the SU profile and the Funding page both read. */
export interface OysterTransaction {
  id: string; cardId: string; cardRef: string; suId: string; siteName: string; fundingRequestId?: string | null; status: 'Issued' | 'Returned' | 'Lost';
  issuedDate: string; issuedBy: string; balanceAtIssue: number; returnedDate?: string | null; returnedBy?: string | null; balanceAtReturn?: number | null;
  returnCondition?: string | null; returnNotes?: string | null; balanceAdjusted?: boolean; createdAt?: string; updatedAt?: string;
}
export interface OysterCardEvent {
  id: string; cardId: string; suId?: string | null; eventType: string; fromStatus?: string | null; toStatus?: string | null; balance?: number | null;
  previousBalance?: number | null; transactionId?: string | null; details?: string | null; changedBy?: string; changedAt?: string;
}
export interface MealRecord {
  id: string; suId: string; mealDate: string; mealPeriod: string; status: string; notes?: string | null;
  recordedBy?: string; updatedBy?: string; createdAt?: string; updatedAt?: string;
}
export interface MealHistoryEntry {
  id: string; recordId: string; suId: string; mealDate: string; mealPeriod: string; fromStatus?: string | null; toStatus: string;
  notes?: string | null; changedBy?: string; changedAt?: string;
}
export interface EducationDetails {
  id: string; suId: string; schoolName?: string | null; schoolAddress?: string | null; schoolContact?: string | null; yearGroup?: string | null;
  educationStatus: string; startDate?: string | null; endDate?: string | null; isCurrent: boolean; notes?: string | null;
  createdBy?: string; updatedBy?: string; createdAt?: string; updatedAt?: string;
}
export interface FamilyGroup {
  id: string; familyRef?: string | null; displayName?: string | null; status: string; notes?: string | null;
  createdBy?: string; updatedBy?: string; createdAt?: string; updatedAt?: string;
}
export interface FamilyMember {
  id: string; familyId: string; suId: string; relationship?: string | null; status: string; joinedAt?: string; leftAt?: string | null;
  removalReason?: string | null; addedBy?: string; updatedBy?: string; createdAt?: string; updatedAt?: string;
}
export interface ArchiveRequest {
  id: string; suId: string; requestType: 'Archive' | 'Restore'; status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'; reason: string;
  requestedById: string; requestedBy: string; requestedAt: string; decidedById?: string | null; decidedBy?: string | null;
  decidedAt?: string | null; decisionReason?: string | null; priorSuStatus?: string | null;
}

export type Result<T> = { success: boolean; data: T; error?: string };
const fail = <T = any>(error?: string): Result<T> => ({ success: false, data: undefined as unknown as T, error: error || 'Request failed' });
const ok = <T>(data: T): Result<T> => ({ success: true, data });
const newId = (prefix: string) => `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
const clean = (v?: string | null) => (v ?? '').trim();
const orNull = (v?: string | null) => clean(v) || null;

/** Turn raw database constraint messages into something a member of staff can act on. */
export function friendlyDbError(message?: string): string {
  const m = message || '';
  if (/uq_oyster_card_ref/.test(m)) return 'A card with that reference is already registered.';
  if (/uq_family_members_one_active_family/.test(m)) return 'This Service User is already in a family group. Remove them from it first.';
  if (/uq_family_groups_ref/.test(m)) return 'That family reference is already used by another family group.';
  if (/uq_su_education_one_current/.test(m)) return 'This child already has current school details. Edit them or record a change of school.';
  if (/su_meal_one_per_slot/.test(m)) return 'That meal has already been recorded. Reload and edit the existing entry.';
  if (/su_hc2_one_per_su/.test(m)) return 'This Service User already has HC2 details. Edit the existing record.';
  if (/archive.*approved request|archiving and restoring/i.test(m)) return 'Archiving and restoring require an approved request.';
  return m || 'Request failed';
}

async function list<T>(entity: string, opts: { eq?: Record<string, string>; order?: string; limit?: number } = {}): Promise<Result<T[]>> {
  const res = await apiService.fetchEntityRecords<T>(entity as any, { ...opts, limit: opts.limit ?? 5000 });
  return res.success ? ok(res.data || []) : fail(friendlyDbError(res.error));
}

async function create<T>(entity: string, record: any, audit: { module: string; targetItem: string; details: string }): Promise<Result<T>> {
  const res = await apiService.saveEntityRecord<any>(entity as any, record, { ...audit, action: 'CREATE' });
  return res.success ? ok({ ...record, ...(res.record || {}) } as T) : fail(friendlyDbError(res.error));
}

async function update<T>(entity: string, id: string, patch: any, audit: { module: string; targetItem: string; details: string }): Promise<Result<T>> {
  const res = await apiService.updateEntityRecord<any>(entity as any, id, patch, { ...audit, action: 'UPDATE' });
  return res.success ? ok({ ...patch, id, ...(res.record || {}) } as T) : fail(friendlyDbError(res.error));
}

async function postJson<T = any>(path: string, body: unknown, method: 'POST' | 'DELETE' = 'POST'): Promise<{ ok: boolean; status: number; json: any }> {
  try {
    const res = await fetch(getApiUrl(path), { method, headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: method === 'POST' ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json?.success !== false, status: res.status, json };
  } catch (err: any) {
    return { ok: false, status: 0, json: { error: `Network error: ${err.message}` } };
  }
}

export const suEnhancementsService = {
  /* ------------------------------------------------------------------------------------------------------ HC2 */
  async getHc2(suId: string): Promise<Result<Hc2Details | null>> {
    if (!suId) return ok(null);
    const res = await list<Hc2Details>('suHc2', { eq: { su_id: suId }, limit: 1 });
    return res.success ? ok(res.data[0] || null) : fail(res.error);
  },

  /** Create or update. Identifier fields are left out of an update when the caller may not see them. */
  async saveHc2(input: Partial<Hc2Details> & { suId: string }, user: string, opts: { canEditIdentifiers: boolean }): Promise<Result<Hc2Details>> {
    const invalid = validateHc2({ status: input.status, issueDate: input.issueDate || undefined, expiryDate: input.expiryDate || undefined, referenceNumber: input.referenceNumber || undefined });
    if (invalid) return fail(invalid);
    const existing = await this.getHc2(input.suId);
    if (!existing.success) return fail(existing.error);
    if (!input.id && existing.data) return fail('This Service User already has HC2 details. Edit the existing record.');

    const payload: Record<string, any> = {
      suId: input.suId, status: input.status, issueDate: orNull(input.issueDate), expiryDate: orNull(input.expiryDate), notes: orNull(input.notes), updatedBy: user
    };
    if (opts.canEditIdentifiers) payload.referenceNumber = orNull(input.referenceNumber);
    const audit = { module: 'GP Registrations', targetItem: input.suId, details: `${input.id ? 'Updated' : 'Created'} HC2 details` };
    if (input.id) return update<Hc2Details>('suHc2', input.id, payload, audit);
    return create<Hc2Details>('suHc2', { id: newId('hc2'), ...payload, createdBy: user }, audit);
  },

  async uploadHc2Document(suId: string, file: File): Promise<Result<{ documentName: string }>> {
    if (file.size > 8 * 1024 * 1024) return fail('The file must be 8 MB or smaller.');
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return fail('Only PDF, JPEG or PNG files can be uploaded.');
    const dataBase64: string = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read the file.'));
      reader.readAsDataURL(file);
    }).catch(() => '');
    if (!dataBase64) return fail('Could not read the file.');
    const r = await postJson(`/api/su/hc2/${encodeURIComponent(suId)}/document`, { fileName: file.name, contentType: file.type, dataBase64 });
    return r.ok ? ok({ documentName: String(r.json.documentName || file.name) }) : fail(r.json?.error);
  },

  /** A short-lived link; opened straight away, never stored. */
  async getHc2DocumentUrl(suId: string): Promise<Result<string>> {
    try {
      const res = await fetch(getApiUrl(`/api/su/hc2/${encodeURIComponent(suId)}/document`), { headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      return res.ok && json?.url ? ok(json.url as string) : fail(json?.error);
    } catch (err: any) { return fail(`Network error: ${err.message}`); }
  },

  async removeHc2Document(suId: string): Promise<Result<null>> {
    const r = await postJson(`/api/su/hc2/${encodeURIComponent(suId)}/document`, undefined, 'DELETE');
    return r.ok ? ok(null) : fail(r.json?.error);
  },

  /* ------------------------------------------------------------------------------------------------ Oyster cards */
  listOysterCards: () => list<OysterCard>('oysterCards', { order: 'card_ref.asc' }),
  listOysterTransactions: (opts: { suId?: string; fundingRequestId?: string } = {}) =>
    list<OysterTransaction>('oysterTransactions', { eq: { ...(opts.suId ? { su_id: opts.suId } : {}), ...(opts.fundingRequestId ? { funding_request_id: opts.fundingRequestId } : {}) }, order: 'issued_date.desc' }),
  listOysterEvents: (cardId: string) => list<OysterCardEvent>('oysterCardEvents', { eq: { card_id: cardId }, order: 'changed_at.desc' }),

  /** Register a card held by a property. It starts Available; the opening balance is the balance staff can see on the card. */
  async registerOysterCard(input: { cardRef: string; siteName: string; balance: number | string; notes?: string }, user: string): Promise<Result<OysterCard>> {
    const invalid = validateRegisterCard(input);
    if (invalid) return fail(invalid);
    return create<OysterCard>('oysterCards', { id: newId('oyc'), cardRef: clean(input.cardRef), siteName: clean(input.siteName), status: 'Available', currentBalance: Number(input.balance), notes: orNull(input.notes), createdBy: user },
      { module: 'Public Transport Tracker', targetItem: clean(input.cardRef), details: `Registered Oyster card at ${clean(input.siteName)}` });
  },

  /** Details and manual status (Available, Lost, Damaged, Deactivated). A card on loan is changed only by returning it. */
  updateOysterCard: (card: OysterCard, patch: { cardRef?: string; siteName?: string; status?: string; notes?: string }, user: string) =>
    update<OysterCard>('oysterCards', card.id, { ...patch, updatedBy: user }, { module: 'Public Transport Tracker', targetItem: card.cardRef, details: 'Updated Oyster card' }),

  async setOysterBalance(card: OysterCard, balance: number | string, note: string): Promise<Result<OysterCard>> {
    if (balance === '' || !(Number(balance) >= 0)) return fail('The balance must be zero or more.');
    if (card.status === 'Issued' && clean(note).length < 3) return fail('Say why the balance changed while the card is out (for example a top-up).');
    const r = await postJson(`/api/oyster/cards/${encodeURIComponent(card.id)}/balance`, { balance: Number(balance), note });
    return r.ok ? ok(r.json.card as OysterCard) : fail(friendlyDbError(r.json?.error));
  },

  /** Issue an available card to a Service User; with a funding request it also moves that request to Issued. */
  async issueOysterCard(input: { cardId: string; suId: string; fundingRequestId?: string; balance: number | string; issuedDate?: string }): Promise<Result<OysterTransaction>> {
    const invalid = validateIssue(input, todayIso());
    if (invalid) return fail(invalid);
    const r = await postJson('/api/oyster/issue', { ...input, balance: Number(input.balance) });
    return r.ok ? ok(r.json.transaction as OysterTransaction) : fail(friendlyDbError(r.json?.error));
  },

  /** Return a card with its actual remaining balance. A good card goes back into the property's stock. */
  async returnOysterCard(txn: OysterTransaction, input: { condition: string; balance?: number | string; notes?: string; returnedDate?: string }): Promise<Result<OysterTransaction>> {
    const invalid = validateReturn(input, txn.issuedDate, todayIso());
    if (invalid) return fail(invalid);
    const r = await postJson(`/api/oyster/transactions/${encodeURIComponent(txn.id)}/return`, { ...input, balance: input.condition === 'Lost' ? null : Number(input.balance) });
    return r.ok ? ok(r.json.transaction as OysterTransaction) : fail(friendlyDbError(r.json?.error));
  },

  /* ------------------------------------------------------------------------------------------------------ Meals */
  listMealsForDate: (date: string) => list<MealRecord>('suMeals', { eq: { meal_date: date } }),
  listMealsForSu: (suId: string, limit = 400) => list<MealRecord>('suMeals', { eq: { su_id: suId }, order: 'meal_date.desc', limit }),
  listMealHistory: (recordId: string) => list<MealHistoryEntry>('suMealHistory', { eq: { record_id: recordId }, order: 'changed_at.desc' }),

  /**
   * Record or correct one meal. The id is built from SU, date and meal, so there is only ever one row for a slot.
   * The database trigger writes the history row, so every correction is kept.
   */
  async saveMeal(input: { suId: string; mealDate: string; mealPeriod: string; status: string; notes?: string; existing?: MealRecord | null }, user: string): Promise<Result<MealRecord>> {
    const invalid = validateMealEntry(input.status, input.notes);
    if (invalid) return fail(invalid);
    if (input.mealDate > todayIso()) return fail('A meal cannot be recorded for a future date.');
    const id = input.existing?.id || mealRecordId(input.suId, input.mealDate, input.mealPeriod);
    const audit = { module: 'SU Meal Tracker', targetItem: input.suId, details: `${input.mealPeriod} on ${input.mealDate}: ${input.status}` };
    if (input.existing) return update<MealRecord>('suMeals', id, { status: input.status, notes: orNull(input.notes), updatedBy: user }, audit);
    return create<MealRecord>('suMeals', { id, suId: input.suId, mealDate: input.mealDate, mealPeriod: input.mealPeriod, status: input.status, notes: orNull(input.notes), recordedBy: user }, audit);
  },

  /* ------------------------------------------------------------------------------------------------- Education */
  listEducation: (suId: string) => list<EducationDetails>('suEducation', { eq: { su_id: suId }, order: 'created_at.desc' }),

  async saveEducation(input: Partial<EducationDetails> & { suId: string }, user: string): Promise<Result<EducationDetails>> {
    const invalid = validateEducation({ educationStatus: input.educationStatus, schoolName: input.schoolName || undefined, startDate: input.startDate || undefined, endDate: input.endDate || undefined });
    if (invalid) return fail(invalid);
    const fields = {
      schoolName: orNull(input.schoolName), schoolAddress: orNull(input.schoolAddress), schoolContact: orNull(input.schoolContact), yearGroup: orNull(input.yearGroup),
      educationStatus: input.educationStatus, startDate: orNull(input.startDate), endDate: orNull(input.endDate), notes: orNull(input.notes), updatedBy: user
    };
    const audit = { module: 'Service Users - Education', targetItem: input.suId, details: `${input.id ? 'Updated' : 'Created'} school details` };
    if (input.id) return update<EducationDetails>('suEducation', input.id, fields, audit);
    const current = await this.listEducation(input.suId);
    if (!current.success) return fail(current.error);
    if (current.data.some(e => e.isCurrent)) return fail('This child already has current school details. Edit them or record a change of school.');
    return create<EducationDetails>('suEducation', { id: newId('edu'), suId: input.suId, isCurrent: true, ...fields, createdBy: user }, audit);
  },

  /**
   * Change of school. The old row is closed first (kept as history), then the new current row is created. If the second
   * step fails the child simply has no current row and the user is told to retry; nothing is lost or duplicated.
   */
  async changeSchool(previous: EducationDetails, next: Partial<EducationDetails> & { suId: string }, user: string): Promise<Result<EducationDetails>> {
    const invalid = validateEducation({ educationStatus: next.educationStatus, schoolName: next.schoolName || undefined, startDate: next.startDate || undefined });
    if (invalid) return fail(invalid);
    const endDate = next.startDate && next.startDate > (previous.startDate || '') ? next.startDate : todayIso();
    const closed = await update<EducationDetails>('suEducation', previous.id, { isCurrent: false, endDate: previous.endDate || endDate, updatedBy: user },
      { module: 'Service Users - Education', targetItem: previous.suId, details: 'Closed previous school record' });
    if (!closed.success) return fail(closed.error);
    const created = await this.saveEducation({ ...next, id: undefined }, user);
    return created.success ? created : fail(`The previous school was closed but the new details were not saved: ${created.error} Add the new school again.`);
  },

  /* ---------------------------------------------------------------------------------------------- Family groups */
  listFamilies: () => list<FamilyGroup>('familyGroups', { order: 'created_at.desc' }),
  listFamilyMembers: (opts: { familyId?: string; suId?: string } = {}) =>
    list<FamilyMember>('familyMembers', { eq: { ...(opts.familyId ? { family_id: opts.familyId } : {}), ...(opts.suId ? { su_id: opts.suId } : {}) } }),

  async createFamily(input: { displayName?: string; familyRef?: string; notes?: string }, user: string): Promise<Result<FamilyGroup>> {
    if (!clean(input.displayName) && !clean(input.familyRef)) return fail('Enter a family name or reference.');
    return create<FamilyGroup>('familyGroups', {
      id: newId('fam'), displayName: orNull(input.displayName), familyRef: orNull(input.familyRef), notes: orNull(input.notes), status: 'Active', createdBy: user, updatedBy: user
    }, { module: 'Family Groups', targetItem: clean(input.displayName) || clean(input.familyRef), details: 'Created family group' });
  },

  async addFamilyMember(familyId: string, suId: string, relationship: string, user: string): Promise<Result<FamilyMember>> {
    return create<FamilyMember>('familyMembers', {
      id: newId('fmem'), familyId, suId, relationship: orNull(relationship), status: 'Active', joinedAt: new Date().toISOString(), addedBy: user, updatedBy: user
    }, { module: 'Family Groups', targetItem: suId, details: `Added to family group ${familyId}` });
  },

  updateFamilyRelationship: (member: FamilyMember, relationship: string, user: string) =>
    update<FamilyMember>('familyMembers', member.id, { relationship: orNull(relationship), updatedBy: user }, { module: 'Family Groups', targetItem: member.suId, details: 'Updated family relationship' }),

  /** Removes the link only. The Service User and all their tracking data stay untouched; the row is kept as history. */
  async removeFamilyMember(member: FamilyMember, reason: string, user: string): Promise<Result<FamilyMember>> {
    if (clean(reason).length < 3) return fail('Enter a reason for removing this member.');
    return update<FamilyMember>('familyMembers', member.id, { status: 'Removed', leftAt: new Date().toISOString(), removalReason: clean(reason), updatedBy: user },
      { module: 'Family Groups', targetItem: member.suId, details: `Removed from family group ${member.familyId}` });
  },

  /* ------------------------------------------------------------------------------------------------- Household */
  /** Add an existing Service User to the household of another; the household is created on the first add. One database transaction. */
  async householdAdd(input: { anchorSuId: string; memberSuId: string; relationship?: string; anchorRelationship?: string }): Promise<Result<FamilyMember>> {
    if (!input.memberSuId) return fail('Choose the Service User to add.');
    if (input.memberSuId === input.anchorSuId) return fail('A person cannot be linked to themselves.');
    const r = await postJson('/api/su/household/add', input);
    return r.ok ? ok(r.json.member as FamilyMember) : fail(friendlyDbError(r.json?.error));
  },
  async householdRemove(familyId: string, suId: string, reason: string): Promise<Result<null>> {
    if (clean(reason).length < 3) return fail('Enter a reason.');
    const r = await postJson('/api/su/household/remove', { familyId, suId, reason });
    return r.ok ? ok(null) : fail(friendlyDbError(r.json?.error));
  },
  async householdSetRelationship(familyId: string, suId: string, relationship: string): Promise<Result<FamilyMember>> {
    const r = await postJson('/api/su/household/relationship', { familyId, suId, relationship });
    return r.ok ? ok(r.json.member as FamilyMember) : fail(friendlyDbError(r.json?.error));
  },

  /* ------------------------------------------------------------------------------------------------- Archive */
  listArchiveRequests: (opts: { suId?: string; status?: string } = {}) =>
    list<ArchiveRequest>('suArchiveRequests', { eq: { ...(opts.suId ? { su_id: opts.suId } : {}), ...(opts.status ? { status: opts.status } : {}) }, order: 'requested_at.desc' }),

  async requestArchive(suId: string, type: 'Archive' | 'Restore', reason: string): Promise<Result<ArchiveRequest>> {
    if (clean(reason).length < 3) return fail('Enter the reason.');
    const r = await postJson('/api/su/archive/request', { suId, type, reason });
    return r.ok ? ok(r.json.request as ArchiveRequest) : fail(friendlyDbError(r.json?.error));
  },

  async decideArchive(requestId: string, decision: 'Approved' | 'Rejected' | 'Cancelled', reason: string): Promise<Result<ArchiveRequest>> {
    if (decision === 'Rejected' && clean(reason).length < 3) return fail('Enter the reason for rejecting this request.');
    const r = await postJson(`/api/su/archive/requests/${encodeURIComponent(requestId)}/decision`, { decision, reason });
    return r.ok ? ok(r.json.request as ArchiveRequest) : fail(friendlyDbError(r.json?.error));
  }
};
