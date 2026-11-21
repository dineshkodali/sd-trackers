import React, { useEffect, useMemo, useState } from 'react';
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
  selectUnifiedTasks, countTasks, filterTasks, NO_TASK_FILTER, BUCKET_LABEL, type TaskFilter, type TaskModule, type UnifiedTask
} from '../../utils/operationsTasks';
import { selectRecentActivity } from '../../utils/operationsActivity';
import { createSiteResolver, londonNow } from '../../utils/operationsRules';

/**
 * Operations Dashboard - three sections, each number defined once:
 *   1. Business overview  - eight KPIs
 *   2. Operations & deadlines - ONE table of every actionable task (utils/operationsTasks.ts); "Outstanding" and "Overdue"
 *      are counted from that same list, so they always equal its rows
 *   3. Recent activity - the audit trail only
 * Module detail stays in the module pages. Static by design: no animation, charts or transitions. A figure whose source
 * could not be loaded is a dash, never zero.
 */

const TH = 'px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] whitespace-nowrap';
const TD = 'px-2 py-1.5 align-top';
const DASH = '—';
const PAGE_SIZE = 25;
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

const SELECT = 'px-1.5 py-1 text-xs bg-white border border-[#8a8886] rounded-xs max-w-[11rem]';

export const OperationsDashboardView: React.FC = () => {
  const {
    sites, maintenanceRecords, complianceRecords, escalations, auditLogs, currentUserRole,
    canAccessPage, canAccessAllSites, allowedSites, defaultSiteFilter,
    liveDataStatus, navigateWithIntent, refreshLiveData,
    newArrivalsRecords, dispersalRecords, evictionRecords, financeBills, transportFundingRequests
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
    suUsers: canAccessPage('suUsers'),
    audit: canAccessPage('audit')
  };

  const master = useOperationsData({ property: can.property, peep: can.peep, followUps: can.followUps, residents: false });
  // One shared live link: another user's change re-reads the affected data here within seconds, with no page reload.
  const live = useOperationsLive(refreshLiveData);

  const [siteFilter, setSiteFilter] = useState<string>(defaultSiteFilter);
  useEffect(() => { setSiteFilter(defaultSiteFilter); }, [defaultSiteFilter]);
  const [filter, setFilter] = useState<TaskFilter>(NO_TASK_FILTER);
  const [page, setPage] = useState(1);
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
    visible
  }, scope, now), [opsInput, flowInput, can.roomChecks, can.welfareChecks, can.finance, can.publicTransport, roomObligations.rows, welfareObligations.rows, financeBills, transportFundingRequests, scope, now]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const goTable = (f: TaskFilter) => {
    setFilter(f); setPage(1);
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
    { id: 'outstanding', label: 'Outstanding tasks', value: tasksReady ? n(counts.outstanding) : DASH, context: 'rows in the table below', title: 'Every open task with its deadline, from all modules you can view. Shows the table.', onClick: () => goTable(NO_TASK_FILTER) },
    { id: 'overdue', label: 'Overdue tasks', value: tasksReady ? n(counts.overdue) : DASH, context: tasksReady ? `${n(counts.dueToday)} due today` : undefined, tone: tasksReady && counts.overdue > 0 ? 'red' : 'none', title: 'Past their deadline. Shows the table filtered to Overdue.', onClick: () => goTable({ ...NO_TASK_FILTER, when: 'overdue' }) }
  );

  // ---- 2. Operations & deadlines
  const moduleOptions = useMemo(() => Array.from(new Set(tasks.map(t => t.module))).sort(), [tasks]);
  const statusOptions = useMemo(() => Array.from(new Set(tasks.map(t => t.status))).sort(), [tasks]);
  const staffOptions = useMemo(() => Array.from(new Set(tasks.map(t => t.assignedTo).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [tasks]);
  const shownAll = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);
  const pages = Math.max(1, Math.ceil(shownAll.length / PAGE_SIZE));
  const pageNow = Math.min(page, pages);
  const shown = shownAll.slice((pageNow - 1) * PAGE_SIZE, pageNow * PAGE_SIZE);
  const filtered = JSON.stringify(filter) !== JSON.stringify(NO_TASK_FILTER);
  const setF = (patch: Partial<TaskFilter>) => { setFilter(f => ({ ...f, ...patch })); setPage(1); };

  const openTask = (t: UnifiedTask) => navigateWithIntent(t.page, { filters: t.filters, recordId: t.openId || t.recordId });

  // ---- 3. Recent activity: the audit trail, scoped and de-duplicated. Same visibility as the Audit page.
  const canSeeActivity = (currentUserRole === 'Super Admin' || currentUserRole === 'Admin') && can.audit;
  const activity = useMemo(() => {
    if (!canSeeActivity) return [];
    return selectRecentActivity((auditLogs || []) as any[], {
      limit: 12,
      inScope: site => (scope.siteId === 'all' ? true : resolveSite(site) === scope.siteId)
    });
  }, [canSeeActivity, auditLogs, scope.siteId, resolveSite]);
  const activityTime = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

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
            <select aria-label="Site" value={siteFilter} onChange={e => { setSiteFilter(e.target.value); setPage(1); }} className="px-2 py-1 bg-white border border-[#8a8886] rounded-xs">
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

      {/* 2. Operations & deadlines: the one table */}
      <section id="ops-tasks" className="bg-white border border-[#e1dfdd] rounded-xs min-w-0" aria-labelledby="ops-tasks-h">
        <header className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 border-b border-[#e1dfdd]">
          <h2 id="ops-tasks-h" className="text-xs font-semibold text-[#242424]">
            Operations &amp; deadlines{tasksReady && ` (${n(shownAll.length)}${filtered ? ` of ${n(tasks.length)}` : ''})`}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <select aria-label="Module" value={filter.module} onChange={e => setF({ module: e.target.value as TaskFilter['module'] })} className={SELECT}>
              <option value="all">All modules</option>
              {moduleOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select aria-label="Status" value={filter.status} onChange={e => setF({ status: e.target.value })} className={SELECT}>
              <option value="all">All statuses</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="When" value={filter.when} onChange={e => setF({ when: e.target.value as TaskFilter['when'] })} className={SELECT}>
              <option value="all">Any deadline</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="week">Due this week</option>
            </select>
            <select aria-label="Assigned to" value={filter.assignedTo} onChange={e => setF({ assignedTo: e.target.value })} className={SELECT}>
              <option value="all">All staff</option>
              {staffOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {filtered && <button type="button" onClick={() => { setFilter(NO_TASK_FILTER); setPage(1); }} className="font-semibold text-[#0d9488] hover:underline">Clear</button>}
          </div>
        </header>
        {!tasksReady ? (
          <p className="px-2.5 py-3 text-xs text-[#605e5c]" aria-busy="true">Loading…</p>
        ) : shownAll.length === 0 ? (
          <p className="px-2.5 py-3 text-xs text-[#605e5c]">
            {tasks.length > 0 ? 'No task matches the filters.' : failures.length > 0 ? 'Nothing found in the sources that loaded.' : 'No outstanding tasks at the selected site(s).'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#edebe9]">
                  <th className={TH}>Priority</th><th className={TH}>Task / activity</th><th className={TH}>Module</th><th className={TH}>Site</th>
                  <th className={TH}>Property / room</th><th className={TH}>Assigned to</th><th className={TH}>Created</th><th className={TH}>Due</th>
                  <th className={TH}>Remaining</th><th className={TH}>Status</th><th className={TH}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f2f1]">
                {shown.map((t, i) => {
                  const startsGroup = i === 0 || shown[i - 1].bucket !== t.bucket;
                  return (
                    <React.Fragment key={t.key}>
                      {startsGroup && (
                        <tr className="bg-[#faf9f8]"><td colSpan={11} className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#605e5c]">{BUCKET_LABEL[t.bucket]}</td></tr>
                      )}
                      <tr onClick={() => openTask(t)} className="cursor-pointer hover:bg-[#f3f2f1]">
                        <td className={TD}>{priorityTag(t)}</td>
                        <td className={`${TD} max-w-[300px]`}><span className="block truncate text-[#242424]" title={t.task}>{t.task}</span></td>
                        <td className={`${TD} whitespace-nowrap`}>{t.module}</td>
                        <td className={`${TD} whitespace-nowrap font-medium text-[#323130]`}>{t.siteName}</td>
                        <td className={`${TD} max-w-[180px]`}><span className="block truncate" title={t.location}>{t.location || DASH}</span></td>
                        <td className={`${TD} text-[#605e5c]`}>{t.assignedTo || DASH}</td>
                        <td className={`${TD} whitespace-nowrap tabular-nums`}>{t.created || DASH}</td>
                        <td className={`${TD} whitespace-nowrap tabular-nums`}>{t.due ? (t.due.endsWith('23:59') ? t.due.slice(0, 10) : t.due) : DASH}</td>
                        <td className={`${TD} whitespace-nowrap tabular-nums ${remainingClass(t)}`}>{t.remaining}</td>
                        <td className={`${TD} whitespace-nowrap`}><Tag tone={t.bucket === 'overdue' ? 'red' : 'grey'}>{t.status}</Tag></td>
                        <td className={TD}>
                          <button type="button" className="font-semibold text-[#0d9488] hover:underline focus:underline focus:outline-none" onClick={e => { e.stopPropagation(); openTask(t); }}>Open</button>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {pages > 1 && (
              <div className="flex items-center justify-between px-2.5 py-1.5 text-xs border-t border-[#edebe9]">
                <span className="text-[#605e5c]">Page {pageNow} of {pages}</span>
                <span className="space-x-3">
                  <button type="button" disabled={pageNow <= 1} onClick={() => setPage(pageNow - 1)} className="font-semibold text-[#0d9488] disabled:text-neutral-400">Previous</button>
                  <button type="button" disabled={pageNow >= pages} onClick={() => setPage(pageNow + 1)} className="font-semibold text-[#0d9488] disabled:text-neutral-400">Next</button>
                </span>
              </div>
            )}
          </div>
        )}
        <p className="px-2.5 py-1.5 text-[11px] text-[#605e5c] border-t border-[#edebe9]">
          One row per open record, with the deadline stored on it. Room and welfare checks are due by the 10th and 25th. Dated work more than 30 days away is not listed. Records with no deadline show {DASH}.
        </p>
      </section>

      {/* 3. Recent activity: what changed, not what is pending */}
      {canSeeActivity && (
        <section className="bg-white border border-[#e1dfdd] rounded-xs min-w-0" aria-labelledby="ops-activity-h">
          <header className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#e1dfdd]">
            <h2 id="ops-activity-h" className="text-xs font-semibold text-[#242424]">Recent activity</h2>
            <span className="text-[11px] text-[#605e5c]">Latest record changes from the audit trail</span>
          </header>
          {loading ? (
            <p className="px-2.5 py-3 text-xs text-[#605e5c]" aria-busy="true">Loading…</p>
          ) : activity.length === 0 ? (
            <p className="px-2.5 py-3 text-xs text-[#605e5c]">No recent changes at the selected site(s).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#edebe9]">
                    <th className={TH}>Time</th><th className={TH}>Module</th><th className={TH}>Record</th><th className={TH}>Activity</th><th className={TH}>Updated by</th><th className={TH}>Site</th><th className={TH}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f2f1]">
                  {activity.map(a => (
                    <tr key={a.id}>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>{activityTime(a.at)}</td>
                      <td className={`${TD} whitespace-nowrap`}>{a.module}</td>
                      <td className={`${TD} max-w-[260px] truncate`} title={a.record}>{a.record}</td>
                      <td className={`${TD} whitespace-nowrap`}><Tag tone={a.verb === 'Deleted' ? 'red' : a.verb === 'Created' || a.verb === 'Restored' ? 'green' : 'grey'}>{a.verb}</Tag></td>
                      <td className={`${TD} whitespace-nowrap`}>{a.by}</td>
                      <td className={`${TD} whitespace-nowrap`}>{a.site}</td>
                      <td className={TD}>
                        {a.page && canAccessPage(a.page)
                          ? <button type="button" className="font-semibold text-[#0d9488] hover:underline focus:underline focus:outline-none" onClick={() => navigateWithIntent(a.page!, { recordId: a.recordId || undefined })}>Open</button>
                          : DASH}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Guest statistics, priority safeguarding and public transport (placed here by an earlier change; untouched) */}
      {can.dailyRegisters && (
        <GuestAnalyticsWidget siteFilter={siteFilter} onNavigate={p => navigateWithIntent(p)} />
      )}
      {can.vulnerable && (
        <PriorityVulnerableWidget siteFilter={siteFilter} onNavigate={p => navigateWithIntent(p)} />
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
          <TransportKPIDashboard selectedSiteFilter={siteFilter} onNavigate={p => navigateWithIntent(p)} />
        </section>
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
