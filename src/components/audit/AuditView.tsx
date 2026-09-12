import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Download, 
  Trash2, 
  ShieldCheck, 
  Filter, 
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  UserCheck,
  Shield,
  Eye,
  X,
  ExternalLink,
  Clock,
  ArrowRight,
  Sparkles,
  Layers,
  FileText,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AuditLog } from '../../types';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';

type FilterTab = 'all' | 'accountability' | 'properties' | 'users' | 'casework';

const auditExportColumns: ExportColumnOption[] = [
  { id: 'timestamp', label: 'Timestamp' },
  { id: 'performedByUser', label: 'Logged By / User' },
  { id: 'performedByRole', label: 'User Role' },
  { id: 'module', label: 'Module' },
  { id: 'action', label: 'Action Type' },
  { id: 'targetItem', label: 'Target Item' },
  { id: 'site', label: 'Hotel / Site' },
  { id: 'details', label: 'Action Details' }
];

export const AuditView: React.FC = () => {
  const {
    auditLogs,
    currentUserRole,
    settings,
    setActivePage,
    canAccessAllSites,
    assignedSite,
    authProfile,
    currentUserName,
    users
  } = useApp();

  const loggedInUserName = useMemo(() => {
    return authProfile?.name || authProfile?.email || currentUserName || currentUserRole;
  }, [authProfile, currentUserName, currentUserRole]);

  // Restrict audit logs to user level for non-global staff
  const accessibleLogs = useMemo(() => {
    if (canAccessAllSites()) {
      return auditLogs;
    }
    const normAssigned = (assignedSite || '').toLowerCase().trim();
    const normUser = (loggedInUserName || '').toLowerCase().trim();

    return auditLogs.filter(log => {
      if (log.site && normAssigned && typeof log.site === 'string' && log.site.toLowerCase().trim() === normAssigned) return true;
      if (log.performedByUser && normUser && typeof log.performedByUser === 'string' && (
        log.performedByUser.toLowerCase().includes(normUser) || 
        normUser.includes(log.performedByUser.toLowerCase())
      )) return true;
      if (log.performedByRole === currentUserRole) return true;
      return false;
    });
  }, [auditLogs, canAccessAllSites, assignedSite, loggedInUserName, currentUserRole]);

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(settings.pageSize || 15);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Distinct users in logs for user filter
  const distinctUsers = useMemo(() => {
    const set = new Set<string>();
    accessibleLogs.forEach(l => {
      if (l.performedByUser) set.add(l.performedByUser);
    });
    return Array.from(set).sort();
  }, [accessibleLogs]);

  // Computed accountability subsets
  const accountabilityLogs = useMemo(() => {
    return accessibleLogs.filter(l => l.module === 'Properties' || l.module === 'Users');
  }, [accessibleLogs]);

  const propertyLogs = useMemo(() => {
    return accessibleLogs.filter(l => l.module === 'Properties');
  }, [accessibleLogs]);

  const userLogs = useMemo(() => {
    return accessibleLogs.filter(l => l.module === 'Users');
  }, [accessibleLogs]);

  const latestAccountabilityLog = accountabilityLogs[0];

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    if (tab === 'properties') {
      setModuleFilter('Properties');
    } else if (tab === 'users') {
      setModuleFilter('Users');
    } else {
      setModuleFilter('all');
    }
  };

  const filteredLogs = useMemo(() => {
    return accessibleLogs.filter(log => {
      // Filter tab constraints
      if (activeTab === 'accountability') {
        if (log.module !== 'Properties' && log.module !== 'Users') return false;
      } else if (activeTab === 'properties') {
        if (log.module !== 'Properties') return false;
      } else if (activeTab === 'users') {
        if (log.module !== 'Users') return false;
      } else if (activeTab === 'casework') {
        if (!['Referrals', 'Vulnerable SUs', 'Challenging SUs', 'Escalations'].includes(log.module)) return false;
      }

      // Explicit module dropdown filter
      if (moduleFilter !== 'all' && log.module !== moduleFilter) return false;

      // Action type filter
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;

      // User filter
      if (userFilter !== 'all' && log.performedByUser !== userFilter) return false;

      // Search query filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const str = `${log.performedByUser} ${log.performedByRole} ${log.module} ${log.action} ${log.details} ${log.targetItem} ${log.site || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [accessibleLogs, activeTab, moduleFilter, actionFilter, userFilter, searchQuery]);

  // Sort State
  const [sortField, setSortField] = useState<keyof AuditLog>('timestamp');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: keyof AuditLog) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      let valA: any = a[sortField] ?? '';
      let valB: any = b[sortField] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredLogs, sortField, sortAsc]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLogs.slice(start, start + pageSize);
  }, [sortedLogs, currentPage, pageSize]);

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    if (scope === 'filtered') return sortedLogs;
    if (scope === 'custom' && startDate && endDate) {
      return accessibleLogs.filter(l => l.timestamp.slice(0, 10) >= startDate && l.timestamp.slice(0, 10) <= endDate);
    }
    return accessibleLogs;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (l: AuditLog) => string | number }> => ({
    timestamp: { label: 'Timestamp', getValue: l => l.timestamp },
    performedByUser: { label: 'User', getValue: l => l.performedByUser },
    performedByRole: { label: 'Role', getValue: l => l.performedByRole },
    module: { label: 'Module', getValue: l => l.module },
    action: { label: 'Action', getValue: l => l.action },
    targetItem: { label: 'Target Item', getValue: l => l.targetItem },
    site: { label: 'Site', getValue: l => l.site || 'Global' },
    details: { label: 'Details', getValue: l => l.details }
  });

  const getExportPreviewData = ({
    scope,
    startDate,
    endDate,
    selectedColumns
  }: {
    scope: ExportScope;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    orientation: ExportOrientation;
    isCompact: boolean;
  }) => {
    const dataToExport = getExportDataForScope(scope, startDate, endDate);
    const colMap = getExportColumnMap();
    const cols = selectedColumns && selectedColumns.length > 0
      ? selectedColumns
      : auditExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(l => activeCols.map(c => colMap[c].getValue(l)));
    return { headers, rows };
  };

  const handlePerformExport = ({
    format,
    scope,
    orientation,
    startDate,
    endDate,
    selectedColumns,
    isCompact
  }: {
    format: ExportFormat;
    scope: ExportScope;
    orientation: ExportOrientation;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => {
    const dataToExport = getExportDataForScope(scope, startDate, endDate);
    const colMap = getExportColumnMap();
    const cols = selectedColumns && selectedColumns.length > 0
      ? selectedColumns
      : auditExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(l => activeCols.map(c => colMap[c].getValue(l)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `Audit-Activity-Log-${activeTab}-${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: 'System Activity & Internal Accountability Audit Log',
        subtitle: 'Immutable record of staff actions, accommodations, casework modifications, and user access changes.',
        filename: `Audit-Activity-Log-${activeTab}-${scope}-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        orientation,
        isCompact,
        metadata: [
          { label: 'Tab Category', value: activeTab },
          { label: 'Module Filter', value: moduleFilter },
          { label: 'Action Filter', value: actionFilter },
          { label: 'Export Scope', value: scope === 'all' ? 'All Records' : scope === 'filtered' ? 'Current Filtered View' : `${startDate} to ${endDate}` },
          { label: 'Page Layout', value: orientation },
          { label: 'Total Events', value: dataToExport.length }
        ]
      });
    }
  };

  const calculateDateRangeCount = (start: string, end: string) => {
    return auditLogs.filter(l => l.timestamp.slice(0, 10) >= start && l.timestamp.slice(0, 10) <= end).length;
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-[#0d9488]" />
            <h2 className="text-xl font-bold text-[#242424] tracking-tight">
              Activity Log &amp; Internal Accountability
            </h2>
            <span className="text-[11px] font-semibold bg-[#f0fdfa] text-[#0f766e] px-2 py-0.5 rounded">
              {sortedLogs.length} Filtered / {auditLogs.length} Total Entries
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Immutable timestamped activity logs capturing CRUD operations on accommodation properties, user accounts, and safeguarding casework.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            moduleName={`Audit Log (${activeTab})`}
            totalRecordCount={auditLogs.length}
            filteredRecordCount={sortedLogs.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={auditExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />
        </div>
      </div>

      {/* Internal Accountability KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Properties & Users CRUD Activity */}
        <div 
          onClick={() => handleTabChange('accountability')}
          className={`cursor-pointer border rounded-xs p-3 transition-all ${
            activeTab === 'accountability' 
              ? 'bg-[#f0fdfa] border-[#0d9488] shadow-xs' 
              : 'bg-white border-[#e1dfdd] hover:border-[#8a8886]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#605e5c]">Internal Accountability</span>
            <div className="p-1.5 rounded-full bg-teal-50 text-[#0d9488]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#242424]">{accountabilityLogs.length}</span>
            <span className="text-[11px] font-medium text-[#0d9488]">Admin CRUD Actions</span>
          </div>
          <p className="text-[11px] text-[#605e5c] mt-1">
            Properties & User management governance records
          </p>
        </div>

        {/* Card 2: Property Portfolio Operations */}
        <div 
          onClick={() => handleTabChange('properties')}
          className={`cursor-pointer border rounded-xs p-3 transition-all ${
            activeTab === 'properties' 
              ? 'bg-[#f0fdfa] border-[#0d9488] shadow-xs' 
              : 'bg-white border-[#e1dfdd] hover:border-[#8a8886]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#605e5c]">Property CRUD Events</span>
            <div className="p-1.5 rounded-full bg-emerald-50 text-emerald-700">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#242424]">{propertyLogs.length}</span>
            <span className="text-[11px] font-medium text-emerald-700">Facilities Logged</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-[#605e5c]">
            <span>Creates, Updates & Deletes</span>
            <button 
              onClick={(e) => { e.stopPropagation(); setActivePage('properties'); }}
              className="text-[#0d9488] hover:underline flex items-center gap-0.5 text-[10px] font-semibold"
            >
              View Sites <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* Card 3: User Accounts & Roles Operations */}
        <div 
          onClick={() => handleTabChange('users')}
          className={`cursor-pointer border rounded-xs p-3 transition-all ${
            activeTab === 'users' 
              ? 'bg-[#f0fdfa] border-[#0d9488] shadow-xs' 
              : 'bg-white border-[#e1dfdd] hover:border-[#8a8886]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#605e5c]">User Accounts CRUD</span>
            <div className="p-1.5 rounded-full bg-purple-50 text-purple-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#242424]">{userLogs.length}</span>
            <span className="text-[11px] font-medium text-purple-700">Staff Account Logs</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-[#605e5c]">
            <span>Role shifts, access & credentials</span>
            <button 
              onClick={(e) => { e.stopPropagation(); setActivePage('users'); }}
              className="text-[#0d9488] hover:underline flex items-center gap-0.5 text-[10px] font-semibold"
            >
              View Users <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* Card 4: Most Recent Accountability Action */}
        <div className="bg-white border border-[#e1dfdd] rounded-xs p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#605e5c]">Latest Admin Action</span>
            <div className="p-1.5 rounded-full bg-neutral-100 text-neutral-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          {latestAccountabilityLog ? (
            <div className="mt-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#242424] truncate">
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  latestAccountabilityLog.module === 'Properties' ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'
                }`}>
                  {latestAccountabilityLog.module}
                </span>
                <span className="truncate">{latestAccountabilityLog.targetItem}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#605e5c] mt-1">
                <span className="truncate">By {latestAccountabilityLog.performedByUser}</span>
                <span className="font-semibold text-neutral-700 shrink-0">
                  {formatRelativeTime(latestAccountabilityLog.timestamp)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-400 mt-2 italic">No property/user records logged yet</p>
          )}
        </div>
      </div>

      {/* Filter Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[#e1dfdd] pb-2">
        <button
          onClick={() => handleTabChange('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors ${
            activeTab === 'all'
              ? 'bg-[#0d9488] text-white shadow-xs'
              : 'bg-white text-[#323130] hover:bg-[#edebe9] border border-[#e1dfdd]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All System Logs ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('accountability')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors ${
            activeTab === 'accountability'
              ? 'bg-[#0d9488] text-white shadow-xs'
              : 'bg-white text-[#0d9488] hover:bg-teal-50 border border-teal-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-inherit" />
          <span>Properties & Users Accountability ({accountabilityLogs.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('properties')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors ${
            activeTab === 'properties'
              ? 'bg-[#0d9488] text-white shadow-xs'
              : 'bg-white text-[#323130] hover:bg-[#edebe9] border border-[#e1dfdd]'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Properties CRUD ({propertyLogs.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('users')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors ${
            activeTab === 'users'
              ? 'bg-[#0d9488] text-white shadow-xs'
              : 'bg-white text-[#323130] hover:bg-[#edebe9] border border-[#e1dfdd]'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-purple-600" />
          <span>User Accounts CRUD ({userLogs.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('casework')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors ${
            activeTab === 'casework'
              ? 'bg-[#0d9488] text-white shadow-xs'
              : 'bg-white text-[#323130] hover:bg-[#edebe9] border border-[#e1dfdd]'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-amber-600" />
          <span>Safeguarding Casework</span>
        </button>
      </div>

      {/* Filter panel */}
      <div className="bg-white border border-[#e1dfdd] p-3 rounded-xs flex flex-wrap items-end gap-3 text-xs shadow-xs">
        <div className="flex-1 min-w-[150px]">
          <label className="font-semibold text-[#605e5c] block mb-1">Module Filter</label>
          <select
            value={moduleFilter}
            onChange={e => {
              setModuleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:border-[#0d9488] focus:outline-hidden"
          >
            <option value="all">All Modules</option>
            <option value="Properties">Properties (Accommodation Sites)</option>
            <option value="Users">Users (Staff Accounts & Roles)</option>
            <option value="Referrals">Referrals</option>
            <option value="Vulnerable SUs">Vulnerable SUs</option>
            <option value="Challenging SUs">Challenging SUs</option>
            <option value="Maintenance">Maintenance Tracker</option>
            <option value="SPCD">SPCD Records</option>
            <option value="Laundry">Laundry</option>
            <option value="Hot Food">Hot Food</option>
            <option value="Escalations">Escalations</option>
            <option value="Documents">Documents</option>
            <option value="Roles">Roles</option>
            <option value="Settings">Settings &amp; Requests</option>
          </select>
        </div>

        <div className="flex-1 min-w-[130px]">
          <label className="font-semibold text-[#605e5c] block mb-1">Action Type</label>
          <select
            value={actionFilter}
            onChange={e => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:border-[#0d9488] focus:outline-hidden"
          >
            <option value="all">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="ARCHIVE">ARCHIVE</option>
            <option value="RESTORE">RESTORE</option>
            <option value="ROLE_CHANGE">ROLE_CHANGE</option>
            <option value="SETTINGS_UPDATE">SETTINGS_UPDATE</option>
            <option value="DATA_RESTORE">DATA_RESTORE</option>
          </select>
        </div>

        <div className="flex-1 min-w-[130px]">
          <label className="font-semibold text-[#605e5c] block mb-1">Staff / User</label>
          <select
            value={userFilter}
            onChange={e => {
              setUserFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:border-[#0d9488] focus:outline-hidden"
          >
            <option value="all">All Users ({distinctUsers.length})</option>
            {distinctUsers.map((u, uIdx) => (
              <option key={`${u}-${uIdx}`} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-[2] min-w-[200px]">
          <label className="font-semibold text-[#605e5c] block mb-1">Search User / Target / Change Details</label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search user, hotel name, role, changes..."
              className="w-full pl-8 pr-2 py-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:border-[#0d9488] focus:outline-hidden"
            />
            <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        <button
          onClick={() => {
            setActiveTab('all');
            setModuleFilter('all');
            setActionFilter('all');
            setUserFilter('all');
            setSearchQuery('');
            setCurrentPage(1);
          }}
          className="flex items-center gap-1 px-3 py-2 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-neutral-500" />
          <span>Reset</span>
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th onClick={() => handleSort('timestamp')} className="p-2.5 w-36 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Timestamp">
                  <div className="flex items-center gap-1">
                    <span>Timestamp</span>
                    {sortField === 'timestamp' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('performedByUser')} className="p-2.5 w-36 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Logged By / Actor">
                  <div className="flex items-center gap-1">
                    <span>Logged By</span>
                    {sortField === 'performedByUser' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('performedByRole')} className="p-2.5 w-28 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Role">
                  <div className="flex items-center gap-1">
                    <span>Role</span>
                    {sortField === 'performedByRole' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('module')} className="p-2.5 w-28 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Module">
                  <div className="flex items-center gap-1">
                    <span>Module</span>
                    {sortField === 'module' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('action')} className="p-2.5 w-20 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Action">
                  <div className="flex items-center gap-1">
                    <span>Action</span>
                    {sortField === 'action' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('targetItem')} className="p-2.5 w-44 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Target Item">
                  <div className="flex items-center gap-1">
                    <span>Target Item</span>
                    {sortField === 'targetItem' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th onClick={() => handleSort('site')} className="p-2.5 w-32 cursor-pointer hover:bg-[#edebe9] transition-colors" title="Sort by Site / Scope">
                  <div className="flex items-center gap-1">
                    <span>Site / Scope</span>
                    {sortField === 'site' ? (sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />) : <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />}
                  </div>
                </th>
                <th className="p-2.5">Action Details & Accountability Diff</th>
                <th className="p-2.5 w-12 text-center sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[11px]">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-[#605e5c] font-sans text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Shield className="w-8 h-8 text-neutral-300" />
                      <p className="font-semibold text-[#242424]">No audit records match the selected filters.</p>
                      <p className="text-[#605e5c] text-[11px]">Try clearing search keywords or switching filter tabs.</p>
                      <button
                        onClick={() => {
                          setActiveTab('all');
                          setModuleFilter('all');
                          setActionFilter('all');
                          setSearchQuery('');
                        }}
                        className="mt-1 px-3 py-1 bg-[#0d9488] text-white rounded-xs text-xs font-semibold"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map(log => {
                  const isDelete = log.action === 'DELETE';
                  const isCreate = log.action === 'CREATE';
                  const isUpdate = log.action === 'UPDATE';
                  const isArchive = log.action === 'ARCHIVE';
                  const isRestore = log.action === 'RESTORE' || log.action === 'DATA_RESTORE';

                  const isPropertiesModule = log.module === 'Properties';
                  const isUsersModule = log.module === 'Users';
                  const isAccountabilityModule = isPropertiesModule || isUsersModule;

                  return (
                    <tr 
                      key={log.id} 
                      className={`hover:bg-[#fafafa] transition-colors cursor-pointer ${
                        isAccountabilityModule ? 'bg-[#fcfdfd]' : ''
                      }`}
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="p-2.5 text-neutral-500 whitespace-nowrap font-mono text-[11px]">
                        <div className="flex flex-col">
                          <span className="font-semibold text-neutral-700">
                            {new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* User */}
                      <td className="p-2.5 font-sans font-semibold text-[#242424]">
                        <div className="flex items-center gap-1.5 truncate">
                          {isUsersModule ? (
                            <Users className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          ) : isPropertiesModule ? (
                            <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          )}
                          <span className="truncate">{log.performedByUser}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="p-2.5 font-sans text-neutral-600">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
                          {log.performedByRole}
                        </span>
                      </td>

                      {/* Module */}
                      <td className="p-2.5 font-sans font-medium">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] ${
                          isPropertiesModule 
                            ? 'bg-sky-100 text-sky-900 border border-sky-200' 
                            : isUsersModule 
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : 'bg-neutral-100 text-neutral-800'
                        }`}>
                          {isPropertiesModule && <Building2 className="w-3 h-3 text-sky-700" />}
                          {isUsersModule && <Users className="w-3 h-3 text-purple-700" />}
                          {log.module}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="p-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                          isDelete ? 'bg-red-100 text-red-800 border border-red-200' :
                          isCreate ? 'bg-[#e8f5e9] text-[#107c10] border border-green-200' :
                          isUpdate ? 'bg-[#f0fdfa] text-[#0f766e] border border-teal-200' :
                          isArchive ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                          isRestore ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                          'bg-neutral-100 text-neutral-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>

                      {/* Target Item */}
                      <td className="p-2.5 font-sans font-medium text-neutral-900">
                        <div className="truncate max-w-[180px]" title={log.targetItem}>
                          {log.targetItem}
                        </div>
                      </td>

                      {/* Site / Scope */}
                      <td className="p-2.5 font-sans text-neutral-600 truncate max-w-[130px]" title={log.site || 'Global'}>
                        {log.site || 'Global'}
                      </td>

                      {/* Details & Accountability Diff */}
                      <td className="p-2.5 font-sans text-neutral-700 max-w-sm truncate" title={log.details}>
                        <span className={isAccountabilityModule ? 'text-neutral-900 font-medium' : ''}>
                          {log.details}
                        </span>
                      </td>

                      {/* Receipt Action Button */}
                      <td className="p-2.5 text-center sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.04)]" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1 rounded text-[#0d9488] hover:bg-[#f0fdfa] transition-colors"
                          title="View Audit Record Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={sortedLogs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Audit Record Details / Receipt Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#faf9f8] px-5 py-4 border-b border-[#edebe9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0d9488]" />
                <div>
                  <h3 className="text-sm font-bold text-[#242424]">Immutable Audit Receipt</h3>
                  <p className="text-[11px] font-mono text-neutral-500">{selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#faf9f8] p-3 rounded-xs border border-[#edebe9]">
                <div>
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">Timestamp</span>
                  <span className="font-mono text-neutral-800 font-semibold">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">Action Classification</span>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    selectedLog.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                    selectedLog.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                    selectedLog.action === 'UPDATE' ? 'bg-teal-100 text-blue-800' :
                    'bg-neutral-100 text-neutral-700'
                  }`}>
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">Actor / User</span>
                  <span className="font-semibold text-neutral-800">{selectedLog.performedByUser}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">Actor Role</span>
                  <span className="text-neutral-700">{selectedLog.performedByRole}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">Target Module</span>
                  <span className="font-semibold text-neutral-800">{selectedLog.module}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">Site / Facility Scope</span>
                  <span className="text-neutral-800">{selectedLog.site || 'Global / System'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Target Entity Record
                </span>
                <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-xs font-medium text-neutral-800">
                  {selectedLog.targetItem}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Accountability Audit Trail & Change Diff
                </span>
                <div className="p-3 bg-neutral-900 text-neutral-100 rounded-xs font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                  {selectedLog.details}
                </div>
              </div>

              {/* Navigation Link for Properties or Users */}
              {selectedLog.module === 'Properties' && (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xs flex items-center justify-between text-xs text-sky-900">
                  <span>View live properties directory to check current status.</span>
                  <button
                    onClick={() => {
                      setSelectedLog(null);
                      setActivePage('properties');
                    }}
                    className="px-2.5 py-1 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold rounded-xs text-[11px] flex items-center gap-1"
                  >
                    <span>Properties</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {selectedLog.module === 'Users' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xs flex items-center justify-between text-xs text-purple-900">
                  <span>Manage staff accounts and authorization roles.</span>
                  <button
                    onClick={() => {
                      setSelectedLog(null);
                      setActivePage('users');
                    }}
                    className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-xs text-[11px] flex items-center gap-1"
                  >
                    <span>Team & Users</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#faf9f8] px-5 py-3 border-t border-[#edebe9] flex items-center justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold text-xs transition-colors"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
