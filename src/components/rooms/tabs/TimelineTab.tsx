import React, { useMemo, useState } from 'react';
import { History, Send } from 'lucide-react';
import { roomManagementService } from '../../../services/roomManagementService';
import { residentName } from '../useRoomData';
import { Card, Chip, EmptyState, btnCls, fmtDateTime, inputCls, primaryBtnCls, type Tone } from '../roomUi';
import type { RoomTabProps } from './tabTypes';

interface Event {
  id: string;
  at: string;
  type: string;
  title: string;
  details?: string;
  by?: string;
}
const TYPE_TONE: Record<string, Tone> = {
  Note: 'neutral', 'Status Change': 'purple', Cleaning: 'teal', Inspection: 'blue', Maintenance: 'amber', Inventory: 'green', Placement: 'purple', Issue: 'red',
};

export const TimelineTab: React.FC<RoomTabProps> = ({ room, data, actor, refresh, toast }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('All');

  const events = useMemo<Event[]>(() => {
    const out: Event[] = data.activity.map(a => ({ id: `a-${a.id}`, at: a.performedAt || a.createdAt || '', type: a.activityType, title: a.title || a.activityType, details: a.details, by: a.performedByName }));
    for (const p of data.placements) {
      const who = residentName(data.suById.get(p.suId), p.suId);
      if (p.startDate) out.push({ id: `ps-${p.id}`, at: p.startDate, type: 'Placement', title: `${who} moved in`, details: p.placementType });
      if (p.endDate) out.push({ id: `pe-${p.id}`, at: p.endDate, type: 'Placement', title: `${who} left`, details: p.reason || p.status });
    }
    return out.filter(e => e.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }, [data.activity, data.placements, data.suById]);

  const types = ['All', ...Array.from(new Set(events.map(e => e.type)))];
  const shown = events.filter(e => filter === 'All' || e.type === filter);

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await roomManagementService.logActivity({ propertyId: room.propertyId, roomId: room.id, activityType: 'Note', title: note.trim(), actor });
      setNote('');
      toast('Note added');
      await refresh();
    } catch { toast('Could not add the note.', 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <Card title="Add a note">
        <div className="flex gap-2">
          <input aria-label="Note" className={inputCls} value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void addNote(); }} placeholder="e.g. Resident reported a noise from the pipes; plumber booked Thursday" />
          <button type="button" className={primaryBtnCls} disabled={busy || !note.trim()} onClick={addNote}><Send className="w-3.5 h-3.5" /> Add</button>
        </div>
      </Card>
      <Card title={<><History className="w-3.5 h-3.5 text-[#0d9488]" /> Room history ({shown.length})</>}
        actions={<div className="flex gap-1 flex-wrap justify-end">{types.map(t => <button key={t} type="button" className={`${btnCls} ${filter === t ? '!bg-[#0d9488] !text-white !border-[#0d9488]' : ''}`} onClick={() => setFilter(t)}>{t}</button>)}</div>}>
        {shown.length === 0 ? <EmptyState icon={<History className="w-8 h-8" />} title="Nothing recorded yet" hint="Status changes, cleaning, inspections, items, issues and residents moving in and out all appear here." /> : (
          <ol className="relative border-l-2 border-[#e2e8f0] ml-2 space-y-3">
            {shown.slice(0, 300).map(e => (
              <li key={e.id} className="ml-3">
                <span className="absolute -left-[5px] mt-1.5 w-2 h-2 rounded-full bg-[#0d9488]" />
                <div className="flex items-center gap-2 flex-wrap"><Chip tone={TYPE_TONE[e.type] || 'neutral'}>{e.type}</Chip><span className="text-xs font-semibold text-[#1e293b]">{e.title}</span></div>
                <div className="text-[10px] text-[#64748b]">{fmtDateTime(e.at)}{e.by ? ` · ${e.by}` : ''}</div>
                {e.details && <div className="text-[11px] text-[#475569]">{e.details}</div>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
};
