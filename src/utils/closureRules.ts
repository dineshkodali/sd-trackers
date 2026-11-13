/**
 * "Closed needs proof" rules for trackers other than Maintenance (which has its own in maintenancePriority.ts).
 *
 * Each function returns why a change must be refused, or null when it may go ahead. Only the MOMENT of closing is
 * checked - a record that is already closed (saved before these rules) can still be edited - and `current` is null when
 * a record is being created. Everything that is not closed is simply open: shown as Active / In Progress / Due.
 */

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export const ESCALATION_CLOSED = ['Resolved', 'Closed'] as const;
export const COMPLIANCE_CLOSED = ['Compliant'] as const;
/** Fewest characters an escalation's "Action Taken" must have before it can be resolved */
export const MIN_ACTION_TAKEN_CHARS = 10;

export const isEscalationClosed = (r?: { status?: string } | null) => !!r && (ESCALATION_CLOSED as readonly string[]).includes(String(r.status));
export const isComplianceClosed = (r?: { status?: string } | null) => !!r && (COMPLIANCE_CLOSED as readonly string[]).includes(String(r.status));

/** An escalation can only be resolved once what was done about it is written down. */
export function escalationCloseBlockedReason(
  current: { status?: string } | null | undefined,
  merged: { status?: string; actionTaken?: string; resolutionSummary?: string }
): string | null {
  if (isEscalationClosed(current) || !isEscalationClosed(merged)) return null;
  const done = text(merged.actionTaken).length >= MIN_ACTION_TAKEN_CHARS || text(merged.resolutionSummary).length >= MIN_ACTION_TAKEN_CHARS;
  return done ? null : `Write what was done in "Action Taken" (at least ${MIN_ACTION_TAKEN_CHARS} characters) before marking this escalation Resolved.`;
}

interface HasEvidence {
  attachments?: unknown[];
  attachmentUrl?: string;
  attachment_url?: string;
  fileUrl?: string;
  file_url?: string;
}

export const hasEvidenceFile = (r: HasEvidence): boolean =>
  (Array.isArray(r.attachments) && r.attachments.length > 0) || !!(text(r.attachmentUrl) || text(r.attachment_url) || text(r.fileUrl) || text(r.file_url));

/** A compliance record can only be marked Compliant with its certificate or evidence document attached. */
export function complianceCloseBlockedReason(
  current: { status?: string } | null | undefined,
  merged: { status?: string } & HasEvidence
): string | null {
  if (isComplianceClosed(current) || !isComplianceClosed(merged)) return null;
  return hasEvidenceFile(merged) ? null : 'Attach the certificate or evidence document before marking this record Compliant.';
}
