---
name: deps-audit
description: Audit dependencies for vulnerabilities, abandonment, bloat and licence problems.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
---

# Dependency Audit

## Trigger
- Before a release.
- A vulnerability alert arrived.
- The bundle has grown or install is slow.

## Inputs needed
- The manifest and lockfile.
- The bundle analysis, if available.

## Procedure
1. Run the ecosystem audit command and capture the full output.
2. Triage each vulnerability by whether the vulnerable path is actually reachable here.
3. Check maintenance health: last publish, open issue count, single-maintainer risk.
4. Identify duplicate or overlapping packages doing the same job.
5. Check licences against what the project can accept.
6. Propose upgrades in order of risk, noting which are breaking.

## Checklist
- [ ] Audit run and output captured
- [ ] Each vulnerability triaged by real reachability, not CVSS alone
- [ ] Abandoned or single-maintainer critical dependencies flagged
- [ ] Duplicate packages identified
- [ ] Licences checked
- [ ] Upgrade plan ordered, with breaking changes marked

## Output template
```
**Vulnerabilities**
| Package | Severity | Reachable? | Fix |
|---|---|---|---|

**Health concerns:** <pkg> — last published <date>
**Removable:** <pkg> — duplicated by <pkg>

**Upgrade order**
1. ... (breaking: no)
```

## Do not
- Do not blanket-upgrade everything in one commit.
- Do not report a CVE as critical without checking the code path is reachable.
