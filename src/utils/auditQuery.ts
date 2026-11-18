import { ENTITY_MODULE_LABELS, fromDatabaseRow } from '../../server/schemaAdapter.ts';
import type { AuditLog } from '../types';

/**
 * Audit trail queries run in the database: search, filters, sort and one page of rows per request.
 * The same builder is used by the server route and by the browser on sites without the server, so both behave alike.
 */

export type AuditSortField = 'timestamp' | 'performedByUser' | 'performedByRole' | 'module' | 'action' | 'targetItem' | 'site' | 'details';

export interface AuditQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  /** Module labels shown in the Module column (e.g. "Properties"). Several labels = any of them. */
  modules?: string[];
  action?: string;
  user?: string;
  sortField?: AuditSortField;
  sortAsc?: boolean;
  /** Limit to what a site-restricted user may see: their site, their own actions, or their role. */
  restrict?: { site?: string; userName?: string; role?: string } | null;
}

export interface AuditPage { rows: AuditLog[]; total: number }

export const AUDIT_MAX_PAGE_SIZE = 200;

const SORT_COLUMN: Record<AuditSortField, string> = {
  timestamp: 'timestamp', performedByUser: 'user', performedByRole: 'role', module: 'module',
  action: 'action', targetItem: 'target_label', site: 'site', details: 'details'
};

/** Characters that would change the meaning of a PostgREST filter value. */
const clean = (v: string) => v.replace(/[,()*%\\"]/g, ' ').replace(/\s+/g, ' ').trim();
const quote = (v: string) => `"${v.replace(/"/g, '')}"`;

/** entity_type values that the Module column shows as `label` for rows saved before the module column existed. */
const entityTypesFor = (label: string): string[] => {
  const keys = Object.entries(ENTITY_MODULE_LABELS).filter(([, l]) => l === label).map(([k]) => k);
  return Array.from(new Set([label, ...keys])).filter(k => /^[A-Za-z0-9_ -]+$/.test(k));
};

/** Applies every filter, the sort and the page window to a supabase-js `audit_trails` select. */
export function applyAuditQuery(query: any, p: AuditQueryParams): any {
  let q = query;

  const modules = (p.modules || []).filter(Boolean);
  if (modules.length > 0) {
    const parts = modules.map(m => `module.eq.${quote(clean(m))},and(module.is.null,entity_type.in.(${entityTypesFor(m).map(k => quote(k)).join(',')}))`);
    q = q.or(parts.join(','));
  }
  if (p.action && p.action !== 'all') q = q.eq('action', p.action);
  if (p.user && p.user !== 'all') q = q.eq('user', p.user);

  const s = clean(p.search || '');
  if (s) {
    const like = `*${s}*`;
    q = q.or(['user', 'role', 'module', 'action', 'details', 'target_label', 'site', 'entity_id'].map(c => `${c}.ilike.${like}`).join(','));
  }

  const r = p.restrict;
  if (r) {
    const parts: string[] = [];
    if (r.site && clean(r.site)) parts.push(`site.ilike.${clean(r.site)}`);
    if (r.userName && clean(r.userName)) parts.push(`user.ilike.*${clean(r.userName)}*`);
    if (r.role && clean(r.role)) parts.push(`role.eq.${quote(clean(r.role))}`);
    // No usable identity at all: show nothing rather than everything
    q = q.or(parts.length > 0 ? parts.join(',') : 'id.eq.__none__');
  }

  const column = SORT_COLUMN[p.sortField || 'timestamp'] || 'timestamp';
  q = q.order(column, { ascending: !!p.sortAsc, nullsFirst: false }).order('id', { ascending: true });

  const size = Math.min(Math.max(1, Math.trunc(p.pageSize) || 15), AUDIT_MAX_PAGE_SIZE);
  const from = (Math.max(1, Math.trunc(p.page) || 1) - 1) * size;
  return q.range(from, from + size - 1);
}

export function rowToAuditLog(row: any): AuditLog {
  return fromDatabaseRow('audit_trails', row) as AuditLog;
}
