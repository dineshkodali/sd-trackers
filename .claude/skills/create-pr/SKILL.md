---
name: create-pr
description: Write a pull request description and open the PR with the right context for a reviewer.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
disable-model-invocation: true
---

# Create Pull Request

## Trigger
- A branch is ready for review.
- A PR description needs writing.

## Inputs needed
- The branch and its commits.
- The issue or requirement it addresses.

## Procedure
1. Review the full diff against the base branch — `git diff main...HEAD`.
2. Summarise what changed and, more importantly, why.
3. List how you verified it, with the actual commands.
4. Call out anything a reviewer should look at closely, and anything deliberately out of scope.
5. Note migrations, feature flags, environment variables or deploy ordering.
6. Open the PR via the CLI once the description is written.

## Checklist
- [ ] Description explains why, not only what
- [ ] Verification steps included and actually run
- [ ] Migrations and flags called out
- [ ] Breaking changes and rollback noted
- [ ] Screenshots included for UI changes
- [ ] Linked to the issue

## Output template
```
## Summary
<what and why>

## Changes
- ...

## Verification
- `npm test` → passing
- <manual check>

## Deploy notes
- Migration: yes/no — reversible?
- Flags: <name, default>

Closes #123
```

## Do not
- Do not open a PR with failing checks.
- Do not describe the diff line by line — the reviewer can read it.
