/** TS-12 — Escalations Log module. */
import { test, expect } from '../helpers/fixtures';
import { standardModuleSuite } from '../helpers/module-suite';
import { gotoModule, openCreateForm, closeDialog, dialog, field } from '../helpers/ui';

test.describe('TS-12 Escalations Log', () => {
  standardModuleSuite('escalations', { filters: false });

  test('12.a offers the warning-letter escalation ladder', async ({ page }) => {
    await gotoModule(page, 'escalations');
    await openCreateForm(page, 'escalations');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    expect(joined).toMatch(/Warning Letter Issued/i);
    expect(joined).toMatch(/Notice to Quit/i);
    await closeDialog(page);
  });

  test('12.b locks the submitting officer to the signed-in user', async ({ page }) => {
    await gotoModule(page, 'escalations');
    await openCreateForm(page, 'escalations');
    await expect(field(page, 'Submitted By')).toHaveValue(/Stack Master/);
    await closeDialog(page);
  });

  test('12.c requires the incident date, site, service user and notes', async ({ page }) => {
    await gotoModule(page, 'escalations');
    await openCreateForm(page, 'escalations');
    expect(await dialog(page).locator('[required]').count()).toBeGreaterThanOrEqual(5);
    await closeDialog(page);
  });

  /**
   * Replaced an invalid assertion.
   *
   * The previous version tried to detect DEF-07 (a dropdown whose configured
   * default is absent from its own option list) by comparing `inputValue()`
   * against the rendered options. That check can never fail: when a select's
   * value is not among its options the browser falls back to the first option,
   * so the value read back is always a member of the list. The test was marked
   * `test.fail()` and then "passed", which is how the flaw surfaced.
   *
   * DEF-07 is real but not observable through the DOM — it needs a source-level
   * or unit check against the field-options catalogue. What is verifiable here
   * is that the control resolves to a usable value from a populated list.
   */
  test('12.d the status control resolves to a usable value', async ({ page }) => {
    await gotoModule(page, 'escalations');
    await openCreateForm(page, 'escalations');

    const selects = dialog(page).locator('select');
    let statusChecked = false;
    for (let i = 0; i < (await selects.count()); i++) {
      const s = selects.nth(i);
      const options = (await s.locator('option').allInnerTexts()).map((o) => o.trim());
      if (options.some((o) => /Under Investigation|Resolved/i.test(o))) {
        statusChecked = true;
        expect(options.length, 'status list should be populated').toBeGreaterThan(1);
        expect((await s.inputValue()).trim(), 'status must resolve to a value').not.toBe('');
      }
    }
    expect(statusChecked, 'expected to find the escalation status control').toBe(true);
    await closeDialog(page);
  });
});
