import React, { useState, useMemo, useEffect } from 'react';
import { BulkActionToolbar } from '../common/BulkActionToolbar';
import { 
  ShieldAlert,
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MHComplaintWelfareRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { useTableSchema } from '../../hooks/useTableSchema';
import { MH_COMPLAINT_WELFARE_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';

const mhExportColumns: ExportColumnOption[] = [
  { id: 'date', label: 'Complaint Date' },
  { id: 'siteName', label: 'Hotel / Property' },
  { id: 'roomOrFlatNo', label: 'Room / Flat' },
  { id: 'name', label: 'Service User Name' },
  { id: 'dob', label: 'DOB' },
  { id: 'portOrNassRef', label: 'Port / NASS Reference' },
  { id: 'mhTicketRef', label: 'MH Ticket Reference' },
  { id: 'complaintCategory', label: 'Category' },
  { id: 'complaintDetails', label: 'Complaint Summary / Details' },
  { id: 'actionTaken', label: 'Action Taken & Interventions' },
  { id: 'status', label: 'Status' },
  { id: 'dutyStaff', label: 'Duty Staff' }
];

export const MHComplaintWelfareChecksView: React.FC = () => {
  const {
    mhComplaintWelfareRecords,
    addMHComplaintWelfareRecord,
    updateMHComplaintWelfareRecord,
    deleteMHComplaintWelfareRecord,
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

  // Table Schema Hook
  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<MHComplaintWelfareRecord>('mhComplaintWelfare', MH_COMPLAINT_WELFARE_TABLE_COLUMNS);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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

  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MHComplaintWelfareRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<MHComplaintWelfareRecord | null>(null);

  const filteredRecords = useMemo(() => {
    return (mhComplaintWelfareRecords || []).filter(rec => {
      if (!isSitePermitted(rec.siteName, siteFilter)) return false;
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchableFields = [
          rec.name,
          rec.portOrNassRef,
          rec.mhTicketRef,
          rec.roomOrFlatNo,
          rec.complaintDetails,
          rec.actionTaken,
          rec.complaintCategory,
          rec.dutyStaff
        ];
        return searchableFields.some(field => field && field.toLowerCase().includes(query));
      }

      return true;
    });
  }, [mhComplaintWelfareRecords, isSitePermitted, siteFilter, statusFilter, searchQuery]);

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

  const handleToggleSelectAll = () => {
    setSelectedIds(prev => prev.length ? [] : paginatedData.map(p => p.id));
  };

  const handleToggleSelect = (e: any, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    requestConfirmation({
      title: 'Delete Selected MH-Complaint Records',
      message: `Are you sure you want to delete ${selectedIds.length} selected complaint records?`,
      confirmLabel: 'Delete All Selected',
      isDanger: true,
      onConfirm: async () => {
        for (const id of selectedIds) {
          deleteMHComplaintWelfareRecord(id);
        }
        setSelectedIds([]);
      }
    });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // Export handlers
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
      ? mhExportColumns.filter(c => opts.selectedColumns!.includes(c.id))
      : mhExportColumns;
    const headers = selectedCols.map(c => c.label);
    const rows = raw.map(row => selectedCols.map(c => String((row as any)[c.id] ?? '')));

    if (opts.format === 'csv') {
      exportTableToCsv({
        filename: `mh_complaint_welfare_checks_${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: 'MH-Complaint Welfare Checks Dossier',
        headers,
        rows,
        filename: `mh_complaint_welfare_checks_${new Date().toISOString().slice(0, 10)}.pdf`,
        orientation: opts.orientation
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xs bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0d9488]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1e293b]">MH-Complaint Welfare Checks</h1>
              <p className="text-xs text-[#64748b]">
                Dedicated register for tracking Migrant Help (MH) complaints, service-user welfare issues, and multi-agency remedies
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ExportDropdown
              moduleName="MH-Complaint Welfare"
              onExport={handleExport}
              availableColumns={mhExportColumns}
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
                Add MH Complaint
              </button>
            )}
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-[#f1f5f9]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search SU name, port ref, MH ticket, room..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden"
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

          <div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Under Review">Under Review</option>
              <option value="Escalated">Escalated</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden flex flex-col justify-between min-h-[460px]">
        {selectedIds.length > 0 && (
          <BulkActionToolbar
            selectedCount={selectedIds.length}
            totalCount={sortedRecords.length}
            onSelectAll={handleToggleSelectAll}
            onClearSelection={() => setSelectedIds([])}
            onDeleteSelected={canDeleteRecord() ? handleDeleteSelected : undefined}
          />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569]">
                <th className="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={paginatedData.length > 0 && selectedIds.length === paginatedData.length}
                    onChange={handleToggleSelectAll}
                    className="rounded text-[#0d9488] focus:ring-[#0d9488]"
                  />
                </th>
                {visibleColumns.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
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
                  <td colSpan={visibleColumns.length + 2} className="py-8 text-center text-[#94a3b8]">
                    No MH-Complaint welfare records match the selected criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map(rec => {
                  const isSelected = selectedIds.includes(rec.id);
                  const canEdit = canEditRecord(rec.siteName);
                  const canDelete = canDeleteRecord();

                  return (
                    <tr
                      key={rec.id}
                      className={`hover:bg-[#f8fafc] transition-colors ${isSelected ? 'bg-teal-50/50' : ''}`}
                    >
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => handleToggleSelect(e, rec.id)}
                          className="rounded text-[#0d9488] focus:ring-[#0d9488]"
                        />
                      </td>

                      {visibleColumns.map(col => {
                        const val = (rec as any)[col.key];
                        if (col.key === 'status') {
                          const badgeColor = 
                            val === 'Resolved' || val === 'Closed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                            val === 'Escalated' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                            val === 'Under Review' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                            'bg-sky-100 text-sky-800 border-sky-200';
                          return (
                            <td key={col.key} className="py-2.5 px-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeColor}`}>
                                {val || 'Open'}
                              </span>
                            </td>
                          );
                        }
                        if (col.key === 'mhTicketRef') {
                          return (
                            <td key={col.key} className="py-2.5 px-3 font-mono font-bold text-[#0d9488]">
                              {val || '—'}
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} className="py-2.5 px-3 text-[#334155] max-w-xs truncate">
                            {val ?? '—'}
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewingRecord(rec)}
                            title="View record dossier"
                            className="p-1 text-[#64748b] hover:text-[#0d9488] hover:bg-slate-100 rounded"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => setEditingRecord(rec)}
                              title="Edit record"
                              className="p-1 text-[#64748b] hover:text-amber-600 hover:bg-amber-50 rounded"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => deleteMHComplaintWelfareRecord(rec.id)}
                              title="Delete record"
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

        {/* Pagination Toolbar */}
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
      <DynamicRecordFormModal<MHComplaintWelfareRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add MH-Complaint Welfare Check"
        columns={columns}
        initialValues={{
          siteName: siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || ''),
          date: new Date().toISOString().slice(0, 10),
          status: 'Open',
          dutyStaff: currentUserRole || 'Duty Staff'
        }}
        onSave={(data) => {
          addMHComplaintWelfareRecord({
            date: data.date || new Date().toISOString().slice(0, 10),
            siteName: data.siteName || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || '')),
            roomOrFlatNo: data.roomOrFlatNo || '',
            name: data.name || '',
            dob: data.dob || '',
            portOrNassRef: data.portOrNassRef || '',
            mhTicketRef: data.mhTicketRef || '',
            complaintCategory: data.complaintCategory || 'Facilities / Rooms',
            complaintDetails: data.complaintDetails || '',
            actionTaken: data.actionTaken || '',
            status: data.status || 'Open',
            dutyStaff: data.dutyStaff || currentUserRole || 'Staff',
            notes: data.notes || '',
            attachments: Array.isArray(data.attachments) ? data.attachments : []
          });
          setIsCreateModalOpen(false);
        }}
      />

      {/* EDIT MODAL */}
      <DynamicRecordFormModal<MHComplaintWelfareRecord>
        isOpen={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title={`Edit MH Complaint: ${editingRecord?.name || ''}`}
        columns={columns}
        initialValues={editingRecord || undefined}
        isEdit={true}
        onSave={(data) => {
          if (!editingRecord) return;
          updateMHComplaintWelfareRecord(editingRecord.id, {
            ...editingRecord,
            ...data
          });
          setEditingRecord(null);
        }}
      />

      {/* VIEW MODAL */}
      <DynamicRecordViewModal<MHComplaintWelfareRecord>
        isOpen={Boolean(viewingRecord)}
        onClose={() => setViewingRecord(null)}
        title={`MH Complaint Dossier: ${viewingRecord?.name || ''}`}
        columns={columns}
        record={viewingRecord}
        onEdit={viewingRecord && canEditRecord(viewingRecord.siteName) ? () => {
          const rec = viewingRecord;
          setViewingRecord(null);
          setEditingRecord(rec);
        } : undefined}
      />

      {/* SCHEMA EDITOR */}
      <TableSchemaEditorModal<MHComplaintWelfareRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="MH-Complaint Welfare Checks"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
