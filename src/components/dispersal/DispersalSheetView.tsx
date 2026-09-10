import React, { useState, useMemo } from 'react';
import { 
  Send, 
  Plus, 
  Search, 
  Download, 
  Edit3, 
  Trash2, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Building2, 
  FileText, 
  X, 
  Eye, 
  LogOut,
  ChevronRight,
  RefreshCw,
  PlaneTakeoff,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DispersalRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';

export const DispersalSheetView: React.FC = () => {
  const {
    dispersalRecords,
    addDispersalRecord,
    updateDispersalRecord,
    deleteDispersalRecord,
    allowedSites,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [travelledFilter, setTravelledFilter] = useState('all');
  const [secondDispersalFilter, setSecondDispersalFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DispersalRecord | null>(null);
  const [viewDetailRecord, setViewDetailRecord] = useState<DispersalRecord | null>(null);

  // Form State
  const initialFormState = {
    sno: dispersalRecords.length + 1,
    siteName: allowedSites[0] || 'Brit Hotel',
    dateReceived: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    suPortNassRef: '',
    reasonForDeparture: 'Dispersal to Long-Term NASS accommodation',
    flatRoomNumber: '',
    dispersalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    dateLetterHandedToSu: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    iaExitBriefingCompleted: 'Yes' as 'Yes' | 'No',
    hoDispersalLetterReceived: 'Yes' as 'Yes' | 'No',
    travelled: 'Yes' as 'Yes' | 'No',
    dateLeftProperty: '',
    incidentWarningCompleted: 'No need' as 'Yes' | 'No need' | 'No',
    reasonFailedToTravel: '',
    // 2nd Dispersal Cycle
    secondDispersalDate: '',
    dateSecondLetterHanded: '',
    secondIaExitBriefingCompleted: 'No' as 'Yes' | 'No',
    secondDispersalTravelled: 'No' as 'Yes' | 'No',
    secondDateLeftProperty: '',
    secondIncidentWarningCompleted: 'No need' as 'Yes' | 'No need' | 'No',
    reasonFailedToTravelSecond: ''
  };

  const [formData, setFormData] = useState(initialFormState);

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

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRecords.slice(startIndex, startIndex + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const handleOpenCreate = () => {
    setFormData({
      ...initialFormState,
      sno: dispersalRecords.length + 1
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (rec: DispersalRecord) => {
    setEditingRecord(rec);
    setFormData({
      sno: rec.sno,
      siteName: rec.siteName,
      dateReceived: rec.dateReceived,
      suPortNassRef: rec.suPortNassRef,
      reasonForDeparture: rec.reasonForDeparture,
      flatRoomNumber: rec.flatRoomNumber,
      dispersalDate: rec.dispersalDate,
      dateLetterHandedToSu: rec.dateLetterHandedToSu,
      iaExitBriefingCompleted: rec.iaExitBriefingCompleted,
      hoDispersalLetterReceived: rec.hoDispersalLetterReceived,
      travelled: rec.travelled,
      dateLeftProperty: rec.dateLeftProperty,
      incidentWarningCompleted: rec.incidentWarningCompleted,
      reasonFailedToTravel: rec.reasonFailedToTravel,
      secondDispersalDate: rec.secondDispersalDate || '',
      dateSecondLetterHanded: rec.dateSecondLetterHanded || '',
      secondIaExitBriefingCompleted: rec.secondIaExitBriefingCompleted || 'No',
      secondDispersalTravelled: rec.secondDispersalTravelled || 'No',
      secondDateLeftProperty: rec.secondDateLeftProperty || '',
      secondIncidentWarningCompleted: rec.secondIncidentWarningCompleted || 'No need',
      reasonFailedToTravelSecond: rec.reasonFailedToTravelSecond || ''
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.suPortNassRef.trim() || !formData.flatRoomNumber.trim()) return;

    if (editingRecord) {
      updateDispersalRecord(editingRecord.id, formData);
      setEditingRecord(null);
    } else {
      addDispersalRecord(formData);
      setIsCreateModalOpen(false);
    }
  };

  const handleExportCsv = () => {
    exportTableToCsv({
      filename: 'Dispersal_Sheet.csv',
      headers: [
        'SNO',
        'Site Name',
        'Date Received(MM/DD/YYYY)',
        'SU Port/Nass Reference',
        'Reason for the Departure',
        'Flat/Room Number',
        'Dispersal Date (MM/DD/YYYY)',
        'Date Dispersal Letter handed to SU (MM/DD/YYYY)',
        'IA Exit Briefing completed and signed (Yes/No)',
        'Home Office Dispersal letter received by SU (Yes/No)',
        'Travelled (Yes / No)',
        'Date left property (MM/DD/YYYY)',
        'Incident/Warning completed (Yes/No need)',
        'Reason for failed to travel',
        '2nd Dispersal Date(MM/DD/YYYY)',
        'Date Second Dispersal Letter handed to SU (MM/DD/YYYY)',
        '2nd IA Exit Briefing completed and signed',
        '2nd DispersalTravelled (Yes / No)',
        '2nd Date left property (MM/DD/YYYY)',
        '2ndIncident/Warning completed (Yes /No need)',
        'Reason for failed to travel 2nd Insistance'
      ],
      rows: filteredRecords.map(r => [
        r.sno,
        r.siteName,
        r.dateReceived,
        r.suPortNassRef,
        r.reasonForDeparture,
        r.flatRoomNumber,
        r.dispersalDate,
        r.dateLetterHandedToSu,
        r.iaExitBriefingCompleted,
        r.hoDispersalLetterReceived,
        r.travelled,
        r.dateLeftProperty,
        r.incidentWarningCompleted,
        r.reasonFailedToTravel,
        r.secondDispersalDate,
        r.dateSecondLetterHanded,
        r.secondIaExitBriefingCompleted,
        r.secondDispersalTravelled,
        r.secondDateLeftProperty,
        r.secondIncidentWarningCompleted,
        r.reasonFailedToTravelSecond
      ])
    });
  };


  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <PlaneTakeoff className="w-5 h-5 text-[#0d9488]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">Dispersal Sheet</h1>
            <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#99f6e4]">
              {filteredRecords.length} Dispersals
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Home Office dispersals, departure notifications, IA exit briefings, travel compliance &amp; 2nd dispersal tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#605e5c]" />
            <span>Export CSV</span>
          </button>

          {canCreateRecord() && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New Dispersal Record</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
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

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Travel Status:</span>
            <select
              value={travelledFilter}
              onChange={e => { setTravelledFilter(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Travel Statuses</option>
              <option value="Yes">Travelled: Yes</option>
              <option value="No">Travelled: No</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">2nd Cycle:</span>
            <select
              value={secondDispersalFilter}
              onChange={e => { setSecondDispersalFilter(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Records</option>
              <option value="yes">Has 2nd Dispersal</option>
            </select>
          </div>

          {(siteFilter !== 'all' || travelledFilter !== 'all' || secondDispersalFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSiteFilter('all');
                setTravelledFilter('all');
                setSecondDispersalFilter('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-xs text-[#0d9488] hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#605e5c]" />
          <input
            type="text"
            placeholder="Search Port/NASS Ref, Room, Reason..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-8 pr-3 py-1.5 border border-[#8a8886] rounded-xs text-[#323130] text-xs bg-white focus:outline-2 focus:outline-[#71afe5]"
          />
        </div>
      </div>

      {/* High-density Dispersal Sheet Table */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1550px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th className="p-2.5 text-center w-12">SNO</th>
                <th className="p-2.5">Site Name</th>
                <th className="p-2.5">Date Received</th>
                <th className="p-2.5">SU Port/Nass Ref</th>
                <th className="p-2.5">Flat/Room</th>
                <th className="p-2.5">Dispersal Date</th>
                <th className="p-2.5">Letter Handed</th>
                <th className="p-2.5 text-center">IA Briefing</th>
                <th className="p-2.5 text-center">HO Letter</th>
                <th className="p-2.5 text-center">Travelled</th>
                <th className="p-2.5">Date Left</th>
                <th className="p-2.5 text-center">Incident / Warning</th>
                <th className="p-2.5">Failed Reason</th>
                <th className="p-2.5 bg-[#f3f8fd]">2nd Dispersal Date</th>
                <th className="p-2.5 bg-[#f3f8fd] text-center">2nd Travelled</th>
                <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-[#605e5c]">
                    <PlaneTakeoff className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No dispersal records found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click '+ New Dispersal Record' to register a move or departure.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(record => (
                  <tr key={record.id} className="hover:bg-[#f3f8fd] transition-colors">
                    <td className="p-2.5 text-center font-mono font-medium text-[#605e5c]">
                      {record.sno}
                    </td>
                    <td className="p-2.5 font-medium text-[#242424] whitespace-nowrap">
                      {record.siteName}
                    </td>
                    <td className="p-2.5 font-mono text-[#605e5c] whitespace-nowrap">
                      {record.dateReceived}
                    </td>
                    <td className="p-2.5 font-mono font-semibold text-[#0f766e]">
                      {record.suPortNassRef}
                    </td>
                    <td className="p-2.5 font-semibold text-[#242424] whitespace-nowrap">
                      {record.flatRoomNumber}
                    </td>
                    <td className="p-2.5 font-mono text-[#242424] font-medium whitespace-nowrap">
                      {record.dispersalDate}
                    </td>
                    <td className="p-2.5 font-mono text-[#605e5c] whitespace-nowrap">
                      {record.dateLetterHandedToSu || '—'}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded-xs text-[10px] font-bold border ${
                        record.iaExitBriefingCompleted === 'Yes' 
                          ? 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]' 
                          : 'bg-[#fdf3f2] text-[#dc2626] border-[#fca5a5]'
                      }`}>
                        {record.iaExitBriefingCompleted}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded-xs text-[10px] font-bold border ${
                        record.hoDispersalLetterReceived === 'Yes' 
                          ? 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]' 
                          : 'bg-[#fdf3f2] text-[#dc2626] border-[#fca5a5]'
                      }`}>
                        {record.hoDispersalLetterReceived}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-xs text-[10px] font-bold border ${
                        record.travelled === 'Yes' 
                          ? 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]' 
                          : 'bg-[#fdf3f2] text-[#dc2626] border-[#fca5a5]'
                      }`}>
                        {record.travelled}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-[#605e5c] whitespace-nowrap">
                      {record.dateLeftProperty || '—'}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded-xs text-[10px] font-medium border ${
                        record.incidentWarningCompleted === 'Yes' 
                          ? 'bg-[#fffbeb] text-[#b45309] border-[#fde68a] font-semibold' 
                          : 'bg-[#faf9f8] text-[#605e5c] border-[#e1dfdd]'
                      }`}>
                        {record.incidentWarningCompleted}
                      </span>
                    </td>
                    <td className="p-2.5 max-w-xs truncate text-[#605e5c]" title={record.reasonFailedToTravel}>
                      {record.reasonFailedToTravel || '—'}
                    </td>
                    <td className="p-2.5 bg-[#f3f8fd]/50 font-mono text-[#242424] whitespace-nowrap">
                      {record.secondDispersalDate || '—'}
                    </td>
                    <td className="p-2.5 bg-[#f3f8fd]/50 text-center">
                      {record.secondDispersalDate ? (
                        <span className={`px-1.5 py-0.5 rounded-xs text-[10px] font-bold border ${
                          record.secondDispersalTravelled === 'Yes' 
                            ? 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]' 
                            : 'bg-[#fdf3f2] text-[#dc2626] border-[#fca5a5]'
                        }`}>
                          {record.secondDispersalTravelled}
                        </span>
                      ) : (
                        <span className="text-[#a19f9d]">—</span>
                      )}
                    </td>
                    <td className="p-2.5 text-right sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewDetailRecord(record)}
                          title="View Details"
                          className="p-1 text-[#605e5c] hover:text-[#242424] hover:bg-[#edebe9] rounded-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditRecord() && (
                          <button
                            onClick={() => handleOpenEdit(record)}
                            title="Edit Dispersal"
                            className="p-1 text-[#605e5c] hover:text-[#0f766e] hover:bg-[#f0fdfa] rounded-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => deleteDispersalRecord(record.id)}
                            title="Delete Record"
                            className="p-1 text-[#605e5c] hover:text-[#dc2626] hover:bg-[#fdf3f2] rounded-xs"
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

        {filteredRecords.length > 0 && (
          <div className="p-2.5 border-t border-[#edebe9] bg-[#faf9f8]">
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={filteredRecords.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
            />
          </div>
        )}
      </div>

      {/* Modal: Create / Edit Dispersal Record */}
      {(isCreateModalOpen || editingRecord) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xs shadow-xl w-full max-w-3xl overflow-hidden border border-[#e1dfdd] my-8">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e1dfdd] bg-[#faf9f8]">
              <div className="flex items-center gap-2">
                <PlaneTakeoff className="w-4 h-4 text-[#0d9488]" />
                <h2 className="text-sm font-semibold text-[#242424]">
                  {editingRecord ? `Edit Dispersal: ${editingRecord.suPortNassRef}` : 'New Dispersal Departure Record'}
                </h2>
              </div>
              <button
                onClick={() => { setIsCreateModalOpen(false); setEditingRecord(null); }}
                className="text-[#605e5c] hover:text-[#242424]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4">
              {/* Primary Dispersal Details */}
              <div>
                <h3 className="text-xs font-bold text-[#0f766e] uppercase tracking-wider mb-2.5">
                  1. Initial Dispersal Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Site Name *</label>
                    <select
                      value={formData.siteName}
                      onChange={e => setFormData({ ...formData, siteName: e.target.value })}
                      className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                    >
                      {allowedSites.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Date Received (MM/DD/YYYY)</label>
                    <input
                      type="text"
                      value={formData.dateReceived}
                      onChange={e => setFormData({ ...formData, dateReceived: e.target.value })}
                      placeholder="MM/DD/YYYY"
                      className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">SU Port/NASS Ref *</label>
                    <input
                      type="text"
                      required
                      value={formData.suPortNassRef}
                      onChange={e => setFormData({ ...formData, suPortNassRef: e.target.value })}
                      placeholder="e.g. CR0-882711"
                      className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Flat / Room Number *</label>
                    <input
                      type="text"
                      required
                      value={formData.flatRoomNumber}
                      onChange={e => setFormData({ ...formData, flatRoomNumber: e.target.value })}
                      placeholder="e.g. 118"
                      className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Dispersal Date (MM/DD/YYYY)</label>
                    <input
                      type="text"
                      value={formData.dispersalDate}
                      onChange={e => setFormData({ ...formData, dispersalDate: e.target.value })}
                      placeholder="MM/DD/YYYY"
                      className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Letter Handed Date (MM/DD/YYYY)</label>
                    <input
                      type="text"
                      value={formData.dateLetterHandedToSu}
                      onChange={e => setFormData({ ...formData, dateLetterHandedToSu: e.target.value })}
                      placeholder="MM/DD/YYYY"
                      className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5] font-mono"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Reason for the Departure</label>
                    <input
                      type="text"
                      value={formData.reasonForDeparture}
                      onChange={e => setFormData({ ...formData, reasonForDeparture: e.target.value })}
                      placeholder="e.g. Dispersal to Section 95 accommodation in Liverpool"
                      className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 bg-[#faf9f8] p-3 rounded-xs border border-[#e1dfdd]">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">IA Exit Briefing Signed?</label>
                    <select
                      value={formData.iaExitBriefingCompleted}
                      onChange={e => setFormData({ ...formData, iaExitBriefingCompleted: e.target.value as any })}
                      className="w-full text-xs p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">HO Letter Received by SU?</label>
                    <select
                      value={formData.hoDispersalLetterReceived}
                      onChange={e => setFormData({ ...formData, hoDispersalLetterReceived: e.target.value as any })}
                      className="w-full text-xs p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Travelled? (Yes/No)</label>
                    <select
                      value={formData.travelled}
                      onChange={e => setFormData({ ...formData, travelled: e.target.value as any })}
                      className="w-full text-xs p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-semibold focus:outline-2 focus:outline-[#71afe5]"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Incident/Warning Completed</label>
                    <select
                      value={formData.incidentWarningCompleted}
                      onChange={e => setFormData({ ...formData, incidentWarningCompleted: e.target.value as any })}
                      className="w-full text-xs p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                    >
                      <option value="No need">No need</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Date Left Property (MM/DD/YYYY)</label>
                    <input
                      type="text"
                      value={formData.dateLeftProperty}
                      onChange={e => setFormData({ ...formData, dateLeftProperty: e.target.value })}
                      placeholder="MM/DD/YYYY"
                      className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5] font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Reason for Failed to Travel</label>
                    <input
                      type="text"
                      value={formData.reasonFailedToTravel}
                      onChange={e => setFormData({ ...formData, reasonFailedToTravel: e.target.value })}
                      placeholder="If SU did not travel, reason why"
                      className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                    />
                  </div>
                </div>
              </div>

              {/* 2nd Dispersal Cycle */}
              <div className="pt-3 border-t border-[#e1dfdd]">
                <h3 className="text-xs font-bold text-[#242424] uppercase tracking-wider mb-2.5">
                  2. Second Dispersal Attempt (If applicable)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">2nd Dispersal Date (MM/DD/YYYY)</label>
                    <input
                      type="text"
                      value={formData.secondDispersalDate}
                      onChange={e => setFormData({ ...formData, secondDispersalDate: e.target.value })}
                      placeholder="MM/DD/YYYY"
                      className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Date 2nd Letter Handed</label>
                    <input
                      type="text"
                      value={formData.dateSecondLetterHanded}
                      onChange={e => setFormData({ ...formData, dateSecondLetterHanded: e.target.value })}
                      placeholder="MM/DD/YYYY"
                      className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">2nd IA Exit Briefing Signed?</label>
                    <select
                      value={formData.secondIaExitBriefingCompleted}
                      onChange={e => setFormData({ ...formData, secondIaExitBriefingCompleted: e.target.value as any })}
                      className="w-full text-xs p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">2nd Dispersal Travelled? (Yes/No)</label>
                    <select
                      value={formData.secondDispersalTravelled}
                      onChange={e => setFormData({ ...formData, secondDispersalTravelled: e.target.value as any })}
                      className="w-full text-xs p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-semibold focus:outline-2 focus:outline-[#71afe5]"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">2nd Date Left Property</label>
                    <input
                      type="text"
                      value={formData.secondDateLeftProperty}
                      onChange={e => setFormData({ ...formData, secondDateLeftProperty: e.target.value })}
                      placeholder="MM/DD/YYYY"
                      className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">2nd Incident/Warning Completed</label>
                    <select
                      value={formData.secondIncidentWarningCompleted}
                      onChange={e => setFormData({ ...formData, secondIncidentWarningCompleted: e.target.value as any })}
                      className="w-full text-xs p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                    >
                      <option value="No need">No need</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-[#605e5c] mb-1">Reason for Failed to Travel 2nd Instance</label>
                    <input
                      type="text"
                      value={formData.reasonFailedToTravelSecond}
                      onChange={e => setFormData({ ...formData, reasonFailedToTravelSecond: e.target.value })}
                      placeholder="Explanation for refusal or failure on 2nd attempt"
                      className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e1dfdd]">
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); setEditingRecord(null); }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#323130] bg-white border border-[#8a8886] rounded-xs hover:bg-[#edebe9] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] rounded-xs shadow-xs transition-colors"
                >
                  {editingRecord ? 'Save Dispersal Log' : 'Create Dispersal Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Details */}
      {viewDetailRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-xl w-full max-w-lg overflow-hidden border border-[#e1dfdd] my-8">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e1dfdd] bg-[#faf9f8]">
              <div className="flex items-center gap-2">
                <PlaneTakeoff className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424]">
                  Dispersal Dossier #{viewDetailRecord.sno}: {viewDetailRecord.suPortNassRef}
                </h3>
              </div>
              <button
                onClick={() => setViewDetailRecord(null)}
                className="text-[#605e5c] hover:text-[#242424]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-[#323130]">
              <div className="grid grid-cols-2 gap-3 bg-[#faf9f8] p-3 rounded-xs border border-[#e1dfdd]">
                <div>
                  <span className="text-[#605e5c] font-semibold">Hotel Site &amp; Flat/Room:</span>
                  <p className="font-semibold text-[#242424] mt-0.5">
                    {viewDetailRecord.siteName} — Flat/Room {viewDetailRecord.flatRoomNumber}
                  </p>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold">Port / NASS Ref:</span>
                  <p className="font-mono font-semibold text-[#0f766e] mt-0.5">{viewDetailRecord.suPortNassRef}</p>
                </div>
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold">Reason for Departure:</span>
                <p className="font-medium text-[#242424] mt-0.5">{viewDetailRecord.reasonForDeparture}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#605e5c] font-semibold">1st Dispersal Date:</span>
                  <p className="font-mono text-[#242424] mt-0.5">{viewDetailRecord.dispersalDate}</p>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold">Travelled:</span>
                  <p className={`font-bold mt-0.5 ${viewDetailRecord.travelled === 'Yes' ? 'text-[#0f766e]' : 'text-[#dc2626]'}`}>
                    {viewDetailRecord.travelled}
                  </p>
                </div>
              </div>

              {viewDetailRecord.reasonFailedToTravel && (
                <div>
                  <span className="text-[#605e5c] font-semibold">Reason Failed to Travel (1st Attempt):</span>
                  <p className="bg-[#fdf3f2] p-2 rounded-xs border border-[#fca5a5] text-[#dc2626] mt-1">
                    {viewDetailRecord.reasonFailedToTravel}
                  </p>
                </div>
              )}

              {viewDetailRecord.secondDispersalDate && (
                <div className="p-3 bg-[#f3f8fd] rounded-xs border border-[#99f6e4] space-y-2">
                  <span className="text-[10px] font-bold text-[#0f766e] uppercase tracking-wider">2nd Dispersal Cycle</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[#605e5c]">2nd Date:</span>
                      <p className="font-mono font-medium text-[#242424]">{viewDetailRecord.secondDispersalDate}</p>
                    </div>
                    <div>
                      <span className="text-[#605e5c]">2nd Travelled:</span>
                      <p className="font-bold text-[#242424]">{viewDetailRecord.secondDispersalTravelled}</p>
                    </div>
                  </div>
                  {viewDetailRecord.reasonFailedToTravelSecond && (
                    <div>
                      <span className="text-[#605e5c]">Reason 2nd Failure:</span>
                      <p className="text-[#dc2626] font-medium">{viewDetailRecord.reasonFailedToTravelSecond}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-[#e1dfdd]">
                <button
                  onClick={() => setViewDetailRecord(null)}
                  className="px-3.5 py-1.5 bg-[#f3f2f1] hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
