import React, { useState, useMemo } from 'react';
import { 
  Bus, 
  Plus, 
  Search, 
  Download, 
  Edit3, 
  Trash2, 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  X,
  Eye,
  Filter,
  Navigation
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PublicTransportRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';

export const PublicTransportTrackerView: React.FC = () => {
  const {
    publicTransportRecords,
    addPublicTransportRecord,
    updatePublicTransportRecord,
    deletePublicTransportRecord,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PublicTransportRecord | null>(null);
  const [viewDetailRecord, setViewDetailRecord] = useState<PublicTransportRecord | null>(null);

  // Form State
  const initialFormState = {
    approvalUrn: '',
    suNames: '',
    portRefs: '',
    accommodationAddress: '',
    appointmentDate: new Date().toISOString().slice(0, 10),
    appointmentTime: '10:00',
    appointmentLocation: '',
    distanceMiles: 5.0,
    modeOfTransport: 'Bus',
    exceptionalCircumstances: '',
    status: 'Approved' as 'Approved' | 'Pending' | 'Completed' | 'Cancelled'
  };

  const [formData, setFormData] = useState(initialFormState);

  const filteredRecords = useMemo(() => {
    return publicTransportRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.approvalUrn.toLowerCase().includes(q) ||
        r.suNames.toLowerCase().includes(q) ||
        r.portRefs.toLowerCase().includes(q) ||
        r.accommodationAddress.toLowerCase().includes(q) ||
        r.appointmentLocation.toLowerCase().includes(q) ||
        r.modeOfTransport.toLowerCase().includes(q) ||
        r.exceptionalCircumstances.toLowerCase().includes(q);

      const matchesMode = modeFilter === 'all' || r.modeOfTransport.toLowerCase() === modeFilter.toLowerCase();
      const matchesStatus = statusFilter === 'all' || (r.status || 'Approved') === statusFilter;

      return matchesSearch && matchesMode && matchesStatus;
    });
  }, [publicTransportRecords, searchQuery, modeFilter, statusFilter]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRecords.slice(startIndex, startIndex + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const handleOpenCreate = () => {
    setFormData({
      ...initialFormState,
      approvalUrn: `URN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (rec: PublicTransportRecord) => {
    setEditingRecord(rec);
    setFormData({
      approvalUrn: rec.approvalUrn,
      suNames: rec.suNames,
      portRefs: rec.portRefs,
      accommodationAddress: rec.accommodationAddress,
      appointmentDate: rec.appointmentDate,
      appointmentTime: rec.appointmentTime,
      appointmentLocation: rec.appointmentLocation,
      distanceMiles: Number(rec.distanceMiles) || 0,
      modeOfTransport: rec.modeOfTransport,
      exceptionalCircumstances: rec.exceptionalCircumstances,
      status: rec.status || 'Approved'
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.approvalUrn.trim() || !formData.suNames.trim()) return;

    if (editingRecord) {
      updatePublicTransportRecord(editingRecord.id, formData);
      setEditingRecord(null);
    } else {
      addPublicTransportRecord(formData);
      setIsCreateModalOpen(false);
    }
  };

  const handleExportCsv = () => {
    exportTableToCsv({
      filename: 'Public_Transport_Tracker.csv',
      headers: [
        'Approval URN',
        'Service User Name(s)',
        'Port Ref Number(s)',
        'Accommodation Address',
        'Appointment Date',
        'Appointment Time',
        'Appointment Location',
        'Distance (Miles)',
        'Mode of Transport',
        'Exceptional Circumstances',
        'Status'
      ],
      rows: filteredRecords.map(r => [
        r.approvalUrn,
        r.suNames,
        r.portRefs,
        r.accommodationAddress,
        r.appointmentDate,
        r.appointmentTime,
        r.appointmentLocation,
        r.distanceMiles,
        r.modeOfTransport,
        r.exceptionalCircumstances,
        r.status || 'Approved'
      ])
    });
  };


  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <Bus className="w-5 h-5 text-[#0d9488]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">
              Public Transport Tracker
            </h1>
            <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#99f6e4]">
              {filteredRecords.length} Authorizations
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Service User travel approvals, Home Office appointments, distance &amp; exceptional circumstances logging.
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
              <span>+ New Approval</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Mode:</span>
            <select
              value={modeFilter}
              onChange={e => { setModeFilter(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Modes of Transport</option>
              <option value="bus">Bus</option>
              <option value="train">Public Train / Tube</option>
              <option value="taxi">Taxi / Private Hire</option>
              <option value="walking">Walking</option>
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
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(modeFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setModeFilter('all');
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

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#605e5c]" />
          <input
            type="text"
            placeholder="Search URN, SU Name, Port Ref, Address..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-8 pr-3 py-1.5 border border-[#8a8886] rounded-xs text-[#323130] text-xs bg-white focus:outline-2 focus:outline-[#71afe5]"
          />
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1400px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th className="p-2.5">Approval URN</th>
                <th className="p-2.5">Service User Name(s)</th>
                <th className="p-2.5">Port Ref No(s)</th>
                <th className="p-2.5">Accommodation Address</th>
                <th className="p-2.5">Appointment Date &amp; Time</th>
                <th className="p-2.5">Appointment Location</th>
                <th className="p-2.5">Distance (Miles)</th>
                <th className="p-2.5">Mode of Transport</th>
                <th className="p-2.5">Exceptional Circumstances</th>
                <th className="p-2.5 text-center">Status</th>
                <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[#605e5c]">
                    <Navigation className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No transport approval records found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Try adjusting your search criteria or add a new authorization.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(record => (
                  <tr key={record.id} className="hover:bg-[#f3f8fd] transition-colors">
                    <td className="p-2.5 font-mono font-medium text-[#0f766e]">
                      {record.approvalUrn}
                    </td>
                    <td className="p-2.5 font-medium text-[#242424]">
                      {record.suNames}
                    </td>
                    <td className="p-2.5 font-mono text-neutral-600">
                      {record.portRefs || '—'}
                    </td>
                    <td className="p-2.5 max-w-xs truncate text-[#605e5c]" title={record.accommodationAddress}>
                      {record.accommodationAddress}
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-[#323130]">
                        <Calendar className="w-3.5 h-3.5 text-[#605e5c]" />
                        <span>{record.appointmentDate}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#605e5c] text-[11px]">
                        <Clock className="w-3 h-3 text-neutral-400" />
                        <span>{record.appointmentTime || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-2.5 max-w-xs truncate text-[#323130]" title={record.appointmentLocation}>
                      {record.appointmentLocation}
                    </td>
                    <td className="p-2.5 font-medium text-[#242424]">
                      {record.distanceMiles ? `${record.distanceMiles} mi` : '—'}
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-medium bg-[#f3f2f1] text-[#323130] border border-[#e1dfdd]">
                        <Bus className="w-3 h-3 text-[#0d9488]" />
                        {record.modeOfTransport}
                      </span>
                    </td>
                    <td className="p-2.5 max-w-xs truncate text-[#605e5c]" title={record.exceptionalCircumstances}>
                      {record.exceptionalCircumstances || 'None specified'}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-xs text-[10px] font-bold ${
                        (record.status || 'Approved') === 'Approved' ? 'bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]' :
                        record.status === 'Pending' ? 'bg-[#fffbeb] text-[#ca8a04] border border-[#fde68a]' :
                        record.status === 'Completed' ? 'bg-[#f3f8fd] text-[#1e40af] border border-[#71afe5]' :
                        'bg-neutral-100 text-neutral-700'
                      }`}>
                        {record.status || 'Approved'}
                      </span>
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
                            title="Edit Record"
                            className="p-1 text-[#605e5c] hover:text-[#0d9488] hover:bg-[#f0fdfa] rounded-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => deletePublicTransportRecord(record.id)}
                            title="Delete Record"
                            className="p-1 text-[#605e5c] hover:text-[#a4262c] hover:bg-[#fdf3f2] rounded-xs"
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

        {/* Pagination Bar */}
        {filteredRecords.length > 0 && (
          <div className="p-3 border-t border-[#edebe9] bg-[#faf9f8]">
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

      {/* Modal: Create / Edit Approval */}
      {(isCreateModalOpen || editingRecord) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-2xl w-full max-w-2xl overflow-hidden border border-[#e1dfdd] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e1dfdd] bg-[#f3f8fd]">
              <div className="flex items-center gap-2">
                <Bus className="w-4 h-4 text-[#0d9488]" />
                <h2 className="text-sm font-semibold text-[#242424]">
                  {editingRecord ? 'Edit Public Transport Authorization' : 'New Public Transport Approval'}
                </h2>
              </div>
              <button
                onClick={() => { setIsCreateModalOpen(false); setEditingRecord(null); }}
                className="text-[#605e5c] hover:text-[#242424]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Approval URN *</label>
                  <input
                    type="text"
                    required
                    value={formData.approvalUrn}
                    onChange={e => setFormData({ ...formData, approvalUrn: e.target.value })}
                    placeholder="e.g. URN-2026-0814"
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] font-mono bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  >
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Service User Name(s) *</label>
                  <input
                    type="text"
                    required
                    value={formData.suNames}
                    onChange={e => setFormData({ ...formData, suNames: e.target.value })}
                    placeholder="e.g. Ahmad Zahir, Fatima Zahir"
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Port Ref Number(s)</label>
                  <input
                    type="text"
                    value={formData.portRefs}
                    onChange={e => setFormData({ ...formData, portRefs: e.target.value })}
                    placeholder="e.g. CR0-928411 / NASS 19/201"
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] font-mono bg-white text-[#323130]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Accommodation Address</label>
                  <input
                    type="text"
                    value={formData.accommodationAddress}
                    onChange={e => setFormData({ ...formData, accommodationAddress: e.target.value })}
                    placeholder="Current hotel site & address"
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Appointment Date</label>
                  <input
                    type="date"
                    value={formData.appointmentDate}
                    onChange={e => setFormData({ ...formData, appointmentDate: e.target.value })}
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Appointment Time</label>
                  <input
                    type="time"
                    value={formData.appointmentTime}
                    onChange={e => setFormData({ ...formData, appointmentTime: e.target.value })}
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Appointment Location</label>
                  <input
                    type="text"
                    value={formData.appointmentLocation}
                    onChange={e => setFormData({ ...formData, appointmentLocation: e.target.value })}
                    placeholder="Hospital, Home Office Reporting Centre, Embassy, etc."
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Distance (Miles)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.distanceMiles}
                    onChange={e => setFormData({ ...formData, distanceMiles: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Mode of Transport</label>
                  <select
                    value={formData.modeOfTransport}
                    onChange={e => setFormData({ ...formData, modeOfTransport: e.target.value })}
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  >
                    <option value="Bus">Bus</option>
                    <option value="Public Train / Tube">Public Train / Tube</option>
                    <option value="Taxi / Private Hire">Taxi / Private Hire</option>
                    <option value="Walking">Walking</option>
                    <option value="Coach">Coach</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Exceptional Circumstances</label>
                  <textarea
                    rows={2}
                    value={formData.exceptionalCircumstances}
                    onChange={e => setFormData({ ...formData, exceptionalCircumstances: e.target.value })}
                    placeholder="Medical grounds, vulnerability notes, escort justification, distance waiver, etc."
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e1dfdd]">
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); setEditingRecord(null); }}
                  className="px-3 py-1.5 text-xs font-semibold text-[#323130] bg-white hover:bg-[#edebe9] border border-[#8a8886] rounded-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] rounded-xs shadow-xs transition-colors"
                >
                  {editingRecord ? 'Save Changes' : 'Confirm Authorization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Details */}
      {viewDetailRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-2xl w-full max-w-lg overflow-hidden border border-[#e1dfdd] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e1dfdd] bg-[#f3f8fd]">
              <div className="flex items-center gap-2">
                <Bus className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424]">
                  Transport Approval URN: {viewDetailRecord.approvalUrn}
                </h3>
              </div>
              <button
                onClick={() => setViewDetailRecord(null)}
                className="text-[#605e5c] hover:text-[#242424]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-[#323130]">
              <div className="grid grid-cols-2 gap-3 bg-[#faf9f8] p-3 rounded-xs border border-[#edebe9]">
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Service User(s):</span>
                  <p className="font-semibold text-[#242424] mt-0.5">{viewDetailRecord.suNames}</p>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Port / NASS Ref:</span>
                  <p className="font-mono text-[#242424] mt-0.5">{viewDetailRecord.portRefs || 'N/A'}</p>
                </div>
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold text-[11px]">Accommodation Address:</span>
                <p className="font-medium text-[#242424] mt-0.5">{viewDetailRecord.accommodationAddress || '—'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Appointment Date &amp; Time:</span>
                  <p className="font-medium text-[#242424] mt-0.5">
                    {viewDetailRecord.appointmentDate} at {viewDetailRecord.appointmentTime || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Distance &amp; Mode:</span>
                  <p className="font-medium text-[#242424] mt-0.5">
                    {viewDetailRecord.distanceMiles} miles via {viewDetailRecord.modeOfTransport}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold text-[11px]">Appointment Location:</span>
                <p className="font-medium text-[#242424] mt-0.5">{viewDetailRecord.appointmentLocation}</p>
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold text-[11px]">Exceptional Circumstances:</span>
                <p className="bg-[#fffbeb] p-2.5 rounded-xs border border-[#fde68a] text-[#713f12] mt-1">
                  {viewDetailRecord.exceptionalCircumstances || 'No exceptional circumstances documented.'}
                </p>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#e1dfdd]">
                <button
                  onClick={() => setViewDetailRecord(null)}
                  className="px-3 py-1.5 bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs font-semibold text-xs transition-colors"
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
