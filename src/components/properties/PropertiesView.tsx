import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Edit3,
  Trash2,
  Users,
  MapPin,
  Phone,
  UserCheck,
  X,
  Check,
  AlertCircle,
  ShieldAlert,
  RotateCcw,
  Shield,
  CheckCircle2,
  Lock,
  History,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  SlidersHorizontal
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

const propertyExportColumns: ExportColumnOption[] = [
  { id: 'pid', label: 'PID (Hotel Code)' },
  { id: 'name', label: 'Property / Site Name' },
  { id: 'city', label: 'City / Area' },
  { id: 'capacity', label: 'Capacity' },
  { id: 'leadOfficer', label: 'Lead Contact Officer' },
  { id: 'contactNumber', label: 'Contact Phone' },
  { id: 'status', label: 'Operational Status' }
];

export const PropertiesView: React.FC = () => {
  const {
    properties,
    users,
    userGroups,
    updateUserGroup,
    addProperty,
    updateProperty,
    updateUser,
    deleteProperty,
    canManageProperties,
    currentUserRole,
    setCurrentUserRole,
    resetPropertiesToDefault,
    setActivePage
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Under Maintenance'>('All');
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

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

  const visibleProperties = properties;

  const filteredProperties = useMemo(() => {
    return visibleProperties.filter(prop => {
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = !q || (
        (prop.name || '').toLowerCase().includes(q) ||
        (prop.pid && prop.pid.toLowerCase().includes(q)) ||
        (prop.city || '').toLowerCase().includes(q) ||
        (prop.leadOfficer && prop.leadOfficer.toLowerCase().includes(q))
      );

      const matchesStatus = statusFilter === 'All' || prop.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [visibleProperties, searchQuery, statusFilter]);

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
      capacity: Number(data.capacity) || 100,
      status: (data.status as any) || 'Active',
      leadOfficer: data.leadOfficer?.trim() || '',
      contactNumber: data.contactNumber?.trim() || ''
    } as any);
    setIsAddModalOpen(false);
  };

  const handleSaveEdit = async (data: Partial<PropertyInfo>) => {
    if (!editingProperty || !data.name?.trim() || !data.city?.trim()) return;
    const oldName = editingProperty.name;
    const newName = data.name.trim();
    updateProperty(editingProperty.id, {
      ...editingProperty,
      ...data,
      name: newName,
      capacity: Number(data.capacity) || 100,
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
        <span className="font-mono font-bold text-xs bg-[#f0fdfa] text-[#0f766e] px-2 py-0.5 rounded border border-[#99f6e4]">
          {prop.pid}
        </span>
      ) : (
        <span className="text-neutral-400 font-mono text-xs">—</span>
      );
    }

    if (col.key === 'name') {
      return (
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />
          <button
            onClick={() => setViewingProperty(prop)}
            className="font-semibold text-[#242424] hover:text-[#0d9488] hover:underline text-left cursor-pointer"
          >
            {prop.name}
          </button>
          {prop.name === 'Burrows Court' && (
            <span className="text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.2 rounded">
              Super Admin / Admin Only
            </span>
          )}
        </div>
      );
    }

    if (col.key === 'city') {
      return (
        <div className="flex items-center gap-1.5 text-[#605e5c]">
          <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
          <span>{prop.city || '—'}</span>
        </div>
      );
    }

    if (col.key === 'capacity') {
      return (
        <div className="flex items-center gap-1.5 text-[#242424]">
          <Users className="w-3 h-3 text-neutral-400 shrink-0" />
          <span>{prop.capacity ? `${prop.capacity} residents` : '—'}</span>
        </div>
      );
    }

    if (col.key === 'leadOfficer') {
      return (
        <div className="flex items-center gap-1.5 text-[#242424]">
          <UserCheck className="w-3 h-3 text-neutral-400 shrink-0" />
          <span>{prop.leadOfficer || 'Unassigned'}</span>
        </div>
      );
    }

    if (col.key === 'contactNumber') {
      return (
        <div className="flex items-center gap-1.5 text-[#605e5c]">
          <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
          <span>{prop.contactNumber || '—'}</span>
        </div>
      );
    }

    if (col.key === 'status') {
      return hasAdminAuthority ? (
        <select
          value={prop.status}
          onChange={e => updateProperty(prop.id, { status: e.target.value as 'Active' | 'Under Maintenance' })}
          className={`px-2 py-0.5 text-[11px] font-semibold rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0078d4] ${prop.status === 'Active'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-amber-50 text-amber-700 border-amber-300'
            }`}
          title="Click to update operational status"
        >
          <option value="Active" className="bg-white text-neutral-900 font-normal">Active</option>
          <option value="Under Maintenance" className="bg-white text-neutral-900 font-normal">Under Maintenance</option>
        </select>
      ) : (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${prop.status === 'Active'
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

    return <span className="text-[#242424] text-[11px]">{val !== undefined && val !== null && val !== '' ? String(val) : '—'}</span>;
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#0d9488]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">Properties Directory</h1>
            <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#99f6e4]">
              {visibleProperties.length} Properties
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Official accommodation list with Property IDs (PIDs), resident capacity, and lead officers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Super Admin Table Customizer */}
          {currentUserRole === 'Super Admin' && (
            <button
              id="btn-customize-sites-table"
              onClick={() => setIsSchemaEditorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#edebe9] border border-[#8a8886] text-[#323130] rounded-xs text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Configure Table Headers & Form Fields (Super Admin Only)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#0d9488]" />
              <span>Customize Table</span>
            </button>
          )}

          {/* Audit Trail Button */}
          <button
            id="btn-view-property-audit"
            onClick={() => setActivePage('audit')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#edebe9] border border-[#8a8886] text-[#323130] rounded-xs text-xs font-semibold shadow-xs transition-colors"
            title="View timestamped property CRUD audit trail"
          >
            <History className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>Activity Log</span>
          </button>

          {/* Quick Resync Master Hotels Button */}
          <button
            id="btn-sync-master-hotels"
            onClick={handleSyncMasterHotels}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#edebe9] border border-[#8a8886] text-[#323130] rounded-xs text-xs font-semibold shadow-xs transition-colors"
            title="Reload and synchronize official master list of 16 hotels and PIDs"
          >
            {syncSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Synchronized!</span>
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

          {hasAdminAuthority && (
            <button
              id="btn-add-property"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Property</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <SearchInput
            id="properties-search"
            placeholder="Search property name, PID, city, officer..."
            value={searchQuery}
            onChange={val => {
              setSearchQuery(val);
              setCurrentPage(1);
            }}
            storageKey="properties_search"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['All', 'Active', 'Under Maintenance'] as const).map(st => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-xs transition-colors ${statusFilter === st
                  ? 'bg-[#0d9488] text-white font-semibold'
                  : 'bg-[#faf9f8] text-[#323130] hover:bg-[#edebe9] border border-[#edebe9]'
                }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Properties Table with persistent full container height */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8f9fa] border-b border-[#e1dfdd] text-[#605e5c] font-semibold select-none">
                {visibleSitesColumns.map(col => (
                  <th
                    key={String(col.key)}
                    onClick={() => handleSort(col.key as any)}
                    className="p-3 cursor-pointer hover:bg-[#edebe9] transition-colors"
                    title={`Sort by ${col.label}`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      {col.isCustom && (
                        <span className="px-1 text-[9px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded">
                          custom
                        </span>
                      )}
                      {sortField === col.key ? (
                        sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />
                      )}
                    </div>
                  </th>
                ))}
                <th className="p-3">Assigned Staff & Managers</th>
                {hasAdminAuthority && <th className="p-3 text-right w-24 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9]">
              {paginatedProperties.length === 0 ? (
                <tr>
                  <td colSpan={visibleSitesColumns.length + (hasAdminAuthority ? 2 : 1)} className="p-12 text-center text-[#605e5c]">
                    No properties match your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedProperties.map(prop => (
                  <tr key={prop.id} className="hover:bg-[#f3f8fd] transition-colors">
                    {visibleSitesColumns.map(col => (
                      <td key={String(col.key)} className="p-3">
                        {renderColumnCell(col, prop)}
                      </td>
                    ))}
                    <td className="p-3 text-[#323130]">
                      {(() => {
                        const assigned = users.filter(u => u.assignedSites?.includes(prop.name) || u.assignedSites?.includes('All'));
                        if (assigned.length === 0) return <span className="text-neutral-400 italic text-[11px]">No staff assigned</span>;
                        return (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {assigned.map(u => (
                              <span key={u.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-teal-50 text-blue-800 border border-teal-200 rounded text-[11px] font-medium" title={`${u.role} (${u.email})`}>
                                <span>{u.name}</span>
                                <span className="text-[9px] text-blue-600 font-bold">({u.role})</span>
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    {hasAdminAuthority && (
                      <td className="p-3 text-right sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingProperty(prop)}
                            className="p-1.5 text-neutral-600 hover:text-[#0d9488] hover:bg-[#edebe9] rounded"
                            title="View Property Record"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(prop)}
                            className="p-1.5 text-[#0d9488] hover:bg-[#edebe9] rounded"
                            title="Edit Property"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteProperty(prop.id)}
                            className="p-1.5 text-[#a4262c] hover:bg-red-50 rounded"
                            title="Delete Property"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
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

      {/* ADD PROPERTY MODAL */}
      <DynamicRecordFormModal<PropertyInfo>
        isOpen={isAddModalOpen}
        title="Add New Property / Site"
        columns={sitesColumns as any}
        initialValues={{
          status: 'Active',
          capacity: 100
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
