import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheKey, readThrough, invalidateGroups, getCacheStats, resetCacheForTests } from '../server/cache/redisCache.js';

/** In-memory stand-in for the parts of the Upstash client the cache uses. */
function fakeRedis(opts: { failGet?: boolean; slowGet?: boolean } = {}) {
  const kv = new Map<string, unknown>();
  const sets = new Map<string, Set<string>>();
  const ttls = new Map<string, number>();
  return {
    kv, sets, ttls,
    async get(k: string) {
      if (opts.failGet) throw new Error('down');
      if (opts.slowGet) await new Promise(r => setTimeout(r, 1000));
      return kv.get(k) ?? null;
    },
    async smembers(k: string) { return Array.from(sets.get(k) ?? []); },
    async del(...keys: string[]) { keys.forEach(k => { kv.delete(k); sets.delete(k); }); return keys.length; },
    pipeline() {
      const ops: Array<() => void> = [];
      const p: any = {
        set: (k: string, v: string, o: { ex: number }) => { ops.push(() => { kv.set(k, JSON.parse(v)); ttls.set(k, o.ex); }); return p; },
        sadd: (k: string, m: string) => { ops.push(() => { (sets.get(k) ?? sets.set(k, new Set()).get(k)!).add(m); }); return p; },
        expire: () => p,
        exec: async () => { ops.forEach(o => o()); return []; },
      };
      return p;
    },
  };
}

const key = (n: string) => cacheKey('field_options', n);

test('miss then hit: second call does not run the loader', async () => {
  const redis = fakeRedis();
  resetCacheForTests(redis);
  let loads = 0;
  const loader = async () => { loads++; return { success: true, data: [1, 2] }; };
  const a = await readThrough('field_options', key('a'), 60, loader);
  const b = await readThrough('field_options', key('a'), 60, loader);
  assert.deepEqual(a, b);
  assert.equal(loads, 1);
  assert.equal(redis.ttls.get(key('a')), 60);
  const s = getCacheStats();
  assert.equal(s.hits, 1);
  assert.equal(s.misses, 1);
});

test('failed results are not stored', async () => {
  const redis = fakeRedis();
  resetCacheForTests(redis);
  await readThrough('field_options', key('f'), 60, async () => ({ success: false }), r => r.success);
  assert.equal(redis.kv.size, 0);
});

test('invalidation removes the group keys and forces a reload', async () => {
  const redis = fakeRedis();
  resetCacheForTests(redis);
  let loads = 0;
  const loader = async () => ({ n: ++loads });
  await readThrough('field_options', key('x'), 60, loader);
  await invalidateGroups(['field_options']);
  assert.equal(redis.kv.size, 0);
  const again = await readThrough('field_options', key('x'), 60, loader);
  assert.equal(again.n, 2);
});

test('a load overlapping an invalidation is returned but not stored', async () => {
  const redis = fakeRedis();
  resetCacheForTests(redis);
  const value = await readThrough('field_options', key('race'), 60, async () => {
    await invalidateGroups(['field_options']);
    return { stale: true };
  });
  assert.deepEqual(value, { stale: true });
  assert.equal(redis.kv.size, 0);
});

test('concurrent misses share one load', async () => {
  const redis = fakeRedis();
  resetCacheForTests(redis);
  let loads = 0;
  const loader = async () => { loads++; await new Promise(r => setTimeout(r, 20)); return { ok: 1 }; };
  const results = await Promise.all(Array.from({ length: 10 }, () => readThrough('field_options', key('s'), 60, loader)));
  assert.equal(loads, 1);
  assert.equal(results.length, 10);
});

test('malformed or wrong-version entries are treated as a miss', async () => {
  const redis = fakeRedis();
  resetCacheForTests(redis);
  redis.kv.set(key('bad'), 'not an envelope');
  redis.kv.set(key('old'), { v: 0, data: 'old' });
  let loads = 0;
  const loader = async () => { loads++; return 'fresh'; };
  assert.equal(await readThrough('field_options', key('bad'), 60, loader), 'fresh');
  assert.equal(await readThrough('field_options', key('old'), 60, loader), 'fresh');
  assert.equal(loads, 2);
});

test('Redis errors fall back to the loader', async () => {
  resetCacheForTests(fakeRedis({ failGet: true }));
  const value = await readThrough('field_options', key('e'), 60, async () => 'from-db');
  assert.equal(value, 'from-db');
  assert.ok(getCacheStats().errors > 0);
});

test('a slow Redis is abandoned after the timeout', async () => {
  resetCacheForTests(fakeRedis({ slowGet: true }));
  const started = Date.now();
  const value = await readThrough('field_options', key('t'), 60, async () => 'from-db');
  assert.equal(value, 'from-db');
  assert.ok(Date.now() - started < 800);
});

test('without credentials the cache is a pass-through', async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetCacheForTests();
  let loads = 0;
  await readThrough('g', 'k', 60, async () => ++loads);
  await readThrough('g', 'k', 60, async () => ++loads);
  assert.equal(loads, 2);
  assert.equal(getCacheStats().enabled, false);
});

test('keys carry environment, schema version and group', () => {
  resetCacheForTests();
  assert.match(cacheKey('field_options', 'a:b'), /^sdt:[a-z0-9_-]+:v1:field_options:a:b$/i);
});
