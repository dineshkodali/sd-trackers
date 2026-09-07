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
  AlertTriangle,
  ShieldAlert,
  FileText,
  Lock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ChallengingSU, RiskLevel, StatusType, RecordAttachment } from '../../types';
import { FilterBar } from '../common/FilterBar';
import { Pagination } from '../common/Pagination';
import { AttachmentsSection } from '../common/AttachmentsSection';
import { ExportModal, ExportFormat, ExportScope, ExportColumnOption, ExportOrientation } from '../common/ExportModal';
import { ExportDropdown } from '../common/ExportDropdown';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';

const challengingExportColumns: ExportColumnOption[] = [
  { id: 'date', label: 'Log Date' },
  { id: 'site', label: 'Hotel / Site' },
  { id: 'name', label: 'Resident Name' },
  { id: 'portRef', label: 'PORT Reference' },
  { id: 'dob', label: 'Date of Birth' },
  { id: 'group', label: 'Group' },
  { id: 'gender', label: 'Gender' },
  { id: 'raisedBy', label: 'Raised By' },
  { id: 'typeOfIssue', label: 'Type of Issue' },
  { id: 'incidentDescription', label: 'Incident Description' },
  { id: 'dateOfIncident', label: 'Date of Incident' },
  { id: 'actionTaken', label: 'Action Taken' },
  { id: 'adviceGivenBySGTeam', label: 'Advice Given by SG Team' },
  { id: 'followUpRequired', label: 'Follow-Up Required' },
  { id: 'riskFactor', label: 'Risk Factor' },
  { id: 'followUpNotes', label: 'Follow-Up Notes' },
  { id: 'comments', label: 'Comments' },
  { id: 'reviewBySGTeam', label: 'Review by SG Team' },
  { id: 'status', label: 'Status' }
];

interface ChallengingViewProps {
  isArchive?: boolean;
}

export const ChallengingView: React.FC<ChallengingViewProps> = ({ isArchive = false }) => {
  const {
    challengingSUs,
    allowedSites,
    addChallengingSU,
    updateChallengingSU,
    archiveChallengingSU,
    restoreChallengingSU,
    deleteChallengingSU,
    canDeleteRecord,
    canCreateRecord,
    canEditRecord,
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

  const incidentTypeOptions = useMemo(() => getFieldOptions('incidentTypes'), [getFieldOptions]);
  const challengingStatusOptions = useMemo(() => getFieldOptions('challengingStatuses'), [getFieldOptions]);

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

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(settings.pageSize || 10);

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalFormat, setExportModalFormat] = useState<ExportFormat>('pdf');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [viewRecord, setViewRecord] = useState<ChallengingSU | null>(null);
  const [editingRecord, setEditingRecord] = useState<ChallengingSU | null>(null);

  const initialFormData = {
    date: new Date().toISOString().slice(0, 10),
    site: allowedSites[0] || 'Hotel A',
    name: '',
    portRef: '',
    dob: '',
    group: 'Single Adult',
    gender: 'Male' as ChallengingSU['gender'],
    typeOfIssue: 'Curfew Non-compliance' as ChallengingSU['typeOfIssue'],
    incidentDescription: '',
    dateOfIncident: new Date().toISOString().slice(0, 10),
    actionTaken: '',
    adviceGivenBySGTeam: '',
    followUpRequired: 'Yes' as 'Yes' | 'No',
    riskFactor: 'Medium' as RiskLevel,
    followUpNotes: '',
    comments: '',
    reviewBySGTeam: '',
    status: 'In progress' as StatusType,
    raisedBy: loggedInUserName
  };

  const [formData, setFormData] = useState(initialFormData);

  const allDataset = useMemo(() => {
    return challengingSUs.filter(c => isArchive ? c.status === 'Archived' : c.status !== 'Archived');
  }, [challengingSUs, isArchive]);

  const filteredData = useMemo(() => {
    return challengingSUs.filter(c => {
      if (isArchive) {
        if (c.status !== 'Archived') return false;
      } else {
        if (c.status === 'Archived') return false;
      }

      if (siteFilter !== 'all' && c.site !== siteFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (monthFilter !== 'all' && (!c.date || !c.date.startsWith(monthFilter))) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fullString = `${c.name || ''} ${c.portRef || ''} ${c.typeOfIssue || ''} ${c.incidentDescription || ''} ${c.actionTaken || ''}`.toLowerCase();
        if (!fullString.includes(q)) return false;
      }

      return true;
    });
  }, [challengingSUs, isArchive, siteFilter, statusFilter, monthFilter, searchQuery]);

  // Sort State
  const [sortField, setSortField] = useState<keyof ChallengingSU>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: keyof ChallengingSU) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Sort filtered dataset
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

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

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
    return allDataset.filter(c => {
      const d = c.date || c.dateOfIncident || '';
      return d >= start && d <= end;
    }).length;
  };

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    if (scope === 'filtered') return sortedData;
    if (scope === 'custom' && startDate && endDate) {
      return allDataset.filter(c => {
        const d = c.date || c.dateOfIncident || '';
        return d >= startDate && d <= endDate;
      });
    }
    return allDataset;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (c: ChallengingSU) => string | number }> => ({
    date: { label: 'Date', getValue: c => c.date || c.dateOfIncident || '—' },
    site: { label: 'Site name', getValue: c => c.site },
    name: { label: 'Resident Name', getValue: c => c.name },
    portRef: { label: 'PORT Reference', getValue: c => c.portRef || '—' },
    dob: { label: 'DOB', getValue: c => c.dob || '—' },
    group: { label: 'Group', getValue: c => c.group || '—' },
    gender: { label: 'Gender', getValue: c => c.gender || '—' },
    raisedBy: { label: 'Raised By', getValue: c => c.raisedBy || c.loggedBy || '—' },
    typeOfIssue: { label: 'Type of Issue', getValue: c => c.typeOfIssue },
    incidentDescription: { label: 'Incident Description', getValue: c => c.incidentDescription },
    dateOfIncident: { label: 'Date of Incident', getValue: c => c.dateOfIncident || '—' },
    actionTaken: { label: 'Action Taken', getValue: c => c.actionTaken },
    adviceGivenBySGTeam: { label: 'Advice Given', getValue: c => c.adviceGivenBySGTeam || '—' },
    followUpRequired: { label: 'Follow-Up', getValue: c => c.followUpRequired },
    riskFactor: { label: 'Risk Factor', getValue: c => c.riskFactor },
    followUpNotes: { label: 'Follow-Up Notes', getValue: c => c.followUpNotes || '—' },
    comments: { label: 'Comments', getValue: c => c.comments || '—' },
    reviewBySGTeam: { label: 'Review Notes', getValue: c => c.reviewBySGTeam || '—' },
    status: { label: 'Status', getValue: c => c.status }
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
      : challengingExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(c => activeCols.map(col => colMap[col].getValue(c)));
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
    const title = isArchive ? 'Archived Challenging Incidents' : 'Challenging Service Users Incident Register';

    const cols = selectedColumns && selectedColumns.length > 0 
      ? selectedColumns 
      : challengingExportColumns.map(c => c.id);

    const colMap = getExportColumnMap();
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(c => activeCols.map(col => colMap[col].getValue(c)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `challenging-sus-${isArchive ? 'archived-' : ''}${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title,
        subtitle: 'Behavioral incidents, de-escalation actions, risk ratings, and follow-up interventions.',
        filename: `Challenging-SUs-${isArchive ? 'Archived-' : ''}${scope}-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        isCompact,
        metadata: [
          { label: 'Export Scope', value: scope === 'all' ? 'All Records' : scope === 'custom' ? `${startDate} to ${endDate}` : 'Filtered View' },
          { label: 'Site Scope', value: siteFilter === 'all' ? 'All Permitted Sites' : siteFilter },
          { label: 'Density', value: isCompact ? 'Compact View' : 'Standard View' },
          { label: 'Total Records', value: dataToExport.length }
        ]
      });
    }
  };

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Resident name is required');
      return;
    }
    addChallengingSU({
      ...formData,
      raisedBy: formData.raisedBy || loggedInUserName,
      loggedBy: formData.raisedBy || loggedInUserName
    });
    setIsCreateModalOpen(false);
    setFormData({
      ...initialFormData,
      raisedBy: loggedInUserName
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    updateChallengingSU(editingRecord.id, {
      ...editingRecord,
      raisedBy: editingRecord.raisedBy || editingRecord.loggedBy || loggedInUserName,
      loggedBy: editingRecord.raisedBy || editingRecord.loggedBy || loggedInUserName
    });
    setEditingRecord(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <h2 className="text-2xl font-semibold text-[#242424] tracking-tight">
            {isArchive ? 'Archived Challenging SUs' : 'Challenging SUs'}
          </h2>
          <p className="text-xs text-[#605e5c] mt-0.5">
            {isArchive
              ? 'Archived incident records and closed behavioral management cases.'
              : 'Track behavioral incidents, room damage, curfew compliance, and safeguarding de-escalation actions.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-[#edebe9] p-0.5 rounded-xs flex items-center text-xs">
            <button
              onClick={() => setActivePage('challenging')}
              className={`px-3 py-1.5 rounded-xs font-semibold transition-colors ${
                !isArchive ? 'bg-white text-[#0f766e] shadow-xs' : 'text-[#605e5c] hover:text-[#242424]'
              }`}
            >
              Active Incidents
            </button>
            <button
              onClick={() => setActivePage('challengingArchive')}
              className={`px-3 py-1.5 rounded-xs font-semibold transition-colors ${
                isArchive ? 'bg-white text-[#0f766e] shadow-xs' : 'text-[#605e5c] hover:text-[#242424]'
              }`}
            >
              Archive
            </button>
          </div>

          {!isArchive && canCreateRecord() && (
            <button
              onClick={() => {
                setFormData({ ...initialFormData, site: allowedSites[0] || 'Hotel A' });
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Log Incident</span>
            </button>
          )}

          <ExportDropdown
            moduleName={isArchive ? "Archived Challenging SUs" : "Challenging SUs"}
            totalRecordCount={allDataset.length}
            filteredRecordCount={sortedData.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={challengingExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
          />
        </div>
      </div>

      {/* Filters */}
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
        searchStorageKey="challenging_search"
      />

      {/* Table */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1800px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th onClick={() => handleSort('date')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Date">
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    {sortField === 'date' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('site')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Site Name">
                  <div className="flex items-center gap-1">
                    <span>Site name</span>
                    {sortField === 'site' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('name')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Resident Name">
                  <div className="flex items-center gap-1">
                    <span>Name</span>
                    {sortField === 'name' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('portRef')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by PORT Reference">
                  <div className="flex items-center gap-1">
                    <span>PORT Reference</span>
                    {sortField === 'portRef' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('dob')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by DOB">
                  <div className="flex items-center gap-1">
                    <span>DOB</span>
                    {sortField === 'dob' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('group')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Group">
                  <div className="flex items-center gap-1">
                    <span>Group</span>
                    {sortField === 'group' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('gender')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Gender">
                  <div className="flex items-center gap-1">
                    <span>Gender</span>
                    {sortField === 'gender' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('raisedBy')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Raised By">
                  <div className="flex items-center gap-1">
                    <span>Raised By</span>
                    {sortField === 'raisedBy' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('status')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Status">
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    {sortField === 'status' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('typeOfIssue')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Type of Issue">
                  <div className="flex items-center gap-1">
                    <span>Type of Issue</span>
                    {sortField === 'typeOfIssue' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th className="p-2.5 min-w-[200px] max-w-[280px]">Incident Description</th>
                <th onClick={() => handleSort('dateOfIncident')} className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Date of Incident">
                  <div className="flex items-center gap-1">
                    <span>Date of Incident</span>
                    {sortField === 'dateOfIncident' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th className="p-2.5 min-w-[180px] max-w-[260px]">Action Taken</th>
                <th className="p-2.5 min-w-[180px] max-w-[260px]">Advice Given by SG Team (Mention Name)</th>
                <th onClick={() => handleSort('followUpRequired')} className="p-2.5 text-center cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Follow-Up Required">
                  <div className="flex items-center justify-center gap-1">
                    <span>Follow-Up Required (Yes/No)</span>
                    {sortField === 'followUpRequired' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('riskFactor')} className="p-2.5 text-center cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Risk Factor">
                  <div className="flex items-center justify-center gap-1">
                    <span>Risk Factor</span>
                    {sortField === 'riskFactor' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th className="p-2.5 min-w-[180px] max-w-[260px]">Follow-Up Notes</th>
                <th className="p-2.5 min-w-[160px] max-w-[240px]">Comments</th>
                <th className="p-2.5 min-w-[180px] max-w-[260px]">Review by SG Team/Site team</th>
                <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={20} className="text-center py-12 text-[#605e5c]">
                    No challenging SU records found.
                  </td>
                </tr>
              ) : (
                paginatedData.map(c => {
                  const canEdit = canEditRecord(c.site);
                  const canDelete = canDeleteRecord();

                  return (
                    <tr key={c.id} className="hover:bg-[#fafafa] transition-colors">
                      <td className="p-2.5 text-neutral-600 whitespace-nowrap font-mono text-[11px]">{c.date}</td>
                      <td className="p-2.5 font-medium text-[#242424] whitespace-nowrap">{c.site}</td>
                      <td className="p-2.5 font-semibold text-[#0f766e] whitespace-nowrap">
                        <button onClick={() => setViewRecord(c)} className="hover:underline text-left">
                          {c.name}
                        </button>
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-neutral-600 whitespace-nowrap">{c.portRef || '—'}</td>
                      <td className="p-2.5 text-neutral-600 whitespace-nowrap font-mono text-[11px]">{c.dob || '—'}</td>
                      <td className="p-2.5 text-neutral-700 whitespace-nowrap">{c.group}</td>
                      <td className="p-2.5 text-neutral-600 whitespace-nowrap">{c.gender}</td>
                      <td className="p-2.5 text-neutral-700 whitespace-nowrap">{c.raisedBy || c.loggedBy || '—'}</td>
                      <td className="p-2.5 whitespace-nowrap">
                        {canEdit && !isArchive ? (
                          <select
                            value={c.status || 'Active'}
                            onChange={e => updateChallengingSU(c.id, { status: e.target.value as any })}
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0078d4] ${
                              c.status === 'Active' ? 'bg-[#fff4ce] text-[#7f6000] border-[#ffe788]' :
                              c.status === 'Under Review' ? 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]' :
                              c.status === 'Under Investigation' ? 'bg-[#f0eafd] text-[#5c2d91] border-[#dcd0f9]' :
                              c.status === 'Resolved' ? 'bg-[#e8f5e9] text-[#107c10] border-[#c8e6c9]' :
                              c.status === 'Archived' ? 'bg-neutral-100 text-neutral-600 border-neutral-300' :
                              'bg-neutral-100 text-neutral-700 border-neutral-300'
                            }`}
                            title="Click to update status"
                          >
                            {challengingStatusOptions.map(opt => (
                              <option key={opt.id} value={opt.value} className="bg-white text-neutral-900 font-normal">
                                {opt.label}
                              </option>
                            ))}
                            {!challengingStatusOptions.some(o => o.value === (c.status || 'Active')) && (
                              <option value={c.status || 'Active'} className="bg-white text-neutral-900 font-normal">
                                {c.status || 'Active'}
                              </option>
                            )}
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded ${
                            c.status === 'Active' ? 'bg-[#fff4ce] text-[#7f6000]' :
                            c.status === 'Under Review' ? 'bg-[#f0fdfa] text-[#0f766e]' :
                            c.status === 'Under Investigation' ? 'bg-[#f0eafd] text-[#5c2d91]' :
                            c.status === 'Resolved' ? 'bg-[#e8f5e9] text-[#107c10]' :
                            c.status === 'Archived' ? 'bg-neutral-100 text-neutral-600' :
                            'bg-neutral-100 text-neutral-700'
                          }`}>
                            {c.status || 'Active'}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-neutral-700 font-medium whitespace-nowrap">{c.typeOfIssue}</td>
                      <td className="p-2.5 text-[#323130] text-[11px] max-w-[280px] truncate" title={c.incidentDescription}>
                        {c.incidentDescription}
                      </td>
                      <td className="p-2.5 text-neutral-600 whitespace-nowrap font-mono text-[11px]">{c.dateOfIncident || c.date}</td>
                      <td className="p-2.5 text-[#605e5c] text-[11px] max-w-[260px] truncate" title={c.actionTaken}>
                        {c.actionTaken}
                      </td>
                      <td className="p-2.5 text-[#605e5c] text-[11px] max-w-[260px] truncate" title={c.adviceGivenBySGTeam}>
                        {c.adviceGivenBySGTeam || '—'}
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          c.followUpRequired === 'Yes' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {c.followUpRequired}
                        </span>
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          c.riskFactor === 'Critical' || c.riskFactor === 'High'
                            ? 'bg-red-100 text-red-800'
                            : c.riskFactor === 'Medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}>
                          {c.riskFactor}
                        </span>
                      </td>
                      <td className="p-2.5 text-[#605e5c] text-[11px] max-w-[260px] truncate" title={c.followUpNotes}>
                        {c.followUpNotes || '—'}
                      </td>
                      <td className="p-2.5 text-[#605e5c] text-[11px] max-w-[240px] truncate" title={c.comments}>
                        {c.comments || '—'}
                      </td>
                      <td className="p-2.5 text-[#605e5c] text-[11px] max-w-[260px] truncate" title={c.reviewBySGTeam}>
                        {c.reviewBySGTeam || '—'}
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewRecord(c)}
                            className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#edebe9] rounded"
                            title="View Incident File"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => setEditingRecord(c)}
                              className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#edebe9] rounded"
                              title="Edit Incident"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {c.status === 'Archived' ? (
                            <button
                              onClick={() => restoreChallengingSU(c.id)}
                              className="p-1 text-[#0d9488] hover:bg-[#edebe9] rounded font-semibold text-[11px] flex items-center gap-0.5"
                              title="Restore"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Restore</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => archiveChallengingSU(c.id)}
                              className="p-1 text-neutral-500 hover:text-purple-700 hover:bg-[#edebe9] rounded"
                              title="Archive"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => deleteChallengingSU(c.id)}
                              className="p-1 text-neutral-400 hover:text-[#a4262c] hover:bg-red-50 rounded"
                              title="Delete"
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

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#f8f9fa]">
              <h3 className="text-base font-semibold text-[#242424]">
                Log Challenging SU Behavior / Incident
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-neutral-400 hover:text-neutral-700 p-1">
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
                  <label className="font-semibold text-[#605e5c] mb-1 flex items-center justify-between">
                    <span>Raised By</span>
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-600" /> Logged-in User (Locked)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.raisedBy || loggedInUserName}
                    readOnly
                    className="w-full p-2 border border-neutral-300 rounded-xs bg-neutral-100 text-neutral-700 font-medium cursor-not-allowed select-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Resident Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">PORT Reference</label>
                  <input
                    type="text"
                    value={formData.portRef}
                    onChange={e => setFormData({ ...formData, portRef: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    placeholder="e.g. PORT-88910"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Date of Incident</label>
                  <input
                    type="date"
                    value={formData.dateOfIncident}
                    onChange={e => setFormData({ ...formData, dateOfIncident: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Type of Issue</label>
                  <select
                    value={formData.typeOfIssue}
                    onChange={e => setFormData({ ...formData, typeOfIssue: e.target.value as ChallengingSU['typeOfIssue'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {incidentTypeOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!incidentTypeOptions.some(o => o.value === formData.typeOfIssue) && formData.typeOfIssue && (
                      <option value={formData.typeOfIssue}>{formData.typeOfIssue}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Risk Factor</label>
                  <select
                    value={formData.riskFactor}
                    onChange={e => setFormData({ ...formData, riskFactor: e.target.value as RiskLevel })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Follow-Up Required?</label>
                  <select
                    value={formData.followUpRequired}
                    onChange={e => setFormData({ ...formData, followUpRequired: e.target.value as 'Yes' | 'No' })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as StatusType })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="In progress">In progress</option>
                    <option value="Open">Open</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#605e5c]">Incident Description *</label>
                  <span className="text-[11px] text-[#605e5c]">Click preset to insert:</span>
                </div>
                {incidentTypeOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {incidentTypeOptions.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const current = formData.incidentDescription ? formData.incidentDescription.trim() : '';
                          if (!current) {
                            setFormData({ ...formData, incidentDescription: `[${opt.label}]: ` });
                          } else if (!current.includes(opt.label)) {
                            setFormData({ ...formData, incidentDescription: `${current}\n[${opt.label}]: ` });
                          }
                        }}
                        className="text-[11px] px-2 py-0.5 rounded-full border border-[#8a8886]/30 bg-[#f3f2f1] hover:bg-[#edebe9] text-[#323130] transition-colors"
                      >
                        + {opt.label}
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  rows={2}
                  value={formData.incidentDescription}
                  onChange={e => setFormData({ ...formData, incidentDescription: e.target.value })}
                  placeholder="Objective, factual description of what occurred..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">Action Taken *</label>
                <textarea
                  rows={2}
                  value={formData.actionTaken}
                  onChange={e => setFormData({ ...formData, actionTaken: e.target.value })}
                  placeholder="Immediate de-escalation actions, warning issued, room swap..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">Advice Given by SG Team (Mention Name)</label>
                <textarea
                  rows={2}
                  value={formData.adviceGivenBySGTeam}
                  onChange={e => setFormData({ ...formData, adviceGivenBySGTeam: e.target.value })}
                  placeholder="e.g. Advised by Sarah Jenkins (Regional Lead) to arrange daily 10am check-in..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">Follow-Up Notes</label>
                <textarea
                  rows={2}
                  value={formData.followUpNotes}
                  onChange={e => setFormData({ ...formData, followUpNotes: e.target.value })}
                  placeholder="Follow-up progress notes, welfare check updates..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Comments</label>
                  <textarea
                    rows={2}
                    value={formData.comments}
                    onChange={e => setFormData({ ...formData, comments: e.target.value })}
                    placeholder="Staff operational comments..."
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Review by SG Team/Site team</label>
                  <textarea
                    rows={2}
                    value={formData.reviewBySGTeam}
                    onChange={e => setFormData({ ...formData, reviewBySGTeam: e.target.value })}
                    placeholder="Safeguarding team assessment and next review date..."
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>
              </div>

              {/* Supporting Proof Documents & Images */}
              <div className="pt-2">
                <AttachmentsSection
                  attachments={formData.attachments || []}
                  onChange={newFiles => setFormData({ ...formData, attachments: newFiles })}
                  canManage={canManageFiles()}
                  readOnly={!canManageFiles()}
                  title="Supporting Proof Documents & Images"
                />
              </div>

              <div className="pt-4 border-t border-[#edebe9] flex justify-end gap-2">
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
                  Confirm & Save Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#f8f9fa]">
              <h3 className="text-base font-semibold text-[#242424]">
                Edit Incident Record: {editingRecord.name}
              </h3>
              <button onClick={() => setEditingRecord(null)} className="text-neutral-400 hover:text-neutral-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-[#605e5c] mb-1 flex items-center justify-between">
                    <span>Raised By</span>
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-600" /> Locked
                    </span>
                  </label>
                  <input
                    type="text"
                    value={editingRecord.raisedBy || editingRecord.loggedBy || loggedInUserName}
                    readOnly
                    className="w-full p-2 border border-neutral-300 rounded-xs bg-neutral-100 text-neutral-700 font-medium cursor-not-allowed select-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Hotel / Site</label>
                  <select
                    value={editingRecord.site}
                    onChange={e => setEditingRecord({ ...editingRecord, site: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {allowedSites.map((s, idx) => (
                      <option key={`${s}-${idx}`} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Resident Name</label>
                  <input
                    type="text"
                    value={editingRecord.name}
                    onChange={e => setEditingRecord({ ...editingRecord, name: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">PORT Reference</label>
                  <input
                    type="text"
                    value={editingRecord.portRef || ''}
                    onChange={e => setEditingRecord({ ...editingRecord, portRef: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Date of Incident</label>
                  <input
                    type="date"
                    value={editingRecord.dateOfIncident || editingRecord.date}
                    onChange={e => setEditingRecord({ ...editingRecord, dateOfIncident: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Type of Issue</label>
                  <select
                    value={editingRecord.typeOfIssue}
                    onChange={e => setEditingRecord({ ...editingRecord, typeOfIssue: e.target.value as any })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {incidentTypeOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!incidentTypeOptions.some(o => o.value === editingRecord.typeOfIssue) && editingRecord.typeOfIssue && (
                      <option value={editingRecord.typeOfIssue}>{editingRecord.typeOfIssue}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Risk Factor</label>
                  <select
                    value={editingRecord.riskFactor}
                    onChange={e => setEditingRecord({ ...editingRecord, riskFactor: e.target.value as RiskLevel })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Follow-Up Required</label>
                  <select
                    value={editingRecord.followUpRequired}
                    onChange={e => setEditingRecord({ ...editingRecord, followUpRequired: e.target.value as 'Yes' | 'No' })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Status</label>
                  <select
                    value={editingRecord.status || 'Active'}
                    onChange={e => setEditingRecord({ ...editingRecord, status: e.target.value as any })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {challengingStatusOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!challengingStatusOptions.some(o => o.value === (editingRecord.status || 'Active')) && (
                      <option value={editingRecord.status || 'Active'}>{editingRecord.status || 'Active'}</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">Action Taken</label>
                <textarea
                  rows={2}
                  value={editingRecord.actionTaken}
                  onChange={e => setEditingRecord({ ...editingRecord, actionTaken: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">Advice Given by SG Team</label>
                <textarea
                  rows={2}
                  value={editingRecord.adviceGivenBySGTeam}
                  onChange={e => setEditingRecord({ ...editingRecord, adviceGivenBySGTeam: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">Follow-Up Notes</label>
                <textarea
                  rows={2}
                  value={editingRecord.followUpNotes}
                  onChange={e => setEditingRecord({ ...editingRecord, followUpNotes: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Comments</label>
                  <textarea
                    rows={2}
                    value={editingRecord.comments}
                    onChange={e => setEditingRecord({ ...editingRecord, comments: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Review by SG Team/Site team</label>
                  <textarea
                    rows={2}
                    value={editingRecord.reviewBySGTeam}
                    onChange={e => setEditingRecord({ ...editingRecord, reviewBySGTeam: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>
              </div>

              {/* Supporting Proof Files / Documents */}
              <div className="pt-2">
                <AttachmentsSection
                  attachments={editingRecord.attachments || []}
                  onChange={newFiles => setEditingRecord({ ...editingRecord, attachments: newFiles })}
                  canManage={canManageFiles()}
                  readOnly={!canManageFiles()}
                  title="Supporting Proof Documents & Images"
                />
              </div>

              <div className="pt-4 border-t border-[#edebe9] flex justify-end gap-2">
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

      {/* VIEW MODAL */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#f3f8fd]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-purple-700" />
                <h3 className="text-base font-semibold text-[#0f766e]">
                  Incident Dossier: {viewRecord.name}
                </h3>
              </div>
              <button onClick={() => setViewRecord(null)} className="text-neutral-400 hover:text-neutral-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#faf9f8] p-3 rounded-xs border border-[#edebe9]">
                <div>
                  <span className="text-neutral-500 font-semibold block">Date:</span>
                  <span className="font-mono text-neutral-800">{viewRecord.date}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Site name:</span>
                  <strong className="text-neutral-800">{viewRecord.site}</strong>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Name:</span>
                  <strong className="text-neutral-900">{viewRecord.name}</strong>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">PORT Reference:</span>
                  <span className="font-mono text-neutral-800">{viewRecord.portRef || '—'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">DOB:</span>
                  <span className="font-mono text-neutral-800">{viewRecord.dob || '—'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Group:</span>
                  <span>{viewRecord.group}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Gender:</span>
                  <span>{viewRecord.gender}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Type of Issue:</span>
                  <strong className="text-purple-900">{viewRecord.typeOfIssue}</strong>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Date of Incident:</span>
                  <span>{viewRecord.dateOfIncident}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Follow-Up Required:</span>
                  <span className="font-semibold">{viewRecord.followUpRequired}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Risk Factor:</span>
                  <span className="font-bold text-amber-800">{viewRecord.riskFactor}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Status:</span>
                  <span className="font-semibold text-[#0f766e]">{viewRecord.status}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Raised By:</span>
                  <strong className="text-neutral-800">{viewRecord.raisedBy || viewRecord.loggedBy || '—'}</strong>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-neutral-700 mb-1">Incident Description</h4>
                <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed">
                  {viewRecord.incidentDescription}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-neutral-700 mb-1">Action Taken</h4>
                <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed">
                  {viewRecord.actionTaken}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-neutral-700 mb-1">Advice Given by SG Team (Mention Name)</h4>
                <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed">
                  {viewRecord.adviceGivenBySGTeam || 'No formal advice recorded.'}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-neutral-700 mb-1">Follow-Up Notes</h4>
                <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed">
                  {viewRecord.followUpNotes || '—'}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <h4 className="font-semibold text-neutral-700 mb-1">Comments</h4>
                  <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed">
                    {viewRecord.comments || '—'}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-neutral-700 mb-1">Review by SG Team/Site team</h4>
                  <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed">
                    {viewRecord.reviewBySGTeam || '—'}
                  </div>
                </div>
              </div>

              {/* Supporting Proof Documents & Images */}
              <div className="pt-1">
                <AttachmentsSection
                  attachments={viewRecord.attachments || []}
                  canManage={false}
                  readOnly={true}
                  title="Supporting Proof Documents & Images"
                />
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
        title={isArchive ? "Export Archived Challenging SUs" : "Export Challenging SUs Register"}
        moduleName={isArchive ? "Archived Challenging SUs" : "Challenging SUs"}
        defaultFormat={exportModalFormat}
        defaultOrientation="landscape"
        totalRecordCount={allDataset.length}
        filteredRecordCount={sortedData.length}
        dateRangeRecordCount={calculateDateRangeCount}
        availableColumns={challengingExportColumns}
        getPreviewData={getExportPreviewData}
        onExport={handlePerformExport}
      />
    </div>
  );
};
