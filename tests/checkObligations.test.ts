import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildObligations, toRows, summarise, monthWindows, normaliseSettings, allocateVisits, occupiedEnough,
  roomChecksToVisits, welfareChecksToVisits, lastDayOfMonth, previousMonth, DEFAULT_CHECK_SETTINGS,
  type CheckInput, type Visit
} from '../src/utils/checkObligations.ts';

const W = monthWindows('2026-11');
const v = (id: string, date: string, subjectId = 's', by = 'Staff'): Visit => ({ id, subjectId, date, completedBy: by });

/* ----------------------------------------------------------------- the rule itself */

test('two windows a month: 1st-10th and 11th-25th, from settings', () => {
  assert.deepEqual(W.map(w => [w.period, w.start, w.end, w.deadline]), [[1, '2026-11-01', '2026-11-10', '2026-11-10'], [2, '2026-11-11', '2026-11-25', '2026-11-25']]);
  const custom = monthWindows('2026-02', { ...DEFAULT_CHECK_SETTINGS, firstDeadlineDay: 14, secondDeadlineDay: 27 });
  assert.equal(custom[0].deadline, '2026-02-14'); assert.equal(custom[1].start, '2026-02-15'); assert.equal(custom[1].deadline, '2026-02-27');
});

test('settings that make no sense fall back to the defaults', () => {
  assert.deepEqual(normaliseSettings(null), DEFAULT_CHECK_SETTINGS);
  assert.deepEqual(normaliseSettings({ firstDeadlineDay: 30, secondDeadlineDay: 5, minOccupiedDays: 0 }), DEFAULT_CHECK_SETTINGS);
  assert.equal(normaliseSettings({ firstDeadlineDay: 12, secondDeadlineDay: 28 }).secondDeadlineDay, 28);
});

test('a visit on the deadline day is on time (inclusive)', () => {
  const [a] = allocateVisits(W, [true, true], [v('1', '2026-11-10')]);
  assert.equal(a?.onTime, true);
  const [, b] = allocateVisits(W, [true, true], [v('2', '2026-11-25')]);
  assert.equal(b?.onTime, true);
});

test('completing the first check does not complete the second', () => {
  const r = allocateVisits(W, [true, true], [v('1', '2026-11-08')]);
  assert.equal(r[0]?.visit.id, '1'); assert.equal(r[1], null);
});

test('two visits in the same window cannot both count', () => {
  const r = allocateVisits(W, [true, true], [v('1', '2026-11-03'), v('2', '2026-11-08')]);
  assert.equal(r[0]?.visit.id, '1');
  assert.equal(r[1], null);                                  // the second visit in window 1 is surplus
});

test('a visit in window 2 does not stand in for a missed first check', () => {
  const r = allocateVisits(W, [true, true], [v('1', '2026-11-20')]);
  assert.equal(r[0], null); assert.equal(r[1]?.visit.id, '1'); assert.equal(r[1]?.onTime, true);
});

test('a late visit completes the earliest open check late', () => {
  const r = allocateVisits(W, [true, true], [v('1', '2026-11-27')]);
  assert.equal(r[0]?.visit.id, '1'); assert.equal(r[0]?.onTime, false);
  assert.equal(r[1], null);
  const second = allocateVisits(W, [true, true], [v('a', '2026-11-05'), v('b', '2026-11-27')]);
  assert.equal(second[0]?.onTime, true);
  assert.equal(second[1]?.visit.id, 'b'); assert.equal(second[1]?.onTime, false);
});

test('allocation does not depend on the order visits arrive in', () => {
  const list = [v('1', '2026-11-03'), v('2', '2026-11-20'), v('3', '2026-11-28')];
  const a = allocateVisits(W, [true, true], list);
  const b = allocateVisits(W, [true, true], [...list].reverse());
  assert.deepEqual(a, b);
});

test('a window that is not required takes no visit', () => {
  const r = allocateVisits(W, [false, true], [v('1', '2026-11-05'), v('2', '2026-11-20')]);
  assert.equal(r[0], null); assert.equal(r[1]?.visit.id, '2');
});

test('occupancy: enough days in the window, overlaps counted once', () => {
  assert.equal(occupiedEnough([{ start: '2026-10-01', end: null }], W[0], 3), true);
  assert.equal(occupiedEnough([{ start: '2026-11-09', end: null }], W[0], 3), false);   // 9th and 10th only
  assert.equal(occupiedEnough([{ start: '2026-11-08', end: null }], W[0], 3), true);    // 8th, 9th, 10th
  assert.equal(occupiedEnough([{ start: '2026-10-01', end: '2026-11-02' }], W[0], 3), false);
  // two people sharing a room on the same two days count two days, not four
  assert.equal(occupiedEnough([{ start: '2026-11-01', end: '2026-11-02' }, { start: '2026-11-01', end: '2026-11-02' }], W[0], 3), false);
  // back to back placements add up
  assert.equal(occupiedEnough([{ start: '2026-11-01', end: '2026-11-02' }, { start: '2026-11-03', end: '2026-11-04' }], W[0], 3), true);
});

/* ----------------------------------------------------------------- the scenario from the brief */

function estate(extra: Partial<CheckInput> = {}): CheckInput {
  return {
    sites: [{ id: 'site-1', name: 'Brit Hotel', managerName: 'Pat Manager', leadOfficer: 'Lee Lead' }],
    properties: [{ id: 'p1', propertyName: 'Block A', siteId: 'site-1', propertyManager: 'Staff A' }] as any,
    rooms: [
      { id: 'r401', propertyId: 'p1', roomNumber: '401', status: 'Available' },
      { id: 'r402', propertyId: 'p1', roomNumber: '402', status: 'Available' },
      { id: 'r403', propertyId: 'p1', roomNumber: '403', status: 'Available' },
      { id: 'r404', propertyId: 'p1', roomNumber: '404', status: 'Void' },          // out of use: owes nothing
      { id: 'r405', propertyId: 'p1', roomNumber: '405', status: 'Available' }       // empty: owes nothing
    ] as any,
    serviceUsers: [
      { id: 'su1', firstName: 'Amina', lastName: 'Khan', externalReference: 'PR-1', suReference: 'SU-1', status: 'Active' },
      { id: 'su2', firstName: 'Ben', lastName: 'Ode', externalReference: 'PR-2', suReference: 'SU-2', status: 'Active' }
    ] as any,
    placements: [
      { id: 'pl1', suId: 'su1', siteId: 'site-1', propertyId: 'p1', roomId: 'r401', status: 'Active', startDate: '2026-09-01' },
      { id: 'pl2', suId: 'su2', siteId: 'site-1', propertyId: 'p1', roomId: 'r402', status: 'Active', startDate: '2026-09-01' },
      { id: 'pl3', suId: 'su3', siteId: 'site-1', propertyId: 'p1', roomId: 'r403', status: 'Active', startDate: '2026-09-01' }
    ] as any,
    roomVisits: [
      v('c401a', '2026-11-08', 'r401', 'Officer One'),
      v('c402a', '2026-11-05', 'r402', 'Officer Two'),
      v('c402b', '2026-11-22', 'r402', 'Officer Two')
    ],
    welfareVisits: [],
    ...extra
  };
}
const AFTER_25TH = new Date('2026-11-26T12:00:00Z');
const row = (rows: ReturnType<typeof toRows>, room: string) => rows.find(r => r.roomNumber === room)!;

test('Room 401 done once, 402 done twice, 403 never: statuses after the 25th', () => {
  const { obligations } = buildObligations(estate(), '2026-11', 'room', AFTER_25TH);
  const rows = toRows(obligations);
  assert.equal(rows.length, 3);                               // 404 (void) and 405 (empty) are not listed
  const r401 = row(rows, '401'), r402 = row(rows, '402'), r403 = row(rows, '403');
  assert.deepEqual([r401.first!.status, r401.second!.status, r401.overall], ['completed', 'overdue', 'incomplete']);
  assert.deepEqual([r402.first!.status, r402.second!.status, r402.overall], ['completed', 'completed', 'complete']);
  assert.deepEqual([r403.first!.status, r403.second!.status, r403.overall], ['overdue', 'overdue', 'incomplete']);
  assert.equal(r401.first!.visitDate, '2026-11-08');
  assert.equal(r401.first!.completedBy, 'Officer One');
  assert.equal(r401.second!.daysLate, 1);                     // 26th, one day past the 25th
  assert.equal(r401.responsible.name, 'Staff A');
  assert.equal(r401.responsible.source, 'property manager');
});

test('the same data earlier in the month: the second check is still pending', () => {
  const rows = toRows(buildObligations(estate(), '2026-11', 'room', new Date('2026-11-12T12:00:00Z')).obligations);
  assert.equal(row(rows, '401').second!.status, 'pending');
  assert.equal(row(rows, '403').first!.status, 'overdue');    // the 10th has passed
  assert.equal(row(rows, '403').second!.status, 'pending');
});

test('on the deadline day itself nothing is overdue yet', () => {
  const rows = toRows(buildObligations(estate(), '2026-11', 'room', new Date('2026-11-10T20:00:00Z')).obligations);
  assert.equal(row(rows, '403').first!.status, 'pending');
  const next = toRows(buildObligations(estate(), '2026-11', 'room', new Date('2026-11-11T00:30:00Z')).obligations);
  assert.equal(row(next, '403').first!.status, 'overdue');
});

test('totals count each obligation separately, never a combined monthly figure', () => {
  const t = summarise(buildObligations(estate(), '2026-11', 'room', AFTER_25TH).obligations);
  assert.deepEqual([t.required, t.completed, t.completedLate, t.pending, t.overdue], [6, 3, 0, 0, 3]);
  assert.equal(t.completionPct, 50);
});

test('welfare checks work per resident, with the same two deadlines', () => {
  const input = estate({ welfareVisits: [v('w1', '2026-11-04', 'su1', 'Keyworker'), v('w2', '2026-11-18', 'su1', 'Keyworker')] });
  const rows = toRows(buildObligations(input, '2026-11', 'welfare', AFTER_25TH).obligations);
  const su1 = rows.find(r => r.suId === 'su1')!;
  assert.deepEqual([su1.first!.status, su1.second!.status, su1.overall], ['completed', 'completed', 'complete']);
  const su2 = rows.find(r => r.suId === 'su2')!;
  assert.deepEqual([su2.first!.status, su2.second!.status], ['overdue', 'overdue']);
  assert.equal(rows.some(r => r.suId === 'su3'), false);      // su3 has a placement but no resident record: not invented
});

test('history: a past month is worked out from placements that existed then, and missed checks stay missed', () => {
  const input = estate({
    placements: [
      { id: 'a', suId: 'su1', siteId: 'site-1', propertyId: 'p1', roomId: 'r401', status: 'Completed', startDate: '2026-05-01', endDate: '2026-08-20' },
      { id: 'b', suId: 'su2', siteId: 'site-1', propertyId: 'p1', roomId: 'r401', status: 'Active', startDate: '2026-08-25' }
    ] as any,
    roomVisits: [v('x', '2026-08-02', 'r401')]
  });
  const aug = toRows(buildObligations(input, '2026-08', 'room', AFTER_25TH).obligations);
  assert.equal(aug.length, 1);
  assert.equal(aug[0].first!.status, 'completed');
  assert.equal(aug[0].second!.status, 'overdue');              // never done: reported as missed, not invented as done
  const jun = buildObligations(input, '2026-06', 'room', AFTER_25TH).obligations;
  assert.equal(jun.filter(o => o.status === 'overdue').length, 2);
  const mar = buildObligations(input, '2026-03', 'room', AFTER_25TH).obligations;
  assert.equal(mar.length, 0);                                 // room was not occupied
});

test('a month that has not started has no obligations', () => {
  assert.equal(buildObligations(estate(), '2026-12', 'room', AFTER_25TH).obligations.length, 0);
});

test('someone who arrives late in a window does not owe that window', () => {
  const input = estate({ placements: [{ id: 'n', suId: 'su1', siteId: 'site-1', propertyId: 'p1', roomId: 'r401', status: 'Active', startDate: '2026-11-09' }] as any, roomVisits: [] });
  const o = buildObligations(input, '2026-11', 'room', AFTER_25TH).obligations;
  assert.deepEqual(o.map(x => x.period), [2]);                 // 9th-10th is only 2 days
});

test('responsibility falls back: property manager, site lead officer, site manager, then nobody', () => {
  const noPm = estate({ properties: [{ id: 'p1', propertyName: 'Block A', siteId: 'site-1' }] as any });
  assert.deepEqual(toRows(buildObligations(noPm, '2026-11', 'room', AFTER_25TH).obligations)[0].responsible, { name: 'Lee Lead', source: 'site lead officer' });
  const noLead = estate({ properties: [{ id: 'p1', propertyName: 'Block A', siteId: 'site-1' }] as any, sites: [{ id: 'site-1', name: 'Brit Hotel', managerName: 'Pat Manager', leadOfficer: 'Unassigned' }] });
  assert.equal(toRows(buildObligations(noLead, '2026-11', 'room', AFTER_25TH).obligations)[0].responsible.source, 'site manager');
  const nobody = estate({ properties: [{ id: 'p1', propertyName: 'Block A', siteId: 'site-1' }] as any, sites: [{ id: 'site-1', name: 'Brit Hotel' }] });
  assert.deepEqual(toRows(buildObligations(nobody, '2026-11', 'room', AFTER_25TH).obligations)[0].responsible, { name: '', source: 'none' });
});

/* ----------------------------------------------------------------- matching stored checks to rooms and residents */

test('room checks match by room id, else by a single site + room number; the rest are reported, not guessed', () => {
  const i = estate();
  const { visits, unmatched } = roomChecksToVisits([
    { id: 'k1', roomId: 'r401', inspectionDate: '2026-11-08', officerName: 'A' },
    { id: 'k2', roomNumber: 'Room 402', siteName: 'Brit Hotel', inspectionDate: '2026-11-09', officerName: 'B' },
    { id: 'k3', roomNumber: '999', siteName: 'Brit Hotel', inspectionDate: '2026-11-09' },
    { id: 'k4', roomNumber: '401', siteName: 'Brit Hotel', inspectionDate: 'next week' }
  ], i.rooms, i.properties, i.sites);
  assert.deepEqual(visits.map(x => [x.id, x.subjectId]), [['k1', 'r401'], ['k2', 'r402']]);
  assert.deepEqual(unmatched.map(x => x.id).sort(), ['k3', 'k4']);
});

test('a room number shared by two properties is not guessed', () => {
  const rooms = [{ id: 'a', propertyId: 'p1', roomNumber: '7' }, { id: 'b', propertyId: 'p2', roomNumber: '7' }] as any;
  const props = [{ id: 'p1', siteId: 'site-1' }, { id: 'p2', siteId: 'site-1' }] as any;
  const r = roomChecksToVisits([{ id: 'k', roomNumber: '7', siteName: 'Brit Hotel', inspectionDate: '2026-11-02' }], rooms, props, [{ id: 'site-1', name: 'Brit Hotel' }]);
  assert.equal(r.visits.length, 0); assert.equal(r.unmatched.length, 1);
});

test('welfare checks match by resident id, else by a unique reference; timestamps become London dates', () => {
  const sus = estate().serviceUsers;
  const { visits, unmatched } = welfareChecksToVisits([
    { id: 'w1', suId: 'su1', checkDatetime: '2026-11-04T09:30:00Z', officerName: 'K' },
    { id: 'w2', portReference: 'pr-2', checkDatetime: '2026-07-12T23:30:00Z' },       // 00:30 BST on 13 July
    { id: 'w3', portReference: 'PR-404', checkDatetime: '2026-11-04T09:30:00Z' }
  ], sus);
  assert.deepEqual(visits.map(x => [x.id, x.subjectId, x.date]), [['w1', 'su1', '2026-11-04'], ['w2', 'su2', '2026-07-13']]);
  assert.deepEqual(unmatched.map(x => x.id), ['w3']);
});

test('unmatched checks in a month are surfaced with the result', () => {
  const input = estate({ roomVisits: [...estate().roomVisits, v('ghost', '2026-11-05', 'no-such-room')] });
  const res = buildObligations(input, '2026-11', 'room', AFTER_25TH);
  assert.deepEqual(res.unmatched.map(u => u.id), ['ghost']);
});

test('month helpers', () => {
  assert.equal(lastDayOfMonth('2026-02'), '2026-02-28');
  assert.equal(lastDayOfMonth('2028-02'), '2028-02-29');
  assert.equal(previousMonth('2026-01'), '2025-12');
});

/* ----------------------------------------------------------------- who is in the room */

test('an occupied room shows its current resident, not "vacant"', () => {
  const rows = toRows(buildObligations(estate(), '2026-11', 'room', AFTER_25TH).obligations);
  const r401 = rows.find(r => r.roomNumber === '401')!;
  assert.equal(r401.occupancy, 'occupied');
  assert.equal(r401.suName, 'Amina Khan');
  assert.equal(r401.suReference, 'PR-1');
  assert.equal(r401.suId, 'su1');
  // a placement whose resident record does not exist yields no invented name
  const r403 = rows.find(r => r.roomNumber === '403')!;
  assert.equal(r403.occupancy, 'occupied');
  assert.equal(r403.suName, '');
});

test('a shared room lists every resident in it', () => {
  const input = estate({
    placements: [
      { id: 'a', suId: 'su1', siteId: 'site-1', propertyId: 'p1', roomId: 'r401', status: 'Active', startDate: '2026-09-01' },
      { id: 'b', suId: 'su2', siteId: 'site-1', propertyId: 'p1', roomId: 'r401', status: 'Active', startDate: '2026-10-01' }
    ] as any
  });
  const r = toRows(buildObligations(input, '2026-11', 'room', AFTER_25TH).obligations)[0];
  assert.equal(r.suName, 'Amina Khan, Ben Ode');
  assert.equal(r.suReference, 'PR-1, PR-2');
});

test('a room emptied mid-month is "vacated" and names the last resident, not a later one', () => {
  const input = estate({
    placements: [{ id: 'a', suId: 'su1', siteId: 'site-1', propertyId: 'p1', roomId: 'r401', status: 'Completed', startDate: '2026-09-01', endDate: '2026-11-14' }] as any
  });
  const r = toRows(buildObligations(input, '2026-11', 'room', AFTER_25TH).obligations)[0];
  assert.equal(r.occupancy, 'vacated');
  assert.equal(r.vacatedOn, '2026-11-14');
  assert.equal(r.suName, 'Amina Khan');
});

test('history: a past month names who was there then, not who is there now', () => {
  const input = estate({
    placements: [
      { id: 'old', suId: 'su1', siteId: 'site-1', propertyId: 'p1', roomId: 'r401', status: 'Completed', startDate: '2026-05-01', endDate: '2026-08-20' },
      { id: 'new', suId: 'su2', siteId: 'site-1', propertyId: 'p1', roomId: 'r401', status: 'Active', startDate: '2026-08-25' }
    ] as any,
    roomVisits: []
  });
  const jul = toRows(buildObligations(input, '2026-07', 'room', AFTER_25TH).obligations)[0];
  assert.equal(jul.suName, 'Amina Khan');
  const nov = toRows(buildObligations(input, '2026-11', 'room', AFTER_25TH).obligations)[0];
  assert.equal(nov.suName, 'Ben Ode');
});
