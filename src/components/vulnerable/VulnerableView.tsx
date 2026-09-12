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
  Lock,
  SlidersHorizontal
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VulnerableSU, RiskLevel, StatusType, RecordAttachment } from '../../types';
import { FilterBar } from '../common/FilterBar';
import { Pagination } from '../common/Pagination';
import { AttachmentsSection } from '../common/AttachmentsSection';
import { CompactRecordCard, CompactRecordList } from '../common/CompactRecordCards';
import { ExportModal, ExportFormat, ExportScope, ExportColumnOption, ExportOrientation } from '../common/ExportModal';
import { ExportDropdown } from '../common/ExportDropdown';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { vulnerableTableConfig } from '../../config/trackerTableConfigs';
import { useTableSchema } from '../../hooks/useTableSchema';
import { TableColumnConfig } from '../../types/tableSchema';

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
    setGlobalSearchFilter,
    isMobileCompactView
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

  // Dynamic Table Schema & Columns (Local persistence with fallback to trackerTableConfigs)
  const {
    columns: vulnerableColumns,
    tableColumns: visibleVulnerableColumns,
    saveColumns: handleSaveVulnerableColumns,
    resetToDefault: handleResetVulnerableColumns
  } = useTableSchema<VulnerableSU>('vulnerable', vulnerableTableConfig);

  const [isSchemaEditorOpen, setIsSchemaEditorOpen] = useState<boolean>(false);

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

  const renderColumnCell = (col: TableColumnConfig<VulnerableSU>, v: VulnerableSU) => {
    const val = (v as any)[col.key];

    if (col.renderCell) {
      return col.renderCell(val, v);
    }

    if (col.key === 'site') {
      return <span className="font-medium text-[#242424] whitespace-nowrap">{v.site}</span>;
    }

    if (col.key === 'roomOrFlatNo') {
      return <span className="font-mono text-[11px] text-neutral-700 whitespace-nowrap">{v.roomOrFlatNo || '—'}</span>;
    }

    if (col.key === 'suName') {
      return (
        <button onClick={() => setViewRecord(v)} className="hover:underline text-left font-semibold text-[#0f766e] whitespace-nowrap cursor-pointer">
          {v.suName || '—'}
        </button>
      );
    }

    if (col.key === 'dob') {
      return <span className="text-neutral-600 whitespace-nowrap font-mono text-[11px]">{v.dob || '—'}</span>;
    }

    if (col.key === 'group') {
      return <span className="text-neutral-700 whitespace-nowrap">{v.group || '—'}</span>;
    }

    if (col.key === 'gender') {
      return <span className="text-neutral-600 whitespace-nowrap">{v.gender || '—'}</span>;
    }

    if (col.key === 'portOrNassRef') {
      return <span className="font-mono text-[11px] text-neutral-600 whitespace-nowrap">{v.portOrNassRef || '—'}</span>;
    }

    if (col.key === 'status') {
      return canEditRecord(v.site) && !isArchive ? (
        <select
          value={v.status || 'Active'}
          onChange={e => updateVulnerableSU(v.id, { status: e.target.value as any })}
          className={`px-2 py-0.5 text-[11px] font-semibold rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0078d4] ${(v.status as string) === 'Active' || (v.status as string) === 'Open' ? 'bg-[#e8f5e9] text-[#107c10] border-[#c8e6c9]' :
              (v.status as string) === 'Under Review' || (v.status as string) === 'In Progress' ? 'bg-[#fff4ce] text-[#7f6000] border-[#ffe788]' :
                (v.status as string) === 'High Risk' || (v.status as string) === 'Critical' ? 'bg-[#fde7e9] text-[#a80000] border-[#f8bcc1]' :
                  (v.status as string) === 'Archived' || (v.status as string) === 'Closed' ? 'bg-[#f0eafd] text-[#5c2d91] border-[#dcd0f9]' :
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
        <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded ${(v.status as string) === 'Active' || (v.status as string) === 'Open' ? 'bg-[#e8f5e9] text-[#107c10]' :
            (v.status as string) === 'Under Review' || (v.status as string) === 'In Progress' ? 'bg-[#fff4ce] text-[#7f6000]' :
              (v.status as string) === 'High Risk' || (v.status as string) === 'Critical' ? 'bg-[#fde7e9] text-[#a80000]' :
                (v.status as string) === 'Archived' || (v.status as string) === 'Closed' ? 'bg-[#f0eafd] text-[#5c2d91]' :
                  'bg-neutral-100 text-neutral-700'
          }`}>
          {v.status || 'Active'}
        </span>
      );
    }

    if (col.key === 'raisedBy' || col.key === 'allocatedWorker') {
      return <span className="text-neutral-700 whitespace-nowrap">{v.raisedBy || v.allocatedWorker || '—'}</span>;
    }

    if (col.key === 'reviewDate') {
      return <span className="font-mono text-[11px] text-neutral-600 whitespace-nowrap">{v.reviewDate || '—'}</span>;
    }

    if (col.key === 'vulnerability') {
      return (
        <span className="text-[#323130] text-[11px] max-w-[280px] truncate block" title={v.vulnerability}>
          {v.vulnerability || '—'}
        </span>
      );
    }

    if (col.key === 'notesActionTaken') {
      return (
        <span className="text-[#605e5c] text-[11px] max-w-[300px] truncate block" title={v.notesActionTaken}>
          {v.notesActionTaken || '—'}
        </span>
      );
    }

    if (col.key === 'sgTeamUpdate') {
      return (
        <span className="text-[#0f766e] font-medium text-[11px] max-w-[300px] truncate block" title={v.sgTeamUpdate}>
          {v.sgTeamUpdate || '—'}
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

    return <span className="text-neutral-700 text-xs">{val !== undefined && val !== null && val !== '' ? String(val) : '—'}</span>;
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
              className={`px-3 py-1.5 rounded-xs font-semibold transition-colors ${!isArchive ? 'bg-white text-[#0f766e] shadow-xs' : 'text-[#605e5c] hover:text-[#242424]'
                }`}
            >
              Active Register
            </button>
            <button
              onClick={() => setActivePage('vulnerableArchive')}
              className={`px-3 py-1.5 rounded-xs font-semibold transition-colors ${isArchive ? 'bg-white text-[#0f766e] shadow-xs' : 'text-[#605e5c] hover:text-[#242424]'
                }`}
            >
              Archive
            </button>
          </div>

          {/* Super Admin Table Customizer Button */}
          {currentUserRole === 'Super Admin' && (
            <button
              id="btn-customize-vulnerable-table"
              onClick={() => setIsSchemaEditorOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-300 rounded-xs shadow-xs transition-colors cursor-pointer"
              title="Configure Table Headers & Form Fields (Super Admin Only)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#0d9488]" />
              <span>Customize Table</span>
            </button>
          )}

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
        {isMobileCompactView ? (
          <div className="p-3 bg-neutral-50/50 flex-1 overflow-y-auto">
            <CompactRecordList
              data={paginatedData}
              emptyMessage="No vulnerable resident records found."
              renderCard={(v, idx) => {
                const canEdit = canEditRecord(v.site);
                const canDelete = canDeleteRecord();
                const srNo = (currentPage - 1) * pageSize + idx + 1;

                return (
                  <CompactRecordCard
                    key={v.id}
                    id={v.id}
                    srNo={srNo}
                    title={v.suName || 'Unnamed Resident'}
                    subtitle={v.portOrNassRef ? `Port/NASS Ref: ${v.portOrNassRef}` : undefined}
                    site={v.site}
                    statusBadge={renderColumnCell({ key: 'status' } as any, v)}
                    fields={[
                      { label: 'Room / Flat', value: v.roomOrFlatNo },
                      { label: 'Risk Level', value: v.riskLevel },
                      { label: 'Review Date', value: v.reviewDate },
                      { label: 'Vulnerability', value: v.vulnerability }
                    ]}
                    isArchived={v.status === 'Archived'}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onView={() => setViewRecord(v)}
                    onEdit={canEdit ? () => setEditingRecord(v) : undefined}
                    onArchive={v.status !== 'Archived' ? () => archiveVulnerableSU(v.id) : undefined}
                    onRestore={v.status === 'Archived' ? () => restoreVulnerableSU(v.id) : undefined}
                    onDelete={canDelete ? () => deleteVulnerableSU(v.id) : undefined}
                  />
                );
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
              <thead>
                <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                  {visibleVulnerableColumns.map(col => {
                    const isSorted = sortField === col.key;
                    return (
                      <th
                        key={String(col.key)}
                        onClick={() => handleSort(col.key as any)}
                        className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                        title={`Sort by ${col.label}`}
                      >
                        <div className="flex items-center gap-1">
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
                    <td colSpan={visibleVulnerableColumns.length + 1} className="text-center py-12 text-[#605e5c]">
                      No vulnerable resident records found.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map(v => {
                    const canEdit = canEditRecord(v.site);
                    const canDelete = canDeleteRecord();

                    return (
                      <tr key={v.id} className="hover:bg-[#fafafa] transition-colors">
                        {visibleVulnerableColumns.map(col => (
                          <td key={String(col.key)} className="p-2.5 whitespace-nowrap">
                            {renderColumnCell(col, v)}
                          </td>
                        ))}
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
        )}

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
        />
      </div>

      {/* DYNAMIC CREATE VULNERABLE SU MODAL */}
      <DynamicRecordFormModal<VulnerableSU>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Log Vulnerable / Safeguarding Service User"
        columns={vulnerableColumns}
        initialValues={{
          site: !canAccessAllSites() ? assignedSite : (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])),
          riskLevel: 'Low',
          status: 'Open',
          group: 'Single Adult',
          gender: 'Male',
          raisedBy: loggedInUserName,
          attachments: []
        }}
        onSave={(data) => {
          const effectiveSite = !canAccessAllSites() ? assignedSite : (data.site || (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])));
          addVulnerableSU({
            site: effectiveSite,
            roomOrFlatNo: data.roomOrFlatNo || '',
            suName: data.suName || '',
            dob: data.dob || '',
            group: data.group || 'Single Adult',
            gender: data.gender || 'Male',
            portOrNassRef: data.portOrNassRef || '',
            riskLevel: data.riskLevel || 'Low',
            vulnerability: data.vulnerability || '',
            notesActionTaken: data.notesActionTaken || '',
            sgTeamUpdate: data.sgTeamUpdate || '',
            reviewDate: data.reviewDate || '',
            raisedBy: data.raisedBy || loggedInUserName,
            allocatedWorker: data.allocatedWorker || '',
            status: data.status || 'Open',
            attachments: Array.isArray(data.attachments) ? data.attachments : []
          });
          setIsCreateModalOpen(false);
        }}
      />

      {/* DYNAMIC EDIT VULNERABLE SU MODAL */}
      <DynamicRecordFormModal<VulnerableSU>
        isOpen={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title={`Edit Vulnerable SU: ${editingRecord?.suName || ''}`}
        columns={vulnerableColumns}
        initialValues={editingRecord || undefined}
        isEdit={true}
        onSave={(data) => {
          if (!editingRecord) return;
          updateVulnerableSU(editingRecord.id, {
            ...editingRecord,
            ...data,
            raisedBy: editingRecord.raisedBy || loggedInUserName
          });
          setEditingRecord(null);
        }}
      />

      {/* DYNAMIC VIEW VULNERABLE SU MODAL */}
      <DynamicRecordViewModal<VulnerableSU>
        isOpen={Boolean(viewRecord)}
        onClose={() => setViewRecord(null)}
        title={`Vulnerable Service User Dossier: ${viewRecord?.suName || ''}`}
        columns={vulnerableColumns}
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

      {/* SUPER ADMIN TABLE SCHEMA & HEADER CUSTOMIZER MODAL */}
      <TableSchemaEditorModal<VulnerableSU>
        isOpen={isSchemaEditorOpen}
        onClose={() => setIsSchemaEditorOpen(false)}
        moduleTitle="Vulnerable Service Users"
        columns={vulnerableColumns}
        onSaveColumns={handleSaveVulnerableColumns}
        onResetToDefault={handleResetVulnerableColumns}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
