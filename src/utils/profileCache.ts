/**
 * Per-profile cache for the Operations Dashboard.
 *
 * Two deliberately different stores:
 *  - DATA (rooms, placements, PEEP, follow-ups ...) lives in MEMORY only, keyed by the signed-in profile. Coming back to
 *    the dashboard paints from it at once and then re-reads in the background (stale-while-revalidate). It is never written
 *    to localStorage/sessionStorage: the app's policy is that operational and resident data is hydrated from the live
 *    database only, and it dies with the tab. Another profile never reads it; sign-out clears it.
 *  - PREFERENCES (selected tab, site, "overdue only") are not data. They are remembered per profile in localStorage so
 *    the dashboard opens where this person last was.
 */

const memory = new Map<string, { at: number; value: unknown }>();
const k = (userId: string | undefined, key: string) => `${userId || 'anon'}|${key}`;

export function readProfileCache<T>(userId: string | undefined, key: string, maxAgeMs: number, now = Date.now()): T | null {
  const hit = memory.get(k(userId, key));
  return hit && now - hit.at <= maxAgeMs ? (hit.value as T) : null;
}

export function writeProfileCache(userId: string | undefined, key: string, value: unknown, now = Date.now()): void {
  memory.set(k(userId, key), { at: now, value });
}

export function clearProfileCache(): void { memory.clear(); }

/* ------------------------------------------------------------------ preferences */

export interface DashboardPrefs {
  tab: string;
  factTab: string;
  site: string;
  overdueOnly: boolean;
  moreOpen: boolean;
}

export const DEFAULT_PREFS: DashboardPrefs = { tab: 'all', factTab: '', site: '', overdueOnly: false, moreOpen: false };
const PREFS_KEY = (userId: string | undefined) => `sdtracker.opsPrefs.v1:${userId || 'anon'}`;

export function loadPrefs(userId: string | undefined, storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined): DashboardPrefs {
  try {
    const raw = storage?.getItem(PREFS_KEY(userId));
    if (!raw) return { ...DEFAULT_PREFS };
    const p = JSON.parse(raw);
    return {
      tab: typeof p.tab === 'string' ? p.tab.slice(0, 40) : DEFAULT_PREFS.tab,
      factTab: typeof p.factTab === 'string' ? p.factTab.slice(0, 40) : DEFAULT_PREFS.factTab,
      site: typeof p.site === 'string' ? p.site.slice(0, 80) : DEFAULT_PREFS.site,
      overdueOnly: p.overdueOnly === true,
      moreOpen: p.moreOpen === true
    };
  } catch { return { ...DEFAULT_PREFS }; }
}

export function savePrefs(userId: string | undefined, prefs: DashboardPrefs, storage: Pick<Storage, 'setItem'> | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined): void {
  try { storage?.setItem(PREFS_KEY(userId), JSON.stringify(prefs)); } catch { /* storage full or blocked: the preference is simply not kept */ }
}
