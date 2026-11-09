import type { DailyRegisterRecord, DailyRegisterRoom } from '../types';
import { roomKey, roomOccupants, usableCapacity } from './roomAllocation';

/**
 * Interconnecting rooms. A room is either Standard or Interconnecting; interconnecting rooms that
 * open onto each other share an `interconnectGroup` id. A room is in at most one group, a group
 * has 2-6 rooms, and every room in a group is in the same hotel. Pure helpers, shared by the
 * Room List, the allocation pickers and the tests. The database trigger (migration 029) and the
 * API enforce the same rules.
 */

export const ROOM_CATEGORIES = ['Standard', 'Interconnecting'] as const;
export type RoomCategory = (typeof ROOM_CATEGORIES)[number];

export const MIN_GROUP_ROOMS = 2;
export const MAX_GROUP_ROOMS = 6;

/** Who may create, edit or remove interconnecting-room links. Staff can allocate but not configure. */
export const INTERCONNECT_CONFIG_ROLES = ['Super Admin', 'Admin', 'General Manager', 'Area Manager'] as const;
export const canConfigureInterconnecting = (role?: string | null) => (INTERCONNECT_CONFIG_ROLES as readonly string[]).includes(role || '');

type RoomLike = Pick<DailyRegisterRoom, 'id' | 'hotel' | 'roomNo'> & { roomCategory?: string; interconnectGroup?: string };

const same = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

export const groupIdOf = (room: RoomLike) => (room.interconnectGroup || '').trim();
export const isInterconnecting = (room: RoomLike) => room.roomCategory === 'Interconnecting' && !!groupIdOf(room);

/** Every room in the same group and hotel as `room`, including `room` itself. */
export function groupRooms<T extends RoomLike>(rooms: T[], room: RoomLike): T[] {
  const gid = groupIdOf(room);
  if (!gid) return [];
  return rooms.filter(r => same(r.hotel, room.hotel) && groupIdOf(r) === gid);
}

/** The other rooms connected to `room`. */
export function connectedRooms<T extends RoomLike>(rooms: T[], room: RoomLike): T[] {
  return groupRooms(rooms, room).filter(r => r.id !== room.id);
}

/* --------------------------------------------------------------------------------- availability */

export type RoomAvailability = 'Available' | 'Part occupied' | 'Full' | 'Unavailable';

export function freeBeds(room: DailyRegisterRoom, records: DailyRegisterRecord[], excludeRecordId?: string): number {
  return Math.max(0, usableCapacity(room) - roomOccupants(records, room.hotel, room.roomNo, excludeRecordId).length);
}

export function roomAvailability(room: DailyRegisterRoom, records: DailyRegisterRecord[]): RoomAvailability {
  const capacity = usableCapacity(room);
  if (capacity <= 0) return 'Unavailable';
  const occupants = roomOccupants(records, room.hotel, room.roomNo).length;
  if (occupants >= capacity) return 'Full';
  return occupants === 0 ? 'Available' : 'Part occupied';
}

export type GroupAvailability = 'fully' | 'partially' | 'none';

export interface GroupStatus {
  rooms: Array<{ room: DailyRegisterRoom; free: number }>;
  totalFree: number;
  /** fully = every room has a free bed, partially = some do, none = no room has one. */
  availability: GroupAvailability;
}

export function groupStatus(rooms: DailyRegisterRoom[], room: DailyRegisterRoom, records: DailyRegisterRecord[]): GroupStatus {
  const members = groupRooms(rooms, room);
  const detail = members.map(r => ({ room: r, free: freeBeds(r, records) }));
  const withBed = detail.filter(d => d.free > 0).length;
  return {
    rooms: detail,
    totalFree: detail.reduce((n, d) => n + d.free, 0),
    availability: detail.length === 0 || withBed === 0 ? 'none' : withBed === detail.length ? 'fully' : 'partially',
  };
}

export const GROUP_AVAILABILITY_LABEL: Record<GroupAvailability, string> = {
  fully: 'Fully available',
  partially: 'Partially available',
  none: 'No free beds',
};

/* ------------------------------------------------------------------------------- configuration */

export const newGroupId = () => `ic-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface RoomChange { id: string; changes: { roomCategory: RoomCategory; interconnectGroup: string } }

export type GroupPlan = { ok: true; groupId: string; updates: RoomChange[] } | { ok: false; error: string };

/**
 * Plan saving a group made of `selectedIds`. `editingGroupId` is set when an existing group is being
 * edited: rooms that were in it but are no longer selected go back to Standard. Nothing is changed
 * here; the caller applies `updates`.
 */
export function planGroupSave(rooms: DailyRegisterRoom[], selectedIds: string[], editingGroupId?: string): GroupPlan {
  const ids = Array.from(new Set(selectedIds));
  if (ids.length !== selectedIds.length) return { ok: false, error: 'A room can only be listed once in a group.' };
  if (ids.length < MIN_GROUP_ROOMS) return { ok: false, error: `Choose at least ${MIN_GROUP_ROOMS} rooms to connect.` };
  if (ids.length > MAX_GROUP_ROOMS) return { ok: false, error: `A group can connect at most ${MAX_GROUP_ROOMS} rooms.` };

  const chosen = ids.map(id => rooms.find(r => r.id === id));
  if (chosen.some(r => !r)) return { ok: false, error: 'One of the chosen rooms no longer exists. Reload and try again.' };
  const picked = chosen as DailyRegisterRoom[];

  const hotels = new Set(picked.map(r => (r.hotel || '').trim().toLowerCase()));
  if (hotels.size > 1) return { ok: false, error: 'Interconnecting rooms must be in the same property.' };

  const nums = new Set(picked.map(r => roomKey(r.hotel, r.roomNo)));
  if (nums.size !== picked.length) return { ok: false, error: 'The same room number cannot be connected twice.' };

  const conflict = picked.find(r => groupIdOf(r) && groupIdOf(r) !== (editingGroupId || ''));
  if (conflict) {
    return { ok: false, error: `Room ${conflict.roomNo} is already connected to another group. Remove it from that group first.` };
  }

  const groupId = editingGroupId || newGroupId();
  const updates: RoomChange[] = picked.map(r => ({ id: r.id, changes: { roomCategory: 'Interconnecting', interconnectGroup: groupId } }));
  if (editingGroupId) {
    const hotel = picked[0].hotel;
    rooms
      .filter(r => same(r.hotel, hotel) && groupIdOf(r) === editingGroupId && !ids.includes(r.id))
      .forEach(r => updates.push({ id: r.id, changes: { roomCategory: 'Standard', interconnectGroup: '' } }));
  }
  return { ok: true, groupId, updates };
}

/** Plan removing every room of a group from it. */
export function planGroupDissolve(rooms: DailyRegisterRoom[], room: RoomLike): RoomChange[] {
  return groupRooms(rooms, room).map(r => ({ id: r.id, changes: { roomCategory: 'Standard' as RoomCategory, interconnectGroup: '' } }));
}

/** Rooms that could still be added to a group in `hotel`: not in any other group. */
export function connectableRooms(rooms: DailyRegisterRoom[], hotel: string, editingGroupId?: string): DailyRegisterRoom[] {
  return rooms
    .filter(r => same(r.hotel, hotel) && (!groupIdOf(r) || groupIdOf(r) === (editingGroupId || '')))
    .sort((a, b) => String(a.roomNo).localeCompare(String(b.roomNo), undefined, { numeric: true }));
}

/* ----------------------------------------------------------------------------- allocation picker */

export interface RoomChoice { value: string; label: string; free: number }

/**
 * Rooms to offer when placing someone at `hotel`: rooms with a free bed, plus the room they are
 * already in. Interconnecting rooms show their connected room numbers and how many of the group's
 * rooms still have a free bed, so staff can see whether a family fits across the group.
 */
export function roomChoices(rooms: DailyRegisterRoom[], records: DailyRegisterRecord[], hotel: string, currentRoomNo = ''): RoomChoice[] {
  const current = currentRoomNo.trim();
  return rooms
    .filter(r => same(r.hotel, hotel))
    .map(room => ({ room, free: freeBeds(room, records) }))
    .filter(({ room, free }) => free > 0 || room.roomNo === current)
    .sort((a, b) => String(a.room.roomNo).localeCompare(String(b.room.roomNo), undefined, { numeric: true }))
    .map(({ room, free }) => {
      let label = `Room ${room.roomNo}${room.floor ? ` · Floor ${room.floor}` : ''} · ${free} bed${free === 1 ? '' : 's'} free`;
      if (isInterconnecting(room)) {
        const status = groupStatus(rooms, room, records);
        const others = status.rooms.filter(d => d.room.id !== room.id);
        const detail = others.map(d => `${d.room.roomNo} (${d.free} free)`).join(', ');
        label += ` · Interconnects with ${detail || 'no other room'} · ${GROUP_AVAILABILITY_LABEL[status.availability].toLowerCase()}`;
      }
      return { value: room.roomNo, label, free };
    });
}
