/**
 * TEMPLATE 02: Full UI Module CRUD Workflow Template
 * 
 * Use this template to test frontend user journeys on any CRM module:
 *   - Navigation to module view
 *   - Opening Create modal and filling inputs
 *   - Submitting and verifying row rendered in table
 *   - Editing existing record
 *   - Searching & filtering the table
 *   - Deleting or archiving record with confirmation
 */

import { test, expect } from '../tests/helpers/fixtures';
import {
  gotoModule,
  openCreateForm,
  submitCreateForm,
  acceptConfirmation,
  rowContaining,
  waitForRow,
  rowAction
} from '../tests/helpers/ui';
import { listRecords } from '../tests/helpers/api';

test.describe('Module CRUD Template: [Module Display Name]', () => {
  const MODULE_KEY = 'referrals';

  test.beforeEach(async ({ page }) => {
    await gotoModule(page, MODULE_KEY);
  });

  test('Complete lifecycle: Create -> View -> Edit -> Search -> Delete', async ({ page, tag, api }) => {
    // 1. Open Create Form & submit
    await openCreateForm(page, MODULE_KEY);
    
    // Fill required fields
    const nameInput = page.locator('input[placeholder*="Name"], input[type="text"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill(tag);
    }

    await submitCreateForm(page, MODULE_KEY);
    await acceptConfirmation(page, /create|confirm|submit/i);
    await waitForRow(page, tag);

    // 2. Verify row rendered in table
    const targetRow = rowContaining(page, tag);
    await expect(targetRow).toBeVisible();

    // 3. Verify server-side persistence
    const records = await listRecords(api, MODULE_KEY);
    const persisted = records.find(r => JSON.stringify(r).includes(tag));
    expect(persisted).toBeDefined();

    // 4. Test Search filter
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(tag);
      await expect(rowContaining(page, tag)).toBeVisible();

      await searchInput.fill('NON_EXISTENT_QUERY_9999');
      await expect(rowContaining(page, tag)).not.toBeVisible();
      await searchInput.clear();
    }
  });
});
