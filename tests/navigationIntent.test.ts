import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeIntent, sanitizeIntentFilters, isIntentFresh, splitList, INTENT_MAX_AGE_MS, INTENT_FILTERS
} from '../src/utils/navigationIntent.ts';

test('only filters the page declares are kept', () => {
  assert.deepEqual(
    sanitizeIntentFilters('maintenance', { sla: 'overdue', open: '1', evil: 'x', priority: 'CAT 1' }),
    { sla: 'overdue', open: '1', priority: 'CAT 1' }
  );
  assert.deepEqual(sanitizeIntentFilters('referrals', { sla: 'overdue' }), {}); // page takes none
  assert.deepEqual(sanitizeIntentFilters('maintenance', undefined), {});
});

test('values must be non-empty short strings', () => {
  assert.deepEqual(sanitizeIntentFilters('maintenance', { sla: '', open: 1, priority: 'x'.repeat(101) } as any), {});
  assert.deepEqual(sanitizeIntentFilters('maintenance', { sla: '  overdue ' }), { sla: 'overdue' });
});

test('an intent carries the page, filters and record id', () => {
  const i = makeIntent('compliance', { filters: { expiry: 'expired,due-30', junk: 'x' }, recordId: ' c1 ' }, 1000, 7);
  assert.deepEqual(i, { id: 7, page: 'compliance', filters: { expiry: 'expired,due-30' }, recordId: 'c1', at: 1000 });
  assert.equal(makeIntent('compliance', { recordId: '  ' }, 1, 1).recordId, undefined);
});

test('an intent is used only by its own page and only while fresh', () => {
  const i = makeIntent('maintenance', {}, 1000, 1);
  assert.equal(isIntentFresh(i, 'maintenance', 1000 + INTENT_MAX_AGE_MS), true);
  assert.equal(isIntentFresh(i, 'maintenance', 1001 + INTENT_MAX_AGE_MS), false);
  assert.equal(isIntentFresh(i, 'compliance', 1500), false);
  assert.equal(isIntentFresh(i, 'maintenance', 999), false); // clock went backwards: not trusted
});

test('list values split cleanly', () => {
  assert.deepEqual(splitList('expired, due-30,'), ['expired', 'due-30']);
  assert.deepEqual(splitList(undefined), []);
});

test('the three first adopters declare their filters', () => {
  assert.deepEqual(Object.keys(INTENT_FILTERS).sort(), ['compliance', 'escalations', 'maintenance']);
});
