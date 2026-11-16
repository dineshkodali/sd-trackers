/**
 * Short-lived cache for list reads, so flipping a filter, switching tabs or reopening a page does not re-download the
 * same table. Identical requests that are still in flight share one call. Every write (from this browser) clears the
 * entity it changed, and workflow writes clear everything, so data you just saved is never hidden behind the cache.
 * Another person's change shows up within the TTL, or at once on Refresh / reload.
 */
const TTL_MS = 20_000;
const MAX_ENTRIES = 200;

interface Entry { at: number; entity: string; promise: Promise<any> }
const entries = new Map<string, Entry>();

export function cachedRead<R extends { success: boolean }>(entity: string, key: string, load: () => Promise<R>): Promise<R> {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.promise as Promise<R>;
  if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
  const promise = load().then(res => {
    if (!res.success && entries.get(key)?.promise === promise) entries.delete(key);   // never keep a failure
    return res;
  }, err => { if (entries.get(key)?.promise === promise) entries.delete(key); throw err; });
  entries.set(key, { at: now, entity, promise });
  return promise;
}

export function invalidateReads(entity?: string): void {
  if (!entity) { entries.clear(); return; }
  for (const [k, v] of entries) if (v.entity === entity) entries.delete(k);
}

/** Drop everything (Refresh buttons, sign-out). */
export const clearReadCache = () => entries.clear();
