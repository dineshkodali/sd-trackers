import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { suPropertyService } from '../services/suPropertyService';
import type { Placement, PropertyMaster, PropertyRoom, ServiceUserMaster } from '../types/masterData';
import {
  buildObligations, roomChecksToVisits, welfareChecksToVisits, summarise, toRows,
  type CheckResult, type CheckType, type CheckRow, type CheckTotals, type UnmatchedVisit
} from '../utils/checkObligations';

/**
 * Twice-monthly check obligations for one month and one check type, worked out from rooms, placements (any status, so
 * past months are right) and the checks already recorded. Nothing is stored; a failed source is reported, never read as zero.
 */
interface Master { properties: PropertyMaster[]; rooms: PropertyRoom[]; placements: Placement[]; serviceUsers: ServiceUserMaster[] }

let shared: { at: number; promise: Promise<Master> } | null = null;
async function fetchMaster(): Promise<Master> {
  const [props, rooms, plc, su] = await Promise.all([
    suPropertyService.getProperties(), suPropertyService.getRooms(),
    suPropertyService.getPlacements({}), suPropertyService.getServiceUsers(undefined, { includeArchived: true })
  ]);
  if (!props.success || !rooms.success || !plc.success || !su.success) {
    throw new Error('Properties, rooms, placements or service users could not be loaded.');
  }
  return { properties: props.data || [], rooms: rooms.data || [], placements: plc.data || [], serviceUsers: su.data || [] };
}
function loadShared(force: boolean) {
  if (force || !shared || Date.now() - shared.at > 30_000) {
    const promise = fetchMaster();
    shared = { at: Date.now(), promise };
    promise.catch(() => { if (shared?.promise === promise) shared = null; });
  }
  return shared!.promise;
}

export interface CheckObligationsState {
  loading: boolean;
  error: string | null;
  result: CheckResult | null;
  rows: CheckRow[];
  totals: CheckTotals | null;
  unmatched: UnmatchedVisit[];
  reload: () => void;
}

export function useCheckObligations(type: CheckType, month: string, now: Date, enabled = true): CheckObligationsState {
  const { sites, roomChecks, welfareChecks } = useApp();
  const [master, setMaster] = useState<Master | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const alive = useRef(true);

  const run = useCallback((force: boolean) => {
    if (!enabled) return;
    setLoading(true);
    loadShared(force)
      .then(m => { if (alive.current) { setMaster(m); setError(null); } })
      .catch(e => { if (alive.current) setError(e?.message || 'Check data could not be loaded.'); })
      .finally(() => { if (alive.current) setLoading(false); });
  }, [enabled]);

  useEffect(() => {
    alive.current = true;
    run(false);
    const onUpdate = () => run(true);
    window.addEventListener('sdtracker:masterDataUpdated', onUpdate);
    return () => { alive.current = false; window.removeEventListener('sdtracker:masterDataUpdated', onUpdate); };
  }, [run]);

  const computed = useMemo(() => {
    if (!master) return null;
    const siteList = (sites || []).map(s => ({ id: s.id, name: s.name, leadOfficer: s.leadOfficer }));
    const rooms = roomChecksToVisits(roomChecks || [], master.rooms, master.properties, siteList);
    const welfare = welfareChecksToVisits(welfareChecks || [], master.serviceUsers);
    const result = buildObligations({
      sites: siteList, properties: master.properties, rooms: master.rooms, placements: master.placements,
      serviceUsers: master.serviceUsers, roomVisits: rooms.visits, welfareVisits: welfare.visits
    }, month, type, now);
    return { result, unmatched: [...result.unmatched, ...(type === 'room' ? rooms.unmatched : welfare.unmatched).filter(u => u.date.slice(0, 7) === month || !u.date)] };
  }, [master, sites, roomChecks, welfareChecks, month, type, now]);

  const rows = useMemo(() => (computed ? toRows(computed.result.obligations) : []), [computed]);
  const totals = useMemo(() => (computed ? summarise(computed.result.obligations) : null), [computed]);

  return { loading, error, result: computed?.result ?? null, rows, totals, unmatched: computed?.unmatched ?? [], reload: () => run(true) };
}
