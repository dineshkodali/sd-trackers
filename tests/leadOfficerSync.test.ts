import test from 'node:test';
import assert from 'node:assert/strict';
import { findUserForOfficer, officerLabelFor, hasAllSitesAccess, LEAD_OFFICER_ROLES } from '../src/utils/leadOfficerSync';
import type { UserAccount } from '../src/types';

const user = (id: string, name: string, email: string, role: UserAccount['role'] = 'General Manager'): UserAccount => ({
  id, name, email, role, assignedSites: ['Hotel A'], status: 'Active', lastActive: 'Recently'
});

const users = [
  user('1', 'Asha Patel', 'asha@example.org'),
  user('2', 'Ben Cole', 'ben@example.org'),
  user('3', 'Sam Lee', 'sam.lee@example.org'),
  user('4', 'Sam Lee', 'sam.lee2@example.org', 'Staff'),
];

test('a unique display name resolves to one account', () => {
  assert.equal(findUserForOfficer(users, 'asha patel').user?.id, '1');
});

test('an email address resolves to one account', () => {
  assert.equal(findUserForOfficer(users, ' BEN@example.org ').user?.id, '2');
});

test('a shared display name is ambiguous and matches no account', () => {
  const result = findUserForOfficer(users, 'Sam Lee');
  assert.equal(result.user, null);
  assert.equal(result.ambiguous, true);
});

test('a shared name can still be resolved by email', () => {
  assert.equal(findUserForOfficer(users, 'sam.lee2@example.org').user?.id, '4');
});

test('empty, unassigned and unknown officers match nothing and are not ambiguous', () => {
  for (const officer of ['', '   ', 'Unassigned', undefined, null, 'Nobody Here']) {
    assert.deepEqual(findUserForOfficer(users, officer), { user: null, ambiguous: false });
  }
});

test('the stored officer text is the email when the name is shared', () => {
  assert.equal(officerLabelFor(users, users[0]), 'Asha Patel');
  assert.equal(officerLabelFor(users, users[2]), 'sam.lee@example.org');
});

test('staff accounts are not made lead officer automatically', () => {
  assert.ok(LEAD_OFFICER_ROLES.includes('General Manager'));
  assert.ok(LEAD_OFFICER_ROLES.includes('Area Manager'));
  assert.ok(!LEAD_OFFICER_ROLES.includes('Staff'));
});

test('all-sites accounts are recognised', () => {
  assert.equal(hasAllSitesAccess(['All Sites']), true);
  assert.equal(hasAllSitesAccess(['All']), true);
  assert.equal(hasAllSitesAccess(['Hotel A']), false);
  assert.equal(hasAllSitesAccess(undefined), false);
});
