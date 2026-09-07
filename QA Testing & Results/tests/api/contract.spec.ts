/**
 * TS-21 — API contract. Request-level, no browser.
 */
import { test, expect } from '../helpers/fixtures';
import { referralPayload, listRecords, deleteRecord, anonCtx } from '../helpers/api';

test.describe('TS-21 API contract', () => {
  test('21.1 health reports the service and the detected origin', async ({ api }) => {
    const res = await api.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toMatch(/SafeHaven/i);
    expect(body).toHaveProperty('detectedOrigin');
    expect(body).toHaveProperty('timestamp');
  });

  test('21.2 config status reports service wiring without leaking secrets', async ({ api }) => {
    const body = await (await api.get('/api/config/status')).json();
    expect(body.status).toBe('ok');
    expect(body.environment).not.toBe('production');
    expect(body.services.supabase.configured).toBe(true);
    // Keys must be reported as booleans, never echoed.
    expect(typeof body.services.supabase.hasServiceRoleKey).toBe('boolean');
    expect(JSON.stringify(body)).not.toMatch(/sb_secret|service_role_key"\s*:\s*"[A-Za-z0-9]/);
  });

  test('21.3 database status enumerates every mapped entity', async ({ api }) => {
    const body = await (await api.get('/api/db/status')).json();
    expect(body.connected).toBe(true);
    expect(body.mode).toBe('supabase-cloud');
    expect(body.connectedPages).toBe(body.totalPages);
    expect(body.missingTables).toEqual([]);
  });

  test('21.4 an unknown entity is rejected with 404', async ({ api }) => {
    const res = await api.get('/api/db/not-a-real-entity');
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toMatch(/Unknown entity/i);
  });

  test('21.5 malformed JSON is rejected with 400', async ({ api }) => {
    const res = await api.post('/api/db/referrals', {
      headers: { 'Content-Type': 'application/json' },
      data: '{ this is not valid json',
    });
    expect(res.status()).toBe(400);
  });

  test('21.6 auth status advertises the Supabase provider', async ({ api }) => {
    const body = await (await api.get('/api/auth/status')).json();
    expect(body.provider).toBe('supabase');
    expect(body.supabaseConfigured).toBe(true);
  });

  test('21.7 login rejects missing credentials with 400', async ({ api }) => {
    const res = await api.post('/api/auth/login', { data: {} });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/required/i);
  });

  test('21.8 login rejects bad credentials with 401', async ({ api }) => {
    const res = await api.post('/api/auth/login', {
      data: { email: 'nobody@example.com', password: 'WrongPassword123!' },
    });
    expect(res.status()).toBe(401);
  });

  test('21.9 /auth/me rejects a missing bearer token', async () => {
    // Must use an unauthenticated client — the shared `api` fixture now carries
    // a real session token, which would defeat the assertion.
    const anon = await anonCtx();
    try {
      expect((await anon.get('/api/auth/me')).status()).toBe(401);
    } finally {
      await anon.dispose();
    }
  });

  test('21.10 a record round-trips through create and read', async ({ api, tag }) => {
    const payload = referralPayload({ suName: tag });
    const create = await api.post('/api/db/referrals', { data: payload });
    expect(create.status()).toBe(201);

    const rows = await listRecords(api, 'referrals');
    const mine = rows.find((r) => r.suName === tag);
    expect(mine, 'created record should be readable').toBeTruthy();
    expect(mine.site).toBe(payload.site);
    expect(mine.referralCouncil).toBe(payload.referralCouncil);

    await deleteRecord(api, 'referrals', payload.id);
  });

  test('21.11 a record can be updated and deleted', async ({ api, tag }) => {
    const payload = referralPayload({ suName: tag });
    await api.post('/api/db/referrals', { data: payload });

    const upd = await api.put(`/api/db/referrals/${payload.id}`, {
      data: { ...payload, laOfficerLeading: 'QA Officer' },
    });
    expect(upd.ok()).toBe(true);

    let rows = await listRecords(api, 'referrals');
    expect(rows.find((r) => r.suName === tag)?.laOfficerLeading).toBe('QA Officer');

    const del = await api.delete(`/api/db/referrals/${payload.id}`);
    expect(del.ok()).toBe(true);

    rows = await listRecords(api, 'referrals');
    expect(rows.find((r) => r.suName === tag)).toBeFalsy();
  });

  /**
   * BUG-025 regression. PostgREST caps a single response at 1000 rows and says
   * nothing when it does. A bare select therefore returned a silently truncated
   * table; the audit trail crossed that mark during testing and 133 records
   * became unreachable. The route must now page until the table is exhausted.
   */
  test('21.14 BUG-025 reads are not silently truncated at 1000 rows', async ({ api }) => {
    const status = await (await api.get('/api/db/status')).json();

    // Pick the largest mapped table; only a table past 1000 rows proves the fix.
    const [entity, trueCount] = Object.entries(status.tables as Record<string, number | string>)
      .filter(([, v]) => typeof v === 'number')
      .sort((a, b) => (b[1] as number) - (a[1] as number))[0] as [string, number];

    const body = await (await api.get(`/api/db/${entity}`)).json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(
      body.data.length,
      `${entity}: API returned ${body.data.length} of ${trueCount} rows — truncated`
    ).toBe(trueCount);
    expect(body.truncated, 'result should not be flagged truncated below the ceiling').toBe(false);

    if (trueCount <= 1000) {
      // Not a failure, but the assertion above is weak until real volume exists.
      console.warn(`[21.14] largest table "${entity}" has only ${trueCount} rows; ` +
        'the 1000-row boundary is not being exercised.');
    }
  });

  /**
   * DEF-11. The schema adapter drops fields the SQL table has no column for
   * instead of round-tripping them, and flips the type of others.
   */
  test.fail('21.12 DEF-11 every submitted field survives a round trip', async ({ api, tag }) => {
    const payload = { ...referralPayload({ suName: tag }), srNo: 42, acknowledgementReceived: 'Pending' };
    await api.post('/api/db/referrals', { data: payload });

    const mine = (await listRecords(api, 'referrals')).find((r) => r.suName === tag);
    await deleteRecord(api, 'referrals', payload.id);

    expect(mine.srNo, 'srNo should survive').toBe(42);
    expect(mine.acknowledgementReceived, 'acknowledgement should stay categorical').toBe('Pending');
  });

  /**
   * DEF-03 / BUG-005 regression — FIXED 2026-09-07.
   * The route registration was nested inside the catch block of the /me handler,
   * so it never ran at startup and every call returned 404. It now sits at module
   * scope. The `test.fail()` annotation was removed when the fix landed.
   */
  test('21.13 BUG-005 the password update endpoint is routable', async ({ api }) => {
    const res = await api.post('/api/auth/update-password', { data: {} });
    expect(res.status(), 'route should exist and validate, not 404').not.toBe(404);
    expect(res.status(), 'an empty body should fail validation').toBe(400);
    expect((await res.json()).error).toMatch(/at least 6 characters/i);
  });

  test('21.15 BUG-005 password update rejects a request with no recovery token', async () => {
    // Genuinely token-less: the shared `api` fixture would attach a session token,
    // which exercises a different branch (token present but not a recovery token).
    const anon = await anonCtx();
    try {
      const res = await anon.post('/api/auth/update-password', { data: { password: 'longenough123' } });
      expect(res.status()).toBe(401);
      expect((await res.json()).error).toMatch(/recovery session token/i);
    } finally {
      await anon.dispose();
    }
  });

  test('21.16 BUG-005 password update rejects a non-recovery bearer token', async ({ api }) => {
    // A valid session token is not a password-recovery token and must not be
    // accepted as one.
    const res = await api.post('/api/auth/update-password', { data: { password: 'longenough123' } });
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toMatch(/recovery session/i);
  });
});
