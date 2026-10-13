import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { roomManagementService } from '../../../services/roomManagementService';
import type { PropertyAsset } from '../../../types/masterData';
import { ITEM_CATEGORIES, ITEM_CONDITIONS } from '../../../types/roomManagement';
import { Card, Chip, EmptyState, Field, Modal, btnCls, conditionTone, dangerBtnCls, dateInput, fmtDate, inputCls, primaryBtnCls } from '../roomUi';
import type { RoomTabProps } from './tabTypes';

type AssetDraft = Partial<PropertyAsset>;
const today = () => new Date().toISOString().slice(0, 10);
const overdue = (d?: string) => !!d && String(d).slice(0, 10) < today();

export const AssetsTab: React.FC<RoomTabProps> = ({ room, data, actor, canManage, refresh, toast }) => {
  const { requestConfirmation } = useApp();
  const [editing, setEditing] = useState<AssetDraft | null>(null);
  const [isNew, setIsNew] = useState(true);
  const [saving, setSaving] = useState(false);

  const trackedItems = data.catalogue.filter(i => i.itemType === 'Asset' && i.isActive !== false);
  const categories = useMemo(() => Array.from(new Set([...ITEM_CATEGORIES, ...data.catalogue.map(i => i.category), ...data.assets.map(a => a.category)])), [data.catalogue, data.assets]);

  const open = (a?: PropertyAsset) => {
    setIsNew(!a);
    setEditing(a ? { ...a } : { category: 'Electrical', condition: 'Good', status: 'Active' });
  };
  const set = (patch: AssetDraft) => setEditing(prev => ({ ...(prev || {}), ...patch }));

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const r = await roomManagementService.saveAsset({ ...editing, propertyId: room.propertyId, roomId: room.id, assetName: String(editing.assetName || '') }, isNew, actor);
      if (r.success) { toast(isNew ? 'Asset added' : 'Asset saved'); setEditing(null); await refresh(); } else toast(r.error || 'Could not save the asset.', 'error');
    } finally { setSaving(false); }
  };

  const del = (a: PropertyAsset) => requestConfirmation({
    title: `Delete ${a.assetName}?`, message: 'This removes the asset record from the room.', isDanger: true,
    onConfirm: async () => { const r = await roomManagementService.deleteAsset(a, actor); if (r.success) { toast('Asset deleted'); await refresh(); } else toast(r.error || 'Could not delete.', 'error'); },
  });

  return (
    <div className="space-y-3">
      <Card
        title={<><Wrench className="w-3.5 h-3.5 text-[#0d9488]" /> Tracked assets ({data.assets.length})</>}
        actions={<button type="button" className={primaryBtnCls} onClick={() => open()}><Plus className="w-3.5 h-3.5" /> Add asset</button>}
      >
        <p className="text-[11px] text-[#64748b] mb-2">Equipment tracked one by one with its own tag, serial number, condition and safety / service dates (TV, fridge, smoke detector, fire door closer...). Counted items such as bedding and towels are on the Inventory tab.</p>
        {data.assets.length === 0 ? (
          <EmptyState icon={<Wrench className="w-8 h-8" />} title="No tracked assets in this room" hint="Add the equipment that needs a serial number, a test date or a service record." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead>
                <tr className="text-left text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                  <th className="py-1 pr-2">Asset</th><th className="py-1 pr-2">Tag / Serial</th><th className="py-1 pr-2">Condition</th><th className="py-1 pr-2">Status</th>
                  <th className="py-1 pr-2">PAT next due</th><th className="py-1 pr-2">Service due</th><th className="py-1 pr-2">Warranty</th><th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {data.assets.map(a => (
                  <tr key={a.id} className="border-b border-[#f1f5f9] align-top">
                    <td className="py-1.5 pr-2"><div className="font-semibold text-[#1e293b]">{a.assetName}</div><div className="text-[10px] text-[#64748b]">{a.category}{a.manufacturer ? ` · ${a.manufacturer}` : ''}{a.model ? ` ${a.model}` : ''}</div>{a.locationDetail && <div className="text-[10px] text-[#64748b]">{a.locationDetail}</div>}</td>
                    <td className="py-1.5 pr-2"><div>{a.assetTag || '—'}</div><div className="text-[10px] text-[#64748b]">{a.serialNumber || ''}</div></td>
                    <td className="py-1.5 pr-2"><Chip tone={conditionTone(a.condition)}>{a.condition}</Chip></td>
                    <td className="py-1.5 pr-2"><Chip tone={a.status === 'Active' ? 'green' : a.status === 'In Repair' ? 'amber' : 'grey'}>{a.status}</Chip></td>
                    <td className="py-1.5 pr-2">{a.patNextDue ? <Chip tone={overdue(a.patNextDue) ? 'red' : 'neutral'}>{fmtDate(a.patNextDue)}{overdue(a.patNextDue) ? ' • overdue' : ''}</Chip> : '—'}</td>
                    <td className="py-1.5 pr-2">{a.nextServiceDue ? <Chip tone={overdue(a.nextServiceDue) ? 'red' : 'neutral'}>{fmtDate(a.nextServiceDue)}{overdue(a.nextServiceDue) ? ' • overdue' : ''}</Chip> : '—'}</td>
                    <td className="py-1.5 pr-2">{a.warrantyExpiry ? <Chip tone={overdue(a.warrantyExpiry) ? 'grey' : 'neutral'}>{fmtDate(a.warrantyExpiry)}</Chip> : '—'}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <button type="button" className={btnCls} onClick={() => open(a)} aria-label={`Edit ${a.assetName}`}><Pencil className="w-3.5 h-3.5" /></button>{' '}
                      {canManage && <button type="button" className={dangerBtnCls} onClick={() => del(a)} aria-label={`Delete ${a.assetName}`}><Trash2 className="w-3.5 h-3.5" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <Modal
          title={isNew ? `Add asset to room ${room.roomNumber}` : `Edit ${editing.assetName}`}
          onClose={() => setEditing(null)}
          width="max-w-2xl"
          footer={<><button type="button" className={btnCls} onClick={() => setEditing(null)}>Cancel</button><button type="button" className={primaryBtnCls} disabled={saving} onClick={save}>{saving ? 'Saving…' : isNew ? 'Add asset' : 'Save'}</button></>}
        >
          <div className="space-y-3">
            {isNew && trackedItems.length > 0 && (
              <Field label="Start from a catalogue item (optional)" htmlFor="as_cat">
                <select id="as_cat" className={inputCls} value="" onChange={e => { const it = trackedItems.find(i => i.id === e.target.value); if (it) set({ assetName: it.itemName, category: it.category, supplier: it.supplier || editing.supplier, purchaseCost: it.unitCost ?? editing.purchaseCost }); }}>
                  <option value="">Choose…</option>
                  {trackedItems.map(i => <option key={i.id} value={i.id}>{i.itemName}</option>)}
                </select>
              </Field>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Asset name *" htmlFor="as_name" className="sm:col-span-2"><input id="as_name" className={inputCls} value={editing.assetName || ''} onChange={e => set({ assetName: e.target.value })} placeholder="e.g. Television 32 inch" /></Field>
              <Field label="Category" htmlFor="as_cat2">
                <input id="as_cat2" list="as_cats" className={inputCls} value={editing.category || ''} onChange={e => set({ category: e.target.value })} />
                <datalist id="as_cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Asset tag" htmlFor="as_tag"><input id="as_tag" className={inputCls} value={editing.assetTag || ''} onChange={e => set({ assetTag: e.target.value })} placeholder="Sticker / barcode" /></Field>
              <Field label="Serial number" htmlFor="as_sn"><input id="as_sn" className={inputCls} value={editing.serialNumber || ''} onChange={e => set({ serialNumber: e.target.value })} /></Field>
              <Field label="Location in room" htmlFor="as_loc"><input id="as_loc" className={inputCls} value={editing.locationDetail || ''} onChange={e => set({ locationDetail: e.target.value })} placeholder="e.g. Ceiling by the door" /></Field>
              <Field label="Manufacturer" htmlFor="as_man"><input id="as_man" className={inputCls} value={editing.manufacturer || ''} onChange={e => set({ manufacturer: e.target.value })} /></Field>
              <Field label="Model" htmlFor="as_mod"><input id="as_mod" className={inputCls} value={editing.model || ''} onChange={e => set({ model: e.target.value })} /></Field>
              <Field label="Supplier" htmlFor="as_sup"><input id="as_sup" className={inputCls} value={editing.supplier || ''} onChange={e => set({ supplier: e.target.value })} /></Field>
              <Field label="Condition" htmlFor="as_cond">
                <select id="as_cond" className={inputCls} value={editing.condition || 'Good'} onChange={e => set({ condition: e.target.value as PropertyAsset['condition'] })}>{ITEM_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}</select>
              </Field>
              <Field label="Status" htmlFor="as_status">
                <select id="as_status" className={inputCls} value={editing.status || 'Active'} onChange={e => set({ status: e.target.value as PropertyAsset['status'] })}>{['Active', 'In Repair', 'Retired'].map(c => <option key={c} value={c}>{c}</option>)}</select>
              </Field>
              <Field label="Purchase cost (£)" htmlFor="as_cost"><input id="as_cost" type="number" min={0} step="0.01" className={inputCls} value={editing.purchaseCost ?? ''} onChange={e => set({ purchaseCost: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
              <Field label="Purchase date" htmlFor="as_pd"><input id="as_pd" type="date" className={inputCls} value={dateInput(editing.purchaseDate)} onChange={e => set({ purchaseDate: e.target.value })} /></Field>
              <Field label="Warranty expiry" htmlFor="as_war"><input id="as_war" type="date" className={inputCls} value={dateInput(editing.warrantyExpiry)} onChange={e => set({ warrantyExpiry: e.target.value })} /></Field>
              <Field label="PAT tested on" htmlFor="as_pat"><input id="as_pat" type="date" className={inputCls} value={dateInput(editing.patTestDate)} onChange={e => set({ patTestDate: e.target.value })} /></Field>
              <Field label="PAT next due" htmlFor="as_patn"><input id="as_patn" type="date" className={inputCls} value={dateInput(editing.patNextDue)} onChange={e => set({ patNextDue: e.target.value })} /></Field>
              <Field label="Last serviced" htmlFor="as_ls"><input id="as_ls" type="date" className={inputCls} value={dateInput(editing.lastServiceDate)} onChange={e => set({ lastServiceDate: e.target.value })} /></Field>
              <Field label="Next service due" htmlFor="as_ns"><input id="as_ns" type="date" className={inputCls} value={dateInput(editing.nextServiceDue)} onChange={e => set({ nextServiceDue: e.target.value })} /></Field>
            </div>
            <Field label="Notes" htmlFor="as_notes"><textarea id="as_notes" rows={2} className={inputCls} value={editing.notes || ''} onChange={e => set({ notes: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
};
