/**
 * App-wide table behaviour, applied to every <table> without touching each page:
 *  1. The Actions column (last column, headed "Action(s)", or icon-only buttons) sticks to the right edge,
 *     so it stays visible while the table scrolls sideways.
 *  2. Every icon-only button / link in a table gets a hover tooltip (its aria-label) so the icon is explained.
 * Tables that already stick their Actions column (position: sticky) are left as they are.
 */
const ACTION_HEAD = /^(actions?|action buttons)$/i;
const MARK = 'data-sticky-actions';

const solidBackground = (el: Element | null): string => {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(bg)) {
      const m = bg.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/);
      return m && Number(m[4]) < 1 ? `rgb(${m[1]}, ${m[2]}, ${m[3]})` : bg;
    }
  }
  return '#ffffff';
};

const isIconOnly = (el: Element) => !(el.textContent || '').trim();

const addTooltips = (table: HTMLTableElement) => {
  table.querySelectorAll<HTMLElement>('button, a[role="button"], a[href]').forEach(el => {
    if (el.getAttribute('title') || !isIconOnly(el)) return;
    const label = el.getAttribute('aria-label') || el.getAttribute('data-tooltip');
    if (label) el.setAttribute('title', label);
  });
};

const stickActions = (table: HTMLTableElement) => {
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headRow || headRow.cells.length < 2) return;
  const lastIdx = headRow.cells.length - 1;
  const th = headRow.cells[lastIdx];
  if (th.hasAttribute(MARK)) return;
  const thText = (th.textContent || '').trim();
  const bodyRows = Array.from(table.tBodies).flatMap(b => Array.from(b.rows)).filter(r => r.cells.length === headRow.cells.length);
  const sampleCell = bodyRows[0]?.cells[lastIdx];
  const looksLikeActions = ACTION_HEAD.test(thText)
    || (!thText && !!sampleCell && isIconOnly(sampleCell) && !!sampleCell.querySelector('button, a'));
  if (!looksLikeActions) return;
  if (getComputedStyle(th).position === 'sticky') return; // already handled by the page
  const apply = (cell: HTMLTableCellElement) => {
    cell.setAttribute(MARK, '');
    cell.style.position = 'sticky';
    cell.style.right = '0';
    cell.style.zIndex = cell.tagName === 'TH' ? '3' : '2';
    cell.style.backgroundColor = solidBackground(cell);
    cell.style.boxShadow = '-2px 0 4px rgba(0,0,0,0.05)';
    cell.style.whiteSpace = 'nowrap';
  };
  apply(th);
  for (const r of bodyRows) apply(r.cells[lastIdx]);
};

let scheduled = false;
const run = () => {
  scheduled = false;
  document.querySelectorAll<HTMLTableElement>('table').forEach(t => {
    if (t.closest('[data-no-sticky-actions]')) return;
    addTooltips(t);
    // Rows are re-rendered often: stick any row cell that is not yet marked
    const headRow = t.tHead?.rows[t.tHead.rows.length - 1];
    const th = headRow?.cells[headRow.cells.length - 1];
    if (th?.hasAttribute(MARK)) {
      const idx = headRow!.cells.length - 1;
      Array.from(t.tBodies).flatMap(b => Array.from(b.rows)).forEach(r => {
        const c = r.cells[idx];
        if (c && r.cells.length === headRow!.cells.length && !c.hasAttribute(MARK)) {
          c.setAttribute(MARK, ''); c.style.position = 'sticky'; c.style.right = '0'; c.style.zIndex = '2';
          c.style.backgroundColor = solidBackground(c); c.style.boxShadow = '-2px 0 4px rgba(0,0,0,0.05)'; c.style.whiteSpace = 'nowrap';
        }
      });
    } else stickActions(t);
  });
};

export function installTableActionsEnhancer() {
  if (typeof document === 'undefined') return;
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(run); } };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}
