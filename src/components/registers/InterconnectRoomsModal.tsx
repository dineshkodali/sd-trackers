import React, { useMemo, useState } from 'react';
import { IconLink as Link2, IconUnlink as Unlink, IconX as X } from '@tabler/icons-react';
import type { DailyRegisterRecord, DailyRegisterRoom } from '../../types';
import {
  GROUP_AVAILABILITY_LABEL, MAX_GROUP_ROOMS, MIN_GROUP_ROOMS, connectableRooms, freeBeds, groupIdOf, groupRooms, groupStatus,
  planGroupDissolve, planGroupSave, type RoomChange,
} from '../../utils/interconnectingRooms';

interface Props {
  rooms: DailyRegisterRoom[];
  records: DailyRegisterRecord[];
  /** Properties the user may configure (already limited to their sites). */
  hotels: string[];
  /** Editing this room's group, or starting a new group from it when it has none. */
  room: DailyRegisterRoom | null;
  defaultHotel: string;
  onApply: (changes: RoomChange[]) => void;
  onClose: () => void;
}

/** Create, edit or remove one group of interconnecting rooms. Only the Room List opens this, and only for managers. */
export const InterconnectRoomsModal: React.FC<Props> = ({ rooms, records, hotels, room, defaultHotel, onApply, onClose }) => {
  const editingGroupId = room ? groupIdOf(room) || undefined : undefined;
  const [hotel, setHotel] = useState(room?.hotel || defaultHotel || hotels[0] || '');
  const [selected, setSelected] = useState<string[]>(() => {
    if (!room) return [];
    return editingGroupId ? groupRooms(rooms, room).map(r => r.id) : [room.id];
  });
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return connectableRooms(rooms, hotel, editingGroupId).filter(r => !q || r.roomNo.toLowerCase().includes(q) || (r.floor || '').toLowerCase().includes(q));
  }, [rooms, hotel, editingGroupId, query]);

  const toggle = (id: string) => {
    setError(null);
    setSelected(cur => (cur.includes(id) ? cur.filter(x => x !== id) : cur.length >= MAX_GROUP_ROOMS ? cur : [...cur, id]));
  };

  const plan = useMemo(() => planGroupSave(rooms, selected, editingGroupId), [rooms, selected, editingGroupId]);
  const status = room && editingGroupId ? groupStatus(rooms, room, records) : null;

  const save = () => {
    if (plan.ok === false) { setError(plan.error); return; }
    onApply(plan.updates);
  };

  const remove = () => {
    if (!room) return;
    onApply(planGroupDissolve(rooms, room));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="interconnect-title" className="w-full max-w-lg bg-white border border-[#e1dfdd] rounded-xs shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e1dfdd]">
          <h2 id="interconnect-title" className="text-sm font-semibold text-[#242424] flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#0d9488]" />
            {editingGroupId ? 'Edit interconnecting rooms' : 'Connect rooms'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#605e5c] hover:text-[#242424] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-4 py-4 space-y-3 text-xs text-[#323130] overflow-y-auto">
          <p className="text-[#605e5c]">
            Choose {MIN_GROUP_ROOMS} to {MAX_GROUP_ROOMS} rooms in the same property that open onto each other. Existing guests and allocations are not changed.
          </p>

          <div>
            <label htmlFor="ic-hotel" className="block font-semibold mb-1">Property</label>
            <select
              id="ic-hotel"
              value={hotel}
              disabled={!!editingGroupId || hotels.length <= 1}
              onChange={e => { setHotel(e.target.value); setSelected([]); setError(null); }}
              className="w-full px-2.5 py-1.5 border border-[#8a8886] rounded-xs bg-white disabled:bg-neutral-100"
            >
              {hotels.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="ic-search" className="block font-semibold mb-1">Rooms ({selected.length} selected)</label>
            <input
              id="ic-search"
              type="search"
              placeholder="Search by room number or floor"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-[#8a8886] rounded-xs mb-2"
            />
            <ul className="border border-[#e1dfdd] rounded-xs max-h-56 overflow-y-auto divide-y divide-[#edebe9]">
              {options.length === 0 ? (
                <li className="px-3 py-4 text-center text-[#605e5c]">No rooms available to connect in this property.</li>
              ) : options.map(r => {
                const checked = selected.includes(r.id);
                const disabled = !checked && selected.length >= MAX_GROUP_ROOMS;
                return (
                  <li key={r.id}>
                    <label className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer hover:bg-[#f3f2f1] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(r.id)} />
                        <span className="font-mono font-bold text-[#0f766e]">{r.roomNo}</span>
                        {r.floor ? <span className="text-[#605e5c]">Floor {r.floor}</span> : null}
                      </span>
                      <span className="text-[#605e5c]">{freeBeds(r, records)} of {r.currentMaxOccupancy || 0} beds free</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-[11px] text-[#605e5c]">Rooms already connected to another group are not listed.</p>
          </div>

          {status && (
            <p className="text-[#605e5c]" role="status">
              Current group: {GROUP_AVAILABILITY_LABEL[status.availability].toLowerCase()}, {status.totalFree} bed{status.totalFree === 1 ? '' : 's'} free across {status.rooms.length} rooms.
            </p>
          )}
          {error && <p role="alert" className="text-[#a4262c]">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-[#e1dfdd]">
          <div>
            {editingGroupId && (
              <button type="button" onClick={remove} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold border border-[#a4262c] text-[#a4262c] rounded-xs hover:bg-[#fdf3f2] cursor-pointer">
                <Unlink className="w-3.5 h-3.5" />Remove connection
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold border border-[#8a8886] rounded-xs bg-white text-[#323130] hover:bg-[#edebe9] cursor-pointer">Cancel</button>
            <button
              type="button"
              onClick={save}
              disabled={plan.ok === false && selected.length < MIN_GROUP_ROOMS}
              className="px-3 py-2 text-xs font-semibold rounded-xs border bg-[#0d9488] border-[#0d9488] text-white hover:bg-[#0f766e] disabled:opacity-50 cursor-pointer"
            >
              Save connection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
