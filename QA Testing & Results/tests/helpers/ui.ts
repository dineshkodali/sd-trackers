/**
 * UI helpers.
 *
 * All selector fragility is contained here on purpose. The app ships zero
 * `data-testid`s, no `id`/`name` on form controls, and no `for` on labels, so
 * `getByLabel()` cannot work. Fields are therefore located by "the first form
 * control following this label in document order", which is stable against
 * restyling but not against markup reordering. When testids land, only this
 * file should need to change.
 */
import { Page, BrowserContext, Locator, expect } from '@playwright/test';
import { MASTER, MODULES, ModuleKey, STORAGE_KEYS } from './env';

/* ------------------------------------------------------------------ session */

/**
 * Seed an authenticated session directly into localStorage.
 * Faster than a UI login and, crucially, leaves no cached entity data behind,
 * so each test syncs fresh from the database.
 */
export async function injectSession(context: BrowserContext) {
  // A real, server-signed token is required: the API verifies signatures, so a
  // fabricated `sm-jwt-...` string is now rejected (BUG-002), and every data
  // route demands a valid session (BUG-001).
  const { getAuthToken } = await import('./api');
  const token = await getAuthToken();

  await context.addInitScript(
    ([tokenKey, userKey, roleKey, user, sessionToken]: [string, string, string, any, string]) => {
      localStorage.setItem(tokenKey, JSON.stringify(sessionToken));
      localStorage.setItem(userKey, JSON.stringify(user));
      localStorage.setItem(roleKey, JSON.stringify(user.role));
    },
    [
      STORAGE_KEYS.token,
      STORAGE_KEYS.user,
      STORAGE_KEYS.role,
      {
        id: MASTER.id,
        email: MASTER.email,
        name: MASTER.name,
        role: MASTER.role,
        assignedSite: 'All Sites',
      },
      token,
    ] as any
  );
}

export function loginForm(page: Page) {
  return {
    email: page.locator('input[type="email"]').first(),
    password: page.locator('input[type="password"]').first(),
    submit: page.getByRole('button', { name: /sign in/i }).first(),
  };
}

export async function loginViaUI(page: Page, email = MASTER.email, password = MASTER.password) {
  const f = loginForm(page);
  await f.email.waitFor({ state: 'visible', timeout: 30_000 });
  await f.email.fill(email);
  await f.password.fill(password);
  await f.submit.click();
}

export async function waitForAppShell(page: Page) {
  // Never use networkidle here: the background sync never goes idle.
  await page.locator('nav button').first().waitFor({ state: 'visible', timeout: 45_000 });
}

export async function isLoggedOut(page: Page) {
  return (await page.locator('input[type="password"]').count()) > 0;
}

/**
 * Sign out through the header menu.
 *
 * The menu is rendered by React after the shell paints, so the Sign Out entry
 * is waited for explicitly rather than probed with `count()` — clicking before
 * it exists was the cause of a flaky timeout. The app performs no logout
 * confirmation dialog, so none is dismissed here.
 */
export async function logout(page: Page) {
  await waitForAppShell(page);

  const user = page.locator('header button').filter({ hasText: new RegExp(MASTER.name, 'i') }).first();
  await user.waitFor({ state: 'visible', timeout: 20_000 });
  await user.click();

  // Actual label is "Sign Out (Revoke Session)".
  const out = page.locator('button').filter({ hasText: /log ?out|sign ?out/i }).first();
  await out.waitFor({ state: 'visible', timeout: 15_000 });
  await out.click();

  await page.locator('input[type="password"]').first().waitFor({ state: 'visible', timeout: 20_000 });
}

/* --------------------------------------------------------------- navigation */

export async function openApp(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForAppShell(page);
}

export async function gotoModule(page: Page, key: ModuleKey) {
  const def = MODULES[key];
  await waitForAppShell(page);
  const byLabel = def.label
    ? page.locator('nav button').filter({ hasText: def.label }).first()
    : null;
  const target = byLabel && (await byLabel.count()) ? byLabel : page.locator('nav button').nth(def.index);
  await target.click();
  // The view swap is synchronous React state; give it a beat to paint.
  await page.locator('main').waitFor({ state: 'visible' });
  await page.waitForTimeout(900);
}

/* -------------------------------------------------------------------- modal */

/** The app's modal root: a fixed full-screen overlay. There is no role="dialog". */
export function dialog(page: Page): Locator {
  return page.locator('div.fixed.inset-0').last();
}

export async function dialogIsOpen(page: Page) {
  return (await page.locator('div.fixed.inset-0').count()) > 0;
}

export async function closeDialog(page: Page) {
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(400);
  const cancel = page.locator('button').filter({ hasText: /^(cancel|close|discard)$/i }).first();
  if (await cancel.count()) await cancel.click({ timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

export function dialogHeading(page: Page) {
  return dialog(page).locator('h1, h2, h3').first();
}

/**
 * A form control located by its visible label text.
 * Returns the first input/select/textarea that follows the label in the DOM.
 */
export function field(page: Page, label: string): Locator {
  const xp =
    `xpath=//div[contains(@class,"fixed")]//label[contains(normalize-space(.), ${xpathLiteral(label)})]` +
    `/following::*[self::input or self::select or self::textarea][1]`;
  return page.locator(xp).first();
}

/** Escapes a string for safe embedding in an XPath expression. */
export function xpathLiteral(s: string): string {
  if (!s.includes("'")) return `'${s}'`;
  if (!s.includes('"')) return `"${s}"`;
  return `concat('${s.replace(/'/g, `', "'", '`)}')`;
}

/** All form controls inside the modal, in DOM order. */
export function dialogFields(page: Page): Locator {
  return dialog(page).locator('input, select, textarea');
}

/* ------------------------------------------------------------- create flows */

export async function openCreateForm(page: Page, key: ModuleKey) {
  const def = MODULES[key];
  if (!def.createButton) throw new Error(`${key} has no create button`);
  await page.locator('main button').filter({ hasText: def.createButton }).first().click();
  await page.locator('div.fixed.inset-0').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(600);
}

export async function submitCreateForm(page: Page, key: ModuleKey) {
  const def = MODULES[key];
  const btn = page.locator('button').filter({ hasText: def.submitButton ?? /save|submit|confirm|add/i }).last();
  await btn.click();
  await page.waitForTimeout(1200);
}

/** Accept the app's create/update/delete confirmation dialog, if one appeared. */
export async function acceptConfirmation(page: Page, label: RegExp = /^(create|confirm|yes|save|update|proceed|permanently|delete|archive)/i) {
  const btn = page.locator('button').filter({ hasText: label }).last();
  if (await btn.count()) {
    await btn.click().catch(() => undefined);
    await page.waitForTimeout(1600);
    return true;
  }
  return false;
}

export async function confirmationText(page: Page) {
  if (!(await dialogIsOpen(page))) return null;
  return (await dialog(page).innerText().catch(() => '')) || null;
}

/* -------------------------------------------------------------------- table */

export function table(page: Page) {
  return page.locator('main table').first();
}

export function bodyRows(page: Page) {
  return page.locator('main table tbody tr');
}

/** Rows that hold real data, excluding the "no records found" placeholder. */
export function dataRows(page: Page) {
  return bodyRows(page).filter({ hasNot: page.locator('td[colspan]') });
}

export async function rowTexts(page: Page): Promise<string[]> {
  const n = await bodyRows(page).count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(((await bodyRows(page).nth(i).innerText()) || '').replace(/\s+/g, ' ').trim());
  }
  return out;
}

export function rowContaining(page: Page, text: string) {
  return bodyRows(page).filter({ hasText: text }).first();
}

/** Row action buttons carry only a `title`; match on a fragment of it. */
export function rowAction(row: Locator, titleFragment: string) {
  return row.locator(`button[title*="${titleFragment}"]`).first();
}

export async function isEmptyState(page: Page) {
  const txt = ((await page.locator('main').innerText().catch(() => '')) || '').toLowerCase();
  return /no .*records? found|no data|nothing to display/.test(txt);
}

/** Wait until a row containing `text` is present (sync arrives asynchronously). */
export async function waitForRow(page: Page, text: string, timeout = 25_000) {
  await expect(bodyRows(page).filter({ hasText: text }).first()).toBeVisible({ timeout });
}

/* ------------------------------------------------------------------ filters */

export const filters = (page: Page) => ({
  site: page.locator('#filter-site'),
  month: page.locator('#filter-month'),
  status: page.locator('#filter-status'),
  pageSize: page.locator('#select-page-size'),
  search: page.locator('main input[type="text"]').first(),
  reset: page.locator('main button').filter({ hasText: /^reset$/i }).first(),
});

export async function paginationSummary(page: Page) {
  const txt = (await page.locator('main').innerText().catch(() => '')) || '';
  return {
    showing: (txt.match(/Showing\s+\d+\s*-\s*\d+\s+of\s+\d+/i) || [null])[0],
    page: (txt.match(/Page\s+\d+\s+of\s+\d+/i) || [null])[0],
  };
}

/* ------------------------------------------------------------- diagnostics */

/** Collect uncaught page errors and failed responses for error-handling specs. */
export function watchFailures(page: Page) {
  const pageErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
  page.on('response', (r) => {
    if (r.status() >= 400) failedResponses.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  return { pageErrors, failedResponses };
}

/** Non-GET API traffic, for asserting that a blocked form writes nothing. */
export function watchWrites(page: Page) {
  const writes: string[] = [];
  page.on('request', (rq) => {
    if (rq.url().includes('/api/') && rq.method() !== 'GET') {
      writes.push(`${rq.method()} ${new URL(rq.url()).pathname}`);
    }
  });
  return writes;
}
