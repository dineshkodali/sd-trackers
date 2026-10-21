import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, RefreshCw, AlertCircle, Pencil, History, X, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  suTrackerService, type AttendanceRecord, type AbsenceFollowUp, type SuDirectoryRow
} from '../../services/suTrackerService';
import { canEditSuTrackers, canViewAttendanceNotes, formatUkDate } from '../../utils/suTrackerAccess';
import {
  addDays, todayIso, dayCounts, currentAbsenceEpisode, DEFAULT_ABSENCE_POLICY, type AttendanceEntry
} from '../../utils/attendanceLogic';
import { Pagination } from '../common/Pagination';

const inputCls = 'w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]';
const lockedCls = 'w-full px-2.5 py-1.5 bg-neutral-100 border border-[#e5e5e5] rounded-xs text-xs text-neutral-700';
/** How far back records are read; an absence run longer than this would be counted from the start of the window. */
const HISTORY_DAYS = 120;
const policy = DEFAULT_ABSENCE_POLICY;

type Tab = 'records' | 'roll' | 'followups';

const statusBadge = (s?: string) =>
  s === 'Present' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : s === 'Absent' ? 'bg-red-50 text-red-800 border-red-200'
    : 'bg-neutral-100 text-neutral-600 border-neutral-200';

export const SUAttendanceTrackerView: React.FC = () => {
  const { sites, isSitePermitted, currentUserRole, currentUserName } = useApp();
  const canEdit = canEditSuTrackers(currentUserRole);
  const canSeeNotes = canViewAttendanceNotes(currentUserRole);

  const [tab, setTab] = useState<Tab>('roll');
  const [directory, setDirectory] = useState<SuDirectoryRow[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [followUps, setFollowUps] = useState<AbsenceFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const today = todayIso();

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

  const entries: AttendanceEntry[] = useMemo(
    () => records.map(r => ({ suId: r.suId, date: r.attendanceDate, status: r.attendanceStatus, updatedAt: r.updatedAt })),
    [records]
  );
  const byId = useMemo(() => new Map(directory.map(d => [d.su.id, d] as const)), [directory]);

  const summary = useMemo(() => {
    const ids = directory.map(d => d.su.id);
    const counts = dayCounts(ids, entries, today);
    const episodes = ids.map(id => currentAbsenceEpisode(id, entries, today, policy)).filter(Boolean);
    const open = followUps.filter(f => f.status !== 'Resolved');
    return {
      ...counts,
      followUpRequired: open.length,
      threshold3: episodes.filter(e => e!.thresholdsReached.includes(3)).length,
      threshold7: episodes.filter(e => e!.thresholdsReached.includes(7)).length,
      overdue: open.filter(f => f.dueDate && String(f.dueDate).slice(0, 10) < today).length
    };
  }, [directory, entries, followUps, today]);

  const [editFor, setEditFor] = useState<{ suId?: string; date?: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [followUpFor, setFollowUpFor] = useState<AbsenceFollowUp | null>(null);

  const cards: Array<[string, number, string]> = [
    ['Present today', summary.present, 'text-emerald-700'],
    ['Absent today', summary.absent, 'text-red-700'],
    ['Attendance not recorded', summary.notRecorded, 'text-neutral-700'],
    ['Absence follow-up required', summary.followUpRequired, 'text-amber-700'],
    [`${policy.thresholds[0]}-day threshold reached`, summary.threshold3, 'text-amber-700'],
    [`${policy.thresholds[1]}-day threshold reached`, summary.threshold7, 'text-red-700'],
    ['Overdue follow-up actions', summary.overdue, 'text-red-700']
  ];

  const tabBtn = (id: Tab, label: string) => (
    <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
      className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer ${tab === id ? 'border-[#0d9488] text-teal-800' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>{label}</button>
  );

  return (
    <div className="space-y-3.5">
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-[#242424]">SU Attendance Tracker</h1>
            <p className="text-xs text-neutral-500">Daily attendance, absence monitoring and follow-up. A day with no record is “Not recorded”, never an absence.</p>
          </div>
          {canEdit && (
            <button type="button" onClick={() => setEditFor({})} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-2xs cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Record Attendance
            </button>
          )}
        </div>
        {!loading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5 mt-3">
            {cards.map(([label, n, cls]) => (
              <div key={label} className="border border-[#e5e5e5] rounded-xs px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 leading-tight">{label}</div>
                <div className={`text-xl font-bold ${cls}`}>{n}</div>
              </div>
            ))}
          </div>
        )}
        {notice && <div className="mt-3 p-2 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xs">{notice}</div>}
        <p className="text-[10px] text-neutral-400 mt-2">
          Absence thresholds: {policy.thresholds.join(' and ')} consecutive recorded days. Counts use recorded attendance dates only, and are for {formatUkDate(today)}.
        </p>
      </div>

      <div role="tablist" aria-label="Attendance sections" className="flex items-center gap-1 border-b border-[#e5e5e5] bg-white px-2 rounded-xs">
        {tabBtn('roll', 'Daily roll')}{tabBtn('records', 'Attendance records')}{tabBtn('followups', `Absence follow-ups (${summary.followUpRequired})`)}
      </div>

      {error ? (
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-6 text-center">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-xs font-semibold text-red-700">Could not load attendance</p>
          <p className="text-[11px] text-neutral-500 mt-1 max-w-xl mx-auto break-words">{error}</p>
          <button type="button" onClick={load} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#8a8886] rounded-xs text-xs font-semibold bg-white hover:bg-[#f3f2f1] cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /> Retry</button>
        </div>
      ) : loading ? (
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 bg-neutral-100 rounded animate-pulse" />)}</div>
      ) : tab === 'roll' ? (
        <DailyRoll directory={directory} records={records} canEdit={canEdit} user={currentUserName} onChanged={load} onHistory={setHistoryFor} />
      ) : tab === 'records' ? (
        <RecordsTable directory={directory} records={records} canEdit={canEdit} canSeeNotes={canSeeNotes} onEdit={(suId, date) => setEditFor({ suId, date })} onHistory={setHistoryFor} />
      ) : (
        <FollowUpsTable followUps={followUps} byId={byId} canEdit={canEdit} onOpen={setFollowUpFor} />
      )}

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
    </div>
  );
};

/* ------------------------------------------------------------------------------------------------ Daily roll */
const DailyRoll: React.FC<{
  directory: SuDirectoryRow[]; records: AttendanceRecord[]; canEdit: boolean; user: string; onChanged: () => void; onHistory: (id: string) => void;
}> = ({ directory, records, canEdit, user, onChanged, onHistory }) => {
  const [date, setDate] = useState(todayIso());
  const [search, setSearch] = useState('');
  const [room, setRoom] = useState('all');
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const forDay = useMemo(() => new Map(records.filter(r => r.attendanceDate === date).map(r => [r.suId, r] as const)), [records, date]);
  const rooms = useMemo(() => Array.from(new Set(directory.map(d => d.roomNo).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [directory]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return directory
      .filter(d => room === 'all' || d.roomNo === room)
      .filter(d => !q || `${d.su.firstName} ${d.su.lastName} ${d.su.externalReference || ''} ${d.su.suReference} ${d.roomNo}`.toLowerCase().includes(q))
      .sort((a, b) => a.roomNo.localeCompare(b.roomNo, undefined, { numeric: true }) || a.su.lastName.localeCompare(b.su.lastName));
  }, [directory, search, room]);

  const mark = async (suId: string, status: 'Present' | 'Absent') => {
    setSaving(suId); setErr('');
    const res = await suTrackerService.saveAttendance({ suId, date, status, notes: notes[suId] ?? forDay.get(suId)?.additionalNotes ?? '' }, user);
    setSaving(null);
    if (!res.success) setErr(res.error || 'Could not save.'); else onChanged();
  };

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs">
      <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 border-b border-[#e5e5e5]">
        <div><label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Date</label><input type="date" className={inputCls} value={date} max={todayIso()} onChange={e => setDate(e.target.value || todayIso())} /></div>
        <div className="relative self-end"><Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" /><input className={`${inputCls} pl-8`} placeholder="Search resident, room..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Search" /></div>
        <select className={`${inputCls} self-end`} value={room} onChange={e => setRoom(e.target.value)} aria-label="Room"><option value="all">All rooms</option>{rooms.map(r => <option key={r} value={r}>Room {r}</option>)}</select>
      </div>
      {err && <div className="m-3 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs" role="alert">{err}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead><tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold">
            {['Room No', 'Port reference', 'Name', 'Status for ' + formatUkDate(date), 'Notes'].map(h => <th key={h} className="py-2.5 px-3 whitespace-nowrap">{h}</th>)}
            {canEdit && <th className="py-2.5 px-3 text-right">Record</th>}
          </tr></thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {rows.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-neutral-500">No Service Users to show.</td></tr> : rows.map(d => {
              const rec = forDay.get(d.su.id);
              const busy = saving === d.su.id;
              return (
                <tr key={d.su.id} className="hover:bg-[#fbfbfa]">
                  <td className="py-2 px-3">{d.roomNo || <span className="text-neutral-400 italic">Not placed</span>}</td>
                  <td className="py-2 px-3 font-mono text-[11px]">{d.su.externalReference || d.su.suReference}</td>
                  <td className="py-2 px-3 font-medium"><button type="button" className="hover:underline text-left cursor-pointer" onClick={() => onHistory(d.su.id)}>{d.su.firstName} {d.su.lastName}</button></td>
                  <td className="py-2 px-3"><span className={`inline-block px-2 py-0.5 rounded border font-semibold ${statusBadge(rec?.attendanceStatus)}`}>{rec?.attendanceStatus || 'Not recorded'}</span></td>
                  <td className="py-2 px-3 min-w-[180px]">
                    {canEdit ? <input className={inputCls} placeholder="Optional note" value={notes[d.su.id] ?? rec?.additionalNotes ?? ''} onChange={e => setNotes(n => ({ ...n, [d.su.id]: e.target.value }))} aria-label={`Note for ${d.su.firstName} ${d.su.lastName}`} />
                      : <span className="text-neutral-500">{rec?.additionalNotes || ''}</span>}
                  </td>
                  {canEdit && (
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button type="button" disabled={busy} onClick={() => mark(d.su.id, 'Present')} className={`px-2.5 py-1 rounded-xs border font-semibold cursor-pointer disabled:opacity-50 ${rec?.attendanceStatus === 'Present' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'}`}>Present</button>
                      <button type="button" disabled={busy} onClick={() => mark(d.su.id, 'Absent')} className={`ml-1.5 px-2.5 py-1 rounded-xs border font-semibold cursor-pointer disabled:opacity-50 ${rec?.attendanceStatus === 'Absent' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-300 hover:bg-red-50'}`}>Absent</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------------------------------ Records */
const RecordsTable: React.FC<{
  directory: SuDirectoryRow[]; records: AttendanceRecord[]; canEdit: boolean; canSeeNotes: boolean;
  onEdit: (suId: string, date: string) => void; onHistory: (id: string) => void;
}> = ({ directory, records, canEdit, canSeeNotes, onEdit, onHistory }) => {
  const [from, setFrom] = useState(addDays(todayIso(), -30));
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState('all');
  const [room, setRoom] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const byId = useMemo(() => new Map(directory.map(d => [d.su.id, d] as const)), [directory]);
  const rooms = useMemo(() => Array.from(new Set(directory.map(d => d.roomNo).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [directory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records
      .filter(r => byId.has(r.suId))
      .filter(r => (!from || r.attendanceDate >= from) && (!to || r.attendanceDate <= to))
      .filter(r => status === 'all' || r.attendanceStatus === status)
      .filter(r => room === 'all' || byId.get(r.suId)!.roomNo === room)
      .filter(r => { const d = byId.get(r.suId)!; return !q || `${d.su.firstName} ${d.su.lastName} ${d.su.externalReference || ''} ${d.su.suReference}`.toLowerCase().includes(q); })
      .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate) || (byId.get(a.suId)!.su.lastName).localeCompare(byId.get(b.suId)!.su.lastName));
  }, [records, byId, from, to, status, room, search]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const reset = () => setPage(1);

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs">
      <div className="p-3 grid grid-cols-2 lg:grid-cols-5 gap-2.5 border-b border-[#e5e5e5]">
        <div><label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">From</label><input type="date" className={inputCls} value={from} onChange={e => { setFrom(e.target.value); reset(); }} /></div>
        <div><label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">To</label><input type="date" className={inputCls} value={to} onChange={e => { setTo(e.target.value); reset(); }} /></div>
        <select className={`${inputCls} self-end`} value={status} onChange={e => { setStatus(e.target.value); reset(); }} aria-label="Attendance status"><option value="all">All statuses</option><option>Present</option><option>Absent</option></select>
        <select className={`${inputCls} self-end`} value={room} onChange={e => { setRoom(e.target.value); reset(); }} aria-label="Room"><option value="all">All rooms</option>{rooms.map(r => <option key={r} value={r}>Room {r}</option>)}</select>
        <div className="relative self-end"><Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" /><input className={`${inputCls} pl-8`} placeholder="Search resident..." value={search} onChange={e => { setSearch(e.target.value); reset(); }} aria-label="Search" /></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead><tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold">
            {['Port reference', 'Name', 'DOB', 'Room No', 'Date', 'Attendance', 'Additional notes'].map(h => <th key={h} className="py-2.5 px-3 whitespace-nowrap">{h}</th>)}
            <th className="py-2.5 px-3 text-right">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {paged.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-neutral-500">No attendance records match.</td></tr> : paged.map(r => {
              const d = byId.get(r.suId)!;
              return (
                <tr key={r.id} className="hover:bg-[#fbfbfa]">
                  <td className="py-2.5 px-3 font-mono text-[11px]">{d.su.externalReference || d.su.suReference}</td>
                  <td className="py-2.5 px-3 font-medium whitespace-nowrap">{d.su.firstName} {d.su.lastName}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px]">{formatUkDate(d.su.dateOfBirth) || <span className="text-neutral-400 italic font-sans">Not set</span>}</td>
                  <td className="py-2.5 px-3">{d.roomNo || <span className="text-neutral-400 italic">Not placed</span>}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px]">{formatUkDate(r.attendanceDate)}</td>
                  <td className="py-2.5 px-3"><span className={`inline-block px-2 py-0.5 rounded border font-semibold ${statusBadge(r.attendanceStatus)}`}>{r.attendanceStatus}</span></td>
                  <td className="py-2.5 px-3 max-w-[260px]">{canSeeNotes ? (r.additionalNotes || '') : <span className="text-neutral-400 italic">Restricted</span>}</td>
                  <td className="py-2.5 px-3 text-right"><div className="flex justify-end gap-1">
                    <button type="button" title="History" onClick={() => onHistory(r.suId)} className="p-1 text-[#605e5c] hover:bg-[#edebe9] rounded-xs cursor-pointer"><History className="w-3.5 h-3.5" /></button>
                    {canEdit && <button type="button" title="Edit" onClick={() => onEdit(r.suId, r.attendanceDate)} className="p-1 text-[#605e5c] hover:bg-[#edebe9] rounded-xs cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>}
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length > 0 && <Pagination currentPage={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />}
    </div>
  );
};

/* ------------------------------------------------------------------------------------------------ Follow-ups */
const FollowUpsTable: React.FC<{ followUps: AbsenceFollowUp[]; byId: Map<string, SuDirectoryRow>; canEdit: boolean; onOpen: (f: AbsenceFollowUp) => void }> = ({ followUps, byId, onOpen }) => {
  const today = todayIso();
  const [show, setShow] = useState<'open' | 'all'>('open');
  const list = followUps.filter(f => byId.has(f.suId) && (show === 'all' || f.status !== 'Resolved'))
    .sort((a, b) => (b.thresholdDays - a.thresholdDays) || String(b.absenceStartDate).localeCompare(String(a.absenceStartDate)));
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs">
      <div className="p-3 border-b border-[#e5e5e5] flex items-center gap-2">
        <select className={`${inputCls} max-w-[200px]`} value={show} onChange={e => setShow(e.target.value as any)} aria-label="Show"><option value="open">Open and in progress</option><option value="all">All, including resolved</option></select>
        <span className="text-[11px] text-neutral-500">A follow-up is opened automatically when a resident's recorded absence run reaches a threshold.</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead><tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold">
            {['Port reference', 'Name', 'Room No', 'Absent since', 'Days', 'Threshold', 'Status', 'Assigned to', 'Last action'].map(h => <th key={h} className="py-2.5 px-3 whitespace-nowrap">{h}</th>)}
            <th className="py-2.5 px-3 text-right">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {list.length === 0 ? <tr><td colSpan={10} className="py-10 text-center text-neutral-500">No absence follow-ups.</td></tr> : list.map(f => {
              const d = byId.get(f.suId)!;
              const overdue = f.status !== 'Resolved' && f.dueDate && String(f.dueDate).slice(0, 10) < today;
              return (
                <tr key={f.id} className={overdue ? 'bg-red-50/60' : 'hover:bg-[#fbfbfa]'}>
                  <td className="py-2.5 px-3 font-mono text-[11px]">{d.su.externalReference || d.su.suReference}</td>
                  <td className="py-2.5 px-3 font-medium whitespace-nowrap">{d.su.firstName} {d.su.lastName}</td>
                  <td className="py-2.5 px-3">{d.roomNo || '—'}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px]">{formatUkDate(String(f.absenceStartDate).slice(0, 10))}</td>
                  <td className="py-2.5 px-3">{f.consecutiveDays ?? ''}</td>
                  <td className="py-2.5 px-3"><span className={`inline-block px-2 py-0.5 rounded border font-semibold ${f.thresholdDays >= 7 ? 'bg-red-50 text-red-800 border-red-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>{f.thresholdDays} days</span></td>
                  <td className="py-2.5 px-3">{f.status}{overdue && <span className="ml-1.5 text-[9px] font-bold bg-red-100 text-red-800 px-1 py-0.5 rounded">OVERDUE</span>}</td>
                  <td className="py-2.5 px-3">{f.assignedTo || <span className="text-neutral-400 italic">Unassigned</span>}</td>
                  <td className="py-2.5 px-3 text-[11px] text-neutral-500">{f.lastActionAt ? new Date(f.lastActionAt).toLocaleString('en-GB') : '—'}</td>
                  <td className="py-2.5 px-3 text-right"><button type="button" onClick={() => onOpen(f)} className="px-2.5 py-1 border border-[#8a8886] rounded-xs font-semibold bg-white hover:bg-[#f3f2f1] cursor-pointer">Open</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------------------------------ Dialogs */
const Modal: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, subtitle, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label={title}>
    <div className={`bg-white rounded-xs border border-[#e5e5e5] shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col overflow-hidden`}>
      <div className="px-5 py-3.5 border-b border-[#e5e5e5] bg-[#faf9f8] flex items-center justify-between">
        <div><h3 className="font-bold text-sm text-[#242424]">{title}</h3>{subtitle && <p className="text-[11px] text-neutral-500">{subtitle}</p>}</div>
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
  useEffect(() => { setStatus(existing?.attendanceStatus || ''); setNotes(existing?.additionalNotes || ''); setError(''); }, [suId, date, existing?.id, existing?.attendanceStatus, existing?.additionalNotes]);

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
          <input className={`${inputCls} mb-1.5`} placeholder="Search by name, SU ID or port reference..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className={inputCls} value={suId} onChange={e => setSuId(e.target.value)}>
            <option value="">-- Select Service User ({matches.length}) --</option>
            {matches.map(d => <option key={d.su.id} value={d.su.id}>{d.su.firstName} {d.su.lastName} - {d.su.externalReference || d.su.suReference}{d.roomNo ? ` - Room ${d.roomNo}` : ''}</option>)}
          </select>
        </div>
      )}
      {selected && (
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5"><Lock className="w-3 h-3" /> From the Service User profile</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="block text-neutral-600 mb-1">Port reference</label><div className={lockedCls}>{selected.su.externalReference || selected.su.suReference}</div></div>
            <div><label className="block text-neutral-600 mb-1">Name</label><div className={lockedCls}>{selected.su.firstName} {selected.su.lastName}</div></div>
            <div><label className="block text-neutral-600 mb-1">DOB</label><div className={lockedCls}>{formatUkDate(selected.su.dateOfBirth) || '—'}</div></div>
            <div><label className="block text-neutral-600 mb-1">Room No</label><div className={lockedCls}>{selected.roomNo || 'Not placed'}</div></div>
          </div>
        </div>
      )}
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
            {episode.thresholdsReached.length > 0 && <> — threshold reached: <b>{episode.thresholdsReached.join(', ')} days</b></>}
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
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" onClick={onClose} className="px-3.5 py-1.5 border border-[#e5e5e5] rounded-xs text-neutral-700 hover:bg-neutral-100 cursor-pointer">{canEdit ? 'Cancel' : 'Close'}</button>
        {canEdit && <button type="button" onClick={save} disabled={saving} className="px-4 py-1.5 bg-[#0d9488] hover:bg-teal-700 text-white rounded-xs font-semibold disabled:opacity-50 cursor-pointer">{saving ? 'Saving...' : 'Save'}</button>}
      </div>
    </Modal>
  );
};
