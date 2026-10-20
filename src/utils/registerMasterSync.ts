import { suPropertyService } from '../services/suPropertyService';
import { isOutOfUse, isPlaceholderRoom } from './roomManagementLogic';
import { roomKey } from './roomAllocation';
import type { DailyRegisterRoom, DailyRegisterRecord } from '../types';

type NewRoom = Omit<DailyRegisterRoom, 'id' | 'createdAt' | 'updatedAt'>;
type NewRecord = Omit<DailyRegisterRecord, 'id' | 'createdAt' | 'updatedAt'>;

export interface RegisterSyncPlan {
  rooms: NewRoom[];
  records: NewRecord[];
}

const norm = (s?: string | null) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Compares the Rooms / Service User master data (properties, rooms, active placements) with the
 * Live Daily Register and returns only what the register is missing, so running it repeatedly is safe.
 */
export async function buildRegisterSyncPlan(
  sites: { id: string; name: string }[],
  registerRooms: DailyRegisterRoom[],
  registerRecords: DailyRegisterRecord[]
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
  const placements = plcRes.data || [];
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

  // Active placements with no matching register entry (by Port Ref, or by name when there is none)
  const refs = new Set(registerRecords.filter(r => r.occupied !== 'No').map(r => norm(r.portRef)).filter(Boolean));
  const names = new Set(registerRecords.filter(r => r.occupied !== 'No').map(r => norm(r.name)).filter(Boolean));
  const records: NewRecord[] = [];
  placements.forEach(p => {
    const su = serviceUsers.find(u => u.id === p.suId);
    const loc = hotelByRoomId.get(p.roomId);
    if (!su || !loc) return;
    const name = `${su.firstName} ${su.lastName}`.trim();
    const ref = su.externalReference || su.suReference || '';
    if ((ref && refs.has(norm(ref))) || names.has(norm(name))) return;
    refs.add(norm(ref));
    names.add(norm(name));

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
  });

  return { rooms, records };
}
