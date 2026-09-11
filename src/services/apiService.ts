import { diagnosticLogger } from '../utils/diagnosticLogger';
import { getBrowserSupabaseClient } from '../lib/supabaseClient';

/**
 * SD Operations API Client
 * Routes all database, authentication, and email services through server API routes (/api/*).
 * Zero credentials or secrets stored in webapp bundle; completely governed by root .env.
 */

export interface SystemConfigStatus {
  status: string;
  environment: string;
  services: {
    supabase: {
      configured: boolean;
      url: string | null;
      hasAnonKey: boolean;
      hasServiceRoleKey: boolean;
    };
    smtp: {
      configured: boolean;
      host: string | null;
      port: string | number;
      user: string | null;
      from: string | null;
    };
  };
}

export interface DbPageCoverage {
  entity: string;
  page: string;
  table: string;
  rows: number | null;
  sharedTable?: boolean;
  missingColumns: string[];
  connected: boolean;
  status: 'connected' | 'outdated' | 'missing' | 'error';
}

export interface DbStatusResponse {
  connected: boolean;
  live?: boolean;
  mode: 'supabase-cloud' | 'unconfigured' | 'unreachable' | 'offline';
  message?: string;
  url?: string;
  schemaVersion?: string | null;
  migrationRequired?: boolean;
  tables?: Record<string, number | string>;
  pages?: DbPageCoverage[];
  missingTables?: string[];
  outdatedTables?: string[];
  totalPages?: number;
  connectedPages?: number;
  error?: string;
}

/** Human-readable audit description sent alongside a write; identity is added by the server. */
export interface AuditDescriptor {
  action?: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE' | 'SETTINGS_UPDATE' | 'ROLE_CHANGE' | 'BACKUP_EXPORT' | 'DATA_RESTORE';
  module?: string;
  targetItem?: string;
  site?: string;
  details?: string;
}

export interface WriteResult<T = any> {
  success: boolean;
  record?: T;
  error?: string;
  status?: number;
  tableMissing?: boolean;
}

export type DbEntityName =
  | 'referrals'
  | 'vulnerable'
  | 'challenging'
  | 'maintenance'
  | 'spcd'
  | 'sites'
  | 'userGroups'
  | 'property_user_assignments'
  | 'audit'
  | 'audit_trails'
  | 'laundry'
  | 'laundry_logs'
  | 'property_laundry_logs'
  | 'food'
  | 'hot_food_logs'
  | 'food_vendor_buffet_logs'
  | 'escalations'
  | 'documents'
  | 'requests'
  | 'profiles'
  | 'users'
  | 'passwordAudit'
  | string;

export interface AuditUserContext {
  userId?: string;
  userEmail?: string;
  userName?: string;
  role?: string;
  site?: string;
  token?: string | null;
}

export interface AuditTrailPayload {
  id?: string;
  timestamp?: string;
  user?: string;
  userId?: string;
  role?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE' | 'SETTINGS_UPDATE' | 'ROLE_CHANGE' | 'LOGIN' | 'LOGOUT';
  details: string;
  site?: string;
  entityType?: string;
  entityId?: string;
  createdBy?: string;
}

let activeAuditContext: AuditUserContext | null = null;

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem('sd_api_url');
    if (override) return override.replace(/\/+$/, '');
    const winVal = (window as any).__VITE_API_URL__;
    if (winVal) return String(winVal).replace(/\/+$/, '');
  }
  const envVal = (import.meta as any).env?.VITE_API_URL || '';
  return String(envVal || '').replace(/\/+$/, '');
}

export function setApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem('sd_api_url', url.trim().replace(/\/+$/, ''));
    } else {
      localStorage.removeItem('sd_api_url');
    }
  }
}

/**
 * Resolves an API path against the configured backend base URL (if any).
 * In local development or when reverse-proxied via Amplify/Nginx, returns the relative `/api/...`.
 * In separated deployments (Amplify frontend + VPS/Render backend), returns `https://api.domain.com/api/...`.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${cleanPath}` : cleanPath;
}

/**
 * Safely parses API responses, providing clear diagnostics if the endpoint
 * returns HTML (e.g. Amplify SPA rewrite, offline server, or 404/502 gateway error)
 * instead of unhandled `SyntaxError: Unexpected token <, <!DOCTYPE... is not valid JSON`.
 */
async function parseApiResponse<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (
      text.trim().startsWith('<!DOCTYPE') ||
      text.trim().startsWith('<html') ||
      text.includes('__vite_plugin_react_preamble_installed__') ||
      text.includes('<title>')
    ) {
      const attemptedUrl = res.url || 'API endpoint';
      throw new Error(
        `Backend API unreachable at ${attemptedUrl} (HTTP ${res.status} ${res.statusText || 'Not Found'}). ` +
        `The server returned a web page (HTML) instead of JSON. ` +
        `If hosted on AWS Amplify, ensure your Express backend is running and either the /api rewrite rule or VITE_API_URL environment variable is set.`
      );
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(text.slice(0, 150) || `HTTP error ${res.status} ${res.statusText}`);
    }
  }
  return await res.json();
}

/**
 * Authorization header for the current session.
 *
 * `/api/db/*` and `/api/smtp/*` now require a verified session server-side
 * (BUG-001). Reads previously went out with no headers at all, which was fine
 * while the API was open and returns 401 now, so every call must carry the token.
 */
export function getActiveToken(): string | null {
  if (activeAuditContext?.token) return activeAuditContext.token;
  if (typeof window !== 'undefined') {
    try {
      // AppContext persists the session under `sg_tracker_token`; `token` is a legacy key.
      const stored = localStorage.getItem('sg_tracker_token') || localStorage.getItem('token');
      if (stored) {
        return stored.startsWith('"') ? JSON.parse(stored) : stored;
      }
    } catch {}
  }
  return null;
}

export function authHeaders(): Record<string, string> {
  const token = getActiveToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** base64 of UTF-8 JSON, safe for an HTTP header. */
function encodeAuditContext(audit?: AuditDescriptor): string | null {
  if (!audit) return null;
  try {
    const trimmed: AuditDescriptor = { ...audit, details: audit.details ? String(audit.details).slice(0, 3000) : undefined };
    const bytes = new TextEncoder().encode(JSON.stringify(trimmed));
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
  } catch {
    return null;
  }
}

/**
 * Normalise a write response. A non-2xx status is a failure even when the body
 * omits `success: false` — previously a 401/500 whose body lacked that flag
 * was reported to the UI as a successful save.
 */
async function toWriteResult<T>(res: Response): Promise<WriteResult<T>> {
  let json: any = {};
  try {
    json = await parseApiResponse<any>(res);
  } catch (err: any) {
    return { success: false, error: err.message, status: res.status };
  }
  if (!res.ok || json?.success === false) {
    return {
      success: false,
      error: json?.error || json?.message || `Request failed (HTTP ${res.status})`,
      status: res.status,
      tableMissing: !!json?.tableMissing
    };
  }
  return { success: true, record: json?.record, status: res.status };
}

function getAuditHeaders(actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' = 'READ', audit?: AuditDescriptor): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (activeAuditContext) {
    if (activeAuditContext.userId) headers['x-user-id'] = activeAuditContext.userId;
    if (activeAuditContext.userEmail) headers['x-user-email'] = activeAuditContext.userEmail;
    if (activeAuditContext.userName) headers['x-user-name'] = activeAuditContext.userName;
    if (activeAuditContext.role) headers['x-user-role'] = activeAuditContext.role;
    if (activeAuditContext.site) headers['x-user-site'] = activeAuditContext.site;
  }
  const token = getActiveToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  headers['x-action-type'] = actionType;
  const auditHeader = encodeAuditContext(audit);
  if (auditHeader) headers['x-audit-context'] = auditHeader;
  return headers;
}

export const apiService = {
  // Centralized Audit Middleware Context
  setAuditUserContext(ctx: AuditUserContext | null) {
    activeAuditContext = ctx;
  },

  getAuditUserContext(): AuditUserContext | null {
    return activeAuditContext;
  },

  /**
   * Record an audit entry that is not tied to a data write (sign-in, sign-out,
   * session lock, role switch). Data writes are audited by the server itself,
   * from the `audit` descriptor passed with the write.
   */
  async recordAuditTrail(entry: AuditTrailPayload & { module?: string; targetItem?: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();
      const payload = {
        id: entry.id || `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: entry.timestamp || now,
        action: entry.action,
        details: entry.details,
        site: entry.site || activeAuditContext?.site || 'All Sites',
        module: entry.module || entry.entityType || 'Settings',
        entityType: entry.entityType || entry.module || 'General',
        entityId: entry.entityId || null,
        targetItem: entry.targetItem || entry.entityId || null
      };

      const res = await fetch(getApiUrl('/api/db/audit_trails'), {
        method: 'POST',
        headers: getAuditHeaders(entry.action as any),
        body: JSON.stringify(payload)
      });
      const json = await toWriteResult(res);

      diagnosticLogger.logAuditDispatch({
        action: entry.action,
        entity: entry.entityType || 'audit_trails',
        entityId: entry.entityId,
        userId: activeAuditContext?.userId,
        success: json.success,
        error: json.error
      });

      return json;
    } catch (err: any) {
      diagnosticLogger.logAuditDispatch({
        action: entry.action,
        entity: entry.entityType || 'audit_trails',
        entityId: entry.entityId,
        userId: activeAuditContext?.userId,
        success: false,
        error: err.message
      });
      return { success: false, error: err.message };
    }
  },

  // System Configuration & Status
  async getConfigStatus(): Promise<SystemConfigStatus> {
    try {
      const res = await fetch(getApiUrl('/api/config/status'));
      return await parseApiResponse<SystemConfigStatus>(res);
    } catch (err) {
      console.warn('Could not fetch config status:', err);
      return {
        status: 'error',
        environment: 'client-only',
        services: {
          supabase: { configured: false, url: null, hasAnonKey: false, hasServiceRoleKey: false },
          smtp: { configured: false, host: null, port: 587, user: null, from: null }
        }
      };
    }
  },

  async testSupabase(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const res = await fetch(getApiUrl('/api/config/test-supabase'), { headers: authHeaders() });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { success: false, message: `Request failed: ${err.message}` };
    }
  },

  async testSmtp(recipientEmail?: string): Promise<{ success: boolean; message: string; config?: any }> {
    try {
      const res = await fetch(getApiUrl('/api/smtp/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ testRecipient: recipientEmail })
      });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { success: false, message: `SMTP test request failed: ${err.message}` };
    }
  },

  async sendOperationalAlert(alert: {
    recipient: string;
    alertType: string;
    title: string;
    message: string;
    entityId?: string;
    site?: string;
    severity?: 'Routine' | 'Urgent' | 'Critical';
  }): Promise<{ success: boolean; message: string; simulated?: boolean }> {
    try {
      const res = await fetch(getApiUrl('/api/smtp/alert'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(alert)
      });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { success: false, message: `Failed to dispatch alert: ${err.message}` };
    }
  },

  // Database API — every page's data lives in the live Supabase database.
  async getDbStatus(): Promise<DbStatusResponse> {
    try {
      const res = await fetch(getApiUrl('/api/db/status'), { headers: authHeaders() });
      const json = await parseApiResponse<DbStatusResponse>(res);
      if (!res.ok && !json?.mode) {
        return { connected: false, mode: 'offline', error: (json as any)?.error || `HTTP ${res.status}` };
      }
      return json;
    } catch (err: any) {
      return { connected: false, mode: 'offline', error: err.message };
    }
  },

  async fetchEntityRecords<T = any>(
    entity: DbEntityName,
    options: { limit?: number; order?: string; eq?: Record<string, string> } = {}
  ): Promise<{ success: boolean; data: T[]; error?: string; status?: number; tableMissing?: boolean }> {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', String(options.limit));
      if (options.order) params.set('order', options.order);
      for (const [column, value] of Object.entries(options.eq || {})) params.set(`eq.${column}`, value);
      const qs = params.toString();
      const res = await fetch(getApiUrl(`/api/db/${entity}${qs ? `?${qs}` : ''}`), { headers: authHeaders() });
      const json = await parseApiResponse<any>(res);
      if (!res.ok || json?.success === false || !Array.isArray(json?.data)) {
        return {
          success: false,
          data: [],
          error: json?.error || `HTTP ${res.status}`,
          status: res.status,
          tableMissing: !!json?.tableMissing
        };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      console.warn(`Failed to fetch ${entity} from API:`, err);
      return { success: false, data: [], error: err.message };
    }
  },

  async saveEntityRecord<T = any>(entity: DbEntityName, record: T, audit?: AuditDescriptor): Promise<WriteResult<T>> {
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}`), {
        method: 'POST',
        headers: getAuditHeaders('CREATE', audit),
        body: JSON.stringify(record)
      });
      const result = await toWriteResult<T>(res);
      diagnosticLogger.logAuditDispatch({ action: 'CREATE', entity, entityId: (record as any)?.id, userId: activeAuditContext?.userId, success: result.success, error: result.error });
      return result;
    } catch (err: any) {
      diagnosticLogger.logAuditDispatch({ action: 'CREATE', entity, entityId: (record as any)?.id, userId: activeAuditContext?.userId, success: false, error: err.message });
      return { success: false, error: `Network error: ${err.message}` };
    }
  },

  async updateEntityRecord<T = any>(entity: DbEntityName, id: string, record: Partial<T>, audit?: AuditDescriptor): Promise<WriteResult<T>> {
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: getAuditHeaders('UPDATE', audit),
        body: JSON.stringify(record)
      });
      const result = await toWriteResult<T>(res);
      diagnosticLogger.logAuditDispatch({ action: 'UPDATE', entity, entityId: id, userId: activeAuditContext?.userId, success: result.success, error: result.error });
      return result;
    } catch (err: any) {
      diagnosticLogger.logAuditDispatch({ action: 'UPDATE', entity, entityId: id, userId: activeAuditContext?.userId, success: false, error: err.message });
      return { success: false, error: `Network error: ${err.message}` };
    }
  },

  async deleteEntityRecord(entity: DbEntityName, id: string, audit?: AuditDescriptor): Promise<WriteResult> {
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: getAuditHeaders('DELETE', audit)
      });
      const result = await toWriteResult(res);
      diagnosticLogger.logAuditDispatch({ action: 'DELETE', entity, entityId: id, userId: activeAuditContext?.userId, success: result.success, error: result.error });
      return result;
    } catch (err: any) {
      diagnosticLogger.logAuditDispatch({ action: 'DELETE', entity, entityId: id, userId: activeAuditContext?.userId, success: false, error: err.message });
      return { success: false, error: `Network error: ${err.message}` };
    }
  },

  /** Read several entities in one request. Each entry in `results` succeeds or fails independently. */
  async batchFetchEntities(
    requests: Array<{ key: string; entity: DbEntityName; limit?: number; order?: string; eq?: Record<string, string> }>
  ): Promise<{ success: boolean; error?: string; status?: number; results: Record<string, { success: boolean; data: any[]; error?: string; tableMissing?: boolean }> }> {
    try {
      const res = await fetch(getApiUrl('/api/db/batch-read'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ requests })
      });
      const json = await parseApiResponse<any>(res);
      if (!res.ok || json?.success === false || !json?.results) {
        return { success: false, error: json?.error || `HTTP ${res.status}`, status: res.status, results: {} };
      }
      return { success: true, results: json.results };
    } catch (err: any) {
      return { success: false, error: err.message, results: {} };
    }
  },

  /** Upsert many records in one request (resets, restores, batch archives, local-data migration). */
  async bulkSaveEntityRecords<T = any>(entity: DbEntityName, records: T[], audit?: AuditDescriptor): Promise<{ success: boolean; count?: number; error?: string; status?: number; tableMissing?: boolean }> {
    if (records.length === 0) return { success: true, count: 0 };
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}/bulk`), {
        method: 'POST',
        headers: getAuditHeaders('UPDATE', audit),
        body: JSON.stringify({ records })
      });
      const json = await parseApiResponse<any>(res);
      if (!res.ok || json?.success === false) {
        return { success: false, error: json?.error || `HTTP ${res.status}`, status: res.status, tableMissing: !!json?.tableMissing };
      }
      return { success: true, count: json.count };
    } catch (err: any) {
      return { success: false, error: `Network error: ${err.message}` };
    }
  },

  async bulkDeleteEntityRecords(entity: DbEntityName, ids: string[], audit?: AuditDescriptor): Promise<{ success: boolean; deleted?: number; error?: string; status?: number }> {
    if (ids.length === 0) return { success: true, deleted: 0 };
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}/bulk-delete`), {
        method: 'POST',
        headers: getAuditHeaders('DELETE', audit),
        body: JSON.stringify({ ids })
      });
      const json = await parseApiResponse<any>(res);
      if (!res.ok || json?.success === false) {
        return { success: false, error: json?.error || `HTTP ${res.status}`, status: res.status };
      }
      return { success: true, deleted: json.deleted };
    } catch (err: any) {
      return { success: false, error: `Network error: ${err.message}` };
    }
  },

  async syncPushAll(payload: Record<string, any[]>): Promise<{ success: boolean; message: string; results?: any }> {
    try {
      const res = await fetch(getApiUrl('/api/db/sync/push'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  async runMigration(): Promise<{ success: boolean; message: string; applied?: boolean; seed?: { seeded: string[]; skipped: string[]; errors: string[] } }> {
    try {
      const res = await fetch(getApiUrl('/api/db/migrate'), {
        method: 'POST',
        headers: authHeaders()
      });
      const json = await parseApiResponse<any>(res);
      if (!res.ok && !json?.message) {
        return { success: false, message: json?.error || `Migration request failed (HTTP ${res.status})` };
      }
      return json;
    } catch (err: any) {
      return { success: false, message: `Migration request failed: ${err.message}` };
    }
  },

  /** The migration SQL, for pasting into the Supabase SQL editor when Postgres is unreachable from the server. */
  async getMigrationSql(): Promise<{ success: boolean; sql?: string; error?: string }> {
    try {
      const res = await fetch(getApiUrl('/api/db/migration-sql'), { headers: authHeaders() });
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      return { success: true, sql: await res.text() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Authentication API — Supabase Only
  async getAuthStatus(): Promise<{
    configured?: boolean;
    supabaseConfigured?: boolean;
    features?: any;
  }> {
    try {
      const res = await fetch(getApiUrl('/api/auth/status'));
      return await parseApiResponse<any>(res);
    } catch {
      return { configured: false, supabaseConfigured: false };
    }
  },

  async updateUserPassword(password: string, accessToken?: string): Promise<{
    success?: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch(getApiUrl('/api/auth/update-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ password, accessToken })
      });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async login(email: string, password: string): Promise<{
    success?: boolean;
    user?: { id: string; email: string; name: string; role: string; assignedSite: string };
    token?: string;
    session?: { accessToken: string; expiresAt?: number };
    fallbackMode?: boolean;
    error?: string;
  }> {
    const cleanEmail = (email || '').trim().toLowerCase();

    // A browser-side "break-glass" login used to live here: it matched a
    // hardcoded password shipped in this bundle and minted an unsigned token.
    // The server rejects that token, so every database call failed with 401 and
    // the app silently ran on local state. Sessions are issued by the server only.

    // 1. The Express backend API
    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email, password })
      });
      const data = await parseApiResponse<any>(res);
      if (data && (data.success || data.user)) {
        return data;
      }
      if (data && data.error && !data.error.includes('Backend API unreachable')) {
        return data;
      }
    } catch (apiErr: any) {
      console.warn('Backend API unavailable, falling back to direct browser Supabase auth:', apiErr.message);
    }

    // 2. Browser-Direct Supabase Authentication Fallback (for static hosting like Amplify)
    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) {
        return { error: 'Authentication service unavailable: Supabase client is not initialized. Please verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Amplify environment variables.' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error || !data?.user || !data?.session) {
        return { error: error?.message || 'Invalid email or password.' };
      }

      let role = (data.user.user_metadata?.role || 'Staff') as string;
      let name = (data.user.user_metadata?.full_name || data.user.user_metadata?.name || cleanEmail.split('@')[0]) as string;
      let assignedSite = (data.user.user_metadata?.assigned_site || data.user.user_metadata?.assignedSite || 'All Sites') as string;

      try {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        if (prof) {
          if (prof.role) role = prof.role;
          if (prof.name) name = prof.name;
          if (prof.assigned_site || prof.assignedSite) assignedSite = prof.assigned_site || prof.assignedSite;
        }
      } catch {}

      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          name,
          role,
          assignedSite
        },
        token: data.session.access_token,
        session: {
          accessToken: data.session.access_token,
          expiresAt: data.session.expires_at
        },
        fallbackMode: true
      };
    } catch (directErr: any) {
      return { error: directErr.message || 'Login failed.' };
    }
  },

  async verifySession(token: string): Promise<{
    success?: boolean;
    user?: { id: string; email: string; name: string; role: string; assignedSite: string; status?: string };
    error?: string;
    blockedReason?: string;
    /** The server could not be asked (outage), which is not the same as a rejected session. */
    transient?: boolean;
  }> {
    const startTime = performance.now();
    diagnosticLogger.logTokenExpiration(token, 'Session Verification');

    // Tokens minted by the removed browser-side break-glass login were never
    // valid on the server; discard them so the user signs in properly.
    if (token && (token.includes('master_signature') || token.startsWith('static-session'))) {
      return { error: 'This session was created offline and is not valid. Please sign in again.' };
    }

    // 1. The Express backend API
    let transientFailure = false;
    try {
      const res = await fetch(getApiUrl('/api/auth/me'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await parseApiResponse<any>(res);
      const durationMs = Math.round(performance.now() - startTime);

      if (res.ok && json.success && json.user) {
        diagnosticLogger.logProfileRetrieval({
          success: true,
          profile: json.user,
          source: 'Backend API /api/auth/me',
          durationMs
        });
        diagnosticLogger.logSessionStatus('active', `Session verified for ${json.user.email} (${json.user.role})`);
        return json;
      }
      if (res.status === 401 || res.status === 403) {
        return { error: json?.error || 'Invalid or expired session' };
      }
      transientFailure = res.status >= 500;
    } catch (apiErr: any) {
      transientFailure = true;
      console.warn('Backend API /api/auth/me unreachable, checking session directly with Supabase...');
    }

    // 2. Verify directly with browser Supabase client
    try {
      const supabase = getBrowserSupabaseClient();
      if (supabase) {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (user && !error) {
          let role = (user.user_metadata?.role || 'Staff') as string;
          let name = (user.user_metadata?.full_name || user.user_metadata?.name || (user.email || '').split('@')[0]) as string;
          let assignedSite = (user.user_metadata?.assigned_site || user.user_metadata?.assignedSite || 'All Sites') as string;
          let status = 'Active';

          try {
            const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (prof) {
              if (prof.role) role = prof.role;
              if (prof.name) name = prof.name;
              if (prof.assigned_site || prof.assignedSite) assignedSite = prof.assigned_site || prof.assignedSite;
              if (prof.status) status = prof.status;
            }
          } catch {}

          const verifiedUser = {
            id: user.id,
            email: user.email || '',
            name,
            role,
            assignedSite,
            status
          };

          const durationMs = Math.round(performance.now() - startTime);
          diagnosticLogger.logProfileRetrieval({
            success: true,
            profile: verifiedUser,
            source: 'Browser Supabase Client',
            durationMs
          });
          return {
            success: true,
            user: verifiedUser
          };
        }
      }
    } catch (supErr: any) {
      console.warn('Supabase direct session check failed:', supErr);
    }

    return transientFailure
      ? { error: 'The server could not verify the session right now', transient: true }
      : { error: 'Session verification failed' };
  },

  async logout(token?: string): Promise<{ success: boolean }> {
    try {
      await fetch(getApiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      return { success: true };
    } catch {
      return { success: true };
    }
  },

  // Automated Email Notification & Alert API
  async sendAlert(payload: {
    title: string;
    message?: string;
    alertType?: string;
    severity?: 'Low' | 'Medium' | 'High' | 'Critical' | 'Urgent';
    site?: string;
    entityId?: string;
    recipient?: string;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; message: string; messageId?: string; simulated?: boolean }> {
    try {
      const res = await fetch(getApiUrl('/api/smtp/alert'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  async sendEscalationAlert(payload: {
    suName: string;
    site: string;
    roomNo?: string;
    incidentTitle: string;
    urgency?: string;
    escalatedTo?: string;
    reason?: string;
    actionRequired?: string;
    reportedBy?: string;
    recipientEmail?: string;
  }): Promise<{ success: boolean; message: string; messageId?: string; simulated?: boolean }> {
    try {
      const res = await fetch(getApiUrl('/api/smtp/escalation-alert'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  async registerUser(userData: { email: string; password: string; name: string; role: string; assignedSite?: string }): Promise<{
    success?: boolean;
    user?: any;
    error?: string;
    message?: string;
  }> {
    try {
      const res = await fetch(getApiUrl('/api/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(userData)
      });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async adminUpdatePassword(payload: { userId?: string; email: string; newPassword: string }): Promise<{
    success?: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch(getApiUrl('/api/auth/admin/update-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async resetPassword(email: string): Promise<{ success?: boolean; message?: string; error?: string }> {
    try {
      const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : undefined;
      const res = await fetch(getApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email, origin })
      });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async fetchPasswordAuditLogs(): Promise<{ success?: boolean; logs?: any[]; error?: string }> {
    try {
      const res = await fetch(getApiUrl('/api/auth/password-audit-logs'), { headers: authHeaders() });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async fetchSupabaseUsers(): Promise<{ success?: boolean; users?: any[]; error?: string }> {
    try {
      const res = await fetch(getApiUrl('/api/auth/users'), { headers: authHeaders() });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async updateUserAssignment(userId: string, updates: {
    name?: string;
    role?: string;
    assignedSites?: string[];
    assignedSite?: string;
    status?: string;
  }): Promise<{ success: boolean; message?: string; user?: any; error?: string }> {
    try {
      const res = await fetch(getApiUrl(`/api/auth/users/${encodeURIComponent(userId)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(updates)
      });
      const json = await parseApiResponse<any>(res);
      if (!res.ok || json?.success === false) {
        return { success: false, error: json?.error || `HTTP ${res.status}` };
      }
      return json;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /** Delete the account from Supabase Auth; its profile and assignments cascade. */
  async deleteUserAccount(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(getApiUrl(`/api/auth/users/${encodeURIComponent(userId)}`), {
        method: 'DELETE',
        headers: authHeaders()
      });
      const json = await parseApiResponse<any>(res);
      if (!res.ok || json?.success === false) {
        return { success: false, error: json?.error || `HTTP ${res.status}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};

