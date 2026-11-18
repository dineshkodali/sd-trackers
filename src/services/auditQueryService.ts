import { supabase } from '../lib/supabaseClient';
import { authHeaders, getApiUrl, shouldPreferDirectSupabase, isDirectSupabaseActive, getApiBaseUrl } from './apiService';
import { applyAuditQuery, rowToAuditLog, AUDIT_MAX_PAGE_SIZE, type AuditQueryParams, type AuditPage } from '../utils/auditQuery';

/**
 * One page of the audit trail, searched and filtered by the database.
 * Goes through the SDTracker server when there is one, and straight to Supabase on static hosting.
 */

const withoutServer = () => (shouldPreferDirectSupabase() || isDirectSupabaseActive()) && !getApiBaseUrl();

async function viaDatabase(params: AuditQueryParams): Promise<AuditPage> {
  if (!supabase) throw new Error('Database not configured');
  const { data, error, count } = await applyAuditQuery(supabase.from('audit_trails').select('*', { count: 'exact' }), params);
  if (error) throw new Error(error.message);
  return { rows: (data || []).map(rowToAuditLog), total: count ?? (data || []).length };
}

async function viaServer(params: AuditQueryParams, signal?: AbortSignal): Promise<AuditPage> {
  const q = new URLSearchParams();
  q.set('page', String(params.page));
  q.set('pageSize', String(params.pageSize));
  if (params.search) q.set('search', params.search);
  if (params.modules?.length) q.set('modules', params.modules.join('|'));
  if (params.action && params.action !== 'all') q.set('action', params.action);
  if (params.user && params.user !== 'all') q.set('user', params.user);
  q.set('sortField', params.sortField || 'timestamp');
  if (params.sortAsc) q.set('sortAsc', '1');
  if (params.restrict?.site) q.set('rSite', params.restrict.site);
  if (params.restrict?.userName) q.set('rUser', params.restrict.userName);
  if (params.restrict?.role) q.set('rRole', params.restrict.role);
  const res = await fetch(getApiUrl(`/api/db/audit_trails/search?${q.toString()}`), { headers: { 'Content-Type': 'application/json', ...authHeaders() }, signal });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.success === false || !Array.isArray(data.rows)) throw new Error(data?.error || `HTTP ${res.status}`);
  return { rows: data.rows, total: Number(data.total) || 0 };
}

export async function fetchAuditPage(params: AuditQueryParams, signal?: AbortSignal): Promise<AuditPage> {
  if (withoutServer()) return viaDatabase(params);
  try {
    return await viaServer(params, signal);
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    // The server could not be reached or does not have the route yet: ask the database directly
    return viaDatabase(params);
  }
}

/** Every row that matches (for export), fetched in pages and capped so one export cannot pull the whole table. */
export async function fetchAuditAll(params: Omit<AuditQueryParams, 'page' | 'pageSize'>, cap = 5000): Promise<AuditPage> {
  const rows: AuditPage['rows'] = [];
  let total = 0;
  for (let page = 1; rows.length < cap; page++) {
    const res = await fetchAuditPage({ ...params, page, pageSize: AUDIT_MAX_PAGE_SIZE });
    total = res.total;
    rows.push(...res.rows);
    if (res.rows.length < AUDIT_MAX_PAGE_SIZE || rows.length >= res.total) break;
  }
  return { rows: rows.slice(0, cap), total };
}
