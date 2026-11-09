import React, { useState, useMemo, useEffect } from 'react';
import { 
  IconUsers as Users, 
  IconEdit as Edit3, 
  IconTrash as Trash2, 
  IconEye as Eye,
  IconChevronDown as ChevronDown,
  IconChevronRight as ChevronRight,
  IconShieldExclamation as ShieldAlert,
  IconFlame as Flame,
  IconStethoscope as Stethoscope,
  IconClipboardCheck as ClipboardCheck
} from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { DailyRegisterRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { useTableSchema } from '../../hooks/useTableSchema';
import { DAILY_REGISTER_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { evaluateRegisterAllocation } from '../../utils/roomAllocation';
import { roomChoices } from '../../utils/interconnectingRooms';
import { NO_GUEST_FILTER, buildGuests, emptyGuestContext, filterRegisterRecords, type GuestContext, type GuestFilter } from '../../utils/guestStats';
import { suPropertyService } from '../../services/suPropertyService';
import { ServiceUserMaster } from '../../types/masterData';

interface DailyRegisterSectionProps {
  selectedSite: string;
  registerDate: string;
  onDateChange?: (date: string) => void;
  searchQuery?: string;
  occupancyFilter?: 'all' | 'Occupied' | 'Vacant';
  createTrigger?: number;
  exportTrigger?: { format: 'csv' | 'pdf'; ts: number } | null;
  customizeTrigger?: number;
  /** Age, gender, family size and Aspen card filters chosen in the register toolbar. */
  guestFilter?: GuestFilter;
  guestContext?: GuestContext;
}

export const DailyRegisterSection: React.FC<DailyRegisterSectionProps> = ({
  selectedSite,
  registerDate,
  onDateChange,
  searchQuery: externalSearchQuery,
  occupancyFilter: externalOccupancyFilter,
  createTrigger,
  exportTrigger,
  customizeTrigger,
  guestFilter = NO_GUEST_FILTER,
  guestContext
}) => {
  const {
    dailyRegisterRecords,
    dailyRegisterRooms,
    addDailyRegisterRecord,
    updateDailyRegisterRecord,
    deleteDailyRegisterRecord,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    assignedSite,
    isSitePermitted
  } = useApp();

  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<DailyRegisterRecord>('dailyRegisterRecords', DAILY_REGISTER_TABLE_COLUMNS);

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [localOccupancyFilter, setLocalOccupancyFilter] = useState<'all' | 'Occupied' | 'Vacant'>('all');
  
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const occupancyFilter = externalOccupancyFilter !== undefined ? externalOccupancyFilter : localOccupancyFilter;

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('roomNo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Inspection & Service User Safeguarding Cross-reference
  const [serviceUsers, setServiceUsers] = useState<ServiceUserMaster[]>([]);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    suPropertyService.getServiceUsers(selectedSite !== 'all' ? selectedSite : undefined)
      .then(res => {
        if (active && res.success && res.data) {
          setServiceUsers(res.data);
        }
      })
      .catch(err => console.warn('Could not load Service Users for Register:', err));
    return () => { active = false; };
  }, [selectedSite]);

  const suByPortRef = useMemo(() => {
    const map = new Map<string, ServiceUserMaster>();
    serviceUsers.forEach(u => {
      if (u.externalReference?.trim()) {
        map.set(u.externalReference.trim().toLowerCase(), u);
      }
    });
    return map;
  }, [serviceUsers]);

  const suByName = useMemo(() => {
    const map = new Map<string, ServiceUserMaster>();
    serviceUsers.forEach(u => {
      const name = `${u.firstName} ${u.lastName}`.trim().toLowerCase();
      if (name) map.set(name, u);
    });
    return map;
  }, [serviceUsers]);

  const toggleRowExpand = (e: React.SyntheticEvent, id: string) => {
    e.stopPropagation();
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DailyRegisterRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<DailyRegisterRecord | null>(null);

  // Parent triggers for action bar
  useEffect(() => {
    if (createTrigger && createTrigger > 0) {
      setIsCreateModalOpen(true);
    }
  }, [createTrigger]);

  useEffect(() => {
    if (customizeTrigger && customizeTrigger > 0) {
      setIsSchemaModalOpen(true);
    }
  }, [customizeTrigger]);

  const guestCtx = useMemo(() => guestContext ?? emptyGuestContext(), [guestContext]);

  const filteredRecords = useMemo(() => {
    const base = dailyRegisterRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.name.toLowerCase().includes(q) ||
        r.portRef.toLowerCase().includes(q) ||
        r.roomNo.toLowerCase().includes(q) ||
        (r.nationality && r.nationality.toLowerCase().includes(q)) ||
        (r.language && r.language.toLowerCase().includes(q));

      const matchesSite = isSitePermitted(r.hotel, selectedSite);
      const matchesOcc = occupancyFilter === 'all' || 
        (occupancyFilter === 'Occupied' ? (r.occupied === 'Yes' || !r.occupied) : r.occupied === 'No');

      return matchesSearch && matchesSite && matchesOcc;
    });
    return filterRegisterRecords(base, guestCtx, guestFilter, registerDate);
  }, [dailyRegisterRecords, searchQuery, selectedSite, occupancyFilter, isSitePermitted, guestCtx, guestFilter, registerDate]);

  // Age and Aspen card for each row, worked out by the same rules as the filters and the Dashboard.
  const guestByRecord = useMemo(
    () => new Map(buildGuests(filteredRecords, guestCtx, registerDate).map(g => [g.record.id, g])),
    [filteredRecords, guestCtx, registerDate]
  );

  // Room is a list of the property's rooms that still have a free bed. Interconnecting rooms name
  // the rooms they connect to and how many of the group still have space.
  const formColumns = useMemo<TableColumnConfig<DailyRegisterRecord>[]>(() => columns.map(col => {
    if (col.key !== 'roomNo') return col;
    return {
      ...col,
      type: 'select',
      placeholder: 'Select a room',
      helperText: 'Rooms with a free bed. For a family, choose any room of an interconnecting group.',
      options: (ctx?: any) => {
        const form = ctx?.formData || {};
        const hotel = String(form.hotel || '');
        if (!hotel) return [];
        return roomChoices(dailyRegisterRooms, dailyRegisterRecords, hotel, String(form.roomNo || '')).map(({ label, value }) => ({ label, value }));
      }
    };
  }), [columns, dailyRegisterRooms, dailyRegisterRecords]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc' 
        ? String(valA).localeCompare(String(valB), undefined, { numeric: true }) 
        : String(valB).localeCompare(String(valA), undefined, { numeric: true });
    });
  }, [filteredRecords, sortKey, sortOrder]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRecords.slice(startIndex, startIndex + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleCreateSubmit = (data: Partial<DailyRegisterRecord>) => {
    const targetSite = data.hotel || (selectedSite !== 'all' ? selectedSite : (assignedSite || 'Brit Hotel'));
    if (!isSitePermitted(targetSite)) {
      alert('You are not permitted to log records for this property.');
      return;
    }
    let roomNo = (data.roomNo || '').trim();
    if ((data.occupied || 'Yes') !== 'No') {
      const check = evaluateRegisterAllocation({
        rooms: dailyRegisterRooms, records: dailyRegisterRecords, hotel: targetSite, roomNo, portRef: data.portRef
      });
      if (!check.ok) {
        alert(check.error);
        return;
      }
      roomNo = check.room!.roomNo;
    }
    addDailyRegisterRecord({
      hotel: targetSite,
      roomNo,
      floor: data.floor || 'Ground',
      roomMakeup: data.roomMakeup || '',
      singleBed: Number(data.singleBed) || 0,
      doubleBed: Number(data.doubleBed) || 0,
      singleBunk: Number(data.singleBunk) || 0,
      doubleBunk: Number(data.doubleBunk) || 0,
      cot: Number(data.cot) || 0,
      suMakeup: data.suMakeup || '',
      portRef: data.portRef || '',
      name: data.name || '',
      checkInDate: data.checkInDate || new Date().toISOString().slice(0, 10),
      contactNo: data.contactNo || '',
      email: data.email || '',
      dob: data.dob || '',
      age: data.age ? Number(data.age) : undefined,
      ageGroup: data.ageGroup || '',
      nationality: data.nationality || '',
      language: data.language || '',
      gender: data.gender || '',
      aspenCard: data.aspenCard || '',
      suComments: data.suComments || '',
      availableToBook: data.availableToBook || 'No',
      isVoid: data.isVoid || 'No',
      voidReason: data.voidReason || '',
      maintenanceDateFrom: data.maintenanceDateFrom || '',
      allocationToBeReviewed: data.allocationToBeReviewed || 'No',
      occupied: data.occupied || 'Yes',
      registerDate: registerDate || new Date().toISOString().slice(0, 10),
      dailyOccupancy: { [registerDate]: 'Occupied' },
      attachments: []
    } as any);
    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<DailyRegisterRecord>) => {
    if (!editingRecord) return;
    const merged = { ...editingRecord, ...data };
    if (merged.occupied !== 'No') {
      const check = evaluateRegisterAllocation({
        rooms: dailyRegisterRooms, records: dailyRegisterRecords, hotel: merged.hotel,
        roomNo: (merged.roomNo || '').trim(), portRef: merged.portRef, excludeRecordId: editingRecord.id
      });
      if (!check.ok) {
        alert(check.error);
        return;
      }
    }
    updateDailyRegisterRecord(editingRecord.id, {
      ...editingRecord,
      ...data,
      singleBed: Number(data.singleBed) || 0,
      doubleBed: Number(data.doubleBed) || 0,
      singleBunk: Number(data.singleBunk) || 0,
      doubleBunk: Number(data.doubleBunk) || 0,
      cot: Number(data.cot) || 0
    });
    setEditingRecord(null);
  };

  const handleExportCsv = () => {
    const headers = ['Room No.', 'Floor', 'Room Makeup', 'Single Bed', 'Double Bed', 'Single Bunk', 'Double Bunk', 'Cot', 'SU Make Up', 'Port Ref', 'Name', 'Check In Date', 'Contact No.', 'Email', 'D.O.B.', 'Age', 'Nationality', 'Language', 'Gender', 'Occupied', 'Void'];
    const rows = sortedRecords.map(r => [r.roomNo, r.floor || '', r.roomMakeup || '', String(r.singleBed || 0), String(r.doubleBed || 0), String(r.singleBunk || 0), String(r.doubleBunk || 0), String(r.cot || 0), r.suMakeup || '', r.portRef, r.name, r.checkInDate, r.contactNo || '', r.email || '', r.dob || '', String(r.age || ''), r.nationality || '', r.language || '', r.gender || '', r.occupied || 'Yes', r.isVoid || 'No']);
    exportTableToCsv({ filename: `Daily_Register_${registerDate}.csv`, headers, rows });
  };

  const handleExportPdf = () => {
    const headers = ['Room No', 'Floor', 'Port Ref', 'Name', 'Check In', 'Nationality', 'Language', 'Gender', 'Occupied'];
    const rows = sortedRecords.map(r => [
      r.roomNo, r.floor || '', r.portRef, r.name, r.checkInDate, r.nationality || '', r.language || '', r.gender || '', r.occupied || 'Yes'
    ]);
    exportTableToPdf({
      filename: `Daily_Register_${registerDate}.pdf`,
      title: `Daily Headcount Register (${registerDate})`,
      subtitle: `Accommodation register for ${selectedSite === 'all' ? 'All Permitted Sites' : selectedSite}`,
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
    <div className="space-y-4">
      {/* Main Register Table with Scalable Date Matrix Columns */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] lg:min-h-[calc(100vh-270px)] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1400px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th className="p-2.5 cursor-pointer hover:bg-[#edebe9]" onClick={() => handleSort('roomNo')}>Room No.</th>
                <th className="p-2.5">Floor</th>
                <th className="p-2.5 cursor-pointer hover:bg-[#edebe9]" onClick={() => handleSort('portRef')}>Port Ref</th>
                <th className="p-2.5 cursor-pointer hover:bg-[#edebe9]" onClick={() => handleSort('name')}>SU Name</th>
                <th className="p-2.5">Check In</th>
                <th className="p-2.5">Nationality</th>
                <th className="p-2.5">Language</th>
                <th className="p-2.5">Gender</th>
                <th className="p-2.5">Age</th>
                <th className="p-2.5">Aspen</th>
                <th className="p-2.5">Beds (S/D/Bunk)</th>
                <th className="p-2.5">Occupied</th>
                <th className="p-2.5 text-right w-24 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-[#605e5c]">
                    <Users className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No service user records found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ Log Service User' to assign a resident to a room.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(rec => {
                  const matchedSu = (rec.portRef ? suByPortRef.get(rec.portRef.trim().toLowerCase()) : null) || 
                    suByName.get(rec.name.trim().toLowerCase());
                  const isExpanded = expandedRowIds.has(rec.id);

                  return (
                    <React.Fragment key={rec.id}>
                    <tr className="hover:bg-[#f0fdf4] transition-colors">
                      <td className="p-2.5 font-mono font-bold text-[#0f766e]">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => toggleRowExpand(e, rec.id)}
                            className="p-0.5 text-neutral-400 hover:text-[#0d9488] rounded hover:bg-neutral-100 transition-colors"
                            title={isExpanded ? 'Collapse inspection dossier' : 'Expand inspection dossier'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-[#0d9488]" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span>{rec.roomNo}</span>
                        </div>
                      </td>
                      <td className="p-2.5 text-[#605e5c]">{rec.floor || '—'}</td>
                      <td className="p-2.5 font-mono text-indigo-700">{rec.portRef}</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-[#242424]">{rec.name}</span>
                          {matchedSu?.personalEvacuationPlan?.startsWith('PEEP') && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-300" title="Resident has an active Personal Emergency Evacuation Plan">
                              <Flame className="w-2.5 h-2.5 text-rose-600" />
                              <span>PEEP</span>
                            </span>
                          )}
                          {matchedSu?.vulnerable === 'Yes' && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-semibold bg-amber-100 text-amber-800 border border-amber-300" title="Safeguarding Flag: Vulnerable resident">
                              <ShieldAlert className="w-2.5 h-2.5 text-amber-600" />
                              <span>VULN</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 text-[#605e5c]">{rec.checkInDate || '—'}</td>
                      <td className="p-2.5">{rec.nationality || '—'}</td>
                      <td className="p-2.5">{rec.language || '—'}</td>
                      <td className="p-2.5">{rec.gender || '—'}</td>
                      <td className="p-2.5 text-[#605e5c]">{guestByRecord.get(rec.id)?.age ?? '—'}</td>
                      <td className="p-2.5">{guestByRecord.get(rec.id)?.aspen ? <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-[#0f766e]">Yes</span> : <span className="text-[#a19f9d]">—</span>}</td>
                      <td className="p-2.5 text-[11px] text-[#605e5c]">
                        {rec.singleBed || 0}S / {rec.doubleBed || 0}D / {(rec.singleBunk || 0) + (rec.doubleBunk || 0)}B
                      </td>
                      <td className="p-2.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                          rec.occupied === 'Yes' || !rec.occupied 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {rec.occupied || 'Yes'}
                        </span>
                      </td>

                      <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingRecord(rec)}
                            className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEditRecord() && (
                            <button
                              onClick={() => setEditingRecord(rec)}
                              className="p-1 hover:bg-teal-50 text-[#0d9488] rounded-xs"
                              title="Edit Record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDeleteRecord() && (
                            <button
                              onClick={() => deleteDailyRegisterRecord(rec.id)}
                              className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Inspection & Safeguarding Review Row */}
                    {isExpanded && (
                      <tr className="bg-[#faf9f8] border-b border-[#e1dfdd]">
                        <td colSpan={13} className="p-3.5 pl-8">
                          <div className="bg-white border border-[#e5e5e5] rounded-xs p-3.5 space-y-3 shadow-2xs">
                            <div className="flex items-center justify-between pb-2 border-b border-[#f0f0f0]">
                              <div className="flex items-center gap-2">
                                <ClipboardCheck className="w-4 h-4 text-[#0d9488]" />
                                <span className="font-bold text-xs text-[#242424]">
                                  Inspection &amp; Safeguarding Dossier — Room {rec.roomNo} • {rec.name}
                                </span>
                              </div>
                              <span className="text-[11px] text-neutral-500 font-mono">
                                Port Ref: {rec.portRef} • Check-In: {rec.checkInDate || '—'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                              {/* 1. Room Specifications */}
                              <div className="p-2.5 bg-[#fcfbf9] rounded-xs border border-[#eee] space-y-1">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                                  Room &amp; Bed Capacity
                                </span>
                                <p className="font-semibold text-[#242424]">Floor {rec.floor || 'Ground'} • {rec.roomMakeup || 'Standard Room'}</p>
                                <p className="text-[11px] text-neutral-600">
                                  Singles: <strong>{rec.singleBed || 0}</strong> • Doubles: <strong>{rec.doubleBed || 0}</strong> • Bunks: <strong>{(rec.singleBunk || 0) + (rec.doubleBunk || 0)}</strong> • Cots: <strong>{rec.cot || 0}</strong>
                                </p>
                              </div>

                              {/* 2. Resident Profile */}
                              <div className="p-2.5 bg-[#fcfbf9] rounded-xs border border-[#eee] space-y-1">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                                  Demographics
                                </span>
                                <p className="font-semibold text-[#242424]">{rec.gender || 'Not specified'} • {guestByRecord.get(rec.id)?.age ?? '—'} yrs (DOB: {rec.dob || '—'})</p>
                                <p className="text-[11px] text-neutral-600">
                                  {rec.nationality || '—'} • {rec.language || 'English'}
                                </p>
                                <p className="text-[11px] text-neutral-600">
                                  Aspen Card: <strong>{guestByRecord.get(rec.id)?.aspen ? 'Active' : 'None recorded'}</strong>
                                </p>
                              </div>

                              {/* 3. Safeguarding & Evacuation Link */}
                              <div className="p-2.5 bg-[#fcfbf9] rounded-xs border border-[#eee] space-y-1">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block flex items-center justify-between">
                                  <span>Safeguarding &amp; Evacuation</span>
                                  {matchedSu && <span className="text-[9px] text-teal-700 font-mono font-bold">{matchedSu.suReference}</span>}
                                </span>
                                {matchedSu ? (
                                  <>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                        matchedSu.vulnerable === 'Yes' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-neutral-100 text-neutral-600'
                                      }`}>
                                        {matchedSu.vulnerable === 'Yes' ? 'Vulnerable Resident' : 'Standard Resident'}
                                      </span>
                                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                        matchedSu.personalEvacuationPlan?.startsWith('PEEP') ? 'bg-rose-100 text-rose-900 border border-rose-300 font-bold' : 'bg-teal-50 text-teal-800 border border-teal-200'
                                      }`}>
                                        {matchedSu.personalEvacuationPlan || 'GEEP Evacuation'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-neutral-700 mt-1">
                                      GP: <strong>{matchedSu.gpRegistration || 'Unregistered'}</strong>
                                    </p>
                                    <p className="text-[11px] text-neutral-700">
                                      Disability: <strong>{matchedSu.disabilityCategory && matchedSu.disabilityCategory !== 'None' ? `${matchedSu.disabilityCategory}${matchedSu.disabilityType ? ` (${matchedSu.disabilityType})` : ''}` : 'None'}</strong>
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-[11px] text-neutral-400 italic">
                                    No matched Service User Master record found for Port Ref: {rec.portRef}
                                  </p>
                                )}
                              </div>

                              {/* 4. Operational Notes */}
                              <div className="p-2.5 bg-[#fcfbf9] rounded-xs border border-[#eee] space-y-1">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                                  Occupancy &amp; Handover Notes
                                </span>
                                <p className="text-[11px] text-neutral-700">
                                  Occupied: <strong>{rec.occupied || 'Yes'}</strong> • Void: <strong>{rec.isVoid || 'No'}{rec.voidReason ? ` (${rec.voidReason})` : ''}</strong>
                                </p>
                                <p className="text-[11px] text-neutral-600 italic bg-white p-1.5 rounded border border-[#e5e5e5] line-clamp-3">
                                  {rec.suComments || 'No operational notes logged for this guest.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredRecords.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {/* Dynamic Create Modal */}
      <DynamicRecordFormModal<DailyRegisterRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Log Service User to Daily Register"
        columns={formColumns}
        initialValues={{
          hotel: selectedSite !== 'all' ? selectedSite : (assignedSite || 'Brit Hotel'),
          roomNo: '',
          floor: 'Ground',
          portRef: '',
          name: '',
          checkInDate: new Date().toISOString().slice(0, 10),
          singleBed: 1,
          doubleBed: 0,
          singleBunk: 0,
          doubleBunk: 0,
          cot: 0,
          occupied: 'Yes',
          isVoid: 'No',
          availableToBook: 'No'
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Save to Register"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<DailyRegisterRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Register Entry: ${editingRecord.name}`}
          columns={formColumns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<DailyRegisterRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`Resident Register Details: ${viewingRecord.name} (${viewingRecord.portRef})`}
          columns={columns}
          record={viewingRecord}
          onEdit={() => {
            const rec = viewingRecord;
            setViewingRecord(null);
            setEditingRecord(rec);
          }}
          canEdit={canEditRecord()}
        />
      )}

      {/* Super Admin Schema Customizer */}
      <TableSchemaEditorModal<DailyRegisterRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Daily Register Table"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
