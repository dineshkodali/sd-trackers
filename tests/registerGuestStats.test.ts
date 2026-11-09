import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ageCategoryOf, buildAspenLookup, buildGuests, computeGuestStats, emptyGuestContext, filterRegisterRecords, genderOf,
  isAspenValue, isStayingOn, matchesGuestFilter, NO_GUEST_FILTER, sanitizeGuestFilter, type GuestContext, type GuestFilter,
} from '../src/utils/guestStats';
import {
  canConfigureInterconnecting, connectableRooms, connectedRooms, groupStatus, planGroupDissolve, planGroupSave, roomAvailability, roomChoices,
} from '../src/utils/interconnectingRooms';
import type { DailyRegisterRecord, DailyRegisterRoom } from '../src/types';

const TODAY = '2026-11-09';
let n = 0;
const rec = (over: Partial<DailyRegisterRecord> = {}): DailyRegisterRecord => ({
  id: `r${++n}`, hotel: 'Hotel A', roomNo: '101', singleBed: 1, doubleBed: 0, singleBunk: 0, doubleBunk: 0, cot: 0,
  portRef: `P${n}`, name: `Guest ${n}`, checkInDate: '2026-01-01', occupied: 'Yes', createdAt: '', updatedAt: '', ...over,
} as DailyRegisterRecord);
const room = (over: Partial<DailyRegisterRoom> = {}): DailyRegisterRoom => ({
  id: `m${++n}`, hotel: 'Hotel A', roomNo: String(100 + n), floor: '1', roomType: 'Double', currentMaxOccupancy: 2, currentOccupancy: 0,
  bedspacesAvailable: 2, voidBedspaces: 0, potentialMaxCapacity: 2, createdAt: '', updatedAt: '', ...over,
} as DailyRegisterRoom);
const filter = (over: Partial<GuestFilter>): GuestFilter => ({ ...NO_GUEST_FILTER, ...over });

test('age: DOB wins, then stored age, then age group; boundaries are 17/18 and 64/65', () => {
  assert.equal(ageCategoryOf({ dob: '2009-11-10' }, TODAY), 'child'); // 17 until tomorrow
  assert.equal(ageCategoryOf({ dob: '2008-11-09' }, TODAY), 'adult'); // turns 18 today
  assert.equal(ageCategoryOf({ dob: '1961-11-10' }, TODAY), 'adult'); // 64
  assert.equal(ageCategoryOf({ dob: '1961-11-09' }, TODAY), 'elderly'); // 65 today
  assert.equal(ageCategoryOf({ dob: '15/03/1990' }, TODAY), 'adult', 'day-first dates');
  assert.equal(ageCategoryOf({ dob: 'not a date', age: 9 }, TODAY), 'child', 'bad DOB falls back to stored age');
  assert.equal(ageCategoryOf({ ageGroup: '60+' }, TODAY), 'elderly');
  assert.equal(ageCategoryOf({ ageGroup: '26-40' }, TODAY), 'adult');
  assert.equal(ageCategoryOf({}, TODAY), 'unknown');
  assert.equal(ageCategoryOf({ dob: '2031-01-01' }, TODAY), 'unknown', 'a future DOB is not an age');
});

test('gender is normalised; blank and "not specified" are Unknown, not Other', () => {
  assert.equal(genderOf({ gender: ' Male ' }), 'male');
  assert.equal(genderOf({ gender: 'f' }), 'female');
  assert.equal(genderOf({ gender: 'Non-binary' }), 'other');
  assert.equal(genderOf({ gender: '' }), 'unknown');
  assert.equal(genderOf({ gender: 'Not specified' }), 'unknown');
});

test('aspen: only a recorded card counts; "No", "Pending" and blank do not', () => {
  for (const v of ['Issued', 'Yes', 'AC-1234']) assert.equal(isAspenValue(v), true, v);
  for (const v of ['', ' ', 'No', 'none', 'N/A', 'Pending', 'Not issued', undefined]) assert.equal(isAspenValue(v as any), false, String(v));
});

test('aspen falls back to the New Arrivals entry for the same Port Ref', () => {
  const lookup = buildAspenLookup([{ portReference: ' p1 ', aspenCard: 'Issued' }, { portReference: 'P2', aspenCard: 'No' }]);
  const ctx: GuestContext = { ...emptyGuestContext(), aspenByRef: lookup };
  const guests = buildGuests([rec({ portRef: 'P1' }), rec({ portRef: 'P2' }), rec({ portRef: 'P3', aspenCard: 'AC-9' })], ctx, TODAY);
  assert.deepEqual(guests.map(g => g.aspen), [true, false, true]);
});

test('guests are counted once and only while staying', () => {
  const rows = [
    rec({ portRef: 'A', checkInDate: '2026-01-01', roomNo: '101' }),
    rec({ portRef: 'a ', checkInDate: '2026-06-01', roomNo: '102' }), // same person moved: newest row wins
    rec({ portRef: 'B', occupied: 'No' }),
    rec({ portRef: 'C', checkInDate: '2026-12-01' }), // not arrived yet on TODAY
    rec({ portRef: 'D', dailyOccupancy: { [TODAY]: 'Vacant' } }),
  ];
  const guests = buildGuests(rows, emptyGuestContext(), TODAY);
  assert.deepEqual(guests.map(g => g.record.roomNo), ['102']);
  assert.equal(isStayingOn(rows[3], '2026-12-02'), true);
});

test('family size: family group first, shared room as the fallback, never counted twice', () => {
  const ctx = emptyGuestContext();
  ctx.familyIdByRef.set('p1', 'f1'); ctx.familyIdByRef.set('p2', 'f1'); ctx.familyIdByRef.set('p3', 'f1');
  ctx.familySize.set('f1', 3);
  const rows = [
    rec({ portRef: 'P1', roomNo: '101' }), rec({ portRef: 'P2', roomNo: '101' }), rec({ portRef: 'P3', roomNo: '102' }), // family of 3 across two rooms
    rec({ portRef: 'P4', roomNo: '201' }), rec({ portRef: 'P5', roomNo: '201' }), // no family group: room of 2
    rec({ portRef: 'P6', roomNo: '301' }), // alone
  ];
  const guests = buildGuests(rows, ctx, TODAY);
  assert.deepEqual(guests.map(g => g.familySize), [3, 3, 3, 2, 2, 1]);
  const stats = computeGuestStats(guests);
  assert.equal(stats.total, 6);
  assert.deepEqual(stats.familiesBySize, { '1': 1, '2': 1, '3': 1, '4': 0, '5+': 0 }, 'families, not guests');
  assert.deepEqual(stats.guestsBySize, { '1': 1, '2': 2, '3': 3, '4': 0, '5+': 0 });
});

test('stats add up: gender, age and aspen each cover every guest exactly once', () => {
  const ctx = emptyGuestContext();
  const rows = [
    rec({ gender: 'Male', dob: '2018-01-01' }), rec({ gender: 'Female', dob: '1990-01-01', aspenCard: 'Issued' }),
    rec({ gender: 'Other', dob: '1950-01-01' }), rec({ gender: '' }), rec({ gender: 'Female', age: 40 }),
  ];
  const s = computeGuestStats(buildGuests(rows, ctx, TODAY));
  assert.equal(s.total, 5);
  assert.equal(s.male + s.female + s.other + s.unknownGender, s.total);
  assert.equal(s.child + s.adult + s.elderly + s.unknownAge, s.total);
  assert.equal(s.aspenHolders + s.noAspen, s.total);
  assert.equal(s.otherOrUnspecified, 2);
  assert.deepEqual([s.child, s.adult, s.elderly, s.unknownAge, s.aspenHolders], [1, 2, 1, 1, 1]);
});

test('every card filter returns exactly the guests the card counted', () => {
  const ctx = emptyGuestContext();
  const rows = [
    rec({ gender: 'Male', dob: '2018-01-01', roomNo: '1' }), rec({ gender: 'Female', dob: '2015-01-01', roomNo: '1' }),
    rec({ gender: 'Other', dob: '1950-01-01', roomNo: '2', aspenCard: 'Issued' }), rec({ gender: '', dob: '1985-01-01', roomNo: '3' }),
  ];
  const guests = buildGuests(rows, ctx, TODAY);
  const s = computeGuestStats(guests);
  const count = (f: Partial<GuestFilter>) => guests.filter(g => matchesGuestFilter(g, filter(f))).length;
  assert.equal(count({ gender: 'male' }), s.male);
  assert.equal(count({ gender: 'female' }), s.female);
  assert.equal(count({ gender: 'other_unknown' }), s.otherOrUnspecified);
  assert.equal(count({ age: 'child' }), s.child);
  assert.equal(count({ age: 'adult' }), s.adult);
  assert.equal(count({ age: 'elderly' }), s.elderly);
  assert.equal(count({ aspen: 'yes' }), s.aspenHolders);
  assert.equal(count({ aspen: 'no' }), s.noAspen);
  assert.equal(count({ family: '2' }), s.guestsBySize['2']);
  assert.equal(count({ age: 'custom', ageMin: 5, ageMax: 20 }), 2);
  assert.equal(count({ family: 'custom', familyMin: 2 }), 2);
});

test('filtering register rows leaves everything alone when no filter is set, and drops non-matching rows otherwise', () => {
  const rows = [rec({ gender: 'Male' }), rec({ gender: 'Female' }), rec({ gender: 'Male', occupied: 'No' })];
  assert.equal(filterRegisterRecords(rows, emptyGuestContext(), NO_GUEST_FILTER, TODAY), rows);
  const males = filterRegisterRecords(rows, emptyGuestContext(), filter({ gender: 'male' }), TODAY);
  assert.deepEqual(males.map(r => r.id), [rows[0].id]);
});

test('hand-off filters from storage are sanitised', () => {
  const f = sanitizeGuestFilter({ age: 'martian', gender: 'female', family: '5+', aspen: 'maybe', ageMin: -3, familyMin: 'x' });
  assert.deepEqual(f, { ...NO_GUEST_FILTER, gender: 'female', family: '5+' });
  assert.deepEqual(sanitizeGuestFilter(null), NO_GUEST_FILTER);
});

/* ------------------------------------------------------------------------------ interconnecting rooms */

test('only managers configure interconnecting links; staff can allocate', () => {
  for (const r of ['Super Admin', 'Admin', 'General Manager', 'Area Manager']) assert.equal(canConfigureInterconnecting(r), true, r);
  for (const r of ['Staff', 'Regional Manager', '', undefined]) assert.equal(canConfigureInterconnecting(r as any), false, String(r));
});

test('a group needs 2-6 rooms in one property, none already in another group', () => {
  const a = room({ roomNo: '1' }), b = room({ roomNo: '2' }), c = room({ roomNo: '3', hotel: 'Hotel B' });
  const other = room({ roomNo: '4', roomCategory: 'Interconnecting', interconnectGroup: 'ic-x' });
  const rooms = [a, b, c, other];
  assert.equal((planGroupSave(rooms, [a.id]) as any).ok, false, 'one room');
  assert.match((planGroupSave(rooms, [a.id, c.id]) as any).error, /same property/);
  assert.match((planGroupSave(rooms, [a.id, other.id]) as any).error, /already connected/);
  assert.match((planGroupSave(rooms, [a.id, a.id]) as any).error, /only be listed once/);
  assert.match((planGroupSave(rooms, [a.id, 'nope']) as any).error, /no longer exists/);
  const ok = planGroupSave(rooms, [a.id, b.id]);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.updates.map(u => u.changes.roomCategory), ['Interconnecting', 'Interconnecting']);
});

test('editing a group can add and remove rooms; removed rooms return to Standard', () => {
  const g = 'ic-1';
  const a = room({ roomNo: '1', roomCategory: 'Interconnecting', interconnectGroup: g });
  const b = room({ roomNo: '2', roomCategory: 'Interconnecting', interconnectGroup: g });
  const c = room({ roomNo: '3' });
  const rooms = [a, b, c];
  const plan = planGroupSave(rooms, [b.id, c.id], g);
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.groupId, g);
    const removed = plan.updates.find(u => u.id === a.id)!;
    assert.deepEqual(removed.changes, { roomCategory: 'Standard', interconnectGroup: '' });
  }
  assert.deepEqual(connectableRooms(rooms, 'Hotel A', g).map(r => r.roomNo), ['1', '2', '3']);
  assert.deepEqual(connectableRooms([...rooms, room({ roomNo: '9', interconnectGroup: 'ic-z', roomCategory: 'Interconnecting' })], 'Hotel A').map(r => r.roomNo), ['3']);
  assert.equal(planGroupDissolve(rooms, a).length, 2);
});

test('connected rooms and group availability reflect the register', () => {
  const g = 'ic-1';
  const a = room({ roomNo: '1', roomCategory: 'Interconnecting', interconnectGroup: g, currentMaxOccupancy: 2 });
  const b = room({ roomNo: '2', roomCategory: 'Interconnecting', interconnectGroup: g, currentMaxOccupancy: 2 });
  const other = room({ roomNo: '1', hotel: 'Hotel B', roomCategory: 'Interconnecting', interconnectGroup: g });
  const rooms = [a, b, other];
  assert.deepEqual(connectedRooms(rooms, a).map(r => r.roomNo), ['2'], 'same hotel only');

  let status = groupStatus(rooms, a, []);
  assert.equal(status.availability, 'fully');
  assert.equal(status.totalFree, 4);

  const full = [rec({ roomNo: '1' }), rec({ roomNo: '1' })];
  status = groupStatus(rooms, a, full);
  assert.equal(status.availability, 'partially');
  assert.equal(roomAvailability(a, full), 'Full');
  assert.equal(roomAvailability(b, [rec({ roomNo: '2' })]), 'Part occupied');
  assert.equal(roomAvailability(room({ currentMaxOccupancy: 2, voidBedspaces: 2 }), []), 'Unavailable');

  status = groupStatus(rooms, a, [...full, rec({ roomNo: '2' }), rec({ roomNo: '2' })]);
  assert.equal(status.availability, 'none');
});

test('the allocation picker names connected rooms and hides full rooms, so nobody is double-booked', () => {
  const g = 'ic-1';
  const a = room({ roomNo: '1', roomCategory: 'Interconnecting', interconnectGroup: g });
  const b = room({ roomNo: '2', roomCategory: 'Interconnecting', interconnectGroup: g });
  const c = room({ roomNo: '3' });
  const records = [rec({ roomNo: '2' }), rec({ roomNo: '2' })];
  const choices = roomChoices([a, b, c], records, 'Hotel A');
  assert.deepEqual(choices.map(x => x.value), ['1', '3'], 'room 2 is full');
  assert.match(choices[0].label, /Interconnects with 2 \(0 free\).*partially available/);
  assert.doesNotMatch(choices[1].label, /Interconnects/);
  assert.deepEqual(roomChoices([a, b, c], records, 'Hotel A', '2').map(x => x.value), ['1', '2', '3'], 'the current room stays selectable');
});

test('migration 029 adds only what is needed and enforces the rules in the database', () => {
  const sql = fs.readFileSync('db/migrations/029_register_guest_filters_interconnecting_rooms.sql', 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS aspen_card TEXT/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS room_category TEXT NOT NULL DEFAULT 'Standard'/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS interconnect_group TEXT/);
  assert.match(sql, /CHECK \(room_category IN \('Standard', 'Interconnecting'\)\)/);
  assert.match(sql, /Interconnecting rooms must be in the same property/);
  assert.match(sql, /Only a manager can change interconnecting room links/);
  assert.match(sql, /'Super Admin', 'Admin', 'General Manager', 'Area Manager'/);
  const live = sql.split('-- ROLLBACK')[0];
  assert.ok(!/DROP TABLE|DELETE FROM|TRUNCATE/i.test(live), 'no destructive statements outside the rollback notes');
});
