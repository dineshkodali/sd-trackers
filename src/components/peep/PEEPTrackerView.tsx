import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Pencil, Eye, X, Lock, ClipboardCheck, History, Archive, Accessibility } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  suTrackerService, PEEP_RISK_LEVELS, PEEP_COMPANIONS, PEEP_ALARMS, PEEP_ASSISTANCE,
  type PeepPlan, type PeepHistoryEntry, type SuDirectoryRow
} from '../../services/suTrackerService';
import { canEditSuTrackers, formatUkDate } from '../../utils/suTrackerAccess';
import { addDays, todayIso } from '../../utils/attendanceLogic';
import { SiteFilterSelect, ResetFiltersButton, TrackerExport, filterInputCls } from '../common/TrackerToolbar';
import {
  TrackerHeader, CustomizeTableButton, PrimaryButton, TablePanel, SortableTh, ActionsTh, actionsTdCls, EmptyRow, SkeletonRows,
  theadRowCls, tbodyCls, tdCls, AuditAccountability
} from '../common/TrackerLayout';
import { useTableSchema } from '../../hooks/useTableSchema';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import type { TableColumnConfig } from '../../types/tableSchema';

const inputCls = 'w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]';
const lockedCls = 'w-full px-2.5 py-1.5 bg-neutral-100 border border-[#e5e5e5] rounded-xs text-xs text-neutral-700';
const REVIEW_WARNING_DAYS = 30;

type ReviewStatus = 'overdue' | 'due-soon' | 'current' | 'none';
export function reviewStatusOf(reviewDate: string | undefined, today = todayIso()): ReviewStatus {
  if (!reviewDate) return 'none';
  if (reviewDate < today) return 'overdue';
  return reviewDate <= addDays(today, REVIEW_WARNING_DAYS) ? 'due-soon' : 'current';
}

const riskBadge: Record<string, string> = {
  Low: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-800 border-amber-200',
  High: 'bg-red-50 text-red-800 border-red-200'
};

type PeepRow = { plan: PeepPlan; d: SuDirectoryRow };

/** Default columns, in the required order. Super Admin can rename, hide or reorder them with Customize Table. */
const PEEP_TABLE_COLUMNS: TableColumnConfig<any>[] = [
  ['port', 'Port reference'], ['name', 'Name'], ['dob', 'DOB'], ['room', 'Room No'], ['mobility', 'Mobility type'], ['risk', 'PEEP risk level'],
  ['companion', 'Companion'], ['alarm', 'Emergency Alarm'], ['assistance', 'Assistance'], ['evac', 'Evacuation procedure'],
  ['exit', 'Safe exit routes'], ['dev', 'Developed by'], ['date', 'Date'], ['review', 'Review date']
].map(([key, label]) => ({ key, label, type: 'text' as const }));

const SORT_VALUE: Record<string, (x: PeepRow) => string> = {
  port: x => x.d.su.externalReference || x.d.su.suReference || '',
  name: x => `${x.d.su.firstName} ${x.d.su.lastName}`,
  dob: x => x.d.su.dateOfBirth || '',
  room: x => x.d.roomNo || '',
  mobility: x => x.plan.mobilityType || '',
  risk: x => ({ High: '1', Medium: '2', Low: '3' } as Record<string, string>)[x.plan.riskLevel] || '9',
  companion: x => x.plan.companion || '',
  alarm: x => x.plan.emergencyAlarm || '',
  assistance: x => x.plan.assistance || '',
  evac: x => x.plan.evacuationProcedure || '',
  exit: x => x.plan.safeExitRoutes || '',
  dev: x => x.plan.developedBy || '',
  date: x => x.plan.planDate || '',
  review: x => x.plan.reviewDate || '9999-12-31'
};
const sortValue = (x: PeepRow, k: string) => (SORT_VALUE[k] || SORT_VALUE.review)(x);

const clip = (s?: string, n = 60) => (s && s.length > n ? `${s.slice(0, n)}…` : s || '');

export const PEEPTrackerView: React.FC = () => {
  const { sites, isSitePermitted, currentUserRole, currentUserName, defaultSiteFilter, requestConfirmation } = useApp();
  const canEdit = canEditSuTrackers(currentUserRole);
  const { columns, visibleColumns, saveColumns, resetToDefault } = useTableSchema<any>('peepTracker', PEEP_TABLE_COLUMNS);

  const [directory, setDirectory] = useState<SuDirectoryRow[]>([]);
  const [plans, setPlans] = useState<PeepPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | ReviewStatus>('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState<string>(defaultSiteFilter);
  useEffect(() => { setSiteFilter(defaultSiteFilter); }, [defaultSiteFilter]);
  const [sortKey, setSortKey] = useState('review');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialog, setDialog] = useState<{ mode: 'view' | 'edit' | 'create' | 'review'; suId?: string } | null>(null);
  const [isSchemaOpen, setIsSchemaOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [dir, pl] = await Promise.all([
      suTrackerService.loadSuDirectory((sites || []).map((s: any) => ({ id: s.id, name: s.name }))),
      suTrackerService.listPeepPlans()
    ]);
    if (!dir.success) setError(dir.error || 'Could not load Service Users.');
    else if (!pl.success) setError(pl.error || 'Could not load PEEP plans.');
    else {
      const permitted = dir.data.filter(r => isSitePermitted(r.siteName, 'all'));
      const ids = new Set(permitted.map(r => r.su.id));
      setDirectory(permitted);
      setPlans(pl.data.filter(p => p.status === 'Active' && ids.has(p.suId)));
    }
    setLoading(false);
  }, [sites, isSitePermitted]);
  useEffect(() => { load(); }, [load]);

  const today = todayIso();
  const rows = useMemo<PeepRow[]>(() => {
    const byId = new Map(directory.map(d => [d.su.id, d] as const));
    return plans.map(plan => ({ plan, d: byId.get(plan.suId)! })).filter(x => x.d);
  }, [plans, directory]);

  const rooms = useMemo(() => Array.from(new Set(rows.map(r => r.d.roomNo).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [rows]);

  const counts = useMemo(() => ({
    overdue: rows.filter(r => reviewStatusOf(r.plan.reviewDate, today) === 'overdue').length,
    dueSoon: rows.filter(r => reviewStatusOf(r.plan.reviewDate, today) === 'due-soon').length,
    high: rows.filter(r => r.plan.riskLevel === 'High').length,
    withoutPlan: directory.length - rows.length
  }), [rows, directory, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(({ plan, d }) => {
        if (riskFilter !== 'all' && plan.riskLevel !== riskFilter) return false;
        if (reviewFilter !== 'all' && reviewStatusOf(plan.reviewDate, today) !== reviewFilter) return false;
        if (roomFilter !== 'all' && d.roomNo !== roomFilter) return false;
        if (!isSitePermitted(d.siteName, siteFilter)) return false;
        if (q && !`${d.su.firstName} ${d.su.lastName} ${d.su.externalReference || ''} ${d.su.suReference} ${d.roomNo}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => sortValue(a, sortKey).localeCompare(sortValue(b, sortKey), undefined, { numeric: true, sensitivity: 'base' }) * (sortAsc ? 1 : -1));
  }, [rows, search, riskFilter, reviewFilter, roomFilter, siteFilter, sortKey, sortAsc, today, isSitePermitted]);

  const filtersActive = !!search || riskFilter !== 'all' || reviewFilter !== 'all' || roomFilter !== 'all' || siteFilter !== defaultSiteFilter;
  const resetFilters = () => { setSearch(''); setRiskFilter('all'); setReviewFilter('all'); setRoomFilter('all'); setSiteFilter(defaultSiteFilter); setPage(1); };
  const sortBy = (k: string) => { if (k === sortKey) setSortAsc(a => !a); else { setSortKey(k); setSortAsc(true); } setPage(1); };
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const reset = () => setPage(1);

  const confirmArchive = (plan: PeepPlan, name: string) => requestConfirmation({
    title: 'Archive PEEP plan',
    message: `Archive the PEEP plan for ${name}? The plan and its history are kept, and a new plan can then be created.`,
    confirmLabel: 'Archive plan',
    isDanger: true,
    onConfirm: async () => {
      const res = await suTrackerService.archivePeepPlan(plan, currentUserName);
      if (!res.success) setWarning(res.error || 'Could not archive the plan.'); else load();
    }
  });

  const cell = (key: string, { plan, d }: PeepRow) => {
    const missing = <span className="text-neutral-400 italic">Not recorded</span>;
    const rs = reviewStatusOf(plan.reviewDate, today);
    switch (key) {
      case 'port': return <span className="font-mono text-[11px]">{d.su.externalReference || d.su.suReference}</span>;
      case 'name': return <span className="font-medium text-[#242424] whitespace-nowrap">{d.su.firstName} {d.su.lastName}</span>;
      case 'dob': return d.su.dateOfBirth ? <span className="font-mono text-[11px]">{formatUkDate(d.su.dateOfBirth)}</span> : <span className="text-neutral-400 italic">Not set</span>;
      case 'room': return d.roomNo || <span className="text-neutral-400 italic">Not placed</span>;
      case 'mobility': return plan.mobilityType;
      case 'risk': return <span className={`inline-block px-2 py-0.5 rounded border font-semibold ${riskBadge[plan.riskLevel] || ''}`}>{plan.riskLevel}</span>;
      case 'companion': return plan.companion || missing;
      case 'alarm': return plan.emergencyAlarm || missing;
      case 'assistance': return plan.assistance || missing;
      case 'evac': return <span className="block max-w-[220px]" title={plan.evacuationProcedure}>{clip(plan.evacuationProcedure)}</span>;
      case 'exit': return <span className="block max-w-[200px]" title={plan.safeExitRoutes}>{clip(plan.safeExitRoutes)}</span>;
      case 'dev': return <span className="whitespace-nowrap">{plan.developedBy}</span>;
      case 'date': return <span className="font-mono text-[11px] whitespace-nowrap">{formatUkDate(plan.planDate)}</span>;
      case 'review': return (
        <span className="whitespace-nowrap">
          <span className="font-mono text-[11px]">{formatUkDate(plan.reviewDate)}</span>
          {rs === 'overdue' && <span className="ml-1.5 text-[9px] font-bold bg-red-100 text-red-800 px-1 py-0.5 rounded">OVERDUE</span>}
          {rs === 'due-soon' && <span className="ml-1.5 text-[9px] font-bold bg-amber-100 text-amber-800 px-1 py-0.5 rounded">DUE SOON</span>}
        </span>
      );
      default: return '';
    }
  };

  const exportCols = PEEP_TABLE_COLUMNS.map(c => ({
    id: String(c.key), label: c.label,
    get: (x: PeepRow) => {
      switch (String(c.key)) {
        case 'dob': return formatUkDate(x.d.su.dateOfBirth);
        case 'room': return x.d.roomNo;
        case 'risk': return x.plan.riskLevel;
        case 'date': return formatUkDate(x.plan.planDate);
        case 'review': return formatUkDate(x.plan.reviewDate);
        case 'mobility': return x.plan.mobilityType;
        case 'companion': return x.plan.companion;
        case 'alarm': return x.plan.emergencyAlarm;
        case 'assistance': return x.plan.assistance;
        case 'evac': return x.plan.evacuationProcedure;
        case 'exit': return x.plan.safeExitRoutes;
        case 'dev': return x.plan.developedBy;
        default: return sortValue(x, String(c.key));
      }
    }
  }));

  const summary = !loading && !error ? (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-3">
      {([
        ['Overdue reviews', counts.overdue, 'text-red-700'],
        [`Due within ${REVIEW_WARNING_DAYS} days`, counts.dueSoon, 'text-amber-700'],
        ['High risk plans', counts.high, 'text-red-700'],
        ['Residents without a plan', counts.withoutPlan, 'text-neutral-700']
      ] as Array<[string, number, string]>).map(([label, n, cls]) => (
        <div key={label} className="border border-[#e5e5e5] rounded-xs px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
          <div className={`text-xl font-bold ${cls}`}>{n}</div>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <TrackerHeader
        icon={<Accessibility className="w-5 h-5" />}
        title="PEEP Tracker"
        countLabel={loading || error ? undefined : `${filtered.length} Plans`}
        description="Personal Emergency Evacuation Plans for Service Users: mobility, risk, assistance, evacuation procedure and review dates."
        actions={
          <>
            {currentUserRole === 'Super Admin' && <CustomizeTableButton onClick={() => setIsSchemaOpen(true)} />}
            <TrackerExport<PeepRow> moduleName="PEEP Tracker" filename="PEEP_Tracker" title="PEEP Tracker" allRows={rows} filteredRows={filtered} dateOf={x => x.plan.planDate || ''} columns={exportCols} />
            {canEdit && <PrimaryButton onClick={() => setDialog({ mode: 'create' })} label="+ New PEEP Plan" />}
          </>
        }
        summary={summary}
        notice={warning ? <div className="mt-3 p-2 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xs">{warning}</div> : null}
        filtersClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5"
        filters={
          <>
            <div className="relative lg:col-span-2">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => { setSearch(e.target.value); reset(); }} placeholder="Search Resident, Port Ref, Room..." className={`${filterInputCls} pl-9`} aria-label="Search" />
            </div>
            <SiteFilterSelect value={siteFilter} onChange={v => { setSiteFilter(v); reset(); }} />
            <select className={filterInputCls} value={riskFilter} onChange={e => { setRiskFilter(e.target.value); reset(); }} aria-label="Risk level">
              <option value="all">All Risk Levels</option>{PEEP_RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className={filterInputCls} value={reviewFilter} onChange={e => { setReviewFilter(e.target.value as any); reset(); }} aria-label="Review status">
              <option value="all">All Review Statuses</option><option value="overdue">Overdue</option><option value="due-soon">Due within {REVIEW_WARNING_DAYS} days</option><option value="current">Up to date</option>
            </select>
            <select className={filterInputCls} value={roomFilter} onChange={e => { setRoomFilter(e.target.value); reset(); }} aria-label="Room">
              <option value="all">All Rooms</option>{rooms.map(r => <option key={r} value={r}>Room {r}</option>)}
            </select>
            <div className="lg:col-span-6 flex justify-end"><ResetFiltersButton onClick={resetFilters} active={filtersActive} /></div>
          </>
        }
      />

      <TablePanel totalItems={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} error={error} onRetry={load} errorTitle="Could not load PEEP plans">
        <table className="w-full text-left text-xs border-collapse min-w-[1500px]">
          <thead>
            <tr className={theadRowCls}>
              {visibleColumns.map(col => <SortableTh key={String(col.key)} label={col.label} active={sortKey === col.key} asc={sortAsc} onSort={() => sortBy(String(col.key))} />)}
              <ActionsTh />
            </tr>
          </thead>
          <tbody className={tbodyCls}>
            {loading ? <SkeletonRows cols={visibleColumns.length + 1} /> : paged.length === 0 ? (
              <EmptyRow colSpan={visibleColumns.length + 1} icon={<Accessibility className="w-8 h-8" />}
                title={rows.length === 0 ? 'No PEEP plans recorded' : 'No plans match your filters'}
                hint={rows.length === 0 && canEdit ? "Click '+ New PEEP Plan' to record an evacuation plan." : undefined} />
            ) : paged.map(x => (
              <tr key={x.plan.id} className={reviewStatusOf(x.plan.reviewDate, today) === 'overdue' ? 'bg-red-50/60' : 'hover:bg-[#f3f8fd] transition-colors'}>
                {visibleColumns.map(col => <td key={String(col.key)} className={tdCls}>{cell(String(col.key), x)}</td>)}
                <td className={actionsTdCls}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button type="button" title="View full plan" onClick={() => setDialog({ mode: 'view', suId: x.plan.suId })} className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs transition-colors cursor-pointer"><Eye className="w-3.5 h-3.5" /></button>
                    {canEdit && <button type="button" title="Edit" onClick={() => setDialog({ mode: 'edit', suId: x.plan.suId })} className="p-1 hover:bg-[#f0fdfa] text-[#0d9488] rounded-xs transition-colors cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>}
                    {canEdit && <button type="button" title="Record a review" onClick={() => setDialog({ mode: 'review', suId: x.plan.suId })} className="p-1 hover:bg-[#f0fdfa] text-teal-700 rounded-xs transition-colors cursor-pointer"><ClipboardCheck className="w-3.5 h-3.5" /></button>}
                    {canEdit && <button type="button" title="Archive plan" onClick={() => confirmArchive(x.plan, `${x.d.su.firstName} ${x.d.su.lastName}`)} className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs transition-colors cursor-pointer"><Archive className="w-3.5 h-3.5" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      {dialog && (
        <PeepDialog
          mode={dialog.mode}
          directory={directory}
          plans={plans}
          suId={dialog.suId}
          user={currentUserName}
          onClose={() => setDialog(null)}
          onSaved={(warn) => { setDialog(null); setWarning(warn || null); load(); }}
        />
      )}

      <TableSchemaEditorModal<any>
        isOpen={isSchemaOpen}
        onClose={() => setIsSchemaOpen(false)}
        moduleTitle="PEEP Tracker"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};

interface DialogProps {
  mode: 'view' | 'edit' | 'create' | 'review';
  directory: SuDirectoryRow[];
  plans: PeepPlan[];
  suId?: string;
  user: string;
  onClose: () => void;
  onSaved: (warning?: string) => void;
}

/** Option list whose last entry is an "Other" free-text escape: the supplied options are examples, not a full assessment. */
const OptionField: React.FC<{ label: string; value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean }> = ({ label, value, options, onChange, disabled }) => {
  const other = options[options.length - 1];
  const isOtherValue = !!value && !options.includes(value) ? true : value === other;
  const [otherText, setOtherText] = useState(isOtherValue ? value.replace(/^Other:s*/, '') : '');
  const selectValue = !value ? '' : options.includes(value) ? value : other;
  return (
    <div>
      <label className="block text-neutral-600 mb-1">{label}</label>
      <select className={inputCls} value={selectValue} disabled={disabled}
        onChange={e => { const v = e.target.value; onChange(v === other && otherText ? `Other: ${otherText}` : v); }}>
        <option value="">-- Select (assessed requirement) --</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {selectValue === other && !disabled && (
        <input className={`${inputCls} mt-1.5`} placeholder="Describe the arrangement" value={otherText}
          onChange={e => { setOtherText(e.target.value); onChange(e.target.value ? `Other: ${e.target.value}` : other); }} />
      )}
    </div>
  );
};

const PeepDialog: React.FC<DialogProps> = ({ mode, directory, plans, suId: initialSuId, user, onClose, onSaved }) => {
  const readOnly = mode === 'view';
  const planFor = (id: string) => plans.find(p => p.suId === id);
  const [suId, setSuId] = useState(initialSuId || '');
  const [search, setSearch] = useState('');
  const existing = suId ? planFor(suId) : undefined;
  const selected = directory.find(r => r.su.id === suId);

  const blank = { mobilityType: '', riskLevel: '' as any, companion: '', emergencyAlarm: '', assistance: '', evacuationProcedure: '', safeExitRoutes: '', developedBy: user, planDate: todayIso(), reviewDate: '' };
  const [form, setForm] = useState<any>(blank);
  const [history, setHistory] = useState<PeepHistoryEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hadPlan = useRef(false);
  useEffect(() => {
    setError('');
    if (existing) {
      hadPlan.current = true;
      setForm({
        mobilityType: existing.mobilityType || '', riskLevel: existing.riskLevel, companion: existing.companion || '', emergencyAlarm: existing.emergencyAlarm || '',
        assistance: existing.assistance || '', evacuationProcedure: existing.evacuationProcedure || '', safeExitRoutes: existing.safeExitRoutes || '',
        developedBy: existing.developedBy || user, planDate: existing.planDate || todayIso(),
        // A review starts from today and needs a new review date chosen
        reviewDate: mode === 'review' ? '' : existing.reviewDate || ''
      });
      suTrackerService.listPeepHistory(existing.id).then(r => setHistory(r.success ? r.data : []));
    } else {
      // Values typed before a resident was chosen are kept; only a previous resident's plan is cleared
      if (hadPlan.current) setForm(blank);
      hadPlan.current = false;
      setHistory([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suId, existing?.id, mode]);

  const candidates = useMemo(() => {
    const withPlan = new Set(plans.map(p => p.suId));
    const q = search.trim().toLowerCase();
    return directory
      .filter(r => !withPlan.has(r.su.id))
      .filter(r => !q || `${r.su.firstName} ${r.su.lastName} ${r.su.suReference} ${r.su.externalReference || ''}`.toLowerCase().includes(q))
      .slice(0, 200);
  }, [directory, plans, search]);

  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setError('');
    if (!suId) { setError('Choose a Service User.'); return; }
    if (mode === 'review' && existing && form.reviewDate <= todayIso()) { setError('Choose a new review date in the future.'); return; }
    setSaving(true);
    const res = await suTrackerService.savePeepPlan({ id: existing?.id, suId, ...form }, user, mode === 'review' ? 'review' : 'save');
    setSaving(false);
    if (!res.success) { setError(res.error || 'Could not save the plan.'); return; }
    onSaved(res.warning);
  };

  const title = mode === 'view' ? 'PEEP Plan' : mode === 'review' ? 'Review PEEP Plan' : existing ? 'Edit PEEP Plan' : 'New PEEP Plan';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-white rounded-xs border border-[#e5e5e5] shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e5e5e5] bg-[#faf9f8] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[#242424]">{title}</h3>
            {existing && <p className="text-[11px] text-neutral-500">Version {existing.version} · last updated by {existing.updatedBy || existing.createdBy || 'unknown'}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xs" role="alert">{error}</div>}

          {mode === 'create' && !initialSuId && (
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Service User <span className="text-red-500">*</span> <span className="font-normal text-neutral-400">(residents without an active plan)</span></label>
              <select className={inputCls} value={suId} onChange={e => setSuId(e.target.value)}>
                <option value="">Select Service User...</option>
                {candidates.map(r => <option key={r.su.id} value={r.su.id}>{r.su.firstName} {r.su.lastName} - {r.su.externalReference || r.su.suReference}{r.roomNo ? ` - Room ${r.roomNo}` : ''}</option>)}
              </select>
            </div>
          )}

            <>
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5"><Lock className="w-3 h-3" /> From the Service User profile</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><label className="block text-neutral-600 mb-1">Port reference</label><div className={lockedCls}>{selected?.su.externalReference || selected?.su.suReference}</div></div>
                  <div><label className="block text-neutral-600 mb-1">Name</label><div className={lockedCls}>{selected?.su.firstName} {selected?.su.lastName}</div></div>
                  <div><label className="block text-neutral-600 mb-1">DOB</label><div className={lockedCls}>{formatUkDate(selected?.su.dateOfBirth) || '—'}</div></div>
                  <div><label className="block text-neutral-600 mb-1">Room No</label><div className={lockedCls}>{selected?.roomNo || 'Not placed'}</div></div>
                </div>
              </div>

              {readOnly ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[['Mobility type', form.mobilityType], ['PEEP risk level', form.riskLevel], ['Companion', form.companion], ['Emergency alarm', form.emergencyAlarm], ['Assistance', form.assistance], ['Developed by', form.developedBy], ['Date', formatUkDate(form.planDate)], ['Review date', formatUkDate(form.reviewDate)]].map(([l, v]) => (
                      <div key={String(l)}><div className="text-[10px] uppercase tracking-wider text-neutral-500">{l}</div><div className="text-sm text-[#242424]">{v || <span className="text-neutral-400 italic">Not recorded</span>}</div></div>
                    ))}
                  </div>
                  <div className="p-3 border border-red-200 bg-red-50/40 rounded-xs"><div className="text-[10px] uppercase tracking-wider text-red-800 font-semibold mb-1">Evacuation procedure</div><p className="text-sm whitespace-pre-wrap text-[#242424]">{form.evacuationProcedure}</p></div>
                  <div className="p-3 border border-[#e5e5e5] rounded-xs"><div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">Safe exit routes</div><p className="text-sm whitespace-pre-wrap text-[#242424]">{form.safeExitRoutes}</p></div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label className="block text-neutral-600 mb-1">Mobility type <span className="text-red-500">*</span></label><input className={inputCls} value={form.mobilityType} onChange={e => set('mobilityType', e.target.value)} /></div>
                    <div><label className="block text-neutral-600 mb-1">PEEP risk level <span className="text-red-500">*</span></label>
                      <select className={inputCls} value={form.riskLevel} onChange={e => set('riskLevel', e.target.value)}>
                        <option value="">-- Select --</option>{PEEP_RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <OptionField label="Companion" value={form.companion} options={PEEP_COMPANIONS} onChange={v => set('companion', v)} />
                    <OptionField label="Emergency Alarm" value={form.emergencyAlarm} options={PEEP_ALARMS} onChange={v => set('emergencyAlarm', v)} />
                    <OptionField label="Assistance" value={form.assistance} options={PEEP_ASSISTANCE} onChange={v => set('assistance', v)} />
                    <div><label className="block text-neutral-600 mb-1">Developed by <span className="text-red-500">*</span></label><input className={inputCls} value={form.developedBy} onChange={e => set('developedBy', e.target.value)} /></div>
                  </div>
                  <div><label className="block text-neutral-600 mb-1">Evacuation procedure <span className="text-red-500">*</span></label><textarea className={inputCls} rows={4} value={form.evacuationProcedure} onChange={e => set('evacuationProcedure', e.target.value)} /></div>
                  <div><label className="block text-neutral-600 mb-1">Safe exit routes <span className="text-red-500">*</span></label><textarea className={inputCls} rows={3} value={form.safeExitRoutes} onChange={e => set('safeExitRoutes', e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-neutral-600 mb-1">Date <span className="text-red-500">*</span></label><input type="date" className={inputCls} value={form.planDate} onChange={e => set('planDate', e.target.value)} disabled={mode === 'review'} /></div>
                    <div><label className="block text-neutral-600 mb-1">{mode === 'review' ? 'Next review date' : 'Review date'} <span className="text-red-500">*</span></label><input type="date" className={inputCls} value={form.reviewDate} onChange={e => set('reviewDate', e.target.value)} /></div>
                  </div>
                  {mode === 'review' && <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200 rounded-xs p-2">Check the plan above is still correct, change anything that is not, set the next review date and save. This records a review in the plan's history.</p>}
                </div>
              )}

              {existing && history.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5"><History className="w-3 h-3" /> History</div>
                  <ul className="border border-[#e5e5e5] rounded-xs divide-y divide-[#f0f0f0] max-h-40 overflow-y-auto">
                    {history.map(h => (
                      <li key={h.id} className="px-3 py-1.5 flex items-center justify-between gap-3">
                        <span><b>v{h.version}</b> {h.changeType}{h.changedFields ? ` (${h.changedFields})` : ''}</span>
                        <span className="text-neutral-500 whitespace-nowrap">{h.changedBy} · {h.changedAt ? new Date(h.changedAt).toLocaleString('en-GB') : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>

          <AuditAccountability userName={user} createdBy={existing?.createdBy} updatedBy={existing?.updatedBy} updatedAt={existing?.updatedAt} />

          <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
            <button type="button" onClick={onClose} className="px-3.5 py-1.5 border border-[#e5e5e5] rounded-xs text-neutral-700 hover:bg-neutral-100 cursor-pointer">{readOnly ? 'Close' : 'Cancel'}</button>
            {!readOnly && <button type="button" onClick={save} disabled={saving} className="px-4 py-1.5 bg-[#0d9488] hover:bg-teal-700 text-white rounded-xs font-semibold disabled:opacity-50 cursor-pointer">{saving ? 'Saving...' : mode === 'review' ? 'Save Review' : 'Save Plan'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
};
