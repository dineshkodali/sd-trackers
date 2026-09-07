import { diagnosticLogger } from '../utils/diagnosticLogger';

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

export interface DbStatusResponse {
  connected: boolean;
  mode: 'supabase-cloud' | 'offline-local';
  message?: string;
  url?: string;
  tables?: Record<string, number | string>;
  error?: string;
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

const rawApiBase = typeof window !== 'undefined'
  ? ((window as any).__VITE_API_URL__ || (import.meta as any).env?.VITE_API_URL || '')
  : ((import.meta as any).env?.VITE_API_URL || '');
const API_BASE = (rawApiBase || '').replace(/\/+$/, '');

/**
 * Resolves an API path against the configured backend base URL (if any).
 * In local development or when reverse-proxied via Amplify/Nginx, returns the relative `/api/...`.
 * In separated deployments (Amplify frontend + VPS/Render backend), returns `https://api.domain.com/api/...`.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${cleanPath}` : cleanPath;
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
      throw new Error(
        `Backend API unreachable (HTTP ${res.status} ${res.statusText}). ` +
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
function authHeaders(): Record<string, string> {
  return activeAuditContext?.token
    ? { Authorization: `Bearer ${activeAuditContext.token}` }
    : {};
}

function getAuditHeaders(actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' = 'READ'): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (activeAuditContext) {
    if (activeAuditContext.userId) headers['x-user-id'] = activeAuditContext.userId;
    if (activeAuditContext.userEmail) headers['x-user-email'] = activeAuditContext.userEmail;
    if (activeAuditContext.userName) headers['x-user-name'] = activeAuditContext.userName;
    if (activeAuditContext.role) headers['x-user-role'] = activeAuditContext.role;
    if (activeAuditContext.site) headers['x-user-site'] = activeAuditContext.site;
    if (activeAuditContext.token) headers['Authorization'] = `Bearer ${activeAuditContext.token}`;
  }
  headers['x-action-type'] = actionType;
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

  // Record into audit_trails table directly
  async recordAuditTrail(entry: AuditTrailPayload): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();
      const payload = {
        id: entry.id || `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: entry.timestamp || now,
        user: entry.user || activeAuditContext?.userName || activeAuditContext?.userEmail || 'Staff',
        userId: entry.userId || activeAuditContext?.userId || null,
        role: entry.role || activeAuditContext?.role || 'Staff',
        action: entry.action,
        details: entry.details,
        site: entry.site || activeAuditContext?.site || 'All Sites',
        entityType: entry.entityType || 'General',
        entityId: entry.entityId || null,
        createdBy: entry.createdBy || entry.userId || activeAuditContext?.userId || null,
        createdAt: now,
        updatedAt: now
      };

      const res = await fetch(getApiUrl('/api/db/audit_trails'), {
        method: 'POST',
        headers: getAuditHeaders(entry.action as any),
        body: JSON.stringify(payload)
      });
      const json = await parseApiResponse<any>(res);
      
      diagnosticLogger.logAuditDispatch({
        action: entry.action,
        entity: entry.entityType || 'audit_trails',
        entityId: entry.entityId,
        userId: activeAuditContext?.userId,
        success: json.success !== false
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

  // Database API
  async getDbStatus(): Promise<DbStatusResponse> {
    try {
      const res = await fetch(getApiUrl('/api/db/status'), { headers: authHeaders() });
      return await parseApiResponse<DbStatusResponse>(res);
    } catch (err: any) {
      return { connected: false, mode: 'offline-local', error: err.message };
    }
  },

  async fetchEntityRecords<T = any>(entity: DbEntityName): Promise<{ success: boolean; data: T[]; fallback?: boolean; tableMissing?: boolean }> {
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}`), { headers: authHeaders() });
      const json = await parseApiResponse<any>(res);
      return json;
    } catch (err: any) {
      console.warn(`Failed to fetch ${entity} from API:`, err);
      return { success: false, data: [], fallback: true };
    }
  },

  async saveEntityRecord<T = any>(entity: DbEntityName, record: T): Promise<{ success: boolean; record?: T; error?: string }> {
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}`), {
        method: 'POST',
        headers: getAuditHeaders('CREATE'),
        body: JSON.stringify(record)
      });
      const json = await parseApiResponse<any>(res);
      if (json.success !== false) {
        diagnosticLogger.logAuditDispatch({
          action: 'CREATE',
          entity,
          entityId: (record as any)?.id,
          userId: activeAuditContext?.userId,
          success: true
        });
      }
      return json;
    } catch (err: any) {
      diagnosticLogger.logAuditDispatch({
        action: 'CREATE',
        entity,
        entityId: (record as any)?.id,
        userId: activeAuditContext?.userId,
        success: false,
        error: err.message
      });
      return { success: false, error: err.message };
    }
  },

  async updateEntityRecord<T = any>(entity: DbEntityName, id: string, record: Partial<T>): Promise<{ success: boolean; record?: T; error?: string }> {
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: getAuditHeaders('UPDATE'),
        body: JSON.stringify(record)
      });
      const json = await parseApiResponse<any>(res);
      if (json.success !== false) {
        diagnosticLogger.logAuditDispatch({
          action: 'UPDATE',
          entity,
          entityId: id,
          userId: activeAuditContext?.userId,
          success: true
        });
      }
      return json;
    } catch (err: any) {
      diagnosticLogger.logAuditDispatch({
        action: 'UPDATE',
        entity,
        entityId: id,
        userId: activeAuditContext?.userId,
        success: false,
        error: err.message
      });
      return { success: false, error: err.message };
    }
  },

  async deleteEntityRecord(entity: DbEntityName, id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(getApiUrl(`/api/db/${entity}/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: getAuditHeaders('DELETE')
      });
      const json = await parseApiResponse<any>(res);
      if (json.success !== false) {
        diagnosticLogger.logAuditDispatch({
          action: 'DELETE',
          entity,
          entityId: id,
          userId: activeAuditContext?.userId,
          success: true
        });
      }
      return json;
    } catch (err: any) {
      diagnosticLogger.logAuditDispatch({
        action: 'DELETE',
        entity,
        entityId: id,
        userId: activeAuditContext?.userId,
        success: false,
        error: err.message
      });
      return { success: false, error: err.message };
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

  async runMigration(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const res = await fetch(getApiUrl('/api/db/migrate'), {
        method: 'POST',
        headers: authHeaders()
      });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { success: false, message: `Migration request failed: ${err.message}` };
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
    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email, password })
      });
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async verifySession(token: string): Promise<{
    success?: boolean;
    user?: { id: string; email: string; name: string; role: string; assignedSite: string; status?: string };
    error?: string;
    blockedReason?: string;
  }> {
    const startTime = performance.now();
    diagnosticLogger.logTokenExpiration(token, 'Session Verification');
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
          source: 'Supabase /api/auth/me',
          durationMs
        });
        diagnosticLogger.logSessionStatus('active', `Session verified for ${json.user.email} (${json.user.role})`);
      } else {
        const errMsg = String(json?.error || `HTTP ${res.status}`);
        diagnosticLogger.logProfileRetrieval({
          success: false,
          error: errMsg,
          source: 'Supabase /api/auth/me',
          durationMs
        });
        const errLower = errMsg.toLowerCase();
        if (res.status === 401 || errLower.includes('expired') || errLower.includes('invalid')) {
          diagnosticLogger.logSessionStatus('invalidated', `Session token invalidated or expired: ${errMsg}`);
        } else {
          diagnosticLogger.logSessionStatus('blocked', `Authentication verification failed: ${errMsg}`);
        }
      }
      return json;
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      diagnosticLogger.logProfileRetrieval({
        success: false,
        error: err.message,
        source: 'Supabase /api/auth/me',
        durationMs
      });
      diagnosticLogger.logSessionStatus('invalidated', `Network error during session verification: ${err.message}`);
      return { error: err.message };
    }
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
      return await parseApiResponse<any>(res);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};

