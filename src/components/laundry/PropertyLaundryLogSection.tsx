import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  X, 
  Shirt, 
  RotateCcw, 
  CalendarDays,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Eye,
  Lock,
  UserCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PropertyLaundryLog, RecordAttachment } from '../../types';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { WeekSwitcher } from '../common/WeekSwitcher';
import { validateLaundryLog } from '../../utils/validationSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { AttachmentsSection } from '../common/AttachmentsSection';
import { useTableSchema } from '../../hooks/useTableSchema';
import { PROPERTY_LAUNDRY_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableColumnConfig } from '../../types/tableSchema';

const propertyLaundryExportColumns: ExportColumnOption[] = [
  { id: 'site', label: 'Property / Hotel' },
  { id: 'periodType', label: 'Log Type' },
  { id: 'periodLabel', label: 'Period / Date Range' },
  { id: 'startDate', label: 'Date From' },
  { id: 'endDate', label: 'Date To' },
  { id: 'dirtyLaundrySent', label: 'Dirty Laundry Sent' },
  { id: 'cleanLaundryReturned', label: 'Clean Laundry Returned' },
  { id: 'discrepanciesCount', label: 'Discrepancies' },
  { id: 'hasDiscrepancy', label: 'Has Discrepancy?' },
  { id: 'discrepancyDetails', label: 'Discrepancy Details' },
  { id: 'remarksActionsTaken', label: 'Remarks / Actions Taken' },
  { id: 'loggedBy', label: 'Logged By' },
  { id: 'createdAt', label: 'Date Recorded' }
];

// Helper to get ISO week number
function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper to add days to a ISO date string
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Ordinal helper: 1st, 2nd, 3rd, 4th...
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Helper to get Monday and Sunday of the week containing a date
function getWeekBounds(dateStr: string): { start: string; end: string; weekNum: number } {
  const d = new Date(dateStr || new Date());
  if (isNaN(d.getTime())) {
    const today = new Date();
    return { start: today.toISOString().slice(0, 10), end: today.toISOString().slice(0, 10), weekNum: 1 };
  }
  const day = d.getDay();
  const diffToMon = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
    weekNum: getISOWeekNumber(monday)
  };
}

// Format period label from start and end dates
function formatPeriodFromDates(
  startDateStr: string,
  endDateStr: string,
  periodType: 'Weekly' | 'Monthly'
): { periodLabel: string; startDate: string; endDate: string } {
  const start = new Date(startDateStr || new Date());
  const end = new Date(endDateStr || startDateStr || new Date());
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      periodLabel: 'Current Period',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10)
    };
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (periodType === 'Monthly') {
    const monthName = monthNames[end.getMonth()];
    const yearFull = end.getFullYear();
    const firstDay = new Date(end.getFullYear(), end.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).toISOString().slice(0, 10);
    return {
      periodLabel: `${monthName} ${yearFull} (Monthly)`,
      startDate: firstDay,
      endDate: lastDay
    };
  }

  // Weekly format: "Week 27 (06th to 12th of July 26)"
  const weekNum = getISOWeekNumber(start);
  const startDayOrd = getOrdinal(start.getDate());
  const endDayOrd = getOrdinal(end.getDate());
  const monthName = monthNames[end.getMonth()];
  const yearShort = end.getFullYear().toString().slice(-2);

  return {
    periodLabel: `Week ${weekNum} (${startDayOrd} to ${endDayOrd} of ${monthName} ${yearShort})`,
    startDate: startDateStr,
    endDate: endDateStr
  };
}

export const PropertyLaundryLogSection: React.FC = () => {
  const {
    propertyLaundryLogs,
    allowedSites,
    addPropertyLaundryLog,
    updatePropertyLaundryLog,
    deletePropertyLaundryLog,
    canCreateRecord,
    canDeleteRecord,
    canEditRecord,
    canAccessAllSites,
    assignedSite,
    sites,
    authProfile,
    currentUserName,
    currentUserRole,
    settings
  } = useApp();

  const userAssignedHotel = useMemo(() => {
    if (assignedSite && assignedSite !== 'All Sites' && assignedSite !== 'all') {
      return assignedSite;
    }
    if (authProfile?.assignedSite && authProfile.assignedSite !== 'All Sites' && authProfile.assignedSite !== 'all') {
      return authProfile.assignedSite;
    }
    const pAny = authProfile as any;
    if (pAny?.assigned_site && pAny.assigned_site !== 'All Sites' && pAny.assigned_site !== 'all') {
      return pAny.assigned_site;
    }
    if (pAny?.hotel && pAny.hotel !== 'All Sites' && pAny.hotel !== 'all') {
      return pAny.hotel;
    }
    if (allowedSites && allowedSites.length > 0 && allowedSites[0] !== 'All Sites' && allowedSites[0] !== 'all') {
      return allowedSites[0];
    }
    const firstReal = sites?.find(s => {
      const name = typeof s === 'string' ? s : s?.name;
      return name && name !== 'All Sites' && name !== 'all';
    });
    if (firstReal) {
      return typeof firstReal === 'string' ? firstReal : firstReal.name;
    }
    return '';
  }, [assignedSite, authProfile, allowedSites, sites]);

  const defaultAuditor = useMemo(() => {
    return authProfile?.name || authProfile?.email || currentUserName || currentUserRole || 'Staff Member';
  }, [authProfile, currentUserName, currentUserRole]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayBounds = useMemo(() => getWeekBounds(todayStr), [todayStr]);

  // Filter states
  const [siteFilter, setSiteFilter] = useState<string>(canAccessAllSites() ? 'all' : userAssignedHotel);
  const [periodTypeFilter, setPeriodTypeFilter] = useState<'all' | 'Weekly' | 'Monthly'>('all');
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'all' | 'flagged' | 'reconciled'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [activeWeekCursor, setActiveWeekCursor] = useState<string>(() => todayBounds.start);

  const activeWeekBounds = useMemo(() => {
    if (activeWeekCursor === 'all') {
      return { start: todayBounds.start, end: todayBounds.end, label: 'All Weeks (Entire History)', weekNum: todayBounds.weekNum };
    }
    return getWeekBounds(activeWeekCursor || todayStr);
  }, [activeWeekCursor, todayBounds, todayStr]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(settings.pageSize || 10);

  // Dynamic Table Schema & Columns Hook
  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<PropertyLaundryLog>('propertyLaundry', PROPERTY_LAUNDRY_TABLE_COLUMNS);

  // Modal states
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<PropertyLaundryLog | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<PropertyLaundryLog | null>(null);

  // Initial Form Calculation (Week bounds for today)
  const initialWeeklyPeriod = useMemo(
    () => formatPeriodFromDates(todayBounds.start, todayBounds.end, 'Weekly'),
    [todayBounds]
  );

  const initialFormData = {
    site: !canAccessAllSites() 
      ? userAssignedHotel 
      : (siteFilter !== 'all' ? siteFilter : (userAssignedHotel || allowedSites[0] || '')),
    periodType: 'Weekly' as 'Weekly' | 'Monthly',
    periodLabel: initialWeeklyPeriod.periodLabel,
    startDate: todayBounds.start,
    endDate: todayBounds.end,
    // Attested figures and narrative start empty. They previously opened
    // pre-filled (115 sent / 115 returned, plus written remarks), which meant
    // the form had no invalid controls and a single click on "Add Log Record"
    // filed a complete compliance record nobody had actually entered.
    // Site and the period dates remain defaulted — they are context, not
    // attestations, and the operator can see and change them.
    dirtyLaundrySent: '' as number | '',
    cleanLaundryReturned: '' as number | '',
    discrepanciesCount: 0,
    hasDiscrepancy: false,
    discrepancyDetails: '',
    remarksActionsTaken: '',
    loggedBy: defaultAuditor,
    attachments: [] as RecordAttachment[]
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (!canAccessAllSites() && assignedSite) {
      setFormData(prev => ({ ...prev, site: assignedSite }));
    }
  }, [canAccessAllSites, assignedSite]);

  // Handle Date From change with restricted 1-week (max 7 days) enforcement
  const handleStartDateChange = (newStartDate: string, periodType: 'Weekly' | 'Monthly') => {
    if (periodType === 'Monthly') {
      const d = new Date(newStartDate);
      if (!isNaN(d.getTime())) {
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
        const p = formatPeriodFromDates(firstDay, lastDay, 'Monthly');
        setFormData(prev => ({
          ...prev,
          startDate: firstDay,
          endDate: lastDay,
          periodLabel: p.periodLabel
        }));
      }
      return;
    }

    // Weekly: Date To is automatically set to Date From + 6 days (exact 7 days max)
    const newEndDate = addDays(newStartDate, 6);
    const calculated = formatPeriodFromDates(newStartDate, newEndDate, 'Weekly');
    setFormData(prev => ({
      ...prev,
      startDate: newStartDate,
      endDate: newEndDate,
      periodLabel: calculated.periodLabel
    }));
  };

  // Handle Date To change with restriction (max 7 days from startDate)
  const handleEndDateChange = (newEndDate: string, periodType: 'Weekly' | 'Monthly') => {
    if (periodType === 'Monthly') {
      const calculated = formatPeriodFromDates(formData.startDate, newEndDate, 'Monthly');
      setFormData(prev => ({
        ...prev,
        endDate: newEndDate,
        periodLabel: calculated.periodLabel
      }));
      return;
    }

    // Weekly: Ensure Date To is within [startDate, startDate + 6 days]
    const maxEnd = addDays(formData.startDate, 6);
    let validEnd = newEndDate;
    if (validEnd < formData.startDate) {
      validEnd = formData.startDate;
    } else if (validEnd > maxEnd) {
      validEnd = maxEnd;
    }

    const calculated = formatPeriodFromDates(formData.startDate, validEnd, 'Weekly');
    setFormData(prev => ({
      ...prev,
      endDate: validEnd,
      periodLabel: calculated.periodLabel
    }));
  };

  // Handle Log Type toggle
  const handlePeriodTypeChange = (type: 'Weekly' | 'Monthly') => {
    if (type === 'Monthly') {
      const d = new Date(formData.startDate || todayStr);
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const p = formatPeriodFromDates(firstDay, lastDay, 'Monthly');
      setFormData(prev => ({
        ...prev,
        periodType: 'Monthly',
        startDate: firstDay,
        endDate: lastDay,
        periodLabel: p.periodLabel
      }));
    } else {
      const bounds = getWeekBounds(formData.startDate || todayStr);
      const p = formatPeriodFromDates(bounds.start, bounds.end, 'Weekly');
      setFormData(prev => ({
        ...prev,
        periodType: 'Weekly',
        startDate: bounds.start,
        endDate: bounds.end,
        periodLabel: p.periodLabel
      }));
    }
  };

  // Auto-calculate discrepancy count & hasDiscrepancy flag
  const handleCountChange = (sent: number, returned: number) => {
    const diff = Math.abs(sent - returned);
    const hasDisc = sent !== returned;
    setFormData(prev => ({
      ...prev,
      dirtyLaundrySent: sent,
      cleanLaundryReturned: returned,
      discrepanciesCount: diff,
      hasDiscrepancy: hasDisc,
      discrepancyDetails: hasDisc && !prev.discrepancyDetails
        ? `${diff} pcs variance noted upon intake.`
        : (!hasDisc && (!prev.discrepancyDetails || prev.discrepancyDetails.includes('variance noted'))
          ? 'Zero variance. Exact match on collection and return.'
          : prev.discrepancyDetails)
    }));
  };

  const handleEditClick = (log: PropertyLaundryLog) => {
    setEditingLog(log);
    setFormData({
      site: log.site,
      periodType: log.periodType,
      periodLabel: log.periodLabel,
      startDate: log.startDate || todayBounds.start,
      endDate: log.endDate || todayBounds.end,
      dirtyLaundrySent: log.dirtyLaundrySent,
      cleanLaundryReturned: log.cleanLaundryReturned,
      discrepanciesCount: log.discrepanciesCount,
      hasDiscrepancy: log.hasDiscrepancy,
      discrepancyDetails: log.discrepancyDetails || '',
      remarksActionsTaken: log.remarksActionsTaken || '',
      loggedBy: log.loggedBy,
      attachments: (log as any).attachments || []
    });
    setIsCreateModalOpen(true);
  };

  // Extract unique weeks from logs for week switcher dropdown
  const uniqueWeeksInLogs = useMemo(() => {
    const map = new Map<string, { start: string; end: string; label: string }>();
    propertyLaundryLogs.forEach(l => {
      if (l.startDate && l.endDate) {
        const bounds = getWeekBounds(l.startDate);
        const p = formatPeriodFromDates(bounds.start, bounds.end, 'Weekly');
        if (!map.has(bounds.start)) {
          map.set(bounds.start, {
            start: bounds.start,
            end: bounds.end,
            label: p.periodLabel
          });
        }
      }
    });
    // Ensure current week is also in options
    if (!map.has(todayBounds.start)) {
      map.set(todayBounds.start, {
        start: todayBounds.start,
        end: todayBounds.end,
        label: initialWeeklyPeriod.periodLabel
      });
    }
    return Array.from(map.values()).sort((a, b) => b.start.localeCompare(a.start));
  }, [propertyLaundryLogs, todayBounds, initialWeeklyPeriod]);

  // Week Switcher navigation helpers
  const handleMoveWeek = (direction: 'prev' | 'next') => {
    let currentStart = activeWeekCursor === 'all' ? todayBounds.start : activeWeekCursor;
    const offset = direction === 'prev' ? -7 : 7;
    const newStart = addDays(currentStart, offset);
    setActiveWeekCursor(newStart);
  };

  const activeWeekInfo = useMemo(() => {
    if (activeWeekCursor === 'all') return null;
    const bounds = getWeekBounds(activeWeekCursor);
    return formatPeriodFromDates(bounds.start, bounds.end, 'Weekly');
  }, [activeWeekCursor]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return propertyLaundryLogs.filter(l => {
      if (siteFilter !== 'all' && l.site !== siteFilter) return false;
      if (periodTypeFilter !== 'all' && l.periodType !== periodTypeFilter) return false;
      if (discrepancyFilter === 'flagged' && !l.hasDiscrepancy && (l.discrepanciesCount || 0) === 0) return false;
      if (discrepancyFilter === 'reconciled' && (l.hasDiscrepancy || (l.discrepanciesCount || 0) > 0)) return false;

      // Week filter
      if (activeWeekCursor !== 'all') {
        const bounds = getWeekBounds(activeWeekCursor);
        const logStart = l.startDate || '';
        const logEnd = l.endDate || logStart;
        // Check if log date overlaps with the active week bounds
        const isOverlap = (logStart <= bounds.end && logEnd >= bounds.start) || 
          (typeof l.periodLabel === 'string' && l.periodLabel.toLowerCase().includes(`week ${bounds.weekNum}`));
        if (!isOverlap) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (l.site || '').toLowerCase().includes(q) ||
          (l.periodLabel || '').toLowerCase().includes(q) ||
          (typeof l.discrepancyDetails === 'string' && l.discrepancyDetails.toLowerCase().includes(q)) ||
          (typeof l.remarksActionsTaken === 'string' && l.remarksActionsTaken.toLowerCase().includes(q)) ||
          (l.loggedBy || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [propertyLaundryLogs, siteFilter, periodTypeFilter, discrepancyFilter, activeWeekCursor, searchQuery]);

  // Sort State
  const [sortField, setSortField] = useState<string>('startDate');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Sort filtered data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA: any = (a as any)[sortField] ?? '';
      let valB: any = (b as any)[sortField] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortAsc]);

  const renderColumnCell = (col: TableColumnConfig<PropertyLaundryLog>, log: PropertyLaundryLog) => {
    if (col.renderCell) {
      return col.renderCell((log as any)[col.key], log);
    }

    const value = (log as any)[col.key];

    if (col.key === 'site') {
      return (
        <div className="flex items-center gap-1.5 font-semibold text-[#242424]">
          <Building2 className="w-4 h-4 text-[#0d9488]" />
          <span>{log.site}</span>
        </div>
      );
    }

    if (col.key === 'periodType') {
      return (
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
          log.periodType === 'Weekly' ? 'bg-teal-100 text-teal-900' : 'bg-purple-100 text-purple-900'
        }`}>
          {log.periodType} Log
        </span>
      );
    }

    if (col.key === 'periodLabel') {
      return (
        <div>
          <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold mr-1.5 ${
            log.periodType === 'Weekly' ? 'bg-teal-100 text-teal-900' : 'bg-purple-100 text-purple-900'
          }`}>
            {log.periodType}
          </span>
          <span className="text-xs text-neutral-700 font-medium">{log.periodLabel}</span>
        </div>
      );
    }

    if (col.key === 'dirtyLaundrySent') {
      return (
        <span className="font-mono font-bold text-slate-800 text-sm">
          {value ?? 0}
        </span>
      );
    }

    if (col.key === 'cleanLaundryReturned') {
      return (
        <span className="font-mono font-bold text-emerald-800 text-sm">
          {value ?? 0}
        </span>
      );
    }

    if (col.key === 'discrepanciesCount' || col.key === 'hasDiscrepancy') {
      const hasDiscrepancy = log.hasDiscrepancy || (log.discrepanciesCount || 0) > 0;
      return hasDiscrepancy ? (
        <div className="inline-flex flex-col items-center">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold">
            <AlertTriangle className="w-3 h-3 text-amber-700" />
            Yes ({log.discrepanciesCount || 0} missing)
          </span>
        </div>
      ) : (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-semibold">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          No (0)
        </span>
      );
    }

    if (col.badgeColors && value) {
      const badgeClass = col.badgeColors[value] || 'bg-gray-100 text-gray-800';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-semibold ${badgeClass}`}>
          {value}
        </span>
      );
    }

    if (col.key === 'discrepancyDetails') {
      return log.discrepancyDetails ? (
        <span className="leading-relaxed font-medium">{log.discrepancyDetails}</span>
      ) : (
        <span className="text-neutral-400 italic">—</span>
      );
    }

    if (col.key === 'remarksActionsTaken') {
      return log.remarksActionsTaken ? (
        <span className="leading-relaxed">{log.remarksActionsTaken}</span>
      ) : (
        <span className="text-neutral-400 italic">No specific actions required</span>
      );
    }

    if (col.key === 'loggedBy') {
      return <span className="text-neutral-600 text-xs whitespace-nowrap">{value || '—'}</span>;
    }

    if (col.type === 'date') {
      return <span className="font-mono text-[#323130]">{value || '—'}</span>;
    }

    if (value === null || value === undefined || value === '') {
      return <span className="text-[#a19f9d]">—</span>;
    }

    return String(value);
  };

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Zod validation check before invoking data service
    const payloadToValidate = {
      site: formData.site,
      date: formData.startDate || todayStr,
      startDate: formData.startDate,
      endDate: formData.endDate,
      dirtyLaundrySent: Number(formData.dirtyLaundrySent || 0),
      cleanLaundryReturned: Number(formData.cleanLaundryReturned || 0),
      discrepanciesCount: Number(formData.discrepanciesCount || 0),
      hasDiscrepancy: Boolean(formData.hasDiscrepancy),
      loggedBy: formData.loggedBy || 'System User'
    };

    const valResult = validateLaundryLog(payloadToValidate);
    if (valResult.success === false) {
      const firstErr = Object.values(valResult.errors)[0];
      alert(`Validation Error: ${firstErr}`);
      return;
    }

    const isSuperAdmin = currentUserRole === 'Super Admin';
    if (!isSuperAdmin) {
      if (!editingLog && formData.startDate < todayStr) {
        alert('Date From cannot be in the past (must be today or later). Only Super Admin can log records for past dates.');
        return;
      }
      if (editingLog && formData.startDate < todayStr && formData.startDate !== editingLog.startDate) {
        alert('Date From cannot be changed to a past date. Only Super Admin can select past dates.');
        return;
      }
    }

    const effectiveSite = !canAccessAllSites()
      ? userAssignedHotel
      : (formData.site || userAssignedHotel || allowedSites[0] || '');

    // The two attested counts are held as '' until the operator types a figure,
    // so normalise them to numbers before they leave the form.
    const primaryAtt = (formData as any).attachments && (formData as any).attachments.length > 0 ? (formData as any).attachments[0] : null;
    const primaryLink = primaryAtt?.url || primaryAtt?.dataUrl || '';
    const normalised = {
      ...formData,
      site: effectiveSite,
      dirtyLaundrySent: Number(formData.dirtyLaundrySent || 0),
      cleanLaundryReturned: Number(formData.cleanLaundryReturned || 0),
      attachments: Array.isArray((formData as any).attachments) ? (formData as any).attachments : [],
      attachmentUrl: primaryLink,
      attachment_url: primaryLink,
      fileUrl: primaryLink,
      file_url: primaryLink
    };

    if (editingLog) {
      updatePropertyLaundryLog(editingLog.id, normalised);
      setEditingLog(null);
    } else {
      addPropertyLaundryLog(normalised);
    }
    setIsCreateModalOpen(false);
    setFormData(initialFormData);
  };

  // Export Data Preparation
  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    if (scope === 'filtered') return sortedData;
    if (scope === 'custom' && startDate && endDate) {
      return propertyLaundryLogs.filter(
        l => (l.startDate || l.createdAt.slice(0, 10)) >= startDate && (l.endDate || l.createdAt.slice(0, 10)) <= endDate
      );
    }
    return propertyLaundryLogs;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (l: PropertyLaundryLog) => string | number }> => ({
    site: { label: 'Property / Hotel', getValue: l => l.site },
    periodType: { label: 'Log Type', getValue: l => l.periodType },
    periodLabel: { label: 'Period / Date Range', getValue: l => l.periodLabel },
    startDate: { label: 'Date From', getValue: l => l.startDate || '—' },
    endDate: { label: 'Date To', getValue: l => l.endDate || '—' },
    dirtyLaundrySent: { label: 'Dirty Sent (pcs)', getValue: l => l.dirtyLaundrySent },
    cleanLaundryReturned: { label: 'Clean Returned (pcs)', getValue: l => l.cleanLaundryReturned },
    discrepanciesCount: { label: 'Discrepancy Count', getValue: l => l.discrepanciesCount },
    hasDiscrepancy: { label: 'Has Discrepancy?', getValue: l => l.hasDiscrepancy ? 'Yes' : 'No' },
    discrepancyDetails: { label: 'Discrepancy Details', getValue: l => l.discrepancyDetails || '—' },
    remarksActionsTaken: { label: 'Remarks / Actions Taken', getValue: l => l.remarksActionsTaken || '—' },
    loggedBy: { label: 'Logged / Audited By', getValue: l => l.loggedBy },
    createdAt: { label: 'Date Recorded', getValue: l => l.createdAt.slice(0, 10) }
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
      : propertyLaundryExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(l => activeCols.map(c => colMap[c].getValue(l)));
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
      : propertyLaundryExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(l => activeCols.map(c => colMap[c].getValue(l)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `Property-Laundry-Register-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: 'Property Laundry Weekly & Monthly Intake Register',
        subtitle: 'Dirty Laundry Sent, Clean Laundry Returned, Discrepancies, and Action Logs across Contracted Hotels.',
        filename: `Property-Laundry-Register-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        orientation: orientation || 'landscape',
        isCompact: isCompact !== false,
        metadata: [
          { label: 'Site Scope', value: siteFilter === 'all' ? 'All Properties' : siteFilter },
          { label: 'Log Type', value: periodTypeFilter },
          { label: 'Week Filter', value: activeWeekCursor === 'all' ? 'All Weeks' : activeWeekInfo?.periodLabel || activeWeekCursor },
          { label: 'Total Records', value: dataToExport.length }
        ]
      });
    }
  };

  const calculateDateRangeCount = (start: string, end: string) => {
    return propertyLaundryLogs.filter(
      l => (l.startDate || l.createdAt.slice(0, 10)) >= start && (l.endDate || l.createdAt.slice(0, 10)) <= end
    ).length;
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <Shirt className="w-5 h-5 text-[#0d9488]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">
              Property Laundry Register
            </h1>
            <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#99f6e4]">
              {sortedData.length} Laundry Logs
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Dirty laundry dispatched, clean laundry returned, reconciliation variance, and discrepancy tracking.
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

          {/* Custom Export Dropdown & Modal */}
          <ExportDropdown
            moduleName="Property Laundry Register"
            totalRecordCount={propertyLaundryLogs.length}
            filteredRecordCount={sortedData.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={propertyLaundryExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />

          {canCreateRecord() && (
            <button
              onClick={() => {
                setEditingLog(null);
                const bounds = todayBounds;
                const wk = formatPeriodFromDates(bounds.start, bounds.end, 'Weekly');
                const effectiveSite = !canAccessAllSites()
                  ? userAssignedHotel
                  : (siteFilter !== 'all' ? siteFilter : (userAssignedHotel || allowedSites[0] || ''));
                setFormData({ 
                  ...initialFormData, 
                  site: effectiveSite,
                  periodType: 'Weekly',
                  startDate: bounds.start,
                  endDate: bounds.end,
                  periodLabel: wk.periodLabel,
                  loggedBy: defaultAuditor
                });
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Log Laundry Batch</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#e1dfdd] p-3 rounded-xs flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Hotel / Property */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c] whitespace-nowrap">Hotel / Property:</span>
            <select
              value={siteFilter}
              onChange={e => setSiteFilter(e.target.value)}
              disabled={!canAccessAllSites()}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs max-w-[160px]"
            >
              {canAccessAllSites() && <option value="all">All Properties</option>}
              {allowedSites.map((s, idx) => <option key={`${s}-${idx}`} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Log Type */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c] whitespace-nowrap">Log Type:</span>
            <select
              value={periodTypeFilter}
              onChange={e => setPeriodTypeFilter(e.target.value as any)}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
            >
              <option value="all">All Logs</option>
              <option value="Weekly">Weekly Logs</option>
              <option value="Monthly">Monthly Logs</option>
            </select>
          </div>

          {/* Discrepancy Status */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c] whitespace-nowrap">Discrepancy:</span>
            <select
              value={discrepancyFilter}
              onChange={e => setDiscrepancyFilter(e.target.value as any)}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="flagged">Discrepancy Flagged</option>
              <option value="reconciled">100% Reconciled</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[130px] flex-1 max-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-[#605e5c]" />
            <input
              type="text"
              placeholder="Search laundry..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2 py-1 border border-[#8a8886] rounded-xs text-xs bg-white focus:outline-2 focus:outline-[#71afe5]"
            />
          </div>
        </div>

        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-[#0d9488] hover:underline font-semibold"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Table Controls Header with Integrated Week Switcher */}
      <div className="bg-[#f3f8fd] border border-[#5eead4] p-2 rounded-xs flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-[#0d9488] text-white font-bold text-xs rounded-xs shadow-2xs">
            Laundry Register
          </span>
          <div className="flex items-center gap-1.5 font-bold text-sm text-[#0f766e]">
            <Building2 className="w-4 h-4 text-[#0d9488]" />
            <span>{siteFilter === 'all' ? 'All Contracted Properties' : siteFilter}</span>
          </div>
        </div>

        {/* Week Switcher right in Table Header */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[#0f766e] whitespace-nowrap">Week Range:</span>
          <WeekSwitcher
            startDate={activeWeekBounds.start}
            endDate={activeWeekBounds.end}
            activeWeekCursor={activeWeekCursor}
            onCursorChange={setActiveWeekCursor}
            onWeekChange={(s) => {
              setActiveWeekCursor(s);
            }}
            availableWeeks={uniqueWeeksInLogs}
            allowAllOption={false}
            compact={true}
          />
        </div>
      </div>

      {/* Main Table Model */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f3f2f1] text-[#242424] font-semibold border-b border-[#edebe9] select-none whitespace-nowrap">
              <tr>
                {visibleColumns.map(col => {
                  const isSorted = sortField === col.key;
                  const isNumber = col.type === 'number';
                  return (
                    <th 
                      key={String(col.key)} 
                      onClick={() => handleSort(String(col.key))} 
                      className={`py-2.5 px-3 cursor-pointer hover:bg-[#edebe9] transition-colors ${isNumber ? 'text-right' : 'text-left'}`}
                      title={`Sort by ${col.label}`}
                    >
                      <div className={`flex items-center gap-1 ${isNumber ? 'justify-end' : 'justify-start'}`}>
                        <span>{col.label}</span>
                        {isSorted ? (
                          sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="py-2.5 px-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-10 text-center text-[#605e5c]">
                    No property laundry logs found matching the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedData.map(log => (
                  <tr key={log.id} className="hover:bg-[#faf9f8] transition-colors">
                    {visibleColumns.map(col => (
                      <td 
                        key={String(col.key)} 
                        className={`py-3 px-3 ${col.type === 'number' ? 'text-right' : 'text-left'}`}
                      >
                        {renderColumnCell(col, log)}
                      </td>
                    ))}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewRecord(log)}
                          className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded"
                          title="View Log Dossier"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditRecord(log.site) && (
                          <button
                            onClick={() => handleEditClick(log)}
                            className="p-1 hover:bg-[#edebe9] text-[#0d9488] rounded"
                            title="Edit Record"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this laundry log?')) {
                                deletePropertyLaundryLog(log.id);
                              }
                            }}
                            className="p-1 hover:bg-red-50 text-[#a4262c] rounded"
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

        {/* Pagination */}
        {sortedData.length > 0 && (
          <div className="p-3 border-t border-[#edebe9]">
            <Pagination
              currentPage={currentPage}
              totalItems={sortedData.length}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-6">
            <div className="px-4 py-3 bg-[#f3f2f1] border-b border-[#e1dfdd] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shirt className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-bold text-[#242424]">
                  {editingLog ? 'Edit Property Laundry Log' : 'Add Property Laundry Log (Weekly / Monthly)'}
                </h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-[#605e5c] hover:text-[#242424]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1 flex items-center justify-between">
                    <span>Property / Hotel *</span>
                    {!canAccessAllSites() && (
                      <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1 py-0.2 rounded font-medium flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5 text-teal-600" /> Locked
                      </span>
                    )}
                  </label>
                  {!canAccessAllSites() ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={userAssignedHotel}
                        readOnly
                        disabled
                        className="w-full p-2 pr-7 border border-teal-200 rounded-xs bg-teal-50/50 text-teal-950 font-medium cursor-not-allowed text-xs"
                      />
                      <Lock className="w-3.5 h-3.5 text-teal-600 absolute right-2 top-1/2 -translate-y-1/2" />
                    </div>
                  ) : (
                    <select
                      value={formData.site}
                      onChange={e => setFormData({ ...formData, site: e.target.value })}
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                      required
                    >
                      {allowedSites.map((s, idx) => <option key={`${s}-${idx}`} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Log Type *</label>
                  <select
                    value={formData.periodType}
                    onChange={e => handlePeriodTypeChange(e.target.value as any)}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                  >
                    <option value="Weekly">Weekly Log (Max 7 Days)</option>
                    <option value="Monthly">Monthly Log</option>
                  </select>
                </div>
              </div>

              {/* Date From & Date To with 1-Week (Max 7 Days) Restriction */}
              <div className="p-3 bg-[#faf9f8] rounded border border-[#edebe9] space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-[#605e5c] mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#0d9488]" />
                        <span>Date From *</span>
                      </span>
                      {currentUserRole !== 'Super Admin' ? (
                        <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1 py-0.2 rounded font-medium">
                          Today or Later
                        </span>
                      ) : (
                        <span className="text-[10px] text-purple-800 bg-purple-50 border border-purple-200 px-1 py-0.2 rounded font-medium">
                          Super Admin: All Dates
                        </span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      min={currentUserRole !== 'Super Admin' ? (editingLog?.startDate && editingLog.startDate < todayStr ? editingLog.startDate : todayStr) : undefined}
                      onChange={e => handleStartDateChange(e.target.value, formData.periodType)}
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-medium"
                      required
                    />
                    {currentUserRole !== 'Super Admin' ? (
                      <p className="text-[10px] text-neutral-500 mt-0.5">
                        Date must be today or later. Only Super Admin can select past dates.
                      </p>
                    ) : (
                      <p className="text-[10px] text-purple-700 mt-0.5">
                        Super Admin: Past dates permitted.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#0d9488]" />
                      <span>Date To (Max 7 Days) *</span>
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      min={formData.startDate}
                      max={formData.periodType === 'Weekly' ? addDays(formData.startDate, 6) : undefined}
                      onChange={e => handleEndDateChange(e.target.value, formData.periodType)}
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="bg-[#f3f8fd] px-2.5 py-1.5 rounded-xs border border-[#5eead4] text-[#0f766e] font-bold text-[11px] flex items-center justify-between">
                  <span>&rarr; Period: {formData.periodLabel}</span>
                  {formData.periodType === 'Weekly' && (
                    <span className="text-[10px] font-semibold text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded">
                      Restricted to 1 Week
                    </span>
                  )}
                </div>
              </div>

              {/* Counts */}
              <div className="grid grid-cols-2 gap-3 bg-[#faf9f8] p-3 rounded border border-[#edebe9]">
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Dirty Laundry Sent (pcs) *</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.dirtyLaundrySent}
                    onChange={e => handleCountChange(parseInt(e.target.value) || 0, Number(formData.cleanLaundryReturned || 0))}
                    className="w-full p-2 border border-[#8a8886] rounded-xs font-mono font-bold text-[#0f766e]"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Clean Laundry Returned (pcs) *</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.cleanLaundryReturned}
                    onChange={e => handleCountChange(Number(formData.dirtyLaundrySent || 0), parseInt(e.target.value) || 0)}
                    className="w-full p-2 border border-[#8a8886] rounded-xs font-mono font-bold text-emerald-800"
                    required
                  />
                </div>
              </div>

              {/* Discrepancy feedback banner */}
              <div className={`p-2.5 rounded text-xs flex items-center justify-between ${
                formData.hasDiscrepancy 
                  ? 'bg-amber-50 border border-amber-300 text-amber-900' 
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex items-center gap-2">
                  {formData.hasDiscrepancy ? (
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>
                    <strong>Discrepancies: </strong>
                    {formData.hasDiscrepancy ? `${formData.discrepanciesCount} pcs variance` : '0 pcs variance (Exact Match)'}
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[11px]">
                  <input
                    type="checkbox"
                    checked={formData.hasDiscrepancy}
                    onChange={e => setFormData({ ...formData, hasDiscrepancy: e.target.checked })}
                    className="rounded accent-amber-600"
                  />
                  <span>Flag as Discrepancy</span>
                </label>
              </div>

              {/* Discrepancy Details text input */}
              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">
                  Discrepancy Details / Item Breakdown (Text Column)
                </label>
                <input
                  type="text"
                  value={formData.discrepancyDetails}
                  onChange={e => setFormData({ ...formData, discrepancyDetails: e.target.value })}
                  placeholder="e.g. 2 bath towels missing from linen bag, or Zero variance verified"
                  className="w-full p-2 border border-[#8a8886] rounded-xs text-[#323130]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">Remarks / Actions Taken</label>
                <textarea
                  rows={2}
                  value={formData.remarksActionsTaken}
                  onChange={e => setFormData({ ...formData, remarksActionsTaken: e.target.value })}
                  placeholder="Tokens distribution matched resident wash bookings. No issues."
                  className="w-full p-2 border border-[#8a8886] rounded-xs text-[#323130]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-teal-600 inline" />
                    <span>Logged By</span>
                  </span>
                  <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-teal-600" /> Locked to Logged-in User
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.loggedBy}
                    readOnly
                    disabled
                    className="w-full p-2 pr-8 border border-teal-200 rounded-xs text-[#323130] bg-teal-50/50 font-semibold cursor-not-allowed opacity-90 text-xs"
                    title="Locked to logged-in user for audit trail and accountability."
                  />
                  <Lock className="w-3.5 h-3.5 text-teal-600 absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Universal Proof & Document Attachments */}
              <AttachmentsSection
                attachments={(formData as any).attachments || []}
                onChange={atts => setFormData(prev => ({ ...prev, attachments: atts }))}
                allowUpload={true}
                entityName="Laundry Log"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#edebe9]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 border border-[#8a8886] rounded-xs text-[#323130] hover:bg-[#f3f2f1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold rounded-xs shadow-xs"
                >
                  {editingLog ? 'Save Updates' : 'Add Log Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic View Dossier Modal */}
      {viewRecord && (
        <DynamicRecordViewModal<PropertyLaundryLog>
          isOpen={Boolean(viewRecord)}
          onClose={() => setViewRecord(null)}
          title={`Property Laundry Log Dossier - ${viewRecord.site} (${viewRecord.periodLabel})`}
          columns={columns}
          record={viewRecord}
          onEdit={() => {
            const rec = viewRecord;
            setViewRecord(null);
            handleEditClick(rec);
          }}
          canEdit={canEditRecord(viewRecord.site)}
        />
      )}

      {/* Super Admin Table Schema Customizer Modal */}
      <TableSchemaEditorModal<PropertyLaundryLog>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Property Laundry Register"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
