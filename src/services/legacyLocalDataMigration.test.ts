/**
 * Tests for the one-time move of browser-held records into the live database.
 * Run with:  npm run test:unit
 *
 * A fake localStorage and a mocked fetch stand in for the browser and the API;
 * every assertion is about which records are uploaded and which keys are kept.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
const storage = new MemoryStorage();
(globalThis as any).localStorage = storage;

interface Call { method: string; path: string; body: any }
let calls: Call[] = [];
let deletedAudit: any[] = [];
let failBulkFor: string | null = null;

(globalThis as any).fetch = async (url: string, init: any = {}) => {
  const path = String(url);
  const method = init.method || 'GET';
  const body = init.body ? JSON.parse(init.body) : undefined;
  calls.push({ method, path, body });
  const json = (status: number, payload: any) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
  if (method === 'GET' && path.startsWith('/api/db/audit_trails')) return json(200, { success: true, data: deletedAudit });
  const bulk = path.match(/^\/api\/db\/([^/]+)\/bulk$/);
  if (bulk) {
    if (failBulkFor === bulk[1]) return json(500, { success: false, error: 'boom' });
    return json(200, { success: true, count: body.records.length });
  }
  if (method === 'POST' && path.startsWith('/api/db/')) return json(201, { success: true, record: body });
  return json(404, { error: 'not mocked' });
};

const { migrateLegacyLocalData, hasLegacyLocalData } = await import('./legacyLocalDataMigration.ts');
const { INITIAL_PUBLIC_TRANSPORT_RECORDS, INITIAL_BOOKLET_RECORDS, INITIAL_ROLE_PERMISSIONS } = await import('../data/initialData.ts');

const put = (key: string, value: any) => storage.setItem(`sg_tracker_${key}`, JSON.stringify(value));
const has = (key: string) => storage.getItem(`sg_tracker_${key}`) !== null;
const uploadsFor = (entity: string) => calls.filter(c => c.path === `/api/db/${entity}/bulk`).flatMap(c => c.body.records);

const emptySnapshot = () => ({
  referrals: [], vulnerable: [], challenging: [], laundry: [], property_laundry_logs: [], food: [], food_vendor_buffet_logs: [],
  escalations: [], documents: [], maintenance: [], spcd: [], sites: [], userGroups: [], publicTransport: [], compliance: [],
  gpAppointments: [], rfaWelfare: [], dispersal: [], booklets: [], vcsAgencies: [], requests: [], fieldOptions: [],
  rolePermissions: [], appSettings: [], tableSchemas: []
} as Record<string, any[]>);

beforeEach(() => {
  storage.clear();
  calls = [];
  deletedAudit = [];
  failBulkFor = null;
});

test('nothing to do when the browser holds no legacy data', async () => {
  put('token', 'abc');
  put('role', 'Staff');
  assert.equal(hasLegacyLocalData(), false);
  const report = await migrateLegacyLocalData({ isAdmin: true, isSuperAdmin: true, snapshot: emptySnapshot() });
  assert.deepEqual(report, { uploaded: [], failed: [], deferred: [] });
  assert.equal(calls.length, 0);
  assert.ok(has('token'), 'session keys are never touched');
});

test('records that exist only in this browser are uploaded, then the key is removed', async () => {
  const local = [{ id: 'ref-local-1', suName: 'Only here', site: 'Brit Hotel', updatedAt: '2026-09-01T00:00:00Z' }];
  put('referrals', local);
  const report = await migrateLegacyLocalData({ isAdmin: false, isSuperAdmin: false, snapshot: emptySnapshot() });
  assert.deepEqual(uploadsFor('referrals'), local);
  assert.deepEqual(report.uploaded, ['referrals (1)']);
  assert.equal(has('referrals'), false, 'browser copy removed after a successful upload');
});

test('records deleted from the database are not resurrected', async () => {
  put('referrals', [{ id: 'ref-gone', suName: 'Deleted elsewhere', site: 'X' }, { id: 'ref-new', suName: 'New', site: 'X' }]);
  deletedAudit = [{ entityType: 'referrals', entityId: 'ref-gone', action: 'DELETE' }];
  await migrateLegacyLocalData({ isAdmin: false, isSuperAdmin: false, snapshot: emptySnapshot() });
  assert.deepEqual(uploadsFor('referrals').map(r => r.id), ['ref-new']);
});

test('bundled demo records are never uploaded unless edited', async () => {
  const demo = INITIAL_PUBLIC_TRANSPORT_RECORDS[0];
  const edited = { ...INITIAL_PUBLIC_TRANSPORT_RECORDS[1], suNames: 'A real person entered over the demo row' };
  put('public_transport_records', [demo, edited, { id: 'pt-real', approvalUrn: 'URN-REAL', suNames: 'Real' }]);
  await migrateLegacyLocalData({ isAdmin: false, isSuperAdmin: false, snapshot: emptySnapshot() });
  assert.deepEqual(uploadsFor('publicTransport').map(r => r.id).sort(), [edited.id, 'pt-real'].sort());
});

test('local edits to master data win only while the database still holds the default', async () => {
  const [a, b] = INITIAL_BOOKLET_RECORDS;
  const editedA = { ...a, collectedBooklets: 40 };
  const editedB = { ...b, collectedBooklets: 12 };
  put('booklet_records', [editedA, editedB]);
  const snapshot = emptySnapshot();
  snapshot.booklets = [
    { ...a, createdAt: 'x', updatedAt: '2026-09-01T00:00:00Z' },          // still the seeded default
    { ...b, collectedBooklets: 99, updatedAt: '2026-09-02T00:00:00Z' }     // someone already changed it in the database
  ];
  await migrateLegacyLocalData({ isAdmin: false, isSuperAdmin: false, snapshot });
  assert.deepEqual(uploadsFor('booklets').map(r => r.id), [a.id]);
});

test('an edit made in this browser after the database copy is uploaded; an older one is not', async () => {
  put('maintenance', [
    { id: 'm-1', description: 'Edited while offline', updatedAt: '2026-09-10T10:00:00Z' },
    { id: 'm-2', description: 'Stale local copy', updatedAt: '2026-09-01T10:00:00Z' }
  ]);
  const snapshot = emptySnapshot();
  snapshot.maintenance = [
    { id: 'm-1', description: 'Original', updatedAt: '2026-09-05T10:00:00Z' },
    { id: 'm-2', description: 'Newer in database', updatedAt: '2026-09-09T10:00:00Z' }
  ];
  await migrateLegacyLocalData({ isAdmin: false, isSuperAdmin: false, snapshot });
  assert.deepEqual(uploadsFor('maintenance').map(r => r.id), ['m-1']);
});

test('administrator-only modules are deferred for other roles and left in place', async () => {
  put('field_options', [{ id: 'opt-x', category: 'councils', label: 'X', value: 'x', isActive: true, order: 1 }]);
  put('role_permissions', INITIAL_ROLE_PERMISSIONS);
  const report = await migrateLegacyLocalData({ isAdmin: false, isSuperAdmin: false, snapshot: emptySnapshot() });
  assert.ok(report.deferred.includes('field_options'));
  assert.ok(report.deferred.includes('role_permissions'));
  assert.ok(has('field_options') && has('role_permissions'), 'kept for an administrator to migrate');
  assert.equal(uploadsFor('fieldOptions').length, 0);
});

test('only roles changed locally, whose database row is still default, are uploaded', async () => {
  const local = { ...INITIAL_ROLE_PERMISSIONS, Staff: { ...INITIAL_ROLE_PERMISSIONS.Staff, canExportData: true } };
  put('role_permissions', local);
  await migrateLegacyLocalData({ isAdmin: true, isSuperAdmin: true, snapshot: emptySnapshot() });
  assert.deepEqual(uploadsFor('rolePermissions').map(r => r.id), ['Staff']);
  assert.equal(has('role_permissions'), false);
});

test('a failed upload keeps the browser copy so the next sign-in retries', async () => {
  put('dispersal_records', [{ id: 'disp-real', suPortNassRef: 'D-1' }]);
  failBulkFor = 'dispersal';
  const report = await migrateLegacyLocalData({ isAdmin: false, isSuperAdmin: false, snapshot: emptySnapshot() });
  assert.equal(report.failed.length, 1);
  assert.ok(has('dispersal_records'), 'kept after failure');
});

test('modules whose table is unavailable are deferred, not discarded', async () => {
  put('gp_appointment_records', [{ id: 'gp-real', portReference: 'G-1' }]);
  const snapshot = emptySnapshot();
  delete snapshot.gpAppointments;
  const report = await migrateLegacyLocalData({ isAdmin: false, isSuperAdmin: false, snapshot });
  assert.ok(report.deferred.includes('gp_appointment_records'));
  assert.ok(has('gp_appointment_records'));
});

test('superseded caches are removed without upload', async () => {
  put('audit', [{ id: 'a' }]);
  put('users', [{ id: 'u' }]);
  put('notification_rules', []);
  await migrateLegacyLocalData({ isAdmin: false, isSuperAdmin: false, snapshot: emptySnapshot() });
  assert.equal(has('audit') || has('users') || has('notification_rules'), false);
  assert.equal(calls.filter(c => c.method !== 'GET').length, 0);
});
