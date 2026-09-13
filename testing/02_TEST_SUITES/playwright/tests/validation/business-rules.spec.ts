/**
 * TS-Validation — domain rules: reporting periods, locked attribution and
 * constrained option sets.
 */
import { test, expect } from '../helpers/fixtures';
import {
  gotoModule, openCreateForm, submitCreateForm, closeDialog,
  dialog, dialogIsOpen, field,
} from '../helpers/ui';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

test.describe('TS-Validation period rules', () => {
  test('laundry states a seven-day maximum on the reporting period', async ({ page }) => {
    await gotoModule(page, 'laundry');
    await openCreateForm(page, 'laundry');
    expect(await dialog(page).innerText()).toMatch(/Max 7 Days/i);
    await closeDialog(page);
  });

  test('laundry accepts a seven-day period', async ({ page }) => {
    await gotoModule(page, 'laundry');
    await openCreateForm(page, 'laundry');
    const dates = dialog(page).locator('input[type="date"]');
    if (await dates.count() >= 2) {
      await dates.nth(0).fill(iso(new Date()));
      await dates.nth(1).fill(plusDays(6));
      const text = await dialog(page).innerText();
      expect(text).not.toMatch(/exceeds|too long|invalid period/i);
    }
    await closeDialog(page);
  });

  test('a reversed period is not silently accepted', async ({ page }) => {
    await gotoModule(page, 'laundry');
    await openCreateForm(page, 'laundry');
    const dates = dialog(page).locator('input[type="date"]');
    if (await dates.count() >= 2) {
      await dates.nth(0).fill(plusDays(5));
      await dates.nth(1).fill(iso(new Date()));
      await submitCreateForm(page, 'laundry');
      // Either blocked by validation, or the form stays open awaiting correction.
      expect(await dialogIsOpen(page)).toBe(true);
    }
    await closeDialog(page);
  });

  test('hot meals states a seven-day maximum on the reporting period', async ({ page }) => {
    await gotoModule(page, 'food');
    await openCreateForm(page, 'food');
    expect(await dialog(page).innerText()).toMatch(/Max 7 Days/i);
    await closeDialog(page);
  });
});

test.describe('TS-Validation locked attribution', () => {
  const LOCKED: Array<[any, string]> = [
    ['referrals', 'Raised By'],
    ['spcd', 'Raised By'],
    ['escalations', 'Submitted By'],
    ['maintenance', 'Raised By'],
  ];

  for (const [key, label] of LOCKED) {
    test(`${key}: "${label}" is populated from the session and not free text`, async ({ page }) => {
      await gotoModule(page, key);
      await openCreateForm(page, key);
      const control = field(page, label);
      await expect(control).toHaveValue(/Stack Master/);
      const readonly = await control.evaluate((el: any) => el.readOnly === true || el.disabled === true);
      expect(readonly, 'attribution field should not be editable').toBe(true);
      await closeDialog(page);
    });
  }
});

test.describe('TS-Validation constrained option sets', () => {
  test('referral status cannot be set to a free-text value', async ({ page }) => {
    await gotoModule(page, 'referrals');
    await openCreateForm(page, 'referrals');
    const status = field(page, 'Status');
    expect(await status.evaluate((el) => el.tagName)).toBe('SELECT');
    await closeDialog(page);
  });

  test('every dropdown default is a member of its own option list', async ({ page }) => {
    await gotoModule(page, 'referrals');
    await openCreateForm(page, 'referrals');

    const selects = dialog(page).locator('select');
    const mismatches: string[] = [];
    for (let i = 0; i < (await selects.count()); i++) {
      const s = selects.nth(i);
      const value = await s.inputValue();
      const values = await s.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
      if (value && !values.includes(value)) mismatches.push(`${value} not in [${values.join(', ')}]`);
    }
    await closeDialog(page);

    // DEF-07: Method of Referral defaults to a value absent from its options.
    expect(mismatches, 'dropdown defaults should be real options').toEqual([]);
  });
});
