/**
 * CatalogueKitsPanel — the shared item catalogue and the standard room kits.
 */

import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { roomManagementService } from '../../services/roomManagementService';
import { ITEM_CATEGORIES, ROOM_TYPES, type InventoryItem, type RoomKitTemplate } from '../../types/roomManagement';
import { Card, Chip, EmptyState, Field, Modal, btnCls, dangerBtnCls, inputCls, primaryBtnCls } from './roomUi';

interface Props {
  catalogue: InventoryItem[];
  catalogueIsStarter: boolean;
  kits: RoomKitTemplate[];
  canManage: boolean;
  onChanged: () => Promise<void>;
  toast: (m: string, t?: 'success' | 'error' | 'info') => void;
}

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? `inv-${crypto.randomUUID().slice(0, 8)}` : `inv-${Date.now()}`);

export const CatalogueKitsPanel: React.FC<Props> = ({ catalogue, catalogueIsStarter, kits, canManage, onChanged, toast }) => {
  const { requestConfirmation, currentUserRole } = useApp();
  const isAdmin = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';
  const [search, setSearch] = useState('');
  const [item, setItem] = useState<{ value: InventoryItem; isNew: boolean } | null>(null);
  const [kit, setKit] = useState<{ value: RoomKitTemplate; isNew: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => catalogue.filter(i => !search || `${i.itemName} ${i.itemCode || ''} ${i.category}`.toLowerCase().includes(search.toLowerCase())), [catalogue, search]);
  const categories = useMemo(() => Array.from(new Set([...ITEM_CATEGORIES, ...catalogue.map(i => i.category)])), [catalogue]);

  const done = async (r: { success: boolean; error?: string }, ok: string, close: () => void) => {
    if (r.success) { toast(ok); close(); await onChanged(); } else toast(r.error || 'Could not save.', 'error');
  };

  const loadStarter = async () => {
    setBusy(true);
    try { await done(await roomManagementService.loadStarterCatalogue(), 'Starter catalogue and kits saved', () => undefined); } finally { setBusy(false); }
  };

  const delItem = (i: InventoryItem) => requestConfirmation({
    title: `Delete ${i.itemName}?`, message: 'It is removed from the catalogue. Items already in rooms keep their name but lose the link; stock rows for it are deleted.', isDanger: true,
    onConfirm: async () => { const r = await roomManagementService.deleteCatalogueItem(i); if (r.success) { toast('Item deleted'); await onChanged(); } else toast(r.error || 'Only administrators can delete catalogue items.', 'error'); },
  });
  const delKit = (k: RoomKitTemplate) => requestConfirmation({
    title: `Delete kit "${k.templateName}"?`, message: 'Rooms keep the items they already have.', isDanger: true,
    onConfirm: async () => { const r = await roomManagementService.deleteKit(k); if (r.success) { toast('Kit deleted'); await onChanged(); } else toast(r.error || 'Only administrators can delete kits.', 'error'); },
  });

  return (
    <div className="space-y-3">
      {catalogueIsStarter && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xs text-xs text-amber-900 flex items-center justify-between gap-3">
          <span>You are looking at the built-in starter catalogue and kits. Save them to the database so every property shares the same list (you can edit them afterwards).</span>
          <button type="button" className={primaryBtnCls} disabled={busy} onClick={loadStarter}>{busy ? 'Saving…' : 'Save starter catalogue'}</button>
        </div>
      )}

      <Card title={`Item catalogue (${catalogue.length})`} actions={canManage ? <button type="button" className={primaryBtnCls} onClick={() => setItem({ isNew: true, value: { id: newId(), itemName: '', category: 'Furniture', itemType: 'Stock', unit: 'each', defaultRoomQuantity: 1, reorderLevel: 0, isActive: true } })}><Plus className="w-3.5 h-3.5" /> Add item</button> : undefined}>
        <p className="text-[11px] text-[#64748b] mb-2"><b>Counted</b> items (bedding, towels, furniture) are tracked by quantity. <b>Tracked</b> items (TV, fridge, smoke detector) are recorded one by one with a serial number and test dates on the room's Assets tab.</p>
        <input aria-label="Search catalogue" className={`${inputCls} !w-60 mb-2`} placeholder="Search the catalogue…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead><tr className="text-left text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]"><th className="py-1 pr-2">Code</th><th className="py-1 pr-2">Item</th><th className="py-1 pr-2">Category</th><th className="py-1 pr-2">Type</th><th className="py-1 pr-2 text-right">Per room</th><th className="py-1 pr-2 text-right">Reorder at</th><th className="py-1" /></tr></thead>
            <tbody>
              {shown.map(i => (
                <tr key={i.id} className="border-b border-[#f1f5f9]">
                  <td className="py-1.5 pr-2 text-[#64748b]">{i.itemCode || '—'}</td>
                  <td className="py-1.5 pr-2 font-semibold text-[#1e293b]">{i.itemName}{i.isActive === false && <span className="ml-1"><Chip tone="grey">Inactive</Chip></span>}</td>
                  <td className="py-1.5 pr-2">{i.category}</td>
                  <td className="py-1.5 pr-2"><Chip tone={i.itemType === 'Asset' ? 'blue' : 'neutral'}>{i.itemType === 'Asset' ? 'Tracked' : 'Counted'}</Chip></td>
                  <td className="py-1.5 pr-2 text-right">{i.defaultRoomQuantity ?? 1}</td>
                  <td className="py-1.5 pr-2 text-right">{i.reorderLevel ?? 0}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    {canManage && <button type="button" className={btnCls} aria-label={`Edit ${i.itemName}`} onClick={() => setItem({ isNew: false, value: { ...i } })}><Pencil className="w-3.5 h-3.5" /></button>}{' '}
                    {isAdmin && !catalogueIsStarter && <button type="button" className={dangerBtnCls} aria-label={`Delete ${i.itemName}`} onClick={() => delItem(i)}><Trash2 className="w-3.5 h-3.5" /></button>}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-neutral-500">No items match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`Standard room kits (${kits.length})`} actions={canManage ? <button type="button" className={primaryBtnCls} onClick={() => setKit({ isNew: true, value: { id: `kit-${Date.now()}`, templateName: '', roomType: 'Single', description: '', items: [], isActive: true } })}><Plus className="w-3.5 h-3.5" /> New kit</button> : undefined}>
        <p className="text-[11px] text-[#64748b] mb-2">A kit lists what a room of a given type should contain. Apply it from a room's Inventory tab to fill the room from stock in one go.</p>
        {kits.length === 0 ? <EmptyState title="No kits yet" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {kits.map(k => (
              <div key={k.id} className="border border-[#e2e8f0] rounded-xs p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div><div className="font-bold text-[#1e293b]">{k.templateName}</div><div className="text-[10px] text-[#64748b]">{k.roomType || 'Any room type'} &middot; {k.items.length} line{k.items.length === 1 ? '' : 's'} &middot; {k.items.reduce((n, l) => n + l.quantity, 0)} units</div></div>
                  <div className="flex gap-1">
                    {canManage && <button type="button" className={btnCls} aria-label={`Edit ${k.templateName}`} onClick={() => setKit({ isNew: false, value: { ...k, items: k.items.map(l => ({ ...l })) } })}><Pencil className="w-3.5 h-3.5" /></button>}
                    {isAdmin && !catalogueIsStarter && <button type="button" className={dangerBtnCls} aria-label={`Delete ${k.templateName}`} onClick={() => delKit(k)}><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </div>
                {k.description && <p className="text-[11px] text-[#475569] mt-1">{k.description}</p>}
                <p className="text-[11px] text-[#64748b] mt-1">{k.items.map(l => `${l.quantity} × ${catalogue.find(i => i.id === l.itemId)?.itemName || l.itemId}`).join(', ') || 'Empty kit'}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {item && <ItemModal value={item.value} isNew={item.isNew} categories={categories} existing={catalogue}
        onClose={() => setItem(null)} onSave={async v => done(await roomManagementService.saveCatalogueItem(v, item.isNew), item.isNew ? 'Item added' : 'Item saved', () => setItem(null))} />}
      {kit && <KitModal value={kit.value} isNew={kit.isNew} catalogue={catalogue}
        onClose={() => setKit(null)} onSave={async v => done(await roomManagementService.saveKit(v, kit.isNew), kit.isNew ? 'Kit created' : 'Kit saved', () => setKit(null))} />}
    </div>
  );
};

const ItemModal: React.FC<{ value: InventoryItem; isNew: boolean; categories: string[]; existing: InventoryItem[]; onClose: () => void; onSave: (v: InventoryItem) => Promise<void> }> = ({ value, isNew, categories, existing, onClose, onSave }) => {
  const [v, setV] = useState(value);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<InventoryItem>) => setV(prev => ({ ...prev, ...p }));
  const submit = async () => {
    if (!v.itemName.trim()) { setError('Give the item a name.'); return; }
    if (v.itemCode && existing.some(i => i.id !== v.id && (i.itemCode || '').toLowerCase() === v.itemCode!.trim().toLowerCase())) { setError(`Item code ${v.itemCode} is already used.`); return; }
    setBusy(true);
    try { await onSave({ ...v, itemName: v.itemName.trim(), itemCode: v.itemCode?.trim() || undefined, requiresSerial: v.itemType === 'Asset' ? !!v.requiresSerial : false }); } finally { setBusy(false); }
  };
  return (
    <Modal title={isNew ? 'Add a catalogue item' : `Edit ${value.itemName}`} onClose={onClose} width="max-w-xl" footer={<><button type="button" className={btnCls} onClick={onClose}>Cancel</button><button type="button" className={primaryBtnCls} disabled={busy} onClick={submit}>Save</button></>}>
      <div className="space-y-3">
        {error && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-xs">{error}</div>}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Name *" htmlFor="ci_name" className="col-span-2"><input id="ci_name" className={inputCls} value={v.itemName} onChange={e => set({ itemName: e.target.value })} /></Field>
          <Field label="Code" htmlFor="ci_code"><input id="ci_code" className={inputCls} value={v.itemCode || ''} onChange={e => set({ itemCode: e.target.value })} placeholder="e.g. FRN-008" /></Field>
          <Field label="Category" htmlFor="ci_cat"><input id="ci_cat" list="ci_cats" className={inputCls} value={v.category} onChange={e => set({ category: e.target.value })} /><datalist id="ci_cats">{categories.map(c => <option key={c} value={c} />)}</datalist></Field>
          <Field label="How it is tracked" htmlFor="ci_type"><select id="ci_type" className={inputCls} value={v.itemType} onChange={e => set({ itemType: e.target.value as InventoryItem['itemType'] })}><option value="Stock">Counted (by quantity)</option><option value="Asset">Tracked (one by one)</option></select></Field>
          <Field label="Unit" htmlFor="ci_unit"><input id="ci_unit" className={inputCls} value={v.unit || ''} onChange={e => set({ unit: e.target.value })} placeholder="each, set, pack" /></Field>
          <Field label="Normal quantity per room" htmlFor="ci_q"><input id="ci_q" type="number" min={0} className={inputCls} value={v.defaultRoomQuantity ?? 1} onChange={e => set({ defaultRoomQuantity: Number(e.target.value) })} /></Field>
          <Field label="Reorder level" htmlFor="ci_r"><input id="ci_r" type="number" min={0} className={inputCls} value={v.reorderLevel ?? 0} onChange={e => set({ reorderLevel: Number(e.target.value) })} /></Field>
          <Field label="Unit cost (£)" htmlFor="ci_c"><input id="ci_c" type="number" min={0} step="0.01" className={inputCls} value={v.unitCost ?? ''} onChange={e => set({ unitCost: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Supplier" htmlFor="ci_s" className="col-span-2"><input id="ci_s" className={inputCls} value={v.supplier || ''} onChange={e => set({ supplier: e.target.value })} /></Field>
          <label className="flex items-center gap-2 cursor-pointer pt-4"><input type="checkbox" className="accent-[#0d9488]" checked={v.isActive !== false} onChange={e => set({ isActive: e.target.checked })} /><span className="font-semibold">Active</span></label>
        </div>
        {v.itemType === 'Asset' && <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="accent-[#0d9488]" checked={!!v.requiresSerial} onChange={e => set({ requiresSerial: e.target.checked })} /><span>A serial number / tag must be recorded</span></label>}
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="accent-[#0d9488]" checked={!!v.requiresInspection} onChange={e => set({ requiresInspection: e.target.checked })} /><span>Needs regular inspection / testing</span></label>
        <Field label="Description" htmlFor="ci_d"><input id="ci_d" className={inputCls} value={v.description || ''} onChange={e => set({ description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
};

const KitModal: React.FC<{ value: RoomKitTemplate; isNew: boolean; catalogue: InventoryItem[]; onClose: () => void; onSave: (v: RoomKitTemplate) => Promise<void> }> = ({ value, isNew, catalogue, onClose, onSave }) => {
  const [v, setV] = useState(value);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const setLine = (i: number, patch: Partial<RoomKitTemplate['items'][number]>) => setV(prev => ({ ...prev, items: prev.items.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  const submit = async () => {
    if (!v.templateName.trim()) { setError('Give the kit a name.'); return; }
    const lines = v.items.filter(l => l.itemId);
    if (lines.some(l => !Number.isInteger(l.quantity) || l.quantity < 1)) { setError('Every quantity must be a whole number of 1 or more.'); return; }
    if (new Set(lines.map(l => l.itemId)).size !== lines.length) { setError('An item appears twice. Combine the quantities into one line.'); return; }
    setBusy(true);
    try { await onSave({ ...v, templateName: v.templateName.trim(), items: lines }); } finally { setBusy(false); }
  };
  return (
    <Modal title={isNew ? 'New room kit' : `Edit ${value.templateName}`} onClose={onClose} width="max-w-xl" footer={<><button type="button" className={btnCls} onClick={onClose}>Cancel</button><button type="button" className={primaryBtnCls} disabled={busy} onClick={submit}>Save kit</button></>}>
      <div className="space-y-3">
        {error && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-xs">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kit name *" htmlFor="kt_name"><input id="kt_name" className={inputCls} value={v.templateName} onChange={e => setV({ ...v, templateName: e.target.value })} placeholder="e.g. Standard twin room" /></Field>
          <Field label="For room type" htmlFor="kt_type"><select id="kt_type" className={inputCls} value={v.roomType || ''} onChange={e => setV({ ...v, roomType: e.target.value })}><option value="">Any</option>{ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></Field>
        </div>
        <Field label="Description" htmlFor="kt_desc"><input id="kt_desc" className={inputCls} value={v.description || ''} onChange={e => setV({ ...v, description: e.target.value })} /></Field>
        <div>
          <label className="block text-[10px] font-bold text-[#475569] uppercase mb-1">Items in the kit</label>
          <div className="space-y-1.5">
            {v.items.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <select aria-label={`Item ${i + 1}`} className={inputCls} value={l.itemId} onChange={e => setLine(i, { itemId: e.target.value })}><option value="">Choose an item…</option>{catalogue.filter(c => c.isActive !== false || c.id === l.itemId).map(c => <option key={c.id} value={c.id}>{c.itemName}</option>)}</select>
                <input aria-label={`Quantity ${i + 1}`} type="number" min={1} className={`${inputCls} !w-20`} value={l.quantity} onChange={e => setLine(i, { quantity: Number(e.target.value) })} />
                <button type="button" className={dangerBtnCls} aria-label="Remove line" onClick={() => setV({ ...v, items: v.items.filter((_, idx) => idx !== i) })}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <button type="button" className={`${btnCls} mt-2`} onClick={() => setV({ ...v, items: [...v.items, { itemId: '', quantity: 1 }] })}><Plus className="w-3.5 h-3.5" /> Add item</button>
        </div>
      </div>
    </Modal>
  );
};
