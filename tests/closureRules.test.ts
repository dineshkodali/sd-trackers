import test from 'node:test';
import assert from 'node:assert/strict';
import { escalationCloseBlockedReason, complianceCloseBlockedReason, hasEvidenceFile } from '../src/utils/closureRules.ts';

test('an escalation cannot be resolved without a written action', () => {
  assert.ok(escalationCloseBlockedReason({ status: 'Active' }, { status: 'Resolved', actionTaken: '' }));
  assert.ok(escalationCloseBlockedReason({ status: 'Active' }, { status: 'Resolved', actionTaken: 'ok' }));          // too short
  assert.ok(escalationCloseBlockedReason(null, { status: 'Resolved', actionTaken: '   ' }));                           // created already closed
  assert.equal(escalationCloseBlockedReason({ status: 'Active' }, { status: 'Resolved', actionTaken: 'Spoke to resident, referred to housing officer' }), null);
  assert.equal(escalationCloseBlockedReason({ status: 'Active' }, { status: 'Resolved', actionTaken: '', resolutionSummary: 'Resolved after multi-agency meeting' }), null);
});

test('open statuses and already-closed escalations are never blocked', () => {
  assert.equal(escalationCloseBlockedReason({ status: 'Active' }, { status: 'Under Investigation', actionTaken: '' }), null);
  assert.equal(escalationCloseBlockedReason({ status: 'Awaiting Multi-Agency Review' }, { status: 'Active' }), null);
  assert.equal(escalationCloseBlockedReason({ status: 'Resolved' }, { status: 'Resolved', actionTaken: '' }), null);   // closed before the rule existed
});

test('compliance needs an attached document to be Compliant', () => {
  assert.ok(complianceCloseBlockedReason({ status: 'In Progress' }, { status: 'Compliant', attachments: [] }));
  assert.ok(complianceCloseBlockedReason(null, { status: 'Compliant' }));
  assert.equal(complianceCloseBlockedReason({ status: 'In Progress' }, { status: 'Compliant', attachments: [{ name: 'fra.pdf' }] }), null);
  assert.equal(complianceCloseBlockedReason({ status: 'Expired' }, { status: 'Compliant', fileUrl: 'https://x/y.pdf' }), null);
});

test('compliance statuses other than Compliant, and records already Compliant, are not blocked', () => {
  for (const status of ['In Progress', 'Expiring Soon', 'Expired', 'Overdue']) {
    assert.equal(complianceCloseBlockedReason({ status: 'Compliant' }, { status }), null, status);
  }
  assert.equal(complianceCloseBlockedReason({ status: 'Compliant' }, { status: 'Compliant', attachments: [] }), null);
});

test('evidence can be a file list or any of the stored link fields', () => {
  assert.equal(hasEvidenceFile({}), false);
  assert.equal(hasEvidenceFile({ attachments: [] }), false);
  assert.equal(hasEvidenceFile({ attachmentUrl: ' ' }), false);
  assert.equal(hasEvidenceFile({ attachment_url: 'https://x/a' }), true);
  assert.equal(hasEvidenceFile({ attachments: [1] }), true);
});
