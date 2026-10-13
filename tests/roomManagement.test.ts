import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  bedViews,
  canChangeRoomStatus,
  checkStockIssue,
  duplicateRoomNumber,
  expandRoomNumbers,
  freeBeds,
  planKitApplication,
  residentsWithoutBed,
  roomFlags,
  rollupRooms,
  stockLevel,
  suggestedOccupancy,
  validateRoomItem,
} from '../src/utils/roomManagementLogic';
import { INVENTORY_ITEM_SEED, KIT_TEMPLATE_SEED } from '../src/data/roomInventorySeed';
import { ENTITY_REGISTRY, TABLE_PARENT_SCOPE } from '../server/routes/db';
import { TABLE_COLUMNS, FIELD_SPECS, toDatabaseRow, fromDatabaseRow } from '../server/schemaAdapter';
import { MASTER_TABLES, buildInitialMasterData } from '../server/masterDataStore';

const room = (over: Record<string, any> = {}) => ({
  id: 'r1', roomReference: 'ROOM-1', propertyId: 'p1', roomNumber: '101', roomType: 'Twin', capacity: 2,
  status: 'Available', occupancyStatus: 'Available', ...over,
}) as any;
const plc = (over: Record<string, any> = {}) => ({
  id: 'pl1', placementReference: 'PLC-1', suId: 'su1', siteId: 's1', propertyId: 'p1', roomId: 'r1',
  startDate: '2026-10-01', status: 'Active', ...over,
}) as any;
const bed = (over: Record<string, any> = {}) => ({ id: 'b1', propertyId: 'p1', roomId: 'r1', bedLabel: 'A', bedType: 'Single', status: 'Available', ...over }) as any;

describe('Room management — beds and occupancy', () => {
  test('a bed is occupied by the resident whose placement points at it', () => {
    const views = bedViews([bed({ id: 'b2', bedLabel: 'B' }), bed()], [plc({ bedId: 'b1' })]);
    assert.deepEqual(views.map(v => [v.bed.bedLabel, v.state]), [['A', 'Occupied'], ['B', 'Available']]);
    assert.equal(views[0].placement?.suId, 'su1');
  });

  test('completed placements free the bed; out-of-service beds are never free', () => {
    assert.equal(bedViews([bed()], [plc({ bedId: 'b1', status: 'Completed' })])[0].state, 'Available');
    const beds = [bed(), bed({ id: 'b2', bedLabel: 'B', status: 'Out of Service' }), bed({ id: 'b3', bedLabel: 'C' })];
    assert.deepEqual(freeBeds(beds, [plc({ bedId: 'b3' })]).map(b => b.bedLabel), ['A']);
  });

  test('residents without a bed are listed', () => {
    assert.equal(residentsWithoutBed([plc(), plc({ id: 'pl2', bedId: 'b1' }), plc({ id: 'pl3', status: 'Completed' })]).length, 1);
  });

  test('suggested occupancy follows capacity', () => {
    assert.equal(suggestedOccupancy(2, 0), 'Available');
    assert.equal(suggestedOccupancy(2, 1), 'Partially Occupied');
    assert.equal(suggestedOccupancy(2, 2), 'Occupied');
    assert.equal(suggestedOccupancy(2, 3), 'Occupied');
    assert.equal(suggestedOccupancy(0, 1), 'Occupied', 'capacity is at least 1');
  });
});

describe('Room management — room flags', () => {
  const ctx = (over: Record<string, any> = {}) => ({ placements: [], beds: [bed(), bed({ id: 'b2', bedLabel: 'B' })], items: [], issues: [], today: new Date(2026, 9, 13), ...over });
  const codes = (r: any, c: any) => roomFlags(r, c).map(f => f.code);

  test('a tidy room has no flags', () => {
    assert.deepEqual(codes(room(), ctx()), []);
  });

  test('over capacity, blocked-with-residents, urgent issues are the serious ones and sort first', () => {
    const c = ctx({
      placements: [plc(), plc({ id: 'pl2' }), plc({ id: 'pl3' })],
      issues: [{ id: 'i1', status: 'Open', priority: 'Urgent', title: 'Leak' }],
      items: [{ id: 'x', status: 'Missing' }],
    });
    const flags = roomFlags(room({ status: 'Blocked' }), c);
    assert.equal(flags[0].level, 'critical');
    assert.ok(flags.some(f => f.code === 'over_capacity'));
    assert.ok(flags.some(f => f.code === 'void_with_residents'));
    assert.ok(flags.some(f => f.code === 'urgent_issue'));
    assert.ok(flags.some(f => f.code === 'missing_items'));
    const order = flags.map(f => f.level);
    assert.deepEqual(order, [...order].sort((a, b) => ({ critical: 0, warning: 1, info: 2 } as any)[a] - ({ critical: 0, warning: 1, info: 2 } as any)[b]));
  });

  test('closed issues are ignored; overdue inspection and cleaning are flagged', () => {
    assert.deepEqual(codes(room(), ctx({ issues: [{ id: 'i', status: 'Closed', priority: 'Urgent', title: 't' }] })), []);
    const f = codes(room({ nextInspectionDue: '2026-10-01', cleaningStatus: 'Dirty' }), ctx());
    assert.deepEqual(f.sort(), ['inspection_overdue', 'needs_cleaning'].sort());
    assert.deepEqual(codes(room({ nextInspectionDue: '2026-10-20' }), ctx()), []);
  });

  test('bed set-up hints', () => {
    assert.ok(codes(room(), ctx({ beds: [] })).includes('no_beds'));
    assert.ok(codes(room({ capacity: 4 }), ctx()).includes('beds_differ_from_capacity'));
    assert.ok(codes(room(), ctx({ placements: [plc()] })).includes('residents_without_bed'));
  });

  test('an expired block is highlighted for release', () => {
    assert.ok(codes(room({ status: 'Blocked', blockedUntil: '2026-10-01' }), ctx()).includes('block_expired'));
    assert.ok(!codes(room({ status: 'Blocked', blockedUntil: '2026-11-01' }), ctx()).includes('block_expired'));
  });
});

describe('Room management — kits and stock', () => {
  const catalogue = INVENTORY_ITEM_SEED;
  const kit = { items: [{ itemId: 'inv-bedlinen', quantity: 2 }, { itemId: 'inv-towel-set', quantity: 1 }, { itemId: 'inv-tv', quantity: 0 }] };
  const stock = (itemId: string, q: number) => ({ id: `s-${itemId}`, propertyId: 'p1', itemId, quantityOnHand: q }) as any;

  test('a kit issues only what is missing, never more than the stock holds, and reports the shortfall', () => {
    const plan = planKitApplication(
      kit,
      [{ id: 'ri', roomId: 'r1', itemId: 'inv-bedlinen', quantity: 1, status: 'In Room' } as any],
      [stock('inv-bedlinen', 5), stock('inv-towel-set', 0)],
      catalogue,
      true
    );
    assert.equal(plan.length, 2, 'zero-quantity lines are dropped');
    assert.deepEqual(plan[0], { itemId: 'inv-bedlinen', itemName: 'Bed linen set', category: 'Bedding', required: 2, alreadyInRoom: 1, toIssue: 1, available: 5, shortfall: 0 });
    assert.equal(plan[1].toIssue, 0);
    assert.equal(plan[1].shortfall, 1);
  });

  test('missing / damaged items do not count as already in the room', () => {
    const plan = planKitApplication(kit, [{ id: 'ri', roomId: 'r1', itemId: 'inv-towel-set', quantity: 1, status: 'Missing' } as any], [stock('inv-towel-set', 3)], catalogue, true);
    assert.equal(plan.find(l => l.itemId === 'inv-towel-set')!.toIssue, 1);
  });

  test('without taking from stock the kit just records the items', () => {
    const plan = planKitApplication(kit, [], [], catalogue, false);
    assert.deepEqual(plan.map(l => [l.toIssue, l.shortfall]), [[2, 0], [1, 0]]);
  });

  test('stock levels and issue checks', () => {
    assert.equal(stockLevel({ quantityOnHand: 0, minimumLevel: 5 }), 'out');
    assert.equal(stockLevel({ quantityOnHand: 5, minimumLevel: 5 }), 'low');
    assert.equal(stockLevel({ quantityOnHand: 6, minimumLevel: 5 }), 'ok');
    assert.equal(stockLevel({ quantityOnHand: 1, minimumLevel: 0 }), 'ok');
    assert.equal(checkStockIssue({ quantityOnHand: 3 }, 3), null);
    assert.match(checkStockIssue({ quantityOnHand: 3 }, 4)!, /Only 3 in stock/);
    assert.match(checkStockIssue(undefined, 1)!, /not held/);
    for (const bad of [0, -1, 1.5, NaN]) assert.ok(checkStockIssue({ quantityOnHand: 9 }, bad), String(bad));
  });

  test('tracked assets are one at a time and need a serial / tag', () => {
    const tv = INVENTORY_ITEM_SEED.find(i => i.id === 'inv-tv')!;
    assert.match(validateRoomItem(tv, { quantity: 2, serialNumber: 'X' })!, /one at a time/);
    assert.match(validateRoomItem(tv, { quantity: 1 })!, /serial/);
    assert.equal(validateRoomItem(tv, { quantity: 1, serialNumber: 'SN1' }), null);
    assert.equal(validateRoomItem(INVENTORY_ITEM_SEED.find(i => i.id === 'inv-towel-set'), { quantity: 4 }), null);
    assert.ok(validateRoomItem(undefined, { quantity: 0 }));
  });
});

describe('Room management — rooms', () => {
  test('room number ranges', () => {
    assert.deepEqual(expandRoomNumbers('101-104').numbers, ['101', '102', '103', '104']);
    assert.deepEqual(expandRoomNumbers('101, 103, 105-106').numbers, ['101', '103', '105', '106']);
    assert.deepEqual(expandRoomNumbers('A1-A3').numbers, ['A1', 'A2', 'A3']);
    assert.deepEqual(expandRoomNumbers('008-010').numbers, ['008', '009', '010'], 'keeps leading zeros');
    assert.ok(expandRoomNumbers('110-101').error);
    assert.ok(expandRoomNumbers('A1-B3').error);
    assert.ok(expandRoomNumbers('1-500').error);
    assert.match(expandRoomNumbers('101, 101').error!, /twice/);
    assert.deepEqual(expandRoomNumbers('').numbers, []);
  });

  test('duplicate room numbers are caught per property', () => {
    const rooms = [room(), room({ id: 'r2', propertyId: 'p2', roomNumber: '102' })];
    assert.equal(duplicateRoomNumber(rooms, 'p1', ' 101 '), true);
    assert.equal(duplicateRoomNumber(rooms, 'p1', '101', 'r1'), false, 'editing the room itself is fine');
    assert.equal(duplicateRoomNumber(rooms, 'p1', '102'), false, 'other property');
  });

  test('a room with residents cannot be blocked or voided; blocks need a reason', () => {
    assert.match(canChangeRoomStatus('Blocked', 2, 'x')!, /still placed/);
    assert.match(canChangeRoomStatus('Void', 1)!, /still placed/);
    assert.match(canChangeRoomStatus('Under Maintenance', 0, '')!, /reason/);
    assert.equal(canChangeRoomStatus('Under Maintenance', 0, 'Leak'), null);
    assert.equal(canChangeRoomStatus('Available', 3), null);
    assert.equal(canChangeRoomStatus('Void', 0), null);
  });

  test('roll-up counts beds only in rooms that are in use', () => {
    const rooms = [room({ id: 'a', capacity: 2 }), room({ id: 'b', capacity: 2 }), room({ id: 'c', capacity: 4 }), room({ id: 'd', capacity: 3, status: 'Blocked' })];
    const r = rollupRooms(rooms, [plc({ roomId: 'a' }), plc({ id: '2', roomId: 'a' }), plc({ id: '3', roomId: 'b' }), plc({ id: '4', roomId: 'd' })]);
    assert.deepEqual(r, { rooms: 4, beds: 8, residents: 3, available: 1, occupied: 1, partially: 1, outOfUse: 1, occupancyPct: 38 });
  });
});

describe('Room management — database wiring', () => {
  const NEW_TABLES = ['room_beds', 'inventory_items', 'property_inventory_stock', 'room_inventory', 'inventory_movements', 'room_kit_templates', 'room_issues', 'room_activity_log'];
  const sql = fs.readFileSync(path.join(process.cwd(), 'db', 'migrations', '016_room_management.sql'), 'utf8');
  const schema = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');

  test('every new table is created, locked to the server, and also part of the start-up schema', () => {
    for (const t of NEW_TABLES) {
      assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t}\\b`), t);
      assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t}\\b`), `${t} missing from db/schema.sql`);
    }
    assert.match(sql, /REVOKE ALL ON public\.%I FROM anon, authenticated/);
    assert.ok(!/CREATE POLICY[^;]*room_(beds|inventory|issues)/.test(sql), 'no permissive policies');
    assert.ok(schema.indexOf('016 — Room Management') < schema.lastIndexOf("NOTIFY pgrst"), 'schema reloads PostgREST after the new tables');
  });

  test('every new column used by the app exists in the SQL', () => {
    const tableBlock = (t: string) => {
      const m = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t} \\(([\\s\\S]*?)\\n\\);`).exec(sql);
      return m ? m[1] : '';
    };
    for (const t of NEW_TABLES) {
      const body = tableBlock(t);
      assert.ok(body, t);
      for (const [, column] of FIELD_SPECS[t]) {
        assert.match(body, new RegExp(`\\b${column}\\b`), `${t}.${column} is mapped but not in the CREATE TABLE`);
      }
    }
    for (const [, column] of FIELD_SPECS.property_rooms.filter(([, c]) => /bathroom_type|cleaning_status|kit_template_id|blocked_until|void_since|is_family_room/.test(c))) {
      assert.match(sql, new RegExp(`ALTER TABLE public\\.property_rooms ADD COLUMN IF NOT EXISTS ${column}\\b`), column);
    }
    for (const column of ['asset_tag', 'pat_next_due', 'next_service_due', 'purchase_cost']) {
      assert.match(sql, new RegExp(`ALTER TABLE public\\.property_assets ADD COLUMN IF NOT EXISTS ${column}\\b`), column);
    }
    assert.match(sql, /ALTER TABLE public\.placements ADD COLUMN IF NOT EXISTS bed_id/);
  });

  test('the field mapping only uses columns the table is allowed to have', () => {
    for (const t of [...NEW_TABLES, 'property_rooms', 'property_assets', 'placements']) {
      for (const [, column] of FIELD_SPECS[t]) assert.ok(TABLE_COLUMNS[t].has(column), `${t}.${column} not in TABLE_COLUMNS`);
    }
  });

  test('the starter catalogue in the app matches the SQL seed', () => {
    const sqlIds = [...sql.matchAll(/^\s*\('(inv-[a-z0-9-]+)',/gm)].map(m => m[1]);
    assert.deepEqual(INVENTORY_ITEM_SEED.map(i => i.id), sqlIds);
    const sqlKits = [...sql.matchAll(/\('(kit-[a-z]+)',/g)].map(m => m[1]);
    assert.deepEqual(KIT_TEMPLATE_SEED.map(k => k.id), sqlKits);
    for (const kit of KIT_TEMPLATE_SEED) {
      for (const line of kit.items) assert.ok(INVENTORY_ITEM_SEED.some(i => i.id === line.itemId), `${kit.id} uses unknown item ${line.itemId}`);
    }
    assert.equal(new Set(INVENTORY_ITEM_SEED.map(i => i.itemCode)).size, INVENTORY_ITEM_SEED.length, 'item codes are unique');
  });

  test('new entities are registered, site-isolated through their property, and have a local fallback store', () => {
    for (const t of NEW_TABLES) {
      assert.ok(Object.values(ENTITY_REGISTRY).some(d => d.table === t), `${t} not exposed by /api/db`);
      assert.ok(MASTER_TABLES.has(t), `${t} missing from the local fallback store`);
    }
    for (const t of ['room_beds', 'property_inventory_stock', 'room_inventory', 'inventory_movements', 'room_issues', 'room_activity_log']) {
      assert.equal(TABLE_PARENT_SCOPE[t]?.parentTable, 'properties', `${t} must be scoped through its property`);
    }
    assert.equal(ENTITY_REGISTRY.inventoryItems.remove, 'admin');
    const initial = buildInitialMasterData() as any;
    assert.equal(initial.inventory_items.length, INVENTORY_ITEM_SEED.length);
    assert.equal(initial.room_kit_templates.length, 3);
  });

  test('records round-trip through the database mapping, including empty dates', () => {
    const row = toDatabaseRow('property_rooms', { id: 'r1', propertyId: 'p1', roomNumber: '101', nextInspectionDue: '', blockedUntil: '', isAccessible: true, cleaningStatus: 'Dirty' });
    assert.equal(row.next_inspection_due, null);
    assert.equal(row.blocked_until, null);
    assert.equal(row.is_accessible, true);
    assert.equal(row.cleaning_status, 'Dirty');
    const back = fromDatabaseRow('property_rooms', { ...row, data: { id: 'r1', extraCustom: 'kept' } });
    assert.equal((back as any).extraCustom, 'kept');
    const kit = toDatabaseRow('room_kit_templates', { id: 'k1', templateName: 'Kit', items: [{ itemId: 'inv-bed-single', quantity: 1 }] });
    assert.deepEqual(kit.items, [{ itemId: 'inv-bed-single', quantity: 1 }]);
    const asset = toDatabaseRow('property_assets', { id: 'a1', propertyId: 'p', assetName: 'Fridge', warrantyExpiry: '', patNextDue: '', nextServiceDue: '', purchaseCost: '12.5' });
    assert.equal(asset.warranty_expiry, null);
    assert.equal(asset.pat_next_due, null);
    assert.equal(asset.next_service_due, null);
    assert.equal(asset.purchase_cost, 12.5);
    const bedRow = toDatabaseRow('placements', { id: 'p', suId: 's', roomId: 'r', propertyId: 'x', bedId: 'bed-1' });
    assert.equal(bedRow.bed_id, 'bed-1');
  });
});
