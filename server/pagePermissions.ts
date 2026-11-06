import type { NextFunction, Request, Response } from 'express';
import { getSupabaseAdmin } from './supabase.js';
import {
  evaluateOverride,
  pageForTable,
  type PageAction,
  type UserPagePermissions,
} from '../src/config/pagePermissionsConfig.js';

/**
 * Server-side Page Access Management enforcement.
 * Fail-closed on lookup errors; fail-open only when the feature's table has not
 * been migrated yet (so a deployment without migration 026 behaves as before).
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_REGEX.test(v.trim());

const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { at: number; perms: UserPagePermissions | null }>();

export class PermissionLookupError extends Error {}

const isMissingTable = (e: any) => e?.code === '42P01' || e?.code === 'PGRST205' || e?.code === 'PGRST202';

export function invalidatePagePermissionCache(userId?: string) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

/** null => user has no override rows (unrestricted by this feature). */
export async function loadUserPagePermissions(userId: string, fresh = false): Promise<UserPagePermissions | null> {
  const hit = cache.get(userId);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.perms;

  const client = getSupabaseAdmin();
  if (!client) return null; // no database configured: nothing to enforce against
  const { data, error } = await client
    .from('user_page_permissions')
    .select('page_id, can_view, can_create, can_edit, can_delete, can_export, can_approve')
    .eq('user_id', userId);
  if (error) {
    if (isMissingTable(error)) {
      cache.set(userId, { at: Date.now(), perms: null });
      return null;
    }
    throw new PermissionLookupError(error.message);
  }
  let perms: UserPagePermissions | null = null;
  if (Array.isArray(data) && data.length > 0) {
    perms = {};
    for (const r of data) {
      perms[r.page_id] = {
        view: r.can_view === true,
        create: r.can_create === true && r.can_view === true,
        edit: r.can_edit === true && r.can_view === true,
        delete: r.can_delete === true && r.can_view === true,
        export: r.can_export === true && r.can_view === true,
        approve: r.can_approve === true && r.can_view === true,
      };
    }
  }
  cache.set(userId, { at: Date.now(), perms });
  return perms;
}

/** Super Admin and the built-in administrator are never restricted. */
function isExempt(user: Express.Request['user']): boolean {
  if (!user) return false;
  return user.role === 'Super Admin' || user.provider === 'built-in' || !isUuid(user.id);
}

export async function userMayAccessPage(user: Express.Request['user'], pageId: string, action: PageAction): Promise<boolean> {
  if (!user) return false;
  if (isExempt(user)) return true;
  const perms = await loadUserPagePermissions(user.id);
  return evaluateOverride(perms, pageId, action).allowed;
}

export async function userMayAccessTable(user: Express.Request['user'], table: string, action: PageAction): Promise<boolean> {
  const pageId = pageForTable(table);
  if (!pageId) return true; // table not page-restricted
  return userMayAccessPage(user, pageId, action);
}

function actionForRequest(req: Request): PageAction {
  const sub = req.path.replace(/\/+$/, '').split('/').filter(Boolean);
  // Mounted at /:entity, so req.path is relative to the entity ("/bulk-delete", "/:id").
  if (req.method === 'POST' && sub[0] === 'bulk-delete') return 'delete';
  switch (req.method) {
    case 'GET': case 'HEAD': return 'view';
    case 'POST': return 'create';
    case 'PUT': case 'PATCH': return 'edit';
    case 'DELETE': return 'delete';
    default: return 'view';
  }
}

export function sendDenied(res: Response) {
  return res.status(403).json({ success: false, error: 'Access denied: you do not have permission for this page or action.' });
}

export function sendLookupFailure(res: Response) {
  return res.status(503).json({ success: false, error: 'Permission check is temporarily unavailable. Please retry.' });
}

/**
 * Router-level guard for /api/db/:entity routes. `resolveTable` maps the entity
 * name to its table (injected to avoid a circular import with db.ts).
 */
export function enforceEntityPagePermission(resolveTable: (entity: string) => string | undefined) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entity = (req.params as Record<string, string>).entity;
      const table = entity ? resolveTable(entity) : undefined;
      if (!table) return next(); // unknown entity: the route returns its own 404
      if (!(await userMayAccessTable(req.user, table, actionForRequest(req)))) return sendDenied(res);
      return next();
    } catch (err) {
      if (err instanceof PermissionLookupError) return sendLookupFailure(res);
      return next(err);
    }
  };
}
