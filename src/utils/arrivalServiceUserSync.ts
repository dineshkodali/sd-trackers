import { suPropertyService } from '../services/suPropertyService';
import type { ServiceUserMaster } from '../types/masterData';

export interface ArrivalSyncInput {
  portReference?: string;
  name: string;
  dob?: string;
  country?: string;
  language?: string;
  contactNumber?: string;
  email?: string;
  hotel: string;
  room?: string;
  checkInDate?: string;
}

export interface ArrivalSyncResult {
  serviceUser?: ServiceUserMaster;
  created: boolean;
  placed: boolean;
  /** Human-readable problems that did not stop the arrival being saved. */
  warnings: string[];
}

const norm = (s?: string) => (s || '').trim().toLowerCase();

/**
 * Makes sure a newly recorded arrival exists as a Service User and, when a room is given,
 * has an active placement in the Rooms module. Re-running for the same person never duplicates them.
 */
export async function syncArrivalToServiceUser(
  arrival: ArrivalSyncInput,
  sites: { id: string; name: string }[]
): Promise<ArrivalSyncResult> {
  const warnings: string[] = [];
  const parts = arrival.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { created: false, placed: false, warnings: ['Arrival has no name, so no Service User was created.'] };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ') || '-';

  const site = sites.find(s => s.name === arrival.hotel || s.id === arrival.hotel);
  const siteId = site?.id || '';
  if (!siteId) warnings.push(`Site "${arrival.hotel}" was not found, so no room placement was made.`);

  // Resolve property + room by room number within the site
  let propertyId = '';
  let roomId = '';
  if (siteId && arrival.room?.trim()) {
    const props = await suPropertyService.getProperties(siteId);
    for (const prop of props.data || []) {
      const rooms = await suPropertyService.getRooms(prop.id);
      const match = (rooms.data || []).find(r => norm(r.roomNumber) === norm(arrival.room));
      if (match) { propertyId = prop.id; roomId = match.id; break; }
    }
    if (!roomId) warnings.push(`Room ${arrival.room} was not found in the Rooms module for ${arrival.hotel}, so no placement was made.`);
  }

  // Reuse an existing Service User if this person is already registered
  const all = await suPropertyService.getServiceUsers();
  const ref = norm(arrival.portReference);
  const fullName = norm(`${firstName} ${lastName}`);
  let su = (all.data || []).find(u =>
    (ref && norm(u.externalReference) === ref) ||
    (arrival.dob && u.dateOfBirth === arrival.dob && norm(`${u.firstName} ${u.lastName}`) === fullName)
  );
  let created = false;

  const checkIn = arrival.checkInDate || new Date().toISOString().slice(0, 10);
  const placementData = siteId && propertyId && roomId ? {
    siteId, propertyId, roomId,
    startDate: new Date(checkIn).toISOString(),
    notes: 'Created automatically from New Arrivals.'
  } : undefined;

  if (!su) {
    const res = await suPropertyService.createServiceUser({
      firstName, lastName,
      dateOfBirth: arrival.dob || undefined,
      nationality: arrival.country || undefined,
      preferredLanguage: arrival.language || 'English',
      status: 'Active',
      externalReference: arrival.portReference?.trim() || undefined,
      referralDate: checkIn,
      arrivalDate: checkIn,
      siteId: siteId || undefined
    }, { mobile: arrival.contactNumber || '', email: arrival.email || '' }, [], placementData);

    if (!res.success || !res.record) {
      // A failed placement (e.g. room full) must not lose the person: retry without it.
      const retry = await suPropertyService.createServiceUser({
        firstName, lastName,
        dateOfBirth: arrival.dob || undefined,
        nationality: arrival.country || undefined,
        preferredLanguage: arrival.language || 'English',
        status: 'Active',
        externalReference: arrival.portReference?.trim() || undefined,
        referralDate: checkIn, arrivalDate: checkIn,
        siteId: siteId || undefined
      }, { mobile: arrival.contactNumber || '', email: arrival.email || '' }, []);
      if (!retry.success || !retry.record) {
        return { created: false, placed: false, warnings: [...warnings, retry.error || res.error || 'Could not create the Service User.'] };
      }
      if (placementData) warnings.push(res.error || 'Room placement failed.');
      return { serviceUser: retry.record, created: true, placed: false, warnings };
    }
    su = res.record;
    created = true;
    return { serviceUser: su, created, placed: !!placementData, warnings };
  }

  // Existing Service User: place them only if they have no active placement yet
  if (placementData) {
    const active = await suPropertyService.getPlacements({ suId: su.id, status: 'Active' });
    if ((active.data || []).length === 0) {
      const res = await suPropertyService.createPlacement({ suId: su.id, ...placementData, reason: 'New arrival check-in' });
      if (!res.success) { warnings.push(res.error || 'Room placement failed.'); return { serviceUser: su, created, placed: false, warnings }; }
      return { serviceUser: su, created, placed: true, warnings };
    }
    warnings.push(`${arrival.name} is already registered and already has an active room placement.`);
  }
  return { serviceUser: su, created, placed: false, warnings };
}
