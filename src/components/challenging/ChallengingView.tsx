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
  ArrowDown,
  SlidersHorizontal
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ChallengingSU, RiskLevel, StatusType, RecordAttachment } from '../../types';
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
import { useTableSchema } from '../../hooks/useTableSchema';
import { TableColumnConfig } from '../../types/tableSchema';
import { challengingTableConfig } from '../../config/trackerTableConfigs';

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
    setGlobalSearchFilter,
    isMobileCompactView
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

  // Dynamic Table Schema & Custom Fields Hook
  const {
    columns: challengingColumns,
    tableColumns: visibleChallengingColumns,
    saveColumns: handleSaveChallengingColumns,
    resetToDefault: handleResetChallengingColumns
  } = useTableSchema<ChallengingSU>('challenging', challengingTableConfig);
  const [isSchemaEditorOpen, setIsSchemaEditorOpen] = useState<boolean>(false);

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

  const renderColumnCell = (col: TableColumnConfig<ChallengingSU>, c: ChallengingSU) => {
    const val = (c as any)[col.key];

    if (col.renderCell) {
      return col.renderCell(val, c);
    }

    if (col.key === 'date') {
      return <span className="text-neutral-600 whitespace-nowrap font-mono text-[11px]">{c.date || c.dateOfIncident || '—'}</span>;
    }

    if (col.key === 'site') {
      return <span className="font-medium text-[#242424] whitespace-nowrap">{c.site}</span>;
    }

    if (col.key === 'name') {
      return (
        <button onClick={() => setViewRecord(c)} className="hover:underline text-left font-semibold text-[#0f766e] whitespace-nowrap cursor-pointer">
          {c.name}
        </button>
      );
    }

    if (col.key === 'portRef') {
      return <span className="font-mono text-[11px] text-neutral-600 whitespace-nowrap">{c.portRef || '—'}</span>;
    }

    if (col.key === 'dob') {
      return <span className="text-neutral-600 whitespace-nowrap font-mono text-[11px]">{c.dob || '—'}</span>;
    }

    if (col.key === 'group') {
      return <span className="text-neutral-700 whitespace-nowrap">{c.group || '—'}</span>;
    }

    if (col.key === 'gender') {
      return <span className="text-neutral-600 whitespace-nowrap">{c.gender || '—'}</span>;
    }

    if (col.key === 'raisedBy') {
      return <span className="text-neutral-700 whitespace-nowrap">{c.raisedBy || c.loggedBy || '—'}</span>;
    }

    if (col.key === 'status') {
      const canEdit = canEditRecord(c.site);
      return canEdit && !isArchive ? (
        <select
          value={c.status || 'Active'}
          onChange={e => updateChallengingSU(c.id, { status: e.target.value as any })}
          className={`px-2 py-0.5 text-[11px] font-semibold rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0078d4] ${(c.status as string) === 'Active' || c.status === 'Open' ? 'bg-[#fff4ce] text-[#7f6000] border-[#ffe788]' :
              (c.status as string) === 'Under Review' || (c.status as string) === 'In progress' ? 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]' :
                (c.status as string) === 'Under Investigation' ? 'bg-[#f0eafd] text-[#5c2d91] border-[#dcd0f9]' :
                  (c.status as string) === 'Resolved' || c.status === 'Completed' ? 'bg-[#e8f5e9] text-[#107c10] border-[#c8e6c9]' :
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
        <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded ${(c.status as string) === 'Active' || c.status === 'Open' ? 'bg-[#fff4ce] text-[#7f6000]' :
            (c.status as string) === 'Under Review' || (c.status as string) === 'In progress' ? 'bg-[#f0fdfa] text-[#0f766e]' :
              (c.status as string) === 'Under Investigation' ? 'bg-[#f0eafd] text-[#5c2d91]' :
                (c.status as string) === 'Resolved' || c.status === 'Completed' ? 'bg-[#e8f5e9] text-[#107c10]' :
                  c.status === 'Archived' ? 'bg-neutral-100 text-neutral-600' :
                    'bg-neutral-100 text-neutral-700'
          }`}>
          {c.status || 'Active'}
        </span>
      );
    }

    if (col.key === 'typeOfIssue') {
      return <span className="text-neutral-700 font-medium whitespace-nowrap">{c.typeOfIssue || '—'}</span>;
    }

    if (col.key === 'incidentDescription') {
      return (
        <span className="text-[#323130] text-[11px] max-w-[280px] truncate block" title={c.incidentDescription}>
          {c.incidentDescription || '—'}
        </span>
      );
    }

    if (col.key === 'dateOfIncident') {
      return <span className="text-neutral-600 whitespace-nowrap font-mono text-[11px]">{c.dateOfIncident || c.date || '—'}</span>;
    }

    if (col.key === 'actionTaken') {
      return (
        <span className="text-[#605e5c] text-[11px] max-w-[260px] truncate block" title={c.actionTaken}>
          {c.actionTaken || '—'}
        </span>
      );
    }

    if (col.key === 'adviceGivenBySGTeam') {
      return (
        <span className="text-[#605e5c] text-[11px] max-w-[260px] truncate block" title={c.adviceGivenBySGTeam}>
          {c.adviceGivenBySGTeam || '—'}
        </span>
      );
    }

    if (col.key === 'followUpRequired') {
      return (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${c.followUpRequired === 'Yes' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'}`}>
          {c.followUpRequired || 'No'}
        </span>
      );
    }

    if (col.key === 'riskFactor') {
      return (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${c.riskFactor === 'Critical' || c.riskFactor === 'High'
            ? 'bg-red-100 text-red-800'
            : c.riskFactor === 'Medium'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-neutral-100 text-neutral-700'
          }`}>
          {c.riskFactor || 'Low'}
        </span>
      );
    }

    if (col.key === 'followUpNotes') {
      return (
        <span className="text-[#605e5c] text-[11px] max-w-[260px] truncate block" title={c.followUpNotes}>
          {c.followUpNotes || '—'}
        </span>
      );
    }

    if (col.key === 'comments') {
      return (
        <span className="text-[#605e5c] text-[11px] max-w-[240px] truncate block" title={c.comments}>
          {c.comments || '—'}
        </span>
      );
    }

    if (col.key === 'reviewBySGTeam') {
      const reviewText = c.reviewBySGTeam;
      const isBogusHotel = reviewText && (
        reviewText.toLowerCase().includes('hotel') ||
        reviewText.toLowerCase().includes('stansted') ||
        reviewText.toLowerCase().includes('ibis') ||
        reviewText === c.site
      );
      const displayVal = isBogusHotel ? '—' : (reviewText || '—');
      return (
        <span className="text-[#605e5c] text-[11px] max-w-[260px] truncate block" title={displayVal}>
          {displayVal}
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
              className={`px-3 py-1.5 rounded-xs font-semibold transition-colors ${!isArchive ? 'bg-white text-[#0f766e] shadow-xs' : 'text-[#605e5c] hover:text-[#242424]'
                }`}
            >
              Active Incidents
            </button>
            <button
              onClick={() => setActivePage('challengingArchive')}
              className={`px-3 py-1.5 rounded-xs font-semibold transition-colors ${isArchive ? 'bg-white text-[#0f766e] shadow-xs' : 'text-[#605e5c] hover:text-[#242424]'
                }`}
            >
              Archive
            </button>
          </div>

          {currentUserRole === 'Super Admin' && (
            <button
              id="btn-customize-challenging-table"
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
        {isMobileCompactView ? (
          <div className="p-3 bg-neutral-50/50 flex-1 overflow-y-auto">
            <CompactRecordList
              data={paginatedData}
              emptyMessage="No challenging SU records found."
              renderCard={(c, idx) => {
                const canEdit = canEditRecord(c.site);
                const canDelete = canDeleteRecord();
                const srNo = (currentPage - 1) * pageSize + idx + 1;

                return (
                  <CompactRecordCard
                    key={c.id}
                    id={c.id}
                    srNo={srNo}
                    title={c.name || 'Unnamed Resident'}
                    subtitle={c.portRef ? `Port Ref: ${c.portRef}` : undefined}
                    site={c.site}
                    statusBadge={renderColumnCell({ key: 'status' } as any, c)}
                    fields={[
                      { label: 'Issue Type', value: c.typeOfIssue },
                      { label: 'Risk Factor', value: c.riskFactor },
                      { label: 'Incident Date', value: c.dateOfIncident || c.date },
                      { label: 'Raised By', value: c.raisedBy }
                    ]}
                    isArchived={c.status === 'Archived'}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onView={() => setViewRecord(c)}
                    onEdit={canEdit ? () => setEditingRecord(c) : undefined}
                    onArchive={c.status !== 'Archived' ? () => archiveChallengingSU(c.id) : undefined}
                    onRestore={c.status === 'Archived' ? () => restoreChallengingSU(c.id) : undefined}
                    onDelete={canDelete ? () => deleteChallengingSU(c.id) : undefined}
                  />
                );
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse min-w-[1800px]">
              <thead>
                <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                  {visibleChallengingColumns.map(col => (
                    <th
                      key={String(col.key)}
                      onClick={() => handleSort(col.key as any)}
                      className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
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
                  <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edebe9]">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={visibleChallengingColumns.length + 1} className="text-center py-12 text-[#605e5c]">
                      No challenging SU records found.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map(c => {
                    const canEdit = canEditRecord(c.site);
                    const canDelete = canDeleteRecord();

                    return (
                      <tr key={c.id} className="hover:bg-[#fafafa] transition-colors">
                        {visibleChallengingColumns.map(col => (
                          <td key={String(col.key)} className="p-2.5">
                            {renderColumnCell(col, c)}
                          </td>
                        ))}
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
        )}

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

      {/* DYNAMIC CREATE CHALLENGING SU MODAL */}
      <DynamicRecordFormModal<ChallengingSU>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Log Challenging SU Behavior / Incident"
        columns={challengingColumns}
        initialValues={{
          date: new Date().toISOString().slice(0, 10),
          site: !canAccessAllSites() ? assignedSite : (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])),
          riskFactor: 'Medium',
          status: 'Open',
          group: 'Single Adult',
          gender: 'Male',
          followUpRequired: 'Yes',
          raisedBy: loggedInUserName,
          reviewBySGTeam: '',
          comments: '',
          adviceGivenBySGTeam: '',
          followUpNotes: ''
        }}
        onSave={(data) => {
          const effectiveSite = !canAccessAllSites() ? assignedSite : (data.site || (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])));
          addChallengingSU({
            ...data,
            date: data.date || new Date().toISOString().slice(0, 10),
            site: effectiveSite,
            name: data.name || '',
            portRef: data.portRef || '',
            dob: data.dob || '',
            group: data.group || 'Single Adult',
            gender: data.gender || 'Male',
            raisedBy: data.raisedBy || loggedInUserName,
            loggedBy: data.raisedBy || loggedInUserName,
            typeOfIssue: data.typeOfIssue || '',
            incidentDescription: data.incidentDescription || '',
            dateOfIncident: data.dateOfIncident || new Date().toISOString().slice(0, 10),
            actionTaken: data.actionTaken || '',
            adviceGivenBySGTeam: data.adviceGivenBySGTeam || '',
            followUpRequired: data.followUpRequired || 'Yes',
            riskFactor: data.riskFactor || 'Medium',
            followUpNotes: data.followUpNotes || '',
            comments: data.comments || '',
            reviewBySGTeam: data.reviewBySGTeam || '',
            status: data.status || 'Open',
            attachments: Array.isArray(data.attachments) ? data.attachments : []
          } as any);
          setIsCreateModalOpen(false);
        }}
      />

      {/* DYNAMIC EDIT CHALLENGING SU MODAL */}
      <DynamicRecordFormModal<ChallengingSU>
        isOpen={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title={`Edit Incident: ${editingRecord?.name || ''}`}
        columns={challengingColumns}
        initialValues={editingRecord ? {
          ...editingRecord,
          reviewBySGTeam: (
            editingRecord.reviewBySGTeam && (
              editingRecord.reviewBySGTeam.toLowerCase().includes('hotel') ||
              editingRecord.reviewBySGTeam.toLowerCase().includes('stansted') ||
              editingRecord.reviewBySGTeam.toLowerCase().includes('ibis') ||
              editingRecord.reviewBySGTeam === editingRecord.site
            )
          ) ? '' : (editingRecord.reviewBySGTeam || '')
        } : undefined}
        isEdit={true}
        onSave={(data) => {
          if (!editingRecord) return;
          const cleanReview = (
            data.reviewBySGTeam && (
              data.reviewBySGTeam.toLowerCase().includes('hotel') ||
              data.reviewBySGTeam.toLowerCase().includes('stansted') ||
              data.reviewBySGTeam.toLowerCase().includes('ibis') ||
              data.reviewBySGTeam === (data.site || editingRecord.site)
            )
          ) ? '' : (data.reviewBySGTeam || '');
          updateChallengingSU(editingRecord.id, {
            ...editingRecord,
            ...data,
            reviewBySGTeam: cleanReview,
            raisedBy: data.raisedBy || editingRecord.raisedBy || loggedInUserName,
            loggedBy: data.raisedBy || editingRecord.loggedBy || loggedInUserName
          });
          setEditingRecord(null);
        }}
      />

      {/* DYNAMIC VIEW CHALLENGING SU MODAL */}
      <DynamicRecordViewModal<ChallengingSU>
        isOpen={Boolean(viewRecord)}
        onClose={() => setViewRecord(null)}
        title={`Challenging Service User Incident: ${viewRecord?.name || ''}`}
        columns={challengingColumns}
        record={viewRecord ? {
          ...viewRecord,
          reviewBySGTeam: (
            viewRecord.reviewBySGTeam && (
              viewRecord.reviewBySGTeam.toLowerCase().includes('hotel') ||
              viewRecord.reviewBySGTeam.toLowerCase().includes('stansted') ||
              viewRecord.reviewBySGTeam.toLowerCase().includes('ibis') ||
              viewRecord.reviewBySGTeam === viewRecord.site
            )
          ) ? '' : (viewRecord.reviewBySGTeam || '')
        } : null}
        onEdit={viewRecord && canEditRecord(viewRecord.site) && !isArchive ? () => {
          const rec = viewRecord;
          setViewRecord(null);
          setEditingRecord(rec);
        } : undefined}
      />

      {/* Table Schema / Header Customizer Modal (Super Admin Only) */}
      <TableSchemaEditorModal<ChallengingSU>
        isOpen={isSchemaEditorOpen}
        onClose={() => setIsSchemaEditorOpen(false)}
        moduleTitle="Challenging SUs Register"
        columns={challengingColumns}
        onSaveColumns={handleSaveChallengingColumns}
        onResetToDefault={handleResetChallengingColumns}
        currentUserRole={currentUserRole}
      />

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
