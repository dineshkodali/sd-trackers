import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  actionsForPage, evaluateOverride, sanitizePermissions, pageForTable, TABLE_PAGE_MAP, isManageablePage,
} from '../src/config/pagePermissionsConfig';

test('no override rows => unrestricted (existing users unchanged)', () => {
  assert.deepEqual(evaluateOverride(null, 'referrals', 'delete'), { allowed: true, restricted: false });
  assert.deepEqual(evaluateOverride({}, 'referrals', 'view'), { allowed: true, restricted: false });
});

test('restricted user: absent page and false action are denied', () => {
  const perms = { dashboard: { view: true }, reports: { view: true, export: false } };
  assert.equal(evaluateOverride(perms, 'dashboard', 'view').allowed, true);
  assert.equal(evaluateOverride(perms, 'referrals', 'view').allowed, false);
  assert.equal(evaluateOverride(perms, 'reports', 'export').allowed, false);
  assert.equal(evaluateOverride(perms, 'dashboard', 'edit').allowed, false);
});

test('sanitize drops unknown pages/irrelevant actions and requires view', () => {
  const out = sanitizePermissions({
    dashboard: { view: true, delete: true },
    nonsense: { view: true },
    referrals: { view: false, edit: true },
    '__proto__': { view: true },
  });
  assert.equal(out.nonsense, undefined);
  assert.equal(out.dashboard.delete, false); // not relevant for dashboard
  assert.equal(out.referrals.edit, false);   // no view => nothing
  assert.equal(Object.getPrototypeOf(out), Object.prototype);
});

test('action relevance', () => {
  assert.deepEqual(actionsForPage('dashboard'), ['view']);
  assert.ok(actionsForPage('financeApprovals').includes('approve'));
  assert.ok(!actionsForPage('referrals').includes('approve'));
});

test('every mapped table points at a real page', () => {
  for (const [table, page] of Object.entries(TABLE_PAGE_MAP)) {
    assert.ok(isManageablePage(page), `${table} -> ${page}`);
  }
  assert.equal(pageForTable('profiles'), undefined);
});

test('migration RLS table list matches TABLE_PAGE_MAP', () => {
  const sql = fs.readFileSync('db/migrations/026_page_access_management.sql', 'utf8');
  const pairs = [...sql.matchAll(/\['([a-z_]+)','([A-Za-z]+)'\]/g)].map(m => [m[1], m[2]]);
  assert.equal(pairs.length, Object.keys(TABLE_PAGE_MAP).length);
  for (const [t, p] of pairs) assert.equal(TABLE_PAGE_MAP[t], p, t);
});
