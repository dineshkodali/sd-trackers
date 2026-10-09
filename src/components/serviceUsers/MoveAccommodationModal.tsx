import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Building2, Home, DoorOpen, Calendar, HelpCircle, AlertTriangle } from 'lucide-react';
import { suPropertyService } from '../../services/suPropertyService';
import { useApp } from '../../context/AppContext';
import { ServiceUserMaster, PropertyMaster, PropertyRoom, Placement } from '../../types/masterData';

interface MoveAccommodationModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceUser: ServiceUserMaster;
  currentPlacement: Placement | null;
  currentProperty: PropertyMaster | null;
  currentRoom: PropertyRoom | null;
  onSuccess: () => void;
}

export const MoveAccommodationModal: React.FC<MoveAccommodationModalProps> = ({
  isOpen,
  onClose,
  serviceUser,
  currentPlacement,
  currentProperty,
  currentRoom,
  onSuccess
}) => {
  const { sites } = useApp();

  const [targetSiteId, setTargetSiteId] = useState<string>(serviceUser.siteId || '');
  const [properties, setProperties] = useState<PropertyMaster[]>([]);
  const [targetPropertyId, setTargetPropertyId] = useState<string>('');
  const [rooms, setRooms] = useState<PropertyRoom[]>([]);
  const [targetRoomId, setTargetRoomId] = useState<string>('');
  const [moveDate, setMoveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('Internal Transfer');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setTargetSiteId(serviceUser.siteId || (sites[0]?.id || ''));
      setMoveDate(new Date().toISOString().split('T')[0]);
      setReason('Internal Room Transfer');
      setNotes('');
      setErrorMsg('');
    }
  }, [isOpen, serviceUser, sites]);

  // Load properties when target site changes
  useEffect(() => {
    async function loadProps() {
      if (!targetSiteId) return;
      const res = await suPropertyService.getProperties(targetSiteId);
      if (res.success && res.data) {
        setProperties(res.data);
        if (res.data.length > 0) {
          setTargetPropertyId(res.data[0].id);
        } else {
          setTargetPropertyId('');
        }
      }
    }
    loadProps();
  }, [targetSiteId]);

  // Load rooms when target property changes
  useEffect(() => {
    async function loadRooms() {
      if (!targetPropertyId) {
        setRooms([]);
        return;
      }
      const [res, plcsRes] = await Promise.all([
        suPropertyService.getRooms(targetPropertyId),
        suPropertyService.getPlacements({ propertyId: targetPropertyId, status: 'Active' })
      ]);
      if (res.success && res.data) {
        const activePlcs = plcsRes.success && plcsRes.data ? plcsRes.data : [];
        const occMap = new Map<string, number>();
        activePlcs.forEach(p => {
          if (p.suId === serviceUser.id) return;
          occMap.set(p.roomId, (occMap.get(p.roomId) || 0) + 1);
        });

        const availableRooms = res.data.filter(r => {
          if (r.id === currentRoom?.id) return true;
          if (r.status === 'Under Maintenance' || r.status === 'Blocked') return false;
          const occ = occMap.get(r.id) || 0;
          return occ < (r.capacity || 1);
        });

        setRooms(availableRooms);
        if (availableRooms.length > 0) {
          const defaultSelect = availableRooms.find(r => r.id !== currentRoom?.id) || availableRooms[0];
          setTargetRoomId(defaultSelect.id);
        } else {
          setTargetRoomId('');
        }
      }
    }
    loadRooms();
  }, [targetPropertyId, currentRoom, serviceUser.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSiteId || !targetPropertyId || !targetRoomId) {
      setErrorMsg('Please select target Site, Property, and Room.');
      return;
    }
    if (currentRoom && targetRoomId === currentRoom.id && targetPropertyId === currentProperty?.id) {
      setErrorMsg('Target room must be different from current room.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await suPropertyService.moveServiceUser(
        serviceUser.id,
        targetSiteId,
        targetPropertyId,
        targetRoomId,
        new Date(moveDate).toISOString(),
        reason
      );

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to move accommodation.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xs shadow-2xl w-full max-w-xl border border-[#e5e5e5] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e5e5e5] bg-[#faf9f8]">
          <div>
            <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-[#0d9488]" />
              <span>Move Accommodation</span>
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Transfer {serviceUser.firstName} {serviceUser.lastName} ({serviceUser.suReference}) to a new room
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xs text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xs text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current Accommodation Summary */}
          <div className="p-3 bg-[#faf9f8] rounded-xs border border-[#e5e5e5] space-y-2">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
              Current Placement
            </span>
            <div className="flex items-center justify-between text-neutral-800">
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-[#0d9488]" />
                <span className="font-semibold text-xs">{currentProperty?.propertyName || 'Unassigned Property'}</span>
              </div>
              <div className="flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-cyan-600" />
                <span className="font-semibold text-xs">{currentRoom ? `Room ${currentRoom.roomNumber}` : 'No Room'}</span>
              </div>
            </div>
            {currentPlacement?.startDate && (
              <p className="text-[11px] text-neutral-400">
                Placed on: {new Date(currentPlacement.startDate).toLocaleDateString('en-GB')}
              </p>
            )}
          </div>

          <div className="flex items-center justify-center text-[#0d9488] py-1">
            <ArrowRight className="w-5 h-5 animate-pulse" />
          </div>

          {/* New Placement Details */}
          <div className="space-y-3 p-3.5 bg-[#f0fdfa] rounded-xs border border-[#ccfbf1]">
            <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">
              Target Destination
            </span>

            <div>
              <label className="block text-neutral-600 font-medium mb-1">
                Target Site <span className="text-red-500">*</span>
              </label>
              <select
                value={targetSiteId}
                onChange={e => setTargetSiteId(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              >
                <option value="">-- Select Target Site --</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-600 font-medium mb-1">
                  Target Property <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetPropertyId}
                  onChange={e => setTargetPropertyId(e.target.value)}
                  required
                  disabled={properties.length === 0}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] disabled:bg-neutral-100"
                >
                  <option value="">-- Select Property --</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.propertyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-neutral-600 font-medium mb-1">
                  Available Room <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetRoomId}
                  onChange={e => setTargetRoomId(e.target.value)}
                  required
                  disabled={rooms.length === 0}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] disabled:bg-neutral-100"
                >
                  <option value="">{rooms.length === 0 ? '-- No Available Rooms --' : '-- Select Room --'}</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      Room {r.roomNumber} ({r.roomType}) - Cap: {r.capacity}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Move Date & Reason */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-600 font-medium mb-1">
                Move Effective Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={moveDate}
                onChange={e => setMoveDate(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              />
            </div>

            <div>
              <label className="block text-neutral-600 font-medium mb-1">
                Reason for Move <span className="text-red-500">*</span>
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              >
                <option value="Internal Room Transfer">Internal Room Transfer</option>
                <option value="Safeguarding / Risk Mitigation">Safeguarding / Risk Mitigation</option>
                <option value="Maintenance / Defect Evacuation">Maintenance / Defect Evacuation</option>
                <option value="Family Reallocation / Capacity">Family Reallocation / Capacity</option>
                <option value="Accessibility Need">Accessibility Need</option>
                <option value="Medical Requirement">Medical Requirement</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-neutral-600 font-medium mb-1">
              Transfer Notes &amp; Instructions
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Moved due to window maintenance in Room 2; keys handed over by Duty Officer."
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e5e5e5]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xs border border-[#e5e5e5] text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !targetRoomId}
              className="px-4 py-1.5 rounded-xs bg-[#0d9488] text-white hover:bg-teal-700 font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? 'Transferring Accommodation...' : 'Confirm Move'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
