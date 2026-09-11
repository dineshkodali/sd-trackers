import React from 'react';
import { 
  Users, 
  ShieldAlert, 
  AlertTriangle, 
  Siren, 
  Shirt, 
  Soup, 
  Wrench, 
  Building2, 
  UsersRound, 
  ShieldCheck, 
  History, 
  FileSpreadsheet, 
  ScrollText,
  ArrowUpRight,
  ExternalLink,
  Plus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface CommercialTrackersGridProps {
  onNavigate: (page: string) => void;
  onOpenQuickIncident?: () => void;
}

export const CommercialTrackersGrid: React.FC<CommercialTrackersGridProps> = ({ 
  onNavigate,
  onOpenQuickIncident
}) => {
  const { 
    referrals, 
    vulnerableSUs, 
    challengingSUs, 
    escalations, 
    laundryRecords, 
    foodRecords, 
    maintenanceRecords, 
    spcdRecords,
    properties,
    users,
    auditLogs
  } = useApp();

  // Metrics
  const activeReferralsCount = referrals.filter(r => r.status !== 'Archived').length;
  const openReferralsCount = referrals.filter(r => r.status === 'Open').length;

  const activeVulnerableCount = vulnerableSUs.filter(v => v.status !== 'Archived').length;
  const highRiskVulnerableCount = vulnerableSUs.filter(v => v.riskLevel === 'High' || v.riskLevel === 'Critical').length;

  const activeChallengingCount = challengingSUs.filter(c => c.status !== 'Archived').length;
  const stageWarningCount = challengingSUs.filter(c => c.followUpRequired === 'Yes').length;

  const activeEscalationsCount = escalations.filter(e => e.status !== 'Resolved').length;
  const criticalEscalationsCount = escalations.filter(e => e.status === 'Active' || e.urgency === 'Critical').length;

  const laundryActiveCount = laundryRecords.filter(l => l.status === 'Washing' || l.status === 'Queued' || l.status === 'Drying').length;
  const laundryTotalBags = laundryRecords.reduce((acc, l) => acc + (l.bagCount || 1), 0);

  const foodRecordsCount = foodRecords.length;
  const foodTempPassing = foodRecords.filter(f => f.tempCheckedCelsius >= 63).length;
  const foodComplianceRate = foodRecordsCount > 0 ? Math.round((foodTempPassing / foodRecordsCount) * 100) : 100;

  const openMaintenanceCount = maintenanceRecords.filter(m => m.defectStatus !== 'Completed').length;
  const urgentMaintenanceCount = maintenanceRecords.filter(m => m.priority === 'CAT 1' || (m as any).severity === 'Urgent').length;

  const activeSpcdCount = spcdRecords.filter(s => !s.isArchived).length;
  const propertiesCount = properties.length;
  const usersCount = users.length;
  const auditLogsCount = auditLogs.length;

  const trackers = [
    {
      id: 'referrals',
      title: 'Safeguarding Referrals',
      code: 'TRK-REF',
      desc: 'Mosaic referrals, local authority allocations, and initial safeguarding intake.',
      icon: Users,
      count: activeReferralsCount,
      subtext: `${openReferralsCount} Open · ${activeReferralsCount - openReferralsCount} In Progress`,
      theme: 'blue',
      bgColor: 'bg-sky-50/70 hover:bg-sky-50',
      borderColor: 'border-[#5eead4] hover:border-[#0d9488]',
      textColor: 'text-[#0f766e]',
      iconBg: 'bg-[#f0fdfa] text-[#0d9488]',
      badge: 'Core Tracker'
    },
    {
      id: 'vulnerable',
      title: 'Vulnerable Residents (SUs)',
      code: 'TRK-VUL',
      desc: 'Antenatal care, critical vulnerabilities, medical needs, and keyworker reviews.',
      icon: ShieldAlert,
      count: activeVulnerableCount,
      subtext: `${highRiskVulnerableCount} High / Critical Risk`,
      theme: 'amber',
      bgColor: 'bg-amber-50/50 hover:bg-amber-50',
      borderColor: 'border-[#fedbb0] hover:border-[#d83b01]',
      textColor: 'text-[#8a3700]',
      iconBg: 'bg-[#fff8ed] text-[#8a3700]',
      badge: 'High Priority'
    },
    {
      id: 'challenging',
      title: 'Challenging Behavior & ASB',
      code: 'TRK-ASB',
      desc: 'Curfew breaches, noise altercations, contraband reports, and warning notices.',
      icon: AlertTriangle,
      count: activeChallengingCount,
      subtext: `${stageWarningCount} Require Active Follow-up`,
      theme: 'purple',
      bgColor: 'bg-purple-50/50 hover:bg-purple-50',
      borderColor: 'border-purple-200 hover:border-purple-600',
      textColor: 'text-purple-900',
      iconBg: 'bg-purple-100 text-purple-800',
      badge: 'Incident Log'
    },
    {
      id: 'escalations',
      title: 'Escalations & Multi-Agency',
      code: 'TRK-ESC',
      desc: 'NHS 999/111 callouts, police attendance, and emergency safeguarding board cases.',
      icon: Siren,
      count: activeEscalationsCount,
      subtext: `${criticalEscalationsCount} Active / In-progress cases`,
      theme: 'red',
      bgColor: 'bg-red-50/50 hover:bg-red-50',
      borderColor: 'border-red-200 hover:border-[#a4262c]',
      textColor: 'text-red-900',
      iconBg: 'bg-red-100 text-[#a4262c]',
      badge: 'Multi-Agency'
    },
    {
      id: 'laundry',
      title: 'Laundry Operations Tracker',
      code: 'TRK-LND',
      desc: 'Resident wash intake, token issuance, drying cycles, and bag collections.',
      icon: Shirt,
      count: laundryTotalBags,
      subtext: `${laundryActiveCount} Cycles Currently In-Wash`,
      theme: 'slate',
      bgColor: 'bg-slate-50/70 hover:bg-slate-100/80',
      borderColor: 'border-slate-200 hover:border-slate-500',
      textColor: 'text-slate-800',
      iconBg: 'bg-slate-100 text-slate-700',
      badge: 'Daily Ops'
    },
    {
      id: 'food',
      title: 'Hot Meals & Food Temp Checks',
      code: 'TRK-FOD',
      desc: 'Dietary requirements, Halal/Diabetic delivery logs, and food probe compliance.',
      icon: Soup,
      count: foodRecordsCount,
      subtext: `${foodComplianceRate}% Probe Temp Compliance (≥63°C)`,
      theme: 'emerald',
      bgColor: 'bg-emerald-50/50 hover:bg-emerald-50',
      borderColor: 'border-emerald-200 hover:border-emerald-600',
      textColor: 'text-emerald-900',
      iconBg: 'bg-emerald-100 text-emerald-800',
      badge: 'Food Hygiene'
    },
    {
      id: 'maintenance',
      title: 'Room & Facility Maintenance',
      code: 'TRK-MNT',
      desc: 'CAT 1 emergency repairs, room defects, contractor dispatch, and sign-offs.',
      icon: Wrench,
      count: openMaintenanceCount,
      subtext: `${urgentMaintenanceCount} Emergency CAT 1 Defects`,
      theme: 'amber',
      bgColor: 'bg-amber-50/40 hover:bg-amber-50',
      borderColor: 'border-[#fde892] hover:border-[#795b00]',
      textColor: 'text-[#795b00]',
      iconBg: 'bg-[#fff4ce] text-[#795b00]',
      badge: 'Facility Care'
    },
    {
      id: 'spcd',
      title: 'SPCD Statutory Compliance',
      code: 'TRK-SPD',
      desc: 'Special provision and council directives tracking with audit milestone logs.',
      icon: ScrollText,
      count: activeSpcdCount,
      subtext: 'Active Council Statutory Mandates',
      theme: 'teal',
      bgColor: 'bg-teal-50/50 hover:bg-teal-50',
      borderColor: 'border-teal-200 hover:border-teal-700',
      textColor: 'text-teal-900',
      iconBg: 'bg-teal-100 text-teal-800',
      badge: 'Statutory'
    },
    {
      id: 'properties',
      title: 'Contracted Property Portfolio',
      code: 'TRK-PRP',
      desc: 'Official hotel accommodations, room capacities, site managers, and addresses.',
      icon: Building2,
      count: propertiesCount,
      subtext: 'Contracted Hotel Facilities',
      theme: 'neutral',
      bgColor: 'bg-neutral-50/80 hover:bg-neutral-100/90',
      borderColor: 'border-neutral-200 hover:border-neutral-500',
      textColor: 'text-neutral-800',
      iconBg: 'bg-neutral-200/80 text-neutral-800',
      badge: 'Locations'
    },
    {
      id: 'users',
      title: 'Staff & User Accounts',
      code: 'TRK-USR',
      desc: 'Duty managers, frontline officers, regional leads, and assigned properties.',
      icon: UsersRound,
      count: usersCount,
      subtext: 'Active Operator Accounts',
      theme: 'teal',
      bgColor: 'bg-teal-50/40 hover:bg-teal-50',
      borderColor: 'border-teal-200 hover:border-teal-600',
      textColor: 'text-teal-900',
      iconBg: 'bg-teal-100 text-teal-800',
      badge: 'Staff'
    },
    {
      id: 'roles',
      title: 'Security & Role Permissions',
      code: 'TRK-ROL',
      desc: 'Granular Role-Based Access Control (RBAC) matrix and module authority policies.',
      icon: ShieldCheck,
      count: 5,
      subtext: 'Configured Operational Roles',
      theme: 'blue',
      bgColor: 'bg-sky-50/50 hover:bg-sky-50',
      borderColor: 'border-sky-200 hover:border-sky-600',
      textColor: 'text-sky-900',
      iconBg: 'bg-sky-100 text-sky-800',
      badge: 'RBAC Policy'
    },
    {
      id: 'reports',
      title: 'Reports & SharePoint Workbook',
      code: 'TRK-RPT',
      desc: 'Executive compliance dossiers, Excel sync, and direct workbook copying.',
      icon: FileSpreadsheet,
      count: 'M365',
      subtext: 'Workbook Link & Cloud Export',
      theme: 'emerald',
      bgColor: 'bg-emerald-50/60 hover:bg-emerald-50',
      borderColor: 'border-emerald-200 hover:border-[#107c10]',
      textColor: 'text-[#107c10]',
      iconBg: 'bg-[#f1faf0] text-[#107c10]',
      badge: 'SharePoint'
    },
    {
      id: 'audit',
      title: 'Audit & Governance Trail',
      code: 'TRK-AUD',
      desc: 'Complete immutable log of all creates, updates, deletions, and site events.',
      icon: History,
      count: auditLogsCount,
      subtext: 'Tamper-Evident System Logs',
      theme: 'purple',
      bgColor: 'bg-purple-50/40 hover:bg-purple-50',
      borderColor: 'border-purple-200 hover:border-purple-700',
      textColor: 'text-purple-900',
      iconBg: 'bg-purple-100 text-purple-800',
      badge: 'Governance'
    }
  ];

  return (
    <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#edebe9] gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#242424] uppercase tracking-wider">
              Commercial Operations &amp; Trackers Directory
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0fdfa] text-[#0f766e] font-bold border border-[#5eead4]">
              {trackers.length} Active Modules
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Direct navigation cards to all commercial tracking logs, safeguarding registers, and governance modules.
          </p>
        </div>

        {onOpenQuickIncident && (
          <button
            onClick={onOpenQuickIncident}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xs transition-colors shrink-0 shadow-2xs"
          >
            <Siren className="w-3.5 h-3.5" />
            <span>Emergency Incident Log</span>
          </button>
        )}
      </div>

      {/* Grid of Redirection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {trackers.map(t => {
          const Icon = t.icon;
          return (
            <div
              key={t.id}
              onClick={() => onNavigate(t.id)}
              className={`p-3.5 rounded-xs border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden shadow-2xs ${t.bgColor} ${t.borderColor}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xs transition-transform group-hover:scale-105 ${t.iconBg}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold text-neutral-400 block leading-tight">
                        {t.code}
                      </span>
                      <h4 className="text-xs font-bold text-[#242424] group-hover:text-[#0d9488] transition-colors leading-snug">
                        {t.title}
                      </h4>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/80 text-neutral-600 border border-neutral-200 shrink-0">
                    {t.badge}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#242424]">
                    {t.count}
                  </span>
                  <span className="text-[11px] font-medium text-[#605e5c] truncate">
                    {t.subtext}
                  </span>
                </div>

                <p className="text-[11px] text-[#605e5c] mt-1.5 line-clamp-2 leading-relaxed">
                  {t.desc}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between text-xs font-semibold text-[#0d9488] group-hover:underline">
                <span>Launch Tracker</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
