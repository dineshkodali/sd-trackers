import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildModuleRegistry, changedFields, updateMatchesTrigger, genericEventCode, genericRuleId,
  LEGACY_CREATED_RULES, NOTIFICATION_EXCLUDED_TABLES
} from '../server/notificationRegistry.ts';
import { ENTITY_REGISTRY } from '../server/routes/db.ts';
import { TABLE_COLUMNS } from '../server/schemaAdapter.ts';

test('modules are discovered from the entity registry: one per table, no aliases, no system or history tables', () => {
  const mods = buildModuleRegistry(ENTITY_REGISTRY as any, TABLE_COLUMNS as any);
  const tables = mods.map(m => m.table);
  assert.equal(new Set(tables).size, tables.length, 'one module per table');
  for (const t of ['maintenance_records', 'compliance_records', 'new_arrivals_records', 'rfa_welfare_checks', 'public_transport_records', 'room_checks']) {
    assert.ok(tables.includes(t), `${t} should be a module`);
  }
  for (const t of NOTIFICATION_EXCLUDED_TABLES) assert.ok(!tables.includes(t), `${t} must not be a module`);
  assert.ok(!tables.includes('audit_trails') && !tables.includes('email_notification_rules'));
  // Pages that exist only as an API alias are not listed twice
  assert.equal(tables.filter(t => t === 'ir_records').length, 1);
});

test('a module with a hand-written "created" rule reuses it, so there is one New Record switch and no duplicate email', () => {
  const tables = buildModuleRegistry(ENTITY_REGISTRY as any, TABLE_COLUMNS as any).map(m => m.table);
  for (const t of Object.keys(LEGACY_CREATED_RULES)) assert.ok(tables.includes(t), `${t} has a legacy created rule but is not a module`);
  assert.equal(LEGACY_CREATED_RULES.maintenance_records, 'maintenance.created');
  assert.equal(genericEventCode('room_checks', 'created'), 'record.room_checks.created');
  assert.equal(genericRuleId('room_checks', 'updated'), 'rule-rec-room_checks-updated');
});

test('update detection ignores technical fields and honours the selected trigger fields', () => {
  const before = { id: 'm1', status: 'Open', priority: 'CAT 3', updatedAt: '2026-01-01', description: 'leak' };
  const incoming = { ...before, status: 'Completed', updatedAt: '2026-02-02', updatedBy: 'x' };
  assert.deepEqual(changedFields(before, incoming), ['status']);
  assert.deepEqual(changedFields(before, { ...before, updatedAt: '2030-01-01' }), [], 'a timestamp alone is not a change');
  assert.equal(updateMatchesTrigger([], []), false, 'nothing changed: no email');
  assert.equal(updateMatchesTrigger(['status'], []), true, 'no fields selected: any meaningful change');
  assert.equal(updateMatchesTrigger(['description'], ['status', 'priority']), false);
  assert.equal(updateMatchesTrigger(['priority', 'description'], ['status', 'priority']), true);
});
