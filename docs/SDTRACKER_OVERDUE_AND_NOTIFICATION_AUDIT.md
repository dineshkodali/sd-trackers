# SDTracker – Overdue Management & Email Notification Audit and Plan

**Phase 1 deliverable – audit and planning only.** Prepared 12 November 2026.
No application code, database object, migration, RLS policy or UI was changed to produce this document.

**How to read the evidence.** Statements are backed by `file:line` references into this repository. Three things could not be verified from the repository and are marked **[unverified]** wherever they matter:

1. The **live Supabase database** was not queried. Schema findings come from `db/schema.sql` and `db/migrations/*.sql`. Live drift is possible.
2. **Which hosting mode production runs in** (static Amplify with no backend, or Express behind it). The code strongly suggests static/direct mode (§2.3).
3. Whether `db/enable-direct-supabase-rls.sql` has been **applied to the live database** (§16).

The six modules named in the brief (Maintenance, Room Checks, Welfare Checks, Compliance, NTV/Dispersal, Notifications) were traced end to end. The remaining modules were inventoried from the page registry, type definitions, schema and a targeted search for deadline/overdue logic; they were not each traced line by line.

---

## 1. Executive Summary

SDTracker is a React 19 single-page app with an optional Express API in front of Supabase (Postgres + Auth). It has 46 functional modules across 49 routed pages and roughly 115 tables.

The headline findings:

| # | Finding | Consequence for this project |
|---|---|---|
| 1 | **There is no scheduler anywhere.** No cron, no `pg_cron`, no queue. The only timer is an opt-in health monitor (`server/status/monitor.ts:249`). | Nothing can currently detect "something did not happen". Every enhancement in scope depends on adding one. |
| 2 | **Email is sent only when a browser asks the Express server to send it.** On `sdcdms` / `amplifyapp` hosts the client prefers "direct Supabase" mode, where there is no Express server and alerts are written to the audit trail and reported as `simulated: true` (`src/services/apiService.ts:174-195`, `1200-1225`). | In the static hosting mode, **no email is being delivered today**. Hosting must be settled before email work starts. |
| 3 | **Room Checks and Welfare Checks have no schedule, frequency or expectation of any kind.** They are pure logs of checks that were done. | "Missed" is undefined until the business sets a frequency. This is a business decision, not a technical one. |
| 4 | **Maintenance already has an SLA and a due date** (`closeDueDate`, derived from CAT 1/2/3 priority), but it is stored inside a JSON string in the `notes` column, is never compared to today, and has no overdue indicator. | "Complete By" needs one typed column and UI work, not a new concept. |
| 5 | **Compliance status is typed by hand.** `Expiring Soon`, `Expired` and `Overdue` are dropdown values, not calculated from `expiry_date`. The `compliance.expiring_soon` / `compliance.expired` email rules exist but nothing ever fires them. | Reminders are configured but dead. |
| 6 | A good pattern already exists: **SU Attendance absence follow-ups** – pure rule functions, an idempotent unique key per episode, an action history and an overdue flag (`src/utils/attendanceLogic.ts`, `absence_followups`). | The overdue engine should generalise this pattern rather than invent a new one. |
| 7 | Role-based email recipients are **not site-scoped**: every active user holding a role receives the email regardless of site (`server/routes/smtp.ts:922-939`). | Must be fixed before volume increases, or managers will be mailed about other sites' residents. |

**Recommended architecture in one sentence:** one obligations ledger table plus one schedule-configuration table, filled by a daily/hourly Postgres job (`pg_cron`), with email dispatched by a server-side worker (Supabase Edge Function or the existing Express mailer) reading a queue – so detection and email work identically whether or not Express is deployed.

**Overall complexity: High** (about 9–12 developer-weeks across 7 phases), driven mainly by the missing scheduler/hosting decision and the absence of any check-frequency data, not by UI work.

---

## 2. Existing Application Architecture

### 2.1 Frontend
- **React 19 + TypeScript + Vite 6 + Tailwind 4** (`package.json`). Icons from `@tabler/icons-react`, charts from `recharts`, exports via `xlsx`, `docx`, `pdfkit`.
- **No router library.** Navigation is a single `activePage` string switched in `src/App.tsx:238-359`. Deep links do not exist apart from password reset.
- **One global context**, `src/context/AppContext.tsx` (6,189 lines), holds state, RBAC helpers and CRUD for most legacy modules. Newer modules use dedicated services (`src/services/checksService.ts`, `suPropertyService.ts`, `roomManagementService.ts`, `suTrackerService.ts`, `financeService.ts`).
- **Shared building blocks** in `src/components/common/`: `TrackerLayout`, `TrackerToolbar`, `FilterBar`, `Pagination`, `ExportModal`, `DynamicRecordFormModal`, `TableSchemaEditorModal`, `BulkActionToolbar`, `AttachmentsSection`. Column layouts are admin-configurable (`table_schemas`, `src/hooks/useTableSchema.ts`).
- Data refresh: one `POST /api/db/batch-read` every 45 s while signed in, plus Supabase Realtime (`docs/live-database.md`, `src/services/realtimeService.ts`).

### 2.2 Backend
- **Express 4** (`server/index.ts`), bundled with esbuild to `dist/server.cjs`. In development Vite runs as Express middleware on one origin (port 3020).
- Routers mounted at `server/index.ts:237-276`: `/api/config`, `/api/auth`, `/api/db`, `/api/smtp`, `/api/su`, `/api/transport-funding`, `/api/oyster`, `/api/page-access`, `/api/dashboards`, `/api/lifecycle`, `/api/finance`, `/api/document-builder` + `/api/ho-reports`, `/api/report-history`, `/api/status`.
- `/api/db/<entity>` is a generic CRUD gateway. `server/schemaAdapter.ts` (3,220 lines) maps app records to database rows and back. The server uses the Supabase **service-role** key and applies role and site checks itself (`server/middleware/requireAuth.ts`, `server/routes/db.ts`).
- **Second data path:** `src/lib/directSupabaseAdapter.ts` and `directWorkflows.ts` let the browser talk to Supabase PostgREST directly, bypassing Express.

### 2.3 Deployment and hosting
- `amplify.yml` builds and publishes only `dist/` as a **static site** on AWS Amplify.
- `Dockerfile`, `docker-compose.yml`, `deploy/nginx.conf.example` exist for running Express on a VPS/App Runner.
- `docs/AMPLIFY_HOSTING.md` describes two modes: *Mode 1 – direct client-side Supabase, no backend*, and *Mode 2 – Express backend*.
- `shouldPreferDirectSupabase()` returns true on any host containing `sdcdms` or `amplifyapp` unless an API URL override is set, and a code comment states `api.trackers.sdcdms.co.uk has no DNS record` (`src/services/apiService.ts:174-218`). The most recent commit message is "auto-fallback to direct mode ... on Amplify".
- **Conclusion [unverified against production]:** production most likely runs with no always-on server. That means no email, no server-side site isolation, and nowhere to run a scheduled job.

### 2.4 Database platform
- **Supabase Postgres.** `db/schema.sql` (≈4,900 lines) is idempotent and is applied on server boot (`server/migrate.ts`), by `npm run db:migrate`, or pasted into the SQL editor. `db/migrations/001–032` are the incremental history.
- Convention: most tables carry typed columns **plus** a `data JSONB` copy of the whole app record. Older tables store dates as `TEXT`.
- Workflow logic lives in Postgres functions for Finance, Transport Funding, Oyster cards, SU archive, Household, Page Access and Record Lifecycle.

### 2.5 Authentication
- Supabase Auth (email/password; Azure Entra OAuth configured). `handle_new_user()` trigger creates a `profiles` row (`db/schema.sql:764`).
- A signed built-in administrator token also exists (`server/tokenSigner.ts`).
- Server authorisation reads the `profiles` row only – never user-editable metadata. Inactive, archived or deleted profiles are rejected (`server/middleware/requireAuth.ts:107-116`).

### 2.6 Roles and permissions
- Six roles: `Super Admin`, `Admin`, `Regional Manager`, `General Manager`, `Area Manager`, `Staff` (`src/types/index.ts:1-7`).
- **Layer 1 – role matrix** (`role_permissions`): `canViewAllProperties`, `canCreateRecords`, `canEditRecords`, `canDeleteRecords`, `canArchiveRestore`, `canExportData`, `canManageProperties`, `canManageFiles`, `canManageUsers`, `canManageSettings`, `canManageFinance`.
- **Layer 2 – site scope**: `profiles.assigned_site` (comma-separated or "All Sites"), `property_user_assignments`, `user_groups`.
- **Layer 3 – per-user page overrides** (`user_page_permissions`: view/create/edit/delete/export/approve per page), Super Admin only, enforced in Express and by RESTRICTIVE RLS policies (`db/schema.sql:4770-4855`).
- **Layer 4 – page maintenance mode** per page (Super Admin bypass).

### 2.7 RLS
See §16. In short: RLS is enabled everywhere, but most policies are `FOR ALL TO authenticated USING (true)`, i.e. any signed-in user can read and write any row when talking to Supabase directly. Site isolation exists only in Express.

### 2.8 Notification infrastructure
See §6.

### 2.9 Scheduled jobs and background processing
**None.** Searching `server/` for `setInterval`, `cron` and `schedule(` finds only the opt-in status monitor. `db/schema.sql` contains no `pg_cron`, `cron.schedule` or `pg_net`. The "Auto-Sync every 30m" label on the Reports page is browser-side.

### 2.10 Dashboards and reporting
- **Executive Dashboard**: user-customisable widget grid. 16 widget types defined in `src/config/dashboardWidgets.ts:60-77`; layouts saved per user in `user_dashboards` (migration 027). Each widget declares the pages it needs, so page access governs visibility automatically.
- **Reports & SharePoint Hub** (`src/components/reports/ReportsView.tsx`): six fixed report types (Referrals, Vulnerable & Challenging, Maintenance, SPCD, Meals & Laundry, Escalations) with site/date/status filters and PDF/CSV/XLSX export. No overdue or missed-check report exists.
- **Per-page exports** via `ExportModal` on nearly every tracker.
- **HO Report Generator** and **Service User report history** (`service_user_report_history`, migration 031).
- **Status portal** at `/status` (system health, unrelated to operations).

---

## 3. Complete Module Inventory

46 functional modules. Unless stated otherwise, access is: any role with the page permitted, limited to the user's assigned sites, with create/edit/delete governed by the role matrix. "Assignment" means a field naming who must act.

Legend: ✔ present · ✖ absent · ◐ partial.

### 3.1 Overview

| Module (page id) | Purpose | Main tables | Assignment | Deadlines | Recurring | Completion | Follow-up | Email | Overdue detection | Dashboard / reports |
|---|---|---|---|---|---|---|---|---|---|---|
| Executive Dashboard (`dashboard`) | Customisable KPI widgets | `user_dashboards` + reads others | – | – | – | – | – | – | ✖ | Is the dashboard |
| Live Daily Registers (`dailyRegisters`) | Room list, daily register, new arrivals, evictions, family groups | `daily_register_rooms`, `daily_register_records`, `new_arrivals_records`, `eviction_records`, `family_groups` | ✖ | ◐ eviction notice/eviction dates | Daily register (implicit) | ◐ eviction status | ✖ | ✖ | ✖ | Guest statistics widget |

### 3.2 Safeguarding

| Module (page id) | Purpose | Main tables | Assignment | Deadlines | Recurring | Completion | Follow-up | Email | Overdue detection | Dashboard / reports |
|---|---|---|---|---|---|---|---|---|---|---|
| SG Referrals (+archive) (`referrals`) | Safeguarding referrals register | `referrals` | ✔ `assigned_to`, lead officer | ✔ `follow_up_date` (TEXT) | ✖ | ✔ status + archive | ✔ follow-up date, further updates | ✔ created, urgent | ✖ | Widgets + report |
| Vulnerable Residents (+archive) (`vulnerable`) | High-dependency monitoring | `vulnerable_residents` | ◐ `flagged_by` | ✔ `next_review_date` (TEXT) | ◐ reviews implied | ✔ status + archive | ◐ | ✔ created | ✖ | Widgets + report |
| Challenging Behaviour (+archive) (`challenging`) | Behaviour incidents, warnings | `challenging_behavior` | ✖ | ✖ | ✖ | ✔ status | ◐ warning levels | ✔ critical | ✖ | Widgets + report |
| **Welfare Checks** (`welfareChecks`) | Per-resident welfare declaration | `welfare_checks` | ✖ (officer = who did it) | ✖ | **✖ none configured** | Record exists = done; `status` default `Completed` | ◐ free-text maintenance / safeguarding fields | ✖ | ✖ | ✖ |
| RFA Welfare Checks (`rfaWelfare`) | Room/flat welfare log with vulnerability | `rfa_welfare_checks` | ✖ | ✖ | ✖ | Record = done | ◐ `action_taken`, MH ticket | ✔ created, MH ticket | ✖ | ✖ |
| MH-Complaint Welfare Checks (`mhComplaintWelfare`) | Migrant Help complaint cases | `mh_complaint_welfare_checks` | ◐ `duty_staff` | ✖ (no response-by date) | ✖ | ✔ status Open→closed | ◐ action taken | ✖ | ✖ | ✖ |
| GP Appointments (`gpAppointments`) | Appointments, DNA, GP registrations | `gp_appointments`, `gp_registrations` | ✖ | ✔ `appointment_date` | ✖ | ✔ status | ◐ | ✔ created, DNA | ✖ | ✖ |
| PEEP Tracker (`peepTracker`) | Evacuation plans and reviews | `peep_plans`, `peep_plan_history` | ◐ `developed_by` | ✔ `review_date` (DATE) | ✔ periodic review | ✔ `last_reviewed_at`, versions | ✔ history | ✖ | **✔ in UI** (overdue / due-soon cards, filter, row tint – `PEEPTrackerView.tsx:27-30,120,209`) | Page-level cards only |
| SU Attendance (`suAttendance`) | Daily attendance, 3/7-day absence follow-up | `su_attendance_records`, `absence_followups` | ✔ `assigned_to` | ✔ follow-up `due_date` | ✔ daily | ✔ status Open/In Progress/Resolved | **✔ full** (action history) | ✖ | **✔ in UI**, follow-ups auto-created idempotently – but only when someone opens the page | Page-level cards only |
| HO Report Generator (`documentBuilder`) | Home Office incident report builder | `doc_builder`, `ho_report_*` | ✖ | ✖ | ✖ | ◐ draft/final | ✖ | ✖ | ✖ | Report history |
| Service Users Master (`suUsers`) | Central SU record, placements, household, support, documents, HC2, education, archive | `service_users`, `placements`, `service_user_*`, `su_hc2_details`, `su_education_details`, `su_archive_requests`, `family_*` | ◐ support `assigned_staff` | ◐ document `expiry_date`, support `end_date`, HC2 dates (not traced) | ✖ | ✔ status / archive workflow | ◐ | ✖ | ✖ | Report history tab |

### 3.3 Facilities & Welfare

| Module (page id) | Purpose | Main tables | Assignment | Deadlines | Recurring | Completion | Follow-up | Email | Overdue detection | Dashboard / reports |
|---|---|---|---|---|---|---|---|---|---|---|
| **Maintenance Tracker** (`maintenance`) | Defects, CAT 1–3 SLA, contractor remediation | `maintenance_records` | ◐ `contractor` text, `raisedBy` | **✔ `closeDueDate` (inside `notes` JSON)** | ✖ | ✔ status, action, `completion_date`, sign-off | ◐ `progress` text | ✔ created, CAT 1 | **✖** (CAT 1 open rows shown red regardless of date) | Open-maintenance widget, property-load widget, report |
| SPCD Tracker (`spcd`) | Pest control / decontamination cases | `spcd_records` | ◐ officer | ◐ `expires_date` column exists | ✖ | ◐ archive flag | ✔ follow-up notes, SG review | ✖ | ✖ | Report |
| IR Tracker (`irTracker`) | Incident reports | `ir_records` | ✖ | ✖ | ✖ | ◐ status | ◐ | ✖ | ✖ | Monthly incidents widget |
| Public Transport (`publicTransport`) | Journeys, feedback, challenges, funding workflow, Oyster cards | `public_transport_records`, `transport_feedback`, `transport_challenges`, `transport_funding_requests` (+history), `oyster_cards` (+transactions, events) | ✔ funding approver by role | ✔ appointment date | ✖ | ✔ funding status machine | ✔ status history | ◐ created + exceptional; six other events fire with no rule (§6.4) | ✖ | Transport widget |
| **Dispersal Sheet / NTV** (`dispersal`) | Notice, dispersal, exit briefing, eviction | `dispersal_records`, `eviction_records` | ✖ | ✔ `dispersal_date`, `second_dispersal_date`, eviction `noticeDate` / `evictionDate` | ✖ | ✔ `travelled`, `date_left_property` | ✔ second-cycle fields, failed-to-travel reason | ✔ created, failed to travel | ✖ | ✖ |
| Booklet Inventory (`booklets`) | Booklet stock / collection | `booklet_collections` | ✖ | ✖ | ✖ | ◐ | ✖ | ✖ | ✖ | ✖ |
| Commercial Laundry (`laundry`) | Resident intake, property logs | `laundry_logs`, `daily_laundry_logs` | ✖ | ✖ | ✔ weekly/daily logs (implicit) | ◐ status | ✖ | ✖ (`laundry.variance_flagged` rule never fired) | ✖ | Widgets + report |
| Housekeeping Log (`housekeeping`) | Daily communal and room cleaning | `housekeeping_logs`, `housekeeping_room_logs` | ◐ `cleaned_by` | ✖ | ✔ daily (implicit) | Record = done | ✖ | ✖ | ✖ | ✖ |
| Hot Meals (`food`) | Deliveries, vendor buffet temperatures | `hot_food_logs` | ✖ | ✖ | ✔ per meal (implicit) | Record = done | ✖ | ✖ (`food.temp_breach` never fired) | ✖ | Widgets + report |
| Food Consumption (`foodConsumption`) | Daily consumption, box requests | `food_consumption_reports`, `food_box_requests` | ✖ | ✖ | ✔ daily (implicit) | ◐ | ✖ | ✖ | ✖ | ✖ |
| Food Survey Checks (`foodSurveys`) | Resident meal survey, 21 ratings | `food_surveys`, `food_meal_ratings` | ✖ | ✖ | ✖ none configured | Record = done | ✖ | ✖ | ✖ | ✖ |
| Food Wastage (`foodWastage`) | Surplus / wastage audit | `food_wastage_records` | ✖ | ✖ | ✔ daily (implicit) | Record = done | ✖ | ✖ | ✖ | ✖ |
| **Room Checks** (`roomChecks`) | 30-point room inspection | `room_checks`, `room_check_items` | ✖ (officer = who did it) | ✖ | **✖ none configured** | Record = done; graded Passed / Issues / Attention Required | ✖ (no link to maintenance) | ✖ | ✖ | ✖ |
| Escalations Log (`escalations`) | Critical incidents | `escalations` | ✔ `assigned_to` | ✖ (registry text mentions "SLA timers"; none found in `EscalationsView.tsx`) | ✖ | ✔ status → Resolved | ◐ | ✔ created, critical | ✖ | Widgets + report + in-app bell |
| Proof Documents (`documents`) | Evidence repository | `documents` | ✖ | ✖ | ✖ | – | ✖ | ✖ | ✖ | ✖ |
| **Property Management** (`propertyManagement`) | Properties, rooms, beds, assets, facilities, property compliance, inventory, room issues, timeline | `properties`, `property_rooms`, `room_beds`, `property_assets`, `property_compliance`, `property_documents`, `property_contacts`, `room_issues`, `room_activity_log`, `inventory_*`, `room_inventory` | ✔ `room_issues.assigned_to` | ✔ `property_rooms.next_inspection_due`, `room_issues.due_date`, `property_compliance.expiry_date`, asset PAT/service due, `blocked_until` | ◐ inspection next-due set by hand | ✔ issue status, `last_inspected_at` | ✔ activity log | ✖ | **◐ in UI**: `inspection_overdue` room flag (`roomManagementLogic.ts:102`), asset due chips, compliance status auto-derived at save (`ComplianceFormModal.tsx:63`) | ✖ |

### 3.4 Finance

| Module (page id) | Purpose | Main tables | Assignment | Deadlines | Recurring | Completion | Follow-up | Email | Overdue detection | Dashboard / reports |
|---|---|---|---|---|---|---|---|---|---|---|
| Vendor Invoices (`finance`) | Bills, line items | `finance_bills`, `finance_bill_items`, `finance_vendors` | ✔ `assignedApproverId` | ◐ bill due date (not traced) | ✖ | ✔ status machine | ✔ queries | ✖ | ✖ | Finance widget |
| Credit Card Bills (`financeCreditCards`) | Card expenditure | `finance_bills` | ✔ | ◐ | ✖ | ✔ | ✔ | ✖ | ✖ | – |
| Delivery Notes (`financeDeliveryNotes`) | Goods receipt | `finance_bills` (+attachments) | ◐ | ✖ | ✖ | ✔ | ✖ | ✖ | ✖ | – |
| Finance Approvals (`financeApprovals`) | Approval steps | `finance_approval_requests`, `finance_verification_tasks`, `finance_bill_queries`, `finance_bill_status_history` | ✔ | ◐ | ✖ | ✔ | ✔ | ✖ (in-app task notifications only – `inAppNotificationService.ts:166`) | ✖ | Finance widget |

### 3.5 Compliance & Community

| Module (page id) | Purpose | Main tables | Assignment | Deadlines | Recurring | Completion | Follow-up | Email | Overdue detection | Dashboard / reports |
|---|---|---|---|---|---|---|---|---|---|---|
| **SD-Compliance Tracker** (`compliance`) | Certificates and contracts | `compliance_records` | ◐ contractor contact | **✔ `expiry_date` (TEXT)** | ◐ renewals implied | ◐ status typed by hand | ◐ `action_taken` | ✔ created only | **✖** (status is manual) | Compliance-status widget |
| SD VCS Directory (`vcsDirectory`) | Partner agencies | `vcs_agencies` | – | – | – | – | – | – | – | – |
| Reports & SharePoint Hub (`reports`) | Six reports, exports | reads others | – | – | – | – | – | – | – | Is the reporting page. Needs `canExportData` |
| Audit Security Trail (`audit`) | Change log | `audit_trails`, `audit_logs` | – | – | – | – | – | – | – | Admin / Super Admin only |
| Data Change Requests (`requests`) | Sign-off for locked records | `data_change_requests` | ◐ managers by site | ✖ (no decide-by date) | ✖ | ✔ Pending/Approved/Rejected | ✔ | ✔ created, reviewed | ✖ | My-requests widget, bell |

### 3.6 Admin & Governance

| Module (page id) | Purpose | Main tables | Notes |
|---|---|---|---|
| Properties Directory (`properties`) | Sites, managers | `sites` | Holds `manager_name`, `manager_email`, `manager_phone` – the only structured "site manager" data. Admin only. |
| Staff & User Accounts (`users`) | Accounts, site assignment | `profiles`, `user_groups`, `property_user_assignments` | Admin only. |
| Roles & RBAC (`roles`) | Role matrix | `role_permissions` | Super Admin. |
| Field Options & Setup (`setupOptions`) | Dropdown lists | `field_options` | Super Admin. |
| Email Notifications Management (`notifications`) | Rules, recipients, delivery log, test send | `email_notification_rules`, `email_notification_logs` | Admin. |
| System Settings (`settings`) | Preferences, SharePoint, database tools | `app_settings` | Admin. |
| Page Access Management (`pageAccess`) | Per-user page overrides | `user_page_permissions`, `page_access_audit` | Super Admin. |
| Page Maintenance Mode (`pageMaintenance`) | Take a page offline | `app_settings` | Super Admin. |

**Deadline-bearing modules that are not in the brief's list:** PEEP reviews, absence follow-ups, GP appointments, referral follow-up dates, vulnerable-resident reviews, room issues, room inspections, asset PAT/service dates, property compliance, eviction notices, SU document expiry, transport funding approvals, finance approvals, data change requests.

---

## 4. Database Schema Analysis

All tables are in `public`. Primary keys are application-generated `TEXT` ids unless noted. Almost every table has `created_by UUID → auth.users`, `created_at`, `updated_at` (trigger-maintained).

### 4.1 Identity, sites and assignment

| Table | Key columns | Relationships |
|---|---|---|
| `profiles` | `id UUID` PK → `auth.users`, `email`, `name`, `role`, `assigned_site` (comma list / "All Sites"), `status`, `lifecycle_state` | 1:1 with auth user |
| `sites` | `id`, `name`, `manager_name`, `manager_email`, `manager_phone`, `status`, `lifecycle_state` | Parent of most site-scoped data |
| `property_user_assignments` | `user_id` → auth.users, `property_id` → `sites.id`, `role`, `assigned_properties TEXT[]` | User ↔ site mapping |
| `user_groups` | `assigned_properties TEXT[]`, `user_ids TEXT[]` | Group ↔ site |
| `role_permissions` | one row per role, boolean capabilities | – |
| `user_page_permissions` | PK (`user_id`, `page_id`), six booleans | → `profiles` |

**Naming trap:** `property_user_assignments.property_id` references **`sites`**, not `properties`. "Site" (hotel) and "Property" (master building record under a site) are different entities.

### 4.2 Master data (migration 012, 016)

| Table | Key columns | Relationships |
|---|---|---|
| `properties` | `id`, `property_name`, `site_id` → `sites` | Site 1:N Property |
| `property_rooms` | `id`, `property_id` → `properties`, `room_number`, `capacity`, `status`, `occupancy_status`, `last_inspected_at`, **`next_inspection_due DATE`**, `blocked_until`, `void_since` | Property 1:N Room |
| `service_users` | `id`, `su_reference`, names, `status`, `arrival_date`, `site_id`, `vulnerable` ('Yes'/'No'), `archive_status` | – |
| `placements` | `su_id`, `site_id`, `property_id`, `room_id`, `bed_id`, **`start_date TIMESTAMPTZ`**, **`end_date`**, `status` | The occupancy record: who was in which room, when |
| `room_issues` | `room_id`, `priority`, `status`, `assigned_to`, **`due_date DATE`**, `resolved_at`, `maintenance_record_id` | Room 1:N Issue; optional link to maintenance |
| `property_compliance` | `property_id`, `type`, `inspection_date`, **`expiry_date DATE`**, `status` | Property 1:N certificate |
| `property_assets` | `property_id`, `room_id`, `warranty_expiry`, PAT / service due in `data` | – |
| `room_activity_log` | `room_id`, `activity_type`, `performed_at` | Room timeline |

`placements` gives exact occupancy dates per room. This is what makes historical reconciliation of room and welfare checks possible.

### 4.3 The modules in scope

**`maintenance_records`** (`db/schema.sql:223-241`, `3347-3352`)

| Purpose | Column | Type | Note |
|---|---|---|---|
| Site | `site` | TEXT (name) | no FK |
| Location | `room_or_area` | TEXT | no FK to `property_rooms` |
| Status | `defect_status` | TEXT | app values: `In Process`, `Completed` |
| Priority / SLA class | `priority` | TEXT | `CAT 1`, `CAT 2 - Interim`, `CAT 2`, `CAT 3` |
| Reported | `reported_date`, `reported_time` | TEXT | |
| **Actual completion** | `completion_date`, `actual_closed_time` | TEXT | written from `actualClosedDate` (`schemaAdapter.ts:2102`) |
| Sign-off | `sign_off_status` | TEXT | |
| Assignee | `contractor`, `reported_by` | TEXT | free text |
| **Target ("complete by")** | *none* | – | `closeDueDate` is serialised into the **`notes`** column as JSON along with `action`, `progress`, `priorityTimeScale` (`schemaAdapter.ts:2148-2161`) |

There is no `data JSONB` column on this table; `notes TEXT` is used as the envelope. The due date therefore cannot be indexed, filtered or compared in SQL without parsing text.

**`room_checks`** (`db/schema.sql:2172-2187`, `2788-2790`): `site_id` → `sites`, `site_name`, `room_number` (TEXT), `inspection_date` (TEXT), `overall_status`, `officer_id/name`, optional `su_id`, `property_id`, `room_id` → `property_rooms`. Child `room_check_items` (30 answers). **No frequency, due date, period or schedule column.**

**`welfare_checks`** (`db/schema.sql:2040-2080`, `2772-2774`): `site_id`, `site_name`, `port_reference` (NOT NULL), `check_datetime TIMESTAMPTZ`, `status` (default `Completed`), `safeguarding_concerns`, `maintenance_issues`, optional `su_id` → `service_users`, `property_id`, `room_id`. **No frequency, due date or schedule column.**

**`rfa_welfare_checks`** / **`mh_complaint_welfare_checks`**: flat logs keyed by site name, room text and port reference; no FK to `service_users`.

**`compliance_records`** (`db/schema.sql:390-407`): `compliance_type`, `contractor_*`, `issued_date`, **`expiry_date`** (TEXT), `status` (TEXT, manual), `site_name`, `data JSONB`.

**`dispersal_records`** (`db/schema.sql:448-475`): `type_of_dispersal` (NTV / Eviction / Dispersal / Self-Departure), `date_received`, `dispersal_date`, `date_letter_handed_to_su`, `ia_exit_briefing_completed`, `travelled`, `date_left_property`, second-cycle equivalents. All dates TEXT, and the type comments say `MM/DD/YYYY` (`src/types/index.ts:638-655`) – format must be confirmed before any date arithmetic.

**`eviction_records`**: `noticeDate`, `evictionDate`, `status` (Notice Issued / Evicted / Appeal Pending / Cancelled).

### 4.4 Notification, audit and follow-up tables

| Table | Columns that matter | Reusable for |
|---|---|---|
| `email_notification_rules` | `event_code` UNIQUE, `module`, `enabled`, `min_severity`, `recipient_roles JSONB`, `custom_recipients`, `custom_cc`, `subject_template`, `dispatch_count`, `last_dispatched_at` | Rule per event; extend for reminders and escalation |
| `email_notification_logs` | `rule_id`, `event_code`, `subject`, `recipients JSONB`, `site`, `status`, `error_message`, `entity_id`, `dispatched_at` | Delivery history; extend to act as the send queue |
| `audit_trails` | `user`, `user_id`, `role`, `action`, `details`, `site`, `entity_type`, `entity_id`, `module`, `target_label` | System audit of engine actions |
| `audit_logs` | `entity_type`, `entity_id`, `old_values`, `new_values` | Field-level history for master data |
| `absence_followups` | UNIQUE (`su_id`, `absence_start_date`, `threshold_days`), `status`, `assigned_to`, `due_date`, `action_history JSONB`, `resolved_at` | **Template for the obligations ledger** |
| `escalations` | `severity`, `status`, `assigned_to`, `resolution_notes` | Human-raised incidents; not suitable as an automated ledger |
| `app_settings` | key/value | Global settings (time zone, default thresholds) |

**Not present anywhere:** check schedules or frequencies, an obligations/overdue ledger, a notification queue, user notification preferences, bank-holiday calendar, exemptions.

### 4.5 Data-quality constraints the engine must live with
- Dates stored as `TEXT` in the older tables, with at least one module documented as `MM/DD/YYYY`.
- Sites referenced by **name** in many tables (`site`, `site_name`) and by **id** in others. The in-app notifier already needs an alias map to reconcile them (`inAppNotificationService.ts:416-423`).
- Rooms referenced by free-text `room_number` in checks, with `room_id` optional. `ChecksTab.tsx:13` matches on id **or** lower-cased room number + site name.
- Residents referenced by `port_reference` in checks, with `su_id` optional.

---

## 5. Existing Workflow Analysis

### 5.1 Room Checks
- **Scheduled?** No. Nothing creates an expected check.
- **Created?** A user opens Room Checks, picks site and room, answers 30 questions (`ROOM_CHECK_QUESTIONS`), saves. `checksService.createRoomCheck` writes the header then 30 `room_check_items` one by one (`checksService.ts:208-238`).
- **Who completes them?** Any user with create permission on the page for that site. `officer_name` records who.
- **Recorded?** Graded automatically: `Passed`, `Issues`, or `Attention Required` for critical safety answers (`RoomChecksView.tsx:66-90`).
- **Frequency / weekly / monthly requirement?** None in code, schema, settings or field options.
- **Can users see rooms never checked?** No. The list shows checks that exist. The per-room Checks tab shows "No room checks recorded for this room" but only one room at a time.
- **Identifies missed checks?** No.
- **Adjacent mechanism:** Property Management → room → Overview has "record inspection" with a hand-typed next-due date (`roomManagementService.ts:190-194`) and an `inspection_overdue` flag. This is **not connected** to the Room Checks page: completing a 30-point check does not update `last_inspected_at` or `next_inspection_due`.
- **Follow-through:** a failed check does not create a maintenance record or a room issue.

### 5.2 Welfare Checks
- **Scheduled?** No.
- **Frequency determined by?** Nothing. No per-resident, per-vulnerability or per-site rule exists.
- **Created?** A user picks site and service user, completes the declaration, saves (`checksService.createWelfareCheck`). `status` defaults to `Completed`.
- **If not completed?** Nothing happens. No record, no alert.
- **Missed checks visible?** No.
- **Follow-up / safeguarding:** `safeguardingConcerns` and `maintenanceIssues` are free text. Saving them does **not** raise a referral, escalation, maintenance record or email. The only welfare emails come from the separate **RFA** page (`AppContext.tsx:4020-4030`).
- Three welfare pages exist (Welfare Checks, RFA Welfare, MH-Complaint Welfare) with separate tables and no shared identity beyond site name and port reference.

### 5.3 Maintenance
- **Defect created?** Maintenance Tracker → New. User picks site, room, criteria code and priority. `calculateDueDate(priority)` fills `closeDueDate` (`MaintenanceTrackerView.tsx:338-358`).
- **Existing SLA?** Yes, hard-coded: CAT 1 = 4 hours, CAT 2 Interim = 24 hours, CAT 2 = 5 working days, CAT 3 = 28 working days (`src/utils/maintenancePriority.ts:11-16`). Working days skip weekends only; no bank holidays.
- **Assigned?** No assignee field. `contractor` is free text; `raisedBy` is the reporter.
- **Completion deadline stored?** Yes, but inside `notes` JSON (§4.3). Format `YYYY-MM-DD HH:MM` in **browser-local time**.
- **Clock start:** the create form uses "now", not the reported date/time, even though a `reportedAt()` helper exists (`maintenancePriority.ts:48`).
- **Completion tracked?** Status `Completed` / action `Closed` stamps `actualClosedDate` (`MaintenanceTrackerView.tsx:390-418`, `687-693`).
- **Overdue identifiable?** Not today. The Due Date column turns red for any open CAT 1 regardless of time (`:673-680`). Stats count CAT 1 open, CAT 2 interim open, in process, completed (`:327-335`) – no overdue count.
- **Emails:** `maintenance.created` and `maintenance.cat1_emergency` on create. `maintenance.completed` rule exists but is never fired.
- **Audit quirk:** maintenance and compliance changes are written to the audit trail with `module: 'Settings'` (`AppContext.tsx:3430`, `3900`).

### 5.4 Compliance
- **Obligations created?** Manually, one row per certificate/contract.
- **Due dates stored?** `expiry_date` (TEXT). New rows default to today + 365 days (`SDComplianceTrackerView.tsx:160`).
- **Reminders?** Rules `compliance.expiring_soon` and `compliance.expired` are seeded but **no code path fires them**. Only `compliance.created` is sent.
- **Status:** chosen from a dropdown (`:402`). A certificate past its expiry date stays "Compliant" until someone edits it.
- **Evidence?** Attachments supported.
- A second, separate compliance store exists per property (`property_compliance`), where status **is** derived from the expiry date at save time (`ComplianceFormModal.tsx:63`) but not re-evaluated afterwards.

### 5.5 NTV (Notice to Vacate)
- There is **no NTV module**. "NTV (Move on Completed)" is one value of `typeOfDispersal` on the Dispersal Sheet (`src/types/index.ts:637`, `DispersalTableSection.tsx:405`).
- **Tracked?** One row per departure: date received, dispersal date, letter handed, exit briefing, travelled, date left, and a full second cycle if the first failed.
- **Deadlines / follow-ups recorded?** The dates are recorded. Nothing compares them with today.
- **Reminders?** No. `dispersal.created` and `dispersal.failed_to_travel` are sent on create only.
- Evictions are tracked separately in Daily Registers (`eviction_records`) with notice and eviction dates.

### 5.6 Modules that already do part of this well
- **SU Attendance:** `followUpsToCreate()` computes what should exist and creates only what is missing, keyed by resident + episode start + threshold, with a database UNIQUE constraint as the backstop (`attendanceLogic.ts:158-177`, `suTrackerService.ts:246-257`). It runs in the browser when the page is open.
- **PEEP:** clean overdue / due-soon classification with cards, filter and row tint.

---

## 6. Current Notification Infrastructure

### 6.1 Email transport
- `server/mailer.ts`: Nodemailer over SMTP, configured by `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`/`SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`. Single shared transporter. `tls.rejectUnauthorized: false` (certificate validation disabled, `:49-51`).
- No retry, no queue, no rate limiting, no bounce handling.

### 6.2 Rules engine
- `POST /api/smtp/trigger` (`server/routes/smtp.ts:856-1076`): look up rule by `eventCode` → check enabled → check severity threshold → resolve recipients → interpolate subject → render HTML → send → update rule counters → write `email_notification_logs`.
- 27 seeded rules across Safeguarding, Compliance, Maintenance, Transport, Health & Welfare, Operations, Governance.
- Admin UI: Email Notifications Management (enable/disable, severity, roles, custom recipients/CC, subject template, test send, delivery log).

### 6.3 How recipients are resolved today
1. `custom_recipients` on the rule.
2. Admin-supplied ad-hoc addresses.
3. **All active profiles whose `role` is in `recipient_roles`** – with no site filter (`smtp.ts:922-939`).
4. Fallback: the SMTP account's own address.

There is no "responsible user", "site manager" or "escalation recipient" resolution. `sites.manager_email` is never used by the mailer.

### 6.4 Triggers
All triggers originate **in the browser** after a successful save (`AppContext.tsx`, 26 call sites). If the tab closes, the network drops, or the app is in direct mode, no email is sent.

| State | Event codes |
|---|---|
| Rule exists and is fired | `referral.created`, `referral.urgent`, `vulnerable.created`, `challenging.critical`, `escalation.created`, `escalation.critical`, `compliance.created`, `maintenance.created`, `maintenance.cat1_emergency`, `transport.created`, `transport.exceptional_circumstance`, `gp.created`, `gp.dna_missed`, `welfare.created`, `welfare.mental_health_ticket`, `dispersal.created`, `dispersal.failed_to_travel`, `change_request.created`, `change_request.reviewed`, `user.role_changed` |
| Rule exists, **never fired** (no call site in `src/`) | `referral.status_changed`, `compliance.expiring_soon`, `compliance.expired`, `maintenance.completed`, `laundry.variance_flagged`, `food.temp_breach`, `user.created` |
| Fired, **no rule** → server returns 404 | `transport.high_impact_issue`, `transport.funding_submitted`, `transport.funding_approved`, `transport.funding_clarification`, `transport.funding_rejected`, `transport.room_move_submitted` |

### 6.5 Direct (static-hosting) mode
`sendAlert` and `sendEscalationAlert` write an audit row and return `simulated: true` (`apiService.ts:1200-1225`, `1250-1276`). `triggerNotification` posts to a relative `/api/smtp/trigger` that the static host cannot serve. `getStatus()` returns `configured: true` in this mode (`emailNotificationService.ts:162-164`), so the admin screen reports SMTP as healthy when nothing can be sent.

### 6.6 In-app notifications
The header bell is **derived on the fly** from audit logs, escalations, data change requests and finance bills (`inAppNotificationService.ts`). Nothing is stored; read state is client-side. Visibility rules are strict and site-aware (`filterNotificationsForRole`, `:449-541`) and are a good model for email scoping.

### 6.7 Preferences and history
- **Notification preferences:** none (no per-user opt-out, digest or channel choice).
- **History:** `email_notification_logs` (send attempts with status and error). No link back to the record beyond a text `entity_id`.

---

## 7. Existing Deadline and SLA Capabilities

| Module | Deadline source | Where stored | Queryable in SQL | Evaluated against today |
|---|---|---|---|---|
| Maintenance | Priority SLA (4h / 24h / 5wd / 28wd) | `notes` JSON → `closeDueDate` | No | No |
| SD-Compliance | Certificate expiry | `compliance_records.expiry_date` TEXT | With cast | No |
| Property compliance | Certificate expiry | `property_compliance.expiry_date` DATE | Yes | At save only |
| Room inspection | Hand-typed next due | `property_rooms.next_inspection_due` DATE | Yes | Yes – room flag in UI |
| Room issues | Hand-typed due date | `room_issues.due_date` DATE | Yes | Partly (Issues tab) |
| Assets | PAT / service / warranty | `property_assets` (+`data`) | Partly | Yes – chips in UI |
| PEEP | Review date | `peep_plans.review_date` DATE | Yes | Yes – UI |
| Absence follow-up | Due date | `absence_followups.due_date` DATE | Yes | Yes – UI |
| Referrals | Follow-up date | `referrals.follow_up_date` TEXT | With cast | No |
| Vulnerable residents | Next review | `vulnerable_residents.next_review_date` TEXT | With cast | No |
| GP appointments | Appointment date | `gp_appointments.appointment_date` TEXT | With cast | No |
| Dispersal / NTV | Dispersal dates | `dispersal_records.*` TEXT | Format risk | No |
| Evictions | Notice / eviction dates | `eviction_records` | With cast | No |
| SU documents | Expiry | `service_user_documents.expiry_date` DATE | Yes | Not traced |
| Finance, transport funding, change requests | Pending approvals | status columns | Yes | No ageing rule |

**Pattern:** where overdue is evaluated at all, it is evaluated in the browser, on the page, when someone looks. Nothing is evaluated centrally or pushed.

---

## 8. Existing Room Check Scheduling

There is none. Specifically absent: a frequency setting (global, per site, per property or per room); a list of rooms due; a calculation of expected checks; any use of occupancy when deciding whether a check is needed.

What exists and can be reused:
- `property_rooms` – the authoritative room list, with `status` (to exclude void/blocked/out-of-use rooms), `void_since`, `blocked_until`.
- `placements` – exact occupancy intervals per room.
- `room_checks.inspection_date` and optional `room_id`.
- `property_rooms.last_inspected_at` / `next_inspection_due` – existing columns that a completed room check should update.
- `roomFlags()` – already surfaces `inspection_overdue` in room views.

Reconciliation risk: historic `room_checks` rows may have `room_id` null. They must be matched on normalised `room_number` + site, as `ChecksTab` already does. Rows that match no room must be reported, not silently dropped.

---

## 9. Existing Welfare Check Scheduling

There is none. Absent: any frequency per resident, vulnerability level or site; any list of residents due; any "last checked" figure per resident.

What exists and can be reused:
- `service_users` – authoritative resident list with `status`, `archive_status`, `arrival_date`, `vulnerable`.
- `placements` – when the resident was accommodated and where.
- `vulnerable_residents.risk_level` – could drive a higher frequency for higher risk.
- `su_attendance_records` – recorded absences are a natural exemption for a welfare check.
- `welfare_checks.check_datetime` and optional `su_id`.

Reconciliation risk: historic `welfare_checks` rows are keyed by `port_reference`; `su_id` may be null. Matching must fall back to port reference against `service_users.su_reference` / `external_reference`.

Open question: do RFA and MH-Complaint welfare entries count towards a resident's welfare-check obligation? (§19)

---

## 10. Requirements Gap Analysis

| Enhancement | Existing module | Existing capability | Gap | Proposed change | Dependencies | Complexity |
|---|---|---|---|---|---|---|
| **A. Automated email notifications** | Email Notifications Mgmt, `server/mailer.ts`, `/api/smtp/trigger` | SMTP transport; 27 rules; role + custom recipients; delivery log; admin UI | Browser-triggered only; dead in static hosting; no site scoping; no responsible-user / site-manager / escalation resolution; no queue or retry; no preferences; 7 rules never fired; 6 events with no rule | Server-side dispatcher reading a queue; recipient resolver (assignee → site staff by role → site manager → escalation roles); site-scoped role recipients; add missing rules; per-user preferences; dedupe key | Hosting decision; SMTP credentials available server-side; scheduler | High |
| **B. Maintenance Complete By** | Maintenance Tracker | SLA table; `closeDueDate` computed and displayed; actual close date stored | Due date not a real column; no overdue state; clock starts at entry time not reported time; no bank holidays; no assignee | Add typed `complete_by` column, back-filled from `notes`; overdue badge, card, filter, sort; optional manual override with reason | None for UI; scheduler for alerts | Low–Medium |
| **C. Missed Room Checks** | Room Checks, Property Management | Check records; room master; placements; manual next-inspection date | No frequency; no expectation; no missed list; check does not update room inspection dates | Schedule config; expected-check calculation from rooms × periods × occupancy; missed register; link check completion to `last_inspected_at` | **Business frequency decision**; scheduler; room-id back-fill | High |
| **D. Missed Welfare Checks** | Welfare Checks (+RFA, MH) | Check records; SU master; placements; vulnerability data | No frequency; no expectation; no missed list; concerns do not escalate | Schedule config (optionally by risk level); expected-check calculation from residents × periods × placement; missed register; safeguarding escalation path | **Business frequency decision**; scheduler; su-id back-fill | High |
| **E. Universal overdue management** | 15+ modules with dates (§7) | Per-page overdue in PEEP, Attendance, Rooms, Assets | No central view; no consistent definition; nothing server-side | One obligations ledger fed by per-module detectors; shared status vocabulary | Scheduler; consistent site ids | High |
| **F. Overdue dashboards, reporting, escalation** | Dashboard widgets, Reports, Escalations | Widget framework with page-gated visibility; six reports; escalation log | No overdue widget, register or report; no automatic escalation | Overdue Centre page; 3 widgets; overdue + missed-check reports; time-based escalation levels | E | Medium |

### 10.1 Answers to the specific questions in the brief

**A – Email**
- *Email service exists?* Yes (Nodemailer/SMTP), server-side only.
- *Notifications currently sent?* Only when Express is deployed and reachable; otherwise simulated.
- *Events that can trigger alerts?* 20 working event codes today (§6.4); all are "record created/changed" events. No time-based events.
- *Responsible users identified how?* They are not. Roles only.
- *Site/property managers identified how?* `sites.manager_email` (free text, unused by the mailer); users with manager roles whose `assigned_site` includes the site; `property_contacts`.
- *Escalation recipients?* Not modelled. Proposed: role ladder per rule (§12.3).
- *Preferences?* None. *History?* `email_notification_logs`.

**B – Maintenance**
- *Deadlines exist?* Yes (`closeDueDate`). *SLA configured?* Yes, in code.
- *Reusable fields?* `priority`, `reported_date`, `reported_time`, `completion_date`, `actual_closed_time`, `defect_status`, and the JSON `closeDueDate` as the back-fill source.
- *Dashboard component to modify?* `MaintenanceOpenWidget` in `DashboardMiniWidgets.tsx` and the stats strip in `MaintenanceTrackerView.tsx:327-335`.
- *Additional fields genuinely necessary?* One: a typed `complete_by TIMESTAMPTZ`. Optionally `complete_by_overridden_reason`. An assignee field is desirable for email targeting but is a business choice.

**C – Room checks**
- *Frequency configuration?* None. *Required checks calculated?* Not at all.
- *Occupancy dates available?* Yes – `placements.start_date` / `end_date` per `room_id`.
- *Completed checks stored?* `room_checks` (date as TEXT, room by text with optional id).
- *Historical reconciliation possible?* Yes, back to the earliest placement data, subject to room-number matching quality.
- *Automatic identification?* Expected set minus matched completed set, per period (§11.3).

**D – Welfare checks**
- *Scheduling / frequency?* None.
- *Resident and property relationships?* `service_users` → `placements` → `property_rooms` → `properties` → `sites`.
- *Follow-up mechanisms?* Free text only. *Safeguarding/escalation workflows?* Separate manual modules (Referrals, Escalations); no link from a welfare check.
- *Detection and reporting?* As C, with the resident as the subject.

**E – Which modules join the shared system**

| Integration type | Modules |
|---|---|
| **Periodic expectation** (engine generates expected items) | Room Checks, Welfare Checks; later Housekeeping, Daily Register, Food logs, Attendance recording if the business wants them |
| **Dated record** (engine watches an existing due date) | Maintenance, SD-Compliance, Property Compliance, PEEP review, Room Issues, Room Inspection, Absence Follow-ups, Referral follow-up, Vulnerable review, SU document expiry, Asset PAT/service, Dispersal/NTV, Evictions |
| **Ageing approval** (engine watches time-in-status) | Data Change Requests, Finance approvals, Transport Funding, SU archive requests |
| **Separate handling** | Finance payment terms (commercial, different audience); Escalations (stay human-raised, but become a *target* of automatic escalation); GP appointments (an appointment passing is not an overdue task – DNA handling already exists) |
| **Not applicable** | Directories, settings, audit, documents repository, report generator |

---

## 11. Proposed Overdue Management Architecture

### 11.1 Principles
1. **One ledger, many detectors.** Every overdue or missed item, from any module, is a row in one table with the same status vocabulary. Modules keep their own tables untouched.
2. **Server-side and deterministic.** Detection runs in Postgres on a schedule. It must not depend on a browser being open or on Express being deployed.
3. **Idempotent by construction.** Each obligation has a natural key. Re-running detection can never create a duplicate.
4. **Never delete history.** A missed check that is later done becomes "completed late", not erased.
5. **Derive, don't duplicate.** The ledger stores the obligation and its state, plus a pointer to the source record. It does not copy module data.
6. **Reuse the Attendance pattern**: pure rule functions that are unit-testable, a unique key, an action history.

### 11.2 Components

```
check_schedules ──┐
property_rooms ───┤                       ┌─► obligations (ledger) ─► Overdue Centre, widgets, reports
placements ───────┼─► detectors (SQL) ────┤
service_users ────┤   run by pg_cron      └─► notification queue ─► dispatcher ─► SMTP
module tables ────┘                             (email_notification_logs,           │
                                                 status = queued)                   ▼
                                                                         email_notification_logs
                                                                          (sent / failed)
```

- **Detectors**: one SQL function per integration type, each ending in `INSERT ... ON CONFLICT (dedupe_key) DO NOTHING` and an `UPDATE` that resolves obligations whose source is now complete.
- **Scheduler**: `pg_cron` – hourly for hour-based SLAs (maintenance CAT 1 / CAT 2 Interim), daily at 06:00 Europe/London for everything else. **[to verify: `pg_cron` and `pg_net` are enabled on the project's Supabase plan]**
- **Dispatcher**: see §12.

### 11.3 How expected obligations are calculated

**Periodic (Room Checks, Welfare Checks)**

For each active schedule, for each period that has **closed** since the schedule's start date:

- *Room check subject set* = rooms in `property_rooms` for the schedule's site, in a usable status, that satisfy the occupancy rule for the period.
- *Welfare check subject set* = service users with an active placement at the site during the period, not archived.
- *Satisfied* = at least one completed check for that subject whose date falls inside the period.
- *Obligation created* for every subject in the set that is not satisfied, with `due_at` = period end.

Optionally a "due soon" obligation is created when a period is open and N days from closing, so staff are prompted before a check is missed. Recommended: yes, as status `due`, not `overdue`.

**Dated record**

An obligation exists when the source row is open and its due date/time is before now. `due_at` = the module's own date. No schedule row needed, only a per-module grace period and warning window.

**Ageing approval**

An obligation exists when a row has been in a pending status longer than the configured threshold.

### 11.4 Detecting missing records
Set difference in SQL: `expected subjects for period` LEFT JOIN `completed checks in period` WHERE no match. Matching order for room checks: `room_id` → normalised (`site`, `room_number`). For welfare checks: `su_id` → `port_reference`. Unmatched completed checks are counted and listed in a reconciliation report rather than ignored.

### 11.5 Preventing duplicates
`dedupe_key` with a UNIQUE index, built as:

| Type | Key |
|---|---|
| Periodic | `module \| subject_type \| subject_id \| period_key` – e.g. `room_check\|room\|rm-204\|2026-W45` |
| Dated record | `module \| source_id \| due_at` – a changed due date produces a new obligation and supersedes the old one |
| Ageing approval | `module \| source_id \| entered_status_at` |

This mirrors `absence_followups_one_per_episode`.

### 11.6 Status model

| Status | Meaning |
|---|---|
| `due` | Inside its window; not late |
| `overdue` | Past `due_at` + grace; no completion |
| `completed` | Done on time (dated records only; periodic items done on time never enter the ledger unless "due soon" was raised) |
| `completed_late` | Was overdue, then done. Records `resolved_at`, `resolved_by_source_id`, days late |
| `missed` | Periodic only. The period closed and a later period's check does **not** retroactively satisfy it. See §19 Q4 |
| `exempt` | A person recorded a reason it did not apply |
| `cancelled` | The source was cancelled/deleted/archived, or the subject left |
| `superseded` | The due date changed; replaced by a new obligation |

### 11.7 How completion resolves obligations
- **Dated record:** the hourly/daily run sees the source row is now complete and sets `completed` or `completed_late` with the source's actual completion time. For immediacy, the module's save path can also resolve it directly (optional optimisation, phase 4).
- **Periodic:** a check saved for subject S resolves S's open obligation for the **current** period. Whether it also closes older missed periods is a business rule (§19 Q4); the recommended default is that older periods stay `missed` and auditable, and only the newest open item is resolved.

### 11.8 Keeping history auditable
- Obligations are never deleted or updated in place beyond status and resolution fields.
- Every status change is appended to `action_history JSONB` (who/what/when/why) – same shape as `absence_followups.action_history` – and mirrored to `audit_trails` with `module = 'Overdue Engine'`.
- Each detector run writes one summary audit row (items created, resolved, errors).
- Ledger rows keep `subject_label`, `site_id`, `site_name` and `period_key` as snapshots, so a report for March still reads correctly after a room is renumbered or a resident leaves.

### 11.9 Exemptions
- Recorded per obligation by a user with the new `canManageOverdue` capability: reason category (resident absent, room void, access refused, hospital admission, other) plus free text. Mandatory reason.
- Standing exemptions (e.g. a room out of use for three months) come from existing data, not a new table: `property_rooms.status` / `blocked_until` / `void_since`, `placements`, `su_attendance_records`. A manual standing exemption can be expressed as a schedule row with a narrower scope if required later.
- Exempt items are excluded from compliance percentages but counted separately so exemptions cannot hide a problem.

### 11.10 Cancelled tasks
- Source row deleted, archived, or set to a cancelled status → obligation `cancelled` with the reason copied from the source where available.
- Maintenance records have no "Cancelled" status today; a defect logged in error can only be deleted. Recommend adding a cancelled state (§19 Q9) so that it is distinguishable from completed work.

### 11.11 Occupied and vacant rooms
Driven by the schedule's `occupancy_rule`:

| Rule | Behaviour |
|---|---|
| `occupied_only` (recommended default for room checks) | A room generates an obligation for a period only if a placement overlapped that period for at least `min_occupied_days` (default 1) |
| `all_usable_rooms` | Every room not void/blocked/out of use |
| `all_rooms` | Every room |

- Room vacated mid-period: obligation still stands if the minimum occupied days were met; otherwise none.
- Room occupied part-way through a period: expected only if the first occupied day is at least `min_occupied_days` before period end, so a resident arriving on the last day does not create an instant miss.
- Welfare: resident who arrived in the last `new_arrival_grace_days` of a period is not expected in that period; resident who departed before period end → open obligation `cancelled`, reason "departed".

### 11.12 Reporting periods

| Frequency | Period | `period_key` |
|---|---|---|
| Daily | 00:00–23:59 local | `2026-11-12` |
| Weekly | Monday 00:00 – Sunday 23:59 local (ISO week) | `2026-W46` |
| Fortnightly | ISO week pairs anchored to schedule start | `2026-F23` |
| Monthly | Calendar month | `2026-11` |
| Quarterly | Calendar quarter | `2026-Q4` |
| Every N days (rolling) | N days since the last completed check for that subject | `roll-<last check date>` |

Calendar periods are recommended for room and welfare checks because they produce a clean "% completed this month" figure. Rolling intervals suit reviews (PEEP already works this way).

### 11.13 Deadlines and time zones
- **Single business time zone: `Europe/London`**, stored in `app_settings` and used by every detector. Period boundaries are computed in local time and stored as `TIMESTAMPTZ`. This handles GMT/BST changes; a naive UTC day boundary would misplace checks done between 00:00 and 01:00 in summer.
- New columns are `TIMESTAMPTZ` or `DATE`. Existing TEXT dates are parsed with an explicit, tested format per column; unparseable values are reported and skipped, never guessed.
- Existing code mixes UTC (`toISOString().slice(0,10)` – e.g. `MaintenanceTrackerView.tsx:362`, `attendanceLogic.ts:45`) and browser-local time (`maintenancePriority.ts:35`). The new engine does not inherit this; the mixed handling is logged as a risk (§18).
- **Hour-based SLAs** (CAT 1, CAT 2 Interim) run on elapsed clock time. **Working-day SLAs** (CAT 2, CAT 3) need a bank-holiday list; today only weekends are skipped. Proposed: an England & Wales bank-holiday list in `app_settings`, maintained by admins.
- Grace period per schedule/module (default 0) before `due` becomes `overdue`.

### 11.14 Worked examples

**Room check – weekly, occupied rooms only.** Brit Hotel, Room 204. Placement active 3–30 Nov. Week 2026-W45 (2–8 Nov): no room check recorded. Monday 9 Nov 06:00 the detector creates obligation `room_check|room|rm-204|2026-W45`, status `missed`, due 8 Nov 23:59. Site staff see it in the Missed Room Checks register; the daily digest lists it for the site manager. A check is done on 10 Nov – that satisfies W46, and W45 remains `missed` for audit (default rule). Room 310 was void all week → no obligation. Room 118's resident arrived on Sunday 8 Nov → not expected in W45.

**Welfare check – monthly, weekly for high risk.** Resident SU-0412, active placement, `vulnerable = Yes`, risk High. Schedule "welfare / weekly / risk=High" applies. No welfare check in W45 → obligation `welfare_check|su|SU-0412|2026-W45`, severity High because the resident is vulnerable. Not resolved within 48 hours → escalation level 2 emails the Area Manager. Resident SU-0388 was recorded absent every day of the week → obligation auto-`exempt`, reason "recorded absent".

**Maintenance – CAT 2 Interim.** Defect reported Friday 6 Nov 16:30. `complete_by` = Saturday 7 Nov 16:30. At the 17:00 hourly run on 7 Nov it is still `In Process` → obligation `maintenance|maint-1731…|2026-11-07T16:30Z`, status `overdue`; email to the site's maintenance recipients. Closed Sunday 11:00 → `completed_late`, 18.5 hours late. If the priority is changed to CAT 2 on Saturday morning, `complete_by` is recalculated, the old obligation becomes `superseded`, and the change is audited with the user's name.

**Compliance – gas safety certificate.** `expiry_date` 30 Nov 2026. On 31 Oct (30 days before) a `due` obligation is created and `compliance.expiring_soon` is queued. Reminders repeat at 14 and 7 days. On 1 Dec with no renewed certificate → `overdue`, `compliance.expired` queued, displayed status becomes Expired regardless of the manual dropdown. When a new row or updated expiry is saved → `completed` / `completed_late`.

---

## 12. Proposed Email Notification Architecture

### 12.1 Design
Keep the existing rules table, HTML template and delivery log. Change **who triggers** and **who receives**.

1. **Queue.** Anything that wants an email inserts a row with status `queued` into `email_notification_logs` (extended, §14) with a `dedupe_key`. The overdue engine does this in SQL; the app's existing record-created events can move to this path over time.
2. **Dispatcher.** A server-side worker claims queued rows, resolves recipients, renders, sends, and records `delivered` / `failed` with attempt count. Retries with back-off up to 5 attempts.
3. **Two viable hosts for the dispatcher** – a business/infrastructure decision (§19 Q1):

| Option | How | For | Against |
|---|---|---|---|
| **A. Supabase Edge Function** invoked by `pg_cron` every 5 min | SMTP credentials as function secrets | Works with today's static hosting; no server to run | New runtime (Deno) – the Nodemailer code is rewritten or replaced by an HTTP email API; SMTP from edge functions needs checking against the provider |
| **B. Express worker** (existing `server/mailer.ts`) polling the queue | Deploy the existing Docker image always-on | Reuses all existing code and the HTML renderer; also restores server-side site isolation | Requires running and paying for a server; the API domain currently has no DNS record |

Recommendation: **B if the business will run the Express container** (it fixes several other problems at once), otherwise A. The queue design is identical in both, so the choice can change later.

### 12.2 Event catalogue to add

| Event code | Trigger | Default recipients |
|---|---|---|
| `maintenance.due_soon` | X% of SLA elapsed (CAT 2/3 only) | Site maintenance staff |
| `maintenance.overdue` | `complete_by` passed | Site manager + maintenance staff |
| `room_check.due_soon` / `room_check.missed` | Period closing / closed | Site staff / site manager |
| `welfare_check.due_soon` / `welfare_check.missed` | Period closing / closed | Site staff / site manager; High severity for vulnerable residents |
| `compliance.expiring_soon` / `compliance.expired` | Already seeded – wire up | As configured |
| `peep.review_overdue`, `room_issue.overdue`, `absence_followup.overdue`, `referral.followup_overdue`, `dispersal.action_overdue`, `approval.ageing` | Dated-record / ageing detectors | Assignee where one exists, else site manager |
| `overdue.daily_digest` | 07:00 daily | Each manager: their sites' open items |
| `overdue.escalated` | Escalation level reached | Next role up |

Plus rules for the six transport events that currently 404, and call sites (or removal) for the seven rules that never fire.

### 12.3 Recipient resolution (in order, de-duplicated)
1. **Responsible user** – the obligation's `assigned_to` if it resolves to an active profile.
2. **Site-scoped role recipients** – active profiles whose role is in the rule's `recipient_roles` **and** whose assigned sites include the obligation's site (or who have All Sites). Reuse the matching logic of `filterNotificationsForRole` / `buildSiteAliases`.
3. **Site manager** – `sites.manager_email` when present and valid.
4. **Custom recipients / CC** on the rule.
5. **Escalation recipients** – by level: L1 site staff → L2 site manager / General Manager → L3 Area / Regional Manager → L4 Admin. Thresholds per rule (e.g. +24h, +72h, +7d).
6. Fallback remains the system mailbox, logged as a configuration warning.

### 12.4 Volume control
- **Digest by default** for `missed` / `overdue` items: one email per recipient per day, grouped by site and module. Immediate emails only for High/Critical (CAT 1, vulnerable-resident welfare, expired statutory certificates) and for escalations.
- Dedupe key per (event, obligation, recipient, level) so a re-run never re-sends.
- Per-run cap and per-recipient daily cap as circuit breakers.
- **Preferences:** per-user opt-out per module and immediate/digest choice, stored on `profiles`. Mandatory categories (safeguarding, CAT 1) cannot be opted out of.

### 12.5 Content rules
Emails cross the organisation boundary into mailboxes. Proposed default: **no resident names or safeguarding detail in subject lines or bodies** for overdue emails – site, room, reference and a link into the app only. Existing templates put `{{suName}}` in subjects; that is a decision for the data protection lead (§19 Q8).

### 12.6 Other fixes to fold in
- Enable TLS certificate validation in `server/mailer.ts`.
- Make the SMTP status endpoint truthful in direct mode.

---

## 13. Page-by-Page UI Enhancement Plan

Existing design patterns to keep: `TrackerLayout` / `TrackerToolbar` / `FilterBar`; KPI card strips as in PEEP and Attendance; `OVERDUE` pill (`text-[9px] font-bold bg-red-100 text-red-800`) and `bg-red-50/60` row tint; amber for due-soon; `ExportModal`; schema-driven columns via `table_schemas`.

### 13.1 Maintenance Tracker – `maintenance/MaintenanceTrackerView.tsx`
| Aspect | Detail |
|---|---|
| Current | SLA due date shown as text; CAT 1 open rows red; stats: total, CAT 1, CAT 2 interim, in process, completed, open |
| Enhancement | Rename column to **Complete By**; true overdue state |
| New columns | Complete By (date + time), Time Remaining / Overdue By, Completed (On time / Late by N) |
| New cards | Overdue, Due in 24 h, Completed late (this month) |
| New filters | SLA state: Overdue / Due soon / On track / Completed late; sort by Complete By |
| Status indicators | Red `OVERDUE` pill and row tint; amber "Due soon" |
| User actions | Edit Complete By with mandatory reason (optional); existing quick-close unchanged |
| Permissions | View: page access. Override date: `canEditRecords` + manager role, or new `canManageOverdue` |

### 13.2 Room Checks – `room/RoomChecksView.tsx`
| Aspect | Detail |
|---|---|
| Current | List of completed checks; filters by site and result |
| Enhancement | Second tab **Due & Missed** beside the existing list |
| New register | Rooms due this period / missed in closed periods: site, property, room, period, occupied (Y/N), last check date, status |
| New cards | Completed this period (n of expected, %), Due, Missed, Exempt |
| New filters | Period, site, property, status |
| User actions | **Start check** (opens the existing form pre-filled with site and room); **Mark exempt** with reason |
| Also | Saving a check updates the room's `last_inspected_at` |
| Permissions | Start check: existing create permission. Exempt: `canManageOverdue` |

### 13.3 Welfare Checks – `welfare/WelfareChecksView.tsx`
| Aspect | Detail |
|---|---|
| Current | List of completed checks |
| Enhancement | **Due & Missed** tab, resident-centred |
| New register | Resident, room, vulnerability flag, required frequency, last check, period, status |
| New cards | Completed this period (%), Due, Missed, Missed – vulnerable residents |
| New filters | Period, site, vulnerability, status |
| User actions | Start check (pre-filled resident); Mark exempt with reason; Raise escalation (pre-fills an Escalations record) |
| Permissions | As Room Checks. Safeguarding text remains limited by the existing `canViewSafeguarding` check |

RFA and MH-Complaint welfare pages: no change in phase 1 of the build; revisit after §19 Q5.

### 13.4 SD-Compliance Tracker – `compliance/SDComplianceTrackerView.tsx`
| Aspect | Detail |
|---|---|
| Current | Manual status dropdown; sort by expiry |
| Enhancement | Status **derived** from expiry date; manual values kept only for "In Progress" |
| New columns | Days to expiry / Days overdue; Last reminder sent |
| New cards | Expired, Expiring ≤ 30 days, Expiring ≤ 90 days |
| New filters | Expiry window |
| Permissions | Unchanged |

Property compliance tab (`PropertyProfileTabs.tsx`): show the same derived status, re-evaluated on display.

### 13.5 Dispersal Sheet (NTV) – `dispersal/DispersalTableSection.tsx`
| Aspect | Detail |
|---|---|
| Current | Dates recorded; no comparison with today |
| Enhancement | Outstanding-action indicator per row |
| New columns | Next action due (derived: letter not handed, exit briefing not done, dispersal date passed without "travelled") |
| New filters | Outstanding actions only |
| Dependency | Date format confirmation (§19 Q10) |

### 13.6 New page – Overdue Centre (`overdue`)
The one genuinely new page. Category: Compliance & Community. Built from `TrackerLayout`.
| Aspect | Detail |
|---|---|
| Purpose | Every open obligation across all modules the user may view, for their sites |
| Register columns | Module, item, site, room/resident, due, overdue by, severity, status, assigned to, escalation level, last notified |
| Cards | Total overdue, Critical, Due today, Missed checks this period, Escalated |
| Filters | Module, site, status, severity, assignee, date range |
| User actions | Open source record; assign; add note; mark exempt; export |
| Tabs | Open · Resolved late · Exempt/Cancelled · Run history (admin) |
| Permissions | View: page access + site scope; **rows only for modules the user can view** (same rule dashboards use). Assign/exempt: `canManageOverdue`. Export: `canExportData` |

### 13.7 Executive Dashboard – `config/dashboardWidgets.ts`, `dashboard/DashboardMiniWidgets.tsx`
Three new widget types in the existing registry: **Overdue summary** (by module), **Missed checks** (room/welfare completion % this period), **My overdue items** (assigned to me). Existing `maintenanceOpen` gains an overdue count; `complianceStatus` switches to derived status. Widget visibility continues to follow page access.

### 13.8 Reports – `reports/ReportsView.tsx`
Two new report types in the existing selector: **Overdue & SLA Performance** (by module/site/period: raised, completed on time, completed late, still overdue, average days late) and **Missed Checks** (expected, completed, missed, exempt, % by site and period). Same filters and export modal.

### 13.9 Email Notifications Management – `notifications/NotificationsManagementView.tsx`
New event rows; per-rule **site-scoped** toggle, reminder offsets, escalation ladder, immediate/digest. Delivery log gains status `queued`, attempts, and a link to the obligation. Honest SMTP status.

### 13.10 Settings – `settings/SettingsView.tsx`
New section **Check schedules & SLAs** (Admin): frequency per module and site, occupancy rule, grace days, warning days, bank holidays, business time zone, maintenance SLA table (moved from code to configuration).

### 13.11 Header and profile
- Bell (`common/Header.tsx`): overdue items feed the existing derived notification list (targeted by user/site).
- User profile: notification preferences.

### 13.12 Small indicator-only changes
PEEP, SU Attendance, Room Issues tab, Referrals, Vulnerable: no redesign. Their existing overdue logic stays; their items also appear in the Overdue Centre.

---

## 14. Database Change Proposal

Nothing here has been applied. All changes are additive and idempotent in the house style (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, nullable).

### 14.1 Extend existing tables (preferred over new tables)

| Table | Add | Why |
|---|---|---|
| `maintenance_records` | `complete_by TIMESTAMPTZ`, `completed_at TIMESTAMPTZ`, `complete_by_override_reason TEXT`; index on (`defect_status`, `complete_by`) | Typed, indexable deadline. Back-filled once from `notes->>'closeDueDate'` and `completion_date`. JSON copy kept in step during transition |
| `email_notification_rules` | `site_scoped BOOLEAN`, `reminder_offsets JSONB`, `escalation_ladder JSONB`, `delivery_mode TEXT` (immediate/digest) | Reminders and escalation without a new rules table |
| `email_notification_logs` | `dedupe_key TEXT UNIQUE`, `obligation_id TEXT`, `attempts INT`, `next_attempt_at TIMESTAMPTZ`, `escalation_level INT`; allow status `queued` | Turns the existing log into the queue; no separate outbox table |
| `profiles` | `notification_prefs JSONB` | Preferences without a new table |
| `role_permissions` | `can_manage_overdue BOOLEAN` | Exempt / assign / override capability |
| `app_settings` | rows: `business_timezone`, `bank_holidays`, `maintenance_sla`, `overdue_defaults` | Configuration |
| `room_checks`, `welfare_checks` | no new columns; **back-fill** `room_id` / `su_id` where null | Reliable matching |

`property_rooms.last_inspected_at` / `next_inspection_due` are reused as they are.

### 14.2 New tables (two – no existing table can carry these)

**`check_schedules`** – what is expected, how often.

| Column | Type | Note |
|---|---|---|
| `id` | TEXT PK | |
| `module` | TEXT | `room_check`, `welfare_check`, later others |
| `site_id` | TEXT → `sites`, nullable | null = all sites default |
| `property_id` | TEXT → `properties`, nullable | optional narrower scope |
| `applies_to` | JSONB | e.g. `{"risk":"High"}`, `{"vulnerable":"Yes"}` |
| `frequency` | TEXT | daily / weekly / fortnightly / monthly / quarterly / interval |
| `interval_days` | INT, nullable | for rolling |
| `occupancy_rule` | TEXT | occupied_only / all_usable_rooms / all_rooms |
| `min_occupied_days`, `new_arrival_grace_days`, `grace_days`, `warn_days` | INT | |
| `effective_from` | DATE | **no obligations are generated before this** |
| `effective_to` | DATE, nullable | |
| `is_active` | BOOLEAN | |
| audit columns | | |

Most specific active schedule wins (property > site > global; with `applies_to` > without).

**`obligations`** – the ledger.

| Column | Type | Note |
|---|---|---|
| `id` | TEXT PK | |
| `dedupe_key` | TEXT UNIQUE NOT NULL | §11.5 |
| `module` | TEXT | |
| `obligation_type` | TEXT | periodic / dated / ageing |
| `source_table`, `source_id` | TEXT, nullable | the record being watched (dated/ageing) |
| `subject_type`, `subject_id`, `subject_label` | TEXT | room / service_user / record; label is a snapshot |
| `site_id`, `site_name`, `property_id`, `room_id`, `su_id` | TEXT | scoping + snapshot; FKs `ON DELETE SET NULL` |
| `schedule_id` | TEXT → `check_schedules`, nullable | |
| `period_key`, `period_start`, `period_end` | TEXT, TIMESTAMPTZ | periodic only |
| `due_at` | TIMESTAMPTZ | |
| `status` | TEXT CHECK | §11.6 |
| `severity` | TEXT | Low/Medium/High/Critical |
| `assigned_to` | UUID → `profiles`, nullable | |
| `escalation_level` | INT default 0 | |
| `last_notified_at` | TIMESTAMPTZ | |
| `resolved_at`, `resolved_by_source_id`, `resolution_type` | | |
| `exemption_reason`, `exemption_by`, `exemption_at` | | |
| `action_history` | JSONB default `[]` | same shape as `absence_followups` |
| `created_at`, `updated_at` | | |

Indexes: (`status`, `site_id`), (`module`, `status`), (`due_at`), (`subject_type`, `subject_id`), (`assigned_to`).

**Considered and rejected:** a separate exemptions table (fields on the ledger suffice); a separate notification outbox (extend the log); a separate history table (`action_history` + `audit_trails`); reusing `escalations` or `absence_followups` as the ledger (module-specific shapes and constraints; `absence_followups` stays as is and is *mirrored* into the ledger by a detector).

### 14.3 Functions and jobs
- `overdue_detect_periodic()`, `overdue_detect_dated()`, `overdue_detect_ageing()`, `overdue_resolve()`, `overdue_escalate()`, `overdue_queue_notifications()`; wrapper `overdue_run(p_mode)`.
- `SECURITY DEFINER`, `SET search_path = public`, `EXECUTE` revoked from `anon` and `authenticated`.
- `pg_cron`: hourly `overdue_run('hourly')`; daily 06:00 London `overdue_run('daily')`; digest 07:00; dispatcher poke every 5 minutes (option A only).
- A manual **Run now** RPC restricted to Super Admin, for testing and recovery.

---

## 15. Technical Implementation Roadmap

Ordered so that each phase is independently releasable, reversible, and silent until deliberately switched on.

| Phase | Scope | Depends on | Est. |
|---|---|---|---|
| **0. Decisions & foundations** | Answer §19 Q1–Q5. Confirm hosting. Verify live schema matches repo. Confirm `pg_cron`. Take a database backup. Decide on the anon RLS script (§16) | – | 1 wk |
| **1. Maintenance Complete By** | `complete_by` column + back-fill; adapter writes both; UI column, cards, filter, badge; widget count. Pure display – no scheduler needed | 0 | 1 wk |
| **2. Ledger + dated-record detectors, shadow mode** | `obligations`, settings, detector functions for Maintenance, Compliance, PEEP, Room Issues, Absence follow-ups; `pg_cron` jobs; **no emails**. Compare ledger with hand counts for two weeks | 0 | 2 wks |
| **3. Overdue Centre, widgets, reports** | New page, three widgets, two reports, RBAC capability, RLS for new tables | 2 | 2 wks |
| **4. Email dispatcher** | Queue columns; dispatcher (option A or B); site-scoped recipient resolver; escalation ladder; digest; preferences; fix dead and missing rules; pilot on one site | 0 (hosting), 2 | 2 wks |
| **5. Room check schedules & missed detection** | `check_schedules`; settings UI; room-id back-fill + reconciliation report; periodic detector; Due & Missed tab; link check → `last_inspected_at`. Start date = go-live, no retroactive alerts | 2, 3; Q2 | 1.5 wks |
| **6. Welfare check schedules & missed detection** | As 5 for residents; su-id back-fill; vulnerability-driven frequency; escalation path | 5; Q3, Q5 | 1.5 wks |
| **7. Remaining modules & hardening** | Referral follow-up, vulnerable review, dispersal/NTV, evictions, SU documents, approvals ageing; bank holidays; historical reconciliation report (read-only); performance review | 2–6 | 1–2 wks |

Mapping to the brief's 13 items: (1) database – phases 1, 2, 4, 5; (2) backend services – 2, 4; (3) scheduled processing – 2; (4) email – 4; (5) detection engine – 2; (6) missed-check reconciliation – 5, 6, 7; (7) dashboards – 3; (8) module updates – 1, 5, 6, 7; (9) audit logging – 2 onward; (10) RBAC/RLS – 3; (11) testing – every phase (§17); (12) deployment and (13) rollback – below.

### 15.1 Deployment
- Migrations numbered from `033_`, each also folded into `db/schema.sql` per the existing convention. Applied via `npm run db:migrate` or the SQL editor.
- Feature flags in `app_settings`: `overdue_engine_enabled`, `overdue_emails_enabled`, per-module `detector_enabled`. Everything ships **off**.
- Order per release: migration → verify → deploy frontend → enable flag for one pilot site → widen.
- Frontend deploys remain a push to `main` (Amplify build).

### 15.2 Rollback
| Layer | Rollback |
|---|---|
| Emails | Set `overdue_emails_enabled = false`. Immediate; queued rows stay queued |
| Detection | `cron.unschedule(...)` and set `overdue_engine_enabled = false`. Ledger left in place |
| UI | Revert the frontend commit; new columns/tables are ignored by old code |
| Schema | All changes are additive and nullable, so old code runs unchanged. Tables/columns can be dropped later with a scripted, reviewed migration; rollback notes included in each migration file as 028 does |
| Maintenance due date | JSON `closeDueDate` is kept in step throughout, so the old code path still has its value |

No phase modifies or deletes existing data except the two back-fills (room ids, SU ids), which only fill nulls and are logged row by row.

---

## 16. Security and RLS Considerations

### 16.1 Current state (findings)
1. **Most tables: any authenticated user, any row.** 21 explicit policies plus looped policies are `FOR ALL TO authenticated USING (true) WITH CHECK (true)` (`db/schema.sql:2098-2100` and many others). In direct mode a Staff user at one site can read and write every site's records, including welfare checks containing safeguarding text. Site isolation exists only in Express.
2. **`db/enable-direct-supabase-rls.sql` grants `anon` full CRUD on ~95 tables** (`:126`, `:139-143`) – including `profiles`, `service_users`, `welfare_checks`, `audit_trails` – and grants `anon` execute on workflow RPCs. `docs/AMPLIFY_HOSTING.md:67-70` instructs running it for static hosting. **[unverified whether applied to production.]** If it has been, the database is readable and writable by anyone holding the publishable key, which ships in the browser bundle. **This should be checked before any other work and is independent of this project.**
3. `docs/live-database.md` states anon policies were removed; the script above contradicts that. One of the two is out of date.
4. Page-access overrides are enforced by RESTRICTIVE RLS policies, which is sound, but only for users who have override rows.
5. Mailer disables TLS certificate validation.
6. Emails currently include service user names in subjects.

### 16.2 Requirements for the new work
- `obligations` and `check_schedules`: RLS enabled; `anon` revoked entirely; **do not add them to the direct-access script's table list**.
- `obligations` SELECT policy scoped by site: user is Admin/Super Admin, or has All Sites, or the row's site is in the user's assigned sites. Implemented with a `SECURITY DEFINER` helper `user_can_see_site(site_id)` reading `profiles.assigned_site` and `property_user_assignments` – this would be the first site-scoped RLS in the schema and should be designed to be reusable for existing tables later.
- Module-level visibility: a user without access to a page must not see that module's obligations. Combine with `page_perm_allowed(page, 'view')` using a module → page map.
- Writes to `obligations` only through RPCs (`obligation_exempt`, `obligation_assign`, `obligation_note`) that check `can_manage_overdue` and site scope and append to `action_history`. No direct INSERT/UPDATE/DELETE for `authenticated`.
- `check_schedules`: read for authenticated; write Admin/Super Admin via RPC.
- Detector and dispatcher functions: `SECURITY DEFINER`, fixed `search_path`, execute revoked from `anon`/`authenticated`.
- SMTP credentials live only in server-side secrets (Edge Function secrets or server env) – never in `VITE_*` variables.
- Obligation rows hold labels and references, not safeguarding narrative.
- Every exemption, reassignment, due-date override and schedule change is audited with actor, time and reason.

---

## 17. Testing Strategy

| Level | What | How |
|---|---|---|
| **Unit (pure logic)** | Period calculation incl. BST/GMT boundaries, ISO week 53, month ends; occupancy rules; dedupe keys; SLA calculator with bank holidays; recipient resolution and site scoping; status transitions | `node:test` via `npm run test:unit`, in the style of `tests/attendanceLogic.test.ts` and `tests/notificationScope.test.ts` |
| **SQL / detector** | Seeded fixtures → run detector → assert ledger rows; **run twice → zero new rows**; resolve, supersede, cancel, exempt paths; TEXT-date parsing incl. malformed values | Scratch Supabase project or local Postgres; never production |
| **Adapter** | `complete_by` round trip; back-fill from `notes` JSON | Extend `server/schemaAdapter.test.ts` |
| **RLS** | Staff at site A cannot read site B obligations; user without Maintenance page access sees no maintenance obligations; `anon` sees nothing; direct INSERT refused | Extend `tests/securityScope.test.ts`, `tests/pagePermissions.test.ts` |
| **Email** | Queue → send → log; retry on failure; dedupe; digest grouping; caps; opt-out respected; mandatory categories not suppressible | SMTP sandbox (e.g. a capture mailbox); never real recipients in test |
| **End-to-end** | Maintenance overdue badge; Due & Missed tab → start check → item resolves; Overdue Centre filters; widget counts match register | Playwright (already a dev dependency) |
| **Shadow / reconciliation** | Two weeks with emails off: ledger counts vs. manual counts per site; unmatched-check report reviewed with operations | Phase 2 exit criterion |
| **Performance** | Detector runtime at 10× current rooms/residents; index use on ledger queries | `EXPLAIN ANALYZE` on scratch data |
| **Regression** | Existing suite stays green; `npm run lint` | Every phase |

Specific cases that must exist: resident arrives on the last day of a period; room becomes void mid-period; check dated 00:30 on a BST Sunday→Monday boundary; priority changed after due date passed; record deleted while overdue; two detector runs overlapping; schedule changed from weekly to monthly mid-month; site renamed.

---

## 18. Risks and Dependencies

| # | Risk / dependency | Impact | Mitigation |
|---|---|---|---|
| 1 | **No always-on backend in production [unverified]** | No email, no server scheduler | Decide hosting in phase 0; design works with `pg_cron` + Edge Function if no server |
| 2 | **Check frequencies not defined by the business** | Phases 5–6 cannot start | Decision required (§19 Q2, Q3) |
| 3 | Anon full-access RLS script may be live | Data exposure; any new table added to it would be exposed too | Verify immediately; keep new tables out of it |
| 4 | `pg_cron` / `pg_net` availability on the Supabase plan | Scheduler design | Verify in phase 0; fallback is an external scheduler calling an RPC |
| 5 | Live schema may differ from the repo | Migrations may fail or miss columns | Compare before phase 1 (`npm run db:coverage`, schema dump) |
| 6 | TEXT dates, mixed formats (`MM/DD/YYYY` in dispersal) | Wrong or skipped overdue items | Per-column parsers with tests; report unparseable rows; fix data before enabling that detector |
| 7 | Sites referenced by name in older tables | Obligations attached to the wrong or no site | Alias map as the in-app notifier uses; add `site_id` to the ledger from the resolved match; report non-matches |
| 8 | Room / resident matching by free text | False "missed" items | Back-fill ids; reconciliation report; shadow period |
| 9 | Alert fatigue at go-live | Staff ignore emails | Start date = go-live (no backlog alerts); digest by default; pilot site; caps |
| 10 | Mixed UTC/local time in existing code | Off-by-one-day and off-by-one-hour errors, esp. maintenance due times saved in browser-local time | New code uses `Europe/London` server-side; back-fill treats stored values as London time; document the assumption |
| 11 | Two parallel data paths (Express adapter and direct Supabase adapter) | Every schema change must be made in both or the modes diverge | Put logic in Postgres functions; add both adapters to each phase's checklist |
| 12 | `AppContext.tsx` is 6,189 lines and centralises most CRUD | High regression risk when touching save paths | Keep engine logic out of it; prefer DB-side resolution over new client hooks |
| 13 | Email content and data protection | Personal data leaving the system | Decision §19 Q8; default to references only |
| 14 | Working-day SLAs ignore bank holidays today | Disputed overdue results | Bank-holiday list in settings (phase 7), or accept and document |
| 15 | SMTP provider limits (e.g. Gmail daily caps; default host is `smtp.gmail.com`) | Throttled or blocked sends | Digest, caps; consider a transactional email service |
| 16 | No maintenance assignee field | Overdue emails can only go to roles/site manager | Decision §19 Q9 |
| 17 | Repository hygiene: ~20 zero-byte files with shell-fragment names in the repo root and `src/` (e.g. `` `${String(1 ``, `f.type`, `src/u.id`), some tracked | Noise; accidental commits | Clean up separately; not part of this project |

---

## 19. Questions Requiring Business Decisions

**Blocking (needed before build starts)**

1. **Hosting.** Will the Express server be run as an always-on service, or must everything work with static hosting plus Supabase only? This decides the email dispatcher and affects site-level security.
2. **Room check frequency.** How often must each room be checked – weekly, fortnightly, monthly? Same for every site, or per site/contract? Occupied rooms only, or all rooms? Is there a contractual source (e.g. the accommodation contract's inspection requirement) that should be quoted in the system?
3. **Welfare check frequency.** How often per resident? Does it differ for vulnerable or high-risk residents, families, or new arrivals? Is there a "first check within N days of arrival" rule?
4. **Late completion.** If last week's check is done this week, is last week still recorded as *missed*, or as *completed late*? (Recommended: stays missed; this week's is satisfied.)
5. **Which welfare records count.** Do RFA Welfare Checks and MH-Complaint Welfare Checks satisfy a resident's welfare-check obligation, or only the main Welfare Checks form?

**Needed before the relevant phase**

6. **Escalation ladder.** Who is told, after how long, at each level? Is the answer different for safeguarding, maintenance and compliance?
7. **Recipients.** Should site emails go to everyone assigned to the site with a given role, to the named site manager on the property record, or both? Who maintains site manager emails?
8. **Email content.** May emails contain resident names or references, or only site/room and a link? Who signs this off for data protection?
9. **Maintenance.** Does the SLA clock start when the defect is *reported* or when it is *entered*? May a manager extend a Complete By date, and must they give a reason? Is a named assignee/contractor contact wanted? Is a "Cancelled" status wanted? Are the 4h / 24h / 5 / 28 working-day targets contractual and fixed?
10. **Dispersal / NTV.** Which steps have deadlines (letter handed within N days of receipt? exit briefing before dispersal date?), and are the stored dates day-first or month-first?
11. **Compliance reminders.** Reminder points – 90 / 30 / 14 / 7 days? Who is responsible for renewal: site manager or a central compliance owner?
12. **Exemptions.** Who may exempt a check, and which reasons are acceptable? Should exemptions need a second person's approval?
13. **Historical backlog.** Should past missed checks be calculated and reported (read-only, no alerts), and how far back? Or does counting start at go-live?
14. **Working days.** Should bank holidays extend working-day SLAs? Do any sites operate a different working week?
15. **Digest vs. immediate.** Is one daily summary acceptable for non-critical items? What time?
16. **Other periodic logs.** Should Housekeeping, Daily Register, food temperature logs or attendance recording also be treated as expected daily tasks with missed detection?
17. **Reporting audience.** Are overdue/missed reports for internal management only, or supplied to the client/Home Office? That affects definitions and the need for locked period-end figures.

---

## 20. Final Recommended Implementation Plan

1. **Immediately, outside this project:** confirm whether `db/enable-direct-supabase-rls.sql` has been run against production, and confirm how production is hosted. Both findings change the risk picture regardless of these enhancements.
2. **Hold a decisions session** on §19 Q1–Q5. Nothing in phases 4–6 can be specified without them.
3. **Build in this order**, each phase shipped dark behind a flag and enabled for a pilot site first:
   1. Maintenance Complete By (visible quick win, no dependencies).
   2. Obligations ledger and dated-record detectors in **shadow mode** – proves the engine against real data with no user impact.
   3. Overdue Centre, dashboard widgets and reports – managers get value before any email is sent.
   4. Email dispatcher with site-scoped recipients, digest and escalation – pilot on one site.
   5. Room check schedules and missed detection.
   6. Welfare check schedules and missed detection.
   7. Remaining modules, bank holidays, historical reconciliation, hardening.
4. **Keep the design constraints:** one ledger; detection in Postgres; idempotent keys; additive schema only; no change to existing module tables beyond the maintenance column and two id back-fills; reuse of the rules table, delivery log, widget registry, tracker layout and the Attendance follow-up pattern.
5. **Definition of done for the programme:** a manager can open one page and see every overdue or missed item for their sites; each item was created by the system without anyone opening a page; the right people were emailed once, at the right level; completing the work clears the item and leaves an audit trail showing it was late.

**Estimated complexity: High. About 9–12 developer-weeks**, plus the shadow period and decision lead time. The estimate assumes one developer familiar with the codebase and prompt answers to §19; it excludes any work to stand up or secure hosting.

---

*End of Phase 1 deliverable. No implementation has been started. Awaiting approval and the decisions in §19 before any Phase 2 work.*
