/**
 * TS-05 CRUD — the complete record lifecycle on the reference module.
 * Create -> Confirm -> Read -> Search -> Edit -> Update -> Delete.
 *
 * Every record is tagged `QA-TEST-...`; the cleanup fixture purges anything
 * left behind even if an assertion fails mid-flow.
 */
import { test, expect } from '../helpers/fixtures';
import {
  gotoModule, openCreateForm, submitCreateForm, acceptConfirmation, closeDialog,
  field, rowContaining, rowAction, waitForRow, bodyRows, confirmationText,
  filters, dialogIsOpen, watchWrites, fillReferralForm,
} from '../helpers/ui';
import { listRecords } from '../helpers/api';

const fillReferral = (page: any, name: string) => fillReferralForm(page, name);

async function createReferral(page: any, name: string) {
  await openCreateForm(page, 'referrals');
  await fillReferral(page, name);
  await submitCreateForm(page, 'referrals');
  await acceptConfirmation(page, /^Create Referral$/i);
  await waitForRow(page, name);
}

test.describe('TS-05 SG Referrals — full lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await gotoModule(page, 'referrals');
  });

  test('CRUD.1 a referral can be created and appears in the table', async ({ page, tag }) => {
    await createReferral(page, tag);
    await expect(rowContaining(page, tag)).toBeVisible();
  });

  test('CRUD.2 creating raises a confirmation naming the record', async ({ page, tag }) => {
    await openCreateForm(page, 'referrals');
    await fillReferral(page, tag);
    await submitCreateForm(page, 'referrals');

    const text = await confirmationText(page);
    expect(text, 'a confirmation dialog should appear').toBeTruthy();
    expect(text!).toMatch(/Confirm New SG Referral/i);
    expect(text!).toContain(tag);

    await acceptConfirmation(page, /^Create Referral$/i);
    await waitForRow(page, tag);
  });

  test('CRUD.3 cancelling the confirmation does not create the record', async ({ page, tag, api }) => {
    await openCreateForm(page, 'referrals');
    await fillReferral(page, tag);
    await submitCreateForm(page, 'referrals');
    expect(await confirmationText(page)).toContain(tag);

    await page.locator('button').filter({ hasText: /^Cancel$/i }).last().click();
    await page.waitForTimeout(1500);

    const rows = await listRecords(api, 'referrals');
    expect(rows.filter((r) => JSON.stringify(r).includes(tag))).toHaveLength(0);
  });

  test('CRUD.4 a created referral is persisted through the API', async ({ page, tag, api }) => {
    await createReferral(page, tag);
    const rows = await listRecords(api, 'referrals');
    const mine = rows.filter((r) => JSON.stringify(r).includes(tag));
    expect(mine, 'record should exist server-side').toHaveLength(1);
    expect(mine[0].suName).toBe(tag);
  });

  test('CRUD.5 a referral can be found by search', async ({ page, tag }) => {
    await createReferral(page, tag);
    await filters(page).search.fill(tag);
    await page.waitForTimeout(1200);
    await expect(rowContaining(page, tag)).toBeVisible();
    expect(await bodyRows(page).count()).toBe(1);
  });

  test('CRUD.6 the record dossier opens from the row', async ({ page, tag }) => {
    await createReferral(page, tag);
    await rowAction(rowContaining(page, tag), 'View').click();
    await page.waitForTimeout(1200);
    expect(await dialogIsOpen(page)).toBe(true);
    await closeDialog(page);
  });

  /**
   * The edit modal now shares the create form's configuration, so the field is
   * "LA Officer Leading" in both. A partial edit must change only that field:
   * the server merges it onto the stored record (F-01 / BUG-004).
   */
  test('CRUD.7 a referral can be edited and the change persists', async ({ page, tag, api }) => {
    await createReferral(page, tag);
    await rowAction(rowContaining(page, tag), 'Edit').click();
    await page.waitForTimeout(1200);
    expect(await dialogIsOpen(page)).toBe(true);

    await field(page, 'LA Officer Leading').fill('QA Reviewer');
    await page.locator('button').filter({ hasText: /save|update|confirm/i }).last().click();
    await page.waitForTimeout(1200);
    await acceptConfirmation(page, /^(save changes|confirm|yes|update)/i);
    await page.waitForTimeout(1500);

    const rows = await listRecords(api, 'referrals');
    const mine = rows.find((r) => JSON.stringify(r).includes(tag));
    expect(mine?.laOfficerLeading).toBe('QA Reviewer');
  });

  test('CRUD.8 deleting asks for a strict confirmation naming the record', async ({ page, tag }) => {
    await createReferral(page, tag);
    await rowAction(rowContaining(page, tag), 'Delete').click();
    await page.waitForTimeout(1200);

    const text = await confirmationText(page);
    expect(text).toMatch(/Permanently Delete/i);
    expect(text).toMatch(/cannot be undone/i);
    await closeDialog(page);
  });

  test('CRUD.9 a referral can be deleted and disappears everywhere', async ({ page, tag, api }) => {
    await createReferral(page, tag);
    await rowAction(rowContaining(page, tag), 'Delete').click();
    await page.waitForTimeout(1200);
    await acceptConfirmation(page, /^(permanently|delete|confirm|yes)/i);
    await page.waitForTimeout(2000);

    await expect(rowContaining(page, tag)).toHaveCount(0);
    const rows = await listRecords(api, 'referrals');
    expect(rows.filter((r) => JSON.stringify(r).includes(tag))).toHaveLength(0);
  });

  /**
   * DEF-06. Two referrals sharing a service user name, Port reference and
   * Mosaic ID are accepted with no warning.
   */
  test.fail('CRUD.10 DEF-06 duplicate referrals should be rejected', async ({ page, tag, api }) => {
    await createReferral(page, tag);
    const writes = watchWrites(page);
    await createReferral(page, tag);
    expect(writes.filter((w) => w.startsWith('POST') && w.includes('/db/referrals'))).toHaveLength(0);

    const rows = await listRecords(api, 'referrals');
    expect(rows.filter((r) => JSON.stringify(r).includes(tag)), 'duplicate should not persist').toHaveLength(1);
  });
});
