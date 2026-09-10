import React, { useState, useMemo } from 'react';
import { 
  HeartHandshake, 
  Plus, 
  Search, 
  Download, 
  Edit3, 
  Trash2, 
  Calendar, 
  User, 
  Building2, 
  AlertTriangle, 
  X, 
  Eye, 
  Ticket, 
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RFAWelfareCheckRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';

export const RFAWelfareChecksView: React.FC = () => {
  const {
    rfaWelfareRecords,
    addRFAWelfareRecord,
    updateRFAWelfareRecord,
    deleteRFAWelfareRecord,
    allowedSites,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RFAWelfareCheckRecord | null>(null);
  const [viewDetailRecord, setViewDetailRecord] = useState<RFAWelfareCheckRecord | null>(null);

  // Form State
  const initialFormState = {
    date: new Date().toISOString().slice(0, 10),
    siteName: allowedSites[0] || 'Brit Hotel',
    roomOrFlatNo: '',
    name: '',
    dob: '1995-01-01',
    group: 'Single Adult',
    gender: 'Male',
    portOrNassRef: '',
    vulnerability: '',
    actionTaken: '',
    mhTicket: `MH-${Math.floor(10000 + Math.random() * 90000)}`
  };

  const [formData, setFormData] = useState(initialFormState);

  const filteredRecords = useMemo(() => {
    return rfaWelfareRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.name.toLowerCase().includes(q) ||
        r.roomOrFlatNo.toLowerCase().includes(q) ||
        r.portOrNassRef.toLowerCase().includes(q) ||
        r.vulnerability.toLowerCase().includes(q) ||
        r.actionTaken.toLowerCase().includes(q) ||
        r.mhTicket.toLowerCase().includes(q) ||
        r.siteName.toLowerCase().includes(q);

      const matchesSite = siteFilter === 'all' || r.siteName === siteFilter;
      const matchesGroup = groupFilter === 'all' || r.group === groupFilter;

      return matchesSearch && matchesSite && matchesGroup;
    });
  }, [rfaWelfareRecords, searchQuery, siteFilter, groupFilter]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRecords.slice(startIndex, startIndex + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const handleOpenCreate = () => {
    setFormData({
      ...initialFormState,
      mhTicket: `MH-${Math.floor(10000 + Math.random() * 90000)}`
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (rec: RFAWelfareCheckRecord) => {
    setEditingRecord(rec);
    setFormData({
      date: rec.date,
      siteName: rec.siteName,
      roomOrFlatNo: rec.roomOrFlatNo,
      name: rec.name,
      dob: rec.dob,
      group: rec.group,
      gender: rec.gender,
      portOrNassRef: rec.portOrNassRef,
      vulnerability: rec.vulnerability,
      actionTaken: rec.actionTaken,
      mhTicket: rec.mhTicket
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.roomOrFlatNo.trim()) return;

    if (editingRecord) {
      updateRFAWelfareRecord(editingRecord.id, formData);
      setEditingRecord(null);
    } else {
      addRFAWelfareRecord(formData);
      setIsCreateModalOpen(false);
    }
  };

  const handleExportCsv = () => {
    exportTableToCsv({
      filename: 'RFA_Welfare_Checks.csv',
      headers: [
        'Date',
        'Site Name',
        'Room or Flat No',
        'Name',
        'DOB',
        'Group',
        'Gender',
        'Port or Nass Ref',
        'Vulnerability',
        'Action Taken',
        'MH ticket'
      ],
      rows: filteredRecords.map(r => [
        r.date,
        r.siteName,
        r.roomOrFlatNo,
        r.name,
        r.dob,
        r.group,
        r.gender,
        r.portOrNassRef,
        r.vulnerability,
        r.actionTaken,
        r.mhTicket
      ])
    });
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#0d9488]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">
              RFA Welfare Checks
            </h1>
            <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#99f6e4]">
              {filteredRecords.length} Completed Checks
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Regular Face-to-Face &amp; Vulnerability welfare visits, mental health tickets, room visits &amp; resident safeguarding interventions.
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
              <span>+ New Welfare Check</span>
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

          {/* Group Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Demographic:</span>
            <select
              value={groupFilter}
              onChange={e => { setGroupFilter(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Demographics</option>
              <option value="Single Adult">Single Adult</option>
              <option value="Family">Family</option>
              <option value="Pregnant Woman">Pregnant Woman</option>
              <option value="Elderly">Elderly</option>
              <option value="Young Adult (18-21)">Young Adult (18-21)</option>
            </select>
          </div>

          {/* Reset button */}
          {(siteFilter !== 'all' || groupFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSiteFilter('all');
                setGroupFilter('all');
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
            placeholder="Search Resident Name, Room, NASS, MH Ticket..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-8 pr-3 py-1.5 border border-[#8a8886] rounded-xs text-[#323130] text-xs bg-white focus:outline-2 focus:outline-[#71afe5]"
          />
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Site Name</th>
                <th className="p-2.5">Room or Flat No</th>
                <th className="p-2.5">Name</th>
                <th className="p-2.5">DOB</th>
                <th className="p-2.5">Group</th>
                <th className="p-2.5">Gender</th>
                <th className="p-2.5">Port or Nass Ref</th>
                <th className="p-2.5">MH ticket</th>
                <th className="p-2.5">Vulnerability</th>
                <th className="p-2.5">Action Taken</th>
                <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-[#605e5c]">
                    <UserCheck className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No welfare checks found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Adjust filter settings or record a new face-to-face visit.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(record => (
                  <tr key={record.id} className="hover:bg-[#f3f8fd] transition-colors">
                    <td className="p-2.5 font-mono text-[#605e5c]">
                      {record.date}
                    </td>
                    <td className="p-2.5 font-medium text-[#242424]">
                      {record.siteName}
                    </td>
                    <td className="p-2.5 font-semibold text-[#242424]">
                      {record.roomOrFlatNo}
                    </td>
                    <td className="p-2.5 font-semibold text-[#242424]">
                      {record.name}
                    </td>
                    <td className="p-2.5 font-mono text-[#605e5c]">
                      {record.dob}
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-xs text-[10px] font-bold ${
                        record.group === 'Pregnant Woman' || record.group === 'Family' ? 'bg-[#fffbeb] text-[#ca8a04] border border-[#fde68a]' :
                        record.group === 'Elderly' ? 'bg-[#faf5ff] text-[#6b21a8] border border-[#e9d5ff]' :
                        'bg-[#f3f2f1] text-[#323130] border border-[#e1dfdd]'
                      }`}>
                        {record.group}
                      </span>
                    </td>
                    <td className="p-2.5 text-[#605e5c]">
                      {record.gender}
                    </td>
                    <td className="p-2.5 font-mono text-[#0f766e]">
                      {record.portOrNassRef || '—'}
                    </td>
                    <td className="p-2.5 whitespace-nowrap font-mono">
                      {record.mhTicket ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#a4262c] bg-[#fdf3f2] px-2 py-0.5 rounded-xs border border-[#f5b8b5]">
                          <Ticket className="w-3 h-3 text-[#a4262c]" />
                          {record.mhTicket}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="p-2.5 max-w-xs truncate text-[#605e5c]" title={record.vulnerability}>
                      {record.vulnerability || '—'}
                    </td>
                    <td className="p-2.5 max-w-xs truncate text-[#605e5c]" title={record.actionTaken}>
                      {record.actionTaken || '—'}
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
                            title="Edit Check"
                            className="p-1 text-[#605e5c] hover:text-[#0d9488] hover:bg-[#f0fdfa] rounded-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            onClick={() => deleteRFAWelfareRecord(record.id)}
                            title="Delete Check"
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

      {/* Modal: Create / Edit Welfare Check */}
      {(isCreateModalOpen || editingRecord) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-2xl w-full max-w-2xl overflow-hidden border border-[#e1dfdd] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e1dfdd] bg-[#f3f8fd]">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#0d9488]" />
                <h2 className="text-sm font-semibold text-[#242424]">
                  {editingRecord ? 'Edit RFA Welfare Check' : 'Log RFA Welfare Check'}
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
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Check Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Hotel / Site Name *</label>
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
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Room or Flat No *</label>
                  <input
                    type="text"
                    required
                    value={formData.roomOrFlatNo}
                    onChange={e => setFormData({ ...formData, roomOrFlatNo: e.target.value })}
                    placeholder="e.g. 214"
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Resident Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={e => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Demographic Group</label>
                  <select
                    value={formData.group}
                    onChange={e => setFormData({ ...formData, group: e.target.value })}
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  >
                    <option value="Single Adult">Single Adult</option>
                    <option value="Family">Family</option>
                    <option value="Pregnant Woman">Pregnant Woman</option>
                    <option value="Elderly">Elderly</option>
                    <option value="Young Adult (18-21)">Young Adult (18-21)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Port or NASS Ref</label>
                  <input
                    type="text"
                    value={formData.portOrNassRef}
                    onChange={e => setFormData({ ...formData, portOrNassRef: e.target.value })}
                    placeholder="e.g. CR0-291823"
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] font-mono bg-white text-[#323130]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Mental Health Ticket No (Optional)</label>
                  <input
                    type="text"
                    value={formData.mhTicket}
                    onChange={e => setFormData({ ...formData, mhTicket: e.target.value })}
                    placeholder="e.g. MH-49214"
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] font-mono bg-white text-[#323130]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Vulnerability Description</label>
                  <textarea
                    rows={2}
                    value={formData.vulnerability}
                    onChange={e => setFormData({ ...formData, vulnerability: e.target.value })}
                    placeholder="Medical condition, mobility limitations, anxiety/PTSD symptoms, safeguarding flags"
                    className="w-full text-xs p-2 border border-[#8a8886] rounded-xs focus:outline-2 focus:outline-[#71afe5] bg-white text-[#323130]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#605e5c] mb-1">Action Taken &amp; Interventions</label>
                  <textarea
                    rows={2}
                    value={formData.actionTaken}
                    onChange={e => setFormData({ ...formData, actionTaken: e.target.value })}
                    placeholder="Interventions, welfare checks conducted, escalated to GP/Social Care, room visit outcome"
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
                  {editingRecord ? 'Save Changes' : 'Log Welfare Visit'}
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
                <UserCheck className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424]">
                  RFA Welfare Check: {viewDetailRecord.name}
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
                  <span className="text-[#605e5c] font-semibold text-[11px]">Hotel Site &amp; Room:</span>
                  <p className="font-semibold text-[#242424] mt-0.5">
                    {viewDetailRecord.siteName} — Room {viewDetailRecord.roomOrFlatNo}
                  </p>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Port / NASS Ref:</span>
                  <p className="font-mono font-semibold text-[#0f766e] mt-0.5">{viewDetailRecord.portOrNassRef || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Date of Check:</span>
                  <p className="font-mono text-[#242424] mt-0.5">{viewDetailRecord.date}</p>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">DOB:</span>
                  <p className="font-mono text-[#242424] mt-0.5">{viewDetailRecord.dob || '—'}</p>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Demographic:</span>
                  <p className="text-[#242424] mt-0.5 font-medium">{viewDetailRecord.group}</p>
                </div>
              </div>

              {viewDetailRecord.mhTicket && (
                <div className="p-2.5 bg-[#fdf3f2] border border-[#f5b8b5] rounded-xs">
                  <span className="text-[10px] font-bold text-[#a4262c] uppercase tracking-wider">Mental Health Escalation Ticket:</span>
                  <p className="font-mono font-bold text-[#a4262c] text-sm mt-0.5">{viewDetailRecord.mhTicket}</p>
                </div>
              )}

              <div>
                <span className="text-[#605e5c] font-semibold text-[11px]">Vulnerability Details:</span>
                <p className="bg-[#faf9f8] p-2.5 rounded-xs border border-[#edebe9] text-[#242424] mt-1">
                  {viewDetailRecord.vulnerability || 'None specified'}
                </p>
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold text-[11px]">Action Taken &amp; Interventions:</span>
                <p className="bg-[#f0fdfa] p-2.5 rounded-xs border border-[#99f6e4] text-[#0f766e] mt-1">
                  {viewDetailRecord.actionTaken || 'Welfare check completed without further intervention required.'}
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
