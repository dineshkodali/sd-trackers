---
name: env-setup
description: Detect the project stack and get a local development environment running from a clean checkout.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
user-invocable: true
disable-model-invocation: true
---

# Project Environment Setup

## Trigger
- Onboarding a new developer.
- Setup instructions are stale or broken.
- A clean checkout will not run.

## Inputs needed
- The repository.
- Which services it depends on.

## Procedure
1. Detect the stack: package manager, runtime versions, frameworks, database, test runner.
2. List every required tool with its version, and every required environment variable.
3. Work through setup from a clean state, fixing the instructions as you go.
4. Get the database running with migrations applied and seed data loaded.
5. Run the test suite and confirm it passes on a fresh machine.
6. Update the README with what actually worked.

## Checklist
- [ ] Runtime versions pinned and documented
- [ ] Every environment variable listed, with a `.env.example`
- [ ] No real secret committed — placeholders only
- [ ] Database runs locally with migrations and seed data
- [ ] Test suite passes from clean
- [ ] Dev server starts and the app loads
- [ ] README updated with the corrected steps

## Output template
```
**Stack:** <detected>
**Required:** node 20, pnpm 9, docker
**Environment variables:** <list, with which are required>
**Steps that were wrong:** <what you fixed>
**Verified:** install → migrate → seed → test → dev
```

## Do not
- Never commit a real secret into `.env.example`.
- Never mark setup done without running the suite from clean.
