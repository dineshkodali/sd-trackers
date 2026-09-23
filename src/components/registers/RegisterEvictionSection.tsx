import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserMinus, 
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
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EvictionRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { useTableSchema } from '../../hooks/useTableSchema';
import { EVICTION_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';

interface RegisterEvictionSectionProps {
  selectedSite: string;
  searchQuery?: string;
  createTrigger?: number;
  exportTrigger?: { format: 'csv' | 'pdf'; ts: number } | null;
  customizeTrigger?: number;
}

export const RegisterEvictionSection: React.FC<RegisterEvictionSectionProps> = ({ 
  selectedSite,
  searchQuery: externalSearchQuery,
  createTrigger,
  exportTrigger,
  customizeTrigger
}) => {
  const {
    evictionRecords,
    addEvictionRecord,
    updateEvictionRecord,
    deleteEvictionRecord,
    dailyRegisterRecords,
    updateDailyRegisterRecord,
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
  } = useTableSchema<EvictionRecord>('evictions', EVICTION_TABLE_COLUMNS);

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('evictionDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EvictionRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<EvictionRecord | null>(null);

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

  useEffect(() => {
    if (exportTrigger && exportTrigger.ts) {
      if (exportTrigger.format === 'csv') {
        handleExportCsv();
      } else if (exportTrigger.format === 'pdf') {
        handleExportPdf();
      }
    }
  }, [exportTrigger]);

  const filteredEvictions = useMemo(() => {
    return evictionRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.suName.toLowerCase().includes(q) ||
        r.portRef.toLowerCase().includes(q) ||
        (r.roomNo && r.roomNo.toLowerCase().includes(q)) ||
        (r.evictionReason && r.evictionReason.toLowerCase().includes(q));

      const matchesSite = selectedSite === 'all' || r.hotel?.toLowerCase() === selectedSite.toLowerCase();
      return matchesSearch && matchesSite;
    });
  }, [evictionRecords, searchQuery, selectedSite]);

  const sortedEvictions = useMemo(() => {
    return [...filteredEvictions].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      return sortOrder === 'asc' 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredEvictions, sortKey, sortOrder]);

  const paginatedEvictions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedEvictions.slice(startIndex, startIndex + pageSize);
  }, [sortedEvictions, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleCreateSubmit = (data: Partial<EvictionRecord>) => {
    const recordStatus = data.status || 'Notice Issued';
    addEvictionRecord({
      hotel: data.hotel || (selectedSite !== 'all' ? selectedSite : (assignedSite || 'Brit Hotel')),
      roomNo: data.roomNo || '',
      portRef: data.portRef || '',
      suName: data.suName || '',
      noticeDate: data.noticeDate || new Date().toISOString().slice(0, 10),
      evictionDate: data.evictionDate || new Date().toISOString().slice(0, 10),
      evictionReason: data.evictionReason || '',
      status: recordStatus,
      notes: data.notes || '',
      attachments: []
    } as any);

    // If marked Evicted right away, vacate daily register record while retaining history
    if (recordStatus === 'Evicted' && data.portRef) {
      const matched = dailyRegisterRecords.find(dr => dr.portRef.toLowerCase().trim() === data.portRef?.toLowerCase().trim());
      if (matched) {
        updateDailyRegisterRecord(matched.id, { occupied: 'No', availableToBook: 'Yes' });
      }
    }

    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<EvictionRecord>) => {
    if (!editingRecord) return;
    const newStatus = data.status || editingRecord.status;
    updateEvictionRecord(editingRecord.id, { ...editingRecord, ...data });

    // If transitioned to Evicted, vacate room in daily register
    if (newStatus === 'Evicted' && editingRecord.status !== 'Evicted') {
      const matched = dailyRegisterRecords.find(dr => 
        dr.portRef.toLowerCase().trim() === editingRecord.portRef.toLowerCase().trim()
      );
      if (matched) {
        updateDailyRegisterRecord(matched.id, { occupied: 'No', availableToBook: 'Yes' });
      }
    }
    setEditingRecord(null);
  };

  const handleExportCsv = () => {
    const headers = ['Hotel', 'Room No.', 'Port Ref', 'SU Name', 'Notice Date', 'Eviction Date', 'Reason', 'Status', 'Notes'];
    const rows = sortedEvictions.map(r => [
      r.hotel, r.roomNo || '', r.portRef, r.suName, r.noticeDate || '',
      r.evictionDate, r.evictionReason, r.status, r.notes || ''
    ]);
    exportTableToCsv({ filename: 'Eviction_Records.csv', headers, rows });
  };

  const handleExportPdf = () => {
    const headers = ['Hotel', 'Room', 'Port Ref', 'SU Name', 'Notice Date', 'Eviction Date', 'Reason', 'Status'];
    const rows = sortedEvictions.map(r => [
      r.hotel, r.roomNo || '', r.portRef, r.suName, r.noticeDate || '',
      r.evictionDate, r.evictionReason, r.status
    ]);
    exportTableToPdf({
      filename: `Evictions_${new Date().toISOString().slice(0, 10)}.pdf`,
      title: 'Cessation & Eviction Notices Log',
      subtitle: `Eviction notices for ${selectedSite === 'all' ? 'All Permitted Sites' : selectedSite}`,
      headers,
      rows,
      orientation: 'landscape'
    });
  };

  return (
    <div className="space-y-4">

      {/* Table */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[500px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th className="p-2.5">Hotel</th>
                <th className="p-2.5">Room</th>
                <th className="p-2.5 cursor-pointer hover:bg-[#edebe9]" onClick={() => handleSort('portRef')}>Port Ref</th>
                <th className="p-2.5 cursor-pointer hover:bg-[#edebe9]" onClick={() => handleSort('suName')}>SU Name</th>
                <th className="p-2.5">Notice Date</th>
                <th className="p-2.5 cursor-pointer hover:bg-[#edebe9]" onClick={() => handleSort('evictionDate')}>Eviction Date</th>
                <th className="p-2.5">Reason</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right w-24 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedEvictions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#605e5c]">
                    <UserMinus className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No eviction records logged</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ Record Eviction' if an eviction notice is issued.</p>
                  </td>
                </tr>
              ) : (
                paginatedEvictions.map(evict => (
                  <tr key={evict.id} className="hover:bg-[#fdf3f4] transition-colors">
                    <td className="p-2.5 font-medium">{evict.hotel}</td>
                    <td className="p-2.5 font-mono text-[#0f766e]">{evict.roomNo || '—'}</td>
                    <td className="p-2.5 font-mono text-indigo-700">{evict.portRef}</td>
                    <td className="p-2.5 font-semibold text-[#242424]">{evict.suName}</td>
                    <td className="p-2.5 text-[#605e5c]">{evict.noticeDate || '—'}</td>
                    <td className="p-2.5 font-medium">{evict.evictionDate}</td>
                    <td className="p-2.5 max-w-xs truncate text-[#323130]" title={evict.evictionReason}>
                      {evict.evictionReason}
                    </td>
                    <td className="p-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        evict.status === 'Evicted' 
                          ? 'bg-red-100 text-red-800 border border-red-200' 
                          : evict.status === 'Pending Appeal' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-amber-100 text-amber-800'
                      }`}>
                        {evict.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingRecord(evict)}
                          className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditRecord() && (
                          <button
                            onClick={() => setEditingRecord(evict)}
                            className="p-1 hover:bg-teal-50 text-[#0d9488] rounded-xs"
                            title="Edit Eviction"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => deleteEvictionRecord(evict.id)}
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
          totalItems={filteredEvictions.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {/* Dynamic Create Modal */}
      <DynamicRecordFormModal<EvictionRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Record Eviction Notice"
        columns={columns}
        initialValues={{
          hotel: selectedSite !== 'all' ? selectedSite : (assignedSite || 'Brit Hotel'),
          noticeDate: new Date().toISOString().slice(0, 10),
          evictionDate: new Date().toISOString().slice(0, 10),
          status: 'Notice Issued'
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Save Eviction Record"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<EvictionRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Eviction: ${editingRecord.suName}`}
          columns={columns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<EvictionRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`Eviction Dossier: ${viewingRecord.suName} (${viewingRecord.portRef})`}
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
      <TableSchemaEditorModal<EvictionRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Eviction Log Table"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
