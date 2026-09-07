/**
 * TS-13/17/18 — Documents, Properties and User Accounts.
 */
import { test, expect } from '../helpers/fixtures';
import {
  standardModuleSuite, rendersCleanly, createFormOpensAndCloses, emptySubmitIsBlocked,
} from '../helpers/module-suite';
import { gotoModule, openCreateForm, closeDialog, dialog } from '../helpers/ui';

test.describe('TS-13 Proof Documents', () => {
  standardModuleSuite('documents', { filters: false });

  test('13.a offers the confidentiality classifications', async ({ page }) => {
    await gotoModule(page, 'documents');
    await openCreateForm(page, 'documents');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    expect(joined).toMatch(/Restricted/i);
    expect(joined).toMatch(/Confidential/i);
    expect(joined).toMatch(/Official/i);
    await closeDialog(page);
  });

  test('13.b accepts a file for upload', async ({ page }) => {
    await gotoModule(page, 'documents');
    await openCreateForm(page, 'documents');
    expect(await dialog(page).locator('input[type="file"]').count()).toBeGreaterThan(0);
    await closeDialog(page);
  });

  test('13.c offers the safeguarding document categories', async ({ page }) => {
    await gotoModule(page, 'documents');
    await openCreateForm(page, 'documents');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    expect(joined).toMatch(/Risk Assessment/i);
    expect(joined).toMatch(/Safeguarding Plan/i);
    await closeDialog(page);
  });
});

test.describe('TS-17 Properties Directory', () => {
  rendersCleanly('properties');
  createFormOpensAndCloses('properties');
  emptySubmitIsBlocked('properties');

  test('17.a lists the contracted property estate', async ({ page }) => {
    await gotoModule(page, 'properties');
    expect(await page.locator('main').innerText()).toMatch(/Brit Hotel/i);
  });

  test('17.b property status is limited to Active or Under Maintenance', async ({ page }) => {
    await gotoModule(page, 'properties');
    await openCreateForm(page, 'properties');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    expect(joined).toMatch(/Active/i);
    expect(joined).toMatch(/Under Maintenance/i);
    await closeDialog(page);
  });
});

test.describe('TS-18 Staff & User Accounts', () => {
  rendersCleanly('users');
  createFormOpensAndCloses('users');

  test('18.a lists existing accounts with their roles', async ({ page }) => {
    await gotoModule(page, 'users');
    const text = await page.locator('main').innerText();
    expect(text).toMatch(/@/);
    expect(text).toMatch(/Super Admin|Admin|Staff|Manager/);
  });

  test('18.b the new-user form offers every operational role', async ({ page }) => {
    await gotoModule(page, 'users');
    await openCreateForm(page, 'users');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    for (const role of ['Staff', 'Employee', 'Site Manager', 'General Manager', 'Regional Manager', 'Admin']) {
      expect(joined, `role ${role}`).toContain(role);
    }
    await closeDialog(page);
  });

  test('18.c the new-user form requires name, email and initial password', async ({ page }) => {
    await gotoModule(page, 'users');
    await openCreateForm(page, 'users');
    expect(await dialog(page).locator('[required]').count()).toBeGreaterThanOrEqual(3);
    await closeDialog(page);
  });

  test('18.d a user can be scoped to one property or all sites', async ({ page }) => {
    await gotoModule(page, 'users');
    await openCreateForm(page, 'users');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    expect(joined).toMatch(/All Sites/i);
    expect(joined).toMatch(/Brit Hotel/i);
    await closeDialog(page);
  });
});
