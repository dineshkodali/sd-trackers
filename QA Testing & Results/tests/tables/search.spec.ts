/**
 * TS-17 — Search. Seeded through the API so the dataset is deterministic.
 */
import { test, expect } from '../helpers/fixtures';
import { gotoModule, filters, bodyRows, rowContaining, isEmptyState } from '../helpers/ui';
import { createRecord, referralPayload } from '../helpers/api';

test.describe('TS-17 Search', () => {
  test.beforeEach(async ({ api, tag, page }) => {
    await createRecord(api, 'referrals', referralPayload({ suName: `${tag}-ALPHA`, referralCouncil: 'Camden Council' }));
    await createRecord(api, 'referrals', referralPayload({ suName: `${tag}-BRAVO`, referralCouncil: 'Westminster City Council' }));
    await createRecord(api, 'referrals', referralPayload({ suName: `${tag}-CHARLIE`, referralCouncil: 'Redbridge Council' }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await gotoModule(page, 'referrals');
    await expect(rowContaining(page, `${tag}-ALPHA`)).toBeVisible({ timeout: 30_000 });
  });

  test('17.1 searching narrows the table to matching rows', async ({ page, tag }) => {
    await filters(page).search.fill(`${tag}-BRAVO`);
    await page.waitForTimeout(1200);
    expect(await bodyRows(page).count()).toBe(1);
    await expect(rowContaining(page, `${tag}-BRAVO`)).toBeVisible();
  });

  test('17.2 clearing the search restores the full set', async ({ page, tag }) => {
    const before = await bodyRows(page).count();
    await filters(page).search.fill(`${tag}-ALPHA`);
    await page.waitForTimeout(1000);
    expect(await bodyRows(page).count()).toBe(1);

    await filters(page).search.fill('');
    await page.waitForTimeout(1200);
    expect(await bodyRows(page).count()).toBe(before);
  });

  test('17.3 a non-matching query yields an explicit empty state', async ({ page }) => {
    await filters(page).search.fill('zzz-definitely-no-such-record-zzz');
    await page.waitForTimeout(1200);
    expect(await isEmptyState(page)).toBe(true);
  });

  test('17.4 search matches the referral council as well as the name', async ({ page, tag }) => {
    await filters(page).search.fill('Redbridge');
    await page.waitForTimeout(1200);
    await expect(rowContaining(page, `${tag}-CHARLIE`)).toBeVisible();
  });

  test('17.5 search is case-insensitive', async ({ page, tag }) => {
    await filters(page).search.fill(`${tag}-bravo`.toLowerCase());
    await page.waitForTimeout(1200);
    await expect(rowContaining(page, `${tag}-BRAVO`)).toBeVisible();
  });

  test('17.6 Reset clears an active search', async ({ page, tag }) => {
    await filters(page).search.fill(`${tag}-ALPHA`);
    await page.waitForTimeout(1000);
    expect(await bodyRows(page).count()).toBe(1);

    await filters(page).reset.click();
    await page.waitForTimeout(1200);
    expect(await bodyRows(page).count()).toBeGreaterThan(1);
  });
});
