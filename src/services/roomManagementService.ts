/**
 * Room Management service.
 *
 * Loads and saves beds, items in rooms, common stock, the movement ledger, kits, issues and the
 * room timeline through the same /api/db entity layer the rest of the app uses, and carries out the
 * multi-step operations (issue from stock, return, transfer, mark damaged, apply a kit...) with the
 * rules from utils/roomManagementLogic.ts. Every step that moves stock writes a ledger row, and a
 * step that fails half-way puts the stock back.
 */

import { apiService } from './apiService';
import { suPropertyService } from './suPropertyService';
import {
  canChangeRoomStatus,
  checkStockIssue,
  planKitApplication,
  validateRoomItem,
  type KitPlanLine,
} from '../utils/roomManagementLogic';
import { INVENTORY_ITEM_SEED, KIT_TEMPLATE_SEED } from '../data/roomInventorySeed';
import type { Placement, PropertyAsset, PropertyRoom } from '../types/masterData';
import type {
  InventoryItem,
  InventoryMovement,
  MovementType,
  PropertyStock,
  RoomActivity,
  RoomBed,
  RoomIssue,
  RoomItem,
  RoomKitTemplate,
} from '../types/roomManagement';

export interface OpResult<T = unknown> {
  success: boolean;
  error?: string;
  /** the operation worked but something secondary (e.g. the ledger entry) could not be written */
  warning?: string;
  data?: T;
}

const MODULE = 'Room Management';
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `rm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
const nowIso = () => new Date().toISOString();
const clean = (eq: Record<string, string | undefined>): Record<string, string> | undefined => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(eq)) if (v) out[k] = v;
  return Object.keys(out).length ? out : undefined;
};
const ref = (prefix: string) => `${prefix}-${String(Math.floor(Math.random() * 900000) + 100000)}`;

type Entity =
  | 'roomBeds' | 'inventoryItems' | 'propertyInventoryStock' | 'roomInventory'
  | 'inventoryMovements' | 'roomKitTemplates' | 'roomIssues' | 'roomActivityLog';

async function list<T>(entity: Entity, eq?: Record<string, string | undefined>, order?: string): Promise<{ success: boolean; data: T[]; error?: string }> {
  const res = await apiService.fetchEntityRecords<T>(entity, { order, eq: clean(eq || {}) });
  return { success: res.success, data: res.data || [], error: res.error };
}

async function save<T extends { id: string }>(entity: Entity, record: T, details: string, action: 'CREATE' | 'UPDATE' = 'CREATE'): Promise<OpResult<T>> {
  const res = action === 'CREATE'
    ? await apiService.saveEntityRecord<T>(entity, record, { action: 'CREATE', module: MODULE, targetItem: record.id, details })
    : await apiService.updateEntityRecord<T>(entity, record.id, record, { action: 'UPDATE', module: MODULE, targetItem: record.id, details });
  return { success: res.success, error: res.error, data: (res.record as T) || record };
}
async function update<T>(entity: Entity, id: string, patch: Partial<T>, details: string): Promise<OpResult<T>> {
  const res = await apiService.updateEntityRecord<T>(entity, id, patch, { action: 'UPDATE', module: MODULE, targetItem: id, details });
  return { success: res.success, error: res.error, data: res.record as T };
}
async function remove(entity: Entity, id: string, details: string): Promise<OpResult> {
  const res = await apiService.deleteEntityRecord(entity, id, { action: 'DELETE', module: MODULE, targetItem: id, details });
  return { success: res.success, error: res.error };
}

export const roomManagementService = {
  /* ------------------------------------------------------------------ reads */
  getBeds: (q: { propertyId?: string; roomId?: string }) => list<RoomBed>('roomBeds', { property_id: q.propertyId, room_id: q.roomId }, 'bed_label.asc'),
  getRoomItems: (q: { propertyId?: string; roomId?: string }) => list<RoomItem>('roomInventory', { property_id: q.propertyId, room_id: q.roomId }, 'item_name.asc'),
  getStock: (propertyId?: string) => list<PropertyStock>('propertyInventoryStock', { property_id: propertyId }),
  getIssues: (q: { propertyId?: string; roomId?: string }) => list<RoomIssue>('roomIssues', { property_id: q.propertyId, room_id: q.roomId }, 'reported_at.desc'),
  getActivity: (q: { propertyId?: string; roomId?: string }) => list<RoomActivity>('roomActivityLog', { property_id: q.propertyId, room_id: q.roomId }, 'performed_at.desc'),

  /** Catalogue: the live list, or the built-in starter list until the database has one. */
  async getCatalogue(): Promise<{ success: boolean; data: InventoryItem[]; error?: string; isStarter: boolean }> {
    const res = await list<InventoryItem>('inventoryItems', undefined, 'item_name.asc');
    if (res.success && res.data.length > 0) return { ...res, isStarter: false };
    return { success: res.success, data: INVENTORY_ITEM_SEED.map(i => ({ ...i })), error: res.error, isStarter: true };
  },
  async getKits(): Promise<{ success: boolean; data: RoomKitTemplate[]; error?: string; isStarter: boolean }> {
    const res = await list<RoomKitTemplate>('roomKitTemplates', undefined, 'template_name.asc');
    if (res.success && res.data.length > 0) {
      return { ...res, data: res.data.map(k => ({ ...k, items: Array.isArray(k.items) ? k.items : [] })), isStarter: false };
    }
    return { success: res.success, data: KIT_TEMPLATE_SEED.map(k => ({ ...k, items: k.items.map(l => ({ ...l })) })), error: res.error, isStarter: true };
  },
  /** Ledger rows for a property, optionally only those touching one room. */
  async getMovements(q: { propertyId: string; roomId?: string }): Promise<{ success: boolean; data: InventoryMovement[]; error?: string }> {
    const all = await list<InventoryMovement>('inventoryMovements', { property_id: q.propertyId }, 'performed_at.desc');
    if (!q.roomId) return all;
    return { ...all, data: all.data.filter(m => m.fromRoomId === q.roomId || m.toRoomId === q.roomId) };
  },

  /** Write the starter catalogue and kits into the database (one-off, when it is empty). */
  async loadStarterCatalogue(): Promise<OpResult> {
    for (const item of INVENTORY_ITEM_SEED) {
      const r = await save<InventoryItem>('inventoryItems', { ...item, createdAt: nowIso() }, `Added catalogue item ${item.itemName}`);
      if (!r.success) return { success: false, error: r.error || `Could not add ${item.itemName}` };
    }
    for (const kit of KIT_TEMPLATE_SEED) {
      const r = await save<RoomKitTemplate>('roomKitTemplates', { ...kit, createdAt: nowIso() }, `Added kit ${kit.templateName}`);
      if (!r.success) return { success: false, error: r.error || `Could not add ${kit.templateName}` };
    }
    return { success: true };
  },

  /* ------------------------------------------------------------------ timeline */
  async logActivity(a: { propertyId: string; roomId: string; activityType: string; title: string; details?: string; actor: string }): Promise<void> {
    await save<RoomActivity>('roomActivityLog', {
      id: newId(), propertyId: a.propertyId, roomId: a.roomId, activityType: a.activityType,
      title: a.title, details: a.details || '', performedByName: a.actor, performedAt: nowIso(), createdAt: nowIso(),
    }, `${a.activityType}: ${a.title}`);
  },

  /* ------------------------------------------------------------------ rooms */
  async createRoom(data: Partial<PropertyRoom>, actor: string): Promise<OpResult<PropertyRoom>> {
    const res = await suPropertyService.createRoom(data);
    if (res.success && res.record) {
      await this.logActivity({ propertyId: res.record.propertyId, roomId: res.record.id, activityType: 'Note', title: 'Room created', actor });
    }
    return { success: res.success, error: res.error, data: res.record };
  },

  /** Create many rooms at once (e.g. 101-120) with the same settings. */
  async createRoomsBulk(propertyId: string, numbers: string[], template: Partial<PropertyRoom>, actor: string, existing: Pick<PropertyRoom, 'roomNumber' | 'propertyId'>[]): Promise<OpResult<{ created: number; rooms: PropertyRoom[]; skipped: string[]; failed: string[] }>> {
    const have = new Set(existing.filter(r => r.propertyId === propertyId).map(r => String(r.roomNumber).trim().toLowerCase()));
    const created: string[] = [], skipped: string[] = [], failed: string[] = [];
    const rooms: PropertyRoom[] = [];
    for (const n of numbers) {
      if (have.has(n.toLowerCase())) { skipped.push(n); continue; }
      const r = await suPropertyService.createRoom({ ...template, propertyId, roomNumber: n, roomName: template.roomName || `Room ${n}` });
      if (r.success) {
        created.push(n);
        if (r.record) rooms.push(r.record);
        if (r.record) await this.logActivity({ propertyId, roomId: r.record.id, activityType: 'Note', title: 'Room created', actor });
      } else failed.push(n);
    }
    return { success: failed.length === 0, error: failed.length ? `Could not create: ${failed.join(', ')}` : undefined, data: { created: created.length, rooms, skipped, failed } };
  },

  async updateRoom(room: PropertyRoom, patch: Partial<PropertyRoom>, actor: string, activityTitle?: string): Promise<OpResult<PropertyRoom>> {
    const res = await suPropertyService.updateRoom(room.id, patch);
    if (res.success && activityTitle) {
      await this.logActivity({ propertyId: room.propertyId, roomId: room.id, activityType: 'Note', title: activityTitle, actor });
    }
    return { success: res.success, error: res.error, data: res.record };
  },

  /** Take a room out of use, put it back, or mark it void - with the rules (no residents, reason needed). */
  async setRoomStatus(room: PropertyRoom, next: string, opts: { residents: number; reason?: string; blockedUntil?: string; actor: string }): Promise<OpResult<PropertyRoom>> {
    const problem = canChangeRoomStatus(next, opts.residents, opts.reason);
    if (problem) return { success: false, error: problem };
    const today = nowIso().slice(0, 10);
    const outOfUse = ['Blocked', 'Void', 'Under Maintenance'].includes(next);
    const patch: Partial<PropertyRoom> = {
      status: next,
      occupancyStatus: outOfUse ? 'Available' : room.occupancyStatus,
      blockedReason: outOfUse ? (opts.reason || '') : '',
      blockedUntil: next === 'Blocked' ? (opts.blockedUntil || '') : '',
      voidSince: next === 'Void' ? (room.voidSince || today) : '',
    };
    const res = await suPropertyService.updateRoom(room.id, patch);
    if (!res.success) return { success: false, error: res.error };
    if (!outOfUse) await suPropertyService.syncRoomOccupancy(room.id); // recalculate from the real placements
    await this.logActivity({
      propertyId: room.propertyId, roomId: room.id, activityType: 'Status Change',
      title: `${room.status} → ${next}`, details: opts.reason, actor: opts.actor,
    });
    return { success: true, data: res.record };
  },

  async setCleaning(room: PropertyRoom, status: string, actor: string): Promise<OpResult<PropertyRoom>> {
    const patch: Partial<PropertyRoom> = { cleaningStatus: status };
    if (status === 'Clean' || status === 'Inspected') patch.lastCleanedAt = nowIso();
    const res = await suPropertyService.updateRoom(room.id, patch);
    if (res.success) await this.logActivity({ propertyId: room.propertyId, roomId: room.id, activityType: 'Cleaning', title: `Marked ${status}`, actor });
    return { success: res.success, error: res.error, data: res.record };
  },

  async recordInspection(room: PropertyRoom, nextDue: string, notes: string, actor: string): Promise<OpResult<PropertyRoom>> {
    const res = await suPropertyService.updateRoom(room.id, { lastInspectedAt: nowIso(), nextInspectionDue: nextDue || '' });
    if (res.success) await this.logActivity({ propertyId: room.propertyId, roomId: room.id, activityType: 'Inspection', title: 'Inspection recorded', details: notes, actor });
    return { success: res.success, error: res.error, data: res.record };
  },

  /* ------------------------------------------------------------------ beds */
  async addBeds(room: PropertyRoom, count: number, bedType: string, existing: RoomBed[], actor: string): Promise<OpResult<number>> {
    const used = new Set(existing.map(b => b.bedLabel.toLowerCase()));
    let made = 0;
    for (let i = 0; made < count && i < 52; i++) {
      const label = i < 26 ? String.fromCharCode(65 + i) : `A${String.fromCharCode(65 + i - 26)}`;
      if (used.has(label.toLowerCase())) continue;
      const r = await save<RoomBed>('roomBeds', {
        id: newId(), bedReference: ref('BED'), propertyId: room.propertyId, roomId: room.id, bedLabel: label,
        bedType, status: 'Available', mattressCondition: 'Good', createdAt: nowIso(),
      }, `Added bed ${label} to room ${room.roomNumber}`);
      if (!r.success) return { success: false, error: r.error, data: made };
      made++;
    }
    if (made) await this.logActivity({ propertyId: room.propertyId, roomId: room.id, activityType: 'Note', title: `${made} bed${made > 1 ? 's' : ''} added`, actor });
    return { success: true, data: made };
  },
  updateBed: (bed: RoomBed, patch: Partial<RoomBed>) => update<RoomBed>('roomBeds', bed.id, patch, `Updated bed ${bed.bedLabel}`),
  async deleteBed(bed: RoomBed, placements: Placement[]): Promise<OpResult> {
    if (placements.some(p => p.status === 'Active' && p.bedId === bed.id)) return { success: false, error: 'A resident is in this bed. Move them first.' };
    return remove('roomBeds', bed.id, `Deleted bed ${bed.bedLabel}`);
  },

  /** Give a resident a bed (or take them out of one with bedId = null). */
  async assignBed(placement: Placement, bedId: string | null, beds: RoomBed[], placements: Placement[], actor: string, roomNumber: string): Promise<OpResult> {
    if (bedId) {
      const bed = beds.find(b => b.id === bedId);
      if (!bed) return { success: false, error: 'Bed not found.' };
      if (bed.roomId !== placement.roomId) return { success: false, error: 'That bed is in a different room.' };
      if (bed.status === 'Out of Service') return { success: false, error: 'That bed is out of service.' };
      if (placements.some(p => p.status === 'Active' && p.bedId === bedId && p.id !== placement.id)) return { success: false, error: 'Another resident is already in that bed.' };
    }
    const res = await apiService.updateEntityRecord<Placement>('placements', placement.id, { bedId: bedId || null } as unknown as Partial<Placement>, {
      action: 'UPDATE', module: MODULE, targetItem: placement.id, details: `Bed ${bedId ? 'assigned' : 'cleared'} for placement ${placement.placementReference}`,
    });
    if (!res.success) return { success: false, error: res.error };
    const label = bedId ? beds.find(b => b.id === bedId)?.bedLabel : null;
    await this.logActivity({
      propertyId: placement.propertyId, roomId: placement.roomId, activityType: 'Placement',
      title: label ? `Resident given bed ${label}` : 'Resident taken out of their bed', details: `Room ${roomNumber}`, actor,
    });
    return { success: true };
  },

  /* ------------------------------------------------------------------ common stock */
  async findStock(propertyId: string, itemId: string): Promise<PropertyStock | undefined> {
    const res = await list<PropertyStock>('propertyInventoryStock', { property_id: propertyId, item_id: itemId });
    return res.data[0];
  },

  /** Put items into the property's common stock (a delivery / purchase). */
  async receiveStock(a: { propertyId: string; item: InventoryItem; quantity: number; reference?: string; reason?: string; actor: string }): Promise<OpResult<PropertyStock>> {
    if (!Number.isInteger(a.quantity) || a.quantity <= 0) return { success: false, error: 'Enter a whole number of 1 or more.' };
    const row = await this.findStock(a.propertyId, a.item.id);
    const saved = row
      ? await update<PropertyStock>('propertyInventoryStock', row.id, { quantityOnHand: row.quantityOnHand + a.quantity, updatedAt: nowIso() }, `Received ${a.quantity} x ${a.item.itemName}`)
      : await save<PropertyStock>('propertyInventoryStock', {
        id: newId(), propertyId: a.propertyId, itemId: a.item.id, quantityOnHand: a.quantity,
        minimumLevel: a.item.reorderLevel || 0, createdAt: nowIso(),
      }, `Received ${a.quantity} x ${a.item.itemName}`);
    if (!saved.success) return saved;
    const warning = await this.writeMovement({ propertyId: a.propertyId, type: 'Purchase', item: a.item, quantity: a.quantity, reference: a.reference, reason: a.reason, actor: a.actor });
    return { success: true, data: saved.data, warning };
  },

  /** Set what is actually on the shelf after a count; records the difference. */
  async setStockCount(a: { propertyId: string; item: InventoryItem; counted: number; minimumLevel?: number; storageLocation?: string; actor: string }): Promise<OpResult<PropertyStock>> {
    if (!Number.isInteger(a.counted) || a.counted < 0) return { success: false, error: 'The count must be a whole number, 0 or more.' };
    const row = await this.findStock(a.propertyId, a.item.id);
    const patch = { quantityOnHand: a.counted, minimumLevel: a.minimumLevel ?? row?.minimumLevel ?? a.item.reorderLevel ?? 0, storageLocation: a.storageLocation ?? row?.storageLocation, lastCountedAt: nowIso() };
    const saved = row
      ? await update<PropertyStock>('propertyInventoryStock', row.id, patch, `Counted ${a.item.itemName}: ${a.counted}`)
      : await save<PropertyStock>('propertyInventoryStock', { id: newId(), propertyId: a.propertyId, itemId: a.item.id, ...patch, createdAt: nowIso() }, `Counted ${a.item.itemName}: ${a.counted}`);
    if (!saved.success) return saved;
    const diff = a.counted - (row?.quantityOnHand ?? 0);
    const warning = diff !== 0
      ? await this.writeMovement({ propertyId: a.propertyId, type: 'Stock Count', item: a.item, quantity: diff, reason: `Count adjusted ${row?.quantityOnHand ?? 0} → ${a.counted}`, actor: a.actor })
      : undefined;
    return { success: true, data: saved.data, warning };
  },

  /** Returns a warning message when the ledger row could not be written (the stock change itself already happened). */
  async writeMovement(m: { propertyId: string; type: MovementType; item: Pick<InventoryItem, 'id' | 'itemName'>; quantity: number; fromRoomId?: string; toRoomId?: string; reference?: string; reason?: string; actor: string }): Promise<string | undefined> {
    const r = await save<InventoryMovement>('inventoryMovements', {
      id: newId(), propertyId: m.propertyId, movementType: m.type, itemId: m.item.id, itemName: m.item.itemName, quantity: m.quantity,
      fromRoomId: m.fromRoomId, toRoomId: m.toRoomId, reference: m.reference, reason: m.reason, performedByName: m.actor,
      performedAt: nowIso(), createdAt: nowIso(),
    }, `${m.type}: ${m.quantity} x ${m.item.itemName}`);
    return r.success ? undefined : 'The change was made but the stock ledger entry could not be saved.';
  },

  /* ------------------------------------------------------------------ items in a room */
  /**
   * Put an item in a room. `fromStock` takes it out of the property's common stock (and fails if there is
   * not enough); otherwise it is simply recorded as in the room (e.g. an item that was already there).
   */
  async addItemToRoom(a: {
    room: PropertyRoom; item: InventoryItem; quantity: number; fromStock: boolean; condition?: string;
    serialNumber?: string; notes?: string; existing: RoomItem[]; actor: string;
  }): Promise<OpResult<RoomItem>> {
    const problem = validateRoomItem(a.item, { quantity: a.quantity, serialNumber: a.serialNumber });
    if (problem) return { success: false, error: problem };

    let stockRow: PropertyStock | undefined;
    if (a.fromStock) {
      stockRow = await this.findStock(a.room.propertyId, a.item.id);
      const stockProblem = checkStockIssue(stockRow, a.quantity);
      if (stockProblem) return { success: false, error: stockProblem };
      const dec = await update<PropertyStock>('propertyInventoryStock', stockRow!.id, { quantityOnHand: stockRow!.quantityOnHand - a.quantity }, `Issued ${a.quantity} x ${a.item.itemName} to room ${a.room.roomNumber}`);
      if (!dec.success) return { success: false, error: dec.error || 'Could not update the stock.' };
    }

    const condition = a.condition || 'Good';
    const mergeable = a.item.itemType !== 'Asset' && !a.serialNumber
      ? a.existing.find(r => r.roomId === a.room.id && r.itemId === a.item.id && r.status === 'In Room' && r.condition === condition && !r.serialNumber)
      : undefined;
    const placed = mergeable
      ? await update<RoomItem>('roomInventory', mergeable.id, { quantity: mergeable.quantity + a.quantity }, `Added ${a.quantity} x ${a.item.itemName} to room ${a.room.roomNumber}`)
      : await save<RoomItem>('roomInventory', {
        id: newId(), propertyId: a.room.propertyId, roomId: a.room.id, itemId: a.item.id, itemName: a.item.itemName, category: a.item.category,
        quantity: a.quantity, condition, status: 'In Room', serialNumber: a.serialNumber || '', issuedDate: nowIso().slice(0, 10),
        notes: a.notes || '', createdAt: nowIso(),
      }, `Added ${a.quantity} x ${a.item.itemName} to room ${a.room.roomNumber}`);

    if (!placed.success) {
      if (stockRow) await update<PropertyStock>('propertyInventoryStock', stockRow.id, { quantityOnHand: stockRow.quantityOnHand }, 'Stock restored after a failed issue');
      return { success: false, error: placed.error || 'Could not add the item to the room.' };
    }

    const warning = await this.writeMovement({
      propertyId: a.room.propertyId, type: 'Issue to Room', item: a.item, quantity: a.quantity, toRoomId: a.room.id,
      reason: a.fromStock ? 'From common stock' : 'Recorded as already in the room', actor: a.actor,
    });
    await this.logActivity({ propertyId: a.room.propertyId, roomId: a.room.id, activityType: 'Inventory', title: `${a.quantity} x ${a.item.itemName} ${a.fromStock ? 'issued' : 'added'}`, actor: a.actor });
    return { success: true, data: placed.data, warning };
  },

  /** Take (some of) an item out of a room and back into the property's common stock. */
  async returnToStock(a: { room: PropertyRoom; roomItem: RoomItem; quantity: number; item?: InventoryItem; reason?: string; actor: string }): Promise<OpResult> {
    if (!Number.isInteger(a.quantity) || a.quantity <= 0 || a.quantity > a.roomItem.quantity) return { success: false, error: `Enter a whole number from 1 to ${a.roomItem.quantity}.` };
    if (!a.roomItem.itemId) return { success: false, error: 'This item is not in the catalogue, so it cannot go back into stock. Remove it instead.' };
    const item: Pick<InventoryItem, 'id' | 'itemName'> = a.item || { id: a.roomItem.itemId, itemName: a.roomItem.itemName };

    const reduced = a.quantity === a.roomItem.quantity
      ? await remove('roomInventory', a.roomItem.id, `Returned ${a.roomItem.itemName} from room ${a.room.roomNumber} to stock`)
      : await update<RoomItem>('roomInventory', a.roomItem.id, { quantity: a.roomItem.quantity - a.quantity }, `Returned ${a.quantity} x ${a.roomItem.itemName} from room ${a.room.roomNumber}`);
    if (!reduced.success) return { success: false, error: reduced.error || 'Could not take the item out of the room.' };

    const row = await this.findStock(a.room.propertyId, a.roomItem.itemId);
    const stocked = row
      ? await update<PropertyStock>('propertyInventoryStock', row.id, { quantityOnHand: row.quantityOnHand + a.quantity }, `Returned ${a.quantity} x ${a.roomItem.itemName} to stock`)
      : await save<PropertyStock>('propertyInventoryStock', { id: newId(), propertyId: a.room.propertyId, itemId: a.roomItem.itemId, quantityOnHand: a.quantity, minimumLevel: 0, createdAt: nowIso() }, `Returned ${a.quantity} x ${a.roomItem.itemName} to stock`);
    if (!stocked.success) {
      // put the item back in the room so nothing is lost
      if (a.quantity === a.roomItem.quantity) await save<RoomItem>('roomInventory', { ...a.roomItem }, 'Restored after a failed return');
      else await update<RoomItem>('roomInventory', a.roomItem.id, { quantity: a.roomItem.quantity }, 'Restored after a failed return');
      return { success: false, error: stocked.error || 'Could not add the item to stock.' };
    }
    const warning = await this.writeMovement({ propertyId: a.room.propertyId, type: 'Return to Stock', item, quantity: a.quantity, fromRoomId: a.room.id, reason: a.reason, actor: a.actor });
    await this.logActivity({ propertyId: a.room.propertyId, roomId: a.room.id, activityType: 'Inventory', title: `${a.quantity} x ${a.roomItem.itemName} returned to stock`, details: a.reason, actor: a.actor });
    return { success: true, warning };
  },

  /** Move (some of) an item to another room of the same property. */
  async transferItem(a: { from: PropertyRoom; to: PropertyRoom; roomItem: RoomItem; quantity: number; destinationItems: RoomItem[]; reason?: string; actor: string }): Promise<OpResult> {
    if (a.from.id === a.to.id) return { success: false, error: 'Choose a different room.' };
    if (a.from.propertyId !== a.to.propertyId) return { success: false, error: 'Items can only move between rooms of the same property.' };
    if (!Number.isInteger(a.quantity) || a.quantity <= 0 || a.quantity > a.roomItem.quantity) return { success: false, error: `Enter a whole number from 1 to ${a.roomItem.quantity}.` };
    if (a.roomItem.status !== 'In Room') return { success: false, error: 'Only items that are in the room can be moved.' };

    // destination first (a failure here leaves the source untouched)
    const target = !a.roomItem.serialNumber && a.destinationItems.find(r => r.roomId === a.to.id && r.itemId === a.roomItem.itemId && r.itemId && r.status === 'In Room' && r.condition === a.roomItem.condition && !r.serialNumber);
    const placed = target
      ? await update<RoomItem>('roomInventory', target.id, { quantity: target.quantity + a.quantity }, `Moved ${a.quantity} x ${a.roomItem.itemName} into room ${a.to.roomNumber}`)
      : a.quantity === a.roomItem.quantity
        ? await update<RoomItem>('roomInventory', a.roomItem.id, { roomId: a.to.id }, `Moved ${a.roomItem.itemName} to room ${a.to.roomNumber}`)
        : await save<RoomItem>('roomInventory', { ...a.roomItem, id: newId(), roomId: a.to.id, quantity: a.quantity, createdAt: nowIso() }, `Moved ${a.quantity} x ${a.roomItem.itemName} into room ${a.to.roomNumber}`);
    if (!placed.success) return { success: false, error: placed.error || 'Could not move the item.' };

    const fullMoveByReassign = !target && a.quantity === a.roomItem.quantity;
    if (!fullMoveByReassign) {
      const source = a.quantity === a.roomItem.quantity
        ? await remove('roomInventory', a.roomItem.id, `Moved ${a.roomItem.itemName} out of room ${a.from.roomNumber}`)
        : await update<RoomItem>('roomInventory', a.roomItem.id, { quantity: a.roomItem.quantity - a.quantity }, `Moved ${a.quantity} x ${a.roomItem.itemName} out of room ${a.from.roomNumber}`);
      if (!source.success) {
        // undo the destination so the item is not in two rooms
        if (target) await update<RoomItem>('roomInventory', target.id, { quantity: target.quantity }, 'Restored after a failed move');
        else if (placed.data?.id) await remove('roomInventory', placed.data.id, 'Restored after a failed move');
        return { success: false, error: source.error || 'Could not take the item out of the first room.' };
      }
    }
    const item = { id: a.roomItem.itemId || a.roomItem.id, itemName: a.roomItem.itemName };
    const warning = await this.writeMovement({ propertyId: a.from.propertyId, type: 'Room Transfer', item, quantity: a.quantity, fromRoomId: a.from.id, toRoomId: a.to.id, reason: a.reason, actor: a.actor });
    for (const r of [a.from, a.to]) {
      await this.logActivity({ propertyId: r.propertyId, roomId: r.id, activityType: 'Inventory', title: `${a.quantity} x ${a.roomItem.itemName} ${r.id === a.from.id ? `moved to room ${a.to.roomNumber}` : `received from room ${a.from.roomNumber}`}`, details: a.reason, actor: a.actor });
    }
    return { success: true, warning };
  },

  /** Mark (some of) an item Damaged / Missing / Removed, or back In Room, splitting the record when only some are affected. */
  async setItemStatus(a: { room: PropertyRoom; roomItem: RoomItem; status: 'In Room' | 'Damaged' | 'Missing' | 'Removed'; quantity?: number; note?: string; actor: string }): Promise<OpResult> {
    const qty = a.quantity ?? a.roomItem.quantity;
    if (!Number.isInteger(qty) || qty <= 0 || qty > a.roomItem.quantity) return { success: false, error: `Enter a whole number from 1 to ${a.roomItem.quantity}.` };
    if (a.status === a.roomItem.status) return { success: false, error: `It is already marked ${a.status}.` };

    if (qty === a.roomItem.quantity) {
      const r = a.status === 'Removed'
        ? await remove('roomInventory', a.roomItem.id, `Removed ${a.roomItem.itemName} from room ${a.room.roomNumber}`)
        : await update<RoomItem>('roomInventory', a.roomItem.id, { status: a.status, notes: a.note || a.roomItem.notes, lastCheckedAt: nowIso() }, `${a.roomItem.itemName} marked ${a.status}`);
      if (!r.success) return { success: false, error: r.error };
    } else {
      const left = await update<RoomItem>('roomInventory', a.roomItem.id, { quantity: a.roomItem.quantity - qty }, `Split ${a.roomItem.itemName}`);
      if (!left.success) return { success: false, error: left.error };
      if (a.status !== 'Removed') {
        const moved = await save<RoomItem>('roomInventory', { ...a.roomItem, id: newId(), quantity: qty, status: a.status, notes: a.note || a.roomItem.notes, lastCheckedAt: nowIso(), createdAt: nowIso() }, `${qty} x ${a.roomItem.itemName} marked ${a.status}`);
        if (!moved.success) {
          await update<RoomItem>('roomInventory', a.roomItem.id, { quantity: a.roomItem.quantity }, 'Restored after a failed split');
          return { success: false, error: moved.error };
        }
      }
    }
    const type: MovementType | null = a.status === 'Damaged' ? 'Damaged' : a.status === 'Missing' ? 'Lost' : a.status === 'Removed' ? 'Disposed' : null;
    let warning: string | undefined;
    if (type) {
      warning = await this.writeMovement({ propertyId: a.room.propertyId, type, item: { id: a.roomItem.itemId || a.roomItem.id, itemName: a.roomItem.itemName }, quantity: qty, fromRoomId: a.room.id, reason: a.note, actor: a.actor });
    }
    await this.logActivity({ propertyId: a.room.propertyId, roomId: a.room.id, activityType: 'Inventory', title: `${qty} x ${a.roomItem.itemName}: ${a.status}`, details: a.note, actor: a.actor });
    return { success: true, warning };
  },

  /** Confirm everything in the room has been checked today. */
  async markRoomChecked(items: RoomItem[], room: PropertyRoom, actor: string): Promise<OpResult> {
    for (const i of items.filter(r => r.status === 'In Room')) {
      const r = await update<RoomItem>('roomInventory', i.id, { lastCheckedAt: nowIso() }, `Checked ${i.itemName}`);
      if (!r.success) return { success: false, error: r.error };
    }
    await this.logActivity({ propertyId: room.propertyId, roomId: room.id, activityType: 'Inspection', title: 'Room inventory checked', actor });
    return { success: true };
  },

  /** Plan, then apply, a standard kit to a room. */
  planKit: planKitApplication,
  async applyKit(a: { room: PropertyRoom; kit: RoomKitTemplate; fromStock: boolean; catalogue: InventoryItem[]; stock: PropertyStock[]; roomItems: RoomItem[]; actor: string }): Promise<OpResult<{ plan: KitPlanLine[]; issued: number; failed: string[] }>> {
    const plan = planKitApplication(a.kit, a.roomItems, a.stock, a.catalogue, a.fromStock);
    let issued = 0;
    const failed: string[] = [];
    let roomItems = a.roomItems;
    for (const line of plan) {
      if (line.toIssue <= 0) continue;
      const item = a.catalogue.find(i => i.id === line.itemId);
      if (!item) { failed.push(`${line.itemName}: not in the catalogue`); continue; }
      if (item.itemType === 'Asset' && item.requiresSerial) { failed.push(`${line.itemName}: add it by hand (needs a serial number)`); continue; }
      const r = await this.addItemToRoom({ room: a.room, item, quantity: line.toIssue, fromStock: a.fromStock, existing: roomItems, actor: a.actor });
      if (r.success) {
        issued += line.toIssue;
        if (r.data) roomItems = [...roomItems.filter(x => x.id !== r.data!.id), r.data];
      } else failed.push(`${line.itemName}: ${r.error}`);
    }
    await suPropertyService.updateRoom(a.room.id, { kitTemplateId: a.kit.id });
    await this.logActivity({ propertyId: a.room.propertyId, roomId: a.room.id, activityType: 'Inventory', title: `Kit applied: ${a.kit.templateName}`, details: `${issued} item(s) placed${failed.length ? `, ${failed.length} not placed` : ''}`, actor: a.actor });
    return { success: failed.length === 0, error: failed.length ? failed.join('; ') : undefined, data: { plan, issued, failed } };
  },

  /* ------------------------------------------------------------------ catalogue & kits */
  saveCatalogueItem(item: InventoryItem, isNew: boolean): Promise<OpResult<InventoryItem>> {
    return save<InventoryItem>('inventoryItems', { ...item, updatedAt: nowIso() }, `${isNew ? 'Added' : 'Updated'} catalogue item ${item.itemName}`, isNew ? 'CREATE' : 'UPDATE');
  },
  deleteCatalogueItem: (item: InventoryItem) => remove('inventoryItems', item.id, `Deleted catalogue item ${item.itemName}`),
  saveKit(kit: RoomKitTemplate, isNew: boolean): Promise<OpResult<RoomKitTemplate>> {
    return save<RoomKitTemplate>('roomKitTemplates', { ...kit, updatedAt: nowIso() }, `${isNew ? 'Added' : 'Updated'} kit ${kit.templateName}`, isNew ? 'CREATE' : 'UPDATE');
  },
  deleteKit: (kit: RoomKitTemplate) => remove('roomKitTemplates', kit.id, `Deleted kit ${kit.templateName}`),

  /* ------------------------------------------------------------------ assets in a room */
  getRoomAssets: async (propertyId: string, roomId: string): Promise<{ success: boolean; data: PropertyAsset[]; error?: string }> => {
    const res = await apiService.fetchEntityRecords<PropertyAsset>('propertyAssets', { eq: { property_id: propertyId, room_id: roomId }, order: 'asset_name.asc' });
    return { success: res.success, data: res.data || [], error: res.error };
  },
  async saveAsset(asset: Partial<PropertyAsset> & { propertyId: string; roomId: string; assetName: string }, isNew: boolean, actor: string): Promise<OpResult<PropertyAsset>> {
    if (!asset.assetName.trim()) return { success: false, error: 'Give the asset a name.' };
    const record: PropertyAsset = {
      id: asset.id || newId(),
      assetReference: asset.assetReference || ref('AST'),
      propertyId: asset.propertyId, roomId: asset.roomId,
      category: asset.category || 'Other', assetName: asset.assetName.trim(),
      serialNumber: asset.serialNumber || '', quantity: 1,
      condition: (asset.condition as PropertyAsset['condition']) || 'Good',
      status: (asset.status as PropertyAsset['status']) || 'Active',
      purchaseDate: asset.purchaseDate || '', warrantyExpiry: asset.warrantyExpiry || '', notes: asset.notes || '',
      assetTag: asset.assetTag || '', manufacturer: asset.manufacturer || '', model: asset.model || '', supplier: asset.supplier || '',
      purchaseCost: asset.purchaseCost, lastServiceDate: asset.lastServiceDate || '', nextServiceDue: asset.nextServiceDue || '',
      patTestDate: asset.patTestDate || '', patNextDue: asset.patNextDue || '', locationDetail: asset.locationDetail || '',
      createdAt: asset.createdAt || nowIso(), updatedAt: nowIso(),
    };
    const final = isNew
      ? await apiService.saveEntityRecord<PropertyAsset>('propertyAssets', record, { action: 'CREATE', module: MODULE, targetItem: record.assetReference, details: `Added asset ${record.assetName} to room` })
      : await apiService.updateEntityRecord<PropertyAsset>('propertyAssets', record.id, record, { action: 'UPDATE', module: MODULE, targetItem: record.assetReference, details: `Updated asset ${record.assetName}` });
    if (final.success) await this.logActivity({ propertyId: record.propertyId, roomId: record.roomId, activityType: 'Inventory', title: `Asset ${isNew ? 'added' : 'updated'}: ${record.assetName}`, actor });
    return { success: final.success, error: final.error, data: record };
  },
  async deleteAsset(asset: PropertyAsset, actor: string): Promise<OpResult> {
    const res = await apiService.deleteEntityRecord('propertyAssets', asset.id, { action: 'DELETE', module: MODULE, targetItem: asset.assetReference, details: `Deleted asset ${asset.assetName}` });
    if (res.success && asset.roomId) await this.logActivity({ propertyId: asset.propertyId, roomId: asset.roomId, activityType: 'Inventory', title: `Asset removed: ${asset.assetName}`, actor });
    return { success: res.success, error: res.error };
  },

  /* ------------------------------------------------------------------ issues */
  async createIssue(a: { room: PropertyRoom; residents: number; title: string; category: string; priority: string; description?: string; assignedTo?: string; dueDate?: string; blocksRoom: boolean; actor: string }): Promise<OpResult<RoomIssue>> {
    if (!a.title.trim()) return { success: false, error: 'Describe the issue in a few words.' };
    if (a.blocksRoom) {
      const problem = canChangeRoomStatus('Under Maintenance', a.residents, a.title);
      if (problem) return { success: false, error: `This issue takes the room out of use. ${problem}` };
    }
    const issue: RoomIssue = {
      id: newId(), issueReference: ref('ISS'), propertyId: a.room.propertyId, roomId: a.room.id, title: a.title.trim(),
      category: a.category, priority: a.priority, status: 'Open', description: a.description || '', reportedBy: a.actor, reportedAt: nowIso(),
      assignedTo: a.assignedTo || '', dueDate: a.dueDate || '', blocksRoom: a.blocksRoom, createdAt: nowIso(),
    };
    const r = await save<RoomIssue>('roomIssues', issue, `Room ${a.room.roomNumber} issue: ${issue.title}`);
    if (!r.success) return r;
    if (a.blocksRoom) await this.setRoomStatus(a.room, 'Under Maintenance', { residents: a.residents, reason: issue.title, actor: a.actor });
    await this.logActivity({ propertyId: a.room.propertyId, roomId: a.room.id, activityType: 'Issue', title: `Issue raised: ${issue.title}`, details: `${a.priority} priority`, actor: a.actor });
    return r;
  },

  /** Move an issue along; when the last room-blocking issue is closed the room is released. */
  async updateIssueStatus(a: { room: PropertyRoom; issue: RoomIssue; status: string; notes?: string; cost?: number; allIssues: RoomIssue[]; residents: number; actor: string }): Promise<OpResult<RoomIssue>> {
    const closing = a.status === 'Resolved' || a.status === 'Closed';
    const patch: Partial<RoomIssue> = {
      status: a.status,
      resolvedAt: closing ? nowIso() : '',
      resolutionNotes: closing ? (a.notes || a.issue.resolutionNotes || '') : a.issue.resolutionNotes,
      cost: closing && a.cost !== undefined ? a.cost : a.issue.cost,
    };
    const r = await update<RoomIssue>('roomIssues', a.issue.id, patch, `Issue ${a.issue.issueReference || a.issue.id} → ${a.status}`);
    if (!r.success) return r;
    const stillBlocking = a.allIssues.some(i => i.id !== a.issue.id && i.blocksRoom && (i.status === 'Open' || i.status === 'In Progress'));
    if (closing && a.issue.blocksRoom && !stillBlocking && a.room.status === 'Under Maintenance') {
      await this.setRoomStatus(a.room, 'Available', { residents: a.residents, actor: a.actor });
    }
    await this.logActivity({ propertyId: a.room.propertyId, roomId: a.room.id, activityType: 'Issue', title: `Issue ${a.status.toLowerCase()}: ${a.issue.title}`, details: a.notes, actor: a.actor });
    return r;
  },
  deleteIssue: (issue: RoomIssue) => remove('roomIssues', issue.id, `Deleted issue ${issue.issueReference || issue.id}`),
};
