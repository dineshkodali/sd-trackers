import 'dotenv/config';
import { getSupabaseAdmin } from '../server/supabase.js';

async function check() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error('Supabase admin not available');
    return;
  }
  const tables = [
    'mh_complaint_welfare_checks',
    'daily_laundry_logs',
    'housekeeping_logs',
    'food_consumption_reports',
    'food_box_requests'
  ];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('id').limit(1);
    if (error) {
      console.log(`Table ${t}: Error -> ${error.message} (code: ${error.code})`);
    } else {
      console.log(`Table ${t}: EXISTS! Found ${data?.length || 0} rows.`);
    }
  }
}

check().catch(console.error);
