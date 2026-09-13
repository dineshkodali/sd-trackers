/**
 * TS-17 — Pagination. Seeds enough rows to force a second page at size 10.
 */
import { test, expect } from '../helpers/fixtures';
import { gotoModule, filters, bodyRows, paginationSummary, rowContaining } from '../helpers/ui';
import { createRecord, referralPayload } from '../helpers/api';

const SEED_COUNT = 12;

test.describe('TS-17 Pagination', () => {
  test.beforeEach(async ({ api, tag, page }) => {
    for (let i = 0; i < SEED_COUNT; i++) {
      await createRecord(api, 'referrals', referralPayload({
        suName: `${tag}-${String(i).padStart(2, '0')}`,
      }));
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await gotoModule(page, 'referrals');
    await expect(rowContaining(page, `${tag}-00`)).toBeVisible({ timeout: 30_000 });
    await filters(page).search.fill(tag);
    await page.waitForTimeout(1200);
  });

  test('17.17 the pager reports an accurate total', async ({ page }) => {
    const { showing } = await paginationSummary(page);
    expect(showing, 'expected a "Showing X - Y of Z" summary').toBeTruthy();
    expect(showing!).toMatch(new RegExp(`of\\s+${SEED_COUNT}`));
  });

  test('17.18 the default page size caps rows at ten', async ({ page }) => {
    await filters(page).pageSize.selectOption('10');
    await page.waitForTimeout(1000);
    expect(await bodyRows(page).count()).toBe(10);
    const { page: label } = await paginationSummary(page);
    expect(label).toMatch(/Page 1 of 2/);
  });

  test('17.19 increasing the page size reveals every row', async ({ page }) => {
    await filters(page).pageSize.selectOption('25');
    await page.waitForTimeout(1000);
    expect(await bodyRows(page).count()).toBe(SEED_COUNT);
    const { page: label } = await paginationSummary(page);
    expect(label).toMatch(/Page 1 of 1/);
  });

  test('17.20 the next control advances to the second page', async ({ page }) => {
    await filters(page).pageSize.selectOption('10');
    await page.waitForTimeout(1000);
    const firstPage = await bodyRows(page).first().innerText();

    await page.locator('button[title="Next Page"]').click();
    await page.waitForTimeout(1000);

    const { page: label } = await paginationSummary(page);
    expect(label).toMatch(/Page 2 of 2/);
    expect(await bodyRows(page).count()).toBe(SEED_COUNT - 10);
    expect(await bodyRows(page).first().innerText()).not.toBe(firstPage);
  });

  test('17.21 first and last controls jump to the ends', async ({ page }) => {
    await filters(page).pageSize.selectOption('10');
    await page.waitForTimeout(900);

    await page.locator('button[title="Last Page"]').click();
    await page.waitForTimeout(900);
    expect((await paginationSummary(page)).page).toMatch(/Page 2 of 2/);

    await page.locator('button[title="First Page"]').click();
    await page.waitForTimeout(900);
    expect((await paginationSummary(page)).page).toMatch(/Page 1 of 2/);
  });

  test('17.22 previous is disabled on the first page', async ({ page }) => {
    await filters(page).pageSize.selectOption('10');
    await page.waitForTimeout(900);
    await expect(page.locator('button[title="Previous Page"]')).toBeDisabled();
    await expect(page.locator('button[title="First Page"]')).toBeDisabled();
  });

  test('17.23 next is disabled on the last page', async ({ page }) => {
    await filters(page).pageSize.selectOption('10');
    await page.waitForTimeout(900);
    await page.locator('button[title="Last Page"]').click();
    await page.waitForTimeout(900);
    await expect(page.locator('button[title="Next Page"]')).toBeDisabled();
  });

  test('17.24 the page size control offers every documented size', async ({ page }) => {
    const values = await filters(page).pageSize.locator('option').evaluateAll((os) =>
      os.map((o) => (o as HTMLOptionElement).value));
    expect(values).toEqual(['10', '25', '50', '100']);
  });
});
