import { getBrowserSupabaseClient } from '../lib/supabaseClient';
import { authHeaders, fetchWithTimeout, getApiBaseUrl, getApiUrl, isDirectSupabaseActive, shouldPreferDirectSupabase } from './apiService';
import { sanitizePermissions, type PageAction, type UserPagePermissions } from '../config/pagePermissionsConfig';

/**
 * Client for Page Access Management. Works over the Express API when present
 * and falls back to Supabase (RLS + SECURITY DEFINER functions) on static hosts.
 * Neither path is trusted for security - the server / database re-check every call.
 */

export interface PageAccessUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  assignedSite?: string;
  restricted: boolean;
}

export interface PageAccessAuditEntry {
  id: string;
  actorName: string;
  targetUserId: string;
  targetUserName: string;
  action: 'UPDATE' | 'RESET' | 'COPY';
  previous: UserPagePermissions;
  newPermissions: UserPagePermissions;
  createdAt: string;
}

const useDirect = () => (shouldPreferDirectSupabase() || isDirectSupabaseActive()) && !getApiBaseUrl();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rowsToPermissions(rows: any[] | null | undefined): UserPagePermissions | null {
  if (!rows || rows.length === 0) return null;
  const out: UserPagePermissions = {};
  for (const r of rows) {
    const v = r.can_view === true;
    out[r.page_id] = {
      view: v,
      create: v && r.can_create === true,
      edit: v && r.can_edit === true,
      delete: v && r.can_delete === true,
      export: v && r.can_export === true,
      approve: v && r.can_approve === true,
    };
  }
  return out;
}

async function expressJson(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetchWithTimeout(getApiUrl(path), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init.headers || {}) },
  }, 8000);
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok || json?.success === false) {
    const err: any = new Error(json?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

export type MyPermissionsResult = { ok: true; permissions: UserPagePermissions | null } | { ok: false };

export const pageAccessService = {
  /** The signed-in user's own overrides. `permissions: null` = unrestricted. */
  async fetchMine(userId: string): Promise<MyPermissionsResult> {
    if (!UUID.test(userId)) return { ok: true, permissions: null };
    if (!useDirect()) {
      try {
        const json = await expressJson('/api/page-access/me');
        return { ok: true, permissions: json.permissions ? sanitizePermissions(json.permissions) : null };
      } catch (e: any) {
        if (e?.status === 401 || e?.status === 403) return { ok: false };
        // Express unreachable: fall through to direct Supabase.
      }
    }
    const sb = getBrowserSupabaseClient();
    if (!sb) return { ok: true, permissions: null };
    const { data, error } = await sb.from('user_page_permissions').select('*').eq('user_id', userId);
    if (error) {
      // Table not installed yet => feature dormant, behave as before.
      if (['42P01', 'PGRST205'].includes((error as any).code)) return { ok: true, permissions: null };
      return { ok: false };
    }
    return { ok: true, permissions: rowsToPermissions(data) };
  },

  async listUsers(): Promise<{ users: PageAccessUser[]; installed: boolean }> {
    if (!useDirect()) {
      try {
        const json = await expressJson('/api/page-access/users');
        return { users: json.users || [], installed: json.installed !== false };
      } catch (e: any) {
        if (e?.status === 403 || e?.status === 401) throw e;
      }
    }
    const sb = getBrowserSupabaseClient();
    if (!sb) throw new Error('Database connection unavailable.');
    const { data: users, error } = await sb.from('profiles').select('id, name, email, role, status, assigned_site').order('name');
    if (error) throw new Error('Could not load users.');
    const { data: rows, error: rowsErr } = await sb.from('user_page_permissions').select('user_id');
    const installed = !(rowsErr && ['42P01', 'PGRST205'].includes((rowsErr as any).code));
    const restricted = new Set((rows || []).map((r: any) => r.user_id));
    return {
      installed,
      users: (users || []).map((u: any) => ({
        id: u.id, name: u.name, email: u.email, role: u.role, status: u.status,
        assignedSite: u.assigned_site, restricted: restricted.has(u.id),
      })),
    };
  },

  async getUser(userId: string): Promise<UserPagePermissions | null> {
    if (!useDirect()) {
      try {
        const json = await expressJson(`/api/page-access/users/${encodeURIComponent(userId)}`);
        return json.permissions ? sanitizePermissions(json.permissions) : null;
      } catch (e: any) {
        if (e?.status === 403 || e?.status === 401) throw e;
      }
    }
    const sb = getBrowserSupabaseClient();
    if (!sb) throw new Error('Database connection unavailable.');
    const { data, error } = await sb.from('user_page_permissions').select('*').eq('user_id', userId);
    if (error) throw new Error('Could not load permissions.');
    return rowsToPermissions(data);
  },

  async save(userId: string, permissions: UserPagePermissions | null, action: 'UPDATE' | 'RESET' | 'COPY' = 'UPDATE'): Promise<void> {
    if (!useDirect()) {
      try {
        if (permissions === null) {
          await expressJson(`/api/page-access/users/${encodeURIComponent(userId)}/reset`, { method: 'POST', body: '{}' });
        } else {
          await expressJson(`/api/page-access/users/${encodeURIComponent(userId)}`, { method: 'PUT', body: JSON.stringify({ permissions }) });
        }
        return;
      } catch (e: any) {
        if (e?.status) throw e; // server answered: do not retry via another path
      }
    }
    const sb = getBrowserSupabaseClient();
    if (!sb) throw new Error('Database connection unavailable.');
    const { error } = await sb.rpc('save_user_page_permissions', {
      p_target: userId,
      p_perms: permissions === null ? null : sanitizePermissions(permissions),
      p_action: action,
    });
    if (error) throw new Error(error.message || 'Could not save permissions.');
  },

  async copyFrom(targetId: string, sourceId: string): Promise<void> {
    if (!useDirect()) {
      try {
        await expressJson(`/api/page-access/users/${encodeURIComponent(targetId)}/copy-from/${encodeURIComponent(sourceId)}`, { method: 'POST', body: '{}' });
        return;
      } catch (e: any) {
        if (e?.status) throw e;
      }
    }
    const source = await this.getUser(sourceId);
    await this.save(targetId, source, source ? 'COPY' : 'RESET');
  },

  async fetchAudit(userId?: string): Promise<PageAccessAuditEntry[]> {
    let rows: any[] = [];
    let done = false;
    if (!useDirect()) {
      try {
        const q = userId ? `?userId=${encodeURIComponent(userId)}&limit=100` : '?limit=100';
        const json = await expressJson(`/api/page-access/audit${q}`);
        rows = json.entries || [];
        done = true;
      } catch (e: any) {
        if (e?.status === 403 || e?.status === 401) throw e;
      }
    }
    if (!done) {
      const sb = getBrowserSupabaseClient();
      if (!sb) return [];
      let q = sb.from('page_access_audit').select('*').order('created_at', { ascending: false }).limit(100);
      if (userId) q = q.eq('target_user_id', userId);
      const { data, error } = await q;
      if (error) return [];
      rows = data || [];
    }
    return rows.map(r => ({
      id: r.id,
      actorName: r.actor_name,
      targetUserId: r.target_user_id,
      targetUserName: r.target_user_name || '',
      action: r.action,
      previous: (r.previous || {}) as UserPagePermissions,
      newPermissions: (r.new_permissions || {}) as UserPagePermissions,
      createdAt: r.created_at,
    }));
  },
};

export type { PageAction };
