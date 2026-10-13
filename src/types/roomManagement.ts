/**
 * Room Management types: beds, items in rooms, common stock, movements, kits, issues, timeline.
 * (Rooms themselves are PropertyRoom in masterData.ts; assets are PropertyAsset.)
 */

export const ROOM_STATUSES = ['Available', 'Reserved', 'Partially Occupied', 'Occupied', 'Under Maintenance', 'Blocked', 'Void'] as const;
export const ROOM_TYPES = ['Single', 'Twin', 'Triple', 'Family', 'Accessible', 'Studio', 'Dormitory', 'Staff / Office', 'Other'] as const;
export const BATHROOM_TYPES = ['En-suite', 'Shared', 'Wet room', 'None'] as const;
export const GENDER_RESTRICTIONS = ['None', 'Female only', 'Male only'] as const;
export const CLEANING_STATUSES = ['Clean', 'Dirty', 'Inspected', 'Deep Clean Due'] as const;
export const BED_TYPES = ['Single', 'Double', 'Bunk (top)', 'Bunk (bottom)', 'Cot', 'Profiling bed'] as const;
export const ITEM_CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Needs Replacement'] as const;
export const ROOM_ITEM_STATUSES = ['In Room', 'Missing', 'Damaged', 'Removed'] as const;
export const ISSUE_CATEGORIES = ['Maintenance', 'Electrical', 'Plumbing', 'Fire Safety', 'Pest', 'Damp / Mould', 'Furniture', 'Cleaning', 'Security', 'Other'] as const;
export const ISSUE_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export const ISSUE_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'] as const;
export const ITEM_CATEGORIES = ['Furniture', 'Bedding', 'Bathroom', 'Windows', 'Fire Safety', 'Electrical', 'Kitchen', 'Cleaning', 'Other'] as const;
export const MOVEMENT_TYPES = ['Purchase', 'Issue to Room', 'Return to Stock', 'Room Transfer', 'Damaged', 'Lost', 'Disposed', 'Stock Count'] as const;

export type RoomStatus = typeof ROOM_STATUSES[number];
export type MovementType = typeof MOVEMENT_TYPES[number];

export interface RoomBed {
  id: string;
  bedReference?: string;
  propertyId: string;
  roomId: string;
  bedLabel: string;
  bedType: string;
  /** Available | Out of Service. Occupancy comes from the resident placement that points at this bed. */
  status: string;
  mattressCondition?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryItem {
  id: string;
  itemCode?: string;
  itemName: string;
  category: string;
  /** Stock = counted (towels, bedding); Asset = tracked one by one (TV, fridge, detectors) */
  itemType: 'Stock' | 'Asset';
  unit?: string;
  defaultRoomQuantity?: number;
  reorderLevel?: number;
  unitCost?: number;
  supplier?: string;
  requiresSerial?: boolean;
  requiresInspection?: boolean;
  isActive?: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Common inventory: what a property holds in store, available to issue to rooms. */
export interface PropertyStock {
  id: string;
  propertyId: string;
  itemId: string;
  quantityOnHand: number;
  minimumLevel?: number;
  storageLocation?: string;
  lastCountedAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** An item placed in one room. */
export interface RoomItem {
  id: string;
  propertyId: string;
  roomId: string;
  itemId?: string;
  itemName: string;
  category?: string;
  quantity: number;
  condition: string;
  status: string;
  serialNumber?: string;
  assetId?: string;
  issuedDate?: string;
  lastCheckedAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryMovement {
  id: string;
  propertyId: string;
  movementType: string;
  itemId?: string;
  itemName: string;
  quantity: number;
  fromRoomId?: string;
  toRoomId?: string;
  reference?: string;
  reason?: string;
  performedByName?: string;
  performedAt?: string;
  notes?: string;
  createdAt?: string;
}

export interface KitTemplateLine {
  itemId: string;
  quantity: number;
}
export interface RoomKitTemplate {
  id: string;
  templateName: string;
  roomType?: string;
  description?: string;
  items: KitTemplateLine[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoomIssue {
  id: string;
  issueReference?: string;
  propertyId: string;
  roomId: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  description?: string;
  reportedBy?: string;
  reportedAt?: string;
  assignedTo?: string;
  dueDate?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  cost?: number;
  blocksRoom?: boolean;
  maintenanceRecordId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoomActivity {
  id: string;
  propertyId: string;
  roomId: string;
  activityType: string;
  title?: string;
  details?: string;
  performedByName?: string;
  performedAt?: string;
  createdAt?: string;
}
