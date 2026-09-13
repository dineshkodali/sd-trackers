---
name: verification-before-completion
description: Prove work is actually done before claiming it. Use before saying something is complete, fixed or passing, and before committing.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
---

# Verification Before Completion

## Trigger
- About to claim a task is finished.
- About to commit or open a PR.
- About to report a fix as working.

## Inputs needed
- The claim being made.
- The commands that would prove it.

## Procedure
1. Write down the specific claim: what is supposedly working now.
2. Identify the command or observation that would falsify it.
3. Run it. Capture the actual output, not a summary from memory.
4. Check the change is actually in the working tree and staged as intended.
5. If any check fails, the work is not complete — return to it rather than caveating.

## Checklist
- [ ] Typecheck run and output captured
- [ ] Lint run and clean
- [ ] Affected tests run and passing
- [ ] The originally failing case verified as now passing
- [ ] Nothing unintended left in the diff — no debug logs, no commented code
- [ ] Claim matches the captured evidence exactly

## Output template
```
**Claim:** <what is done>
**Evidence:**
- `npm run typecheck` → 0 errors
- `npm test -- <path>` → 12 passed
- <manual check> → <observed result>
**Status:** complete / incomplete because <reason>
```

## Do not
- Never claim success from reading code — run something.
- Never report 'should work' as done.
