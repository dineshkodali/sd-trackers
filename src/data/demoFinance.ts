/**
 * Sample suppliers that migration 004 used to insert into every database (and the older file store used to carry).
 * They are not real suppliers, so they are never offered in supplier lists or filters. They are recognised by their
 * fixed ids, so a real supplier that happens to share a name (for example Brakes) is never hidden.
 */
export const DEMO_FINANCE_VENDOR_IDS: ReadonlySet<string> = new Set([
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0001-000000000002',
  '00000000-0000-0000-0001-000000000003',
  '00000000-0000-0000-0001-000000000004',
  '00000000-0000-0000-0001-000000000005',
  '00000000-0000-0000-0001-000000000006'
]);

/** The two sample suppliers earlier versions already hid by name (they also appear under other ids in old data). */
const LEGACY_DEMO_NAMES = ['Apex Facilities', 'Direct Site Supplies'];

export function isDemoFinanceVendor(v: { id?: string | null; vendorName?: string | null } | null | undefined): boolean {
  if (!v) return false;
  const id = String(v.id || '');
  if (DEMO_FINANCE_VENDOR_IDS.has(id) || id.startsWith('fven-')) return true;
  const name = String(v.vendorName || '');
  return LEGACY_DEMO_NAMES.some(n => name.includes(n));
}
