import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const ALL_TABLES = [
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

export async function verifyDbCoverage(): Promise<{ total: number; connected: number; results: Array<{ table: string; status: string; rows: number }> }> {
  console.log(`Verifying Supabase Table Coverage against: ${SUPABASE_URL}\n`);
  let connected = 0;
  const results: Array<{ table: string; status: string; rows: number }> = [];

  for (const table of ALL_TABLES) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=count`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'count=exact'
        }
      });

      if (res.status === 200 || res.status === 206) {
        const range = res.headers.get('content-range') || '';
        const count = parseInt(range.split('/')[1] || '0', 10);
        console.log(`[OK]       ${table.padEnd(30)} -> Connected (${count} rows)`);
        connected++;
        results.push({ table, status: 'connected', rows: count });
      } else {
        const text = await res.text();
        console.log(`[MISSING]  ${table.padEnd(30)} -> ${res.status}: ${text.slice(0, 60)}`);
        results.push({ table, status: 'missing', rows: 0 });
      }
    } catch (e: any) {
      console.log(`[ERROR]    ${table.padEnd(30)} -> Network error: ${e.message}`);
      results.push({ table, status: 'error', rows: 0 });
    }
  }

  console.log(`\n========================================`);
  console.log(`Coverage Summary: ${connected}/${ALL_TABLES.length} tables verified.`);
  console.log(`========================================\n`);

  return { total: ALL_TABLES.length, connected, results };
}

if (process.argv[1]?.endsWith('verify-db-coverage.ts')) {
  verifyDbCoverage();
}
