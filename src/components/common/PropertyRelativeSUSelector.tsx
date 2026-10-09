import React, { useState, useEffect, useMemo } from 'react';
import { User, AlertCircle, Building2, Check, ChevronDown, DoorOpen } from 'lucide-react';
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
  const [serviceUsers, setServiceUsers] = useState<ServiceUserMaster[]>([]);
  const [properties, setProperties] = useState<PropertyMaster[]>([]);
  const [rooms, setRooms] = useState<PropertyRoom[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');

  // Fetch all master data
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
        console.error('Failed to load SU master data for property selector:', err);
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

  // Resolve matching property strictly
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

  // Strictly filter SUs who have an active placement at this property
  const relativeSUs = useMemo(() => {
    if (!resolvedProperty) return [];
    
    // Placements strictly matching this property
    const propPlacements = placements.filter(
      p => p.propertyId === resolvedProperty.id && p.status === 'Active'
    );
    const validSuIds = new Set(propPlacements.map(p => p.suId));

    return serviceUsers.filter(su => validSuIds.has(su.id));
  }, [resolvedProperty, placements, serviceUsers]);

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

    const su = serviceUsers.find(u => u.id === suId);
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

  // If no property/site is selected yet:
  if (!siteOrPropertyName || siteOrPropertyName === 'all' || siteOrPropertyName === 'All Sites') {
    return (
      <div className="p-2.5 bg-amber-50/90 border border-amber-200 text-amber-900 rounded-xs text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
        <div>
          <span className="font-semibold block">Property / Site Selection Required</span>
          <span className="text-[11px] text-amber-700">
            Please choose the Hotel / Property / Site above first. Service Users will strictly load relative to that property.
          </span>
        </div>
      </div>
    );
  }

  // Multi-select view for suNames
  if (isMulti) {
    return (
      <div className="space-y-2 border border-[#8a8886] rounded-xs p-2.5 bg-white">
        <div className="flex items-center justify-between text-[11px] text-neutral-600 pb-1 border-b border-neutral-100">
          <span className="font-medium">
            Assigned to {resolvedProperty?.propertyName || siteOrPropertyName}:
          </span>
          <span className="text-teal-700 font-semibold">{relativeSUs.length} residents placed</span>
        </div>

        {relativeSUs.length === 0 ? (
          <div className="py-2 text-center text-neutral-400 text-xs">
            No active Service Users placed at {resolvedProperty?.propertyName || siteOrPropertyName}.
          </div>
        ) : (
          <div className="max-h-36 overflow-y-auto space-y-1">
            {relativeSUs.map(su => {
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
            className="text-teal-700 hover:underline cursor-pointer"
          >
            Manual entry...
          </button>
        </div>
      </div>
    );
  }

  // Single select dropdown
  const matchedSU = relativeSUs.find(u => `${u.firstName} ${u.lastName}`.trim() === value.trim());

  return (
    <div className="space-y-1">
      <select
        value={matchedSU?.id || ''}
        disabled={disabled || loading}
        onChange={e => handleSelectOne(e.target.value)}
        className={`w-full p-2 border rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs ${
          hasError ? 'border-red-500 bg-red-50/20' : 'border-[#8a8886]'
        }`}
      >
        <option value="">
          {loading
            ? 'Loading residents...'
            : relativeSUs.length === 0
            ? `-- No Active Service Users at ${resolvedProperty?.propertyName || siteOrPropertyName} --`
            : placeholder}
        </option>
        {relativeSUs.map(su => {
          const plc = placements.find(p => p.suId === su.id && p.status === 'Active');
          const rm = plc ? rooms.find(r => r.id === plc.roomId) : null;
          const roomLabel = rm ? `[Room ${rm.roomNumber}]` : '[No Room]';
          return (
            <option key={su.id} value={su.id}>
              {su.firstName} {su.lastName} {su.externalReference ? `(${su.externalReference})` : `(${su.suReference})`} {roomLabel}
            </option>
          );
        })}
        <option value="__CUSTOM__">➕ Enter unlisted / manual resident name...</option>
      </select>

      {value && !matchedSU && (
        <div className="text-[11px] text-neutral-500 flex items-center justify-between">
          <span>Current saved value: <strong>{value}</strong></span>
          <button
            type="button"
            onClick={() => setIsCustomMode(true)}
            className="text-teal-700 hover:underline cursor-pointer"
          >
            Edit text
          </button>
        </div>
      )}
    </div>
  );
};
