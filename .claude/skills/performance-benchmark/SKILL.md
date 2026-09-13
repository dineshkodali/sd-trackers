---
name: performance-benchmark
description: Profile and benchmark performance, find the bottleneck, and prove the improvement with before and after numbers.
allowed-tools: Read, Grep, Glob, Bash
user-invocable: true
---

# Performance Benchmark

## Trigger
- Pages feel slow or users report it.
- Before release.
- After data volume grew.

## Inputs needed
- A realistic dataset.
- A running instance.
- Profiling tools available.

## Procedure
1. Seed a realistic dataset — measuring against 20 rows tells you nothing about a CRM.
2. Record the baseline: LCP, INP, CLS, API p50/p95/p99, bundle size, and the conditions.
3. Profile to find the actual bottleneck before changing anything.
4. Change one thing — the highest-impact one.
5. Re-measure under identical conditions and report the delta.
6. Repeat only while the measurements justify it.

## Checklist
- [ ] Dataset size and network conditions recorded with every number
- [ ] Baseline captured before any change
- [ ] Bottleneck identified from a profile or query plan, not guessed
- [ ] Percentiles used, never averages
- [ ] One change measured at a time
- [ ] Improvement verified by re-measurement
- [ ] Regression check: nothing else got slower

## Output template
```
**Conditions:** 50k contacts, Fast 3G throttle, cold cache

| Metric | Before | After |
|---|---|---|
| LCP | 4.1s | 1.6s |

**Bottleneck:** <evidence>
**Change:** <what>
**Trade-off:** <cost>
```

## Do not
- Never optimise without a measurement that justified it.
- Never report an improvement you have not re-measured.
