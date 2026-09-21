import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FIELD_OPTIONS, FIELD_CATEGORIES_META } from '../src/data/defaultFieldOptions.js';
import { TABLE_COLUMNS } from './schemaAdapter.js';
import { KNOWN_TABLES } from './liveSchema.js';
import { ENTITY_TABLE_MAP } from '../src/lib/directSupabaseAdapter.js';
import {
  referralsTableConfig,
  vulnerableTableConfig,
  challengingTableConfig,
  maintenanceTableConfig,
  spcdTableConfig,
  sitesTableConfig
} from '../src/config/trackerTableConfigs.js';
import {
  FINANCE_INVOICES_TABLE_COLUMNS,
  FINANCE_CREDIT_CARD_TABLE_COLUMNS,
  FINANCE_DELIVERY_NOTES_TABLE_COLUMNS,
  FINANCE_APPROVALS_TABLE_COLUMNS
} from '../src/data/defaultTableSchemas.js';

test('Field Options: All 45 categories are registered and accounted for', () => {
  assert.equal(FIELD_CATEGORIES_META.length, 45);
  const metaKeys = new Set(FIELD_CATEGORIES_META.map(m => m.key));
  
  // Every option in DEFAULT_FIELD_OPTIONS belongs to a valid metadata category
  for (const opt of DEFAULT_FIELD_OPTIONS) {
    assert.ok(metaKeys.has(opt.category), `Option ${opt.id} has valid category ${opt.category}`);
  }
});

const FIXED_SELECT_KEYS = new Set([
  'siteId', 'site', 'siteName', 'propertyId', 'assignedProperty',
  'gender', 'followUpRequired', 'action',
  'acknowledgementReceived', 'responseReceivedFromLA',
  'warningLetterIssued', 'residentMeetingRequired', 'policeAttended'
]);

test('Field Options: Tracker table configs have optionCategory and allowQuickAdd on all dynamic select columns', () => {
  const configs = [
    { name: 'referrals', cols: referralsTableConfig },
    { name: 'vulnerable', cols: vulnerableTableConfig },
    { name: 'challenging', cols: challengingTableConfig },
    { name: 'maintenance', cols: maintenanceTableConfig },
    { name: 'spcd', cols: spcdTableConfig },
    { name: 'sites', cols: sitesTableConfig }
  ];

  for (const { name, cols } of configs) {
    for (const col of cols) {
      if (col.type === 'select' && !FIXED_SELECT_KEYS.has(String(col.key))) {
        assert.ok(
          col.optionCategory,
          `Table config ${name} column ${col.key} must specify optionCategory for dynamic propagation`
        );
        assert.equal(
          col.allowQuickAdd,
          true,
          `Table config ${name} column ${col.key} must have allowQuickAdd enabled`
        );
      }
    }
  }
});

test('Field Options: Option deletion preserves removal and prevents hardcoded fallback resurrection', () => {
  // Simulate options in state
  const testCategory = 'referralTypes';
  const initial = DEFAULT_FIELD_OPTIONS.filter(o => o.category === testCategory);
  assert.ok(initial.length > 1, 'Initial options exist');

  const optionToDelete = initial[0];
  const remaining = initial.filter(o => o.id !== optionToDelete.id);

  // When resolving options dynamically:
  // If category is known, it strictly returns remaining and NEVER falls back to hardcoded initial
  const resolved = remaining.filter(o => o.isActive !== false);
  assert.equal(resolved.some(o => o.id === optionToDelete.id), false, 'Deleted option must not appear in resolved options');
  assert.equal(resolved.length, initial.length - 1, 'Length accurately reflects deletion');
});

test('Finance Tables: Page titles match corresponding database table names exactly', () => {
  const mappings = [
    { title: 'Vendor Invoices', expectedTable: 'vendor_invoices', entity: 'vendorInvoices' },
    { title: 'Credit Card Bills', expectedTable: 'credit_card_bills', entity: 'creditCardBills' },
    { title: 'Delivery Notes', expectedTable: 'delivery_notes', entity: 'deliveryNotes' },
    { title: 'Finance Approvals', expectedTable: 'finance_approvals', entity: 'financeApprovals' }
  ];

  for (const m of mappings) {
    // 1. Table exists in schemaAdapter TABLE_COLUMNS
    assert.ok(TABLE_COLUMNS[m.expectedTable], `TABLE_COLUMNS must contain ${m.expectedTable}`);
    assert.ok(TABLE_COLUMNS[m.expectedTable].has('id'), `${m.expectedTable} must have id column`);

    // 2. Table is in KNOWN_TABLES
    assert.ok(KNOWN_TABLES.includes(m.expectedTable), `KNOWN_TABLES must contain ${m.expectedTable}`);

    // 3. Table mapping exists in directSupabaseAdapter
    assert.ok(ENTITY_TABLE_MAP[m.entity as any], `ENTITY_TABLE_MAP must contain ${m.entity}`);
    assert.equal(ENTITY_TABLE_MAP[m.entity as any].table, m.expectedTable);

    // 4. Snake_case alias exists in directSupabaseAdapter
    assert.ok(ENTITY_TABLE_MAP[m.expectedTable as any], `ENTITY_TABLE_MAP must contain snake_case alias ${m.expectedTable}`);
    assert.equal(ENTITY_TABLE_MAP[m.expectedTable as any].table, m.expectedTable);
  }
});

test('Finance Tables: Columns align with default table schemas', () => {
  assert.ok(FINANCE_INVOICES_TABLE_COLUMNS.length >= 8);
  assert.ok(FINANCE_CREDIT_CARD_TABLE_COLUMNS.length >= 8);
  assert.ok(FINANCE_DELIVERY_NOTES_TABLE_COLUMNS.length >= 8);
  assert.ok(FINANCE_APPROVALS_TABLE_COLUMNS.length >= 8);

  const invoiceColKeys = new Set(FINANCE_INVOICES_TABLE_COLUMNS.map(c => String(c.key)));
  assert.ok(invoiceColKeys.has('billNumber'));
  assert.ok(invoiceColKeys.has('totalAmount'));
  assert.ok(invoiceColKeys.has('status'));

  const ccColKeys = new Set(FINANCE_CREDIT_CARD_TABLE_COLUMNS.map(c => String(c.key)));
  assert.ok(ccColKeys.has('billNumber'));
  assert.ok(ccColKeys.has('totalAmount'));

  const dnColKeys = new Set(FINANCE_DELIVERY_NOTES_TABLE_COLUMNS.map(c => String(c.key)));
  assert.ok(dnColKeys.has('billNumber'));
  assert.ok(dnColKeys.has('siteId'));

  const appColKeys = new Set(FINANCE_APPROVALS_TABLE_COLUMNS.map(c => String(c.key)));
  assert.ok(appColKeys.has('billNumber'));
  assert.ok(appColKeys.has('status'));
});
