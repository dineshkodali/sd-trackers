import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserPlus, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  SlidersHorizontal, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  BedDouble, 
  CheckCircle2,
  RefreshCw 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NewArrivalRecord, DailyRegisterRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { useTableSchema } from '../../hooks/useTableSchema';
import { NEW_ARRIVALS_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';

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
    deleteNewArrivalRecord,
    addDailyRegisterRecord,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    assignedSite,
    syncFromDatabase,
    liveDataStatus
  } = useApp();

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

  const filteredArrivals = useMemo(() => {
    return newArrivalsRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.name?.toLowerCase().includes(q) ||
        r.portReference?.toLowerCase().includes(q) ||
        (r.hotel && r.hotel.toLowerCase().includes(q)) ||
        (r.room && r.room.toLowerCase().includes(q)) ||
        (r.country && r.country.toLowerCase().includes(q));

      const hotelName = (r.hotel || '').trim().toLowerCase();
      const siteFilter = (selectedSite || 'all').trim().toLowerCase();
      const matchesSite = siteFilter === 'all' || 
        !hotelName || 
        hotelName === 'all sites' || 
        hotelName === siteFilter ||
        hotelName.includes(siteFilter) ||
        siteFilter.includes(hotelName);

      return matchesSearch && matchesSite;
    });
  }, [newArrivalsRecords, searchQuery, selectedSite]);

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

  const handleCreateSubmit = (data: Partial<NewArrivalRecord>) => {
    const finalHotel = (data.hotel && data.hotel !== 'All Sites' && data.hotel !== 'all')
      ? data.hotel
      : defaultSite;

    addNewArrivalRecord({
      portReference: data.portReference || '',
      name: data.name || '',
      dob: data.dob || '',
      country: data.country || '',
      language: data.language || '',
      contactNumber: data.contactNumber || '',
      hotel: finalHotel,
      room: data.room || '',
      email: data.email || '',
      aspenCard: data.aspenCard || '',
      status: data.status || 'Arrived',
      attachments: []
    } as any);
    setIsCreateModalOpen(false);
  };

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

    addDailyRegisterRecord({
      hotel: arrival.hotel,
      roomNo: arrival.room,
      portRef: arrival.portReference,
      name: arrival.name,
      checkInDate: new Date().toISOString().slice(0, 10),
      contactNo: arrival.contactNumber,
      email: arrival.email,
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

    updateNewArrivalRecord(arrival.id, { status: 'Checked In' });
  };

  const handleExportCsv = () => {
    const headers = ['Port Ref', 'Name', 'D.O.B.', 'Country', 'Language', 'Contact No.', 'Hotel', 'Room', 'Email', 'Aspen Card', 'Status'];
    const rows = sortedArrivals.map(r => [
      r.portReference, r.name, r.dob || '', r.country || '', r.language || '',
      r.contactNumber || '', r.hotel, r.room || '', r.email || '', r.aspenCard || '', r.status || 'Arrived'
    ]);
    exportTableToCsv({ filename: 'New_Arrivals_Queue.csv', headers, rows });
  };

  const handleExportPdf = () => {
    const headers = ['Port Ref', 'Name', 'D.O.B.', 'Country', 'Language', 'Contact No.', 'Hotel', 'Room', 'Status'];
    const rows = sortedArrivals.map(r => [
      r.portReference, r.name, r.dob || '', r.country || '', r.language || '',
      r.contactNumber || '', r.hotel, r.room || '', r.status || 'Arrived'
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

      {/* Table */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[500px] flex flex-col justify-between">
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
                <th className="p-2.5">Hotel</th>
                <th className="p-2.5">Room</th>
                <th className="p-2.5">Aspen Card</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right w-36 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedArrivals.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[#605e5c]">
                    <UserPlus className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No new arrivals recorded</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ Record Arrival' to log new incoming residents.</p>
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
                paginatedArrivals.map(arrival => (
                  <tr key={arrival.id} className="hover:bg-[#f0fdf4] transition-colors">
                    <td className="p-2.5 font-mono font-bold text-indigo-700">{arrival.portReference}</td>
                    <td className="p-2.5 font-semibold text-[#242424]">{arrival.name}</td>
                    <td className="p-2.5 text-[#605e5c]">{arrival.dob || '—'}</td>
                    <td className="p-2.5">{arrival.country || '—'}</td>
                    <td className="p-2.5">{arrival.language || '—'}</td>
                    <td className="p-2.5 text-[#605e5c]">{arrival.contactNumber || '—'}</td>
                    <td className="p-2.5 font-medium">{arrival.hotel}</td>
                    <td className="p-2.5 font-mono text-[#0f766e]">{arrival.room || 'Unassigned'}</td>
                    <td className="p-2.5 font-mono">{arrival.aspenCard || '—'}</td>
                    <td className="p-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                        arrival.status === 'Checked In' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {arrival.status || 'Arrived'}
                      </span>
                    </td>
                    <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-end gap-1.5">
                        {arrival.status !== 'Checked In' && canEditRecord() && (
                          <button
                            onClick={() => handleAssignToDailyRegister(arrival)}
                            className="p-1 hover:bg-emerald-50 text-emerald-700 rounded-xs flex items-center gap-0.5 text-[11px] font-semibold"
                            title="Assign to Room & Check-In"
                          >
                            <BedDouble className="w-3.5 h-3.5" />
                            <span>Check In</span>
                          </button>
                        )}
                        <button
                          onClick={() => setViewingRecord(arrival)}
                          className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditRecord() && (
                          <button
                            onClick={() => setEditingRecord(arrival)}
                            className="p-1 hover:bg-teal-50 text-[#0d9488] rounded-xs"
                            title="Edit Arrival"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => deleteNewArrivalRecord(arrival.id)}
                            className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs"
                            title="Delete Arrival"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
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
        columns={columns}
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
          columns={columns}
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
          title={`New Arrival Dossier: ${viewingRecord.name} (${viewingRecord.portReference})`}
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
