import React, { useState, useMemo, useEffect } from 'react';
import {
  ClipboardList,
  UserCheck,
  Archive,
  Plus,
  Trash2,
  Edit3,
  Download,
  Search,
  Filter,
  X,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  LogOut,
  RotateCcw,
  ShieldCheck,
  FileText,
  User,
  Lock,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SPCDRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { useTableSchema } from '../../hooks/useTableSchema';
import { TableColumnConfig } from '../../types/tableSchema';
import { spcdTableConfig } from '../../config/trackerTableConfigs';

const spcdExportColumns: ExportColumnOption[] = [
  { id: 'date', label: 'Case Date' },
  { id: 'siteName', label: 'Hotel / Site' },
  { id: 'roomNumber', label: 'Room Number' },
  { id: 'suName', label: 'Service User Name' },
  { id: 'suPortReference', label: 'PORT / NASS Ref' },
  { id: 'suDob', label: 'Date of Birth' },
  { id: 'staffReporting', label: 'Raised By' },
  { id: 'briefDescriptionActionTaken', label: 'Action Taken / Description' },
  { id: 'followUpNotes', label: 'Follow Up Notes' },
  { id: 'updates', label: 'Case Updates' },
  { id: 'sgReview', label: 'Safeguarding Review' },
  { id: 'dateLeft', label: 'Departure Date' },
  { id: 'reasonForLeaving', label: 'Reason for Leaving' }
];

export const SPCDTrackerView: React.FC = () => {
  const {
    spcdRecords,
    addSPCDRecord,
    updateSPCDRecord,
    archiveSPCDRecord,
    restoreSPCDRecord,
    deleteSPCDRecord,
    allowedSites,
    canAccessAllSites,
    assignedSite,
    canEditRecord,
    canDeleteRecord,
    canCreateRecord,
    globalSearchFilter,
    setGlobalSearchFilter,
    currentUserName,
    currentUserRole,
    authProfile
  } = useApp();

  const loggedInUserName = authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || (currentUserRole ? `${currentUserRole} (User)` : 'Duty Worker');

  const getRaisedBy = (r: SPCDRecord) => {
    const rep = r.staffReporting || (r as any).raisedBy;
    if (!rep || rep === 'Duty Worker' || rep === 'Duty Lead Officer' || rep === 'Duty Lead') {
      return loggedInUserName;
    }
    return rep;
  };

  // Active Tab: 'current' vs 'archived'
  const [activeTab, setActiveTab] = useState<'current' | 'archived'>('current');

  // Filters
  const [siteFilter, setSiteFilter] = useState<string>(canAccessAllSites() ? 'all' : assignedSite);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync with global header search
  useEffect(() => {
    if (globalSearchFilter) {
      setSearchQuery(globalSearchFilter);
      setGlobalSearchFilter('');
    }
  }, [globalSearchFilter, setGlobalSearchFilter]);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Dynamic Table Schema & Custom Fields Hook
  const {
    columns: spcdColumns,
    tableColumns: visibleSpcdColumns,
    saveColumns: handleSaveSpcdColumns,
    resetToDefault: handleResetSpcdColumns
  } = useTableSchema<SPCDRecord>('spcd', spcdTableConfig);
  const [isSchemaEditorOpen, setIsSchemaEditorOpen] = useState<boolean>(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SPCDRecord | null>(null);
  const [departingRecord, setDepartingRecord] = useState<SPCDRecord | null>(null);
  const [viewDetailRecord, setViewDetailRecord] = useState<SPCDRecord | null>(null);

  // Depart Modal State
  const [departureDate, setDepartureDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [departureReason, setDepartureReason] = useState<string>('Dispersed to Home Office NASS Accommodation');

  // Create Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    siteName: allowedSites[0] || 'Brit Hotel',
    roomNumber: '',
    staffReporting: loggedInUserName,
    suName: '',
    suPortReference: '',
    suDob: '1990-01-01',
    briefDescriptionActionTaken: '',
    followUpNotes: '',
    updates: '',
    sgReview: 'Pending Safeguarding Lead Review'
  });

  useEffect(() => {
    if (loggedInUserName && (formData.staffReporting === 'Duty Worker' || !formData.staffReporting)) {
      setFormData(prev => ({ ...prev, staffReporting: loggedInUserName }));
    }
  }, [loggedInUserName]);

  // Filtered lists
  const currentSUs = useMemo(() => {
    return spcdRecords.filter(r => !r.isArchived);
  }, [spcdRecords]);

  const archivedSUs = useMemo(() => {
    return spcdRecords.filter(r => r.isArchived);
  }, [spcdRecords]);

  const displayedRecords = useMemo(() => {
    const list = activeTab === 'current' ? currentSUs : archivedSUs;
    return list.filter(item => {
      if (siteFilter !== 'all' && item.siteName !== siteFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (item.suName || '').toLowerCase().includes(q) ||
          (item.suPortReference || '').toLowerCase().includes(q) ||
          (item.roomNumber || '').toLowerCase().includes(q) ||
          (item.staffReporting || '').toLowerCase().includes(q) ||
          (item.briefDescriptionActionTaken || '').toLowerCase().includes(q) ||
          (item.followUpNotes || '').toLowerCase().includes(q) ||
          (item.updates || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeTab, currentSUs, archivedSUs, siteFilter, searchQuery]);

  // Sort State
  const [sortField, setSortField] = useState<keyof SPCDRecord>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: keyof SPCDRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Sort displayed records
  const sortedRecords = useMemo(() => {
    return [...displayedRecords].sort((a, b) => {
      let valA: any = a[sortField] ?? '';
      let valB: any = b[sortField] ?? '';
      if (sortField === 'staffReporting') {
        valA = a.staffReporting || (a as any).raisedBy || getRaisedBy(a) || '';
        valB = b.staffReporting || (b as any).raisedBy || getRaisedBy(b) || '';
      }
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [displayedRecords, sortField, sortAsc]);

  // Paginated records
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const handleOpenCreate = () => {
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      siteName: allowedSites[0] || 'Brit Hotel',
      roomNumber: '',
      staffReporting: loggedInUserName,
      suName: '',
      suPortReference: '',
      suDob: '1990-01-01',
      briefDescriptionActionTaken: '',
      followUpNotes: '',
      updates: '',
      sgReview: 'Pending Safeguarding Lead Review'
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const reporter = formData.staffReporting || loggedInUserName;
    addSPCDRecord({
      date: formData.date,
      siteName: formData.siteName,
      site: formData.siteName,
      roomNumber: formData.roomNumber,
      staffReporting: reporter,
      raisedBy: reporter,
      suName: formData.suName,
      suPortReference: formData.suPortReference,
      suDob: formData.suDob,
      briefDescriptionActionTaken: formData.briefDescriptionActionTaken,
      followUpNotes: formData.followUpNotes,
      updates: formData.updates,
      sgReview: formData.sgReview,
      isArchived: false
    });

    setIsCreateModalOpen(false);
    // Reset
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      siteName: allowedSites[0] || 'Brit Hotel',
      roomNumber: '',
      staffReporting: loggedInUserName,
      suName: '',
      suPortReference: '',
      suDob: '1990-01-01',
      briefDescriptionActionTaken: '',
      followUpNotes: '',
      updates: '',
      sgReview: 'Pending Safeguarding Lead Review'
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    const reporter = editingRecord.staffReporting || (editingRecord as any).raisedBy || getRaisedBy(editingRecord) || loggedInUserName;
    updateSPCDRecord(editingRecord.id, {
      ...editingRecord,
      site: editingRecord.siteName,
      staffReporting: reporter,
      raisedBy: reporter
    });
    setEditingRecord(null);
  };

  const handleConfirmDepart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!departingRecord) return;
    archiveSPCDRecord(departingRecord.id, departureDate, departureReason);
    setDepartingRecord(null);
  };

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    const list = activeTab === 'current' ? currentSUs : archivedSUs;
    if (scope === 'filtered') return sortedRecords;
    if (scope === 'custom' && startDate && endDate) {
      return list.filter(r => r.date >= startDate && r.date <= endDate);
    }
    return list;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (r: SPCDRecord) => string | number }> => ({
    date: { label: 'Date', getValue: r => r.date },
    siteName: { label: 'Site / Hotel', getValue: r => r.siteName || '—' },
    roomNumber: { label: 'Room', getValue: r => r.roomNumber || '—' },
    suName: { label: 'SU Name', getValue: r => r.suName },
    suPortReference: { label: 'Port Ref', getValue: r => r.suPortReference || '—' },
    suDob: { label: 'DOB', getValue: r => r.suDob || '—' },
    staffReporting: { label: 'Raised By', getValue: r => getRaisedBy(r) },
    briefDescriptionActionTaken: { label: 'Action / Details', getValue: r => r.briefDescriptionActionTaken || '—' },
    followUpNotes: { label: 'Follow Up', getValue: r => r.followUpNotes || '—' },
    updates: { label: 'Updates', getValue: r => r.updates || '—' },
    sgReview: { label: 'SG Review', getValue: r => r.sgReview || '—' },
    dateLeft: { label: 'Date Left', getValue: r => r.dateLeft || '—' },
    reasonForLeaving: { label: 'Reason Left', getValue: r => r.reasonForLeaving || '—' }
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
      : spcdExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(r => activeCols.map(c => colMap[c].getValue(r)));
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
      : spcdExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(r => activeCols.map(c => colMap[c].getValue(r)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `SPCD-${activeTab}-${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: activeTab === 'current' ? 'SPCD Case Tracker — Current SUs in Residence' : 'SPCD Case Tracker — Archived SUs (Departed / Left)',
        subtitle: 'Special provision accommodation management, medical flags, dispersed dates, and case worker allocation.',
        filename: `SPCD-${activeTab}-${scope}-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        orientation,
        isCompact,
        metadata: [
          { label: 'Site Scope', value: siteFilter === 'all' ? 'All Permitted Sites' : siteFilter },
          { label: 'Tab Category', value: activeTab === 'current' ? 'Current SUs' : 'Archived SUs' },
          { label: 'Export Scope', value: scope === 'all' ? 'All Tab Records' : scope === 'filtered' ? 'Current Filtered View' : `${startDate} to ${endDate}` },
          { label: 'Page Layout', value: orientation },
          { label: 'Total Records', value: dataToExport.length }
        ]
      });
    }
  };

  const calculateDateRangeCount = (start: string, end: string) => {
    const list = activeTab === 'current' ? currentSUs : archivedSUs;
    return list.filter(r => r.date >= start && r.date <= end).length;
  };

  const renderColumnCell = (col: TableColumnConfig<SPCDRecord>, item: SPCDRecord) => {
    const val = (item as any)[col.key];

    if (col.renderCell) {
      return col.renderCell(val, item);
    }

    if (col.key === 'date') {
      return <span className="font-mono text-[11px] whitespace-nowrap text-neutral-700">{item.date || '—'}</span>;
    }

    if (col.key === 'siteName') {
      return <span className="whitespace-nowrap font-medium text-neutral-800">{item.siteName}</span>;
    }

    if (col.key === 'roomNumber') {
      return (
        <span className="px-1.5 py-0.5 bg-neutral-100 rounded font-mono text-[11px] text-neutral-700">
          {item.roomNumber || '—'}
        </span>
      );
    }

    if (col.key === 'staffReporting') {
      return <span className="whitespace-nowrap text-neutral-700">{getRaisedBy(item)}</span>;
    }

    if (col.key === 'suName') {
      return (
        <button
          onClick={() => setViewDetailRecord(item)}
          className="hover:underline text-left whitespace-nowrap font-semibold text-neutral-900 cursor-pointer"
        >
          {item.suName}
        </button>
      );
    }

    if (col.key === 'suPortReference') {
      return (
        <span className="whitespace-nowrap font-mono text-[11px] font-bold text-[#0d9488]">
          {item.suPortReference || '—'}
        </span>
      );
    }

    if (col.key === 'suDob') {
      return <span className="whitespace-nowrap font-mono text-[11px] text-neutral-600">{item.suDob || '—'}</span>;
    }

    if (col.key === 'briefDescriptionActionTaken') {
      return (
        <div className="text-neutral-800 font-normal line-clamp-2 max-w-[280px]" title={item.briefDescriptionActionTaken}>
          {item.briefDescriptionActionTaken || '—'}
        </div>
      );
    }

    if (col.key === 'followUpNotes') {
      return (
        <div className="text-neutral-700 text-[11px] line-clamp-2 max-w-[240px]" title={item.followUpNotes}>
          {item.followUpNotes || <span className="text-neutral-400 italic">No notes</span>}
        </div>
      );
    }

    if (col.key === 'updates') {
      return (
        <div className="text-neutral-700 text-[11px] line-clamp-2 max-w-[200px]" title={item.updates}>
          {item.updates || <span className="text-neutral-400 italic">—</span>}
        </div>
      );
    }

    if (col.key === 'sgReview') {
      return canEditRecord(item.siteName) && !item.isArchived ? (
        <select
          value={item.sgReview}
          onChange={e => updateSPCDRecord(item.id, { sgReview: e.target.value })}
          className="px-2 py-0.5 text-[11px] font-medium rounded border border-[#99f6e4] bg-[#f0fdfa] text-[#0f766e] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0078d4]"
          title="Click to update Safeguarding review status"
        >
          <option value="Pending Safeguarding Lead Review" className="bg-white text-neutral-900 font-normal">Pending Review</option>
          <option value="Reviewed & Cleared" className="bg-white text-neutral-900 font-normal">Reviewed & Cleared</option>
          <option value="Reviewed & Approved" className="bg-white text-neutral-900 font-normal">Reviewed & Approved</option>
          <option value="Under Ongoing Review" className="bg-white text-neutral-900 font-normal">Under Ongoing Review</option>
          <option value="Escalated to Multi-Agency" className="bg-white text-neutral-900 font-normal">Escalated to Multi-Agency</option>
          <option value="Closed / Resolved" className="bg-white text-neutral-900 font-normal">Closed / Resolved</option>
          {!['Pending Safeguarding Lead Review', 'Reviewed & Cleared', 'Reviewed & Approved', 'Under Ongoing Review', 'Escalated to Multi-Agency', 'Closed / Resolved'].includes(item.sgReview) && (
            <option value={item.sgReview} className="bg-white text-neutral-900 font-normal">{item.sgReview}</option>
          )}
        </select>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#f0fdfa] text-[#0f766e]">
          <ShieldCheck className="w-3 h-3 text-[#0d9488]" />
          {item.sgReview}
        </span>
      );
    }

    if (col.key === 'dateLeft') {
      return <span className="whitespace-nowrap font-mono text-[11px] text-neutral-700">{item.dateLeft || '—'}</span>;
    }

    if (col.key === 'reasonForLeaving') {
      return (
        <span className="inline-block px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded text-[11px] font-medium">
          {item.reasonForLeaving || 'Departed'}
        </span>
      );
    }

    // Custom or fallback column rendering
    if (typeof val === 'boolean') {
      return (
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${val ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'}`}>
          {val ? 'Yes' : 'No'}
        </span>
      );
    }

    if (col.badgeColors && val && col.badgeColors[String(val)]) {
      return (
        <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded border ${col.badgeColors[String(val)]}`}>
          {String(val)}
        </span>
      );
    }

    return <span className="text-[#242424] text-[11px]">{val !== undefined && val !== null && val !== '' ? String(val) : '—'}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[#0d9488]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">
              SPCD Case Tracker
            </h1>
            <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded">
              Special Provision &amp; Service User Log
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-1">
            Tracking Current SUs in residence and Archived SUs who have departed, relocated, or dispersed.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUserRole === 'Super Admin' && (
            <button
              id="btn-customize-spcd-table"
              onClick={() => setIsSchemaEditorOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-300 rounded-xs shadow-xs transition-colors cursor-pointer"
              title="Configure Table Headers & Form Fields (Super Admin Only)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#0d9488]" />
              <span>Customize Table</span>
            </button>
          )}

          <ExportDropdown
            moduleName={`SPCD (${activeTab === 'current' ? 'Current SUs' : 'Archived SUs'})`}
            totalRecordCount={(activeTab === 'current' ? currentSUs : archivedSUs).length}
            filteredRecordCount={sortedRecords.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={spcdExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />

          {canCreateRecord() && (
            <button
              id="btn-add-spcd-record"
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add SPCD Case Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs: Current SUs vs Archived SUs */}
      <div className="flex items-center gap-2 border-b border-[#edebe9]">
        <button
          id="tab-spcd-current"
          onClick={() => {
            setActiveTab('current');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'current'
              ? 'border-[#0d9488] text-[#0f766e] bg-white'
              : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
            }`}
        >
          <UserCheck className="w-4 h-4 text-[#0d9488]" />
          <span>Current SUs</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#f0fdfa] text-[#0f766e] font-bold">
            {currentSUs.length}
          </span>
        </button>

        <button
          id="tab-spcd-archived"
          onClick={() => {
            setActiveTab('archived');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'archived'
              ? 'border-[#0d9488] text-[#0f766e] bg-white'
              : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
            }`}
        >
          <Archive className="w-4 h-4 text-neutral-500" />
          <span>Archived SUs (Departed / Left)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-100 text-neutral-600 font-bold">
            {archivedSUs.length}
          </span>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white border border-[#e1dfdd] p-3 rounded-xs shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Site Filter */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-neutral-500" />
            <span className="font-semibold text-neutral-700">Site:</span>
            <select
              value={siteFilter}
              onChange={e => setSiteFilter(e.target.value)}
              disabled={!canAccessAllSites()}
              className="px-2.5 py-1.5 bg-[#f3f2f1] border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
            >
              {canAccessAllSites() && <option value="all">All Properties ({allowedSites.length})</option>}
              {allowedSites.map((s, idx) => (
                <option key={`${s}-${idx}`} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {(searchQuery || (canAccessAllSites() && siteFilter !== 'all')) && (
            <button
              onClick={() => {
                setSiteFilter(canAccessAllSites() ? 'all' : assignedSite);
                setSearchQuery('');
              }}
              className="px-2 py-1 text-xs text-[#0d9488] hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search SU name, port ref, room, notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#f3f2f1] border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
          />
        </div>
      </div>

      {/* SPCD Data Table */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none">
                {visibleSpcdColumns.map(col => (
                  <th
                    key={String(col.key)}
                    onClick={() => handleSort(col.key as any)}
                    className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors"
                    title={`Sort by ${col.label}`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      {col.isCustom && (
                        <span className="px-1 text-[9px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded">
                          custom
                        </span>
                      )}
                      {sortField === col.key ? (
                        sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />
                      )}
                    </div>
                  </th>
                ))}
                {activeTab === 'archived' && (
                  <>
                    <th onClick={() => handleSort('dateLeft')} className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Date Left">
                      <div className="flex items-center gap-1">
                        <span>Date Left</span>
                        {sortField === 'dateLeft' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('reasonForLeaving')} className="py-2.5 px-3 min-w-[160px] cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Reason for Leaving">
                      <div className="flex items-center gap-1">
                        <span>Reason for Leaving</span>
                        {sortField === 'reasonForLeaving' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                  </>
                )}
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#242424]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={visibleSpcdColumns.length + (activeTab === 'archived' ? 3 : 1)} className="py-8 text-center text-[#605e5c]">
                    <ClipboardList className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold">No {activeTab === 'current' ? 'active' : 'archived'} SPCD records found.</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">Click "Add SPCD Case Entry" to register new service user case updates.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(item => (
                  <tr key={item.id} className="hover:bg-[#f3f2f1]/60 transition-colors">
                    {visibleSpcdColumns.map(col => (
                      <td key={String(col.key)} className="py-2.5 px-3">
                        {renderColumnCell(col, item)}
                      </td>
                    ))}

                    {/* Archived Specific Columns */}
                    {activeTab === 'archived' && (
                      <>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-neutral-700">
                          {item.dateLeft || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded text-[11px] font-medium">
                            {item.reasonForLeaving || 'Departed'}
                          </span>
                        </td>
                      </>
                    )}

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-end gap-1">
                        {activeTab === 'current' && canEditRecord() && (
                          <button
                            onClick={() => {
                              setDepartingRecord(item);
                              setDepartureDate(new Date().toISOString().slice(0, 10));
                            }}
                            title="Mark as Departed / Left (Archive SU)"
                            className="p-1 text-amber-700 hover:bg-amber-50 rounded"
                          >
                            <LogOut className="w-4 h-4" />
                          </button>
                        )}

                        {activeTab === 'archived' && canEditRecord() && (
                          <button
                            onClick={() => restoreSPCDRecord(item.id)}
                            title="Restore SU to Current List"
                            className="p-1 text-[#0d9488] hover:bg-[#edebe9] rounded"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => setViewDetailRecord(item)}
                          title="View SPCD Case Details"
                          className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-[#edebe9] rounded"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {canEditRecord() && (
                          <button
                            onClick={() => setEditingRecord({
                              ...item,
                              staffReporting: getRaisedBy(item),
                              raisedBy: getRaisedBy(item)
                            })}
                            title="Edit Record"
                            className="p-1 text-[#0d9488] hover:bg-[#edebe9] rounded"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {canDeleteRecord() && (
                          <button
                            onClick={() => deleteSPCDRecord(item.id)}
                            title="Delete Record"
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
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
        {sortedRecords.length > 0 && (
          <div className="p-3 border-t border-[#edebe9] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-neutral-500">
              Showing <span className="font-semibold text-neutral-800">{paginatedRecords.length}</span> of <span className="font-semibold text-neutral-800">{sortedRecords.length}</span> records
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={sortedRecords.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {/* DYNAMIC CREATE SPCD RECORD MODAL */}
      <DynamicRecordFormModal<SPCDRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add SPCD Case Entry"
        columns={spcdColumns}
        initialValues={{
          date: new Date().toISOString().slice(0, 10),
          siteName: allowedSites[0] || 'Victoria House',
          staffReporting: loggedInUserName,
          suDob: '1990-01-01',
          sgReview: 'Pending Safeguarding Lead Review'
        }}
        onSave={(data) => {
          const reporter = data.staffReporting || loggedInUserName;
          addSPCDRecord({
            ...data,
            date: data.date || new Date().toISOString().slice(0, 10),
            siteName: data.siteName || allowedSites[0] || 'Victoria House',
            site: data.siteName || allowedSites[0] || 'Victoria House',
            roomNumber: data.roomNumber || '',
            staffReporting: reporter,
            raisedBy: reporter,
            suName: data.suName || '',
            suPortReference: data.suPortReference || '',
            suDob: data.suDob || '1990-01-01',
            briefDescriptionActionTaken: data.briefDescriptionActionTaken || '',
            followUpNotes: data.followUpNotes || '',
            updates: data.updates || '',
            sgReview: data.sgReview || 'Pending Safeguarding Lead Review',
            isArchived: false
          } as any);
          setIsCreateModalOpen(false);
        }}
      />

      {/* DYNAMIC EDIT SPCD RECORD MODAL */}
      <DynamicRecordFormModal<SPCDRecord>
        isOpen={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title={`Edit SPCD Case Record: ${editingRecord?.suName || ''}`}
        columns={spcdColumns}
        initialValues={editingRecord || undefined}
        isEdit={true}
        onSave={(data) => {
          if (!editingRecord) return;
          const reporter = data.staffReporting || (editingRecord as any).raisedBy || getRaisedBy(editingRecord) || loggedInUserName;
          updateSPCDRecord(editingRecord.id, {
            ...editingRecord,
            ...data,
            site: data.siteName || editingRecord.siteName,
            staffReporting: reporter,
            raisedBy: reporter
          });
          setEditingRecord(null);
        }}
      />

      {/* DEPART / ARCHIVE SU MODAL */}
      {departingRecord && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-[#8a8886] rounded-xs shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-[#edebe9] flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-2">
                <LogOut className="w-5 h-5 text-amber-700" />
                <h3 className="text-base font-bold text-amber-900">
                  Mark SU as Departed (Archive)
                </h3>
              </div>
              <button
                onClick={() => setDepartingRecord(null)}
                className="p-1 hover:bg-amber-100 rounded text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDepart} className="p-5 space-y-4 text-xs">
              <p className="text-neutral-700">
                You are marking <strong>{departingRecord.suName}</strong> ({departingRecord.suPortReference}) at <strong>{departingRecord.siteName}</strong> as departed. This case will be moved to the <strong>Archived SUs</strong> view.
              </p>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Date Left / Dispersal Date *
                </label>
                <input
                  type="date"
                  required
                  value={departureDate}
                  onChange={e => setDepartureDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs font-mono text-neutral-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Reason for Leaving *
                </label>
                <select
                  value={departureReason}
                  onChange={e => setDepartureReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 mb-2"
                >
                  <option value="Dispersed to Home Office NASS Accommodation">Dispersed to Home Office NASS Accommodation</option>
                  <option value="Positive Asylum Decision - Private Sector Tenancy">Positive Asylum Decision - Private Sector Tenancy</option>
                  <option value="Voluntary Departure / Left of Own Accord">Voluntary Departure / Left of Own Accord</option>
                  <option value="Transferred to Alternative Hotel Site">Transferred to Alternative Hotel Site</option>
                  <option value="Notice to Quit / Evicted">Notice to Quit / Evicted</option>
                  <option value="Other">Other Reason (Specify below)</option>
                </select>

                {departureReason === 'Other' && (
                  <input
                    type="text"
                    placeholder="Specify other reason..."
                    onChange={e => setDepartureReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800"
                  />
                )}
              </div>

              <div className="pt-3 border-t border-[#edebe9] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDepartingRecord(null)}
                  className="px-3 py-2 bg-white hover:bg-[#edebe9] border border-[#8a8886] rounded-xs font-semibold text-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xs font-semibold shadow-xs"
                >
                  Confirm Departure & Archive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DYNAMIC VIEW SPCD RECORD MODAL */}
      <DynamicRecordViewModal<SPCDRecord>
        isOpen={Boolean(viewDetailRecord)}
        onClose={() => setViewDetailRecord(null)}
        title={`SPCD Case Details: ${viewDetailRecord?.suName || ''}`}
        columns={spcdColumns}
        record={viewDetailRecord}
        onEdit={viewDetailRecord && canEditRecord(viewDetailRecord.siteName) ? () => {
          const rec = viewDetailRecord;
          setViewDetailRecord(null);
          setEditingRecord({ ...rec, staffReporting: getRaisedBy(rec), raisedBy: getRaisedBy(rec) });
        } : undefined}
      />

      {/* Table Schema / Header Customizer Modal (Super Admin Only) */}
      <TableSchemaEditorModal<SPCDRecord>
        isOpen={isSchemaEditorOpen}
        onClose={() => setIsSchemaEditorOpen(false)}
        moduleTitle="SPCD Case Tracker"
        columns={spcdColumns}
        onSaveColumns={handleSaveSpcdColumns}
        onResetToDefault={handleResetSpcdColumns}
        currentUserRole={currentUserRole}
      />

    </div>
  );
};
