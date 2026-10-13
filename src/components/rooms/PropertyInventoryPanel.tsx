/**
 * PropertyInventoryPanel — the COMMON inventory of one property: what is held in store, what is already
 * placed in rooms, and what is running low. Deliveries and stock counts are recorded here.
 */

import React, { useMemo, useState } from 'react';
import { Download, PackagePlus, Pencil } from 'lucide-react';
import { roomManagementService } from '../../services/roomManagementService';
import { exportTableToCsv } from '../../utils/csvExport';
import { ITEM_CATEGORIES, type InventoryItem, type PropertyStock, type RoomItem } from '../../types/roomManagement';
import { stockLevel } from '../../utils/roomManagementLogic';
import { Card, Chip, EmptyState, Field, Modal, Stat, btnCls, inputCls, primaryBtnCls } from './roomUi';

interface Props {
  propertyId: string;
  propertyName: string;
  catalogue: InventoryItem[];
  catalogueIsStarter: boolean;
  stock: PropertyStock[];
  roomItems: RoomItem[];
  actor: string;
  onChanged: () => Promise<void>;
  toast: (m: string, t?: 'success' | 'error' | 'info') => void;
}

type Dialog = { kind: 'receive' | 'count'; item?: InventoryItem } | null;

export const PropertyInventoryPanel: React.FC<Props> = ({ propertyId, propertyName, catalogue, catalogueIsStarter, stock, roomItems, actor, onChanged, toast }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [onlyLow, setOnlyLow] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  const rows = useMemo(() => catalogue.filter(i => i.isActive !== false).map(item => {
    const s = stock.filter(x => x.itemId === item.id);
    const onHand = s.reduce((n, x) => n + x.quantityOnHand, 0);
    const minimum = Math.max(0, ...s.map(x => x.minimumLevel || 0));
    const inRooms = roomItems.filter(r => r.itemId === item.id && r.status === 'In Room').reduce((n, r) => n + r.quantity, 0);
    const damaged = roomItems.filter(r => r.itemId === item.id && r.status === 'Damaged').reduce((n, r) => n + r.quantity, 0);
    const missing = roomItems.filter(r => r.itemId === item.id && r.status === 'Missing').reduce((n, r) => n + r.quantity, 0);
    return { item, stockRow: s[0], onHand, minimum, inRooms, damaged, missing, level: s[0] ? stockLevel({ quantityOnHand: onHand, minimumLevel: minimum }) : (inRooms > 0 ? 'out' as const : 'ok' as const) };
  }), [catalogue, stock, roomItems]);

  const categories = useMemo(() => Array.from(new Set([...ITEM_CATEGORIES, ...catalogue.map(i => i.category)])), [catalogue]);
  const shown = rows
    .filter(r => category === 'all' || r.item.category === category)
    .filter(r => !search || `${r.item.itemName} ${r.item.itemCode || ''} ${r.item.category}`.toLowerCase().includes(search.toLowerCase()))
    .filter(r => !onlyLow || r.level !== 'ok');

  const low = rows.filter(r => r.stockRow && r.level === 'low').length;
  const out = rows.filter(r => r.stockRow && r.level === 'out').length;
  const totalStock = rows.reduce((n, r) => n + r.onHand, 0);
  const totalRooms = rows.reduce((n, r) => n + r.inRooms, 0);

  const exportCsv = () => exportTableToCsv({
    filename: `inventory-${propertyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
    headers: ['Item code', 'Item', 'Category', 'Type', 'In stock', 'Minimum', 'In rooms', 'Damaged', 'Missing', 'Storage location'],
    rows: rows.map(r => [r.item.itemCode || '', r.item.itemName, r.item.category, r.item.itemType, r.onHand, r.minimum, r.inRooms, r.damaged, r.missing, r.stockRow?.storageLocation || '']),
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="Item types" value={rows.length} />
        <Stat label="Units in store" value={totalStock} />
        <Stat label="Units in rooms" value={totalRooms} />
        <Stat label="Running low" value={low} tone={low ? 'amber' : 'neutral'} />
        <Stat label="Out of stock" value={out} tone={out ? 'red' : 'neutral'} />
      </div>

      <Card
        title={<>Common inventory &middot; {propertyName}</>}
        actions={<><button type="button" className={btnCls} onClick={exportCsv}><Download className="w-3.5 h-3.5" /> Export</button><button type="button" className={primaryBtnCls} onClick={() => setDialog({ kind: 'receive' })}><PackagePlus className="w-3.5 h-3.5" /> Receive stock</button></>}
      >
        <p className="text-[11px] text-[#64748b] mb-2">Stock held in this property's store. Items are issued from here into rooms (Room &rarr; Inventory) and can be returned. Everything that moves is written to the Stock Ledger.</p>
        {catalogueIsStarter && <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-300 rounded-xs px-2 py-1 mb-2">The catalogue has not been saved to the database yet. Open <b>Catalogue &amp; Kits</b> and press &ldquo;Save starter catalogue&rdquo; first.</p>}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input aria-label="Search inventory" className={`${inputCls} !w-52`} placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
          <select aria-label="Category" className={`${inputCls} !w-40`} value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs"><input type="checkbox" className="accent-[#0d9488]" checked={onlyLow} onChange={e => setOnlyLow(e.target.checked)} /> Low / out of stock only</label>
        </div>
        {shown.length === 0 ? <EmptyState title="Nothing to show" hint="Receive stock to start tracking it, or change the filters." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[820px]">
              <thead><tr className="text-left text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                <th className="py-1 pr-2">Item</th><th className="py-1 pr-2">Type</th><th className="py-1 pr-2 text-right">In store</th><th className="py-1 pr-2 text-right">Min</th>
                <th className="py-1 pr-2 text-right">In rooms</th><th className="py-1 pr-2 text-right">Damaged / missing</th><th className="py-1 pr-2">Level</th><th className="py-1" />
              </tr></thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.item.id} className="border-b border-[#f1f5f9]">
                    <td className="py-1.5 pr-2"><div className="font-semibold text-[#1e293b]">{r.item.itemName}</div><div className="text-[10px] text-[#64748b]">{r.item.itemCode ? `${r.item.itemCode} · ` : ''}{r.item.category}{r.stockRow?.storageLocation ? ` · ${r.stockRow.storageLocation}` : ''}</div></td>
                    <td className="py-1.5 pr-2"><Chip tone={r.item.itemType === 'Asset' ? 'blue' : 'neutral'}>{r.item.itemType === 'Asset' ? 'Tracked' : 'Counted'}</Chip></td>
                    <td className="py-1.5 pr-2 text-right font-semibold">{r.onHand}</td>
                    <td className="py-1.5 pr-2 text-right">{r.minimum || '—'}</td>
                    <td className="py-1.5 pr-2 text-right">{r.inRooms}</td>
                    <td className="py-1.5 pr-2 text-right">{r.damaged || r.missing ? <span className="text-amber-800">{r.damaged} / <span className="text-red-700">{r.missing}</span></span> : '—'}</td>
                    <td className="py-1.5 pr-2">{r.stockRow ? <Chip tone={r.level === 'ok' ? 'green' : r.level === 'low' ? 'amber' : 'red'}>{r.level === 'ok' ? 'OK' : r.level === 'low' ? 'Low' : 'Out'}</Chip> : <span className="text-neutral-400">Not stocked</span>}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <button type="button" className={btnCls} onClick={() => setDialog({ kind: 'receive', item: r.item })}>Receive</button>{' '}
                      <button type="button" className={btnCls} aria-label={`Count ${r.item.itemName}`} onClick={() => setDialog({ kind: 'count', item: r.item })}><Pencil className="w-3.5 h-3.5" /> Count</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dialog?.kind === 'receive' && <ReceiveModal propertyId={propertyId} catalogue={catalogue} item={dialog.item} actor={actor} onClose={() => setDialog(null)} onDone={async msg => { toast(msg); setDialog(null); await onChanged(); }} onError={m => toast(m, 'error')} />}
      {dialog?.kind === 'count' && dialog.item && <CountModal propertyId={propertyId} item={dialog.item} row={stock.find(s => s.itemId === dialog.item!.id)} actor={actor} onClose={() => setDialog(null)} onDone={async msg => { toast(msg); setDialog(null); await onChanged(); }} onError={m => toast(m, 'error')} />}
    </div>
  );
};

const ReceiveModal: React.FC<{ propertyId: string; catalogue: InventoryItem[]; item?: InventoryItem; actor: string; onClose: () => void; onDone: (m: string) => Promise<void>; onError: (m: string) => void }> = ({ propertyId, catalogue, item, actor, onClose, onDone, onError }) => {
  const [itemId, setItemId] = useState(item?.id || '');
  const [qty, setQty] = useState(1);
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const chosen = catalogue.find(i => i.id === itemId);
  const submit = async () => {
    if (!chosen) { onError('Choose an item.'); return; }
    setBusy(true);
    try {
      const r = await roomManagementService.receiveStock({ propertyId, item: chosen, quantity: qty, reference, reason, actor });
      if (r.success) await onDone(`${qty} × ${chosen.itemName} added to stock${r.warning ? ` (${r.warning})` : ''}`); else onError(r.error || 'Could not add the stock.');
    } finally { setBusy(false); }
  };
  return (
    <Modal title="Receive stock" onClose={onClose} footer={<><button type="button" className={btnCls} onClick={onClose}>Cancel</button><button type="button" className={primaryBtnCls} disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Add to stock'}</button></>}>
      <div className="space-y-3">
        <Field label="Item" htmlFor="rc_item"><select id="rc_item" className={inputCls} value={itemId} disabled={!!item} onChange={e => setItemId(e.target.value)}><option value="">Choose…</option>{catalogue.filter(i => i.isActive !== false).map(i => <option key={i.id} value={i.id}>{i.itemName} — {i.category}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity received" htmlFor="rc_qty"><input id="rc_qty" type="number" min={1} className={inputCls} value={qty} onChange={e => setQty(Number(e.target.value))} /></Field>
          <Field label="Delivery note / PO ref" htmlFor="rc_ref"><input id="rc_ref" className={inputCls} value={reference} onChange={e => setReference(e.target.value)} /></Field>
        </div>
        <Field label="Note" htmlFor="rc_reason"><input id="rc_reason" className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Delivery from supplier" /></Field>
      </div>
    </Modal>
  );
};

const CountModal: React.FC<{ propertyId: string; item: InventoryItem; row?: PropertyStock; actor: string; onClose: () => void; onDone: (m: string) => Promise<void>; onError: (m: string) => void }> = ({ propertyId, item, row, actor, onClose, onDone, onError }) => {
  const [counted, setCounted] = useState(row?.quantityOnHand ?? 0);
  const [minimum, setMinimum] = useState(row?.minimumLevel ?? item.reorderLevel ?? 0);
  const [location, setLocation] = useState(row?.storageLocation || '');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await roomManagementService.setStockCount({ propertyId, item, counted, minimumLevel: minimum, storageLocation: location, actor });
      if (r.success) await onDone(`${item.itemName}: counted ${counted}${r.warning ? ` (${r.warning})` : ''}`); else onError(r.error || 'Could not save the count.');
    } finally { setBusy(false); }
  };
  return (
    <Modal title={`Stock count: ${item.itemName}`} onClose={onClose} footer={<><button type="button" className={btnCls} onClick={onClose}>Cancel</button><button type="button" className={primaryBtnCls} disabled={busy} onClick={submit}>Save count</button></>}>
      <div className="space-y-3">
        <p className="text-[#64748b]">Enter what is actually on the shelf now. The difference from the system figure ({row?.quantityOnHand ?? 0}) is written to the ledger.</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Counted" htmlFor="ct_q"><input id="ct_q" type="number" min={0} className={inputCls} value={counted} onChange={e => setCounted(Number(e.target.value))} /></Field>
          <Field label="Minimum level" htmlFor="ct_m"><input id="ct_m" type="number" min={0} className={inputCls} value={minimum} onChange={e => setMinimum(Number(e.target.value))} /></Field>
          <Field label="Stored in" htmlFor="ct_l"><input id="ct_l" className={inputCls} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Store room" /></Field>
        </div>
      </div>
    </Modal>
  );
};
