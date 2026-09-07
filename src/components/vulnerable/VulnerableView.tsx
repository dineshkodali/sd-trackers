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
  UserCheck,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VulnerableSU, RiskLevel, StatusType, RecordAttachment } from '../../types';
import { FilterBar } from '../common/FilterBar';
import { Pagination } from '../common/Pagination';
import { AttachmentsSection } from '../common/AttachmentsSection';
import { ExportModal, ExportFormat, ExportScope, ExportColumnOption, ExportOrientation } from '../common/ExportModal';
import { ExportDropdown } from '../common/ExportDropdown';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';

const vulnerableExportColumns: ExportColumnOption[] = [
  { id: 'site', label: 'Hotel / Site' },
  { id: 'roomOrFlatNo', label: 'Room / Flat No' },
  { id: 'suName', label: 'Service User Name' },
  { id: 'portOrNassRef', label: 'Port / NASS Ref' },
  { id: 'dob', label: 'Date of Birth' },
  { id: 'group', label: 'Demographic Group' },
  { id: 'gender', label: 'Gender' },
  { id: 'riskLevel', label: 'Risk Level' },
  { id: 'vulnerability', label: 'Vulnerability Category' },
  { id: 'notesActionTaken', label: 'Safeguarding Actions' },
  { id: 'sgTeamUpdate', label: 'SG Team Update' },
  { id: 'reviewDate', label: 'Next Review Date' },
  { id: 'raisedBy', label: 'Raised By' },
  { id: 'allocatedWorker', label: 'Allocated Worker' },
  { id: 'status', label: 'Status' }
];

interface VulnerableViewProps {
  isArchive?: boolean;
}

export const VulnerableView: React.FC<VulnerableViewProps> = ({ isArchive = false }) => {
  const {
    vulnerableSUs,
    allowedSites,
    addVulnerableSU,
    updateVulnerableSU,
    archiveVulnerableSU,
    restoreVulnerableSU,
    deleteVulnerableSU,
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

  const vulnerabilityOptions = useMemo(() => getFieldOptions('vulnerabilities'), [getFieldOptions]);
  const vulnerableStatusOptions = useMemo(() => getFieldOptions('vulnerableStatuses'), [getFieldOptions]);

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
  const [sortField, setSortField] = useState<keyof VulnerableSU>('suName');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(settings.pageSize || 10);

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalFormat, setExportModalFormat] = useState<ExportFormat>('pdf');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [viewRecord, setViewRecord] = useState<VulnerableSU | null>(null);
  const [editingRecord, setEditingRecord] = useState<VulnerableSU | null>(null);

  const initialFormData = {
    site: allowedSites[0] || 'Hotel A',
    roomOrFlatNo: '',
    suName: '',
    dob: '',
    group: 'Single Adult' as VulnerableSU['group'],
    gender: 'Female' as VulnerableSU['gender'],
    portOrNassRef: '',
    vulnerability: '',
    notesActionTaken: '',
    sgTeamUpdate: '',
    riskLevel: 'Medium' as RiskLevel,
    status: 'Open' as StatusType,
    reviewDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    allocatedWorker: '',
    raisedBy: loggedInUserName
  };

  const [formData, setFormData] = useState(initialFormData);

  // All relevant dataset before filters
  const allDataset = useMemo(() => {
    return vulnerableSUs.filter(v => isArchive ? v.status === 'Archived' : v.status !== 'Archived');
  }, [vulnerableSUs, isArchive]);

  const filteredData = useMemo(() => {
    return vulnerableSUs.filter(v => {
      if (isArchive) {
        if (v.status !== 'Archived') return false;
      } else {
        if (v.status === 'Archived') return false;
      }

      if (siteFilter !== 'all' && v.site !== siteFilter) return false;
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (monthFilter !== 'all' && (!v.reviewDate || !v.reviewDate.startsWith(monthFilter))) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fullString = `${v.suName || ''} ${v.portOrNassRef || ''} ${v.roomOrFlatNo || ''} ${v.vulnerability || ''} ${v.notesActionTaken || ''}`.toLowerCase();
        if (!fullString.includes(q)) return false;
      }

      return true;
    });
  }, [vulnerableSUs, isArchive, siteFilter, statusFilter, monthFilter, searchQuery]);

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

  const handleSort = (field: keyof VulnerableSU) => {
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
    return allDataset.filter(v => v.reviewDate >= start && v.reviewDate <= end).length;
  };

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    if (scope === 'filtered') return sortedData;
    if (scope === 'custom' && startDate && endDate) {
      return allDataset.filter(v => v.reviewDate >= startDate && v.reviewDate <= endDate);
    }
    return allDataset;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (v: VulnerableSU) => string | number }> => ({
    site: { label: 'Hotel / Site', getValue: v => v.site },
    roomOrFlatNo: { label: 'Room / Flat', getValue: v => v.roomOrFlatNo || '—' },
    suName: { label: 'SU Name', getValue: v => v.suName },
    portOrNassRef: { label: 'Port / NASS Ref', getValue: v => v.portOrNassRef || '—' },
    dob: { label: 'DOB', getValue: v => v.dob || '—' },
    group: { label: 'Group', getValue: v => v.group || '—' },
    gender: { label: 'Gender', getValue: v => v.gender || '—' },
    riskLevel: { label: 'Risk Level', getValue: v => v.riskLevel },
    vulnerability: { label: 'Vulnerability', getValue: v => v.vulnerability },
    notesActionTaken: { label: 'Action Taken', getValue: v => v.notesActionTaken || '—' },
    sgTeamUpdate: { label: 'SG Update', getValue: v => v.sgTeamUpdate || '—' },
    reviewDate: { label: 'Review Date', getValue: v => v.reviewDate || '—' },
    raisedBy: { label: 'Raised By', getValue: v => v.raisedBy || v.allocatedWorker || '—' },
    allocatedWorker: { label: 'Allocated Worker', getValue: v => v.allocatedWorker || '—' },
    status: { label: 'Status', getValue: v => v.status }
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
      : vulnerableExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(v => activeCols.map(c => colMap[c].getValue(v)));
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
    const title = isArchive ? 'Archived Vulnerable Service Users' : 'Vulnerable Service Users Register';

    const cols = selectedColumns && selectedColumns.length > 0 
      ? selectedColumns 
      : vulnerableExportColumns.map(c => c.id);

    const colMap = getExportColumnMap();
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(v => activeCols.map(c => colMap[c].getValue(v)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `Vulnerable-SUs-${isArchive ? 'Archived-' : ''}${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title,
        subtitle: 'Safeguarding register, medical vulnerabilities, risk flags, and review dates.',
        filename: `Vulnerable-SUs-${isArchive ? 'Archived-' : ''}${scope}-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        isCompact,
        metadata: [
          { label: 'Export Scope', value: scope === 'all' ? 'All Records' : scope === 'custom' ? `${startDate} to ${endDate}` : 'Filtered View' },
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
      alert('Service User name is required');
      return;
    }
    addVulnerableSU({
      ...formData,
      raisedBy: formData.raisedBy || loggedInUserName
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
    updateVulnerableSU(editingRecord.id, {
      ...editingRecord,
      raisedBy: editingRecord.raisedBy || loggedInUserName
    });
    setEditingRecord(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <h2 className="text-2xl font-semibold text-[#242424] tracking-tight">
            {isArchive ? 'Archived Safeguarding SUs' : 'Vulnerable / Safeguarding SUs'}
          </h2>
          <p className="text-xs text-[#605e5c] mt-0.5">
            {isArchive
              ? 'Archived vulnerability files and historical welfare assessments.'
              : 'Active safeguarding registers, medical vulnerability flags, and welfare support plans.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-[#edebe9] p-0.5 rounded-xs flex items-center text-xs">
            <button
              onClick={() => setActivePage('vulnerable')}
              className={`px-3 py-1.5 rounded-xs font-semibold transition-colors ${
                !isArchive ? 'bg-white text-[#0f766e] shadow-xs' : 'text-[#605e5c] hover:text-[#242424]'
              }`}
            >
              Active Register
            </button>
            <button
              onClick={() => setActivePage('vulnerableArchive')}
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
              <span>+ Log Vulnerable SU</span>
            </button>
          )}

          <ExportDropdown
            moduleName={isArchive ? "Archived Vulnerable SUs" : "Vulnerable SUs"}
            totalRecordCount={allDataset.length}
            filteredRecordCount={sortedData.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={vulnerableExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
          />
        </div>
      </div>

      {/* Filter bar */}
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
        searchStorageKey="vulnerable_search"
      />

      {/* Data Table with persistent bottom-stretching height */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th 
                  onClick={() => handleSort('site')}
                  className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  title="Sort by Site"
                >
                  <div className="flex items-center gap-1">
                    <span>{isArchive ? 'Ibis Styles - Seven Kings' : 'Site Name'}</span>
                    {sortField === 'site' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('roomOrFlatNo')}
                  className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  title="Sort by Room/Flat"
                >
                  <div className="flex items-center gap-1">
                    <span>Room or Flat No</span>
                    {sortField === 'roomOrFlatNo' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('suName')}
                  className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  title="Sort by SU Name"
                >
                  <div className="flex items-center gap-1">
                    <span>{isArchive ? 'Name' : 'SU Name'}</span>
                    {sortField === 'suName' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('dob')}
                  className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  title="Sort by DOB"
                >
                  <div className="flex items-center gap-1">
                    <span>DOB</span>
                    {sortField === 'dob' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('group')}
                  className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  title="Sort by Group"
                >
                  <div className="flex items-center gap-1">
                    <span>Group</span>
                    {sortField === 'group' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('gender')}
                  className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  title="Sort by Gender"
                >
                  <div className="flex items-center gap-1">
                    <span>Gender</span>
                    {sortField === 'gender' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('portOrNassRef')}
                  className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  title="Sort by Port / NASS Ref"
                >
                  <div className="flex items-center gap-1">
                    <span>Port or Nass Ref</span>
                    {sortField === 'portOrNassRef' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('status')}
                  className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  title="Sort by Status"
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    {sortField === 'status' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th className="p-2.5 whitespace-nowrap">Raised By</th>
                <th className="p-2.5 min-w-[200px] max-w-[300px]">Vulnerability</th>
                <th className="p-2.5 min-w-[200px] max-w-[320px]">{isArchive ? 'Action Taken' : 'Notes/Action Taken'}</th>
                {!isArchive && <th className="p-2.5 min-w-[200px] max-w-[320px]">SG TEAM UPDATE</th>}
                <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={isArchive ? 12 : 13} className="text-center py-12 text-[#605e5c]">
                    No vulnerable resident records found.
                  </td>
                </tr>
              ) : (
                paginatedData.map(v => {
                  const canEdit = canEditRecord(v.site);
                  const canDelete = canDeleteRecord();

                  return (
                    <tr key={v.id} className="hover:bg-[#fafafa] transition-colors">
                      <td className="p-2.5 font-medium text-[#242424] whitespace-nowrap">{v.site}</td>
                      <td className="p-2.5 font-mono text-[11px] text-neutral-700 whitespace-nowrap">{v.roomOrFlatNo || '—'}</td>
                      <td className="p-2.5 font-semibold text-[#0f766e] whitespace-nowrap">
                        <button onClick={() => setViewRecord(v)} className="hover:underline text-left">
                          {v.suName}
                        </button>
                      </td>
                      <td className="p-2.5 text-neutral-600 whitespace-nowrap font-mono text-[11px]">{v.dob || '—'}</td>
                      <td className="p-2.5 text-neutral-700 whitespace-nowrap">{v.group}</td>
                      <td className="p-2.5 text-neutral-600 whitespace-nowrap">{v.gender}</td>
                      <td className="p-2.5 font-mono text-[11px] text-neutral-600 whitespace-nowrap">{v.portOrNassRef || '—'}</td>
                      <td className="p-2.5 whitespace-nowrap">
                        {canEdit && !isArchive ? (
                          <select
                            value={v.status || 'Active'}
                            onChange={e => updateVulnerableSU(v.id, { status: e.target.value as any })}
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0078d4] ${
                              v.status === 'Active' ? 'bg-[#e8f5e9] text-[#107c10] border-[#c8e6c9]' :
                              v.status === 'Under Review' ? 'bg-[#fff4ce] text-[#7f6000] border-[#ffe788]' :
                              v.status === 'High Risk' ? 'bg-[#fde7e9] text-[#a80000] border-[#f8bcc1]' :
                              v.status === 'Archived' ? 'bg-[#f0eafd] text-[#5c2d91] border-[#dcd0f9]' :
                              'bg-neutral-100 text-neutral-700 border-neutral-300'
                            }`}
                            title="Click to update status"
                          >
                            {vulnerableStatusOptions.map(opt => (
                              <option key={opt.id} value={opt.value} className="bg-white text-neutral-900 font-normal">
                                {opt.label}
                              </option>
                            ))}
                            {!vulnerableStatusOptions.some(o => o.value === (v.status || 'Active')) && (
                              <option value={v.status || 'Active'} className="bg-white text-neutral-900 font-normal">
                                {v.status || 'Active'}
                              </option>
                            )}
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded ${
                            v.status === 'Active' ? 'bg-[#e8f5e9] text-[#107c10]' :
                            v.status === 'Under Review' ? 'bg-[#fff4ce] text-[#7f6000]' :
                            v.status === 'High Risk' ? 'bg-[#fde7e9] text-[#a80000]' :
                            v.status === 'Archived' ? 'bg-[#f0eafd] text-[#5c2d91]' :
                            'bg-neutral-100 text-neutral-700'
                          }`}>
                            {v.status || 'Active'}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-neutral-700 whitespace-nowrap">
                        {v.raisedBy || v.allocatedWorker || '—'}
                      </td>
                      <td className="p-2.5 text-[#323130] text-[11px] max-w-[300px] truncate" title={v.vulnerability}>
                        {v.vulnerability}
                      </td>
                      <td className="p-2.5 text-[#605e5c] text-[11px] max-w-[320px] truncate" title={v.notesActionTaken}>
                        {v.notesActionTaken || '—'}
                      </td>
                      {!isArchive && (
                        <td className="p-2.5 text-[#0f766e] font-medium text-[11px] max-w-[320px] truncate" title={v.sgTeamUpdate}>
                          {v.sgTeamUpdate || '—'}
                        </td>
                      )}
                      <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewRecord(v)}
                            className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#edebe9] rounded"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => setEditingRecord(v)}
                              className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#edebe9] rounded"
                              title="Edit Record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {v.status === 'Archived' ? (
                            <button
                              onClick={() => restoreVulnerableSU(v.id)}
                              className="p-1 text-[#0d9488] hover:bg-[#edebe9] rounded font-semibold text-[11px] flex items-center gap-0.5"
                              title="Restore"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Restore</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => archiveVulnerableSU(v.id)}
                              className="p-1 text-neutral-500 hover:text-purple-700 hover:bg-[#edebe9] rounded"
                              title="Archive"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => deleteVulnerableSU(v.id)}
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

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={sortedData.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 20, 50]}
        />
      </div>

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#f8f9fa]">
              <h3 className="text-base font-semibold text-[#242424]">
                Log Vulnerable / Safeguarding Service User
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
                  <label className="font-semibold text-[#605e5c] block mb-1">Room or Flat No *</label>
                  <input
                    type="text"
                    value={formData.roomOrFlatNo}
                    onChange={e => setFormData({ ...formData, roomOrFlatNo: e.target.value })}
                    placeholder="e.g. Room 204"
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">SU Full Name *</label>
                  <input
                    type="text"
                    value={formData.suName}
                    onChange={e => setFormData({ ...formData, suName: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
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
                  <label className="font-semibold text-[#605e5c] block mb-1">Demographic Group</label>
                  <select
                    value={formData.group}
                    onChange={e => setFormData({ ...formData, group: e.target.value as VulnerableSU['group'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Single Adult">Single Adult</option>
                    <option value="Family">Family</option>
                    <option value="Pregnant Woman">Pregnant Woman</option>
                    <option value="Elderly">Elderly</option>
                    <option value="Young Adult (18-21)">Young Adult (18-21)</option>
                    <option value="Medical Need">Medical Need</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value as VulnerableSU['gender'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Port or NASS Ref</label>
                  <input
                    type="text"
                    value={formData.portOrNassRef}
                    onChange={e => setFormData({ ...formData, portOrNassRef: e.target.value })}
                    placeholder="e.g. NASS-77192"
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Risk Level</label>
                  <select
                    value={formData.riskLevel}
                    onChange={e => setFormData({ ...formData, riskLevel: e.target.value as RiskLevel })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Next Review Date</label>
                  <input
                    type="date"
                    value={formData.reviewDate}
                    onChange={e => setFormData({ ...formData, reviewDate: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
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
                  <label className="font-semibold text-[#605e5c] block mb-1">Allocated Worker</label>
                  <input
                    type="text"
                    value={formData.allocatedWorker}
                    onChange={e => setFormData({ ...formData, allocatedWorker: e.target.value })}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Status</label>
                  <select
                    value={formData.status || 'Active'}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {vulnerableStatusOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!vulnerableStatusOptions.some(o => o.value === (formData.status || 'Active')) && (
                      <option value={formData.status || 'Active'}>{formData.status || 'Active'}</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#605e5c]">Vulnerability Details *</label>
                  <span className="text-[11px] text-[#605e5c]">Click preset to insert:</span>
                </div>
                {vulnerabilityOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {vulnerabilityOptions.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const current = formData.vulnerability ? formData.vulnerability.trim() : '';
                          if (!current) {
                            setFormData({ ...formData, vulnerability: opt.value });
                          } else if (!current.includes(opt.value)) {
                            setFormData({ ...formData, vulnerability: `${current}; ${opt.value}` });
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
                  value={formData.vulnerability}
                  onChange={e => setFormData({ ...formData, vulnerability: e.target.value })}
                  placeholder="Primary vulnerability, health conditions, mobility challenges..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">Notes / Action Taken *</label>
                <textarea
                  rows={2}
                  value={formData.notesActionTaken}
                  onChange={e => setFormData({ ...formData, notesActionTaken: e.target.value })}
                  placeholder="Actions taken by accommodation staff (ground floor room, medical aids, etc)..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">SG TEAM UPDATE</label>
                <textarea
                  rows={2}
                  value={formData.sgTeamUpdate}
                  onChange={e => setFormData({ ...formData, sgTeamUpdate: e.target.value })}
                  placeholder="Safeguarding team assessment notes, multi-agency feedback..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                />
              </div>

              {/* Supporting Proof Files / Documents */}
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
                  Confirm & Save
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
                Edit Vulnerable SU: {editingRecord.suName}
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
                    value={editingRecord.raisedBy || editingRecord.allocatedWorker || loggedInUserName}
                    readOnly
                    className="w-full p-2 border border-neutral-300 rounded-xs bg-neutral-100 text-neutral-700 font-medium cursor-not-allowed select-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Allocated Worker</label>
                  <input
                    type="text"
                    value={editingRecord.allocatedWorker || ''}
                    onChange={e => setEditingRecord({ ...editingRecord, allocatedWorker: e.target.value })}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Room or Flat No</label>
                  <input
                    type="text"
                    value={editingRecord.roomOrFlatNo}
                    onChange={e => setEditingRecord({ ...editingRecord, roomOrFlatNo: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Port or NASS Ref</label>
                  <input
                    type="text"
                    value={editingRecord.portOrNassRef || ''}
                    onChange={e => setEditingRecord({ ...editingRecord, portOrNassRef: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Risk Level</label>
                  <select
                    value={editingRecord.riskLevel}
                    onChange={e => setEditingRecord({ ...editingRecord, riskLevel: e.target.value as RiskLevel })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Status</label>
                  <select
                    value={editingRecord.status || 'Active'}
                    onChange={e => setEditingRecord({ ...editingRecord, status: e.target.value as any })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {vulnerableStatusOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!vulnerableStatusOptions.some(o => o.value === (editingRecord.status || 'Active')) && (
                      <option value={editingRecord.status || 'Active'}>{editingRecord.status || 'Active'}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Review Date</label>
                  <input
                    type="date"
                    value={editingRecord.reviewDate}
                    onChange={e => setEditingRecord({ ...editingRecord, reviewDate: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#605e5c]">Vulnerability</label>
                  <span className="text-[11px] text-[#605e5c]">Click preset to insert:</span>
                </div>
                {vulnerabilityOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {vulnerabilityOptions.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const current = editingRecord.vulnerability ? editingRecord.vulnerability.trim() : '';
                          if (!current) {
                            setEditingRecord({ ...editingRecord, vulnerability: opt.value });
                          } else if (!current.includes(opt.value)) {
                            setEditingRecord({ ...editingRecord, vulnerability: `${current}; ${opt.value}` });
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
                  value={editingRecord.vulnerability}
                  onChange={e => setEditingRecord({ ...editingRecord, vulnerability: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">Notes / Action Taken</label>
                <textarea
                  rows={2}
                  value={editingRecord.notesActionTaken}
                  onChange={e => setEditingRecord({ ...editingRecord, notesActionTaken: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">SG TEAM UPDATE</label>
                <textarea
                  rows={2}
                  value={editingRecord.sgTeamUpdate}
                  onChange={e => setEditingRecord({ ...editingRecord, sgTeamUpdate: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                />
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
                <h3 className="text-base font-semibold text-[#0f766e]">
                  Vulnerability Dossier: {viewRecord.suName}
                </h3>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                  viewRecord.riskLevel === 'High' || viewRecord.riskLevel === 'Critical'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {viewRecord.riskLevel} Risk
                </span>
              </div>
              <button onClick={() => setViewRecord(null)} className="text-neutral-400 hover:text-neutral-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#faf9f8] p-3 rounded-xs border border-[#edebe9]">
                <div>
                  <span className="text-neutral-500 font-semibold block">Site Name:</span>
                  <strong className="text-neutral-800">{viewRecord.site}</strong>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Room or Flat No:</span>
                  <strong className="text-neutral-800">{viewRecord.roomOrFlatNo || '—'}</strong>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">SU Name:</span>
                  <strong className="text-neutral-900">{viewRecord.suName}</strong>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">DOB:</span>
                  <span>{viewRecord.dob || '—'}</span>
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
                  <span className="text-neutral-500 font-semibold block">Port or Nass Ref:</span>
                  <span className="font-mono text-neutral-800">{viewRecord.portOrNassRef || '—'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Status:</span>
                  <span className="font-semibold text-[#0f766e]">{viewRecord.status}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Review Date:</span>
                  <strong className="text-[#0d9488]">{viewRecord.reviewDate}</strong>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Raised By:</span>
                  <strong className="text-neutral-800">{viewRecord.raisedBy || viewRecord.allocatedWorker || '—'}</strong>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block">Allocated Worker:</span>
                  <span className="text-neutral-800">{viewRecord.allocatedWorker || '—'}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-neutral-700 mb-1">Vulnerability</h4>
                <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed">
                  {viewRecord.vulnerability}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-neutral-700 mb-1">Notes/Action Taken</h4>
                <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed">
                  {viewRecord.notesActionTaken}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-neutral-700 mb-1">SG TEAM UPDATE</h4>
                <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed">
                  {viewRecord.sgTeamUpdate || 'Awaiting formal review update.'}
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
        title={isArchive ? "Export Archived Vulnerable SUs" : "Export Vulnerable SUs Register"}
        moduleName={isArchive ? "Archived Vulnerable SUs" : "Vulnerable SUs"}
        defaultFormat={exportModalFormat}
        defaultOrientation="landscape"
        totalRecordCount={allDataset.length}
        filteredRecordCount={sortedData.length}
        dateRangeRecordCount={calculateDateRangeCount}
        availableColumns={vulnerableExportColumns}
        getPreviewData={getExportPreviewData}
        onExport={handlePerformExport}
      />
    </div>
  );
};
