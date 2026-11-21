# SDTracker – Operations Dashboard refinement: de-duplication, unified deadlines, activity, live connection

Prepared 21 November 2026. Follows `SDTRACKER_OPERATIONS_DASHBOARD_V2.md`. **Not verified:** the dashboard was not opened against the live database or in a browser; two-user, offline/online and role-by-role behaviour are covered only by unit tests of the pure logic. The request text ended mid-sentence at validation item 8, so only items 1–7 were addressed.

## 1. Audit of the v2 dashboard (before this change)

| # | Finding | Evidence |
|---|---|---|
| 1 | The same overdue maintenance job was counted in: "Overdue items" KPI, "Overdue maintenance" KPI, Attention table, Deadlines table, Department table, Overview matrix, Maintenance overview, Site table (8 places). | v2 view |
| 2 | Overdue room/welfare checks appeared in the Department table, the check monitor, the overdue-check list, the KPI sum and the site table. | v2 view |
| 3 | "Open maintenance" appeared as a KPI, a department Total, a maintenance-overview stat and a table. | v2 view |
| 4 | Attention (overdue) and Deadlines (upcoming) were two tables over the same facts; a task moved between them as time passed. | `operationsSelectors.ts` |
| 5 | "Overdue items" was a hand-built sum of several sources, so it could differ from any table's row count. | v2 view |
| 6 | Recent activity used `audit_trails` with `module` as stored (mislabels some creates as "Settings") and had no link, no verb mapping and no de-duplication. | v2 view |
| 7 | Finance, Transport, Dispersal and Eviction work had no place in any deadline list. | v2 view |
| 8 | Unsupported metrics shown as dashes: maintenance engineer/awaiting-approval, pending registers, meals/catering. | v2 doc §10 |
| 9 | Links: only Maintenance, Compliance, Escalations, PEEP, Absence follow-up, Property Management and the two check pages consume a record id or filter. Others open the page only. | `useNavigationIntent` users |

## 2. New structure (three sections, one definition each)

1. **Business overview** – 8 KPIs: Active service users, Occupied rooms, Available rooms, New arrivals today, Dispersals today, Open maintenance, **Outstanding tasks**, **Overdue tasks**.
2. **Operations & deadlines** – one table. *Outstanding* = number of rows; *Overdue* = rows in the overdue bucket. Both come from the same list (`utils/operationsTasks.ts`), so they cannot disagree with the table.
3. **Recent activity** – audit trail only (`utils/operationsActivity.ts`).

Removed (not duplicated elsewhere): exceptions KPI row, Attention table, Deadlines table, Overview matrix, Department table, Check monitor, Maintenance overview, Resident/property section, Site table, per-site breakdowns. Module detail stays in the module pages. The guest-statistics, priority-vulnerable and transport blocks below were placed there by an earlier change and were left untouched; they repeat module analytics and are candidates for removal if you want a stricter three-section page.

The header site picker is the single site control and governs every section (the table has no second site filter, to avoid two controls that can disagree).

## 3. Metric → source map

| Metric / table source | Source (table → app list) | Rule |
|---|---|---|
| Active service users | `placements` (Active) | placements in real rooms, in scope |
| Occupied / Available rooms | `property_rooms` + `placements` | rooms in use with / without a resident |
| New arrivals today | `new_arrivals_records.check_in_date` | = London today (yesterday for the comparison) |
| Dispersals today | `dispersal_records.dispersal_date` (text) | MM/DD/YYYY or ISO only; second cycle supersedes first |
| Open maintenance | `maintenance_records` | not Completed and not Closed |
| Maintenance task | `maintenance_records.complete_by` | priority: CAT 1 Critical, CAT 2 Interim High |
| Compliance task | `compliance_records.expiry_date` | expired = Critical; ≤7 d High; ≤30 d listed; valid not listed |
| Escalation task | `escalations` not Resolved | no deadline stored → "No deadline"; urgency sets priority |
| PEEP review / absence follow-up / room inspection / room issue | `peep_plans.review_date`, `absence_followups.due_date`, `property_rooms.next_inspection_due`, `room_issues.due_date` | linked-to-open-maintenance issues are not repeated |
| Room / welfare check | `room_checks`, `welfare_checks` through the existing obligation engine | first review by the 10th, second by the 25th (settings); only occupied rooms / placed residents; completed checks are not listed |
| Dispersal / eviction | `dispersal_records`, `eviction_records` | not departed; Notice Issued / Appeal Pending with a readable date |
| Finance | `finance_bills` | outstanding workflow statuses; deadline = `due_date`; assignee = approver |
| Transport | `transport_funding_requests` | non-final statuses; deadline = appointment date/time |
| Recent activity | `audit_trails` | create/update/archive/restore/delete only |

Deadline classes: Overdue (before now; a bare date is due at 23:59), Due today, Due tomorrow, Due this week (next 2–6 days), Upcoming (7–30 days), No deadline. Dated work more than 30 days away is not listed. Sort: class, then Critical/High/Normal, then due time. A Normal task that is overdue is shown High.

**Not in the table, on purpose:** New arrivals (no deadline or open state), laundry, meals/catering/food logs, daily-register snapshots, reports/HO documents, inspections beyond room inspections, vulnerable/referral reviews (stored as text dates, format unconfirmed). Weaving them in would invent deadlines.

## 4. Recent activity

Server-written audit rows carry a server timestamp, verified user, `entity_type` and `entity_id` (written in the same request as the data change), so activity is real. Rows are de-duplicated by audit id and by (entity, record, action, user, minute). Realtime events are never turned into activity. Links use `entity_type`; unknown types get no link; deleted records have nothing to open.
Gaps: the audit trail cannot say "Completed" (it records UPDATE); the app's `AuditLog` type omits `entityType`/`entityId` although the server returns them; maintenance/compliance creates may still be labelled "Settings" in `module`. A proper event structure would add an explicit `event_type` (created/updated/completed/archived/restored) and `entity_id` as required fields on every write. Visibility is unchanged (Admin/Super Admin with Audit page access).

## 5. Live connection

* No `window.location.reload`, no data polling. The remaining `setInterval` (60 s) only advances the clock used to decide overdue; it fetches nothing.
* The previous 60 s fallback read was removed. While the link is down the service retries the connection (5 s), and everything is re-read once when it is back (also after the network returns or a tab was hidden >60 s).
* Events are coalesced (800 ms quiet, 3 s maximum) and de-duplicated; they only trigger a re-read of authoritative rows.
* Header shows Live / Connecting / Reconnecting / Offline and the last synchronised time.
* **Deviations from the brief:** (a) there are two Realtime channels (the app-wide one and the dashboard's master-data one) rather than one; merging them means changing `realtimeService` for the whole app. (b) A master-data change re-reads all master lists, not only the affected table. (c) Counting is done in the browser on loaded lists, not by server-side aggregation or a database view, and the table is paginated in the browser (25 rows) rather than by the database. (d) No new indexes were added. A Postgres view/RPC returning the unified task rows (module, source id, site id, due, status) with keyset pagination is the next step if list sizes require it; it must read the existing tables, not copy them.

## 6. Tests

`tests/operationsTasks.test.ts` (12): deadline classes; new maintenance appears, completed disappears, reopened returns; deadline change re-classifies; no invented deadlines; one row per record and KPIs equal rows; sort order; room/welfare checks on the 10th/25th schedule with completed excluded; compliance/escalation/dispersal/eviction rules; finance and transport; site scope and module visibility; far-future exclusion; activity de-duplication, scope, limit, no invented links.
Full unit suite: 475 of 479 pass; the 4 failures are the pre-existing `migration 021–024 … schema.sql carries it verbatim` tests, which this change does not touch. `tsc --noEmit` is clean.
Not covered: archived/restored *rows* (these modules have no archive state; maintenance "Closed" and reopen are covered), simultaneous users, network drop and reconnect, mobile layout, performance on real volumes.

## 7. Update (21 Nov 2026): tabs for every page, Facilities & site services, caching

* **Recent activity removed** from the dashboard (section 4 above no longer applies to the UI; the activity selector was deleted).
* **Operations & deadlines** keeps its task tabs (deadline-driven modules) and now adds one tab per log page after a divider: New arrivals, Live register, SG referrals, Vulnerable, Challenging, Welfare checks, RFA welfare, MH complaints, GP appointments, IR tracker, Public transport. Each shows the newest 5 records, with "View all in …" opening the page.
* **Facilities & site services** is a second tabbed table: SPCD, Laundry, Property laundry, Hot meals, Vendor buffet, Food wastage, Food surveys, Booklets, Room checks. Same layout. Housekeeping and food consumption are not in AppContext (they load inside their own pages), so they have no tab yet.
* A tab exists only for pages the user may open. Records are matched to sites exactly; unmatched ones are excluded, not guessed.
* **Load:** only the open tab is computed (`utils/operationsRecords.ts`); only the top 5 rows are built; tab counts are shown for task tabs only; analytics stay collapsed and unmounted until opened.
* **Caching (per profile, `utils/profileCache.ts`):** the dashboard's master data (properties, rooms, placements, room issues, PEEP, follow-ups) is kept in **memory** keyed by profile for 10 minutes; reopening paints from it at once, then re-reads behind it (only complete reads are kept). It is not written to browser storage, because the app's policy is that resident/operational data comes only from the live database; it is cleared on sign-out. Preferences (open tab, Facilities tab, site, overdue-only, analytics open) are remembered per profile in localStorage. The check-obligation data (needs resident names) is not persisted.
* Tests: `tests/operationsRecords.test.ts` (6). Not verified in a browser.
