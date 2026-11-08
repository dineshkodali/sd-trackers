import { Router, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../supabase.js';
import { isUuid } from '../pagePermissions.js';
import {
  LIFECYCLE_ENTITIES,
  LIFECYCLE_ENTITY_LABEL,
  LIFECYCLE_TABLE,
  checkTransition,
  cleanReason,
  hasGlobalScope,
  isLifecycleEditor,
  sitesWithinScope,
  type LifecycleAction,
  type LifecycleEntity,
  type LifecycleRow,
  type LifecycleState,
} from '../../src/config/recordLifecycle.js';

/**
 * /api/lifecycle - archive, recoverable delete and restore for Users and Properties.
 * Mounted behind requireAuth. The checks here give clear messages; the database function
 * public.lifecycle_apply() repeats them and is the real enforcement (migration 028).
 */
const router = Router();
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

const migrationHint = 'Archive and deleted records are not installed yet. Apply db/migrations/028_record_lifecycle.sql.';
const isMissingObject = (e: any) => ['42P01', '42703', '42883', 'PGRST202', 'PGRST205'].includes(e?.code);

type Result = { ok: true; from: LifecycleState; to: LifecycleState } | { ok: false; status: number; error: string };

const actorOf = (req: Request) => ({
  id: req.user!.id,
  role: req.user!.role,
  sites: (req.user!.assignedSites && req.user!.assignedSites.length > 0 ? req.user!.assignedSites : (req.user!.assignedSite ? [req.user!.assignedSite] : [])) as string[],
});

const splitSites = (v: unknown) => String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);

/** Sites for each user: profile assignment plus Property Assignments (same view as the user directory). */
async function userSitesMap(db: SupabaseClient, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (ids.length === 0) return out;
  const { data } = await db.from('property_user_assignments').select('user_id, property_name, assigned_properties').in('user_id', ids);
  for (const row of data || []) {
    const list = out.get(row.user_id) || [];
    if (row.property_name) list.push(row.property_name);
    if (Array.isArray(row.assigned_properties)) list.push(...row.assigned_properties);
    out.set(row.user_id, list);
  }
  return out;
}

export async function applyLifecycle(
  db: SupabaseClient,
  req: Request,
  entity: LifecycleEntity,
  id: string,
  action: LifecycleAction,
  reasonInput: unknown,
): Promise<Result> {
  if (!req.user || !isUuid(req.user.id)) return { ok: false, status: 403, error: 'This account cannot change record status.' };
  if (!isLifecycleEditor(req.user.role)) return { ok: false, status: 403, error: 'Your role cannot change the status of this record.' };
  if (action === 'restore' && req.user.role !== 'Super Admin') return { ok: false, status: 403, error: 'Only a Super Admin can restore records.' };

  const table = LIFECYCLE_TABLE[entity];
  const { data: row, error: loadErr } = await db.from(table).select('*').eq('id', id).maybeSingle();
  if (loadErr) {
    return isMissingObject(loadErr)
      ? { ok: false, status: 503, error: migrationHint }
      : { ok: false, status: 500, error: 'Could not load the record.' };
  }
  if (!row) return { ok: false, status: 404, error: 'Record not found.' };
  if (row.lifecycle_state === undefined) return { ok: false, status: 503, error: migrationHint };

  const sites = entity === 'users'
    ? [...splitSites(row.assigned_site), ...((await userSitesMap(db, [row.id])).get(row.id) || [])]
    : [row.name];
  const verdict = checkTransition(entity, action, actorOf(req), {
    id: String(row.id),
    state: (row.lifecycle_state || 'Active') as LifecycleState,
    previousState: row.lifecycle_prev_state,
    role: row.role,
    sites,
  });
  if (verdict.ok === false) return { ok: false, status: 403, error: verdict.error };

  const { data, error } = await db.rpc('lifecycle_apply', {
    p_entity: entity,
    p_id: String(id),
    p_action: action,
    p_actor: req.user.id,
    p_reason: cleanReason(reasonInput) || null,
  });
  if (error) {
    if (isMissingObject(error)) return { ok: false, status: 503, error: migrationHint };
    const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : ['22023', '23505'].includes(error.code) ? 409 : 500;
    return { ok: false, status, error: status === 500 ? 'Could not complete the action.' : error.message };
  }
  return { ok: true, from: data?.from ?? verdict.from, to: data?.to ?? verdict.to };
}

function entityParam(req: Request, res: Response): LifecycleEntity | null {
  const e = req.params.entity as LifecycleEntity;
  if (!LIFECYCLE_ENTITIES.includes(e)) { res.status(404).json({ success: false, error: 'Unknown record type.' }); return null; }
  return e;
}

function dbOr503(res: Response) {
  const c = getSupabaseAdmin();
  if (!c) res.status(503).json({ success: false, error: 'Database is not configured.' });
  return c;
}

// GET /api/lifecycle/:entity?state=Archived|Deleted - records in that state that the caller may see
router.get('/:entity', async (req: Request, res: Response) => {
  const entity = entityParam(req, res); if (!entity) return;
  if (!req.user || !isLifecycleEditor(req.user.role)) return res.status(403).json({ success: false, error: 'Your role cannot view these records.' });
  const state = req.query.state === 'Deleted' ? 'Deleted' : 'Archived';
  const db = dbOr503(res); if (!db) return;

  const { data, error } = await db.from(LIFECYCLE_TABLE[entity]).select('*').eq('lifecycle_state', state).order('lifecycle_changed_at', { ascending: false });
  if (error) {
    if (isMissingObject(error)) return res.json({ success: true, installed: false, rows: [] });
    return res.status(500).json({ success: false, error: 'Could not load records.' });
  }

  const actor = actorOf(req);
  const global = req.user.role === 'Super Admin' || hasGlobalScope(actor.role, actor.sites);
  const extra = entity === 'users' ? await userSitesMap(db, (data || []).map((r: any) => r.id)) : new Map<string, string[]>();

  const rows: LifecycleRow[] = (data || [])
    .filter((r: any) => {
      if (global) return true;
      const sites = entity === 'users' ? [...splitSites(r.assigned_site), ...(extra.get(r.id) || [])] : [r.name];
      return sitesWithinScope(actor, sites);
    })
    .map((r: any) => ({
      id: String(r.id),
      label: entity === 'users' ? (r.name || r.email) : (r.name || String(r.id)),
      recordType: LIFECYCLE_ENTITY_LABEL[entity],
      state: r.lifecycle_state,
      previousState: r.lifecycle_prev_state,
      previousStatus: r.lifecycle_prev_status,
      changedAt: r.lifecycle_changed_at,
      changedBy: r.lifecycle_changed_by_name,
      reason: r.lifecycle_reason,
      detail: entity === 'users' ? [r.email, r.role].filter(Boolean).join(' · ') : [r.pid, r.city].filter(Boolean).join(' · '),
    }));
  res.json({ success: true, installed: true, rows });
});

// GET /api/lifecycle/:entity/:id/history - Super Admin only
router.get('/:entity/:id/history', async (req: Request, res: Response) => {
  const entity = entityParam(req, res); if (!entity) return;
  if (req.user?.role !== 'Super Admin') return res.status(403).json({ success: false, error: 'Only a Super Admin can review lifecycle history.' });
  const db = dbOr503(res); if (!db) return;
  const { data, error } = await db.from('record_lifecycle_events').select('*').eq('entity', entity).eq('record_id', req.params.id).order('created_at', { ascending: false }).limit(100);
  if (error) return isMissingObject(error) ? res.json({ success: true, events: [] }) : res.status(500).json({ success: false, error: 'Could not load history.' });
  res.json({
    success: true,
    events: (data || []).map((e: any) => ({
      id: e.id, entity: e.entity, recordId: e.record_id, recordLabel: e.record_label, action: e.action,
      previousState: e.previous_state, newState: e.new_state, actorName: e.actor_name, actorRole: e.actor_role,
      reason: e.reason, createdAt: e.created_at,
    })),
  });
});

// POST /api/lifecycle/:entity/:id/:action  { reason? }
router.post('/:entity/:id/:action', async (req: Request, res: Response) => {
  const entity = entityParam(req, res); if (!entity) return;
  const action = req.params.action as LifecycleAction;
  if (!['archive', 'delete', 'restore'].includes(action)) return res.status(404).json({ success: false, error: 'Unknown action.' });
  const db = dbOr503(res); if (!db) return;
  const result = await applyLifecycle(db, req, entity, req.params.id, action, req.body?.reason);
  if (result.ok === false) return res.status(result.status).json({ success: false, error: result.error });
  res.json({ success: true, from: result.from, to: result.to });
});

export default router;
