import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Plus, Trash2, Edit3, Search, SlidersHorizontal, Eye, Shirt, Layers, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DailyLaundryRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { useTableSchema } from '../../hooks/useTableSchema';
import { DAILY_LAUNDRY_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { PropertyLaundryLogSection } from './PropertyLaundryLogSection';

const dailyLaundryExportColumns: ExportColumnOption[] = [
  { id: 'date', label: 'Date' },
  { id: 'site', label: 'Hotel / Property' },
  { id: 'house', label: 'House / Wing' },
  { id: 'roomNo', label: 'Room No.' },
  { id: 'quantityReceived', label: 'No of bags / Quantity Received' },
  { id: 'batches', label: 'No of Batches' },
  { id: 'doneBy', label: 'Done By' },
  { id: 'remarks', label: 'Remarks / Notes' }
];

export const DailyLaundryLogSection: React.FC = () => {
  const {
    defaultSiteFilter,
    dailyLaundryRecords,
    addDailyLaundryRecord,
    updateDailyLaundryRecord,
    deleteDailyLaundryRecord,
    allowedSites,
    assignedSite,
    canAccessAllSites,
    isSitePermitted,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    requestConfirmation
  } = useApp();

  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<DailyLaundryRecord>('dailyLaundry', DAILY_LAUNDRY_TABLE_COLUMNS);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [siteFilter, setSiteFilter] = useState(defaultSiteFilter);

  useEffect(() => {
    setSiteFilter(defaultSiteFilter);
  }, [defaultSiteFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DailyLaundryRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<DailyLaundryRecord | null>(null);

  const filteredRecords = useMemo(() => {
    return (dailyLaundryRecords || []).filter(rec => {
      if (!isSitePermitted(rec.site, siteFilter)) return false;
      if (selectedDate && rec.date !== selectedDate) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const str = `${rec.site || ''} ${rec.roomNo || ''} ${rec.house || ''} ${rec.doneBy || ''} ${rec.remarks || ''}`.toLowerCase();
        if (!str.includes(query)) return false;
      }
      return true;
    });
  }, [dailyLaundryRecords, isSitePermitted, siteFilter, selectedDate, searchQuery]);

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
      ? dailyLaundryExportColumns.filter(c => opts.selectedColumns!.includes(c.id))
      : dailyLaundryExportColumns;
    const headers = selectedCols.map(c => c.label);
    const rows = raw.map(row => selectedCols.map(c => String((row as any)[c.id] ?? '')));

    if (opts.format === 'csv') {
      exportTableToCsv({
        filename: `daily_laundry_log_${selectedDate || 'all'}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: `Daily Laundry Log – ${selectedDate || 'All Dates'}`,
        headers,
        rows,
        filename: `daily_laundry_log_${selectedDate || 'all'}.pdf`,
        orientation: opts.orientation
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters & Control bar */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#1e293b] flex items-center gap-2">
              <Shirt className="w-4 h-4 text-[#0d9488]" />
              Daily Resident Laundry Log (House, Room, Bags & Batches)
            </h2>
            <p className="text-xs text-[#64748b]">
              Log and track daily linen & clothing washing cycles per resident room (e.g. Clacton Pier Avenue Daily Laundry Log).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ExportDropdown
              moduleName="Daily Laundry Log"
              onExport={handleExport}
              availableColumns={dailyLaundryExportColumns}
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
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Daily Record
              </button>
            )}
          </div>
        </div>

        {/* Date and Property Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[#f1f5f9]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search room, house, done by..."
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

      {/* Table */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden flex flex-col justify-between min-h-[400px]">
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
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-8 text-center text-[#94a3b8]">
                    No daily laundry entries found for the selected date and filters. Click "Add Daily Record" to record laundry.
                  </td>
                </tr>
              ) : (
                paginatedData.map(rec => {
                  const canEdit = canEditRecord(rec.site);
                  const canDelete = canDeleteRecord();

                  return (
                    <tr key={rec.id} className="hover:bg-[#f8fafc] transition-colors">
                      {visibleColumns.map(col => {
                        const val = (rec as any)[col.key];
                        if (col.key === 'roomNo') {
                          return (
                            <td key={col.key} className="py-2.5 px-3 font-bold text-[#1e293b]">
                              Room {val}
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} className="py-2.5 px-3 text-[#334155]">
                            {val ?? '—'}
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewingRecord(rec)}
                            title="View log details"
                            className="p-1 text-[#64748b] hover:text-[#0d9488] hover:bg-slate-100 rounded"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => setEditingRecord(rec)}
                              title="Edit log"
                              className="p-1 text-[#64748b] hover:text-amber-600 hover:bg-amber-50 rounded"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => {
                                requestConfirmation({
                                  title: 'Delete Laundry Entry',
                                  message: `Permanently remove daily laundry log for Room ${rec.roomNo} (${rec.date})?`,
                                  confirmLabel: 'Delete Record',
                                  isDanger: true,
                                  onConfirm: async () => deleteDailyLaundryRecord(rec.id)
                                });
                              }}
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

      {/* CREATE MODAL */}
      <DynamicRecordFormModal<DailyLaundryRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Daily Laundry Entry"
        columns={columns}
        initialValues={{
          site: siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || ''),
          date: selectedDate || new Date().toISOString().slice(0, 10),
          quantityReceived: 1,
          batches: 1,
          doneBy: currentUserRole || 'Staff Member'
        }}
        onSave={(data) => {
          addDailyLaundryRecord({
            date: data.date || selectedDate || new Date().toISOString().slice(0, 10),
            site: data.site || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || '')),
            house: data.house || '',
            roomNo: data.roomNo || '',
            quantityReceived: data.quantityReceived || '1',
            batches: data.batches || '1',
            doneBy: data.doneBy || currentUserRole || 'Staff Member',
            remarks: data.remarks || '',
            attachments: Array.isArray(data.attachments) ? data.attachments : []
          });
          setIsCreateModalOpen(false);
        }}
      />

      {/* EDIT MODAL */}
      <DynamicRecordFormModal<DailyLaundryRecord>
        isOpen={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title={`Edit Laundry Record: Room ${editingRecord?.roomNo || ''}`}
        columns={columns}
        initialValues={editingRecord || undefined}
        isEdit={true}
        onSave={(data) => {
          if (!editingRecord) return;
          updateDailyLaundryRecord(editingRecord.id, {
            ...editingRecord,
            ...data
          });
          setEditingRecord(null);
        }}
      />

      {/* VIEW MODAL */}
      <DynamicRecordViewModal<DailyLaundryRecord>
        isOpen={Boolean(viewingRecord)}
        onClose={() => setViewingRecord(null)}
        title={`Daily Laundry Details: Room ${viewingRecord?.roomNo || ''}`}
        columns={columns}
        record={viewingRecord}
        onEdit={viewingRecord && canEditRecord(viewingRecord.site) ? () => {
          const rec = viewingRecord;
          setViewingRecord(null);
          setEditingRecord(rec);
        } : undefined}
      />

      {/* SCHEMA MODAL */}
      <TableSchemaEditorModal<DailyLaundryRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Daily Laundry Log"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};

export const LaundryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly_monthly'>('daily');

  return (
    <div className="space-y-4">
      {/* Tab Switcher Header */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xs border border-[#e2e8f0]">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold transition-all ${
              activeTab === 'daily'
                ? 'bg-white text-[#0d9488] shadow-2xs border border-[#cbd5e1]'
                : 'text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Daily Laundry Log (Room by Room)
          </button>

          <button
            onClick={() => setActiveTab('weekly_monthly')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold transition-all ${
              activeTab === 'weekly_monthly'
                ? 'bg-white text-[#0d9488] shadow-2xs border border-[#cbd5e1]'
                : 'text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Weekly & Monthly Property Laundry Summaries
          </button>
        </div>
      </div>

      {activeTab === 'daily' ? <DailyLaundryLogSection /> : <PropertyLaundryLogSection />}
    </div>
  );
};
