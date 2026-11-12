import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRecoveryParams, classifyAuthError, recoveryMessage, resolveRecovery, resetRecoveryCacheForTests,
  type RecoveryClient, type RecoveryEnv
} from '../src/auth/recoveryFlow.ts';
import { checkNewPassword } from '../src/auth/passwordPolicy.ts';

const session = (email = 'a@b.co', token = 'tok') => ({ access_token: token, user: { email } });

function env(search = '', hash = '', pathname = '/reset-password'): RecoveryEnv & { cleaned: string[] } {
  const cleaned: string[] = [];
  return { search, hash, pathname, clean: p => cleaned.push(p), sleep: async () => {}, cleaned };
}

function client(opts: { verify?: () => any; sessions?: any[] } = {}) {
  const calls = { verify: 0, getSession: 0 };
  const queue = [...(opts.sessions || [null])];
  const c: RecoveryClient = {
    auth: {
      async verifyOtp() { calls.verify++; return opts.verify ? opts.verify() : { data: { session: session() }, error: null }; },
      async getSession() { calls.getSession++; const s = queue.length > 1 ? queue.shift() : queue[0]; return { data: { session: s ?? null } }; }
    }
  };
  return { c, calls };
}

test('parameters are read from the query string and the hash', () => {
  const p = parseRecoveryParams('?token_hash=abc&type=recovery&email=a%40b.co&setup=1', '');
  assert.equal(p.tokenHash, 'abc'); assert.equal(p.email, 'a@b.co'); assert.equal(p.setup, true);
  const h = parseRecoveryParams('', '#access_token=AT&refresh_token=RT&type=recovery');
  assert.equal(h.accessToken, 'AT'); assert.equal(h.refreshToken, 'RT'); assert.equal(h.setup, false);
  const e = parseRecoveryParams('', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  assert.equal(e.errorCode, 'otp_expired'); assert.equal(e.errorDescription, 'Email link is invalid or has expired');
});

test('errors are classified, and a network failure is never called "expired"', () => {
  assert.equal(classifyAuthError('Email link is invalid or has expired'), 'expired_or_used');
  assert.equal(classifyAuthError('Token has expired or is invalid'), 'expired_or_used');
  assert.equal(classifyAuthError('anything', 'otp_expired'), 'expired_or_used');
  assert.equal(classifyAuthError('Failed to fetch'), 'network');
  assert.equal(classifyAuthError('For security purposes, you can only request this after 25 seconds'), 'rate_limit');
  assert.equal(classifyAuthError('New password should be different from the old password.'), 'same_password');
  assert.equal(classifyAuthError('Password should be at least 12 characters'), 'weak_password');
  assert.equal(classifyAuthError('Auth session missing!'), 'session_missing');
  assert.match(recoveryMessage('network'), /not been used up/);
});

test('a link with no recovery parameters does nothing', async () => {
  resetRecoveryCacheForTests();
  const { c, calls } = client();
  const e = env('', '', '/');
  assert.deepEqual(await resolveRecovery(c, e), { status: 'none' });
  assert.equal(calls.verify, 0);
  assert.equal(e.cleaned.length, 0);
});

test('the one-time token is exchanged once, however many components ask', async () => {
  resetRecoveryCacheForTests();
  const { c, calls } = client();
  const e = env('?token_hash=abc&type=recovery');
  const [a, b, d] = await Promise.all([resolveRecovery(c, e), resolveRecovery(c, e), resolveRecovery(c, e)]);
  assert.equal(calls.verify, 1);
  assert.deepEqual(a, b); assert.deepEqual(b, d);
  assert.equal(a.status, 'ready');
  if (a.status === 'ready') { assert.equal(a.hasSession, true); assert.equal(a.email, 'a@b.co'); }
  // later calls (even from a component mounted after the address bar was cleaned) get the same answer
  assert.deepEqual(await resolveRecovery(c, env('', '', '/reset-password')), a);
  assert.equal(calls.verify, 1);
});

test('the token is removed from the address bar as soon as it is read', async () => {
  resetRecoveryCacheForTests();
  const e = env('?token_hash=abc&type=recovery');
  await resolveRecovery(client().c, e);
  assert.deepEqual(e.cleaned, ['/reset-password']);
  resetRecoveryCacheForTests();
  const e2 = env('?token_hash=abc', '', '/auth/callback');
  await resolveRecovery(client().c, e2);
  assert.deepEqual(e2.cleaned, ['/reset-password']);
});

test('a rejected token gives a clear, specific error', async () => {
  resetRecoveryCacheForTests();
  const { c } = client({ verify: () => ({ data: null, error: { message: 'Email link is invalid or has expired', code: 'otp_expired' } }) });
  const r = await resolveRecovery(c, env('?token_hash=old&email=a%40b.co'));
  assert.equal(r.status, 'error');
  if (r.status === 'error') { assert.equal(r.kind, 'expired_or_used'); assert.equal(r.email, 'a@b.co'); assert.match(r.message, /expired or has already been used/); }
});

test('an offline exchange is reported as a network problem', async () => {
  resetRecoveryCacheForTests();
  const c: RecoveryClient = { auth: { verifyOtp: async () => { throw new Error('Failed to fetch'); }, getSession: async () => ({ data: { session: null } }) } };
  const r = await resolveRecovery(c, env('?token_hash=abc'));
  assert.equal(r.status === 'error' && r.kind, 'network');
});

test('an error returned in the link is shown without touching the network', async () => {
  resetRecoveryCacheForTests();
  const { c, calls } = client();
  const r = await resolveRecovery(c, env('', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'));
  assert.equal(r.status === 'error' && r.kind, 'expired_or_used');
  assert.equal(calls.verify, 0);
});

test('hash and code links wait for the library to finish the session', async () => {
  resetRecoveryCacheForTests();
  const { c, calls } = client({ sessions: [null, null, session('late@b.co', 'T2')] });
  const r = await resolveRecovery(c, env('', '#access_token=AT&type=recovery'));
  assert.equal(r.status, 'ready');
  if (r.status === 'ready') { assert.equal(r.email, 'late@b.co'); assert.equal(r.hasSession, true); }
  assert.ok(calls.getSession >= 3);
  assert.equal(calls.verify, 0); // never a second exchange of the same token
});

test('with no browser session, a recovery access token is passed on for the server to use', async () => {
  resetRecoveryCacheForTests();
  const { c } = client({ sessions: [null] });
  const r = await resolveRecovery(c, env('?email=x%40y.co', '#access_token=AT&type=recovery'));
  assert.deepEqual(r, { status: 'ready', email: 'x@y.co', hasSession: false, accessToken: 'AT', setup: false });
});

test('a code link with no session is reported as no longer valid', async () => {
  resetRecoveryCacheForTests();
  const r = await resolveRecovery(client({ sessions: [null] }).c, env('?code=pkce'));
  assert.equal(r.status === 'error' && r.kind, 'expired_or_used');
});

test('a sign-in callback code on another page is not treated as a password recovery', async () => {
  resetRecoveryCacheForTests();
  const e = env('?code=oauth', '', '/');
  const r = await resolveRecovery(client({ sessions: [session()] }).c, e);
  assert.deepEqual(r, { status: 'none' });
  assert.equal(e.cleaned.length, 0);
});

test('setup invitations are recognised', async () => {
  resetRecoveryCacheForTests();
  const r = await resolveRecovery(client().c, env('?token_hash=abc&type=recovery&setup=1'));
  assert.equal(r.status === 'ready' && r.setup, true);
});

test('new passwords: length first, then match', () => {
  assert.equal(checkNewPassword('short', 'short').lengthOk, false);
  assert.match(checkNewPassword('short', 'short').error!, /at least 12/);
  assert.equal(checkNewPassword('a-long-enough-pass', 'different-one-here').matches, false);
  assert.match(checkNewPassword('a-long-enough-pass', 'different-one-here').error!, /do not match/);
  assert.equal(checkNewPassword('a-long-enough-pass', 'a-long-enough-pass').ok, true);
  assert.equal(checkNewPassword('', '').ok, false);
});
