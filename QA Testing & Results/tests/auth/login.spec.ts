/**
 * TS-01 — Authentication: the login gate.
 */
import { anonTest as test, expect } from '../helpers/fixtures';
import { loginForm, loginViaUI, waitForAppShell, isLoggedOut } from '../helpers/ui';
import { MASTER, STORAGE_KEYS } from '../helpers/env';

test.describe('TS-01 Authentication — login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('01.1 unauthenticated root shows the login form and no application shell', async ({ page }) => {
    await expect(loginForm(page).email).toBeVisible();
    await expect(loginForm(page).password).toBeVisible();
    await expect(loginForm(page).submit).toBeVisible();
    await expect(page.locator('nav button')).toHaveCount(0);
  });

  test('01.2 invalid credentials are rejected and keep the user on the login screen', async ({ page }) => {
    await loginViaUI(page, 'nobody@example.com', 'WrongPassword123!');
    await expect(page.getByText(/invalid email address or password/i)).toBeVisible({ timeout: 20_000 });
    expect(await isLoggedOut(page)).toBe(true);
    await expect(page.locator('nav button')).toHaveCount(0);
  });

  test('01.3 valid credentials sign the user in and render the application shell', async ({ page }) => {
    await loginViaUI(page);
    await waitForAppShell(page);
    expect(await isLoggedOut(page)).toBe(false);
    await expect(page.locator('nav button').first()).toBeVisible();
  });

  test('01.4 a successful login persists a session token and profile', async ({ page }) => {
    await loginViaUI(page);
    await waitForAppShell(page);

    const stored = await page.evaluate(
      ([t, u]) => ({ token: localStorage.getItem(t), user: localStorage.getItem(u) }),
      [STORAGE_KEYS.token, STORAGE_KEYS.user]
    );
    expect(stored.token).toBeTruthy();
    expect(stored.user).toContain(MASTER.email);
  });

  test('01.5 an empty submit does not authenticate', async ({ page }) => {
    await loginForm(page).submit.click();
    await page.waitForTimeout(1500);
    expect(await isLoggedOut(page)).toBe(true);
  });

  test('01.6 the password field masks input', async ({ page }) => {
    await expect(loginForm(page).password).toHaveAttribute('type', 'password');
  });

  test('01.7 a deep link cannot bypass the authentication gate', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    expect(await isLoggedOut(page)).toBe(true);
    await expect(page.locator('nav button')).toHaveCount(0);
  });
});
