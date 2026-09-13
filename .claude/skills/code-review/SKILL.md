---
name: code-review
description: Review a diff for correctness, security and maintainability with actionable, prioritised feedback. Use before opening a PR or after any code change.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
---

# Code Review

## Trigger
- Code was just written or changed.
- Before opening a pull request.
- A PR needs reviewing.

## Inputs needed
- The diff (`git diff`, `git diff main...HEAD`, or a PR reference).
- The intent of the change.

## Procedure
1. Scope to the diff; read each changed file in full plus its direct callers.
2. Check correctness first: null handling, async races, error paths, boundary conditions.
3. Check security: input validation, access control, secrets, injection, PII in logs.
4. Check it matches existing repo conventions rather than importing a new pattern.
5. Run typecheck, lint and the affected tests.
6. Write each finding as file:line, risk, and a concrete suggested fix.

## Checklist
- [ ] Every finding has a file:line and a suggested fix
- [ ] Findings ranked Critical / High / Medium / Low
- [ ] Tests present and failing without the change
- [ ] No style nitpicks a formatter already owns
- [ ] Merge recommendation stated in one line

## Output template
```
## Review: <branch or PR>

**Critical**
- path/file.ts:42 — <risk> — <fix>

**High** / **Medium** / **Low**
- ...

**Recommendation:** merge / merge after fixes / rework
```

## Do not
- Do not review files the diff did not touch, unless risk spreads there — then say why.
- Do not manufacture findings when the diff is clean.
