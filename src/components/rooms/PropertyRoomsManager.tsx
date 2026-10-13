/**
 * PropertyRoomsManager — the "Rooms" tab of a property: full room management for that property.
 *
 *   Rooms              every room with occupancy, beds, status, cleaning, issues, items. Open one to manage it on
 *                      its own (beds & residents, assets, inventory, issues, checks, timeline).
 *   Common Inventory   what this property holds in store, deliveries, stock counts, low-stock warnings.
 *   Catalogue & Kits   the item catalogue and standard room kits (shared by all properties).
 *   Stock Ledger       every stock movement at this property.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BedDouble, Boxes, DoorOpen, Package, Plus, RefreshCw, ScrollText, Search, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suPropertyService } from '../../services/suPropertyService';
import { roomManagementService } from '../../services/roomManagementService';
import type { Placement, PropertyMaster, PropertyRoom } from '../../types/masterData';
import { ROOM_STATUSES, type InventoryItem, type InventoryMovement, type PropertyStock, type RoomBed, type RoomIssue, type RoomItem, type RoomKitTemplate } from '../../types/roomManagement';
import { isOutOfUse, isPlaceholderRoom, propertyOccupancy, roomFlags } from '../../utils/roomManagementLogic';
import { Pagination } from '../common/Pagination';
import { AddRoomsModal } from './AddRoomsModal';
import { CatalogueKitsPanel } from './CatalogueKitsPanel';
import { PropertyInventoryPanel } from './PropertyInventoryPanel';
import { RoomWorkspace } from './RoomWorkspace';
import { StockLedgerPanel } from './StockLedgerPanel';
import { Card, Chip, EmptyState, Stat, btnCls, cleaningTone, dangerBtnCls, inputCls, primaryBtnCls, roomStatusTone, useToast } from './roomUi';

type TabId = 'rooms' | 'inventory' | 'catalogue' | 'ledger';
const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

interface Props {
  property: PropertyMaster;
  /** bump this number to open the "Add rooms" dialog (used by shortcuts elsewhere on the property page) */
  addSignal?: number;
  /** called after anything changed so the property page can refresh its counts */
  onChanged?: () => void;
}

export const PropertyRoomsManager: React.FC<Props> = ({ property, addSignal = 0, onChanged }) => {
  const { canManageProperties, authProfile, currentUserName, requestConfirmation } = useApp();
  const canManage = canManageProperties();
  const actor = authProfile?.name || currentUserName || 'Staff Member';
  const { show, node } = useToast();
  const propertyId = property.id;

  const [tab, setTab] = useState<TabId>('rooms');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<PropertyRoom[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [beds, setBeds] = useState<RoomBed[]>([]);
  const [items, setItems] = useState<RoomItem[]>([]);
  const [issues, setIssues] = useState<RoomIssue[]>([]);
  const [catalogue, setCatalogue] = useState<InventoryItem[]>([]);
  const [catalogueIsStarter, setCatalogueIsStarter] = useState(false);
  const [kits, setKits] = useState<RoomKitTemplate[]>([]);
  const [stock, setStock] = useState<PropertyStock[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [roomsRes, plcRes, bedsRes, itemsRes, issuesRes, catRes, kitRes, stockRes, movRes] = await Promise.all([
        suPropertyService.getRooms(propertyId),
        suPropertyService.getPlacements({ status: 'Active', propertyId }),
        roomManagementService.getBeds({ propertyId }),
        roomManagementService.getRoomItems({ propertyId }),
        roomManagementService.getIssues({ propertyId }),
        roomManagementService.getCatalogue(),
        roomManagementService.getKits(),
        roomManagementService.getStock(propertyId),
        roomManagementService.getMovements({ propertyId }),
      ]);
      const err = [roomsRes, plcRes].find(r => !r.success)?.error;
      if (err) setLoadError(err);
      setRooms(roomsRes.data || []);
      setPlacements(plcRes.data || []);
      setBeds(bedsRes.data);
      setItems(itemsRes.data);
      setIssues(issuesRes.data);
      setCatalogue(catRes.data);
      setCatalogueIsStarter(catRes.isStarter);
      setKits(kitRes.data);
      setStock(stockRes.data);
      setMovements(movRes.data);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load rooms.');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { setLoading(true); setSelectedIds([]); setOpenRoomId(null); void load(); }, [load]);

  // placements / rooms edited elsewhere (Service Users) refresh this tab too
  useEffect(() => {
    const h = () => { void load(); };
    window.addEventListener('sdtracker:masterDataUpdated', h);
    return () => window.removeEventListener('sdtracker:masterDataUpdated', h);
  }, [load]);

  // shortcut elsewhere on the property page ("Add Room")
  useEffect(() => { if (addSignal > 0 && canManage) { setTab('rooms'); setShowAdd(true); } }, [addSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  /** reload this tab and tell the property page its numbers changed */
  const refreshAll = useCallback(async () => { await load(); onChanged?.(); }, [load, onChanged]);

  const perRoom = useMemo(() => {
    const map = new Map<string, { residents: Placement[]; beds: RoomBed[]; items: RoomItem[]; issues: RoomIssue[] }>();
    const get = (id: string) => { let v = map.get(id); if (!v) { v = { residents: [], beds: [], items: [], issues: [] }; map.set(id, v); } return v; };
    placements.forEach(p => get(p.roomId).residents.push(p));
    beds.forEach(b => get(b.roomId).beds.push(b));
    items.forEach(i => get(i.roomId).items.push(i));
    issues.forEach(i => get(i.roomId).issues.push(i));
    return map;
  }, [placements, beds, items, issues]);

  const rows = useMemo(() => rooms.map(room => {
    const d = perRoom.get(room.id) || { residents: [], beds: [], items: [], issues: [] };
    const flags = roomFlags(room, { placements: d.residents, beds: d.beds, items: d.items, issues: d.issues });
    return { room, ...d, flags, units: d.items.filter(i => i.status === 'In Room').reduce((n, i) => n + i.quantity, 0), openIssues: d.issues.filter(i => i.status === 'Open' || i.status === 'In Progress').length };
  }), [rooms, perRoom]);

  const floors = useMemo(() => Array.from(new Set(rooms.map(r => r.floor || 'Ground'))).sort(naturalCompare), [rooms]);
  const types = useMemo(() => Array.from(new Set(rooms.map(r => r.roomType).filter(Boolean))).sort(naturalCompare), [rooms]);

  const filtered = useMemo(() => rows
    .filter(r => statusFilter === 'all' || r.room.status === statusFilter || (statusFilter === 'Out of use' && isOutOfUse(r.room.status)))
    .filter(r => floorFilter === 'all' || (r.room.floor || 'Ground') === floorFilter)
    .filter(r => typeFilter === 'all' || r.room.roomType === typeFilter)
    .filter(r => !attentionOnly || r.flags.some(f => f.level !== 'info'))
    .filter(r => !search || `${r.room.roomNumber} ${r.room.roomName || ''} ${r.room.roomType} ${r.room.roomReference || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => naturalCompare(String(a.room.roomNumber), String(b.room.roomNumber))),
  [rows, statusFilter, floorFilter, typeFilter, attentionOnly, search]);

  useEffect(() => { setPage(1); }, [search, statusFilter, floorFilter, typeFilter, attentionOnly, pageSize]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  // every figure comes from the real rooms and active placements (see propertyOccupancy)
  const occ = useMemo(() => propertyOccupancy(rooms, placements), [rooms, placements]);
  const roll = { rooms: occ.rooms, beds: occ.beds, residents: occ.residents, occupancyPct: occ.occupancyPct, available: occ.roomsAvailable, partially: occ.roomsPartial, outOfUse: occ.outOfUse };

  // placeholder rooms left over from the old demo-data generator: they are not real accommodation but would count as bed spaces
  const placeholderRooms = useMemo(() => rooms.filter(isPlaceholderRoom), [rooms]);
  const removablePlaceholders = useMemo(() => placeholderRooms.filter(r => {
    const d = perRoom.get(r.id);
    return !d || (d.residents.length === 0 && d.beds.length === 0 && d.items.length === 0 && d.issues.length === 0);
  }), [placeholderRooms, perRoom]);
  const removePlaceholders = () => requestConfirmation({
    title: `Remove ${removablePlaceholders.length} placeholder room${removablePlaceholders.length > 1 ? 's' : ''}?`,
    message: `These rooms were generated automatically as demo data (${removablePlaceholders.map(r => r.roomNumber).join(', ')}). They have no residents, beds, items or issues. Removing them stops them counting as bed spaces. This cannot be undone.`,
    isDanger: true,
    onConfirm: async () => {
      let failed = 0;
      for (const r of removablePlaceholders) { const res = await suPropertyService.deleteRoom(r.id); if (!res.success) failed++; }
      show(failed ? `${failed} room(s) could not be removed.` : 'Placeholder rooms removed', failed ? 'error' : 'success');
      await refreshAll();
    },
  });
  const attention = rows.filter(r => r.flags.some(f => f.level !== 'info')).length;
  const openIssueTotal = rows.reduce((n, r) => n + r.openIssues, 0);
  const openRoom = openRoomId ? rooms.find(r => r.id === openRoomId) : undefined;

  const allSelected = paged.length > 0 && paged.every(r => selectedIds.includes(r.room.id));
  const toggleAll = () => setSelectedIds(allSelected ? selectedIds.filter(id => !paged.some(r => r.room.id === id)) : Array.from(new Set([...selectedIds, ...paged.map(r => r.room.id)])));

  const deleteSelected = () => {
    const withResidents = rows.filter(r => selectedIds.includes(r.room.id) && r.residents.length > 0);
    if (withResidents.length > 0) { show(`Room${withResidents.length > 1 ? 's' : ''} ${withResidents.map(r => r.room.roomNumber).join(', ')} still ha${withResidents.length > 1 ? 've' : 's'} residents. Move them out first.`, 'error'); return; }
    requestConfirmation({
      title: `Delete ${selectedIds.length} room${selectedIds.length > 1 ? 's' : ''}?`,
      message: 'This permanently deletes the selected rooms with their beds, item records, issues and timeline. Stock movements keep their history. This cannot be undone.',
      isDanger: true,
      onConfirm: async () => {
        let failed = 0;
        for (const id of selectedIds) { const r = await suPropertyService.deleteRoom(id); if (!r.success) failed++; }
        setSelectedIds([]);
        show(failed ? `${failed} room(s) could not be deleted.` : 'Rooms deleted', failed ? 'error' : 'success');
        await refreshAll();
      },
    });
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'rooms', label: `Rooms (${rooms.length})`, icon: <DoorOpen className="w-3.5 h-3.5" /> },
    { id: 'inventory', label: 'Common Inventory', icon: <Package className="w-3.5 h-3.5" /> },
    { id: 'catalogue', label: 'Catalogue & Kits', icon: <Boxes className="w-3.5 h-3.5" /> },
    { id: 'ledger', label: 'Stock Ledger', icon: <ScrollText className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0]">
        <div role="tablist" className="flex items-center gap-1 -mb-px overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap cursor-pointer ${tab === t.id ? 'border-[#0d9488] text-[#0d9488]' : 'border-transparent text-[#64748b] hover:text-[#1e293b]'}`}>{t.icon}<span>{t.label}</span></button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-1.5">
          <button type="button" className={btnCls} onClick={() => { setLoading(true); void load(); }}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
          {canManage && <button type="button" className={primaryBtnCls} onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5" /> Add rooms</button>}
        </div>
      </div>

      {loadError && <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xs text-xs">{loadError}</div>}

      {tab === 'rooms' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
            <Stat label="Rooms" value={roll.rooms} />
            <Stat label="Beds in use" value={roll.beds} />
            <Stat label="Residents" value={roll.residents} />
            <Stat label="Occupancy" value={roll.occupancyPct === null ? '—' : `${roll.occupancyPct}%`} sub={roll.beds > 0 ? `${roll.residents} of ${roll.beds} bed spaces` : 'no rooms in use'} tone={(roll.occupancyPct ?? 0) >= 95 ? 'amber' : 'neutral'} />
            <Stat label="Available" value={roll.available} tone="green" />
            <Stat label="Part-occupied" value={roll.partially} tone="teal" />
            <Stat label="Out of use" value={roll.outOfUse} tone={roll.outOfUse ? 'amber' : 'neutral'} />
            <Stat label="Open issues" value={openIssueTotal} tone={openIssueTotal ? 'red' : 'neutral'} />
          </div>

          {placeholderRooms.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xs text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
              <span>
                <b>{placeholderRooms.length} room{placeholderRooms.length > 1 ? 's look' : ' looks'} like auto-generated demo data</b> ("Standard Twin Bedroom with en-suite shower…") and count as bed spaces.
                {removablePlaceholders.length < placeholderRooms.length ? ` ${placeholderRooms.length - removablePlaceholders.length} of them have residents, beds, items or issues, so they are kept.` : ''} Edit them to match real rooms, or remove them.
              </span>
              {canManage && removablePlaceholders.length > 0 && <button type="button" className={dangerBtnCls} onClick={removePlaceholders}><Trash2 className="w-3.5 h-3.5" /> Remove {removablePlaceholders.length} unused placeholder{removablePlaceholders.length > 1 ? 's' : ''}</button>}
            </div>
          )}

          <Card>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2 top-2" />
                <input aria-label="Search rooms" className={`${inputCls} !w-52 !pl-7`} placeholder="Search room, type…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select aria-label="Status" className={`${inputCls} !w-40`} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                {ROOM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="Out of use">Out of use (any)</option>
              </select>
              <select aria-label="Floor" className={`${inputCls} !w-32`} value={floorFilter} onChange={e => setFloorFilter(e.target.value)}><option value="all">All floors</option>{floors.map(f => <option key={f} value={f}>{f}</option>)}</select>
              <select aria-label="Room type" className={`${inputCls} !w-36`} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="all">All types</option>{types.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs"><input type="checkbox" className="accent-[#0d9488]" checked={attentionOnly} onChange={e => setAttentionOnly(e.target.checked)} /> Needs attention ({attention})</label>
              {canManage && selectedIds.length > 0 && <button type="button" className={dangerBtnCls} onClick={deleteSelected}><Trash2 className="w-3.5 h-3.5" /> Delete selected ({selectedIds.length})</button>}
              <span className="ml-auto text-[11px] text-[#64748b]">{filtered.length} of {rooms.length} rooms</span>
            </div>

            {loading && rooms.length === 0 ? <div className="text-center py-10 text-xs text-neutral-500">Loading rooms…</div> : rooms.length === 0 ? (
              <EmptyState icon={<DoorOpen className="w-10 h-10" />} title="No rooms yet" hint="Add this property's rooms: one by one, or a whole range like 101-120 at once.">
                {canManage && <button type="button" className={primaryBtnCls} onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5" /> Add rooms</button>}
              </EmptyState>
            ) : (
              <div className="overflow-x-auto -mx-3">
                <table className="w-full text-xs min-w-[820px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-[#64748b] border-y border-[#e2e8f0] bg-[#fafafa]">
                      {canManage && <th className="py-1.5 pl-3 w-6"><input type="checkbox" aria-label="Select all rooms on this page" className="accent-[#0d9488]" checked={allSelected} onChange={toggleAll} /></th>}
                      <th className="py-1.5 px-3">Room</th><th className="py-1.5 pr-2">Type</th><th className="py-1.5 pr-2">Floor</th>
                      <th className="py-1.5 pr-2">Occupancy</th><th className="py-1.5 pr-2">Status</th><th className="py-1.5 pr-2">Cleaning</th><th className="py-1.5 pr-2 text-right">Items</th><th className="py-1.5 pr-2 text-right">Issues</th><th className="py-1.5 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(r => {
                      const cap = Math.max(1, r.room.capacity || 1);
                      const res = r.residents.length;
                      const worst = r.flags[0];
                      return (
                        <tr key={r.room.id} className="border-b border-[#f1f5f9] hover:bg-[#f0fdfa]/60 cursor-pointer" onClick={() => setOpenRoomId(r.room.id)}>
                          {canManage && <td className="py-2 pl-3" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select room ${r.room.roomNumber}`} className="accent-[#0d9488]" checked={selectedIds.includes(r.room.id)} onChange={() => setSelectedIds(prev => prev.includes(r.room.id) ? prev.filter(i => i !== r.room.id) : [...prev, r.room.id])} /></td>}
                          <td className="py-2 px-3">
                            <div className="font-bold text-[#1e293b]">{r.room.roomNumber}</div>
                            <div className="text-[10px] text-[#64748b]">{r.room.roomName && r.room.roomName !== `Room ${r.room.roomNumber}` ? r.room.roomName : r.room.roomReference}</div>
                          </td>
                          <td className="py-2 pr-2">{r.room.roomType}{r.room.isAccessible ? <span title="Accessible room"> ♿</span> : null}{r.room.isFamilyRoom ? <span title="Family room"> 👪</span> : null}</td>
                          <td className="py-2 pr-2">{r.room.floor || 'Ground'}</td>
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden"><div className={`h-full ${res > cap ? 'bg-red-500' : res >= cap ? 'bg-purple-500' : 'bg-[#0d9488]'}`} style={{ width: `${Math.min(100, (res / cap) * 100)}%` }} /></div>
                              <span className={`font-semibold ${res > cap ? 'text-red-700' : ''}`}>{res}/{cap}</span>
                            </div>
                          </td>
                          <td className="py-2 pr-2"><Chip tone={roomStatusTone(r.room.status)}>{r.room.status}</Chip></td>
                          <td className="py-2 pr-2"><Chip tone={cleaningTone(r.room.cleaningStatus)}>{r.room.cleaningStatus || 'Clean'}</Chip></td>
                          <td className="py-2 pr-2 text-right">{r.units || '—'}</td>
                          <td className="py-2 pr-2 text-right">{r.openIssues ? <span className="font-bold text-red-700">{r.openIssues}</span> : '—'}</td>
                          <td className="py-2 pr-3 text-right whitespace-nowrap">
                            {worst && worst.level !== 'info' && <span title={r.flags.map(f => f.text).join('\n')} className={`inline-flex items-center mr-2 ${worst.level === 'critical' ? 'text-red-600' : 'text-amber-600'}`}><AlertTriangle className="w-3.5 h-3.5" /></span>}
                            <button type="button" className={btnCls} onClick={e => { e.stopPropagation(); setOpenRoomId(r.room.id); }}><BedDouble className="w-3.5 h-3.5" /> Open</button>
                          </td>
                        </tr>
                      );
                    })}
                    {paged.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-neutral-500">No rooms match the filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {filtered.length > 0 && <div className="-mx-3 -mb-3 mt-2"><Pagination currentPage={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>}
          </Card>
        </>
      )}

      {tab === 'inventory' && (
        <PropertyInventoryPanel propertyId={propertyId} propertyName={property.propertyName} catalogue={catalogue} catalogueIsStarter={catalogueIsStarter}
          stock={stock} roomItems={items} actor={actor} onChanged={refreshAll} toast={show} />
      )}

      {tab === 'catalogue' && (
        <CatalogueKitsPanel catalogue={catalogue} catalogueIsStarter={catalogueIsStarter} kits={kits} canManage={canManage} onChanged={refreshAll} toast={show} />
      )}

      {tab === 'ledger' && <StockLedgerPanel propertyName={property.propertyName} movements={movements} rooms={rooms} />}

      {openRoom && (
        <RoomWorkspace
          room={openRoom}
          property={property}
          allRooms={rooms}
          actor={actor}
          canManage={canManage}
          neighbours={filtered.map(r => r.room)}
          onOpenRoom={r => setOpenRoomId(r.id)}
          onChanged={refreshAll}
          onClose={() => setOpenRoomId(null)}
        />
      )}

      {showAdd && (
        <AddRoomsModal
          propertyId={propertyId} propertyName={property.propertyName} existingRooms={rooms} kits={kits} actor={actor}
          onClose={() => setShowAdd(false)}
          onCreated={async (message, created) => { show(message); setShowAdd(false); await refreshAll(); if (created.length === 1) setOpenRoomId(created[0].id); }}
        />
      )}
      {node}
    </div>
  );
};
