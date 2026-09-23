import React, { useMemo } from 'react';
import { Globe2, Users, BarChart3, PieChart, ShieldAlert } from 'lucide-react';
import { DailyRegisterRecord } from '../../types';

interface LiveRegisterStatsSectionProps {
  records: DailyRegisterRecord[];
  selectedSite: string;
  selectedDate: string;
}

export const LiveRegisterStatsSection: React.FC<LiveRegisterStatsSectionProps> = ({
  records,
  selectedSite,
  selectedDate
}) => {
  const activeResidents = useMemo(() => {
    return records.filter(r => r.occupied === 'Yes' || !r.occupied);
  }, [records]);

  const totalResidents = activeResidents.length;

  const nationalityBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    let blankCount = 0;

    activeResidents.forEach(r => {
      const nat = (r.nationality || '').trim();
      if (!nat) {
        blankCount++;
      } else {
        counts[nat] = (counts[nat] || 0) + 1;
      }
    });

    const list = Object.entries(counts).map(([nationality, count]) => ({
      nationality,
      count,
      percentage: totalResidents > 0 ? ((count / totalResidents) * 100).toFixed(1) : '0'
    }));

    list.sort((a, b) => b.count - a.count);

    if (blankCount > 0) {
      list.push({
        nationality: 'Unspecified / Blank',
        count: blankCount,
        percentage: totalResidents > 0 ? ((blankCount / totalResidents) * 100).toFixed(1) : '0'
      });
    }

    return list;
  }, [activeResidents, totalResidents]);

  const maxCount = nationalityBreakdown.length > 0 ? Math.max(...nationalityBreakdown.map(n => n.count)) : 1;

  const topCountriesCount = nationalityBreakdown.filter(n => n.nationality !== 'Unspecified / Blank').length;

  return (
    <div className="space-y-6">
      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#605e5c] uppercase">Total Active Service Users</span>
            <Users className="w-4 h-4 text-[#0d9488]" />
          </div>
          <div className="text-2xl font-bold text-[#242424] mt-2">
            {totalResidents}
          </div>
          <p className="text-[11px] text-[#605e5c] mt-1">
            Site: <span className="font-semibold text-[#0d9488]">{selectedSite === 'all' ? 'All Sites' : selectedSite}</span>
          </p>
        </div>

        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#605e5c] uppercase">Nationalities Recorded</span>
            <Globe2 className="w-4 h-4 text-[#4338ca]" />
          </div>
          <div className="text-2xl font-bold text-[#242424] mt-2">
            {topCountriesCount}
          </div>
          <p className="text-[11px] text-[#605e5c] mt-1">
            Distinct nations represented
          </p>
        </div>

        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#605e5c] uppercase">Register Date</span>
            <BarChart3 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-[#242424] mt-2">
            {selectedDate || 'Today'}
          </div>
          <p className="text-[11px] text-[#605e5c] mt-1">
            Live occupancy calculation
          </p>
        </div>
      </div>

      {/* Nationality Bar Chart & Frequency Breakdown */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#edebe9] pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#0d9488]" />
            <h2 className="text-sm font-semibold text-[#242424]">
              Nationality Distribution & Bar Chart
            </h2>
          </div>
          <span className="text-xs text-[#605e5c]">
            Computed dynamically from Live Register
          </span>
        </div>

        {nationalityBreakdown.length === 0 ? (
          <div className="py-12 text-center text-[#605e5c]">
            <Globe2 className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
            <p className="font-semibold text-sm text-[#242424]">No service users recorded</p>
            <p className="text-xs text-[#605e5c] mt-0.5">Service user records added to the Daily Register will generate live statistics.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {nationalityBreakdown.map((item, idx) => {
              const widthPercent = (item.count / maxCount) * 100;
              const isUnspecified = item.nationality === 'Unspecified / Blank';

              return (
                <div key={item.nationality} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-medium ${isUnspecified ? 'text-amber-800 italic' : 'text-[#323130]'}`}>
                      {item.nationality}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-[#242424]">{item.count} SU</span>
                      <span className="text-[#605e5c] w-12 text-right">({item.percentage}%)</span>
                    </div>
                  </div>

                  {/* Horizontal Bar Chart */}
                  <div className="w-full bg-[#f3f2f1] h-3 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isUnspecified 
                          ? 'bg-amber-400' 
                          : idx % 3 === 0 
                            ? 'bg-[#0d9488]' 
                            : idx % 3 === 1 
                              ? 'bg-[#4338ca]' 
                              : 'bg-[#0284c7]'
                      }`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
