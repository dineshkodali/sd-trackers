import { Router, Request, Response } from 'express';
import { getSupabaseAdmin } from '../supabase.js';
import { isUuid } from '../pagePermissions.js';
import {
  cleanDashboardName,
  MAX_DASHBOARDS_PER_USER,
  sanitizeLayout,
} from '../../src/config/dashboardWidgets.js';

/**
 * /api/dashboards - a user's own dashboards. Mounted behind requireAuth.
 * Every query is scoped to req.user.id; an id in the URL can never reach another user's row.
 * (The service-role client bypasses RLS, so the user_id filter here is the access control.)
 */
const router = Router();
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

const isMissingTable = (e: any) => e?.code === '42P01' || e?.code === 'PGRST205';
const migrationHint = 'Personal dashboards are not installed yet. Apply db/migrations/027_user_dashboards.sql.';

const toRecord = (r: any) => ({
  id: r.id,
  name: r.name,
  isDefault: r.is_default === true,
  layout: sanitizeLayout(r.layout),
  updatedAt: r.updated_at,
});

function context(req: Request, res: Response) {
  const db = getSupabaseAdmin();
  if (!db) { res.status(503).json({ success: false, error: 'Database is not configured.' }); return null; }
  if (!req.user || !isUuid(req.user.id)) { res.status(401).json({ success: false, error: 'Authentication required' }); return null; }
  return { db, uid: req.user.id };
}

function fail(res: Response, error: any, fallback: string) {
  if (isMissingTable(error)) return res.status(503).json({ success: false, notInstalled: true, error: migrationHint });
  if (error?.code === '54000') return res.status(409).json({ success: false, error: `You can have up to ${MAX_DASHBOARDS_PER_USER} dashboards.` });
  return res.status(500).json({ success: false, error: fallback });
}

router.get('/', async (req: Request, res: Response) => {
  const c = context(req, res); if (!c) return;
  const { data, error } = await c.db.from('user_dashboards').select('*').eq('user_id', c.uid).order('created_at');
  if (error) return fail(res, error, 'Could not load dashboards.');
  res.json({ success: true, dashboards: (data || []).map(toRecord) });
});

// Create or update one of the caller's dashboards.
router.put('/:id', async (req: Request, res: Response) => {
  const c = context(req, res); if (!c) return;
  const id = req.params.id;
  if (!isUuid(id)) return res.status(400).json({ success: false, error: 'Invalid dashboard id.' });
  const name = cleanDashboardName(req.body?.name);
  const layout = sanitizeLayout(req.body?.layout);
  const updatedAt = new Date().toISOString();
  const { data: existing, error: lookupErr } = await c.db.from('user_dashboards').select('id, user_id').eq('id', id).maybeSingle();
  if (lookupErr) return fail(res, lookupErr, 'Could not save dashboard.');
  if (existing && existing.user_id !== c.uid) return res.status(404).json({ success: false, error: 'Dashboard not found.' });
  const { data, error } = existing
    ? await c.db.from('user_dashboards').update({ name, layout, updated_at: updatedAt }).eq('id', id).eq('user_id', c.uid).select().single()
    : await c.db.from('user_dashboards').insert({ id, user_id: c.uid, name, layout, updated_at: updatedAt }).select().single();
  if (error) return fail(res, error, 'Could not save dashboard.');
  res.json({ success: true, dashboard: toRecord(data) });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const c = context(req, res); if (!c) return;
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid dashboard id.' });
  const { error } = await c.db.from('user_dashboards').delete().eq('id', req.params.id).eq('user_id', c.uid);
  if (error) return fail(res, error, 'Could not delete dashboard.');
  res.json({ success: true });
});

// Set (or clear, with id: null) the caller's default dashboard.
router.post('/default', async (req: Request, res: Response) => {
  const c = context(req, res); if (!c) return;
  const id = req.body?.id ?? null;
  if (id !== null && !isUuid(id)) return res.status(400).json({ success: false, error: 'Invalid dashboard id.' });
  const clear = await c.db.from('user_dashboards').update({ is_default: false }).eq('user_id', c.uid).eq('is_default', true);
  if (clear.error) return fail(res, clear.error, 'Could not set default dashboard.');
  if (id) {
    const { data, error } = await c.db.from('user_dashboards').update({ is_default: true }).eq('id', id).eq('user_id', c.uid).select('id');
    if (error) return fail(res, error, 'Could not set default dashboard.');
    if (!data || data.length === 0) return res.status(404).json({ success: false, error: 'Dashboard not found.' });
  }
  res.json({ success: true });
});

export default router;
