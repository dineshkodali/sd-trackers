import { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin, getSupabaseAnon, isSupabaseConfigured } from '../supabase.js';
import { verifyAdminToken, isAdminTokenFormat } from '../tokenSigner.js';

/**
 * Server-side authentication for the data API.
 *
 * Every `/api/db/*` route previously accepted anonymous requests and executed
 * them with the Supabase service-role key, which bypasses Row Level Security —
 * so the entire safeguarding database was readable and writable by anyone who
 * could reach the port (BUG-001). Site isolation and role checks existed only in
 * the browser and were trivially bypassed by calling the API directly.
 *
 * Two token types are accepted:
 *   - a Supabase access token, verified by Supabase;
 *   - the signed built-in administrator token (see tokenSigner.ts).
 *
 * The resolved identity is attached to `req.user` so downstream handlers can
 * authorize and attribute actions from a verified source rather than from
 * client-supplied `x-user-*` headers, which any caller can set.
 */

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  assignedSite: string;
  provider: 'supabase' | 'built-in';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function bearerFrom(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/** Resolve a caller from a bearer token, or null. Never logs token material. */
export async function resolveUser(token: string): Promise<AuthenticatedUser | null> {
  if (isAdminTokenFormat(token)) {
    const payload = verifyAdminToken(token);
    if (!payload) return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: 'Stack Master',
      role: payload.role,
      assignedSite: 'All Sites',
      provider: 'built-in',
    };
  }

  if (!isSupabaseConfigured()) return null;

  const client = getSupabaseAdmin() || getSupabaseAnon();
  if (!client) return null;

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;

    const admin = getSupabaseAdmin();
    let profile: any = null;
    if (admin) {
      const { data: prof, error: profileError } = await admin.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
      // A failed lookup is not the same as "no profile": surface it as a
      // temporary outage rather than treating the session as unprovisioned.
      if (profileError) throw new ProfileLookupError(profileError.message);
      profile = prof;
    }

    // Authorization is decided by the profile row alone. user_metadata is
    // editable by the account holder, so it must never supply a role, and an
    // account with no profile was never provisioned by an administrator.
    if (!profile) return null;
    if (String(profile.status || '').toLowerCase() !== 'active') {
      return null; // suspended or inactive accounts must not transact
    }

    return {
      id: data.user.id,
      email: data.user.email || '',
      name: profile.name || data.user.user_metadata?.name || (data.user.email || '').split('@')[0],
      role: profile.role || 'Staff',
      assignedSite: profile.assigned_site || 'All Sites',
      provider: 'supabase',
    };
  } catch (err) {
    if (err instanceof ProfileLookupError) throw err;
    return null;
  }
}

/** The profile store could not be read; the session itself may be valid. */
export class ProfileLookupError extends Error {}

/** Reject the request unless it carries a valid session. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearerFrom(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let user: AuthenticatedUser | null;
  try {
    user = await resolveUser(token);
  } catch (err) {
    if (err instanceof ProfileLookupError) {
      return res.status(503).json({ error: 'User profile lookup is temporarily unavailable. Please retry.' });
    }
    throw err;
  }
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.user = user;
  next();
}

/**
 * Reject the request unless the authenticated caller holds one of `roles`.
 * Must be mounted after `requireAuth`.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      // Deliberately does not disclose which role would have been sufficient.
      return res.status(403).json({ error: 'Insufficient privileges for this operation' });
    }
    next();
  };
}
