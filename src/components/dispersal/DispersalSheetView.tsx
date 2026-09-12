import React, { useState, useMemo } from 'react';
import { 
  Send, 
  Plus, 
  Search, 
  Download, 
  Edit3, 
  Trash2, 
  Eye, 
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DispersalRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { useTableSchema } from '../../hooks/useTableSchema';
import { DISPERSAL_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';

const dispersalExportColumns: ExportColumnOption[] = [
  { id: 'sno', label: 'S.No' },
  { id: 'siteName', label: 'Hotel / Site' },
  { id: 'suPortNassRef', label: 'Port / NASS Ref' },
  { id: 'flatRoomNumber', label: 'Room / Flat' },
  { id: 'dateReceived', label: 'Date Received' },
  { id: 'dispersalDate', label: 'Dispersal Date' },
  { id: 'dateLetterHandedToSu', label: 'Letter Handed Date' },
  { id: 'reasonForDeparture', label: 'Reason for Departure' },
  { id: 'iaExitBriefingCompleted', label: 'IA Exit Briefing' },
  { id: 'hoDispersalLetterReceived', label: 'HO Letter Received' },
  { id: 'travelled', label: 'Travelled' },
  { id: 'dateLeftProperty', label: 'Date Left Property' },
  { id: 'incidentWarningCompleted', label: 'Warning Completed' },
  { id: 'reasonFailedToTravel', label: 'Reason Failed Travel' },
  { id: 'secondDispersalDate', label: 'Second Dispersal Date' }
];

export const DispersalSheetView: React.FC = () => {
  const {
    dispersalRecords,
    addDispersalRecord,
    updateDispersalRecord,
    deleteDispersalRecord,
    allowedSites,
    assignedSite,
    canAccessAllSites,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole
  } = useApp();

  // Table Schema Hook
  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<DispersalRecord>('dispersal', DISPERSAL_TABLE_COLUMNS);

  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState(!canAccessAllSites() ? assignedSite : 'all');
  const [travelledFilter, setTravelledFilter] = useState('all');
  const [secondDispersalFilter, setSecondDispersalFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('dispersalDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DispersalRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<DispersalRecord | null>(null);

  const filteredRecords = useMemo(() => {
    return dispersalRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.suPortNassRef.toLowerCase().includes(q) ||
        r.flatRoomNumber.toLowerCase().includes(q) ||
        r.reasonForDeparture.toLowerCase().includes(q) ||
        r.siteName.toLowerCase().includes(q) ||
        (r.reasonFailedToTravel && r.reasonFailedToTravel.toLowerCase().includes(q)) ||
        (r.reasonFailedToTravelSecond && r.reasonFailedToTravelSecond.toLowerCase().includes(q));

      const matchesSite = siteFilter === 'all' || r.siteName === siteFilter;
      const matchesTravelled = travelledFilter === 'all' || r.travelled === travelledFilter;
      const matchesSecond = secondDispersalFilter === 'all' || 
        (secondDispersalFilter === 'yes' ? Boolean(r.secondDispersalDate && r.secondDispersalDate.trim()) : !r.secondDispersalDate);

      return matchesSearch && matchesSite && matchesTravelled && matchesSecond;
    });
  }, [dispersalRecords, searchQuery, siteFilter, travelledFilter, secondDispersalFilter]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc' 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
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

  const handleCreateSubmit = (data: Partial<DispersalRecord>) => {
    addDispersalRecord({
      sno: dispersalRecords.length + 1,
      siteName: !canAccessAllSites() 
        ? assignedSite 
        : (data.siteName || (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0]))),
      dateReceived: data.dateReceived || new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      suPortNassRef: data.suPortNassRef || '',
      reasonForDeparture: data.reasonForDeparture || 'Dispersal to Long-Term NASS accommodation',
      flatRoomNumber: data.flatRoomNumber || '',
      dispersalDate: data.dispersalDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      dateLetterHandedToSu: data.dateLetterHandedToSu || new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      iaExitBriefingCompleted: data.iaExitBriefingCompleted || 'Yes',
      hoDispersalLetterReceived: data.hoDispersalLetterReceived || 'Yes',
      travelled: data.travelled || 'Yes',
      dateLeftProperty: data.dateLeftProperty || '',
      incidentWarningCompleted: data.incidentWarningCompleted || 'No need',
      reasonFailedToTravel: data.reasonFailedToTravel || '',
      secondDispersalDate: data.secondDispersalDate || '',
      dateSecondLetterHanded: data.dateSecondLetterHanded || '',
      secondIaExitBriefingCompleted: data.secondIaExitBriefingCompleted || 'No',
      secondDispersalTravelled: data.secondDispersalTravelled || 'No',
      secondDateLeftProperty: data.secondDateLeftProperty || '',
      secondIncidentWarningCompleted: data.secondIncidentWarningCompleted || 'No need',
      reasonFailedToTravelSecond: data.reasonFailedToTravelSecond || '',
      ...data,
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    } as any);
    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<DispersalRecord>) => {
    if (!editingRecord) return;
    updateDispersalRecord(editingRecord.id, {
      ...editingRecord,
      ...data,
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    });
    setEditingRecord(null);
  };

  // Export Handlers with Custom Download & PDF/CSV Options
  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    let sourceData = dispersalRecords;
    if (scope === 'filtered') sourceData = sortedRecords;
    else if (scope === 'custom' && startDate && endDate) {
      sourceData = dispersalRecords.filter(d => {
        const dateVal = d.dispersalDate || d.dateReceived || '';
        return (!startDate || dateVal >= startDate) && (!endDate || dateVal <= endDate);
      });
    }
    return sourceData;
  };

  const calculateDateRangeCount = (startDate: string, endDate: string): number => {
    return dispersalRecords.filter(d => {
      const dateVal = d.dispersalDate || d.dateReceived || '';
      return (!startDate || dateVal >= startDate) && (!endDate || dateVal <= endDate);
    }).length;
  };

  const getExportPreviewData = ({
    scope,
    startDate,
    endDate,
    selectedColumns
  }: {
    scope: ExportScope;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    orientation: ExportOrientation;
    isCompact: boolean;
  }) => {
    const raw = getExportDataForScope(scope, startDate, endDate).slice(0, 5);
    const cols = selectedColumns && selectedColumns.length > 0
      ? dispersalExportColumns.filter(c => selectedColumns.includes(c.id))
      : dispersalExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));
    return { headers, rows };
  };

  const handlePerformExport = ({
    format,
    scope,
    orientation = 'landscape',
    startDate,
    endDate,
    selectedColumns
  }: {
    format: ExportFormat;
    scope: ExportScope;
    orientation: ExportOrientation;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => {
    const raw = getExportDataForScope(scope, startDate, endDate);
    const cols = selectedColumns && selectedColumns.length > 0
      ? dispersalExportColumns.filter(c => selectedColumns.includes(c.id))
      : dispersalExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));

    if (format === 'csv') {
      exportTableToCsv({ filename: 'Dispersal_Tracker_Sheet.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'Dispersal_Tracker_Sheet.pdf',
        title: 'Service User Dispersals & Departures Log',
        headers,
        rows,
        orientation
      });
    }
  };

  const renderColumnCell = (col: TableColumnConfig<DispersalRecord>, record: DispersalRecord) => {
    if (col.renderCell) {
      return col.renderCell((record as any)[col.key], record);
    }

    const value = (record as any)[col.key];

    if (col.badgeColors && value) {
      const badgeClass = col.badgeColors[value] || 'bg-gray-100 text-gray-800';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-semibold ${badgeClass}`}>
          {value}
        </span>
      );
    }

    if (col.key === 'suPortNassRef') {
      return <span className="font-mono text-[#0f766e] font-semibold">{value || '—'}</span>;
    }

    if (col.key === 'flatRoomNumber') {
      return <span className="font-semibold text-[#242424]">{value || '—'}</span>;
    }

    if (col.key === 'sno') {
      return <span className="text-[#605e5c] font-mono">{value || '—'}</span>;
    }

    if (value === null || value === undefined || value === '') {
      return <span className="text-[#a19f9d]">—</span>;
    }

    return String(value);
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-[#2b88d8]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">
              Dispersal Sheet
            </h1>
            <span className="text-xs bg-blue-50 text-[#0078d4] font-semibold px-2 py-0.5 rounded-xs border border-blue-200">
              {filteredRecords.length} Dispersals
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Track Initial Accommodation departures, long-term NASS transfers, exit briefings, and Home Office letters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUserRole === 'Super Admin' && (
            <button
              type="button"
              onClick={() => setIsSchemaModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors"
              title="Super Admin: Customize table columns, headers, and fields"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#0078d4]" />
              <span>Customize Table</span>
            </button>
          )}

          <ExportDropdown
            moduleName="Dispersals"
            totalRecordCount={dispersalRecords.length}
            filteredRecordCount={filteredRecords.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={dispersalExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />

          {canCreateRecord() && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0078d4] hover:bg-[#106ebe] text-white rounded-xs shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Record Dispersal</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Site Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Site:</span>
            <select
              value={siteFilter}
              onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Sites</option>
              {allowedSites.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Travelled Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Travelled:</span>
            <select
              value={travelledFilter}
              onChange={e => { setTravelledFilter(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All</option>
              <option value="Yes">Yes (Travelled)</option>
              <option value="No">No (Failed)</option>
            </select>
          </div>

          {/* 2nd Dispersal Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">2nd Cycle:</span>
            <select
              value={secondDispersalFilter}
              onChange={e => { setSecondDispersalFilter(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All</option>
              <option value="yes">Has 2nd Dispersal</option>
              <option value="no">Single Dispersal Only</option>
            </select>
          </div>

          {/* Reset button */}
          {(siteFilter !== 'all' || travelledFilter !== 'all' || secondDispersalFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSiteFilter('all');
                setTravelledFilter('all');
                setSecondDispersalFilter('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-xs text-[#0078d4] hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#605e5c]" />
          <input
            type="text"
            placeholder="Search Port Ref, Room, Reason..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-8 pr-3 py-1.5 border border-[#8a8886] rounded-xs text-[#323130] text-xs bg-white focus:outline-2 focus:outline-[#71afe5]"
          />
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
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
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#0078d4]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#0078d4]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-[#a19f9d]" />
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-[#605e5c]">
                    <Send className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No dispersal records found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ Record Dispersal' to schedule a resident departure.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(record => (
                  <tr key={record.id} className="hover:bg-[#f3f8fd] transition-colors">
                    {visibleColumns.map(col => (
                      <td key={String(col.key)} className="p-2.5">
                        {renderColumnCell(col, record)}
                      </td>
                    ))}
                    <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingRecord(record)}
                          className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded-xs transition-colors"
                          title="View Details Dossier"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditRecord(record.siteName) && (
                          <button
                            onClick={() => setEditingRecord(record)}
                            className="p-1 hover:bg-[#eff6fc] text-[#0078d4] rounded-xs transition-colors"
                            title="Edit Dispersal"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete dispersal for ${record.suPortNassRef}?`)) {
                                deleteDispersalRecord(record.id);
                              }
                            }}
                            className="p-1 hover:bg-[#fdf3f4] text-[#a4262c] rounded-xs transition-colors"
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

        {/* Pagination Footer */}
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredRecords.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {/* Dynamic Create Modal */}
      <DynamicRecordFormModal<DispersalRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Record New Dispersal"
        columns={columns}
        initialValues={{
          sno: dispersalRecords.length + 1,
          siteName: !canAccessAllSites() ? assignedSite : (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])),
          dateReceived: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
          suPortNassRef: '',
          reasonForDeparture: 'Dispersal to Long-Term NASS accommodation',
          flatRoomNumber: '',
          dispersalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
          dateLetterHandedToSu: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
          iaExitBriefingCompleted: 'Yes',
          hoDispersalLetterReceived: 'Yes',
          travelled: 'Yes',
          dateLeftProperty: '',
          incidentWarningCompleted: 'No need',
          reasonFailedToTravel: '',
          secondDispersalDate: '',
          attachments: []
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Save Dispersal Record"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<DispersalRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Dispersal - ${editingRecord.suPortNassRef}`}
          columns={columns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Dossier Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<DispersalRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`Dispersal Case Dossier - ${viewingRecord.suPortNassRef}`}
          columns={columns}
          record={viewingRecord}
          onEdit={() => {
            const rec = viewingRecord;
            setViewingRecord(null);
            setEditingRecord(rec);
          }}
          canEdit={canEditRecord(viewingRecord.siteName)}
        />
      )}

      {/* Super Admin Table Schema Customizer Modal */}
      <TableSchemaEditorModal<DispersalRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Dispersal Sheet"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
