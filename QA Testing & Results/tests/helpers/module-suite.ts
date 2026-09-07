/**
 * Reusable per-module test blocks.
 *
 * Every module spec composes these rather than duplicating the same smoke and
 * create-form checks eighteen times. Module-specific behaviour is added
 * alongside in the individual spec file.
 */
import { test, expect } from './fixtures';
import { MODULES, ModuleKey } from './env';
import {
  gotoModule, openCreateForm, closeDialog, dialogHeading, dialogFields,
  dialogIsOpen, filters, isEmptyState, watchFailures, watchWrites, submitCreateForm,
} from './ui';

/** The module loads, paints content, and raises no uncaught errors. */
export function rendersCleanly(key: ModuleKey) {
  const def = MODULES[key];
  test(`renders ${def.title} without an uncaught error`, async ({ page }) => {
    const { pageErrors } = watchFailures(page);
    await gotoModule(page, key);
    await expect(page.locator('main')).toBeVisible();
    expect((await page.locator('main').innerText()).trim().length).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });
}

/** The module presents a data table, or an explicit empty state. */
export function hasTableOrEmptyState(key: ModuleKey) {
  const def = MODULES[key];
  test(`${def.title} shows a table or an explicit empty state`, async ({ page }) => {
    await gotoModule(page, key);
    const hasTable = (await page.locator('main table').count()) > 0;
    const empty = await isEmptyState(page);
    expect(hasTable || empty, 'expected either a table or an empty-state message').toBe(true);
  });
}

/** Site / status / search / pager furniture is present on tabular modules. */
export function hasStandardFilters(key: ModuleKey) {
  const def = MODULES[key];
  test(`${def.title} exposes the standard filter controls`, async ({ page }) => {
    await gotoModule(page, key);
    const f = filters(page);
    expect(await f.site.count(), 'site filter').toBeGreaterThan(0);
    expect(await f.search.count(), 'search box').toBeGreaterThan(0);
  });
}

/** The create form opens with the expected heading and closes cleanly. */
export function createFormOpensAndCloses(key: ModuleKey) {
  const def = MODULES[key];
  if (!def.createButton) return;

  test(`${def.title} create form opens with its expected heading`, async ({ page }) => {
    await gotoModule(page, key);
    await openCreateForm(page, key);
    expect(await dialogIsOpen(page)).toBe(true);
    if (def.createModalTitle) {
      await expect(dialogHeading(page)).toHaveText(def.createModalTitle);
    }
    expect(await dialogFields(page).count(), 'form should render controls').toBeGreaterThan(0);
    await closeDialog(page);
  });

  test(`${def.title} create form can be cancelled without writing`, async ({ page }) => {
    await gotoModule(page, key);
    const writes = watchWrites(page);
    await openCreateForm(page, key);
    await closeDialog(page);
    expect(await dialogIsOpen(page)).toBe(false);
    expect(writes.filter((w) => def.entity && w.includes(`/db/${def.entity}`))).toEqual([]);
  });
}

/**
 * Submitting the create form with nothing filled must not write.
 * The app relies on HTML5 `required` only (DEF-09), so the modal stays open.
 */
export function emptySubmitIsBlocked(key: ModuleKey) {
  const def = MODULES[key];
  if (!def.createButton) return;

  test(`${def.title} blocks an empty create submission`, async ({ page }) => {
    await gotoModule(page, key);
    const writes = watchWrites(page);
    await openCreateForm(page, key);
    await submitCreateForm(page, key);

    expect(await dialogIsOpen(page), 'modal should stay open when required fields are empty').toBe(true);
    const created = writes.filter((w) => def.entity && w.includes(`/db/${def.entity}`) && w.startsWith('POST'));
    expect(created, 'no record should be written').toEqual([]);
    await closeDialog(page);
  });
}

/**
 * Convenience: the standard block applied to most modules.
 *
 * `emptySubmit` may be disabled for a module where every required field has a
 * legitimate default, so "submit an untouched form" is not a state the product
 * is specified to reject. That is a deliberate statement about the module, not
 * a way to silence a failure — such modules must assert their own integrity
 * rules instead (see TS-11 Hot Meals).
 */
export function standardModuleSuite(
  key: ModuleKey,
  opts: { filters?: boolean; create?: boolean; emptySubmit?: boolean } = {}
) {
  const { filters: withFilters = true, create = true, emptySubmit = true } = opts;
  rendersCleanly(key);
  hasTableOrEmptyState(key);
  if (withFilters) hasStandardFilters(key);
  if (create && MODULES[key].createButton) {
    createFormOpensAndCloses(key);
    if (emptySubmit) emptySubmitIsBlocked(key);
  }
}
