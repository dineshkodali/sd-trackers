---
name: test-generation
description: Generate a test suite with unit, integration and edge-case coverage at the right level for each behaviour.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
user-invocable: true
---

# Test Generation

## Trigger
- A feature has no tests.
- Coverage is thin on a critical path.
- A bug was fixed without a guard.

## Inputs needed
- The code or feature to cover.
- The existing test framework and conventions.

## Procedure
1. Read the existing suite and match its conventions exactly.
2. List the behaviours to cover and decide the level for each — most belong in unit tests.
3. Write tests asserting on behaviour, not implementation detail.
4. Cover edges: empty, boundary, error, permission-denied, concurrent.
5. Verify each test fails with the implementation removed, then run the suite twice.

## Checklist
- [ ] Level chosen deliberately per behaviour
- [ ] Each test independent and parallel-safe
- [ ] Fixtures or factories used instead of copy-pasted setup
- [ ] Edge cases covered, not just the happy path
- [ ] Every test proven to fail without the code
- [ ] Suite runtime still acceptable

## Output template
```
**Tests added**
- path — level — behaviour covered

**Coverage delta:** <before> → <after> on changed lines
**Gaps left:** <what and why acceptable>
**Run:** `<command>`
```

## Do not
- Do not write tests that pass with the implementation deleted.
- Do not put in e2e what a unit test can cover.
