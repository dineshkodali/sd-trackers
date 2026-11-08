import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canCreateProperty, canRestoreRecords, checkTransition, checkUserWrite, hasGlobalScope, isLifecycleEditor, sitesWithinScope,
  type LifecycleActor, type LifecycleTarget,
} from '../src/config/recordLifecycle';

const actor = (role: string, sites: string[] = ['Hotel A'], id = 'actor'): LifecycleActor => ({ id, role, sites });
const user = (over: Partial<LifecycleTarget> = {}): LifecycleTarget => ({ id: 'u1', state: 'Active', role: 'Staff', sites: ['Hotel A'], ...over });
const property = (over: Partial<LifecycleTarget> = {}): LifecycleTarget => ({ id: 'p1', state: 'Active', sites: ['Hotel A'], ...over });

test('only Super Admin can restore', () => {
  for (const role of ['Admin', 'General Manager', 'Area Manager', 'Staff', 'Regional Manager']) {
    assert.equal(canRestoreRecords(role), false, role);
    for (const state of ['Archived', 'Deleted'] as const) {
      const r = checkTransition('properties', 'restore', actor(role, ['All Sites']), property({ state }));
      assert.equal(r.ok, false, `${role} restore ${state}`);
    }
  }
  assert.equal(canRestoreRecords('Super Admin'), true);
});

test('Super Admin restores archived to Active and deleted back to where it came from', () => {
  const sa = actor('Super Admin');
  assert.deepEqual(checkTransition('users', 'restore', sa, user({ state: 'Archived' })), { ok: true, from: 'Archived', to: 'Active' });
  assert.deepEqual(checkTransition('users', 'restore', sa, user({ state: 'Deleted', previousState: 'Active' })), { ok: true, from: 'Deleted', to: 'Active' });
  assert.deepEqual(checkTransition('users', 'restore', sa, user({ state: 'Deleted', previousState: 'Archived' })), { ok: true, from: 'Deleted', to: 'Archived' });
  assert.equal(checkTransition('users', 'restore', sa, user({ state: 'Active' })).ok, false);
});

test('Staff, General Manager and Area Manager can archive and delete inside their sites', () => {
  for (const role of ['Staff', 'General Manager', 'Area Manager']) {
    assert.deepEqual(checkTransition('properties', 'archive', actor(role), property()), { ok: true, from: 'Active', to: 'Archived' }, role);
    assert.deepEqual(checkTransition('properties', 'delete', actor(role), property()), { ok: true, from: 'Active', to: 'Deleted' }, role);
  }
});

test('nobody outside the allowed roles can archive or delete', () => {
  assert.equal(isLifecycleEditor('Regional Manager'), false);
  assert.equal(checkTransition('properties', 'archive', actor('Regional Manager', ['All Sites']), property()).ok, false);
  assert.equal(checkTransition('properties', 'delete', actor('Nobody'), property()).ok, false);
});

test('scope: a property outside the person\'s sites is refused; All Sites is not', () => {
  assert.equal(checkTransition('properties', 'archive', actor('Staff', ['Hotel B']), property()).ok, false);
  assert.equal(checkTransition('properties', 'archive', actor('Staff', ['All Sites']), property()).ok, true);
  assert.equal(checkTransition('properties', 'archive', actor('Staff', ['hotel a ']), property()).ok, true, 'case and spacing');
  assert.equal(sitesWithinScope({ role: 'Staff', sites: ['Hotel A'] }, []), false, 'no site => cannot prove scope');
});

test('users: only lower roles, never yourself, all of their sites must be yours', () => {
  const gm = actor('General Manager', ['Hotel A', 'Hotel B']);
  assert.equal(checkTransition('users', 'archive', gm, user({ role: 'Area Manager' })).ok, true);
  assert.equal(checkTransition('users', 'archive', gm, user({ role: 'General Manager' })).ok, false, 'same rank');
  assert.equal(checkTransition('users', 'archive', gm, user({ role: 'Admin' })).ok, false, 'higher rank');
  assert.equal(checkTransition('users', 'archive', gm, user({ role: 'Staff', sites: ['Hotel A', 'Hotel C'] })).ok, false, 'one site outside scope');
  assert.equal(checkTransition('users', 'archive', actor('Staff', ['Hotel A'], 'u1'), user({ role: 'Staff' })).ok, false, 'self + same rank');
  assert.equal(checkTransition('users', 'delete', actor('Super Admin', [], 'u1'), user({ id: 'u1', role: 'Staff' })).ok, false, 'Super Admin cannot delete self');
  assert.equal(checkTransition('users', 'archive', actor('Super Admin', []), user({ role: 'Admin', sites: [] })).ok, true);
});

test('already archived or deleted records cannot be archived again', () => {
  const sa = actor('Super Admin');
  assert.equal(checkTransition('properties', 'archive', sa, property({ state: 'Archived' })).ok, false);
  assert.equal(checkTransition('properties', 'delete', sa, property({ state: 'Deleted' })).ok, false);
  assert.equal(checkTransition('properties', 'delete', sa, property({ state: 'Archived' })).ok, true);
});

test('user create / edit: no escalation above your own role, no sites outside your own', () => {
  const gm = actor('General Manager', ['Hotel A']);
  assert.equal(checkUserWrite(gm, { role: 'Staff', sites: ['Hotel A'] }).ok, true);
  assert.equal(checkUserWrite(gm, { role: 'General Manager', sites: ['Hotel A'] }).ok, false);
  assert.equal(checkUserWrite(gm, { role: 'Admin', sites: ['Hotel A'] }).ok, false);
  assert.equal(checkUserWrite(gm, { role: 'Staff', sites: ['Hotel B'] }).ok, false);
  assert.equal(checkUserWrite(gm, { role: 'Staff', sites: ['Hotel A'], currentRole: 'Admin', id: 'x' }).ok, false, 'cannot edit a higher role');
  assert.equal(checkUserWrite(gm, { role: 'Staff', sites: ['Hotel A'], id: 'actor' }).ok, false, 'cannot edit yourself');
  assert.equal(checkUserWrite(actor('Staff'), { role: 'Staff', sites: ['Hotel A'] }).ok, false, 'Staff cannot create peers');
  assert.equal(checkUserWrite(actor('Super Admin', []), { role: 'Admin', sites: [] }).ok, true);
});

test('a new property is only for someone who can act on every site', () => {
  assert.equal(canCreateProperty({ role: 'Staff', sites: ['Hotel A'] }), false);
  assert.equal(canCreateProperty({ role: 'Staff', sites: ['All Sites'] }), true);
  assert.equal(canCreateProperty({ role: 'Admin', sites: [] }), true);
  assert.equal(hasGlobalScope('Area Manager', ['Hotel A']), false);
});

test('migration 028: lifecycle is database-enforced, restore is Super Admin only, nothing is hard deleted', () => {
  const sql = fs.readFileSync('db/migrations/028_record_lifecycle.sql', 'utf8');
  assert.match(sql, /lifecycle_state IN \(''Active'', ''Archived'', ''Deleted''\)/);
  assert.match(sql, /CREATE TRIGGER trg_profiles_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON public\.profiles/);
  assert.match(sql, /CREATE TRIGGER trg_sites_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON public\.sites/);
  assert.match(sql, /Records cannot be permanently deleted/);
  assert.match(sql, /p_action = 'restore' AND actor\.role <> 'Super Admin'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.lifecycle_apply\(TEXT, TEXT, TEXT, UUID, TEXT\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.lifecycle_apply\(TEXT, TEXT, TEXT, UUID, TEXT\) TO service_role/);
  assert.match(sql, /INSERT INTO public\.record_lifecycle_events/);
  assert.match(sql, /INSERT INTO public\.audit_trails/);
  assert.match(sql, /banned_until/);
  assert.ok(!/DROP TABLE/i.test(sql.split('-- ROLLBACK')[0]), 'no destructive statements outside the rollback notes');
  assert.ok(!/GRANT[^;]*lifecycle_apply\(TEXT, TEXT, TEXT, UUID, TEXT\)[^;]*TO[^;]*authenticated/i.test(sql), 'the actor-supplied function is not callable by browsers');
});
