/**
 * Attendance marking - keeping the screen's records in step with saves and live events, without refetching (pure).
 *
 * The screen holds the attendance rows in state. A tap changes ONE row in that state at once (optimistic), the save runs in
 * the background, and live events from other users are merged row by row. Two rules keep it correct:
 *   - a row that is being saved from this screen is never overwritten by an incoming event (our newer tap wins);
 *   - an incoming event never replaces a row that is already newer than it (a late or repeated event is ignored).
 */

import type { AttendanceRecord } from '../services/suTrackerService';

/** One record per resident per day; this is the day's identity. */
export const slotKey = (suId: string, date: string) => `${suId}|${String(date).slice(0, 10)}`;
export const attendanceRecordId = (suId: string, date: string) => `att-${suId}-${String(date).slice(0, 10)}`.replace(/[^a-zA-Z0-9_-]/g, '_');

/** A realtime row (snake_case, as the database sends it) as the screen's record shape. */
export function attendanceFromRow(row: Record<string, any> | null | undefined): AttendanceRecord | null {
  if (!row || !row.id || !row.su_id || !row.attendance_date) return null;
  return {
    id: String(row.id), suId: String(row.su_id), attendanceDate: String(row.attendance_date).slice(0, 10),
    attendanceStatus: row.attendance_status, additionalNotes: row.additional_notes ?? '',
    recordedBy: row.recorded_by ?? undefined, updatedBy: row.updated_by ?? undefined,
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  } as AttendanceRecord;
}

const stamp = (r: Pick<AttendanceRecord, 'updatedAt' | 'createdAt'>) => String(r.updatedAt || r.createdAt || '');

/** True when `incoming` is not newer than what we already have for that day (so it must not replace it). */
export function isStale(local: AttendanceRecord | undefined, incoming: AttendanceRecord): boolean {
  if (!local) return false;
  const a = stamp(local); const b = stamp(incoming);
  if (!a || !b) return false;                     // no timestamps to compare: take the incoming (the database is the authority)
  return b < a;
}

/** Put one record into the list (replacing that day's row), leaving everything else untouched. */
export function upsertRecord(list: AttendanceRecord[], rec: AttendanceRecord): AttendanceRecord[] {
  const k = slotKey(rec.suId, rec.attendanceDate);
  return [...list.filter(r => slotKey(r.suId, r.attendanceDate) !== k), rec];
}

export function removeSlot(list: AttendanceRecord[], suId: string, date: string): AttendanceRecord[] {
  const k = slotKey(suId, date);
  return list.filter(r => slotKey(r.suId, r.attendanceDate) !== k);
}

export interface LiveEvent { eventType: string; row: Record<string, any> | null }

/**
 * Merge one live event. Returns the SAME array when nothing changes (so React does not re-render), otherwise a new array.
 * `saving` holds the slot keys being saved from this screen; `inScope` says whether this user may see that resident.
 */
export function applyLiveEvent(
  list: AttendanceRecord[], ev: LiveEvent, saving: ReadonlySet<string>, inScope: (suId: string) => boolean
): AttendanceRecord[] {
  const type = String(ev.eventType).toUpperCase();
  const rec = attendanceFromRow(ev.row);
  if (type === 'DELETE') {
    // A delete carries the old row (or at least its id). Match by id first, then by the day if the row is complete.
    const id = ev.row?.id ? String(ev.row.id) : '';
    const target = list.find(r => (id && r.id === id) || (rec && slotKey(r.suId, r.attendanceDate) === slotKey(rec.suId, rec.attendanceDate)));
    if (!target) return list;
    if (saving.has(slotKey(target.suId, target.attendanceDate))) return list;
    return list.filter(r => r !== target);
  }
  if (!rec || !inScope(rec.suId)) return list;
  if (saving.has(slotKey(rec.suId, rec.attendanceDate))) return list;           // our own newer tap is in flight
  const local = list.find(r => slotKey(r.suId, r.attendanceDate) === slotKey(rec.suId, rec.attendanceDate));
  if (isStale(local, rec)) return list;
  if (local && stamp(local) === stamp(rec) && local.attendanceStatus === rec.attendanceStatus && (local.additionalNotes || '') === (rec.additionalNotes || '')) return list;   // already have it (our own echo)
  return upsertRecord(list, rec);
}

/**
 * After a gap (reconnect) the database copy replaces the list, except for days being saved from this screen, whose
 * on-screen value is kept because it is newer than anything the database has returned yet.
 */
export function reconcile(local: AttendanceRecord[], fresh: AttendanceRecord[], saving: ReadonlySet<string>): AttendanceRecord[] {
  const keep = local.filter(r => saving.has(slotKey(r.suId, r.attendanceDate)));
  const kept = new Set(keep.map(r => slotKey(r.suId, r.attendanceDate)));
  return [...fresh.filter(r => !kept.has(slotKey(r.suId, r.attendanceDate))), ...keep];
}
