import React, { useState, useMemo } from 'react';
import { BulkActionToolbar } from '../common/BulkActionToolbar';
import { 
  Bus, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MessageSquareWarning,
  BarChart3,
  CreditCard,
  ArrowRightLeft,
  Building2,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PublicTransportRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { useTableSchema } from '../../hooks/useTableSchema';
import { PUBLIC_TRANSPORT_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';

import { TransportFeedbackSection } from './TransportFeedbackSection';
import { TransportChallengesSection } from './TransportChallengesSection';
import { TransportFundingSection } from './TransportFundingSection';

export type TransportTab = 'overview' | 'feedback' | 'challenges' | 'funding';

const transportExportColumns: ExportColumnOption[] = [
  { id: 'approvalUrn', label: 'Approval URN' },
  { id: 'suNames', label: 'Service User Name(s)' },
  { id: 'portRefs', label: 'Port Ref(s)' },
  { id: 'accommodationAddress', label: 'Accommodation Address' },
  { id: 'appointmentDate', label: 'Appointment Date' },
  { id: 'appointmentTime', label: 'Appointment Time' },
  { id: 'appointmentLocation', label: 'Appointment Location' },
  { id: 'modeOfTransport', label: 'Mode of Transport' },
  { id: 'distanceMiles', label: 'Distance (Miles)' },
  { id: 'status', label: 'Status' }
];

export const PublicTransportTrackerView: React.FC = () => {
  const {
    publicTransportRecords,
    addPublicTransportRecord,
    updatePublicTransportRecord,
    deletePublicTransportRecord,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    getFieldOptions,
    requestConfirmation,
    canAccessAllSites,
    allowedSites,
    assignedSite,
    transportFeedbackRecords,
    transportChallengeRecords,
    transportFundingRequests,
    transportRoomMoveRecords
  } = useApp();

  const [activeTab, setActiveTab] = useState<TransportTab>('overview');


  // Dynamic transport modes and statuses from Field Options Setup
  const transportModeOptions = React.useMemo(() => getFieldOptions('transportModes', false), [getFieldOptions]);
  const transportStatusOptions = React.useMemo(() => getFieldOptions('transportApprovalStatuses', false), [getFieldOptions]);
  // Table Schema Hook
  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<PublicTransportRecord>('publicTransport', PUBLIC_TRANSPORT_TABLE_COLUMNS);

  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const handleToggleSelectAll = () => { setSelectedIds(prev => prev.length ? [] : paginatedRecords?.map(p => p.id) || []); };
  const handleToggleSelect = (e: any, id: string) => { e.stopPropagation(); setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (typeof requestConfirmation !== 'undefined') {
      requestConfirmation({
        title: 'Delete Selected', message: 'Are you sure you want to delete selected items?', isDanger: true,
        onConfirm: async () => { /* Add logic */ setSelectedIds([]); }
      });
    }
  };

  const [modeFilter, setModeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('appointmentDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PublicTransportRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<PublicTransportRecord | null>(null);

  const filteredRecords = useMemo(() => {
    return publicTransportRecords.filter(r => {
      // Site Isolation
      if (!canAccessAllSites()) {
        const allowed = new Set(allowedSites.map(s => s.toLowerCase().trim()));
        if (assignedSite) allowed.add(assignedSite.toLowerCase().trim());
        const site = ((r as any).siteName || r.accommodationAddress || '').toLowerCase().trim();
        const matchesAllowed = Array.from(allowed).some(s => site.includes(s) || s.includes(site));
        if (!matchesAllowed && allowed.size > 0) return false;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.approvalUrn.toLowerCase().includes(q) ||
        r.suNames.toLowerCase().includes(q) ||
        r.portRefs.toLowerCase().includes(q) ||
        r.accommodationAddress.toLowerCase().includes(q) ||
        r.appointmentLocation.toLowerCase().includes(q) ||
        r.modeOfTransport.toLowerCase().includes(q) ||
        r.exceptionalCircumstances.toLowerCase().includes(q);

      const matchesMode = modeFilter === 'all' || r.modeOfTransport.toLowerCase() === modeFilter.toLowerCase();
      const matchesStatus = statusFilter === 'all' || (r.status || 'Approved') === statusFilter;

      return matchesSearch && matchesMode && matchesStatus;
    });
  }, [publicTransportRecords, searchQuery, modeFilter, statusFilter, canAccessAllSites, allowedSites, assignedSite]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc' 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredRecords, sortKey, sortOrder]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRecords.slice(startIndex, startIndex + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleCreateSubmit = (data: Partial<PublicTransportRecord>) => {
    addPublicTransportRecord({
      approvalUrn: data.approvalUrn || `URN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      suNames: data.suNames || '',
      portRefs: data.portRefs || '',
      accommodationAddress: data.accommodationAddress || '',
      appointmentDate: data.appointmentDate || new Date().toISOString().slice(0, 10),
      appointmentTime: data.appointmentTime || '10:00',
      appointmentLocation: data.appointmentLocation || '',
      distanceMiles: typeof data.distanceMiles === 'number' ? data.distanceMiles : 5.0,
      modeOfTransport: data.modeOfTransport || 'Bus',
      exceptionalCircumstances: data.exceptionalCircumstances || '',
      status: (data.status as any) || 'Approved',
      ...data,
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    } as any);
    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<PublicTransportRecord>) => {
    if (!editingRecord) return;
    updatePublicTransportRecord(editingRecord.id, {
      ...editingRecord,
      ...data,
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    });
    setEditingRecord(null);
  };

  // Export Handlers with Custom Download & PDF/CSV Options
  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    let sourceData = publicTransportRecords;
    if (scope === 'filtered') sourceData = sortedRecords;
    else if (scope === 'custom' && startDate && endDate) {
      sourceData = publicTransportRecords.filter(t => {
        const d = t.appointmentDate || '';
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      });
    }
    return sourceData;
  };

  const calculateDateRangeCount = (startDate: string, endDate: string): number => {
    return publicTransportRecords.filter(t => {
      const d = t.appointmentDate || '';
      return (!startDate || d >= startDate) && (!endDate || d <= endDate);
    }).length;
  };

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
    const raw = getExportDataForScope(scope, startDate, endDate).slice(0, 5);
    const cols = selectedColumns && selectedColumns.length > 0
      ? transportExportColumns.filter(c => selectedColumns.includes(c.id))
      : transportExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));
    return { headers, rows };
  };

  const handlePerformExport = ({
    format,
    scope,
    orientation = 'landscape',
    startDate,
    endDate,
    selectedColumns
  }: {
    format: ExportFormat;
    scope: ExportScope;
    orientation: ExportOrientation;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => {
    const raw = getExportDataForScope(scope, startDate, endDate);
    const cols = selectedColumns && selectedColumns.length > 0
      ? transportExportColumns.filter(c => selectedColumns.includes(c.id))
      : transportExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));

    if (format === 'csv') {
      exportTableToCsv({ filename: 'Public_Transport_Authorizations.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'Public_Transport_Authorizations.pdf',
        title: 'Public Transport Assistance & Travel Authorizations',
        headers,
        rows,
        orientation
      });
    }
  };

  const renderColumnCell = (col: TableColumnConfig<PublicTransportRecord>, record: PublicTransportRecord) => {
    if (col.renderCell) {
      return col.renderCell((record as any)[col.key], record);
    }

    const value = (record as any)[col.key];

    if (col.badgeColors && value) {
      const badgeClass = col.badgeColors[value] || 'bg-gray-100 text-gray-800';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-semibold ${badgeClass}`}>
          {value}
        </span>
      );
    }

    if (col.key === 'approvalUrn') {
      return (
        <span className="font-mono text-[#0078d4] font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
          {value || '—'}
        </span>
      );
    }

    if (col.key === 'suNames') {
      return <span className="font-semibold text-[#242424]">{value || '—'}</span>;
    }

    if (col.key === 'portRefs') {
      return <span className="font-mono text-[#0f766e]">{value || '—'}</span>;
    }

    if (col.type === 'date') {
      return <span className="font-mono text-[#323130]">{value || '—'}</span>;
    }

    if (col.key === 'distanceMiles' && typeof value === 'number') {
      return <span className="font-medium text-[#242424]">{value.toFixed(1)} mi</span>;
    }

    if (value === null || value === undefined || value === '') {
      return <span className="text-[#a19f9d]">—</span>;
    }

    return String(value);
  };

  return (
    <div className="space-y-4">
      {/* Unified Top Banner with Tab Switcher */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 border border-purple-200 text-[#8764b8] rounded-xs">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424] tracking-tight">Public Transport</h1>
                <span className="text-xs bg-purple-50 text-[#8764b8] font-semibold px-2 py-0.5 rounded-xs border border-purple-200">
                  {activeTab === 'overview' ? `${filteredRecords.length} Authorizations` :
                   activeTab === 'feedback' ? `${transportFeedbackRecords.length} Feedbacks` :
                   activeTab === 'challenges' ? `${transportChallengeRecords.length} Periods` :
                   `${transportFundingRequests.length} Requests`}
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Single operational location for journey authorizations, feedback, site challenges, and funding requests.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Tab Switcher Pills */}
            <div className="flex items-center bg-[#f3f2f1] p-0.5 rounded-xs border border-[#e5e5e5]">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xs transition-colors cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-white text-[#8764b8] shadow-2xs'
                    : 'text-[#605e5c] hover:text-[#242424]'
                }`}
              >
                <Bus className="w-3.5 h-3.5" />
                <span>Overview</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'overview' ? 'bg-purple-100 text-[#8764b8]' : 'bg-[#e1dfdd] text-[#605e5c]'
                }`}>
                  {filteredRecords.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('feedback')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xs transition-colors cursor-pointer ${
                  activeTab === 'feedback'
                    ? 'bg-white text-[#8764b8] shadow-2xs'
                    : 'text-[#605e5c] hover:text-[#242424]'
                }`}
              >
                <MessageSquareWarning className="w-3.5 h-3.5" />
                <span>Feedback</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'feedback' ? 'bg-purple-100 text-[#8764b8]' : 'bg-[#e1dfdd] text-[#605e5c]'
                }`}>
                  {transportFeedbackRecords.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('challenges')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xs transition-colors cursor-pointer ${
                  activeTab === 'challenges'
                    ? 'bg-white text-[#8764b8] shadow-2xs'
                    : 'text-[#605e5c] hover:text-[#242424]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Challenges</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'challenges' ? 'bg-purple-100 text-[#8764b8]' : 'bg-[#e1dfdd] text-[#605e5c]'
                }`}>
                  {transportChallengeRecords.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('funding')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xs transition-colors cursor-pointer ${
                  activeTab === 'funding'
                    ? 'bg-white text-[#8764b8] shadow-2xs'
                    : 'text-[#605e5c] hover:text-[#242424]'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Funding Requests</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'funding' ? 'bg-purple-100 text-[#8764b8]' : 'bg-[#e1dfdd] text-[#605e5c]'
                }`}>
                  {transportFundingRequests.length}
                </span>
              </button>
            </div>

            {!canAccessAllSites() && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-slate-50 text-xs text-slate-700 border border-slate-200">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-semibold">{assignedSite || 'Assigned Hotel'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 1. OVERVIEW TAB: Transport Authorizations (Filters + Table only) */}
      {activeTab === 'overview' && (
        <>
          {/* Header, Actions & Filters card */}
          <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#242424]">Transport Authorizations</h2>
                <p className="text-xs text-neutral-500">Record, verify, and audit public transport allowances and exceptional travel authorizations.</p>
              </div>

          <div className="flex items-center gap-2 flex-wrap">
            {currentUserRole === 'Super Admin' && (
              <button
                type="button"
                onClick={() => setIsSchemaModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-neutral-50 text-neutral-700 border border-[#e5e5e5] rounded-xs shadow-2xs transition-colors"
                title="Super Admin: Customize table columns, headers, and fields"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0078d4]" />
                <span>Customize Table</span>
              </button>
            )}

            <ExportDropdown
              moduleName="Transport Authorizations"
              totalRecordCount={publicTransportRecords.length}
              filteredRecordCount={filteredRecords.length}
              defaultOrientation="landscape"
              dateRangeRecordCount={calculateDateRangeCount}
              availableColumns={transportExportColumns}
              getPreviewData={getExportPreviewData}
              onExport={handlePerformExport}
              buttonVariant="toolbar"
            />

            {canCreateRecord() && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#8764b8] hover:bg-[#744da9] text-white rounded-xs shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Issue Transport Authorization</span>
              </button>
            )}
          </div>
        </div>

        {/* Integrated Filter Row */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search URN, SU Names, Port Ref, Address..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] placeholder-neutral-400 focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
            />
          </div>

          <select
            value={modeFilter}
            onChange={e => { setModeFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
          >
            <option value="all">All Modes</option>
            {transportModeOptions.length > 0
              ? transportModeOptions.map(o => <option key={o.id} value={o.value || o.label}>{o.label}</option>)
              : ['Bus', 'Train', 'Underground', 'Tram', 'Taxi', 'Walking'].map(m => <option key={m} value={m}>{m}</option>)
            }
          </select>

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
          >
            <option value="all">All Statuses</option>
            {transportStatusOptions.length > 0
              ? transportStatusOptions.map(o => <option key={o.id} value={o.value || o.label}>{o.label}</option>)
              : ['Approved', 'Pending', 'Completed', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)
            }
          </select>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs min-h-[520px] lg:min-h-[calc(100vh-270px)] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                {visibleColumns.map(col => {
                  const isSorted = sortKey === col.key;
                  return (
                    <th 
                      key={String(col.key)} 
                      className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                      onClick={() => handleSort(String(col.key))}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.label}</span>
                        {isSorted ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#0078d4]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#0078d4]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-[#a19f9d]" />
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-[#605e5c]">
                    <Bus className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No transport records found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ Issue Transport Authorization' to record travel support.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(record => (
                  <tr key={record.id} className="hover:bg-[#f3f8fd] transition-colors">
                    {visibleColumns.map(col => (
                      <td key={String(col.key)} className="p-2.5">
                        {renderColumnCell(col, record)}
                      </td>
                    ))}
                    <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingRecord(record)}
                          className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs transition-colors"
                          title="View Details Dossier"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditRecord() && (
                          <button
                            onClick={() => setEditingRecord(record)}
                            className="p-1 hover:bg-[#f3f0f9] text-[#8764b8] rounded-xs transition-colors"
                            title="Edit Authorization"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => {
                              deletePublicTransportRecord(record.id);
                            }}
                            className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {/* Pagination Footer */}
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredRecords.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>
      </>
    )}

    {/* 2. TRANSPORT FEEDBACK TAB */}
    {activeTab === 'feedback' && <TransportFeedbackSection />}

    {/* 3. TRANSPORT CHALLENGES TAB */}
    {activeTab === 'challenges' && <TransportChallengesSection />}

    {/* 4. FUNDING REQUESTS TAB */}
    {activeTab === 'funding' && <TransportFundingSection />}

      {/* Dynamic Create Modal */}
      <DynamicRecordFormModal<PublicTransportRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Issue Public Transport Authorization"
        columns={columns}
        initialValues={{
          approvalUrn: `URN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          suNames: '',
          portRefs: '',
          accommodationAddress: '',
          appointmentDate: new Date().toISOString().slice(0, 10),
          appointmentTime: '10:00',
          appointmentLocation: '',
          distanceMiles: 5.0,
          modeOfTransport: 'Bus',
          exceptionalCircumstances: '',
          status: 'Approved',
          attachments: []
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Authorize Transport"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<PublicTransportRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Authorization - ${editingRecord.approvalUrn}`}
          columns={columns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Dossier Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<PublicTransportRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`Transport Authorization Dossier - ${viewingRecord.approvalUrn}`}
          columns={columns}
          record={viewingRecord}
          onEdit={() => {
            const rec = viewingRecord;
            setViewingRecord(null);
            setEditingRecord(rec);
          }}
          canEdit={canEditRecord()}
        />
      )}

      {/* Super Admin Table Schema Customizer Modal */}
      <TableSchemaEditorModal<PublicTransportRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Public Transport Tracker"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
