import { useEffect, useRef, useState } from 'react';
import { operationsRealtime, type OperationsLinkState } from '../services/operationsRealtime';

/** Tables whose change is picked up by announcing the master data changed (dashboard master hook + check obligations reload on it). */
const MASTER_TABLES = new Set(['properties', 'property_rooms', 'room_beds', 'placements', 'service_users', 'peep_plans', 'absence_followups', 'room_issues']);
/** Tables AppContext holds as lists: re-read through its own sync. */
const CONTEXT_TABLES = new Set(['room_checks', 'welfare_checks']);

/** Quiet period before re-reading, so a burst of edits (e.g. a bulk import) causes one reload, and the longest a burst may delay it. */
export const LIVE_DEBOUNCE_MS = 800;
export const LIVE_MAX_WAIT_MS = 3000;
/** Safety net while the live link is down: re-read this often (the app-wide poll is slower still). */
const FALLBACK_POLL_MS = 60_000;

export interface OperationsLive {
  link: OperationsLinkState;
  /** ISO time the dashboard last re-read the database because of a change or a resync (null before the first) */
  lastReconciledAt: string | null;
}

/**
 * Keeps the Operations Dashboard in step with the database without a reload of the page.
 * A change event never edits a number: it only schedules a re-read of the authoritative rows (debounced, coalesced).
 * After a gap (link re-established, network back, tab visible again) everything is re-read, so missed events cannot leave
 * stale figures. All listeners are removed when the dashboard unmounts.
 */
export function useOperationsLive(refreshLiveData: () => Promise<void>, enabled = true): OperationsLive {
  const [link, setLink] = useState<OperationsLinkState>('connecting');
  const [lastReconciledAt, setLastReconciledAt] = useState<string | null>(null);
  const refresh = useRef(refreshLiveData);
  refresh.current = refreshLiveData;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let firstPendingAt = 0;
    const pending = { master: false, context: false };

    const flush = async () => {
      timer = null; firstPendingAt = 0;
      const { master, context } = pending;
      pending.master = false; pending.context = false;
      if (master) window.dispatchEvent(new Event('sdtracker:masterDataUpdated'));
      if (context) { try { await refresh.current(); } catch { /* the next event or resync retries */ } }
      if (alive && (master || context)) setLastReconciledAt(new Date().toISOString());
    };

    const schedule = () => {
      const now = Date.now();
      if (!firstPendingAt) firstPendingAt = now;
      if (timer) clearTimeout(timer);
      // Trailing debounce, but never later than LIVE_MAX_WAIT_MS after the first event of the burst.
      const wait = Math.max(0, Math.min(LIVE_DEBOUNCE_MS, firstPendingAt + LIVE_MAX_WAIT_MS - now));
      timer = setTimeout(() => { void flush(); }, wait);
    };

    const release = operationsRealtime.acquire({
      onChange: c => {
        if (MASTER_TABLES.has(c.table)) pending.master = true;
        else if (CONTEXT_TABLES.has(c.table)) pending.context = true;
        else return;
        schedule();
      },
      onState: s => { if (alive) setLink(s); },
      onResync: () => { pending.master = true; pending.context = true; schedule(); }
    });

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      release();
    };
  }, [enabled]);

  // While the live link is not up, re-read every minute instead; once it is up there is no polling from here.
  useEffect(() => {
    if (!enabled || link === 'live' || link === 'connecting') return;
    const t = setInterval(() => {
      window.dispatchEvent(new Event('sdtracker:masterDataUpdated'));
      void refresh.current().then(() => setLastReconciledAt(new Date().toISOString())).catch(() => undefined);
    }, FALLBACK_POLL_MS);
    return () => clearInterval(t);
  }, [enabled, link]);

  return { link, lastReconciledAt };
}
