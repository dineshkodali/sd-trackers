import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, History, X, Lock, Trash2, CalendarCheck, Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  suTrackerService, type AttendanceRecord, type AbsenceFollowUp, type SuDirectoryRow
} from '../../services/suTrackerService';
import { canEditSuTrackers, canViewAttendanceNotes, formatUkDate } from '../../utils/suTrackerAccess';
import {
  addDays, todayIso, dayCounts, currentAbsenceEpisode, DEFAULT_ABSENCE_POLICY, type AttendanceEntry
} from '../../utils/attendanceLogic';
import { SiteFilterSelect, ResetFiltersButton, TrackerExport, filterInputCls } from '../common/TrackerToolbar';
import {
  TrackerHeader, TabSwitcher, CustomizeTableButton, PrimaryButton, TablePanel, SortableTh, ActionsTh, actionsTdCls, EmptyRow, SkeletonRows,
  theadRowCls, tbodyCls, tdCls, AuditAccountability
} from '../common/TrackerLayout';
import { useTableSchema } from '../../hooks/useTableSchema';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import type { TableColumnConfig } from '../../types/tableSchema';

const inputCls = 'w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]';
const lockedCls = 'w-full px-2.5 py-1.5 bg-neutral-100 border border-[#e5e5e5] rounded-xs text-xs text-neutral-700';
/** How far back records are read; an absence run longer than this would be counted from the start of the window. */
const HISTORY_DAYS = 120;
const policy = DEFAULT_ABSENCE_POLICY;

type Tab = 'roll' | 'records' | 'followups';

const statusBadge = (s?: string) =>
  s === 'Present' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : s === 'Absent' ? 'bg-red-50 text-red-800 border-red-200'
    : 'bg-neutral-100 text-neutral-600 border-neutral-200';

/** Default columns of the attendance records table, in the required order (Customize Table can rename / hide / reorder). */
const ROLL_TABLE_COLUMNS: TableColumnConfig<any>[] = [
  ['room', 'Room No'], ['port', 'Port reference'], ['name', 'Name'], ['status', 'Status'], ['notes', 'Notes']
].map(([key, label]) => ({ key, label, type: 'text' as const }));

const FOLLOWUP_TABLE_COLUMNS: TableColumnConfig<any>[] = [
  ['port', 'Port reference'], ['name', 'Name'], ['room', 'Room No'], ['since', 'Absent since'], ['days', 'Days'], ['threshold', 'Threshold'], ['status', 'Status'], ['assigned', 'Assigned to'], ['last', 'Last action']
].map(([key, label]) => ({ key, label, type: 'text' as const }));

const ATTENDANCE_TABLE_COLUMNS: TableColumnConfig<any>[] = [
  ['port', 'Port reference'], ['name', 'Name'], ['dob', 'DOB'], ['room', 'Room No'], ['date', 'Date'], ['status', 'Attendance'], ['notes', 'Additional notes']
].map(([key, label]) => ({ key, label, type: 'text' as const }));

type RecRow = { r: AttendanceRecord; d: SuDirectoryRow };
const REC_SORT: Record<string, (x: RecRow) => string> = {
  port: x => x.d.su.externalReference || x.d.su.suReference || '',
  name: x => `${x.d.su.firstName} ${x.d.su.lastName}`,
  dob: x => x.d.su.dateOfBirth || '',
  room: x => x.d.roomNo || '',
  date: x => x.r.attendanceDate,
  status: x => x.r.attendanceStatus,
  notes: x => x.r.additionalNotes || ''
};

export const SUAttendanceTrackerView: React.FC = () => {
  const { sites, isSitePermitted, currentUserRole, currentUserName, defaultSiteFilter, canDeleteRecord, requestConfirmation } = useApp();
  const canEdit = canEditSuTrackers(currentUserRole);
  const canSeeNotes = canViewAttendanceNotes(currentUserRole);
  const { columns, visibleColumns, saveColumns, resetToDefault } = useTableSchema<any>('suAttendance', ATTENDANCE_TABLE_COLUMNS);
  const rollSchema = useTableSchema<any>('suAttendanceRoll', ROLL_TABLE_COLUMNS);
  const fuSchema = useTableSchema<any>('suAttendanceFollowups', FOLLOWUP_TABLE_COLUMNS);

  const [tab, setTab] = useState<Tab>('roll');
  const [allDirectory, setDirectory] = useState<SuDirectoryRow[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [followUps, setFollowUps] = useState<AbsenceFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const today = todayIso();

  // Filters (shared where they make sense across the three tabs)
  const [siteFilter, setSiteFilter] = useState<string>(defaultSiteFilter);
  useEffect(() => { setSiteFilter(defaultSiteFilter); }, [defaultSiteFilter]);
  const [search, setSearch] = useState('');
  const [room, setRoom] = useState('all');
  const [rollDate, setRollDate] = useState(todayIso());
  const [rollStatus, setRollStatus] = useState<'all' | 'Present' | 'Absent' | 'Not recorded'>('all');
  const [recFrom, setRecFrom] = useState(addDays(todayIso(), -30));
  const [recTo, setRecTo] = useState(todayIso());
  const [recStatus, setRecStatus] = useState('all');
  const [fuShow, setFuShow] = useState<'open' | 'all'>('open');
  const [sortKey, setSortKey] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editFor, setEditFor] = useState<{ suId?: string; date?: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [followUpFor, setFollowUpFor] = useState<AbsenceFollowUp | null>(null);
  const [isSchemaOpen, setIsSchemaOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [rollNotes, setRollNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [dir, att, fu] = await Promise.all([
      suTrackerService.loadSuDirectory((sites || []).map((s: any) => ({ id: s.id, name: s.name }))),
      suTrackerService.listAttendance({ from: addDays(todayIso(), -HISTORY_DAYS) }),
      suTrackerService.listFollowUps()
    ]);
    if (!dir.success) { setError(dir.error || 'Could not load Service Users.'); setLoading(false); return; }
    if (!att.success) { setError(att.error || 'Could not load attendance.'); setLoading(false); return; }
    if (!fu.success) { setError(fu.error || 'Could not load absence follow-ups.'); setLoading(false); return; }
    const permitted = dir.data.filter(r => isSitePermitted(r.siteName, 'all'));
    const ids = new Set(permitted.map(r => r.su.id));
    const myRecords = att.data.filter(r => ids.has(r.suId));
    let myFollowUps = fu.data.filter(f => ids.has(f.suId));

    // Persist a follow-up for every absence run that has reached a threshold (idempotent: same id each time)
    if (canEdit) {
      const entries: AttendanceEntry[] = myRecords.map(r => ({ suId: r.suId, date: r.attendanceDate, status: r.attendanceStatus, updatedAt: r.updatedAt }));
      const ensured = await suTrackerService.ensureFollowUps(permitted.map(r => r.su.id), entries, myFollowUps, todayIso(), currentUserName, policy);
      if (ensured.success && ensured.data.length > 0) myFollowUps = [...ensured.data, ...myFollowUps];
      else if (!ensured.success) setNotice(`Absence follow-ups could not be updated: ${ensured.error}`);
    }
    setDirectory(permitted); setRecords(myRecords); setFollowUps(myFollowUps);
    setLoading(false);
  }, [sites, isSitePermitted, canEdit, currentUserName]);
  useEffect(() => { load(); }, [load]);

  // Every card, list and form works on the residents of the chosen site(s)
  const directory = useMemo(() => allDirectory.filter(r => isSitePermitted(r.siteName, siteFilter)), [allDirectory, siteFilter, isSitePermitted]);
  const byId = useMemo(() => new Map(directory.map(d => [d.su.id, d] as const)), [directory]);
  const entries: AttendanceEntry[] = useMemo(
    () => records.map(r => ({ suId: r.suId, date: r.attendanceDate, status: r.attendanceStatus, updatedAt: r.updatedAt })),
    [records]
  );
  const rooms = useMemo(() => Array.from(new Set(directory.map(d => d.roomNo).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [directory]);

  const summary = useMemo(() => {
    const ids = directory.map(d => d.su.id);
    const counts = dayCounts(ids, entries, today);
    const episodes = ids.map(id => currentAbsenceEpisode(id, entries, today, policy)).filter(Boolean);
    const open = followUps.filter(f => f.status !== 'Resolved' && byId.has(f.suId));
    return {
      ...counts,
      followUpRequired: open.length,
      threshold3: episodes.filter(e => e!.thresholdsReached.includes(policy.thresholds[0])).length,
      threshold7: episodes.filter(e => e!.thresholdsReached.includes(policy.thresholds[1])).length,
      overdue: open.filter(f => f.dueDate && String(f.dueDate).slice(0, 10) < today).length
    };
  }, [directory, entries, followUps, byId, today]);

  const q = search.trim().toLowerCase();
  const matchesSearch = (d: SuDirectoryRow) => !q || `${d.su.firstName} ${d.su.lastName} ${d.su.externalReference || ''} ${d.su.suReference} ${d.roomNo}`.toLowerCase().includes(q);

  // ---- Daily roll rows
  const forDay = useMemo(() => new Map(records.filter(r => r.attendanceDate === rollDate).map(r => [r.suId, r] as const)), [records, rollDate]);
  const rollRows = useMemo(() => directory
    .filter(d => room === 'all' || d.roomNo === room)
    .filter(d => rollStatus === 'all' || (forDay.get(d.su.id)?.attendanceStatus || 'Not recorded') === rollStatus)
    .filter(matchesSearch)
    .sort((a, b) => a.roomNo.localeCompare(b.roomNo, undefined, { numeric: true }) || a.su.lastName.localeCompare(b.su.lastName)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [directory, room, rollStatus, forDay, q]);

  // ---- Records rows
  const recRows = useMemo<RecRow[]>(() => {
    const val = REC_SORT[sortKey] || REC_SORT.date;
    return records
      .filter(r => byId.has(r.suId))
      .map(r => ({ r, d: byId.get(r.suId)! }))
      .filter(({ r }) => (!recFrom || r.attendanceDate >= recFrom) && (!recTo || r.attendanceDate <= recTo))
      .filter(({ r }) => recStatus === 'all' || r.attendanceStatus === recStatus)
      .filter(({ d }) => room === 'all' || d.roomNo === room)
      .filter(({ d }) => matchesSearch(d))
      .sort((a, b) => val(a).localeCompare(val(b), undefined, { numeric: true, sensitivity: 'base' }) * (sortAsc ? 1 : -1));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, byId, recFrom, recTo, recStatus, room, q, sortKey, sortAsc]);

  // ---- Follow-up rows
  const fuRows = useMemo(() => followUps
    .filter(f => byId.has(f.suId) && (fuShow === 'all' || f.status !== 'Resolved'))
    .filter(f => matchesSearch(byId.get(f.suId)!))
    .sort((a, b) => (b.thresholdDays - a.thresholdDays) || String(b.absenceStartDate).localeCompare(String(a.absenceStartDate))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [followUps, byId, fuShow, q]);

  const total = tab === 'roll' ? rollRows.length : tab === 'records' ? recRows.length : fuRows.length;
  const from = (page - 1) * pageSize;

  const defaultRecFrom = addDays(todayIso(), -30);
  const filtersActive =
    siteFilter !== defaultSiteFilter || !!search || room !== 'all' ||
    (tab === 'roll' && (rollDate !== todayIso() || rollStatus !== 'all')) ||
    (tab === 'records' && (recFrom !== defaultRecFrom || recTo !== todayIso() || recStatus !== 'all')) ||
    (tab === 'followups' && fuShow !== 'open');
  const resetFilters = () => {
    setSiteFilter(defaultSiteFilter); setSearch(''); setRoom('all'); setRollDate(todayIso()); setRollStatus('all');
    setRecFrom(defaultRecFrom); setRecTo(todayIso()); setRecStatus('all'); setFuShow('open'); setPage(1);
  };
  const switchTab = (id: string) => { setTab(id as Tab); setPage(1); };
  const sortBy = (k: string) => { if (k === sortKey) setSortAsc(a => !a); else { setSortKey(k); setSortAsc(true); } setPage(1); };

  const mark = async (suId: string, status: 'Present' | 'Absent') => {
    setSaving(suId);
    const res = await suTrackerService.saveAttendance({ suId, date: rollDate, status, notes: rollNotes[suId] ?? forDay.get(suId)?.additionalNotes ?? '' }, currentUserName);
    setSaving(null);
    if (!res.success) setNotice(res.error || 'Could not save.'); else { setNotice(null); load(); }
  };

  const confirmDelete = (r: AttendanceRecord, name: string) => requestConfirmation({
    title: 'Delete attendance record',
    message: `Delete the attendance record for ${name} on ${formatUkDate(r.attendanceDate)}? It will then show as Not recorded.`,
    confirmLabel: 'Delete record',
    isDanger: true,
    onConfirm: async () => {
      const res = await suTrackerService.deleteAttendance(r.id);
      if (!res.success) setNotice(res.error || 'Could not delete the record.'); else load();
    }
  });

  const recCell = (key: string, { r, d }: RecRow) => {
    switch (key) {
      case 'port': return <span className="font-mono text-[11px]">{d.su.externalReference || d.su.suReference}</span>;
      case 'name': return <span className="font-medium whitespace-nowrap">{d.su.firstName} {d.su.lastName}</span>;
      case 'dob': return d.su.dateOfBirth ? <span className="font-mono text-[11px]">{formatUkDate(d.su.dateOfBirth)}</span> : <span className="text-neutral-400 italic">Not set</span>;
      case 'room': return d.roomNo || <span className="text-neutral-400 italic">Not placed</span>;
      case 'date': return <span className="font-mono text-[11px]">{formatUkDate(r.attendanceDate)}</span>;
      case 'status': return <span className={`inline-block px-2 py-0.5 rounded border font-semibold ${statusBadge(r.attendanceStatus)}`}>{r.attendanceStatus}</span>;
      case 'notes': return <span className="block max-w-[260px]">{canSeeNotes ? (r.additionalNotes || '') : <span className="text-neutral-400 italic">Restricted</span>}</span>;
      default: return '';
    }
  };

  const cards: Array<[string, number, string]> = [
    ['Present today', summary.present, 'text-emerald-700'],
    ['Absent today', summary.absent, 'text-red-700'],
    ['Attendance not recorded', summary.notRecorded, 'text-neutral-700'],
    ['Absence follow-up required', summary.followUpRequired, 'text-amber-700'],
    [`${policy.thresholds[0]}-day threshold reached`, summary.threshold3, 'text-amber-700'],
    [`${policy.thresholds[1]}-day threshold reached`, summary.threshold7, 'text-red-700'],
    ['Overdue follow-up actions', summary.overdue, 'text-red-700']
  ];

  const countLabel = loading || error ? undefined
    : tab === 'roll' ? `${rollRows.length} Residents` : tab === 'records' ? `${recRows.length} Records` : `${fuRows.length} Follow-ups`;

  const recExportCols = [
    { id: 'port', label: 'Port reference', get: (x: RecRow) => x.d.su.externalReference || x.d.su.suReference },
    { id: 'name', label: 'Name', get: (x: RecRow) => `${x.d.su.firstName} ${x.d.su.lastName}` },
    { id: 'dob', label: 'DOB', get: (x: RecRow) => formatUkDate(x.d.su.dateOfBirth) },
    { id: 'room', label: 'Room No', get: (x: RecRow) => x.d.roomNo },
    { id: 'date', label: 'Date', get: (x: RecRow) => formatUkDate(x.r.attendanceDate) },
    { id: 'status', label: 'Attendance', get: (x: RecRow) => x.r.attendanceStatus },
    { id: 'notes', label: 'Additional notes', get: (x: RecRow) => (canSeeNotes ? x.r.additionalNotes : 'Restricted') }
  ];


  const rollCell = (key: string, d: SuDirectoryRow, rec: AttendanceRecord | undefined): React.ReactNode => {
    switch (key) {
      case 'room': return <td className={tdCls}>{d.roomNo || <span className="text-neutral-400 italic">Not placed</span>}</td>;
      case 'port': return <td className={`${tdCls} font-mono text-[11px]`}>{d.su.externalReference || d.su.suReference}</td>;
      case 'name': return <td className={`${tdCls} font-medium`}><button type="button" className="hover:underline text-left cursor-pointer" onClick={() => setHistoryFor(d.su.id)}>{d.su.firstName} {d.su.lastName}</button></td>;
      case 'status': return <td className={tdCls}><span className={`inline-block px-2 py-0.5 rounded border font-semibold ${statusBadge(rec?.attendanceStatus)}`}>{rec?.attendanceStatus || 'Not recorded'}</span></td>;
      case 'notes': return (
        <td className={`${tdCls} min-w-[200px]`}>
          {canEdit && canSeeNotes
            ? <input className={inputCls} placeholder="Optional note" value={rollNotes[d.su.id] ?? rec?.additionalNotes ?? ''} onChange={e => setRollNotes(n => ({ ...n, [d.su.id]: e.target.value }))} aria-label={`Note for ${d.su.firstName} ${d.su.lastName}`} />
            : <span className="text-neutral-500">{canSeeNotes ? rec?.additionalNotes || '' : (rec ? 'Restricted' : '')}</span>}
        </td>
      );
      default: return <td className={tdCls} />;
    }
  };

  const fuCell = (key: string, f: AbsenceFollowUp, d: SuDirectoryRow, overdue: boolean): React.ReactNode => {
    switch (key) {
      case 'port': return <td className={`${tdCls} font-mono text-[11px]`}>{d.su.externalReference || d.su.suReference}</td>;
      case 'name': return <td className={`${tdCls} font-medium whitespace-nowrap`}>{d.su.firstName} {d.su.lastName}</td>;
      case 'room': return <td className={tdCls}>{d.roomNo || '—'}</td>;
      case 'since': return <td className={`${tdCls} font-mono text-[11px]`}>{formatUkDate(String(f.absenceStartDate).slice(0, 10))}</td>;
      case 'days': return <td className={tdCls}>{f.consecutiveDays ?? ''}</td>;
      case 'threshold': return <td className={tdCls}><span className={`inline-block px-2 py-0.5 rounded border font-semibold ${f.thresholdDays >= 7 ? 'bg-red-50 text-red-800 border-red-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>{f.thresholdDays} days</span></td>;
      case 'status': return <td className={tdCls}>{f.status}{overdue && <span className="ml-1.5 text-[9px] font-bold bg-red-100 text-red-800 px-1 py-0.5 rounded">OVERDUE</span>}</td>;
      case 'assigned': return <td className={tdCls}>{f.assignedTo || <span className="text-neutral-400 italic">Unassigned</span>}</td>;
      case 'last': return <td className={`${tdCls} text-[11px] text-neutral-500`}>{f.lastActionAt ? new Date(f.lastActionAt).toLocaleString('en-GB') : '—'}</td>;
      default: return <td className={tdCls} />;
    }
  };

  const dateField = (label: string, value: string, onChange: (v: string) => void, max?: string) => (
    <label className="flex flex-1 min-w-[130px] items-center gap-1 text-[11px] text-neutral-500">
      <span className="whitespace-nowrap">{label}</span>
      <input type="date" className={filterInputCls} value={value} max={max} onChange={e => { onChange(e.target.value); setPage(1); }} aria-label={label} />
    </label>
  );

  return (
    <div className="space-y-4">
      <TrackerHeader
        icon={<CalendarCheck className="w-5 h-5" />}
        title="SU Attendance Tracker"
        countLabel={countLabel}
        description="Daily attendance, absence monitoring and follow-up. A day with no record is “Not recorded”, never an absence."
        actions={
          <>
            {currentUserRole === 'Super Admin' && <CustomizeTableButton onClick={() => setIsSchemaOpen(true)} />}
            {tab === 'records' && (
              <TrackerExport<RecRow>
                moduleName="SU Attendance" filename="SU_Attendance" title="SU Attendance Records"
                allRows={records.filter(r => byId.has(r.suId)).map(r => ({ r, d: byId.get(r.suId)! }))} filteredRows={recRows}
                dateOf={x => x.r.attendanceDate} columns={recExportCols}
              />
            )}
            {canEdit && <PrimaryButton onClick={() => setEditFor({})} label="+ Record Attendance" />}
          </>
        }
        tabs={
          <TabSwitcher label="Attendance sections" active={tab} onChange={switchTab}
            tabs={[{ id: 'roll', label: 'Daily Roll' }, { id: 'records', label: 'Attendance Records' }, { id: 'followups', label: `Absence Follow-ups (${summary.followUpRequired})` }]} />
        }
        summary={!loading && !error ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5 mt-3">
              {cards.map(([label, n, cls]) => (
                <div key={label} className="border border-[#e5e5e5] rounded-xs px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 leading-tight">{label}</div>
                  <div className={`text-xl font-bold ${cls}`}>{n}</div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-neutral-400 mt-2">
              Absence thresholds: {policy.thresholds.join(' and ')} consecutive recorded days. Counts use recorded attendance dates only, and are for {formatUkDate(today)}.
            </p>
          </>
        ) : null}
        notice={notice ? <div className="mt-3 p-2 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xs">{notice}</div> : null}
        filtersClassName="flex flex-wrap lg:flex-nowrap items-center gap-2"
        filters={
          <>
            <div className="relative flex-[2] min-w-[140px]">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search Resident, Port Ref, Room..." className={`${filterInputCls} pl-7`} aria-label="Search" />
            </div>
            <SiteFilterSelect value={siteFilter} onChange={v => { setSiteFilter(v); setPage(1); }} />
            {tab !== 'followups' && (
              <select className={filterInputCls} value={room} onChange={e => { setRoom(e.target.value); setPage(1); }} aria-label="Room">
                <option value="all">All Rooms</option>{rooms.map(r => <option key={r} value={r}>Room {r}</option>)}
              </select>
            )}
            {tab === 'roll' && (
              <>
                {dateField('Date', rollDate, v => setRollDate(v || todayIso()), todayIso())}
                <select className={filterInputCls} value={rollStatus} onChange={e => { setRollStatus(e.target.value as any); setPage(1); }} aria-label="Status">
                  <option value="all">All Statuses</option><option>Present</option><option>Absent</option><option>Not recorded</option>
                </select>
              </>
            )}
            {tab === 'records' && (
              <>
                {dateField('From', recFrom, setRecFrom)}
                {dateField('To', recTo, setRecTo)}
                <select className={filterInputCls} value={recStatus} onChange={e => { setRecStatus(e.target.value); setPage(1); }} aria-label="Attendance status">
                  <option value="all">All Statuses</option><option>Present</option><option>Absent</option>
                </select>
              </>
            )}
            {tab === 'followups' && (
              <select className={filterInputCls} value={fuShow} onChange={e => { setFuShow(e.target.value as any); setPage(1); }} aria-label="Show">
                <option value="open">Open and in progress</option><option value="all">All, including resolved</option>
              </select>
            )}
            <ResetFiltersButton onClick={resetFilters} active={filtersActive} />
          </>
        }
      />

      <TablePanel totalItems={total} page={page} pageSize={pageSize} onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} error={error} onRetry={load} errorTitle="Could not load attendance">
        {tab === 'roll' && (
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead><tr className={theadRowCls}>
              {rollSchema.visibleColumns.map(col => <th key={String(col.key)} className="p-2.5">{col.key === 'status' ? `${col.label} for ${formatUkDate(rollDate)}` : col.label}</th>)}
              {canEdit && <th className="p-2.5 text-right sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Record</th>}
            </tr></thead>
            <tbody className={tbodyCls}>
              {loading ? <SkeletonRows cols={rollSchema.visibleColumns.length + (canEdit ? 1 : 0)} /> : rollRows.length === 0 ? (
                <EmptyRow colSpan={rollSchema.visibleColumns.length + 1} icon={<CalendarCheck className="w-8 h-8" />} title="No Service Users to show" hint="Change the site or filters to see residents." />
              ) : rollRows.slice(from, from + pageSize).map(d => {
                const rec = forDay.get(d.su.id);
                const busy = saving === d.su.id;
                return (
                  <tr key={d.su.id} className="hover:bg-[#f3f8fd] transition-colors">
                    {rollSchema.visibleColumns.map(col => <React.Fragment key={String(col.key)}>{rollCell(String(col.key), d, rec)}</React.Fragment>)}
                    {canEdit && (
                      <td className={actionsTdCls}>
                        <button type="button" disabled={busy} onClick={() => mark(d.su.id, 'Present')} className={`px-2.5 py-1 rounded-xs border font-semibold cursor-pointer disabled:opacity-50 ${rec?.attendanceStatus === 'Present' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'}`}>Present</button>
                        <button type="button" disabled={busy} onClick={() => mark(d.su.id, 'Absent')} className={`ml-1.5 px-2.5 py-1 rounded-xs border font-semibold cursor-pointer disabled:opacity-50 ${rec?.attendanceStatus === 'Absent' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-300 hover:bg-red-50'}`}>Absent</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === 'records' && (
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead><tr className={theadRowCls}>
              {visibleColumns.map(col => <SortableTh key={String(col.key)} label={col.label} active={sortKey === col.key} asc={sortAsc} onSort={() => sortBy(String(col.key))} />)}
              <ActionsTh />
            </tr></thead>
            <tbody className={tbodyCls}>
              {loading ? <SkeletonRows cols={visibleColumns.length + 1} /> : recRows.length === 0 ? (
                <EmptyRow colSpan={visibleColumns.length + 1} icon={<CalendarCheck className="w-8 h-8" />} title="No attendance records found" hint="Use the Daily Roll or '+ Record Attendance' to record attendance." />
              ) : recRows.slice(from, from + pageSize).map(x => (
                <tr key={x.r.id} className="hover:bg-[#f3f8fd] transition-colors">
                  {visibleColumns.map(col => <td key={String(col.key)} className={tdCls}>{recCell(String(col.key), x)}</td>)}
                  <td className={actionsTdCls}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" title="Attendance history" onClick={() => setHistoryFor(x.r.suId)} className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs transition-colors cursor-pointer"><History className="w-3.5 h-3.5" /></button>
                      {canEdit && <button type="button" title="Edit" onClick={() => setEditFor({ suId: x.r.suId, date: x.r.attendanceDate })} className="p-1 hover:bg-[#f0fdfa] text-[#0d9488] rounded-xs transition-colors cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>}
                      {canDeleteRecord() && <button type="button" title="Delete" onClick={() => confirmDelete(x.r, `${x.d.su.firstName} ${x.d.su.lastName}`)} className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'followups' && (
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
            <thead><tr className={theadRowCls}>
              {fuSchema.visibleColumns.map(col => <th key={String(col.key)} className="p-2.5">{col.label}</th>)}
              <ActionsTh />
            </tr></thead>
            <tbody className={tbodyCls}>
              {loading ? <SkeletonRows cols={fuSchema.visibleColumns.length + 1} /> : fuRows.length === 0 ? (
                <EmptyRow colSpan={fuSchema.visibleColumns.length + 1} icon={<CalendarCheck className="w-8 h-8" />} title="No absence follow-ups" hint="A follow-up opens automatically when a resident's recorded absence reaches a threshold." />
              ) : fuRows.slice(from, from + pageSize).map(f => {
                const d = byId.get(f.suId)!;
                const overdue = f.status !== 'Resolved' && f.dueDate && String(f.dueDate).slice(0, 10) < today;
                return (
                  <tr key={f.id} className={overdue ? 'bg-red-50/60' : 'hover:bg-[#f3f8fd] transition-colors'}>
                    {fuSchema.visibleColumns.map(col => <React.Fragment key={String(col.key)}>{fuCell(String(col.key), f, d, !!overdue)}</React.Fragment>)}
                    <td className={actionsTdCls}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" title="Open follow-up" onClick={() => setFollowUpFor(f)} className="p-1 hover:bg-[#f0fdfa] text-[#0d9488] rounded-xs transition-colors cursor-pointer"><Eye className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </TablePanel>

      {editFor && (
        <AttendanceForm directory={directory} records={records} initial={editFor} user={currentUserName} canSeeNotes={canSeeNotes}
          onClose={() => setEditFor(null)} onSaved={() => { setEditFor(null); load(); }} />
      )}
      {historyFor && byId.get(historyFor) && (
        <HistoryDialog row={byId.get(historyFor)!} records={records.filter(r => r.suId === historyFor)} entries={entries} canSeeNotes={canSeeNotes} onClose={() => setHistoryFor(null)} />
      )}
      {followUpFor && (
        <FollowUpDialog followUp={followUpFor} row={byId.get(followUpFor.suId)} user={currentUserName} canEdit={canEdit}
          onClose={() => setFollowUpFor(null)} onSaved={() => { setFollowUpFor(null); load(); }} />
      )}

      <TableSchemaEditorModal<any>
        isOpen={isSchemaOpen}
        onClose={() => setIsSchemaOpen(false)}
        moduleTitle={tab === 'roll' ? 'SU Attendance Daily Roll' : tab === 'followups' ? 'SU Absence Follow-ups' : 'SU Attendance Records'}
        columns={tab === 'roll' ? rollSchema.columns : tab === 'followups' ? fuSchema.columns : columns}
        onSaveColumns={tab === 'roll' ? rollSchema.saveColumns : tab === 'followups' ? fuSchema.saveColumns : saveColumns}
        onResetToDefault={tab === 'roll' ? rollSchema.resetToDefault : tab === 'followups' ? fuSchema.resetToDefault : resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};

/* ------------------------------------------------------------------------------------------------ Dialogs */
const Modal: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, subtitle, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label={title}>
    <div className={`bg-white rounded-xs border border-[#e5e5e5] shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col overflow-hidden`}>
      <div className="px-5 py-3.5 border-b border-[#e5e5e5] bg-[#faf9f8] flex items-center justify-between">
        <div><h3 className="font-bold text-sm text-[#242424]">{title}</h3></div>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-5 space-y-3.5 overflow-y-auto text-xs">{children}</div>
    </div>
  </div>
);

const AttendanceForm: React.FC<{
  directory: SuDirectoryRow[]; records: AttendanceRecord[]; initial: { suId?: string; date?: string }; user: string; canSeeNotes: boolean;
  onClose: () => void; onSaved: () => void;
}> = ({ directory, records, initial, user, canSeeNotes, onClose, onSaved }) => {
  const [suId, setSuId] = useState(initial.suId || '');
  const [date, setDate] = useState(initial.date || todayIso());
  const [status, setStatus] = useState<'Present' | 'Absent' | ''>('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selected = directory.find(d => d.su.id === suId);
  const existing = records.find(r => r.suId === suId && r.attendanceDate === date);

  // Picking another resident or date loads that day's existing record (or clears the form): nothing carries over
  // A day that already has a record loads it; otherwise what was typed so far is kept (the form is open from the start)
  const hadRecord = React.useRef(false);
  useEffect(() => {
    setError('');
    if (existing) { setStatus(existing.attendanceStatus); setNotes(existing.additionalNotes || ''); hadRecord.current = true; }
    else if (hadRecord.current) { setStatus(''); setNotes(''); hadRecord.current = false; }
  }, [suId, date, existing?.id, existing?.attendanceStatus, existing?.additionalNotes]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (q ? directory.filter(d => `${d.su.firstName} ${d.su.lastName} ${d.su.suReference} ${d.su.externalReference || ''}`.toLowerCase().includes(q)) : directory).slice(0, 200);
  }, [directory, search]);

  const save = async () => {
    setError('');
    if (!suId) { setError('Choose a Service User.'); return; }
    if (!status) { setError('Choose Present or Absent.'); return; }
    setSaving(true);
    const res = await suTrackerService.saveAttendance({ suId, date, status, notes }, user);
    setSaving(false);
    if (!res.success) setError(res.error || 'Could not save.'); else onSaved();
  };

  return (
    <Modal title={existing ? 'Edit Attendance' : 'Record Attendance'} subtitle="One record per resident per day. Saving the same day again updates it." onClose={onClose}>
      {error && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xs" role="alert">{error}</div>}
      {!initial.suId && (
        <div>
          <label className="block text-neutral-600 font-medium mb-1">Service User <span className="text-red-500">*</span></label>
          <select className={inputCls} value={suId} onChange={e => setSuId(e.target.value)}>
            <option value="">Select Service User...</option>
            {matches.map(d => <option key={d.su.id} value={d.su.id}>{d.su.firstName} {d.su.lastName} - {d.su.externalReference || d.su.suReference}{d.roomNo ? ` - Room ${d.roomNo}` : ''}</option>)}
          </select>
        </div>
      )}
      <div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5"><Lock className="w-3 h-3" /> From the Service User profile</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="block text-neutral-600 mb-1">Port reference</label><div className={lockedCls}>{selected?.su.externalReference || selected?.su.suReference}</div></div>
            <div><label className="block text-neutral-600 mb-1">Name</label><div className={lockedCls}>{selected?.su.firstName} {selected?.su.lastName}</div></div>
            <div><label className="block text-neutral-600 mb-1">DOB</label><div className={lockedCls}>{formatUkDate(selected?.su.dateOfBirth) || '—'}</div></div>
            <div><label className="block text-neutral-600 mb-1">Room No</label><div className={lockedCls}>{selected?.roomNo || 'Not placed'}</div></div>
          </div>
        </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-neutral-600 mb-1">Date <span className="text-red-500">*</span></label><input type="date" className={inputCls} value={date} max={todayIso()} onChange={e => setDate(e.target.value)} /></div>
        <div><label className="block text-neutral-600 mb-1">Attendance <span className="text-red-500">*</span></label>
          <select className={inputCls} value={status} onChange={e => setStatus(e.target.value as any)}><option value="">-- Select --</option><option>Present</option><option>Absent</option></select>
          {!existing && suId && <p className="text-[10px] text-neutral-500 mt-1">Not recorded yet for this date.</p>}
        </div>
      </div>
      <div><label className="block text-neutral-600 mb-1">Additional notes</label>
        {canSeeNotes ? <textarea className={inputCls} rows={3} value={notes} onChange={e => setNotes(e.target.value)} /> : <div className={lockedCls}>Restricted</div>}
      </div>
      <AuditAccountability userName={user} createdBy={existing?.recordedBy} updatedBy={existing?.updatedBy} updatedAt={existing?.updatedAt} />
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" onClick={onClose} className="px-3.5 py-1.5 border border-[#e5e5e5] rounded-xs text-neutral-700 hover:bg-neutral-100 cursor-pointer">Cancel</button>
        <button type="button" onClick={save} disabled={saving} className="px-4 py-1.5 bg-[#0d9488] hover:bg-teal-700 text-white rounded-xs font-semibold disabled:opacity-50 cursor-pointer">{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </Modal>
  );
};

const HistoryDialog: React.FC<{ row: SuDirectoryRow; records: AttendanceRecord[]; entries: AttendanceEntry[]; canSeeNotes: boolean; onClose: () => void }> = ({ row, records, entries, canSeeNotes, onClose }) => {
  const episode = currentAbsenceEpisode(row.su.id, entries, todayIso(), policy);
  const sorted = [...records].sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate));
  return (
    <Modal title={`Attendance history - ${row.su.firstName} ${row.su.lastName}`} subtitle={`${row.su.externalReference || row.su.suReference} · ${row.roomNo ? `Room ${row.roomNo}` : 'Not placed'}`} onClose={onClose} wide>
      <div className={`p-3 rounded-xs border ${episode ? 'bg-amber-50 border-amber-200' : 'bg-neutral-50 border-[#e5e5e5]'}`}>
        {episode ? (
          <>
            <b>{episode.days}</b> consecutive recorded absent day{episode.days === 1 ? '' : 's'} since <b>{formatUkDate(episode.startDate)}</b>
            {episode.thresholdsReached.length > 0 && <>, threshold reached: <b>{episode.thresholdsReached.join(', ')} days</b></>}
            {episode.nextThreshold && <> (next: {episode.nextThreshold} days)</>}
            {!episode.isCurrent && <div className="text-[11px] text-neutral-600 mt-1">Days after {formatUkDate(episode.endDate)} are not recorded, so the run is not confirmed beyond that date.</div>}
          </>
        ) : 'No current run of recorded absences.'}
        {episode?.lastPresentDate && <div className="text-[11px] text-neutral-600 mt-1">Last recorded present: {formatUkDate(episode.lastPresentDate)}</div>}
      </div>
      <table className="w-full text-left border-collapse">
        <thead><tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold"><th className="py-2 px-3">Date</th><th className="py-2 px-3">Attendance</th><th className="py-2 px-3">Notes</th><th className="py-2 px-3">Recorded by</th></tr></thead>
        <tbody className="divide-y divide-[#f0f0f0]">
          {sorted.length === 0 ? <tr><td colSpan={4} className="py-6 text-center text-neutral-500">No attendance recorded.</td></tr> : sorted.map(r => (
            <tr key={r.id}><td className="py-2 px-3 font-mono text-[11px]">{formatUkDate(r.attendanceDate)}</td>
              <td className="py-2 px-3"><span className={`inline-block px-2 py-0.5 rounded border font-semibold ${statusBadge(r.attendanceStatus)}`}>{r.attendanceStatus}</span></td>
              <td className="py-2 px-3">{canSeeNotes ? r.additionalNotes : <span className="text-neutral-400 italic">Restricted</span>}</td>
              <td className="py-2 px-3 text-neutral-500">{r.updatedBy || r.recordedBy}</td></tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
};

const FollowUpDialog: React.FC<{ followUp: AbsenceFollowUp; row?: SuDirectoryRow; user: string; canEdit: boolean; onClose: () => void; onSaved: () => void }> = ({ followUp, row, user, canEdit, onClose, onSaved }) => {
  const [status, setStatus] = useState(followUp.status);
  const [assignedTo, setAssignedTo] = useState(followUp.assignedTo || '');
  const [dueDate, setDueDate] = useState(String(followUp.dueDate || '').slice(0, 10));
  const [action, setAction] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setError('');
    if (status === 'Resolved' && !action.trim() && !followUp.followUpNotes && (followUp.actionHistory || []).filter(h => h.by !== 'System').length === 0) {
      setError('Record the action taken before resolving this follow-up.'); return;
    }
    setSaving(true);
    const res = await suTrackerService.updateFollowUp(followUp, { status, assignedTo, dueDate: dueDate || undefined, action }, user);
    setSaving(false);
    if (!res.success) setError(res.error || 'Could not save.'); else onSaved();
  };
  return (
    <Modal title={`Absence follow-up - ${row ? `${row.su.firstName} ${row.su.lastName}` : followUp.suId}`} subtitle={`${followUp.thresholdDays}-day threshold · absent since ${formatUkDate(String(followUp.absenceStartDate).slice(0, 10))}`} onClose={onClose} wide>
      {error && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xs" role="alert">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div><label className="block text-neutral-600 mb-1">Status</label><select className={inputCls} value={status} disabled={!canEdit} onChange={e => setStatus(e.target.value as any)}><option>Open</option><option>In Progress</option><option>Resolved</option></select></div>
        <div><label className="block text-neutral-600 mb-1">Responsible staff member</label><input className={inputCls} value={assignedTo} disabled={!canEdit} onChange={e => setAssignedTo(e.target.value)} /></div>
        <div><label className="block text-neutral-600 mb-1">Follow-up due</label><input type="date" className={inputCls} value={dueDate} disabled={!canEdit} onChange={e => setDueDate(e.target.value)} /></div>
      </div>
      {canEdit && <div><label className="block text-neutral-600 mb-1">Action taken / note</label><textarea className={inputCls} rows={3} value={action} onChange={e => setAction(e.target.value)} placeholder="What was done (calls, visits, referrals, contacts)..." /></div>}
      <div>
        <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Activity</div>
        <ul className="border border-[#e5e5e5] rounded-xs divide-y divide-[#f0f0f0] max-h-48 overflow-y-auto">
          {[...(followUp.actionHistory || [])].reverse().map((h, i) => (
            <li key={i} className="px-3 py-1.5"><div className="text-neutral-800">{h.action}</div><div className="text-[10px] text-neutral-500">{h.by} · {new Date(h.at).toLocaleString('en-GB')}</div></li>
          ))}
        </ul>
        {followUp.resolvedAt && <p className="text-[11px] text-neutral-500 mt-1">Resolved {new Date(followUp.resolvedAt).toLocaleString('en-GB')}</p>}
      </div>
      <AuditAccountability userName={user} createdBy={followUp.createdBy} updatedBy={followUp.updatedBy} updatedAt={followUp.updatedAt} />
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" onClick={onClose} className="px-3.5 py-1.5 border border-[#e5e5e5] rounded-xs text-neutral-700 hover:bg-neutral-100 cursor-pointer">{canEdit ? 'Cancel' : 'Close'}</button>
        {canEdit && <button type="button" onClick={save} disabled={saving} className="px-4 py-1.5 bg-[#0d9488] hover:bg-teal-700 text-white rounded-xs font-semibold disabled:opacity-50 cursor-pointer">{saving ? 'Saving...' : 'Save'}</button>}
      </div>
    </Modal>
  );
};
