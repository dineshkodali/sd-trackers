import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { suEnhancementsService } from '../services/suEnhancementsService';
import { suPropertyService } from '../services/suPropertyService';
import { buildAspenLookup, type GuestContext } from '../utils/guestStats';

const norm = (v?: string | null) => (v ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

interface FamilyIndex {
  familyIdByRef: Map<string, string>;
  familySize: Map<string, number>;
}

const CACHE_MS = 60_000;
let cache: { at: number; index: FamilyIndex } | null = null;
let inflight: Promise<FamilyIndex> | null = null;

async function loadFamilyIndex(force: boolean): Promise<FamilyIndex> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.index;
  if (inflight) return inflight;
  inflight = (async () => {
    const [groups, members, users] = await Promise.all([
      suEnhancementsService.listFamilies(),
      suEnhancementsService.listFamilyMembers(),
      suPropertyService.getServiceUsers(undefined, { includeArchived: true }),
    ]);
    if (!groups.success) throw new Error(groups.error || 'Family groups could not be loaded.');
    if (!members.success) throw new Error(members.error || 'Family members could not be loaded.');

    const activeGroups = new Set(groups.data.filter(g => g.status === 'Active').map(g => g.id));
    const refsBySu = new Map<string, string[]>();
    for (const u of users.data || []) {
      const refs = [u.externalReference, u.suReference].map(norm).filter(Boolean);
      if (refs.length) refsBySu.set(u.id, refs);
    }

    const familySize = new Map<string, number>();
    const familyIdByRef = new Map<string, string>();
    for (const m of members.data) {
      if (m.status !== 'Active' || !activeGroups.has(m.familyId)) continue;
      familySize.set(m.familyId, (familySize.get(m.familyId) || 0) + 1);
      for (const ref of refsBySu.get(m.suId) || []) familyIdByRef.set(ref, m.familyId);
    }
    const index = { familyIdByRef, familySize };
    cache = { at: Date.now(), index };
    return index;
  })().finally(() => { inflight = null; });
  return inflight;
}

/**
 * What the guest statistics need besides the register rows: family groups (for family size) and
 * the Aspen card held on New Arrivals. If family groups cannot be read, family size falls back to
 * the people sharing a room and `error` says so, instead of showing wrong numbers silently.
 */
export function useGuestContext() {
  const { newArrivalsRecords } = useApp();
  const [index, setIndex] = useState<FamilyIndex | null>(cache?.index ?? null);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setIndex(await loadFamilyIndex(force));
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Family groups could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  const aspenByRef = useMemo(() => buildAspenLookup(newArrivalsRecords || []), [newArrivalsRecords]);
  const ctx = useMemo<GuestContext>(() => ({
    familyIdByRef: index?.familyIdByRef ?? new Map(),
    familySize: index?.familySize ?? new Map(),
    aspenByRef,
  }), [index, aspenByRef]);

  return { ctx, loading, error, reload: () => load(true) };
}
