import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeRooms, roomPresence, registerOverview } from '../src/utils/registerCounts.ts';

const room = (o: Record<string, any>): any => ({ id: `r-${Math.random()}`, hotel: 'Clacton', roomNo: '101', currentMaxOccupancy: 2, voidBedspaces: 0, date: '2026-10-20', ...o });
const guest = (o: Record<string, any>): any => ({ id: `g-${Math.random()}`, hotel: 'Clacton', roomNo: '101', name: 'A', portRef: 'P1', occupied: 'Yes', checkInDate: '2026-10-01', ...o });
const D = '2026-11-21';

test('the same room entered on several dates is one room (newest row wins)', () => {
  const r = dedupeRooms([room({ date: '2026-10-20', currentMaxOccupancy: 1 }), room({ date: '2026-11-16', currentMaxOccupancy: 3 }), room({ date: '2026-11-13' }), room({ roomNo: '102' })]);
  assert.equal(r.rooms.length, 2);
  assert.equal(r.duplicates, 2);
  assert.equal(r.rooms.find(x => x.roomNo === '101')!.currentMaxOccupancy, 3);
});

test('a person repeated across rows counts once in a room', () => {
  const p = roomPresence([guest({}), guest({ id: 'dup', checkInDate: '2026-11-01' }), guest({ portRef: 'P2', name: 'B' }), guest({ portRef: 'P3', name: 'C', occupied: 'No' })], D);
  assert.equal(p.get('clacton::101'), 2);          // P1 once (not twice), P2; P3 has left
});

test('headline counts: present, beds, beds left, full and spare rooms', () => {
  const o = registerOverview(
    [room({ roomNo: '101', currentMaxOccupancy: 2 }), room({ roomNo: '102', currentMaxOccupancy: 2 }), room({ roomNo: '103', currentMaxOccupancy: 1 }), room({ roomNo: '104', currentMaxOccupancy: 2, voidBedspaces: 2 }), room({ roomNo: '101', date: '2026-11-01' })],
    [guest({ portRef: 'P1' }), guest({ portRef: 'P2', name: 'B' }), guest({ roomNo: '102', portRef: 'P3', name: 'C' }), guest({ roomNo: '999', portRef: 'P4', name: 'D' })],
    D
  );
  assert.equal(o.rooms, 4);                          // 101 once, not twice
  assert.equal(o.duplicateRoomRows, 1);
  assert.equal(o.voidRooms, 1);                      // 104 has no usable bed
  assert.equal(o.capacity, 5);                       // 2 + 2 + 1
  assert.equal(o.present, 4);
  assert.equal(o.notInRoomList, 1);                  // the person in room 999
  assert.equal(o.bedsLeft, 2);                       // 102 has 1 left, 103 has 1 left
  assert.equal(o.isFull, false);
  assert.deepEqual(o.fullRooms.map(r => r.roomNo), ['101']);
  assert.deepEqual(o.roomsWithSpace.map(r => `${r.roomNo}:${r.left}`), ['102:1', '103:1']);
  assert.equal(o.emptyRooms, 1);                     // 103
});

test('a full house says so, and over-capacity rooms are reported rather than hidden', () => {
  const o = registerOverview([room({ roomNo: '1', currentMaxOccupancy: 1 })], [guest({ roomNo: '1', portRef: 'P1' }), guest({ roomNo: '1', portRef: 'P2', name: 'B' })], D);
  assert.equal(o.isFull, true);
  assert.equal(o.bedsLeft, 0);                       // never negative
  assert.deepEqual(o.overCapacityRooms.map(r => r.present), [2]);
  assert.equal(registerOverview([], [], D).isFull, false);   // no rooms is not "full"
});

test('the chosen date decides who is present', () => {
  const rooms = [room({})];
  const recs = [guest({ checkInDate: '2026-11-25' })];
  assert.equal(registerOverview(rooms, recs, '2026-11-21').present, 0);
  assert.equal(registerOverview(rooms, recs, '2026-11-26').present, 1);
});
