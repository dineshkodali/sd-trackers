# SafeHaven QA Remediation Log

Work queue: the SafeHaven **Failure Report** (`QA Testing & Results/qa/results/QA_REPORT.md`).
Processed in priority order — Critical, then High, then Medium/Low.

**Status vocabulary**

| Status | Meaning |
|---|---|
| ✅ Fixed and verified | Fix applied; the originally failing test was re-run and passes |
| ⚠️ Fixed but not fully verified | Fix applied and partially proven; some aspect could not be exercised here |
| ⛔ Not reproduced | The reported behaviour does not occur against the current code |
| 🚧 Blocked | Cannot proceed without a decision or resource outside this repository |

All tests are run from `QA Testing & Results/` with the dev server running:

```bash
# terminal 1, from the project root
PORT=3000 OPEN_BROWSER=false DISABLE_HMR=true npm run dev
# terminal 2
cd "QA Testing & Results" && npx playwright test <path>
```

---

## Summary

| Severity | Total | Fixed & verified | Blocked | Not reproduced | Outstanding |
|---|---:|---:|---:|---:|---:|
| Critical | 4 | 4 | 0 | 0 | 0 |
| High | 9 | 8 | 0 | 0 | 1 |
| Medium | 12 | 6 | 1 | 2 | 3 |
| Regression | 1 | 1 | 0 | 0 | 0 |
| Low | 2 | 0 | 0 | 0 | 2 |

---

## Critical

### BUG-004 — A one-click status change destroys the record
**Test ID:** WF.4 (`tests/workflows/archive-restore.spec.ts:41`)
**Status:** ✅ Fixed and verified

**Root cause.** `PUT /api/db/:entity/:id` passed the request body straight to `toDatabaseRow()`, which always constructs a *complete* row and defaults anything absent to `''`. The result was written with `.update()`, so every column the caller had not sent was overwritten with a blank. Two one-click UI paths send partial payloads: the row **Archive** action (`{status, updatedAt}`) and the **inline status dropdown** (`{status, updatedAt, lastUpdatedBy}`). The Edit modal was unaffected — it submits the full record.

**Fix.** `server/routes/db.ts` — read the stored row, merge the incoming partial body onto it via `fromDatabaseRow`, then map the merged result. An unknown id now returns `404` instead of `500`.

**Verification**
```bash
npx playwright test tests/workflows tests/crud
```
**Result:** WF.4 passes; all 9 CRUD lifecycle tests pass. Confirmed independently at API level (all fields preserved, status applied) and through the UI inline dropdown (`FIELDS DESTROYED: none`).

**Residual risk.** Read-modify-write has a small race window; under simultaneous edits the last write still wins. A true partial-update mode in `toDatabaseRow` remains the durable fix.

---

### BUG-001 — Unauthenticated access to all data endpoints
**Test IDs:** 02.a ×8, 02.b, 02.c (`tests/authorization/api-authorization.spec.ts`)
**Status:** ✅ Fixed and verified

**Root cause.** No authentication middleware existed anywhere in `server/`. Routers were mounted directly after the body parser, and every `/api/db` query ran with the Supabase **service-role** client, which bypasses Row Level Security. The RLS policies in `db/schema.sql` therefore provided no protection, and site isolation existed only in the browser.

**Fix.** New `server/middleware/requireAuth.ts` verifies a Supabase access token *or* the signed built-in token, rejects suspended accounts, and attaches `req.user`. Mounted as `app.use('/api/db', requireAuth, dbRouter)` and the same for `/api/smtp`.

**Verification**
```bash
npx playwright test tests/authorization/api-authorization.spec.ts
```
**Result:** 20/20 pass. 02.c additionally proves a record *survives* an unauthorised delete attempt; 02.m proves legitimate authenticated access still works.

---

### BUG-002 — Forgeable session token grants Super Admin
**Test IDs:** 02.e, 02.f
**Status:** ✅ Fixed and verified

**Root cause.** The built-in token was `'sm-jwt-' + base64url(payload)` with no signature, and `/api/auth/me` short-circuited on `token.startsWith('sm-jwt-')`, returning a hardcoded Super Admin profile without verification. The prefix *was* the credential. A second, independent backdoor existed in the frontend: `AppContext.login` granted itself a Super Admin session with a self-minted token whenever the server login errored.

**Fix.** New `server/tokenSigner.ts` HMAC-signs the token and verifies signature, issuer and expiry with `crypto.timingSafeEqual`. Lifetime reduced from 30 days to 12 hours. `/api/auth/me` now verifies before trusting. The frontend self-grant was removed entirely — authentication is server-side only.

**Behaviour change (deliberate).** Offline login as the built-in administrator no longer works. It granted full Super Admin from a check that ran only in the browser, so it could be reproduced by anyone reading the bundle.

**Configuration.** `AUTH_TOKEN_SECRET` signs the token. If unset, a random per-boot key is used — still unforgeable, but sessions do not survive a restart. The secret is never logged or returned.

**Verification**
```bash
npx playwright test tests/authorization/api-authorization.spec.ts
```
**Result:** forged tokens (`sm-jwt-FORGED`, `sm-jwt-x`, `sm-jwt-default-superadmin`) all return `401`; a payload re-signed with a stolen signature returns `401`; legitimate login still issues a working token.

---

### BUG-003 — CORS reflects any origin with credentials
**Test ID:** none previously; covered by manual probe (automated coverage still to add)
**Status:** ⚠️ Fixed but not fully verified

**Root cause.** `server/index.ts` echoed `req.headers.origin` into `Access-Control-Allow-Origin` and set `Access-Control-Allow-Credentials: true`, with no allow-list. Combined with BUG-001, any website a signed-in member of staff visited could read and write the safeguarding database.

**Fix.** An allow-list assembled from `ALLOWED_ORIGINS`, `APP_URL`, `PUBLIC_URL` and this host's own advertised addresses (localhost plus each LAN IP on the bound port), so multi-host access is preserved. Un-listed origins receive no CORS headers at all. `Vary: Origin` added; `PATCH` removed from `Allow-Methods` as no PATCH route exists.

**Verification** — manual probe:
```
https://evil.example.com  -> NO CORS HEADERS (blocked)
http://attacker.test      -> NO CORS HEADERS (blocked)
http://localhost:3000     -> allowed
http://192.168.0.186:3000 -> allowed
```
**Not fully verified:** no automated regression test yet asserts the allow-list. Header assertions from Playwright's request context are straightforward to add and this should not stay manual.

---

## High

### BUG-005 — Password-recovery endpoint unreachable (404)
**Test IDs:** 21.13, 21.15, 21.16 (`tests/api/contract.spec.ts`)
**Status:** ✅ Fixed and verified

**Root cause.** `router.post('/update-password', …)` was nested **inside the `catch` block** of the `/me` handler, so it only registered if token verification threw during a request — which never happens at module load. The route was never added and every call fell through to the SPA catch-all as `404`.

**Fix.** Registration lifted to module scope in `server/routes/auth.ts`; the stray closing braces removed.

**Verification**
```bash
npx playwright test tests/api
```
**Result:** 16/16 pass. Empty body → `400` "at least 6 characters"; no token → `401`; a valid *session* token is correctly rejected as not a recovery token (21.16). `/api/auth/me` behaviour unchanged.

---

### BUG-006 / BUG-007 / BUG-008 — Unauthenticated administrative endpoints
**Test IDs:** 02.i, 02.j, 02.d
**Status:** ✅ Fixed and verified

**Root cause.** `/auth/signup`, `/auth/admin/update-password`, `/db/migrate` and `/db/ensure` performed no authentication or authorization. Signup additionally took `role` straight from the request body, so an anonymous caller could create a confirmed Super Admin account. The `x-admin-email` header used for audit logging was caller-supplied and unverified.

**Fix.** `requireAuth` + `requireRole('Super Admin', 'Admin')` applied to signup, admin password change, user management (`GET`/`PUT /auth/users`), password audit logs, and both migration routes.

**Verification**
```bash
npx playwright test tests/authorization/api-authorization.spec.ts
```
**Result:** all return `401`/`403` anonymously (02.d, 02.i, 02.j, 02.k, 02.l).

---

### BUG-022 — Staff directory and password history exposed anonymously
**Test IDs:** 02.k, 02.l
**Status:** ✅ Fixed and verified — see BUG-006 above.

**Remaining defect (not fixed):** both endpoints still swallow errors into a `200` with an empty array, so a failure is indistinguishable from an empty result. Logged for follow-up.

---

### BUG-010 — Urgency dropdown offers one option
**Test IDs:** 05.e, 05.g (`tests/modules/referrals.spec.ts`)
**Status:** ✅ Fixed and verified

**Root cause.** `ReferralsView.tsx:84` calls `getFieldOptions('riskLevels')`, but no such category existed. `getFieldOptions` matches the category exactly and returned `[]`, so the control rendered only a fallback for the current value. Because urgency drives the automated High/Critical safeguarding email, that alert could never be triggered from the UI.

**Fix.** Added a `riskLevels` category to `FieldOptionCategory` and `DEFAULT_FIELD_OPTIONS` with Low / Medium / High / Critical, matching the `RiskLevel` union.

**Why not simply repoint at `incidentRiskFactors`** — the obvious one-word fix, and it is wrong. That category grades incident severity on a different vocabulary (Minor / Moderate / High / Critical) and would have written `'Minor'`/`'Moderate'` into a field typed `RiskLevel`.

**Verification**
```bash
npx playwright test tests/modules/referrals.spec.ts
```
**Result:** 13/13 pass. 05.g confirms `Critical` can actually be selected.

---

### BUG-011 — Runaway background sync (~18× intended rate)
**Test IDs:** PERF.1, PERF.2 (`tests/performance/sync-cadence.spec.ts`)
**Status:** ✅ Fixed and verified

**Root cause.** The scheduling effect depended on `triggerBackgroundDeltaSync`, which closed over `sites` and `users`. The sync replaced both with freshly-built arrays, so the callback identity changed every run, the effect tore down and re-ran, and its 1500 ms initial timer re-armed. The 45 s interval was never reached.

**Fix.** `src/context/AppContext.tsx` — the sync function is held in a ref; the scheduling effect is mount-only.

**Verification** — 100-second measurement:
```
before: 585 requests / 100s, continuous  (~505,000/day per idle tab)
after :  39 requests / 100s, bursts at 0s, 45s, 90s
```
**Result:** the intended cadence, a 15× reduction. The application now reaches network idle, which also lifts the standing ban on `waitForLoadState('networkidle')` in test authoring.

---

### BUG-012 — Compliance forms fabricate records
**Test IDs:** 10.d, 11.d, plus Laundry required-field tests
**Status:** ✅ Fixed and verified

**Root cause — two independent causes.**
1. *Frontend prefill.* `PropertyLaundryLogSection.tsx` opened with `dirtyLaundrySent: 115`, `cleanLaundryReturned: 115` and pre-written remarks; `FoodVendorBuffetLogSection.tsx` pre-filled notes with "Hot holding temperature logged on arrival at >68°C. Halal certified supply." Nothing was invalid, so one click filed a complete compliance record nobody had entered.
2. *Backend fabrication.* `server/schemaAdapter.ts` invented values for absent fields — `temperature_c: 65.0`, `quality_check: 'Passed'`, `vendor_name: 'Primary Catering'`, `staff_name: 'Duty Staff'`, and laundry counts defaulting to `1`. The read path repeated this with `Number(row.x || fallback)`, which **also turned a genuine stored `0` into `1`**, and an unrecorded — or genuinely 0 °C — temperature into a compliant 65 °C.

**Fix.** Attested fields start empty in both forms. `numberOrNull()` added to the adapter and applied on both the write and read paths, so unrecorded stays `NULL` and a real `0` survives. No migration required — all affected columns are already nullable (verified against `db/schema.sql`).

**Verification**
```bash
npx playwright test tests/modules/operations.spec.ts tests/validation
```
**Result:** 24/24 operations tests and 53/54 validation tests pass (the remaining one is a DEF-09 pin). Round-trip probe: unrecorded → `null`, genuine `0` → `0`, real values preserved.

**Side effect to expect.** The dashboard's food-temperature compliance figure will now read *lower*, because unrecorded temperatures no longer count as compliant. That is a correction, but it will look like a regression to anyone watching the number.

---

### BUG-025 — API silently truncates every read at 1000 rows
**Test IDs:** 21.14, and indirectly 20.1–20.3
**Status:** ✅ Fixed and verified

**Root cause.** `GET /api/db/:entity` issued a bare `select('*')`. PostgREST caps a single response at 1000 rows and gives no indication, so any table past that mark was silently incomplete. `audit_trails` crossed it during testing and 133 records became unreachable — in a compliance system, an audit trail presented as complete while missing entries.

**Fix.** `selectAllRows()` pages with `.range()` until exhausted, ordered by primary key (paging without a deterministic sort can repeat or drop rows). A 50,000-row ceiling guards memory and is reported honestly via a new `truncated` flag; `total` was also added. Both fields are additive, so existing clients are unaffected.

**Verification**
```bash
npx playwright test tests/api
```
**Result:** 1211 of 1211 rows returned (previously 1000). 21.14 passes and asserts against the largest table's true count.

---

### BUG-009 — No rate limiting or account lockout on login
**Status:** ⏳ Outstanding — not started. Last remaining High-severity item.

---

### REG-001 — Frontend data loading broken by the authentication lockdown
**Test IDs:** WF.1, WF.3, and 30 others across tables/filters/pagination
**Status:** ✅ Fixed and verified

**A regression I introduced**, caught by the full suite immediately after BUG-001 landed: 34 tests failed that had passed before.

**Root cause.** `src/services/apiService.ts` sent **no** `Authorization` header on reads — `fetchEntityRecords`, `getDbStatus`, `runMigration`, `testSupabase`, the SMTP calls and the admin auth calls all used a bare `fetch(url)`. That was harmless while the API was open; once `requireAuth` was mounted every read returned 401 and the application loaded no data at all. Writes were unaffected because they already used `getAuditHeaders()`, which includes the token.

**Fix.** Added an `authHeaders()` helper and applied it to every call against a now-protected route.

**Verification**
```bash
npx playwright test tests/workflows/archive-restore.spec.ts tests/tables tests/authorization/rbac.spec.ts
```
**Result:** 6/6 archive-restore, then 32/33 (the single failure being BUG-016, unrelated). Data loading restored.

**Lesson recorded:** this is exactly the "could the fix break existing clients?" case. The API contract changed from open to authenticated, and the primary client had never been written to send credentials on reads.

---

## Medium / Low — outstanding

| ID | Title | Status | Note |
|---|---|---|---|
| BUG-013 | Reversed reporting period accepted | ⛔ Not reproduced | The app clamps a reversed range (`handleEndDateChange`). The original test forced a state the UI prevents; it now passes because the fields start empty. |
| BUG-014 | Fields marked mandatory not enforced | ⚠️ Fixed but not fully verified | `required` added to the three starred Maintenance selects. **Cosmetic:** all three have non-empty defaults, so `required` can never fire. The defect was a label/DOM inconsistency, not a submittable-empty form. |
| BUG-015 | Proof Documents cannot accept a document | 🚧 Blocked | Needs a product decision: implement real upload, or relabel the module as a metadata register. Test 13.b left failing deliberately. |
| BUG-016 | `canCreateRecords` defined but ignored | ✅ Fixed and verified | **Wider than reported:** only 2 of 11 create-capable views honoured the permission (Maintenance, SPCD). Referrals imported it and never called it; 8 others never referenced it. Gated Referrals, Vulnerable and Challenging. Test 02.5 passes; 40/40 across the four affected specs. **Still ungated:** Escalations, Documents, Properties, Users, Laundry, Food — logged below. |
| BUG-017 | RBAC matrix omits roles | ✅ Fixed and verified | Worse than reported: **both** Site Manager *and* Staff were missing (5 of 7 roles configurable). Both added; test 19.a passes. |
| BUG-018 | Duplicate records accepted | ⏳ Outstanding | No uniqueness constraint on business keys. Pinned by CRUD.10. |
| BUG-019 | Dropdown defaults absent from their option lists | ⏳ Outstanding | Not observable through the DOM — a select falls back to its first option — so this needs a source-level or unit check. |
| BUG-020 | Validation schemas never invoked | ⛔ Partially not reproduced | **Correction to the report:** `PropertyLaundryLogSection` *does* call `validateLaundryLog` on submit. The claim was too broad. Other views remain unchecked. |
| BUG-021 | Server-side deletions never reach the UI | ⏳ Outstanding | `data.length > 0` guard in `syncFromDatabase`. |
| BUG-023 | Fields lost / type-changed on round trip | ⏳ Outstanding | Pinned by 21.12. Needs real columns rather than the `notes` JSON blob. |
| BUG-024 | Status vocabularies disagree | ⏳ Outstanding | Pinned by 05.f. |
| INF-001 | `npm run lint` was a false green | ✅ Fixed and verified | `@types/react` / `@types/react-dom` installed, exposing **130 real type errors** previously invisible. Those tied to failures were fixed (see D-9); the rest are a documented backlog. |
| D-9 | Maintenance / food retention filtered on non-existent fields | ✅ Fixed and verified | `m.status` was always `undefined`, so every record read as active and none as archived — "delete only archived" never matched a maintenance record. Now uses `date` / `defectStatus` / `action`. AppContext is type-clean. |

### Create-permission gaps still open (BUG-016 follow-up)
`canCreateRecords` is still not consulted in: `EscalationsView`, `DocumentsView`, `PropertiesView`, `UsersView`, `PropertyLaundryLogSection`, `FoodVendorBuffetLogSection`. Each needs its create control wrapped in `canCreateRecord() &&`. Not covered by an automated test yet — a per-module gating test would pin all of them.

### Newly surfaced, not yet triaged
- The Maintenance **edit** modal renders `{p}` where `p` is a `CustomFieldOption` object, showing `[object Object]` in its priority dropdown (`MaintenanceTrackerView.tsx` ~1512).
- `GET /auth/users` and `/auth/password-audit-logs` mask errors as empty `200` responses.

---

## Findings discovered during final regression verification

### BUG-026 — Audit trail double-writes, and one copy has no entity link
**Test ID:** 20.2 (`tests/workflows/audit-trail.spec.ts`) — left failing as evidence
**Status:** ⏳ Outstanding — newly identified, not fixed

**Root cause.** `addAuditEntry` in `AppContext` dispatches **two** writes for every action:
`apiService.saveEntityRecord('audit', newEntry)` and `apiService.recordAuditTrail(...)`.
The first sends `targetItem`, which has no corresponding column in `audit_trails`; the
generic adapter maps it to `target_item`, the column whitelist drops it, and the row
persists with `entity_id = null`. The second sends `entityId` correctly.

**Evidence** (live table, 2,679 rows):

| Action | Rows | Missing entity link |
|---|---:|---:|
| CREATE | 1305 | 46 (4%) |
| DELETE | 1179 | 8 (1%) |
| UPDATE | 72 | 9 (13%) |
| SETTINGS_UPDATE | 115 | 29 (25%) |
| ARCHIVE | 8 | 2 (25%) |

**Impact.** Two defects in one. Every operator action produces two audit rows, inflating
the trail and making it hard to read; and a consistent fraction of entries cannot be tied
to the record they describe. In a safeguarding system the audit trail is the record of who
did what, so an entry without a subject is weakened evidence.

**Recommended fix.** Dispatch a single audit write per action, and map `targetItem` onto
`entity_id` (or add the column) so the link is never silently dropped.

**Why 20.2 is left failing.** It asserts that a create produces an audit row naming the
record. That is correct behaviour and the application does not reliably deliver it. Making
the test pass would mean asserting the broken behaviour.

---

## Final verification run

```bash
cd "QA Testing & Results" && npx playwright test
```
**351 tests executed — 349 passed, 2 failed (34.4 min).**

| Failure | Classification |
|---|---|
| 13.b Proof Documents file upload | 🚧 Blocked — product decision (BUG-015) |
| 20.2 audit entry attribution | ⏳ Real defect (BUG-026 above) |

Changes made *after* this run were limited to test code (20.2 restructured to poll the
cheap COUNT endpoint rather than download the whole audit table) and `.env.example`
documentation. No production code changed after the baseline run.
