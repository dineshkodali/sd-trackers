/**
 * Loads everything one room needs (beds, items, issues, timeline, assets, residents, stock, catalogue, kits)
 * and exposes a `reload()` the tabs call after any change.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { suPropertyService } from '../../services/suPropertyService';
import { roomManagementService } from '../../services/roomManagementService';
import type { Placement, PropertyAsset, PropertyRoom, ServiceUserMaster } from '../../types/masterData';
import type {
  InventoryItem,
  PropertyStock,
  RoomActivity,
  RoomBed,
  RoomIssue,
  RoomItem,
  RoomKitTemplate,
} from '../../types/roomManagement';

export interface RoomData {
  loading: boolean;
  error: string | null;
  placements: Placement[]; // every placement the room has had
  beds: RoomBed[];
  items: RoomItem[];
  issues: RoomIssue[];
  activity: RoomActivity[];
  assets: PropertyAsset[];
  stock: PropertyStock[];
  catalogue: InventoryItem[];
  catalogueIsStarter: boolean;
  kits: RoomKitTemplate[];
  suById: Map<string, ServiceUserMaster>;
  siblingItems: RoomItem[]; // items in the other rooms of the property (for merging on transfer)
  reload: () => Promise<void>;
}

export function useRoomData(room: PropertyRoom): RoomData {
  const [state, setState] = useState<Omit<RoomData, 'reload'>>({
    loading: true, error: null, placements: [], beds: [], items: [], issues: [], activity: [], assets: [], stock: [],
    catalogue: [], catalogueIsStarter: false, kits: [], suById: new Map(), siblingItems: [],
  });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const reload = useCallback(async () => {
    try {
      const [plc, beds, items, issues, activity, assets, stock, cat, kits, sus, propItems] = await Promise.all([
        suPropertyService.getPlacements({ roomId: room.id }),
        roomManagementService.getBeds({ roomId: room.id }),
        roomManagementService.getRoomItems({ roomId: room.id }),
        roomManagementService.getIssues({ roomId: room.id }),
        roomManagementService.getActivity({ roomId: room.id }),
        roomManagementService.getRoomAssets(room.propertyId, room.id),
        roomManagementService.getStock(room.propertyId),
        roomManagementService.getCatalogue(),
        roomManagementService.getKits(),
        suPropertyService.getServiceUsers(),
        roomManagementService.getRoomItems({ propertyId: room.propertyId }),
      ]);
      if (!alive.current) return;
      const firstError = [plc, beds, items, issues, activity, assets, stock].find(r => !r.success)?.error || null;
      setState({
        loading: false,
        error: firstError,
        placements: plc.data || [],
        beds: beds.data,
        items: items.data,
        issues: issues.data,
        activity: activity.data,
        assets: assets.data,
        stock: stock.data,
        catalogue: cat.data,
        catalogueIsStarter: cat.isStarter,
        kits: kits.data,
        suById: new Map((sus.data || []).map(s => [s.id, s])),
        siblingItems: propItems.data.filter(i => i.roomId !== room.id),
      });
    } catch (e: any) {
      if (alive.current) setState(s => ({ ...s, loading: false, error: e?.message || 'Could not load the room.' }));
    }
  }, [room.id, room.propertyId]);

  useEffect(() => { setState(s => ({ ...s, loading: true })); void reload(); }, [reload]);

  return { ...state, reload };
}

/** "Name (SU-000123)" for a placement's resident. */
export function residentName(su: ServiceUserMaster | undefined, fallbackId?: string): string {
  if (!su) return fallbackId ? `Resident ${fallbackId.slice(0, 8)}` : 'Unknown resident';
  const name = [su.firstName, su.lastName].filter(Boolean).join(' ').trim() || su.preferredName || 'Unnamed';
  return su.suReference ? `${name} (${su.suReference})` : name;
}
