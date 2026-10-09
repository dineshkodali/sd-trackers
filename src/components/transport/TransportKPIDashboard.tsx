import React from 'react';
import { 
  Bus, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Car, 
  HelpCircle,
  FileCheck2,
  TrendingUp,
  Activity
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface TransportKPIDashboardProps {
  selectedSiteFilter?: string;
  onNavigate?: (page: string) => void;
}

export const TransportKPIDashboard: React.FC<TransportKPIDashboardProps> = ({ selectedSiteFilter = 'all', onNavigate }) => {
  const { 
    publicTransportRecords, 
    transportFeedbackRecords, 
    transportChallengeRecords, 
    transportFundingRequests,
    canAccessAllSites,
    assignedSite,
    allowedSites
  } = useApp();

  // Site-scoped datasets
  const isSiteFiltered = (siteName?: string) => {
    if (!canAccessAllSites()) {
      const permitted = (allowedSites && allowedSites.length > 0 ? allowedSites : [assignedSite])
        .map(s => (s || '').toLowerCase().trim())
        .filter(s => s && s !== 'all sites' && s !== 'pending assignment' && s !== 'all');
      if (permitted.length === 0) return true;
      const target = (siteName || '').toLowerCase().trim();
      if (!target) return true;
      return permitted.some(s => target === s || target.includes(s) || s.includes(target));
    }
    if (selectedSiteFilter !== 'all') {
      const target = (siteName || '').toLowerCase().trim();
      const filter = selectedSiteFilter.toLowerCase().trim();
      return target === filter || target.includes(filter) || filter.includes(target);
    }
    return true;
  };

  const scopedPtRecords = publicTransportRecords.filter(r => isSiteFiltered((r as any).siteName || r.accommodationAddress));
  const scopedFeedback = transportFeedbackRecords.filter(r => isSiteFiltered(r.siteName));
  const scopedChallenges = transportChallengeRecords.filter(r => isSiteFiltered(r.siteName));
  const scopedFunding = transportFundingRequests.filter(r => isSiteFiltered(r.siteName));

  // 1. Journey Activity Metrics
  const ptJourneys = scopedPtRecords.filter(r => (r.modeOfTransport || '').toLowerCase().includes('train') || (r.modeOfTransport || '').toLowerCase().includes('bus') || (r.modeOfTransport || '').toLowerCase().includes('tube')).length;
  const aspenJourneys = scopedFeedback.filter(f => f.transportType === 'Aspen').length;
  const oohJourneys = scopedFeedback.filter(f => f.transportType === 'OOH').length;
  const taxiJourneys = scopedChallenges.reduce((acc, c) => acc + (Number(c.taxiRequestsApproved) || 0), 0) + 
    scopedPtRecords.filter(r => (r.modeOfTransport || '').toLowerCase().includes('taxi')).length;

  // 2. Transport Issue Metrics
  const openIssues = scopedFeedback.filter(f => f.isResolved === 'No' || f.isResolved === false).length;
  const highCriticalIssues = scopedFeedback.filter(f => f.impactLevel === 'High' || f.impactLevel === 'Critical').length;
  const resolvedIssues = scopedFeedback.filter(f => f.isResolved === 'Yes' || f.isResolved === true).length;
  const outstandingIssues = openIssues;

  // 3. Funding Metrics
  const totalFunding = scopedFunding.length;
  const pendingFunding = scopedFunding.filter(f => f.status === 'Submitted' || f.status === 'Under Review' || f.status === 'Clarification Required').length;
  const approvedFunding = scopedFunding.filter(f => f.status === 'Approved' || f.status === 'Completed').length;
  const rejectedFunding = scopedFunding.filter(f => f.status === 'Rejected').length;

  // 4. Site Challenges Metrics
  const sitesReporting = scopedChallenges.length;
  const sitesWithSg = scopedChallenges.filter(c => c.hasSgConcerns === 'Yes' || c.hasSgConcerns === true).length;
  const sitesNotUsingTracker = scopedChallenges.filter(c => c.trackerInUse === 'No' || c.trackerInUse === false).length;
  const sitesRequiringFollowUp = scopedChallenges.filter(c => (c.taxiRequestsDeclined || 0) > 0 || c.hasSgConcerns === 'Yes' || c.hasSgConcerns === true).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Category 1: Journey Activity */}
      <div 
        onClick={() => onNavigate?.('publicTransport')}
        className={`bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs transition-all hover:shadow-md ${onNavigate ? 'cursor-pointer hover:border-blue-400' : ''}`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Bus className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Journey Activity
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
            Active
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">PT Journeys</div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">{ptJourneys}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Aspen Journeys</div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">{aspenJourneys}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">OOH Journeys</div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">{oohJourneys}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Taxi Journeys</div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">{taxiJourneys}</div>
          </div>
        </div>
      </div>

      {/* Category 2: Transport Issues */}
      <div 
        onClick={() => onNavigate?.('publicTransport')}
        className={`bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs transition-all hover:shadow-md ${onNavigate ? 'cursor-pointer hover:border-amber-400' : ''}`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Issue Tracking
            </span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            openIssues > 0 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
          }`}>
            {openIssues > 0 ? `${openIssues} Open` : 'Clear'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Open Issues</div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">{openIssues}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">High / Critical</div>
            <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">{highCriticalIssues}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Resolved</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{resolvedIssues}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Outstanding</div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">{outstandingIssues}</div>
          </div>
        </div>
      </div>

      {/* Category 3: Funding Requests */}
      <div 
        onClick={() => onNavigate?.('publicTransport')}
        className={`bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs transition-all hover:shadow-md ${onNavigate ? 'cursor-pointer hover:border-indigo-400' : ''}`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <CreditCard className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Funding Requests
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium">
            {totalFunding} Total
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Pending Approval</div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">{pendingFunding}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Approved</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{approvedFunding}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Rejected</div>
            <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">{rejectedFunding}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Total Raised</div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">{totalFunding}</div>
          </div>
        </div>
      </div>

      {/* Category 4: Site Challenges */}
      <div 
        onClick={() => onNavigate?.('publicTransport')}
        className={`bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs transition-all hover:shadow-md ${onNavigate ? 'cursor-pointer hover:border-teal-400' : ''}`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <Activity className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Site Operations
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 font-medium">
            Monthly
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Sites Reporting</div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">{sitesReporting}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">SG Concerns</div>
            <div className={`text-lg font-bold mt-0.5 ${sitesWithSg > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {sitesWithSg}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Not Using Tracker</div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">{sitesNotUsingTracker}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 text-[11px]">Follow-Up Req.</div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">{sitesRequiringFollowUp}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
