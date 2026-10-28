import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { History, ClipboardList } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suTrackerService, type SuDirectoryRow } from '../../services/suTrackerService';
import { suEnhancementsService, type MealRecord, type MealHistoryEntry } from '../../services/suEnhancementsService';
import { MEAL_PERIODS, MEAL_STATUSES, MEAL_NOTE_STATUSES, mealDayStatus, type MealPeriod, type MealDayStatus } from '../../utils/suEnhancementsLogic';
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
  const [savingKey, setSavingKey] = useState('');
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
    return { total: scoped.length, complete: scoped.filter(x => x.day === 'Complete').length, incomplete: scoped.filter(x => x.day === 'Incomplete').length, notStarted: scoped.filter(x => x.day === 'Not started').length };
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
    { id: 'day', label: 'Daily status', get: x => x.day }
  ];
  const th = (key: string, label: string) => <SortableTh key={key} label={label} active={tc.sortKey === key} asc={tc.asc} onSort={() => tc.sortBy(key)} />;

  const save = async (su: SuDirectoryRow, period: MealPeriod, status: string, notes?: string): Promise<string | null> => {
    const key = `${su.su.id}|${period}`;
    if (inFlight.current.has(key)) return null;            // ignore a second change while this slot is saving
    inFlight.current.add(key); setSavingKey(key); setError('');
    const res = await suEnhancementsService.saveMeal({ suId: su.su.id, mealDate: date, mealPeriod: period, status, notes, existing: bySlot.get(key) || null }, currentUserName);
    inFlight.current.delete(key); setSavingKey('');
    if (!res.success) return res.error || 'Could not save.';
    await loadMeals();
    return null;
  };

  const onPick = async (su: SuDirectoryRow, period: MealPeriod, status: string) => {
    if (MEAL_NOTE_STATUSES.includes(status)) { setEditing({ su, period }); return; }
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
        description={`Breakfast, lunch and dinner for ${dateLabel}. "Provided" means the meal was given; "Accepted" means it was eaten.`}
        actions={
          <>
            <RefreshButton onClick={refresh} loading={loading} />
            <TrackerExport<MealRow> moduleName="Service User Meals" filename={`SU_Meals_${date}`} title={`Service User Meals ${dateLabel}`} allRows={allRows} filteredRows={filtered} columns={exportCols} />
          </>
        }
        summary={
          <div className="flex items-center gap-1.5 text-xs mt-3 flex-wrap">
            <StatusPill status={`${totals.complete} of ${totals.total} complete`} tone={totals.total > 0 && totals.complete === totals.total ? 'good' : 'neutral'} />
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
        <table className="w-full text-left text-xs border-collapse min-w-[900px]">
          <thead>
            <tr className={theadRowCls}>
              {th('name', 'Service User')}{MEAL_PERIODS.map(p => th(p, p))}{th('day', 'Daily status')}<ActionsTh />
            </tr>
          </thead>
          <tbody className={tbodyCls}>
            {loading ? <SkeletonRows cols={6} /> : paged.length === 0 ? (
              <EmptyRow colSpan={6} icon={<ClipboardList className="w-8 h-8" />} title={directory.length === 0 ? 'No Service Users to record meals for' : 'No Service Users match your filters'} />
            ) : paged.map(({ r, day }) => (
              <tr key={r.su.id} className={`align-top hover:bg-[#f3f8fd] transition-colors ${day === 'Complete' ? '' : 'bg-amber-50/40'}`}>
                <td className={tdCls}>{r.su.firstName} {r.su.lastName}<div className="text-[10px] text-neutral-500">{r.su.externalReference || r.su.suReference} · {r.siteName || 'No property'}{r.roomNo ? ` · Room ${r.roomNo}` : ''}</div></td>
                {MEAL_PERIODS.map(p => {
                  const rec = bySlot.get(`${r.su.id}|${p}`);
                  const status = rec?.status || 'Pending';
                  return (
                    <td key={p} className={`${tdCls} min-w-[9rem]`}>
                      {actor.canEdit ? (
                        <select className={inputCls} value={status} disabled={savingKey === `${r.su.id}|${p}`} aria-label={`${p} for ${r.su.firstName} ${r.su.lastName}`} onChange={e => onPick(r, p, e.target.value)}>
                          {MEAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : <StatusPill status={status} tone={statusTone(status)} />}
                      {rec?.notes && <div className="mt-1 text-[10px] text-neutral-600" title={rec.notes}>{rec.notes.length > 40 ? `${rec.notes.slice(0, 40)}…` : rec.notes}</div>}
                      {rec && <div className="mt-0.5 text-[10px] text-neutral-400">{rec.updatedBy || rec.recordedBy}</div>}
                    </td>
                  );
                })}
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
  const [status, setStatus] = useState(existing && MEAL_NOTE_STATUSES.includes(existing.status) ? existing.status : 'Declined');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <SuModal title={`${period}: ${row.su.firstName} ${row.su.lastName}`} onClose={onClose}>
      <ErrorBanner message={error} />
      <Field label="Status" required><select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>{MEAL_NOTE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
      <Field label="Note (what happened, any follow-up needed)" required><textarea className={inputCls} rows={3} value={notes} onChange={e => setNotes(e.target.value)} autoFocus /></Field>
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
