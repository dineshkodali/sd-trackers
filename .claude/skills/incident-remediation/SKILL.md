---
name: incident-remediation
description: Respond to a production incident: stabilise first, diagnose second, then write a blameless postmortem.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
user-invocable: true
disable-model-invocation: true
---

# Incident Remediation

## Trigger
- Production is down, degraded or erroring.
- A deploy caused a customer-visible problem.
- Data integrity is at risk.

## Inputs needed
- The alert or report.
- The currently deployed commit.
- Recent deploys and config changes.

## Procedure
1. Declare severity and name one owner.
2. Stabilise before diagnosing: roll back, disable the flag, or fail over.
3. Preserve evidence — logs, traces, metrics, deployed SHA — before any cleanup.
4. Update stakeholders on a fixed cadence, even with nothing new to report.
5. Once stable, diagnose the root cause properly.
6. Fix through the normal review and test path, never directly in production.
7. Write the postmortem and convert every action item into an owned ticket.

## Checklist
- [ ] Severity declared and owner named
- [ ] Service stabilised before deep debugging
- [ ] Evidence preserved before cleanup
- [ ] Impact quantified: how many users, how long, what data
- [ ] Root cause identified, not just the trigger
- [ ] Permanent fix reviewed and tested normally
- [ ] Detection gap addressed so it is caught faster next time
- [ ] Postmortem written within a few days

## Output template
```
**Severity:** SEV-2  **Owner:** <name>
**Timeline**
- 14:02 detected — ...
- 14:09 mitigated by rollback
**Impact:** ~<n> users, <duration>, <data affected>
**Root cause:** <one sentence>
**Actions**
- [ ] <action> — owner — date
```

## Do not
- Never debug at length while customers are down — stabilise first.
- Blameless means describing systems and decisions, never naming people at fault.
- If customer data was exposed or lost, escalate immediately — notification may be legally required.
