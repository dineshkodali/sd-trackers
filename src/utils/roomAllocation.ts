import type { DailyRegisterRecord, DailyRegisterRoom } from '../types';

/**
 * Pure helpers for live-register room allocation. Room numbers repeat across hotels, so every lookup is
 * keyed on hotel + room number. Occupancy is always derived from the register records (single source of truth).
 */

const norm = (v?: string | null) => (v ?? '').toString().trim().toLowerCase();

export const roomKey = (hotel?: string | null, roomNo?: string | null) => `${norm(hotel)}::${norm(roomNo)}`;

export const isActiveOccupant = (r: Pick<DailyRegisterRecord, 'occupied'>) => r.occupied !== 'No';

export function findRegisterRoom(rooms: DailyRegisterRoom[], hotel: string, roomNo: string): DailyRegisterRoom | undefined {
  const key = roomKey(hotel, roomNo);
  return rooms.find(r => roomKey(r.hotel, r.roomNo) === key);
}

export function roomOccupants(records: DailyRegisterRecord[], hotel: string, roomNo: string, excludeRecordId?: string) {
  const key = roomKey(hotel, roomNo);
  return records.filter(r => r.id !== excludeRecordId && isActiveOccupant(r) && roomKey(r.hotel, r.roomNo) === key);
}

/** Usable bed capacity of a register room (max occupancy minus void bedspaces). */
export function usableCapacity(room: Pick<DailyRegisterRoom, 'currentMaxOccupancy' | 'voidBedspaces'>): number {
  return Math.max(0, (Number(room.currentMaxOccupancy) || 0) - (Number(room.voidBedspaces) || 0));
}

export interface AllocationCheck {
  ok: boolean;
  error?: string;
  room?: DailyRegisterRoom;
}

/** Decide whether a person may be placed in hotel/roomNo. Never throws; returns a user-facing reason on failure. */
export function evaluateRegisterAllocation(args: {
  rooms: DailyRegisterRoom[];
  records: DailyRegisterRecord[];
  hotel: string;
  roomNo: string;
  portRef?: string;
  excludeRecordId?: string;
}): AllocationCheck {
  const { rooms, records, hotel, roomNo, portRef, excludeRecordId } = args;
  if (!norm(roomNo)) return { ok: false, error: 'A room number is required.' };

  const room = findRegisterRoom(rooms, hotel, roomNo);
  if (!room) {
    return { ok: false, error: `Room ${roomNo} does not exist at ${hotel}. Add it in the Room List first.` };
  }

  const capacity = usableCapacity(room);
  if (capacity <= 0) {
    return { ok: false, room, error: `Room ${room.roomNo} at ${hotel} has no usable bedspaces${room.voidReason ? ` (${room.voidReason})` : ''}.` };
  }

  const ref = norm(portRef);
  if (ref) {
    const dup = records.find(r => r.id !== excludeRecordId && isActiveOccupant(r) && norm(r.portRef) === ref);
    if (dup) {
      return { ok: false, room, error: `Port Ref ${portRef} is already checked in (${dup.name}, ${dup.hotel} Room ${dup.roomNo}). Move or check them out first.` };
    }
  }

  const occupants = roomOccupants(records, hotel, roomNo, excludeRecordId).length;
  if (occupants >= capacity) {
    return { ok: false, room, error: `Room ${room.roomNo} at ${hotel} is full (${occupants}/${capacity}).` };
  }
  return { ok: true, room };
}

/** Occupancy figures a room should show, derived from the register. */
export function deriveRoomOccupancy(room: DailyRegisterRoom, records: DailyRegisterRecord[]) {
  const occupants = roomOccupants(records, room.hotel, room.roomNo).length;
  return {
    currentOccupancy: occupants,
    bedspacesAvailable: Math.max(0, usableCapacity(room) - occupants)
  };
}
