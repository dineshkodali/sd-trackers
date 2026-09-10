import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Download, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Building2, 
  Languages, 
  Edit3, 
  Save, 
  Trash2,
  PackageCheck,
  Layers,
  Sparkles,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BookletCollectionRecord } from '../../types';
import { IA_HOTEL_NAMES } from '../../data/initialData';
import { exportTableToCsv } from '../../utils/csvExport';

export const BookletCollectionView: React.FC = () => {
  const {
    bookletRecords,
    updateBookletRecord,
    addBookletRecord,
    deleteBookletRecord,
    resetBookletsToDefault,
    canCreateRecord,
    canEditRecord
  } = useApp();

  const [selectedHotel, setSelectedHotel] = useState<string>(IA_HOTEL_NAMES[0]);
  const [selectedAgent, setSelectedAgent] = useState<string>('Ready Homes');
  const [bookletTypeFilter, setBookletTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ collected: number; received: number; target: number }>({
    collected: 0,
    received: 0,
    target: 0
  });

  // New Booklet Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newBookletData, setNewBookletData] = useState({
    hotelName: selectedHotel,
    agentName: selectedAgent,
    bookletType: 'Migrant Help booklets',
    language: '',
    numberForCollection: 50,
    collectedBooklets: 0,
    bookletsReceived: 0,
    notes: ''
  });

  const filteredRecords = useMemo(() => {
    return bookletRecords.filter(r => {
      const matchesHotel = !selectedHotel || r.hotelName === selectedHotel;
      const matchesAgent = !selectedAgent || r.agentName === selectedAgent;
      const matchesType = bookletTypeFilter === 'all' || r.bookletType === bookletTypeFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        r.language.toLowerCase().includes(q) || 
        r.bookletType.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q));

      return matchesHotel && matchesAgent && matchesType && matchesQuery;
    });
  }, [bookletRecords, selectedHotel, selectedAgent, bookletTypeFilter, searchQuery]);


  const handleStartEdit = (r: BookletCollectionRecord) => {
    setEditingId(r.id);
    setEditValues({
      collected: r.collectedBooklets,
      received: r.bookletsReceived,
      target: r.numberForCollection
    });
  };

  const handleSaveEdit = (id: string) => {
    updateBookletRecord(id, {
      collectedBooklets: Number(editValues.collected) || 0,
      bookletsReceived: Number(editValues.received) || 0,
      numberForCollection: Number(editValues.target) || 0,
      status: Number(editValues.received) >= Number(editValues.target) && Number(editValues.target) > 0 
        ? 'Received at Site' 
        : Number(editValues.collected) > 0 
        ? 'Partially Collected' 
        : 'Pending Collection'
    });
    setEditingId(null);
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookletData.language.trim()) return;
    addBookletRecord({
      ...newBookletData,
      hotelName: selectedHotel,
      agentName: selectedAgent,
      status: 'Pending Collection',
      lastUpdated: new Date().toISOString().split('T')[0]
    });
    setIsNewModalOpen(false);
    setNewBookletData({
      hotelName: selectedHotel,
      agentName: selectedAgent,
      bookletType: 'Migrant Help booklets',
      language: '',
      numberForCollection: 50,
      collectedBooklets: 0,
      bookletsReceived: 0,
      notes: ''
    });
  };

  const handleExportCsv = () => {
    exportTableToCsv({
      filename: `Booklet_Collection_${selectedHotel.replace(/\s+/g, '_')}.csv`,
      headers: [
        'IA Hotel Name',
        'Agent Name',
        'Booklet Type',
        'Language',
        'Number for Collection',
        'Collected Booklets',
        'Booklets Received',
        'Deficit',
        'Status',
        'Last Updated'
      ],
      rows: filteredRecords.map(r => [
        r.hotelName,
        r.agentName,
        r.bookletType,
        r.language,
        r.numberForCollection,
        r.collectedBooklets,
        r.bookletsReceived,
        Math.max(0, r.numberForCollection - r.bookletsReceived),
        r.status || 'Pending Collection',
        r.lastUpdated
      ])
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#0d9488]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">Booklets to be Collected</h1>
            <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#99f6e4]">
              {filteredRecords.length} Language Lines
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            SD Commercial UK &amp; Ready Homes — Initial Accommodation (IA) multi-lingual resident induction booklet inventory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetBookletsToDefault}
            title="Reset to original master inventory"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#605e5c] bg-white border border-[#8a8886] rounded-xs hover:bg-[#edebe9] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#605e5c]" />
            <span>Reset Master</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#605e5c]" />
            <span>Export CSV</span>
          </button>

          {canCreateRecord() && (
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Language / Line</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* IA Hotel Site */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Hotel Site:</span>
            <select
              value={selectedHotel}
              onChange={e => setSelectedHotel(e.target.value)}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              {IA_HOTEL_NAMES.map(hotel => (
                <option key={hotel} value={hotel}>{hotel}</option>
              ))}
            </select>
          </div>

          {/* Managing Agent */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Managing Agent:</span>
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value as 'Ready Homes' | 'SD Commercial')}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="Ready Homes">Ready Homes</option>
              <option value="SD Commercial">SD Commercial UK</option>
            </select>
          </div>

          {/* Booklet Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Type:</span>
            <select
              value={bookletTypeFilter}
              onChange={e => setBookletTypeFilter(e.target.value)}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Booklet Types</option>
              <option value="Migrant Help booklets">Migrant Help booklets</option>
              <option value="Right &amp; Expectation booklets">Right &amp; Expectation booklets</option>
              <option value="Living In IA">Living In IA</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(bookletTypeFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setBookletTypeFilter('all');
                setSearchQuery('');
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
            placeholder="Search language or notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-[#8a8886] rounded-xs text-[#323130] text-xs bg-white focus:outline-2 focus:outline-[#71afe5]"
          />
        </div>
      </div>

      {/* Booklets Inventory Table */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th className="p-2.5">Booklet Type</th>
                <th className="p-2.5">Language</th>
                <th className="p-2.5 text-center">Number for collection</th>
                <th className="p-2.5 text-center">Collected Booklets</th>
                <th className="p-2.5 text-center">Booklets Received</th>
                <th className="p-2.5 text-center">Status</th>
                <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Quick Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#605e5c]">
                    <BookOpen className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No booklet records found for {selectedHotel}</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click 'Reset Master' to load default language batches.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map(record => {
                  const isEditing = editingId === record.id;
                  const isFull = record.bookletsReceived >= record.numberForCollection && record.numberForCollection > 0;

                  return (
                    <tr key={record.id} className="hover:bg-[#f3f8fd] transition-colors">
                      <td className="p-2.5 font-semibold text-[#242424] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-[#0d9488]" />
                          {record.bookletType}
                        </span>
                      </td>

                      <td className="p-2.5 font-medium text-[#242424] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-[#f3f2f1] border border-[#e1dfdd] font-mono text-[11px]">
                          <Languages className="w-3 h-3 text-[#605e5c]" />
                          {record.language}
                        </span>
                      </td>

                      {/* Number for collection */}
                      <td className="p-2.5 text-center font-bold text-[#242424]">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editValues.target}
                            onChange={e => setEditValues({ ...editValues, target: parseInt(e.target.value) || 0 })}
                            className="w-20 text-center font-bold text-xs py-1 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5]"
                          />
                        ) : (
                          record.numberForCollection || 0
                        )}
                      </td>

                      {/* Collected Booklets */}
                      <td className="p-2.5 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editValues.collected}
                            onChange={e => setEditValues({ ...editValues, collected: parseInt(e.target.value) || 0 })}
                            className="w-20 text-center font-semibold text-xs py-1 border border-[#fde68a] rounded-xs bg-[#fffbeb] focus:outline-2 focus:outline-[#71afe5]"
                          />
                        ) : (
                          <span className="font-semibold text-[#b45309] bg-[#fffbeb] px-2.5 py-0.5 rounded-xs border border-[#fde68a]">
                            {record.collectedBooklets || 0}
                          </span>
                        )}
                      </td>

                      {/* Booklets Received */}
                      <td className="p-2.5 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editValues.received}
                            onChange={e => setEditValues({ ...editValues, received: parseInt(e.target.value) || 0 })}
                            className="w-20 text-center font-semibold text-xs py-1 border border-[#99f6e4] rounded-xs bg-[#f0fdfa] focus:outline-2 focus:outline-[#71afe5]"
                          />
                        ) : (
                          <span className={`font-semibold px-2.5 py-0.5 rounded-xs border ${
                            isFull 
                              ? 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4] font-bold' 
                              : 'bg-[#faf9f8] text-[#323130] border-[#e1dfdd]'
                          }`}>
                            {record.bookletsReceived || 0}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-2.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-xs text-[10px] font-semibold border ${
                          isFull 
                            ? 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]' 
                            : record.collectedBooklets > 0 
                            ? 'bg-[#fffbeb] text-[#b45309] border-[#fde68a]' 
                            : 'bg-[#faf9f8] text-[#605e5c] border-[#e1dfdd]'
                        }`}>
                          {isFull ? 'Received at Site' : record.collectedBooklets > 0 ? 'In Transit / Collected' : 'Pending'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                        {isEditing ? (
                          <button
                            onClick={() => handleSaveEdit(record.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] rounded-xs shadow-xs"
                          >
                            <Save className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(record)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[#605e5c] hover:text-[#0f766e] hover:bg-[#f0fdfa] rounded-xs transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New Booklet Row */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-xl w-full max-w-md overflow-hidden border border-[#e1dfdd] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e1dfdd] bg-[#faf9f8]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424]">Add Booklet Allocation Line</h3>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-[#605e5c] hover:text-[#242424]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNew} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#605e5c] mb-1">IA Hotel Name</label>
                <input
                  type="text"
                  disabled
                  value={selectedHotel}
                  className="w-full p-2 bg-[#f3f2f1] border border-[#e1dfdd] rounded-xs text-[#605e5c]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#605e5c] mb-1">Booklet Type</label>
                <select
                  value={newBookletData.bookletType}
                  onChange={e => setNewBookletData({ ...newBookletData, bookletType: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                >
                  <option value="Migrant Help booklets">Migrant Help booklets</option>
                  <option value="Right &amp; Expectation booklets">Right &amp; Expectation booklets</option>
                  <option value="Living In IA">Living In IA</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#605e5c] mb-1">Language *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kurdish, Pashto, Somali..."
                  value={newBookletData.language}
                  onChange={e => setNewBookletData({ ...newBookletData, language: e.target.value })}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-[#605e5c] mb-1">Required</label>
                  <input
                    type="number"
                    min="0"
                    value={newBookletData.numberForCollection}
                    onChange={e => setNewBookletData({ ...newBookletData, numberForCollection: parseInt(e.target.value) || 0 })}
                    className="w-full p-1.5 border border-[#8a8886] rounded-xs text-center font-bold bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#605e5c] mb-1">Collected</label>
                  <input
                    type="number"
                    min="0"
                    value={newBookletData.collectedBooklets}
                    onChange={e => setNewBookletData({ ...newBookletData, collectedBooklets: parseInt(e.target.value) || 0 })}
                    className="w-full p-1.5 border border-[#8a8886] rounded-xs text-center bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#605e5c] mb-1">Received</label>
                  <input
                    type="number"
                    min="0"
                    value={newBookletData.bookletsReceived}
                    onChange={e => setNewBookletData({ ...newBookletData, bookletsReceived: parseInt(e.target.value) || 0 })}
                    className="w-full p-1.5 border border-[#8a8886] rounded-xs text-center bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e1dfdd]">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#323130] bg-white border border-[#8a8886] rounded-xs hover:bg-[#edebe9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] rounded-xs shadow-xs"
                >
                  Add Line
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
