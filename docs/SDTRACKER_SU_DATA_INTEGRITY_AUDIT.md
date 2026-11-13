# SDTracker — Service User Data Integrity Audit

Status: **audit only. No production code was changed for this document.** Findings come from reading the code; nothing was run against the live database or in a browser.

## 1. Room Checks shows "Vacant / Unoccupied" for occupied rooms

**Symptom.** In Room Checks the Service User column does not show the current occupant of an occupied room.

**Data flow traced.**
1. `placements` (active, with `roomId`, `suId`, dates) → 2. `buildSubjects()` in `src/utils/checkObligations.ts` builds one subject per room → 3. `toRows()` copies the subject into a `CheckRow` → 4. `RoomChecksView` renders `row.suName || 'Vacant / Unoccupied'`.

**Root cause (confirmed in code).** `buildSubjects()` creates room subjects with `suId: ''`, `suName: ''`, `suReference: ''` (`checkObligations.ts:271`). Occupancy is used only to decide *whether a check is owed*; the occupant's identity is thrown away. Every room row therefore has an empty name, and the view's fallback prints "Vacant / Unoccupied" for **all** rooms, occupied or not. This is a defect in the rules module I wrote earlier, not stale data and not a join problem. The same row also carries no occupant for shared rooms.

**Not the cause (checked).** Placement data, `service_users` names and the `room_checks.su_id/room_id` columns are fine; the welfare path (`bySu`) resolves names correctly.

**Fix (proposed, root-cause level).**
- Extend `CheckSubject` for rooms with `occupants: Array<{ suId, name, reference, start, end }>` taken from the placements already loaded.
- "Current occupant" = placements whose range contains the as-of date (today for the current month; the last day of the month for a past month, shown as "Occupant at month end"). Shared rooms list every occupant.
- A recorded check keeps the occupant **at the time**: `room_checks.su_id` is written when the check is saved, and history rows show that stored person, never today's occupant. A past check is never re-attached to someone who moved in later.
- A room is labelled "Vacant" only when it has **no** placement overlapping the as-of date. A room that owes a check but is empty today (vacated mid-month) shows "Vacated {date}" with the last occupant.
- No frontend workaround: the data needed is already loaded in `useCheckObligations`.
- Tests added to `tests/checkObligations.test.ts`: occupied, vacant, shared, vacated mid-month, moved-in-after-check, historical month.

## 2. SPCD "Add Case Entry" — DOB never fills

**Symptom.** Choosing a Service User does not populate DOB.

**Root causes (confirmed).**
1. **Alias mismatch.** `DynamicRecordFormModal` fills DOB only for columns whose key is in `['dob','dateofbirth']` (≈line 1119). The SPCD column key is `suDob` → lower-cased `sudob`, so it is never filled. The same happens to `suPortReference` (not in the port-reference alias list).
2. **Locked but never filled.** `isSuProfileColumn()` *does* include `sudob`, so when a single SU picker is present the DOB field is treated as "profile-derived": locked/read-only and excluded from required checks, yet nothing fills it. The user cannot type it either.
3. **Fabricated value.** SPCD supplies `suDob: '1990-01-01'` as the initial value and again as a save fallback (`SPCDTrackerView.tsx:733, 750`). A case can be saved with an invented date of birth. This is a data-integrity defect in its own right.
4. **SU is not actually selected in SPCD.** The SPCD config declares `suName` and `suPortReference` as `type: 'text'`; the picker only appears via name heuristics in `isServiceUserColumn`. Behaviour depends on label strings, not on a declared field type.

**Date format.** The profile DOB is `service_users.date_of_birth` (date). `serviceUserProfile.ts` already normalises it to `YYYY-MM-DD` with `slice(0,10)` (no timezone conversion), so the format is not the problem. Elsewhere the UI builds "today" with `new Date().toISOString().slice(0,10)` in **162 places**, which is the UTC date and can differ from the London date after 23:00 in summer. DOB must never pass through `Date`; keep it a plain `YYYY-MM-DD` string.

**Fix (proposed).** Replace alias lists with a declared field mapping on the column: `suField: 'dob' | 'portRef' | 'room' | 'site' | 'nationality' | 'language' | …` (see form standard). SPCD columns get `suField` on `suName`, `suPortReference`, `suDob`, `roomNumber`. Remove the `1990-01-01` default and fallback; DOB is empty when the profile has none, with a visible "not on the profile" hint. Edit mode keeps the stored value unless the user changes the SU.

## 3. Three generations of Service User selector

| Selector | Used by | Autofill |
|---|---|---|
| `PropertyRelativeSUSelector` (inside `DynamicRecordFormModal`) | ~22 forms: SPCD, Referrals, Vulnerable, Challenging, Compliance, Maintenance, IR, GP, Laundry, Registers, Dispersal, Public Transport, VCS, Documents, Escalations, QuickIncident… | name-heuristic aliases (the SPCD bug) |
| `SiteServiceUserSelector` | Room Checks, Welfare Checks, Food Surveys | own callback, own fields |
| `ServiceUserPicker` + `useServiceUserSelection` (new) | Journey Feedback, Funding Requests | profile-based, never overwrites typed fields |

Each has its own data loading and its own autofill rules. Two hold their own synthetic-SU logic. The shared building blocks that already exist and should be the single path: `src/utils/serviceUserProfile.ts` (pure resolver), `src/hooks/useServiceUserProfiles.ts` (one 30-second shared cache) and `useServiceUserSelection.ts`.

## 4. Other integrity risks found
- Synthetic SUs (`synth-…`) are created from register/vulnerable records when no master record exists; they must never store an `suId` (already guarded in `DynamicRecordFormModal`; not guarded in the Room/Welfare selector).
- `welfare_checks` stores `service_user_id`; the form writes `suId`. The rules module accepts both, but the column pair should be unified by a back-fill (script exists: `scripts/db/backfill-check-links.ts`).
- Several Dynamic forms lock profile fields, so a wrong profile value cannot be corrected on the form; correction must be possible via the SU profile.

## 5. Testing plan
Autofill: select → name/DOB/room/site/reference fill; change SU → all update; clear SU → derived fields clear; SU without DOB → empty with hint; profile fetch failure → error banner, typed values kept; edit mode → stored values preserved; manually edited field not overwritten. Room Checks: occupied / vacant / shared / vacated / historical. Unit tests on the resolver and rules; a browser pass on one form per selector family before any rollout.
