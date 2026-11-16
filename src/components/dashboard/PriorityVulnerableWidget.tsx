import React, { useMemo } from 'react';
import { IconAlertTriangle as AlertTriangle, IconArrowUpRight as ArrowUpRight } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';

interface Props {
  siteFilter: string;
  onNavigate: (page: string) => void;
  /** How many cases to list (the count in the title always covers every high-risk case in scope). */
  limit?: number;
}

/** High-risk vulnerable and challenging service users for the selected site(s). */
export const PriorityVulnerableWidget: React.FC<Props> = ({ siteFilter, onNavigate, limit = 5 }) => {
  const { vulnerableSUs, challengingSUs, isSitePermitted } = useApp();

  const activeVulnerable = useMemo(
    () => vulnerableSUs.filter(v => isSitePermitted(v.site, siteFilter) && v.status !== 'Archived'),
    [vulnerableSUs, isSitePermitted, siteFilter]
  );
  const activeChallenging = useMemo(
    () => challengingSUs.filter(c => isSitePermitted(c.site, siteFilter) && c.status !== 'Archived'),
    [challengingSUs, isSitePermitted, siteFilter]
  );
  const highRiskCount =
    activeVulnerable.filter(v => v.riskLevel === 'High' || v.riskLevel === 'Critical').length +
    activeChallenging.filter(c => c.riskFactor === 'High' || c.riskFactor === 'Critical').length;

  return (
    <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs h-full">
      <div className="px-4 py-3 border-b border-[#e1dfdd] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-[#242424]">Priority Safeguarding &amp; High-Risk SUs ({highRiskCount})</h3>
        </div>
        <button onClick={() => onNavigate('vulnerable')} className="text-xs text-[#0d9488] hover:underline flex items-center gap-1">
          View all vulnerable <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>

      <div className="p-4 divide-y divide-[#edebe9] text-xs">
        {activeVulnerable.slice(0, limit).map(vul => (
          <div key={vul.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-800 text-sm">{vul.suName}</span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${vul.riskLevel === 'High' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                  {vul.riskLevel} Risk
                </span>
                <span className="text-neutral-500">{vul.site} · {vul.roomOrFlatNo}</span>
              </div>
              <p className="text-[#605e5c] line-clamp-1">{vul.vulnerability}</p>
              <div className="text-[11px] text-neutral-500 flex items-center gap-2">
                <span>Review Due: <strong className="text-neutral-700">{vul.reviewDate}</strong></span>
                <span>•</span>
                <span>Worker: {vul.allocatedWorker}</span>
              </div>
            </div>
            <button
              onClick={() => onNavigate('vulnerable')}
              className="px-2.5 py-1 bg-white hover:bg-[#edebe9] border border-[#8a8886] rounded-xs text-[#323130] shrink-0 font-medium"
            >
              Details
            </button>
          </div>
        ))}
        {activeVulnerable.length === 0 && (
          <div className="text-center py-6 text-[#605e5c]">No high-risk safeguarding cases reported in selected filter scope.</div>
        )}
      </div>
    </div>
  );
};
