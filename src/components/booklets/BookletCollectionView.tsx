import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
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
import { BookletCollectionRecord } from '../../types';
import { IA_HOTEL_NAMES } from '../../data/initialData';
import { exportTableToCsv } from '../../utils/csvExport';
import { useTableSchema } from '../../hooks/useTableSchema';
import { BOOKLETS_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableColumnConfig } from '../../types/tableSchema';

export const BookletCollectionView: React.FC = () => {
  const {
    bookletRecords,
    updateBookletRecord,
    addBookletRecord,
    deleteBookletRecord,
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
  } = useTableSchema<BookletCollectionRecord>('booklets', BOOKLETS_TABLE_COLUMNS);

  const [selectedHotel, setSelectedHotel] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [bookletTypeFilter, setBookletTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortKey, setSortKey] = useState<string>('hotelName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BookletCollectionRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<BookletCollectionRecord | null>(null);

  const filteredRecords = useMemo(() => {
    return bookletRecords.filter(r => {
      const matchesHotel = selectedHotel === 'all' || r.hotelName === selectedHotel;
      const matchesAgent = selectedAgent === 'all' || r.agentName === selectedAgent;
      const matchesType = bookletTypeFilter === 'all' || r.bookletType === bookletTypeFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        r.language.toLowerCase().includes(q) || 
        r.bookletType.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q));

      return matchesHotel && matchesAgent && matchesType && matchesQuery;
    });
  }, [bookletRecords, selectedHotel, selectedAgent, bookletTypeFilter, searchQuery]);

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

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleCreateSubmit = (data: Partial<BookletCollectionRecord>) => {
    addBookletRecord({
      hotelName: data.hotelName || IA_HOTEL_NAMES[0],
      agentName: data.agentName || 'Ready Homes',
      bookletType: data.bookletType || 'Migrant Help booklets',
      language: data.language || 'English',
      numberForCollection: Number(data.numberForCollection) || 50,
      collectedBooklets: Number(data.collectedBooklets) || 0,
      bookletsReceived: Number(data.bookletsReceived) || 0,
      status: (data.status as any) || 'Pending Collection',
      notes: data.notes || '',
      ...data
    } as any);
    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = (data: Partial<BookletCollectionRecord>) => {
    if (!editingRecord) return;
    updateBookletRecord(editingRecord.id, {
      ...editingRecord,
      ...data
    });
    setEditingRecord(null);
  };

  const handleExportCsv = () => {
    exportTableToCsv({
      filename: 'Booklets_Collection_Register.csv',
      headers: visibleColumns.map(col => col.label),
      rows: sortedRecords.map(r => 
        visibleColumns.map(col => {
          const val = (r as any)[col.key];
          return val !== undefined && val !== null ? String(val) : '';
        })
      )
    });
  };

  const renderColumnCell = (col: TableColumnConfig<BookletCollectionRecord>, record: BookletCollectionRecord) => {
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

    if (col.key === 'hotelName') {
      return <span className="font-semibold text-[#242424]">{value || '—'}</span>;
    }

    if (col.key === 'numberForCollection' || col.key === 'collectedBooklets' || col.key === 'bookletsReceived') {
      return <span className="font-mono text-center block font-medium">{value ?? 0}</span>;
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
            <BookOpen className="w-5 h-5 text-[#8764b8]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">
              Booklets to be Collected
            </h1>
            <span className="text-xs bg-purple-50 text-[#8764b8] font-semibold px-2 py-0.5 rounded-xs border border-purple-200">
              {filteredRecords.length} Consignments
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Initial Accommodation onboarding literature, translations, collection targets, and delivery receipts.
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

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#605e5c]" />
            <span>Export CSV</span>
          </button>

          {canCreateRecord() && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#8764b8] hover:bg-[#744da9] text-white rounded-xs shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Booklet Stock</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Hotel Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Hotel:</span>
            <select
              value={selectedHotel}
              onChange={e => setSelectedHotel(e.target.value)}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Hotels</option>
              {IA_HOTEL_NAMES.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Type:</span>
            <select
              value={bookletTypeFilter}
              onChange={e => setBookletTypeFilter(e.target.value)}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Booklet Types</option>
              <option value="Migrant Help booklets">Migrant Help</option>
              <option value="Point of Arrival Welcome Guides">Welcome Guides</option>
              <option value="Fire Safety & Rules Booklets">Fire Safety</option>
              <option value="Health & Medical Registration Guides">Medical Guides</option>
            </select>
          </div>

          {/* Reset button */}
          {(selectedHotel !== 'all' || selectedAgent !== 'all' || bookletTypeFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedHotel('all');
                setSelectedAgent('all');
                setBookletTypeFilter('all');
                setSearchQuery('');
              }}
              className="px-2 py-1 text-xs text-[#8764b8] hover:underline font-semibold"
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
            placeholder="Search Language, Type, Notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-[#8a8886] rounded-xs text-[#323130] text-xs bg-white focus:outline-2 focus:outline-[#71afe5]"
          />
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
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
              {sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-[#605e5c]">
                    <BookOpen className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No booklet stock records found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ Add Booklet Stock' to record onboarding literature.</p>
                  </td>
                </tr>
              ) : (
                sortedRecords.map(record => (
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
                        {canEditRecord() && (
                          <button
                            onClick={() => setEditingRecord(record)}
                            className="p-1 hover:bg-[#f3f0f9] text-[#8764b8] rounded-xs transition-colors"
                            title="Edit Booklet Consignment"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord && canDeleteRecord() && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete ${record.bookletType} for ${record.hotelName}?`)) {
                                deleteBookletRecord(record.id);
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
      </div>

      {/* Dynamic Create Modal */}
      <DynamicRecordFormModal<BookletCollectionRecord>
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Booklet Consignment"
        columns={columns}
        initialValues={{
          hotelName: IA_HOTEL_NAMES[0],
          agentName: 'Ready Homes',
          bookletType: 'Migrant Help booklets',
          language: 'English',
          numberForCollection: 50,
          collectedBooklets: 0,
          bookletsReceived: 0,
          status: 'Pending Collection',
          notes: ''
        }}
        onSubmit={handleCreateSubmit}
        submitLabel="Register Consignment"
      />

      {/* Dynamic Edit Modal */}
      {editingRecord && (
        <DynamicRecordFormModal<BookletCollectionRecord>
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title={`Edit Consignment - ${editingRecord.bookletType}`}
          columns={columns}
          initialValues={editingRecord}
          onSubmit={handleEditSubmit}
          submitLabel="Save Changes"
        />
      )}

      {/* Dynamic View Dossier Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<BookletCollectionRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`Booklet Stock Dossier - ${viewingRecord.bookletType}`}
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

      {/* Super Admin Table Schema Customizer Modal */}
      <TableSchemaEditorModal<BookletCollectionRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Booklets to be Collected"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
