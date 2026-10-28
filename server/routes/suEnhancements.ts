import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../supabase.js';
import { resolveSiteId } from '../schemaAdapter.js';
import { INITIAL_ROLE_PERMISSIONS } from '../../src/data/initialData.js';
import { userCanAccessAllSites, getUserAssignedSites, recordAuditTrailEntry } from './db.js';
import { isSuEditor, isSuManager, checkArchiveRequester, checkArchiveDecider, httpStatusForDbError } from '../suAccess.js';

/**
 * Service User archive approval and HC2 documents.
 *
 * Archive state can only be changed through the database functions request_su_archive / decide_su_archive_request
 * (migration 021): a trigger on service_users refuses every other route, including the generic /api/db API.
 * This router adds the role checks and the site scope, and turns database errors into clear HTTP responses.
 */
const router = Router();

const HC2_BUCKET = 'su-health-documents';
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

function db(res: Response): SupabaseClient | null {
  const client = isSupabaseConfigured() ? getSupabaseAdmin() : null;
  if (!client) {
    res.status(503).json({ success: false, error: 'Live database is not configured on the server. Changes cannot be saved.' });
    return null;
  }
  return client;
}

async function roleMayArchive(client: SupabaseClient, role: string): Promise<boolean> {
  if (role === 'Super Admin') return true;
  const { data } = await client.from('role_permissions').select('can_archive_restore').eq('id', role).maybeSingle();
  if (data && typeof data.can_archive_restore === 'boolean') return data.can_archive_restore;
  return (INITIAL_ROLE_PERMISSIONS as Record<string, any>)[role]?.canArchiveRestore === true;
}

/** The SU row, or null when it does not exist or the caller's site assignment does not cover it. */
export async function visibleServiceUser(client: SupabaseClient, req: Request, suId: string) {
  const { data } = await client.from('service_users').select('id, site_id, status, archive_status').eq('id', suId).maybeSingle();
  if (!data) return null;
  if (userCanAccessAllSites(req.user)) return data;
  const siteIds = getUserAssignedSites(req.user).map(s => resolveSiteId(s) || s);
  return data.site_id && siteIds.includes(data.site_id) ? data : null;
}

const cleanText = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// POST /api/su/archive/request  { suId, type: 'Archive' | 'Restore', reason }
router.post('/archive/request', async (req: Request, res: Response) => {
  const client = db(res);
  if (!client || !req.user) return;
  const suId = cleanText(req.body?.suId, 200);
  const type = req.body?.type === 'Restore' ? 'Restore' : 'Archive';
  const reason = cleanText(req.body?.reason);
  if (!suId) return res.status(400).json({ success: false, error: 'Choose a Service User.' });
  if (reason.length < 3) return res.status(400).json({ success: false, error: 'A reason is required.' });

  const allowed = checkArchiveRequester(req.user.role, await roleMayArchive(client, req.user.role));
  if (!allowed.ok) return res.status(allowed.status).json({ success: false, error: allowed.error });
  if (!(await visibleServiceUser(client, req, suId))) return res.status(404).json({ success: false, error: 'Service User not found.' });

  const { data, error } = await client.rpc('request_su_archive', {
    p_su_id: suId, p_type: type, p_reason: reason, p_user_id: req.user.id, p_user_name: req.user.name || req.user.email
  });
  if (error) return res.status(httpStatusForDbError(error)).json({ success: false, error: error.message });

  recordAuditTrailEntry(req, {
    defaultAction: type === 'Restore' ? 'RESTORE' : 'ARCHIVE', entity: 'serviceUsers', entityId: suId,
    defaultDetails: `${type} requested for Service User [${suId}]. Reason: ${reason}`
  });
  res.status(201).json({ success: true, request: data });
});

// POST /api/su/archive/requests/:id/decision  { decision: 'Approved' | 'Rejected' | 'Cancelled', reason }
router.post('/archive/requests/:id/decision', async (req: Request, res: Response) => {
  const client = db(res);
  if (!client || !req.user) return;
  const decision = cleanText(req.body?.decision, 20);
  const reason = cleanText(req.body?.reason);
  if (!['Approved', 'Rejected', 'Cancelled'].includes(decision)) {
    return res.status(400).json({ success: false, error: 'Decision must be Approved, Rejected or Cancelled.' });
  }
  if (decision === 'Rejected' && reason.length < 3) {
    return res.status(400).json({ success: false, error: 'A reason is required to reject a request.' });
  }

  const { data: existing } = await client.from('su_archive_requests').select('id, su_id, requested_by_id, request_type, status').eq('id', req.params.id).maybeSingle();
  if (!existing) return res.status(404).json({ success: false, error: 'Request not found.' });
  if (!(await visibleServiceUser(client, req, existing.su_id))) return res.status(404).json({ success: false, error: 'Request not found.' });

  const allowed = checkArchiveDecider(req.user.role, req.user.id, existing.requested_by_id, decision);
  if (!allowed.ok) return res.status(allowed.status).json({ success: false, error: allowed.error });

  const { data, error } = await client.rpc('decide_su_archive_request', {
    p_request_id: req.params.id, p_decision: decision, p_decision_reason: reason, p_user_id: req.user.id, p_user_name: req.user.name || req.user.email
  });
  if (error) return res.status(httpStatusForDbError(error)).json({ success: false, error: error.message });

  recordAuditTrailEntry(req, {
    defaultAction: existing.request_type === 'Restore' ? 'RESTORE' : 'ARCHIVE', entity: 'serviceUsers', entityId: existing.su_id,
    defaultDetails: `${existing.request_type} request ${decision.toLowerCase()} for Service User [${existing.su_id}]${reason ? `. Reason: ${reason}` : ''}`
  });
  res.json({ success: true, request: data });
});

// ---------------------------------------------------------------------------------------------------------- HC2 document
// POST /api/su/hc2/:suId/document  { fileName, contentType, dataBase64 }
router.post('/hc2/:suId/document', async (req: Request, res: Response) => {
  const client = db(res);
  if (!client || !req.user) return;
  if (!isSuEditor(req.user.role)) return res.status(403).json({ success: false, error: 'Insufficient privileges for this operation' });
  const suId = req.params.suId;
  if (!(await visibleServiceUser(client, req, suId))) return res.status(404).json({ success: false, error: 'Service User not found.' });

  const contentType = cleanText(req.body?.contentType, 100);
  const ext = ALLOWED_DOCUMENT_TYPES[contentType];
  if (!ext) return res.status(400).json({ success: false, error: 'Only PDF, JPEG or PNG files can be uploaded.' });
  const base64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0) return res.status(400).json({ success: false, error: 'The file is empty.' });
  if (bytes.length > MAX_DOCUMENT_BYTES) return res.status(413).json({ success: false, error: 'The file must be 8 MB or smaller.' });

  const { data: hc2 } = await client.from('su_hc2_details').select('id, document_path').eq('su_id', suId).maybeSingle();
  if (!hc2) return res.status(409).json({ success: false, error: 'Save the HC2 details before attaching a document.' });

  const displayName = cleanText(req.body?.fileName, 150).replace(/[^\w.\- ]+/g, '_') || `hc2.${ext}`;
  const path = `${suId}/hc2/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await client.storage.from(HC2_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (upErr) return res.status(500).json({ success: false, error: `Upload failed: ${upErr.message}` });

  const { error: dbErr } = await client.from('su_hc2_details').update({
    document_path: path, document_name: displayName, document_uploaded_at: new Date().toISOString(), updated_by: req.user.name || req.user.email
  }).eq('id', hc2.id);
  if (dbErr) {
    await client.storage.from(HC2_BUCKET).remove([path]); // do not leave an orphaned file behind
    return res.status(500).json({ success: false, error: dbErr.message });
  }
  if (hc2.document_path) await client.storage.from(HC2_BUCKET).remove([hc2.document_path]);

  recordAuditTrailEntry(req, { defaultAction: 'UPDATE', entity: 'suHc2', entityId: hc2.id, defaultDetails: `Attached HC2 document to Service User [${suId}]` });
  res.status(201).json({ success: true, documentName: displayName });
});

// GET /api/su/hc2/:suId/document  -> short-lived signed URL (managers only)
router.get('/hc2/:suId/document', async (req: Request, res: Response) => {
  const client = db(res);
  if (!client || !req.user) return;
  if (!isSuManager(req.user.role)) return res.status(403).json({ success: false, error: 'Insufficient privileges for this operation' });
  if (!(await visibleServiceUser(client, req, req.params.suId))) return res.status(404).json({ success: false, error: 'Service User not found.' });

  const { data: hc2 } = await client.from('su_hc2_details').select('id, document_path').eq('su_id', req.params.suId).maybeSingle();
  if (!hc2?.document_path) return res.status(404).json({ success: false, error: 'No document has been attached.' });
  const { data, error } = await client.storage.from(HC2_BUCKET).createSignedUrl(hc2.document_path, 60);
  if (error || !data?.signedUrl) return res.status(500).json({ success: false, error: error?.message || 'Could not open the document.' });

  recordAuditTrailEntry(req, { defaultAction: 'UPDATE', entity: 'suHc2', entityId: hc2.id, defaultDetails: `Opened HC2 document for Service User [${req.params.suId}]` });
  res.json({ success: true, url: data.signedUrl, expiresInSeconds: 60 });
});

// DELETE /api/su/hc2/:suId/document  (managers only; the HC2 details themselves are kept)
router.delete('/hc2/:suId/document', async (req: Request, res: Response) => {
  const client = db(res);
  if (!client || !req.user) return;
  if (!isSuManager(req.user.role)) return res.status(403).json({ success: false, error: 'Insufficient privileges for this operation' });
  if (!(await visibleServiceUser(client, req, req.params.suId))) return res.status(404).json({ success: false, error: 'Service User not found.' });

  const { data: hc2 } = await client.from('su_hc2_details').select('id, document_path').eq('su_id', req.params.suId).maybeSingle();
  if (!hc2?.document_path) return res.status(404).json({ success: false, error: 'No document has been attached.' });
  const { error } = await client.from('su_hc2_details').update({ document_path: null, document_name: null, document_uploaded_at: null, updated_by: req.user.name || req.user.email }).eq('id', hc2.id);
  if (error) return res.status(500).json({ success: false, error: error.message });
  await client.storage.from(HC2_BUCKET).remove([hc2.document_path]);
  recordAuditTrailEntry(req, { defaultAction: 'UPDATE', entity: 'suHc2', entityId: hc2.id, defaultDetails: `Removed HC2 document for Service User [${req.params.suId}]` });
  res.json({ success: true });
});

export default router;
