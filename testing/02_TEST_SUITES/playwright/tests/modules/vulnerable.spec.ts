/** TS-06 — Vulnerable Service Users module. */
import { test, expect } from '../helpers/fixtures';
import { standardModuleSuite } from '../helpers/module-suite';
import { gotoModule, openCreateForm, closeDialog, dialog } from '../helpers/ui';

test.describe('TS-06 Vulnerable SUs', () => {
  standardModuleSuite('vulnerable');

  test('06.a offers quick-insert vulnerability category chips', async ({ page }) => {
    await gotoModule(page, 'vulnerable');
    await openCreateForm(page, 'vulnerable');
    const chips = dialog(page).locator('button').filter({ hasText: /^\+\s/ });
    expect(await chips.count(), 'expected quick-insert category chips').toBeGreaterThan(0);
    await closeDialog(page);
  });

  test('06.b risk level spans Low to Critical', async ({ page }) => {
    await gotoModule(page, 'vulnerable');
    await openCreateForm(page, 'vulnerable');
    const selects = dialog(page).locator('select');
    let found = false;
    for (let i = 0; i < (await selects.count()); i++) {
      const opts = (await selects.nth(i).locator('option').allInnerTexts()).map((o) => o.trim());
      if (opts.includes('Low') && opts.includes('Critical')) found = true;
    }
    expect(found, 'a risk dropdown should span Low..Critical').toBe(true);
    await closeDialog(page);
  });

  test('06.c demographic groups cover the safeguarding cohorts', async ({ page }) => {
    await gotoModule(page, 'vulnerable');
    await openCreateForm(page, 'vulnerable');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    expect(joined).toMatch(/Pregnant Woman/i);
    expect(joined).toMatch(/Elderly/i);
    expect(joined).toMatch(/Medical Need/i);
    await closeDialog(page);
  });
});
