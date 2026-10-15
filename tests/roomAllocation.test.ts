import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRegisterAllocation, deriveRoomOccupancy, roomKey } from '../src/utils/roomAllocation';
import type { DailyRegisterRecord, DailyRegisterRoom } from '../src/types';

const room = (o: Partial<DailyRegisterRoom>): DailyRegisterRoom => ({
  id: 'r', hotel: 'Brit Hotel', roomNo: '101', floor: '1', roomType: 'Twin', currentMaxOccupancy: 2,
  currentOccupancy: 0, bedspacesAvailable: 2, voidBedspaces: 0, potentialMaxCapacity: 2,
  createdAt: '', updatedAt: '', ...o
});
const rec = (o: Partial<DailyRegisterRecord>): DailyRegisterRecord => ({
  id: 'x', hotel: 'Brit Hotel', roomNo: '101', singleBed: 1, doubleBed: 0, singleBunk: 0, doubleBunk: 0, cot: 0,
  portRef: 'P1', name: 'A', checkInDate: '2026-01-01', occupied: 'Yes', createdAt: '', updatedAt: '', ...o
});

test('register room allocation', async (t) => {
  await t.test('rejects unknown room', () => {
    const r = evaluateRegisterAllocation({ rooms: [room({})], records: [], hotel: 'Brit Hotel', roomNo: '999' });
    assert.equal(r.ok, false);
    assert.match(r.error!, /does not exist/);
  });

  await t.test('allows free bed, rejects when full, respects void bedspaces', () => {
    const rooms = [room({})];
    const one = [rec({ id: '1' })];
    assert.equal(evaluateRegisterAllocation({ rooms, records: one, hotel: 'Brit Hotel', roomNo: ' 101 ', portRef: 'P2' }).ok, true);
    const two = [rec({ id: '1' }), rec({ id: '2', portRef: 'P2' })];
    assert.match(evaluateRegisterAllocation({ rooms, records: two, hotel: 'Brit Hotel', roomNo: '101', portRef: 'P3' }).error!, /full \(2\/2\)/);
    const voided = [room({ voidBedspaces: 1 })];
    assert.match(evaluateRegisterAllocation({ rooms: voided, records: one, hotel: 'Brit Hotel', roomNo: '101', portRef: 'P3' }).error!, /full \(1\/1\)/);
  });

  await t.test('same room number at another hotel does not count', () => {
    const rooms = [room({}), room({ id: 'r2', hotel: 'Other Hotel', currentMaxOccupancy: 1 })];
    const records = [rec({ id: '1', hotel: 'Other Hotel' })];
    assert.equal(evaluateRegisterAllocation({ rooms, records, hotel: 'Brit Hotel', roomNo: '101', portRef: 'P9' }).ok, true);
    assert.equal(evaluateRegisterAllocation({ rooms, records, hotel: 'Other Hotel', roomNo: '101', portRef: 'P9' }).ok, false);
  });

  await t.test('blocks duplicate active port ref but ignores checked-out and the record being edited', () => {
    const rooms = [room({})];
    assert.match(evaluateRegisterAllocation({ rooms, records: [rec({ id: '1' })], hotel: 'Brit Hotel', roomNo: '101', portRef: 'p1' }).error!, /already checked in/);
    assert.equal(evaluateRegisterAllocation({ rooms, records: [rec({ id: '1', occupied: 'No' })], hotel: 'Brit Hotel', roomNo: '101', portRef: 'P1' }).ok, true);
    assert.equal(evaluateRegisterAllocation({ rooms, records: [rec({ id: '1' })], hotel: 'Brit Hotel', roomNo: '101', portRef: 'P1', excludeRecordId: '1' }).ok, true);
  });

  await t.test('derives occupancy', () => {
    const d = deriveRoomOccupancy(room({}), [rec({ id: '1' }), rec({ id: '2', occupied: 'No' })]);
    assert.deepEqual(d, { currentOccupancy: 1, bedspacesAvailable: 1 });
    assert.equal(roomKey('A ', ' 1'), roomKey('a', '1'));
  });
});
