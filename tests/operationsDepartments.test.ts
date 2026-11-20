import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFlexDate, selectFlowCounts, selectDepartmentRows, monitorChecks, listOverdueChecks, selectMaintenanceOverview,
  selectSiteFlowRows, checkCounts, type DeptInput, type DeptScope, type DeptKey
} from '../src/utils/operationsDepartments.ts';
import type { CheckRow, CheckObligation } from '../src/utils/checkObligations.ts';

const NOW = new Date('2026-11-12T10:00:00Z'); // 12 Nov 2026, GMT
const TODAY = '2026-11-12';
const SITES = [{ id: 'site-1', name: 'Brit Hotel' }, { id: 'site-2', name: 'Atlantic BW' }];
const ALL: DeptScope = { allowedSiteIds: 'all', siteId: 'all' };
const PERIOD = { from: '2026-11-06', to: '2026-11-12' };
const allVisible = Object.fromEntries((['newArrivals', 'dispersals', 'evictions', 'roomChecks', 'welfareChecks', 'maintenance', 'laundry', 'escalations'] as DeptKey[]).map(k => [k, true])) as Record<DeptKey, boolean>;

const arrival = (hotel: string, checkInDate?: string): any => ({ id: `a-${hotel}-${checkInDate}`, hotel, checkInDate, name: 'x', portReference: 'p' });
const dispersal = (siteName: string, o: Record<string, string> = {}): any => ({ id: `d-${siteName}-${JSON.stringify(o)}`, siteName, dispersalDate: '', travelled: 'No', dateLeftProperty: '', secondDispersalDate: '', secondDispersalTravelled: 'No', secondDateLeftProperty: '', ...o });
const eviction = (hotel: string, status: string, evictionDate: string): any => ({ id: `e-${hotel}-${status}-${evictionDate}`, hotel, status, evictionDate });
const maint = (o: Record<string, any>): any => ({ id: 'm1', site: 'Brit Hotel', priority: 'CAT 2', date: '2026-11-10', description: 'x', closeDueDate: '2026-11-20', defectStatus: 'In Process', action: 'Open', ...o });

const ob = (status: CheckObligation['status'], period: 1 | 2, extra: Partial<CheckObligation> = {}): CheckObligation => ({
  key: `k${period}${status}${extra.roomNumber || ''}`, type: 'room', month: '2026-11', period, deadline: period === 1 ? '2026-11-10' : '2026-11-25', status,
  siteId: 'site-1', siteName: 'Brit Hotel', propertyId: 'p', propertyName: 'Prop', roomId: 'r', roomNumber: '1', suId: '', suName: 'Ann', suReference: '',
  responsible: { name: 'Lee', source: 'property manager' }, visitDate: null, completedBy: '', visitId: null, daysLate: status === 'overdue' ? 2 : null, ...extra
});
const row = (first: CheckObligation | null, second: CheckObligation | null, siteId = 'site-1'): CheckRow => ({
  subjectKey: 's', type: 'room', siteId, siteName: 'Brit Hotel', propertyName: 'Prop', roomNumber: '1', suId: '', suName: 'Ann', suReference: '',
  responsible: { name: 'Lee', source: 'property manager' }, first, second, overall: 'incomplete'
});

const baseInput = (over: Partial<DeptInput> = {}): DeptInput => ({
  sites: SITES, newArrivals: [], dispersals: [], evictions: [], maintenance: [], laundry: [], escalations: [], roomRows: [], welfareRows: [], visible: allVisible, ...over
});

test('flexible dates: ISO and strict MM/DD/YYYY only', () => {
  assert.equal(parseFlexDate('2026-11-12'), '2026-11-12');
  assert.equal(parseFlexDate('11/12/2026'), '2026-11-12');
  assert.equal(parseFlexDate('1/2/2026'), '2026-01-02');
  assert.equal(parseFlexDate('13/12/2026'), null);   // would be day-first: rejected, never guessed
  assert.equal(parseFlexDate('02/30/2026'), null);
  assert.equal(parseFlexDate(''), null);
  assert.equal(parseFlexDate('tomorrow'), null);
});

test('new arrivals and dispersals today vs yesterday, per site scope', () => {
  const input = baseInput({
    newArrivals: [arrival('Brit Hotel', TODAY), arrival('Brit Hotel', TODAY), arrival('Atlantic BW', TODAY), arrival('Brit Hotel', '2026-11-11'), arrival('Nowhere', TODAY)],
    dispersals: [dispersal('Brit Hotel', { dispersalDate: '11/12/2026' }), dispersal('Brit Hotel', { dispersalDate: '11/11/2026' })]
  });
  const all = selectFlowCounts(input, ALL, TODAY);
  assert.deepEqual(all.newArrivals, { today: 3, yesterday: 1 });   // 'Nowhere' matches no site and is excluded
  assert.deepEqual(all.dispersals, { today: 1, yesterday: 1 });
  const one = selectFlowCounts(input, { allowedSiteIds: 'all', siteId: 'site-2' }, TODAY);
  assert.deepEqual(one.newArrivals, { today: 1, yesterday: 0 });
  const restricted = selectFlowCounts(input, { allowedSiteIds: new Set(['site-2']), siteId: 'all' }, TODAY);
  assert.equal(restricted.newArrivals.today, 1);                   // a user cannot reach a site outside their allowance
});

test('dispersal rows: pending, due today, overdue, completed; second cycle supersedes the first', () => {
  const input = baseInput({
    dispersals: [
      dispersal('Brit Hotel', { dispersalDate: '11/20/2026' }),                                            // pending
      dispersal('Brit Hotel', { dispersalDate: '11/12/2026' }),                                            // due today
      dispersal('Brit Hotel', { dispersalDate: '11/05/2026' }),                                            // overdue
      dispersal('Brit Hotel', { dispersalDate: '11/10/2026', travelled: 'Yes' }),                          // completed in period
      dispersal('Brit Hotel', { dispersalDate: '10/01/2026', travelled: 'Yes' }),                          // completed long ago
      dispersal('Brit Hotel', { dispersalDate: '10/01/2026', travelled: 'No', secondDispersalDate: '11/25/2026' }), // retry scheduled: pending, not overdue
      dispersal('Brit Hotel', { dispersalDate: 'garbage' })                                                // unreadable: excluded from date figures
    ]
  });
  const r = selectDepartmentRows(input, ALL, PERIOD, NOW).find(x => x.key === 'dispersals')!;
  assert.equal(r.pending, 2);
  assert.equal(r.dueToday, 1);
  assert.equal(r.overdue, 1);
  assert.equal(r.completed, 1);
  assert.equal(r.total, 5);    // open with a readable date (4) + completed in period (1)
});

test('evictions: only Notice Issued can be overdue; Appeal Pending is in progress; Cancelled never counts', () => {
  const input = baseInput({
    evictions: [
      eviction('Brit Hotel', 'Notice Issued', '2026-11-05'), eviction('Brit Hotel', 'Notice Issued', '2026-11-12'), eviction('Brit Hotel', 'Notice Issued', '2026-11-30'),
      eviction('Brit Hotel', 'Appeal Pending', '2026-11-01'), eviction('Brit Hotel', 'Evicted', '2026-11-09'), eviction('Brit Hotel', 'Cancelled', '2026-11-12')
    ]
  });
  const r = selectDepartmentRows(input, ALL, PERIOD, NOW).find(x => x.key === 'evictions')!;
  assert.equal(r.overdue, 1);
  assert.equal(r.dueToday, 1);
  assert.equal(r.pending, 1);       // issued and not yet due (due today is counted separately)
  assert.equal(r.total, r.overdue! + r.dueToday! + r.pending! + r.inProgress! + r.completed!);   // the buckets add up to the total
  assert.equal(r.inProgress, 1);
  assert.equal(r.completed, 1);
  assert.equal(selectFlowCounts(input, ALL, TODAY).evictions.today, 1);   // the cancelled one is not an eviction today
});

test('a module the user cannot see is not computed at all', () => {
  const rows = selectDepartmentRows(baseInput({ visible: { ...allVisible, maintenance: false, evictions: false } }), ALL, PERIOD, NOW);
  assert.ok(!rows.some(r => r.key === 'maintenance' || r.key === 'evictions'));
});

test('maintenance row: open, overdue, due today, completed in period', () => {
  const input = baseInput({
    maintenance: [
      maint({ id: 'a', closeDueDate: '2026-11-12 09:00' }),                                  // overdue (09:00 < 10:00)
      maint({ id: 'b', closeDueDate: '2026-11-12 23:00' }),                                  // due today
      maint({ id: 'c', closeDueDate: '2026-11-30' }),                                        // open, future
      maint({ id: 'd', defectStatus: 'Completed', action: 'Closed', actualClosedDate: '2026-11-11' }),  // completed in period
      maint({ id: 'e', defectStatus: 'Completed', action: 'Closed', actualClosedDate: '2026-09-01' }),  // completed, out of period
      maint({ id: 'f', site: 'Atlantic BW' })
    ]
  });
  const r = selectDepartmentRows(input, ALL, PERIOD, NOW).find(x => x.key === 'maintenance')!;
  assert.deepEqual([r.total, r.overdue, r.dueToday, r.completed], [4, 1, 1, 1]);
  const scoped = selectDepartmentRows(input, { allowedSiteIds: 'all', siteId: 'site-2' }, PERIOD, NOW).find(x => x.key === 'maintenance')!;
  assert.equal(scoped.total, 1);
});

test('maintenance overview: new today, completed today, average completion time only from jobs with both timestamps', () => {
  const records = [
    maint({ id: 'a', date: TODAY, closeDueDate: '2026-11-13' }),
    maint({ id: 'b', date: '2026-11-11', reportedTime: '08:00', defectStatus: 'Completed', action: 'Closed', actualClosedDate: TODAY, actualClosedTime: '10:00' }), // 26 h
    maint({ id: 'c', date: '2026-11-11', defectStatus: 'Completed', action: 'Closed', actualClosedDate: '2026-11-11', actualClosedTime: '18:00' }),       // 18:00 - 23:59? no: date only reported -> end of day, negative -> ignored
    maint({ id: 'd', date: '2026-11-01', closeDueDate: '2026-11-05' })
  ];
  const { overview, rows } = selectMaintenanceOverview(records, SITES, ALL, PERIOD, NOW);
  assert.equal(overview.open, 2);
  assert.equal(overview.newToday, 1);
  assert.equal(overview.completedToday, 1);
  assert.equal(overview.overdue, 1);
  assert.equal(overview.inProgress, 1);
  assert.equal(overview.avgCompletionHours, 26);
  assert.equal(overview.avgSampleSize, 1);
  assert.equal(rows[0].id, 'd');                                      // overdue first
  const none = selectMaintenanceOverview([], SITES, ALL, PERIOD, NOW).overview;
  assert.equal(none.avgCompletionHours, null);                        // no data is "not available", not zero hours
});

test('check monitoring: per-period counts and n/2 ratios', () => {
  const rows = [
    row(ob('completed', 1), ob('completed', 2)),
    row(ob('completed', 1), ob('pending', 2)),
    row(ob('overdue', 1), ob('pending', 2)),
    row(ob('completed_late', 1), ob('overdue', 2)),
    row(ob('pending', 1), null)
  ];
  const m = monitorChecks(rows);
  assert.equal(m.eligible, 5);
  assert.deepEqual(m.first, { completed: 3, pending: 1, overdue: 1 });
  assert.deepEqual(m.second, { completed: 1, pending: 2, overdue: 1 });
  assert.deepEqual(m.ratio, { none: 2, one: 2, both: 1 });
  assert.equal(monitorChecks([]).eligible, 0);
});

test('overdue check list is built only from obligations that owe a check, oldest deadline first', () => {
  const list = listOverdueChecks(
    [row(ob('overdue', 2, { roomNumber: '7' }), null), row(ob('overdue', 1, { roomNumber: '5' }), ob('completed', 2))],
    [row(ob('pending', 1), ob('pending', 2))]
  );
  assert.equal(list.length, 2);
  assert.equal(list[0].period, 'First (by the 10th)');
  assert.equal(list[0].assignedTo, 'Lee');
  assert.equal(list[1].dueDate, '2026-11-25');
});

test('check counts: due today is a pending check whose deadline is today', () => {
  const rows = [row(ob('pending', 1, { deadline: TODAY }), ob('pending', 2))];
  const c = checkCounts(rows, TODAY);
  assert.deepEqual(c, { total: 2, completed: 0, pending: 2, overdue: 0, dueToday: 1 });
});

test('site flow rows only count what is in scope', () => {
  const input = baseInput({
    newArrivals: [arrival('Brit Hotel', TODAY), arrival('Atlantic BW', TODAY)],
    dispersals: [dispersal('Brit Hotel', { dispersalDate: '11/05/2026' }), dispersal('Brit Hotel', { dispersalDate: '11/12/2026' })],
    evictions: [eviction('Brit Hotel', 'Notice Issued', '2026-11-01')]
  });
  const map = selectSiteFlowRows(input, [row(ob('overdue', 1), ob('overdue', 2))], [], ALL, TODAY);
  const b = map.get('site-1')!;
  assert.deepEqual([b.newArrivalsToday, b.dispersalsToday, b.dispersalsOverdue, b.evictionsOverdue, b.overdueChecks], [1, 1, 1, 1, 2]);
  assert.equal(map.get('site-2')!.newArrivalsToday, 1);
  const only2 = selectSiteFlowRows(input, [], [], { allowedSiteIds: new Set(['site-2']), siteId: 'all' }, TODAY);
  assert.equal(only2.has('site-1'), false);
});

import { selectResidentProfile } from '../src/utils/operationsDepartments.ts';

test('resident profile counts only active residents placed at in-scope sites, and carries no identities', () => {
  const su = (id: string, o: Record<string, string> = {}) => ({ id, status: 'Active', ...o });
  const input = {
    sites: SITES,
    serviceUsers: [
      su('a', { vulnerable: 'Yes', disabilityCategory: 'Mobility', personalEvacuationPlan: 'PEEP – Personal Emergency Evacuation Plan' }),
      su('b', { vulnerable: 'No', disabilityCategory: 'None', personalEvacuationPlan: 'GEEP – General Emergency Evacuation Plan' }),
      su('c', { disabilityType: 'Hearing' }),                       // no plan recorded
      su('d', { status: 'Discharged', vulnerable: 'Yes' }),        // not active
      su('e', { vulnerable: 'Yes' }),                               // placed at another site
      su('f', { vulnerable: 'Yes' })                                // no placement at all
    ],
    placements: [
      { suId: 'a', siteId: 'site-1', status: 'Active' }, { suId: 'b', siteId: 'Brit Hotel', status: 'Active' }, { suId: 'c', siteId: 'site-1', status: 'Active' },
      { suId: 'd', siteId: 'site-1', status: 'Active' }, { suId: 'e', siteId: 'site-2', status: 'Active' }, { suId: 'f', siteId: 'site-1', status: 'Completed' }
    ],
    registerRooms: [
      { hotel: 'Brit Hotel', roomCategory: 'Interconnecting', interconnectGroup: 'g1' }, { hotel: 'Brit Hotel', roomCategory: 'Interconnecting', interconnectGroup: 'g1' },
      { hotel: 'Brit Hotel', roomCategory: 'Standard' }, { hotel: 'Atlantic BW', roomCategory: 'Interconnecting', interconnectGroup: 'g1' }
    ]
  };
  const p = selectResidentProfile(input, { allowedSiteIds: 'all', siteId: 'site-1' });
  assert.deepEqual(p, { activeResidents: 3, vulnerable: 1, disabilities: 2, peep: 1, geep: 1, noEvacuationPlan: 1, interconnectingRooms: 2, interconnectGroups: 1 });
  assert.equal(selectResidentProfile(input, ALL).activeResidents, 4);                       // same group id at another site is a different group
  assert.equal(selectResidentProfile(input, ALL).interconnectGroups, 2);
  assert.equal(selectResidentProfile(input, { allowedSiteIds: new Set(), siteId: 'all' }).activeResidents, 0);
});
