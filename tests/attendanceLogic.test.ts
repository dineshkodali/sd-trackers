import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currentAbsenceEpisode, followUpsToCreate, dayCounts, dedupeEntries, followUpKey,
  DEFAULT_ABSENCE_POLICY, addDays, isExpectedDay
} from '../src/utils/attendanceLogic.ts';

const e = (date: string, status: 'Present' | 'Absent', suId = 'su1', updatedAt = ''): any => ({ suId, date, status, updatedAt });
const run = (start: string, n: number, suId = 'su1') => Array.from({ length: n }, (_, i) => e(addDays(start, i), 'Absent', suId));

test('consecutive recorded absences are counted by date', () => {
  const ep = currentAbsenceEpisode('su1', run('2026-10-10', 3), '2026-10-12');
  assert.equal(ep?.days, 3);
  assert.equal(ep?.startDate, '2026-10-10');
  assert.deepEqual(ep?.thresholdsReached, [3]);
  assert.equal(ep?.nextThreshold, 7);
});

test('duplicate records do not inflate the count', () => {
  const dup = [...run('2026-10-10', 2), e('2026-10-11', 'Absent', 'su1', '2026-10-11T10:00')];
  assert.equal(dedupeEntries(dup).length, 2);
  assert.equal(currentAbsenceEpisode('su1', dup, '2026-10-11')?.days, 2);
});

test('a day with no record is not an absence and breaks the run', () => {
  const entries = [e('2026-10-10', 'Absent'), e('2026-10-12', 'Absent'), e('2026-10-13', 'Absent')];
  const ep = currentAbsenceEpisode('su1', entries, '2026-10-13');
  assert.equal(ep?.days, 2); // 12th and 13th only; the 11th was never confirmed
  assert.equal(ep?.startDate, '2026-10-12');
});

test('a recorded Present resets the run', () => {
  const entries = [...run('2026-10-10', 3), e('2026-10-13', 'Present'), e('2026-10-14', 'Absent')];
  const ep = currentAbsenceEpisode('su1', entries, '2026-10-14');
  assert.equal(ep?.days, 1);
  assert.equal(ep?.lastPresentDate, '2026-10-13');
  assert.equal(currentAbsenceEpisode('su1', [...run('2026-10-10', 3), e('2026-10-13', 'Present')], '2026-10-13'), null);
});

test('the 7-day threshold is reached after seven consecutive recorded days', () => {
  const ep6 = currentAbsenceEpisode('su1', run('2026-10-01', 6), '2026-10-06');
  const ep7 = currentAbsenceEpisode('su1', run('2026-10-01', 7), '2026-10-07');
  assert.deepEqual(ep6?.thresholdsReached, [3]);
  assert.deepEqual(ep7?.thresholdsReached, [3, 7]);
  assert.equal(ep7?.nextThreshold, null);
});

test('a configured schedule skips non-attendance days', () => {
  const policy = { ...DEFAULT_ABSENCE_POLICY, nonAttendanceWeekdays: [0, 6] };
  // Fri 9th, then Mon 12th, Tue 13th: weekend days are not expected, so the run is unbroken
  const entries = [e('2026-10-09', 'Absent'), e('2026-10-12', 'Absent'), e('2026-10-13', 'Absent')];
  assert.equal(currentAbsenceEpisode('su1', entries, '2026-10-13', policy)?.days, 3);
  assert.equal(isExpectedDay('2026-10-10', policy), false);
});

test('an episode is not current when later expected days are unconfirmed', () => {
  const ep = currentAbsenceEpisode('su1', run('2026-10-10', 3), '2026-10-15');
  assert.equal(ep?.days, 3);
  assert.equal(ep?.isCurrent, false);
});

test('follow-ups are created once per episode and threshold (idempotent)', () => {
  const entries = run('2026-10-01', 7);
  const first = followUpsToCreate(['su1'], entries, [], '2026-10-07');
  assert.deepEqual(first.map(f => f.thresholdDays), [3, 7]);
  const again = followUpsToCreate(['su1'], entries, first.map(f => ({ suId: f.suId, absenceStartDate: f.absenceStartDate, thresholdDays: f.thresholdDays })), '2026-10-07');
  assert.deepEqual(again, []);
  assert.equal(followUpKey('su1', '2026-10-01', 3), 'su1|2026-10-01|3');
});

test('a new episode after a break gets its own follow-up', () => {
  const entries = [...run('2026-10-01', 3), e('2026-10-04', 'Present'), ...run('2026-10-10', 3)];
  const existing = [{ suId: 'su1', absenceStartDate: '2026-10-01', thresholdDays: 3 }];
  const out = followUpsToCreate(['su1'], entries, existing, '2026-10-12');
  assert.deepEqual(out.map(f => `${f.absenceStartDate}/${f.thresholdDays}`), ['2026-10-10/3']);
});

test('day counts separate present, absent and not recorded', () => {
  const entries = [e('2026-10-10', 'Present', 'a'), e('2026-10-10', 'Absent', 'b')];
  assert.deepEqual(dayCounts(['a', 'b', 'c'], entries, '2026-10-10'), { present: 1, absent: 1, notRecorded: 1 });
});
