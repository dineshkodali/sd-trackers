/**
 * RoomDetailsForm — all the descriptive details of a room (used when adding a room and on the Overview tab).
 * Status / blocking is handled separately by the status panel because it has rules (no residents, reason).
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import type { PropertyRoom } from '../../types/masterData';
import { BATHROOM_TYPES, GENDER_RESTRICTIONS, ROOM_TYPES, type RoomKitTemplate } from '../../types/roomManagement';
import { duplicateRoomNumber } from '../../utils/roomManagementLogic';
import { Field, inputCls } from './roomUi';

export type RoomDraft = Partial<PropertyRoom>;

export const emptyRoomDraft = (): RoomDraft => ({
  roomNumber: '', roomName: '', roomType: 'Single', floor: 'Ground', capacity: 1, size: '',
  bathroomType: 'En-suite', isAccessible: false, accessibilityFeatures: '', isFamilyRoom: false, genderRestriction: 'None',
  keyReference: '', fireSafetyNotes: '', kitTemplateId: '', description: '', notes: '', status: 'Available', occupancyStatus: 'Available',
});

/** Returns an error message, or null when the details are fine. */
export function validateRoomDraft(d: RoomDraft, rooms: Pick<PropertyRoom, 'id' | 'propertyId' | 'roomNumber'>[], propertyId: string, editingId?: string): string | null {
  if (!String(d.roomNumber || '').trim()) return 'Room number is required.';
  if (duplicateRoomNumber(rooms, propertyId, String(d.roomNumber), editingId)) return `Room ${String(d.roomNumber).trim()} already exists in this property.`;
  const cap = Number(d.capacity);
  if (!Number.isInteger(cap) || cap < 1 || cap > 30) return 'Capacity (beds) must be a whole number from 1 to 30.';
  if (d.size !== undefined && d.size !== '' && !(Number(d.size) > 0)) return 'Size must be a number greater than 0 (square metres), or left empty.';
  return null;
}

interface Props {
  value: RoomDraft;
  onChange: (next: RoomDraft) => void;
  kits: RoomKitTemplate[];
  disabled?: boolean;
  /** hide the room number / name (when creating many rooms at once) */
  hideIdentity?: boolean;
}

export const RoomDetailsForm: React.FC<Props> = ({ value, onChange, kits, disabled, hideIdentity }) => {
  const { getFieldOptions } = useApp();
  const typeOptions = React.useMemo(() => {
    const fromSettings = getFieldOptions('propertyRoomTypes', false).map(o => o.value || o.label);
    const base = fromSettings.length > 0 ? fromSettings : [...ROOM_TYPES];
    return value.roomType && !base.includes(value.roomType) ? [value.roomType, ...base] : base;
  }, [getFieldOptions, value.roomType]);

  const set = (patch: RoomDraft) => onChange({ ...value, ...patch });
  const id = (n: string) => `rd_${n}`;

  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {!hideIdentity && (
          <>
            <Field label="Room Number *" htmlFor={id('num')}>
              <input id={id('num')} className={inputCls} disabled={disabled} value={value.roomNumber || ''} onChange={e => set({ roomNumber: e.target.value })} placeholder="e.g. 101, 1A" />
            </Field>
            <Field label="Room Name" htmlFor={id('name')} className="sm:col-span-2">
              <input id={id('name')} className={inputCls} disabled={disabled} value={value.roomName || ''} onChange={e => set({ roomName: e.target.value })} placeholder={`Room ${value.roomNumber || ''}`.trim()} />
            </Field>
          </>
        )}
        <Field label="Floor Level" htmlFor={id('floor')}>
          <input id={id('floor')} className={inputCls} disabled={disabled} value={value.floor || ''} onChange={e => set({ floor: e.target.value })} placeholder="Ground, 1st, 2nd" />
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Room Type" htmlFor={id('type')}>
          <select id={id('type')} className={inputCls} disabled={disabled} value={value.roomType || ''} onChange={e => set({ roomType: e.target.value })}>
            {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Capacity (Beds)" htmlFor={id('cap')}>
          <input id={id('cap')} type="number" min={1} max={30} className={inputCls} disabled={disabled} value={value.capacity ?? 1} onChange={e => set({ capacity: Number(e.target.value) })} />
        </Field>
        <Field label="Size (m²)" htmlFor={id('size')}>
          <input id={id('size')} type="number" min={0} step="0.1" className={inputCls} disabled={disabled} value={value.size ?? ''} onChange={e => set({ size: e.target.value })} />
        </Field>
        <Field label="Bathroom" htmlFor={id('bath')}>
          <select id={id('bath')} className={inputCls} disabled={disabled} value={value.bathroomType || 'En-suite'} onChange={e => set({ bathroomType: e.target.value })}>
            {BATHROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <Field label="Gender Restriction" htmlFor={id('gender')}>
          <select id={id('gender')} className={inputCls} disabled={disabled} value={value.genderRestriction || 'None'} onChange={e => set({ genderRestriction: e.target.value })}>
            {GENDER_RESTRICTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Key / Key Card Ref" htmlFor={id('key')}>
          <input id={id('key')} className={inputCls} disabled={disabled} value={value.keyReference || ''} onChange={e => set({ keyReference: e.target.value })} placeholder="e.g. K-101" />
        </Field>
        <label className="flex items-center gap-2 pb-1.5 cursor-pointer">
          <input type="checkbox" className="accent-[#0d9488]" disabled={disabled} checked={!!value.isFamilyRoom} onChange={e => set({ isFamilyRoom: e.target.checked })} />
          <span className="font-semibold text-[#334155]">Family room</span>
        </label>
        <label className="flex items-center gap-2 pb-1.5 cursor-pointer">
          <input type="checkbox" className="accent-[#0d9488]" disabled={disabled} checked={!!value.isAccessible} onChange={e => set({ isAccessible: e.target.checked })} />
          <span className="font-semibold text-[#334155]">Accessible room</span>
        </label>
      </div>

      {value.isAccessible && (
        <Field label="Accessibility Features" htmlFor={id('acc')}>
          <input id={id('acc')} className={inputCls} disabled={disabled} value={value.accessibilityFeatures || ''} onChange={e => set({ accessibilityFeatures: e.target.value })} placeholder="e.g. Wet room, grab rails, profiling bed, ground floor" />
        </Field>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Standard Room Kit" htmlFor={id('kit')} hint="The items this room should normally contain (apply it from the Inventory tab).">
          <select id={id('kit')} className={inputCls} disabled={disabled} value={value.kitTemplateId || ''} onChange={e => set({ kitTemplateId: e.target.value })}>
            <option value="">No standard kit</option>
            {kits.map(k => <option key={k.id} value={k.id}>{k.templateName}</option>)}
          </select>
        </Field>
        <Field label="Fire Safety Notes" htmlFor={id('fire')}>
          <input id={id('fire')} className={inputCls} disabled={disabled} value={value.fireSafetyNotes || ''} onChange={e => set({ fireSafetyNotes: e.target.value })} placeholder="e.g. Fire door, smoke detector tested weekly" />
        </Field>
      </div>

      <Field label="Description & Fixtures" htmlFor={id('desc')}>
        <textarea id={id('desc')} rows={2} className={inputCls} disabled={disabled} value={value.description || ''} onChange={e => set({ description: e.target.value })} placeholder="e.g. Twin room with en-suite shower, double glazed, radiator heating" />
      </Field>
      <Field label="Notes" htmlFor={id('notes')}>
        <textarea id={id('notes')} rows={2} className={inputCls} disabled={disabled} value={value.notes || ''} onChange={e => set({ notes: e.target.value })} />
      </Field>
    </div>
  );
};
