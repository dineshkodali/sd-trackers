import React, { useEffect, useMemo, useState } from 'react';
import { IconRefresh as RefreshCw, IconSearch as Search } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { useOperationsData } from '../../hooks/useOperationsData';
import { useCheckObligations } from '../../hooks/useCheckObligations';
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
    liveDataStatus, navigateWithIntent, refreshLiveData
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
    welfareChecks: canAccessPage('welfareChecks')
  };

  const master = useOperationsData({ property: can.property, peep: can.peep, followUps: can.followUps });

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

  const allowedNames = useMemo(() => {
    if (canAccessAllSites()) return null;
    return new Set((allowedSites || []).map(s => String(s).toLowerCase()));
  }, [canAccessAllSites, allowedSites]);

  const scopedRoomRows = useMemo(() => {
    return (roomObligations.rows || []).filter(r =>
      (!allowedNames || allowedNames.has(r.siteName.toLowerCase())) &&
      (!siteFilter || siteFilter === 'all' || siteFilter === 'All Sites' || r.siteName.toLowerCase() === siteFilter.toLowerCase())
    );
  }, [roomObligations.rows, allowedNames, siteFilter]);

  const scopedWelfareRows = useMemo(() => {
    return (welfareObligations.rows || []).filter(r =>
      (!allowedNames || allowedNames.has(r.siteName.toLowerCase())) &&
      (!siteFilter || siteFilter === 'all' || siteFilter === 'All Sites' || r.siteName.toLowerCase() === siteFilter.toLowerCase())
    );
  }, [welfareObligations.rows, allowedNames, siteFilter]);

  const roomTotals = useMemo(() => {
    const total = scopedRoomRows.length;
    const completed = scopedRoomRows.filter(r => r.overall === 'complete').length;
    const overdue = scopedRoomRows.filter(r => r.first?.status === 'overdue' || r.second?.status === 'overdue').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, overdue, pct };
  }, [scopedRoomRows]);

  const welfareTotals = useMemo(() => {
    const total = scopedWelfareRows.length;
    const completed = scopedWelfareRows.filter(r => r.overall === 'complete').length;
    const overdue = scopedWelfareRows.filter(r => r.first?.status === 'overdue' || r.second?.status === 'overdue').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, overdue, pct };
  }, [scopedWelfareRows]);

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
  const updatedLabel = liveDataStatus.lastSyncAt
    ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(liveDataStatus.lastSyncAt))
    : DASH;

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
          <span className="text-[#605e5c] whitespace-nowrap" title="Time of the last data load">Updated {updatedLabel}</span>
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

      {/* KPI strip */}
      {kpiList.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
          {kpiList.map(k => <KpiCell key={k.id} kpi={k} />)}
        </div>
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

      {/* Monthly Compliance Summary Cards (Replaces bulky dropdown lists) */}
      {(can.roomChecks || can.welfareChecks) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {can.roomChecks && (
            <div className="bg-white border border-[#e1dfdd] rounded-xs p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-semibold text-[#242424] truncate">Room Checks Monthly Compliance</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#faf9f8] text-[#605e5c] border border-[#edebe9] rounded-xs whitespace-nowrap">
                      {currentMonthLabel}
                    </span>
                  </div>
                  {roomTotals.overdue > 0 ? (
                    <Tag tone="red">{roomTotals.overdue} overdue</Tag>
                  ) : (
                    <Tag tone="grey">On track</Tag>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2.5">
                  <div className="bg-[#faf9f8] border border-[#edebe9] rounded-xs p-2 text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#605e5c]">Total Rooms</div>
                    <div className="text-lg font-semibold text-[#242424] tabular-nums mt-0.5">{roomTotals.total}</div>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xs p-2 text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800">Completed 2/2</div>
                    <div className="text-lg font-semibold text-emerald-800 tabular-nums mt-0.5">{roomTotals.completed}</div>
                  </div>
                  <div className={`${roomTotals.overdue > 0 ? 'bg-red-50/50 border-red-100' : 'bg-[#faf9f8] border-[#edebe9]'} border rounded-xs p-2 text-center`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-wider ${roomTotals.overdue > 0 ? 'text-red-800' : 'text-[#605e5c]'}`}>Overdue</div>
                    <div className={`text-lg font-semibold tabular-nums mt-0.5 ${roomTotals.overdue > 0 ? 'text-red-800' : 'text-[#242424]'}`}>{roomTotals.overdue}</div>
                  </div>
                </div>

                <div className="space-y-1 mb-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#605e5c]">Monthly Completion Rate</span>
                    <span className="font-semibold text-[#242424] tabular-nums">{roomTotals.pct}%</span>
                  </div>
                  <div className="w-full bg-[#edebe9] rounded-xs h-1.5 overflow-hidden">
                    <div className="bg-[#0d9488] h-1.5 rounded-xs transition-all duration-300" style={{ width: `${roomTotals.pct}%` }} />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#edebe9] flex items-center justify-between">
                <span className="text-[11px] text-[#605e5c]">2 checks / month per room (10th & 25th)</span>
                <button
                  type="button"
                  onClick={() => navigateWithIntent('roomChecks')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0d9488] hover:text-[#0f766e] cursor-pointer"
                >
                  <span>Manage Room Checks</span>
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </div>
          )}

          {can.welfareChecks && (
            <div className="bg-white border border-[#e1dfdd] rounded-xs p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-semibold text-[#242424] truncate">Welfare Checks Monthly Compliance</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#faf9f8] text-[#605e5c] border border-[#edebe9] rounded-xs whitespace-nowrap">
                      {currentMonthLabel}
                    </span>
                  </div>
                  {welfareTotals.overdue > 0 ? (
                    <Tag tone="red">{welfareTotals.overdue} overdue</Tag>
                  ) : (
                    <Tag tone="grey">On track</Tag>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2.5">
                  <div className="bg-[#faf9f8] border border-[#edebe9] rounded-xs p-2 text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#605e5c]">Total SUs</div>
                    <div className="text-lg font-semibold text-[#242424] tabular-nums mt-0.5">{welfareTotals.total}</div>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xs p-2 text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800">Completed 2/2</div>
                    <div className="text-lg font-semibold text-emerald-800 tabular-nums mt-0.5">{welfareTotals.completed}</div>
                  </div>
                  <div className={`${welfareTotals.overdue > 0 ? 'bg-red-50/50 border-red-100' : 'bg-[#faf9f8] border-[#edebe9]'} border rounded-xs p-2 text-center`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-wider ${welfareTotals.overdue > 0 ? 'text-red-800' : 'text-[#605e5c]'}`}>Overdue</div>
                    <div className={`text-lg font-semibold tabular-nums mt-0.5 ${welfareTotals.overdue > 0 ? 'text-red-800' : 'text-[#242424]'}`}>{welfareTotals.overdue}</div>
                  </div>
                </div>

                <div className="space-y-1 mb-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#605e5c]">Monthly Completion Rate</span>
                    <span className="font-semibold text-[#242424] tabular-nums">{welfareTotals.pct}%</span>
                  </div>
                  <div className="w-full bg-[#edebe9] rounded-xs h-1.5 overflow-hidden">
                    <div className="bg-[#0d9488] h-1.5 rounded-xs transition-all duration-300" style={{ width: `${welfareTotals.pct}%` }} />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#edebe9] flex items-center justify-between">
                <span className="text-[11px] text-[#605e5c]">2 checks / month per placed resident</span>
                <button
                  type="button"
                  onClick={() => navigateWithIntent('welfareChecks')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0d9488] hover:text-[#0f766e] cursor-pointer"
                >
                  <span>Manage Welfare Checks</span>
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Operational overview + site comparison (below the fold) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2">
        {overviewRows.length > 0 && (
          <section className="xl:col-span-5 bg-white border border-[#e1dfdd] rounded-xs min-w-0" aria-labelledby="ops-overview-h">
            <header className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#e1dfdd]">
              <h2 id="ops-overview-h" className="text-xs font-semibold text-[#242424]">Operational overview</h2>
              <label className="flex items-center gap-1.5 text-xs text-[#605e5c]">
                <span>Completed in</span>
                <select aria-label="Reporting period for the Completed column" value={period} onChange={e => setPeriod(e.target.value as PeriodKind)} className="px-1.5 py-0.5 bg-white border border-[#8a8886] rounded-xs text-[#242424]">
                  {(Object.keys(PERIOD_LABELS) as PeriodKind[]).map(k => <option key={k} value={k}>{PERIOD_LABELS[k]}</option>)}
                </select>
              </label>
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
              <h2 id="ops-sites-h" className="text-xs font-semibold text-[#242424]">Sites by items needing action</h2>
              <span className="text-[11px] text-[#605e5c]">Ranked by overdue maintenance + CAT 1 + expired compliance + overdue reviews</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#edebe9]">
                    <th className={TH}>Site</th>
                    {can.property && <th className={`${TH} text-right`}>Occupancy</th>}
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
