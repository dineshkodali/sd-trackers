/**
 * AddRoomsModal — add one room, or many at once from a range such as "101-120, 201, 203".
 */

import React, { useMemo, useState } from 'react';
import { roomManagementService } from '../../services/roomManagementService';
import type { PropertyRoom } from '../../types/masterData';
import type { RoomKitTemplate } from '../../types/roomManagement';
import { expandRoomNumbers } from '../../utils/roomManagementLogic';
import { RoomDetailsForm, emptyRoomDraft, validateRoomDraft, type RoomDraft } from './RoomDetailsForm';
import { Field, Modal, btnCls, inputCls, primaryBtnCls } from './roomUi';

interface Props {
  propertyId: string;
  propertyName: string;
  existingRooms: PropertyRoom[];
  kits: RoomKitTemplate[];
  actor: string;
  onClose: () => void;
  onCreated: (message: string, rooms: PropertyRoom[]) => Promise<void>;
}

export const AddRoomsModal: React.FC<Props> = ({ propertyId, propertyName, existingRooms, kits, actor, onClose, onCreated }) => {
  const [mode, setMode] = useState<'one' | 'many'>('one');
  const [draft, setDraft] = useState<RoomDraft>(emptyRoomDraft());
  const [numbers, setNumbers] = useState('');
  const [makeBeds, setMakeBeds] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const expanded = useMemo(() => expandRoomNumbers(numbers), [numbers]);
  const existingHere = existingRooms.filter(r => r.propertyId === propertyId);
  const clashes = expanded.numbers.filter(n => existingHere.some(r => String(r.roomNumber).trim().toLowerCase() === n.toLowerCase()));

  const makeBedsFor = async (rooms: PropertyRoom[]) => {
    if (!makeBeds) return;
    for (const r of rooms) await roomManagementService.addBeds(r, Math.max(1, r.capacity || 1), 'Single', [], actor);
  };

  const submit = async () => {
    setError('');
    const base: Partial<PropertyRoom> = {
      roomType: draft.roomType, floor: draft.floor, capacity: Number(draft.capacity) || 1, size: draft.size ?? '', bathroomType: draft.bathroomType,
      isAccessible: !!draft.isAccessible, accessibilityFeatures: draft.isAccessible ? draft.accessibilityFeatures : '', isFamilyRoom: !!draft.isFamilyRoom,
      genderRestriction: draft.genderRestriction, keyReference: draft.keyReference, fireSafetyNotes: draft.fireSafetyNotes, kitTemplateId: draft.kitTemplateId || '',
      description: draft.description, notes: draft.notes, status: 'Available', occupancyStatus: 'Available', cleaningStatus: 'Clean',
    };
    setBusy(true);
    try {
      if (mode === 'one') {
        const problem = validateRoomDraft(draft, existingRooms, propertyId);
        if (problem) { setError(problem); return; }
        const r = await roomManagementService.createRoom({ ...base, propertyId, roomNumber: String(draft.roomNumber).trim(), roomName: String(draft.roomName || '').trim() || `Room ${String(draft.roomNumber).trim()}` }, actor);
        if (!r.success || !r.data) { setError(r.error || 'Could not create the room.'); return; }
        await makeBedsFor([r.data]);
        await onCreated(`Room ${r.data.roomNumber} added`, [r.data]);
      } else {
        if (expanded.error) { setError(expanded.error); return; }
        if (expanded.numbers.length === 0) { setError('Enter the room numbers, e.g. 101-120.'); return; }
        const problem = validateRoomDraft({ ...draft, roomNumber: 'x' }, [], propertyId);
        if (problem) { setError(problem); return; }
        const r = await roomManagementService.createRoomsBulk(propertyId, expanded.numbers, base, actor, existingRooms);
        const made = r.data?.rooms || [];
        await makeBedsFor(made);
        const skipped = r.data?.skipped.length ? `; skipped ${r.data.skipped.length} that already exist` : '';
        if (made.length === 0 && !r.success) { setError(r.error || 'No rooms were created.'); return; }
        await onCreated(`${made.length} room${made.length === 1 ? '' : 's'} added${skipped}${r.error ? `. ${r.error}` : ''}`, made);
      }
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`Add rooms to ${propertyName}`} onClose={onClose} width="max-w-3xl"
      footer={<><button type="button" className={btnCls} onClick={onClose}>Cancel</button><button type="button" className={primaryBtnCls} disabled={busy} onClick={submit}>{busy ? 'Adding…' : mode === 'one' ? 'Add room' : (expanded.numbers.length - clashes.length > 0 ? `Add ${expanded.numbers.length - clashes.length} room${expanded.numbers.length - clashes.length === 1 ? '' : 's'}` : 'Add rooms')}</button></>}>
      <div className="space-y-3">
        <div className="inline-flex border border-[#cbd5e1] rounded-xs overflow-hidden text-xs font-semibold">
          <button type="button" className={`px-3 py-1.5 cursor-pointer ${mode === 'one' ? 'bg-[#0d9488] text-white' : 'bg-white text-[#475569]'}`} onClick={() => setMode('one')}>One room</button>
          <button type="button" className={`px-3 py-1.5 cursor-pointer ${mode === 'many' ? 'bg-[#0d9488] text-white' : 'bg-white text-[#475569]'}`} onClick={() => setMode('many')}>Many rooms at once</button>
        </div>
        {error && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-xs">{error}</div>}

        {mode === 'many' && (
          <Field label="Room numbers *" htmlFor="ar_nums" hint="Ranges and lists: 101-120, or 101-110, 201, 203, or A1-A8. Rooms that already exist are skipped.">
            <input id="ar_nums" className={inputCls} value={numbers} onChange={e => setNumbers(e.target.value)} placeholder="e.g. 101-120" />
            {numbers && (
              <p className={`text-[11px] mt-1 ${expanded.error ? 'text-red-700' : 'text-[#475569]'}`}>
                {expanded.error ? expanded.error : `${expanded.numbers.length} room${expanded.numbers.length === 1 ? '' : 's'}: ${expanded.numbers.slice(0, 12).join(', ')}${expanded.numbers.length > 12 ? '…' : ''}${clashes.length ? ` — ${clashes.length} already exist and will be skipped` : ''}`}
              </p>
            )}
          </Field>
        )}

        <RoomDetailsForm value={draft} onChange={setDraft} kits={kits} hideIdentity={mode === 'many'} />

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="accent-[#0d9488]" checked={makeBeds} onChange={e => setMakeBeds(e.target.checked)} />
          <span>Create the beds automatically (one bed per place of capacity: A, B, C&hellip;)</span>
        </label>
      </div>
    </Modal>
  );
};
