import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFlexDate, selectFlowCounts, type DeptScope } from '../src/utils/operationsDepartments.ts';

const TODAY = '2026-11-12';
const SITES = [{ id: 'site-1', name: 'Brit Hotel' }, { id: 'site-2', name: 'Atlantic BW' }];
const ALL: DeptScope = { allowedSiteIds: 'all', siteId: 'all' };
const arrival = (hotel: string, checkInDate?: string): any => ({ id: `a-${hotel}-${checkInDate}`, hotel, checkInDate, name: 'x', portReference: 'p' });
const dispersal = (siteName: string, o: Record<string, string> = {}): any => ({ id: `d-${siteName}-${JSON.stringify(o)}`, siteName, dispersalDate: '', travelled: 'No', dateLeftProperty: '', secondDispersalDate: '', secondDispersalTravelled: 'No', secondDateLeftProperty: '', ...o });
const _eviction = (hotel: string, status: string, evictionDate: string): any => ({ id: `e-${hotel}-${status}-${evictionDate}`, hotel, status, evictionDate });
const _maint = (o: Record<string, any>): any => ({ id: 'm1', site: 'Brit Hotel', priority: 'CAT 2', date: '2026-11-10', description: 'x', closeDueDate: '2026-11-20', defectStatus: 'In Process', action: 'Open', ...o });

const baseInput = (over: Record<string, unknown> = {}): any => ({ sites: SITES, newArrivals: [], dispersals: [], evictions: [], ...over });

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
