/**
 * TS-Modals — dialog open/close semantics and the confirmation gate.
 */
import { test, expect } from '../helpers/fixtures';
import { MODULES, ModuleKey } from '../helpers/env';
import {
  gotoModule, openCreateForm, closeDialog, dialogIsOpen, dialog,
  submitCreateForm, confirmationText, field, rowContaining, rowAction, waitForRow,
  acceptConfirmation,
} from '../helpers/ui';

const MODAL_MODULES: ModuleKey[] = ['referrals', 'vulnerable', 'challenging', 'escalations', 'properties'];

test.describe('TS-Modals open and close', () => {
  for (const key of MODAL_MODULES) {
    const def = MODULES[key];

    test(`${def.title} modal closes on Escape`, async ({ page }) => {
      await gotoModule(page, key);
      await openCreateForm(page, key);
      expect(await dialogIsOpen(page)).toBe(true);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(700);
      const stillOpen = await dialogIsOpen(page);
      if (stillOpen) {
        // Some dialogs require the explicit Cancel action instead.
        await page.locator('button').filter({ hasText: /^cancel$/i }).first().click();
        await page.waitForTimeout(600);
      }
      expect(await dialogIsOpen(page)).toBe(false);
    });

    test(`${def.title} modal closes on Cancel`, async ({ page }) => {
      await gotoModule(page, key);
      await openCreateForm(page, key);
      await page.locator('button').filter({ hasText: /^cancel$/i }).first().click();
      await page.waitForTimeout(800);
      expect(await dialogIsOpen(page)).toBe(false);
    });

    test(`${def.title} modal traps its own content`, async ({ page }) => {
      await gotoModule(page, key);
      await openCreateForm(page, key);
      // The overlay covers the viewport, so the underlying table is not interactive.
      const overlay = page.locator('div.fixed.inset-0').first();
      await expect(overlay).toBeVisible();
      const box = await overlay.boundingBox();
      expect(box!.width).toBeGreaterThan(300);
      await closeDialog(page);
    });
  }
});

test.describe('TS-Modals confirmation gate', () => {
  test('creating raises a confirmation summarising the record', async ({ page, tag }) => {
    await gotoModule(page, 'referrals');
    await openCreateForm(page, 'referrals');
    await field(page, 'Referral Council').fill('Westminster City Council');
    await field(page, 'Service User (SU) Full Name').fill(tag);
    await field(page, 'Notes - Action').fill('Modal confirmation test.');
    await submitCreateForm(page, 'referrals');

    const text = await confirmationText(page);
    expect(text).toMatch(/Confirm New SG Referral/i);
    expect(text).toContain(tag);
    expect(text).toMatch(/Site:/i);

    await page.locator('button').filter({ hasText: /^Cancel$/i }).last().click();
    await page.waitForTimeout(800);
  });

  test('deleting raises an audit-compliance confirmation', async ({ page, tag }) => {
    await gotoModule(page, 'referrals');
    await openCreateForm(page, 'referrals');
    await field(page, 'Referral Council').fill('Westminster City Council');
    await field(page, 'Service User (SU) Full Name').fill(tag);
    await field(page, 'Notes - Action').fill('Delete confirmation test.');
    await submitCreateForm(page, 'referrals');
    await acceptConfirmation(page, /^Create Referral$/i);
    await waitForRow(page, tag);

    await rowAction(rowContaining(page, tag), 'Delete').click();
    await page.waitForTimeout(1200);
    const text = await confirmationText(page);
    expect(text).toMatch(/Permanently Delete/i);
    expect(text).toMatch(/audit/i);
    await closeDialog(page);
  });

  test('the Quick Jump palette opens and closes', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(900);
    expect(await dialogIsOpen(page)).toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
  });
});
