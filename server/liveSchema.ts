import { getSupabaseUrl, getSupabaseSecretKey, getSupabasePublishableKey, getSupabaseAdmin } from './supabase.js';
import { TABLE_COLUMNS } from './schemaAdapter.js';

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

export const KNOWN_TABLES = Array.from(
  new Set([
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
    'password_audit_logs',
    'finance_bills',
    'vendor_invoices',
    'credit_card_bills',
    'delivery_notes',
    'finance_approvals',
    'finance_bill_items',
    'finance_bill_attachments',
    'finance_vendors',
    'finance_verification_profiles',
    'finance_verification_tasks',
    'finance_approval_requests',
    'finance_bill_queries',
    'finance_reconciliation_records',
    'finance_payment_records',
    'finance_workflow_events',
    'ir_records',
    'food_wastage_records',
    'daily_register_rooms',
    'daily_register_records',
    'new_arrivals_records',
    'eviction_records',
    'properties',
    'property_rooms',
    'property_facilities',
    'property_assets',
    'property_compliance',
    'property_documents',
    'property_contacts',
    'service_users',
    'service_user_contacts',
    'service_user_household',
    'service_user_support',
    'service_user_documents',
    'placements',
    'room_beds',
    'inventory_items',
    'property_inventory_stock',
    'room_inventory',
    'inventory_movements',
    'room_kit_templates',
    'room_issues',
    'room_activity_log',
    'room_checks',
    'room_check_items',
    'gp_registrations',
    'peep_plans',
    'peep_plan_history',
    'su_attendance_records',
    'absence_followups',
    'su_hc2_details',
    'oyster_cards',
    'oyster_card_events',
    'oyster_card_transactions',
    'su_meal_records',
    'su_meal_record_history',
    'su_education_details',
    'family_groups',
    'family_members',
    'su_archive_requests',
    'transport_funding_requests',
    'transport_funding_status_history',
    'transport_feedback',
    'transport_challenges',
    'welfare_checks',
    'mh_complaint_welfare_checks',
    'food_surveys',
    'food_meal_ratings',
    'food_consumption_reports',
    'food_box_requests',
    'daily_laundry_logs',
    'housekeeping_logs',
    'housekeeping_room_logs',
    'doc_builder',
    'ho_report_templates',
    'ho_report_records',
    'ho_report_audit_logs',
    'service_user_report_history',
    'user_page_permissions',
    'page_access_audit',
    'audit_logs',
    ...Object.keys(TABLE_COLUMNS)
  ])
);

async function probeDatabaseFallback(): Promise<LiveSchema | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  try {
    const { error } = await admin.from('sites').select('id', { head: true });
    if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
      console.warn('[LiveSchema] Fallback probe failed to reach database:', error.message);
    }

    const schema: LiveSchema = new Map();
    for (const table of KNOWN_TABLES) {
      schema.set(table, new Set(TABLE_COLUMNS[table] || []));
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

  try {
    const controller = new AbortController();
    const timeoutMs = 8000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const spec: any = await res.json();
      const schema: LiveSchema = new Map();
      const definitions = spec?.definitions || spec?.components?.schemas || {};
      for (const [table, def] of Object.entries<any>(definitions)) {
        schema.set(table, new Set(Object.keys(def?.properties || {})));
      }
      if (schema.size > 0) return schema;
    }
  } catch (err: any) {
    // Proceed to fallback probe
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
  return schema.get(table) || null;
}

export function invalidateLiveSchema() {
  cache = null;
}
