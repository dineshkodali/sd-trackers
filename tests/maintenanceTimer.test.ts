import test from 'node:test';
import assert from 'node:assert/strict';
import { formatElapsed, closingTimer, overdueDuration, closeBlockedReason } from '../src/utils/maintenancePriority.ts';

const job = (over: any = {}) => ({
  date: '2026-11-10', reportedTime: '09:00', closeDueDate: '2026-11-10 13:00',
  defectStatus: 'In Process', action: 'Open', ...over
});
const closedJob = (date: string, time: string, over: any = {}) =>
  job({ defectStatus: 'Completed', action: 'Closed', actualClosedDate: date, actualClosedTime: time, ...over });

test('durations read as 2h 35m, 1d 4h, 3d 12h', () => {
  assert.equal(formatElapsed(0), '0m');
  assert.equal(formatElapsed(45), '45m');
  assert.equal(formatElapsed(155), '2h 35m');
  assert.equal(formatElapsed(180), '3h');
  assert.equal(formatElapsed(28 * 60), '1d 4h');
  assert.equal(formatElapsed(84 * 60), '3d 12h');
  assert.equal(formatElapsed(48 * 60), '2d');
});

test('a closed job shows the fixed time from report to closure', () => {
  const t = closingTimer(closedJob('2026-11-10', '11:35'));
  assert.equal(t.kind, 'closed');
  assert.equal(t.label, 'Closed in 2h 35m');
  assert.equal(closingTimer(closedJob('2026-11-11', '13:00')).label, 'Closed in 1d 4h');
  assert.equal(closingTimer(closedJob('2026-11-13', '21:00')).label, 'Closed in 3d 12h');
});

test('an open job shows time elapsed so far, labelled as open', () => {
  const t = closingTimer(job(), new Date('2026-11-10T14:00:00Z')); // 14:00 GMT
  assert.equal(t.kind, 'elapsed');
  assert.equal(t.label, 'Open 5h');
});

test('a closed job without a recorded time does not invent a duration', () => {
  const t = closingTimer(job({ defectStatus: 'Completed', actualClosedDate: '2026-11-10' }));
  assert.equal(t.kind, 'closed-no-time');
  assert.equal(t.minutes, null);
});

test('the timer follows London time (BST) and falls back to the creation time', () => {
  // created 23:30 UTC on 12 July = 00:30 BST on 13 July; now 02:30 UTC = 03:30 BST
  const t = closingTimer({ createdAt: '2026-07-12T23:30:00Z', defectStatus: 'In Process' }, new Date('2026-07-13T02:30:00Z'));
  assert.equal(t.label, 'Open 3h');
  assert.equal(closingTimer({}).kind, 'unknown');
});

test('overdue duration: open past Complete By, closed late, or nothing', () => {
  assert.equal(overdueDuration(job(), new Date('2026-11-10T15:40:00Z')).label, 'Overdue by 2h 40m');
  assert.equal(overdueDuration(job(), new Date('2026-11-10T12:00:00Z')).kind, 'none');
  assert.equal(overdueDuration(closedJob('2026-11-10', '13:40')).label, 'Late by 40m');
  assert.equal(overdueDuration(closedJob('2026-11-10', '12:00')).kind, 'none');
  assert.equal(overdueDuration(job({ closeDueDate: '' })).kind, 'none');
});

test('closing needs an after image, but only at the moment of closing', () => {
  const open = { defectStatus: 'In Process', action: 'Open' };
  const closed = { defectStatus: 'Completed', action: 'Closed' };
  assert.match(closeBlockedReason(open, closed)!, /After work/);
  assert.equal(closeBlockedReason(open, { ...closed, afterImages: [{ id: '1' }] }), null);
  assert.equal(closeBlockedReason(closed, closed), null);        // closed earlier: left alone
  assert.equal(closeBlockedReason(open, { ...open }), null);     // not closing
  assert.match(closeBlockedReason(open, { defectStatus: 'Completed', afterImages: [] })!, /After work/);
});
