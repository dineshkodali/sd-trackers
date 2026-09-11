import { getSupabaseUrl, getSupabaseSecretKey, getSupabasePublishableKey } from './supabase.js';

/**
 * The live database's tables and columns, as PostgREST currently sees them.
 *
 * Used to (a) drop columns a not-yet-migrated database lacks before writing,
 * so a pending migration degrades fidelity instead of failing every save, and
 * (b) report missing tables/columns precisely on /api/db/status.
 *
 * Read from PostgREST's OpenAPI description, which reflects its schema cache -
 * exactly what inserts and selects will be validated against.
 */

type LiveSchema = Map<string, Set<string>>;

const TTL_MS = 60_000;
let cache: { at: number; schema: LiveSchema } | null = null;
let inflight: Promise<LiveSchema | null> | null = null;

async function fetchLiveSchema(): Promise<LiveSchema | null> {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey() || getSupabasePublishableKey();
  if (!url || !key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const spec: any = await res.json();
    const schema: LiveSchema = new Map();
    for (const [table, def] of Object.entries<any>(spec?.definitions || {})) {
      schema.set(table, new Set(Object.keys(def?.properties || {})));
    }
    return schema;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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
