import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '../server/supabase.js';
import { INITIAL_SITES } from '../src/data/initialData.js';

async function updatePidsAndAddresses() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error('Supabase admin client not available');
    process.exit(1);
  }

  console.log('1. Updating Supabase sites table...');
  for (const site of INITIAL_SITES) {
    const { error: siteErr } = await admin.from('sites').update({
      pid: site.pid,
      address: site.address || '',
      address_line_1: site.address || '',
      city: site.city
    }).eq('id', site.id);
    if (siteErr) console.error('Error updating site', site.id, siteErr);
    else console.log(`Updated site: ${site.id} [${site.name}] -> PID: ${site.pid}, Address: ${site.address}`);
  }

  console.log('2. Updating Supabase properties table...');
  // Delete stray test properties if any
  await admin.from('properties').delete().like('property_reference', 'E2E-PROP-%');
  await admin.from('properties').delete().like('property_reference', 'DISCH-PROP-%');

  for (const site of INITIAL_SITES) {
    const propId = 'prop-' + site.id.replace('site-', '');
    const pidVal = site.pid && site.pid !== '—' ? site.pid : 'BURROWS';
    
    // Check if property exists
    const { data: existing } = await admin.from('properties').select('id').eq('id', propId).maybeSingle();
    if (existing) {
      const { error: propErr } = await admin.from('properties').update({
        property_reference: pidVal,
        address_line_1: site.address || '',
        city: site.city,
        notes: `Operational property for site ${site.name} (PID: ${site.pid || '—'}). Address: ${site.address || '—'}. Key safe: 4921.`
      }).eq('id', propId);
      if (propErr) console.error('Error updating property', propId, propErr);
      else console.log(`Updated property: ${propId} [${site.name}] -> Property ID (PID): ${pidVal}, Address: ${site.address}`);
    }
  }

  console.log('3. Updating server/data/master_data_storage.json...');
  const jsonPath = path.join(process.cwd(), 'server', 'data', 'master_data_storage.json');
  if (fs.existsSync(jsonPath)) {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (Array.isArray(raw.properties)) {
      raw.properties = raw.properties.map((p: any) => {
        const matchingSite = INITIAL_SITES.find(s => ('prop-' + s.id.replace('site-', '')) === p.id || s.name === p.propertyName);
        if (matchingSite) {
          const pidVal = matchingSite.pid && matchingSite.pid !== '—' ? matchingSite.pid : 'BURROWS';
          return {
            ...p,
            pid: matchingSite.pid && matchingSite.pid !== '—' ? matchingSite.pid : undefined,
            propertyReference: pidVal,
            addressLine1: matchingSite.address || p.addressLine1,
            city: matchingSite.city,
            notes: `Operational property for site ${matchingSite.name} (PID: ${matchingSite.pid || '—'}). Address: ${matchingSite.address || '—'}. Key safe: 4921.`
          };
        }
        return p;
      });
      fs.writeFileSync(jsonPath, JSON.stringify(raw, null, 2), 'utf8');
      console.log('Updated master_data_storage.json successfully.');
    }
  }

  console.log('All PID and address updates completed successfully!');
}

updatePidsAndAddresses().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
