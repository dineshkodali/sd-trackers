/**
 * BUG-011 regression — background sync cadence.
 *
 * The scheduling effect depended on a callback whose identity changed on every
 * run (it closed over `sites`/`users`, which the sync itself replaced). The
 * effect therefore tore down and re-armed its 1500ms initial timer each cycle,
 * so the 45s interval was never reached: a full 13-endpoint sync fired roughly
 * every 2.4 seconds, unauthenticated, even on the login screen —
 * 585 requests per 100s, about 505,000 per day per idle tab.
 *
 * Fixed by holding the sync function in a ref so the timers are created once.
 * Measured after the fix: 39 requests per 100s in three bursts (0s, 45s, 90s).
 *
 * This test is deliberately slow — cadence cannot be observed instantly.
 */
import { test, expect } from '../helpers/fixtures';

const WINDOW_MS = 50_000;

/**
 * One sync cycle is ~13 requests. In a 50s window the app should perform at
 * most two cycles (one on load, one at the 45s interval). The ceiling is set at
 * four cycles' worth so ordinary timing variance cannot fail the test, while a
 * return of the runaway loop — which produced ~290 requests in the same window —
 * fails it decisively.
 */
const MAX_REQUESTS = 13 * 4;

test.describe('BUG-011 background sync cadence', () => {
  test.setTimeout(WINDOW_MS + 60_000);

  test('PERF.1 an idle page does not flood the API', async ({ page }) => {
    const dbRequests: number[] = [];
    const started = Date.now();

    page.on('request', (rq) => {
      if (rq.url().includes('/api/db/')) dbRequests.push(Date.now() - started);
    });

    // Already navigated by the auth fixture; sit idle and observe.
    await page.waitForTimeout(WINDOW_MS);

    const perMinute = Math.round((dbRequests.length / WINDOW_MS) * 60_000);
    expect(
      dbRequests.length,
      `${dbRequests.length} /api/db requests in ${WINDOW_MS / 1000}s (~${perMinute}/min). ` +
        'The runaway sync loop produced roughly 290 in this window.'
    ).toBeLessThanOrEqual(MAX_REQUESTS);
  });

  test('PERF.2 the page reaches network idle', async ({ page }) => {
    // Impossible while the runaway loop ran: the app never went quiet, so this
    // assertion could never have resolved before the fix.
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
    expect(true).toBe(true);
  });
});
