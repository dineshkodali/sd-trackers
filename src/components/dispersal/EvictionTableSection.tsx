import React, { useState, useMemo } from 'react';
import { 
  UserMinus, 
  Send,
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PlaneTakeoff
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EvictionRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { useTableSchema } from '../../hooks/useTableSchema';
import { EVICTION_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';

const evictionExportColumns: ExportColumnOption[] = [
  { id: 'hotel', label: 'Hotel / Site' },
  { id: 'roomNo', label: 'Room / Unit' },
  { id: 'portRef', label: 'Port / NASS Ref' },
  { id: 'suName', label: 'Service User Name' },
  { id: 'noticeDate', label: 'Notice Issued Date' },
  { id: 'evictionDate', label: 'Eviction / Effective Date' },
  { id: 'evictionReason', label: 'Eviction Reason' },
  { id: 'status', label: 'Notice Status' },
  { id: 'notes', label: 'Case Notes / Comments' }
];

interface EvictionTableSectionProps {
  activeTab: 'dispersal' | 'eviction';
  onTabChange: (tab: 'dispersal' | 'eviction') => void;
  dispersalCount: number;
  evictionCount: number;
}

export const EvictionTableSection: React.FC<EvictionTableSectionProps> = ({
  onTabChange,
  dispersalCount,
  evictionCount
}) => {
  const {
    evictionRecords,
    addEvictionRecord,
    updateEvictionRecord,
    deleteEvictionRecord,
    dailyRegisterRecords,
    updateDailyRegisterRecord,
    allowedSites,
    assignedSite,
    canAccessAllSites,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole
  } = useApp();

  const {
    columns,
    saveColumns,
    resetToDefault
  } = useTableSchema<EvictionRecord>('evictions', EVICTION_TABLE_COLUMNS);

  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState(!canAccessAllSites() ? assignedSite : 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('evictionDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EvictionRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<EvictionRecord | null>(null);

  const filteredRecords = useMemo(() => {
    return evictionRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.suName.toLowerCase().includes(q) ||
        r.portRef.toLowerCase().includes(q) ||
        (r.roomNo && r.roomNo.toLowerCase().includes(q)) ||
        (r.evictionReason && r.evictionReason.toLowerCase().includes(q)) ||
        (r.hotel && r.hotel.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q));

      const matchesSite = siteFilter === 'all' || r.hotel?.toLowerCase() === siteFilter.toLowerCase();
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

      return matchesSearch && matchesSite && matchesStatus;
    });
  }, [evictionRecords, searchQuery, siteFilter, statusFilter]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
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

  const handleCreateSubmit = (data: Partial<EvictionRecord>) => {
    const recordStatus = data.status || 'Notice Issued';
    const effectiveSite = !canAccessAllSites()
      ? assignedSite
      : (data.hotel || (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0] || 'Brit Hotel')));

    addEvictionRecord({
      hotel: effectiveSite,
      roomNo: data.roomNo || '',
      portRef: data.portRef || '',
      suName: data.suName || '',
      noticeDate: data.noticeDate || new Date().toISOString().slice(0, 10),
      evictionDate: data.evictionDate || new Date().toISOString().slice(0, 10),
      evictionReason: data.evictionReason || '',
      status: recordStatus,
      notes: data.notes || '',
      attachments: []
    } as any);

    if (recordStatus === 'Evicted' && data.portRef) {
      const matched = dailyRegisterRecords.find(dr => dr.portRef.toLowerCase().trim() === data.portRef?.toLowerCase().trim());
      if (matched) {
        updateDailyRegisterRecord(matched.id, { occupied: 'No', availableToBook: 'Yes' });
      }
    }

    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<EvictionRecord>) => {
    if (!editingRecord) return;
    const newStatus = data.status || editingRecord.status;
    updateEvictionRecord(editingRecord.id, { ...editingRecord, ...data });

    if (newStatus === 'Evicted' && editingRecord.status !== 'Evicted') {
      const matched = dailyRegisterRecords.find(dr => 
        dr.portRef.toLowerCase().trim() === editingRecord.portRef.toLowerCase().trim()
      );
      if (matched) {
        updateDailyRegisterRecord(matched.id, { occupied: 'No', availableToBook: 'Yes' });
      }
    }
    setEditingRecord(null);
  };

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    if (scope === 'filtered') return sortedRecords;
    if (scope === 'custom' && startDate && endDate) {
      return evictionRecords.filter(d => {
        const val = d.evictionDate || d.noticeDate || '';
        return (!startDate || val >= startDate) && (!endDate || val <= endDate);
      });
    }
    return evictionRecords;
  };

  const calculateDateRangeCount = (startDate: string, endDate: string): number => {
    return evictionRecords.filter(d => {
      const val = d.evictionDate || d.noticeDate || '';
      return (!startDate || val >= startDate) && (!endDate || val <= endDate);
    }).length;
  };

  const getExportPreviewData = ({
    scope,
    startDate,
    endDate,
    selectedColumns
  }: {
    scope: ExportScope;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    orientation: ExportOrientation;
    isCompact: boolean;
  }) => {
    const raw = getExportDataForScope(scope, startDate, endDate).slice(0, 5);
    const cols = selectedColumns && selectedColumns.length > 0
      ? evictionExportColumns.filter(c => selectedColumns.includes(c.id))
      : evictionExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));
    return { headers, rows };
  };

  const handlePerformExport = ({
    format,
    scope,
    orientation = 'landscape',
    startDate,
    endDate,
    selectedColumns
  }: {
    format: ExportFormat;
    scope: ExportScope;
    orientation: ExportOrientation;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => {
    const raw = getExportDataForScope(scope, startDate, endDate);
    const cols = selectedColumns && selectedColumns.length > 0
      ? evictionExportColumns.filter(c => selectedColumns.includes(c.id))
      : evictionExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));

    if (format === 'csv') {
      exportTableToCsv({ filename: 'Eviction_Notices_Log.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: `Evictions_${new Date().toISOString().slice(0, 10)}.pdf`,
        title: 'Cessation & Eviction Notices Log',
        subtitle: `Eviction notices for ${siteFilter === 'all' ? 'All Permitted Sites' : siteFilter}`,
        headers,
        rows,
        orientation
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Standard Page View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <PlaneTakeoff className="w-5 h-5 text-[#a4262c]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">
              Dispersal Sheet
            </h1>
            <span className="text-xs bg-red-50 text-[#a4262c] font-semibold px-2 py-0.5 rounded-xs border border-red-200">
              {filteredRecords.length} Eviction Notices
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Record, audit, and manage Home Office cessation notices, appeals, and room vacation orders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUserRole === 'Super Admin' && (
            <button
              type="button"
              onClick={() => setIsSchemaModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
              title="Super Admin: Customize table columns, headers, and fields"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#0078d4]" />
              <span>Customize Table</span>
            </button>
          )}

          <ExportDropdown
            moduleName="Evictions"
            totalRecordCount={evictionRecords.length}
            filteredRecordCount={filteredRecords.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={evictionExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />

          {canCreateRecord() && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#a4262c] hover:bg-[#8f1d22] text-white rounded-xs shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Record Eviction</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Toolbar with Integrated Tab Switcher */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Tab Switcher: Dispersal Sheet | Cessation & Eviction Notices */}
          <div className="flex items-center bg-[#f3f2f1] p-0.5 rounded-xs border border-[#8a8886]/40">
            <button
              type="button"
              id="tab-switcher-dispersal"
              onClick={() => onTabChange('dispersal')}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xs text-[#605e5c] hover:text-[#242424] transition-colors cursor-pointer"
            >
              <Send className="w-3 h-3 text-[#0078d4]" />
              <span>Dispersal Sheet</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-[#e1dfdd] text-[#605e5c]">
                {dispersalCount}
              </span>
            </button>

            <button
              type="button"
              id="tab-switcher-eviction"
              onClick={() => onTabChange('eviction')}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xs bg-white text-[#a4262c] shadow-xs cursor-pointer"
            >
              <UserMinus className="w-3 h-3 text-[#a4262c]" />
              <span>Cessation &amp; Eviction Notices</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-red-100 text-[#a4262c]">
                {evictionCount}
              </span>
            </button>
          </div>

          <div className="h-5 w-px bg-[#e1dfdd] hidden sm:block" />

          {/* Beside it: Site Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Site:</span>
            <select
              value={siteFilter}
              onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Sites</option>
              {allowedSites.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Status:</span>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Statuses</option>
              <option value="Notice Issued">Notice Issued</option>
              <option value="Pending Appeal">Pending Appeal</option>
              <option value="Evicted">Evicted</option>
            </select>
          </div>

          {(siteFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSiteFilter('all');
                setStatusFilter('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-xs text-[#0078d4] hover:underline font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#605e5c]" />
          <input
            type="text"
            placeholder="Search Port Ref, SU Name, Room..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-8 pr-3 py-1.5 border border-[#8a8886] rounded-xs text-[#323130] text-xs bg-white focus:outline-2 focus:outline-[#71afe5]"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[500px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th className="p-2.5 cursor-pointer hover:bg-[#edebe9]" onClick={() => handleSort('hotel')}>
                  <div className="flex items-center gap-1.5">
                    <span>Hotel</span>
                    {sortKey === 'hotel' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0078d4]" /> : <ArrowDown className="w-3 h-3 text-[#0078d4]" />) : <ArrowUpDown className="w-3 h-3 text-[#a19f9d]" />}
                  </div>
                </th>
                <th className="p-2.5">Room</th>
                <th className="p-2.5 cursor-pointer hover:bg-[#edebe9]" onClick={() => handleSort('portRef')}>
                  <div className="flex items-center gap-1.5">
                    <span>Port Ref</span>
                    {sortKey === 'portRef' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0078d4]" /> : <ArrowDown className="w-3 h-3 text-[#0078d4]" />) : <ArrowUpDown className="w-3 h-3 text-[#a19f9d]" />}
                  </div>
                </th>
                <th className="p-2.5 cursor-pointer hover:bg-[#edebe9]" onClick={() => handleSort('suName')}>
                  <div className="flex items-center gap-1.5">
                    <span>SU Name</span>
                    {sortKey === 'suName' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0078d4]" /> : <ArrowDown className="w-3 h-3 text-[#0078d4]" />) : <ArrowUpDown className="w-3 h-3 text-[#a19f9d]" />}
                  </div>
                </th>
                <th className="p-2.5">Notice Date</th>
                <th className="p-2.5 cursor-pointer hover:bg-[#edebe9]" onClick={() => handleSort('evictionDate')}>
                  <div className="flex items-center gap-1.5">
                    <span>Eviction Date</span>
                    {sortKey === 'evictionDate' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0078d4]" /> : <ArrowDown className="w-3 h-3 text-[#0078d4]" />) : <ArrowUpDown className="w-3 h-3 text-[#a19f9d]" />}
                  </div>
                </th>
                <th className="p-2.5">Reason</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right w-24 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#605e5c]">
                    <UserMinus className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No eviction records logged</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ Record Eviction' if an eviction or cessation notice is served.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(evict => (
                  <tr key={evict.id} className="hover:bg-[#fdf3f4] transition-colors">
                    <td className="p-2.5 font-medium">{evict.hotel}</td>
                    <td className="p-2.5 font-mono text-[#0f766e]">{evict.roomNo || '—'}</td>
                    <td className="p-2.5 font-mono text-indigo-700">{evict.portRef}</td>
                    <td className="p-2.5 font-semibold text-[#242424]">{evict.suName}</td>
                    <td className="p-2.5 text-[#605e5c]">{evict.noticeDate || '—'}</td>
                    <td className="p-2.5 font-medium">{evict.evictionDate}</td>
                    <td className="p-2.5 max-w-xs truncate text-[#323130]" title={evict.evictionReason}>
                      {evict.evictionReason}
                    </td>
                    <td className="p-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        evict.status === 'Evicted' 
                          ? 'bg-red-100 text-red-800 border border-red-200' 
                          : evict.status === 'Pending Appeal' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-amber-100 text-amber-800'
                      }`}>
                        {evict.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingRecord(evict)}
                          className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditRecord() && (
                          <button
                            onClick={() => setEditingRecord(evict)}
                            className="p-1 hover:bg-teal-50 text-[#0d9488] rounded-xs cursor-pointer"
                            title="Edit Eviction"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete eviction notice for ${evict.suName}?`)) {
                                deleteEvictionRecord(evict.id);
                              }
                            }}
                            className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs cursor-pointer"
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

        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredRecords.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {/* Dynamic Create Modal */}
      <DynamicRecordFormModal<EvictionRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Record Eviction Notice"
        columns={columns}
        initialValues={{
          hotel: !canAccessAllSites() ? assignedSite : (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0] || 'Brit Hotel')),
          noticeDate: new Date().toISOString().slice(0, 10),
          evictionDate: new Date().toISOString().slice(0, 10),
          status: 'Notice Issued'
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Save Eviction Record"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<EvictionRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Eviction: ${editingRecord.suName}`}
          columns={columns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<EvictionRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`Eviction Dossier: ${viewingRecord.suName} (${viewingRecord.portRef})`}
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

      {/* Super Admin Schema Customizer */}
      <TableSchemaEditorModal<EvictionRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Eviction Log Table"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
