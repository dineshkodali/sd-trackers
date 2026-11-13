# SDTracker — Global Form Standard

Status: **audit and proposal. Nothing implemented.**

## 1. Existing architecture
- `DynamicRecordFormModal` (config-driven; ~20 trackers; already supports `section`, `colSpan`, `images`, multi-SU) — the right base.
- 83 hand-built modals (`fixed inset-0`) in other views, e.g. the Room Check 30-point form, Welfare Check form, SPCD depart/archive, confirmation dialogs. Each has its own header, footer and spacing.
- Validation is per form; there is no shared validator. Sanitisation: the server sanitises specific bodies (`sanitizeFundingBody`, `sanitizeOysterCardBody`, `sanitizeWriteBody` strips protected fields); there is no generic server-side type/enum validation on `/api/db` writes beyond the schema adapter's column typing and database constraints. React escapes output; `dangerouslySetInnerHTML` appears only in the Document Builder and a few config files.

## 2. Issues
- Section headings exist only where a config sets `section`; many forms are one long list.
- Footers differ (button order, wording, position); long forms scroll the whole modal rather than the body.
- Required markers and error text are inconsistent; some forms validate only on submit with an alert.
- Profile fields are locked by name-matching heuristics (see data-integrity audit).
- Dates: `type="date"` in 75 places, `toISOString().slice(0,10)` for "today" in 162 (UTC, not London).

## 3. Proposed standard (reuse first)
Build on `DynamicRecordFormModal`; extract only what is repeated.
- **`StandardModal`**: header (title, subtitle, close), scrolling body, sticky footer (`Cancel` left of primary `Save`, loading state, error summary slot). Hand-built modals migrate by wrapping their bodies, not by rewriting.
- **`ModalFormSection`**: titled group with a 12-column grid; sections numbered by the config order.
- **`FormField`**: label above input, required `*`, hint, error, consistent 36px control height; `colSpan` half/full; long text always full width.
- **`FormValidation`**: schema per form (required, date, number range, enum, max length). Same function used on create and edit, and a server mirror on the write route for the trusted boundary.
- **`DateField`**: plain `YYYY-MM-DD` string in and out, never a `Date` object, `londonToday()` helper replaces `toISOString().slice(0,10)`.
- **`ServiceUserField`** (see section 4) sits first in the "Service User" section.
- `LoadingState` / `ErrorState` reuse `SkeletonRows` and `LiveDataBanner`.

## 4. Global Service User autofill
One path: `ServiceUserField` → `useServiceUserSelection` → `useServiceUserProfiles` (shared cache) → `serviceUserProfile` resolver (pure, unit-tested).
- Column config declares what a field means: `suField: 'name' | 'dob' | 'portRef' | 'room' | 'site' | 'property' | 'nationality' | 'language' | 'phone' | 'address'`. This replaces all key/label heuristics.
- On select: resolve profile once (cached), fill every column that declares a `suField` and is empty or still auto-filled, never overwrite fields the user typed, show "Loading profile…", show an error row if the profile cannot be fetched, keep `suId`/`roomId`/`propertyId` relationship ids.
- Missing profile data leaves the field empty with "Not on the profile". No placeholders (the SPCD `1990-01-01` default is removed).
- Respect permissions: the profile list is already site-scoped by RLS/server; the picker lists only what the user may see.
- Migrate in this order: SPCD (DOB), Room/Welfare, Referrals, Vulnerable/Challenging, Maintenance, Public Transport, remaining Dynamic forms (they inherit it through the shared `suField` support with no per-page code).

## 5. Layout rules
Two columns on desktop, one on mobile; related short fields half width (room + site, dates); descriptions/notes/attachments full width; sections: Service User → Case/Operational details → Notes & supporting information → Review (validation summary) → footer. Dropdowns portal to `body` so they are never clipped by the scroll area. No horizontal scrolling inside the modal.

## 6. Validation and sanitisation
- Frontend: required, type, range and enum checks via `FormValidation`; errors beside the field and a summary at the footer.
- Do **not** strip punctuation, apostrophes or normal text. Trim whitespace; reject control characters; limit lengths.
- Server (trusted boundary): extend `sanitizeWriteBody` with a per-table validator for dates (`YYYY-MM-DD`), numbers, enums and URLs (http/https only); keep parameterised Supabase client calls (no dynamic SQL exists in the write path); keep RLS and `userMayAccessTable` checks unchanged; validate upload type/size on the attachment routes; never log record bodies.
- Output: React escaping stays the default; audit the few `dangerouslySetInnerHTML` uses in the Document Builder and sanitise or remove them.

## 7. Test plan
Unit: resolver, `FormValidation`, `serial()`, `orderColumns()`, date helpers (London dates, DST). Component: field/section layout snapshots, autofill (select, change, clear, missing, failure, edit, manual edit). Browser pass (desktop + 375px): SPCD, Room Check, Welfare Check, Referral, Funding. Regression: existing `npm run test:unit` baseline (5 known failures) must not grow.
