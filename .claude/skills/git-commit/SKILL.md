---
name: git-commit
description: Stage and write a conventional commit message that explains why, not just what.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
disable-model-invocation: true
---

# Git Commit

## Trigger
- Changes are ready to commit.
- A commit message needs writing.

## Inputs needed
- The working tree state.
- The intent of the change.

## Procedure
1. Run `git status` and `git diff` to see exactly what is uncommitted.
2. Group unrelated changes into separate commits rather than one mixed commit.
3. Choose the conventional type: feat, fix, refactor, perf, test, docs, chore, build, ci.
4. Write a subject under 72 characters in the imperative mood.
5. Write a body explaining why the change was needed and any consequence.
6. Stage deliberately — never `git add .` without reading what it picks up.

## Checklist
- [ ] Unrelated changes split into separate commits
- [ ] Type and scope correct
- [ ] Subject imperative, under 72 characters, no trailing period
- [ ] Body explains why, not a restatement of the diff
- [ ] Breaking changes marked with `!` and a `BREAKING CHANGE:` footer
- [ ] No secrets, `.env` files or debug output staged

## Output template
```
type(scope): short imperative subject

Why this change was needed and what it affects.

Refs: #123
```

## Do not
- Never commit secrets or generated artefacts.
- Never bundle a refactor with a behaviour change.
