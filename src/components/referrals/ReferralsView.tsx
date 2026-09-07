import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Eye, 
  Edit3, 
  Archive, 
  RotateCcw, 
  Trash2, 
  X, 
  Download,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SGReferral, StatusType, RiskLevel, RecordAttachment } from '../../types';
import { FilterBar } from '../common/FilterBar';
import { Pagination } from '../common/Pagination';
import { AttachmentsSection } from '../common/AttachmentsSection';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { ExportModal, ExportFormat, ExportScope, ExportColumnOption, ExportOrientation } from '../common/ExportModal';
import { ExportDropdown } from '../common/ExportDropdown';

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
    canDeleteRecord,
    canEditRecord,
    canCreateRecord,
    canAccessAllSites,
    canManageFiles,
    assignedSite,
    currentUserRole,
    currentUserName,
    authProfile,
    settings,
    setActivePage,
    getFieldOptions,
    globalSearchFilter,
    setGlobalSearchFilter
  } = useApp();

  const loggedInUserName = authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || (currentUserRole ? `${currentUserRole} (User)` : 'Duty Officer');

  const referralTypeOptions = useMemo(() => getFieldOptions('referralTypes'), [getFieldOptions]);
  const referralMethodOptions = useMemo(() => getFieldOptions('referralMethods'), [getFieldOptions]);
  const councilOptions = useMemo(() => getFieldOptions('councils'), [getFieldOptions]);
  const urgencyOptions = useMemo(() => getFieldOptions('riskLevels'), [getFieldOptions]);
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

  // Sorting
  const [sortField, setSortField] = useState<keyof SGReferral>('dateReferred');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(settings.pageSize || 10);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [viewRecord, setViewRecord] = useState<SGReferral | null>(null);
  const [editingRecord, setEditingRecord] = useState<SGReferral | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportModalFormat, setExportModalFormat] = useState<ExportFormat>('pdf');

  // New Record Form State
  const initialFormData = {
    site: allowedSites[0] || 'Hotel A',
    referralCouncil: 'Westminster City Council',
    suName: '',
    mosaicId: '',
    portRef: '',
    dob: '',
    raisedBy: loggedInUserName,
    officerLeadingHotel: loggedInUserName,
    referralType: 'Safeguarding Adult' as SGReferral['referralType'],
    status: 'Open' as StatusType,
    dateReferred: new Date().toISOString().slice(0, 10),
    methodOfReferral: 'Mosaic Portal' as SGReferral['methodOfReferral'],
    acknowledgementReceived: 'Yes' as SGReferral['acknowledgementReceived'],
    responseReceivedFromLA: 'Awaiting Allocation' as SGReferral['responseReceivedFromLA'],
    laOfficerLeading: '',
    notesActionTaken: '',
    sgReview: '',
    urgency: 'Medium' as RiskLevel
  };

  const [formData, setFormData] = useState(initialFormData);

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
      let valA: any = a[sortField] ?? '';
      let valB: any = b[sortField] ?? '';
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

  const handleSort = (field: keyof SGReferral) => {
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

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.suName.trim()) {
      alert('Please enter Service User (SU) name.');
      return;
    }
    const currentOfficer = formData.raisedBy || formData.officerLeadingHotel || loggedInUserName;
    addReferral({
      ...formData,
      raisedBy: currentOfficer,
      officerLeadingHotel: currentOfficer
    });
    setIsCreateModalOpen(false);
    setFormData({
      ...initialFormData,
      raisedBy: loggedInUserName,
      officerLeadingHotel: loggedInUserName
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    const currentOfficer = editingRecord.raisedBy || editingRecord.officerLeadingHotel || loggedInUserName;
    updateReferral(editingRecord.id, {
      ...editingRecord,
      raisedBy: currentOfficer,
      officerLeadingHotel: currentOfficer
    });
    setEditingRecord(null);
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <h2 className="text-2xl font-semibold text-[#242424] tracking-tight">
            {isArchive ? 'Archived SG Referrals' : 'SG Referrals'}
          </h2>
          <p className="text-xs text-[#605e5c] mt-0.5">
            {isArchive 
              ? 'Safeguarding referrals that have concluded or been archived.'
              : 'Track multi-agency safeguarding referrals and local authority council outcomes.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Active / Archive Subnav buttons */}
          <div className="bg-[#edebe9] p-0.5 rounded-xs flex items-center text-xs">
            <button
              onClick={() => setActivePage('referrals')}
              className={`px-3 py-1.5 rounded-xs font-semibold transition-colors ${
                !isArchive ? 'bg-white text-[#0f766e] shadow-xs' : 'text-[#605e5c] hover:text-[#242424]'
              }`}
            >
              Active Referrals
            </button>
            <button
              onClick={() => setActivePage('referralsArchive')}
              className={`px-3 py-1.5 rounded-xs font-semibold transition-colors ${
                isArchive ? 'bg-white text-[#0f766e] shadow-xs' : 'text-[#605e5c] hover:text-[#242424]'
              }`}
            >
              Archive
            </button>
          </div>

          {/* `canCreateRecord` was imported but never called: the button was gated
              on `!isArchive` alone, so a role explicitly denied creation could
              still create records (BUG-016). Delete and Edit were already gated,
              which is what made this an omission rather than a design choice. */}
          {!isArchive && canCreateRecord() && (
            <button
              id="btn-new-referral"
              onClick={() => {
                setFormData({ ...initialFormData, site: allowedSites[0] || 'Hotel A' });
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New Record</span>
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
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        siteFilter={siteFilter}
        setSiteFilter={setSiteFilter}
        monthFilter={monthFilter}
        setMonthFilter={setMonthFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onReset={handleResetFilters}
        onOpenExport={handleOpenExportModal}
        totalFilteredCount={sortedData.length}
        searchStorageKey="referrals_search"
      />

      {/* Main Table Panel with persistent bottom-stretching height */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1700px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                {isArchive ? (
                  <>
                    <th onClick={() => handleSort('site')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Site Name">
                      <div className="flex items-center gap-1">
                        <span>Site Name</span>
                        {sortField === 'site' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('referralCouncil')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Referral Council">
                      <div className="flex items-center gap-1">
                        <span>Referral Council</span>
                        {sortField === 'referralCouncil' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('suName')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by SU Name">
                      <div className="flex items-center gap-1">
                        <span>SU Name</span>
                        {sortField === 'suName' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('mosaicId')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Mosaic ID">
                      <div className="flex items-center gap-1">
                        <span>Mosaic</span>
                        {sortField === 'mosaicId' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('portRef')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Port / NASS Ref">
                      <div className="flex items-center gap-1">
                        <span>Port / Nass Ref</span>
                        {sortField === 'portRef' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('dob')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by DOB">
                      <div className="flex items-center gap-1">
                        <span>Date of Birth</span>
                        {sortField === 'dob' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th className="p-2.5">Raised By (Officer Leading)</th>
                    <th onClick={() => handleSort('referralType')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Referral Type">
                      <div className="flex items-center gap-1">
                        <span>Referral Type</span>
                        {sortField === 'referralType' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('status')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Status">
                      <div className="flex items-center gap-1">
                        <span>Status</span>
                        {sortField === 'status' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('dateReferred')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Date Referred">
                      <div className="flex items-center gap-1">
                        <span>Date Referred</span>
                        {sortField === 'dateReferred' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th className="p-2.5">Method of Referral</th>
                    <th className="p-2.5 text-center">Acknowledgement Received</th>
                    <th className="p-2.5 text-center">Response Received from LA</th>
                    <th className="p-2.5">LA Leading Officer</th>
                    <th className="p-2.5 min-w-[200px] max-w-[280px]">Notes - Action(s) Taken</th>
                    <th className="p-2.5 min-w-[200px] max-w-[280px]">SG Review</th>
                  </>
                ) : (
                  <>
                    <th className="p-2.5 w-12 text-center">Sr. No.</th>
                    <th onClick={() => handleSort('site')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Hotel / Site">
                      <div className="flex items-center gap-1">
                        <span>Hotel</span>
                        {sortField === 'site' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('referralCouncil')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Referral Council">
                      <div className="flex items-center gap-1">
                        <span>Referral Council</span>
                        {sortField === 'referralCouncil' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('suName')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by SU Name">
                      <div className="flex items-center gap-1">
                        <span>SU Name</span>
                        {sortField === 'suName' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('mosaicId')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Mosaic ID">
                      <div className="flex items-center gap-1">
                        <span>Mosaic ID</span>
                        {sortField === 'mosaicId' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('portRef')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Port / NASS Ref">
                      <div className="flex items-center gap-1">
                        <span>Port / Nass Ref</span>
                        {sortField === 'portRef' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('dob')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by DOB">
                      <div className="flex items-center gap-1">
                        <span>Date of Birth</span>
                        {sortField === 'dob' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th className="p-2.5">Raised By (Officer Leading)</th>
                    <th onClick={() => handleSort('referralType')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Referral Type">
                      <div className="flex items-center gap-1">
                        <span>Referral Type</span>
                        {sortField === 'referralType' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('status')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Status">
                      <div className="flex items-center gap-1">
                        <span>Status</span>
                        {sortField === 'status' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th onClick={() => handleSort('dateReferred')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Date Referred">
                      <div className="flex items-center gap-1">
                        <span>Date Referred</span>
                        {sortField === 'dateReferred' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                      </div>
                    </th>
                    <th className="p-2.5">Method of Referral</th>
                    <th className="p-2.5 text-center">Acknowledgement Received</th>
                    <th className="p-2.5 text-center">Response Received from LA</th>
                    <th className="p-2.5">LA officer Leading</th>
                    <th className="p-2.5 min-w-[200px] max-w-[280px]">Notes - Action(s) Taken</th>
                    <th className="p-2.5 min-w-[200px] max-w-[280px]">SG Review</th>
                  </>
                )}
                <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={isArchive ? 17 : 18} className="text-center py-12 text-[#605e5c]">
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
                      <td className="p-2.5 font-medium text-[#242424] whitespace-nowrap">
                        {r.site}
                      </td>
                      <td className="p-2.5 text-neutral-600 whitespace-nowrap">
                        {r.referralCouncil}
                      </td>
                      <td className="p-2.5 font-semibold text-[#0f766e] whitespace-nowrap">
                        <button 
                          onClick={() => setViewRecord(r)}
                          className="hover:underline text-left"
                        >
                          {r.suName}
                        </button>
                      </td>
                      <td className="p-2.5 text-neutral-500 font-mono text-[11px] whitespace-nowrap">
                        {r.mosaicId || '—'}
                      </td>
                      <td className="p-2.5 text-neutral-600 font-mono text-[11px] whitespace-nowrap">
                        {r.portRef || '—'}
                      </td>
                      <td className="p-2.5 text-neutral-600 whitespace-nowrap font-mono text-[11px]">
                        {r.dob || '—'}
                      </td>
                      <td className="p-2.5 text-neutral-700 whitespace-nowrap">
                        {r.raisedBy || r.officerLeadingHotel || '—'}
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span className="text-neutral-800">{r.referralType}</span>
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        {canEditRecord(r.site) && !isArchive ? (
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
                        )}
                      </td>
                      <td className="p-2.5 text-neutral-600 whitespace-nowrap font-mono text-[11px]">
                        {r.dateReferred}
                      </td>
                      <td className="p-2.5 text-neutral-600 text-[11px] whitespace-nowrap">
                        {r.methodOfReferral}
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          r.acknowledgementReceived === 'Yes' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : r.acknowledgementReceived === 'Pending' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {r.acknowledgementReceived}
                        </span>
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          r.responseReceivedFromLA === 'Yes' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : r.responseReceivedFromLA === 'Awaiting Allocation' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {r.responseReceivedFromLA}
                        </span>
                      </td>
                      <td className="p-2.5 text-neutral-700 whitespace-nowrap">
                        {r.laOfficerLeading || 'Awaiting LA'}
                      </td>
                      <td className="p-2.5 text-neutral-600 text-[11px] max-w-[280px] truncate" title={r.notesActionTaken}>
                        {r.notesActionTaken}
                      </td>
                      <td className="p-2.5 text-neutral-600 text-[11px] max-w-[280px] truncate" title={r.sgReview}>
                        {r.sgReview || '—'}
                      </td>
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

      {/* CREATE RECORD MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#f8f9fa]">
              <h3 className="text-base font-semibold text-[#242424]">
                New SG Referral Submission
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNew} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Hotel / Site *</label>
                  <select
                    value={formData.site}
                    onChange={e => setFormData({ ...formData, site: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    required
                  >
                    {allowedSites.map((s, idx) => (
                      <option key={`${s}-${idx}`} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Referral Council *</label>
                  <input
                    type="text"
                    list="referral-councils-list"
                    value={formData.referralCouncil}
                    onChange={e => setFormData({ ...formData, referralCouncil: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    placeholder="e.g. Westminster City Council"
                    required
                  />
                  <datalist id="referral-councils-list">
                    {councilOptions.map(c => (
                      <option key={c.id} value={c.value} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Service User (SU) Full Name *</label>
                  <input
                    type="text"
                    value={formData.suName}
                    onChange={e => setFormData({ ...formData, suName: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    placeholder="e.g. John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={e => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Port / NASS Reference</label>
                  <input
                    type="text"
                    value={formData.portRef}
                    onChange={e => setFormData({ ...formData, portRef: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    placeholder="e.g. PORT-12345"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Mosaic ID</label>
                  <input
                    type="text"
                    value={formData.mosaicId}
                    onChange={e => setFormData({ ...formData, mosaicId: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    placeholder="e.g. MOS-99881"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Referral Type</label>
                  <select
                    value={formData.referralType}
                    onChange={e => setFormData({ ...formData, referralType: e.target.value as SGReferral['referralType'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {referralTypeOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!referralTypeOptions.some(o => o.value === formData.referralType) && formData.referralType && (
                      <option value={formData.referralType}>{formData.referralType}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Urgency Priority</label>
                  <select
                    value={formData.urgency}
                    onChange={e => setFormData({ ...formData, urgency: e.target.value as RiskLevel })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {urgencyOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!urgencyOptions.some(o => o.value === formData.urgency) && formData.urgency && (
                      <option value={formData.urgency}>{formData.urgency}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] mb-1 flex items-center justify-between">
                    <span>Raised By (Officer Leading)</span>
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-600" /> Logged-in User (Locked)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.raisedBy || formData.officerLeadingHotel || loggedInUserName}
                    readOnly
                    className="w-full p-2 border border-neutral-300 rounded-xs bg-neutral-100 text-neutral-700 font-medium cursor-not-allowed select-none"
                    placeholder="Officer name"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Method of Referral</label>
                  <select
                    value={formData.methodOfReferral}
                    onChange={e => setFormData({ ...formData, methodOfReferral: e.target.value as SGReferral['methodOfReferral'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {referralMethodOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!referralMethodOptions.some(o => o.value === formData.methodOfReferral) && formData.methodOfReferral && (
                      <option value={formData.methodOfReferral}>{formData.methodOfReferral}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">LA Officer Leading</label>
                  <input
                    type="text"
                    value={formData.laOfficerLeading}
                    onChange={e => setFormData({ ...formData, laOfficerLeading: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    placeholder="e.g. Social Worker Name"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as StatusType })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {referralStatusOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!referralStatusOptions.some(o => o.value === formData.status) && formData.status && (
                      <option value={formData.status}>{formData.status}</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">Notes - Action(s) Taken *</label>
                <textarea
                  rows={3}
                  value={formData.notesActionTaken}
                  onChange={e => setFormData({ ...formData, notesActionTaken: e.target.value })}
                  placeholder="Detail safeguarding concerns, incident background, initial accommodation adjustments..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">SG Team Review / Follow-up Notes</label>
                <textarea
                  rows={2}
                  value={formData.sgReview}
                  onChange={e => setFormData({ ...formData, sgReview: e.target.value })}
                  placeholder="Review actions, multi-agency feedback, next steps..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                />
              </div>

              {/* Attach Proof Files / Docs */}
              <div className="pt-2">
                <AttachmentsSection
                  attachments={formData.attachments || []}
                  onChange={newFiles => setFormData({ ...formData, attachments: newFiles })}
                  canManage={canManageFiles()}
                  readOnly={!canManageFiles()}
                  title="Supporting Proof Documents & Images"
                />
              </div>

              <div className="pt-4 border-t border-[#edebe9] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs"
                >
                  Submit & Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT RECORD MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#f8f9fa]">
              <h3 className="text-base font-semibold text-[#242424]">
                Edit Referral: {editingRecord.suName} ({editingRecord.portRef})
              </h3>
              <button 
                onClick={() => setEditingRecord(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Status</label>
                  <select
                    value={editingRecord.status}
                    onChange={e => setEditingRecord({ ...editingRecord, status: e.target.value as StatusType })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Open">Open</option>
                    <option value="In progress">In progress</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Urgency Priority</label>
                  <select
                    value={editingRecord.urgency}
                    onChange={e => setEditingRecord({ ...editingRecord, urgency: e.target.value as RiskLevel })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {urgencyOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!urgencyOptions.some(o => o.value === editingRecord.urgency) && editingRecord.urgency && (
                      <option value={editingRecord.urgency}>{editingRecord.urgency}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Referral Type</label>
                  <select
                    value={editingRecord.referralType}
                    onChange={e => setEditingRecord({ ...editingRecord, referralType: e.target.value as SGReferral['referralType'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {referralTypeOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!referralTypeOptions.some(o => o.value === editingRecord.referralType) && editingRecord.referralType && (
                      <option value={editingRecord.referralType}>{editingRecord.referralType}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Method of Referral</label>
                  <select
                    value={editingRecord.methodOfReferral}
                    onChange={e => setEditingRecord({ ...editingRecord, methodOfReferral: e.target.value as SGReferral['methodOfReferral'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {referralMethodOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!referralMethodOptions.some(o => o.value === editingRecord.methodOfReferral) && editingRecord.methodOfReferral && (
                      <option value={editingRecord.methodOfReferral}>{editingRecord.methodOfReferral}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Acknowledgement Received</label>
                  <select
                    value={editingRecord.acknowledgementReceived}
                    onChange={e => setEditingRecord({ ...editingRecord, acknowledgementReceived: e.target.value as SGReferral['acknowledgementReceived'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Response Received from LA</label>
                  <select
                    value={editingRecord.responseReceivedFromLA}
                    onChange={e => setEditingRecord({ ...editingRecord, responseReceivedFromLA: e.target.value as SGReferral['responseReceivedFromLA'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="Awaiting Allocation">Awaiting Allocation</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">LA Lead Officer</label>
                  <input
                    type="text"
                    value={editingRecord.laOfficerLeading}
                    onChange={e => setEditingRecord({ ...editingRecord, laOfficerLeading: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] mb-1 flex items-center justify-between">
                    <span>Raised By (Officer Leading)</span>
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-600" /> Locked
                    </span>
                  </label>
                  <input
                    type="text"
                    value={editingRecord.raisedBy || editingRecord.officerLeadingHotel || loggedInUserName}
                    readOnly
                    className="w-full p-2 border border-neutral-300 rounded-xs bg-neutral-100 text-neutral-700 font-medium cursor-not-allowed select-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">Notes - Action(s) Taken</label>
                <textarea
                  rows={3}
                  value={editingRecord.notesActionTaken}
                  onChange={e => setEditingRecord({ ...editingRecord, notesActionTaken: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">SG Review Comments</label>
                <textarea
                  rows={3}
                  value={editingRecord.sgReview}
                  onChange={e => setEditingRecord({ ...editingRecord, sgReview: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                />
              </div>

              {/* Attach Proof Files / Docs */}
              <div className="pt-2">
                <AttachmentsSection
                  attachments={editingRecord.attachments || []}
                  onChange={newFiles => setEditingRecord({ ...editingRecord, attachments: newFiles })}
                  canManage={canManageFiles()}
                  readOnly={!canManageFiles()}
                  title="Supporting Proof Documents & Images"
                />
              </div>

              <div className="pt-4 border-t border-[#edebe9] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW RECORD MODAL (Read-Only Detail Card) */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#f3f8fd]">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[#0f766e]">
                  SG Referral Dossier: {viewRecord.suName}
                </h3>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                  viewRecord.status === 'Open' ? 'bg-[#f0fdfa] text-[#0f766e]' :
                  viewRecord.status === 'Completed' ? 'bg-[#e8f5e9] text-[#107c10]' :
                  'bg-[#fff4ce] text-[#7f6000]'
                }`}>
                  {viewRecord.status}
                </span>
              </div>
              <button 
                onClick={() => setViewRecord(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-[#242424]">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#faf9f8] p-3 rounded-xs border border-[#edebe9]">
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">Sr. No.</div>
                  <div className="font-semibold text-neutral-800">#{viewRecord.srNo}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">Hotel / Property</div>
                  <div className="font-semibold text-neutral-800">{viewRecord.site}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">Referral Council</div>
                  <div className="font-semibold text-neutral-800">{viewRecord.referralCouncil}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">SU Name</div>
                  <div className="font-bold text-neutral-900">{viewRecord.suName}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">Port / NASS Ref</div>
                  <div className="font-mono text-neutral-800">{viewRecord.portRef || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">Mosaic ID</div>
                  <div className="font-mono text-neutral-800">{viewRecord.mosaicId || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">Date of Birth</div>
                  <div>{viewRecord.dob || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">Date Referred</div>
                  <div>{viewRecord.dateReferred}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">Referral Type</div>
                  <div>{viewRecord.referralType}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">Method of Referral</div>
                  <div>{viewRecord.methodOfReferral}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">Urgency</div>
                  <span className="font-bold text-amber-800">{viewRecord.urgency}</span>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">Acknowledgement Received</div>
                  <span className={`font-semibold ${viewRecord.acknowledgementReceived === 'Yes' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {viewRecord.acknowledgementReceived}
                  </span>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">Response Received from LA</div>
                  <span className="font-semibold text-neutral-800">{viewRecord.responseReceivedFromLA}</span>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">Raised By (Officer Leading)</div>
                  <div className="text-neutral-800 font-medium">{viewRecord.raisedBy || viewRecord.officerLeadingHotel || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-semibold">LA Officer Leading</div>
                  <div className="text-neutral-800">{viewRecord.laOfficerLeading || '—'}</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-neutral-700 mb-1">Notes - Action(s) Taken</h4>
                <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed">
                  {viewRecord.notesActionTaken}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-neutral-700 mb-1">SG Review</h4>
                <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed">
                  {viewRecord.sgReview || 'No review notes registered yet.'}
                </div>
              </div>

              {/* Proof Documents & Images Section */}
              <div className="pt-1">
                <AttachmentsSection
                  attachments={viewRecord.attachments || []}
                  canManage={false}
                  readOnly={true}
                  title="Supporting Proof Documents & Images"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px] text-neutral-500 border-t border-[#edebe9] pt-3">
                <div>
                  Last Updated: <strong className="text-neutral-700">{viewRecord.updatedAt.slice(0, 10)}</strong>
                </div>
                <div>
                  By: <strong className="text-neutral-700">{viewRecord.lastUpdatedBy}</strong>
                </div>
              </div>

              <div className="pt-4 border-t border-[#edebe9] flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewRecord(null)}
                  className="px-4 py-1.5 bg-white border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};
