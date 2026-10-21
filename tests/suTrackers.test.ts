import test from 'node:test';
import assert from 'node:assert/strict';
import { toDatabaseRow, fromDatabaseRow } from '../server/schemaAdapter.ts';
import { isValidNhsNumber, maskNhsNumber, formatUkDate, canViewNhsNumber, canEditSuTrackers } from '../src/utils/suTrackerAccess.ts';

const roundTrip = (table: string, rec: any) => fromDatabaseRow(table, { ...toDatabaseRow(table, rec), created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' });

test('NHS numbers: ten digits, spaces allowed, empty allowed, masked for restricted roles', () => {
  assert.equal(isValidNhsNumber('123 456 7890'), true);
  assert.equal(isValidNhsNumber(''), true);
  assert.equal(isValidNhsNumber('12345'), false);
  assert.equal(isValidNhsNumber('12345678AB'), false);
  assert.equal(maskNhsNumber('123 456 7890'), '123 ••• 890');
  assert.equal(canViewNhsNumber('Staff'), false);
  assert.equal(canViewNhsNumber('Regional Manager'), true);
  assert.equal(canEditSuTrackers('Staff'), true);
});

test('dates display as DD/MM/YYYY and are stored as YYYY-MM-DD', () => {
  assert.equal(formatUkDate('2026-10-21'), '21/10/2026');
  assert.equal(formatUkDate(''), '');
  const row = toDatabaseRow('su_attendance_records', { id: 'a', suId: 'su1', attendanceDate: '2026-10-21', attendanceStatus: 'Absent', additionalNotes: 'n' });
  assert.equal(row.attendance_date, '2026-10-21');
  assert.equal(row.su_id, 'su1');
  assert.equal(row.attendance_status, 'Absent');
});

test('GP registration round-trips with the Service User id as the key and NHS number kept as text', () => {
  const back = roundTrip('gp_registrations', { id: 'g', suId: 'su1', gpPractice: 'Park Surgery', pharmacy: 'Boots', nhsNumber: '012 345 6789' });
  assert.equal(back.suId, 'su1');
  assert.equal(back.nhsNumber, '012 345 6789'); // leading zero preserved
  assert.equal(back.gpPractice, 'Park Surgery');
});

test('PEEP plan round-trips every field', () => {
  const plan = { id: 'p', suId: 'su1', mobilityType: 'Wheelchair', riskLevel: 'High', companion: 'SD Commercial staff and Security', emergencyAlarm: 'Pager device', assistance: 'Emergency evacuation chair required', evacuationProcedure: 'Use chair via lift B', safeExitRoutes: 'Fire door 2', developedBy: 'A. Staff', planDate: '2026-10-01', reviewDate: '2026-11-01', status: 'Active', version: 2 };
  const back: any = roundTrip('peep_plans', plan);
  for (const k of Object.keys(plan)) assert.equal(back[k], (plan as any)[k], k);
});

test('PEEP history keeps the snapshot of the plan', () => {
  const back: any = roundTrip('peep_plan_history', { id: 'h', planId: 'p', suId: 'su1', version: 2, changeType: 'Updated', snapshot: { riskLevel: 'High' }, changedFields: 'riskLevel', changedBy: 'A' });
  assert.deepEqual(back.snapshot, { riskLevel: 'High' });
  assert.equal(back.changeType, 'Updated');
});

test('absence follow-up keeps its action history and episode identity', () => {
  const rec = { id: 'afu-su1-2026-10-01-3', suId: 'su1', absenceStartDate: '2026-10-01', thresholdDays: 3, consecutiveDays: 3, status: 'Open', actionHistory: [{ at: 'x', by: 'System', action: 'reached' }] };
  const back: any = roundTrip('absence_followups', rec);
  assert.equal(back.thresholdDays, 3);
  assert.equal(back.absenceStartDate, '2026-10-01');
  assert.deepEqual(back.actionHistory, rec.actionHistory);
});

test('empty dates are stored as null, not as an empty string', () => {
  const row = toDatabaseRow('peep_plans', { id: 'p', suId: 's', riskLevel: 'Low', reviewDate: '' });
  assert.equal(row.review_date, null);
});
