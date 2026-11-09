import React, { useState, useEffect, useMemo } from 'react';
import { BulkActionToolbar } from '../common/BulkActionToolbar';
import { 
  IconUsersGroup as UsersRound, 
  IconPlus as Plus, 
  IconSearch as Search, 
  IconDoorEnter as DoorOpen, 
  IconEye as Eye, 
  IconEdit as Edit3, 
  IconArrowsLeftRight as ArrowRightLeft, 
  IconRefresh as RefreshCw, 
  IconCircleCheck as CheckCircle2, 
  IconAlertCircle as AlertCircle, 
  IconTrash as Trash2, 
  IconUserMinus as UserMinus, 
  IconLock as Lock,
  IconChevronDown as ChevronDown,
  IconChevronRight as ChevronRight,
  IconShieldExclamation as ShieldAlert,
  IconFlame as Flame,
  IconStethoscope as Stethoscope,
  IconSettings2 as Settings2
} from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { suPropertyService } from '../../services/suPropertyService';
import { QuickOptionModal } from '../common/QuickOptionModal';
import { 
  ServiceUserMaster, 
  PropertyMaster, 
  PropertyRoom, 
  Placement
} from '../../types/masterData';
import { ServiceUserFormModal } from './ServiceUserFormModal';
import { activePlacementBySu } from '../../utils/placementSelection';
import { getServiceUserRecords, countServiceUserRecords } from '../../utils/serviceUserRecords';
import { ServiceUserProfileView } from './ServiceUserProfileView';
import { MoveAccommodationModal } from './MoveAccommodationModal';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption } from '../common/ExportModal';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { ArchiveRequestsQueue } from './SUArchivePanel';

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
  { id: 'status', label: 'Status', defaultSelected: true },
  { id: 'vulnerable', label: 'Vulnerable', defaultSelected: true },
  { id: 'personalEvacuationPlan', label: 'Personal Evacuation Plan', defaultSelected: true },
  { id: 'gpRegistration', label: 'GP Registration', defaultSelected: true },
  { id: 'disabilityCategory', label: 'Disability Category', defaultSelected: true },
  { id: 'disabilityType', label: 'Disability Type', defaultSelected: true }
];

export const ServiceUsersView: React.FC = () => {
  const {
    irRecords, challengingSUs, referrals, welfareChecks, rfaWelfareRecords, mhComplaintWelfareRecords,
    gpAppointmentRecords, publicTransportRecords,
    fieldOptions,
    sites, canAccessAllSites, assignedSite, allowedSites, defaultSiteFilter, isSitePermitted, canManageUsers, requestConfirmation } = useApp();
  const canCRUD = canManageUsers();
  const [profileInitialTab, setProfileInitialTab] = useState<string | undefined>(undefined);

  const [disabilityOptionCategory, setDisabilityOptionCategory] = useState<'disabilityCategories' | 'disabilityTypes' | null>(null);
  const [showDisabilityMenu, setShowDisabilityMenu] = useState(false);

  const getDisabilityCategoryColor = (catName?: string) => {
    if (!catName || catName === 'None') return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    const opt = (fieldOptions || []).find(o => o.category === 'disabilityCategories' && (o.value === catName || o.label === catName));
    const color = opt?.color || 'blue';
    switch (color) {
      case 'blue': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'purple': return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'amber': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'red': return 'bg-red-50 text-red-800 border-red-200';
      case 'teal': return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'emerald': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'indigo': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'cyan': return 'bg-cyan-50 text-cyan-800 border-cyan-200';
      case 'rose': return 'bg-rose-50 text-rose-800 border-rose-200';
      default: return 'bg-blue-50 text-blue-800 border-blue-200';
    }
  };

  const [serviceUsers, setServiceUsers] = useState<ServiceUserMaster[]>([]);
  const [properties, setProperties] = useState<PropertyMaster[]>([]);
  const [rooms, setRooms] = useState<PropertyRoom[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(false);

  // Initial site filter based on permissions (maps assigned site name to site id if needed)
  // Follows the property chosen in the top bar (defaultSiteFilter already honours the user's permitted sites)
  const initialSiteFilter = useMemo(() => {
    if (!defaultSiteFilter || defaultSiteFilter === 'all' || defaultSiteFilter === 'All Sites') return 'all';
    const found = sites.find(s => s.name === defaultSiteFilter || s.id === defaultSiteFilter);
    return found ? found.id : defaultSiteFilter;
  }, [sites, defaultSiteFilter]);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [siteFilter, setSiteFilter] = useState(initialSiteFilter);
  const isLockedToSingleSite = !canAccessAllSites() && (allowedSites || []).length <= 1;

  useEffect(() => {
    setSiteFilter(initialSiteFilter);
  }, [initialSiteFilter]);

  // Old data: close superseded duplicate placements and re-sync room status once when the page opens,
  // so the list, the profile and Rooms all show the same room. (It announces itself, so the list reloads.)
  useEffect(() => {
    suPropertyService.repairPlacements().catch(err => console.warn('Placement repair skipped:', err));
  }, []);

  const [statusFilter, setStatusFilter] = useState('all');
  const [placementFilter, setPlacementFilter] = useState<'all' | 'placed' | 'unplaced'>('all');
  const [expandedSuIds, setExpandedSuIds] = useState<Set<string>>(new Set());

  const toggleExpand = (e: React.SyntheticEvent, id: string) => {
    e.stopPropagation();
    setExpandedSuIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSUForProfile, setSelectedSUForProfile] = useState<ServiceUserMaster | null>(null);
  const [selectedSUForEdit, setSelectedSUForEdit] = useState<ServiceUserMaster | null>(null);
  const [selectedSUForMove, setSelectedSUForMove] = useState<ServiceUserMaster | null>(null);

  // Multi-Selection State for Bulk Operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleToggleSelectAll = () => {
    if (selectedIds.length === paginatedUsers.length && paginatedUsers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedUsers.map(u => u.id));
    }
  };

  const handleToggleSelect = (e: React.SyntheticEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    requestConfirmation({
      title: 'Delete Selected Service Users',
      message: `Are you sure you want to permanently delete ${selectedIds.length} service user${selectedIds.length === 1 ? '' : 's'}? All associated accommodation placements, household members, documents, and support records will be deleted, and their allocated room spaces will be released. This action cannot be undone.`,
      confirmLabel: 'Delete Service Users',
      isDanger: true,
      onConfirm: async () => {
        for (const id of selectedIds) {
          const user = serviceUsers.find(u => u.id === id);
          await suPropertyService.deleteServiceUser(id, user?.suReference, user ? `${user.firstName} ${user.lastName}` : undefined);
        }
        setSelectedIds([]);
        await loadMasterData();
      }
    });
  };

  const handleBulkStatusChange = (newStatus: 'Active' | 'Discharged' | 'Pending') => {
    if (selectedIds.length === 0) return;
    requestConfirmation({
      title: `Set Status to ${newStatus}`,
      message: `Update status of ${selectedIds.length} selected service user${selectedIds.length === 1 ? '' : 's'} to "${newStatus}"?${newStatus === 'Discharged' ? ' Any active accommodation placements will be closed and rooms released.' : ''}`,
      confirmLabel: `Update to ${newStatus}`,
      onConfirm: async () => {
        for (const id of selectedIds) {
          await suPropertyService.updateServiceUser(id, { status: newStatus });
        }
        setSelectedIds([]);
        await loadMasterData();
      }
    });
  };

  const handleDeleteSingle = (u: ServiceUserMaster) => {
    requestConfirmation({
      title: `Delete Service User: ${u.firstName} ${u.lastName}`,
      message: `Are you sure you want to permanently delete ${u.firstName} ${u.lastName} (${u.suReference})? All associated placements, household members, documents, and support records will be deleted, and their allocated room space will be released. This action cannot be undone.`,
      confirmLabel: 'Delete Service User',
      isDanger: true,
      onConfirm: async () => {
        await suPropertyService.deleteServiceUser(u.id, u.suReference, `${u.firstName} ${u.lastName}`);
        await loadMasterData();
      }
    });
  };

  const handleQuickDischarge = (u: ServiceUserMaster) => {
    requestConfirmation({
      title: `Discharge Service User: ${u.firstName} ${u.lastName}`,
      message: `Are you sure you want to mark ${u.firstName} ${u.lastName} (${u.suReference}) as Discharged? Their active accommodation placement will be ended, and their room space will be released back to the property.`,
      confirmLabel: 'Discharge Resident',
      isDanger: false,
      onConfirm: async () => {
        await suPropertyService.updateServiceUser(u.id, { status: 'Discharged' });
        await loadMasterData();
      }
    });
  };

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMasterData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const activeSiteId = siteFilter !== 'all' && siteFilter !== 'All Sites' ? siteFilter : undefined;
      const [suRes, propRes, plcRes] = await Promise.all([
        // Archived people are loaded only when the Archived filter is chosen
        suPropertyService.getServiceUsers(activeSiteId, { includeArchived: statusFilter === 'Archived' }),
        suPropertyService.getProperties(activeSiteId),
        suPropertyService.getPlacements({ siteId: activeSiteId })
      ]);

      if (!suRes.success) {
        setLoadError(suRes.error || 'Failed to authenticate or load service user records.');
      }

      const loadedSUs = suRes.success && suRes.data ? suRes.data : [];
      const loadedProps = propRes.success && propRes.data ? propRes.data : [];
      const loadedPlcs = plcRes.success && plcRes.data ? plcRes.data : [];

      const accessibleProps = canAccessAllSites()
        ? loadedProps
        : loadedProps.filter(p => {
            const siteObj = sites.find(s => s.id === p.siteId || s.name === p.siteId);
            return isSitePermitted(siteObj?.name || p.propertyName || p.siteId, 'all');
          });

      setServiceUsers(loadedSUs);
      setProperties(accessibleProps);
      setPlacements(loadedPlcs);

      if (loadedProps.length > 0) {
        const roomPromises = loadedProps.map(p => suPropertyService.getRooms(p.id));
        const roomRes = await Promise.all(roomPromises);
        setRooms(roomRes.flatMap(r => (r.success && r.data ? r.data : [])));
      } else {
        setRooms([]);
      }
    } catch (err: any) {
      console.error('Failed to load Service Users master data:', err);
      setLoadError(err?.message || 'Network error connecting to master database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSiteFilter(initialSiteFilter);
  }, [initialSiteFilter]);

  useEffect(() => {
    loadMasterData();
  }, [siteFilter, statusFilter === 'Archived']);

  useEffect(() => {
    const handleUpdate = () => { loadMasterData(); };
    window.addEventListener('sdtracker:masterDataUpdated', handleUpdate);
    return () => window.removeEventListener('sdtracker:masterDataUpdated', handleUpdate);
  }, [siteFilter]);

  const propMap = useMemo(() => new Map(properties.map(p => [p.id, p])), [properties]);
  const roomMap = useMemo(() => new Map(rooms.map(r => [r.id, r])), [rooms]);
  const activePlacementMap = useMemo(() => activePlacementBySu(placements), [placements]);

  // Strict Site Isolation - users only see records from permitted sites
  const accessibleUsers = useMemo(() => {
    return serviceUsers.filter(u => {
      const plc = activePlacementMap.get(u.id);
      const siteId = plc?.siteId || u.siteId;
      const siteObj = sites.find(s => s.id === siteId || s.name === siteId);
      const siteName = siteObj?.name || siteId || '';
      return isSitePermitted(siteName, 'all');
    });
  }, [serviceUsers, activePlacementMap, sites, isSitePermitted]);

  const totalCount = accessibleUsers.length;
  const activeCount = accessibleUsers.filter(u => u.status === 'Active').length;
  const placedCount = accessibleUsers.filter(u => activePlacementMap.has(u.id)).length;
  const unplacedCount = totalCount - placedCount;
  const vulnerableCount = accessibleUsers.filter(u => u.vulnerable === 'Yes').length;
  const peepCount = accessibleUsers.filter(u => u.personalEvacuationPlan?.startsWith('PEEP')).length;

  const filteredUsers = useMemo(() => {
    return accessibleUsers.filter(u => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = `${u.firstName} ${u.lastName}`.toLowerCase().includes(q);
        const matchesRef = u.suReference.toLowerCase().includes(q);
        const matchesExt = u.externalReference?.toLowerCase().includes(q);
        const matchesGp = u.gpRegistration?.toLowerCase().includes(q);
        const matchesDisCat = u.disabilityCategory?.toLowerCase().includes(q);
        const matchesDisType = u.disabilityType?.toLowerCase().includes(q);
        if (!matchesName && !matchesRef && !matchesExt && !matchesGp && !matchesDisCat && !matchesDisType) return false;
      }
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      const isPlaced = activePlacementMap.has(u.id);
      if (placementFilter === 'placed' && !isPlaced) return false;
      if (placementFilter === 'unplaced' && isPlaced) return false;
      return true;
    });
  }, [
    accessibleUsers,
    searchTerm,
    statusFilter,
    placementFilter,
    activePlacementMap
  ]);

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
          initialTab={profileInitialTab}
          serviceUser={selectedSUForProfile}
          onBack={() => setSelectedSUForProfile(null)}
          onEditSU={(su) => {
            setSelectedSUForEdit(su);
            setIsCreateModalOpen(true);
          }}
          onRefreshData={async () => {
            await loadMasterData();
            // The open profile keeps its own copy of the record: refresh it so a new archive status shows at once
            const fresh = await suPropertyService.getServiceUser(selectedSUForProfile.id);
            if (fresh.success && fresh.data) setSelectedSUForProfile(fresh.data);
          }}
          onOpenServiceUser={async (suId) => {
            const next = await suPropertyService.getServiceUser(suId);
            if (next.success && next.data) { setProfileInitialTab(undefined); setSelectedSUForProfile(next.data); }
          }}
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
      <ArchiveRequestsQueue
        nameOf={id => { const u = serviceUsers.find(x => x.id === id); return u ? `${u.firstName} ${u.lastName}` : 'Service User'; }}
        onChanged={loadMasterData}
      />
      {loadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={loadMasterData}
            className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded font-medium text-xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
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

            {/* Disability Options Manager for All Users */}
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setShowDisabilityMenu(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
                title="Manage options for Disability Categories and Disability Types"
              >
                <Settings2 className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>Disability Options</span>
                <ChevronDown className="w-3 h-3 text-neutral-500" />
              </button>
              {showDisabilityMenu && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-[#e5e5e5] rounded-xs shadow-lg z-50 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => { setDisabilityOptionCategory('disabilityCategories'); setShowDisabilityMenu(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-center justify-between font-medium text-neutral-700 cursor-pointer"
                  >
                    <span>Disability Categories</span>
                    <span className="text-[10px] bg-teal-50 text-teal-700 font-semibold px-1.5 py-0.5 rounded border border-teal-200">Manage</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDisabilityOptionCategory('disabilityTypes'); setShowDisabilityMenu(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-center justify-between font-medium text-neutral-700 cursor-pointer"
                  >
                    <span>Disability Types</span>
                    <span className="text-[10px] bg-teal-50 text-teal-700 font-semibold px-1.5 py-0.5 rounded border border-teal-200">Manage</span>
                  </button>
                </div>
              )}
            </div>

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
              placeholder="Search by name, SU ID, Port Ref, GP, disability..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            />
          </div>

          <div>
            {!isLockedToSingleSite ? (
              <select
                value={siteFilter}
                onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all cursor-pointer"
              >
                {(canAccessAllSites() || (allowedSites && allowedSites.length > 1)) && (
                  <option value="all">
                    {canAccessAllSites() ? `All Sites (${sites.length})` : `All Assigned Sites (${allowedSites.length})`}
                  </option>
                )}
                {sites
                  .filter(s => canAccessAllSites() || isSitePermitted(s.name, 'all') || isSitePermitted(s.id, 'all'))
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-100 border border-[#e5e5e5] rounded-xs text-xs" title="Locked to your assigned site">
                <Lock className="w-3 h-3 text-[#0f766e]" />
                <span className="font-semibold text-neutral-600">Site:</span>
                <span className="font-bold text-[#0f766e] truncate">{assignedSite || 'Assigned Site'}</span>
              </div>
            )}
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
              <option value="Archived">Archived</option>
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

      {/* KPI Stats Row matching SDTracker inspection readiness */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Total Service Users</span>
          <p className="text-xl font-bold text-[#242424] mt-0.5">{totalCount}</p>
          <span className="text-[11px] text-[#0f766e] font-semibold mt-0.5 block">{activeCount} currently active</span>
        </div>
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Accommodation Status</span>
          <p className="text-xl font-bold text-[#0d9488] mt-0.5">{placedCount}</p>
          <span className="text-[11px] text-neutral-500 mt-0.5 block">{unplacedCount} awaiting room placement</span>
        </div>
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block flex items-center justify-between">
            <span>Vulnerable Residents</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          </span>
          <p className="text-xl font-bold text-amber-700 mt-0.5">{vulnerableCount}</p>
          <span className="text-[11px] text-amber-800 font-medium mt-0.5 block">Safeguarding flagged</span>
        </div>
        <div className="bg-white border border-[#e5e5e5] rounded-xs p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block flex items-center justify-between">
            <span>Emergency Evac (PEEP)</span>
            <Flame className="w-3.5 h-3.5 text-rose-600" />
          </span>
          <p className="text-xl font-bold text-rose-700 mt-0.5">{peepCount}</p>
          <span className="text-[11px] text-rose-800 font-medium mt-0.5 block">Assisted fire evacuation plans</span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs min-h-[520px] lg:min-h-[calc(100vh-270px)] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold select-none">
                <th className="py-2.5 px-3 w-12">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={paginatedUsers.length > 0 && selectedIds.length === paginatedUsers.length}
                      onChange={handleToggleSelectAll}
                      className="rounded-xs text-[#0d9488] focus:ring-[#0d9488] cursor-pointer"
                    />
                  </div>
                </th>
                <th className="py-2.5 px-3">SU ID</th>
                <th className="py-2.5 px-3">Service User Name</th>
                <th className="py-2.5 px-3">Date of Birth</th>
                <th className="py-2.5 px-3">Site / Hotel</th>
                <th className="py-2.5 px-3">Property</th>
                <th className="py-2.5 px-3">Room</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Placement</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Safeguarding &amp; Evacuation</th>
                <th className="py-2.5 px-3 whitespace-nowrap">GP Registration</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Disability</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Incident Reports</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">SG Referrals</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Welfare Checks</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">GP Appointments</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Public Transport</th>
                <th className="py-2.5 px-3 text-right w-36 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10 select-none">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {loading && paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 text-[#0d9488] animate-spin" />
                    <p className="font-medium text-xs">Loading Service User records...</p>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-12 text-center text-neutral-400">
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
                  const counts = countServiceUserRecords(getServiceUserRecords(u, {
                    irRecords, challengingSUs, referrals, welfareChecks, rfaWelfareRecords, mhComplaintWelfareRecords,
                    gpAppointmentRecords, publicTransportRecords
                  }));

                  return (
                    <React.Fragment key={u.id}>
                    <tr
                      onClick={() => { setProfileInitialTab(undefined); setSelectedSUForProfile(u); }}
                      className={`group hover:bg-[#fbfbfa] transition-colors cursor-pointer ${selectedIds.includes(u.id) ? 'bg-[#f0fdfa]' : ''}`}
                    >
                      <td className="py-2.5 px-3 w-12" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={e => toggleExpand(e, u.id)}
                            className="p-0.5 text-neutral-400 hover:text-[#0d9488] rounded hover:bg-neutral-100 transition-colors"
                            title={expandedSuIds.has(u.id) ? 'Collapse inspection details' : 'Expand inspection details'}
                          >
                            {expandedSuIds.has(u.id) ? (
                              <ChevronDown className="w-3.5 h-3.5 text-[#0d9488]" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(u.id)}
                            onChange={e => handleToggleSelect(e, u.id)}
                            className="rounded-xs text-[#0d9488] focus:ring-[#0d9488] cursor-pointer"
                          />
                        </div>
                      </td>
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

                      {/* Safeguarding & Evacuation */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            u.vulnerable === 'Yes' 
                              ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                          }`}>
                            {u.vulnerable === 'Yes' && <ShieldAlert className="w-3 h-3 text-amber-700" />}
                            <span>{u.vulnerable === 'Yes' ? 'Vulnerable' : 'Standard'}</span>
                          </span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            u.personalEvacuationPlan?.startsWith('PEEP') 
                              ? 'bg-rose-100 text-rose-900 border border-rose-300 font-bold' 
                              : 'bg-teal-50 text-teal-800 border border-teal-200'
                          }`}>
                            {u.personalEvacuationPlan?.startsWith('PEEP') && <Flame className="w-3 h-3 text-rose-700" />}
                            <span>{u.personalEvacuationPlan?.startsWith('PEEP') ? 'PEEP' : 'GEEP'}</span>
                          </span>
                        </div>
                      </td>

                      {/* GP Registration */}
                      <td className="py-2.5 px-3">
                        {u.gpRegistration ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-neutral-800 font-medium truncate max-w-[130px]" title={u.gpRegistration}>
                            <Stethoscope className="w-3 h-3 text-teal-600 shrink-0" />
                            <span className="truncate">{u.gpRegistration}</span>
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic text-[11px]">Unregistered</span>
                        )}
                      </td>

                      {/* Disability */}
                      <td className="py-2.5 px-3">
                        {u.disabilityCategory && u.disabilityCategory !== 'None' ? (
                          <div className="max-w-[140px] space-y-0.5">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border truncate max-w-full ${getDisabilityCategoryColor(u.disabilityCategory)}`} title={`${u.disabilityCategory}${u.disabilityType ? `: ${u.disabilityType}` : ''}`}>
                              {u.disabilityCategory}
                            </span>
                            {u.disabilityType && (
                              <span className="text-[10px] text-neutral-600 block truncate font-medium" title={u.disabilityType}>
                                {u.disabilityType}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-[11px]">None</span>
                        )}
                      </td>

                      {([['incidents', counts.incidents], ['referrals', counts.referrals], ['welfare', counts.welfare], ['gp', counts.gp], ['transport', counts.transport]] as [string, number][]).map(([tab, n]) => (
                        <td key={tab} className="py-2.5 px-3 text-center" onClick={e => { e.stopPropagation(); setProfileInitialTab(tab); setSelectedSUForProfile(u); }}>
                          <span className={`inline-block min-w-6 px-1.5 py-0.5 rounded text-[11px] font-semibold border cursor-pointer ${n > 0 ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100' : 'bg-neutral-50 text-neutral-400 border-neutral-200'}`}>{n}</span>
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-right sticky right-0 bg-white group-hover:bg-[#fbfbfa] shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10 select-none">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => { setProfileInitialTab(undefined); setSelectedSUForProfile(u); }}
                            className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                            title="View SU Profile & Details"
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
                              title="Move / Allocate Accommodation"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canCRUD && u.status === 'Active' && (
                            <button
                              type="button"
                              onClick={() => handleQuickDischarge(u)}
                              className="p-1 text-neutral-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                              title="Discharge Resident & Release Room"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canCRUD && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSingle(u)}
                              className="p-1 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Delete Service User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Inspection Dossier Row */}
                    {expandedSuIds.has(u.id) && (
                      <tr className="bg-[#fbfbfa] border-b border-[#e5e5e5]">
                        <td colSpan={18} className="p-3.5 pl-12">
                          <div className="bg-white border border-[#e5e5e5] rounded-xs p-3.5 space-y-3 shadow-2xs">
                            <div className="flex items-center justify-between pb-2 border-b border-[#f0f0f0]">
                              <div className="flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-[#0d9488]" />
                                <span className="font-bold text-xs text-[#242424]">
                                  Inspection &amp; Safeguarding Profile — {u.firstName} {u.lastName} ({u.suReference})
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                                <span>HO / Port Ref: <strong className="text-neutral-700 font-mono">{u.externalReference || '—'}</strong></span>
                                <span>Case Ref: <strong className="text-neutral-700 font-mono">{u.caseReference || '—'}</strong></span>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                              <div className="p-2.5 bg-[#fcfbf9] rounded-xs border border-[#eee]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Vulnerable Status</span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  u.vulnerable === 'Yes' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-neutral-100 text-neutral-700'
                                }`}>
                                  {u.vulnerable === 'Yes' ? 'Yes – Active Safeguarding' : 'No – Standard Resident'}
                                </span>
                              </div>
                              <div className="p-2.5 bg-[#fcfbf9] rounded-xs border border-[#eee]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Personal Evacuation Plan</span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  u.personalEvacuationPlan?.startsWith('PEEP') ? 'bg-rose-100 text-rose-900 border border-rose-300 font-bold' : 'bg-teal-50 text-teal-800 border border-teal-200'
                                }`}>
                                  {u.personalEvacuationPlan || 'GEEP – General Emergency Evacuation Plan'}
                                </span>
                              </div>
                              <div className="p-2.5 bg-[#fcfbf9] rounded-xs border border-[#eee]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Registered GP Practice</span>
                                <strong className="text-neutral-800 block text-xs truncate" title={u.gpRegistration || 'Unregistered'}>
                                  {u.gpRegistration || 'Not registered'}
                                </strong>
                              </div>
                              <div className="p-2.5 bg-[#fcfbf9] rounded-xs border border-[#eee]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Disability Category</span>
                                <strong className="text-neutral-800 block text-xs">{u.disabilityCategory || 'None'}</strong>
                              </div>
                              <div className="p-2.5 bg-[#fcfbf9] rounded-xs border border-[#eee]">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Disability Specifics</span>
                                <span className="text-neutral-700 block text-xs">{u.disabilityType || '—'}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
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

      {/* Floating Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedIds.length}
        totalCount={filteredUsers.length}
        onClearSelection={() => setSelectedIds([])}
        onSelectAll={() => setSelectedIds(filteredUsers.map(u => u.id))}
        customActions={
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
              onClick={() => handleBulkStatusChange('Discharged')}
              className="px-2.5 py-1 text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded cursor-pointer transition-colors"
            >
              Discharge &amp; Release Rooms
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="px-2.5 py-1 text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white rounded flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedIds.length})</span>
            </button>
          </div>
        }
      />

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

      {disabilityOptionCategory && (
        <QuickOptionModal
          isOpen={Boolean(disabilityOptionCategory)}
          onClose={() => setDisabilityOptionCategory(null)}
          categoryKey={disabilityOptionCategory}
          categoryName={disabilityOptionCategory === 'disabilityCategories' ? 'Disability Categories' : 'Disability Types'}
        />
      )}
    </div>
  );
};
