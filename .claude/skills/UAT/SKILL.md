---
name: uat
description: Run user acceptance testing in business language: test cases, execution, defect triage and sign-off.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
user-invocable: true
---

# User Acceptance Testing

## Trigger
- Before releasing to real users.
- A stakeholder needs to accept delivered work.
- A significant feature is complete.

## Inputs needed
- The acceptance criteria or requirements.
- A staging environment.
- Participant accounts and realistic data.

## Procedure
1. Extract the acceptance criteria from the requirements or tickets.
2. Write test cases in business language: id, scenario, preconditions, steps, expected result.
3. Build a traceability matrix so every requirement maps to at least one case.
4. Prepare realistic CRM data and an account per participant.
5. Execute or facilitate execution; record observed results.
6. Triage defects by business impact into blocking and non-blocking.
7. Produce the sign-off summary with the known-issues list.

## Checklist
- [ ] Every acceptance criterion covered by a case
- [ ] Cases readable by a non-technical stakeholder
- [ ] Realistic scenarios used, not toy data
- [ ] Results observed, never inferred
- [ ] Defects triaged by business impact
- [ ] Sign-off recorded: who accepted what, when

## Output template
```
| ID | Scenario | Steps | Expected | Actual | Result |
|---|---|---|---|---|---|

**Traceability:** REQ-1 → UAT-01, UAT-04 → PASS

**Blocking defects:** <list>
**Recommendation:** accept with known issues
```

## Do not
- No stack traces in a UAT report.
- A case passes only when someone observed the expected result.
