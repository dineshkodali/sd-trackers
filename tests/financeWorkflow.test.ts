import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  canRaiseQuery,
  canReplyToQuery,
  canRouteForApproval,
  checkApprover,
  decideApproval,
  statusAfterQueryReply,
  taskForUser,
} from '../server/financeWorkflow';
import { deriveFinanceTaskNotifications, filterNotificationsForRole } from '../src/services/inAppNotificationService';

const UPLOADER = 'u-uploader';
const RM = 'u-rm';
const GM = 'u-gm';
const FIN = 'u-fin-admin';
const SUPER = 'u-super';

const bill = (over: Record<string, any> = {}) => ({
  id: 'b1', billNumber: 'INV-1', status: 'submitted', submittedBy: UPLOADER, totalAmount: 120, siteName: 'Brit Hotel',
  ...over,
});

describe('Finance workflow — sending a bill for confirmation', () => {
  test('Finance or the uploader may choose who confirms; other staff may not', () => {
    assert.equal(canRouteForApproval({ id: FIN, role: 'Admin' }, bill()).ok, true);
    assert.equal(canRouteForApproval({ id: UPLOADER, role: 'Staff' }, bill()).ok, true);
    const other = canRouteForApproval({ id: 'u-x', role: 'Staff' }, bill());
    assert.equal(other.ok, false);
    assert.equal(other.ok === false && other.httpStatus, 403);
  });

  test('a closed bill can no longer be sent for confirmation', () => {
    for (const status of ['approved', 'rejected', 'paid', 'partially_paid', 'cancelled', 'reconciled']) {
      const r = canRouteForApproval({ id: FIN, role: 'Super Admin' }, bill({ status }));
      assert.equal(r.ok, false, status);
      assert.equal(r.ok === false && r.httpStatus, 409, status);
    }
  });

  test('stages that can be (re)sent: submitted, query raised, awaiting approval (change approver), final checks', () => {
    for (const status of ['draft', 'submitted', 'query_raised', 'awaiting_approval', 'under_review']) {
      assert.equal(canRouteForApproval({ id: FIN, role: 'Admin' }, bill({ status })).ok, true, status);
    }
  });

  test('the chosen person must be a manager / Finance team member, or the uploader', () => {
    assert.equal(checkApprover({ id: RM, role: 'Regional Manager' }, bill()).ok, true);
    assert.equal(checkApprover({ id: GM, role: 'General Manager' }, bill()).ok, true);
    assert.equal(checkApprover({ id: 'u-fs', role: 'Finance Staff' }, bill()).ok, true);
    assert.equal(checkApprover({ id: UPLOADER, role: 'Staff' }, bill()).ok, true, 'the uploader can be asked to confirm');
    assert.equal(checkApprover({ id: 'u-staff', role: 'Staff' }, bill()).ok, false);
    assert.equal(checkApprover(null, bill()).ok, false);
  });
});

describe('Finance workflow — confirming and final approval', () => {
  test('the chosen person (any role) confirms and the bill moves to final checks', () => {
    const b = bill({ status: 'awaiting_approval', assignedApproverId: GM });
    const r = decideApproval({ id: GM, role: 'General Manager' }, b);
    assert.deepEqual(r, { ok: true, stage: 'confirm', next: 'under_review' });
    const asUploader = decideApproval({ id: UPLOADER, role: 'Staff' }, bill({ status: 'awaiting_approval', assignedApproverId: UPLOADER }));
    assert.deepEqual(asUploader, { ok: true, stage: 'confirm', next: 'under_review' });
  });

  test('nobody else can confirm a bill assigned to someone; Super Admin can override', () => {
    const b = bill({ status: 'awaiting_approval', assignedApproverId: RM });
    const rival = decideApproval({ id: FIN, role: 'Admin' }, b);
    assert.equal(rival.ok, false);
    assert.equal(rival.ok === false && rival.httpStatus, 403);
    assert.equal(decideApproval({ id: SUPER, role: 'Super Admin' }, b).ok, true);
  });

  test('an unassigned bill can be confirmed by the Finance team only', () => {
    const b = bill({ status: 'awaiting_approval' });
    assert.equal(decideApproval({ id: FIN, role: 'Admin' }, b).ok, true);
    assert.equal(decideApproval({ id: RM, role: 'Regional Manager' }, b).ok, false);
  });

  test('final approval: Admin / Super Admin only, after confirmation, never by the uploader', () => {
    const b = bill({ status: 'under_review', assignedApproverId: RM });
    assert.deepEqual(decideApproval({ id: FIN, role: 'Admin' }, b), { ok: true, stage: 'final', next: 'approved' });
    assert.equal(decideApproval({ id: RM, role: 'Regional Manager' }, b).ok, false);
    assert.equal(decideApproval({ id: 'u-fs', role: 'Finance Staff' }, b).ok, false);
    const self = decideApproval({ id: UPLOADER, role: 'Admin' }, b);
    assert.equal(self.ok, false);
    assert.match(self.ok === false ? self.error : '', /Segregation of duties/);
    assert.equal(decideApproval({ id: UPLOADER, role: 'Super Admin' }, b).ok, true);
  });

  test('a bill cannot be approved straight from submitted, with an open query, or once closed', () => {
    for (const status of ['submitted', 'query_raised', 'approved', 'rejected', 'paid', 'draft']) {
      const r = decideApproval({ id: SUPER, role: 'Super Admin' }, bill({ status }));
      assert.equal(r.ok, false, status);
      assert.equal(r.ok === false && r.httpStatus, 409, status);
    }
  });
});

describe('Finance workflow — sending back with a question', () => {
  test('Finance or the assigned person can ask; others cannot; closed bills cannot', () => {
    const b = bill({ status: 'awaiting_approval', assignedApproverId: RM });
    assert.equal(canRaiseQuery({ id: RM, role: 'Regional Manager' }, b).ok, true);
    assert.equal(canRaiseQuery({ id: FIN, role: 'Admin' }, b).ok, true);
    assert.equal(canRaiseQuery({ id: 'u-x', role: 'Regional Manager' }, b).ok, false);
    assert.equal(canRaiseQuery({ id: UPLOADER, role: 'Staff' }, b).ok, false);
    assert.equal(canRaiseQuery({ id: FIN, role: 'Admin' }, bill({ status: 'approved' })).ok, false);
  });

  test('the uploader / the person it was sent to / Finance may answer', () => {
    const b = bill({ status: 'query_raised' });
    const q = { assigned_to: UPLOADER };
    assert.equal(canReplyToQuery({ id: UPLOADER, role: 'Staff' }, q, b).ok, true);
    assert.equal(canReplyToQuery({ id: FIN, role: 'Admin' }, q, b).ok, true);
    assert.equal(canReplyToQuery({ id: 'u-x', role: 'Staff' }, q, b).ok, false);
  });

  test('after the last open query is answered the bill goes back to where it was', () => {
    assert.equal(statusAfterQueryReply(bill({ status: 'query_raised', status_before_query: 'awaiting_approval' }), 0), 'awaiting_approval');
    assert.equal(statusAfterQueryReply(bill({ status: 'query_raised', status_before_query: 'under_review' }), 0), 'under_review');
    assert.equal(statusAfterQueryReply(bill({ status: 'query_raised', status_before_query: 'awaiting_approval' }), 1), 'query_raised');
    assert.equal(statusAfterQueryReply(bill({ status: 'query_raised', assignedApproverId: RM }), 0), 'awaiting_approval');
    assert.equal(statusAfterQueryReply(bill({ status: 'query_raised' }), 0), 'submitted');
    assert.equal(statusAfterQueryReply(bill({ status: 'query_raised', status_before_query: 'approved' }), 0), 'submitted', 'never jumps to a closed status');
  });
});

describe('Finance workflow — who has something to do', () => {
  test('tasks', () => {
    assert.equal(taskForUser({ id: RM, role: 'Regional Manager' }, bill({ status: 'awaiting_approval', assignedApproverId: RM })), 'confirm');
    assert.equal(taskForUser({ id: GM, role: 'General Manager' }, bill({ status: 'awaiting_approval', assignedApproverId: RM })), null);
    assert.equal(taskForUser({ id: UPLOADER, role: 'Staff' }, bill({ status: 'query_raised' })), 'answer_query');
    assert.equal(taskForUser({ id: FIN, role: 'Admin' }, bill({ status: 'under_review' })), 'final_check');
    assert.equal(taskForUser({ id: RM, role: 'Regional Manager' }, bill({ status: 'under_review' })), null);
  });
});

describe('Finance workflow — notifications', () => {
  const now = Date.parse('2026-10-13T12:00:00Z');
  const recent = '2026-10-13T10:00:00Z';
  const bills = [
    bill({ id: 'b-confirm', billNumber: 'INV-C', status: 'awaiting_approval', assignedApproverId: RM, assignedApproverName: 'Rita RM', updatedAt: recent }),
    bill({ id: 'b-query', billNumber: 'INV-Q', status: 'query_raised', updatedAt: recent }),
    bill({ id: 'b-final', billNumber: 'INV-F', status: 'under_review', assignedApproverName: 'Rita RM', updatedAt: recent }),
    bill({ id: 'b-ok', billNumber: 'INV-OK', status: 'approved', finalApprovedByName: 'Fin Admin', updatedAt: recent }),
    bill({ id: 'b-old', billNumber: 'INV-OLD', status: 'approved', updatedAt: '2026-01-01T00:00:00Z' }),
    bill({ id: 'b-rej', billNumber: 'INV-REJ', status: 'rejected', rejectionReason: 'Duplicate', updatedAt: recent }),
  ];

  test('the person asked to confirm is notified', () => {
    const n = deriveFinanceTaskNotifications(bills, { id: RM, role: 'Regional Manager' }, now);
    assert.equal(n.length, 1);
    assert.match(n[0].title, /confirm bill INV-C/);
    assert.equal(n[0].type, 'urgent');
    assert.equal(n[0].targetUserId, RM);
    assert.equal(n[0].linkPage, 'financeApprovals');
  });

  test('the uploader is told about questions and recent outcomes (not old ones)', () => {
    const titles = deriveFinanceTaskNotifications(bills, { id: UPLOADER, role: 'Staff' }, now).map(n => n.title);
    assert.ok(titles.some(t => /Information needed on bill INV-Q/.test(t)));
    assert.ok(titles.some(t => /INV-OK approved/.test(t)));
    assert.ok(titles.some(t => /INV-REJ rejected/.test(t)));
    assert.ok(!titles.some(t => /INV-OLD/.test(t)));
    assert.ok(!titles.some(t => /INV-F/.test(t)), 'uploader is not told to final-check their own bill');
  });

  test('Finance admins are told when a bill reaches final checks', () => {
    const n = deriveFinanceTaskNotifications(bills, { id: FIN, role: 'Admin' }, now);
    assert.deepEqual(n.map(x => x.title), ['Ready for final checks: bill INV-F']);
    assert.equal(deriveFinanceTaskNotifications(bills, { id: RM, role: 'Regional Manager' }, now).some(x => /final checks/.test(x.title)), false);
  });

  test('a task notification is only ever visible to the person it is addressed to', () => {
    const mine = deriveFinanceTaskNotifications(bills, { id: RM, role: 'Regional Manager' }, now);
    const asRm = filterNotificationsForRole({ notifications: mine, userRole: 'Regional Manager', assignedSite: 'Other Site', currentUserName: 'Rita RM', authProfileId: RM });
    assert.equal(asRm.length, 1);
    const asOtherRm = filterNotificationsForRole({ notifications: mine, userRole: 'Regional Manager', assignedSite: 'Brit Hotel', allowedSites: ['Brit Hotel'], currentUserName: 'Other', authProfileId: GM });
    assert.equal(asOtherRm.length, 0);
    const asStaff = filterNotificationsForRole({ notifications: mine, userRole: 'Staff', assignedSite: 'Brit Hotel', currentUserName: 'Sam', authProfileId: UPLOADER });
    assert.equal(asStaff.length, 0);
  });

  test('the notification disappears once the task is done', () => {
    const done = bills.map(b => (b.id === 'b-confirm' ? { ...b, status: 'under_review' } : b));
    assert.equal(deriveFinanceTaskNotifications(done, { id: RM, role: 'Regional Manager' }, now).length, 0);
  });
});
