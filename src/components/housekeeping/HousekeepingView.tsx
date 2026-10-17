import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, Plus, Trash2, Edit3, Search, SlidersHorizontal, Eye, CheckCircle2, Clock, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { HousekeepingRecord, HousekeepingRoomCheck } from '../../types';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { useTableSchema } from '../../hooks/useTableSchema';
import { HOUSEKEEPING_TABLE_COLUMNS } from '../../data/defaultTableSchemas';

const housekeepingExportColumns: ExportColumnOption[] = [
  { id: 'date', label: 'Date' },
  { id: 'site', label: 'Hotel / Property' },
  { id: 'communalAreasSweptMopped', label: 'Communal Swept/Mopped' },
  { id: 'windowsWiped', label: 'Windows Wiped' },
  { id: 'furnitureDusted', label: 'Furniture Dusted' },
  { id: 'staffToiletsCleaned', label: 'Staff Toilets Disinfected' },
  { id: 'mirrorsCleaned', label: 'Mirrors Shined' },
  { id: 'fridgesCleaned', label: 'Fridges Cleaned (Thu/Sun)' },
  { id: 'liftsStairsCleaned', label: 'Lifts/Stairs Cleaned (Sat/Sun)' },
  { id: 'officesCleaned', label: 'Offices Cleaned (Sun)' },
  { id: 'inspectedBy', label: 'Inspected By' }
];

export const HousekeepingView: React.FC = () => {
  const {
    housekeepingRecords,
    addHousekeepingRecord,
    updateHousekeepingRecord,
    deleteHousekeepingRecord,
    allowedSites,
    assignedSite,
    canAccessAllSites,
    isSitePermitted,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole
  } = useApp();

  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<HousekeepingRecord>('housekeeping', HOUSEKEEPING_TABLE_COLUMNS);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [siteFilter, setSiteFilter] = useState(() => {
    if (assignedSite && assignedSite !== 'All Sites' && assignedSite !== 'all') return assignedSite;
    return 'all';
  });

  useEffect(() => {
    if (assignedSite === 'All Sites' || assignedSite === 'all') {
      if (canAccessAllSites() || (allowedSites && allowedSites.length > 1)) {
        setSiteFilter('all');
      }
    } else if (assignedSite) {
      setSiteFilter(assignedSite);
    }
  }, [assignedSite, canAccessAllSites, allowedSites]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals & Active Record
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HousekeepingRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<HousekeepingRecord | null>(null);

  // New room check row state inside modal/card
  const [activeRoomLogs, setActiveRoomLogs] = useState<HousekeepingRoomCheck[]>([]);

  const filteredRecords = useMemo(() => {
    return (housekeepingRecords || []).filter(rec => {
      if (!isSitePermitted(rec.site, siteFilter)) return false;
      if (selectedDate && rec.date !== selectedDate) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const str = `${rec.site || ''} ${rec.inspectedBy || ''} ${rec.notes || ''}`.toLowerCase();
        if (!str.includes(query)) return false;
      }
      return true;
    });
  }, [housekeepingRecords, isSitePermitted, siteFilter, selectedDate, searchQuery]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let aVal = (a as any)[sortKey];
      let bVal = (b as any)[sortKey];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRecords, sortKey, sortOrder]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const handleExport = (opts: {
    format: ExportFormat;
    scope: ExportScope;
    orientation: ExportOrientation;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => {
    const raw = sortedRecords;
    const selectedCols = opts.selectedColumns && opts.selectedColumns.length > 0
      ? housekeepingExportColumns.filter(c => opts.selectedColumns!.includes(c.id))
      : housekeepingExportColumns;
    const headers = selectedCols.map(c => c.label);
    const rows = raw.map(row => selectedCols.map(c => String((row as any)[c.id] ?? '')));

    if (opts.format === 'csv') {
      exportTableToCsv({
        filename: `housekeeping_log_${selectedDate || 'all'}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: `Housekeeping Log Dossier – ${selectedDate || 'All Dates'}`,
        headers,
        rows,
        filename: `housekeeping_log_${selectedDate || 'all'}.pdf`,
        orientation: opts.orientation
      });
    }
  };

  // Helper to open create modal
  const handleOpenCreate = () => {
    setActiveRoomLogs([
      { roomNo: '', showerHeads: 'Yes', bedding: 'Yes', washroom: 'Yes', floor: 'Yes', cleanedBy: currentUserRole || 'Staff Member' }
    ]);
    setIsCreateModalOpen(true);
  };

  // One modal serves both "add" and "edit"
  const isFormOpen = isCreateModalOpen || !!editingRecord;
  const closeForm = () => {
    setIsCreateModalOpen(false);
    setEditingRecord(null);
    setActiveRoomLogs([]);
  };
  const checked = (key: keyof HousekeepingRecord, whenNew: boolean) =>
    editingRecord ? Boolean(editingRecord[key]) : whenNew;
  const formSite = editingRecord?.site || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || ''));
  const siteOptions = !formSite || allowedSites.includes(formSite) ? allowedSites : [formSite, ...allowedSites];

  return (
    <div className="space-y-4">
      {/* Top Banner Card */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xs bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1e293b]">Daily Housekeeping & Room Clean Log</h1>
              <p className="text-xs text-[#64748b]">
                Record communal cleaning tasks (windows, floors, fridges, lifts) and room sanitation inspections (shower heads, bedding, washroom, floor).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ExportDropdown
              moduleName="Housekeeping Log"
              onExport={handleExport}
              availableColumns={housekeepingExportColumns}
              totalRecordCount={sortedRecords.length}
              filteredRecordCount={sortedRecords.length}
            />

            <button
              onClick={() => setIsSchemaModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#cbd5e1] rounded-xs text-xs font-semibold text-[#475569] bg-white hover:bg-[#f8fafc] transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Columns
            </button>

            {canCreateRecord() && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Daily Housekeeping Log
              </button>
            )}
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[#f1f5f9]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search property, inspector, notes..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden"
            />
          </div>

          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => { setSelectedDate(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden font-semibold text-[#1e293b]"
            />
          </div>

          <div>
            <select
              value={siteFilter}
              onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); }}
              disabled={!canAccessAllSites() && (allowedSites || []).length <= 1}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden"
            >
              {(canAccessAllSites() || (allowedSites && allowedSites.length > 1)) && (
                <option value="all">
                  {canAccessAllSites() ? `All Properties (${allowedSites.length})` : `All Assigned Sites (${allowedSites.length})`}
                </option>
              )}
              {allowedSites.map((s, idx) => (
                <option key={`${s}-${idx}`} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
              className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xs border border-slate-300"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate('')}
              className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-600 rounded-xs border border-slate-300"
            >
              View All Dates
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden flex flex-col justify-between min-h-[460px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569]">
                {visibleColumns.map(col => (
                  <th
                    key={col.key}
                    onClick={() => {
                      if (sortKey === col.key) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                      else { setSortKey(col.key); setSortOrder('asc'); }
                    }}
                    className="py-2.5 px-3 font-semibold cursor-pointer hover:bg-slate-100 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      {sortKey === col.key ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#0d9488]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#0d9488]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-[#94a3b8] opacity-50" />
                      )}
                    </div>
                  </th>
                ))}
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Rooms Logged</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="py-8 text-center text-[#94a3b8]">
                    No daily housekeeping logs recorded for this date.
                  </td>
                </tr>
              ) : (
                paginatedData.map(rec => {
                  const canEdit = canEditRecord(rec.site);
                  const canDelete = canDeleteRecord();
                  const roomCount = rec.roomLogs?.length || 0;

                  return (
                    <tr key={rec.id} className="hover:bg-[#f8fafc] transition-colors">
                      {visibleColumns.map(col => {
                        const val = (rec as any)[col.key];

                        // Boolean checklist pills
                        if (typeof val === 'boolean') {
                          return (
                            <td key={col.key} className="py-2.5 px-3 whitespace-nowrap">
                              {val ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" /> Done
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-50 text-slate-500 border border-slate-200">
                                  <Clock className="w-3 h-3" /> Pending
                                </span>
                              )}
                            </td>
                          );
                        }

                        return (
                          <td key={col.key} className="py-2.5 px-3 text-[#334155] whitespace-nowrap">
                            {val ?? '—'}
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          {roomCount} {roomCount === 1 ? 'Room' : 'Rooms'} Checked
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewingRecord(rec)}
                            title="View full inspection dossier"
                            className="p-1 text-[#64748b] hover:text-[#0d9488] hover:bg-slate-100 rounded"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => {
                                setEditingRecord(rec);
                                setActiveRoomLogs(rec.roomLogs || []);
                              }}
                              title="Edit log & room check list"
                              className="p-1 text-[#64748b] hover:text-amber-600 hover:bg-amber-50 rounded"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => deleteHousekeepingRecord(rec.id)}
                              title="Delete log"
                              className="p-1 text-[#64748b] hover:text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-[#e2e8f0] bg-white">
          <Pagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={sortedRecords.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* CREATE / EDIT & ROOM CHECKS MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xs shadow-xl border border-[#cbd5e1] max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1e293b]">
                {editingRecord ? 'Edit Daily Housekeeping Log & Rooms Cleaned Checklist' : 'Daily Housekeeping Log & Rooms Cleaned Checklist'}
              </h2>
              <button type="button" onClick={closeForm} className="text-[#64748b] hover:text-[#1e293b] font-bold">✕</button>
            </div>

            <form
              key={editingRecord ? editingRecord.id : 'new-housekeeping-log'}
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);

                const payload = {
                  date: (formData.get('date') as string) || selectedDate || new Date().toISOString().slice(0, 10),
                  site: (formData.get('site') as string) || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || '')),
                  communalAreasSweptMopped: formData.get('communalAreasSweptMopped') === 'on',
                  windowsWiped: formData.get('windowsWiped') === 'on',
                  furnitureDusted: formData.get('furnitureDusted') === 'on',
                  staffToiletsCleaned: formData.get('staffToiletsCleaned') === 'on',
                  mirrorsCleaned: formData.get('mirrorsCleaned') === 'on',
                  fridgesCleaned: formData.get('fridgesCleaned') === 'on',
                  liftsStairsCleaned: formData.get('liftsStairsCleaned') === 'on',
                  officesCleaned: formData.get('officesCleaned') === 'on',
                  inspectedBy: (formData.get('inspectedBy') as string) || currentUserRole || 'Staff Member',
                  notes: (formData.get('notes') as string) || '',
                  roomLogs: activeRoomLogs.filter(r => r.roomNo.trim() !== '')
                };

                if (editingRecord) {
                  updateHousekeepingRecord(editingRecord.id, payload);
                } else {
                  addHousekeepingRecord(payload);
                }

                closeForm();
              }}
              className="flex-1 overflow-y-auto p-5 space-y-5"
            >
              {/* Top metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Date</label>
                  <input
                    type="date"
                    name="date"
                    defaultValue={editingRecord?.date || selectedDate || new Date().toISOString().slice(0, 10)}
                    required
                    className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Hotel / Property</label>
                  <select
                    name="site"
                    defaultValue={formSite}
                    required
                    className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs text-xs font-semibold"
                  >
                    {siteOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Inspected / Done By</label>
                  <input
                    type="text"
                    name="inspectedBy"
                    defaultValue={editingRecord?.inspectedBy || currentUserRole || 'Housekeeping Staff'}
                    required
                    className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs text-xs"
                  />
                </div>
              </div>

              {/* Communal Area Daily Checklist */}
              <div className="bg-[#f8fafc] border border-[#e2e8f0] p-4 rounded-xs">
                <h3 className="text-xs font-bold text-[#1e293b] uppercase tracking-wider mb-2.5 text-[#0d9488]">
                  Communal Cleaning Checklist (Clacton Pier Avenue Standards)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#334155]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="communalAreasSweptMopped" defaultChecked={checked('communalAreasSweptMopped', true)} className="rounded text-[#0d9488]" />
                    <span>All communal areas are swept, vacuumed and mopped.</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="windowsWiped" defaultChecked={checked('windowsWiped', true)} className="rounded text-[#0d9488]" />
                    <span>All windows are wiped down.</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="furnitureDusted" defaultChecked={checked('furnitureDusted', true)} className="rounded text-[#0d9488]" />
                    <span>All furniture is dusted and cleaned.</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="staffToiletsCleaned" defaultChecked={checked('staffToiletsCleaned', true)} className="rounded text-[#0d9488]" />
                    <span>All staff toilets are thoroughly cleaned and disinfected.</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="mirrorsCleaned" defaultChecked={checked('mirrorsCleaned', true)} className="rounded text-[#0d9488]" />
                    <span>All mirrors are cleaned and shined.</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="fridgesCleaned" defaultChecked={checked('fridgesCleaned', false)} className="rounded text-[#0d9488]" />
                    <span>Communal fridges cleaned (Thursday & Sunday).</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="liftsStairsCleaned" defaultChecked={checked('liftsStairsCleaned', false)} className="rounded text-[#0d9488]" />
                    <span>All the Lifts and stairs cleaned (Saturday & Sunday).</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="officesCleaned" defaultChecked={checked('officesCleaned', false)} className="rounded text-[#0d9488]" />
                    <span>All offices cleaned (Sunday).</span>
                  </label>
                </div>
              </div>

              {/* Room Cleaning Matrix */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-[#1e293b] uppercase tracking-wider text-[#0d9488]">
                    Rooms Cleaned Matrix (Room no, Shower heads, Bedding, Washroom, Floor, Cleaned by)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveRoomLogs(prev => [
                      ...prev,
                      { roomNo: '', showerHeads: 'Yes', bedding: 'Yes', washroom: 'Yes', floor: 'Yes', cleanedBy: currentUserRole || 'Staff Member' }
                    ])}
                    className="px-2 py-1 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs"
                  >
                    + Add Room Row
                  </button>
                </div>

                <div className="border border-[#e2e8f0] rounded-xs overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#f1f5f9] text-[#475569] font-bold">
                      <tr>
                        <th className="p-2">Room No</th>
                        <th className="p-2">Shower Heads</th>
                        <th className="p-2">Bedding</th>
                        <th className="p-2">Washroom</th>
                        <th className="p-2">Floor</th>
                        <th className="p-2">Cleaned By</th>
                        <th className="p-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {activeRoomLogs.map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-2">
                            <input
                              type="text"
                              placeholder="e.g. 101"
                              value={row.roomNo}
                              onChange={e => {
                                const val = e.target.value;
                                setActiveRoomLogs(prev => prev.map((r, i) => i === idx ? { ...r, roomNo: val } : r));
                              }}
                              className="w-24 px-2 py-1 border border-[#cbd5e1] rounded-xs font-bold"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={String(row.showerHeads)}
                              onChange={e => {
                                const val = e.target.value;
                                setActiveRoomLogs(prev => prev.map((r, i) => i === idx ? { ...r, showerHeads: val } : r));
                              }}
                              className="px-2 py-1 border border-[#cbd5e1] rounded-xs"
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                              <option value="N/A">N/A</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              value={String(row.bedding)}
                              onChange={e => {
                                const val = e.target.value;
                                setActiveRoomLogs(prev => prev.map((r, i) => i === idx ? { ...r, bedding: val } : r));
                              }}
                              className="px-2 py-1 border border-[#cbd5e1] rounded-xs"
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              value={String(row.washroom)}
                              onChange={e => {
                                const val = e.target.value;
                                setActiveRoomLogs(prev => prev.map((r, i) => i === idx ? { ...r, washroom: val } : r));
                              }}
                              className="px-2 py-1 border border-[#cbd5e1] rounded-xs"
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              value={String(row.floor)}
                              onChange={e => {
                                const val = e.target.value;
                                setActiveRoomLogs(prev => prev.map((r, i) => i === idx ? { ...r, floor: val } : r));
                              }}
                              className="px-2 py-1 border border-[#cbd5e1] rounded-xs"
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.cleanedBy}
                              onChange={e => {
                                const val = e.target.value;
                                setActiveRoomLogs(prev => prev.map((r, i) => i === idx ? { ...r, cleanedBy: val } : r));
                              }}
                              className="w-32 px-2 py-1 border border-[#cbd5e1] rounded-xs"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => setActiveRoomLogs(prev => prev.filter((_, i) => i !== idx))}
                              className="text-rose-500 hover:text-rose-700 font-bold"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase mb-1">General Notes / Remarks</label>
                <textarea
                  name="notes"
                  defaultValue={editingRecord?.notes || ''}
                  rows={2}
                  placeholder="Additional observations or notes for the day..."
                  className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs text-xs"
                />
              </div>

              <div className="pt-3 border-t border-[#e2e8f0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 border border-[#cbd5e1] rounded-xs text-xs font-semibold text-[#475569] hover:bg-[#f8fafc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold"
                >
                  {editingRecord ? 'Save Changes' : 'Save Daily Housekeeping Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DOSSIER MODAL */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xs shadow-xl border border-[#cbd5e1] max-w-3xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-[#1e293b]">Housekeeping Inspection Dossier</h2>
              <button onClick={() => setViewingRecord(null)} className="font-bold text-[#64748b]">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="font-semibold text-slate-500">Date:</span> {viewingRecord.date}</div>
              <div><span className="font-semibold text-slate-500">Site:</span> {viewingRecord.site}</div>
              <div><span className="font-semibold text-slate-500">Inspector:</span> {viewingRecord.inspectedBy}</div>
            </div>

            <div className="bg-slate-50 p-3 rounded border text-xs space-y-1">
              <h4 className="font-bold text-slate-700">Communal Clean Status:</h4>
              <p>Communal Areas Swept/Mopped: {viewingRecord.communalAreasSweptMopped ? 'Yes' : 'No'}</p>
              <p>Windows Wiped: {viewingRecord.windowsWiped ? 'Yes' : 'No'}</p>
              <p>Furniture Dusted: {viewingRecord.furnitureDusted ? 'Yes' : 'No'}</p>
              <p>Staff Toilets Disinfected: {viewingRecord.staffToiletsCleaned ? 'Yes' : 'No'}</p>
              <p>Mirrors Shined: {viewingRecord.mirrorsCleaned ? 'Yes' : 'No'}</p>
              <p>Fridges Cleaned: {viewingRecord.fridgesCleaned ? 'Yes' : 'No'}</p>
              <p>Lifts & Stairs Cleaned: {viewingRecord.liftsStairsCleaned ? 'Yes' : 'No'}</p>
              <p>Offices Cleaned: {viewingRecord.officesCleaned ? 'Yes' : 'No'}</p>
            </div>

            <div>
              <h4 className="font-bold text-xs text-slate-700 mb-2">Rooms Cleaned ({viewingRecord.roomLogs?.length || 0}):</h4>
              <div className="border rounded overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2">Room</th>
                      <th className="p-2">Shower Heads</th>
                      <th className="p-2">Bedding</th>
                      <th className="p-2">Washroom</th>
                      <th className="p-2">Floor</th>
                      <th className="p-2">Cleaned By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingRecord.roomLogs || []).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-bold">{r.roomNo}</td>
                        <td className="p-2">{String(r.showerHeads)}</td>
                        <td className="p-2">{String(r.bedding)}</td>
                        <td className="p-2">{String(r.washroom)}</td>
                        <td className="p-2">{String(r.floor)}</td>
                        <td className="p-2">{r.cleanedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setViewingRecord(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCHEMA MODAL */}
      <TableSchemaEditorModal<HousekeepingRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Daily Housekeeping Log"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
