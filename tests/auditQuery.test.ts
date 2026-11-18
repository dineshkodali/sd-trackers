import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAuditQuery, AUDIT_MAX_PAGE_SIZE } from '../src/utils/auditQuery.ts';

/** Records every call made on a supabase-js style query builder. */
function recorder() {
  const calls: Array<[string, any[]]> = [];
  const q: any = new Proxy({}, { get: (_t, name: string) => (...args: any[]) => { calls.push([name, args]); return q; } });
  return { q, calls };
}
const callsOf = (calls: Array<[string, any[]]>, name: string) => calls.filter(c => c[0] === name).map(c => c[1]);

test('audit query: search covers the readable columns, case-insensitively, and strips characters that could alter the filter', () => {
  const { q, calls } = recorder();
  applyAuditQuery(q, { page: 1, pageSize: 15, search: 'Smith, (admin)*%' });
  const or = callsOf(calls, 'or')[0][0] as string;
  assert.ok(or.includes('user.ilike.*Smith admin*'), or);
  for (const col of ['role', 'module', 'action', 'details', 'target_label', 'site']) assert.ok(or.includes(`${col}.ilike.`), col);
  assert.ok(!/[(),]\s*\)|\*\*/.test(or.replace(/,/g, '')), 'no stray filter syntax from user input');
});

test('audit query: module filter also matches older rows that only have an entity type', () => {
  const { q, calls } = recorder();
  applyAuditQuery(q, { page: 1, pageSize: 15, modules: ['Properties'] });
  const or = callsOf(calls, 'or')[0][0] as string;
  assert.ok(or.includes('module.eq."Properties"'));
  assert.ok(or.includes('and(module.is.null,entity_type.in.('));
  assert.ok(or.includes('"properties"') || or.includes('"sites"'));
});

test('audit query: action and user filters are exact; "all" adds no filter', () => {
  const a = recorder(); applyAuditQuery(a.q, { page: 1, pageSize: 15, action: 'DELETE', user: 'Dinesh' });
  assert.deepEqual(callsOf(a.calls, 'eq'), [['action', 'DELETE'], ['user', 'Dinesh']]);
  const b = recorder(); applyAuditQuery(b.q, { page: 1, pageSize: 15, action: 'all', user: 'all' });
  assert.equal(callsOf(b.calls, 'eq').length, 0);
});

test('audit query: a restricted user is limited to their site, their own actions or their role; no identity shows nothing', () => {
  const a = recorder(); applyAuditQuery(a.q, { page: 1, pageSize: 15, restrict: { site: 'Seven Kings Hotel', userName: 'Sam', role: 'Staff' } });
  const or = callsOf(a.calls, 'or')[0][0] as string;
  assert.ok(or.includes('site.ilike.Seven Kings Hotel') && or.includes('user.ilike.*Sam*') && or.includes('role.eq."Staff"'));
  const b = recorder(); applyAuditQuery(b.q, { page: 1, pageSize: 15, restrict: {} });
  assert.equal(callsOf(b.calls, 'or')[0][0], 'id.eq.__none__');
});

test('audit query: stable order (sort column then id), correct page window and capped page size', () => {
  const a = recorder(); applyAuditQuery(a.q, { page: 3, pageSize: 25, sortField: 'performedByUser', sortAsc: true });
  assert.deepEqual(callsOf(a.calls, 'order').map(c => c[0]), ['user', 'id']);
  assert.deepEqual(callsOf(a.calls, 'range')[0], [50, 74]);
  const b = recorder(); applyAuditQuery(b.q, { page: 1, pageSize: 100000 });
  assert.deepEqual(callsOf(b.calls, 'range')[0], [0, AUDIT_MAX_PAGE_SIZE - 1]);
  const c = recorder(); applyAuditQuery(c.q, { page: 1, pageSize: 10 });
  assert.deepEqual(callsOf(c.calls, 'order')[0], ['timestamp', { ascending: false, nullsFirst: false }], 'newest first by default');
});
