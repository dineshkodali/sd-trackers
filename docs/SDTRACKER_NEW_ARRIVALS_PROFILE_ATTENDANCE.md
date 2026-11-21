# New Arrivals intake details, Service User profile sync, and the profile Attendance calendar

Prepared 21 November 2026. **Not verified:** nothing here was run against the live database or in a browser (it needs a signed-in session). Verified: `tsc`, `vite build`, and unit tests of the pure logic (NHS number, profile sync plan, calendar). Migration 040 has not been applied. The save workflow (create/update in Supabase, RLS, two-user realtime) is untested end to end.

## 1. Audit findings

### New Arrivals
* Page `LiveDailyRegistersView` → tab `NewArrivalsSection`; the form is the generic `DynamicRecordFormModal` driven by `NEW_ARRIVALS_TABLE_COLUMNS` (`defaultTableSchemas.ts`). Saved layouts are merged with the defaults, so new default columns appear even where an administrator customised the table.
* Create flow (`handleCreateSubmit`): writes `new_arrivals_records` (columns plus a `data` JSON), optionally checks the person into the Daily Register (`daily_register_records`), then `syncArrivalToServiceUser` finds or creates the Service User (matched by Port reference, else name + date of birth) and places them in the room. Re-running never duplicates a person.
* Before: no GP, pharmacy, NHS, dietary, comments or booking field on the form; the register entry was always created with Available to Book = "No".

### Where each requested field already lives (no new column needed)
| New Arrivals field | Destination used | Table / column | Where the profile shows it |
|---|---|---|---|
| SU Comments (safeguarding) | Support row "Safeguarding" (`notes = su-form:vulnerability`) **and** the Daily Register entry's existing `su_comments` | `service_user_support`, `daily_register_records.su_comments` | Support tab |
| Dietary Requirements | Support row "Dietary Requirements & Allergies" (`su-form:dietary`), one requirement per line | `service_user_support` | Support tab (same list the Service User form edits) |
| Available to Book | Daily Register entry's existing field | `daily_register_records.available_to_book` (Yes/No) | New "GP, pharmacy and booking" card |
| GP Registered | Derived: a GP is recorded on the profile or a registration exists | – | same card |
| GP | `service_users.gp_registration` and `gp_registrations.gp_practice` | `service_users`, `gp_registrations` | Overview (GP Registration), GP tab card |
| Registered Pharmacy | `gp_registrations.pharmacy` | `gp_registrations` | GP tab card |
| NHS Number | `gp_registrations.nhs_number` | `gp_registrations` | GP tab card, **masked** (••• ••• 1234) with Show/Hide |

### Attendance
* Already exists and is already per Service User: `su_attendance_records` (migration 020): `su_id → service_users(id)`, `attendance_date`, `attendance_status` (**Present / Absent** only), `additional_notes`, `recorded_by`, `updated_by`, timestamps; **UNIQUE (su_id, attendance_date)** so there is exactly one record per person per day; indexes on date and (su_id, date). Marked on the Attendance page (`SUAttendanceTrackerView`) through `suTrackerService.saveAttendance`; no record means "Not recorded", never absent.
* Row Level Security exists (migrations 025, 026: signed-in only, plus a restrictive per-page policy tied to the `suAttendance` page access).
* The profile tab switcher is `ServiceUserProfileView` (`tabs` array).
* Not published to Realtime before this change (this is the only database gap).

## 2. Database changes
`db/migrations/040_su_profile_attendance_realtime.sql` – adds `su_attendance_records` and `gp_registrations` to the `supabase_realtime` publication with `REPLICA IDENTITY FULL`. **No table, column, constraint, index or RLS policy was added or changed.** Idempotent. Rollback statements are in the file header.
**Apply:** Supabase → SQL Editor → paste the file → Run; or `npm run db:migrate`. Without it the calendar still works, but another user's change appears only after reopening the tab.

## 3. New Arrivals form (new section "Health, Safeguarding & Booking")
SU Comments, Dietary Requirements (one per line), Available to Book (Yes/No, default No), GP Registered (Yes/No), GP (practice list from Field Options `gpPractices`, quick-add allowed), Registered Pharmacy, NHS Number. All optional; none appear in the arrivals table or the arrival view/export.
* **NHS number:** 10 digits with the modulus-11 check digit, spaces/hyphens accepted, stored formatted `123 456 7890`, shown masked. (The existing GP Registrations form only checks "10 digits"; the arrival form is stricter because it is new data. Existing numbers are not re-validated.)
* **Not stored on the arrival record.** The arrival is a transaction; sensitive details are saved to the profile only (plus the register's existing comment/booking fields), so they are not copied into a second place. Editing an arrival therefore does not show these fields.
* If GP Registered = No, GP and pharmacy are ignored.

## 4. Profile synchronisation rules (`utils/arrivalProfileSync.ts`, `services/arrivalProfileService.ts`)
1. Uses the Service User id returned by the existing arrival sync (found or created); no second profile can be made.
2. **Blank never changes anything.**
3. **Single values** (GP, pharmacy, NHS number) fill a blank only; a different existing value is kept and reported (NHS numbers are never printed in the message).
4. **Lists/notes** (dietary, safeguarding) are merged: existing lines stay, new lines are added, repeats (ignoring case/spacing) are not added twice.
5. Support rows are written through the Service User form's own save routine, passing every other field back unchanged.
6. Duplicate submission: a save lock in the create handler; the form's own submit state also disables the button.
7. After saving, one message states what was saved to the profile, what was kept, or that the profile step failed (the arrival itself is already saved, and the message says to add the details from the profile).
Limitation: the arrival and the profile writes are separate API calls, not one database transaction. A failure after the arrival is saved leaves the arrival in place and reports the failure; nothing is rolled back. A server-side transaction would need a new database function and is not done.

## 5. Attendance tab (`SUAttendanceTab`)
New "Attendance" tab beside the other profile tabs (shown only to users who can open the Attendance page). Monday-first monthly calendar with previous/next month, "This month", today underlined, Present green (P), Absent red (A), No record grey, selected date outlined. Summary: recorded days, present, absent, attendance % = present ÷ recorded (blank when nothing is recorded); unrecorded and future days are never counted. Clicking a day shows date, status, marked by, marked time, last change, notes. Read-only: a link opens the Attendance page to mark or edit.
* Records are read by the profile's Service User id only (`listAttendance({ suId })`) and filtered again in the calendar logic, so another person's records can never appear.
* If duplicates ever existed for a day (the unique constraint prevents it), the most recently updated record is used.
* **Live:** the tab uses the shared Realtime connection (`operationsRealtime`, reference-counted); only an event for this person's attendance triggers a re-read of this person's records (debounced), and a resync after a reconnect. No polling. Same for the GP card.

## 6. Security
Existing auth, RLS and page-access rules are unchanged. NHS number and pharmacy are shown only to users with access to the GP Appointments/Registrations page, and the NHS number is masked by default. Safeguarding text goes to the same Support section the profile already protects. No service-role key is used in the browser.

## 7. Tests (`tests/arrivalProfileAndAttendance.test.ts`, 13)
NHS check digit/format/mask; blank values change nothing; new person fully filled; existing person merged without overwriting; conflicting NHS number reported without exposing it; merge de-duplication; Monday-first grid, today/future flags; present/absent/no-record totals; other users' and out-of-month records excluded; future and unknown-status records ignored; duplicate-day rule; change/removal reflected; month navigation across years.
**Not tested:** the actual save against Supabase, RLS per role, duplicate-click behaviour in a browser, two-user realtime, offline/online reconnect, existing-profile merge with real data. Please run through the "New Arrivals" and "Attendance" checklists with a test arrival before relying on it.

## 8. Update: disability fields, form order, GP/pharmacy check, input sanitising

* **Disability** (new section 4): Disability Category (Field Options `disabilityCategories`, default None) and Disability Type (`disabilityTypes`, required when a category is chosen, cleared and not allowed when the category is None). Saved to the existing `service_users.disability_category` / `disability_type`: written straight onto a **new** profile, and on an **existing** profile only filling a blank or "None" (a recorded category/type is kept and reported). Shown on the profile's Personal tab as before. No migration.
* **Form order:** 1 Identity, 2 Contact, 3 Arrival & Allocation, 4 Disability, 5 GP & Healthcare, 6 Safeguarding, Diet & Booking. The arrivals table column order follows the same sequence (Email now sits beside Contact Number; Aspen Card after Room).
* **GP vs pharmacy:** checked. They are separate things stored separately (`gp_registrations.gp_practice` / `service_users.gp_registration` vs `gp_registrations.pharmacy`) and the GP Registrations page gives them separate option lists (`gpPractices`, `gpPharmacies`). The earlier arrival form wrongly made pharmacy free text; it is now a select on its own `gpPharmacies` list (with + Add), exactly like the GP Registrations page. Rules: GP Registered = Yes needs a GP; a GP with GP Registered = No (or unset) is rejected; choosing "No" clears the GP; a pharmacy that is the same entry as the GP is rejected; a pharmacy does not need a GP. The `gpPharmacies` list has no seeded values, so it starts empty until options are added.
* **Sanitising and validation** (`utils/arrivalFormRules.ts`, used for the inline field messages **and** again on save, for create and edit): control and zero-width characters removed, spaces collapsed, `<`/`>` rejected in structured fields and stripped from notes, lengths capped, port reference upper-cased (letters, numbers, `/ - .` and spaces, 3–30), name letters/spaces/`'`/`-`/`.` only (non-English letters allowed), date of birth real, not future, within 120 years, phone 7–15 digits, email format and lower-cased, check-in date real, after 2000 and at most 14 days ahead, aspen card, room, country/language text-only, NHS number check digit, notes ≤ 2,000 characters, dietary ≤ 20 lines of ≤ 300, Yes/No fields only accept Yes/No. If anything fails on save, nothing is saved and every problem is listed.
* Legacy records: opening Edit on an old arrival runs the same checks on its existing values, so an old record with, for example, a symbol in the port reference must be corrected before the edit can be saved.
* Tests: `tests/arrivalFormRules.test.ts` (12). Not tested in a browser.

## 9. Update: Attendance marking behaves like Meal Marking

**What Meal Marking does (reference, not changed):** the tap changes one record in React state at once; the save runs in the background; one in-flight save per slot with the latest choice queued (so fast taps cannot create duplicates); on failure the slot returns to what it was and an error is shown; a deterministic record id per slot; the known existing record is passed to the save so no lookup is needed; no reload.

**What Attendance did:** every click saved (after a lookup read) and then called `load()`, which put the whole table into its loading state and re-read all residents, all attendance (up to 20,000 rows) and all follow-ups, then recomputed follow-ups for everyone.

**Now (`SUAttendanceTrackerView`, `utils/attendanceMerge.ts`, `suTrackerService.saveAttendance`):**
* Tap Present/Absent → that one row changes immediately and shows the selected state; a small "Saving…" then "Saved" appears beside the buttons; the summary counts, filters, search, site, date, tab and page position are untouched (they all derive from the same in-memory records).
* One save per resident per day at a time; extra taps are queued (latest wins); tapping the status already shown does nothing.
* The record id for a new day is fixed (`att-<su>-<date>`) and the table already has UNIQUE (su_id, attendance_date), so two browsers cannot create two rows: the second insert collides and is converted into an update of the first. The known existing row is passed in, so no lookup read on normal taps.
* On failure the row returns to the last value the database confirmed, shows "Not saved – Retry", and "Saved" is never shown without database confirmation. The error text is in the tooltip.
* Undo / Clear and the Records-tab Delete and the Record-Attendance dialog use the same path (no full reload).
* Follow-ups: only the marked resident's absence follow-ups are re-evaluated (same idempotent rule), instead of everyone's.
* **Live:** the page joins the shared Realtime connection. Another user's insert/update/delete is merged into just that row; a row being saved here is never overwritten; an older or repeated event never replaces a newer row; events for residents the user may not see are ignored. After a reconnect (not after each click) attendance is re-read once and merged, keeping days currently being saved.
* **SU profile calendar:** updates from the live event, and also immediately in the same browser through an in-page notification, so it follows even before the migration is applied.
* **Operations Dashboard:** attendance itself is not a dashboard metric; absence follow-ups are, and they re-read on their own live events (migration 039).
* Not changed: attendance statuses (still Present/Absent, from the existing check constraint), business rules, permissions (`canEditSuTrackers` for marking, `canDeleteRecord` for the Records-tab delete), tables.
* Tests: `tests/attendanceMerge.test.ts` (10: identity and fixed id, row mapping, upsert/remove, live merge, echo ignored, stale ignored, in-flight protected, delete, scope, reconnect reconcile). **Not tested:** the save against Supabase, network failure in a browser, two-browser races, mobile layout, absence of a page reload (the code contains no reload or full-table loading state after a mark).
* Absence follow-up rows and the other Attendance tabs are not live-merged; they update on the user's own actions and on a manual refresh.
