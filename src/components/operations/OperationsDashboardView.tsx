import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconRefresh as RefreshCw } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { useOperationsData } from '../../hooks/useOperationsData';
import { useCheckObligations } from '../../hooks/useCheckObligations';
import { useOperationsLive } from '../../hooks/useOperationsLive';
import { GuestAnalyticsWidget } from '../dashboard/GuestAnalyticsWidget';
import { PriorityVulnerableWidget } from '../dashboard/PriorityVulnerableWidget';
import { TransportKPIDashboard } from '../transport/TransportKPIDashboard';
import { selectKpis, type OpsInput, type OpsScope } from '../../utils/operationsSelectors';
import { selectFlowCounts } from '../../utils/operationsDepartments';
import {
  selectUnifiedTasks, countTasks, moduleLanding, type TaskModule, type UnifiedTask
} from '../../utils/operationsTasks';
import { RECORD_TABS, selectRecordTab, type RecordTabSpec } from '../../utils/operationsRecords';
import { loadPrefs, savePrefs } from '../../utils/profileCache';
import { createSiteResolver, londonNow } from '../../utils/operationsRules';

/**
 * Operations Dashboard - each number defined once:
 *   1. Business overview  - eight KPIs
 *   2. Operations & deadlines - ONE table of every actionable task (utils/operationsTasks.ts); "Outstanding" and "Overdue"
 *      are counted from that same list, so they always equal its rows
 *   3. Facilities & site services - the newest few records of each site-service page
 * Pages that are logs rather than deadlines appear as tabs showing their newest records; only the open tab is computed.
 * Module detail stays in the module pages. Static by design: no animation, charts or transitions. A figure whose source
 * could not be loaded is a dash, never zero.
 */

const TH = 'px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] whitespace-nowrap';
const TD = 'px-2 py-1.5 align-top';
const DASH = '—';
const ALL_ROWS = 8; // rows on the All tab
const TAB_ROWS = 5; // rows on a module tab; the module page has the rest
const n = (v: number) => v.toLocaleString('en-GB');

const Tag: React.FC<{ tone: 'red' | 'amber' | 'green' | 'grey'; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-xs border whitespace-nowrap ${
    tone === 'red' ? 'bg-red-50 text-red-800 border-red-200'
      : tone === 'amber' ? 'bg-amber-50 text-amber-800 border-amber-200'
        : tone === 'green' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-neutral-100 text-neutral-700 border-neutral-200'
  }`}>{children}</span>
);

interface Kpi { id: string; label: string; value: string; context?: string; tone?: 'red' | 'none'; onClick?: () => void; title?: string }

const KpiCell: React.FC<{ kpi: Kpi }> = ({ kpi }) => {
  const body = (
    <>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] truncate">{kpi.label}</span>
      <span className={`block text-xl leading-tight font-semibold tabular-nums ${kpi.tone === 'red' ? 'text-[#a4262c]' : 'text-[#242424]'}`}>{kpi.value}</span>
      <span className="block text-[11px] text-[#605e5c] truncate">{kpi.context || ' '}</span>
    </>
  );
  const cls = 'text-left bg-white border border-[#e1dfdd] rounded-xs px-2.5 py-1.5 min-w-0';
  return kpi.onClick ? (
    <button type="button" id={`ops-kpi-${kpi.id}`} onClick={kpi.onClick} title={kpi.title} className={`${cls} hover:bg-[#f3f2f1] cursor-pointer focus:outline focus:outline-2 focus:outline-[#0d9488]`}>{body}</button>
  ) : (
    <div id={`ops-kpi-${kpi.id}`} title={kpi.title} className={cls}>{body}</div>
  );
};

const priorityTag = (t: UnifiedTask) => <Tag tone={t.priority === 'Critical' ? 'red' : t.priority === 'High' ? 'amber' : 'grey'}>{t.priority}</Tag>;
const remainingClass = (t: UnifiedTask) => (t.bucket === 'overdue' ? 'text-[#a4262c] font-bold' : t.bucket === 'today' || t.bucket === 'tomorrow' ? 'text-[#7f6000] font-semibold' : 'text-[#323130]');

const RecordPanel: React.FC<{
  spec: RecordTabSpec;
  result: { rows: Array<{ id: string; title: string; detail: string; siteName: string; date: string; status: string }>; total: number; unmatchedSite: number };
  ready: boolean;
  onOpen: (page: string, recordId?: string) => void;
}> = ({ spec, result, ready, onOpen }) => {
  if (!ready) return <p className="px-2.5 py-3 text-xs text-[#605e5c]" aria-busy="true">Loading…</p>;
  if (result.rows.length === 0) return <p className="px-2.5 py-3 text-xs text-[#605e5c]">No {spec.label.toLowerCase()} records at the selected site(s).</p>;
  const hasStatus = result.rows.some(r => r.status);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#edebe9]"><th className={TH}>Date</th><th className={TH}>Record</th><th className={TH}>Site</th>{hasStatus && <th className={TH}>Status</th>}</tr>
        </thead>
        <tbody className="divide-y divide-[#f3f2f1]">
          {result.rows.map(r => (
            <tr key={r.id} onClick={() => onOpen(spec.page, r.id)} className="cursor-pointer hover:bg-[#f3f2f1]" title="Open the record">
              <td className={`${TD} whitespace-nowrap tabular-nums`}>{r.date || DASH}</td>
              <td className={`${TD} max-w-[360px]`}><span className="block truncate text-[#242424]" title={r.title}>{r.title}</span>{r.detail && <span className="block truncate text-[#605e5c]">{r.detail}</span>}</td>
              <td className={`${TD} whitespace-nowrap font-medium text-[#323130]`}>{r.siteName}</td>
              {hasStatus && <td className={`${TD} whitespace-nowrap`}>{r.status ? <Tag tone="grey">{r.status}</Tag> : DASH}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-2.5 py-1.5 text-xs border-t border-[#edebe9]">
        <span className="text-[#605e5c]">Newest {result.rows.length} of {n(result.total)}</span>
        <button type="button" className="font-semibold text-[#0d9488] hover:underline" onClick={() => onOpen(spec.page)}>View all in {spec.label} →</button>
      </div>
    </div>
  );
};

const SELECT = 'px-1.5 py-1 text-xs bg-white border border-[#8a8886] rounded-xs max-w-[11rem]';

export const OperationsDashboardView: React.FC = () => {
  const {
    sites, maintenanceRecords, complianceRecords, escalations, authProfile,
    canAccessPage, canAccessAllSites, allowedSites, defaultSiteFilter,
    liveDataStatus, navigateWithIntent, refreshLiveData,
    newArrivalsRecords, dispersalRecords, evictionRecords, financeBills, transportFundingRequests,
    referrals, vulnerableSUs, challengingSUs, laundryRecords, foodRecords, propertyLaundryLogs, foodVendorBuffetLogs, spcdRecords,
    publicTransportRecords, gpAppointmentRecords, rfaWelfareRecords, mhComplaintWelfareRecords, bookletRecords, irRecords,
    foodWastageRecords, dailyRegisterRecords, welfareChecks, foodSurveys, roomChecks
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
    finance: canAccessPage('finance'),
    suUsers: canAccessPage('suUsers')
  };

  const master = useOperationsData({ property: can.property, peep: can.peep, followUps: can.followUps, residents: false });
  // One shared live link: another user's change re-reads the affected data here within seconds, with no page reload.
  const live = useOperationsLive(refreshLiveData);

  // Where this profile last was (tab, site, overdue-only) - preferences only, never data.
  const userId = authProfile?.id;
  const prefs = useRef(loadPrefs(userId));
  const [siteFilter, setSiteFilter] = useState<string>(() => {
    const p = prefs.current.site;
    return p && (p === 'all' || (allowedSites || []).includes(p)) ? p : defaultSiteFilter;
  });
  useEffect(() => { if (!prefs.current.site) setSiteFilter(defaultSiteFilter); }, [defaultSiteFilter]);
  const [tab, setTab] = useState<string>(prefs.current.tab);
  const [factTab, setFactTab] = useState<string>(prefs.current.factTab);
  const [overdueOnly, setOverdueOnly] = useState(prefs.current.overdueOnly);
  const [moreOpen, setMoreOpen] = useState(prefs.current.moreOpen);
  useEffect(() => { savePrefs(userId, { tab, factTab, site: siteFilter, overdueOnly, moreOpen }); }, [userId, tab, factTab, siteFilter, overdueOnly, moreOpen]);
  const [refreshing, setRefreshing] = useState(false);

  // The clock the deadlines are measured against. It only moves the clock (no data is fetched): tasks turn overdue on time.
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

  const today = londonNow(now).date;
  const currentMonth = today.slice(0, 7);
  const roomObligations = useCheckObligations('room', currentMonth, now, can.roomChecks);
  const welfareObligations = useCheckObligations('welfare', currentMonth, now, can.welfareChecks);

  const opsInput: OpsInput = useMemo(() => ({
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

  const flowInput = useMemo(() => ({
    sites: siteRefs,
    newArrivals: can.dailyRegisters ? newArrivalsRecords : [],
    dispersals: can.dispersal ? dispersalRecords : [],
    evictions: can.dispersal ? evictionRecords : [],
  }), [siteRefs, can.dailyRegisters, can.dispersal, newArrivalsRecords, dispersalRecords, evictionRecords]);

  const kpis = useMemo(() => selectKpis(opsInput, scope, now), [opsInput, scope, now]);
  const flow = useMemo(() => selectFlowCounts(flowInput, scope, today), [flowInput, scope, today]);

  const visible: Record<TaskModule, boolean> = {
    Maintenance: can.maintenance, Compliance: can.compliance, Escalations: can.escalations, PEEP: can.peep, 'Absence follow-up': can.followUps,
    'Room inspection': can.property, 'Room issue': can.property, 'Room check': can.roomChecks, 'Welfare check': can.welfareChecks,
    Dispersal: can.dispersal, Eviction: can.dispersal, Finance: can.finance, Transport: can.publicTransport
  };
  const tasksResult = useMemo(() => selectUnifiedTasks({
    ...opsInput, ...flowInput,
    roomRows: can.roomChecks ? roomObligations.rows : [], welfareRows: can.welfareChecks ? welfareObligations.rows : [],
    bills: can.finance ? financeBills : [], transport: can.publicTransport ? transportFundingRequests : [],
    roomLog: can.roomChecks ? roomChecks : [], welfareLog: can.welfareChecks ? welfareChecks : [],
    visible
  }, scope, now), [opsInput, flowInput, can.roomChecks, can.welfareChecks, can.finance, can.publicTransport, roomObligations.rows, welfareObligations.rows, financeBills, transportFundingRequests, roomChecks, welfareChecks, scope, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const tasks = tasksResult.tasks;
  const counts = useMemo(() => countTasks(tasks), [tasks]);

  // Loading and failures. Only the first load shows "Loading"; later live re-reads replace numbers in place.
  const contextLoading = liveDataStatus.state === 'idle' || liveDataStatus.state === 'loading';
  const loading = contextLoading || master.loading;
  const checksPending = (can.roomChecks && roomObligations.loading && !roomObligations.result) || (can.welfareChecks && welfareObligations.loading && !welfareObligations.result);
  const down = (label: string) => liveDataStatus.unavailable.includes(label);
  const masterDown = (...labels: string[]) => labels.some(l => master.failed.includes(l));
  const occupancyDown = masterDown('Properties', 'Rooms', 'Placements');
  const maintenanceDown = down('Maintenance Tracker');
  const failures = Array.from(new Set([
    ...liveDataStatus.unavailable.filter(l => ['Maintenance Tracker', 'SD-Compliance', 'Escalations', 'Properties'].includes(l)),
    ...master.failed,
    ...(can.roomChecks && roomObligations.error && !roomObligations.result ? ['Room checks'] : []),
    ...(can.welfareChecks && welfareObligations.error && !welfareObligations.result ? ['Welfare checks'] : []),
  ]));
  const tasksReady = !loading && !checksPending;
  const val = (ok: boolean, v: number) => (loading || !ok ? DASH : n(v));
  const delta = (cur: number, prev: number) => (cur === prev ? 'same as yesterday' : `${cur > prev ? '+' : '-'}${Math.abs(cur - prev)} vs yesterday (${prev})`);

  const goTable = (overdue: boolean) => {
    setTab('all'); setOverdueOnly(overdue);
    document.getElementById('ops-tasks')?.scrollIntoView({ block: 'start' });
  };

  // ---- 1. Business overview: eight KPIs, each with one definition
  const kpiList: Kpi[] = [];
  if (can.suUsers || can.property) {
    kpiList.push({ id: 'residents', label: 'Active service users', value: val(!occupancyDown, kpis.activeResidents), context: 'active placements', onClick: can.suUsers ? () => navigateWithIntent('suUsers') : undefined });
  }
  if (can.property) {
    kpiList.push(
      { id: 'occupied', label: 'Occupied rooms', value: val(!occupancyDown, kpis.occupancy.roomsOccupied), context: kpis.occupancy.beds > 0 ? `${n(kpis.occupancy.residents)} / ${n(kpis.occupancy.beds)} beds` : 'no rooms set up', onClick: () => navigateWithIntent('propertyManagement') },
      { id: 'available', label: 'Available rooms', value: val(!occupancyDown, kpis.occupancy.roomsAvailable), context: `${n(kpis.occupancy.freeBeds)} free beds`, onClick: () => navigateWithIntent('propertyManagement') }
    );
  }
  if (can.dailyRegisters) {
    kpiList.push({ id: 'arrivals', label: 'New arrivals today', value: loading ? DASH : n(flow.newArrivals.today), context: loading ? undefined : delta(flow.newArrivals.today, flow.newArrivals.yesterday), title: 'Check-in date is today. Opens Live Daily Registers.', onClick: () => navigateWithIntent('dailyRegisters') });
  }
  if (can.dispersal) {
    kpiList.push({ id: 'dispersals', label: 'Dispersals today', value: loading ? DASH : n(flow.dispersals.today), context: loading ? undefined : delta(flow.dispersals.today, flow.dispersals.yesterday), title: 'Dispersal date is today. Opens the Dispersal Sheet.', onClick: () => navigateWithIntent('dispersal') });
  }
  if (can.maintenance) {
    kpiList.push({ id: 'open-maint', label: 'Open maintenance', value: val(!maintenanceDown, kpis.openMaintenance), context: maintenanceDown ? 'could not load' : `${n(kpis.openCat1)} CAT 1`, onClick: () => navigateWithIntent('maintenance', { filters: { open: '1' } }) });
  }
  kpiList.push(
    { id: 'outstanding', label: 'Outstanding tasks', value: tasksReady ? n(counts.outstanding) : DASH, context: 'rows in the table below', title: 'Every open task with its deadline, from all modules you can view. Shows the table.', onClick: () => goTable(false) },
    { id: 'overdue', label: 'Overdue tasks', value: tasksReady ? n(counts.overdue) : DASH, context: tasksReady ? `${n(counts.dueToday)} due today` : undefined, tone: tasksReady && counts.overdue > 0 ? 'red' : 'none', title: 'Past their deadline. Shows the table filtered to Overdue.', onClick: () => goTable(true) }
  );

  // ---- 2. Operations & deadlines: one tab per module, a few top records each; the module page holds the rest
  interface ModuleCounts { outstanding: number; overdue: number; today: number; week: number; total: number | null }
  const byModule = useMemo(() => {
    const m = new Map<TaskModule, ModuleCounts>();
    for (const t of tasks) {
      const c = m.get(t.module) || { outstanding: 0, overdue: 0, today: 0, week: 0, total: tasksResult.totals[t.module] ?? null };
      c.outstanding++;
      if (t.bucket === 'overdue') c.overdue++;
      else if (t.bucket === 'today') c.today++;
      else if (t.bucket === 'tomorrow' || t.bucket === 'week') c.week++;
      m.set(t.module, c);
    }
    return [...m.entries()].sort((a, b) => b[1].overdue - a[1].overdue || b[1].outstanding - a[1].outstanding || a[0].localeCompare(b[0]));
  }, [tasks, tasksResult.totals]);
  const allCounts: ModuleCounts = { outstanding: counts.outstanding, overdue: counts.overdue, today: counts.dueToday, week: counts.dueThisWeek, total: null };
  // Log pages as tabs. A tab exists only for pages this user may open; only the open one is computed.
  const lists: Record<string, any[]> = {
    newArrivalsRecords, dailyRegisterRecords, referrals, vulnerableSUs, challengingSUs, welfareChecks, rfaWelfareRecords, mhComplaintWelfareRecords,
    gpAppointmentRecords, irRecords, publicTransportRecords, spcdRecords, laundryRecords, propertyLaundryLogs, foodRecords, foodVendorBuffetLogs,
    foodWastageRecords, foodSurveys, bookletRecords, roomChecks
  };
  const opsRecordTabs = RECORD_TABS.filter(r => r.group === 'operations' && canAccessPage(r.page));
  const facilityTabs = RECORD_TABS.filter(r => r.group === 'facilities' && canAccessPage(r.page));
  const activeRecord = opsRecordTabs.find(r => `rec:${r.key}` === tab) || null;
  // A remembered tab that no longer exists (module has no work now, or access changed) falls back to All.
  const taskTab: 'all' | TaskModule | null = activeRecord ? null : (tab !== 'all' && byModule.some(([m]) => m === tab) ? (tab as TaskModule) : 'all');
  const activeCounts: ModuleCounts | null = taskTab === 'all' ? allCounts : taskTab ? (byModule.find(([m]) => m === taskTab)?.[1] ?? null) : null;
  const pool = useMemo(() => tasks.filter(t => (taskTab === 'all' || t.module === taskTab) && (!overdueOnly || t.bucket === 'overdue')), [tasks, taskTab, overdueOnly]);
  const shown = taskTab ? pool.slice(0, taskTab === 'all' ? ALL_ROWS : TAB_ROWS) : [];
  const landing = taskTab && taskTab !== 'all' ? moduleLanding(taskTab, overdueOnly) : null;

  const activeFacility = facilityTabs.find(r => r.key === factTab) || facilityTabs[0] || null;
  const recordResult = useMemo(() => (activeRecord ? selectRecordTab(activeRecord, lists[activeRecord.source], siteRefs, scope, TAB_ROWS) : null),
    [activeRecord, lists[activeRecord?.source || ''], siteRefs, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const facilityResult = useMemo(() => (activeFacility ? selectRecordTab(activeFacility, lists[activeFacility.source], siteRefs, scope, TAB_ROWS) : null),
    [activeFacility, lists[activeFacility?.source || ''], siteRefs, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTask = (t: UnifiedTask) => navigateWithIntent(t.page, { filters: t.filters, recordId: t.openId || t.recordId });

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([refreshLiveData(), master.reload()]); } finally { setRefreshing(false); setNow(new Date()); }
  };

  const dateLabel = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(now);
  const lastSyncMs = Math.max(0, ...[liveDataStatus.lastSyncAt, master.loadedAt, live.lastReconciledAt].map(v => (v ? new Date(v).getTime() : 0)));
  const updatedLabel = lastSyncMs
    ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(lastSyncMs))
    : DASH;
  const linkLabel = live.link === 'live' ? 'Live' : live.link === 'connecting' ? 'Connecting' : live.link === 'reconnecting' ? 'Reconnecting' : 'Offline';
  const siteOptions = (allowedSites || []).filter(Boolean);
  const multiSite = canAccessAllSites() || siteOptions.length > 1;

  const qualityNotes = Object.entries(tasksResult.unreadableDates).map(([k, c]) => `${c} ${k} record${c > 1 ? 's' : ''} with a missing or unreadable date`);

  return (
    <div className="space-y-2" id="operations-dashboard">
      {/* Header: one row. The site picked here governs every section. */}
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
          <span className="text-[#605e5c] whitespace-nowrap" title="Time the numbers were last read from the database">Last synchronised {updatedLabel}</span>
          <span
            role="status"
            className={`whitespace-nowrap font-semibold ${live.link === 'live' ? 'text-emerald-800' : live.link === 'connecting' ? 'text-[#605e5c]' : 'text-[#a4262c]'}`}
            title={live.link === 'live' ? 'Connected. Changes by other users appear here automatically.' : live.link === 'connecting' ? 'Opening the live connection.' : 'The live connection is down. It reconnects on its own and re-reads everything when it is back.'}
          >{linkLabel}</span>
          <button type="button" onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-1 px-2 py-1 font-semibold bg-white border border-[#8a8886] rounded-xs hover:bg-[#edebe9] disabled:opacity-60">
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {failures.length > 0 && !loading && (
        <div role="alert" className="px-3 py-1.5 text-xs bg-red-50 border border-red-200 rounded-xs text-red-800">
          Could not load: {failures.join(', ')}. Numbers that depend on these are shown as {DASH} or are missing from the table.
        </div>
      )}

      {/* 1. Business overview */}
      {kpiList.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2" aria-label="Business overview">
          {kpiList.map(k => <KpiCell key={k.id} kpi={k} />)}
        </div>
      ) : (
        <p className="text-xs text-[#605e5c] py-2">You do not have access to any page this dashboard summarises.</p>
      )}

      {/* 2. Operations & deadlines: tabs per module, top records only */}
      <section id="ops-tasks" className="bg-white border border-[#e1dfdd] rounded-xs min-w-0" aria-labelledby="ops-tasks-h">
        <header className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 border-b border-[#e1dfdd]">
          <h2 id="ops-tasks-h" className="text-xs font-semibold text-[#242424]">Operations &amp; deadlines</h2>
          <label className="flex items-center gap-1.5 text-xs text-[#323130]">
            <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} />
            Overdue only
          </label>
        </header>
        <div role="tablist" aria-label="Modules" className="flex flex-wrap items-center gap-x-1 border-b border-[#e1dfdd] px-1.5">
          {[{ key: 'all', label: 'All', total: counts.outstanding, overdue: counts.overdue }, ...byModule.map(([m, c]) => ({ key: m as string, label: m as string, total: c.outstanding, overdue: c.overdue }))].map(t => (
            <button
              key={t.key} type="button" role="tab" aria-selected={taskTab === t.key} onClick={() => setTab(t.key)}
              className={`px-2 py-1.5 text-xs whitespace-nowrap border-b-2 ${taskTab === t.key ? 'border-[#0d9488] font-semibold text-[#242424]' : 'border-transparent text-[#605e5c] hover:text-[#242424]'}`}
            >
              {t.label} <span className="tabular-nums text-[#605e5c]">{tasksReady ? n(t.total) : DASH}</span>
              {tasksReady && t.overdue > 0 && <span className="ml-1 tabular-nums font-bold text-[#a4262c]" title="Overdue">{n(t.overdue)}</span>}
            </button>
          ))}
          {opsRecordTabs.length > 0 && <span className="mx-1 h-4 w-px bg-[#e1dfdd]" aria-hidden="true" />}
          {opsRecordTabs.map(r => (
            <button
              key={r.key} type="button" role="tab" aria-selected={activeRecord?.key === r.key} onClick={() => setTab(`rec:${r.key}`)}
              className={`px-2 py-1.5 text-xs whitespace-nowrap border-b-2 ${activeRecord?.key === r.key ? 'border-[#0d9488] font-semibold text-[#242424]' : 'border-transparent text-[#605e5c] hover:text-[#242424]'}`}
            >{r.label}</button>
          ))}
        </div>
        {activeCounts && tasksReady && (
          <p className="flex flex-wrap gap-x-4 gap-y-0.5 px-2.5 py-1.5 text-xs text-[#323130] border-b border-[#f3f2f1] tabular-nums" aria-label="Counts">
            {activeCounts.total !== null && <span><span className="text-[#605e5c]">Total records</span> <strong>{n(activeCounts.total)}</strong></span>}
            <span><span className="text-[#605e5c]">Outstanding</span> <strong>{n(activeCounts.outstanding)}</strong></span>
            <span><span className="text-[#605e5c]">Overdue</span> <strong className={activeCounts.overdue > 0 ? 'text-[#a4262c]' : ''}>{n(activeCounts.overdue)}</strong></span>
            <span><span className="text-[#605e5c]">Due today</span> <strong className={activeCounts.today > 0 ? 'text-[#7f6000]' : ''}>{n(activeCounts.today)}</strong></span>
            <span><span className="text-[#605e5c]">Due this week</span> <strong>{n(activeCounts.week)}</strong></span>
          </p>
        )}
        {activeRecord && recordResult ? (
          <RecordPanel spec={activeRecord} result={recordResult} ready={!loading} onOpen={(page, id) => navigateWithIntent(page, { recordId: id })} />
        ) : !tasksReady ? (
          <p className="px-2.5 py-3 text-xs text-[#605e5c]" aria-busy="true">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="px-2.5 py-3 text-xs text-[#605e5c]">
            {tasks.length > 0 ? 'Nothing overdue here.' : failures.length > 0 ? 'Nothing found in the sources that loaded.' : 'No outstanding tasks at the selected site(s).'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#edebe9]">
                  <th className={TH}>Priority</th><th className={TH}>Task</th>{taskTab === 'all' && <th className={TH}>Module</th>}<th className={TH}>Site</th>
                  <th className={TH}>Assigned to</th><th className={TH}>Due</th><th className={TH}>Remaining</th><th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f2f1]">
                {shown.map(t => (
                  <tr key={t.key} onClick={() => openTask(t)} className="cursor-pointer hover:bg-[#f3f2f1]" title="Open the record">
                    <td className={TD}>{priorityTag(t)}</td>
                    <td className={`${TD} max-w-[320px]`}><span className="block truncate text-[#242424]" title={`${t.task}${t.location ? ` - ${t.location}` : ''}`}>{t.task}</span></td>
                    {taskTab === 'all' && <td className={`${TD} whitespace-nowrap`}>{t.module}</td>}
                    <td className={`${TD} whitespace-nowrap font-medium text-[#323130]`}>{t.siteName}</td>
                    <td className={`${TD} text-[#605e5c]`}>{t.assignedTo || DASH}</td>
                    <td className={`${TD} whitespace-nowrap tabular-nums`}>{t.due ? (t.due.endsWith('23:59') ? t.due.slice(0, 10) : t.due) : DASH}</td>
                    <td className={`${TD} whitespace-nowrap tabular-nums ${remainingClass(t)}`}>{t.remaining}</td>
                    <td className={`${TD} whitespace-nowrap`}><Tag tone={t.bucket === 'overdue' ? 'red' : 'grey'}>{t.status}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-2.5 py-1.5 text-xs border-t border-[#edebe9]">
              <span className="text-[#605e5c]">Showing {shown.length} of {n(pool.length)}, most urgent first</span>
              {landing ? (
                <button type="button" className="font-semibold text-[#0d9488] hover:underline" onClick={() => navigateWithIntent(landing.page, { filters: landing.filters })}>View all in {taskTab} →</button>
              ) : (
                <span className="text-[#605e5c]">Choose a module tab to see more</span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Facilities & site services: the newest few records of each page */}
      {facilityTabs.length > 0 && activeFacility && facilityResult && (
        <section id="ops-facilities" className="bg-white border border-[#e1dfdd] rounded-xs min-w-0" aria-labelledby="ops-facilities-h">
          <header className="px-2.5 py-1.5 border-b border-[#e1dfdd]">
            <h2 id="ops-facilities-h" className="text-xs font-semibold text-[#242424]">Facilities &amp; site services</h2>
          </header>
          <div role="tablist" aria-label="Facilities and site services" className="flex flex-wrap gap-x-1 border-b border-[#e1dfdd] px-1.5">
            {facilityTabs.map(r => (
              <button
                key={r.key} type="button" role="tab" aria-selected={activeFacility.key === r.key} onClick={() => setFactTab(r.key)}
                className={`px-2 py-1.5 text-xs whitespace-nowrap border-b-2 ${activeFacility.key === r.key ? 'border-[#0d9488] font-semibold text-[#242424]' : 'border-transparent text-[#605e5c] hover:text-[#242424]'}`}
              >{r.label}</button>
            ))}
          </div>
          <RecordPanel spec={activeFacility} result={facilityResult} ready={!loading} onOpen={(page, id) => navigateWithIntent(page, { recordId: id })} />
        </section>
      )}
      {/* Always open. These are the only places this data appears: no tab above repeats them. */}
      {can.dailyRegisters && (
        <GuestAnalyticsWidget siteFilter={siteFilter} onNavigate={p => navigateWithIntent(p)} />
      )}
      {can.vulnerable && (
        <PriorityVulnerableWidget siteFilter={siteFilter} onNavigate={p => navigateWithIntent(p)} />
      )}

      {/* Transport analytics (journeys, issues, funding) - collapsed and loaded only when opened */}
      {can.publicTransport && (
        <div className="bg-white border border-[#e1dfdd] rounded-xs">
          <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(v => !v)} className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-[#242424] hover:bg-[#f3f2f1]">
            {moreOpen ? 'Hide' : 'Show'} transport analytics
          </button>
          {moreOpen && (
            <div className="p-3 border-t border-[#e1dfdd]">
              <TransportKPIDashboard selectedSiteFilter={siteFilter} onNavigate={p => navigateWithIntent(p)} />
            </div>
          )}
        </div>
      )}

      {!loading && qualityNotes.length > 0 && (
        <details className="text-xs text-[#605e5c]">
          <summary className="cursor-pointer select-none">Data notes ({qualityNotes.length}) - records left out of the numbers above</summary>
          <ul className="mt-1 ml-4 list-disc">{qualityNotes.map(t => <li key={t}>{t}</li>)}</ul>
        </details>
      )}
    </div>
  );
};
