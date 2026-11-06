import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../supabase.js';
import {
  invalidatePagePermissionCache,
  isUuid,
  loadUserPagePermissions,
  PermissionLookupError,
} from '../pagePermissions.js';
import { sanitizePermissions, type UserPagePermissions } from '../../src/config/pagePermissionsConfig.js';

/**
 * /api/page-access - Page Access Management.
 * Mounted behind requireAuth. Only Super Admin may read or change anyone else's
 * permissions; any signed-in user may read their own (/me) so the UI can apply them.
 */
const router = Router();
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// Minimal per-user write throttle (defence against automated abuse behind Cloudflare).
const writeLog = new Map<string, number[]>();
function writeLimiter(req: Request, res: Response, next: NextFunction) {
  const key = req.user?.id || req.ip || 'anon';
  const now = Date.now();
  const recent = (writeLog.get(key) || []).filter(t => now - t < 60_000);
  if (recent.length >= 30) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ success: false, error: 'Too many changes. Please wait a minute and retry.' });
  }
  recent.push(now);
  writeLog.set(key, recent);
  next();
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
  if (req.user.role !== 'Super Admin') {
    return res.status(403).json({ success: false, error: 'Only a Super Admin can manage page access.' });
  }
  next();
}

function dbOr503(res: Response) {
  const c = getSupabaseAdmin();
  if (!c) res.status(503).json({ success: false, error: 'Database is not configured.' });
  return c;
}

const isMissingTable = (e: any) => e?.code === '42P01' || e?.code === 'PGRST205' || e?.code === 'PGRST202';
const migrationHint = 'Page Access Management tables are not installed yet. Apply db/migrations/026_page_access_management.sql.';

// GET /api/page-access/me - the caller's own overrides (null = unrestricted)
router.get('/me', async (req: Request, res: Response) => {
  try {
    if (!req.user || !isUuid(req.user.id) || req.user.role === 'Super Admin') {
      return res.json({ success: true, restricted: false, permissions: null });
    }
    const perms = await loadUserPagePermissions(req.user.id, true);
    res.json({ success: true, restricted: perms !== null, permissions: perms });
  } catch (err) {
    if (err instanceof PermissionLookupError) {
      return res.status(503).json({ success: false, error: 'Permission lookup unavailable.' });
    }
    throw err;
  }
});

router.use(requireSuperAdmin);

// GET /api/page-access/users - directory with a restricted flag
router.get('/users', async (_req: Request, res: Response) => {
  const db = dbOr503(res); if (!db) return;
  const { data: users, error } = await db.from('profiles').select('id, name, email, role, status, assigned_site').order('name');
  if (error) return res.status(500).json({ success: false, error: 'Could not load users.' });
  const { data: rows, error: rowsErr } = await db.from('user_page_permissions').select('user_id');
  if (rowsErr && !isMissingTable(rowsErr)) return res.status(500).json({ success: false, error: 'Could not load permissions.' });
  const restricted = new Set((rows || []).map((r: any) => r.user_id));
  res.json({
    success: true,
    installed: !(rowsErr && isMissingTable(rowsErr)),
    users: (users || []).map((u: any) => ({
      id: u.id, name: u.name, email: u.email, role: u.role, status: u.status,
      assignedSite: u.assigned_site, restricted: restricted.has(u.id),
    })),
  });
});

// GET /api/page-access/users/:id
router.get('/users/:id', async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid user id.' });
  try {
    const perms = await loadUserPagePermissions(req.params.id, true);
    res.json({ success: true, restricted: perms !== null, permissions: perms });
  } catch {
    res.status(503).json({ success: false, error: 'Permission lookup unavailable.' });
  }
});

async function applyChange(req: Request, res: Response, targetId: string, perms: UserPagePermissions | null, action: 'UPDATE' | 'RESET' | 'COPY') {
  const db = dbOr503(res); if (!db) return;
  const actor = req.user!;
  const { error } = await db.rpc('page_access_apply', {
    p_actor: isUuid(actor.id) ? actor.id : null,
    p_actor_name: actor.name || actor.email || 'Super Admin',
    p_target: targetId,
    p_perms: perms,
    p_action: action,
  });
  if (error) {
    if (isMissingTable(error)) return res.status(503).json({ success: false, error: migrationHint });
    if (error.code === '42501') return res.status(403).json({ success: false, error: error.message });
    if (error.code === 'P0002') return res.status(404).json({ success: false, error: 'User not found.' });
    console.warn('[PageAccess] apply failed:', error.message);
    return res.status(500).json({ success: false, error: 'Could not save permissions.' });
  }
  invalidatePagePermissionCache(targetId);
  res.json({ success: true });
}

// PUT /api/page-access/users/:id  { permissions: { pageId: { view, create, ... } } }
router.put('/users/:id', writeLimiter, async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid user id.' });
  if (req.params.id === req.user?.id) return res.status(403).json({ success: false, error: 'You cannot change your own page permissions.' });
  const perms = sanitizePermissions(req.body?.permissions);
  if (Object.keys(perms).length === 0) {
    return res.status(400).json({ success: false, error: 'Provide at least one page. To remove all overrides use reset.' });
  }
  await applyChange(req, res, req.params.id, perms, 'UPDATE');
});

// POST /api/page-access/users/:id/reset - back to role defaults
router.post('/users/:id/reset', writeLimiter, async (req: Request, res: Response) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid user id.' });
  if (req.params.id === req.user?.id) return res.status(403).json({ success: false, error: 'You cannot change your own page permissions.' });
  await applyChange(req, res, req.params.id, null, 'RESET');
});

// POST /api/page-access/users/:id/copy-from/:sourceId
router.post('/users/:id/copy-from/:sourceId', writeLimiter, async (req: Request, res: Response) => {
  const { id, sourceId } = req.params;
  if (!isUuid(id) || !isUuid(sourceId)) return res.status(400).json({ success: false, error: 'Invalid user id.' });
  if (id === req.user?.id) return res.status(403).json({ success: false, error: 'You cannot change your own page permissions.' });
  try {
    const source = await loadUserPagePermissions(sourceId, true);
    await applyChange(req, res, id, source, source ? 'COPY' : 'RESET');
  } catch {
    res.status(503).json({ success: false, error: 'Permission lookup unavailable.' });
  }
});

// GET /api/page-access/audit?userId=&limit=
router.get('/audit', async (req: Request, res: Response) => {
  const db = dbOr503(res); if (!db) return;
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 500);
  let q = db.from('page_access_audit').select('*').order('created_at', { ascending: false }).limit(limit);
  if (req.query.userId !== undefined) {
    if (!isUuid(req.query.userId)) return res.status(400).json({ success: false, error: 'Invalid user id.' });
    q = q.eq('target_user_id', String(req.query.userId));
  }
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) return res.json({ success: true, entries: [], installed: false });
    return res.status(500).json({ success: false, error: 'Could not load audit history.' });
  }
  res.json({ success: true, installed: true, entries: data || [] });
});

export default router;
