/**
 * TS-02 — Server-side authorization.
 *
 * These are the highest-value tests in the suite. They previously all carried
 * `test.fail()` because the API accepted anonymous traffic (BUG-001) and granted
 * Super Admin to any `sm-jwt-` prefixed string (BUG-002).
 *
 * Both are now fixed, so the annotations are gone and these are hard assertions.
 * Note they deliberately use an UNAUTHENTICATED client: the shared `api` fixture
 * now carries a real session, which would defeat the point.
 */
import { test, expect } from '../helpers/fixtures';
import { anonCtx, referralPayload, deleteRecord } from '../helpers/api';
import type { APIRequestContext } from '@playwright/test';

/** Entities holding personal or safeguarding data. */
const PROTECTED = ['referrals', 'vulnerable', 'challenging', 'spcd', 'escalations', 'documents', 'profiles', 'passwordAudit'];

let anon: APIRequestContext;

test.beforeAll(async () => { anon = await anonCtx(); });
test.afterAll(async () => { await anon.dispose(); });

test.describe('TS-02 API authorization', () => {
  for (const entity of PROTECTED) {
    test(`02.a BUG-001 reading ${entity} without credentials is refused`, async () => {
      const res = await anon.get(`/api/db/${entity}`);
      expect([401, 403], `unauthenticated read of ${entity} returned ${res.status()}`).toContain(res.status());
    });
  }

  test('02.b BUG-001 writing without credentials is refused', async ({ api, tag }) => {
    const payload = referralPayload({ suName: tag });
    const res = await anon.post('/api/db/referrals', { data: payload });
    expect([401, 403]).toContain(res.status());
    // Nothing should have been written; clean up defensively via the authed client.
    await deleteRecord(api, 'referrals', payload.id);
  });

  test('02.c BUG-001 deleting without credentials is refused', async ({ api, tag }) => {
    const payload = referralPayload({ suName: tag });
    await api.post('/api/db/referrals', { data: payload });   // seeded with a valid session
    const res = await anon.delete(`/api/db/referrals/${payload.id}`);
    expect([401, 403]).toContain(res.status());

    // Prove the record actually survived the unauthorised delete attempt.
    const rows = await (await api.get('/api/db/referrals')).json();
    expect(rows.data.some((r: any) => r.id === payload.id), 'record must survive an unauthorised delete').toBe(true);

    await deleteRecord(api, 'referrals', payload.id);
  });

  test('02.d BUG-008 running a migration without credentials is refused', async () => {
    const res = await anon.post('/api/db/ensure');
    expect([401, 403]).toContain(res.status());
  });

  test('02.e BUG-002 a forged session token is not accepted', async () => {
    const res = await anon.get('/api/auth/me', {
      headers: { Authorization: 'Bearer sm-jwt-completely-made-up-by-an-attacker' },
    });
    expect(res.status(), 'a forged token must not authenticate').toBe(401);
  });

  test('02.f BUG-002 a forged token does not yield Super Admin', async () => {
    const res = await anon.get('/api/auth/me', { headers: { Authorization: 'Bearer sm-jwt-x' } });
    const body = await res.json().catch(() => ({}));
    expect(body?.user?.role, 'forged token must not grant Super Admin').not.toBe('Super Admin');
  });

  test('02.g a garbage token that lacks the magic prefix is rejected', async () => {
    const res = await anon.get('/api/auth/me', { headers: { Authorization: 'Bearer not-a-real-token' } });
    expect(res.status()).toBe(401);
  });

  test('02.h a request with no authorization header is rejected', async () => {
    expect((await anon.get('/api/auth/me')).status()).toBe(401);
  });

  test('02.i BUG-006 anonymous account creation is refused', async () => {
    const res = await anon.post('/api/auth/signup', {
      data: { email: `qa-should-not-exist-${Date.now()}@example.com`, password: 'Whatever123!', role: 'Super Admin' },
    });
    expect([401, 403], 'anonymous signup must not be permitted').toContain(res.status());
  });

  test('02.j BUG-007 anonymous password reset for another user is refused', async () => {
    const res = await anon.post('/api/auth/admin/update-password', {
      data: { email: 'stackmaster@sdcommercial.co.uk', newPassword: 'attacker-chosen-password' },
    });
    expect([401, 403], 'anonymous password change must not be permitted').toContain(res.status());
  });

  test('02.k BUG-022 the staff directory is not readable anonymously', async () => {
    const res = await anon.get('/api/auth/users');
    expect([401, 403]).toContain(res.status());
  });

  test('02.l BUG-022 password history is not readable anonymously', async () => {
    const res = await anon.get('/api/auth/password-audit-logs');
    expect([401, 403]).toContain(res.status());
  });

  test('02.m an authenticated session can still read its data', async ({ api }) => {
    // The counterpart to every test above: locking the API down must not break
    // legitimate access.
    const res = await api.get('/api/db/sites');
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).data)).toBe(true);
  });
});
