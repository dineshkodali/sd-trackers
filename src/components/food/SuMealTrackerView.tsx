import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconHistory as History, IconClipboardList as ClipboardList, IconCheck as Check, IconX as XIcon, IconNote as NoteIcon,
  IconEye as Eye, IconPencil as Pencil
} from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { suTrackerService, type SuDirectoryRow } from '../../services/suTrackerService';
import { suEnhancementsService, type MealRecord, type MealHistoryEntry } from '../../services/suEnhancementsService';
import { MEAL_PERIODS, MEAL_STATUSES, mealDayStatus, mealRecordId, type MealPeriod, type MealDayStatus } from '../../utils/suEnhancementsLogic';
import { todayIso } from '../../utils/attendanceLogic';
import { SiteFilterSelect, TrackerExport, RefreshButton, ResetFiltersButton, type TrackerExportColumn } from '../common/TrackerToolbar';
import {
  TrackerHeader, TablePanel, SortableTh, ActionsTh, actionsTdCls, EmptyRow, SkeletonRows, theadRowCls, tbodyCls, tdCls
} from '../common/TrackerLayout';
import { useTableControls, usePaged, SearchBox, filterSelectCls } from '../su/tableControls';
import { Field, ErrorBanner, Notice, StatusPill, SuModal, inputCls, primaryBtn, secondaryBtn, useSuActor, fmtDateTime, fmtDate } from '../su/suUi';

const statusTone = (s: string) => (s === 'Accepted' || s === 'Provided' ? 'good' : s === 'Declined' || s === 'Not available' ? 'warn' : 'neutral') as 'good' | 'warn' | 'neutral';

/** Without a single Service User chosen, a date range loads one request per day, so it is capped. */
const MAX_RANGE_DAYS = 31;
/** With one Service User chosen the range can be longer: it is a single request. */
const MAX_SU_RANGE_DAYS = 120;

interface MealRow { key: string; date: string; r: SuDirectoryRow; statuses: Partial<Record<MealPeriod, string>>; day: MealDayStatus }

const datesBetween = (from: string, to: string): string[] => {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end && out.length < 400) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
};

const iconBtn = 'p-1.5 rounded-xs text-neutral-500 hover:text-[#0d9488] hover:bg-teal-50 cursor-pointer transition-colors';

/**
 * Breakfast, lunch and dinner for every Service User: one day, a date range, or one Service User across a range.
 * A slot with no entry counts as Pending. Marking is instant; corrections keep their history.
 */
export const SuMealTrackerView: React.FC<{ tabSwitcher?: React.ReactNode }> = ({ tabSwitcher }) => {
  const { sites, currentUserName, isSitePermitted, defaultSiteFilter } = useApp();
  const actor = useSuActor();
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [directory, setDirectory] = useState<SuDirectoryRow[]>([]);
  const [records, setRecords] = useState<MealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [suFilter, setSuFilter] = useState('');
  // Follows the property chosen in the top bar (and the user's permitted properties), like every other tracker
  const [site, setSite] = useState<string>(defaultSiteFilter);
  useEffect(() => { setSite(defaultSiteFilter); }, [defaultSiteFilter]);
  const [dayFilter, setDayFilter] = useState<'all' | MealDayStatus>('all');
  const [mealFilter, setMealFilter] = useState('all');
  const [editing, setEditing] = useState<{ row: MealRow; period: MealPeriod } | null>(null);
  const [viewing, setViewing] = useState<MealRow | null>(null);
  const [editingDay, setEditingDay] = useState<MealRow | null>(null);
  const [historyFor, setHistoryFor] = useState<MealRow | null>(null);
  const inFlight = useRef(new Set<string>());

  const isRange = dateFrom !== dateTo;
  const rangeDays = datesBetween(dateFrom, dateTo).length;
  const maxDays = suFilter ? MAX_SU_RANGE_DAYS : MAX_RANGE_DAYS;
  const rangeTooLong = isRange && rangeDays > maxDays;
  // Only a range needs a different request for a chosen person; on a single day the person filter is applied to what is already loaded
  const loadSu = isRange ? suFilter : '';

  const loadDirectory = useCallback(async () => {
    const dir = await suTrackerService.loadSuDirectory(sites);
    if (!dir.success) { setError(dir.error || 'Could not load Service Users.'); return; }
    setDirectory(dir.data.filter(r => isSitePermitted(r.siteName, 'all')));
  }, [sites, isSitePermitted]);

  const loadMeals = useCallback(async () => {
    if (dateFrom > dateTo || rangeTooLong) { setRecords([]); setLoading(false); return; }
    setLoading(true); setError('');
    let rows: MealRecord[] = [];
    if (dateFrom === dateTo) {
      const res = await suEnhancementsService.listMealsForDate(dateFrom);
      if (!res.success) { setLoading(false); setError(res.error || 'Could not load meal records.'); return; }
      rows = res.data;
    } else if (loadSu) {
      const res = await suEnhancementsService.listMealsForSu(loadSu, 1000);
      if (!res.success) { setLoading(false); setError(res.error || 'Could not load meal records.'); return; }
      rows = res.data.filter(m => m.mealDate >= dateFrom && m.mealDate <= dateTo);
    } else {
      // One request per day, a few at a time so the connection pool is not flooded
      const days = datesBetween(dateFrom, dateTo);
      for (let i = 0; i < days.length; i += 3) {
        const results = await Promise.all(days.slice(i, i + 3).map(d => suEnhancementsService.listMealsForDate(d)));
        const failed = results.find(r => !r.success);
        if (failed) { setLoading(false); setError(failed.error || 'Could not load meal records.'); return; }
        rows.push(...results.flatMap(r => r.data));
      }
    }
    setLoading(false);
    setRecords(rows);
  }, [dateFrom, dateTo, loadSu, rangeTooLong]);

  useEffect(() => { void loadDirectory(); }, [loadDirectory]);
  useEffect(() => { void loadMeals(); }, [loadMeals]);
  const refresh = () => { void loadDirectory(); void loadMeals(); };

  const slotKey = (suId: string, date: string, period: string) => `${suId}|${date}|${period}`;
  const bySlot = useMemo(() => new Map<string, MealRecord>(records.map(r => [slotKey(r.suId, r.mealDate, r.mealPeriod), r] as [string, MealRecord])), [records]);

  const allRows = useMemo<MealRow[]>(() => {
    const build = (r: SuDirectoryRow, date: string): MealRow => {
      const statuses: Partial<Record<MealPeriod, string>> = {};
      for (const p of MEAL_PERIODS) statuses[p] = bySlot.get(slotKey(r.su.id, date, p))?.status;
      return { key: `${r.su.id}|${date}`, date, r, statuses, day: mealDayStatus(statuses) };
    };
    if (dateFrom > dateTo || rangeTooLong) return [];
    if (!isRange) return directory.map(r => build(r, dateFrom));
    const dates = datesBetween(dateFrom, dateTo);
    if (suFilter) {
      const one = directory.find(r => r.su.id === suFilter);
      return one ? dates.map(d => build(one, d)) : [];
    }
    // Several Service Users over several days: only the days that have something recorded
    const byId = new Map(directory.map(r => [r.su.id, r] as [string, SuDirectoryRow]));
    const seen = new Set<string>();
    const out: MealRow[] = [];
    for (const m of records) {
      const k = `${m.suId}|${m.mealDate}`;
      const r = byId.get(m.suId);
      if (!r || seen.has(k)) continue;
      seen.add(k); out.push(build(r, m.mealDate));
    }
    return out;
  }, [directory, bySlot, records, dateFrom, dateTo, isRange, suFilter, rangeTooLong]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter(x => {
      if (!isSitePermitted(x.r.siteName, site)) return false;
      if (suFilter && x.r.su.id !== suFilter) return false;
      if (dayFilter !== 'all' && x.day !== dayFilter) return false;
      if (mealFilter !== 'all' && !MEAL_PERIODS.some(p => (x.statuses[p] || 'Pending') === mealFilter)) return false;
      return !q || `${x.r.su.firstName} ${x.r.su.lastName} ${x.r.su.externalReference || ''} ${x.r.su.suReference} ${x.r.roomNo} ${x.r.siteName}`.toLowerCase().includes(q);
    });
  }, [allRows, search, site, suFilter, dayFilter, mealFilter, isSitePermitted]);

  const tc = useTableControls<MealRow>(isRange ? 'date' : 'room', {
    date: x => x.date,
    name: x => `${x.r.su.firstName} ${x.r.su.lastName}`, site: x => x.r.siteName, room: x => `${x.r.siteName} ${x.r.roomNo}`,
    Breakfast: x => x.statuses.Breakfast || 'Pending', Lunch: x => x.statuses.Lunch || 'Pending', Dinner: x => x.statuses.Dinner || 'Pending', day: x => x.day
  });
  const sorted = tc.sortRows(filtered);
  const paged = usePaged(sorted, tc.page, tc.pageSize);

  const totals = useMemo(() => {
    const scoped = allRows.filter(x => isSitePermitted(x.r.siteName, site) && (!suFilter || x.r.su.id === suFilter));
    const meals = scoped.flatMap(x => MEAL_PERIODS.map(p => x.statuses[p]));
    return { accepted: meals.filter(m => m === 'Accepted').length, declined: meals.filter(m => m === 'Declined').length, total: scoped.length, complete: scoped.filter(x => x.day === 'Complete').length, incomplete: scoped.filter(x => x.day === 'Incomplete').length, notStarted: scoped.filter(x => x.day === 'Not started').length };
  }, [allRows, site, suFilter, isSitePermitted]);

  const today = todayIso();
  const filtersActive = !!search || !!suFilter || site !== defaultSiteFilter || dayFilter !== 'all' || mealFilter !== 'all' || dateFrom !== today || dateTo !== today;
  const resetFilters = () => { setSearch(''); setSuFilter(''); setSite(defaultSiteFilter); setDayFilter('all'); setMealFilter('all'); setDateFrom(todayIso()); setDateTo(todayIso()); tc.resetPage(); };

  const rangeLabel = isRange ? `${fmtDate(dateFrom)} to ${fmtDate(dateTo)}` : fmtDate(dateFrom);
  const noteOf = (x: MealRow, p: MealPeriod) => bySlot.get(slotKey(x.r.su.id, x.date, p))?.notes;
  const exportCols: TrackerExportColumn<MealRow>[] = [
    { id: 'date', label: 'Date', get: x => fmtDate(x.date) },
    { id: 'name', label: 'Service User', get: x => `${x.r.su.firstName} ${x.r.su.lastName}` },
    { id: 'ref', label: 'Port / SU reference', get: x => x.r.su.externalReference || x.r.su.suReference },
    { id: 'site', label: 'Property', get: x => x.r.siteName },
    { id: 'room', label: 'Room', get: x => x.r.roomNo },
    ...MEAL_PERIODS.flatMap(p => [
      { id: p, label: p, get: (x: MealRow) => x.statuses[p] || 'Pending' },
      { id: `${p}-notes`, label: `${p} notes`, get: (x: MealRow) => noteOf(x, p), defaultSelected: false }
    ]),
    { id: 'notes', label: 'Notes', get: x => MEAL_PERIODS.map(p => { const n = noteOf(x, p); return n ? `${p}: ${n}` : ''; }).filter(Boolean).join(' | ') },
    { id: 'day', label: 'Daily status', get: x => x.day }
  ];
  const th = (key: string, label: string) => <SortableTh key={key} label={label} active={tc.sortKey === key} asc={tc.asc} onSort={() => tc.sortBy(key)} />;

  // Marking is optimistic: the tap shows at once and the save runs in the background (no reload, no spinner).
  // If the save fails the slot goes back to what it was and the error banner explains why.
  const recordsRef = useRef<MealRecord[]>([]);
  recordsRef.current = records;
  const queued = useRef(new Map<string, { status: string; notes?: string }>());

  const save = async (su: SuDirectoryRow, date: string, period: MealPeriod, status: string, notes?: string): Promise<string | null> => {
    const key = slotKey(su.su.id, date, period);
    const match = (r: MealRecord) => r.suId === su.su.id && r.mealDate === date && r.mealPeriod === period;
    const previous = recordsRef.current.find(match) || null;

    const optimistic: MealRecord = { ...(previous || { id: mealRecordId(su.su.id, date, period), suId: su.su.id, mealDate: date, mealPeriod: period, recordedBy: currentUserName }), status, notes: notes?.trim() ? notes : null, updatedBy: currentUserName };
    setRecords(prev => [...prev.filter(r => !match(r)), optimistic]);
    setError('');

    // A save for this slot is already running: remember the latest choice and send it once that one finishes
    if (inFlight.current.has(key)) { queued.current.set(key, { status, notes }); return null; }

    inFlight.current.add(key);
    let err: string | null = null;
    let existing: MealRecord | null = previous;
    let next: { status: string; notes?: string } | undefined = { status, notes };
    while (next) {
      queued.current.delete(key);
      const res = await suEnhancementsService.saveMeal({ suId: su.su.id, mealDate: date, mealPeriod: period, status: next.status, notes: next.notes, existing }, currentUserName);
      if (!res.success) { err = res.error || 'Could not save.'; break; }
      existing = { ...optimistic, ...res.data };
      setRecords(prev => prev.map(r => (match(r) ? { ...r, ...res.data, id: res.data?.id || r.id } : r)));
      next = queued.current.get(key);
    }
    inFlight.current.delete(key);
    queued.current.delete(key);
    if (err) {
      setRecords(prev => { const rest = prev.filter(r => !match(r)); return previous ? [...rest, previous] : rest; });
      return err;
    }
    return null;
  };

  const onPick = async (x: MealRow, period: MealPeriod, status: string) => {
    const err = await save(x.r, x.date, period, status, bySlot.get(slotKey(x.r.su.id, x.date, period))?.notes || undefined);
    if (err) setError(err);
  };

  const colSpan = isRange ? 8 : 7;
  const suOptions = directory.filter(r => isSitePermitted(r.siteName, site)).sort((a, b) => `${a.su.firstName} ${a.su.lastName}`.localeCompare(`${b.su.firstName} ${b.su.lastName}`));

  return (
    <div className="space-y-4">
      <TrackerHeader
        icon={<ClipboardList className="w-5 h-5" />}
        title="Service User Meals"
        tabs={tabSwitcher}
        countLabel={loading || error ? undefined : `${filtered.length} ${isRange ? 'Daily Records' : 'Service Users'}`}
        description={`Tap Accepted or Declined for each meal (${rangeLabel}). Add a note only if there is something to record.`}
        actions={
          <>
            <RefreshButton onClick={refresh} loading={loading} />
            <TrackerExport<MealRow> moduleName="Service User Meals" filename={`SU_Meals_${dateFrom}${isRange ? `_to_${dateTo}` : ''}`} title={`Service User Meals ${rangeLabel}`} allRows={allRows} filteredRows={filtered} columns={exportCols} dateOf={x => x.date} />
          </>
        }
        summary={
          <div className="flex items-center gap-1.5 text-xs mt-3 flex-wrap">
            <StatusPill status={`${totals.complete} of ${totals.total} complete`} tone={totals.total > 0 && totals.complete === totals.total ? 'good' : 'neutral'} />
            {totals.accepted > 0 && <StatusPill status={`${totals.accepted} meals accepted`} tone="good" />}
            {totals.declined > 0 && <StatusPill status={`${totals.declined} meals declined`} tone="warn" />}
            {totals.incomplete > 0 && <StatusPill status={`${totals.incomplete} incomplete`} tone="warn" />}
            {totals.notStarted > 0 && <StatusPill status={`${totals.notStarted} not started`} tone="warn" />}
          </div>
        }
        notice={
          rangeTooLong ? <div className="mt-3"><Notice tone="warn">That range is {rangeDays} days. Choose up to {maxDays} days{suFilter ? '' : ` (or pick one Service User for up to ${MAX_SU_RANGE_DAYS} days)`}.</Notice></div>
          : dateFrom > dateTo ? <div className="mt-3"><Notice tone="warn">The start date is after the end date.</Notice></div>
          : (dateFrom !== today || dateTo !== today) ? <div className="mt-3"><Notice>You are viewing {rangeLabel}. Changes made here are recorded as corrections with their history.</Notice></div> : undefined
        }
        filtersClassName="flex flex-wrap items-center gap-2"
        filters={
          <>
            <div className="flex items-center gap-1.5">
              <input type="date" className={filterSelectCls} value={dateFrom} max={today} onChange={e => { if (e.target.value) { setDateFrom(e.target.value); if (e.target.value > dateTo) setDateTo(e.target.value); tc.resetPage(); } }} aria-label="From date" />
              <span className="text-neutral-400 text-xs">to</span>
              <input type="date" className={filterSelectCls} value={dateTo} min={dateFrom} max={today} onChange={e => { if (e.target.value) { setDateTo(e.target.value); tc.resetPage(); } }} aria-label="To date" />
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className={secondaryBtn} onClick={() => { setDateFrom(todayIso()); setDateTo(todayIso()); tc.resetPage(); }}>Today</button>
              <button type="button" className={secondaryBtn} onClick={() => { const t = new Date(); t.setDate(t.getDate() - 6); setDateFrom(t.toISOString().slice(0, 10)); setDateTo(todayIso()); tc.resetPage(); }}>Last 7 days</button>
            </div>
            <select value={suFilter} onChange={e => { setSuFilter(e.target.value); tc.resetPage(); }} className={filterSelectCls} aria-label="Service User">
              <option value="">All Service Users</option>
              {suOptions.map(r => <option key={r.su.id} value={r.su.id}>{r.su.firstName} {r.su.lastName}{r.roomNo ? ` · Room ${r.roomNo}` : ''}</option>)}
            </select>
            <SearchBox value={search} onChange={v => { setSearch(v); tc.resetPage(); }} placeholder="Search name, reference, room or property..." />
            <SiteFilterSelect value={site} onChange={v => { setSite(v); setSuFilter(''); tc.resetPage(); }} />
            <select value={dayFilter} onChange={e => { setDayFilter(e.target.value as 'all' | MealDayStatus); tc.resetPage(); }} className={filterSelectCls} aria-label="Daily status">
              <option value="all">All Daily Statuses</option><option value="Incomplete">Incomplete</option><option value="Not started">Not started</option><option value="Complete">Complete</option>
            </select>
            <select value={mealFilter} onChange={e => { setMealFilter(e.target.value); tc.resetPage(); }} className={filterSelectCls} aria-label="Meal status">
              <option value="all">Any Meal Status</option>{MEAL_STATUSES.map(s => <option key={s} value={s}>{`Any meal ${s.toLowerCase()}`}</option>)}
            </select>
            <ResetFiltersButton onClick={resetFilters} active={filtersActive} />
          </>
        }
      />
      <ErrorBanner message={!loading ? error : ''} />

      <TablePanel totalItems={filtered.length} page={tc.page} pageSize={tc.pageSize} onPage={tc.setPage} onPageSize={tc.setPageSize}>
        <table className="w-full text-left text-xs border-collapse min-w-[800px]">
          <thead>
            <tr className={theadRowCls}>
              {isRange && th('date', 'Date')}{th('name', 'Service User')}{MEAL_PERIODS.map(p => th(p, p))}<th className="p-2.5 font-semibold text-left">Notes</th>{th('day', 'Daily status')}<ActionsTh />
            </tr>
          </thead>
          <tbody className={tbodyCls}>
            {loading ? <SkeletonRows cols={colSpan} /> : paged.length === 0 ? (
              <EmptyRow colSpan={colSpan} icon={<ClipboardList className="w-8 h-8" />} title={directory.length === 0 ? 'No Service Users to record meals for' : isRange && !suFilter ? 'No meals recorded in this date range' : 'No Service Users match your filters'} hint={isRange && !suFilter ? 'Pick one Service User to see every day in the range, including days with nothing recorded.' : undefined} />
            ) : paged.map(x => {
              const { r, day } = x;
              return (
                <tr key={x.key} className={`align-middle hover:bg-[#f3f8fd] transition-colors border-l-[3px] ${day === 'Complete' ? 'border-l-emerald-400' : day === 'Incomplete' ? 'border-l-amber-400 bg-amber-50/30' : 'border-l-neutral-200'}`}>
                  {isRange && <td className={`${tdCls} whitespace-nowrap font-semibold text-neutral-700`}>{fmtDate(x.date)}</td>}
                  <td className={tdCls}>
                    <div className="flex items-center gap-2.5">
                      <span className="shrink-0 w-8 h-8 rounded-full bg-teal-50 border border-teal-200 text-[#0f766e] text-[11px] font-bold flex items-center justify-center">{`${r.su.firstName?.[0] || ''}${r.su.lastName?.[0] || ''}`.toUpperCase()}</span>
                      <div className="min-w-0">
                        <div className="font-semibold text-[#242424] truncate">{r.su.firstName} {r.su.lastName}</div>
                        <div className="text-[10px] text-neutral-500 truncate">{r.su.externalReference || r.su.suReference}{r.roomNo ? ` · Room ${r.roomNo}` : ''}</div>
                        <div className="text-[10px] text-neutral-400 truncate">{r.siteName || 'No property'}</div>
                      </div>
                    </div>
                  </td>
                  {MEAL_PERIODS.map(p => {
                    const rec = bySlot.get(slotKey(r.su.id, x.date, p));
                    const status = rec?.status || 'Pending';
                    return (
                      <td key={p} className={`${tdCls} w-[1%] whitespace-nowrap`}>
                        {actor.canEdit ? (
                          <div className="flex items-center gap-1" role="group" aria-label={`${p} for ${r.su.firstName} ${r.su.lastName}`}>
                            <div className="inline-flex rounded-full border border-[#d4d4d4] bg-neutral-100 p-0.5 gap-0.5">
                              <button type="button" title="Accepted" aria-label={`${p} accepted`} aria-pressed={status === 'Accepted'} onClick={() => status !== 'Accepted' && onPick(x, p, 'Accepted')}
                                className={`inline-flex items-center justify-center w-6 h-5 rounded-full transition-colors cursor-pointer ${status === 'Accepted' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:bg-emerald-50 hover:text-emerald-700'}`}>
                                <Check className="w-3 h-3" />
                              </button>
                              <button type="button" title="Declined" aria-label={`${p} declined`} aria-pressed={status === 'Declined'} onClick={() => status !== 'Declined' && onPick(x, p, 'Declined')}
                                className={`inline-flex items-center justify-center w-6 h-5 rounded-full transition-colors cursor-pointer ${status === 'Declined' ? 'bg-rose-600 text-white' : 'text-neutral-400 hover:bg-rose-50 hover:text-rose-700'}`}>
                                <XIcon className="w-3 h-3" />
                              </button>
                            </div>
                            <button type="button" title={rec?.notes ? 'Edit note' : 'Add note'} aria-label={`${rec?.notes ? 'Edit' : 'Add'} note for ${p}`} onClick={() => setEditing({ row: x, period: p })}
                              className={`p-0.5 rounded-xs border cursor-pointer ${rec?.notes ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-[#d4d4d4] text-neutral-400 hover:text-neutral-700'}`}>
                              <NoteIcon className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : <StatusPill status={status} tone={statusTone(status)} />}
                        {status !== 'Pending' && status !== 'Accepted' && status !== 'Declined' && <div className="mt-1"><StatusPill status={status} tone={statusTone(status)} /></div>}
                      </td>
                    );
                  })}
                  <td className={`${tdCls} min-w-[12rem] max-w-[18rem]`}>
                    {MEAL_PERIODS.some(p => noteOf(x, p)) ? (
                      <ul className="space-y-0.5 text-[11px] text-neutral-700">
                        {MEAL_PERIODS.map(p => { const n = noteOf(x, p); return n ? <li key={p}><span className="font-semibold">{p}:</span> {n}</li> : null; })}
                      </ul>
                    ) : <span className="text-neutral-300">—</span>}
                  </td>
                  <td className={tdCls}><StatusPill status={day} tone={day === 'Complete' ? 'good' : day === 'Incomplete' ? 'warn' : 'neutral'} /></td>
                  <td className={actionsTdCls}>
                    <div className="inline-flex items-center gap-0.5">
                      <button type="button" className={iconBtn} title="View" aria-label={`View meals for ${r.su.firstName} ${r.su.lastName}`} onClick={() => setViewing(x)}><Eye className="w-4 h-4" /></button>
                      {actor.canEdit && <button type="button" className={iconBtn} title="Edit all meals" aria-label={`Edit meals for ${r.su.firstName} ${r.su.lastName}`} onClick={() => setEditingDay(x)}><Pencil className="w-4 h-4" /></button>}
                      <button type="button" className={iconBtn} title="History" aria-label={`History for ${r.su.firstName} ${r.su.lastName}`} onClick={() => setHistoryFor(x)}><History className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TablePanel>

      {editing && (
        <NoteDialog row={editing.row} period={editing.period} existing={bySlot.get(slotKey(editing.row.r.su.id, editing.row.date, editing.period))} onClose={() => setEditing(null)}
          onSave={async (status, notes) => { const err = await save(editing.row.r, editing.row.date, editing.period, status, notes); if (!err) setEditing(null); return err; }} />
      )}
      {viewing && <ViewDialog row={viewing} records={MEAL_PERIODS.map(p => bySlot.get(slotKey(viewing.r.su.id, viewing.date, p)))} onClose={() => setViewing(null)} onEdit={actor.canEdit ? () => { setEditingDay(viewing); setViewing(null); } : undefined} />}
      {editingDay && (
        <EditDayDialog row={editingDay} records={MEAL_PERIODS.map(p => bySlot.get(slotKey(editingDay.r.su.id, editingDay.date, p)))} onClose={() => setEditingDay(null)}
          onSave={async changes => {
            for (const c of changes) { const err = await save(editingDay.r, editingDay.date, c.period, c.status, c.notes); if (err) return err; }
            setEditingDay(null); return null;
          }} />
      )}
      {historyFor && <MealHistoryDialog row={historyFor.r} date={historyFor.date} records={MEAL_PERIODS.map(p => bySlot.get(slotKey(historyFor.r.su.id, historyFor.date, p))).filter(Boolean) as MealRecord[]} onClose={() => setHistoryFor(null)} />}
    </div>
  );
};

const choiceCls = (selected: boolean, s: 'Accepted' | 'Declined') =>
  `flex-1 px-3 py-1.5 rounded-xs border text-xs font-semibold cursor-pointer ${selected ? (s === 'Accepted' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-rose-600 border-rose-600 text-white') : 'bg-white border-[#d4d4d4] text-neutral-600'}`;

const NoteDialog: React.FC<{ row: MealRow; period: MealPeriod; existing?: MealRecord; onClose: () => void; onSave: (status: string, notes: string) => Promise<string | null> }> = ({ row, period, existing, onClose, onSave }) => {
  const [status, setStatus] = useState(existing?.status === 'Declined' ? 'Declined' : 'Accepted');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <SuModal title={`${period}: ${row.r.su.firstName} ${row.r.su.lastName} (${fmtDate(row.date)})`} onClose={onClose}>
      <ErrorBanner message={error} />
      <div className="flex gap-2">
        {(['Accepted', 'Declined'] as const).map(s => <button key={s} type="button" onClick={() => setStatus(s)} className={choiceCls(status === s, s)}>{s}</button>)}
      </div>
      <Field label="Note (optional)"><textarea className={inputCls} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything worth recording, e.g. slept late, ate half" autoFocus /></Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={busy} onClick={async () => { setBusy(true); const err = await onSave(status, notes); setBusy(false); if (err) setError(err); }}>{busy ? 'Saving...' : 'Save'}</button>
      </div>
    </SuModal>
  );
};

const ViewDialog: React.FC<{ row: MealRow; records: Array<MealRecord | undefined>; onClose: () => void; onEdit?: () => void }> = ({ row, records, onClose, onEdit }) => (
  <SuModal title={`Meals: ${row.r.su.firstName} ${row.r.su.lastName} (${fmtDate(row.date)})`} onClose={onClose}>
    <div className="text-[11px] text-neutral-500">{row.r.su.externalReference || row.r.su.suReference} · {row.r.siteName || 'No property'}{row.r.roomNo ? ` · Room ${row.r.roomNo}` : ''}</div>
    <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-xs">
      {MEAL_PERIODS.map((p, i) => {
        const rec = records[i];
        const status = rec?.status || 'Pending';
        return (
          <li key={p} className="p-2.5 flex flex-wrap items-start gap-x-3 gap-y-1">
            <span className="w-20 font-semibold text-[#242424]">{p}</span>
            <StatusPill status={status} tone={statusTone(status)} />
            <span className="flex-1 min-w-[10rem] text-neutral-600">{rec?.notes || <span className="text-neutral-300">No note</span>}</span>
            {rec && <span className="text-[10px] text-neutral-400">{rec.updatedBy || rec.recordedBy}{rec.updatedAt || rec.createdAt ? ` · ${fmtDateTime(rec.updatedAt || rec.createdAt)}` : ''}</span>}
          </li>
        );
      })}
    </ul>
    <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
      <button type="button" className={secondaryBtn} onClick={onClose}>Close</button>
      {onEdit && <button type="button" className={primaryBtn} onClick={onEdit}>Edit</button>}
    </div>
  </SuModal>
);

const EditDayDialog: React.FC<{ row: MealRow; records: Array<MealRecord | undefined>; onClose: () => void; onSave: (changes: Array<{ period: MealPeriod; status: string; notes: string }>) => Promise<string | null> }> = ({ row, records, onClose, onSave }) => {
  const [draft, setDraft] = useState(() => MEAL_PERIODS.map((p, i) => ({ period: p, status: records[i]?.status || 'Pending', notes: records[i]?.notes || '' })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (i: number, patch: Partial<{ status: string; notes: string }>) => setDraft(d => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const changed = draft.filter((d, i) => d.status !== (records[i]?.status || 'Pending') || d.notes.trim() !== (records[i]?.notes || '').trim()).filter(d => d.status !== 'Pending');
  return (
    <SuModal title={`Edit meals: ${row.r.su.firstName} ${row.r.su.lastName} (${fmtDate(row.date)})`} onClose={onClose}>
      <ErrorBanner message={error} />
      <div className="space-y-3">
        {draft.map((d, i) => (
          <div key={d.period} className="p-2.5 border border-neutral-200 rounded-xs space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-20 font-semibold text-[#242424]">{d.period}</span>
              <div className="flex gap-1.5 flex-1">
                {(['Accepted', 'Declined'] as const).map(s => <button key={s} type="button" onClick={() => set(i, { status: s })} className={choiceCls(d.status === s, s)}>{s}</button>)}
              </div>
            </div>
            <input className={inputCls} value={d.notes} onChange={e => set(i, { notes: e.target.value })} placeholder="Note (optional)" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={busy || changed.length === 0} onClick={async () => { setBusy(true); const err = await onSave(changed); setBusy(false); if (err) setError(err); }}>{busy ? 'Saving...' : 'Save changes'}</button>
      </div>
    </SuModal>
  );
};

const MealHistoryDialog: React.FC<{ row: SuDirectoryRow; date: string; records: MealRecord[]; onClose: () => void }> = ({ row, date, records, onClose }) => {
  const [entries, setEntries] = useState<MealHistoryEntry[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all(records.map(r => suEnhancementsService.listMealHistory(r.id))).then(results => {
      const failed = results.find(r => !r.success);
      if (failed) setError(failed.error || 'Could not load history.');
      setEntries(results.flatMap(r => (r.success ? r.data : [])).sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt))));
    });
  }, [records]);
  return (
    <SuModal title={`Meal history: ${row.su.firstName} ${row.su.lastName} (${fmtDate(date)})`} onClose={onClose} wide>
      <ErrorBanner message={error} />
      {entries === null ? <p className="text-neutral-500">Loading...</p> : entries.length === 0 ? <p className="text-neutral-500">Nothing has been recorded for this date yet.</p> : (
        <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-xs">
          {entries.map(e => (
            <li key={e.id} className="p-2 flex flex-wrap gap-x-3">
              <span className="font-semibold">{e.mealPeriod}</span><span>{e.fromStatus ? `${e.fromStatus} → ` : ''}{e.toStatus}</span>
              {e.notes && <span className="text-neutral-600">{e.notes}</span>}
              <span className="ml-auto text-neutral-500">{e.changedBy} · {fmtDateTime(e.changedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </SuModal>
  );
};
