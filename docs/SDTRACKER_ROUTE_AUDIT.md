# SDTracker — Route Audit

Status: **audit only.** Based on reading `App.tsx`, `AppContext.tsx` and `pageRegistry.ts`; no route was exercised in a browser.

## Existing mechanism
- No `react-router`. `AppContext.activePage` selects the view; `App.tsx` has ~50 `case` branches; `pageRegistry.ts` lists page ids.
- Persistence: `sessionStorage['sg_tracker_active_page']`. URL paths exist for two pages only (`/su-users` and `/service-users` → `suUsers`; `/property-management` and `/properties` → `propertyManagement`), with a `popstate` handler.
- `navigateWithIntent(page, { filters, recordId })` passes filters and a record id in memory (consumed once).
- Access control: `canAccessPage(pageId)` + `AccessDeniedView`; server enforces per-table permissions independently.

## Findings
| # | Finding | Impact | Severity |
|---|---|---|---|
| R1 | Only 2 of ~50 pages have a URL | No deep links, refresh returns to session page, browser Back leaves the app | Medium |
| R2 | Tabs, filters, selected month and open modal are component state | Lost on refresh/navigation; Room/Welfare month and tab reset | Medium |
| R3 | Two aliases per URL-backed page (`/properties` is `propertyManagement`, while a page id `properties` also exists) | Name clash risk: `properties` page vs `/properties` path | Medium |
| R4 | Restored `activePage` from `sessionStorage` is not re-checked until render | Brief flash or AccessDenied if access was removed | Low |
| R5 | No breadcrumbs; detail views are modals with no URL | Cannot link to a record | Low |
| R6 | `navigateWithIntent` ids are in memory only | A shared link cannot open a record | Low |
| R7 | `?` query is not used anywhere | Tab/month/record cannot be encoded | Medium |

No duplicate route definitions or broken redirects were found in the two URL-backed pages. Room/Property identifiers used in the new check views come from loaded master data and are not part of any URL.

## Proposal (preserve conventions, no router)
1. One `pageRoutes` map (`pageId → path`), generated from `pageRegistry`, replacing the two hard-coded branches. Keep the existing `/su-users` and `/property-management` paths as they are; resolve the `properties` alias clash explicitly.
2. `history.pushState` on `setActivePage` for every page; `popstate` restores page, tab and record.
3. `?tab=`, `?month=`, `?record=` parameters written by `useTabState` and `navigateWithIntent`; read once on load and validated (unknown values ignored).
4. Guard: restored page is passed through `canAccessPage` before render.
5. Optional later: breadcrumb strip from `pageRegistry` groups.

## Test plan
Open every page by URL and by sidebar; refresh on each; Back/Forward through three pages; tab and month survive refresh; record deep-link opens the modal for permitted users only; a user without access to a page gets `AccessDeniedView` on direct URL; an invalid `?tab=` falls back to default.
