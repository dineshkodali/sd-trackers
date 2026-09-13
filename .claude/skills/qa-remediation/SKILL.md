---
name: qa-remediation
description: Consolidate findings from reviews and tests, fix in priority order, and verify each closure with the check that found it.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
user-invocable: true
---

# QA Remediation

## Trigger
- An audit or test cycle produced a defect list.
- Several reviewers reported overlapping issues.
- Preparing a release.

## Inputs needed
- All finding reports.
- The severity definitions in use.

## Procedure
1. Consolidate into one table; merge duplicates worded differently by different reviewers.
2. Rank by severity and blast radius, not by ease of fixing.
3. Separate release-blocking from follow-up.
4. Fix in order, one finding per commit, targeting the cause.
5. Add a test that fails without each fix.
6. Re-run the originating check to confirm closure, and record the evidence.

## Checklist
- [ ] Duplicates merged, each finding has an id and owner
- [ ] Blocking set called out explicitly
- [ ] Each fix has a regression test
- [ ] Each closure verified by re-running the originating check
- [ ] Deferrals have a written justification and an owner
- [ ] No lint or scanner rule silenced as a fix

## Output template
```
| ID | Finding | Sev | Status | Commit | Verified by |
|---|---|---|---|---|---|
| QA-01 | ... | Critical | Closed | abc1234 | re-ran security-audit |

**Still blocking:** QA-07, QA-09
**Deferred:** QA-12 — <reason, owner>
```

## Do not
- Never close a finding without re-running the check.
- Never downgrade severity to shorten the list.
