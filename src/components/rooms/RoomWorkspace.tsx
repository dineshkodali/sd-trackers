/**
 * RoomWorkspace — one room opened on its own: overview, beds & residents, assets, inventory, issues,
 * room checks and the full timeline.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BedDouble, ChevronLeft, ChevronRight, ClipboardList, DoorOpen, History, LayoutDashboard, Package, Wrench, AlertTriangle, X } from 'lucide-react';
import { suPropertyService } from '../../services/suPropertyService';
import type { PropertyMaster, PropertyRoom } from '../../types/masterData';
import { roomFlags } from '../../utils/roomManagementLogic';
import { useRoomData } from './useRoomData';
import { Chip, cleaningTone, roomStatusTone, useToast } from './roomUi';
import { OverviewTab } from './tabs/OverviewTab';
import { BedsTab } from './tabs/BedsTab';
import { AssetsTab } from './tabs/AssetsTab';
import { InventoryTab } from './tabs/InventoryTab';
import { IssuesTab } from './tabs/IssuesTab';
import { ChecksTab } from './tabs/ChecksTab';
import { TimelineTab } from './tabs/TimelineTab';

type TabId = 'overview' | 'beds' | 'assets' | 'inventory' | 'issues' | 'checks' | 'timeline';

interface Props {
  room: PropertyRoom;
  property?: PropertyMaster;
  allRooms: PropertyRoom[];
  actor: string;
  canManage: boolean;
  /** the rooms shown in the list behind, in order, for previous / next */
  neighbours?: PropertyRoom[];
  onOpenRoom?: (room: PropertyRoom) => void;
  /** called after anything changed so the list behind can reload */
  onChanged: () => void | Promise<void>;
  onClose: () => void;
}

export const RoomWorkspace: React.FC<Props> = ({ room: initial, property, allRooms, actor, canManage, neighbours = [], onOpenRoom, onChanged, onClose }) => {
  const [room, setRoom] = useState<PropertyRoom>(initial);
  const [tab, setTab] = useState<TabId>('overview');
  const { show, node } = useToast();
  const data = useRoomData(room);

  useEffect(() => { setRoom(initial); setTab('overview'); }, [initial.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === 'Escape' && !(t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) && !document.querySelector('[role="dialog"]')) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const refresh = useCallback(async () => {
    const fresh = await suPropertyService.getRoom(room.id);
    if (fresh.success && fresh.data) setRoom(fresh.data);
    await data.reload();
    await onChanged();
  }, [room.id, data, onChanged]);

  const flags = useMemo(() => roomFlags(room, { placements: data.placements, beds: data.beds, items: data.items, issues: data.issues }), [room, data.placements, data.beds, data.items, data.issues]);
  const critical = flags.filter(f => f.level === 'critical').length;
  const activeResidents = data.placements.filter(p => p.status === 'Active').length;
  const units = data.items.filter(i => i.status === 'In Room').reduce((n, i) => n + i.quantity, 0);
  const openIssues = data.issues.filter(i => i.status === 'Open' || i.status === 'In Progress').length;

  const idx = neighbours.findIndex(r => r.id === room.id);
  const prev = idx > 0 ? neighbours[idx - 1] : undefined;
  const next = idx >= 0 && idx < neighbours.length - 1 ? neighbours[idx + 1] : undefined;

  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" />, badge: flags.length || undefined },
    { id: 'beds', label: 'Beds & Residents', icon: <BedDouble className="w-3.5 h-3.5" />, badge: `${activeResidents}/${room.capacity || 1}` },
    { id: 'assets', label: 'Assets', icon: <Wrench className="w-3.5 h-3.5" />, badge: data.assets.length || undefined },
    { id: 'inventory', label: 'Inventory', icon: <Package className="w-3.5 h-3.5" />, badge: units || undefined },
    { id: 'issues', label: 'Issues', icon: <AlertTriangle className="w-3.5 h-3.5" />, badge: openIssues || undefined },
    { id: 'checks', label: 'Room Checks', icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { id: 'timeline', label: 'Timeline', icon: <History className="w-3.5 h-3.5" /> },
  ];

  const tabProps = { room, property, data, allRooms, actor, canManage, refresh, toast: show, close: () => { void onChanged(); onClose(); } };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs flex items-stretch justify-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="region" aria-label={`Room ${room.roomNumber}`} className="bg-[#f8fafc] w-full max-w-6xl sm:rounded-xs shadow-2xl border border-[#cbd5e1] flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-[#e2e8f0] px-4 py-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-[#f0fdfa] border border-[#99f6e4] rounded-xs"><DoorOpen className="w-5 h-5 text-[#0d9488]" /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-[#1e293b]">Room {room.roomNumber}{room.roomName && room.roomName !== `Room ${room.roomNumber}` ? ` — ${room.roomName}` : ''}</h2>
                  <Chip tone={roomStatusTone(room.status)}>{room.status}</Chip>
                  <Chip tone={cleaningTone(room.cleaningStatus)}>{room.cleaningStatus || 'Clean'}</Chip>
                  {critical > 0 && <Chip tone="red">{critical} urgent</Chip>}
                </div>
                <p className="text-[11px] text-[#64748b] truncate">{property?.propertyName || 'Property'} &middot; {room.roomType} &middot; {room.floor || 'Ground'} floor &middot; {room.capacity || 1} bed{(room.capacity || 1) > 1 ? 's' : ''} &middot; {room.roomReference}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {neighbours.length > 1 && onOpenRoom && (
                <>
                  <button type="button" aria-label="Previous room" disabled={!prev} onClick={() => prev && onOpenRoom(prev)} className="p-1.5 border border-[#cbd5e1] rounded-xs hover:bg-[#f0fdfa] disabled:opacity-40 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                  <button type="button" aria-label="Next room" disabled={!next} onClick={() => next && onOpenRoom(next)} className="p-1.5 border border-[#cbd5e1] rounded-xs hover:bg-[#f0fdfa] disabled:opacity-40 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                </>
              )}
              <button type="button" aria-label="Close room" onClick={onClose} className="p-1.5 border border-[#cbd5e1] rounded-xs hover:bg-red-50 hover:text-red-700 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div role="tablist" className="flex items-center gap-1 mt-3 overflow-x-auto -mb-px">
            {tabs.map(t => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 whitespace-nowrap cursor-pointer ${tab === t.id ? 'border-[#0d9488] text-[#0d9488]' : 'border-transparent text-[#64748b] hover:text-[#1e293b]'}`}>
                {t.icon}<span>{t.label}</span>
                {t.badge !== undefined && <span className={`text-[10px] px-1.5 rounded-full ${tab === t.id ? 'bg-[#0d9488] text-white' : 'bg-[#e2e8f0] text-[#475569]'}`}>{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {data.error && <div className="mb-3 p-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-xs text-xs">Some room data could not be loaded: {data.error}</div>}
          {data.loading && data.items.length === 0 && data.beds.length === 0 ? (
            <div className="text-center py-12 text-xs text-neutral-500">Loading room…</div>
          ) : (
            <>
              {tab === 'overview' && <OverviewTab {...tabProps} />}
              {tab === 'beds' && <BedsTab {...tabProps} />}
              {tab === 'assets' && <AssetsTab {...tabProps} />}
              {tab === 'inventory' && <InventoryTab {...tabProps} />}
              {tab === 'issues' && <IssuesTab {...tabProps} />}
              {tab === 'checks' && <ChecksTab {...tabProps} />}
              {tab === 'timeline' && <TimelineTab {...tabProps} />}
            </>
          )}
        </div>
      </div>
      {node}
    </div>
  );
};
