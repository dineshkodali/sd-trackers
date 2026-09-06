import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Download, 
  Upload, 
  Search, 
  X,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DocumentRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';

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
    deleteDocument,
    canDeleteRecord,
    canAccessAllSites,
    assignedSite,
    settings
  } = useApp();

  const [siteFilter, setSiteFilter] = useState<string>(canAccessAllSites() ? 'all' : assignedSite);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(settings.pageSize || 10);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const initialFormData = {
    documentTitle: '',
    suName: '',
    refNumber: '',
    category: 'Risk Assessment' as DocumentRecord['category'],
    site: allowedSites[0] || 'Hotel A',
    fileFormat: 'PDF' as DocumentRecord['fileFormat'],
    fileSizeKb: 1420,
    confidentiality: 'Restricted' as DocumentRecord['confidentiality'],
    uploadedBy: 'Regional SG Officer',
    uploadDate: new Date().toISOString().slice(0, 10),
    notes: ''
  };

  const [formData, setFormData] = useState(initialFormData);

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

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.documentTitle) {
      alert('Document Title is required.');
      return;
    }
    addDocument(formData);
    setIsUploadModalOpen(false);
    setFormData(initialFormData);
  };

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    if (scope === 'filtered') return filteredData;
    if (scope === 'custom' && startDate && endDate) {
      return documents.filter(d => d.uploadDate >= startDate && d.uploadDate <= endDate);
    }
    return documents;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (d: DocumentRecord) => string | number }> => ({
    documentTitle: { label: 'Title', getValue: d => d.documentTitle },
    site: { label: 'Site', getValue: d => d.site },
    suName: { label: 'Resident', getValue: d => d.suName },
    refNumber: { label: 'Port Ref', getValue: d => d.refNumber },
    category: { label: 'Category', getValue: d => d.category },
    fileFormat: { label: 'Format', getValue: d => d.fileFormat },
    fileSizeKb: { label: 'Size (KB)', getValue: d => d.fileSizeKb },
    confidentiality: { label: 'Confidentiality', getValue: d => d.confidentiality },
    uploadedBy: { label: 'Uploaded By', getValue: d => d.uploadedBy },
    uploadDate: { label: 'Date', getValue: d => d.uploadDate },
    notes: { label: 'Notes', getValue: d => d.notes || '—' }
  });

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
    const dataToExport = getExportDataForScope(scope, startDate, endDate);
    const colMap = getExportColumnMap();
    const cols = selectedColumns && selectedColumns.length > 0
      ? selectedColumns
      : documentsExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(d => activeCols.map(c => colMap[c].getValue(d)));
    return { headers, rows };
  };

  const handlePerformExport = ({
    format,
    scope,
    orientation,
    startDate,
    endDate,
    selectedColumns,
    isCompact
  }: {
    format: ExportFormat;
    scope: ExportScope;
    orientation: ExportOrientation;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => {
    const dataToExport = getExportDataForScope(scope, startDate, endDate);
    const colMap = getExportColumnMap();
    const cols = selectedColumns && selectedColumns.length > 0
      ? selectedColumns
      : documentsExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(d => activeCols.map(c => colMap[c].getValue(d)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `Documents-Repository-${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: 'Compliance & Document Repository Register',
        subtitle: 'Official register of risk assessments, safeguarding support plans, and certified resident document records.',
        filename: `Documents-Repository-${scope}-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        orientation,
        isCompact,
        metadata: [
          { label: 'Site Filter', value: siteFilter === 'all' ? 'All Permitted Sites' : siteFilter },
          { label: 'Category Filter', value: categoryFilter === 'all' ? 'All Categories' : categoryFilter },
          { label: 'Export Scope', value: scope === 'all' ? 'All Documents' : scope === 'filtered' ? 'Current Filtered View' : `${startDate} to ${endDate}` },
          { label: 'Page Layout', value: orientation },
          { label: 'Total Files', value: dataToExport.length }
        ]
      });
    }
  };

  const calculateDateRangeCount = (start: string, end: string) => {
    return documents.filter(d => d.uploadDate >= start && d.uploadDate <= end).length;
  };

  const handleDownloadDoc = (doc: DocumentRecord) => {
    const textContent = `SG Accommodation Support Tracker - Document Certificate
Title: ${doc.documentTitle}
Resident: ${doc.suName}
Reference: ${doc.refNumber}
Category: ${doc.category}
Hotel/Site: ${doc.site}
Format: ${doc.fileFormat} (${doc.fileSizeKb} KB)
Confidentiality: ${doc.confidentiality}
Uploaded By: ${doc.uploadedBy}
Date: ${doc.uploadDate}
Notes: ${doc.notes || 'None'}

This document record is certified under safeguarding accommodation compliance protocols.`;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(doc.documentTitle || 'document').toLowerCase().replace(/[^a-z0-9]/g, '-')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <h2 className="text-2xl font-semibold text-[#242424] tracking-tight">
            Compliance & Document Repository
          </h2>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Store risk assessments, local authority MOUs, medical assessments, and safeguarding support plans.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

          <button
            onClick={() => {
              setFormData({ ...initialFormData, site: allowedSites[0] || 'Hotel A' });
              setIsUploadModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>+ Upload Document</span>
          </button>
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

      {/* Documents Table */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold">
                <th className="p-2.5">Document Title</th>
                <th className="p-2.5">Hotel / Site</th>
                <th className="p-2.5">Resident & Ref</th>
                <th className="p-2.5">Category</th>
                <th className="p-2.5">Format & Size</th>
                <th className="p-2.5">Confidentiality</th>
                <th className="p-2.5">Uploaded By</th>
                <th className="p-2.5">Date</th>
                <th className="p-2.5 text-right whitespace-nowrap w-24 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-[#605e5c]">
                    No compliance documents found.
                  </td>
                </tr>
              ) : (
                paginatedData.map(doc => {
                  const canDelete = canDeleteRecord();

                  return (
                    <tr key={doc.id} className="hover:bg-[#fafafa]">
                      <td className="p-2.5 font-semibold text-[#0f766e]">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#0d9488]" />
                          <span>{doc.documentTitle}</span>
                        </div>
                      </td>
                      <td className="p-2.5 font-medium text-[#242424]">{doc.site}</td>
                      <td className="p-2.5 text-neutral-800">
                        <div>{doc.suName}</div>
                        <div className="text-[10px] font-mono text-neutral-500">{doc.refNumber}</div>
                      </td>
                      <td className="p-2.5 text-neutral-700">{doc.category}</td>
                      <td className="p-2.5 font-mono text-[11px] text-neutral-500">
                        {doc.fileFormat} • {doc.fileSizeKb} KB
                      </td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                          doc.confidentiality === 'Restricted' ? 'bg-red-50 text-red-700' :
                          doc.confidentiality === 'Confidential' ? 'bg-[#fff4ce] text-[#7f6000]' :
                          'bg-[#e8f5e9] text-[#107c10]'
                        }`}>
                          {doc.confidentiality}
                        </span>
                      </td>
                      <td className="p-2.5 text-neutral-600">{doc.uploadedBy}</td>
                      <td className="p-2.5 text-neutral-500 whitespace-nowrap">{doc.uploadDate}</td>
                      <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleDownloadDoc(doc)}
                            className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#edebe9] rounded"
                            title="Download Certificate"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => deleteDocument(doc.id)}
                              className="p-1 text-neutral-400 hover:text-[#a4262c] hover:bg-red-50 rounded"
                              title="Delete Document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

        <Pagination
          currentPage={currentPage}
          totalItems={filteredData.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* UPLOAD MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-lg p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#edebe9] pb-3">
              <h3 className="text-base font-semibold text-[#242424]">Upload Compliance Document</h3>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNew} className="space-y-3">
              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">Document Title *</label>
                <input
                  type="text"
                  value={formData.documentTitle}
                  onChange={e => setFormData({ ...formData, documentTitle: e.target.value })}
                  placeholder="e.g. Q3 Multi-Agency SG Review"
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Resident Full Name</label>
                  <input
                    type="text"
                    value={formData.suName}
                    onChange={e => setFormData({ ...formData, suName: e.target.value })}
                    placeholder="e.g. Fatima Zohra"
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={formData.refNumber}
                    onChange={e => setFormData({ ...formData, refNumber: e.target.value })}
                    placeholder="e.g. NASS-77192"
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Site</label>
                  <select
                    value={formData.site}
                    onChange={e => setFormData({ ...formData, site: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {allowedSites.map((s, idx) => <option key={`${s}-${idx}`} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as DocumentRecord['category'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Risk Assessment">Risk Assessment</option>
                    <option value="Safeguarding Plan">Safeguarding Plan</option>
                    <option value="Medical Assessment">Medical Assessment</option>
                    <option value="Incident Report">Incident Report</option>
                    <option value="Proof of Support">Proof of Support</option>
                    <option value="Consent Form">Consent Form</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Confidentiality Level</label>
                  <select
                    value={formData.confidentiality}
                    onChange={e => setFormData({ ...formData, confidentiality: e.target.value as DocumentRecord['confidentiality'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Restricted">Restricted (Safeguarding Only)</option>
                    <option value="Confidential">Confidential</option>
                    <option value="Official">Official</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">File Format</label>
                  <select
                    value={formData.fileFormat}
                    onChange={e => setFormData({ ...formData, fileFormat: e.target.value as DocumentRecord['fileFormat'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="PDF">PDF Document</option>
                    <option value="DOCX">Word DOCX</option>
                    <option value="XLSX">Excel Spreadsheet</option>
                    <option value="SCAN">Certified Scan</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#edebe9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold"
                >
                  Confirm & Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
