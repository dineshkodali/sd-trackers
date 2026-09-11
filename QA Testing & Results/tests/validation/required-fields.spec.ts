/**
 * TS-Validation — mandatory field enforcement.
 *
 * The app relies on native HTML5 `required` (DEF-09): the Zod schemas in
 * src/utils/validationSchemas.ts are never invoked by any view. These tests
 * assert the behaviour that actually protects the data today, and flag the gap.
 */
import { test, expect } from '../helpers/fixtures';
import { MODULES, ModuleKey } from '../helpers/env';
import {
  gotoModule, openCreateForm, submitCreateForm, closeDialog,
  dialog, dialogIsOpen, field, watchWrites,
} from '../helpers/ui';
import { listRecords } from '../helpers/api';

const CREATE_MODULES: ModuleKey[] = [
  'referrals', 'vulnerable', 'challenging', 'maintenance',
  'spcd', 'laundry', 'escalations', 'properties', 'users',
];

test.describe('TS-Validation required fields', () => {
  for (const key of CREATE_MODULES) {
    const def = MODULES[key];

    test(`${def.title} refuses an entirely empty submission`, async ({ page }) => {
      await gotoModule(page, key);
      const writes = watchWrites(page);
      await openCreateForm(page, key);
      await submitCreateForm(page, key);

      expect(await dialogIsOpen(page), 'form should remain open').toBe(true);
      const posts = writes.filter((w) => w.startsWith('POST') && def.entity && w.includes(`/db/${def.entity}`));
      expect(posts, 'nothing should be written').toEqual([]);
      await closeDialog(page);
    });

    test(`${def.title} reports at least one invalid control on empty submit`, async ({ page }) => {
      await gotoModule(page, key);
      await openCreateForm(page, key);
      await submitCreateForm(page, key);
      const invalid = await dialog(page).locator(':invalid').count();
      expect(invalid, 'browser validation should block the submission').toBeGreaterThan(0);
      await closeDialog(page);
    });
  }

  test('a referral missing only the service user name is still blocked', async ({ page, tag, api }) => {
    await gotoModule(page, 'referrals');
    await openCreateForm(page, 'referrals');
    await field(page, 'Referral Council').selectOption('Westminster City Council');
    await field(page, 'Port / NASS Ref').fill(`PORT-${tag.slice(-6)}`);
    await field(page, 'Actions Taken & Case Details').fill(`${tag} partial submission`);
    // Service user name deliberately left empty.
    await submitCreateForm(page, 'referrals');

    expect(await dialogIsOpen(page)).toBe(true);
    const rows = await listRecords(api, 'referrals');
    expect(rows.filter((r) => JSON.stringify(r).includes(tag))).toHaveLength(0);
    await closeDialog(page);
  });

  /**
   * DEF-09. The Zod schema requires mosaicId, portRef and dob for a referral,
   * but the form marks none of them required and no view calls the validator.
   * Until validation is wired up, these save empty.
   */
  test.fail('DEF-09 referral identity references should be mandatory', async ({ page }) => {
    await gotoModule(page, 'referrals');
    await openCreateForm(page, 'referrals');
    for (const label of ['Port / NASS Reference', 'Mosaic ID', 'Date of Birth']) {
      await expect(field(page, label), `${label} should be required`).toHaveAttribute('required', /.*/);
    }
    await closeDialog(page);
  });

  /**
   * DEF-09. Blocked submissions surface only native browser tooltips; the app
   * renders no inline error text of its own.
   */
  test.fail('DEF-09 blocked submissions should show inline error messages', async ({ page }) => {
    await gotoModule(page, 'referrals');
    await openCreateForm(page, 'referrals');
    await submitCreateForm(page, 'referrals');
    const text = await dialog(page).innerText();
    expect(text).toMatch(/required|must be|please enter|cannot be empty/i);
    await closeDialog(page);
  });
});
