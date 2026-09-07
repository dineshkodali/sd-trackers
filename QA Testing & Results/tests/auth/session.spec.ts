/**
 * TS-01 — Session lifecycle: restore, logout and tamper resistance.
 */
import { anonTest as test, expect } from '../helpers/fixtures';
import { MASTER, STORAGE_KEYS } from '../helpers/env';
import { injectSession, waitForAppShell, loginViaUI, logout, isLoggedOut, openApp } from '../helpers/ui';

test.describe('TS-01 Session lifecycle', () => {
  test('01.8 a stored session is restored without re-authenticating', async ({ context, page }) => {
    await injectSession(context);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppShell(page);
    expect(await isLoggedOut(page)).toBe(false);
  });

  test('01.9 a restored session resolves the correct identity', async ({ context, page }) => {
    await injectSession(context);
    await openApp(page);
    expect(await page.locator('header').innerText()).toMatch(/Stack Master/);
  });

  test('01.10 the session survives a page reload', async ({ context, page }) => {
    await injectSession(context);
    await openApp(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppShell(page);
    expect(await isLoggedOut(page)).toBe(false);
  });

  test('01.11 logging out clears the stored session', async ({ context, page }) => {
    await injectSession(context);
    await openApp(page);
    await logout(page);

    expect(await isLoggedOut(page)).toBe(true);
    const remaining = await page.evaluate(
      ([t, u]) => [localStorage.getItem(t), localStorage.getItem(u)].filter(Boolean).length,
      [STORAGE_KEYS.token, STORAGE_KEYS.user]
    );
    expect(remaining, 'no auth material should remain').toBe(0);
  });

  test('01.12 after logout the application shell is gone', async ({ context, page }) => {
    await injectSession(context);
    await openApp(page);
    await logout(page);
    await expect(page.locator('nav button')).toHaveCount(0);
  });

  test('01.13 a corrupted stored token does not grant access', async ({ context, page }) => {
    await context.addInitScript(
      ([t, u]) => {
        localStorage.setItem(t, JSON.stringify('totally-invalid-token'));
        localStorage.setItem(u, JSON.stringify({ id: 'x', email: 'x@x.tld', name: 'X', role: 'Super Admin' }));
      },
      [STORAGE_KEYS.token, STORAGE_KEYS.user]
    );
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    const shellVisible = (await page.locator('nav button').count()) > 0;
    expect(shellVisible, 'an invalid token must not open the application').toBe(false);
  });

  test('01.14 signing in again after logout works', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginViaUI(page);
    await waitForAppShell(page);
    await logout(page);
    await loginViaUI(page);
    await waitForAppShell(page);
    expect(await isLoggedOut(page)).toBe(false);
  });

  test('01.15 the signed-in identity matches the credentials used', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginViaUI(page);
    await waitForAppShell(page);
    const stored = await page.evaluate((u) => localStorage.getItem(u), STORAGE_KEYS.user);
    expect(stored).toContain(MASTER.email);
  });
});
