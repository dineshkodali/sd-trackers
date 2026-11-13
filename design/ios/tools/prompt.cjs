/** Writes design/ios/AGENT-PROMPT.md: a self-contained brief for another design agent. node design/ios/tools/prompt.cjs */
const fs = require('fs');
const path = require('path');
const OUT = path.resolve(__dirname, '..');
const audit = JSON.parse(fs.readFileSync(path.join(OUT, 'data/audit.json'), 'utf8'));
const { PAGES, SUBSCREENS } = require('./lib/pages.cjs');
const G = require('./lib/generic.cjs');
const { ROLES, canSee, ROLE_PROFILE } = require('./lib/roles.cjs');

const cats = [...new Set(audit.pages.map(p => p.category))];
const moduleBlock = cats.map(cat => {
  const items = audit.pages.filter(p => p.category === cat).map(p => {
    const cfg = PAGES[p.id] || {};
    const fields = G.fieldsOf(audit, p.id).map(f => f.label).slice(0, 14);
    const tabs = (SUBSCREENS[p.id] || cfg.tabs || []);
    const who = ROLES.filter(r => canSee(r, p.id));
    return `- **${p.title}** (\`${p.id}\`) — ${p.description || ''}
  - Web actions: ${p.pageActions.join(', ')}. Roles: ${who.length === ROLES.length ? 'all six' : who.join(', ')}.${tabs.length ? `\n  - Sections/tabs: ${tabs.join(' · ')}.` : ''}${fields.length ? `\n  - Key fields: ${fields.join('; ')}.` : ''}
  - Mobile pattern to keep: ${cfg.pattern || 'List → Detail → Form.'}`;
  }).join('\n');
  return `### ${cat}\n${items}`;
}).join('\n\n');

const roles = ROLES.map(r => `- **${r}** — ${ROLE_PROFILE[r].who}; scope: ${ROLE_PROFILE[r].scope}; ${ROLE_PROFILE[r].extra}. Pages visible: ${audit.pages.filter(p => canSee(r, p.id)).length}/${audit.pages.length}.`).join('\n');

const text = `# Prompt for the design agent: SDTracker iOS app — full redesign pass

> Paste everything below into the other agent. It is self-contained. Reference material already exists in this repository under \`design/ios/\`; the agent should read it first and improve on it, not start from nothing.

---

## 1. Your role

You are a Senior iOS Product Designer and Mobile UX Architect (with React Native / SwiftUI implementation sense). Redesign the SDTracker iPhone app so that **every module and section listed in section 5 exists as a polished, native-feeling iOS screen set**. This is a mobile adaptation of an existing enterprise web app, not a new product. Do not invent features. Do not drop features because they are hard on a phone.

## 2. Context

- SDTracker is an enterprise property-management, safeguarding and operations platform used by hotel/accommodation teams.
- Web stack: React + Vite, Supabase (PostgreSQL, Auth, RLS), Express API, hosted on AWS Amplify. The iOS app must work against the **same backend and data model** and respect the **same role and site rules**.
- The web app has **no URL router**; it switches pages in memory. Treat each page below as a module.
- The web brand colour is teal (\`#0D9488\` accent, \`#0F766E\` on light surfaces). Keep it as the app tint.
- There are exactly **six roles**: ${ROLES.join(', ')}. There is **no Engineer and no Customer role** in the repository; do not design them. If you believe they are needed, list that as a question, do not draw them.

## 3. Read first (in this repo)

1. \`design/ios/README.md\` and \`design/ios/06-COVERAGE-REPORT.md\` — what exists and its stated limits.
2. \`design/ios/01-SCREEN-INVENTORY.md\`, \`02-NAVIGATION-ARCHITECTURE.md\`, \`03-DESIGN-SYSTEM.md\`, \`04-SCREEN-SPECS.md\`.
3. \`design/ios/mockups/\` and \`design/ios/overview/\` — the current 258 screens.
4. \`design/ios/data/audit.json\` — machine-readable page, field, tab and role data extracted from the source.
5. Web source for truth when in doubt: \`src/config/pageRegistry.ts\`, \`src/App.tsx\`, \`src/data/initialData.ts\`, \`src/data/defaultTableSchemas.ts\`, \`src/config/pagePermissionsConfig.ts\`, \`src/config/recordLifecycle.ts\`, \`db/migrations/\`.

## 4. What to improve over the current set

The current mock-ups are a reference pass generated from templates. Raise them to premium, art-directed quality:

- Hand-design the ~14 trackers that currently share one generic list/detail/form template (Referrals, Vulnerable, Challenging, Welfare Checks, RFA, MH-Complaint, GP, PEEP, Maintenance, SPCD, IR, Dispersal, Escalations, Requests). Each needs its own card anatomy, colour band or timer where meaningful (risk, priority, SLA, review-due), and its own detail layout.
- Give every module tab/section its **own screen** (the current set represents many only as a segmented control).
- Show multi-section forms fully (Welfare Check, Food Survey, Property form, Service User form, HO report), as step-by-step flows with progress, not just the first fields.
- Add **dark mode** and **Dynamic Type (largest accessibility size)** variants for the key screens (Home, one list, one detail, one form, one sheet).
- Add **iPad** adaptation notes only if cheap; iPhone is the priority.
- Real SF Symbols and SF Pro if available in your environment. Otherwise keep stand-ins and name the SF Symbol under each module.
- Replace generic sample data with realistic but **fictional** data per module (never real residents, properties, references, phones or emails).

## 5. Modules and sections that must be in the iOS app

All ${audit.pages.length} pages are in scope. For each: purpose, web actions, roles, tabs/sections, key fields (from the web columns) and the mobile pattern to keep.

${moduleBlock}

### Cross-cutting features that also need screens
- Sign-in, forgot/reset password, session lock after inactivity, account blocked (archived/suspended), page under maintenance, access denied, offline/sync state, loading/empty/error/success states.
- Global search (web "Quick Jump"), notification centre with unread badge, profile, personal app settings, Face ID unlock.
- Personalised Home: reorderable widgets (key summary, case totals, trends, cases by property, vulnerability risk, laundry and food summary, guest statistics, transport, priority safeguarding, quick actions, my requests, open maintenance, compliance status, finance bills, recent notifications). A widget appears only if the role can open its page.
- Guest filters and statistics on Daily Registers: age (children under 18, adults, elderly 65+, custom), gender, family size (1–5+, custom), Aspen card; summary cards and charts; tapping a figure opens the register with that filter, site and date.
- Interconnecting rooms: Room List badges, connected rooms, availability, manager-only configuration (Super Admin, Admin, General/Area Manager), allocation picker showing group availability, family across connected rooms, double-booking prevention.
- Archive and recoverable delete for Users and Properties: Active / Archived / Deleted, two-step archive confirmation, only Super Admin can restore, history.
- Per-user Page Access overrides (restrict only, never elevate), Page Maintenance Mode, Roles & RBAC matrix, Field Options setup, Email notification rules and logs, Audit trail (read-only), Reports builder and export, Data Change Requests with manager sign-off.
- Attachments everywhere they exist on the web: camera, document scan, Files, photo library.
- Export/print via the iOS share sheet.

## 6. Roles and access (do not expose what a role cannot open)

${roles}

Per-user Page Access can remove any page for any user; it never adds access. Navigation must hide unavailable modules entirely (no greyed-out rows).

## 7. Navigation requirements

Five bottom tabs: **Home, Safeguarding, Operations, Search, More**. Do not put every module in the tab bar. Hub screens list modules; modules with 5+ tabs use a scrollable chip strip, up to 4 use a segmented control; filters, pickers and confirmations are bottom sheets; create/edit are modal forms (Cancel / Save); records push to Detail screens. Propose a better structure only if you can justify it against the role matrix, and show it.

## 8. Platform and quality rules

- Follow Apple's Human Interface Guidelines: large titles, inset grouped lists, system pickers, swipe actions, haptics, safe areas, 44pt targets, Dynamic Type, VoiceOver labels, Reduce Motion, Increase Contrast.
- Status is always colour plus text. Contrast at least 4.5:1.
- Desktop tables are never shrunk: identifying column = title, one supporting line, status badge, up to three facts; everything else on Detail in grouped sections.
- Destructive actions are confirmed; archive takes two separate confirmations.
- Never expose admin or sensitive functions to roles without them.
- Do not use Lucide or Tabler glyphs in the final art if SF Symbols are available.

## 9. Deliverables (write under \`design/ios-v2/\`; never overwrite \`design/ios/\` or any web file)

1. **Screen inventory** mapping every page, tab and modal to its mobile screens.
2. **Navigation architecture** and role-by-module access matrix.
3. **Design system**: colour (light and dark), typography, spacing, components, states, icons, with tokens in JSON.
4. **iPhone mock-up images (PNG)** for every screen: splash, sign-in, home (per role), module hubs, every list, detail, form, filter, sheet, every tab/section, notifications, profile, settings, role-specific variants, key workflows. Include dark mode and large-text variants for key screens.
5. **Screen specifications**: purpose, layout, components, data, actions, navigation, permissions, mobile interactions.
6. **Workflow walkthroughs** (images): referral intake, arrival and interconnecting-room allocation, finance approval, change request, archive and restore, room check and escalation.
7. **Coverage report**: pages identified vs redesigned, tabs and modals covered, roles covered, open questions. Every page in section 5 must be listed with its screen count; anything not covered must say so plainly.

## 10. Process

Phase 1 audit against the source and the existing \`design/ios\` set, listing gaps. Phase 2 navigation and roles. Phase 3 design system. Phase 4 mock-ups module by module, keeping a completion checklist. Phase 5 specifications and workflows. Phase 6 verification: re-count pages and tabs against \`design/ios/data/audit.json\` and report any difference.

## 11. Hard constraints

- Design only. No backend change, no migration, no database access, no production data, no web file edits, no iOS code in this task.
- Do not invent modules, roles, fields or flows. If something is unclear, record it as a question in the coverage report.
- Use fictional data only.
- Be honest in the coverage report about anything simplified, generated from a template or not rendered.

## 12. Known facts and open questions to carry forward

- Engineer and Customer roles do not exist (see section 2).
- Push notifications do not exist on the web (in-app centre and email rules only); designs may propose them, flagged as new.
- Offline conflict behaviour is undefined on the web; propose and flag it.
- Approver rules by amount band for finance were not found in the repository; do not invent thresholds.
- Customize Table (Super Admin edits columns) changes the schema forms are built from; assume mobile forms follow it.
`;

fs.writeFileSync(path.join(OUT, 'AGENT-PROMPT.md'), text);
console.log('AGENT-PROMPT.md', text.length, 'chars');
