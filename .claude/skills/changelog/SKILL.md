---
name: changelog
description: Generate a changelog from git history in Keep a Changelog format, grouped by user-visible impact.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
disable-model-invocation: true
---

# Changelog

## Trigger
- Cutting a release.
- The changelog is behind.
- Release notes are needed for stakeholders.

## Inputs needed
- The previous release tag.
- Commits since then.

## Procedure
1. Get the commit range: `git log <last-tag>..HEAD --oneline`.
2. Group by impact: Added, Changed, Deprecated, Removed, Fixed, Security.
3. Rewrite each entry in user-facing language — nobody outside the team cares about the refactor.
4. Drop internal noise: chores, formatting, dependency bumps without user effect.
5. Recommend the SemVer bump with the reasoning per change.
6. Note migrations and any action the user must take.

## Checklist
- [ ] Entries written for users, not developers
- [ ] Grouped by Keep a Changelog categories
- [ ] Internal-only commits excluded
- [ ] Breaking changes listed first with the migration step
- [ ] SemVer bump justified
- [ ] Date and version header correct

## Output template
```
## [1.4.0] — 2026-09-14

### Added
- ...

### Fixed
- ...

### Breaking
- ... — to migrate: <step>

**Bump:** minor — <reason>
```

## Do not
- Do not paste raw commit subjects.
- Do not omit a breaking change because it was small.
