import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconHistory as History, IconClipboardList as ClipboardList, IconCheck as Check, IconX as XIcon, IconNote as NoteIcon } from '@tabler/icons-react';
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
import { Field, ErrorBanner, Notice, StatusPill, SuModal, inputCls, primaryBtn, secondaryBtn, useSuActor, fmtDateTime } from '../su/suUi';

const statusTone = (s: string) => (s === 'Accepted' || s === 'Provided' ? 'good' : s === 'Declined' || s === 'Not available' ? 'warn' : 'neutral') as 'good' | 'warn' | 'neutral';

interface MealRow { r: SuDirectoryRow; statuses: Partial<Record<MealPeriod, string>>; day: MealDayStatus }

/**
 * Breakfast, lunch and dinner for every Service User on one date. "Provided" (the meal was given) is kept apart from
 * "Accepted" (it was eaten). A slot with no entry counts as Pending. Corrections keep their history.
 */
export const SuMealTrackerView: React.FC<{ tabSwitcher?: React.ReactNode }> = ({ tabSwitcher }) => {
  const { sites, currentUserName, isSitePermitted, defaultSiteFilter } = useApp();
  const actor = useSuActor();
  const [date, setDate] = useState(todayIso());
  const [directory, setDirectory] = useState<SuDirectoryRow[]>([]);
  const [records, setRecords] = useState<MealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  // Follows the property chosen in the top bar (and the user's permitted properties), like every other tracker
  const [site, setSite] = useState<string>(defaultSiteFilter);
  useEffect(() => { setSite(defaultSiteFilter); }, [defaultSiteFilter]);
  const [dayFilter, setDayFilter] = useState<'all' | MealDayStatus>('all');
  const [mealFilter, setMealFilter] = useState('all');
  const [editing, setEditing] = useState<{ su: SuDirectoryRow; period: MealPeriod } | null>(null);
  const [historyFor, setHistoryFor] = useState<SuDirectoryRow | null>(null);
  const inFlight = useRef(new Set<string>());

  const loadDirectory = useCallback(async () => {
    const dir = await suTrackerService.loadSuDirectory(sites);
    if (!dir.success) { setError(dir.error || 'Could not load Service Users.'); return; }
    setDirectory(dir.data.filter(r => isSitePermitted(r.siteName, 'all')));
  }, [sites, isSitePermitted]);

  const loadMeals = useCallback(async () => {
    setLoading(true); setError('');
    const res = await suEnhancementsService.listMealsForDate(date);
    setLoading(false);
    if (!res.success) { setError(res.error || 'Could not load meal records.'); return; }
    setRecords(res.data);
  }, [date]);

  useEffect(() => { void loadDirectory(); }, [loadDirectory]);
  useEffect(() => { void loadMeals(); }, [loadMeals]);
  const refresh = () => { void loadDirectory(); void loadMeals(); };

  const bySlot = useMemo(() => new Map<string, MealRecord>(records.map(r => [`${r.suId}|${r.mealPeriod}`, r] as [string, MealRecord])), [records]);

  const allRows = useMemo<MealRow[]>(() => directory.map(r => {
    const statuses: Partial<Record<MealPeriod, string>> = {};
    for (const p of MEAL_PERIODS) statuses[p] = bySlot.get(`${r.su.id}|${p}`)?.status;
    return { r, statuses, day: mealDayStatus(statuses) };
  }), [directory, bySlot]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter(x => {
      if (!isSitePermitted(x.r.siteName, site)) return false;
      if (dayFilter !== 'all' && x.day !== dayFilter) return false;
      if (mealFilter !== 'all' && !MEAL_PERIODS.some(p => (x.statuses[p] || 'Pending') === mealFilter)) return false;
      return !q || `${x.r.su.firstName} ${x.r.su.lastName} ${x.r.su.externalReference || ''} ${x.r.su.suReference} ${x.r.roomNo} ${x.r.siteName}`.toLowerCase().includes(q);
    });
  }, [allRows, search, site, dayFilter, mealFilter, isSitePermitted]);

  const tc = useTableControls<MealRow>('room', {
    name: x => `${x.r.su.firstName} ${x.r.su.lastName}`, site: x => x.r.siteName, room: x => `${x.r.siteName} ${x.r.roomNo}`,
    Breakfast: x => x.statuses.Breakfast || 'Pending', Lunch: x => x.statuses.Lunch || 'Pending', Dinner: x => x.statuses.Dinner || 'Pending', day: x => x.day
  });
  const sorted = tc.sortRows(filtered);
  const paged = usePaged(sorted, tc.page, tc.pageSize);

  const totals = useMemo(() => {
    const scoped = allRows.filter(x => isSitePermitted(x.r.siteName, site));
    const meals = scoped.flatMap(x => MEAL_PERIODS.map(p => x.statuses[p]));
    return { accepted: meals.filter(m => m === 'Accepted').length, declined: meals.filter(m => m === 'Declined').length, total: scoped.length, complete: scoped.filter(x => x.day === 'Complete').length, incomplete: scoped.filter(x => x.day === 'Incomplete').length, notStarted: scoped.filter(x => x.day === 'Not started').length };
  }, [allRows, site, isSitePermitted]);

  const filtersActive = !!search || site !== defaultSiteFilter || dayFilter !== 'all' || mealFilter !== 'all';
  const resetFilters = () => { setSearch(''); setSite(defaultSiteFilter); setDayFilter('all'); setMealFilter('all'); tc.resetPage(); };

  const dateLabel = new Date(date).toLocaleDateString('en-GB');
  const exportCols: TrackerExportColumn<MealRow>[] = [
    { id: 'date', label: 'Date', get: () => dateLabel },
    { id: 'name', label: 'Service User', get: x => `${x.r.su.firstName} ${x.r.su.lastName}` },
    { id: 'ref', label: 'Port / SU reference', get: x => x.r.su.externalReference || x.r.su.suReference },
    { id: 'site', label: 'Property', get: x => x.r.siteName },
    { id: 'room', label: 'Room', get: x => x.r.roomNo },
    ...MEAL_PERIODS.flatMap(p => [
      { id: p, label: p, get: (x: MealRow) => x.statuses[p] || 'Pending' },
      { id: `${p}-notes`, label: `${p} notes`, get: (x: MealRow) => bySlot.get(`${x.r.su.id}|${p}`)?.notes, defaultSelected: false }
    ]),
    { id: 'notes', label: 'Notes', get: x => MEAL_PERIODS.map(p => { const n = bySlot.get(`${x.r.su.id}|${p}`)?.notes; return n ? `${p}: ${n}` : ''; }).filter(Boolean).join(' | ') },
    { id: 'day', label: 'Daily status', get: x => x.day }
  ];
  const th = (key: string, label: string) => <SortableTh key={key} label={label} active={tc.sortKey === key} asc={tc.asc} onSort={() => tc.sortBy(key)} />;

  // Marking is optimistic: the tap shows at once and the save runs in the background (no reload, no spinner).
  // If the save fails the slot goes back to what it was and the error banner explains why.
  const recordsRef = useRef<MealRecord[]>([]);
  recordsRef.current = records;
  const queued = useRef(new Map<string, { status: string; notes?: string }>());

  const save = async (su: SuDirectoryRow, period: MealPeriod, status: string, notes?: string): Promise<string | null> => {
    const key = `${su.su.id}|${period}`;
    const previous = recordsRef.current.find(r => r.suId === su.su.id && r.mealPeriod === period) || null;

    // Show the change straight away
    const optimistic: MealRecord = { ...(previous || { id: mealRecordId(su.su.id, date, period), suId: su.su.id, mealDate: date, mealPeriod: period, recordedBy: currentUserName }), status, notes: notes?.trim() ? notes : null, updatedBy: currentUserName };
    setRecords(prev => [...prev.filter(r => !(r.suId === su.su.id && r.mealPeriod === period)), optimistic]);
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
      setRecords(prev => prev.map(r => (r.suId === su.su.id && r.mealPeriod === period ? { ...r, ...res.data, id: res.data?.id || r.id } : r)));
      next = queued.current.get(key);
    }
    inFlight.current.delete(key);
    queued.current.delete(key);
    if (err) {
      // Put the slot back to what the database really holds
      setRecords(prev => {
        const rest = prev.filter(r => !(r.suId === su.su.id && r.mealPeriod === period));
        return previous ? [...rest, previous] : rest;
      });
      return err;
    }
    return null;
  };

  const onPick = async (su: SuDirectoryRow, period: MealPeriod, status: string) => {
    const err = await save(su, period, status, bySlot.get(`${su.su.id}|${period}`)?.notes || undefined);
    if (err) setError(err);
  };

  return (
    <div className="space-y-4">
      <TrackerHeader
        icon={<ClipboardList className="w-5 h-5" />}
        title="Service User Meals"
        tabs={tabSwitcher}
        countLabel={loading || error ? undefined : `${filtered.length} Service Users`}
        description={`Tap Accepted or Declined for each meal on ${dateLabel}. Add a note only if there is something to record.`}
        actions={
          <>
            <RefreshButton onClick={refresh} loading={loading} />
            <TrackerExport<MealRow> moduleName="Service User Meals" filename={`SU_Meals_${date}`} title={`Service User Meals ${dateLabel}`} allRows={allRows} filteredRows={filtered} columns={exportCols} />
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
        notice={date !== todayIso() ? <div className="mt-3"><Notice>You are viewing {dateLabel}. Changes made here are recorded as corrections with their history.</Notice></div> : undefined}
        filtersClassName="flex flex-wrap lg:flex-nowrap items-center gap-2"
        filters={
          <>
            <input type="date" className={filterSelectCls} value={date} max={todayIso()} onChange={e => { if (e.target.value) { setDate(e.target.value); tc.resetPage(); } }} aria-label="Meal date" />
            <SearchBox value={search} onChange={v => { setSearch(v); tc.resetPage(); }} placeholder="Search name, reference, room or property..." />
            <SiteFilterSelect value={site} onChange={v => { setSite(v); tc.resetPage(); }} />
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
        <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
          <thead>
            <tr className={theadRowCls}>
              {th('name', 'Service User')}{MEAL_PERIODS.map(p => th(p, p))}<th className="p-2.5 font-semibold text-left">Notes</th>{th('day', 'Daily status')}<ActionsTh />
            </tr>
          </thead>
          <tbody className={tbodyCls}>
            {loading ? <SkeletonRows cols={7} /> : paged.length === 0 ? (
              <EmptyRow colSpan={7} icon={<ClipboardList className="w-8 h-8" />} title={directory.length === 0 ? 'No Service Users to record meals for' : 'No Service Users match your filters'} />
            ) : paged.map(({ r, day }) => (
              <tr key={r.su.id} className={`align-middle hover:bg-[#f3f8fd] transition-colors border-l-[3px] ${day === 'Complete' ? 'border-l-emerald-400' : day === 'Incomplete' ? 'border-l-amber-400 bg-amber-50/30' : 'border-l-neutral-200'}`}>
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
                  const rec = bySlot.get(`${r.su.id}|${p}`);
                  const status = rec?.status || 'Pending';
                  return (
                    <td key={p} className={`${tdCls} min-w-[10rem]`}>
                      {actor.canEdit ? (
                        <div className="flex items-center gap-1.5" role="group" aria-label={`${p} for ${r.su.firstName} ${r.su.lastName}`}>
                          <div className="inline-flex rounded-xs border border-[#d4d4d4] overflow-hidden divide-x divide-[#d4d4d4]">
                            <button type="button" onClick={() => status !== 'Accepted' && onPick(r, p, 'Accepted')}
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 ${status === 'Accepted' ? 'bg-emerald-600 text-white' : 'bg-white text-neutral-500 hover:bg-emerald-50 hover:text-emerald-700'}`}>
                              <Check className="w-3 h-3" />Accepted
                            </button>
                            <button type="button" onClick={() => status !== 'Declined' && onPick(r, p, 'Declined')}
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 ${status === 'Declined' ? 'bg-rose-600 text-white' : 'bg-white text-neutral-500 hover:bg-rose-50 hover:text-rose-700'}`}>
                              <XIcon className="w-3 h-3" />Declined
                            </button>
                          </div>
                          <button type="button" title={rec?.notes ? 'Edit note' : 'Add note'} aria-label={`${rec?.notes ? 'Edit' : 'Add'} note for ${p}`} onClick={() => setEditing({ su: r, period: p })}
                            className={`p-1 rounded-xs border cursor-pointer ${rec?.notes ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-[#d4d4d4] text-neutral-400 hover:text-neutral-700'}`}>
                            <NoteIcon className="w-3 h-3" />
                          </button>
                        </div>
                      ) : <StatusPill status={status} tone={statusTone(status)} />}
                      {status !== 'Pending' && status !== 'Accepted' && status !== 'Declined' && <div className="mt-1"><StatusPill status={status} tone={statusTone(status)} /></div>}
                    </td>
                  );
                })}
                <td className={`${tdCls} min-w-[12rem] max-w-[18rem]`}>
                  {MEAL_PERIODS.some(p => bySlot.get(`${r.su.id}|${p}`)?.notes) ? (
                    <ul className="space-y-0.5 text-[11px] text-neutral-700">
                      {MEAL_PERIODS.map(p => { const n = bySlot.get(`${r.su.id}|${p}`)?.notes; return n ? <li key={p}><span className="font-semibold">{p}:</span> {n}</li> : null; })}
                    </ul>
                  ) : <span className="text-neutral-300">—</span>}
                </td>
                <td className={tdCls}><StatusPill status={day} tone={day === 'Complete' ? 'good' : day === 'Incomplete' ? 'warn' : 'neutral'} /></td>
                <td className={actionsTdCls}><button type="button" className={secondaryBtn} onClick={() => setHistoryFor(r)}><History className="w-3 h-3 inline mr-1" />History</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      {editing && (
        <NoteDialog row={editing.su} period={editing.period} existing={bySlot.get(`${editing.su.su.id}|${editing.period}`)} onClose={() => setEditing(null)}
          onSave={async (status, notes) => { const err = await save(editing.su, editing.period, status, notes); if (!err) setEditing(null); return err; }} />
      )}
      {historyFor && <MealHistoryDialog row={historyFor} date={date} records={MEAL_PERIODS.map(p => bySlot.get(`${historyFor.su.id}|${p}`)).filter(Boolean) as MealRecord[]} onClose={() => setHistoryFor(null)} />}
    </div>
  );
};

const NoteDialog: React.FC<{ row: SuDirectoryRow; period: MealPeriod; existing?: MealRecord; onClose: () => void; onSave: (status: string, notes: string) => Promise<string | null> }> = ({ row, period, existing, onClose, onSave }) => {
  const [status, setStatus] = useState(existing?.status === 'Declined' ? 'Declined' : 'Accepted');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <SuModal title={`${period}: ${row.su.firstName} ${row.su.lastName}`} onClose={onClose}>
      <ErrorBanner message={error} />
      <div className="flex gap-2">
        {(['Accepted', 'Declined'] as const).map(s => (
          <button key={s} type="button" onClick={() => setStatus(s)}
            className={`flex-1 px-3 py-2 rounded-xs border text-xs font-semibold cursor-pointer ${status === s ? (s === 'Accepted' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-rose-600 border-rose-600 text-white') : 'bg-white border-[#d4d4d4] text-neutral-600'}`}>{s}</button>
        ))}
      </div>
      <Field label="Note (optional)"><textarea className={inputCls} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything worth recording, e.g. slept late, ate half" autoFocus /></Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={busy} onClick={async () => { setBusy(true); const err = await onSave(status, notes); setBusy(false); if (err) setError(err); }}>{busy ? 'Saving...' : 'Save'}</button>
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
    <SuModal title={`Meal history: ${row.su.firstName} ${row.su.lastName} (${new Date(date).toLocaleDateString('en-GB')})`} onClose={onClose} wide>
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
