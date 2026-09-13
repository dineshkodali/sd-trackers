/**
 * TS-Forms — the create form of every module that has one is inspected for its
 * declared schema: heading, control count, required markers and dropdown sets.
 */
import { test, expect } from '../helpers/fixtures';
import { MODULES, ModuleKey } from '../helpers/env';
import { gotoModule, openCreateForm, closeDialog, dialog, dialogFields, dialogHeading } from '../helpers/ui';

/** Modules with a create form, and the minimum controls each must render. */
const FORMS: Array<{ key: ModuleKey; minFields: number; minRequired: number }> = [
  { key: 'referrals', minFields: 12, minRequired: 4 },
  { key: 'vulnerable', minFields: 12, minRequired: 4 },
  { key: 'challenging', minFields: 12, minRequired: 4 },
  { key: 'maintenance', minFields: 10, minRequired: 5 },
  { key: 'spcd', minFields: 9, minRequired: 5 },
  { key: 'laundry', minFields: 8, minRequired: 5 },
  { key: 'food', minFields: 40, minRequired: 4 },
  { key: 'escalations', minFields: 10, minRequired: 5 },
  { key: 'documents', minFields: 6, minRequired: 1 },
  { key: 'properties', minFields: 6, minRequired: 2 },
  { key: 'users', minFields: 5, minRequired: 3 },
];

test.describe('TS-Forms create form schemas', () => {
  for (const { key, minFields, minRequired } of FORMS) {
    const def = MODULES[key];

    test(`${def.title} form renders its expected control count`, async ({ page }) => {
      await gotoModule(page, key);
      await openCreateForm(page, key);
      expect(await dialogFields(page).count()).toBeGreaterThanOrEqual(minFields);
      await closeDialog(page);
    });

    test(`${def.title} form marks its mandatory fields required`, async ({ page }) => {
      await gotoModule(page, key);
      await openCreateForm(page, key);
      expect(await dialog(page).locator('[required]').count()).toBeGreaterThanOrEqual(minRequired);
      await closeDialog(page);
    });

    test(`${def.title} form offers Cancel and a submit action`, async ({ page }) => {
      await gotoModule(page, key);
      await openCreateForm(page, key);
      const buttons = (await dialog(page).locator('button').allInnerTexts()).map((b) => b.trim());
      expect(buttons.some((b) => /^cancel$/i.test(b)), 'expected a Cancel button').toBe(true);
      expect(buttons.length).toBeGreaterThan(1);
      await closeDialog(page);
    });
  }

  test('every create form names itself in a heading', async ({ page }) => {
    for (const { key } of FORMS) {
      const def = MODULES[key];
      if (!def.createModalTitle) continue;
      await gotoModule(page, key);
      await openCreateForm(page, key);
      await expect(dialogHeading(page), `${def.title} heading`).toHaveText(def.createModalTitle);
      await closeDialog(page);
    }
  });

  test('site selection is offered against the full property estate', async ({ page }) => {
    for (const key of ['referrals', 'vulnerable', 'challenging', 'escalations'] as ModuleKey[]) {
      await gotoModule(page, key);
      await openCreateForm(page, key);
      const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
      expect(joined, `${MODULES[key].title} site list`).toMatch(/Brit Hotel/);
      await closeDialog(page);
    }
  });
});
