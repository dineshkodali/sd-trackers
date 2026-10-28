import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { toDatabaseRow, fromDatabaseRow } from '../server/schemaAdapter.ts';
import {
  redactSensitiveRows, stripSensitiveUpdateFields, maskIdentifier, isChildByDob, checkArchiveRequester, checkArchiveDecider,
  isSuEditor, isSuManager, httpStatusForDbError
} from '../server/suAccess.ts';

const roundTrip = (table: string, rec: any) => fromDatabaseRow(table, { ...toDatabaseRow(table, rec), created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' });

test('HC2 details round-trip with the Service User id and ISO dates', () => {
  const back = roundTrip('su_hc2_details', { id: 'h1', suId: 'su1', referenceNumber: 'HC2-1', issueDate: '2026-01-02', expiryDate: '2027-01-01', status: 'Active', notes: 'n' });
  assert.equal(back.suId, 'su1');
  assert.equal(back.referenceNumber, 'HC2-1');
  assert.equal(back.expiryDate, '2027-01-01');
  assert.equal(back.status, 'Active');
});

test('meal records keep one row per SU, date and period', () => {
  const back = roundTrip('su_meal_records', { id: 'm1', suId: 'su1', mealDate: '2026-10-28', mealPeriod: 'Lunch', status: 'Declined', notes: 'felt unwell' });
  assert.equal(back.mealPeriod, 'Lunch');
  assert.equal(back.status, 'Declined');
});

test('education and family records round-trip with their links', () => {
  const edu = roundTrip('su_education_details', { id: 'e1', suId: 'su1', schoolName: 'Park School', educationStatus: 'Enrolled', isCurrent: true });
  assert.equal(edu.isCurrent, true);
  assert.equal(edu.educationStatus, 'Enrolled');
  const mem = roundTrip('family_members', { id: 'f1', familyId: 'fam1', suId: 'su2', relationship: 'Child', status: 'Active' });
  assert.equal(mem.familyId, 'fam1');
  assert.equal(mem.suId, 'su2');
});

test('archive state is readable on a Service User', () => {
  const su = fromDatabaseRow('service_users', { id: 'su1', first_name: 'A', last_name: 'B', status: 'Archived', archive_status: 'Archived', archived_at: '2026-10-28T10:00:00Z' });
  assert.equal(su.archiveStatus, 'Archived');
});

test('roles: managers see everything, front-line staff see masked or blank identifiers', () => {
  assert.equal(isSuManager('General Manager'), true);
  assert.equal(isSuManager('Staff'), false);
  assert.equal(isSuEditor('Staff'), true);
  assert.equal(isSuEditor('Viewer'), false);
  const hc2 = [{ referenceNumber: 'R1', documentPath: 'p', documentName: 'n', status: 'Issued' }];
  const seen = redactSensitiveRows('su_hc2_details', hc2, 'Staff')[0];
  assert.deepEqual([seen.referenceNumber, seen.documentPath, seen.documentName, seen.status], [null, null, null, 'Issued']);
  assert.equal(maskIdentifier('abc'), '••••');
  assert.equal(maskIdentifier(''), null);
});

test('a redacted identifier can never be written back by a non-manager', () => {
  const body = { id: 'h1', referenceNumber: null, reference_number: null, documentPath: null, notes: 'x' };
  assert.deepEqual(stripSensitiveUpdateFields('su_hc2_details', body, 'Staff'), { id: 'h1', notes: 'x' });
  assert.ok('referenceNumber' in stripSensitiveUpdateFields('su_hc2_details', body, 'Admin'));
});

test('child status comes only from a date of birth, never from anything else', () => {
  const today = new Date('2026-10-28T12:00:00Z');
  assert.equal(isChildByDob('2015-03-01', today), true);
  assert.equal(isChildByDob('2008-10-29', today), true);   // turns 18 tomorrow
  assert.equal(isChildByDob('2008-10-28', today), false);  // turns 18 today
  assert.equal(isChildByDob('1990-01-01', today), false);
  assert.equal(isChildByDob('', today), false);
  assert.equal(isChildByDob(undefined, today), false);
  assert.equal(isChildByDob('2030-01-01', today), false);  // future date is invalid, not a child
});

test('archive requests: only permitted roles raise them; approvers are managers above general level and never the requester', () => {
  assert.equal(checkArchiveRequester('Staff', true).ok, false);
  assert.equal(checkArchiveRequester('General Manager', false).ok, false);
  assert.equal(checkArchiveRequester('General Manager', true).ok, true);

  assert.equal(checkArchiveDecider('Regional Manager', 'u2', 'u1', 'Approved').ok, true);
  assert.equal(checkArchiveDecider('Admin', 'u2', 'u1', 'Rejected').ok, true);
  assert.equal(checkArchiveDecider('General Manager', 'u2', 'u1', 'Approved').ok, false);
  assert.equal(checkArchiveDecider('Staff', 'u2', 'u1', 'Approved').ok, false);
  const self = checkArchiveDecider('Super Admin', 'u1', 'u1', 'Approved');
  assert.equal(self.ok, false);
  assert.equal(self.status, 403);
  assert.equal(checkArchiveDecider('General Manager', 'u1', 'u1', 'Cancelled').ok, true); // the database restricts this to the requester
});

test('database workflow errors map to the right HTTP status', () => {
  assert.equal(httpStatusForDbError({ code: '42501' }), 403);
  assert.equal(httpStatusForDbError({ code: 'P0002' }), 404);
  assert.equal(httpStatusForDbError({ code: '23505' }), 409);
  assert.equal(httpStatusForDbError({ code: '22023' }), 400);
  assert.equal(httpStatusForDbError({ code: 'XX000' }), 500);
  assert.equal(httpStatusForDbError(null), 500);
});

// A static check only: it proves the migration still carries its safety rules, not that Postgres accepts it.
test('migration 021 keeps its integrity and security rules, and schema.sql carries the same text', () => {
  const sql = fs.readFileSync('db/migrations/021_su_enhancements.sql', 'utf8');
  const required = [
    'uq_su_archive_one_pending', 'su_archive_no_self_decision', 'service_users_archive_guard', 'FOR UPDATE',
    'su_meal_one_per_slot UNIQUE (su_id, meal_date, meal_period)', 'uq_family_members_one_active_family',
    'uq_su_education_one_current', "public) VALUES ('su-health-documents'", 'REVOKE ALL ON FUNCTION public.request_su_archive',
    'REVOKE ALL ON FUNCTION public.decide_su_archive_request'
  ];
  for (const needle of required) {
    const found = needle.includes("public) VALUES") ? sql.includes("'su-health-documents', 'su-health-documents', false") : sql.includes(needle);
    assert.ok(found, `migration should contain: ${needle}`);
  }
  assert.ok(!/DROP TABLE(?! IF EXISTS public\.su_archive_requests, public\.family_members)/.test(sql.replace(/--.*$/gm, '')), 'no destructive statements outside the commented rollback');
  assert.ok(sql.includes('REVOKE ALL ON public.%I FROM anon, authenticated'));
  const schema = fs.readFileSync('db/schema.sql', 'utf8');
  assert.ok(schema.includes(sql.trim()), 'db/schema.sql must include migration 021 verbatim');
});

import {
  mealDayStatus, validateMealEntry, mealRecordId, hc2DisplayStatus, validateHc2,
  validateEducation, educationSummary, addableToFamily, activeFamilyOf, archiveActionsFor, isArchivedSu
} from '../src/utils/suEnhancementsLogic.ts';

test('meals: three separate periods, one id per SU/date/period, incomplete until all are resolved', () => {
  assert.equal(mealRecordId('su1', '2026-10-28', 'Lunch'), 'smr-su1-2026-10-28-Lunch');
  assert.equal(mealDayStatus({}), 'Not started');
  assert.equal(mealDayStatus({ Breakfast: 'Accepted', Lunch: 'Pending' }), 'Incomplete');
  assert.equal(mealDayStatus({ Breakfast: 'Accepted', Lunch: 'Declined', Dinner: 'Not applicable' }), 'Complete');
  assert.equal(mealDayStatus({ Breakfast: 'Pending', Lunch: 'Pending', Dinner: 'Pending' }), 'Not started');
  assert.match(validateMealEntry('Declined', '') || '', /note/i);
  assert.match(validateMealEntry('Not available', '  ') || '', /note/i);
  assert.equal(validateMealEntry('Provided', ''), null);
  assert.ok(validateMealEntry('Eaten'));
});

test('HC2: expiry drives the displayed status, and dates are validated', () => {
  assert.equal(hc2DisplayStatus('Active', '2026-09-01', '2026-10-28'), 'Expired');
  assert.equal(hc2DisplayStatus('Active', '2026-11-10', '2026-10-28'), 'Renewal due');
  assert.equal(hc2DisplayStatus('Active', '2027-06-01', '2026-10-28'), 'Active');
  assert.equal(hc2DisplayStatus('Applied', '2026-01-01', '2026-10-28'), 'Applied');
  assert.equal(hc2DisplayStatus(undefined, undefined, '2026-10-28'), 'Not recorded');
  assert.ok(validateHc2({ status: 'Active', issueDate: '2026-02-01', expiryDate: '2026-01-01' }));
  assert.ok(validateHc2({ status: 'Issued' }));
  assert.equal(validateHc2({ status: 'Applied' }), null);
});

test('education: missing information is not shown as non-enrolment; enrolled needs a school', () => {
  assert.equal(educationSummary(null), 'Not recorded');
  assert.equal(educationSummary({ educationStatus: 'Not enrolled' }), 'Not enrolled');
  assert.equal(educationSummary({ educationStatus: 'Enrolled', schoolName: 'Park School' }), 'Enrolled - Park School');
  assert.ok(validateEducation({ educationStatus: 'Enrolled', schoolName: '' }));
  assert.equal(validateEducation({ educationStatus: 'Details pending' }), null);
  assert.ok(validateEducation({ educationStatus: 'Enrolled', schoolName: 'X', startDate: '2026-09-01', endDate: '2026-08-01' }));
});

test('family groups: one active family per SU, removed members can be linked again, archived SUs cannot', () => {
  const members = [
    { id: 'm1', familyId: 'f1', suId: 'a', status: 'Active' },
    { id: 'm2', familyId: 'f1', suId: 'b', status: 'Removed' }
  ];
  assert.equal(activeFamilyOf(members, 'a')?.familyId, 'f1');
  assert.equal(activeFamilyOf(members, 'b'), null);
  const sus = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd', status: 'Archived' }, { id: 'e', archiveStatus: 'Archived' }];
  assert.deepEqual(addableToFamily(sus, members).map(s => s.id), ['b', 'c']);
});

test('archive actions: requester cannot decide their own request; archived SUs offer restore only', () => {
  const pending = { id: 'r1', requestedById: 'u1' };
  const can = { request: true, decide: true };
  assert.equal(archiveActionsFor({ archiveStatus: 'Active' }, can, null, 'u1').canRequestArchive, true);
  assert.equal(archiveActionsFor({ archiveStatus: 'Active' }, can, null, 'u1').canRequestRestore, false);
  assert.equal(archiveActionsFor({ archiveStatus: 'Archived' }, can, null, 'u1').canRequestRestore, true);
  assert.equal(archiveActionsFor({ archiveStatus: 'Archived' }, can, null, 'u1').canRequestArchive, false);
  const mine = archiveActionsFor({ archiveStatus: 'Pending approval' }, can, pending, 'u1');
  assert.deepEqual([mine.canDecide, mine.canCancel, mine.canRequestArchive], [false, true, false]);
  const theirs = archiveActionsFor({ archiveStatus: 'Pending approval' }, can, pending, 'u2');
  assert.deepEqual([theirs.canDecide, theirs.canCancel], [true, false]);
  assert.equal(archiveActionsFor({ archiveStatus: 'Pending approval' }, { request: true, decide: false }, pending, 'u2').canDecide, false);
  assert.equal(isArchivedSu({ status: 'Archived' }), true);
  assert.equal(isArchivedSu({ status: 'Active', archiveStatus: 'Pending approval' }), false);
});

import { ENTITY_REGISTRY, TABLE_PARENT_SCOPE } from '../server/routes/db.ts';

test('API policies: archive requests and history tables cannot be written through the generic API', () => {
  for (const name of ['suArchiveRequests', 'su_archive_requests']) {
    assert.equal(ENTITY_REGISTRY[name].write, 'none');
    assert.equal(ENTITY_REGISTRY[name].remove, 'none');
    assert.equal(ENTITY_REGISTRY[name].read, 'manager');
  }
  for (const name of ['oysterCardEvents', 'suMealHistory']) {
    assert.equal(ENTITY_REGISTRY[name].write, 'none');
    assert.equal(ENTITY_REGISTRY[name].remove, 'none');
  }
});

test('API policies: history is preserved, so Oyster cards, meals, education and family links cannot be deleted', () => {
  for (const name of ['oysterCards', 'suMeals', 'suEducation', 'familyGroups', 'familyMembers']) {
    assert.equal(ENTITY_REGISTRY[name].remove, 'none', `${name} must not be deletable`);
  }
});

test('API policies: every new entity restricts reads and has no open ("any") write policy', () => {
  const names = ['suHc2', 'oysterCards', 'oysterCardEvents', 'suMeals', 'suMealHistory', 'suEducation', 'familyGroups', 'familyMembers', 'suArchiveRequests'];
  for (const name of names) {
    const def = ENTITY_REGISTRY[name];
    assert.ok(def.read === 'manager' || def.read === 'suEditor', `${name} read policy`);
    assert.ok(def.write && def.write !== 'any', `${name} write policy`);
  }
  assert.equal(ENTITY_REGISTRY.familyGroups.write, 'manager');
  assert.equal(ENTITY_REGISTRY.familyMembers.write, 'manager');
});

test('API scope: every new SU-linked table is scoped through its Service User', () => {
  for (const table of ['su_hc2_details', 'su_meal_records', 'su_meal_record_history', 'su_education_details', 'family_members', 'su_archive_requests']) {
    assert.deepEqual(TABLE_PARENT_SCOPE[table], { linkColumn: 'su_id', linkField: 'suId', parentTable: 'service_users' });
  }
});
