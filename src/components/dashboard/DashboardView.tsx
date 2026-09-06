import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Building2, 
  ArrowUpRight, 
  Siren, 
  Plus, 
  FileSpreadsheet, 
  FileText,
  TrendingUp,
  ShieldCheck,
  Zap,
  SlidersHorizontal,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FilterBar } from '../common/FilterBar';
import { QuickIncidentModal } from './QuickIncidentModal';
import { DashboardAnalytics } from './DashboardAnalytics';
import { PropertyLoadBreakdown } from './PropertyLoadBreakdown';
import { VulnerabilityRiskBreakdown } from './VulnerabilityRiskBreakdown';
import { CommercialWelfareBreakdown } from './CommercialWelfareBreakdown';
import { PropertyOperationsOverviewWidget } from './PropertyOperationsOverviewWidget';
import { exportDashboardSummaryPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { ExportModal, ExportFormat, ExportScope, ExportColumnOption, ExportOrientation } from '../common/ExportModal';
import { ExportDropdown } from '../common/ExportDropdown';

const dashboardExportColumns: ExportColumnOption[] = [
  { id: 'type', label: 'Record Type' },
  { id: 'site', label: 'Site / Hotel' },
  { id: 'name', label: 'Service User / Resident' },
  { id: 'ref', label: 'Reference (Port / NASS / ID)' },
  { id: 'status', label: 'Status' },
  { id: 'date', label: 'Record Date' },
  { id: 'notes', label: 'Details / Incident Notes' }
];

export const DashboardView: React.FC = () => {
  const { 
    referrals, 
    vulnerableSUs, 
    challengingSUs, 
    escalations, 
    sites, 
    properties,
    allowedSites, 
    setActivePage,
    currentUserRole,
    assignedSite,
    canAccessAllSites,
    lastOperationDurationMs
  } = useApp();

  const [siteFilter, setSiteFilter] = useState<string>(canAccessAllSites() ? 'all' : assignedSite);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isQuickIncidentModalOpen, setIsQuickIncidentModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportModalFormat, setExportModalFormat] = useState<ExportFormat>('pdf');

  const [widgetVisibility, setWidgetVisibility] = useState({
    stats: true,
    laundryFoodOperations: true,
    analytics: true,
    vulnerable: true,
    quickOps: true
  });
  const [showWidgetMenu, setShowWidgetMenu] = useState(false);
  const widgetMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (widgetMenuRef.current && !widgetMenuRef.current.contains(e.target as Node)) {
        setShowWidgetMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleReset = () => {
    setSiteFilter(canAccessAllSites() ? 'all' : assignedSite);
    setMonthFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  // Filtered active referrals
  const activeReferrals = useMemo(() => {
    return referrals.filter(r => {
      if (r.status === 'Archived') return false;
      if (siteFilter !== 'all' && r.site !== siteFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (monthFilter !== 'all' && !r.dateReferred.startsWith(monthFilter)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (r.suName || '').toLowerCase().includes(q) ||
          (r.portRef || '').toLowerCase().includes(q) ||
          (r.mosaicId || '').toLowerCase().includes(q) ||
          (r.notesActionTaken || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [referrals, siteFilter, statusFilter, monthFilter, searchQuery]);

  // Filtered active vulnerable
  const activeVulnerable = useMemo(() => {
    return vulnerableSUs.filter(v => {
      if (v.status === 'Archived') return false;
      if (siteFilter !== 'all' && v.site !== siteFilter) return false;
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      return true;
    });
  }, [vulnerableSUs, siteFilter, statusFilter]);

  // Filtered active challenging
  const activeChallenging = useMemo(() => {
    return challengingSUs.filter(c => {
      if (c.status === 'Archived') return false;
      if (siteFilter !== 'all' && c.site !== siteFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return true;
    });
  }, [challengingSUs, siteFilter, statusFilter]);

  // Escalations
  const activeEscalations = useMemo(() => {
    return escalations.filter(e => {
      if (siteFilter !== 'all' && e.site !== siteFilter) return false;
      return e.status !== 'Resolved';
    });
  }, [escalations, siteFilter]);

  // Overall aggregates
  const totalCases = activeReferrals.length + activeVulnerable.length + activeChallenging.length;
  const totalAllTimeCases = referrals.length + vulnerableSUs.length + challengingSUs.length;
  const openCount = activeReferrals.filter(r => r.status === 'Open').length + activeVulnerable.filter(v => v.status === 'Open').length;
  const inProgressCount = activeReferrals.filter(r => r.status === 'In progress').length + activeVulnerable.filter(v => v.status === 'In progress').length;
  const completedCount = activeReferrals.filter(r => r.status === 'Completed').length + activeChallenging.filter(c => c.status === 'Completed').length;
  const highRiskCount = activeVulnerable.filter(v => v.riskLevel === 'High' || v.riskLevel === 'Critical').length + 
                        activeChallenging.filter(c => c.riskFactor === 'High' || c.riskFactor === 'Critical').length;

  const sitesWithData = new Set([
    ...activeReferrals.map(r => r.site),
    ...activeVulnerable.map(v => v.site),
    ...activeChallenging.map(c => c.site)
  ]).size;

  const handleOpenExportModal = (format: ExportFormat = 'pdf') => {
    setExportModalFormat(format);
    setIsExportModalOpen(true);
  };

  const calculateDateRangeCount = (start: string, end: string) => {
    const rCount = referrals.filter(r => r.dateReferred >= start && r.dateReferred <= end).length;
    const vCount = vulnerableSUs.filter(v => v.reviewDate >= start && v.reviewDate <= end).length;
    const cCount = challengingSUs.filter(c => c.date >= start && c.date <= end).length;
    const eCount = escalations.filter(e => {
      const d = e.dateOfIncident || (e.dateTime ? e.dateTime.slice(0, 10) : '');
      return d >= start && d <= end;
    }).length;
    return rCount + vCount + cCount + eCount;
  };

  const getDashboardExportData = (scope: ExportScope, startDate?: string, endDate?: string) => {
    let refData = referrals;
    let vulData = vulnerableSUs;
    let chData = challengingSUs;
    let escData = escalations;

    if (scope === 'filtered') {
      refData = activeReferrals;
      vulData = activeVulnerable;
      chData = activeChallenging;
      escData = activeEscalations;
    } else if (scope === 'custom' && startDate && endDate) {
      refData = referrals.filter(r => r.dateReferred >= startDate && r.dateReferred <= endDate);
      vulData = vulnerableSUs.filter(v => v.reviewDate >= startDate && v.reviewDate <= endDate);
      chData = challengingSUs.filter(c => c.date >= startDate && c.date <= endDate);
      escData = escalations.filter(e => {
        const d = e.dateOfIncident || (e.dateTime ? e.dateTime.slice(0, 10) : '');
        return d >= startDate && d <= endDate;
      });
    }

    const headers = ['Record Type', 'Site / Hotel', 'Service User / Resident', 'Reference (Port / NASS / ID)', 'Status', 'Record Date', 'Details / Incident Notes'];
    const rows = [
      ...refData.map(r => ['Safeguarding Referral', r.site, r.suName, r.portRef || r.mosaicId || '—', r.status, r.dateReferred, r.notesActionTaken]),
      ...vulData.map(v => ['Vulnerable Service User', v.site, v.suName, v.portOrNassRef || '—', v.status, v.reviewDate, v.vulnerability]),
      ...chData.map(c => ['Challenging Behaviour Log', c.site, c.name, c.portRef || '—', c.status, c.date, c.incidentDescription]),
      ...escData.map(e => ['Critical Escalation', e.siteName || e.site || '—', e.suName || '—', e.escalatedTo || '—', e.status, e.dateOfIncident || '', e.actionTaken || e.incidentNotes || ''])
    ];

    return { refData, vulData, chData, escData, headers, rows };
  };

  const getExportPreviewData = ({
    scope,
    startDate,
    endDate
  }: {
    scope: ExportScope;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    orientation: ExportOrientation;
    isCompact: boolean;
  }) => {
    const { headers, rows } = getDashboardExportData(scope, startDate, endDate);
    return { headers, rows };
  };

  const handlePerformExport = ({
    format,
    scope,
    startDate,
    endDate
  }: {
    format: ExportFormat;
    scope: ExportScope;
    orientation?: ExportOrientation;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => {
    const { refData, vulData, chData, escData, headers, rows } = getDashboardExportData(scope, startDate, endDate);

    if (format === 'csv') {
      exportTableToCsv({
        filename: `SG-Dashboard-Export-${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportDashboardSummaryPdf({
        siteFilter: scope === 'all' ? 'All All-Time Records' : siteFilter,
        monthFilter: scope === 'custom' ? `${startDate} to ${endDate}` : monthFilter,
        statusFilter: scope === 'all' ? 'All Statuses' : statusFilter,
        searchQuery: scope === 'all' ? '' : searchQuery,
        stats: {
          totalCases: refData.length + vulData.length + chData.length,
          openCount: refData.filter(r => r.status === 'Open').length + vulData.filter(v => v.status === 'Open').length,
          inProgressCount: refData.filter(r => r.status === 'In progress').length + vulData.filter(v => v.status === 'In progress').length,
          completedCount: refData.filter(r => r.status === 'Completed').length + chData.filter(c => c.status === 'Completed').length,
          highRiskCount: vulData.filter(v => v.riskLevel === 'High' || v.riskLevel === 'Critical').length + chData.filter(c => c.riskFactor === 'High' || c.riskFactor === 'Critical').length,
          sitesWithData: new Set([...refData.map(r => r.site), ...vulData.map(v => v.site), ...chData.map(c => c.site)]).size
        },
        referrals: refData.map(r => ({
          site: r.site,
          suName: r.suName,
          portRef: r.portRef,
          referralType: r.referralType,
          status: r.status,
          dateReferred: r.dateReferred,
          council: r.referralCouncil,
          notes: r.notesActionTaken
        })),
        vulnerableSUs: vulData.map(v => ({
          site: v.site,
          room: v.roomOrFlatNo,
          suName: v.suName,
          group: v.group,
          riskLevel: v.riskLevel,
          vulnerability: v.vulnerability,
          reviewDate: v.reviewDate,
          worker: v.allocatedWorker
        })),
        escalations: escData.map(e => ({
          site: e.siteName || e.site || '',
          resident: e.suName || '',
          type: e.incidentType || e.incidentTitle || 'Escalation',
          urgency: e.urgency || 'High',
          status: e.status,
          date: e.dateOfIncident || (e.dateTime ? e.dateTime.slice(0, 10) : '') || '',
          authorities: e.reportedAuthorities || e.escalatedTo || 'Safeguarding Team',
          action: e.actionTaken || e.immediateAction || e.incidentNotes || ''
        }))
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Title & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <h2 className="text-2xl font-semibold text-[#242424] tracking-tight">
            SD Commercial Trackers Dashboard
          </h2>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Commercial operations, resident safeguarding trackers, facility logs, and compliance analytics across contracted accommodation sites.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Incident Log shortcut button */}
          <button
            id="btn-quick-incident-log"
            onClick={() => setIsQuickIncidentModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xs shadow-xs transition-colors"
            title="Trigger Quick Incident Log for immediate escalation reporting"
          >
            <Siren className="w-3.5 h-3.5 animate-pulse" />
            <span>Quick Incident Log</span>
          </button>

          <button
            onClick={() => setActivePage('referrals')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Record</span>
          </button>
          
          {/* Customize Widgets Button */}
          <div className="relative" ref={widgetMenuRef}>
            <button
              onClick={() => setShowWidgetMenu(!showWidgetMenu)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-[#8a8886] hover:bg-[#edebe9] text-[#323130] rounded-xs shadow-xs transition-colors"
              title="Toggle dashboard widget visibility"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#0d9488]" />
              <span>Customize Widgets</span>
            </button>

            {showWidgetMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-[#e1dfdd] rounded-xs shadow-xl z-50 p-3 space-y-2 text-xs">
                <div className="font-bold text-[#242424] pb-1 border-b border-[#edebe9] flex items-center justify-between">
                  <span>Dashboard Widget Visibility</span>
                  <button 
                    onClick={() => setWidgetVisibility({ stats: true, laundryFoodOperations: true, analytics: true, vulnerable: true, quickOps: true })}
                    className="text-[10px] text-[#0d9488] hover:underline font-normal"
                  >
                    Reset All
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between p-1 hover:bg-[#f3f2f1] rounded cursor-pointer">
                    <span className="text-[#323130]">Key Summary Cards</span>
                    <input 
                      type="checkbox" 
                      checked={widgetVisibility.stats} 
                      onChange={e => setWidgetVisibility({ ...widgetVisibility, stats: e.target.checked })} 
                      className="rounded accent-[#0d9488]"
                    />
                  </label>
                  <label className="flex items-center justify-between p-1 hover:bg-[#f3f2f1] rounded cursor-pointer">
                    <span className="text-[#323130]">Laundry Logs &amp; Hot Food 4-Vendors</span>
                    <input 
                      type="checkbox" 
                      checked={widgetVisibility.laundryFoodOperations} 
                      onChange={e => setWidgetVisibility({ ...widgetVisibility, laundryFoodOperations: e.target.checked })} 
                      className="rounded accent-[#0d9488]"
                    />
                  </label>
                  <label className="flex items-center justify-between p-1 hover:bg-[#f3f2f1] rounded cursor-pointer">
                    <span className="text-[#323130]">Analytics Charts</span>
                    <input 
                      type="checkbox" 
                      checked={widgetVisibility.analytics} 
                      onChange={e => setWidgetVisibility({ ...widgetVisibility, analytics: e.target.checked })} 
                      className="rounded accent-[#0d9488]"
                    />
                  </label>
                  <label className="flex items-center justify-between p-1 hover:bg-[#f3f2f1] rounded cursor-pointer">
                    <span className="text-[#323130]">Priority Vulnerable SUs</span>
                    <input 
                      type="checkbox" 
                      checked={widgetVisibility.vulnerable} 
                      onChange={e => setWidgetVisibility({ ...widgetVisibility, vulnerable: e.target.checked })} 
                      className="rounded accent-[#0d9488]"
                    />
                  </label>
                  <label className="flex items-center justify-between p-1 hover:bg-[#f3f2f1] rounded cursor-pointer">
                    <span className="text-[#323130]">Quick Operations Panel</span>
                    <input 
                      type="checkbox" 
                      checked={widgetVisibility.quickOps} 
                      onChange={e => setWidgetVisibility({ ...widgetVisibility, quickOps: e.target.checked })} 
                      className="rounded accent-[#0d9488]"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <ExportDropdown
            moduleName="Dashboard Cases"
            totalRecordCount={totalAllTimeCases}
            filteredRecordCount={totalCases}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={dashboardExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
          />
        </div>
      </div>

      {/* Executive Key Summary Cards Section */}
      {widgetVisibility.stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Active Referrals */}
        <div 
          id="summary-card-active-referrals"
          onClick={() => setActivePage('referrals')}
          className="bg-white border border-[#5eead4] rounded-xs p-3.5 shadow-xs hover:shadow-md hover:border-[#0d9488] transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-[#0f766e] uppercase tracking-wider">
                Total Active Referrals
              </span>
              <div className="text-3xl font-bold text-[#242424] mt-1.5 group-hover:text-[#0d9488] transition-colors">
                {referrals.filter(r => r.status !== 'Archived').length}
              </div>
              <p className="text-[11px] text-[#605e5c] mt-1">
                {referrals.filter(r => r.status === 'Open').length} Open &bull; {referrals.filter(r => r.status === 'In progress').length} In Progress
              </p>
            </div>
            <div className="p-2.5 bg-[#f0fdfa] text-[#0d9488] rounded-xs group-hover:bg-[#0d9488] group-hover:text-white transition-colors">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#edebe9] flex items-center justify-between text-xs text-[#0d9488] font-semibold">
            <span>Manage Referrals</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </div>

        {/* Card 2: Open Escalations */}
        <div 
          id="summary-card-open-escalations"
          onClick={() => setActivePage('escalations')}
          className="bg-white border border-red-200 rounded-xs p-3.5 shadow-xs hover:shadow-md hover:border-[#a4262c] transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-red-800 uppercase tracking-wider">
                Open Escalations
              </span>
              <div className="text-3xl font-bold text-[#a4262c] mt-1.5">
                {escalations.filter(e => e.status !== 'Resolved').length}
              </div>
              <p className="text-[11px] text-red-700 mt-1">
                Requiring multi-agency & emergency review
              </p>
            </div>
            <div className="p-2.5 bg-red-100 text-[#a4262c] rounded-xs group-hover:bg-[#a4262c] group-hover:text-white transition-colors">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-red-100 flex items-center justify-between text-xs text-[#a4262c] font-semibold">
            <span>Review Escalations</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </div>

        {/* Card 3: Properties Managed (Admin) vs Assigned Accommodation Site (Non-Admin) */}
        {currentUserRole === 'Super Admin' || currentUserRole === 'Admin' ? (
          <div 
            id="summary-card-properties-managed"
            onClick={() => setActivePage('properties')}
            className="bg-white border border-[#d2d0ce] rounded-xs p-3.5 shadow-xs hover:shadow-md hover:border-[#0d9488] transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-[#323130] uppercase tracking-wider">
                  Total Properties Managed
                </span>
                <div className="text-3xl font-bold text-[#242424] mt-1.5 group-hover:text-[#0d9488] transition-colors">
                  {properties.length}
                </div>
                <p className="text-[11px] text-[#605e5c] mt-1">
                  Official contracted accommodation sites
                </p>
              </div>
              <div className="p-2.5 bg-neutral-100 text-[#323130] rounded-xs group-hover:bg-[#0d9488] group-hover:text-white transition-colors">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#edebe9] flex items-center justify-between text-xs text-[#0d9488] font-semibold">
              <span>View Properties Directory</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        ) : (
          <div 
            id="summary-card-assigned-site"
            onClick={() => setActivePage('maintenance')}
            className="bg-white border border-[#d2d0ce] rounded-xs p-3.5 shadow-xs hover:shadow-md hover:border-[#0d9488] transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-[#323130] uppercase tracking-wider">
                  Assigned Accommodation
                </span>
                <div className="text-xl font-bold text-[#242424] mt-1.5 group-hover:text-[#0d9488] transition-colors truncate max-w-[200px]" title={assignedSite}>
                  {assignedSite}
                </div>
                <p className="text-[11px] text-[#605e5c] mt-1">
                  Operational site for {currentUserRole}
                </p>
              </div>
              <div className="p-2.5 bg-neutral-100 text-[#323130] rounded-xs group-hover:bg-[#0d9488] group-hover:text-white transition-colors">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#edebe9] flex items-center justify-between text-xs text-[#0d9488] font-semibold">
              <span>Open Maintenance Tracker</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        )}
      </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        siteFilter={siteFilter}
        setSiteFilter={setSiteFilter}
        monthFilter={monthFilter}
        setMonthFilter={setMonthFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onReset={handleReset}
        onOpenExport={handleOpenExportModal}
        totalFilteredCount={totalCases}
      />

      {/* 5-Column Microsoft Style Stat Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-[#e1dfdd] p-3.5 shadow-xs rounded-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Total Active Cases</span>
            <Users className="w-4 h-4 text-[#0d9488]" />
          </div>
          <strong className="block text-2xl font-semibold text-[#242424] mt-2">
            {totalCases}
          </strong>
          <span className="text-[11px] text-[#605e5c]">Across active modules</span>
        </div>

        <div className="bg-white border border-[#e1dfdd] p-3.5 shadow-xs rounded-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Open Status</span>
            <Clock className="w-4 h-4 text-[#0f766e]" />
          </div>
          <strong className="block text-2xl font-semibold text-[#0f766e] mt-2">
            {openCount}
          </strong>
          <span className="text-[11px] text-[#605e5c]">Awaiting LA allocation</span>
        </div>

        <div className="bg-white border border-[#e1dfdd] p-3.5 shadow-xs rounded-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>In Progress</span>
            <TrendingUp className="w-4 h-4 text-[#7f6000]" />
          </div>
          <strong className="block text-2xl font-semibold text-[#7f6000] mt-2">
            {inProgressCount}
          </strong>
          <span className="text-[11px] text-[#605e5c]">Under team review</span>
        </div>

        <div className="bg-white border border-[#e1dfdd] p-3.5 shadow-xs rounded-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-[#107c10]" />
          </div>
          <strong className="block text-2xl font-semibold text-[#107c10] mt-2">
            {completedCount}
          </strong>
          <span className="text-[11px] text-[#605e5c]">Safeguarding resolved</span>
        </div>

        <div className="bg-white border border-[#e1dfdd] p-3.5 shadow-xs rounded-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Sites Shown</span>
            <Building2 className="w-4 h-4 text-neutral-600" />
          </div>
          <strong className="block text-2xl font-semibold text-neutral-800 mt-2">
            {sitesWithData} <span className="text-xs text-neutral-400 font-normal">/ {sites.length}</span>
          </strong>
          <span className="text-[11px] text-[#605e5c]">Permitted hotels</span>
        </div>
      </div>

      {/* Recharts Data Visualization Section: Incident Types & Referral Status Trends */}
      {widgetVisibility.analytics && (
        <div className="space-y-4">
          <DashboardAnalytics
            referrals={activeReferrals}
            escalations={activeEscalations}
            challengingSUs={activeChallenging}
            selectedSite={siteFilter}
            onNavigate={setActivePage}
          />

          {/* Operational Breakdown Cards Suite */}
          <PropertyLoadBreakdown 
            onSelectSiteFilter={setSiteFilter} 
            onNavigate={setActivePage} 
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <VulnerabilityRiskBreakdown 
              onNavigate={setActivePage} 
            />
            <CommercialWelfareBreakdown 
              onNavigate={setActivePage} 
            />
          </div>

          {widgetVisibility.laundryFoodOperations && (
            <PropertyOperationsOverviewWidget 
              onNavigate={setActivePage}
            />
          )}
        </div>
      )}

      {/* Module Quick Shortcuts & Urgent Safeguarding Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Urgent Attention / High Risk Cases */}
        {widgetVisibility.vulnerable && (
          <div className={`${widgetVisibility.quickOps ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white border border-[#e1dfdd] shadow-xs rounded-xs`}>
            <div className="px-4 py-3 border-b border-[#e1dfdd] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-[#242424]">
                  Priority Safeguarding & High-Risk SUs ({highRiskCount})
                </h3>
              </div>
              <button
                onClick={() => setActivePage('vulnerable')}
                className="text-xs text-[#0d9488] hover:underline flex items-center gap-1"
              >
                View all vulnerable <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="p-4 divide-y divide-[#edebe9] text-xs">
              {activeVulnerable.slice(0, 4).map(vul => (
                <div key={vul.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-800 text-sm">{vul.suName}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        vul.riskLevel === 'High' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {vul.riskLevel} Risk
                      </span>
                      <span className="text-neutral-500">{vul.site} · {vul.roomOrFlatNo}</span>
                    </div>
                    <p className="text-[#605e5c] line-clamp-1">{vul.vulnerability}</p>
                    <div className="text-[11px] text-neutral-500 flex items-center gap-2">
                      <span>Review Due: <strong className="text-neutral-700">{vul.reviewDate}</strong></span>
                      <span>•</span>
                      <span>Worker: {vul.allocatedWorker}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActivePage('vulnerable')}
                    className="px-2.5 py-1 bg-white hover:bg-[#edebe9] border border-[#8a8886] rounded-xs text-[#323130] shrink-0 font-medium"
                  >
                    Details
                  </button>
                </div>
              ))}
              {activeVulnerable.length === 0 && (
                <div className="text-center py-6 text-[#605e5c]">
                  No high-risk safeguarding cases reported in selected filter scope.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Operations Panel */}
        {widgetVisibility.quickOps && (
          <div className={`${widgetVisibility.vulnerable ? 'lg:col-span-1' : 'lg:col-span-3'} bg-white border border-[#e1dfdd] shadow-xs rounded-xs flex flex-col justify-between`}>
          <div>
            <div className="px-4 py-3 border-b border-[#e1dfdd]">
              <h3 className="text-sm font-semibold text-[#242424] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#0d9488]" />
                <span>Quick Operations</span>
              </h3>
            </div>
            <div className="p-4 space-y-2 text-xs">
              <button
                id="quick-op-incident-log"
                onClick={() => setIsQuickIncidentModalOpen(true)}
                className="w-full text-left p-2.5 rounded bg-red-50 hover:bg-red-100 text-red-800 font-bold flex items-center justify-between border border-red-200 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <Siren className="w-4 h-4 text-red-600 animate-pulse" />
                  <span>⚡ Quick Incident Log (Immediate Escalation)</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-red-700" />
              </button>
              <button
                onClick={() => setActivePage('referrals')}
                className="w-full text-left p-2.5 rounded bg-[#f3f8fd] hover:bg-[#f0fdfa] text-[#0f766e] font-medium flex items-center justify-between border border-[#99f6e4] transition-colors"
              >
                <span>+ Register New SG Referral</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#0d9488]" />
              </button>
              <button
                onClick={() => setActivePage('vulnerable')}
                className="w-full text-left p-2.5 rounded bg-[#fff8e5] hover:bg-[#ffefc2] text-[#7f6000] font-medium flex items-center justify-between border border-[#ffe082] transition-colors"
              >
                <span>+ Log Vulnerability Assessment</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#7f6000]" />
              </button>
              <button
                onClick={() => setActivePage('challenging')}
                className="w-full text-left p-2.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-800 font-medium flex items-center justify-between border border-purple-200 transition-colors"
              >
                <span>+ Log Challenging Behavior Incident</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-purple-700" />
              </button>
              <button
                onClick={() => setActivePage('laundry')}
                className="w-full text-left p-2.5 rounded bg-[#f7f8fa] hover:bg-[#edebe9] text-[#323130] font-medium flex items-center justify-between border border-[#edebe9] transition-colors"
              >
                <span>+ Record Laundry Wash Intake</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-neutral-600" />
              </button>
              <button
                onClick={() => setActivePage('food')}
                className="w-full text-left p-2.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium flex items-center justify-between border border-emerald-200 transition-colors"
              >
                <span>+ Log Hot Food Temp Check</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-700" />
              </button>
            </div>
          </div>

          <div className="p-4 bg-[#faf9f8] border-t border-[#edebe9] text-[11px] text-[#605e5c]">
            <div className="flex items-center gap-1.5 font-semibold text-neutral-800">
              <ShieldCheck className="w-3.5 h-3.5 text-[#107c10]" />
              <span>Strict Role Protection Active</span>
            </div>
            <p className="mt-0.5">
              All CRUD changes require explicit confirmation modals per system policy.
            </p>
          </div>
        </div>
        )}
      </div>

      {/* Quick Incident Log Modal for Immediate Escalation Reporting */}
      <QuickIncidentModal
        isOpen={isQuickIncidentModalOpen}
        onClose={() => setIsQuickIncidentModalOpen(false)}
      />

      {/* Export Selection & Configuration Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Dashboard Command Summary"
        moduleName="Dashboard Cases"
        defaultFormat={exportModalFormat}
        defaultOrientation="landscape"
        totalRecordCount={totalAllTimeCases}
        filteredRecordCount={totalCases}
        dateRangeRecordCount={calculateDateRangeCount}
        availableColumns={dashboardExportColumns}
        getPreviewData={getExportPreviewData}
        onExport={handlePerformExport}
      />
    </div>
  );
};
