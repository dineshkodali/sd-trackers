import React, { useEffect, useMemo, useState } from 'react';
import { IconRefresh as RefreshCw, IconSearch as Search } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { useOperationsData } from '../../hooks/useOperationsData';
import { useCheckObligations } from '../../hooks/useCheckObligations';
import { useOperationsLive } from '../../hooks/useOperationsLive';
import { useGuestContext } from '../../hooks/useGuestContext';
import { buildGuests, computeGuestStats } from '../../utils/guestStats';
import {
  selectDepartmentRows, selectFlowCounts, selectMaintenanceOverview, selectResidentProfile, selectSiteFlowRows, monitorChecks, listOverdueChecks, type DeptKey
} from '../../utils/operationsDepartments';
import { DepartmentTable, ChecksMonitor, MaintenanceOverviewSection, ResidentPropertySection } from './OperationsSections';
import { GuestAnalyticsWidget } from '../dashboard/GuestAnalyticsWidget';
import { PriorityVulnerableWidget } from '../dashboard/PriorityVulnerableWidget';
import { TransportKPIDashboard } from '../transport/TransportKPIDashboard';
import {
  buildSnapshot, selectDeadlines, selectOverview, type AttentionItem, type DashboardPage, type DeadlineItem, type OpsInput, type OpsScope, type OverviewRow
} from '../../utils/operationsSelectors';
import { createSiteResolver, londonNow, periodRange, relativeDay, PERIOD_LABELS, type PeriodKind } from '../../utils/operationsRules';

/**
 * Central Operations Dashboard - what is overdue, what is due soon, and where.
 *
 * Static by design: no animation, no charts, no transitions. Every number is built by the shared selectors
 * (utils/operationsSelectors.ts) and opens the records behind it. A number whose source could not be loaded or
 * that the user may not view is shown as unavailable or hidden - never as zero.
 */

const TH = 'px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] whitespace-nowrap';
const TD = 'px-2 py-1.5 align-top';
const DASH = '—';
const n = (v: number) => v.toLocaleString('en-GB');

/** Static text tag: colour never carries the meaning alone. */
const Tag: React.FC<{ tone: 'red' | 'amber' | 'grey'; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-xs border whitespace-nowrap ${
    tone === 'red' ? 'bg-red-50 text-red-800 border-red-200'
      : tone === 'amber' ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-neutral-100 text-neutral-700 border-neutral-200'
  }`}>{children}</span>
);

interface Kpi {
  id: string;
  label: string;
  value: string;
  context?: string;
  tone?: 'red' | 'amber' | 'none';
  onClick?: () => void;
  title?: string;
}

const KpiCell: React.FC<{ kpi: Kpi }> = ({ kpi }) => {
  const valueTone = kpi.tone === 'red' ? 'text-[#a4262c]' : kpi.tone === 'amber' ? 'text-[#7f6000]' : 'text-[#242424]';
  const body = (
    <>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] truncate">{kpi.label}</span>
      <span className={`block text-xl leading-tight font-semibold tabular-nums ${valueTone}`}>{kpi.value}</span>
      <span className="block text-[11px] text-[#605e5c] truncate">{kpi.context || ' '}</span>
    </>
  );
  const cls = 'text-left bg-white border border-[#e1dfdd] rounded-xs px-2.5 py-1.5 min-w-0';
  return kpi.onClick ? (
    <button type="button" id={`ops-kpi-${kpi.id}`} onClick={kpi.onClick} title={kpi.title} className={`${cls} hover:bg-[#f3f2f1] cursor-pointer focus:outline focus:outline-2 focus:outline-[#0d9488]`}>{body}</button>
  ) : (
    <div id={`ops-kpi-${kpi.id}`} title={kpi.title} className={cls}>{body}</div>
  );
};

const reasonTone = (a: AttentionItem): 'red' | 'amber' => (a.priority <= 4 ? 'red' : 'amber');

const WINDOWS = [7, 14, 30, 90] as const;
const ATTENTION_PREVIEW = 10;
const DEADLINE_PREVIEW = 12;
const ACTION_REASONS = new Set(['Absence follow-up overdue', 'PEEP review overdue', 'Room issue overdue', 'Room inspection overdue']);

export const OperationsDashboardView: React.FC = () => {
  const {
    sites, maintenanceRecords, complianceRecords, escalations, auditLogs, currentUserRole,
    canAccessPage, canAccessAllSites, allowedSites, defaultSiteFilter,
    liveDataStatus, navigateWithIntent, refreshLiveData,
    newArrivalsRecords, dispersalRecords, evictionRecords, laundryRecords, dailyRegisterRooms, dailyRegisterRecords
  } = useApp();

  // What this user may see. A source they cannot view is never requested, counted or shown.
  const can = {
    maintenance: canAccessPage('maintenance'),
    compliance: canAccessPage('compliance'),
    escalations: canAccessPage('escalations'),
    peep: canAccessPage('peepTracker'),
    followUps: canAccessPage('suAttendance'),
    property: canAccessPage('propertyManagement'),
    roomChecks: canAccessPage('roomChecks'),
    welfareChecks: canAccessPage('welfareChecks'),
    dailyRegisters: canAccessPage('dailyRegisters'),
    vulnerable: canAccessPage('vulnerable'),
    publicTransport: canAccessPage('publicTransport'),
    dispersal: canAccessPage('dispersal'),
    laundry: canAccessPage('laundry'),
    suUsers: canAccessPage('suUsers')
  };

  const master = useOperationsData({ property: can.property, peep: can.peep, followUps: can.followUps, residents: can.suUsers });
  // Live updates: another user's change re-reads the affected data here within a couple of seconds, with no page reload.
  const live = useOperationsLive(refreshLiveData);

  const [siteFilter, setSiteFilter] = useState<string>(defaultSiteFilter);
  useEffect(() => { setSiteFilter(defaultSiteFilter); }, [defaultSiteFilter]);
  const [windowDays, setWindowDays] = useState<number>(14);
  const [period, setPeriod] = useState<PeriodKind>('30d');
  const [search, setSearch] = useState('');
  const [attentionGroup, setAttentionGroup] = useState<'all' | 'actions'>('all');
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [showAllDeadlines, setShowAllDeadlines] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // The clock the overdue states are measured against: once a minute, so items turn overdue without a reload.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const siteRefs = useMemo(() => (sites || []).map(s => ({ id: s.id, name: s.name })), [sites]);
  const resolveSite = useMemo(() => createSiteResolver(siteRefs), [siteRefs]);

  const scope: OpsScope = useMemo(() => {
    const allowed: OpsScope['allowedSiteIds'] = canAccessAllSites()
      ? 'all'
      : new Set((allowedSites || []).map(resolveSite).filter((id): id is string => !!id));
    const picked = siteFilter === 'all' || siteFilter === 'All Sites' ? 'all' : (resolveSite(siteFilter) ?? '__none__');
    return { allowedSiteIds: allowed, siteId: picked };
  }, [canAccessAllSites, allowedSites, resolveSite, siteFilter]);

  // Monthly Room & Welfare check obligations for high-level KPI cards
  const todayIso = londonNow(now).date;
  const currentMonth = todayIso.slice(0, 7);
  const currentMonthLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${currentMonth}-01T00:00:00Z`));
    } catch {
      return currentMonth;
    }
  }, [currentMonth]);

  const roomObligations = useCheckObligations('room', currentMonth, now, can.roomChecks);
  const welfareObligations = useCheckObligations('welfare', currentMonth, now, can.welfareChecks);

  // Check rows are limited to the sites this user may see and the site picked in the header (by site id, exact).
  const inSite = (siteId: string) =>
    (scope.allowedSiteIds === 'all' || scope.allowedSiteIds.has(siteId)) && (scope.siteId === 'all' || scope.siteId === siteId);
  const scopedRoomRows = useMemo(() => (roomObligations.rows || []).filter(r => !!r.siteId && inSite(r.siteId)), [roomObligations.rows, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const scopedWelfareRows = useMemo(() => (welfareObligations.rows || []).filter(r => !!r.siteId && inSite(r.siteId)), [welfareObligations.rows, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const roomMonitor = useMemo(() => (roomObligations.result ? monitorChecks(scopedRoomRows) : null), [roomObligations.result, scopedRoomRows]);
  const welfareMonitor = useMemo(() => (welfareObligations.result ? monitorChecks(scopedWelfareRows) : null), [welfareObligations.result, scopedWelfareRows]);
  const overdueChecks = useMemo(() => listOverdueChecks(can.roomChecks ? scopedRoomRows : [], can.welfareChecks ? scopedWelfareRows : []), [scopedRoomRows, scopedWelfareRows, can.roomChecks, can.welfareChecks]);

  const input: OpsInput = useMemo(() => ({
    sites: siteRefs,
    maintenance: can.maintenance ? maintenanceRecords : [],
    compliance: can.compliance ? complianceRecords : [],
    escalations: can.escalations ? escalations : [],
    properties: can.property ? master.properties : [],
    rooms: can.property ? master.rooms : [],
    placements: master.placements,
    roomIssues: can.property ? master.roomIssues : [],
    peepPlans: can.peep ? master.peepPlans : [],
    followUps: can.followUps ? master.followUps : [],
  }), [siteRefs, can.maintenance, can.compliance, can.escalations, can.property, can.peep, can.followUps,
    maintenanceRecords, complianceRecords, escalations, master.properties, master.rooms, master.placements,
    master.roomIssues, master.peepPlans, master.followUps]);

  const snapshot = useMemo(() => buildSnapshot(input, scope, now), [input, scope, now]);
  const deadlines = useMemo(() => selectDeadlines(input, scope, windowDays, now), [input, scope, windowDays, now]);
  const { kpis } = snapshot;
  const today = londonNow(now).date;
  const overview = useMemo(() => selectOverview(input, scope, periodRange(period, today), now), [input, scope, period, today, now]);

  // Loading and failures
  const contextLoading = liveDataStatus.state === 'idle' || liveDataStatus.state === 'loading';
  const loading = contextLoading || master.loading;
  const down = (label: string) => liveDataStatus.unavailable.includes(label);
  const masterDown = (...labels: string[]) => labels.some(l => master.failed.includes(l));
  const unavailable = {
    maintenance: down('Maintenance Tracker'),
    compliance: down('SD-Compliance'),
    escalations: down('Escalations'),
    occupancy: masterDown('Properties', 'Rooms', 'Placements'),
    actions: masterDown('Properties', 'Rooms', 'Placements', 'Room issues', 'PEEP plans', 'Absence follow-ups'),
  };
  const failures = [
    ...liveDataStatus.unavailable.filter(l => ['Maintenance Tracker', 'SD-Compliance', 'Escalations', 'Properties'].includes(l)),
    ...master.failed,
  ];

  const val = (ok: boolean, v: number) => (loading || !ok ? DASH : n(v));

  // ---- Business overview, departments, checks, maintenance, residents (all built from the shared pure selectors)
  const periodR = useMemo(() => periodRange(period, today), [period, today]);
  const periodLabel = PERIOD_LABELS[period].toLowerCase();
  const flowInput = useMemo(() => ({
    sites: siteRefs,
    newArrivals: can.dailyRegisters ? newArrivalsRecords : [],
    dispersals: can.dispersal ? dispersalRecords : [],
    evictions: can.dailyRegisters || can.dispersal ? evictionRecords : [],
  }), [siteRefs, can.dailyRegisters, can.dispersal, newArrivalsRecords, dispersalRecords, evictionRecords]);
  const flow = useMemo(() => selectFlowCounts(flowInput, scope, today), [flowInput, scope, today]);
  const deptRows = useMemo(() => selectDepartmentRows({
    ...flowInput,
    maintenance: can.maintenance ? maintenanceRecords : [],
    laundry: can.laundry ? laundryRecords : [],
    escalations: can.escalations ? escalations : [],
    roomRows: can.roomChecks ? scopedRoomRows : [],
    welfareRows: can.welfareChecks ? scopedWelfareRows : [],
    visible: {
      newArrivals: can.dailyRegisters, dispersals: can.dispersal, evictions: can.dispersal || can.dailyRegisters,
      roomChecks: can.roomChecks, welfareChecks: can.welfareChecks, maintenance: can.maintenance, laundry: can.laundry, escalations: can.escalations
    } as Record<DeptKey, boolean>
  }, scope, periodR, now), [flowInput, can.maintenance, can.laundry, can.escalations, can.roomChecks, can.welfareChecks, can.dailyRegisters, can.dispersal, maintenanceRecords, laundryRecords, escalations, scopedRoomRows, scopedWelfareRows, scope, periodR, now]);
  const maint = useMemo(() => selectMaintenanceOverview(can.maintenance ? maintenanceRecords : [], siteRefs, scope, periodR, now), [can.maintenance, maintenanceRecords, siteRefs, scope, periodR, now]);
  const profile = useMemo(() => (can.suUsers || can.property
    ? selectResidentProfile({ sites: siteRefs, serviceUsers: master.serviceUsers, placements: master.placements, registerRooms: can.dailyRegisters ? dailyRegisterRooms : [] }, scope)
    : null), [can.suUsers, can.property, can.dailyRegisters, siteRefs, master.serviceUsers, master.placements, dailyRegisterRooms, scope]);
  const guestCtx = useGuestContext();
  const demographics = useMemo(() => {
    if (!can.dailyRegisters || guestCtx.error) return null;
    const rows = (dailyRegisterRecords || []).filter(r => {
      const sid = resolveSite(r.hotel);
      return !!sid && (scope.allowedSiteIds === 'all' || scope.allowedSiteIds.has(sid)) && (scope.siteId === 'all' || scope.siteId === sid);
    });
    const st = computeGuestStats(buildGuests(rows, guestCtx.ctx, today));
    return { male: st.male, female: st.female, other: st.otherOrUnspecified, child: st.child, adult: st.adult, elderly: st.elderly, aspen: st.aspenHolders, families: st.familiesBySize as Record<string, number> };
  }, [can.dailyRegisters, guestCtx.error, guestCtx.ctx, dailyRegisterRecords, resolveSite, scope, today]);
  const siteFlow = useMemo(() => selectSiteFlowRows(flowInput, can.roomChecks ? scopedRoomRows : [], can.welfareChecks ? scopedWelfareRows : [], scope, today), [flowInput, can.roomChecks, can.welfareChecks, scopedRoomRows, scopedWelfareRows, scope, today]);

  const checksReady = !loading && !(can.roomChecks && roomObligations.loading && !roomObligations.result) && !(can.welfareChecks && welfareObligations.loading && !welfareObligations.result);
  const checksFailed = (state: { error: string | null; result: unknown }) => !!state.error && !state.result;

  // Overdue items: only modules with a defined deadline are added up; the title lists exactly which.
  const dispersalOverdue = deptRows.find(r => r.key === 'dispersals')?.overdue ?? 0;
  const evictionOverdue = deptRows.find(r => r.key === 'evictions')?.overdue ?? 0;
  const overdueChecksCount = overdueChecks.length;
  const overdueTotal = (can.maintenance ? kpis.overdueMaintenance : 0) + (can.compliance ? kpis.complianceExpired : 0) + kpis.overdueActions.total
    + overdueChecksCount + dispersalOverdue + evictionOverdue;
  const overdueParts = [
    can.maintenance && `maintenance ${kpis.overdueMaintenance}`, can.compliance && `expired compliance ${kpis.complianceExpired}`,
    (can.peep || can.followUps || can.property) && `reviews/inspections/issues ${kpis.overdueActions.total}`,
    (can.roomChecks || can.welfareChecks) && `checks ${overdueChecksCount}`, can.dispersal && `dispersals ${dispersalOverdue}`, can.dispersal && `evictions ${evictionOverdue}`
  ].filter(Boolean).join(', ');

  const businessKpis: Kpi[] = [];
  const delta = (cur: number, prev: number) => (cur === prev ? 'same as yesterday' : `${cur > prev ? '+' : '-'}${Math.abs(cur - prev)} vs yesterday (${prev})`);
  if (can.suUsers || can.property) {
    businessKpis.push({
      id: 'b-residents', label: 'Active service users', value: val(!unavailable.occupancy, kpis.activeResidents), context: 'active placements',
      onClick: canAccessPage('suUsers') ? () => navigateWithIntent('suUsers') : undefined
    });
  }
  if (can.property) {
    businessKpis.push(
      { id: 'b-occupied', label: 'Occupied rooms', value: val(!unavailable.occupancy, kpis.occupancy.roomsOccupied), context: kpis.occupancy.beds > 0 ? `${kpis.occupancy.residents} / ${kpis.occupancy.beds} beds` : 'no rooms set up', onClick: () => navigateWithIntent('propertyManagement') },
      { id: 'b-available', label: 'Available rooms', value: val(!unavailable.occupancy, kpis.occupancy.roomsAvailable), context: `${n(kpis.occupancy.freeBeds)} free beds`, onClick: () => navigateWithIntent('propertyManagement') },
      { id: 'b-properties', label: 'Properties', value: val(!unavailable.occupancy, kpis.properties), context: 'active buildings', onClick: () => navigateWithIntent('propertyManagement') }
    );
  }
  if (can.dailyRegisters) {
    businessKpis.push({
      id: 'b-arrivals', label: 'New arrivals today', value: loading ? DASH : n(flow.newArrivals.today), context: loading ? undefined : delta(flow.newArrivals.today, flow.newArrivals.yesterday),
      onClick: () => navigateWithIntent('dailyRegisters'), title: 'Check-in date is today. Opens Live Daily Registers.'
    });
  }
  if (can.dispersal) {
    businessKpis.push({
      id: 'b-dispersals', label: 'Dispersals today', value: loading ? DASH : n(flow.dispersals.today), context: loading ? undefined : delta(flow.dispersals.today, flow.dispersals.yesterday),
      onClick: () => navigateWithIntent('dispersal'), title: 'Dispersal date is today (MM/DD/YYYY on the sheet). Opens the Dispersal Sheet.'
    });
  }
  if (can.maintenance) {
    businessKpis.push({
      id: 'b-maint', label: 'Open maintenance', value: val(!unavailable.maintenance, kpis.openMaintenance),
      context: unavailable.maintenance ? 'could not load' : `${n(maint.overview.newToday)} new today`, onClick: () => navigateWithIntent('maintenance', { filters: { open: '1' } })
    });
  }
  businessKpis.push({
    id: 'b-overdue', label: 'Overdue items', value: loading ? DASH : n(overdueTotal), context: 'across modules with deadlines', tone: !loading && overdueTotal > 0 ? 'red' : 'none',
    title: `Sum of: ${overdueParts || 'nothing you can view'}. Jumps to the department table.`,
    onClick: () => { document.getElementById('ops-departments')?.scrollIntoView({ block: 'start' }); }
  });
  const openTarget = (page: string, filters?: Record<string, string>, recordId?: string) => navigateWithIntent(page, { filters, recordId });

  // Overview matrix: which rows the user may see, whether each loaded, and where a cell opens.
  type Target = { page: DashboardPage; filters?: Record<string, string> };
  const overviewConfig: Record<OverviewRow['key'], { visible: boolean; down: boolean; page: DashboardPage; cells: { outstanding?: Target; overdue?: Target; dueSoon?: Target } }> = {
    maintenance: {
      visible: can.maintenance, down: unavailable.maintenance, page: 'maintenance',
      cells: { outstanding: { page: 'maintenance', filters: { open: '1' } }, overdue: { page: 'maintenance', filters: { sla: 'overdue' } } }
    },
    compliance: {
      visible: can.compliance, down: unavailable.compliance, page: 'compliance',
      cells: {
        outstanding: { page: 'compliance', filters: { expiry: 'expired,due-30,due-90' } },
        overdue: { page: 'compliance', filters: { expiry: 'expired' } },
        dueSoon: { page: 'compliance', filters: { expiry: 'due-30' } }
      }
    },
    peep: { visible: can.peep, down: masterDown('Placements', 'PEEP plans'), page: 'peepTracker', cells: {} },
    followUps: { visible: can.followUps, down: masterDown('Placements', 'Absence follow-ups'), page: 'suAttendance', cells: {} },
    inspections: { visible: can.property, down: masterDown('Properties', 'Rooms'), page: 'propertyManagement', cells: {} },
    roomIssues: { visible: can.property, down: masterDown('Properties', 'Room issues'), page: 'propertyManagement', cells: {} },
    escalations: { visible: can.escalations, down: unavailable.escalations, page: 'escalations', cells: { outstanding: { page: 'escalations', filters: { open: '1' } } } }
  };
  const overviewRows = overview.filter(r => overviewConfig[r.key].visible);

  // KPI strip: hidden when the user cannot view the source; unavailable when it failed to load.
  const kpiList: Kpi[] = [];
  const sitesInScope = kpis.activeSites;
  if (sitesInScope !== 1) {
    kpiList.push({ id: 'sites', label: 'Sites', value: loading ? DASH : n(sitesInScope), context: 'in your scope', onClick: canAccessPage('properties') ? () => navigateWithIntent('properties') : undefined });
  }
  if (can.property) {
    const o = kpis.occupancy;
    kpiList.push({
      id: 'occupancy', label: 'Occupancy',
      value: loading || unavailable.occupancy ? DASH : (o.beds > 0 ? `${n(o.residents)} / ${n(o.beds)}` : DASH),
      context: loading || unavailable.occupancy ? undefined : (o.pct !== null ? `${o.pct}% · ${n(o.freeBeds)} free beds` : 'no rooms set up'),
      onClick: () => navigateWithIntent('propertyManagement'),
    });
    kpiList.push({
      id: 'residents', label: 'Active residents', value: val(!unavailable.occupancy, kpis.activeResidents), context: 'active placements',
      onClick: canAccessPage('suUsers') ? () => navigateWithIntent('suUsers') : undefined,
    });
  }
  if (can.maintenance) {
    kpiList.push({
      id: 'open-maint', label: 'Open maintenance', value: val(!unavailable.maintenance, kpis.openMaintenance),
      context: unavailable.maintenance ? 'could not load' : `${n(kpis.openCat1)} CAT 1`, tone: kpis.openCat1 > 0 && !unavailable.maintenance ? 'amber' : 'none',
      onClick: () => navigateWithIntent('maintenance', { filters: { open: '1' } }),
    });
    kpiList.push({
      id: 'overdue-maint', label: 'Overdue maintenance', value: val(!unavailable.maintenance, kpis.overdueMaintenance),
      context: unavailable.maintenance ? 'could not load' : `${n(kpis.maintenanceDueIn24h)} due in 24 h`, tone: kpis.overdueMaintenance > 0 && !unavailable.maintenance ? 'red' : 'none',
      onClick: () => navigateWithIntent('maintenance', { filters: { sla: 'overdue' } }),
    });
  }
  if (can.compliance) {
    kpiList.push({
      id: 'compliance', label: 'Compliance',
      value: loading || unavailable.compliance ? DASH : `${n(kpis.complianceExpired)} · ${n(kpis.complianceDue30)}`,
      context: unavailable.compliance ? 'could not load' : 'expired · due ≤30 d', tone: kpis.complianceExpired > 0 && !unavailable.compliance ? 'red' : 'none',
      onClick: () => navigateWithIntent('compliance', { filters: { expiry: 'expired,due-30' } }),
      title: 'By expiry date, not the typed status',
    });
  }
  const actionParts = [can.peep && 'PEEP', can.followUps && 'follow-ups', can.property && 'inspections, issues'].filter(Boolean) as string[];
  if (actionParts.length > 0) {
    kpiList.push({
      id: 'actions', label: 'Overdue reviews', value: val(!unavailable.actions, kpis.overdueActions.total),
      context: unavailable.actions ? 'could not load' : actionParts.join(', '), tone: kpis.overdueActions.total > 0 && !unavailable.actions ? 'red' : 'none',
      onClick: () => { setAttentionGroup('actions'); setShowAllAttention(true); },
      title: 'PEEP reviews, absence follow-ups, room inspections and room issues past their date. Shows them in the table below.',
    });
  }
  if (can.escalations) {
    kpiList.push({
      id: 'escalations', label: 'Open escalations', value: val(!unavailable.escalations, kpis.openEscalations),
      context: unavailable.escalations ? 'could not load' : `${n(kpis.criticalEscalations)} critical`, tone: kpis.criticalEscalations > 0 && !unavailable.escalations ? 'red' : 'none',
      onClick: () => navigateWithIntent('escalations', { filters: { open: '1' } }),
    });
  }

  // Attention table
  const q = search.trim().toLowerCase();
  const attention = useMemo(() => snapshot.attention.filter(a =>
    (attentionGroup === 'all' || ACTION_REASONS.has(a.reason)) &&
    (!q || [a.reason, a.label, a.siteName, a.location, a.owner].join(' ').toLowerCase().includes(q))
  ), [snapshot.attention, attentionGroup, q]);
  const attentionShown = showAllAttention ? attention : attention.slice(0, ATTENTION_PREVIEW);

  const deadlineRows = useMemo(() => deadlines.filter(d => !q || [d.type, d.label, d.siteName].join(' ').toLowerCase().includes(q)), [deadlines, q]);
  const deadlinesShown = showAllDeadlines ? deadlineRows : deadlineRows.slice(0, DEADLINE_PREVIEW);

  // Recent activity: the same audit trail the Audit page shows, so only the people who may open that page see it.
  // Reference only (who, what, where) - the free-text details can hold resident information and are left out.
  const canSeeActivity = (currentUserRole === 'Super Admin' || currentUserRole === 'Admin') && canAccessPage('audit');
  const activity = useMemo(() => {
    if (!canSeeActivity) return [];
    return (auditLogs || [])
      .filter(l => scope.siteId === 'all' || resolveSite(l.site) === scope.siteId)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      .slice(0, 10);
  }, [canSeeActivity, auditLogs, scope.siteId, resolveSite]);
  const activityTime = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? DASH : new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  };

  const open = (page: DashboardPage, recordId: string, openId?: string) => navigateWithIntent(page, { recordId: openId || recordId });

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([refreshLiveData(), master.reload()]); } finally { setRefreshing(false); setNow(new Date()); }
  };

  const dateLabel = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(now);
  const lastSyncMs = Math.max(0, ...[liveDataStatus.lastSyncAt, master.loadedAt, live.lastReconciledAt].map(v => (v ? new Date(v).getTime() : 0)));
  const updatedLabel = lastSyncMs
    ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(lastSyncMs))
    : DASH;
  const linkLabel = live.link === 'live' ? 'Live' : live.link === 'connecting' ? 'Connecting' : live.link === 'reconnecting' ? 'Reconnecting - refreshing every minute' : 'Offline - refreshing every minute';

  const siteOptions = (allowedSites || []).filter(Boolean);
  const multiSite = canAccessAllSites() || siteOptions.length > 1;

  const qualityNotes = [
    ...Object.entries(snapshot.dataQuality.unresolvedSite).map(([k, c]) => `${c} ${k} record${c > 1 ? 's' : ''} not matched to a site`),
    ...Object.entries(snapshot.dataQuality.unreadableDate).map(([k, c]) => `${c} ${k} record${c > 1 ? 's' : ''} with a missing or unreadable date`),
  ];

  const dueLabel = (d: DeadlineItem) => `${d.due.slice(0, 10)}${d.due.endsWith('23:59') ? '' : ` ${d.due.slice(11)}`}`;

  return (
    <div className="space-y-2" id="operations-dashboard">
      {/* Header: one row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#e1dfdd]">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-base font-semibold text-[#242424] whitespace-nowrap">Operations Dashboard</h1>
          <span className="text-xs text-[#605e5c] whitespace-nowrap">{dateLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {multiSite && (
            <select aria-label="Site" value={siteFilter} onChange={e => setSiteFilter(e.target.value)} className="px-2 py-1 bg-white border border-[#8a8886] rounded-xs">
              <option value="all">All sites</option>
              {siteOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              aria-label="Search the lists below"
              placeholder="Search lists…"
              value={search}
              onChange={e => { setSearch(e.target.value); setShowAllAttention(false); setShowAllDeadlines(false); }}
              className="pl-7 pr-2 py-1 w-44 bg-white border border-[#8a8886] rounded-xs"
            />
          </div>
          <label className="flex items-center gap-1 text-[#605e5c]">
            <span>Period</span>
            <select aria-label="Reporting period" value={period} onChange={e => setPeriod(e.target.value as PeriodKind)} className="px-2 py-1 bg-white border border-[#8a8886] rounded-xs text-[#242424]">
              {(Object.keys(PERIOD_LABELS) as PeriodKind[]).map(k => <option key={k} value={k}>{PERIOD_LABELS[k]}</option>)}
            </select>
          </label>
          <span className="text-[#605e5c] whitespace-nowrap" title="Time the numbers were last read from the database">Last synchronised {updatedLabel}</span>
          <span role="status" className={`whitespace-nowrap font-semibold ${live.link === 'live' ? 'text-emerald-800' : live.link === 'connecting' ? 'text-[#605e5c]' : 'text-[#7f6000]'}`} title="Changes made by other users appear here automatically">{linkLabel}</span>
          <button type="button" onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-1 px-2 py-1 font-semibold bg-white border border-[#8a8886] rounded-xs hover:bg-[#edebe9] disabled:opacity-60">
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {failures.length > 0 && !loading && (
        <div role="alert" className="px-3 py-1.5 text-xs bg-red-50 border border-red-200 rounded-xs text-red-800">
          Could not load: {Array.from(new Set(failures)).join(', ')}. Numbers that depend on these are shown as {DASH}.
        </div>
      )}

      {/* Business overview */}
      {businessKpis.length > 0 || kpiList.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2" aria-label="Business overview">
            {businessKpis.map(k => <KpiCell key={k.id} kpi={k} />)}
          </div>
          {kpiList.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2" aria-label="Exceptions">
              {kpiList.map(k => <KpiCell key={k.id} kpi={k} />)}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-[#605e5c] py-2">You do not have access to any page this dashboard summarises.</p>
      )}

      {/* Attention Required + Upcoming Deadlines */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2">
        <section className="xl:col-span-8 bg-white border border-[#e1dfdd] rounded-xs min-w-0" aria-labelledby="ops-attention-h">
          <header className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#e1dfdd]">
            <h2 id="ops-attention-h" className="text-xs font-semibold text-[#242424]">
              Attention required{!loading && ` (${n(attention.length)})`}
              {attentionGroup === 'actions' && <span className="ml-2 font-normal text-[#605e5c]">overdue reviews only</span>}
            </h2>
            {attentionGroup === 'actions' && (
              <button type="button" onClick={() => setAttentionGroup('all')} className="text-xs font-semibold text-[#0d9488] hover:underline">Show all</button>
            )}
          </header>
          {loading ? (
            <p className="px-2.5 py-3 text-xs text-[#605e5c]" aria-busy="true">Loading…</p>
          ) : attention.length === 0 ? (
            <p className="px-2.5 py-3 text-xs text-[#605e5c]">
              {failures.length > 0
                ? 'Nothing found in the sources that loaded.'
                : q ? 'No item matches the search.' : 'Nothing needs attention at the selected site(s).'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#edebe9]">
                    <th className={TH}>Reason</th><th className={TH}>Item</th><th className={TH}>Site / location</th><th className={TH}>Due</th><th className={TH}>Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f2f1]">
                  {attentionShown.map(a => (
                    <tr key={a.key} onClick={() => open(a.page, a.recordId, a.openId)} className="cursor-pointer hover:bg-[#f3f2f1]">
                      <td className={TD}><Tag tone={reasonTone(a)}>{a.reason}</Tag></td>
                      <td className={`${TD} max-w-[320px]`}>
                        <button type="button" className="text-left text-[#242424] hover:underline focus:underline focus:outline-none truncate max-w-full" title={a.label}>{a.label}</button>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>
                        <span className="font-medium text-[#323130]">{a.siteName}</span>
                        {a.location && <span className="text-[#605e5c]"> · {a.location}</span>}
                      </td>
                      <td className={`${TD} whitespace-nowrap tabular-nums text-[#323130]`}>{a.dueText}</td>
                      <td className={`${TD} text-[#605e5c]`}>{a.owner || DASH}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {attention.length > ATTENTION_PREVIEW && (
                <button type="button" onClick={() => setShowAllAttention(v => !v)} className="w-full px-2.5 py-1.5 text-xs font-semibold text-[#0d9488] hover:bg-[#f3f2f1] text-left border-t border-[#edebe9]">
                  {showAllAttention ? 'Show fewer' : `Show all ${n(attention.length)}`}
                </button>
              )}
            </div>
          )}
        </section>

        <section className="xl:col-span-4 bg-white border border-[#e1dfdd] rounded-xs min-w-0" aria-labelledby="ops-deadlines-h">
          <header className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#e1dfdd]">
            <h2 id="ops-deadlines-h" className="text-xs font-semibold text-[#242424]">Upcoming deadlines{!loading && ` (${n(deadlineRows.length)})`}</h2>
            <select aria-label="Deadline window" value={windowDays} onChange={e => { setWindowDays(Number(e.target.value)); setShowAllDeadlines(false); }} className="px-1.5 py-0.5 text-xs bg-white border border-[#8a8886] rounded-xs">
              {WINDOWS.map(w => <option key={w} value={w}>Next {w} days</option>)}
            </select>
          </header>
          {loading ? (
            <p className="px-2.5 py-3 text-xs text-[#605e5c]" aria-busy="true">Loading…</p>
          ) : deadlineRows.length === 0 ? (
            <p className="px-2.5 py-3 text-xs text-[#605e5c]">
              {q ? 'No deadline matches the search.' : `Nothing due in the next ${windowDays} days.`}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#edebe9]"><th className={TH}>Due</th><th className={TH}>Item</th></tr>
                </thead>
                <tbody className="divide-y divide-[#f3f2f1]">
                  {deadlinesShown.map(d => (
                    <tr key={d.key} onClick={() => open(d.page, d.recordId, d.openId)} className="cursor-pointer hover:bg-[#f3f2f1]">
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>
                        <span className="block font-medium text-[#323130]">{dueLabel(d)}</span>
                        <span className="block text-[#605e5c]">{relativeDay(d.due.slice(0, 10), today)}</span>
                      </td>
                      <td className={`${TD} min-w-0`}>
                        <button type="button" className="block text-left text-[#242424] hover:underline focus:underline focus:outline-none truncate max-w-[240px]" title={d.label}>{d.label}</button>
                        <span className="block text-[#605e5c] truncate">{d.type} · {d.siteName}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deadlineRows.length > DEADLINE_PREVIEW && (
                <button type="button" onClick={() => setShowAllDeadlines(v => !v)} className="w-full px-2.5 py-1.5 text-xs font-semibold text-[#0d9488] hover:bg-[#f3f2f1] text-left border-t border-[#edebe9]">
                  {showAllDeadlines ? 'Show fewer' : `Show all ${n(deadlineRows.length)}`}
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <DepartmentTable
        rows={deptRows}
        ready={!loading}
        unavailable={{ maintenance: unavailable.maintenance, escalations: unavailable.escalations, roomChecks: checksFailed(roomObligations), welfareChecks: checksFailed(welfareObligations) }}
        periodLabel={periodLabel}
        onOpen={openTarget}
      />

      <ChecksMonitor
        month={currentMonthLabel}
        room={{ monitor: roomMonitor, visible: can.roomChecks, error: checksFailed(roomObligations) }}
        welfare={{ monitor: welfareMonitor, visible: can.welfareChecks, error: checksFailed(welfareObligations) }}
        overdue={overdueChecks}
        ready={checksReady}
        onOpen={openTarget}
      />

      {can.maintenance && (
        <MaintenanceOverviewSection overview={maint.overview} rows={maint.rows} ready={!loading} unavailable={unavailable.maintenance} periodLabel={periodLabel} onOpen={openTarget} />
      )}

      {(can.suUsers || can.property) && (
        <ResidentPropertySection
          profile={profile} ready={!loading} unavailable={unavailable.occupancy || masterDown('Service users')}
          occupancy={can.property ? { residents: kpis.occupancy.residents, beds: kpis.occupancy.beds, pct: kpis.occupancy.pct, roomsOccupied: kpis.occupancy.roomsOccupied, roomsAvailable: kpis.occupancy.roomsAvailable } : null}
          demographics={demographics} onOpen={openTarget}
        />
      )}

      {/* Operational overview + site comparison (below the fold) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2">
        {overviewRows.length > 0 && (
          <section className="xl:col-span-5 bg-white border border-[#e1dfdd] rounded-xs min-w-0" aria-labelledby="ops-overview-h">
            <header className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#e1dfdd]">
              <h2 id="ops-overview-h" className="text-xs font-semibold text-[#242424]">Operational overview</h2>
              <span className="text-xs text-[#605e5c]">Completed: {periodLabel}</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#edebe9]">
                    <th className={TH}>Area</th>
                    <th className={`${TH} text-right`}>Outstanding</th>
                    <th className={`${TH} text-right`}>Overdue</th>
                    <th className={`${TH} text-right`}>Due soon</th>
                    <th className={`${TH} text-right`}>Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f2f1]">
                  {overviewRows.map(r => {
                    const cfg = overviewConfig[r.key];
                    const cellFor = (field: 'outstanding' | 'overdue' | 'dueSoon' | 'completedInPeriod') => {
                      const v = r[field];
                      const text = loading || cfg.down || v === null ? DASH : n(v);
                      const target = field === 'completedInPeriod' ? undefined : cfg.cells[field];
                      const alarm = field === 'overdue' && v !== null && v > 0 && !cfg.down;
                      const base = `${TD} text-right tabular-nums ${alarm ? 'text-[#a4262c] font-bold' : 'text-[#242424]'}`;
                      return target && text !== DASH && v! > 0
                        ? <td className={base}><button type="button" className="hover:underline focus:underline focus:outline-none" onClick={() => navigateWithIntent(target.page, { filters: target.filters })}>{text}</button></td>
                        : <td className={base}>{text}</td>;
                    };
                    return (
                      <tr key={r.key}>
                        <td className={TD}>
                          <button type="button" className="text-left text-[#242424] hover:underline focus:underline focus:outline-none" onClick={() => navigateWithIntent(cfg.page)}>{r.label}</button>
                        </td>
                        {cellFor('outstanding')}{cellFor('overdue')}{cellFor('dueSoon')}{cellFor('completedInPeriod')}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-2.5 py-1.5 text-[11px] text-[#605e5c] border-t border-[#edebe9]">
              Outstanding, overdue and due soon are as of now. The period changes only Completed. {DASH} means the figure is not recorded for that area.
            </p>
          </section>
        )}

        {snapshot.sites.length > 1 && (
          <section className="xl:col-span-7 bg-white border border-[#e1dfdd] rounded-xs min-w-0" aria-labelledby="ops-sites-h">
            <header className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#e1dfdd]">
              <h2 id="ops-sites-h" className="text-xs font-semibold text-[#242424]">Site-wise performance</h2>
              <span className="text-[11px] text-[#605e5c]">Ranked by overdue maintenance + CAT 1 + expired compliance + overdue reviews</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#edebe9]">
                    <th className={TH}>Site</th>
                    {can.property && <th className={`${TH} text-right`}>Occupancy</th>}
                    {can.dailyRegisters && <th className={`${TH} text-right`}>Arrivals today</th>}
                    {can.dispersal && <th className={`${TH} text-right`}>Dispersals today · overdue</th>}
                    {(can.roomChecks || can.welfareChecks) && <th className={`${TH} text-right`}>Overdue checks</th>}
                    {can.maintenance && <><th className={`${TH} text-right`}>Open maint.</th><th className={`${TH} text-right`}>Overdue</th><th className={`${TH} text-right`}>CAT 1</th></>}
                    {can.compliance && <th className={`${TH} text-right`}>Compliance exp. · ≤30 d</th>}
                    {actionParts.length > 0 && <th className={`${TH} text-right`}>Overdue reviews</th>}
                    {can.escalations && <th className={`${TH} text-right`}>Escalations</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f2f1]">
                  {snapshot.sites.map(s => {
                    const num = (ok: boolean, v: number, alarm = false) => (
                      <td className={`${TD} text-right tabular-nums ${alarm && v > 0 && ok && !loading ? 'text-[#a4262c] font-bold' : 'text-[#242424]'}`}>{loading || !ok ? DASH : n(v)}</td>
                    );
                    return (
                      <tr key={s.siteId}>
                        <td className={TD}>
                          {multiSite && scope.siteId === 'all' ? (
                            <button type="button" className="text-left font-medium text-[#242424] hover:underline focus:underline focus:outline-none" title="Show only this site" onClick={() => setSiteFilter(s.siteName)}>{s.siteName}</button>
                          ) : <span className="font-medium">{s.siteName}</span>}
                        </td>
                        {can.property && (
                          <td className={`${TD} text-right tabular-nums text-[#242424] whitespace-nowrap`}>
                            {loading || unavailable.occupancy ? DASH : s.beds > 0 ? `${n(s.residents)} / ${n(s.beds)}${s.occupancyPct !== null ? ` · ${s.occupancyPct}%` : ''}` : DASH}
                          </td>
                        )}
                        {can.dailyRegisters && num(true, siteFlow.get(s.siteId)?.newArrivalsToday ?? 0)}
                        {can.dispersal && (
                          <td className={`${TD} text-right tabular-nums whitespace-nowrap ${(siteFlow.get(s.siteId)?.dispersalsOverdue ?? 0) > 0 && !loading ? 'text-[#a4262c] font-bold' : 'text-[#242424]'}`}>
                            {loading ? DASH : `${n(siteFlow.get(s.siteId)?.dispersalsToday ?? 0)} · ${n(siteFlow.get(s.siteId)?.dispersalsOverdue ?? 0)}`}
                          </td>
                        )}
                        {(can.roomChecks || can.welfareChecks) && num(checksReady, siteFlow.get(s.siteId)?.overdueChecks ?? 0, true)}
                        {can.maintenance && <>{num(!unavailable.maintenance, s.openMaintenance)}{num(!unavailable.maintenance, s.overdueMaintenance, true)}{num(!unavailable.maintenance, s.openCat1, true)}</>}
                        {can.compliance && (
                          <td className={`${TD} text-right tabular-nums whitespace-nowrap ${s.complianceExpired > 0 && !unavailable.compliance && !loading ? 'text-[#a4262c] font-bold' : 'text-[#242424]'}`}>
                            {loading || unavailable.compliance ? DASH : `${n(s.complianceExpired)} · ${n(s.complianceDue30)}`}
                          </td>
                        )}
                        {actionParts.length > 0 && num(!unavailable.actions, s.overdueActions, true)}
                        {can.escalations && num(!unavailable.escalations, s.openEscalations)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {canSeeActivity && (
        <section className="bg-white border border-[#e1dfdd] rounded-xs min-w-0" aria-labelledby="ops-activity-h">
          <header className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#e1dfdd]">
            <h2 id="ops-activity-h" className="text-xs font-semibold text-[#242424]">Recent activity</h2>
            <span className="text-[11px] text-[#605e5c]">Latest audit entries; module is as recorded in the audit trail</span>
          </header>
          {loading ? (
            <p className="px-2.5 py-3 text-xs text-[#605e5c]" aria-busy="true">Loading…</p>
          ) : activity.length === 0 ? (
            <p className="px-2.5 py-3 text-xs text-[#605e5c]">No recent activity at the selected site(s).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#edebe9]">
                    <th className={TH}>When</th><th className={TH}>User</th><th className={TH}>Action</th><th className={TH}>Module</th><th className={TH}>Item</th><th className={TH}>Site</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f2f1]">
                  {activity.map(l => (
                    <tr key={l.id}>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>{activityTime(l.timestamp)}</td>
                      <td className={`${TD} whitespace-nowrap`}>{l.performedByUser || DASH}</td>
                      <td className={`${TD} whitespace-nowrap`}>{l.action}</td>
                      <td className={`${TD} whitespace-nowrap`}>{l.module}</td>
                      <td className={`${TD} max-w-[320px] truncate`} title={l.targetItem}>{l.targetItem || DASH}</td>
                      <td className={`${TD} whitespace-nowrap`}>{l.site || DASH}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Guest statistics & demographics (moved here from the main dashboard) */}
      {can.dailyRegisters && (
        <GuestAnalyticsWidget siteFilter={siteFilter} onNavigate={page => navigateWithIntent(page)} />
      )}

      {/* Priority safeguarding and public transport (moved here from the main dashboard) */}
      {can.vulnerable && (
        <PriorityVulnerableWidget siteFilter={siteFilter} onNavigate={page => navigateWithIntent(page)} />
      )}

      {can.publicTransport && (
        <section className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#edebe9] mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#242424]">Public Transport</h3>
              <p className="text-xs text-[#605e5c]">Journeys, issues and funding requests</p>
            </div>
            <button
              type="button"
              onClick={() => navigateWithIntent('publicTransport')}
              className="text-xs font-semibold text-[#8764b8] hover:text-[#6b4f98] bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-xs self-start sm:self-auto cursor-pointer"
            >
              Open Transport Tracker
            </button>
          </div>
          <TransportKPIDashboard selectedSiteFilter={siteFilter} onNavigate={page => navigateWithIntent(page)} />
        </section>
      )}

      {/* Data quality: records the numbers above had to leave out */}
      {!loading && qualityNotes.length > 0 && (
        <details className="text-xs text-[#605e5c]">
          <summary className="cursor-pointer select-none">Data notes ({qualityNotes.length}) - records left out of the numbers above</summary>
          <ul className="mt-1 ml-4 list-disc">{qualityNotes.map(t => <li key={t}>{t}</li>)}</ul>
        </details>
      )}
    </div>
  );
};
