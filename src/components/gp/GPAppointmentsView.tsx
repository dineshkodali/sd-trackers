import React, { useState, useMemo } from 'react';
import { 
  Stethoscope, 
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
import { GPAppointmentRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { useTableSchema } from '../../hooks/useTableSchema';
import { GP_APPOINTMENTS_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';

const gpExportColumns: ExportColumnOption[] = [
  { id: 'siteName', label: 'Hotel / Site' },
  { id: 'suName', label: 'Service User Name' },
  { id: 'appointmentDate', label: 'Appointment Date' },
  { id: 'timeOfGp', label: 'Time of Appointment' },
  { id: 'status', label: 'Status' },
  { id: 'comments', label: 'Clinical / Case Comments' }
];

export const GPAppointmentsView: React.FC = () => {
  const {
    gpAppointmentRecords,
    addGPAppointmentRecord,
    updateGPAppointmentRecord,
    deleteGPAppointmentRecord,
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
  } = useTableSchema<GPAppointmentRecord>('gpAppointments', GP_APPOINTMENTS_TABLE_COLUMNS);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState(!canAccessAllSites() ? assignedSite : 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('appointmentDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GPAppointmentRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<GPAppointmentRecord | null>(null);

  const filteredRecords = useMemo(() => {
    return gpAppointmentRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.roomNo.toLowerCase().includes(q) ||
        r.portReference.toLowerCase().includes(q) ||
        (r.suName && r.suName.toLowerCase().includes(q)) ||
        (r.comments && r.comments.toLowerCase().includes(q)) ||
        (r.siteName && r.siteName.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesSite = siteFilter === 'all' || r.siteName === siteFilter;

      return matchesSearch && matchesStatus && matchesSite;
    });
  }, [gpAppointmentRecords, searchQuery, statusFilter, siteFilter]);

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

  const handleCreateSubmit = (data: Partial<GPAppointmentRecord>) => {
    addGPAppointmentRecord({
      roomNo: data.roomNo || '',
      portReference: data.portReference || '',
      referralSentOn: data.referralSentOn || new Date().toISOString().slice(0, 10),
      appointmentDate: data.appointmentDate || new Date().toISOString().slice(0, 10),
      timeOfGp: data.timeOfGp || '10:00',
      comments: data.comments || '',
      status: (data.status as any) || 'Scheduled',
      siteName: !canAccessAllSites() 
        ? assignedSite 
        : (data.siteName || (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0]))),
      suName: data.suName || '',
      ...data
    } as any);
    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<GPAppointmentRecord>) => {
    if (!editingRecord) return;
    updateGPAppointmentRecord(editingRecord.id, {
      ...editingRecord,
      ...data
    });
    setEditingRecord(null);
  };

  // Export Handlers with Custom Download & PDF/CSV Options
  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    let sourceData = gpAppointmentRecords;
    if (scope === 'filtered') sourceData = sortedRecords;
    else if (scope === 'custom' && startDate && endDate) {
      sourceData = gpAppointmentRecords.filter(g => {
        const d = g.appointmentDate || '';
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      });
    }
    return sourceData;
  };

  const calculateDateRangeCount = (startDate: string, endDate: string): number => {
    return gpAppointmentRecords.filter(g => {
      const d = g.appointmentDate || '';
      return (!startDate || d >= startDate) && (!endDate || d <= endDate);
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
      ? gpExportColumns.filter(c => selectedColumns.includes(c.id))
      : gpExportColumns;
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
      ? gpExportColumns.filter(c => selectedColumns.includes(c.id))
      : gpExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));

    if (format === 'csv') {
      exportTableToCsv({ filename: 'GP_Appointments_Register.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'GP_Appointments_Register.pdf',
        title: 'NHS & GP Clinical Consultations Register',
        headers,
        rows,
        orientation
      });
    }
  };

  const renderColumnCell = (col: TableColumnConfig<GPAppointmentRecord>, record: GPAppointmentRecord) => {
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

    if (col.type === 'date') {
      return <span className="font-mono text-[#323130]">{value || '—'}</span>;
    }

    if (col.type === 'currency' && typeof value === 'number') {
      return <span className="font-semibold text-[#242424]">£{value.toFixed(2)}</span>;
    }

    if (col.key === 'roomNo') {
      return <span className="font-semibold text-[#242424]">{value || '—'}</span>;
    }

    if (col.key === 'portReference') {
      return <span className="font-mono text-[#0f766e]">{value || '—'}</span>;
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
            <Stethoscope className="w-5 h-5 text-[#0d9488]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">
              GP Appointments Register
            </h1>
            <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#99f6e4]">
              {filteredRecords.length} Consultations
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Resident primary healthcare appointments, GP surgery referrals, time slots, attendance &amp; clinical comments.
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
            moduleName="GP Appointments"
            totalRecordCount={gpAppointmentRecords.length}
            filteredRecordCount={filteredRecords.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={gpExportColumns}
            getPreviewData={getExportPreviewData}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />

          {canCreateRecord() && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Book GP Appointment</span>
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

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Status:</span>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Attended">Attended</option>
              <option value="Did Not Attend (DNA)">Did Not Attend (DNA)</option>
              <option value="Rescheduled">Rescheduled</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Reset button */}
          {(siteFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSiteFilter('all');
                setStatusFilter('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-xs text-[#0d9488] hover:underline font-semibold"
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
            placeholder="Search Room, Port Ref, Resident Name..."
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
                    <Stethoscope className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No GP appointments recorded</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click 'Book GP Appointment' to schedule a consultation.</p>
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
                            className="p-1 hover:bg-[#f0fdfa] text-[#0d9488] rounded-xs transition-colors"
                            title="Edit Appointment"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete GP appointment for Room ${record.roomNo}?`)) {
                                deleteGPAppointmentRecord(record.id);
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
      <DynamicRecordFormModal<GPAppointmentRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Book GP Appointment"
        columns={columns}
        initialValues={{
          roomNo: '',
          portReference: '',
          referralSentOn: new Date().toISOString().slice(0, 10),
          appointmentDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          timeOfGp: '10:00',
          comments: '',
          status: 'Scheduled',
          siteName: !canAccessAllSites() ? assignedSite : (siteFilter !== 'all' ? siteFilter : (assignedSite || allowedSites[0])),
          suName: ''
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Schedule Consultation"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<GPAppointmentRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit GP Appointment - Room ${editingRecord.roomNo}`}
          columns={columns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Dossier Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<GPAppointmentRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`GP Consultation Dossier - Room ${viewingRecord.roomNo}`}
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
      <TableSchemaEditorModal<GPAppointmentRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="GP Appointments Register"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
