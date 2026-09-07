/** TS-04 — Dashboard, widgets and analytics. */
import { test, expect } from '../helpers/fixtures';
import { gotoModule, dialogIsOpen, closeDialog, watchFailures } from '../helpers/ui';

test.describe('TS-04 Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await gotoModule(page, 'dashboard');
  });

  test('04.1 renders the analytics widgets', async ({ page }) => {
    const text = await page.locator('main').innerText();
    expect(text).toMatch(/Trackers Dashboard/i);
    expect(text).toMatch(/Incident Types/i);
    expect(text).toMatch(/Referral Status Trends/i);
  });

  test('04.2 renders the property and vulnerability breakdowns', async ({ page }) => {
    const text = await page.locator('main').innerText();
    expect(text).toMatch(/Property Portfolio|Operational Load/i);
    expect(text).toMatch(/Vulnerability Risk/i);
  });

  test('04.3 charts draw as SVG rather than failing silently', async ({ page }) => {
    const svgs = await page.locator('main svg').count();
    expect(svgs, 'expected chart output').toBeGreaterThan(3);
  });

  test('04.4 the Quick Incident Log modal opens and closes', async ({ page }) => {
    await page.locator('main button').filter({ hasText: /Quick Incident Log/i }).first().click();
    await page.waitForTimeout(1200);
    expect(await dialogIsOpen(page)).toBe(true);
    await closeDialog(page);
    expect(await dialogIsOpen(page)).toBe(false);
  });

  test('04.5 offers quick-create shortcuts into the safeguarding modules', async ({ page }) => {
    const buttons = (await page.locator('main button').allInnerTexts()).join(' | ');
    expect(buttons).toMatch(/Register New SG Referral/i);
    expect(buttons).toMatch(/Log Vulnerability Assessment/i);
  });

  test('04.6 widget site filters are present', async ({ page }) => {
    expect(await page.locator('main select').count()).toBeGreaterThan(0);
  });

  test('04.7 renders without an uncaught error', async ({ page }) => {
    const { pageErrors } = watchFailures(page);
    await gotoModule(page, 'dashboard');
    await page.waitForTimeout(1500);
    expect(pageErrors).toEqual([]);
  });
});
