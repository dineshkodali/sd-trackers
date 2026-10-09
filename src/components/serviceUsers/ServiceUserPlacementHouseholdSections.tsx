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
  includeAccommodation: boolean;
  setIncludeAccommodation: (val: boolean) => void;
  siteId: string;
  setSiteId: (val: string) => void;
  sites: Array<{ id: string; name: string }>;
  propertyId: string;
  setPropertyId: (val: string) => void;
  properties: PropertyMaster[];
  roomId: string;
  setRoomId: (val: string) => void;
  rooms: PropertyRoom[];
  placementStartDate: string;
  setPlacementStartDate: (val: string) => void;
  placementType: string;
  setPlacementType: (val: string) => void;
  accommodationNotes: string;
  setAccommodationNotes: (val: string) => void;
}

export const AccommodationSection: React.FC<AccommodationSectionProps> = ({
  includeAccommodation, setIncludeAccommodation, siteId, setSiteId, sites,
  propertyId, setPropertyId, properties, roomId, setRoomId, rooms,
  placementStartDate, setPlacementStartDate, placementType, setPlacementType,
  accommodationNotes, setAccommodationNotes
}) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 p-3 bg-[#f0fdfa] border border-[#ccfbf1] rounded-xs">
      <input
        type="checkbox"
        id="chk-placement"
        checked={includeAccommodation}
        onChange={e => setIncludeAccommodation(e.target.checked)}
        className="rounded-xs text-[#0d9488] focus:ring-0 cursor-pointer"
      />
      <label htmlFor="chk-placement" className="text-xs font-semibold text-neutral-800 select-none cursor-pointer">
        Assign Initial Accommodation Placement Now
      </label>
    </div>

    {includeAccommodation && (
      <div className="space-y-3.5 p-4 bg-[#faf9f8] rounded-xs border border-[#e5e5e5]">
        <div>
          <label className="block text-neutral-600 font-medium mb-1">
            Target Site <span className="text-red-500">*</span>
          </label>
          <select
            value={siteId}
            onChange={e => setSiteId(e.target.value)}
            required
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
            <label className="block text-neutral-600 font-medium mb-1">
              Property <span className="text-red-500">*</span>
            </label>
            <select
              value={propertyId}
              onChange={e => setPropertyId(e.target.value)}
              required
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
            <label className="block text-neutral-600 font-medium mb-1">
              Room <span className="text-red-500">*</span>
            </label>
            <select
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              required
              disabled={rooms.length === 0}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] disabled:bg-neutral-100"
            >
              <option value="">-- Select Room --</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.roomReference} - Room {r.roomNumber} ({r.roomType})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Placement Start Date</label>
            <input
              type="date"
              value={placementStartDate}
              onChange={e => setPlacementStartDate(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>
          <div>
            <label className="block text-neutral-600 font-medium mb-1">Placement Type</label>
            <select
              value={placementType}
              onChange={e => setPlacementType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            >
              <option value="Standard">Standard</option>
              <option value="Emergency">Emergency</option>
              <option value="Temporary">Temporary</option>
              <option value="Respite">Respite</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-neutral-600 font-medium mb-1">Placement Notes</label>
          <textarea
            value={accommodationNotes}
            onChange={e => setAccommodationNotes(e.target.value)}
            rows={2}
            placeholder="Special requirements, accessibility, room keys issued..."
            className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
          />
        </div>
      </div>
    )}
  </div>
);
