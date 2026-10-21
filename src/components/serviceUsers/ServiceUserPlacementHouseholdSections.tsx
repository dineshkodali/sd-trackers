import { isOutOfUse } from '../../utils/roomManagementLogic';
import React from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { PropertyMaster, PropertyRoom } from '../../types/masterData';

export interface HouseholdSectionProps {
  householdMembers: Array<{ name: string; dateOfBirth?: string; relationship: string; gender?: string; contact?: string }>;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: string, val: string) => void;
}

export const HouseholdSection: React.FC<HouseholdSectionProps> = ({
  householdMembers, onAdd, onRemove, onUpdate
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Family &amp; Household Members</h4>
        <p className="text-[11px] text-neutral-500">Record all dependents arriving with this Service User</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0fdfa] text-[#0d9488] border border-[#ccfbf1] rounded-xs hover:bg-[#ccfbf1]/40 transition-colors font-semibold cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Member</span>
      </button>
    </div>

    {householdMembers.length === 0 ? (
      <div className="p-6 text-center bg-[#faf9f8] rounded-xs border border-dashed border-[#e5e5e5] text-neutral-500">
        <Users className="w-6 h-6 mx-auto mb-1 text-neutral-400" />
        <p className="font-medium text-xs">No household members added</p>
        <p className="text-[11px] text-neutral-400 mt-0.5">Click "Add Member" if this individual arrives with family members.</p>
      </div>
    ) : (
      <div className="space-y-3">
        {householdMembers.map((m, idx) => (
          <div key={idx} className="p-3 bg-[#faf9f8] rounded-xs border border-[#e5e5e5] space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-700">Member #{idx + 1}</span>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-600 mb-0.5">Full Name</label>
                <input
                  type="text"
                  value={m.name}
                  onChange={e => onUpdate(idx, 'name', e.target.value)}
                  required
                  placeholder="Name"
                  className="w-full px-2 py-1 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-600 mb-0.5">Relationship</label>
                <select
                  value={m.relationship}
                  onChange={e => onUpdate(idx, 'relationship', e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
                >
                  <option value="Spouse / Partner">Spouse / Partner</option>
                  <option value="Child / Dependent">Child / Dependent</option>
                  <option value="Parent">Parent</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-600 mb-0.5">Date of Birth</label>
                <input
                  type="date"
                  value={m.dateOfBirth || ''}
                  onChange={e => onUpdate(idx, 'dateOfBirth', e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-600 mb-0.5">Gender</label>
                <select
                  value={m.gender || 'Female'}
                  onChange={e => onUpdate(idx, 'gender', e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export interface AccommodationSectionProps {
  siteId: string;
  setSiteId: (val: string) => void;
  sites: Array<{ id: string; name: string }>;
  propertyId: string;
  setPropertyId: (val: string) => void;
  properties: PropertyMaster[];
  roomId: string;
  setRoomId: (val: string) => void;
  rooms: PropertyRoom[];
  /** Active residents per room id, so every room can show how full it is. */
  roomOccupancy?: Record<string, number>;
  /** The room the resident is in right now (it stays selectable even when full). */
  originalRoomId?: string;
  /** Existing resident: the room currently held, shown so a change is deliberate. */
  isEditing?: boolean;
}

/**
 * Where the resident lives. Whatever room is chosen here is the resident's room everywhere (list, profile,
 * Rooms, Daily Register). Leaving the room empty changes nothing.
 */
export const AccommodationSection: React.FC<AccommodationSectionProps> = ({
  siteId, setSiteId, sites, propertyId, setPropertyId, properties, roomId, setRoomId, rooms,
  roomOccupancy = {}, originalRoomId = '', isEditing = false
}) => (
  <div className="space-y-4">
    <div className="space-y-3.5 p-4 bg-[#faf9f8] rounded-xs border border-[#e5e5e5]">
      <div>
        <label className="block text-neutral-600 font-medium mb-1">Site</label>
        <select
          value={siteId}
          onChange={e => setSiteId(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
        >
          <option value="">-- Select Site --</option>
          {sites.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-neutral-600 font-medium mb-1">Property</label>
          <select
            value={propertyId}
            onChange={e => setPropertyId(e.target.value)}
            disabled={properties.length === 0}
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] disabled:bg-neutral-100"
          >
            <option value="">-- Select Property --</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>
                {p.propertyReference} - {p.propertyName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-neutral-600 font-medium mb-1">Room</label>
          <select
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
            disabled={rooms.length === 0}
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] disabled:bg-neutral-100"
          >
            <option value="">{isEditing && originalRoomId ? '-- Keep current room --' : '-- No room yet --'}</option>
            {rooms.map(r => {
              const cap = Math.max(1, Number(r.capacity) || 1);
              const occ = roomOccupancy[r.id] || 0;
              const others = occ - (r.id === originalRoomId ? 1 : 0);
              const outOfUse = isOutOfUse(r.status);
              const state = outOfUse
                ? `Unavailable (${r.status})`
                : occ === 0 ? `Empty 0/${cap}`
                : occ >= cap ? `Full ${occ}/${cap}`
                : `${occ}/${cap} occupied`;
              const blocked = (outOfUse || others >= cap) && r.id !== roomId;
              return (
                <option key={r.id} value={r.id} disabled={blocked}>
                  Room {r.roomNumber} ({r.roomType}) - {state}
                </option>
              );
            })}
          </select>
        </div>
      </div>
    </div>
  </div>
);
