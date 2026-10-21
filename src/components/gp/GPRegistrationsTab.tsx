import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, RefreshCw, AlertCircle, Pencil, Eye, ArrowUpDown, X, Lock, Trash2, Stethoscope } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suTrackerService, type GpRegistration, type SuDirectoryRow } from '../../services/suTrackerService';
import { canViewNhsNumber, canEditSuTrackers, maskNhsNumber, isValidNhsNumber, formatUkDate } from '../../utils/suTrackerAccess';
import { Pagination } from '../common/Pagination';
import { SiteFilterSelect, RefreshButton, ResetFiltersButton, TrackerExport, filterInputCls } from '../common/TrackerToolbar';

const inputCls = 'w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]';
const lockedCls = 'w-full px-2.5 py-1.5 bg-neutral-100 border border-[#e5e5e5] rounded-xs text-xs text-neutral-700';

type SortKey = 'port' | 'name' | 'dob' | 'gp' | 'pharmacy';

export const GPRegistrationsTab: React.FC = () => {
  const { sites, isSitePermitted, currentUserRole, currentUserName, defaultSiteFilter, canDeleteRecord, requestConfirmation } = useApp();
  const canSeeNhs = canViewNhsNumber(currentUserRole);
  const canEdit = canEditSuTrackers(currentUserRole);

  const [directory, setDirectory] = useState<SuDirectoryRow[]>([]);
  const [registrations, setRegistrations] = useState<GpRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState<string>(defaultSiteFilter);
  const [detailFilter, setDetailFilter] = useState<'all' | 'missing-gp' | 'missing-pharmacy' | 'missing-nhs' | 'complete'>('all');
  useEffect(() => { setSiteFilter(defaultSiteFilter); }, [defaultSiteFilter]);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [formFor, setFormFor] = useState<{ suId?: string; readOnly?: boolean } | null>(null);

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
  const rows = useMemo(() => {
    const regBySu = new Map(registrations.map(r => [r.suId, r] as const));
    return directory
      .map(d => ({ d, reg: regBySu.get(d.su.id) }))
      .filter(x => x.reg); // the table lists registrations; residents without one are offered in the form
  }, [directory, registrations]);

  const missingCount = directory.length - rows.length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bySite = rows.filter(({ d }) => isSitePermitted(d.siteName, siteFilter));
    const byDetail = bySite.filter(({ reg }) =>
      detailFilter === 'missing-gp' ? !reg?.gpPractice
        : detailFilter === 'missing-pharmacy' ? !reg?.pharmacy
        : detailFilter === 'missing-nhs' ? !reg?.nhsNumber
        : detailFilter === 'complete' ? !!(reg?.gpPractice && reg?.pharmacy && reg?.nhsNumber)
        : true);
    const list = q
      ? byDetail.filter(({ d, reg }) => [
          d.su.externalReference, d.su.suReference, `${d.su.firstName} ${d.su.lastName}`, reg?.gpPractice, reg?.pharmacy,
          canSeeNhs ? reg?.nhsNumber : ''
        ].join(' ').toLowerCase().includes(q))
      : byDetail;
    const val = (x: typeof rows[number]) => {
      switch (sortKey) {
        case 'port': return x.d.su.externalReference || x.d.su.suReference || '';
        case 'dob': return x.d.su.dateOfBirth || '';
        case 'gp': return x.reg?.gpPractice || '';
        case 'pharmacy': return x.reg?.pharmacy || '';
        default: return `${x.d.su.firstName} ${x.d.su.lastName}`;
      }
    };
    return [...list].sort((a, b) => val(a).localeCompare(val(b), undefined, { numeric: true, sensitivity: 'base' }) * (sortAsc ? 1 : -1));
  }, [rows, search, siteFilter, detailFilter, sortKey, sortAsc, canSeeNhs, isSitePermitted]);

  const filtersActive = !!search || siteFilter !== defaultSiteFilter || detailFilter !== 'all';
  const resetFilters = () => { setSearch(''); setSiteFilter(defaultSiteFilter); setDetailFilter('all'); setPage(1); };

  const confirmDelete = (suId: string, regId: string, name: string) => requestConfirmation({
    title: 'Delete GP registration',
    message: `Delete the GP registration for ${name}? The Service User record is not affected.`,
    confirmLabel: 'Delete registration',
    isDanger: true,
    onConfirm: async () => {
      const res = await suTrackerService.deleteGpRegistration(regId);
      if (!res.success) setError(res.error || 'Could not delete the registration.'); else load();
    }
  });

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const sortBy = (k: SortKey) => { if (k === sortKey) setSortAsc(a => !a); else { setSortKey(k); setSortAsc(true); } setPage(1); };
  // A render function (not a component) so the header buttons are not replaced on every render
  const th = (label: string, k?: SortKey) => (
    <th key={label} className="py-2.5 px-3 whitespace-nowrap">
      {k ? (
        <button type="button" onClick={() => sortBy(k)} className="inline-flex items-center gap-1 hover:text-[#0d9488] cursor-pointer">
          {label}<ArrowUpDown className="w-3 h-3 opacity-50" />
        </button>
      ) : label}
    </th>
  );

  return (
    <div className="space-y-3.5">
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 border border-teal-200 text-[#0d9488] rounded-xs"><Stethoscope className="w-5 h-5" /></div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#242424] tracking-tight">GP Registrations</h2>
                {!loading && !error && <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#99f6e4]">{filtered.length} Registrations</span>}
              </div>
              <p className="text-xs text-neutral-500">
                GP practice, pharmacy and NHS number for each Service User. Name, DOB and port reference come from the Service User record.
                {!loading && !error && missingCount > 0 && <> <b>{missingCount}</b> Service User{missingCount === 1 ? '' : 's'} without a registration.</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <RefreshButton onClick={load} loading={loading} />
            <TrackerExport
              moduleName="GP Registrations"
              filename="GP_Registrations"
              title="GP Registrations"
              allRows={rows}
              filteredRows={filtered}
              columns={[
                { id: 'port', label: 'Port reference', get: x => x.d.su.externalReference || x.d.su.suReference },
                { id: 'name', label: 'Name', get: x => `${x.d.su.firstName} ${x.d.su.lastName}` },
                { id: 'dob', label: 'DOB', get: x => formatUkDate(x.d.su.dateOfBirth) },
                { id: 'gp', label: 'GP', get: x => x.reg?.gpPractice },
                { id: 'pharmacy', label: 'Pharmacy', get: x => x.reg?.pharmacy },
                { id: 'nhs', label: 'NHS number', get: x => (canSeeNhs ? x.reg?.nhsNumber : maskNhsNumber(x.reg?.nhsNumber)) }
              ]}
            />
            {canEdit && (
              <button type="button" onClick={() => setFormFor({})} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-2xs cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> + Add GP Registration
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search port ref, name, GP, pharmacy, NHS..." className={`${filterInputCls} pl-9`} aria-label="Search" />
          </div>
          <SiteFilterSelect value={siteFilter} onChange={v => { setSiteFilter(v); setPage(1); }} />
          <select value={detailFilter} onChange={e => { setDetailFilter(e.target.value as any); setPage(1); }} className={filterInputCls} aria-label="Details">
            <option value="all">All registrations</option>
            <option value="complete">Complete (GP, pharmacy, NHS)</option>
            <option value="missing-gp">Missing GP practice</option>
            <option value="missing-pharmacy">Missing pharmacy</option>
            <option value="missing-nhs">Missing NHS number</option>
          </select>
          <ResetFiltersButton onClick={resetFilters} active={filtersActive} />
        </div>
      </div>

      <div className="bg-white border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs">
        {error ? (
          <div className="p-6 text-center">
            <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-red-700">Could not load GP registrations</p>
            <p className="text-[11px] text-neutral-500 mt-1 max-w-xl mx-auto break-words">{error}</p>
            <button type="button" onClick={load} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#8a8886] rounded-xs text-xs font-semibold bg-white hover:bg-[#f3f2f1] cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold select-none">
                  {th('Port reference', 'port')}
                  {th('Name', 'name')}
                  {th('DOB', 'dob')}
                  {th('GP', 'gp')}
                  {th('Pharmacy', 'pharmacy')}
                  {th('NHS number')}
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 7 }).map((__, j) => <td key={j} className="py-3 px-3"><div className="h-3 bg-neutral-100 rounded animate-pulse" /></td>)}</tr>
                  ))
                ) : paged.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-neutral-500">
                    {rows.length === 0 ? 'No GP registrations recorded yet.' : 'No registrations match your search.'}
                    {rows.length === 0 && canEdit && <div className="mt-1 text-[11px]">Use “Add GP Registration” to register a Service User with a GP.</div>}
                  </td></tr>
                ) : paged.map(({ d, reg }) => (
                  <tr key={d.su.id} className="hover:bg-[#fbfbfa]">
                    <td className="py-2.5 px-3 font-mono text-[11px]">{d.su.externalReference || d.su.suReference || <span className="text-neutral-400 italic">Not set</span>}</td>
                    <td className="py-2.5 px-3 font-medium text-[#242424]">{d.su.firstName} {d.su.lastName}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">{d.su.dateOfBirth ? formatUkDate(d.su.dateOfBirth) : <span className="text-neutral-400 italic">Not set</span>}</td>
                    <td className="py-2.5 px-3">{reg?.gpPractice || <span className="text-neutral-400 italic">Not recorded</span>}</td>
                    <td className="py-2.5 px-3">{reg?.pharmacy || <span className="text-neutral-400 italic">Not recorded</span>}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {!reg?.nhsNumber ? <span className="text-neutral-400 italic font-sans">Not recorded</span>
                        : canSeeNhs ? reg.nhsNumber : <span title="Restricted">{maskNhsNumber(reg.nhsNumber)}</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button type="button" title="View" onClick={() => setFormFor({ suId: d.su.id, readOnly: true })} className="p-1 text-[#605e5c] hover:bg-[#edebe9] rounded-xs cursor-pointer"><Eye className="w-3.5 h-3.5" /></button>
                        {canEdit && <button type="button" title="Edit" onClick={() => setFormFor({ suId: d.su.id })} className="p-1 text-[#605e5c] hover:bg-[#edebe9] rounded-xs cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>}
                        {canDeleteRecord() && reg && <button type="button" title="Delete" onClick={() => confirmDelete(d.su.id, reg.id, `${d.su.firstName} ${d.su.lastName}`)} className="p-1 text-[#a4262c] hover:bg-[#fceef1] rounded-xs cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <Pagination currentPage={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
        )}
      </div>

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xs border border-[#e5e5e5] shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e5e5e5] bg-[#faf9f8] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[#242424]">{readOnly ? 'GP Registration' : existing ? 'Edit GP Registration' : 'Add GP Registration'}</h3>
            <p className="text-[11px] text-neutral-500">One registration per Service User.</p>
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
                  <div><label className="block text-neutral-600 mb-1">GP practice</label><input className={inputCls} value={gp} onChange={e => setGp(e.target.value)} disabled={readOnly || loadingReg} /></div>
                  <div><label className="block text-neutral-600 mb-1">Pharmacy</label><input className={inputCls} value={pharmacy} onChange={e => setPharmacy(e.target.value)} disabled={readOnly || loadingReg} /></div>
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
