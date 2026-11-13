import { IconX as CloseIcon } from '@tabler/icons-react';
import React, { useState, useMemo, useEffect } from 'react';
import { BulkActionToolbar } from '../common/BulkActionToolbar';
import { IconHeartHandshake as HeartHandshake, IconPlus as Plus, IconSearch as Search, IconEdit as Edit3, IconTrash as Trash2, IconEye as Eye, IconShieldExclamation as ShieldAlert, IconCircleCheck as CheckCircle2, IconCircleX as XCircle, IconBuilding as Building2, IconUser as User, IconActivity as Activity, IconStethoscope as Stethoscope, IconHome as Home, IconAdjustmentsHorizontal as SlidersHorizontal, IconArrowUp as ArrowUp, IconArrowDown as ArrowDown, IconArrowsSort as ArrowUpDown, IconLock as Lock, IconAlertOctagon as AlertOctagon, IconAlertTriangle as AlertTriangle } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { WelfareCheckRecord } from '../../types';
import { SiteServiceUserSelector } from '../common/SiteServiceUserSelector';
import { Pagination } from '../common/Pagination';
import { useCheckObligations } from '../../hooks/useCheckObligations';
import { monthOptions, monthLabel } from '../checks/CheckObligationsPanel';
import { londonNow } from '../../utils/operationsRules';
import { monthWindows, isSatisfied, type CheckRow, type CheckObligation } from '../../utils/checkObligations';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption } from '../common/ExportModal';
import { useTableSchema } from '../../hooks/useTableSchema';
import { WELFARE_CHECKS_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { TableColumnConfig } from '../../types/tableSchema';

const welfareExportColumns: ExportColumnOption[] = [
  { id: 'checkDatetime', label: 'Check Date & Time', defaultSelected: true },
  { id: 'siteName', label: 'Site / Hotel', defaultSelected: true },
  { id: 'portReference', label: 'Port Reference', defaultSelected: true },
  { id: 'flatNumber', label: 'Flat / Room No', defaultSelected: true },
  { id: 'officerName', label: 'Officer Name', defaultSelected: true },
  { id: 'familyOrIndividual', label: 'Family / Individual', defaultSelected: true },
  { id: 'wantsWelfareEngagement', label: 'Wants Engagement', defaultSelected: true },
  { id: 'gpRegistered', label: 'GP Registered', defaultSelected: true },
  { id: 'physicalHealthChange', label: 'Physical Health Change', defaultSelected: true },
  { id: 'mentalHealthChange', label: 'Mental Health Change', defaultSelected: true },
  { id: 'status', label: 'Status', defaultSelected: true }
];

export const WelfareChecksView: React.FC = () => {
  const {
    defaultSiteFilter,
    welfareChecks,
    addWelfareCheck,
    updateWelfareCheck,
    deleteWelfareCheck,
    canAccessAllSites,
    isSitePermitted,
    allowedSites,
    assignedSite,
    sites,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    currentUserName,
    authProfile
  , requestConfirmation } = useApp();

  const loggedInUserName = authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || (currentUserRole ? `${currentUserRole} (User)` : 'Duty Officer');

  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const handleToggleSelectAll = () => { setSelectedIds(prev => prev.length ? [] : paginatedData?.map(p => p.id) || []); };
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

  const [siteFilter, setSiteFilter] = useState(defaultSiteFilter);
  const [statusFilter, setStatusFilter] = useState('all');

  // Clock for monthly compliance evaluations
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const today = londonNow(now).date;
  const [selectedMonth, setSelectedMonth] = useState<string>(today.slice(0, 7));

  // Compliance Tabs: 'all' | 'completed' | 'pending' | 'overdue' | 'history'
  const [complianceTab, setComplianceTab] = useState<'all' | 'completed' | 'pending' | 'overdue' | 'history'>('all');
  const [compliancePage, setCompliancePage] = useState(1);
  const compliancePageSize = 10;

  // Real-time Monthly Obligation Calculation
  const obligationsState = useCheckObligations('welfare', selectedMonth, now, true);
  const windows = useMemo(() => monthWindows(selectedMonth, obligationsState.result?.settings), [selectedMonth, obligationsState.result]);

  const allowedNames = useMemo(() => {
    if (canAccessAllSites()) return null;
    return new Set((allowedSites || []).map(s => String(s).toLowerCase()));
  }, [canAccessAllSites, allowedSites]);

  const filteredComplianceRows = useMemo(() => {
    return (obligationsState.rows || []).filter(r => {
      if (allowedNames && !allowedNames.has(r.siteName.toLowerCase())) return false;
      if (siteFilter && siteFilter !== 'all' && siteFilter !== 'All Sites' && r.siteName.toLowerCase() !== siteFilter.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          (r.suName && r.suName.toLowerCase().includes(q)) ||
          (r.suReference && r.suReference.toLowerCase().includes(q)) ||
          (r.roomNumber && r.roomNumber.toLowerCase().includes(q)) ||
          (r.siteName && r.siteName.toLowerCase().includes(q)) ||
          (r.propertyName && r.propertyName.toLowerCase().includes(q)) ||
          (r.responsible?.name && r.responsible.name.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [obligationsState.rows, allowedNames, siteFilter, searchQuery]);

  const tabComplianceRows = useMemo(() => {
    if (complianceTab === 'completed') {
      return filteredComplianceRows.filter(r => r.overall === 'complete');
    }
    if (complianceTab === 'pending') {
      return filteredComplianceRows.filter(r => r.overall === 'incomplete' && r.first?.status !== 'overdue' && r.second?.status !== 'overdue');
    }
    if (complianceTab === 'overdue') {
      return filteredComplianceRows.filter(r => r.first?.status === 'overdue' || r.second?.status === 'overdue');
    }
    return filteredComplianceRows;
  }, [filteredComplianceRows, complianceTab]);

  const complianceKpis = useMemo(() => {
    const total = filteredComplianceRows.length;
    const completed = filteredComplianceRows.filter(r => r.overall === 'complete').length;
    const inProgress = filteredComplianceRows.filter(r => {
      const isC1 = r.first?.status === 'completed' || r.first?.status === 'completed_late';
      const isC2 = r.second?.status === 'completed' || r.second?.status === 'completed_late';
      return (isC1 !== isC2) && r.first?.status !== 'overdue' && r.second?.status !== 'overdue';
    }).length;
    const notStarted = filteredComplianceRows.filter(r => {
      const isC1 = r.first?.status === 'completed' || r.first?.status === 'completed_late';
      const isC2 = r.second?.status === 'completed' || r.second?.status === 'completed_late';
      return !isC1 && !isC2 && r.first?.status !== 'overdue' && r.second?.status !== 'overdue';
    }).length;
    const overdue = filteredComplianceRows.filter(r => r.first?.status === 'overdue' || r.second?.status === 'overdue').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, notStarted, overdue, pct };
  }, [filteredComplianceRows]);

  const paginatedComplianceRows = useMemo(() => {
    const start = (compliancePage - 1) * compliancePageSize;
    return tabComplianceRows.slice(start, start + compliancePageSize);
  }, [tabComplianceRows, compliancePage, compliancePageSize]);

  // Sync with active property switcher in Header
  useEffect(() => {
    setSiteFilter(defaultSiteFilter);
  }, [defaultSiteFilter]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<keyof WelfareCheckRecord>('checkDatetime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<WelfareCheckRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);

  // Table Customization Schema Hook
  const {
    columns: schemaColumns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<WelfareCheckRecord>('welfareChecks', WELFARE_CHECKS_TABLE_COLUMNS);

  // Form State
  const initialFormState: Partial<WelfareCheckRecord> = {
    siteName: (siteFilter && siteFilter !== 'all' && siteFilter !== 'All Sites') ? siteFilter : (sites[0]?.name || ''),
    portReference: '',
    flatNumber: '',
    officerName: loggedInUserName,
    checkDatetime: new Date().toISOString().slice(0, 16),
    safeguardingStatementAgreement: true,
    validPortReference: true,
    locationType: 'In Person - Flat',
    locationOther: '',
    contactMethod: 'In Person',
    contactMethodOther: '',
    wantsWelfareEngagement: true,
    familyOrIndividual: 'Individual',
    gpRegistered: true,
    gpDetails: '',
    physicalHealthChange: false,
    physicalHealthDetails: '',
    coronavirusAwareness: true,
    coronavirusSymptomsAwareness: true,
    previousCoronavirus: false,
    knowsSymptomAction: true,
    knowsWorseningContact: true,
    knowsAssistanceContact: true,
    mentalHealthChange: false,
    mentalHealthDetails: '',
    otherWelfareIssues: '',
    maintenanceIssues: '',
    safeguardingConcerns: '',
    windowRestrictorsIntact: true,
    smokeAlarmsWorking: true,
    status: 'Completed'
  };

  const [formData, setFormData] = useState<Partial<WelfareCheckRecord>>(initialFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [activeFormTab, setActiveFormTab] = useState<number>(1);

  // Filter records by site permissions & search
  const accessibleRecords = useMemo(() => {
    if (canAccessAllSites()) return welfareChecks;
    return welfareChecks.filter(r => isSitePermitted(r.siteName, 'all'));
  }, [welfareChecks, canAccessAllSites, isSitePermitted]);

  const filteredRecords = useMemo(() => {
    return accessibleRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (r.portReference && r.portReference.toLowerCase().includes(q)) ||
        (r.siteName && r.siteName.toLowerCase().includes(q)) ||
        (r.flatNumber && r.flatNumber.toLowerCase().includes(q)) ||
        (r.officerName && r.officerName.toLowerCase().includes(q));

      const matchesSite = isSitePermitted(r.siteName, siteFilter);
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

      return matchesSearch && matchesSite && matchesStatus;
    });
  }, [accessibleRecords, searchQuery, siteFilter, statusFilter, isSitePermitted]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      if (sortOrder === 'asc') {
        return String(valA).localeCompare(String(valB));
      }
      return String(valB).localeCompare(String(valA));
    });
  }, [filteredRecords, sortKey, sortOrder]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.siteName) errors.siteName = 'Site is required';
    if (!formData.portReference?.trim()) errors.portReference = 'Port Reference is required';
    if (!formData.checkDatetime) errors.checkDatetime = 'Check Date & Time is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Which of the month's two checks the open form is recording (null for a free-standing check, counted by its date)
  const [recording, setRecording] = useState<{ period: 1 | 2; month: string; deadline: string } | null>(null);

  const handleOpenCreate = () => {
    setRecording(null);
    setFormData({
      ...initialFormState,
      officerName: loggedInUserName,
      siteName: (siteFilter && siteFilter !== 'all' && siteFilter !== 'All Sites') ? siteFilter : (sites[0]?.name || '')
    });
    setFormErrors({});
    setIsEditing(false);
    setActiveFormTab(1);
    setIsFormOpen(true);
  };

  const handleQuickResolve = (row: CheckRow, preferredPeriod?: 1 | 2) => {
    const period: 1 | 2 = preferredPeriod || (row.first && !isSatisfied(row.first.status) ? 1 : 2);
    const ob = period === 1 ? row.first : row.second;
    setRecording(row.overall === 'complete' && !preferredPeriod ? null : { period, month: selectedMonth, deadline: ob?.deadline || '' });
    setFormData({
      ...initialFormState,
      siteId: ob?.siteId || undefined,
      suId: ob?.suId || undefined,
      serviceUserId: ob?.suId || undefined,
      siteName: row.siteName || ((siteFilter && siteFilter !== 'all' && siteFilter !== 'All Sites') ? siteFilter : (sites[0]?.name || '')),
      portReference: row.suReference || '',
      flatNumber: row.roomNumber || '',
      officerName: loggedInUserName,
      checkDatetime: new Date().toISOString().slice(0, 16),
      status: 'Completed'
    });
    setFormErrors({});
    setIsEditing(false);
    setActiveFormTab(1);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (rec: WelfareCheckRecord) => {
    setFormData({ ...rec, officerName: rec.officerName || loggedInUserName });
    const savedPeriod = Number((rec as any).data?.checkPeriod);
    setRecording(savedPeriod === 1 || savedPeriod === 2 ? { period: savedPeriod as 1 | 2, month: String((rec as any).data?.checkMonth || ''), deadline: '' } : null);
    setFormErrors({});
    setIsEditing(true);
    setActiveFormTab(1);
    setIsFormOpen(true);
  };

  const handleOpenView = (rec: WelfareCheckRecord) => {
    setSelectedRecord(rec);
    setIsViewOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const dataToSave = {
      ...formData,
      officerName: formData.officerName || loggedInUserName,
      // Which of the month's two checks this is, kept with the record
      data: { ...((formData as any).data || {}), ...(recording ? { checkPeriod: recording.period, checkMonth: recording.month } : {}) }
    };

    if (isEditing && formData.id) {
      await updateWelfareCheck(formData.id, dataToSave);
    } else {
      await addWelfareCheck(dataToSave as any);
    }
    setIsFormOpen(false);
    setRecording(null);
  };

  const handlePerformExport = (options: {
    format: 'csv' | 'pdf';
    orientation: 'portrait' | 'landscape';
    selectedColumns?: string[];
  }) => {
    const cols = options.selectedColumns && options.selectedColumns.length > 0
      ? welfareExportColumns.filter(c => options.selectedColumns?.includes(c.id))
      : welfareExportColumns;
    const headers = cols.map(c => c.label);
    const rows = filteredRecords.map(r => cols.map(c => {
      if (c.id === 'checkDatetime') return r.checkDatetime ? new Date(r.checkDatetime).toLocaleString('en-GB') : '';
      if (c.id === 'wantsWelfareEngagement') return r.wantsWelfareEngagement ? 'Yes' : 'No';
      if (c.id === 'gpRegistered') return r.gpRegistered ? 'Yes' : 'No';
      if (c.id === 'physicalHealthChange') return r.physicalHealthChange ? 'Yes' : 'No';
      if (c.id === 'mentalHealthChange') return r.mentalHealthChange ? 'Yes' : 'No';
      return String((r as any)[c.id] ?? '');
    }));

    if (options.format === 'csv') {
      exportTableToCsv({ filename: 'Welfare_Checks_Export.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'Welfare_Checks_Export.pdf',
        title: 'Welfare Checks Compliance Registry',
        subtitle: `Site Scope: ${siteFilter === 'all' ? 'All Sites' : siteFilter}`,
        headers,
        rows,
        orientation: options.orientation || 'landscape'
      });
    }
  };

  const renderColumnCell = (col: TableColumnConfig<WelfareCheckRecord>, record: WelfareCheckRecord) => {
    if (col.renderCell) {
      return col.renderCell((record as any)[col.key], record);
    }

    const value = (record as any)[col.key];

    if (col.badgeColors && value) {
      const badgeClass = col.badgeColors[value] || 'bg-neutral-100 text-neutral-800';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeClass}`}>
          {value}
        </span>
      );
    }

    if (col.key === 'checkDatetime') {
      return (
        <span className="font-medium text-neutral-800">
          {record.checkDatetime ? new Date(record.checkDatetime).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
        </span>
      );
    }

    if (col.key === 'portReference') {
      return <span className="font-mono text-[#0d9488] font-bold">{value || '—'}</span>;
    }

    if (col.key === 'flatNumber') {
      return <span className="font-semibold text-neutral-800">{value || '—'}</span>;
    }

    if (col.key === 'wantsWelfareEngagement') {
      return value ? (
        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Yes
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
          <XCircle className="w-3 h-3" /> Declined
        </span>
      );
    }

    if (col.type === 'checkbox') {
      return value ? (
        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Yes</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-neutral-400">
          <XCircle className="w-3.5 h-3.5" />
          <span>No</span>
        </span>
      );
    }

    if (value === null || value === undefined || value === '') {
      return <span className="text-neutral-400">—</span>;
    }

    return <span className="text-neutral-700 truncate max-w-[200px] inline-block">{String(value)}</span>;
  };

  const canViewSafeguarding = currentUserRole === 'Super Admin' || currentUserRole === 'Admin' || currentUserRole === 'Regional Manager' || currentUserRole === 'Area Manager';

  const fmt = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '');

  // "Check 1 - November 2026" for every recorded welfare check that counts toward a month
  const checkLabelByVisit = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of obligationsState.rows) for (const o of [r.first, r.second]) {
      if (o?.visitId) m.set(o.visitId, `Check ${o.period} · ${monthLabel(o.month)}${o.status === 'completed_late' ? ' (late)' : ''}`);
    }
    return m;
  }, [obligationsState.rows]);
  const checkLabelOf = (rec: WelfareCheckRecord) => {
    const found = checkLabelByVisit.get(rec.id);
    if (found) return found;
    const d: any = (rec as any).data;
    const sp = Number(d?.checkPeriod);
    return sp ? `Check ${sp}${d?.checkMonth ? ' · ' + monthLabel(String(d.checkMonth)) : ''}` : '—';
  };
  const recordedFor = (o: CheckObligation | null) => (o?.visitId ? welfareChecks.find(r => r.id === o.visitId) : undefined);

  const renderObligationCell = (o: CheckObligation | null, row: CheckRow, period: 1 | 2) => {
    if (!o) return <span className="text-neutral-400">—</span>;
    if (o.status === 'completed' || o.status === 'completed_late') {
      return (
        <div>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>Done {fmt(o.visitDate)}</span>
          </span>
          {o.completedBy && <div className="text-[10px] text-neutral-500 mt-0.5 truncate max-w-[130px]">{o.completedBy}</div>}
        </div>
      );
    }
    if (o.status === 'overdue') {
      return (
        <div>
          <button
            type="button"
            onClick={() => handleQuickResolve(row, period)}
            title="Click to complete this overdue welfare check now"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[11px] font-bold bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 cursor-pointer shadow-2xs transition-colors group text-left"
          >
            <AlertOctagon className="w-3 h-3 text-red-600 shrink-0" />
            <span className="group-hover:underline">Overdue ({o.daysLate ?? 1}d late)</span>
          </button>
          <div className="text-[10px] text-red-600 mt-0.5 font-medium">Due by {fmt(o.deadline)}</div>
        </div>
      );
    }
    return (
      <div>
        <button
          type="button"
          onClick={() => handleQuickResolve(row, period)}
          title="Click to record welfare check"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 cursor-pointer transition-colors text-left"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
          <span>Pending</span>
        </button>
        <div className="text-[10px] text-neutral-500 mt-0.5">Due by {fmt(o.deadline)}</div>
      </div>
    );
  };

  const renderFrequencyBadge = (row: CheckRow) => {
    const isC1 = row.first?.status === 'completed' || row.first?.status === 'completed_late';
    const isC2 = row.second?.status === 'completed' || row.second?.status === 'completed_late';
    const count = (isC1 ? 1 : 0) + (isC2 ? 1 : 0);
    if (count === 2) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          2/2 ✓
        </span>
      );
    }
    if (count === 1) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
          1/2
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
        0/2
      </span>
    );
  };

  const renderComplianceStatus = (row: CheckRow) => {
    if (row.overall === 'complete') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Completed (2/2)</span>
        </span>
      );
    }
    if (row.first?.status === 'overdue' || row.second?.status === 'overdue') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-bold bg-red-50 text-red-800 border border-red-200">
          <AlertOctagon className="w-3 h-3 text-red-600 shrink-0" />
          <span>Overdue Action</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
        <span>Due / In Progress</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Header */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xs">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424] tracking-tight">Welfare Checks &amp; Monthly Compliance</h1>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-teal-50 text-[#0d9488] border border-teal-200 rounded-xs">
                  Twice-Monthly Check Schedule (10th &amp; 25th)
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">Monthly resident safeguarding &amp; welfare checks per service user (Check 1 by the 10th, Check 2 by the 25th).</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {complianceTab === 'history' && currentUserRole === 'Super Admin' && (
              <button
                type="button"
                id="btn-customize-welfare-table"
                onClick={() => setIsSchemaModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
                title="Super Admin: Customize table columns, headers, and fields"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>Customize Table</span>
              </button>
            )}

            {complianceTab === 'history' && (
              <ExportDropdown 
                moduleName="Welfare Checks"
                totalRecordCount={accessibleRecords.length}
                filteredRecordCount={filteredRecords.length}
                availableColumns={welfareExportColumns}
                onExport={handlePerformExport}
              />
            )}

            {canCreateRecord() && (
              <button
                type="button"
                id="btn-create-welfare-check"
                onClick={handleOpenCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-medium rounded-xs transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Welfare Check</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          {/* Month Selector */}
          <div>
            <select
              aria-label="Welfare Check Month"
              value={selectedMonth}
              onChange={e => { setSelectedMonth(e.target.value); setCompliancePage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs font-medium focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              {monthOptions(today).map(m => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={siteFilter}
              onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); setCompliancePage(1); }}
              disabled={!canAccessAllSites() && (allowedSites || []).length <= 1}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              {(canAccessAllSites() || (allowedSites && allowedSites.length > 1)) && (
                <option value="all">
                  {canAccessAllSites() ? `All Properties / Sites (${allowedSites.length})` : `All Assigned Sites (${allowedSites.length})`}
                </option>
              )}
              {allowedSites.map((s, idx) => (
                <option key={`${s}-${idx}`} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Resident, Port Ref, Room, Officer..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); setCompliancePage(1); }}
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); setCompliancePage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Issues Identified">Issues Identified</option>
              <option value="Follow-up Required">Follow-up Required</option>
            </select>
          </div>
        </div>
      </div>

      {/* Monthly Compliance KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="bg-white border border-[#e1dfdd] rounded-xs p-2.5 flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#605e5c]">Total Residents</span>
          <div className="text-xl font-bold text-[#242424] tabular-nums mt-0.5">{complianceKpis.total}</div>
        </div>

        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xs p-2.5 flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Completed (2/2)
          </span>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-xl font-bold text-emerald-800 tabular-nums">{complianceKpis.completed}</span>
            <span className="text-[10px] font-bold text-emerald-700 tabular-nums">{complianceKpis.pct}%</span>
          </div>
        </div>

        <div className="bg-amber-50/50 border border-amber-200 rounded-xs p-2.5 flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" /> In Progress (1/2)
          </span>
          <div className="text-xl font-bold text-amber-800 tabular-nums mt-0.5">{complianceKpis.inProgress}</div>
        </div>

        <div className="bg-[#faf9f8] border border-[#edebe9] rounded-xs p-2.5 flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" /> Not Started (0/2)
          </span>
          <div className="text-xl font-bold text-[#605e5c] tabular-nums mt-0.5">{complianceKpis.notStarted}</div>
        </div>

        <div className={`${complianceKpis.overdue > 0 ? 'bg-red-50/60 border-red-200' : 'bg-[#faf9f8] border-[#edebe9]'} rounded-xs p-2.5 flex flex-col justify-between`}>
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${complianceKpis.overdue > 0 ? 'text-red-800' : 'text-[#605e5c]'} flex items-center gap-1`}>
            <span className={`w-1.5 h-1.5 rounded-full ${complianceKpis.overdue > 0 ? 'bg-red-600 animate-pulse' : 'bg-neutral-400'}`} /> Overdue Action
          </span>
          <div className={`text-xl font-bold tabular-nums mt-0.5 ${complianceKpis.overdue > 0 ? 'text-red-700' : 'text-[#605e5c]'}`}>{complianceKpis.overdue}</div>
        </div>

        <div className="bg-white border border-[#e1dfdd] rounded-xs p-2.5 flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#605e5c]">Monthly Progress</span>
          <div className="mt-1">
            <div className="flex justify-between items-center text-[10px] font-bold text-[#242424] mb-1">
              <span>Rate</span>
              <span className="tabular-nums">{complianceKpis.pct}%</span>
            </div>
            <div className="w-full bg-[#edebe9] rounded-xs h-1.5 overflow-hidden">
              <div className="bg-[#0d9488] h-1.5 rounded-xs transition-all duration-300" style={{ width: `${complianceKpis.pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden flex flex-col justify-between min-h-[520px] lg:min-h-[calc(100vh-270px)]">
        <div className="px-3 py-2 border-b border-[#e5e5e5] bg-[#faf9f8] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => { setComplianceTab('all'); setCompliancePage(1); }}
              className={`px-2.5 py-1 rounded-xs text-xs font-semibold transition-colors cursor-pointer ${
                complianceTab === 'all'
                  ? 'bg-white text-[#0d9488] border border-[#cbd5e1] shadow-2xs'
                  : 'text-[#605e5c] hover:bg-[#f3f2f1]'
              }`}
            >
              All Residents ({filteredComplianceRows.length})
            </button>
            <button
              type="button"
              onClick={() => { setComplianceTab('completed'); setCompliancePage(1); }}
              className={`px-2.5 py-1 rounded-xs text-xs font-semibold transition-colors cursor-pointer ${
                complianceTab === 'completed'
                  ? 'bg-white text-emerald-800 border border-[#cbd5e1] shadow-2xs'
                  : 'text-[#605e5c] hover:bg-[#f3f2f1]'
              }`}
            >
              Completed 2/2 ({complianceKpis.completed})
            </button>
            <button
              type="button"
              onClick={() => { setComplianceTab('pending'); setCompliancePage(1); }}
              className={`px-2.5 py-1 rounded-xs text-xs font-semibold transition-colors cursor-pointer ${
                complianceTab === 'pending'
                  ? 'bg-white text-amber-800 border border-[#cbd5e1] shadow-2xs'
                  : 'text-[#605e5c] hover:bg-[#f3f2f1]'
              }`}
            >
              Due / In Progress ({complianceKpis.inProgress + complianceKpis.notStarted})
            </button>
            <button
              type="button"
              onClick={() => { setComplianceTab('overdue'); setCompliancePage(1); }}
              className={`px-2.5 py-1 rounded-xs text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                complianceTab === 'overdue'
                  ? 'bg-white text-red-800 border border-[#cbd5e1] shadow-2xs'
                  : 'text-red-700 hover:bg-red-50'
              }`}
            >
              <span>Overdue</span>
              {complianceKpis.overdue > 0 && (
                <span className="px-1.5 py-0.2 bg-red-100 text-red-800 text-[10px] font-bold rounded-full">
                  {complianceKpis.overdue}
                </span>
              )}
            </button>
            <div className="h-4 w-px bg-slate-300 mx-1" />
            <button
              type="button"
              onClick={() => { setComplianceTab('history'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-xs text-xs font-semibold transition-colors cursor-pointer ${
                complianceTab === 'history'
                  ? 'bg-white text-[#242424] border border-[#cbd5e1] shadow-2xs'
                  : 'text-[#605e5c] hover:bg-[#f3f2f1]'
              }`}
            >
              Raw Check History Logs ({filteredRecords.length})
            </button>
          </div>

          <div className="text-[11px] text-[#605e5c]">
            {complianceTab === 'history'
              ? `Showing ${paginatedRecords.length} of ${filteredRecords.length} historical logs`
              : `Showing ${paginatedComplianceRows.length} of ${tabComplianceRows.length} resident check obligations`}
          </div>
        </div>

        {/* Tab 1-4: Monthly Compliance Obligation Table */}
        {complianceTab !== 'history' && (
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold select-none">
                  <th className="py-2.5 px-3">Service User</th>
                  <th className="py-2.5 px-3">Flat / Room No</th>
                  <th className="py-2.5 px-3">Property / Site</th>
                  <th className="py-2.5 px-3">Check 1 (by {fmt(windows[0].deadline).slice(0, 5)})</th>
                  <th className="py-2.5 px-3">Check 2 (by {fmt(windows[1].deadline).slice(0, 5)})</th>
                  <th className="py-2.5 px-3 text-center">Frequency</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Last Checked</th>
                  <th className="py-2.5 px-3">Assigned Staff</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {paginatedComplianceRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-neutral-400">
                      <HeartHandshake className="w-8 h-8 mx-auto mb-2 text-neutral-300 opacity-60" />
                      <p className="font-medium text-xs">No service users found in this view</p>
                      <p className="text-[11px] mt-0.5">Every active resident in the selected site and month will appear here.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedComplianceRows.map(row => {
                    const hasOverdue = row.first?.status === 'overdue' || row.second?.status === 'overdue';
                    const lastChecked = row.second?.visitDate || row.first?.visitDate;
                    const lastOfficer = row.second?.completedBy || row.first?.completedBy;

                    return (
                      <tr key={row.subjectKey} className="group hover:bg-[#fbfbfa] transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-neutral-800">{row.suName || 'Service User'}</div>
                          {row.suReference && <div className="text-[10px] text-teal-700 font-mono font-medium">{row.suReference}</div>}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-neutral-800">{row.roomNumber || '—'}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-neutral-800">{row.siteName}</div>
                          {row.propertyName && row.propertyName !== row.siteName && (
                            <div className="text-[10px] text-neutral-500">{row.propertyName}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">{renderObligationCell(row.first, row, 1)}</td>
                        <td className="py-2.5 px-3">{renderObligationCell(row.second, row, 2)}</td>
                        <td className="py-2.5 px-3 text-center">{renderFrequencyBadge(row)}</td>
                        <td className="py-2.5 px-3">{renderComplianceStatus(row)}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-neutral-800">{fmt(lastChecked) || '—'}</div>
                          {lastOfficer && <div className="text-[10px] text-neutral-500 truncate max-w-[120px]">{lastOfficer}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-600">{row.responsible?.name || <span className="text-neutral-400">—</span>}</td>
                        <td className="py-2.5 px-3 text-right">
                          {hasOverdue ? (
                            <button
                              type="button"
                              onClick={() => handleQuickResolve(row)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xs text-[11px] shadow-2xs transition-colors cursor-pointer"
                            >
                              Resolve Check {row.first && !isSatisfied(row.first.status) ? 1 : 2}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleQuickResolve(row)}
                              className="px-2 py-1 bg-white hover:bg-[#f3f2f1] text-[#0d9488] font-semibold rounded-xs text-[11px] border border-[#cbd5e1] transition-colors cursor-pointer"
                            >
                              {row.overall === 'complete' ? 'Record Extra Check' : `Record Check ${row.first && !isSatisfied(row.first.status) ? 1 : 2}`}
                            </button>
                          )}
                          <div className="mt-1 flex flex-col items-end gap-0.5">
                            {([row.first, row.second] as Array<CheckObligation | null>).map((o, i) => {
                              const rec = recordedFor(o);
                              if (!rec) return null;
                              return (
                                <div key={i} className="flex items-center gap-0.5">
                                  <span className="text-[10px] text-neutral-500 mr-0.5">Check {i + 1}</span>
                                  <button type="button" onClick={() => handleOpenView(rec)} title={`View Check ${i + 1}`} className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#f0efeb] rounded cursor-pointer"><Eye className="w-3.5 h-3.5" /></button>
                                  {canEditRecord() && <button type="button" onClick={() => handleOpenEdit(rec)} title={`Edit Check ${i + 1}`} className="p-1 text-neutral-500 hover:text-blue-600 hover:bg-[#f0efeb] rounded cursor-pointer"><Edit3 className="w-3.5 h-3.5" /></button>}
                                  {canDeleteRecord() && <button type="button" onClick={() => deleteWelfareCheck(rec.id)} title={`Delete Check ${i + 1}`} className="p-1 text-neutral-500 hover:text-red-600 hover:bg-[#f0efeb] rounded cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
                                </div>
                              );
                            })}
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

        {/* Tab 5: Raw Check History Logs */}
        {complianceTab === 'history' && (
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold select-none">
                  {visibleColumns.map(col => {
                    const isSorted = sortKey === col.key;
                    return (
                      <th 
                        key={String(col.key)} 
                        className="py-2.5 px-3 cursor-pointer hover:bg-[#edebe9] transition-colors"
                        onClick={() => {
                          if (sortKey === col.key) {
                            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey(col.key as keyof WelfareCheckRecord);
                            setSortOrder('desc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{col.label}</span>
                          {isSorted ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="py-2.5 px-3 whitespace-nowrap">Check</th>
                  <th className="py-2.5 px-3 text-right w-24 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10 select-none">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 2} className="py-12 text-center text-neutral-400">
                      <HeartHandshake className="w-8 h-8 mx-auto mb-2 text-neutral-300 opacity-60" />
                      <p className="font-medium text-xs">No welfare check records found</p>
                      <p className="text-[11px] mt-0.5">Click "New Welfare Check" to log an engagement.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map(rec => (
                    <tr key={rec.id} className="group hover:bg-[#fbfbfa] transition-colors">
                      {visibleColumns.map(col => (
                        <td key={String(col.key)} className="py-2.5 px-3">
                          {renderColumnCell(col, rec)}
                        </td>
                      ))}
                      <td className="py-2.5 px-3 whitespace-nowrap text-neutral-700">{checkLabelOf(rec)}</td>
                      <td className="py-2.5 px-3 text-right sticky right-0 bg-white group-hover:bg-[#fbfbfa] shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenView(rec)}
                            title="View Details"
                            className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEditRecord() && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(rec)}
                              title="Edit Record"
                              className="p-1 text-neutral-500 hover:text-blue-600 hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDeleteRecord() && (
                            <button
                              type="button"
                              onClick={() => deleteWelfareCheck(rec.id)}
                              title="Delete Record"
                              className="p-1 text-neutral-500 hover:text-red-600 hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
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

        {/* Pagination Footer */}
        <div className="px-3 py-2 border-t border-[#f0f0f0] flex items-center justify-between shrink-0">
          {complianceTab !== 'history' ? (
            <Pagination
              currentPage={compliancePage}
              totalItems={tabComplianceRows.length}
              pageSize={compliancePageSize}
              onPageChange={setCompliancePage}
              onPageSizeChange={() => {}}
            />
          ) : (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredRecords.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      </div>

      {/* CREATE / EDIT 3-COLUMN COMPREHENSIVE MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-3 sm:p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e1dfdd] bg-[#faf9f8] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-[#0d9488]" />
                <div>
                  <h2 className="text-sm font-bold text-[#242424]">{isEditing ? 'Edit Welfare Check' : 'Conduct Welfare Check'}</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Which check this is */}
            <div className={`px-6 py-2 border-b text-xs flex flex-wrap items-center gap-x-3 gap-y-1 ${recording ? 'bg-teal-50 border-teal-100 text-teal-900' : 'bg-neutral-50 border-[#e5e5e5] text-neutral-600'}`}>
              {recording ? (
                <>
                  <span className="font-bold">Recording Check {recording.period} of 2{recording.month ? ` · ${monthLabel(recording.month)}` : ''}</span>
                  {recording.deadline && <span>due by {recording.deadline.split('-').reverse().join('/')}</span>}
                  <span className="text-[11px] opacity-80">Saved against this check; the check date decides whether it counts as on time.</span>
                </>
              ) : (
                <span>Free-standing check: it counts toward Check 1 (1st–{windows[0].deadline.slice(8)}th) or Check 2 (until the {windows[1].deadline.slice(8)}th) by its check date.</span>
              )}
            </div>

            {/* Scrollable 3-Column Form Body */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              <div className="grid grid-cols-1 gap-6">
                {/* COLUMN 1: Location & Resident Engagement */}
                <div className="space-y-5">
                  {/* Subsection: Check Details */}
                  <div className="bg-[#faf9f8] border border-[#e5e5e5] rounded-xs p-4 space-y-3">
                    <h3 className="font-semibold text-neutral-800 pb-1 border-b border-neutral-200 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-[#0d9488]" />
                      <span>Check Details &amp; Location</span>
                    </h3>

                    {/* Central Master SU Selector */}
                    <div className="p-3 bg-white border border-teal-100 rounded-xs shadow-2xs space-y-2">
                      <div className="text-[11px] font-semibold text-teal-800 uppercase tracking-wider">
                        Master Data Selection
                      </div>
                      <SiteServiceUserSelector
                        selectedSiteId={formData.siteId}
                        selectedSuId={formData.suId}
                        onSelect={(sel) => {
                          setFormData(prev => ({
                            ...prev,
                            siteName: sel.siteName,
                            siteId: sel.siteId,
                            suId: sel.suId,
                            propertyId: sel.propertyId,
                            roomId: sel.roomId,
                            portReference: sel.externalReference || '',
                            flatNumber: sel.roomNumber && sel.roomNumber !== 'Unassigned Room' ? sel.roomNumber : ''
                          }));
                        }}
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Check Date &amp; Time *</label>
                      <input
                        type="datetime-local"
                        value={formData.checkDatetime}
                        onChange={e => setFormData({ ...formData, checkDatetime: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs focus:border-[#0d9488] outline-hidden"
                      />
                      {formErrors.checkDatetime && <p className="text-red-500 text-[10px] mt-0.5">{formErrors.checkDatetime}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-medium text-neutral-700 mb-1">SU Port / Ref *</label>
                        <input
                          type="text"
                          placeholder="From the Service User profile"
                          value={formData.portReference || ''}
                          readOnly
                          className="w-full p-2 border border-teal-200 rounded-xs bg-teal-50/50 text-xs font-mono cursor-not-allowed outline-hidden"
                        />
                        {formErrors.portReference && <p className="text-red-500 text-[10px] mt-0.5">{formErrors.portReference}</p>}
                      </div>
                      <div>
                        <label className="block font-medium text-neutral-700 mb-1">Room / Flat</label>
                        <input
                          type="text"
                          placeholder="From the Service User profile"
                          value={formData.flatNumber || ''}
                          readOnly
                          className="w-full p-2 border border-teal-200 rounded-xs bg-teal-50/50 text-xs cursor-not-allowed outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Overall Status</label>
                      <select
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs focus:border-[#0d9488] outline-hidden"
                      >
                        <option value="Completed">Completed</option>
                        <option value="Issues Identified">Issues Identified</option>
                        <option value="Follow-up Required">Follow-up Required</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-medium text-neutral-700">Conducting Officer</label>
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Locked to session</span>
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={formData.officerName || loggedInUserName}
                        className="w-full p-2 border border-[#e1dfdd] rounded-xs bg-[#f3f2f1] text-[#323130] font-medium text-xs cursor-not-allowed select-none outline-hidden"
                      />
                      <p className="text-[10px] text-neutral-400 mt-0.5">Automatically recorded as the currently authenticated user.</p>
                    </div>

                    <div className="pt-1">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.safeguardingStatementAgreement}
                          onChange={e => setFormData({ ...formData, safeguardingStatementAgreement: e.target.checked })}
                          className="rounded border-neutral-300 text-[#0d9488] mt-0.5"
                        />
                        <span className="text-neutral-700 text-xs">I agree with safeguarding compliance policy &amp; audit declarations</span>
                      </label>
                    </div>
                  </div>

                  {/* Subsection: Contact & Engagement */}
                  <div className="bg-[#faf9f8] border border-[#e5e5e5] rounded-xs p-4 space-y-3">
                    <h3 className="font-semibold text-neutral-800 pb-1 border-b border-neutral-200 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-[#0d9488]" />
                      <span>Contact &amp; Engagement</span>
                    </h3>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Location Type</label>
                      <select
                        value={formData.locationType}
                        onChange={e => setFormData({ ...formData, locationType: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs focus:border-[#0d9488] outline-hidden"
                      >
                        <option value="In Person - Flat">In Person - Flat / Room</option>
                        <option value="In Person - Communal">In Person - Communal Area</option>
                        <option value="Telephone">Telephone</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {formData.locationType === 'Other' && (
                      <div>
                        <label className="block font-medium text-neutral-700 mb-1">Specify Other Location</label>
                        <input
                          type="text"
                          value={formData.locationOther || ''}
                          onChange={e => setFormData({ ...formData, locationOther: e.target.value })}
                          className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-medium text-neutral-700 mb-1">Contact Method</label>
                        <select
                          value={formData.contactMethod}
                          onChange={e => setFormData({ ...formData, contactMethod: e.target.value })}
                          className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs focus:border-[#0d9488] outline-hidden"
                        >
                          <option value="In Person">In Person</option>
                          <option value="Phone Call">Phone Call</option>
                          <option value="Virtual / WhatsApp">WhatsApp</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-medium text-neutral-700 mb-1">Occupancy</label>
                        <select
                          value={formData.familyOrIndividual}
                          onChange={e => setFormData({ ...formData, familyOrIndividual: e.target.value as any })}
                          className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs focus:border-[#0d9488] outline-hidden"
                        >
                          <option value="Individual">Individual</option>
                          <option value="Family">Family</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.wantsWelfareEngagement}
                          onChange={e => setFormData({ ...formData, wantsWelfareEngagement: e.target.checked })}
                          className="rounded border-neutral-300 text-[#0d9488]"
                        />
                        <span className="text-neutral-700 text-xs">Resident welcomed welfare engagement</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.validPortReference}
                          onChange={e => setFormData({ ...formData, validPortReference: e.target.checked })}
                          className="rounded border-neutral-300 text-[#0d9488]"
                        />
                        <span className="text-neutral-700 text-xs">Port reference verified against ID / paperwork</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: Health, GP & Wellbeing */}
                <div className="space-y-5">
                  {/* Subsection: GP & Physical Health */}
                  <div className="bg-[#faf9f8] border border-[#e5e5e5] rounded-xs p-4 space-y-3">
                    <h3 className="font-semibold text-neutral-800 pb-1 border-b border-neutral-200 flex items-center gap-1.5">
                      <Stethoscope className="w-4 h-4 text-[#0d9488]" />
                      <span>GP &amp; Physical Health</span>
                    </h3>

                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.gpRegistered}
                          onChange={e => setFormData({ ...formData, gpRegistered: e.target.checked })}
                          className="rounded border-neutral-300 text-[#0d9488]"
                        />
                        <span className="text-neutral-800 text-xs font-medium">Service User is registered with a GP Surgery</span>
                      </label>
                    </div>

                    {formData.gpRegistered && (
                      <div>
                        <label className="block font-medium text-neutral-700 mb-1">GP Surgery Practice / Details</label>
                        <input
                          type="text"
                          placeholder="e.g. Westside Medical Centre, Dr. Smith"
                          value={formData.gpDetails || ''}
                          onChange={e => setFormData({ ...formData, gpDetails: e.target.value })}
                          className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs focus:border-[#0d9488] outline-hidden"
                        />
                      </div>
                    )}

                    <div className="pt-1 border-t border-neutral-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.physicalHealthChange}
                          onChange={e => setFormData({ ...formData, physicalHealthChange: e.target.checked })}
                          className="rounded border-neutral-300 text-red-600"
                        />
                        <span className="text-neutral-800 text-xs font-medium">Any changes or deterioration in physical health?</span>
                      </label>
                    </div>

                    {formData.physicalHealthChange && (
                      <div>
                        <label className="block font-medium text-red-700 mb-1">Physical Health Details / Symptoms / Medication</label>
                        <textarea
                          rows={2}
                          placeholder="Describe symptoms, appointments needed, mobility issues..."
                          value={formData.physicalHealthDetails || ''}
                          onChange={e => setFormData({ ...formData, physicalHealthDetails: e.target.value })}
                          className="w-full p-2 border border-red-200 rounded-xs bg-red-50/40 text-xs focus:bg-white outline-hidden"
                        />
                      </div>
                    )}
                  </div>

                  {/* Subsection: Mental Health & Welfare Needs */}
                  <div className="bg-[#faf9f8] border border-[#e5e5e5] rounded-xs p-4 space-y-3">
                    <h3 className="font-semibold text-neutral-800 pb-1 border-b border-neutral-200 flex items-center gap-1.5">
                      <HeartHandshake className="w-4 h-4 text-[#0d9488]" />
                      <span>Mental Wellbeing &amp; General Welfare</span>
                    </h3>

                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.mentalHealthChange}
                          onChange={e => setFormData({ ...formData, mentalHealthChange: e.target.checked })}
                          className="rounded border-neutral-300 text-red-600"
                        />
                        <span className="text-neutral-800 text-xs font-medium">Concerns identified regarding mental wellbeing or mood</span>
                      </label>
                    </div>

                    {formData.mentalHealthChange && (
                      <div>
                        <label className="block font-medium text-red-700 mb-1">Mental Health &amp; Wellbeing Details</label>
                        <textarea
                          rows={2}
                          placeholder="Observations regarding distress, isolation, anxiety, support required..."
                          value={formData.mentalHealthDetails || ''}
                          onChange={e => setFormData({ ...formData, mentalHealthDetails: e.target.value })}
                          className="w-full p-2 border border-red-200 rounded-xs bg-red-50/40 text-xs focus:bg-white outline-hidden"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Other Welfare Issues / Family Needs</label>
                      <textarea
                        rows={2}
                        placeholder="Clothing, baby items, language support, religious needs..."
                        value={formData.otherWelfareIssues || ''}
                        onChange={e => setFormData({ ...formData, otherWelfareIssues: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs focus:border-[#0d9488] outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Subsection: Health Awareness */}
                  <div className="bg-[#faf9f8] border border-[#e5e5e5] rounded-xs p-4 space-y-2">
                    <h3 className="font-semibold text-neutral-800 pb-1 border-b border-neutral-200 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-[#0d9488]" />
                      <span>Health &amp; Infection Awareness</span>
                    </h3>
                    {[
                      { key: 'coronavirusAwareness', label: 'SU has general coronavirus & infectious disease awareness' },
                      { key: 'coronavirusSymptomsAwareness', label: 'SU is aware of infectious disease symptoms (fever, cough, fatigue)' },
                      { key: 'previousCoronavirus', label: 'SU previously tested positive or suffered from severe symptoms' },
                      { key: 'knowsSymptomAction', label: 'SU knows immediate action to take if symptoms arise' },
                      { key: 'knowsWorseningContact', label: 'SU knows who to contact if condition worsens (NHS 111 / 999)' },
                      { key: 'knowsAssistanceContact', label: 'SU knows emergency support contact details at the property' },
                    ].map(item => (
                      <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean((formData as any)[item.key])}
                          onChange={e => setFormData({ ...formData, [item.key]: e.target.checked })}
                          className="rounded border-neutral-300 text-[#0d9488]"
                        />
                        <span className="text-neutral-700 text-xs">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* COLUMN 3: Safety, Maintenance & Confidential Safeguarding */}
                <div className="space-y-5">
                  {/* Subsection: Property Safety & Maintenance */}
                  <div className="bg-[#faf9f8] border border-[#e5e5e5] rounded-xs p-4 space-y-3">
                    <h3 className="font-semibold text-neutral-800 pb-1 border-b border-neutral-200 flex items-center gap-1.5">
                      <Home className="w-4 h-4 text-[#0d9488]" />
                      <span>Property Safety &amp; Maintenance</span>
                    </h3>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.windowRestrictorsIntact}
                          onChange={e => setFormData({ ...formData, windowRestrictorsIntact: e.target.checked })}
                          className="rounded border-neutral-300 text-[#0d9488]"
                        />
                        <span className="text-neutral-700 text-xs font-medium">Window restrictors in place, intact and not bypassed</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.smokeAlarmsWorking}
                          onChange={e => setFormData({ ...formData, smokeAlarmsWorking: e.target.checked })}
                          className="rounded border-neutral-300 text-[#0d9488]"
                        />
                        <span className="text-neutral-700 text-xs font-medium">Smoke alarms / detectors working and uncovered</span>
                      </label>
                    </div>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Maintenance Issues Reported During Check</label>
                      <textarea
                        rows={2}
                        placeholder="Leaks, heating, lighting, locks or repairs requested..."
                        value={formData.maintenanceIssues || ''}
                        onChange={e => setFormData({ ...formData, maintenanceIssues: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs focus:border-[#0d9488] outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Subsection: Confidential Safeguarding Notes */}
                  <div className="bg-amber-50/40 border-2 border-amber-300 rounded-xs p-4 space-y-3">
                    <div className="flex items-start gap-2 text-amber-900 pb-1 border-b border-amber-200">
                      <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide">
                          DO NOT SHARE WITH SU — Confidential
                        </h4>
                        <p className="text-[10px] text-amber-800">
                          Strictly for Housing Officers &amp; Management. Never share with resident.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-800 mb-1">
                        Safeguarding / Welfare Concerns Identified
                      </label>
                      <textarea
                        rows={6}
                        placeholder="Record professional observations, safeguarding flags, indicators of exploitation, radicalisation, abuse, or escalation recommendations..."
                        value={formData.safeguardingConcerns || ''}
                        onChange={e => setFormData({ ...formData, safeguardingConcerns: e.target.value })}
                        className="w-full p-2.5 border border-amber-300 bg-white rounded-xs text-xs focus:border-amber-500 outline-hidden font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-[#e5e5e5] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-1.5 border border-neutral-300 text-neutral-700 rounded-xs hover:bg-neutral-100 transition-colors cursor-pointer text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold rounded-xs transition-colors shadow-2xs cursor-pointer text-xs"
                >
                  {isEditing ? 'Save Changes' : 'Submit Welfare Check'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL VIEW MODAL */}
      {isViewOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-3 sm:p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#e1dfdd] bg-[#faf9f8] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-[#0d9488]" />
                <div>
                  <h3 className="text-sm font-bold text-[#242424]">Welfare Check — {selectedRecord.portReference}</h3>
                  <p className="text-[11px] text-neutral-500">{selectedRecord.siteName} • {selectedRecord.checkDatetime ? new Date(selectedRecord.checkDatetime).toLocaleString() : ''}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsViewOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-neutral-50 p-3 rounded-xs border border-neutral-200">
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Port Reference</span>
                  <span className="font-mono font-bold text-[#0d9488]">{selectedRecord.portReference}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Room / Flat</span>
                  <span className="font-semibold">{selectedRecord.flatNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Officer</span>
                  <span>{selectedRecord.officerName || 'Staff'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Cohort</span>
                  <span>{selectedRecord.familyOrIndividual}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Contact Method</span>
                  <span>{selectedRecord.contactMethod}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Status</span>
                  <span className="font-semibold text-teal-700">{selectedRecord.status}</span>
                </div>
              </div>

              {/* Health section */}
              <div className="p-3 border border-neutral-200 rounded-xs space-y-2">
                <h4 className="font-semibold text-neutral-800 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-[#0d9488]" /> Health &amp; Well-being Summary
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <p><strong>GP Registered:</strong> {selectedRecord.gpRegistered ? `Yes (${selectedRecord.gpDetails || 'Details recorded'})` : 'No'}</p>
                  <p><strong>Physical Health Change:</strong> {selectedRecord.physicalHealthChange ? 'Yes — Changes flagged' : 'No'}</p>
                  <p><strong>Mental Health Change:</strong> {selectedRecord.mentalHealthChange ? 'Yes — Changes flagged' : 'No'}</p>
                  <p><strong>Window Restrictors Intact:</strong> {selectedRecord.windowRestrictorsIntact ? 'Yes' : 'No'}</p>
                  <p><strong>Smoke Alarms Working:</strong> {selectedRecord.smokeAlarmsWorking ? 'Yes' : 'No'}</p>
                </div>
                {selectedRecord.physicalHealthDetails && (
                  <p className="text-[11px] bg-red-50 p-2 rounded border border-red-200 text-red-800">
                    <strong>Physical Details:</strong> {selectedRecord.physicalHealthDetails}
                  </p>
                )}
                {selectedRecord.mentalHealthDetails && (
                  <p className="text-[11px] bg-red-50 p-2 rounded border border-red-200 text-red-800">
                    <strong>Mental Health Details:</strong> {selectedRecord.mentalHealthDetails}
                  </p>
                )}
              </div>

              {/* Maintenance */}
              {selectedRecord.maintenanceIssues && (
                <div className="p-3 border border-amber-200 bg-amber-50/40 rounded-xs">
                  <h4 className="font-semibold text-amber-900 flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-amber-700" /> Maintenance Issues Noted
                  </h4>
                  <p className="text-xs text-amber-950 mt-1">{selectedRecord.maintenanceIssues}</p>
                </div>
              )}

              {/* Safeguarding Confidential Concerns */}
              {canViewSafeguarding && selectedRecord.safeguardingConcerns ? (
                <div className="p-3 border-2 border-red-300 bg-red-50/50 rounded-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-red-800 font-bold uppercase tracking-wider text-[10px]">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <span>RESTRICTED INTERNAL SAFEGUARDING NOTES</span>
                  </div>
                  <p className="text-xs text-red-950 whitespace-pre-wrap">{selectedRecord.safeguardingConcerns}</p>
                </div>
              ) : null}
            </div>

            <div className="px-6 py-3 border-t border-[#e1dfdd] bg-[#faf9f8] flex justify-end">
              <button
                type="button"
                onClick={() => setIsViewOpen(false)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xs transition-colors cursor-pointer text-xs"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Table Customization Modal for Super Admin */}
      <TableSchemaEditorModal<WelfareCheckRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Welfare Checks"
        columns={schemaColumns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
