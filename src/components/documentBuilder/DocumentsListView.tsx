/**
 * DocumentsListView — Saved Documents, History, & Strict RBAC Audit Trail
 *
 * Full data table of all documents with:
 * - Author tracking (Created By Name, Role Badge, Created Timestamp)
 * - Last Updated tracking (Updated By, Updated Timestamp)
 * - Status (Draft / Final)
 * - Site filtering & search
 * - Actions: Edit Draft, Download DOCX, Download PDF, View Audit History, Delete
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Edit,
  Trash2,
  History,
  Search,
  Filter,
  Loader2,
  CheckCircle,
  Clock,
  Shield,
  User,
  MapPin,
  Calendar,
  X,
  AlertCircle,
} from 'lucide-react';
import type { DocumentBuilderRecord, DocumentAuditLog } from '../../types/documentBuilder';
import {
  fetchDocumentRecords,
  deleteDocumentRecord,
  generateDocument,
  downloadBlob,
  fetchDocumentAuditTrail,
} from '../../services/documentBuilderService';
import { useApp } from '../../context/AppContext';

interface DocumentsListViewProps {
  onEditRecord: (record: DocumentBuilderRecord) => void;
}

export const DocumentsListView: React.FC<DocumentsListViewProps> = ({ onEditRecord }) => {
  const { currentUserRole, assignedSite, canAccessAllSites, allowedSites } = useApp();

  const [records, setRecords] = useState<DocumentBuilderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState<string>('All Sites');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Audit trail modal state
  const [auditRecord, setAuditRecord] = useState<DocumentBuilderRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<DocumentAuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    const res = await fetchDocumentRecords();
    if (res.success && res.data) {
      setRecords(res.data);
    }
    setLoading(false);
  };

  const handleOpenAudit = async (record: DocumentBuilderRecord) => {
    setAuditRecord(record);
    setLoadingAudit(true);
    const res = await fetchDocumentAuditTrail(record.id);
    if (res.success && res.data) {
      setAuditLogs(res.data);
    } else {
      setAuditLogs([]);
    }
    setLoadingAudit(false);
  };

  const handleDownload = async (recordId: string, format: 'docx' | 'pdf') => {
    setDownloadingId(`${recordId}-${format}`);
    setActionError(null);
    try {
      const res = await generateDocument(recordId, format);
      if (res.success && res.blob) {
        downloadBlob(res.blob, res.filename || `document.${format}`);
      } else {
        setActionError(res.error || `Failed to download ${format.toUpperCase()}`);
      }
    } catch (err: any) {
      setActionError(err.message || 'Error downloading file');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (record: DocumentBuilderRecord) => {
    const isOwner = record.createdByName === 'Staff' || true;
    const isAdmin = ['Super Admin', 'Admin', 'Regional Manager'].includes(currentUserRole);

    if (record.status === 'final' && !isAdmin) {
      alert('Only Administrators can delete finalized documents.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${record.title}"? This action is tracked in the audit log.`)) {
      return;
    }

    const res = await deleteDocumentRecord(record.id);
    if (res.success) {
      setRecords(prev => prev.filter(r => r.id !== record.id));
    } else {
      alert(res.error || 'Failed to delete record');
    }
  };

  // Filter records
  const filteredRecords = records.filter(r => {
    // Site filter
    if (selectedSite !== 'All Sites' && r.site !== selectedSite) return false;
    // Status filter
    if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchDocNo = (r.documentNumber || '').toLowerCase().includes(q);
      const matchAuthor = (r.createdByName || '').toLowerCase().includes(q);
      const matchSite = (r.site || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDocNo && !matchAuthor && !matchSite) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-white border border-[#e2e8f0] rounded-xs p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by title, doc number, author, or site..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-[#cbd5e1] rounded-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#334155]"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Drafts Only</option>
            <option value="final">Finalized Only</option>
          </select>

          {canAccessAllSites() && (
            <select
              value={selectedSite}
              onChange={e => setSelectedSite(e.target.value)}
              className="px-3 py-2 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#334155]"
            >
              <option value="All Sites">All Sites</option>
              {allowedSites.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>

        <div className="text-xs font-semibold text-[#64748b]">
          Showing {filteredRecords.length} of {records.length} reports
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xs text-xs font-medium flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Documents Data Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xs shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#64748b]">
            <Loader2 className="w-8 h-8 animate-spin text-[#0d9488] mb-2" />
            <p className="text-xs font-semibold">Loading saved reports and downloads...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-16 text-[#64748b]">
            <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#1e293b]">No saved reports found</p>
            <p className="text-xs text-[#94a3b8] mt-1">
              Select a template from the Generate Report tab to create and download your first report.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Report Title & Ref</th>
                  <th className="py-3 px-4">Site</th>
                  <th className="py-3 px-4">Author (RBAC)</th>
                  <th className="py-3 px-4">Created Time</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filteredRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-[#f8fafc] transition-colors">
                    {/* Document Title & Reference */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1e293b]">{rec.title}</div>
                      <div className="text-[11px] font-mono text-[#0d9488] mt-0.5">
                        {rec.documentNumber}
                      </div>
                    </td>

                    {/* Site */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[#475569] font-medium">
                        <MapPin className="w-3 h-3 text-[#94a3b8]" />
                        {rec.site}
                      </span>
                    </td>

                    {/* Author (RBAC) */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#1e293b]">
                          {rec.createdByName || 'Staff Member'}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]">
                          {rec.createdByRole || 'Staff'}
                        </span>
                      </div>
                      {rec.createdByEmail && (
                        <div className="text-[10px] text-[#94a3b8]">{rec.createdByEmail}</div>
                      )}
                    </td>

                    {/* Created Time */}
                    <td className="py-3 px-4 text-[#64748b]">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#94a3b8]" />
                        {new Date(rec.createdAt).toLocaleDateString('en-GB')}
                      </div>
                      <div className="text-[10px] text-[#94a3b8] ml-4">
                        {new Date(rec.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    {/* Last Updated */}
                    <td className="py-3 px-4 text-[#64748b]">
                      <div>{new Date(rec.updatedAt).toLocaleDateString('en-GB')}</div>
                      <div className="text-[10px] text-[#94a3b8]">
                        by {rec.updatedByName || rec.createdByName || 'Staff'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          rec.status === 'final'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {rec.status === 'final' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {rec.status.toUpperCase()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onEditRecord(rec)}
                          className="p-1.5 text-[#0d9488] hover:bg-[#f0fdfa] rounded-xs transition-colors"
                          title="Edit / Resume Report"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDownload(rec.id, 'docx')}
                          disabled={downloadingId === `${rec.id}-docx`}
                          className="p-1.5 text-[#0284c7] hover:bg-[#f0f9ff] rounded-xs transition-colors disabled:opacity-50"
                          title="Download DOCX"
                        >
                          {downloadingId === `${rec.id}-docx` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDownload(rec.id, 'pdf')}
                          disabled={downloadingId === `${rec.id}-pdf`}
                          className="p-1.5 text-[#dc2626] hover:bg-[#fef2f2] rounded-xs transition-colors disabled:opacity-50"
                          title="Download PDF"
                        >
                          {downloadingId === `${rec.id}-pdf` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileText className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleOpenAudit(rec)}
                          className="p-1.5 text-[#4f46e5] hover:bg-[#eef2ff] rounded-xs transition-colors"
                          title="View RBAC Audit Trail"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(rec)}
                          className="p-1.5 text-[#94a3b8] hover:text-red-600 hover:bg-red-50 rounded-xs transition-colors"
                          title="Delete Report"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Trail Modal */}
      {auditRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xs shadow-2xl border border-[#d1d5db] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#f8fafc] border-b border-[#e2e8f0]">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#0d9488]" />
                <div>
                  <h3 className="text-sm font-bold text-[#1e293b]">
                    RBAC Audit Trail & Compliance History
                  </h3>
                  <p className="text-[11px] text-[#64748b]">
                    {auditRecord.title} ({auditRecord.documentNumber})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAuditRecord(null)}
                className="text-[#94a3b8] hover:text-[#1e293b]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {loadingAudit ? (
                <div className="py-12 text-center text-[#64748b]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0d9488] mx-auto mb-2" />
                  <p className="text-xs">Fetching audit logs...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-10 text-[#94a3b8] text-xs">
                  No separate event logs recorded yet for this document.
                </div>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log, idx) => (
                    <div
                      key={log.id || idx}
                      className="border-l-2 border-[#0d9488] pl-4 py-1 space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#1e293b]">
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-[#94a3b8]">
                          {new Date(log.timestamp).toLocaleString('en-GB')}
                        </span>
                      </div>
                      <p className="text-xs text-[#475569]">{log.details}</p>
                      <div className="flex items-center gap-2 text-[10px] text-[#64748b]">
                        <span className="font-semibold text-[#0d9488]">{log.userName}</span>
                        <span>•</span>
                        <span className="px-1.5 py-0.2 bg-[#f1f5f9] rounded-xs font-mono">
                          {log.userRole}
                        </span>
                        {log.site && (
                          <>
                            <span>•</span>
                            <span>{log.site}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
