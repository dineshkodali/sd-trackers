# SDTracker – Operations Dashboard v2: metrics map, design and delivery notes

Prepared 20 November 2026. Builds on `SDTRACKER_CENTRAL_DASHBOARD_AUDIT_AND_DESIGN.md` (v1 audit), `SDTRACKER_OVERDUE_AND_NOTIFICATION_AUDIT.md` and `SDTRACKER_ROUTE_AUDIT.md`, which already hold the page-by-page inventory (49 routed pages), schema and RLS findings. This document does not repeat them; it records what changed, the metric definitions, and what is still not possible.

**What was verified and what was not.** Verified by reading the code, by unit tests (below) and by a clean `tsc` and `vite build`. **Not verified:** the dashboard was not opened against the live database or in a browser (it needs a signed-in session), the two-user and network-drop scenarios were not exercised end to end, and migration 039 has not been applied to any database.

## 1. Starting point

The Operations Dashboard (`src/components/operations/OperationsDashboardView.tsx`, page id `operations`) already existed: KPI strip, attention list, deadlines, overview matrix, site table, activity, and the guest-statistics, priority-vulnerable and transport widgets. It reads AppContext lists (which Realtime patches) plus master data loaded once. Gaps against the brief:

| Gap | Resolution |
|---|---|
| No New Arrivals / Dispersal / Eviction figures | `utils/operationsDepartments.ts` |
| No department table | `DepartmentTable` |
| Room/Welfare checks shown only as one monthly card | `ChecksMonitor` (per review, ratios, overdue list) |
| No maintenance table or averages | `MaintenanceOverviewSection` |
| No vulnerable / disability / PEEP-GEEP / interconnecting counts | `selectResidentProfile` + `ResidentPropertySection` |
| **Rooms, placements, residents, PEEP, follow-ups, room issues, room checks and welfare checks were not in the Realtime layer**; another user's edit appeared only after the 5-minute poll | `operationsRealtime.ts`, `useOperationsLive.ts`, migration 039 |
| Master-data reload blanked the page ("Loading…") every time | Only the first load shows Loading; later reads replace numbers in place |

## 2. KPI and column definitions

All dates are Europe/London. Site matching is exact (never substring). A figure that cannot be computed is `—`, never `0`. Every module row is hidden if the user cannot open that module's page.

| KPI | Definition | Opens |
|---|---|---|
| Active service users | Active placements in scope (excludes orphan and placeholder rooms) | Service Users |
| Occupied rooms | Rooms in use with ≥1 active placement | Property Management |
| Available rooms | Rooms in use with no active placement (out-of-use rooms excluded) | Property Management |
| Properties | Master properties with status Active in scope | Property Management |
| New arrivals today | `new_arrivals_records.check_in_date` = today; compared with yesterday | Live Daily Registers |
| Dispersals today | Dispersal date = today (MM/DD/YYYY or ISO only); compared with yesterday | Dispersal Sheet |
| Open maintenance | Not Completed and not Closed (the tracker's own rule) | Maintenance, `open=1` |
| Overdue items | Sum of: overdue maintenance, expired compliance, overdue PEEP/follow-up/inspection/room-issue, overdue room + welfare checks, overdue dispersals, overdue evictions. Tooltip lists the parts. Modules without a deadline are not included. | Department table |

Department table columns (a dash = the module does not record that status):

| Module | Total | Completed | Pending | In progress | Due today | Overdue |
|---|---|---|---|---|---|---|
| New arrivals | check-ins in period | – | – | – | check-in today | – |
| Dispersals | not departed + departed in period | departed in period | not yet due | – | due today | past date, not departed |
| Evictions | Notice Issued/Appeal Pending + Evicted in period | Evicted in period | Notice Issued, not yet due | Appeal Pending | eviction date today | Notice Issued, date past |
| Welfare / Room checks | checks owed this month (2 per occupied room / placed resident) | done (incl. late) | pending | – | pending with deadline today | past deadline, none done |
| Maintenance | open | closed in period | – | – | Complete By today, not yet passed | Complete By passed |
| Laundry | jobs dated in period | Collected | Queued | Washing/Drying/Ready | – | – |
| Escalations | not Resolved | – | Active | other open statuses | – | – |

Dispersal: a second cycle supersedes the first only when its own date has been entered. Completed = `travelled = Yes` or a left-property date.

## 3. Reusable aggregation functions (pure, tested)

`utils/operationsDepartments.ts`: `parseFlexDate`, `collectFlowFacts`, `selectFlowCounts`, `selectDepartmentRows`, `checkCounts`, `monitorChecks`, `listOverdueChecks`, `selectMaintenanceOverview`, `selectSiteFlowRows`, `selectResidentProfile`.
Existing and reused: `utils/operationsSelectors.ts` (`buildSnapshot`, `selectDeadlines`, `selectOverview`), `utils/checkObligations.ts`, `utils/operationsRules.ts`, `utils/guestStats.ts`.

## 4. Real-time design

* `services/operationsRealtime.ts`: one shared, reference-counted channel on `properties, property_rooms, room_beds, placements, service_users, peep_plans, absence_followups, room_issues, room_checks, welfare_checks`. An event carries no data into the screen; it only says "this table changed".
* `hooks/useOperationsLive.ts`: events are coalesced (800 ms quiet, 3 s maximum) into one re-read of the authoritative rows, so the database, RLS and lifecycle rules decide the numbers, not the event payload. Master tables re-read through the existing `sdtracker:masterDataUpdated` signal; check tables through AppContext's sync. Target latency ≈ 1–3 s plus network.
* Tables already patched by AppContext (maintenance, new arrivals, dispersals, evictions, escalations, compliance, daily registers, audit trail) need no new subscription. Laundry is listed in `REALTIME_TABLES` but whether AppContext patches resident laundry from it was not checked.
* Duplicates: dropped by a table+event+id+commit-timestamp key (rolling window of 200).
* Gaps: after the channel re-subscribes, the network returns, or a tab has been hidden for over a minute, everything is re-read (resync). While the link is down the dashboard re-reads every 60 s and says so in the header; while it is live there is no polling from here.
* Cleanup: the channel is removed when the last dashboard unmounts; listeners are removed on unmount.
* Header shows "Last synchronised" (latest of the three loaders) and a static link state (Live / Connecting / Reconnecting / Offline).

## 5. Migration

`db/migrations/039_operations_dashboard_realtime.sql` – adds the ten tables above to the `supabase_realtime` publication and sets `REPLICA IDENTITY FULL`. Idempotent, skips absent tables, adds no table/column/policy/data. **Must be applied** (`npm run db:migrate`) or the new subscriptions receive nothing and the dashboard falls back to the 60 s/5-minute reads.

## 6. Performance

Aggregation is **client-side**, over lists AppContext already holds plus one parallel master-data read (same design as v1, audit §12.1). It does **not** use server-side aggregation: that was the brief's preference, and it is the largest deviation. It was kept because the figures must equal the rows behind them and reuse the permission/site rules that live in the browser; a Postgres RPC is the planned next step if measured snapshot time or payload size becomes a problem (v1 audit §15.8). No animation, charts or transitions were added; the new sections add no libraries. Existing indexes (migration 037 and earlier) are unchanged.

## 7. Permissions

* Each section appears only if the user can open the underlying page (`canAccessPage`); a hidden module is not computed.
* Site scope: every selector receives the user's allowed site ids and the header selection; check rows are filtered by site id (the old name-based filter was replaced).
* Resident and property section shows counts only. The overdue-check list shows the resident name, as the brief requires, and is shown only to users who can open Room/Welfare Checks.
* No service-role credentials are used; all reads go through the existing RLS-enforced services. v1 audit §16 (RLS lets any signed-in user read all rows in direct mode) still applies and is unchanged.

## 8. Click-through

Maintenance (`open`, `sla`), Compliance, Escalations already accepted filters. Added: Room Checks and Welfare Checks accept `due` (all/completed/pending/overdue…) and `month`. New Arrivals, Dispersals, Evictions, Laundry, and Maintenance "due today / completed / new today" open the correct page **without** a filter (those pages have no matching filter); the tooltip says so. Site is not carried by a link (the target page uses its own site selection).

## 9. Testing

* New: `tests/operationsDepartments.test.ts` (12 tests: date parsing, today/yesterday flows, dispersal cycles, eviction buckets summing to Total, role visibility, maintenance row and overview, average completion only from jobs with both timestamps, check ratios, overdue list order, due-today, site scope, resident profile with no identities). `tests/navigationIntent.test.ts` updated for the two new pages.
* Result: `npm run test:unit` – 473 of 477 pass. The 4 failures are `migration 021/022/023/024 … schema.sql carries it verbatim`; they concern files this change does not touch and were not investigated further. `tsc --noEmit` and `vite build` are clean.
* **Not run:** create/modify/archive/restore/delete against a live database, two simultaneous users, offline/online reconnect, role-by-role screens, mobile/desktop screenshots. These need a signed-in session and the migration applied.

## 10. Metrics that cannot be calculated today

| Requested | Why |
|---|---|
| Maintenance: assigned engineer, awaiting assignment, awaiting approval | No such fields on `maintenance_records` |
| Maintenance "In progress" distinct from "Open" | One open status ("In Process") |
| Pending / incomplete Daily Registers | No register schedule or submission record |
| Meals, Catering, Transport (beyond funding), Inspections, Reports, Finance in the department table | Logs without expectations or deadlines; finance/transport have workflows but no agreed overdue rule |
| Welfare/room check "assigned staff" | Taken from property manager → site lead officer → site manager; there is no per-check assignment |
| Escalation completed-in-period | No resolved timestamp |
| Previous-day comparison for stock figures (open maintenance, occupancy) | No daily snapshots are stored; only flow figures (arrivals, dispersals) are compared |
| Reliable dispersal/eviction dates | Stored as text; only ISO and MM/DD/YYYY are read, others are excluded and not guessed |
| Teams | No team entity |
