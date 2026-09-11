import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.js';
import { getLiveSchema } from './liveSchema.js';
import { toDatabaseRow } from './schemaAdapter.js';
import { DEFAULT_RULES, notificationRuleToRow } from './routes/smtp.js';
import {
  INITIAL_SITES,
  INITIAL_BOOKLET_RECORDS,
  INITIAL_VCS_AGENCIES,
  INITIAL_ROLE_PERMISSIONS,
  INITIAL_SETTINGS
} from '../src/data/initialData.js';
import { DEFAULT_FIELD_OPTIONS } from '../src/data/defaultFieldOptions.js';

/**
 * Seeds reference data - the property directory, booklet inventory, VCS
 * agency directory, dropdown vocabularies, RBAC matrix, system preferences and
 * notification rules - into tables that are empty.
 *
 * Each table is seeded at most once: a marker row in app_settings
 * (`seeded:<table>`) is written after seeding, or on first sight of a table
 * that already holds data, so records an administrator later deletes are
 * never re-inserted by a restart.
 *
 * Operational records (referrals, incidents, appointments ...) are never
 * seeded; the demo records bundled with the frontend are not real data.
 */

interface SeedSpec {
  table: string;
  rows: () => Record<string, any>[];
}

const SEEDS: SeedSpec[] = [
  { table: 'sites', rows: () => INITIAL_SITES.map(s => toDatabaseRow('sites', s)) },
  { table: 'booklet_collections', rows: () => INITIAL_BOOKLET_RECORDS.map(r => toDatabaseRow('booklet_collections', r)) },
  { table: 'vcs_agencies', rows: () => INITIAL_VCS_AGENCIES.map(r => toDatabaseRow('vcs_agencies', r)) },
  { table: 'field_options', rows: () => DEFAULT_FIELD_OPTIONS.map(o => toDatabaseRow('field_options', o)) },
  {
    table: 'role_permissions',
    rows: () => Object.entries(INITIAL_ROLE_PERMISSIONS).map(([role, perms]) =>
      toDatabaseRow('role_permissions', { id: role, role, ...perms })
    )
  },
  {
    table: 'app_settings',
    rows: () => [toDatabaseRow('app_settings', { id: 'global', value: INITIAL_SETTINGS, updatedBy: 'system' })]
  },
  { table: 'email_notification_rules', rows: () => DEFAULT_RULES.map(notificationRuleToRow) },
];

export interface SeedResult {
  seeded: string[];
  skipped: string[];
  errors: string[];
}

export async function seedReferenceData(): Promise<SeedResult> {
  const result: SeedResult = { seeded: [], skipped: [], errors: [] };
  if (!isSupabaseConfigured()) {
    result.errors.push('Database not configured');
    return result;
  }
  const client = getSupabaseAdmin();
  if (!client) {
    result.errors.push('Supabase client unavailable');
    return result;
  }

  const schema = await getLiveSchema(true);
  if (!schema) {
    result.errors.push('Could not read the live database schema');
    return result;
  }
  const canMark = schema.has('app_settings');

  for (const spec of SEEDS) {
    const { table } = spec;
    if (!schema.has(table)) {
      result.skipped.push(`${table} (table missing - migration pending)`);
      continue;
    }

    const markerId = `seeded:${table}`;
    if (canMark) {
      const { data: marker } = await client.from('app_settings').select('id').eq('id', markerId).maybeSingle();
      if (marker) {
        result.skipped.push(`${table} (already seeded)`);
        continue;
      }
    }

    const { count, error: countError } = await client.from(table).select('*', { count: 'exact', head: true });
    if (countError) {
      result.errors.push(`${table}: ${countError.message}`);
      continue;
    }

    if ((count ?? 0) === 0) {
      const liveCols = schema.get(table)!;
      const rows = spec.rows().map(row =>
        Object.fromEntries(Object.entries(row).filter(([col]) => liveCols.has(col)))
      );
      const { error } = await client.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      if (error) {
        result.errors.push(`${table}: ${error.message}`);
        continue;
      }
      result.seeded.push(`${table} (${rows.length} rows)`);
    } else {
      result.skipped.push(`${table} (already has ${count} rows)`);
    }

    if (canMark) {
      await client.from('app_settings').upsert(
        { id: markerId, value: { at: new Date().toISOString(), rowsAtFirstSight: count ?? 0 }, updated_by: 'seed' },
        { onConflict: 'id' }
      );
    }
  }

  return result;
}
