import React, { useState, useMemo } from 'react';
import { BulkActionToolbar } from '../common/BulkActionToolbar';
import { 
  ClipboardList, 
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
import { IRRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { useTableSchema } from '../../hooks/useTableSchema';
import { IR_TRACKER_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { ExportDropdown } from '../common/ExportDropdown';
import {
  irExportColumns,
  calculateIRDateRangeCount,
  getIRExportPreviewData,
  performIRExport
} from './irExportHelpers';

export const IRTrackerView: React.FC = () => {
  const {
    irRecords,
    addIRRecord,
    updateIRRecord,
    deleteIRRecord,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    assignedSite,
    canAccessAllSites,
    sites
  , requestConfirmation } = useApp();

  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<IRRecord>('irRecords', IR_TRACKER_TABLE_COLUMNS);

  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const handleToggleSelectAll = () => { setSelectedIds(prev => prev.length ? [] : paginatedData?.map(p => p.id) || []); };
  const handleToggleSelect = (e: any, id: string) => { e.stopPropagation(); setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (typeof requestConfirmation !== 'undefined') {
      requestConfirmation({
        title: 'Delete Selected', message: 'Are you sure you want to delete selected items?', isDanger: true,
        onConfirm: async () => { /* Add logic */ setSelectedIds([]); }
      });
    }
  };

  const [siteFilter, setSiteFilter] = useState('all');
  const [crhFilter, setCrhFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IRRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<IRRecord | null>(null);

  // Site isolation filter
  const accessibleRecords = useMemo(() => {
    if (canAccessAllSites()) return irRecords;
    if (!assignedSite || assignedSite === 'All Sites') return irRecords;
    return irRecords.filter(r => r.site?.toLowerCase() === assignedSite.toLowerCase());
  }, [irRecords, canAccessAllSites, assignedSite]);

  const filteredRecords = useMemo(() => {
    return accessibleRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.suName.toLowerCase().includes(q) ||
        r.site.toLowerCase().includes(q) ||
        (r.portRef && r.portRef.toLowerCase().includes(q)) ||
        (r.irSummary && r.irSummary.toLowerCase().includes(q));

      const matchesSite = siteFilter === 'all' || r.site === siteFilter;
      const matchesCrh = crhFilter === 'all' || (r.submittedToCrh || 'Pending') === crhFilter;

      return matchesSearch && matchesSite && matchesCrh;
    });
  }, [accessibleRecords, searchQuery, siteFilter, crhFilter]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc' 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredRecords, sortKey, sortOrder]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRecords.slice(startIndex, startIndex + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleCreateSubmit = (data: Partial<IRRecord>) => {
    addIRRecord({
      site: data.site || (assignedSite && assignedSite !== 'All Sites' ? assignedSite : 'Brit Hotel'),
      date: data.date || new Date().toISOString().slice(0, 10),
      suName: data.suName || '',
      portRef: data.portRef || '',
      irSummary: data.irSummary || '',
      incidentTime: data.incidentTime || '',
      inFor1stReview: data.inFor1stReview || '',
      ct1stReview: data.ct1stReview || '',
      inFor2ndReview: data.inFor2ndReview || '',
      ct2ndReview: data.ct2ndReview || '',
      submittedToCrh: data.submittedToCrh || 'Pending',
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      ...data
    } as any);
    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<IRRecord>) => {
    if (!editingRecord) return;
    updateIRRecord(editingRecord.id, {
      ...editingRecord,
      ...data,
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    });
    setEditingRecord(null);
  };

  const renderColumnCell = (col: TableColumnConfig<IRRecord>, record: IRRecord) => {
    if (col.renderCell) {
      return col.renderCell((record as any)[col.key], record);
    }

    const value = (record as any)[col.key];

    if (col.badgeColors && value) {
      const badgeClass = col.badgeColors[value] || 'bg-gray-100 text-gray-800';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-semibold ${badgeClass}`}>
          {value}
        </span>
      );
    }

    if (col.key === 'site') {
      return <span className="font-medium text-[#0f766e] bg-teal-50 px-2 py-0.5 rounded border border-teal-100">{value || '—'}</span>;
    }

    if (col.key === 'suName') {
      return <span className="font-semibold text-[#242424]">{value || '—'}</span>;
    }

    if (col.key === 'portRef') {
      return <span className="font-mono text-[#4338ca]">{value || '—'}</span>;
    }

    if (col.key === 'irSummary') {
      return (
        <span className="block max-w-xs truncate text-[#323130]" title={String(value || '')}>
          {value || '—'}
        </span>
      );
    }

    if (value === null || value === undefined || value === '') {
      return <span className="text-[#a19f9d]">—</span>;
    }

    return String(value);
  };

  const availableSites = useMemo(() => {
    return (sites || []).map(s => typeof s === 'string' ? s : s?.name).filter(Boolean);
  }, [sites]);

  return (
    <div className="space-y-4">
      {/* Top Banner, Header, Actions & Filters in ONE unified section */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 border border-teal-200 text-[#0d9488] rounded-xs">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424] tracking-tight">IR Tracker</h1>
                <span className="text-xs bg-teal-50 text-[#0d9488] font-semibold px-2 py-0.5 rounded-xs border border-teal-200">
                  {filteredRecords.length} Incident Reports
                </span>
              </div>
              <p className="text-xs text-neutral-500">Log, track 1st/2nd review progression, and monitor CRH submission status for incident reports.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {currentUserRole === 'Super Admin' && (
              <button
                type="button"
                onClick={() => setIsSchemaModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-neutral-50 text-neutral-700 border border-[#e5e5e5] rounded-xs shadow-2xs transition-colors"
                title="Super Admin: Customize table columns, headers, and fields"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>Customize Table</span>
              </button>
            )}

            <ExportDropdown
              moduleName="IR Tracker"
              totalRecordCount={accessibleRecords.length}
              filteredRecordCount={filteredRecords.length}
              defaultOrientation="landscape"
              dateRangeRecordCount={(s, e) => calculateIRDateRangeCount(accessibleRecords, s, e)}
              availableColumns={irExportColumns}
              getPreviewData={(params) => getIRExportPreviewData({ ...params, accessibleRecords, sortedRecords })}
              onExport={(params) => performIRExport({ ...params, accessibleRecords, sortedRecords })}
              buttonVariant="toolbar"
            />

            {canCreateRecord() && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Log Incident Report</span>
              </button>
            )}
          </div>
        </div>

        {/* Integrated Filter Row */}
        <div className={`mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 ${canAccessAllSites() ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2.5`}>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search SU Name, Site, Port Ref, Summary..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] placeholder-neutral-400 focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
            />
          </div>

          {canAccessAllSites() && (
            <select
              value={siteFilter}
              onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Sites</option>
              {availableSites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          <select
            value={crhFilter}
            onChange={e => { setCrhFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
          >
            <option value="all">All Statuses</option>
            {['Pending', 'Submitted', 'Under Review', 'CRH Approved', 'CRH Rejected', 'Not Applicable'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs min-h-[520px] lg:min-h-[calc(100vh-270px)] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                {visibleColumns.map(col => {
                  const isSorted = sortKey === col.key;
                  return (
                    <th 
                      key={String(col.key)} 
                      className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                      onClick={() => handleSort(String(col.key))}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.label}</span>
                        {isSorted ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#0d9488]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#0d9488]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-[#a19f9d]" />
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-[#605e5c]">
                    <ClipboardList className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No incident reports found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ Log Incident Report' to record a new incident report.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(record => (
                  <tr key={record.id} className="hover:bg-[#f0fdf4] transition-colors">
                    {visibleColumns.map(col => (
                      <td key={String(col.key)} className="p-2.5">
                        {renderColumnCell(col, record)}
                      </td>
                    ))}
                    <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingRecord(record)}
                          className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs transition-colors"
                          title="View Details Dossier"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditRecord() && (
                          <button
                            onClick={() => setEditingRecord(record)}
                            className="p-1 hover:bg-teal-50 text-[#0d9488] rounded-xs transition-colors"
                            title="Edit Incident Report"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => deleteIRRecord(record.id)}
                            className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredRecords.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {/* Dynamic Create Modal */}
      <DynamicRecordFormModal<IRRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Log Incident Report (IR Tracker)"
        columns={columns}
        initialValues={{
          site: assignedSite && assignedSite !== 'All Sites' ? assignedSite : 'Brit Hotel',
          date: new Date().toISOString().slice(0, 10),
          suName: '',
          portRef: '',
          irSummary: '',
          incidentTime: '',
          inFor1stReview: '',
          ct1stReview: '',
          inFor2ndReview: '',
          ct2ndReview: '',
          submittedToCrh: 'Pending',
          attachments: []
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Save IR Record"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<IRRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit IR Record - ${editingRecord.suName || editingRecord.id}`}
          columns={columns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Dossier Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<IRRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`Incident Report Dossier - ${viewingRecord.suName || viewingRecord.id}`}
          columns={columns}
          record={viewingRecord}
          onEdit={() => {
            const rec = viewingRecord;
            setViewingRecord(null);
            setEditingRecord(rec);
          }}
          canEdit={canEditRecord()}
        />
      )}

      {/* Super Admin Table Schema Customizer Modal */}
      <TableSchemaEditorModal<IRRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="IR Tracker"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
