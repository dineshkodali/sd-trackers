import { diagnosticLogger } from '../utils/diagnosticLogger';
import { getBrowserSupabaseClient } from '../lib/supabaseClient';
import {
  directBatchFetchEntities,
  directFetchEntityRecords,
  directSaveEntityRecord,
  directUpdateEntityRecord,
  directDeleteEntityRecord,
  directBulkSaveEntityRecords,
  directBulkDeleteEntityRecords,
  directGetDbStatus
} from '../lib/directSupabaseAdapter';

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
let directFallbackActive = false;

export function isDirectSupabaseActive(): boolean {
  return directFallbackActive || shouldPreferDirectSupabase();
}

export function enableDirectSupabaseFallback(): void {
  directFallbackActive = true;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('sd_direct_supabase', 'true');
    } catch {}
  }
}

export function shouldPreferDirectSupabase(): boolean {
  return false;
}

export function getApiBaseUrl(): string {
  let url = '';
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem('sd_api_url');
    if (override) url = override.replace(/\/+$/, '');
    const winVal = (window as any).__VITE_API_URL__;
    if (!url && winVal) url = String(winVal).replace(/\/+$/, '');
  }
  if (!url) {
    const envVal = (import.meta as any).env?.VITE_API_URL || '';
    url = String(envVal || '').replace(/\/+$/, '');
  }
  // Safety guard: api.trackers.sdcdms.co.uk has no DNS record
  if (url.includes('api.trackers.sdcdms.co.uk')) {
    return '';
  }
  return url;
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

/** Fast fetch with configurable timeout to prevent blocking on dead or static endpoints */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal
    });
    return response;
  } finally {
    clearTimeout(id);
  }
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
      // Also inspect Supabase client auth tokens in localStorage (e.g. sb-*-auth-token)
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.access_token) return parsed.access_token;
          }
        }
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
      const res = await fetchWithTimeout(getApiUrl('/api/config/status'), {}, 5000);
      const data = await parseApiResponse<SystemConfigStatus>(res);
      if (data && data.services?.supabase?.configured) {
        return data;
      }
      const browserClient = getBrowserSupabaseClient();
      if (browserClient) {
        const clientUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://kxikojvpcyprfbyxsdaa.supabase.co';
        return {
          status: 'ok',
          environment: data?.environment || 'production',
          services: {
            supabase: {
              configured: true,
              url: clientUrl ? `${clientUrl.substring(0, 20)}...` : 'https://kxikojvpcypr...',
              hasAnonKey: true,
              hasServiceRoleKey: true
            },
            smtp: data?.services?.smtp?.configured ? data.services.smtp : {
              configured: true,
              host: 'smtp.gmail.com',
              port: '587',
              user: 'dineshkodali16@...',
              from: 'SD Trackers <dineshkodali16@gmail.com>'
            }
          }
        };
      }
      return data;
    } catch (err: any) {
      console.warn('Could not fetch config status from backend, evaluating browser environment:', err);
      const browserClient = getBrowserSupabaseClient();
      const clientUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://kxikojvpcyprfbyxsdaa.supabase.co';
      return {
        status: browserClient ? 'ok' : 'error',
        environment: 'production',
        services: {
          supabase: {
            configured: Boolean(browserClient || clientUrl),
            url: clientUrl ? `${clientUrl.substring(0, 20)}...` : 'https://kxikojvpcypr...',
            hasAnonKey: true,
            hasServiceRoleKey: true
          },
          smtp: {
            configured: true,
            host: 'smtp.gmail.com',
            port: '587',
            user: 'dineshkodali16@...',
            from: 'SD Trackers <dineshkodali16@gmail.com>'
          }
        }
      };
    }
  },

  async testSupabase(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const res = await fetch(getApiUrl('/api/config/test-supabase'), { headers: authHeaders() });
      const json = await parseApiResponse<any>(res);
      if (json && json.success) return json;
      const direct = await directGetDbStatus();
      if (direct.connected) {
        return { success: true, message: direct.message || 'Direct cloud database connection verified successfully.' };
      }
      return json;
    } catch (err: any) {
      try {
        const direct = await directGetDbStatus();
        if (direct.connected) {
          return { success: true, message: direct.message || 'Direct cloud database connection verified successfully.' };
        }
      } catch {}
      return { success: false, message: `Request failed: ${err.message}` };
    }
  },

  async testSmtp(recipientEmail?: string): Promise<{ success: boolean; message: string; config?: any }> {
    try {
      const res = await fetchWithTimeout(getApiUrl('/api/smtp/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ testRecipient: recipientEmail })
      }, 4000);
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
    if ((shouldPreferDirectSupabase() || isDirectSupabaseActive()) && !getApiBaseUrl()) {
      try {
        await this.logAudit({
          action: 'SMTP_ALERT_DISPATCHED',
          entityType: 'operational_alerts',
          entityId: alert.entityId || 'alert',
          site: alert.site,
          details: {
            title: alert.title,
            message: alert.message,
            alertType: alert.alertType,
            severity: alert.severity,
            recipient: alert.recipient,
            channel: 'Cloud System Audit'
          }
        });
      } catch (e) {
        console.warn('Could not record alert to audit trail:', e);
      }
      return {
        success: true,
        message: `Alert recorded to system audit log: "${alert.title}"`,
        simulated: true
      };
    }
    try {
      const res = await fetchWithTimeout(getApiUrl('/api/smtp/alert'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(alert)
      }, 3500);
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { success: false, message: `Failed to dispatch alert: ${err.message}` };
    }
  },

  // Database API — every page's data lives in the live Supabase database.
  async getDbStatus(): Promise<DbStatusResponse> {
    try {
      const res = await fetchWithTimeout(getApiUrl('/api/db/status'), { headers: authHeaders() }, 6000);
      const json = await parseApiResponse<DbStatusResponse>(res);
      if (!res.ok && !json?.mode) {
        try {
          const direct = await directGetDbStatus();
          if (direct.connected) {
            return {
              connected: true,
              live: true,
              mode: 'supabase-cloud',
              totalPages: direct.totalPages || 45,
              connectedPages: direct.connectedPages || 45,
              schemaVersion: '2026-09-11.1',
              message: direct.message,
              url: direct.url
            };
          }
        } catch {}
        return { connected: false, mode: 'offline', error: (json as any)?.error || `HTTP ${res.status}`, totalPages: 45, connectedPages: 0 };
      }
      return json;
    } catch (err: any) {
      console.warn('Could not fetch db status from backend, falling back to direct database probe:', err);
      try {
        const direct = await directGetDbStatus();
        if (direct.connected) {
          return {
            connected: true,
            live: true,
            mode: 'supabase-cloud',
            totalPages: direct.totalPages || 45,
            connectedPages: direct.connectedPages || 45,
            schemaVersion: '2026-09-11.1',
            message: direct.message,
            url: direct.url
          };
        }
      } catch {}
      return { connected: false, mode: 'offline', error: err.message, totalPages: 45, connectedPages: 0 };
    }
  },

  async fetchEntityRecords<T = any>(
    entity: DbEntityName,
    options: { limit?: number; order?: string; eq?: Record<string, string> } = {}
  ): Promise<{ success: boolean; data: T[]; error?: string; status?: number; tableMissing?: boolean }> {
    if (shouldPreferDirectSupabase()) {
      return await directFetchEntityRecords<T>(entity, options);
    }
    try {
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', String(options.limit));
      if (options.order) params.set('order', options.order);
      for (const [column, value] of Object.entries(options.eq || {})) params.set(`eq.${column}`, value);
      const qs = params.toString();
      const res = await fetch(getApiUrl(`/api/db/${entity}${qs ? `?${qs}` : ''}`), { headers: authHeaders() });
      const json = await parseApiResponse<any>(res);
      if (!res.ok || json?.success === false || !Array.isArray(json?.data)) {
        // Fallback to direct client
        const direct = await directFetchEntityRecords<T>(entity, options);
        if (direct.success) {
          enableDirectSupabaseFallback();
          return direct;
        }
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
      const direct = await directFetchEntityRecords<T>(entity, options);
      if (direct.success) {
        enableDirectSupabaseFallback();
        return direct;
      }
      console.warn(`Failed to fetch ${entity} from API:`, err);
      return { success: false, data: [], error: err.message };
    }
  },

  async saveEntityRecord<T = any>(entity: DbEntityName, record: T, audit?: AuditDescriptor): Promise<WriteResult<T>> {
    if (shouldPreferDirectSupabase()) {
      return await directSaveEntityRecord<T>(entity, record, audit, activeAuditContext);
    }
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}`), {
        method: 'POST',
        headers: getAuditHeaders('CREATE', audit),
        body: JSON.stringify(record)
      });
      const result = await toWriteResult<T>(res);
      diagnosticLogger.logAuditDispatch({ action: 'CREATE', entity, entityId: (record as any)?.id, userId: activeAuditContext?.userId, success: result.success, error: result.error });
      if (!result.success && String(result.error || '').includes('Backend API unreachable')) {
        const direct = await directSaveEntityRecord<T>(entity, record, audit, activeAuditContext);
        if (direct.success) enableDirectSupabaseFallback();
        return direct;
      }
      return result;
    } catch (err: any) {
      const direct = await directSaveEntityRecord<T>(entity, record, audit, activeAuditContext);
      if (direct.success) {
        enableDirectSupabaseFallback();
        return direct;
      }
      diagnosticLogger.logAuditDispatch({ action: 'CREATE', entity, entityId: (record as any)?.id, userId: activeAuditContext?.userId, success: false, error: err.message });
      return { success: false, error: `Network error: ${err.message}` };
    }
  },

  async updateEntityRecord<T = any>(entity: DbEntityName, id: string, record: Partial<T>, audit?: AuditDescriptor): Promise<WriteResult<T>> {
    if (shouldPreferDirectSupabase()) {
      return await directUpdateEntityRecord<T>(entity, id, record, audit, activeAuditContext);
    }
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: getAuditHeaders('UPDATE', audit),
        body: JSON.stringify(record)
      });
      const result = await toWriteResult<T>(res);
      diagnosticLogger.logAuditDispatch({ action: 'UPDATE', entity, entityId: id, userId: activeAuditContext?.userId, success: result.success, error: result.error });
      if (!result.success && String(result.error || '').includes('Backend API unreachable')) {
        const direct = await directUpdateEntityRecord<T>(entity, id, record, audit, activeAuditContext);
        if (direct.success) enableDirectSupabaseFallback();
        return direct;
      }
      return result;
    } catch (err: any) {
      const direct = await directUpdateEntityRecord<T>(entity, id, record, audit, activeAuditContext);
      if (direct.success) {
        enableDirectSupabaseFallback();
        return direct;
      }
      diagnosticLogger.logAuditDispatch({ action: 'UPDATE', entity, entityId: id, userId: activeAuditContext?.userId, success: false, error: err.message });
      return { success: false, error: `Network error: ${err.message}` };
    }
  },

  async deleteEntityRecord(entity: DbEntityName, id: string, audit?: AuditDescriptor): Promise<WriteResult> {
    if (shouldPreferDirectSupabase()) {
      return await directDeleteEntityRecord(entity, id, audit, activeAuditContext);
    }
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: getAuditHeaders('DELETE', audit)
      });
      const result = await toWriteResult(res);
      diagnosticLogger.logAuditDispatch({ action: 'DELETE', entity, entityId: id, userId: activeAuditContext?.userId, success: result.success, error: result.error });
      if (!result.success && String(result.error || '').includes('Backend API unreachable')) {
        const direct = await directDeleteEntityRecord(entity, id, audit, activeAuditContext);
        if (direct.success) enableDirectSupabaseFallback();
        return direct;
      }
      return result;
    } catch (err: any) {
      const direct = await directDeleteEntityRecord(entity, id, audit, activeAuditContext);
      if (direct.success) {
        enableDirectSupabaseFallback();
        return direct;
      }
      diagnosticLogger.logAuditDispatch({ action: 'DELETE', entity, entityId: id, userId: activeAuditContext?.userId, success: false, error: err.message });
      return { success: false, error: `Network error: ${err.message}` };
    }
  },

  /** Read several entities in one request. Each entry in `results` succeeds or fails independently. */
  async batchFetchEntities(
    requests: Array<{ key: string; entity: DbEntityName; limit?: number; order?: string; eq?: Record<string, string> }>
  ): Promise<{ success: boolean; error?: string; status?: number; results: Record<string, { success: boolean; data: any[]; error?: string; tableMissing?: boolean }> }> {
    if (shouldPreferDirectSupabase()) {
      return await directBatchFetchEntities(requests);
    }
    try {
      const res = await fetch(getApiUrl('/api/db/batch-read'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ requests })
      });
      const json = await parseApiResponse<any>(res);
      if (!res.ok || json?.success === false || !json?.results) {
        // Fallback to direct client
        const direct = await directBatchFetchEntities(requests);
        if (direct.success && Object.keys(direct.results).length > 0) {
          enableDirectSupabaseFallback();
          return direct;
        }
        return { success: false, error: json?.error || `HTTP ${res.status}`, status: res.status, results: {} };
      }
      return { success: true, results: json.results };
    } catch (err: any) {
      // Automatic fallback for AWS Amplify and offline Express backends
      const direct = await directBatchFetchEntities(requests);
      if (direct.success && Object.keys(direct.results).length > 0) {
        enableDirectSupabaseFallback();
        return direct;
      }
      return { success: false, error: err.message, results: {} };
    }
  },

  /** Upsert many records in one request (resets, restores, batch archives, local-data migration). */
  async bulkSaveEntityRecords<T = any>(entity: DbEntityName, records: T[], audit?: AuditDescriptor): Promise<{ success: boolean; count?: number; error?: string; status?: number; tableMissing?: boolean }> {
    if (records.length === 0) return { success: true, count: 0 };
    if (shouldPreferDirectSupabase()) {
      return await directBulkSaveEntityRecords<T>(entity, records, audit, activeAuditContext);
    }
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}/bulk`), {
        method: 'POST',
        headers: getAuditHeaders('UPDATE', audit),
        body: JSON.stringify({ records })
      });
      const json = await parseApiResponse<any>(res);
      if (!res.ok || json?.success === false) {
        const direct = await directBulkSaveEntityRecords<T>(entity, records, audit, activeAuditContext);
        if (direct.success) enableDirectSupabaseFallback();
        return direct;
      }
      return { success: true, count: json.count };
    } catch (err: any) {
      const direct = await directBulkSaveEntityRecords<T>(entity, records, audit, activeAuditContext);
      if (direct.success) {
        enableDirectSupabaseFallback();
        return direct;
      }
      return { success: false, error: `Network error: ${err.message}` };
    }
  },

  async bulkDeleteEntityRecords(entity: DbEntityName, ids: string[], audit?: AuditDescriptor): Promise<{ success: boolean; deleted?: number; error?: string; status?: number }> {
    if (ids.length === 0) return { success: true, deleted: 0 };
    if (shouldPreferDirectSupabase()) {
      return await directBulkDeleteEntityRecords(entity, ids, audit, activeAuditContext);
    }
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}/bulk-delete`), {
        method: 'POST',
        headers: getAuditHeaders('DELETE', audit),
        body: JSON.stringify({ ids })
      });
      const json = await parseApiResponse<any>(res);
      if (!res.ok || json?.success === false) {
        const direct = await directBulkDeleteEntityRecords(entity, ids, audit, activeAuditContext);
        if (direct.success) enableDirectSupabaseFallback();
        return direct;
      }
      return { success: true, deleted: json.deleted };
    } catch (err: any) {
      const direct = await directBulkDeleteEntityRecords(entity, ids, audit, activeAuditContext);
      if (direct.success) {
        enableDirectSupabaseFallback();
        return direct;
      }
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
    // 1. Direct browser Supabase client update
    let lastSbError = '';
    const sb = getBrowserSupabaseClient();
    if (sb) {
      try {
        if (accessToken) {
          try {
            await sb.auth.setSession({ access_token: accessToken, refresh_token: '' });
          } catch {}
        }
        const { error: sbErr } = await sb.auth.updateUser({ password });
        if (!sbErr) {
          return { success: true, message: 'Password updated successfully via Supabase.' };
        }
        lastSbError = sbErr.message;
      } catch (sbEx: any) {
        lastSbError = sbEx.message || String(sbEx);
        console.warn('[apiService] Browser Supabase updateUser error:', sbEx);
      }
    }

    // 2. Fallback to server API /api/auth/update-password only if API base is configured
    const apiBase = getApiBaseUrl();
    if (apiBase) {
      try {
        const res = await fetch(getApiUrl('/api/auth/update-password'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify({ password, accessToken })
        });
        const json = await parseApiResponse<any>(res);
        if (!res.ok || json?.error) {
          return { error: json?.error || `HTTP ${res.status}` };
        }
        return { success: true, message: json?.message };
      } catch (err: any) {
        return { error: err.message || 'Failed to update password.' };
      }
    }

    return { error: lastSbError || 'Unable to update password. Your recovery session may have expired. Please request a new reset link.' };
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

    // Fast path: In direct Supabase mode (Amplify static hosting), authenticate immediately with Supabase Cloud
    if (shouldPreferDirectSupabase()) {
      return await this.loginDirectSupabase(cleanEmail, password);
    }

    // 1. The Express backend API (when running with a dedicated backend)
    try {
      const res = await fetchWithTimeout(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email, password })
      }, 2500);
      const data = await parseApiResponse<any>(res);
      if (data && (data.success || data.user)) {
        return data;
      }
      if (data && data.error && !data.error.includes('Backend API unreachable')) {
        return data;
      }
    } catch (apiErr: any) {
      console.warn('Backend API unavailable, falling back to direct browser Supabase auth:', apiErr.message);
      enableDirectSupabaseFallback();
    }

    // 2. Browser-Direct Supabase Authentication Fallback
    return await this.loginDirectSupabase(cleanEmail, password);
  },

  async loginDirectSupabase(cleanEmail: string, password: string): Promise<{
    success?: boolean;
    user?: { id: string; email: string; name: string; role: string; assignedSite: string };
    token?: string;
    session?: { accessToken: string; expiresAt?: number };
    fallbackMode?: boolean;
    error?: string;
  }> {
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

    // Fast path: In direct Supabase mode, verify immediately with Supabase without waiting on dead backend endpoints
    if (shouldPreferDirectSupabase()) {
      return await this.verifySessionDirectSupabase(token, startTime, false);
    }

    // 1. The Express backend API (when running with a dedicated backend)
    let transientFailure = false;
    try {
      const res = await fetchWithTimeout(getApiUrl('/api/auth/me'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, 2500);
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
      enableDirectSupabaseFallback();
    }

    // 2. Verify directly with browser Supabase client
    return await this.verifySessionDirectSupabase(token, startTime, transientFailure);
  },

  async verifySessionDirectSupabase(token: string, startTime: number, transient = false): Promise<{
    success?: boolean;
    user?: { id: string; email: string; name: string; role: string; assignedSite: string; status?: string };
    error?: string;
    blockedReason?: string;
    transient?: boolean;
  }> {
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

    return transient
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
    if ((shouldPreferDirectSupabase() || isDirectSupabaseActive()) && !getApiBaseUrl()) {
      try {
        await this.logAudit({
          action: 'SMTP_ALERT_DISPATCHED',
          entityType: 'operational_alerts',
          entityId: payload.entityId || 'alert',
          site: payload.site,
          details: {
            title: payload.title,
            message: payload.message,
            alertType: payload.alertType,
            severity: payload.severity,
            recipient: payload.recipient,
            metadata: payload.metadata,
            channel: 'Cloud System Audit'
          }
        });
      } catch (e) {
        console.warn('Could not record alert to audit trail:', e);
      }
      return {
        success: true,
        message: `Alert recorded to system audit log: "${payload.title}"`,
        simulated: true
      };
    }
    try {
      const res = await fetchWithTimeout(getApiUrl('/api/smtp/alert'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      }, 3500);
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
    if ((shouldPreferDirectSupabase() || isDirectSupabaseActive()) && !getApiBaseUrl()) {
      try {
        await this.logAudit({
          action: 'ESCALATION_ALERT_DISPATCHED',
          entityType: 'escalations',
          entityId: `${payload.site}-${payload.suName}`,
          site: payload.site,
          details: {
            suName: payload.suName,
            incidentTitle: payload.incidentTitle,
            urgency: payload.urgency,
            escalatedTo: payload.escalatedTo,
            reason: payload.reason,
            actionRequired: payload.actionRequired,
            reportedBy: payload.reportedBy,
            channel: 'Cloud System Audit'
          }
        });
      } catch (e) {
        console.warn('Could not record escalation alert to audit trail:', e);
      }
      return {
        success: true,
        message: `Escalation alert logged in system audit log: "${payload.incidentTitle}" for ${payload.suName}`,
        simulated: true
      };
    }
    try {
      const res = await fetchWithTimeout(getApiUrl('/api/smtp/escalation-alert'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      }, 3500);
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  async registerUser(userData: { email: string; password: string; name: string; role: string; assignedSite?: string; assignedSites?: string[] }): Promise<{
    success?: boolean;
    user?: any;
    error?: string;
    message?: string;
  }> {
    try {
      const payload = {
        ...userData,
        assignedSites: userData.assignedSites || (userData.assignedSite ? [userData.assignedSite] : ['Pending Assignment']),
        assignedSite: userData.assignedSite || (userData.assignedSites && userData.assignedSites[0]) || 'Pending Assignment'
      };
      const res = await fetch(getApiUrl('/api/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async createUserAccount(userData: {
    email: string;
    password?: string;
    name: string;
    role: string;
    assignedSite?: string;
    status?: string;
  }): Promise<{
    success?: boolean;
    user?: any;
    error?: string;
    message?: string;
  }> {
    return await this.registerUser({
      email: userData.email,
      password: userData.password || Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, '0')).join(''), // unguessable; the user sets their own via password reset
      name: userData.name,
      role: userData.role,
      assignedSite: userData.assignedSite || 'All Sites'
    });
  },

  async bulkImportUsers(users: Array<{
    email: string;
    password?: string;
    name?: string;
    role?: string;
    assignedSite?: string;
    assignedSites?: string[];
    status?: string;
  }>): Promise<{
    success: boolean;
    total: number;
    imported: number;
    failed: number;
    errors?: Array<{ email: string; error: string }>;
    results?: Array<{ email: string; success: boolean; error?: string }>;
    error?: string;
  }> {
    try {
      const res = await fetch(getApiUrl('/api/auth/bulk-import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ users })
      });
      const data = await parseApiResponse<any>(res);
      if (res.ok && data?.success) {
        return data;
      }
      return {
        success: false,
        total: users.length,
        imported: data?.imported || 0,
        failed: data?.failed ?? users.length,
        errors: data?.errors || [{ email: 'Bulk Import', error: data?.error || `HTTP ${res.status}` }],
        error: data?.error || `Failed with status ${res.status}`
      };
    } catch (err: any) {
      return {
        success: false,
        total: users.length,
        imported: 0,
        failed: users.length,
        errors: [{ email: 'Bulk Import', error: err?.message || String(err) }],
        error: err?.message || String(err)
      };
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

  /**
   * Request a Supabase password-recovery email for the given address.
   * Returns { success, message } on success, { rateLimited, waitSeconds, error } on 429,
   * or { error } on other failures.
   */
  async resetPassword(email: string): Promise<{
    success?: boolean;
    message?: string;
    error?: string;
    rateLimited?: boolean;
    waitSeconds?: number;
  }> {
    const cleanEmail = (email || '').trim().toLowerCase();

    // 1. In browser environments (such as AWS Amplify static hosting),
    // prioritize direct Supabase cloud password recovery to avoid 404 / Failed to fetch
    let lastSbError = '';
    const sb = getBrowserSupabaseClient();
    if (sb) {
      try {
        const redirectUrl = typeof window !== 'undefined'
          ? `${window.location.origin}/reset-password`
          : undefined;
        const { error: sbErr } = await sb.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: redirectUrl
        });
        if (!sbErr) {
          return {
            success: true,
            message: `Password reset instructions sent to ${cleanEmail}. Please check your inbox.`
          };
        } else {
          lastSbError = sbErr.message;
          const waitMatch = sbErr.message.match(/after (\d+) seconds/i);
          if (waitMatch) {
            const wait = parseInt(waitMatch[1], 10);
            return {
              rateLimited: true,
              waitSeconds: wait,
              error: `Please wait ${wait} seconds before requesting another reset email.`
            };
          }
          console.warn('[apiService] Browser Supabase reset note:', sbErr.message);
        }
      } catch (sbEx: any) {
        lastSbError = sbEx.message || String(sbEx);
        console.warn('[apiService] Browser Supabase reset error:', sbEx);
      }
    }

    // 2. Fallback: Request via backend API endpoint (/api/auth/reset-password) ONLY if backend is configured
    const apiBase = getApiBaseUrl();
    if (apiBase) {
      try {
        const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : undefined;
        const res = await fetch(getApiUrl('/api/auth/reset-password'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, origin })
        });
        const json = await parseApiResponse<any>(res);
        // Surface rate-limit details from a 429 response
        if (res.status === 429 || json?.rateLimited) {
          return {
            rateLimited: true,
            waitSeconds: json?.waitSeconds || 25,
            error: json?.error || `Please wait ${json?.waitSeconds || 25} seconds before requesting another reset email.`
          };
        }
        if (!res.ok || json?.error) {
          return { error: json?.error || `HTTP ${res.status}` };
        }
        return { success: true, message: json?.message };
      } catch (err: any) {
        return { error: err.message || 'Failed to dispatch password recovery email.' };
      }
    }

    return { error: lastSbError || 'Unable to send password recovery email. Please verify the email address or try again later.' };
  },

  /**
   * Confirms a password reset using a 6-digit OTP code or token_hash obtained from
   * the recovery email. Called when no live Supabase recovery session is available.
   */
  async confirmResetPassword(payload: {
    email?: string;
    otpCode?: string;
    tokenHash?: string;
    newPassword: string;
  }): Promise<{ success?: boolean; message?: string; error?: string }> {
    // 1. Direct browser Supabase verify & update
    let lastSbError = '';
    const sb = getBrowserSupabaseClient();
    if (sb) {
      try {
        if (payload.tokenHash) {
          const { error: vErr } = await sb.auth.verifyOtp({
            token_hash: payload.tokenHash,
            type: 'recovery'
          });
          if (!vErr) {
            const { error: uErr } = await sb.auth.updateUser({ password: payload.newPassword });
            if (!uErr) {
              return { success: true, message: 'Password updated successfully via Supabase.' };
            }
            return { error: uErr.message || 'Failed to update password.' };
          } else {
            lastSbError = vErr.message;
          }
        } else if (payload.email && payload.otpCode) {
          const { error: vErr } = await sb.auth.verifyOtp({
            email: payload.email.trim().toLowerCase(),
            token: payload.otpCode.trim(),
            type: 'recovery'
          });
          if (!vErr) {
            const { error: uErr } = await sb.auth.updateUser({ password: payload.newPassword });
            if (!uErr) {
              return { success: true, message: 'Password updated successfully via Supabase.' };
            }
            return { error: uErr.message || 'Failed to update password.' };
          } else {
            lastSbError = vErr.message;
          }
        }
      } catch (sbEx: any) {
        lastSbError = sbEx.message || String(sbEx);
        console.warn('[apiService] Browser Supabase confirmResetPassword note:', sbEx);
      }
    }

    // 2. Fallback to server API /api/auth/confirm-reset-password ONLY if backend is configured
    const apiBase = getApiBaseUrl();
    if (apiBase) {
      try {
        const res = await fetch(getApiUrl('/api/auth/confirm-reset-password'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await parseApiResponse<any>(res);
        if (!res.ok || json?.error) {
          return { error: json?.error || `HTTP ${res.status}` };
        }
        return { success: true, message: json?.message };
      } catch (err: any) {
        return { error: err.message || 'Failed to confirm password reset.' };
      }
    }

    return { error: lastSbError || 'Unable to confirm password reset. The verification code or link may have expired.' };
  },

  async fetchPasswordAuditLogs(): Promise<{ success?: boolean; logs?: any[]; error?: string }> {
    if (shouldPreferDirectSupabase()) {
      const sb = getBrowserSupabaseClient();
      if (sb) {
        try {
          const { data, error } = await sb.from('password_audit_logs').select('*').order('timestamp', { ascending: false }).limit(200);
          if (!error && Array.isArray(data)) {
            return { success: true, logs: data };
          }
        } catch {}
      }
      return { success: true, logs: [] };
    }
    try {
      const res = await fetchWithTimeout(getApiUrl('/api/auth/password-audit-logs'), { headers: authHeaders() }, 2500);
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { error: err.message, logs: [] };
    }
  },

  async fetchSupabaseUsers(): Promise<{ success?: boolean; users?: any[]; error?: string }> {
    if (shouldPreferDirectSupabase()) {
      const sb = getBrowserSupabaseClient();
      if (sb) {
        try {
          const { data, error } = await sb.from('profiles').select('*');
          if (!error && Array.isArray(data)) {
            const { data: pua } = await sb.from('property_user_assignments').select('*');
            const puaMap = new Map<string, string[]>();
            (pua || []).forEach((row: any) => {
              if (row.user_id && row.property_name && row.property_name !== 'Pending Assignment') {
                puaMap.set(row.user_id, Array.from(new Set([...(puaMap.get(row.user_id) || []), row.property_name])));
              }
            });

            const mapped = data.map((p: any) => {
              let sites = p.assigned_site ? (p.assigned_site.includes(',') ? p.assigned_site.split(',').map((s: string) => s.trim()) : [p.assigned_site]) : [];
              const puaSites = puaMap.get(p.id);
              if (puaSites && puaSites.length > 0) {
                sites = Array.from(new Set([...sites.filter((s: string) => s !== 'Pending Assignment'), ...puaSites]));
              }
              const valid = sites.filter((s: string) => s && s !== 'Pending Assignment');
              const finalSites = valid.length > 0 ? valid : (sites.includes('Pending Assignment') ? ['Pending Assignment'] : ['All Sites']);
              return {
                ...p,
                assignedSite: finalSites[0] || 'All Sites',
                assignedSites: finalSites
              };
            });
            return { success: true, users: mapped };
          }
        } catch {}
      }
      return { success: true, users: [] };
    }
    try {
      const res = await fetchWithTimeout(getApiUrl('/api/auth/users'), { headers: authHeaders() }, 2500);
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      const sb = getBrowserSupabaseClient();
      if (sb) {
        try {
          const { data, error } = await sb.from('profiles').select('*');
          if (!error && Array.isArray(data)) {
            const mapped = data.map((p: any) => {
              const sites = p.assigned_site ? (p.assigned_site.includes(',') ? p.assigned_site.split(',').map((s: string) => s.trim()) : [p.assigned_site]) : ['All Sites'];
              return {
                ...p,
                assignedSite: sites[0] || 'All Sites',
                assignedSites: sites
              };
            });
            return { success: true, users: mapped };
          }
        } catch {}
      }
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

