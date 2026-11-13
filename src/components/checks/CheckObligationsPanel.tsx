import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useCheckObligations } from '../../hooks/useCheckObligations';
import { londonNow } from '../../utils/operationsRules';
import { monthWindows, type CheckObligation, type CheckType, type ObligationStatus } from '../../utils/checkObligations';

const TONE: Record<ObligationStatus, string> = {
  completed: 'text-green-800 bg-green-50 border-green-200',
  completed_late: 'text-amber-800 bg-amber-50 border-amber-200',
  pending: 'text-[#605e5c] bg-[#f3f2f1] border-[#e1dfdd]',
  overdue: 'text-red-800 bg-red-50 border-red-200',
  exempt: 'text-[#605e5c] bg-[#f3f2f1] border-[#e1dfdd]'
};
const LABEL: Record<ObligationStatus, string> = {
  completed: 'Done', completed_late: 'Done late', pending: 'Due', overdue: 'Overdue', exempt: 'Exempt'
};
const fmt = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

export const monthOptions = (today: string, count = 12): string[] => {
  const out: string[] = [];
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
};
export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));

const Cell: React.FC<{ o: CheckObligation | null }> = ({ o }) => {
  if (!o) return <td className="px-2 py-1 text-[#a19f9d]">–</td>;
  const detail = o.visitDate
    ? `${fmt(o.visitDate)}${o.completedBy ? ` · ${o.completedBy}` : ''}${o.status === 'completed_late' && o.daysLate ? ` · ${o.daysLate} d late` : ''}`
    : o.status === 'overdue' && o.daysLate ? `${o.daysLate} d overdue` : `due ${fmt(o.deadline)}`;
  return (
    <td className="px-2 py-1 align-top">
      <span className={`inline-block px-1.5 border rounded-xs text-[11px] ${TONE[o.status]}`}>{LABEL[o.status]}</span>
      <div className="text-[11px] text-[#605e5c] whitespace-nowrap">{detail}</div>
    </td>
  );
};

interface Props {
  type: CheckType;
  /** Opens the existing create form */
  onStart?: () => void;
  defaultOpen?: boolean;
  /** Fixes the site (the dashboard's own filter); hides the site picker */
  siteName?: string;
  /** Adds an 'Open page' button */
  onOpenPage?: () => void;
}

/** "Due & Missed" - both monthly checks per room / resident, each with its own status, for any month. */
export const CheckObligationsPanel: React.FC<Props> = ({ type, onStart, defaultOpen = false, siteName, onOpenPage }) => {
  const { sites, canAccessAllSites, allowedSites } = useApp();
  const [open, setOpen] = useState(defaultOpen);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const today = londonNow(now).date;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [siteState, setSite] = useState('all');
  const site = siteName && siteName !== 'all' && siteName !== 'All Sites' ? siteName : siteState;
  const [onlyOpen, setOnlyOpen] = useState(true);

  const state = useCheckObligations(type, month, now, open);
  const windows = monthWindows(month, state.result?.settings);

  const allowedNames = useMemo(() => {
    if (canAccessAllSites()) return null;
    return new Set((allowedSites || []).map(s => String(s).toLowerCase()));
  }, [canAccessAllSites, allowedSites]);
  const siteNames = useMemo(() => {
    const names = (sites || []).map(s => s.name).filter(Boolean);
    return allowedNames ? names.filter(n => allowedNames.has(n.toLowerCase())) : names;
  }, [sites, allowedNames]);

  const rows = useMemo(() => state.rows.filter(r =>
    (!allowedNames || allowedNames.has(r.siteName.toLowerCase())) &&
    (site === 'all' || r.siteName === site) &&
    (!onlyOpen || r.overall === 'incomplete')
  ), [state.rows, allowedNames, site, onlyOpen]);

  const scoped = useMemo(() => (state.result?.obligations || []).filter(o =>
    (!allowedNames || allowedNames.has(o.siteName.toLowerCase())) && (site === 'all' || o.siteName === site)), [state.result, allowedNames, site]);
  const count = (s: ObligationStatus) => scoped.filter(o => o.status === s).length;
  const overdue = count('overdue');
  const noun = type === 'room' ? 'Room' : 'Welfare';

  return (
    <section className="bg-white border border-[#e1dfdd] rounded-xs" aria-label={`${noun} checks due and missed`}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="text-sm font-semibold text-[#242424] flex items-center gap-2">
          <span aria-hidden="true">{open ? '▾' : '▸'}</span> Due &amp; Missed {noun.toLowerCase()} checks
          {open && !state.loading && overdue > 0 && <span className="px-1.5 border rounded-xs text-[11px] text-red-800 bg-red-50 border-red-200">{overdue} overdue</span>}
        </button>
        {open && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select aria-label="Month" value={month} onChange={e => setMonth(e.target.value)} className="px-2 py-1 bg-white border border-[#8a8886] rounded-xs">
              {monthOptions(today).map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            {!siteName && siteNames.length > 1 && (
              <select aria-label="Site" value={site} onChange={e => setSite(e.target.value)} className="px-2 py-1 bg-white border border-[#8a8886] rounded-xs">
                <option value="all">All sites</option>
                {siteNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            <label className="flex items-center gap-1"><input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} /> Not complete only</label>
            {onOpenPage && <button type="button" onClick={onOpenPage} className="px-2 py-1 bg-white border border-[#8a8886] rounded-xs">Open {noun} Checks</button>}
            {onStart && <button type="button" onClick={onStart} className="px-2 py-1 bg-[#0f6cbd] text-white rounded-xs">Record a check</button>}
          </div>
        )}
      </header>
      {open && (
        <div className="border-t border-[#e1dfdd]">
          <p className="px-3 py-1.5 text-[11px] text-[#605e5c]">
            Two checks a month: check 1 by {fmt(windows[0].deadline)}, check 2 by {fmt(windows[1].deadline)}. Each is tracked separately.
            {type === 'room' ? ' Rooms owe checks while occupied.' : ' Residents owe checks while placed.'} A visit before a deadline counts toward that period; a later one completes the earliest missed check, marked late.
          </p>
          {state.error && <p role="alert" className="px-3 py-2 text-xs text-red-800">{state.error} The figures below are not available.</p>}
          {state.loading && !state.result && <p className="px-3 py-2 text-xs text-[#605e5c]">Loading…</p>}
          {state.result && (
            <>
              <p className="px-3 pb-1.5 text-xs text-[#242424]">
                Required {scoped.length} · done on time {count('completed')} · done late {count('completed_late')} · pending {count('pending')} · overdue {overdue}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[#605e5c] border-y border-[#e1dfdd] bg-[#faf9f8]">
                      <th className="px-2 py-1 font-semibold">Site</th>
                      <th className="px-2 py-1 font-semibold">Property</th>
                      <th className="px-2 py-1 font-semibold">Room</th>
                      {type === 'welfare' && <th className="px-2 py-1 font-semibold">Service user</th>}
                      <th className="px-2 py-1 font-semibold">Check 1 (by {fmt(windows[0].deadline).slice(0, 5)})</th>
                      <th className="px-2 py-1 font-semibold">Check 2 (by {fmt(windows[1].deadline).slice(0, 5)})</th>
                      <th className="px-2 py-1 font-semibold">Responsible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={type === 'welfare' ? 7 : 6} className="px-3 py-3 text-[#605e5c]">{onlyOpen ? 'Every required check is complete.' : 'No checks were required.'}</td></tr>
                    )}
                    {rows.map(r => (
                      <tr key={r.subjectKey} className="border-b border-[#f3f2f1]">
                        <td className="px-2 py-1 align-top">{r.siteName || '–'}</td>
                        <td className="px-2 py-1 align-top">{r.propertyName || '–'}</td>
                        <td className="px-2 py-1 align-top">{r.roomNumber || '–'}</td>
                        {type === 'welfare' && <td className="px-2 py-1 align-top">{r.suName}{r.suReference ? <span className="text-[#605e5c]"> · {r.suReference}</span> : null}</td>}
                        <Cell o={r.first} />
                        <Cell o={r.second} />
                        <td className="px-2 py-1 align-top">{r.responsible.name || <span className="text-[#a19f9d]">Not assigned</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state.unmatched.length > 0 && (
                <p className="px-3 py-1.5 text-[11px] text-[#605e5c]">
                  {state.unmatched.length} recorded {state.unmatched.length === 1 ? 'check' : 'checks'} could not be tied to a {type === 'room' ? 'room' : 'resident'} and {state.unmatched.length === 1 ? 'is' : 'are'} not counted above.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};
