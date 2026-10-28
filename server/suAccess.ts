/**
 * Server-side role rules for the Service User enhancements (HC2, Oyster cards, meals, education, families, archive).
 * Kept in one dependency-free module so the API routes and the unit tests apply exactly the same rules.
 */

/** Roles that manage Service User records. Mirrors src/utils/suTrackerAccess.ts. */
export const SU_MANAGER_ROLES = ['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager'];
/** Roles that may record SU tracker data (managers plus front-line staff). */
export const SU_EDITOR_ROLES = [...SU_MANAGER_ROLES, 'Staff'];
/** Roles that may approve or reject an archive/restore request. A requester can never decide their own request. */
export const SU_ARCHIVE_APPROVER_ROLES = ['Super Admin', 'Admin', 'Regional Manager'];
/** Roles that may raise an archive/restore request (also needs role_permissions.canArchiveRestore). */
export const SU_ARCHIVE_REQUESTER_ROLES = SU_MANAGER_ROLES;

import { FUNDING_DECIDER_ROLES } from '../src/utils/fundingWorkflow.js';

/**
 * Funding request fields that only the approval workflow may set. The generic API drops them from every write, and the
 * database trigger (migration 022) refuses them as well.
 */
export const FUNDING_PROTECTED_FIELDS = [
  'status', 'hoInitials', 'decision', 'rejectionReason', 'approvedTransportMethod', 'paymentAmount', 'journeyUrn', 'approvedBy',
  'approvalDate', 'internalComments', 'requestedById', 'requestedBy', 'submittedAt', 'reviewedBy', 'reviewedAt', 'issuedBy',
  'issuedAt', 'completedAt', 'completionNotes'
];
const snakeOf = (f: string) => f.replace(/[A-Z]/g, c => '_' + c.toLowerCase());

/**
 * Clean a funding request body arriving at the generic API.
 *  - create: always a draft or a submission; the requester is the signed-in user, never what the client says;
 *  - update: status and decision details are removed (they change only through the workflow endpoint).
 */
export function sanitizeFundingBody<T extends Record<string, any>>(body: T, isUpdate: boolean, user?: { id?: string; name?: string; email?: string }): Record<string, any> {
  const copy: Record<string, any> = { ...body };
  const wanted = copy.status;
  for (const f of FUNDING_PROTECTED_FIELDS) { delete copy[f]; delete copy[snakeOf(f)]; }
  if (isUpdate) return copy;
  copy.status = wanted === 'Submitted' ? 'Submitted' : 'Draft';
  copy.requestedById = user?.id || null;
  copy.requestedBy = user?.name || user?.email || null;
  if (copy.status === 'Submitted') copy.submittedAt = new Date().toISOString();
  return copy;
}

/**
 * Oyster card writes through the generic API: registering a card (reference, property, opening balance, notes) and editing
 * its details. Holder, issue details and balance changes are not accepted here: they go through the issue / return / balance
 * actions so that every change is recorded with a reason.
 */
export function sanitizeOysterCardBody<T extends Record<string, any>>(body: T, isUpdate: boolean, user?: { name?: string; email?: string }): Record<string, any> {
  const copy: Record<string, any> = { ...body };
  for (const f of ['suId', 'issuedDate', 'issuedBy', 'balanceUpdatedAt', 'balanceUpdatedBy', 'su_id', 'issued_date', 'issued_by', 'balance_updated_at', 'balance_updated_by']) delete copy[f];
  if (isUpdate) {
    delete copy.currentBalance; delete copy.current_balance;
  } else {
    copy.status = 'Available';
    copy.createdBy = user?.name || user?.email;
  }
  copy.updatedBy = user?.name || user?.email;
  return copy;
}

/** Confidential reviewer fields, shown to deciders only. */
export const FUNDING_DECIDER_ONLY_FIELDS = ['internal_comments', 'ho_initials'];
export const isFundingDecider = (role?: string) => FUNDING_DECIDER_ROLES.includes(role || '');

export const isSuManager = (role?: string) => SU_MANAGER_ROLES.includes(role || '');
export const isSuEditor = (role?: string) => SU_EDITOR_ROLES.includes(role || '');
export const isArchiveApprover = (role?: string) => SU_ARCHIVE_APPROVER_ROLES.includes(role || '');

/**
 * Fields only managers may read. Other roles get them as null so a front-line user can still see that an HC2 or
 * Oyster card exists (status, dates) without the identifier or the document.
 */
export const SENSITIVE_READ_FIELDS: Record<string, string[]> = {
  su_hc2_details: ['reference_number', 'document_path', 'document_name'],
};

/** Fields shown masked (last 4 characters) instead of blank, so front-line staff can still recognise a card. */
const MASKED_FIELDS = new Set(['card_ref']);

export function maskIdentifier(value?: string | null): string | null {
  const v = (value || '').trim();
  if (!v) return null;
  return v.length <= 4 ? '••••' : `••••${v.slice(-4)}`;
}

const camelOf = (f: string) => f.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export function redactSensitiveRows<T extends Record<string, any>>(table: string, rows: T[], role?: string): T[] {
  if (table === 'transport_funding_requests' && !isFundingDecider(role)) {
    return rows.map(row => {
      const copy: Record<string, any> = { ...row };
      for (const f of FUNDING_DECIDER_ONLY_FIELDS) { if (f in copy) copy[f] = null; if (camelOf(f) in copy) copy[camelOf(f)] = null; }
      return copy as T;
    });
  }
  const fields = SENSITIVE_READ_FIELDS[table];
  if (!fields || isSuManager(role)) return rows;
  return rows.map(row => {
    const copy: Record<string, any> = { ...row };
    for (const f of fields) {
      for (const key of [f, camelOf(f)]) {
        if (key in copy) copy[key] = MASKED_FIELDS.has(f) ? maskIdentifier(copy[key]) : null;
      }
    }
    return copy as T;
  });
}

/**
 * Non-managers receive redacted values, so they must never be able to write them back: on update the sensitive
 * fields are dropped from the request. (On create they may be supplied, e.g. the card reference being issued.)
 */
export function stripSensitiveUpdateFields<T extends Record<string, any>>(table: string, body: T, role?: string): T {
  const fields = SENSITIVE_READ_FIELDS[table];
  if (!fields || isSuManager(role)) return body;
  const copy: Record<string, any> = { ...body };
  for (const f of fields) { delete copy[f]; delete copy[camelOf(f)]; }
  return copy as T;
}

export { isChildByDob } from '../src/utils/suEnhancementsLogic.js';

export type ArchiveCheck = { ok: boolean; status: number; error: string };

/** Who may raise a request, checked before the database function runs (the database re-checks the hard rules). */
export function checkArchiveRequester(role: string | undefined, canArchiveRestore: boolean): ArchiveCheck {
  if (!SU_ARCHIVE_REQUESTER_ROLES.includes(role || '') || !canArchiveRestore) {
    return { ok: false, status: 403, error: 'You do not have permission to request archiving.' };
  }
  return { ok: true, status: 200, error: '' };
}

/** Who may approve/reject. Cancelling is limited to the requester, which the database function enforces. */
export function checkArchiveDecider(role: string | undefined, userId: string, requestedById: string, decision: string): ArchiveCheck {
  if (decision === 'Cancelled') return { ok: true, status: 200, error: '' };
  if (!isArchiveApprover(role)) return { ok: false, status: 403, error: 'You do not have permission to approve or reject archive requests.' };
  if (userId === requestedById) return { ok: false, status: 403, error: 'You cannot approve or reject your own request.' };
  return { ok: true, status: 200, error: '' };
}

/** Map a Postgres error raised by the workflow functions to an HTTP status. */
export function httpStatusForDbError(err: { code?: string } | null | undefined): number {
  switch (err?.code) {
    case '42501': return 403;
    case 'P0002': return 404;
    case '23505': return 409;
    case '22023': return 400;
    default: return 500;
  }
}
