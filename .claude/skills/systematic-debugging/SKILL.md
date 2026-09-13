---
name: systematic-debugging
description: Reproduce, isolate and root-cause a bug before proposing any fix. Use PROACTIVELY on any error, test failure or unexpected behaviour.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
user-invocable: true
---

# Systematic Debugging

## Trigger
- An error, exception or stack trace.
- A failing or flaky test.
- Behaviour differs between environments.

## Inputs needed
- The exact error text and stack trace.
- Steps that trigger it.
- Which environment it occurs in.

## Procedure
1. Capture the real error, not the wrapper message.
2. Reproduce deterministically. If you cannot, state what you would need and stop.
3. Form one hypothesis and test it with a log, breakpoint or narrowed test — one at a time.
4. Bisect if needed: recent commits, flags, environment differences.
5. State the root cause in one sentence with file:line evidence before writing any code.
6. Apply the minimal fix, add a regression test, re-run the suite.

## Checklist
- [ ] Reproduced before anything was changed
- [ ] Root cause stated in one sentence with evidence
- [ ] Fix is minimal and targets the cause
- [ ] A test now fails without the fix
- [ ] Full suite re-run and green

## Output template
```
**Symptom:** <what the user sees>
**Reproduction:** <steps or command>
**Root cause:** <one sentence> (path/file.ts:88)
**Fix:** <what changed and why it is minimal>
**Regression test:** <path>
```

## Do not
- Never patch a symptom without labelling it a workaround.
- Never refactor mid-debug.
- Never add a retry or timeout to make a failure disappear.
