import React, { useState, useMemo } from 'react';
import { 
  HeartHandshake, 
  Plus, 
  Search, 
  Download, 
  Edit3, 
  Trash2, 
  Eye, 
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RFAWelfareCheckRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { useTableSchema } from '../../hooks/useTableSchema';
import { RFA_WELFARE_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';

const welfareExportColumns: ExportColumnOption[] = [
  { id: 'date', label: 'Check Date' },
  { id: 'siteName', label: 'Hotel / Site' },
  { id: 'roomOrFlatNo', label: 'Room / Flat No' },
  { id: 'name', label: 'Service User Name' },
  { id: 'dob', label: 'Date of Birth' },
  { id: 'group', label: 'Demographic Group' },
  { id: 'gender', label: 'Gender' },
  { id: 'portOrNassRef', label: 'Port / NASS Ref' },
  { id: 'vulnerability', label: 'Identified Vulnerability' },
  { id: 'actionTaken', label: 'Action Taken / Remedies' },
  { id: 'mhTicket', label: 'Migrant Help Ticket' }
];

export const RFAWelfareChecksView: React.FC = () => {
  const {
    rfaWelfareRecords,
    addRFAWelfareRecord,
    updateRFAWelfareRecord,
    deleteRFAWelfareRecord,
    allowedSites,
    assignedSite,
    canAccessAllSites,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole
  } = useApp();

  // Table Schema Hook
  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<RFAWelfareCheckRecord>('rfaWelfare', RFA_WELFARE_TABLE_COLUMNS);

  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState(!canAccessAllSites() ? assignedSite : 'all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RFAWelfareCheckRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<RFAWelfareCheckRecord | null>(null);

  const filteredRecords = useMemo(() => {
    return rfaWelfareRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.name.toLowerCase().includes(q) ||
        r.roomOrFlatNo.toLowerCase().includes(q) ||
        r.portOrNassRef.toLowerCase().includes(q) ||
        r.vulnerability.toLowerCase().includes(q) ||
        r.actionTaken.toLowerCase().includes(q) ||
        r.mhTicket.toLowerCase().includes(q) ||
        r.siteName.toLowerCase().includes(q);

      const matchesSite = siteFilter === 'all' || r.siteName === siteFilter;
      const matchesGroup = groupFilter === 'all' || r.group === groupFilter;

      return matchesSearch && matchesSite && matchesGroup;
    });
  }, [rfaWelfareRecords, searchQuery, siteFilter, groupFilter]);

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

  const handleCreateSubmit = (data: Partial<RFAWelfareCheckRecord>) => {
    addRFAWelfareRecord({
      date: data.date || new Date().toISOString().slice(0, 10),
      siteName: !canAccessAllSites() 
        ? assignedSite 
        : (data.siteName || (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0]))),
      roomOrFlatNo: data.roomOrFlatNo || '',
      name: data.name || '',
      dob: data.dob || '1995-01-01',
      group: data.group || 'Single Adult',
      gender: data.gender || 'Male',
      portOrNassRef: data.portOrNassRef || '',
      vulnerability: data.vulnerability || '',
      actionTaken: data.actionTaken || '',
      mhTicket: data.mhTicket || `MH-${Math.floor(10000 + Math.random() * 90000)}`,
      ...data,
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    } as any);
    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<RFAWelfareCheckRecord>) => {
    if (!editingRecord) return;
    updateRFAWelfareRecord(editingRecord.id, {
      ...editingRecord,
      ...data,
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    });
    setEditingRecord(null);
  };

  // Export Handlers with Custom Download & PDF/CSV Options
  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    let sourceData = rfaWelfareRecords;
    if (scope === 'filtered') sourceData = sortedRecords;
    else if (scope === 'custom' && startDate && endDate) {
      sourceData = rfaWelfareRecords.filter(w => {
        const d = w.date || '';
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      });
    }
    return sourceData;
  };

  const calculateDateRangeCount = (startDate: string, endDate: string): number => {
    return rfaWelfareRecords.filter(w => {
      const d = w.date || '';
      return (!startDate || d >= startDate) && (!endDate || d <= endDate);
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
      ? welfareExportColumns.filter(c => selectedColumns.includes(c.id))
      : welfareExportColumns;
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
      ? welfareExportColumns.filter(c => selectedColumns.includes(c.id))
      : welfareExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));

    if (format === 'csv') {
      exportTableToCsv({ filename: 'RFA_Welfare_Checks.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'RFA_Welfare_Checks.pdf',
        title: 'RFA Welfare Checks & Vulnerability Log',
        headers,
        rows,
        orientation
      });
    }
  };

  const renderColumnCell = (col: TableColumnConfig<RFAWelfareCheckRecord>, record: RFAWelfareCheckRecord) => {
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

    if (col.key === 'mhTicket') {
      return (
        <span className="font-mono text-[#0078d4] font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
          {value || '—'}
        </span>
      );
    }

    if (col.key === 'portOrNassRef') {
      return <span className="font-mono text-[#0f766e]">{value || '—'}</span>;
    }

    if (col.key === 'name') {
      return <span className="font-semibold text-[#242424]">{value || '—'}</span>;
    }

    if (col.type === 'date') {
      return <span className="font-mono text-[#323130]">{value || '—'}</span>;
    }

    if (value === null || value === undefined || value === '') {
      return <span className="text-[#a19f9d]">—</span>;
    }

    return String(value);
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-[#0078d4]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">
              RFA Welfare Checks
            </h1>
            <span className="text-xs bg-blue-50 text-[#0078d4] font-semibold px-2 py-0.5 rounded-xs border border-blue-200">
              {filteredRecords.length} Checks Logged
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Routine resident welfare assessments, vulnerabilities, initial accommodations and multi-agency health tickets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUserRole === 'Super Admin' && (
            <button
              type="button"
              onClick={() => setIsSchemaModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors"
              title="Super Admin: Customize table columns, headers, and fields"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#0078d4]" />
              <span>Customize Table</span>
            </button>
          )}

          <ExportDropdown
            moduleName="RFA Welfare Checks"
            totalRecordCount={rfaWelfareRecords.length}
            filteredRecordCount={filteredRecords.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={welfareExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />

          {canCreateRecord() && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0078d4] hover:bg-[#106ebe] text-white rounded-xs shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Log Welfare Check</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Site Filter */}
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

          {/* Group Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Group:</span>
            <select
              value={groupFilter}
              onChange={e => { setGroupFilter(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Groups</option>
              <option value="Single Adult">Single Adult</option>
              <option value="Family">Family</option>
              <option value="Couple">Couple</option>
              <option value="Vulnerable Adult">Vulnerable Adult</option>
            </select>
          </div>

          {/* Reset button */}
          {(siteFilter !== 'all' || groupFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSiteFilter('all');
                setGroupFilter('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-xs text-[#0078d4] hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#605e5c]" />
          <input
            type="text"
            placeholder="Search Resident, Port Ref, Flat No, MH Ticket..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-8 pr-3 py-1.5 border border-[#8a8886] rounded-xs text-[#323130] text-xs bg-white focus:outline-2 focus:outline-[#71afe5]"
          />
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
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
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#0078d4]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#0078d4]" />
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
                    <HeartHandshake className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No welfare checks found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ Log Welfare Check' to record a new resident welfare assessment.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(record => (
                  <tr key={record.id} className="hover:bg-[#f3f8fd] transition-colors">
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
                        {canEditRecord(record.siteName) && (
                          <button
                            onClick={() => setEditingRecord(record)}
                            className="p-1 hover:bg-[#eff6fc] text-[#0078d4] rounded-xs transition-colors"
                            title="Edit Welfare Check"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete welfare check for ${record.name}?`)) {
                                deleteRFAWelfareRecord(record.id);
                              }
                            }}
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
      <DynamicRecordFormModal<RFAWelfareCheckRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Log RFA Welfare Check"
        columns={columns}
        initialValues={{
          date: new Date().toISOString().slice(0, 10),
          siteName: !canAccessAllSites() ? assignedSite : (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])),
          roomOrFlatNo: '',
          name: '',
          dob: '1995-01-01',
          group: 'Single Adult',
          gender: 'Male',
          portOrNassRef: '',
          vulnerability: '',
          actionTaken: '',
          mhTicket: `MH-${Math.floor(10000 + Math.random() * 90000)}`,
          attachments: []
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Save Welfare Check"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<RFAWelfareCheckRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Welfare Check - ${editingRecord.name}`}
          columns={columns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Dossier Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<RFAWelfareCheckRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`Welfare Assessment Dossier - ${viewingRecord.name}`}
          columns={columns}
          record={viewingRecord}
          onEdit={() => {
            const rec = viewingRecord;
            setViewingRecord(null);
            setEditingRecord(rec);
          }}
          canEdit={canEditRecord(viewingRecord.siteName)}
        />
      )}

      {/* Super Admin Table Schema Customizer Modal */}
      <TableSchemaEditorModal<RFAWelfareCheckRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="RFA Welfare Checks"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
