/**
 * Phase 1 audit: reads the SDTracker web source (read-only) and writes design/ios/data/audit.json.
 * Nothing in src/, server/ or db/ is modified.
 *   node design/ios/tools/audit.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const exists = p => fs.existsSync(path.join(ROOT, p));

// ---- pages from the registry
const registry = read('src/config/pageRegistry.ts');
const pages = [];
const pageRe = /id: '(\w+)',\s*title: '([^']+)',\s*category: '([^']+)',\s*description: '([^']+)'/g;
let m;
while ((m = pageRe.exec(registry))) pages.push({ id: m[1], title: m[2], category: m[3], description: m[4], registered: true });

// ---- routes from App.tsx
const app = read('src/App.tsx');
const imports = {};
for (const im of app.matchAll(/import \{([^}]+)\} from '(\.\/components\/[^']+)'/g)) {
  for (const n of im[1].split(',').map(s => s.trim()).filter(Boolean)) imports[n] = im[2];
}
const routeBody = app.slice(app.indexOf('switch (activePage)'));
const routes = {};
for (const r of routeBody.matchAll(/case '(\w+)':([\s\S]*?)(?=\n\s*case '|\n\s*default:)/g)) {
  const comp = (r[2].match(/<([A-Z]\w+)/) || [])[1];
  const gate = (r[2].match(/return\s+([\s\S]*?)\?/) || [])[1];
  const denied = (r[2].match(/requiredRole="([^"]+)"/) || [])[1];
  routes[r[1]] = { comp, gate: gate ? gate.replace(/\s+/g, ' ').trim() : null, denied: denied || null, props: (r[2].match(/<\w+([^>]*)\/?>/) || [])[1]?.trim() || '' };
}
for (const id of Object.keys(routes)) if (!pages.find(p => p.id === id)) {
  const titles = { pageAccess: 'Page Access Management', pageMaintenance: 'Page Maintenance Mode', settings: 'System Settings & Preferences' };
  pages.push({ id, title: titles[id] || id, category: 'Admin & Governance', description: '', registered: false });
}

// ---- table column labels by constant
const schemas = read('src/data/defaultTableSchemas.ts');
const columnSets = {};
for (const b of schemas.matchAll(/export const (\w+_COLUMNS)[^=]*=\s*\[([\s\S]*?)\n\];/g)) {
  columnSets[b[1]] = [...b[2].matchAll(/key: '(\w+)', label: '([^']+)'(?:, type: '(\w+)')?(?:, options: \[([^\]]*)\])?/g)]
    .map(c => ({ key: c[1], label: c[2], type: c[3] || 'text', options: c[4] ? c[4].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : undefined }));
}
const COLUMN_SET_FOR_PAGE = {
  escalations: ['ESCALATIONS_TABLE_COLUMNS'], gpAppointments: ['GP_APPOINTMENTS_TABLE_COLUMNS'], rfaWelfare: ['RFA_WELFARE_TABLE_COLUMNS'],
  publicTransport: ['PUBLIC_TRANSPORT_TABLE_COLUMNS'], dispersal: ['DISPERSAL_TABLE_COLUMNS', 'EVICTION_TABLE_COLUMNS'], compliance: ['SD_COMPLIANCE_TABLE_COLUMNS'],
  booklets: ['BOOKLETS_TABLE_COLUMNS'], vcsDirectory: ['VCS_AGENCIES_TABLE_COLUMNS'], documents: ['DOCUMENTS_TABLE_COLUMNS'],
  laundry: ['PROPERTY_LAUNDRY_TABLE_COLUMNS', 'DAILY_LAUNDRY_TABLE_COLUMNS'], food: ['FOOD_VENDOR_BUFFET_TABLE_COLUMNS'],
  finance: ['FINANCE_INVOICES_TABLE_COLUMNS'], financeCreditCards: ['FINANCE_CREDIT_CARD_TABLE_COLUMNS'],
  financeDeliveryNotes: ['FINANCE_DELIVERY_NOTES_TABLE_COLUMNS'], financeApprovals: ['FINANCE_APPROVALS_TABLE_COLUMNS'],
  irTracker: ['IR_TRACKER_TABLE_COLUMNS'], foodWastage: ['FOOD_WASTAGE_TABLE_COLUMNS'],
  dailyRegisters: ['DAILY_REGISTER_TABLE_COLUMNS', 'ROOM_LIST_TABLE_COLUMNS', 'NEW_ARRIVALS_TABLE_COLUMNS'],
  welfareChecks: ['WELFARE_CHECKS_TABLE_COLUMNS'], foodSurveys: ['FOOD_SURVEYS_TABLE_COLUMNS'], roomChecks: ['ROOM_CHECKS_TABLE_COLUMNS'],
  mhComplaintWelfare: ['MH_COMPLAINT_WELFARE_TABLE_COLUMNS'], housekeeping: ['HOUSEKEEPING_TABLE_COLUMNS'],
  foodConsumption: ['FOOD_CONSUMPTION_TABLE_COLUMNS', 'FOOD_BOX_REQUEST_TABLE_COLUMNS'],
};

// ---- per-page facts
const permCfg = read('src/config/pagePermissionsConfig.ts');
const tableMap = {};
for (const t of permCfg.matchAll(/^\s{2}(\w+): '(\w+)',/gm)) (tableMap[t[2]] ||= []).push(t[1]);
const noCreate = new Set((permCfg.match(/NO_CREATE_PAGES = new Set\(\[([^\]]*)\]/)?.[1] || '').match(/\w+/g) || []);
const readOnly = new Set(['dashboard']);
const approvalPages = new Set((permCfg.match(/APPROVAL_PAGES = new Set\(\[([^\]]*)\]/)?.[1] || '').match(/\w+/g) || []);
const exportExcluded = new Set((permCfg.match(/EXPORT_PAGES_EXCLUDED = new Set\(\[([^\]]*)\]/)?.[1] || '').match(/\w+/g) || []);
const actionsFor = id => {
  if (readOnly.has(id)) return ['view'];
  if (id === 'reports' || id === 'audit') return ['view', 'export'];
  const a = ['view'];
  if (!noCreate.has(id)) a.push('create');
  a.push('edit', 'delete');
  if (!exportExcluded.has(id)) a.push('export');
  if (approvalPages.has(id)) a.push('approve');
  return a;
};

const list = d => (exists(d) ? fs.readdirSync(path.join(ROOT, d)).filter(f => /\.tsx?$/.test(f)) : []);
const result = [];
for (const p of pages) {
  const route = routes[p.id] || {};
  const rel = route.comp && imports[route.comp] ? `src/${imports[route.comp].replace('./', '')}` : null;
  const file = rel && (exists(rel + '.tsx') ? rel + '.tsx' : exists(rel + '.ts') ? rel + '.ts' : null);
  const dir = file ? path.dirname(file) : null;
  const src = file ? read(file) : '';
  const siblings = dir ? list(dir).map(f => `${dir}/${f}`) : [];
  const tabs = new Set();
  const modals = new Set();
  const filters = new Set();
  for (const f of [file, ...siblings].filter(Boolean)) {
    const s = read(f);
    for (const b of s.matchAll(/(?:TABS?|tabs|Tabs)\b[^=\n]*=\s*(?:\[|useMemo)[\s\S]{0,1800}?\n\s*\];?/g)) {
      for (const t of b[0].matchAll(/id: '(\w+)',\s*label: '([^']+)'/g)) tabs.add(t[2]);
    }
    for (const t of s.matchAll(/\[\s*'(?:[a-z]+)'\s*,\s*'([A-Z][^']+)'\s*\]/g)) void t;
    if (/Modal|Drawer/.test(path.basename(f)) && f !== file) modals.add(path.basename(f).replace(/\.tsx?$/, ''));
    for (const fl of s.matchAll(/<option value="[^"]*">([^<{]{2,30})<\/option>/g)) filters.add(fl[1].trim());
  }
  const pairLabels = [...new Set([...src.matchAll(/\{\s*id:\s*'(\w+)',\s*label:\s*'([^']+)'/g)].map(x => x[2]).filter(l => l.length <= 40))];
  const cols = (COLUMN_SET_FOR_PAGE[p.id] || []).flatMap(n => (columnSets[n] || []).map(c => ({ ...c, set: n })));
  result.push({
    id: p.id, title: p.title, category: p.category, description: p.description, registered: p.registered,
    component: route.comp || null, file, loc: src ? src.split('\n').length : 0,
    siblingFiles: siblings.length, gate: route.gate, deniedFor: route.denied, props: route.props,
    tables: tableMap[p.id] || [], pageActions: actionsFor(p.id),
    tabs: [...tabs], viewFieldLabels: pairLabels.slice(0, 40), modals: [...modals].slice(0, 12), filterOptions: [...filters].slice(0, 14), columns: cols,
  });
}

// ---- roles and defaults
const initial = read('src/data/initialData.ts');
const roleBlock = initial.slice(initial.indexOf('INITIAL_ROLE_PERMISSIONS'), initial.indexOf('// 1. Initial Public Transport'));
const roles = {};
for (const r of roleBlock.matchAll(/'([A-Za-z ]+)': \{([\s\S]*?)\n  \}/g)) {
  roles[r[1]] = Object.fromEntries([...r[2].matchAll(/(\w+): (true|false)/g)].map(x => [x[1], x[2] === 'true']));
}

fs.mkdirSync(path.join(ROOT, 'design/ios/data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'design/ios/data/audit.json'), JSON.stringify({ generatedFrom: 'src/config/pageRegistry.ts + src/App.tsx + src/data/*', roles, pages: result }, null, 2));
console.log('pages', result.length, 'with component', result.filter(p => p.component).length, 'roles', Object.keys(roles).join(', '));
console.log('no component:', result.filter(p => !p.component).map(p => p.id).join(', '));
