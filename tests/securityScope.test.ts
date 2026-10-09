import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTITY_REGISTRY, TABLE_SITE_COLUMN, TABLE_PARENT_SCOPE } from '../server/routes/db.js';
import { TABLE_COLUMNS } from '../server/schemaAdapter.js';
import { resolveTemplateAsset } from '../server/routes/templateAssets.js';

/**
 * Tables that are deliberately visible to every signed-in user: configuration,
 * reference data and the staff directory. Adding a table here is a security
 * decision - site data belongs in TABLE_SITE_COLUMN or TABLE_PARENT_SCOPE.
 */
const GLOBAL_TABLES = new Set([
  'app_settings', 'email_notification_rules', 'field_options', 'finance_vendors',
  'ho_report_templates', 'profiles', 'property_user_assignments', 'role_permissions',
  'table_schemas', 'user_groups',
]);

test('every entity exposed by /api/db is site-scoped, parent-scoped, admin-only or declared global', () => {
  const unscoped = Object.entries(ENTITY_REGISTRY)
    .filter(([, def]) => def.read !== 'admin')
    .map(([, def]) => def.table)
    .filter(table => !TABLE_SITE_COLUMN[table] && !TABLE_PARENT_SCOPE[table] && !GLOBAL_TABLES.has(table));
  assert.deepEqual([...new Set(unscoped)], [], `tables readable across sites: ${unscoped.join(', ')}`);
});

test('parent-scoped tables point at a site-scoped parent through a real column', () => {
  for (const [child, scope] of Object.entries(TABLE_PARENT_SCOPE)) {
    assert.ok(TABLE_SITE_COLUMN[scope.parentTable], `${child}: parent ${scope.parentTable} is not site-scoped`);
    const columns = TABLE_COLUMNS[child];
    if (columns) assert.ok(columns.has(scope.linkColumn), `${child}: link column ${scope.linkColumn} is not a known column`);
  }
});

test('service-user and property child tables are parent-scoped', () => {
  for (const table of [
    'service_user_contacts', 'service_user_household', 'service_user_support', 'service_user_documents',
    'property_rooms', 'property_facilities', 'property_assets', 'property_compliance', 'property_documents', 'property_contacts',
  ]) {
    assert.ok(TABLE_PARENT_SCOPE[table], `${table} must be scoped through its parent`);
  }
});

test('document generator only reads files inside public/templates', () => {
  assert.equal(resolveTemplateAsset('/templates/../../.env'), null);
  assert.equal(resolveTemplateAsset('/templates/../../server/index.ts'), null);
  assert.equal(resolveTemplateAsset('/templates/'), null);
  assert.notEqual(resolveTemplateAsset('/templates/incident/image1.png'), null);
});
