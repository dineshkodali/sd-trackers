# QA Testing & Results

All quality-engineering assets for the SafeHaven Operations platform. Nothing in
here is application code, and no application source was modified to produce it.

## Layout

```
QA Testing & Results/
├── playwright.config.ts      Test runner configuration
├── tests/                    326 automated tests in 28 files
│   ├── helpers/              Fixtures and shared helpers (5 files)
│   ├── api/                  API contract tests
│   ├── auth/                 Authentication and session
│   ├── authorization/        RBAC and API authorization
│   ├── crud/                 Full record lifecycle
│   ├── errors/               Error handling and resilience
│   ├── forms/                Create-form schemas
│   ├── modals/               Dialog behaviour
│   ├── modules/              Per-CRM-module suites
│   ├── navigation/           Application shell
│   ├── tables/               Search, filter, sort, pagination
│   ├── validation/           Required fields and business rules
│   └── workflows/            Archive/restore, audit trail
├── qa/results/QA_REPORT.md   Final QA report and release decision
├── specs/test-plan.md        Discovery-based test plan
├── reports/                  Saved HTML copies of the published reports
├── test-results/             Playwright failure artifacts (screenshots, snapshots)
└── seed.spec.ts              Pre-existing empty scaffold (not collected)
```

`test-results/` is regenerated on every run and is a good candidate for
`.gitignore` if these assets are committed.

## Running the tests

**Start the application first.** Playwright attaches to a running instance via
`reuseExistingServer`; auto-spawn is configured as a fallback but is unreliable
on Windows (see the note in `playwright.config.ts`).

```bash
# terminal 1 — from the project root
PORT=3000 OPEN_BROWSER=false DISABLE_HMR=true npm run dev

# terminal 2 — from this folder
cd "QA Testing & Results"
npx playwright test                      # full suite (~30 min, 1 worker)
npx playwright test tests/api            # one directory
npx playwright test tests/crud --headed  # watch it run
npx playwright test tests/auth/login.spec.ts --trace=on --retries=1
```

`DISABLE_HMR=true` matters: Vite's file watcher has crashed with `EBUSY` on
large saved HTML reports sitting in the project root.

## Two rules for writing specs here

1. **Never use `waitForLoadState('networkidle')`.** The application re-syncs
   roughly every 2.4 seconds and never goes idle, so it can never resolve.
2. **Locate row actions by their `title` attribute** (`View Record Details`,
   `Edit Record`, `Archive`, `Delete`). The app ships no `data-testid`, and form
   controls have no `id`/`name` and no `for` on labels, so `getByLabel()` does
   not work. All of that fragility is contained in `tests/helpers/ui.ts` — when
   testids are added, that file is the only one that should need changing.

## Current state

| Metric | Value |
|---|---:|
| Tests | 326 in 28 files |
| Failing | 9 — all confirmed application defects |
| Test-side failures | 0 |
| Release decision | **NOT READY FOR RELEASE** (4 Critical, 8 High) |

Nine tests fail on purpose: they assert correct behaviour that the application
does not yet exhibit. A further 16 tests carry `test.fail()` annotations pinning
known defects — they report green while the bug exists and turn red once it is
fixed, at which point the annotation should be removed.

See `qa/results/QA_REPORT.md` for the full bug list, evidence and release
rationale.

## Test data

Tests run against the live Supabase project; there is no separate test database.
Every created record is prefixed `QA-TEST-` and purged by an auto-fixture after
each test. Records produced by pre-filled forms (BUG-012) carry no such prefix
and must be cleaned up manually — the report explains this.
