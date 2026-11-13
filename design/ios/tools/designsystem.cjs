/** Renders the design-system boards and writes tokens.json. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');
const U = require('./lib/ui.cjs');
const { PAGES } = require('./lib/pages.cjs');
const { T, ic, badge } = U;

const OUT = path.resolve(__dirname, '..');
const TMP = path.join(os.tmpdir(), 'sdtracker-ios-ds');
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(path.join(OUT, 'design-system'), { recursive: true });

const tokens = {
  note: 'Design tokens for the SDTracker iOS app. Colours are semantic; map them to Asset Catalog colour sets with light and dark values.',
  colour: {
    brand: { tint: T.tint, tintSoft: T.tintSoft, teal: T.teal, note: 'Matches the web app teal (#0D9488 accent, #0F766E on light surfaces for contrast).' },
    background: { grouped: T.bg, card: T.card, separator: T.sep },
    text: { primary: T.label, secondary: T.label2, tertiary: T.label3, onTint: '#FFFFFF' },
    status: { success: T.green, warning: T.orange, danger: T.red, info: T.blue, special: T.purple, neutral: T.gray },
    statusSoft: Object.fromEntries(Object.entries(U.TONES).map(([k, [bg, fg]]) => [k, { background: bg, foreground: fg }])),
  },
  typography: {
    note: 'San Francisco via Dynamic Type text styles. Sizes are the default (Large) content size.',
    largeTitle: { size: 34, weight: 'bold' }, title: { size: 28, weight: 'bold' }, headline: { size: 17, weight: 'semibold' },
    body: { size: 17, weight: 'regular' }, cardTitle: { size: 16, weight: 'semibold' }, callout: { size: 15, weight: 'regular' },
    subheadline: { size: 13, weight: 'regular' }, caption: { size: 12, weight: 'regular' }, badge: { size: 12, weight: 'semibold' },
  },
  spacing: { unit: 4, scale: [4, 8, 12, 16, 20, 24, 32], screenMargin: 16, cardPadding: 14, sectionGap: 18, rowMinHeight: 44 },
  radius: { card: 14, group: 12, button: 14, field: 11, chip: 17, badge: 11, sheet: 22 },
  elevation: { card: '0 1px 2px rgba(0,0,0,.04)', sheet: '0 -4px 30px rgba(0,0,0,.2)' },
  sizes: { tabBar: 49, navBarInline: 44, navBarLarge: 96, touchTarget: 44, iconInRow: 17, iconTab: 25 },
  motion: { push: '0.35s iOS default', sheet: 'spring', reduceMotion: 'respect Reduce Motion' },
};
fs.writeFileSync(path.join(OUT, 'data/tokens.json'), JSON.stringify(tokens, null, 2));

const wrap = (title, inner, w = 1500) => `<!doctype html><html><head><meta charset="utf-8"><style>${U.css}
body{background:#fff;padding:30px 36px;width:${w}px}h1{font-size:28px;color:${T.tint};margin-bottom:4px}p.d{color:#555;margin-bottom:20px;font-size:14px}
h2{font-size:17px;margin:22px 0 10px;color:#222}.row{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
.sw{width:150px}.sw i{display:block;height:64px;border-radius:12px;border:1px solid #0001}.sw b{display:block;font-size:13px;margin-top:6px}.sw span{font-size:12px;color:#666}
.demo{width:360px;background:${T.bg};padding:16px;border-radius:18px}.cap{font-size:12px;color:#666;margin:4px 0 10px}
</style></head><body><h1>${title}</h1><p class="d">SDTracker iOS design system · fictional sample content</p>${inner}</body></html>`;

const sw = (n, hex, use) => `<div class="sw"><i style="background:${hex}"></i><b>${n}</b><span>${hex} · ${use}</span></div>`;

const boards = {
  '01-colour-and-type': wrap('Colour and typography', `
  <h2>Brand and surfaces</h2><div class="row">${sw('Tint', T.tint, 'buttons, links, selected')}${sw('Tint soft', T.tintSoft, 'tiles, chips')}${sw('Teal', T.teal, 'charts, accents')}${sw('Grouped background', T.bg, 'screen')}${sw('Card', '#FFFFFF', 'cards, groups')}${sw('Separator', T.sep, 'hairlines')}</div>
  <h2>Text</h2><div class="row">${sw('Label', T.label, 'primary')}${sw('Secondary', T.label2, 'supporting')}${sw('Tertiary', T.label3, 'hints, captions')}</div>
  <h2>Status (always paired with text, never colour alone)</h2><div class="row">${sw('Success', T.green, 'completed, approved')}${sw('Warning', T.orange, 'pending, due soon')}${sw('Danger', T.red, 'urgent, expired')}${sw('Info', T.blue, 'in progress')}${sw('Special', T.purple, 'approvals, roles')}${sw('Neutral', T.gray, 'archived')}</div>
  <h2>Typography (San Francisco, Dynamic Type)</h2>
  <div style="line-height:1.5"><div style="font-size:34px;font-weight:700">Large title 34 bold</div><div style="font-size:28px;font-weight:700">Title 28 bold</div><div style="font-size:17px;font-weight:600">Headline 17 semibold</div><div style="font-size:17px">Body 17 regular</div><div style="font-size:16px;font-weight:600">Card title 16 semibold</div><div style="font-size:15px">Callout 15 regular</div><div style="font-size:13px;color:${T.label2}">Subheadline 13 regular</div><div style="font-size:12px;color:${T.label3}">Caption 12 regular</div></div>
  <h2>Spacing and shape</h2><div class="row"><div class="cap">4pt grid · screen margin 16 · card padding 14 · section gap 18 · row min height 44 · radii: card 14, group 12, button 14, field 11, chip 17, sheet 22</div></div>`),

  '02-components': wrap('Components', `
  <div class="row">
   <div class="demo"><div class="cap">Buttons</div>${U.button('Primary action', '')}<div style="height:8px"></div>${U.button('Secondary', 'sec')}<div style="height:8px"></div>${U.button('Destructive', 'red')}<div style="height:8px"></div><div style="display:flex;gap:8px">${U.button('Small', 'sec sm').replace('class="btn', 'style="flex:1" class="btn')}${U.button('Outline', 'line sm').replace('class="btn', 'style="flex:1" class="btn')}</div>
    <div class="cap" style="margin-top:14px">Search, chips, segmented</div>${U.searchBar('Search')}${U.chips(['All', 'Open', 'Done'], 0)}${U.segmented(['Roll', 'Records', 'Follow-ups'], 1)}</div>
   <div class="demo"><div class="cap">Inputs (inset form rows)</div>${U.group(null, [U.row({ label: 'Name', value: 'Amara Okafor', required: true }), U.row({ label: 'Date of birth', placeholder: 'Choose date', chevron: true }), U.row({ label: 'Port reference', value: 'PR-1', required: true, error: 'Enter a valid reference' }), U.row({ label: 'Vulnerable', toggle: true })])}
    <div class="cap">Status badges</div><div style="display:flex;gap:6px;flex-wrap:wrap">${badge('Open', 'orange')}${badge('In progress', 'blue')}${badge('Completed', 'green')}${badge('Urgent', 'red')}${badge('Archived', 'gray')}${badge('Approval', 'purple')}</div>
    <div class="cap" style="margin-top:14px">Banners</div>${U.banner('Information banner', 'blue')}${U.banner('Warning banner', 'orange', 'AlertTriangle')}${U.banner('Error banner', 'red', 'AlertCircle')}</div>
   <div class="demo"><div class="cap">Record card</div><div class="card"><div class="row1"><div><div class="ttl">Amara Okafor</div><div class="s2">Safeguarding Adult</div></div>${badge('Open', 'orange')}</div><div class="meta"><span>${ic('Calendar', 14, T.label3)}04 Nov 2026</span><span>${ic('Building', 14, T.label3)}Riverside Court</span></div></div>
    <div class="cap">KPI cards</div><div class="kpis"><div class="kpi"><div class="l">Open</div><div class="n">14</div><div class="d" style="color:${T.red}">3 today</div></div><div class="kpi"><div class="l">Occupancy</div><div class="n">87%</div><div class="d" style="color:${T.green}">+2%</div></div></div>
    <div class="cap">Progress</div><div class="bar"><i style="width:64%;background:${T.teal}"></i></div></div>
  </div>
  <h2>Navigation</h2><div class="row"><div style="width:393px;background:#fff;border-radius:14px;overflow:hidden">${U.tabBar([{ icon: 'Home', label: 'Home' }, { icon: 'ShieldHeart', label: 'Safeguarding', badge: 3 }, { icon: 'Building', label: 'Operations' }, { icon: 'Search', label: 'Search' }, { icon: 'Dots', label: 'More' }], 1)}</div>
   <div style="width:393px;background:${T.bg};border-radius:14px;overflow:hidden">${U.navInline({ title: 'Detail', back: 'Referrals', trailing: ['Dots'] })}</div></div>
  <h2>Bottom sheet and modal form bar</h2><div class="row"><div style="width:393px;height:260px;position:relative;background:#555;border-radius:14px;overflow:hidden">${U.sheet('Filter', U.group(null, [U.row({ label: 'Site', value: 'All', chevron: true })]))}</div><div style="width:393px;background:${T.bg};border-radius:14px;overflow:hidden">${U.navInline({ title: 'New referral', leading: 'Cancel', trailingText: 'Save' })}</div></div>`),

  '03-states-and-feedback': wrap('States and feedback', `
  <div class="row"><div class="demo"><div class="cap">Loading (skeleton)</div><div class="card"><div class="skel" style="height:16px;width:60%"></div><div class="skel" style="height:12px;width:40%;margin-top:8px"></div></div><div class="cap">Empty</div><div class="card" style="text-align:center;padding:20px">${ic('FileSearch', 34, T.label3, 1.4)}<div class="ttl" style="margin-top:8px">No records found</div><div class="s2">Try a different filter.</div></div></div>
  <div class="demo"><div class="cap">Error with retry</div>${U.banner('Could not load from the live database. <b>Retry</b>', 'red', 'AlertCircle')}<div class="cap">Offline</div>${U.banner('You are offline. Changes will sync later.', 'orange', 'WifiOff')}<div class="cap">Success toast</div>${U.banner('Referral saved and synced.', 'green', 'CircleCheck')}</div>
  <div class="demo"><div class="cap">Validation</div>${U.group(null, [U.row({ label: 'Email', value: 'not-an-email', required: true, error: 'Enter an email address like name@example.org' })])}<div class="cap">Destructive confirmation</div><div style="background:#fff;border-radius:14px;padding:16px;text-align:center"><b>Archive Riverside Court?</b><div class="s2" style="margin:6px 0 12px">Only a Super Admin can restore it.</div>${U.button('Archive', 'red')}<div style="height:8px"></div>${U.button('Cancel', 'line')}</div></div></div>
  <h2>Rules</h2><div style="font-size:14px;line-height:1.7;max-width:1000px">Skeletons for first load, spinners only for actions. Errors say what happened and what to do, with Retry. Destructive actions use a red button inside a confirmation sheet; archive uses two separate confirmations. Success is a toast that fades; it never blocks. Every status uses text plus colour. Minimum touch target 44×44pt.</div>`),

  '04-icons-and-symbols': (() => {
    const items = Object.entries(PAGES).map(([id, c]) => `<div style="width:170px;display:flex;gap:9px;align-items:center;margin:8px 0"><span class="ibox" style="background:${T.tint};width:34px;height:34px">${ic(c.icon, 19, '#fff', 2)}</span><div style="font-size:12px;line-height:1.3"><b>${id}</b><br><span style="color:#666">${c.sf}</span></div></div>`).join('');
    return wrap('Icons and SF Symbols', `<p class="d">The mock-ups draw outline stand-in icons. The app should use the SF Symbol named under each module (rendered at regular weight, hierarchical colour). Apple's SF Symbols app is the source; nothing here embeds Apple assets.</p><div class="row">${items}</div>`);
  })(),
};

(async () => {
  const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
  const pg = await ctx.newPage();
  for (const [name, html] of Object.entries(boards)) {
    const f = path.join(TMP, name + '.html');
    fs.writeFileSync(f, html);
    await pg.goto('file:///' + f.split(path.sep).join('/'), { waitUntil: 'load' });
    await pg.screenshot({ path: path.join(OUT, 'design-system', name + '.png'), fullPage: true });
  }
  await browser.close();
  console.log('design-system boards:', Object.keys(boards).length);
})();
