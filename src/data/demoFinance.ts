/**
 * The two sample suppliers that migration 004 inserted purely as demo data (Apex Facilities & Commercial Cleaning Ltd and
 * Direct Site Supplies & Maintenance Ltd). They are never offered in supplier lists or filters.
 *
 * The other four suppliers that migration also inserted (Brakes, Total Commercial Laundry, British Gas, Enterprise) are real
 * companies the business may genuinely use, and the app has always shown them, so they are NOT hidden here.
 * Recognised by their fixed ids (and the old "fven-" ids), with the two names kept for data saved under other ids.
 */
export const DEMO_FINANCE_VENDOR_IDS: ReadonlySet<string> = new Set([
  '00000000-0000-0000-0001-000000000001', // Apex Facilities & Commercial Cleaning Ltd
  '00000000-0000-0000-0001-000000000006'  // Direct Site Supplies & Maintenance Ltd
]);

const LEGACY_DEMO_NAMES = ['Apex Facilities', 'Direct Site Supplies'];

export function isDemoFinanceVendor(v: { id?: string | null; vendorName?: string | null } | null | undefined): boolean {
  if (!v) return false;
  const id = String(v.id || '');
  if (DEMO_FINANCE_VENDOR_IDS.has(id) || id.startsWith('fven-')) return true;
  const name = String(v.vendorName || '');
  return LEGACY_DEMO_NAMES.some(n => name.includes(n));
}
