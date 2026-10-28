import { Router, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../supabase.js';
import { userCanAccessAllSites, getUserAssignedSites, recordAuditTrailEntry } from './db.js';
import { httpStatusForDbError } from '../suAccess.js';
import { availableFundingTransitions, validateFundingTransition, canActOnFundingSite } from '../../src/utils/fundingWorkflow.js';

/**
 * Transport funding request workflow.
 *
 * POST /api/transport-funding/:id/transition  { to, note, approvedTransportMethod, paymentAmount, journeyUrn, completionNotes }
 *
 * The role, the site, the move and the required details are checked here for a clear message, and again by the database
 * function transition_transport_funding (migration 022), which is the only thing allowed to change a request's status.
 */
const router = Router();

const cleanText = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function db(res: Response): SupabaseClient | null {
  const client = isSupabaseConfigured() ? getSupabaseAdmin() : null;
  if (!client) {
    res.status(503).json({ success: false, error: 'Live database is not configured on the server. Changes cannot be saved.' });
    return null;
  }
  return client;
}

router.post('/:id/transition', async (req: Request, res: Response) => {
  const client = db(res);
  if (!client || !req.user) return;
  const to = cleanText(req.body?.to, 40);
  const input = {
    note: cleanText(req.body?.note),
    approvedTransportMethod: cleanText(req.body?.approvedTransportMethod, 200),
    paymentAmount: req.body?.paymentAmount === undefined || req.body?.paymentAmount === null ? '' : String(req.body.paymentAmount).trim(),
    journeyUrn: cleanText(req.body?.journeyUrn, 200),
    completionNotes: cleanText(req.body?.completionNotes)
  };

  const { data: current } = await client.from('transport_funding_requests').select('id, site_name, status, requested_by_id').eq('id', req.params.id).maybeSingle();
  if (!current) return res.status(404).json({ success: false, error: 'Funding request not found.' });
  if (!canActOnFundingSite(current.site_name, userCanAccessAllSites(req.user), getUserAssignedSites(req.user))) {
    return res.status(404).json({ success: false, error: 'Funding request not found.' });      // out-of-scope requests look absent
  }

  const options = availableFundingTransitions(current.status, req.user.role, req.user.id, current.requested_by_id || undefined);
  if (!options.some(o => o.to === to)) {
    const message = validateFundingTransition(current.status, to, input);
    const status = message ? 409 : 403;
    return res.status(status).json({ success: false, error: message || 'You cannot make this change to the request.' });
  }
  const invalid = validateFundingTransition(current.status, to, input);
  if (invalid) return res.status(400).json({ success: false, error: invalid });

  const { data, error } = await client.rpc('transition_transport_funding', {
    p_id: current.id, p_to: to, p_note: input.note, p_user_id: req.user.id, p_user_name: req.user.name || req.user.email,
    p_role: req.user.role,
    p_fields: {
      approvedTransportMethod: input.approvedTransportMethod, paymentAmount: input.paymentAmount,
      journeyUrn: input.journeyUrn, completionNotes: input.completionNotes
    }
  });
  if (error) return res.status(httpStatusForDbError(error)).json({ success: false, error: error.message });

  recordAuditTrailEntry(req, {
    defaultAction: 'UPDATE', entity: 'transportFundingRequests', entityId: current.id, site: current.site_name,
    defaultDetails: `Funding request moved from ${current.status} to ${to}${input.note ? `. Note: ${input.note}` : ''}`
  });
  res.json({ success: true, request: data });
});

export default router;
