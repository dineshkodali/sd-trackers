import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Eye, X, Lock, Trash2, Stethoscope, Edit3 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suTrackerService, type GpRegistration, type SuDirectoryRow } from '../../services/suTrackerService';
import { canViewNhsNumber, canEditSuTrackers, maskNhsNumber, isValidNhsNumber, formatUkDate } from '../../utils/suTrackerAccess';
import { SiteFilterSelect, ResetFiltersButton, TrackerExport, filterInputCls } from '../common/TrackerToolbar';
import {
  TrackerHeader, CustomizeTableButton, PrimaryButton, TablePanel, SortableTh, ActionsTh, actionsTdCls, EmptyRow, SkeletonRows,
  theadRowCls, tbodyCls, tdCls, AuditAccountability
} from '../common/TrackerLayout';
import { useTableSchema } from '../../hooks/useTableSchema';
import { OptionSelect } from '../common/OptionSelect';
import { TrackerDossier } from '../common/TrackerDossier';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import type { TableColumnConfig } from '../../types/tableSchema';

const inputCls = 'w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]';
const lockedCls = 'w-full px-2.5 py-1.5 bg-neutral-100 border border-[#e5e5e5] rounded-xs text-xs text-neutral-700';

type GpRow = { d: SuDirectoryRow; reg?: GpRegistration };

/** Default columns, in the required order. Super Admin can rename, hide or reorder them with Customize Table. */
const GP_REGISTRATION_COLUMNS: TableColumnConfig<any>[] = [
  { key: 'port', label: 'Port reference', type: 'text' },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'dob', label: 'DOB', type: 'text' },
  { key: 'gp', label: 'GP', type: 'text' },
  { key: 'pharmacy', label: 'Pharmacy', type: 'text' },
  { key: 'nhs', label: 'NHS number', type: 'text' }
];

const SORT_VALUE: Record<string, (x: GpRow) => string> = {
  port: x => x.d.su.externalReference || x.d.su.suReference || '',
  name: x => `${x.d.su.firstName} ${x.d.su.lastName}`,
  dob: x => x.d.su.dateOfBirth || '',
  gp: x => x.reg?.gpPractice || '',
  pharmacy: x => x.reg?.pharmacy || '',
  nhs: x => x.reg?.nhsNumber || ''
};

export const GPRegistrationsTab: React.FC<{ tabSwitcher?: React.ReactNode }> = ({ tabSwitcher }) => {
  const { sites, isSitePermitted, currentUserRole, currentUserName, defaultSiteFilter, canDeleteRecord, requestConfirmation } = useApp();
  const canSeeNhs = canViewNhsNumber(currentUserRole);
  const canEdit = canEditSuTrackers(currentUserRole);
  const { columns, visibleColumns, saveColumns, resetToDefault } = useTableSchema<any>('gpRegistrations', GP_REGISTRATION_COLUMNS);

  const [directory, setDirectory] = useState<SuDirectoryRow[]>([]);
  const [registrations, setRegistrations] = useState<GpRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState<string>(defaultSiteFilter);
  const [detailFilter, setDetailFilter] = useState<'all' | 'missing-gp' | 'missing-pharmacy' | 'missing-nhs' | 'complete'>('all');
  useEffect(() => { setSiteFilter(defaultSiteFilter); }, [defaultSiteFilter]);
  const [sortKey, setSortKey] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formFor, setFormFor] = useState<{ suId?: string; readOnly?: boolean } | null>(null);
  const [isSchemaOpen, setIsSchemaOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [dir, regs] = await Promise.all([
      suTrackerService.loadSuDirectory((sites || []).map((s: any) => ({ id: s.id, name: s.name }))),
      suTrackerService.listGpRegistrations()
    ]);
    if (!dir.success) setError(dir.error || 'Could not load Service Users.');
    else if (!regs.success) setError(regs.error || 'Could not load GP registrations.');
    else {
      setDirectory(dir.data.filter(r => isSitePermitted(r.siteName, 'all')));
      setRegistrations(regs.data);
    }
    setLoading(false);
  }, [sites, isSitePermitted]);

  useEffect(() => { load(); }, [load]);

  // Joined view: current Service User details + the registration (if any)
  const rows = useMemo<GpRow[]>(() => {
    const regBySu = new Map(registrations.map(r => [r.suId, r] as const));
    return directory.map(d => ({ d, reg: regBySu.get(d.su.id) })).filter(x => x.reg);
  }, [directory, registrations]);

  const missingCount = directory.length - rows.length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows
      .filter(({ d }) => isSitePermitted(d.siteName, siteFilter))
      .filter(({ reg }) =>
        detailFilter === 'missing-gp' ? !reg?.gpPractice
          : detailFilter === 'missing-pharmacy' ? !reg?.pharmacy
          : detailFilter === 'missing-nhs' ? !reg?.nhsNumber
          : detailFilter === 'complete' ? !!(reg?.gpPractice && reg?.pharmacy && reg?.nhsNumber)
          : true)
      .filter(({ d, reg }) => !q || [
        d.su.externalReference, d.su.suReference, `${d.su.firstName} ${d.su.lastName}`, reg?.gpPractice, reg?.pharmacy, canSeeNhs ? reg?.nhsNumber : ''
      ].join(' ').toLowerCase().includes(q));
    const val = SORT_VALUE[sortKey] || SORT_VALUE.name;
    return [...list].sort((a, b) => val(a).localeCompare(val(b), undefined, { numeric: true, sensitivity: 'base' }) * (sortAsc ? 1 : -1));
  }, [rows, search, siteFilter, detailFilter, sortKey, sortAsc, canSeeNhs, isSitePermitted]);

  const filtersActive = !!search || siteFilter !== defaultSiteFilter || detailFilter !== 'all';
  const resetFilters = () => { setSearch(''); setSiteFilter(defaultSiteFilter); setDetailFilter('all'); setPage(1); };
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const sortBy = (k: string) => { if (k === sortKey) setSortAsc(a => !a); else { setSortKey(k); setSortAsc(true); } setPage(1); };

  const confirmDelete = (regId: string, name: string) => requestConfirmation({
    title: 'Delete GP registration',
    message: `Delete the GP registration for ${name}? The Service User record is not affected.`,
    confirmLabel: 'Delete registration',
    isDanger: true,
    onConfirm: async () => {
      const res = await suTrackerService.deleteGpRegistration(regId);
      if (!res.success) setError(res.error || 'Could not delete the registration.'); else load();
    }
  });

  const cell = (key: string, x: GpRow) => {
    const { d, reg } = x;
    const missing = (t: string) => <span className="text-neutral-400 italic">{t}</span>;
    switch (key) {
      case 'port': return <span className="font-mono text-[11px]">{d.su.externalReference || d.su.suReference || missing('Not set')}</span>;
      case 'name': return <span className="font-medium text-[#242424]">{d.su.firstName} {d.su.lastName}</span>;
      case 'dob': return d.su.dateOfBirth ? <span className="font-mono text-[11px]">{formatUkDate(d.su.dateOfBirth)}</span> : missing('Not set');
      case 'gp': return reg?.gpPractice || missing('Not recorded');
      case 'pharmacy': return reg?.pharmacy || missing('Not recorded');
      case 'nhs': return !reg?.nhsNumber ? missing('Not recorded') : <span className="font-mono text-[11px]" title={canSeeNhs ? undefined : 'Restricted'}>{canSeeNhs ? reg.nhsNumber : maskNhsNumber(reg.nhsNumber)}</span>;
      default: return '';
    }
  };

  const exportCols = [
    { id: 'port', label: 'Port reference', get: (x: GpRow) => x.d.su.externalReference || x.d.su.suReference },
    { id: 'name', label: 'Name', get: (x: GpRow) => `${x.d.su.firstName} ${x.d.su.lastName}` },
    { id: 'dob', label: 'DOB', get: (x: GpRow) => formatUkDate(x.d.su.dateOfBirth) },
    { id: 'gp', label: 'GP', get: (x: GpRow) => x.reg?.gpPractice },
    { id: 'pharmacy', label: 'Pharmacy', get: (x: GpRow) => x.reg?.pharmacy },
    { id: 'nhs', label: 'NHS number', get: (x: GpRow) => (canSeeNhs ? x.reg?.nhsNumber : maskNhsNumber(x.reg?.nhsNumber)) }
  ];

  return (
    <div className="space-y-4">
      <TrackerHeader
        icon={<Stethoscope className="w-5 h-5" />}
        title="GP Registrations"
        countLabel={loading || error ? undefined : `${filtered.length} Registrations`}
        description={<>GP practice, pharmacy and NHS number for each Service User.{!loading && !error && missingCount > 0 && <> <b>{missingCount}</b> Service User{missingCount === 1 ? '' : 's'} without a registration.</>}</>}
        actions={
          <>
            {currentUserRole === 'Super Admin' && <CustomizeTableButton onClick={() => setIsSchemaOpen(true)} />}
            <TrackerExport<GpRow> moduleName="GP Registrations" filename="GP_Registrations" title="GP Registrations" allRows={rows} filteredRows={filtered} columns={exportCols} />
            {canEdit && <PrimaryButton onClick={() => setFormFor({})} label="+ Add GP Registration" />}
          </>
        }
        tabs={tabSwitcher}
        filtersClassName="flex flex-wrap lg:flex-nowrap items-center gap-2"
        filters={
          <>
            <div className="relative flex-[2] min-w-[140px]">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search Port Ref, Name, GP, Pharmacy, NHS..." className={`${filterInputCls} pl-7`} aria-label="Search" />
            </div>
            <SiteFilterSelect value={siteFilter} onChange={v => { setSiteFilter(v); setPage(1); }} />
            <select value={detailFilter} onChange={e => { setDetailFilter(e.target.value as any); setPage(1); }} className={filterInputCls} aria-label="Details">
              <option value="all">All Registrations</option>
              <option value="complete">Complete (GP, pharmacy, NHS)</option>
              <option value="missing-gp">Missing GP practice</option>
              <option value="missing-pharmacy">Missing pharmacy</option>
              <option value="missing-nhs">Missing NHS number</option>
            </select>
            <ResetFiltersButton onClick={resetFilters} active={filtersActive} />
          </>
        }
      />

      <TablePanel totalItems={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} error={error} onRetry={load} errorTitle="Could not load GP registrations">
        <table className="w-full text-left text-xs border-collapse min-w-[900px]">
          <thead>
            <tr className={theadRowCls}>
              {visibleColumns.map(col => <SortableTh key={String(col.key)} label={col.label} active={sortKey === col.key} asc={sortAsc} onSort={() => sortBy(String(col.key))} />)}
              <ActionsTh />
            </tr>
          </thead>
          <tbody className={tbodyCls}>
            {loading ? <SkeletonRows cols={visibleColumns.length + 1} /> : paged.length === 0 ? (
              <EmptyRow colSpan={visibleColumns.length + 1} icon={<Stethoscope className="w-8 h-8" />}
                title={rows.length === 0 ? 'No GP registrations recorded' : 'No registrations match your filters'}
                hint={rows.length === 0 && canEdit ? "Click '+ Add GP Registration' to register a Service User with a GP." : undefined} />
            ) : paged.map(x => (
              <tr key={x.d.su.id} className="hover:bg-[#f3f8fd] transition-colors">
                {visibleColumns.map(col => <td key={String(col.key)} className={tdCls}>{cell(String(col.key), x)}</td>)}
                <td className={actionsTdCls}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button type="button" title="View Details" onClick={() => setFormFor({ suId: x.d.su.id, readOnly: true })} className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs transition-colors cursor-pointer"><Eye className="w-3.5 h-3.5" /></button>
                    {canEdit && <button type="button" title="Edit Registration" onClick={() => setFormFor({ suId: x.d.su.id })} className="p-1 hover:bg-[#f0fdfa] text-[#0d9488] rounded-xs transition-colors cursor-pointer"><Edit3 className="w-3.5 h-3.5" /></button>}
                    {canDeleteRecord() && x.reg && <button type="button" title="Delete" onClick={() => confirmDelete(x.reg!.id, `${x.d.su.firstName} ${x.d.su.lastName}`)} className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablePanel>

      {formFor && (
        <GPRegistrationForm
          directory={directory}
          initialSuId={formFor.suId}
          readOnly={!!formFor.readOnly}
          canSeeNhs={canSeeNhs}
          user={currentUserName}
          onClose={() => setFormFor(null)}
          onSaved={() => { setFormFor(null); load(); }}
        />
      )}

      <TableSchemaEditorModal<any>
        isOpen={isSchemaOpen}
        onClose={() => setIsSchemaOpen(false)}
        moduleTitle="GP Registrations"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};

interface FormProps {
  directory: SuDirectoryRow[];
  initialSuId?: string;
  readOnly: boolean;
  canSeeNhs: boolean;
  user: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Create or edit one registration. The Service User's own details are shown locked; only GP details are edited. */
const GPRegistrationForm: React.FC<FormProps> = ({ directory, initialSuId, readOnly, canSeeNhs, user, onClose, onSaved }) => {
  const [suId, setSuId] = useState(initialSuId || '');
  const [search, setSearch] = useState('');
  const [existing, setExisting] = useState<GpRegistration | null>(null);
  const [loadingReg, setLoadingReg] = useState(false);
  const [gp, setGp] = useState('');
  const [pharmacy, setPharmacy] = useState('');
  const [nhs, setNhs] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = directory.find(r => r.su.id === suId);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (q ? directory.filter(r => `${r.su.firstName} ${r.su.lastName} ${r.su.suReference} ${r.su.externalReference || ''}`.toLowerCase().includes(q)) : directory).slice(0, 200);
  }, [directory, search]);

  // A fresh read whenever the Service User changes. Values loaded for the previous resident are cleared, but anything
  // typed before choosing a resident is kept (the form is open from the start).
  const prefilled = useRef(false);
  useEffect(() => {
    let alive = true;
    setExisting(null); setError('');
    if (prefilled.current) { setGp(''); setPharmacy(''); setNhs(''); setNotes(''); prefilled.current = false; }
    if (!suId) return;
    setLoadingReg(true);
    suTrackerService.getGpRegistrationForSu(suId).then(res => {
      if (!alive) return;
      setLoadingReg(false);
      if (!res.success) { setError(res.error || 'Could not load the registration.'); return; }
      const reg = res.data;
      setExisting(reg);
      if (reg) { setGp(reg.gpPractice || ''); setPharmacy(reg.pharmacy || ''); setNhs(reg.nhsNumber || ''); setNotes(reg.notes || ''); prefilled.current = true; }
    });
    return () => { alive = false; };
  }, [suId]);

  const hideNhs = !canSeeNhs && !!existing?.nhsNumber;

  const save = async () => {
    setError('');
    if (!suId) { setError('Choose a Service User.'); return; }
    if (!isValidNhsNumber(nhs)) { setError('NHS number must be 10 digits.'); return; }
    setSaving(true);
    const res = await suTrackerService.saveGpRegistration({
      id: existing?.id, suId, gpPractice: gp, pharmacy,
      // Without permission to see the NHS number, an unchanged hidden value is kept as it is
      nhsNumber: hideNhs ? existing?.nhsNumber : nhs, notes
    }, user);
    setSaving(false);
    if (!res.success) { setError(res.error || 'Could not save.'); return; }
    onSaved();
  };

  if (readOnly && selected && existing) {
    return (
      <TrackerDossier
        title={`GP Registration Dossier: ${selected.su.firstName} ${selected.su.lastName}`}
        recordId={existing.id}
        onClose={onClose}
        sections={[
          { title: 'Service User Identification', fields: [
            { label: 'Port / NASS Ref', value: selected.su.externalReference || selected.su.suReference },
            { label: 'Room No', value: selected.roomNo || 'Not placed' },
            { label: 'Service User Name', value: `${selected.su.firstName} ${selected.su.lastName}` },
            { label: 'Date of Birth', value: formatUkDate(selected.su.dateOfBirth) }
          ] },
          { title: 'GP Registration Details', fields: [
            { label: 'GP Practice', value: existing.gpPractice },
            { label: 'Pharmacy', value: existing.pharmacy },
            { label: 'NHS Number', value: canSeeNhs ? existing.nhsNumber : maskNhsNumber(existing.nhsNumber) },
            { label: 'Notes', value: existing.notes, full: true }
          ] },
          { title: 'Audit & Accountability', fields: [
            { label: 'Added By', value: existing.createdBy },
            { label: 'Last Updated By', value: existing.updatedBy },
            { label: 'Last Updated', value: existing.updatedAt ? new Date(existing.updatedAt).toLocaleString('en-GB') : '' }
          ] }
        ]}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xs border border-[#e5e5e5] shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e5e5e5] bg-[#faf9f8] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[#242424]">{readOnly ? 'GP Registration' : existing ? 'Edit GP Registration' : 'Add GP Registration'}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3.5 overflow-y-auto text-xs">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xs">{error}</div>}

          {!initialSuId && (
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Service User <span className="text-red-500">*</span></label>
              <select className={inputCls} value={suId} onChange={e => setSuId(e.target.value)}>
                <option value="">Select Service User...</option>
                {matches.map(r => <option key={r.su.id} value={r.su.id}>{r.su.firstName} {r.su.lastName} - {r.su.externalReference || r.su.suReference}</option>)}
              </select>
            </div>
          )}

            <>
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5"><Lock className="w-3 h-3" /> From the Service User profile</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-neutral-600 mb-1">Port reference</label><div className={lockedCls}>{selected?.su.externalReference || selected?.su.suReference || '—'}</div></div>
                  <div><label className="block text-neutral-600 mb-1">Date of birth</label><div className={lockedCls}>{formatUkDate(selected?.su.dateOfBirth) || '—'}</div></div>
                  <div className="col-span-2"><label className="block text-neutral-600 mb-1">Name</label><div className={lockedCls}>{selected?.su.firstName} {selected?.su.lastName}</div></div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">GP registration details {loadingReg && <span className="normal-case font-normal">(loading...)</span>}</div>
                {!suId && !readOnly && <p className="mb-2 text-[11px] text-neutral-500">Choose the Service User above; their details and any existing GP registration fill in here.</p>}
                {!loadingReg && !!suId && !existing && !readOnly && <p className="mb-2 text-[11px] text-amber-700">No GP registration exists yet for this Service User. Fill in what is known; blank fields stay blank.</p>}
                <div className="space-y-3">
                  <OptionSelect label="GP practice" category="gpPractices" value={gp} onChange={setGp} disabled={readOnly || loadingReg} />
                  <OptionSelect label="Pharmacy" category="gpPharmacies" value={pharmacy} onChange={setPharmacy} disabled={readOnly || loadingReg} />
                  <div>
                    <label className="block text-neutral-600 mb-1">NHS number</label>
                    {hideNhs ? (
                      <div className={lockedCls}>{maskNhsNumber(existing?.nhsNumber)} <span className="text-neutral-400">(restricted)</span></div>
                    ) : (
                      <input className={inputCls} value={nhs} onChange={e => setNhs(e.target.value)} disabled={readOnly || loadingReg} placeholder="10 digits" inputMode="numeric" />
                    )}
                  </div>
                  <div><label className="block text-neutral-600 mb-1">Notes</label><textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} disabled={readOnly || loadingReg} /></div>
                </div>
              </div>
            </>

          <AuditAccountability userName={user} createdBy={existing?.createdBy} updatedBy={existing?.updatedBy} updatedAt={existing?.updatedAt} />

          <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
            <button type="button" onClick={onClose} className="px-3.5 py-1.5 border border-[#e5e5e5] rounded-xs text-neutral-700 hover:bg-neutral-100 cursor-pointer">{readOnly ? 'Close' : 'Cancel'}</button>
            {!readOnly && (
              <button type="button" onClick={save} disabled={saving || loadingReg} className="px-4 py-1.5 bg-[#0d9488] hover:bg-teal-700 text-white rounded-xs font-semibold disabled:opacity-50 cursor-pointer">
                {saving ? 'Saving...' : existing ? 'Save Changes' : 'Save Registration'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
