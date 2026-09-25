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
  Receipt,
  CreditCard,
  Truck,
  Scale,
  Building2,
  ClipboardList,
  Trash2,
  X,
  FilePlus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Logo } from './Logo';

interface NavItemProps {
  id: string;
  page: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  badge?: number | string | null;
  badgeClass?: string;
  active: boolean;
  onClick: (page: string) => void;
  extraBadge?: React.ReactNode;
}

const NavItem: React.FC<NavItemProps> = ({ 
  id, page, label, icon: Icon, iconColor, badge, badgeClass, active, onClick, extraBadge
}) => (
  <button
    id={id}
    type="button"
    onClick={() => onClick(page)}
    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left cursor-pointer ${
      active ? 'bg-[#0d9488] text-white font-medium shadow-xs' : 'text-[#333333] hover:bg-[#f0efeb]'
    }`}
  >
    <div className="flex items-center gap-2.5 truncate">
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : iconColor || 'text-neutral-600'}`} />
      <span className="truncate">{label}</span>
    </div>
    <div className="flex items-center gap-1 shrink-0 ml-1.5">
      {extraBadge}
      {badge !== undefined && badge !== null && badge !== 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          active ? 'bg-white/20 text-white' : badgeClass || 'bg-[#eef3f7] text-[#0f766e]'
        }`}>
          {badge}
        </span>
      )}
    </div>
  </button>
);

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
    evictionRecords,
    bookletRecords,
    vcsAgencies,
    irRecords,
    foodWastageRecords,
    dailyRegisterRecords,
    notificationRules,
    canManageSettings,
    canManageRoles,
    canManageProperties,
    canManageUsers,
    rolePermissions,
    isFinanceUser,
    financeBills,
    assignedSite,
    canAccessAllSites,
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

  const userSiteFilter = (b: any) => {
    if (canAccessAllSites()) return true;
    if (!assignedSite || assignedSite === 'All Sites' || assignedSite === 'all') return true;
    const allowed = assignedSite.toLowerCase().trim();
    const bSiteName = (b.siteName || '').toLowerCase().trim();
    const bSiteId = (b.siteId || '').toLowerCase().trim();
    return bSiteName === allowed || bSiteName.includes(allowed) || bSiteId === allowed;
  };

  const scopedBills = (financeBills || []).filter(userSiteFilter);
  const vendorInvoicesCount = scopedBills.filter(b => b.billType === 'vendor_invoice').length;
  const creditCardBillsCount = scopedBills.filter(b => b.billType === 'credit_card_expense' || b.billType === 'other_expense').length;
  const deliveryNotesCount = scopedBills.filter(b => b.billType === 'delivery_note').length;
  const financeApprovalsCount = scopedBills.filter(b => b.status === 'awaiting_approval' || b.status === 'submitted').length;

  const isAdminOrSuperAdmin = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';
  const isNavActive = (page: string) => activePage === page;

  const handleNavClick = (pageId: string) => {
    setActivePage(pageId as any);
    if (setIsMobileSidebarOpen) setIsMobileSidebarOpen(false);
  };

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
        {/* Mobile Header with Logo & Close Button */}
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
          >
            <X className="w-5 h-5 text-neutral-600" />
          </button>
        </div>

        {/* Navigation List - Old Menu Model with Flat Sections */}
        <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto custom-scrollbar text-xs">
          
          {/* Section: Overview */}
          <div className="space-y-1">
            <NavItem id="nav-dashboard" page="dashboard" label="Dashboard" icon={Compass} iconColor="text-[#0d9488]" badge={isNavActive('dashboard') ? 'ACTIVE' : null} badgeClass="bg-white/20 text-white text-[9px] font-semibold" active={isNavActive('dashboard')} onClick={handleNavClick} />
            <NavItem id="nav-daily-registers" page="dailyRegisters" label="Live Daily Registers" icon={Building2} iconColor="text-blue-600" badge={dailyRegisterRecords.length || null} badgeClass="bg-blue-50 text-blue-800" active={isNavActive('dailyRegisters')} onClick={handleNavClick} />
          </div>

          {/* Section: Safeguarding Records */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-semibold text-[#8c8c8c] uppercase tracking-wider">
              Safeguarding
            </div>

            {/* SG Referrals with Drawer */}
            <div>
              <div className="flex items-center">
                <button
                  id="nav-referrals-main"
                  onClick={() => handleNavClick('referrals')}
                  className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                    isNavActive('referrals') ? 'bg-[#0d9488] text-white font-medium shadow-xs' : 'text-[#333333] hover:bg-[#f0efeb]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FolderHeart className={`w-4 h-4 shrink-0 ${isNavActive('referrals') ? 'text-white' : 'text-teal-600'}`} />
                    <span className="truncate">SG Referrals</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ml-1.5 ${
                    isNavActive('referrals') ? 'bg-white/20 text-white' : 'bg-[#eef3f7] text-[#0f766e]'
                  }`}>
                    {openReferrals}
                  </span>
                </button>
                <button
                  onClick={(e) => toggleGroup('referrals', e)}
                  title="Toggle Archive View"
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-[#f0efeb] rounded-md transition-colors ml-0.5 cursor-pointer"
                >
                  {openGroups.referrals ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>

              {openGroups.referrals && (
                <div className="pl-6 pt-0.5 space-y-0.5">
                  <NavItem id="nav-referrals-archive" page="referralsArchive" label="Archived Referrals" icon={FolderArchive} iconColor="text-neutral-500" badge={archivedReferrals || null} badgeClass="bg-neutral-200 text-neutral-700" active={isNavActive('referralsArchive')} onClick={handleNavClick} />
                </div>
              )}
            </div>

            {/* Vulnerable SUs with Drawer */}
            <div>
              <div className="flex items-center">
                <button
                  id="nav-vulnerable-main"
                  onClick={() => handleNavClick('vulnerable')}
                  className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                    isNavActive('vulnerable') ? 'bg-[#0d9488] text-white font-medium shadow-xs' : 'text-[#333333] hover:bg-[#f0efeb]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <HeartHandshake className={`w-4 h-4 shrink-0 ${isNavActive('vulnerable') ? 'text-white' : 'text-amber-600'}`} />
                    <span className="truncate">Vulnerable SUs</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ml-1.5 ${
                    isNavActive('vulnerable') ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200'
                  }`}>
                    {openVulnerable}
                  </span>
                </button>
                <button
                  onClick={(e) => toggleGroup('vulnerable', e)}
                  title="Toggle Archive View"
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-[#f0efeb] rounded-md transition-colors ml-0.5 cursor-pointer"
                >
                  {openGroups.vulnerable ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>

              {openGroups.vulnerable && (
                <div className="pl-6 pt-0.5 space-y-0.5">
                  <NavItem id="nav-vulnerable-archive" page="vulnerableArchive" label="Archived Vulnerable" icon={FolderArchive} iconColor="text-neutral-500" badge={archivedVulnerable || null} badgeClass="bg-neutral-200 text-neutral-700" active={isNavActive('vulnerableArchive')} onClick={handleNavClick} />
                </div>
              )}
            </div>

            {/* Challenging SUs with Drawer */}
            <div>
              <div className="flex items-center">
                <button
                  id="nav-challenging-main"
                  onClick={() => handleNavClick('challenging')}
                  className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-left ${
                    isNavActive('challenging') ? 'bg-[#0d9488] text-white font-medium shadow-xs' : 'text-[#333333] hover:bg-[#f0efeb]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <AlertTriangle className={`w-4 h-4 shrink-0 ${isNavActive('challenging') ? 'text-white' : 'text-purple-600'}`} />
                    <span className="truncate">Challenging SUs</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ml-1.5 ${
                    isNavActive('challenging') ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-900 border border-purple-200'
                  }`}>
                    {openChallenging}
                  </span>
                </button>
                <button
                  onClick={(e) => toggleGroup('challenging', e)}
                  title="Toggle Archive View"
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-[#f0efeb] rounded-md transition-colors ml-0.5 cursor-pointer"
                >
                  {openGroups.challenging ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>

              {openGroups.challenging && (
                <div className="pl-6 pt-0.5 space-y-0.5">
                  <NavItem id="nav-challenging-archive" page="challengingArchive" label="Archived Incidents" icon={FolderArchive} iconColor="text-neutral-500" badge={archivedChallenging || null} badgeClass="bg-neutral-200 text-neutral-700" active={isNavActive('challengingArchive')} onClick={handleNavClick} />
                </div>
              )}
            </div>

            <NavItem id="nav-rfa-welfare" page="rfaWelfare" label="RFA Welfare Checks" icon={UserCheck} iconColor="text-rose-600" badge={rfaWelfareRecords.length || null} badgeClass="bg-rose-50 text-rose-800" active={isNavActive('rfaWelfare')} onClick={handleNavClick} />
            <NavItem id="nav-gp-appointments" page="gpAppointments" label="GP Appointments" icon={Stethoscope} iconColor="text-blue-600" badge={gpAppointmentRecords.length || null} badgeClass="bg-blue-50 text-blue-800" active={isNavActive('gpAppointments')} onClick={handleNavClick} />
            <NavItem id="nav-document-builder" page="documentBuilder" label="HO Report Generator" icon={FilePlus} iconColor="text-[#0d9488]" active={isNavActive('documentBuilder')} onClick={handleNavClick} />
          </div>

          {/* Section: Facilities & Welfare */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-semibold text-[#8c8c8c] uppercase tracking-wider">
              Facilities & Welfare
            </div>

            <NavItem id="nav-maintenance" page="maintenance" label="Maintenance Tracker" icon={HardHat} iconColor="text-amber-700" extraBadge={cat1Count > 0 ? (<span className="text-[9px] font-bold bg-red-100 text-red-800 px-1 py-0.5 rounded animate-pulse">{cat1Count} CAT 1</span>) : null} badge={openMaintenance || null} badgeClass="bg-amber-50 text-amber-900 border border-amber-200" active={isNavActive('maintenance')} onClick={handleNavClick} />
            <NavItem id="nav-spcd" page="spcd" label="SPCD Tracker" icon={ScrollText} iconColor="text-emerald-700" badge={spcdCount || null} badgeClass="bg-emerald-50 text-emerald-900 border border-emerald-200" active={isNavActive('spcd')} onClick={handleNavClick} />
            <NavItem id="nav-ir-tracker" page="irTracker" label="IR Tracker" icon={ClipboardList} iconColor="text-teal-700" badge={irRecords.length || null} badgeClass="bg-teal-50 text-teal-800" active={isNavActive('irTracker')} onClick={handleNavClick} />
            <NavItem id="nav-transport" page="publicTransport" label="Public Transport" icon={Bus} iconColor="text-teal-700" badge={publicTransportRecords.length || null} badgeClass="bg-teal-50 text-teal-800" active={isNavActive('publicTransport')} onClick={handleNavClick} />
            <NavItem id="nav-dispersal" page="dispersal" label="Dispersal Sheet" icon={PlaneTakeoff} iconColor="text-indigo-700" badge={(dispersalRecords.length + (evictionRecords?.length || 0)) || null} badgeClass="bg-indigo-50 text-indigo-800" active={isNavActive('dispersal')} onClick={handleNavClick} />
            <NavItem id="nav-booklets" page="booklets" label="Booklet Inventory" icon={BookOpen} iconColor="text-amber-700" badge={bookletRecords.length || null} badgeClass="bg-amber-50 text-amber-800" active={isNavActive('booklets')} onClick={handleNavClick} />
            <NavItem id="nav-laundry" page="laundry" label="Laundry Support" icon={Waves} iconColor="text-cyan-700" active={isNavActive('laundry')} onClick={handleNavClick} />
            <NavItem id="nav-food" page="food" label="Hot Meals Tracker" icon={Soup} iconColor="text-emerald-600" active={isNavActive('food')} onClick={handleNavClick} />
            <NavItem id="nav-food-wastage" page="foodWastage" label="Food Wastage Tracker" icon={Trash2} iconColor="text-amber-700" badge={foodWastageRecords.length || null} badgeClass="bg-amber-50 text-amber-800" active={isNavActive('foodWastage')} onClick={handleNavClick} />
            <NavItem id="nav-escalations" page="escalations" label="Escalations Log" icon={Siren} iconColor="text-red-600" badge={activeEscalations || null} badgeClass="bg-red-100 text-red-800 font-bold" active={isNavActive('escalations')} onClick={handleNavClick} />
            <NavItem id="nav-documents" page="documents" label="Proof Documents" icon={FolderLock} iconColor="text-slate-600" active={isNavActive('documents')} onClick={handleNavClick} />
          </div>

          {/* Section: Finance Management */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-semibold text-[#8c8c8c] uppercase tracking-wider flex items-center justify-between">
              <span>Finance</span>
              {isFinanceUser() && (
                <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
                  CENTRAL
                </span>
              )}
            </div>

            <NavItem id="nav-finance-invoices" page="finance" label="Vendor Invoices" icon={Receipt} iconColor="text-emerald-700" badge={vendorInvoicesCount || null} badgeClass="bg-emerald-50 text-emerald-800" active={isNavActive('finance')} onClick={handleNavClick} />
            <NavItem id="nav-finance-credit-cards" page="financeCreditCards" label="Credit Card Bills" icon={CreditCard} iconColor="text-purple-700" badge={creditCardBillsCount || null} badgeClass="bg-purple-50 text-purple-800" active={isNavActive('financeCreditCards')} onClick={handleNavClick} />
            <NavItem id="nav-finance-delivery-notes" page="financeDeliveryNotes" label="Delivery Notes" icon={Truck} iconColor="text-blue-700" badge={deliveryNotesCount || null} badgeClass="bg-blue-50 text-blue-800" active={isNavActive('financeDeliveryNotes')} onClick={handleNavClick} />
            <NavItem id="nav-finance-approvals" page="financeApprovals" label="Finance Approvals" icon={Scale} iconColor="text-teal-700" badge={financeApprovalsCount || null} badgeClass="bg-amber-100 text-amber-800 font-bold" active={isNavActive('financeApprovals')} onClick={handleNavClick} />
          </div>

          {/* Section: Compliance & Community */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-semibold text-[#8c8c8c] uppercase tracking-wider">
              Compliance &amp; Community
            </div>

            <NavItem id="nav-compliance" page="compliance" label="SD-Compliance Tracker" icon={ShieldCheck} iconColor="text-emerald-700" badge={complianceRecords.length || null} badgeClass="bg-emerald-50 text-emerald-800" active={isNavActive('compliance')} onClick={handleNavClick} />
            <NavItem id="nav-vcs" page="vcsDirectory" label="SD VCS Directory" icon={HandHeart} iconColor="text-teal-700" badge={vcsAgencies.length || null} badgeClass="bg-teal-50 text-teal-800" active={isNavActive('vcsDirectory')} onClick={handleNavClick} />
            {(rolePermissions[currentUserRole]?.canExportData || canManageSettings()) && (
              <NavItem id="nav-reports" page="reports" label="Reports & SharePoint" icon={CloudUpload} iconColor="text-[#0d9488]" active={isNavActive('reports')} onClick={handleNavClick} />
            )}
            {(currentUserRole === 'Super Admin' || currentUserRole === 'Admin') && (
              <NavItem id="nav-audit" page="audit" label="Audit Security Trail" icon={Fingerprint} iconColor="text-amber-700" active={isNavActive('audit')} onClick={handleNavClick} />
            )}
            <NavItem id="nav-requests" page="requests" label="Requests & Approvals" icon={MessageSquareQuote} iconColor="text-blue-600" badge={dataChangeRequests?.filter(r => r.status === 'Pending').length || null} badgeClass="bg-amber-100 text-amber-800 font-bold" active={isNavActive('requests')} onClick={handleNavClick} />
          </div>

          {/* Section: Admin & Governance (Super Admin & Admin Only) */}
          {isAdminOrSuperAdmin && (
            <div className="space-y-1 pt-2 border-t border-[#ecebe8]">
              <div className="px-2 flex items-center justify-between text-[10px] font-semibold text-[#8c8c8c] uppercase tracking-wider">
                <span>Admin & Governance</span>
              </div>

              {canManageProperties() && (
                <NavItem id="nav-properties" page="properties" label="Properties Directory" icon={Landmark} iconColor="text-[#0d9488]" badge={properties.length || null} badgeClass="bg-[#eef3f7] text-[#0f766e]" active={isNavActive('properties')} onClick={handleNavClick} />
              )}
              {canManageUsers() && (
                <NavItem id="nav-users" page="users" label="Staff & User Accounts" icon={UsersRound} iconColor="text-teal-700" badge={users.length || null} badgeClass="bg-teal-50 text-teal-800" active={isNavActive('users')} onClick={handleNavClick} />
              )}
              {canManageRoles() && (
                <NavItem id="nav-roles" page="roles" label="Roles & RBAC Matrix" icon={KeyRound} iconColor="text-purple-700" active={isNavActive('roles')} onClick={handleNavClick} />
              )}
              {canManageRoles() && (
                <NavItem id="nav-setup-options" page="setupOptions" label="Field Options & Setup" icon={ListFilter} iconColor="text-blue-600" active={isNavActive('setupOptions')} onClick={handleNavClick} />
              )}
              {canManageSettings() && (
                <NavItem id="nav-settings" page="settings" label="System Preferences" icon={SlidersHorizontal} iconColor="text-slate-700" active={isNavActive('settings')} onClick={handleNavClick} />
              )}
              {canManageSettings() && (
                <NavItem id="nav-notifications" page="notifications" label="Email Notifications" icon={BellRing} iconColor="text-[#0d9488]" badge={notificationRules.filter(r => r.enabled).length || null} badgeClass="bg-teal-50 text-teal-800" active={isNavActive('notifications')} onClick={handleNavClick} />
              )}
            </div>
          )}
        </nav>
      </aside>
    </>
  );
};
