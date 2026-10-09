import React, { useState, useEffect, useMemo } from 'react';
import { User, AlertCircle, Building2, Check, ChevronDown, DoorOpen, X, Edit3, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suPropertyService } from '../../services/suPropertyService';
import { ServiceUserMaster, PropertyMaster, PropertyRoom, Placement } from '../../types/masterData';

interface PropertyRelativeSUSelectorProps {
  siteOrPropertyName?: string;
  value: string;
  onChange: (
    value: string,
    extra?: {
      su?: ServiceUserMaster;
      placement?: Placement;
      property?: PropertyMaster;
      room?: PropertyRoom;
      portRef?: string;
      roomNumber?: string;
      address?: string;
    }
  ) => void;
  isMulti?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  hasError?: boolean;
}

export const PropertyRelativeSUSelector: React.FC<PropertyRelativeSUSelectorProps> = ({
  siteOrPropertyName = '',
  value,
  onChange,
  isMulti = false,
  required = false,
  disabled = false,
  placeholder = 'Select Service User...',
  hasError = false
}) => {
  const { vulnerableSUs, challengingSUs, spcdRecords, dailyRegisterRecords, newArrivalsRecords, sites } = useApp();

  const [serviceUsers, setServiceUsers] = useState<ServiceUserMaster[]>([]);
  const [properties, setProperties] = useState<PropertyMaster[]>([]);
  const [rooms, setRooms] = useState<PropertyRoom[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState(value || '');

  // Keep customInput synced with value when switching
  useEffect(() => {
    setCustomInput(value || '');
  }, [value]);

  // Fetch all master data from service
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [suRes, propRes, plcRes] = await Promise.all([
          suPropertyService.getServiceUsers(),
          suPropertyService.getProperties(),
          suPropertyService.getPlacements({ status: 'Active' })
        ]);
        if (!isMounted) return;

        const loadedSUs = suRes.success && suRes.data ? suRes.data : [];
        const loadedProps = propRes.success && propRes.data ? propRes.data : [];
        const loadedPlcs = plcRes.success && plcRes.data ? plcRes.data : [];

        setServiceUsers(loadedSUs);
        setProperties(loadedProps);
        setPlacements(loadedPlcs);

        if (loadedProps.length > 0) {
          const roomPromises = loadedProps.map(p => suPropertyService.getRooms(p.id));
          const roomResults = await Promise.all(roomPromises);
          if (isMounted) {
            setRooms(roomResults.flatMap(r => (r.success && r.data ? r.data : [])));
          }
        }
      } catch (err) {
        console.error('Failed to load SU master data for selector:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('sdtracker:masterDataUpdated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('sdtracker:masterDataUpdated', handleUpdate);
    };
  }, []);

  // Consolidate master service users with all tracker records so no resident is missing
  const allKnownServiceUsers = useMemo<ServiceUserMaster[]>(() => {
    const map = new Map<string, ServiceUserMaster>();

    // 1. Master service users
    serviceUsers.forEach(su => {
      const normName = `${su.firstName || ''} ${su.lastName || ''}`.trim().toLowerCase();
      if (normName) {
        map.set(normName, su);
      }
    });

    // 2. Synthesize from other app collections if not already present
    const addSyntheticSU = (name: string, portRef?: string, room?: string, site?: string) => {
      if (!name || typeof name !== 'string') return;
      const cleanName = name.trim();
      const normName = cleanName.toLowerCase();
      if (!normName || map.has(normName)) return;

      const parts = cleanName.split(' ');
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';

      map.set(normName, {
        id: `synth-${encodeURIComponent(normName)}`,
        suReference: portRef || `SU-${Math.floor(Math.random() * 89999 + 10000)}`,
        externalReference: portRef || '',
        firstName,
        lastName,
        status: 'Active',
        siteId: site || '',
        gender: 'Not Specified',
        preferredLanguage: 'English',
        interpreterRequired: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    };

    vulnerableSUs?.forEach(r => addSyntheticSU(r.suName, r.portOrNassRef, r.roomOrFlatNo, r.site));
    challengingSUs?.forEach(r => addSyntheticSU(r.name, r.portRef, undefined, r.site));
    spcdRecords?.forEach(r => addSyntheticSU(r.suName, r.suPortReference, r.roomNumber, r.site || r.siteName));
    dailyRegisterRecords?.forEach(r => addSyntheticSU(r.name, r.portRef, r.roomNo, r.hotel));
    newArrivalsRecords?.forEach(r => addSyntheticSU(r.name, r.portReference, r.room, r.hotel));

    return Array.from(map.values()).sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
  }, [serviceUsers, vulnerableSUs, challengingSUs, spcdRecords, dailyRegisterRecords, newArrivalsRecords]);

  // Resolve matching property
  const resolvedProperty = useMemo(() => {
    if (!siteOrPropertyName || siteOrPropertyName === 'all' || siteOrPropertyName === 'All Sites') {
      return null;
    }
    const cleanTarget = siteOrPropertyName.trim().toLowerCase();
    return properties.find(
      p =>
        p.id.toLowerCase() === cleanTarget ||
        p.propertyName.toLowerCase() === cleanTarget ||
        (p.siteId && p.siteId.toLowerCase() === cleanTarget) ||
        cleanTarget.includes(p.propertyName.toLowerCase()) ||
        p.propertyName.toLowerCase().includes(cleanTarget) ||
        (p.addressLine1 && (cleanTarget.includes(p.addressLine1.toLowerCase()) || p.addressLine1.toLowerCase().includes(cleanTarget))) ||
        (p.postcode && cleanTarget.includes(p.postcode.toLowerCase()))
    ) || null;
  }, [siteOrPropertyName, properties]);

  // Split SUs into relative (placed at current site) and other SUs
  const { relativeSUs, otherSUs } = useMemo(() => {
    if (!siteOrPropertyName || siteOrPropertyName === 'all' || siteOrPropertyName === 'All Sites') {
      return { relativeSUs: allKnownServiceUsers, otherSUs: [] };
    }

    const cleanSiteName = siteOrPropertyName.trim().toLowerCase();
    const propId = resolvedProperty?.id;

    // Placements matching this property or site
    const matchedPlacements = placements.filter(
      p => (propId && p.propertyId === propId) || (p.siteId && p.siteId.toLowerCase() === cleanSiteName)
    );
    const placedSuIds = new Set(matchedPlacements.map(p => p.suId));

    const rel: ServiceUserMaster[] = [];
    const oth: ServiceUserMaster[] = [];

    allKnownServiceUsers.forEach(su => {
      const isPlaced = placedSuIds.has(su.id);
      const isSiteMatched = su.siteId && (
        su.siteId.toLowerCase() === cleanSiteName ||
        (resolvedProperty && su.siteId === resolvedProperty.id)
      );

      if (isPlaced || isSiteMatched) {
        rel.push(su);
      } else {
        oth.push(su);
      }
    });

    return { relativeSUs: rel, otherSUs: oth };
  }, [siteOrPropertyName, resolvedProperty, placements, allKnownServiceUsers]);

  // Handle single selection
  const handleSelectOne = (suId: string) => {
    if (suId === '__CUSTOM__') {
      setIsCustomMode(true);
      return;
    }
    if (!suId) {
      onChange('');
      return;
    }

    const su = allKnownServiceUsers.find(u => u.id === suId);
    if (!su) return;

    const plc = placements.find(p => p.suId === su.id && p.status === 'Active');
    const rm = plc ? rooms.find(r => r.id === plc.roomId) : null;
    const fullName = `${su.firstName} ${su.lastName}`.trim();
    const address = resolvedProperty
      ? [resolvedProperty.addressLine1, resolvedProperty.city, resolvedProperty.postcode].filter(Boolean).join(', ')
      : '';

    onChange(fullName, {
      su,
      placement: plc,
      property: resolvedProperty || undefined,
      room: rm || undefined,
      portRef: su.externalReference || su.suReference,
      roomNumber: rm?.roomNumber || '',
      address
    });
  };

  // Handle multi selection (for suNames)
  const selectedNames = useMemo(() => {
    if (!value) return [];
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  const toggleMultiSU = (su: ServiceUserMaster) => {
    const fullName = `${su.firstName} ${su.lastName}`.trim();
    let newNames: string[];
    if (selectedNames.includes(fullName)) {
      newNames = selectedNames.filter(n => n !== fullName);
    } else {
      newNames = [...selectedNames, fullName];
    }
    const plc = placements.find(p => p.suId === su.id && p.status === 'Active');
    const rm = plc ? rooms.find(r => r.id === plc.roomId) : null;
    const address = resolvedProperty
      ? [resolvedProperty.addressLine1, resolvedProperty.city, resolvedProperty.postcode].filter(Boolean).join(', ')
      : '';

    onChange(newNames.join(', '), {
      su,
      placement: plc,
      property: resolvedProperty || undefined,
      room: rm || undefined,
      portRef: su.externalReference || su.suReference,
      roomNumber: rm?.roomNumber || '',
      address
    });
  };

  // Custom text entry mode
  if (isCustomMode) {
    return (
      <div className="space-y-1">
        <div className="relative flex items-center">
          <input
            type="text"
            value={customInput}
            onChange={e => {
              setCustomInput(e.target.value);
              onChange(e.target.value);
            }}
            placeholder="Type resident / service user name..."
            disabled={disabled}
            className={`w-full p-2 pr-20 border rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] text-xs ${
              hasError ? 'border-red-500 bg-red-50/20' : 'border-[#8a8886]'
            }`}
          />
          <div className="absolute right-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsCustomMode(false);
              }}
              className="px-2 py-1 text-[10px] font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 rounded-xs cursor-pointer flex items-center gap-1"
              title="Return to dropdown list"
            >
              <Users className="w-3 h-3" />
              <span>List</span>
            </button>
          </div>
        </div>
        <p className="text-[10px] text-neutral-500">
          Manual resident entry mode. Click <strong>List</strong> to switch back to the dropdown selector.
        </p>
      </div>
    );
  }

  // Multi-select view for suNames
  if (isMulti) {
    const listToShow = relativeSUs.length > 0 ? relativeSUs : allKnownServiceUsers;
    return (
      <div className="space-y-2 border border-[#8a8886] rounded-xs p-2.5 bg-white">
        <div className="flex items-center justify-between text-[11px] text-neutral-600 pb-1 border-b border-neutral-100">
          <span className="font-medium">
            {siteOrPropertyName && siteOrPropertyName !== 'All Sites'
              ? `Residents at ${resolvedProperty?.propertyName || siteOrPropertyName}:`
              : 'All Active Service Users:'}
          </span>
          <span className="text-teal-700 font-semibold">{listToShow.length} available</span>
        </div>

        {listToShow.length === 0 ? (
          <div className="py-2 text-center text-neutral-400 text-xs">
            No Service Users found. Use manual entry below.
          </div>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1">
            {listToShow.map(su => {
              const fullName = `${su.firstName} ${su.lastName}`.trim();
              const isChecked = selectedNames.includes(fullName);
              const plc = placements.find(p => p.suId === su.id && p.status === 'Active');
              const rm = plc ? rooms.find(r => r.id === plc.roomId) : null;
              return (
                <label
                  key={su.id}
                  className={`flex items-center justify-between p-1.5 rounded-xs text-xs cursor-pointer transition-colors ${
                    isChecked ? 'bg-teal-50 text-teal-900 font-medium' : 'hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleMultiSU(su)}
                      className="rounded-xs text-[#0d9488] focus:ring-0"
                    />
                    <span>{fullName}</span>
                    {su.externalReference && (
                      <span className="text-[10px] font-mono text-neutral-400">({su.externalReference})</span>
                    )}
                  </div>
                  {rm && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 rounded text-neutral-600 font-mono">
                      Room {rm.roomNumber}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-[11px]">
          <span className="text-neutral-500">
            Selected: <strong className="text-neutral-800">{selectedNames.length}</strong> resident(s)
          </span>
          <button
            type="button"
            onClick={() => setIsCustomMode(true)}
            className="text-teal-700 hover:underline cursor-pointer flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            <span>Manual entry...</span>
          </button>
        </div>
      </div>
    );
  }

  // Single select dropdown
  const matchedSU = allKnownServiceUsers.find(
    u => `${u.firstName} ${u.lastName}`.trim().toLowerCase() === String(value || '').trim().toLowerCase()
  );

  return (
    <div className="space-y-1">
      <select
        value={matchedSU?.id || (value ? '__EXISTING_VAL__' : '')}
        disabled={disabled || loading}
        onChange={e => {
          if (e.target.value === '__EXISTING_VAL__') return;
          handleSelectOne(e.target.value);
        }}
        className={`w-full p-2 border rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs ${
          hasError ? 'border-red-500 bg-red-50/20' : 'border-[#8a8886]'
        }`}
      >
        <option value="">
          {loading
            ? 'Loading residents...'
            : allKnownServiceUsers.length === 0
            ? '-- No Service Users Registered --'
            : placeholder}
        </option>

        {value && !matchedSU && (
          <option value="__EXISTING_VAL__">
            {value} (Current Value)
          </option>
        )}

        {/* Relative SUs (assigned to this site) */}
        {relativeSUs.length > 0 && otherSUs.length > 0 ? (
          <>
            <optgroup label={`Assigned to ${resolvedProperty?.propertyName || siteOrPropertyName || 'Selected Site'} (${relativeSUs.length})`}>
              {relativeSUs.map(su => {
                const plc = placements.find(p => p.suId === su.id && p.status === 'Active');
                const rm = plc ? rooms.find(r => r.id === plc.roomId) : null;
                const roomLabel = rm ? ` [Room ${rm.roomNumber}]` : '';
                const ref = su.externalReference || su.suReference;
                return (
                  <option key={su.id} value={su.id}>
                    {su.firstName} {su.lastName} {ref ? `(${ref})` : ''}{roomLabel}
                  </option>
                );
              })}
            </optgroup>
            <optgroup label={`All Other Active Service Users (${otherSUs.length})`}>
              {otherSUs.map(su => {
                const ref = su.externalReference || su.suReference;
                return (
                  <option key={su.id} value={su.id}>
                    {su.firstName} {su.lastName} {ref ? `(${ref})` : ''}
                  </option>
                );
              })}
            </optgroup>
          </>
        ) : (
          allKnownServiceUsers.map(su => {
            const plc = placements.find(p => p.suId === su.id && p.status === 'Active');
            const rm = plc ? rooms.find(r => r.id === plc.roomId) : null;
            const roomLabel = rm ? ` [Room ${rm.roomNumber}]` : '';
            const ref = su.externalReference || su.suReference;
            return (
              <option key={su.id} value={su.id}>
                {su.firstName} {su.lastName} {ref ? `(${ref})` : ''}{roomLabel}
              </option>
            );
          })
        )}

        <option value="__CUSTOM__">➕ Enter unlisted / manual resident name...</option>
      </select>

      {value && !matchedSU && (
        <div className="text-[11px] text-neutral-500 flex items-center justify-between">
          <span>Current saved value: <strong>{value}</strong></span>
          <button
            type="button"
            onClick={() => setIsCustomMode(true)}
            className="text-teal-700 hover:underline cursor-pointer flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit text</span>
          </button>
        </div>
      )}
    </div>
  );
};
