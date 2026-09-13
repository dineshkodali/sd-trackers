---
name: api-testing
description: Test endpoints for contract correctness, validation, authorisation and error handling.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
user-invocable: true
---

# API Testing

## Trigger
- An endpoint was added or changed.
- Before a release.
- A client reports unexpected API behaviour.

## Inputs needed
- Route definitions.
- A running instance with seeded data.
- Test accounts in two tenants.

## Procedure
1. Enumerate endpoints from the route definitions, not the documentation.
2. For each: happy path, asserting on the response shape and not just the status.
3. Test boundaries: empty, null, wrong type, maximum length, extra fields, unicode.
4. Test the auth matrix: anonymous, wrong tenant, wrong role, correct role.
5. Test pagination at first, last and out-of-range pages.
6. Retry a write to check idempotency.
7. Leave runnable test files behind and clean up created records.

## Checklist
- [ ] Every endpoint has a happy-path and a validation-failure case
- [ ] Anonymous requests rejected on protected endpoints
- [ ] Cross-tenant requests rejected
- [ ] Bad input returns 4xx, never 5xx
- [ ] Error envelope consistent across endpoints
- [ ] No stack traces or SQL in error bodies
- [ ] Pagination correct at the boundaries
- [ ] Test data cleaned up

## Output template
```
| Endpoint | Cases | Result |
|---|---|---|
| POST /contacts | 9 | 8 pass, 1 fail |

**Failures**
- POST /contacts with `name: null` → 500, expected 400

**Files:** tests/api/contacts.spec.ts   **Run:** `<command>`
```

## Do not
- Never test against production.
- A 500 on bad input is a failure, not a pass.
