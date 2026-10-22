import { useRoomOccupancy } from '../../hooks/useRoomOccupancy';
import { formatOccupancy } from '../../utils/roomManagementLogic';
import React, { useState, useMemo } from 'react';
import { BulkActionToolbar } from '../common/BulkActionToolbar';
import {
  Building2,
  Plus,
  Edit3,
  Trash2,
  Users,
  MapPin,
  Phone,
  UserCheck,
  ShieldAlert,
  RotateCcw,
  Shield,
  CheckCircle2,
  History,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PropertyInfo } from '../../types';
import { Pagination } from '../common/Pagination';
import { ExportModal, ExportFormat, ExportScope, ExportColumnOption, ExportOrientation } from '../common/ExportModal';
import { ExportDropdown } from '../common/ExportDropdown';
import { SearchInput } from '../common/SearchInput';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { useTableSchema } from '../../hooks/useTableSchema';
import { TableColumnConfig } from '../../types/tableSchema';
import { sitesTableConfig } from '../../config/trackerTableConfigs';
import { getUserDropdownOptions } from '../../utils/userSelectOptions';

const propertyExportColumns: ExportColumnOption[] = [
  { id: 'pid', label: 'PID (Hotel Code)' },
  { id: 'name', label: 'Property / Site Name' },
  { id: 'city', label: 'City / Area' },
  { id: 'address', label: 'Address' },
  { id: 'capacity', label: 'Capacity' },
  { id: 'leadOfficer', label: 'Lead Contact Officer' },
  { id: 'contactNumber', label: 'Contact Phone' },
  { id: 'status', label: 'Operational Status' }
];

export const PropertiesView: React.FC = () => {
  const {
    properties,
    users,
    addProperty,
    updateProperty,
    deleteProperty,
    canManageProperties,
    currentUserRole,
    setCurrentUserRole,
    resetPropertiesToDefault,
    setActivePage,
    requestConfirmation
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Under Maintenance'>('All');
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<keyof PropertyInfo>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Dynamic Table Schema & Custom Fields Hook
  const {
    columns: sitesColumns,
    tableColumns: visibleSitesColumns,
    saveColumns: handleSaveSitesColumns,
    resetToDefault: handleResetSitesColumns
  } = useTableSchema<PropertyInfo>('sites', sitesTableConfig as any);
  const [isSchemaEditorOpen, setIsSchemaEditorOpen] = useState<boolean>(false);

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalFormat, setExportModalFormat] = useState<ExportFormat>('pdf');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyInfo | null>(null);
  const [viewingProperty, setViewingProperty] = useState<PropertyInfo | null>(null);

  const hasAdminAuthority = canManageProperties();
  const isAdminRole = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';

  const visibleProperties = properties;

  // KPI Statistics
  // Bed capacity comes from the real rooms of each property, not from a typed figure
  const { bySite: occupancyBySite } = useRoomOccupancy();
  const stats = useMemo(() => {
    const total = visibleProperties.length;
    const active = visibleProperties.filter(p => p.status === 'Active').length;
    const maintenance = visibleProperties.filter(p => p.status === 'Under Maintenance').length;
    const totalCapacity = visibleProperties.reduce((acc, p) => acc + (occupancyBySite.get(p.id)?.beds || 0), 0);
    return { total, active, maintenance, totalCapacity };
  }, [visibleProperties, occupancyBySite]);

  const availableCities = useMemo(() => {
    return Array.from(new Set(visibleProperties.map(p => p.city).filter(Boolean))).sort();
  }, [visibleProperties]);

  const filteredProperties = useMemo(() => {
    return visibleProperties.filter(prop => {
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = !q || (
        (prop.name || '').toLowerCase().includes(q) ||
        (prop.pid && prop.pid.toLowerCase().includes(q)) ||
        (prop.city || '').toLowerCase().includes(q) ||
        (prop.leadOfficer && prop.leadOfficer.toLowerCase().includes(q)) ||
        (prop.contactNumber && prop.contactNumber.toLowerCase().includes(q)) ||
        (prop.address && prop.address.toLowerCase().includes(q))
      );

      const matchesStatus = statusFilter === 'All' || prop.status === statusFilter;
      const matchesCity = cityFilter === 'All' || prop.city === cityFilter;
      return matchesSearch && matchesStatus && matchesCity;
    });
  }, [visibleProperties, searchQuery, statusFilter, cityFilter]);

  const sortedProperties = useMemo(() => {
    return [...filteredProperties].sort((a, b) => {
      let valA: any = a[sortField] ?? '';
      let valB: any = b[sortField] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredProperties, sortField, sortAsc]);

  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedProperties.slice(start, start + pageSize);
  }, [sortedProperties, currentPage, pageSize]);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isAllPageSelected = paginatedProperties.length > 0 && paginatedProperties.every(p => selectedIds.includes(p.id));

  const handleToggleSelectAll = () => {
    if (isAllPageSelected) {
      const pageIds = paginatedProperties.map(p => p.id);
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      const pageIds = paginatedProperties.map(p => p.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (typeof requestConfirmation !== 'undefined') {
      requestConfirmation({
        title: 'Delete Selected Properties',
        message: `Are you sure you want to delete ${selectedIds.length} selected propert${selectedIds.length > 1 ? 'ies' : 'y'}? This action cannot be undone.`,
        isDanger: true,
        onConfirm: async () => {
          for (const id of selectedIds) {
            deleteProperty(id);
          }
          setSelectedIds([]);
        }
      });
    } else {
      if (window.confirm(`Are you sure you want to delete ${selectedIds.length} properties?`)) {
        for (const id of selectedIds) {
          deleteProperty(id);
        }
        setSelectedIds([]);
      }
    }
  };

  const handleBulkStatusChange = (newStatus: 'Active' | 'Under Maintenance') => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      updateProperty(id, { status: newStatus });
    }
    setSelectedIds([]);
  };

  if (!isAdminRole) {
    return (
      <div className="bg-white border border-[#e1dfdd] rounded-xs p-10 shadow-xs text-center max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto mb-4 text-[#0d9488]">
          <ShieldAlert className="w-6 h-6 text-red-600" />
        </div>
        <h2 className="text-lg font-bold text-[#242424] mb-2">Property Management Restricted</h2>
        <p className="text-xs text-[#605e5c] leading-relaxed mb-4">
          Property Management, accommodation directories, and master hotel configurations are strictly managed by <strong>Super Admin</strong> and <strong>Admin</strong> roles only. Your current role (<strong>{currentUserRole}</strong>) is restricted from viewing or modifying property entries.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setActivePage('dashboard')}
            className="px-4 py-2 bg-[#f3f2f1] hover:bg-[#edebe9] text-[#323130] font-semibold text-xs rounded-xs border border-[#8a8886] transition-colors"
          >
            Return to Dashboard
          </button>
          <button
            onClick={() => setCurrentUserRole('Super Admin')}
            className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold text-xs rounded-xs transition-colors flex items-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5" />
            Switch to Super Admin
          </button>
        </div>
      </div>
    );
  }

  const handleSort = (field: keyof PropertyInfo) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleSyncMasterHotels = () => {
    resetPropertiesToDefault();
    setSyncSuccess(true);
    setTimeout(() => setSyncSuccess(false), 3000);
  };

  const handleOpenExportModal = (format: ExportFormat = 'pdf') => {
    setExportModalFormat(format);
    setIsExportModalOpen(true);
  };

  const getExportDataForScope = (scope: ExportScope) => {
    return scope === 'filtered' ? sortedProperties : visibleProperties;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (p: PropertyInfo) => string | number }> => ({
    pid: { label: 'PID', getValue: p => p.pid || '—' },
    name: { label: 'Site / Property Name', getValue: p => p.name },
    city: { label: 'City / Area', getValue: p => p.city },
    address: { label: 'Address', getValue: p => p.address || '—' },
    capacity: { label: 'Capacity', getValue: p => `${p.capacity} residents` },
    leadOfficer: { label: 'Lead Officer', getValue: p => p.leadOfficer || 'Unassigned' },
    contactNumber: { label: 'Contact Phone', getValue: p => p.contactNumber || '—' },
    status: { label: 'Status', getValue: p => p.status }
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
      : propertyExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(p => activeCols.map(c => colMap[c].getValue(p)));
    return { headers, rows };
  };

  const handlePerformExport = ({
    format,
    scope,
    selectedColumns,
    isCompact
  }: {
    format: ExportFormat;
    scope: ExportScope;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => {
    const dataToExport = getExportDataForScope(scope);
    const title = 'Contracted Accommodation & Properties Directory';

    const cols = selectedColumns && selectedColumns.length > 0
      ? selectedColumns
      : propertyExportColumns.map(c => c.id);

    const colMap = getExportColumnMap();
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(p => activeCols.map(c => colMap[c].getValue(p)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `Properties-Directory-${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title,
        subtitle: 'Official register of accommodation facilities, PIDs, capacities, and lead officers.',
        filename: `Properties-Directory-${scope}-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        isCompact,
        metadata: [
          { label: 'Export Scope', value: scope === 'all' ? 'All Properties' : 'Filtered Properties' },
          { label: 'Status Filter', value: statusFilter },
          { label: 'Density', value: isCompact ? 'Compact View' : 'Standard View' },
          { label: 'Total Exported', value: dataToExport.length }
        ]
      });
    }
  };

  const handleOpenAdd = () => {
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (prop: PropertyInfo) => {
    setEditingProperty(prop);
  };

  const handleSaveAdd = async (data: Partial<PropertyInfo>) => {
    if (!data.name?.trim() || !data.city?.trim()) return;
    addProperty({
      ...data,
      pid: data.pid?.trim() || '',
      name: data.name.trim(),
      city: data.city.trim(),
      capacity: Number(data.capacity) || 0,
      status: (data.status as any) || 'Active',
      leadOfficer: data.leadOfficer?.trim() || '',
      contactNumber: data.contactNumber?.trim() || ''
    } as any);
    setIsAddModalOpen(false);
  };

  const handleSaveEdit = async (data: Partial<PropertyInfo>) => {
    if (!editingProperty || !data.name?.trim() || !data.city?.trim()) return;
    const newName = data.name.trim();
    updateProperty(editingProperty.id, {
      ...editingProperty,
      ...data,
      name: newName,
      capacity: Number(data.capacity) || 0,
      status: (data.status as any) || 'Active'
    });

    setEditingProperty(null);
  };

  const renderColumnCell = (col: TableColumnConfig<PropertyInfo>, prop: PropertyInfo) => {
    const val = (prop as any)[col.key];

    if (col.renderCell) {
      return col.renderCell(val, prop);
    }

    if (col.key === 'pid') {
      return prop.pid ? (
        <span className="font-mono font-bold text-xs bg-[#f0fdfa] text-[#0f766e] px-2 py-0.5 rounded border border-[#99f6e4] inline-block shadow-2xs">
          {prop.pid}
        </span>
      ) : (
        <span className="text-neutral-300 font-mono text-xs">—</span>
      );
    }

    if (col.key === 'name') {
      return (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#0d9488] shrink-0" />
          <button
            onClick={() => setViewingProperty(prop)}
            className="font-semibold text-xs text-[#242424] hover:text-[#0d9488] hover:underline text-left cursor-pointer whitespace-nowrap"
            title="Click to view full property details"
          >
            {prop.name}
          </button>
          {prop.name === 'Burrows Court' && (
            <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded whitespace-nowrap">
              Admin Only
            </span>
          )}
        </div>
      );
    }

    if (col.key === 'city') {
      return (
        <div className="flex items-center gap-1.5 text-neutral-600 text-xs whitespace-nowrap">
          <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span>{prop.city || '—'}</span>
        </div>
      );
    }

    if (col.key === 'capacity') {
      return (
        <div className="flex items-center gap-1.5 text-neutral-800 text-xs whitespace-nowrap">
          <Users className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span className="font-medium">{occupancyBySite.get(prop.id)?.beds ? `${formatOccupancy(occupancyBySite.get(prop.id)!)} beds` : '—'}</span>
        </div>
      );
    }

    if (col.key === 'leadOfficer') {
      if (!hasAdminAuthority) {
        return (
          <div className="flex items-center gap-1.5 text-neutral-700 text-xs whitespace-nowrap">
            <UserCheck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className={prop.leadOfficer ? 'font-medium' : 'text-neutral-400 italic'}>
              {prop.leadOfficer || 'Unassigned'}
            </span>
          </div>
        );
      }

      const activeOfficerOptions = getUserDropdownOptions(users, {
        siteName: prop.name,
        includeRoleInLabel: true,
        onlyActive: true
      });
      const currentVal = prop.leadOfficer || '';
      const hasCurrentInOptions = activeOfficerOptions.some(
        o => o.value.toLowerCase() === currentVal.toLowerCase()
      );

      return (
        <div className="flex items-center gap-1.5 min-w-[170px]" onClick={e => e.stopPropagation()}>
          <UserCheck className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />
          <select
            value={currentVal}
            onChange={e => updateProperty(prop.id, { leadOfficer: e.target.value })}
            className={`w-full px-2 py-1 text-xs rounded border transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0d9488] ${
              currentVal
                ? 'bg-teal-50/70 text-teal-900 border-teal-200 font-medium hover:bg-teal-50'
                : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:bg-white'
            }`}
            title="Click to assign General Manager or Lead Contact Officer"
          >
            <option value="" className="bg-white text-neutral-900 font-normal">Unassigned</option>
            {currentVal && !hasCurrentInOptions && (
              <option value={currentVal} className="bg-white text-neutral-900 font-normal">
                {currentVal} (Current)
              </option>
            )}
            {activeOfficerOptions.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-white text-neutral-900 font-normal">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (col.key === 'contactNumber') {
      return (
        <div className="flex items-center gap-1.5 text-neutral-600 text-xs whitespace-nowrap">
          <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span>{prop.contactNumber || '—'}</span>
        </div>
      );
    }

    if (col.key === 'status') {
      return hasAdminAuthority ? (
        <div className="min-w-[130px]" onClick={e => e.stopPropagation()}>
          <select
            value={prop.status}
            onChange={e => updateProperty(prop.id, { status: e.target.value as 'Active' | 'Under Maintenance' })}
            className={`w-full px-2.5 py-1 text-xs font-semibold rounded border transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0d9488] ${
              prop.status === 'Active'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/60'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/60'
            }`}
            title="Click to update operational status"
          >
            <option value="Active" className="bg-white text-emerald-800 font-semibold">Active</option>
            <option value="Under Maintenance" className="bg-white text-amber-800 font-semibold">Under Maintenance</option>
          </select>
        </div>
      ) : (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          prop.status === 'Active'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${prop.status === 'Active' ? 'bg-emerald-600' : 'bg-amber-600'}`} />
          {prop.status}
        </span>
      );
    }

    // Custom or fallback column rendering
    if (typeof val === 'boolean') {
      return (
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${val ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'}`}>
          {val ? 'Yes' : 'No'}
        </span>
      );
    }

    if (col.badgeColors && val && col.badgeColors[String(val)]) {
      return (
        <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded border ${col.badgeColors[String(val)]}`}>
          {String(val)}
        </span>
      );
    }

    return <span className="text-[#242424] text-xs">{val !== undefined && val !== null && val !== '' ? String(val) : '—'}</span>;
  };

  return (
    <div className="space-y-4 w-full animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-xs">
              <Building2 className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424] tracking-tight">Properties Directory</h1>
                <span className="text-[11px] font-semibold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                  {visibleProperties.length}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">Official accommodation list with Property IDs (PIDs), resident capacity, and lead officers.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            {/* Super Admin Table Customizer */}
            {currentUserRole === 'Super Admin' && (
              <button
                id="btn-customize-sites-table"
                onClick={() => setIsSchemaEditorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
                title="Configure Table Headers & Form Fields (Super Admin Only)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0078d4]" />
                <span>Customize Table</span>
              </button>
            )}

            {/* Audit Trail Button */}
            <button
              id="btn-view-property-audit"
              onClick={() => setActivePage('audit')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
              title="View timestamped property CRUD audit trail"
            >
              <History className="w-3.5 h-3.5 text-[#0d9488]" />
              <span>Activity Log</span>
            </button>

            {/* Quick Resync Master Hotels Button */}
            <button
              id="btn-sync-master-hotels"
              onClick={handleSyncMasterHotels}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
              title="Reload and synchronize official master list of 16 hotels and PIDs"
            >
              {syncSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Synced</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5 text-[#0d9488]" />
                  <span>Reset to Official 16 Hotels</span>
                </>
              )}
            </button>

            {/* Export Dropdown */}
            <ExportDropdown
              moduleName="Properties"
              totalRecordCount={visibleProperties.length}
              filteredRecordCount={sortedProperties.length}
              defaultOrientation="landscape"
              availableColumns={propertyExportColumns}
              getPreviewData={getExportPreviewData}
              onExport={handlePerformExport}
            />

            {/* Add Property Button */}
            {hasAdminAuthority && (
              <button
                id="btn-add-property"
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors cursor-pointer"
                title="Register a new contracted property"
              >
                <Plus className="w-4 h-4" />
                <span>Add Property</span>
              </button>
            )}
          </div>
        </div>

        {/* Integrated Filter Row */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto flex-1">
            <div className="w-full sm:w-72">
              <SearchInput
                id="properties-search"
                placeholder="Search property, PID, city, officer, phone..."
                value={searchQuery}
                onChange={val => {
                  setSearchQuery(val);
                  setCurrentPage(1);
                }}
                storageKey="properties_search"
              />
            </div>

            {/* City / Area Dropdown */}
            <select
              id="properties-city-filter"
              value={cityFilter}
              onChange={e => {
                setCityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-auto px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all cursor-pointer"
            >
              <option value="All">All Cities / Areas ({availableCities.length})</option>
              {availableCities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {(searchQuery || statusFilter !== 'All' || cityFilter !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setCityFilter('All');
                  setCurrentPage(1);
                }}
                className="text-xs text-teal-700 hover:text-teal-900 underline flex items-center gap-1 whitespace-nowrap self-start sm:self-center cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 w-full md:w-auto justify-end">
            {(['All', 'Active', 'Under Maintenance'] as const).map(st => {
              const count = st === 'All' ? visibleProperties.length : visibleProperties.filter(p => p.status === st).length;
              return (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 text-xs rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#0d9488] text-white font-semibold shadow-2xs'
                      : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 border border-neutral-200 font-medium'
                  }`}
                >
                  <span>{st}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    statusFilter === st ? 'bg-teal-700 text-white' : 'bg-neutral-200 text-neutral-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded bg-teal-50 text-[#0d9488] border border-teal-200 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Total Sites</div>
            <div className="text-lg font-bold text-[#242424] leading-tight">{stats.total}</div>
          </div>
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Active Operational</div>
            <div className="text-lg font-bold text-emerald-700 leading-tight">{stats.active}</div>
          </div>
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Under Maintenance</div>
            <div className="text-lg font-bold text-amber-700 leading-tight">{stats.maintenance}</div>
          </div>
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Total Bed Spaces (from rooms)</div>
            <div className="text-lg font-bold text-[#242424] leading-tight">
              {stats.totalCapacity.toLocaleString()} <span className="text-xs font-normal text-neutral-500">residents</span>
            </div>
          </div>
        </div>
      </div>

      {/* Properties Table */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs min-h-[500px] lg:min-h-[calc(100vh-340px)] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#e1dfdd] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                {/* Selection Checkbox Header */}
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all properties on this page"
                    checked={isAllPageSelected}
                    onChange={handleToggleSelectAll}
                    className="rounded border-[#8a8886] text-[#0d9488] focus:ring-[#0d9488] cursor-pointer"
                  />
                </th>

                {visibleSitesColumns.map(col => (
                  <th
                    key={String(col.key)}
                    onClick={() => handleSort(col.key as any)}
                    className="p-3 cursor-pointer hover:bg-[#edebe9] transition-colors"
                    title={`Sort by ${col.label}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      {col.isCustom && (
                        <span className="px-1 text-[9px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded">
                          custom
                        </span>
                      )}
                      {sortField === col.key ? (
                        sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-[#0d9488]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#0d9488]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-60" />
                      )}
                    </div>
                  </th>
                ))}
                <th className="p-3 min-w-[200px]">Assigned Staff &amp; Managers</th>
                {hasAdminAuthority && (
                  <th className="p-3 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9]">
              {paginatedProperties.length === 0 ? (
                <tr>
                  <td colSpan={visibleSitesColumns.length + (hasAdminAuthority ? 2 : 1) + 1} className="py-16 text-center text-[#605e5c]">
                    <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto mb-3 text-[#0d9488]">
                      <Building2 className="w-6 h-6 text-[#0d9488]" />
                    </div>
                    <p className="font-semibold text-sm text-[#242424]">No properties match your filter criteria</p>
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                      Try clearing your search terms or adjusting the status and city filters.
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      {(searchQuery || statusFilter !== 'All' || cityFilter !== 'All') && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('All');
                            setCityFilter('All');
                            setCurrentPage(1);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-[#323130] bg-[#f3f2f1] hover:bg-[#edebe9] rounded border border-[#8a8886] transition-colors cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      )}
                      {hasAdminAuthority && (
                        <button
                          onClick={handleOpenAdd}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add New Property
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProperties.map(prop => {
                  const isSelected = selectedIds.includes(prop.id);
                  return (
                    <tr
                      key={prop.id}
                      className={`transition-colors ${isSelected ? 'bg-teal-50/50 hover:bg-teal-50/80' : 'hover:bg-[#f8fafc]'}`}
                    >
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${prop.name}`}
                          checked={isSelected}
                          onChange={e => handleToggleSelect(e as any, prop.id)}
                          className="rounded border-[#8a8886] text-[#0d9488] focus:ring-[#0d9488] cursor-pointer"
                        />
                      </td>

                      {visibleSitesColumns.map(col => (
                        <td key={String(col.key)} className="p-3">
                          {renderColumnCell(col, prop)}
                        </td>
                      ))}

                      <td className="p-3 text-[#323130]">
                        {(() => {
                          const siteSpecific = users.filter(u => u.assignedSites?.includes(prop.name));
                          const orgWide = users.filter(u => !u.assignedSites?.includes(prop.name) && (u.assignedSites?.includes('All Sites') || u.assignedSites?.includes('All')));

                          if (siteSpecific.length === 0 && orgWide.length === 0) {
                            return <span className="text-neutral-400 italic text-[11px]">No staff assigned</span>;
                          }

                          return (
                            <div className="flex flex-wrap items-center gap-1 max-w-xs">
                              {siteSpecific.map(u => (
                                <span
                                  key={u.id}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded text-[11px] font-medium whitespace-nowrap"
                                  title={`${u.name} - ${u.role} (${u.email})`}
                                >
                                  <span>{u.name}</span>
                                  <span className="text-[9px] text-teal-600 font-semibold">({u.role})</span>
                                </span>
                              ))}
                              {siteSpecific.length === 0 && orgWide.length > 0 && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 text-neutral-600 border border-neutral-200 rounded text-[11px] font-medium whitespace-nowrap"
                                  title={`Org-wide staff with access (${orgWide.length}): ${orgWide.map(u => `${u.name} (${u.role})`).join(', ')}`}
                                >
                                  <Users className="w-3 h-3 text-neutral-400" />
                                  <span>{orgWide.length} Org-wide Staff</span>
                                </span>
                              )}
                              {siteSpecific.length > 0 && orgWide.length > 0 && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 bg-neutral-50 text-neutral-500 border border-neutral-200 rounded text-[10px] whitespace-nowrap"
                                  title={`+${orgWide.length} org-wide personnel (${orgWide.map(u => u.name).join(', ')})`}
                                >
                                  +{orgWide.length} Org-wide
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {hasAdminAuthority && (
                        <td className="p-3 text-right sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setViewingProperty(prop)}
                              className="p-1.5 text-neutral-600 hover:text-[#0d9488] hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                              title="View Property Record"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(prop)}
                              className="p-1.5 text-[#0d9488] hover:bg-teal-50 rounded transition-colors cursor-pointer"
                              title="Edit Property"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (typeof requestConfirmation !== 'undefined') {
                                  requestConfirmation({
                                    title: `Delete Property: ${prop.name}`,
                                    message: `Are you sure you want to delete "${prop.name}"? This action will remove the property from the directory.`,
                                    isDanger: true,
                                    onConfirm: async () => {
                                      deleteProperty(prop.id);
                                    }
                                  });
                                } else {
                                  if (window.confirm(`Are you sure you want to delete ${prop.name}?`)) {
                                    deleteProperty(prop.id);
                                  }
                                }
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Delete Property"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={sortedProperties.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Floating Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedIds.length}
        totalCount={filteredProperties.length}
        onClearSelection={() => setSelectedIds([])}
        onSelectAll={() => setSelectedIds(sortedProperties.map(p => p.id))}
        onDeleteSelected={hasAdminAuthority ? handleDeleteSelected : undefined}
        customActions={
          hasAdminAuthority && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleBulkStatusChange('Active')}
                className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded cursor-pointer transition-colors"
              >
                Set Active
              </button>
              <button
                type="button"
                onClick={() => handleBulkStatusChange('Under Maintenance')}
                className="px-2.5 py-1 text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded cursor-pointer transition-colors"
              >
                Set Maintenance
              </button>
            </div>
          )
        }
      />

      {/* ADD PROPERTY MODAL */}
      <DynamicRecordFormModal<PropertyInfo>
        isOpen={isAddModalOpen}
        title="Add New Property / Site"
        columns={sitesColumns as any}
        initialValues={{
          status: 'Active'
        }}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveAdd}
      />

      {/* EDIT PROPERTY MODAL */}
      <DynamicRecordFormModal<PropertyInfo>
        isOpen={Boolean(editingProperty)}
        title={editingProperty ? `Edit Property: ${editingProperty.name}` : 'Edit Property'}
        columns={sitesColumns as any}
        initialValues={editingProperty}
        isEdit={true}
        onClose={() => setEditingProperty(null)}
        onSave={handleSaveEdit}
      />

      {/* VIEW PROPERTY DOSSIER MODAL */}
      <DynamicRecordViewModal<PropertyInfo>
        isOpen={Boolean(viewingProperty)}
        title={viewingProperty ? `Property Record: ${viewingProperty.name}` : 'Property Details'}
        columns={sitesColumns as any}
        record={viewingProperty}
        onClose={() => setViewingProperty(null)}
        canEdit={hasAdminAuthority}
        onEdit={() => {
          if (viewingProperty) {
            setEditingProperty(viewingProperty);
            setViewingProperty(null);
          }
        }}
      />

      {/* Table Schema / Header Customizer Modal (Super Admin Only) */}
      <TableSchemaEditorModal<PropertyInfo>
        isOpen={isSchemaEditorOpen}
        onClose={() => setIsSchemaEditorOpen(false)}
        moduleTitle="Properties & Sites Directory"
        columns={sitesColumns}
        onSaveColumns={handleSaveSitesColumns}
        onResetToDefault={handleResetSitesColumns}
        currentUserRole={currentUserRole}
      />

      {/* Export Selection & Configuration Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Properties Directory"
        moduleName="Properties"
        defaultFormat={exportModalFormat}
        defaultOrientation="landscape"
        totalRecordCount={visibleProperties.length}
        filteredRecordCount={sortedProperties.length}
        availableColumns={propertyExportColumns}
        getPreviewData={getExportPreviewData}
        onExport={handlePerformExport}
      />
    </div>
  );
};
