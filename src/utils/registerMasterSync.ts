import { suPropertyService } from '../services/suPropertyService';
import { isOutOfUse, isPlaceholderRoom } from './roomManagementLogic';
import { roomKey } from './roomAllocation';
import { activePlacementBySu } from './placementSelection';
import type { DailyRegisterRoom, DailyRegisterRecord, NewArrivalRecord } from '../types';

type NewRoom = Omit<DailyRegisterRoom, 'id' | 'createdAt' | 'updatedAt'>;
type NewRecord = Omit<DailyRegisterRecord, 'id' | 'createdAt' | 'updatedAt'>;

export interface RegisterSyncPlan {
  rooms: NewRoom[];
  records: NewRecord[];
  /** Register entries whose room differs from the resident's active placement. */
  recordUpdates: Array<{ id: string; changes: { hotel: string; roomNo: string; floor?: string } }>;
  /** New Arrivals whose room differs from the resident's active placement. */
  arrivalUpdates: Array<{ id: string; changes: { hotel: string; room: string } }>;
}

const norm = (s?: string | null) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Compares the Rooms / Service User master data (properties, rooms, active placements) with the
 * Live Daily Register and returns only what the register is missing, so running it repeatedly is safe.
 */
export async function buildRegisterSyncPlan(
  sites: { id: string; name: string }[],
  registerRooms: DailyRegisterRoom[],
  registerRecords: DailyRegisterRecord[],
  arrivals: NewArrivalRecord[] = []
): Promise<RegisterSyncPlan> {
  const [propsRes, roomsRes, plcRes, suRes] = await Promise.all([
    suPropertyService.getProperties(),
    suPropertyService.getRooms(),
    suPropertyService.getPlacements({ status: 'Active' }),
    suPropertyService.getServiceUsers()
  ]);

  const properties = propsRes.data || [];
  // Auto-generated demo rooms are not real accommodation, so they never reach the register.
  const masterRooms = (roomsRes.data || []).filter(r => !isPlaceholderRoom(r as any));
  // One current placement per resident: the same one every other screen shows.
  const placements = Array.from(activePlacementBySu(plcRes.data || []).values());
  const serviceUsers = suRes.data || [];

  const hotelOf = (propertyId: string, siteId?: string) => {
    const prop = properties.find(p => p.id === propertyId);
    const site = sites.find(s => s.id === (siteId || prop?.siteId));
    return site?.name || prop?.propertyName || '';
  };

  const existingRoomKeys = new Set(registerRooms.map(r => roomKey(r.hotel, r.roomNo)));
  const roomOccupancy = new Map<string, number>();
  placements.forEach(p => roomOccupancy.set(p.roomId, (roomOccupancy.get(p.roomId) || 0) + 1));

  const rooms: NewRoom[] = [];
  const hotelByRoomId = new Map<string, { hotel: string; roomNo: string; floor?: string }>();
  masterRooms.forEach(r => {
    const prop = properties.find(p => p.id === r.propertyId);
    const hotel = hotelOf(r.propertyId, prop?.siteId);
    if (!hotel) return;
    hotelByRoomId.set(r.id, { hotel, roomNo: r.roomNumber, floor: r.floor });
    if (existingRoomKeys.has(roomKey(hotel, r.roomNumber))) return;
    existingRoomKeys.add(roomKey(hotel, r.roomNumber));

    const capacity = Math.max(1, Number(r.capacity) || 1);
    const occupancy = roomOccupancy.get(r.id) || 0;
    const void_ = isOutOfUse(r.status);
    rooms.push({
      hotel,
      roomNo: r.roomNumber,
      floor: r.floor || '',
      roomType: r.roomType || '',
      currentMaxOccupancy: capacity,
      currentOccupancy: occupancy,
      bedspacesAvailable: void_ ? 0 : Math.max(0, capacity - occupancy),
      voidBedspaces: void_ ? capacity : 0,
      voidReason: void_ ? r.status : undefined,
      potentialMaxCapacity: capacity,
      date: new Date().toISOString().slice(0, 10)
    });
  });

  // Register entries follow the placement: add a missing one, or move one that sits in another room
  const activeRecords = registerRecords.filter(r => r.occupied !== 'No');
  const byRef = new Map<string, DailyRegisterRecord>();
  const byName = new Map<string, DailyRegisterRecord>();
  activeRecords.forEach(r => {
    if (norm(r.portRef)) byRef.set(norm(r.portRef), r);
    if (norm(r.name)) byName.set(norm(r.name), r);
  });
  const records: NewRecord[] = [];
  const recordUpdates: RegisterSyncPlan['recordUpdates'] = [];
  const arrivalUpdates: RegisterSyncPlan['arrivalUpdates'] = [];
  const seen = new Set<string>();
  placements.forEach(p => {
    const su = serviceUsers.find(u => u.id === p.suId);
    const loc = hotelByRoomId.get(p.roomId);
    if (!su || !loc) return;
    const name = `${su.firstName} ${su.lastName}`.trim();
    const ref = su.externalReference || su.suReference || '';
    const key = norm(ref) || norm(name);
    if (seen.has(key)) return;
    seen.add(key);

    const existing = (norm(ref) && byRef.get(norm(ref))) || byName.get(norm(name));
    if (existing) {
      if (roomKey(existing.hotel, existing.roomNo) !== roomKey(loc.hotel, loc.roomNo)) {
        recordUpdates.push({ id: existing.id, changes: { hotel: loc.hotel, roomNo: loc.roomNo, floor: loc.floor || undefined } });
      }
    } else {
      const checkIn = (p.startDate || su.arrivalDate || new Date().toISOString()).slice(0, 10);
      records.push({
        hotel: loc.hotel,
        roomNo: loc.roomNo,
        floor: loc.floor || undefined,
        singleBed: 1, doubleBed: 0, singleBunk: 0, doubleBunk: 0, cot: 0,
        portRef: ref,
        name,
        checkInDate: checkIn,
        dob: su.dateOfBirth,
        nationality: su.nationality,
        language: su.preferredLanguage,
        gender: su.gender,
        occupied: 'Yes',
        isVoid: 'No',
        availableToBook: 'No',
        registerDate: checkIn,
        dailyOccupancy: { [checkIn]: 'Occupied' }
      });
    }

    arrivals
      .filter(a => (norm(a.portReference) && norm(a.portReference) === norm(ref)) || (!norm(a.portReference) && norm(a.name) === norm(name)))
      .forEach(a => {
        if (roomKey(a.hotel, a.room) !== roomKey(loc.hotel, loc.roomNo)) {
          arrivalUpdates.push({ id: a.id, changes: { hotel: loc.hotel, room: loc.roomNo } });
        }
      });
  });

  return { rooms, records, recordUpdates, arrivalUpdates };
}
