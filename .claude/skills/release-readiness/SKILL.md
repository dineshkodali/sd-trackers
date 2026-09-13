---
name: release-readiness
description: Run the final pre-production gate across quality, security, data, performance and operations, ending in a go/no-go.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
---

# Release Readiness

## Trigger
- Before a production release.
- Before enabling a significant flag in production.
- After remediation, to re-check.

## Inputs needed
- The release candidate.
- Outputs from the test and security cycles.
- The migration and rollback plan.

## Procedure
1. Collect evidence per gate — a claim without command output or a link does not count.
2. Verify the migration against production-like volume and lock behaviour.
3. Confirm a backup was taken and is restorable.
4. Confirm flags default to off and the kill switch works.
5. Confirm alerts exist for the failure modes this release introduces.
6. Issue the verdict with specific blockers and what would clear each.

## Checklist
- [ ] Test suite green, changed code covered, no skipped critical tests
- [ ] No open Critical or High security findings
- [ ] No secrets exposed in code or client bundle
- [ ] Migration tested on a production-like copy
- [ ] Backup taken and verified restorable
- [ ] Rollback plan documented and previously executed
- [ ] No performance regression against baseline
- [ ] Monitoring and alerting in place for new failure modes
- [ ] Release notes written
- [ ] Someone available to respond after deploy

## Output template
```
| Gate | Status | Evidence |
|---|---|---|
| Quality | PASS | `npm test` 412 passed |
| Security | FAIL | 1 High open: SEC-04 |

**Blockers**
- SEC-04 — cleared by <action>

**Verdict:** NO-GO
```

## Do not
- Default to NO-GO until every gate has evidence.
- Any open Critical is an automatic NO-GO.
- Never pass a gate on someone's assurance.
