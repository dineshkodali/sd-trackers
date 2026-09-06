import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  AlertOctagon, 
  Plus, 
  Trash2, 
  Eye, 
  Download, 
  X,
  Edit2,
  FileText,
  Building2,
  User,
  Shield,
  Search,
  Filter,
  Paperclip,
  Save,
  RotateCcw,
  Lock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EscalationRecord, RiskLevel, RecordAttachment } from '../../types';
import { Pagination } from '../common/Pagination';
import { AttachmentsSection } from '../common/AttachmentsSection';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { saveFormDraft, loadFormDraft, clearFormDraft, formatDraftTime } from '../../utils/autoSave';

const DRAFT_KEY_ESCALATION_CREATE = 'escalations_view_create';

const escalationExportColumns: ExportColumnOption[] = [
  { id: 'date', label: 'Date of Incident' },
  { id: 'site', label: 'Site / Property' },
  { id: 'suName', label: 'Resident Name' },
  { id: 'ref', label: 'Port / NASS Ref' },
  { id: 'personReporting', label: 'Submitted By' },
  { id: 'incidentType', label: 'Incident Type' },
  { id: 'urgency', label: 'Urgency / Risk' },
  { id: 'wlIssued', label: 'WL Issued' },
  { id: 'authorities', label: 'Reported Authorities' },
  { id: 'status', label: 'Status' },
  { id: 'actionTaken', label: 'Action Taken' },
  { id: 'notes', label: 'Incident Notes' }
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
    getFieldOptions,
    currentUserName,
    authProfile
  } = useApp();

  const loggedInUserName = authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || (currentUserRole ? `${currentUserRole} (User)` : 'Duty Lead Officer');

  const incidentTypeOptions = useMemo(() => getFieldOptions('incidentTypes'), [getFieldOptions]);
  const escalationAuthorityOptions = useMemo(() => getFieldOptions('escalationAuthorities'), [getFieldOptions]);
  const escalationStatusOptions = useMemo(() => getFieldOptions('escalationStatuses'), [getFieldOptions]);

  const [siteFilter, setSiteFilter] = useState<string>(canAccessAllSites() ? 'all' : assignedSite);
  const [wlFilter, setWlFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(settings.pageSize || 10);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EscalationRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<EscalationRecord | null>(null);

  // Helper getters to support both new and legacy field names (defaults to empty string instead of dummy dash)
  const getDate = (e: EscalationRecord) => e.dateOfIncident || (e.dateTime ? e.dateTime.slice(0, 10) : '') || e.createdAt?.slice(0, 10) || '';
  const getRef = (e: EscalationRecord) => e.suPortNassRef || e.refNumber || '';
  const getSuName = (e: EscalationRecord) => e.suName || (e as any).residentName || (e as any).name || '';
  const getSiteName = (e: EscalationRecord) => e.siteName || e.site || '';
  const getPersonReporting = (e: EscalationRecord) => {
    const rep = e.personReporting || e.reportedBy || (e as any).submittedBy;
    if (!rep || rep === 'Duty Lead' || rep === 'Duty Lead Officer' || rep === 'Duty Worker') {
      return loggedInUserName;
    }
    return rep;
  };
  const getIncidentType = (e: EscalationRecord) => e.incidentType || e.incidentTitle || 'Safeguarding Incident';
  const getWlIssued = (e: EscalationRecord) => e.wlIssued || 'No';
  const getReportedAuthorities = (e: EscalationRecord) => e.reportedAuthorities || e.escalatedTo || 'Safeguarding Lead';
  const getIncidentNotes = (e: EscalationRecord) => e.incidentNotes || e.incidentSummary || (e as any).description || '';
  const getActionTaken = (e: EscalationRecord) => e.actionTaken || e.immediateAction || (e as any).resolutionNotes || '';

  const initialFormData = {
    dateOfIncident: new Date().toISOString().slice(0, 10),
    suPortNassRef: '',
    suName: '',
    siteName: allowedSites[0] || 'Brit Hotel',
    site: allowedSites[0] || 'Brit Hotel',
    personReporting: loggedInUserName,
    incidentType: 'Safeguarding Concern',
    wlIssued: 'No' as EscalationRecord['wlIssued'],
    reportedAuthorities: 'Safeguarding Lead, Local Social Services',
    incidentNotes: '',
    actionTaken: '',
    status: 'Active' as EscalationRecord['status'],
    urgency: 'High' as RiskLevel,
    attachments: [] as RecordAttachment[]
  };

  const [formData, setFormData] = useState(initialFormData);

  // Auto-save state for Create Escalation modal
  const [createDraftRestoredAt, setCreateDraftRestoredAt] = useState<string | null>(null);
  const [createLastSavedTime, setCreateLastSavedTime] = useState<string | null>(null);
  const isCreateInitializedRef = useRef<boolean>(false);

  // Restore create draft when Create Modal opens
  useEffect(() => {
    if (isCreateModalOpen) {
      isCreateInitializedRef.current = false;
      const draft = loadFormDraft<typeof formData>(DRAFT_KEY_ESCALATION_CREATE);
      if (draft && draft.data) {
        const d = draft.data;
        const hasContent = Boolean(
          (d.suName && d.suName.trim()) ||
          (d.incidentNotes && d.incidentNotes.trim()) ||
          (d.actionTaken && d.actionTaken.trim()) ||
          (d.suPortNassRef && d.suPortNassRef.trim()) ||
          (d.incidentType && d.incidentType !== 'Safeguarding Concern')
        );

        if (hasContent) {
          setFormData(prev => ({
            ...prev,
            ...d
          }));
          setCreateDraftRestoredAt(draft.savedAt);
          setCreateLastSavedTime(formatDraftTime(draft.savedAt));
        }
      }
      setTimeout(() => {
        isCreateInitializedRef.current = true;
      }, 100);
    } else {
      setCreateDraftRestoredAt(null);
    }
  }, [isCreateModalOpen]);

  // Auto-save create form when inputs change
  useEffect(() => {
    if (!isCreateModalOpen || !isCreateInitializedRef.current) return;

    const hasContent = Boolean(
      formData.suName.trim() ||
      formData.incidentNotes.trim() ||
      formData.actionTaken.trim() ||
      formData.suPortNassRef.trim()
    );

    if (hasContent) {
      saveFormDraft(DRAFT_KEY_ESCALATION_CREATE, formData);
      setCreateLastSavedTime(formatDraftTime(new Date().toISOString()));
    }
  }, [isCreateModalOpen, formData]);

  const handleDiscardCreateDraft = () => {
    clearFormDraft(DRAFT_KEY_ESCALATION_CREATE);
    setFormData(initialFormData);
    setCreateDraftRestoredAt(null);
    setCreateLastSavedTime(null);
  };

  const filteredData = useMemo(() => {
    return escalations.filter(e => {
      const site = getSiteName(e);
      if (siteFilter !== 'all' && site !== siteFilter && e.site !== siteFilter) return false;
      if (wlFilter !== 'all' && getWlIssued(e) !== wlFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const str = `${getSuName(e)} ${getRef(e)} ${getSiteName(e)} ${getPersonReporting(e)} ${getIncidentType(e)} ${getReportedAuthorities(e)} ${getIncidentNotes(e)} ${getActionTaken(e)}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [escalations, siteFilter, wlFilter, statusFilter, searchQuery]);

  // Sort State
  const [sortField, setSortField] = useState<string>('dateOfIncident');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getSortValue = (item: EscalationRecord, field: string): any => {
    switch (field) {
      case 'dateOfIncident': return getDate(item);
      case 'suPortNassRef': return getRef(item);
      case 'suName': return getSuName(item);
      case 'site': return getSiteName(item);
      case 'personReporting': return getPersonReporting(item);
      case 'incidentType': return getIncidentType(item);
      case 'wlIssued': return getWlIssued(item);
      case 'status': return item.status || 'Active';
      case 'reportedAuthorities': return getReportedAuthorities(item);
      case 'incidentNotes': return getIncidentNotes(item);
      case 'actionTaken': return getActionTaken(item);
      default: return (item as any)[field] ?? '';
    }
  };

  // Sort filtered dataset
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA: any = getSortValue(a, sortField);
      let valB: any = getSortValue(b, sortField);
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

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    if (scope === 'filtered') return sortedData;
    if (scope === 'custom' && startDate && endDate) {
      return escalations.filter(e => {
        const d = getDate(e);
        return d >= startDate && d <= endDate;
      });
    }
    return escalations;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (e: EscalationRecord) => string | number }> => ({
    date: { label: 'Date of Incident', getValue: e => getDate(e) },
    site: { label: 'Site / Property', getValue: e => getSiteName(e) },
    suName: { label: 'Resident Name', getValue: e => getSuName(e) },
    ref: { label: 'Port / NASS Ref', getValue: e => getRef(e) },
    personReporting: { label: 'Submitted By', getValue: e => getPersonReporting(e) },
    incidentType: { label: 'Incident Type', getValue: e => getIncidentType(e) },
    urgency: { label: 'Urgency / Risk', getValue: e => e.urgency || 'High' },
    wlIssued: { label: 'WL Issued', getValue: e => getWlIssued(e) },
    authorities: { label: 'Reported Authorities', getValue: e => getReportedAuthorities(e) },
    status: { label: 'Status', getValue: e => e.status },
    actionTaken: { label: 'Action Taken', getValue: e => getActionTaken(e) },
    notes: { label: 'Incident Notes', getValue: e => getIncidentNotes(e) }
  });

  const getExportPreviewData = ({
    scope,
    startDate,
    endDate,
    selectedColumns,
    orientation,
    isCompact
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
      : escalationExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(e => activeCols.map(c => colMap[c].getValue(e)));
    return { headers, rows };
  };

  const handlePerformExport = ({
    format,
    scope,
    orientation = 'landscape',
    startDate,
    endDate,
    selectedColumns,
    isCompact = false
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
      : escalationExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(e => activeCols.map(c => colMap[c].getValue(e)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `Safeguarding-Escalations-${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: 'Safeguarding Escalation Log & Multi-Agency Register',
        subtitle: 'Critical incidents, urgent safeguarding notifications, and multi-agency actions.',
        filename: `Safeguarding-Escalations-${scope}-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        orientation,
        isCompact,
        metadata: [
          { label: 'Site Scope', value: siteFilter === 'all' ? 'All Permitted Sites' : siteFilter },
          { label: 'Export Scope', value: scope === 'all' ? 'All Records' : scope === 'filtered' ? 'Current Filtered View' : `${startDate} to ${endDate}` },
          { label: 'Layout Orientation', value: orientation },
          { label: 'Total Escalations', value: dataToExport.length }
        ]
      });
    }
  };

  const calculateDateRangeCount = (start: string, end: string) => {
    return escalations.filter(e => {
      const d = getDate(e);
      return d >= start && d <= end;
    }).length;
  };

  const handleOpenCreate = () => {
    setFormData({
      ...initialFormData,
      personReporting: loggedInUserName,
      siteName: allowedSites[0] || 'Brit Hotel',
      site: allowedSites[0] || 'Brit Hotel'
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (esc: EscalationRecord) => {
    setEditingRecord(esc);
    const rep = getPersonReporting(esc);
    setFormData({
      dateOfIncident: getDate(esc),
      suPortNassRef: getRef(esc),
      suName: getSuName(esc),
      siteName: getSiteName(esc),
      site: getSiteName(esc),
      personReporting: rep,
      incidentType: getIncidentType(esc),
      wlIssued: getWlIssued(esc),
      reportedAuthorities: getReportedAuthorities(esc),
      incidentNotes: getIncidentNotes(esc),
      actionTaken: getActionTaken(esc),
      status: esc.status,
      urgency: esc.urgency || 'High',
      attachments: esc.attachments || []
    });
  };

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.suName || !formData.incidentNotes) {
      alert('SU Name and Incident Notes are required.');
      return;
    }
    addEscalation({
      ...formData,
      site: formData.siteName,
      incidentTitle: formData.incidentType,
      refNumber: formData.suPortNassRef,
      dateTime: formData.dateOfIncident,
      reportedBy: formData.personReporting,
      incidentSummary: formData.incidentNotes,
      immediateAction: formData.actionTaken,
      escalatedTo: formData.reportedAuthorities as any
    });
    clearFormDraft(DRAFT_KEY_ESCALATION_CREATE);
    setCreateDraftRestoredAt(null);
    setCreateLastSavedTime(null);
    setIsCreateModalOpen(false);
    setFormData(initialFormData);
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !formData.suName || !formData.incidentNotes) return;
    updateEscalation(editingRecord.id, {
      ...formData,
      site: formData.siteName,
      incidentTitle: formData.incidentType,
      refNumber: formData.suPortNassRef,
      dateTime: formData.dateOfIncident,
      reportedBy: formData.personReporting,
      incidentSummary: formData.incidentNotes,
      immediateAction: formData.actionTaken,
      escalatedTo: formData.reportedAuthorities as any
    });
    setEditingRecord(null);
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
          <button
            onClick={handleOpenCreate}
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

        <button
          onClick={() => {
            setSiteFilter(canAccessAllSites() ? 'all' : assignedSite);
            setWlFilter('all');
            setStatusFilter('all');
            setSearchQuery('');
          }}
          className="px-3 py-2 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold"
        >
          Reset
        </button>
      </div>

      {/* Escalations Table with exact requested headers:
          Date Of Incident | SU Port / Nass Ref | SU Name | Site Name | Person Reporting | Incident Type | WL Issued | Reported Authorities | Incident Notes | Action Taken */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th onClick={() => handleSort('dateOfIncident')} className="p-2.5 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Date Of Incident">
                  <div className="flex items-center gap-1">
                    <span>Date Of Incident</span>
                    {sortField === 'dateOfIncident' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('suPortNassRef')} className="p-2.5 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Port / Nass Ref">
                  <div className="flex items-center gap-1">
                    <span>SU Port / Nass Ref</span>
                    {sortField === 'suPortNassRef' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('suName')} className="p-2.5 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Resident Name">
                  <div className="flex items-center gap-1">
                    <span>SU Name</span>
                    {sortField === 'suName' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('site')} className="p-2.5 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Site Name">
                  <div className="flex items-center gap-1">
                    <span>Site Name</span>
                    {sortField === 'site' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('personReporting')} className="p-2.5 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Submitted By">
                  <div className="flex items-center gap-1">
                    <span>Submitted By</span>
                    {sortField === 'personReporting' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('incidentType')} className="p-2.5 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Incident Type">
                  <div className="flex items-center gap-1">
                    <span>Incident Type</span>
                    {sortField === 'incidentType' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('wlIssued')} className="p-2.5 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by WL Issued">
                  <div className="flex items-center gap-1">
                    <span>WL Issued</span>
                    {sortField === 'wlIssued' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('status')} className="p-2.5 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Status">
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    {sortField === 'status' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('reportedAuthorities')} className="p-2.5 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Reported Authorities">
                  <div className="flex items-center gap-1">
                    <span>Reported Authorities</span>
                    {sortField === 'reportedAuthorities' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th className="p-2.5 min-w-[220px]">Incident Notes</th>
                <th className="p-2.5 min-w-[220px]">Action Taken</th>
                <th className="p-2.5 text-right whitespace-nowrap w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-[#605e5c]">
                    No escalations recorded matching criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map(esc => {
                  const canEdit = canEditRecord(esc.site);
                  const canDelete = canDeleteRecord();
                  const wl = getWlIssued(esc);

                  return (
                    <tr key={esc.id} className="hover:bg-[#f9fafb] transition-colors">
                      {/* 1. Date Of Incident */}
                      <td className="p-2.5 text-[#242424] font-medium whitespace-nowrap">
                        {getDate(esc)}
                      </td>

                      {/* 2. SU Port / Nass Ref */}
                      <td className="p-2.5 font-mono text-neutral-600 whitespace-nowrap font-medium">
                        {getRef(esc)}
                      </td>

                      {/* 3. SU Name */}
                      <td className="p-2.5 font-semibold text-[#0f766e]">
                        <button 
                          onClick={() => setViewRecord(esc)} 
                          className="hover:underline text-left flex items-center gap-1.5"
                        >
                          <span>{getSuName(esc)}</span>
                          {esc.attachments && esc.attachments.length > 0 && (
                            <Paperclip className="w-3 h-3 text-[#0d9488]" title={`${esc.attachments.length} attachment(s)`} />
                          )}
                        </button>
                      </td>

                      {/* 4. Site Name */}
                      <td className="p-2.5 text-[#242424] font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-[#0d9488] shrink-0" />
                          <span>{getSiteName(esc)}</span>
                        </div>
                      </td>

                      {/* 5. Person Reporting */}
                      <td className="p-2.5 text-[#323130] whitespace-nowrap">
                        {getPersonReporting(esc)}
                      </td>

                      {/* 6. Incident Type */}
                      <td className="p-2.5">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-800 border border-red-200">
                          {getIncidentType(esc)}
                        </span>
                      </td>

                      {/* 7. WL Issued */}
                      <td className="p-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          wl === 'Warning Letter Issued' || wl === 'Yes'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : wl === 'Notice to Quit'
                            ? 'bg-red-200 text-red-900 border border-red-300'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {wl}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-2.5 whitespace-nowrap">
                        {canEdit ? (
                          <select
                            value={esc.status || 'Active'}
                            onChange={e => updateEscalation(esc.id, { status: e.target.value as any })}
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0078d4] ${
                              esc.status === 'Open' || esc.status === 'Active' ? 'bg-[#fde7e9] text-[#a80000] border-[#f8bcc1]' :
                              esc.status === 'Under Investigation' ? 'bg-[#fff4ce] text-[#7f6000] border-[#ffe788]' :
                              esc.status === 'Action Taken' ? 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]' :
                              esc.status === 'Escalated to Police' ? 'bg-[#f0eafd] text-[#5c2d91] border-[#dcd0f9]' :
                              esc.status === 'Resolved' ? 'bg-[#e8f5e9] text-[#107c10] border-[#c8e6c9]' :
                              'bg-neutral-100 text-neutral-700 border-neutral-300'
                            }`}
                            title="Click to update escalation status"
                          >
                            {escalationStatusOptions.map(opt => (
                              <option key={opt.id} value={opt.value} className="bg-white text-neutral-900 font-normal">
                                {opt.label}
                              </option>
                            ))}
                            {!escalationStatusOptions.some(o => o.value === (esc.status || 'Active')) && (
                              <option value={esc.status || 'Active'} className="bg-white text-neutral-900 font-normal">
                                {esc.status || 'Active'}
                              </option>
                            )}
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded ${
                            esc.status === 'Open' || esc.status === 'Active' ? 'bg-[#fde7e9] text-[#a80000]' :
                            esc.status === 'Under Investigation' ? 'bg-[#fff4ce] text-[#7f6000]' :
                            esc.status === 'Action Taken' ? 'bg-[#f0fdfa] text-[#0f766e]' :
                            esc.status === 'Escalated to Police' ? 'bg-[#f0eafd] text-[#5c2d91]' :
                            esc.status === 'Resolved' ? 'bg-[#e8f5e9] text-[#107c10]' :
                            'bg-neutral-100 text-neutral-700'
                          }`}>
                            {esc.status || 'Active'}
                          </span>
                        )}
                      </td>

                      {/* 8. Reported Authorities */}
                      <td className="p-2.5 text-[#323130] max-w-[160px] truncate" title={getReportedAuthorities(esc)}>
                        {getReportedAuthorities(esc)}
                      </td>

                      {/* 9. Incident Notes */}
                      <td className="p-2.5 text-neutral-600 max-w-[240px] truncate" title={getIncidentNotes(esc)}>
                        {getIncidentNotes(esc)}
                      </td>

                      {/* 10. Action Taken */}
                      <td className="p-2.5 text-neutral-600 max-w-[240px] truncate" title={getActionTaken(esc)}>
                        {getActionTaken(esc)}
                      </td>

                      {/* Actions */}
                      <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewRecord(esc)}
                            className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#edebe9] rounded"
                            title="View Full Escalation"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEdit(esc)}
                              className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#edebe9] rounded"
                              title="Edit Escalation"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => deleteEscalation(esc.id)}
                              className="p-1 text-neutral-400 hover:text-[#a4262c] hover:bg-red-50 rounded"
                              title="Delete Escalation"
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
          totalItems={sortedData.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* CREATE ESCALATION MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#edebe9] pb-3">
              <h3 className="text-base font-bold text-[#a4262c] flex items-center gap-2">
                <AlertOctagon className="w-5 h-5" />
                Submit Safeguarding Escalation
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNew} className="space-y-4">
              {/* Draft Restored Banner */}
              {createDraftRestoredAt && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xs flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      <strong>Unsaved escalation draft restored</strong> (auto-saved {formatDraftTime(createDraftRestoredAt)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDiscardCreateDraft}
                    className="px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:text-red-700 hover:bg-amber-100 rounded border border-amber-400 transition-colors"
                  >
                    Discard Draft
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">Date Of Incident *</label>
                  <input
                    type="date"
                    value={formData.dateOfIncident}
                    onChange={e => setFormData({ ...formData, dateOfIncident: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">Site Name *</label>
                  <select
                    value={formData.siteName}
                    onChange={e => setFormData({ ...formData, siteName: e.target.value, site: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {allowedSites.map((s, idx) => <option key={`${s}-${idx}`} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">SU Name *</label>
                  <input
                    type="text"
                    value={formData.suName}
                    onChange={e => setFormData({ ...formData, suName: e.target.value })}
                    placeholder="e.g. Mariam Diallo"
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">SU Port / Nass Ref</label>
                  <input
                    type="text"
                    value={formData.suPortNassRef}
                    onChange={e => setFormData({ ...formData, suPortNassRef: e.target.value })}
                    placeholder="e.g. NASS-882104 / PORT-99014"
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#323130] mb-1 flex items-center justify-between">
                    <span>Submitted By *</span>
                    <span className="text-[10px] text-neutral-500 font-normal flex items-center gap-1">
                      <Lock className="w-3 h-3 text-neutral-400" /> Logged-in User (Locked)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.personReporting || loggedInUserName}
                      readOnly
                      className="w-full p-2 pr-8 border border-[#d2d0ce] rounded-xs bg-[#f8fafc] text-[#323130] font-medium cursor-not-allowed"
                      title="Submitted by is locked to the authenticated user for operational accountability."
                      required
                    />
                    <Lock className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">Incident Type *</label>
                  <input
                    type="text"
                    list="esc-create-incident-types"
                    value={formData.incidentType}
                    onChange={e => setFormData({ ...formData, incidentType: e.target.value })}
                    placeholder="e.g. Medical Emergency, Missing Person, Aggression"
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    required
                  />
                  <datalist id="esc-create-incident-types">
                    {incidentTypeOptions.map(opt => (
                      <option key={opt.id} value={opt.value} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">WL Issued *</label>
                  <select
                    value={formData.wlIssued}
                    onChange={e => setFormData({ ...formData, wlIssued: e.target.value as any })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                    <option value="Warning Letter Issued">Warning Letter Issued</option>
                    <option value="Notice to Quit">Notice to Quit</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">Status</label>
                  <select
                    value={formData.status || 'Active'}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {escalationStatusOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!escalationStatusOptions.some(o => o.value === (formData.status || 'Active')) && (
                      <option value={formData.status || 'Active'}>{formData.status || 'Active'}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">Reported Authorities</label>
                  <input
                    type="text"
                    list="esc-create-authorities"
                    value={formData.reportedAuthorities}
                    onChange={e => setFormData({ ...formData, reportedAuthorities: e.target.value })}
                    placeholder="e.g. Police (999/101), Social Services, Ambulance"
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                  <datalist id="esc-create-authorities">
                    {escalationAuthorityOptions.map(opt => (
                      <option key={opt.id} value={opt.value} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#323130] block mb-1">Incident Notes *</label>
                <textarea
                  rows={3}
                  value={formData.incidentNotes}
                  onChange={e => setFormData({ ...formData, incidentNotes: e.target.value })}
                  placeholder="Comprehensive notes describing the incident chronologically, risk flags, and statements..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-[#323130] block mb-1">Action Taken</label>
                <textarea
                  rows={2}
                  value={formData.actionTaken}
                  onChange={e => setFormData({ ...formData, actionTaken: e.target.value })}
                  placeholder="Immediate de-escalation actions, safeguarding interventions deployed, and current safety status..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                />
              </div>

              {/* Attachments Section */}
              <div className="pt-2 border-t border-[#edebe9]">
                <AttachmentsSection
                  attachments={formData.attachments}
                  onChange={newAtts => setFormData({ ...formData, attachments: newAtts })}
                  title="Supporting Incident Evidence & Files"
                  entityName="Escalation Incident"
                />
              </div>

              <div className="pt-3 border-t border-[#edebe9] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                  <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                    <Save className="w-3 h-3 text-emerald-600" />
                    {createLastSavedTime ? `Auto-saved at ${createLastSavedTime}` : 'Auto-save active'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#a4262c] hover:bg-[#8e2025] text-white rounded-xs font-semibold shadow-xs"
                  >
                    Submit Escalation
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ESCALATION MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#edebe9] pb-3">
              <h3 className="text-base font-bold text-[#0d9488] flex items-center gap-2">
                <Edit2 className="w-5 h-5" />
                Edit Escalation: {getSuName(editingRecord)}
              </h3>
              <button onClick={() => setEditingRecord(null)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">Date Of Incident *</label>
                  <input
                    type="date"
                    value={formData.dateOfIncident}
                    onChange={e => setFormData({ ...formData, dateOfIncident: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">Site Name *</label>
                  <select
                    value={formData.siteName}
                    onChange={e => setFormData({ ...formData, siteName: e.target.value, site: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {allowedSites.map((s, idx) => <option key={`${s}-${idx}`} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">SU Name *</label>
                  <input
                    type="text"
                    value={formData.suName}
                    onChange={e => setFormData({ ...formData, suName: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">SU Port / Nass Ref</label>
                  <input
                    type="text"
                    value={formData.suPortNassRef}
                    onChange={e => setFormData({ ...formData, suPortNassRef: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#323130] mb-1 flex items-center justify-between">
                    <span>Submitted By *</span>
                    <span className="text-[10px] text-neutral-500 font-normal flex items-center gap-1">
                      <Lock className="w-3 h-3 text-neutral-400" /> Original Submitter (Locked)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.personReporting || loggedInUserName}
                      readOnly
                      className="w-full p-2 pr-8 border border-[#d2d0ce] rounded-xs bg-[#f8fafc] text-[#323130] font-medium cursor-not-allowed"
                      title="Submitted by is locked to prevent modifying the original reporter."
                      required
                    />
                    <Lock className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">Incident Type *</label>
                  <input
                    type="text"
                    list="esc-edit-incident-types"
                    value={formData.incidentType}
                    onChange={e => setFormData({ ...formData, incidentType: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    required
                  />
                  <datalist id="esc-edit-incident-types">
                    {incidentTypeOptions.map(opt => (
                      <option key={opt.id} value={opt.value} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">WL Issued</label>
                  <select
                    value={formData.wlIssued}
                    onChange={e => setFormData({ ...formData, wlIssued: e.target.value as any })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                    <option value="Warning Letter Issued">Warning Letter Issued</option>
                    <option value="Notice to Quit">Notice to Quit</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">Status</label>
                  <select
                    value={formData.status || 'Active'}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    {escalationStatusOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!escalationStatusOptions.some(o => o.value === (formData.status || 'Active')) && (
                      <option value={formData.status || 'Active'}>{formData.status || 'Active'}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#323130] block mb-1">Reported Authorities</label>
                  <input
                    type="text"
                    list="esc-edit-authorities"
                    value={formData.reportedAuthorities}
                    onChange={e => setFormData({ ...formData, reportedAuthorities: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  />
                  <datalist id="esc-edit-authorities">
                    {escalationAuthorityOptions.map(opt => (
                      <option key={opt.id} value={opt.value} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#323130] block mb-1">Incident Notes *</label>
                <textarea
                  rows={3}
                  value={formData.incidentNotes}
                  onChange={e => setFormData({ ...formData, incidentNotes: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-[#323130] block mb-1">Action Taken</label>
                <textarea
                  rows={2}
                  value={formData.actionTaken}
                  onChange={e => setFormData({ ...formData, actionTaken: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#323130] block mb-1">Resolution Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                >
                  <option value="Active">Active</option>
                  <option value="Under Investigation">Under Investigation</option>
                  <option value="Awaiting Multi-Agency Review">Awaiting Multi-Agency Review</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              {/* Attachments Section */}
              <div className="pt-2 border-t border-[#edebe9]">
                <AttachmentsSection
                  attachments={formData.attachments}
                  onChange={newAtts => setFormData({ ...formData, attachments: newAtts })}
                  title="Supporting Incident Evidence & Files"
                  entityName="Escalation Incident"
                />
              </div>

              <div className="pt-3 border-t border-[#edebe9] flex justify-end gap-2">
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

      {/* VIEW ESCALATION MODAL */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#edebe9] pb-3">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-[#a4262c]" />
                <h3 className="text-base font-bold text-[#242424]">
                  Escalation Detail: {getSuName(viewRecord)}
                </h3>
              </div>
              <button onClick={() => setViewRecord(null)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Header Details Grid - Complete Case Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#faf9f8] p-3.5 rounded-xs border border-[#edebe9]">
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Date Of Incident</span>
                  <strong className="text-[#242424]">{getDate(viewRecord)}</strong>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">SU Full Name</span>
                  <strong className="text-[#242424]">{getSuName(viewRecord) || '—'}</strong>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">SU Port / Nass Ref</span>
                  <strong className="font-mono text-[#0d9488]">{getRef(viewRecord) || '—'}</strong>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Site Location</span>
                  <strong className="text-[#242424]">{getSiteName(viewRecord)}</strong>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Submitted By</span>
                  <span className="text-[#242424] font-medium">{getPersonReporting(viewRecord)}</span>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Incident Type</span>
                  <span className="font-semibold text-red-700">{getIncidentType(viewRecord)}</span>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Urgency / Risk</span>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    viewRecord.urgency === 'Critical' ? 'bg-red-100 text-red-800' :
                    viewRecord.urgency === 'High' ? 'bg-amber-100 text-amber-800' :
                    viewRecord.urgency === 'Medium' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {viewRecord.urgency || 'High'}
                  </span>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Status</span>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-800">
                    {viewRecord.status || 'Active'}
                  </span>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Warning Letter Issued</span>
                  <span className="font-bold text-neutral-800">{getWlIssued(viewRecord)}</span>
                </div>
                {viewRecord.createdAt && (
                  <div>
                    <span className="text-[#605e5c] font-semibold block mb-0.5">Reported / Registered</span>
                    <span className="text-neutral-600 font-mono text-[11px]">{new Date(viewRecord.createdAt).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold block mb-1">Reported Authorities:</span>
                <div className="p-2.5 bg-[#f7f8fa] border border-[#edebe9] rounded-xs font-medium text-[#242424]">
                  {getReportedAuthorities(viewRecord)}
                </div>
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold block mb-1">Incident Notes:</span>
                <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed text-[#242424] whitespace-pre-wrap">
                  {getIncidentNotes(viewRecord)}
                </div>
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold block mb-1">Action Taken:</span>
                <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed text-[#242424] whitespace-pre-wrap">
                  {getActionTaken(viewRecord)}
                </div>
              </div>

              {/* Attachments Section in View Mode */}
              <div className="pt-2 border-t border-[#edebe9]">
                <AttachmentsSection
                  attachments={viewRecord.attachments || []}
                  readOnly={true}
                  title="Attached Proof Documents & Files"
                  entityName="Escalation Incident"
                />
              </div>

              <div className="pt-3 border-t border-[#edebe9] flex justify-end gap-2">
                {canEditRecord(viewRecord.site) && (
                  <button
                    type="button"
                    onClick={() => {
                      const rec = viewRecord;
                      setViewRecord(null);
                      handleOpenEdit(rec);
                    }}
                    className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold rounded-xs shadow-xs"
                  >
                    Edit Record
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewRecord(null)}
                  className="px-4 py-1.5 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
