import React, { useState } from 'react';
import { 
  Compass, 
  FolderHeart, 
  FolderArchive,
  HeartHandshake, 
  AlertTriangle, 
  Waves, 
  Soup, 
  Siren, 
  FolderLock, 
  HardHat, 
  ScrollText, 
  CloudUpload, 
  Fingerprint, 
  Landmark, 
  UsersRound, 
  KeyRound, 
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  MessageSquareQuote,
  ListFilter,
  Bus,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  PlaneTakeoff,
  BookOpen,
  HandHeart,
  BellRing,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Logo } from './Logo';

export const Sidebar: React.FC = () => {
  const { 
    activePage, 
    setActivePage, 
    referrals, 
    vulnerableSUs, 
    challengingSUs, 
    escalations,
    properties,
    maintenanceRecords,
    spcdRecords,
    users,
    currentUserRole,
    dataChangeRequests,
    publicTransportRecords,
    complianceRecords,
    gpAppointmentRecords,
    rfaWelfareRecords,
    dispersalRecords,
    bookletRecords,
    vcsAgencies,
    notificationRules,
    canManageSettings,
    canManageRoles,
    canManageProperties,
    canManageUsers,
    rolePermissions,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen
  } = useApp();

  const [openGroups, setOpenGroups] = useState<{ [key: string]: boolean }>({
    referrals: false,
    vulnerable: false,
    challenging: false
  });

  const toggleGroup = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const openReferrals = referrals.filter(r => r.status !== 'Archived').length;
  const archivedReferrals = referrals.filter(r => r.status === 'Archived').length;

  const openVulnerable = vulnerableSUs.filter(v => v.status !== 'Archived').length;
  const archivedVulnerable = vulnerableSUs.filter(v => v.status === 'Archived').length;

  const openChallenging = challengingSUs.filter(c => c.status !== 'Archived').length;
  const archivedChallenging = challengingSUs.filter(c => c.status === 'Archived').length;

  const activeEscalations = escalations.filter(e => e.status !== 'Resolved').length;
  const openMaintenance = maintenanceRecords.filter(m => m.defectStatus !== 'Completed').length;
  const cat1Count = maintenanceRecords.filter(m => m.priority === 'CAT 1' && m.defectStatus !== 'Completed').length;
  const spcdCount = spcdRecords.filter(s => !s.isArchived).length;

  const isSuperAdmin = currentUserRole === 'Super Admin';
  const isAdminOrSuperAdmin = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';

  const isNavActive = (page: string) => activePage === page;

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      <div 
        id="sidebar-mobile-backdrop"
        className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity duration-300 lg:hidden ${
          isMobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Responsive Sidebar Drawer */}
      <aside 
        id="main-app-sidebar"
        className={`bg-[#fbfbfa] border-r border-[#e5e5e5] flex flex-col shrink-0 h-full select-none transition-transform duration-300 ease-in-out
          fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl
          lg:static lg:top-auto lg:bottom-auto lg:left-auto lg:z-20 lg:w-64 lg:shadow-none lg:translate-x-0
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Mobile-Only Drawer Header with Logo & Close Button */}
        <div className="flex lg:hidden items-center justify-between px-3.5 py-3 border-b border-[#e5e5e5] bg-white">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="font-bold text-xs tracking-tight text-[#242424]">SD Trackers</span>
          </div>
          <button
            id="btn-close-mobile-sidebar"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
            aria-label="Close navigation menu"
            title="Close menu"
          >
            <X className="w-5 h-5 text-neutral-600" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto custom-scrollbar text-xs">
        
        {/* Section: Overview */}
        <div className="space-y-0.5">
          <button
            id="nav-dashboard"
            onClick={() => setActivePage('dashboard')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md transition-all text-left ${
              isNavActive('dashboard')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb] hover:text-[#111111]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Compass className={`w-4 h-4 ${isNavActive('dashboard') ? 'text-white' : 'text-[#0d9488]'}`} />
              <span>Dashboard</span>
            </div>
            {isNavActive('dashboard') ? (
              <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.2 rounded font-semibold">
                ACTIVE
              </span>
            ) : null}
          </button>
        </div>

        {/* Section: Safeguarding Records */}
        <div className="space-y-1">
          <div className="px-2 text-[10px] font-semibold text-[#8c8c8c] uppercase tracking-wider">
            Safeguarding
          </div>

          {/* SG Referrals */}
          <div>
            <div className="flex items-center">
              <button
                id="nav-referrals-main"
                onClick={() => setActivePage('referrals')}
                className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                  isNavActive('referrals')
                    ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                    : 'text-[#333333] hover:bg-[#f0efeb]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FolderHeart className={`w-4 h-4 ${isNavActive('referrals') ? 'text-white' : 'text-teal-600'}`} />
                  <span>SG Referrals</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                  isNavActive('referrals') ? 'bg-white/20 text-white' : 'bg-[#eef3f7] text-[#0f766e]'
                }`}>
                  {openReferrals}
                </span>
              </button>
              <button
                onClick={(e) => toggleGroup('referrals', e)}
                title="Toggle Archive View"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-[#f0efeb] rounded-md transition-colors ml-0.5"
              >
                {openGroups.referrals ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {openGroups.referrals && (
              <div className="pl-6 pt-0.5 space-y-0.5">
                <button
                  id="nav-referrals-archive"
                  onClick={() => setActivePage('referralsArchive')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] transition-all ${
                    isNavActive('referralsArchive')
                      ? 'bg-[#0d9488] text-white font-medium'
                      : 'text-[#555555] hover:bg-[#f0efeb]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderArchive className="w-3.5 h-3.5 opacity-70" />
                    <span>Archived Referrals</span>
                  </div>
                  {archivedReferrals > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded ${
                      isNavActive('referralsArchive') ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                    }`}>
                      {archivedReferrals}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Vulnerable SUs */}
          <div>
            <div className="flex items-center">
              <button
                id="nav-vulnerable-main"
                onClick={() => setActivePage('vulnerable')}
                className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                  isNavActive('vulnerable')
                    ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                    : 'text-[#333333] hover:bg-[#f0efeb]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <HeartHandshake className={`w-4 h-4 ${isNavActive('vulnerable') ? 'text-white' : 'text-amber-600'}`} />
                  <span className="truncate">Vulnerable SUs</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                  isNavActive('vulnerable') ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200'
                }`}>
                  {openVulnerable}
                </span>
              </button>
              <button
                onClick={(e) => toggleGroup('vulnerable', e)}
                title="Toggle Archive View"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-[#f0efeb] rounded-md transition-colors ml-0.5"
              >
                {openGroups.vulnerable ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {openGroups.vulnerable && (
              <div className="pl-6 pt-0.5 space-y-0.5">
                <button
                  id="nav-vulnerable-archive"
                  onClick={() => setActivePage('vulnerableArchive')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] transition-all ${
                    isNavActive('vulnerableArchive')
                      ? 'bg-[#0d9488] text-white font-medium'
                      : 'text-[#555555] hover:bg-[#f0efeb]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderArchive className="w-3.5 h-3.5 opacity-70" />
                    <span>Archived Vulnerable</span>
                  </div>
                  {archivedVulnerable > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded ${
                      isNavActive('vulnerableArchive') ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                    }`}>
                      {archivedVulnerable}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Challenging SUs */}
          <div>
            <div className="flex items-center">
              <button
                id="nav-challenging-main"
                onClick={() => setActivePage('challenging')}
                className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                  isNavActive('challenging')
                    ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                    : 'text-[#333333] hover:bg-[#f0efeb]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className={`w-4 h-4 ${isNavActive('challenging') ? 'text-white' : 'text-purple-600'}`} />
                  <span>Challenging SUs</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                  isNavActive('challenging') ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-900 border border-purple-200'
                }`}>
                  {openChallenging}
                </span>
              </button>
              <button
                onClick={(e) => toggleGroup('challenging', e)}
                title="Toggle Archive View"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-[#f0efeb] rounded-md transition-colors ml-0.5"
              >
                {openGroups.challenging ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {openGroups.challenging && (
              <div className="pl-6 pt-0.5 space-y-0.5">
                <button
                  id="nav-challenging-archive"
                  onClick={() => setActivePage('challengingArchive')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] transition-all ${
                    isNavActive('challengingArchive')
                      ? 'bg-[#0d9488] text-white font-medium'
                      : 'text-[#555555] hover:bg-[#f0efeb]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderArchive className="w-3.5 h-3.5 opacity-70" />
                    <span>Archived Incidents</span>
                  </div>
                  {archivedChallenging > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded ${
                      isNavActive('challengingArchive') ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                    }`}>
                      {archivedChallenging}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* RFA Welfare Checks */}
          <button
            id="nav-rfa-welfare"
            onClick={() => setActivePage('rfaWelfare')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('rfaWelfare')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <UserCheck className={`w-4 h-4 ${isNavActive('rfaWelfare') ? 'text-white' : 'text-rose-600'}`} />
              <span>RFA Welfare Checks</span>
            </div>
            {rfaWelfareRecords.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                isNavActive('rfaWelfare') ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-800'
              }`}>
                {rfaWelfareRecords.length}
              </span>
            )}
          </button>

          {/* GP Appointments */}
          <button
            id="nav-gp-appointments"
            onClick={() => setActivePage('gpAppointments')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('gpAppointments')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Stethoscope className={`w-4 h-4 ${isNavActive('gpAppointments') ? 'text-white' : 'text-blue-600'}`} />
              <span>GP Appointments</span>
            </div>
            {gpAppointmentRecords.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                isNavActive('gpAppointments') ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-800'
              }`}>
                {gpAppointmentRecords.length}
              </span>
            )}
          </button>
        </div>

        {/* Section: Facilities & Welfare */}
        <div className="space-y-1">
          <div className="px-2 text-[10px] font-semibold text-[#8c8c8c] uppercase tracking-wider">
            Facilities & Welfare
          </div>

          {/* Maintenance Tracker */}
          <button
            id="nav-maintenance"
            onClick={() => setActivePage('maintenance')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('maintenance')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <HardHat className={`w-4 h-4 ${isNavActive('maintenance') ? 'text-white' : 'text-amber-700'}`} />
              <span>Maintenance Tracker</span>
            </div>
            <div className="flex items-center gap-1">
              {cat1Count > 0 && (
                <span className="text-[9px] font-bold bg-red-100 text-red-800 px-1 py-0.2 rounded animate-pulse">
                  {cat1Count} CAT 1
                </span>
              )}
              {openMaintenance > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                  isNavActive('maintenance') ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200'
                }`}>
                  {openMaintenance}
                </span>
              )}
            </div>
          </button>

          {/* SPCD Tracker */}
          <button
            id="nav-spcd"
            onClick={() => setActivePage('spcd')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('spcd')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ScrollText className={`w-4 h-4 ${isNavActive('spcd') ? 'text-white' : 'text-emerald-700'}`} />
              <span>SPCD Tracker</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
              isNavActive('spcd') ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
            }`}>
              {spcdCount}
            </span>
          </button>

          {/* Public Transport Tracker */}
          <button
            id="nav-transport"
            onClick={() => setActivePage('publicTransport')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('publicTransport')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Bus className={`w-4 h-4 ${isNavActive('publicTransport') ? 'text-white' : 'text-teal-700'}`} />
              <span>Public Transport</span>
            </div>
            {publicTransportRecords.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                isNavActive('publicTransport') ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-800'
              }`}>
                {publicTransportRecords.length}
              </span>
            )}
          </button>

          {/* Dispersal Sheet */}
          <button
            id="nav-dispersal"
            onClick={() => setActivePage('dispersal')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('dispersal')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <PlaneTakeoff className={`w-4 h-4 ${isNavActive('dispersal') ? 'text-white' : 'text-indigo-700'}`} />
              <span>Dispersal Sheet</span>
            </div>
            {dispersalRecords.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                isNavActive('dispersal') ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-800'
              }`}>
                {dispersalRecords.length}
              </span>
            )}
          </button>

          {/* Booklets to be Collected */}
          <button
            id="nav-booklets"
            onClick={() => setActivePage('booklets')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('booklets')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className={`w-4 h-4 ${isNavActive('booklets') ? 'text-white' : 'text-amber-700'}`} />
              <span>Booklet Inventory</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
              isNavActive('booklets') ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-800'
            }`}>
              {bookletRecords.length}
            </span>
          </button>

          {/* Laundry Support */}
          <button
            id="nav-laundry"
            onClick={() => setActivePage('laundry')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('laundry')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Waves className={`w-4 h-4 ${isNavActive('laundry') ? 'text-white' : 'text-cyan-700'}`} />
              <span>Laundry Support</span>
            </div>
          </button>

          {/* Hot Food Tracker */}
          <button
            id="nav-food"
            onClick={() => setActivePage('food')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('food')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Soup className={`w-4 h-4 ${isNavActive('food') ? 'text-white' : 'text-emerald-600'}`} />
              <span>Hot Meals Tracker</span>
            </div>
          </button>

          {/* Escalations Log */}
          <button
            id="nav-escalations"
            onClick={() => setActivePage('escalations')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('escalations')
                ? 'bg-red-600 text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Siren className={`w-4 h-4 ${isNavActive('escalations') ? 'text-white' : 'text-red-600'}`} />
              <span>Escalations Log</span>
            </div>
            {activeEscalations > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                isNavActive('escalations') ? 'bg-white/20 text-white' : 'bg-red-100 text-red-800'
              }`}>
                {activeEscalations}
              </span>
            )}
          </button>

          {/* Documents */}
          <button
            id="nav-documents"
            onClick={() => setActivePage('documents')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('documents')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FolderLock className={`w-4 h-4 ${isNavActive('documents') ? 'text-white' : 'text-slate-600'}`} />
              <span>Proof Documents</span>
            </div>
          </button>
        </div>

        {/* Section: Compliance & SharePoint */}
        <div className="space-y-1">
          <div className="px-2 text-[10px] font-semibold text-[#8c8c8c] uppercase tracking-wider">
            Compliance &amp; Community
          </div>

          {/* SD-Compliance Tracker */}
          <button
            id="nav-compliance"
            onClick={() => setActivePage('compliance')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('compliance')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className={`w-4 h-4 ${isNavActive('compliance') ? 'text-white' : 'text-emerald-700'}`} />
              <span>SD-Compliance Tracker</span>
            </div>
            {complianceRecords.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                isNavActive('compliance') ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-800'
              }`}>
                {complianceRecords.length}
              </span>
            )}
          </button>

          {/* SD VCS Support Agencies */}
          <button
            id="nav-vcs"
            onClick={() => setActivePage('vcsDirectory')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('vcsDirectory')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <HandHeart className={`w-4 h-4 ${isNavActive('vcsDirectory') ? 'text-white' : 'text-teal-700'}`} />
              <span>SD VCS Directory</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
              isNavActive('vcsDirectory') ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-800'
            }`}>
              {vcsAgencies.length}
            </span>
          </button>

          {(rolePermissions[currentUserRole]?.canExportData || canManageSettings()) && (
            <button
              id="nav-reports"
              onClick={() => setActivePage('reports')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                isNavActive('reports')
                  ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                  : 'text-[#333333] hover:bg-[#f0efeb]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CloudUpload className={`w-4 h-4 ${isNavActive('reports') ? 'text-white' : 'text-[#0d9488]'}`} />
                <span>Reports & SharePoint</span>
              </div>
            </button>
          )}

          {(currentUserRole === 'Super Admin' || currentUserRole === 'Admin') && (
            <button
              id="nav-audit"
              onClick={() => setActivePage('audit')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                isNavActive('audit')
                  ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                  : 'text-[#333333] hover:bg-[#f0efeb]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Fingerprint className={`w-4 h-4 ${isNavActive('audit') ? 'text-white' : 'text-amber-700'}`} />
                <span>Audit Security Trail</span>
              </div>
            </button>
          )}

          <button
            id="nav-requests"
            onClick={() => setActivePage('requests')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
              isNavActive('requests')
                ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                : 'text-[#333333] hover:bg-[#f0efeb]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquareQuote className={`w-4 h-4 ${isNavActive('requests') ? 'text-white' : 'text-blue-600'}`} />
              <span>Requests &amp; Approvals</span>
            </div>
            {dataChangeRequests.filter(r => r.status === 'Pending').length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                isNavActive('requests') ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {dataChangeRequests.filter(r => r.status === 'Pending').length}
              </span>
            )}
          </button>
        </div>

        {/* Section: Admin & Governance (Super Admin & Admin Only) */}
        {isAdminOrSuperAdmin && (
          <div className="space-y-1 pt-2 border-t border-[#ecebe8]">
            <div className="px-2 flex items-center justify-between text-[10px] font-semibold text-[#8c8c8c] uppercase tracking-wider">
              <span>Admin & Governance</span>
            </div>

            {/* Properties Directory */}
            {canManageProperties() && (
              <button
                id="nav-properties"
                onClick={() => setActivePage('properties')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                  isNavActive('properties')
                    ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                    : 'text-[#333333] hover:bg-[#f0efeb]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Landmark className={`w-4 h-4 ${isNavActive('properties') ? 'text-white' : 'text-[#0d9488]'}`} />
                  <span>Properties Directory</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                  isNavActive('properties') ? 'bg-white/20 text-white' : 'bg-[#eef3f7] text-[#0f766e]'
                }`}>
                  {properties.length}
                </span>
              </button>
            )}

            {/* Staff & User Accounts */}
            {canManageUsers() && (
              <button
                id="nav-users"
                onClick={() => setActivePage('users')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                  isNavActive('users')
                    ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                    : 'text-[#333333] hover:bg-[#f0efeb]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <UsersRound className={`w-4 h-4 ${isNavActive('users') ? 'text-white' : 'text-teal-700'}`} />
                  <span>Staff & User Accounts</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                  isNavActive('users') ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-800'
                }`}>
                  {users.length}
                </span>
              </button>
            )}

            {/* Roles & RBAC Matrix (Super Admin Only) */}
            {canManageRoles() && (
              <button
                id="nav-roles"
                onClick={() => setActivePage('roles')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                  isNavActive('roles')
                    ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                    : 'text-[#333333] hover:bg-[#f0efeb]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <KeyRound className={`w-4 h-4 ${isNavActive('roles') ? 'text-white' : 'text-purple-700'}`} />
                  <span>Roles & RBAC Matrix</span>
                </div>
              </button>
            )}

            {/* Field Options & Form Setup (Super Admin Only) */}
            {canManageRoles() && (
              <button
                id="nav-setup-options"
                onClick={() => setActivePage('setupOptions')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                  isNavActive('setupOptions')
                    ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                    : 'text-[#333333] hover:bg-[#f0efeb]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ListFilter className={`w-4 h-4 ${isNavActive('setupOptions') ? 'text-white' : 'text-blue-600'}`} />
                  <span>Field Options &amp; Setup</span>
                </div>
              </button>
            )}

            {/* System Preferences (Admin & Super Admin) */}
            {canManageSettings() && (
              <button
                id="nav-settings"
                onClick={() => setActivePage('settings')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                  isNavActive('settings')
                    ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                    : 'text-[#333333] hover:bg-[#f0efeb]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className={`w-4 h-4 ${isNavActive('settings') ? 'text-white' : 'text-slate-700'}`} />
                  <span>System Preferences</span>
                </div>
              </button>
            )}

            {/* Email Notifications Management (Admin & Super Admin) */}
            {canManageSettings() && (
              <button
                id="nav-notifications"
                onClick={() => setActivePage('notifications')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                  isNavActive('notifications')
                    ? 'bg-[#0d9488] text-white font-medium shadow-xs'
                    : 'text-[#333333] hover:bg-[#f0efeb]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BellRing className={`w-4 h-4 ${isNavActive('notifications') ? 'text-white' : 'text-[#0d9488]'}`} />
                  <span>Email Notifications</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                  isNavActive('notifications') ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-800'
                }`}>
                  {notificationRules.filter(r => r.enabled).length}
                </span>
              </button>
            )}
          </div>
        )}
      </nav>
    </aside>
  </>
  );
};
