/**
 * RoomManagementView — accommodation room management for asylum / dispersal accommodation providers.
 *
 *   Rooms              every room of a property: occupancy, beds, status, cleaning, issues, items. Open one to
 *                      manage it on its own (beds & residents, assets, inventory, issues, checks, timeline).
 *   Common Inventory   what each property holds in store, deliveries, stock counts, low-stock warnings.
 *   Catalogue & Kits   the shared item catalogue and the standard room kits.
 *   Stock Ledger       every stock movement.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BedDouble, Building2, DoorOpen, Package, Plus, RefreshCw, ScrollText, Search, Boxes } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suPropertyService } from '../../services/suPropertyService';
import { roomManagementService } from '../../services/roomManagementService';
import type { Placement, PropertyMaster, PropertyRoom } from '../../types/masterData';
import { ROOM_STATUSES, type InventoryItem, type InventoryMovement, type PropertyStock, type RoomBed, type RoomIssue, type RoomItem, type RoomKitTemplate } from '../../types/roomManagement';
import { isOutOfUse, roomFlags, rollupRooms } from '../../utils/roomManagementLogic';
import { Pagination } from '../common/Pagination';
import { AddRoomsModal } from './AddRoomsModal';
import { CatalogueKitsPanel } from './CatalogueKitsPanel';
import { PropertyInventoryPanel } from './PropertyInventoryPanel';
import { RoomWorkspace } from './RoomWorkspace';
import { StockLedgerPanel } from './StockLedgerPanel';
import { Card, Chip, EmptyState, Stat, btnCls, cleaningTone, inputCls, primaryBtnCls, roomStatusTone, useToast } from './roomUi';

type TabId = 'rooms' | 'inventory' | 'catalogue' | 'ledger';
const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export const RoomManagementView: React.FC = () => {
  const { sites, isSitePermitted, canManageProperties, authProfile, currentUserName } = useApp();
  const canManage = canManageProperties();
  const actor = authProfile?.name || currentUserName || 'Staff Member';
  const { show, node } = useToast();

  const [tab, setTab] = useState<TabId>('rooms');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [properties, setProperties] = useState<PropertyMaster[]>([]);
  const [propertyId, setPropertyId] = useState<string>('all');
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

  // filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const siteName = useCallback((id?: string) => sites.find(s => s.id === id)?.name || '', [sites]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const propsRes = await suPropertyService.getProperties();
      const permitted = (propsRes.data || []).filter(p => isSitePermitted(siteName(p.siteId), 'all'));
      setProperties(permitted);
      const ids = new Set(permitted.map(p => p.id));
      const scope = propertyId !== 'all' && ids.has(propertyId) ? propertyId : undefined;
      const [roomsRes, plcRes, bedsRes, itemsRes, issuesRes, catRes, kitRes] = await Promise.all([
        suPropertyService.getRooms(scope),
        suPropertyService.getPlacements({ status: 'Active', propertyId: scope }),
        roomManagementService.getBeds({ propertyId: scope }),
        roomManagementService.getRoomItems({ propertyId: scope }),
        roomManagementService.getIssues({ propertyId: scope }),
        roomManagementService.getCatalogue(),
        roomManagementService.getKits(),
      ]);
      const err = [propsRes, roomsRes, plcRes].find(r => !r.success)?.error;
      if (err) setLoadError(err);
      const inScope = <T extends { propertyId: string }>(rows: T[]) => rows.filter(r => ids.has(r.propertyId));
      setRooms(inScope(roomsRes.data || []));
      setPlacements(inScope(plcRes.data || []));
      setBeds(inScope(bedsRes.data));
      setItems(inScope(itemsRes.data));
      setIssues(inScope(issuesRes.data));
      setCatalogue(catRes.data);
      setCatalogueIsStarter(catRes.isStarter);
      setKits(kitRes.data);
      if (scope) {
        const [stockRes, movRes] = await Promise.all([roomManagementService.getStock(scope), roomManagementService.getMovements({ propertyId: scope })]);
        setStock(stockRes.data);
        setMovements(movRes.data);
      } else {
        setStock([]);
        setMovements([]);
      }
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load rooms.');
    } finally {
      setLoading(false);
    }
  }, [propertyId, isSitePermitted, siteName]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  // Placements / rooms edited elsewhere (Service Users, Properties) refresh this page too
  useEffect(() => {
    const h = () => { void load(); };
    window.addEventListener('sdtracker:masterDataUpdated', h);
    return () => window.removeEventListener('sdtracker:masterDataUpdated', h);
  }, [load]);

  // a single property is selected automatically when there is only one
  useEffect(() => { if (properties.length === 1 && propertyId === 'all') setPropertyId(properties[0].id); }, [properties, propertyId]);

  const propertyById = useMemo(() => new Map(properties.map(p => [p.id, p])), [properties]);

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
    .filter(r => !search || `${r.room.roomNumber} ${r.room.roomName || ''} ${r.room.roomType} ${propertyById.get(r.room.propertyId)?.propertyName || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => naturalCompare(propertyById.get(a.room.propertyId)?.propertyName || '', propertyById.get(b.room.propertyId)?.propertyName || '') || naturalCompare(String(a.room.roomNumber), String(b.room.roomNumber))),
  [rows, statusFilter, floorFilter, typeFilter, attentionOnly, search, propertyById]);

  useEffect(() => { setPage(1); }, [search, statusFilter, floorFilter, typeFilter, attentionOnly, propertyId, pageSize]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const roll = useMemo(() => rollupRooms(rooms, placements), [rooms, placements]);
  const attention = rows.filter(r => r.flags.some(f => f.level !== 'info')).length;
  const openIssueTotal = rows.reduce((n, r) => n + r.openIssues, 0);
  const openRoom = openRoomId ? rooms.find(r => r.id === openRoomId) : undefined;
  const selectedProperty = propertyId !== 'all' ? propertyById.get(propertyId) : undefined;
  const needsProperty = tab !== 'rooms' && tab !== 'catalogue' && !selectedProperty;

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'rooms', label: 'Rooms', icon: <DoorOpen className="w-3.5 h-3.5" /> },
    { id: 'inventory', label: 'Common Inventory', icon: <Package className="w-3.5 h-3.5" /> },
    { id: 'catalogue', label: 'Catalogue & Kits', icon: <Boxes className="w-3.5 h-3.5" /> },
    { id: 'ledger', label: 'Stock Ledger', icon: <ScrollText className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#f0fdfa] border border-[#99f6e4] rounded-xs"><BedDouble className="w-5 h-5 text-[#0d9488]" /></div>
            <div>
              <h1 className="text-base font-bold text-[#242424] tracking-tight">Room Management</h1>
              <p className="text-xs text-neutral-500">Every room, bed, asset and item in your accommodation &mdash; open a room to manage it on its own.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-neutral-500" />
              <select aria-label="Property" className={`${inputCls} !w-60`} value={propertyId} onChange={e => setPropertyId(e.target.value)}>
                <option value="all">All properties ({properties.length})</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.propertyName}</option>)}
              </select>
            </div>
            <button type="button" className={btnCls} onClick={() => { setLoading(true); void load(); }}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
            {canManage && <button type="button" className={primaryBtnCls} disabled={!selectedProperty} title={selectedProperty ? undefined : 'Choose a property first'} onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5" /> Add rooms</button>}
          </div>
        </div>
        <div role="tablist" className="flex items-center gap-1 mt-3 -mb-px overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 whitespace-nowrap cursor-pointer ${tab === t.id ? 'border-[#0d9488] text-[#0d9488]' : 'border-transparent text-[#64748b] hover:text-[#1e293b]'}`}>{t.icon}<span>{t.label}</span></button>
          ))}
        </div>
      </div>

      {loadError && <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xs text-xs">{loadError}</div>}

      {/* ROOMS */}
      {tab === 'rooms' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
            <Stat label="Rooms" value={roll.rooms} />
            <Stat label="Beds in use" value={roll.beds} />
            <Stat label="Residents" value={roll.residents} />
            <Stat label="Occupancy" value={`${roll.occupancyPct}%`} tone={roll.occupancyPct >= 95 ? 'amber' : 'neutral'} />
            <Stat label="Available" value={roll.available} tone="green" />
            <Stat label="Part-occupied" value={roll.partially} tone="teal" />
            <Stat label="Out of use" value={roll.outOfUse} tone={roll.outOfUse ? 'amber' : 'neutral'} />
            <Stat label="Open issues" value={openIssueTotal} tone={openIssueTotal ? 'red' : 'neutral'} />
          </div>

          <Card>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2 top-2" />
                <input aria-label="Search rooms" className={`${inputCls} !w-56 !pl-7`} placeholder="Search room, type, property…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select aria-label="Status" className={`${inputCls} !w-40`} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                {ROOM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="Out of use">Out of use (any)</option>
              </select>
              <select aria-label="Floor" className={`${inputCls} !w-32`} value={floorFilter} onChange={e => setFloorFilter(e.target.value)}><option value="all">All floors</option>{floors.map(f => <option key={f} value={f}>{f}</option>)}</select>
              <select aria-label="Room type" className={`${inputCls} !w-36`} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="all">All types</option>{types.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs"><input type="checkbox" className="accent-[#0d9488]" checked={attentionOnly} onChange={e => setAttentionOnly(e.target.checked)} /> Needs attention ({attention})</label>
              <span className="ml-auto text-[11px] text-[#64748b]">{filtered.length} of {rooms.length} rooms</span>
            </div>

            {loading && rooms.length === 0 ? <div className="text-center py-10 text-xs text-neutral-500">Loading rooms…</div> : rooms.length === 0 ? (
              <EmptyState icon={<DoorOpen className="w-10 h-10" />} title={properties.length === 0 ? 'No properties available' : 'No rooms yet'} hint={properties.length === 0 ? 'Add a property under Property Management first.' : 'Choose a property and add its rooms: one by one, or a whole range like 101-120 at once.'}>
                {canManage && selectedProperty && <button type="button" className={primaryBtnCls} onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5" /> Add rooms</button>}
              </EmptyState>
            ) : (
              <div className="overflow-x-auto -mx-3">
                <table className="w-full text-xs min-w-[900px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-[#64748b] border-y border-[#e2e8f0] bg-[#fafafa]">
                      <th className="py-1.5 px-3">Room</th>{propertyId === 'all' && <th className="py-1.5 pr-2">Property</th>}<th className="py-1.5 pr-2">Type</th><th className="py-1.5 pr-2">Floor</th>
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
                          <td className="py-2 px-3">
                            <div className="font-bold text-[#1e293b]">{r.room.roomNumber}</div>
                            <div className="text-[10px] text-[#64748b]">{r.room.roomName && r.room.roomName !== `Room ${r.room.roomNumber}` ? r.room.roomName : r.room.roomReference}</div>
                          </td>
                          {propertyId === 'all' && <td className="py-2 pr-2">{propertyById.get(r.room.propertyId)?.propertyName || '—'}</td>}
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
                            <button type="button" className={btnCls} onClick={e => { e.stopPropagation(); setOpenRoomId(r.room.id); }}>Open</button>
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

      {needsProperty && (
        <Card><EmptyState icon={<Building2 className="w-10 h-10" />} title="Choose a property" hint="Stock is held per property. Pick one in the box at the top." /></Card>
      )}

      {/* COMMON INVENTORY */}
      {tab === 'inventory' && selectedProperty && (
        <PropertyInventoryPanel propertyId={selectedProperty.id} propertyName={selectedProperty.propertyName} catalogue={catalogue} catalogueIsStarter={catalogueIsStarter}
          stock={stock} roomItems={items} actor={actor} onChanged={load} toast={show} />
      )}

      {/* CATALOGUE & KITS */}
      {tab === 'catalogue' && (
        <CatalogueKitsPanel catalogue={catalogue} catalogueIsStarter={catalogueIsStarter} kits={kits} canManage={canManage} onChanged={load} toast={show} />
      )}

      {/* LEDGER */}
      {tab === 'ledger' && selectedProperty && <StockLedgerPanel propertyName={selectedProperty.propertyName} movements={movements} rooms={rooms} />}

      {/* Room workspace */}
      {openRoom && (
        <RoomWorkspace
          room={openRoom}
          property={propertyById.get(openRoom.propertyId)}
          allRooms={rooms}
          actor={actor}
          canManage={canManage}
          neighbours={filtered.map(r => r.room)}
          onOpenRoom={r => setOpenRoomId(r.id)}
          onChanged={load}
          onClose={() => setOpenRoomId(null)}
        />
      )}

      {showAdd && selectedProperty && (
        <AddRoomsModal
          propertyId={selectedProperty.id} propertyName={selectedProperty.propertyName} existingRooms={rooms} kits={kits} actor={actor}
          onClose={() => setShowAdd(false)}
          onCreated={async (message, created) => { show(message); setShowAdd(false); await load(); if (created.length === 1) setOpenRoomId(created[0].id); }}
        />
      )}
      {node}
    </div>
  );
};
