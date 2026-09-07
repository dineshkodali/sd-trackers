/**
 * TS-20 Workflows — the audit trail must record what operators actually did.
 */
import { test, expect } from '../helpers/fixtures';
import {
  gotoModule, openCreateForm, submitCreateForm, acceptConfirmation,
  field, waitForRow, filters, rowContaining, rowAction,
} from '../helpers/ui';
import { listRecords } from '../helpers/api';

async function createReferral(page: any, tag: string) {
  await gotoModule(page, 'referrals');
  await openCreateForm(page, 'referrals');
  await field(page, 'Referral Council').fill('Westminster City Council');
  await field(page, 'Service User (SU) Full Name').fill(tag);
  await field(page, 'Notes - Action').fill('Audit trail test record.');
  await submitCreateForm(page, 'referrals');
  await acceptConfirmation(page, /^Create Referral$/i);
  await waitForRow(page, tag);
}

test.describe('TS-20 Audit trail', () => {
  test('20.1 creating a record appends an audit entry', async ({ page, tag, api }) => {
    const before = (await listRecords(api, 'audit')).length;
    await createReferral(page, tag);
    await page.waitForTimeout(2500);
    const after = (await listRecords(api, 'audit')).length;
    expect(after, 'an audit row should have been written').toBeGreaterThan(before);
  });

  /**
   * The audit write is dispatched fire-and-forget and lands roughly 2.5s after
   * the action (measured: action timestamp 00:32:27.61, row created 00:32:30.13).
   * A fixed 2500ms sleep sat exactly on that boundary and raced. Poll for the row
   * instead — the assertion itself is unchanged.
   */
  /**
   * The audit write is dispatched fire-and-forget and lands a couple of seconds
   * after the action, so this must poll rather than sleep.
   *
   * It polls the cheap COUNT endpoint, not the table. `listRecords('audit')` now
   * returns every row — the fix for BUG-025 removed the silent 1000-row cap — and
   * the table grows with every run, so polling it directly downloaded ~1,900 rows
   * per attempt and timed out under full-suite load. `/api/db/status` answers with
   * a COUNT query, so the table is fetched exactly once, at the end, to assert
   * content.
   *
   * Worth noting: needing to download an entire table to find one record is the
   * practical cost of BUG-010 (no server-side filtering), which remains open.
   */
  test('20.2 the audit entry attributes the action to the signed-in user', async ({ page, tag, api }) => {
    const auditCount = async () => {
      const status = await (await api.get('/api/db/status')).json();
      return Number(status.tables?.audit_trails ?? 0);
    };

    const before = await auditCount();
    await createReferral(page, tag);

    await expect
      .poll(auditCount, { timeout: 30_000, intervals: [1000], message: 'audit trail should grow after a create' })
      .toBeGreaterThan(before);

    const mine = (await listRecords(api, 'audit')).filter((r) => JSON.stringify(r).includes(tag));
    expect(mine.length, 'expected an audit row referencing the new record').toBeGreaterThan(0);
    expect(JSON.stringify(mine), 'audit row should name the acting user').toMatch(/Stack Master/);
  });

  test('20.3 deleting a record is recorded in the audit trail', async ({ page, tag, api }) => {
    await createReferral(page, tag);
    await page.waitForTimeout(1500);

    await filters(page).search.fill(tag);
    await page.waitForTimeout(1200);
    await rowAction(rowContaining(page, tag), 'Delete').click();
    await page.waitForTimeout(1200);
    await acceptConfirmation(page, /^(permanently|delete|confirm|yes)/i);

    // Poll rather than sleep: the audit insert is fire-and-forget and lands a
    // couple of seconds later. Match on the action field specifically — a
    // whole-row regex would also match the `created_at` / `createdBy` columns.
    await expect
      .poll(
        async () =>
          (await listRecords(api, 'audit')).filter(
            (r) => JSON.stringify(r).includes(tag) && String(r.action).toUpperCase() === 'DELETE'
          ).length,
        { timeout: 25_000, message: 'a DELETE audit row should exist' }
      )
      .toBeGreaterThan(0);
  });

  test('20.4 the audit view surfaces recent activity', async ({ page, tag }) => {
    await createReferral(page, tag);
    await page.waitForTimeout(2500);
    await gotoModule(page, 'audit');
    await page.waitForTimeout(2000);
    expect(await page.locator('main').innerText()).toMatch(/CREATE|Referral/i);
  });
});
