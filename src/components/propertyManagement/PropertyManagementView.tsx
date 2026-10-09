import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Plus, Search, RefreshCw, Eye, Edit3, 
  DoorClosed, Users, MapPin 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suPropertyService } from '../../services/suPropertyService';
import { PropertyMaster, PropertyRoom, Placement } from '../../types/masterData';
import { PropertyFormModal } from './PropertyFormModal';
import { PropertyProfileView } from './PropertyProfileView';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption } from '../common/ExportModal';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';

const propertyExportColumns: ExportColumnOption[] = [
  { id: 'propertyReference', label: 'Property ID', defaultSelected: true },
  { id: 'propertyName', label: 'Property Name', defaultSelected: true },
  { id: 'siteName', label: 'Site / Location', defaultSelected: true },
  { id: 'address', label: 'Full Address', defaultSelected: true },
  { id: 'propertyType', label: 'Property Type', defaultSelected: true },
  { id: 'roomsCount', label: 'Rooms Count', defaultSelected: true },
  { id: 'maximumOccupancy', label: 'Bed Capacity', defaultSelected: true },
  { id: 'occupiedRooms', label: 'Occupied Spaces', defaultSelected: true },
  { id: 'occupancyRate', label: 'Occupancy Rate', defaultSelected: true },
  { id: 'status', label: 'Status', defaultSelected: true }
];

import { BulkActionToolbar } from '../common/BulkActionToolbar';

export const PropertyManagementView: React.FC = () => {
  const { sites, canAccessAllSites, assignedSite, canManageProperties, requestConfirmation } = useApp();
  const canCRUD = canManageProperties();

  const [properties, setProperties] = useState<PropertyMaster[]>([]);
  const [rooms, setRooms] = useState<PropertyRoom[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(false);

  // Initial site filter based on permissions
  const initialSiteFilter = useMemo(() => {
    if (canAccessAllSites()) return 'all';
    if (!assignedSite || assignedSite === 'All Sites') return 'all';
    const found = sites.find(s => s.name === assignedSite || s.id === assignedSite);
    return found ? found.id : assignedSite;
  }, [sites, assignedSite, canAccessAllSites]);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [siteFilter, setSiteFilter] = useState(initialSiteFilter);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals & Drawers
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyMaster | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<PropertyMaster | null>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const activeSiteId = siteFilter !== 'all' && siteFilter !== 'All Sites' ? siteFilter : undefined;
      const [propsRes, plcsRes, roomsRes] = await Promise.all([
        suPropertyService.getProperties(activeSiteId),
        suPropertyService.getPlacements({ status: 'Active', siteId: activeSiteId }),
        suPropertyService.getRooms()
      ]);

      const loadedProps = propsRes.success && propsRes.data ? propsRes.data : [];
      const loadedPlcs = plcsRes.success && plcsRes.data ? plcsRes.data : [];
      const propIdSet = new Set(loadedProps.map(p => p.id));
      const loadedRooms = (roomsRes.success && roomsRes.data ? roomsRes.data : []).filter(r => propIdSet.has(r.propertyId));

      setProperties(loadedProps);
      setPlacements(loadedPlcs);
      setRooms(loadedRooms);
    } catch (err) {
      console.error('Failed to load property data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setSiteFilter(initialSiteFilter); }, [initialSiteFilter]);
  useEffect(() => { loadData(); }, [siteFilter]);

  // Real-time listener for any property or master data mutations
  useEffect(() => {
    const handleMasterUpdate = () => { loadData(); };
    window.addEventListener('sdtracker:masterDataUpdated', handleMasterUpdate);
    return () => window.removeEventListener('sdtracker:masterDataUpdated', handleMasterUpdate);
  }, []);

  const siteMap = useMemo(() => new Map(sites.map(s => [s.id, s.name])), [sites]);

  const propertyMetrics = useMemo(() => {
    const map = new Map<string, { totalRooms: number; occupiedRooms: number; capacity: number }>();
    properties.forEach(p => {
      const pRooms = rooms.filter(r => r.propertyId === p.id);
      const pPlacements = placements.filter(pl => pl.propertyId === p.id);
      const cap = p.maximumOccupancy || pRooms.reduce((acc, r) => acc + (r.capacity || 1), 0);
      map.set(p.id, { totalRooms: pRooms.length, occupiedRooms: pPlacements.length, capacity: cap });
    });
    return map;
  }, [properties, rooms, placements]);

  const dashboardStats = useMemo(() => {
    const totalProps = properties.length;
    const activeProps = properties.filter(p => p.status === 'Active').length;
    const totalCapacity = properties.reduce((acc, p) => acc + (p.maximumOccupancy || 0), 0);
    const totalActivePlacements = placements.length;
    const totalRooms = rooms.length;
    const availableRooms = rooms.filter(r => r.occupancyStatus === 'Available').length;
    const occupancyRate = totalCapacity > 0 ? Math.round((totalActivePlacements / totalCapacity) * 100) : 0;
    return { totalProps, activeProps, totalCapacity, totalActivePlacements, totalRooms, availableRooms, occupancyRate };
  }, [properties, placements, rooms]);

  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      const siteName = siteMap.get(p.siteId || '') || '';
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesRef = p.propertyReference.toLowerCase().includes(q);
        const matchesName = p.propertyName.toLowerCase().includes(q);
        const matchesCity = p.city?.toLowerCase().includes(q);
        const matchesPostcode = p.postcode?.toLowerCase().includes(q);
        const matchesSite = siteName.toLowerCase().includes(q);
        if (!matchesRef && !matchesName && !matchesCity && !matchesPostcode && !matchesSite) return false;
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (typeFilter !== 'all' && p.propertyType !== typeFilter) return false;
      return true;
    });
  }, [properties, searchTerm, statusFilter, typeFilter, siteMap]);

  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProperties.slice(start, start + pageSize);
  }, [filteredProperties, currentPage, pageSize]);

  const handlePerformExport = (options: { format: 'csv' | 'pdf'; orientation: 'portrait' | 'landscape'; selectedColumns?: string[] }) => {
    const cols = options.selectedColumns && options.selectedColumns.length > 0
      ? propertyExportColumns.filter(c => options.selectedColumns?.includes(c.id))
      : propertyExportColumns;
    const headers = cols.map(c => c.label);
    const rows = filteredProperties.map(p => {
      const siteName = siteMap.get(p.siteId || '') || '—';
      const metrics = propertyMetrics.get(p.id) || { totalRooms: 0, occupiedRooms: 0, capacity: p.maximumOccupancy || 0 };
      const fullAddr = [p.addressLine1, p.city, p.postcode].filter(Boolean).join(', ') || '—';
      const rate = metrics.capacity > 0 ? `${Math.round((metrics.occupiedRooms / metrics.capacity) * 100)}%` : '0%';

      return cols.map(c => {
        if (c.id === 'siteName') return siteName;
        if (c.id === 'address') return fullAddr;
        if (c.id === 'roomsCount') return String(metrics.totalRooms);
        if (c.id === 'maximumOccupancy') return String(metrics.capacity);
        if (c.id === 'occupiedRooms') return String(metrics.occupiedRooms);
        if (c.id === 'occupancyRate') return rate;
        return String((p as any)[c.id] ?? '—');
      });
    });

    if (options.format === 'csv') {
      exportTableToCsv({ filename: `Properties-Master-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows });
    } else {
      exportTableToPdf({
        title: 'Properties Master Register',
        subtitle: 'Central register for accommodation facilities, room capacity, and active occupancy.',
        filename: `Properties-Master-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows
      });
    }
  };


  const handleToggleSelectAll = () => {
    if (selectedIds.length === paginatedProperties.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedProperties.map(p => p.id));
    }
  };

  const handleToggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    requestConfirmation({
      title: 'Delete Selected Properties',
      message: `Are you sure you want to delete ${selectedIds.length} propert${selectedIds.length === 1 ? 'y' : 'ies'}? This action cannot be undone.`,
      confirmLabel: 'Delete Properties',
      isDanger: true,
      onConfirm: async () => {
        for (const id of selectedIds) {
          const prop = properties.find(p => p.id === id);
          await suPropertyService.deleteProperty(id, prop?.propertyReference, prop?.propertyName);
        }
        setSelectedIds([]);
        await loadData();
      }
    });
  };

  if (selectedProperty) {
    return (
      <div className="space-y-4 w-full animate-fade-in">
        <PropertyProfileView
          property={selectedProperty}
          onBack={() => setSelectedProperty(null)}
          onEditProperty={(prop) => {
            setEditingProperty(prop);
            setIsFormOpen(true);
          }}
          onRefreshData={loadData}
        />

        <PropertyFormModal
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingProperty(null); }}
          propertyToEdit={editingProperty}
          onSuccess={() => { loadData(); setIsFormOpen(false); setEditingProperty(null); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full animate-fade-in">
      {/* Top Banner, Header, Actions & Filters in ONE unified card */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 border border-teal-200 text-[#0d9488] rounded-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424] tracking-tight">Property Management</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-xs bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4]">
                  {filteredProperties.length} Properties
                </span>
              </div>
              <p className="text-xs text-neutral-500">Central source of truth for sites, properties, rooms, occupancy, and facilities.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
              title="Refresh property data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#0d9488] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <ExportDropdown
              moduleName="Properties"
              totalRecordCount={properties.length}
              filteredRecordCount={filteredProperties.length}
              defaultOrientation="landscape"
              availableColumns={propertyExportColumns}
              onExport={handlePerformExport}
            />

            {canCRUD && (
              <button
                id="btn-add-property"
                onClick={() => { setEditingProperty(null); setIsFormOpen(true); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold rounded-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Property</span>
              </button>
            )}
          </div>
        </div>

        {/* Integrated Filter Bar */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ID, name, city, or postcode..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            />
          </div>

          <div>
            <select
              value={siteFilter}
              onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); }}
              disabled={!canAccessAllSites() && assignedSite !== 'All Sites'}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Sites ({sites.length})</option>
              {sites.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Property Types</option>
              <option value="HMO">HMO</option>
              <option value="House">House</option>
              <option value="Apartment">Apartment</option>
              <option value="Hostel">Hostel</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Stats Row matching SDTracker design */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Total Properties</span>
          <p className="text-xl font-bold text-[#242424] mt-0.5">{dashboardStats.totalProps}</p>
          <span className="text-[11px] text-[#0f766e] font-semibold mt-0.5 block">{dashboardStats.activeProps} operational</span>
        </div>
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Registered Rooms</span>
          <p className="text-xl font-bold text-[#0d9488] mt-0.5">{dashboardStats.totalRooms}</p>
          <span className="text-[11px] text-neutral-500 mt-0.5 block">{dashboardStats.availableRooms} currently available</span>
        </div>
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Bed Capacity</span>
          <p className="text-xl font-bold text-[#242424] mt-0.5">{dashboardStats.totalCapacity}</p>
          <span className="text-[11px] text-neutral-500 mt-0.5 block">{dashboardStats.totalActivePlacements} occupied spaces</span>
        </div>
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Occupancy Rate</span>
          <p className="text-xl font-bold text-[#0f766e] mt-0.5">{dashboardStats.occupancyRate}%</p>
          <span className="text-[11px] text-neutral-500 mt-0.5 block">Portfolio utilization</span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs min-h-[520px] lg:min-h-[calc(100vh-270px)] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold select-none">
                <th className="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={paginatedProperties.length > 0 && selectedIds.length === paginatedProperties.length}
                    onChange={handleToggleSelectAll}
                    className="rounded-xs text-[#0d9488] focus:ring-[#0d9488]"
                  />
                </th>
                <th className="py-2.5 px-3">Property ID</th>
                <th className="py-2.5 px-3">Property Name</th>
                <th className="py-2.5 px-3">Site</th>
                <th className="py-2.5 px-3">Address</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-center">Rooms</th>
                <th className="py-2.5 px-3 text-center">Occupancy</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right w-24 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10 select-none">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {loading && paginatedProperties.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 text-[#0d9488] animate-spin" />
                    <p className="font-medium text-xs">Loading property records...</p>
                  </td>
                </tr>
              ) : paginatedProperties.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-neutral-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-neutral-300 opacity-60" />
                    <p className="font-medium text-xs">No properties matching current filters</p>
                    <p className="text-[11px] mt-0.5">Click "+ Add Property" to register a new building.</p>
                  </td>
                </tr>
              ) : (
                paginatedProperties.map(prop => {
                  const siteName = siteMap.get(prop.siteId || '') || '—';
                  const metrics = propertyMetrics.get(prop.id) || { totalRooms: 0, occupiedRooms: 0, capacity: prop.maximumOccupancy || 0 };
                  const availableBeds = Math.max(0, metrics.capacity - metrics.occupiedRooms);
                  const isFull = metrics.capacity > 0 && availableBeds === 0;

                  return (
                    <tr 
                      key={prop.id}
                      onClick={() => setSelectedProperty(prop)}
                      className="group hover:bg-[#fbfbfa] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 w-8" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(prop.id)}
                          onChange={e => handleToggleSelect(e, prop.id)}
                          className="rounded-xs text-[#0d9488] focus:ring-[#0d9488]"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-xs bg-[#f0fdfa] text-[#0f766e] px-2 py-0.5 rounded-xs border border-[#99f6e4] inline-block">
                          {prop.propertyReference}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#242424] group-hover:text-[#0d9488] transition-colors">
                          {prop.propertyName}
                        </div>
                        {prop.provider && (
                          <span className="text-[10px] text-neutral-400 block">Provider: {prop.provider}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#242424]">{siteName}</td>
                      <td className="py-2.5 px-3 text-neutral-600 text-[11px]">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                          <span className="truncate max-w-[200px]">
                            {[prop.addressLine1, prop.city, prop.postcode].filter(Boolean).join(', ') || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block px-2 py-0.5 text-[11px] font-medium bg-[#f3f2f1] text-[#323130] rounded-xs border border-[#e5e5e5]">
                          {prop.propertyType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold text-neutral-700">
                          <DoorClosed className="w-3.5 h-3.5 text-neutral-400" />
                          {metrics.totalRooms}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#0f766e]">
                          <Users className="w-3.5 h-3.5 text-[#0d9488]" />
                          {metrics.occupiedRooms} / {metrics.capacity}
                        </span>
                        <div className="text-[10px] text-neutral-400">
                          {isFull ? <span className="text-amber-600 font-medium">Full</span> : <span>{availableBeds} free</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded border ${
                          prop.status === 'Active' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          prop.status === 'Under Maintenance' ? 'bg-amber-50 text-amber-900 border-amber-200' :
                          'bg-neutral-100 text-neutral-700 border-neutral-300'
                        }`}>
                          {prop.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right sticky right-0 bg-white group-hover:bg-[#fbfbfa] shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10 select-none">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedProperty(prop)}
                            className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                            title="View Property Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canCRUD && (
                            <button
                              type="button"
                              onClick={() => { setEditingProperty(prop); setIsFormOpen(true); }}
                              className="p-1 text-neutral-500 hover:text-blue-600 hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                              title="Edit Property"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Standard Pagination Footer */}
        <div className="px-3 py-2 border-t border-[#f0f0f0] flex items-center justify-between shrink-0">
          <Pagination
            currentPage={currentPage}
            totalItems={filteredProperties.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      <BulkActionToolbar
        selectedCount={selectedIds.length}
        totalCount={filteredProperties.length}
        onClearSelection={() => setSelectedIds([])}
        onSelectAll={() => setSelectedIds(filteredProperties.map(p => p.id))}
        onDeleteSelected={canCRUD ? handleDeleteSelected : undefined}
      />

      {/* Property Creation/Edit Modal */}
      <PropertyFormModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingProperty(null); }}
        propertyToEdit={editingProperty}
        onSuccess={() => { loadData(); setIsFormOpen(false); setEditingProperty(null); }}
      />

    </div>
  );
};
