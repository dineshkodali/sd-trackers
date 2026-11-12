import test from 'node:test';
import assert from 'node:assert/strict';
import { getSlaInfo, parseLocalDateTime, formatDuration, slaLabel } from '../src/utils/maintenancePriority.ts';
import { toDatabaseRow, londonLocalToIso } from '../server/schemaAdapter.ts';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);
const open = (closeDueDate: string) => ({ closeDueDate, defectStatus: 'In Process', action: 'Open' });

test('an open defect past its Complete By time is overdue', () => {
  const info = getSlaInfo(open('2026-11-07 16:30'), at(2026, 11, 7, 17, 0));
  assert.equal(info.state, 'overdue');
  assert.equal(slaLabel(info), 'Overdue by 30m');
});

test('an open defect is due soon inside 24 hours and on track beyond that', () => {
  assert.equal(getSlaInfo(open('2026-11-07 16:30'), at(2026, 11, 7, 10, 0)).state, 'due-soon');
  assert.equal(getSlaInfo(open('2026-11-20 16:30'), at(2026, 11, 7, 10, 0)).state, 'on-track');
});

test('the exact Complete By minute is not yet overdue', () => {
  assert.equal(getSlaInfo(open('2026-11-07 16:30'), at(2026, 11, 7, 16, 30)).state, 'due-soon');
});

test('a date with no time is due at the end of that day', () => {
  assert.equal(getSlaInfo(open('2026-09-04'), at(2026, 9, 4, 22, 0)).state, 'due-soon');
  assert.equal(getSlaInfo(open('2026-09-04'), at(2026, 9, 5, 0, 1)).state, 'overdue');
});

test('a defect with no or unreadable Complete By has no SLA state', () => {
  assert.equal(getSlaInfo(open(''), at(2026, 11, 7)).state, 'none');
  assert.equal(getSlaInfo(open('next week'), at(2026, 11, 7)).state, 'none');
  assert.equal(parseLocalDateTime('2026-02-31 10:00'), null);
});

test('closed with a time is compared to the minute', () => {
  const base = { closeDueDate: '2026-11-07 16:30', defectStatus: 'Completed', action: 'Closed', actualClosedDate: '2026-11-07' };
  assert.equal(getSlaInfo({ ...base, actualClosedTime: '16:00' }).state, 'completed-on-time');
  const late = getSlaInfo({ ...base, actualClosedTime: '18:30' });
  assert.equal(late.state, 'completed-late');
  assert.equal(slaLabel(late), 'Completed late by 2h');
});

test('closed with no time is only late when closed on a later day', () => {
  const base = { closeDueDate: '2026-11-07 09:00', defectStatus: 'Completed', action: 'Closed' };
  assert.equal(getSlaInfo({ ...base, actualClosedDate: '2026-11-07' }).state, 'completed-on-time');
  assert.equal(getSlaInfo({ ...base, actualClosedDate: '2026-11-09' }).state, 'completed-late');
});

test('a closed defect is never overdue, whatever the clock says', () => {
  const r = { closeDueDate: '2026-01-01 09:00', defectStatus: 'In Process', action: 'Closed', actualClosedDate: '2026-01-01' };
  assert.equal(getSlaInfo(r, at(2027, 1, 1)).state, 'completed-on-time');
  assert.equal(getSlaInfo({ closeDueDate: '2026-01-01 09:00', defectStatus: 'Completed' }, at(2027, 1, 1)).state, 'completed');
});

test('durations read naturally', () => {
  assert.equal(formatDuration(20 * 60000), '20m');
  assert.equal(formatDuration(-5 * 3600000), '5h');
  assert.equal(formatDuration(52 * 3600000), '2d 4h');
  assert.equal(formatDuration(48 * 3600000), '2d');
});

test('Complete By is stored as a London instant (GMT and BST)', () => {
  assert.equal(londonLocalToIso('2026-11-07 16:30'), '2026-11-07T16:30:00.000Z'); // GMT
  assert.equal(londonLocalToIso('2026-07-07 16:30'), '2026-07-07T15:30:00.000Z'); // BST
  assert.equal(londonLocalToIso('2026-09-04'), '2026-09-04T22:59:00.000Z');       // end of day, BST
  assert.equal(londonLocalToIso(''), null);
  assert.equal(londonLocalToIso('2026-13-40 10:00'), null);
});

test('the maintenance row carries complete_by and keeps the JSON copy', () => {
  const row = toDatabaseRow('maintenance_records', {
    id: 'm1', site: 'Brit Hotel', priority: 'CAT 2 - Interim', description: 'Leak',
    closeDueDate: '2026-11-07 16:30', defectStatus: 'In Process', action: 'Open'
  }, null);
  assert.equal(row.complete_by, '2026-11-07T16:30:00.000Z');
  assert.equal(JSON.parse(row.notes).closeDueDate, '2026-11-07 16:30');
});
