import React, { useState, useMemo } from 'react';
import { 
  AlertOctagon, 
  Plus, 
  Trash2, 
  Eye, 
  Edit2,
  Search, 
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EscalationRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { CompactRecordCard, CompactRecordList } from '../common/CompactRecordCards';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { useTableSchema } from '../../hooks/useTableSchema';
import { ESCALATIONS_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';

const escalationExportColumns: ExportColumnOption[] = [
  { id: 'dateOfIncident', label: 'Date of Incident' },
  { id: 'siteName', label: 'Site / Property' },
  { id: 'suName', label: 'Resident Name' },
  { id: 'suPortNassRef', label: 'Port / NASS Ref' },
  { id: 'personReporting', label: 'Submitted By' },
  { id: 'incidentType', label: 'Incident Type' },
  { id: 'urgency', label: 'Urgency / Risk' },
  { id: 'wlIssued', label: 'WL Issued' },
  { id: 'reportedAuthorities', label: 'Reported Authorities' },
  { id: 'status', label: 'Status' },
  { id: 'actionTaken', label: 'Action Taken' },
  { id: 'incidentNotes', label: 'Incident Notes' }
];

export const EscalationsView: React.FC = () => {
  const {
    escalations,
    allowedSites,
    addEscalation,
    updateEscalation,
    deleteEscalation,
    canDeleteRecord,
    canEditRecord,
    canAccessAllSites,
    assignedSite,
    settings,
    currentUserRole,
    currentUserName,
    authProfile,
    isMobileCompactView
  } = useApp();

  const loggedInUserName = authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || (currentUserRole ? `${currentUserRole} (User)` : 'Duty Lead Officer');

  // Table Schema Hook
  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<EscalationRecord>('escalations', ESCALATIONS_TABLE_COLUMNS);

  const [siteFilter, setSiteFilter] = useState<string>(canAccessAllSites() ? 'all' : assignedSite);
  const [wlFilter, setWlFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(settings.pageSize || 10);
  const [sortKey, setSortKey] = useState<string>('dateOfIncident');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EscalationRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<EscalationRecord | null>(null);

  // Helper getters to support both new and legacy field names
  const getDate = (e: EscalationRecord) => e.dateOfIncident || (e.dateTime ? e.dateTime.slice(0, 10) : '') || e.createdAt?.slice(0, 10) || '';
  const getRef = (e: EscalationRecord) => e.suPortNassRef || e.refNumber || '';
  const getSuName = (e: EscalationRecord) => e.suName || (e as any).residentName || (e as any).name || '';
  const getSiteName = (e: EscalationRecord) => e.siteName || e.site || '';
  const getPersonReporting = (e: EscalationRecord) => e.personReporting || e.reportedBy || (e as any).submittedBy || loggedInUserName;
  const getIncidentType = (e: EscalationRecord) => e.incidentType || e.incidentTitle || 'Safeguarding Incident';
  const getWlIssued = (e: EscalationRecord) => e.wlIssued || 'No';
  const getReportedAuthorities = (e: EscalationRecord) => e.reportedAuthorities || e.escalatedTo || 'Safeguarding Lead';
  const getIncidentNotes = (e: EscalationRecord) => e.incidentNotes || e.incidentSummary || (e as any).description || '';
  const getActionTaken = (e: EscalationRecord) => e.actionTaken || e.immediateAction || (e as any).resolutionNotes || '';

  const filteredData = useMemo(() => {
    return escalations.filter(e => {
      const eSite = getSiteName(e);
      const eWl = getWlIssued(e);
      const eStatus = e.status || 'Active';

      if (siteFilter !== 'all' && eSite !== siteFilter) return false;
      if (wlFilter !== 'all' && eWl !== wlFilter) return false;
      if (statusFilter !== 'all' && eStatus !== statusFilter) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fullText = [
          getSuName(e),
          getRef(e),
          eSite,
          getIncidentType(e),
          getIncidentNotes(e),
          getActionTaken(e),
          getReportedAuthorities(e),
          getPersonReporting(e)
        ].join(' ').toLowerCase();

        if (!fullText.includes(q)) return false;
      }
      return true;
    });
  }, [escalations, siteFilter, wlFilter, statusFilter, searchQuery]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a: any, b: any) => {
      let valA = a[sortKey] ?? '';
      let valB = b[sortKey] ?? '';
      if (sortKey === 'dateOfIncident') { valA = getDate(a); valB = getDate(b); }
      if (sortKey === 'suName') { valA = getSuName(a); valB = getSuName(b); }
      if (sortKey === 'siteName') { valA = getSiteName(a); valB = getSiteName(b); }

      return sortOrder === 'asc' 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredData, sortKey, sortOrder]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (field: string) => {
    if (sortKey === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(field);
      setSortOrder('asc');
    }
  };

  const handleCreateSubmit = (data: Partial<EscalationRecord>) => {
    const nowIso = new Date().toISOString();
    const suName = data.suName || '';
    const incidentType = data.incidentType || 'Safeguarding Concern';
    const site = !canAccessAllSites() 
      ? assignedSite 
      : (data.siteName || data.site || (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])));

    addEscalation({
      dateOfIncident: data.dateOfIncident || nowIso.slice(0, 10),
      suPortNassRef: data.suPortNassRef || '',
      suName,
      siteName: site,
      site,
      personReporting: data.personReporting || loggedInUserName,
      incidentType,
      incidentTitle: incidentType,
      wlIssued: data.wlIssued || 'No',
      reportedAuthorities: data.reportedAuthorities || 'Safeguarding Lead',
      incidentNotes: data.incidentNotes || '',
      incidentSummary: data.incidentNotes || '',
      actionTaken: data.actionTaken || '',
      immediateAction: data.actionTaken || '',
      status: (data.status as any) || 'Active',
      urgency: (data.urgency as any) || 'High',
      refNumber: data.suPortNassRef || '',
      dateTime: data.dateOfIncident || nowIso.slice(0, 10),
      reportedBy: data.personReporting || loggedInUserName,
      attachments: [],
      ...data
    } as any);

    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<EscalationRecord>) => {
    if (!editingRecord) return;
    const site = data.siteName || data.site || editingRecord.siteName || editingRecord.site;
    const incidentType = data.incidentType || editingRecord.incidentType || 'Safeguarding Incident';

    updateEscalation(editingRecord.id, {
      ...editingRecord,
      ...data,
      site,
      siteName: site,
      incidentTitle: incidentType,
      incidentType,
      refNumber: data.suPortNassRef || editingRecord.suPortNassRef,
      dateTime: data.dateOfIncident || editingRecord.dateOfIncident,
      reportedBy: data.personReporting || editingRecord.personReporting,
      incidentSummary: data.incidentNotes || editingRecord.incidentNotes,
      immediateAction: data.actionTaken || editingRecord.actionTaken
    });

    setEditingRecord(null);
  };

  // Export handlers
  const calculateDateRangeCount = (startDate: string, endDate: string): number => {
    return escalations.filter(e => {
      const d = getDate(e);
      return (!startDate || d >= startDate) && (!endDate || d <= endDate);
    }).length;
  };

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    let sourceData = escalations;
    if (scope === 'filtered') sourceData = sortedData;
    else if (scope === 'custom' && startDate && endDate) {
      sourceData = escalations.filter(e => {
        const d = getDate(e);
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      });
    }

    return sourceData.map(e => ({
      dateOfIncident: getDate(e),
      siteName: getSiteName(e),
      suName: getSuName(e),
      suPortNassRef: getRef(e),
      personReporting: getPersonReporting(e),
      incidentType: getIncidentType(e),
      urgency: e.urgency || 'High',
      wlIssued: getWlIssued(e),
      reportedAuthorities: getReportedAuthorities(e),
      status: e.status || 'Active',
      actionTaken: getActionTaken(e),
      incidentNotes: getIncidentNotes(e)
    }));
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
      ? escalationExportColumns.filter(c => selectedColumns.includes(c.id))
      : escalationExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => (row as any)[c.id] || ''));
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
      ? escalationExportColumns.filter(c => selectedColumns.includes(c.id))
      : escalationExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => (row as any)[c.id] || ''));

    if (format === 'csv') {
      exportTableToCsv({ filename: 'Safeguarding_Escalations_Log.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'Safeguarding_Escalations_Log.pdf',
        title: 'Safeguarding Escalations Log Report',
        headers,
        rows,
        orientation
      });
    }
  };

  const renderColumnCell = (col: TableColumnConfig<EscalationRecord>, item: EscalationRecord) => {
    if (col.renderCell) {
      return col.renderCell((item as any)[col.key], item);
    }

    let value = (item as any)[col.key];

    // Fallbacks for mapped attributes
    if (col.key === 'dateOfIncident') value = getDate(item);
    if (col.key === 'siteName') value = getSiteName(item);
    if (col.key === 'suName') value = getSuName(item);
    if (col.key === 'suPortNassRef') value = getRef(item);
    if (col.key === 'personReporting') value = getPersonReporting(item);
    if (col.key === 'incidentType') value = getIncidentType(item);
    if (col.key === 'wlIssued') value = getWlIssued(item);
    if (col.key === 'reportedAuthorities') value = getReportedAuthorities(item);
    if (col.key === 'incidentNotes') value = getIncidentNotes(item);
    if (col.key === 'actionTaken') value = getActionTaken(item);

    if (col.badgeColors && value) {
      const badgeClass = col.badgeColors[value] || 'bg-gray-100 text-gray-800';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-semibold ${badgeClass}`}>
          {value}
        </span>
      );
    }

    if (col.key === 'suName') {
      return <span className="font-semibold text-[#242424]">{value || '—'}</span>;
    }

    if (col.key === 'suPortNassRef') {
      return <span className="font-mono text-[#0f766e]">{value || '—'}</span>;
    }

    if (col.type === 'date') {
      return <span className="font-mono text-[#323130]">{value || '—'}</span>;
    }

    if (col.key === 'incidentNotes' || col.key === 'actionTaken') {
      return (
        <div className="max-w-xs truncate text-[#323130]" title={value}>
          {value || '—'}
        </div>
      );
    }

    if (value === null || value === undefined || value === '') {
      return <span className="text-[#a19f9d]">—</span>;
    }

    return String(value);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-[#a4262c]" />
            <h2 className="text-xl font-bold text-[#242424] tracking-tight">
              Safeguarding Escalations Log
            </h2>
            <span className="text-xs bg-red-100 text-[#a4262c] font-bold px-2 py-0.5 rounded">
              {sortedData.length} Records
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Log, track, and coordinate multi-agency safeguarding escalations across accommodation sites.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUserRole === 'Super Admin' && (
            <button
              type="button"
              onClick={() => setIsSchemaModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors"
              title="Super Admin: Customize table columns, headers, and fields"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#0078d4]" />
              <span>Customize Table</span>
            </button>
          )}

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#a4262c] hover:bg-[#8e2025] text-white rounded-xs shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Urgent Escalation</span>
          </button>

          <ExportDropdown
            moduleName="Escalations"
            totalRecordCount={escalations.length}
            filteredRecordCount={sortedData.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={escalationExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white border border-[#e1dfdd] p-3 rounded-xs flex flex-wrap items-end gap-3 text-xs shadow-xs">
        <div className="flex-1 min-w-[140px]">
          <label className="font-semibold text-[#605e5c] block mb-1">Site / Property</label>
          <select
            value={siteFilter}
            onChange={e => setSiteFilter(e.target.value)}
            disabled={!canAccessAllSites()}
            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
          >
            {canAccessAllSites() && <option value="all">All Sites ({allowedSites.length})</option>}
            {allowedSites.map((s, idx) => <option key={`${s}-${idx}`} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="w-40">
          <label className="font-semibold text-[#605e5c] block mb-1">WL Issued</label>
          <select
            value={wlFilter}
            onChange={e => setWlFilter(e.target.value)}
            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
          >
            <option value="all">All WL Statuses</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="Warning Letter Issued">Warning Letter Issued</option>
            <option value="Notice to Quit">Notice to Quit</option>
            <option value="N/A">N/A</option>
          </select>
        </div>

        <div className="w-44">
          <label className="font-semibold text-[#605e5c] block mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Under Investigation">Under Investigation</option>
            <option value="Awaiting Multi-Agency Review">Awaiting Review</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>

        <div className="flex-[2] min-w-[200px]">
          <label className="font-semibold text-[#605e5c] block mb-1">Search Escalations</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#605e5c] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search SU name, ref, site, incident notes, authorities..."
              className="w-full pl-8 pr-3 py-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
            />
          </div>
        </div>

        {(siteFilter !== 'all' || wlFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
          <button
            onClick={() => {
              setSiteFilter('all');
              setWlFilter('all');
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="text-xs text-[#a4262c] hover:underline font-semibold self-center"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Table Panel */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        {isMobileCompactView ? (
          <div className="p-3 bg-neutral-50/50 flex-1 overflow-y-auto">
            <CompactRecordList
              data={paginatedData}
              emptyMessage="No escalation records found matching current filters."
              renderCard={(item, idx) => {
                const canEdit = canEditRecord(getSiteName(item));
                const canDelete = canDeleteRecord();
                const srNo = (currentPage - 1) * pageSize + idx + 1;

                return (
                  <CompactRecordCard
                    key={item.id}
                    id={item.id}
                    srNo={srNo}
                    title={getSuName(item) || 'Critical Incident'}
                    subtitle={getRef(item) ? `Port/NASS Ref: ${getRef(item)}` : undefined}
                    site={getSiteName(item)}
                    statusBadge={renderColumnCell({ key: 'status' } as any, item)}
                    fields={[
                      { label: 'Incident Type', value: item.incidentType },
                      { label: 'Urgency', value: item.urgency },
                      { label: 'Date', value: getDate(item) },
                      { label: 'Reported By', value: item.personReporting }
                    ]}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onView={() => setViewRecord(item)}
                    onEdit={canEdit ? () => setEditingRecord(item) : undefined}
                    onDelete={canDelete ? () => {
                      if (window.confirm(`Are you sure you want to delete escalation for ${getSuName(item)}?`)) {
                        deleteEscalation(item.id);
                      }
                    } : undefined}
                  />
                );
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse min-w-[1250px]">
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
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-[#605e5c]">
                      <AlertOctagon className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                      <p className="font-semibold text-sm text-[#242424]">No escalation records found</p>
                      <p className="text-xs text-[#605e5c] mt-0.5">Click 'Log Urgent Escalation' to record a new critical safeguarding issue.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map(item => (
                    <tr key={item.id} className="hover:bg-[#f3f8fd] transition-colors">
                      {visibleColumns.map(col => (
                        <td key={String(col.key)} className="p-2.5">
                          {renderColumnCell(col, item)}
                        </td>
                      ))}
                      <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewRecord(item)}
                            className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs transition-colors"
                            title="View Escalation Dossier"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEditRecord(getSiteName(item)) && (
                            <button
                              onClick={() => setEditingRecord(item)}
                              className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs transition-colors"
                              title="Edit Escalation"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDeleteRecord() && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete escalation for ${getSuName(item)}?`)) {
                                  deleteEscalation(item.id);
                                }
                              }}
                              className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs transition-colors"
                              title="Delete Escalation"
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
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={sortedData.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {/* Dynamic Create Modal */}
      <DynamicRecordFormModal<EscalationRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Log Urgent Safeguarding Escalation"
        columns={columns}
        initialValues={{
          dateOfIncident: new Date().toISOString().slice(0, 10),
          suPortNassRef: '',
          suName: '',
          siteName: !canAccessAllSites() ? assignedSite : (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])),
          site: !canAccessAllSites() ? assignedSite : (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])),
          personReporting: loggedInUserName,
          incidentType: 'Safeguarding Concern',
          wlIssued: 'No',
          reportedAuthorities: 'Safeguarding Lead, Local Social Services',
          incidentNotes: '',
          actionTaken: '',
          status: 'Active',
          urgency: 'High'
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Log Escalation"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<EscalationRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Escalation - ${getSuName(editingRecord)}`}
          columns={columns}
          initialValues={{
            ...editingRecord,
            dateOfIncident: getDate(editingRecord),
            suName: getSuName(editingRecord),
            suPortNassRef: getRef(editingRecord),
            siteName: getSiteName(editingRecord),
            site: getSiteName(editingRecord),
            personReporting: getPersonReporting(editingRecord),
            incidentType: getIncidentType(editingRecord),
            wlIssued: getWlIssued(editingRecord),
            reportedAuthorities: getReportedAuthorities(editingRecord),
            incidentNotes: getIncidentNotes(editingRecord),
            actionTaken: getActionTaken(editingRecord)
          }}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Dossier Modal */}
      {viewRecord && (
        <DynamicRecordViewModal<EscalationRecord>
          isOpen={Boolean(viewRecord)}
          onClose={() => setViewRecord(null)}
          title={`Safeguarding Escalation Dossier - ${getSuName(viewRecord)}`}
          columns={columns}
          record={{
            ...viewRecord,
            dateOfIncident: getDate(viewRecord),
            suName: getSuName(viewRecord),
            suPortNassRef: getRef(viewRecord),
            siteName: getSiteName(viewRecord),
            site: getSiteName(viewRecord),
            personReporting: getPersonReporting(viewRecord),
            incidentType: getIncidentType(viewRecord),
            wlIssued: getWlIssued(viewRecord),
            reportedAuthorities: getReportedAuthorities(viewRecord),
            incidentNotes: getIncidentNotes(viewRecord),
            actionTaken: getActionTaken(viewRecord)
          }}
          onEdit={() => {
            const rec = viewRecord;
            setViewRecord(null);
            setEditingRecord(rec);
          }}
          canEdit={canEditRecord(getSiteName(viewRecord))}
        />
      )}

      {/* Super Admin Table Schema Customizer Modal */}
      <TableSchemaEditorModal<EscalationRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Safeguarding Escalations Log"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
