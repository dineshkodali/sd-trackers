# QA Test Templates & Execution Guide

This directory provides standardized, production-grade test templates for the SD Operations Platform. Every template contains boilerplate, fixture setup, assertion helpers, and teardown logic.

---

## Template Index

| Template File | Scope / Purpose | Execution Speed | Key Assertions |
| :--- | :--- | :---: | :--- |
| [`01_api_contract_test_template.spec.ts`](./01_api_contract_test_template.spec.ts) | Backend API endpoints & schemas | Fast (~1s) | HTTP status, payload JSON schema, pagination, error responses |
| [`02_module_crud_test_template.spec.ts`](./02_module_crud_test_template.spec.ts) | UI CRUD workflows for CRM modules | Normal (~5s) | Form validation, row creation, table search, edit modal, delete |
| [`03_rbac_authorization_test_template.spec.ts`](./03_rbac_authorization_test_template.spec.ts) | Role-Based Access Control (RBAC) | Normal (~4s) | Button visibility, route guards, API 403 enforcement per role |
| [`04_security_pentest_template.spec.ts`](./04_security_pentest_template.spec.ts) | Penetration testing & vulnerability audits | Fast (~3s) | SQLi payloads, XSS rendering, IDOR tampering, RLS bypass |
| [`05_remediation_regression_template.spec.ts`](./05_remediation_regression_template.spec.ts) | Bug fix verification & regression guards | Fast (~2s) | Defect reproduction, post-remedy assertion, fix sign-off |
| [`06_performance_load_template.spec.ts`](./06_performance_load_template.spec.ts) | UI render speed & API load latency | Normal (~4s) | TTFB, batch-read efficiency, debounce intervals, table FPS |

---

## How to Run Tests & Generate Dated HTML Reports

### 1. Run Tests with Automated Dated HTML Report
To run the test suite and automatically generate a timestamped HTML report saved directly into `QA Testing & Results/reports/YYYY-MM-DD_qa_test_report.html`:

```bash
# Run full suite and generate dated HTML report
npm run test:qa:report

# Or run specific test groups with the report generator
npx tsx scripts/generate-qa-report.ts --grep "api"
npx tsx scripts/generate-qa-report.ts --grep "security"
```

### 2. Run Individual Suites Directly via Playwright
Make sure the app server is running (`npm run dev`), then execute:

```bash
# Navigate to QA directory
cd "QA Testing & Results"

# Run all tests headlessly
npx playwright test

# Run a specific template or test file
npx playwright test test-templates/01_api_contract_test_template.spec.ts
npx playwright test test-templates/04_security_pentest_template.spec.ts

# Watch tests interactively in headed browser mode
npx playwright test test-templates/02_module_crud_test_template.spec.ts --headed

# Debug a failing test step-by-step
npx playwright test test-templates/05_remediation_regression_template.spec.ts --debug
```

---

## Two Golden Rules for Playwright Tests in SD Tracker

1. **Never use `page.waitForLoadState('networkidle')`**:
   The application background sync polls live Supabase updates every few seconds. `networkidle` will timeout. Instead, wait for a specific DOM selector:
   ```ts
   await expect(page.locator('table')).toBeVisible();
   ```

2. **Locate row actions by `title` attribute or test ID**:
   Action buttons carry descriptive titles (`title="View Record Details"`, `title="Edit Record"`, `title="Archive"`, `title="Delete"`).
