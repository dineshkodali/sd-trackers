import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, isSupabaseConfigured, getSupabaseUrl } from '../supabase.js';
import { runDatabaseMigrations, loadSchemaSql } from '../migrate.js';
import { toDatabaseRow, fromDatabaseRow, TABLE_COLUMNS, DATA_TABLES, moduleLabelFor } from '../schemaAdapter.js';
import { requireRole } from '../middleware/requireAuth.js';
import { getLiveSchema, getLiveColumns, invalidateLiveSchema } from '../liveSchema.js';
import { seedReferenceData } from '../seed.js';
import { INITIAL_ROLE_PERMISSIONS } from '../../src/data/initialData.js';

const router = Router();

/**
 * Who may perform an operation on an entity:
 *   any        - any authenticated user
 *   admin      - Super Admin / Admin
 *   superadmin - Super Admin only
 *   append     - create only (any user); updates refused
 *   permission - governed by role_permissions.canDeleteRecords (deletes only)
 *   none       - not through this API
 */
type Policy = 'any' | 'admin' | 'superadmin' | 'append' | 'permission' | 'none';

interface EntityDef {
  page: string;
  table: string;
  read?: 'any' | 'admin';
  write?: Policy;
  remove?: Policy;
  /** Discriminator for entities sharing one table. */
  variant?: (record: any) => boolean;
  /** Alias kept for older clients; omitted from page coverage. */
  alias?: boolean;
}

const isPropertyLaundry = (r: any) => !!r.periodType || String(r.id || '').startsWith('prop-lau');
const isVendorBuffet = (r: any) => !!r.dailyCounts || String(r.id || '').startsWith('vendor-bf');

/**
 * Canonical entity registry: every page that stores data, the table that
 * holds it, and who may change it.
 */
export const ENTITY_REGISTRY: Record<string, EntityDef> = {
  referrals: { page: 'SG Referrals', table: 'referrals' },
  vulnerable: { page: 'Vulnerable SUs', table: 'vulnerable_residents' },
  challenging: { page: 'Challenging SUs', table: 'challenging_behavior' },
  maintenance: { page: 'Maintenance Tracker', table: 'maintenance_records' },
  spcd: { page: 'SPCD Tracker', table: 'spcd_records' },
  laundry: { page: 'Laundry Support - resident intake', table: 'laundry_logs', variant: r => !isPropertyLaundry(r) },
  property_laundry_logs: { page: 'Laundry Support - property logs', table: 'laundry_logs', variant: isPropertyLaundry },
  food: { page: 'Hot Meals Tracker - deliveries', table: 'hot_food_logs', variant: r => !isVendorBuffet(r) },
  food_vendor_buffet_logs: { page: 'Hot Meals Tracker - vendor buffet', table: 'hot_food_logs', variant: isVendorBuffet },
  escalations: { page: 'Escalations Log', table: 'escalations' },
  documents: { page: 'Proof Documents', table: 'documents' },
  publicTransport: { page: 'Public Transport Tracker', table: 'public_transport_records' },
  compliance: { page: 'SD-Compliance Tracker', table: 'compliance_records' },
  gpAppointments: { page: 'GP Appointments', table: 'gp_appointments' },
  rfaWelfare: { page: 'RFA Welfare Checks', table: 'rfa_welfare_checks' },
  dispersal: { page: 'Dispersal Sheet', table: 'dispersal_records' },
  booklets: { page: 'Booklets to be Collected', table: 'booklet_collections' },
  vcsAgencies: { page: 'SD VCS Directory', table: 'vcs_agencies' },
  requests: { page: 'Requests & Approvals', table: 'data_change_requests' },
  sites: { page: 'Properties Directory', table: 'sites', write: 'admin', remove: 'admin' },
  users: { page: 'Staff & User Accounts', table: 'profiles', write: 'admin', remove: 'none' },
  userGroups: { page: 'User Groups', table: 'user_groups', write: 'admin', remove: 'admin' },
  property_user_assignments: { page: 'Property Assignments', table: 'property_user_assignments', write: 'admin', remove: 'admin' },
  rolePermissions: { page: 'Roles & RBAC Matrix', table: 'role_permissions', write: 'admin', remove: 'admin' },
  fieldOptions: { page: 'Field Options & Setup', table: 'field_options', write: 'admin', remove: 'admin' },
  appSettings: { page: 'System Preferences', table: 'app_settings', write: 'admin', remove: 'none' },
  tableSchemas: { page: 'Custom Table Columns', table: 'table_schemas', write: 'admin', remove: 'admin' },
  audit_trails: { page: 'Audit Security Trail', table: 'audit_trails', write: 'append', remove: 'superadmin' },
  email_notification_rules: { page: 'Notifications - rules', table: 'email_notification_rules', write: 'none', remove: 'none' },
  email_notification_logs: { page: 'Notifications - delivery log', table: 'email_notification_logs', write: 'none', remove: 'none' },
  passwordAudit: { page: 'Password Audit Log', table: 'password_audit_logs', read: 'admin', write: 'none', remove: 'none' },

  // Aliases used by existing clients
  audit: { page: 'Audit Security Trail', table: 'audit_trails', write: 'append', remove: 'superadmin', alias: true },
  laundry_logs: { page: 'Laundry Support - resident intake', table: 'laundry_logs', variant: r => !isPropertyLaundry(r), alias: true },
  hot_food_logs: { page: 'Hot Meals Tracker - deliveries', table: 'hot_food_logs', variant: r => !isVendorBuffet(r), alias: true },
  profiles: { page: 'Staff & User Accounts', table: 'profiles', write: 'admin', remove: 'none', alias: true },
};

/** Retained for callers that imported the old name. */
export const PAGE_TABLE_REGISTRY = Object.fromEntries(
  Object.entries(ENTITY_REGISTRY).filter(([, d]) => !d.alias).map(([k, d]) => [k, { page: d.page, table: d.table }])
);

const ADMIN_ROLES = ['Super Admin', 'Admin'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidUuid = (val: any) => typeof val === 'string' && UUID_REGEX.test(val.trim());
const isMissingTableError = (error: any) => error?.code === '42P01' || error?.code === 'PGRST205';

function resolveEntity(req: Request, res: Response): EntityDef | null {
  const def = ENTITY_REGISTRY[req.params.entity];
  if (!def) {
    res.status(404).json({ success: false, error: `Unknown entity: ${req.params.entity}` });
    return null;
  }
  return def;
}

function requireDatabase(res: Response): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    res.status(503).json({
      success: false,
      error: 'Live database is not configured on the server (SUPABASE_URL / SUPABASE_SECRET_KEY). Changes cannot be saved.'
    });
    return null;
  }
  const client = getSupabaseAdmin();
  if (!client) {
    res.status(503).json({ success: false, error: 'Supabase client unavailable. Changes cannot be saved.' });
    return null;
  }
  return client;
}

function tableMissing(res: Response, table: string) {
  return res.status(503).json({
    success: false,
    tableMissing: true,
    table,
    error: `Database table "${table}" does not exist yet. An administrator must apply the database migration (Settings > Database > Run Migration).`
  });
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

let permissionCache: { at: number; canDelete: Map<string, boolean> } | null = null;

async function roleMayDelete(role: string): Promise<boolean> {
  if (role === 'Super Admin') return true;
  if (!permissionCache || Date.now() - permissionCache.at > 60_000) {
    const canDelete = new Map<string, boolean>();
    const client = getSupabaseAdmin();
    if (client) {
      const { data } = await client.from('role_permissions').select('id, can_delete_records');
      for (const row of data || []) canDelete.set(row.id, row.can_delete_records === true);
    }
    permissionCache = { at: Date.now(), canDelete };
  }
  if (permissionCache.canDelete.has(role)) return permissionCache.canDelete.get(role)!;
  return (INITIAL_ROLE_PERMISSIONS as Record<string, any>)[role]?.canDeleteRecords === true;
}

async function authorize(req: Request, res: Response, policy: Policy, operation: 'create' | 'update' | 'delete'): Promise<boolean> {
  const role = req.user?.role || '';
  let allowed = false;
  switch (policy) {
    case 'any': allowed = true; break;
    case 'admin': allowed = ADMIN_ROLES.includes(role); break;
    case 'superadmin': allowed = role === 'Super Admin'; break;
    case 'append': allowed = operation === 'create'; break;
    case 'permission': allowed = operation === 'delete' ? await roleMayDelete(role) : true; break;
    case 'none': allowed = false; break;
  }
  if (!allowed) {
    res.status(403).json({ success: false, error: 'Insufficient privileges for this operation' });
  }
  return allowed;
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

const AUDIT_ACTIONS = new Set([
  'CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE', 'SETTINGS_UPDATE', 'ROLE_CHANGE', 'BACKUP_EXPORT', 'DATA_RESTORE'
]);

interface ClientAuditContext {
  action?: string;
  module?: string;
  targetItem?: string;
  details?: string;
  site?: string;
}

/**
 * Descriptive audit text supplied by the client in the `x-audit-context`
 * header (base64 JSON). Only the description comes from the client: identity
 * always comes from the verified session.
 */
function readClientAuditContext(req: Request): ClientAuditContext | null {
  const raw = req.headers['x-audit-context'];
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 8192) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function callerIdentity(req: Request) {
  const u = req.user;
  return {
    validUuid: isValidUuid(u?.id) ? u!.id : null,
    displayName: u?.name || u?.email || 'Authenticated Staff',
    role: u?.role || 'Staff',
    site: (req.headers['x-user-site'] as string) || u?.assignedSite || 'All Sites',
  };
}

async function recordAuditTrailEntry(req: Request, params: {
  defaultAction: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  entityId?: string;
  site?: string;
  defaultDetails: string;
}) {
  if (params.entity === 'audit' || params.entity === 'audit_trails') return; // no self-auditing
  const client = getSupabaseAdmin();
  if (!client) return;

  try {
    const caller = callerIdentity(req);
    const ctx = readClientAuditContext(req) || {};
    const action = ctx.action && AUDIT_ACTIONS.has(ctx.action) ? ctx.action : params.defaultAction;
    const nowIso = new Date().toISOString();

    const row = toDatabaseRow('audit_trails', {
      id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      timestamp: nowIso,
      user: caller.displayName,
      userId: caller.validUuid,
      role: caller.role,
      action,
      details: String(ctx.details || params.defaultDetails).slice(0, 4000),
      site: ctx.site || params.site || caller.site,
      module: ctx.module || moduleLabelFor(params.entity),
      entityType: params.entity,
      entityId: params.entityId,
      targetItem: ctx.targetItem ? String(ctx.targetItem).slice(0, 500) : params.entityId,
    }, caller.validUuid, await getLiveColumns('audit_trails'));

    const { error } = await client.from('audit_trails').insert(row);
    if (error) console.warn(`[Audit] audit_trails insert error: ${error.message}`);
  } catch (err: any) {
    console.warn('[Audit] error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * PostgREST (which Supabase sits on) caps a single response at 1000 rows and
 * gives no indication when it does so. Page through with `.range()` until the
 * table is exhausted or `limit` is reached (BUG-025). Paging needs a
 * deterministic order, so `id` is always the final sort key.
 */
const PAGE_SIZE = 1000;
const MAX_ROWS = 50_000; // hard ceiling so one enormous table cannot exhaust memory

interface ListOptions {
  limit?: number;
  orderColumn?: string;
  ascending?: boolean;
  filters?: Array<[string, string]>;
}

async function selectRows(
  client: SupabaseClient,
  tableName: string,
  opts: ListOptions = {}
): Promise<{ data: any[] | null; error: any; truncated: boolean }> {
  const rows: any[] = [];
  const cap = Math.min(opts.limit ?? MAX_ROWS, MAX_ROWS);

  while (rows.length < cap) {
    const from = rows.length;
    const to = Math.min(from + PAGE_SIZE, cap) - 1;

    let query = client.from(tableName).select('*');
    for (const [column, value] of opts.filters || []) {
      query = query.eq(column, value);
    }
    if (opts.orderColumn && opts.orderColumn !== 'id') {
      query = query.order(opts.orderColumn, { ascending: opts.ascending ?? true, nullsFirst: false });
    }
    const { data, error } = await query.order('id', { ascending: true }).range(from, to);

    if (error) return { data: null, error, truncated: false };
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < to - from + 1) break; // short page: table exhausted
  }

  return { data: rows, error: null, truncated: opts.limit === undefined && rows.length >= MAX_ROWS };
}

/** limit, order ("column.asc|desc") and equality filters, restricted to the table's known columns. */
function buildListOptions(src: { limit?: any; order?: any; eq?: Record<string, any> }, tableName: string): ListOptions {
  const opts: ListOptions = {};
  const known = TABLE_COLUMNS[tableName];
  const limit = Number(src.limit);
  if (Number.isFinite(limit) && limit > 0) opts.limit = Math.min(Math.trunc(limit), MAX_ROWS);

  const order = typeof src.order === 'string' ? src.order : '';
  const [column, direction] = order.split('.');
  if (column && known?.has(column)) {
    opts.orderColumn = column;
    opts.ascending = direction !== 'desc';
  }

  for (const [filterColumn, value] of Object.entries(src.eq || {})) {
    if (typeof value === 'string' && known?.has(filterColumn)) (opts.filters ||= []).push([filterColumn, value]);
  }
  return opts;
}

/** ?limit=N, ?order=column.asc|desc and equality filters ?eq.column=value. */
function parseListOptions(req: Request, tableName: string): ListOptions {
  const eq: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (key.startsWith('eq.') && typeof value === 'string') eq[key.slice(3)] = value;
  }
  return buildListOptions({ limit: req.query.limit, order: req.query.order, eq }, tableName);
}

async function readEntity(client: SupabaseClient, def: EntityDef, opts: ListOptions) {
  const { data, error, truncated } = await selectRows(client, def.table, opts);
  if (error) return { success: false as const, error: error.message, tableMissing: isMissingTableError(error), data: [] as any[] };
  let rows = (data || []).map((row: any) => fromDatabaseRow(def.table, row));
  if (def.variant) rows = rows.filter(def.variant);
  return { success: true as const, data: rows, total: rows.length, truncated };
}

// ---------------------------------------------------------------------------
// Static routes (declared before the parametric ones)
// ---------------------------------------------------------------------------

// GET /api/db/status — live connection, schema and per-page coverage
router.get('/status', async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.json({
      connected: false,
      live: false,
      mode: 'unconfigured',
      message: 'Live database is not configured on the server. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.',
      tables: {},
      pages: []
    });
  }

  const client = getSupabaseAdmin();
  const schema = await getLiveSchema(true);
  if (!client || !schema) {
    return res.status(503).json({
      connected: false,
      live: false,
      mode: 'unreachable',
      message: 'The Supabase API did not respond. Changes cannot be saved until it is reachable.',
      tables: {},
      pages: []
    });
  }

  const distinctTables = Array.from(new Set(Object.values(ENTITY_REGISTRY).map(d => d.table)));
  const tableInfo: Record<string, { exists: boolean; rows: number | null; missingColumns: string[]; error?: string }> = {};

  await Promise.all(distinctTables.map(async (table) => {
    const live = schema.get(table);
    if (!live) {
      tableInfo[table] = { exists: false, rows: null, missingColumns: [] };
      return;
    }
    const expected = TABLE_COLUMNS[table];
    const missingColumns = expected ? Array.from(expected).filter(c => !live.has(c)) : [];
    const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
    tableInfo[table] = { exists: true, rows: error ? null : (count ?? 0), missingColumns, ...(error ? { error: error.message } : {}) };
  }));

  const pages = Object.entries(ENTITY_REGISTRY)
    .filter(([, d]) => !d.alias)
    .map(([entity, d]) => {
      const info = tableInfo[d.table];
      const status = !info.exists ? 'missing' : info.error ? 'error' : info.missingColumns.length > 0 ? 'outdated' : 'connected';
      return {
        entity,
        page: d.page,
        table: d.table,
        rows: info.rows,
        sharedTable: !!d.variant,
        missingColumns: info.missingColumns,
        connected: status === 'connected' || status === 'outdated',
        status
      };
    });

  // Per-entity row counts, for entities whose GET returns the whole table.
  const tables: Record<string, number | string> = {};
  for (const [entity, d] of Object.entries(ENTITY_REGISTRY)) {
    if (d.alias || d.variant) continue;
    const info = tableInfo[d.table];
    tables[entity] = !info.exists ? 'Error: table missing' : info.error ? `Error: ${info.error}` : (info.rows ?? 0);
  }

  let schemaVersion: string | null = null;
  if (schema.has('app_settings')) {
    const { data } = await client.from('app_settings').select('value').eq('id', 'schema_version').maybeSingle();
    schemaVersion = (data?.value as any)?.version ?? null;
  }

  const missingTables = distinctTables.filter(t => !tableInfo[t].exists);
  const outdatedTables = distinctTables.filter(t => tableInfo[t].exists && tableInfo[t].missingColumns.length > 0);

  res.json({
    connected: true,
    live: true,
    mode: 'supabase-cloud',
    url: getSupabaseUrl(),
    schemaVersion,
    migrationRequired: missingTables.length > 0 || outdatedTables.length > 0,
    tables,
    pages,
    missingTables,
    outdatedTables,
    totalPages: pages.length,
    connectedPages: pages.filter(p => p.status === 'connected').length
  });
});

async function migrateAndSeed() {
  const migration = await runDatabaseMigrations();
  invalidateLiveSchema();
  const seed = await seedReferenceData();
  return { migration, seed };
}

router.post('/ensure', requireRole(...ADMIN_ROLES), async (_req: Request, res: Response) => {
  const { migration, seed } = await migrateAndSeed();
  res.status(migration.success ? 200 : 500).json({ ...migration, seed });
});

// POST /api/db/migrate - apply db/schema.sql (non-destructive) and seed reference data
router.post('/migrate', requireRole(...ADMIN_ROLES), async (_req: Request, res: Response) => {
  const { migration, seed } = await migrateAndSeed();
  res.status(migration.success ? 200 : 500).json({ ...migration, seed });
});

// GET /api/db/migration-sql - the migration script, for the Supabase SQL editor
router.get('/migration-sql', requireRole(...ADMIN_ROLES), (_req: Request, res: Response) => {
  const sql = loadSchemaSql();
  if (!sql) return res.status(404).json({ success: false, error: 'db/schema.sql not found' });
  res.type('text/plain').send(sql);
});

/**
 * POST /api/db/batch-read  { requests: [{ key?, entity, limit?, order?, eq? }] }
 *
 * Loads several entities in one round trip - the application's periodic sync
 * reads every page's data, and one request per entity would be ~27 requests
 * every 45 seconds per open tab. Each entity succeeds or fails independently.
 */
router.post('/batch-read', async (req: Request, res: Response) => {
  const client = requireDatabase(res);
  if (!client) return;

  const requests = req.body?.requests;
  if (!Array.isArray(requests) || requests.length === 0 || requests.length > 60) {
    return res.status(400).json({ success: false, error: 'Body must be { requests: [...] } with 1-60 entries' });
  }

  const role = req.user?.role || '';
  const results: Record<string, any> = {};
  await Promise.all(requests.map(async (r: any) => {
    const key = String(r?.key || r?.entity || '');
    const def = ENTITY_REGISTRY[r?.entity];
    if (!def) {
      results[key] = { success: false, error: `Unknown entity: ${r?.entity}`, data: [] };
      return;
    }
    if (def.read === 'admin' && !ADMIN_ROLES.includes(role)) {
      results[key] = { success: false, error: 'Insufficient privileges for this operation', data: [] };
      return;
    }
    try {
      results[key] = await readEntity(client, def, buildListOptions(r, def.table));
    } catch (err: any) {
      results[key] = { success: false, error: err.message, data: [] };
    }
  }));

  res.json({ success: true, results });
});

// POST /api/db/seed - seed reference data into empty tables
router.post('/seed', requireRole(...ADMIN_ROLES), async (_req: Request, res: Response) => {
  const seed = await seedReferenceData();
  res.status(seed.errors.length ? 500 : 200).json({ success: seed.errors.length === 0, ...seed });
});

// ---------------------------------------------------------------------------
// Write helpers shared by single, bulk and sync routes
// ---------------------------------------------------------------------------

function ensureId(entityDef: EntityDef, record: any) {
  if (entityDef.table === 'profiles') return record;
  if (record.id === undefined || record.id === null || String(record.id).trim() === '') {
    return { ...record, id: crypto.randomUUID() };
  }
  return record;
}

/** Identity on client-submitted audit entries always comes from the session. */
function withVerifiedAuditIdentity(req: Request, entityDef: EntityDef, record: any) {
  if (entityDef.table !== 'audit_trails') return record;
  const caller = callerIdentity(req);
  return {
    ...record,
    user: caller.displayName,
    performedByUser: caller.displayName,
    userId: caller.validUuid,
    role: caller.role,
    performedByRole: caller.role,
    timestamp: record.timestamp || new Date().toISOString()
  };
}

async function bulkUpsert(
  client: SupabaseClient,
  req: Request,
  entityDef: EntityDef,
  records: any[],
  liveCols: Set<string>
): Promise<{ data: any[]; error: any }> {
  const caller = callerIdentity(req);
  const rows = records.map(r =>
    toDatabaseRow(entityDef.table, withVerifiedAuditIdentity(req, entityDef, ensureId(entityDef, r)), caller.validUuid, liveCols)
  );
  const saved: any[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await client.from(entityDef.table).upsert(rows.slice(i, i + 500)).select();
    if (error) return { data: saved, error };
    saved.push(...(data || []));
  }
  return { data: saved, error: null };
}

// POST /api/db/sync/push - bulk upsert of several entities at once
router.post('/sync/push', async (req: Request, res: Response) => {
  const client = requireDatabase(res);
  if (!client) return;

  const results: Record<string, string> = {};
  for (const [entity, records] of Object.entries(req.body || {})) {
    const def = ENTITY_REGISTRY[entity];
    if (!def || !Array.isArray(records) || records.length === 0) continue;
    const policy = def.write || 'any';
    const role = req.user?.role || '';
    const permitted = policy === 'any' || (policy === 'admin' && ADMIN_ROLES.includes(role)) || (policy === 'superadmin' && role === 'Super Admin');
    if (!permitted) {
      results[entity] = 'Error: insufficient privileges';
      continue;
    }
    const liveCols = await getLiveColumns(def.table);
    if (liveCols && liveCols.size === 0) {
      results[entity] = `Error: table ${def.table} missing`;
      continue;
    }
    const { error } = await bulkUpsert(client, req, def, records, liveCols || TABLE_COLUMNS[def.table]);
    results[entity] = error ? `Error: ${error.message}` : `Synced ${records.length} items`;
  }

  const failed = Object.values(results).some(v => v.startsWith('Error'));
  res.status(failed ? 207 : 200).json({ success: !failed, message: failed ? 'Some entities failed to sync' : 'Cloud sync operation completed', results });
});

// ---------------------------------------------------------------------------
// Parametric routes (/:entity, /:entity/:id)
// ---------------------------------------------------------------------------

// GET /api/db/:entity  (optional ?limit=N&order=column.asc|desc)
router.get('/:entity', async (req: Request, res: Response) => {
  const def = resolveEntity(req, res);
  if (!def) return;
  if (def.read === 'admin' && !ADMIN_ROLES.includes(req.user?.role || '')) {
    return res.status(403).json({ success: false, error: 'Insufficient privileges for this operation' });
  }
  const client = requireDatabase(res);
  if (!client) return;

  try {
    const result = await readEntity(client, def, parseListOptions(req, def.table));
    if (!result.success) {
      if (result.tableMissing) return tableMissing(res, def.table);
      return res.status(500).json({ success: false, error: result.error });
    }
    // `total` and `truncated` let a caller tell a complete result from a capped one.
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/db/:entity/bulk  { records: [...] }
router.post('/:entity/bulk', async (req: Request, res: Response) => {
  const def = resolveEntity(req, res);
  if (!def) return;
  if (!(await authorize(req, res, def.write || 'any', 'create'))) return;
  const client = requireDatabase(res);
  if (!client) return;

  const records = req.body?.records;
  if (!Array.isArray(records) || records.some(r => !r || typeof r !== 'object' || Array.isArray(r))) {
    return res.status(400).json({ success: false, error: 'Body must be { records: [ {...}, ... ] }' });
  }
  if (records.length > 5000) {
    return res.status(413).json({ success: false, error: 'At most 5000 records per bulk request' });
  }
  if (records.length === 0) return res.json({ success: true, count: 0, records: [] });

  const liveCols = await getLiveColumns(def.table);
  if (liveCols && liveCols.size === 0) return tableMissing(res, def.table);

  const { data, error } = await bulkUpsert(client, req, def, records, liveCols || TABLE_COLUMNS[def.table]);
  if (error) {
    if (isMissingTableError(error)) return tableMissing(res, def.table);
    return res.status(500).json({ success: false, error: error.message, details: error.details, hint: error.hint });
  }

  if (def.table === 'role_permissions') permissionCache = null;
  recordAuditTrailEntry(req, {
    defaultAction: 'UPDATE',
    entity: req.params.entity,
    defaultDetails: `Bulk saved ${records.length} ${req.params.entity} record(s)`
  });

  res.json({ success: true, count: data.length, records: data.map(row => fromDatabaseRow(def.table, row)) });
});

// POST /api/db/:entity/bulk-delete  { ids: [...] }
router.post('/:entity/bulk-delete', async (req: Request, res: Response) => {
  const def = resolveEntity(req, res);
  if (!def) return;
  if (!(await authorize(req, res, def.remove || 'permission', 'delete'))) return;
  const client = requireDatabase(res);
  if (!client) return;

  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || id.length === 0)) {
    return res.status(400).json({ success: false, error: 'Body must be { ids: [ "id", ... ] }' });
  }
  if (ids.length === 0) return res.json({ success: true, deleted: 0 });

  let deleted = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await client.from(def.table).delete().in('id', ids.slice(i, i + 200)).select('id');
    if (error) {
      if (isMissingTableError(error)) return tableMissing(res, def.table);
      return res.status(500).json({ success: false, error: error.message, deleted });
    }
    deleted += data?.length || 0;
  }

  if (def.table === 'role_permissions') permissionCache = null;
  if (deleted > 0) {
    recordAuditTrailEntry(req, {
      defaultAction: 'DELETE',
      entity: req.params.entity,
      defaultDetails: `Bulk deleted ${deleted} ${req.params.entity} record(s)`
    });
  }
  res.json({ success: true, deleted });
});

// POST /api/db/:entity — create (or replace) one record
router.post('/:entity', async (req: Request, res: Response) => {
  const def = resolveEntity(req, res);
  if (!def) return;
  if (!(await authorize(req, res, def.write || 'any', 'create'))) return;
  const client = requireDatabase(res);
  if (!client) return;

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ success: false, error: 'Body must be a JSON object' });
  }

  try {
    const liveCols = await getLiveColumns(def.table);
    if (liveCols && liveCols.size === 0) return tableMissing(res, def.table);

    const caller = callerIdentity(req);
    const record = withVerifiedAuditIdentity(req, def, ensureId(def, req.body));
    const dbRow = toDatabaseRow(def.table, record, caller.validUuid, liveCols || TABLE_COLUMNS[def.table]);

    const { data, error } = await client.from(def.table).upsert(dbRow).select().single();
    if (error) {
      if (isMissingTableError(error)) return tableMissing(res, def.table);
      console.error(`[DB POST /api/db/${req.params.entity}] ${error.message}`);
      return res.status(500).json({ success: false, error: error.message, details: error.details, hint: error.hint });
    }

    const saved = fromDatabaseRow(def.table, data || dbRow);
    if (def.table === 'role_permissions') permissionCache = null;

    recordAuditTrailEntry(req, {
      defaultAction: 'CREATE',
      entity: req.params.entity,
      entityId: saved.id || dbRow.id,
      site: record.site || record.siteName,
      defaultDetails: `Created ${req.params.entity} record [${saved.id || dbRow.id}]`
    });

    res.status(201).json({ success: true, record: saved, fullFidelity: DATA_TABLES.has(def.table) ? (liveCols ? liveCols.has('data') : true) : true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/db/:entity/:id — merge an update onto the stored record
router.put('/:entity/:id', async (req: Request, res: Response) => {
  const def = resolveEntity(req, res);
  if (!def) return;
  if (!(await authorize(req, res, def.write || 'any', 'update'))) return;
  const client = requireDatabase(res);
  if (!client) return;

  const { id } = req.params;
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ success: false, error: 'Body must be a JSON object' });
  }

  try {
    const liveCols = await getLiveColumns(def.table);
    if (liveCols && liveCols.size === 0) return tableMissing(res, def.table);
    const allowed = liveCols || TABLE_COLUMNS[def.table];
    const caller = callerIdentity(req);

    // `toDatabaseRow` builds a COMPLETE row, so mapping a partial body directly
    // would blank every column the caller did not send (BUG-004). Merge onto
    // the stored record first so untouched fields survive.
    const { data: existingRow, error: readError } = await client.from(def.table).select('*').eq('id', id).maybeSingle();
    if (readError) {
      if (isMissingTableError(readError)) return tableMissing(res, def.table);
      return res.status(500).json({ success: false, error: readError.message });
    }

    if (!existingRow) {
      // Not stored yet: persist the full record now.
      const dbRow = toDatabaseRow(def.table, { ...req.body, id }, caller.validUuid, allowed);
      const { data, error } = await client.from(def.table).upsert(dbRow).select().single();
      if (error) return res.status(500).json({ success: false, error: error.message, details: error.details, hint: error.hint });
      recordAuditTrailEntry(req, {
        defaultAction: 'CREATE',
        entity: req.params.entity,
        entityId: id,
        site: req.body.site || req.body.siteName,
        defaultDetails: `Created ${req.params.entity} record [${id}]`
      });
      return res.json({ success: true, record: fromDatabaseRow(def.table, data || dbRow) });
    }

    const merged = { ...fromDatabaseRow(def.table, existingRow), ...req.body, id };
    const dbRow = toDatabaseRow(def.table, merged, caller.validUuid, allowed);
    delete dbRow.id;
    delete dbRow.created_by; // the creator never changes on update

    const { data, error } = await client.from(def.table).update(dbRow).eq('id', id).select().single();
    if (error) {
      console.error(`[DB PUT /api/db/${req.params.entity}/${id}] ${error.message}`);
      return res.status(500).json({ success: false, error: error.message, details: error.details, hint: error.hint });
    }

    if (def.table === 'role_permissions') permissionCache = null;
    recordAuditTrailEntry(req, {
      defaultAction: 'UPDATE',
      entity: req.params.entity,
      entityId: id,
      site: merged.site || merged.siteName,
      defaultDetails: `Updated ${req.params.entity} record [${id}]`
    });

    res.json({ success: true, record: fromDatabaseRow(def.table, data || { id, ...dbRow }) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/db/:entity/:id
router.delete('/:entity/:id', async (req: Request, res: Response) => {
  const def = resolveEntity(req, res);
  if (!def) return;
  if (!(await authorize(req, res, def.remove || 'permission', 'delete'))) return;
  const client = requireDatabase(res);
  if (!client) return;

  const { id } = req.params;
  try {
    const { data, error } = await client.from(def.table).delete().eq('id', id).select('id');
    if (error) {
      if (isMissingTableError(error)) return tableMissing(res, def.table);
      return res.status(500).json({ success: false, error: error.message });
    }

    const deleted = data?.length || 0;
    if (def.table === 'role_permissions') permissionCache = null;
    if (deleted > 0) {
      recordAuditTrailEntry(req, {
        defaultAction: 'DELETE',
        entity: req.params.entity,
        entityId: id,
        defaultDetails: `Permanently deleted ${req.params.entity} record [${id}]`
      });
    }

    res.json({ success: true, id, deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
