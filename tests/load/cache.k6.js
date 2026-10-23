// k6 load test for the Redis-cached reference reads (fieldOptions, tableSchemas).
// Run against STAGING with a synthetic test account only. Never use production data.
//
//   k6 run -e BASE_URL=https://staging.example.com -e TOKEN=<test user access token> tests/load/cache.k6.js
//   k6 run -e BASE_URL=... -e TOKEN=... -e SCENARIO=ramp tests/load/cache.k6.js
//
// Run it twice for a before/after comparison: once with CACHE_ENABLED=false on the
// server (baseline) and once enabled. Then compare the printed metrics, and read
// GET /api/db/cache-stats (admin token) for the server-side hit ratio.
//
// SCENARIO: ramp (default; 25, 50, 100 VUs) | smoke (1 VU, 20 iterations)
// WRITE_TOKEN (optional, admin test user): enables the freshness check in teardown-free
// form: one write, then a read that must show it.
// Thresholds are starting engineering targets, not claims; judge by the actual results.

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
const TOKEN = __ENV.TOKEN || '';
const WRITE_TOKEN = __ENV.WRITE_TOKEN || '';

if (!BASE_URL || !TOKEN) {
  throw new Error('Set BASE_URL and TOKEN (-e BASE_URL=... -e TOKEN=...)');
}

const batchLatency = new Trend('batch_read_ms', true);
const singleLatency = new Trend('single_read_ms', true);
const badResponses = new Rate('bad_responses');

const stages = __ENV.SCENARIO === 'smoke'
  ? null
  : [
      { duration: '30s', target: 25 },
      { duration: '1m', target: 25 },
      { duration: '30s', target: 50 },
      { duration: '1m', target: 50 },
      { duration: '30s', target: 100 },
      { duration: '1m', target: 100 },
      { duration: '20s', target: 0 },
    ];

export const options = {
  scenarios: {
    reads: stages
      ? { executor: 'ramping-vus', startVUs: 1, stages, exec: 'reads' }
      : { executor: 'per-vu-iterations', vus: 1, iterations: 20, exec: 'reads' },
    // Different tokens must never get each other's data or bypass auth.
    auth_checks: { executor: 'per-vu-iterations', vus: 1, iterations: 1, exec: 'authChecks', startTime: '2s' },
    freshness: { executor: 'per-vu-iterations', vus: 1, iterations: 1, exec: 'freshness', startTime: '5s' },
  },
  thresholds: {
    'http_req_failed{scenario:reads}': ['rate<0.01'],
    'batch_read_ms': ['p(95)<500'],
    'single_read_ms': ['p(95)<500'],
    'bad_responses': ['rate<0.01'],
    'checks': ['rate>0.99'],
  },
};

function headers(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// Same request the app's periodic sync sends for these entities.
const BATCH = JSON.stringify({
  requests: [
    { key: 'fieldOptions', entity: 'fieldOptions' },
    { key: 'tableSchemas', entity: 'tableSchemas' },
  ],
});

export function reads() {
  group('batch-read', () => {
    const res = http.post(`${BASE_URL}/api/db/batch-read`, BATCH, { headers: headers(TOKEN), tags: { name: 'batch-read' } });
    batchLatency.add(res.timings.duration);
    const ok = check(res, {
      'batch 200': r => r.status === 200,
      'batch has both entities': r => {
        try {
          const j = r.json();
          return j.success === true && j.results.fieldOptions?.success === true && j.results.tableSchemas?.success === true;
        } catch (e) { return false; }
      },
      'api not publicly cacheable': r => /no-store/.test(r.headers['Cache-Control'] || ''),
    });
    badResponses.add(!ok);
  });

  group('single-read', () => {
    const res = http.get(`${BASE_URL}/api/db/fieldOptions`, { headers: headers(TOKEN), tags: { name: 'get-fieldOptions' } });
    singleLatency.add(res.timings.duration);
    badResponses.add(!check(res, { 'single 200': r => r.status === 200 }));
  });

  sleep(Math.random() * 1.5 + 0.5);
}

// Auth must be enforced before the cache is consulted, even when the key is hot.
export function authChecks() {
  // Warm the cache first so a bad token is tested against a populated key.
  http.get(`${BASE_URL}/api/db/fieldOptions`, { headers: headers(TOKEN) });

  const none = http.get(`${BASE_URL}/api/db/fieldOptions`);
  const bad = http.get(`${BASE_URL}/api/db/fieldOptions`, { headers: headers('not-a-real-token') });
  const batchBad = http.post(`${BASE_URL}/api/db/batch-read`, BATCH, { headers: headers('not-a-real-token') });
  check(none, { 'no token -> 401': r => r.status === 401 });
  check(bad, { 'invalid token -> 401': r => r.status === 401 });
  check(batchBad, { 'invalid token batch -> 401': r => r.status === 401 });
  check(none, { 'no cached data in 401 body': r => !/"data"\s*:\s*\[/.test(r.body || '') });
}

// Write, then read: the read must reflect the write (invalidation), not a stale entry.
export function freshness() {
  if (!WRITE_TOKEN) {
    console.warn('WRITE_TOKEN not set; skipping the invalidation check.');
    return;
  }
  const before = http.get(`${BASE_URL}/api/db/fieldOptions`, { headers: headers(WRITE_TOKEN) });
  const body = before.json();
  const rows = body && body.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('No field option rows on staging to update; skipping the invalidation check.');
    return;
  }
  const row = rows[0];
  const marker = `k6-${Date.now()}`;
  const put = http.put(`${BASE_URL}/api/db/fieldOptions/${encodeURIComponent(row.id)}`,
    JSON.stringify(Object.assign({}, row, { k6Marker: marker })), { headers: headers(WRITE_TOKEN) });
  check(put, { 'write accepted': r => r.status >= 200 && r.status < 300 });

  const after = http.get(`${BASE_URL}/api/db/fieldOptions`, { headers: headers(WRITE_TOKEN) });
  // The marker may not be a stored column; the stronger check is that the response is fresh
  // data rather than the pre-write cached body, which we see as a body change or an identical
  // body when the column is not stored. Report both so a human can judge.
  console.log(`freshness: body changed after write = ${after.body !== before.body}`);
  check(after, { 'read after write 200': r => r.status === 200 });
}
