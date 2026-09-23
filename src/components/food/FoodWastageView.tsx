import React, { useState, useMemo } from 'react';
import { 
  Trash2, 
  Plus, 
  Search, 
  Edit3, 
  Eye, 
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UtensilsCrossed,
  Download
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FoodWastageRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { useTableSchema } from '../../hooks/useTableSchema';
import { FOOD_WASTAGE_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';

const foodWastageExportColumns: ExportColumnOption[] = [
  { id: 'site', label: 'Hotel / Site', defaultSelected: true },
  { id: 'date', label: 'Date', defaultSelected: true },
  { id: 'foodWastage', label: 'Food Wastage Item', defaultSelected: true },
  { id: 'quantity', label: 'Quantity / Weight', defaultSelected: true },
  { id: 'comments', label: 'Kitchen Notes / Comments', defaultSelected: true }
];

export const FoodWastageView: React.FC = () => {
  const {
    foodWastageRecords,
    addFoodWastageRecord,
    updateFoodWastageRecord,
    deleteFoodWastageRecord,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    assignedSite,
    canAccessAllSites,
    sites
  } = useApp();

  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<FoodWastageRecord>('foodWastage', FOOD_WASTAGE_TABLE_COLUMNS);

  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FoodWastageRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<FoodWastageRecord | null>(null);

  // Site isolation filter
  const accessibleRecords = useMemo(() => {
    if (canAccessAllSites()) return foodWastageRecords;
    if (!assignedSite || assignedSite === 'All Sites') return foodWastageRecords;
    return foodWastageRecords.filter(r => r.site?.toLowerCase() === assignedSite.toLowerCase());
  }, [foodWastageRecords, canAccessAllSites, assignedSite]);

  const filteredRecords = useMemo(() => {
    return accessibleRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.site.toLowerCase().includes(q) ||
        r.foodWastage.toLowerCase().includes(q) ||
        (r.quantity && r.quantity.toLowerCase().includes(q)) ||
        (r.comments && r.comments.toLowerCase().includes(q));

      const matchesSite = siteFilter === 'all' || r.site === siteFilter;
      return matchesSearch && matchesSite;
    });
  }, [accessibleRecords, searchQuery, siteFilter]);

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

  const handleCreateSubmit = (data: Partial<FoodWastageRecord>) => {
    addFoodWastageRecord({
      site: data.site || (assignedSite && assignedSite !== 'All Sites' ? assignedSite : 'Brit Hotel'),
      date: data.date || new Date().toISOString().slice(0, 10),
      foodWastage: data.foodWastage || '',
      quantity: data.quantity || '',
      comments: data.comments || '',
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      ...data
    } as any);
    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<FoodWastageRecord>) => {
    if (!editingRecord) return;
    updateFoodWastageRecord(editingRecord.id, {
      ...editingRecord,
      ...data,
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    });
    setEditingRecord(null);
  };

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    let sourceData = accessibleRecords;
    if (scope === 'filtered') sourceData = sortedRecords;
    else if (scope === 'custom' && startDate && endDate) {
      sourceData = accessibleRecords.filter(d => {
        const val = d.date || '';
        return (!startDate || val >= startDate) && (!endDate || val <= endDate);
      });
    }
    return sourceData;
  };

  const calculateDateRangeCount = (startDate: string, endDate: string): number => {
    return accessibleRecords.filter(d => {
      const val = d.date || '';
      return (!startDate || val >= startDate) && (!endDate || val <= endDate);
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
      ? foodWastageExportColumns.filter(c => selectedColumns.includes(c.id))
      : foodWastageExportColumns;
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
      ? foodWastageExportColumns.filter(c => selectedColumns.includes(c.id))
      : foodWastageExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));

    if (format === 'csv') {
      exportTableToCsv({ filename: 'Food_Wastage_Tracker.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'Food_Wastage_Tracker.pdf',
        title: 'Food Wastage Tracker Report',
        subtitle: `Site Scope: ${siteFilter === 'all' ? 'All Permitted Sites' : siteFilter}`,
        headers,
        rows,
        orientation
      });
    }
  };

  const renderColumnCell = (col: TableColumnConfig<FoodWastageRecord>, record: FoodWastageRecord) => {
    if (col.renderCell) {
      return col.renderCell((record as any)[col.key], record);
    }
    const value = (record as any)[col.key];

    if (col.key === 'site') {
      return <span className="font-medium text-[#0f766e] bg-teal-50 px-2 py-0.5 rounded border border-teal-100">{value || '—'}</span>;
    }
    if (col.key === 'foodWastage') {
      return <span className="font-semibold text-[#242424]">{value || '—'}</span>;
    }
    if (col.key === 'quantity') {
      return <span className="font-mono text-[#b45309] bg-amber-50 px-2 py-0.5 rounded font-semibold">{value || '—'}</span>;
    }
    if (col.key === 'comments') {
      return <span className="block max-w-xs truncate text-[#323130]" title={String(value || '')}>{value || '—'}</span>;
    }
    if (value === null || value === undefined || value === '') {
      return <span className="text-[#a19f9d]">—</span>;
    }
    return String(value);
  };

  const availableSites = useMemo(() => {
    return (sites || []).map(s => typeof s === 'string' ? s : s?.name).filter(Boolean);
  }, [sites]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-700" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">
              Food Wastage Tracker
            </h1>
            <span className="text-xs bg-amber-50 text-amber-900 font-semibold px-2 py-0.5 rounded-xs border border-amber-200">
              {filteredRecords.length} Wastage Records
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Log and monitor daily food wastage items, quantities, and operational kitchen notes.
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
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
              <span>Customize Table</span>
            </button>
          )}

          <ExportDropdown
            moduleName="Food Wastage"
            totalRecordCount={accessibleRecords.length}
            filteredRecordCount={filteredRecords.length}
            defaultOrientation="landscape"
            dateRangeRecordCount={calculateDateRangeCount}
            availableColumns={foodWastageExportColumns}
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
              <span>+ Log Food Wastage</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {canAccessAllSites() && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#605e5c]">Site:</span>
              <select
                value={siteFilter}
                onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); }}
                className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#0d9488]"
              >
                <option value="all">All Sites</option>
                {availableSites.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {(siteFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => { setSiteFilter('all'); setSearchQuery(''); setCurrentPage(1); }}
              className="px-2 py-1 text-xs text-[#0d9488] hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#605e5c]" />
          <input
            type="text"
            placeholder="Search Food Wastage, Site, Notes..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-8 pr-3 py-1.5 border border-[#8a8886] rounded-xs text-[#323130] text-xs bg-white focus:outline-2 focus:outline-[#0d9488]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[500px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
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
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-[#605e5c]">
                    <UtensilsCrossed className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No food wastage logs found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ Log Food Wastage' to record a new entry.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(record => (
                  <tr key={record.id} className="hover:bg-[#f0fdf4] transition-colors">
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
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditRecord() && (
                          <button
                            onClick={() => setEditingRecord(record)}
                            className="p-1 hover:bg-teal-50 text-[#0d9488] rounded-xs transition-colors"
                            title="Edit Record"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => deleteFoodWastageRecord(record.id)}
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

        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredRecords.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {/* Dynamic Create Modal */}
      <DynamicRecordFormModal<FoodWastageRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Log Food Wastage Record"
        columns={columns}
        initialValues={{
          site: assignedSite && assignedSite !== 'All Sites' ? assignedSite : 'Brit Hotel',
          date: new Date().toISOString().slice(0, 10),
          foodWastage: '',
          quantity: '',
          comments: '',
          attachments: []
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Save Wastage Record"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<FoodWastageRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Food Wastage - ${editingRecord.foodWastage || editingRecord.id}`}
          columns={columns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<FoodWastageRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`Food Wastage Dossier - ${viewingRecord.foodWastage || viewingRecord.id}`}
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

      {/* Super Admin Table Customizer */}
      <TableSchemaEditorModal<FoodWastageRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Food Wastage Tracker"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
