import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bell, 
  User, 
  Shield, 
  Zap, 
  Building2, 
  ChevronDown, 
  Check, 
  ExternalLink, 
  Lock, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  Activity, 
  Menu, 
  X,
  CheckCheck,
  AlertCircle,
  Clock,
  ShieldAlert,
  UserCheck,
  Filter,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RoleType } from '../../types';
import { isStaffLevel, isSiteMatch } from '../../services/inAppNotificationService';
import { NetworkStatusIndicator } from './NetworkStatusIndicator';
import { Logo } from './Logo';

export const Header: React.FC = () => {
  const {
    currentUserRole,
    setCurrentUserRole,
    currentUserName,
    assignedSite,
    setAssignedSite,
    allowedSites,
    sites,
    notifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications,
    setActivePage,
    activePage,
    authProfile,
    logout,
    setDiagnosticModalOpen,
    canAccessAllSites,
    canManageRoles,
    canManageSettings,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen
  } = useApp();

  const getPageTitle = (page: string) => {
    switch (page) {
      case 'dashboard': return 'Operations Dashboard';
      case 'referrals': return 'Safeguarding Referrals';
      case 'referralsArchive': return 'Archived SG Referrals';
      case 'vulnerable': return 'Vulnerable / Safeguarding SUs';
      case 'vulnerableArchive': return 'Archived Vulnerable SUs';
      case 'challenging': return 'Challenging SUs';
      case 'challengingArchive': return 'Archived Challenging SUs';
      case 'rfaWelfare': return 'RFA Welfare Checks';
      case 'gpAppointments': return 'GP Appointments Register';
      case 'maintenance': return 'Maintenance & Defect Tracker';
      case 'spcd': return 'SPCD Case Tracker';
      case 'publicTransport': return 'Public Transport Tracker';
      case 'dispersal': return 'Dispersal Sheet';
      case 'booklets': return 'Booklets to be Collected';
      case 'compliance': return 'SD-Compliance Tracker';
      case 'vcsDirectory': return 'SD VCS Support Agencies';
      case 'laundry': return 'Property Laundry Register';
      case 'food': return 'Hot Food & Catering Tracker';
      case 'escalations': return 'Safeguarding Escalations Log';
      case 'documents': return 'Compliance & Document Repository';
      case 'properties': return 'Properties Directory';
      case 'users': return 'Users & Role Assignments';
      case 'reports': return 'Reports & SharePoint Sync';
      case 'audit': return 'Activity Log & Internal Accountability';
      case 'requests': return 'Requests & Approvals Workflow';
      case 'roles': return 'Staff Roles & Security Permissions';
      case 'setupOptions': return 'Field Options & Setup';
      case 'notifications': return 'Email Notifications Management';
      case 'settings': return 'Settings & Preferences';
      default: return 'SD Commercial Trackers';
    }
  };

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const isStaff = isStaffLevel(currentUserRole);
  const [notifTab, setNotifTab] = useState<'all' | 'site' | 'urgent' | 'requests'>(
    isStaffLevel(currentUserRole) ? 'site' : 'all'
  );

  useEffect(() => {
    if (isStaffLevel(currentUserRole) && notifTab === 'all') {
      setNotifTab('site');
    }
  }, [currentUserRole, notifTab]);

  const getRoleFeedTitle = (role: RoleType) => {
    switch (role) {
      case 'Super Admin': return 'Enterprise System Feed';
      case 'Admin': return 'Operations Activity Stream';
      case 'Regional Manager': return 'Regional Multi-Site Oversight';
      case 'Site Manager':
      case 'General Manager': return 'Site Operations & Defect Feed';
      default: return 'Frontline Property Feed';
    }
  };

  const getRoleFeedSubtitle = (role: RoleType, site: string, allowed: string[] = []) => {
    switch (role) {
      case 'Super Admin': return 'All properties, security events & RBAC governance';
      case 'Admin': return 'Cross-site operational records & approvals';
      case 'Regional Manager': return `${allowed?.length || 0} regional properties under oversight`;
      case 'Site Manager':
      case 'General Manager': return `Managed Site: ${site && site !== 'All Sites' ? site : 'Assigned Property'}`;
      default: return `Assigned Site: ${site && site !== 'All Sites' ? site : 'Frontline Property'}`;
    }
  };

  const getActionBadgeClass = (action?: string, type?: string) => {
    if (type === 'urgent') return 'bg-rose-100 text-rose-800 border-rose-200';
    if (type === 'security') return 'bg-purple-100 text-purple-800 border-purple-200';
    if (action === 'CREATE') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (action === 'DELETE') return 'bg-red-100 text-red-800 border-red-200';
    if (action === 'UPDATE') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (action === 'REQUEST') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-neutral-100 text-neutral-800 border-neutral-200';
  };

  const getActionLabel = (action?: string, type?: string) => {
    if (type === 'urgent') return 'URGENT';
    if (type === 'security') return 'SECURITY';
    if (action === 'CREATE') return 'CREATED';
    if (action === 'DELETE') return 'DELETED';
    if (action === 'UPDATE') return 'UPDATED';
    if (action === 'REQUEST') return 'APPROVAL';
    return 'INFO';
  };

  const tabFilteredNotifications = useMemo(() => {
    let list = notifications;
    if (isStaff && assignedSite && assignedSite !== 'All Sites' && assignedSite !== 'all') {
      list = list.filter(n => {
        if (n.category === 'profile_personal') return true;
        return n.site && isSiteMatch(assignedSite, n.site);
      });
    }

    if (notifTab === 'urgent') {
      return list.filter(n => n.type === 'urgent' || n.type === 'security' || n.category === 'critical_security');
    }
    if (notifTab === 'requests') {
      return list.filter(n => n.category === 'approval_workflow' || n.category === 'profile_personal' || n.module === 'Requests' || n.module === 'Users');
    }
    if (notifTab === 'site') {
      if (assignedSite && assignedSite !== 'All Sites' && assignedSite !== 'all') {
        return list.filter(n => n.site && isSiteMatch(assignedSite, n.site));
      }
      return list.filter(n => n.category === 'site_activity' || Boolean(n.site));
    }
    return list;
  }, [notifications, notifTab, assignedSite, isStaff]);

  const roleMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const rolesList: { role: RoleType; desc: string; accessLevel: string }[] = [
    { role: 'Super Admin', desc: 'Unrestricted system control, RBAC permissions, and database management', accessLevel: 'System Full' },
    { role: 'Admin', desc: 'Operational property management, user administration, and records', accessLevel: 'Operations Lead' },
    { role: 'Regional Manager', desc: 'Multi-property oversight, proof files CRUD, and compliance audits', accessLevel: 'Regional Level' },
    { role: 'General Manager', desc: 'Assigned property management, records creation & editing', accessLevel: 'Property Level' },
    { role: 'Employee', desc: 'Assigned property daily logging, resident support entries', accessLevel: 'Frontline Level' }
  ];

  const isPropertyBound = 
    currentUserRole === 'General Manager' || 
    currentUserRole === 'Employee' || 
    currentUserRole === 'Site Manager' || 
    currentUserRole === 'Staff';

  const isSuperAdminUser = authProfile?.role === 'Super Admin' || (!authProfile && currentUserRole === 'Super Admin');

  return (
    <header className="h-16 shrink-0 bg-white border-b border-[#e1dfdd] px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Brand area with Hamburger Menu for Mobile & Tablet */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          id="btn-mobile-menu-toggle"
          onClick={() => setIsMobileSidebarOpen(prev => !prev)}
          className="lg:hidden p-2 -ml-1 text-[#323130] hover:text-[#0d9488] hover:bg-[#f3f2f1] rounded-md transition-colors focus:outline-hidden"
          aria-label={isMobileSidebarOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
          title={isMobileSidebarOpen ? 'Close navigation' : 'Open navigation'}
        >
          {isMobileSidebarOpen ? <X className="w-5 h-5 text-[#0d9488]" /> : <Menu className="w-5 h-5" />}
        </button>

        <Logo size="sm" />
        <div className="h-5 w-[1px] bg-[#e1dfdd] hidden md:block" />
        <div className="hidden sm:flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-[#242424] truncate max-w-[160px] md:max-w-[280px] lg:max-w-[360px]">
            {getPageTitle(activePage)}
          </span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Assigned Property for Managers & Employees OR Direct Link to All Properties for Admins */}
        {currentUserRole === 'Super Admin' || currentUserRole === 'Admin' ? (
          <button
            id="btn-header-all-properties"
            onClick={() => setActivePage('properties')}
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-[#0f766e] bg-[#f0fdfa] hover:bg-[#ccfbf1] border border-[#99f6e4] px-2.5 py-1.5 rounded-xs transition-colors cursor-pointer"
            title="Click to view full Properties Directory (Admin access)"
          >
            <Building2 className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>All Properties ({sites.length} Hotels)</span>
          </button>
        ) : isPropertyBound ? (
          <div 
            id="assigned-property-topbar-tag"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4] rounded-xs shadow-xs"
            title={`Assigned Property: ${assignedSite} (Locked)`}
          >
            <Building2 className="w-3.5 h-3.5 text-[#0d9488]" />
            <span className="hidden sm:inline text-[#605e5c]">Property:</span>
            <span className="font-bold">{assignedSite}</span>
            <span className="flex items-center gap-0.5 text-[9px] text-amber-700 font-semibold bg-amber-50 px-1 py-0.2 rounded border border-amber-200 ml-1">
              <Lock className="w-2.5 h-2.5 text-amber-700" /> Locked
            </span>
          </div>
        ) : (
          <div 
            id="regional-oversight-topbar-tag"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#f3f8fd] text-[#0f766e] border border-[#99f6e4] rounded-xs shadow-xs"
            title="Regional Operational Oversight"
          >
            <Building2 className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>Regional Oversight</span>
          </div>
        )}

        {/* Network Connectivity Status Indicator */}
        <NetworkStatusIndicator />

        {/* Supabase Security & Diagnostics button */}
        <button
          id="btn-open-diagnostics"
          onClick={() => setDiagnosticModalOpen(true)}
          className="hidden md:flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-1.5 rounded-xs transition-colors cursor-pointer"
          title="Supabase Session Status, Token Expiration & Diagnostics"
        >
          <Activity className="w-3.5 h-3.5 text-emerald-700" />
          <span>Diagnostics</span>
        </button>

        {/* Super Admin Role Preview Switcher */}
        {isSuperAdminUser ? (
          <div className="relative" ref={roleMenuRef}>
            <button
              id="btn-role-switcher"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-[#edebe9] border border-[#8a8886] rounded-xs text-[#323130] transition-colors"
              title="Super Admin: Switch Active Role Preview"
            >
              <Shield className="w-3.5 h-3.5 text-[#0d9488]" />
              <span className="truncate max-w-[110px] sm:max-w-none">{currentUserRole}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#605e5c]" />
            </button>

            {showRoleMenu && (
              <div 
                id="role-dropdown-menu"
                className="absolute right-0 mt-1 w-72 bg-white border border-[#e1dfdd] shadow-xl rounded-xs p-1.5 z-40 text-xs"
              >
                <div className="px-2 py-1.5 text-[11px] font-bold text-[#797775] uppercase tracking-wider border-b border-[#edebe9] mb-1">
                  Switch Role Preview
                </div>
                {rolesList.map(item => {
                  const isSelected = item.role === currentUserRole;
                  return (
                    <button
                      key={item.role}
                      id={`select-role-${(item.role || '').toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => {
                        setShowRoleMenu(false);
                        setCurrentUserRole(item.role);
                      }}
                      className={`w-full text-left p-2 rounded-xs flex items-start justify-between gap-2 hover:bg-[#edebe9] transition-colors ${
                        isSelected ? 'bg-[#f3f8fd] text-[#0f766e] font-semibold' : 'text-[#323130]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-medium">
                          {item.role}
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#0d9488]" />}
                        </div>
                        <p className="text-[11px] text-[#605e5c] font-normal leading-tight mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                      <span className="text-[10px] shrink-0 font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                        {item.accessLevel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div
            id="badge-user-role"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-neutral-50 border border-neutral-200 rounded-xs text-[#323130]"
            title={`Assigned Operational Role: ${currentUserRole}`}
          >
            <Shield className="w-3.5 h-3.5 text-[#0d9488]" />
            <span className="truncate max-w-[110px] sm:max-w-none">{currentUserRole}</span>
          </div>
        )}

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            id="btn-notifications"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-[#323130] hover:bg-[#edebe9] border border-[#8a8886] rounded-xs transition-colors"
            title="System Notifications"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4 text-[#323130]" />
            {unreadNotificationCount > 0 && (
              <span 
                id="notif-count-badge"
                className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#a4262c] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
              >
                {unreadNotificationCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div 
              id="notifications-flyout"
              className="absolute right-0 mt-1 w-80 sm:w-[420px] bg-white border border-[#e1dfdd] shadow-2xl rounded-xs z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
            >
              {/* Role-Customized Header */}
              <div className="p-3.5 bg-[#f8f9fa] border-b border-[#e1dfdd] flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Bell className="w-4 h-4 text-[#0d9488]" />
                    <span className="text-xs font-bold text-[#242424]">
                      {getRoleFeedTitle(currentUserRole)}
                    </span>
                    {unreadNotificationCount > 0 && (
                      <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 font-bold px-1.5 py-0.2 rounded-full">
                        {unreadNotificationCount} new
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#605e5c] mt-0.5 truncate">
                    {getRoleFeedSubtitle(currentUserRole, assignedSite, allowedSites)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {unreadNotificationCount > 0 && (
                    <button 
                      onClick={markAllNotificationsAsRead}
                      className="text-[11px] text-[#0d9488] hover:text-[#0f766e] font-semibold flex items-center gap-0.5"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Read all</span>
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button 
                      onClick={clearAllNotifications}
                      className="text-[11px] text-neutral-400 hover:text-red-600 transition-colors"
                      title="Clear notifications"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#f3f2f1] bg-[#faf9f8] overflow-x-auto">
                {!isStaff && (
                  <button
                    onClick={() => setNotifTab('all')}
                    className={`px-2.5 py-1 rounded-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                      notifTab === 'all' ? 'bg-[#0d9488] text-white' : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <span>All</span>
                    <span className={`text-[10px] px-1 rounded-full ${notifTab === 'all' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'}`}>
                      {notifications.length}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setNotifTab('site')}
                  className={`px-2.5 py-1 rounded-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                    notifTab === 'site' ? 'bg-[#0d9488] text-white' : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                  title={isStaff ? `Notifications strictly for ${assignedSite || 'your assigned site'}` : 'Site Activity'}
                >
                  <Building2 className="w-3 h-3" />
                  <span>{isStaff ? (assignedSite && assignedSite !== 'All Sites' ? assignedSite : 'My Assigned Property') : 'My Site'}</span>
                </button>
                <button
                  onClick={() => setNotifTab('urgent')}
                  className={`px-2.5 py-1 rounded-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                    notifTab === 'urgent' ? 'bg-[#0d9488] text-white' : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>Urgent & Alerts</span>
                </button>
                <button
                  onClick={() => setNotifTab('requests')}
                  className={`px-2.5 py-1 rounded-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                    notifTab === 'requests' ? 'bg-[#0d9488] text-white' : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <UserCheck className="w-3 h-3" />
                  <span>Requests</span>
                </button>
              </div>

              {/* Notifications List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-[#f3f2f1] text-xs">
                {tabFilteredNotifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#605e5c] space-y-1">
                    <Sparkles className="w-5 h-5 mx-auto text-neutral-300" />
                    <p className="font-semibold text-neutral-700">All caught up!</p>
                    <p className="text-[11px] text-neutral-400">
                      {notifTab === 'site' 
                        ? `No recent activity recorded for ${assignedSite && assignedSite !== 'All Sites' ? assignedSite : 'your site'}.`
                        : notifTab === 'urgent'
                        ? 'No urgent incidents or critical alerts.'
                        : 'No new notifications for your assigned role.'}
                    </p>
                  </div>
                ) : (
                  tabFilteredNotifications.map(notif => (
                    <div 
                      key={notif.id}
                      onClick={() => {
                        markNotificationAsRead(notif.id);
                        if (notif.linkPage) {
                          setActivePage(notif.linkPage);
                          setShowNotifications(false);
                        }
                      }}
                      className={`p-3 cursor-pointer hover:bg-[#f3f8fd] transition-colors relative ${
                        !notif.read ? 'bg-[#f0fdfa]/40' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Action Badge */}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getActionBadgeClass(notif.action, notif.type)}`}>
                            {getActionLabel(notif.action, notif.type)}
                          </span>
                          {/* Site Pill */}
                          {notif.site && notif.site !== 'All Sites' && notif.site !== 'System' && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-900 flex items-center gap-0.5">
                              <Building2 className="w-2.5 h-2.5 text-teal-600 inline" />
                              <span className="truncate max-w-[120px]">{notif.site}</span>
                            </span>
                          )}
                          {/* Module Pill */}
                          {notif.module && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-neutral-700">
                              {notif.module}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#8a8886] shrink-0 font-medium">{notif.time}</span>
                      </div>

                      <div className="flex items-start gap-2">
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0 mt-1" title="Unread notification" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h5 className={`font-semibold text-xs leading-snug truncate ${!notif.read ? 'text-[#0f766e]' : 'text-[#242424]'}`}>
                              {notif.title}
                            </h5>
                            {notif.linkPage && (
                              <ArrowRight className="w-3 h-3 text-neutral-400 shrink-0 group-hover:text-teal-600" />
                            )}
                          </div>
                          <p className="text-[11px] text-[#605e5c] mt-0.5 leading-relaxed line-clamp-2">
                            {notif.description}
                          </p>
                          {notif.performedByUser && (
                            <div className="mt-1 text-[10px] text-neutral-400 flex items-center gap-1">
                              <span>By:</span>
                              <span className="font-medium text-neutral-600">{notif.performedByUser}</span>
                              {notif.performedByRole && (
                                <span className="text-neutral-400">({notif.performedByRole})</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Flyout Footer */}
              <div className="px-3.5 py-2 bg-[#f8f9fa] border-t border-[#e1dfdd] flex items-center justify-between text-[10px] text-neutral-500">
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-teal-600" />
                  <span>Role: <strong>{currentUserRole}</strong></span>
                </span>
                <button
                  onClick={() => {
                    setActivePage('audit');
                    setShowNotifications(false);
                  }}
                  className="text-[#0d9488] hover:underline font-semibold flex items-center gap-0.5"
                >
                  <span>Full Activity Log</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            id="btn-profile-menu"
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#323130] hover:bg-[#edebe9] border border-[#8a8886] rounded-xs transition-colors"
          >
            <div className="w-5 h-5 rounded-full bg-[#0d9488] text-white flex items-center justify-center text-[10px] font-bold">
              {currentUserName.charAt(0)}
            </div>
            <span className="hidden md:inline font-medium max-w-[90px] truncate">{currentUserName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#605e5c]" />
          </button>

          {showProfile && (
            <div 
              id="profile-dropdown-menu"
              className="absolute right-0 mt-1 w-72 bg-white border border-[#e1dfdd] shadow-xl rounded-xs p-3 z-40 text-xs"
            >
              <div className="border-b border-[#edebe9] pb-2.5 mb-2.5">
                <div className="font-semibold text-sm text-[#242424]">{currentUserName}</div>
                <div className="text-[11px] text-[#605e5c]">{currentUserRole}</div>
                <div className="text-[11px] text-[#0d9488] font-medium mt-1">
                  Active Property: {canAccessAllSites() ? (assignedSite || 'All Properties') : assignedSite}
                </div>
              </div>

              {/* Property information / selector: Admins can filter; Staff is strictly locked */}
              {canAccessAllSites() ? (
                <div className="mb-2.5 bg-[#f8f9fa] p-2 rounded-xs border border-[#edebe9]">
                  <label className="text-[10px] font-bold text-[#605e5c] uppercase block mb-1">
                    Filter Active Property:
                  </label>
                  <select 
                    value={assignedSite}
                    onChange={e => setAssignedSite(e.target.value)}
                    className="w-full text-xs p-1 bg-white border border-[#8a8886] rounded-xs"
                  >
                    {(sites || []).map((s, sIdx) => (
                      <option key={`${s.id || s.name}-${sIdx}`} value={s.name}>{s.name} ({s.city})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="mb-2.5 bg-[#f8f9fa] p-2.5 rounded-xs border border-[#edebe9] space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-[#605e5c] uppercase">
                    <span>Assigned Hotel:</span>
                    <span className="flex items-center gap-1 text-amber-700 font-semibold normal-case text-[10px] bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                      <Lock className="w-2.5 h-2.5 text-amber-700" /> Locked
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#1e293b] flex items-center gap-1.5 bg-white p-1.5 rounded border border-[#e2e8f0]">
                    <Building2 className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />
                    <span className="truncate">{assignedSite || 'Assigned Hotel'}</span>
                  </div>
                  <p className="text-[10px] text-[#64748b] leading-tight pt-0.5">
                    Property assignment is locked to your account by system administrators.
                  </p>
                </div>
              )}

              {/* Quick Admin Navigation for Authorized Roles Only */}
              {(canManageRoles() || canManageSettings()) ? (
                <div className="space-y-1 pt-1 border-t border-[#edebe9] mt-2">
                  {canManageRoles() && (
                    <button
                      onClick={() => {
                        setShowProfile(false);
                        setActivePage('roles');
                      }}
                      className="w-full text-left p-1.5 rounded hover:bg-[#edebe9] text-[#323130] flex items-center justify-between"
                    >
                      <span>Role & Access Matrix</span>
                      <Shield className="w-3 h-3 text-[#605e5c]" />
                    </button>
                  )}
                  {canManageSettings() && (
                    <button
                      onClick={() => {
                        setShowProfile(false);
                        setActivePage('settings');
                      }}
                      className="w-full text-left p-1.5 rounded hover:bg-[#edebe9] text-[#323130] flex items-center justify-between"
                    >
                      <span>Settings & Performance</span>
                      <Zap className="w-3 h-3 text-[#107c10]" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfile(false);
                      setDiagnosticModalOpen(true);
                    }}
                    className="w-full text-left p-1.5 rounded hover:bg-[#edebe9] text-[#323130] flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>Supabase Diagnostics</span>
                    <Activity className="w-3 h-3 text-[#0d9488]" />
                  </button>

                  <a
                    href="/docs/index.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowProfile(false)}
                    className="w-full text-left p-1.5 rounded hover:bg-[#edebe9] text-[#323130] flex items-center justify-between text-xs cursor-pointer no-underline"
                    title="Open SDTracker Support, SLA & Brand Kit Portal in a new window"
                  >
                    <span className="font-semibold text-[#0d9488]">Support &amp; Brand Kit</span>
                    <ExternalLink className="w-3 h-3 text-[#0d9488]" />
                  </a>
                </div>
              ) : (
                <div className="pt-2 border-t border-[#edebe9] mt-2 text-[11px] text-[#605e5c]">
                  <span>Operational Role: <strong className="text-neutral-800">{currentUserRole}</strong></span>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Admin & property management is restricted to Super Admins and Admins.</p>
                  <a
                    href="/docs/index.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowProfile(false)}
                    className="w-full mt-2 text-left p-1.5 rounded hover:bg-[#edebe9] text-[#323130] flex items-center justify-between text-xs cursor-pointer no-underline"
                    title="Open SDTracker Support, SLA & Brand Kit Portal in a new window"
                  >
                    <span className="font-semibold text-[#0d9488]">Support &amp; Brand Kit</span>
                    <ExternalLink className="w-3 h-3 text-[#0d9488]" />
                  </a>
                </div>
              )}

              {/* Sign Out Action */}
              <div className="pt-2.5 border-t border-[#edebe9] mt-2">

                <button
                  type="button"
                  onClick={() => {
                    setShowProfile(false);
                    logout();
                  }}
                  className="w-full px-2.5 py-1.5 bg-[#fdf3f2] hover:bg-[#fae7e6] text-[#a80000] border border-[#f5b8b5] font-medium rounded-xs text-[11px] transition-colors flex items-center justify-center gap-1.5"
                  title="Revoke session token and sign out"
                >
                  <LogOut className="w-3.5 h-3.5 text-[#a80000]" />
                  <span>Sign Out (Revoke Session)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
