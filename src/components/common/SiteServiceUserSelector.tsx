import React, { useState, useEffect, useMemo } from 'react';
import { Building2, User, Home, DoorOpen, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suPropertyService } from '../../services/suPropertyService';
import { ServiceUserMaster, PropertyMaster, PropertyRoom, Placement } from '../../types/masterData';

export interface SelectedServiceUserSummary {
  suId: string;
  suReference: string;
  name: string;
  propertyId: string;
  propertyName: string;
  roomId: string;
  roomNumber: string;
  roomName?: string;
  siteId: string;
  siteName: string;
  externalReference?: string;
}

interface SiteServiceUserSelectorProps {
  selectedSiteId?: string;
  selectedSiteName?: string;
  onSiteChange?: (siteId: string, siteName: string) => void;
  selectedPropertyId?: string;
  onPropertyChange?: (propertyId: string, propertyName: string) => void;
  selectedSuId?: string;
  onServiceUserChange?: (selected: SelectedServiceUserSummary | null) => void;
  onSelect?: (selected: SelectedServiceUserSummary) => void;
  disabled?: boolean;
  showPropertyRoomDisplay?: boolean;
  required?: boolean;
  className?: string;
}

export const SiteServiceUserSelector: React.FC<SiteServiceUserSelectorProps> = ({
  selectedSiteId,
  selectedSiteName,
  onSiteChange,
  selectedPropertyId,
  onPropertyChange,
  selectedSuId,
  onServiceUserChange,
  onSelect,
  disabled = false,
  showPropertyRoomDisplay = true,
  required = false,
  className = ''
}) => {
  const { sites, assignedSite, canAccessAllSites } = useApp();

  const [currentSiteId, setCurrentSiteId] = useState<string>(selectedSiteId || '');
  const [currentPropertyId, setCurrentPropertyId] = useState<string>(selectedPropertyId || '');
  const [loading, setLoading] = useState(false);
  const [serviceUsers, setServiceUsers] = useState<ServiceUserMaster[]>([]);
  const [properties, setProperties] = useState<PropertyMaster[]>([]);
  const [rooms, setRooms] = useState<PropertyRoom[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Initial site determination
  useEffect(() => {
    if (selectedSiteId) {
      setCurrentSiteId(selectedSiteId);
    } else if (!canAccessAllSites() && assignedSite) {
      const match = sites.find(s => s.name === assignedSite || s.id === assignedSite);
      if (match) setCurrentSiteId(match.id);
    } else if (sites.length > 0 && !currentSiteId) {
      setCurrentSiteId(sites[0].id);
      if (onSiteChange) onSiteChange(sites[0].id, sites[0].name);
    }
  }, [selectedSiteId, sites, assignedSite, canAccessAllSites]);

  // Synchronize propertyId from props
  useEffect(() => {
    if (selectedPropertyId) {
      setCurrentPropertyId(selectedPropertyId);
    }
  }, [selectedPropertyId]);

  // Load active master data for selected site
  const loadSiteMasterData = async () => {
    if (!currentSiteId || currentSiteId === 'all') return;
    setLoading(true);
    try {
      const [suRes, propRes, plcRes] = await Promise.all([
        suPropertyService.getServiceUsers(),
        suPropertyService.getProperties(currentSiteId),
        suPropertyService.getPlacements({ siteId: currentSiteId, status: 'Active' })
      ]);

      const allSUs = suRes.success && suRes.data ? suRes.data : [];
      const loadedProps = propRes.success && propRes.data ? propRes.data : [];
      const loadedPlcs = plcRes.success && plcRes.data ? plcRes.data : [];

      setServiceUsers(allSUs);
      setProperties(loadedProps);
      setPlacements(loadedPlcs);

      // Auto-select property if only 1 exists and none selected
      if (loadedProps.length === 1 && !currentPropertyId) {
        setCurrentPropertyId(loadedProps[0].id);
        onPropertyChange?.(loadedProps[0].id, loadedProps[0].propertyName);
      }

      // Fetch rooms for all properties
      if (loadedProps.length > 0) {
        const roomPromises = loadedProps.map(p => suPropertyService.getRooms(p.id));
        const roomResults = await Promise.all(roomPromises);
        const allRooms = roomResults.flatMap(r => (r.success && r.data ? r.data : []));
        setRooms(allRooms);
      } else {
        setRooms([]);
      }
    } catch (err) {
      console.error('Failed to load site master data for selector:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSiteMasterData();
    const handleUpdate = () => {
      loadSiteMasterData();
    };
    window.addEventListener('sdtracker:masterDataUpdated', handleUpdate);
    return () => {
      window.removeEventListener('sdtracker:masterDataUpdated', handleUpdate);
    };
  }, [currentSiteId]);

  // Resolved placement for selected SU
  const resolvedPlacement = useMemo(() => {
    if (!selectedSuId || placements.length === 0) return null;
    return placements.find(p => p.suId === selectedSuId && p.status === 'Active') || null;
  }, [selectedSuId, placements]);

  // Resolved Property & Room
  const resolvedProperty = useMemo(() => {
    if (resolvedPlacement) {
      return properties.find(p => p.id === resolvedPlacement.propertyId) || null;
    }
    if (currentPropertyId) {
      return properties.find(p => p.id === currentPropertyId) || null;
    }
    return null;
  }, [resolvedPlacement, currentPropertyId, properties]);

  const resolvedRoom = useMemo(() => {
    if (!resolvedPlacement) return null;
    return rooms.find(r => r.id === resolvedPlacement.roomId) || null;
  }, [resolvedPlacement, rooms]);

  const handleSiteSelect = (siteId: string) => {
    setCurrentSiteId(siteId);
    setCurrentPropertyId('');
    const siteObj = sites.find(s => s.id === siteId);
    if (onSiteChange && siteObj) {
      onSiteChange(siteId, siteObj.name);
    }
    onServiceUserChange?.(null);
  };

  const handlePropertySelect = (propId: string) => {
    setCurrentPropertyId(propId);
    const propObj = properties.find(p => p.id === propId);
    if (onPropertyChange && propObj) {
      onPropertyChange(propId, propObj.propertyName);
    }
    onServiceUserChange?.(null);
  };

  const handleServiceUserSelect = (suId: string) => {
    if (!suId) {
      onServiceUserChange?.(null);
      return;
    }
    const su = serviceUsers.find(u => u.id === suId);
    if (!su) return;

    const plc = placements.find(p => p.suId === suId && p.status === 'Active');
    const prop = plc ? properties.find(p => p.id === plc.propertyId) : (currentPropertyId ? properties.find(p => p.id === currentPropertyId) : null);
    const rm = plc ? rooms.find(r => r.id === plc.roomId) : null;
    const siteObj = sites.find(s => s.id === (su.siteId || currentSiteId));

    const selectedSummary: SelectedServiceUserSummary = {
      suId: su.id,
      suReference: su.suReference,
      name: `${su.firstName} ${su.lastName}`.trim(),
      propertyId: prop?.id || plc?.propertyId || '',
      propertyName: prop?.propertyName || (prop?.addressLine1 ? `${prop.addressLine1}, ${prop.city}` : 'Unassigned Property'),
      roomId: rm?.id || plc?.roomId || '',
      roomNumber: rm?.roomNumber || 'Unassigned Room',
      roomName: rm?.roomName || (rm?.roomNumber ? `Room ${rm.roomNumber}` : ''),
      siteId: siteObj?.id || currentSiteId,
      siteName: siteObj?.name || 'Selected Site',
      externalReference: su.externalReference
    };

    onServiceUserChange?.(selectedSummary);
    onSelect?.(selectedSummary);
  };

  // Strictly filter SUs by active placement at current property ("strictly no cross shows")
  const propertySUs = useMemo(() => {
    if (!currentPropertyId) return [];
    const validPlacements = placements.filter(p => p.propertyId === currentPropertyId && p.status === 'Active');
    const validSuIds = new Set(validPlacements.map(p => p.suId));
    return serviceUsers.filter(u => validSuIds.has(u.id));
  }, [currentPropertyId, placements, serviceUsers]);

  const filteredSUs = useMemo(() => {
    if (!searchTerm.trim()) return propertySUs;
    const q = searchTerm.toLowerCase();
    return propertySUs.filter(
      u =>
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.suReference.toLowerCase().includes(q) ||
        (u.externalReference && u.externalReference.toLowerCase().includes(q))
    );
  }, [propertySUs, searchTerm]);

  return (
    <div className={`space-y-3.5 bg-neutral-50/80 p-3.5 rounded-lg border border-neutral-200/90 text-xs ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Site Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Site / Location</span>
            {required && <span className="text-red-500">*</span>}
          </label>
          <select
            value={currentSiteId}
            onChange={e => handleSiteSelect(e.target.value)}
            disabled={disabled}
            className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-500"
          >
            <option value="">-- Select Site --</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.city ? `(${s.city})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Property / Accommodation Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Home className="w-3.5 h-3.5 text-teal-600" />
            <span>Property / Hotel</span>
            {required && <span className="text-red-500">*</span>}
          </label>
          <select
            value={currentPropertyId}
            onChange={e => handlePropertySelect(e.target.value)}
            disabled={disabled || !currentSiteId || properties.length === 0}
            className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-500"
          >
            <option value="">
              {!currentSiteId ? '-- Select Site First --' : properties.length === 0 ? '-- No Properties at Site --' : '-- Select Property --'}
            </option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>
                {p.propertyName} ({p.propertyReference})
              </option>
            ))}
          </select>
        </div>

        {/* Service User Selector (Strictly Relative to Property) */}
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-600" />
              <span>Service User</span>
              {required && <span className="text-red-500">*</span>}
            </span>
            {loading && <span className="text-[10px] text-teal-600 font-normal animate-pulse">Loading SUs...</span>}
          </label>
          <select
            value={selectedSuId || ''}
            onChange={e => handleServiceUserSelect(e.target.value)}
            disabled={disabled || loading || !currentPropertyId}
            className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-500"
          >
            <option value="">
              {!currentPropertyId
                ? '-- Select Property First --'
                : loading
                ? 'Loading residents...'
                : propertySUs.length === 0
                ? '-- No Service Users placed here --'
                : '-- Select Service User --'}
            </option>
            {filteredSUs.map(u => {
              const plc = placements.find(p => p.suId === u.id && p.status === 'Active');
              const rm = plc ? rooms.find(r => r.id === plc.roomId) : null;
              const roomDisplay = rm ? `Room ${rm.roomNumber}` : 'No Room';
              return (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} {u.externalReference ? `(${u.externalReference})` : `(${u.suReference})`} [{roomDisplay}]
                </option>
              );
            })}
          </select>
        </div>
      </div>


      {/* Auto-populated Read-Only Property & Room Display (Rule: DO NOT allow manual typing) */}
      {showPropertyRoomDisplay && selectedSuId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-neutral-200/80">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-1 flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5 text-blue-600" />
              <span>Current Property (Active Placement)</span>
            </label>
            <div className="px-2.5 py-1.5 bg-neutral-100 border border-neutral-200 rounded-md text-neutral-800 text-xs font-medium flex items-center justify-between">
              <span>{resolvedProperty ? resolvedProperty.propertyName : 'Unassigned / Outside Managed Properties'}</span>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono">RESOLVED</span>
            </div>
            {resolvedProperty && (
              <p className="text-[10px] text-neutral-500 mt-0.5 truncate">
                {[resolvedProperty.addressLine1, resolvedProperty.city, resolvedProperty.postcode].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-1 flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-cyan-600" />
              <span>Current Room (Active Placement)</span>
            </label>
            <div className="px-2.5 py-1.5 bg-neutral-100 border border-neutral-200 rounded-md text-neutral-800 text-xs font-medium flex items-center justify-between">
              <span>{resolvedRoom ? `Room ${resolvedRoom.roomNumber} (${resolvedRoom.roomType})` : 'Unassigned Room'}</span>
              <span className="text-[10px] bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded font-mono">READ-ONLY</span>
            </div>
            {resolvedPlacement?.startDate && (
              <p className="text-[10px] text-neutral-500 mt-0.5">
                Placed on {new Date(resolvedPlacement.startDate).toLocaleDateString('en-GB')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
