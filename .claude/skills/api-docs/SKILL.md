---
name: api-docs
description: Analyse endpoints in the codebase and generate OpenAPI documentation that matches the actual implementation.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
user-invocable: true
---

# API Documentation

## Trigger
- Endpoints are undocumented or the docs have drifted.
- A client team needs the contract.
- Before exposing an API externally.

## Inputs needed
- Route definitions and handlers.
- Validation schemas.
- Auth requirements per route.

## Procedure
1. Enumerate endpoints from the route definitions, not from any existing document.
2. For each, read the handler and the validation schema to get the real request and response shapes.
3. Derive schemas from the validators where possible so the docs cannot drift.
4. Document every error response the handler can actually return.
5. Record auth requirements and required role per endpoint.
6. Validate the generated spec and check one example against the running API.

## Checklist
- [ ] Every endpoint in the router is documented
- [ ] Request and response schemas match the validators
- [ ] Error responses documented, not just the happy path
- [ ] Auth and required role stated per endpoint
- [ ] Examples are real and were executed
- [ ] Spec passes an OpenAPI validator

## Output template
```
**Generated:** openapi.yaml — <n> endpoints
**Verified:** <n> examples executed against staging
**Undocumented behaviour found:** <list>
**Drift from previous spec:** <list>
```

## Do not
- Never document intended behaviour — document what the code does.
- Do not hand-write a schema a validator can generate.
