import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Brush, ClipboardCheck, Info, ShieldAlert, Trash2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { suPropertyService } from '../../../services/suPropertyService';
import { roomManagementService } from '../../../services/roomManagementService';
import { CLEANING_STATUSES } from '../../../types/roomManagement';
import { isOutOfUse, roomFlags } from '../../../utils/roomManagementLogic';
import { RoomDetailsForm, validateRoomDraft, type RoomDraft } from '../RoomDetailsForm';
import {
  Card, Chip, Field, Stat, btnCls, cleaningTone, dangerBtnCls, dateInput, fmtDate, fmtDateTime, inputCls, primaryBtnCls, roomStatusTone,
} from '../roomUi';
import type { RoomTabProps } from './tabTypes';

/** Statuses a person can choose; Occupied / Partially Occupied follow the residents automatically. */
const SETTABLE = ['Available', 'Reserved', 'Under Maintenance', 'Blocked', 'Void'];

export const OverviewTab: React.FC<RoomTabProps> = ({ room, data, allRooms, actor, canManage, refresh, toast, close }) => {
  const { requestConfirmation } = useApp();
  const activePlacements = data.placements.filter(p => p.status === 'Active');
  const flags = useMemo(() => roomFlags(room, { placements: data.placements, beds: data.beds, items: data.items, issues: data.issues }), [room, data]);

  const [draft, setDraft] = useState<RoomDraft>(room);
  useEffect(() => { setDraft(room); }, [room]);
  const [saving, setSaving] = useState(false);

  const [nextStatus, setNextStatus] = useState(SETTABLE.includes(room.status) ? room.status : 'Available');
  const [reason, setReason] = useState(room.blockedReason || '');
  const [until, setUntil] = useState(dateInput(room.blockedUntil));
  const [cleaning, setCleaning] = useState(room.cleaningStatus || 'Clean');
  const [nextInspection, setNextInspection] = useState(dateInput(room.nextInspectionDue));
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setNextStatus(SETTABLE.includes(room.status) ? room.status : 'Available');
    setReason(room.blockedReason || '');
    setUntil(dateInput(room.blockedUntil));
    setCleaning(room.cleaningStatus || 'Clean');
    setNextInspection(dateInput(room.nextInspectionDue));
  }, [room.id, room.status, room.blockedReason, room.blockedUntil, room.cleaningStatus, room.nextInspectionDue]);

  const run = async (key: string, fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) => {
    setBusy(key);
    try {
      const r = await fn();
      if (r.success) { toast(okMsg); await refresh(); } else toast(r.error || 'That did not work.', 'error');
    } finally { setBusy(null); }
  };

  const saveDetails = async () => {
    const problem = validateRoomDraft(draft, allRooms, room.propertyId, room.id);
    if (problem) { toast(problem, 'error'); return; }
    setSaving(true);
    try {
      const patch = {
        roomNumber: String(draft.roomNumber).trim(), roomName: String(draft.roomName || '').trim() || `Room ${String(draft.roomNumber).trim()}`,
        roomType: draft.roomType, floor: draft.floor, capacity: Number(draft.capacity), size: draft.size ?? '',
        bathroomType: draft.bathroomType, isAccessible: !!draft.isAccessible, accessibilityFeatures: draft.isAccessible ? draft.accessibilityFeatures : '',
        isFamilyRoom: !!draft.isFamilyRoom, genderRestriction: draft.genderRestriction, keyReference: draft.keyReference,
        fireSafetyNotes: draft.fireSafetyNotes, kitTemplateId: draft.kitTemplateId || '', description: draft.description, notes: draft.notes,
      };
      const r = await roomManagementService.updateRoom(room, patch, actor, 'Room details updated');
      if (r.success) {
        if (Number(draft.capacity) !== Number(room.capacity)) await suPropertyService.syncRoomOccupancy(room.id);
        toast('Room details saved');
        await refresh();
      } else toast(r.error || 'Could not save the room.', 'error');
    } finally { setSaving(false); }
  };

  const deleteRoom = () => {
    if (activePlacements.length > 0) { toast('Move the residents out before deleting this room.', 'error'); return; }
    requestConfirmation({
      title: `Delete room ${room.roomNumber}?`,
      message: `This permanently deletes the room with its ${data.beds.length} bed(s), ${data.items.length} item record(s), issues and timeline. Stock movements keep their history. This cannot be undone.`,
      isDanger: true,
      onConfirm: async () => {
        const r = await suPropertyService.deleteRoom(room.id);
        if (r.success) { toast(`Room ${room.roomNumber} deleted`); close(); } else toast(r.error || 'Could not delete the room.', 'error');
      },
    });
  };

  const outOfUse = isOutOfUse(room.status);
  const derivedStatus = room.status === 'Occupied' || room.status === 'Partially Occupied';
  const bedsInService = data.beds.filter(b => b.status !== 'Out of Service').length;
  const itemsInRoom = data.items.filter(i => i.status === 'In Room').reduce((n, i) => n + i.quantity, 0);
  const openIssues = data.issues.filter(i => i.status === 'Open' || i.status === 'In Progress').length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Stat label="Residents" value={`${activePlacements.length}/${room.capacity || 1}`} tone={activePlacements.length > (room.capacity || 1) ? 'red' : 'neutral'} />
        <Stat label="Beds" value={data.beds.length ? `${bedsInService}` : '—'} sub={data.beds.length ? 'in service' : 'not set up'} />
        <Stat label="Items in room" value={itemsInRoom} />
        <Stat label="Open issues" value={openIssues} tone={openIssues ? 'amber' : 'neutral'} />
        <Stat label="Last cleaned" value={<span className="text-sm">{fmtDate(room.lastCleanedAt)}</span>} />
        <Stat label="Next inspection" value={<span className="text-sm">{fmtDate(room.nextInspectionDue)}</span>} />
      </div>

      {flags.length > 0 && (
        <Card title={<><ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> Needs attention</>}>
          <ul className="space-y-1">
            {flags.map(f => (
              <li key={f.code} className={`flex items-start gap-1.5 text-xs px-2 py-1 rounded-xs border ${f.level === 'critical' ? 'bg-red-50 border-red-200 text-red-800' : f.level === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-sky-50 border-sky-200 text-sky-900'}`}>
                {f.level === 'info' ? <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title="Availability" actions={<Chip tone={roomStatusTone(room.status)}>{room.status}</Chip>}>
          {outOfUse && (
            <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-xs text-[11px] text-amber-900">
              {room.blockedReason ? <>Reason: <b>{room.blockedReason}</b>. </> : null}
              {room.blockedUntil ? <>Until {fmtDate(room.blockedUntil)}. </> : null}
              {room.voidSince ? <>Void since {fmtDate(room.voidSince)}.</> : null}
            </div>
          )}
          {derivedStatus && <p className="text-[11px] text-[#64748b] mb-2">This room is {room.status.toLowerCase()} because of its residents. The status follows the placements automatically.</p>}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Set status" htmlFor="ov_status">
              <select id="ov_status" className={inputCls} disabled={!canManage || derivedStatus} value={nextStatus} onChange={e => setNextStatus(e.target.value)}>
                {SETTABLE.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            {nextStatus === 'Blocked' && (
              <Field label="Blocked until" htmlFor="ov_until">
                <input id="ov_until" type="date" className={inputCls} disabled={!canManage} value={until} onChange={e => setUntil(e.target.value)} />
              </Field>
            )}
            {['Blocked', 'Under Maintenance', 'Void'].includes(nextStatus) && (
              <Field label={nextStatus === 'Void' ? 'Note (optional)' : 'Reason *'} htmlFor="ov_reason" className="col-span-2">
                <input id="ov_reason" className={inputCls} disabled={!canManage} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Leak under the sink, awaiting plumber" />
              </Field>
            )}
          </div>
          <div className="mt-2 flex justify-end">
            <button type="button" className={primaryBtnCls} disabled={!canManage || derivedStatus || busy === 'status' || nextStatus === room.status && reason === (room.blockedReason || '') && until === dateInput(room.blockedUntil)}
              onClick={() => run('status', () => roomManagementService.setRoomStatus(room, nextStatus, { residents: activePlacements.length, reason, blockedUntil: until, actor }), `Room is now ${nextStatus}`)}>
              {busy === 'status' ? 'Saving…' : 'Apply status'}
            </button>
          </div>
          {!canManage && <p className="text-[10px] text-neutral-500 mt-1">Only managers can change a room's availability.</p>}
        </Card>

        <Card title={<><Brush className="w-3.5 h-3.5 text-[#0d9488]" /> Cleaning &amp; inspection</>} actions={<Chip tone={cleaningTone(room.cleaningStatus)}>{room.cleaningStatus || 'Clean'}</Chip>}>
          <div className="flex items-end gap-2">
            <Field label="Cleaning status" htmlFor="ov_clean" className="flex-1">
              <select id="ov_clean" className={inputCls} value={cleaning} onChange={e => setCleaning(e.target.value)}>
                {CLEANING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <button type="button" className={btnCls} disabled={busy === 'clean' || cleaning === (room.cleaningStatus || 'Clean')}
              onClick={() => run('clean', () => roomManagementService.setCleaning(room, cleaning, actor), `Marked ${cleaning}`)}>Update</button>
            <button type="button" className={btnCls} disabled={busy === 'clean2'}
              onClick={() => run('clean2', () => roomManagementService.setCleaning(room, 'Clean', actor), 'Marked clean')}>Mark cleaned</button>
          </div>
          <p className="text-[10px] text-[#64748b] mt-1">Last cleaned {fmtDateTime(room.lastCleanedAt)}</p>
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#f1f5f9]">
            <Field label="Next inspection due" htmlFor="ov_next">
              <input id="ov_next" type="date" className={inputCls} value={nextInspection} onChange={e => setNextInspection(e.target.value)} />
            </Field>
            <Field label="Inspection notes" htmlFor="ov_inotes">
              <input id="ov_inotes" className={inputCls} value={inspectionNotes} onChange={e => setInspectionNotes(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-[#64748b]">Last inspected {fmtDateTime(room.lastInspectedAt)}</span>
            <button type="button" className={btnCls} disabled={busy === 'insp'}
              onClick={() => run('insp', () => roomManagementService.recordInspection(room, nextInspection, inspectionNotes, actor), 'Inspection recorded').then(() => setInspectionNotes(''))}>
              <ClipboardCheck className="w-3.5 h-3.5" /> Record inspection
            </button>
          </div>
        </Card>
      </div>

      <Card title="Room details" actions={canManage ? <button type="button" className={primaryBtnCls} onClick={saveDetails} disabled={saving}>{saving ? 'Saving…' : 'Save details'}</button> : <span className="text-[10px] text-neutral-500">Read only</span>}>
        <RoomDetailsForm value={draft} onChange={setDraft} kits={data.kits} disabled={!canManage} />
      </Card>

      {canManage && (
        <Card title={<span className="text-red-700">Danger zone</span>}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-neutral-600">Deleting a room removes its beds, items, issues and timeline. A room with residents cannot be deleted.</p>
            <button type="button" className={dangerBtnCls} onClick={deleteRoom}><Trash2 className="w-3.5 h-3.5" /> Delete room</button>
          </div>
        </Card>
      )}
    </div>
  );
};
