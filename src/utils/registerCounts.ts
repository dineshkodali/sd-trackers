/**
 * Live Daily Register - the headline counts (pure).
 *
 * The register stores a ROW per room and a ROW per person, and old data contains repeats: the same room entered on several
 * dates, the same person on several days. Counting rows therefore over-counts rooms, capacity and occupants (a room
 * showing "4 / 1"). Everything here counts each room once and each person once:
 *   - a room is one (hotel, room number); when it appears more than once the newest row wins
 *   - a person is one guest (Port ref, else name + date of birth) staying on the chosen date (see guestStats.buildGuests)
 *   - capacity of a room = max occupancy minus void bed spaces
 * No row is changed or deleted; duplicates are only ignored and reported.
 */

import type { DailyRegisterRecord, DailyRegisterRoom } from '../types';
import { buildGuests, emptyGuestContext } from './guestStats';
import { roomKey, usableCapacity } from './roomAllocation';

/** One row per room (newest by date, then last update); `duplicates` is how many extra rows were ignored. */
export function dedupeRooms(rooms: DailyRegisterRoom[]): { rooms: DailyRegisterRoom[]; duplicates: number } {
  const best = new Map<string, DailyRegisterRoom>();
  const stamp = (r: DailyRegisterRoom) => `${String(r.date || '').slice(0, 10)}|${String(r.updatedAt || r.createdAt || '')}`;
  for (const r of rooms) {
    const k = roomKey(r.hotel, r.roomNo);
    const cur = best.get(k);
    if (!cur || stamp(r) > stamp(cur)) best.set(k, r);
  }
  return { rooms: [...best.values()], duplicates: rooms.length - best.size };
}

/** Number of people staying in each room on `date`, each person counted once. */
export function roomPresence(records: DailyRegisterRecord[], date?: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const g of buildGuests(records, emptyGuestContext(), date)) {
    const k = roomKey(g.record.hotel, g.record.roomNo);
    out.set(k, (out.get(k) || 0) + 1);
  }
  return out;
}

export interface RoomLine { hotel: string; roomNo: string; present: number; capacity: number; left: number }

export interface RegisterOverview {
  /** unique rooms */
  rooms: number;
  /** unique rooms with no usable beds (fully void) */
  voidRooms: number;
  /** usable beds in all rooms */
  capacity: number;
  /** people staying on the date (each once) */
  present: number;
  /** of those, people whose room is not in the room list */
  notInRoomList: number;
  /** beds still free (never negative) */
  bedsLeft: number;
  /** nothing left to give out */
  isFull: boolean;
  fullRooms: RoomLine[];
  roomsWithSpace: RoomLine[];
  emptyRooms: number;
  overCapacityRooms: RoomLine[];
  /** extra register rows for the same room that were ignored */
  duplicateRoomRows: number;
}

export function registerOverview(roomRows: DailyRegisterRoom[], records: DailyRegisterRecord[], date?: string): RegisterOverview {
  const { rooms, duplicates } = dedupeRooms(roomRows);
  const presence = roomPresence(records, date);
  const known = new Set<string>();
  const full: RoomLine[] = []; const space: RoomLine[] = []; const over: RoomLine[] = [];
  let capacity = 0; let voidRooms = 0; let emptyRooms = 0; let bedsLeft = 0; let inListed = 0;

  for (const r of rooms) {
    const k = roomKey(r.hotel, r.roomNo);
    known.add(k);
    const present = presence.get(k) || 0;
    inListed += present;
    const cap = usableCapacity(r);
    if (cap === 0) { voidRooms++; continue; }
    capacity += cap;
    const line: RoomLine = { hotel: r.hotel, roomNo: r.roomNo, present, capacity: cap, left: Math.max(0, cap - present) };
    bedsLeft += line.left;
    if (present === 0) emptyRooms++;
    if (present > cap) over.push(line);
    if (present >= cap) full.push(line); else space.push(line);
  }
  let present = 0;
  for (const n of presence.values()) present += n;
  const byRoomNo = (a: RoomLine, b: RoomLine) => a.hotel.localeCompare(b.hotel) || a.roomNo.localeCompare(b.roomNo, undefined, { numeric: true });
  return {
    rooms: rooms.length, voidRooms, capacity, present, notInRoomList: present - inListed, bedsLeft,
    isFull: capacity > 0 && bedsLeft === 0,
    fullRooms: full.sort(byRoomNo), roomsWithSpace: space.sort(byRoomNo), emptyRooms, overCapacityRooms: over.sort(byRoomNo),
    duplicateRoomRows: duplicates
  };
}
