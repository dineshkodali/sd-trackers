import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Download,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
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

interface DailyRegisterSectionProps {
  selectedSite: string;
  registerDate: string;
  onDateChange?: (date: string) => void;
  searchQuery?: string;
  occupancyFilter?: 'all' | 'Occupied' | 'Vacant';
  createTrigger?: number;
  exportTrigger?: { format: 'csv' | 'pdf'; ts: number } | null;
  customizeTrigger?: number;
}

export const DailyRegisterSection: React.FC<DailyRegisterSectionProps> = ({
  selectedSite,
  registerDate,
  onDateChange,
  searchQuery: externalSearchQuery,
  occupancyFilter: externalOccupancyFilter,
  createTrigger,
  exportTrigger,
  customizeTrigger
}) => {
  const {
    dailyRegisterRecords,
    addDailyRegisterRecord,
    updateDailyRegisterRecord,
    deleteDailyRegisterRecord,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    assignedSite
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

  const filteredRecords = useMemo(() => {
    return dailyRegisterRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.name.toLowerCase().includes(q) ||
        r.portRef.toLowerCase().includes(q) ||
        r.roomNo.toLowerCase().includes(q) ||
        (r.nationality && r.nationality.toLowerCase().includes(q)) ||
        (r.language && r.language.toLowerCase().includes(q));

      const matchesSite = selectedSite === 'all' || r.hotel?.toLowerCase() === selectedSite.toLowerCase();
      const matchesOcc = occupancyFilter === 'all' || 
        (occupancyFilter === 'Occupied' ? (r.occupied === 'Yes' || !r.occupied) : r.occupied === 'No');

      return matchesSearch && matchesSite && matchesOcc;
    });
  }, [dailyRegisterRecords, searchQuery, selectedSite, occupancyFilter]);

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
    addDailyRegisterRecord({
      hotel: data.hotel || (selectedSite !== 'all' ? selectedSite : (assignedSite || 'Brit Hotel')),
      roomNo: data.roomNo || '',
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
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
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
                <th className="p-2.5">Beds (S/D/Bunk)</th>
                <th className="p-2.5">Occupied</th>
                <th className="p-2.5 text-right w-24 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[#605e5c]">
                    <Users className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No service user records found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ Log Service User' to assign a resident to a room.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-[#f0fdf4] transition-colors">
                    <td className="p-2.5 font-mono font-bold text-[#0f766e]">{rec.roomNo}</td>
                    <td className="p-2.5 text-[#605e5c]">{rec.floor || '—'}</td>
                    <td className="p-2.5 font-mono text-indigo-700">{rec.portRef}</td>
                    <td className="p-2.5 font-semibold text-[#242424]">{rec.name}</td>
                    <td className="p-2.5 text-[#605e5c]">{rec.checkInDate || '—'}</td>
                    <td className="p-2.5">{rec.nationality || '—'}</td>
                    <td className="p-2.5">{rec.language || '—'}</td>
                    <td className="p-2.5">{rec.gender || '—'}</td>
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
                ))
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
        columns={columns}
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
          columns={columns}
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
          title={`Resident Register Dossier: ${viewingRecord.name} (${viewingRecord.portRef})`}
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
