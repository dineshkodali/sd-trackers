/**
 * TS-Workflows — archive and restore, the safeguarding record lifecycle.
 * Archive is a status transition, not a separate store: a record moves between
 * the Active and Archive views of the same module.
 */
import { test, expect } from '../helpers/fixtures';
import { gotoModule, rowContaining, rowAction, bodyRows, filters, acceptConfirmation, waitForRow } from '../helpers/ui';
import { createRecord, referralPayload, listRecords } from '../helpers/api';

async function openActive(page: any, tag: string) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await gotoModule(page, 'referrals');
  await filters(page).search.fill(tag);
  await page.waitForTimeout(1200);
}

test.describe('TS-Workflows archive and restore', () => {
  test('WF.1 an active referral is listed in the Active view', async ({ page, api, tag }) => {
    await createRecord(api, 'referrals', referralPayload({ suName: tag, status: 'Open' }));
    await openActive(page, tag);
    await expect(rowContaining(page, tag)).toBeVisible({ timeout: 30_000 });
  });

  test('WF.2 an archived referral is absent from the Active view', async ({ page, api, tag }) => {
    await createRecord(api, 'referrals', referralPayload({ suName: tag, status: 'Archived' }));
    await openActive(page, tag);
    await expect(rowContaining(page, tag)).toHaveCount(0);
  });

  test('WF.3 an archived referral appears in the Archive view', async ({ page, api, tag }) => {
    await createRecord(api, 'referrals', referralPayload({ suName: tag, status: 'Archived' }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await gotoModule(page, 'referrals');
    await page.locator('main button').filter({ hasText: /^Archive$/i }).first().click();
    await page.waitForTimeout(1500);
    await filters(page).search.fill(tag);
    await page.waitForTimeout(1200);
    await expect(rowContaining(page, tag)).toBeVisible({ timeout: 20_000 });
  });

  test('WF.4 archiving from the row moves the record out of Active', async ({ page, api, tag }) => {
    await createRecord(api, 'referrals', referralPayload({ suName: tag, status: 'Open' }));
    await openActive(page, tag);
    await expect(rowContaining(page, tag)).toBeVisible({ timeout: 30_000 });

    await rowAction(rowContaining(page, tag), 'Archive').click();
    await page.waitForTimeout(1200);
    await acceptConfirmation(page, /^(archive|confirm|yes)/i);
    await page.waitForTimeout(2000);

    await expect(rowContaining(page, tag)).toHaveCount(0);
    const rows = await listRecords(api, 'referrals');
    const mine = rows.find((r) => JSON.stringify(r).includes(tag));
    expect(mine?.status).toBe('Archived');
  });

  test('WF.5 the Active and Archive views are mutually exclusive', async ({ page, api, tag }) => {
    await createRecord(api, 'referrals', referralPayload({ suName: `${tag}-LIVE`, status: 'Open' }));
    await createRecord(api, 'referrals', referralPayload({ suName: `${tag}-OLD`, status: 'Archived' }));
    await openActive(page, tag);

    await expect(rowContaining(page, `${tag}-LIVE`)).toBeVisible({ timeout: 30_000 });
    await expect(rowContaining(page, `${tag}-OLD`)).toHaveCount(0);

    await page.locator('main button').filter({ hasText: /^Archive$/i }).first().click();
    await page.waitForTimeout(1500);
    await filters(page).search.fill(tag);
    await page.waitForTimeout(1200);

    await expect(rowContaining(page, `${tag}-OLD`)).toBeVisible();
    await expect(rowContaining(page, `${tag}-LIVE`)).toHaveCount(0);
  });

  test('WF.6 the status column is editable inline from the row', async ({ page, api, tag }) => {
    await createRecord(api, 'referrals', referralPayload({ suName: tag, status: 'Open' }));
    await openActive(page, tag);
    await expect(rowContaining(page, tag)).toBeVisible({ timeout: 30_000 });

    const inline = rowContaining(page, tag).locator('select').first();
    expect(await inline.count(), 'row should expose an inline status control').toBeGreaterThan(0);
    const options = (await inline.locator('option').allInnerTexts()).map((o) => o.trim());
    expect(options).toEqual(expect.arrayContaining(['Open', 'In progress', 'Completed']));
  });
});
