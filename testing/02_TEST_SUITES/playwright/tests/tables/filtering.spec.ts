/**
 * TS-17 — Filtering by site, status and month.
 */
import { test, expect } from '../helpers/fixtures';
import { gotoModule, filters, bodyRows, rowContaining, isEmptyState } from '../helpers/ui';
import { createRecord, referralPayload } from '../helpers/api';

test.describe('TS-17 Filtering', () => {
  test.beforeEach(async ({ api, tag, page }) => {
    await createRecord(api, 'referrals', referralPayload({ suName: `${tag}-BRIT`, site: 'Brit Hotel', status: 'Open' }));
    await createRecord(api, 'referrals', referralPayload({ suName: `${tag}-LAMBETH`, site: 'Holiday Inn Lambeth', status: 'Completed' }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await gotoModule(page, 'referrals');
    await expect(rowContaining(page, `${tag}-BRIT`)).toBeVisible({ timeout: 30_000 });
  });

  test('17.7 the site filter restricts rows to that property', async ({ page, tag }) => {
    await filters(page).site.selectOption({ label: 'Brit Hotel' });
    await page.waitForTimeout(1200);
    await expect(rowContaining(page, `${tag}-BRIT`)).toBeVisible();
    await expect(rowContaining(page, `${tag}-LAMBETH`)).toHaveCount(0);
  });

  test('17.8 the status filter restricts rows to that status', async ({ page, tag }) => {
    await filters(page).status.selectOption({ label: 'Completed' });
    await page.waitForTimeout(1200);
    await expect(rowContaining(page, `${tag}-LAMBETH`)).toBeVisible();
    await expect(rowContaining(page, `${tag}-BRIT`)).toHaveCount(0);
  });

  test('17.9 site and status filters compose', async ({ page, tag }) => {
    await filters(page).site.selectOption({ label: 'Brit Hotel' });
    await filters(page).status.selectOption({ label: 'Completed' });
    await page.waitForTimeout(1200);
    await expect(rowContaining(page, `${tag}-BRIT`)).toHaveCount(0);
    await expect(rowContaining(page, `${tag}-LAMBETH`)).toHaveCount(0);
    expect(await isEmptyState(page)).toBe(true);
  });

  test('17.10 Reset clears every active filter', async ({ page, tag }) => {
    await filters(page).site.selectOption({ label: 'Brit Hotel' });
    await page.waitForTimeout(900);
    await filters(page).reset.click();
    await page.waitForTimeout(1200);
    await expect(rowContaining(page, `${tag}-BRIT`)).toBeVisible();
    await expect(rowContaining(page, `${tag}-LAMBETH`)).toBeVisible();
  });

  test('17.11 the site filter lists the full property estate', async ({ page }) => {
    const options = await filters(page).site.locator('option').allInnerTexts();
    expect(options.length).toBeGreaterThan(10);
    expect(options.join(' ')).toMatch(/Brit Hotel/);
  });

  test('17.12 the status filter offers every lifecycle state', async ({ page }) => {
    const options = (await filters(page).status.locator('option').allInnerTexts()).map((o) => o.trim());
    expect(options).toEqual(expect.arrayContaining(['Open', 'In progress', 'Completed', 'Archived']));
  });
});
