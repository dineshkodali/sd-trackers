/** Foundation, navigation, role and page-specific screens. */
const U = require('./ui.cjs');
const G = require('./generic.cjs');
const { rng, pick, STAFF, NAMES, SITES, valueFor } = require('./data.cjs');
const { PAGES, SUBSCREENS } = require('./pages.cjs');
const { ROLES, PERMS, canSee, ROLE_PROFILE } = require('./roles.cjs');
const { T, ic, esc, badge } = U;

const spec = (name, purpose, layout, components, data, actions, nav, permissions, interactions) =>
  ({ name, purpose, layout, components, data, actions, nav, permissions, interactions });
const flex = (inner, extra = '') => `<div style="display:flex;${extra}">${inner}</div>`;
const grow = (btn, n = 1) => btn.replace('class="btn', `style="flex:${n}" class="btn`);

/* ------------------------------------------------------------------------ foundation */

function splash() {
  const html = `<div class="phone"><div class="screen" style="background:linear-gradient(160deg,#0F766E,#115E59);color:#fff;align-items:center;justify-content:center">
    <div class="island"></div>
    <div style="width:104px;height:104px;border-radius:26px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 30px rgba(0,0,0,.25)">
      <div style="font-weight:800;font-size:40px;color:${T.tint};letter-spacing:-1px">SD</div></div>
    <div style="margin-top:22px;font-size:30px;font-weight:700;letter-spacing:.3px">SDTracker</div>
    <div style="margin-top:6px;font-size:15px;opacity:.8">Property operations and safeguarding</div>
    <div style="position:absolute;bottom:70px;width:34px;height:34px;border:3px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%"></div>
    <div class="home" style="background:#fff"></div></div></div>`;
  return { html, spec: spec('Splash', 'Brand moment while the session and role permissions load.', 'Centred app mark and name on the brand gradient, spinner at the bottom.', ['App icon mark', 'Spinner'], 'None. Resolves the Supabase session, then the user profile and page permissions (the web app shows "Loading your access…" until they are ready).', 'None.', 'Goes to Sign in when there is no session, otherwise Home.', 'Public.', 'Respects Reduce Motion.') };
}

function signIn(variant) {
  const err = variant === 'error';
  const body = `
  <div style="text-align:center;padding:18px 0 22px"><div style="width:68px;height:68px;border-radius:18px;background:${T.tint};color:#fff;font-weight:800;font-size:26px;display:inline-flex;align-items:center;justify-content:center">SD</div>
    <div style="font-size:28px;font-weight:700;margin-top:14px">Sign in</div><div class="s2">Use your SDTracker work account</div></div>
  ${err ? U.banner('Incorrect email or password. Check them and try again.', 'red', 'AlertCircle') : ''}
  ${U.group(null, [U.row({ label: 'Email', value: 'jordan.ellis@example.org' }), U.row({ label: 'Password', value: '••••••••••' })])}
  ${U.button('Sign in', '')}
  <div style="text-align:center;margin-top:16px;color:${T.tint};font-size:15px">Forgot password?</div>
  <div style="text-align:center;margin-top:26px;color:${T.label3};font-size:13px">${ic('FaceId', 20, T.tint)}<div style="margin-top:4px">Face ID can unlock after your first sign-in</div></div>`;
  return { html: U.phone({ body }), spec: spec(err ? 'Sign in — error' : 'Sign in', 'Authenticate with Supabase Auth (email and password).', 'Brand mark, title, grouped email/password rows, primary button, forgot-password link, biometric hint.', ['Inset text fields', 'Primary button', 'Inline error banner', 'Face ID prompt (after first sign-in)'], 'Email, password.', 'Sign in, Forgot password, Face ID unlock of the stored session.', 'On success → Home. Blocked accounts → Access blocked screen.', 'Public. Archived or deleted users cannot sign in (server enforces account lifecycle).', 'Password AutoFill, secure text entry, error announced to VoiceOver.') };
}

function resetPassword() {
  const body = `<div style="padding:10px 0 18px"><div style="font-size:28px;font-weight:700">Reset password</div><div class="s2" style="margin-top:6px">We will email a secure link. Open it on this phone to choose a new password.</div></div>
  ${U.group(null, [U.row({ label: 'Email', value: 'jordan.ellis@example.org' })])}${U.button('Send reset link', '')}
  ${U.banner('If the address belongs to an account you will receive an email within a few minutes.', 'blue')}`;
  return { html: U.phone({ nav: U.navInline({ title: '', back: 'Sign in' }), body }), spec: spec('Reset password', 'Start (and complete) a password reset.', 'Inline nav, explanatory text, email row, primary button, confirmation banner.', ['Inset field', 'Primary button', 'Info banner'], 'Email; new password and confirmation on the return screen.', 'Send link, set new password.', 'Back to Sign in; the link deep-links to the set-password step.', 'Public.', 'Universal link opens the app directly.') };
}

function sessionLock() {
  const body = `<div style="text-align:center;padding-top:150px">${ic('Lock', 56, T.tint, 1.5)}<div style="font-size:24px;font-weight:700;margin-top:14px">Session locked</div><div class="s2" style="margin:8px 28px 22px">You were inactive, so SDTracker locked itself to protect resident data.</div>${U.button('Unlock with Face ID', '', 'FaceId')}<div style="margin-top:14px;color:${T.tint}">Use password instead</div></div>`;
  return { html: U.phone({ body }), spec: spec('Session lock', 'Protect data after inactivity (web: Session Lock modal and inactivity timeout in Settings).', 'Full-screen lock with biometric unlock.', ['Lock glyph', 'Primary button'], 'No data shown while locked.', 'Unlock (Face ID / passcode), switch to password, sign out.', 'Returns to the screen you were on.', 'Any signed-in role.', 'App-switcher snapshot is blurred.') };
}

function accessDenied() {
  const body = `<div style="text-align:center;padding-top:130px">${ic('ShieldLock', 56, T.red, 1.5)}<div style="font-size:24px;font-weight:700;margin-top:14px">You do not have access</div><div class="s2" style="margin:8px 24px 22px">Reports &amp; Compliance needs a role that can export data. Ask a Super Admin if you need it.</div>${U.button('Back to Home', 'sec')}</div>`;
  return { html: U.phone({ nav: U.navInline({ title: 'Reports', back: 'More' }), body }), spec: spec('Access denied', 'Shown when a role or Page Access override blocks a page (web: AccessDeniedView).', 'Centred glyph, plain-language reason naming the required role, one button.', ['Empty-state glyph', 'Button'], 'Page name and the role or grant required.', 'Back to Home.', 'Replaces the destination.', 'Shown to any user lacking access; the page is normally hidden from navigation so this appears only via a link or push notification.', 'Does not reveal the page content.') };
}

function maintenancePage() {
  const body = `<div style="text-align:center;padding-top:120px">${ic('Tool', 56, T.orange, 1.5)}<div style="font-size:24px;font-weight:700;margin-top:14px">Back shortly</div><div class="s2" style="margin:8px 24px 22px">This page is being updated. It will be restored soon.</div>${U.button('Try again', 'sec')}</div>`;
  return { html: U.phone({ nav: U.navInline({ title: 'Maintenance Tracker', back: 'Operations' }), body }), spec: spec('Page under maintenance', 'Page Maintenance Mode set by a Super Admin (web: PageMaintenanceView).', 'Centred glyph, short message from settings, retry.', ['Empty-state glyph', 'Button'], 'Maintenance message from system settings.', 'Try again.', 'Replaces the page.', 'All roles see it; a Super Admin sees a banner and can still open the page.', '—') };
}

function blocked() {
  const body = `<div style="text-align:center;padding-top:120px">${ic('UserOff', 56, T.red, 1.5)}<div style="font-size:24px;font-weight:700;margin-top:14px">Account unavailable</div><div class="s2" style="margin:8px 24px 22px">This account is archived or suspended, so it cannot sign in. Contact your administrator.</div>${U.button('Sign out', 'red')}</div>`;
  return { html: U.phone({ body }), spec: spec('Authentication blocked', 'Explains why sign-in is refused (web: AuthenticationBlockedView; archived/deleted users are blocked by the lifecycle rules).', 'Centred glyph and message, sign-out.', ['Empty-state glyph', 'Button'], 'Reason only; no record data.', 'Sign out.', 'Returns to Sign in.', 'Public.', '—') };
}

function offline() {
  const body = `${U.banner('You are offline. Changes are saved on this phone and will sync when you reconnect.', 'orange', 'WifiOff')}${G.cardsFor(require('../../data/audit.json'), 'referrals', 3)}`;
  return { html: U.phone({ nav: U.navLarge({ title: 'SG Referrals', subtitle: 'Last synced 09:12', actions: [{ icon: 'Filter' }] }), body, tabbar: G.TABBAR(1) }), spec: spec('Offline / sync state', 'Keep working without signal; the web app shows a live-data banner and a Sync button.', 'Banner under the nav bar; cached cards stay readable.', ['Status banner', 'Cached cards', 'Sync indicator'], 'Cached copy of the permitted data.', 'Pull to sync, retry.', 'Stays on the same screen.', 'Cache is cleared on sign-out.', 'Queued edits show a clock badge until sent.') };
}

function states() {
  const body = `<div class="ghead">Loading</div>${[0, 1].map(() => `<div class="card"><div class="skel" style="height:16px;width:60%"></div><div class="skel" style="height:12px;width:40%;margin-top:8px"></div><div class="skel" style="height:12px;width:80%;margin-top:14px"></div></div>`).join('')}
  <div class="ghead">Empty</div><div class="card" style="text-align:center;padding:22px">${ic('FileSearch', 36, T.label3, 1.4)}<div class="ttl" style="margin-top:8px">No records found</div><div class="s2">Try a different filter, or add the first record.</div><div style="margin-top:12px">${U.button('Add record', 'sec sm')}</div></div>
  <div class="ghead">Error</div>${U.banner('Could not load from the live database. Check your connection and try again. <b>Retry</b>', 'red', 'AlertCircle')}
  <div class="ghead">Success</div>${U.banner('Referral saved and synced.', 'green', 'CircleCheck')}`;
  return { html: U.phone({ nav: U.navInline({ title: 'States', back: 'Back' }), body }), spec: spec('Loading, empty, error and success states', 'One consistent pattern for the four states the web app already has.', 'Skeleton cards, centred empty state with action, red banner with Retry, green confirmation.', ['Skeleton', 'Empty state', 'Error banner', 'Success banner / toast'], '—', 'Retry, Add record.', '—', '—', 'Success is a toast that auto-dismisses; errors persist until resolved.') };
}

/* --------------------------------------------------------------------------- homes */

function homeBody(role, audit) {
  const p = PERMS[role];
  const kpis = [['Open referrals', '14', '3 new today', 'red'], ['Open escalations', '2', 'SLA 1 at risk', 'orange'], ['Occupancy', '87%', '412 of 474 beds', 'green'], ['Defects open', '9', '2 CAT 1', 'orange']];
  const attention = [
    ['Escalation', 'Urgent — no heating, Room 214', 'Riverside Court · 20 min ago', 'red'],
    ['Review due', 'Vulnerable resident review tomorrow', 'Harbour View Hotel', 'orange'],
    ['Certificate', 'Gas safety expires in 6 days', 'Willow House', 'orange'],
  ];
  const show = pg => canSee(role, pg);
  const quick = [['Plus', 'New referral'], ['BuildingCommunity', 'Register'], ['Tool', 'Log defect'], ['Camera', 'Room check']];
  const cards = `
  <div style="display:flex;align-items:center;justify-content:space-between;margin:2px 0 10px"><div><div class="s2" style="margin:0">Good morning</div><div style="font-size:22px;font-weight:700">Jordan</div></div>${badge(p.allSites ? 'All sites' : '2 sites', 'teal', false)}</div>
  <div class="kpis">${kpis.map(([l, n, d, t]) => `<div class="kpi"><div class="l">${l}</div><div class="n">${n}</div><div class="d" style="color:${U.TONES[t][1]}">${d}</div></div>`).join('')}</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">${quick.map(([i, l]) => `<div style="text-align:center"><div class="circle solid" style="width:50px;height:50px;border-radius:16px;margin:0 auto">${ic(i, 22)}</div><div style="font-size:11.5px;margin-top:5px">${l}</div></div>`).join('')}</div>
  <div class="ghead">Needs attention</div>${attention.map(([k, t, s, tone]) => `<div class="card"><div class="row1"><div><div class="ttl" style="font-size:15px">${t}</div><div class="s2">${s}</div></div>${badge(k, tone)}</div></div>`).join('')}
  <div class="card"><div class="row1"><div class="ttl">Guest statistics</div><span class="s2">Today</span></div>
   <div style="display:flex;gap:14px;align-items:center;margin-top:10px"><svg width="86" height="86" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#E5E5EA" stroke-width="6"/><circle cx="21" cy="21" r="15.9" fill="none" stroke="#0D9488" stroke-width="6" stroke-dasharray="52 48" transform="rotate(-90 21 21)"/><circle cx="21" cy="21" r="15.9" fill="none" stroke="#2563EB" stroke-width="6" stroke-dasharray="38 62" stroke-dashoffset="-52" transform="rotate(-90 21 21)"/></svg>
   <div style="font-size:13px;line-height:1.7"><span class="dot" style="background:#0D9488"></span> Female 214<br><span class="dot" style="background:#2563EB"></span> Male 156<br><span class="dot" style="background:#AF52DE"></span> Children 62 · Elderly 18</div></div></div>
  ${show('financeApprovals') && p.finance ? '<div class="card"><div class="row1"><div class="ttl">3 invoices awaiting your approval</div>' + badge('£4,820', 'blue', false) + '</div></div>' : ''}`;
  return cards;
}

function home(role, audit) {
  const nav = U.navLarge({ title: 'Home', subtitle: ROLE_PROFILE[role].scope, actions: [{ icon: 'Bell' }, { icon: 'UserCircle' }] });
  const html = U.phone({ nav, body: homeBody(role, audit), tabbar: G.TABBAR(0) });
  const prof = ROLE_PROFILE[role];
  return { html, spec: spec(`Home — ${role}`, `Role-aware landing screen for ${prof.who}.`, 'Large-title bar with notifications bell (badge) and profile; greeting and site scope pill; KPI grid; quick actions; needs-attention list; guest statistics chart; approvals card for finance roles.', ['KPI cards', 'Quick action tiles', 'Needs-attention cards', 'Donut chart', 'Tab bar'], `Counts come from the same permitted, site-scoped data as the web Executive Dashboard; scope: ${prof.scope}.`, 'Open a KPI or card to jump to its module; quick actions open the create form; pull to refresh.', 'KPI → filtered list. Bell → Notifications. Avatar → Profile.', `Widgets are shown only for pages the role can view. ${prof.extra}.`, 'Widgets can be reordered and hidden (web: personalised dashboard builder); long-press to edit.') };
}

/* ------------------------------------------------------------------------ hubs & more */

function moduleRows(ids, role, audit) {
  return ids.filter(id => canSee(role, id)).map(id => {
    const cfg = PAGES[id] || {};
    const a = G.auditOf(audit, id);
    return U.row({ label: a ? a.title : id, icon: cfg.icon || 'Circle', tone: cfg.tone === 'indigo' ? 'purple' : (cfg.tone || 'teal'), chevron: true });
  });
}
const idsOf = (audit, cat) => audit.pages.filter(p => p.category === cat && p.registered).map(p => p.id);

function hub(kind, role, audit) {
  const sg = idsOf(audit, 'Safeguarding'), ops = [...idsOf(audit, 'Overview'), ...idsOf(audit, 'Facilities & Welfare')];
  if (kind === 'safeguarding') {
    const rows = moduleRows(sg, role, audit);
    const body = `${U.searchBar('Search safeguarding')}${U.group('Safeguarding', rows.slice(0, 15))}`;
    return { html: U.phone({ nav: U.navLarge({ title: 'Safeguarding', subtitle: `${rows.length} modules`, actions: [] }), body, tabbar: G.TABBAR(1) }), spec: spec(`Safeguarding hub — ${role}`, 'Module landing for the Safeguarding category.', 'Large title, search, inset list of modules with coloured symbol tiles.', ['Inset list', 'Symbol tiles', 'Search field'], 'Module names from the web page registry.', 'Open module; search modules.', 'Row → module list.', `Shows only modules ${role} can open (${rows.length} of ${sg.length}).`, 'Recently used modules float to the top.') };
  }
  const rows = moduleRows(ops, role, audit);
  const body = `${U.searchBar('Search operations')}${U.group('Operations & facilities', rows.slice(0, 15))}`;
  return { html: U.phone({ nav: U.navLarge({ title: 'Operations', subtitle: `${rows.length} modules`, actions: [] }), body, tabbar: G.TABBAR(2) }), spec: spec(`Operations hub — ${role}`, 'Module landing for Overview and Facilities & Welfare.', 'Large title, search, inset list of modules.', ['Inset list', 'Symbol tiles'], 'Module names from the web page registry.', 'Open module.', 'Row → module list.', `Shows only modules ${role} can open (${rows.length} of ${ops.length}).`, '—') };
}

function more(role, audit) {
  const fin = moduleRows(idsOf(audit, 'Finance'), role, audit);
  const comp = moduleRows(idsOf(audit, 'Compliance & Community'), role, audit);
  const adm = moduleRows([...idsOf(audit, 'Admin & Governance'), 'pageAccess', 'pageMaintenance', 'settings'], role, audit);
  const body = `${U.group('', [U.row({ label: 'Jordan Ellis', value: role, icon: 'UserCircle', chevron: true })])}
  ${fin.length ? U.group('Finance', fin) : ''}${comp.length ? U.group('Compliance & community', comp) : ''}${adm.length ? U.group('Admin & governance', adm) : ''}
  ${U.group('', [U.row({ label: 'Notifications', icon: 'Bell', tone: 'red', chevron: true }), U.row({ label: 'Sign out', icon: 'Logout', tone: 'gray' })])}`;
  return { html: U.phone({ nav: U.navLarge({ title: 'More', actions: [] }), body, tabbar: G.TABBAR(4) }), spec: spec(`More — ${role}`, 'Everything not in the other four tabs, grouped by the web categories, filtered by role.', 'Profile row, then grouped lists for Finance, Compliance & Community and Admin & Governance, then notifications and sign out.', ['Inset lists', 'Profile row'], 'Module names from the page registry; groups empty for this role are hidden.', 'Open module, profile, sign out.', 'Row → module.', `${ROLE_PROFILE[role].extra}.`, 'Groups collapse when empty; nothing is greyed-out — unavailable modules are simply absent.') };
}

function search(withResults) {
  const rows = withResults
    ? [['Amara Okafor', 'Service user · Room 214 · PR-48213', 'UserSquare'], ['Defect — Room 214 heating', 'Maintenance · Open', 'Tool'], ['Amara Okafor — GP visit', 'GP appointment · 12 Nov', 'Stethoscope'], ['Riverside Court', 'Property · 64 rooms', 'Building']]
    : [['Referrals', 'Recent', 'History'], ['Daily Register', 'Recent', 'History'], ['Room 214', 'Recent', 'History']];
  const body = `${U.searchBar(withResults ? 'amara' : 'Search residents, rooms, modules')}${withResults ? U.chips(['All', 'People', 'Records', 'Modules', 'Properties'], 0) : ''}
  ${U.group(withResults ? 'Top results' : 'Recent', rows.map(([t, s, i]) => U.row({ label: t, value: '', icon: i, tone: 'teal' }).replace('</span></div>', `</span><span class="v" style="font-size:12px">${esc(s.split(' · ')[0])}</span></div>`)))}`;
  return { html: U.phone({ nav: U.navLarge({ title: 'Search', actions: [] }), body, tabbar: G.TABBAR(3) }), spec: spec(withResults ? 'Search — results' : 'Search — start', 'Global search (web: Quick Jump) across residents, records, properties and modules.', 'Large title, native search field, scope chips, grouped results with type labels.', ['Search field', 'Scope chips', 'Result rows'], 'Results respect site scope and page permissions; resident names and refs are matched.', 'Type, filter by scope, open a result, clear recents.', 'Result → record detail or module.', 'Never returns records from pages or sites the role cannot see.', 'Debounced; recents stored on device only.') };
}

function notifications() {
  const items = [['Escalation raised', 'Urgent — no heating, Room 214', '20m', 'red', true], ['Referral status changed', 'Amara Okafor → In progress', '2h', 'blue', true], ['Compliance expiring', 'Gas safety — Willow House, 6 days', '5h', 'orange', false], ['Change request approved', 'Edit locked record — approved by Morgan Blake', 'Yesterday', 'green', false]];
  const body = `${U.chips(['All', 'Unread', 'Escalations', 'Approvals'], 0)}${items.map(([t, s, w, tone, unread]) => `<div class="card" style="display:flex;gap:11px"><span class="ibox" style="background:${T[tone]}">${ic('Bell', 17, '#fff')}</span><div style="flex:1"><div class="ttl" style="font-size:15px">${t}</div><div class="s2">${s}</div></div><div class="s2" style="margin:0">${w}${unread ? '<br><span class="dot" style="background:' + T.tint + '"></span>' : ''}</div></div>`).join('')}`;
  return { html: U.phone({ nav: U.navLarge({ title: 'Notifications', actions: [{ icon: 'Checks' }] }), body, tabbar: G.TABBAR(0) }), spec: spec('Notifications', 'In-app notification list (web: header bell and notification centre) plus push.', 'Large title, filter chips, notification cards with unread dot, mark-all-read.', ['Chips', 'Notification cards', 'Mark all read'], 'Event, title, detail, time, read state.', 'Open the related record, mark read, clear all.', 'Tap → record. Opened from the Home bell.', 'Only events for sites and modules the role can see (web notification scope rules).', 'Swipe to mark read or clear; push opens the same record.') };
}

function profile(role) {
  const p = ROLE_PROFILE[role];
  const body = `<div style="text-align:center;padding:6px 0 18px"><div class="avatar" style="width:84px;height:84px;font-size:30px;margin:0 auto">JE</div><div style="font-size:22px;font-weight:700;margin-top:10px">Jordan Ellis</div><div class="s2">jordan.ellis@example.org</div><div style="margin-top:8px">${badge(role, 'teal')}</div></div>
  ${U.group('Access', [U.row({ label: 'Role', value: role }), U.row({ label: 'Sites', value: p.scope === 'All sites' ? 'All sites' : 'Riverside Court, Elm Park Lodge' }), U.row({ label: 'Pages you can open', value: String(require('../../data/audit.json').pages.filter(pg => canSee(role, pg.id)).length), chevron: true })])}
  ${U.group('Security', [U.row({ label: 'Face ID unlock', toggle: true, icon: 'FaceId' }), U.row({ label: 'Change password', icon: 'Key', chevron: true, tone: 'blue' }), U.row({ label: 'Auto-lock', value: '5 minutes', icon: 'Lock', chevron: true, tone: 'orange' })])}
  ${U.button('Sign out', 'red')}`;
  return { html: U.phone({ nav: U.navInline({ title: 'Profile', back: 'Home' }), body }), spec: spec(`Profile — ${role}`, 'Account, access summary and device security.', 'Avatar header, access group, security group, sign out.', ['Avatar', 'Inset lists', 'Toggle', 'Destructive button'], 'Name, email, role, assigned sites, count of pages the role can open.', 'Change password, toggle Face ID, set auto-lock, sign out.', 'Pushed from Home or More.', 'Read-only for role and sites (only an admin changes them).', 'Biometric toggle prompts Face ID to confirm.') };
}

function appSettings() {
  const body = `${U.group('Appearance', [U.row({ label: 'Theme', value: 'System', icon: 'Moon', chevron: true, tone: 'purple' }), U.row({ label: 'Text size', value: 'Default', icon: 'Typography', chevron: true, tone: 'blue' })])}
  ${U.group('Notifications', [U.row({ label: 'Push notifications', toggle: true, icon: 'Bell', tone: 'red' }), U.row({ label: 'Escalation alerts', toggle: true, icon: 'AlertTriangle', tone: 'orange' }), U.row({ label: 'Approval requests', toggle: true, icon: 'CircleCheck', tone: 'green' })])}
  ${U.group('Data', [U.row({ label: 'Sync now', icon: 'Refresh', chevron: true }), U.row({ label: 'Offline cache', value: '42 MB', icon: 'Database', chevron: true, tone: 'gray' })])}
  ${U.group('About', [U.row({ label: 'Version', value: '1.0 (design reference)' }), U.row({ label: 'Privacy', chevron: true })])}`;
  return { html: U.phone({ nav: U.navInline({ title: 'App settings', back: 'More' }), body }), spec: spec('App settings (personal)', 'Per-device preferences. Distinct from the admin-only System Settings page.', 'Grouped settings list.', ['Inset lists', 'Toggles'], 'Local preferences; push subscriptions.', 'Change theme/text size, toggle alerts, sync, clear cache.', 'Pushed from More.', 'All roles.', 'Honours system Dynamic Type.') };
}

/* ------------------------------------------------------------------------ Daily Registers */

function registerHub(tabIdx) {
  const subs = SUBSCREENS.dailyRegisters;
  const names = ['Daily Register', 'Room List', 'New Arrivals', 'Statistics'];
  const guests = [['Amara Okafor', 'Room 214 · PR-48213', 'Female · 34', 'Aspen'], ['Daniel Kovac', 'Room 118 · PR-48871', 'Male · 41', ''], ['Leila Haddad', 'Room 305 · PR-49102', 'Female · 9', 'Aspen']];
  const body = `${U.segmented(names, tabIdx)}${U.searchBar('Search name, port ref, room')}
  <div class="hscroll"><div class="chip on">${ic('Filter', 14)} Guest filters · 2</div><div class="chip">Occupied</div><div class="chip">Riverside Court ▾</div><div class="chip">Today</div></div>
  <div class="kpis" style="grid-template-columns:repeat(3,1fr)">${[['Guests', '370'], ['Beds free', '62'], ['Occupancy', '87%']].map(([l, n]) => `<div class="kpi" style="padding:9px 10px"><div class="l">${l}</div><div class="n" style="font-size:21px">${n}</div></div>`).join('')}</div>
  ${guests.map(([n, r, a, asp]) => `<div class="card"><div class="row1"><div><div class="ttl">${n}</div><div class="s2">${r}</div></div>${badge('Occupied', 'green')}</div><div class="meta"><span>${ic('User', 14, T.label3)}${a}</span><span>${ic('Language', 14, T.label3)}Tigrinya</span>${asp ? `<span>${ic('CreditCard', 14, T.teal)}Aspen card</span>` : ''}</div></div>`).join('')}`;
  return { html: U.phone({ nav: U.navLarge({ title: 'Live Register', subtitle: 'Riverside Court · 9 Nov', actions: [{ icon: 'Refresh' }, { icon: 'Plus', solid: true }] }), body, tabbar: G.TABBAR(2) }), spec: spec('Live Daily Registers — hub', 'The real-time headcount register: residents, rooms, arrivals, statistics.', `Large title with site and date; segmented control for the four primary views (the other ${subs.length - 4} web sheets sit under a "More views" row: ${subs.filter(s => !names.includes(s)).join(', ')}); KPI strip; guest-filter chip; resident cards.`, ['Segmented control', 'Search field', 'Filter chips', 'KPI strip', 'Resident cards'], 'Room, port ref, name, age, nationality/language, Aspen card flag, occupied state.', 'Search, open Guest filters, add resident, refresh/sync, export (permitted roles).', 'Card → resident detail. Chip → Guest filters sheet.', 'Page "dailyRegisters": view for all roles; no create on this page per page-action rules; allocation done from New Arrivals / forms.', 'Swipe card for Move room / Check out; site and date pickers in the nav subtitle.') };
}

function guestFilterSheet() {
  const inner = `${U.group('Age', [`<div class="li" style="flex-wrap:wrap;gap:8px">${['Children', 'Adults', 'Elderly', 'Custom'].map((s, i) => `<div class="chip ${i === 0 ? 'on' : ''}">${s}</div>`).join('')}</div>`])}
  ${U.group('Gender', [`<div class="li" style="flex-wrap:wrap;gap:8px">${['Male', 'Female', 'Other', 'Not specified'].map((s, i) => `<div class="chip ${i === 1 ? 'on' : ''}">${s}</div>`).join('')}</div>`])}
  ${U.group('Family size', [`<div class="li" style="flex-wrap:wrap;gap:8px">${['1', '2', '3', '4', '5+', 'Custom'].map(s => `<div class="chip">${s}</div>`).join('')}</div>`])}
  ${U.group('Aspen card', [U.row({ label: 'Holders only', toggle: false, icon: 'CreditCard' })])}
  ${flex(grow(U.button('Clear', 'line'), 1) + grow(U.button('Show 41 guests', ''), 2), 'gap:10px')}`;
  const base = registerHub(0);
  return { html: U.phone({ nav: U.navLarge({ title: 'Live Register', subtitle: 'Riverside Court · 9 Nov', actions: [] }), body: '', tabbar: G.TABBAR(2), overlay: U.sheet('Guest filters', inner) }), spec: spec('Daily Register — Guest filters sheet', 'Age, gender, family size and Aspen card filters (collapsible panel on web).', 'Large sheet; chip groups for each filter; Clear and result-count button.', ['Bottom sheet', 'Chip groups', 'Toggle'], 'Age uses DOB, then stored age, then age group (children <18, elderly 65+). Family size uses family-group members, or people sharing the room.', 'Select filters, Clear, apply.', 'Applies to the register list; Dashboard cards deep-link here with the filter set.', 'Same site scoping as the register.', 'Selections persist as removable chips on the list.') };
}

function guestStats() {
  const bar = (l, v, c) => `<div style="display:flex;align-items:center;gap:8px;margin:7px 0;font-size:13px"><div style="width:74px">${l}</div><div class="bar" style="flex:1"><i style="width:${v}%;background:${c}"></i></div><div style="width:34px;text-align:right">${v * 4}</div></div>`;
  const body = `${U.segmented(['Daily Register', 'Room List', 'New Arrivals', 'Statistics'], 3)}
  <div class="kpis">${[['Total guests', '370'], ['Male', '156'], ['Female', '214'], ['Other / unspecified', '0'], ['Children', '62'], ['Elderly', '18'], ['Aspen holders', '121'], ['Families of 4', '9']].map(([l, n]) => `<div class="kpi" style="padding:10px 12px"><div class="l">${l}</div><div class="n" style="font-size:22px">${n}</div></div>`).join('')}</div>
  <div class="card"><div class="ttl">Age</div>${bar('Children', 17, '#D97706')}${bar('Adults', 78, '#0D9488')}${bar('Elderly', 5, '#8764B8')}</div>
  <div class="card"><div class="ttl">Family size (families)</div>${bar('Individuals', 40, '#0D9488')}${bar('Family of 2', 22, '#0D9488')}${bar('Family of 4', 9, '#0D9488')}</div>`;
  return { html: U.phone({ nav: U.navLarge({ title: 'Live Register', subtitle: 'Riverside Court · 9 Nov', actions: [{ icon: 'Refresh' }] }), body, tabbar: G.TABBAR(2) }), spec: spec('Daily Register — Guest statistics', 'Summary cards and charts for the selected site and date.', 'KPI grid then chart cards (bars/donut); every figure is tappable.', ['KPI cards', 'Bar charts', 'Donut charts'], 'Counts de-duplicated per guest; family cards count families.', 'Tap a figure → Daily Register filtered to it.', 'Deep link with filter, site and date.', 'Site scope applies.', 'Charts expose values to VoiceOver as a list.') };
}

function roomList() {
  const rooms = [['214', 'Double', 'Interconnecting', '215', 'Part occupied', 'blue'], ['215', 'Double', 'Interconnecting', '214', 'Available', 'green'], ['118', 'Single', 'Standard', '—', 'Full', 'orange'], ['305', 'Family', 'Standard', '—', 'Available', 'green']];
  const body = `${U.segmented(['Daily Register', 'Room List', 'New Arrivals', 'Statistics'], 1)}${U.searchBar('Search room, floor')}
  ${rooms.map(([n, t, k, c, a, tone]) => `<div class="card"><div class="row1"><div><div class="ttl">Room ${n}</div><div class="s2">${t} · Floor ${n[0]}</div></div>${badge(a, tone)}</div>
   <div class="meta"><span>${ic(k === 'Standard' ? 'Door' : 'Link', 14, k === 'Standard' ? T.label3 : T.teal)}${k === 'Standard' ? 'Standard Room' : 'Interconnecting · connects to ' + c}</span><span>${ic('Bed', 14, T.label3)}1 of 2 beds</span></div></div>`).join('')}`;
  return { html: U.phone({ nav: U.navLarge({ title: 'Live Register', subtitle: 'Riverside Court', actions: [{ icon: 'Link' }, { icon: 'Plus', solid: true }] }), body, tabbar: G.TABBAR(2) }), spec: spec('Room List — interconnecting rooms', 'Room inventory with interconnecting status, connected rooms, occupancy and availability.', 'Segmented hub; room cards with type, connection badge, occupancy and availability badge; link button for managers.', ['Room cards', 'Interconnecting badge', 'Availability badge'], 'Room number, type, interconnecting status, connected rooms, current occupancy, availability.', 'Open room, add room, connect rooms (managers).', 'Link button → Connect rooms sheet.', 'Configure links: Super Admin, Admin, General/Area Manager. Staff view and allocate only.', 'Group availability (fully / partially / none) shown on the badge.') };
}

function connectSheet() {
  const inner = `${U.group('Property', [U.row({ label: 'Property', value: 'Riverside Court', chevron: true, icon: 'Building' })])}
  ${U.group('Rooms (2 selected)', [['214', true, '1 of 2 free'], ['215', true, '2 of 2 free'], ['216', false, '0 of 2 free'], ['217', false, '2 of 2 free']].map(([n, on, f]) => `<div class="li"><span class="k">Room ${n}</span><span class="v" style="margin-right:10px">${f}</span><span style="color:${on ? T.tint : '#C7C7CC'}">${ic(on ? 'CircleCheckFilled' : 'Circle', 24, 'currentColor', 1.8)}</span></div>`))}
  ${U.banner('Rooms already connected to another group are not listed. A group joins 2 to 6 rooms in one property.', 'blue')}${U.button('Save connection', '')}`;
  return { html: U.phone({ nav: U.navLarge({ title: 'Live Register', actions: [] }), body: '', tabbar: G.TABBAR(2), overlay: U.sheet('Connect rooms', inner) }), spec: spec('Connect rooms sheet', 'Configure an interconnecting group (managers).', 'Sheet with property, searchable room checklist with free beds, rules note, save.', ['Bottom sheet', 'Checklist', 'Banner'], 'Rooms of the property not already in a group, with free beds.', 'Select 2–6 rooms, Save, Remove connection (when editing).', 'Returns to the Room List.', 'Super Admin, Admin, General Manager, Area Manager (enforced in app, API and database).', 'Validation: same property, no duplicates, no room in two groups.') };
}

function allocation() {
  const rows = [['Room 118', '2 beds free', null, ''], ['Room 214', '1 bed free', 'Interconnects with 215 (2 free) · fully available', 'ok'], ['Room 215', '2 beds free', 'Interconnects with 214 (1 free) · fully available', 'ok'], ['Room 305', '1 bed free', null, '']];
  const body = `${U.group('Resident', [U.row({ label: 'Name', value: 'Leila Haddad' }), U.row({ label: 'Port reference', value: 'PR-49102' }), U.row({ label: 'Family', value: '4 people' })])}
  ${U.group('Choose room', rows.map(([r, f, ic2, k], i) => `<div class="li" style="display:block"><div style="display:flex;align-items:center"><span class="k">${r}</span><span class="v">${f}</span><span style="margin-left:10px;color:${i === 1 ? T.tint : '#C7C7CC'}">${ic(i === 1 ? 'CircleCheckFilled' : 'Circle', 24, 'currentColor', 1.8)}</span></div>${ic2 ? `<div style="margin-top:4px;font-size:12.5px;color:${T.tint};display:flex;gap:5px;align-items:center">${ic('Link', 13, T.tint)}${ic2}</div>` : ''}</div>`))}
  ${U.banner('Family of 4: place members in any room of an interconnecting group. Full rooms are hidden so nobody is double-booked.', 'blue', 'Users')}${U.button('Check in', '')}`;
  return { html: U.phone({ nav: U.navInline({ title: 'Allocate room', leading: 'Cancel', trailingText: 'Check in' }), body }), spec: spec('SU allocation — room selection', 'Place a resident (or family) in a room, showing interconnecting availability.', 'Resident summary, room picker with free beds and connected-room hints, family note.', ['Inset rows', 'Radio selection', 'Info banner'], 'Rooms with at least one free bed; connected room numbers and their free beds; group availability.', 'Pick room, check in, repeat for other family members in connected rooms.', 'From New Arrivals or the register form; returns to the register.', 'Create/edit on dailyRegisters; allocation rules unchanged (capacity, one active placement per port ref).', 'Selecting a connected room offers "Place next family member here".') };
}

function simpleSub(title, seg, body, specText) {
  return { html: U.phone({ nav: U.navLarge({ title: 'Live Register', subtitle: 'Riverside Court · 9 Nov', actions: [{ icon: 'Refresh' }] }), body: `<div class="chips">${['Daily Register', 'Room List', 'New Arrivals', 'Statistics', title].map((c, i) => `<div class="chip ${c === title ? 'on' : ''}">${c}</div>`).join('')}</div>${body}`, tabbar: G.TABBAR(2) }), spec: specText };
}

function registerSubs(audit) {
  const out = [];
  const fam = `<div class="card"><div class="row1"><div class="ttl">Okafor household</div>${badge('4 people', 'blue', false)}</div><div class="s2">Rooms 214 · 215 (interconnecting)</div><div class="meta"><span>${ic('User', 14, T.label3)}Amara · Mother</span><span>${ic('User', 14, T.label3)}Kofi · Child</span></div></div><div class="card"><div class="row1"><div class="ttl">Haddad household</div>${badge('2 people', 'blue', false)}</div><div class="s2">Room 305</div></div>`;
  out.push(['family-groups', simpleSub('Family Groups', 7, fam, spec('Daily Register — Family Groups', 'Households and who is in each (web: Family Groups tab).', 'Household cards with member count and rooms.', ['Household cards'], 'Family name, members, relationship, rooms.', 'Open household, add or remove member.', 'Card → household detail.', 'Needs family groups access.', 'Swipe a member to remove with reason.')).spec && simpleSub('Family Groups', 7, fam, spec('Daily Register — Family Groups', 'Households and who is in each (web: Family Groups tab).', 'Household cards with member count and rooms.', ['Household cards'], 'Family name, members, relationship, rooms.', 'Open household, add or remove member.', 'Card → household detail.', 'Needs family groups access.', 'Swipe a member to remove with reason.'))]);
  const val = `${U.banner('4 cross-checks need attention', 'orange', 'AlertTriangle')}${[['Duplicate port reference', 'PR-48213 appears twice', 'red'], ['Room over capacity', 'Room 118 has 3 of 2 beds', 'red'], ['Missing DOB', '5 residents', 'orange'], ['Void room occupied', 'Room 302', 'orange']].map(([t, s, tn]) => `<div class="card"><div class="row1"><div><div class="ttl" style="font-size:15px">${t}</div><div class="s2">${s}</div></div>${badge(tn === 'red' ? 'Fix' : 'Review', tn)}</div></div>`).join('')}`;
  out.push(['validation', simpleSub('Validation', 4, val, spec('Daily Register — Cross checks & validation', 'Data-quality checks across rooms and residents.', 'Summary banner then check cards.', ['Banner', 'Check cards'], 'Check name, count, affected records.', 'Open affected record, mark reviewed.', 'Card → filtered register.', 'Same as register.', '—'))]);
  const lang = ['Tigrinya', 'Arabic', 'Pashto', 'Farsi', 'Ukrainian'].map((l, i) => `<div style="display:flex;align-items:center;gap:8px;margin:8px 0;font-size:13px"><div style="width:78px">${l}</div><div class="bar" style="flex:1"><i style="width:${70 - i * 12}%;background:${T.teal}"></i></div><div style="width:30px;text-align:right">${90 - i * 15}</div></div>`).join('');
  out.push(['language-summary', simpleSub('Languages', 5, `<div class="card"><div class="ttl">Languages spoken</div>${lang}</div><div class="card"><div class="ttl">Nationalities</div>${lang}</div>`, spec('Daily Register — Nationality & language summary', 'Counts of languages and nationalities.', 'Bar lists.', ['Bar charts'], 'Counts per language/nationality.', 'Tap a bar to filter the register.', 'Deep link to register.', 'Site scope.', '—'))]);
  const guide = U.group('How to use', ['Adding a resident', 'Allocating a room', 'Interconnecting rooms', 'Check-out and moves', 'Reading the statistics'].map(t => U.row({ label: t, chevron: true, icon: 'Book', tone: 'blue' })));
  out.push(['user-guide', simpleSub('User Guide', 2, guide, spec('Daily Register — User Guide', 'In-app help (web: User Guide tab).', 'List of help articles.', ['Inset list'], 'Static guide content.', 'Open article.', 'Row → article.', 'All roles.', '—'))]);
  const arr = `<div class="card"><div class="row1"><div><div class="ttl">Samir Yilmaz</div><div class="s2">PR-50211 · Arrived today</div></div>${badge('Pending room', 'orange')}</div><div class="meta"><span>${ic('Language', 14, T.label3)}Arabic</span><span>${ic('CreditCard', 14, T.teal)}Aspen card</span></div><div style="margin-top:10px">${U.button('Allocate room', 'sec sm', 'DoorEnter')}</div></div>` + `<div class="card"><div class="row1"><div><div class="ttl">Hana Novak</div><div class="s2">PR-50219 · Room 305</div></div>${badge('Checked in', 'green')}</div></div>`;
  out.push(['new-arrivals', simpleSub('New Arrivals', 6, arr, spec('Daily Register — New Arrivals', 'Intake queue for people arriving today.', 'Arrival cards with status and Allocate room action.', ['Arrival cards', 'Primary action'], 'Port ref, name, language, Aspen card, hotel, room, status.', 'Allocate room, edit, check in.', 'Allocate → room picker.', 'Create/edit.', 'Check-in creates the register entry and carries the Aspen card.'))]);
  out.push(['summary', simpleSub('Summary', 8, `<div class="kpis">${[['Rooms', '152'], ['Beds', '474'], ['Void beds', '12'], ['Free beds', '62']].map(([l, n]) => `<div class="kpi"><div class="l">${l}</div><div class="n">${n}</div></div>`).join('')}</div><div class="card"><div class="ttl">By property</div>${SITES.slice(0, 4).map((s, i) => `<div style="margin:9px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${s}</span><span>${90 - i * 6}%</span></div><div class="bar"><i style="width:${90 - i * 6}%;background:${T.teal}"></i></div></div>`).join('')}</div>`, spec('Daily Register — Summary', 'Room and bed summary by property.', 'KPI grid and per-property occupancy bars.', ['KPI cards', 'Progress bars'], 'Rooms, beds, void, free, occupancy.', 'Tap a property to filter.', 'Deep link.', 'Site scope.', '—'))]);
  return out;
}

/* ------------------------------------------------------------------- profiles (SU + property) */

function tabStrip(tabs, on) {
  return `<div class="chips" style="margin:0 -16px 12px;padding:0 16px">${tabs.map((t, i) => `<div class="chip ${i === on ? 'on' : ''}">${t}</div>`).join('')}</div>`;
}
function suProfile(tabIdx) {
  const tabs = SUBSCREENS.suUsers;
  const name = tabs[tabIdx];
  let content;
  if (tabIdx === 0) content = U.group('Summary', [U.row({ label: 'Port reference', value: 'PR-48213' }), U.row({ label: 'Date of birth', value: '14 Mar 1991' }), U.row({ label: 'Nationality', value: 'Eritrean' }), U.row({ label: 'Status', badgeEl: badge('Placed', 'green') })]) + U.group('Flags', [U.row({ label: 'Vulnerable', toggle: true, icon: 'ShieldHeart', tone: 'orange' }), U.row({ label: 'PEEP in place', toggle: true, icon: 'Wheelchair', tone: 'orange' }), U.row({ label: 'GP registered', toggle: true, icon: 'Stethoscope', tone: 'blue' })]);
  else if (tabIdx === 2) content = U.group('Current placement', [U.row({ label: 'Property', value: 'Riverside Court' }), U.row({ label: 'Room', value: '214 · interconnects 215' }), U.row({ label: 'Since', value: '02 Oct 2026' })]) + U.button('Move accommodation', 'sec', 'ArrowsExchange');
  else if (tabIdx === 3) content = `<div class="card"><div style="display:flex;gap:10px;align-items:center"><div class="avatar">KO</div><div style="flex:1"><div class="ttl">Kofi Okafor</div><div class="s2">Child · age 9</div></div>${badge('Active', 'green')}</div></div>` + U.button('Add household member', 'sec', 'UserPlus');
  else content = U.group(name, [U.row({ label: 'Recent entry', value: '08 Nov 2026' }), U.row({ label: 'Recorded by', value: 'Morgan Blake' }), U.row({ label: 'Open full list', chevron: true, icon: 'List' })]);
  const body = `<div class="card" style="display:flex;gap:12px;align-items:center"><div class="avatar" style="width:54px;height:54px">AO</div><div style="flex:1"><div class="ttl" style="font-size:18px">Amara Okafor</div><div class="s2">Room 214 · Riverside Court</div></div>${badge('Placed', 'green')}</div>${tabStrip(tabs, tabIdx)}${content}`;
  return { html: U.phone({ nav: U.navInline({ title: 'Service User', back: 'Residents', trailing: ['Dots'] }), body }), spec: spec(`Service User profile — ${name}`, `${name} section of the service user profile.`, 'Inline nav, identity card, horizontally scrolling tab strip (17 sections on web; Education only for under-18s), section content.', ['Identity card', 'Scrollable tab strip', 'Inset sections', 'Action buttons'], `Section "${name}" of the service user master record.`, 'Edit, move accommodation, add household member, open linked records.', 'Tab strip switches sections; counts shown on tabs.', 'Page "suUsers": approvals for archive/restore need a manager; site scope applies.', 'Long-press a tab to reorder favourites.') };
}
function propProfile(tabIdx) {
  const tabs = SUBSCREENS.propertyManagement;
  const name = tabs[tabIdx];
  let content;
  if (tabIdx === 0) content = `<div class="kpis">${[['Rooms', '64'], ['Beds', '128'], ['Occupied', '112'], ['Occupancy', '87%']].map(([l, n]) => `<div class="kpi"><div class="l">${l}</div><div class="n">${n}</div></div>`).join('')}</div>` + U.group('Contacts', [U.row({ label: 'Lead officer', value: 'Jordan Ellis' }), U.row({ label: 'Phone', value: '07700 900123', chevron: true })]);
  else if (tabIdx === 2) content = ['214', '215', '216'].map((r, i) => `<div class="card"><div class="row1"><div class="ttl">Room ${r}</div>${badge(i === 2 ? 'Void' : 'Occupied', i === 2 ? 'red' : 'green')}</div><div class="s2">Double · 2 beds ${i < 2 ? '· interconnecting' : ''}</div></div>`).join('');
  else if (tabIdx === 4) content = ['Gas safety', 'Fire alarm test', 'EICR'].map((c, i) => `<div class="card"><div class="row1"><div class="ttl">${c}</div>${badge(i === 0 ? '6 days' : 'Valid', i === 0 ? 'orange' : 'green')}</div></div>`).join('');
  else content = U.group(name, [U.row({ label: 'Item', value: 'Sample entry' }), U.row({ label: 'Updated', value: '08 Nov 2026' }), U.row({ label: 'Add', icon: 'Plus', chevron: true })]);
  const body = `<div class="card"><div class="ttl" style="font-size:18px">Riverside Court</div><div class="s2">Northvale · PID RC-014 · ${badge('Active', 'green')}</div></div>${tabStrip(tabs, tabIdx)}${content}`;
  return { html: U.phone({ nav: U.navInline({ title: 'Property', back: 'Properties', trailing: ['Dots'] }), body }), spec: spec(`Property profile — ${name}`, `${name} section of a property.`, 'Identity card, scrollable tab strip (9 sections), section content.', ['Identity card', 'Tab strip', 'Room cards', 'Compliance cards'], `Section "${name}".`, 'Edit property, add room/asset/document, open compliance certificate.', 'Tabs switch sections.', 'Page "propertyManagement" (no role gate; site scope applies).', 'Rooms tab: interconnecting rooms show a link badge.') };
}

/* ------------------------------------------------------------------- lifecycle (users, properties) */

function lifecycle(which, seg, withSheet) {
  const isUser = which === 'users';
  const names = isUser ? [['Morgan Blake', 'Area Manager', 'Riverside Court'], ['Casey Rowan', 'Staff', 'Elm Park Lodge'], ['Alex Hartley', 'Staff', 'Willow House']] : [['Riverside Court', 'Northvale', 'RC-014'], ['Harbour View Hotel', 'Eastmere', 'HV-008'], ['Elm Park Lodge', 'Westbrook', 'EP-021']];
  const label = isUser ? 'user' : 'property';
  const cards = names.map(([a, b, c]) => `<div class="card"><div class="row1"><div style="display:flex;gap:10px;align-items:center"><div class="avatar">${U.initials(a)}</div><div><div class="ttl">${a}</div><div class="s2">${b} · ${c}</div></div></div>${badge(seg === 0 ? 'Active' : seg === 1 ? 'Archived' : 'Deleted', seg === 0 ? 'green' : 'gray')}</div>${seg > 0 ? `<div class="meta"><span>${ic('Calendar', 14, T.label3)}${seg === 1 ? 'Archived' : 'Deleted'} 04 Nov 2026</span><span>${ic('User', 14, T.label3)}Jordan Ellis</span></div><div class="s2" style="margin-top:6px">Reason: ${seg === 1 ? 'Left the organisation' : 'Entered in error'}</div>` : ''}${seg > 0 ? `<div style="margin-top:10px">${U.button('Restore (Super Admin)', 'sec sm', 'ArchiveOff')}</div>` : ''}</div>`).join('');
  const sheetInner = `<div style="text-align:center;margin-bottom:12px"><div style="font-weight:600">Archive ${names[0][0]}?</div><div class="s2" style="margin:6px 8px">${isUser ? 'They will be removed from the active list and can no longer sign in.' : 'The property will be removed from active lists and new entries.'} It is kept in Archived with its data and history. Only a Super Admin can restore it.</div></div>${U.group(null, [U.row({ label: 'Reason', placeholder: 'Optional' })])}${U.button('Continue', '')}<div style="height:8px"></div>${U.button('Cancel', 'line')}`;
  const sheetInner2 = `<div style="text-align:center;margin-bottom:12px">${ic('AlertTriangle', 34, T.red)}<div style="font-weight:600;margin-top:6px">Step 2 of 2 — confirm</div><div class="s2" style="margin:6px 8px">You are about to archive ${label} <b>${names[0][0]}</b>.</div></div>${U.button('Archive', 'red')}<div style="height:8px"></div>${U.button('Back', 'line')}`;
  const body = `${U.segmented(['Active', 'Archived', 'Deleted'], seg)}${U.searchBar(`Search ${label}s`)}${cards}`;
  const html = U.phone({ nav: U.navLarge({ title: isUser ? 'Staff & Users' : 'Properties', subtitle: 'Records are never permanently deleted', actions: [{ icon: 'Plus', solid: true }] }), body, tabbar: G.TABBAR(4), overlay: withSheet === 1 ? U.sheet('Archive', sheetInner) : withSheet === 2 ? U.sheet('Confirm', sheetInner2) : '' });
  return { html, spec: spec(`${isUser ? 'Users' : 'Properties'} — ${withSheet ? 'Archive confirmation ' + withSheet : ['Active', 'Archived', 'Deleted'][seg] + ' records'}`, `Manage ${label}s with archive and recoverable delete (migration 028 rules).`, 'Segmented Active / Archived / Deleted; cards; archive confirmation is two separate sheets.', ['Segmented control', 'Cards', 'Two-step confirmation sheets', 'Restore button'], isUser ? 'Name, role, assigned sites, status, last active; archived/deleted show who, when and why.' : 'Property, city, PID, capacity, lead contact, status; archived/deleted show who, when and why.', 'Add, edit, archive (two-step), delete (recoverable), restore (Super Admin only).', 'Row → detail. Archive → sheet 1 → sheet 2.', `Super Admin and Admin as before; General/Area Manager and Staff act only on their own sites${isUser ? ' and on lower roles' : ''}; only a Super Admin restores.`, 'Swipe a row for Archive / Delete; destructive actions are red and always confirmed.') };
}

/* ------------------------------------------------------------------- kind variants of the list */

function kindList(audit, id) {
  const cfg = PAGES[id], a = G.auditOf(audit, id), fields = G.fieldsOf(audit, id);
  const r = i => G.record(audit, id, i);
  const t = G.find(fields, cfg.title);
  const nav = U.navLarge({ title: G.shortTitle(a.title), subtitle: 'All permitted sites', actions: [{ icon: 'Filter' }, ...(cfg.add ? [{ icon: 'Plus', solid: true }] : [])] });
  const seg = cfg.tabs ? U.segmented(cfg.tabs.slice(0, 4), 0) : '';
  let body, desc;
  if (cfg.kind === 'progress') {
    body = `${seg}${U.searchBar('Search booklets')}` + [0, 1, 2, 3].map(i => { const pct = [86, 42, 18, 64][i]; return `<div class="card"><div class="row1"><div><div class="ttl">${r(i)[t.label]}</div><div class="s2">${r(i)['Language'] || 'Arabic'} · ${r(i)['Hotel / Site'] || SITES[i]}</div></div>${badge(pct < 25 ? 'Low' : 'In stock', pct < 25 ? 'orange' : 'green')}</div><div style="margin-top:10px"><div class="bar"><i style="width:${pct}%;background:${pct < 25 ? T.orange : T.teal}"></i></div><div class="s2" style="margin-top:4px">${Math.round(pct * 0.6)} collected of ${60} target</div></div></div>`; }).join('');
    desc = 'Stock cards with a collected/target progress bar.';
  } else if (cfg.kind === 'expiry') {
    body = `${seg}${U.searchBar('Search certificates')}${U.chips(['All', 'Expiring soon', 'Expired', 'Valid'], 0)}` + [[6, 'orange'], [-3, 'red'], [48, 'green'], [112, 'green']].map(([d, tone], i) => `<div class="card"><div class="row1"><div><div class="ttl">${['Gas safety', 'Fire alarm test', 'EICR', 'Legionella'][i]}</div><div class="s2">${SITES[i]} · SafeServe Maintenance</div></div>${badge(d < 0 ? `Expired ${-d}d ago` : `${d} days left`, tone)}</div></div>`).join('');
    desc = 'Certificate cards sorted by soonest expiry with a countdown badge.';
  } else if (cfg.kind === 'contacts') {
    body = `${seg}${U.searchBar('Search agencies')}` + [0, 1, 2].map(i => `<div class="card"><div style="display:flex;gap:11px;align-items:center"><div class="avatar">${U.initials(r(i)[t.label])}</div><div style="flex:1"><div class="ttl">${r(i)[t.label]}</div><div class="s2">${['Legal advice', 'Mental health', 'Food bank'][i]} · Northvale</div></div></div><div style="display:flex;gap:8px;margin-top:11px">${grow(U.button('Call', 'sec sm', 'Phone'))}${grow(U.button('Email', 'sec sm', 'Mail'))}${grow(U.button('Map', 'sec sm', 'MapPin'))}</div></div>`).join('');
    desc = 'Directory cards with one-tap call, email and map.';
  } else if (cfg.kind === 'files') {
    body = `${U.searchBar('Search documents')}${U.chips(['All', 'Certificates', 'Proof', 'Reports'], 0)}` + U.group(null, [['Gas safety certificate.pdf', 'PDF · 412 KB · 08 Nov', 'FileTypePdf', 'red'], ['Room 214 heating photo.jpg', 'Image · 2.1 MB · 07 Nov', 'Photo', 'blue'], ['Fire risk assessment.docx', 'Word · 96 KB · 02 Nov', 'FileTypeDoc', 'blue'], ['Resident ID proof.pdf', 'PDF · Confidential · 28 Oct', 'Lock', 'orange']].map(([n, s, i, tone]) => `<div class="li ic"><span class="ibox" style="background:${T[tone]}">${ic(i, 17, '#fff')}</span><div class="k"><div style="font-size:15px">${n}</div><div style="font-size:12px;color:${T.label3}">${s}</div></div><span class="chev">${ic('ChevronRight', 18, '#C7C7CC')}</span></div>`));
    desc = 'File rows with type icons, size, date and confidentiality.';
  } else if (cfg.kind === 'approvals') {
    body = `${U.chips(['Awaiting me (3)', 'Approved', 'Rejected'], 0)}` + [0, 1, 2].map(i => `<div class="card"><div class="row1"><div><div class="ttl">${VENDORS[i]}</div><div class="s2">Invoice INV-${3320 + i} · due ${12 + i} Nov</div></div><div style="font-size:19px;font-weight:700">£${[1240, 860, 2720][i].toLocaleString('en-GB')}</div></div><div style="display:flex;gap:8px;margin-top:11px">${grow(U.button('Reject', 'red sm', 'X'))}${grow(U.button('Approve', 'sm', 'Check'), 2)}</div></div>`).join('');
    desc = 'Approval queue with Approve / Reject on the card (and swipe actions).';
  } else if (cfg.kind === 'rollcall') {
    body = `${U.segmented(cfg.tabs, 0)}${U.searchBar('Search name, room')}${U.banner('Roll for 9 Nov · 3 not yet marked', 'blue', 'ClipboardCheck')}` + U.group(null, [0, 1, 2, 3, 4].map(i => `<div class="li"><div class="k"><div style="font-size:15px;font-weight:600">${['Amara Okafor', 'Daniel Kovac', 'Leila Haddad', 'Tomas Eriksen', 'Priya Nair'][i]}</div><div style="font-size:12px;color:${T.label3}">Room ${[214, 118, 305, 221, 130][i]}</div></div><div style="display:flex;gap:5px">${['P', 'A', 'L'].map((c, k) => `<span style="width:30px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:${(i === 1 && k === 1) ? T.red : (i !== 1 && k === 0 && i < 3) ? T.green : '#EFEFF4'};color:${((i === 1 && k === 1) || (i !== 1 && k === 0 && i < 3)) ? '#fff' : T.label2}">${c}</span>`).join('')}</div></div>`)) + U.button('Mark all present', 'sec');
    desc = 'Tap-to-mark roll rows (Present / Absent / Late) with a bulk action.';
  } else {
    return null;
  }
  return { html: U.phone({ nav, body, tabbar: G.TABBAR(G.tabFor(a.category)) }), spec: { ...G.listScreen(audit, id).spec, layout: desc + ' ' + G.listScreen(audit, id).spec.layout } };
}
const VENDORS = require('./data.cjs').SITES.length ? ['Greenfield Supplies Ltd', 'Brightway Linen Co', 'Northern Catering Group'] : [];

function checklistForm(audit, id) {
  const room = id === 'roomChecks';
  const cfg = PAGES[id], a = G.auditOf(audit, id);
  const groups = room ? [['Safety', ['Smoke detector working', 'Fire door closes', 'Window restrictors fitted', 'Electrical sockets safe']], ['Condition', ['Walls and ceiling', 'Flooring', 'Bed and mattress', 'Heating works']], ['Hygiene', ['Bathroom clean', 'No pests', 'Bins emptied']]] : [['Communal areas', ['Swept and mopped', 'Windows wiped', 'Furniture dusted', 'Mirrors cleaned']], ['Facilities', ['Staff toilets disinfected', 'Fridges cleaned (Thu/Sun)', 'Lifts / stairs (Sat/Sun)', 'Offices (Sun)']]];
  const rows = ls => ls.map((t, i) => room ? `<div class="li"><span class="k" style="font-size:15px">${t}</span><div style="display:flex;gap:5px">${['Pass', 'Fail'].map((c, k) => `<span style="padding:5px 11px;border-radius:14px;font-size:12.5px;font-weight:600;background:${k === 0 && i !== 2 ? T.green : k === 1 && i === 2 ? T.red : '#EFEFF4'};color:${(k === 0 && i !== 2) || (k === 1 && i === 2) ? '#fff' : T.label2}">${c}</span>`).join('')}</div></div>` : U.row({ label: t, toggle: i !== 3 })).join('');
  const body = `${room ? U.group(null, [U.row({ label: 'Room', value: '214' }), U.row({ label: 'Inspection date', value: '09 Nov 2026' }), U.row({ label: 'Inspecting officer', value: 'Jordan Ellis' })]) : U.group(null, [U.row({ label: 'Property', value: 'Riverside Court' }), U.row({ label: 'Date', value: '09 Nov 2026' })])}
  ${groups.map(([h, ls]) => `<div class="ghead">${h}</div><div class="group">${rows(ls)}</div>`).join('')}${room ? U.banner('Auto grade: <b>Needs action</b> — 1 failed item', 'orange', 'AlertTriangle') : ''}${U.group('Evidence', [U.row({ label: 'Add photo', icon: 'Camera', chevron: true })])}`;
  return { html: U.phone({ nav: U.navInline({ title: cfg.add || 'New log', leading: 'Cancel', trailingText: 'Save' }), body }), spec: spec(`${a.title} — Checklist form`, room ? '30-point room condition and safety inspection with automatic grading.' : 'Daily housekeeping checklist with inspector sign-off.', 'Header details, grouped checklist rows, auto grade banner, photo evidence.', room ? ['Pass/Fail segmented pills', 'Auto-grade banner', 'Camera row'] : ['Toggle rows', 'Sign-off row'], room ? 'Room, officer, 30 items grouped by area, final comments.' : 'Date, property, task toggles, inspected by.', 'Mark items, add photo to a failed item, save, sign off.', 'Modal from list; Save returns to the list.', 'Create/edit on this page.', 'Failed items require a note and photo; swipe through groups.') };
}

module.exports = {
  splash, signIn, resetPassword, sessionLock, accessDenied, maintenancePage, blocked, offline, states,
  home, hub, more, search, notifications, profile, appSettings,
  registerHub, guestFilterSheet, guestStats, roomList, connectSheet, allocation, registerSubs,
  suProfile, propProfile, lifecycle, kindList, checklistForm, spec, flex, grow, tabStrip,
};
