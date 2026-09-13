/**
 * TEMPLATE 01: API Contract & Schema Test Template
 * 
 * Use this template to test backend REST endpoints:
 *   - HTTP status codes (200, 201, 400, 403, 404, 500)
 *   - Response payload shape and schema compliance
 *   - Query parameters: ?limit=N, ?order=col.asc/desc, ?eq.col=val
 *   - Validation rejection for malformed or missing required fields
 */

import { anonTest as test, expect } from '../tests/helpers/fixtures';
import { listRecords, createRecord } from '../tests/helpers/api';

test.describe('API Contract Template: [Entity Name]', () => {
  const ENTITY = 'referrals'; // Target entity key
  const DEFAULT_SITE = 'Brit Hotel';

  test('GET /api/db/:entity returns structured response with rows array', async ({ api }) => {
    const res = await api.get(`/api/db/${ENTITY}?limit=10`);
    
    // Status and shape assertions
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  test('POST /api/db/:entity creates record and persists custom/extended fields', async ({ api, tag }) => {
    const payload = {
      site: DEFAULT_SITE,
      suName: `${tag} Test Service User`,
      roomNumber: '101',
      dateReferred: '2026-10-15',
      status: 'Open',
      priority: 'Medium',
      // Dynamic/custom field verification
      customTrackingScore: 98,
      notes: 'Automated contract template test entry'
    };

    const res = await api.post(`/api/db/${ENTITY}`, { data: payload });
    expect([200, 201]).toContain(res.status());
    
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.record || body.data).toBeDefined();

    // Verify persistence via list
    const rows = await listRecords(api, ENTITY);
    const created = rows.find(r => r.suName === payload.suName);
    expect(created).toBeDefined();
    expect(created.customTrackingScore).toBe(98);
  });

  test('POST /api/db/:entity rejects invalid or missing mandatory data', async ({ api }) => {
    // Omitting required entity fields
    const invalidPayload = {};

    const res = await api.post(`/api/db/${ENTITY}`, { data: invalidPayload });
    // Should reject with 400 Bad Request or meaningful error
    expect([400, 422]).toContain(res.status());
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
