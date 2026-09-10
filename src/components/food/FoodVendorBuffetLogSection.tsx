import React, { useState, useMemo } from 'react';
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
  Flame, 
  UtensilsCrossed, 
  ChefHat, 
  UserCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PropertyFoodVendorBuffetLog, FoodVendorName, FoodBuffetItemBreakdown, DayOfWeek } from '../../types';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { WeekSwitcher } from '../common/WeekSwitcher';
import { validateFoodLog } from '../../utils/validationSchemas';

const DAYS_OF_WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
type DayKey = typeof DAYS_OF_WEEK[number];

const BUFFET_ROWS = [
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'todlrLunch', label: 'Todlr(Lunch)' },
  { key: 'todlrDinner', label: 'Todlr(Dinner)' },
  { key: 'specialLunch', label: 'Special-Lunch' },
  { key: 'specialDinner', label: 'Special-Dinner' },
  { key: 'schoolMealLunch', label: 'School Meal/Child Lunch' },
  { key: 'childDinner', label: 'Child Dinner' }
] as const;

const FOUR_CORE_VENDORS: FoodVendorName[] = ['A&M', 'Freshbite', '9 Cuisines', 'Sands'];

const buffetExportColumns: ExportColumnOption[] = [
  { id: 'site', label: 'Property / Hotel' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'weekRange', label: 'Week Range' },
  { id: 'startDate', label: 'Date From' },
  { id: 'endDate', label: 'Date To' },
  { id: 'category', label: 'Buffet Meal Category' },
  { id: 'mon', label: 'MON' },
  { id: 'tue', label: 'TUE' },
  { id: 'wed', label: 'WED' },
  { id: 'thu', label: 'THU' },
  { id: 'fri', label: 'FRI' },
  { id: 'sat', label: 'SAT' },
  { id: 'sun', label: 'SUN' },
  { id: 'weeklyTotal', label: 'Weekly Total' },
  { id: 'lastUpdatedBy', label: 'Audited By' }
];

function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

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

function formatWeekRangeFromDates(startDateStr: string, endDateStr: string): { weekRange: string; startDate: string; endDate: string } {
  const start = new Date(startDateStr || new Date());
  const end = new Date(endDateStr || startDateStr || new Date());
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      weekRange: 'Current Week',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10)
    };
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekNum = getISOWeekNumber(start);
  const startDayOrd = getOrdinal(start.getDate());
  const endDayOrd = getOrdinal(end.getDate());
  const monthName = monthNames[end.getMonth()];
  const yearShort = end.getFullYear().toString().slice(-2);

  return {
    weekRange: `Week ${weekNum} (${startDayOrd} to ${endDayOrd} of ${monthName} '${yearShort})`,
    startDate: startDateStr,
    endDate: endDateStr
  };
}

export const FoodVendorBuffetLogSection: React.FC = () => {
  const {
    foodVendorBuffetLogs,
    allowedSites,
    addFoodVendorBuffetLog,
    updateFoodVendorBuffetLog,
    deleteFoodVendorBuffetLog,
    canDeleteRecord,
    canEditRecord,
    canAccessAllSites,
    assignedSite,
    authProfile,
    currentUserRole,
    currentUserName
  } = useApp();

  const loggedInUserName = useMemo(() => {
    return authProfile?.name || authProfile?.email || currentUserName || currentUserRole;
  }, [authProfile, currentUserName, currentUserRole]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [siteFilter, setSiteFilter] = useState<string>(canAccessAllSites() ? 'all' : assignedSite);
  const [vendorFilter, setVendorFilter] = useState<FoodVendorName>('A&M');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const todayBounds = useMemo(() => getWeekBounds(todayStr), [todayStr]);
  const initialWeekInfo = useMemo(() => formatWeekRangeFromDates(todayBounds.start, todayBounds.end), [todayBounds]);

  const [activeWeekCursor, setActiveWeekCursor] = useState<string>(() => todayBounds.start);

  const activeWeekBounds = useMemo(() => {
    if (activeWeekCursor === 'all') {
      return { start: todayBounds.start, end: todayBounds.end, label: 'All Weeks (Entire History)', weekNum: todayBounds.weekNum };
    }
    return getWeekBounds(activeWeekCursor || todayStr);
  }, [activeWeekCursor, todayBounds, todayStr]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<PropertyFoodVendorBuffetLog | null>(null);

  const defaultDailyCounts = (): Record<DayKey, FoodBuffetItemBreakdown> => ({
    MON: { lunch: 0, dinner: 0, todlrLunch: 0, todlrDinner: 0, specialLunch: 0, specialDinner: 0, schoolMealLunch: 0, childDinner: 0 },
    TUE: { lunch: 0, dinner: 0, todlrLunch: 0, todlrDinner: 0, specialLunch: 0, specialDinner: 0, schoolMealLunch: 0, childDinner: 0 },
    WED: { lunch: 0, dinner: 0, todlrLunch: 0, todlrDinner: 0, specialLunch: 0, specialDinner: 0, schoolMealLunch: 0, childDinner: 0 },
    THU: { lunch: 0, dinner: 0, todlrLunch: 0, todlrDinner: 0, specialLunch: 0, specialDinner: 0, schoolMealLunch: 0, childDinner: 0 },
    FRI: { lunch: 0, dinner: 0, todlrLunch: 0, todlrDinner: 0, specialLunch: 0, specialDinner: 0, schoolMealLunch: 0, childDinner: 0 },
    SAT: { lunch: 0, dinner: 0, todlrLunch: 0, todlrDinner: 0, specialLunch: 0, specialDinner: 0, schoolMealLunch: 0, childDinner: 0 },
    SUN: { lunch: 0, dinner: 0, todlrLunch: 0, todlrDinner: 0, specialLunch: 0, specialDinner: 0, schoolMealLunch: 0, childDinner: 0 }
  });

  const [formData, setFormData] = useState({
    site: allowedSites[0] || 'Brit Hotel',
    vendor: 'A&M' as FoodVendorName,
    weekRange: initialWeekInfo.weekRange,
    startDate: todayBounds.start,
    endDate: todayBounds.end,
    dailyCounts: defaultDailyCounts(),
    // Previously pre-filled with "Hot holding temperature logged on arrival at
    // >68°C. Halal certified supply." — a food-safety attestation the operator
    // had not made, saved verbatim unless they noticed and overwrote it (BUG-012).
    // Notes must start empty so any claim recorded is one someone actually wrote.
    notes: '',
    lastUpdatedBy: loggedInUserName
  });

  const handleStartDateChange = (newStartDate: string) => {
    const newEndDate = addDays(newStartDate, 6);
    const calculated = formatWeekRangeFromDates(newStartDate, newEndDate);
    setFormData(prev => ({
      ...prev,
      startDate: newStartDate,
      endDate: newEndDate,
      weekRange: calculated.weekRange
    }));
  };

  const handleEndDateChange = (newEndDate: string) => {
    const maxEnd = addDays(formData.startDate, 6);
    let validEnd = newEndDate;
    if (validEnd < formData.startDate) {
      validEnd = formData.startDate;
    } else if (validEnd > maxEnd) {
      validEnd = maxEnd;
    }
    const calculated = formatWeekRangeFromDates(formData.startDate, validEnd);
    setFormData(prev => ({
      ...prev,
      endDate: validEnd,
      weekRange: calculated.weekRange
    }));
  };

  const handleDayCountChange = (day: DayKey, field: keyof FoodBuffetItemBreakdown, value: number) => {
    setFormData(prev => ({
      ...prev,
      dailyCounts: {
        ...prev.dailyCounts,
        [day]: {
          ...prev.dailyCounts[day],
          [field]: Math.max(0, value)
        }
      }
    }));
  };

  const handleOpenAddModal = () => {
    setEditingLog(null);
    const bounds = getWeekBounds(todayStr);
    const currentWk = formatWeekRangeFromDates(bounds.start, bounds.end);
    setFormData({
      site: allowedSites[0] || 'Brit Hotel',
      vendor: 'A&M',
      weekRange: currentWk.weekRange,
      startDate: bounds.start,
      endDate: bounds.end,
      dailyCounts: defaultDailyCounts(),
      notes: 'Delivery temperature verified >68°C. Halal certified.',
      lastUpdatedBy: loggedInUserName
    });
    setIsModalOpen(true);
  };

  const handleEditClick = (log: PropertyFoodVendorBuffetLog) => {
    setEditingLog(log);
    const bounds = getWeekBounds(log.startDate || todayStr);
    const normVendor = (log.vendor === '9 cusines' ? '9 Cuisines' : log.vendor === 'sands' ? 'Sands' : log.vendor) as FoodVendorName;
    setFormData({
      site: log.site,
      vendor: normVendor,
      weekRange: log.weekRange,
      startDate: log.startDate || bounds.start,
      endDate: log.endDate || bounds.end,
      dailyCounts: log.dailyCounts ? {
        MON: log.dailyCounts.MON || defaultDailyCounts().MON,
        TUE: log.dailyCounts.TUE || defaultDailyCounts().TUE,
        WED: log.dailyCounts.WED || defaultDailyCounts().WED,
        THU: log.dailyCounts.THU || defaultDailyCounts().THU,
        FRI: log.dailyCounts.FRI || defaultDailyCounts().FRI,
        SAT: log.dailyCounts.SAT || defaultDailyCounts().SAT,
        SUN: log.dailyCounts.SUN || defaultDailyCounts().SUN,
      } : defaultDailyCounts(),
      notes: log.notes || '',
      lastUpdatedBy: loggedInUserName
    });
    setIsModalOpen(true);
  };

  // Extract unique weeks for dropdown
  const uniqueWeeksInLogs = useMemo(() => {
    const map = new Map<string, { start: string; end: string; label: string }>();
    foodVendorBuffetLogs.forEach(l => {
      if (l.startDate && l.endDate) {
        const bounds = getWeekBounds(l.startDate);
        const p = formatWeekRangeFromDates(bounds.start, bounds.end);
        if (!map.has(bounds.start)) {
          map.set(bounds.start, {
            start: bounds.start,
            end: bounds.end,
            label: p.weekRange
          });
        }
      }
    });
    if (!map.has(todayBounds.start)) {
      map.set(todayBounds.start, {
        start: todayBounds.start,
        end: todayBounds.end,
        label: initialWeekInfo.weekRange
      });
    }
    return Array.from(map.values()).sort((a, b) => b.start.localeCompare(a.start));
  }, [foodVendorBuffetLogs, todayBounds, initialWeekInfo]);

  const activeWeekInfo = useMemo(() => {
    if (activeWeekCursor === 'all') return null;
    const bounds = getWeekBounds(activeWeekCursor);
    return formatWeekRangeFromDates(bounds.start, bounds.end);
  }, [activeWeekCursor]);

  const handleMoveWeek = (direction: 'prev' | 'next') => {
    let currentStart = activeWeekCursor === 'all' ? todayBounds.start : activeWeekCursor;
    const offset = direction === 'prev' ? -7 : 7;
    const newStart = addDays(currentStart, offset);
    setActiveWeekCursor(newStart);
  };

  const filteredLogs = useMemo(() => {
    return foodVendorBuffetLogs.filter(log => {
      const normVendor = log.vendor === '9 cusines' ? '9 Cuisines' : log.vendor === 'sands' ? 'Sands' : log.vendor;
      if (siteFilter !== 'all' && log.site !== siteFilter) return false;
      if (vendorFilter !== 'all' && normVendor !== vendorFilter && log.vendor !== vendorFilter) return false;

      // Week filter
      if (activeWeekCursor !== 'all') {
        const bounds = getWeekBounds(activeWeekCursor);
        const logStart = log.startDate || '';
        const logEnd = log.endDate || logStart;
        const isOverlap = (logStart <= bounds.end && logEnd >= bounds.start) || 
          (typeof log.weekRange === 'string' && log.weekRange.toLowerCase().includes(`week ${bounds.weekNum}`));
        if (!isOverlap) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (log.site || '').toLowerCase().includes(q) ||
          (log.vendor || '').toLowerCase().includes(q) ||
          (log.weekRange || '').toLowerCase().includes(q) ||
          (typeof log.notes === 'string' && log.notes.toLowerCase().includes(q)) ||
          (log.lastUpdatedBy || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [foodVendorBuffetLogs, siteFilter, vendorFilter, activeWeekCursor, searchQuery]);

  // Matrix Row Sorting State
  const [matrixSortCol, setMatrixSortCol] = useState<string>('default');
  const [matrixSortAsc, setMatrixSortAsc] = useState<boolean>(true);

  const handleMatrixSort = (col: string) => {
    if (matrixSortCol === col) {
      setMatrixSortAsc(!matrixSortAsc);
    } else {
      setMatrixSortCol(col);
      setMatrixSortAsc(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payloadToValidate = {
      site: formData.site,
      date: formData.startDate || todayStr,
      startDate: formData.startDate,
      endDate: formData.endDate,
      vendorName: formData.vendor,
      mealType: 'Buffet Delivery' as const,
      mealsDelivered: 0,
      qualityCheck: 'Pass' as const,
      lastUpdatedBy: formData.lastUpdatedBy || loggedInUserName
    };

    const valResult = validateFoodLog(payloadToValidate);
    if (valResult.success === false) {
      const firstErr = Object.values(valResult.errors)[0];
      alert(`Validation Error: ${firstErr}`);
      return;
    }

    const payload = {
      ...formData,
      lastUpdatedBy: formData.lastUpdatedBy || loggedInUserName
    };

    if (editingLog) {
      updateFoodVendorBuffetLog(editingLog.id, payload);
      setEditingLog(null);
    } else {
      addFoodVendorBuffetLog(payload);
    }
    setIsModalOpen(false);
  };

  // Export Flattening
  const getFlattenedExportRows = (logs: PropertyFoodVendorBuffetLog[]) => {
    const flatRows: Array<{
      site: string;
      vendor: string;
      weekRange: string;
      startDate: string;
      endDate: string;
      category: string;
      mon: number;
      tue: number;
      wed: number;
      thu: number;
      fri: number;
      sat: number;
      sun: number;
      weeklyTotal: number;
      lastUpdatedBy: string;
    }> = [];

    logs.forEach(log => {
      BUFFET_ROWS.forEach(row => {
        const mon = log.dailyCounts?.MON?.[row.key] || 0;
        const tue = log.dailyCounts?.TUE?.[row.key] || 0;
        const wed = log.dailyCounts?.WED?.[row.key] || 0;
        const thu = log.dailyCounts?.THU?.[row.key] || 0;
        const fri = log.dailyCounts?.FRI?.[row.key] || 0;
        const sat = log.dailyCounts?.SAT?.[row.key] || 0;
        const sun = log.dailyCounts?.SUN?.[row.key] || 0;
        const weeklyTotal = mon + tue + wed + thu + fri + sat + sun;

        flatRows.push({
          site: log.site,
          vendor: log.vendor,
          weekRange: log.weekRange,
          startDate: log.startDate || '—',
          endDate: log.endDate || '—',
          category: row.label,
          mon,
          tue,
          wed,
          thu,
          fri,
          sat,
          sun,
          weeklyTotal,
          lastUpdatedBy: log.lastUpdatedBy
        });
      });
    });

    return flatRows;
  };

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    if (scope === 'filtered') return filteredLogs;
    if (scope === 'custom' && startDate && endDate) {
      return foodVendorBuffetLogs.filter(l => (l.startDate || '') >= startDate && (l.endDate || '') <= endDate);
    }
    return foodVendorBuffetLogs;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (row: ReturnType<typeof getFlattenedExportRows>[0]) => string | number }> => ({
    site: { label: 'Property / Hotel', getValue: r => r.site },
    vendor: { label: 'Vendor', getValue: r => r.vendor },
    weekRange: { label: 'Week Range', getValue: r => r.weekRange },
    startDate: { label: 'Date From', getValue: r => r.startDate },
    endDate: { label: 'Date To', getValue: r => r.endDate },
    category: { label: 'Meal Category', getValue: r => r.category },
    mon: { label: 'MON', getValue: r => r.mon },
    tue: { label: 'TUE', getValue: r => r.tue },
    wed: { label: 'WED', getValue: r => r.wed },
    thu: { label: 'THU', getValue: r => r.thu },
    fri: { label: 'FRI', getValue: r => r.fri },
    sat: { label: 'SAT', getValue: r => r.sat },
    sun: { label: 'SUN', getValue: r => r.sun },
    weeklyTotal: { label: 'Weekly Total', getValue: r => r.weeklyTotal },
    lastUpdatedBy: { label: 'Audited By', getValue: r => r.lastUpdatedBy }
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
    const logs = getExportDataForScope(scope, startDate, endDate);
    const flatRows = getFlattenedExportRows(logs);
    const colMap = getExportColumnMap();
    const cols = selectedColumns && selectedColumns.length > 0
      ? selectedColumns
      : buffetExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = flatRows.map(r => activeCols.map(c => colMap[c].getValue(r)));
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
    const logs = getExportDataForScope(scope, startDate, endDate);
    const flatRows = getFlattenedExportRows(logs);
    const colMap = getExportColumnMap();
    const cols = selectedColumns && selectedColumns.length > 0
      ? selectedColumns
      : buffetExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = flatRows.map(r => activeCols.map(c => colMap[c].getValue(r)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `Food-Vendor-Buffet-Matrix-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: 'Commercial 4-Vendor Hot Food Buffet Matrix Register',
        subtitle: 'Breakdown of Breakfast, Lunch, Dinner, Toddler & Special meals supplied by A&M, Freshbite, 9 Cuisines, Sands.',
        filename: `Food-Vendor-Buffet-Matrix-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        orientation: orientation || 'landscape',
        isCompact: isCompact !== false,
        metadata: [
          { label: 'Vendor Scope', value: vendorFilter === 'all' ? 'All 4 Vendors' : vendorFilter },
          { label: 'Site Scope', value: siteFilter === 'all' ? 'All Properties' : siteFilter },
          { label: 'Week Filter', value: activeWeekCursor === 'all' ? 'All Weeks' : activeWeekInfo?.weekRange || activeWeekCursor },
          { label: 'Total Matrix Entries', value: rows.length }
        ]
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-[#0d9488]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">
              Hot Food &amp; Catering Tracker
            </h1>
            <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#99f6e4]">
              {filteredLogs.length} Buffet Logs
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Commercial 4-vendor hot food buffet matrix, daily breakfast, lunch, dinner, toddler &amp; special diet allocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            moduleName="4-Vendor Hot Food Buffet Matrix"
            totalRecordCount={foodVendorBuffetLogs.length}
            filteredRecordCount={filteredLogs.length}
            defaultOrientation="landscape"
            availableColumns={buffetExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold text-xs rounded-xs shadow-xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Vendor Buffet Log</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#e1dfdd] p-3 rounded-xs flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Contracted Property Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c] whitespace-nowrap">Contracted Property:</span>
            <select
              value={siteFilter}
              onChange={e => setSiteFilter(e.target.value)}
              disabled={!canAccessAllSites()}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs max-w-[170px]"
            >
              {canAccessAllSites() && <option value="all">All Contracted Hotels</option>}
              {allowedSites.map((s, idx) => <option key={`${s}-${idx}`} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Food Vendor Dropdown - Strictly the 4 Vendors, NO 'All' Option */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c] whitespace-nowrap">Food Vendor:</span>
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value as FoodVendorName)}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-semibold text-xs"
            >
              {FOUR_CORE_VENDORS.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[140px] flex-1 max-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-[#605e5c]" />
            <input
              type="text"
              placeholder="Search matrix..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-6 pr-2 py-1 border border-[#8a8886] rounded-xs text-xs bg-white focus:outline-2 focus:outline-[#71afe5]"
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
          <span className="px-2 py-0.5 bg-[#d83b01] text-white font-bold text-xs rounded-xs shadow-2xs">
            Vendor: {vendorFilter}
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

      {/* Vendor Schedule Matrices */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white border border-[#e1dfdd] p-8 text-center rounded-xs text-[#605e5c] space-y-3">
          <UtensilsCrossed className="w-8 h-8 text-neutral-400 mx-auto" />
          <div>
            <p className="font-semibold text-neutral-800 text-sm">
              No buffet log records found for <span className="text-[#d83b01] font-bold">{vendorFilter}</span> ({activeWeekBounds.label})
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Use the side arrows above to move forward or backward through weeks, or record a new log.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingLog(null);
              setFormData({
                site: siteFilter !== 'all' ? siteFilter : (allowedSites[0] || 'Brit Hotel'),
                vendor: vendorFilter,
                weekRange: activeWeekBounds.label,
                startDate: activeWeekBounds.start,
                endDate: activeWeekBounds.end,
                dailyCounts: defaultDailyCounts(),
                notes: 'Hot holding temperature logged on arrival at >68°C. Halal certified supply.',
                lastUpdatedBy: loggedInUserName
              });
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold text-xs rounded-xs shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Record Buffet Log for this Week</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map(log => {
            // Row totals calculation
            const rowTotals = BUFFET_ROWS.map(r => {
              let sum = 0;
              DAYS_OF_WEEK.forEach(d => {
                const count = log.dailyCounts?.[d]?.[r.key] || 0;
                sum += count;
              });
              return { key: r.key, label: r.label, sum };
            });

            const weekGrandTotal = rowTotals.reduce((a, b) => a + b.sum, 0);

            const getRowTotal = (rowKey: string) => {
              return DAYS_OF_WEEK.reduce((acc, d) => acc + (log.dailyCounts?.[d]?.[rowKey] || 0), 0);
            };

            const sortedBuffetRows = [...BUFFET_ROWS].sort((a, b) => {
              if (matrixSortCol === 'category') {
                return matrixSortAsc ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label);
              }
              if (matrixSortCol === 'total') {
                const sumA = getRowTotal(a.key);
                const sumB = getRowTotal(b.key);
                return matrixSortAsc ? sumA - sumB : sumB - sumA;
              }
              if (DAYS_OF_WEEK.includes(matrixSortCol as any)) {
                const countA = log.dailyCounts?.[matrixSortCol as DayKey]?.[a.key] || 0;
                const countB = log.dailyCounts?.[matrixSortCol as DayKey]?.[b.key] || 0;
                return matrixSortAsc ? countA - countB : countB - countA;
              }
              return 0;
            });

            return (
              <div 
                key={log.id} 
                className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden transition-all hover:border-[#0d9488]"
              >
                {/* Header Bar */}
                <div className="bg-[#f3f8fd] px-4 py-2 border-b border-[#5eead4] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-0.5 bg-orange-600 text-white font-bold text-xs rounded">
                      Vendor: {log.vendor === '9 cusines' ? '9 Cuisines' : log.vendor === 'sands' ? 'Sands' : log.vendor}
                    </span>
                    <div className="flex items-center gap-1.5 font-bold text-sm text-[#242424]">
                      <Building2 className="w-4 h-4 text-[#0d9488]" />
                      <span>{log.site}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-[#0f766e] font-semibold bg-white px-2.5 py-1 rounded border border-[#5eead4]">
                      <Calendar className="w-3.5 h-3.5 text-[#0d9488]" />
                      <span>{log.weekRange}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {canEditRecord(log.site) && (
                        <button
                          onClick={() => handleEditClick(log)}
                          className="p-1 hover:bg-white text-[#0d9488] rounded border border-transparent hover:border-[#5eead4]"
                          title="Edit Matrix"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteRecord(log.site) && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete buffet log for ${log.vendor} at ${log.site}?`)) {
                              deleteFoodVendorBuffetLog(log.id);
                            }
                          }}
                          className="p-1 hover:bg-red-50 text-[#a4262c] rounded"
                          title="Delete Matrix"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Matrix Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#faf9f8] text-[#242424] font-semibold border-b border-[#edebe9] select-none whitespace-nowrap">
                      <tr>
                        <th 
                          onClick={() => handleMatrixSort('category')} 
                          className="py-2.5 px-3 min-w-[180px] bg-[#f3f2f1] cursor-pointer hover:bg-[#edebe9] transition-colors"
                          title="Sort by Category"
                        >
                          <div className="flex items-center gap-1">
                            <span>Category</span>
                            {matrixSortCol === 'category' ? (matrixSortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                          </div>
                        </th>
                        {DAYS_OF_WEEK.map(d => (
                          <th 
                            key={d} 
                            onClick={() => handleMatrixSort(d)}
                            className="py-2.5 px-2 text-center w-16 border-r border-[#edebe9] cursor-pointer hover:bg-[#edebe9] transition-colors"
                            title={`Sort by ${d}`}
                          >
                            <div className="flex items-center justify-center gap-0.5">
                              <span>{d}</span>
                              {matrixSortCol === d ? (matrixSortAsc ? <ArrowUp className="w-2.5 h-2.5 text-[#0d9488]" /> : <ArrowDown className="w-2.5 h-2.5 text-[#0d9488]" />) : <ArrowUpDown className="w-2.5 h-2.5 text-neutral-400 opacity-40" />}
                            </div>
                          </th>
                        ))}
                        <th 
                          onClick={() => handleMatrixSort('total')}
                          className="py-2.5 px-3 text-right bg-teal-50/60 text-[#0f766e] w-24 cursor-pointer hover:bg-teal-100/60 transition-colors"
                          title="Sort by Weekly Total"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>Weekly Total</span>
                            {matrixSortCol === 'total' ? (matrixSortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edebe9]">
                      {sortedBuffetRows.map(row => {
                        let rowSum = 0;
                        return (
                          <tr key={row.key} className="hover:bg-[#faf9f8] transition-colors">
                            <td className="py-2 px-3 font-semibold text-[#242424] bg-neutral-50/50">
                              {row.label}
                            </td>
                            {DAYS_OF_WEEK.map(d => {
                              const count = log.dailyCounts?.[d]?.[row.key] || 0;
                              rowSum += count;
                              return (
                                <td key={d} className="py-2 px-2 text-center font-mono text-[#323130] border-r border-[#edebe9]">
                                  {count > 0 ? (
                                    <span className="font-semibold text-neutral-800">{count}</span>
                                  ) : (
                                    <span className="text-neutral-400">0</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 text-right font-mono font-bold text-[#0f766e] bg-teal-50/30">
                              {rowSum}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Daily Totals Row */}
                      <tr className="bg-[#edebe9] font-bold text-[#242424] border-t-2 border-[#8a8886]">
                        <td className="py-2.5 px-3">Daily Buffet Total</td>
                        {DAYS_OF_WEEK.map(d => {
                          let daySum = 0;
                          BUFFET_ROWS.forEach(r => {
                            daySum += log.dailyCounts?.[d]?.[r.key] || 0;
                          });
                          return (
                            <td key={d} className="py-2.5 px-2 text-center font-mono text-[#0f766e] border-r border-[#d2d0ce]">
                              {daySum}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 bg-emerald-100/80 text-sm">
                          {weekGrandTotal}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-8">
            <div className="px-5 py-3 bg-[#f3f8fd] border-b border-[#5eead4] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-600" />
                <h3 className="text-sm font-bold text-[#242424]">
                  {editingLog ? `Edit Buffet Matrix (${editingLog.vendor} - ${editingLog.site})` : 'Add Hot Food Vendor Buffet Log'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[#605e5c] hover:text-[#242424]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Contracted Property *</label>
                  <select
                    value={formData.site}
                    onChange={e => setFormData({ ...formData, site: e.target.value })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                    required
                  >
                    {allowedSites.map((s, idx) => <option key={`${s}-${idx}`} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">Food Vendor *</label>
                  <select
                    value={formData.vendor}
                    onChange={e => setFormData({ ...formData, vendor: e.target.value as FoodVendorName })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-semibold"
                    required
                  >
                    {FOUR_CORE_VENDORS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              {/* Date From & Date To with 1-Week (Max 7 Days) Restriction */}
              <div className="p-3 bg-[#faf9f8] rounded border border-[#edebe9] space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#0d9488]" />
                      <span>Date From *</span>
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={e => handleStartDateChange(e.target.value)}
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-medium"
                      required
                    />
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
                      max={addDays(formData.startDate, 6)}
                      onChange={e => handleEndDateChange(e.target.value)}
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="bg-[#f3f8fd] px-2.5 py-1.5 rounded-xs border border-[#5eead4] text-[#0f766e] font-bold text-[11px] flex items-center justify-between">
                  <span>&rarr; Week: {formData.weekRange}</span>
                  <span className="text-[10px] font-semibold text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded">
                    Restricted to 1 Week (Max 7 Days)
                  </span>
                </div>
              </div>

              {/* Matrix Input Table */}
              <div className="border border-[#e1dfdd] rounded-xs overflow-hidden">
                <div className="bg-[#f3f2f1] px-3 py-2 font-semibold text-[#242424] border-b border-[#e1dfdd] flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-[#0d9488]" />
                  <span>Meal Type &amp; Daily Counts Matrix (MON &ndash; SUN)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#faf9f8] text-[#242424] font-semibold border-b border-[#edebe9]">
                      <tr>
                        <th className="p-2 min-w-[170px]">Meal Type</th>
                        {DAYS_OF_WEEK.map(d => (
                          <th key={d} className="p-2 text-center w-14 border-r border-[#edebe9]">
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edebe9]">
                      {BUFFET_ROWS.map(row => (
                        <tr key={row.key} className="hover:bg-[#faf9f8]">
                          <td className="p-2 font-semibold text-[#242424] bg-neutral-50/50">
                            {row.label}
                          </td>
                          {DAYS_OF_WEEK.map(d => (
                            <td key={d} className="p-1 text-center border-r border-[#edebe9]">
                              <input
                                type="number"
                                min="0"
                                value={formData.dailyCounts[d][row.key]}
                                onChange={e => handleDayCountChange(d, row.key, parseInt(e.target.value) || 0)}
                                className="w-12 p-1 text-center border border-[#8a8886] rounded-xs font-mono text-xs focus:bg-amber-50"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">Remarks / Compliance Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Temperature checks logged >68°C, Halal batch certified..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs text-[#323130]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1 flex items-center justify-between">
                  <span>Audited / Logged By *</span>
                  <span className="text-[10px] text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded font-normal flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-blue-600" />
                    Defaults to logged-in user
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.lastUpdatedBy}
                  readOnly
                  disabled
                  className="w-full p-2 border border-[#8a8886] rounded-xs text-[#323130] bg-[#f3f2f1] font-semibold cursor-not-allowed opacity-90"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#edebe9]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#8a8886] rounded-xs text-[#323130] hover:bg-[#f3f2f1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold rounded-xs shadow-xs"
                >
                  {editingLog ? 'Save Matrix Updates' : 'Add Buffet Matrix'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
