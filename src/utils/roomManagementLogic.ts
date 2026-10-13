/**
 * Room Management — pure business rules (no I/O). Used by the room screens and unit-tested.
 */

import type { Placement, PropertyRoom } from '../types/masterData';
import type {
  InventoryItem,
  PropertyStock,
  RoomBed,
  RoomIssue,
  RoomItem,
  RoomKitTemplate,
} from '../types/roomManagement';

const isActivePlacement = (p: Placement) => p.status === 'Active';

/** Statuses that mean nobody can be placed in the room (includes the older labels used by the Property form). */
export const OUT_OF_USE_STATUSES = ['Blocked', 'Void', 'Under Maintenance', 'Maintenance', 'Unavailable', 'Decommissioned'];
export const isOutOfUse = (status?: string) => OUT_OF_USE_STATUSES.includes(String(status || ''));
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/* ------------------------------------------------------------------ beds & occupancy */

/** Active placement for each bed id. */
export function bedAssignments(placements: Placement[]): Map<string, Placement> {
  const out = new Map<string, Placement>();
  for (const p of placements) if (isActivePlacement(p) && p.bedId) out.set(p.bedId, p);
  return out;
}

export interface BedView {
  bed: RoomBed;
  placement?: Placement;
  state: 'Occupied' | 'Available' | 'Out of Service';
}
export function bedViews(beds: RoomBed[], placements: Placement[]): BedView[] {
  const assigned = bedAssignments(placements);
  return [...beds]
    .sort((a, b) => a.bedLabel.localeCompare(b.bedLabel, undefined, { numeric: true }))
    .map(bed => {
      const placement = assigned.get(bed.id);
      const state = bed.status === 'Out of Service' ? 'Out of Service' : placement ? 'Occupied' : 'Available';
      return { bed, placement, state };
    });
}

/** Residents currently placed in the room who have not been given a bed yet. */
export function residentsWithoutBed(placements: Placement[]): Placement[] {
  return placements.filter(p => isActivePlacement(p) && !p.bedId);
}

/** Beds a given resident could be moved to (free, in service). */
export function freeBeds(beds: RoomBed[], placements: Placement[]): RoomBed[] {
  const assigned = bedAssignments(placements);
  return beds.filter(b => b.status !== 'Out of Service' && !assigned.has(b.id));
}

/* ------------------------------------------------------------------ room status & health */

export function suggestedOccupancy(capacity: number, residents: number): 'Available' | 'Partially Occupied' | 'Occupied' {
  const cap = Math.max(1, num(capacity) || 1);
  if (residents <= 0) return 'Available';
  return residents >= cap ? 'Occupied' : 'Partially Occupied';
}

export interface RoomHealthContext {
  placements: Placement[];
  beds: RoomBed[];
  items: RoomItem[];
  issues: RoomIssue[];
  today?: Date;
}
export interface RoomFlag {
  code:
    | 'over_capacity' | 'no_beds' | 'beds_differ_from_capacity' | 'residents_without_bed'
    | 'inspection_overdue' | 'urgent_issue' | 'open_issues' | 'missing_items' | 'damaged_items'
    | 'block_expired' | 'needs_cleaning' | 'void_with_residents';
  level: 'critical' | 'warning' | 'info';
  text: string;
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Things that need attention in a room, most serious first. */
export function roomFlags(room: PropertyRoom, ctx: RoomHealthContext): RoomFlag[] {
  const out: RoomFlag[] = [];
  const today = isoDay(ctx.today || new Date());
  const residents = ctx.placements.filter(isActivePlacement);
  const cap = Math.max(1, num(room.capacity) || 1);

  if (residents.length > cap) {
    out.push({ code: 'over_capacity', level: 'critical', text: `${residents.length} residents in a room for ${cap}.` });
  }
  if (residents.length > 0 && isOutOfUse(room.status)) {
    out.push({ code: 'void_with_residents', level: 'warning', text: `Room is marked ${room.status} but has ${residents.length} resident${residents.length > 1 ? 's' : ''}.` });
  }
  const openIssues = ctx.issues.filter(i => i.status === 'Open' || i.status === 'In Progress');
  const urgent = openIssues.filter(i => i.priority === 'Urgent' || i.priority === 'High');
  if (urgent.length) out.push({ code: 'urgent_issue', level: 'critical', text: `${urgent.length} high-priority issue${urgent.length > 1 ? 's' : ''} open.` });
  else if (openIssues.length) out.push({ code: 'open_issues', level: 'warning', text: `${openIssues.length} open issue${openIssues.length > 1 ? 's' : ''}.` });

  if (room.nextInspectionDue && String(room.nextInspectionDue).slice(0, 10) < today) {
    out.push({ code: 'inspection_overdue', level: 'warning', text: `Inspection was due ${String(room.nextInspectionDue).slice(0, 10)}.` });
  }
  if (room.status === 'Blocked' && room.blockedUntil && String(room.blockedUntil).slice(0, 10) < today) {
    out.push({ code: 'block_expired', level: 'info', text: `Block ended ${String(room.blockedUntil).slice(0, 10)}; review and release the room.` });
  }
  if (ctx.beds.length === 0) {
    out.push({ code: 'no_beds', level: 'info', text: 'No beds set up for this room.' });
  } else if (ctx.beds.length !== cap) {
    out.push({ code: 'beds_differ_from_capacity', level: 'info', text: `${ctx.beds.length} bed${ctx.beds.length > 1 ? 's' : ''} set up but capacity is ${cap}.` });
  }
  if (ctx.beds.length > 0 && residentsWithoutBed(ctx.placements).length > 0) {
    out.push({ code: 'residents_without_bed', level: 'info', text: `${residentsWithoutBed(ctx.placements).length} resident(s) not assigned to a bed.` });
  }
  const missing = ctx.items.filter(i => i.status === 'Missing');
  if (missing.length) out.push({ code: 'missing_items', level: 'warning', text: `${missing.length} item${missing.length > 1 ? 's' : ''} missing.` });
  const damaged = ctx.items.filter(i => i.status === 'Damaged');
  if (damaged.length) out.push({ code: 'damaged_items', level: 'warning', text: `${damaged.length} item${damaged.length > 1 ? 's' : ''} damaged.` });
  if (room.cleaningStatus === 'Dirty' || room.cleaningStatus === 'Deep Clean Due') {
    out.push({ code: 'needs_cleaning', level: 'info', text: room.cleaningStatus === 'Dirty' ? 'Needs cleaning.' : 'Deep clean due.' });
  }
  const order = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/* ------------------------------------------------------------------ room kits */

export interface KitPlanLine {
  itemId: string;
  itemName: string;
  category?: string;
  required: number;
  alreadyInRoom: number;
  /** quantity that will be put into the room by this plan */
  toIssue: number;
  /** quantity in the property's common stock */
  available: number;
  /** quantity still missing after using what the stock can give (0 when taking from stock is off) */
  shortfall: number;
}

/**
 * What applying a kit to a room would do.
 *  - already-present items are not added again;
 *  - `fromStock: true` only issues what the property actually holds (never goes negative) and reports the shortfall;
 *  - `fromStock: false` just records the items as in the room.
 */
export function planKitApplication(
  kit: Pick<RoomKitTemplate, 'items'>,
  roomItems: RoomItem[],
  stock: PropertyStock[],
  catalogue: InventoryItem[],
  fromStock: boolean
): KitPlanLine[] {
  return kit.items
    .filter(l => num(l.quantity) > 0)
    .map(line => {
      const item = catalogue.find(i => i.id === line.itemId);
      const required = Math.trunc(num(line.quantity));
      const alreadyInRoom = roomItems
        .filter(r => r.itemId === line.itemId && r.status === 'In Room')
        .reduce((n, r) => n + num(r.quantity), 0);
      const needed = Math.max(0, required - alreadyInRoom);
      const available = stock.filter(s => s.itemId === line.itemId).reduce((n, s) => n + num(s.quantityOnHand), 0);
      const toIssue = fromStock ? Math.min(needed, available) : needed;
      return {
        itemId: line.itemId,
        itemName: item?.itemName || line.itemId,
        category: item?.category,
        required,
        alreadyInRoom,
        toIssue,
        available,
        shortfall: fromStock ? needed - toIssue : 0,
      };
    });
}

/* ------------------------------------------------------------------ stock */

export type StockLevel = 'ok' | 'low' | 'out';
export function stockLevel(s: Pick<PropertyStock, 'quantityOnHand' | 'minimumLevel'>): StockLevel {
  const qty = num(s.quantityOnHand);
  if (qty <= 0) return 'out';
  const min = num(s.minimumLevel);
  return min > 0 && qty <= min ? 'low' : 'ok';
}

/** Can this many be taken from the common stock? Returns an error message, or null when fine. */
export function checkStockIssue(stock: Pick<PropertyStock, 'quantityOnHand'> | undefined, quantity: number): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) return 'Enter a whole number of 1 or more.';
  if (!stock) return 'This item is not held in the property stock.';
  if (num(stock.quantityOnHand) < quantity) return `Only ${num(stock.quantityOnHand)} in stock.`;
  return null;
}

/** Items that are tracked one by one need a serial / tag and a quantity of exactly 1 per record. */
export function validateRoomItem(
  item: Pick<InventoryItem, 'itemType' | 'requiresSerial'> | undefined,
  input: { quantity: number; serialNumber?: string }
): string | null {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) return 'Quantity must be a whole number of 1 or more.';
  if (item?.itemType === 'Asset' && input.quantity !== 1) return 'Tracked assets are recorded one at a time (quantity 1).';
  if (item?.requiresSerial && !(input.serialNumber || '').trim()) return 'This item needs a serial number or asset tag.';
  return null;
}

/* ------------------------------------------------------------------ rooms */

/**
 * Expand "101-110", "101, 103, 105-107" or "A1-A4" into room numbers.
 * Numeric ranges keep any prefix/suffix letters; ranges are capped to avoid accidents.
 */
export function expandRoomNumbers(input: string, max = 200): { numbers: string[]; error?: string } {
  const out: string[] = [];
  for (const part of String(input || '').split(/[,;\n]+/).map(p => p.trim()).filter(Boolean)) {
    const range = /^([A-Za-z]*)(\d+)\s*[-–]\s*([A-Za-z]*)(\d+)$/.exec(part);
    if (range) {
      const [, p1, a, p2, b] = range;
      if (p2 && p2.toLowerCase() !== p1.toLowerCase()) return { numbers: [], error: `"${part}" mixes different prefixes.` };
      const from = Number(a), to = Number(b);
      if (to < from) return { numbers: [], error: `"${part}" counts backwards.` };
      if (to - from + 1 > max) return { numbers: [], error: `A range can hold at most ${max} rooms.` };
      const width = a.length;
      for (let n = from; n <= to; n++) out.push(`${p1}${String(n).padStart(width, '0')}`);
    } else {
      out.push(part);
    }
    if (out.length > max) return { numbers: [], error: `At most ${max} rooms at a time.` };
  }
  const seen = new Set<string>();
  const dup = out.find(n => (seen.has(n.toLowerCase()) ? true : (seen.add(n.toLowerCase()), false)));
  if (dup) return { numbers: [], error: `Room "${dup}" appears twice.` };
  return { numbers: out };
}

/** A property cannot have two rooms with the same number. */
export function duplicateRoomNumber(rooms: Pick<PropertyRoom, 'id' | 'propertyId' | 'roomNumber'>[], propertyId: string, roomNumber: string, ignoreId?: string): boolean {
  const key = String(roomNumber).trim().toLowerCase();
  return rooms.some(r => r.propertyId === propertyId && r.id !== ignoreId && String(r.roomNumber).trim().toLowerCase() === key);
}

/** Rules for taking a room out of use. */
export function canChangeRoomStatus(
  next: string,
  residents: number,
  reason?: string
): string | null {
  if (isOutOfUse(next) && residents > 0) {
    return `${residents} resident${residents > 1 ? 's are' : ' is'} still placed here. Move them first.`;
  }
  if (['Blocked', 'Under Maintenance', 'Maintenance', 'Unavailable'].includes(next) && !(reason || '').trim()) {
    return 'Give a reason so everyone can see why the room is unavailable.';
  }
  return null;
}

/** Roll the room list up for the dashboard cards. */
export interface RoomRollup {
  rooms: number;
  beds: number;
  residents: number;
  available: number;
  occupied: number;
  partially: number;
  outOfUse: number;
  occupancyPct: number;
}
export function rollupRooms(rooms: PropertyRoom[], placements: Placement[]): RoomRollup {
  const active = placements.filter(isActivePlacement);
  const perRoom = new Map<string, number>();
  for (const p of active) perRoom.set(p.roomId, (perRoom.get(p.roomId) || 0) + 1);
  let beds = 0, available = 0, occupied = 0, partially = 0, outOfUse = 0;
  for (const r of rooms) {
    const cap = Math.max(1, num(r.capacity) || 1);
    const res = perRoom.get(r.id) || 0;
    if (isOutOfUse(r.status)) { outOfUse++; continue; }
    beds += cap;
    if (res === 0) available++;
    else if (res >= cap) occupied++;
    else partially++;
  }
  const residents = rooms.reduce((n, r) => n + (isOutOfUse(r.status) ? 0 : (perRoom.get(r.id) || 0)), 0);
  return {
    rooms: rooms.length, beds, residents, available, occupied, partially, outOfUse,
    occupancyPct: beds > 0 ? Math.round((residents / beds) * 100) : 0,
  };
}
