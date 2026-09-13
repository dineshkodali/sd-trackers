/** TS-07 — Challenging Service Users module. */
import { test, expect } from '../helpers/fixtures';
import { standardModuleSuite } from '../helpers/module-suite';
import { gotoModule, openCreateForm, closeDialog, dialog } from '../helpers/ui';

test.describe('TS-07 Challenging SUs', () => {
  standardModuleSuite('challenging');

  test('07.a offers quick-insert incident type chips', async ({ page }) => {
    await gotoModule(page, 'challenging');
    await openCreateForm(page, 'challenging');
    const chips = dialog(page).locator('button').filter({ hasText: /^\+\s/ });
    expect(await chips.count()).toBeGreaterThan(0);
    await closeDialog(page);
  });

  test('07.b incident types cover the behavioural categories', async ({ page }) => {
    await gotoModule(page, 'challenging');
    await openCreateForm(page, 'challenging');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    expect(joined).toMatch(/Physical Altercation|Violence/i);
    expect(joined).toMatch(/Substance Misuse/i);
    await closeDialog(page);
  });

  test('07.c risk factor spans Low to Critical', async ({ page }) => {
    await gotoModule(page, 'challenging');
    await openCreateForm(page, 'challenging');
    const selects = dialog(page).locator('select');
    let found = false;
    for (let i = 0; i < (await selects.count()); i++) {
      const opts = (await selects.nth(i).locator('option').allInnerTexts()).map((o) => o.trim());
      if (opts.includes('Low') && opts.includes('Critical')) found = true;
    }
    expect(found).toBe(true);
    await closeDialog(page);
  });
});
