/** Generic list / detail / form / filter screens, driven by the audit + pages.cjs. */
const U = require('./ui.cjs');
const { rng, valueFor, pick, STAFF, SITES } = require('./data.cjs');
const { PAGES } = require('./pages.cjs');
const { T, ic, esc, badge } = U;

const NOISE = /^(all |customize|export|print|yes$|no$|table$|matrix$|\+|reset|refresh|save|cancel)/i;

function auditOf(audit, id) { return audit.pages.find(p => p.id === id); }

/** Field list for a page: its real columns when the web app defines them, otherwise the labels its view uses. */
function fieldsOf(audit, id) {
  const cfg = PAGES[id] || {};
  if (cfg.fields) return cfg.fields.map(label => ({ label, type: guessType(label) }));
  const a = auditOf(audit, cfg.same || id);
  if (!a) return [];
  const seen = new Set();
  const out = [];
  const add = (label, type, options) => { const k = label.toLowerCase(); if (!label || NOISE.test(label) || seen.has(k)) return; seen.add(k); out.push({ label, type: type || guessType(label), options }); };
  if (a.columns.length) {
    // Page with several tables (e.g. Daily Registers): use the first table only for the generic cards.
    const firstSet = a.columns[0].set;
    a.columns.filter(c => c.set === firstSet).forEach(c => add(c.label, mapType(c.type), c.options));
  } else a.viewFieldLabels.forEach(l => add(l));
  return out.slice(0, 26);
}
const mapType = t => ({ select: 'select', date: 'date', number: 'number', textarea: 'text-long', checkbox: 'toggle' }[t] || null);
function guessType(label) {
  const l = label.toLowerCase();
  if (/date|expiry|due|until|since/.test(l) && !/update/.test(l)) return 'date';
  if (/time\b/.test(l)) return 'time';
  if (/description|summary|notes|comments|details|remarks|update|justification|action|remedies|advice/.test(l)) return 'text-long';
  if (/status|type|category|level|priority|urgency|risk|group|gender|method|mode|hotel|site|property|council|language|nationality|stage/.test(l)) return 'select';
  if (/number of|quantity|count|capacity|bags|batches|weight|miles|amount|total|£|subtotal/.test(l)) return 'number';
  if (/^(is |has |wants|family|individual|gp registered|vulnerable|void|follow-up required|acknowledg|reported)|\?$/.test(l)) return 'toggle';
  return 'text';
}

function find(fields, rx) { return rx ? fields.find(f => rx.test(f.label)) : null; }

function toneOf(v) {
  const s = String(v).toLowerCase();
  if (/expired|reject|fail|dna|declin|suspend|critical|escalated|^high|overdue|urgent/.test(s)) return 'red';
  if (/open|pending|await|expiring|query|follow|needs|medium|low stock|^low$/.test(s) && !/^low$/.test(s)) return 'orange';
  if (/complet|approv|paid|valid|active|attended|pass|verif|resolved|closed|in stock|^low$|invoiced|placed/.test(s)) return 'green';
  if (/progress|schedul|invited|moved/.test(s)) return 'blue';
  return 'gray';
}

function record(audit, id, i) {
  const cfg = PAGES[id] || {};
  const fields = fieldsOf(audit, id);
  const r = rng(`${id}:${i}`);
  const rec = {};
  for (const f of fields) {
    const isStatus = cfg.status && cfg.status.test(f.label);
    rec[f.label] = valueFor(f.label, r, { options: f.options, statuses: isStatus ? cfg.statuses : (/status|stage/i.test(f.label) ? cfg.statuses : null) });
  }
  const sf = find(fields, cfg.status);
  if (sf && cfg.statuses) rec[sf.label] = cfg.statuses[i % cfg.statuses.length];
  return rec;
}

const metaIcon = label => {
  const l = label.toLowerCase();
  if (/date|due|expiry|review|time/.test(l)) return 'Calendar';
  if (/officer|worker|by|cardholder|contact|staff|name/.test(l)) return 'User';
  if (/hotel|site|property|location/.test(l)) return 'Building';
  if (/room|flat|unit/.test(l)) return 'DoorEnter';
  if (/amount|total|payable|£|value/.test(l)) return 'CurrencyPound';
  if (/ref|ticket|urn|po\b|id\b/.test(l)) return 'Hash';
  return 'Tag';
};

function cardsFor(audit, id, n = 4) {
  const cfg = PAGES[id];
  const fields = fieldsOf(audit, id);
  const tF = find(fields, cfg.title) || fields[0];
  const sF = find(fields, cfg.sub);
  const stF = find(fields, cfg.status);
  const mF = (cfg.meta || []).map(rx => find(fields, rx)).filter(Boolean).slice(0, 3);
  const out = [];
  for (let i = 0; i < n; i++) {
    const rec = record(audit, id, i);
    const status = stF ? rec[stF.label] : null;
    out.push(`
    <div class="card">
      <div class="row1">
        <div style="min-width:0">
          <div class="ttl">${esc(tF ? rec[tF.label] : cfg.noun)}</div>
          ${sF ? `<div class="s2">${esc(String(rec[sF.label]).slice(0, 64))}</div>` : ''}
        </div>
        ${status ? badge(status, toneOf(status)) : `<span style="color:#C7C7CC">${ic('ChevronRight', 18)}</span>`}
      </div>
      ${mF.length ? `<div class="meta">${mF.map(f => `<span>${ic(metaIcon(f.label), 14, T.label3)}${esc(String(rec[f.label]).slice(0, 26))}</span>`).join('')}</div>` : ''}
    </div>`);
  }
  return out.join('');
}

const TABBAR = (active) => U.tabBar([
  { icon: 'Home', label: 'Home' }, { icon: 'ShieldHeart', label: 'Safeguarding' }, { icon: 'Building', label: 'Operations' },
  { icon: 'Search', label: 'Search' }, { icon: 'Dots', label: 'More' },
], active);

/** Which bottom tab a page lives under. */
function tabFor(category) {
  if (category === 'Safeguarding') return 1;
  if (category === 'Facilities & Welfare' || category === 'Overview') return 2;
  return 4;
}

function listScreen(audit, id) {
  const cfg = PAGES[id];
  const a = auditOf(audit, id);
  const tabs = cfg.tabs;
  const filters = cfg.statuses ? ['All', ...cfg.statuses.slice(0, 4)] : ['All', 'Today', 'This week', 'Mine'];
  const nav = U.navLarge({ title: shortTitle(a.title), subtitle: `${cfg.noun ? cfg.noun + 's' : 'Records'} · All permitted sites`, actions: [{ icon: 'Filter' }, ...(cfg.add && !cfg.readonly ? [{ icon: 'Plus', solid: true }] : [])] });
  const body = `${tabs ? U.segmented(tabs.slice(0, 4), 0) : ''}${U.searchBar(`Search ${shortTitle(a.title).toLowerCase()}`)}${U.chips(filters, 0)}${cardsFor(audit, id, 4)}`;
  const html = U.phone({ nav, body, tabbar: TABBAR(tabFor(a.category)) });
  return { html, spec: specList(audit, id, a, cfg) };
}

const shortTitle = t => t.replace(/^Archived /, 'Archived ').replace(/\(.*\)/, '').trim();

function bucketOf(label) {
  const l = label.toLowerCase();
  if (/name|dob|birth|gender|nationality|language|port|nass|mosaic|^ho |reference|ref\b|id\b|group|family|individual/.test(l)) return 'Resident';
  if (/hotel|site|property|room|flat|unit|wing|house|location|address|floor/.test(l)) return 'Location';
  if (/date|time|due|expiry|review|since/.test(l)) return 'Dates';
  if (/status|stage|priority|risk|urgency|level|rating|grade|type|category|method/.test(l)) return 'Classification';
  if (/amount|total|vat|tax|subtotal|payable|£|cost/.test(l)) return 'Money';
  return 'Case details';
}
const ORDER = ['Resident', 'Location', 'Classification', 'Dates', 'Money', 'Case details'];

function detailScreen(audit, id) {
  const cfg = PAGES[id];
  const a = auditOf(audit, id);
  const fields = fieldsOf(audit, id);
  const rec = record(audit, id, 0);
  const tF = find(fields, cfg.title) || fields[0];
  const stF = find(fields, cfg.status);
  const sF = find(fields, cfg.sub);
  const buckets = {};
  fields.forEach(f => { (buckets[bucketOf(f.label)] ||= []).push(f); });
  const sections = ORDER.filter(k => buckets[k]).map(k => U.group(k, buckets[k].slice(0, 6).map(f =>
    f.type === 'text-long'
      ? `<div class="li" style="display:block"><div style="font-size:13px;color:${T.label3}">${esc(f.label)}</div><div style="font-size:15px;margin-top:3px;line-height:1.35">${esc(rec[f.label])}</div></div>`
      : U.row({ label: f.label, value: rec[f.label] }))));
  const name = tF ? rec[tF.label] : cfg.noun;
  const header = `
  <div class="card" style="padding:16px">
    <div style="display:flex;gap:12px;align-items:center">
      <div class="avatar">${esc(U.initials(name))}</div>
      <div style="min-width:0;flex:1"><div class="ttl" style="font-size:18px">${esc(name)}</div>${sF ? `<div class="s2">${esc(String(rec[sF.label]).slice(0, 60))}</div>` : ''}</div>
      ${stF ? badge(rec[stF.label], toneOf(rec[stF.label])) : ''}
    </div>
    ${cfg.readonly ? '' : `<div style="display:flex;gap:8px;margin-top:14px">${U.button('Edit', 'sec sm', 'Pencil').replace('class="btn', 'style="flex:1" class="btn')}${U.button('Share', 'sec sm', 'Share2').replace('class="btn', 'style="flex:1" class="btn')}${U.button('More', 'sec sm', 'Dots').replace('class="btn', 'style="flex:1" class="btn')}</div>`}
  </div>`;
  const body = `${header}${sections.slice(0, 3).join('')}${U.group('Attachments', [U.row({ label: 'Photos & documents', value: '2', icon: 'Paperclip', chevron: true })])}${U.group('History', [U.row({ label: 'Last updated', value: `${pick(rng(id), STAFF)}` }), U.row({ label: 'Audit trail', icon: 'History', chevron: true, tone: 'gray' })])}`;
  const html = U.phone({ nav: U.navInline({ title: cfg.noun || a.title, back: shortTitle(a.title).slice(0, 14), trailing: ['Dots'] }), body });
  return { html, spec: specDetail(audit, id, a, cfg, fields) };
}

function formScreen(audit, id) {
  const cfg = PAGES[id];
  const a = auditOf(audit, id);
  const fields = fieldsOf(audit, id);
  const shown = fields.slice(0, 11);
  const secs = {};
  shown.forEach(f => { (secs[bucketOf(f.label)] ||= []).push(f); });
  const rows = (list) => list.map((f, idx) => {
    const required = fields.indexOf(f) < 3;
    const err = fields.indexOf(f) === 1 ? 'This field is required' : undefined;
    if (f.type === 'toggle') return U.row({ label: f.label, toggle: idx % 2 === 0 });
    if (f.type === 'text-long') return `<div class="li" style="display:block"><div class="k" style="margin-bottom:6px">${esc(f.label)}</div><div style="min-height:56px;border:1px solid ${T.sep};border-radius:8px;padding:8px;color:#C7C7CC;font-size:15px">Add notes…</div></div>`;
    const value = fields.indexOf(f) === 0 ? valueFor0(f, id) : undefined;
    return U.row({ label: f.label, value, placeholder: f.type === 'select' ? 'Select' : f.type === 'date' ? 'Choose date' : f.type === 'time' ? 'Choose time' : f.type === 'number' ? '0' : 'Enter', chevron: f.type === 'select' || f.type === 'date', required, error: err });
  });
  const body = `${U.banner('Fields marked <b>*</b> are required. Your draft is saved on this device until you submit.', 'blue')}${ORDER.filter(k => secs[k]).map(k => U.group(k, rows(secs[k]))).join('')}${U.group('Evidence', [U.row({ label: 'Take photo', icon: 'Camera', chevron: true }), U.row({ label: 'Scan document', icon: 'Scan', chevron: true, tone: 'blue' }), U.row({ label: 'Choose from Files', icon: 'Folder', chevron: true, tone: 'gray' })])}`;
  const html = U.phone({ nav: U.navInline({ title: cfg.add || `New ${cfg.noun}`, leading: 'Cancel', trailingText: 'Save' }), body });
  return { html, spec: specForm(audit, id, a, cfg, fields) };
}
const valueFor0 = (f, id) => valueFor(f.label, rng(`${id}:form`), { options: f.options });

function filterScreen(audit, id) {
  const cfg = PAGES[id];
  const a = auditOf(audit, id);
  const statuses = cfg.statuses || ['Open', 'In progress', 'Completed'];
  const inner = `
  ${U.group('Status', [`<div class="li" style="flex-wrap:wrap;gap:8px">${statuses.map((s, i) => `<div class="chip ${i < 2 ? 'on' : ''}">${esc(s)}</div>`).join('')}</div>`])}
  ${U.group('Scope', [U.row({ label: 'Site', value: 'All permitted sites', chevron: true, icon: 'Building' }), U.row({ label: 'Date range', value: 'Last 30 days', chevron: true, icon: 'Calendar', tone: 'blue' }), U.row({ label: 'Raised by me', toggle: false, icon: 'User', tone: 'purple' })])}
  <div style="display:flex;gap:10px">${U.button('Reset', 'line').replace('class="btn', 'style="flex:1" class="btn')}${U.button('Show 12 results', '').replace('class="btn', 'style="flex:2" class="btn')}</div>`;
  const nav = U.navLarge({ title: shortTitle(a.title), subtitle: 'All permitted sites', actions: [{ icon: 'Filter' }, { icon: 'Plus', solid: true }] });
  const html = U.phone({ nav, body: `${U.searchBar('Search')}${cardsFor(audit, id, 3)}`, tabbar: TABBAR(tabFor(a.category)), overlay: U.sheet('Filter', inner) });
  return { html, spec: { name: `${a.title} — Filter sheet`, purpose: `Narrow the ${a.title} list without leaving it.`, layout: 'Medium bottom sheet over the list; grabber, grouped controls, Reset and primary apply button.', components: ['Bottom sheet', 'Status chips (multi-select)', 'Inset rows (site, date range)', 'Toggle'], data: 'Status values and site list from the same sources as the web filters; result count is live.', actions: 'Apply, Reset, dismiss by swipe.', nav: 'Sheet; returns to the list.', permissions: 'Site choices are limited to the sites the signed-in role may see.', interactions: 'Haptic on apply; selection count shown on the filter button.' } };
}

/* ------------------------------------------------------------------------------ specs */
const roleNote = (a) => `Visible when the user can view "${a.id}" (role rules plus any per-user Page Access override).${a.deniedFor ? ` Web gate: ${a.deniedFor}.` : ''}`;
const actionsNote = a => `Page actions in the web app: ${a.pageActions.join(', ')}.`;

function specList(audit, id, a, cfg) {
  return {
    name: `${a.title} — List`, purpose: a.description,
    layout: `Large-title navigation bar, optional segmented control${cfg.tabs ? ` (${cfg.tabs.join(' / ')})` : ''}, search field, status chips, then a card per record. Bottom tab bar stays visible.`,
    components: ['Large title bar', 'Search field', 'Filter chips', 'Record cards with status badge', 'Pull-to-refresh', cfg.add && !cfg.readonly ? 'Add button (nav bar)' : 'Read-only (no add)'],
    data: `Each card shows the record title, subtitle and up to three facts. Source fields: ${fieldsOf(audit, id).slice(0, 8).map(f => f.label).join(', ')}…`,
    actions: `${cfg.add && !cfg.readonly ? cfg.add + '. ' : ''}Open record, filter, search, swipe for quick actions (edit / archive where permitted). ${actionsNote(a)}`,
    nav: 'Tap card → Detail. Filter button → filter sheet. Plus → form (modal).',
    permissions: roleNote(a), interactions: `${cfg.pattern} Swipe left for actions; pull down to sync; infinite scroll replaces desktop pagination.`,
  };
}
function specDetail(audit, id, a, cfg, fields) {
  return {
    name: `${a.title} — Detail`, purpose: `Read and act on one ${cfg.noun || 'record'}.`,
    layout: 'Inline navigation bar, summary card (avatar/initials, name, status, quick actions), grouped inset sections, attachments and history.',
    components: ['Summary card', 'Quick action buttons', 'Grouped inset list', 'Attachments row', 'Audit-trail row'],
    data: `All fields of the web record, grouped: ${ORDER.filter(k => fields.some(f => bucketOf(f.label) === k)).join(', ')}.`,
    actions: cfg.readonly ? 'Share; restore (permitted roles).' : 'Edit, share, overflow menu (archive, delete where permitted), open attachments, open audit trail.',
    nav: 'Back to list; Edit → form; Attachments → viewer; Audit trail → timeline.',
    permissions: roleNote(a), interactions: 'Long-press a value to copy; tap phone/email to call/compose; share sheet for export.',
  };
}
function specForm(audit, id, a, cfg, fields) {
  return {
    name: `${a.title} — Form`, purpose: `Create or edit a ${cfg.noun || 'record'}.`,
    layout: `Modal form: Cancel / title / Save, grouped sections (${ORDER.filter(k => fields.some(f => bucketOf(f.label) === k)).join(', ')}), evidence section.`,
    components: ['Inset form rows', 'Pickers (date, time, select)', 'Toggles for Yes/No', 'Multiline notes', 'Camera / Scan / Files rows', 'Inline validation', 'Draft banner'],
    data: `${fields.length} fields from the web form (${fields.filter(f => f.type === 'select').length} pickers, ${fields.filter(f => f.type === 'date').length} dates).`,
    actions: 'Save, Cancel (confirm if edited), attach evidence.',
    nav: 'Presented modally from the list or detail; Save returns to the record.',
    permissions: `Needs create/edit on "${a.id}". ${roleNote(a)}`, interactions: 'Native pickers, keyboard avoidance with Next/Done, inline errors, draft kept on device.',
  };
}

module.exports = { fieldsOf, record, listScreen, detailScreen, formScreen, filterScreen, cardsFor, TABBAR, tabFor, toneOf, auditOf, shortTitle, find, bucketOf };
