import test from 'node:test';
import assert from 'node:assert/strict';
import { RECORD_TABS, selectRecordTab } from '../src/utils/operationsRecords.ts';
import { readProfileCache, writeProfileCache, clearProfileCache, loadPrefs, savePrefs, DEFAULT_PREFS } from '../src/utils/profileCache.ts';

const SITES = [{ id: 'site-1', name: 'Brit Hotel' }, { id: 'site-2', name: 'Atlantic BW' }];
const ALL = { allowedSiteIds: 'all' as const, siteId: 'all' as const };
const spec = (k: string) => RECORD_TABS.find(t => t.key === k)!;

test('every tab has a unique key and names the page and list it reads', () => {
  assert.equal(new Set(RECORD_TABS.map(t => t.key)).size, RECORD_TABS.length);
  assert.ok(RECORD_TABS.every(t => t.page && t.source && t.label));
});

test('newest records first, only the top rows are returned, total is the in-scope count', () => {
  const recs = Array.from({ length: 9 }, (_, i) => ({ id: `a${i}`, hotel: 'Brit Hotel', name: `N${i}`, checkInDate: `2026-11-0${i + 1}` }))
    .concat([{ id: 'b1', hotel: 'Atlantic BW', name: 'Other', checkInDate: '2026-11-30' } as any, { id: 'x', hotel: 'Nowhere', name: 'Lost', checkInDate: '2026-12-01' } as any]);
  const r = selectRecordTab(spec('newArrivals'), recs, SITES, ALL, 5);
  assert.equal(r.rows.length, 5);
  assert.equal(r.total, 10);              // the unmatched site is not counted, not guessed
  assert.equal(r.unmatchedSite, 1);
  assert.equal(r.rows[0].id, 'b1');       // 2026-11-30 is newest
  const scoped = selectRecordTab(spec('newArrivals'), recs, SITES, { allowedSiteIds: new Set(['site-2']), siteId: 'all' }, 5);
  assert.equal(scoped.total, 1);
  assert.equal(selectRecordTab(spec('newArrivals'), recs, SITES, { allowedSiteIds: 'all', siteId: 'site-1' }, 5).total, 9);
});

test('records without a readable date sort last and show no date', () => {
  const r = selectRecordTab(spec('laundry'), [{ id: '1', site: 'Brit Hotel', date: 'soon' }, { id: '2', site: 'Brit Hotel', date: '2026-11-01', status: 'Queued', roomNo: '4' }], SITES, ALL);
  assert.deepEqual(r.rows.map(x => x.id), ['2', '1']);
  assert.equal(r.rows[1].date, '');
  assert.equal(r.rows[0].title, 'Room 4');
});

test('missing list is an empty result, not an error', () => {
  assert.deepEqual(selectRecordTab(spec('spcd'), undefined, SITES, ALL), { rows: [], total: 0, unmatchedSite: 0 });
});

test('profile cache: per profile, expires, cleared on sign-out', () => {
  clearProfileCache();
  writeProfileCache('u1', 'k', { a: 1 }, 1000);
  assert.deepEqual(readProfileCache('u1', 'k', 5000, 3000), { a: 1 });
  assert.equal(readProfileCache('u2', 'k', 5000, 3000), null);     // another profile never sees it
  assert.equal(readProfileCache('u1', 'k', 5000, 7000), null);     // too old
  clearProfileCache();
  assert.equal(readProfileCache('u1', 'k', 5000, 3000), null);
});

test('preferences are remembered per profile and bad stored values are ignored', () => {
  const store: Record<string, string> = {};
  const fake = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
  savePrefs('u1', { tab: 'Maintenance', factTab: 'laundry', site: 'Brit Hotel', overdueOnly: true, moreOpen: false }, fake);
  assert.equal(loadPrefs('u1', fake).tab, 'Maintenance');
  assert.equal(loadPrefs('u1', fake).overdueOnly, true);
  assert.deepEqual(loadPrefs('u2', fake), DEFAULT_PREFS);
  store['sdtracker.opsPrefs.v1:u3'] = '{not json';
  assert.deepEqual(loadPrefs('u3', fake), DEFAULT_PREFS);
  store['sdtracker.opsPrefs.v1:u4'] = JSON.stringify({ tab: 5, overdueOnly: 'yes' });
  assert.deepEqual(loadPrefs('u4', fake), DEFAULT_PREFS);
});
