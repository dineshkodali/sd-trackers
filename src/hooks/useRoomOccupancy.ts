/**
 * useRoomOccupancy — real occupancy per site, calculated from the property master data:
 * the Capacity (beds) of every room that is in use, and the active placements in those rooms.
 * No typed capacity, default or placeholder figure is ever used (see propertyOccupancy).
 */

import { useEffect, useState } from 'react';
import { suPropertyService } from '../services/suPropertyService';
import { propertyOccupancy, type PropertyOccupancy } from '../utils/roomManagementLogic';

export interface SiteOccupancy {
  /** site id -> occupancy across every property of that site */
  bySite: Map<string, PropertyOccupancy>;
  /** master property id -> occupancy */
  byProperty: Map<string, PropertyOccupancy>;
  loaded: boolean;
}

const EMPTY: SiteOccupancy = { bySite: new Map(), byProperty: new Map(), loaded: false };

// one shared fetch for every component that asks within a few seconds
let inflight: { at: number; promise: Promise<SiteOccupancy> } | null = null;

async function fetchOccupancy(): Promise<SiteOccupancy> {
  const [props, rooms, plcs] = await Promise.all([
    suPropertyService.getProperties(),
    suPropertyService.getRooms(),
    suPropertyService.getPlacements({ status: 'Active' }),
  ]);
  const bySite = new Map<string, PropertyOccupancy>();
  const byProperty = new Map<string, PropertyOccupancy>();
  const propsBySite = new Map<string, string[]>();
  for (const p of props.data || []) {
    byProperty.set(p.id, propertyOccupancy((rooms.data || []).filter(r => r.propertyId === p.id), (plcs.data || []).filter(x => x.propertyId === p.id)));
    if (p.siteId) propsBySite.set(p.siteId, [...(propsBySite.get(p.siteId) || []), p.id]);
  }
  for (const [siteId, ids] of propsBySite) {
    const set = new Set(ids);
    bySite.set(siteId, propertyOccupancy((rooms.data || []).filter(r => set.has(r.propertyId)), (plcs.data || []).filter(x => set.has(x.propertyId))));
  }
  return { bySite, byProperty, loaded: props.success && rooms.success };
}

export function loadRoomOccupancy(force = false): Promise<SiteOccupancy> {
  if (!force && inflight && Date.now() - inflight.at < 5000) return inflight.promise;
  const promise = fetchOccupancy().catch(() => EMPTY);
  inflight = { at: Date.now(), promise };
  return promise;
}

export function useRoomOccupancy(): SiteOccupancy {
  const [state, setState] = useState<SiteOccupancy>(EMPTY);
  useEffect(() => {
    let alive = true;
    const run = (force: boolean) => loadRoomOccupancy(force).then(s => { if (alive) setState(s); });
    void run(false);
    const h = () => { void run(true); };
    window.addEventListener('sdtracker:masterDataUpdated', h);
    return () => { alive = false; window.removeEventListener('sdtracker:masterDataUpdated', h); };
  }, []);
  return state;
}
