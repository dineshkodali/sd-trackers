import React, { useState, useMemo } from 'react';
import { 
  KeyRound, 
  Check, 
  X, 
  ShieldCheck, 
  ShieldAlert, 
  Save, 
  RotateCcw, 
  FileSpreadsheet, 
  Printer,
  Search,
  CheckCircle2,
  Lock,
  Unlock,
  SlidersHorizontal,
  FileText,
  Building2,
  Users2,
  FolderLock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RoleType, RolePermissions } from '../../types';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';

interface PermissionItem {
  key: keyof RolePermissions;
  label: string;
  desc: string;
  category: 'Record & Case Management' | 'Visibility & Compliance' | 'Governance & Administration';
}

export const RolesView: React.FC = () => {
  const {
    currentUserRole,
    setCurrentUserRole,
    rolePermissions,
    updateRolePermissions,
    resetRolePermissions,
    canManageRoles
  } = useApp();

  const [localPermissions, setLocalPermissions] = useState<Record<RoleType, RolePermissions>>(() => ({
    ...rolePermissions
  }));
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'granted' | 'restricted'>('all');

  const canEditRBAC = canManageRoles();

  const ROLES_LIST: { 
    role: RoleType; 
    title: string; 
    subtitle: string; 
    desc: string; 
    badgeColor: string; 
    scope: string;
  }[] = [
    { 
      role: 'Super Admin', 
      title: 'Super Admin', 
      subtitle: 'Master Governance',
      desc: 'Full unrestricted system governance, RBAC customization, database management, and global audit oversight.',
      badgeColor: 'bg-[#f4ebf9] text-[#5c2d91] border-[#d8bde6]',
      scope: 'Global System Scope'
    },
    { 
      role: 'Admin', 
      title: 'Admin', 
      subtitle: 'Operational Manager',
      desc: 'Multi-site operations, accommodation properties, staff accounts provisioning, and compliance dossiers.',
      badgeColor: 'bg-[#f0fdfa] text-[#0f766e] border-[#5eead4]',
      scope: 'Multi-Site Scope'
    },
    { 
      role: 'Regional Manager', 
      title: 'Regional Manager', 
      subtitle: 'Cluster Supervisor',
      desc: 'Multi-property cluster supervision, proof file attachments CRUD, incident escalations, and audits.',
      badgeColor: 'bg-[#e6f7f7] text-[#005b5b] border-[#a2dede]',
      scope: 'Regional Cluster Scope'
    },
    { 
      role: 'General Manager', 
      title: 'General Manager', 
      subtitle: 'Facility Lead',
      desc: 'Facility lead responsible for local resident safeguarding, SPCD compliance, and welfare execution.',
      badgeColor: 'bg-[#fff8ed] text-[#8a3700] border-[#fedbb0]',
      scope: 'Assigned Property Scope'
    },
    { 
      role: 'Employee', 
      title: 'Employee', 
      subtitle: 'Frontline Staff',
      desc: 'Frontline duty staff handling daily welfare logs, hot meals, laundry support, and direct safeguarding referrals.',
      badgeColor: 'bg-[#f1faf0] text-[#107c10] border-[#cbe8cb]',
      scope: 'Assigned Property Scope'
    }
  ];

  const PERMISSION_ITEMS: PermissionItem[] = [
    // Record & Case Management
    { 
      key: 'canCreateRecords', 
      label: 'Create Records', 
      desc: 'Submit new safeguarding referrals, daily welfare logs, and SPCD updates',
      category: 'Record & Case Management'
    },
    { 
      key: 'canEditRecords', 
      label: 'Edit Records', 
      desc: 'Update existing case files, service user profiles, and incident details',
      category: 'Record & Case Management'
    },
    { 
      key: 'canDeleteRecords', 
      label: 'Delete Records', 
      desc: 'Permanently remove logs and referral cases from the system database',
      category: 'Record & Case Management'
    },
    { 
      key: 'canArchiveRestore', 
      label: 'Archive / Restore', 
      desc: 'Move completed cases to archive registers or restore previously archived cases',
      category: 'Record & Case Management'
    },
    // Visibility & Compliance
    { 
      key: 'canViewAllProperties', 
      label: 'Multi-Site Visibility', 
      desc: 'Inspect records, occupancy, and escalations across all accommodation locations',
      category: 'Visibility & Compliance'
    },
    { 
      key: 'canExportData', 
      label: 'Export Compliance Reports', 
      desc: 'Generate official CSV dossiers and PDF reports for audit oversight',
      category: 'Visibility & Compliance'
    },
    { 
      key: 'canManageFiles', 
      label: 'Document & Proof Files CRUD', 
      desc: 'Upload, replace, and delete document attachments and safeguarding evidence',
      category: 'Visibility & Compliance'
    },
    // Governance & Administration
    { 
      key: 'canManageProperties', 
      label: 'Property Directory Management', 
      desc: 'Add new hotel locations, edit property details, and manage site facilities',
      category: 'Governance & Administration'
    },
    { 
      key: 'canManageUsers', 
      label: 'Staff User Management', 
      desc: 'Provision staff user accounts, assign roles, and bind property locations',
      category: 'Governance & Administration'
    },
    { 
      key: 'canManageSettings', 
      label: 'System & Security Settings', 
      desc: 'Configure data retention policies, lockouts, audit logs, and system preferences',
      category: 'Governance & Administration'
    }
  ];

  const categories = [
    { id: 'all', label: 'All Categories' },
    { id: 'Record & Case Management', label: 'Record Management' },
    { id: 'Visibility & Compliance', label: 'Visibility & Compliance' },
    { id: 'Governance & Administration', label: 'Governance & Administration' }
  ];

  // Calculate unsaved changes count
  const unsavedChangesCount = useMemo(() => {
    let count = 0;
    for (const r of ROLES_LIST) {
      const roleKey = r.role;
      for (const p of PERMISSION_ITEMS) {
        if (localPermissions[roleKey]?.[p.key] !== rolePermissions[roleKey]?.[p.key]) {
          count++;
        }
      }
    }
    return count;
  }, [localPermissions, rolePermissions]);

  // Filtered permissions
  const filteredPermissions = useMemo(() => {
    return PERMISSION_ITEMS.filter(item => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchLabel = (item.label || '').toLowerCase().includes(query);
        const matchDesc = (item.desc || '').toLowerCase().includes(query);
        if (!matchLabel && !matchDesc) return false;
      }
      if (statusFilter === 'granted') {
        if (!localPermissions[currentUserRole]?.[item.key]) return false;
      } else if (statusFilter === 'restricted') {
        if (localPermissions[currentUserRole]?.[item.key]) return false;
      }
      return true;
    });
  }, [selectedCategory, searchQuery, statusFilter, localPermissions, currentUserRole]);

  // Group filtered permissions by category
  const groupedPermissions = useMemo(() => {
    const groups: { category: string; icon: React.ReactNode; items: PermissionItem[] }[] = [];
    const catMap: Record<string, PermissionItem[]> = {};

    filteredPermissions.forEach(item => {
      if (!catMap[item.category]) {
        catMap[item.category] = [];
      }
      catMap[item.category].push(item);
    });

    const categoryIcons: Record<string, React.ReactNode> = {
      'Record & Case Management': <FileText className="w-4 h-4 text-[#0d9488]" />,
      'Visibility & Compliance': <FolderLock className="w-4 h-4 text-[#005b5b]" />,
      'Governance & Administration': <Building2 className="w-4 h-4 text-[#5c2d91]" />
    };

    ['Record & Case Management', 'Visibility & Compliance', 'Governance & Administration'].forEach(cat => {
      if (catMap[cat] && catMap[cat].length > 0) {
        groups.push({
          category: cat,
          icon: categoryIcons[cat] || <KeyRound className="w-4 h-4 text-[#0d9488]" />,
          items: catMap[cat]
        });
      }
    });

    return groups;
  }, [filteredPermissions]);

  const handleToggle = (role: RoleType, key: keyof RolePermissions) => {
    if (!canEditRBAC) return;
    setLocalPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [key]: !prev[role][key]
      }
    }));
    setSaveSuccess(false);
  };

  const handleGrantAllForRole = (role: RoleType) => {
    if (!canEditRBAC) return;
    setLocalPermissions(prev => {
      const updated = { ...prev[role] };
      PERMISSION_ITEMS.forEach(p => {
        updated[p.key] = true;
      });
      return { ...prev, [role]: updated };
    });
    setSaveSuccess(false);
  };

  const handleRevokeAllForRole = (role: RoleType) => {
    if (!canEditRBAC) return;
    setLocalPermissions(prev => {
      const updated = { ...prev[role] };
      PERMISSION_ITEMS.forEach(p => {
        // Protect critical admin permissions from accidental total lockout
        if (role === 'Super Admin' && (p.key === 'canManageSettings' || p.key === 'canEditRecords')) {
          return;
        }
        updated[p.key] = false;
      });
      return { ...prev, [role]: updated };
    });
    setSaveSuccess(false);
  };

  const handleSave = () => {
    if (!canEditRBAC) return;
    Object.entries(localPermissions).forEach(([role, perms]) => {
      updateRolePermissions(role as RoleType, perms);
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  const handleDiscardChanges = () => {
    setLocalPermissions({ ...rolePermissions });
    setSaveSuccess(false);
  };

  const handleRestoreSystemDefaults = () => {
    if (!canEditRBAC) return;
    resetRolePermissions();
    setLocalPermissions({ ...rolePermissions });
    setSaveSuccess(false);
  };

  const handleExportCsv = () => {
    const headers = ['Category', 'Permission Authority', 'Description', ...ROLES_LIST.map(r => r.title)];
    const rows = PERMISSION_ITEMS.map(item => [
      item.category,
      item.label,
      item.desc,
      ...ROLES_LIST.map(r => (localPermissions[r.role]?.[item.key] ? 'Granted' : 'Restricted'))
    ]);
    exportTableToCsv({
      filename: `role_permissions_matrix_${new Date().toISOString().split('T')[0]}`,
      headers,
      rows
    });
  };

  const handleExportPdf = () => {
    const headers = ['Permission Authority', 'Category', ...ROLES_LIST.map(r => r.title)];
    const rows = PERMISSION_ITEMS.map(item => [
      item.label,
      item.category,
      ...ROLES_LIST.map(r => (localPermissions[r.role]?.[item.key] ? 'YES' : 'NO'))
    ]);
    exportTableToPdf({
      title: 'Role-Based Access Control (RBAC) Matrix',
      subtitle: 'Official Security Permissions and Authority Governance Dossier',
      filename: `rbac_permissions_matrix_${new Date().toISOString().split('T')[0]}`,
      headers,
      rows,
      orientation: 'landscape',
      metadata: [
        { label: 'Active Operator', value: currentUserRole },
        { label: 'Export Date', value: new Date().toLocaleDateString('en-GB') },
        { label: 'Status', value: canEditRBAC ? 'Master Configuration' : 'Read-Only Audit' }
      ]
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* MAIN CONTAINER */}
      <div className="bg-white border border-[#edebe9] rounded-xs shadow-xs p-6 space-y-6">
        
        {/* Header & Global Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#edebe9]">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xs bg-[#f0fdfa] border border-[#5eead4] flex items-center justify-center text-[#0d9488] shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424]">Staff Roles &amp; Security Permissions</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f0fdfa] text-[#0f766e] border border-[#5eead4]">
                  5 Operational Roles
                </span>
              </div>
              <p className="text-xs text-[#605e5c]">
                Configure and review role-based access authorities, multi-site visibility, and data management permissions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 bg-white border border-[#edebe9] text-[#323130] hover:bg-[#faf9f8] text-xs font-semibold rounded-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Export complete permissions matrix as CSV spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#107c10]" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportPdf}
              className="px-3 py-1.5 bg-white border border-[#edebe9] text-[#323130] hover:bg-[#faf9f8] text-xs font-semibold rounded-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Export official printable PDF security dossier"
            >
              <Printer className="w-3.5 h-3.5 text-[#d83b01]" />
              <span>Export PDF</span>
            </button>

            {canEditRBAC && (
              <>
                <button
                  onClick={handleRestoreSystemDefaults}
                  className="px-3 py-1.5 bg-white border border-[#8a8886] text-[#323130] hover:bg-[#f3f2f1] text-xs font-semibold rounded-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="Reset all role permissions to system factory defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Defaults</span>
                </button>

                {unsavedChangesCount > 0 && (
                  <button
                    onClick={handleDiscardChanges}
                    className="px-3 py-1.5 bg-white border border-[#d83b01] text-[#d83b01] hover:bg-red-50 text-xs font-semibold rounded-xs flex items-center gap-1.5 transition-colors"
                  >
                    <span>Discard ({unsavedChangesCount})</span>
                  </button>
                )}

                <button
                  onClick={handleSave}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-xs shadow-xs flex items-center gap-1.5 transition-colors ${
                    unsavedChangesCount > 0
                      ? 'bg-[#0d9488] hover:bg-[#0f766e] text-white animate-pulse'
                      : 'bg-[#0d9488] hover:bg-[#0f766e] text-white'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Permissions {unsavedChangesCount > 0 ? `(${unsavedChangesCount})` : ''}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Alerts */}
        {saveSuccess && (
          <div className="p-3 bg-[#f1faf0] border border-[#cbe8cb] text-[#107c10] rounded-xs text-xs flex items-center gap-2 animate-fade-in">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="font-semibold">Security permissions successfully updated and enforced across all active sessions.</span>
          </div>
        )}

        {!canEditRBAC && (
          <div className="p-3 bg-[#fff8ed] border border-[#fedbb0] text-[#8a3700] rounded-xs text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#8a3700] shrink-0" />
              <span>
                You are currently signed in as <strong>{currentUserRole}</strong> (Read-Only). Switch to <strong>Super Admin</strong> to adjust security permissions.
              </span>
            </div>
            <button
              onClick={() => setCurrentUserRole('Super Admin')}
              className="text-xs font-bold text-[#0d9488] hover:underline shrink-0"
            >
              Switch to Super Admin
            </button>
          </div>
        )}

        {/* ROLE OVERVIEW CARDS: Direct Role Identity & Quick Switcher */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#605e5c]">
            <span className="font-semibold text-[#323130] flex items-center gap-1.5">
              <Users2 className="w-3.5 h-3.5 text-[#0d9488]" />
              Configured Roles &amp; Operational Scopes
            </span>
            <span>Click any role card to simulate testing under that active persona</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {ROLES_LIST.map(r => {
              const perms = localPermissions[r.role] || {};
              const activeCount = Object.values(perms).filter(Boolean).length;
              const isActive = currentUserRole === r.role;

              return (
                <div 
                  key={r.role}
                  onClick={() => setCurrentUserRole(r.role)}
                  className={`p-3 rounded-xs border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    isActive 
                      ? 'bg-[#f0f6ff] border-[#0d9488] shadow-xs ring-1 ring-[#0d9488]' 
                      : 'bg-[#faf9f8] border-[#edebe9] hover:bg-white hover:border-[#5eead4]'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${r.badgeColor}`}>
                        {r.title}
                      </span>
                      {isActive ? (
                        <span className="text-[10px] font-bold text-[#0d9488] flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-[#0d9488]" /> Active
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#8a8886] hover:text-[#0d9488]">
                          Switch
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-[#242424]">{r.subtitle}</div>
                    <p className="text-[11px] text-[#605e5c] line-clamp-2 leading-snug">{r.desc}</p>
                  </div>

                  <div className="pt-3 mt-2 border-t border-[#edebe9]/80 flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-[#0f766e]">{activeCount} / {PERMISSION_ITEMS.length} Granted</span>
                    <span className="text-[#8a8886] truncate max-w-[90px]">{r.scope.split(' ')[0]} Scope</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FILTER & SEARCH BAR */}
        <div className="p-3 bg-[#faf9f8] border border-[#edebe9] rounded-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a8886]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search authority, action or description..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#edebe9] rounded-xs focus:border-[#0d9488] focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#8a8886] hover:text-[#242424]"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#605e5c]" />
              <span className="text-[#605e5c] font-medium hidden md:inline">Category:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-white border border-[#edebe9] rounded-xs px-2 py-1.5 text-xs text-[#323130] focus:border-[#0d9488] focus:outline-hidden"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[#605e5c] font-medium hidden md:inline">Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-white border border-[#edebe9] rounded-xs px-2 py-1.5 text-xs text-[#323130] focus:border-[#0d9488] focus:outline-hidden"
              >
                <option value="all">All Authorities</option>
                <option value="granted">Granted in {currentUserRole}</option>
                <option value="restricted">Restricted in {currentUserRole}</option>
              </select>
            </div>
          </div>
        </div>

        {/* PERMISSION MATRIX TABLE */}
        <div className="border border-[#edebe9] rounded-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#323130]">
                  <th className="p-3 font-semibold min-w-[240px]">
                    <div className="flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-[#0d9488]" />
                      <span>Security Authority &amp; Description</span>
                    </div>
                  </th>
                  {ROLES_LIST.map(r => {
                    const isActive = currentUserRole === r.role;
                    return (
                      <th 
                        key={r.role} 
                        className={`p-3 font-semibold text-center min-w-[130px] ${
                          isActive ? 'bg-[#f0f6ff] border-x border-[#5eead4]' : ''
                        }`}
                      >
                        <div className="font-bold text-[#242424] flex items-center justify-center gap-1">
                          {r.title}
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#0d9488]"></span>}
                        </div>
                        <div className="text-[10px] text-[#605e5c] font-normal">{r.subtitle}</div>
                        
                        {canEditRBAC && (
                          <div className="flex items-center justify-center gap-1.5 mt-1.5 pt-1.5 border-t border-[#edebe9]/60">
                            <button
                              onClick={() => handleGrantAllForRole(r.role)}
                              className="text-[9px] font-semibold text-[#0d9488] hover:underline"
                              title={`Grant all permissions to ${r.role}`}
                            >
                              Grant All
                            </button>
                            <span className="text-[#edebe9]">|</span>
                            <button
                              onClick={() => handleRevokeAllForRole(r.role)}
                              className="text-[9px] font-semibold text-[#8a8886] hover:text-[#d83b01] hover:underline"
                              title={`Revoke non-essential permissions for ${r.role}`}
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {groupedPermissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-[#605e5c]">
                      No permissions match the selected search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  groupedPermissions.map(group => (
                    <React.Fragment key={group.category}>
                      {/* CATEGORY SECTION HEADER */}
                      <tr className="bg-[#f3f2f1]/80 border-t border-b border-[#edebe9]">
                        <td colSpan={6} className="px-3 py-1.5 text-[11px] font-bold text-[#323130] uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            {group.icon}
                            <span>{group.category}</span>
                            <span className="text-[10px] font-normal text-[#605e5c]">
                              ({group.items.length} {group.items.length === 1 ? 'authority' : 'authorities'})
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* PERMISSION ROWS */}
                      {group.items.map(item => {
                        return (
                          <tr key={item.key} className="hover:bg-[#faf9f8]/70 border-b border-[#edebe9] transition-colors">
                            <td className="p-3">
                              <div className="font-semibold text-[#242424] flex items-center gap-1.5">
                                <span>{item.label}</span>
                              </div>
                              <div className="text-[11px] text-[#605e5c] leading-relaxed mt-0.5">{item.desc}</div>
                            </td>

                            {ROLES_LIST.map(r => {
                              const isGranted = Boolean(localPermissions[r.role]?.[item.key]);
                              const isOriginalGranted = Boolean(rolePermissions[r.role]?.[item.key]);
                              const isModified = isGranted !== isOriginalGranted;
                              const isActiveRoleCol = currentUserRole === r.role;

                              return (
                                <td 
                                  key={r.role} 
                                  className={`p-3 text-center ${
                                    isActiveRoleCol ? 'bg-[#f0f6ff]/40 border-x border-[#5eead4]/60' : ''
                                  }`}
                                >
                                  <div className="flex flex-col items-center justify-center gap-1">
                                    <button
                                      disabled={!canEditRBAC}
                                      onClick={() => handleToggle(r.role, item.key)}
                                      className={`w-7 h-7 rounded-xs flex items-center justify-center transition-all ${
                                        isGranted 
                                          ? 'bg-[#f0fdfa] text-[#0d9488] border border-[#5eead4] hover:bg-[#d0e5fb]' 
                                          : 'bg-[#f3f2f1] text-[#8a8886] border border-[#edebe9] hover:bg-[#e1dfdd]'
                                      } ${
                                        !canEditRBAC ? 'cursor-default' : 'cursor-pointer hover:scale-105 shadow-2xs'
                                      } ${
                                        isModified ? 'ring-2 ring-amber-400' : ''
                                      }`}
                                      title={
                                        canEditRBAC 
                                          ? `Click to toggle ${item.label} for ${r.role} (${isGranted ? 'Granted' : 'Restricted'})` 
                                          : `${item.label} is ${isGranted ? 'Granted' : 'Restricted'} for ${r.role}`
                                      }
                                    >
                                      {isGranted ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                    </button>
                                    
                                    <span className={`text-[9px] font-semibold ${
                                      isGranted ? 'text-[#0f766e]' : 'text-[#8a8886]'
                                    }`}>
                                      {isGranted ? 'Granted' : 'Restricted'}
                                    </span>

                                    {isModified && (
                                      <span className="text-[8px] text-amber-700 font-bold">Unsaved</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER AUDIT NOTES */}
        <div className="p-3 bg-[#faf9f8] border border-[#edebe9] rounded-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#605e5c]">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>
              All role changes are logged to the immutable Audit Trail with actor timestamps and previous state snapshots.
            </span>
          </div>
          <div className="text-[11px] font-medium text-[#323130]">
            System Profile: <span className="text-[#0d9488] font-bold">RBAC Enterprise v2.4</span>
          </div>
        </div>

      </div>
    </div>
  );
};

