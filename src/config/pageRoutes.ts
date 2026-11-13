/**
 * The address of every page. One table, used both ways: page id -> path (when the user navigates) and path -> page id
 * (on a direct link, a refresh, and the browser's Back and Forward buttons).
 *
 * The two older addresses keep working exactly as before:
 *   /su-users and /service-users            -> suUsers
 *   /property-management and /properties    -> propertyManagement
 * so the page whose id is "properties" gets /site-properties instead of clashing with the /properties alias.
 * Every other page is its id in kebab-case (roomChecks -> /room-checks). The dashboard is "/".
 */
const OVERRIDES: Record<string, string> = {
  dashboard: '/',
  suUsers: '/su-users',
  propertyManagement: '/property-management',
  properties: '/site-properties'
};

const ALIASES: Record<string, string> = {
  '/service-users': 'suUsers',
  '/properties': 'propertyManagement'
};

const kebab = (id: string) => id.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export function pathForPage(pageId: string): string {
  return OVERRIDES[pageId] || `/${kebab(pageId)}`;
}

/** The page a path belongs to, or null when it is not one of `knownPages` (so a typo never opens a blank page). */
export function pageForPath(pathname: string, knownPages: readonly string[]): string | null {
  const path = (pathname.replace(/\/+$/, '') || '/').toLowerCase();
  if (ALIASES[path]) return ALIASES[path];
  for (const id of knownPages) if (pathForPage(id).toLowerCase() === path) return id;
  return null;
}

/** `tab` from a query string, only when it is one of the page's own tabs. */
export function tabFromSearch(search: string, allowed: readonly string[]): string | null {
  const value = new URLSearchParams(search).get('tab');
  return value && allowed.includes(value) ? value : null;
}

/** The query string with `tab` set (or removed when it is the page's default), keeping any other parameters. */
export function searchWithTab(search: string, tab: string, defaultTab: string): string {
  const params = new URLSearchParams(search);
  if (tab === defaultTab) params.delete('tab'); else params.set('tab', tab);
  const text = params.toString();
  return text ? `?${text}` : '';
}
