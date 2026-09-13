---
name: rls-audit
description: Audit Supabase Row Level Security for tenant isolation, missing WITH CHECK clauses and privilege escalation paths.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
---

# RLS Audit

## Trigger
- Any table, policy, view or security definer function changed.
- Before release.
- Validating multi-tenant isolation.

## Inputs needed
- Database access or the migration files.
- Two test users in different tenants, ideally.

## Procedure
1. List every table with its RLS status; flag any with RLS off.
2. For each policy, write out in words exactly who it permits to do what.
3. Check every INSERT and UPDATE policy has a WITH CHECK clause, not only USING.
4. Check policies filter on `auth.uid()` or JWT claims, never on a client-supplied column.
5. Trace `security definer` functions and what they do with caller input.
6. Attempt cross-tenant read and write with a second user and record the result.
7. Check storage bucket policies enforce the same isolation.

## Checklist
- [ ] RLS enabled on every table
- [ ] Policies present for SELECT, INSERT, UPDATE and DELETE
- [ ] WITH CHECK on every write policy
- [ ] Cross-tenant read attempted and blocked
- [ ] Cross-tenant write attempted and blocked
- [ ] Anonymous access to tenant data blocked
- [ ] Views and materialised views checked for RLS bypass
- [ ] Service-role key confirmed unreachable from client code
- [ ] Storage policies match table policies

## Output template
```
| Table | RLS | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| contacts | on | ✓ | ✓ (no WITH CHECK) | ✓ | ✓ |

**Critical**
- `contacts` INSERT policy has no WITH CHECK — a user can insert into another tenant.
  Proof: `insert into contacts (account_id) values ('<other-tenant>')` succeeds.
  Fix: <corrected SQL>
```

## Do not
- A table with RLS disabled is Critical — never downgrade it as 'internal'.
- 'The frontend filters it' is never mitigation.
- Do not report a gap you have not traced through the real policy text.
