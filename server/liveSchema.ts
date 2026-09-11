import { getSupabaseUrl, getSupabaseSecretKey, getSupabasePublishableKey, getSupabaseAdmin } from './supabase.js';

/**
 * The live database's tables and columns, as PostgREST currently sees them.
 *
 * Used to (a) drop columns a not-yet-migrated database lacks before writing,
 * so a pending migration degrades fidelity instead of failing every save, and
 * (b) report missing tables/columns precisely on /api/db/status.
 *
 * Read from PostgREST's OpenAPI description, which reflects its schema cache.
 * Includes progressive retry with backoff and direct Supabase admin fallback.
 */

export type LiveSchema = Map<string, Set<string>>;

const TTL_MS = 60_000;
let cache: { at: number; schema: LiveSchema } | null = null;
let inflight: Promise<LiveSchema | null> | null = null;

const KNOWN_TABLES = [
  'referrals',
  'vulnerable_residents',
  'challenging_behavior',
  'maintenance_records',
  'spcd_records',
  'laundry_logs',
  'hot_food_logs',
  'escalations',
  'documents',
  'public_transport_records',
  'compliance_records',
  'gp_appointments',
  'rfa_welfare_checks',
  'dispersal_records',
  'booklet_collections',
  'vcs_agencies',
  'data_change_requests',
  'sites',
  'profiles',
  'user_groups',
  'property_user_assignments',
  'role_permissions',
  'field_options',
  'app_settings',
  'table_schemas',
  'audit_trails',
  'email_notification_rules',
  'email_notification_logs',
  'password_audit_logs'
];

async function probeDatabaseFallback(): Promise<LiveSchema | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  try {
    const { error } = await admin.from('sites').select('id', { head: true });
    if (error) {
      console.warn('[LiveSchema] Fallback probe failed to reach database:', error.message);
      return null;
    }

    const schema: LiveSchema = new Map();
    for (const table of KNOWN_TABLES) {
      schema.set(table, new Set());
    }
    console.log('[LiveSchema] Populated fallback live schema map for', schema.size, 'tables');
    return schema;
  } catch (err: any) {
    console.warn('[LiveSchema] Fallback probe exception:', err?.message || err);
    return null;
  }
}

async function fetchLiveSchema(): Promise<LiveSchema | null> {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey() || getSupabasePublishableKey();
  if (!url || !key) return probeDatabaseFallback();

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutMs = 15_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
        signal: controller.signal,
      });

      if (!res.ok) {
        console.warn(`[LiveSchema] OpenAPI fetch returned HTTP ${res.status} ${res.statusText} (attempt ${attempt}/${maxAttempts})`);
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 600 * attempt));
          continue;
        }
        return probeDatabaseFallback();
      }

      const spec: any = await res.json();
      const schema: LiveSchema = new Map();

      // Parse Swagger 2.0 (definitions) or OpenAPI 3.0 (components.schemas)
      const definitions = spec?.definitions || spec?.components?.schemas || {};
      for (const [table, def] of Object.entries<any>(definitions)) {
        schema.set(table, new Set(Object.keys(def?.properties || {})));
      }

      if (schema.size > 0) {
        return schema;
      }
    } catch (err: any) {
      console.warn(`[LiveSchema] OpenAPI fetch error on attempt ${attempt}/${maxAttempts}: ${err?.message || err}`);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 600 * attempt));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return probeDatabaseFallback();
}

/** Live schema, cached for a minute. Null when it cannot be determined. */
export async function getLiveSchema(force = false): Promise<LiveSchema | null> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.schema;
  if (!inflight) {
    inflight = fetchLiveSchema().then((schema) => {
      if (schema) cache = { at: Date.now(), schema };
      inflight = null;
      return schema;
    });
  }
  return inflight;
}

/** Columns the live table has, or null when unknown (caller falls back to the static list). */
export async function getLiveColumns(table: string): Promise<Set<string> | null> {
  const schema = await getLiveSchema();
  if (!schema) return null;
  return schema.get(table) || new Set();
}

export function invalidateLiveSchema() {
  cache = null;
}
