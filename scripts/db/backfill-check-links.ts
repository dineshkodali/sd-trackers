/**
 * Back-fill the links the twice-monthly check rules need:
 *   room_checks.room_id    <- the one room with that site + room number
 *   welfare_checks.su_id   <- the one resident with that port / SU reference
 *
 * Safe by design:
 *   - DRY RUN unless you pass --apply. A dry run changes nothing and writes a CSV of what it would do.
 *   - Only rows whose link is empty are touched; an existing link is never overwritten.
 *   - A row is filled only when EXACTLY ONE room / resident matches. Everything else is listed in the CSV for a person
 *     to resolve; nothing is guessed.
 *   - Re-running is harmless: filled rows are skipped next time.
 *
 * Usage:
 *   npx tsx scripts/db/backfill-check-links.ts            # dry run, writes backfill-check-links.csv
 *   npx tsx scripts/db/backfill-check-links.ts --apply    # fills the unambiguous ones
 */
import fs from 'fs';
import { getSupabaseAdmin } from '../../server/supabase.js';
import { roomChecksToVisits, welfareChecksToVisits } from '../../src/utils/checkObligations.js';

const APPLY = process.argv.includes('--apply');

async function all(admin: any, table: string, columns: string) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function main() {
  const admin = getSupabaseAdmin();
  if (!admin) { console.error('Supabase admin client not available'); process.exit(1); }
  console.log(APPLY ? 'APPLY mode: unambiguous links will be written.' : 'DRY RUN: nothing will be changed. Pass --apply to write.');

  const sites = (await all(admin, 'sites', 'id,name')).map((s: any) => ({ id: s.id, name: s.name }));
  const properties = (await all(admin, 'properties', 'id,site_id')).map((p: any) => ({ id: p.id, siteId: p.site_id }));
  const rooms = (await all(admin, 'property_rooms', 'id,property_id,room_number')).map((r: any) => ({ id: r.id, propertyId: r.property_id, roomNumber: r.room_number }));
  const people = (await all(admin, 'service_users', 'id,external_reference,su_reference,case_reference'))
    .map((s: any) => ({ id: s.id, externalReference: s.external_reference, suReference: s.su_reference, caseReference: s.case_reference }));

  const rows: string[] = ['table,record_id,outcome,detail'];
  let filled = 0;
  let unmatched = 0;

  const roomChecks = (await all(admin, 'room_checks', 'id,site_id,site_name,room_number,room_id,inspection_date,officer_name'))
    .filter((c: any) => !c.room_id);
  const roomMap = roomChecksToVisits(
    roomChecks.map((c: any) => ({ id: c.id, siteId: c.site_id, siteName: c.site_name, roomNumber: c.room_number, inspectionDate: String(c.inspection_date || '').slice(0, 10) || 'x', officerName: c.officer_name })),
    rooms as any, properties as any, sites
  );
  for (const v of roomMap.visits) {
    rows.push(`room_checks,${v.id},${APPLY ? 'filled' : 'would fill'},room_id=${v.subjectId}`);
    if (APPLY) {
      const { error } = await admin.from('room_checks').update({ room_id: v.subjectId }).eq('id', v.id).is('room_id', null);
      if (error) { console.error('room_checks', v.id, error.message); continue; }
    }
    filled++;
  }
  for (const u of roomMap.unmatched) { rows.push(`room_checks,${u.id},needs a person,"${u.reason}: ${u.label}"`); unmatched++; }

  const welfare = (await all(admin, 'welfare_checks', 'id,port_reference,service_user_id,su_id,check_datetime,officer_name'))
    .filter((c: any) => !c.su_id);
  const welMap = welfareChecksToVisits(
    welfare.map((c: any) => ({ id: c.id, serviceUserId: c.service_user_id, portReference: c.port_reference, checkDatetime: c.check_datetime, officerName: c.officer_name })),
    people as any
  );
  for (const v of welMap.visits) {
    rows.push(`welfare_checks,${v.id},${APPLY ? 'filled' : 'would fill'},su_id=${v.subjectId}`);
    if (APPLY) {
      const { error } = await admin.from('welfare_checks').update({ su_id: v.subjectId }).eq('id', v.id).is('su_id', null);
      if (error) { console.error('welfare_checks', v.id, error.message); continue; }
    }
    filled++;
  }
  for (const u of welMap.unmatched) { rows.push(`welfare_checks,${u.id},needs a person,"${u.reason}: ${u.label}"`); unmatched++; }

  fs.writeFileSync('backfill-check-links.csv', rows.join('\n') + '\n');
  console.log(`${APPLY ? 'Filled' : 'Would fill'} ${filled}; ${unmatched} need a person. Details: backfill-check-links.csv`);
}

main().catch(e => { console.error(e); process.exit(1); });
