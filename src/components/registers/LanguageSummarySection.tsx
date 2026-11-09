import React, { useMemo, useState } from 'react';
import { 
  IconLanguage as Languages, 
  IconWorld as Globe, 
  IconBuilding as Building, 
  IconTable as TableIcon, 
  IconChartBar as ChartBar,
  IconChartPie as PieIcon,
  IconUsers as Users
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
  YAxis 
} from 'recharts';
import { DailyRegisterRecord } from '../../types';

interface LanguageSummarySectionProps {
  records: DailyRegisterRecord[];
  selectedSite: string;
}

const TEAL = '#0d9488';
const BLUE = '#2563eb';
const PURPLE = '#8764b8';
const AMBER = '#d97706';
const EMERALD = '#059669';
const ROSE = '#e11d48';
const INDIGO = '#4f46e5';
const CYAN = '#0891b2';
const GREY = '#a19f9d';

const SLICE_COLORS = [TEAL, BLUE, PURPLE, AMBER, EMERALD, ROSE, INDIGO, CYAN, '#f59e0b', '#6366f1'];
const tooltipStyle = { fontSize: 12, borderRadius: 2, border: '1px solid #e1dfdd', boxShadow: 'none' } as const;

export const LanguageSummarySection: React.FC<LanguageSummarySectionProps> = ({
  records,
  selectedSite
}) => {
  const [activeMainSection, setActiveMainSection] = useState<'languages' | 'nationalities' | 'properties'>('languages');
  const [activeLangTab, setActiveLangTab] = useState<'normalized' | 'raw'>('normalized');
  const [propertyViewMode, setPropertyViewMode] = useState<'matrix' | 'chart'>('matrix');

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

      // Check if it's a compound language (e.g. "Arabic/English", "Kurdish / Farsi", "Pashto, Urdu")
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

  // Nationality Breakdown Computation
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

  // Per-Property Breakdown Computation
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
      const topNats = Object.entries(p.nationalities)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name, count]) => ({ name, count }));
      const topLangs = Object.entries(p.languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name, count]) => ({ name, count }));
      return {
        ...p,
        topNats,
        topLangs
      };
    }).sort((a, b) => b.totalGuests - a.totalGuests);
  }, [activeResidents]);

  // Chart slices for languages (top 6 + other)
  const langChartData = useMemo(() => {
    const list = activeLangTab === 'normalized' ? normalizedCounts : languageCounts;
    const top = list.slice(0, 6).map((item, idx) => ({
      name: item.language,
      value: item.count,
      color: SLICE_COLORS[idx % SLICE_COLORS.length]
    }));
    const otherSum = list.slice(6).reduce((acc, curr) => acc + curr.count, 0);
    if (otherSum > 0) {
      top.push({
        name: `Other (${list.length - 6})`,
        value: otherSum,
        color: GREY
      });
    }
    return top;
  }, [activeLangTab, normalizedCounts, languageCounts]);

  // Chart slices for nationalities (top 6 + other)
  const natChartData = useMemo(() => {
    const top = nationalityCounts.slice(0, 6).map((item, idx) => ({
      name: item.nationality,
      value: item.count,
      color: SLICE_COLORS[idx % SLICE_COLORS.length]
    }));
    const otherSum = nationalityCounts.slice(6).reduce((acc, curr) => acc + curr.count, 0);
    if (otherSum > 0) {
      top.push({
        name: `Other (${nationalityCounts.length - 6})`,
        value: otherSum,
        color: GREY
      });
    }
    return top;
  }, [nationalityCounts]);

  return (
    <div className="space-y-6">
      {/* Top Navigation Sub-Tabs */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-teal-50 text-[#0d9488] rounded-xs border border-teal-200">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#242424]">Demographics: Nationalities &amp; Languages</h2>
            <p className="text-xs text-[#605e5c]">
              Site: {selectedSite === 'all' ? 'All Properties' : selectedSite} · {totalChecked} active service users
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveMainSection('languages')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold transition-all cursor-pointer ${
              activeMainSection === 'languages'
                ? 'bg-[#0d9488] text-white shadow-2xs'
                : 'bg-[#faf9f8] hover:bg-[#f3f2f1] text-[#323130] border border-[#e1dfdd]'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>Language Summary</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-bold ml-0.5">
              {normalizedCounts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainSection('nationalities')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold transition-all cursor-pointer ${
              activeMainSection === 'nationalities'
                ? 'bg-[#0d9488] text-white shadow-2xs'
                : 'bg-[#faf9f8] hover:bg-[#f3f2f1] text-[#323130] border border-[#e1dfdd]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Nationality Summary</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-bold ml-0.5">
              {nationalityCounts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainSection('properties')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold transition-all cursor-pointer ${
              activeMainSection === 'properties'
                ? 'bg-[#0d9488] text-white shadow-2xs'
                : 'bg-[#faf9f8] hover:bg-[#f3f2f1] text-[#323130] border border-[#e1dfdd]'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Property Breakdown Matrix</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-bold ml-0.5">
              {propertyBreakdown.length}
            </span>
          </button>
        </div>
      </div>

      {/* ---------------- 1. LANGUAGE SUMMARY VIEW ---------------- */}
      {activeMainSection === 'languages' && (
        <div className="space-y-6">
          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#edebe9] mb-3">
                <span className="text-xs font-bold text-[#242424] flex items-center gap-1.5">
                  <PieIcon className="w-3.5 h-3.5 text-[#0d9488]" />
                  <span>Language Distribution (Top Dialects)</span>
                </span>
                <span className="text-[11px] text-[#605e5c]">
                  {normalizedCounts.length} distinct languages
                </span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={langChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={langChartData.length > 1 ? 2 : 0}
                    >
                      {langChartData.map((s, idx) => (
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
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                {langChartData.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-[11px] truncate">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <strong className="font-semibold tabular-nums ml-1">{s.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#edebe9] mb-3">
                <span className="text-xs font-bold text-[#242424] flex items-center gap-1.5">
                  <ChartBar className="w-3.5 h-3.5 text-[#0078d4]" />
                  <span>Language Speaker Headcount</span>
                </span>
                <span className="text-[11px] text-[#605e5c]">Normalized count</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={langChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edebe9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#605e5c' }} angle={-25} textAnchor="end" interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#605e5c' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {langChartData.map((s, idx) => (
                        <Cell key={`bar-${s.name}-${idx}`} fill={s.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Language Breakdown Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#edebe9] pb-3 gap-3">
                <div className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-[#0d9488]" />
                  <h2 className="text-sm font-semibold text-[#242424]">Language Frequency Table</h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex bg-[#faf9f8] p-0.5 border border-[#edebe9] rounded text-xs">
                    <button
                      onClick={() => setActiveLangTab('normalized')}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        activeLangTab === 'normalized'
                          ? 'bg-white text-[#242424] font-semibold shadow-xs'
                          : 'text-[#605e5c] hover:text-[#242424]'
                      }`}
                    >
                      Normalized ({normalizedCounts.length})
                    </button>
                    <button
                      onClick={() => setActiveLangTab('raw')}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        activeLangTab === 'raw'
                          ? 'bg-white text-[#242424] font-semibold shadow-xs'
                          : 'text-[#605e5c] hover:text-[#242424]'
                      }`}
                    >
                      Raw Entries ({languageCounts.length})
                    </button>
                  </div>
                </div>
              </div>

              {((activeLangTab === 'normalized' ? normalizedCounts : languageCounts).length === 0 && blankCount === 0) ? (
                <div className="py-12 text-center text-[#605e5c]">
                  <Languages className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                  <p className="font-semibold text-sm text-[#242424]">No language records available</p>
                  <p className="text-xs text-[#605e5c] mt-0.5">Language values recorded in the Daily Register will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold">
                        <th className="p-2.5">
                          {activeLangTab === 'normalized' ? 'Individual Language / Dialect' : 'Raw Recorded Entry'}
                        </th>
                        <th className="p-2.5 text-right">Service Users</th>
                        <th className="p-2.5 text-right w-24">Percentage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edebe9] text-[#323130]">
                      {(activeLangTab === 'normalized' ? normalizedCounts : languageCounts).map(item => (
                        <tr key={item.language} className="hover:bg-[#faf9f8] transition-colors">
                          <td className="p-2.5 font-medium text-[#242424]">{item.language}</td>
                          <td className="p-2.5 text-right font-semibold text-[#0d9488]">{item.count}</td>
                          <td className="p-2.5 text-right text-[#605e5c]">{item.pct}%</td>
                        </tr>
                      ))}
                      {blankCount > 0 && (
                        <tr className="bg-amber-50/50">
                          <td className="p-2.5 italic text-amber-900 font-medium">Unspecified / Blank</td>
                          <td className="p-2.5 text-right font-semibold text-amber-900">{blankCount}</td>
                          <td className="p-2.5 text-right text-amber-800">
                            {totalChecked > 0 ? ((blankCount / totalChecked) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-5 space-y-4">
              <div className="border-b border-[#edebe9] pb-3">
                <h3 className="text-sm font-semibold text-[#242424]">Multi-Language Combinations</h3>
                <p className="text-xs text-[#605e5c] mt-0.5">Preserved original multi-lingual entries</p>
              </div>

              {compoundLanguages.length === 0 ? (
                <p className="text-xs text-[#605e5c] py-6 text-center">No compound language entries found.</p>
              ) : (
                <div className="space-y-3">
                  {compoundLanguages.map(c => (
                    <div key={c.raw} className="p-3 bg-[#faf9f8] border border-[#edebe9] rounded text-xs space-y-1">
                      <div className="flex items-center justify-between font-medium text-[#242424]">
                        <span>{c.raw}</span>
                        <span className="font-semibold text-[#0d9488]">{c.count} SU</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.subLanguages.map(sub => (
                          <span key={sub} className="bg-white border border-[#8a8886]/40 px-1.5 py-0.5 rounded text-[10px] text-[#4338ca]">
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

      {/* ---------------- 2. NATIONALITY SUMMARY VIEW ---------------- */}
      {activeMainSection === 'nationalities' && (
        <div className="space-y-6">
          {/* Nationality KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-[#605e5c] uppercase">Recorded Nationalities</span>
              <div className="text-2xl font-bold text-[#242424] mt-1">{nationalityCounts.length} Countries</div>
              <p className="text-[10px] text-[#605e5c] mt-0.5">Origin diversity across active residents</p>
            </div>
            <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-[#605e5c] uppercase">Leading Origin Nation</span>
              <div className="text-2xl font-bold text-[#0d9488] mt-1">
                {nationalityCounts[0]?.nationality || 'None'}
              </div>
              <p className="text-[10px] text-[#605e5c] mt-0.5">
                {nationalityCounts[0] ? `${nationalityCounts[0].count} SUs (${nationalityCounts[0].pct}%)` : 'No data'}
              </p>
            </div>
            <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-[#605e5c] uppercase">Documentation Rate</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {totalChecked > 0 ? Math.round(((totalChecked - blankNationalityCount) / totalChecked) * 100) : 0}%
              </div>
              <p className="text-[10px] text-[#605e5c] mt-0.5">{totalChecked - blankNationalityCount} of {totalChecked} documented</p>
            </div>
          </div>

          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#edebe9] mb-3">
                <span className="text-xs font-bold text-[#242424] flex items-center gap-1.5">
                  <PieIcon className="w-3.5 h-3.5 text-[#0d9488]" />
                  <span>Nationality Distribution (Top Countries)</span>
                </span>
                <span className="text-[11px] text-[#605e5c]">{nationalityCounts.length} total</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={natChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={natChartData.length > 1 ? 2 : 0}
                    >
                      {natChartData.map((s, idx) => (
                        <Cell key={`nat-pie-${s.name}-${idx}`} fill={s.color} />
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
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                {natChartData.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-[11px] truncate">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <strong className="font-semibold tabular-nums ml-1">{s.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#edebe9] mb-3">
                <span className="text-xs font-bold text-[#242424] flex items-center gap-1.5">
                  <ChartBar className="w-3.5 h-3.5 text-[#2563eb]" />
                  <span>Nationalities Frequency</span>
                </span>
                <span className="text-[11px] text-[#605e5c]">By Headcount</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={natChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edebe9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#605e5c' }} angle={-25} textAnchor="end" interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#605e5c' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {natChartData.map((s, idx) => (
                        <Cell key={`nat-bar-${s.name}-${idx}`} fill={s.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Nationality Frequency Table */}
          <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#edebe9] pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424]">Complete Nationality Frequency Table</h3>
              </div>
              <span className="text-xs text-[#605e5c]">
                {nationalityCounts.length} Countries Listed
              </span>
            </div>

            {nationalityCounts.length === 0 && blankNationalityCount === 0 ? (
              <div className="py-12 text-center text-[#605e5c]">
                <Globe className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                <p className="font-semibold text-sm text-[#242424]">No nationality records recorded</p>
                <p className="text-xs text-[#605e5c] mt-0.5">Nationality data recorded in the register will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold">
                      <th className="p-2.5">Nationality / Country of Origin</th>
                      <th className="p-2.5 text-right">Service Users</th>
                      <th className="p-2.5 text-right w-24">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edebe9] text-[#323130]">
                    {nationalityCounts.map(item => (
                      <tr key={item.nationality} className="hover:bg-[#faf9f8] transition-colors">
                        <td className="p-2.5 font-medium text-[#242424]">{item.nationality}</td>
                        <td className="p-2.5 text-right font-semibold text-[#0d9488]">{item.count}</td>
                        <td className="p-2.5 text-right text-[#605e5c]">{item.pct}%</td>
                      </tr>
                    ))}
                    {blankNationalityCount > 0 && (
                      <tr className="bg-amber-50/50">
                        <td className="p-2.5 italic text-amber-900 font-medium">Unspecified / Blank</td>
                        <td className="p-2.5 text-right font-semibold text-amber-900">{blankNationalityCount}</td>
                        <td className="p-2.5 text-right text-amber-800">
                          {totalChecked > 0 ? ((blankNationalityCount / totalChecked) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- 3. PROPERTY BREAKDOWN MATRIX VIEW ---------------- */}
      {activeMainSection === 'properties' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#edebe9] pb-3 gap-2">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424]">
                  Property Demographics Matrix (Nationalities &amp; Languages by Property)
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
                  <ChartBar className="w-3.5 h-3.5 text-[#0078d4]" />
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
                      <th className="p-2.5">Property / Hotel</th>
                      <th className="p-2.5 text-center">Total Residents</th>
                      <th className="p-2.5">Top Nationalities</th>
                      <th className="p-2.5">Top Spoken Languages</th>
                      <th className="p-2.5 text-right">Population Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edebe9] text-[#323130]">
                    {propertyBreakdown.map(p => (
                      <tr key={p.hotel} className="hover:bg-[#faf9f8] transition-colors">
                        <td className="p-2.5 font-semibold text-[#242424]">
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{p.hotel}</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="font-bold text-[#0d9488] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {p.totalGuests} SUs
                          </span>
                        </td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1">
                            {p.topNats.length > 0 ? (
                              p.topNats.map(nat => (
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
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1">
                            {p.topLangs.length > 0 ? (
                              p.topLangs.map(lang => (
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
                        <td className="p-2.5 text-right font-medium text-neutral-600">
                          {totalChecked > 0 ? ((p.totalGuests / totalChecked) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white border border-[#edebe9] rounded-xs p-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={propertyBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edebe9" />
                    <XAxis dataKey="hotel" tick={{ fontSize: 10, fill: '#605e5c' }} angle={-25} textAnchor="end" interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#605e5c' }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: any, _name: any, item: any) => [
                        `${val} guests · Leading nationality: ${item?.payload?.topNats?.[0]?.name || 'N/A'} · Leading language: ${item?.payload?.topLangs?.[0]?.name || 'N/A'}`,
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
