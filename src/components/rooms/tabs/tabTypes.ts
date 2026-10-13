import type { PropertyMaster, PropertyRoom } from '../../../types/masterData';
import type { RoomData } from '../useRoomData';

export interface RoomTabProps {
  room: PropertyRoom;
  property?: PropertyMaster;
  data: RoomData;
  /** all rooms of the property (for duplicate checks and transfer destinations) */
  allRooms: PropertyRoom[];
  /** name written into the timeline / ledger */
  actor: string;
  /** structural changes (edit/delete room, beds, stock, catalogue) are limited to managers */
  canManage: boolean;
  /** reload the room, its data, and the list behind the workspace */
  refresh: () => Promise<void>;
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
  /** close the workspace (after the room has been deleted) */
  close: () => void;
}
