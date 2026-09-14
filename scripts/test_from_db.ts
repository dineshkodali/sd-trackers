import 'dotenv/config';
import { getSupabaseAdmin } from '../server/supabase.js';
import { fromDatabaseRow } from '../server/schemaAdapter.js';

async function testFromDb() {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { data } = await admin.from('public_transport_records').select('*').eq('id', 'pt-1789301745576').single();
  const mapped = fromDatabaseRow('public_transport_records', data);
  console.log('mapped status:', mapped.status);
}
testFromDb();
