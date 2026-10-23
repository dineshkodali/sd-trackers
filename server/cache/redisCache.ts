import { Redis } from '@upstash/redis';

/**
 * Small read-through cache on Upstash Redis for data that is identical for every
 * signed-in user (see CACHEABLE_ENTITIES in routes/db.ts). Callers authenticate
 * and authorise BEFORE touching this module; it never makes access decisions.
 *
 * Safety properties:
 *   - Disabled (pass-through) unless UPSTASH_REDIS_REST_URL and _TOKEN are set,
 *     or when CACHE_ENABLED=false (the rollback switch).
 *   - Every Redis call is bounded by a timeout and wrapped; any failure falls
 *     back to the loader, so Redis being down only costs speed.
 *   - Entries are an envelope { v, data }; wrong version or shape is a miss.
 *   - Invalidation is targeted: each group keeps an index set of its keys.
 *   - Only one in-process load per key runs at a time (stampede protection).
 *   - A load that overlaps an invalidation is returned but not stored.
 *   - Payload contents are never logged.
 */

const SCHEMA_VERSION = 1;
const OP_TIMEOUT_MS = 300;
const MAX_PAYLOAD_BYTES = 512 * 1024;
const INDEX_TTL_SECONDS = 3600;

export interface CacheStats {
  enabled: boolean;
  hits: number;
  misses: number;
  errors: number;
  stores: number;
  invalidations: number;
  skippedLarge: number;
}

const stats: CacheStats = { enabled: false, hits: 0, misses: 0, errors: 0, stores: 0, invalidations: 0, skippedLarge: 0 };

let client: Redis | null | undefined;

function getClient(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const off = String(process.env.CACHE_ENABLED || '').toLowerCase() === 'false';
  if (!url || !token || off) {
    client = null;
  } else {
    // retry: false - a failing Redis must not stack up retries behind user requests.
    client = new Redis({ url, token, retry: false, enableTelemetry: false });
  }
  stats.enabled = client !== null;
  return client;
}

export function isCacheEnabled(): boolean {
  return getClient() !== null;
}

export function getCacheStats(): CacheStats {
  getClient();
  return { ...stats };
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('redis timeout')), OP_TIMEOUT_MS);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

function namespace(): string {
  const env = (process.env.CACHE_NAMESPACE || process.env.NODE_ENV || 'dev').replace(/[^a-z0-9_-]/gi, '');
  return `sdt:${env}:v${SCHEMA_VERSION}`;
}

/** sdt:<env>:v<schema>:<group>:<name> - group is the invalidation unit (a table). */
export function cacheKey(group: string, name: string): string {
  return `${namespace()}:${group}:${name}`;
}

function indexKey(group: string): string {
  return `${namespace()}:idx:${group}`;
}

// Bumped on every invalidation so an in-flight load can tell it is out of date.
const generations = new Map<string, number>();
const inflight = new Map<string, Promise<unknown>>();

interface Envelope<T> { v: number; data: T }

function isEnvelope(value: unknown): value is Envelope<unknown> {
  return typeof value === 'object' && value !== null && (value as any).v === SCHEMA_VERSION && 'data' in (value as any);
}

/**
 * Return the cached value for `key`, or run `loader`, store a successful result
 * for `ttlSeconds` and return it. `shouldStore` lets the caller refuse to cache
 * failed or partial results.
 */
export async function readThrough<T>(
  group: string,
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  shouldStore: (value: T) => boolean = () => true,
): Promise<T> {
  const redis = getClient();
  if (!redis) return loader();

  try {
    const cached = await withTimeout(redis.get<unknown>(key));
    if (cached != null && isEnvelope(cached)) {
      stats.hits++;
      return cached.data as T;
    }
  } catch {
    stats.errors++;
  }
  stats.misses++;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const generation = generations.get(group) ?? 0;
  const load = (async () => {
    const value = await loader();
    if (shouldStore(value) && (generations.get(group) ?? 0) === generation) {
      await store(redis, group, key, ttlSeconds, value);
    }
    return value;
  })().finally(() => inflight.delete(key));
  inflight.set(key, load);
  return load;
}

async function store<T>(redis: Redis, group: string, key: string, ttlSeconds: number, value: T): Promise<void> {
  try {
    const body = JSON.stringify({ v: SCHEMA_VERSION, data: value } satisfies Envelope<T>);
    if (Buffer.byteLength(body) > MAX_PAYLOAD_BYTES) {
      stats.skippedLarge++;
      return;
    }
    const idx = indexKey(group);
    const pipe = redis.pipeline();
    pipe.set(key, body, { ex: ttlSeconds });
    pipe.sadd(idx, key);
    pipe.expire(idx, INDEX_TTL_SECONDS);
    await withTimeout(pipe.exec());
    stats.stores++;
  } catch {
    stats.errors++;
  }
}

/**
 * Drop every cached key of `groups`. Call after the database write succeeded.
 * Never throws; if Redis is unreachable the short TTL bounds staleness.
 */
export async function invalidateGroups(groups: string[]): Promise<void> {
  const redis = getClient();
  for (const group of groups) {
    generations.set(group, (generations.get(group) ?? 0) + 1);
  }
  if (!redis) return;
  for (const group of groups) {
    try {
      const idx = indexKey(group);
      const keys = await withTimeout(redis.smembers(idx));
      if (keys.length > 0) await withTimeout(redis.del(...keys));
      await withTimeout(redis.del(idx));
      stats.invalidations++;
    } catch {
      stats.errors++;
    }
  }
}

/** Test hook: forget the memoised client (or install a fake one) and zero all state. */
export function resetCacheForTests(fake?: unknown): void {
  client = fake === undefined ? undefined : (fake as Redis);
  stats.enabled = Boolean(client);
  generations.clear();
  inflight.clear();
  Object.assign(stats, { hits: 0, misses: 0, errors: 0, stores: 0, invalidations: 0, skippedLarge: 0 });
}
