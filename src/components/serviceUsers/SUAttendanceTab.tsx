import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronLeft as Prev, IconChevronRight as Next, IconExternalLink as ExternalLink } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { suTrackerService } from '../../services/suTrackerService';
import { operationsRealtime } from '../../services/operationsRealtime';
import { buildMonth, summariseMonth, monthKey, shiftMonth, type AttendanceRow, type CalendarDay } from '../../utils/attendanceCalendar';
import { londonToday } from '../../utils/operationsRules';

/**
 * Attendance of ONE Service User as a monthly calendar. Read-only: attendance is marked on the Attendance page and this
 * shows exactly those records (su_attendance_records for this Service User id), including later edits and removals.
 * It follows the shared live connection: a change to this person's attendance re-reads only this person's records.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthTitle = (m: string) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`));
const longDate = (d: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
const stamp = (iso?: string) => (iso && !Number.isNaN(new Date(iso).getTime())
  ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
  : '—');

const CELL: Record<string, string> = {
  Present: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  Absent: 'bg-red-100 text-red-900 border-red-300',
  none: 'bg-neutral-100 text-neutral-500 border-neutral-200'
};

export const SUAttendanceTab: React.FC<{ suId: string; reference?: string }> = ({ suId, reference }) => {
  const { navigateToPageWithSearch } = useApp();
  const today = londonToday();
  const [month, setMonth] = useState(monthKey(today));
  const [selected, setSelected] = useState<string | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    const res = await suTrackerService.listAttendance({ suId });
    if (mine !== seq.current) return;                          // a newer read superseded this one
    if (!res.success) { setError(res.error || 'Attendance could not be loaded.'); setLoading(false); return; }
    setRows(res.data as AttendanceRow[]);
    setError(''); setLoading(false);
  }, [suId]);

  useEffect(() => { setLoading(true); setRows([]); setSelected(null); void load(); }, [load]);

  // Live: only this person's attendance triggers a re-read (debounced so a burst is one read). After a gap, re-read once.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { timer = null; void load(); }, 400); };
    const release = operationsRealtime.acquire({
      onChange: c => { if (c.table === 'su_attendance_records' && (!c.suId || c.suId === suId)) soon(); },
      onResync: soon
    });
    // The Attendance page announces its own saves in this browser, so the calendar follows even before a live event arrives.
    const onLocal = (e: Event) => { if ((e as CustomEvent).detail?.suId === suId) soon(); };
    window.addEventListener('sdtracker:attendanceChanged', onLocal);
    return () => { window.removeEventListener('sdtracker:attendanceChanged', onLocal); if (timer) clearTimeout(timer); release(); };
  }, [suId, load]);

  const days = useMemo(() => buildMonth(month, rows, suId, today), [month, rows, suId, today]);
  const summary = useMemo(() => summariseMonth(days), [days]);
  const detail: CalendarDay | undefined = days.find(d => d.date === selected);
  const rec = detail?.record || null;

  const nothingEver = !loading && !error && rows.length === 0;

  return (
    <div className="space-y-3" aria-label="Attendance">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => { setMonth(shiftMonth(month, -1)); setSelected(null); }} className="p-1 border border-[#e1dfdd] rounded-xs bg-white hover:bg-[#f3f2f1] cursor-pointer" aria-label="Previous month"><Prev className="w-4 h-4" /></button>
          <h3 className="text-sm font-semibold text-[#242424] min-w-[9.5rem] text-center">{monthTitle(month)}</h3>
          <button type="button" onClick={() => { setMonth(shiftMonth(month, 1)); setSelected(null); }} className="p-1 border border-[#e1dfdd] rounded-xs bg-white hover:bg-[#f3f2f1] cursor-pointer" aria-label="Next month"><Next className="w-4 h-4" /></button>
          {month !== monthKey(today) && (
            <button type="button" onClick={() => { setMonth(monthKey(today)); setSelected(null); }} className="ml-1 px-2 py-1 text-xs font-semibold border border-[#e1dfdd] rounded-xs bg-white hover:bg-[#f3f2f1] cursor-pointer">This month</button>
          )}
        </div>
        <button type="button" onClick={() => navigateToPageWithSearch('suAttendance', reference || '')} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0d9488] hover:underline cursor-pointer">
          Mark or edit attendance <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>

      {error && <p role="alert" className="px-3 py-1.5 text-xs bg-red-50 border border-red-200 rounded-xs text-red-800">{error}</p>}

      {/* Monthly summary: recorded days only */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Recorded days', value: loading ? '—' : String(summary.recorded) },
          { label: 'Present', value: loading ? '—' : String(summary.present), cls: 'text-emerald-800' },
          { label: 'Absent', value: loading ? '—' : String(summary.absent), cls: summary.absent > 0 ? 'text-[#a4262c]' : '' },
          { label: 'Attendance', value: loading ? '—' : summary.percent === null ? '—' : `${summary.percent}%` }
        ].map(c => (
          <div key={c.label} className="bg-white border border-[#e1dfdd] rounded-xs px-2.5 py-1.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#605e5c]">{c.label}</span>
            <span className={`block text-lg font-semibold tabular-nums ${c.cls || 'text-[#242424]'}`}>{c.value}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[#605e5c]">The percentage is present days out of recorded days only. Days with no record are not counted as absent, and neither are future days.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-white border border-[#e1dfdd] rounded-xs p-2">
          <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
            {WEEKDAYS.map(w => <div key={w} className="text-center text-[10px] font-semibold uppercase tracking-wider text-[#605e5c]">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={monthTitle(month)}>
            {days.map(d => {
              const tone = d.status ?? 'none';
              const label = `${longDate(d.date)}: ${d.status ?? 'no record'}`;
              return (
                <button
                  key={d.date} type="button" role="gridcell" aria-label={label} title={label} aria-pressed={selected === d.date}
                  onClick={() => setSelected(d.date)}
                  className={`h-10 sm:h-12 text-xs tabular-nums border rounded-xs cursor-pointer ${CELL[tone]} ${d.inMonth ? '' : 'opacity-40'} ${d.isToday ? 'font-bold underline underline-offset-2' : ''} ${selected === d.date ? 'outline outline-2 outline-[#323130]' : ''}`}
                >
                  <span className="block leading-none">{d.day}</span>
                  <span className="block text-[9px] leading-tight mt-0.5">{d.status === 'Present' ? 'P' : d.status === 'Absent' ? 'A' : ''}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-[#323130]">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-xs bg-emerald-100 border border-emerald-300" />Present</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-xs bg-red-100 border border-red-300" />Absent</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-xs bg-neutral-100 border border-neutral-200" />No record</span>
            <span className="inline-flex items-center gap-1"><span className="font-bold underline">12</span>Today</span>
          </div>
        </div>

        <div className="bg-white border border-[#e1dfdd] rounded-xs p-3 text-xs space-y-1.5 self-start" aria-live="polite">
          <h4 className="text-xs font-semibold text-[#242424]">Day detail</h4>
          {!detail ? (
            <p className="text-[#605e5c]">Select a date to see who marked it and when.</p>
          ) : (
            <dl className="space-y-1.5">
              <div><dt className="text-[10px] uppercase tracking-wider font-semibold text-[#605e5c]">Date</dt><dd>{longDate(detail.date)}</dd></div>
              <div><dt className="text-[10px] uppercase tracking-wider font-semibold text-[#605e5c]">Status</dt><dd className="font-semibold">{rec ? rec.attendanceStatus : detail.isFuture ? 'Not yet due' : 'No record'}</dd></div>
              {rec && <>
                <div><dt className="text-[10px] uppercase tracking-wider font-semibold text-[#605e5c]">Marked by</dt><dd>{rec.recordedBy || '—'}</dd></div>
                <div><dt className="text-[10px] uppercase tracking-wider font-semibold text-[#605e5c]">Marked</dt><dd className="tabular-nums">{stamp(rec.createdAt)}</dd></div>
                {rec.updatedAt && rec.updatedAt !== rec.createdAt && (
                  <div><dt className="text-[10px] uppercase tracking-wider font-semibold text-[#605e5c]">Last changed</dt><dd className="tabular-nums">{stamp(rec.updatedAt)}{rec.updatedBy ? ` by ${rec.updatedBy}` : ''}</dd></div>
                )}
                <div><dt className="text-[10px] uppercase tracking-wider font-semibold text-[#605e5c]">Notes</dt><dd className="whitespace-pre-wrap">{rec.additionalNotes?.trim() || '—'}</dd></div>
              </>}
            </dl>
          )}
        </div>
      </div>

      {loading && <p className="text-xs text-[#605e5c]" aria-busy="true">Loading attendance…</p>}
      {nothingEver && <p className="text-xs text-[#605e5c]">No attendance has been recorded for this Service User yet.</p>}
    </div>
  );
};
