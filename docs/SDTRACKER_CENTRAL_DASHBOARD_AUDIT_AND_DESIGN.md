# SDTracker – Central Operations Dashboard: Audit and Design

**Audit and planning only.** Prepared 12 November 2026. No dashboard code, existing page, database object, mock data or functionality was created or changed to produce this document.

**Evidence and limits.** Findings are tied to `file:line` in this repository. This builds on `docs/SDTRACKER_OVERDUE_AND_NOTIFICATION_AUDIT.md` (module-by-module detail, schema, RLS findings); it does not repeat that work except where the dashboard depends on it. Not verified: the **live database contents** (row counts, data quality), the **production hosting mode**, and whether `db/enable-direct-supabase-rls.sql` has been applied. Where a number depends on live data quality it is marked **[unverified]**.

---

## 1. Executive Summary

SDTracker already has a customisable dashboard, but it is a safeguarding case view, not an operations view. It cannot answer "what is overdue today?" because **most of the underlying data cannot yet say what is overdue**. The central dashboard is therefore two jobs: (a) a presentation layer, and (b) a small set of agreed, tested definitions of "outstanding / overdue / due soon" per module.

| # | Finding | Consequence |
|---|---|---|
| 1 | The existing `DashboardView` is oriented to referrals, vulnerable residents, challenging behaviour and escalations. It has **no overdue, deadline, compliance-expiry or maintenance-SLA view** (only an "Open maintenance" mini-widget, now with an overdue count). | The central dashboard is new content, not a restyle. |
| 2 | **Navigation is `setActivePage(page)` only** (`AppContext.tsx:685`). There is no way to open a page with a filter applied or to open a specific record. | "Click a KPI → filtered records" and "click an item → open the task" need a small navigation-intent mechanism. Largest hidden dependency. |
| 3 | **Several requested metrics cannot be calculated at all today:** missed room checks, missed welfare checks, a generic "overdue tasks" count, outstanding NTV actions, "teams with outstanding actions". | Per your rule, these are **excluded** until their data exists. They are not shown as zero. |
| 4 | **Counting rules differ between existing screens.** The sidebar counts open maintenance as `defectStatus !== 'Completed'` (`Sidebar.tsx:172`); the tracker also treats `action === 'Closed'` as closed (`MaintenanceTrackerView.tsx:675`). Site matching is exact in one widget (`PropertyLoadBreakdown.tsx:37`) and substring in `isSitePermitted` (`AppContext.tsx:2265-2281`). | A dashboard that disagrees with the pages it links to destroys trust. Definitions must be centralised first. |
| 5 | The data the dashboard needs is **mostly already in browser memory**. `AppContext` loads whole tables (up to 50,000 rows each) with realtime updates and a 5-minute poll. Master data (rooms, placements, PEEP, follow-ups) is fetched separately. | Phase 1 needs **no new tables, no new queries for most sections**, and can be fast. |
| 6 | The existing widgets animate (Recharts default animation is on, `transition-all hover:shadow-md` on cards) and use oversized cards (`text-3xl`, `p-3.5`). Three stacked header rows precede any data. | Conflicts with the strict UI rules; the new dashboard must not reuse these components as they are. |
| 7 | `isSitePermitted` and all RBAC for the dashboard run **in the browser only**. In direct-Supabase mode RLS lets any signed-in user read every row. | The dashboard adds no new exposure, but it cannot be the security boundary either. Aggregates stay inside what the user's browser can already load. |

**Recommendation in one line:** build a new `operations` page (registered like any other, so page-access control works), driven by one memoised selector layer with agreed definitions; ship only the KPIs that are accurate today; add missed-check and overdue-ledger metrics when the earlier plan's phases 2 and 5–6 land.

---

## 2. Existing Application Audit (summary)

Full detail: `docs/SDTRACKER_OVERDUE_AND_NOTIFICATION_AUDIT.md` §2–§5. Facts that matter for the dashboard:

- **Frontend:** React 19 + TypeScript + Vite + Tailwind 4; Recharts for charts; Tabler icons. One `activePage` switch in `src/App.tsx:238-359`, no router, no URL state.
- **State:** one 6,189-line `AppContext`. `liveDataStatus` exposes `state`, `lastSyncAt`, `unavailable[]`, `missingTables[]` (`AppContext.tsx:108-116`).
- **Sync:** `POST /api/db/batch-read` for 38 entities (list at `AppContext.tsx:1806-1846`), realtime patches for high-traffic tables, 5-minute safety poll (`:2095`). The audit trail is loaded as the latest 500 rows only.
- **Backend:** Express gateway with service-role Supabase client and server-side site checks; a second path lets the browser call Supabase directly (`src/lib/directSupabaseAdapter.ts`). Production likely uses the direct path [unverified].
- **Auth/roles:** Supabase Auth; roles Super Admin, Admin, Regional Manager, General Manager, Area Manager, Staff. Site scope from `profiles.assigned_site`. Per-user page overrides (`user_page_permissions`) hide pages and are enforced by RESTRICTIVE RLS policies.
- **RLS:** enabled everywhere, but most policies are `USING (true)` for any authenticated user; site isolation is not in the database (see earlier audit §16).

---

## 3. Complete Module Inventory (dashboard view)

46 pages are registered in `src/config/pageRegistry.ts`, plus three admin-only routes (`settings`, `pageAccess`, `pageMaintenance`) = 49 routed pages. Three registered pages are archive views of another page. "Dashboard use" classifies each:

- **A** – supports an accurate KPI/attention/deadline item today
- **B** – supports a count or status breakdown only (no deadline)
- **C** – needs agreed definition or data fix first
- **X** – not suitable for an operations dashboard

### Overview
| Page | Key tables | Deadline / overdue today | Site / property / resident link | Dashboard use |
|---|---|---|---|---|
| Executive Dashboard (`dashboard`) | `user_dashboards` + others | – | – | Existing; see §4 |
| Live Daily Registers (`dailyRegisters`) | `daily_register_rooms`, `daily_register_records`, `new_arrivals_records`, `eviction_records` | Eviction notice/eviction dates (TEXT) | Hotel name, room no | **B** (occupancy snapshot exists, but rooms/placements master is the better source) |

### Safeguarding
| Page | Key tables | Statuses | Deadline / overdue | Link | Use |
|---|---|---|---|---|---|
| SG Referrals + archive | `referrals` | Open / In progress / Completed / Archived | `follow_up_date` TEXT; no overdue logic | site name, port ref | **B/C** |
| Vulnerable Residents + archive | `vulnerable_residents` | Open / In progress / Completed; risk Low–Critical | `next_review_date` TEXT; no overdue logic | site name | **B/C** (high-risk count is **A**) |
| Challenging Behaviour + archive | `challenging_behavior` | Open…Completed | none | site name | **B** |
| Welfare Checks | `welfare_checks` | `Completed` default | none; **no schedule** | site id+name, `su_id` optional | **B** (checks recorded); missed = not possible |
| RFA Welfare Checks | `rfa_welfare_checks` | – | none | site name | **B** |
| MH-Complaint Welfare Checks | `mh_complaint_welfare_checks` | Open→closed | none | site name | **B** (open count) |
| GP Appointments | `gp_appointments`, `gp_registrations` | scheduled/attended/DNA | `appointment_date` TEXT | site name, `su_id` | **B** (upcoming appointments) |
| PEEP Tracker | `peep_plans` | Active/Archived | `review_date` DATE; **overdue/due-soon already computed in UI** (`PEEPTrackerView.tsx:27-30`) | `su_id` | **A** |
| SU Attendance | `su_attendance_records`, `absence_followups` | Open/In Progress/Resolved | follow-up `due_date`; **overdue computed in UI** (`SUAttendanceTrackerView.tsx:198`) | `su_id` | **A** |
| HO Report Generator | `doc_builder`, `ho_report_*` | draft/final | none | – | **X** |
| Service Users Master | `service_users`, `placements`, `service_user_*` | Active/archived | document `expiry_date` DATE | site id, property, room | **A** (active residents, placements) |

### Facilities & Welfare
| Page | Key tables | Statuses | Deadline / overdue | Link | Use |
|---|---|---|---|---|---|
| **Maintenance Tracker** | `maintenance_records` | In Process / Completed; Open / Closed; CAT 1 / 2 Interim / 2 / 3 | **Complete By** (`closeDueDate`, typed `complete_by` after migration 033); overdue now computed (`getSlaInfo`) | site **name**, room text | **A** |
| SPCD Tracker | `spcd_records` | archive flag | `expires_date` unused | site name | **B** |
| IR Tracker | `ir_records` | status | none | site name | **B** (period count) |
| Public Transport | `public_transport_records`, `transport_funding_requests` (+history) | funding status machine | appointment date TEXT | site name | **B** (pending funding approvals) |
| Dispersal Sheet / NTV | `dispersal_records`, `eviction_records` | Notice Issued / Evicted / Appeal Pending / Cancelled | dates TEXT, format ambiguous (`MM/DD/YYYY` documented) | site name | **C** |
| Booklets, VCS Directory | `booklet_collections`, `vcs_agencies` | – | none | – | **X** |
| Laundry, Hot Meals, Food Consumption, Food Surveys, Food Wastage, Housekeeping | various | – | none; implicit daily logs, no expectation | site name | **B/X** (period counts only) |
| **Room Checks** | `room_checks`, `room_check_items` | Passed / Issues / Attention Required | **none; no schedule** | site id+name, room text, `room_id` optional | **B** (checks recorded; failed results); missed = not possible |
| Escalations Log | `escalations` | Active / Under Investigation / Awaiting Multi-Agency Review / Resolved | no deadline (registry text mentions SLA timers; none implemented) | site name | **A** (open count, age) |
| Proof Documents | `documents` | – | none | – | **X** |
| **Property Management** | `properties`, `property_rooms`, `room_beds`, `placements`, `room_issues`, `property_compliance`, `property_assets` | room status/occupancy; issue Open…Closed | `next_inspection_due`, `room_issues.due_date`, `property_compliance.expiry_date`, asset PAT/service dates (in `data`) | site id → property → room | **A** |

### Finance
| Page | Dashboard use |
|---|---|
| Vendor Invoices, Credit Card Bills, Delivery Notes, Finance Approvals | **B**, finance-role only. Approvals awaiting action is countable (`taskForUser`, `financeWorkflow.ts`). No ageing rule. |

### Compliance & Community
| Page | Key tables | Deadline / overdue | Use |
|---|---|---|---|
| **SD-Compliance Tracker** | `compliance_records` | `expiry_date` TEXT; status is typed by hand | **A once status is derived from the date** (see §7.2) |
| Reports & SharePoint Hub | reads others | – | Link target; not a data source |
| Audit Security Trail | `audit_trails` | – | **C** (activity feed, §8.6) |
| Data Change Requests | `data_change_requests` | Pending/Approved/Rejected; no decide-by date | **B** (pending count) |

### Admin & Governance
`properties` (sites), `users`, `roles`, `setupOptions`, `notifications`, `settings`, `pageAccess`, `pageMaintenance` – **X**, except `sites` (list, manager, status) and `users`/`profiles` (assignee names) as reference data.

---

## 4. Existing Dashboards and Reusable Components

### 4.1 What exists (`src/components/dashboard/`, 10 files)
| Component | Content | Reuse? |
|---|---|---|
| `DashboardView` | Title block, personal-dashboard toolbar, `FilterBar`, 12-column widget grid, export | Pattern (widget grid, page gating, error boundary) – yes; content – no |
| `DashboardToolbar`, `WidgetLibrary`, `useDashboards`, `dashboardService`, `/api/dashboards`, `user_dashboards` | Per-user saved layouts (max 10), default dashboard, add/move/resize widgets | Reuse for a later "customisable" phase; not needed for phase 1 |
| `config/dashboardWidgets.ts` | 16 widget types, each declares the pages it needs; `isWidgetAvailable` hides a widget if the user cannot view any of its pages | **Reuse the idea:** every section/KPI declares its required pages |
| `summaryCards`, `keyStats` | Referrals, escalations, properties; 5 case cards | No – oversized, case-centric, animated hover |
| `DashboardAnalytics` | Recharts bar/pie/area/line of incidents and referrals | No – animated; safeguarding-only |
| `PropertyLoadBreakdown` | Per-property load score (referrals×2, high-risk×3, escalations×4, CAT 1×2) + occupancy via `useRoomOccupancy` | **Closest to a site comparison.** The load score is an arbitrary weighting; do not reuse the score |
| `useRoomOccupancy` | Properties + rooms + active placements → occupancy per site/property, 5-second shared cache | **Reuse** (real beds and residents; no typed capacity) |
| `roomManagementLogic` (`propertyOccupancy`, `roomFlags`, `isPlaceholderRoom`) | Occupancy maths, `inspection_overdue` flag, placeholder-room detection | **Reuse** |
| `MaintenanceOpenWidget`, `ComplianceStatusWidget`, `FinanceBillsWidget`, `MyRequestsWidget`, `RecentNotificationsWidget` | Small count widgets via `WidgetShell` | Reuse `WidgetShell` loading/error/empty states |
| `GuestAnalyticsWidget`, `TransportKPIDashboard`, `PropertyOperationsOverviewWidget`, `VulnerabilityRiskBreakdown`, `CommercialWelfareBreakdown` | Domain analytics | Keep as they are; out of scope |
| `deriveInAppNotifications` + `filterNotificationsForRole`, `isSameSite`, `buildSiteAliases` (`inAppNotificationService.ts`) | Strict, site-aware visibility rules; strict site-name/id reconciliation | **Reuse for site matching and activity visibility** |
| `attendanceLogic.ts`, `maintenancePriority.ts` (`getSlaInfo`) | Pure, tested overdue rules | **Reuse as the template for dashboard selectors** |
| `ExportDropdown`/`ExportModal`, `exportTableToCsv/Pdf` | Exports | Reuse |

### 4.2 Conflicts with the stated UI rules
| Rule | Existing behaviour |
|---|---|
| No animation | Recharts `isAnimationActive` is never set to false (Recharts default is animated) in the two dashboard chart files (`DashboardAnalytics`, `GuestAnalyticsWidget`); 61 animation/transition-class matches across the 10 dashboard files; summary cards use `transition-all hover:shadow-md`, `group-hover` colour changes |
| Compact | `summaryCards`: `p-3.5`, `text-3xl`, 20-px icon block, footer link row. `keyStats`: 5 cards of `text-2xl` |
| Rows before data | Title + description paragraph + action buttons (≈70 px) → dashboard toolbar (≈50 px) → filter bar (≈50 px) → widgets |
| Duplicate controls | Dashboard has its own site filter, synced to the top-bar site selector by an effect (`DashboardView.tsx:83-85`) |

These components should be **left untouched**; the new page uses new, compact components.

### 4.3 Existing filtering and search
`FilterBar` (site, month, status, text). Month filters only match `dateReferred`. Search is page-local; `globalSearchFilter` lets the header search pre-fill some pages (Maintenance consumes it at `MaintenanceTrackerView.tsx:107-112`).

---

## 5. Management Questions and the Data Available to Answer Them

| Question | Answerable today? | From | Caveat |
|---|---|---|---|
| What is happening across the organisation? | Yes (counts) | Context datasets + master data | Safeguarding totals only meaningful with stated definitions |
| What needs attention today? | **Partly** – only from modules with dates | Maintenance, compliance (derived), PEEP, follow-ups, room inspections, room issues, critical open items | Missed checks, NTV, referral follow-ups not included |
| What is overdue? | **Partly** – per module, not a universal "tasks" count | As above | No central ledger; do not label as "all overdue tasks" |
| What is due soon? | Yes for dated records | Same sources | Window: 7 days (maintenance, follow-ups), 30/90 days (compliance) |
| Which sites have operational issues? | Yes | Per-site rollup | Needs strict site reconciliation (§12.4) |
| Which maintenance jobs are outstanding? | **Yes** | `maintenance_records` | Use one closed/open predicate |
| Which compliance requirements are approaching deadlines? | Yes | `compliance_records.expiry_date`, `property_compliance.expiry_date` | Two stores; manual status must be ignored |
| Which inspections or checks have been missed? | **No** | – | No schedule exists. Room *inspection* overdue (`next_inspection_due`) is available but is a different thing |
| Which properties have unresolved issues? | Yes | `room_issues` (open), maintenance by site, compliance by property | Property granularity only for room issues and property compliance; maintenance is site-level |
| Which tasks require management intervention? | Partly | CAT 1 open, expired compliance, high-risk, escalations unassigned/open | Define "intervention" as a fixed rule list (§8.2) |
| Which teams have outstanding actions? | **No** | – | No team entity. `user_groups` exists but is not linked to records; assignee fields are inconsistent (`assigned_to` vs free-text `contractor`) |
| What is completed versus outstanding? | Yes, per module | Status fields | Completed-in-period needs a reliable completion date (maintenance has one; others do not) |

**Rule applied throughout:** if a number cannot be reproduced exactly by listing the underlying rows, it is not shown.

---

## 6. Proposed Dashboard Sections (what to build, what to exclude)

| Section | Verdict | Reason |
|---|---|---|
| A. Global KPI strip | **Build** with the 8 supported metrics in §7 | |
| B. Attention required | **Build** – rule-based list from dated modules; extend later | Missed checks/NTV excluded until supported |
| C. Operational overview | **Build** – one matrix, not 8 widgets | Compact |
| D. Site performance | **Build** – one comparison table | Data supports it (§9) |
| E. Upcoming deadlines | **Build** | Dated records exist |
| F. Recent activity | **Build in a later phase, behind a check** | Audit data usable but module labelling is unreliable (§8.6) |
| Charts (bar/pie/area) | **Do not include** in phase 1 | Tables with inline static bars carry more information per pixel and honour the no-animation rule |
| "Missed checks" KPI | **Exclude** | Not calculable |
| "Overdue tasks (all)" KPI | **Exclude** until the obligations ledger exists | Would silently omit modules |
| "Teams with outstanding actions" | **Exclude** | No team data |
| "Vacant properties" | **Exclude as stated; offer "Vacant rooms/beds"** | Properties are buildings; vacancy is only defined at room/bed level (§7.1) |
| Resident names in activity/attention rows | **Limit** to reference + room for staff without safeguarding access | Existing pages hide `safeguardingConcerns` behind `canViewSafeguarding`; the dashboard must not leak what a page hides |

---

## 7. KPI Definitions

All KPIs are **as of now** unless stated. All are filtered by the selected site(s) and by the user's authorised sites. Click-through targets are listed; the mechanism is in §14.

### 7.1 The KPI strip (8 cells)

| # | KPI | Definition | Source | Click opens |
|---|---|---|---|---|
| 1 | **Active sites** | Sites with `lifecycle_state = 'Active'` and `status` not closed, within the user's scope | `sites` (context `properties`) | Properties Directory (admin) / own sites |
| 2 | **Occupancy** | Residents ÷ beds across rooms in use. Shown as `residents / beds` and `%`; "—" for sites with no rooms set up. Context line: `free beds`, `rooms out of use` | `useRoomOccupancy` → `propertyOccupancy` (`properties`, `property_rooms`, `room_beds`, active `placements`) | Property Management |
| 3 | **Active residents** | Count of **active placements** (not `service_users` rows), excluding orphan placements (room not in the loaded set) | `placements` where status Active | Service Users, filter Active |
| 4 | **Open maintenance** | Defects where not (`defectStatus = Completed` **or** `action = Closed`). Context: `n CAT 1` | `maintenance_records` | Maintenance, status filter Open |
| 5 | **Overdue maintenance** | Open defects with `complete_by` in the past (`getSlaInfo.state = 'overdue'`). Context: `n due in 24 h` | `maintenance_records.complete_by` / `closeDueDate` | Maintenance, Complete By = Overdue (filter now exists) |
| 6 | **Compliance** | Expired + expiring ≤ 30 days, **derived from expiry date**. Context: `n expired · n ≤30 d` | `compliance_records.expiry_date` (+ `property_compliance.expiry_date`, §12.3) | Compliance, expiry window |
| 7 | **Overdue reviews & follow-ups** | PEEP reviews overdue + absence follow-ups overdue + room inspections overdue. Context split in tooltip. **Named exactly that**, not "overdue tasks" | `peep_plans.review_date`, `absence_followups.due_date`, `property_rooms.next_inspection_due` | Attention table filtered to these |
| 8 | **Open escalations** | `status ≠ Resolved`. Context: `n unassigned` is **not** available (no assignee column on the app type) – show `n critical urgency` | `escalations` | Escalations |

Optional 9th for finance users only: **Approvals awaiting me** (`taskForUser`).

Not offered: Occupied/Vacant **properties** (building-level occupancy is not a stored concept; a building is "occupied" if any room is – misleading). Show **rooms available / beds free** in KPI 2's context instead. Not offered: Missed checks (§5), Overdue tasks (§6).

### 7.2 Calculation rules (must be code, shared, and unit-tested)
1. **Time:** "today" and "now" in **Europe/London**. The codebase mixes UTC (`toISOString().slice(0,10)`, `attendanceLogic.ts:45`) and browser-local (`maintenancePriority.ts`) time; between 00:00 and 01:00 BST these give different days. The dashboard selectors take `now` as an argument and use one London helper.
2. **Dates stored as TEXT** (`compliance_records.expiry_date`, `referrals.follow_up_date`, dispersal dates): parse with an explicit `YYYY-MM-DD` parser; unparseable values are **counted and listed in a "data quality" footnote**, never guessed. Dispersal/NTV dates (documented `MM/DD/YYYY`) are excluded until the format is confirmed.
3. **Compliance status is derived, not read.** `status` is hand-picked from a dropdown, so a lapsed certificate can read "Compliant". Derive: expired if `expiry < today`; due ≤30 d; due ≤90 d; otherwise valid. Keep manual `In Progress` as an annotation ("renewal in progress"), shown but not suppressing the count.
4. **Maintenance open/closed:** `isMaintenanceClosed` (`maintenancePriority.ts`): `Completed` or `Closed`. The sidebar badge and `PropertyLoadBreakdown` should be aligned to it in a later change (they currently disagree).
5. **Active placement:** `isActivePlacement` (`roomManagementLogic.ts`).
6. **Exclude placeholder rooms:** `isPlaceholderRoom`.
7. **Period filter** applies **only to flow metrics** (raised in period, completed in period, checks recorded in period). **State metrics** (open, overdue, expiring) are always "as of now" and are labelled as such. Mixing the two is the commonest source of dashboard distrust.
8. **No duplicate counting:** an item appears once in Attention Required, under its highest-priority reason (§8.2). KPI totals equal the number of rows shown when the KPI is clicked.

---

## 8. Dashboard Structure and Exact Data Sources

### 8.1 Where each dataset comes from

| Dataset | Already in `AppContext`? | Otherwise fetched via |
|---|---|---|
| maintenance, compliance, escalations, referrals, vulnerable, challenging, welfare checks, room checks, RFA/MH welfare, dispersal, evictions, GP appointments, requests, finance bills, sites, users, audit (latest 500) | **Yes** | – |
| properties (master), rooms, placements | No | `suPropertyService` (`useRoomOccupancy` caches 5 s; refreshes on `sdtracker:masterDataUpdated`) |
| service users | No | `suPropertyService.getServiceUsers` |
| PEEP plans | No | PEEP service/`suTrackerService` |
| absence follow-ups | No | `suTrackerService` |
| room issues, room beds | No | `roomManagementService` |
| property compliance, assets | No | `suPropertyDetailsService` |

Phase 1 adds **one** composed hook that gathers the "No" rows in a single parallel request set and shares a short cache, in the style of `loadRoomOccupancy`.

### 8.2 Attention Required – rules and priority
One row per item. Ranking = rule priority, then days overdue (desc), then site. Cap 10 visible with "show all" and a per-reason count line.

| Priority | Rule | Source | Open item |
|---|---|---|---|
| 1 | CAT 1 maintenance open (any age) | `maintenance_records` | the defect |
| 2 | Maintenance overdue (CAT 2 Interim, CAT 2, CAT 3) | `complete_by` | the defect |
| 3 | Compliance expired | derived | the certificate |
| 4 | Escalation open, urgency Critical/High | `escalations` | the escalation |
| 5 | Absence follow-up overdue | `absence_followups` | follow-up |
| 6 | PEEP review overdue (High-risk plans first) | `peep_plans` | plan |
| 7 | Room issue overdue (`due_date` past, status Open/In Progress), urgent issues blocking a room | `room_issues` | issue |
| 8 | Room inspection overdue | `property_rooms.next_inspection_due` | room |
| 9 | Compliance due ≤ 7 days | derived | certificate |
| 10 | Data change request pending > N days (needs agreed N) | `data_change_requests` | request |

Excluded until supported: missed room checks, missed welfare checks, outstanding NTV actions, referral/vulnerable review overdue (TEXT dates; add once parsing is tested).

Columns: reason (static coloured tag), item, site/room, due or age, owner (only where the record has one: absence follow-up `assigned_to`, room issue `assigned_to`; otherwise "—").

### 8.3 Operational Overview – one matrix
Rows × columns: **Outstanding | Overdue | Due ≤ 7 d | Completed (in period)**. A cell is shown only where it is calculable; otherwise "—".

| Row | Outstanding | Overdue | Due soon | Completed in period |
|---|---|---|---|---|
| Maintenance | open | `complete_by` past | within 24 h / 7 d | `actualClosedDate` in period |
| Compliance | not valid | expired | ≤ 30 d | – (no completion record) |
| PEEP reviews | active plans | review past | ≤ 30 d (existing `REVIEW_WARNING_DAYS = 30`) | `last_reviewed_at` in period |
| Absence follow-ups | Open + In Progress | `due_date` past | – | `resolved_at` in period |
| Room inspections | rooms in use | `next_inspection_due` past | ≤ 7 d | `last_inspected_at` in period |
| Room issues | Open + In Progress | `due_date` past | ≤ 7 d | `resolved_at` in period |
| Escalations | not Resolved | – | – | resolved in period (no resolve timestamp; use `updatedAt` only if agreed) |
| Referrals / Vulnerable / Challenging | not Archived (by status) | – (TEXT dates) | – | status Completed in period (no completion date; **exclude column**) |
| Welfare checks | – | – | – | **recorded** in period |
| Room checks | – | – | – | **recorded** in period; `n Attention Required` |
| Dispersal / Evictions | evictions Notice Issued / Appeal Pending | – | – | – |
| Change requests | Pending | – | – | decided in period |

Each cell is clickable.

### 8.4 Upcoming Deadlines
Next 14 days by default (selector: 7 / 14 / 30 / 90). One table, sorted by due time:

| Type | Date | Source |
|---|---|---|
| Maintenance Complete By | `complete_by` | open defects |
| Compliance expiry | `expiry_date` | both stores |
| PEEP review | `review_date` | `peep_plans` |
| Room inspection | `next_inspection_due` | rooms |
| Room issue due | `due_date` | `room_issues` |
| Asset PAT / service due | `patNextDue`, `nextServiceDue` | `property_assets.data` (client-side only) |
| GP appointment | `appointment_date` | scheduled appointments (informational) |

Due representation: absolute date/time, plus relative ("in 3 d", "tomorrow 16:30"), plus a static tag for ≤ 24 h. No countdown timers (they imply motion).

### 8.5 Site Performance
Supported (§9). Columns: **Site · Occupancy (res/beds) · Open maint. · Overdue maint. · CAT 1 · Compliance expired/≤30 d · Overdue actions · Open escalations**. Sorted by a transparent rule (overdue maintenance + expired compliance + CAT 1 + overdue actions, descending), **not** the existing opaque load score. Numeric cells turn red only when >0 for overdue/expired. No chart.

### 8.6 Recent Activity – feasibility
- **Source:** `audit_trails` (latest 500 loaded; columns `timestamp`, `user`, `role`, `action`, `details`, `site`, `entity_type`, `entity_id`, `module`, `target_label`).
- **Problems found:** maintenance and compliance creates are logged with `module: 'Settings'` (`AppContext.tsx:3430`, `3900`), so a module filter would mislabel them; the Audit page is restricted to Admin/Super Admin, so showing audit text to others is a visibility decision; `details` strings can contain resident names.
- **Recommendation:** include **in phase 3, not phase 1**, as a 10-row feed built from `entity_type` (reliable per docs/live-database.md: "entity_id always set"), site-scoped with the same rules as `filterNotificationsForRole`, showing event verb + module + reference + time only (no free-text details). Offer it only if a spot check of live `entity_type` coverage is clean **[unverified]**.

---

## 9. Site-Level Comparison – is the data there?

| Needed | Present? | Join |
|---|---|---|
| Residents / beds per site | Yes | `placements.site_id`, `property_rooms` via `properties.site_id` |
| Open/overdue maintenance per site | Yes | `maintenance_records.site` (**name**) |
| Compliance per site | Yes | `compliance_records.site_name` (name) and `property_compliance.property_id` → `properties.site_id` |
| Escalations per site | Yes | `escalations.site` (name) |
| Overdue actions per site | Yes | follow-ups/PEEP via `su_id` → active placement → site; room inspection via property |
| Missed checks per site | **No** | – |

**Key risk:** sites are referenced by name in some tables and by id in others, and the app's own matcher (`isSitePermitted`) is substring-based (`AppContext.tsx:2271`), so "Brit" matches "Brit Hotel" and any other name containing it. The dashboard must resolve every record to a canonical **site id** once (via `buildSiteAliases` + `isSameSite`, exact after normalisation) and group by id. Records that resolve to no site are reported in the data-quality footnote and **not** silently dropped or lumped into a site.

---

## 10. Layout Specification

Principles: one screen of decisions first; tables not charts; no motion; every number is a link; consistent compact density (`text-xs`, 28-px table rows, 6–8 px gaps). Reuse the app's existing visual language (neutral greys, teal accent `#0d9488`, red `#a4262c`, amber, square `rounded-xs` corners, 1 px borders). No shadows beyond `shadow-xs`, no gradients, no hover transitions (colour change on hover is applied instantly).

### 10.1 Page structure (desktop ≥ 1280 px)

```
┌ HEADER (1 row, ~44 px) ───────────────────────────────────────────────────────────┐
│ Operations Dashboard · Thu 12 Nov 2026 · [Site ▾] [Period ▾] [Search…]  Updated 14:32 · Refresh │
├ KPI STRIP (1 row, 8 cells, ~64 px) ───────────────────────────────────────────────┤
│ Sites 12 │ Occupancy 412/468 88% │ Residents 412 │ Open maint. 37 │ Overdue maint. 6 │ Compliance 3·9 │ Overdue reviews 14 │ Escalations 5 │
├ ABOVE THE FOLD (to ~560 px) ───────────────────────────────────────────────────────┤
│ ATTENTION REQUIRED (8 cols)                       │ UPCOMING DEADLINES (4 cols)     │
│ reason │ item │ site/room │ overdue by │ owner    │ date │ type │ item │ site        │
│ 10 rows, "Show all (n)"                           │ 12 rows, window selector        │
├ BELOW THE FOLD ────────────────────────────────────────────────────────────────────┤
│ OPERATIONAL OVERVIEW (matrix, 12 cols)                                              │
│ SITE PERFORMANCE (8 cols)                         │ RECENT ACTIVITY (4 cols) [phase 3]│
│ Data-quality footnote (collapsed): n records without a site, n unparseable dates    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- **Above the fold (1366×768 and up):** header, KPI strip, Attention Required, Upcoming Deadlines. These answer "what needs attention / what is overdue / what is due soon" without scrolling.
- **Below the fold:** Operational Overview (reference), Site Performance (comparison), Recent Activity (context). Rendered after first paint.
- **Tablet (768–1279 px):** KPI strip wraps to 2 rows of 4; Attention full width; Deadlines below it.
- **Mobile (< 768 px):** KPI strip 2 columns; Attention and Deadlines become stacked compact lists (existing `CompactRecordCard` pattern, `isMobileCompactView`); Overview matrix scrolls horizontally with sticky first column; Site table shows site + the two red numbers with tap-to-expand.

### 10.2 Component hierarchy

```
OperationsDashboardView            (page 'operations'; page-access gated)
├─ OpsHeader                       title · date · SiteSelect · PeriodSelect · Search · FreshnessStamp · RefreshButton
├─ OpsKpiStrip
│   └─ OpsKpi × 8                  label · number · context · onClick
├─ OpsAttentionTable               rows from selectAttention()
├─ OpsDeadlinesTable               rows from selectDeadlines()
├─ OpsOverviewMatrix               rows from selectOverview()
├─ OpsSiteTable                    rows from selectSites()
├─ OpsActivityFeed                 (phase 3)
└─ OpsDataQualityNote
hooks / selectors (pure, tested)
├─ useOperationsData()             composes context datasets + master data; one cache; exposes loading/error per source
├─ operationsSelectors.ts          selectKpis, selectAttention, selectDeadlines, selectOverview, selectSites  (all take `now`, `scope`, `period`)
├─ operationsRules.ts              definitions in §7.2 (London time, derived compliance status, open/closed predicates)
└─ useNavigateWithIntent()         page + filter / record intent (§14)
```
Shared small primitives: `OpsTable` (dense table, sticky header, 28-px rows), `OpsTag` (static coloured text tag), `InlineBar` (CSS width, no transition). Empty and loading states reuse `WidgetShell` semantics but without borders-within-borders.

---

## 11. Visual and UI/UX Rules (as applied)

- No CSS `transition`, `animation`, `transform` on hover, or Recharts animation. Loading = static text "Loading…" in the section; per-section so one slow source never blanks the page.
- Hover = instant background tint only. Focus = visible 2 px outline (accessibility).
- Colour carries meaning only: red = overdue/expired, amber = due soon, grey = neutral, teal = interactive. Never colour alone: tags carry text ("OVERDUE", "DUE 24H").
- Numbers right-aligned, tabular (`tabular-nums`); dates `DD MMM` (UK) with year only when not current.
- Table rows are links (whole row clickable) with a visible chevron-free affordance (underline on the item text).
- Empty states say what was checked: "No overdue maintenance at the selected sites." not a blank panel. A section whose source failed says "Could not load maintenance" (from `liveDataStatus.unavailable`), never "0".
- Print/export: reuse `exportTableToPdf/Csv` for the Attention and Deadlines tables.

---

## 12. Data Accuracy, Performance and Missing Data

### 12.1 Retrieval strategy
1. **Phase 1 – client-side selectors on data already loaded.** One composed hook, one pass per dataset, memoised on (dataset versions, site scope, period, `now` rounded to the minute). Cost is linear in rows; with the 50,000-row ceiling per table the worst case is still milliseconds–tens of milliseconds [estimate; measure with real data].
2. **Phase 2 (only if needed) – a Postgres RPC `ops_dashboard_summary(p_site_ids, p_as_of)`** returning the same shape, once data volume or the obligations ledger (earlier plan) makes client aggregation impractical. It is justified only then; existing tables suffice for every phase-1 KPI.
3. **No new tables for the dashboard.** The obligations/`check_schedules` tables belong to the earlier plan and unlock the excluded metrics; they are a dependency, not a dashboard feature.

### 12.2 Index requirements (existing)
Present: `property_compliance(expiry_date, status)`, `room_issues(property_id,status)`, `placements(status, site_id, room_id)`, `peep_plans(review_date)`, `absence_followups(status)`, `room_checks(inspection_date)`, `welfare_checks(check_datetime)`, `maintenance_records(complete_by)` (migration 033, partial on open rows). Needed only for the phase-2 RPC: none beyond these. `compliance_records.expiry_date` is TEXT and cannot be indexed usefully; fine for client-side use.

### 12.3 Duplicate-counting hazards (decide before build)
- **Two compliance stores** (`compliance_records` global tracker, `property_compliance` per property). Both can describe the same certificate. Proposal: KPI 6 sums them only if a business rule says they are disjoint; otherwise show the global tracker only and list property compliance separately. **Decision needed.**
- **Room issue ↔ maintenance defect:** `room_issues.maintenance_record_id` links them. An issue with a linked defect must not be counted twice.
- **Resident counts:** `service_users` rows ≠ placements (a resident may have none, or a historical one). Use active placements; report orphan placements.
- **Escalation vs referral vs incident:** distinct records; never summed into one "cases" figure on this dashboard.

### 12.4 Data freshness and cache
- Data is current to the last sync: realtime patches for high-traffic tables and a **5-minute poll** (`AppContext.tsx:2095`); master data is fetched on demand with a short cache.
- Header shows "Updated hh:mm" from `liveDataStatus.lastSyncAt` and per-source failures from `unavailable[]`.
- **Refresh button:** the context does not currently expose a sync trigger (`backgroundSyncRef` is internal). Add one exported function; until then refresh can only re-fetch the master-data hook.
- No separate cache layer; the existing in-memory state is the cache. `now` ticks once a minute so overdue states flip without reload.

### 12.5 Pagination
Attention and Deadlines show a capped slice with a "Show all" expand (in place, no navigation); beyond 100 rows the tables link to the module page with the same filter. Site table is bounded by the number of sites.

### 12.6 Missing data and dependencies (summary)
| # | Gap | Impact | Resolution |
|---|---|---|---|
| 1 | No way to open a page filtered, or open a record | Click-through requirement | Navigation-intent mechanism (§14) |
| 2 | No exported refresh | Refresh requirement | Expose sync function |
| 3 | No schedule for room/welfare checks | Missed-check KPI/attention | Earlier plan phases 5–6 |
| 4 | No overdue ledger | Universal overdue KPI | Earlier plan phase 2 |
| 5 | Compliance status manual | Compliance KPI | Derive in selector (no schema change) |
| 6 | Site name/id inconsistency; substring matching | Site rollups | Canonical site-id resolver; report unmatched |
| 7 | TEXT dates; mixed UTC/local days | Deadlines/overdue | London-time helper + strict parsers + data-quality note |
| 8 | Two compliance stores | Double counting | Business decision |
| 9 | Different "open maintenance" definitions across screens | Trust | Adopt `isMaintenanceClosed` everywhere (later, separate change) |
| 10 | NTV/dispersal date format ambiguous; no deadlines | NTV attention rows | Confirm format and deadline rules |
| 11 | No team entity; inconsistent assignee fields | "Teams with outstanding actions" | Excluded; revisit after assignee model decided |
| 12 | Audit module labels (`Settings` for maintenance/compliance) | Activity feed | Use `entity_type`; verify live coverage |
| 13 | Placeholder rooms in seed data | Occupancy inflation | Exclude via `isPlaceholderRoom` |
| 14 | RLS: any authenticated user reads all rows in direct mode | Dashboard scope is advisory | Out of scope here; see earlier audit §16 (the anon-policy script needs checking urgently) |

---

## 13. Permissions and Role Variations

### 13.1 Enforcement model (unchanged from the rest of the app)
1. **Page access:** new page id `operations` added to `pageRegistry.ts` and `pagePermissionsConfig.ts`, so Super Admin per-user overrides, maintenance mode and sidebar visibility work automatically.
2. **Section/KPI gating:** each KPI and section declares the pages it needs (`maintenance`, `compliance`, `peepTracker`, `suAttendance`, `escalations`, `propertyManagement`, …); if the user cannot view **any** required page it is **hidden, not zero** – the same rule `isWidgetAvailable` applies. A KPI that mixes sources (KPI 7) shows only the parts the user may view and says which are included.
3. **Site scope:** every selector receives the user's authorised site-id set (`allowedSites` → ids). Nothing outside it is computed, so it cannot leak through a total.
4. **Safeguarding content:** rows show reference, room and item type; resident names and free-text details appear only where the user can already open the source page's detail view (`canViewSafeguarding`).
5. **Server/RLS:** unchanged. If/when the earlier plan introduces site-scoped RLS helpers, the phase-2 RPC will use them.

### 13.2 Variations
| Role | Default view | Differences |
|---|---|---|
| Super Admin, Admin, Regional Manager | All sites | Full KPI strip; Site Performance expanded and **first below the fold**; Finance cell if finance user; Recent Activity (when built) |
| General Manager, Area Manager | Assigned sites (all if "All Sites") | Same layout; Site table shown only if > 1 site; no admin links |
| Staff | Single assigned site | Site table and site selector hidden; KPI 1 hidden; Attention and Deadlines emphasised ("my site"); owner column shows items assigned to them first |
| Finance users | As above | Adds "Approvals awaiting me" cell; finance rows never appear in Attention for non-finance users |
| Users with page-access overrides | Whatever they can view | Sections self-hide; if fewer than 2 sections remain, show a short message and links |

---

## 14. Interactions

| Interaction | Behaviour | Needs |
|---|---|---|
| KPI click | Opens the module with the matching filter applied (table in §7.1) | `navigateWithIntent(page, { filters })` stored in context and consumed once by the target page; each target page adopts the filters it already has (Maintenance: status, priority, action, Complete By; Compliance: status; Escalations: status) |
| Attention/Deadline row click | Opens the module and the record's view modal (maintenance already has `viewRecord`; others have detail modals) | `{ recordId }` intent |
| Site selector | Updates every section. Bound to the **same state as the top-bar site switcher** (`defaultSiteFilter`) – no second selector state | – |
| Period selector | Today / 7 d / 30 d / This month / Custom. Affects only "completed/recorded in period" cells; labelled "Period affects: Completed, Checks recorded" | – |
| Search | Filters rows in Attention and Deadlines (item text, site, room, reference). It is not a global search; the header search already exists | – |
| Refresh | Re-pulls context datasets and master data; updates the timestamp; no page reload | Exposed sync function |
| Empty / error / loading | As §11 | – |
| Keyboard | Tab order KPI → tables; Enter on row opens; Esc clears search | – |

Minimal-change principle for those dependencies: they are additive (a context field and a hook); existing pages that do not read the intent behave exactly as now.

---

## 15. Performance Optimisation Strategy

1. **One snapshot, many views.** A single memoised `useOperationsSnapshot` computes all selectors from the same indexed dataset maps (by site id, by property, by `su_id`) in one pass each; the existing widgets re-filter the same arrays 5–10 times each.
2. **Render budget.** Header + KPI strip + two tables render first (≤ ~25 rows). Below-fold sections render after first paint (`requestIdleCallback`/deferred state); `React.lazy` only if the bundle grows measurably.
3. **No Recharts on this page** → smaller work and no animation. `InlineBar` is a `<div>` with a width.
4. **Minute tick, not second tick.** `now` updates once per minute and only recomputes the time-dependent selectors.
5. **Master data de-duplication.** Reuse `loadRoomOccupancy`'s shared in-flight promise pattern for properties/rooms/placements; add PEEP, follow-ups, room issues and property compliance to one `Promise.all`.
6. **Avoid unnecessary requests.** No dashboard-specific polling; piggy-back on realtime and the 5-minute poll; refresh is user-initiated.
7. **Measure.** Add a development-only timing log for snapshot computation and set an acceptance threshold (e.g. < 50 ms for 10,000 total rows) on real data **[unverified]**.
8. **Phase 2 trigger.** Move aggregation to an RPC only if measured snapshot time or payload size exceeds the threshold, or when the obligations ledger exists.

---

## 16. Testing Strategy

- **Unit (pure selectors, `node:test`, house style of `tests/attendanceLogic.test.ts`):** every KPI definition with fixtures; London-time boundaries (BST/GMT, 00:30 on a BST day); TEXT-date parsing incl. malformed; site resolver (exact vs substring trap; records with no site); dedupe rules (room issue ↔ maintenance link); period vs state metric separation; role/site scoping (staff cannot influence totals for other sites); "hidden, not zero" gating.
- **Reconciliation test:** for each KPI, `kpi.count === rows.length` of the list it opens.
- **Component:** empty/error/loading states; no animation (assert no `transition`/`animate` classes and no Recharts import in the page's component tree).
- **End-to-end (Playwright, already a dev dependency):** KPI click lands on the filtered module with the same count; row click opens the record; site selector narrows every section; a user with `maintenance` page access removed sees no maintenance KPI.
- **Shadow comparison before release:** compare each KPI to a manual count on two sites with an operations lead.

---

## 17. Implementation Roadmap

| Phase | Scope | Depends on | Est. |
|---|---|---|---|
| **0. Decisions** | §18 questions 1–6; confirm compliance-store rule; confirm site naming clean-up | – | 0.5 wk |
| **1. Foundations (no UI)** | `operationsRules.ts` (London time, derived compliance status, open/closed predicates, site resolver); `useOperationsData`; `operationsSelectors.ts`; full unit tests | 0 | 1.5 wks |
| **2. Navigation intent + refresh** | Context additions (`navigateWithIntent`, `refreshLiveData`); adopt filters in Maintenance, Compliance, Escalations (additive); tests | 1 | 1 wk |
| **3. Dashboard v1** | Page, header, KPI strip, Attention, Deadlines; registry/permissions/sidebar entry; role variations | 1, 2 | 1.5 wks |
| **4. Overview + Site Performance** | Matrix and site table; data-quality note | 3 | 1 wk |
| **5. Activity feed** (conditional) | After live `entity_type` check; site-scoped, reference-only | 3 | 0.5 wk |
| **6. Missed-check and universal overdue metrics** | When earlier plan phases 2 and 5–6 are live: add KPI and Attention rules; optional RPC | earlier plan | 1 wk |
| **7. Hardening** | Performance measurement, accessibility review, align sidebar/PropertyLoad definitions, optional widget versions for the personal-dashboard builder | 3–4 | 1 wk |

Total phases 0–5: **about 6–7 developer-weeks**; complexity **Medium** (low technical risk, high definition/coordination risk). No database change is required for phases 0–5.

### 17.1 Deployment and rollback
- New page behind page-access: ships **hidden to everyone except Super Admin** (default permission list), then widened by role.
- Entirely additive; rollback = remove the sidebar entry/registry id (page unreachable) or revert the commit. The two context additions are inert if unused. No data is written by the dashboard.

---

## 18. Questions Requiring Business Decisions

1. **KPI wording:** "properties" – do you mean **sites/hotels** (what `sites` stores and managers think of as properties) or **buildings** (the master `properties` table)? Occupied/vacant is only meaningful for rooms/beds; is **occupancy % + free beds** acceptable in place of "vacant properties"?
2. **Compliance:** are the Compliance Tracker and per-property compliance two views of the same certificates, or different things? Which is authoritative for the KPI?
3. **Reminder windows:** compliance "due soon" at 30 days (current rule) – also 90? PEEP due-soon 30 days (current)? Maintenance due-soon 24 hours?
4. **Reporting period:** which metrics must respond to it (proposal: completed/recorded only)? Default period?
5. **Attention rules:** is the priority order in §8.2 right? Is any open escalation, regardless of urgency, an intervention item? How old may a pending change request be before it appears?
6. **Who sees what:** may Staff see compliance and escalations counts for their site? May General/Area Managers see other sites' totals when comparing?
7. **Activity feed:** is a reference-only feed acceptable, or must it show descriptive text (which may contain resident details)?
8. **Missed checks:** when will room- and welfare-check frequencies be decided (earlier audit §19 Q2–Q3)? Until then the KPI stays absent.
9. **NTV:** which NTV/dispersal steps have deadlines, and are dates day-first or month-first?
10. **Teams:** is "team" a site team, a user group, or a role? Until defined, no team metrics.
11. **Placement:** replace the current Executive Dashboard as the landing page for managers, or add alongside it (recommended: alongside, as a new sidebar entry under Overview)?

---

## 19. Final Recommendations

1. **Build a new `operations` page**; do not modify the Executive Dashboard or its widgets.
2. **Define before drawing.** Phase 1 is a tested rules and selector layer; the UI is thin on top of it. The most valuable outcome is that every number equals the rows behind it.
3. **Ship only what is accurate now:** 8 KPIs, Attention, Deadlines, Overview, Site table. Leave missed checks, universal overdue, NTV and team metrics out until their data exists; add them when the earlier plan delivers them.
4. **Use tables, inline static bars and tags**; no charts, no animation, no oversized cards. Above the fold: header, KPI strip, Attention, Deadlines.
5. **Make click-through real**: add the small navigation-intent and refresh additions before building the page.
6. **Resolve sites by id once**, and surface data-quality counts (unmatched site, unparseable date) instead of hiding them.
7. **No database work for the dashboard itself.** Existing tables hold every phase 1–5 metric; the only schema item it benefits from (`complete_by`) already exists in migration 033.
8. **Treat the RLS findings as separate and urgent:** the dashboard aggregates only what a browser can already read, which for direct-Supabase users is everything.

*End of audit and design. No dashboard code has been written. Awaiting approval and the decisions in §18 before any implementation.*
