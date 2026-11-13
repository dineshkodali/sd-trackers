/**
 * Visual building blocks for the iPhone mock-ups. Everything returns HTML strings.
 * Icons are drawn with Tabler (MIT) as stand-ins; the spec documents the SF Symbol to use in the app.
 */
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const tabler = require('@tabler/icons-react');

const T = {
  bg: '#F2F2F7', card: '#FFFFFF', label: '#1C1C1E', label2: '#636366', label3: '#8E8E93', sep: '#E5E5EA',
  tint: '#0F766E', tintSoft: '#E6F4F2', teal: '#0D9488',
  green: '#34C759', orange: '#FF9500', red: '#FF3B30', blue: '#007AFF', purple: '#AF52DE', gray: '#8E8E93', yellow: '#FFCC00',
};
const TONES = {
  green: ['#E8F8EC', '#1E7A38'], orange: ['#FFF3E0', '#B25E00'], red: ['#FFEAE8', '#C6281C'], blue: ['#E5F1FF', '#0B63CE'],
  purple: ['#F3E8FB', '#8231B0'], gray: ['#EFEFF4', '#575759'], teal: ['#E6F4F2', '#0F766E'], yellow: ['#FFF8D6', '#8A6D00'],
};

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const missing = new Set();
function ic(name, size = 20, color = 'currentColor', stroke = 1.75) {
  if (!tabler['Icon' + name]) missing.add(name);
  const comp = tabler['Icon' + name] || tabler.IconCircle;
  return renderToStaticMarkup(React.createElement(comp, { size, stroke, color }));
}

const css = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:transparent;font-family:-apple-system,"SF Pro Text","SF Pro Display","Segoe UI",system-ui,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:${T.label}}
.phone{width:413px;height:872px;background:#0b0b0d;border-radius:62px;padding:10px;position:relative;box-shadow:0 0 0 2px #2a2a2e inset,0 20px 50px rgba(0,0,0,.25)}
.screen{width:393px;height:852px;background:${T.bg};border-radius:52px;position:relative;overflow:hidden;display:flex;flex-direction:column}
.island{position:absolute;top:11px;left:50%;transform:translateX(-50%);width:120px;height:35px;background:#000;border-radius:20px;z-index:30}
.status{height:54px;flex:none;display:flex;align-items:flex-end;justify-content:space-between;padding:0 32px 8px 38px;font-size:16px;font-weight:600;z-index:20;position:relative}
.status .r{display:flex;gap:6px;align-items:center}
.home{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:140px;height:5px;border-radius:3px;background:#111;z-index:40}
.dark .home{background:#fff}
.body{flex:1;overflow:hidden;position:relative}
.scroll{padding:0 16px 24px}
.navbar{padding:2px 16px 6px;flex:none}
.navrow{display:flex;align-items:center;justify-content:space-between;height:36px}
.navlink{color:${T.tint};font-size:17px;display:flex;align-items:center;gap:2px}
.navtitle{font-size:17px;font-weight:600;text-align:center;flex:1}
.large{font-size:34px;font-weight:700;letter-spacing:.2px;padding:6px 0 4px}
.sub{font-size:13px;color:${T.label3};margin-top:-2px;padding-bottom:6px}
.circle{width:32px;height:32px;border-radius:16px;background:${T.tintSoft};color:${T.tint};display:flex;align-items:center;justify-content:center}
.circle.solid{background:${T.tint};color:#fff}
.search{background:#E3E3E8;border-radius:11px;height:36px;display:flex;align-items:center;gap:6px;padding:0 10px;color:${T.label3};font-size:17px;margin:6px 0 10px}
.chips{display:flex;gap:8px;overflow:hidden;margin:2px 0 12px}
.chip{flex:none;padding:6px 13px;border-radius:17px;background:#fff;font-size:14px;font-weight:500;color:${T.label};border:1px solid ${T.sep};display:flex;gap:5px;align-items:center}
.chip.on{background:${T.tint};color:#fff;border-color:${T.tint}}
.seg{display:flex;background:#E3E3E8;border-radius:9px;padding:2px;margin:4px 0 12px}
.seg div{flex:1;text-align:center;font-size:13px;font-weight:500;padding:6px 2px;border-radius:7px;color:${T.label}}
.seg div.on{background:#fff;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.14)}
.card{background:${T.card};border-radius:14px;padding:13px 14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.row1{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.ttl{font-size:16px;font-weight:600;line-height:1.25}
.s2{font-size:13px;color:${T.label2};margin-top:2px}
.meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:9px;font-size:12.5px;color:${T.label2}}
.meta span{display:flex;align-items:center;gap:4px}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:11px;font-size:12px;font-weight:600;white-space:nowrap}
.dot{width:7px;height:7px;border-radius:4px;display:inline-block}
.group{background:#fff;border-radius:12px;overflow:hidden;margin-bottom:18px}
.ghead{font-size:13px;color:${T.label3};text-transform:uppercase;letter-spacing:.3px;padding:0 16px 6px;margin-top:4px}
.gfoot{font-size:12.5px;color:${T.label3};padding:-10px 16px 0;margin:-12px 16px 16px}
.li{display:flex;align-items:center;gap:12px;padding:11px 14px;min-height:44px;position:relative;font-size:16px}
.li+.li:before{content:"";position:absolute;top:0;left:14px;right:0;height:.5px;background:${T.sep}}
.li.ic:before{left:54px}
.li .k{color:${T.label};flex:1}
.li .v{color:${T.label2};text-align:right;max-width:58%;font-size:15px}
.li .ph{color:#C7C7CC;font-size:15px}
.li .chev{color:#C7C7CC}
.req{color:${T.red};margin-left:2px}
.err{color:${T.red};font-size:12.5px;padding:0 14px 8px;margin-top:-4px;background:#fff}
.ibox{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;flex:none}
.tabbar{flex:none;height:84px;background:rgba(249,249,249,.94);border-top:.5px solid #C6C6C8;display:flex;padding:7px 4px 0;backdrop-filter:blur(20px)}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10.5px;color:${T.label3};position:relative}
.tab.on{color:${T.tint}}
.tab .n{position:absolute;top:-3px;left:calc(50% + 6px);background:${T.red};color:#fff;font-size:10px;font-weight:700;min-width:17px;height:17px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px}
.btn{display:flex;align-items:center;justify-content:center;gap:7px;height:50px;border-radius:14px;font-size:17px;font-weight:600;background:${T.tint};color:#fff}
.btn.sec{background:${T.tintSoft};color:${T.tint}}
.btn.red{background:#FFEAE8;color:${T.red}}
.btn.line{background:#fff;color:${T.tint};border:1px solid ${T.sep}}
.btn.sm{height:38px;font-size:15px;border-radius:11px}
.kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.kpi{background:#fff;border-radius:14px;padding:12px 13px}
.kpi .n{font-size:26px;font-weight:700;letter-spacing:.2px}
.kpi .l{font-size:12.5px;color:${T.label2}}
.kpi .d{font-size:12px;margin-top:3px}
.dim{position:absolute;inset:0;background:rgba(0,0,0,.35);z-index:25}
.sheet{position:absolute;left:0;right:0;bottom:0;background:#F2F2F7;border-radius:22px 22px 0 0;z-index:26;padding:8px 16px 34px;box-shadow:0 -4px 30px rgba(0,0,0,.2)}
.grab{width:38px;height:5px;border-radius:3px;background:#C7C7CC;margin:0 auto 10px}
.shtitle{font-size:17px;font-weight:600;text-align:center;margin-bottom:12px}
.fab{position:absolute;right:18px;bottom:98px;width:56px;height:56px;border-radius:28px;background:${T.tint};color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(15,118,110,.4);z-index:15}
.banner{display:flex;gap:9px;align-items:flex-start;border-radius:12px;padding:10px 12px;font-size:13px;margin-bottom:12px}
.avatar{width:44px;height:44px;border-radius:22px;background:${T.tintSoft};color:${T.tint};font-weight:700;display:flex;align-items:center;justify-content:center;font-size:16px;flex:none}
.toggle{width:51px;height:31px;border-radius:16px;background:#E5E5EA;position:relative;flex:none}
.toggle.on{background:${T.green}}
.toggle:after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:14px;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.25)}
.toggle.on:after{left:22px}
.bar{height:8px;border-radius:4px;background:#E5E5EA;overflow:hidden}
.bar i{display:block;height:100%;border-radius:4px}
.skel{background:linear-gradient(90deg,#ececf0,#f6f6f9,#ececf0);border-radius:8px}
.hscroll{display:flex;gap:10px;overflow:hidden;margin-bottom:12px}
.mini{flex:none;width:150px}
`;

/* ------------------------------------------------------------------ primitives */

const badge = (text, tone = 'gray', dot = true) => {
  const [bg, fg] = TONES[tone] || TONES.gray;
  return `<span class="badge" style="background:${bg};color:${fg}">${dot ? `<i class="dot" style="background:${fg}"></i>` : ''}${esc(text)}</span>`;
};

const statusBar = (dark = false) => `<div class="status" style="color:${dark ? '#fff' : '#000'}"><span>9:41</span><span class="r">${ic('Antenna', 17, 'currentColor', 2)}${ic('Wifi', 17, 'currentColor', 2)}${ic('BatteryFilled', 22, 'currentColor', 1.6)}</span></div>`;

const circleBtn = (icon, solid = false) => `<span class="circle ${solid ? 'solid' : ''}">${ic(icon, 18)}</span>`;

/** Large-title navigation bar (top level of a tab). */
const navLarge = ({ title, subtitle, actions = [] }) => `
<div class="navbar">
  <div class="navrow" style="justify-content:flex-end;gap:10px">${actions.map(a => circleBtn(a.icon, a.solid)).join('')}</div>
  <div class="large">${esc(title)}</div>${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}
</div>`;

/** Inline navigation bar (pushed screens). */
const navInline = ({ title, back = 'Back', leading, trailing = [], trailingText }) => `
<div class="navbar" style="border-bottom:.5px solid ${T.sep};background:rgba(249,249,249,.94)">
  <div class="navrow">
    <div class="navlink" style="min-width:80px">${leading ? esc(leading) : `${ic('ChevronLeft', 22, T.tint, 2.2)}<span>${esc(back)}</span>`}</div>
    <div class="navtitle">${esc(title)}</div>
    <div class="navlink" style="min-width:80px;justify-content:flex-end;gap:12px">${trailingText ? `<b style="font-weight:600">${esc(trailingText)}</b>` : trailing.map(t => ic(t, 22, T.tint)).join('')}</div>
  </div>
</div>`;

const searchBar = (ph = 'Search') => `<div class="search">${ic('Search', 17)}<span>${esc(ph)}</span></div>`;
const chips = (items, active = 0) => `<div class="chips">${items.map((c, i) => `<div class="chip ${i === active ? 'on' : ''}">${esc(c)}</div>`).join('')}</div>`;
const segmented = (items, active = 0) => `<div class="seg">${items.map((c, i) => `<div class="${i === active ? 'on' : ''}">${esc(c)}</div>`).join('')}</div>`;

const tabBar = (items, active) => `<div class="tabbar">${items.map((t, i) => `
  <div class="tab ${i === active ? 'on' : ''}">${t.badge ? `<span class="n">${t.badge}</span>` : ''}${ic(t.icon, 25, 'currentColor', i === active ? 2.1 : 1.7)}<span>${esc(t.label)}</span></div>`).join('')}</div>`;

const group = (header, rows, footer) => `${header ? `<div class="ghead">${esc(header)}</div>` : ''}<div class="group">${rows.join('')}</div>${footer ? `<div class="gfoot">${esc(footer)}</div>` : ''}`;

/** A settings-style row. kind: value | placeholder | toggle | nav | text */
function row({ label, value, placeholder, icon, tone = 'teal', toggle, chevron = false, required = false, error, badgeEl }) {
  const colors = { teal: T.tint, blue: T.blue, green: T.green, orange: T.orange, red: T.red, purple: T.purple, gray: T.gray };
  const left = icon ? `<span class="ibox" style="background:${colors[tone] || T.tint}">${ic(icon, 17, '#fff', 2)}</span>` : '';
  const right = toggle !== undefined ? `<span class="toggle ${toggle ? 'on' : ''}"></span>`
    : badgeEl ? badgeEl
    : value !== undefined && value !== '' ? `<span class="v">${esc(value)}</span>`
    : placeholder ? `<span class="ph">${esc(placeholder)}</span>` : '';
  return `<div class="li ${icon ? 'ic' : ''}">${left}<span class="k">${esc(label)}${required ? '<span class="req">*</span>' : ''}</span>${right}${chevron ? `<span class="chev">${ic('ChevronRight', 18, '#C7C7CC', 2.2)}</span>` : ''}</div>${error ? `<div class="err">${esc(error)}</div>` : ''}`;
}

const button = (text, kind = '', icon) => `<div class="btn ${kind}">${icon ? ic(icon, 20, 'currentColor', 2) : ''}${esc(text)}</div>`;
const banner = (text, tone = 'blue', icon = 'InfoCircle') => {
  const [bg, fg] = TONES[tone];
  return `<div class="banner" style="background:${bg};color:${fg}">${ic(icon, 18, fg, 2)}<div>${text}</div></div>`;
};
const initials = n => String(n).split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const sheet = (title, inner) => `<div class="dim"></div><div class="sheet"><div class="grab"></div><div class="shtitle">${esc(title)}</div>${inner}</div>`;

/**
 * Wraps content into a complete iPhone frame.
 * opts: { nav, tabbar, fab, overlay, dark }
 */
function phone({ nav = '', body = '', tabbar = '', fab = '', overlay = '' }) {
  return `<div class="phone"><div class="screen"><div class="island"></div>${statusBar()}${nav}<div class="body"><div class="scroll">${body}</div></div>${tabbar}${fab}${overlay}<div class="home"></div></div></div>`;
}

const page = inner => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${inner}</body></html>`;

module.exports = { missing, T, TONES, css, esc, ic, badge, statusBar, navLarge, navInline, searchBar, chips, segmented, tabBar, group, row, button, banner, initials, sheet, phone, page, circleBtn };
