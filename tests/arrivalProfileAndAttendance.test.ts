import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidNhsNumber, formatNhsNumber, maskNhsNumber, nhsNumberError } from '../src/utils/nhsNumber.ts';
import { planProfileSync, mergeLines, hasAnyDetail, type ProfileState } from '../src/utils/arrivalProfileSync.ts';
import { buildMonth, summariseMonth, dailyRecords, shiftMonth, type AttendanceRow } from '../src/utils/attendanceCalendar.ts';

/* ----------------------------------------------------------------- NHS number */

test('NHS numbers: modulus-11 check digit, spaces allowed, optional when empty', () => {
  assert.equal(isValidNhsNumber('943 476 5919'), true);      // published test number
  assert.equal(isValidNhsNumber('9434765919'), true);
  assert.equal(isValidNhsNumber('943-476-5919'), true);
  assert.equal(isValidNhsNumber('943 476 5918'), false);     // wrong check digit
  assert.equal(isValidNhsNumber('123456789'), false);        // nine digits
  assert.equal(isValidNhsNumber('abcdefghij'), false);
  assert.equal(nhsNumberError(''), null);
  assert.equal(nhsNumberError('   '), null);
  assert.match(nhsNumberError('1234567890')!, /valid 10-digit/);
  assert.equal(formatNhsNumber('9434765919'), '943 476 5919');
  assert.equal(maskNhsNumber('943 476 5919'), '••• ••• 5919');
  assert.equal(maskNhsNumber(''), '');
});

/* ----------------------------------------------------------------- profile sync plan */

const empty: ProfileState = { safeguarding: '', dietary: [], suGpPractice: '', gp: null };

test('blank form values change nothing', () => {
  const state: ProfileState = { safeguarding: 'Known risk', dietary: ['Halal'], suGpPractice: 'Dr A', gp: { id: 'g1', gpPractice: 'Dr A', pharmacy: 'Boots', nhsNumber: '943 476 5919' } };
  const plan = planProfileSync(state, { suComments: '', dietaryRequirements: '  ', gpPractice: '', pharmacy: '', nhsNumber: '' });
  assert.equal(plan.safeguarding.write, false);
  assert.equal(plan.dietary.write, false);
  assert.equal(plan.suGpPractice.write, false);
  assert.equal(plan.gp.write, false);
  assert.deepEqual(plan.saved, []);
  assert.equal(hasAnyDetail({ suComments: '', nhsNumber: ' ' }), false);
});

test('a new person: everything is filled', () => {
  const plan = planProfileSync(empty, { suComments: 'Needs interpreter', dietaryRequirements: 'Halal\nNut allergy', gpPractice: 'Dr A', pharmacy: 'Boots', nhsNumber: '9434765919' });
  assert.equal(plan.safeguarding.value, 'Needs interpreter');
  assert.deepEqual(plan.dietary.value, ['Halal', 'Nut allergy']);
  assert.deepEqual(plan.gp.fields, { gpPractice: 'Dr A', pharmacy: 'Boots', nhsNumber: '943 476 5919' });   // formatted
  assert.equal(plan.suGpPractice.write, true);
});

test('an existing person: lists are merged, single values are never overwritten', () => {
  const state: ProfileState = { safeguarding: 'Known risk', dietary: ['Halal'], suGpPractice: 'Dr A', gp: { id: 'g1', gpPractice: 'Dr A', pharmacy: '', nhsNumber: '943 476 5919' } };
  const plan = planProfileSync(state, { suComments: 'known  RISK\nNew concern', dietaryRequirements: 'halal\nNo pork', gpPractice: 'Dr B', pharmacy: 'Lloyds', nhsNumber: '9434765919' });
  assert.equal(plan.safeguarding.value, 'Known risk\nNew concern');      // the repeated line is not added twice
  assert.deepEqual(plan.dietary.value, ['Halal', 'No pork']);
  assert.equal(plan.suGpPractice.write, false);                         // already has a GP: kept
  assert.deepEqual(plan.gp.fields, { pharmacy: 'Lloyds' });             // blank pharmacy filled; GP and NHS not replaced
  assert.ok(plan.keptExisting.some(k => k.startsWith('GP')));
  assert.ok(!plan.keptExisting.some(k => k.includes('NHS')));           // same NHS number typed again is not a conflict
});

test('a different NHS number is reported without exposing either number', () => {
  const plan = planProfileSync({ ...empty, gp: { id: 'g', nhsNumber: '943 476 5919' } }, { nhsNumber: '4505577104' });
  assert.equal(plan.gp.write, false);
  assert.ok(plan.keptExisting.every(k => !/\d{4}/.test(k)));
});

test('merge never adds an empty or repeated line', () => {
  assert.deepEqual(mergeLines(['a'], ['A', ' ', 'b', 'b']), { merged: ['a', 'b'], added: ['b'] });
});

/* ----------------------------------------------------------------- attendance calendar */

const row = (o: Partial<AttendanceRow>): AttendanceRow => ({ id: `r${Math.random()}`, suId: 'su1', attendanceDate: '2026-11-03', attendanceStatus: 'Present', ...o });
const TODAY = '2026-11-12';

test('the grid is Monday-first whole weeks and marks today and the future', () => {
  const days = buildMonth('2026-11', [], 'su1', TODAY);
  assert.equal(days.length % 7, 0);
  assert.equal(days[0].date, '2026-10-26');             // 1 Nov 2026 is a Sunday, so the first week starts Monday 26 Oct
  assert.equal(days[0].inMonth, false);
  assert.equal(days.find(d => d.date === '2026-11-12')!.isToday, true);
  assert.equal(days.find(d => d.date === '2026-11-13')!.isFuture, true);
  assert.equal(days.filter(d => d.inMonth).length, 30);
});

test('present, absent and no record; totals use recorded days only', () => {
  const rows = [row({ attendanceDate: '2026-11-02' }), row({ attendanceDate: '2026-11-03', attendanceStatus: 'Absent' }), row({ attendanceDate: '2026-11-04' }), row({ attendanceDate: '2026-11-05' })];
  const days = buildMonth('2026-11', rows, 'su1', TODAY);
  assert.equal(days.find(d => d.date === '2026-11-03')!.status, 'Absent');
  assert.equal(days.find(d => d.date === '2026-11-06')!.status, null);     // not recorded: not absent
  assert.deepEqual(summariseMonth(days), { recorded: 4, present: 3, absent: 1, percent: 75 });
  assert.equal(summariseMonth(buildMonth('2026-11', [], 'su1', TODAY)).percent, null);   // nothing recorded: no percentage
});

test('other service users and out-of-month records never count', () => {
  const rows = [row({ suId: 'other', attendanceDate: '2026-11-02', attendanceStatus: 'Absent' }), row({ attendanceDate: '2026-10-30' }), row({ attendanceDate: '2026-11-02' })];
  const s = summariseMonth(buildMonth('2026-11', rows, 'su1', TODAY));
  assert.deepEqual([s.recorded, s.present, s.absent], [1, 1, 0]);          // the 30 Oct record is outside the month total
});

test('a record in the future is not counted; an unknown status is ignored', () => {
  const rows = [row({ attendanceDate: '2026-11-20', attendanceStatus: 'Absent' }), row({ attendanceDate: '2026-11-02', attendanceStatus: 'Maybe' })];
  assert.equal(summariseMonth(buildMonth('2026-11', rows, 'su1', TODAY)).recorded, 0);
});

test('duplicates for one day resolve to the most recently updated record', () => {
  const rows = [row({ id: 'a', attendanceDate: '2026-11-02', attendanceStatus: 'Present', updatedAt: '2026-11-02T09:00:00Z' }), row({ id: 'b', attendanceDate: '2026-11-02', attendanceStatus: 'Absent', updatedAt: '2026-11-02T10:00:00Z' })];
  assert.equal(dailyRecords(rows, 'su1').get('2026-11-02')!.attendanceStatus, 'Absent');
  assert.equal(dailyRecords(rows, 'su1').size, 1);
});

test('a changed or removed record is reflected by the next build', () => {
  const before = [row({ id: 'a', attendanceDate: '2026-11-02' })];
  assert.equal(buildMonth('2026-11', before, 'su1', TODAY).find(d => d.date === '2026-11-02')!.status, 'Present');
  assert.equal(buildMonth('2026-11', [{ ...before[0], attendanceStatus: 'Absent' }], 'su1', TODAY).find(d => d.date === '2026-11-02')!.status, 'Absent');
  assert.equal(buildMonth('2026-11', [], 'su1', TODAY).find(d => d.date === '2026-11-02')!.status, null);
});

test('month navigation crosses year ends', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});
