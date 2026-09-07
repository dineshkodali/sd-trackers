# SafeHaven Operations — Comprehensive E2E Test Plan

**Target:** `http://localhost:3000` (dev; API and SPA share one origin)
**Discovered:** 2026-09-06 by live browser exploration of the running application
**Status:** Plan only — no tests written yet

---

## 1. What this application actually is

This is **not** a sales CRM. Exploration found no Customers, Leads, Contacts, Companies, Deals, Tasks, Activities, Notes, or Teams modules. Do not write tests against those concepts.

It is a **UK safeguarding and accommodation-compliance platform** for managing vulnerable people placed in contracted hotel accommodation. The "customer" analogue is a **Service User (SU)**; the "account" analogue is a **Property/Site**. Records are safeguarding referrals, vulnerability assessments, behavioural incidents, maintenance defects, and escalations.

Domain vocabulary a tester must know:

| Term | Meaning |
|---|---|
| SU | Service User — the vulnerable person being accommodated |
| Port / NASS Ref | Home Office asylum support reference |
| Mosaic ID | Local-authority social-care case system ID |
| SG | Safeguarding |
| SPCD | Safeguarding, Prevent, Complaints & Domestic-abuse case log |
| LA | Local Authority |
| WL | Warning Letter |
| CAT 1–4 | Maintenance priority bands (4h / 24h / 7d / 28d) |

---

## 2. Environment & access

| Item | Value |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend | `http://localhost:3000/api` (same origin) |
| Start | `PORT=3000 OPEN_BROWSER=false npm run dev` |
| Database | PostgreSQL on Supabase Cloud — **shared, no test instance** |
| Browser | Chromium only; launch with `channel: 'chromium'` (headless shell not installed) |

**Test account.** `stackmaster@sdcommercial.co.uk` / `Focusmode123!` — a hardcoded Super Admin that bypasses Supabase entirely and works with the database offline. Ideal for automation; see DEF-02 for why it is also a security finding.

---

## 3. Blockers to resolve before automating

These are not test cases. They are prerequisites, ordered by how much they will cost if ignored.

| ID | Blocker | Impact | Fix |
|---|---|---|---|
| BLK-01 | **Zero `data-testid` in 37k lines**; only 8 `aria-label`s | Every selector must key off visible text or Tailwind classes. Brittle and slow. | Add testids to rows, action buttons, modals, filter controls |
| BLK-02 | **Runaway background sync** — one full 14-endpoint cycle every **2.4s** (measured 585 req/100s, 18.8× the intended 45s) | `waitForLoadState('networkidle')` **can never resolve**. Every test using it will hang. | Fix the effect dependency cycle; until then ban `networkidle` in all specs |
| BLK-03 | **Port drift** — `strictPort:false` + auto-increment | `baseURL` is not deterministic | Pin `PORT=3000`; assert on it in global setup |
| BLK-04 | **No URL routing** — `activePage` is `useState`, never in the URL | No deep-linking. Every test starts at `/` and clicks the sidebar. No back/forward. | Page-object with `goto(module)` that logs in then clicks nav |
| BLK-05 | **`npm run lint` is a false green** — `@types/react` not installed, so all React code is `any` | Type errors invisible; e.g. batch retention filters maintenance on `m.reportedDate`/`m.status`, neither of which exists | `npm i -D @types/react @types/react-dom` |
| BLK-06 | **No `playwright.config.ts`** | No baseURL, webServer, reporters, retries, or traces | Author config (§9) |
| BLK-07 | **Shared cloud DB, no seeding** | Tests mutate real safeguarding data | `QA-TEST-` prefix + guaranteed teardown (§8) |

---

## 4. Confirmed defects — write regression tests that pin these

Each was reproduced against the running app during discovery.

| ID | Sev | Defect | Evidence |
|---|---|---|---|
| DEF-01 | **Critical** | **All `/api/db/*` routes are unauthenticated.** GET/POST/PUT/DELETE on every entity, served with the service-role key, bypassing RLS. | `GET /api/db/vulnerable`, `/challenging`, `/referrals`, `/profiles`, `/passwordAudit`, `/documents` → **HTTP 200 with no credentials** |
| DEF-02 | **Critical** | **Forgeable auth token.** Master login mints an unsigned `sm-jwt-<base64url>` token; `/api/auth/me` grants Super Admin on the **string prefix alone**, no signature check. | `server/routes/auth.ts:31`, `:238` |
| DEF-03 | **High** | **`POST /api/auth/update-password` returns 404 — route unreachable.** It is nested *inside the catch block* of the `/me` handler, so it only registers if token verification throws. Password reset from a recovery link is dead. | Live probe → `HTTP 404`; `server/routes/auth.ts:238` |
| DEF-04 | **High** | **Urgency Priority dropdown has exactly one option ("Medium").** `getFieldOptions('riskLevels')` queries a category that does not exist (real name `incidentRiskFactors`), returning `[]`. Urgency drives the automated High/Critical email alert, so that alert can never fire from the UI. | Referrals create form; `ReferralsView.tsx:84` |
| DEF-05 | **High** | **Runaway sync loop** — see BLK-02. Unauthenticated, on the login screen, ~505k requests/day per idle tab. | 585 req/100s measured |
| DEF-06 | Medium | **No duplicate restriction.** Two referrals with identical SU name, Port ref and Mosaic ID were created back-to-back with no warning. | Both persisted; verified via API |
| DEF-07 | Medium | **Dropdown defaults absent from their own option lists.** Referrals *Method of Referral* defaults to `Mosaic Portal` (options say "Mosaic Social Care Portal"); Escalations *Status* defaults to `Active` (not in list); Vulnerable *Status* defaults to `Open` (appended as fallback). | Form capture |
| DEF-08 | Medium | **Status vocabularies disagree across layers.** Referrals filter offers `Pending`, but the create form cannot set it. Option sets don't match the TypeScript unions in `types/index.ts`. | Filter vs form capture |
| DEF-09 | Medium | **Zod schemas are dead code.** `validationSchemas.ts` requires `mosaicId`, `portRef`, `dob` for referrals; the form marks none of them required. No view calls the validators. Validation is HTML5 `required` only — empty submit produced 3 native `:invalid` fields and **zero custom error text**. | Empty-submit probe |
| DEF-10 | Medium | **Deletes never propagate from DB to UI.** Sync assigns only `if (data.length > 0)`, so an emptied table leaves stale localStorage rows on screen indefinitely. | `AppContext.tsx` sync guards |
| DEF-11 | Low | **Round-trip field loss.** `srNo`, `attachments`, `lastUpdatedBy` are dropped by the schema adapter; `acknowledgementReceived` goes out as `'Yes'/'No'/'Pending'` and returns as a **boolean**. Extra fields are packed into a JSON blob in the `notes` column, so they are not queryable. | `schemaAdapter.ts:514` |

---

## 5. Module inventory

21 sidebar targets. Badge counts are live. "Empty" tables render a single placeholder row — assert on the placeholder text, **not** `rowCount === 0`.

| # | Module | Entity → table | Create control | Fields (required) |
|---|---|---|---|---|
| 1 | Dashboard | — | Quick Incident Log | — |
| 2 | SG Referrals | `referrals` | `+ New Record` | 15 (4) |
| 3 | SG Referrals — Archive | `referrals` | — | tab + sidebar |
| 4 | Vulnerable SUs | `vulnerable_residents` | `+ Log Vulnerable SU` | 16 (5) |
| 5 | Vulnerable SUs — Archive | " | — | tab + sidebar |
| 6 | Challenging SUs | `challenging_behavior` | `+ Log Incident` | 16 (4) |
| 7 | Challenging SUs — Archive | " | — | tab + sidebar |
| 8 | Maintenance Tracker | `maintenance_records` | `Log Maintenance Defect` | 12 (6) |
| 9 | SPCD Tracker | `spcd_records` | `Add SPCD Case Entry` | 11 (7) |
| 10 | Laundry Support | `laundry_logs` | `+ Log Laundry Batch` | 10 (6) |
| 11 | Hot Meals Tracker | `hot_food_logs` | `+ Add Vendor Buffet Log` | **62** (5) |
| 12 | Escalations Log | `escalations` | `Log Urgent Escalation` | 12 (7) |
| 13 | Proof Documents | `documents` | `+ Upload Document` | 7 (1) |
| 14 | Reports & SharePoint | — | — | export hub |
| 15 | Audit Security Trail | `audit_trails` | read-only | 12 cols |
| 16 | Requests & Approvals | `data_change_requests` | **no create button** | review-only |
| 17 | Properties Directory | `sites` | `Add Property` | 7 (2) |
| 18 | Staff & User Accounts | `profiles` + Supabase Auth | `Add User` | 5 (3) |
| 19 | Roles & RBAC Matrix | localStorage | — | 10 permission flags × 7 roles |
| 20 | Field Options & Setup | localStorage | — | 18 categories |
| 21 | System Preferences | localStorage | — | settings + batch retention |

**Standard row actions** (SG Referrals, representative): `View Record Details`, `Edit Record`, `Archive Referral`, `Delete Record` — icon-only buttons distinguished **only by `title`**. Plus an **inline `<select>` in the status column** that mutates the record directly from the table.

**Standard table furniture:** site filter, month filter, status filter, free-text search, `Export` (CSV/PDF via modal), `Reset`, sortable `<th>`s, and a pager (`10 (Fastest)` / 25 / 50 / 100).

---

## 6. Field, date and status rules discovered

- **Site dropdowns** carry all 16 properties and default to `Brit Hotel`. Under `strictSiteIsolation`, non-privileged roles see a **locked** site filter.
- **Laundry & Hot Meals** both enforce a period rule labelled **"Date To (Max 7 Days)"** with a `Weekly Log (Max 7 Days)` / `Monthly Log` selector. Zod also has `endDate >= startDate`. **Test both boundaries: exactly 7 days, and 8 days.**
- **Maintenance** has a 53-option standards dropdown ("View All 71 Standards") plus CAT 1–4 bands mapped to fixed timescales (4h / 24h / 7d / 28d). Test that selecting a CAT auto-populates the timescale and Close Due Date.
- **"Raised By" / "Logged By"** is **locked to the logged-in user** on Referrals, SPCD, Escalations, Maintenance. Assert it is read-only and correctly populated.
- **Quick-insert chips**: Vulnerable SUs and Challenging SUs modals offer one-click category buttons (e.g. `+ Mental Health & PTSD`, `+ Physical Altercation / Violence`) that append into the description field.
- **Archive is a status transition**, not a separate store — `status: 'Archived'` moves a record between the Active and Archive views of the same module.

---

## 7. Test suites

Priority: **P0** blocks release · **P1** core journey · **P2** breadth · **P3** edge.

### TS-01 Authentication & Session
| ID | P | Scenario |
|---|---|---|
| 01.1 | P0 | Unauthenticated root shows login form; no sidebar rendered |
| 01.2 | P0 | Invalid credentials → stays on login, shows *"Invalid email address or password"* |
| 01.3 | P0 | Valid login → sidebar appears, `sg_tracker_token` + `sg_tracker_auth_user` written |
| 01.4 | P0 | Logout clears token and all auth keys, returns to login |
| 01.5 | P1 | Deep link `/dashboard` while logged out still shows login (no bypass) |
| 01.6 | P1 | Reload with valid token restores session without re-login |
| 01.7 | P1 | Tampered/garbage token → blocked view, not a silent Super Admin grant |
| 01.8 | P2 | Inactivity auto-logout (default 15 min) raises the session-lock modal |
| 01.9 | P2 | Password reset request shows confirmation for a valid email |
| 01.10 | **P0** | **DEF-03 regression:** `POST /api/auth/update-password` must not 404 |
| 01.11 | **P0** | **DEF-02 regression:** a hand-forged `sm-jwt-` token must be rejected by `/api/auth/me` |

### TS-02 Authorization, RBAC & Site Isolation
| ID | P | Scenario |
|---|---|---|
| 02.1 | P0 | Each of the 7 roles sees only its permitted sidebar entries |
| 02.2 | P0 | `canDeleteRecords: false` hides/disables every Delete action |
| 02.3 | P0 | Non-privileged role has the site filter **locked** to its assigned site |
| 02.4 | P1 | Roles & RBAC Matrix toggles take effect immediately in the UI |
| 02.5 | P1 | Admin-only modules (Users, Roles, Settings, Properties) hidden from Staff |
| 02.6 | **P0** | **DEF-01 regression:** unauthenticated `/api/db/:entity` must not return 200 |
| 02.7 | **P1** | Editing `sg_tracker_role_permissions` in localStorage must not grant real privilege |

### TS-03 Navigation & Shell
| ID | P | Scenario |
|---|---|---|
| 03.1 | P0 | All 21 sidebar targets render their view without page errors |
| 03.2 | P1 | Sidebar badge counts match the underlying record counts |
| 03.3 | P1 | `Ctrl/Cmd+K` opens Quick Jump; selecting a result navigates |
| 03.4 | P2 | Header property selector scopes the dashboard |
| 03.5 | P2 | Network status indicator reflects offline state |

### TS-04 Dashboard, Widgets & Charts
| ID | P | Scenario |
|---|---|---|
| 04.1 | P1 | All widgets render: incident breakdown, referral trends, property load, vulnerability risk, welfare standards |
| 04.2 | P1 | Quick Incident Log modal opens, validates, and creates an escalation |
| 04.3 | P1 | Customize Widgets toggles persist across reload |
| 04.4 | P2 | Chart mode switches (Stacked/Grouped, Pipeline/Trend Lines) re-render |
| 04.5 | P2 | Per-widget site filters scope their data |
| 04.6 | P2 | `Copy for Excel` and `Export CSV` produce correct content |
| 04.7 | P3 | Stat tiles equal the sum of underlying records |

### TS-05 → TS-16 Per-module CRUD
Apply this matrix to every module in §5 that has a create control:

| ID | P | Scenario |
|---|---|---|
| x.1 | P0 | Create with all required fields → confirmation dialog → record appears in table |
| x.2 | P0 | Empty submit blocked; record count unchanged; **no write request issued** |
| x.3 | P0 | Delete → strict confirmation naming the record → row removed and gone from API |
| x.4 | P1 | View dossier modal shows the saved values |
| x.5 | P1 | Edit → change a field → save → table reflects it and value survives reload |
| x.6 | P1 | Archive → leaves Active view, appears in Archive view with `status: Archived` |
| x.7 | P1 | Restore from Archive returns it to Active |
| x.8 | P1 | Inline status `<select>` in the row persists its change |
| x.9 | P2 | Created record is attributed to the logged-in user in `lastUpdatedBy`/`Raised By` |
| x.10 | P2 | Cancel discards without writing |

Module-specific additions:
- **Referrals (TS-05):** DEF-04 — Urgency dropdown must offer Low/Medium/High/Critical. High/Critical must dispatch the SMTP alert.
- **Vulnerable (TS-06) / Challenging (TS-07):** quick-insert chips append to the description.
- **Maintenance (TS-08):** CAT selection drives timescale and Close Due Date; 71-standards picker populates the criteria code.
- **Laundry (TS-10) / Hot Meals (TS-11):** 7-day boundary (accept 7, reject 8); `endDate >= startDate`; Hot Meals 62-field weekly matrix totals correctly across 4 vendors.
- **Escalations (TS-12):** Critical escalation dispatches `/api/smtp/escalation-alert`.
- **Documents (TS-13):** file upload, size/format handling, confidentiality levels.
- **Users (TS-18):** creating a user provisions Supabase Auth **and** a profile; role and multi-site assignment persist.
- **Properties (TS-17):** deleting a site referenced by records — define and assert the expected behaviour.

### TS-17 Table Mechanics
| ID | P | Scenario |
|---|---|---|
| 17.1 | P0 | Search filters rows; clearing restores (needs ≥3 seeded records) |
| 17.2 | P0 | Search matches across name, Port/NASS ref, Mosaic ID, council, notes |
| 17.3 | P0 | Column sort ascends, then descends on second click |
| 17.4 | P1 | Site / month / status filters each narrow correctly, and compose |
| 17.5 | P1 | `Reset` clears all filters and search together |
| 17.6 | P1 | Page size 10/25/50/100 changes rows shown; "Showing X–Y of Z" is accurate |
| 17.7 | P1 | First/Prev/Next/Last disable correctly at boundaries |
| 17.8 | P2 | Filtering resets to page 1 (guard against being stranded on an empty page) |
| 17.9 | P2 | Empty state shows *"No … records found matching current criteria."* |

### TS-18 Batch & Bulk Operations
There is **no row multi-select anywhere.** "Bulk" means retention in System Preferences.

| ID | P | Scenario |
|---|---|---|
| 18.1 | P1 | Batch retention preview counts match the cutoff date |
| 18.2 | P1 | Batch archive older-than moves exactly the previewed records |
| 18.3 | P1 | Batch delete honours the "only archived" flag |
| 18.4 | **P1** | **BLK-05 regression:** maintenance batch retention must not silently match zero (`reportedDate`/`status` don't exist) |
| 18.5 | P2 | `sync/push` bulk upsert reports per-entity results |

### TS-19 Export
| ID | P | Scenario |
|---|---|---|
| 19.1 | P1 | Export modal column selection + select-all |
| 19.2 | P1 | CSV downloads, has UTF-8 BOM, quotes/commas escaped |
| 19.3 | P1 | PDF downloads and is non-empty |
| 19.4 | P2 | Scope switch (filtered vs date range) changes row count |
| 19.5 | P2 | XLSX workbook export from Reports hub |

### TS-20 Audit Trail
| ID | P | Scenario |
|---|---|---|
| 20.1 | P1 | Create/update/delete each append an audit entry with correct user, role and site |
| 20.2 | P1 | Login and logout are recorded |
| 20.3 | P2 | Audit view filters by module, action, user, site |
| 20.4 | P2 | Audit entries are append-only from the UI |

### TS-21 API Contract (request-level, no browser)
| ID | P | Scenario |
|---|---|---|
| 21.1 | P0 | `/api/health` and `/api/config/status` shape |
| 21.2 | P0 | Unknown entity → 404 `Unknown entity: …` |
| 21.3 | P0 | Auth required on every `/api/db/*` verb (**currently fails — DEF-01**) |
| 21.4 | P1 | Malformed JSON → 400 with the documented error |
| 21.5 | P1 | CRUD round-trip preserves every field (**currently fails — DEF-11**) |
| 21.6 | P2 | `/api/db/status` reports 21/21 entities connected |
| 21.7 | P2 | SMTP endpoints return `simulated: true` when SMTP is unconfigured |

### TS-22 Resilience
| ID | P | Scenario |
|---|---|---|
| 22.1 | P1 | API offline → app still renders from localStorage |
| 22.2 | P1 | Records created offline reconcile on reconnect |
| 22.3 | **P1** | **DEF-10 regression:** deleting all rows server-side clears the UI |
| 22.4 | P2 | Slow API surfaces loading state, not a blank screen |

---

## 8. Test data strategy

1. **Prefix everything `QA-TEST-<runId>`** in the first text field so residue is greppable.
2. **Teardown in `afterEach`, via the API, not the UI** — UI delete depends on the row still being visible, which the archive/status flow can break. `DELETE /api/db/:entity/:id` needs no auth today (DEF-01), which makes cleanup trivial and is itself the bug.
3. **Never delete pre-existing rows.** Baseline before a run and diff after.
4. **Audit rows are unavoidable** — every login writes two. Budget for growth; do not assert on absolute audit counts.
5. **Seed ≥3 records per module** before sorting/pagination suites; most tables are empty and those assertions are meaningless at n≤1.

---

## 9. Recommended harness

```
playwright.config.ts   baseURL http://localhost:3000
                       webServer: PORT=3000 OPEN_BROWSER=false npm run dev
                       reuseExistingServer, chromium channel 'chromium'
                       trace on-first-retry, retries 1
fixtures/auth.ts       storageState from one master login, reused by all specs
fixtures/nav.ts        gotoModule(name) — login then click sidebar (no URLs exist)
fixtures/cleanup.ts    API teardown by QA-TEST tag
```

**Two rules for every spec:** never `waitForLoadState('networkidle')` (BLK-02), and locate row actions by `title` (`View Record Details`, `Edit Record`, `Archive Referral`, `Delete Record`) until testids exist.

---

## 10. Suggested execution order

1. **Fix BLK-05** (`@types/react`) — one install, immediately reveals real type bugs.
2. **Author the harness** (§9) and TS-01 + TS-21 — cheapest, highest signal, catches DEF-01/02/03 straight away.
3. **TS-05 Referrals full CRUD** as the reference module; generalise the page object.
4. **Roll the §5 matrix across remaining modules.**
5. **TS-17 mechanics** once seeding exists.
6. **TS-02 RBAC** last — needs multiple accounts or role-switch fixtures.

Defects DEF-01 through DEF-05 should be fixed before this suite is treated as a release gate; four of them make green tests misleading.
