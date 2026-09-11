---
name: qa-remediation
description: Quality assurance and defect remediation skill. Provides test-driven workflows for reproducing application bugs, validating code fixes, asserting regression guardrails, and compiling dated HTML verification reports.
---

# QA Remediation & Defect Resolution Skill

Use this skill when investigating bugs, creating minimal reproductions, validating engineering remedies, and publishing release reports.

---

## The 4-Step Remediation Workflow

```
1. REPRODUCE
   └─ Write minimal failing test in test-templates/05_remediation_regression_template.spec.ts
      Assert expected behavior before applying the fix.

2. REMEDY
   └─ Apply targeted code fix in backend server or frontend component.
      Avoid unnecessary refactoring or scope creep.

3. VERIFY
   └─ Run the test suite: verify failing test turns green.
      Verify existing test suites still pass with zero regressions.

4. LOG & REPORT
   └─ Record entry in REMEDIES_AND_RESOLUTIONS.md.
      Run `npm run test:qa:report` to generate dated HTML report.
```

---

## Key Artifacts

- **Playbook**: `QA Testing & Results/REMEDIES_AND_RESOLUTIONS.md`
- **Dated Reports**: `QA Testing & Results/reports/YYYY-MM-DD_qa_test_report.html`
- **Templates**: `QA Testing & Results/test-templates/`
- **Commands**:
  ```bash
  npm run test:qa:report    # Generate dated HTML report
  npm run db:coverage       # Verify database page coverage
  ```
