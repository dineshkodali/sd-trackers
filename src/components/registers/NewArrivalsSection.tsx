import React, { useState, useMemo, useEffect } from 'react';
import { IconUserPlus as UserPlus, IconPlus as Plus, IconEdit as Edit3, IconEye as Eye, IconBed as BedDouble, IconRefresh as RefreshCw } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { NewArrivalRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { useTableSchema } from '../../hooks/useTableSchema';
import { NEW_ARRIVALS_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { evaluateRegisterAllocation, isArrivalAllocated } from '../../utils/roomAllocation';
import { roomChoices } from '../../utils/interconnectingRooms';
import { syncArrivalToServiceUser } from '../../utils/arrivalServiceUserSync';
import { applyArrivalProfileDetails } from '../../services/arrivalProfileService';
import { hasAnyDetail, type ArrivalProfileDetails } from '../../utils/arrivalProfileSync';

/** Form fields that belong to the Service User's profile, not to the arrival record. */
const INTAKE_KEYS = ['suComments', 'dietaryRequirements', 'availableToBook', 'gpRegistered', 'gpPractice', 'pharmacy', 'nhsNumber'];

interface NewArrivalsSectionProps {
  selectedSite: string;
  searchQuery?: string;
  createTrigger?: number;
  exportTrigger?: { format: 'csv' | 'pdf'; ts: number } | null;
  customizeTrigger?: number;
}

export const NewArrivalsSection: React.FC<NewArrivalsSectionProps> = ({ 
  selectedSite,
  searchQuery: externalSearchQuery,
  createTrigger,
  exportTrigger,
  customizeTrigger
}) => {
  const {
    newArrivalsRecords,
    addNewArrivalRecord,
    updateNewArrivalRecord,
    addDailyRegisterRecord,
    dailyRegisterRooms,
    dailyRegisterRecords,
    canCreateRecord,
    canEditRecord,
    currentUserRole,
    assignedSite,
    syncFromDatabase,
    liveDataStatus,
    isSitePermitted,
    currentUserName,
    sites
  } = useApp();

  // One save at a time: a double click (or Enter twice) must not create two arrivals or two profile updates.
  const savingRef = React.useRef(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncFromDatabase();
    } finally {
      setIsSyncing(false);
    }
  };

  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<NewArrivalRecord>('newArrivals', NEW_ARRIVALS_TABLE_COLUMNS);

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const [allocationFilter, setAllocationFilter] = useState<'pending' | 'allocated' | 'all'>('pending');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NewArrivalRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<NewArrivalRecord | null>(null);

  // Sync with external triggers
  useEffect(() => {
    if (createTrigger && createTrigger > 0 && canCreateRecord()) {
      setIsCreateModalOpen(true);
    }
  }, [createTrigger]);

  useEffect(() => {
    if (customizeTrigger && customizeTrigger > 0 && currentUserRole === 'Super Admin') {
      setIsSchemaModalOpen(true);
    }
  }, [customizeTrigger]);

  const defaultSite = useMemo(() => {
    if (selectedSite && selectedSite !== 'all' && selectedSite !== 'All Sites') return selectedSite;
    if (assignedSite && assignedSite !== 'all' && assignedSite !== 'All Sites') return assignedSite;
    return 'Brit Hotel';
  }, [selectedSite, assignedSite]);

  const arrivalCounts = useMemo(() => {
    let pending = 0;
    let allocated = 0;
    newArrivalsRecords.forEach(r => {
      if (isSitePermitted(r.hotel, selectedSite)) {
        if (isArrivalAllocated(r, dailyRegisterRecords).allocated) {
          allocated++;
        } else {
          pending++;
        }
      }
    });
    return { pending, allocated, total: pending + allocated };
  }, [newArrivalsRecords, dailyRegisterRecords, selectedSite, isSitePermitted]);

  const filteredArrivals = useMemo(() => {
    return newArrivalsRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.name?.toLowerCase().includes(q) ||
        r.portReference?.toLowerCase().includes(q) ||
        (r.hotel && r.hotel.toLowerCase().includes(q)) ||
        (r.room && r.room.toLowerCase().includes(q)) ||
        (r.country && r.country.toLowerCase().includes(q));

      const matchesSite = isSitePermitted(r.hotel, selectedSite);
      if (!matchesSearch || !matchesSite) return false;

      const isAlloc = isArrivalAllocated(r, dailyRegisterRecords).allocated;
      if (allocationFilter === 'pending') return !isAlloc;
      if (allocationFilter === 'allocated') return isAlloc;
      return true;
    });
  }, [newArrivalsRecords, searchQuery, selectedSite, isSitePermitted, allocationFilter, dailyRegisterRecords]);

  const sortedArrivals = useMemo(() => {
    return [...filteredArrivals].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      return sortOrder === 'asc' 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredArrivals, sortKey, sortOrder]);

  const paginatedArrivals = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedArrivals.slice(startIndex, startIndex + pageSize);
  }, [sortedArrivals, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // Room is a dropdown limited to the selected hotel's rooms that still have a free bed, so a room
  // from another property can never be typed in. The room being edited stays selectable.
  const formColumns = useMemo<TableColumnConfig<NewArrivalRecord>[]>(() => columns.map(col => {
    if (col.key === 'hotel') {
      return { ...col, onValueChange: () => ({ room: '' }) };
    }
    if (col.key !== 'room') return col;
    return {
      ...col,
      type: 'select',
      placeholder: 'Select a room',
      helperText: 'Only rooms in the selected hotel with a free bed are listed. For a family, any room of an interconnecting group can be chosen.',
      options: (ctx?: any) => {
        const form = ctx?.formData || {};
        const hotel = String(form.hotel || '');
        if (!hotel) return [];
        // Interconnecting rooms name the rooms they connect to and whether the group still has space.
        return roomChoices(dailyRegisterRooms, dailyRegisterRecords, hotel, String(form.room || '')).map(({ label, value }) => ({ label, value }));
      }
    };
  }), [columns, dailyRegisterRooms, dailyRegisterRecords]);

  // Editing an arrival changes the arrival only; the intake details live on the profile, so they are not offered here.
  const editColumns = useMemo(() => formColumns.filter(c => !INTAKE_KEYS.includes(String(c.key))), [formColumns]);

  const handleCreateSubmit = async (data: Partial<NewArrivalRecord>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await createArrival(data);
    } finally {
      savingRef.current = false;
    }
  };

  const createArrival = async (data: Partial<NewArrivalRecord>) => {
    const finalHotel = (data.hotel && data.hotel !== 'All Sites' && data.hotel !== 'all')
      ? data.hotel
      : defaultSite;

    if (!isSitePermitted(finalHotel)) {
      alert('You are not permitted to add arrival records for this property.');
      return;
    }

    const checkInDate = data.checkInDate || new Date().toISOString().slice(0, 10);
    const roomInput = (data.room || '').trim();

    // A valid, free room checks the person straight into the Daily Register; otherwise they stay "Arrived".
    const check = roomInput
      ? evaluateRegisterAllocation({
          rooms: dailyRegisterRooms,
          records: dailyRegisterRecords,
          hotel: finalHotel,
          roomNo: roomInput,
          portRef: data.portReference || ''
        })
      : null;
    const allocatedRoom = check?.ok ? check.room! : null;

    addNewArrivalRecord({
      portReference: data.portReference || '',
      name: data.name || '',
      dob: data.dob || '',
      country: data.country || '',
      language: data.language || '',
      contactNumber: data.contactNumber || '',
      hotel: allocatedRoom?.hotel || finalHotel,
      room: allocatedRoom?.roomNo || roomInput,
      email: data.email || '',
      aspenCard: data.aspenCard || '',
      checkInDate,
      status: allocatedRoom ? 'Checked In' : (data.status || 'Arrived'),
      attachments: []
    } as any);
    setIsCreateModalOpen(false);

    if (allocatedRoom) {
      addDailyRegisterRecord({
        hotel: allocatedRoom.hotel,
        roomNo: allocatedRoom.roomNo,
        floor: allocatedRoom.floor || undefined,
        registerDate: checkInDate,
        dailyOccupancy: { [checkInDate]: 'Occupied' },
        portRef: data.portReference || '',
        name: data.name || '',
        checkInDate,
        contactNo: data.contactNumber,
        email: data.email,
        aspenCard: data.aspenCard || '',
        dob: data.dob,
        nationality: data.country,
        language: data.language,
        singleBed: 1,
        doubleBed: 0,
        singleBunk: 0,
        doubleBunk: 0,
        cot: 0,
        occupied: 'Yes',
        isVoid: 'No',
        availableToBook: data.availableToBook === 'Yes' ? 'Yes' : 'No',
        suComments: (data.suComments || '').trim() || undefined
      });
    } else if (check && !check.ok) {
      alert(`${data.name} was recorded as Arrived, but not placed in room ${roomInput}: ${check.error}`);
    }

    // Also register the person in Service User Management and the Rooms module.
    try {
      const sync = await syncArrivalToServiceUser({
        portReference: data.portReference,
        name: data.name || '',
        dob: data.dob,
        country: data.country,
        language: data.language,
        contactNumber: data.contactNumber,
        email: data.email,
        hotel: allocatedRoom?.hotel || finalHotel,
        room: allocatedRoom?.roomNo || roomInput,
        checkInDate
      }, sites as any);
      const gpNo = data.gpRegistered === 'No';
      const details: ArrivalProfileDetails = {
        suComments: data.suComments, dietaryRequirements: data.dietaryRequirements,
        gpRegistered: data.gpRegistered, gpPractice: gpNo ? '' : data.gpPractice, pharmacy: gpNo ? '' : data.pharmacy, nhsNumber: data.nhsNumber
      };
      const lines: string[] = [...sync.warnings];
      if (hasAnyDetail(details)) {
        if (!sync.serviceUser) {
          lines.push('The health, safeguarding and GP details were NOT saved to a profile because no Service User could be created or found. Add them from the Service User profile.');
        } else {
          const res = await applyArrivalProfileDetails(sync.serviceUser.id, details, currentUserName);
          if (!res.ok) lines.push(`The arrival was saved, but the extra details were NOT saved to the Service User profile: ${res.error}`);
          else {
            if (res.saved.length) lines.push(`Saved to ${data.name}'s profile: ${res.saved.join(', ')}.`);
            if (res.kept.length) lines.push(`Not changed because the profile already has a value (${res.kept.join('; ')}).`);
          }
        }
      }
      if (lines.length) alert(lines.join('\n'));
    } catch (err: any) {
      alert(`Arrival saved, but the Service User record could not be created: ${err?.message || 'unknown error'}`);
    }
  };

  // Anyone who can see an arrival's property may edit it (arrival details are corrected by frontline staff).
  // Records are never deleted from here.
  const canEditArrival = (a: NewArrivalRecord) => isSitePermitted(a.hotel, 'all') || canEditRecord(a.hotel);

  const handleEditSubmit = (data: Partial<NewArrivalRecord>) => {
    if (!editingRecord) return;
    updateNewArrivalRecord(editingRecord.id, { ...editingRecord, ...data });
    setEditingRecord(null);
  };

  // Quick Action: Assign to Daily Register
  const handleAssignToDailyRegister = (arrival: NewArrivalRecord) => {
    if (!arrival.room) {
      alert(`Please assign a room number to ${arrival.name} first.`);
      setEditingRecord(arrival);
      return;
    }

    if (!isSitePermitted(arrival.hotel)) {
      alert('You are not permitted to check residents into this property.');
      return;
    }

    const check = evaluateRegisterAllocation({
      rooms: dailyRegisterRooms,
      records: dailyRegisterRecords,
      hotel: arrival.hotel,
      roomNo: arrival.room.trim(),
      portRef: arrival.portReference
    });
    if (!check.ok) {
      alert(`Cannot check in ${arrival.name}: ${check.error}`);
      setEditingRecord(arrival);
      return;
    }
    const allocatedRoom = check.room!;
    const checkInDate = arrival.checkInDate || new Date().toISOString().slice(0, 10);

    addDailyRegisterRecord({
      hotel: allocatedRoom.hotel,
      roomNo: allocatedRoom.roomNo,
      floor: allocatedRoom.floor || undefined,
      registerDate: checkInDate,
      dailyOccupancy: { [checkInDate]: 'Occupied' },
      portRef: arrival.portReference,
      name: arrival.name,
      checkInDate,
      contactNo: arrival.contactNumber,
      email: arrival.email,
      aspenCard: arrival.aspenCard || '',
      dob: arrival.dob,
      nationality: arrival.country,
      language: arrival.language,
      singleBed: 1,
      doubleBed: 0,
      singleBunk: 0,
      doubleBunk: 0,
      cot: 0,
      occupied: 'Yes',
      isVoid: 'No',
      availableToBook: 'No'
    });

    // Store the canonical room number so the arrival, register and room list always line up.
    updateNewArrivalRecord(arrival.id, { status: 'Checked In', room: allocatedRoom.roomNo, hotel: allocatedRoom.hotel, checkInDate });
  };

  const handleExportCsv = () => {
    const headers = ['Port Ref', 'Name', 'D.O.B.', 'Country', 'Language', 'Contact No.', 'Check-in Date', 'Hotel', 'Room', 'Email', 'Aspen Card', 'Status'];
    const rows = sortedArrivals.map(r => [
      r.portReference, r.name, r.dob || '', r.country || '', r.language || '',
      r.contactNumber || '', r.checkInDate || '', r.hotel, r.room || '', r.email || '', r.aspenCard || '', r.status || 'Arrived'
    ]);
    exportTableToCsv({ filename: 'New_Arrivals_Queue.csv', headers, rows });
  };

  const handleExportPdf = () => {
    const headers = ['Port Ref', 'Name', 'D.O.B.', 'Country', 'Language', 'Contact No.', 'Check-in Date', 'Hotel', 'Room', 'Status'];
    const rows = sortedArrivals.map(r => [
      r.portReference, r.name, r.dob || '', r.country || '', r.language || '',
      r.contactNumber || '', r.checkInDate || '', r.hotel, r.room || '', r.status || 'Arrived'
    ]);
    exportTableToPdf({
      filename: `New_Arrivals_${new Date().toISOString().slice(0, 10)}.pdf`,
      title: 'New Arrivals Intake Register',
      subtitle: `Arrivals roster for ${selectedSite === 'all' ? 'All Permitted Sites' : selectedSite}`,
      headers,
      rows,
      orientation: 'landscape'
    });
  };

  useEffect(() => {
    if (exportTrigger && exportTrigger.ts > 0) {
      if (exportTrigger.format === 'csv') {
        handleExportCsv();
      } else {
        handleExportPdf();
      }
    }
  }, [exportTrigger]);

  return (
    <div className="space-y-3">
      {/* Subheader Toolbar with Live Sync & Create Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#faf9f8] p-2.5 border border-[#e1dfdd] rounded-xs">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[#0d9488]" />
          <span className="font-bold text-xs text-[#242424]">Intake Queue</span>
          <span className="bg-teal-50 text-[#0d9488] font-bold px-2 py-0.5 rounded text-[11px] border border-teal-200">
            {filteredArrivals.length} {filteredArrivals.length === 1 ? 'Resident' : 'Residents'}
          </span>
          {liveDataStatus?.lastSyncAt && (
            <span className="text-[11px] text-[#605e5c] hidden sm:inline">
              · Live Synced {new Date(liveDataStatus.lastSyncAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs shadow-2xs cursor-pointer transition-colors"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#0d9488]' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Live DB'}</span>
          </button>

          {canCreateRecord() && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-2xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Arrival</span>
            </button>
          )}
        </div>
      </div>

      {/* Allocation Status Tabs */}
      <div className="flex items-center gap-2 border-b border-[#edebe9] pb-2 text-xs">
        <button
          type="button"
          onClick={() => { setAllocationFilter('pending'); setCurrentPage(1); }}
          className={`px-3 py-1.5 rounded-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            allocationFilter === 'pending'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-neutral-100 text-[#605e5c] hover:bg-neutral-200'
          }`}
        >
          <span>Awaiting Room Allocation</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${allocationFilter === 'pending' ? 'bg-amber-700 text-white' : 'bg-neutral-200 text-[#323130]'}`}>
            {arrivalCounts.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setAllocationFilter('allocated'); setCurrentPage(1); }}
          className={`px-3 py-1.5 rounded-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            allocationFilter === 'allocated'
              ? 'bg-[#0d9488] text-white shadow-xs'
              : 'bg-neutral-100 text-[#605e5c] hover:bg-neutral-200'
          }`}
        >
          <span>Allocated to Rooms</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${allocationFilter === 'allocated' ? 'bg-teal-800 text-white' : 'bg-neutral-200 text-[#323130]'}`}>
            {arrivalCounts.allocated}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setAllocationFilter('all'); setCurrentPage(1); }}
          className={`px-3 py-1.5 rounded-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            allocationFilter === 'all'
              ? 'bg-neutral-800 text-white shadow-xs'
              : 'bg-neutral-100 text-[#605e5c] hover:bg-neutral-200'
          }`}
        >
          <span>All Arrivals History</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${allocationFilter === 'all' ? 'bg-neutral-950 text-white' : 'bg-neutral-200 text-[#323130]'}`}>
            {arrivalCounts.total}
          </span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[500px] lg:min-h-[calc(100vh-270px)] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th className="p-2.5 cursor-pointer hover:bg-[#edebe9]" onClick={() => handleSort('portReference')}>Port Ref</th>
                <th className="p-2.5 cursor-pointer hover:bg-[#edebe9]" onClick={() => handleSort('name')}>Name</th>
                <th className="p-2.5">D.O.B.</th>
                <th className="p-2.5">Country</th>
                <th className="p-2.5">Language</th>
                <th className="p-2.5">Contact No.</th>
                <th className="p-2.5 cursor-pointer hover:bg-[#edebe9]" onClick={() => handleSort('checkInDate')}>Check-in Date</th>
                <th className="p-2.5">Hotel</th>
                <th className="p-2.5">Allocated Room</th>
                <th className="p-2.5">Aspen Card</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right w-36 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedArrivals.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-[#605e5c]">
                    <UserPlus className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">
                      {allocationFilter === 'pending'
                        ? 'No pending arrivals awaiting room allocation'
                        : allocationFilter === 'allocated'
                          ? 'No allocated arrivals found'
                          : 'No new arrivals recorded'}
                    </p>
                    <p className="text-xs text-[#605e5c] mt-0.5">
                      {allocationFilter === 'pending'
                        ? 'All registered service users have been allocated to rooms.'
                        : "Click '+ Record Arrival' to log new incoming residents."}
                    </p>
                    {canCreateRecord() && (
                      <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold rounded-xs transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Record New Arrival</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedArrivals.map(arrival => {
                  const allocInfo = isArrivalAllocated(arrival, dailyRegisterRecords);
                  return (
                    <tr key={arrival.id} className="hover:bg-[#f0fdf4] transition-colors">
                      <td className="p-2.5 font-mono font-bold text-indigo-700">{arrival.portReference}</td>
                      <td className="p-2.5 font-semibold text-[#242424]">{arrival.name}</td>
                      <td className="p-2.5 text-[#605e5c]">{arrival.dob || '—'}</td>
                      <td className="p-2.5">{arrival.country || '—'}</td>
                      <td className="p-2.5">{arrival.language || '—'}</td>
                      <td className="p-2.5 text-[#605e5c]">{arrival.contactNumber || '—'}</td>
                      <td className="p-2.5 whitespace-nowrap">{arrival.checkInDate || '—'}</td>
                      <td className="p-2.5 font-medium">{arrival.hotel}</td>
                      <td className="p-2.5 font-mono font-semibold text-[#0f766e]">
                        {allocInfo.roomNo || arrival.room || <span className="text-amber-700 italic font-normal">Awaiting Room</span>}
                      </td>
                      <td className="p-2.5 font-mono">{arrival.aspenCard || '—'}</td>
                      <td className="p-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                          allocInfo.allocated 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {allocInfo.allocated ? `Allocated (${allocInfo.roomNo || arrival.room})` : 'Awaiting Allocation'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-end gap-1.5">
                          {!allocInfo.allocated && canEditArrival(arrival) && (
                            <button
                              onClick={() => handleAssignToDailyRegister(arrival)}
                              className="p-1 hover:bg-emerald-50 text-emerald-700 rounded-xs flex items-center gap-0.5 text-[11px] font-semibold cursor-pointer"
                              title="Assign to Room & Check-In"
                            >
                              <BedDouble className="w-3.5 h-3.5" />
                              <span>Allocate</span>
                            </button>
                          )}
                          <button
                            onClick={() => setViewingRecord(arrival)}
                            className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEditArrival(arrival) && (
                            <button
                              onClick={() => setEditingRecord(arrival)}
                              className="p-1 hover:bg-teal-50 text-[#0d9488] rounded-xs"
                              title="Edit Arrival"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredArrivals.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {/* Dynamic Create Modal */}
      <DynamicRecordFormModal<NewArrivalRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Record New Arrival"
        columns={formColumns}
        initialValues={{
          hotel: defaultSite,
          portReference: '',
          name: '',
          status: 'Arrived'
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Save Arrival"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<NewArrivalRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Arrival: ${editingRecord.name}`}
          columns={editColumns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<NewArrivalRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`New Arrival Details: ${viewingRecord.name} (${viewingRecord.portReference})`}
          columns={columns}
          record={viewingRecord}
          onEdit={() => {
            const rec = viewingRecord;
            setViewingRecord(null);
            setEditingRecord(rec);
          }}
          canEdit={canEditArrival(viewingRecord)}
        />
      )}

      {/* Super Admin Schema Customizer */}
      <TableSchemaEditorModal<NewArrivalRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="New Arrivals Table"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
