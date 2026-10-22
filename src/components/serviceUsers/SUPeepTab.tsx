import React, { useEffect, useState } from 'react';
import { Accessibility, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suTrackerService, type PeepPlan, type PeepHistoryEntry } from '../../services/suTrackerService';
import { formatUkDate } from '../../utils/suTrackerAccess';
import { reviewStatusOf } from '../peep/PEEPTrackerView';

const riskBadge: Record<string, string> = {
  Low: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-800 border-amber-200',
  High: 'bg-red-50 text-red-800 border-red-200'
};
const reviewBadge: Record<string, [string, string]> = {
  overdue: ['Review overdue', 'bg-red-50 text-red-800 border-red-200'],
  'due-soon': ['Review due soon', 'bg-amber-50 text-amber-800 border-amber-200'],
  current: ['Review up to date', 'bg-emerald-50 text-emerald-800 border-emerald-200'],
  none: ['No review date', 'bg-neutral-100 text-neutral-600 border-neutral-200']
};

const Field: React.FC<{ label: string; value?: React.ReactNode; full?: boolean }> = ({ label, value, full }) => (
  <div className={full ? 'sm:col-span-2 space-y-1' : 'space-y-1'}>
    <div className="text-[11px] font-semibold text-[#605e5c] uppercase tracking-wider">{label}</div>
    <div className={full ? 'whitespace-pre-wrap p-3 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs' : ''}>
      {value === undefined || value === null || value === '' ? <span className="text-neutral-400">—</span> : value}
    </div>
  </div>
);

/** The Personal Emergency Evacuation Plan of one Service User, read live from the PEEP Tracker's data. */
export const SUPeepTab: React.FC<{ suId: string; searchText: string }> = ({ suId, searchText }) => {
  const { navigateToPageWithSearch } = useApp();
  const [plans, setPlans] = useState<PeepPlan[]>([]);
  const [history, setHistory] = useState<PeepHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setPlans([]); setHistory([]);
    suTrackerService.listPeepPlans().then(async res => {
      if (!alive) return;
      if (!res.success) { setError(res.error || 'Could not load the PEEP plan.'); setLoading(false); return; }
      const mine = res.data.filter(p => p.suId === suId).sort((a, b) => b.version - a.version);
      setPlans(mine);
      const active = mine.find(p => p.status === 'Active');
      if (active) {
        const h = await suTrackerService.listPeepHistory(active.id);
        if (alive && h.success) setHistory(h.data);
      }
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [suId]);

  const active = plans.find(p => p.status === 'Active');
  const archived = plans.filter(p => p.status !== 'Active');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-xs text-neutral-800 flex items-center gap-1.5"><Accessibility className="w-4 h-4 text-rose-600" /> PEEP (Personal Emergency Evacuation Plan)</h4>
        <button type="button" onClick={() => navigateToPageWithSearch('peepTracker', searchText)} className="flex items-center gap-1 px-2.5 py-1 border border-[#e5e5e5] rounded-xs text-teal-800 hover:bg-teal-50 font-semibold cursor-pointer">
          <ExternalLink className="w-3 h-3" /> Open in PEEP Tracker
        </button>
      </div>

      {loading ? <p className="text-neutral-400">Loading PEEP plan...</p>
        : error ? <p className="text-red-700 bg-red-50 border border-red-200 rounded-xs p-2.5">{error}</p>
        : !active ? <p className="text-neutral-400 italic">No active PEEP plan recorded for this resident. Add one from the PEEP Tracker.</p>
        : (
          <div className="border border-neutral-200 rounded-lg bg-white p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded border font-semibold ${riskBadge[active.riskLevel] || ''}`}>{active.riskLevel} risk</span>
              <span className={`px-2 py-0.5 rounded border font-semibold ${reviewBadge[reviewStatusOf(active.reviewDate, today)][1]}`}>{reviewBadge[reviewStatusOf(active.reviewDate, today)][0]}</span>
              <span className="text-neutral-400">Version {active.version}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Mobility Type" value={active.mobilityType} />
              <Field label="Companion" value={active.companion} />
              <Field label="Emergency Alarm" value={active.emergencyAlarm} />
              <Field label="Assistance" value={active.assistance} />
              <Field label="Evacuation Procedure" value={active.evacuationProcedure} full />
              <Field label="Safe Exit Routes" value={active.safeExitRoutes} full />
              <Field label="Developed By" value={active.developedBy} />
              <Field label="Plan Date" value={formatUkDate(active.planDate)} />
              <Field label="Review Date" value={formatUkDate(active.reviewDate)} />
              <Field label="Last Updated By" value={active.updatedBy || active.createdBy} />
            </div>
          </div>
        )}

      {history.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-bold text-xs text-neutral-800">Plan history</h4>
          <ul className="border border-neutral-200 rounded-lg divide-y divide-neutral-100 bg-white">
            {history.map(h => (
              <li key={h.id} className="px-3 py-1.5 flex items-center justify-between gap-3">
                <span><b>v{h.version}</b> {h.changeType}{h.changedFields ? ` (${h.changedFields})` : ''}</span>
                <span className="text-neutral-500 whitespace-nowrap">{h.changedBy} · {h.changedAt ? new Date(h.changedAt).toLocaleString('en-GB') : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {archived.length > 0 && (
        <p className="text-neutral-500">{archived.length} earlier plan version{archived.length === 1 ? '' : 's'} archived.</p>
      )}
    </div>
  );
};
