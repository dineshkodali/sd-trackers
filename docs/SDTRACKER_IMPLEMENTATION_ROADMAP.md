# SDTracker – Implementation Roadmap

**Planning only.** Companion to [SDTRACKER_OPERATIONAL_WORKFLOW_AUDIT.md](SDTRACKER_OPERATIONAL_WORKFLOW_AUDIT.md) (findings, evidence, bug list B1–B21, decisions Q1–Q16). Nothing here has been started. Every phase ships dark (feature flag or hidden page), is additive, and can be rolled back by reverting the commit; database changes are additive and nullable.

## 1. Recommended order

| Order | Phase | Why here |
|---|---|---|
| **1** | **E – Password reset and first-time setup** | Users who cannot sign in cannot use anything else; independent of every other phase; mostly code, one dashboard checklist |
| **2** | **A – Maintenance images and closing timer** | Self-contained, clear scope, builds on the Complete By work already shipped |
| **3** | **D – Service User picker and global autofill** | Shared component also needed by B (check start forms pre-filled) and by transport forms |
| **4** | **B – Room/Welfare twice-monthly obligations** | Largest design; needs decisions Q4–Q9; do the calculate-on-read version first |
| **5** | **C – Dashboard visibility for checks** | Consumes B's calculation; no new data |
| **6** | **B2 – Persisted ledger, assignment, reminders** | Needs the hosting decision and scheduler (earlier audit §19 Q1) |

Phase letters follow the brief; the order above is the execution order.

## 2. Cross-cutting rules (all phases)

- **No fabricated history.** Missing visits are shown as missed; nothing is inserted into `room_checks` / `welfare_checks`.
- **One definition, tested.** Rules live in pure functions with unit tests before any UI (same pattern as `operationsRules.ts` and `attendanceLogic.ts`).
- **Business time zone** stored in `app_settings` (`business_timezone`, default `Europe/London`); no code outside the rules module reads the machine zone.
- **Security:** new tables get site-scoped RLS; no tokens or passwords in logs; images through signed URLs.
- **Flags:** `feature_check_obligations`, `feature_maintenance_evidence` in `app_settings`, off by default.
- **Migrations** numbered from `034_`, mirrored into `db/schema.sql`, rollback notes in each file; backup before applying.

---

## Phase E – Password reset and first-time setup

**Goal:** a user can request a reset, receive one working email, set a password once, and sign in; new users can set their first password.

### E0. Diagnose before coding (no code, 30 minutes with project access)
Checklist for someone with Supabase and Amplify access:
1. Authentication → URL Configuration: **Site URL** is the production origin (not `localhost:3000`); **Redirect URLs** include `https://trackers.sdcdms.co.uk/reset-password`, any Amplify domain in use, and development origins.
2. Authentication → Email: is **custom SMTP** configured? (The built-in sender has a very low hourly limit.) Are "Confirm signup" / "Reset password" templates enabled and containing the link?
3. Authentication → Policies: minimum password length ≤ 12 (the app enforces 12).
4. Environment: server `APP_URL` set to the production origin; `SMTP_*` set; is the Express server actually reachable by the browser (`VITE_API_URL`)?
5. Mail: send a reset to a test mailbox; check spam; check whether the mail gateway pre-opens links (try a second mailbox type).
6. Record which path ran (browser `resetPasswordForEmail` vs server route): look at server log `[Auth] Initiating password recovery`.
The result decides how much of E1 is needed beyond code.

### E1. Fix the flow (code)
| Item | Change |
|---|---|
| Single owner of the token | One module `auth/recoveryFlow.ts` exchanges the URL token exactly once (`token_hash` via `verifyOtp`, PKCE `code`, or hash tokens), stores the result in context, **immediately removes the token from the URL** (`history.replaceState`), and exposes `recoverySession` / `recoveryError`. `AppContext` listener, `LoginView` panel and `apiService.confirmResetPassword` stop consuming tokens. |
| One page | `ResetPasswordView` becomes the only UI (request / enter code / set password / success) and only reads `recoverySession`. Delete the dead `LoginView` recovery panel and the duplicate `/update-password` route. |
| Path priority | `apiService.resetPassword` calls the **server route first** when a backend is configured (branded email with token_hash link and 6-digit code, avoids the localhost-link and scanner problems); browser `resetPasswordForEmail` only when no backend exists. Make the "enter code" fallback consistent with the email actually sent. |
| Messages | Distinguish *used*, *expired*, *invalid*, *offline* and *Supabase unreachable*; never relabel network errors as "expired". |
| After success | `signOut()` the recovery session, revoke the user's other sessions (admin `signOut(userId, 'global')` through the server), show confirmation, return to login; optional confirmation email "your password was changed". |
| Hardening | Rate-limit `/api/auth/reset-password` per IP and per email; keep identical responses for unknown emails; keep audit rows (no password). |
| Password rules | One shared validator (length ≥ 12, confirmation match) used by the page and server; show requirements before submit. |

### E2. First-time setup (new)
1. Admin creates a user **without choosing a password** (random one set internally, never shown).
2. Server sends an **Account setup email** with a one-time link (generated with the same recovery mechanism, longer validity per Q14) to the same `/reset-password` page in "setup" wording.
3. `profiles.must_change_password` (optional, Q14) forces setup on first login for users created before this change.
4. Bulk import sends the same invitation instead of silently setting a password; failures are listed.
5. "Resend invitation" action on the Users page.
Accounts stay `Inactive`→`Active` per existing status logic; roles and sites are untouched.

### Files
`server/routes/auth.ts`, `server/urlHelper.ts`, `server/mailer.ts` (templates), `src/services/apiService.ts`, `src/context/AppContext.tsx` (recovery effect), `src/components/auth/ResetPasswordView.tsx`, `LoginView.tsx`, `UsersView.tsx`, `BulkUserImportModal.tsx`, new `src/auth/recoveryFlow.ts` + test.

### Database
Optional `profiles.must_change_password BOOLEAN DEFAULT false`. No other change.

### Tests
Unit: token extraction and one-shot exchange (mocked client); error classification; validator. Manual/E2E: first click works; second click says used; refresh on `/reset-password` does not re-consume; expired; wrong email gives the same message; offline; scanner pre-fetch (open link twice quickly); invite → set password → login; other session is ended after reset; rate limit; password change email.

### Security
Tokens never logged or stored; token stripped from URL immediately; no enumeration; revocation after reset; invite link single-use; protected pages remain gated.

**Complexity:** Medium (≈ 1.5–2 weeks incl. E0). **Risk:** touching authentication – feature-flag the new page, keep the old route available for one release.

---

## Phase A – Maintenance images and Closing Timer

### A1. Before / after images
| Layer | Change |
|---|---|
| Types | `MaintenanceRecord.beforeImages?`, `afterImages?: RecordAttachment[]`, plus `initialCondition?`, `finalCondition?`, `completedWorkDetails?` (text). |
| Form | In `DynamicRecordFormModal` add a column type `images` rendering an `AttachmentsSection` per side with `title` "Before work"/"After work", image-only, size limits from Q1. Before section editable until work starts (Q2 sets mandatory rules); After section enabled when status moves towards Completed. Remove the two broken text columns and their date columns (date/time and uploader come from each image's `uploadedAt`/`uploadedBy`). |
| Adapter | Persist both arrays in the `notes` envelope (remove from `knownMaintKeys` exclusions), read them back in `fromDatabaseRow`; keep `before_picture_url`/`after_picture_url` columns filled with the first image's storage link for reports. Migration of existing `attachments` that are really before/after photos is **not** attempted (no basis to classify). |
| Storage | Private bucket `maintenance-evidence`; upload on selection through a small service (signed upload), store `{path, name, size, type, uploadedBy, uploadedAt}` in the record, display via short-lived signed URLs; fall back to embedded data URL only if storage is unavailable (flagged). Backend: signed URL endpoints behind site-scoped authorisation (Express) and `SECURITY DEFINER` RPC or storage policy for direct mode. |
| View | `MaintenanceRecordView` replacing the generic view for this page: **BEFORE WORK** (original defect description, initial condition, before images with uploaded time/by) and **AFTER WORK** (completed work details, final condition, after images with time/by), then the rest of the record; galleries never merged. Image preview reuses the existing lightbox. |
| Table | Replace the two duplicate attachment cells with `Before (n)` / `After (n)` thumbnail counters; "No after photo" tag on closed jobs when required. |
| Rules | If Q2 = yes, closing (status Completed / action Closed / quick-close) is blocked until ≥ 1 after image exists, with a clear message. |

### A2. Closing Timer and table
- Pure functions `closingTimer(record, now)` in `maintenancePriority.ts`: start = `date`+`reportedTime` (fallback `createdAt`), end = `actualClosedDate`+`actualClosedTime`; returns `{ kind: 'elapsed' | 'closed' | 'closed-time-unknown', ms }`.
- Table columns (in this order): **Complete By · Closing Timer · Current Status · Overdue Duration**. Open: "Open 1d 4h" (neutral); closed: "Closed in 2h 35m"; SLA breach tag red while open-overdue, grey "Late by 40m" when closed late. View Record shows the same plus reported, closed and Complete By timestamps.
- Duration formatting extended to hours+minutes (`2h 35m`) and days+hours (`1d 4h`, `3d 12h`).
- Optional (Q3): `assigned_at`, `started_at` columns and "Assigned", "Started" actions that stamp them; status history table only if time-per-status is required.
- Fix B6 (legacy handlers use reported time).
- Export gains Closing Timer.

### Files
`src/config/trackerTableConfigs.ts`, `src/types/index.ts`, `server/schemaAdapter.ts` (+test), `src/components/common/DynamicRecordFormModal.tsx` (new `images` type), `AttachmentsSection.tsx` (image-only/title props), `MaintenanceTrackerView.tsx`, new `MaintenanceRecordView.tsx`, `src/utils/maintenancePriority.ts` (+test), new storage service, migration `034_maintenance_evidence.sql` (bucket; optional `assigned_at`, `started_at`).

### Tests
Adapter round-trip for both arrays (B2); view separation; permissions (`canManageFiles`, site scope); oversize/non-image rejected; upload failure keeps the form; closing blocked without after image (if Q2); timer table: opened 09:00 closed 11:35 → `2h 35m`; opened Mon 09:00 closed Tue 13:00 → `1d 4h`; BST boundary; closed without time; late closure; open overdue.

### Security
Private bucket; signed URLs ≤ 60 s; no public links; file type allow-list (jpeg/png/webp/heic); size cap; uploader recorded server-side where possible.

**Complexity:** Medium–High (≈ 2 weeks). **Migration:** yes (bucket; optional columns).

---

## Phase D – Service User picker and global autofill

### D1. Shared pieces
1. `src/utils/serviceUserProfile.ts` – pure `resolveServiceUserProfile(suId, data)` → `{ suId, suReference, externalReference, fullName, dob, gender, nationality, language, interpreter, siteId, siteName, propertyId, propertyName, roomId, roomNumber, bedLabel, phone, email, emergencyContact, supportStaff, vulnerable, hasPeep, archived, missing: string[] }`. Uses the **active placement** as the source of site/property/room (not the possibly stale `service_users.site_id`).
2. `src/hooks/useServiceUserProfiles.ts` – loads and caches master data once (service users, placements, properties, rooms, contacts, support), refreshes on `sdtracker:masterDataUpdated`, applies site/role scope (same rules as `isSitePermitted`/`allowedSites`), excludes archived.
3. `src/components/common/ServiceUserPicker.tsx` – searchable combobox (name, SU ref, port ref, room), shows name + ref + room, single or multi, returns ids; **never creates an SU**; supports "clear".
4. `src/hooks/useServiceUserSelection.ts` – `({ fieldMap, getForm, setField })`: on selection applies mapped fields; tracks fields the user edited by hand and **does not overwrite them** (offers "Update from profile" button instead); on SU change refreshes mapped fields; on edit loads the stored SU id and shows the **current** profile summary next to the stored values (stale detection).
5. Field maps are declared per form (`{ portReference: 'externalReference', flatNumber: 'roomNumber', … }`) so there is no column-name guessing.

### D2. Adoption order
1. Switch `DynamicRecordFormModal` to the shared picker/hook (retires `isServiceUserColumn`/`isSuProfileColumn` heuristics and the synthetic SU path; legacy free-text values still display).
2. Room Checks, Welfare Checks, Food Surveys (replace hand-copied mappings).
3. Transport: Authorisations (multi: store `su_ids`), **Journey Feedback** (new optional SU field), **Funding Requests** (SU picker fills `mainAppRef`, initials, name, phone, address, room; `mainAppRef` stays the HO reference), Room Moves (fills current room, occupant), Oyster issue (resolve SU id from the request).
4. Remaining forms in audit §9.5.

### D3. Database
Additive nullable: `su_id` (or `su_ids JSONB`) on `public_transport_records`, `transport_feedback`, `transport_funding_requests`, `transport_room_move_requests`; indexes on them. **Also confirm or create `transport_room_move_requests` (B21)** – currently not in `schema.sql`.

### Tests
Resolver (missing fields, transferred SU, no placement, archived); scope (site-restricted user cannot select other sites' SUs); autofill vs manual edit; change SU twice; edit form restores the right SU and flags a changed room; multi-select ids; no duplicate SU creation; legacy record without id opens.

### Security
Picker only lists SUs the user may see; profile fields limited to what the form needs (no safeguarding text); RLS unchanged for reads (direct mode relies on client-side scope – first audit §16).

**Complexity:** High (≈ 3 weeks across all forms; shared core ≈ 1 week).

---

## Phase B – Twice-monthly Room and Welfare checks

### B1. Rules and calculation (no database change)
- Settings (in `app_settings`): `check_frequency_per_month = 2`, `check_deadline_days = [10, 25]`, `business_timezone`, `new_arrival_grace_days`, occupancy rule. Defaults shipped in code so nothing needs saving first.
- `src/utils/checkObligations.ts` (pure, tested): `expectedObligations(month, subjects, placements, rooms, settings)`, `allocateVisits(obligations, visits)` (sequential rule, Q4), `statusFor(obligation, today)`, `monthSummary(...)`.
- Subjects: **room checks** = rooms in use with an active placement during the period (occupancy rule Q6); **welfare** = active residents with a placement. Visits: `room_checks` by `room_id` else normalised site+room; `welfare_checks` by `su_id` else port reference.
- Statuses: `pending`, `completed`, `completed_late`, `overdue`, `exempt`, `cancelled`; month overall = Complete when both are completed/completed_late/exempt.
- Historical: same function for past months with `source = 'derived'`; **no records created**; unmatched checks reported as reconciliation items.
- Examples from the brief are test fixtures: Room 401 (08/11 done; 25/11 missed → Check 2 overdue, one overdue room check), Room 402 (both done), Room 403 (neither: Check 1 overdue after the 10th, Check 2 pending until the 25th).

### B2. Pages (read-only first)
Room Checks and Welfare Checks gain a **Due & Missed** tab listing obligations with status, deadline, visit date, completed by, responsible person (resolution order audit §6), site/property/room/SU; "Start check" opens the existing form pre-filled from the obligation (D's picker); saving a check links it to the obligation it satisfies and updates the room's `last_inspected_at`/`next_inspection_due` (fixes B9).

### B3. Back-fill (script, reviewed, idempotent)
Set `room_checks.room_id` and `welfare_checks.su_id` where exactly one match exists; produce a CSV of unmatched rows; no deletes.

### B4. Persisted ledger (after hosting decision)
`obligations` table (shared with the overdue plan): `id`, `dedupe_key` (module|subject|month|period), `module`, `subject_type/id/label`, `site_id`, `property_id`, `room_id`, `su_id`, `period_key`, `deadline_at`, `status`, `assigned_to`, `assignee_source`, `completed_check_id`, `visit_date`, `completed_at`, `completed_by`, `exemption_*`, `follow_up_*`, `action_history`, `source`. Generated by an idempotent SQL function run by `pg_cron` (or an external scheduler calling an RPC) on the 1st and nightly; closes obligations when a linked check is saved (trigger/RPC). Site-scoped RLS, writes only through RPCs. Reuses `check_*` settings; **no separate `check_schedules` table** unless per-site schedules are wanted.

### B5. Responsibility, follow-up and notification
Assignee resolved at generation time and snapshotted; reassign action; overdue register shows responsible person, follow-up owner and action. Reminder and overdue emails use the existing rule/log/template engine with site-scoped recipients (first audit §12) – requires the dispatcher/hosting work.

### Files
New `checkObligations.ts` (+ tests), `RoomChecksView.tsx`, `WelfareChecksView.tsx`, `checksService.ts`, `roomManagementService.ts` (inspection stamp), back-fill script in `scripts/db/`, migrations `035_check_obligations.sql` (B4 only).

### Tests
Month boundaries (28/29/30/31 days, leap year), BST changes, deadline inclusive/exclusive, two same-day visits, late then on-time, vacated mid-month, transferred SU, void room, archived SU, exemption, idempotent regeneration, historical derivation equals recomputation, matching by text vs id, performance on full-estate data.

**Complexity:** High (B1–B3 ≈ 3 weeks; B4–B5 ≈ 3 weeks plus hosting).

---

## Phase C – Operations Dashboard visibility

Built on B1 (works before the ledger exists):
- New section **Required checks – month** with Room/Welfare switch, site filter, and the table from audit §8.4: Site · Property · Room · SU · **Check 1 (by 10th)** · **Check 2 (by 25th)** · Overall · Responsible · Completed by; status tags with visit dates; frequency caption read from settings.
- KPIs (only those computable): required, completed, completed on time, completed late, outstanding, overdue, completion %, exempt; existing maintenance/compliance KPIs unchanged; NTV remains excluded.
- Attention list: "Room check overdue" / "Welfare check overdue" with responsible person; click opens the pre-filled check form.
- Historical month selector with the same table (derived, labelled).
- Reuses `navigateWithIntent`; extends `operationsSelectors` (pure + tests); numbers must equal the rows behind them (existing test pattern).
- Role views: Staff see their own site/rooms; managers see their sites; admins all.

**Files:** `operationsSelectors.ts`, `OperationsDashboardView.tsx` (+ a `RequiredChecksTable` component), tests. **Database:** none until B4. **Complexity:** Medium (≈ 1.5 weeks).

---

## 3. Dependencies

```
E (auth)            independent
A (maintenance)     independent (bucket decision Q1)
D (SU picker)  ──►  B2 (pre-filled start-check)  ──►  C (dashboard)
B1 (calculation) ─►  C
B4/B5 (ledger, reminders) ─► needs hosting + scheduler decision
```

## 4. Migrations summary (none applied)

| # | Content | Phase |
|---|---|---|
| 034 | `maintenance-evidence` bucket; optional `assigned_at`, `started_at` | A |
| 035 | nullable `su_id`/`su_ids` on four transport tables; confirm/create `transport_room_move_requests` | D |
| 036 | optional `profiles.must_change_password` | E |
| 037 | `obligations` ledger, functions, RLS, cron job | B4 |
| script | back-fill `room_id` / `su_id` (idempotent, reviewed) | B3 |

## 5. Rollback

Feature flags off → previous behaviour. Code phases: revert commit. Migrations are additive (rollback SQL included in each file). Storage: bucket left in place. Auth: keep old route one release. Back-fill: only fills nulls and logs each row, so it can be reversed from the log.

## 6. Estimates

| Phase | Effort | Complexity |
|---|---|---|
| E | 1.5–2 wks | Medium |
| A | ~2 wks | Medium–High |
| D | ~3 wks (core 1) | High |
| B1–B3 | ~3 wks | High |
| C | ~1.5 wks | Medium |
| B4–B5 | ~3 wks + hosting | High |
| **Total** | **≈ 13–15 developer-weeks** | |

## 7. Immediate next step on approval

1. Run the **E0 checklist** (needs someone with Supabase/Amplify access) and answer Q1, Q4, Q6, Q9, Q14.
2. Start Phase E, then A.

*Waiting for approval; no implementation has been started.*

---

## Implementation status and decisions applied

Decisions Q1-Q16 were not answered, so the recommended defaults were used. Change them in one place each.

| Area | Default applied |
|---|---|
| Check windows | Check 1: 1st-10th, Check 2: 11th-25th; deadline day inclusive; London dates. Values live in `DEFAULT_CHECK_SETTINGS` (`src/utils/checkObligations.ts`). |
| Who owes a check | Rooms: occupied for at least 3 days in the window (`minOccupiedDays`). Residents: placed for at least 3 days. Void / out-of-use / placeholder rooms owe nothing. |
| Late visits | A visit after a missed deadline completes the earliest missed check, marked "Done late". One visit never satisfies two checks. |
| History | Any month is derived from placements of any status; missed checks stay missed. Nothing is written or invented. |
| Responsible person | Property manager, else site lead officer, else site manager, else "Not assigned". |
| Maintenance closing | An after-work image is required to close a job (`REQUIRE_AFTER_IMAGE_TO_CLOSE`). No assigned/started timestamps exist, so the timer runs from reported to closed. |
| Images | Compressed and embedded in the record (not a storage bucket / signed URLs). |
| Site Challenges | No Service User field (site-level return). |
| Room moves | No room-move form exists in the UI; only the table/adapter references. |
| Exemptions | The `exempt` status exists in the rules but nothing produces it yet (needs a recorded reason; see the ledger draft). |

### Built
- E: single-owner recovery flow, setup-invite emails, session revocation, reset rate limits.
- A: before/after galleries, closing timer, overdue duration, close guard.
- D: shared Service User picker and autofill; Journey Feedback and Funding use it.
- B: obligation rules + "Due & Missed" panel on Room Checks and Welfare Checks.
- C: the same panels on the Operations Dashboard (honours the dashboard site filter and page access).
- Back-fill script `scripts/db/backfill-check-links.ts` (dry run by default).

### Not done / needs a decision
- Migration `034_transport_service_user_links.sql` is written but not applied to any database.
- `db/proposed/check_obligations_ledger.sql` is a draft; the app works without it. A ledger and reminder emails need a scheduler/hosting decision.
- Check obligations are not yet in the dashboard "needs attention" table or KPI strip.
- Supabase dashboard settings for reset emails (site URL, redirect allow-list, SMTP, template, OTP expiry) have not been verified.
- Nothing has been exercised in a browser.
- Room / Welfare / Food still use `SiteServiceUserSelector` (not migrated to the shared picker).

---

## Phase plan: navigation, Service User integrity, tables and forms (awaiting approval)

Audit documents: `SDTRACKER_SU_DATA_INTEGRITY_AUDIT.md`, `SDTRACKER_GLOBAL_FORM_STANDARD.md`, `SDTRACKER_TABLE_AND_NAVIGATION_STANDARD.md`, `SDTRACKER_ROUTE_AUDIT.md`. Nothing below is implemented.

| Step | Work | Risk | Depends on |
|---|---|---|---|
| 1 | Room Checks occupant fix in `checkObligations.ts` (occupants per room, stored occupant on history) + tests | Low | none |
| 2 | SPCD DOB: `suField` mapping in `DynamicRecordFormModal`, remove `1990-01-01` default/fallback, London-date helper | Low-medium (shared modal; ~20 forms inherit) | 1 not required |
| 3 | `TabSwitcher` keyboard/ARIA + `useTabState`; move Room/Welfare onto `TrackerHeader` tabs, filters become chips | Low | none |
| 4 | Serial and Service User column helpers in `TrackerLayout`; apply to Room, Welfare, SPCD first | Low | 1 |
| 5 | Migrate `SiteServiceUserSelector` forms (Room, Welfare, Food Surveys) to `ServiceUserField` | Medium | 2 |
| 6 | `StandardModal`/`ModalFormSection`/`FormField`/`FormValidation`; apply to the Dynamic modal, Room and Welfare forms, then others gradually | Medium | 2 |
| 7 | Server-side per-table validators on write routes | Medium (must not reject legacy data) | 6 |
| 8 | Route table, `?tab`/`?month`/`?record`, guard restored page | Medium | 3 |

Decisions needed: (a) tab names for Room/Welfare, (b) whether shared rooms list every occupant or the primary, (c) whether S.No. is added to every Service User table now or module by module, (d) whether server-side validation may reject (strict) or only warn (log) at first.

### Status after approval (steps implemented)
Defaults used for the open decisions: tab names "Required checks" / "Inspection log" (Welfare: "Welfare log"); shared rooms list every resident; S.No. added module by module (Room Checks, Welfare Checks, SPCD first); server validation not changed yet.

| Step | State |
|---|---|
| 1 Room occupant fix | Done in `checkObligations.ts` (occupants per room as at today / month end, "Vacated", "Vacant", shared rooms, history keeps the occupant of that month); 4 new tests. |
| 2 SPCD DOB | Done: columns declare `suField`; DOB, port reference fill from the profile; the `1990-01-01` default and fallback are removed. Not yet moved off the name-guessing for the other ~20 forms (they keep working as before). |
| 3 Header tabs | Done for Room and Welfare: `TabSwitcher` inside the header card, keyboard arrows/Home/End, remembered per session (`useTabState`). Status chips are now filters only. |
| 4 S.No. / Service User first | Done for Room (matrix and log), Welfare (matrix and log), SPCD. Helpers `serialNo`, `serviceUserFirst` in `TrackerLayout`; 3 tests. Other tables not yet changed. |
| 5 Selector migration | Not started (Room, Welfare, Food Surveys still use `SiteServiceUserSelector`). |
| 6 Shared modal/field components | Not started. |
| 7 Server validation | Not started. |
| 8 Route table | Only per-page tab memory done; no URL changes. |
Not verified in a browser.

### Status: steps 5 and 6 (first pass)
- **5 Selector migration:** Welfare Checks and Food Surveys now use the shared `ServiceUserSection` (picker + autofill + notice). **Room Checks keeps `SiteServiceUserSelector` on purpose**: a room check is about a room, and the old selector can choose a room with no resident; the shared picker is resident-only. Revisit once a room-first variant exists.
- **6 Modal standard:** new `StandardModal` (overlay, header, own scrolling body, sticky footer, Escape, dialog semantics), `ModalFormSection`, `FormField` in `src/components/common/StandardModal.tsx`, and `src/utils/formValidation.ts` (required, date, number, choice, length, http/https URL; 6 tests). Applied to the Welfare Check form shell. The Room Check form, Food Survey form and the ~80 other hand-built modals still use their own shells; `DynamicRecordFormModal` is unchanged.
- Server-side validation (step 7) and the route table (step 8) are still not started. Not verified in a browser.

### Status: steps 7 and 8 (first pass)
- **7 Server validation (warn mode):** `server/writeValidation.ts`, called from the create and update routes in `server/routes/db.ts`. Flags date-like fields that are not real dates, `javascript:`/`vbscript:`/`data:text/html` links, control characters and `<script>` tags. Default is WARN: it logs table, field and rule (never the value) and the write goes ahead. Set `WRITE_VALIDATION=strict` to reject instead (HTTP 400 naming the fields). Not applied to the bulk/sync write routes yet. Per-table enum and number rules are not added: they need the legacy data reviewed first.
- **8 Routes:** `src/config/pageRoutes.ts` is the single page-id/address table (`/room-checks`, `/welfare-checks`, ...; dashboard `/`; `/su-users`, `/service-users`, `/property-management`, `/properties` unchanged; the page called `properties` is now `/site-properties`). Navigating pushes the page's address, Back/Forward and direct links open the page, and `?tab=` is read and written by `useTabState`. `?month=` and `?record=` are not done.
- **Needs checking by whoever owns hosting:** refreshing or opening a direct link such as `/room-checks` works only if the host sends unknown paths to `index.html`. The Express server does; AWS Amplify needs the rewrite rule from the comment at the top of `amplify.yml` set in the Amplify console. `/su-users` already depended on this.
- Not verified in a browser.
