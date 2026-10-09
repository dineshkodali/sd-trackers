import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Baseline HTTP security headers (helmet-equivalent, no extra dependency).
 *
 * The Content-Security-Policy is only sent in production: the Vite dev server
 * injects inline scripts and a websocket client that a strict policy blocks.
 * It is the main mitigation for session tokens kept in localStorage — script
 * can only load from this origin, so injected markup cannot run.
 */
function originOf(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy(allowInlineScripts = false): string {
  const connect = new Set<string>(["'self'", 'https://*.supabase.co', 'wss://*.supabase.co']);
  for (const value of [process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL, process.env.VITE_API_URL, process.env.APP_URL, process.env.PUBLIC_URL]) {
    const origin = originOf(value);
    if (origin) connect.add(origin);
  }
  for (const extra of (process.env.CSP_CONNECT_SRC || '').split(',').map(s => s.trim()).filter(Boolean)) {
    connect.add(extra);
  }

  return [
    "default-src 'self'",
    allowInlineScripts ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src ${Array.from(connect).join(' ')}`,
    "frame-src 'self' blob: data: https://*.sharepoint.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}

export function securityHeaders() {
  const isProduction = process.env.NODE_ENV === 'production';
  const csp = isProduction ? buildContentSecurityPolicy() : null;
  // Static report pages we ship ourselves (no user content) use inline scripts.
  const staticPageCsp = isProduction ? buildContentSecurityPolicy(true) : null;
  const isStaticReportPage = (p: string) => p.startsWith('/docs/') || p === '/docs' || p === '/uat-results.html';

  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.removeHeader('X-Powered-By');
    if (req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    const policy = isStaticReportPage(req.path) ? staticPageCsp : csp;
    if (policy) res.setHeader('Content-Security-Policy', policy);
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    next();
  };
}

/**
 * In production, HTTP 500 JSON responses no longer carry database or library error
 * text (table/column names, constraint details, hints). The original is logged
 * server-side with a reference the user can quote to support.
 */
export function sanitizeServerErrors() {
  const isProduction = process.env.NODE_ENV === 'production';
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isProduction) return next();
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode === 500 && body && typeof body === 'object' && !Array.isArray(body)) {
        const reference = crypto.randomBytes(4).toString('hex');
        console.error(`[API ${res.statusCode}] ref=${reference} ${req.method} ${req.originalUrl}:`, body.error || body.message, body.details || '', body.hint || '');
        const { details: _details, hint: _hint, ...rest } = body;
        const safe: Record<string, any> = { ...rest, reference };
        if ('error' in body && !body.tableMissing) safe.error = `The server could not complete this request (reference ${reference}).`;
        if ('message' in body && typeof body.message === 'string' && body.success === false) safe.message = safe.error || `Request failed (reference ${reference}).`;
        return originalJson(safe);
      }
      return originalJson(body);
    };
    next();
  };
}
