/**
 * Finance bill workflow rules (pure functions, no I/O).
 *
 *   submitted ──(Finance / uploader chooses who confirms)──▶ awaiting_approval
 *   awaiting_approval ──(chosen person confirms)──▶ under_review  ("final checks")
 *   awaiting_approval | under_review ──(send back / query)──▶ query_raised ──(reply)──▶ back to where it was
 *   under_review ──(Finance final approval)──▶ approved
 *   any open stage ──(reject)──▶ rejected
 *
 * The routes in routes/finance.ts call these so the rules live in one tested place.
 */

export interface Caller {
  id?: string;
  role?: string;
}

export interface WorkflowBill {
  status?: string;
  submitted_by?: string;
  submittedBy?: string;
  assigned_approver_id?: string | null;
  assignedApproverId?: string | null;
  status_before_query?: string | null;
}

export type Decision<T = {}> = ({ ok: true } & T) | { ok: false; httpStatus: number; error: string };

/** Roles that work in the Finance team: they route bills, send queries and give final approval (Admin / Super Admin). */
export const FINANCE_ROLES = ['Super Admin', 'Admin', 'Finance Staff'];
/** Roles that can be chosen to confirm a bill (the uploader can always be chosen too). */
export const APPROVER_ROLES = ['Regional Manager', 'General Manager', 'Admin', 'Super Admin', 'Finance Staff'];
/** Stages from which a bill can be (re)sent to someone for confirmation. */
export const ROUTABLE_STATUSES = ['draft', 'submitted', 'verification_pending', 'query_raised', 'awaiting_approval', 'under_review'];

const submitterOf = (b: WorkflowBill): string => String(b.submitted_by || b.submittedBy || '');
const assigneeOf = (b: WorkflowBill): string => String(b.assigned_approver_id || b.assignedApproverId || '');

export const isFinanceRole = (role?: string): boolean => FINANCE_ROLES.includes(String(role || ''));

/** Finance (or the person who uploaded the bill) may choose who confirms it. */
export function canRouteForApproval(caller: Caller, bill: WorkflowBill): Decision {
  if (!ROUTABLE_STATUSES.includes(String(bill.status || 'submitted'))) {
    return { ok: false, httpStatus: 409, error: `A bill that is "${String(bill.status).replace(/_/g, ' ')}" can no longer be sent for confirmation.` };
  }
  const isUploader = !!caller.id && caller.id === submitterOf(bill);
  if (!isFinanceRole(caller.role) && !isUploader) {
    return { ok: false, httpStatus: 403, error: 'Only the Finance team or the person who uploaded the bill can choose who confirms it.' };
  }
  return { ok: true };
}

/** The chosen person must be a real user in an approver role, or the person who uploaded the bill. */
export function checkApprover(approver: { id?: string; role?: string } | null | undefined, bill: WorkflowBill): Decision {
  if (!approver || !approver.id) return { ok: false, httpStatus: 400, error: 'Choose the person who should confirm this bill.' };
  if (approver.id === submitterOf(bill)) return { ok: true };
  if (!APPROVER_ROLES.includes(String(approver.role || ''))) {
    return { ok: false, httpStatus: 400, error: 'That person cannot confirm bills. Choose a manager, Finance team member or the uploader.' };
  }
  return { ok: true };
}

export type ApprovalStage = 'confirm' | 'final';

/**
 * Stage 1 (awaiting_approval): the chosen person confirms -> final checks (under_review).
 * Stage 2 (under_review): Finance (Admin / Super Admin) gives final approval.
 */
export function decideApproval(caller: Caller, bill: WorkflowBill): Decision<{ stage: ApprovalStage; next: 'under_review' | 'approved' }> {
  const status = String(bill.status || '');
  const isSuper = caller.role === 'Super Admin';

  if (status === 'awaiting_approval') {
    const assignee = assigneeOf(bill);
    if (assignee) {
      if (caller.id !== assignee && !isSuper) {
        return { ok: false, httpStatus: 403, error: 'This bill is assigned to someone else. Only the chosen person may confirm it.' };
      }
    } else if (!isFinanceRole(caller.role)) {
      return { ok: false, httpStatus: 403, error: 'Only the Finance team can confirm a bill that has not been assigned.' };
    }
    return { ok: true, stage: 'confirm', next: 'under_review' };
  }

  if (status === 'under_review') {
    if (!['Admin', 'Super Admin'].includes(String(caller.role || ''))) {
      return { ok: false, httpStatus: 403, error: 'Only Finance (Admin / Super Admin) can grant final approval.' };
    }
    if (caller.id && caller.id === submitterOf(bill) && !isSuper) {
      return { ok: false, httpStatus: 403, error: 'Segregation of duties: Submitter cannot grant final approval' };
    }
    return { ok: true, stage: 'final', next: 'approved' };
  }

  if (status === 'query_raised') {
    return { ok: false, httpStatus: 409, error: 'A query is still open on this bill. It continues once the query has been answered.' };
  }
  return { ok: false, httpStatus: 409, error: 'This bill is not waiting for confirmation or final approval.' };
}

/** Who may send a bill back / raise a query: Finance, or the person it is currently assigned to. */
export function canRaiseQuery(caller: Caller, bill: WorkflowBill): Decision {
  const assignee = assigneeOf(bill);
  if (isFinanceRole(caller.role) || (assignee && caller.id === assignee)) {
    if (['approved', 'paid', 'rejected', 'cancelled'].includes(String(bill.status))) {
      return { ok: false, httpStatus: 409, error: 'This bill is already closed.' };
    }
    return { ok: true };
  }
  return { ok: false, httpStatus: 403, error: 'Only the Finance team or the person assigned to this bill can send it back with a query.' };
}

/** Who may answer a query: whoever it was sent to, the uploader, or Finance. */
export function canReplyToQuery(caller: Caller, query: { assigned_to?: string | null }, bill: WorkflowBill): Decision {
  if (isFinanceRole(caller.role)) return { ok: true };
  if (caller.id && (caller.id === String(query.assigned_to || '') || caller.id === submitterOf(bill))) return { ok: true };
  return { ok: false, httpStatus: 403, error: 'This query was sent to someone else.' };
}

/** Status a bill goes back to once every open query has been answered. */
export function statusAfterQueryReply(bill: WorkflowBill, stillOpenQueries: number): string {
  if (stillOpenQueries > 0) return 'query_raised';
  const before = String(bill.status_before_query || '');
  if (['awaiting_approval', 'under_review', 'submitted'].includes(before)) return before;
  return assigneeOf(bill) ? 'awaiting_approval' : 'submitted';
}

/** The task a user has been given on a bill, if any (drives notifications and "my tasks"). */
export type BillTask = 'confirm' | 'answer_query' | 'final_check' | null;
export function taskForUser(user: { id?: string; role?: string }, bill: WorkflowBill): BillTask {
  const status = String(bill.status || '');
  if (status === 'awaiting_approval' && user.id && assigneeOf(bill) === user.id) return 'confirm';
  if (status === 'query_raised' && user.id && submitterOf(bill) === user.id) return 'answer_query';
  if (status === 'under_review' && ['Admin', 'Super Admin'].includes(String(user.role || ''))) return 'final_check';
  return null;
}
