import React, { useState } from 'react';
import type { DeptRow, CheckMonitor, OverdueCheck, MaintenanceOverview, MaintenanceRow, ResidentProfile } from '../../utils/operationsDepartments';

/**
 * Presentational sections of the Operations Dashboard. No data fetching and no calculation here: every number arrives
 * already worked out by utils/operationsDepartments.ts / operationsSelectors.ts. Static by design - no animation,
 * transitions, charts or shadows. A number that could not be loaded is a dash, never zero.
 */

export const DASH = '—';
const n = (v: number) => v.toLocaleString('en-GB');

const TH = 'px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] whitespace-nowrap';
const THR = `${TH} text-right`;
const TD = 'px-2 py-1.5 align-top';
const TDR = `${TD} text-right tabular-nums`;

export type OpenTarget = (page: string, filters?: Record<string, string>, recordId?: string) => void;

const Tag: React.FC<{ tone: 'red' | 'amber' | 'green' | 'grey'; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-xs border whitespace-nowrap ${
    tone === 'red' ? 'bg-red-50 text-red-800 border-red-200'
      : tone === 'amber' ? 'bg-amber-50 text-amber-800 border-amber-200'
        : tone === 'green' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-neutral-100 text-neutral-700 border-neutral-200'
  }`}>{children}</span>
);

const Section: React.FC<{ id: string; title: string; note?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }> = ({ id, title, note, right, children }) => (
  <section id={id} className="bg-white border border-[#e1dfdd] rounded-xs min-w-0" aria-labelledby={`${id}-h`}>
    <header className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 border-b border-[#e1dfdd]">
      <h2 id={`${id}-h`} className="text-xs font-semibold text-[#242424]">{title}</h2>
      <div className="flex items-center gap-2 text-[11px] text-[#605e5c]">{note}{right}</div>
    </header>
    {children}
  </section>
);

/** A figure that opens the records behind it when it is above zero. */
const Fig: React.FC<{ value: number | null; tone?: 'red' | 'amber' | 'green'; onOpen?: () => void; title?: string; ready: boolean }> = ({ value, tone, onOpen, title, ready }) => {
  if (!ready || value === null) return <span title={title}>{DASH}</span>;
  const color = value > 0 && tone === 'red' ? 'text-[#a4262c] font-bold' : value > 0 && tone === 'amber' ? 'text-[#7f6000] font-semibold' : value > 0 && tone === 'green' ? 'text-emerald-800' : 'text-[#242424]';
  if (!onOpen || value === 0) return <span className={color} title={title}>{n(value)}</span>;
  return <button type="button" onClick={onOpen} title={title} className={`${color} hover:underline focus:underline focus:outline-none`}>{n(value)}</button>;
};

/* ------------------------------------------------------------------ department-wise operations */

type Col = 'total' | 'completed' | 'pending' | 'dueToday' | 'overdue' | 'inProgress';
interface Target { page: string; filters?: Record<string, string>; exact: boolean }

/** Where each figure opens. `exact` = the page can show precisely those rows; otherwise it opens the page unfiltered and says so. */
export function deptTarget(key: DeptRow['key'], col: Col): Target {
  const checks = (page: 'roomChecks' | 'welfareChecks'): Target => {
    const due: Partial<Record<Col, string>> = { total: 'all', completed: 'completed', pending: 'pending', overdue: 'overdue', dueToday: 'pending' };
    return { page, filters: due[col] ? { due: due[col]! } : undefined, exact: col !== 'dueToday' };
  };
  switch (key) {
    case 'roomChecks': return checks('roomChecks');
    case 'welfareChecks': return checks('welfareChecks');
    case 'maintenance':
      if (col === 'total') return { page: 'maintenance', filters: { open: '1' }, exact: true };
      if (col === 'overdue') return { page: 'maintenance', filters: { sla: 'overdue' }, exact: true };
      return { page: 'maintenance', exact: false };
    case 'escalations': return col === 'total' ? { page: 'escalations', filters: { open: '1' }, exact: true } : { page: 'escalations', exact: false };
    case 'newArrivals': return { page: 'dailyRegisters', exact: false };
    case 'dispersals':
    case 'evictions': return { page: 'dispersal', exact: false };
    case 'laundry': return { page: 'laundry', exact: false };
  }
}

const DEPT_PAGE: Record<DeptRow['key'], string> = {
  newArrivals: 'dailyRegisters', dispersals: 'dispersal', evictions: 'dispersal', roomChecks: 'roomChecks', welfareChecks: 'welfareChecks',
  maintenance: 'maintenance', laundry: 'laundry', escalations: 'escalations'
};

export const DepartmentTable: React.FC<{
  rows: DeptRow[]; ready: boolean; unavailable: Partial<Record<DeptRow['key'], boolean>>; periodLabel: string; onOpen: OpenTarget;
}> = ({ rows, ready, unavailable, periodLabel, onOpen }) => (
  <Section id="ops-departments" title="Department-wise operations" note={<span>Completed and Total follow the period: {periodLabel}. Pending, due today and overdue are as of now.</span>}>
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#edebe9]">
            <th className={TH}>Module</th><th className={THR}>Total</th><th className={THR}>Completed</th><th className={THR}>Pending</th>
            <th className={THR}>In progress</th><th className={THR}>Due today</th><th className={THR}>Overdue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f3f2f1]">
          {rows.map(r => {
            const down = !!unavailable[r.key];
            const cell = (col: Col, tone?: 'red' | 'amber' | 'green') => {
              const t = deptTarget(r.key, col);
              return (
                <td className={TDR}>
                  <Fig value={r[col]} tone={tone} ready={ready && !down}
                    title={col === 'total' ? r.totalMeans : t.exact ? 'Open the matching records' : 'Opens the page (this exact filter is not available there)'}
                    onOpen={() => onOpen(t.page, t.filters)} />
                </td>
              );
            };
            return (
              <tr key={r.key}>
                <td className={TD}><button type="button" className="text-left text-[#242424] hover:underline focus:underline focus:outline-none" onClick={() => onOpen(DEPT_PAGE[r.key])}>{r.label}</button></td>
                {cell('total')}{cell('completed', 'green')}{cell('pending', 'amber')}{cell('inProgress')}{cell('dueToday', 'amber')}{cell('overdue', 'red')}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <p className="px-2.5 py-1.5 text-[11px] text-[#605e5c] border-t border-[#edebe9]">
      {DASH} means the module does not record that status. Hover a Total for exactly what it counts. Daily Registers, Meals, Catering, Transport, Inspections, Compliance and Finance are summarised in the sections around this table because their statuses differ.
    </p>
  </Section>
);

/* ------------------------------------------------------------------ welfare and room check monitoring */

const Ratio: React.FC<{ m: CheckMonitor | null }> = ({ m }) => (m ? <span className="tabular-nums">2/2: {n(m.ratio.both)} · 1/2: {n(m.ratio.one)} · 0/2: {n(m.ratio.none)}</span> : <span>{DASH}</span>);

export const ChecksMonitor: React.FC<{
  month: string;
  room: { monitor: CheckMonitor | null; visible: boolean; error: boolean };
  welfare: { monitor: CheckMonitor | null; visible: boolean; error: boolean };
  overdue: OverdueCheck[];
  ready: boolean;
  onOpen: OpenTarget;
}> = ({ month, room, welfare, overdue, ready, onOpen }) => {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? overdue : overdue.slice(0, 10);
  const lines: Array<{ label: string; page: 'roomChecks' | 'welfareChecks'; period: 'first' | 'second'; src: typeof room }> = [];
  if (room.visible) lines.push({ label: 'Room checks', page: 'roomChecks', period: 'first', src: room }, { label: 'Room checks', page: 'roomChecks', period: 'second', src: room });
  if (welfare.visible) lines.push({ label: 'Welfare checks', page: 'welfareChecks', period: 'first', src: welfare }, { label: 'Welfare checks', page: 'welfareChecks', period: 'second', src: welfare });
  if (lines.length === 0) return null;
  const pageOf = (l: { page: string }) => l.page;

  return (
    <Section id="ops-checks" title={`Welfare and room check monitoring - ${month}`} note={<span>Two checks a month: first by the 10th, second by the 25th. Only occupied rooms and placed residents are counted.</span>}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#edebe9]">
              <th className={TH}>Check</th><th className={TH}>Review</th><th className={THR}>Eligible</th><th className={THR}>Completed</th><th className={THR}>Pending</th><th className={THR}>Overdue</th><th className={TH}>Completion ratio (both reviews)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f3f2f1]">
            {lines.map(l => {
              const m = l.src.monitor;
              const c = m ? m[l.period] : null;
              const ok = ready && !!m && !l.src.error;
              const due = (v: string) => () => onOpen(pageOf(l), { due: v, month });
              return (
                <tr key={`${l.page}-${l.period}`}>
                  <td className={TD}>{l.label}</td>
                  <td className={`${TD} whitespace-nowrap`}>{l.period === 'first' ? 'First (by the 10th)' : 'Second (by the 25th)'}</td>
                  <td className={TDR}><Fig ready={ok} value={m ? m.eligible : null} onOpen={due('all')} title="Rooms or residents that owe this check" /></td>
                  <td className={TDR}><Fig ready={ok} value={c ? c.completed : null} tone="green" onOpen={due('completed')} title="Includes checks completed after the deadline" /></td>
                  <td className={TDR}><Fig ready={ok} value={c ? c.pending : null} tone="amber" onOpen={due('pending')} /></td>
                  <td className={TDR}><Fig ready={ok} value={c ? c.overdue : null} tone="red" onOpen={due('overdue')} /></td>
                  <td className={`${TD} text-[#605e5c]`}>{ok ? <Ratio m={m} /> : DASH}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#edebe9]">
        <h3 className="px-2.5 py-1.5 text-xs font-semibold text-[#242424]">Overdue checks{ready ? ` (${n(overdue.length)})` : ''}</h3>
        {!ready ? (
          <p className="px-2.5 pb-2 text-xs text-[#605e5c]" aria-busy="true">Loading…</p>
        ) : overdue.length === 0 ? (
          <p className="px-2.5 pb-2 text-xs text-[#605e5c]">No overdue checks at the selected site(s).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#edebe9]">
                  <th className={TH}>Site</th><th className={TH}>Property</th><th className={TH}>Room</th><th className={TH}>Service user</th>
                  <th className={TH}>Check</th><th className={TH}>Assigned</th><th className={TH}>Due</th><th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f2f1]">
                {shown.map(o => (
                  <tr key={o.key} className="cursor-pointer hover:bg-[#f3f2f1]" onClick={() => onOpen(o.checkType === 'Room check' ? 'roomChecks' : 'welfareChecks', { due: 'overdue', month })}>
                    <td className={`${TD} whitespace-nowrap font-medium text-[#323130]`}>{o.siteName || DASH}</td>
                    <td className={TD}>{o.propertyName || DASH}</td>
                    <td className={`${TD} whitespace-nowrap`}>{o.roomNumber || DASH}</td>
                    <td className={TD}>{o.suName || DASH}</td>
                    <td className={`${TD} whitespace-nowrap`}>{o.checkType} · {o.period}</td>
                    <td className={`${TD} text-[#605e5c]`}>{o.assignedTo || DASH}</td>
                    <td className={`${TD} whitespace-nowrap tabular-nums`}>{o.dueDate} <span className="text-[#605e5c]">({o.daysLate} d late)</span></td>
                    <td className={TD}><Tag tone="red">Overdue</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {overdue.length > 10 && (
              <button type="button" onClick={() => setShowAll(v => !v)} className="w-full px-2.5 py-1.5 text-xs font-semibold text-[#0d9488] hover:bg-[#f3f2f1] text-left border-t border-[#edebe9]">
                {showAll ? 'Show fewer' : `Show all ${n(overdue.length)}`}
              </button>
            )}
          </div>
        )}
      </div>
    </Section>
  );
};

/* ------------------------------------------------------------------ maintenance overview */

const hoursLabel = (h: number | null) => (h === null ? DASH : h < 48 ? `${h} h` : `${Math.round((h / 24) * 10) / 10} d`);

export const MaintenanceOverviewSection: React.FC<{
  overview: MaintenanceOverview; rows: MaintenanceRow[]; ready: boolean; unavailable: boolean; periodLabel: string; onOpen: OpenTarget;
}> = ({ overview, rows, ready, unavailable, periodLabel, onOpen }) => {
  const [showAll, setShowAll] = useState(false);
  const ok = ready && !unavailable;
  const shown = showAll ? rows : rows.slice(0, 10);
  const stat = (label: string, value: number | null, tone: 'red' | 'amber' | 'green' | undefined, open?: () => void, title?: string) => (
    <div className="px-2.5 py-1.5 border-r border-[#f3f2f1] last:border-r-0 min-w-0" title={title}>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] truncate">{label}</span>
      <span className="block text-base font-semibold tabular-nums"><Fig value={value} tone={tone} ready={ok} onOpen={open} /></span>
    </div>
  );
  return (
    <Section id="ops-maintenance" title="Maintenance overview" note={unavailable ? <span>Could not load maintenance.</span> : <span>Completed time uses {periodLabel}</span>}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-b border-[#edebe9]">
        {stat('Open jobs', overview.open, undefined, () => onOpen('maintenance', { open: '1' }), 'Not Completed and not Closed')}
        {stat('New today', overview.newToday, undefined, () => onOpen('maintenance'), 'Reported today (opens the page; no same-day filter there)')}
        {stat('In progress', overview.inProgress, undefined, () => onOpen('maintenance', { open: '1' }), 'Open and not past Complete By. The tracker has a single open status, "In Process".')}
        {stat('Overdue', overview.overdue, 'red', () => onOpen('maintenance', { sla: 'overdue' }))}
        {stat('Completed today', overview.completedToday, 'green', () => onOpen('maintenance'), 'Closed today (opens the page; no same-day filter there)')}
        <div className="px-2.5 py-1.5 min-w-0" title={ok ? `From ${overview.avgSampleSize} job(s) closed in the period that have both a report time and a closure time` : undefined}>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] truncate">Avg completion</span>
          <span className="block text-base font-semibold tabular-nums">{ok ? hoursLabel(overview.avgCompletionHours) : DASH}</span>
        </div>
      </div>
      {!ok ? (
        <p className="px-2.5 py-3 text-xs text-[#605e5c]" aria-busy={!unavailable}>{unavailable ? 'Maintenance could not be loaded.' : 'Loading…'}</p>
      ) : rows.length === 0 ? (
        <p className="px-2.5 py-3 text-xs text-[#605e5c]">No open maintenance at the selected site(s).</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#edebe9]">
                <th className={TH}>Reference</th><th className={TH}>Site</th><th className={TH}>Property / room</th><th className={TH}>Issue</th>
                <th className={TH}>Priority</th><th className={TH}>Created</th><th className={TH}>Due</th><th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f2f1]">
              {shown.map(r => (
                <tr key={r.id} className="cursor-pointer hover:bg-[#f3f2f1]" onClick={() => onOpen('maintenance', undefined, r.id)}>
                  <td className={`${TD} whitespace-nowrap tabular-nums`}>{r.id}</td>
                  <td className={`${TD} whitespace-nowrap font-medium text-[#323130]`}>{r.site}</td>
                  <td className={TD}>{r.location || DASH}</td>
                  <td className={`${TD} max-w-[240px] truncate`} title={r.category}>{r.category}</td>
                  <td className={`${TD} whitespace-nowrap`}>{r.priority}</td>
                  <td className={`${TD} whitespace-nowrap tabular-nums`}>{r.created || DASH}</td>
                  <td className={`${TD} whitespace-nowrap tabular-nums`}>{r.due || DASH}</td>
                  <td className={TD}>{r.overdue ? <Tag tone="red">Overdue</Tag> : <Tag tone="grey">{r.status}</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 10 && (
            <button type="button" onClick={() => setShowAll(v => !v)} className="w-full px-2.5 py-1.5 text-xs font-semibold text-[#0d9488] hover:bg-[#f3f2f1] text-left border-t border-[#edebe9]">
              {showAll ? 'Show fewer' : `Show all ${n(rows.length)}`}
            </button>
          )}
        </div>
      )}
      <p className="px-2.5 py-1.5 text-[11px] text-[#605e5c] border-t border-[#edebe9]">
        Not shown because SDTracker does not record it: assigned engineer, awaiting assignment, awaiting approval.
      </p>
    </Section>
  );
};

/* ------------------------------------------------------------------ resident and property overview */

export const ResidentPropertySection: React.FC<{
  profile: ResidentProfile | null; ready: boolean; unavailable: boolean;
  occupancy: { residents: number; beds: number; pct: number | null; roomsOccupied: number; roomsAvailable: number } | null;
  demographics: { male: number; female: number; other: number; child: number; adult: number; elderly: number; aspen: number; families: Record<string, number> } | null;
  onOpen: OpenTarget;
}> = ({ profile, ready, unavailable, occupancy, demographics, onOpen }) => {
  const ok = ready && !unavailable;
  const cell = (label: string, value: number | null, title?: string, open?: () => void) => (
    <div className="px-2.5 py-1.5 min-w-0" title={title}>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] truncate">{label}</span>
      <span className="block text-base font-semibold tabular-nums"><Fig value={value} ready={ok} onOpen={open} /></span>
    </div>
  );
  return (
    <Section id="ops-residents" title="Resident and property overview" note={<span>Counts only; no names are shown here.</span>}>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 divide-x divide-[#f3f2f1]">
        {cell('Active residents', profile ? profile.activeResidents : null, 'Active service users with an active placement', () => onOpen('suUsers'))}
        {cell('Vulnerable', profile ? profile.vulnerable : null, 'Service users flagged Vulnerable', () => onOpen('vulnerable'))}
        {cell('Disability recorded', profile ? profile.disabilities : null, 'A disability category or type is recorded', () => onOpen('suUsers'))}
        {cell('PEEP', profile ? profile.peep : null, 'Personal Emergency Evacuation Plan type recorded', () => onOpen('peepTracker'))}
        {cell('GEEP', profile ? profile.geep : null, 'General Emergency Evacuation Plan type recorded', () => onOpen('peepTracker'))}
        {cell('No plan type', profile ? profile.noEvacuationPlan : null, 'Active residents with no PEEP/GEEP type recorded', () => onOpen('suUsers'))}
        {cell('Occupied rooms', occupancy ? occupancy.roomsOccupied : null, 'Rooms in use with at least one resident', () => onOpen('propertyManagement'))}
        {cell('Interconnecting', profile ? profile.interconnectingRooms : null, profile ? `${profile.interconnectGroups} connected group(s) configured in the Daily Register` : undefined, () => onOpen('dailyRegisters'))}
      </div>
      {demographics ? (
        <div className="px-2.5 py-1.5 text-xs text-[#323130] border-t border-[#edebe9] space-x-4 tabular-nums">
          <span><span className="text-[#605e5c]">Gender (Daily Register):</span> Male {n(demographics.male)} · Female {n(demographics.female)} · Other/not stated {n(demographics.other)}</span>
          <span><span className="text-[#605e5c]">Age:</span> Children {n(demographics.child)} · Adults {n(demographics.adult)} · Elderly {n(demographics.elderly)}</span>
          <span><span className="text-[#605e5c]">Aspen card:</span> {n(demographics.aspen)}</span>
          <span><span className="text-[#605e5c]">Family size:</span> {Object.entries(demographics.families).map(([k, v]) => `${k}: ${n(v)}`).join(' · ')}</span>
        </div>
      ) : null}
    </Section>
  );
};
