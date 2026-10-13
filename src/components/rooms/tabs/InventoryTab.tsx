import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, ClipboardCheck, Package, PackagePlus, Plus, Undo2 } from 'lucide-react';
import { roomManagementService } from '../../../services/roomManagementService';
import type { PropertyRoom } from '../../../types/masterData';
import { ITEM_CONDITIONS, type InventoryItem, type RoomItem } from '../../../types/roomManagement';
import { planKitApplication, validateRoomItem } from '../../../utils/roomManagementLogic';
import { Card, Chip, EmptyState, Field, Modal, btnCls, conditionTone, fmtDate, inputCls, itemStatusTone, primaryBtnCls } from '../roomUi';
import type { RoomTabProps } from './tabTypes';

type Action =
  | { kind: 'return'; item: RoomItem }
  | { kind: 'move'; item: RoomItem }
  | { kind: 'status'; item: RoomItem }
  | null;

export const InventoryTab: React.FC<RoomTabProps> = ({ room, data, allRooms, actor, refresh, toast }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [showKit, setShowKit] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');

  const itemsById = useMemo(() => new Map(data.catalogue.map(i => [i.id, i])), [data.catalogue]);
  const visible = data.items.filter(i => !filter || `${i.itemName} ${i.category || ''} ${i.serialNumber || ''}`.toLowerCase().includes(filter.toLowerCase()))
    .sort((x, y) => x.itemName.localeCompare(y.itemName) || (x.status === 'In Room' ? -1 : 1) - (y.status === 'In Room' ? -1 : 1));
  const units = data.items.filter(i => i.status === 'In Room').reduce((n, i) => n + i.quantity, 0);
  const damaged = data.items.filter(i => i.status === 'Damaged').reduce((n, i) => n + i.quantity, 0);
  const missing = data.items.filter(i => i.status === 'Missing').reduce((n, i) => n + i.quantity, 0);
  const otherRooms = allRooms.filter(r => r.propertyId === room.propertyId && r.id !== room.id)
    .sort((a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true }));

  const finish = async (res: { success: boolean; error?: string; warning?: string }, okMsg: string) => {
    if (res.success) { toast(res.warning ? `${okMsg} (${res.warning})` : okMsg, res.warning ? 'info' : 'success'); await refresh(); return true; }
    toast(res.error || 'That did not work.', 'error');
    return false;
  };

  const checkAll = async () => {
    setBusy(true);
    try { await finish(await roomManagementService.markRoomChecked(data.items, room, actor), 'Room inventory marked as checked'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <Card
        title={<><Package className="w-3.5 h-3.5 text-[#0d9488]" /> Items in this room</>}
        actions={(
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button type="button" className={btnCls} onClick={() => setShowKit(true)}><PackagePlus className="w-3.5 h-3.5" /> Apply kit</button>
            <button type="button" className={btnCls} disabled={busy || data.items.length === 0} onClick={checkAll}><ClipboardCheck className="w-3.5 h-3.5" /> Mark all checked</button>
            <button type="button" className={primaryBtnCls} onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5" /> Add item</button>
          </div>
        )}
      >
        <div className="flex flex-wrap items-center gap-2 mb-2 text-[11px]">
          <Chip tone="green">{units} in room</Chip>
          {damaged > 0 && <Chip tone="amber">{damaged} damaged</Chip>}
          {missing > 0 && <Chip tone="red">{missing} missing</Chip>}
          <input aria-label="Filter items" className={`${inputCls} !w-48 ml-auto`} placeholder="Filter items…" value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        {data.items.length === 0 ? (
          <EmptyState icon={<Package className="w-8 h-8" />} title="No items recorded in this room yet" hint="Add items one by one, or apply the standard kit to fill the room in one go.">
            <button type="button" className={btnCls} onClick={() => setShowKit(true)}>Apply a kit</button>
            <button type="button" className={primaryBtnCls} onClick={() => setShowAdd(true)}>Add an item</button>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[760px]">
              <thead>
                <tr className="text-left text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                  <th className="py-1 pr-2">Item</th><th className="py-1 pr-2">Qty</th><th className="py-1 pr-2">Condition</th><th className="py-1 pr-2">Status</th>
                  <th className="py-1 pr-2">Serial / tag</th><th className="py-1 pr-2">Last checked</th><th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {visible.map(i => (
                  <tr key={i.id} className="border-b border-[#f1f5f9] align-top">
                    <td className="py-1.5 pr-2"><div className="font-semibold text-[#1e293b]">{i.itemName}</div><div className="text-[10px] text-[#64748b]">{i.category || '—'}{i.notes ? ` · ${i.notes}` : ''}</div></td>
                    <td className="py-1.5 pr-2 font-semibold">{i.quantity}</td>
                    <td className="py-1.5 pr-2"><Chip tone={conditionTone(i.condition)}>{i.condition}</Chip></td>
                    <td className="py-1.5 pr-2"><Chip tone={itemStatusTone(i.status)}>{i.status}</Chip></td>
                    <td className="py-1.5 pr-2">{i.serialNumber || '—'}</td>
                    <td className="py-1.5 pr-2">{fmtDate(i.lastCheckedAt)}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      {i.status === 'In Room' && (
                        <>
                          <button type="button" className={btnCls} title="Move to another room" onClick={() => setAction({ kind: 'move', item: i })} disabled={otherRooms.length === 0}><ArrowRightLeft className="w-3.5 h-3.5" /></button>{' '}
                          <button type="button" className={btnCls} title="Return to common stock" onClick={() => setAction({ kind: 'return', item: i })} disabled={!i.itemId}><Undo2 className="w-3.5 h-3.5" /></button>{' '}
                        </>
                      )}
                      <button type="button" className={btnCls} onClick={() => setAction({ kind: 'status', item: i })}>{i.status === 'In Room' ? 'Damaged / missing…' : 'Update…'}</button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-neutral-500">Nothing matches the filter.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAdd && <AddItemModal room={room} data={data} actor={actor} onClose={() => setShowAdd(false)} onDone={async res => { if (await finish(res, 'Item added to the room')) setShowAdd(false); }} />}
      {showKit && <ApplyKitModal room={room} data={data} actor={actor} onClose={() => setShowKit(false)} onApplied={async (msg, ok) => { toast(msg, ok ? 'success' : 'info'); await refresh(); }} />}
      {action?.kind === 'return' && <ReturnModal room={room} item={action.item} itemDef={itemsById.get(action.item.itemId || '')} actor={actor} onClose={() => setAction(null)} onDone={async res => { if (await finish(res, 'Returned to stock')) setAction(null); }} />}
      {action?.kind === 'move' && <MoveModal room={room} item={action.item} rooms={otherRooms} siblingItems={data.siblingItems} actor={actor} onClose={() => setAction(null)} onDone={async res => { if (await finish(res, 'Item moved')) setAction(null); }} />}
      {action?.kind === 'status' && <StatusModal room={room} item={action.item} actor={actor} onClose={() => setAction(null)} onDone={async res => { if (await finish(res, 'Item updated')) setAction(null); }} />}
    </div>
  );
};

/* ------------------------------------------------------------------ add item */
type OpRes = { success: boolean; error?: string; warning?: string };

const AddItemModal: React.FC<{ room: PropertyRoom; data: RoomTabProps['data']; actor: string; onClose: () => void; onDone: (r: OpRes) => Promise<void> }> = ({ room, data, actor, onClose, onDone }) => {
  const [search, setSearch] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState(1);
  const [fromStock, setFromStock] = useState(true);
  const [condition, setCondition] = useState('Good');
  const [serial, setSerial] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const options = data.catalogue.filter(i => i.isActive !== false && (!search || `${i.itemName} ${i.category} ${i.itemCode || ''}`.toLowerCase().includes(search.toLowerCase())));
  const item = data.catalogue.find(i => i.id === itemId);
  const stockQty = data.stock.filter(s => s.itemId === itemId).reduce((n, s) => n + s.quantityOnHand, 0);
  const needsSerial = !!item && (item.itemType === 'Asset' || !!item.requiresSerial);

  const submit = async () => {
    if (!item) { setError('Choose an item.'); return; }
    const problem = validateRoomItem(item, { quantity: qty, serialNumber: serial });
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError('');
    try {
      const res = await roomManagementService.addItemToRoom({ room, item, quantity: qty, fromStock, condition, serialNumber: serial, notes, existing: data.items, actor });
      if (!res.success) setError(res.error || 'Could not add the item.');
      await onDone(res);
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Add an item to room ${room.roomNumber}`} onClose={onClose}
      footer={<><button type="button" className={btnCls} onClick={onClose}>Cancel</button><button type="button" className={primaryBtnCls} disabled={saving} onClick={submit}>{saving ? 'Adding…' : 'Add item'}</button></>}>
      <div className="space-y-3">
        {error && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-xs">{error}</div>}
        <Field label="Item" htmlFor="ai_item">
          <input aria-label="Search the catalogue" className={`${inputCls} mb-1`} placeholder="Search the catalogue…" value={search} onChange={e => setSearch(e.target.value)} />
          <select id="ai_item" size={6} className={inputCls} value={itemId} onChange={e => { setItemId(e.target.value); setQty(1); setError(''); }}>
            {options.map(i => <option key={i.id} value={i.id}>{i.itemName} — {i.category}{i.itemType === 'Asset' ? ' (tracked)' : ''}</option>)}
          </select>
          {data.catalogueIsStarter && <p className="text-[10px] text-amber-800 mt-1">Showing the starter catalogue. Save it to the database from Room Management → Catalogue &amp; Kits.</p>}
        </Field>
        {item && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Quantity" htmlFor="ai_qty"><input id="ai_qty" type="number" min={1} className={inputCls} value={qty} onChange={e => setQty(Number(e.target.value))} disabled={item.itemType === 'Asset'} /></Field>
              <Field label="Condition" htmlFor="ai_cond"><select id="ai_cond" className={inputCls} value={condition} onChange={e => setCondition(e.target.value)}>{ITEM_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
              {needsSerial && <Field label={item.requiresSerial ? 'Serial / tag *' : 'Serial / tag'} htmlFor="ai_sn"><input id="ai_sn" className={inputCls} value={serial} onChange={e => setSerial(e.target.value)} /></Field>}
            </div>
            <div className="border border-[#e2e8f0] rounded-xs p-2 space-y-1">
              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="ai_src" className="accent-[#0d9488]" checked={fromStock} onChange={() => setFromStock(true)} /><span className="font-semibold">Take from the property's common stock</span> <Chip tone={stockQty > 0 ? 'green' : 'red'}>{stockQty} in stock</Chip></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="ai_src" className="accent-[#0d9488]" checked={!fromStock} onChange={() => setFromStock(false)} /><span className="font-semibold">It is already in the room</span> <span className="text-[#64748b]">(just record it, stock is not changed)</span></label>
            </div>
            <Field label="Notes" htmlFor="ai_notes"><input id="ai_notes" className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" /></Field>
          </>
        )}
      </div>
    </Modal>
  );
};

/* ------------------------------------------------------------------ kit */
const ApplyKitModal: React.FC<{ room: PropertyRoom; data: RoomTabProps['data']; actor: string; onClose: () => void; onApplied: (message: string, ok: boolean) => Promise<void> }> = ({ room, data, actor, onClose, onApplied }) => {
  const matchByType = data.kits.find(k => k.roomType && room.roomType && k.roomType.toLowerCase() === String(room.roomType).toLowerCase());
  const [kitId, setKitId] = useState(room.kitTemplateId || matchByType?.id || data.kits[0]?.id || '');
  const [fromStock, setFromStock] = useState(data.stock.length > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const kit = data.kits.find(k => k.id === kitId);
  const plan = useMemo(() => (kit ? planKitApplication(kit, data.items, data.stock, data.catalogue, fromStock) : []), [kit, data.items, data.stock, data.catalogue, fromStock]);
  const toIssue = plan.reduce((n, l) => n + l.toIssue, 0);
  const short = plan.filter(l => l.shortfall > 0);

  const apply = async () => {
    if (!kit) return;
    setBusy(true);
    setError('');
    try {
      const res = await roomManagementService.applyKit({ room, kit, fromStock, catalogue: data.catalogue, stock: data.stock, roomItems: data.items, actor });
      if (res.data) {
        await onApplied(`${res.data.issued} item(s) placed${res.data.failed.length ? `; not placed: ${res.data.failed.join('; ')}` : ''}`, res.success);
        if (res.success) onClose();
        else setError(res.error || 'Some items were not placed.');
      } else setError(res.error || 'Could not apply the kit.');
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`Apply a room kit to room ${room.roomNumber}`} onClose={onClose} width="max-w-2xl"
      footer={<><button type="button" className={btnCls} onClick={onClose}>Close</button><button type="button" className={primaryBtnCls} disabled={busy || !kit || toIssue === 0} onClick={apply}>{busy ? 'Applying…' : `Place ${toIssue} item${toIssue === 1 ? '' : 's'}`}</button></>}>
      <div className="space-y-3">
        {error && <div className="p-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-xs">{error}</div>}
        {data.kits.length === 0 ? <p className="text-neutral-500">There are no kits yet. Create one in Room Management → Catalogue &amp; Kits.</p> : (
          <>
            <div className="grid grid-cols-2 gap-3 items-end">
              <Field label="Kit" htmlFor="ak_kit"><select id="ak_kit" className={inputCls} value={kitId} onChange={e => setKitId(e.target.value)}>{data.kits.map(k => <option key={k.id} value={k.id}>{k.templateName}{k.roomType ? ` (${k.roomType})` : ''}</option>)}</select></Field>
              <label className="flex items-center gap-2 pb-1.5 cursor-pointer"><input type="checkbox" className="accent-[#0d9488]" checked={fromStock} onChange={e => setFromStock(e.target.checked)} /><span className="font-semibold">Take the items from common stock</span></label>
            </div>
            {kit?.description && <p className="text-[11px] text-[#64748b]">{kit.description}</p>}
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]"><th className="py-1 pr-2">Item</th><th className="py-1 pr-2 text-right">Needed</th><th className="py-1 pr-2 text-right">Already here</th><th className="py-1 pr-2 text-right">In stock</th><th className="py-1 text-right">Will place</th></tr></thead>
              <tbody>
                {plan.map(l => (
                  <tr key={l.itemId} className="border-b border-[#f1f5f9]">
                    <td className="py-1 pr-2">{l.itemName}</td><td className="py-1 pr-2 text-right">{l.required}</td><td className="py-1 pr-2 text-right">{l.alreadyInRoom}</td>
                    <td className="py-1 pr-2 text-right">{fromStock ? l.available : '—'}</td>
                    <td className="py-1 text-right font-semibold">{l.toIssue}{l.shortfall > 0 && <span className="text-red-700 font-bold"> (short {l.shortfall})</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {short.length > 0 && <p className="text-[11px] text-red-800 bg-red-50 border border-red-200 rounded-xs px-2 py-1">Not enough stock for {short.map(s => s.itemName).join(', ')}. Receive more stock first, or place what is available now.</p>}
            {plan.some(l => data.catalogue.find(i => i.id === l.itemId)?.requiresSerial && l.toIssue > 0) && <p className="text-[11px] text-sky-900 bg-sky-50 border border-sky-200 rounded-xs px-2 py-1">Items that need a serial number (e.g. detectors, TV) are not placed by a kit: add them from the Assets tab.</p>}
          </>
        )}
      </div>
    </Modal>
  );
};

/* ------------------------------------------------------------------ return / move / status */
const QtyField: React.FC<{ id: string; max: number; value: number; onChange: (n: number) => void }> = ({ id, max, value, onChange }) => (
  <Field label={`Quantity (1–${max})`} htmlFor={id}><input id={id} type="number" min={1} max={max} className={inputCls} value={value} onChange={e => onChange(Number(e.target.value))} /></Field>
);

const ReturnModal: React.FC<{ room: PropertyRoom; item: RoomItem; itemDef?: InventoryItem; actor: string; onClose: () => void; onDone: (r: OpRes) => Promise<void> }> = ({ room, item, itemDef, actor, onClose, onDone }) => {
  const [qty, setQty] = useState(item.quantity);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Return ${item.itemName} to stock`} onClose={onClose}
      footer={<><button type="button" className={btnCls} onClick={onClose}>Cancel</button><button type="button" className={primaryBtnCls} disabled={busy} onClick={async () => { setBusy(true); try { await onDone(await roomManagementService.returnToStock({ room, roomItem: item, quantity: qty, item: itemDef, reason, actor })); } finally { setBusy(false); } }}>Return to stock</button></>}>
      <div className="space-y-3"><p className="text-[#64748b]">The items leave room {room.roomNumber} and are added back to the property's common stock.</p>
        <QtyField id="rt_qty" max={item.quantity} value={qty} onChange={setQty} />
        <Field label="Reason (optional)" htmlFor="rt_reason"><input id="rt_reason" className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Resident left, room being stripped" /></Field>
      </div>
    </Modal>
  );
};

const MoveModal: React.FC<{ room: PropertyRoom; item: RoomItem; rooms: PropertyRoom[]; siblingItems: RoomItem[]; actor: string; onClose: () => void; onDone: (r: OpRes) => Promise<void> }> = ({ room, item, rooms, siblingItems, actor, onClose, onDone }) => {
  const [toId, setToId] = useState(rooms[0]?.id || '');
  const [qty, setQty] = useState(item.quantity);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const to = rooms.find(r => r.id === toId);
  return (
    <Modal title={`Move ${item.itemName} to another room`} onClose={onClose}
      footer={<><button type="button" className={btnCls} onClick={onClose}>Cancel</button><button type="button" className={primaryBtnCls} disabled={busy || !to} onClick={async () => { if (!to) return; setBusy(true); try { await onDone(await roomManagementService.transferItem({ from: room, to, roomItem: item, quantity: qty, destinationItems: siblingItems, reason, actor })); } finally { setBusy(false); } }}>Move</button></>}>
      <div className="space-y-3">
        <Field label="Move to room" htmlFor="mv_room"><select id="mv_room" className={inputCls} value={toId} onChange={e => setToId(e.target.value)}>{rooms.map(r => <option key={r.id} value={r.id}>Room {r.roomNumber}{r.roomName && r.roomName !== `Room ${r.roomNumber}` ? ` — ${r.roomName}` : ''} ({r.status})</option>)}</select></Field>
        <QtyField id="mv_qty" max={item.quantity} value={qty} onChange={setQty} />
        <Field label="Reason (optional)" htmlFor="mv_reason"><input id="mv_reason" className={inputCls} value={reason} onChange={e => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  );
};

const StatusModal: React.FC<{ room: PropertyRoom; item: RoomItem; actor: string; onClose: () => void; onDone: (r: OpRes) => Promise<void> }> = ({ room, item, actor, onClose, onDone }) => {
  const choices = (['In Room', 'Damaged', 'Missing', 'Removed'] as const).filter(s => s !== item.status);
  const [status, setStatus] = useState<(typeof choices)[number]>(choices[0]);
  const [qty, setQty] = useState(item.quantity);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`${item.itemName}: update status`} onClose={onClose}
      footer={<><button type="button" className={btnCls} onClick={onClose}>Cancel</button><button type="button" className={primaryBtnCls} disabled={busy} onClick={async () => { setBusy(true); try { await onDone(await roomManagementService.setItemStatus({ room, roomItem: item, status, quantity: qty, note, actor })); } finally { setBusy(false); } }}>Save</button></>}>
      <div className="space-y-3">
        <Field label="Mark as" htmlFor="st_status"><select id="st_status" className={inputCls} value={status} onChange={e => setStatus(e.target.value as typeof status)}>{choices.map(c => <option key={c} value={c}>{c === 'Removed' ? 'Removed / disposed' : c}</option>)}</select></Field>
        {item.quantity > 1 && <QtyField id="st_qty" max={item.quantity} value={qty} onChange={setQty} />}
        <Field label="Note" htmlFor="st_note" hint={status === 'Removed' ? 'Removed items are taken off the room and logged as disposed.' : undefined}><input id="st_note" className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder="What happened?" /></Field>
      </div>
    </Modal>
  );
};
