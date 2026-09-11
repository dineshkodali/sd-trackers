import React from 'react';
import { 
  Building2, 
  Users, 
  AlertTriangle, 
  Wrench, 
  ArrowUpRight, 
  CheckCircle2, 
  ShieldCheck,
  Filter
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface PropertyLoadBreakdownProps {
  onSelectSiteFilter?: (site: string) => void;
  onNavigate: (page: string) => void;
}

export const PropertyLoadBreakdown: React.FC<PropertyLoadBreakdownProps> = ({
  onSelectSiteFilter,
  onNavigate
}) => {
  const { 
    properties, 
    referrals, 
    vulnerableSUs, 
    challengingSUs, 
    escalations, 
    maintenanceRecords 
  } = useApp();

  // Aggregate stats per property
  const propertyLoads = properties.map(prop => {
    const siteReferrals = referrals.filter(r => r.site === prop.name && r.status !== 'Archived').length;
    const siteVulnerable = vulnerableSUs.filter(v => v.site === prop.name && v.status !== 'Archived');
    const highRiskVulnerable = siteVulnerable.filter(v => v.riskLevel === 'High' || v.riskLevel === 'Critical').length;
    
    const siteChallenging = challengingSUs.filter(c => c.site === prop.name && c.status !== 'Archived').length;
    const siteEscalations = escalations.filter(e => (e.site === prop.name || (e as any).siteName === prop.name) && e.status !== 'Resolved').length;
    
    const siteMaintenance = maintenanceRecords.filter(m => m.site === prop.name && m.defectStatus !== 'Completed').length;
    const cat1Maintenance = maintenanceRecords.filter(m => m.site === prop.name && (m.priority === 'CAT 1' || (m as any).severity === 'CAT 1 - Emergency') && m.defectStatus !== 'Completed').length;

    const totalLoadScore = (siteReferrals * 2) + (highRiskVulnerable * 3) + (siteEscalations * 4) + (cat1Maintenance * 2);

    let statusLabel = 'Normal';
    let statusClass = 'bg-[#f1faf0] text-[#107c10] border-[#cbe8cb]';

    if (totalLoadScore >= 12 || siteEscalations > 0) {
      statusLabel = 'High Activity';
      statusClass = 'bg-red-50 text-red-800 border-red-200';
    } else if (totalLoadScore >= 6 || siteMaintenance >= 3) {
      statusLabel = 'Moderate Load';
      statusClass = 'bg-amber-50 text-amber-800 border-amber-200';
    }

    return {
      id: prop.id,
      name: prop.name,
      address: prop.city || 'London',
      capacity: prop.capacity || 45,
      manager: prop.leadOfficer || 'Assigned Lead',
      siteReferrals,
      siteVulnerableCount: siteVulnerable.length,
      highRiskVulnerable,
      siteChallenging,
      siteEscalations,
      siteMaintenance,
      cat1Maintenance,
      totalLoadScore,
      statusLabel,
      statusClass
    };
  }).sort((a, b) => b.totalLoadScore - a.totalLoadScore);

  return (
    <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#edebe9] gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#f0fdfa] text-[#0d9488] rounded-xs">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#242424] flex items-center gap-2">
              Property Portfolio &amp; Operational Load Breakdown
              <span className="text-[10px] px-2 py-0.5 font-normal bg-[#f0fdfa] text-[#0f766e] border border-[#5eead4] rounded">
                Facility Comparison
              </span>
            </h3>
            <p className="text-xs text-[#605e5c] mt-0.5">
              Live cross-site distribution of resident referrals, active escalations, and open maintenance work orders.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('properties')}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-[#f3f8fd] hover:bg-[#f0fdfa] text-[#0d9488] border border-[#99f6e4] rounded-xs transition-colors shrink-0"
        >
          <span>Properties Directory</span>
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>

      {/* Property Load Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {propertyLoads.slice(0, 6).map(item => (
          <div 
            key={item.id}
            className="border border-[#e1dfdd] rounded-xs p-3 hover:border-[#0d9488] transition-all bg-white flex flex-col justify-between space-y-2.5 shadow-2xs group"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-xs text-[#242424] group-hover:text-[#0d9488] transition-colors line-clamp-1">
                    {item.name}
                  </h4>
                  <p className="text-[10px] text-[#605e5c] line-clamp-1">
                    {item.address} &bull; Capacity: {item.capacity}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${item.statusClass}`}>
                  {item.statusLabel}
                </span>
              </div>

              {/* Metric Indicators */}
              <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-[#edebe9] text-center">
                <div className="bg-[#f3f8fd] p-1.5 rounded">
                  <span className="text-[10px] text-[#0f766e] font-medium block">Referrals</span>
                  <span className="text-sm font-bold text-[#0f766e]">{item.siteReferrals}</span>
                </div>
                <div className={`p-1.5 rounded ${item.siteEscalations > 0 ? 'bg-red-50' : 'bg-neutral-50'}`}>
                  <span className={`text-[10px] font-medium block ${item.siteEscalations > 0 ? 'text-red-700' : 'text-neutral-600'}`}>
                    Escalations
                  </span>
                  <span className={`text-sm font-bold ${item.siteEscalations > 0 ? 'text-[#a4262c]' : 'text-neutral-700'}`}>
                    {item.siteEscalations}
                  </span>
                </div>
                <div className={`p-1.5 rounded ${item.cat1Maintenance > 0 ? 'bg-amber-50' : 'bg-neutral-50'}`}>
                  <span className={`text-[10px] font-medium block ${item.cat1Maintenance > 0 ? 'text-[#795b00]' : 'text-neutral-600'}`}>
                    Repairs
                  </span>
                  <span className={`text-sm font-bold ${item.cat1Maintenance > 0 ? 'text-[#795b00]' : 'text-neutral-700'}`}>
                    {item.siteMaintenance}
                  </span>
                </div>
              </div>

              {item.highRiskVulnerable > 0 && (
                <div className="mt-2 text-[10px] font-semibold text-amber-800 bg-[#fff8ed] p-1.5 rounded border border-[#fedbb0] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-[#d83b01] shrink-0" />
                  <span>{item.highRiskVulnerable} high-priority vulnerable resident(s) logged</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[#edebe9] flex items-center justify-between text-xs">
              <span className="text-[11px] text-[#605e5c] truncate max-w-[130px]">
                Lead: {item.manager}
              </span>
              {onSelectSiteFilter && (
                <button
                  onClick={() => onSelectSiteFilter(item.name)}
                  className="text-xs text-[#0d9488] hover:underline font-semibold flex items-center gap-0.5"
                >
                  <Filter className="w-3 h-3" />
                  <span>Filter Site</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {propertyLoads.length > 6 && (
        <div className="text-center pt-1">
          <button
            onClick={() => onNavigate('properties')}
            className="text-xs text-[#0d9488] hover:underline font-semibold"
          >
            View all {propertyLoads.length} contracted accommodation properties &rarr;
          </button>
        </div>
      )}
    </div>
  );
};
