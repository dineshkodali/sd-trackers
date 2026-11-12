import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { suPropertyService } from '../services/suPropertyService';
import { apiService } from '../services/apiService';
import type { ServiceUserContact } from '../types/masterData';
import { createSiteResolver } from '../utils/operationsRules';
import type { SelectScope, SuMasterData } from '../utils/serviceUserProfile';

/**
 * Master data behind every Service User picker (people, placements, properties, rooms, contacts), loaded once and shared.
 * Any number of pickers on screen cause one set of requests; the data refreshes when master data is edited.
 */
let shared: { at: number; promise: Promise<Omit<SuMasterData, 'sites'>> } | null = null;

async function fetchMaster(): Promise<Omit<SuMasterData, 'sites'>> {
  const [su, plc, props, rooms, contacts] = await Promise.all([
    suPropertyService.getServiceUsers(undefined, { includeArchived: true }),
    suPropertyService.getPlacements({ status: 'Active' }),
    suPropertyService.getProperties(),
    suPropertyService.getRooms(),
    apiService.fetchEntityRecords<ServiceUserContact>('suContacts', { limit: 20000 }).catch(() => ({ success: false, data: [] as ServiceUserContact[] }))
  ]);
  if (!su.success) throw new Error(su.error || 'Service Users could not be loaded.');
  return {
    serviceUsers: su.data || [],
    placements: plc.success ? plc.data || [] : [],
    properties: props.success ? props.data || [] : [],
    rooms: rooms.success ? rooms.data || [] : [],
    // Contact details are optional: a failure leaves phone / email blank, it does not block picking a person.
    contacts: contacts.success ? ((contacts as any).data || []) : []
  };
}

function loadShared(force = false) {
  if (force || !shared || Date.now() - shared.at > 30_000) {
    const promise = fetchMaster();
    shared = { at: Date.now(), promise };
    promise.catch(() => { if (shared?.promise === promise) shared = null; });
  }
  return shared!.promise;
}

export interface ServiceUserProfilesState {
  data: SuMasterData | null;
  loading: boolean;
  error: string | null;
  scope: SelectScope;
  reload: () => void;
}

export function useServiceUserProfiles(siteId?: string): ServiceUserProfilesState {
  const { sites, canAccessAllSites, allowedSites } = useApp();
  const [master, setMaster] = useState<Omit<SuMasterData, 'sites'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const run = useCallback((force: boolean) => {
    setLoading(true);
    loadShared(force)
      .then(m => { if (alive.current) { setMaster(m); setError(null); } })
      .catch(e => { if (alive.current) setError(e?.message || 'Service Users could not be loaded.'); })
      .finally(() => { if (alive.current) setLoading(false); });
  }, []);

  useEffect(() => {
    alive.current = true;
    run(false);
    const onUpdate = () => run(true);
    window.addEventListener('sdtracker:masterDataUpdated', onUpdate);
    return () => { alive.current = false; window.removeEventListener('sdtracker:masterDataUpdated', onUpdate); };
  }, [run]);

  const siteRefs = useMemo(() => (sites || []).map(s => ({ id: s.id, name: s.name })), [sites]);
  const data = useMemo<SuMasterData | null>(() => (master ? { ...master, sites: siteRefs } : null), [master, siteRefs]);

  const scope = useMemo<SelectScope>(() => {
    const resolve = createSiteResolver(siteRefs);
    const allowed: SelectScope['allowedSiteIds'] = canAccessAllSites()
      ? 'all'
      : new Set((allowedSites || []).map(resolve).filter((id): id is string => !!id));
    return { allowedSiteIds: allowed, siteId };
  }, [siteRefs, canAccessAllSites, allowedSites, siteId]);

  return { data, loading, error, scope, reload: () => run(true) };
}
