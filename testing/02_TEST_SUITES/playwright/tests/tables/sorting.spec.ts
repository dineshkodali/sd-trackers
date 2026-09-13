/**
 * TS-17 — Column sorting. Needs a deterministic multi-row dataset, so rows are
 * seeded with names that sort unambiguously.
 */
import { test, expect } from '../helpers/fixtures';
import { gotoModule, bodyRows, rowContaining, filters } from '../helpers/ui';
import { createRecord, referralPayload } from '../helpers/api';

/** Text of the column under test, for every visible row. */
async function columnValues(page: any, columnIndex: number): Promise<string[]> {
  const n = await bodyRows(page).count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(((await bodyRows(page).nth(i).locator('td').nth(columnIndex).innerText()) || '').trim());
  }
  return out;
}

/** Index of the header cell whose text matches, or -1. */
async function headerIndex(page: any, label: RegExp): Promise<number> {
  const heads = await page.locator('main table thead th').allInnerTexts();
  return heads.findIndex((h: string) => label.test(h.trim()));
}

test.describe('TS-17 Sorting', () => {
  test.beforeEach(async ({ api, tag, page }) => {
    await createRecord(api, 'referrals', referralPayload({ suName: `${tag}-CHARLIE`, dateReferred: '2026-03-01' }));
    await createRecord(api, 'referrals', referralPayload({ suName: `${tag}-ALPHA`, dateReferred: '2026-01-01' }));
    await createRecord(api, 'referrals', referralPayload({ suName: `${tag}-BRAVO`, dateReferred: '2026-02-01' }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await gotoModule(page, 'referrals');
    await expect(rowContaining(page, `${tag}-ALPHA`)).toBeVisible({ timeout: 30_000 });
    // Isolate the seeded rows so pre-existing data cannot perturb the order.
    await filters(page).search.fill(tag);
    await page.waitForTimeout(1200);
    await expect(bodyRows(page)).toHaveCount(3);
  });

  test('17.13 the service user column sorts ascending on first click', async ({ page }) => {
    const idx = await headerIndex(page, /SU Name|Service User/i);
    expect(idx, 'expected a service-user column').toBeGreaterThan(-1);

    await page.locator('main table thead th').nth(idx).click();
    await page.waitForTimeout(1000);

    const values = await columnValues(page, idx);
    expect(values).toEqual([...values].sort((a, b) => a.localeCompare(b)));
  });

  test('17.14 a second click reverses the order', async ({ page }) => {
    const idx = await headerIndex(page, /SU Name|Service User/i);
    const th = page.locator('main table thead th').nth(idx);

    await th.click();
    await page.waitForTimeout(900);
    const asc = await columnValues(page, idx);

    await th.click();
    await page.waitForTimeout(900);
    const desc = await columnValues(page, idx);

    expect(desc).toEqual([...asc].reverse());
  });

  test('17.15 the date column sorts chronologically', async ({ page }) => {
    const idx = await headerIndex(page, /Date Referred|Date/i);
    expect(idx).toBeGreaterThan(-1);

    await page.locator('main table thead th').nth(idx).click();
    await page.waitForTimeout(1000);

    const values = (await columnValues(page, idx)).filter(Boolean);
    const sorted = [...values].sort();
    expect(values).toEqual(sorted);
  });

  test('17.16 sorting preserves the row count', async ({ page }) => {
    const before = await bodyRows(page).count();
    const idx = await headerIndex(page, /SU Name|Service User/i);
    await page.locator('main table thead th').nth(idx).click();
    await page.waitForTimeout(900);
    expect(await bodyRows(page).count()).toBe(before);
  });
});
