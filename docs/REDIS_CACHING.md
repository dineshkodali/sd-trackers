# Redis caching and CDN headers

## Audit summary

| Finding | Detail |
| --- | --- |
| Backend | Express server (`server/index.ts`, Docker, Node 22). There are **no Supabase Edge Functions** in this repository. |
| Data access | Browser calls `/api/db/*`. The server authenticates with `requireAuth` (Supabase token or signed admin token) and then reads Supabase with the **service-role key**, applying site scoping itself (`selectRows`, `TABLE_SITE_COLUMN`, `TABLE_PARENT_SCOPE`). RLS is therefore not the isolation layer on this path. |
| Fallback | If the API is unreachable the browser reads Supabase directly (`directBatchFetchEntities`). That path never touches the cache. |
| Read load | The app sync calls `POST /api/db/batch-read` for about 27 entities every 45 seconds per open tab. |
| Redis before this change | None. |
| Hosting | AWS Amplify serves `dist/`; `amplify.yml` already set security headers but no cache headers. |

Because the app already has a trusted server layer, the cache lives there rather than in a new Edge Function. An Edge Function would have to duplicate the site-scoping logic and the admin-token handling.

## What is cached

Only `fieldOptions` (`field_options`) and `tableSchemas` (`table_schemas`): dropdown options and custom column definitions. They are identical for every signed-in user, are not site-scoped or parent-scoped, and are readable by any authenticated user. They are read on every sync, and change rarely.

`readEntityCached` in `server/routes/db.ts` fails closed. It only caches an entity that is in `CACHEABLE_ENTITIES` **and** has no site column, no parent scope and is not admin-only. Authentication and the `read` policy check run before the cache is consulted.

Not cached: service users, placements, finance, incidents, documents, audit trails, profiles and anything else personal or site-scoped. Adding one needs a security review of key design, minimisation and invalidation first.

## Keys and TTL

`sdt:<env>:v<schema>:<table>:<entity>:<sha256(list options)[0..16]>`

- `<env>` is `CACHE_NAMESPACE`, else `NODE_ENV`, else `dev`. Use a different value per environment sharing one Redis.
- `<schema>` is `SCHEMA_VERSION` in `server/cache/redisCache.ts`. Bump it when the stored shape changes.
- Index set per table: `sdt:<env>:v<schema>:idx:<table>`, used for targeted invalidation (no wildcard deletes).
- TTL: `CACHE_TTL_SECONDS`, default 60, clamped to 5 to 300. Index sets expire after one hour.
- Entries over 512 KB are not stored. Only successful, non-truncated reads are stored.

## Invalidation matrix

| Operation (all in `/api/db`) | Invalidates |
| --- | --- |
| `POST /:entity`, `/:entity/bulk`, `PUT /:entity/:id`, `DELETE /:entity/:id`, `/:entity/bulk-delete` on `fieldOptions` or `tableSchemas` | that entity's table |
| `POST /sync/push`, `/seed`, `/migrate`, `/ensure` | both cached tables |
| Writes to any other entity | nothing |
| Direct browser to Supabase writes (fallback path) | nothing; bounded by the TTL |

Invalidation runs on the response `finish` event for a status below 400, so after the database write. A load that overlaps an invalidation is returned to its caller but not stored. Redis being unreachable never fails a request; staleness is then bounded by the TTL.

The cache is shared through Redis, so several server instances stay consistent. Stampede protection (one load per key) is per process.

## Configuration and rollback

Set on the Express server (not the browser, and not Supabase Edge secrets; the app does not run there):

| Variable | Purpose |
| --- | --- |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Credentials. Without both, the cache is a pass-through. |
| `CACHE_ENABLED=false` | Switch off without removing credentials. |
| `CACHE_TTL_SECONDS` | Optional TTL override. |
| `CACHE_NAMESPACE` | Optional key prefix per environment. |

Rollback: set `CACHE_ENABLED=false` and restart. Requests go straight to Supabase as before. `GET /api/db/cache-stats` (Admin and Super Admin) shows hits, misses, errors, stores and invalidations for the current process; no cached payloads are logged or returned.

## CDN (Amplify)

`amplify.yml` custom headers:

- `/assets/*.js`, `*.css`, `*.woff2`: `public, max-age=31536000, immutable`. Vite content-hashes these names.
- `/index.html`: `no-cache`, so a deploy reaches returning users.
- `/assets/aistudio/*` is unhashed (copied from `public/`) and is intentionally not matched.
- API responses already send `no-store` (`securityHeaders.ts`). No DNS or TLS change, and no extra CDN.

## Tests

`npm run test:unit` includes `tests/redisCache.test.ts`, which uses a fake Redis for hit/miss, TTL, invalidation, invalidation race, concurrent misses, malformed entries, Redis errors, timeout and pass-through without credentials.

## Not yet done

- No staging deployment, k6 load test or before/after latency numbers exist. Run the plan below against staging with synthetic data before relying on any figure.
- Integration tests for cross-site isolation and per-role flows against a real database need a staging environment.
- Dashboard summaries and site lists are not cached: they are site-scoped personal-data reads and need the security review above.

### Load-test plan (k6, staging only)

1. Baseline with `CACHE_ENABLED=false`: `POST /api/db/batch-read` for `fieldOptions` and `tableSchemas`.
2. Enable cache; first request (miss), then repeats (hit).
3. Write a field option, then read; the value must be fresh.
4. 25, 50, 100 virtual users on the same key; record p50/p95/p99, error rate, `cache-stats` hit ratio and Supabase request volume.
5. Point `UPSTASH_REDIS_REST_URL` at an unreachable host: requests must still succeed.
6. Expired or invalid tokens must return 401 with the cache enabled.
