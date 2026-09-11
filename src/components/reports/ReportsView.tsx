import React, { useState, useMemo } from 'react';
import { 
  CloudUpload, 
  FileSpreadsheet, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Building2, 
  ShieldCheck, 
  AlertTriangle, 
  Cloud,
  FileText,
  Printer,
  Calendar,
  Filter,
  Eye,
  Sliders,
  Layers,
  HardHat,
  ScrollText,
  Soup,
  Siren,
  X,
  Search,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Pagination } from '../common/Pagination';
import { ExportModal, ExportFormat, ExportScope, ExportColumnOption, ExportOrientation } from '../common/ExportModal';
import { ExportDropdown } from '../common/ExportDropdown';
import { SearchInput } from '../common/SearchInput';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { SharePointWorkbookHub } from './SharePointWorkbookHub';

const reportExportColumns: ExportColumnOption[] = [
  { id: 'reference', label: 'Reference Code / ID' },
  { id: 'name', label: 'Subject / Resident / Title' },
  { id: 'site', label: 'Site / Hotel Location' },
  { id: 'type', label: 'Category / Incident Type' },
  { id: 'status', label: 'Status' },
  { id: 'date', label: 'Date Registered' },
  { id: 'urgency', label: 'Priority / Urgency Level' },
  { id: 'officer', label: 'Duty Officer' },
  { id: 'council', label: 'Authority / Contractor' },
  { id: 'notes', label: 'Details / Action Summary' }
];

interface ReportRow {
  id: string;
  reference: string;
  name: string;
  site: string;
  type: string;
  status: string;
  date: string;
  urgency: string;
  officer: string;
  council: string;
  notes: string;
}

export const ReportsView: React.FC = () => {
  const {
    referrals,
    vulnerableSUs,
    challengingSUs,
    laundryRecords,
    foodRecords,
    escalations,
    properties,
    maintenanceRecords,
    spcdRecords,
    users,
    allowedSites,
    settings,
    syncSharePointNow
  } = useApp();

  // Selected report template
  const [selectedReportType, setSelectedReportType] = useState<string>('safeguarding');
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sorting
  const [sortField, setSortField] = useState<keyof ReportRow>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(settings.pageSize || 10);

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalFormat, setExportModalFormat] = useState<ExportFormat>('pdf');

  // Sync state
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success'>('idle');
  const [syncProgress, setSyncProgress] = useState<number>(100);

  // Printable Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Trigger Live SharePoint Sync
  const handleLiveSync = () => {
    setSyncStatus('syncing');
    setSyncProgress(25);
    syncSharePointNow();
    
    setTimeout(() => setSyncProgress(70), 300);
    setTimeout(() => {
      setSyncProgress(100);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3500);
    }, 700);
  };

  // Report Types Definition with Microsoft Fluent color scheme
  const REPORT_TYPES = [
    {
      id: 'safeguarding',
      title: 'Safeguarding Referrals Dossier',
      desc: 'All resident safeguarding intake records, council allocations, and review notes.',
      icon: ShieldCheck,
      badgeColor: 'bg-[#f0fdfa] text-[#0f766e] border-[#5eead4]',
      badge: 'High Priority'
    },
    {
      id: 'risk_register',
      title: 'Vulnerable & Challenging Risk Audit',
      desc: 'Consolidated vulnerability assessments, warning markers, and behavioral incident logs.',
      icon: AlertTriangle,
      badgeColor: 'bg-[#fff8ed] text-[#8a3700] border-[#fedbb0]',
      badge: 'Critical Risk'
    },
    {
      id: 'maintenance',
      title: 'Facility Maintenance & Defect Tracker',
      desc: 'Accommodation repair work orders, CAT 1 room defects, and contractor sign-offs.',
      icon: HardHat,
      badgeColor: 'bg-[#fff4ce] text-[#795b00] border-[#fde892]',
      badge: 'Facilities'
    },
    {
      id: 'spcd',
      title: 'SPCD Statutory Compliance Audit',
      desc: 'Special provision and council directive audits with completion timestamps.',
      icon: ScrollText,
      badgeColor: 'bg-[#f1faf0] text-[#107c10] border-[#cbe8cb]',
      badge: 'Statutory'
    },
    {
      id: 'welfare',
      title: 'Welfare Operations (Meals & Laundry)',
      desc: 'Daily meal allocations, dietary requirements, and laundry support execution.',
      icon: Soup,
      badgeColor: 'bg-[#e6f7f7] text-[#005b5b] border-[#a2dede]',
      badge: 'Operations'
    },
    {
      id: 'escalations',
      title: 'Incident Escalations & Governance',
      desc: 'Critical emergency escalations, multi-agency referrals, and resolution timelines.',
      icon: Siren,
      badgeColor: 'bg-[#fdf3f2] text-[#a4262c] border-[#f8d7d6]',
      badge: 'Urgent'
    }
  ];

  // Helper date filter
  const isWithinDateRange = (dateStr?: string) => {
    if (!dateStr || dateRange === 'all') return true;
    const itemDate = new Date(dateStr).getTime();
    if (isNaN(itemDate)) return true;

    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (dateRange === '7d') return now - itemDate <= 7 * oneDay;
    if (dateRange === '30d') return now - itemDate <= 30 * oneDay;
    if (dateRange === '90d') return now - itemDate <= 90 * oneDay;
    if (dateRange === 'ytd') {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
      return itemDate >= startOfYear;
    }
    return true;
  };

  // Compile Unfiltered Dataset based on selected report type
  const rawDataset = useMemo((): ReportRow[] => {
    switch (selectedReportType) {
      case 'safeguarding':
        return referrals.map(r => ({
          id: r.id,
          reference: r.mosaicId || r.portRef || r.id,
          name: r.suName,
          site: r.site,
          type: r.referralType,
          status: r.status,
          date: r.dateReferred,
          urgency: r.urgency,
          officer: r.officerLeadingHotel || '—',
          council: r.referralCouncil || '—',
          notes: r.notesActionTaken || '—'
        }));

      case 'risk_register':
        const vulns = vulnerableSUs.map((v: any) => ({
          id: v.id,
          reference: v.portOrNassRef || v.id,
          name: v.suName,
          site: v.site,
          type: 'Vulnerable SU - ' + (v.group || 'General'),
          status: v.status,
          date: v.reviewDate || v.createdAt,
          urgency: v.riskLevel,
          officer: v.allocatedWorker || '—',
          council: 'Local Authority',
          notes: v.vulnerability
        }));
        const challengings = challengingSUs.map((c: any) => ({
          id: c.id,
          reference: c.portRef || c.portOrNassRef || c.id,
          name: c.name || c.suName,
          site: c.site,
          type: 'Challenging Behavior - ' + (c.typeOfIssue || 'Incident'),
          status: c.status,
          date: c.date || c.dateOfIncident || c.createdAt,
          urgency: c.riskFactor || c.riskLevel || 'Medium',
          officer: c.raisedBy || c.loggedBy || '—',
          council: 'Council Ops',
          notes: c.incidentDescription || c.incidentDetails
        }));
        return [...vulns, ...challengings];

      case 'maintenance':
        return maintenanceRecords.map((m: any) => ({
          id: m.id,
          reference: `WO-${m.id.slice(0, 6).toUpperCase()}`,
          name: `Room ${m.room || m.roomNo || m.roomNumber || 'N/A'} - ${m.typeOfDefect || m.category || 'General'}`,
          site: m.site,
          type: m.typeOfDefect || m.category || 'Maintenance',
          status: m.defectStatus || m.status,
          date: m.dateReported || m.reportedDate || m.createdAt,
          urgency: m.priority || m.priorityTimeScale || 'Medium',
          officer: m.raisedBy || m.reportedByStaffName || 'Staff',
          council: m.contractorAssigned || 'Internal Estates',
          notes: m.description
        }));

      case 'spcd':
        return spcdRecords.map((s: any) => ({
          id: s.id,
          reference: `SPCD-${s.id.slice(0, 6).toUpperCase()}`,
          name: s.suName || s.title || 'SPCD Record',
          site: s.siteName || s.site || s.property,
          type: s.category || 'Compliance',
          status: s.status || (s.isArchived ? 'Archived' : 'Active'),
          date: s.date || s.directiveDate || s.createdAt,
          urgency: s.complianceLevel || 'Standard',
          officer: s.staffReporting || s.leadInspector || 'Lead Officer',
          council: s.issuingAuthority || 'Home Office',
          notes: s.briefDescriptionActionTaken || s.notes
        }));

      case 'welfare':
        const foods = foodRecords.map((f: any) => ({
          id: f.id,
          reference: `MEAL-${f.id.slice(0, 6).toUpperCase()}`,
          name: `Room ${f.roomNo || f.roomNumber || 'N/A'} (${f.headcount || 1} SUs)`,
          site: f.site,
          type: `${f.mealType || 'Meal'} - ${f.dietaryOption || 'Standard'}`,
          status: f.collectionStatus || f.status || 'Delivered',
          date: f.date || f.createdAt,
          urgency: f.dietaryOption && f.dietaryOption !== 'Standard' ? 'High' : 'Low',
          officer: f.dutyStaff || f.staffInitials || 'Staff',
          council: f.vendor || 'Catering Partner',
          notes: f.specialNotes || 'Delivered'
        }));
        const laundries = laundryRecords.map((l: any) => ({
          id: l.id,
          reference: `LND-${l.id.slice(0, 6).toUpperCase()}`,
          name: `Room ${l.roomNo || l.roomNumber || 'N/A'} (${l.bagCount || 0} Bags)`,
          site: l.site,
          type: 'Laundry Service',
          status: l.status,
          date: l.date || l.dateReceived || l.createdAt,
          urgency: l.isUrgent ? 'High' : 'Low',
          officer: l.staffMember || l.staffInitials || 'Staff',
          council: 'Facility Laundry Team',
          notes: l.notes || 'Normal cycle'
        }));
        return [...foods, ...laundries];

      case 'escalations':
        return escalations.map((e: any) => ({
          id: e.id,
          reference: `ESC-${e.id.slice(0, 6).toUpperCase()}`,
          name: e.title || e.category || 'Escalation',
          site: e.site,
          type: e.escalationLevel || e.category || 'Escalation',
          status: e.status,
          date: e.dateReported || e.createdAt,
          urgency: e.priority || 'Medium',
          officer: e.reportedBy || 'Staff',
          council: e.assignedTo || 'Council',
          notes: e.description
        }));

      default:
        return [];
    }
  }, [
    selectedReportType, 
    referrals, 
    vulnerableSUs, 
    challengingSUs, 
    maintenanceRecords, 
    spcdRecords, 
    foodRecords, 
    laundryRecords, 
    escalations
  ]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return rawDataset.filter(item => {
      // Site filter
      if (selectedSite !== 'all' && item.site !== selectedSite) return false;
      // Date filter
      if (!isWithinDateRange(item.date)) return false;
      // Status filter
      if (statusFilter === 'active' && (item.status === 'Archived' || item.status === 'Resolved' || item.status === 'Completed')) return false;
      if (statusFilter === 'closed' && (item.status !== 'Archived' && item.status !== 'Resolved' && item.status !== 'Completed')) return false;
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = typeof item.name === 'string' && item.name.toLowerCase().includes(q);
        const matchRef = typeof item.reference === 'string' && item.reference.toLowerCase().includes(q);
        const matchSite = typeof item.site === 'string' && item.site.toLowerCase().includes(q);
        const matchNotes = typeof item.notes === 'string' && item.notes.toLowerCase().includes(q);
        if (!matchName && !matchRef && !matchSite && !matchNotes) return false;
      }
      return true;
    });
  }, [rawDataset, selectedSite, dateRange, statusFilter, searchQuery]);

  // Sorted dataset
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

  // Paginated dataset
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (field: keyof ReportRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const calculateDateRangeCount = (start: string, end: string) => {
    return rawDataset.filter(r => r.date >= start && r.date <= end).length;
  };

  const handleOpenExportModal = (format: ExportFormat = 'pdf') => {
    setExportModalFormat(format);
    setIsExportModalOpen(true);
  };

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    if (scope === 'filtered') return sortedData;
    if (scope === 'custom' && startDate && endDate) {
      return rawDataset.filter(r => r.date >= startDate && r.date <= endDate);
    }
    return rawDataset;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (r: ReportRow) => string | number }> => ({
    reference: { label: 'Reference Code', getValue: r => r.reference || '—' },
    name: { label: 'Subject / Resident', getValue: r => r.name || '—' },
    site: { label: 'Site Location', getValue: r => r.site },
    type: { label: 'Category / Type', getValue: r => r.type },
    status: { label: 'Status', getValue: r => r.status },
    date: { label: 'Date Registered', getValue: r => r.date },
    urgency: { label: 'Priority / Urgency', getValue: r => r.urgency || 'Standard' },
    officer: { label: 'Duty Lead', getValue: r => r.officer || '—' },
    council: { label: 'Authority / Contractor', getValue: r => r.council || '—' },
    notes: { label: 'Details & Action Summary', getValue: r => r.notes || '—' }
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
      : reportExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(r => activeCols.map(c => colMap[c].getValue(r)));
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
    const reportTitle = REPORT_TYPES.find(r => r.id === selectedReportType)?.title || 'Safeguarding Report';

    const cols = selectedColumns && selectedColumns.length > 0
      ? selectedColumns
      : reportExportColumns.map(c => c.id);

    const colMap = getExportColumnMap();
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(r => activeCols.map(c => colMap[c].getValue(r)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `Report-${selectedReportType}-${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: reportTitle,
        subtitle: `Executive summary and detailed record audit schedule for ${selectedSite === 'all' ? 'All Sites' : selectedSite}`,
        filename: `Report-${selectedReportType}-${scope}-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        isCompact,
        metadata: [
          { label: 'Report Scope', value: scope === 'all' ? 'All Records' : scope === 'custom' ? `${startDate} to ${endDate}` : 'Filtered View' },
          { label: 'Site Scope', value: selectedSite === 'all' ? 'All Sites' : selectedSite },
          { label: 'Density', value: isCompact ? 'Compact View' : 'Standard View' },
          { label: 'Total Records', value: dataToExport.length }
        ]
      });
    }
  };

  // Full System JSON Backup
  const handleExportFullSystem = () => {
    const fullDump = {
      system: 'Safeguarding Accommodation Support Tracker',
      exportTimestamp: new Date().toISOString(),
      metadata: {
        totalSites: properties.length,
        totalUsers: users.length,
        version: 'v2.4 M365 Unified'
      },
      datasets: {
        referrals,
        vulnerableSUs,
        challengingSUs,
        maintenanceRecords,
        spcdRecords,
        laundryRecords,
        foodRecords,
        escalations,
        properties
      }
    };
    const blob = new Blob([JSON.stringify(fullDump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sg-system-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalActiveCases = referrals.filter(r => r.status !== 'Archived').length;
  const criticalCount = vulnerableSUs.filter(v => v.riskLevel === 'Critical' && v.status !== 'Archived').length +
                        challengingSUs.filter(c => ((c as any).riskFactor === 'Critical' || (c as any).riskLevel === 'Critical') && c.status !== 'Archived').length;
  const openMaintenanceCount = maintenanceRecords.filter(m => m.defectStatus !== 'Completed').length;

  const currentReportTitle = REPORT_TYPES.find(r => r.id === selectedReportType)?.title || 'Safeguarding Report';
  const currentReportHeaders = ['Reference Code', 'Subject / Resident', 'Site Location', 'Category / Type', 'Status', 'Date Registered', 'Priority / Urgency', 'Duty Lead', 'Authority / Contractor', 'Details & Action Summary'];
  const currentReportRows = sortedData.map(r => [
    r.reference || '—',
    r.name || '—',
    r.site,
    r.type,
    r.status,
    r.date,
    r.urgency || 'Standard',
    r.officer || '—',
    r.council || '—',
    r.notes || '—'
  ]);

  return (
    <div className="space-y-4">
      {/* Microsoft 365 Standard Header & Command Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold text-[#242424] tracking-tight">
              Reports &amp; SharePoint Sync
            </h2>
            <span className="text-[11px] bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#5eead4]">
              Microsoft 365 Integrated
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Generate safeguarding audit dossiers, export Excel-ready CSV sheets for council partners, and synchronize cloud archives.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleLiveSync}
            disabled={syncStatus === 'syncing'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            <span>{syncStatus === 'syncing' ? 'Syncing...' : 'Sync SharePoint'}</span>
          </button>

          <ExportDropdown
            moduleName={REPORT_TYPES.find(r => r.id === selectedReportType)?.title || "Report"}
            totalRecordCount={rawDataset.length}
            filteredRecordCount={sortedData.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={reportExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
          />

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>Print Dossier</span>
          </button>

          <button
            onClick={handleExportFullSystem}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#f3f2f1] hover:bg-[#edebe9] text-[#323130] border border-[#d2d0ce] rounded-xs transition-colors"
            title="Download full JSON backup of all databases"
          >
            <Download className="w-3.5 h-3.5 text-[#605e5c]" />
            <span>System JSON</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#edebe9] rounded-xs p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-[#605e5c] text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Open Safeguarding Cases</span>
            <div className="p-1.5 bg-[#f0fdfa] text-[#0d9488] rounded-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#242424]">{totalActiveCases}</div>
          <p className="text-[11px] text-[#8a8886] mt-0.5">Active referrals under local review</p>
        </div>

        <div className="bg-white border border-[#edebe9] rounded-xs p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-[#605e5c] text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Critical Alerts</span>
            <div className="p-1.5 bg-[#fff8ed] text-[#8a3700] rounded-xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#8a3700]">{criticalCount}</div>
          <p className="text-[11px] text-[#8a8886] mt-0.5">High risk markers &amp; incidents</p>
        </div>

        <div className="bg-white border border-[#edebe9] rounded-xs p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-[#605e5c] text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Open Facility Repairs</span>
            <div className="p-1.5 bg-[#fff4ce] text-[#795b00] rounded-xs">
              <HardHat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#795b00]">{openMaintenanceCount}</div>
          <p className="text-[11px] text-[#8a8886] mt-0.5">Ongoing maintenance work orders</p>
        </div>

        <div className="bg-white border border-[#edebe9] rounded-xs p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-[#605e5c] text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">SharePoint Sync Status</span>
            <div className="p-1.5 bg-[#f1faf0] text-[#107c10] rounded-xs">
              <Cloud className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-[#107c10] truncate">Connected &amp; Synced</div>
          <p className="text-[11px] text-[#8a8886] mt-0.5">
            Auto-Sync every 30m &bull; {new Date(settings.lastSharePointSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* SharePoint Master Workbook Integration Hub */}
      <SharePointWorkbookHub
        currentReportTitle={currentReportTitle}
        currentReportHeaders={currentReportHeaders}
        currentReportRows={currentReportRows}
      />

      {/* Report Template Selector & Filter Ribbon */}
      <div className="bg-white border border-[#edebe9] rounded-xs shadow-xs">
        {/* Section Header */}
        <div className="p-3.5 bg-[#faf9f8] border-b border-[#edebe9] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-[#242424] uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#0d9488]" />
              <span>Report Generator &amp; Dossier Customizer</span>
            </h3>
            <p className="text-[11px] text-[#605e5c] mt-0.5">
              Select a module template below and adjust filters to preview, print, or export custom data.
            </p>
          </div>
        </div>

        {/* 6 Report Templates Grid */}
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {REPORT_TYPES.map(rt => {
            const Icon = rt.icon;
            const isSelected = selectedReportType === rt.id;

            return (
              <button
                key={rt.id}
                type="button"
                onClick={() => {
                  setSelectedReportType(rt.id);
                  setCurrentPage(1);
                }}
                className={`p-3 text-left rounded-xs border transition-all flex flex-col justify-between ${
                  isSelected 
                    ? 'border-[#0d9488] bg-[#f3f8fd] ring-1 ring-[#0d9488] shadow-xs' 
                    : 'border-[#edebe9] hover:border-[#8a8886] bg-white hover:bg-[#faf9f8]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 font-semibold text-xs text-[#242424]">
                      <Icon className="w-4 h-4 text-[#0d9488]" />
                      <span>{rt.title}</span>
                    </div>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-[#0d9488]" />}
                  </div>
                  <p className="text-[11px] text-[#605e5c] leading-snug line-clamp-2">
                    {rt.desc}
                  </p>
                </div>

                <div className="pt-2 mt-2 border-t border-[#edebe9] flex items-center justify-between text-[10px]">
                  <span className={`px-1.5 py-0.2 rounded-xs font-semibold border ${rt.badgeColor}`}>{rt.badge}</span>
                  <span className="text-[#0d9488] font-semibold">Select Template</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Filter Bar Controls */}
        <div className="p-3 bg-[#faf9f8] border-t border-[#edebe9] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {/* Site Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Accommodation Site</label>
            <select
              value={selectedSite}
              onChange={e => {
                setSelectedSite(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-xs font-semibold text-[#323130] focus:border-[#0d9488] focus:outline-none"
            >
              <option value="all">All Accommodation Sites ({properties.length})</option>
              {allowedSites.map((s, idx) => (
                <option key={`${s}-${idx}`} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Time Period</label>
            <select
              value={dateRange}
              onChange={e => {
                setDateRange(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-xs font-semibold text-[#323130] focus:border-[#0d9488] focus:outline-none"
            >
              <option value="all">All Historic Records</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">This Quarter (90 Days)</option>
              <option value="ytd">Year to Date (YTD)</option>
            </select>
          </div>

          {/* Status Scope */}
          <div>
            <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Status Scope</label>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-xs font-semibold text-[#323130] focus:border-[#0d9488] focus:outline-none"
            >
              <option value="all">All (Active &amp; Archived)</option>
              <option value="active">Active &amp; Open Cases Only</option>
              <option value="closed">Resolved &amp; Archived Only</option>
            </select>
          </div>

          {/* Text Search */}
          <div>
            <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Quick Search</label>
            <SearchInput
              id="reports-search"
              placeholder="Search reference, name, notes..."
              value={searchQuery}
              onChange={val => {
                setSearchQuery(val);
                setCurrentPage(1);
              }}
              storageKey="reports_search"
            />
          </div>
        </div>
      </div>

      {/* Live Data Preview Table with full-height container and pagination */}
      <div className="bg-white border border-[#edebe9] rounded-xs shadow-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <div className="p-3 bg-[#faf9f8] border-b border-[#edebe9] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#0d9488]" />
              <h3 className="text-xs font-bold text-[#242424] uppercase tracking-wider">
                Live Dataset Preview ({sortedData.length} records matching criteria)
              </h3>
            </div>
            <span className="text-[11px] text-[#605e5c]">
              Real-time dataset ready for PDF / CSV export or SharePoint archiving
            </span>
          </div>

          {sortedData.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#605e5c]">
              No records match the current filter selection. Try changing the site or date range.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-[#f3f2f1] border-b border-[#edebe9] text-[#323130] font-semibold select-none whitespace-nowrap">
                  <th 
                    onClick={() => handleSort('reference')}
                    className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Reference / ID</span>
                      {sortField === 'reference' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('name')}
                    className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Resident / Subject</span>
                      {sortField === 'name' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('site')}
                    className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Site Location</span>
                      {sortField === 'site' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('type')}
                    className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Category / Directive</span>
                      {sortField === 'type' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('status')}
                    className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      {sortField === 'status' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('urgency')}
                    className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Priority / Urgency</span>
                      {sortField === 'urgency' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('date')}
                    className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Date</span>
                      {sortField === 'date' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                    </div>
                  </th>
                  <th className="p-2.5">Duty Lead</th>
                  <th className="p-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edebe9]">
                {paginatedData.map(row => (
                  <tr key={row.id} className="hover:bg-[#faf9f8] transition-colors">
                    <td className="p-2.5 font-mono font-semibold text-[#0d9488]">{row.reference}</td>
                    <td className="p-2.5 font-semibold text-[#242424]">{row.name}</td>
                    <td className="p-2.5 text-[#605e5c]">{row.site}</td>
                    <td className="p-2.5 text-[#605e5c]">{row.type}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-xs text-[11px] font-semibold border ${
                        row.status === 'Open' || row.status === 'Active' || row.status === 'New'
                          ? 'bg-[#f0fdfa] text-[#0f766e] border-[#5eead4]'
                          : row.status === 'Completed' || row.status === 'Resolved'
                          ? 'bg-[#f1faf0] text-[#107c10] border-[#cbe8cb]'
                          : 'bg-[#f3f2f1] text-[#605e5c] border-[#edebe9]'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-xs text-[11px] font-semibold border ${
                        row.urgency === 'Critical' || row.urgency === 'High' || row.urgency === 'CAT 1'
                          ? 'bg-[#fdf3f2] text-[#a4262c] border-[#f8d7d6]'
                          : 'bg-[#f3f2f1] text-[#605e5c] border-[#edebe9]'
                      }`}>
                        {row.urgency || 'Standard'}
                      </span>
                    </td>
                    <td className="p-2.5 text-[#605e5c]">{row.date}</td>
                    <td className="p-2.5 text-[#605e5c]">{row.officer || 'Duty Staff'}</td>
                    <td className="p-2.5 text-[#605e5c] max-w-xs truncate" title={row.notes}>
                      {row.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
        />
      </div>

      {/* Printable / PDF Dossier Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xs shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-[#edebe9]">
            {/* Modal Header */}
            <div className="p-3.5 border-b border-[#edebe9] bg-[#faf9f8] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#0d9488]" />
                <h3 className="font-semibold text-sm text-[#242424]">Official Safeguarding Audit Dossier (Print View)</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-[#0d9488] text-white text-xs font-semibold rounded-xs hover:bg-[#0f766e] transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-[#605e5c] hover:text-[#242424] rounded-xs"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Body */}
            <div className="p-8 overflow-y-auto space-y-6 text-xs text-[#323130]">
              {/* Document Header */}
              <div className="border-b-2 border-[#0d9488] pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-lg font-bold text-[#242424] uppercase tracking-tight">
                    Safeguarding Accommodation Support Audit
                  </h1>
                  <p className="text-xs text-[#605e5c]">
                    Dossier Type: {REPORT_TYPES.find(r => r.id === selectedReportType)?.title}
                  </p>
                  <p className="text-xs text-[#605e5c]">
                    Scope: {selectedSite === 'all' ? 'All Contracted Accommodation Facilities' : selectedSite}
                  </p>
                </div>
                <div className="text-right text-[11px] text-[#605e5c]">
                  <div>Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  <div>Generated By: {users[0]?.name || (users[0] as any)?.fullName || 'Duty Officer'}</div>
                  <div>Security Classification: <strong>OFFICIAL-SENSITIVE</strong></div>
                </div>
              </div>

              {/* Summary Stats in Dossier */}
              <div className="grid grid-cols-3 gap-4 bg-[#faf9f8] p-4 rounded-xs border border-[#edebe9]">
                <div>
                  <div className="text-[10px] text-[#605e5c] uppercase font-bold">Total Included Records</div>
                  <div className="text-xl font-bold text-[#0d9488]">{sortedData.length}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#605e5c] uppercase font-bold">Date Filter</div>
                  <div className="text-sm font-semibold text-[#242424] capitalize">{dateRange === 'all' ? 'All Historic' : dateRange}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#605e5c] uppercase font-bold">Compliance Status</div>
                  <div className="text-sm font-semibold text-[#107c10]">100% Certified</div>
                </div>
              </div>

              {/* Records Table in Dossier */}
              <div>
                <h4 className="font-bold text-xs uppercase mb-2 text-[#242424]">Detailed Record Schedule</h4>
                <table className="w-full text-left text-[11px] border border-[#edebe9] divide-y divide-[#edebe9]">
                  <thead className="bg-[#f3f2f1] font-semibold text-[#323130]">
                    <tr>
                      <th className="p-2">Ref</th>
                      <th className="p-2">Subject / Name</th>
                      <th className="p-2">Facility</th>
                      <th className="p-2">Category</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Lead</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edebe9]">
                    {sortedData.map(r => (
                      <tr key={r.id}>
                        <td className="p-2 font-mono font-semibold text-[#0d9488]">{r.reference}</td>
                        <td className="p-2 font-medium">{r.name}</td>
                        <td className="p-2">{r.site}</td>
                        <td className="p-2">{r.type}</td>
                        <td className="p-2">{r.status}</td>
                        <td className="p-2">{r.date}</td>
                        <td className="p-2">{r.officer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Certification Footer */}
              <div className="pt-6 border-t border-[#edebe9] grid grid-cols-2 gap-8 text-[11px] text-[#605e5c]">
                <div>
                  <p className="font-semibold text-[#242424] mb-4">Lead Safeguarding Officer Sign-Off:</p>
                  <div className="border-b border-[#323130] w-48 mb-1"></div>
                  <p>Signature &amp; Badge ID</p>
                </div>
                <div>
                  <p className="font-semibold text-[#242424] mb-4">Local Authority Auditor Verification:</p>
                  <div className="border-b border-[#323130] w-48 mb-1"></div>
                  <p>Signature &amp; Date</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Selection & Configuration Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title={`Export ${REPORT_TYPES.find(r => r.id === selectedReportType)?.title || 'Report'}`}
        moduleName={REPORT_TYPES.find(r => r.id === selectedReportType)?.title || 'Report'}
        defaultFormat={exportModalFormat}
        defaultOrientation="landscape"
        totalRecordCount={rawDataset.length}
        filteredRecordCount={sortedData.length}
        dateRangeRecordCount={calculateDateRangeCount}
        availableColumns={reportExportColumns}
        getPreviewData={getExportPreviewData}
        onExport={handlePerformExport}
      />
    </div>
  );
};
