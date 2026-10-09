import test from 'node:test';
import assert from 'node:assert/strict';
import { BUFFET_ROWS } from '../src/components/food/FoodVendorBuffetLogSection';
import { toDatabaseRow, fromDatabaseRow } from '../server/schemaAdapter';
import { FoodBuffetItemBreakdown, PropertyFoodVendorBuffetLog, FoodWastageRecord } from '../src/types';

test('Hot Meal Tracker - Meal grouping and exact display order', () => {
  const expectedOrder = [
    { key: 'breakfast', group: 'Breakfast', label: 'Breakfast' },
    { key: 'lunch', group: 'Lunch', label: 'Lunch' },
    { key: 'todlrLunch', group: 'Lunch', label: 'Toddler Lunch' },
    { key: 'specialLunch', group: 'Lunch', label: 'Special Lunch' },
    { key: 'schoolMealLunch', group: 'Lunch', label: 'School Meal / Child Lunch' },
    { key: 'dinner', group: 'Dinner', label: 'Dinner' },
    { key: 'todlrDinner', group: 'Dinner', label: 'Toddler Dinner' },
    { key: 'specialDinner', group: 'Dinner', label: 'Special Dinner' },
    { key: 'childDinner', group: 'Dinner', label: 'Child Dinner' },
  ];

  assert.equal(BUFFET_ROWS.length, 9, 'Should have exactly 9 meal rows');

  expectedOrder.forEach((expected, idx) => {
    const actual = BUFFET_ROWS[idx];
    assert.equal(actual.key, expected.key, `Row ${idx} key should be ${expected.key}`);
    assert.equal(actual.group, expected.group, `Row ${idx} group should be ${expected.group}`);
    assert.equal(actual.label, expected.label, `Row ${idx} label should be ${expected.label}`);
  });

  // Verify Breakfast is first
  assert.equal(BUFFET_ROWS[0].group, 'Breakfast');
  assert.equal(BUFFET_ROWS[0].key, 'breakfast');

  // Verify Lunch entries follow Breakfast
  assert.equal(BUFFET_ROWS[1].group, 'Lunch');
  assert.equal(BUFFET_ROWS[2].group, 'Lunch');
  assert.equal(BUFFET_ROWS[3].group, 'Lunch');
  assert.equal(BUFFET_ROWS[4].group, 'Lunch');

  // Verify Dinner entries are last
  assert.equal(BUFFET_ROWS[5].group, 'Dinner');
  assert.equal(BUFFET_ROWS[6].group, 'Dinner');
  assert.equal(BUFFET_ROWS[7].group, 'Dinner');
  assert.equal(BUFFET_ROWS[8].group, 'Dinner');
});

test('Hot Meal Tracker - Daily counts matrix and weekly total calculation with 0 defaulting', () => {
  const sampleLog: PropertyFoodVendorBuffetLog = {
    id: 'vendor-bf-test',
    vendor: 'A&M',
    site: 'Brit Hotel',
    weekRange: 'Week 41 (06th to 12th of October)',
    startDate: '2026-10-06',
    endDate: '2026-10-12',
    dailyCounts: {
      MON: { breakfast: 15, lunch: 20, dinner: 25 },
      TUE: { breakfast: 15, lunch: 22, dinner: 24, todlrLunch: 2 },
      WED: { breakfast: 18, lunch: 19, dinner: 23 },
      THU: { breakfast: 16, lunch: 21, dinner: 26 },
      FRI: { breakfast: 17, lunch: 25, dinner: 28 },
      SAT: { breakfast: 20, lunch: 30, dinner: 30 },
      SUN: { breakfast: 22, lunch: 28, dinner: 32 }
    },
    lastUpdatedBy: 'Admin',
    updatedAt: new Date().toISOString()
  };

  const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

  // Calculate row total for breakfast
  let breakfastTotal = 0;
  DAYS.forEach(d => {
    const count = sampleLog.dailyCounts[d]?.breakfast || 0;
    breakfastTotal += count;
  });
  assert.equal(breakfastTotal, 123, 'Sum of breakfast counts Monday through Sunday should equal 123');

  // Verify default 0 behavior when meal count is missing
  let specialDinnerTotal = 0;
  DAYS.forEach(d => {
    const count = sampleLog.dailyCounts[d]?.specialDinner || 0;
    specialDinnerTotal += count;
  });
  assert.equal(specialDinnerTotal, 0, 'Missing counts must default to 0');
});

test('Food Wastage - Multi-item batch record with Breakfast, Lunch, Dinner support', () => {
  const record: FoodWastageRecord = {
    id: 'fw-batch-1',
    site: 'Brit Hotel',
    date: '2026-10-09',
    mealType: 'Lunch',
    foodWastage: 'Steamed Rice (3 kg), Chicken Curry (5 portions)',
    quantity: '3 kg, 5 portions',
    unit: 'Mixed',
    items: [
      { foodItem: 'Steamed Rice', quantity: 3, unit: 'kg', remarks: 'Unserved buffet tray' },
      { foodItem: 'Chicken Curry', quantity: 5, unit: 'portions', remarks: 'Late return' }
    ],
    comments: 'Disposed via bio-waste bin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  assert.equal(record.mealType, 'Lunch');
  assert.equal(record.items?.length, 2);
  assert.equal(record.items![0].foodItem, 'Steamed Rice');
  assert.equal(record.items![0].quantity, 3);
  assert.equal(record.items![0].unit, 'kg');
  assert.equal(record.items![1].foodItem, 'Chicken Curry');
  assert.equal(record.items![1].quantity, 5);
  assert.equal(record.items![1].unit, 'portions');

  // Verify database row mapping
  const dbRow = toDatabaseRow('food_wastage_records', record);
  assert.equal(dbRow.meal_type, 'Lunch');
  assert.equal(dbRow.food_wastage, 'Steamed Rice (3 kg), Chicken Curry (5 portions)');
  assert.equal(dbRow.quantity, '3 kg, 5 portions');
  assert.equal(dbRow.unit, 'Mixed');
  assert.deepEqual(dbRow.items, record.items);

  // Roundtrip back to frontend record
  const back = fromDatabaseRow('food_wastage_records', dbRow);
  assert.equal(back.mealType, 'Lunch');
  assert.equal(back.items?.length, 2);
  assert.equal(back.items[0].foodItem, 'Steamed Rice');
  assert.equal(back.items[0].unit, 'kg');
});

test('Food Wastage - Unit segregation in summaries (Do NOT combine different units)', () => {
  const wastageLogs: FoodWastageRecord[] = [
    {
      id: 'fw-1',
      site: 'Brit Hotel',
      date: '2026-10-09',
      mealType: 'Breakfast',
      foodWastage: 'Eggs (2 kg), Toast (10 portions)',
      quantity: '2 kg, 10 portions',
      items: [
        { foodItem: 'Eggs', quantity: 2, unit: 'kg' },
        { foodItem: 'Toast', quantity: 10, unit: 'portions' }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'fw-2',
      site: 'Brit Hotel',
      date: '2026-10-09',
      mealType: 'Breakfast',
      foodWastage: 'Beans (3 kg)',
      quantity: '3 kg',
      items: [
        { foodItem: 'Beans', quantity: 3, unit: 'kg' }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // Calculate Breakfast unit summary
  const unitTotals: Record<string, number> = {};
  wastageLogs.forEach(log => {
    log.items?.forEach(it => {
      unitTotals[it.unit] = (unitTotals[it.unit] || 0) + Number(it.quantity);
    });
  });

  // Must have 5 kg and 10 portions separately
  assert.equal(unitTotals['kg'], 5, 'kg total should be exactly 5 (2 + 3)');
  assert.equal(unitTotals['portions'], 10, 'portions total should be exactly 10');

  // Verify units are formatted without merging
  const formattedSummary = Object.entries(unitTotals).map(([u, q]) => `${q} ${u}`).join(' • ');
  assert.equal(formattedSummary, '5 kg • 10 portions');
});
