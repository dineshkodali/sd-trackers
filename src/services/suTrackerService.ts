import { apiService } from './apiService';
import { suPropertyService } from './suPropertyService';
import { activePlacementBySu } from '../utils/placementSelection';
import { isValidNhsNumber } from '../utils/suTrackerAccess';
import {
  followUpsToCreate, isIsoDate, type AbsencePolicy, type AttendanceEntry, DEFAULT_ABSENCE_POLICY
} from '../utils/attendanceLogic';
import type { ServiceUserMaster } from '../types/masterData';

/* --------------------------------------------------------------------------------------------------------------
 * Data access for GP registrations, PEEP plans, attendance and absence follow-ups.
 * Every record points at the canonical Service User id; names, DOB, port reference and room are always read
 * from the Service User master / active placement (see loadSuDirectory) and never copied into these tables.
 * ------------------------------------------------------------------------------------------------------------ */

export interface GpRegistration {
  id: string; suId: string; gpPractice?: string; pharmacy?: string; nhsNumber?: string; notes?: string;
  createdBy?: string; updatedBy?: string; createdAt?: string; updatedAt?: string;
}
export const PEEP_RISK_LEVELS = ['Low', 'Medium', 'High'] as const;
export const PEEP_COMPANIONS = ['SD Commercial staff and Security', 'Other authorised assistance'];
export const PEEP_ALARMS = ['Existing alarm system', 'Pager device', 'Visual alarm system / device', 'Other system'];
export const PEEP_ASSISTANCE = ['No device required', 'Emergency evacuation chair required', 'Other assistance required'];

export interface PeepPlan {
  id: string; suId: string; mobilityType?: string; riskLevel: 'Low' | 'Medium' | 'High'; companion?: string;
  emergencyAlarm?: string; assistance?: string; evacuationProcedure?: string; safeExitRoutes?: string;
  developedBy?: string; planDate?: string; reviewDate?: string; lastReviewedAt?: string;
  status: 'Active' | 'Archived'; version: number;
  createdBy?: string; updatedBy?: string; createdAt?: string; updatedAt?: string;
}
export interface PeepHistoryEntry {
  id: string; planId: string; suId: string; version: number; changeType: 'Created' | 'Updated' | 'Reviewed' | 'Archived';
  snapshot: any; changedFields?: string; changedBy?: string; changedAt?: string;
}
export interface AttendanceRecord {
  id: string; suId: string; attendanceDate: string; attendanceStatus: 'Present' | 'Absent'; additionalNotes?: string;
  recordedBy?: string; updatedBy?: string; createdAt?: string; updatedAt?: string;
}
export interface AbsenceFollowUp {
  id: string; suId: string; absenceStartDate: string; thresholdDays: number; thresholdReachedAt?: string;
  consecutiveDays?: number; status: 'Open' | 'In Progress' | 'Resolved'; assignedTo?: string; followUpNotes?: string;
  actionHistory?: Array<{ at: string; by: string; action: string }>; dueDate?: string; lastActionAt?: string; resolvedAt?: string;
  createdBy?: string; updatedBy?: string; createdAt?: string; updatedAt?: string;
}

export interface SuDirectoryRow {
  su: ServiceUserMaster;
  /** Current room number from the active placement ('' when not placed). */
  roomNo: string;
  siteName: string;
}

/** `data` is only meaningful when `success` is true; `error` only when it is false. */
export type Result<T> = { success: boolean; data: T; error?: string; warning?: string };
const fail = <T = any>(error?: string): Result<T> => ({ success: false, data: undefined as unknown as T, error: error || 'Request failed' });
const newId = (prefix: string) => `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
const nowIso = () => new Date().toISOString();

async function list<T>(entity: string, opts: { eq?: Record<string, string>; order?: string; limit?: number } = {}): Promise<Result<T[]>> {
  const res = await apiService.fetchEntityRecords<T>(entity as any, { ...opts, limit: opts.limit ?? 5000 });
  return res.success ? { success: true, data: res.data || [] } : fail(res.error);
}

export const suTrackerService = {
  /* ---------------------------------------------------------------- Service User directory (joined, current) */
  /** Authorised Service Users with their current room and site: the single source for names, DOB, port ref, room. */
  async loadSuDirectory(sites: Array<{ id: string; name: string }>): Promise<Result<SuDirectoryRow[]>> {
    const [suRes, plcRes, roomRes] = await Promise.all([
      suPropertyService.getServiceUsers(),
      suPropertyService.getPlacements({ status: 'Active' }),
      suPropertyService.getRooms()
    ]);
    if (!suRes.success) return fail(suRes.error);
    const roomById = new Map((roomRes.data || []).map(r => [r.id, r.roomNumber] as const));
    const placementBySu = activePlacementBySu(plcRes.data || []);
    const rows = (suRes.data || []).filter(u => u.status !== 'Discharged').map(su => {
      const plc = placementBySu.get(su.id);
      const siteId = plc?.siteId || su.siteId;
      return {
        su,
        roomNo: plc ? String(roomById.get(plc.roomId) || '') : '',
        siteName: sites.find(s => s.id === siteId || s.name === siteId)?.name || siteId || ''
      };
    });
    return { success: true, data: rows };
  },

  /* ---------------------------------------------------------------------------------------- GP registrations */
  listGpRegistrations: () => list<GpRegistration>('gpRegistrations', { order: 'updated_at.desc' }),

  /** A fresh read for one resident (never a cached object), used by the registration form and appointment booking. */
  async getGpRegistrationForSu(suId: string): Promise<Result<GpRegistration | null>> {
    if (!suId) return { success: true, data: null };
    const res = await list<GpRegistration>('gpRegistrations', { eq: { su_id: suId }, limit: 1 });
    return res.success ? { success: true, data: res.data[0] || null } : fail(res.error);
  },

  async saveGpRegistration(input: Partial<GpRegistration> & { suId: string }, user: string): Promise<Result<GpRegistration>> {
    if (!input.suId) return fail('Choose a Service User.');
    if (!isValidNhsNumber(input.nhsNumber)) return fail('NHS number must be 10 digits.');
    const existing = await this.getGpRegistrationForSu(input.suId);
    if (!existing.success) return fail(existing.error);
    const current = existing.data;
    if (!input.id && current) return fail('This Service User already has a GP registration. Edit the existing one.');
    if (input.id && current && current.id !== input.id) return fail('This Service User already has a different GP registration.');

    const clean = (v?: string) => (v ?? '').trim();
    const payload = {
      suId: input.suId, gpPractice: clean(input.gpPractice), pharmacy: clean(input.pharmacy),
      nhsNumber: clean(input.nhsNumber).replace(/\s+/g, ' '), notes: clean(input.notes), updatedBy: user
    };
    const audit = { module: 'GP Registrations', targetItem: input.suId, details: `${input.id ? 'Updated' : 'Created'} GP registration` };
    if (input.id) {
      const res = await apiService.updateEntityRecord<GpRegistration>('gpRegistrations', input.id, payload, { ...audit, action: 'UPDATE' });
      return res.success ? { success: true, data: { ...(current as GpRegistration), ...payload, ...(res.record || {}) } } : fail(res.error);
    }
    const record: GpRegistration = { id: newId('gpr'), ...payload, createdBy: user, createdAt: nowIso(), updatedAt: nowIso() };
    const res = await apiService.saveEntityRecord<GpRegistration>('gpRegistrations', record, { ...audit, action: 'CREATE' });
    return res.success ? { success: true, data: { ...record, ...(res.record || {}) } } : fail(res.error);
  },

  /* ---------------------------------------------------------------------------------------------- PEEP plans */
  listPeepPlans: () => list<PeepPlan>('peepPlans', { order: 'review_date.asc' }),
  listPeepHistory: (planId: string) => list<PeepHistoryEntry>('peepPlanHistory', { eq: { plan_id: planId }, order: 'changed_at.desc' }),

  validatePeep(p: Partial<PeepPlan>): string | null {
    if (!p.suId) return 'Choose a Service User.';
    if (!p.riskLevel || !(PEEP_RISK_LEVELS as readonly string[]).includes(p.riskLevel)) return 'Choose a PEEP risk level (Low, Medium or High).';
    if (!p.mobilityType?.trim()) return 'Enter the mobility type.';
    if (!p.evacuationProcedure?.trim()) return 'Enter the evacuation procedure.';
    if (!p.safeExitRoutes?.trim()) return 'Enter the safe exit routes.';
    if (!p.developedBy?.trim()) return 'Enter who developed the plan.';
    if (!p.planDate || !isIsoDate(p.planDate)) return 'Enter the plan date.';
    if (!p.reviewDate || !isIsoDate(p.reviewDate)) return 'Enter the review date.';
    if (p.reviewDate < p.planDate) return 'The review date cannot be before the plan date.';
    return null;
  },

  /**
   * Create a plan, or save changes / a review to an existing one. Every save writes a history snapshot so
   * risk-level and evacuation-instruction changes can be traced.
   */
  async savePeepPlan(input: Partial<PeepPlan> & { suId: string }, user: string, mode: 'save' | 'review' = 'save'): Promise<Result<PeepPlan>> {
    const problem = this.validatePeep(input);
    if (problem) return fail(problem);
    const fields: Array<keyof PeepPlan> = ['mobilityType', 'riskLevel', 'companion', 'emergencyAlarm', 'assistance', 'evacuationProcedure', 'safeExitRoutes', 'developedBy', 'planDate', 'reviewDate'];
    const trimmed: Partial<PeepPlan> = {};
    for (const k of fields) (trimmed as any)[k] = typeof (input as any)[k] === 'string' ? (input as any)[k].trim() : (input as any)[k];

    const existingRes = await list<PeepPlan>('peepPlans', { eq: { su_id: input.suId, status: 'Active' }, limit: 5 });
    if (!existingRes.success) return fail(existingRes.error);
    const active = existingRes.data[0] || null;

    if (!input.id && active) return fail('This Service User already has an active PEEP plan. Open it to edit or review it.');
    if (input.id && (!active || active.id !== input.id)) return fail('That plan is no longer the active plan for this Service User. Reload and try again.');

    const audit = { module: 'PEEP Tracker', targetItem: input.suId };
    let saved: PeepPlan;
    let changeType: PeepHistoryEntry['changeType'];
    let changedFields = '';

    if (!active) {
      saved = { id: newId('peep'), suId: input.suId, ...(trimmed as any), status: 'Active', version: 1, createdBy: user, updatedBy: user, createdAt: nowIso(), updatedAt: nowIso() };
      const res = await apiService.saveEntityRecord<PeepPlan>('peepPlans', saved, { ...audit, action: 'CREATE', details: 'Created PEEP plan' });
      if (!res.success) return fail(res.error);
      changeType = 'Created';
    } else {
      changedFields = fields.filter(k => String((active as any)[k] ?? '') !== String((trimmed as any)[k] ?? '')).join(', ');
      const version = (active.version || 1) + 1;
      const changes: Partial<PeepPlan> = {
        ...trimmed, version, updatedBy: user,
        ...(mode === 'review' ? { lastReviewedAt: nowIso() } : {})
      };
      const res = await apiService.updateEntityRecord<PeepPlan>('peepPlans', active.id, changes, { ...audit, action: 'UPDATE', details: mode === 'review' ? 'Reviewed PEEP plan' : `Updated PEEP plan (${changedFields || 'no field changes'})` });
      if (!res.success) return fail(res.error);
      saved = { ...active, ...changes, ...(res.record || {}) } as PeepPlan;
      changeType = mode === 'review' ? 'Reviewed' : 'Updated';
    }

    const history: PeepHistoryEntry = {
      id: newId('peeph'), planId: saved.id, suId: saved.suId, version: saved.version, changeType,
      snapshot: { ...saved }, changedFields, changedBy: user, changedAt: nowIso()
    };
    const hist = await apiService.saveEntityRecord<PeepHistoryEntry>('peepPlanHistory', history, { ...audit, action: 'CREATE', details: `PEEP history: ${changeType}` });
    // The plan is already saved; a failed history write must be visible rather than silently dropped.
    if (!hist.success) return { success: true, data: saved, ...( { warning: `Plan saved, but its history entry could not be written: ${hist.error}` } as any) };
    return { success: true, data: saved };
  },

  /* ------------------------------------------------------------------------------------------ Attendance */
  async listAttendance(range: { from?: string; to?: string; suId?: string } = {}): Promise<Result<AttendanceRecord[]>> {
    const res = await list<AttendanceRecord>('suAttendance', { eq: range.suId ? { su_id: range.suId } : undefined, order: 'attendance_date.desc', limit: 20000 });
    if (!res.success) return res;
    return { success: true, data: res.data.filter(r => (!range.from || r.attendanceDate >= range.from) && (!range.to || r.attendanceDate <= range.to)) };
  },

  /** One record per resident per day: saving the same day again updates it. */
  async saveAttendance(input: { suId: string; date: string; status: 'Present' | 'Absent'; notes?: string }, user: string): Promise<Result<AttendanceRecord>> {
    if (!input.suId) return fail('Choose a Service User.');
    if (!isIsoDate(input.date)) return fail('Choose a valid date.');
    if (input.status !== 'Present' && input.status !== 'Absent') return fail('Choose Present or Absent.');
    const existing = await list<AttendanceRecord>('suAttendance', { eq: { su_id: input.suId, attendance_date: input.date }, limit: 1 });
    if (!existing.success) return fail(existing.error);
    const current = existing.data[0];
    const audit = { module: 'SU Attendance', targetItem: `${input.suId} ${input.date}` };
    const fields = { suId: input.suId, attendanceDate: input.date, attendanceStatus: input.status, additionalNotes: (input.notes || '').trim(), updatedBy: user };
    if (current) {
      const res = await apiService.updateEntityRecord<AttendanceRecord>('suAttendance', current.id, fields, { ...audit, action: 'UPDATE', details: `Attendance changed to ${input.status}` });
      return res.success ? { success: true, data: { ...current, ...fields, ...(res.record || {}) } } : fail(res.error);
    }
    const record: AttendanceRecord = { id: newId('att'), ...fields, recordedBy: user, createdAt: nowIso(), updatedAt: nowIso() };
    const res = await apiService.saveEntityRecord<AttendanceRecord>('suAttendance', record, { ...audit, action: 'CREATE', details: `Attendance recorded: ${input.status}` });
    return res.success ? { success: true, data: { ...record, ...(res.record || {}) } } : fail(res.error);
  },

  /* ------------------------------------------------------------------------------------------- Follow-ups */
  listFollowUps: () => list<AbsenceFollowUp>('absenceFollowups', { order: 'threshold_reached_at.desc' }),

  /**
   * Creates the follow-up items that should exist for the current absence runs. The id is derived from
   * resident + episode start + threshold, so running this repeatedly (or from two browsers) cannot create duplicates.
   */
  async ensureFollowUps(suIds: string[], entries: AttendanceEntry[], existing: AbsenceFollowUp[], asOf: string, user: string, policy: AbsencePolicy = DEFAULT_ABSENCE_POLICY): Promise<Result<AbsenceFollowUp[]>> {
    const todo = followUpsToCreate(suIds, entries, existing.map(f => ({ suId: f.suId, absenceStartDate: String(f.absenceStartDate).slice(0, 10), thresholdDays: f.thresholdDays })), asOf, policy);
    const created: AbsenceFollowUp[] = [];
    for (const f of todo) {
      const id = `afu-${f.suId}-${f.absenceStartDate}-${f.thresholdDays}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      const record: AbsenceFollowUp = {
        id, suId: f.suId, absenceStartDate: f.absenceStartDate, thresholdDays: f.thresholdDays, thresholdReachedAt: nowIso(),
        consecutiveDays: f.consecutiveDays, status: 'Open', actionHistory: [{ at: nowIso(), by: 'System', action: `${f.thresholdDays}-day absence threshold reached (${f.consecutiveDays} consecutive recorded days)` }],
        dueDate: asOf, createdBy: user, updatedBy: user
      };
      const res = await apiService.saveEntityRecord<AbsenceFollowUp>('absenceFollowups', record, { module: 'SU Attendance', action: 'CREATE', targetItem: id, details: `Absence follow-up opened (${f.thresholdDays} days)` });
      if (res.success) created.push({ ...record, ...(res.record || {}) });
      else if (!/duplicate|unique|23505|409/i.test(String(res.error))) return fail(res.error);
    }
    return { success: true, data: created };
  },

  async updateFollowUp(f: AbsenceFollowUp, changes: { status?: AbsenceFollowUp['status']; assignedTo?: string; followUpNotes?: string; action?: string; dueDate?: string }, user: string): Promise<Result<AbsenceFollowUp>> {
    const history = [...(f.actionHistory || [])];
    if (changes.action?.trim()) history.push({ at: nowIso(), by: user, action: changes.action.trim() });
    if (changes.status && changes.status !== f.status) history.push({ at: nowIso(), by: user, action: `Status changed to ${changes.status}` });
    const patch: Partial<AbsenceFollowUp> = {
      status: changes.status ?? f.status, assignedTo: changes.assignedTo ?? f.assignedTo, followUpNotes: changes.followUpNotes ?? f.followUpNotes,
      dueDate: changes.dueDate ?? f.dueDate, actionHistory: history, lastActionAt: nowIso(), updatedBy: user,
      resolvedAt: (changes.status ?? f.status) === 'Resolved' ? (f.resolvedAt || nowIso()) : undefined
    };
    const res = await apiService.updateEntityRecord<AbsenceFollowUp>('absenceFollowups', f.id, patch, { module: 'SU Attendance', action: 'UPDATE', targetItem: f.id, details: `Absence follow-up: ${changes.action || changes.status || 'updated'}` });
    return res.success ? { success: true, data: { ...f, ...patch, ...(res.record || {}) } } : fail(res.error);
  }
};
