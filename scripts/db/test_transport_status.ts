import 'dotenv/config';
import { getSupabaseAdmin } from '../server/supabase.js';

async function main() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('No admin');

  const { data: records } = await admin.from('public_transport_records').select('*');
  for (const r of records || []) {
    console.log('--- Record:', r.id, r.approval_urn, '---');
    console.log('Status col:', r.status);
    console.log('Status data:', r.data?.status);
    console.log('Attachments col length:', Array.isArray(r.attachments) ? r.attachments.length : typeof r.attachments);
    console.log('Attachments data length:', Array.isArray(r.data?.attachments) ? r.data?.attachments.length : typeof r.data?.attachments);
    if (Array.isArray(r.attachments) && r.attachments.length > 0) {
      console.log('First att col:', r.attachments[0].name, 'url type:', typeof r.attachments[0].url, 'url startsWith:', r.attachments[0].url?.slice(0, 30));
    }
    if (Array.isArray(r.data?.attachments) && r.data?.attachments.length > 0) {
      console.log('First att data:', r.data.attachments[0].name, 'url startsWith:', r.data.attachments[0].url?.slice(0, 30));
    }
  }
}
main();
