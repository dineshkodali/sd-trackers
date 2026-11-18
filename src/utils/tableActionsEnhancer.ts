/**
 * App-wide table behaviour, applied to every <table> without touching each page:
 *  1. The Actions column (last column, headed "Action(s)", or icon-only buttons) sticks to the right edge,
 *     so it stays visible while the table scrolls sideways.
 *  2. Every icon-only button / link anywhere gets an instant hover/focus tooltip (its title or aria-label).
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
  installTooltips();
}

/* ----------------------------------------------------------------------------------------------- Tooltips */
let tip: HTMLDivElement | null = null;
let tipTarget: HTMLElement | null = null;

const tipText = (el: HTMLElement): string => {
  const own = el.getAttribute('data-tip') || el.getAttribute('title') || el.getAttribute('aria-label') || '';
  return own.trim();
};

const findTarget = (n: EventTarget | null): HTMLElement | null => {
  const el = n instanceof Element ? n.closest<HTMLElement>('button, a, [role="button"], [data-tip], [title]') : null;
  if (!el || el.hasAttribute('disabled') && !tipText(el)) return null;
  if (el.hasAttribute('data-tip') || el.hasAttribute('title')) return el;
  // aria-label only: show it for icon-only controls (text buttons already say what they do)
  return !(el.textContent || '').trim() && el.getAttribute('aria-label') ? el : null;
};

const hideTip = () => { if (tip) tip.style.display = 'none'; tipTarget = null; };

const showTip = (el: HTMLElement) => {
  const text = tipText(el);
  if (!text) return;
  // Move the native title aside so the browser does not show a second, delayed tooltip
  if (el.hasAttribute('title')) { el.setAttribute('data-tip', el.getAttribute('title') || ''); el.removeAttribute('title'); }
  if (!tip) {
    tip = document.createElement('div');
    tip.setAttribute('role', 'tooltip');
    tip.style.cssText = 'position:fixed;z-index:2147483000;pointer-events:none;max-width:260px;padding:4px 8px;border-radius:4px;background:#1f2937;color:#fff;font-size:11px;line-height:1.35;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,.25);display:none;white-space:normal;';
    document.body.appendChild(tip);
  }
  tip.textContent = text;
  tip.style.display = 'block';
  tipTarget = el;
  const r = el.getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let top = r.top - th - 6;
  if (top < 4) top = r.bottom + 6;
  const left = Math.max(4, Math.min(window.innerWidth - tw - 4, r.left + r.width / 2 - tw / 2));
  tip.style.top = top + 'px';
  tip.style.left = left + 'px';
};

export function installTooltips() {
  if (typeof document === 'undefined') return;
  document.addEventListener('mouseover', e => { const el = findTarget(e.target); if (el && el !== tipTarget) showTip(el); else if (!el) hideTip(); }, true);
  document.addEventListener('focusin', e => { const el = findTarget(e.target); if (el) showTip(el); }, true);
  for (const ev of ['mouseout', 'focusout', 'mousedown', 'scroll', 'keydown'] as const) document.addEventListener(ev, e => { if (ev === 'mouseout' && (e as MouseEvent).relatedTarget && tipTarget?.contains((e as MouseEvent).relatedTarget as Node)) return; hideTip(); }, true);
}
