import React, { useState, useEffect, useMemo } from 'react';
import { BulkActionToolbar } from '../common/BulkActionToolbar';
import { UsersRound, Plus, Search, Building2, Home, DoorOpen, Eye, Edit3, ArrowRightLeft, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suPropertyService } from '../../services/suPropertyService';
import { ServiceUserMaster, PropertyMaster, PropertyRoom, Placement } from '../../types/masterData';
import { ServiceUserFormModal } from './ServiceUserFormModal';
import { ServiceUserProfileView } from './ServiceUserProfileView';
import { MoveAccommodationModal } from './MoveAccommodationModal';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption } from '../common/ExportModal';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';

const suExportColumns: ExportColumnOption[] = [
  { id: 'suReference', label: 'SU ID', defaultSelected: true },
  { id: 'name', label: 'Full Name', defaultSelected: true },
  { id: 'externalReference', label: 'Port / HO Ref', defaultSelected: true },
  { id: 'dateOfBirth', label: 'Date of Birth', defaultSelected: true },
  { id: 'gender', label: 'Gender', defaultSelected: true },
  { id: 'nationality', label: 'Nationality', defaultSelected: true },
  { id: 'siteName', label: 'Current Site', defaultSelected: true },
  { id: 'propertyName', label: 'Current Property', defaultSelected: true },
  { id: 'roomNumber', label: 'Room', defaultSelected: true },
  { id: 'status', label: 'Status', defaultSelected: true }
];

export const ServiceUsersView: React.FC = () => {
  const { sites, canAccessAllSites, assignedSite, canManageUsers , requestConfirmation } = useApp();
  const canCRUD = canManageUsers();

  const [serviceUsers, setServiceUsers] = useState<ServiceUserMaster[]>([]);
  const [properties, setProperties] = useState<PropertyMaster[]>([]);
  const [rooms, setRooms] = useState<PropertyRoom[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(false);

  // Initial site filter based on permissions (maps assigned site name to site id if needed)
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
  const [placementFilter, setPlacementFilter] = useState<'all' | 'placed' | 'unplaced'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSUForProfile, setSelectedSUForProfile] = useState<ServiceUserMaster | null>(null);
  const [selectedSUForEdit, setSelectedSUForEdit] = useState<ServiceUserMaster | null>(null);
  const [selectedSUForMove, setSelectedSUForMove] = useState<ServiceUserMaster | null>(null);

  const loadMasterData = async () => {
    setLoading(true);
    try {
      const activeSiteId = siteFilter !== 'all' && siteFilter !== 'All Sites' ? siteFilter : undefined;
      const [suRes, propRes, plcRes] = await Promise.all([
        suPropertyService.getServiceUsers(activeSiteId),
        suPropertyService.getProperties(activeSiteId),
        suPropertyService.getPlacements({ siteId: activeSiteId })
      ]);

      const loadedSUs = suRes.success && suRes.data ? suRes.data : [];
      const loadedProps = propRes.success && propRes.data ? propRes.data : [];
      const loadedPlcs = plcRes.success && plcRes.data ? plcRes.data : [];

      setServiceUsers(loadedSUs);
      setProperties(loadedProps);
      setPlacements(loadedPlcs);

      if (loadedProps.length > 0) {
        const roomPromises = loadedProps.map(p => suPropertyService.getRooms(p.id));
        const roomRes = await Promise.all(roomPromises);
        setRooms(roomRes.flatMap(r => (r.success && r.data ? r.data : [])));
      } else {
        setRooms([]);
      }
    } catch (err) {
      console.error('Failed to load Service Users master data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSiteFilter(initialSiteFilter);
  }, [initialSiteFilter]);

  useEffect(() => {
    loadMasterData();
  }, [siteFilter]);

  useEffect(() => {
    const handleUpdate = () => { loadMasterData(); };
    window.addEventListener('sdtracker:masterDataUpdated', handleUpdate);
    return () => window.removeEventListener('sdtracker:masterDataUpdated', handleUpdate);
  }, [siteFilter]);

  const propMap = useMemo(() => new Map(properties.map(p => [p.id, p])), [properties]);
  const roomMap = useMemo(() => new Map(rooms.map(r => [r.id, r])), [rooms]);
  const activePlacementMap = useMemo(() => {
    const map = new Map<string, Placement>();
    placements.filter(p => p.status === 'Active').forEach(p => map.set(p.suId, p));
    return map;
  }, [placements]);

  const totalCount = serviceUsers.length;
  const activeCount = serviceUsers.filter(u => u.status === 'Active').length;
  const placedCount = serviceUsers.filter(u => activePlacementMap.has(u.id)).length;
  const unplacedCount = totalCount - placedCount;

  const filteredUsers = useMemo(() => {
    return serviceUsers.filter(u => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = `${u.firstName} ${u.lastName}`.toLowerCase().includes(q);
        const matchesRef = u.suReference.toLowerCase().includes(q);
        const matchesExt = u.externalReference?.toLowerCase().includes(q);
        if (!matchesName && !matchesRef && !matchesExt) return false;
      }
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      const isPlaced = activePlacementMap.has(u.id);
      if (placementFilter === 'placed' && !isPlaced) return false;
      if (placementFilter === 'unplaced' && isPlaced) return false;
      return true;
    });
  }, [serviceUsers, searchTerm, statusFilter, placementFilter, activePlacementMap]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const handlePerformExport = (options: { format: 'csv' | 'pdf'; orientation: 'portrait' | 'landscape'; selectedColumns?: string[] }) => {
    const cols = options.selectedColumns && options.selectedColumns.length > 0
      ? suExportColumns.filter(c => options.selectedColumns?.includes(c.id))
      : suExportColumns;
    const headers = cols.map(c => c.label);
    const rows = filteredUsers.map(u => {
      const plc = activePlacementMap.get(u.id);
      const prop = plc ? propMap.get(plc.propertyId) : null;
      const rm = plc ? roomMap.get(plc.roomId) : null;
      const siteObj = sites.find(s => s.id === (plc?.siteId || u.siteId));
      return cols.map(c => {
        if (c.id === 'name') return `${u.firstName} ${u.lastName}`;
        if (c.id === 'siteName') return siteObj?.name || '—';
        if (c.id === 'propertyName') return prop?.propertyName || '—';
        if (c.id === 'roomNumber') return rm ? `Room ${rm.roomNumber}` : '—';
        return String((u as any)[c.id] ?? '—');
      });
    });

    if (options.format === 'csv') {
      exportTableToCsv({ filename: `ServiceUsers-Master-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows });
    } else {
      exportTableToPdf({
        title: 'Service Users Master Register',
        subtitle: 'Central register for resident profiles, identity, and accommodation placements.',
        filename: `ServiceUsers-Master-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows
      });
    }
  };

  if (selectedSUForProfile) {
    return (
      <div className="space-y-4 w-full animate-fade-in">
        <ServiceUserProfileView
          serviceUser={selectedSUForProfile}
          onBack={() => setSelectedSUForProfile(null)}
          onEditSU={(su) => {
            setSelectedSUForEdit(su);
            setIsCreateModalOpen(true);
          }}
          onRefreshData={loadMasterData}
        />

        <ServiceUserFormModal
          isOpen={isCreateModalOpen}
          onClose={() => { setIsCreateModalOpen(false); setSelectedSUForEdit(null); }}
          serviceUserToEdit={selectedSUForEdit}
          onSuccess={() => { loadMasterData(); setIsCreateModalOpen(false); setSelectedSUForEdit(null); }}
        />

        {selectedSUForMove && (
          <MoveAccommodationModal
            isOpen={!!selectedSUForMove}
            onClose={() => setSelectedSUForMove(null)}
            serviceUser={selectedSUForMove}
            currentPlacement={activePlacementMap.get(selectedSUForMove.id) || null}
            currentProperty={activePlacementMap.has(selectedSUForMove.id) ? propMap.get(activePlacementMap.get(selectedSUForMove.id)!.propertyId) || null : null}
            currentRoom={activePlacementMap.has(selectedSUForMove.id) ? roomMap.get(activePlacementMap.get(selectedSUForMove.id)!.roomId) || null : null}
            onSuccess={() => { loadMasterData(); setSelectedSUForMove(null); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full animate-fade-in">
      {/* Top Banner, Header, Actions & Filters in ONE unified section */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 border border-teal-200 text-[#0d9488] rounded-xs">
              <UsersRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424] tracking-tight">
                  Service Users Master
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-xs bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4]">
                  {filteredUsers.length} Service Users
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Central source of truth for resident identity, contacts, placement history, and operational profiles.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadMasterData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
              title="Refresh master data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#0d9488] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <ExportDropdown
              moduleName="Service Users"
              totalRecordCount={serviceUsers.length}
              filteredRecordCount={filteredUsers.length}
              defaultOrientation="landscape"
              availableColumns={suExportColumns}
              onExport={handlePerformExport}
            />

            {canCRUD && (
              <button
                id="btn-add-service-user"
                onClick={() => { setSelectedSUForEdit(null); setIsCreateModalOpen(true); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold rounded-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Service User</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar integrated into the same card */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, SU ID, or Port Ref..."
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
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
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
              <option value="Pending">Pending</option>
              <option value="Inactive">Inactive</option>
              <option value="Discharged">Discharged</option>
            </select>
          </div>

          <div>
            <select
              value={placementFilter}
              onChange={e => { setPlacementFilter(e.target.value as any); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Placements</option>
              <option value="placed">Placed Only</option>
              <option value="unplaced">Awaiting Placement Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Stats Row matching SDTracker design */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Total Service Users</span>
          <p className="text-xl font-bold text-[#242424] mt-0.5">{totalCount}</p>
          <span className="text-[11px] text-[#0f766e] font-semibold mt-0.5 block">{activeCount} currently active</span>
        </div>
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Placed in Rooms</span>
          <p className="text-xl font-bold text-[#0d9488] mt-0.5">{placedCount}</p>
          <span className="text-[11px] text-neutral-500 mt-0.5 block">Assigned active accommodation</span>
        </div>
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Awaiting Placement</span>
          <p className="text-xl font-bold text-amber-600 mt-0.5">{unplacedCount}</p>
          <span className="text-[11px] text-amber-700 mt-0.5 block">Needs room allocation</span>
        </div>
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Managed Properties</span>
          <p className="text-xl font-bold text-[#242424] mt-0.5">{properties.length}</p>
          <span className="text-[11px] text-neutral-500 mt-0.5 block">{rooms.length} registered rooms</span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs min-h-[520px] lg:min-h-[calc(100vh-270px)] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold select-none">
                <th className="py-2.5 px-3">SU ID</th>
                <th className="py-2.5 px-3">Service User Name</th>
                <th className="py-2.5 px-3">Date of Birth</th>
                <th className="py-2.5 px-3">Site / Hotel</th>
                <th className="py-2.5 px-3">Property</th>
                <th className="py-2.5 px-3">Room</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Placement</th>
                <th className="py-2.5 px-3 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10 select-none">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {loading && paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 text-[#0d9488] animate-spin" />
                    <p className="font-medium text-xs">Loading Service User records...</p>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400">
                    <UsersRound className="w-8 h-8 mx-auto mb-2 text-neutral-300 opacity-60" />
                    <p className="font-medium text-xs">No Service Users matching current filters</p>
                    <p className="text-[11px] mt-0.5">Click "+ Add Service User" to create a new master record.</p>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map(u => {
                  const plc = activePlacementMap.get(u.id);
                  const prop = plc ? propMap.get(plc.propertyId) : null;
                  const rm = plc ? roomMap.get(plc.roomId) : null;
                  const siteObj = sites.find(s => s.id === (plc?.siteId || u.siteId));

                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedSUForProfile(u)}
                      className="group hover:bg-[#fbfbfa] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-xs bg-[#f0fdfa] text-[#0f766e] px-2 py-0.5 rounded-xs border border-[#99f6e4] inline-block">
                          {u.suReference}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#242424] group-hover:text-[#0d9488] transition-colors">
                          {u.firstName} {u.lastName}
                        </div>
                        {u.externalReference && (
                          <span className="text-[10px] text-neutral-400 font-mono block">
                            HO: {u.externalReference}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600 font-mono text-[11px]">
                        {u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#242424]">
                        {siteObj?.name || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-700">
                        {prop?.propertyName || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {rm ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#0f766e]">
                            <DoorOpen className="w-3.5 h-3.5 text-teal-600" />
                            <span>Room {rm.roomNumber}</span>
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded border ${
                          u.status === 'Active' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          u.status === 'Pending' ? 'bg-amber-50 text-amber-900 border-amber-200' :
                          'bg-neutral-100 text-neutral-700 border-neutral-300'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {plc ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                            <CheckCircle2 className="w-3 h-3 text-teal-600" />
                            <span>Placed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>Awaiting</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right sticky right-0 bg-white group-hover:bg-[#fbfbfa] shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10 select-none">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedSUForProfile(u)}
                            className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                            title="View SU Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canCRUD && (
                            <button
                              type="button"
                              onClick={() => { setSelectedSUForEdit(u); setIsCreateModalOpen(true); }}
                              className="p-1 text-neutral-500 hover:text-blue-600 hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                              title="Edit Service User"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canCRUD && (
                            <button
                              type="button"
                              onClick={() => setSelectedSUForMove(u)}
                              className="p-1 text-neutral-500 hover:text-teal-700 hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                              title="Move Accommodation"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
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
            totalItems={filteredUsers.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* Embedded Modals / Drawers (URL remains /su-users) */}
      <ServiceUserFormModal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setSelectedSUForEdit(null); }}
        serviceUserToEdit={selectedSUForEdit}
        onSuccess={() => { loadMasterData(); setIsCreateModalOpen(false); setSelectedSUForEdit(null); }}
      />


      {selectedSUForMove && (
        <MoveAccommodationModal
          isOpen={!!selectedSUForMove}
          onClose={() => setSelectedSUForMove(null)}
          serviceUser={selectedSUForMove}
          currentPlacement={activePlacementMap.get(selectedSUForMove.id) || null}
          currentProperty={activePlacementMap.has(selectedSUForMove.id) ? propMap.get(activePlacementMap.get(selectedSUForMove.id)!.propertyId) || null : null}
          currentRoom={activePlacementMap.has(selectedSUForMove.id) ? roomMap.get(activePlacementMap.get(selectedSUForMove.id)!.roomId) || null : null}
          onSuccess={() => { loadMasterData(); setSelectedSUForMove(null); }}
        />
      )}
    </div>
  );
};
