/**
 * TS-03 — Navigation shell. Every module must render without a crash.
 */
import { test, expect } from '../helpers/fixtures';
import { gotoModule, watchFailures } from '../helpers/ui';
import { MODULES, ModuleKey } from '../helpers/env';

const NAVIGABLE: ModuleKey[] = [
  'dashboard', 'referrals', 'vulnerable', 'challenging', 'maintenance', 'spcd',
  'laundry', 'food', 'escalations', 'documents', 'reports', 'audit',
  'requests', 'properties', 'users', 'roles', 'fieldOptions', 'settings',
];

test.describe('TS-03 Navigation shell', () => {
  test('03.1 the sidebar exposes every expected module', async ({ page }) => {
    const labels = (await page.locator('nav button').allInnerTexts())
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    for (const key of NAVIGABLE) {
      const def = MODULES[key];
      if (!def.label) continue;
      expect(
        labels.some((l) => def.label!.test(l)),
        `sidebar should contain ${def.title} (saw: ${labels.join(' / ')})`
      ).toBe(true);
    }
  });

  for (const key of NAVIGABLE) {
    test(`03.2 ${MODULES[key].title} renders without an uncaught error`, async ({ page }) => {
      const { pageErrors } = watchFailures(page);
      await gotoModule(page, key);
      await expect(page.locator('main')).toBeVisible();
      const text = await page.locator('main').innerText();
      expect(text.trim().length, 'view should render content').toBeGreaterThan(0);
      expect(pageErrors, `uncaught errors on ${MODULES[key].title}`).toEqual([]);
    });
  }

  test('03.3 the header exposes the session identity and property scope', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible();
    const header = await page.locator('header').innerText();
    expect(header).toMatch(/Stack Master/i);
    expect(header).toMatch(/Properties|Sites/i);
  });

  test('03.4 Quick Jump opens on the keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(900);
    await expect(page.locator('div.fixed.inset-0').first()).toBeVisible();
  });
});
