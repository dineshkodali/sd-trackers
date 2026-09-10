import React, { useState, useMemo } from 'react';
import { 
  Stethoscope, 
  Plus, 
  Search, 
  Download, 
  Edit3, 
  Trash2, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  X, 
  Eye, 
  Building2,
  FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GPAppointmentRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';

export const GPAppointmentsView: React.FC = () => {
  const {
    gpAppointmentRecords,
    addGPAppointmentRecord,
    updateGPAppointmentRecord,
    deleteGPAppointmentRecord,
    allowedSites,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GPAppointmentRecord | null>(null);
  const [viewDetailRecord, setViewDetailRecord] = useState<GPAppointmentRecord | null>(null);

  // Form State
  const initialFormState = {
    roomNo: '',
    portReference: '',
    referralSentOn: new Date().toISOString().slice(0, 10),
    appointmentDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    timeOfGp: '10:00',
    comments: '',
    status: 'Scheduled' as 'Scheduled' | 'Attended' | 'Did Not Attend (DNA)' | 'Cancelled' | 'Rescheduled',
    siteName: allowedSites[0] || 'Brit Hotel',
    suName: ''
  };

  const [formData, setFormData] = useState(initialFormState);

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

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRecords.slice(startIndex, startIndex + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const handleOpenCreate = () => {
    setFormData(initialFormState);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (rec: GPAppointmentRecord) => {
    setEditingRecord(rec);
    setFormData({
      roomNo: rec.roomNo,
      portReference: rec.portReference,
      referralSentOn: rec.referralSentOn,
      appointmentDate: rec.appointmentDate,
      timeOfGp: rec.timeOfGp,
      comments: rec.comments,
      status: rec.status,
      siteName: rec.siteName || allowedSites[0] || 'Brit Hotel',
      suName: rec.suName || ''
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.roomNo.trim() || !formData.portReference.trim()) return;

    if (editingRecord) {
      updateGPAppointmentRecord(editingRecord.id, formData);
      setEditingRecord(null);
    } else {
      addGPAppointmentRecord(formData);
      setIsCreateModalOpen(false);
    }
  };

  const handleExportCsv = () => {
    exportTableToCsv({
      filename: 'GP_Appointments_Register.csv',
      headers: [
        'Room No',
        'Port Reference',
        'Service User Name',
        'Hotel Site',
        'Referral Sent On',
        'Appointment Date',
        'Time of GP',
        'Comments',
        'Status'
      ],
      rows: filteredRecords.map(r => [
        r.roomNo,
        r.portReference,
        r.suName || '',
        r.siteName || '',
        r.referralSentOn,
        r.appointmentDate,
        r.timeOfGp,
        r.comments,
        r.status
      ])
    });
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
                <th className="p-2.5">Room No</th>
                <th className="p-2.5">Port Reference</th>
                <th className="p-2.5">Resident Name</th>
                <th className="p-2.5">Site / Hotel</th>
                <th className="p-2.5">Referral sent on</th>
                <th className="p-2.5">Appointment date</th>
                <th className="p-2.5">Time of GP</th>
                <th className="p-2.5 text-center">Status</th>
                <th className="p-2.5">Comments</th>
                <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#605e5c]">
                    <Stethoscope className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No GP appointments recorded</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Click 'Book GP Appointment' to schedule a consultation.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(record => (
                  <tr key={record.id} className="hover:bg-[#f3f8fd] transition-colors">
                    <td className="p-2.5 font-semibold text-[#242424]">
                      {record.roomNo}
                    </td>
                    <td className="p-2.5 font-mono text-[#0f766e]">
                      {record.portReference}
                    </td>
                    <td className="p-2.5 font-medium text-[#242424]">
                      {record.suName || '—'}
                    </td>
                    <td className="p-2.5 text-[#605e5c]">
                      {record.siteName || 'Brit Hotel'}
                    </td>
                    <td className="p-2.5 font-mono text-[#605e5c]">
                      {record.referralSentOn || '—'}
                    </td>
                    <td className="p-2.5 font-medium text-[#242424]">
                      {record.appointmentDate}
                    </td>
                    <td className="p-2.5 font-mono text-[#605e5c]">
                      {record.timeOfGp}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-xs text-[10px] font-bold ${
                        record.status === 'Attended' ? 'bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]' :
                        record.status === 'Scheduled' ? 'bg-[#f3f8fd] text-[#0078d4] border border-[#71afe5]' :
                        record.status === 'Did Not Attend (DNA)' ? 'bg-[#fffbeb] text-[#ca8a04] border border-[#fde68a]' :
                        record.status === 'Cancelled' ? 'bg-[#fdf3f2] text-[#a4262c] border border-[#f5b8b5]' :
                        'bg-neutral-100 text-neutral-700'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="p-2.5 max-w-xs truncate text-[#605e5c]" title={record.comments}>
                      {record.comments || '—'}
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
                            onClick={() => deleteGPAppointmentRecord(record.id)}
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

      {/* Modal: Book / Edit Appointment */}
      {(isCreateModalOpen || editingRecord) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-2xl w-full max-w-lg overflow-hidden border border-[#e1dfdd] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e1dfdd] bg-[#f3f8fd]">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-[#0d9488]" />
                <h2 className="text-sm font-semibold text-[#242424]">
                  {editingRecord ? 'Edit GP Appointment' : 'Book GP Appointment'}
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
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Room No *</label>
                  <input
                    type="text"
                    required
                    value={formData.roomNo}
                    onChange={e => setFormData({ ...formData, roomNo: e.target.value })}
                    placeholder="e.g. 104"
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Port Reference *</label>
                  <input
                    type="text"
                    required
                    value={formData.portReference}
                    onChange={e => setFormData({ ...formData, portReference: e.target.value })}
                    placeholder="e.g. CR0-918234"
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] font-mono bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Service User Name</label>
                  <input
                    type="text"
                    value={formData.suName}
                    onChange={e => setFormData({ ...formData, suName: e.target.value })}
                    placeholder="Full name"
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Site / Hotel</label>
                  <select
                    value={formData.siteName}
                    onChange={e => setFormData({ ...formData, siteName: e.target.value })}
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  >
                    {allowedSites.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Referral Sent On</label>
                  <input
                    type="date"
                    value={formData.referralSentOn}
                    onChange={e => setFormData({ ...formData, referralSentOn: e.target.value })}
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Attended">Attended</option>
                    <option value="Did Not Attend (DNA)">Did Not Attend (DNA)</option>
                    <option value="Rescheduled">Rescheduled</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
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
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Time of GP</label>
                  <input
                    type="time"
                    value={formData.timeOfGp}
                    onChange={e => setFormData({ ...formData, timeOfGp: e.target.value })}
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Comments &amp; Clinical Notes</label>
                  <textarea
                    rows={3}
                    value={formData.comments}
                    onChange={e => setFormData({ ...formData, comments: e.target.value })}
                    placeholder="Medical history, symptoms, prescription refills, interpreter requirement, transportation arrangements..."
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
                  {editingRecord ? 'Save Changes' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Details */}
      {viewDetailRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-2xl w-full max-w-md overflow-hidden border border-[#e1dfdd] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e1dfdd] bg-[#f3f8fd]">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424]">
                  Room {viewDetailRecord.roomNo} - GP Appointment
                </h3>
              </div>
              <button
                onClick={() => setViewDetailRecord(null)}
                className="text-[#605e5c] hover:text-[#242424]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-[#323130]">
              <div className="grid grid-cols-2 gap-3 bg-[#faf9f8] p-3 rounded-xs border border-[#edebe9]">
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Port Ref:</span>
                  <p className="font-mono font-semibold text-[#0f766e] mt-0.5">{viewDetailRecord.portReference}</p>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Resident:</span>
                  <p className="font-semibold text-[#242424] mt-0.5">{viewDetailRecord.suName || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Referral Sent:</span>
                  <p className="font-mono text-[#605e5c] mt-0.5">{viewDetailRecord.referralSentOn || '—'}</p>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Status:</span>
                  <p className="font-semibold text-[#242424] mt-0.5">{viewDetailRecord.status}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Appointment Date:</span>
                  <p className="font-medium text-[#242424] mt-0.5">{viewDetailRecord.appointmentDate}</p>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Time Slot:</span>
                  <p className="font-mono font-medium text-[#242424] mt-0.5">{viewDetailRecord.timeOfGp}</p>
                </div>
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold text-[11px]">Comments &amp; Follow-up:</span>
                <p className="bg-[#faf9f8] p-2.5 rounded-xs border border-[#edebe9] text-[#242424] mt-1">
                  {viewDetailRecord.comments || 'No clinical comments documented.'}
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
