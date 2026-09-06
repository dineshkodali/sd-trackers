import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Wrench, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  Search, 
  Filter, 
  X, 
  ShieldAlert, 
  Building2, 
  BookOpen, 
  Info,
  ChevronDown,
  ChevronUp,
  Flame,
  Droplets,
  Zap,
  Hammer,
  FileText,
  Save,
  RotateCcw,
  Lock,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MaintenanceRecord, MaintenancePriority, DefectStatus, MaintenanceAction } from '../../types';
import { MAINTENANCE_CRITERIA_LIST, MaintenanceCriteria } from '../../data/maintenanceCriteria';
import { Pagination } from '../common/Pagination';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { saveFormDraft, loadFormDraft, clearFormDraft, formatDraftTime } from '../../utils/autoSave';

const DRAFT_KEY_MAINTENANCE_CREATE = 'maintenance_tracker_create';
const getDraftKeyMaintenanceEdit = (id: string) => `maintenance_tracker_edit_${id}`;

const maintenanceExportColumns: ExportColumnOption[] = [
  { id: 'date', label: 'Report Date' },
  { id: 'priority', label: 'Priority Category' },
  { id: 'priorityTimeScale', label: 'Timescale' },
  { id: 'location', label: 'Location' },
  { id: 'site', label: 'Hotel / Site' },
  { id: 'room', label: 'Room / Unit' },
  { id: 'criteriaCode', label: 'HO Criteria Code' },
  { id: 'description', label: 'Defect Description' },
  { id: 'raisedBy', label: 'Raised By' },
  { id: 'closeDueDate', label: 'Close Due Date' },
  { id: 'defectStatus', label: 'Defect Status' },
  { id: 'action', label: 'Action' },
  { id: 'progress', label: 'Progress Details' },
  { id: 'actualClosedDate', label: 'Actual Closed Date' },
  { id: 'notes', label: 'Notes' }
];

export const MaintenanceTrackerView: React.FC = () => {
  const {
    maintenanceRecords,
    addMaintenanceRecord,
    updateMaintenanceRecord,
    deleteMaintenanceRecord,
    allowedSites,
    canAccessAllSites,
    assignedSite,
    canEditRecord,
    canDeleteRecord,
    canCreateRecord,
    sites,
    getFieldOptions,
    globalSearchFilter,
    setGlobalSearchFilter,
    currentUserName,
    currentUserRole,
    authProfile
  } = useApp();

  const loggedInUserName = authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || (currentUserRole ? `${currentUserRole} (User)` : 'Duty Officer');

  const getRaisedBy = (r: MaintenanceRecord) => {
    const rep = r.raisedBy || (r as any).reportedBy;
    if (!rep || rep === 'Site Duty Officer' || rep === 'Duty Worker' || rep === 'Duty Lead Officer' || rep === 'Duty Lead') {
      return loggedInUserName;
    }
    return rep;
  };

  const priorityOptions = useMemo(() => getFieldOptions('maintenancePriorities'), [getFieldOptions]);
  const timeScaleOptions = useMemo(() => getFieldOptions('maintenanceTimeScales'), [getFieldOptions]);

  // Filters
  const [siteFilter, setSiteFilter] = useState<string>(canAccessAllSites() ? 'all' : assignedSite);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
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

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<MaintenanceRecord | null>(null);
  const [isCriteriaGuideOpen, setIsCriteriaGuideOpen] = useState(false);
  const [selectedCriteriaSection, setSelectedCriteriaSection] = useState<string>('all');

  // Form state for new ticket
  const initialFormState = {
    site: allowedSites[0] || 'Brit Hotel',
    room: '',
    location: '',
    criteriaCode: '',
    priority: 'CAT 1' as MaintenancePriority,
    priorityTimeScale: '4 Hours',
    description: '',
    raisedBy: loggedInUserName,
    closeDueDate: new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' '),
    defectStatus: 'In Process' as DefectStatus,
    action: 'Open' as MaintenanceAction,
    progress: 'Reported - Assessing issue',
    notes: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (loggedInUserName && (formData.raisedBy === 'Site Duty Officer' || !formData.raisedBy)) {
      setFormData(prev => ({ ...prev, raisedBy: loggedInUserName }));
    }
  }, [loggedInUserName]);

  // Auto-save state for Create modal
  const [createDraftRestoredAt, setCreateDraftRestoredAt] = useState<string | null>(null);
  const [createLastSavedTime, setCreateLastSavedTime] = useState<string | null>(null);
  const isCreateInitializedRef = useRef<boolean>(false);

  // Auto-save state for Edit modal
  const [editDraftRestoredAt, setEditDraftRestoredAt] = useState<string | null>(null);
  const [editLastSavedTime, setEditLastSavedTime] = useState<string | null>(null);
  const isEditInitializedRef = useRef<boolean>(false);

  // Restore create draft when Create Modal opens
  useEffect(() => {
    if (isCreateModalOpen) {
      isCreateInitializedRef.current = false;
      const draft = loadFormDraft<typeof formData>(DRAFT_KEY_MAINTENANCE_CREATE);
      if (draft && draft.data) {
        const d = draft.data;
        const hasContent = Boolean(
          (d.description && d.description.trim()) ||
          (d.room && d.room.trim()) ||
          (d.location && d.location.trim()) ||
          (d.notes && d.notes.trim()) ||
          (d.criteriaCode && d.criteriaCode.trim())
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
      formData.description.trim() ||
      formData.room.trim() ||
      formData.location.trim() ||
      formData.notes.trim() ||
      formData.criteriaCode.trim()
    );

    if (hasContent) {
      saveFormDraft(DRAFT_KEY_MAINTENANCE_CREATE, formData);
      setCreateLastSavedTime(formatDraftTime(new Date().toISOString()));
    }
  }, [isCreateModalOpen, formData]);

  // Restore edit draft when Editing Record opens
  useEffect(() => {
    if (editingRecord) {
      isEditInitializedRef.current = false;
      const draft = loadFormDraft<MaintenanceRecord>(getDraftKeyMaintenanceEdit(editingRecord.id));
      if (draft && draft.data) {
        const d = draft.data;
        const hasDifferences = (
          d.defectStatus !== editingRecord.defectStatus ||
          d.action !== editingRecord.action ||
          d.progress !== editingRecord.progress ||
          d.notes !== editingRecord.notes ||
          d.actualClosedDate !== editingRecord.actualClosedDate
        );
        if (hasDifferences) {
          setEditingRecord(prev => prev ? ({ ...prev, ...d }) : null);
          setEditDraftRestoredAt(draft.savedAt);
          setEditLastSavedTime(formatDraftTime(draft.savedAt));
        }
      }
      setTimeout(() => {
        isEditInitializedRef.current = true;
      }, 100);
    } else {
      setEditDraftRestoredAt(null);
    }
  }, [editingRecord?.id]);

  // Auto-save edit form when inputs change
  useEffect(() => {
    if (!editingRecord || !isEditInitializedRef.current) return;
    saveFormDraft(getDraftKeyMaintenanceEdit(editingRecord.id), editingRecord);
    setEditLastSavedTime(formatDraftTime(new Date().toISOString()));
  }, [editingRecord]);

  const handleDiscardCreateDraft = () => {
    clearFormDraft(DRAFT_KEY_MAINTENANCE_CREATE);
    setFormData(initialFormState);
    setCreateDraftRestoredAt(null);
    setCreateLastSavedTime(null);
  };

  const handleRevertEditDraft = () => {
    if (!editingRecord) return;
    clearFormDraft(getDraftKeyMaintenanceEdit(editingRecord.id));
    const original = maintenanceRecords.find(r => r.id === editingRecord.id);
    if (original) {
      setEditingRecord({ ...original });
    }
    setEditDraftRestoredAt(null);
    setEditLastSavedTime(null);
  };

  // Filtered maintenance list
  const filteredRecords = useMemo(() => {
    return maintenanceRecords.filter(item => {
      if (siteFilter !== 'all' && item.site !== siteFilter) return false;
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
      if (statusFilter !== 'all' && item.defectStatus !== statusFilter) return false;
      if (actionFilter !== 'all' && item.action !== actionFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (item.description || '').toLowerCase().includes(q) ||
          (item.location || '').toLowerCase().includes(q) ||
          (item.raisedBy || '').toLowerCase().includes(q) ||
          (typeof item.criteriaCode === 'string' && item.criteriaCode.toLowerCase().includes(q)) ||
          (item.progress || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [maintenanceRecords, siteFilter, priorityFilter, statusFilter, actionFilter, searchQuery]);

  // Sort State
  const [sortField, setSortField] = useState<keyof MaintenanceRecord>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: keyof MaintenanceRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Sort filtered records
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let valA: any = a[sortField] ?? '';
      let valB: any = b[sortField] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredRecords, sortField, sortAsc]);

  // Pagination slice
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  // Overall statistics
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const cat1Emergency = filteredRecords.filter(r => r.priority === 'CAT 1' && r.defectStatus !== 'Completed').length;
    const cat2Interim = filteredRecords.filter(r => r.priority === 'CAT 2 - Interim' && r.defectStatus !== 'Completed').length;
    const inProcess = filteredRecords.filter(r => r.defectStatus === 'In Process').length;
    const completed = filteredRecords.filter(r => r.defectStatus === 'Completed').length;
    const openActions = filteredRecords.filter(r => r.action === 'Open').length;
    return { total, cat1Emergency, cat2Interim, inProcess, completed, openActions };
  }, [filteredRecords]);

  // When selecting criteria in create form
  const handleSelectCriteria = (c: MaintenanceCriteria) => {
    let timescale = c.timescale;
    let priority: MaintenancePriority = 'CAT 1';
    let dueHours = 4;

    if (c.category === 'CAT 1') {
      priority = 'CAT 1';
      dueHours = 4;
      timescale = '4 Hours (0 Days)';
    } else if (c.category === 'CAT 2') {
      priority = 'CAT 2';
      dueHours = 5 * 24;
      timescale = '5 Working Days (Interim 24h)';
    } else {
      priority = 'CAT 3';
      dueHours = 21 * 24;
      timescale = '21 Working Days';
    }

    const calculatedDueDate = new Date(Date.now() + dueHours * 3600 * 1000)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ');

    setFormData(prev => ({
      ...prev,
      criteriaCode: c.code,
      priority,
      priorityTimeScale: timescale,
      description: `${c.code} - ${c.title}`,
      closeDueDate: calculatedDueDate
    }));
  };

  const handlePriorityChange = (newPriority: MaintenancePriority) => {
    let dueHours = 4;
    let timescale = '4 Hours';
    if (newPriority === 'CAT 1') {
      dueHours = 4;
      timescale = '4 Hours (0 Days)';
    } else if (newPriority === 'CAT 2 - Interim') {
      dueHours = 24;
      timescale = '1 (24 Hours Interim)';
    } else if (newPriority === 'CAT 2') {
      dueHours = 5 * 24;
      timescale = '5 Working Days';
    } else if (newPriority === 'CAT 3') {
      dueHours = 21 * 24;
      timescale = '21 Working Days';
    }

    const calculatedDueDate = new Date(Date.now() + dueHours * 3600 * 1000)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ');

    setFormData(prev => ({
      ...prev,
      priority: newPriority,
      priorityTimeScale: timescale,
      closeDueDate: calculatedDueDate
    }));
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().slice(0, 10);
    const fullLocation = formData.room ? `${formData.site} - ${formData.room}` : `${formData.site} - ${formData.location || 'General Premises'}`;

    addMaintenanceRecord({
      date: today,
      priority: formData.priority,
      priorityTimeScale: formData.priorityTimeScale,
      location: fullLocation,
      site: formData.site,
      room: formData.room,
      description: formData.description,
      criteriaCode: formData.criteriaCode || undefined,
      raisedBy: formData.raisedBy || loggedInUserName,
      closeDueDate: formData.closeDueDate,
      defectStatus: formData.defectStatus,
      action: formData.action,
      progress: formData.progress,
      notes: formData.notes
    });

    clearFormDraft(DRAFT_KEY_MAINTENANCE_CREATE);
    setCreateDraftRestoredAt(null);
    setCreateLastSavedTime(null);
    setIsCreateModalOpen(false);
    // Reset form
    setFormData(initialFormState);
  };

  const handleUpdateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    const isCompleting = editingRecord.defectStatus === 'Completed' || editingRecord.action === 'Closed';
    const actualClosedDate = isCompleting && !editingRecord.actualClosedDate 
      ? new Date().toISOString().slice(0, 10) 
      : editingRecord.actualClosedDate;

    updateMaintenanceRecord(editingRecord.id, {
      ...editingRecord,
      actualClosedDate
    });

    clearFormDraft(getDraftKeyMaintenanceEdit(editingRecord.id));
    setEditDraftRestoredAt(null);
    setEditLastSavedTime(null);
    setEditingRecord(null);
  };

  const handleQuickClose = (record: MaintenanceRecord) => {
    const today = new Date().toISOString().slice(0, 10);
    updateMaintenanceRecord(record.id, {
      defectStatus: 'Completed',
      action: 'Closed',
      actualClosedDate: today,
      progress: 'Work Completed & Inspected'
    });
  };

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    if (scope === 'filtered') return sortedRecords;
    if (scope === 'custom' && startDate && endDate) {
      return maintenanceRecords.filter(r => r.date >= startDate && r.date <= endDate);
    }
    return maintenanceRecords;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (r: MaintenanceRecord) => string | number }> => ({
    date: { label: 'Date', getValue: r => r.date },
    priority: { label: 'Priority', getValue: r => r.priority },
    priorityTimeScale: { label: 'Timescale', getValue: r => r.priorityTimeScale },
    location: { label: 'Location', getValue: r => r.location || '—' },
    site: { label: 'Site / Hotel', getValue: r => r.site || '—' },
    room: { label: 'Room', getValue: r => r.room || '—' },
    criteriaCode: { label: 'Criteria', getValue: r => r.criteriaCode || '—' },
    description: { label: 'Description', getValue: r => r.description },
    raisedBy: { label: 'Raised By', getValue: r => r.raisedBy },
    closeDueDate: { label: 'Due Date', getValue: r => r.closeDueDate },
    defectStatus: { label: 'Defect Status', getValue: r => r.defectStatus },
    action: { label: 'Action', getValue: r => r.action },
    progress: { label: 'Progress', getValue: r => r.progress || '—' },
    actualClosedDate: { label: 'Closed Date', getValue: r => r.actualClosedDate || '—' },
    notes: { label: 'Notes', getValue: r => r.notes || '—' }
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
      : maintenanceExportColumns.map(c => c.id);
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
      : maintenanceExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(r => activeCols.map(c => colMap[c].getValue(r)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `Maintenance-Tracker-${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: 'Facility Maintenance & Defect Timescale Compliance Report',
        subtitle: 'Statutory habitability, CAT 1-3 defects, resolution timescales, and progress notes.',
        filename: `Maintenance-Tracker-${scope}-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        orientation,
        isCompact,
        metadata: [
          { label: 'Site Scope', value: siteFilter === 'all' ? 'All Permitted Sites' : siteFilter },
          { label: 'Priority Filter', value: priorityFilter },
          { label: 'Defect Status', value: statusFilter },
          { label: 'Action Filter', value: actionFilter },
          { label: 'Export Scope', value: scope === 'all' ? 'All Records' : scope === 'filtered' ? 'Current Filtered View' : `${startDate} to ${endDate}` },
          { label: 'Page Layout', value: orientation },
          { label: 'Total Defects', value: dataToExport.length }
        ]
      });
    }
  };

  const calculateDateRangeCount = (start: string, end: string) => {
    return maintenanceRecords.filter(r => r.date >= start && r.date <= end).length;
  };

  // Badge styles for priority
  const getPriorityBadge = (priority: MaintenancePriority) => {
    switch (priority) {
      case 'CAT 1':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
            <Flame className="w-3 h-3 text-red-600" />
            CAT 1 (0 / 4h)
          </span>
        );
      case 'CAT 2 - Interim':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-600" />
            CAT 2 - Interim (1d)
          </span>
        );
      case 'CAT 2':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
            <AlertTriangle className="w-3 h-3 text-yellow-600" />
            CAT 2 (5 Days)
          </span>
        );
      case 'CAT 3':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-blue-800 border border-teal-200">
            <Hammer className="w-3 h-3 text-blue-600" />
            CAT 3 (21 Days)
          </span>
        );
      default:
        return <span>{priority}</span>;
    }
  };

  const getDefectStatusBadge = (status: DefectStatus) => {
    if (status === 'Completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 animate-pulse">
        <Clock className="w-3 h-3 text-sky-600" />
        In Process
      </span>
    );
  };

  const getActionBadge = (action: MaintenanceAction) => {
    if (action === 'Closed') {
      return (
        <span className="px-2 py-0.5 text-[11px] font-medium bg-neutral-100 text-neutral-600 rounded">
          Closed
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded">
        Open
      </span>
    );
  };

  const criteriaSections = [
    { id: 'all', label: 'All Standards (71 Criteria)' },
    { id: 'B.2', label: 'B.2 Safe Accommodation (CAT-1, 4h)' },
    { id: 'B.3', label: 'B.3 Habitable Accommodation (CAT-1, 4h)' },
    { id: 'B.4', label: 'B.4 Fit for Purpose - Accommodation (CAT-2, 5d)' },
    { id: 'B.4.2', label: 'B.4.2 Decorative & Cleaning (CAT-3, 21d)' },
    { id: 'B.5', label: 'B.5 Disabled Persons (CAT-3, 21d)' },
    { id: 'B.6', label: 'B.6 Public Areas (CAT-3, 21d)' }
  ];

  const filteredCriteria = useMemo(() => {
    if (selectedCriteriaSection === 'all') return MAINTENANCE_CRITERIA_LIST;
    return MAINTENANCE_CRITERIA_LIST.filter(c => c.code.startsWith(selectedCriteriaSection) || c.section.includes(selectedCriteriaSection));
  }, [selectedCriteriaSection]);

  return (
    <div className="space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="w-6 h-6 text-[#0d9488]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">
              Maintenance & Defect Tracker
            </h1>
            <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded">
              Home Office Standards B.2 – B.6
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-1">
            Official accommodation habitability, emergency safety repair logs, and statutory timescale compliance tracker.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-open-criteria-guide"
            onClick={() => setIsCriteriaGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>Criteria Guide (71 Standards)</span>
          </button>

          <ExportDropdown
            moduleName="Maintenance"
            totalRecordCount={maintenanceRecords.length}
            filteredRecordCount={sortedRecords.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={maintenanceExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />

          {canCreateRecord() && (
            <button
              id="btn-add-maintenance-defect"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Maintenance Defect</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar (Placed consistently on top) */}
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

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-neutral-700">Priority:</span>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#f3f2f1] border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
            >
              <option value="all">All Priorities</option>
              {priorityOptions.map(opt => (
                <option key={opt.id} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Defect Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-neutral-700">Defect Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#f3f2f1] border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
            >
              <option value="all">All Defect Statuses</option>
              <option value="In Process">In Process</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-neutral-700">Action:</span>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#f3f2f1] border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
            >
              <option value="all">All Actions</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Reset button */}
          {(priorityFilter !== 'all' || statusFilter !== 'all' || actionFilter !== 'all' || searchQuery || (canAccessAllSites() && siteFilter !== 'all')) && (
            <button
              onClick={() => {
                setSiteFilter(canAccessAllSites() ? 'all' : assignedSite);
                setPriorityFilter('all');
                setStatusFilter('all');
                setActionFilter('all');
                setSearchQuery('');
              }}
              className="px-2 py-1 text-xs text-[#0d9488] hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search defects, criteria, room..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#f3f2f1] border border-[#8a8886] rounded-xs text-neutral-800 text-xs focus:outline-none focus:border-[#0d9488]"
          />
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-[#e1dfdd] p-3 rounded-xs shadow-xs">
          <div className="flex items-center justify-between text-[#605e5c] text-xs">
            <span>Total Tickets</span>
            <Wrench className="w-3.5 h-3.5 text-[#0d9488]" />
          </div>
          <div className="text-2xl font-bold text-[#242424] mt-1.5">{stats.total}</div>
          <div className="text-[11px] text-[#605e5c]">Across permitted sites</div>
        </div>

        <div className="bg-white border border-red-200 bg-red-50/40 p-3 rounded-xs shadow-xs">
          <div className="flex items-center justify-between text-red-700 text-xs">
            <span className="font-semibold">CAT 1 Emergencies</span>
            <Flame className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-800 mt-1.5">{stats.cat1Emergency}</div>
          <div className="text-[11px] text-red-700 font-medium">4-Hour Timescale (0 Days)</div>
        </div>

        <div className="bg-white border border-amber-200 bg-amber-50/40 p-3 rounded-xs shadow-xs">
          <div className="flex items-center justify-between text-amber-800 text-xs">
            <span className="font-semibold">CAT 2 - Interim</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-800 mt-1.5">{stats.cat2Interim}</div>
          <div className="text-[11px] text-amber-700 font-medium">24-Hour Timescale (1 Day)</div>
        </div>

        <div className="bg-white border border-sky-200 bg-sky-50/30 p-3 rounded-xs shadow-xs">
          <div className="flex items-center justify-between text-sky-800 text-xs">
            <span className="font-semibold">In Process</span>
            <Clock className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-sky-800 mt-1.5">{stats.inProcess}</div>
          <div className="text-[11px] text-sky-700">Contractor / Active Repair</div>
        </div>

        <div className="bg-white border border-emerald-200 bg-emerald-50/30 p-3 rounded-xs shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 text-xs">
            <span className="font-semibold">Completed Defects</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-800 mt-1.5">{stats.completed}</div>
          <div className="text-[11px] text-emerald-700">Verified & signed off</div>
        </div>

        <div className="bg-white border border-[#e1dfdd] p-3 rounded-xs shadow-xs">
          <div className="flex items-center justify-between text-[#605e5c] text-xs">
            <span>Action Status</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-[#242424] mt-1.5">{stats.openActions} Open</div>
          <div className="text-[11px] text-[#605e5c]">{stats.total - stats.openActions} Closed</div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th onClick={() => handleSort('date')} className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Date">
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    {sortField === 'date' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('priority')} className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Priority">
                  <div className="flex items-center gap-1">
                    <span>Priority</span>
                    {sortField === 'priority' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('priorityTimeScale')} className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Priority TimeScale">
                  <div className="flex items-center gap-1">
                    <span>Priority TimeScale</span>
                    {sortField === 'priorityTimeScale' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('location')} className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Location">
                  <div className="flex items-center gap-1">
                    <span>Location</span>
                    {sortField === 'location' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('description')} className="py-2.5 px-3 min-w-[220px] cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Description">
                  <div className="flex items-center gap-1">
                    <span>Description</span>
                    {sortField === 'description' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('raisedBy')} className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Raised By">
                  <div className="flex items-center gap-1">
                    <span>Raised BY</span>
                    {sortField === 'raisedBy' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('closeDueDate')} className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Close Due Date">
                  <div className="flex items-center gap-1">
                    <span>Close Due Date</span>
                    {sortField === 'closeDueDate' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('defectStatus')} className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Defect Status">
                  <div className="flex items-center gap-1">
                    <span>Defect status</span>
                    {sortField === 'defectStatus' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('action')} className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Action">
                  <div className="flex items-center gap-1">
                    <span>Action</span>
                    {sortField === 'action' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('progress')} className="py-2.5 px-3 min-w-[160px] cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Progress">
                  <div className="flex items-center gap-1">
                    <span>Progress</span>
                    {sortField === 'progress' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('actualClosedDate')} className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Actual Closed Date">
                  <div className="flex items-center gap-1">
                    <span>Actual Closed Date</span>
                    {sortField === 'actualClosedDate' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#242424]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-[#605e5c]">
                    <Wrench className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold">No maintenance tickets found matching current filters.</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">Try resetting search filters or click "Log Maintenance Defect" to report an issue.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(item => {
                  const isCat1 = item.priority === 'CAT 1';
                  const isClosed = item.defectStatus === 'Completed' || item.action === 'Closed';

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-[#f3f2f1]/60 transition-colors ${
                        isCat1 && !isClosed ? 'bg-red-50/20' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap text-neutral-700">
                        {item.date}
                      </td>

                      {/* Priority */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getPriorityBadge(item.priority)}
                      </td>

                      {/* Priority TimeScale */}
                      <td className="py-2.5 px-3 font-medium text-neutral-700 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-neutral-100 rounded text-[11px]">
                          {item.priorityTimeScale}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-neutral-800">{item.location}</div>
                        <div className="text-[10px] text-neutral-500">{item.site}</div>
                      </td>

                      {/* Description */}
                      <td className="py-2.5 px-3">
                        <div className="text-neutral-900 font-medium line-clamp-2">
                          {item.description}
                        </div>
                        {item.criteriaCode && (
                          <span className="inline-block mt-0.5 text-[10px] font-mono font-semibold bg-neutral-100 text-neutral-700 px-1.5 py-0.2 rounded">
                            Standard {item.criteriaCode}
                          </span>
                        )}
                      </td>

                      {/* Raised By */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-neutral-700">
                        {getRaisedBy(item)}
                      </td>

                      {/* Close Due Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                        <span className={`px-1.5 py-0.5 rounded ${
                          isCat1 && !isClosed ? 'bg-red-100 text-red-800 font-bold' : 'text-neutral-700'
                        }`}>
                          {item.closeDueDate}
                        </span>
                      </td>

                      {/* Defect status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {canEditRecord(item.site) ? (
                          <select
                            value={item.defectStatus}
                            onChange={e => {
                              const newStatus = e.target.value as DefectStatus;
                              updateMaintenanceRecord(item.id, {
                                defectStatus: newStatus,
                                action: newStatus === 'Completed' ? 'Closed' : item.action,
                                actualClosedDate: newStatus === 'Completed' ? (item.actualClosedDate || new Date().toISOString().slice(0, 10)) : item.actualClosedDate
                              });
                            }}
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0078d4] ${
                              item.defectStatus === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-sky-100 text-sky-800 border-sky-300'
                            }`}
                            title="Click to update defect status"
                          >
                            <option value="In Process" className="bg-white text-neutral-900 font-normal">In Process</option>
                            <option value="Completed" className="bg-white text-neutral-900 font-normal">Completed</option>
                          </select>
                        ) : (
                          getDefectStatusBadge(item.defectStatus)
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {canEditRecord(item.site) ? (
                          <select
                            value={item.action}
                            onChange={e => {
                              const newAction = e.target.value as MaintenanceAction;
                              updateMaintenanceRecord(item.id, {
                                action: newAction,
                                defectStatus: newAction === 'Closed' ? 'Completed' : item.defectStatus,
                                actualClosedDate: newAction === 'Closed' ? (item.actualClosedDate || new Date().toISOString().slice(0, 10)) : item.actualClosedDate
                              });
                            }}
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0078d4] ${
                              item.action === 'Closed'
                                ? 'bg-neutral-100 text-neutral-700 border-neutral-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                            title="Click to update action status"
                          >
                            <option value="Open" className="bg-white text-neutral-900 font-normal">Open</option>
                            <option value="Closed" className="bg-white text-neutral-900 font-normal">Closed</option>
                          </select>
                        ) : (
                          getActionBadge(item.action)
                        )}
                      </td>

                      {/* Progress */}
                      <td className="py-2.5 px-3">
                        <div className="text-[11px] text-neutral-800 font-medium">
                          {item.progress}
                        </div>
                        {item.notes && (
                          <div className="text-[10px] text-neutral-500 line-clamp-1 italic mt-0.5">
                            Note: {item.notes}
                          </div>
                        )}
                      </td>

                      {/* Actual Closed Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-neutral-600">
                        {item.actualClosedDate || <span className="text-neutral-400">—</span>}
                      </td>

                      {/* Row Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-end gap-1">
                          {!isClosed && canEditRecord() && (
                            <button
                              onClick={() => handleQuickClose(item)}
                              title="Mark Completed & Closed"
                              className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                        <button
                          onClick={() => setViewRecord(item)}
                          title="View Full Defect Details"
                          className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-[#edebe9] rounded"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {canEditRecord() && (
                          <button
                            onClick={() => setEditingRecord({
                              ...item,
                              raisedBy: getRaisedBy(item)
                            })}
                            title="Update Progress & Defect"
                            className="p-1 text-[#0d9488] hover:bg-[#edebe9] rounded"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                          {canDeleteRecord() && (
                            <button
                              onClick={() => deleteMaintenanceRecord(item.id)}
                              title="Delete Record"
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
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
        {sortedRecords.length > 0 && (
          <div className="p-3 border-t border-[#edebe9] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-neutral-500">
              Showing <span className="font-semibold text-neutral-800">{paginatedRecords.length}</span> of <span className="font-semibold text-neutral-800">{sortedRecords.length}</span> maintenance defects
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

      {/* CREATE NEW MAINTENANCE TICKET MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-[#8a8886] rounded-xs shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-[#edebe9] flex items-center justify-between bg-[#faf9f8]">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#0d9488]" />
                <h3 className="text-base font-bold text-[#242424]">
                  Log New Property Maintenance Defect
                </h3>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 hover:bg-[#edebe9] rounded text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Draft Restored Banner */}
              {createDraftRestoredAt && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xs flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      <strong>Unsaved ticket draft restored</strong> (auto-saved {formatDraftTime(createDraftRestoredAt)})
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

              {/* Quick Standards Selector */}
              <div className="bg-[#f3f8fd] border border-[#5eead4] p-3 rounded-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-[#0f766e]">Quick Auto-fill from Home Office Standards:</span>
                  <button
                    type="button"
                    onClick={() => setIsCriteriaGuideOpen(true)}
                    className="text-[#0d9488] hover:underline font-semibold text-[11px]"
                  >
                    View All 71 Standards
                  </button>
                </div>
                <select
                  value={formData.criteriaCode}
                  onChange={e => {
                    const found = MAINTENANCE_CRITERIA_LIST.find(c => c.code === e.target.value);
                    if (found) handleSelectCriteria(found);
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                >
                  <option value="">-- Choose Standard Criteria (Optional) --</option>
                  <optgroup label="B.2 Safe Accommodation (CAT 1 - 4 Hours Emergency)">
                    {MAINTENANCE_CRITERIA_LIST.filter(c => c.code.startsWith('B.2')).map(c => (
                      <option key={c.code} value={c.code}>{c.code} {c.title}</option>
                    ))}
                  </optgroup>
                  <optgroup label="B.3 Habitable Accommodation (CAT 1 - 4 Hours Emergency)">
                    {MAINTENANCE_CRITERIA_LIST.filter(c => c.code.startsWith('B.3')).map(c => (
                      <option key={c.code} value={c.code}>{c.code} {c.title}</option>
                    ))}
                  </optgroup>
                  <optgroup label="B.4 Fit for Purpose (CAT 2 - 5 Working Days, Interim 24h)">
                    {MAINTENANCE_CRITERIA_LIST.filter(c => c.code.startsWith('B.4.1')).map(c => (
                      <option key={c.code} value={c.code}>{c.code} {c.title}</option>
                    ))}
                  </optgroup>
                  <optgroup label="B.4.2 & B.6 Decorative & Public Areas (CAT 3 - 21 Working Days)">
                    {MAINTENANCE_CRITERIA_LIST.filter(c => c.category === 'CAT 3').slice(0, 10).map(c => (
                      <option key={c.code} value={c.code}>{c.code} {c.title}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Priority & Timescale Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Priority Category *
                  </label>
                  <select
                    value={formData.priority}
                    onChange={e => handlePriorityChange(e.target.value as MaintenancePriority)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs font-semibold focus:outline-none focus:border-[#0d9488]"
                  >
                    {priorityOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>{opt.label}</option>
                    ))}
                    {!priorityOptions.some(o => o.value === formData.priority) && formData.priority && (
                      <option value={formData.priority}>{formData.priority}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Priority TimeScale *
                  </label>
                  <input
                    type="text"
                    list="maint-create-timescales"
                    value={formData.priorityTimeScale}
                    onChange={e => setFormData({ ...formData, priorityTimeScale: e.target.value })}
                    required
                    className="w-full px-2.5 py-1.5 bg-[#f3f2f1] border border-[#8a8886] rounded-xs font-mono text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  />
                  <datalist id="maint-create-timescales">
                    {timeScaleOptions.map(opt => (
                      <option key={opt.id} value={opt.value} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Site and Room */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Property Site *
                  </label>
                  <select
                    value={formData.site}
                    onChange={e => setFormData({ ...formData, site: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  >
                    {allowedSites.map((s, idx) => (
                      <option key={`${s}-${idx}`} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Room / Specific Area
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Room 204, Boiler Plant Room, Kitchen B"
                    value={formData.room}
                    onChange={e => setFormData({ ...formData, room: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Defect Description *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detailed description of defect, cause, safety impact..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                />
              </div>

              {/* Raised By & Close Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-700 mb-1 flex items-center justify-between">
                    <span>Raised By *</span>
                    <span className="text-[10px] text-neutral-500 font-normal flex items-center gap-1">
                      <Lock className="w-3 h-3 text-neutral-400" /> Logged-in User (Locked)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      readOnly
                      value={formData.raisedBy || loggedInUserName}
                      className="w-full px-2.5 py-1.5 pr-8 bg-[#f8fafc] border border-[#d2d0ce] rounded-xs text-[#323130] font-medium cursor-not-allowed"
                      title="Raised By is locked to the authenticated user."
                    />
                    <Lock className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Close Due Date & Time *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.closeDueDate}
                    onChange={e => setFormData({ ...formData, closeDueDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs font-mono text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  />
                </div>
              </div>

              {/* Defect Status, Action & Progress */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Defect Status
                  </label>
                  <select
                    value={formData.defectStatus}
                    onChange={e => setFormData({ ...formData, defectStatus: e.target.value as DefectStatus })}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  >
                    <option value="In Process">In Process</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Action
                  </label>
                  <select
                    value={formData.action}
                    onChange={e => setFormData({ ...formData, action: e.target.value as MaintenanceAction })}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  >
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Progress Note
                  </label>
                  <input
                    type="text"
                    value={formData.progress}
                    onChange={e => setFormData({ ...formData, progress: e.target.value })}
                    placeholder="e.g. Contractor Dispatched"
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  />
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Additional Inspection / Follow-Up Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Temporary electric heater supplied to resident"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
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
                    className="px-3 py-2 bg-white hover:bg-[#edebe9] border border-[#8a8886] rounded-xs font-semibold text-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs"
                  >
                    Save & Log Ticket
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MAINTENANCE RECORD MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-[#8a8886] rounded-xs shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-[#edebe9] flex items-center justify-between bg-[#faf9f8]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#0d9488]" />
                <h3 className="text-base font-bold text-[#242424]">
                  Update Maintenance Defect Status
                </h3>
              </div>
              <button 
                onClick={() => setEditingRecord(null)}
                className="p-1 hover:bg-[#edebe9] rounded text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateRecord} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Draft Edits Restored Banner */}
              {editDraftRestoredAt && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xs flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      <strong>Unsaved edit draft restored</strong> (auto-saved {formatDraftTime(editDraftRestoredAt)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRevertEditDraft}
                    className="px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:text-red-700 hover:bg-amber-100 rounded border border-amber-400 transition-colors"
                  >
                    Revert to Saved
                  </button>
                </div>
              )}

              {/* Full Editable Defect Properties matching Create Form */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Site / Hotel *</label>
                  <select
                    value={editingRecord.site}
                    onChange={e => setEditingRecord({ ...editingRecord, site: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  >
                    {allowedSites.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Room / Unit *</label>
                  <input
                    type="text"
                    required
                    value={editingRecord.room}
                    onChange={e => setEditingRecord({ ...editingRecord, room: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Specific Location *</label>
                  <input
                    type="text"
                    required
                    value={editingRecord.location}
                    onChange={e => setEditingRecord({ ...editingRecord, location: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Priority Category *</label>
                  <select
                    value={editingRecord.priority}
                    onChange={e => setEditingRecord({ ...editingRecord, priority: e.target.value as MaintenancePriority })}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs font-semibold text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  >
                    {priorityOptions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Timescale *</label>
                  <select
                    value={editingRecord.priorityTimeScale}
                    onChange={e => setEditingRecord({ ...editingRecord, priorityTimeScale: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  >
                    {timeScaleOptions.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-neutral-700 mb-1 flex items-center justify-between">
                    <span>Raised By *</span>
                    <span className="text-[10px] text-neutral-500 font-normal flex items-center gap-1">
                      <Lock className="w-3 h-3 text-neutral-400" /> Locked
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      readOnly
                      value={getRaisedBy(editingRecord)}
                      className="w-full px-2.5 py-1.5 pr-8 bg-[#f8fafc] border border-[#d2d0ce] rounded-xs text-[#323130] font-medium cursor-not-allowed"
                    />
                    <Lock className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Defect Description *</label>
                <textarea
                  rows={2}
                  required
                  value={editingRecord.description}
                  onChange={e => setEditingRecord({ ...editingRecord, description: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                />
              </div>

              {/* Status and Action */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Defect Status *
                  </label>
                  <select
                    value={editingRecord.defectStatus}
                    onChange={e => {
                      const newStatus = e.target.value as DefectStatus;
                      setEditingRecord({
                        ...editingRecord,
                        defectStatus: newStatus,
                        action: newStatus === 'Completed' ? 'Closed' : editingRecord.action,
                        actualClosedDate: newStatus === 'Completed' ? (editingRecord.actualClosedDate || new Date().toISOString().slice(0, 10)) : editingRecord.actualClosedDate
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs font-semibold text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  >
                    <option value="In Process">In Process</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Action *
                  </label>
                  <select
                    value={editingRecord.action}
                    onChange={e => {
                      const newAction = e.target.value as MaintenanceAction;
                      setEditingRecord({
                        ...editingRecord,
                        action: newAction,
                        actualClosedDate: newAction === 'Closed' ? (editingRecord.actualClosedDate || new Date().toISOString().slice(0, 10)) : editingRecord.actualClosedDate
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs font-semibold text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                  >
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              {/* Progress */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Progress Update *
                </label>
                <input
                  type="text"
                  required
                  value={editingRecord.progress}
                  onChange={e => setEditingRecord({ ...editingRecord, progress: e.target.value })}
                  placeholder="e.g. Contractor Dispatched / Parts Installed / Verified"
                  className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                />
              </div>

              {/* Actual Closed Date */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Actual Closed Date (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  value={editingRecord.actualClosedDate || ''}
                  onChange={e => setEditingRecord({ ...editingRecord, actualClosedDate: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs font-mono text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                />
              </div>

              {/* Follow-up notes */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Follow-up Notes / Contractor Reference
                </label>
                <textarea
                  rows={2}
                  value={editingRecord.notes || ''}
                  onChange={e => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-neutral-800 focus:outline-none focus:border-[#0d9488]"
                />
              </div>

              <div className="pt-3 border-t border-[#edebe9] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                  <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                    <Save className="w-3 h-3 text-emerald-600" />
                    {editLastSavedTime ? `Auto-saved at ${editLastSavedTime}` : 'Auto-save active'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRecord(null)}
                    className="px-3 py-2 bg-white hover:bg-[#edebe9] border border-[#8a8886] rounded-xs font-semibold text-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs"
                  >
                    Update Ticket
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MAINTENANCE DEFECT MODAL */}
      {viewRecord && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-[#8a8886] rounded-xs shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 text-xs">
            <div className="px-5 py-4 border-b border-[#edebe9] flex items-center justify-between bg-[#faf9f8]">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#0d9488]" />
                <h3 className="text-base font-bold text-[#242424]">
                  Maintenance Defect #{viewRecord.id}: {viewRecord.location}
                </h3>
              </div>
              <button 
                onClick={() => setViewRecord(null)}
                className="p-1 hover:bg-[#edebe9] rounded text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#faf9f8] p-3.5 rounded-xs border border-[#edebe9]">
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Report Date</span>
                  <strong className="text-[#242424]">{viewRecord.date}</strong>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Site / Hotel</span>
                  <strong className="text-[#242424]">{viewRecord.site}</strong>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Room / Area</span>
                  <strong className="font-mono text-[#242424]">{viewRecord.room}</strong>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Raised By</span>
                  <span className="text-[#242424] font-medium">{getRaisedBy(viewRecord)}</span>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Priority</span>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    viewRecord.priority === 'CAT 1' ? 'bg-red-100 text-red-800' :
                    viewRecord.priority === 'CAT 2' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {viewRecord.priority} ({viewRecord.priorityTimeScale})
                  </span>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">HO Criteria Code</span>
                  <span className="font-mono font-semibold text-[#0d9488]">{viewRecord.criteriaCode || '—'}</span>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Status</span>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    viewRecord.defectStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {viewRecord.defectStatus} ({viewRecord.action})
                  </span>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-0.5">Close Due Date</span>
                  <span className="font-mono text-neutral-700">{viewRecord.closeDueDate}</span>
                </div>
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold block mb-1">Defect Description:</span>
                <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed text-[#242424] whitespace-pre-wrap">
                  {viewRecord.description}
                </div>
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold block mb-1">Progress Update:</span>
                <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed text-[#242424] whitespace-pre-wrap">
                  {viewRecord.progress || '—'}
                </div>
              </div>

              {viewRecord.actualClosedDate && (
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-1">Actual Closed Date:</span>
                  <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xs font-mono">
                    {viewRecord.actualClosedDate}
                  </div>
                </div>
              )}

              {viewRecord.notes && (
                <div>
                  <span className="text-[#605e5c] font-semibold block mb-1">Follow-up Notes / Contractor:</span>
                  <div className="p-3 bg-[#f7f8fa] border border-[#edebe9] rounded-xs leading-relaxed text-[#242424] whitespace-pre-wrap">
                    {viewRecord.notes}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[#edebe9] flex justify-end gap-2">
                {canEditRecord(viewRecord.site) && (
                  <button
                    type="button"
                    onClick={() => {
                      const rec = viewRecord;
                      setViewRecord(null);
                      setEditingRecord({ ...rec, raisedBy: getRaisedBy(rec) });
                    }}
                    className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold rounded-xs shadow-xs"
                  >
                    Edit Ticket
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

      {/* CRITERIA STANDARDS GUIDE MODAL */}
      {isCriteriaGuideOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-[#8a8886] rounded-xs shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-[#edebe9] flex items-center justify-between bg-[#faf9f8]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#0d9488]" />
                <div>
                  <h3 className="text-base font-bold text-[#242424]">
                    Accommodation Safety & Habitability Criteria Guide
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Home Office Accommodation Standards B.2, B.3, B.4, B.5, B.6 statutory classification
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsCriteriaGuideOpen(false)}
                className="p-1 hover:bg-[#edebe9] rounded text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section tabs */}
            <div className="px-5 py-2.5 bg-neutral-50 border-b border-neutral-200 flex flex-wrap gap-1.5 text-xs">
              {criteriaSections.map(sec => (
                <button
                  key={sec.id}
                  onClick={() => setSelectedCriteriaSection(sec.id)}
                  className={`px-2.5 py-1 rounded-xs font-semibold transition-colors ${
                    selectedCriteriaSection === sec.id
                      ? 'bg-[#0d9488] text-white'
                      : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            {/* Criteria List table */}
            <div className="p-5 overflow-y-auto space-y-3 text-xs">
              <div className="border border-neutral-200 rounded-xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-neutral-200 text-neutral-700 font-semibold">
                      <th className="py-2 px-3 w-16">No.</th>
                      <th className="py-2 px-3 w-24">Code</th>
                      <th className="py-2 px-3">Criteria Requirement</th>
                      <th className="py-2 px-3 w-24">Category</th>
                      <th className="py-2 px-3 w-32">Timescale</th>
                      <th className="py-2 px-3 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredCriteria.map(c => (
                      <tr key={c.code} className="hover:bg-neutral-50">
                        <td className="py-2 px-3 font-mono text-neutral-500">{c.number}</td>
                        <td className="py-2 px-3 font-mono font-bold text-[#0d9488]">{c.code}</td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-neutral-800">{c.title}</div>
                          <div className="text-[11px] text-neutral-500">{c.section}</div>
                          {c.interimRequirement && (
                            <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                              * {c.interimRequirement}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            c.category === 'CAT 1' ? 'bg-red-100 text-red-800' :
                            c.category === 'CAT 2' ? 'bg-amber-100 text-amber-800' :
                            'bg-teal-100 text-blue-800'
                          }`}>
                            {c.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono font-medium text-neutral-700">
                          {c.timescale}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => {
                              handleSelectCriteria(c);
                              setIsCriteriaGuideOpen(false);
                              setIsCreateModalOpen(true);
                            }}
                            className="px-2 py-1 bg-[#f0fdfa] text-[#0f766e] hover:bg-[#0d9488] hover:text-white rounded text-[11px] font-semibold transition-colors"
                          >
                            Use in Ticket
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#edebe9] bg-[#faf9f8] flex items-center justify-between text-xs text-neutral-500">
              <span>Showing {filteredCriteria.length} standards criteria</span>
              <button
                onClick={() => setIsCriteriaGuideOpen(false)}
                className="px-3 py-1.5 bg-[#edebe9] hover:bg-[#e1dfdd] text-neutral-800 font-semibold rounded-xs"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
