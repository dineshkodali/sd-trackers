import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveServiceUserProfile, listSelectableProfiles, computeAutofill, staleFields, initialsOf, type SuMasterData
} from '../src/utils/serviceUserProfile.ts';

function data(): SuMasterData {
  return {
    sites: [{ id: 'site-1', name: 'Brit Hotel' }, { id: 'site-2', name: 'Park Lodge' }],
    properties: [
      { id: 'p1', propertyName: 'Block A', addressLine1: '1 High St', city: 'London', postcode: 'E1 1AA', siteId: 'site-1' },
      { id: 'p2', propertyName: 'Block B', addressLine1: '2 Low Rd', city: 'Leeds', postcode: 'LS1 2BB', siteId: 'site-2' }
    ] as any,
    rooms: [
      { id: 'r1', propertyId: 'p1', roomNumber: '401' },
      { id: 'r2', propertyId: 'p2', roomNumber: '12' },
      { id: 'r3', propertyId: 'p1', roomNumber: '402' }
    ] as any,
    serviceUsers: [
      { id: 'su1', suReference: 'SU-000001', firstName: 'Amina', lastName: 'Khan', externalReference: 'PR-100', dateOfBirth: '1990-03-04', nationality: 'Sudan', preferredLanguage: 'Arabic', status: 'Active', siteId: 'site-1', vulnerable: 'Yes' },
      { id: 'su2', suReference: 'SU-000002', firstName: 'Ben', lastName: 'Ode', externalReference: 'PR-200', status: 'Active', siteId: 'site-2' },
      { id: 'su3', suReference: 'SU-000003', firstName: 'Old', lastName: 'Record', status: 'Archived', siteId: 'site-1' },
      { id: 'su4', suReference: 'SU-000004', firstName: 'No', lastName: 'Room', status: 'Active', siteId: 'site-1' },
      { id: 'su5', suReference: 'SU-000005', firstName: 'Moved', lastName: 'Recently', status: 'Active', siteId: 'site-1' }
    ] as any,
    placements: [
      { id: 'pl1', suId: 'su1', siteId: 'site-1', propertyId: 'p1', roomId: 'r1', status: 'Active', startDate: '2026-10-01' },
      { id: 'pl2', suId: 'su2', siteId: 'site-2', propertyId: 'p2', roomId: 'r2', status: 'Active', startDate: '2026-10-05' },
      { id: 'pl3', suId: 'su3', siteId: 'site-1', propertyId: 'p1', roomId: 'r3', status: 'Active', startDate: '2026-09-01' },
      { id: 'pl4', suId: 'su5', siteId: 'site-1', propertyId: 'p1', roomId: 'r1', status: 'Completed', startDate: '2026-08-01' },
      { id: 'pl5', suId: 'su5', siteId: 'site-1', propertyId: 'p1', roomId: 'r3', status: 'Active', startDate: '2026-11-01' }
    ] as any,
    contacts: [{ id: 'c1', suId: 'su1', mobile: '07700 900111', email: 'amina@example.org' }] as any
  };
}

test('the profile comes from the active placement, with the full set of fields', () => {
  const p = resolveServiceUserProfile('su1', data())!;
  assert.equal(p.fullName, 'Amina Khan');
  assert.equal(p.initials, 'AK');
  assert.equal(p.externalReference, 'PR-100');
  assert.equal(p.siteName, 'Brit Hotel');
  assert.equal(p.propertyName, 'Block A');
  assert.equal(p.propertyAddress, '1 High St, London, E1 1AA');
  assert.equal(p.roomNumber, '401');
  assert.equal(p.phone, '07700 900111');
  assert.equal(p.dob, '1990-03-04');
  assert.equal(p.vulnerable, true);
  assert.equal(p.placed, true);
  assert.deepEqual(p.missing, []);
});

test('missing data is reported rather than left as a silent blank', () => {
  const p = resolveServiceUserProfile('su2', data())!;
  assert.deepEqual(p.missing.sort(), ['date of birth', 'phone number']);
  const unplaced = resolveServiceUserProfile('su4', data())!;
  assert.equal(unplaced.placed, false);
  assert.ok(unplaced.missing.includes('room'));
  assert.equal(resolveServiceUserProfile('nobody', data()), null);
  assert.equal(resolveServiceUserProfile('', data()), null);
});

test('a person who moved shows their CURRENT room, not an old one', () => {
  assert.equal(resolveServiceUserProfile('su5', data())!.roomNumber, '402');
});

test('only permitted, current, non-archived people are offered', () => {
  const all = listSelectableProfiles(data(), { allowedSiteIds: 'all' }).map(p => p.suId);
  assert.deepEqual(all.sort(), ['su1', 'su2', 'su5']);       // archived su3 and unplaced su4 left out
  const siteOne = listSelectableProfiles(data(), { allowedSiteIds: new Set(['site-1']) }).map(p => p.suId);
  assert.deepEqual(siteOne.sort(), ['su1', 'su5']);          // site-2's person is not visible
  assert.deepEqual(listSelectableProfiles(data(), { allowedSiteIds: 'all', siteId: 'site-2' }).map(p => p.suId), ['su2']);
  assert.equal(listSelectableProfiles(data(), { allowedSiteIds: new Set(['site-1']), siteId: 'site-2' }).length, 0);
  assert.deepEqual(listSelectableProfiles(data(), { allowedSiteIds: 'all' }, 'pr-200').map(p => p.suId), ['su2']);
  assert.deepEqual(listSelectableProfiles(data(), { allowedSiteIds: 'all' }, '401').map(p => p.suId), ['su1']);
  assert.ok(listSelectableProfiles(data(), { allowedSiteIds: 'all' }, '', { includeUnplaced: true }).some(p => p.suId === 'su4'));
});

const MAP = { portReference: 'externalReference', flatNumber: 'roomNumber', suName: 'fullName', initials: 'initials' } as const;
const none = new Set<string>();

test('autofill fills empty fields', () => {
  const p = resolveServiceUserProfile('su1', data())!;
  const r = computeAutofill(p, MAP, { touched: none, autofilled: none }, {});
  assert.deepEqual(r.changes, { portReference: 'PR-100', flatNumber: '401', suName: 'Amina Khan', initials: 'AK' });
  assert.deepEqual(r.skipped, []);
});

test('autofill never overwrites something the user typed', () => {
  const p = resolveServiceUserProfile('su1', data())!;
  const r = computeAutofill(p, MAP, { touched: none, autofilled: none }, { flatNumber: 'Room 4-01 (typed)' });
  assert.equal(r.changes.flatNumber, undefined);
  assert.deepEqual(r.skipped, ['flatNumber']);
  const touched = computeAutofill(p, MAP, { touched: new Set(['portReference']), autofilled: none }, { portReference: '' });
  assert.equal(touched.changes.portReference, undefined);   // touched, even though empty now
});

test('choosing a different person refreshes only what was filled automatically', () => {
  const first = resolveServiceUserProfile('su1', data())!;
  const second = resolveServiceUserProfile('su2', data())!;
  const filled = computeAutofill(first, MAP, { touched: none, autofilled: none }, {}).changes;
  const form = { ...filled, flatNumber: 'typed by hand' };
  const r = computeAutofill(second, MAP, { touched: new Set(['flatNumber']), autofilled: new Set(['portReference', 'suName', 'initials', 'flatNumber']) }, form);
  assert.equal(r.changes.portReference, 'PR-200');
  assert.equal(r.changes.suName, 'Ben Ode');
  assert.equal(r.changes.flatNumber, undefined);            // the hand-typed one is kept
});

test('an empty profile value does not blank out an existing field', () => {
  const p = resolveServiceUserProfile('su4', data())!;      // no room
  const r = computeAutofill(p, MAP, { touched: none, autofilled: new Set(['flatNumber']) }, { flatNumber: '401' });
  assert.equal(r.changes.flatNumber, undefined);
});

test('an edit form can tell that the profile has moved on', () => {
  const p = resolveServiceUserProfile('su5', data())!;      // now in 402
  assert.deepEqual(staleFields(p, MAP, { flatNumber: '401', portReference: '' }), ['flatNumber']);
  assert.deepEqual(staleFields(p, MAP, { flatNumber: '402' }), []);
});

test('initials', () => {
  assert.equal(initialsOf('amina', 'khan'), 'AK');
  assert.equal(initialsOf('', 'Khan'), 'K');
});
