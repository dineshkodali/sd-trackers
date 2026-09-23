import { ExportColumnOption, ExportFormat, ExportOrientation, ExportScope } from '../common/ExportModal';
import { 
  DailyRegisterRecord, 
  DailyRegisterRoom, 
  NewArrivalRecord, 
  DispersalRecord, 
  EvictionRecord 
} from '../../types';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';

export type DailyRegisterTab = 
  | 'stats'
  | 'roomList'
  | 'userGuide'
  | 'dailyRegister'
  | 'validation'
  | 'languages'
  | 'newArrivals'
  | 'summary';

export const DAILY_REGISTER_EXPORT_COLUMNS: ExportColumnOption[] = [
  { id: 'roomNo', label: 'Room No.', defaultSelected: true },
  { id: 'floor', label: 'Floor', defaultSelected: true },
  { id: 'roomMakeup', label: 'Room Makeup', defaultSelected: true },
  { id: 'portRef', label: 'Port Ref', defaultSelected: true },
  { id: 'name', label: 'Service User Name', defaultSelected: true },
  { id: 'checkInDate', label: 'Check In Date', defaultSelected: true },
  { id: 'contactNo', label: 'Contact No.', defaultSelected: true },
  { id: 'email', label: 'Email', defaultSelected: false },
  { id: 'dob', label: 'D.O.B.', defaultSelected: true },
  { id: 'nationality', label: 'Nationality', defaultSelected: true },
  { id: 'language', label: 'Language', defaultSelected: true },
  { id: 'gender', label: 'Gender', defaultSelected: true },
  { id: 'occupied', label: 'Occupied', defaultSelected: true },
  { id: 'isVoid', label: 'Void Status', defaultSelected: false }
];

export const ROOM_LIST_EXPORT_COLUMNS: ExportColumnOption[] = [
  { id: 'hotel', label: 'Hotel / Site', defaultSelected: true },
  { id: 'roomNo', label: 'Room No.', defaultSelected: true },
  { id: 'floor', label: 'Floor', defaultSelected: true },
  { id: 'roomType', label: 'Room Type', defaultSelected: true },
  { id: 'suCohort', label: 'SU Cohort', defaultSelected: true },
  { id: 'currentMaxOccupancy', label: 'Max Capacity', defaultSelected: true },
  { id: 'currentOccupancy', label: 'Current Occupancy', defaultSelected: true },
  { id: 'bedspacesAvailable', label: 'Available Beds', defaultSelected: true },
  { id: 'voidBedspaces', label: 'Void Beds', defaultSelected: true },
  { id: 'voidReason', label: 'Void Reason', defaultSelected: false },
  { id: 'sizeSqm', label: 'Size (sqm)', defaultSelected: false },
  { id: 'potentialMaxCapacity', label: 'Potential Max Cap', defaultSelected: false }
];

export const NEW_ARRIVALS_EXPORT_COLUMNS: ExportColumnOption[] = [
  { id: 'portReference', label: 'Port Reference', defaultSelected: true },
  { id: 'name', label: 'Full Name', defaultSelected: true },
  { id: 'dob', label: 'D.O.B.', defaultSelected: true },
  { id: 'country', label: 'Country of Origin', defaultSelected: true },
  { id: 'language', label: 'Primary Language', defaultSelected: true },
  { id: 'contactNumber', label: 'Contact Number', defaultSelected: true },
  { id: 'hotel', label: 'Allocated Hotel', defaultSelected: true },
  { id: 'room', label: 'Room Number', defaultSelected: true },
  { id: 'aspenCard', label: 'Aspen Card', defaultSelected: false },
  { id: 'status', label: 'Arrival Status', defaultSelected: true }
];

export const DISPERSAL_EXPORT_COLUMNS: ExportColumnOption[] = [
  { id: 'siteName', label: 'Site / Hotel', defaultSelected: true },
  { id: 'flatRoomNumber', label: 'Room / Flat', defaultSelected: true },
  { id: 'suPortNassRef', label: 'Port / NASS Ref', defaultSelected: true },
  { id: 'dispersalDate', label: 'Dispersal Date', defaultSelected: true },
  { id: 'dateLetterHandedToSu', label: 'Letter Handed Date', defaultSelected: true },
  { id: 'hoDispersalLetterReceived', label: 'Letter Received', defaultSelected: false },
  { id: 'travelled', label: 'Travelled', defaultSelected: true },
  { id: 'dateLeftProperty', label: 'Departure Date', defaultSelected: true },
  { id: 'reasonFailedToTravel', label: 'Reason Failed', defaultSelected: false }
];

export const EVICTION_EXPORT_COLUMNS: ExportColumnOption[] = [
  { id: 'hotel', label: 'Hotel / Site', defaultSelected: true },
  { id: 'roomNo', label: 'Room No.', defaultSelected: true },
  { id: 'portRef', label: 'Port Ref', defaultSelected: true },
  { id: 'suName', label: 'Service User Name', defaultSelected: true },
  { id: 'noticeDate', label: 'Notice Date', defaultSelected: true },
  { id: 'evictionDate', label: 'Eviction Date', defaultSelected: true },
  { id: 'evictionReason', label: 'Eviction Reason', defaultSelected: true },
  { id: 'status', label: 'Status', defaultSelected: true },
  { id: 'notes', label: 'Notes', defaultSelected: false }
];

export const GENERAL_REGISTER_EXPORT_COLUMNS: ExportColumnOption[] = [
  { id: 'hotel', label: 'Hotel / Site', defaultSelected: true },
  { id: 'roomNo', label: 'Room No.', defaultSelected: true },
  { id: 'floor', label: 'Floor', defaultSelected: false },
  { id: 'portRef', label: 'Port Ref', defaultSelected: true },
  { id: 'name', label: 'Service User Name', defaultSelected: true },
  { id: 'checkInDate', label: 'Check In Date', defaultSelected: true },
  { id: 'nationality', label: 'Nationality', defaultSelected: true },
  { id: 'language', label: 'Language', defaultSelected: true },
  { id: 'gender', label: 'Gender', defaultSelected: true },
  { id: 'occupied', label: 'Occupied', defaultSelected: true }
];

export interface RegisterExportContext {
  activeTab: DailyRegisterTab;
  dispersalSubTab?: 'dispersal' | 'eviction';
  effectiveSite: string;
  registerDate: string;
  scopedRooms: DailyRegisterRoom[];
  scopedRecords: DailyRegisterRecord[];
  scopedArrivals: NewArrivalRecord[];
  scopedDispersals?: DispersalRecord[];
  scopedEvictions?: EvictionRecord[];
  searchQuery: string;
  occupancyFilter: 'all' | 'Occupied' | 'Vacant';
}

export function getActiveRegisterExportConfig(ctx: RegisterExportContext) {
  const {
    activeTab,
    dispersalSubTab,
    effectiveSite,
    registerDate,
    scopedRooms,
    scopedRecords,
    scopedArrivals,
    scopedDispersals,
    scopedEvictions,
    searchQuery,
    occupancyFilter
  } = ctx;

  const q = searchQuery.toLowerCase().trim();

  if (activeTab === 'roomList') {
    const filtered = scopedRooms.filter(r => 
      !q || r.roomNo.toLowerCase().includes(q) || r.hotel.toLowerCase().includes(q) ||
      (r.floor && r.floor.toLowerCase().includes(q)) || (r.roomType && r.roomType.toLowerCase().includes(q))
    );
    return {
      moduleName: 'Room List & Inventory',
      title: 'Room & Bedspace Inventory Roster',
      filename: `Room_Inventory_${effectiveSite}_${registerDate}`,
      columns: ROOM_LIST_EXPORT_COLUMNS,
      totalCount: scopedRooms.length,
      filteredCount: filtered.length,
      getData: (scope: ExportScope) => scope === 'filtered' ? filtered : scopedRooms,
      formatRow: (r: DailyRegisterRoom, cols: ExportColumnOption[]) => cols.map(c => String((r as any)[c.id] ?? ''))
    };
  }

  if (activeTab === 'newArrivals') {
    const filtered = scopedArrivals.filter(a =>
      !q || a.name.toLowerCase().includes(q) || a.portReference.toLowerCase().includes(q) ||
      (a.hotel && a.hotel.toLowerCase().includes(q)) || (a.room && a.room.toLowerCase().includes(q))
    );
    return {
      moduleName: 'New Arrivals Queue',
      title: 'New Arrivals Reception & Intake Queue',
      filename: `New_Arrivals_${effectiveSite}_${registerDate}`,
      columns: NEW_ARRIVALS_EXPORT_COLUMNS,
      totalCount: scopedArrivals.length,
      filteredCount: filtered.length,
      getData: (scope: ExportScope) => scope === 'filtered' ? filtered : scopedArrivals,
      formatRow: (a: NewArrivalRecord, cols: ExportColumnOption[]) => cols.map(c => String((a as any)[c.id] ?? ''))
    };
  }


  // Default: Daily Register or Stats / Validation / Summary / Languages
  const filtered = scopedRecords.filter(r => {
    const matchesSearch = !q || r.name.toLowerCase().includes(q) || r.portRef.toLowerCase().includes(q) ||
      (r.roomNo && r.roomNo.toLowerCase().includes(q)) || (r.nationality && r.nationality.toLowerCase().includes(q));
    const matchesOccupancy = occupancyFilter === 'all' || 
      (occupancyFilter === 'Occupied' ? (r.occupied === 'Yes' || !r.occupied) : r.occupied === 'No');
    return matchesSearch && matchesOccupancy;
  });

  const isHeadcount = activeTab === 'dailyRegister';
  return {
    moduleName: isHeadcount ? 'Daily Headcount Register' : `${activeTab.toUpperCase()} Register`,
    title: isHeadcount ? `Live Daily Register — Headcount (${registerDate})` : `Daily Register (${activeTab.toUpperCase()})`,
    filename: `Daily_Register_${activeTab}_${effectiveSite}_${registerDate}`,
    columns: isHeadcount ? DAILY_REGISTER_EXPORT_COLUMNS : GENERAL_REGISTER_EXPORT_COLUMNS,
    totalCount: scopedRecords.length,
    filteredCount: filtered.length,
    getData: (scope: ExportScope, startDate?: string, endDate?: string) => {
      if (scope === 'filtered') return filtered;
      if (scope === 'custom' && startDate && endDate) {
        return scopedRecords.filter(r => {
          const d = r.checkInDate || '';
          return (!startDate || d >= startDate) && (!endDate || d <= endDate);
        });
      }
      return scopedRecords;
    },
    formatRow: (r: DailyRegisterRecord, cols: ExportColumnOption[]) => cols.map(c => String((r as any)[c.id] ?? ''))
  };
}

export function executeRegisterExport(options: {
  format: ExportFormat;
  scope: ExportScope;
  orientation: ExportOrientation;
  startDate?: string;
  endDate?: string;
  selectedColumns?: string[];
  config: ReturnType<typeof getActiveRegisterExportConfig>;
  effectiveSite: string;
}) {
  const { format, scope, orientation, startDate, endDate, selectedColumns, config, effectiveSite } = options;
  const rawData = config.getData(scope, startDate, endDate);
  const activeCols = selectedColumns && selectedColumns.length > 0
    ? config.columns.filter(c => selectedColumns.includes(c.id))
    : config.columns.filter(c => c.defaultSelected !== false);

  const headers = activeCols.map(c => c.label);
  const rows = rawData.map(item => config.formatRow(item, activeCols));

  if (format === 'csv') {
    exportTableToCsv({
      filename: `${config.filename}.csv`,
      headers,
      rows
    });
  } else {
    exportTableToPdf({
      filename: `${config.filename}.pdf`,
      title: config.title,
      subtitle: `Official Home Office AASC roster for site: ${effectiveSite === 'all' ? 'All Permitted Sites' : effectiveSite}`,
      headers,
      rows,
      orientation
    });
  }
}
