import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Building2, 
  Check, 
  ShieldAlert,
  ShieldCheck,
  Layers,
  FolderPlus,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  Hotel,
  UserPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserAccount, RoleType, UserGroup } from '../../types';
import { apiService } from '../../services/apiService';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';

const usersExportColumns: ExportColumnOption[] = [
  { id: 'name', label: 'Full Name' },
  { id: 'email', label: 'Email Address' },
  { id: 'role', label: 'Assigned Role' },
  { id: 'assignedSites', label: 'Assigned Hotels / Sites' },
  { id: 'status', label: 'Account Status' },
  { id: 'lastActive', label: 'Last Active' }
];

export const UsersView: React.FC = () => {
  const { 
    users, 
    userGroups,
    addUserGroup,
    updateUserGroup,
    deleteUserGroup,
    properties, 
    updateUser, 
    canManageUsers,
    currentUserRole,
    syncFromDatabase
  } = useApp();

  const [activeMainTab, setActiveMainTab] = useState<'users' | 'groups'>('users');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([
    'Super Admin',
    'Admin',
    'Regional Manager',
    'General Manager',
    'Site Manager',
    'Staff',
    'Employee'
  ]);
  const [groupStatusFilter, setGroupStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Supabase Users list
  const displayedUsers = useMemo(() => {
    return (users || []).map((u) => {
      const sites = Array.isArray(u.assignedSites) && u.assignedSites.length > 0
        ? Array.from(new Set(u.assignedSites.filter(Boolean)))
        : [(u as any).assignedSite || 'All Sites'];

      return {
        ...u,
        name: u.name || u.email?.split('@')[0] || 'User',
        role: (u.role || 'Staff') as RoleType,
        assignedSites: sites,
        status: u.status === 'Inactive' ? ('Inactive' as const) : ('Active' as const),
        lastActive: u.lastActive || 'Recently'
      };
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [users]);

  // Modal states for Property Assignment
  const [assigningUser, setAssigningUser] = useState<UserAccount | null>(null);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [isAllSitesSelected, setIsAllSitesSelected] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<RoleType>('Staff');
  const [selectedStatus, setSelectedStatus] = useState<'Active' | 'Inactive'>('Active');
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Modal states for Add User directly in Supabase
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserFormData, setNewUserFormData] = useState<{
    name: string;
    email: string;
    password: string;
    role: RoleType;
    assignedSite: string;
  }>({
    name: '',
    email: '',
    password: '',
    role: 'Staff',
    assignedSite: 'All Sites'
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccessNotice, setCreateSuccessNotice] = useState<string | null>(null);

  // Modal states for Group
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [groupFormData, setGroupFormData] = useState<{
    name: string;
    description: string;
    assignedProperty: string;
    userIds: string[];
  }>({
    name: '',
    description: '',
    assignedProperty: properties[0]?.name || '',
    userIds: []
  });

  const hasAdminAuthority = canManageUsers();
  const isAuthorized = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';

  const handleRefreshSupabase = async () => {
    setIsRefreshing(true);
    try {
      await syncFromDatabase();
    } catch (err) {
      console.warn('Sync error:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleOpenAssignProperties = (user: UserAccount) => {
    setAssigningUser(user);
    const sites = Array.isArray(user.assignedSites) && user.assignedSites.length > 0
      ? user.assignedSites
      : [(user as any).assignedSite || 'All Sites'];

    const hasAll = sites.includes('All Sites') || sites.includes('All');
    setIsAllSitesSelected(hasAll);
    setSelectedSites(hasAll ? properties.map(p => p.name) : sites);
    setSelectedRole(user.role || 'Employee');
    setSelectedStatus(user.status === 'Inactive' ? 'Inactive' : 'Active');
    setSaveSuccessNotice(null);
  };

  const handleToggleProperty = (propName: string) => {
    if (isAllSitesSelected) {
      setIsAllSitesSelected(false);
      setSelectedSites([propName]);
      return;
    }
    if (selectedSites.includes(propName)) {
      setSelectedSites(selectedSites.filter(s => s !== propName));
    } else {
      setSelectedSites([...selectedSites, propName]);
    }
  };

  const handleSelectAllSites = () => {
    setIsAllSitesSelected(true);
    setSelectedSites(properties.map(p => p.name));
  };

  const handleClearSites = () => {
    setIsAllSitesSelected(false);
    setSelectedSites([]);
  };

  const handleSavePropertyAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningUser) return;

    setIsSavingAssignment(true);
    try {
      const finalSites = isAllSitesSelected
        ? ['All Sites']
        : (selectedSites.length > 0 ? selectedSites : ['All Sites']);

      await updateUser(assigningUser.id, {
        assignedSites: finalSites,
        role: selectedRole,
        status: selectedStatus
      });

      // Instantly synchronize the latest state from Supabase
      await syncFromDatabase();

      setSaveSuccessNotice(`Role changed to "${selectedRole}" and property permissions updated for ${assigningUser.name || assigningUser.email}`);
      setTimeout(() => {
        setAssigningUser(null);
        setIsSavingAssignment(false);
        setSaveSuccessNotice(null);
      }, 900);
    } catch (err: any) {
      console.error('Failed to save assignment:', err);
      setIsSavingAssignment(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newUserFormData.name.trim() || !newUserFormData.email.trim() || !newUserFormData.password) {
      setCreateError('Please complete all required fields (Name, Email, and Password).');
      return;
    }
    if (newUserFormData.password.length < 6) {
      setCreateError('Password must be at least 6 characters long.');
      return;
    }

    setIsCreatingUser(true);
    try {
      const res = await apiService.registerUser({
        name: newUserFormData.name.trim(),
        email: newUserFormData.email.trim().toLowerCase(),
        password: newUserFormData.password,
        role: newUserFormData.role,
        assignedSite: newUserFormData.assignedSite
      });

      if (res.error) {
        setCreateError(res.error);
        setIsCreatingUser(false);
        return;
      }

      setCreateSuccessNotice(`User "${newUserFormData.name}" successfully created with role "${newUserFormData.role}" in Supabase!`);
      await syncFromDatabase();
      setTimeout(() => {
        setIsCreatingUser(false);
        setIsAddUserModalOpen(false);
        setCreateSuccessNotice(null);
        setNewUserFormData({
          name: '',
          email: '',
          password: '',
          role: 'Staff',
          assignedSite: 'All Sites'
        });
      }, 1100);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create user account.');
      setIsCreatingUser(false);
    }
  };

  const handleOpenCreateGroup = () => {
    setEditingGroup(null);
    const assignedProps = (userGroups || []).map(g => g.assignedProperty || g.assignedProperties?.[0]).filter(Boolean);
    const unassignedProp = properties.find(p => !assignedProps.includes(p.name))?.name || properties[0]?.name || '';
    setGroupFormData({
      name: unassignedProp ? `${unassignedProp} Team` : '',
      description: unassignedProp ? `Operations group for ${unassignedProp}` : '',
      assignedProperty: unassignedProp,
      userIds: []
    });
    setIsGroupModalOpen(true);
  };

  const handleGenerateAllPropertyGroups = () => {
    properties.forEach(p => {
      const existing = userGroups.find(g => g.assignedProperty === p.name || g.assignedProperties?.includes(p.name));
      if (!existing) {
        addUserGroup({
          name: `${p.name} Team`,
          description: `Operations group for ${p.name} (${p.city})`,
          assignedProperty: p.name,
          assignedProperties: [p.name],
          userIds: []
        });
      }
    });
  };

  const handleOpenEditGroup = (group: UserGroup) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      description: group.description,
      assignedProperty: group.assignedProperty || group.assignedProperties?.[0] || properties[0]?.name || '',
      userIds: group.userIds || []
    });
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupFormData.name.trim() || !groupFormData.assignedProperty) return;
    const payload = {
      name: groupFormData.name,
      description: groupFormData.description,
      assignedProperty: groupFormData.assignedProperty,
      assignedProperties: [groupFormData.assignedProperty],
      userIds: groupFormData.userIds
    };
    if (editingGroup) {
      updateUserGroup(editingGroup.id, payload);
    } else {
      addUserGroup(payload);
    }
    setIsGroupModalOpen(false);
  };

  const getRoleBadgeStyle = (role: RoleType | string) => {
    switch (role) {
      case 'Super Admin':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Admin':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'Regional Manager':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'General Manager':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Site Manager':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Staff':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Employee':
        return 'bg-cyan-50 text-cyan-800 border-cyan-200';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  const filteredUsers = useMemo(() => {
    return (displayedUsers || []).filter(u => {
      const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(u.role);
      const isAssignedToGroup = (userGroups || []).some(g => g.userIds?.includes(u.id));
      const matchesGroupStatus = 
        groupStatusFilter === 'all' ? true :
        groupStatusFilter === 'assigned' ? isAssignedToGroup :
        !isAssignedToGroup;

      if (!matchesRole || !matchesGroupStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const sites = Array.isArray(u.assignedSites) && u.assignedSites.length > 0
        ? u.assignedSites
        : [(u as any).assignedSite || ''];
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        sites.some(s => typeof s === 'string' && s.toLowerCase().includes(q))
      );
    });
  }, [displayedUsers, userGroups, selectedRoles, groupStatusFilter, searchQuery]);

  // Sort State for Users
  const [userSortField, setUserSortField] = useState<string>('name');
  const [userSortAsc, setUserSortAsc] = useState<boolean>(true);

  const handleUserSort = (field: string) => {
    if (userSortField === field) {
      setUserSortAsc(!userSortAsc);
    } else {
      setUserSortField(field);
      setUserSortAsc(true);
    }
  };

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      if (userSortField === 'name') {
        valA = a.name || '';
        valB = b.name || '';
      } else if (userSortField === 'email') {
        valA = a.email || '';
        valB = b.email || '';
      } else if (userSortField === 'role') {
        valA = a.role || '';
        valB = b.role || '';
      } else if (userSortField === 'assignedSites') {
        valA = (Array.isArray(a.assignedSites) ? a.assignedSites : [(a as any).assignedSite || '']).join(', ');
        valB = (Array.isArray(b.assignedSites) ? b.assignedSites : [(b as any).assignedSite || '']).join(', ');
      } else if (userSortField === 'status') {
        valA = a.status || '';
        valB = b.status || '';
      } else if (userSortField === 'lastActive') {
        valA = a.lastActive || '';
        valB = b.lastActive || '';
      }
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return userSortAsc ? -1 : 1;
      if (valA > valB) return userSortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredUsers, userSortField, userSortAsc]);

  const filteredGroups = useMemo(() => {
    return (userGroups || []).filter(g => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (g.name || '').toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q) ||
        (g.assignedProperty && typeof g.assignedProperty === 'string' && g.assignedProperty.toLowerCase().includes(q)) ||
        (g.assignedProperties && g.assignedProperties.some(p => typeof p === 'string' && p.toLowerCase().includes(q)))
      );
    });
  }, [userGroups, searchQuery]);

  const getExportDataForScope = (scope: ExportScope) => {
    return scope === 'filtered' ? sortedUsers : displayedUsers;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (u: UserAccount) => string | number }> => ({
    name: { label: 'Full Name', getValue: u => u.name },
    email: { label: 'Email Address', getValue: u => u.email },
    role: { label: 'Assigned Role', getValue: u => u.role },
    assignedSites: { 
      label: 'Assigned Hotels / Sites', 
      getValue: u => {
        const sites = Array.isArray(u.assignedSites) && u.assignedSites.length > 0
          ? u.assignedSites
          : [(u as any).assignedSite || 'None'];
        return sites.join(', ') || 'None';
      } 
    },
    status: { label: 'Account Status', getValue: u => u.status },
    lastActive: { label: 'Last Active', getValue: u => u.lastActive || '—' }
  });

  const getExportPreviewData = ({
    scope,
    selectedColumns
  }: {
    scope: ExportScope;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    orientation: ExportOrientation;
    isCompact: boolean;
  }) => {
    const dataToExport = getExportDataForScope(scope);
    const colMap = getExportColumnMap();
    const cols = selectedColumns && selectedColumns.length > 0 
      ? selectedColumns 
      : usersExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(u => activeCols.map(c => colMap[c].getValue(u)));
    return { headers, rows };
  };

  const handlePerformExport = ({
    format,
    scope,
    orientation = 'landscape',
    selectedColumns,
    isCompact = false
  }: {
    format: ExportFormat;
    scope: ExportScope;
    orientation?: ExportOrientation;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => {
    const dataToExport = getExportDataForScope(scope);
    const cols = selectedColumns && selectedColumns.length > 0 
      ? selectedColumns 
      : usersExportColumns.map(c => c.id);

    const colMap = getExportColumnMap();
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(u => activeCols.map(c => colMap[c].getValue(u)));

    const title = 'Supabase Users & Property Assignments';
    const filename = `Users-Assignments-${scope}-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'csv') {
      exportTableToCsv({
        filename: `${filename}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title,
        subtitle: `Generated on ${new Date().toLocaleDateString()} (${scope.toUpperCase()} scope)`,
        filename: `${filename}.pdf`,
        headers,
        rows,
        orientation,
        isCompact,
        metadata: [
          { label: 'Export Scope', value: scope === 'filtered' ? 'Filtered Users' : 'All Users' },
          { label: 'Total Exported', value: dataToExport.length }
        ]
      });
    }
  };

  if (!isAuthorized) {
    return (
      <div className="bg-white border border-[#e1dfdd] rounded-xs p-10 shadow-xs text-center max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4 text-red-600">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-[#242424] mb-2">Access Restricted</h2>
        <p className="text-xs text-[#605e5c] leading-relaxed mb-4">
          Property and user assignment operations are restricted to <strong>Super Admin</strong> and <strong>Admin</strong> roles only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#0d9488]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">Supabase Users &amp; Role Assignments</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-xs font-semibold bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Supabase Managed</span>
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            User logins and credentials are managed in Supabase. Assign operational roles and hotel property access below.
          </p>
        </div>

          <div className="flex items-center gap-2">
            {hasAdminAuthority && (
              <button
                onClick={() => {
                  setCreateError(null);
                  setCreateSuccessNotice(null);
                  setIsAddUserModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-2xs transition-colors"
                title="Create a new user account in Supabase Auth"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add User</span>
              </button>
            )}

            <button
              onClick={handleRefreshSupabase}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs text-xs font-semibold shadow-2xs transition-colors disabled:opacity-60"
              title="Pull latest users and permissions from Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#0d9488] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Refresh from Supabase'}</span>
            </button>

            <ExportDropdown
              moduleName="Users & Assignments"
              totalRecordCount={displayedUsers.length}
              filteredRecordCount={sortedUsers.length}
              defaultOrientation="landscape"
              availableColumns={usersExportColumns}
              getPreviewData={getExportPreviewData}
              onExport={handlePerformExport}
              buttonVariant="toolbar"
            />

            {hasAdminAuthority && activeMainTab === 'groups' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateAllPropertyGroups}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#f0fdfa] hover:bg-[#ccfbf1] text-[#0f766e] border border-[#5eead4] rounded-xs text-xs font-semibold shadow-2xs transition-colors"
                  title="Automatically create staff groups for all properties"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Generate Property Teams</span>
                </button>
                <button
                  onClick={handleOpenCreateGroup}
                  className="flex items-center gap-2 px-3.5 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs transition-colors"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Create Team</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Informational Callout */}
        <div className="mt-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xs p-3 flex items-start gap-2.5 text-xs text-[#475569]">
          <Building2 className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[#1e293b]">User Management Notice: </span>
            User logins and accounts are authenticated through Supabase. Use <strong>+ Add User</strong> to register new team members, or click <strong>Assign Role</strong> on any user in the table to modify operational roles (Staff, Employee, Site Manager, Admin, etc.) and assigned hotel properties.
          </div>
        </div>

      {/* Main Tab Navigation */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs p-2 shadow-xs flex items-center gap-2">
        <button
          onClick={() => setActiveMainTab('users')}
          className={`px-4 py-2 text-xs font-bold rounded-xs transition-colors flex items-center gap-2 ${
            activeMainTab === 'users'
              ? 'bg-[#0d9488] text-white shadow-xs'
              : 'text-[#323130] hover:bg-[#edebe9]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Supabase Users ({displayedUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('groups')}
          className={`px-4 py-2 text-xs font-bold rounded-xs transition-colors flex items-center gap-2 ${
            activeMainTab === 'groups'
              ? 'bg-[#0d9488] text-white shadow-xs'
              : 'text-[#323130] hover:bg-[#edebe9]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Property Teams &amp; Staff Groups ({userGroups.length})</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs p-3 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#605e5c] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeMainTab === 'users' ? "Search by name, email, or property..." : "Search property teams..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#8a8886] rounded-xs focus:outline-hidden focus:border-[#0d9488]"
            />
          </div>

          {activeMainTab === 'users' && (
            <div className="flex items-center gap-1.5 bg-[#faf9f8] border border-[#d2d0ce] rounded-xs px-2.5 py-1 text-xs flex-wrap">
              <span className="font-semibold text-[#323130] mr-1">Role Filter:</span>
              {['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Site Manager', 'Staff', 'Employee'].map(r => {
                const isChecked = selectedRoles.includes(r);
                return (
                  <label key={r} className="flex items-center gap-1 cursor-pointer select-none px-1 py-0.5 hover:bg-neutral-200/60 rounded-xs">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedRoles([...selectedRoles, r]);
                        } else {
                          setSelectedRoles(selectedRoles.filter(item => item !== r));
                        }
                      }}
                      className="rounded-xs text-[#0d9488] focus:ring-[#0d9488]"
                    />
                    <span className="text-[#323130] text-[11px]">{r}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* TAB CONTENT: USERS */}
      {activeMainTab === 'users' && (
        <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#edebe9] text-[#605e5c] font-semibold bg-[#faf9f8] select-none whitespace-nowrap">
                  <th onClick={() => handleUserSort('name')} className="p-3 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Name">
                    <div className="flex items-center gap-1">
                      <span>User &amp; Supabase Email</span>
                      {userSortField === 'name' ? (userSortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                    </div>
                  </th>
                  <th onClick={() => handleUserSort('role')} className="p-3 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Role">
                    <div className="flex items-center gap-1">
                      <span>Role</span>
                      {userSortField === 'role' ? (userSortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                    </div>
                  </th>
                  <th onClick={() => handleUserSort('assignedSites')} className="p-3 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Assigned Properties">
                    <div className="flex items-center gap-1">
                      <span>Assigned Hotel Properties</span>
                      {userSortField === 'assignedSites' ? (userSortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                    </div>
                  </th>
                  <th onClick={() => handleUserSort('status')} className="p-3 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Status">
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      {userSortField === 'status' ? (userSortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                    </div>
                  </th>
                  <th onClick={() => handleUserSort('lastActive')} className="p-3 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Last Active">
                    <div className="flex items-center gap-1">
                      <span>Last Active</span>
                      {userSortField === 'lastActive' ? (userSortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                    </div>
                  </th>
                  <th className="p-3 text-right">Role &amp; Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edebe9]">
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-neutral-400 italic">
                      No users found in Supabase matching your search or filters.
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map(u => (
                    <tr key={u.id || `${u.email}-${u.name}`} className="hover:bg-[#f3f8fd] transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-[#242424] flex items-center gap-1.5">
                          <span>{u.name}</span>
                          <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.2 rounded font-mono">
                            Supabase Auth
                          </span>
                        </div>
                        <div className="text-[11px] text-[#605e5c]">{u.email}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getRoleBadgeStyle(u.role)}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 text-[#323130]">
                        <div className="flex flex-wrap gap-1">
                          {Array.from(new Set(
                            (Array.isArray(u.assignedSites) && u.assignedSites.length > 0
                              ? u.assignedSites
                              : [(u as any).assignedSite || 'All Sites']
                            ).filter((s): s is string => Boolean(s && typeof s === 'string'))
                          )).map((site, sIdx) => {
                            const isAll = site === 'All Sites' || site === 'All';
                            return (
                              <span 
                                key={`${u.id || u.email || 'user'}-${site}-${sIdx}`} 
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                  isAll 
                                    ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold' 
                                    : 'bg-teal-50 text-teal-800 border-teal-200'
                                }`}
                              >
                                {site}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.status === 'Active' ? 'bg-[#f0fdfa] text-[#0d9488] border border-[#5eead4]' : 'bg-neutral-100 text-neutral-600 border border-neutral-300'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="p-3 text-neutral-500 text-[11px]">
                        {u.lastActive || '—'}
                      </td>
                      <td className="p-3 text-right">
                        {hasAdminAuthority && (
                          <button
                            onClick={() => handleOpenAssignProperties(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488]/10 hover:bg-[#0d9488]/20 text-[#0f766e] border border-[#0d9488]/40 hover:border-[#0d9488] rounded-xs text-xs font-semibold transition-colors shadow-2xs"
                            title="Assign role and property permissions to this user"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-[#0d9488]" />
                            <span>Assign Role</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: GROUPS */}
      {activeMainTab === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGroups.length === 0 ? (
            <div className="col-span-full bg-white border border-[#e1dfdd] rounded-xs p-12 text-center text-neutral-400 italic shadow-xs">
              No property teams created yet. Click "Create Team" to assign staff groups to properties.
            </div>
          ) : (
            filteredGroups.map(group => {
              const groupUsers = displayedUsers.filter(u => group.userIds?.includes(u.id));
              return (
                <div key={group.id} className="bg-white border border-[#e1dfdd] rounded-xs p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xs bg-teal-50 text-[#0d9488] flex items-center justify-center font-bold">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[#242424]">{group.name}</h3>
                          <p className="text-[11px] text-[#605e5c]">{group.description || 'No description provided.'}</p>
                        </div>
                      </div>
                      {hasAdminAuthority && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditGroup(group)}
                            className="p-1.5 hover:bg-[#edebe9] text-[#605e5c] rounded-xs"
                            title="Edit Team"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteUserGroup(group.id)}
                            className="p-1.5 hover:bg-red-50 text-neutral-400 hover:text-red-600 rounded-xs"
                            title="Delete Team"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-3 text-xs">
                      <div>
                        <span className="font-semibold text-neutral-600 block mb-1">Assigned Property:</span>
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(group.assignedProperties) && group.assignedProperties.length > 0 ? (
                            group.assignedProperties.map(prop => (
                              <span key={prop} className="bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded text-[11px] font-medium border border-neutral-200">
                                {prop}
                              </span>
                            ))
                          ) : group.assignedProperty ? (
                            <span className="bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded text-[11px] font-medium border border-neutral-200">
                              {group.assignedProperty}
                            </span>
                          ) : (
                            <span className="text-neutral-400 italic">No property assigned</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="font-semibold text-neutral-600 block mb-1">Assigned Members ({groupUsers.length}):</span>
                        <div className="max-h-28 overflow-y-auto divide-y divide-[#edebe9] border border-[#edebe9] rounded-xs p-1 bg-[#faf9f8]">
                          {Array.isArray(groupUsers) && groupUsers.length > 0 ? (
                            groupUsers.map(u => (
                              <div key={u.id} className="py-1 px-1.5 flex items-center justify-between text-[11px]">
                                <span className="font-medium text-[#242424]">{u.name}</span>
                                <span className="text-neutral-500">({u.role})</span>
                              </div>
                            ))
                          ) : (
                            <div className="py-2 text-center text-neutral-400 italic">No members assigned to this team</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#edebe9] flex items-center justify-between text-[11px] text-neutral-500">
                    <span>Team ID: {group.id}</span>
                    <span className="font-semibold text-teal-800">Operational Scope</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ASSIGN PROPERTIES MODAL */}
      {assigningUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-[#f8f9fa] border-b border-[#e1dfdd] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424]">Assign Role &amp; Permissions</h3>
              </div>
              <button onClick={() => setAssigningUser(null)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePropertyAssignment} className="p-5 space-y-4 text-xs">
              {/* User Details (Read-Only from Supabase) */}
              <div className="bg-[#f8fafc] border border-[#e2e8f0] p-3 rounded-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[#1e293b] text-sm">{assigningUser.name}</div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-mono font-semibold">
                    Supabase User
                  </span>
                </div>
                <div className="text-[#64748b] text-[11px]">Email: {assigningUser.email}</div>
                <div className="text-[10px] text-[#94a3b8]">User ID: {assigningUser.id}</div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Operational Role</label>
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value as RoleType)}
                  className="w-full px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white focus:outline-hidden focus:border-[#0d9488]"
                >
                  <option value="Super Admin">Super Admin</option>
                  <option value="Admin">Admin</option>
                  <option value="Regional Manager">Regional Manager</option>
                  <option value="General Manager">General Manager</option>
                  <option value="Site Manager">Site Manager</option>
                  <option value="Staff">Staff</option>
                  <option value="Employee">Employee</option>
                </select>
                <p className="text-[10px] text-neutral-500 mt-1">
                  Determines system permissions and view scope across modules.
                </p>
              </div>

              {/* Property / Hotel Assignments */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-[#323130]">Assigned Hotel Properties</label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllSites}
                      className="text-[#0d9488] hover:underline font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-neutral-300">|</span>
                    <button
                      type="button"
                      onClick={handleClearSites}
                      className="text-neutral-500 hover:underline font-medium"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* All Sites Option */}
                <div 
                  onClick={() => {
                    if (isAllSitesSelected) {
                      setIsAllSitesSelected(false);
                      setSelectedSites([]);
                    } else {
                      handleSelectAllSites();
                    }
                  }}
                  className={`p-2.5 rounded-xs border mb-2 cursor-pointer transition-colors flex items-center justify-between ${
                    isAllSitesSelected 
                      ? 'bg-[#f0fdfa] border-[#5eead4] text-[#0f766e]' 
                      : 'bg-[#faf9f8] border-[#e1dfdd] text-[#323130] hover:bg-neutral-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isAllSitesSelected}
                      onChange={() => {}} // Handled by div click
                      className="rounded-xs text-[#0d9488] focus:ring-[#0d9488]"
                    />
                    <span className="font-bold">System-Wide Access (All Properties)</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider">
                    {properties.length} Properties
                  </span>
                </div>

                {/* Individual Properties Checkbox List */}
                <div className="max-h-48 overflow-y-auto border border-[#d2d0ce] rounded-xs p-2 divide-y divide-[#edebe9] bg-white">
                  {properties.map(p => {
                    const isChecked = isAllSitesSelected || selectedSites.includes(p.name);
                    return (
                      <label 
                        key={p.id || p.name} 
                        className="py-1.5 px-1 flex items-center justify-between hover:bg-[#f3f2f1] rounded-xs cursor-pointer select-none text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleProperty(p.name)}
                            className="rounded-xs text-[#0d9488] focus:ring-[#0d9488]"
                          />
                          <span className="font-medium text-[#242424]">{p.name}</span>
                        </div>
                        <span className="text-[10px] text-neutral-500">{p.city} ({p.totalRooms || 0} rooms)</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Account Operational Status</label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white focus:outline-hidden focus:border-[#0d9488]"
                >
                  <option value="Active">Active (Granted Access)</option>
                  <option value="Inactive">Inactive (Access Suspended)</option>
                </select>
              </div>

              {saveSuccessNotice && (
                <div className="p-2.5 rounded-xs text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{saveSuccessNotice}</span>
                </div>
              )}

              <div className="pt-3 border-t border-[#edebe9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssigningUser(null)}
                  className="px-3.5 py-1.5 bg-[#edebe9] hover:bg-[#e1dfdd] text-[#323130] font-semibold rounded-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAssignment}
                  className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold rounded-xs shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingAssignment ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving in Supabase...</span>
                    </>
                  ) : (
                    <span>Save Role &amp; Access</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD USER MODAL */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in duration-150">
            <div className="px-5 py-3.5 bg-[#f8f9fa] border-b border-[#e1dfdd] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424]">Add New Supabase User</h3>
              </div>
              <button 
                onClick={() => setIsAddUserModalOpen(false)} 
                className="text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Johnson"
                  value={newUserFormData.name}
                  onChange={e => setNewUserFormData({ ...newUserFormData, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white focus:outline-hidden focus:border-[#0d9488]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Email Address <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  required
                  placeholder="alex@sdcommercial.co.uk"
                  value={newUserFormData.email}
                  onChange={e => setNewUserFormData({ ...newUserFormData, email: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white focus:outline-hidden focus:border-[#0d9488]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Initial Password <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={newUserFormData.password}
                  onChange={e => setNewUserFormData({ ...newUserFormData, password: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white focus:outline-hidden focus:border-[#0d9488]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Operational Role</label>
                  <select
                    value={newUserFormData.role}
                    onChange={e => setNewUserFormData({ ...newUserFormData, role: e.target.value as RoleType })}
                    className="w-full px-2.5 py-1.5 border border-[#8a8886] rounded-xs bg-white focus:outline-hidden focus:border-[#0d9488]"
                  >
                    <option value="Staff">Staff</option>
                    <option value="Employee">Employee</option>
                    <option value="Site Manager">Site Manager</option>
                    <option value="General Manager">General Manager</option>
                    <option value="Regional Manager">Regional Manager</option>
                    <option value="Admin">Admin</option>
                    <option value="Super Admin">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Hotel Property</label>
                  <select
                    value={newUserFormData.assignedSite}
                    onChange={e => setNewUserFormData({ ...newUserFormData, assignedSite: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#8a8886] rounded-xs bg-white focus:outline-hidden focus:border-[#0d9488]"
                  >
                    <option value="All Sites">All Sites (Global)</option>
                    {properties.map(p => (
                      <option key={p.id || p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {createError && (
                <div className="p-2.5 rounded-xs text-xs bg-red-50 text-red-700 border border-red-200">
                  {createError}
                </div>
              )}

              {createSuccessNotice && (
                <div className="p-2.5 rounded-xs text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{createSuccessNotice}</span>
                </div>
              )}

              <div className="pt-3 border-t border-[#edebe9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-3.5 py-1.5 bg-[#edebe9] hover:bg-[#e1dfdd] text-[#323130] font-semibold rounded-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold rounded-xs shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isCreatingUser ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating in Supabase...</span>
                    </>
                  ) : (
                    <span>Create User</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT STAFF GROUP MODAL */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-[#f8f9fa] border-b border-[#e1dfdd] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424]">
                  {editingGroup ? 'Edit Property Team' : 'Create New Property Team'}
                </h3>
              </div>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Team Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. North London Operations Group"
                  value={groupFormData.name}
                  onChange={e => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white focus:outline-hidden focus:border-[#0d9488]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Manages properties and welfare operations"
                  value={groupFormData.description}
                  onChange={e => setGroupFormData({ ...groupFormData, description: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white focus:outline-hidden focus:border-[#0d9488]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Assigned Property *</label>
                <select
                  value={groupFormData.assignedProperty}
                  onChange={e => setGroupFormData({ ...groupFormData, assignedProperty: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white focus:outline-hidden focus:border-[#0d9488]"
                >
                  {properties.map((p, pIdx) => {
                    const otherGroup = userGroups.find(g => (g.assignedProperty === p.name || g.assignedProperties?.includes(p.name)) && g.id !== editingGroup?.id);
                    const isAssignedElsewhere = Boolean(otherGroup);
                    return (
                      <option key={`${p.id || p.name}-${pIdx}`} value={p.name} disabled={isAssignedElsewhere}>
                        {p.name} {isAssignedElsewhere ? `(Already assigned: ${otherGroup?.name})` : `(${p.city})`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Select Team Members</label>
                <div className="border border-[#8a8886] rounded-xs max-h-40 overflow-y-auto divide-y divide-[#edebe9] bg-white p-1">
                  {displayedUsers.map(u => {
                    const otherGroup = userGroups.find(g => g.id !== editingGroup?.id && g.userIds?.includes(u.id));
                    const isAssignedElsewhere = Boolean(otherGroup);
                    const isChecked = groupFormData.userIds.includes(u.id);
                    return (
                      <div key={u.id} className={`p-1.5 flex items-center justify-between text-xs hover:bg-[#f3f2f1] ${isAssignedElsewhere ? 'opacity-60 bg-neutral-50' : ''}`}>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={isAssignedElsewhere}
                            checked={isChecked}
                            onChange={e => {
                              if (isAssignedElsewhere) return;
                              if (e.target.checked) {
                                setGroupFormData({
                                  ...groupFormData,
                                  userIds: [...groupFormData.userIds, u.id]
                                });
                              } else {
                                setGroupFormData({
                                  ...groupFormData,
                                  userIds: groupFormData.userIds.filter(id => id !== u.id)
                                });
                              }
                            }}
                            className="w-3.5 h-3.5 text-[#0d9488] rounded-xs border-neutral-300"
                          />
                          <span className="font-medium text-[#242424]">{u.name} <span className="text-[10px] text-neutral-500">({u.role})</span></span>
                        </div>
                        {isAssignedElsewhere ? (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                            Assigned to: {otherGroup?.name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400">{u.email}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[#edebe9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-3.5 py-1.5 bg-[#edebe9] hover:bg-[#e1dfdd] text-[#323130] font-semibold rounded-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold rounded-xs shadow-xs"
                >
                  {editingGroup ? 'Update Team' : 'Save Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
