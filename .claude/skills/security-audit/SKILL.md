---
name: security-audit
description: Run a comprehensive security audit covering OWASP Top 10, dependency vulnerabilities, secrets detection and injection risk.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
---

# Security Audit

## Trigger
- Before a production release.
- After changes to auth, permissions or data access.
- After adding a dependency or integration.

## Inputs needed
- Repository access.
- The dependency manifest and lockfile.
- Deployment configuration.

## Procedure
1. Map the attack surface: entry points, trust boundaries, data stores, external calls.
2. Grep for hardcoded secrets, raw SQL concatenation, `eval`, unsafe HTML, service-role keys in client code.
3. Review access control on every mutating endpoint — broken access control is the most common real finding.
4. Run the dependency audit; triage by exploitability here, not CVSS alone.
5. Review configuration: security headers, CORS, cookie flags, storage policies.
6. Audit PII handling: what is logged, cached, exported or sent to analytics.
7. Write each finding with file:line, impact and a concrete fix.

## Checklist
- [ ] No secrets in the repo or reachable from the client bundle
- [ ] Authorisation enforced server-side on every protected action
- [ ] All user input validated server-side, output encoded
- [ ] No known-exploitable dependency vulnerabilities
- [ ] Security headers set; cookies HttpOnly, Secure, SameSite
- [ ] Rate limiting on authentication endpoints
- [ ] File uploads type-checked, size-limited, served safely
- [ ] No PII in logs or third-party analytics

## Output template
```
**Posture:** <three lines>

**Critical**
- path/file.ts:31 — <issue> — impact — fix

**High / Medium / Low**
- ...

**Dependencies:** <pkg@ver> — <CVE> — upgrade path

**Release blockers:** SEC-01, SEC-04
```

## Do not
- Never print a discovered secret in full — mask it and state where it lives.
- No generic checklists — every finding needs evidence from this repository.
