# SDTracker – Operational Workflow Audit

**Audit only.** Prepared 12 November 2026. Nothing in the application, database, authentication configuration or deployment was changed to produce this document or its companion, [SDTRACKER_IMPLEMENTATION_ROADMAP.md](SDTRACKER_IMPLEMENTATION_ROADMAP.md).

**How to read the evidence.** Findings cite `file:line` from the current `main` (commit `eed50be`). Four things cannot be verified from the repository and are marked **[unverified]**:

1. The **live Supabase database** (row counts, data quality, whether migration 033 has been applied).
2. The **Supabase Authentication dashboard** (Site URL, Redirect URL allow-list, email templates, SMTP provider, password policy). This matters most for Phase 6.
3. **Production hosting mode** (static Amplify with no Express server, or Express reachable).
4. **Email delivery** from the real mailbox / spam filtering.

This audit builds on [SDTRACKER_OVERDUE_AND_NOTIFICATION_AUDIT.md](SDTRACKER_OVERDUE_AND_NOTIFICATION_AUDIT.md) and [SDTRACKER_CENTRAL_DASHBOARD_AUDIT_AND_DESIGN.md](SDTRACKER_CENTRAL_DASHBOARD_AUDIT_AND_DESIGN.md); it does not repeat their module inventory except where a requirement depends on it.

---

## 1. Summary of findings

| # | Requirement | State today | Headline |
|---|---|---|---|
| 2.1 | Maintenance before/after images | **Broken** | The form has "Before/After Picture(s)" fields but they are plain text boxes with no uploader, and their values are **never saved or read back**. Only one undifferentiated "Attached Files" gallery works. |
| 2.2 | Maintenance closing timer | **Partly there** | Reported time, Complete By (SLA) and closed date/time exist. No Closing Timer column. No assigned/started timestamps. Status history is not recorded. |
| 3 | Twice-monthly Room/Welfare checks | **Missing** | Both are plain logs. No frequency, deadline, obligation, assignment or missed-check detection exists anywhere. |
| 4 | Operations Dashboard check visibility | **Partly there** | Dashboard exists and is accurate for maintenance, compliance and reviews. It has no check obligations, no first/second-check columns, no responsible person for checks. |
| 5 | SU selection and global autofill | **Partly there, inconsistent** | Two different selectors exist; Room Checks, Welfare Checks and Food Surveys use one, most dynamic forms use the other, and the transport forms (feedback, funding requests) use neither. Autofill logic is duplicated and keyed on column-name guesses. |
| 6 | Password reset and setup | **Broken / unreliable** | Four overlapping implementations consume a single-use token more than once; the browser path that runs first depends on Supabase dashboard settings that the repo cannot confirm; there is **no first-time setup flow at all**. |

**Biggest cross-cutting dependency:** Phases 3–4 (and any reminder emails) need a scheduled job. There is no scheduler in the codebase and production may have no always-on server. That hosting decision is needed before the *notification* parts of the work, but not before the *calculation and display* parts (§8.3).

---

## 2. Existing module inventory (relevant to this task)

The complete 46-page inventory is in the first audit (§3). The modules touched by these requirements:

| Module (page id) | Table(s) | Edited through | Notes |
|---|---|---|---|
| Maintenance Tracker (`maintenance`) | `maintenance_records` | `DynamicRecordFormModal` driven by `maintenanceTableConfig` | Record body is a JSON string in `notes` |
| Room Checks (`roomChecks`) | `room_checks`, `room_check_items` | custom form in `RoomChecksView.tsx` | Room by text `room_number` + optional `room_id` |
| Welfare Checks (`welfareChecks`) | `welfare_checks` | custom form in `WelfareChecksView.tsx` | SU by `port_reference` + optional `su_id` |
| RFA / MH-Complaint Welfare | `rfa_welfare_checks`, `mh_complaint_welfare_checks` | dynamic form | Name/ref typed or picked |
| Public Transport – Authorisations | `public_transport_records` | `DynamicRecordFormModal` | SU names + port refs |
| Public Transport – Journey Feedback | `transport_feedback` | custom form `TransportFeedbackSection.tsx` | **No SU field** |
| Public Transport – Site Challenges | `transport_challenges` | custom form `TransportChallengesSection.tsx` | Site-level periodic return |
| Public Transport – Funding Requests | `transport_funding_requests` (+ history) | `TransportFundingSection.tsx`, `FundingWorkflowModal.tsx` | SU as typed text |
| Public Transport – Room Moves | `transport_room_move_requests` (**not defined in `db/schema.sql` or any migration**) | `PublicTransportTrackerView.tsx` via `AppContext` (`transportRoomMoveRecords`) | `occupantRef` typed text |
| Service Users Master | `service_users`, `placements`, `service_user_contacts`, `service_user_support` | `ServiceUsersView` | The source of truth for SU profile data |
| Property Management | `properties`, `property_rooms`, `room_beds`, `room_issues` | `PropertyManagementView` | Source of rooms and occupancy |
| Operations Dashboard (`operations`) | reads others | `OperationsDashboardView.tsx` | Built this session |
| Login / Reset / Users | Supabase Auth + `profiles` | `LoginView`, `ResetPasswordView`, `UsersView`, `server/routes/auth.ts` | |

---

## 3. Maintenance Tracker audit

### 3.1 How a job is created, assigned, updated, completed (as implemented)

| Step | Implementation |
|---|---|
| Create | "Log Defect" opens `DynamicRecordFormModal` with `maintenanceTableConfig` (`src/config/trackerTableConfigs.ts:53-266`). Priority change fills `priorityTimeScale` and `closeDueDate` from the **reported** date/time (`reportedAt(form.date, form.reportedTime)`, lines 81-88). |
| Assign | **No assignee field.** The adapter reads `allocatedContractor`/`contractor` (`schemaAdapter.ts:2131`) but the form has no such column. `raisedBy` is the reporter. |
| Update | Edit modal (same config). Status select (`In Process`/`Completed`) and Action (`Open`/`Closed`) are independent and kept in step by handlers. |
| Complete | `defectStatus=Completed` or `action=Closed` stamps `actualClosedDate` and (since this session) `actualClosedTime`. Quick-close button exists. |
| Audit | Each create/update writes one `audit_trails` row (`module: 'Settings'`, see first audit). **No status history table.** |

### 3.2 Timestamps and history that exist

| Wanted | Exists? | Where |
|---|---|---|
| Job creation | Yes | `createdAt` / `created_at` |
| Reported date/time | Yes | `date` + `reportedTime` → `reported_date`, `reported_time` |
| Assignment | **No** | – |
| Work started | **No** (`progress` is free text) | – |
| Completion / closed | Yes | `actualClosedDate`, `actualClosedTime` (`completion_date`, `actual_closed_time`) |
| SLA deadline | Yes | `closeDueDate` (text in `notes` JSON) and typed `complete_by` (migration 033, **not yet confirmed applied**) |
| Time in each status | **No** | status changes are not stored as events |
| Total time to close | Derivable | closed − reported |

### 3.3 Before / after images – what actually happens

This is the most important finding of Phase 2.

| Layer | Finding | Evidence |
|---|---|---|
| Form | `Before Picture(s)` / `After Picture(s)` are declared `type: 'text'` and fall through to the generic `<input type="text">`. **No upload control.** The only uploader on the form is the generic "Attachments" section. | `trackerTableConfigs.ts:214-245`; generic input `DynamicRecordFormModal.tsx:1222-1232`; uploader only for `attachments` `:1252` |
| Table | Both columns use `renderAttachmentCell`, which prefers `record.attachments` over the column value, so **both columns show the same generic files**. | `trackerTableConfigs.ts:15-20, 215-237` |
| Persistence | `beforePictures`/`afterPictures`/`…Date` are listed in `knownMaintKeys` so they are **excluded from the saved JSON envelope**; only `before_picture_url` (first `url`) and `*_date` are written to columns. | `schemaAdapter.ts:2141-2152` |
| Read back | `fromDatabaseRow` for `maintenance_records` **never reads** `before_picture_*`/`after_picture_*` columns or any before/after array. | `schemaAdapter.ts` maintenance block (`closeDueDate`… `attachments`, no picture fields) |
| View | `DynamicRecordViewModal` renders one `AttachmentsSection` gallery; no before/after split. | `DynamicRecordViewModal.tsx:216-260` |
| Storage | **No storage bucket.** Files are base64 data-URLs inside the record JSON (`AttachmentsSection.tsx:37-67`, 8 MB per file; request body limit 15 MB). Buckets exist only for finance (`finance-documents`), HC2 (`su-health-documents`) and report history. | `AttachmentsSection.tsx`, `db/schema.sql:4092-4095`, `financeService.ts:679` |
| Per-image metadata | `RecordAttachment` already carries `uploadedBy` and `uploadedAt`. | `types/index.ts:14-23` |

**Verdict:** the before/after *schema hints* exist (type fields, adapter columns, config entries) but the feature is **non-functional end to end**. What can be reused: `RecordAttachment` (has uploader and time per image), `AttachmentsSection` (upload, preview, delete, size check, permission via `canManageFiles`), the `before_picture_*`/`after_picture_*` columns (but they hold one URL, not a gallery).

**Required changes (summary; detail in the roadmap):**
- Two `AttachmentsSection` instances with separate arrays (`beforeImages`, `afterImages`), each with its own title, in create/edit; read-only in view.
- Persist and read back both arrays (adapter + type), keeping `attachments` for invoices/other files.
- Split View Record into BEFORE WORK / AFTER WORK sections with the fields asked for (original defect, initial condition, upload time, uploader / completed work, final condition, upload time, uploader).
- Table: two compact thumbnails/counters instead of two copies of the same cell.
- Move image bytes out of the JSON row into a private storage bucket with signed URLs (decision §14, Q1) – otherwise a handful of photos makes each maintenance row, and every 45-second batch read of the whole table, very large.
- Completion rule: require at least one after image to close (decision, Q2).

### 3.4 Closing timer

**Definition recommended:** start = reported date/time (`date` + `reportedTime`, falling back to `createdAt`); end = `actualClosedDate` + `actualClosedTime` (falling back to the date at end of day is *not* recommended; show "closed, time not recorded"). Open jobs: elapsed since the same start. This reuses existing fields and adds no timestamp.

| Column | Open job | Closed job |
|---|---|---|
| Complete By | existing | existing |
| Closing Timer | "Open for 1d 4h" (elapsed, grey label) | "Closed in 2h 35m" (fixed duration) |
| Current Status | existing status | existing |
| Overdue Duration | "Overdue by 3h" (exists since this session) | "Late by 40m" when closed after Complete By |
| SLA breach | red tag while overdue | grey "Late" tag |

Duration format per the brief (`2h 35m`, `1d 4h`, `3d 12h`): the existing `formatDuration` (`maintenancePriority.ts`) already produces `45m`, `3h`, `2d 4h`; minutes under an hour+ need `2h 35m`, a small extension.

**Gaps that limit it:** no "work started" or "assigned" event, so *time to start* and *time per status* cannot be shown. If wanted, add two nullable timestamps (`assigned_at`, `started_at`) or a status-history table (Q3). The brief says not to add duplicate timestamps unnecessarily; the minimum viable timer needs **no new column**.

**Existing quirks to fix on the way:** the legacy create/priority handlers in `MaintenanceTrackerView` still compute the due date from "now", not the reported time (lines ~346-358); the active dynamic form already uses the reported time. The time-zone note from the first audit still applies (tracker badge uses browser clock; selectors use London).

---

## 4. Room Check audit

### 4.1 What exists

- Table `room_checks`: `site_id`, `site_name`, **`room_number TEXT`**, optional `room_id`, `su_id`, `property_id`, `officer_id`, `officer_name`, **`inspection_date TEXT`** (date only), `overall_status`, `final_comments`, `data JSONB`; children `room_check_items` (30 answers). Indexes on site, room, status, date.
- UI: `RoomChecksView.tsx` – list, 30-point form, grading (`calculateRoomOverallStatus`: Passed / Issues / Attention Required), uses `SiteServiceUserSelector` to pick site → SU → fills room (lines 646-660).
- A room's own `last_inspected_at` / `next_inspection_due` (Property Management) are **not** updated by a room check.

### 4.2 Frequency / obligation support

**None.** Searched schema, types, settings, field options and UI: no frequency, schedule, due date, period, obligation or "missed" concept. A check is an after-the-fact log row. This answers Phase 3 §3.1: the twice-monthly rule is **not supported** and must be built.

### 4.3 Data available to calculate obligations

| Need | Source | Quality |
|---|---|---|
| Applicable rooms | `property_rooms` (exclude out-of-use statuses and seeded placeholders) | Good where rooms set up |
| Occupancy dates | `placements` (`start_date`, `end_date`, `status`, `room_id`) | Good: exact intervals |
| Completed visits | `room_checks` (`room_id` if present, else normalised `room_number` + site) | **Weak join**: `room_id` optional; `room_number` is free text |
| Site / property | `property_rooms.property_id` → `properties.site_id` | Good |
| Visit date | `inspection_date` TEXT | Format must be confirmed; time of day not stored |
| Completed by | `officer_name` (text), `officer_id` (text), `created_by` (uuid) | `officer_name` defaults to the logged-in user but is editable |
| Evidence/notes | `room_check_items`, `final_comments`, `data` | Reusable |

Historical reconciliation requires back-filling `room_id` on older checks by matching site + normalised room number; unmatched rows must be listed, not guessed.

---

## 5. Welfare Check audit

### 5.1 What exists

- Table `welfare_checks`: `site_id`, `site_name`, optional `su_id`, `port_reference` (NOT NULL), `flat_number`, `officer_id`, `officer_name`, **`check_datetime TIMESTAMPTZ`**, ~25 declaration fields, `status` (default `Completed`), `data JSONB`.
- UI: `WelfareChecksView.tsx`, `SiteServiceUserSelector` fills `suId`, `portReference`, `flatNumber` (lines 560-575).
- Sibling pages `rfa_welfare_checks` and `mh_complaint_welfare_checks` are separate logs with no `su_id`.

### 5.2 Frequency / obligation support

**None** (same as rooms). A welfare check is also not linked to follow-up: `safeguardingConcerns` is free text that raises nothing.

### 5.3 Data available

Resident set = `service_users` (status Active, `archive_status` Active) joined to an **active placement** in the period. Visits = `welfare_checks` by `su_id`, else `port_reference` matched to `service_users.external_reference`/`su_reference`. `check_datetime` is a proper timestamp (better than the room check date). Same weak-join caveat for older rows without `su_id`.

**Business question that blocks the rule:** whether RFA and MH-Complaint welfare entries count towards a resident's two checks (Q8).

---

## 6. Responsibility and assignment – what can be reused

| Relationship | Where | Granularity | Usable as "responsible person"? |
|---|---|---|---|
| User ↔ site | `profiles.assigned_site`, `property_user_assignments` | site | Yes, as the *pool* of staff for a site |
| Site manager | `sites.manager_name/email/phone` | site (free text) | Fallback / escalation |
| Property lead officer | `PropertyInfo.leadOfficer`; resolved to an account by `findUserForOfficer` (`leadOfficerSync.ts`) | property | **Best existing "owner" for rooms** (General/Area Managers auto-become lead officer when assigned) |
| Property manager | `PropertyMaster.propertyManager` (text) | property | Alternative |
| SU support staff | `service_user_support.assigned_staff` | per support item | Not a general key worker |
| Allocated worker | `VulnerableSU.allocatedWorker` | vulnerable cases only | Partial |
| Completed by | `officer_name`, `created_by` | per record | Yes for "completed by" |

There is **no per-room or per-SU keyworker**. Recommended resolution order for an obligation: (1) explicit assignee on the obligation, (2) property lead officer account, (3) property manager account, (4) site manager, (5) unassigned (shown as such, escalated). Whether SU-level welfare checks should instead have a named keyworker is a business decision (Q9).

---

## 7. The twice-monthly rule – design of the obligation model

### 7.1 Rule as written
Per month, per applicable subject: **Check 1 by the 10th, Check 2 by the 25th** (business time zone), each tracked independently.

### 7.2 Ambiguities that must be settled (they change the numbers)

1. "Before the 10th" vs "by the 10th": is a visit **on** the 10th on time? (Recommended: on time through end of the 10th, as the brief also says "deadline: 10th".)
2. **Which visit satisfies which check?** Options:
   - *Window rule:* Check 1 is satisfied by a visit dated 1st–10th, Check 2 by a visit dated 11th–25th. Late visits (e.g. on the 14th for Check 1) are recorded as "completed late" against Check 1 only if Check 1 is still open.
   - *Sequential rule (recommended):* visits in the month are allocated in date order to the earliest open obligation; a second visit cannot satisfy Check 1 if Check 1 already has a visit. Guarantees "completing the first must not complete the second" and handles late visits.
3. A visit dated 26th–month-end: counts towards the **next** month's Check 1 or is surplus? (Recommended: surplus for the current month unless an obligation is still open.)
4. **Mid-month arrivals/departures and void rooms:** obligation applies if the subject was placed/occupied at least N days before the deadline (Q6).
5. Exemptions: who may exempt and which reasons.

### 7.3 Status vocabulary
`pending` (before deadline) → `completed` / `completed_late` / `overdue` (after deadline, no visit) → `exempt` / `cancelled`. A month's overall status is derived from the two (Complete / Incomplete); the two are never merged into a single "2 of 2" count.

### 7.4 What must be stored per obligation
Month, period (1 or 2), check type (room/welfare), SU, room, site, property, assignee (snapshot), deadline, linked check record id, actual visit date, completion timestamp, completed by, status, exemption reason. Evidence and notes stay on the existing check record; the obligation only points at it.

### 7.5 Historical months
Compute the same obligations for past months from placement history and mark them `missed` where no visit exists. These rows are **expectations, not visit records** – nothing is written to `room_checks`/`welfare_checks`. They must be flagged `source = backfill` and be excluded from alert emails.

---

## 8. Operations Dashboard audit

### 8.1 What exists (built this session)
`operations` page: 8 KPIs, Attention Required, Upcoming Deadlines, Operational Overview matrix, Sites table, admin-only Recent activity; static, no animation; clickable KPIs and row-opens for Maintenance, Compliance, Escalations, PEEP, Follow-ups, Property Management (`OperationsDashboardView.tsx`, `operationsSelectors.ts`).

### 8.2 Gaps against the new requirements

| Requirement | Today | Gap |
|---|---|---|
| Completed vs not completed | counts per area; "Completed in period" column | No per-subject view |
| Overdue / due soon | yes for dated records | no check obligations |
| Who completed | not shown | add "completed by" to rows |
| Who is responsible | owner only for follow-ups/room issues | add responsible person from §6 |
| First / second check columns | none | new table (§8.4) |
| Required frequency displayed | none | static caption "2 per month: by 10th and 25th" read from settings |
| Missed checks | none | new |
| Monthly period completed/outstanding | none | new |

### 8.3 Can this be shown before the scheduler/ledger exist?
**Yes.** All inputs (placements, rooms, residents, checks) are already loaded in the browser. Obligations and their statuses can be **calculated on read** for the current and past months with a pure function (the same approach as the existing selectors), giving full dashboard visibility without any database change or scheduler. What that cannot do: persist an assignee, record an exemption or follow-up, send reminders. Those need the ledger (§12.2).

### 8.4 Proposed dashboard additions
- New section **Required checks – <month>** with a month selector, a type switch (Room / Welfare) and a site filter.
- Table columns: Site · Property · Room · Service User (welfare) · **Check 1 (by 10th)** · **Check 2 (by 25th)** · Overall · Responsible · Completed by. Each cell: status tag + visit date, never a combined count.
- Frequency caption: "Required: 2 per month – 1st by the 10th, 2nd by the 25th."
- KPIs (all computable): required checks, completed, completed on time, completed late, outstanding (pending), overdue, completion %, exempt. Maintenance/compliance KPIs already exist. **Outstanding NTV actions: still not computable** (dispersal dates are text with an ambiguous format and no deadlines are defined).
- Attention list gains "Check overdue" rows (priority after compliance expired, before reviews – Q10).

---

## 9. Service User selection and profile autofill audit

### 9.1 Two selectors, three styles of autofill

| Mechanism | Where used | How it picks SUs | Writes | Problems |
|---|---|---|---|---|
| `SiteServiceUserSelector` | Room Checks, Welfare Checks, Food Surveys | site → property → SU from **active placements** (real master data) | returns a typed `SelectedServiceUserSummary` (id, ref, name, property, room, site, external ref); **each page copies fields by hand** | Field mapping duplicated per page |
| `PropertyRelativeSUSelector` (inside `DynamicRecordFormModal`) | all dynamic-form pages with an SU-like column; Quick Incident | master SUs **plus names scraped from other trackers** | name string (+ `suId` of the last pick) | Creates **synthetic SUs** (`synth-…` ids, random `SU-nnnnn` references) from tracker records; matches by name; multi-select stores comma-separated names and only one `suId` |
| Hard-coded heuristics in `DynamicRecordFormModal` | dynamic forms | decides an "SU column" and "profile columns" by **lower-cased key/label guesses** (`isServiceUserColumn`, `isSuProfileColumn`, lines 312-346) and fills port ref, room, DOB, nationality, language, address | fills form fields; locks them | Works only for column names it recognises; no phone/contact/support-staff; not reusable by custom forms |
| Nothing | Transport Feedback, Transport Funding, Room Move | typed text | – | No SU identity at all |

### 9.2 Profile fields that actually exist

| Field | Source | Present? |
|---|---|---|
| SU id / reference | `service_users.id`, `su_reference` | Yes |
| Port / external ref | `external_reference`, `case_reference` | Yes |
| Name | first/middle/last/preferred | Yes |
| DOB, gender, nationality, language, interpreter | `service_users` | Yes |
| Site | `service_users.site_id` and active placement `site_id` | Yes (placement is authoritative) |
| Property, room, bed | active `placements` → `properties`, `property_rooms`, `room_beds` | Yes |
| Contact details | `service_user_contacts` (mobile, email, emergency contact) | Yes, separate table, **not loaded by either selector** |
| Assigned support staff | `service_user_support.assigned_staff` (per support item) | Partial |
| Vulnerable flag / PEEP | `service_users.vulnerable`, `personal_evacuation_plan` | Yes |
| Archive status | `archive_status` | Yes (must exclude archived) |

### 9.3 Per-form audit (Phase 5.1)

| Form | Create | Edit | View | Stores SU as | Needs |
|---|---|---|---|---|---|
| Public Transport – Authorisations (`public_transport_records`) | **Has** SU picker (multi) via dynamic form; fills port refs, address | same | text | names (`su_names`), refs (`port_refs`), single `suId` in JSON (`data`) | Store **all** ids (array), don't overwrite typed values, pre-load on edit |
| Journey Feedback (`transport_feedback`) | **Missing** (site, route, issue only) | missing | – | nothing | Add optional SU(s) affected |
| Site Challenges (`transport_challenges`) | **Not applicable** – a site-level periodic return (counts, practices) | – | – | – | Confirm SU is not wanted here (Q11) |
| Funding Requests (`transport_funding_requests`) | **Missing** – `mainAppRef`, `mainAppInitials`, `groupMember` typed | missing | text | typed text | Add SU picker; derive ref, initials, name, phone, address, room; keep `mainAppRef` for HO reference |
| Room Moves | **Missing** – `occupantRef` typed | missing | text | typed text | Add picker; also fills current room |
| Oyster issue dialog | uses `suHint=mainAppRef` string | – | – | text hint | Resolve to SU id |

No transport table has an `su_id` typed column; `suId` currently survives only inside the `data` JSON of tables that have one.

### 9.4 Proposed global mechanism (summary; detail in the roadmap)
One **pure resolver** `resolveServiceUserProfile(suId, masterData)` returning a normalised profile (all fields above, plus `missing[]`), one **hook** `useServiceUserSelection({ fieldMap, onApply })` that applies the profile to a form while respecting "do not overwrite user-entered values" (tracks which fields the user has touched) and refreshes on SU change, and one **component** `ServiceUserPicker` (searchable, permission- and site-scoped, placement-based, archived excluded, **never creates SUs**). `PropertyRelativeSUSelector`'s synthetic fallback should be retired for forms that store an SU id; legacy free-text records stay viewable.

### 9.5 Pages that should use it (to confirm during Phase D discovery)
Room Checks, Welfare Checks, RFA Welfare, MH-Complaint Welfare, Food Surveys, GP Appointments, SPCD, SG Referrals, Vulnerable, Challenging, Escalations, Dispersal/Evictions, IR Tracker, Public Transport (Authorisations, Journey Feedback, Funding, Room Moves), Oyster issue, Quick Incident, Laundry (resident intake), Food Box Requests, HO Report Generator. Those that go through `DynamicRecordFormModal` inherit the shared behaviour once the modal is switched to the new mechanism; custom forms (Room/Welfare/Food/Transport) each need a small adaptation.

---

## 10. Password reset and setup audit

### 10.1 What exists
- Provider: **Supabase Auth**. Server routes in `server/routes/auth.ts`; browser client in `src/lib/supabaseClient.ts` (`detectSessionInUrl: true`).
- Request: `apiService.resetPassword` (`apiService.ts:1477-1551`).
- Server request route `/api/auth/reset-password` (`auth.ts:801-950`): validates the email, generates a recovery link with the admin API, sends a **branded SMTP email** containing an application link `…/reset-password?token_hash=…&type=recovery&email=…` **and a 6-digit code**; falls back to Supabase's own mailer.
- Completion: `ResetPasswordView.tsx` (mode request/otp/link/success), `LoginView.tsx` recovery panel (lines 134-230), `AppContext.tsx` recovery listener (1414-1540), `apiService.confirmResetPassword` (1557-1624), server `/confirm-reset-password` (987+), `/update-password` (twice), `/verify-recovery`.
- User creation: `/api/auth/signup` (admin-set password, `email_confirm: true`, welcome email with **no link and no password**), `/bulk-import` (random temporary password, **no email**).

### 10.2 Findings (ranked)

| # | Finding | Effect | Evidence |
|---|---|---|---|
| P1 | **The recovery token is consumed by more than one component.** On load, `AppContext` calls `verifyOtp(token_hash)`; then `ResetPasswordView` stores the same `token_hash` and, if its `updateUser` fails (session not ready yet), calls `confirmResetPassword` which calls `verifyOtp` **again**. A `token_hash` is single-use, so the second call fails with "expired or invalid". A page refresh repeats it because the used token stays in the URL (the effect only rewrites the URL when the path is not already `/reset-password`). The same applies to the PKCE `code` (`exchangeCodeForSession` in both `AppContext` and `ResetPasswordView`). | Intermittent "link expired / already used" even for a first click | `AppContext.tsx:1462-1506`; `ResetPasswordView.tsx:92-124, 229-275`; `LoginView.tsx:162-176` |
| P2 | **The browser path runs first.** `resetPassword` calls the browser `resetPasswordForEmail` before the server route, and returns on success. The branded SMTP/token_hash route (built to avoid localhost links and scanner issues) is used **only if the browser call errors**. In static-hosting mode the server route does not exist at all. | The email that is actually sent is Supabase's own template, governed by dashboard settings the repo cannot see | `apiService.ts:1486-1550` |
| P3 | **Supabase dashboard dependencies** (unverifiable here): Site URL; Redirect URL allow-list must contain every origin used (`https://trackers.sdcdms.co.uk/reset-password`, Amplify preview domains, localhost for development); email template must contain the link; built-in Supabase mailer has a very low send limit unless custom SMTP is configured; project password minimum must be ≤ the app's 12. The code comments themselves record the historic symptom: links "pointing to localhost:3000". | Wrong redirect, no email, or rate-limit | `auth.ts:827-837` comment; `urlHelper.ts:83-100` |
| P4 | **One-time links vs email security scanners.** Supabase's default link is a one-time `/auth/v1/verify` URL; mail gateways that pre-open links consume it, giving "otp_expired" on the user's own click. The app's own `token_hash` link would survive this (it is only consumed by JavaScript in the page) but is not the path normally taken (P2). | Common "link already used" complaint | design of default flow |
| P5 | **The "enter your 6-digit code" fallback only exists in the server-branded email.** When the Supabase template is used (P2), no code is sent, yet the expired-link screen tells the user to enter one. | Dead-end screen | `ResetPasswordView.tsx:84-90` |
| P6 | **No first-time setup flow.** Admin creates the account with an admin-typed password, or bulk import assigns a random one nobody sees; the welcome email has no setup link. New users cannot sign in until they discover Forgot Password. No "must change password" flag exists. | New staff locked out | `auth.ts:367-475, 478-620` |
| P7 | **Duplicated implementations.** Four code paths (AppContext listener, ResetPasswordView, LoginView panel, apiService) and two `/api/auth/update-password` routes (the second is unreachable). `App.tsx` renders `ResetPasswordView` whenever the path/hash looks like recovery, so the `LoginView` panel is largely dead code. | Fixes in one place do not apply to others | `auth.ts:666, 1106`; `App.tsx:99-114, 184-198` |
| P8 | **Recovery session left behind.** After success the Supabase recovery session stays in local storage (no `signOut`), and other sessions of that user are not revoked. | Account stays signed in; weaker security after reset | `ResetPasswordView.tsx:236-245` |
| P9 | **Unrelated hard failures masked as "expired".** `LoginView` rewrites network failures ("failed to fetch") into "link has expired", hiding real causes. | Misleading diagnosis | `LoginView.tsx:198-205, 224-228` |
| P10 | Error handling is otherwise reasonable: unknown emails return the same message (no account enumeration) on both paths; passwords are not logged; server enforces 12 characters; audit rows record `RESET_PASSWORD` without the password. | – | `auth.ts:801-950` |

### 10.3 Root cause assessment
Not a single bug. The most probable causes of "not working effectively", in order:
1. **P1** (double consumption of a single-use token) – deterministic in the code, explains intermittency and refresh failures.
2. **P3/P2** (reliance on Supabase email/redirect configuration through the browser path) – explains "no email", localhost links and rate limits; **needs a dashboard check** (checklist in the roadmap).
3. **P6** – new users cannot get in at all, which users report as "reset not working".
4. **P4** – scanners consuming links.

This is repairable without replacing authentication: keep Supabase, make **one** component own the token exchange, make the server-branded link the primary path, and add an invite flow built on the same recovery mechanism.

### 10.4 Security requirements check

| Requirement | Today |
|---|---|
| Secure single-use tokens | Yes (Supabase) – but mishandled (P1) |
| No account-existence leak | Yes |
| Expired/reused handling | Present but conflated with network errors (P9) |
| Protected pages before auth | Yes (`App.tsx` gate) |
| Preserve roles | Yes (profile row decides) |
| No passwords in tables/logs | Yes; audit log excludes password |
| Revoke other sessions / sign out recovery session | **No** (P8) |
| Rate limiting | Supabase-side and client cooldown only; no server limiter on `/reset-password` |

---

## 11. Database model analysis

| Concern | Existing | Reuse | Change needed |
|---|---|---|---|
| Maintenance record | `maintenance_records`; body in `notes` JSON; typed `complete_by` (033) | yes | picture arrays persisted; optional `assigned_at`, `started_at` |
| Maintenance images | base64 in JSON | `RecordAttachment` shape | new private bucket + storage path in attachment |
| Room checks | `room_checks` (+items) | yes | back-fill `room_id`; optional `obligation_id` link |
| Welfare checks | `welfare_checks` | yes | back-fill `su_id`; optional `obligation_id` |
| Rooms / occupancy | `property_rooms`, `placements`, `properties`, `room_beds` | yes | none |
| Residents | `service_users`, `service_user_contacts`, `service_user_support` | yes | none |
| Obligations | **none** | – | `obligations` ledger (generic, shared with the overdue plan) |
| Schedule | none | `app_settings` | keys: `business_timezone`, check days (10, 25), frequency (2) – a dedicated `check_schedules` table is **not** needed for one global rule |
| Assignment / exemption / follow-up | none (follow-ups exist for absence only) | fields on the obligation | columns on `obligations` |
| Transport SU link | `su_names`, `main_app_ref` text | – | nullable `su_id`/`su_ids` on `public_transport_records`, `transport_feedback`, `transport_funding_requests`, room-move table |
| Auth | Supabase Auth + `profiles`, `password_audit_logs` | yes | optional `profiles.must_change_password` |
| Storage buckets | `finance-documents`, `su-health-documents`, report-history | pattern | `maintenance-evidence` (private) |
| RLS | `USING (true)` for any authenticated user on most tables; anon script risk (first audit §16) | – | new tables must be site-scoped from day one |
| Functions / triggers | `update_updated_at_column`, domain workflows | pattern | `obligations_generate(month)`, `obligations_reconcile()` |

---

## 12. Existing reusable components and logic

| Reuse | For |
|---|---|
| `AttachmentsSection`, `RecordAttachment` (uploader, time) | before/after galleries |
| `maintenancePriority.ts` (`getSlaInfo`, `formatDuration`, `reportedAt`) | closing timer |
| `operationsRules.ts` (London time, strict site resolver, date parsers) | obligation periods |
| `operationsSelectors.ts` (+ `OperationsDashboardView`) | dashboard check tables |
| `SiteServiceUserSelector`, `suPropertyService`, `propertyOccupancy`, `isActivePlacement` | SU picker core |
| `findUserForOfficer` / `LEAD_OFFICER_ROLES` | responsible person |
| `attendanceLogic.followUpsToCreate` + `absence_followups` | idempotent obligation generation pattern, action history |
| `navigateWithIntent` | dashboard → record links |
| `smtp.ts` rules/log/HTML template | overdue/reminder emails |
| `server/routes/auth.ts` reset-password (branded email with token_hash + code) | primary reset path |
| `password_audit_logs` | reset auditing |

---

## 13. Identified bugs (consolidated)

| ID | Area | Bug |
|---|---|---|
| B1 | Maintenance | Before/after fields are text inputs; no uploader |
| B2 | Maintenance | Before/after values never persisted or read back (adapter excludes the keys from the envelope; read path ignores the columns) |
| B3 | Maintenance | Before and after table columns render the same generic attachments |
| B4 | Maintenance | View shows a single mixed gallery |
| B5 | Maintenance | Images stored as base64 inside the row JSON (size, 8 MB cap, slow batch reads) |
| B6 | Maintenance | Legacy handlers compute Complete By from "now" rather than the reported time |
| B7 | Checks | No frequency, no obligations, no missed detection |
| B8 | Checks | `room_checks.room_id` / `welfare_checks.su_id` optional; older rows match only by text |
| B9 | Checks | A room check does not update the room's `last_inspected_at` / `next_inspection_due` |
| B10 | SU | `PropertyRelativeSUSelector` fabricates SUs with random references from tracker records |
| B11 | SU | Multi-select stores names; one `suId` only |
| B12 | SU | Autofill depends on column-name heuristics; duplicated field mapping per page |
| B13 | SU | Journey Feedback, Funding Requests, Room Moves have no SU identity |
| B14 | Auth | Recovery token consumed by several components (P1) |
| B15 | Auth | Browser mailer path preferred over the server-branded one (P2) |
| B16 | Auth | No first-time setup / invite (P6) |
| B17 | Auth | Duplicate `/update-password` route; 4 parallel implementations (P7) |
| B18 | Auth | Recovery session not signed out after success; other sessions not revoked (P8) |
| B19 | Auth | Network failures reported as "link expired" (P9) |
| B20 | Dashboard | No check-obligation view (this task) |
| B21 | Transport | The table `transport_room_move_requests` is referenced by `server/schemaAdapter.ts`, `server/routes/db.ts` and `AppContext.tsx` but is **not created by `db/schema.sql` or any migration**. Room-move requests can only persist if someone created the table by hand **[unverified in the live database]** |

---

## 14. Requirements gap matrix

| Requirement | Module | Exists | Partly | Missing | Broken | Reuse | Change |
|---|---|:-:|:-:|:-:|:-:|---|---|
| Before images | Maintenance | | ✔ type fields | upload, store, view | ✔ | `AttachmentsSection` | 2 uploaders, persist, bucket |
| After images | Maintenance | | ✔ | same | ✔ | same | same |
| Before/after view sections | Maintenance | | | ✔ | | `DynamicRecordViewModal` shell | custom sections |
| Complete By column | Maintenance | ✔ (this session) | | | | – | none |
| Closing Timer column | Maintenance | | | ✔ | | `formatDuration`, closed time | add column + view row |
| Overdue duration | Maintenance | ✔ | | | | – | none |
| Assigned/started timestamps | Maintenance | | | ✔ | | – | optional (Q3) |
| 2 checks/month | Room, Welfare | | | ✔ | | – | obligation model |
| Overdue detection | Room, Welfare | | | ✔ | | selector pattern | calc + ledger |
| Independent completion | Room, Welfare | | | ✔ | | check tables | allocation rule |
| Historical reconciliation | Room, Welfare | | | ✔ | | placements | backfill flagged |
| Responsible person | Room, Welfare | | ✔ lead officer | per-room/SU owner | | `findUserForOfficer` | resolver + snapshot |
| Follow-up | Room, Welfare | | | ✔ | | `absence_followups` pattern | ledger fields |
| Dashboard check tables | Operations | | | ✔ | | selectors | new section |
| Frequency visible | Operations | | | ✔ | | settings | caption |
| SU picker everywhere | Transport etc. | | ✔ | Feedback, Funding, Room Move | | `SiteServiceUserSelector` | shared picker |
| Global autofill | All | | ✔ dynamic forms only | custom forms | | resolver pieces | shared hook |
| Reset request | Auth | | ✔ | | ✔ intermittent | server route | single owner |
| First-time setup | Auth | | | ✔ | | recovery mechanism | invite email + flag |
| Reset troubleshooting | Auth | | | | ✔ | – | checklist (roadmap §E) |

---

## 15. Proposed changes (by layer)

**UI**
- Maintenance: two image sections in create/edit, BEFORE/AFTER sections in view, two thumbnail cells and a Closing Timer column in the table.
- Dashboard: "Required checks" section (§8.4), KPI additions, attention rows.
- Room/Welfare: "Due & Missed" tab and "Start check" from an obligation (pre-filled), a frequency caption.
- Shared `ServiceUserPicker` in every form listed in §9.5; read-only SU summary in View modals.
- Auth: one Reset/Setup page; request page unchanged in look; clear distinct messages for expired, used, invalid and offline.

**Backend**
- Obligation generator/reconciler (SQL function or server job) and a check-completion matcher.
- Server-branded reset path as primary; invite-email endpoint; remove duplicate route; sign-out/revoke after reset; rate-limit `/reset-password`.
- Storage endpoints/signed URLs for maintenance evidence.

**Database** (all additive; none applied)
- `obligations` ledger; `app_settings` keys; nullable `su_id`/`su_ids` columns on transport tables; optional `assigned_at`/`started_at`; optional `profiles.must_change_password`; private bucket `maintenance-evidence`; back-fill scripts for `room_id`/`su_id`.

**Security**
- New tables get site-scoped RLS (not `USING (true)`); signed URLs for images; no passwords or tokens in logs; token consumed once, client-side; revoke other sessions after reset.

---

## 16. Testing plan (summary)

Maintenance: upload before/after, reload, view split, permissions, size limits, closed-time rules, timer formats (`2h 35m`, `1d 4h`, `3d 12h`), SLA breach. Checks: month-boundary and BST cases, 10th/25th inclusivity, late visits, two visits same day, room vacated mid-month, SU transferred, archive, exemptions, backfill idempotency, "Room 401/402/403" scenarios from the brief. Dashboard: numbers equal rows. SU picker: scope by site/role, archived excluded, edit loads existing SU, changing SU does not overwrite typed values, stale profile refresh. Auth: first click, second click (must say used), refresh on the reset page (must not re-consume), expired, wrong email (same message), offline, scanner pre-fetch simulation, invite and first login, session revocation, rate limit. Full plan per phase is in the roadmap.

---

## 17. Questions requiring business decisions

1. **Image storage:** store evidence in a private storage bucket with signed links (recommended) or keep embedding in the record? Maximum photos per side and size?
2. **Closing rule:** must at least one *after* image be uploaded before a job can be closed? Is a *before* image mandatory when logging?
3. **Timer start:** reported time (recommended) or assignment/start time? Do you want *assigned* and *work started* recorded (two new timestamps) or is reported→closed enough?
4. **Deadline meaning:** is a visit on the 10th/25th on time? Do the checks count only inside their window (1st–10th, 11th–25th) or is the sequential allocation (§7.2) acceptable?
5. **Surplus visits** (after the 25th): next month's first check, or extra?
6. **New arrivals and departures:** how many days must a room/resident be in place before an obligation arises for that month? What about void/out-of-use rooms?
7. **Exemptions:** who can exempt, which reasons, second approver?
8. **Welfare scope:** do RFA and MH-Complaint entries count towards a resident's two checks?
9. **Responsibility:** property lead officer for rooms (recommended); for welfare, the same or a named keyworker per resident?
10. **Dashboard priority** of missed checks in the attention list; who may see all sites?
11. **Site Challenges:** confirm it stays site-level with no SU field.
12. **Historical depth:** how far back should missed months be reported (no alerts, read-only)?
13. **Reminders:** email before deadlines (e.g. 3 days) and after? Needs the hosting decision (first audit §19 Q1).
14. **Reset/invite:** invite link validity (24h? 72h?), password rules beyond 12 characters, force change on first login, revoke other sessions after reset.
15. **Supabase dashboard:** someone with project access to confirm Site URL, redirect allow-list, custom SMTP and email templates (checklist in the roadmap).
16. **Legacy free-text records:** keep as-is (recommended) or attempt a one-off name→SU matching report?

---

*End of audit. No implementation has been started. Waiting for approval and the decisions above.*
