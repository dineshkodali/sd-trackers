import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  stageOf, availableFundingTransitions, validateFundingTransition, canActOnFundingSite, FUNDING_STAGES,
  FUNDING_DECIDER_ROLES, FUNDING_REVIEWER_ROLES, FUNDING_SITE_ROLES
} from '../src/utils/fundingWorkflow.ts';
import { sanitizeFundingBody, redactSensitiveRows, FUNDING_PROTECTED_FIELDS } from '../server/suAccess.ts';
import { ENTITY_REGISTRY, TABLE_PARENT_SCOPE } from '../server/routes/db.ts';
import { toDatabaseRow, fromDatabaseRow } from '../server/schemaAdapter.ts';

const to = (status: string, role: string, userId?: string, requester?: string) => availableFundingTransitions(status, role, userId, requester).map(e => e.to);

test('funding workflow has six stages, with exits outside them', () => {
  assert.equal(FUNDING_STAGES.length, 6);
  assert.deepEqual(['Draft', 'Submitted', 'Under Review', 'Approved', 'Issued', 'Completed'].map(stageOf), [1, 2, 3, 4, 5, 6]);
  assert.equal(stageOf('Rejected'), 4);
  assert.equal(stageOf('Clarification Required'), 2);   // back with the site
  assert.equal(stageOf('Cancelled'), 0);
});

test('each role sees only the moves it may make', () => {
  assert.deepEqual(to('Draft', 'Staff', 's1', 's1'), ['Submitted', 'Cancelled']);
  assert.deepEqual(to('Draft', 'Staff', 's2', 's1'), ['Submitted']);                      // only the requester (or a decider) cancels
  assert.deepEqual(to('Submitted', 'Staff', 's1', 's1'), ['Cancelled']);                  // staff cannot start a review
  assert.deepEqual(to('Submitted', 'General Manager', 'g1', 's1'), ['Under Review']);
  assert.deepEqual(to('Under Review', 'General Manager', 'g1', 's1'), []);                // reviewers cannot decide
  assert.deepEqual(to('Under Review', 'Regional Manager', 'r1', 's1'), ['Approved', 'Clarification Required', 'Rejected']);
  assert.deepEqual(to('Approved', 'Staff', 's1', 's1'), ['Issued']);
  assert.deepEqual(to('Issued', 'Staff', 's1', 's1'), ['Completed']);
  for (const final of ['Rejected', 'Completed', 'Cancelled']) assert.deepEqual(to(final, 'Super Admin', 'a', 'b'), []);
});

test('separation of duties: nobody decides a request they raised', () => {
  assert.deepEqual(to('Under Review', 'Admin', 'u1', 'u1'), []);
  assert.deepEqual(to('Under Review', 'Admin', 'u2', 'u1'), ['Approved', 'Clarification Required', 'Rejected']);
});

test('moves are validated: no skipping, reasons and references required', () => {
  assert.ok(validateFundingTransition('Submitted', 'Approved', {}));
  assert.ok(validateFundingTransition('Completed', 'Cancelled', { note: 'reason' }));
  assert.match(validateFundingTransition('Under Review', 'Rejected', { note: ' ' }) || '', /reason/i);
  assert.match(validateFundingTransition('Under Review', 'Clarification Required', {}) || '', /clarification/i);
  assert.ok(validateFundingTransition('Under Review', 'Approved', { paymentAmount: '5' }));                       // no method
  assert.ok(validateFundingTransition('Under Review', 'Approved', { approvedTransportMethod: 'Travelcard', paymentAmount: '-1' }));
  assert.equal(validateFundingTransition('Under Review', 'Approved', { approvedTransportMethod: 'Travelcard', paymentAmount: '0' }), null);
  assert.ok(validateFundingTransition('Approved', 'Issued', {}));
  assert.equal(validateFundingTransition('Approved', 'Issued', { journeyUrn: 'TC-1' }), null);
  assert.ok(validateFundingTransition('Approved', 'Cancelled', {}));                                              // cancelling an approval needs a reason
});

test('site scope: all-site users, or the exact assigned property', () => {
  assert.equal(canActOnFundingSite('Brit Hotel', true, []), true);
  assert.equal(canActOnFundingSite('Brit Hotel', false, ['brit hotel']), true);
  assert.equal(canActOnFundingSite('Other Hotel', false, ['Brit Hotel']), false);
  assert.equal(canActOnFundingSite(undefined, false, ['Brit Hotel']), false);
});

test('generic API: creation is always a draft or a submission by the signed-in user, decisions are dropped', () => {
  const forged = { id: 'x', status: 'Approved', decision: 'Approved', approvedBy: 'me', paymentAmount: 999, journey_urn: 'J', requestedById: 'someone-else', siteName: 'Brit', mainAppRef: 'R' };
  const draft = sanitizeFundingBody(forged, false, { id: 'u1', name: 'User One' });
  assert.equal(draft.status, 'Draft');
  assert.equal(draft.requestedById, 'u1');
  assert.equal(draft.requestedBy, 'User One');
  for (const k of ['decision', 'approvedBy', 'paymentAmount', 'journey_urn']) assert.ok(!(k in draft), `${k} should be dropped`);
  assert.equal(draft.mainAppRef, 'R');
  const submitted = sanitizeFundingBody({ ...forged, status: 'Submitted' }, false, { id: 'u1', email: 'u@x' });
  assert.equal(submitted.status, 'Submitted');
  assert.ok(submitted.submittedAt);
  const update = sanitizeFundingBody({ status: 'Approved', internalComments: 'x', total_cost: 5, totalCost: 5 }, true, { id: 'u1' });
  assert.deepEqual(Object.keys(update).sort(), ['totalCost', 'total_cost']);
  assert.ok(FUNDING_PROTECTED_FIELDS.includes('status') && FUNDING_PROTECTED_FIELDS.includes('journeyUrn'));
});

test('confidential reviewer fields are shown to deciders only', () => {
  const rows = [{ internalComments: 'secret', internal_comments: 'secret', hoInitials: 'HO', status: 'Approved' }];
  const seen = redactSensitiveRows('transport_funding_requests', rows, 'General Manager')[0];
  assert.deepEqual([seen.internalComments, seen.internal_comments, seen.hoInitials, seen.status], [null, null, null, 'Approved']);
  assert.equal(redactSensitiveRows('transport_funding_requests', rows, 'Regional Manager')[0].internalComments, 'secret');
});

test('API policies: funding requests are for site staff and managers; history is read-only and site-scoped', () => {
  for (const name of ['transportFundingRequests', 'transport_funding_requests']) {
    assert.equal(ENTITY_REGISTRY[name].read, 'suEditor');
    assert.equal(ENTITY_REGISTRY[name].write, 'suEditor');
  }
  assert.equal(ENTITY_REGISTRY.transportFundingHistory.write, 'none');
  assert.equal(ENTITY_REGISTRY.transportFundingHistory.remove, 'none');
  assert.deepEqual(TABLE_PARENT_SCOPE.transport_funding_status_history, { linkColumn: 'request_id', linkField: 'requestId', parentTable: 'transport_funding_requests' });
});

test('workflow columns map between the app and the database', () => {
  const back = fromDatabaseRow('transport_funding_requests', { ...toDatabaseRow('transport_funding_requests', { id: 'f1', siteName: 'S', mainAppRef: 'R', mainAppInitials: 'A', status: 'Issued', requestedById: 'u1', issuedBy: 'Staff', completionNotes: 'ok' }), created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' });
  assert.equal(back.requestedById, 'u1');
  assert.equal(back.issuedBy, 'Staff');
  assert.equal(back.completionNotes, 'ok');
});

// The database function repeats the role lists, so a change in one place must be made in the other
test('migration 022 uses the same role lists as the app', () => {
  const sql = fs.readFileSync('db/migrations/022_transport_funding_workflow.sql', 'utf8');
  const list = (name: string) => (sql.match(new RegExp(`${name} TEXT\\[\\] := ARRAY\\[([^\\]]*)\\]`)) || [])[1]?.split(',').map(s => s.trim().replace(/'/g, '')) || [];
  assert.deepEqual(list('deciders'), FUNDING_DECIDER_ROLES);
  assert.deepEqual(list('reviewers'), FUNDING_REVIEWER_ROLES);
  assert.deepEqual(list('site_roles'), FUNDING_SITE_ROLES);
  const schema = fs.readFileSync('db/schema.sql', 'utf8');
  assert.ok(schema.includes(sql.trim()), 'db/schema.sql must include migration 022 verbatim');
});
