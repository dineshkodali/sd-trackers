/**
 * BUG-003 regression — CORS policy.
 *
 * The API previously reflected whatever `Origin` the caller sent and paired it
 * with `Access-Control-Allow-Credentials: true`. Combined with the then-open
 * data API, any website a signed-in member of staff visited could read and write
 * the safeguarding database.
 *
 * This was fixed and confirmed by hand; these tests exist so it stays fixed.
 * They assert headers directly, so no browser is required.
 */
import { test, expect } from '../helpers/fixtures';
import { anonCtx } from '../helpers/api';
import { BASE_URL } from '../helpers/env';
import type { APIRequestContext } from '@playwright/test';

let anon: APIRequestContext;

test.beforeAll(async () => { anon = await anonCtx(); });
test.afterAll(async () => { await anon.dispose(); });

const HOSTILE = [
  'https://evil.example.com',
  'http://attacker.test',
  'https://safehaven.evil.co',      // lookalike
  'null',                           // sandboxed iframe / file:// origin
];

test.describe('BUG-003 CORS policy', () => {
  for (const origin of HOSTILE) {
    test(`SEC.1 rejects cross-origin credentials for ${origin}`, async () => {
      const res = await anon.get('/api/health', { headers: { Origin: origin } });
      const allowed = res.headers()['access-control-allow-origin'];
      expect(allowed, `${origin} must not be reflected back`).not.toBe(origin);
      // With no allow-origin header the browser blocks the response outright.
      expect(allowed === undefined || allowed === '').toBe(true);
    });
  }

  test('SEC.2 permits the application’s own origin', async () => {
    const res = await anon.get('/api/health', { headers: { Origin: BASE_URL } });
    expect(res.headers()['access-control-allow-origin']).toBe(BASE_URL);
    expect(res.headers()['access-control-allow-credentials']).toBe('true');
  });

  test('SEC.3 varies on Origin so responses are not cached across origins', async () => {
    const res = await anon.get('/api/health', { headers: { Origin: BASE_URL } });
    expect((res.headers()['vary'] || '').toLowerCase()).toContain('origin');
  });

  test('SEC.4 a hostile pre-flight receives no allow headers', async () => {
    const res = await anon.fetch('/api/db/referrals', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'DELETE' },
    });
    const allowed = res.headers()['access-control-allow-origin'];
    expect(allowed === undefined || allowed === '').toBe(true);
  });

  test('SEC.5 does not advertise a method it does not implement', async () => {
    // PATCH was advertised in Allow-Methods while no PATCH route existed.
    const res = await anon.get('/api/health', { headers: { Origin: BASE_URL } });
    const methods = res.headers()['access-control-allow-methods'] || '';
    expect(methods).not.toContain('PATCH');
  });
});

test.describe('BUG-001 SMTP routes require a session', () => {
  test('SEC.6 alert dispatch is refused anonymously', async () => {
    const res = await anon.post('/api/smtp/alert', { data: { title: 'unauthorised probe' } });
    expect([401, 403]).toContain(res.status());
  });

  test('SEC.7 escalation dispatch is refused anonymously', async () => {
    const res = await anon.post('/api/smtp/escalation-alert', { data: { suName: 'probe', site: 'Brit Hotel' } });
    expect([401, 403]).toContain(res.status());
  });

  test('SEC.8 an authenticated session may still read SMTP status', async ({ api }) => {
    // The counterpart: locking these down must not break legitimate use.
    const res = await api.get('/api/smtp/status');
    expect(res.status()).toBe(200);
  });
});

test.describe('No secret material is exposed', () => {
  test('SEC.9 config status reports flags, never key values', async ({ api }) => {
    const body = await (await api.get('/api/config/status')).json();
    const serialised = JSON.stringify(body);
    expect(typeof body.services.supabase.hasServiceRoleKey).toBe('boolean');
    expect(serialised, 'no service-role key material').not.toMatch(/sb_secret_[A-Za-z0-9]/);
    expect(serialised, 'no signing secret').not.toMatch(/AUTH_TOKEN_SECRET/);
    expect(serialised, 'no database password').not.toMatch(/postgres:\/\/[^"]*:[^"@]+@/);
  });

  test('SEC.10 health does not leak environment internals', async ({ api }) => {
    const serialised = JSON.stringify(await (await api.get('/api/health')).json());
    expect(serialised).not.toMatch(/sb_secret|sb_publishable|AUTH_TOKEN_SECRET|password/i);
  });
});
