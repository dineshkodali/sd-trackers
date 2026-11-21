import { useCallback, useEffect, useRef, useState } from 'react';
import { suPropertyService } from '../services/suPropertyService';
import { suTrackerService, type AbsenceFollowUp, type PeepPlan } from '../services/suTrackerService';
import { roomManagementService } from '../services/roomManagementService';
import { useApp } from '../context/AppContext';
import { readProfileCache, writeProfileCache } from '../utils/profileCache';
import type { Placement, PropertyMaster, PropertyRoom, ServiceUserMaster } from '../types/masterData';
import type { RoomIssue } from '../types/roomManagement';

/**
 * The Operations Dashboard's data that is NOT already held in AppContext: the property/room/placement master data,
 * PEEP plans, absence follow-ups and room issues. Only the sources the user is allowed to view are requested.
 * A source that fails is reported by name; its numbers are then shown as unavailable, never as zero.
 */
export interface OperationsMasterData {
  properties: PropertyMaster[];
  rooms: PropertyRoom[];
  placements: Placement[];
  roomIssues: RoomIssue[];
  peepPlans: PeepPlan[];
  followUps: AbsenceFollowUp[];
  /** Service users (Service Users page); used for counts only */
  serviceUsers: ServiceUserMaster[];
  /** Sources that were requested and failed (display names) */
  failed: string[];
  loading: boolean;
  /** ISO time of the last completed load */
  loadedAt: string | null;
  reload: () => Promise<void>;
}

export interface OperationsDataWanted {
  /** properties, rooms and room issues (Property Management) */
  property: boolean;
  /** PEEP plans (PEEP Tracker) */
  peep: boolean;
  /** absence follow-ups (SU Attendance) */
  followUps: boolean;
  /** service users (Service Users page) */
  residents?: boolean;
}

const EMPTY = { properties: [] as PropertyMaster[], rooms: [] as PropertyRoom[], placements: [] as Placement[], roomIssues: [] as RoomIssue[], peepPlans: [] as PeepPlan[], followUps: [] as AbsenceFollowUp[], serviceUsers: [] as ServiceUserMaster[] };

/** How old the in-memory copy may be and still be painted at once (it is always re-read in the background). */
const CACHE_MAX_AGE_MS = 10 * 60_000;

export function useOperationsData(wanted: OperationsDataWanted, enabled = true): OperationsMasterData {
  const { authProfile } = useApp();
  const userId = authProfile?.id;
  const cacheKey = `ops-master:${wanted.property ? 'p' : ''}${wanted.peep ? 'e' : ''}${wanted.followUps ? 'f' : ''}${wanted.residents ? 'r' : ''}`;
  // Stale-while-revalidate: if this profile opened the dashboard recently, paint from memory now and re-read behind it.
  const cached = useRef(readProfileCache<typeof EMPTY>(userId, cacheKey, CACHE_MAX_AGE_MS));
  const [data, setData] = useState<typeof EMPTY>(cached.current ?? EMPTY);
  const [failed, setFailed] = useState<string[]>([]);
  const [loading, setLoading] = useState(!cached.current);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const alive = useRef(true);
  const seq = useRef(0);
  const loadedOnce = useRef(!!cached.current);

  const { property, peep, followUps } = wanted;
  const residents = !!wanted.residents;

  const reload = useCallback(async () => {
    if (!enabled) return;
    const mine = ++seq.current;
    // Only the first load shows "Loading"; later re-reads (live updates) replace the numbers in place without blanking the page.
    if (!loadedOnce.current) setLoading(true);
    // Placements are needed to place a resident at a site (PEEP, follow-ups) as well as for occupancy.
    const needPlacements = property || peep || followUps || residents;
    const none = Promise.resolve({ success: true, data: [] as any[] });

    const [props, rooms, plcs, issues, plans, fus, sus] = await Promise.all([
      property ? suPropertyService.getProperties() : none,
      property ? suPropertyService.getRooms() : none,
      needPlacements ? suPropertyService.getPlacements({ status: 'Active' }) : none,
      property ? roomManagementService.getIssues({}) : none,
      peep ? suTrackerService.listPeepPlans() : none,
      followUps ? suTrackerService.listFollowUps() : none,
      residents ? suPropertyService.getServiceUsers(undefined, { includeArchived: false }) : none,
    ]).catch(() => [null, null, null, null, null, null, null] as any[]);

    if (!alive.current || mine !== seq.current) return; // a newer load superseded this one

    const bad: string[] = [];
    const take = <T,>(res: any, label: string): T[] => {
      if (!res || res.success === false) { bad.push(label); return []; }
      return (res.data || []) as T[];
    };
    const next = {
      properties: take<PropertyMaster>(props, 'Properties'),
      rooms: take<PropertyRoom>(rooms, 'Rooms'),
      placements: take<Placement>(plcs, 'Placements'),
      roomIssues: take<RoomIssue>(issues, 'Room issues'),
      peepPlans: take<PeepPlan>(plans, 'PEEP plans'),
      followUps: take<AbsenceFollowUp>(fus, 'Absence follow-ups'),
      serviceUsers: take<ServiceUserMaster>(sus, 'Service users'),
    };
    setData(next);
    // Only a complete read is kept; a partial failure must not become the next paint.
    if (bad.length === 0) writeProfileCache(userId, cacheKey, next);
    setFailed(bad);
    setLoadedAt(new Date().toISOString());
    loadedOnce.current = true;
    setLoading(false);
  }, [enabled, property, peep, followUps, residents, userId, cacheKey]);

  useEffect(() => {
    alive.current = true;
    void reload();
    // Property Management announces edits to the master data; reload so the numbers follow.
    const onMaster = () => { void reload(); };
    window.addEventListener('sdtracker:masterDataUpdated', onMaster);
    return () => { alive.current = false; window.removeEventListener('sdtracker:masterDataUpdated', onMaster); };
  }, [reload]);

  return { ...data, failed, loading, loadedAt, reload };
}
