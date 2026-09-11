import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  BarChart3, 
  PieChart as PieIcon, 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { SGReferral, EscalationRecord, ChallengingSU } from '../../types';
import { MonthlyIncidentsTable } from './MonthlyIncidentsTable';

interface DashboardAnalyticsProps {
  referrals: SGReferral[];
  escalations: EscalationRecord[];
  challengingSUs: ChallengingSU[];
  selectedSite: string;
  onNavigate: (page: string) => void;
}

// Canonical category definitions for incident analysis
export const INCIDENT_CATEGORIES = [
  { key: 'Medical Emergency', label: 'Medical Emergency', color: '#a4262c', shortName: 'Medical' },
  { key: 'Behavioral & Conflict', label: 'Behavioral & Conflict', color: '#d83b01', shortName: 'Conflict' },
  { key: 'Safeguarding & Welfare', label: 'Safeguarding & Welfare', color: '#0078d4', shortName: 'Safeguarding' },
  { key: 'Curfew & Non-Compliance', label: 'Curfew & Absence', color: '#0f766e', shortName: 'Curfew' },
  { key: 'Property Damage & Hazard', label: 'Property & Hazard', color: '#b45309', shortName: 'Property' },
  { key: 'Substance Misuse', label: 'Substance Misuse', color: '#5c2d91', shortName: 'Substance' }
] as const;

// Categorizes raw incident text or issue types into standardized categories
export function categorizeIncident(incidentType?: string, title?: string, notes?: string): string {
  const combined = `${incidentType || ''} ${title || ''} ${notes || ''}`.toLowerCase();

  if (
    combined.includes('medical') || 
    combined.includes('paramedic') || 
    combined.includes('999') || 
    combined.includes('ambulance') || 
    combined.includes('trimester') || 
    combined.includes('hospital') || 
    combined.includes('cardiac') ||
    combined.includes('dialysis') ||
    combined.includes('fall') ||
    combined.includes('injury')
  ) {
    return 'Medical Emergency';
  }

  if (
    combined.includes('substance') || 
    combined.includes('alcohol') || 
    combined.includes('drug') || 
    combined.includes('beer') || 
    combined.includes('smoking') ||
    combined.includes('contraband')
  ) {
    return 'Substance Misuse';
  }

  if (
    combined.includes('curfew') || 
    combined.includes('missing') || 
    combined.includes('absence') || 
    combined.includes('keycard') || 
    combined.includes('late arrival') ||
    combined.includes('visitor') ||
    combined.includes('unauthorized')
  ) {
    return 'Curfew & Non-Compliance';
  }

  if (
    combined.includes('damage') || 
    combined.includes('socket') || 
    combined.includes('electrical') || 
    combined.includes('fire') || 
    combined.includes('leak') ||
    combined.includes('kettle') ||
    combined.includes('fixture')
  ) {
    return 'Property Damage & Hazard';
  }

  if (
    combined.includes('dispute') || 
    combined.includes('verbal') || 
    combined.includes('aggression') || 
    combined.includes('altercation') || 
    combined.includes('noise') || 
    combined.includes('shouting') || 
    combined.includes('fight') || 
    combined.includes('hostil')
  ) {
    return 'Behavioral & Conflict';
  }

  return 'Safeguarding & Welfare';
}

// Formats YYYY-MM into human-readable month string (e.g. "Jan '26")
function formatMonthLabel(ymKey: string): string {
  const [year, month] = ymKey.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(month, 10) - 1;
  const shortYear = year ? `'${year.slice(2)}` : '';
  return `${monthNames[monthIdx] || ymKey} ${shortYear}`;
}

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  referrals,
  escalations,
  challengingSUs,
  selectedSite,
  onNavigate
}) => {
  // Chart control view modes
  const [incidentChartMode, setIncidentChartMode] = useState<'stacked' | 'grouped' | 'distribution'>('stacked');
  const [referralChartMode, setReferralChartMode] = useState<'area' | 'line'>('area');

  // Filter datasets by selected site if not 'all'
  const filteredEscalations = useMemo(() => {
    if (selectedSite === 'all') return escalations;
    return escalations.filter(e => e.site === selectedSite || e.siteName === selectedSite);
  }, [escalations, selectedSite]);

  const filteredChallenging = useMemo(() => {
    if (selectedSite === 'all') return challengingSUs;
    return challengingSUs.filter(c => c.site === selectedSite);
  }, [challengingSUs, selectedSite]);

  const filteredReferrals = useMemo(() => {
    if (selectedSite === 'all') return referrals;
    return referrals.filter(r => r.site === selectedSite);
  }, [referrals, selectedSite]);

  // Baseline standard chronological 6 months for clear executive trends
  const standardMonths = useMemo(() => {
    return ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
  }, []);

  // Determine all available months across datasets, ensuring standardMonths are always present
  const allMonths = useMemo(() => {
    const monthSet = new Set<string>(standardMonths);

    filteredEscalations.forEach(e => {
      const dateStr = e.dateOfIncident || (e.dateTime ? e.dateTime.split(' ')[0] : '') || (e.createdAt ? e.createdAt.split('T')[0] : '');
      if (dateStr && dateStr.length >= 7) {
        monthSet.add(dateStr.slice(0, 7));
      }
    });

    filteredChallenging.forEach(c => {
      const dateStr = c.dateOfIncident || c.date || (c.createdAt ? c.createdAt.split('T')[0] : '');
      if (dateStr && dateStr.length >= 7) {
        monthSet.add(dateStr.slice(0, 7));
      }
    });

    filteredReferrals.forEach(r => {
      const dateStr = r.dateReferred || (r.createdAt ? r.createdAt.split('T')[0] : '');
      if (dateStr && dateStr.length >= 7) {
        monthSet.add(dateStr.slice(0, 7));
      }
    });

    return Array.from(monthSet).sort();
  }, [standardMonths, filteredEscalations, filteredChallenging, filteredReferrals]);

  // Aggregate monthly incident breakdown by category
  const monthlyIncidentsData = useMemo(() => {
    return allMonths.map(ym => {
      const monthLabel = formatMonthLabel(ym);
      const row: Record<string, any> = {
        monthKey: ym,
        month: monthLabel,
        'Medical Emergency': 0,
        'Behavioral & Conflict': 0,
        'Safeguarding & Welfare': 0,
        'Curfew & Non-Compliance': 0,
        'Property Damage & Hazard': 0,
        'Substance Misuse': 0,
        total: 0
      };

      // Aggregate Escalations
      filteredEscalations.forEach(esc => {
        const dateStr = esc.dateOfIncident || (esc.dateTime ? esc.dateTime.split(' ')[0] : '') || (esc.createdAt ? esc.createdAt.split('T')[0] : '');
        if (dateStr && dateStr.startsWith(ym)) {
          const category = categorizeIncident(esc.incidentType, esc.incidentTitle, esc.incidentNotes);
          if (row[category] !== undefined) {
            row[category] += 1;
            row.total += 1;
          } else {
            row['Safeguarding & Welfare'] += 1;
            row.total += 1;
          }
        }
      });

      // Aggregate Challenging SU Incidents
      filteredChallenging.forEach(ch => {
        const dateStr = ch.dateOfIncident || ch.date || (ch.createdAt ? ch.createdAt.split('T')[0] : '');
        if (dateStr && dateStr.startsWith(ym)) {
          const category = categorizeIncident(ch.typeOfIssue, ch.incidentDescription, ch.actionTaken);
          if (row[category] !== undefined) {
            row[category] += 1;
            row.total += 1;
          } else {
            row['Behavioral & Conflict'] += 1;
            row.total += 1;
          }
        }
      });

      return row;
    });
  }, [allMonths, filteredEscalations, filteredChallenging]);

  // Aggregate monthly referral status progression
  const monthlyReferralsData = useMemo(() => {
    return allMonths.map(ym => {
      const monthLabel = formatMonthLabel(ym);
      let open = 0;
      let inProgress = 0;
      let completed = 0;

      filteredReferrals.forEach(ref => {
        const dateStr = ref.dateReferred || (ref.createdAt ? ref.createdAt.split('T')[0] : '');
        if (dateStr && dateStr.startsWith(ym)) {
          if (ref.status === 'Open') {
            open += 1;
          } else if (ref.status === 'In progress') {
            inProgress += 1;
          } else if (ref.status === 'Completed' || ref.status === 'Archived') {
            completed += 1;
          }
        }
      });

      const total = open + inProgress + completed;
      const resolutionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        monthKey: ym,
        month: monthLabel,
        Open: open,
        'In progress': inProgress,
        Completed: completed,
        Total: total,
        resolutionRate
      };
    });
  }, [allMonths, filteredReferrals]);

  // Incident distribution totals for Donut/Pie Chart
  const incidentCategoryTotals = useMemo(() => {
    const counts: Record<string, number> = {
      'Medical Emergency': 0,
      'Behavioral & Conflict': 0,
      'Safeguarding & Welfare': 0,
      'Curfew & Non-Compliance': 0,
      'Property Damage & Hazard': 0,
      'Substance Misuse': 0
    };

    monthlyIncidentsData.forEach(row => {
      INCIDENT_CATEGORIES.forEach(cat => {
        counts[cat.key] = (counts[cat.key] || 0) + (row[cat.key] || 0);
      });
    });

    const totalIncidents = Object.values(counts).reduce((a, b) => a + b, 0);

    return INCIDENT_CATEGORIES.map(cat => ({
      name: cat.label,
      shortName: cat.shortName,
      value: counts[cat.key] || 0,
      color: cat.color,
      percentage: totalIncidents > 0 ? Math.round(((counts[cat.key] || 0) / totalIncidents) * 100) : 0
    })).filter(item => item.value > 0);
  }, [monthlyIncidentsData]);

  // Executive KPI summary calculations
  const totalIncidentsCount = useMemo(() => {
    return monthlyIncidentsData.reduce((acc, row) => acc + (row.total || 0), 0);
  }, [monthlyIncidentsData]);

  const topIncidentCategory = useMemo(() => {
    if (incidentCategoryTotals.length === 0) return { name: 'None', percentage: 0, count: 0 };
    const sorted = [...incidentCategoryTotals].sort((a, b) => b.value - a.value);
    return { name: sorted[0].name, percentage: sorted[0].percentage, count: sorted[0].value };
  }, [incidentCategoryTotals]);

  const referralMetrics = useMemo(() => {
    const total = filteredReferrals.length;
    const completed = filteredReferrals.filter(r => r.status === 'Completed' || r.status === 'Archived').length;
    const open = filteredReferrals.filter(r => r.status === 'Open').length;
    const inProgress = filteredReferrals.filter(r => r.status === 'In progress').length;
    const resolutionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, open, inProgress, resolutionRate };
  }, [filteredReferrals]);

  // Month-over-month trend indicators
  const momIncidentTrend = useMemo(() => {
    if (monthlyIncidentsData.length < 2) return 0;
    const current = monthlyIncidentsData[monthlyIncidentsData.length - 1]?.total || 0;
    const previous = monthlyIncidentsData[monthlyIncidentsData.length - 2]?.total || 0;
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }, [monthlyIncidentsData]);

  return (
    <div id="dashboard-analytics-section" className="space-y-4">
      {/* Section Header */}
      <div className="bg-white border border-[#e1dfdd] p-4 rounded-xs shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#f0fdfa] text-[#0d9488] rounded-xs">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[#242424] flex items-center gap-2">
                Operational Trends & Visual Analytics
                <span className="text-xs px-2 py-0.5 font-normal bg-[#f3f8fd] text-[#0f766e] border border-[#5eead4] rounded">
                  Manager Overview
                </span>
              </h2>
              <p className="text-xs text-[#605e5c] mt-0.5">
                Monthly incidence distribution and safeguarding referral pipeline trends across {selectedSite === 'all' ? 'all contracted hotels' : selectedSite}.
              </p>
            </div>
          </div>
        </div>

        {/* Action badges / scope */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span className="text-[11px] text-[#605e5c] block">Current Scope</span>
            <span className="text-xs font-semibold text-[#0f766e]">
              {selectedSite === 'all' ? 'All Accommodations (16 Sites)' : selectedSite}
            </span>
          </div>
          <button
            onClick={() => onNavigate('escalations')}
            className="px-2.5 py-1.5 bg-[#f3f8fd] hover:bg-[#f0fdfa] text-[#0d9488] border border-[#99f6e4] rounded-xs text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <span>Escalations</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
          <button
            onClick={() => onNavigate('referrals')}
            className="px-2.5 py-1.5 bg-[#f3f8fd] hover:bg-[#f0fdfa] text-[#0d9488] border border-[#99f6e4] rounded-xs text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <span>Referrals</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Strategic Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Total Incidents & MoM trend */}
        <div className="bg-white border border-[#e1dfdd] p-3.5 rounded-xs shadow-xs">
          <div className="flex items-center justify-between text-[#605e5c] text-xs">
            <span>Total Incidents (6 Mo)</span>
            <ShieldAlert className="w-4 h-4 text-[#a4262c]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-[#242424]">{totalIncidentsCount}</span>
            <span className={`text-xs font-semibold ${momIncidentTrend >= 0 ? 'text-[#a4262c]' : 'text-[#107c10]'}`}>
              {momIncidentTrend >= 0 ? `+${momIncidentTrend}%` : `${momIncidentTrend}%`} MoM
            </span>
          </div>
          <span className="text-[11px] text-[#605e5c] mt-0.5 block">
            Escalations & behavioral reports combined
          </span>
        </div>

        {/* KPI 2: Top Incident Driver */}
        <div className="bg-white border border-[#e1dfdd] p-3.5 rounded-xs shadow-xs">
          <div className="flex items-center justify-between text-[#605e5c] text-xs">
            <span>Primary Incident Category</span>
            <Activity className="w-4 h-4 text-[#d83b01]" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-[#242424] block truncate">
              {topIncidentCategory.name}
            </span>
          </div>
          <span className="text-[11px] text-[#605e5c] mt-0.5 block">
            {topIncidentCategory.count} logged ({topIncidentCategory.percentage}% of all incidents)
          </span>
        </div>

        {/* KPI 3: Referral Resolution Rate */}
        <div className="bg-white border border-[#e1dfdd] p-3.5 rounded-xs shadow-xs">
          <div className="flex items-center justify-between text-[#605e5c] text-xs">
            <span>Referral Resolution Rate</span>
            <CheckCircle2 className="w-4 h-4 text-[#107c10]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-[#107c10]">{referralMetrics.resolutionRate}%</span>
            <span className="text-xs text-[#605e5c]">
              ({referralMetrics.completed}/{referralMetrics.total} resolved)
            </span>
          </div>
          <span className="text-[11px] text-[#605e5c] mt-0.5 block">
            Closed or permanent aids provided
          </span>
        </div>

        {/* KPI 4: Active Referral Backlog */}
        <div className="bg-white border border-[#e1dfdd] p-3.5 rounded-xs shadow-xs">
          <div className="flex items-center justify-between text-[#605e5c] text-xs">
            <span>Active Pipeline Backlog</span>
            <Clock className="w-4 h-4 text-[#0d9488]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-[#0d9488]">
              {referralMetrics.open + referralMetrics.inProgress}
            </span>
            <span className="text-xs text-[#605e5c]">
              ({referralMetrics.open} Open · {referralMetrics.inProgress} In Prog)
            </span>
          </div>
          <span className="text-[11px] text-[#605e5c] mt-0.5 block">
            Awaiting local authority allocation or visit
          </span>
        </div>
      </div>

      {/* Main Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CHART 1: Monthly Breakdown of Incident Types */}
        <div 
          id="incident-types-chart-card"
          className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-4 flex flex-col justify-between"
        >
          <div>
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#edebe9] gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#242424] flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-[#a4262c]" />
                  <span>Monthly Incident Types Breakdown</span>
                </h3>
                <p className="text-[11px] text-[#605e5c] mt-0.5">
                  Monthly volume categorized by risk vector and operational impact
                </p>
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-[#f3f2f1] p-0.5 rounded border border-[#e1dfdd] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIncidentChartMode('stacked')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    incidentChartMode === 'stacked'
                      ? 'bg-white text-[#0d9488] shadow-xs'
                      : 'text-[#605e5c] hover:text-[#242424]'
                  }`}
                  title="Stacked Bar Chart"
                >
                  Stacked
                </button>
                <button
                  type="button"
                  onClick={() => setIncidentChartMode('grouped')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    incidentChartMode === 'grouped'
                      ? 'bg-white text-[#0d9488] shadow-xs'
                      : 'text-[#605e5c] hover:text-[#242424]'
                  }`}
                  title="Grouped Bar Chart"
                >
                  Grouped
                </button>
                <button
                  type="button"
                  onClick={() => setIncidentChartMode('distribution')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                    incidentChartMode === 'distribution'
                      ? 'bg-white text-[#0d9488] shadow-xs'
                      : 'text-[#605e5c] hover:text-[#242424]'
                  }`}
                  title="Incident Type Share Donut Chart"
                >
                  <PieIcon className="w-3 h-3" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Chart Area */}
            <div className="mt-4 h-72 w-full">
              {incidentChartMode !== 'distribution' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyIncidentsData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: '#605e5c', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#edebe9' }}
                    />
                    <YAxis 
                      allowDecimals={false}
                      tick={{ fill: '#605e5c', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#edebe9' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                          return (
                            <div className="bg-white border border-[#5eead4] shadow-md p-3 rounded text-xs">
                              <p className="font-bold text-[#242424] mb-1.5 border-b border-[#edebe9] pb-1">
                                {label} (Total: {total} Incidents)
                              </p>
                              <div className="space-y-1">
                                {payload.map((entry, idx) => (
                                  <div key={idx} className="flex items-center justify-between gap-4">
                                    <span className="flex items-center gap-1.5 text-[#323130]">
                                      <span 
                                        className="w-2.5 h-2.5 rounded-full inline-block" 
                                        style={{ backgroundColor: entry.color }}
                                      />
                                      {entry.name}:
                                    </span>
                                    <span className="font-semibold text-[#242424]">
                                      {entry.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }}
                      iconSize={8}
                    />
                    {INCIDENT_CATEGORIES.map((cat, idx) => (
                      <Bar
                        key={cat.key}
                        dataKey={cat.key}
                        name={cat.shortName}
                        stackId={incidentChartMode === 'stacked' ? 'incidents' : undefined}
                        fill={cat.color}
                        radius={incidentChartMode === 'stacked' && idx === INCIDENT_CATEGORIES.length - 1 ? [3, 3, 0, 0] : [2, 2, 0, 0]}
                        maxBarSize={45}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                /* Donut Share Distribution View */
                <div className="h-full flex flex-col sm:flex-row items-center justify-center gap-4">
                  <div className="w-full sm:w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={incidentCategoryTotals}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {incidentCategoryTotals.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, name: any, item: any) => [
                            `${value} incidents (${item.payload.percentage}%)`,
                            name
                          ]}
                          contentStyle={{ backgroundColor: '#fff', borderColor: '#5eead4', fontSize: '12px', borderRadius: '4px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Distribution Table Breakdown */}
                  <div className="w-full sm:w-1/2 space-y-1.5 text-xs">
                    <p className="text-[11px] font-semibold uppercase text-[#605e5c] tracking-wider mb-2">
                      Category Distribution
                    </p>
                    {incidentCategoryTotals.map(item => (
                      <div key={item.name} className="flex items-center justify-between py-1 border-b border-[#f3f2f1]">
                        <span className="flex items-center gap-1.5 text-[#323130]">
                          <span 
                            className="w-2.5 h-2.5 rounded-full inline-block shrink-0" 
                            style={{ backgroundColor: item.color }} 
                          />
                          <span className="truncate max-w-[130px]">{item.name}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#242424]">{item.value}</span>
                          <span className="text-[10px] text-[#605e5c] w-8 text-right font-mono">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Incident Footnote */}
          <div className="mt-3 pt-2 border-t border-[#edebe9] flex items-center justify-between text-[11px] text-[#605e5c]">
            <span>Aggregate data includes 999 hospital escorts, room conflicts & MASH notices.</span>
            <span className="text-[#0d9488] font-medium">{totalIncidentsCount} Total Records</span>
          </div>
        </div>

        {/* CHART 2: Referral Status Trends */}
        <div 
          id="referral-trends-chart-card"
          className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-4 flex flex-col justify-between"
        >
          <div>
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#edebe9] gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#242424] flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#0d9488]" />
                  <span>Safeguarding Referral Status Trends</span>
                </h3>
                <p className="text-[11px] text-[#605e5c] mt-0.5">
                  Monthly progression of Open, In Progress, and Completed cases
                </p>
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-[#f3f2f1] p-0.5 rounded border border-[#e1dfdd] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setReferralChartMode('area')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    referralChartMode === 'area'
                      ? 'bg-white text-[#0d9488] shadow-xs'
                      : 'text-[#605e5c] hover:text-[#242424]'
                  }`}
                  title="Area Trend Chart"
                >
                  Pipeline Area
                </button>
                <button
                  type="button"
                  onClick={() => setReferralChartMode('line')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    referralChartMode === 'line'
                      ? 'bg-white text-[#0d9488] shadow-xs'
                      : 'text-[#605e5c] hover:text-[#242424]'
                  }`}
                  title="Multi-Line Progression"
                >
                  Trend Lines
                </button>
              </div>
            </div>

            {/* Chart Area */}
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {referralChartMode === 'area' ? (
                  <AreaChart
                    data={monthlyReferralsData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#107c10" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#107c10" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="colorInProgress" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#d83b01" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#d83b01" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="colorOpen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0078d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0078d4" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: '#605e5c', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#edebe9' }}
                    />
                    <YAxis 
                      allowDecimals={false}
                      tick={{ fill: '#605e5c', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#edebe9' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const dataPoint = monthlyReferralsData.find(d => d.month === label);
                          return (
                            <div className="bg-white border border-[#5eead4] shadow-md p-3 rounded text-xs">
                              <p className="font-bold text-[#242424] mb-1.5 border-b border-[#edebe9] pb-1">
                                {label} (Total: {dataPoint?.Total || 0} Referrals)
                              </p>
                              <div className="space-y-1">
                                {payload.map((entry, idx) => (
                                  <div key={idx} className="flex items-center justify-between gap-4">
                                    <span className="flex items-center gap-1.5 text-[#323130]">
                                      <span 
                                        className="w-2.5 h-2.5 rounded-full inline-block" 
                                        style={{ backgroundColor: entry.color }}
                                      />
                                      {entry.name}:
                                    </span>
                                    <span className="font-semibold text-[#242424]">
                                      {entry.value}
                                    </span>
                                  </div>
                                ))}
                                {dataPoint && (
                                  <div className="mt-1.5 pt-1 border-t border-[#edebe9] flex items-center justify-between font-semibold text-[#107c10]">
                                    <span>Resolution Rate:</span>
                                    <span>{dataPoint.resolutionRate}%</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }}
                      iconSize={8}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Completed" 
                      name="Completed" 
                      stroke="#107c10" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorCompleted)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="In progress" 
                      name="In Progress" 
                      stroke="#d83b01" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorInProgress)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Open" 
                      name="Open (New)" 
                      stroke="#0078d4" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorOpen)" 
                    />
                  </AreaChart>
                ) : (
                  <LineChart
                    data={monthlyReferralsData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: '#605e5c', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#edebe9' }}
                    />
                    <YAxis 
                      allowDecimals={false}
                      tick={{ fill: '#605e5c', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#edebe9' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const dataPoint = monthlyReferralsData.find(d => d.month === label);
                          return (
                            <div className="bg-white border border-[#5eead4] shadow-md p-3 rounded text-xs">
                              <p className="font-bold text-[#242424] mb-1.5 border-b border-[#edebe9] pb-1">
                                {label} (Total: {dataPoint?.Total || 0} Referrals)
                              </p>
                              <div className="space-y-1">
                                {payload.map((entry, idx) => (
                                  <div key={idx} className="flex items-center justify-between gap-4">
                                    <span className="flex items-center gap-1.5 text-[#323130]">
                                      <span 
                                        className="w-2.5 h-2.5 rounded-full inline-block" 
                                        style={{ backgroundColor: entry.color }}
                                      />
                                      {entry.name}:
                                    </span>
                                    <span className="font-semibold text-[#242424]">
                                      {entry.value}
                                    </span>
                                  </div>
                                ))}
                                {dataPoint && (
                                  <div className="mt-1.5 pt-1 border-t border-[#edebe9] flex items-center justify-between font-semibold text-[#107c10]">
                                    <span>Resolution Rate:</span>
                                    <span>{dataPoint.resolutionRate}%</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }}
                      iconSize={8}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Total" 
                      name="Total Volume" 
                      stroke="#242424" 
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Completed" 
                      name="Completed" 
                      stroke="#107c10" 
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#107c10' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="In progress" 
                      name="In Progress" 
                      stroke="#d83b01" 
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#d83b01' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Open" 
                      name="Open (New)" 
                      stroke="#0078d4" 
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#0078d4' }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Referral Footnote */}
          <div className="mt-3 pt-2 border-t border-[#edebe9] flex items-center justify-between text-[11px] text-[#605e5c]">
            <span>Tracks timeline from Mosaic submission to key worker sign-off.</span>
            <span className="text-[#107c10] font-medium">{referralMetrics.resolutionRate}% Overall Resolution</span>
          </div>
        </div>
      </div>

      {/* Monthly Incident Types Cross-Tabular Breakdown Matrix */}
      <MonthlyIncidentsTable 
        monthlyData={monthlyIncidentsData as any}
        onNavigate={onNavigate}
      />

      {/* Duty Manager Operational Briefing & Action Checklist */}
      <div className="bg-[#fcfdfd] border border-[#d2d0ce] p-4 rounded-xs shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="w-4 h-4 text-[#0d9488]" />
          <h4 className="text-xs font-semibold text-[#242424] uppercase tracking-wider">
            Duty Manager Operational Briefing & Action Checklist
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#323130] mt-2">
          <div className="p-2.5 bg-white border border-[#e1dfdd] rounded-xs">
            <span className="font-semibold text-[#a4262c] block mb-1">
              1. Incident Priority Areas
            </span>
            <p className="text-[#605e5c] leading-relaxed">
              <strong className="text-[#242424]">{topIncidentCategory.name}</strong> accounts for {topIncidentCategory.percentage}% of logged escalations. Verify overnight security cover and clear access routes during regular audits.
            </p>
          </div>

          <div className="p-2.5 bg-white border border-[#e1dfdd] rounded-xs">
            <span className="font-semibold text-[#0d9488] block mb-1">
              2. Active Referrals Tracker
            </span>
            <p className="text-[#605e5c] leading-relaxed">
              There are currently <strong className="text-[#242424]">{referralMetrics.open} open referrals</strong> awaiting local authority key worker assignment. Schedule routine Mosaic portal follow-ups on day 5 post-submission.
            </p>
          </div>

          <div className="p-2.5 bg-white border border-[#e1dfdd] rounded-xs">
            <span className="font-semibold text-[#107c10] block mb-1">
              3. Case Completion Review
            </span>
            <p className="text-[#605e5c] leading-relaxed">
              Current case completion rate stands at <strong className="text-[#242424]">{referralMetrics.resolutionRate}%</strong>. Accommodations with ground-floor mobility adaptations show lower recurring support requests.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default DashboardAnalytics;
