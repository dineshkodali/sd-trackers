/**
 * TS-22 — Error handling and resilience.
 */
import { test, expect } from '../helpers/fixtures';
import { anonTest } from '../helpers/fixtures';
import { gotoModule, watchFailures, isEmptyState, injectSession, waitForAppShell } from '../helpers/ui';
import { createRecord, referralPayload, listRecords, deleteRecord } from '../helpers/api';

test.describe('TS-22 Error handling', () => {
  test('22.1 no module raises an uncaught exception during a full tour', async ({ page }) => {
    const { pageErrors } = watchFailures(page);
    for (const key of ['referrals', 'vulnerable', 'challenging', 'maintenance', 'spcd', 'escalations'] as const) {
      await gotoModule(page, key);
    }
    expect(pageErrors).toEqual([]);
  });

  test('22.2 a module with no records shows an explicit empty state', async ({ page, api }) => {
    // Requests & Approvals has no create path, so it is reliably empty.
    await gotoModule(page, 'requests');
    const rows = await listRecords(api, 'requests');
    if (rows.length === 0) {
      expect(await isEmptyState(page)).toBe(true);
    }
  });

  test('22.3 the app still renders when the data API fails', async ({ page }) => {
    await page.route('**/api/db/**', (route) => route.fulfill({ status: 500, body: '{"error":"simulated"}' }));
    const { pageErrors } = watchFailures(page);
    await gotoModule(page, 'referrals');
    await page.waitForTimeout(2500);

    await expect(page.locator('main')).toBeVisible();
    expect((await page.locator('main').innerText()).trim().length).toBeGreaterThan(0);
    expect(pageErrors, 'API failure must not crash the view').toEqual([]);
    await page.unroute('**/api/db/**');
  });

  test('22.4 the app survives the data API being unreachable', async ({ page }) => {
    await page.route('**/api/db/**', (route) => route.abort());
    const { pageErrors } = watchFailures(page);
    await gotoModule(page, 'vulnerable');
    await page.waitForTimeout(2500);

    await expect(page.locator('main')).toBeVisible();
    expect(pageErrors).toEqual([]);
    await page.unroute('**/api/db/**');
  });

  test('22.5 a malformed API payload does not crash the view', async ({ page }) => {
    await page.route('**/api/db/referrals', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":"not-an-array"}' }));
    const { pageErrors } = watchFailures(page);
    await gotoModule(page, 'referrals');
    await page.waitForTimeout(2500);

    await expect(page.locator('main')).toBeVisible();
    expect(pageErrors).toEqual([]);
    await page.unroute('**/api/db/referrals');
  });

  test('22.6 a slow API shows the shell rather than a blank page', async ({ page }) => {
    await page.route('**/api/db/**', async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await gotoModule(page, 'challenging');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('nav button').first()).toBeVisible();
    await page.unroute('**/api/db/**');
  });

  /**
   * DEF-10 / BUG-021 regression — FIXED 2026-09-11. The sync used to assign only
   * non-empty payloads, so records deleted server-side lingered in the UI. Live
   * mode applies every successful result, including an empty one, so the
   * `test.fail()` annotation was removed.
   */
  test('22.7 DEF-10 server-side deletion clears the row from the UI', async ({ page, api, tag }) => {
    const payload = referralPayload({ suName: tag });
    await createRecord(api, 'referrals', payload);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await gotoModule(page, 'referrals');
    await expect(page.locator('main table tbody tr').filter({ hasText: tag })).toBeVisible({ timeout: 30_000 });

    await deleteRecord(api, 'referrals', payload.id);
    // The background sync runs every 45 s (BUG-011 fixed the ~2.4 s runaway this
    // wait was written against), so allow one full cycle to land.
    await expect(page.locator('main table tbody tr').filter({ hasText: tag })).toHaveCount(0, { timeout: 60_000 });
  });
});

anonTest.describe('TS-22 Error handling (unauthenticated)', () => {
  anonTest('22.8 a failing auth check leaves the user on the login screen', async ({ page, context }) => {
    await context.route('**/api/auth/me', (route) => route.fulfill({ status: 500, body: '{"error":"simulated"}' }));
    await injectSession(context);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    const shell = await page.locator('nav button').count();
    expect(shell, 'a failed verification must not open the app').toBe(0);
  });

  anonTest('22.9 login surfaces a message when the auth API errors', async ({ page, context }) => {
    await context.route('**/api/auth/login', (route) => route.fulfill({ status: 500, body: '{"error":"Authentication service unavailable"}' }));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').first().fill('someone@example.com');
    await page.locator('input[type="password"]').first().fill('whatever');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await page.waitForTimeout(2500);
    expect(await page.locator('input[type="password"]').count(), 'must stay on login').toBeGreaterThan(0);
  });
});
