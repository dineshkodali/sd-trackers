import { getBrowserSupabaseClient } from './supabaseClient';
import { fromDatabaseRow } from '../../server/schemaAdapter.ts';
import { recordDirectAudit } from './directSupabaseAdapter';
import { getAuditUserContext } from '../services/apiService';
import { isSuEditor, isSuManager, checkArchiveRequester, checkArchiveDecider, httpStatusForDbError } from '../../server/suAccess.ts';
import { availableFundingTransitions, validateFundingTransition } from '../utils/fundingWorkflow';
import { INITIAL_ROLE_PERMISSIONS } from '../data/initialData';

/**
 * Browser-direct versions of the workflow actions that normally go through the Express API (/api/su, /api/oyster,
 * /api/transport-funding). Used when the site is hosted without a backend (for example AWS Amplify alone).
 *
 * Each action still runs as ONE database function (migrations 021-024), so the transaction, the row locks, the status
 * history and the guard triggers are exactly the same. What differs is who vouches for the user: here the role and name
 * come from the signed-in session in the browser, the same trust model every other direct-mode page already uses.
 */

export interface WorkflowResult { ok: boolean; status: number; json: any }

const HC2_BUCKET = 'su-health-documents';
const ALLOWED_DOCUMENT_TYPES: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

const done = (status: number, json: any): WorkflowResult => ({ ok: status < 400 && json?.success !== false, status, json });
const bad = (status: number, error: string): WorkflowResult => done(status, { success: false, error });
const text = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown): number | null => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const isoDay = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function actor() {
  const ctx = getAuditUserContext();
  if (!ctx?.userId || !ctx.role) return null;
  return { id: ctx.userId, name: ctx.userName || ctx.userEmail || 'Staff', role: ctx.role };
}

async function audit(entity: string, id: string, action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE', details: string, module: string, site?: string) {
  await recordDirectAudit('UPDATE', entity, { id }, { action: action as any, details, module, targetItem: id, site }, getAuditUserContext());
}

async function roleMayArchive(supabase: any, role: string): Promise<boolean> {
  if (role === 'Super Admin') return true;
  const { data } = await supabase.from('role_permissions').select('can_archive_restore').eq('id', role).maybeSingle();
  if (data && typeof data.can_archive_restore === 'boolean') return data.can_archive_restore;
  return (INITIAL_ROLE_PERMISSIONS as Record<string, any>)[role]?.canArchiveRestore === true;
}

const rpcFail = (error: { code?: string; message?: string }) => bad(httpStatusForDbError(error), error.message || 'Request failed');

/** Runs the action behind an /api path directly against the database. Returns null for a path that has no direct form. */
export async function runDirectWorkflow(method: string, path: string, body: any): Promise<WorkflowResult | null> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return null;
  const me = actor();
  const m = (re: RegExp) => path.match(re);
  const verb = method.toUpperCase();

  let hit: RegExpMatchArray | null;

  /* ---------------------------------------------------------------------------------------------------- archive */
  if (verb === 'POST' && path === '/api/su/archive/request') {
    if (!me) return bad(401, 'Sign in again to continue.');
    const suId = text(body?.suId, 200), type = body?.type === 'Restore' ? 'Restore' : 'Archive', reason = text(body?.reason);
    if (!suId) return bad(400, 'Choose a Service User.');
    if (reason.length < 3) return bad(400, 'A reason is required.');
    const allowed = checkArchiveRequester(me.role, await roleMayArchive(supabase, me.role));
    if (!allowed.ok) return bad(allowed.status, allowed.error);
    const { data, error } = await supabase.rpc('request_su_archive', { p_su_id: suId, p_type: type, p_reason: reason, p_user_id: me.id, p_user_name: me.name });
    if (error) return rpcFail(error);
    await audit('serviceUsers', suId, type === 'Restore' ? 'RESTORE' : 'ARCHIVE', `${type} requested for Service User [${suId}]. Reason: ${reason}`, 'Service Users');
    return done(201, { success: true, request: fromDatabaseRow('su_archive_requests', data) });
  }
  if (verb === 'POST' && (hit = m(/^\/api\/su\/archive\/requests\/([^/]+)\/decision$/))) {
    if (!me) return bad(401, 'Sign in again to continue.');
    const id = decodeURIComponent(hit[1]);
    const decision = text(body?.decision, 20), reason = text(body?.reason);
    if (!['Approved', 'Rejected', 'Cancelled'].includes(decision)) return bad(400, 'Decision must be Approved, Rejected or Cancelled.');
    if (decision === 'Rejected' && reason.length < 3) return bad(400, 'A reason is required to reject a request.');
    const { data: existing } = await supabase.from('su_archive_requests').select('id, su_id, requested_by_id, request_type, status').eq('id', id).maybeSingle();
    if (!existing) return bad(404, 'Request not found.');
    const allowed = checkArchiveDecider(me.role, me.id, existing.requested_by_id, decision);
    if (!allowed.ok) return bad(allowed.status, allowed.error);
    const { data, error } = await supabase.rpc('decide_su_archive_request', { p_request_id: id, p_decision: decision, p_decision_reason: reason, p_user_id: me.id, p_user_name: me.name });
    if (error) return rpcFail(error);
    await audit('serviceUsers', existing.su_id, existing.request_type === 'Restore' ? 'RESTORE' : 'ARCHIVE', `${existing.request_type} request ${decision.toLowerCase()} for Service User [${existing.su_id}]${reason ? `. Reason: ${reason}` : ''}`, 'Service Users');
    return done(200, { success: true, request: fromDatabaseRow('su_archive_requests', data) });
  }

  /* ------------------------------------------------------------------------------------------------- household */
  if (verb === 'POST' && path.startsWith('/api/su/household/')) {
    if (!me || !isSuManager(me.role)) return bad(403, 'Insufficient privileges for this operation');
    if (path === '/api/su/household/add') {
      const anchor = text(body?.anchorSuId, 200), member = text(body?.memberSuId, 200);
      if (!anchor || !member) return bad(400, 'Choose the Service User to add.');
      if (anchor === member) return bad(400, 'A person cannot be linked to themselves.');
      const { data, error } = await supabase.rpc('add_household_member', {
        p_anchor_su: anchor, p_member_su: member, p_relationship: text(body?.relationship, 60), p_anchor_relationship: text(body?.anchorRelationship, 60), p_user: me.name, p_role: me.role
      });
      if (error) return rpcFail(error);
      await audit('familyMembers', member, 'UPDATE', `Added Service User [${member}] to the household of [${anchor}]`, 'Family Groups');
      return done(201, { success: true, member: fromDatabaseRow('family_members', data) });
    }
    if (path === '/api/su/household/remove') {
      const familyId = text(body?.familyId, 200), suId = text(body?.suId, 200);
      if (!familyId || !suId) return bad(400, 'Choose the household member to remove.');
      const { data, error } = await supabase.rpc('remove_household_member', { p_family_id: familyId, p_su_id: suId, p_reason: text(body?.reason), p_user: me.name, p_role: me.role });
      if (error) return rpcFail(error);
      await audit('familyMembers', suId, 'UPDATE', `Removed Service User [${suId}] from household [${familyId}]`, 'Family Groups');
      return done(200, { success: true, household: fromDatabaseRow('family_groups', data) });
    }
    if (path === '/api/su/household/relationship') {
      const familyId = text(body?.familyId, 200), suId = text(body?.suId, 200);
      if (!familyId || !suId) return bad(400, 'Choose the household member.');
      const { data, error } = await supabase.rpc('set_household_relationship', { p_family_id: familyId, p_su_id: suId, p_relationship: text(body?.relationship, 60), p_user: me.name, p_role: me.role });
      if (error) return rpcFail(error);
      return done(200, { success: true, member: fromDatabaseRow('family_members', data) });
    }
  }

  /* ---------------------------------------------------------------------------------------------- oyster cards */
  if (verb === 'POST' && path === '/api/oyster/issue') {
    if (!me || !isSuEditor(me.role)) return bad(403, 'Insufficient privileges for this operation');
    const cardId = text(body?.cardId, 200), suId = text(body?.suId, 200), fundingRequestId = text(body?.fundingRequestId, 200) || null, balance = num(body?.balance);
    if (!cardId || !suId) return bad(400, 'Choose the card and the Service User.');
    if (balance === null || balance < 0) return bad(400, 'Enter the balance on the card at handover.');
    const { data, error } = await supabase.rpc('issue_oyster_card', {
      p_card_id: cardId, p_su_id: suId, p_funding_request_id: fundingRequestId, p_balance: balance, p_issued_date: isoDay(body?.issuedDate), p_user_id: me.id, p_user_name: me.name, p_role: me.role
    });
    if (error) return rpcFail(error);
    await audit('oysterCards', cardId, 'UPDATE', `Issued Oyster card ${cardId} to Service User [${suId}] with £${balance.toFixed(2)}${fundingRequestId ? ` for funding request [${fundingRequestId}]` : ''}`, 'Public Transport Tracker');
    return done(201, { success: true, transaction: fromDatabaseRow('oyster_card_transactions', data) });
  }
  if (verb === 'POST' && (hit = m(/^\/api\/oyster\/transactions\/([^/]+)\/return$/))) {
    if (!me || !isSuEditor(me.role)) return bad(403, 'Insufficient privileges for this operation');
    const txnId = decodeURIComponent(hit[1]);
    const condition = text(body?.condition, 20), balance = num(body?.balance);
    if (!['Good', 'Damaged', 'Lost'].includes(condition)) return bad(400, 'Choose the condition of the card.');
    if (condition !== 'Lost' && (balance === null || balance < 0)) return bad(400, 'Enter the actual remaining balance on the card.');
    const { data, error } = await supabase.rpc('return_oyster_card', {
      p_txn_id: txnId, p_balance_at_return: condition === 'Lost' ? null : balance, p_condition: condition, p_notes: text(body?.notes), p_returned_date: isoDay(body?.returnedDate),
      p_user_id: me.id, p_user_name: me.name, p_role: me.role
    });
    if (error) return rpcFail(error);
    await audit('oysterCards', txnId, 'UPDATE', `Oyster card ${condition === 'Lost' ? 'written off as lost' : `returned (${condition.toLowerCase()})`}`, 'Public Transport Tracker');
    return done(200, { success: true, transaction: fromDatabaseRow('oyster_card_transactions', data) });
  }
  if (verb === 'POST' && (hit = m(/^\/api\/oyster\/cards\/([^/]+)\/balance$/))) {
    if (!me || !isSuEditor(me.role)) return bad(403, 'Insufficient privileges for this operation');
    const cardId = decodeURIComponent(hit[1]);
    const balance = num(body?.balance);
    if (balance === null || balance < 0) return bad(400, 'The balance must be zero or more.');
    const { data, error } = await supabase.rpc('set_oyster_balance', { p_card_id: cardId, p_balance: balance, p_note: text(body?.note), p_user_name: me.name, p_role: me.role });
    if (error) return rpcFail(error);
    await audit('oysterCards', cardId, 'UPDATE', `Recorded balance £${balance.toFixed(2)} on Oyster card ${cardId}`, 'Public Transport Tracker');
    return done(200, { success: true, card: fromDatabaseRow('oyster_cards', data) });
  }

  /* ------------------------------------------------------------------------------------------ funding workflow */
  if (verb === 'POST' && (hit = m(/^\/api\/transport-funding\/([^/]+)\/transition$/))) {
    if (!me) return bad(401, 'Sign in again to continue.');
    const id = decodeURIComponent(hit[1]);
    const to = text(body?.to, 40);
    const input = {
      note: text(body?.note), approvedTransportMethod: text(body?.approvedTransportMethod, 200),
      paymentAmount: body?.paymentAmount === undefined || body?.paymentAmount === null ? '' : String(body.paymentAmount).trim(),
      journeyUrn: text(body?.journeyUrn, 200), completionNotes: text(body?.completionNotes)
    };
    const { data: current } = await supabase.from('transport_funding_requests').select('id, site_name, status, requested_by_id').eq('id', id).maybeSingle();
    if (!current) return bad(404, 'Funding request not found.');
    const options = availableFundingTransitions(current.status, me.role, me.id, current.requested_by_id || undefined);
    if (!options.some(o => o.to === to)) {
      const message = validateFundingTransition(current.status, to, input);
      return bad(message ? 409 : 403, message || 'You cannot make this change to the request.');
    }
    const invalid = validateFundingTransition(current.status, to, input);
    if (invalid) return bad(400, invalid);
    const { data, error } = await supabase.rpc('transition_transport_funding', {
      p_id: current.id, p_to: to, p_note: input.note, p_user_id: me.id, p_user_name: me.name, p_role: me.role,
      p_fields: { approvedTransportMethod: input.approvedTransportMethod, paymentAmount: input.paymentAmount, journeyUrn: input.journeyUrn, completionNotes: input.completionNotes }
    });
    if (error) return rpcFail(error);
    await audit('transportFundingRequests', current.id, 'UPDATE', `Funding request moved from ${current.status} to ${to}${input.note ? `. Note: ${input.note}` : ''}`, 'Transport Funding Requests', current.site_name);
    return done(200, { success: true, request: fromDatabaseRow('transport_funding_requests', data) });
  }

  /* ---------------------------------------------------------------------------------------------- HC2 document */
  if ((hit = m(/^\/api\/su\/hc2\/([^/]+)\/document$/))) {
    const suId = decodeURIComponent(hit[1]);
    const { data: hc2 } = await supabase.from('su_hc2_details').select('id, document_path').eq('su_id', suId).maybeSingle();

    if (verb === 'POST') {
      if (!me || !isSuEditor(me.role)) return bad(403, 'Insufficient privileges for this operation');
      const contentType = text(body?.contentType, 100);
      const ext = ALLOWED_DOCUMENT_TYPES[contentType];
      if (!ext) return bad(400, 'Only PDF, JPEG or PNG files can be uploaded.');
      const base64 = typeof body?.dataBase64 === 'string' ? body.dataBase64 : '';
      if (!base64) return bad(400, 'The file is empty.');
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      if (bytes.length > MAX_DOCUMENT_BYTES) return bad(413, 'The file must be 8 MB or smaller.');
      if (!hc2) return bad(409, 'Save the HC2 details before attaching a document.');
      const displayName = text(body?.fileName, 150).replace(/[^\w.\- ]+/g, '_') || `hc2.${ext}`;
      const filePath = `${suId}/hc2/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(HC2_BUCKET).upload(filePath, bytes, { contentType, upsert: false });
      if (upErr) return bad(500, `Upload failed: ${upErr.message}`);
      const { error: dbErr } = await supabase.from('su_hc2_details').update({ document_path: filePath, document_name: displayName, document_uploaded_at: new Date().toISOString(), updated_by: me.name }).eq('id', hc2.id);
      if (dbErr) { await supabase.storage.from(HC2_BUCKET).remove([filePath]); return bad(500, dbErr.message); }
      if (hc2.document_path) await supabase.storage.from(HC2_BUCKET).remove([hc2.document_path]);
      await audit('suHc2', hc2.id, 'UPDATE', `Attached HC2 document to Service User [${suId}]`, 'GP Registrations');
      return done(201, { success: true, documentName: displayName });
    }
    if (verb === 'GET') {
      if (!me || !isSuManager(me.role)) return bad(403, 'Insufficient privileges for this operation');
      if (!hc2?.document_path) return bad(404, 'No document has been attached.');
      const { data, error } = await supabase.storage.from(HC2_BUCKET).createSignedUrl(hc2.document_path, 60);
      if (error || !data?.signedUrl) return bad(500, error?.message || 'Could not open the document.');
      await audit('suHc2', hc2.id, 'UPDATE', `Opened HC2 document for Service User [${suId}]`, 'GP Registrations');
      return done(200, { success: true, url: data.signedUrl, expiresInSeconds: 60 });
    }
    if (verb === 'DELETE') {
      if (!me || !isSuManager(me.role)) return bad(403, 'Insufficient privileges for this operation');
      if (!hc2?.document_path) return bad(404, 'No document has been attached.');
      const { error } = await supabase.from('su_hc2_details').update({ document_path: null, document_name: null, document_uploaded_at: null, updated_by: me.name }).eq('id', hc2.id);
      if (error) return bad(500, error.message);
      await supabase.storage.from(HC2_BUCKET).remove([hc2.document_path]);
      await audit('suHc2', hc2.id, 'UPDATE', `Removed HC2 document for Service User [${suId}]`, 'GP Registrations');
      return done(200, { success: true });
    }
  }

  return null;
}
