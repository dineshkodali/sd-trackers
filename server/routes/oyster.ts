import { Router, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../supabase.js';
import { userCanAccessAllSites, getUserAssignedSites, recordAuditTrailEntry } from './db.js';
import { httpStatusForDbError, isSuEditor } from '../suAccess.js';
import { canActOnFundingSite } from '../../src/utils/fundingWorkflow.js';
import { visibleServiceUser } from './suEnhancements.js';

/**
 * Oyster card issue, return and balance updates.
 *
 * Each action is one database function (migration 023) that locks the card, checks it is available at the right property,
 * writes the loan and the history, and moves a linked funding request on. The role and the property are checked here too,
 * so out-of-scope cards and requests look absent to the caller.
 */
const router = Router();

const cleanText = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown): number | null => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const isoDay = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function db(res: Response): SupabaseClient | null {
  const client = isSupabaseConfigured() ? getSupabaseAdmin() : null;
  if (!client) {
    res.status(503).json({ success: false, error: 'Live database is not configured on the server. Changes cannot be saved.' });
    return null;
  }
  return client;
}

function siteInScope(req: Request, siteName?: string | null) {
  return canActOnFundingSite(siteName || undefined, userCanAccessAllSites(req.user), getUserAssignedSites(req.user));
}

const who = (req: Request) => req.user!.name || req.user!.email;

// POST /api/oyster/issue  { cardId, suId, fundingRequestId?, balance, issuedDate? }
router.post('/issue', async (req: Request, res: Response) => {
  const client = db(res);
  if (!client || !req.user) return;
  if (!isSuEditor(req.user.role)) return res.status(403).json({ success: false, error: 'Insufficient privileges for this operation' });
  const cardId = cleanText(req.body?.cardId, 200);
  const suId = cleanText(req.body?.suId, 200);
  const fundingRequestId = cleanText(req.body?.fundingRequestId, 200) || null;
  const balance = num(req.body?.balance);
  if (!cardId || !suId) return res.status(400).json({ success: false, error: 'Choose the card and the Service User.' });
  if (balance === null || balance < 0) return res.status(400).json({ success: false, error: 'Enter the balance on the card at handover.' });

  const { data: card } = await client.from('oyster_cards').select('id, site_name, card_ref').eq('id', cardId).maybeSingle();
  if (!card || !siteInScope(req, card.site_name)) return res.status(404).json({ success: false, error: 'Card not found.' });
  if (!(await visibleServiceUser(client, req, suId))) return res.status(404).json({ success: false, error: 'Service User not found.' });
  if (fundingRequestId) {
    const { data: fr } = await client.from('transport_funding_requests').select('id, site_name').eq('id', fundingRequestId).maybeSingle();
    if (!fr || !siteInScope(req, fr.site_name)) return res.status(404).json({ success: false, error: 'Funding request not found.' });
  }

  const { data, error } = await client.rpc('issue_oyster_card', {
    p_card_id: cardId, p_su_id: suId, p_funding_request_id: fundingRequestId, p_balance: balance, p_issued_date: isoDay(req.body?.issuedDate),
    p_user_id: req.user.id, p_user_name: who(req), p_role: req.user.role
  });
  if (error) return res.status(httpStatusForDbError(error)).json({ success: false, error: error.message });

  recordAuditTrailEntry(req, {
    defaultAction: 'UPDATE', entity: 'oysterCards', entityId: cardId, site: card.site_name,
    defaultDetails: `Issued Oyster card ${card.card_ref} to Service User [${suId}] with £${balance.toFixed(2)}${fundingRequestId ? ` for funding request [${fundingRequestId}]` : ''}`
  });
  res.status(201).json({ success: true, transaction: data });
});

// POST /api/oyster/transactions/:id/return  { balance, condition: 'Good' | 'Damaged' | 'Lost', notes, returnedDate? }
router.post('/transactions/:id/return', async (req: Request, res: Response) => {
  const client = db(res);
  if (!client || !req.user) return;
  if (!isSuEditor(req.user.role)) return res.status(403).json({ success: false, error: 'Insufficient privileges for this operation' });
  const condition = cleanText(req.body?.condition, 20);
  const balance = num(req.body?.balance);
  if (!['Good', 'Damaged', 'Lost'].includes(condition)) return res.status(400).json({ success: false, error: 'Choose the condition of the card.' });
  if (condition !== 'Lost' && (balance === null || balance < 0)) return res.status(400).json({ success: false, error: 'Enter the actual remaining balance on the card.' });

  const { data: txn } = await client.from('oyster_card_transactions').select('id, site_name, card_ref, su_id').eq('id', req.params.id).maybeSingle();
  if (!txn || !siteInScope(req, txn.site_name)) return res.status(404).json({ success: false, error: 'Transaction not found.' });

  const { data, error } = await client.rpc('return_oyster_card', {
    p_txn_id: txn.id, p_balance_at_return: condition === 'Lost' ? null : balance, p_condition: condition, p_notes: cleanText(req.body?.notes),
    p_returned_date: isoDay(req.body?.returnedDate), p_user_id: req.user.id, p_user_name: who(req), p_role: req.user.role
  });
  if (error) return res.status(httpStatusForDbError(error)).json({ success: false, error: error.message });

  recordAuditTrailEntry(req, {
    defaultAction: 'UPDATE', entity: 'oysterCards', entityId: txn.id, site: txn.site_name,
    defaultDetails: `Oyster card ${txn.card_ref} ${condition === 'Lost' ? 'written off as lost' : `returned (${condition.toLowerCase()}) with £${(balance ?? 0).toFixed(2)}`} by Service User [${txn.su_id}]`
  });
  res.json({ success: true, transaction: data });
});

// POST /api/oyster/cards/:id/balance  { balance, note }
router.post('/cards/:id/balance', async (req: Request, res: Response) => {
  const client = db(res);
  if (!client || !req.user) return;
  if (!isSuEditor(req.user.role)) return res.status(403).json({ success: false, error: 'Insufficient privileges for this operation' });
  const balance = num(req.body?.balance);
  if (balance === null || balance < 0) return res.status(400).json({ success: false, error: 'The balance must be zero or more.' });
  const { data: card } = await client.from('oyster_cards').select('id, site_name, card_ref').eq('id', req.params.id).maybeSingle();
  if (!card || !siteInScope(req, card.site_name)) return res.status(404).json({ success: false, error: 'Card not found.' });

  const { data, error } = await client.rpc('set_oyster_balance', {
    p_card_id: card.id, p_balance: balance, p_note: cleanText(req.body?.note), p_user_name: who(req), p_role: req.user.role
  });
  if (error) return res.status(httpStatusForDbError(error)).json({ success: false, error: error.message });

  recordAuditTrailEntry(req, { defaultAction: 'UPDATE', entity: 'oysterCards', entityId: card.id, site: card.site_name, defaultDetails: `Recorded balance £${balance.toFixed(2)} on Oyster card ${card.card_ref}` });
  res.json({ success: true, card: data });
});

export default router;
