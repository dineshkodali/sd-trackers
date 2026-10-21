import test from 'node:test';
import assert from 'node:assert/strict';
import { pickActivePlacement, activePlacementBySu, supersededActivePlacements } from '../src/utils/placementSelection.ts';

const plc = (id: string, suId: string, roomId: string, startDate: string, status: any = 'Active'): any => ({
  id, suId, roomId, startDate, status, siteId: 's', propertyId: 'p', placementReference: id
});

test('the newest active placement is the current one', () => {
  const list = [plc('a', 'su1', 'r1', '2026-10-01'), plc('b', 'su1', 'r2', '2026-10-05')];
  assert.equal(pickActivePlacement(list)?.id, 'b');
  assert.equal(activePlacementBySu(list).get('su1')?.roomId, 'r2');
});

test('completed placements are ignored', () => {
  const list = [plc('a', 'su1', 'r1', '2026-10-09', 'Completed'), plc('b', 'su1', 'r2', '2026-10-05')];
  assert.equal(pickActivePlacement(list)?.id, 'b');
});

test('superseded active placements are the older ones only', () => {
  const list = [plc('a', 'su1', 'r1', '2026-10-01'), plc('b', 'su1', 'r2', '2026-10-05'), plc('c', 'su2', 'r3', '2026-10-02')];
  assert.deepEqual(supersededActivePlacements(list).map(p => p.id), ['a']);
});

test('the answer does not depend on the order of the list', () => {
  const a = plc('a', 'su1', 'r1', '2026-10-01');
  const b = plc('b', 'su1', 'r2', '2026-10-05');
  assert.equal(pickActivePlacement([a, b])?.id, pickActivePlacement([b, a])?.id);
});

test('a room change made later wins even when its start date was left at the old placement date', () => {
  const oldOne = { ...plc('old', 'su1', 'r1', '2026-10-01'), createdAt: '2026-10-01T09:00:00Z' };
  const moved = { ...plc('new', 'su1', 'r2', '2026-10-01'), createdAt: '2026-10-21T09:00:00Z' };
  assert.equal(pickActivePlacement([oldOne, moved])?.id, 'new');
  const keptStartOlder = { ...plc('new2', 'su1', 'r3', '2025-02-08'), createdAt: '2026-10-22T09:00:00Z' };
  assert.equal(pickActivePlacement([oldOne, keptStartOlder])?.id, 'new2');
});
