import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * SD Operations — E2E configuration.
 *
 * This config lives in "QA Testing & Results/", one level below the application
 * root. `testDir` and `outputDir` resolve relative to this file, but the dev
 * server must be started from the project root where package.json lives — hence
 * the explicit webServer.cwd below.
 *
 * Two constraints drive everything here:
 *  1. The app runs a background sync roughly every 2.4s, so `networkidle`
 *     never resolves. No spec may use it. Use explicit element waits.
 *  2. Tests share one live Supabase project. Workers are pinned to 1 so runs
 *     cannot interleave writes against the same rows.
 */

/**
 * Application root — the parent of this QA folder.
 * package.json sets "type": "module", so this config is loaded as ESM and
 * `__dirname` is unavailable; derive it from import.meta.url instead.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',

  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },

  /**
   * Always emit the browsable HTML report alongside the console output, into
   * "html results/" where the rest of the QA reports live.
   * Open it with:  npx playwright show-report "html results/playwright-report"
   */
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: './html results/playwright-report' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3020',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // The standalone chrome-headless-shell is not installed; use the full build.
        channel: 'chromium',
        viewport: { width: 1600, height: 1000 },
      },
    },
  ],

  /**
   * Start the application yourself before running tests:
   *
   *     cd ..  &&  PORT=3020 OPEN_BROWSER=false DISABLE_HMR=true npm run dev
   *
   * `reuseExistingServer` means Playwright attaches to that instance instantly.
   * Auto-spawn is left configured as a fallback but is unreliable on Windows —
   * `tsx watch`, when spawned detached by the runner, starts and then exits
   * before binding the port. The timeout is short so that failure is reported
   * in seconds rather than after two minutes.
   */
  webServer: {
    command: 'npm run dev',
    cwd: PROJECT_ROOT,
    url: 'http://localhost:3020/api/health',
    reuseExistingServer: true,
    timeout: 45_000,
    // `env` REPLACES the environment rather than extending it, so process.env
    // must be spread in — without it PATH is lost and `npm` cannot be found.
    // DISABLE_HMR stops Vite watching the repo root, where large saved HTML
    // reports have previously crashed the watcher with EBUSY.
    env: { ...process.env, PORT: '3020', OPEN_BROWSER: 'false', DISABLE_HMR: 'true' } as Record<string, string>,
  },
});
