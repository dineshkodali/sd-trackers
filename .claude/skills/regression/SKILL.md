---
name: regression
description: Confirm existing functionality still works after a change and pinpoint exactly what broke.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
---

# Regression Testing

## Trigger
- Before a release.
- After a refactor, dependency bump or infra change.
- After a fix on a shared path.

## Inputs needed
- The baseline: last known-good run or main.
- The diff under test.

## Procedure
1. Establish the baseline and record it.
2. Run the full suite; capture the result.
3. Re-run failures in isolation to separate real breaks from flakes.
4. Bisect each real failure to the commit that introduced it.
5. Manually check the core journeys the diff touches, even where tests exist.
6. Verify permissions did not silently widen during the change.

## Checklist
- [ ] Core journeys verified: sign in, create contact, create deal, move stage, log activity, search, export
- [ ] Full suite run against the change
- [ ] Every failure classified as regression or flake
- [ ] Flakes logged as defects rather than ignored
- [ ] Each regression bisected to a commit
- [ ] No test skipped or deleted to produce a green run
- [ ] Changed areas without coverage identified

## Output template
```
**Suite:** 412 passed, 3 failed, 2 flaky

**Regressions**
- `deal.spec.ts:moves stage` — first failing: abc1234 — likely <cause>

**Flakes:** <test> — <why>
**Untested risk:** <area>
```

## Do not
- Never skip or delete a test to get green.
- Never dismiss a flake as noise.
