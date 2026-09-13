---
name: sql-optimizer
description: Analyse a slow query, explain its plan, and fix it with an index or rewrite — with before and after timings.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
---

# SQL Query Optimizer

## Trigger
- A query is slow.
- A page is slow and the database is suspected.
- After data volume grew.

## Inputs needed
- The query.
- Realistic row counts.
- Database access for EXPLAIN.

## Procedure
1. Confirm the data volume is realistic — a plan at 1k rows says nothing about 5M.
2. Run EXPLAIN (ANALYZE, BUFFERS) and read the actual plan, not the estimate.
3. Identify the cost driver: sequential scan, nested loop on a large set, sort spilling to disk, bad row estimate.
4. Try the index first; try the rewrite second; consider denormalisation last.
5. Re-run EXPLAIN ANALYZE and report the before and after timings.
6. Check the new index does not duplicate an existing one.

## Checklist
- [ ] Plan captured before any change
- [ ] Row counts stated
- [ ] Cost driver identified from the plan, not guessed
- [ ] Index choice justified — column order matters for composite indexes
- [ ] After-timing measured under the same conditions
- [ ] No duplicate or redundant index introduced
- [ ] Write-throughput cost of the new index acknowledged

## Output template
```
**Query:** <summary>
**Before:** <n> ms — <plan summary>
**Cause:** <e.g. seq scan on contacts (2.1M rows)>
**Change:** <index or rewrite>
**After:** <n> ms — <plan summary>
**Trade-off:** <write cost, size>
```

## Do not
- Never add an index without measuring the improvement.
- Never optimise a query nobody runs often.
