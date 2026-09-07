/**
 * SD Commercial Supabase Session & Authentication Diagnostic Utility
 * Captures Supabase session status, JWT token expiration, and database profile retrieval.
 */

export type DiagnosticCategory = 'session' | 'token' | 'profile' | 'permission' | 'audit' | 'network';
export type DiagnosticLevel = 'info' | 'warn' | 'error' | 'success';

export interface DiagnosticEvent {
  id: string;
  timestamp: string;
  category: DiagnosticCategory;
  level: DiagnosticLevel;
  title: string;
  details: string;
  metadata?: Record<string, any>;
}

export interface ParsedTokenInfo {
  hasToken: boolean;
  rawToken?: string;
  isJwt: boolean;
  userId?: string;
  email?: string;
  role?: string;
  issuedAt?: number;
  expiresAt?: number;
  issuedAtFormatted?: string;
  expiresAtFormatted?: string;
  remainingSeconds: number;
  isExpired: boolean;
  statusDescription: string;
}

export interface SessionDiagnosticSummary {
  sessionStatus: 'unauthenticated' | 'checking' | 'active' | 'expired' | 'invalidated' | 'blocked';
  hasSessionToken: boolean;
  tokenInfo: ParsedTokenInfo;
  profileStatus: {
    retrieved: boolean;
    loading: boolean;
    source?: 'supabase_db' | 'auth_endpoint' | 'cache' | 'fallback';
    profileId?: string;
    email?: string;
    role?: string;
    status?: string;
    assignedSite?: string;
    latencyMs?: number;
    error?: string | null;
  };
  lastCheckTimestamp: string;
}

const MAX_EVENT_HISTORY = 150;
const subscribers = new Set<(events: DiagnosticEvent[]) => void>();
let eventLog: DiagnosticEvent[] = [];

// Helper to safely parse JWT payload
export function parseJwtPayload(token: string | null | undefined): ParsedTokenInfo {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return {
      hasToken: false,
      isJwt: false,
      remainingSeconds: 0,
      isExpired: true,
      statusDescription: 'No session token present'
    };
  }

  // Handle mock or custom tokens
  if (token === 'demo-local-jwt-token' || token.startsWith('demo-') || !token.includes('.')) {
    return {
      hasToken: true,
      rawToken: token.substring(0, 15) + '...',
      isJwt: false,
      remainingSeconds: 86400,
      isExpired: false,
      statusDescription: 'Valid development / local mock session token'
    };
  }

  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return {
        hasToken: true,
        isJwt: false,
        remainingSeconds: 3600,
        isExpired: false,
        statusDescription: 'Opaque session token'
      };
    }

    // Base64URL decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const exp = typeof decoded.exp === 'number' ? decoded.exp : undefined;
    const iat = typeof decoded.iat === 'number' ? decoded.iat : undefined;
    const remainingSeconds = exp ? exp - nowSeconds : 86400;
    const isExpired = remainingSeconds <= 0;

    let statusDescription = 'Token is valid and active';
    if (isExpired) {
      const minutesAgo = Math.abs(Math.round(remainingSeconds / 60));
      statusDescription = `Token expired ${minutesAgo} minute(s) ago`;
    } else if (remainingSeconds < 300) {
      statusDescription = `Token will expire soon (${Math.round(remainingSeconds)}s remaining)`;
    } else {
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      statusDescription = `Valid (expires in ${hours > 0 ? `${hours}h ` : ''}${minutes}m)`;
    }

    return {
      hasToken: true,
      rawToken: token.substring(0, 16) + '...' + token.substring(token.length - 8),
      isJwt: true,
      userId: decoded.sub || decoded.user_id || decoded.id,
      email: decoded.email,
      role: decoded.role || decoded.user_metadata?.role,
      issuedAt: iat,
      expiresAt: exp,
      issuedAtFormatted: iat ? new Date(iat * 1000).toLocaleString() : undefined,
      expiresAtFormatted: exp ? new Date(exp * 1000).toLocaleString() : undefined,
      remainingSeconds,
      isExpired,
      statusDescription
    };
  } catch (err: any) {
    return {
      hasToken: true,
      isJwt: false,
      remainingSeconds: 0,
      isExpired: false,
      statusDescription: `Token decode error: ${err.message || 'Malformed token'}`
    };
  }
}

export const diagnosticLogger = {
  /**
   * Record a diagnostic event
   */
  log(event: Omit<DiagnosticEvent, 'id' | 'timestamp'>): DiagnosticEvent {
    const fullEvent: DiagnosticEvent = {
      ...event,
      id: `diag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };

    eventLog = [fullEvent, ...eventLog.slice(0, MAX_EVENT_HISTORY - 1)];

    // Mirror to browser console with styled badge
    const color = 
      fullEvent.level === 'error' ? '#e11d48' :
      fullEvent.level === 'warn' ? '#d97706' :
      fullEvent.level === 'success' ? '#059669' : '#0284c7';

    console.log(
      `%c[SD Diag: ${fullEvent.category.toUpperCase()}]%c ${fullEvent.title} - ${fullEvent.details}`,
      `background: ${color}; color: white; padding: 2px 5px; border-radius: 2px; font-weight: bold; font-size: 10px;`,
      'color: inherit; font-size: 11px;',
      fullEvent.metadata || ''
    );

    // Notify listeners
    subscribers.forEach(cb => {
      try {
        cb([...eventLog]);
      } catch (err) {
        console.warn('Diagnostic subscriber error:', err);
      }
    });

    return fullEvent;
  },

  /**
   * Specialized logger: Supabase session status
   */
  logSessionStatus(
    status: 'unauthenticated' | 'checking' | 'active' | 'expired' | 'invalidated' | 'blocked',
    details: string,
    metadata?: Record<string, any>
  ) {
    const level: DiagnosticLevel = 
      status === 'active' ? 'success' :
      status === 'checking' ? 'info' :
      status === 'expired' || status === 'invalidated' || status === 'blocked' ? 'warn' : 'info';

    return this.log({
      category: 'session',
      level,
      title: `Session: ${status.toUpperCase()}`,
      details,
      metadata: { status, ...metadata }
    });
  },

  /**
   * Specialized logger: Token inspection and expiration
   */
  logTokenExpiration(token: string | null | undefined, context = 'Session Verification') {
    const parsed = parseJwtPayload(token);
    const level: DiagnosticLevel = 
      !parsed.hasToken ? 'info' :
      parsed.isExpired ? 'error' :
      parsed.remainingSeconds < 300 ? 'warn' : 'success';

    return this.log({
      category: 'token',
      level,
      title: `Token Check (${context})`,
      details: parsed.hasToken 
        ? `${parsed.statusDescription}. Expiry: ${parsed.expiresAtFormatted || 'N/A'}`
        : 'No session authorization token provided.',
      metadata: parsed
    });
  },

  /**
   * Specialized logger: Database profile retrieval
   */
  logProfileRetrieval(params: {
    success: boolean;
    profile?: any;
    source?: string;
    durationMs?: number;
    error?: string | null;
  }) {
    const { success, profile, source = 'API', durationMs, error } = params;

    return this.log({
      category: 'profile',
      level: success ? 'success' : 'error',
      title: success ? `Profile Retrieved via ${source}` : `Profile Retrieval Failed via ${source}`,
      details: success 
        ? `Loaded profile for "${profile?.name || profile?.email}" with role: ${profile?.role || 'Unspecified'}, Site: ${profile?.assignedSite || profile?.assigned_site || 'All'} (${durationMs ? `${durationMs}ms` : 'fast'})`
        : `Failed to load user profile: ${error || 'Unknown error'}`,
      metadata: { profile, durationMs, error, source }
    });
  },

  /**
   * Specialized logger: Permission & Access control checks
   */
  logPermissionCheck(params: {
    role: string;
    status?: string;
    passed: boolean;
    reason?: string;
  }) {
    return this.log({
      category: 'permission',
      level: params.passed ? 'info' : 'error',
      title: params.passed ? `RBAC Verified: ${params.role}` : `RBAC Blocked: ${params.role}`,
      details: params.passed 
        ? `Account status is "${params.status || 'Active'}" with valid role permissions.`
        : `Access blocked: ${params.reason || 'Insufficient permissions or account inactive.'}`,
      metadata: params
    });
  },

  /**
   * Specialized logger: Centralized Audit Trail dispatch
   */
  logAuditDispatch(params: {
    action: string;
    entity: string;
    entityId?: string;
    userId?: string;
    success: boolean;
    error?: string;
  }) {
    return this.log({
      category: 'audit',
      level: params.success ? 'info' : 'warn',
      title: `Audit Trail: ${params.action} on ${params.entity}`,
      details: params.success
        ? `Recorded audit trail for user UID ${params.userId || 'system'} on entity [${params.entityId || params.entity}]`
        : `Audit trail recording encountered notice: ${params.error || 'Check schema'}`,
      metadata: params
    });
  },

  /**
   * Get all logged events
   */
  getRecentEvents(limit = 100): DiagnosticEvent[] {
    return eventLog.slice(0, limit);
  },

  /**
   * Subscribe to new diagnostic events
   */
  subscribe(listener: (events: DiagnosticEvent[]) => void): () => void {
    subscribers.add(listener);
    listener([...eventLog]);
    return () => {
      subscribers.delete(listener);
    };
  },

  /**
   * Clear all logged events
   */
  clearLogs() {
    eventLog = [];
    subscribers.forEach(cb => cb([]));
  }
};
