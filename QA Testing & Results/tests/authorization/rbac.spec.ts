/**
 * TS-02 — Client-side RBAC.
 *
 * Healing note: the first version of this suite seeded a role into localStorage
 * and was silently defeated. `/api/auth/me` returns `role: "Super Admin"` for
 * any token beginning `sm-jwt-`, so the app overwrote every role under test and
 * five specs failed for a reason that had nothing to do with the assertions.
 *
 * The endpoint is now stubbed per role. That is a test double for an API, not a
 * relaxed assertion — the UI still has to prove it withholds the right controls.
 */
import { anonTest as test, expect } from '../helpers/fixtures';
import { MASTER, STORAGE_KEYS } from '../helpers/env';
import { waitForAppShell, gotoModule, rowContaining } from '../helpers/ui';
import { createRecord, referralPayload } from '../helpers/api';

type Perms = Record<string, boolean>;

const ALL_TRUE: Perms = {
  canViewAllProperties: true, canCreateRecords: true, canEditRecords: true,
  canDeleteRecords: true, canArchiveRestore: true, canExportData: true,
  canManageProperties: true, canManageFiles: true, canManageUsers: true, canManageSettings: true,
};

/**
 * Boot the app as `role`. Stubs /api/auth/me so the session actually resolves to
 * that role instead of being force-upgraded to Super Admin by the master token.
 */
async function bootAs(context: any, page: any, role: string, perms: Partial<Perms> = {}, site = 'Brit Hotel') {
  await context.route('**/api/auth/me', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user: { id: MASTER.id, email: MASTER.email, name: MASTER.name, role, assignedSite: site, status: 'Active' },
      }),
    })
  );

  // A real signed token: /api/auth/me is stubbed for the role under test, but the
  // app's data calls still hit a live API that now demands a valid session.
  const { getAuthToken } = await import('../helpers/api');
  const sessionToken = await getAuthToken();

  await context.addInitScript(
    ([keys, user, roleName, permissions, assignedSite, token]: any) => {
      localStorage.setItem(keys.token, JSON.stringify(token));
      localStorage.setItem(keys.user, JSON.stringify({ ...user, role: roleName, assignedSite }));
      localStorage.setItem(keys.role, JSON.stringify(roleName));
      localStorage.setItem(keys.permissions, JSON.stringify(permissions));
    },
    [
      STORAGE_KEYS,
      { id: MASTER.id, email: MASTER.email, name: MASTER.name },
      role,
      { [role]: { ...ALL_TRUE, ...perms } },
      site,
      sessionToken,
    ]
  );

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForAppShell(page);
  await page.waitForTimeout(2500);
}

const navText = async (page: any) =>
  (await page.locator('nav button').allInnerTexts()).join(' | ');

test.describe('TS-02 Role-based access control', () => {
  test('02.1 a Super Admin sees the administrative modules', async ({ context, page }) => {
    await bootAs(context, page, 'Super Admin', {}, 'All Sites');
    const nav = await navText(page);
    expect(nav).toMatch(/Roles & RBAC Matrix/);
    expect(nav).toMatch(/System Preferences/);
    expect(nav).toMatch(/Staff & User Accounts/);
  });

  test('02.2 a Staff user does not see the RBAC matrix', async ({ context, page }) => {
    await bootAs(context, page, 'Staff', { canManageUsers: false, canManageSettings: false });
    expect(await navText(page), 'RBAC administration must not be offered to Staff')
      .not.toMatch(/Roles & RBAC Matrix/);
  });

  test('02.3 a Staff user does not see user administration', async ({ context, page }) => {
    await bootAs(context, page, 'Staff', { canManageUsers: false });
    expect(await navText(page)).not.toMatch(/Staff & User Accounts/);
  });

  test('02.4 revoking delete withholds the row delete action', async ({ context, page, api, tag }) => {
    // Seed a row first — the original version asserted against an empty table
    // and passed for the wrong reason.
    await createRecord(api, 'referrals', referralPayload({ suName: tag, site: 'Brit Hotel' }));
    await bootAs(context, page, 'Site Manager', { canDeleteRecords: false });
    await gotoModule(page, 'referrals');
    await expect(rowContaining(page, tag)).toBeVisible({ timeout: 30_000 });

    const deletes = await page.locator('main table tbody button[title*="Delete"]').count();
    expect(deletes, 'delete action should be withheld when canDeleteRecords is false').toBe(0);
  });

  test('02.4b granting delete exposes the row delete action', async ({ context, page, api, tag }) => {
    await createRecord(api, 'referrals', referralPayload({ suName: tag, site: 'Brit Hotel' }));
    await bootAs(context, page, 'Admin', { canDeleteRecords: true }, 'All Sites');
    await gotoModule(page, 'referrals');
    await expect(rowContaining(page, tag)).toBeVisible({ timeout: 30_000 });

    const deletes = await page.locator('main table tbody button[title*="Delete"]').count();
    expect(deletes, 'delete action should be available when permitted').toBeGreaterThan(0);
  });

  /**
   * REAL APPLICATION BUG — kept failing deliberately.
   *
   * `canCreateRecords` is defined in the permission model, configurable in the
   * RBAC matrix and imported into ReferralsView as `canCreateRecord`, but the
   * "+ New Record" button is gated only by `!isArchive`. The permission is
   * never consulted, so a role denied creation can still create records.
   * Do not annotate this away: it must stay red until the guard is added.
   */
  test('02.5 revoking create withholds the create control', async ({ context, page }) => {
    await bootAs(context, page, 'Staff', { canCreateRecords: false });
    await gotoModule(page, 'referrals');
    const creators = (await page.locator('main button').allInnerTexts())
      .filter((b) => /^\+ New Record/i.test(b.trim()));
    expect(creators, 'create control should be withheld when canCreateRecords is false').toEqual([]);
  });

  test('02.6 the active role is displayed in the header', async ({ context, page }) => {
    await bootAs(context, page, 'Regional Manager', {}, 'All Sites');
    expect(await page.locator('header').innerText()).toMatch(/Regional Manager/);
  });

  test('02.7 a site-restricted role has its site filter locked', async ({ context, page }) => {
    await bootAs(context, page, 'Staff', { canViewAllProperties: false });
    await gotoModule(page, 'referrals');
    await expect(page.locator('#filter-site')).toBeDisabled();
  });

  test('02.8 a privileged role keeps the site filter open', async ({ context, page }) => {
    await bootAs(context, page, 'Super Admin', {}, 'All Sites');
    await gotoModule(page, 'referrals');
    await expect(page.locator('#filter-site')).toBeEnabled();
  });
});
