/** TS-14/15/16/19/20/21 — read-only, reporting and administrative views. */
import { test, expect } from '../helpers/fixtures';
import { rendersCleanly, hasTableOrEmptyState } from '../helpers/module-suite';
import { gotoModule } from '../helpers/ui';

test.describe('TS-15 Audit Security Trail', () => {
  rendersCleanly('audit');
  hasTableOrEmptyState('audit');

  test('15.a entries carry an action type', async ({ page }) => {
    await gotoModule(page, 'audit');
    expect(await page.locator('main').innerText())
      .toMatch(/CREATE|UPDATE|DELETE|LOGIN|SETTINGS_UPDATE|ROLE_CHANGE/);
  });
});

test.describe('TS-16 Requests & Approvals', () => {
  rendersCleanly('requests');
  hasTableOrEmptyState('requests');

  test('16.a is review-only and offers no direct create control', async ({ page }) => {
    await gotoModule(page, 'requests');
    const buttons = await page.locator('main button').allInnerTexts();
    const creators = buttons.filter((b) => /^\+|^add |^new /i.test(b.trim()));
    expect(creators, 'change requests are raised from other modules, not here').toEqual([]);
  });
});

test.describe('TS-14 Reports & SharePoint', () => {
  rendersCleanly('reports');

  test('14.a offers workbook export destinations', async ({ page }) => {
    await gotoModule(page, 'reports');
    expect(await page.locator('main').innerText()).toMatch(/SharePoint|Workbook|Export/i);
  });
});

test.describe('TS-19 Roles & RBAC Matrix', () => {
  rendersCleanly('roles');

  test('19.a presents every role in the permission matrix', async ({ page }) => {
    await gotoModule(page, 'roles');
    const text = await page.locator('main').innerText();
    for (const role of ['Super Admin', 'Admin', 'Regional Manager', 'Site Manager', 'Staff']) {
      expect(text, `role ${role}`).toContain(role);
    }
  });

  test('19.b exposes the individual permission flags', async ({ page }) => {
    await gotoModule(page, 'roles');
    expect(await page.locator('main').innerText()).toMatch(/Delete|Create|Edit|Export/i);
  });
});

test.describe('TS-20 Field Options & Setup', () => {
  rendersCleanly('fieldOptions');
  hasTableOrEmptyState('fieldOptions');

  test('20.a exposes configurable option categories', async ({ page }) => {
    await gotoModule(page, 'fieldOptions');
    expect(await page.locator('main select').count()).toBeGreaterThan(0);
  });
});

test.describe('TS-21 System Preferences', () => {
  rendersCleanly('settings');

  test('21.a exposes the confirmation and security toggles', async ({ page }) => {
    await gotoModule(page, 'settings');
    const text = await page.locator('main').innerText();
    expect(text).toMatch(/Confirm|Auto.?Logout|Isolation|Retention/i);
    expect(await page.locator('main input[type="checkbox"]').count()).toBeGreaterThan(0);
  });

  test('21.b exposes the batch retention controls', async ({ page }) => {
    await gotoModule(page, 'settings');
    expect(await page.locator('main').innerText()).toMatch(/Retention|Archive|Older Than|Cutoff/i);
  });
});
