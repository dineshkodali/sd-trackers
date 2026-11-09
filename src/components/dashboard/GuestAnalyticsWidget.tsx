import React, { useMemo, useState } from 'react';
import { 
  IconUsers as Users, 
  IconArrowUpRight as ArrowUpRight, 
  IconRefresh as RefreshCw,
  IconWorld as Globe,
  IconLanguage as Languages,
  IconBuilding as Building,
  IconTable as TableIcon,
  IconChartBar as ChartBar
} from '@tabler/icons-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../../context/AppContext';
import { useGuestContext } from '../../hooks/useGuestContext';
import {
  FAMILY_BUCKETS, NO_GUEST_FILTER, buildGuests, computeGuestStats, saveRegisterFilterIntent,
  type GuestFilter,
} from '../../utils/guestStats';

interface Props {
  /** The Dashboard's or Parent's site filter, so these figures follow it. */
  siteFilter: string;
  onNavigate?: (page: string) => void;
  onSelectFilter?: (filter: Partial<GuestFilter>) => void;
  date?: string;
  onDateChange?: (date: string) => void;
}

interface Slice { id: string; label: string; value: number; color: string; filter: Partial<GuestFilter>; note?: string }

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

const today = () => new Date().toISOString().slice(0, 10);

const ChartCard: React.FC<{ title: string; total: number; children: React.ReactNode }> = ({ title, total, children }) => (
  <section className="bg-white border border-[#e1dfdd] rounded-xs p-3.5" aria-label={title}>
    <div className="flex items-baseline justify-between mb-2">
      <h4 className="text-xs font-semibold text-[#242424]">{title}</h4>
      <span className="text-[11px] text-[#605e5c]">{total} total</span>
    </div>
    {children}
  </section>
);

/** Clickable list under each chart: the keyboard and screen-reader route to the same drill-through. */
const Legend: React.FC<{ slices: Slice[]; onPick: (s: Slice) => void }> = ({ slices, onPick }) => (
  <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
    {slices.map(s => (
      <li key={s.id}>
        <button
          type="button"
          onClick={() => onPick(s)}
          className="w-full flex items-center justify-between gap-2 text-[11px] text-[#323130] hover:text-[#0f766e] cursor-pointer"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} aria-hidden="true" />
            <span className="truncate">{s.label}</span>
          </span>
          <span className="font-semibold tabular-nums">{s.value}</span>
        </button>
      </li>
    ))}
  </ul>
);

const tooltipStyle = { fontSize: 12, borderRadius: 2, border: '1px solid #e1dfdd', boxShadow: 'none' } as const;

export const GuestAnalyticsWidget: React.FC<Props> = ({ 
  siteFilter, 
  onNavigate,
  onSelectFilter,
  date: dateProp,
  onDateChange
}) => {
  const { dailyRegisterRecords, isSitePermitted, liveDataStatus } = useApp();
  const { ctx, loading: familiesLoading, error: familyError, reload } = useGuestContext();
  const [internalDate, setInternalDate] = useState<string>(today);
  const [demographicView, setDemographicView] = useState<'matrix' | 'chart'>('matrix');

  const date = dateProp ?? internalDate;
  const setDate = onDateChange ?? setInternalDate;

  const dataReady = liveDataStatus.state === 'live' || liveDataStatus.state === 'degraded';

  const guests = useMemo(() => {
    const scoped = dailyRegisterRecords.filter(r => isSitePermitted(r.hotel, siteFilter));
    return buildGuests(scoped, ctx, date);
  }, [dailyRegisterRecords, isSitePermitted, siteFilter, ctx, date]);
  const stats = useMemo(() => computeGuestStats(guests), [guests]);

  const open = (filter: Partial<GuestFilter>) => {
    if (onSelectFilter) {
      onSelectFilter(filter);
      return;
    }
    saveRegisterFilterIntent({ filter: { ...NO_GUEST_FILTER, ...filter }, site: siteFilter, date });
    onNavigate?.('dailyRegisters');
  };

  const gender: Slice[] = [
    { id: 'male', label: 'Male', value: stats.male, color: BLUE, filter: { gender: 'male' } },
    { id: 'female', label: 'Female', value: stats.female, color: PURPLE, filter: { gender: 'female' } },
    { id: 'other', label: 'Other', value: stats.other, color: AMBER, filter: { gender: 'other' } },
    { id: 'unknown', label: 'Not specified', value: stats.unknownGender, color: GREY, filter: { gender: 'unknown' } },
  ];
  const age: Slice[] = [
    { id: 'child', label: 'Children', value: stats.child, color: AMBER, filter: { age: 'child' }, note: 'Under 18' },
    { id: 'adult', label: 'Adults', value: stats.adult, color: TEAL, filter: { age: 'adult' }, note: '18 to 64' },
    { id: 'elderly', label: 'Elderly', value: stats.elderly, color: PURPLE, filter: { age: 'elderly' }, note: '65 and over' },
    { id: 'unknown', label: 'Not recorded', value: stats.unknownAge, color: GREY, filter: { age: 'unknown' } },
  ];
  const family: Slice[] = FAMILY_BUCKETS.map(b => ({
    id: b,
    label: b === '1' ? 'Individuals' : `Family of ${b}`,
    value: stats.familiesBySize[b],
    color: TEAL,
    filter: { family: b },
    note: `${stats.guestsBySize[b]} guest${stats.guestsBySize[b] === 1 ? '' : 's'}`,
  }));
  const aspen: Slice[] = [
    { id: 'yes', label: 'Holders', value: stats.aspenHolders, color: TEAL, filter: { aspen: 'yes' } },
    { id: 'no', label: 'No card', value: stats.noAspen, color: GREY, filter: { aspen: 'no' } },
  ];

  const { nationalitySlices, languageSlices, propertyBreakdown, totalWithNationality, totalWithLanguage } = useMemo(() => {
    const natCounts: Record<string, number> = {};
    const langCounts: Record<string, number> = {};
    const propMap = new Map<string, {
      hotel: string;
      totalGuests: number;
      nationalities: Record<string, number>;
      languages: Record<string, number>;
      adults: number;
      children: number;
      aspenHolders: number;
    }>();

    let withNat = 0;
    let withLang = 0;

    guests.forEach(g => {
      const rec = g.record;
      const nat = (rec.nationality || '').trim() || 'Unspecified';
      const lang = (rec.language || '').trim() || 'Unspecified';
      const hotel = (rec.hotel || '').trim() || 'Unassigned Property';

      if (nat !== 'Unspecified') withNat++;
      if (lang !== 'Unspecified') withLang++;

      natCounts[nat] = (natCounts[nat] || 0) + 1;

      // Handle compound or split languages
      if (lang.includes('/') || lang.includes(',')) {
        const parts = lang.split(/[\/,]/).map(s => s.trim()).filter(Boolean);
        parts.forEach(p => {
          langCounts[p] = (langCounts[p] || 0) + 1;
        });
      } else {
        langCounts[lang] = (langCounts[lang] || 0) + 1;
      }

      if (!propMap.has(hotel)) {
        propMap.set(hotel, {
          hotel,
          totalGuests: 0,
          nationalities: {},
          languages: {},
          adults: 0,
          children: 0,
          aspenHolders: 0
        });
      }
      const p = propMap.get(hotel)!;
      p.totalGuests++;
      p.nationalities[nat] = (p.nationalities[nat] || 0) + 1;
      p.languages[lang] = (p.languages[lang] || 0) + 1;
      if (g.ageCategory === 'child') p.children++; else p.adults++;
      if (g.aspen) p.aspenHolders++;
    });

    const sortedNats = Object.entries(natCounts).sort((a, b) => b[1] - a[1]);
    const natSlices: Slice[] = sortedNats.slice(0, 6).map(([label, value], idx) => ({
      id: `nat-${label}`,
      label,
      value,
      color: SLICE_COLORS[idx % SLICE_COLORS.length],
      filter: {},
      note: stats.total > 0 ? `${Math.round((value / stats.total) * 100)}%` : ''
    }));
    const otherNatCount = sortedNats.slice(6).reduce((sum, item) => sum + item[1], 0);
    if (otherNatCount > 0) {
      natSlices.push({
        id: 'nat-other',
        label: `Other (${sortedNats.length - 6} countries)`,
        value: otherNatCount,
        color: GREY,
        filter: {},
        note: stats.total > 0 ? `${Math.round((otherNatCount / stats.total) * 100)}%` : ''
      });
    }

    const sortedLangs = Object.entries(langCounts).sort((a, b) => b[1] - a[1]);
    const langSlices: Slice[] = sortedLangs.slice(0, 6).map(([label, value], idx) => ({
      id: `lang-${label}`,
      label,
      value,
      color: SLICE_COLORS[(idx + 2) % SLICE_COLORS.length],
      filter: {},
      note: stats.total > 0 ? `${Math.round((value / stats.total) * 100)}%` : ''
    }));
    const otherLangCount = sortedLangs.slice(6).reduce((sum, item) => sum + item[1], 0);
    if (otherLangCount > 0) {
      langSlices.push({
        id: 'lang-other',
        label: `Other (${sortedLangs.length - 6} languages)`,
        value: otherLangCount,
        color: GREY,
        filter: {},
        note: stats.total > 0 ? `${Math.round((otherLangCount / stats.total) * 100)}%` : ''
      });
    }

    const propsList = Array.from(propMap.values()).map(p => {
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

    return {
      nationalitySlices: natSlices,
      languageSlices: langSlices,
      propertyBreakdown: propsList,
      totalWithNationality: withNat,
      totalWithLanguage: withLang
    };
  }, [guests, stats.total]);

  const families = (b: '2' | '3' | '4' | '5+') => ({ value: stats.familiesBySize[b], note: `${stats.guestsBySize[b]} guests` });
  const cards: Array<{ id: string; label: string; value: number; note?: string; filter: Partial<GuestFilter> }> = [
    { id: 'total', label: 'Total guests', value: stats.total, filter: {} },
    { id: 'male', label: 'Male', value: stats.male, filter: { gender: 'male' } },
    { id: 'female', label: 'Female', value: stats.female, filter: { gender: 'female' } },
    { id: 'other', label: 'Other / unspecified', value: stats.otherOrUnspecified, filter: { gender: 'other_unknown' } },
    { id: 'child', label: 'Children', value: stats.child, note: 'Under 18', filter: { age: 'child' } },
    { id: 'adult', label: 'Adults', value: stats.adult, note: '18 to 64', filter: { age: 'adult' } },
    { id: 'elderly', label: 'Elderly', value: stats.elderly, note: '65 and over', filter: { age: 'elderly' } },
    { id: 'aspen', label: 'Aspen card holders', value: stats.aspenHolders, filter: { aspen: 'yes' } },
    { id: 'nationalities', label: 'Recorded Nationalities', value: totalWithNationality, note: `${stats.total > 0 ? Math.round((totalWithNationality / stats.total) * 100) : 0}% recorded`, filter: {} },
    { id: 'languages', label: 'Recorded Languages', value: totalWithLanguage, note: `${stats.total > 0 ? Math.round((totalWithLanguage / stats.total) * 100) : 0}% recorded`, filter: {} },
    { id: 'f2', label: 'Families of 2', ...families('2'), filter: { family: '2' } },
    { id: 'f3', label: 'Families of 3', ...families('3'), filter: { family: '3' } },
  ];

  const siteLabel = siteFilter === 'all' || siteFilter === 'All Sites' ? 'All permitted sites' : siteFilter;

  const donut = (slices: Slice[], label: string) => {
    const visible = slices.filter(s => s.value > 0);
    return (
      <div className="h-40" role="img" aria-label={`${label}: ${slices.map(s => `${s.label} ${s.value}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visible}
              dataKey="value"
              nameKey="label"
              innerRadius={38}
              outerRadius={62}
              paddingAngle={visible.length > 1 ? 2 : 0}
              onClick={(d: any) => d?.payload && open((d.payload as Slice).filter)}
              cursor="pointer"
              stroke="none"
            >
              {visible.map(s => <Cell key={s.id} fill={s.color} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [`${v} (${stats.total ? Math.round((Number(v) / stats.total) * 100) : 0}%)`, n]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const bars = (slices: Slice[], label: string, unit: string) => (
    <div className="h-40" role="img" aria-label={`${label}: ${slices.map(s => `${s.label} ${s.value}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={slices} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edebe9" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#605e5c' }} tickLine={false} axisLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#605e5c' }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: '#f3f2f1' }}
            contentStyle={tooltipStyle}
            formatter={(v: any, _n: any, item: any) => [`${v} ${unit}${item?.payload?.note ? ` · ${item.payload.note}` : ''}`, item?.payload?.label]}
            labelFormatter={() => ''}
          />
          <Bar dataKey="value" radius={[2, 2, 0, 0]} cursor="pointer" onClick={(d: any) => d?.payload && open((d.payload as Slice).filter)}>
            {slices.map(s => <Cell key={s.id} fill={s.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#edebe9] mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-50 text-[#0d9488] rounded-xs border border-teal-200"><Users className="w-4 h-4" /></div>
          <div>
            <h3 className="text-sm font-bold text-[#242424]">Guest statistics</h3>
            <p className="text-xs text-[#605e5c]">{siteLabel} · staying on {date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-[#605e5c]">
            <span>Date</span>
            <input
              type="date"
              value={date}
              max="2100-01-01"
              onChange={e => setDate(e.target.value || today())}
              className="px-2 py-1 border border-[#8a8886] rounded-xs text-xs text-[#242424] focus:outline-none focus:border-[#0d9488]"
            />
          </label>
          <button
            type="button"
            onClick={() => open({})}
            className="text-xs font-semibold text-[#0d9488] hover:text-[#0f766e] flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xs cursor-pointer"
          >
            <span>{onSelectFilter ? 'View in Daily Register' : 'Open Daily Register'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!dataReady && dailyRegisterRecords.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#605e5c]" role="status">
          {liveDataStatus.state === 'loading' ? 'Loading register data…' : 'Register data is not available right now.'}
        </p>
      ) : stats.total === 0 ? (
        <p className="py-10 text-center text-xs text-[#605e5c]" role="status">No guests are recorded in the register for this site and date.</p>
      ) : (
        <>
          {familyError && (
            <div role="alert" className="mb-3 flex items-center justify-between gap-3 px-3 py-2 text-xs border border-[#f1998e] bg-[#fdf3f2] text-[#a4262c] rounded-xs">
              <span>Family groups could not be loaded, so family sizes use the people sharing a room. {familyError}</span>
              <button type="button" onClick={() => void reload()} className="inline-flex items-center gap-1 font-semibold hover:underline cursor-pointer">
                <RefreshCw className="w-3 h-3" />Retry
              </button>
            </div>
          )}
          {familiesLoading && <p className="mb-2 text-[11px] text-[#605e5c]" role="status">Loading family groups…</p>}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
            {cards.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => open(c.filter)}
                className="text-left bg-white border border-[#e1dfdd] rounded-xs px-3 py-2.5 hover:border-[#0d9488] hover:shadow-xs transition-colors cursor-pointer group"
                aria-label={`${c.label}: ${c.value}. Open the Daily Register filtered to this.`}
              >
                <span className="block text-[11px] font-semibold text-[#605e5c] truncate">{c.label}</span>
                <span className="block text-xl font-semibold text-[#242424] mt-0.5 tabular-nums group-hover:text-[#0d9488]">{c.value}</span>
                <span className="block text-[11px] text-[#a19f9d] truncate min-h-[14px]">{c.note || ''}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <ChartCard title="Gender" total={stats.total}>
              {donut(gender, 'Gender')}
              <Legend slices={gender} onPick={s => open(s.filter)} />
            </ChartCard>
            <ChartCard title="Age" total={stats.total}>
              {bars(age, 'Age', 'guests')}
              <Legend slices={age} onPick={s => open(s.filter)} />
            </ChartCard>
            <ChartCard title="Family size (families)" total={stats.total}>
              {bars(family, 'Family size', 'families')}
              <Legend slices={family} onPick={s => open(s.filter)} />
            </ChartCard>
            <ChartCard title="Aspen card" total={stats.total}>
              {donut(aspen, 'Aspen card')}
              <Legend slices={aspen} onPick={s => open(s.filter)} />
            </ChartCard>
            <ChartCard title="Top Recorded Nationalities" total={totalWithNationality}>
              {donut(nationalitySlices, 'Nationalities')}
              <Legend slices={nationalitySlices} onPick={s => open({})} />
            </ChartCard>
            <ChartCard title="Top Spoken Languages" total={totalWithLanguage}>
              {donut(languageSlices, 'Languages')}
              <Legend slices={languageSlices} onPick={s => open({})} />
            </ChartCard>
          </div>

          {/* Property Demographics & Language Matrix Section */}
          <div className="mt-5 border-t border-[#edebe9] pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-[#0d9488]" />
                <h4 className="text-xs font-bold text-[#242424] uppercase tracking-wider">
                  Property Demographics Matrix (Nationalities &amp; Languages per Property)
                </h4>
                <span className="text-[10px] bg-teal-50 text-teal-800 font-semibold px-2 py-0.5 rounded border border-teal-200">
                  {propertyBreakdown.length} Properties
                </span>
              </div>
              <div className="inline-flex bg-[#faf9f8] p-0.5 border border-[#edebe9] rounded text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setDemographicView('matrix')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    demographicView === 'matrix'
                      ? 'bg-white text-[#242424] font-semibold shadow-xs'
                      : 'text-[#605e5c] hover:text-[#242424]'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5 text-[#0d9488]" />
                  <span>Table Matrix</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemographicView('chart')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    demographicView === 'chart'
                      ? 'bg-white text-[#242424] font-semibold shadow-xs'
                      : 'text-[#605e5c] hover:text-[#242424]'
                  }`}
                >
                  <ChartBar className="w-3.5 h-3.5 text-[#0078d4]" />
                  <span>Property Chart</span>
                </button>
              </div>
            </div>

            {demographicView === 'matrix' ? (
              <div className="overflow-x-auto border border-[#edebe9] rounded-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold">
                      <th className="p-2.5">Property / Hotel</th>
                      <th className="p-2.5 text-center">Headcount</th>
                      <th className="p-2.5">Top Nationalities</th>
                      <th className="p-2.5">Top Spoken Languages</th>
                      <th className="p-2.5 text-right">Age Split</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edebe9] text-[#323130] bg-white">
                    {propertyBreakdown.map(p => (
                      <tr key={p.hotel} className="hover:bg-[#faf9f8] transition-colors">
                        <td className="p-2.5 font-semibold text-[#242424]">
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{p.hotel}</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="font-bold text-[#0d9488] bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-xs">
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
                        <td className="p-2.5 text-right font-medium text-neutral-600 text-[11px]">
                          <span>{p.adults} Adults · {p.children} Children</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white border border-[#edebe9] rounded-xs p-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={propertyBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edebe9" />
                    <XAxis dataKey="hotel" tick={{ fontSize: 10, fill: '#605e5c' }} angle={-25} textAnchor="end" interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#605e5c' }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: any, _name: any, item: any) => [
                        `${val} guests · Top: ${item?.payload?.topNats?.[0]?.name || 'N/A'} (${item?.payload?.topLangs?.[0]?.name || 'N/A'})`,
                        item?.payload?.hotel
                      ]}
                    />
                    <Bar dataKey="totalGuests" fill={TEAL} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
