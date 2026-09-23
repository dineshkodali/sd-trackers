import React, { useMemo, useState } from 'react';
import { Languages } from 'lucide-react';
import { DailyRegisterRecord } from '../../types';

interface LanguageSummarySectionProps {
  records: DailyRegisterRecord[];
  selectedSite: string;
}

export const LanguageSummarySection: React.FC<LanguageSummarySectionProps> = ({
  records,
  selectedSite
}) => {
  const [activeTab, setActiveTab] = useState<'normalized' | 'raw'>('normalized');

  const activeResidents = useMemo(() => {
    return records.filter(r => r.occupied === 'Yes' || !r.occupied);
  }, [records]);

  const totalChecked = activeResidents.length;

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

  return (
    <div className="space-y-6">
      {/* Language Breakdown Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Recorded Language Table */}
        <div className="lg:col-span-2 bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#edebe9] pb-3 gap-3">
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-[#0d9488]" />
              <h2 className="text-sm font-semibold text-[#242424]">
                Language Frequency
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex bg-[#faf9f8] p-0.5 border border-[#edebe9] rounded text-xs">
                <button
                  onClick={() => setActiveTab('normalized')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeTab === 'normalized'
                      ? 'bg-white text-[#242424] font-semibold shadow-xs'
                      : 'text-[#605e5c] hover:text-[#242424]'
                  }`}
                >
                  Normalized ({normalizedCounts.length})
                </button>
                <button
                  onClick={() => setActiveTab('raw')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeTab === 'raw'
                      ? 'bg-white text-[#242424] font-semibold shadow-xs'
                      : 'text-[#605e5c] hover:text-[#242424]'
                  }`}
                >
                  Raw Entries ({languageCounts.length})
                </button>
              </div>
              <span className="text-xs text-[#605e5c] hidden sm:inline">
                Site: {selectedSite === 'all' ? 'All Sites' : selectedSite}
              </span>
            </div>
          </div>

          {((activeTab === 'normalized' ? normalizedCounts : languageCounts).length === 0 && blankCount === 0) ? (
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
                      {activeTab === 'normalized' ? 'Individual Language / Dialect' : 'Raw Recorded Entry'}
                    </th>
                    <th className="p-2.5 text-right">Service Users</th>
                    <th className="p-2.5 text-right w-24">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edebe9] text-[#323130]">
                  {(activeTab === 'normalized' ? normalizedCounts : languageCounts).map(item => (
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

        {/* Compound Language Analysis Card */}
        <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-5 space-y-4">
          <div className="border-b border-[#edebe9] pb-3">
            <h3 className="text-sm font-semibold text-[#242424]">
              Multi-Language Combinations
            </h3>
            <p className="text-xs text-[#605e5c] mt-0.5">
              Preserved original entries with multiple languages (e.g. Arabic/English)
            </p>
          </div>

          {compoundLanguages.length === 0 ? (
            <p className="text-xs text-[#605e5c] py-6 text-center">
              No compound language entries found.
            </p>
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
  );
};
