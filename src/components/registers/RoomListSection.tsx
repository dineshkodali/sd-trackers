import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DailyRegisterRoom } from '../../types';
import { Pagination } from '../common/Pagination';
import { useTableSchema } from '../../hooks/useTableSchema';
import { ROOM_LIST_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';

interface RoomListSectionProps {
  selectedSite: string;
  searchQuery?: string;
  createTrigger?: number;
  exportTrigger?: { format: 'csv' | 'pdf'; ts: number } | null;
  customizeTrigger?: number;
}

export const RoomListSection: React.FC<RoomListSectionProps> = ({ 
  selectedSite,
  searchQuery: externalSearchQuery,
  createTrigger,
  exportTrigger,
  customizeTrigger
}) => {
  const {
    dailyRegisterRooms,
    addDailyRegisterRoom,
    updateDailyRegisterRoom,
    deleteDailyRegisterRoom,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    canAccessAllSites,
    assignedSite
  } = useApp();

  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<DailyRegisterRoom>('dailyRegisterRooms', ROOM_LIST_TABLE_COLUMNS);

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('roomNo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DailyRegisterRoom | null>(null);
  const [viewingRecord, setViewingRecord] = useState<DailyRegisterRoom | null>(null);

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

  const filteredRooms = useMemo(() => {
    return dailyRegisterRooms.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.roomNo.toLowerCase().includes(q) ||
        r.hotel.toLowerCase().includes(q) ||
        (r.floor && r.floor.toLowerCase().includes(q)) ||
        (r.roomType && r.roomType.toLowerCase().includes(q)) ||
        (r.suCohort && r.suCohort.toLowerCase().includes(q));

      const matchesSite = selectedSite === 'all' || r.hotel?.toLowerCase() === selectedSite.toLowerCase();
      return matchesSearch && matchesSite;
    });
  }, [dailyRegisterRooms, searchQuery, selectedSite]);

  const sortedRooms = useMemo(() => {
    return [...filteredRooms].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      return sortOrder === 'asc' 
        ? String(valA).localeCompare(String(valB), undefined, { numeric: true }) 
        : String(valB).localeCompare(String(valA), undefined, { numeric: true });
    });
  }, [filteredRooms, sortKey, sortOrder]);

  const paginatedRooms = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRooms.slice(startIndex, startIndex + pageSize);
  }, [sortedRooms, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleCreateSubmit = (data: Partial<DailyRegisterRoom>) => {
    addDailyRegisterRoom({
      date: data.date || new Date().toISOString().slice(0, 10),
      hotel: data.hotel || (selectedSite !== 'all' ? selectedSite : (assignedSite || 'Brit Hotel')),
      roomNo: data.roomNo || '',
      floor: data.floor || 'Ground',
      roomType: data.roomType || 'Single',
      suCohort: data.suCohort || 'Single Male',
      currentMaxOccupancy: Number(data.currentMaxOccupancy) || 1,
      currentOccupancy: Number(data.currentOccupancy) || 0,
      bedspacesAvailable: Number(data.bedspacesAvailable) || 1,
      voidBedspaces: Number(data.voidBedspaces) || 0,
      voidReason: data.voidReason || '',
      sizeSqm: Number(data.sizeSqm) || 18,
      maxRoomType: data.maxRoomType || '',
      potentialMaxCapacity: Number(data.potentialMaxCapacity) || 1,
      stepsToIncreaseCapacity: data.stepsToIncreaseCapacity || '',
      attachments: []
    } as any);
    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<DailyRegisterRoom>) => {
    if (!editingRecord) return;
    updateDailyRegisterRoom(editingRecord.id, {
      ...editingRecord,
      ...data,
      currentMaxOccupancy: Number(data.currentMaxOccupancy) || 0,
      currentOccupancy: Number(data.currentOccupancy) || 0,
      bedspacesAvailable: Number(data.bedspacesAvailable) || 0,
      voidBedspaces: Number(data.voidBedspaces) || 0,
      potentialMaxCapacity: Number(data.potentialMaxCapacity) || 0
    });
    setEditingRecord(null);
  };

  const handleExportCsv = () => {
    const headers = ['Hotel', 'Room No.', 'Floor', 'Room Type', 'Cohort', 'Max Occupancy', 'Current Occupancy', 'Available Bedspaces', 'Void Bedspaces', 'Void Reason', 'Size (sqm)', 'Potential Max Capacity'];
    const rows = sortedRooms.map(r => [
      r.hotel, r.roomNo, r.floor || '', r.roomType || '', r.suCohort || '',
      String(r.currentMaxOccupancy || 0), String(r.currentOccupancy || 0), String(r.bedspacesAvailable || 0),
      String(r.voidBedspaces || 0), r.voidReason || '', String(r.sizeSqm || ''), String(r.potentialMaxCapacity || '')
    ]);
    exportTableToCsv({ filename: `Room_List_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows });
  };

  const handleExportPdf = () => {
    const headers = ['Hotel', 'Room No', 'Floor', 'Room Type', 'Cohort', 'Max Cap', 'Occupied', 'Available', 'Void'];
    const rows = sortedRooms.map(r => [
      r.hotel, r.roomNo, r.floor || '', r.roomType || '', r.suCohort || '',
      String(r.currentMaxOccupancy || 0), String(r.currentOccupancy || 0), String(r.bedspacesAvailable || 0), String(r.voidBedspaces || 0)
    ]);
    exportTableToPdf({
      filename: `Room_Inventory_${new Date().toISOString().slice(0, 10)}.pdf`,
      title: 'Room & Bedspace Inventory',
      subtitle: `Inventory configuration for ${selectedSite === 'all' ? 'All Permitted Sites' : selectedSite}`,
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

  const renderColumnCell = (col: TableColumnConfig<DailyRegisterRoom>, item: DailyRegisterRoom) => {
    if (col.renderCell) {
      return col.renderCell((item as any)[col.key], item);
    }
    const val = (item as any)[col.key];

    if (col.key === 'roomNo') {
      return <span className="font-mono font-bold text-[#0f766e] bg-teal-50 px-2 py-0.5 rounded border border-teal-100">{val}</span>;
    }
    if (col.key === 'hotel') {
      return <span className="font-semibold text-[#242424]">{val}</span>;
    }
    if (col.key === 'currentOccupancy') {
      const isFull = (item.currentOccupancy || 0) >= (item.currentMaxOccupancy || 1);
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
          isFull ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
        }`}>
          {val || 0} / {item.currentMaxOccupancy || 0}
        </span>
      );
    }
    if (col.key === 'voidReason') {
      return val ? <span className="text-red-700 font-medium">{val}</span> : <span className="text-[#a19f9d]">—</span>;
    }
    if (col.key === 'voidBedspaces' && Number(val) > 0) {
      return <span className="text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded">{val}</span>;
    }
    if (val === null || val === undefined || val === '') return <span className="text-[#a19f9d]">—</span>;
    return String(val);
  };

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[500px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                {visibleColumns.map(col => {
                  const isSorted = sortKey === col.key;
                  return (
                    <th 
                      key={String(col.key)} 
                      className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors"
                      onClick={() => handleSort(String(col.key))}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.label}</span>
                        {isSorted ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#0d9488]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#0d9488]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-[#a19f9d]" />
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="p-2.5 text-right w-24 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedRooms.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-[#605e5c]">
                    <Building className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No rooms configured</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ Add Room' to record room inventory details.</p>
                  </td>
                </tr>
              ) : (
                paginatedRooms.map(room => (
                  <tr key={room.id} className="hover:bg-[#f0fdf4] transition-colors">
                    {visibleColumns.map(col => (
                      <td key={String(col.key)} className="p-2.5">
                        {renderColumnCell(col, room)}
                      </td>
                    ))}
                    <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingRecord(room)}
                          className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs"
                          title="View Room Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditRecord() && (
                          <button
                            onClick={() => setEditingRecord(room)}
                            className="p-1 hover:bg-teal-50 text-[#0d9488] rounded-xs"
                            title="Edit Room"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => deleteDailyRegisterRoom(room.id)}
                            className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs"
                            title="Delete Room"
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
          totalItems={filteredRooms.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {/* Dynamic Create Modal */}
      <DynamicRecordFormModal<DailyRegisterRoom>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Room to Inventory"
        columns={columns}
        initialValues={{
          hotel: selectedSite !== 'all' ? selectedSite : (assignedSite || 'Brit Hotel'),
          date: new Date().toISOString().slice(0, 10),
          roomNo: '',
          floor: 'Ground',
          roomType: 'Single',
          currentMaxOccupancy: 1,
          currentOccupancy: 0,
          suCohort: 'Single Male',
          bedspacesAvailable: 1,
          voidBedspaces: 0,
          voidReason: '',
          potentialMaxCapacity: 1
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Save Room"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<DailyRegisterRoom>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Room ${editingRecord.roomNo}`}
          columns={columns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<DailyRegisterRoom>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`Room Inventory Dossier - Room ${viewingRecord.roomNo}`}
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
      <TableSchemaEditorModal<DailyRegisterRoom>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Room List & Inventory"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
