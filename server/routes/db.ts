import { Router, Request, Response } from 'express';
import { getSupabaseAdmin, isSupabaseConfigured } from '../supabase.js';
import { runDatabaseMigrations } from '../migrate.js';
import { toDatabaseRow, fromDatabaseRow } from '../schemaAdapter.js';

const router = Router();

/**
 * Canonical table registry — maps frontend entity names to Supabase table names.
 * No duplicate/legacy tables. Each entity maps to exactly one canonical table.
 */
export const PAGE_TABLE_REGISTRY = {
  referrals: { page: 'Referrals', table: 'referrals' },
  vulnerable: { page: 'Vulnerable Service Users', table: 'vulnerable_residents' },
  challenging: { page: 'Challenging Service Users', table: 'challenging_behavior' },
  maintenance: { page: 'Maintenance & Defects', table: 'maintenance_records' },
  spcd: { page: 'SPCD Tracker', table: 'spcd_records' },
  sites: { page: 'Properties & Sites', table: 'sites' },
  userGroups: { page: 'User Groups', table: 'user_groups' },
  property_user_assignments: { page: 'Property Assignments', table: 'property_user_assignments' },
  audit_trails: { page: 'Audit Trails', table: 'audit_trails' },
  laundry: { page: 'Laundry Logs', table: 'laundry_logs' },
  laundry_logs: { page: 'Laundry Operational Logs', table: 'laundry_logs' },
  property_laundry_logs: { page: 'Property Laundry Logs', table: 'laundry_logs' },
  food: { page: 'Food Records', table: 'hot_food_logs' },
  hot_food_logs: { page: 'Hot Food Logs', table: 'hot_food_logs' },
  food_vendor_buffet_logs: { page: 'Food Vendor Buffet Logs', table: 'hot_food_logs' },
  escalations: { page: 'Escalations', table: 'escalations' },
  documents: { page: 'Documents', table: 'documents' },
  requests: { page: 'Data Change Requests', table: 'data_change_requests' },
  profiles: { page: 'User Profiles', table: 'profiles' },
  users: { page: 'Users', table: 'profiles' },
  passwordAudit: { page: 'Password Audit', table: 'password_audit_logs' }
} as const;

// Canonical entity → table mapping (no legacy duplicates)
const TABLE_MAP: Record<string, string> = {
  referrals: 'referrals',
  vulnerable: 'vulnerable_residents',
  challenging: 'challenging_behavior',
  maintenance: 'maintenance_records',
  spcd: 'spcd_records',
  sites: 'sites',
  userGroups: 'user_groups',
  property_user_assignments: 'property_user_assignments',
  audit: 'audit_trails',
  audit_trails: 'audit_trails',
  laundry: 'laundry_logs',
  laundry_logs: 'laundry_logs',
  property_laundry_logs: 'laundry_logs',
  food: 'hot_food_logs',
  hot_food_logs: 'hot_food_logs',
  food_vendor_buffet_logs: 'hot_food_logs',
  escalations: 'escalations',
  documents: 'documents',
  requests: 'data_change_requests',
  profiles: 'profiles',
  users: 'profiles',
  passwordAudit: 'password_audit_logs'
};

// Helper to test if a string is a valid UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUuid(val: any): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

// Helper to extract caller user context from request headers & body
function extractAuditCallerContext(req: Request) {
  const userId = (req.headers['x-user-id'] as string) || req.body?.createdBy || req.body?.created_by || req.body?.userId || null;
  const userEmail = (req.headers['x-user-email'] as string) || req.body?.userEmail || null;
  const userName = (req.headers['x-user-name'] as string) || req.body?.userName || req.body?.lastUpdatedBy || req.body?.staffName || null;
  const role = (req.headers['x-user-role'] as string) || req.body?.userRole || req.body?.role || 'Staff';
  const site = (req.headers['x-user-site'] as string) || req.body?.site || req.body?.siteName || 'All Sites';
  const actionHeader = req.headers['x-action-type'] as string;

  return {
    userId,
    validUuid: isValidUuid(userId) ? userId : null,
    userEmail,
    userName,
    displayName: userName || userEmail || (userId ? `User (${userId})` : 'Authenticated Staff'),
    role,
    site,
    actionHeader
  };
}

// Centralized Audit Logger to persist into public.audit_trails
async function recordAuditTrailEntry(params: {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  entityId?: string;
  userId?: string | null;
  validUuid?: string | null;
  displayName: string;
  role: string;
  site: string;
  details?: string;
}) {
  if (!isSupabaseConfigured()) return;
  const client = getSupabaseAdmin();
  if (!client) return;

  try {
    const { action, entity, entityId, userId, validUuid, displayName, role, site, details } = params;

    // Skip self-auditing to prevent recursion
    if (entity === 'audit' || entity === 'audit_trails') {
      return;
    }

    const defaultDetails = `${action} on ${entity}${entityId ? ` [${entityId}]` : ''} by ${displayName} (${role})`;
    const fullDetails = details || defaultDetails;
    const nowIso = new Date().toISOString();
    const auditId = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const trailPayload: any = {
      id: auditId,
      timestamp: nowIso,
      user: displayName,
      role: role || 'Staff',
      action,
      details: fullDetails,
      site: site || 'All Sites',
      entity_type: entity,
      entity_id: entityId ? String(entityId) : null,
      created_at: nowIso,
      updated_at: nowIso
    };

    if (validUuid) {
      trailPayload.user_id = validUuid;
      trailPayload.created_by = validUuid;
    }

    // Persist to audit_trails (canonical table)
    const { error } = await client.from('audit_trails').insert(trailPayload);
    if (error) {
      console.warn(`[Audit Middleware] audit_trails insert error: ${error.message}`);
    } else {
      console.log(`[Audit Middleware] Successfully logged ${action} on ${entity} by ${displayName} (UID: ${validUuid || userId || 'none'})`);
    }
  } catch (err: any) {
    console.warn('[Audit Middleware Error]', err.message);
  }
}

// -------------------------------------------------------------
// 1. Static API Routes (Must be declared BEFORE /:entity)
// -------------------------------------------------------------

function getPageCoverage(tableCounts: Record<string, number | string>) {
  return Object.entries(PAGE_TABLE_REGISTRY).map(([entity, meta]) => {
    const tableCount = tableCounts[entity];
    const present = typeof tableCount === 'number' && tableCount >= 0;
    const hasError = typeof tableCount === 'string' && tableCount.startsWith('Error:');

    return {
      entity,
      page: meta.page,
      table: meta.table,
      connected: !hasError && present,
      status: hasError ? 'error' : present ? 'connected' : 'missing'
    };
  });
}

// GET /api/db/status
router.get('/status', async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.json({
      connected: false,
      mode: 'offline-local',
      message: 'Supabase credentials not configured in .env. Using local storage.',
      tables: {},
      pages: []
    });
  }

  try {
    const client = getSupabaseAdmin();
    if (!client) {
      return res.json({ connected: false, mode: 'offline-local', error: 'Client unavailable', pages: [] });
    }

    const tableCounts: Record<string, number | string> = {};
    for (const [key, tableName] of Object.entries(TABLE_MAP)) {
      try {
        const { count, error } = await client.from(tableName).select('*', { count: 'exact', head: true });
        if (error) {
          tableCounts[key] = `Error: ${error.message}`;
        } else {
          tableCounts[key] = count ?? 0;
        }
      } catch (e: any) {
        tableCounts[key] = 'Unreachable';
      }
    }

    const pageCoverage = getPageCoverage(tableCounts);
    const missingTables = pageCoverage.filter(item => item.status === 'missing' || item.status === 'error').map(item => item.table);

    res.json({
      connected: true,
      mode: 'supabase-cloud',
      url: process.env.SUPABASE_URL,
      tables: tableCounts,
      pages: pageCoverage,
      missingTables,
      totalPages: pageCoverage.length,
      connectedPages: pageCoverage.filter(item => item.connected).length
    });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message, pages: [] });
  }
});

router.post('/ensure', async (req: Request, res: Response) => {
  const result = await runDatabaseMigrations();
  if (!result.success) {
    return res.status(500).json({ success: false, ...result });
  }

  return res.json({ success: true, message: 'Database schema validated and repaired.', ...result });
});

// POST /api/db/migrate - Execute supabase-schema.sql using PostgreSQL connection string
router.post('/migrate', async (req: Request, res: Response) => {
  const result = await runDatabaseMigrations();
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

// POST /api/db/sync/push - Push full database backup / sync from client to Supabase
router.post('/sync/push', async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(400).json({
      success: false,
      message: 'Supabase credentials are not configured in .env'
    });
  }

  try {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase client unavailable');

    const { referrals, vulnerable, challenging, maintenance, spcd, sites, laundry, food, escalations, documents, requests, profiles } = req.body;
    const results: Record<string, any> = {};

    if (Array.isArray(referrals) && referrals.length > 0) {
      const rows = referrals.map(r => toDatabaseRow('referrals', r));
      const { error } = await client.from('referrals').upsert(rows);
      results.referrals = error ? `Error: ${error.message}` : `Synced ${referrals.length} items`;
    }

    if (Array.isArray(vulnerable) && vulnerable.length > 0) {
      const rows = vulnerable.map(r => toDatabaseRow('vulnerable_residents', r));
      const { error } = await client.from('vulnerable_residents').upsert(rows);
      results.vulnerable = error ? `Error: ${error.message}` : `Synced ${vulnerable.length} items`;
    }

    if (Array.isArray(challenging) && challenging.length > 0) {
      const rows = challenging.map(r => toDatabaseRow('challenging_behavior', r));
      const { error } = await client.from('challenging_behavior').upsert(rows);
      results.challenging = error ? `Error: ${error.message}` : `Synced ${challenging.length} items`;
    }

    if (Array.isArray(maintenance) && maintenance.length > 0) {
      const rows = maintenance.map(r => toDatabaseRow('maintenance_records', r));
      const { error } = await client.from('maintenance_records').upsert(rows);
      results.maintenance = error ? `Error: ${error.message}` : `Synced ${maintenance.length} items`;
    }

    if (Array.isArray(spcd) && spcd.length > 0) {
      const rows = spcd.map(r => toDatabaseRow('spcd_records', r));
      const { error } = await client.from('spcd_records').upsert(rows);
      results.spcd = error ? `Error: ${error.message}` : `Synced ${spcd.length} items`;
    }

    if (Array.isArray(sites) && sites.length > 0) {
      const rows = sites.map(r => toDatabaseRow('sites', r));
      const { error } = await client.from('sites').upsert(rows);
      results.sites = error ? `Error: ${error.message}` : `Synced ${sites.length} items`;
    }

    if (Array.isArray(laundry) && laundry.length > 0) {
      const rows = laundry.map(r => toDatabaseRow('laundry_logs', r));
      const { error } = await client.from('laundry_logs').upsert(rows);
      results.laundry = error ? `Error: ${error.message}` : `Synced ${laundry.length} items`;
    }

    if (Array.isArray(food) && food.length > 0) {
      const rows = food.map(r => toDatabaseRow('hot_food_logs', r));
      const { error } = await client.from('hot_food_logs').upsert(rows);
      results.food = error ? `Error: ${error.message}` : `Synced ${food.length} items`;
    }

    if (Array.isArray(escalations) && escalations.length > 0) {
      const rows = escalations.map(r => toDatabaseRow('escalations', r));
      const { error } = await client.from('escalations').upsert(rows);
      results.escalations = error ? `Error: ${error.message}` : `Synced ${escalations.length} items`;
    }

    if (Array.isArray(documents) && documents.length > 0) {
      const rows = documents.map(r => toDatabaseRow('documents', r));
      const { error } = await client.from('documents').upsert(rows);
      results.documents = error ? `Error: ${error.message}` : `Synced ${documents.length} items`;
    }

    if (Array.isArray(requests) && requests.length > 0) {
      const rows = requests.map(r => toDatabaseRow('data_change_requests', r));
      const { error } = await client.from('data_change_requests').upsert(rows);
      results.requests = error ? `Error: ${error.message}` : `Synced ${requests.length} items`;
    }

    if (Array.isArray(profiles) && profiles.length > 0) {
      const rows = profiles.map(r => toDatabaseRow('profiles', r));
      const { error } = await client.from('profiles').upsert(rows);
      results.profiles = error ? `Error: ${error.message}` : `Synced ${profiles.length} items`;
    }

    res.json({
      success: true,
      message: 'Cloud sync operation completed',
      results
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 2. Dynamic Parametric Routes (/:entity, /:entity/:id)
// -------------------------------------------------------------

// GET /api/db/:entity
router.get('/:entity', async (req: Request, res: Response) => {
  const { entity } = req.params;
  const tableName = TABLE_MAP[entity];

  if (!tableName) {
    return res.status(404).json({ error: `Unknown entity: ${entity}` });
  }

  if (!isSupabaseConfigured()) {
    return res.json({ fallback: true, data: [] });
  }

  try {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase client unavailable');

    const { data, error } = await client.from(tableName).select('*');
    if (error) {
      if (error.code === '42P01') {
        const migration = await runDatabaseMigrations();
        if (migration.success) {
          const { data: rerunData, error: rerunError } = await client.from(tableName).select('*');
          if (!rerunError && rerunData) {
            return res.json({ success: true, data: (rerunData || []).map((row: any) => fromDatabaseRow(tableName, row)) });
          }
        }

        return res.json({
          fallback: true,
          tableMissing: true,
          hint: 'Table was missing and has been re-created by the migration. Please refresh the page and retry.',
          data: []
        });
      }
      return res.status(500).json({ error: error.message });
    }

    const resultData = (data || []).map((row: any) => fromDatabaseRow(tableName, row));
    res.json({ success: true, data: resultData });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/db/:entity
router.post('/:entity', async (req: Request, res: Response) => {
  const { entity } = req.params;
  const tableName = TABLE_MAP[entity];
  const caller = extractAuditCallerContext(req);

  if (!tableName) {
    return res.status(404).json({ error: `Unknown entity: ${entity}` });
  }

  if (!isSupabaseConfigured()) {
    return res.json({ success: true, fallback: true, record: req.body });
  }

  try {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase client unavailable');

    const dbRow = toDatabaseRow(tableName, req.body, caller.validUuid);

    const { data, error } = await client.from(tableName).upsert(dbRow).select().single();

    if (error) {
      console.error(`[DB POST /api/db/${entity}] Supabase error:`, error.message, 'dbRow:', dbRow);
      return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
    }

    const record = fromDatabaseRow(tableName, data || dbRow);

    // Centralized Audit Middleware: record audit trail
    recordAuditTrailEntry({
      action: 'CREATE',
      entity,
      entityId: record.id || dbRow.id,
      userId: caller.userId,
      validUuid: caller.validUuid,
      displayName: caller.displayName,
      role: caller.role,
      site: caller.site,
      details: req.body?.auditDetails || `Created ${entity} record [${record.id || dbRow.id || 'new'}]`
    }).catch(e => console.warn('Audit trail async error:', e));

    res.status(201).json({ success: true, record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/db/:entity/:id
router.put('/:entity/:id', async (req: Request, res: Response) => {
  const { entity, id } = req.params;
  const tableName = TABLE_MAP[entity];
  const caller = extractAuditCallerContext(req);

  if (!tableName) {
    return res.status(404).json({ error: `Unknown entity: ${entity}` });
  }

  if (!isSupabaseConfigured()) {
    return res.json({ success: true, fallback: true, record: req.body });
  }

  try {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase client unavailable');

    const dbRow = toDatabaseRow(tableName, req.body, caller.validUuid);
    delete dbRow.id;

    const { data, error } = await client.from(tableName).update(dbRow).eq('id', id).select().single();

    if (error) {
      console.error(`[DB PUT /api/db/${entity}/${id}] Supabase error:`, error.message, 'dbRow:', dbRow);
      return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
    }

    const record = fromDatabaseRow(tableName, data || { id, ...dbRow });

    // Centralized Audit Middleware: record audit trail
    recordAuditTrailEntry({
      action: 'UPDATE',
      entity,
      entityId: id,
      userId: caller.userId,
      validUuid: caller.validUuid,
      displayName: caller.displayName,
      role: caller.role,
      site: caller.site,
      details: req.body?.auditDetails || `Updated ${entity} record [${id}]`
    }).catch(e => console.warn('Audit trail async error:', e));

    res.json({ success: true, record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/db/:entity/:id
router.delete('/:entity/:id', async (req: Request, res: Response) => {
  const { entity, id } = req.params;
  const tableName = TABLE_MAP[entity];
  const caller = extractAuditCallerContext(req);

  if (!tableName) {
    return res.status(404).json({ error: `Unknown entity: ${entity}` });
  }

  if (!isSupabaseConfigured()) {
    return res.json({ success: true, fallback: true });
  }

  try {
    const client = getSupabaseAdmin();
    if (!client) throw new Error('Supabase client unavailable');

    const { error } = await client.from(tableName).delete().eq('id', id);
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Centralized Audit Middleware: record audit trail
    recordAuditTrailEntry({
      action: 'DELETE',
      entity,
      entityId: id,
      userId: caller.userId,
      validUuid: caller.validUuid,
      displayName: caller.displayName,
      role: caller.role,
      site: caller.site,
      details: `Permanently deleted ${entity} record [${id}]`
    }).catch(e => console.warn('Audit trail async error:', e));

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
