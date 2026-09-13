/** TS-05 — SG Referrals, the reference CRM module. */
import { test, expect } from '../helpers/fixtures';
import { standardModuleSuite } from '../helpers/module-suite';
import { gotoModule, openCreateForm, closeDialog, dialog, field } from '../helpers/ui';

test.describe('TS-05 SG Referrals', () => {
  standardModuleSuite('referrals');

  test('05.a the create form requires site, council, service user and notes', async ({ page }) => {
    await gotoModule(page, 'referrals');
    await openCreateForm(page, 'referrals');
    const required = await dialog(page).locator('[required]').count();
    expect(required, 'expected the mandatory safeguarding fields to be marked required').toBeGreaterThanOrEqual(4);
    await closeDialog(page);
  });

  test('05.b referral type covers the statutory categories', async ({ page }) => {
    await gotoModule(page, 'referrals');
    await openCreateForm(page, 'referrals');
    const joined = (await dialog(page).locator('select').allInnerTexts()).join(' ');
    expect(joined).toMatch(/Safeguarding Adult/);
    expect(joined).toMatch(/Safeguarding Child/);
    expect(joined).toMatch(/Domestic Abuse/);
    await closeDialog(page);
  });

  test('05.c the raising officer is locked to the signed-in user', async ({ page }) => {
    await gotoModule(page, 'referrals');
    await openCreateForm(page, 'referrals');
    await expect(field(page, 'Raised By')).toHaveValue(/Stack Master/);
    await closeDialog(page);
  });

  test('05.d an Archive view is reachable from the module', async ({ page }) => {
    await gotoModule(page, 'referrals');
    const archive = page.locator('main button').filter({ hasText: /^Archive$/i }).first();
    await expect(archive).toBeVisible();
    await archive.click();
    await page.waitForTimeout(1200);
    expect(await page.locator('main').innerText()).toMatch(/Archived/i);
  });

  /**
   * BUG-010 regression — FIXED 2026-09-07.
   * `getFieldOptions('riskLevels')` queried a category that did not exist, so
   * the control rendered only a fallback option and High / Critical could never
   * be selected — which meant the automated High/Critical safeguarding email
   * alert could not be triggered from the UI at all.
   *
   * Fixed by ADDING a `riskLevels` category matching the RiskLevel union, not by
   * repointing at `incidentRiskFactors` — that category grades incident severity
   * on a different vocabulary (Minor / Moderate / High / Critical) and would have
   * written values outside the RiskLevel type.
   */
  test('05.e BUG-010 urgency offers the full Low..Critical range', async ({ page }) => {
    await gotoModule(page, 'referrals');
    await openCreateForm(page, 'referrals');
    const urgency = field(page, 'Urgency Priority');
    const options = (await urgency.locator('option').allInnerTexts()).map((o) => o.trim());
    expect(options).toEqual(expect.arrayContaining(['Low', 'Medium', 'High', 'Critical']));
    await closeDialog(page);
  });

  test('05.g BUG-010 a Critical urgency can actually be selected', async ({ page }) => {
    await gotoModule(page, 'referrals');
    await openCreateForm(page, 'referrals');
    const urgency = field(page, 'Urgency Priority');
    await urgency.selectOption('Critical');
    expect(await urgency.inputValue()).toBe('Critical');
    await closeDialog(page);
  });

  /**
   * DEF-08. The status filter offers `Pending`, but the create form cannot set
   * it — the two vocabularies disagree.
   */
  test.fail('05.f DEF-08 status vocabulary matches between filter and create form', async ({ page }) => {
    await gotoModule(page, 'referrals');
    const filterOptions = (await page.locator('#filter-status option').allInnerTexts()).map((o) => o.trim());

    await openCreateForm(page, 'referrals');
    const formOptions = (await field(page, 'Status').locator('option').allInnerTexts()).map((o) => o.trim());
    await closeDialog(page);

    const settable = filterOptions.filter((o) => !/^all/i.test(o));
    expect(formOptions).toEqual(expect.arrayContaining(settable));
  });
});
