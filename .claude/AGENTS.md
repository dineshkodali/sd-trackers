# Agent index

40 agents. Invoke by name, or let Claude Code select on the `description` field.

| Category | Agent | Purpose |
|---|---|---|
| Orchestration | `crm-lead` | Plans multi-step work and delegates to specialist sub-agents. |
| Development | `fullstack-dev` | Implements features end to end across UI, API and database. |
| Development | `react-pro` | React specialist for component architecture, hooks, rendering performance and state management. |
| Development | `typescript-pro` | TypeScript specialist for type design, generics, strictness and eliminating unsafe casts. |
| Development | `backend-architect` | Designs server-side structure: service boundaries, data flow, background jobs, idempotency and failure handling. |
| Development | `api-developer` | Designs and builds REST endpoints and Edge Functions: contracts, validation, versioning, pagination and errors. |
| Development | `design-system-engineer` | Owns design tokens, shared components, variants and states. |
| Development | `migration-specialist` | Plans and executes framework upgrades, dependency major bumps and large refactors with minimal risk. |
| Architecture | `code-explorer` | Traces how an existing feature actually works — execution path, layers, dependencies. |
| Architecture | `code-architect` | Produces an implementation blueprint for a feature: files to create and modify, following existing repo conventions. |
| Data | `supabase-engineer` | Builds Supabase schema, migrations, RLS policies, functions, triggers and Edge Functions. |
| Data | `database-expert` | Reviews and tunes schema design, indexes, query plans and migration safety. |
| Data | `data-import-engineer` | Handles CRM data import, export, deduplication and third-party sync. |
| Data | `ai-engineer` | Builds LLM features in the CRM — summarisation, lead scoring, email drafting, search over notes — with evaluation and cost control. |
| Quality & Testing | `code-reviewer` | Reviews a diff for correctness, security and maintainability. |
| Quality & Testing | `debugger` | Root-cause debugging for errors, test failures and unexpected behaviour. |
| Quality & Testing | `test-automator` | Builds test suites across unit, integration and e2e levels, and decides what belongs at which level. |
| Quality & Testing | `api-tester` | Tests endpoints for contract correctness, validation, authorisation and error handling. |
| Quality & Testing | `frontend-tester` | Tests UI behaviour in the browser: forms, async states, navigation and responsive layout. |
| Quality & Testing | `regression-tester` | Confirms existing functionality still works after a change and pinpoints what broke. |
| Quality & Testing | `smoke-tester` | Fast post-deploy sanity check of critical paths. |
| Quality & Testing | `accessibility-expert` | Audits against WCAG 2. |
| Quality & Testing | `performance-optimizer` | Profiles and improves frontend and backend performance with measurements before and after. |
| Quality & Testing | `playwright-test-planner` | Plans e2e coverage: which journeys to automate, at what level, with what data. |
| Quality & Testing | `playwright-test-generator` | Writes deterministic Playwright tests from specs or a described journey. |
| Quality & Testing | `playwright-test-healer` | Diagnoses and repairs failing or flaky Playwright tests without masking real bugs. |
| Security | `security-auditor` | Static security review of code, config, dependencies and secrets against OWASP Top 10. |
| Security | `security-pentester` | Actively tests a running non-production instance for exploitable access-control and logic flaws. |
| Security | `rls-security-reviewer` | Audits Row Level Security for tenant isolation and privilege escalation. |
| Security | `auth-reviewer` | Reviews authentication and authorisation: sessions, tokens, roles, invites and protected routes. |
| Infrastructure | `deployment-engineer` | Reviews and builds CI/CD pipelines, gates and release automation. |
| Infrastructure | `aws-amplify-reviewer` | Reviews AWS Amplify hosting: build settings, environment variables, redirects, domains and headers. |
| Infrastructure | `observability-engineer` | Adds meaningful metrics, logs, traces, dashboards and alerts that surface real signal. |
| Infrastructure | `incident-responder` | Runs production incidents: triage, stabilise, communicate, then blameless postmortem. |
| Business | `product-manager` | Turns a request into a scoped problem statement, user stories and acceptance criteria. |
| Business | `uat-manager` | Runs user acceptance testing: business-language test cases, execution, defect triage and sign-off. |
| Business | `technical-writer` | Writes and maintains developer and user documentation: READMEs, runbooks, API docs, CLAUDE. |
| Release | `qa-remediation` | Consolidates findings from reviewers and testers, fixes them in priority order, and verifies each closure. |
| Release | `production-readiness` | Final pre-production gate across quality, security, data, performance and operations. |
| Release | `release-manager` | Coordinates the release: versioning, changelog, deploy sequencing, and post-release verification. |


---

# Skill index

24 skills in `.claude/skills/<name>/SKILL.md`. Each registers as a slash command of the same name.
Skills marked manual-only carry `disable-model-invocation: true` — Claude will not fire them on its own.

| Command | Purpose |
|---|---|
| `/code-review` | Review a diff for correctness, security and maintainability with actionable, prioritised feedback. |
| `/systematic-debugging` | Reproduce, isolate and root-cause a bug before proposing any fix. |
| `/verification-before-completion` | Prove work is actually done before claiming it. |
| `/test-generation` | Generate a test suite with unit, integration and edge-case coverage at the right level for each behaviour. |
| `/git-commit` | Stage and write a conventional commit message that explains why, not just what. |
| `/create-pr` | Write a pull request description and open the PR with the right context for a reviewer. |
| `/changelog` | Generate a changelog from git history in Keep a Changelog format, grouped by user-visible impact. |
| `/release-readiness` | Run the final pre-production gate across quality, security, data, performance and operations, ending in a go/no-go. |
| `/qa-remediation` | Consolidate findings from reviews and tests, fix in priority order, and verify each closure with the check that found it. |
| `/incident-remediation` | Respond to a production incident: stabilise first, diagnose second, then write a blameless postmortem. |
| `/security-audit` | Run a comprehensive security audit covering OWASP Top 10, dependency vulnerabilities, secrets detection and injection risk. |
| `/rls-audit` | Audit Supabase Row Level Security for tenant isolation, missing WITH CHECK clauses and privilege escalation paths. |
| `/deps-audit` | Audit dependencies for vulnerabilities, abandonment, bloat and licence problems. |
| `/database-migration` | Plan and generate a safe database migration with backfill, locking analysis and a tested rollback. |
| `/sql-optimizer` | Analyse a slow query, explain its plan, and fix it with an index or rewrite — with before and after timings. |
| `/api-testing` | Test endpoints for contract correctness, validation, authorisation and error handling. |
| `/webapp-testing` | End-to-end testing of flows in a real browser — click, fill, assert, screenshot — before declaring a feature done. |
| `/regression` | Confirm existing functionality still works after a change and pinpoint exactly what broke. |
| `/accessibility` | Audit and fix an interface against WCAG 2. |
| `/performance-benchmark` | Profile and benchmark performance, find the bottleneck, and prove the improvement with before and after numbers. |
| `/uat` | Run user acceptance testing in business language: test cases, execution, defect triage and sign-off. |
| `/architecture-diagram` | Generate Mermaid diagrams of system architecture, data flow and component relationships from the codebase. |
| `/api-docs` | Analyse endpoints in the codebase and generate OpenAPI documentation that matches the actual implementation. |
| `/env-setup` | Detect the project stack and get a local development environment running from a clean checkout. |
