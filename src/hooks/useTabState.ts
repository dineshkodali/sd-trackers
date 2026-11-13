import { useCallback, useState } from 'react';
import { searchWithTab, tabFromSearch } from '../config/pageRoutes';

/**
 * The selected tab of a page, kept for the browser session so a refresh or a visit to another page and back returns to it.
 * Only values in `allowed` are accepted; anything else falls back to the default.
 */
export function useTabState<T extends string>(pageId: string, allowed: readonly T[], fallback: T): [T, (tab: T) => void] {
  const key = `sg_tracker_tab_${pageId}`;
  const [tab, setTabState] = useState<T>(() => {
    // A link such as /room-checks?tab=log opens that tab; otherwise the one used earlier this session.
    try {
      const fromUrl = tabFromSearch(window.location.search, allowed);
      if (fromUrl) return fromUrl as T;
    } catch { /* no window */ }
    try {
      const saved = sessionStorage.getItem(key);
      if (saved && (allowed as readonly string[]).includes(saved)) return saved as T;
    } catch { /* storage blocked */ }
    return fallback;
  });
  const setTab = useCallback((next: T) => {
    setTabState(next);
    try { sessionStorage.setItem(key, next); } catch { /* storage blocked */ }
    // Keep the address shareable. replaceState: switching tabs should not fill the Back button.
    try {
      const search = searchWithTab(window.location.search, next, fallback);
      if (search !== window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`);
    } catch { /* no window */ }
  }, [key, fallback]);
  return [tab, setTab];
}
