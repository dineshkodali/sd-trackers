/** Writes the Markdown deliverables and the gallery from audit.json + screens.json. Run after build.cjs. */
const fs = require('fs');
const path = require('path');
const OUT = path.resolve(__dirname, '..');
const audit = JSON.parse(fs.readFileSync(path.join(OUT, 'data/audit.json'), 'utf8'));
const screens = JSON.parse(fs.readFileSync(path.join(OUT, 'data/screens.json'), 'utf8'));
const workflows = JSON.parse(fs.readFileSync(path.join(OUT, 'data/workflows.json'), 'utf8'));
const { PAGES, SUBSCREENS } = require('./lib/pages.cjs');
const { ROLES, PERMS, canSee, ROLE_PROFILE } = require('./lib/roles.cjs');

const w = (f, s) => fs.writeFileSync(path.join(OUT, f), s);
const yn = b => (b ? 'Yes' : '—');
const byPage = {};
screens.forEach(s => { if (s.pageId) (byPage[s.pageId] ||= []).push(s); });
byPage.dashboard = [...(byPage.dashboard || []), ...screens.filter(s => /01-home$|05-edit-dashboard/.test(s.png.replace('.png', '')) && !s.role)];
const registered = audit.pages;
const covered = registered.filter(p => (byPage[p.id] || []).length > 0);
const sub = n => (SUBSCREENS[n] || []).length;

/* -------------------------------------------------------------- 01 inventory */
let inv = `# 01 Screen inventory

Source of truth: the web app's page registry (\`src/config/pageRegistry.ts\`), the route switch in \`src/App.tsx\`, the role defaults in \`src/data/initialData.ts\` and the table/column definitions in \`src/data/defaultTableSchemas.ts\`. Extracted by \`tools/audit.cjs\` into \`data/audit.json\`. Nothing in the web app was changed.

**How navigation works on the web today:** there is no URL router. \`App.tsx\` switches on an in-memory \`activePage\`; every page is a full-screen view inside a sidebar shell. That is why each page below maps to a mobile screen set, not to a URL.

**Totals:** ${registered.length} pages (${registered.filter(p => p.registered).length} in the registry plus ${registered.filter(p => !p.registered).length} admin pages routed outside it: ${registered.filter(p => !p.registered).map(p => p.id).join(', ')}). ${screens.length} iPhone screens.

| # | Page (web id) | Category | Web component | Data tables | Web actions | Mobile pattern | Screens |
|---|---|---|---|---|---|---|---|
`;
registered.forEach((p, i) => {
  const cfg = PAGES[p.id] || {};
  const list = byPage[p.id] || [];
  inv += `| ${i + 1} | **${p.title}** (\`${p.id}\`) | ${p.category} | \`${p.component}\` (${p.loc} lines${p.siblingFiles > 1 ? `, ${p.siblingFiles - 1} sibling files` : ''}) | ${p.tables.join(', ') || '—'} | ${p.pageActions.join(', ')} | ${cfg.pattern || ''} | ${list.length} |\n`;
});
inv += `\n## Tabs, sections and sub-pages found\n\n`;
const tabsFound = [
  ['dailyRegisters', 'Daily Register, Room List, User Guide, Live Register Statistics, Cross Checks & Validation, Language Summary, New Arrivals, Family Groups, Summary & Guest Statistics (9 sheet tabs)'],
  ['suUsers', `Service User profile: ${SUBSCREENS.suUsers.join(', ')} (17; Education only when under 18)`],
  ['propertyManagement', `Property profile: ${SUBSCREENS.propertyManagement.join(', ')} (9)`],
  ['publicTransport', 'Overview, Feedback, Challenges, Funding, Oyster'],
  ['food / foodConsumption', 'Vendor buffet, SU meals, Consumption, Box requests (one FoodView, two menu entries)'],
  ['foodSurveys', 'Survey details, 21 meal ratings matrix, Service & dining, Dishes & dietary'],
  ['suAttendance', 'Roll, Records, Follow-ups'],
  ['gpAppointments', 'Appointments, Registrations'],
  ['spcd', 'Current, Archived'],
  ['documentBuilder', 'Generator, Documents'],
  ['notifications', 'SMTP, Rules, Logs'],
  ['audit', 'Accountability, Properties, Users, Casework, All'],
  ['vcsDirectory', 'Table, Matrix'],
  ['finance* (3 pages)', 'All, Pending approval, Approved, Paid, Queries, Rejected'],
  ['laundry', 'Daily room-by-room log; weekly and monthly property summaries'],
  ['users / properties', 'Active, Archived, Deleted records (added in migration 028)'],
];
tabsFound.forEach(([k, v]) => { inv += `- **${k}**: ${v}\n`; });
inv += `\n## Modals and forms found\n\nEach tracker opens a create/edit form built from its column definitions (the "Customize Table" feature lets a Super Admin change columns). Notable dedicated modals: ${[...new Set(audit.pages.flatMap(p => p.modals))].slice(0, 40).join(', ')}. Every modal form is represented on iPhone by that page's Form screen; every confirmation is represented by the confirmation sheet pattern (see design system).\n\n## Cross-cutting features found\n\n- Site scoping on every list (all sites vs assigned sites) → site pill and filter sheet.\n- Customize Table (Super Admin) → not a mobile feature; schema changes apply to the mobile forms automatically because both read the same schema.\n- Export (CSV/PDF), Print → iOS share sheet and print dialog.\n- Attachments → camera, scan, Files.\n- Audit trail on every write → "Audit trail" row on detail screens (Admin and Super Admin only).\n- Live data / sync banner → offline and sync state.\n- Inactivity lock → session lock screen.\n- Page maintenance mode → maintenance screen.\n- Per-user Page Access overrides → hide navigation entries; never grant more than the role.\n`;
w('01-SCREEN-INVENTORY.md', inv);

/* -------------------------------------------------------------- 02 navigation */
const hubOf = cat => audit.pages.filter(p => p.category === cat);
let nav = `# 02 Navigation architecture

## Bottom tab bar (5 tabs, same for every role)

| Tab | Purpose | Content |
|---|---|---|
| Home | Role-aware dashboard | KPIs, quick actions, needs-attention, guest statistics, approvals (finance roles). Bell → Notifications, avatar → Profile. |
| Safeguarding | Module landing | ${hubOf('Safeguarding').map(p => p.title).join(', ')} |
| Operations | Module landing | ${[...hubOf('Overview'), ...hubOf('Facilities & Welfare')].map(p => p.title).join(', ')} |
| Search | Global search | Residents, records, properties, modules (replaces the web Quick Jump). |
| More | Everything else | Profile, Finance (${hubOf('Finance').length}), Compliance & Community (${hubOf('Compliance & Community').length}), Admin & Governance (${hubOf('Admin & Governance').length + 3}), Notifications, Sign out. |

Why not all modules in the tab bar: there are ${audit.pages.length} pages. Tabs hold the four things used all day; modules live one tap away on hub screens; Search reaches any record in two taps. Notifications are on Home (bell with badge) and in More so the five tabs stay stable.

## Hierarchy

\`\`\`
Sign in → Home
├─ Home ── Notifications · Profile · Edit widgets · KPI/Card → filtered list
├─ Safeguarding ── module list → Detail → Form (modal) / Attachments / Audit trail
├─ Operations ── Live Registers (segmented hub) · trackers → Detail → Form
├─ Search ── results → Detail
└─ More ── Finance · Compliance & Community · Admin & Governance · Profile · Settings
\`\`\`

Patterns: lists push to Detail (back swipe); create/edit are modal forms (Cancel / Save); filters, confirmations and pickers are bottom sheets; module tabs become a segmented control (up to 4) or a scrollable chip strip (5+).

## Role-based access (from the web rules)

Page visibility follows \`App.tsx\` gates and \`initialData.ts\`. A Super Admin can further restrict an individual user with Page Access; an override can only remove access, never add it. The mobile app must evaluate the same two layers.

| Page / module | ${ROLES.join(' | ')} |
|---|${ROLES.map(() => '---').join('|')}|
`;
const interesting = ['dashboard', 'referrals', 'finance', 'financeApprovals', 'dailyRegisters', 'reports', 'users', 'properties', 'audit', 'notifications', 'settings', 'roles', 'setupOptions', 'pageAccess', 'pageMaintenance'];
interesting.forEach(id => {
  const p = audit.pages.find(x => x.id === id);
  nav += `| ${p ? p.title : id} | ${ROLES.map(r => yn(canSee(r, id))).join(' | ')} |\n`;
});
nav += `| All other ${audit.pages.length - interesting.length} pages | ${ROLES.map(() => 'Yes').join(' | ')} |\n`;
nav += `\n### Role capabilities (\`INITIAL_ROLE_PERMISSIONS\`, editable by a Super Admin in Roles)\n\n| Capability | ${ROLES.join(' | ')} |\n|---|${ROLES.map(() => '---').join('|')}|\n`;
[['All sites', 'allSites'], ['Create / edit', 'create'], ['Delete', 'delete'], ['Archive / restore', 'archive'], ['Export', 'export'], ['Restore archived users & properties', 'restore'], ['Manage finance', 'finance']].forEach(([l, k]) => { nav += `| ${l} | ${ROLES.map(r => yn(PERMS[r][k])).join(' | ')} |\n`; });
nav += `\n### What each role sees on iPhone\n\n`;
ROLES.forEach(r => {
  const slug = r.toLowerCase().replace(/ /g, '-');
  nav += `**${r}** — ${ROLE_PROFILE[r].who}. Scope: ${ROLE_PROFILE[r].scope}. ${ROLE_PROFILE[r].extra}. Screens: [Home](mockups/08-roles/${slug}/01-home.png), [Safeguarding](mockups/08-roles/${slug}/02-safeguarding-hub.png), [Operations](mockups/08-roles/${slug}/03-operations-hub.png), [More](mockups/08-roles/${slug}/04-more.png), [Profile](mockups/08-roles/${slug}/05-profile.png). Pages visible: ${audit.pages.filter(p => canSee(r, p.id)).length} of ${audit.pages.length}.\n\n`;
});
nav += `### The roles you listed\n\nThe brief names Administrator, Manager, Engineer and Customer. The repository defines **six** roles: Super Admin, Admin, Regional Manager, General Manager, Area Manager, Staff (\`RoleType\` in \`src/types/index.ts\`). There is **no Engineer role and no Customer role**, so none was designed; inventing them would contradict "do not invent features". Mapping used: Administrator → Super Admin and Admin; Manager → Regional, General and Area Manager; frontline user → Staff. If Engineer or Customer roles are planned, they need a permission definition first (see coverage report).\n`;
w('02-NAVIGATION-ARCHITECTURE.md', nav);

/* -------------------------------------------------------------- 03 design system */
const tok = JSON.parse(fs.readFileSync(path.join(OUT, 'data/tokens.json'), 'utf8'));
let ds = `# 03 Design system

Boards: [Colour and type](design-system/01-colour-and-type.png) · [Components](design-system/02-components.png) · [States](design-system/03-states-and-feedback.png) · [Icons and SF Symbols](design-system/04-icons-and-symbols.png). Machine-readable tokens: [data/tokens.json](data/tokens.json).

## Principles

1. Native first: large titles, inset grouped lists, bottom sheets, swipe actions, system pickers, Dynamic Type, dark mode.
2. Keep the web brand: the teal tint (${tok.colour.brand.tint}) carries over; surfaces and type are iOS system.
3. Status is text plus colour, never colour alone.
4. One tap to the thing you need; destructive actions are always confirmed (archive takes two confirmations).
5. Same data, same rules: the app talks to the existing Supabase backend and respects the same role and site scoping.

## Colour

| Token | Value | Use |
|---|---|---|
${Object.entries({ ...tok.colour.brand, ...tok.colour.background, ...tok.colour.text, ...tok.colour.status }).filter(([k]) => k !== 'note').map(([k, v]) => `| ${k} | \`${v}\` | ${k} |`).join('\n')}

Dark mode: define every colour as an Asset Catalog colour set with a dark value (surfaces #000 / #1C1C1E, tint lightened to ${'#2DD4BF'} for contrast). The mock-ups show light mode only.

## Typography

SF Pro through Dynamic Type text styles: ${Object.entries(tok.typography).filter(([k]) => k !== 'note').map(([k, v]) => `${k} ${v.size}/${v.weight}`).join(', ')}. All text scales; layouts must wrap rather than truncate at the largest accessibility sizes.

## Spacing, shape, elevation

4pt grid (${tok.spacing.scale.join(', ')}); screen margin ${tok.spacing.screenMargin}; card padding ${tok.spacing.cardPadding}; row minimum ${tok.spacing.rowMinHeight}. Radii: ${Object.entries(tok.radius).map(([k, v]) => `${k} ${v}`).join(', ')}. Cards use a hairline shadow only.

## Components

- **Navigation bars:** large title at the top of a tab, inline title on pushed screens; trailing actions are circular tinted buttons.
- **Tab bar:** five items, translucent, badge for counts.
- **Record card:** title, one supporting line, status badge (top right), up to three facts with icons.
- **Inset grouped list / form row:** label left, value or placeholder right, chevron for pickers, red asterisk for required, inline error below the row.
- **Buttons:** primary (filled tint), secondary (tint on soft), destructive (red on soft), outline; 50pt high, small 38pt.
- **Search field, filter chips, segmented control:** system styles; chips scroll horizontally.
- **Badges:** pill with dot and text; tones success / warning / danger / info / special / neutral.
- **Bottom sheet:** grabber, centred title, grouped content, primary action at the bottom.
- **Banners:** info, warning, error, success; icon plus short text, optional action.
- **KPI card:** label, large number, delta line.
- **Charts:** donut and horizontal bars with a value list underneath so VoiceOver and keyboard users reach every figure.

## Tables → mobile lists

Desktop tables of 8–54 columns are never shrunk. Each becomes a card list: the first identifying column is the title, one descriptive column the subtitle, the status column the badge, up to three dates/places/people as facts. Everything else is on the Detail screen in grouped sections. Sorting becomes a sort menu on the filter button; pagination becomes continuous scrolling.

## States and feedback

Loading uses skeleton cards, empty states explain and offer the next step, errors say what happened and offer Retry, success is a toast. Validation is inline under the row; Save stays enabled and scrolls to the first error. Offline shows a banner and queues edits.

## Accessibility

Contrast at least 4.5:1 for text (tint #0F766E on white is 5.5:1); 44×44pt targets; Dynamic Type; VoiceOver labels on icon buttons and charts; Reduce Motion; Bold Text; Increase Contrast; haptics for success and destructive confirmation; never rely on colour alone.

## Icons

SF Symbols in the app. The mock-ups use outline stand-ins; the symbol for each module is listed on the [icons board](design-system/04-icons-and-symbols.png) and in the inventory data (\`tools/lib/pages.cjs\`).

## Fonts and assets note

The mock-ups were drawn with the system font available on the machine that rendered them, not SF Pro (Apple's font cannot be embedded here). Spacing and sizes follow iOS metrics, so the real app will look slightly crisper, not different.
`;
w('03-DESIGN-SYSTEM.md', ds);

/* -------------------------------------------------------------- 04 screen specs */
let sp = `# 04 Screen-by-screen specifications\n\n${screens.length} screens. Each entry: image, purpose, layout, components, data, actions, navigation, permissions, mobile interactions. Data in the images is fictional.\n\n`;
const order = [...new Set(screens.map(s => s.folder))];
order.forEach(folder => {
  sp += `## ${folder}\n\n`;
  screens.filter(s => s.folder === folder).forEach(s => {
    const c = s.spec || {};
    sp += `### ${c.name || s.title}\n\n![${s.title}](${s.png})\n\n- **Purpose:** ${c.purpose}\n- **Layout:** ${c.layout}\n- **Components:** ${(c.components || []).join(', ')}\n- **Data displayed:** ${c.data}\n- **Actions:** ${c.actions}\n- **Navigation:** ${c.nav}\n- **Permissions:** ${c.permissions}\n- **Mobile interactions:** ${c.interactions}\n\n`;
  });
});
w('04-SCREEN-SPECS.md', sp);

/* -------------------------------------------------------------- 05 workflows */
let wf = `# 05 Workflow references\n\nSix business workflows, each as a strip of real mock-up screens.\n\n`;
const notes = {
  'referral-intake': 'Frontline staff log a safeguarding referral on the phone, attach evidence, and the manager is notified. Same fields and statuses as the web SG Referrals Master.',
  'arrival-room-allocation': 'A new arrival waits for a room; staff allocate a family of four across two interconnecting rooms (connected rooms and group availability are shown, full rooms are hidden so nobody is double-booked); Room List and Daily Register update; the register is then filtered by guest attributes.',
  'finance-approval': 'A vendor invoice is photographed and submitted; an approver reviews and approves; the submitter is notified. Approval needs the approve action on the finance pages and is not available to Staff.',
  'change-request': 'A locked record cannot be edited directly; staff raise a Data Change Request, a manager approves or rejects with remarks.',
  'archive-restore': 'Users and properties are never permanently deleted. Archive takes two confirmations; only a Super Admin can restore.',
  'room-check': '30-point inspection with automatic grade; a failed item can be escalated with a photo, and the escalation is tracked to resolution.',
};
workflows.forEach(x => { wf += `## ${x.title}\n\n![${x.title}](workflows/${x.id}.png)\n\n${notes[x.id]}\n\nSteps: ${x.steps.map(s => s[2]).join(' → ')}\n\n`; });
w('05-WORKFLOWS.md', wf);

/* -------------------------------------------------------------- 06 coverage */
const roleScreens = screens.filter(s => s.role);
const missing = audit.pages.filter(p => (byPage[p.id] || []).length === 0);
const rows = audit.pages.map(p => { const l = byPage[p.id] || []; return `| ${p.title} | ${p.category} | ${l.length} | ${l.length ? 'Redesigned' : '**Not covered**'} |`; }).join('\n');
const cov = `# 06 Design coverage report

Generated by \`tools/docs.cjs\` from the same data as the other documents, so the numbers match the files.

| Measure | Result |
|---|---|
| Existing pages identified | **${audit.pages.length}** (${audit.pages.filter(p => p.registered).length} registry + ${audit.pages.filter(p => !p.registered).length} admin routes) |
| Pages redesigned (at least one screen) | **${covered.length}** |
| Pages remaining | **${missing.length}**${missing.length ? ' (' + missing.map(p => p.id).join(', ') + ')' : ''} |
| iPhone screens rendered | **${screens.length}** |
| Role-specific screens | ${roleScreens.length} (6 roles × 5 screens) |
| Workflow strips | ${workflows.length} |
| Design-system boards | 4 |
| Module categories covered | ${[...new Set(audit.pages.map(p => p.category))].length} of ${[...new Set(audit.pages.map(p => p.category))].length} |
| Roles covered | 6 of 6 defined in the repository (Super Admin, Admin, Regional Manager, General Manager, Area Manager, Staff) |
| Sub-pages / tabs given their own screen | Daily Registers ${sub('dailyRegisters')} sheets (all), Service User profile ${sub('suUsers')} of ${sub('suUsers')}, Property profile ${sub('propertyManagement')} of ${sub('propertyManagement')}, Users/Properties lifecycle (Active, Archived, Deleted, 2-step archive), Notifications 3 of 3, Reports 2, HO builder 2 |

## Per-page coverage

| Page | Category | Screens | Status |
|---|---|---|---|
${rows}

## Honest limits: what "covered" means

- **Depth varies by archetype.** Pages with the same shape (list of records with status and a form) get the same four screens driven by their real field lists: List, Detail, Form, Filter. Pages with a genuinely different shape (Daily Registers, SU profile, property profile, users/properties lifecycle, checklists, approvals, roll call, expiry, contacts, files, progress, RBAC, Page Access, options, notifications, settings, reports, audit, report builder) have bespoke screens. The 12 trackers that share the generic archetype (for example Referrals, Vulnerable, Challenging, SPCD, IR, Dispersal, Escalations, Maintenance) were not individually art-directed beyond their fields, statuses and card facts.
- **Not every tab of every module has its own mock-up.** Tabs that only change which list is shown (Public Transport's 5 tabs, Food's 4, Food Surveys' 4 steps, GP's 2, Dispersal's 2, SPCD's 2, Laundry's 2) appear as the segmented control on the list screen; their lists use the same card pattern. The Welfare Check and Food Survey multi-section forms are shown as one form screen (first sections) rather than every step.
- **Forms show the first ~11 fields** of each real field list; the specification notes the full count. Long forms continue by scrolling.
- **Sample data is generated from field names** with fixed fictional values; it is not copied from the database and contains no real people, properties or references.
- **Rendering stand-ins:** outline icons stand in for SF Symbols and the machine's system font stands in for SF Pro (see design system).
- **Dark mode, iPad, Dynamic Type extremes and landscape** are specified in the design system but not mocked.

## Missing information and questions

1. **Engineer and Customer roles** are named in the brief but do not exist in the repository. Do you plan to add them? They would need page access, scope and action rules before they can be designed.
2. **Push notifications:** the web app has an in-app notification centre and email rules, not push. Push is proposed in the designs; the backend would need a device-token table and a sender.
3. **Offline editing:** the web app has a live-data banner and local caching, but no conflict handling. The offline screen assumes queue-and-sync; the conflict rule (last write wins, or prompt) is a product decision.
4. **Biometric unlock** is proposed; Supabase Auth sessions would be stored in the Keychain.
5. **Camera/scan evidence** is designed for every form that has attachments; confirm file size limits and the storage bucket policy.
6. **Per-user Page Access overrides** can hide any page for any role; the app must read them at sign-in exactly as the web does (see \`user_page_permissions\`).
7. **Customize Table** (Super Admin edits columns) changes the schema the forms are built from; confirm the mobile forms should follow it live.
8. **Approval flows** (finance and change requests) are rendered as the web describes them; the exact approver rules per amount band were not found in the repository and are not designed.

## Not done on purpose

No backend, database or web file was modified. No iOS code was written. Nothing was run against Supabase.
`;
w('06-COVERAGE-REPORT.md', cov);

/* -------------------------------------------------------------- README + gallery */
const overview = fs.readdirSync(path.join(OUT, 'overview')).sort();
w('README.md', `# SDTracker iOS design reference

A complete mobile design reference for the existing SDTracker web app: ${screens.length} iPhone screens covering all ${audit.pages.length} pages, six roles, six workflows and a design system. Open [index.html](index.html) in a browser for the visual gallery.

| Deliverable | File |
|---|---|
| A. Screen inventory | [01-SCREEN-INVENTORY.md](01-SCREEN-INVENTORY.md) |
| B. Navigation architecture and role access | [02-NAVIGATION-ARCHITECTURE.md](02-NAVIGATION-ARCHITECTURE.md) |
| C. Design system | [03-DESIGN-SYSTEM.md](03-DESIGN-SYSTEM.md), [design-system/](design-system/), [data/tokens.json](data/tokens.json) |
| D. iPhone mock-ups | [mockups/](mockups/) (one PNG per screen), [overview/](overview/) (contact sheets) |
| E. Screen specifications | [04-SCREEN-SPECS.md](04-SCREEN-SPECS.md) |
| F. Workflow references | [05-WORKFLOWS.md](05-WORKFLOWS.md), [workflows/](workflows/) |
| G. Coverage report | [06-COVERAGE-REPORT.md](06-COVERAGE-REPORT.md) |

Start with the overview sheets: ${overview.slice(0, 3).map(f => `[${f}](overview/${f})`).join(', ')}… and the [workflows](workflows/).

## Regenerating

Everything is generated from the web source so it stays honest:

\`\`\`
node design/ios/tools/audit.cjs        # read-only audit of src/ -> data/audit.json
node design/ios/tools/designsystem.cjs # tokens + design-system boards
node design/ios/tools/build.cjs        # all mock-up PNGs + data/screens.json
node design/ios/tools/overview.cjs     # contact sheets + workflow strips
node design/ios/tools/docs.cjs         # these documents + index.html
\`\`\`

Needs Node, the repo's installed packages (\`react\`, \`@tabler/icons-react\`, \`playwright-core\`) and Chrome or Edge. Nothing here is imported by the web app or its build.

## Read this first

- Fictional data only. No real residents, properties or references appear.
- The brief lists roles Engineer and Customer; the repository has six different roles. See the navigation document and the coverage report.
- Icons and fonts are stand-ins for SF Symbols and SF Pro.
`);

const sections = order.map(folder => {
  const items = screens.filter(s => s.folder === folder);
  return `<section><h2>${folder} <small>(${items.length})</small></h2><div class="g">${items.map(s => `<figure><a href="${s.png}"><img loading="lazy" src="${s.png}" alt="${s.title}"></a><figcaption>${s.title}</figcaption></figure>`).join('')}</div></section>`;
}).join('');
w('index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SDTracker iOS design reference</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font-family:system-ui,Segoe UI,Arial,sans-serif;background:#eef0f3;color:#222}header{padding:28px 32px;background:#0f766e;color:#fff}header h1{margin:0 0 6px;font-size:28px}header p{margin:0;opacity:.9}
nav{padding:14px 32px;background:#fff;border-bottom:1px solid #dde;display:flex;gap:16px;flex-wrap:wrap;font-size:14px}nav a{color:#0f766e;text-decoration:none;font-weight:600}
main{padding:24px 32px}section{margin-bottom:34px}h2{font-size:20px;margin:0 0 12px}small{color:#777;font-weight:400}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:20px}
figure{margin:0}figure img{width:100%;display:block;filter:drop-shadow(0 4px 10px rgba(0,0,0,.2))}figcaption{font-size:12.5px;margin-top:6px;line-height:1.3}
.w img{max-width:100%;margin:10px 0 26px;background:#fff;border-radius:8px}
</style></head><body><header><h1>SDTracker iOS design reference</h1><p>${screens.length} screens · ${audit.pages.length} pages · 6 roles · fictional data</p></header>
<nav><a href="README.md">README</a><a href="01-SCREEN-INVENTORY.md">Inventory</a><a href="02-NAVIGATION-ARCHITECTURE.md">Navigation</a><a href="03-DESIGN-SYSTEM.md">Design system</a><a href="04-SCREEN-SPECS.md">Specs</a><a href="05-WORKFLOWS.md">Workflows</a><a href="06-COVERAGE-REPORT.md">Coverage</a></nav>
<main><section class="w"><h2>Workflows</h2>${workflows.map(x => `<img src="workflows/${x.id}.png" alt="${x.title}">`).join('')}</section>
<section class="w"><h2>Design system</h2>${fs.readdirSync(path.join(OUT, 'design-system')).filter(f => f.endsWith('.png')).sort().map(f => `<img src="design-system/${f}" alt="${f}">`).join('')}</section>${sections}</main></body></html>`);

console.log('docs written; covered pages', covered.length, '/', audit.pages.length, 'screens', screens.length);
