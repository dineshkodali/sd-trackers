import { useCallback, useState } from 'react';

/**
 * The selected tab of a page, kept for the browser session so a refresh or a visit to another page and back returns to it.
 * Only values in `allowed` are accepted; anything else falls back to the default.
 */
export function useTabState<T extends string>(pageId: string, allowed: readonly T[], fallback: T): [T, (tab: T) => void] {
  const key = `sg_tracker_tab_${pageId}`;
  const [tab, setTabState] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved && (allowed as readonly string[]).includes(saved)) return saved as T;
    } catch { /* storage blocked */ }
    return fallback;
  });
  const setTab = useCallback((next: T) => {
    setTabState(next);
    try { sessionStorage.setItem(key, next); } catch { /* storage blocked */ }
  }, [key]);
  return [tab, setTab];
}
