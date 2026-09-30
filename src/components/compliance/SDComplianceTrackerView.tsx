import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
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
import { SDComplianceRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { useTableSchema } from '../../hooks/useTableSchema';
import { SD_COMPLIANCE_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';

const complianceExportColumns: ExportColumnOption[] = [
  { id: 'siteName', label: 'Hotel / Site' },
  { id: 'complianceType', label: 'Certificate / Compliance Type' },
  { id: 'contractorName', label: 'Contractor Name' },
  { id: 'contractorKeyContact', label: 'Key Contact' },
  { id: 'contractorEmail', label: 'Contractor Email' },
  { id: 'issuedDate', label: 'Issued Date' },
  { id: 'expiryDate', label: 'Expiry Date' },
  { id: 'status', label: 'Compliance Status' },
  { id: 'actionTaken', label: 'Action Taken / Remedies' },
  { id: 'previousContractor', label: 'Previous Contractor' }
];

export const SDComplianceTrackerView: React.FC = () => {
  const {complianceRecords,
    addComplianceRecord,
    updateComplianceRecord,
    deleteComplianceRecord,
    allowedSites,
    assignedSite,
    canAccessAllSites,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    getFieldOptions
  } = useApp();


  // Dynamic compliance types and statuses from Field Options Setup
  const complianceTypeOptions = React.useMemo(() => getFieldOptions('complianceTypes', false), [getFieldOptions]);
  const complianceStatusOptions = React.useMemo(() => getFieldOptions('complianceStatuses', false), [getFieldOptions]);
  // Table Schema Hook
  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<SDComplianceRecord>('compliance', SD_COMPLIANCE_TABLE_COLUMNS);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState(!canAccessAllSites() ? assignedSite : 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('expiryDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SDComplianceRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<SDComplianceRecord | null>(null);

  const filteredRecords = useMemo(() => {
    return complianceRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.complianceType.toLowerCase().includes(q) ||
        r.contractorName.toLowerCase().includes(q) ||
        r.contractorKeyContact.toLowerCase().includes(q) ||
        r.contractorEmail.toLowerCase().includes(q) ||
        (r.previousContractor && r.previousContractor.toLowerCase().includes(q)) ||
        (r.actionTaken && r.actionTaken.toLowerCase().includes(q)) ||
        (r.siteName && r.siteName.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesType = typeFilter === 'all' || r.complianceType.toLowerCase().includes(typeFilter.toLowerCase());
      const matchesSite = siteFilter === 'all' || r.siteName === siteFilter;

      return matchesSearch && matchesStatus && matchesType && matchesSite;
    });
  }, [complianceRecords, searchQuery, statusFilter, typeFilter, siteFilter]);

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

  const handleCreateSubmit = (data: Partial<SDComplianceRecord>) => {
    addComplianceRecord({
      srNo: complianceRecords.length + 1,
      complianceType: data.complianceType || 'Fire Risk Assessment (FRA)',
      contractorName: data.contractorName || '',
      contractorKeyContact: data.contractorKeyContact || '',
      contractorEmail: data.contractorEmail || '',
      issuedDate: data.issuedDate || new Date().toISOString().slice(0, 10),
      expiryDate: data.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: (data.status as any) || 'Compliant',
      actionTaken: data.actionTaken || '',
      previousContractor: data.previousContractor || '',
      siteName: !canAccessAllSites() 
        ? assignedSite 
        : (data.siteName || (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0]))),
      ...data,
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    } as any);
    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<SDComplianceRecord>) => {
    if (!editingRecord) return;
    updateComplianceRecord(editingRecord.id, {
      ...editingRecord,
      ...data,
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    });
    setEditingRecord(null);
  };

  // Export Handlers with Custom Download & PDF/CSV Options
  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    let sourceData = complianceRecords;
    if (scope === 'filtered') sourceData = sortedRecords;
    else if (scope === 'custom' && startDate && endDate) {
      sourceData = complianceRecords.filter(c => {
        const d = c.issuedDate || c.expiryDate || '';
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      });
    }
    return sourceData;
  };

  const calculateDateRangeCount = (startDate: string, endDate: string): number => {
    return complianceRecords.filter(c => {
      const d = c.issuedDate || c.expiryDate || '';
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
      ? complianceExportColumns.filter(c => selectedColumns.includes(c.id))
      : complianceExportColumns;
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
      ? complianceExportColumns.filter(c => selectedColumns.includes(c.id))
      : complianceExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));

    if (format === 'csv') {
      exportTableToCsv({ filename: 'SD_Compliance_Register.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'SD_Compliance_Register.pdf',
        title: 'Statutory Compliance & Contractor Certification Dossier',
        headers,
        rows,
        orientation
      });
    }
  };

  const renderColumnCell = (col: TableColumnConfig<SDComplianceRecord>, record: SDComplianceRecord) => {
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

    if (col.key === 'complianceType') {
      return <span className="font-semibold text-[#242424]">{value || '—'}</span>;
    }

    if (col.key === 'contractorName') {
      return <span className="font-medium text-[#0f766e]">{value || '—'}</span>;
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
      {/* Top Banner, Header, Actions & Filters in ONE unified section */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424] tracking-tight">
                  SD Compliance Tracker
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {filteredRecords.length} Certifications
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Statutory safety certifications, FRA, CP12 gas, EICR electrical, emergency lighting, and contractor renewals.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {currentUserRole === 'Super Admin' && (
              <button
                type="button"
                onClick={() => setIsSchemaModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
                title="Super Admin: Customize table columns, headers, and fields"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>Customize Table</span>
              </button>
            )}

            <ExportDropdown
              moduleName="Compliance Certificates"
              totalRecordCount={complianceRecords.length}
              filteredRecordCount={filteredRecords.length}
              defaultOrientation="landscape"
              dateRangeRecordCount={calculateDateRangeCount}
              availableColumns={complianceExportColumns}
              getPreviewData={getExportPreviewData}
              onExport={handlePerformExport}
            />

            {canCreateRecord() && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Certificate</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar integrated into the same card */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Compliance, Contractor, Contact..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            />
          </div>

          <div>
            <select
              value={siteFilter}
              onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Sites</option>
              {allowedSites.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Statuses</option>
              {complianceStatusOptions.length > 0
                ? complianceStatusOptions.map(o => <option key={o.id} value={o.value || o.label}>{o.label}</option>)
                : ['Compliant', 'Expiring Soon', 'Expired', 'In Progress', 'Overdue'].map(s => <option key={s} value={s}>{s}</option>)
              }
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Compliance Types</option>
              {complianceTypeOptions.length > 0
                ? complianceTypeOptions.map(o => <option key={o.id} value={o.value || o.label}>{o.label}</option>)
                : ['Fire', 'Gas', 'Electrical', 'Emergency', 'Legionella', 'PAT', 'Asbestos', 'Insurance'].map(t => <option key={t} value={t}>{t}</option>)
              }
            </select>
          </div>
        </div>
      </div>

      {/* Main Table in a SEPARATE card */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs min-h-[520px] lg:min-h-[calc(100vh-270px)] flex flex-col justify-between">
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
                    <ShieldCheck className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No compliance certificates found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ Add Certificate' to register a property safety inspection.</p>
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
                            className="p-1 hover:bg-[#f0fdf4] text-[#107c41] rounded-xs transition-colors"
                            title="Edit Certificate"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete ${record.complianceType}?`)) {
                                deleteComplianceRecord(record.id);
                              }
                            }}
                            className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs transition-colors"
                            title="Delete Certificate"
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
      <DynamicRecordFormModal<SDComplianceRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register Compliance Certificate"
        columns={columns}
        initialValues={{
          srNo: complianceRecords.length + 1,
          complianceType: 'Fire Risk Assessment (FRA)',
          contractorName: '',
          contractorKeyContact: '',
          contractorEmail: '',
          issuedDate: new Date().toISOString().slice(0, 10),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          status: 'Compliant',
          actionTaken: '',
          previousContractor: '',
          siteName: !canAccessAllSites() ? assignedSite : (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])),
          attachments: []
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Register Certificate"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<SDComplianceRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Certificate - ${editingRecord.complianceType}`}
          columns={columns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Dossier Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<SDComplianceRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`Compliance Audit Dossier - ${viewingRecord.complianceType}`}
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
      <TableSchemaEditorModal<SDComplianceRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="SD Compliance Tracker"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
