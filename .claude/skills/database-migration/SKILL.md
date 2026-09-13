---
name: database-migration
description: Plan and generate a safe database migration with backfill, locking analysis and a tested rollback.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
user-invocable: true
disable-model-invocation: true
---

# Database Migration

## Trigger
- A schema change is needed.
- A constraint or index is being added to a populated table.
- Before applying anything to staging.

## Inputs needed
- The current schema.
- Approximate row counts for affected tables.
- The intended change.

## Procedure
1. Read the current schema and existing migrations before writing anything.
2. Write the change as a new timestamped migration; never edit an applied one.
3. Analyse locking: ALTER TABLE, NOT NULL additions and non-concurrent indexes block writes.
4. For large tables use add-nullable → backfill in batches → add constraint.
5. Add or update RLS policies in the same migration as the table.
6. Write and actually execute the rollback.
7. Regenerate types and run the suite.

## Checklist
- [ ] Migration is a new timestamped file
- [ ] Lock duration estimated against real row counts
- [ ] Backfill batched, not a single statement on a large table
- [ ] Indexes created concurrently where the table is large
- [ ] New foreign keys have an index on the referencing column
- [ ] RLS policies included for new tables
- [ ] Rollback written and executed, not just written
- [ ] Types regenerated
- [ ] Backup taken before production apply

## Output template
```
**Change:** <what and why>
**Up:** <SQL>
**Down:** <SQL or 'not reversible because ...'>
**Rows affected:** ~<n>  **Estimated lock:** <duration>
**Backfill:** <batched approach>
**Verification:** <query to confirm>
```

## Do not
- Never drop a column or narrow a type without a deprecation step.
- Never apply to production without a backup.
- Never create a table without RLS enabled.
