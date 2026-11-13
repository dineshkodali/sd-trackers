/**
 * Builds the iOS design reference: renders every mock-up to PNG and writes the documents.
 *   node design/ios/tools/build.cjs            (needs: npm i is already done; uses installed Chrome)
 * Read-only with respect to the web app. Output goes to design/ios/ only.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const OUT = path.resolve(__dirname, '..');
const audit = JSON.parse(fs.readFileSync(path.join(OUT, 'data/audit.json'), 'utf8'));
const U = require('./lib/ui.cjs');
const G = require('./lib/generic.cjs');
const X = require('./lib/special.cjs');
const A = require('./lib/admin.cjs');
const { PAGES, SUBSCREENS } = require('./lib/pages.cjs');
const { ROLES, PERMS, canSee, ROLE_PROFILE } = require('./lib/roles.cjs');

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const screens = [];
const add = (folder, file, title, build, meta = {}) => screens.push({ folder, file, title, build, ...meta });

const folderFor = cat => ({ 'Overview': '04-operations', 'Facilities & Welfare': '04-operations', 'Safeguarding': '03-safeguarding', 'Finance': '05-finance', 'Compliance & Community': '06-compliance', 'Admin & Governance': '07-admin' }[cat] || '04-operations');

/* ---------- 00 foundation */
add('00-foundation', '01-splash', 'Splash', () => X.splash());
add('00-foundation', '02-sign-in', 'Sign in', () => X.signIn());
add('00-foundation', '03-sign-in-error', 'Sign in — error', () => X.signIn('error'));
add('00-foundation', '04-reset-password', 'Reset password', () => X.resetPassword());
add('00-foundation', '05-session-lock', 'Session lock', () => X.sessionLock());
add('00-foundation', '06-access-denied', 'Access denied', () => X.accessDenied());
add('00-foundation', '07-page-maintenance', 'Page under maintenance', () => X.maintenancePage());
add('00-foundation', '08-account-blocked', 'Account unavailable', () => X.blocked());
add('00-foundation', '09-offline', 'Offline / sync state', () => X.offline());
add('00-foundation', '10-states', 'Loading, empty, error, success', () => X.states());

/* ---------- 01 navigation (Super Admin = the fullest view) + search, notifications, profile, settings */
add('01-navigation', '01-search-start', 'Search — start', () => X.search(false));
add('01-navigation', '02-search-results', 'Search — results', () => X.search(true));
add('01-navigation', '03-notifications', 'Notifications', () => X.notifications());
add('01-navigation', '04-app-settings', 'App settings (personal)', () => X.appSettings());
add('01-navigation', '05-edit-dashboard', 'Home — personalise widgets', () => {
  const rows = ['Key summary', 'Guest statistics', 'Cases by property', 'Open maintenance', 'Public transport', 'Finance bills'].map((t, i) => `<div class="li"><span style="color:#C7C7CC">${U.ic('GripVertical', 20)}</span><span class="k">${t}</span><span class="toggle ${i < 4 ? 'on' : ''}"></span></div>`);
  const body = `${U.banner('Drag to reorder. Only widgets for pages you can open are listed.', 'blue')}${U.group('Widgets', rows)}${U.button('Add widget', 'sec', 'Plus')}`;
  return { html: U.phone({ nav: U.navInline({ title: 'Edit Home', leading: 'Cancel', trailingText: 'Done' }), body }), spec: X.spec('Home — personalise widgets', 'Reorder, hide and add widgets (web: personalised dashboard builder).', 'Reorderable list with toggles and an Add widget button.', ['Reorder handles', 'Toggles'], 'Widget library filtered by page access.', 'Reorder, hide, add, reset to default.', 'Done returns to Home.', 'Own layout only; widgets for pages the role cannot view never appear.', 'Drag with haptics.') };
});

/* ---------- role experiences + homes */
for (const role of ROLES) {
  const rs = slug(role);
  add(`08-roles/${rs}`, '01-home', `Home — ${role}`, () => X.home(role, audit), { role });
  add(`08-roles/${rs}`, '02-safeguarding-hub', `Safeguarding — ${role}`, () => X.hub('safeguarding', role, audit), { role });
  add(`08-roles/${rs}`, '03-operations-hub', `Operations — ${role}`, () => X.hub('operations', role, audit), { role });
  add(`08-roles/${rs}`, '04-more', `More — ${role}`, () => X.more(role, audit), { role });
  add(`08-roles/${rs}`, '05-profile', `Profile — ${role}`, () => X.profile(role), { role });
}

/* ---------- pages */
const kindsWithOwnLists = new Set(['home', 'hub', 'rbac', 'options', 'notifyAdmin', 'settings', 'reports', 'audit', 'builder', 'maintMode', 'pageAccess']);
for (const a of audit.pages) {
  const cfg = PAGES[a.id];
  if (!cfg) continue;
  const f = folderFor(a.category);
  const n = a.id;
  const pg = { pageId: a.id };
  const listBuild = () => X.kindList(audit, n) || G.listScreen(audit, n);
  const generic = !kindsWithOwnLists.has(cfg.kind) && cfg.kind !== 'lifecycle' && cfg.kind !== 'rbac';

  if (n === 'dashboard') {
    add('02-home', '01-dashboard-note', 'Executive Dashboard — mobile Home', () => X.home('Super Admin', audit), pg);
    continue;
  }
  if (n === 'dailyRegisters') {
    add(f, `${n}-01-daily-register`, 'Live Registers — Daily Register', () => X.registerHub(0), pg);
    add(f, `${n}-02-guest-filters`, 'Live Registers — Guest filters', () => X.guestFilterSheet(), pg);
    add(f, `${n}-03-room-list`, 'Live Registers — Room List (interconnecting)', () => X.roomList(), pg);
    add(f, `${n}-04-connect-rooms`, 'Live Registers — Connect rooms', () => X.connectSheet(), pg);
    add(f, `${n}-05-allocation`, 'Live Registers — Allocate room', () => X.allocation(), pg);
    add(f, `${n}-06-statistics`, 'Live Registers — Guest statistics', () => X.guestStats(), pg);
    X.registerSubs(audit).forEach(([sl, r]) => add(f, `${n}-07-${sl}`, `Live Registers — ${sl.replace(/-/g, ' ')}`, () => r, pg));
    add(f, `${n}-08-resident-detail`, 'Live Registers — Resident detail', () => G.detailScreen(audit, n), pg);
    add(f, `${n}-09-resident-form`, 'Live Registers — Log resident (form)', () => G.formScreen(audit, n), pg);
    continue;
  }
  if (cfg.kind === 'lifecycle') {
    const who = n;
    add(f, `${n}-01-active`, `${a.title} — Active`, () => X.lifecycle(who, 0), pg);
    add(f, `${n}-02-archived`, `${a.title} — Archived`, () => X.lifecycle(who, 1), pg);
    add(f, `${n}-03-deleted`, `${a.title} — Deleted`, () => X.lifecycle(who, 2), pg);
    add(f, `${n}-04-archive-step-1`, `${a.title} — Archive, step 1`, () => X.lifecycle(who, 0, 1), pg);
    add(f, `${n}-05-archive-step-2`, `${a.title} — Archive, step 2`, () => X.lifecycle(who, 0, 2), pg);
    add(f, `${n}-06-detail`, `${a.title} — Detail`, () => G.detailScreen(audit, n), pg);
    add(f, `${n}-07-form`, `${a.title} — Form`, () => G.formScreen(audit, n), pg);
    continue;
  }
  if (cfg.kind === 'rbac') {
    add(f, `${n}-01-roles`, 'Roles — list', () => A.roles(false), pg);
    add(f, `${n}-02-role-permissions`, 'Roles — permissions', () => A.roles(true), pg);
    continue;
  }
  if (cfg.kind === 'pageAccess') { add(f, `${n}-01-users`, 'Page Access — users', () => A.pageAccess(0), pg); add(f, `${n}-02-pages`, 'Page Access — pages and actions', () => A.pageAccess(1), pg); continue; }
  if (cfg.kind === 'options') { add(f, `${n}-01-categories`, 'Field Options — categories', () => A.options(false), pg); add(f, `${n}-02-options`, 'Field Options — options', () => A.options(true), pg); continue; }
  if (cfg.kind === 'notifyAdmin') { ['smtp', 'rules', 'logs'].forEach((t, i) => add(f, `${n}-0${i + 1}-${t}`, `Email Notifications — ${t}`, () => A.notify(i), pg)); continue; }
  if (cfg.kind === 'settings') { add(f, `${n}-01-system`, 'System Settings', () => A.adminSettings(), pg); continue; }
  if (cfg.kind === 'maintMode') { add(f, `${n}-01-manager`, 'Page Maintenance Mode', () => A.maintMode(), pg); continue; }
  if (cfg.kind === 'reports') { add(f, `${n}-01-builder`, 'Reports — builder', () => A.reports(0), pg); add(f, `${n}-02-export`, 'Reports — export sheet', () => A.reports(1), pg); continue; }
  if (cfg.kind === 'audit') { add(f, `${n}-01-timeline`, 'Audit — timeline', () => A.audit(), pg); continue; }
  if (cfg.kind === 'builder') { add(f, `${n}-01-templates`, 'HO Report — templates', () => A.builder(0), pg); add(f, `${n}-02-builder`, 'HO Report — builder', () => A.builder(1), pg); continue; }

  // generic family
  add(f, `${n}-01-list`, `${a.title} — List`, listBuild, pg);
  if (cfg.kind === 'checklist') {
    add(f, `${n}-02-checklist`, `${a.title} — Checklist form`, () => X.checklistForm(audit, n), pg);
  } else {
    add(f, `${n}-02-detail`, `${a.title} — Detail`, () => G.detailScreen(audit, n), pg);
    add(f, `${n}-03-form`, `${a.title} — Form`, () => G.formScreen(audit, n), pg);
  }
  if (cfg.kind === 'checklist') add(f, `${n}-03-detail`, `${a.title} — Detail`, () => G.detailScreen(audit, n), pg);
  if (!cfg.readonly || cfg.kind === 'checklist') add(f, `${n}-04-filter`, `${a.title} — Filter`, () => G.filterScreen(audit, n), pg);
  if (n === 'requests') add(f, `${n}-05-decision`, 'Change request — decision', () => A.requestDecision(), pg);
  if (cfg.kind === 'profile') SUBSCREENS.suUsers.forEach((t, i) => add(f, `${n}-1${String(i).padStart(2, '0')}-profile-${slug(t)}`, `Service User profile — ${t}`, () => X.suProfile(i), pg));
  if (cfg.kind === 'propprofile') SUBSCREENS.propertyManagement.forEach((t, i) => add(f, `${n}-1${String(i).padStart(2, '0')}-profile-${slug(t)}`, `Property profile — ${t}`, () => X.propProfile(i), pg));
}

module.exports = { screens, audit };

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

async function main() {
  const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 520, height: 960 }, deviceScaleFactor: 2 });
  const pageObj = await ctx.newPage();
  const specs = [];
  let n = 0;
  const failures = [];
  for (const s of screens) {
    try {
      const { html, spec } = s.build();
      const dir = path.join(OUT, 'mockups', s.folder);
      fs.mkdirSync(dir, { recursive: true });
      await pageObj.setContent(U.page(html), { waitUntil: 'load' });
      await pageObj.locator('.phone').screenshot({ path: path.join(dir, `${s.file}.png`), omitBackground: true });
      specs.push({ ...s, build: undefined, spec, png: `mockups/${s.folder}/${s.file}.png` });
      n++;
    } catch (e) { failures.push(`${s.folder}/${s.file}: ${e.message}`); }
  }
  fs.writeFileSync(path.join(OUT, 'data/screens.json'), JSON.stringify(specs, null, 2));
  await browser.close();
  console.log(`rendered ${n} / ${screens.length} screens`);
  if (U.missing.size) console.log('icons not found in Tabler (drawn as circles):', [...U.missing].join(', '));
  if (failures.length) { console.log('FAILURES:\n' + failures.join('\n')); process.exitCode = 1; }
}
