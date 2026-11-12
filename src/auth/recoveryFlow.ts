/**
 * Password recovery - the single owner of the recovery token.
 *
 * Why this exists: a recovery link carries a one-time token (`token_hash`, a PKCE `code`, or `#access_token`).
 * Before, several components (the app context, the reset page, the login page) each tried to exchange it, so
 * the second attempt always failed with "expired or already used", and a page refresh re-tried a used token.
 *
 * Now the exchange happens exactly once per page load, here. Everyone else asks `resolveRecovery()` and receives the
 * same result. The token is removed from the address bar as soon as it has been read.
 */

export type RecoveryErrorKind =
  | 'expired_or_used'   // Supabase does not say which: the link is no longer valid
  | 'invalid'
  | 'network'
  | 'rate_limit'
  | 'weak_password'
  | 'same_password'
  | 'session_missing'
  | 'other';

export interface RecoveryParams {
  tokenHash: string | null;
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
  type: string | null;
  /** setup=1 marks an account-setup invitation (same mechanism, different wording) */
  setup: boolean;
  errorCode: string | null;
  errorDescription: string | null;
}

export type RecoveryResult =
  | { status: 'none' }
  | { status: 'ready'; email: string; hasSession: boolean; accessToken: string | null; setup: boolean }
  | { status: 'error'; kind: RecoveryErrorKind; message: string; email: string | null };

/** Reads recovery parameters from the query string and the hash fragment. Pure. */
export function parseRecoveryParams(search: string, hash: string): RecoveryParams {
  const q = new URLSearchParams(search.replace(/^\?/, ''));
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  const get = (k: string) => q.get(k) || h.get(k) || null;
  const desc = get('error_description');
  return {
    tokenHash: get('token_hash'),
    code: get('code'),
    accessToken: get('access_token'),
    refreshToken: get('refresh_token'),
    email: get('email'),
    type: get('type'),
    setup: get('setup') === '1',
    errorCode: get('error_code'),
    errorDescription: desc ? desc.replace(/\+/g, ' ') : (get('error') ? 'The link could not be used.' : null)
  };
}

export const hasRecoveryParams = (p: RecoveryParams) =>
  !!(p.tokenHash || p.code || p.accessToken || p.errorCode || p.errorDescription);

/** Turns a provider or network message into a kind we can explain to the user. Pure. */
export function classifyAuthError(message: unknown, code?: unknown): RecoveryErrorKind {
  const m = String(message ?? '').toLowerCase();
  const c = String(code ?? '').toLowerCase();
  if (c === 'otp_expired' || m.includes('expired') || m.includes('invalid or has expired') || m.includes('already been used') || m.includes('already used')) return 'expired_or_used';
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('network request') || m.includes('load failed') || m.includes('unreachable') || m.includes('timeout')) return 'network';
  if (c === 'over_email_send_rate_limit' || m.includes('rate limit') || m.includes('too many') || /after \d+ seconds/.test(m)) return 'rate_limit';
  if (m.includes('same password') || m.includes('different from the old')) return 'same_password';
  if (m.includes('weak') || m.includes('password should') || m.includes('at least')) return 'weak_password';
  if (m.includes('session missing') || m.includes('auth session')) return 'session_missing';
  if (m.includes('invalid') || m.includes('not found')) return 'invalid';
  return 'other';
}

/** Plain wording for each kind. */
export function recoveryMessage(kind: RecoveryErrorKind): string {
  switch (kind) {
    case 'expired_or_used': return 'This link has expired or has already been used. Request a new one below.';
    case 'invalid': return 'This link is not valid. Request a new one below.';
    case 'network': return 'We could not reach the sign-in service. Check your connection and try again; your link has not been used up.';
    case 'rate_limit': return 'Too many requests. Please wait a moment before trying again.';
    case 'weak_password': return 'That password is not accepted. Use at least 12 characters.';
    case 'same_password': return 'Choose a password you have not used before.';
    case 'session_missing': return 'Your reset session is no longer active. Open the link from your email again or request a new one.';
    default: return 'Something went wrong. Please try again, or request a new link.';
  }
}

/* ------------------------------------------------------------------ exchange (once per page load) */

/** The small part of the Supabase client this module needs, so it can be tested without a network. */
export interface RecoveryClient {
  auth: {
    verifyOtp(args: { token_hash: string; type: 'recovery' }): Promise<{ data: { session: { access_token: string; user?: { email?: string | null } | null } | null } | null; error: { message: string; code?: string } | null }>;
    getSession(): Promise<{ data: { session: { access_token: string; user?: { email?: string | null } | null } | null } }>;
  };
}

export interface RecoveryEnv {
  search: string;
  hash: string;
  pathname: string;
  /** Called after the token has been read, to remove it from the address bar */
  clean: (pathname: string) => void;
  sleep: (ms: number) => Promise<void>;
}

const browserEnv = (): RecoveryEnv => ({
  search: typeof window !== 'undefined' ? window.location.search : '',
  hash: typeof window !== 'undefined' ? window.location.hash : '',
  pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
  clean: pathname => { if (typeof window !== 'undefined') window.history.replaceState(null, '', pathname); },
  sleep: ms => new Promise(r => setTimeout(r, ms))
});

let cached: Promise<RecoveryResult> | null = null;

/** Test helper. */
export function resetRecoveryCacheForTests() { cached = null; }

async function waitForSession(client: RecoveryClient, env: RecoveryEnv) {
  // supabase-js (detectSessionInUrl) completes hash / PKCE sessions on its own; give it a moment.
  for (let i = 0; i < 6; i++) {
    const { data } = await client.auth.getSession();
    if (data.session) return data.session;
    await env.sleep(400);
  }
  return null;
}

async function run(client: RecoveryClient | null, env: RecoveryEnv): Promise<RecoveryResult> {
  const p = parseRecoveryParams(env.search, env.hash);
  if (!hasRecoveryParams(p)) return { status: 'none' };

  // A bare `code` on another page is a normal sign-in callback (e.g. Microsoft), not a password recovery.
  const onResetPage = env.pathname.startsWith('/reset-password') || env.pathname.startsWith('/forgot-password');
  const looksLikeRecovery = !!(p.tokenHash || (p.accessToken && (p.type === 'recovery' || !p.type)) || p.type === 'recovery' || onResetPage);
  if (!looksLikeRecovery) return { status: 'none' };

  // The token is read now and removed from the address bar, so a refresh cannot try a used token again.
  env.clean(env.pathname.startsWith('/reset-password') || env.pathname.startsWith('/forgot-password') ? env.pathname : '/reset-password');

  if (p.errorCode || p.errorDescription) {
    const kind = classifyAuthError(p.errorDescription, p.errorCode);
    return { status: 'error', kind: kind === 'other' ? 'invalid' : kind, message: recoveryMessage(kind === 'other' ? 'invalid' : kind), email: p.email };
  }
  if (!client) return { status: 'error', kind: 'other', message: recoveryMessage('other'), email: p.email };

  try {
    if (p.tokenHash) {
      const { data, error } = await client.auth.verifyOtp({ token_hash: p.tokenHash, type: 'recovery' });
      if (error || !data?.session) {
        const kind = classifyAuthError(error?.message, error?.code);
        return { status: 'error', kind, message: recoveryMessage(kind), email: p.email };
      }
      return { status: 'ready', email: data.session.user?.email || p.email || '', hasSession: true, accessToken: data.session.access_token, setup: p.setup };
    }

    if (p.code || p.accessToken) {
      const session = await waitForSession(client, env);
      if (session) {
        return { status: 'ready', email: session.user?.email || p.email || '', hasSession: true, accessToken: session.access_token, setup: p.setup };
      }
      // No browser session, but a recovery access token came in the link: the server can still use it.
      if (p.accessToken) {
        return { status: 'ready', email: p.email || '', hasSession: false, accessToken: p.accessToken, setup: p.setup };
      }
      return { status: 'error', kind: 'expired_or_used', message: recoveryMessage('expired_or_used'), email: p.email };
    }
  } catch (err: any) {
    const kind = classifyAuthError(err?.message);
    return { status: 'error', kind, message: recoveryMessage(kind), email: p.email };
  }
  return { status: 'none' };
}

/**
 * The one place a recovery link is exchanged. Safe to call from any number of components: the work runs once
 * and every caller receives the same result.
 */
export function resolveRecovery(client: RecoveryClient | null, env: RecoveryEnv = browserEnv()): Promise<RecoveryResult> {
  if (!cached) cached = run(client, env);
  return cached;
}
