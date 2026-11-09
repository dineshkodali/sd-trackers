import React, { useMemo, useState } from 'react';
import { 
  IconLanguage as Languages, 
  IconWorld as Globe, 
  IconBuilding as Building, 
  IconTable as TableIcon, 
  IconChartBar as BarIcon, 
  IconChartPie as PieIcon,
  IconChartArea as AreaIcon,
  IconSearch as Search
} from '@tabler/icons-react';
import { 
  Bar, 
  BarChart, 
  CartesianGrid, 
  Cell, 
  Pie, 
  PieChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis,
  Area,
  AreaChart
} from 'recharts';
import { DailyRegisterRecord } from '../../types';

interface LanguageSummarySectionProps {
  records: DailyRegisterRecord[];
  selectedSite: string;
}

type ChartModel = 'donut' | 'bar' | 'area';

const TEAL = '#0d9488';
const BLUE = '#2563eb';
const PURPLE = '#8764b8';
const AMBER = '#d97706';
const EMERALD = '#059669';
const ROSE = '#e11d48';
const INDIGO = '#4f46e5';
const CYAN = '#0891b2';
const GREY = '#a19f9d';

const SLICE_COLORS = [TEAL, BLUE, PURPLE, AMBER, EMERALD, ROSE, INDIGO, CYAN, '#f59e0b', '#6366f1', '#14b8a6', '#ec4899', '#8b5cf6'];
const tooltipStyle = { fontSize: 12, borderRadius: 2, border: '1px solid #e1dfdd', boxShadow: 'none' } as const;

export const LanguageSummarySection: React.FC<LanguageSummarySectionProps> = ({
  records,
  selectedSite
}) => {
  const [activeMainSection, setActiveMainSection] = useState<'languages' | 'nationalities' | 'properties'>('languages');
  const [activeLangTab, setActiveLangTab] = useState<'normalized' | 'raw'>('normalized');
  const [propertyViewMode, setPropertyViewMode] = useState<'matrix' | 'chart'>('matrix');
  const [langChartModel, setLangChartModel] = useState<ChartModel>('donut');
  const [natChartModel, setNatChartModel] = useState<ChartModel>('donut');
  const [searchLangText, setSearchLangText] = useState('');
  const [searchNatText, setSearchNatText] = useState('');

  const activeResidents = useMemo(() => {
    return records.filter(r => r.occupied === 'Yes' || !r.occupied);
  }, [records]);

  const totalChecked = activeResidents.length;

  // Language Breakdown Computation
  const { languageCounts, normalizedCounts, compoundLanguages, blankCount } = useMemo(() => {
    const rawCounts: Record<string, number> = {};
    const normCounts: Record<string, number> = {};
    let blanks = 0;
    const compounds: { raw: string; subLanguages: string[]; count: number }[] = [];
    const compoundMap = new Map<string, number>();

    activeResidents.forEach(r => {
      const raw = (r.language || '').trim();
      if (!raw) {
        blanks++;
        return;
      }

      rawCounts[raw] = (rawCounts[raw] || 0) + 1;

      // Split compound language entries
      if (raw.includes('/') || raw.includes(',') || raw.toLowerCase().includes(' and ')) {
        compoundMap.set(raw, (compoundMap.get(raw) || 0) + 1);
        const subLangs = raw.split(/[\/,]| and /i).map(s => s.trim()).filter(Boolean);
        subLangs.forEach(sub => {
          normCounts[sub] = (normCounts[sub] || 0) + 1;
        });
      } else {
        normCounts[raw] = (normCounts[raw] || 0) + 1;
      }
    });

    compoundMap.forEach((count, raw) => {
      compounds.push({
        raw,
        subLanguages: raw.split(/[\/,]| and /i).map(s => s.trim()).filter(Boolean),
        count
      });
    });

    const sortedRaw = Object.entries(rawCounts).map(([lang, count]) => ({
      language: lang,
      count,
      pct: totalChecked > 0 ? ((count / totalChecked) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.count - a.count);

    const sortedNorm = Object.entries(normCounts).map(([lang, count]) => ({
      language: lang,
      count,
      pct: totalChecked > 0 ? ((count / totalChecked) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.count - a.count);

    return {
      languageCounts: sortedRaw,
      normalizedCounts: sortedNorm,
      compoundLanguages: compounds,
      blankCount: blanks
    };
  }, [activeResidents, totalChecked]);

  // Nationality Breakdown Computation (ALL Nationalities)
  const { nationalityCounts, blankNationalityCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    let blanks = 0;

    activeResidents.forEach(r => {
      const nat = (r.nationality || '').trim();
      if (!nat) {
        blanks++;
        return;
      }
      counts[nat] = (counts[nat] || 0) + 1;
    });

    const sorted = Object.entries(counts).map(([nationality, count]) => ({
      nationality,
      count,
      pct: totalChecked > 0 ? ((count / totalChecked) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.count - a.count);

    return {
      nationalityCounts: sorted,
      blankNationalityCount: blanks
    };
  }, [activeResidents, totalChecked]);

  // Per-Property Breakdown Computation (ALL Nationalities and Languages per property)
  const propertyBreakdown = useMemo(() => {
    const propMap = new Map<string, {
      hotel: string;
      totalGuests: number;
      nationalities: Record<string, number>;
      languages: Record<string, number>;
    }>();

    activeResidents.forEach(r => {
      const hotel = (r.hotel || '').trim() || 'Unassigned Property';
      const nat = (r.nationality || '').trim() || 'Unspecified';
      const lang = (r.language || '').trim() || 'Unspecified';

      if (!propMap.has(hotel)) {
        propMap.set(hotel, {
          hotel,
          totalGuests: 0,
          nationalities: {},
          languages: {}
        });
      }
      const p = propMap.get(hotel)!;
      p.totalGuests++;
      p.nationalities[nat] = (p.nationalities[nat] || 0) + 1;
      p.languages[lang] = (p.languages[lang] || 0) + 1;
    });

    return Array.from(propMap.values()).map(p => {
      const allNats = Object.entries(p.nationalities)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));
      const allLangs = Object.entries(p.languages)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));
      return {
        ...p,
        allNats,
        allLangs
      };
    }).sort((a, b) => b.totalGuests - a.totalGuests);
  }, [activeResidents]);

  // Chart slices for languages (ALL languages)
  const langChartData = useMemo(() => {
    const list = activeLangTab === 'normalized' ? normalizedCounts : languageCounts;
    return list.map((item, idx) => ({
      name: item.language,
      value: item.count,
      color: SLICE_COLORS[idx % SLICE_COLORS.length]
    }));
  }, [activeLangTab, normalizedCounts, languageCounts]);

  // Chart slices for nationalities (ALL nationalities)
  const natChartData = useMemo(() => {
    return nationalityCounts.map((item, idx) => ({
      name: item.nationality,
      value: item.count,
      color: SLICE_COLORS[idx % SLICE_COLORS.length]
    }));
  }, [nationalityCounts]);

  // Filtered lists for table search
  const filteredLangTable = useMemo(() => {
    const list = activeLangTab === 'normalized' ? normalizedCounts : languageCounts;
    if (!searchLangText) return list;
    const q = searchLangText.toLowerCase();
    return list.filter(item => item.language.toLowerCase().includes(q));
  }, [activeLangTab, normalizedCounts, languageCounts, searchLangText]);

  const filteredNatTable = useMemo(() => {
    if (!searchNatText) return nationalityCounts;
    const q = searchNatText.toLowerCase();
    return nationalityCounts.filter(item => item.nationality.toLowerCase().includes(q));
  }, [nationalityCounts, searchNatText]);

  // Reusable multi-model chart renderer
  const renderChart = (data: Array<{ name: string; value: number; color: string }>, model: ChartModel, label: string) => {
    if (data.length === 0) {
      return (
        <div className="h-52 flex items-center justify-center text-xs text-neutral-400">
          No records recorded
        </div>
      );
    }

    if (model === 'donut') {
      return (
        <div className="h-52" role="img" aria-label={label}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={data.length > 1 ? 2 : 0}
              >
                {data.map((s, idx) => (
                  <Cell key={`slice-${s.name}-${idx}`} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any, n: any) => [
                  `${v} (${totalChecked ? Math.round((Number(v) / totalChecked) * 100) : 0}%)`,
                  n
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (model === 'bar') {
      return (
        <div className="h-52" role="img" aria-label={label}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 20)} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edebe9" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#605e5c' }} angle={-25} textAnchor="end" interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#605e5c' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {data.slice(0, 20).map((s, idx) => (
                  <Cell key={`bar-${s.name}-${idx}`} fill={s.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Area Curve Chart
    return (
      <div className="h-52" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.slice(0, 20)} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
            <defs>
              <linearGradient id={`grad-area-${label.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={TEAL} stopOpacity={0.4} />
                <stop offset="95%" stopColor={TEAL} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edebe9" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#605e5c' }} angle={-25} textAnchor="end" interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#605e5c' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="value" stroke={TEAL} strokeWidth={2} fillOpacity={1} fill={`url(#grad-area-${label.replace(/\s+/g, '')})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Navigation Sub-Tabs */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs p-2.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-50 text-[#0d9488] rounded-xs border border-teal-200">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#242424]">Demographics: Nationalities &amp; Languages</h2>
            <p className="text-[11px] text-[#605e5c]">
              Site: {selectedSite === 'all' ? 'All Properties' : selectedSite} · {totalChecked} active residents
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveMainSection('languages')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs text-xs font-semibold transition-all cursor-pointer ${
              activeMainSection === 'languages'
                ? 'bg-[#0d9488] text-white shadow-2xs'
                : 'bg-[#faf9f8] hover:bg-[#f3f2f1] text-[#323130] border border-[#e1dfdd]'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>All Languages ({normalizedCounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainSection('nationalities')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs text-xs font-semibold transition-all cursor-pointer ${
              activeMainSection === 'nationalities'
                ? 'bg-[#0d9488] text-white shadow-2xs'
                : 'bg-[#faf9f8] hover:bg-[#f3f2f1] text-[#323130] border border-[#e1dfdd]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>All Nationalities ({nationalityCounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainSection('properties')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs text-xs font-semibold transition-all cursor-pointer ${
              activeMainSection === 'properties'
                ? 'bg-[#0d9488] text-white shadow-2xs'
                : 'bg-[#faf9f8] hover:bg-[#f3f2f1] text-[#323130] border border-[#e1dfdd]'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Property Matrix ({propertyBreakdown.length})</span>
          </button>
        </div>
      </div>

      {/* ---------------- 1. ALL LANGUAGES SUMMARY VIEW ---------------- */}
      {activeMainSection === 'languages' && (
        <div className="space-y-4">
          {/* Interactive Chart with Graph Model Switcher */}
          <div className="bg-white border border-[#e1dfdd] rounded-xs p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#edebe9]">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-[#0d9488]" />
                <span className="text-xs font-bold text-[#242424]">
                  All Spoken Languages Chart ({langChartData.length} Spoken Languages)
                </span>
              </div>
              <div className="flex items-center gap-0.5 bg-[#f8fafc] p-0.5 border border-[#e2e8f0] rounded">
                <button
                  type="button"
                  onClick={() => setLangChartModel('donut')}
                  className={`p-1 rounded cursor-pointer transition-colors ${langChartModel === 'donut' ? 'bg-white shadow-2xs text-[#0d9488]' : 'text-neutral-400 hover:text-neutral-700'}`}
                  title="Donut / Pie Chart"
                >
                  <PieIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLangChartModel('bar')}
                  className={`p-1 rounded cursor-pointer transition-colors ${langChartModel === 'bar' ? 'bg-white shadow-2xs text-[#0d9488]' : 'text-neutral-400 hover:text-neutral-700'}`}
                  title="Bar Chart"
                >
                  <BarIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLangChartModel('area')}
                  className={`p-1 rounded cursor-pointer transition-colors ${langChartModel === 'area' ? 'bg-white shadow-2xs text-[#0d9488]' : 'text-neutral-400 hover:text-neutral-700'}`}
                  title="Area Curve Chart"
                >
                  <AreaIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {renderChart(langChartData, langChartModel, 'Languages')}
          </div>

          {/* Complete Language Breakdown Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white border border-[#e1dfdd] rounded-xs shadow-2xs p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#edebe9] pb-2.5 gap-2.5">
                <div className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-[#0d9488]" />
                  <h3 className="text-xs font-bold text-[#242424]">All Recorded Languages ({filteredLangTable.length})</h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="w-3 h-3 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search languages..."
                      value={searchLangText}
                      onChange={e => setSearchLangText(e.target.value)}
                      className="pl-6 pr-5 py-0.5 text-xs bg-[#fbfbfa] border border-[#e5e5e5] rounded text-neutral-700 focus:bg-white focus:border-[#0d9488] outline-hidden w-40"
                    />
                    {searchLangText && (
                      <button
                        type="button"
                        onClick={() => setSearchLangText('')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="inline-flex bg-[#faf9f8] p-0.5 border border-[#edebe9] rounded text-xs">
                    <button
                      onClick={() => setActiveLangTab('normalized')}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        activeLangTab === 'normalized'
                          ? 'bg-white text-[#242424] font-semibold shadow-xs'
                          : 'text-[#605e5c] hover:text-[#242424]'
                      }`}
                    >
                      Normalized ({normalizedCounts.length})
                    </button>
                    <button
                      onClick={() => setActiveLangTab('raw')}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        activeLangTab === 'raw'
                          ? 'bg-white text-[#242424] font-semibold shadow-xs'
                          : 'text-[#605e5c] hover:text-[#242424]'
                      }`}
                    >
                      Raw ({languageCounts.length})
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#faf9f8] shadow-2xs">
                    <tr className="border-b border-[#edebe9] text-[#605e5c] font-semibold">
                      <th className="p-2">Language / Dialect</th>
                      <th className="p-2 text-right">Service Users</th>
                      <th className="p-2 text-right w-24">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edebe9] text-[#323130]">
                    {filteredLangTable.map(item => (
                      <tr key={item.language} className="hover:bg-[#faf9f8] transition-colors">
                        <td className="p-2 font-medium text-[#242424]">{item.language}</td>
                        <td className="p-2 text-right font-semibold text-[#0d9488]">{item.count}</td>
                        <td className="p-2 text-right text-[#605e5c]">{item.pct}%</td>
                      </tr>
                    ))}
                    {blankCount > 0 && !searchLangText && (
                      <tr className="bg-amber-50/50">
                        <td className="p-2 italic text-amber-900 font-medium">Unspecified / Blank</td>
                        <td className="p-2 text-right font-semibold text-amber-900">{blankCount}</td>
                        <td className="p-2 text-right text-amber-800">
                          {totalChecked > 0 ? ((blankCount / totalChecked) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-2xs p-4 space-y-3">
              <div className="border-b border-[#edebe9] pb-2">
                <h3 className="text-xs font-bold text-[#242424]">Multi-Language Combinations</h3>
                <p className="text-[10px] text-[#605e5c]">Preserved compound language entries</p>
              </div>

              {compoundLanguages.length === 0 ? (
                <p className="text-xs text-[#605e5c] py-6 text-center">No compound language entries found.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {compoundLanguages.map(c => (
                    <div key={c.raw} className="p-2.5 bg-[#faf9f8] border border-[#edebe9] rounded text-xs space-y-1">
                      <div className="flex items-center justify-between font-medium text-[#242424]">
                        <span>{c.raw}</span>
                        <span className="font-semibold text-[#0d9488]">{c.count} SU</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.subLanguages.map(sub => (
                          <span key={sub} className="bg-white border border-[#8a8886]/40 px-1.5 py-0.2 rounded text-[10px] text-[#4338ca]">
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 2. ALL NATIONALITIES SUMMARY VIEW ---------------- */}
      {activeMainSection === 'nationalities' && (
        <div className="space-y-4">
          {/* Nationality KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-[#e1dfdd] rounded-xs p-3 shadow-2xs">
              <span className="text-[10px] font-semibold text-[#605e5c] uppercase">Total Nationalities</span>
              <div className="text-xl font-bold text-[#242424] mt-0.5">{nationalityCounts.length} Countries</div>
              <p className="text-[10px] text-[#605e5c]">Origin diversity recorded</p>
            </div>
            <div className="bg-white border border-[#e1dfdd] rounded-xs p-3 shadow-2xs">
              <span className="text-[10px] font-semibold text-[#605e5c] uppercase">Leading Origin Nation</span>
              <div className="text-xl font-bold text-[#0d9488] mt-0.5">
                {nationalityCounts[0]?.nationality || 'None'}
              </div>
              <p className="text-[10px] text-[#605e5c]">
                {nationalityCounts[0] ? `${nationalityCounts[0].count} SUs (${nationalityCounts[0].pct}%)` : 'No data'}
              </p>
            </div>
            <div className="bg-white border border-[#e1dfdd] rounded-xs p-3 shadow-2xs">
              <span className="text-[10px] font-semibold text-[#605e5c] uppercase">Documented Rate</span>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">
                {totalChecked > 0 ? Math.round(((totalChecked - blankNationalityCount) / totalChecked) * 100) : 0}%
              </div>
              <p className="text-[10px] text-[#605e5c]">{totalChecked - blankNationalityCount} of {totalChecked} documented</p>
            </div>
          </div>

          {/* Interactive Chart with Graph Model Switcher */}
          <div className="bg-white border border-[#e1dfdd] rounded-xs p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#edebe9]">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#0d9488]" />
                <span className="text-xs font-bold text-[#242424]">
                  All Nationalities Chart ({natChartData.length} Countries)
                </span>
              </div>
              <div className="flex items-center gap-0.5 bg-[#f8fafc] p-0.5 border border-[#e2e8f0] rounded">
                <button
                  type="button"
                  onClick={() => setNatChartModel('donut')}
                  className={`p-1 rounded cursor-pointer transition-colors ${natChartModel === 'donut' ? 'bg-white shadow-2xs text-[#0d9488]' : 'text-neutral-400 hover:text-neutral-700'}`}
                  title="Donut / Pie Chart"
                >
                  <PieIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setNatChartModel('bar')}
                  className={`p-1 rounded cursor-pointer transition-colors ${natChartModel === 'bar' ? 'bg-white shadow-2xs text-[#0d9488]' : 'text-neutral-400 hover:text-neutral-700'}`}
                  title="Bar Chart"
                >
                  <BarIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setNatChartModel('area')}
                  className={`p-1 rounded cursor-pointer transition-colors ${natChartModel === 'area' ? 'bg-white shadow-2xs text-[#0d9488]' : 'text-neutral-400 hover:text-neutral-700'}`}
                  title="Area Curve Chart"
                >
                  <AreaIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {renderChart(natChartData, natChartModel, 'Nationalities')}
          </div>

          {/* Complete Nationality Frequency Table */}
          <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-2xs p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#edebe9] pb-2.5">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-xs font-bold text-[#242424]">All Recorded Nationalities ({filteredNatTable.length})</h3>
              </div>
              <div className="relative">
                <Search className="w-3 h-3 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={searchNatText}
                  onChange={e => setSearchNatText(e.target.value)}
                  className="pl-6 pr-5 py-0.5 text-xs bg-[#fbfbfa] border border-[#e5e5e5] rounded text-neutral-700 focus:bg-white focus:border-[#0d9488] outline-hidden w-44"
                />
                {searchNatText && (
                  <button
                    type="button"
                    onClick={() => setSearchNatText('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#faf9f8] shadow-2xs">
                  <tr className="border-b border-[#edebe9] text-[#605e5c] font-semibold">
                    <th className="p-2">Nationality / Country of Origin</th>
                    <th className="p-2 text-right">Service Users</th>
                    <th className="p-2 text-right w-24">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edebe9] text-[#323130]">
                  {filteredNatTable.map(item => (
                    <tr key={item.nationality} className="hover:bg-[#faf9f8] transition-colors">
                      <td className="p-2 font-medium text-[#242424]">{item.nationality}</td>
                      <td className="p-2 text-right font-semibold text-[#0d9488]">{item.count}</td>
                      <td className="p-2 text-right text-[#605e5c]">{item.pct}%</td>
                    </tr>
                  ))}
                  {blankNationalityCount > 0 && !searchNatText && (
                    <tr className="bg-amber-50/50">
                      <td className="p-2 italic text-amber-900 font-medium">Unspecified / Blank</td>
                      <td className="p-2 text-right font-semibold text-amber-900">{blankNationalityCount}</td>
                      <td className="p-2 text-right text-amber-800">
                        {totalChecked > 0 ? ((blankNationalityCount / totalChecked) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 3. PROPERTY BREAKDOWN MATRIX VIEW ---------------- */}
      {activeMainSection === 'properties' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-2xs p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#edebe9] pb-2.5 gap-2">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-xs font-bold text-[#242424]">
                  Property Demographics Matrix (All Nationalities &amp; Languages by Property)
                </h3>
              </div>
              <div className="inline-flex bg-[#faf9f8] p-0.5 border border-[#edebe9] rounded text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setPropertyViewMode('matrix')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    propertyViewMode === 'matrix'
                      ? 'bg-white text-[#242424] font-semibold shadow-xs'
                      : 'text-[#605e5c] hover:text-[#242424]'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5 text-[#0d9488]" />
                  <span>Table Matrix</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPropertyViewMode('chart')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    propertyViewMode === 'chart'
                      ? 'bg-white text-[#242424] font-semibold shadow-xs'
                      : 'text-[#605e5c] hover:text-[#242424]'
                  }`}
                >
                  <BarIcon className="w-3.5 h-3.5 text-[#0078d4]" />
                  <span>Comparison Chart</span>
                </button>
              </div>
            </div>

            {propertyBreakdown.length === 0 ? (
              <p className="text-xs text-[#605e5c] py-6 text-center">
                No property data available.
              </p>
            ) : propertyViewMode === 'matrix' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold">
                      <th className="p-2">Property / Hotel</th>
                      <th className="p-2 text-center">Total Residents</th>
                      <th className="p-2">All Nationalities</th>
                      <th className="p-2">All Spoken Languages</th>
                      <th className="p-2 text-right">Population Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edebe9] text-[#323130]">
                    {propertyBreakdown.map(p => (
                      <tr key={p.hotel} className="hover:bg-[#faf9f8] transition-colors">
                        <td className="p-2 font-semibold text-[#242424]">
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{p.hotel}</span>
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <span className="font-bold text-[#0d9488] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {p.totalGuests} SUs
                          </span>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1 max-w-lg">
                            {p.allNats.length > 0 ? (
                              p.allNats.map(nat => (
                                <span
                                  key={nat.name}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-800 border border-blue-200"
                                >
                                  <span>{nat.name}</span>
                                  <strong className="text-blue-900">({nat.count})</strong>
                                </span>
                              ))
                            ) : (
                              <span className="text-neutral-400 italic text-[11px]">Unrecorded</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1 max-w-lg">
                            {p.allLangs.length > 0 ? (
                              p.allLangs.map(lang => (
                                <span
                                  key={lang.name}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-800 border border-teal-200"
                                >
                                  <span>{lang.name}</span>
                                  <strong className="text-teal-900">({lang.count})</strong>
                                </span>
                              ))
                            ) : (
                              <span className="text-neutral-400 italic text-[11px]">Unrecorded</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-right font-medium text-neutral-600">
                          {totalChecked > 0 ? ((p.totalGuests / totalChecked) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white border border-[#edebe9] rounded-xs p-3.5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={propertyBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edebe9" />
                    <XAxis dataKey="hotel" tick={{ fontSize: 10, fill: '#605e5c' }} angle={-25} textAnchor="end" interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#605e5c' }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: any, _name: any, item: any) => [
                        `${val} guests · Nationalities: ${item?.payload?.allNats?.length || 0} · Languages: ${item?.payload?.allLangs?.length || 0}`,
                        item?.payload?.hotel
                      ]}
                    />
                    <Bar dataKey="totalGuests" fill={TEAL} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
