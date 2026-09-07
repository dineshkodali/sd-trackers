/**
 * TS-09/10/11 — Operational logging modules: SPCD, Laundry and Hot Meals.
 * These share a weekly-period shape, so they are grouped in one file while
 * keeping a describe block per module.
 */
import { test, expect } from '../helpers/fixtures';
import { standardModuleSuite } from '../helpers/module-suite';
import { gotoModule, openCreateForm, closeDialog, dialog, dialogFields } from '../helpers/ui';

test.describe('TS-09 SPCD Tracker', () => {
  standardModuleSuite('spcd', { filters: false });

  test('09.a locks the reporting officer to the signed-in user', async ({ page }) => {
    await gotoModule(page, 'spcd');
    await openCreateForm(page, 'spcd');
    const values = await dialogFields(page).evaluateAll((els) =>
      els.map((e) => (e as HTMLInputElement).value || ''));
    expect(values.join(' ')).toContain('Stack Master');
    await closeDialog(page);
  });

  test('09.b requires the service user reference fields', async ({ page }) => {
    await gotoModule(page, 'spcd');
    await openCreateForm(page, 'spcd');
    expect(await dialog(page).locator('[required]').count()).toBeGreaterThanOrEqual(5);
    await closeDialog(page);
  });
});

test.describe('TS-10 Laundry Support', () => {
  standardModuleSuite('laundry', { filters: false });

  test('10.a offers Weekly and Monthly log periods', async ({ page }) => {
    await gotoModule(page, 'laundry');
    await openCreateForm(page, 'laundry');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    expect(joined).toMatch(/Weekly/i);
    expect(joined).toMatch(/Monthly/i);
    await closeDialog(page);
  });

  test('10.b states the seven-day ceiling on the period end date', async ({ page }) => {
    await gotoModule(page, 'laundry');
    await openCreateForm(page, 'laundry');
    expect(await dialog(page).innerText()).toMatch(/Max 7 Days/i);
    await closeDialog(page);
  });

  /**
   * BUG-012 regression. The form opened with 115 sent / 115 returned and
   * pre-written remarks, so it had no invalid controls and one click filed a
   * complete compliance record nobody had entered.
   */
  test('10.d attested figures and remarks start empty', async ({ page }) => {
    await gotoModule(page, 'laundry');
    await openCreateForm(page, 'laundry');

    const numbers = dialog(page).locator('input[type="number"]');
    for (let i = 0; i < (await numbers.count()); i++) {
      const label = await numbers.nth(i).evaluate((el: any) => {
        let p = el.parentElement, l = '';
        for (let n = 0; n < 4 && p; n++, p = p.parentElement) {
          const q = p.querySelector('label');
          if (q && !q.contains(el)) { l = q.textContent || ''; break; }
        }
        return l.trim();
      });
      if (/Dirty Laundry Sent|Clean Laundry Returned/i.test(label)) {
        expect(await numbers.nth(i).inputValue(), `${label} must start empty`).toBe('');
      }
    }

    const body = await dialog(page).innerText();
    expect(body, 'no pre-written reconciliation claim').not.toMatch(/Batch verified upon arrival|counts reconciled/i);
    await closeDialog(page);
  });

  test('10.c tracks dirty sent against clean returned', async ({ page }) => {
    await gotoModule(page, 'laundry');
    await openCreateForm(page, 'laundry');
    const text = await dialog(page).innerText();
    expect(text).toMatch(/Dirty Laundry Sent/i);
    expect(text).toMatch(/Clean Laundry Returned/i);
    await closeDialog(page);
  });
});

test.describe('TS-11 Hot Meals Tracker', () => {
  // `emptySubmit` is off here deliberately. Every required field on this form
  // has a legitimate default (site, vendor, week dates, auditor) and an all-zero
  // meal matrix is a valid record, so "an untouched submit must be rejected" is
  // not a defined requirement for this module. The integrity rule that DOES
  // apply — no pre-written attestation — is asserted in 11.d below.
  // Open product question: should an all-zero buffet log be filable at all?
  standardModuleSuite('food', { filters: false, emptySubmit: false });

  /**
   * BUG-012 regression. The notes field arrived pre-filled with
   * "Hot holding temperature logged on arrival at >68°C. Halal certified supply."
   * — a food-safety attestation the operator never made, saved verbatim unless
   * they noticed and overwrote it.
   */
  test('11.d the notes field carries no pre-written safety attestation', async ({ page }) => {
    await gotoModule(page, 'food');
    await openCreateForm(page, 'food');

    const notes = dialog(page).locator('textarea');
    for (let i = 0; i < (await notes.count()); i++) {
      const value = (await notes.nth(i).inputValue()).trim();
      expect(value, 'notes must start empty, not pre-attested').toBe('');
    }

    const body = await dialog(page).innerText();
    expect(body, 'no temperature claim should be pre-written').not.toMatch(/logged on arrival at|Halal certified supply/i);
    await closeDialog(page);
  });

  test('11.a renders the full weekly buffet matrix', async ({ page }) => {
    await gotoModule(page, 'food');
    await openCreateForm(page, 'food');
    expect(await dialogFields(page).count(), 'weekly matrix should expose many inputs').toBeGreaterThan(40);
    await closeDialog(page);
  });

  test('11.b offers the four contracted food vendors', async ({ page }) => {
    await gotoModule(page, 'food');
    await openCreateForm(page, 'food');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    for (const vendor of ['A&M', 'Freshbite', '9 Cuisines', 'Sands']) {
      expect(joined, `vendor ${vendor}`).toContain(vendor);
    }
    await closeDialog(page);
  });

  test('11.c states the seven-day ceiling on the period end date', async ({ page }) => {
    await gotoModule(page, 'food');
    await openCreateForm(page, 'food');
    expect(await dialog(page).innerText()).toMatch(/Max 7 Days/i);
    await closeDialog(page);
  });
});
