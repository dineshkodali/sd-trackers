/**
 * StockLedgerPanel — every movement of stock for a property: deliveries, issues to rooms, returns,
 * transfers, damage, losses and stock counts.
 */

import React, { useMemo, useState } from 'react';
import { Download, ScrollText } from 'lucide-react';
import { exportTableToCsv } from '../../utils/csvExport';
import type { PropertyRoom } from '../../types/masterData';
import { MOVEMENT_TYPES, type InventoryMovement } from '../../types/roomManagement';
import { Card, Chip, EmptyState, btnCls, fmtDateTime, inputCls, type Tone } from './roomUi';

const TONE: Record<string, Tone> = {
  Purchase: 'green', 'Issue to Room': 'blue', 'Return to Stock': 'teal', 'Room Transfer': 'purple', Damaged: 'amber', Lost: 'red', Disposed: 'grey', 'Stock Count': 'neutral',
};

export const StockLedgerPanel: React.FC<{ propertyName: string; movements: InventoryMovement[]; rooms: PropertyRoom[] }> = ({ propertyName, movements, rooms }) => {
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const roomLabel = (id?: string) => (id ? `Room ${rooms.find(r => r.id === id)?.roomNumber || '?'}` : '');
  const shown = useMemo(() => movements
    .filter(m => type === 'all' || m.movementType === type)
    .filter(m => !search || `${m.itemName} ${m.reason || ''} ${m.reference || ''} ${m.performedByName || ''} ${roomLabel(m.fromRoomId)} ${roomLabel(m.toRoomId)}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => String(b.performedAt || '').localeCompare(String(a.performedAt || ''))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [movements, type, search, rooms]);

  const exportCsv = () => exportTableToCsv({
    filename: `stock-ledger-${propertyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
    headers: ['When', 'Type', 'Item', 'Quantity', 'From', 'To', 'Reference', 'Reason', 'By'],
    rows: shown.map(m => [m.performedAt || '', m.movementType, m.itemName, m.quantity, roomLabel(m.fromRoomId), roomLabel(m.toRoomId), m.reference || '', m.reason || '', m.performedByName || '']),
  });

  return (
    <Card title={<><ScrollText className="w-3.5 h-3.5 text-[#0d9488]" /> Stock ledger &middot; {propertyName}</>} actions={<button type="button" className={btnCls} onClick={exportCsv} disabled={shown.length === 0}><Download className="w-3.5 h-3.5" /> Export</button>}>
      <div className="flex flex-wrap gap-2 mb-2">
        <input aria-label="Search the ledger" className={`${inputCls} !w-56`} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="Movement type" className={`${inputCls} !w-44`} value={type} onChange={e => setType(e.target.value)}><option value="all">All movements</option>{MOVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
      </div>
      {shown.length === 0 ? <EmptyState icon={<ScrollText className="w-8 h-8" />} title="No movements yet" hint="Receiving stock, issuing items to rooms, returns and counts all appear here." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[760px]">
            <thead><tr className="text-left text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]"><th className="py-1 pr-2">When</th><th className="py-1 pr-2">Movement</th><th className="py-1 pr-2">Item</th><th className="py-1 pr-2 text-right">Qty</th><th className="py-1 pr-2">From → To</th><th className="py-1 pr-2">Reason / ref</th><th className="py-1">By</th></tr></thead>
            <tbody>
              {shown.slice(0, 500).map(m => (
                <tr key={m.id} className="border-b border-[#f1f5f9] align-top">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDateTime(m.performedAt)}</td>
                  <td className="py-1.5 pr-2"><Chip tone={TONE[m.movementType] || 'neutral'}>{m.movementType}</Chip></td>
                  <td className="py-1.5 pr-2 font-semibold text-[#1e293b]">{m.itemName}</td>
                  <td className="py-1.5 pr-2 text-right font-semibold">{m.movementType === 'Stock Count' && m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                  <td className="py-1.5 pr-2">{[m.fromRoomId ? roomLabel(m.fromRoomId) : 'Store', m.toRoomId ? roomLabel(m.toRoomId) : (['Return to Stock'].includes(m.movementType) ? 'Store' : '—')].join(' → ')}</td>
                  <td className="py-1.5 pr-2 text-[#475569]">{m.reason || ''}{m.reference ? ` (${m.reference})` : ''}</td>
                  <td className="py-1.5 text-[#64748b]">{m.performedByName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > 500 && <p className="text-[10px] text-neutral-500 mt-1">Showing the latest 500 of {shown.length}. Export for the full list.</p>}
        </div>
      )}
    </Card>
  );
};
