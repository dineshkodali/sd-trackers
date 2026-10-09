import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Eye,
  Edit3,
  Archive,
  RotateCcw,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  FolderHeart,
  Search
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SGReferral, StatusType } from '../../types';
import { Pagination } from '../common/Pagination';
import { CompactRecordCard, CompactRecordList } from '../common/CompactRecordCards';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { ExportModal, ExportFormat, ExportScope, ExportColumnOption, ExportOrientation } from '../common/ExportModal';
import { ExportDropdown } from '../common/ExportDropdown';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { referralsTableConfig } from '../../config/trackerTableConfigs';
import { useTableSchema } from '../../hooks/useTableSchema';
import { BulkActionToolbar } from '../common/BulkActionToolbar';
import { TableColumnConfig } from '../../types/tableSchema';

const referralExportColumns: ExportColumnOption[] = [
  { id: 'site', label: 'Hotel / Site' },
  { id: 'referralCouncil', label: 'Referral Council' },
  { id: 'suName', label: 'Service User Name' },
  { id: 'portRef', label: 'Port / NASS Ref' },
  { id: 'mosaicId', label: 'Mosaic ID' },
  { id: 'dob', label: 'Date of Birth' },
  { id: 'raisedBy', label: 'Raised By' },
  { id: 'officerLeadingHotel', label: 'Officer Leading (Hotel)' },
  { id: 'referralType', label: 'Referral Type' },
  { id: 'status', label: 'Status' },
  { id: 'dateReferred', label: 'Date Referred' },
  { id: 'methodOfReferral', label: 'Method of Referral' },
  { id: 'acknowledgementReceived', label: 'Acknowledgement' },
  { id: 'responseReceivedFromLA', label: 'LA Response' },
  { id: 'laOfficerLeading', label: 'LA Officer Leading' },
  { id: 'notesActionTaken', label: 'Actions Taken' },
  { id: 'sgReview', label: 'SG Review & Notes' }
];

interface ReferralsViewProps {
  isArchive?: boolean;
}

export const ReferralsView: React.FC<ReferralsViewProps> = ({ isArchive = false }) => {
  const {
    referrals,
    allowedSites,
    addReferral,
    updateReferral,
    archiveReferral,
    restoreReferral,
    deleteReferral,
    requestConfirmation,
    canDeleteRecord,
    canEditRecord,
    canCreateRecord,
    canAccessAllSites,
    assignedSite,
    currentUserRole,
    currentUserName,
    authProfile,
    settings,
    setActivePage,
    getFieldOptions,
    globalSearchFilter,
    setGlobalSearchFilter,
    isMobileCompactView
  } = useApp();

  const loggedInUserName = authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || (currentUserRole ? `${currentUserRole} (User)` : 'Duty Officer');

  const referralStatusOptions = useMemo(() => getFieldOptions('referralStatuses'), [getFieldOptions]);

  const [siteFilter, setSiteFilter] = useState<string>(canAccessAllSites() ? 'all' : assignedSite);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync with global header search
  useEffect(() => {
    if (globalSearchFilter) {
      setSearchQuery(globalSearchFilter);
      setGlobalSearchFilter('');
    }
  }, [globalSearchFilter, setGlobalSearchFilter]);

  // Dynamic Table Schema & Columns (Local persistence with fallback to trackerTableConfigs)
  const {
    columns: referralsColumns,
    tableColumns: visibleReferralsColumns,
    saveColumns: handleSaveReferralsColumns,
    resetToDefault: handleResetReferralsColumns
  } = useTableSchema<SGReferral>('referrals', referralsTableConfig);

  const [isSchemaEditorOpen, setIsSchemaEditorOpen] = useState<boolean>(false);

  // Sorting
  const [sortField, setSortField] = useState<string>('dateReferred');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(settings.pageSize || 10);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [viewRecord, setViewRecord] = useState<SGReferral | null>(null);
  const [editingRecord, setEditingRecord] = useState<SGReferral | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportModalFormat, setExportModalFormat] = useState<ExportFormat>('pdf');

  // All matching dataset before pagination
  const allDataset = useMemo(() => {
    return referrals.filter(r => isArchive ? r.status === 'Archived' : r.status !== 'Archived');
  }, [referrals, isArchive]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return referrals.filter(r => {
      // Archive toggle
      if (isArchive) {
        if (r.status !== 'Archived') return false;
      } else {
        if (r.status === 'Archived') return false;
      }

      // Site filter
      if (siteFilter !== 'all' && r.site !== siteFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;

      // Month filter
      if (monthFilter !== 'all' && (!r.dateReferred || !r.dateReferred.startsWith(monthFilter))) return false;

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fullString = `${r.suName || ''} ${r.portRef || ''} ${r.mosaicId || ''} ${r.referralCouncil || ''} ${r.notesActionTaken || ''} ${r.laOfficerLeading || ''}`.toLowerCase();
        if (!fullString.includes(q)) return false;
      }

      return true;
    });
  }, [referrals, isArchive, siteFilter, statusFilter, monthFilter, searchQuery]);

  // Sorted dataset
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA: any = (a as any)[sortField] ?? '';
      let valB: any = (b as any)[sortField] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortAsc]);

  // Paginated records for fast DOM rendering
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleResetFilters = () => {
    setSiteFilter(canAccessAllSites() ? 'all' : assignedSite);
    setMonthFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === paginatedData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedData.map(r => r.id));
    }
  };

  const handleToggleSelect = (e: React.SyntheticEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    requestConfirmation({
      title: 'Delete Selected Referrals',
      message: `Are you sure you want to delete ${selectedIds.length} referrals? This action is permanent.`,
      isDanger: true,
      onConfirm: async () => {
        for (const id of selectedIds) {
          await deleteReferral(id);
        }
        setSelectedIds([]);
      }
    });
  };

  const handleOpenExportModal = (format: ExportFormat = 'pdf') => {
    setExportModalFormat(format);
    setIsExportModalOpen(true);
  };

  const calculateDateRangeCount = (start: string, end: string) => {
    return allDataset.filter(r => r.dateReferred >= start && r.dateReferred <= end).length;
  };

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    if (scope === 'filtered') return sortedData;
    if (scope === 'custom' && startDate && endDate) {
      return allDataset.filter(r => r.dateReferred >= startDate && r.dateReferred <= endDate);
    }
    return allDataset;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (r: SGReferral) => string | number }> => ({
    site: { label: 'Hotel / Site', getValue: r => r.site },
    referralCouncil: { label: 'Council', getValue: r => r.referralCouncil },
    suName: { label: 'SU Name', getValue: r => r.suName },
    portRef: { label: 'Port / NASS Ref', getValue: r => r.portRef || '—' },
    mosaicId: { label: 'Mosaic ID', getValue: r => r.mosaicId || '—' },
    dob: { label: 'DOB', getValue: r => r.dob || '—' },
    raisedBy: { label: 'Raised By', getValue: r => r.raisedBy || r.officerLeadingHotel || '—' },
    officerLeadingHotel: { label: 'Officer Leading', getValue: r => r.officerLeadingHotel || r.raisedBy || '—' },
    referralType: { label: 'Type', getValue: r => r.referralType },
    status: { label: 'Status', getValue: r => r.status },
    dateReferred: { label: 'Date Referred', getValue: r => r.dateReferred },
    methodOfReferral: { label: 'Method', getValue: r => r.methodOfReferral },
    acknowledgementReceived: { label: 'Acknowledgement', getValue: r => r.acknowledgementReceived },
    responseReceivedFromLA: { label: 'LA Response', getValue: r => r.responseReceivedFromLA },
    laOfficerLeading: { label: 'LA Lead', getValue: r => r.laOfficerLeading || '—' },
    notesActionTaken: { label: 'Action Taken', getValue: r => r.notesActionTaken },
    sgReview: { label: 'SG Review', getValue: r => r.sgReview }
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
      : referralExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(r => activeCols.map(c => colMap[c].getValue(r)));
    return { headers, rows };
  };

  const handlePerformExport = ({
    format,
    scope,
    startDate,
    endDate,
    selectedColumns,
    isCompact
  }: {
    format: ExportFormat;
    scope: ExportScope;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => {
    const dataToExport = getExportDataForScope(scope, startDate, endDate);
    const title = isArchive ? 'Archived Safeguarding Referrals' : 'Safeguarding Referrals Register';

    const colMap = getExportColumnMap();
    const cols = selectedColumns && selectedColumns.length > 0
      ? selectedColumns
      : referralExportColumns.map(c => c.id);

    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(r => activeCols.map(c => colMap[c].getValue(r)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `SG-Referrals-${isArchive ? 'Archived-' : ''}${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title,
        subtitle: 'Multi-agency safeguarding referrals and local authority council outcomes.',
        filename: `SG-Referrals-${isArchive ? 'Archived-' : ''}${scope}-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        isCompact,
        metadata: [
          { label: 'Scope', value: scope === 'all' ? 'All Records' : scope === 'custom' ? `${startDate} to ${endDate}` : 'Filtered View' },
          { label: 'Site Filter', value: siteFilter === 'all' ? 'All Permitted Sites' : siteFilter },
          { label: 'Density', value: isCompact ? 'Compact View' : 'Standard View' },
          { label: 'Total Exported', value: dataToExport.length }
        ]
      });
    }
  };

  const renderColumnCell = (col: TableColumnConfig<SGReferral>, r: SGReferral) => {
    const val = (r as any)[col.key];

    if (col.renderCell) {
      return col.renderCell(val, r);
    }

    if (col.key === 'site') {
      return <span className="font-medium text-[#242424]">{r.site}</span>;
    }

    if (col.key === 'referralCouncil') {
      return <span className="text-neutral-600">{r.referralCouncil}</span>;
    }

    if (col.key === 'suName') {
      return (
        <button
          onClick={() => setViewRecord(r)}
          className="hover:underline text-left font-semibold text-[#0f766e] cursor-pointer"
        >
          {r.suName || '—'}
        </button>
      );
    }

    if (col.key === 'status') {
      return canEditRecord(r.site) && !isArchive ? (
        <select
          value={r.status}
          onChange={e => updateReferral(r.id, { status: e.target.value as StatusType })}
          className={`px-2 py-0.5 text-[11px] font-semibold rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0078d4] ${
            r.status === 'Open' ? 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]' :
            r.status === 'In progress' ? 'bg-[#fff4ce] text-[#7f6000] border-[#ffe788]' :
            r.status === 'Completed' ? 'bg-[#e8f5e9] text-[#107c10] border-[#c8e6c9]' :
            r.status === 'Archived' ? 'bg-[#f0eafd] text-[#5c2d91] border-[#dcd0f9]' :
            'bg-neutral-100 text-neutral-700 border-neutral-300'
          }`}
          title="Click to update referral status"
        >
          {referralStatusOptions.map(opt => (
            <option key={opt.id} value={opt.value} className="bg-white text-neutral-900 font-normal">
              {opt.label}
            </option>
          ))}
          {!referralStatusOptions.some(o => o.value === r.status) && (
            <option value={r.status} className="bg-white text-neutral-900 font-normal">
              {r.status}
            </option>
          )}
        </select>
      ) : (
        <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded ${
          r.status === 'Open' ? 'bg-[#f0fdfa] text-[#0f766e]' :
          r.status === 'In progress' ? 'bg-[#fff4ce] text-[#7f6000]' :
          r.status === 'Completed' ? 'bg-[#e8f5e9] text-[#107c10]' :
          r.status === 'Archived' ? 'bg-[#f0eafd] text-[#5c2d91]' :
          'bg-neutral-100 text-neutral-700'
        }`}>
          {r.status}
        </span>
      );
    }

    if (col.key === 'mosaicId' || col.key === 'portRef' || col.key === 'dob' || col.key === 'dateReferred') {
      return <span className="font-mono text-[11px] text-neutral-600">{val || '—'}</span>;
    }

    if (col.key === 'raisedBy' || col.key === 'officerLeadingHotel') {
      return <span className="text-neutral-700">{r.raisedBy || r.officerLeadingHotel || '—'}</span>;
    }

    if (col.key === 'acknowledgementReceived') {
      return (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
          r.acknowledgementReceived === 'Yes'
            ? 'bg-emerald-100 text-emerald-800'
            : r.acknowledgementReceived === 'Pending'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-neutral-100 text-neutral-600'
        }`}>
          {r.acknowledgementReceived || '—'}
        </span>
      );
    }

    if (col.key === 'responseReceivedFromLA') {
      return (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
          r.responseReceivedFromLA === 'Yes'
            ? 'bg-emerald-100 text-emerald-800'
            : r.responseReceivedFromLA === 'Awaiting Allocation'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-neutral-100 text-neutral-600'
        }`}>
          {r.responseReceivedFromLA || '—'}
        </span>
      );
    }

    if (col.key === 'notesActionTaken' || col.key === 'sgReview') {
      return (
        <span className="text-[11px] max-w-[280px] truncate block" title={val}>
          {val || '—'}
        </span>
      );
    }

    if (col.badgeColors && col.badgeColors[val]) {
      return (
        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${col.badgeColors[val]}`}>
          {val}
        </span>
      );
    }

    if (col.type === 'checkbox') {
      return (
        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${val ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-100 text-neutral-500'}`}>
          {val ? 'Yes' : 'No'}
        </span>
      );
    }

    if (col.type === 'currency' && val !== undefined && val !== null && val !== '') {
      return <span className="font-mono font-medium text-neutral-800">£{Number(val).toFixed(2)}</span>;
    }

    return <span className="text-neutral-700">{val !== undefined && val !== null && val !== '' ? String(val) : '—'}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Top Banner, Header, Actions & Filters in ONE unified section */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 border border-teal-200 text-[#0d9488] rounded-xs">
              <FolderHeart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424] tracking-tight">
                  {isArchive ? 'Archived SG Referrals' : 'Safeguarding Referrals'}
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-xs bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4]">
                  {sortedData.length} Cases
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                {isArchive
                  ? 'Safeguarding referrals that have concluded or been archived.'
                  : 'Track multi-agency safeguarding referrals and local authority council outcomes.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Active / Archive Subnav buttons */}
            <div className="bg-[#edebe9] p-0.5 rounded-xs flex items-center text-xs">
              <button
                onClick={() => setActivePage('referrals')}
                className={`px-3 py-1.5 rounded-xs font-semibold transition-colors cursor-pointer ${
                  !isArchive ? 'bg-white text-[#0f766e] shadow-xs' : 'text-[#605e5c] hover:text-[#242424]'
                }`}
              >
                Active Referrals
              </button>
              <button
                onClick={() => setActivePage('referralsArchive')}
                className={`px-3 py-1.5 rounded-xs font-semibold transition-colors cursor-pointer ${
                  isArchive ? 'bg-white text-[#0f766e] shadow-xs' : 'text-[#605e5c] hover:text-[#242424]'
                }`}
              >
                Archive
              </button>
            </div>

            {/* Super Admin Table Customizer Button */}
            {currentUserRole === 'Super Admin' && (
              <button
                id="btn-customize-referrals-table"
                onClick={() => setIsSchemaEditorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
                title="Configure Table Headers & Form Fields (Super Admin Only)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>Customize Table</span>
              </button>
            )}

            <ExportDropdown
              moduleName={isArchive ? "Archived Referrals" : "SG Referrals"}
              totalRecordCount={allDataset.length}
              filteredRecordCount={sortedData.length}
              defaultOrientation="landscape"
              dateRangeRecordCount={calculateDateRangeCount}
              availableColumns={referralExportColumns}
              getPreviewData={getExportPreviewData}
              onExport={handlePerformExport}
            />

            {!isArchive && canCreateRecord() && (
              <button
                id="btn-new-referral"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-medium rounded-xs transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Record</span>
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
              placeholder="Search referrals, SU name, council..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            />
          </div>

          <div>
            <select
              value={siteFilter}
              onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); }}
              disabled={!canAccessAllSites()}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              {canAccessAllSites() && <option value="all">All Properties / Sites ({allowedSites.length})</option>}
              {allowedSites.map((s, idx) => (
                <option key={`${s}-${idx}`} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={monthFilter}
              onChange={e => { setMonthFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Months</option>
              <option value="2026-06">June 2026</option>
              <option value="2026-05">May 2026</option>
              <option value="2026-04">April 2026</option>
              <option value="2026-03">March 2026</option>
              <option value="2026-02">February 2026</option>
              <option value="2026-01">January 2026</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Statuses</option>
              {referralStatusOptions.map(opt => (
                <option key={opt.id} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table in a SEPARATE card */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs min-h-[520px] lg:min-h-[calc(100vh-270px)] flex flex-col justify-between">
        {isMobileCompactView ? (
          <div className="p-3 bg-neutral-50/50 flex-1 overflow-y-auto">
            <CompactRecordList
              data={paginatedData}
              emptyMessage="No referral records found matching current criteria."
              renderCard={(r, idx) => {
                const canEdit = canEditRecord(r.site);
                const canDelete = canDeleteRecord();
                const srNo = r.srNo || (currentPage - 1) * pageSize + idx + 1;

                return (
                  <CompactRecordCard
                    key={r.id}
                    id={r.id}
                    srNo={srNo}
                    title={r.suName || 'Unnamed Service User'}
                    subtitle={r.portRef ? `Port/NASS Ref: ${r.portRef}` : undefined}
                    site={r.site}
                    statusBadge={renderColumnCell({ key: 'status' } as any, r)}
                    fields={[
                      { label: 'Council', value: r.referralCouncil },
                      { label: 'Mosaic ID', value: r.mosaicId },
                      { label: 'Date', value: r.dateReferred },
                      { label: 'Type', value: r.referralType }
                    ]}
                    isArchived={r.status === 'Archived'}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onView={() => setViewRecord(r)}
                    onEdit={canEdit ? () => setEditingRecord(r) : undefined}
                    onArchive={r.status !== 'Archived' ? () => archiveReferral(r.id) : undefined}
                    onRestore={r.status === 'Archived' ? () => restoreReferral(r.id) : undefined}
                    onDelete={canDelete ? () => deleteReferral(r.id) : undefined}
                  />
                );
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse min-w-[1700px]">
              <thead>
                <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                  {!isArchive && (
                    <th className="p-2.5 w-12 text-center">Sr. No.</th>
                  )}
                  {visibleReferralsColumns.map(col => {
                    const isSorted = sortField === col.key;
                    return (
                      <th
                        key={String(col.key)}
                        onClick={() => handleSort(String(col.key))}
                        className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                        title={`Sort by ${col.label}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{col.label}</span>
                          {col.isCustom && (
                            <span className="text-[9px] px-1 py-0.2 bg-teal-50 text-teal-700 border border-teal-200 rounded font-normal">
                              Custom
                            </span>
                          )}
                          {isSorted ? (
                            sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edebe9]">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={visibleReferralsColumns.length + (isArchive ? 1 : 2)} className="text-center py-12 text-[#605e5c]">
                      No referral records found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((r, idx) => {
                    const canEdit = canEditRecord(r.site);
                    const canDelete = canDeleteRecord();

                    return (
                      <tr key={r.id} className="hover:bg-[#fafafa] transition-colors">
                        {!isArchive && (
                          <td className="p-2.5 text-center text-neutral-400 font-mono">
                            {r.srNo || (currentPage - 1) * pageSize + idx + 1}
                          </td>
                        )}
                        {visibleReferralsColumns.map(col => (
                          <td key={String(col.key)} className="p-2.5 whitespace-nowrap">
                            {renderColumnCell(col, r)}
                          </td>
                        ))}
                        <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                          <div className="flex items-center justify-end gap-1">
                            {/* View details */}
                            <button
                              id={`view-ref-${r.id}`}
                              onClick={() => setViewRecord(r)}
                              className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#edebe9] rounded"
                              title="View Record Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit record */}
                            {canEdit && (
                              <button
                                id={`edit-ref-${r.id}`}
                                onClick={() => setEditingRecord(r)}
                                className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#edebe9] rounded"
                                title="Edit Record"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Archive / Restore */}
                            {r.status === 'Archived' ? (
                              <button
                                id={`restore-ref-${r.id}`}
                                onClick={() => restoreReferral(r.id)}
                                className="p-1 text-[#0d9488] hover:bg-[#edebe9] rounded font-semibold text-[11px] flex items-center gap-0.5"
                                title="Restore Referral"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Restore</span>
                              </button>
                            ) : (
                              <button
                                id={`archive-ref-${r.id}`}
                                onClick={() => archiveReferral(r.id)}
                                className="p-1 text-neutral-500 hover:text-purple-700 hover:bg-[#edebe9] rounded"
                                title="Archive Referral"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete record (strictly checked) */}
                            {canDelete && (
                              <button
                                id={`delete-ref-${r.id}`}
                                onClick={() => deleteReferral(r.id)}
                                className="p-1 text-neutral-400 hover:text-[#a4262c] hover:bg-red-50 rounded"
                                title="Delete Record"
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
        )}

        {/* Pagination bar */}
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

      {/* DYNAMIC CREATE SG REFERRAL MODAL */}
      <DynamicRecordFormModal<SGReferral>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="New SG Referral Submission"
        columns={referralsColumns}
        initialValues={{
          site: !canAccessAllSites() ? assignedSite : (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])),
          dateReferred: new Date().toISOString().slice(0, 10),
          status: 'Open',
          methodOfReferral: 'Encrypted Email',
          referralType: 'Safeguarding Adult',
          urgency: 'Medium',
          attachments: []
        }}
        onSave={(data) => {
          const currentOfficer = (data as any).raisedBy || (data as any).officerLeadingHotel || loggedInUserName;
          const effectiveSite = !canAccessAllSites() ? assignedSite : (data.site || (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])));
          addReferral({
            site: effectiveSite,
            referralCouncil: data.referralCouncil || '',
            suName: data.suName || '',
            portRef: data.portRef || '',
            mosaicId: data.mosaicId || '',
            dob: data.dob || '',
            raisedBy: currentOfficer,
            officerLeadingHotel: currentOfficer,
            referralType: (data.referralType as any) || 'Safeguarding Adult',
            urgency: (data.urgency as any) || 'Routine',
            status: data.status || 'Open',
            dateReferred: data.dateReferred || new Date().toISOString().slice(0, 10),
            methodOfReferral: (data.methodOfReferral as any) || 'Encrypted Email',
            acknowledgementReceived: data.acknowledgementReceived || 'Pending',
            responseReceivedFromLA: data.responseReceivedFromLA || 'Pending',
            laOfficerLeading: data.laOfficerLeading || '',
            notesActionTaken: data.notesActionTaken || '',
            sgReview: data.sgReview || '',
            attachments: Array.isArray(data.attachments) ? data.attachments : [],
            ...data
          });
          setIsCreateModalOpen(false);
        }}
      />

      {/* DYNAMIC EDIT SG REFERRAL MODAL */}
      <DynamicRecordFormModal<SGReferral>
        isOpen={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title={`Edit SG Referral Dossier: ${editingRecord?.suName || ''}`}
        columns={referralsColumns}
        initialValues={editingRecord || undefined}
        isEdit={true}
        onSave={(data) => {
          if (!editingRecord) return;
          const currentOfficer = (data as any).raisedBy || (data as any).officerLeadingHotel || loggedInUserName;
          updateReferral(editingRecord.id, {
            ...editingRecord,
            ...data,
            raisedBy: currentOfficer,
            officerLeadingHotel: currentOfficer
          });
          setEditingRecord(null);
        }}
      />

      {/* DYNAMIC VIEW SG REFERRAL MODAL */}
      <DynamicRecordViewModal<SGReferral>
        isOpen={Boolean(viewRecord)}
        onClose={() => setViewRecord(null)}
        title={`Safeguarding Referral Dossier: ${viewRecord?.suName || ''}`}
        columns={referralsColumns}
        record={viewRecord}
        onEdit={viewRecord && canEditRecord(viewRecord.site) && !isArchive ? () => {
          const rec = viewRecord;
          setViewRecord(null);
          setEditingRecord(rec);
        } : undefined}
      />

      {/* Export Selection & Configuration Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title={isArchive ? "Export Archived Safeguarding Referrals" : "Export Safeguarding Referrals Register"}
        moduleName={isArchive ? "Archived Referrals" : "SG Referrals"}
        defaultFormat={exportModalFormat}
        defaultOrientation="landscape"
        totalRecordCount={allDataset.length}
        filteredRecordCount={sortedData.length}
        dateRangeRecordCount={calculateDateRangeCount}
        availableColumns={referralExportColumns}
        getPreviewData={getExportPreviewData}
        onExport={handlePerformExport}
      />

      {/* SUPER ADMIN TABLE SCHEMA & HEADER CUSTOMIZER MODAL */}
      <TableSchemaEditorModal<SGReferral>
        isOpen={isSchemaEditorOpen}
        onClose={() => setIsSchemaEditorOpen(false)}
        moduleTitle="Safeguarding Referrals"
        columns={referralsColumns}
        onSaveColumns={handleSaveReferralsColumns}
        onResetToDefault={handleResetReferralsColumns}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
