# CRM `.claude/` pack — v2

**40 sub-agents** and **24 skills** for a CRM codebase, covering development, architecture,
data, testing, e2e, security, infrastructure, business and release.

Rebuilt from v1 using the Claude Directory agent and skill catalogues as a coverage map,
then checked against the current Claude Code docs.

## Install

Unzip so the folder sits at the root of your repo:

```
your-crm-project/
├── .claude/
│   ├── agents/       # 40 sub-agents, grouped in numbered folders
│   ├── skills/       # 24 skills, each a folder with SKILL.md
│   ├── AGENTS.md     # index
│   └── README.md
├── src/
└── package.json
```

Sub-agents are loaded at session start — restart Claude Code, or run `/agents` to pick them
up immediately. Skills register as slash commands named after the folder: `/code-review`,
`/rls-audit`, `/release-readiness`.

If you already have a `.claude/`, merge the `agents/` and `skills/` contents rather than
replacing the directory.

## Using it

```
> use crm-lead to plan adding deal-stage history
> ask rls-security-reviewer to check the new activities table
> /security-audit
> /release-readiness 1.4.0
```

`crm-lead` is the orchestrator — start there for anything multi-step. Every agent file ends
with a **Handoff** line naming who takes the work next, so chains form without you
choreographing each step.

## What changed from v1

**Format.** Every agent now has: Triggers → Operating procedure → Domain checklist →
Output contract → Guardrails → Handoff. v1 had no triggers and no handoffs, which meant
agents were selected by guesswork and never passed work on.

**Descriptions are trigger text.** Claude Code routes on the `description` field, so each
one names the situation that should invoke it, not the job title.

**Skills are now executable, not advisory.** Each has Trigger, Inputs needed, Procedure,
Checklist, a literal Output template, and a Do-not list.

**No duplicate `commands/` folder.** `.claude/commands/x.md` and `.claude/skills/x/SKILL.md`
both register `/x` in current Claude Code — the two systems merged. Skills only, to avoid
the collision.

**Invocation control.** Skills with side effects (`git-commit`, `create-pr`, `changelog`,
`database-migration`, `incident-remediation`, `env-setup`) carry
`disable-model-invocation: true`, so Claude will not fire them on its own — you invoke them
by slash command. The rest auto-trigger on relevance.

**Coverage added.** Roles v1 was missing: `code-explorer`, `code-architect`,
`backend-architect`, `api-developer`, `react-pro`, `typescript-pro`, `migration-specialist`,
`data-import-engineer`, `ai-engineer`, `observability-engineer`, `product-manager`,
`technical-writer`. Workflow skills added: commit, PR, changelog, dependency audit,
SQL optimisation, architecture diagrams, API docs, environment setup, plus
`verification-before-completion`, which forces evidence before any "it works" claim.

## Model assignment

`opus` for judgment-heavy work (security, architecture, release gates, incidents),
`sonnet` for implementation and testing, `haiku` for the smoke tester. Change or delete the
`model:` line to inherit the main session's model.

## Tool scoping

Reviewers and auditors have no `Edit` or `Write` — they report, they don't change your code.
Widen `tools:` only where you want that agent editing. Read-only agents:
`code-explorer`, `code-architect`, `code-reviewer`, `database-expert`, `security-auditor`,
`security-pentester`, `rls-security-reviewer`, `auth-reviewer`, `aws-amplify-reviewer`,
`accessibility-expert`, `performance-optimizer`, `playwright-test-planner`.

## Before you rely on it

The stack assumed is Supabase + React/TypeScript + AWS Amplify + Playwright + GitHub Actions.
If yours differs, edit `supabase-engineer`, `rls-security-reviewer`, `aws-amplify-reviewer`
and the three `playwright-*` agents — those are the stack-specific ones. Everything else is
portable.

Two optional frontmatter fields worth knowing, left out here for version-compatibility:
`skills: <name>` preloads a skill into an agent's context, and `context: fork` runs a skill
in an isolated subagent. Both are useful once you've confirmed your Claude Code version
handles them.

## Reference

- Sub-agents: https://code.claude.com/docs/en/subagents
- Claude Code docs: https://docs.claude.com/en/docs/claude-code/overview
- Source catalogues used for coverage: claudedirectory.org `/agents` and `/skills`
  (an independent community directory, not affiliated with Anthropic)
