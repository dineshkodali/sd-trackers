---
name: webapp-testing
description: Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, avoiding networkidle traps, and viewing browser logs.
---

# Web Application Testing Skill (Anthropic Agent Skills Standard)

This skill provides operational patterns for writing, running, and maintaining Playwright tests against local web applications.

## Golden Rules for SD Tracker Webapp Testing

1. **Avoid `page.waitForLoadState('networkidle')`**:
   The SD Tracker application maintains background sync polling with Supabase every few seconds. `networkidle` will indefinitely wait or time out. Instead, wait for deterministic DOM landmarks:
   ```ts
   // Correct:
   await expect(page.locator('table')).toBeVisible();
   await expect(page.getByRole('dialog')).toBeVisible();
   
   // Incorrect (will timeout):
   await page.waitForLoadState('networkidle');
   ```

2. **Locate Interactive Elements by Title or Role**:
   Buttons in tables have descriptive accessibility titles:
   ```ts
   // Correct:
   const editBtn = row.locator('button[title="Edit Record"]');
   const viewBtn = row.locator('button[title="View Record Details"]');
   const deleteBtn = row.locator('button[title="Delete"]');
   ```

3. **Session Injection & Direct Route Navigation**:
   Use `injectSession(context)` and `gotoModule(page, 'referrals')` from `tests/helpers/ui.ts` rather than manually clicking through the login form on every test.

---

## Decision Tree: Choosing Your Approach

```
Test Goal
  │
  ├─ Is it a REST API or Schema test?
  │   └─ Use: test-templates/01_api_contract_test_template.spec.ts
  │
  ├─ Is it an End-to-End User Journey (Create/Edit/Delete)?
  │   └─ Use: test-templates/02_module_crud_test_template.spec.ts
  │
  ├─ Is it Role-Based Access or Permissions (RBAC)?
  │   └─ Use: test-templates/03_rbac_authorization_test_template.spec.ts
  │
  ├─ Is it Vulnerability / Injection / Security testing?
  │   └─ Use: test-templates/04_security_pentest_template.spec.ts
  │
  └─ Is it verifying a bug fix or remediation?
      └─ Use: test-templates/05_remediation_regression_template.spec.ts
```

---

## Test Execution Commands

```bash
# Run all tests headlessly
npx playwright test

# Run tests matching a specific pattern
npx playwright test --grep "API Contract"
npx playwright test --grep "PENTEST"

# Run in headed mode with visual browser
npx playwright test tests/crud --headed

# Run and automatically generate dated HTML report
npm run test:qa:report
```
