import test from 'node:test';
import assert from 'node:assert/strict';
import { slotKey, attendanceRecordId, attendanceFromRow, isStale, upsertRecord, removeSlot, applyLiveEvent, reconcile } from '../src/utils/attendanceMerge.ts';

const rec = (o: Record<string, any> = {}): any => ({ id: 'a1', suId: 'su1', attendanceDate: '2026-11-21', attendanceStatus: 'Present', additionalNotes: '', createdAt: '2026-11-21T09:00:00Z', updatedAt: '2026-11-21T09:00:00Z', ...o });
const row = (o: Record<string, any> = {}) => ({ id: 'a1', su_id: 'su1', attendance_date: '2026-11-21', attendance_status: 'Absent', additional_notes: '', created_at: '2026-11-21T09:00:00Z', updated_at: '2026-11-21T10:00:00Z', ...o });
const NOT_SAVING = new Set<string>();
const anyone = () => true;

test('a day has one identity and one fixed record id, so a second insert collides instead of duplicating', () => {
  assert.equal(slotKey('su1', '2026-11-21T00:00:00Z'), 'su1|2026-11-21');
  assert.equal(attendanceRecordId('su1', '2026-11-21'), attendanceRecordId('su1', '2026-11-21'));
  assert.notEqual(attendanceRecordId('su1', '2026-11-21'), attendanceRecordId('su2', '2026-11-21'));
});

test('a database row maps to the screen record', () => {
  const r = attendanceFromRow(row({ recorded_by: 'Sam' }))!;
  assert.deepEqual([r.id, r.suId, r.attendanceDate, r.attendanceStatus, r.recordedBy], ['a1', 'su1', '2026-11-21', 'Absent', 'Sam']);
  assert.equal(attendanceFromRow({ id: 'x' }), null);
  assert.equal(attendanceFromRow(null), null);
});

test('upsert replaces that day only; remove drops that day only', () => {
  const list = [rec(), rec({ id: 'b', suId: 'su2' }), rec({ id: 'c', attendanceDate: '2026-11-20' })];
  const next = upsertRecord(list, rec({ attendanceStatus: 'Absent' }));
  assert.equal(next.length, 3);
  assert.equal(next.find(r => r.suId === 'su1' && r.attendanceDate === '2026-11-21')!.attendanceStatus, 'Absent');
  assert.equal(removeSlot(list, 'su1', '2026-11-21').length, 2);
  assert.equal(removeSlot(list, 'su9', '2026-11-21').length, 3);
});

test('another user marking a resident is merged into just that row', () => {
  const list = [rec({ attendanceStatus: 'Present' })];
  const out = applyLiveEvent(list, { eventType: 'UPDATE', row: row() }, NOT_SAVING, anyone);
  assert.notEqual(out, list);
  assert.equal(out.length, 1);
  assert.equal(out[0].attendanceStatus, 'Absent');
  const inserted = applyLiveEvent([], { eventType: 'INSERT', row: row() }, NOT_SAVING, anyone);
  assert.equal(inserted.length, 1);
});

test('our own echo or a repeated event changes nothing (same array back, no re-render)', () => {
  const list = [rec({ attendanceStatus: 'Absent', updatedAt: '2026-11-21T10:00:00Z' })];
  assert.equal(applyLiveEvent(list, { eventType: 'UPDATE', row: row() }, NOT_SAVING, anyone), list);
});

test('a stale event never overwrites a newer row', () => {
  const list = [rec({ attendanceStatus: 'Absent', updatedAt: '2026-11-21T11:00:00Z' })];
  const out = applyLiveEvent(list, { eventType: 'UPDATE', row: row({ attendance_status: 'Present', updated_at: '2026-11-21T10:00:00Z' }) }, NOT_SAVING, anyone);
  assert.equal(out, list);
  assert.equal(isStale(list[0], attendanceFromRow(row({ updated_at: '2026-11-21T10:00:00Z' }))!), true);
  assert.equal(isStale(undefined, rec()), false);
});

test('a day being saved from this screen is not overwritten by an incoming event', () => {
  const list = [rec({ attendanceStatus: 'Present' })];
  const saving = new Set([slotKey('su1', '2026-11-21')]);
  assert.equal(applyLiveEvent(list, { eventType: 'UPDATE', row: row() }, saving, anyone), list);
  assert.equal(applyLiveEvent(list, { eventType: 'DELETE', row: { id: 'a1' } }, saving, anyone), list);
});

test('a delete removes the row by id; a delete for an unknown row changes nothing', () => {
  const list = [rec(), rec({ id: 'b', suId: 'su2' })];
  const out = applyLiveEvent(list, { eventType: 'DELETE', row: { id: 'a1' } }, NOT_SAVING, anyone);
  assert.deepEqual(out.map(r => r.id), ['b']);
  assert.equal(applyLiveEvent(list, { eventType: 'DELETE', row: { id: 'zzz' } }, NOT_SAVING, anyone), list);
});

test('residents this user cannot see are ignored', () => {
  assert.deepEqual(applyLiveEvent([], { eventType: 'INSERT', row: row() }, NOT_SAVING, id => id === 'other'), []);
});

test('after a reconnect the database copy replaces the list, but days being saved keep their on-screen value', () => {
  const local = [rec({ attendanceStatus: 'Absent' }), rec({ id: 'b', suId: 'su2', attendanceStatus: 'Present' })];
  const fresh = [rec({ attendanceStatus: 'Present' }), rec({ id: 'b', suId: 'su2', attendanceStatus: 'Absent' }), rec({ id: 'n', suId: 'su3' })];
  const out = reconcile(local, fresh, new Set([slotKey('su1', '2026-11-21')]));
  assert.equal(out.length, 3);
  assert.equal(out.find(r => r.suId === 'su1')!.attendanceStatus, 'Absent');     // being saved: kept
  assert.equal(out.find(r => r.suId === 'su2')!.attendanceStatus, 'Absent');     // not being saved: database wins
  assert.ok(out.some(r => r.suId === 'su3'));
});
