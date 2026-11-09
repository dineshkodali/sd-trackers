/**
 * SUReportsHistoryTab.tsx
 *
 * Dedicated Reports History section in Service User Profile.
 * Provides:
 * 1. Automatic history of all generated, saved, and downloaded reports for the Service User.
 * 2. Download action that retrieves the persistent file and updates download counts.
 * 3. Permanent retention protection (read-only for standard roles; full CRUD & archive management for Super Admin).
 * 4. Filtering (search, format, category, active/archived), sorting, and pagination.
 * 5. Super Admin management: Edit metadata, Archive/Restore, Permanent Delete, and Audit Log inspect.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  IconFileText as FileText,
  IconDownload as Download,
  IconSearch as Search,
  IconFilter as Filter,
  IconArchive as Archive,
  IconTrash as Trash2,
  IconEdit as Edit3,
  IconHistory as History,
  IconCircleCheck as CheckCircle2,
  IconAlertCircle as AlertCircle,
  IconShieldCheck as ShieldCheck,
  IconShieldLock as ShieldLock,
  IconLock as Lock,
  IconPlus as Plus,
  IconArrowBackUp as ArrowBackUp,
  IconClock as Clock,
  IconUser as User,
  IconFileTypePdf as FilePdf,
  IconFileTypeDocx as FileDocx,
  IconFileTypeCsv as FileCsv,
  IconFileSpreadsheet as FileSpreadsheet,
  IconX as X,
  IconEye as Eye,
} from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { reportHistoryService } from '../../services/reportHistoryService';
import type { ServiceUserMaster } from '../../types/masterData';
import type { ServiceUserReportRecord } from '../../types/reportHistory';
import { Pagination } from '../common/Pagination';

interface SUReportsHistoryTabProps {
  serviceUser: ServiceUserMaster;
  onNavigateToReportGenerator?: (su: ServiceUserMaster) => void;
}

export const SUReportsHistoryTab: React.FC<SUReportsHistoryTabProps> = ({
  serviceUser,
  onNavigateToReportGenerator,
}) => {
  const { currentUserRole, currentUserName, currentUserId, requestConfirmation } = useApp();
  const isSuperAdmin = currentUserRole === 'Super Admin';

  const [reports, setReports] = useState<ServiceUserReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'downloads'>('newest');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Super Admin Modals
  const [editingReport, setEditingReport] = useState<ServiceUserReportRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editStatus, setEditStatus] = useState<'Generated' | 'Saved' | 'Downloaded' | 'Archived'>('Saved');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Audit trail modal
  const [auditReport, setAuditReport] = useState<ServiceUserReportRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Manual Add Modal (Super Admin)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('Operations');
  const [addFormat, setAddFormat] = useState('docx');
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addNotes, setAddNotes] = useState('');
  const [savingAdd, setSavingAdd] = useState(false);

  // Action toast / alert
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportHistoryService.fetchSUReports(serviceUser.id, {
        includeArchived: isSuperAdmin || archiveFilter !== 'active',
      });
      if (res.success) {
        setReports(res.data);
      } else {
        setError(res.error || 'Failed to load report history');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching report records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serviceUser?.id) {
      loadReports();
    }
  }, [serviceUser?.id, archiveFilter]);

  // Filtered & Sorted reports
  const filteredReports = useMemo(() => {
    let result = [...reports];

    // Archive filter
    if (archiveFilter === 'active') {
      result = result.filter(r => !r.isArchived);
    } else if (archiveFilter === 'archived') {
      result = result.filter(r => r.isArchived);
    }

    // Format filter
    if (formatFilter !== 'ALL') {
      result = result.filter(r => (r.fileFormat || '').toLowerCase() === formatFilter.toLowerCase());
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      result = result.filter(r => (r.reportCategory || '').toLowerCase() === categoryFilter.toLowerCase());
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        r =>
          r.reportName?.toLowerCase().includes(q) ||
          r.reportType?.toLowerCase().includes(q) ||
          r.fileName?.toLowerCase().includes(q) ||
          r.generatedByName?.toLowerCase().includes(q) ||
          (r.metadata?.notes && String(r.metadata.notes).toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime();
      }
      if (sortBy === 'name') {
        return a.reportName.localeCompare(b.reportName);
      }
      if (sortBy === 'downloads') {
        return (b.downloadCount || 0) - (a.downloadCount || 0);
      }
      return 0;
    });

    return result;
  }, [reports, archiveFilter, formatFilter, categoryFilter, searchQuery, sortBy]);

  // Pagination slice
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReports.slice(start, start + pageSize);
  }, [filteredReports, currentPage, pageSize]);

  // Unique categories for filter
  const categories = useMemo(() => {
    const set = new Set<string>();
    reports.forEach(r => {
      if (r.reportCategory) set.add(r.reportCategory);
    });
    return Array.from(set);
  }, [reports]);

  // Download Handler
  const handleDownload = async (report: ServiceUserReportRecord) => {
    const res = await reportHistoryService.downloadReport(report);
    if (res.success) {
      showToast(`Downloaded "${report.fileName || report.reportName}"`);
      // Update local count immediately
      setReports(prev =>
        prev.map(r =>
          r.id === report.id
            ? {
                ...r,
                downloadCount: (r.downloadCount || 0) + 1,
                lastDownloadedAt: new Date().toISOString(),
                status: r.status === 'Generated' ? 'Downloaded' : r.status,
              }
            : r
        )
      );
    } else {
      showToast(res.error || 'Failed to download report', 'error');
    }
  };

  // Super Admin: Archive / Restore
  const handleToggleArchive = async (report: ServiceUserReportRecord) => {
    if (!isSuperAdmin) return;
    const willArchive = !report.isArchived;

    const actionText = willArchive ? 'Archive Report' : 'Restore Report';
    const confirmMessage = willArchive
      ? `Archive "${report.reportName}"? The report remains permanently stored and retrievable, but is moved out of active operational views.`
      : `Restore "${report.reportName}" to active reports?`;

    requestConfirmation({
      title: actionText,
      message: confirmMessage,
      isDanger: false,
      onConfirm: async () => {
        const res = await reportHistoryService.archiveReport(report.id, willArchive);
        if (res.success) {
          showToast(`Report ${willArchive ? 'archived' : 'restored'} successfully`);
          loadReports();
        } else {
          showToast(res.error || 'Failed to update archive status', 'error');
        }
      },
    });
  };

  // Super Admin: Delete Permanently
  const handleDeletePermanently = (report: ServiceUserReportRecord) => {
    if (!isSuperAdmin) return;

    requestConfirmation({
      title: 'Permanently Delete Report (Super Admin Only)',
      message: `Are you sure you want to PERMANENTLY delete "${report.reportName}" (${report.fileName})? Both the database record and the stored file in secure storage will be permanently removed. This action is irreversible and will be logged in the permanent audit trail.`,
      isDanger: true,
      onConfirm: async () => {
        const res = await reportHistoryService.deletePermanently(report.id);
        if (res.success) {
          showToast('Report and storage file permanently deleted by Super Admin');
          loadReports();
        } else {
          showToast(res.error || 'Failed to delete report', 'error');
        }
      },
    });
  };

  // Super Admin: Open Edit Metadata Modal
  const openEditModal = (report: ServiceUserReportRecord) => {
    if (!isSuperAdmin) return;
    setEditingReport(report);
    setEditName(report.reportName);
    setEditCategory(report.reportCategory || 'Operations');
    setEditStatus(report.status);
    setEditNotes(report.metadata?.notes || report.notes || '');
  };

  // Super Admin: Save Metadata
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport || !isSuperAdmin) return;
    if (!editName.trim()) {
      showToast('Report name is required', 'error');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await reportHistoryService.updateMetadata(editingReport.id, {
        reportName: editName.trim(),
        reportCategory: editCategory.trim(),
        status: editStatus,
        notes: editNotes.trim(),
      });

      if (res.success) {
        showToast('Report metadata updated successfully');
        setEditingReport(null);
        loadReports();
      } else {
        showToast(res.error || 'Failed to update metadata', 'error');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  // Super Admin: Save Manual Report
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    if (!addName.trim()) {
      showToast('Report name is required', 'error');
      return;
    }

    setSavingAdd(true);
    try {
      const res = await reportHistoryService.trackReport({
        suId: serviceUser.id,
        suName: `${serviceUser.firstName} ${serviceUser.lastName}`,
        suReference: serviceUser.suReference,
        site: serviceUser.siteId || 'All Sites',
        reportName: addName.trim(),
        reportType: 'Inspection / External Report',
        reportCategory: addCategory,
        fileFormat: addFormat,
        fileName: addFile?.name || `${addName.replace(/[^a-zA-Z0-9]/g, '_')}.${addFormat}`,
        fileBlob: addFile || undefined,
        status: 'Saved',
        notes: addNotes.trim(),
      });

      if (res.success) {
        showToast('Historical report added to profile');
        setIsAddModalOpen(false);
        setAddName('');
        setAddNotes('');
        setAddFile(null);
        loadReports();
      } else {
        showToast(res.error || 'Failed to add report', 'error');
      }
    } finally {
      setSavingAdd(false);
    }
  };

  // Open Audit Trail
  const openAuditModal = async (report: ServiceUserReportRecord) => {
    setAuditReport(report);
    setLoadingAudit(true);
    try {
      const res = await reportHistoryService.fetchAuditTrail(report.id);
      setAuditLogs(res.data || []);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Format icon helper
  const getFormatBadge = (fmt: string) => {
    const f = (fmt || '').toLowerCase();
    if (f === 'pdf') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <FilePdf className="w-3 h-3 text-rose-600" />
          PDF
        </span>
      );
    }
    if (f === 'docx') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <FileDocx className="w-3 h-3 text-blue-600" />
          DOCX
        </span>
      );
    }
    if (f === 'csv') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <FileCsv className="w-3 h-3 text-emerald-600" />
          CSV
        </span>
      );
    }
    if (f === 'xlsx') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
          <FileSpreadsheet className="w-3 h-3 text-teal-600" />
          XLSX
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
        <FileText className="w-3 h-3 text-neutral-500" />
        {f.toUpperCase()}
      </span>
    );
  };

  // Status badge helper
  const getStatusBadge = (status: string, isArchived: boolean) => {
    if (isArchived || status === 'Archived') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-300">
          <Lock className="w-3 h-3 text-neutral-500" />
          Archived
        </span>
      );
    }
    if (status === 'Downloaded') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Downloaded
        </span>
      );
    }
    if (status === 'Saved') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
          <CheckCircle2 className="w-3 h-3 text-sky-600" />
          Saved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
        <Clock className="w-3 h-3 text-amber-600" />
        Generated
      </span>
    );
  };

  const formatUkDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`p-3 rounded-xs text-xs font-semibold flex items-center justify-between border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Info & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50 p-4 rounded-xs border border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-neutral-800 tracking-tight flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#0d9488]" />
              Reports History & Archive
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4] rounded-full">
              {filteredReports.length} {filteredReports.length === 1 ? 'Report' : 'Reports'}
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Permanent, inspection-ready record of all reports generated, saved, or downloaded for {serviceUser.firstName}{' '}
            {serviceUser.lastName}.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Policy badge */}
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border bg-white text-neutral-600 border-neutral-200"
            title="Standard roles have read-only access. Super Admin manages retention, editing, and archive."
          >
            {isSuperAdmin ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                <span className="text-teal-800 font-bold">Super Admin: Full CRUD</span>
              </>
            ) : (
              <>
                <ShieldLock className="w-3.5 h-3.5 text-amber-600" />
                <span>Retention Protected (Read-Only)</span>
              </>
            )}
          </span>

          {/* Super Admin Add Historical Report */}
          {isSuperAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 rounded-xs text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#0d9488]" />
              <span>Add Historical Report</span>
            </button>
          )}

          {/* Link to HO Report Generator */}
          {onNavigateToReportGenerator && (
            <button
              onClick={() => onNavigateToReportGenerator(serviceUser)}
              className="px-3.5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate HO Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar: Search, Filters, Archive switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search report name, user, notes..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-300 rounded-xs bg-white text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-[#0d9488]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Format */}
          <select
            value={formatFilter}
            onChange={e => {
              setFormatFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs border border-neutral-300 rounded-xs px-2 py-1.5 bg-white text-neutral-700 focus:outline-none focus:border-[#0d9488]"
          >
            <option value="ALL">All Formats</option>
            <option value="DOCX">DOCX</option>
            <option value="PDF">PDF</option>
            <option value="CSV">CSV</option>
            <option value="XLSX">XLSX</option>
          </select>

          {/* Category */}
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={e => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs border border-neutral-300 rounded-xs px-2 py-1.5 bg-white text-neutral-700 focus:outline-none focus:border-[#0d9488]"
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {/* Archive status switcher */}
          <div className="inline-flex rounded-xs border border-neutral-300 bg-neutral-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setArchiveFilter('active');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-xs font-semibold transition-colors cursor-pointer ${
                archiveFilter === 'active'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => {
                setArchiveFilter('archived');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-xs font-semibold transition-colors cursor-pointer ${
                archiveFilter === 'archived'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Archived
            </button>
            <button
              type="button"
              onClick={() => {
                setArchiveFilter('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-xs font-semibold transition-colors cursor-pointer ${
                archiveFilter === 'all'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              All
            </button>
          </div>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="text-xs border border-neutral-300 rounded-xs px-2 py-1.5 bg-white text-neutral-700 focus:outline-none focus:border-[#0d9488]"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Report Name (A-Z)</option>
            <option value="downloads">Most Downloaded</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="border border-neutral-200 rounded-xs overflow-hidden bg-white shadow-2xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-500">
            <div className="inline-block animate-spin w-5 h-5 border-2 border-[#0d9488] border-t-transparent rounded-full mb-2"></div>
            <p>Loading report history...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-600">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
            <p className="font-semibold">{error}</p>
            <button
              onClick={loadReports}
              className="mt-3 px-3 py-1 bg-white border border-rose-300 rounded text-rose-700 hover:bg-rose-50 text-xs font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : paginatedReports.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-neutral-700">No report records found</h4>
            <p className="text-[11px] text-neutral-400 mt-1 max-w-sm mx-auto">
              {searchQuery || formatFilter !== 'ALL' || categoryFilter !== 'ALL' || archiveFilter !== 'active'
                ? 'No reports match your current filter settings. Try clearing your search or switching filters.'
                : 'Whenever HO reports, incident sheets, or attendance rolls are generated, saved, or downloaded for this resident, they will be preserved permanently here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#faf9f8] border-b border-neutral-200 text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Report Details</th>
                  <th className="p-3">Category & Scope</th>
                  <th className="p-3">Format</th>
                  <th className="p-3">Generated By</th>
                  <th className="p-3">Generated At</th>
                  <th className="p-3">Last Downloaded</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {paginatedReports.map(report => (
                  <tr key={report.id} className={`hover:bg-[#fcfbf9] transition-colors ${report.isArchived ? 'opacity-70 bg-neutral-50/50' : ''}`}>
                    {/* Report Details */}
                    <td className="p-3 font-medium">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-neutral-900 text-xs flex items-center gap-1.5">
                            <span>{report.reportName}</span>
                            {report.isArchived && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-700 uppercase">
                                Archived
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono mt-0.5 truncate max-w-xs" title={report.fileName}>
                            {report.fileName}
                            {report.fileSize ? ` • ${(report.fileSize / 1024).toFixed(1)} KB` : ''}
                          </div>
                          {report.metadata?.notes && (
                            <p className="text-[10px] text-neutral-400 italic mt-0.5 line-clamp-1" title={report.metadata.notes}>
                              Note: {report.metadata.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category & Scope */}
                    <td className="p-3">
                      <div className="space-y-1">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                          {report.reportCategory || 'Operations'}
                        </span>
                        <div className="text-[10px] text-neutral-400 truncate max-w-[120px]" title={report.site}>
                          {report.site || 'All Sites'}
                        </div>
                      </div>
                    </td>

                    {/* Format */}
                    <td className="p-3 whitespace-nowrap">{getFormatBadge(report.fileFormat)}</td>

                    {/* Generated By */}
                    <td className="p-3">
                      <div>
                        <div className="font-semibold text-neutral-800 text-[11px] flex items-center gap-1">
                          <User className="w-3 h-3 text-neutral-400" />
                          <span>{report.generatedByName || 'Staff Member'}</span>
                        </div>
                        <span className="text-[10px] text-neutral-500">{report.generatedByRole || 'Staff'}</span>
                      </div>
                    </td>

                    {/* Generated At */}
                    <td className="p-3 whitespace-nowrap text-neutral-600 text-[11px]">
                      {formatUkDateTime(report.generatedAt)}
                    </td>

                    {/* Last Downloaded & Count */}
                    <td className="p-3 whitespace-nowrap">
                      <div>
                        <div className="text-neutral-700 text-[11px]">
                          {report.lastDownloadedAt ? formatUkDateTime(report.lastDownloadedAt) : 'Never downloaded'}
                        </div>
                        {report.downloadCount > 0 && (
                          <span className="inline-block text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded mt-0.5">
                            {report.downloadCount} {report.downloadCount === 1 ? 'download' : 'downloads'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-3 whitespace-nowrap">{getStatusBadge(report.status, report.isArchived)}</td>

                    {/* Actions */}
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Download button — available to all roles */}
                        <button
                          type="button"
                          onClick={() => handleDownload(report)}
                          className="px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 rounded-xs text-[11px] font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                          title="Download report file (tracks download in compliance record)"
                        >
                          <Download className="w-3 h-3 text-[#0d9488]" />
                          <span>Download</span>
                        </button>

                        {/* Audit Log inspection button */}
                        <button
                          type="button"
                          onClick={() => openAuditModal(report)}
                          className="p-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                          title="View complete audit & download history"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>

                        {/* Super Admin Actions */}
                        {isSuperAdmin && (
                          <>
                            {/* Edit Metadata */}
                            <button
                              type="button"
                              onClick={() => openEditModal(report)}
                              className="p-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                              title="Super Admin: Edit Report Metadata"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Archive / Restore */}
                            <button
                              type="button"
                              onClick={() => handleToggleArchive(report)}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                report.isArchived
                                  ? 'text-teal-600 hover:text-teal-800 hover:bg-teal-50'
                                  : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
                              }`}
                              title={report.isArchived ? 'Super Admin: Restore Report' : 'Super Admin: Archive Report'}
                            >
                              {report.isArchived ? (
                                <ArrowBackUp className="w-3.5 h-3.5" />
                              ) : (
                                <Archive className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Permanent Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeletePermanently(report)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Super Admin: Permanently Delete Record & File (Audited)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredReports.length > 0 && (
          <div className="p-3 border-t border-neutral-200 bg-[#faf9f8]">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredReports.length / pageSize)}
              totalItems={filteredReports.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={size => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              pageSizeOptions={[5, 10, 20, 50]}
            />
          </div>
        )}
      </div>

      {/* MODAL 1: Super Admin Edit Metadata */}
      {editingReport && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs border border-neutral-300 shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-neutral-800">Edit Report Metadata (Super Admin)</h3>
              </div>
              <button
                onClick={() => setEditingReport(null)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Report Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-xs bg-white text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-xs bg-white text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  >
                    <option value="Operations">Operations</option>
                    <option value="Safeguarding & Incidents">Safeguarding & Incidents</option>
                    <option value="Compliance">Compliance</option>
                    <option value="Welfare & Support">Welfare & Support</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-xs bg-white text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  >
                    <option value="Generated">Generated</option>
                    <option value="Saved">Saved</option>
                    <option value="Downloaded">Downloaded</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Internal Notes</label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional context or inspection details..."
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-xs bg-white text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                />
              </div>

              <div className="pt-2 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingReport(null)}
                  className="px-3 py-1.5 border border-neutral-300 text-neutral-600 rounded-xs font-semibold hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-3.5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Metadata'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Super Admin Add Historical Report */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs border border-neutral-300 shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-neutral-800">Add Historical Report (Super Admin)</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Report Name *</label>
                <input
                  type="text"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="e.g. Home Office Historical Interview Report"
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-xs bg-white text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Category</label>
                  <select
                    value={addCategory}
                    onChange={e => setAddCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-xs bg-white text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  >
                    <option value="Operations">Operations</option>
                    <option value="Safeguarding & Incidents">Safeguarding & Incidents</option>
                    <option value="Compliance">Compliance</option>
                    <option value="Welfare & Support">Welfare & Support</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Format</label>
                  <select
                    value={addFormat}
                    onChange={e => setAddFormat(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-xs bg-white text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  >
                    <option value="docx">DOCX</option>
                    <option value="pdf">PDF</option>
                    <option value="csv">CSV</option>
                    <option value="xlsx">XLSX</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Attach Report File (Optional)
                </label>
                <input
                  type="file"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setAddFile(e.target.files[0]);
                      if (!addName) {
                        setAddName(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                      }
                    }
                  }}
                  className="w-full text-xs text-neutral-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-xs file:border file:border-neutral-300 file:bg-neutral-50 file:text-xs file:font-semibold hover:file:bg-neutral-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">Internal Notes</label>
                <textarea
                  value={addNotes}
                  onChange={e => setAddNotes(e.target.value)}
                  rows={2}
                  placeholder="Inspection context or provenance..."
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-xs bg-white text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                />
              </div>

              <div className="pt-2 border-t border-neutral-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 border border-neutral-300 text-neutral-600 rounded-xs font-semibold hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdd}
                  className="px-3.5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {savingAdd ? 'Adding...' : 'Add to Profile History'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Audit Trail & Download History Modal */}
      {auditReport && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs border border-neutral-300 shadow-xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-neutral-800">Report Audit & Download Trail</h3>
              </div>
              <button
                onClick={() => setAuditReport(null)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-neutral-50 p-2.5 rounded border border-neutral-200">
                <div className="font-bold text-neutral-800">{auditReport.reportName}</div>
                <div className="text-[11px] text-neutral-500 font-mono mt-0.5">{auditReport.fileName}</div>
                <div className="text-[11px] text-neutral-600 mt-1">
                  Generated by: <strong>{auditReport.generatedByName}</strong> ({auditReport.generatedByRole || 'Staff'}) on{' '}
                  {formatUkDateTime(auditReport.generatedAt)}
                </div>
              </div>

              <h4 className="font-bold text-[11px] uppercase tracking-wider text-neutral-600 mt-3">
                Download Events ({auditReport.downloadHistory?.length || 0})
              </h4>

              {auditReport.downloadHistory && auditReport.downloadHistory.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-neutral-200 rounded p-2 bg-white">
                  {auditReport.downloadHistory.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 bg-neutral-50 rounded text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Download className="w-3 h-3 text-teal-600 shrink-0" />
                        <span className="font-semibold text-neutral-800">{ev.userName}</span>
                        {ev.userRole && <span className="text-[10px] text-neutral-500">({ev.userRole})</span>}
                      </div>
                      <span className="text-neutral-500 font-mono text-[10px]">{formatUkDateTime(ev.timestamp)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-400 italic">No recorded downloads yet.</p>
              )}

              {/* Compliance Audit Logs */}
              <h4 className="font-bold text-[11px] uppercase tracking-wider text-neutral-600 mt-3">
                Security & Compliance Log
              </h4>
              {loadingAudit ? (
                <p className="text-[11px] text-neutral-400">Loading audit events...</p>
              ) : auditLogs.length > 0 ? (
                <div className="max-h-36 overflow-y-auto space-y-1 border border-neutral-200 rounded p-2 bg-white text-[11px]">
                  {auditLogs.map((log: any) => (
                    <div key={log.id} className="py-1 border-b border-neutral-100 last:border-b-0">
                      <div className="flex items-center justify-between text-[10px] text-neutral-400">
                        <span className="font-bold text-teal-700">{log.action}</span>
                        <span>{formatUkDateTime(log.created_at || log.timestamp)}</span>
                      </div>
                      <div className="text-neutral-700 mt-0.5">{log.details}</div>
                      <div className="text-[10px] text-neutral-500">By: {log.user_name || log.userName}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-400 italic">Audit log initialized.</p>
              )}
            </div>

            <div className="pt-2 border-t border-neutral-200 flex justify-end">
              <button
                type="button"
                onClick={() => setAuditReport(null)}
                className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xs font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

