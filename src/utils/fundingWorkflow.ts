/**
 * Transport funding request (travelcard and exceptional transport) workflow.
 *
 * Six stages, kept deliberately simple:
 *   1 Draft  ->  2 Submitted  ->  3 Under Review  ->  4 Decision (Approved / Rejected / Clarification Required)
 *     ->  5 Issued (travelcard or transport arranged)  ->  6 Completed
 * Cancelled, Rejected and Completed are final. Clarification Required sends the request back to the site to resubmit.
 *
 * The same rules are enforced by the server (server/routes/transportFunding.ts) and by the database function
 * transition_transport_funding (migration 022); this file lets the screen show only what the user can really do.
 */

export const FUNDING_STAGES = [
  { n: 1, label: 'Draft', statuses: ['Draft'] },
  { n: 2, label: 'Submitted', statuses: ['Submitted', 'Clarification Required'] },
  { n: 3, label: 'Under review', statuses: ['Under Review'] },
  { n: 4, label: 'Decision', statuses: ['Approved', 'Rejected'] },
  { n: 5, label: 'Issued', statuses: ['Issued'] },
  { n: 6, label: 'Completed', statuses: ['Completed'] }
] as const;

export type FundingStatus =
  | 'Draft' | 'Submitted' | 'Under Review' | 'Clarification Required' | 'Approved' | 'Rejected' | 'Issued' | 'Completed' | 'Cancelled';

export const FINAL_FUNDING_STATUSES: readonly string[] = ['Rejected', 'Completed', 'Cancelled'];

/** Roles that may take a request into review. */
export const FUNDING_REVIEWER_ROLES = ['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager'];
/** Roles that may approve, reject or ask for clarification (never on a request they raised themselves). */
export const FUNDING_DECIDER_ROLES = ['Super Admin', 'Admin', 'Regional Manager'];
/** Roles that may raise, resubmit, issue and complete requests for their sites. */
export const FUNDING_SITE_ROLES = ['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager', 'Staff'];

type Actor = 'site' | 'reviewer' | 'decider' | 'requesterOrDecider';

interface Edge { to: FundingStatus; actor: Actor; label: string; note?: 'required' | 'optional'; fields?: Array<'approvedTransportMethod' | 'paymentAmount' | 'journeyUrn' | 'completionNotes'> }

const EDGES: Record<string, Edge[]> = {
  'Draft': [
    { to: 'Submitted', actor: 'site', label: 'Submit request' },
    { to: 'Cancelled', actor: 'requesterOrDecider', label: 'Cancel request', note: 'optional' }
  ],
  'Submitted': [
    { to: 'Under Review', actor: 'reviewer', label: 'Start review' },
    { to: 'Cancelled', actor: 'requesterOrDecider', label: 'Cancel request', note: 'optional' }
  ],
  'Clarification Required': [
    { to: 'Submitted', actor: 'site', label: 'Resubmit with the missing information', note: 'optional' },
    { to: 'Cancelled', actor: 'requesterOrDecider', label: 'Cancel request', note: 'optional' }
  ],
  'Under Review': [
    { to: 'Approved', actor: 'decider', label: 'Approve', fields: ['approvedTransportMethod', 'paymentAmount'] },
    { to: 'Clarification Required', actor: 'decider', label: 'Ask for clarification', note: 'required' },
    { to: 'Rejected', actor: 'decider', label: 'Reject', note: 'required' }
  ],
  'Approved': [
    { to: 'Issued', actor: 'site', label: 'Mark travelcard / transport issued', fields: ['journeyUrn'] },
    { to: 'Cancelled', actor: 'decider', label: 'Cancel approval', note: 'required' }
  ],
  'Issued': [
    { to: 'Completed', actor: 'site', label: 'Mark journey completed', fields: ['completionNotes'] },
    { to: 'Cancelled', actor: 'decider', label: 'Cancel request', note: 'required' }
  ]
};

export const stageOf = (status: string): number => {
  const hit = FUNDING_STAGES.find(s => (s.statuses as readonly string[]).includes(status));
  return hit ? hit.n : 0;     // Cancelled sits outside the six stages
};

function actorAllowed(actor: Actor, role: string, userId: string | undefined, requestedById: string | undefined): boolean {
  switch (actor) {
    case 'site': return FUNDING_SITE_ROLES.includes(role);
    case 'reviewer': return FUNDING_REVIEWER_ROLES.includes(role);
    case 'decider': return FUNDING_DECIDER_ROLES.includes(role);
    case 'requesterOrDecider': return FUNDING_DECIDER_ROLES.includes(role) || (!!userId && userId === requestedById);
  }
}

/** The moves the signed-in user can make on a request right now. */
export function availableFundingTransitions(status: string, role: string, userId?: string, requestedById?: string): Edge[] {
  return (EDGES[status] || []).filter(e => {
    if (!actorAllowed(e.actor, role, userId, requestedById)) return false;
    // Separation of duties: nobody decides a request they raised themselves
    if (e.actor === 'decider' && ['Approved', 'Rejected', 'Clarification Required'].includes(e.to) && userId && userId === requestedById) return false;
    return true;
  });
}

export interface TransitionInput { note?: string; approvedTransportMethod?: string; paymentAmount?: number | string; journeyUrn?: string; completionNotes?: string }

/** A message when the move cannot be made as entered, otherwise null. */
export function validateFundingTransition(from: string, to: string, input: TransitionInput): string | null {
  const edge = (EDGES[from] || []).find(e => e.to === to);
  if (!edge) return `A request that is ${from.toLowerCase()} cannot move to ${to.toLowerCase()}.`;
  if (edge.note === 'required' && (input.note || '').trim().length < 3) {
    return to === 'Rejected' ? 'Enter the reason for rejecting this request.' : to === 'Clarification Required' ? 'Say what clarification is needed.' : 'Enter a reason.';
  }
  if (to === 'Approved') {
    if (!(input.approvedTransportMethod || '').trim()) return 'Choose the approved transport method.';
    if (input.paymentAmount === undefined || input.paymentAmount === '' || !(Number(input.paymentAmount) >= 0)) return 'Enter the approved amount (zero or more).';
  }
  if (to === 'Issued' && !(input.journeyUrn || '').trim()) return 'Enter the travelcard or journey reference.';
  return null;
}

/** Site access: a user may act on a request only for a property they can see. */
export function canActOnFundingSite(siteName: string | undefined, allSites: boolean, assignedSites: string[]): boolean {
  if (allSites) return true;
  if (!siteName) return false;
  const s = siteName.trim().toLowerCase();
  return assignedSites.some(a => a && a.trim().toLowerCase() === s);
}
