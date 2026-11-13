/**
 * Builds overview boards (contact sheets) and the workflow strips from the rendered screens.
 *   node design/ios/tools/overview.cjs   (run after build.cjs)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { screens } = require('./build.cjs');
const U = require('./lib/ui.cjs');

const OUT = path.resolve(__dirname, '..');
const os = require('os');
const TMP = path.join(os.tmpdir(), 'sdtracker-ios-overview');
fs.mkdirSync(TMP, { recursive: true });
async function show(pg, html) { const f = path.join(TMP, 'page.html'); fs.writeFileSync(f, html); await pg.goto('file:///' + f.split(path.sep).join('/'), { waitUntil: 'load' }); }
const rel = p => 'file:///' + p.replace(/\\/g, '/');

function board(title, items, cols = 6, thumb = 230) {
  const h = Math.round(thumb * (872 / 413));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#EEF0F3;font-family:"Segoe UI",Arial,sans-serif;padding:28px}
  h1{font-size:26px;margin:0 0 4px;color:#0F766E}p{margin:0 0 20px;color:#555;font-size:14px}
  .g{display:grid;grid-template-columns:repeat(${cols},${thumb}px);gap:22px 18px}
  .i img{width:${thumb}px;height:${h}px;display:block;filter:drop-shadow(0 4px 10px rgba(0,0,0,.18))}
  .i div{font-size:12px;color:#222;margin-top:6px;line-height:1.3;width:${thumb}px}
  </style></head><body><h1>${title}</h1><p>SDTracker iOS design reference · fictional sample data · ${items.length} screens</p>
  <div class="g">${items.map(s => `<div class="i"><img src="${rel(path.join(OUT, 'mockups', s.folder, s.file + '.png'))}"><div>${s.title}</div></div>`).join('')}</div></body></html>`;
}

const WORKFLOWS = [
  { id: 'referral-intake', title: 'Safeguarding referral: log, track, notify', steps: [['03-safeguarding', 'referrals-01-list', '1. Open referrals'], ['03-safeguarding', 'referrals-03-form', '2. Log a new referral'], ['03-safeguarding', 'referrals-02-detail', '3. Review the record'], ['01-navigation', '03-notifications', '4. Manager is notified']] },
  { id: 'arrival-room-allocation', title: 'New arrival: check in and allocate across interconnecting rooms', steps: [['04-operations', 'dailyRegisters-07-new-arrivals', '1. Arrival waiting for a room'], ['04-operations', 'dailyRegisters-05-allocation', '2. Pick rooms (family of 4)'], ['04-operations', 'dailyRegisters-03-room-list', '3. Room List reflects it'], ['04-operations', 'dailyRegisters-02-guest-filters', '4. Filter the register']] },
  { id: 'finance-approval', title: 'Vendor invoice: capture, review, approve', steps: [['05-finance', 'finance-03-form', '1. Upload invoice'], ['05-finance', 'finance-02-detail', '2. Review details'], ['05-finance', 'financeApprovals-01-list', '3. Approver queue'], ['01-navigation', '03-notifications', '4. Submitter is notified']] },
  { id: 'change-request', title: 'Locked record: request a change and sign it off', steps: [['06-compliance', 'requests-03-form', '1. Raise request'], ['06-compliance', 'requests-01-list', '2. Appears in queue'], ['06-compliance', 'requests-05-decision', '3. Manager decides'], ['01-navigation', '03-notifications', '4. Result notification']] },
  { id: 'archive-restore', title: 'Archive a user: two-step confirmation and Super Admin restore', steps: [['07-admin', 'users-01-active', '1. Active users'], ['07-admin', 'users-04-archive-step-1', '2. Archive: step 1'], ['07-admin', 'users-05-archive-step-2', '3. Archive: step 2'], ['07-admin', 'users-02-archived', '4. Restore (Super Admin)']] },
  { id: 'room-check', title: 'Room check: inspect, grade, escalate', steps: [['04-operations', 'roomChecks-01-list', '1. Room checks'], ['04-operations', 'roomChecks-02-checklist', '2. 30-point checklist'], ['04-operations', 'escalations-03-form', '3. Escalate a failure'], ['04-operations', 'escalations-01-list', '4. Track the escalation']] },
];

(async () => {
  const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  fs.mkdirSync(path.join(OUT, 'overview'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'workflows'), { recursive: true });

  // one board per folder (role folders are merged into one "roles" board)
  const groups = {};
  for (const s of screens) {
    const key = s.folder.startsWith('08-roles') ? '08-roles' : s.folder;
    (groups[key] ||= []).push(s);
  }
  const written = [];
  for (const [key, items] of Object.entries(groups)) {
    const chunks = [];
    for (let i = 0; i < items.length; i += 18) chunks.push(items.slice(i, i + 18));
    let part = 0;
    for (const c of chunks) {
      part++;
      const name = `${key}${chunks.length > 1 ? `-part${part}` : ''}.png`;
      await show(pg, board(`${key}${chunks.length > 1 ? ` (part ${part} of ${chunks.length})` : ''}`, c));
      await pg.screenshot({ path: path.join(OUT, 'overview', name), fullPage: true });
      written.push(name);
    }
  }

  // workflow strips
  for (const w of WORKFLOWS) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#fff;font-family:"Segoe UI",Arial,sans-serif;padding:30px 36px}
    h1{font-size:26px;color:#0F766E;margin:0 0 4px}p{margin:0 0 22px;color:#555}
    .r{display:flex;align-items:flex-start;gap:8px}.s{width:300px;text-align:center}.s img{width:300px;display:block;filter:drop-shadow(0 6px 14px rgba(0,0,0,.2))}
    .s b{display:block;margin-top:10px;font-size:15px;color:#222}.a{margin-top:300px;font-size:30px;color:#0F766E;width:34px;text-align:center}
    </style></head><body><h1>${w.title}</h1><p>Fictional data. Every step is a screen in the mock-up set.</p>
    <div class="r">${w.steps.map(([f, n, c], i) => `${i ? '<div class="a">›</div>' : ''}<div class="s"><img src="${rel(path.join(OUT, 'mockups', f, n + '.png'))}"><b>${c}</b></div>`).join('')}</div></body></html>`;
    await show(pg, html);
    await pg.screenshot({ path: path.join(OUT, 'workflows', `${w.id}.png`), fullPage: true });
  }
  fs.writeFileSync(path.join(OUT, 'data/workflows.json'), JSON.stringify(WORKFLOWS, null, 2));
  await browser.close();
  console.log('boards:', written.length, 'workflows:', WORKFLOWS.length);
})();
