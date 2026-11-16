import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { suPropertyService } from '../services/suPropertyService';
import type { PropertyMaster, PropertyRoom } from '../types/masterData';

export interface SiteRoomOption {
  /** Room number saved into the form. */
  value: string;
  label: string;
  /** House / property the room belongs to; used to group rooms when a site has several. */
  propertyName: string;
}

interface RoomDirectory {
  properties: PropertyMaster[];
  rooms: PropertyRoom[];
}

let cached: { at: number; promise: Promise<RoomDirectory> } | null = null;

/** One shared fetch of properties and rooms for every form that opens within 30 seconds. */
function loadRoomDirectory(): Promise<RoomDirectory> {
  if (cached && Date.now() - cached.at < 30000) return cached.promise;
  const promise = Promise.all([suPropertyService.getProperties(), suPropertyService.getRooms()])
    .then(([properties, rooms]) => ({ properties: properties.data || [], rooms: rooms.data || [] }))
    .catch(() => ({ properties: [], rooms: [] }));
  cached = { at: Date.now(), promise };
  return promise;
}

/**
 * Rooms registered for a site or property name, so Room No fields can offer a dropdown.
 * Returns an empty list when the site has no rooms on record, and the field stays free text.
 */
export function useSiteRooms(siteOrPropertyName: string): SiteRoomOption[] {
  const { sites } = useApp();
  const [directory, setDirectory] = useState<RoomDirectory | null>(null);

  useEffect(() => {
    if (!siteOrPropertyName) return;
    let active = true;
    loadRoomDirectory().then(result => { if (active) setDirectory(result); });
    return () => { active = false; };
  }, [siteOrPropertyName]);

  if (!directory || !siteOrPropertyName) return [];

  const wanted = siteOrPropertyName.trim().toLowerCase();
  const site = sites.find(s => s.id === siteOrPropertyName || s.name.trim().toLowerCase() === wanted);
  const siteProperties = directory.properties.filter(property =>
    (site && property.siteId === site.id) ||
    property.id === siteOrPropertyName ||
    property.propertyName?.trim().toLowerCase() === wanted
  );
  const propertyById = new Map(siteProperties.map(property => [property.id, property]));

  return directory.rooms
    .filter(room => propertyById.has(room.propertyId) && room.roomNumber)
    .map(room => ({
      value: room.roomNumber,
      label: room.roomName ? `${room.roomNumber} — ${room.roomName}` : room.roomNumber,
      propertyName: propertyById.get(room.propertyId)!.propertyName,
    }))
    .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
}
