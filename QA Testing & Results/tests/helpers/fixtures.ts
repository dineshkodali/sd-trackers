/**
 * Shared fixtures.
 *
 *   test      — authenticated session already injected, app open at Dashboard
 *   anonTest  — clean browser, no session (for login/logout specs)
 *
 * Both expose `api` (a direct API client) and `tag` (a per-test QA prefix).
 * Cleanup is an auto-fixture rather than an afterEach hook so it applies to
 * every importing spec without hook-scope surprises, and runs even on failure.
 */
import { test as base, expect, APIRequestContext } from '@playwright/test';
import { ctx, purgeTagged } from './api';
import { injectSession, openApp } from './ui';
import { QA_PREFIX } from './env';

const PURGE_ENTITIES = [
  'referrals', 'vulnerable', 'challenging', 'maintenance',
  'spcd', 'laundry', 'food', 'escalations', 'documents',
];

interface Fixtures {
  api: APIRequestContext;
  tag: string;
  cleanup: void;
}

/** Unauthenticated: a clean browser with no session seeded. */
export const anonTest = base.extend<Fixtures>({
  api: async ({}, use) => {
    const c = await ctx();
    await use(c);
    await c.dispose();
  },

  tag: async ({}, use, testInfo) => {
    const slug = testInfo.title.replace(/[^a-z0-9]+/gi, '').slice(0, 10).toUpperCase();
    await use(`${QA_PREFIX}-${slug}-${Date.now().toString().slice(-6)}`);
  },

  /**
   * Purges anything carrying the QA prefix once the test finishes.
   * Only ever matches rows this suite created; pre-existing data is untouched.
   */
  cleanup: [
    async ({ api }, use) => {
      await use();
      for (const entity of PURGE_ENTITIES) {
        await purgeTagged(api, entity).catch(() => undefined);
      }
    },
    { auto: true },
  ],
});

/** Authenticated: session injected before first paint, app already open. */
export const test = anonTest.extend<{ authed: void }>({
  authed: [
    async ({ context, page }, use) => {
      await injectSession(context);
      await openApp(page);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
