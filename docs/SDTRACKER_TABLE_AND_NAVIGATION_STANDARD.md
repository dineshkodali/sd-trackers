# SDTracker — Table and Navigation Standard

Status: **audit and proposal. Nothing implemented.**

## 1. Page-level tabs (Phase 1)

**Existing standard.** `src/components/common/TrackerLayout.tsx` already defines it: `TrackerHeader` (icon, title, count, description, actions, **tabs**, summary, filters in one card) with `TabSwitcher` (`role="tablist"`, teal underline). Used by Transport, Food, GP, Laundry, SU Attendance, PEEP, Registers.

**Deviations found.**

| Page | Deviation |
|---|---|
| Room Checks, Welfare Checks | Own header card, then a *second* card whose "tabs" are pill buttons (All / Completed / Due / Overdue / Raw Logs). No `tablist`/`tab` roles, no keyboard support, different look. The page-level view (matrix vs raw log) and the table filters (completed/due/overdue) are mixed in one control. |
| Transport sub-sections | Tabs are shared correctly (`tabSwitcher` prop). |
| `TabSwitcher` itself | No arrow-key navigation, no `tabIndex` roving, no `aria-controls`; selected tab is plain local state, lost on refresh and not linkable. |

**Proposal.**
- Keep `TrackerHeader` + `TabSwitcher` as *the* implementation; do not add another.
- Room/Welfare: page tabs become **Required Checks** and **Inspection Log** (Welfare: **Welfare Log**) inside the header card. "All / Completed / Due / Overdue" become a filter chip row under the search (they are filters, not views).
- Upgrade `TabSwitcher`: Left/Right/Home/End keys, roving `tabIndex`, `aria-controls`, optional badge count.
- Persist the active tab: `useTabState(pageId, defaultTab)` storing in `sessionStorage` and, where a page already has a path, in a query string (`?tab=`). No new router.

## 2. Table column standard (Phase 3)

**Existing state.** 89 files contain a `<table>`; only the Dispersal sheet has an `S.No` column. Column order is decided per page. `TrackerLayout` already exports shared pieces (`TablePanel`, `SortableTh`, `ActionsTh`, `EmptyRow`, `SkeletonRows`, class constants) but no shared column logic.

**Standard.** Service-User-related table: `S.No.` → `Service User` → domain fields → status → `Actions` (last, sticky). Room/Welfare: `S.No. | Service User | Room | Site | 1st Check | 2nd Check | Frequency | Status | Actions`. SPCD: `S.No. | Service User | Case Type | DOB | Case Status | Actions`.

**Proposal (reuse, don't duplicate).**
- Add to `TrackerLayout`: `SerialTh`/`SerialTd` and a `serial(index, page, pageSize)` helper (`(page-1)*pageSize + index + 1`, so numbers follow filtering and pagination).
- `ServiceUserCell` (name + reference, link to profile, "Vacant" only when truly vacant).
- Column configs (`trackerTableConfigs.ts`) get a `role: 'serial' | 'serviceUser' | 'actions'` marker; a `orderColumns()` helper puts those first/last. Customise-Table (Super Admin) can reorder the middle but not move S.No./Service User/Actions.
- Row `key` stays the record id, never the serial number.
- Rollout per module behind a column-config change, so no page is rewritten.

## 3. Routes and navigation (Phase 8)

**Existing.** There is no router. `AppContext` holds `activePage`, mirrored to `sessionStorage`; only two pages map to URLs (`/su-users`, `/property-management`); `navigateWithIntent` carries filters/record ids in memory. 50 page cases in `App.tsx`. Direct URL to any other page opens the dashboard (or the last page of the session). Tab state, filters and open modals are lost on refresh. Back/forward only works for the two URL-backed pages.

**Risks.** No deep links to a record or tab; no breadcrumbs; permission checks live in `canAccessPage` (good) but a stale `sessionStorage` page can be restored to a page the user lost access to until the guard runs.

**Proposal (lowest risk).** Generalise the existing mechanism rather than introduce a router: a single `pageRoutes` table (`pageId → path`), `history.pushState` for all pages, `?tab=` and `?record=` parameters, `popstate` handling already present. Guard restores through `canAccessPage`. Details in `SDTRACKER_ROUTE_AUDIT.md`.
