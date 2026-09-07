import crypto from 'crypto';

/**
 * HMAC signing for the built-in administrator session token.
 *
 * The previous token was `'sm-jwt-' + base64url(JSON.stringify(payload))` with
 * no signature, and `/api/auth/me` trusted anything starting `sm-jwt-`. Any
 * caller could send `Bearer sm-jwt-x` and receive a full Super Admin profile
 * (BUG-002). Tokens are now signed and every field is verified before trust.
 *
 * Supabase-issued tokens are unaffected — they are verified by Supabase itself.
 * This covers only the built-in account, which exists so the platform remains
 * administrable when the identity provider is unreachable.
 *
 * The secret comes from AUTH_TOKEN_SECRET. When that is not configured a random
 * secret is generated per boot: still unforgeable, but existing sessions stop
 * validating after a restart. Set AUTH_TOKEN_SECRET in production to keep
 * sessions alive across deploys. The secret is never logged or returned.
 */

const PREFIX = 'sm-jwt-';

let cachedSecret: Buffer | null = null;

function getSecret(): Buffer {
  if (cachedSecret) return cachedSecret;

  const configured = process.env.AUTH_TOKEN_SECRET;
  if (configured && configured.trim().length >= 16) {
    cachedSecret = Buffer.from(configured.trim(), 'utf8');
  } else {
    cachedSecret = crypto.randomBytes(32);
    console.warn(
      '[Auth] AUTH_TOKEN_SECRET is not set — using a per-boot random signing key. ' +
        'Built-in administrator sessions will not survive a server restart.'
    );
  }
  return cachedSecret;
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString('base64url');

export interface AdminTokenPayload {
  sub: string;
  email: string;
  role: string;
  iss: string;
  exp: number;
}

/** Mint a signed built-in administrator token. */
export function signAdminToken(payload: AdminTokenPayload): string {
  const body = b64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${PREFIX}${body}.${signature}`;
}

/** True when the token merely looks like a built-in token — says nothing about validity. */
export function isAdminTokenFormat(token: string | undefined | null): boolean {
  return typeof token === 'string' && token.startsWith(PREFIX);
}

/**
 * Verify a built-in administrator token.
 * Returns the payload only when the signature matches and it has not expired.
 */
export function verifyAdminToken(token: string): AdminTokenPayload | null {
  if (!isAdminTokenFormat(token)) return null;

  const raw = token.slice(PREFIX.length);
  const separator = raw.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = raw.slice(0, separator);
  const providedSignature = raw.slice(separator + 1);

  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');

  // Constant-time compare; mismatched lengths would make timingSafeEqual throw.
  const a = Buffer.from(providedSignature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AdminTokenPayload;
    if (!payload || typeof payload.exp !== 'number') return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (payload.iss !== 'sdtracker-internal') return null;
    return payload;
  } catch {
    return null;
  }
}
