import React, { useState, useRef, useEffect } from 'react';
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
  Activity
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RoleType } from '../../types';
import { NetworkStatusIndicator } from './NetworkStatusIndicator';
import { Logo } from './Logo';

export const Header: React.FC = () => {
  const {
    currentUserRole,
    setCurrentUserRole,
    currentUserName,
    assignedSite,
    setAssignedSite,
    sites,
    notifications,
    unreadNotificationCount,
    markNotificationAsRead,
    clearAllNotifications,
    setActivePage,
    activePage,
    authProfile,
    logout,
    setDiagnosticModalOpen,
    canAccessAllSites,
    canManageRoles,
    canManageSettings
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
      {/* Brand area */}
      <div className="flex items-center gap-3">
        <Logo size="sm" />
        <div className="h-5 w-[1px] bg-[#e1dfdd] hidden md:block" />
        <div className="hidden md:flex items-center gap-2">
          <span className="text-xs font-semibold text-[#242424]">{getPageTitle(activePage)}</span>
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
              className="absolute right-0 mt-1 w-80 sm:w-96 bg-white border border-[#e1dfdd] shadow-xl rounded-xs z-40 overflow-hidden"
            >
              <div className="p-3 bg-[#f8f9fa] border-b border-[#e1dfdd] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#0d9488]" />
                  <span className="text-xs font-semibold text-[#242424]">Notifications</span>
                  <span className="text-[11px] bg-[#f0fdfa] text-[#0f766e] font-bold px-1.5 py-0.2 rounded">
                    {notifications.length}
                  </span>
                </div>
                {notifications.length > 0 && (
                  <button 
                    onClick={clearAllNotifications}
                    className="text-[11px] text-[#0d9488] hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-[#edebe9]">
                {!notifications || notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#605e5c]">
                    No new notifications
                  </div>
                ) : (
                  (notifications || []).map(notif => (
                    <div 
                      key={notif.id}
                      onClick={() => {
                        markNotificationAsRead(notif.id);
                        if (notif.linkPage) {
                          setActivePage(notif.linkPage);
                          setShowNotifications(false);
                        }
                      }}
                      className={`p-3 text-xs cursor-pointer hover:bg-[#f3f8fd] transition-colors ${
                        !notif.read ? 'bg-[#f0f6ff]/50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`font-semibold ${!notif.read ? 'text-[#0f766e]' : 'text-[#242424]'}`}>
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-[#8a8886] shrink-0">{notif.time}</span>
                      </div>
                      <p className="text-[11px] text-[#605e5c] mt-0.5 leading-snug">{notif.description}</p>
                    </div>
                  ))
                )}
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
                </div>
              ) : (
                <div className="pt-2 border-t border-[#edebe9] mt-2 text-[11px] text-[#605e5c]">
                  <span>Operational Role: <strong className="text-neutral-800">{currentUserRole}</strong></span>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Admin & property management is restricted to Super Admins and Admins.</p>
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
