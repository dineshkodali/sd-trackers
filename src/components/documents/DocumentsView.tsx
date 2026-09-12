import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Eye, 
  Edit3,
  Search, 
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DocumentRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { useTableSchema } from '../../hooks/useTableSchema';
import { DOCUMENTS_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';

const documentsExportColumns: ExportColumnOption[] = [
  { id: 'documentTitle', label: 'Document Title' },
  { id: 'site', label: 'Hotel / Site' },
  { id: 'suName', label: 'Resident Name' },
  { id: 'refNumber', label: 'Port Ref' },
  { id: 'category', label: 'Category' },
  { id: 'fileFormat', label: 'Format' },
  { id: 'fileSizeKb', label: 'Size (KB)' },
  { id: 'confidentiality', label: 'Confidentiality' },
  { id: 'uploadedBy', label: 'Uploaded By' },
  { id: 'uploadDate', label: 'Upload Date' },
  { id: 'notes', label: 'Notes' }
];

export const DocumentsView: React.FC = () => {
  const {
    documents,
    allowedSites,
    addDocument,
    updateDocument,
    deleteDocument,
    canDeleteRecord,
    canEditRecord,
    canCreateRecord,
    canAccessAllSites,
    assignedSite,
    settings,
    currentUserRole
  } = useApp();

  // Table Schema Hook
  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<DocumentRecord>('documents', DOCUMENTS_TABLE_COLUMNS);

  const [siteFilter, setSiteFilter] = useState<string>(canAccessAllSites() ? 'all' : assignedSite);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(settings.pageSize || 10);
  const [sortKey, setSortKey] = useState<string>('uploadDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DocumentRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<DocumentRecord | null>(null);

  const filteredData = useMemo(() => {
    return documents.filter(d => {
      if (siteFilter !== 'all' && d.site !== siteFilter) return false;
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const str = `${d.documentTitle || ''} ${d.suName || ''} ${d.refNumber || ''} ${d.category || ''} ${d.uploadedBy || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [documents, siteFilter, categoryFilter, searchQuery]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      return sortOrder === 'asc' 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredData, sortKey, sortOrder]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (field: string) => {
    if (sortKey === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(field);
      setSortOrder('asc');
    }
  };

  const handleCreateSubmit = (data: Partial<DocumentRecord>) => {
    const effectiveSite = !canAccessAllSites() 
      ? assignedSite 
      : (data.site || (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])));
    addDocument({
      documentTitle: data.documentTitle || 'Untitled Document',
      suName: data.suName || '',
      refNumber: data.refNumber || '',
      category: (data.category as any) || 'Risk Assessment',
      site: effectiveSite,
      fileFormat: (data.fileFormat as any) || 'PDF',
      fileSizeKb: Number(data.fileSizeKb) || 1420,
      confidentiality: (data.confidentiality as any) || 'Restricted',
      uploadedBy: data.uploadedBy || 'Regional SG Officer',
      uploadDate: data.uploadDate || new Date().toISOString().slice(0, 10),
      notes: data.notes || '',
      ...data
    } as any);
    setIsUploadModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<DocumentRecord>) => {
    if (!editingRecord) return;
    updateDocument(editingRecord.id, {
      ...editingRecord,
      ...data
    });
    setEditingRecord(null);
  };

  // Export handlers
  const calculateDateRangeCount = (startDate: string, endDate: string): number => {
    return documents.filter(d => (!startDate || d.uploadDate >= startDate) && (!endDate || d.uploadDate <= endDate)).length;
  };

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    let sourceData = documents;
    if (scope === 'filtered') sourceData = sortedData;
    else if (scope === 'custom' && startDate && endDate) {
      sourceData = documents.filter(d => d.uploadDate >= startDate && d.uploadDate <= endDate);
    }
    return sourceData;
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
      ? documentsExportColumns.filter(c => selectedColumns.includes(c.id))
      : documentsExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] || '')));
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
      ? documentsExportColumns.filter(c => selectedColumns.includes(c.id))
      : documentsExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] || '')));

    if (format === 'csv') {
      exportTableToCsv({ filename: 'Compliance_Documents.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'Compliance_Documents.pdf',
        title: 'Compliance & Document Repository Report',
        headers,
        rows,
        orientation
      });
    }
  };

  const renderColumnCell = (col: TableColumnConfig<DocumentRecord>, doc: DocumentRecord) => {
    if (col.renderCell) {
      return col.renderCell((doc as any)[col.key], doc);
    }

    const value = (doc as any)[col.key];

    if (col.badgeColors && value) {
      const badgeClass = col.badgeColors[value] || 'bg-gray-100 text-gray-800';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-semibold ${badgeClass}`}>
          {value}
        </span>
      );
    }

    if (col.key === 'documentTitle') {
      return (
        <div className="flex items-center gap-2 font-semibold text-[#242424]">
          <FileText className="w-3.5 h-3.5 text-[#0078d4] shrink-0" />
          <span>{value}</span>
        </div>
      );
    }

    if (col.key === 'refNumber') {
      return <span className="font-mono text-[#0f766e]">{value || '—'}</span>;
    }

    if (col.key === 'fileFormat') {
      return (
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#edebe9] text-[#323130] font-semibold">
          {value || 'PDF'}
        </span>
      );
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <h2 className="text-2xl font-semibold text-[#242424] tracking-tight">
            Compliance &amp; Document Repository
          </h2>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Store risk assessments, local authority MOUs, medical assessments, and safeguarding support plans.
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
            moduleName="Documents"
            totalRecordCount={documents.length}
            filteredRecordCount={filteredData.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={documentsExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />

          {canCreateRecord && canCreateRecord() && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>+ Upload Document</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white border border-[#e1dfdd] p-3 rounded-xs flex flex-wrap items-end gap-3 text-xs">
        <div className="flex-1 min-w-[140px]">
          <label className="font-semibold text-[#605e5c] block mb-1">Hotel / Site</label>
          <select
            value={siteFilter}
            onChange={e => setSiteFilter(e.target.value)}
            disabled={!canAccessAllSites()}
            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
          >
            {canAccessAllSites() && <option value="all">All Sites ({allowedSites.length})</option>}
            {allowedSites.map((s, idx) => <option key={`${s}-${idx}`} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="font-semibold text-[#605e5c] block mb-1">Category</label>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
          >
            <option value="all">All Categories</option>
            <option value="Risk Assessment">Risk Assessment</option>
            <option value="Safeguarding Plan">Safeguarding Plan</option>
            <option value="Medical Assessment">Medical Assessment</option>
            <option value="Incident Report">Incident Report</option>
            <option value="Proof of Support">Proof of Support</option>
            <option value="Consent Form">Consent Form</option>
          </select>
        </div>

        <div className="flex-[2] min-w-[180px]">
          <label className="font-semibold text-[#605e5c] block mb-1">Search Documents</label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search document title, resident, ref..."
              className="w-full pl-8 pr-2 py-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
            />
            <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        <button
          onClick={() => {
            setSiteFilter(canAccessAllSites() ? 'all' : assignedSite);
            setCategoryFilter('all');
            setSearchQuery('');
          }}
          className="px-3 py-2 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold"
        >
          Reset
        </button>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
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
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-[#605e5c]">
                    <FileText className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No documents found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click 'Upload Document' to index a new compliance file.</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map(doc => (
                  <tr key={doc.id} className="hover:bg-[#f3f8fd] transition-colors">
                    {visibleColumns.map(col => (
                      <td key={String(col.key)} className="p-2.5">
                        {renderColumnCell(col, doc)}
                      </td>
                    ))}
                    <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingRecord(doc)}
                          className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs transition-colors"
                          title="View Document Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditRecord && canEditRecord(doc.site) && (
                          <button
                            onClick={() => setEditingRecord(doc)}
                            className="p-1 hover:bg-[#f0fdfa] text-[#0d9488] rounded-xs transition-colors"
                            title="Edit Document Info"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete "${doc.documentTitle}"?`)) {
                                deleteDocument(doc.id);
                              }
                            }}
                            className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs transition-colors"
                            title="Delete Document"
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

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredData.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {/* Dynamic Create Modal */}
      <DynamicRecordFormModal<DocumentRecord>
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload & Index Document"
        columns={columns}
        initialValues={{
          documentTitle: '',
          suName: '',
          refNumber: '',
          category: 'Risk Assessment',
          site: !canAccessAllSites() ? assignedSite : (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])),
          fileFormat: 'PDF',
          fileSizeKb: 1420,
          confidentiality: 'Restricted',
          uploadedBy: 'Regional SG Officer',
          uploadDate: new Date().toISOString().slice(0, 10),
          notes: ''
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Upload Document"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<DocumentRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Document - ${editingRecord.documentTitle}`}
          columns={columns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Dossier Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<DocumentRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`Document Dossier - ${viewingRecord.documentTitle}`}
          columns={columns}
          record={viewingRecord}
          onEdit={() => {
            const rec = viewingRecord;
            setViewingRecord(null);
            setEditingRecord(rec);
          }}
          canEdit={canEditRecord ? canEditRecord(viewingRecord.site) : true}
        />
      )}

      {/* Super Admin Table Schema Customizer Modal */}
      <TableSchemaEditorModal<DocumentRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Compliance & Document Repository"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
