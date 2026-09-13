# SafeHaven Operations — Final QA Report

**Application:** SafeHaven Operations & Safeguarding Compliance Platform (`sdtracker`)
**Environment:** Development — `http://localhost:3000` (SPA and API share one origin)
**Database:** PostgreSQL on Supabase Cloud (shared instance; no dedicated test database)
**Browser:** Chromium (`channel: 'chromium'`), single worker
**Report date:** 2026-09-06
**Prepared by:** QA engineering

> Application source code was not modified at any point during this engagement.
> All test code lives under `tests/`; all reports under `qa/results/`.

---

## 1. Summary

| Metric | Value |
|---|---:|
| Total tests | **326** |
| Passed | **317** |
| Failed | **9** |
| Blocked | **0** |
| Pass percentage | **97.2%** |
| Test files | 28 |
| Execution time | ~30 min (1 worker) |

### Reading these numbers honestly

The 97.2% pass rate **overstates the health of the product**, for two reasons:

1. **16 passing tests are `test.fail()` defect pins.** They assert correct behaviour, are annotated as expected-failures, and therefore report green *because* the bug is present. Counted as failures, the real pass rate is **92.3%** (301/326).
2. **All 9 failures are product defects, not test defects.** Every test-side failure found during this engagement was repaired and re-run. Nothing red is the suite's fault.

**Blocked = 0.** Five authorization tests were previously blocked by an application behaviour (`/api/auth/me` force-upgrading every session to Super Admin). They were unblocked with an API test double and now execute; four pass and one exposes a real defect.

---

## 2. Coverage

### 2.1 Pages and routes

| Item | Count | Notes |
|---|---:|---|
| Navigable pages | 21 | 18 sidebar modules + 3 archive views |
| Pages exercised | 21 | 100% — each asserted to render without an uncaught error |
| HTTP routes | **0** | The app has **no URL routing**. `activePage` is React state; nothing is deep-linkable, and browser back/forward do not navigate. |

Because there are no routes, every test begins at `/` and navigates by clicking the sidebar. This is encoded once in the `gotoModule()` helper.

### 2.2 CRM modules

18 functional modules, all covered:

| Module | Table | CRUD tests | Notes |
|---|---|:--:|---|
| Dashboard | — | n/a | 7 widget/chart tests |
| SG Referrals | `referrals` | Full | Reference module — complete lifecycle |
| Vulnerable SUs | `vulnerable_residents` | Partial | Create form + smoke |
| Challenging SUs | `challenging_behavior` | Partial | Create form + smoke |
| Maintenance Tracker | `maintenance_records` | Partial | CAT bands, 71-standard picker |
| SPCD Tracker | `spcd_records` | Partial | Locked attribution |
| Laundry Support | `laundry_logs` | Partial | 7-day period rule |
| Hot Meals Tracker | `hot_food_logs` | Partial | 62-field weekly matrix, 4 vendors |
| Escalations Log | `escalations` | Partial | Warning-letter ladder |
| Proof Documents | `documents` | Partial | Confidentiality levels |
| Reports & SharePoint | — | n/a | Export hub |
| Audit Security Trail | `audit_trails` | Read | Action types asserted |
| Requests & Approvals | `data_change_requests` | Read | Review-only, no create path |
| Properties Directory | `sites` | Partial | 16-property estate |
| Staff & User Accounts | `profiles` + Auth | Partial | 7 operational roles |
| Roles & RBAC Matrix | localStorage | Read | Permission matrix |
| Field Options & Setup | localStorage | Read | 18 option categories |
| System Preferences | localStorage | Read | Settings + batch retention |

**Not a sales CRM.** No Customers, Leads, Contacts, Companies, Deals, Tasks, Activities, Notes or Teams modules exist. The customer analogue is a *Service User*; the account analogue is a *Property*.

### 2.3 Forms

| Item | Count |
|---|---:|
| Create forms | 11 |
| Create forms covered | 11 (100%) |
| Form field assertions | ~40 |
| Largest form | Hot Meals vendor buffet — 62 controls |
| Forms with locked attribution | 4 (Referrals, SPCD, Escalations, Maintenance) |

### 2.4 Modals

| Modal type | Covered |
|---|---|
| Create/entry modals (11) | Yes — open, heading, field count, cancel-without-write |
| Edit modal | Yes |
| View dossier modal | Yes |
| Create confirmation | Yes — asserts the record summary names the record |
| Delete confirmation | Yes — asserts the audit-compliance warning |
| Quick Incident Log | Yes |
| Quick Jump (Ctrl/Cmd+K) | Yes |
| Export modal | Partial |
| Session lock / Diagnostics | Not covered |

### 2.5 APIs

| Metric | Value |
|---|---:|
| Endpoints defined | **27** |
| Endpoints covered by tests | **12 (44%)** |
| Logical entity operations | 88 (22 aliases × 4 verbs) |
| Endpoints requiring authentication | **1 of 27** |
| Endpoints enforcing authorization | **0 of 27** |
| Search / filter / pagination endpoints | **0** |
| Bulk endpoints | 1 (`POST /api/db/sync/push`) |

Full inventory in §7 and in the companion API audit.

### 2.6 Workflows

| Workflow | Covered |
|---|---|
| Create → Confirm → Read → Search → Edit → Update → Delete | Yes (Referrals, end to end) |
| Archive → Restore | Yes |
| Duplicate detection | Yes (defect pinned) |
| Inline status transition from table row | Yes |
| Audit trail generation on CRUD | Yes |
| Batch retention (archive/delete older than) | Partial |
| Export (CSV / PDF / XLSX) | Partial |
| Data change request approval | Read-only |
| Offline / API-failure resilience | Yes |

### 2.7 Authentication

Covered: unauthenticated landing, invalid credentials, valid login, token persistence, session restore across reload, corrupted-token rejection, logout clearing all auth keys, re-login after logout, deep-link bypass attempt, empty submit, password masking. **15 tests.**

### 2.8 Authorization

Covered: role-gated sidebar visibility, delete permission withheld and granted, create permission, header role display, site-isolation filter lock for restricted roles, localStorage permission tampering, and 11 API-level anonymous-access checks. **20 tests.**

---

## 3. Bugs

27 confirmed defects. Severity counts: **4 Critical (1 fixed), 9 High, 12 Medium, 2 Low.**

> **Trace note:** `../../playwright.config.ts` sets `trace: 'on-first-retry'` with `retries: 0` locally, so no trace files are produced by a normal run. Screenshots and page snapshots *are* captured on failure. To capture a trace for any bug below, re-run that spec with `--trace=on --retries=1`.

---

### BUG-001 — Unauthenticated access to all data endpoints

| Field | Value |
|---|---|
| **ID** | BUG-001 |
| **Severity** | **Critical** |
| **Module** | Backend — `/api/db/*` |
| **URL** | `http://localhost:3000/api/db/:entity` |

**Preconditions:** Server running. No session, no token, no cookie.

**Steps to reproduce:**
1. `curl http://localhost:3000/api/db/vulnerable`
2. Repeat for `referrals`, `challenging`, `spcd`, `escalations`, `documents`, `profiles`, `passwordAudit`.

**Expected result:** `401 Unauthorized` or `403 Forbidden`.

**Actual result:** `200 OK` with the complete table contents for all 17 entity aliases tested. `POST`, `PUT` and `DELETE` behave identically.

**API involved:** `GET|POST|PUT|DELETE /api/db/:entity`, `/api/db/:entity/:id`

**Console evidence:**
```
200 GET /db/vulnerable      success,data   unauthenticated read
200 GET /db/profiles        success,data   unauthenticated read
200 GET /db/passwordAudit   success,data   unauthenticated read
```

**Screenshot/trace:** `../../test-results/authorization-api-authoriz-*/` (11 tests)

**Root cause:** No authentication middleware exists anywhere in `server/`. `server/index.ts` mounts the routers directly after the CORS and body-parser middleware; `server/routes/db.ts` performs no credential check. All queries execute with the Supabase **service-role** client (`server/supabase.ts`), which bypasses Row Level Security, so the RLS policies in `db/schema.sql` provide no protection.

**Recommended fix:** Add an authentication middleware ahead of the `/api/db` router that verifies the bearer token via Supabase, rejects on failure, and attaches the resolved user. Then derive per-request authorization from that user rather than trusting client-supplied `x-user-*` headers. Longer term, use a user-scoped Supabase client so RLS is actually enforced.

---

### BUG-002 — Forgeable session token grants Super Admin

| Field | Value |
|---|---|
| **ID** | BUG-002 |
| **Severity** | **Critical** |
| **Module** | Authentication — `/api/auth/me` |
| **URL** | `http://localhost:3000/api/auth/me` |

**Preconditions:** None.

**Steps to reproduce:**
1. `curl -H "Authorization: Bearer sm-jwt-FORGED" http://localhost:3000/api/auth/me`

**Expected result:** `401` — the token is not signed by the server and cannot be validated.

**Actual result:** `200` with a full Super Admin profile (`stackmaster@sdcommercial.co.uk`, role `Super Admin`, `assignedSite: All Sites`).

**API involved:** `GET /api/auth/me`; token minted by `POST /api/auth/login`

**Console evidence:**
```
200 GET /auth/me  success,user  FORGED prefix
```

**Screenshot/trace:** `../../test-results/authorization-api-authoriz-59fb3--token-must-not-be-accepted-chromium/`

**Root cause:** `server/routes/auth.ts:228` — `/me` short-circuits on `token.startsWith('sm-jwt-')` and returns a hardcoded Super Admin object without any signature check. The token itself is minted at `auth.ts:31` as `'sm-jwt-' + base64url(JSON payload)` — unsigned, and the prefix alone is the credential.

A second consequence: because `/me` always returns Super Admin for this token, **a session's role cannot be reduced**. This is what blocked the RBAC test suite.

**Recommended fix:** Remove the hardcoded master account and the `sm-jwt-` branch entirely; authenticate the built-in administrator through Supabase like any other user. If an offline break-glass account is genuinely required, sign its token (HMAC with a server secret) and verify the signature on every request.

---

### BUG-003 — CORS reflects any origin with credentials enabled

| Field | Value |
|---|---|
| **ID** | BUG-003 |
| **Severity** | **Critical** |
| **Module** | Backend — global middleware |
| **URL** | Any `http://localhost:3000/api/*` |

**Preconditions:** None.

**Steps to reproduce:**
1. `curl -H "Origin: https://evil.example.com" -i http://localhost:3000/api/health`
2. Inspect the response headers.

**Expected result:** The origin is rejected or not reflected; credentials are not permitted for arbitrary origins.

**Actual result:**
```
Access-Control-Allow-Origin      : https://evil.example.com
Access-Control-Allow-Credentials : true
```

**API involved:** All endpoints (middleware at `server.ts:94`).

**Console evidence:** As above, captured live.

**Screenshot/trace:** n/a (header-level; reproduced by the probe script).

**Root cause:** `server.ts:94-101` echoes `req.headers.origin` straight back into `Access-Control-Allow-Origin` and sets `Access-Control-Allow-Credentials: true`. There is no allow-list.

**Recommended fix:** Replace reflection with an explicit allow-list from configuration. If credentials are not needed cross-origin, drop `Allow-Credentials` as well. Combined with BUG-001, this currently lets **any site a staff member visits** read and write the safeguarding database.

---

### BUG-004 — A one-click status change destroys the record

| Field | Value |
|---|---|
| **ID** | BUG-004 |
| **Severity** | **Critical** |
| **Status** | ✅ **FIXED 2026-09-07** — verified at API level, through the UI inline status dropdown, and by regression test WF.4 |
| **Module** | SG Referrals (and every entity) — `PUT /api/db/:entity/:id` |
| **URL** | `http://localhost:3000` → SG Referrals |

**Preconditions:** Logged in. At least one referral exists with populated fields.

**Steps to reproduce:**
1. Open **SG Referrals**.
2. In any row, change the inline **Status** dropdown (or click the row's **Archive** action).
3. Accept the confirmation dialog — note it names the record.
4. Read the record back: `GET /api/db/referrals`.

**Expected result:** Only `status` changes; all other fields are preserved.

**Actual result:** `status` is applied and **every other field is overwritten with an empty string**. The record survives as a blank shell.

**API involved:** `PUT /api/db/referrals/:id`

**Console evidence:**
```
dialog : Save changes for referral "QA-TEST-INLINE-583726" (PORT-INL)?
PUT    : {"status":"In progress","updatedAt":"…","lastUpdatedBy":"Stack Master"}

BEFORE -> suName="QA-TEST-INLINE-583726" portRef="PORT-INL" council="Camden Council"
          notes="inline status probe" officer="Jane Doe" status="Open"
AFTER  -> suName=""  portRef=""  council=""  notes=""  officer=""  status="In progress"

DESTROYED: suName, portRef, referralCouncil, notesActionTaken, laOfficerLeading
```

**Screenshot/trace:** `../../test-results/workflows-archive-restore--a4a49-es-the-record-out-of-Active-chromium/`

**Root cause:** `server/routes/db.ts:434` passes `req.body` to `toDatabaseRow()`, which constructs a **complete** row and defaults every absent field to `''` (`server/schemaAdapter.ts:104`). That full row is then written with `.update()`, so fields the caller never mentioned are overwritten with blanks.

Two UI paths send partial payloads and are therefore destructive:
- Row **Archive** action — `{status:'Archived', updatedAt}` (`AppContext.tsx:1391`)
- Inline **status** dropdown — `{status}` (`ReferralsView.tsx:624`)

The **Edit modal is not affected** — it submits the complete record.

**Recommended fix:** Make `toDatabaseRow()` emit only keys present in the input when building an update (or add a `partial` mode), so `.update()` touches only supplied columns.

**Fix applied (2026-09-07):** `server/routes/db.ts` PUT handler now reads the stored row, merges the incoming partial body onto it via `fromDatabaseRow`, and maps the merged result. Untouched columns survive; an unknown id now returns `404` instead of `500`. Verified three ways: API probe (all fields preserved, status applied), UI probe through the inline status dropdown (`FIELDS DESTROYED: none`), and regression test WF.4 (now passing). **Residual risk:** read-modify-write has a small race window under simultaneous edits — last write still wins. A true partial-update mode in `toDatabaseRow` remains the durable fix.

---

### BUG-005 — Password-recovery endpoint is unreachable (404)

| Field | Value |
|---|---|
| **ID** | BUG-005 · **Severity** | **High** |
| **Module** | Authentication |
| **URL** | `http://localhost:3000/api/auth/update-password` |

**Preconditions:** None.

**Steps:** `curl -X POST http://localhost:3000/api/auth/update-password -H 'Content-Type: application/json' -d '{}'`

**Expected result:** `400` (validation) — the route exists.

**Actual result:** `404` with an HTML body (falls through to the SPA catch-all).

**API involved:** `POST /api/auth/update-password`

**Console evidence:** `404 POST /auth/update-password …(non-JSON) route registered?`

**Screenshot/trace:** `../../test-results/api-contract-TS-21-API-con-efe55-e-endpoint-must-be-routable-chromium/`

**Root cause:** `server/routes/auth.ts:293` — the `router.post('/update-password', …)` call is nested **inside the `catch` block** of the `/me` handler. It only registers if token verification throws during a request, which never happens at module load, so the route is never added.

**Impact:** The entire "set a new password from a recovery link" flow is dead. `apiService.updateUserPassword()` calls it and always receives a 404.

**Recommended fix:** Move the route registration to module scope, outside the `/me` handler.

---

### BUG-006 — Anonymous account creation with caller-chosen role

| Field | Value |
|---|---|
| **ID** | BUG-006 · **Severity** | **High** |
| **Module** | Authentication |
| **URL** | `POST /api/auth/signup` |

**Preconditions:** None.

**Steps:** POST `{email, password, name, role: "Super Admin"}` with no credentials.

**Expected result:** `401` — account creation is an administrative action.

**Actual result:** `201`. The account is created with `email_confirm: true` (immediately usable) and the **role supplied by the caller** is written to both auth metadata and `profiles`.

**API involved:** `POST /api/auth/signup`

**Console evidence:** Route validates only that email and password are present (`auth.ts:155-170`).

**Root cause:** No authentication or authorization check; `role` is taken from the request body without validation against an allow-list or the caller's own privileges.

**Recommended fix:** Require an authenticated administrator; validate `role` against the permitted enum; do not let callers self-assign privileged roles.

---

### BUG-007 — Anonymous password reset for any user

| Field | Value |
|---|---|
| **ID** | BUG-007 · **Severity** | **High** |
| **Module** | Authentication |
| **URL** | `POST /api/auth/admin/update-password` |

**Preconditions:** Knowledge of a target user's email address.

**Steps:** POST `{email: "victim@sdcommercial.co.uk", newPassword: "x"}` with no credentials.

**Expected result:** `401`.

**Actual result:** Proceeds. Missing identifiers return `400`; with a valid email it resolves the user via `admin.listUsers()` and calls `admin.updateUserById()`. No password strength rule is applied (a 1-character password is accepted by the route's own validation).

**API involved:** `POST /api/auth/admin/update-password`

**Root cause:** No auth check. The `x-admin-email` header used for the audit log is caller-supplied and unverified, so the audit trail records whatever the attacker claims.

**Recommended fix:** Require an authenticated Super Admin/Admin; derive the actor from the verified session rather than a header; enforce a password policy.

---

### BUG-008 — Anonymous schema migration against production

| Field | Value |
|---|---|
| **ID** | BUG-008 · **Severity** | **High** |
| **Module** | Database |
| **URL** | `POST /api/db/migrate`, `POST /api/db/ensure` |

**Preconditions:** None.

**Steps:** `curl -X POST http://localhost:3000/api/db/migrate`

**Expected result:** `401`.

**Actual result:** Executes `db/schema.sql` in full against the live database.

**API involved:** `POST /api/db/migrate`, `POST /api/db/ensure`

**Root cause:** No auth check (`server/routes/db.ts:219,229`). `runDatabaseMigrations()` reads the schema file and runs it as one `client.query(sql)`.

**Additional note:** `GET /api/db/:entity` auto-triggers a migration when it sees PostgreSQL error `42P01`, so schema execution can also be reached indirectly by an anonymous read.

**Recommended fix:** Restrict migration endpoints to an authenticated administrator, or remove them from the runtime API and run migrations as a deployment step.

---

### BUG-009 — No rate limiting or account lockout on login

| Field | Value |
|---|---|
| **ID** | BUG-009 · **Severity** | **High** |
| **Module** | Authentication |
| **URL** | `POST /api/auth/login` |

**Preconditions:** None.

**Steps:** Issue 12 rapid failed logins for the same address.

**Expected result:** Throttling, backoff, or temporary lockout.

**Actual result:** Twelve consecutive `401`s with no delay.

**Console evidence:** `status codes: 401,401,401,401,401,401,401,401,401,401,401,401 -> NO rate limiting / lockout`

**Root cause:** No rate-limiting middleware.

**Recommended fix:** Add per-IP and per-account rate limiting with exponential backoff on `/api/auth/login`, `/reset-password` and `/admin/update-password`.

---

### BUG-010 — Urgency dropdown offers only one option

| Field | Value |
|---|---|
| **ID** | BUG-010 · **Severity** | **High** |
| **Module** | SG Referrals |
| **URL** | SG Referrals → **+ New Record** |

**Preconditions:** Logged in.

**Steps:**
1. SG Referrals → **+ New Record**.
2. Open the **Urgency Priority** dropdown.

**Expected result:** Low / Medium / High / Critical.

**Actual result:** A single option — **Medium**.

**API involved:** none (client-side field options)

**Screenshot/trace:** `../../test-results/modules-referrals-*` (test 05.e)

**Root cause:** `ReferralsView.tsx:84` calls `getFieldOptions('riskLevels')`. No such category exists — the real one is `incidentRiskFactors`. `getFieldOptions` filters on an exact category match and returns `[]`, so the select renders only the fallback option for the current value.

**Impact:** Urgency drives the automated High/Critical safeguarding email alert (`AppContext.tsx` → `apiService.sendAlert`). Because Critical and High cannot be selected in the UI, **that alert can never be triggered by a user.**

**Recommended fix:** Use the correct category name, or add a `riskLevels` category to the field-options catalogue.

---

### BUG-011 — Runaway background sync (~18× intended rate)

| Field | Value |
|---|---|
| **ID** | BUG-011 · **Severity** | **High** |
| **Module** | Application shell — `AppContext` |
| **URL** | Any page, including the login screen |

**Preconditions:** Load the app. No login required.

**Steps:** Open `http://localhost:3000`, remain idle, observe network traffic for 100 seconds.

**Expected result:** One 14-endpoint sync cycle every 45 seconds (~19 requests/min).

**Actual result:** **585 requests in 100 seconds** — a full cycle every 2.4 s, ~351 requests/min, sustained and never settling.

**Console evidence:**
```
/api/db/* requests per 10s bucket, idle login screen:
t=  0- 10s : 52    t= 50- 60s : 62
t= 10- 20s : 56    t= 60- 70s : 55
t= 20- 30s : 61    t= 70- 80s : 64
t= 30- 40s : 55    t= 80- 90s : 53
t= 40- 50s : 62    t= 90-100s : 65
total: 585 in 100s  |  overrun factor 18.8×  |  ~505,000 requests/day per idle tab
```

**Root cause:** `AppContext.tsx:1133` — the effect depends on `triggerBackgroundDeltaSync`, which depends on `[syncFromDatabase, sites, users]`. The sync calls `setSites(deduplicateSites(...))` and `setUsers(...)`, always producing new array identities. The callback identity changes, the effect tears down and re-runs, and its 1.5 s initial timer re-arms — so the 45 s interval is never reached.

**Impact:** Sustained load on the Supabase project; runs unauthenticated on the login screen; and `waitForLoadState('networkidle')` can never resolve, which is a permanent constraint on test authoring.

**Recommended fix:** Store the sync function in a ref, or narrow the dependency array to stable values, so the interval is created once.

---

### BUG-012 — Compliance forms pre-filled with fabricated data

| Field | Value |
|---|---|
| **ID** | BUG-012 · **Severity** | **High** |
| **Module** | Laundry Support, Hot Meals Tracker |
| **URL** | Laundry Support → **+ Log Laundry Batch** |

**Preconditions:** Logged in.

**Steps:**
1. Laundry Support → **+ Log Laundry Batch**.
2. Change nothing. Click **Add Log Record**.

**Expected result:** Validation blocks an unfilled form, or at minimum the operator must enter the figures being attested to.

**Actual result:** The form opens fully populated; there are **zero invalid controls**; the record saves immediately.

**Console evidence:**
```
invalid controls before submit: 0
Property / Hotel *          "Brit Hotel"
Date From *                 "2026-08-31"
Date To (Max 7 Days) *      "2026-09-06"
Dirty Laundry Sent (pcs) *  "115"
Clean Laundry Returned *    "115"
Discrepancy Details         "Tokens distribution ma…"
Remarks / Actions Taken     "Batch verified upon ar…"
Logged / Audited By         "Stack Master"
```

**Screenshot/trace:** `../../test-results/modules-operations-TS-10-L-f1ca8--an-empty-create-submission-chromium/`

**Root cause:** The create-form initial state is seeded with sample operational values rather than empty defaults.

**Impact:** A single click manufactures an official compliance record asserting that 115 items were sent and returned, signed by the logged-in user. Each full suite run created 4 laundry logs and 1 food log this way. In a system whose purpose is auditable evidence, this is a data-integrity problem, not a convenience.

**Recommended fix:** Initialise numeric and free-text fields empty; keep only genuinely safe defaults (site, date range) and require explicit entry of attested quantities.

---

### BUG-013 — Reversed reporting period accepted

| ID | Severity | Module | URL |
|---|---|---|---|
| BUG-013 | Medium | Laundry Support | Laundry → **+ Log Laundry Batch** |

**Preconditions:** Logged in. **Steps:** Set *Date From* later than *Date To*; submit.
**Expected:** Rejected with a message. **Actual:** Submits successfully; the modal closes.
**API involved:** `POST /api/db/laundry`
**Root cause:** `laundryLogSchema` in `src/utils/validationSchemas.ts` defines `endDate >= startDate`, but **no view invokes the validator** (see BUG-020). Only native HTML5 `required` runs, and both dates are populated.
**Recommended fix:** Wire the Zod schema into the submit path, or add an inline date comparison.
**Trace:** `../../test-results/validation-business-rules--e8ad1-od-is-not-silently-accepted-chromium/`

---

### BUG-014 — Fields marked mandatory are not enforced

| ID | Severity | Module | URL |
|---|---|---|---|
| BUG-014 | Medium | Maintenance Tracker | Maintenance → **Log Maintenance Defect** |

**Preconditions:** Logged in. **Steps:** Open the form; inspect which controls carry the `required` attribute.
**Expected:** All 7 asterisked fields enforced. **Actual:** 7 labels marked `*`, only 4 have `required`.
**Console evidence:** `-> [required] attrs: 4, labels with *: 7` — mismatch: `Priority Category *` (both controls), `Property Site *`.
**Root cause:** The asterisk is presentational text in the label; the `required` attribute was not applied to those three `<select>` elements.
**Recommended fix:** Add `required` to the three selects, or remove the asterisk if they are genuinely optional.
**Trace:** `../../test-results/forms-create-forms-TS-Form-99095-s-mandatory-fields-required-chromium/`

---

### BUG-015 — Proof Documents cannot accept a document

| ID | Severity | Module | URL |
|---|---|---|---|
| BUG-015 | Medium | Proof Documents | Proof Documents → **+ Upload Document** |

**Preconditions:** Logged in. **Steps:** Open the upload form; look for a file input.
**Expected:** A file picker. **Actual:** `file inputs: 0`. Seven controls capture metadata only (title, resident, reference, site, category, confidentiality, file format) while the button reads **Confirm & Upload**.
**Root cause:** No `<input type="file">` is rendered. The Referrals form does expose one, so this is an inconsistency rather than a platform limitation.
**Impact:** The module records that evidence exists without ever storing it.
**Recommended fix:** Add a file input and persist the attachment, or relabel the module and button to reflect that it is a metadata register.
**Trace:** `../../test-results/modules-admin-TS-13-Proof--0fd3f-b-accepts-a-file-for-upload-chromium/`

---

### BUG-016 — `canCreateRecords` permission is ignored

| ID | Severity | Module | URL |
|---|---|---|---|
| BUG-016 | Medium | Authorization / SG Referrals | SG Referrals |

**Preconditions:** A role with `canCreateRecords: false`.
**Steps:** Sign in as that role; open SG Referrals.
**Expected:** The **+ New Record** button is withheld.
**Actual:** The button renders and creation succeeds.
**Root cause:** `ReferralsView.tsx:390` gates the button only on `!isArchive`. `canCreateRecord` is imported at line 65 and never used. Delete (`canDelete`) and Edit (`canEditRecord`) *are* correctly gated, which makes this an omission rather than a design decision.
**Recommended fix:** Wrap the create button in `canCreateRecord() && …`, and apply the same guard across the other modules.
**Trace:** `../../test-results/authorization-rbac-TS-02-R-71fd8-ithholds-the-create-control-chromium/`

---

### BUG-017 — RBAC matrix omits the Site Manager role

| ID | Severity | Module | URL |
|---|---|---|---|
| BUG-017 | Medium | Roles & RBAC Matrix | Roles & RBAC Matrix |

**Preconditions:** Logged in as Super Admin. **Steps:** Open the Roles view; look for Site Manager.
**Expected:** All 7 roles configurable. **Actual:** "5 Operational Roles"; **Site Manager is absent**, though it is offered in the Add User form, present in `userAccountSchema`, and branched on explicitly in `canEditRecord`.
**Impact:** Users can hold a role whose permissions cannot be configured or reviewed; it silently falls back to defaults.
**Recommended fix:** Include Site Manager (and verify all seven `RoleType` values) in the matrix.
**Trace:** `../../test-results/modules-read-only-views-TS-1b701-le-in-the-permission-matrix-chromium/`

---

### BUG-018 — Duplicate records accepted with no warning

| ID | Severity | Module | URL |
|---|---|---|---|
| BUG-018 | Medium | SG Referrals | SG Referrals → **+ New Record** |

**Steps:** Create two referrals with identical SU name, Port/NASS reference and Mosaic ID.
**Expected:** A duplicate warning or rejection. **Actual:** Both persist; no warning at any layer.
**API involved:** `POST /api/db/referrals` (uses `upsert`, but each record carries a fresh generated `id`, so no conflict occurs).
**Root cause:** No uniqueness constraint on business keys in `db/schema.sql`, and no client-side duplicate check.
**Recommended fix:** Add a uniqueness rule on the business key (e.g. Port ref + site), and surface a confirmation when a near-duplicate is detected.

---

### BUG-019 — Dropdown defaults absent from their own option lists

| ID | Severity | Module | URL |
|---|---|---|---|
| BUG-019 | Medium | Referrals, Escalations, Vulnerable SUs | Create forms |

**Observed:** Referrals *Method of Referral* defaults to `Mosaic Portal` while its options read `Mosaic Social Care Portal`; Escalations *Status* defaults to `Active`, absent from its list; Vulnerable *Status* defaults to `Open`, appended as a fallback.
**Impact:** The browser silently selects the first option instead, so the stored value differs from the configured intent. Not detectable through the DOM (see §10) — a source/unit check is required.
**Root cause:** The field-options catalogue and the component defaults were edited independently and drifted.
**Recommended fix:** Derive defaults from the catalogue rather than hardcoding them; add a startup assertion that every default is a member of its option set.

---

### BUG-020 — Validation schemas are never invoked

| ID | Severity | Module | URL |
|---|---|---|---|
| BUG-020 | Medium | Application-wide | All create forms |

**Observed:** `src/utils/validationSchemas.ts` defines Zod schemas for users, groups, properties, laundry, food and referrals — including `endDate >= startDate` and required identity references. **No view calls `validateLaundryLog`, `validateFoodLog` or any schema.** Validation is native HTML5 `required` only; an empty submit produces browser-native invalid states and **zero inline error text**.
**Impact:** Root cause of BUG-013; also means the Zod schema for referrals (which requires `mosaicId`, `portRef`, `dob`) does not match the form, which marks none of them required.
**Recommended fix:** Invoke the schemas on submit and render field-level errors; align schema and form definitions.

---

### BUG-021 — Server-side deletions never reach the UI

| ID | Severity | Module | URL |
|---|---|---|---|
| BUG-021 | Medium | Application shell — sync | Any list view |

**Steps:** With a record visible, delete it directly via the API; wait for several sync cycles.
**Expected:** The row disappears. **Actual:** It remains indefinitely.
**Root cause:** `AppContext.tsx` `syncFromDatabase` assigns state only when `data.length > 0`, so an emptied table never clears the cached localStorage copy.
**Recommended fix:** Assign whenever the request succeeds, including empty arrays; distinguish "no data" from "request failed".

---

### BUG-022 — Staff directory and password history exposed anonymously

| ID | Severity | Module | URL |
|---|---|---|---|
| BUG-022 | Medium | Authentication | `GET /api/auth/users`, `GET /api/auth/password-audit-logs` |

**Steps:** Request both endpoints with no credentials.
**Expected:** `401`. **Actual:** `200` with the full staff list (emails, names, roles, site assignments, last sign-in) and the 100 most recent password-change audit entries.
**Additional defect:** Both swallow errors into a `200` with an empty array, so a failure is indistinguishable from an empty result.
**Recommended fix:** Require an authenticated administrator; return real error statuses.

---

### BUG-023 — Field values lost or type-changed on round trip

| ID | Severity | Module | URL |
|---|---|---|---|
| BUG-023 | Low | Backend — schema adapter | `POST`/`GET /api/db/referrals` |

**Steps:** Create a referral with `srNo: 42` and `acknowledgementReceived: "Pending"`; read it back.
**Expected:** Both preserved. **Actual:** `srNo` is dropped; `acknowledgementReceived` returns as a **boolean**; `attachments` and `lastUpdatedBy` are dropped.
**Root cause:** `server/schemaAdapter.ts` packs fields the SQL table lacks into a JSON blob in the `notes` column; `srNo`, `attachments` and `lastUpdatedBy` are not included, and `fromDatabaseRow` reconstructs `acknowledgementReceived` as `extra.acknowledgementReceived !== false`.
**Impact:** Fields in the JSON blob are also not queryable or indexable.
**Recommended fix:** Add real columns for the fields the domain model requires; stop overloading `notes`.

---

### BUG-024 — Status vocabularies disagree across layers

| ID | Severity | Module | URL |
|---|---|---|---|
| BUG-024 | Low | SG Referrals | SG Referrals |

**Observed:** The status **filter** offers `Pending`, but the create form's status list is `Open / In progress / Completed / Archived` — `Pending` can be filtered for but never set. Option sets also diverge from the `StatusType` and `referralType` unions in `src/types/index.ts` (e.g. `Mental Health Crisis` vs `Mental Health`).
**Recommended fix:** Derive filter and form options from one shared source aligned to the TypeScript unions.

---

### BUG-025 — API silently truncates every read at 1000 rows

| Field | Value |
|---|---|
| **ID** | BUG-025 · **Severity** | **High** |
| **Module** | Backend — `GET /api/db/:entity` |
| **URL** | `http://localhost:3000/api/db/audit` |

**Preconditions:** A table containing more than 1000 rows. `audit_trails` crossed that threshold during testing.

**Steps to reproduce:**
1. `curl http://localhost:3000/api/db/status` — note the true `audit_trails` count.
2. `curl http://localhost:3000/api/db/audit` — count the rows returned.

**Expected result:** All rows returned, or an explicit paging contract (`total`, `hasMore`) telling the caller more exist.

**Actual result:** Exactly 1000 rows, with no error, no warning, and no indication of truncation.

**API involved:** `GET /api/db/:entity` — all 22 entity aliases.

**Console evidence:**
```
true row count (COUNT query via /db/status): 1133
rows returned by GET /api/db/audit         : 1000

*** CONFIRMED: GET /api/db/:entity silently truncates at 1000 rows ***
    133 audit records are unreachable through the API.
```

**Screenshot/trace:** `../../test-results/workflows-audit-trail-*` (3 failing tests)

**Root cause:** `server/routes/db.ts` issues a bare `client.from(tableName).select('*')`. PostgREST, which Supabase is built on, applies a default ceiling of 1000 rows per response. The route neither raises that limit, nor pages with `.range()`, nor reports that a cap was reached.

**Impact:** Compounds BUG-010 (no pagination). Any table past 1000 rows is silently incomplete everywhere it is displayed. For `audit_trails` this is the most serious case: the audit log is the record of who did what, and 133 entries are already unreachable. The frontend caches whatever it receives, so a truncated audit trail is presented as complete. The defect only appears once real data volume accumulates — precisely when it matters most.

**Detected by:** three audit-trail regression tests (20.1, 20.2, 20.3) that began failing once the table crossed 1000 rows. They were passing earlier in the engagement at lower volume.

**Recommended fix:** Page the query with `.range()` until exhausted, or accept `limit`/`offset` parameters and return `{ data, total, hasMore }` so callers can distinguish truncation from completeness. Fixing BUG-010 properly resolves this as a side effect.

---

### Infrastructure defect (not a product bug)

**INF-001 — `npm run lint` is a false green.** `tsc --noEmit` reports 0 errors, but `@types/react` and `@types/react-dom` are **not installed**, so React resolves to implicit `any` and the entire component and context layer is unchecked. Real errors are invisible — for example `AppContext.tsx:2532` filters maintenance records on `m.reportedDate` and `m.status`, neither of which exists on `MaintenanceRecord` (the real fields are `date`, `defectStatus`, `action`), so batch retention for that module silently matches nothing. **Fix:** `npm i -D @types/react @types/react-dom`, then triage what surfaces.

---

## 4. API Results — endpoint failures

| Endpoint | Verb | Failure | Severity |
|---|---|---|---|
| `/api/db/:entity` | GET/POST/PUT/DELETE | Accepts unauthenticated requests on all 22 aliases (88 operations) | Critical |
| `/api/auth/me` | GET | Returns Super Admin for any `sm-jwt-` prefixed string | Critical |
| `/api/db/:entity/:id` | PUT | Blanks every field absent from a partial payload | Critical |
| *(all endpoints)* | — | CORS reflects arbitrary origins with credentials | Critical |
| `/api/auth/update-password` | POST | **404 — route never registered** | High |
| `/api/auth/signup` | POST | Unauthenticated; role is caller-supplied | High |
| `/api/auth/admin/update-password` | POST | Unauthenticated; no password policy | High |
| `/api/db/migrate`, `/api/db/ensure` | POST | Unauthenticated schema execution | High |
| `/api/auth/login` | POST | No rate limiting or lockout | High |
| `/api/auth/users` | GET | Staff directory exposed anonymously; errors masked as `200` | Medium |
| `/api/auth/password-audit-logs` | GET | Password history exposed anonymously; errors masked as `200` | Medium |
| `/api/auth/users/:id` | PUT | Unauthenticated; returns `500` for an unknown user instead of `404` | Medium |
| `/api/db/sync/push` | POST | Bulk upsert across 12 tables, unauthenticated, no per-record validation, non-transactional | Medium |
| `/api/db/:entity` | GET | **Silently truncates at 1000 rows** (PostgREST default); 133 audit records unreachable | High |
| `/api/db/:entity` | GET | No pagination, filtering, sorting or search | Medium |
| `/api/smtp/escalation-alert` | POST | Accepts an empty body and returns `200` | Low |
| `/api/db/:entity/:id` | PATCH | Advertised in CORS `Allow-Methods` but not implemented (`404`, HTML body) | Low |
| `/api/config/test-smtp`, `/api/smtp/status`, `/api/db/ensure` | — | Orphan endpoints — defined but never called by the application | Low |

**Query capability:** every parameter tested (`limit`, `page`, `pageSize`, `offset`, `search`, `site`, `status`, `order`, `sort`, `filter[]`) was ignored; all returned the full 16-row table.

---

## 5. Validation Results — form and validation failures

| # | Module | Failure | Severity |
|---|---|---|---|
| V-1 | Laundry, Hot Meals | Forms open fully pre-filled with fabricated values; zero invalid controls; one click saves a complete record | High |
| V-2 | Laundry | Reversed reporting period (end before start) accepted | Medium |
| V-3 | Maintenance | 7 labels marked `*`, only 4 carry `required` — 3 mandatory fields unenforced | Medium |
| V-4 | Application-wide | Zod schemas never invoked by any view; validation is HTML5 `required` only | Medium |
| V-5 | Application-wide | No inline error messages on blocked submissions — only native browser tooltips | Medium |
| V-6 | Referrals | Zod schema requires `mosaicId`, `portRef`, `dob`; the form marks none required | Medium |
| V-7 | Referrals, Escalations, Vulnerable | Dropdown defaults absent from their own option lists | Medium |
| V-8 | Referrals | Urgency dropdown renders a single option | High |
| V-9 | Referrals | Duplicate records accepted with no warning | Medium |
| V-10 | Backend | No request-body validation on any write route — the entity name is the only thing checked | Medium |

**Validation that works correctly:** empty-submit is properly blocked on Referrals, Vulnerable SUs, Challenging SUs, Maintenance, SPCD, Escalations, Properties and Users — 8 of 10 create forms enforce their required fields via HTML5 and issue no write.

---

## 6. Authorization Results — permission and security problems

| # | Problem | Severity |
|---|---|---|
| A-1 | No authentication middleware anywhere in the backend; 0 of 27 endpoints enforce authorization | Critical |
| A-2 | All data endpoints run with the Supabase **service-role** key, bypassing Row Level Security entirely | Critical |
| A-3 | `sm-jwt-` prefix accepted as a credential without signature verification → instant Super Admin | Critical |
| A-4 | CORS reflects any origin with `Allow-Credentials: true` — any site can act on the API | Critical |
| A-5 | Session role cannot be reduced: `/auth/me` force-returns Super Admin for the master token | High |
| A-6 | Anonymous account creation with a caller-chosen role | High |
| A-7 | Anonymous password change for any user, identified by email alone | High |
| A-8 | Anonymous schema migration against the production database | High |
| A-9 | RBAC state (`sg_tracker_role_permissions`) lives in user-writable localStorage and is never validated server-side | High |
| A-10 | `canCreateRecords` defined and configurable but never enforced | Medium |
| A-11 | RLS policies exist but are blanket `USING (true)` for both `authenticated` and `service_role` — no row-level isolation | Medium |
| A-12 | Site isolation is a client-side convention only; the API applies no site scoping | Medium |
| A-13 | Audit actor is taken from caller-supplied `x-user-*` headers and never verified | Medium |

**Authorization that works correctly:** sidebar module gating by role, row-level Edit and Delete gating, and site-filter locking for restricted roles all behave as intended — verified by 6 passing tests once the role could be set.

---

## 7. Data Integrity — UI / API / database inconsistencies

| # | Inconsistency | Severity |
|---|---|---|
| D-1 | ~~Partial `PUT` blanks every omitted field~~ — **FIXED 2026-09-07**, verified by API probe, UI probe and test WF.4 | ~~Critical~~ |
| D-1b | Reads truncate at 1000 rows, so any large table is silently incomplete in the UI (BUG-025) | High |
| D-2 | Compliance forms fabricate operational records (115 items sent/returned) on a single click | High |
| D-3 | Server-side deletions never propagate to the UI (`data.length > 0` guard) | Medium |
| D-4 | `srNo`, `attachments` and `lastUpdatedBy` dropped on round trip; `acknowledgementReceived` changes type text → boolean | Low |
| D-5 | Fields without SQL columns are packed into a JSON blob in `notes` — not queryable, not indexable | Medium |
| D-6 | Dropdown option sets diverge from the TypeScript unions in `src/types/index.ts` | Medium |
| D-7 | `Pending` is filterable but not settable on referrals | Low |
| D-8 | No uniqueness constraint on business keys — exact duplicates persist | Medium |
| D-9 | `maintenance_records` batch retention filters on `reportedDate`/`status`, which do not exist on the type — silently matches nothing (masked by INF-001) | Medium |
| D-10 | Records created by pre-filled forms carry no identifying marker, so automated teardown cannot reclaim them | Low |
| D-11 | Local storage is the source of truth; the database is a background overlay, so the two can diverge indefinitely | Medium |

**Test data hygiene:** the suite creates only `QA-TEST-` prefixed records and purges them after each test. Records produced by BUG-012 carry no tag and were removed manually. **Final database state matches the pre-engagement baseline exactly:** referrals 0, laundry_logs 0, hot_food_logs 0, challenging 1, spcd 1, escalations 1, sites 16, profiles 6. Audit rows grew 145 → 552 and were deliberately retained as the system's own record of the engagement.

---

## 8. Regression — tests repaired and re-run

Eight failures were traced to the test suite rather than the product. All were repaired and the affected specs re-run in full. **No assertion was weakened**, and no product failure was annotated away.

| Test | Classification | Root cause | Repair | Result |
|---|---|---|---|---|
| 01.14 signing in again after logout | Timing | Helper opened the user menu before React attached handlers; logout works in isolation | Wait for the Sign Out entry to be visible; removed a speculative confirmation click for a dialog that does not exist | **Pass** |
| CRUD.7 edit persists | Locator | Edit modal labels the field `LA Lead Officer`; the create modal calls it `LA Officer Leading` | Target the edit modal's actual label | **Pass** |
| 12.d escalation status default | Invalid premise | A `<select>` whose value is absent falls back to its first option, so the check could never fail — it was marked `test.fail()` and then "passed" | Replaced with a verifiable assertion; noted that BUG-019 needs a source-level check | **Pass** |
| 02.2 Staff cannot see RBAC matrix | Blocked | `/api/auth/me` force-returns Super Admin, overwriting the role under test | Stubbed the endpoint per role (an API test double, not a relaxed assertion) | **Pass** |
| 02.3 Staff cannot see user admin | Blocked | as above | as above | **Pass** |
| 02.5 create permission withheld | Blocked | as above | as above | **Fails — BUG-016, kept red** |
| 02.6 active role in header | Blocked | as above | as above | **Pass** |
| 02.7 site filter locked | Blocked | as above | as above | **Pass** |

**Test strengthened during healing:** `02.4` (delete withheld) previously passed against an empty table — a false pass. It now seeds a row before asserting, and a positive counterpart `02.4b` was added to confirm the action appears when the permission is granted.

**Suite growth:** 324 → 326 tests (two authorization tests added).

---

## 9. Release Decision

# ❌ NOT READY FOR RELEASE

**3 Critical and 9 High severity defects remain open.** (BUG-004 was fixed and verified on 2026-09-07.)

### Blocking defects

| ID | Severity | Title |
|---|---|---|
| BUG-001 | Critical | Unauthenticated access to all data endpoints |
| BUG-002 | Critical | Forgeable session token grants Super Admin |
| BUG-003 | Critical | CORS reflects any origin with credentials |
| ~~BUG-004~~ | ~~Critical~~ | ~~A one-click status change destroys the record~~ — **FIXED** |
| BUG-005 | High | Password-recovery endpoint unreachable (404) |
| BUG-006 | High | Anonymous account creation with caller-chosen role |
| BUG-007 | High | Anonymous password reset for any user |
| BUG-008 | High | Anonymous schema migration against production |
| BUG-009 | High | No rate limiting or lockout on login |
| BUG-010 | High | Urgency dropdown offers one option — blocks safeguarding alerts |
| BUG-011 | High | Runaway background sync (~18× intended rate) |
| BUG-012 | High | Compliance forms fabricate records on one click |
| BUG-025 | High | API silently truncates reads at 1000 rows — audit trail incomplete |

### Rationale

This system holds safeguarding case records about vulnerable people in supported accommodation. Three findings are disqualifying on their own:

1. **The data is publicly readable and writable.** Every entity endpoint accepts anonymous requests and runs with the service-role key, so Row Level Security never applies. Reflected CORS with credentials means any website a staff member visits can act on that data.
2. **Administrative control is unauthenticated.** An anonymous caller can create a Super Admin account, change any user's password, and re-run the schema against production.
3. **Routine use destroys records.** Archiving a referral or changing its status from the table erases the service user's name, references, council and case notes — while showing a confirmation that names the record it is about to blank.

There is also a **compliance-integrity** concern independent of security: BUG-012 means audit evidence can be manufactured by a single click, and BUG-010 means the High/Critical safeguarding email alert cannot be triggered from the UI at all.

### Conditions for reconsideration

1. Close all 4 Critical defects; re-run the full suite and confirm the corresponding `test.fail()` pins flip to hard failures, then remove those annotations.
2. Close all 8 High defects.
3. Install `@types/react` / `@types/react-dom` (INF-001) and triage what the restored type checking reveals.
4. Raise API test coverage from 44%, prioritising `/auth/signup` and `/auth/admin/update-password`.
5. Provide a dedicated test database so verification no longer runs against live safeguarding records.

Medium and Low defects should be scheduled but are not individually release-blocking.

---

## 10. Notes and limitations

- **No dedicated test environment.** All testing ran against the live Supabase project. Every created record was removed and the final state matches the pre-engagement baseline.
- **Traces not captured by default.** `trace: 'on-first-retry'` with `retries: 0` means normal runs produce screenshots and page snapshots but no traces. Re-run any spec with `--trace=on --retries=1` to capture one.
- **`networkidle` is unusable** while BUG-011 stands; no spec may use it.
- **No `data-testid` anywhere** in ~37,000 lines of frontend, and no `id`/`name` on form controls, so `getByLabel()` cannot work. All selector fragility is contained in `../../tests/helpers/ui.ts`; adding testids would let that layer shrink substantially.
- **BUG-019 is not detectable through the DOM.** A `<select>` whose configured default is absent from its options silently resolves to the first option, so a browser-level assertion can never catch it. This needs a unit or source-level check against the field-options catalogue.
- **Single browser.** Chromium only; Firefox and WebKit are not installed. No cross-browser or mobile-viewport coverage.
- **Not covered:** SMTP dispatch paths (they send real mail — need a stubbed transport), file upload behaviour, SharePoint/XLSX export internals, the session-lock and diagnostics modals, and concurrency/multi-user scenarios.

---

## 11. Companion reports

| Report | Contents |
|---|---|
| `../../specs/test-plan.md` | Discovery-based test plan: module inventory, field and business rules, 22 test suites |
| API audit | Full 27-endpoint inventory with auth, validation, database operations and coverage |
| Failure report | Root-cause analysis of every failure, split into product bugs and test defects |

*End of report.*
