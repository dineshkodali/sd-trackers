import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Building2, 
  ArrowUpRight, 
  Siren, 
  Plus, 
  TrendingUp,
  ShieldCheck,
  Zap,
  ArrowDown,
  ArrowUp,
  GripVertical,
  X,
  Bus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useDashboards } from '../../hooks/useDashboards';
import {
  DEFAULT_ROW_LIMIT,
  ROW_LIMIT_OPTIONS,
  WIDGET_SIZE_LABELS,
  getWidgetDefinition,
  isWidgetAvailable,
  sizeSpanClass,
  type DashboardWidgetInstance,
} from '../../config/dashboardWidgets';
import { DashboardToolbar } from './DashboardToolbar';
import { WidgetLibrary } from './WidgetLibrary';
import { ErrorBoundary } from '../common/ErrorBoundary';
import {
  ComplianceStatusWidget,
  FinanceBillsWidget,
  MaintenanceOpenWidget,
  MyRequestsWidget,
  QuickActionsWidget,
  RecentNotificationsWidget,
} from './DashboardMiniWidgets';
import { FilterBar } from '../common/FilterBar';
import { QuickIncidentModal } from './QuickIncidentModal';
import { DashboardAnalytics } from './DashboardAnalytics';
import { PropertyLoadBreakdown } from './PropertyLoadBreakdown';
import { VulnerabilityRiskBreakdown } from './VulnerabilityRiskBreakdown';
import { CommercialWelfareBreakdown } from './CommercialWelfareBreakdown';
import { PropertyOperationsOverviewWidget } from './PropertyOperationsOverviewWidget';
import { GuestAnalyticsWidget } from './GuestAnalyticsWidget';
import { TransportKPIDashboard } from '../transport/TransportKPIDashboard';
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
    defaultSiteFilter, 
    referrals, 
    vulnerableSUs, 
    challengingSUs, 
    escalations, 
    sites, 
    properties, 
    setActivePage,
    currentUserRole,
    assignedSite,
    allowedSites,
    canAccessAllSites,
    isSitePermitted,
    canAccessPage,
    requestConfirmation,
    authProfile
  } = useApp();

  const [siteFilter, setSiteFilter] = useState<string>(defaultSiteFilter);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isQuickIncidentModalOpen, setIsQuickIncidentModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportModalFormat, setExportModalFormat] = useState<ExportFormat>('pdf');

  const dash = useDashboards(authProfile?.id);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    setSiteFilter(defaultSiteFilter);
  }, [defaultSiteFilter]);

  const handleReset = () => {
    setSiteFilter(canAccessAllSites() || (allowedSites && allowedSites.length > 1) ? 'all' : (allowedSites[0] || assignedSite));
    setMonthFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const siteFilterPredicate = (item: any) => {
    const itemSite = item?.site || item?.siteName || item?.hotel || item?.hotelName || item?.site_name;
    return isSitePermitted(itemSite, siteFilter);
  };

  // Filtered active referrals
  const activeReferrals = useMemo(() => {
    return referrals.filter(r => {
      if (!isSitePermitted(r.site, siteFilter)) return false;
      if (r.status === 'Archived') return false;
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
  }, [referrals, isSitePermitted, siteFilter, statusFilter, monthFilter, searchQuery]);

  // Filtered active vulnerable
  const activeVulnerable = useMemo(() => {
    return vulnerableSUs.filter(v => {
      if (!isSitePermitted(v.site, siteFilter)) return false;
      if (v.status === 'Archived') return false;
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      return true;
    });
  }, [vulnerableSUs, isSitePermitted, siteFilter, statusFilter]);

  // Filtered active challenging
  const activeChallenging = useMemo(() => {
    return challengingSUs.filter(c => {
      if (!isSitePermitted(c.site, siteFilter)) return false;
      if (c.status === 'Archived') return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return true;
    });
  }, [challengingSUs, isSitePermitted, siteFilter, statusFilter]);

  // Escalations
  const activeEscalations = useMemo(() => {
    return escalations.filter(e => {
      if (!isSitePermitted(e.siteName || e.site, siteFilter)) return false;
      return e.status !== 'Resolved';
    });
  }, [escalations, isSitePermitted, siteFilter]);

  // Overall aggregates
  const totalCases = activeReferrals.length + activeVulnerable.length + activeChallenging.length;
  const totalAllTimeCases = (
    referrals.filter(r => isSitePermitted(r.site, 'all')).length + 
    vulnerableSUs.filter(v => isSitePermitted(v.site, 'all')).length + 
    challengingSUs.filter(c => isSitePermitted(c.site, 'all')).length
  );
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
    let refData = referrals.filter(r => isSitePermitted(r.site, 'all'));
    let vulData = vulnerableSUs.filter(v => isSitePermitted(v.site, 'all'));
    let chData = challengingSUs.filter(c => isSitePermitted(c.site, 'all'));
    let escData = escalations.filter(e => isSitePermitted(e.siteName || e.site, 'all'));

    if (scope === 'filtered') {
      refData = activeReferrals;
      vulData = activeVulnerable;
      chData = activeChallenging;
      escData = activeEscalations;
    } else if (scope === 'custom' && startDate && endDate) {
      refData = refData.filter(r => r.dateReferred >= startDate && r.dateReferred <= endDate);
      vulData = vulData.filter(v => v.reviewDate >= startDate && v.reviewDate <= endDate);
      chData = chData.filter(c => c.date >= startDate && c.date <= endDate);
      escData = escData.filter(e => {
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


  const widgetProps = { onNavigate: setActivePage };

  // A saved layout can list any widget; only those the user can already view are shown.
  const visibleWidgets = dash.layout.widgets
    .map((inst, index) => ({ inst, index, def: getWidgetDefinition(inst.type) }))
    .filter((w): w is { inst: DashboardWidgetInstance; index: number; def: NonNullable<typeof w.def> } => !!w.def && isWidgetAvailable(w.def, canAccessPage))
    .map(({ inst, index }) => ({ inst, index }));

  const confirmDelete = () => requestConfirmation({
    title: 'Delete dashboard',
    message: `Delete "${dash.active.name}"? This cannot be undone.`,
    confirmLabel: 'Delete',
    isDanger: true,
    onConfirm: () => { void dash.remove(); },
  });

  const renderWidget = (inst: DashboardWidgetInstance): React.ReactNode => {
    switch (inst.type) {
      case 'summaryCards':
        return (
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
                {activeReferrals.length}
              </div>
              <p className="text-[11px] text-[#605e5c] mt-1">
                {activeReferrals.filter(r => r.status === 'Open').length} Open &bull; {activeReferrals.filter(r => r.status === 'In progress').length} In Progress
              </p>
            </div>
            <div className="p-2.5 bg-[#f0fdfa] text-[#0d9488] rounded-xs group-hover:bg-[#0d9488] group-hover:text-white transition-colors">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#edebe9] flex items-center justify-between text-xs text-[#0d9488] font-semibold">
            <span>Manage Referrals</span>
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform" />
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
                {activeEscalations.length}
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
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform" />
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
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform" />
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
                <div className="text-xl font-bold text-[#242424] mt-1.5 group-hover:text-[#0d9488] transition-colors truncate max-w-[200px]" title={allowedSites.length > 0 ? allowedSites.join(', ') : assignedSite}>
                  {allowedSites.length > 0 ? allowedSites.join(', ') : assignedSite}
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
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform" />
            </div>
          </div>
        )}
      </div>
        );
      case 'keyStats':
        return (
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
        );
      case 'analytics':
        return (
          <DashboardAnalytics
            referrals={activeReferrals}
            escalations={activeEscalations}
            challengingSUs={activeChallenging}
            selectedSite={siteFilter}
            onNavigate={setActivePage}
          />
        );
      case 'propertyLoad':
        return (
          <PropertyLoadBreakdown 
            onSelectSiteFilter={setSiteFilter} 
            onNavigate={setActivePage} 
          />
        );
      case 'vulnerabilityRisk':
        return (
            <VulnerabilityRiskBreakdown 
              onNavigate={setActivePage} 
            />
        );
      case 'welfareBreakdown':
        return (
            <CommercialWelfareBreakdown 
              onNavigate={setActivePage} 
            />
        );
      case 'operationsOverview':
        return (
            <PropertyOperationsOverviewWidget 
              onNavigate={setActivePage}
            />
        );
      case 'guestAnalytics':
        return <GuestAnalyticsWidget siteFilter={siteFilter} onNavigate={setActivePage} />;
      case 'transport':
        return (
            <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#edebe9] mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-50 text-[#8764b8] rounded-xs border border-purple-200">
                    <Bus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#242424]">Public Transport</h3>
                    </div>
                    <p className="text-xs text-[#605e5c]">Journeys, issues and funding requests</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePage('publicTransport')}
                  className="text-xs font-semibold text-[#8764b8] hover:text-[#6b4f98] flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-xs transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <span>Open Transport Tracker</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <TransportKPIDashboard selectedSiteFilter={siteFilter} onNavigate={setActivePage} />
            </div>
        );
      case 'priorityVulnerable': {
        const limit = inst.config?.limit ?? DEFAULT_ROW_LIMIT;
        return (
          <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs h-full">
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
              {activeVulnerable.slice(0, limit).map(vul => (
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
        );
      }
      case 'quickActions':
        return <QuickActionsWidget onNavigate={setActivePage} onQuickIncident={() => setIsQuickIncidentModalOpen(true)} />;
      case 'myRequests':
        return <MyRequestsWidget {...widgetProps} limit={inst.config?.limit} />;
      case 'maintenanceOpen':
        return <MaintenanceOpenWidget {...widgetProps} />;
      case 'complianceStatus':
        return <ComplianceStatusWidget {...widgetProps} />;
      case 'financeBills':
        return <FinanceBillsWidget {...widgetProps} />;
      case 'recentNotifications':
        return <RecentNotificationsWidget {...widgetProps} limit={inst.config?.limit} />;
      default:
        return null;
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
            <Siren className="w-3.5 h-3.5" />
            <span>Quick Incident Log</span>
          </button>

          <button
            onClick={() => setActivePage('referrals')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Record</span>
          </button>
          
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

      <DashboardToolbar
        dashboards={dash.dashboards}
        active={dash.active}
        isBuiltIn={dash.isBuiltIn}
        isEditing={dash.isEditing}
        busy={dash.busy}
        error={dash.error}
        storage={dash.storage}
        canAddDashboard={dash.canAddDashboard}
        draftName={dash.draftName}
        previewing={previewing}
        onDraftName={dash.setDraftName}
        onSelect={dash.select}
        onCreate={dash.create}
        onRename={dash.rename}
        onDuplicate={dash.duplicate}
        onDelete={confirmDelete}
        onSetDefault={dash.setAsDefault}
        onEdit={dash.startEdit}
        onAddWidget={() => setLibraryOpen(true)}
        onTogglePreview={() => setPreviewing(p => !p)}
        onReset={dash.resetLayout}
        onSave={async () => { await dash.saveEdit(); setPreviewing(false); }}
        onCancel={() => { dash.cancelEdit(); setPreviewing(false); }}
      />
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

      {dash.loading ? (
        <p className="text-xs text-[#605e5c]" aria-busy="true">Loading dashboard…</p>
      ) : visibleWidgets.length === 0 ? (
        <div className="border border-dashed border-[#c8c6c4] rounded-xs p-8 text-center">
          <p className="text-sm font-semibold text-[#242424]">
            {dash.layout.widgets.length === 0 ? 'This dashboard has no widgets' : 'No widgets available for your access'}
          </p>
          <p className="text-xs text-[#605e5c] mt-1">
            {dash.isEditing ? 'Select Add widget to choose what to show.' : 'Select Edit dashboard, then Add widget.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {visibleWidgets.map(({ inst, index }, position) => {
            const def = getWidgetDefinition(inst.type)!;
            const editing = dash.isEditing && !previewing;
            return (
              <div
                key={inst.id}
                className={`${sizeSpanClass(inst.size)} min-w-0 ${editing ? 'outline outline-1 outline-dashed rounded-xs ' + (dropIndex === index && dragIndex !== index ? 'outline-[#0d9488] bg-[#f0fdfa]' : 'outline-[#c8c6c4]') : ''}`}
                draggable={editing}
                onDragStart={editing ? (e => { setDragIndex(index); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', inst.id); }) : undefined}
                onDragOver={editing ? (e => { e.preventDefault(); if (dropIndex !== index) setDropIndex(index); }) : undefined}
                onDrop={editing ? (e => { e.preventDefault(); if (dragIndex !== null) dash.moveWidget(dragIndex, index); setDragIndex(null); setDropIndex(null); }) : undefined}
                onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
              >
                {editing && (
                  <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#e1dfdd] bg-[#faf9f8] text-xs">
                    <GripVertical className="w-4 h-4 text-[#605e5c] cursor-grab shrink-0" aria-hidden="true" />
                    <span className="font-semibold text-[#323130] truncate flex-1">{def.title}</span>
                    {def.hasRowLimit && (
                      <select
                        aria-label={`Rows shown in ${def.title}`}
                        value={inst.config?.limit ?? DEFAULT_ROW_LIMIT}
                        onChange={e => dash.setWidgetLimit(inst.id, Number(e.target.value))}
                        className="px-1.5 py-1 border border-[#8a8886] rounded-xs bg-white"
                      >
                        {ROW_LIMIT_OPTIONS.map(n => <option key={n} value={n}>{n} rows</option>)}
                      </select>
                    )}
                    {def.sizes.length > 1 && (
                      <div role="group" aria-label={`Size of ${def.title}`} className="inline-flex border border-[#8a8886] rounded-xs overflow-hidden">
                        {def.sizes.map(sz => (
                          <button
                            key={sz}
                            type="button"
                            aria-pressed={inst.size === sz}
                            onClick={() => dash.resizeWidget(inst.id, sz)}
                            className={`px-2 py-1 ${inst.size === sz ? 'bg-[#0d9488] text-white' : 'bg-white text-[#323130] hover:bg-[#edebe9]'}`}
                          >
                            {WIDGET_SIZE_LABELS[sz]}
                          </button>
                        ))}
                      </div>
                    )}
                    <button type="button" aria-label={`Move ${def.title} earlier`} disabled={position === 0} onClick={() => dash.moveWidget(index, visibleWidgets[position - 1].index)} className="p-1 text-[#323130] hover:bg-[#edebe9] rounded-xs disabled:opacity-40"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" aria-label={`Move ${def.title} later`} disabled={position === visibleWidgets.length - 1} onClick={() => dash.moveWidget(index, visibleWidgets[position + 1].index)} className="p-1 text-[#323130] hover:bg-[#edebe9] rounded-xs disabled:opacity-40"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button type="button" aria-label={`Remove ${def.title}`} onClick={() => dash.removeWidget(inst.id)} className="p-1 text-[#a4262c] hover:bg-[#fde7e9] rounded-xs"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                <div className={editing ? 'pointer-events-none select-none' : 'h-full'}>
                  <ErrorBoundary>{renderWidget(inst)}</ErrorBoundary>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <WidgetLibrary
        isOpen={libraryOpen && dash.isEditing}
        onClose={() => setLibraryOpen(false)}
        onAdd={dash.addWidget}
        added={new Set(dash.layout.widgets.map(w => w.type))}
        canViewPage={canAccessPage}
      />

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
