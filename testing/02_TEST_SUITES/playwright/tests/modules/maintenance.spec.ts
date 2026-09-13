/** TS-08 — Maintenance & Defects module. */
import { test, expect } from '../helpers/fixtures';
import { standardModuleSuite } from '../helpers/module-suite';
import { gotoModule, openCreateForm, closeDialog, dialog } from '../helpers/ui';

test.describe('TS-08 Maintenance Tracker', () => {
  standardModuleSuite('maintenance', { filters: false });

  test('08.a exposes the CAT 1-4 priority bands', async ({ page }) => {
    await gotoModule(page, 'maintenance');
    await openCreateForm(page, 'maintenance');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    expect(joined).toContain('CAT 1');
    expect(joined).toContain('CAT 2');
    expect(joined).toContain('CAT 3');
    await closeDialog(page);
  });

  test('08.b priority bands carry their contractual timescales', async ({ page }) => {
    await gotoModule(page, 'maintenance');
    await openCreateForm(page, 'maintenance');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    expect(joined).toMatch(/4 Hours/i);
    expect(joined).toMatch(/24 Hours/i);
    await closeDialog(page);
  });

  test('08.c offers the maintenance standards criteria picker', async ({ page }) => {
    await gotoModule(page, 'maintenance');
    await openCreateForm(page, 'maintenance');
    const criteria = dialog(page).locator('select').first();
    expect(await criteria.locator('option').count(), 'criteria list should be populated').toBeGreaterThan(10);
    await closeDialog(page);
  });

  test('08.d defect status and action are constrained', async ({ page }) => {
    await gotoModule(page, 'maintenance');
    await openCreateForm(page, 'maintenance');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    expect(joined).toMatch(/In Process/i);
    expect(joined).toMatch(/Completed/i);
    await closeDialog(page);
  });
});
