import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  Search, 
  Download, 
  Edit3, 
  Trash2, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  X, 
  Eye, 
  Mail, 
  User, 
  Building2,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SDComplianceRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';

export const SDComplianceTrackerView: React.FC = () => {
  const {
    complianceRecords,
    addComplianceRecord,
    updateComplianceRecord,
    deleteComplianceRecord,
    allowedSites,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SDComplianceRecord | null>(null);
  const [viewDetailRecord, setViewDetailRecord] = useState<SDComplianceRecord | null>(null);

  // Form State
  const initialFormState = {
    srNo: complianceRecords.length + 1,
    complianceType: 'Fire Risk Assessment (FRA)',
    contractorName: '',
    contractorKeyContact: '',
    contractorEmail: '',
    issuedDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: 'Compliant' as 'Compliant' | 'Expiring Soon' | 'Expired' | 'In Progress' | 'Overdue',
    actionTaken: '',
    previousContractor: '',
    siteName: allowedSites[0] || 'Brit Hotel'
  };

  const [formData, setFormData] = useState(initialFormState);

  // Helper for expiry countdown
  const calculateDaysRemaining = (expiryDateStr: string) => {
    if (!expiryDateStr) return 999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDateStr);
    if (isNaN(exp.getTime())) return 999;
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const filteredRecords = useMemo(() => {
    return complianceRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.complianceType.toLowerCase().includes(q) ||
        r.contractorName.toLowerCase().includes(q) ||
        r.contractorKeyContact.toLowerCase().includes(q) ||
        r.contractorEmail.toLowerCase().includes(q) ||
        (r.previousContractor && r.previousContractor.toLowerCase().includes(q)) ||
        (r.actionTaken && r.actionTaken.toLowerCase().includes(q)) ||
        (r.siteName && r.siteName.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesType = typeFilter === 'all' || r.complianceType.toLowerCase().includes(typeFilter.toLowerCase());
      const matchesSite = siteFilter === 'all' || r.siteName === siteFilter;

      return matchesSearch && matchesStatus && matchesType && matchesSite;
    });
  }, [complianceRecords, searchQuery, statusFilter, typeFilter, siteFilter]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRecords.slice(startIndex, startIndex + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const handleOpenCreate = () => {
    setFormData({
      ...initialFormState,
      srNo: complianceRecords.length + 1
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (rec: SDComplianceRecord) => {
    setEditingRecord(rec);
    setFormData({
      srNo: rec.srNo,
      complianceType: rec.complianceType,
      contractorName: rec.contractorName,
      contractorKeyContact: rec.contractorKeyContact,
      contractorEmail: rec.contractorEmail,
      issuedDate: rec.issuedDate,
      expiryDate: rec.expiryDate,
      status: rec.status,
      actionTaken: rec.actionTaken,
      previousContractor: rec.previousContractor,
      siteName: rec.siteName || allowedSites[0] || 'Brit Hotel'
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.complianceType.trim() || !formData.contractorName.trim()) return;

    if (editingRecord) {
      updateComplianceRecord(editingRecord.id, formData);
      setEditingRecord(null);
    } else {
      addComplianceRecord(formData);
      setIsCreateModalOpen(false);
    }
  };

  const handleExportCsv = () => {
    exportTableToCsv({
      filename: 'SD_Compliance_Tracker.csv',
      headers: [
        'S NO.',
        'COMPLIANCE TYPE',
        'CONTRACTOR NAME',
        'CONTRACTOR KEY CONTACT',
        'CONTRACTOR E-MAIL ID',
        'ISSUED DATE',
        'EXPIRY DATE',
        'STATUS',
        'Action Taken',
        'Previous Contractor',
        'Site'
      ],
      rows: filteredRecords.map(r => [
        r.srNo,
        r.complianceType,
        r.contractorName,
        r.contractorKeyContact,
        r.contractorEmail,
        r.issuedDate,
        r.expiryDate,
        r.status,
        r.actionTaken,
        r.previousContractor,
        r.siteName || 'All'
      ])
    });
  };


  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0d9488]" />
            <h1 className="text-2xl font-semibold text-[#242424] tracking-tight">
              SD-Compliance Tracker
            </h1>
            <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#99f6e4]">
              {complianceRecords.length} Certificates Tracked
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Statutory building safety certificates, contractor governance, FRA, CP12 Gas, Legionella, and EICR inspection logs.
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
              <span>+ New Compliance Asset</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Site Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c]">Property:</span>
            <select
              value={siteFilter}
              onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#71afe5]"
            >
              <option value="all">All Properties</option>
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
              <option value="Compliant">Compliant</option>
              <option value="Expiring Soon">Expiring Soon</option>
              <option value="Expired">Expired</option>
              <option value="In Progress">In Progress</option>
              <option value="Overdue">Overdue</option>
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
            placeholder="Search Compliance Type, Contractor, Email..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-8 pr-3 py-1.5 border border-[#8a8886] rounded-xs text-[#323130] text-xs bg-white focus:outline-2 focus:outline-[#71afe5]"
          />
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[520px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1500px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th className="p-2.5 w-12 text-center">S NO.</th>
                <th className="p-2.5">COMPLIANCE TYPE</th>
                <th className="p-2.5">CONTRACTOR'S NAME</th>
                <th className="p-2.5">CONTRACTOR KEY CONTACT</th>
                <th className="p-2.5">CONTRACTOR E-MAIL ID</th>
                <th className="p-2.5">SITE</th>
                <th className="p-2.5">ISSUED DATE</th>
                <th className="p-2.5">EXPIRY DATE</th>
                <th className="p-2.5 text-center">STATUS</th>
                <th className="p-2.5">Action Taken</th>
                <th className="p-2.5">Previous Contractor</th>
                <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-[#605e5c]">
                    <ShieldCheck className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No compliance records found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Try adjusting your filters or register a new asset.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record, index) => {
                  const daysRemaining = calculateDaysRemaining(record.expiryDate);
                  const isExpiring = daysRemaining <= 30 && daysRemaining >= 0;
                  const isOverdue = daysRemaining < 0;

                  return (
                    <tr key={record.id} className="hover:bg-[#f3f8fd] transition-colors">
                      <td className="p-2.5 text-center font-mono text-[#605e5c]">
                        {record.srNo || index + 1}
                      </td>
                      <td className="p-2.5 font-semibold text-[#242424]">
                        {record.complianceType}
                      </td>
                      <td className="p-2.5 font-medium text-[#242424]">
                        {record.contractorName}
                      </td>
                      <td className="p-2.5 text-[#605e5c]">
                        {record.contractorKeyContact || '—'}
                      </td>
                      <td className="p-2.5 font-mono text-[#0f766e]">
                        {record.contractorEmail ? (
                          <a href={`mailto:${record.contractorEmail}`} className="hover:underline">
                            {record.contractorEmail}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="p-2.5 text-[#605e5c]">
                        {record.siteName || 'All'}
                      </td>
                      <td className="p-2.5 font-mono text-[#605e5c]">
                        {record.issuedDate}
                      </td>
                      <td className="p-2.5 font-mono">
                        <div className={`font-semibold ${
                          isOverdue ? 'text-[#a4262c]' : isExpiring ? 'text-[#ca8a04]' : 'text-[#242424]'
                        }`}>
                          {record.expiryDate}
                        </div>
                        {isOverdue ? (
                          <span className="text-[10px] text-[#a4262c] font-semibold inline-flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> Expired ({Math.abs(daysRemaining)}d ago)
                          </span>
                        ) : isExpiring ? (
                          <span className="text-[10px] text-[#ca8a04] font-semibold inline-flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> {daysRemaining} days left
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#059669]">Valid ({daysRemaining}d)</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-xs text-[10px] font-bold ${
                          record.status === 'Compliant' ? 'bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]' :
                          record.status === 'Expiring Soon' ? 'bg-[#fffbeb] text-[#ca8a04] border border-[#fde68a]' :
                          record.status === 'Expired' || record.status === 'Overdue' ? 'bg-[#fdf3f2] text-[#a4262c] border border-[#f5b8b5]' :
                          'bg-[#f3f8fd] text-[#1e40af] border border-[#71afe5]'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="p-2.5 max-w-xs truncate text-[#605e5c]" title={record.actionTaken}>
                        {record.actionTaken || '—'}
                      </td>
                      <td className="p-2.5 text-[#605e5c]">
                        {record.previousContractor || '—'}
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
                              title="Edit Compliance"
                              className="p-1 text-[#605e5c] hover:text-[#0d9488] hover:bg-[#f0fdfa] rounded-xs"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDeleteRecord() && (
                            <button
                              onClick={() => deleteComplianceRecord(record.id)}
                              title="Delete Record"
                              className="p-1 text-[#605e5c] hover:text-[#a4262c] hover:bg-[#fdf3f2] rounded-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {/* Modal: Create / Edit Compliance Asset */}
      {(isCreateModalOpen || editingRecord) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs shadow-2xl w-full max-w-2xl overflow-hidden border border-[#e1dfdd] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e1dfdd] bg-[#f3f8fd]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0d9488]" />
                <h2 className="text-sm font-semibold text-[#242424]">
                  {editingRecord ? 'Edit Compliance Asset' : 'Add New Compliance Asset'}
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
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Compliance Type *</label>
                  <input
                    type="text"
                    required
                    value={formData.complianceType}
                    onChange={e => setFormData({ ...formData, complianceType: e.target.value })}
                    placeholder="e.g. Fire Risk Assessment (FRA)"
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Property / Hotel Site</label>
                  <select
                    value={formData.siteName}
                    onChange={e => setFormData({ ...formData, siteName: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:border-teal-600 bg-white"
                  >
                    {allowedSites.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Contractor's Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.contractorName}
                    onChange={e => setFormData({ ...formData, contractorName: e.target.value })}
                    placeholder="e.g. Shield Fire Safety Ltd"
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Contractor Key Contact</label>
                  <input
                    type="text"
                    value={formData.contractorKeyContact}
                    onChange={e => setFormData({ ...formData, contractorKeyContact: e.target.value })}
                    placeholder="e.g. Marcus Vance"
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Contractor E-Mail ID</label>
                  <input
                    type="email"
                    value={formData.contractorEmail}
                    onChange={e => setFormData({ ...formData, contractorEmail: e.target.value })}
                    placeholder="e.g. contact@shieldfiresafety.co.uk"
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:border-teal-600 bg-white"
                  >
                    <option value="Compliant">Compliant</option>
                    <option value="Expiring Soon">Expiring Soon</option>
                    <option value="Expired">Expired</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Issued Date</label>
                  <input
                    type="date"
                    value={formData.issuedDate}
                    onChange={e => setFormData({ ...formData, issuedDate: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Previous Contractor</label>
                  <input
                    type="text"
                    value={formData.previousContractor}
                    onChange={e => setFormData({ ...formData, previousContractor: e.target.value })}
                    placeholder="Name of prior inspection agency or vendor"
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Action Taken</label>
                  <textarea
                    rows={2}
                    value={formData.actionTaken}
                    onChange={e => setFormData({ ...formData, actionTaken: e.target.value })}
                    placeholder="Inspection findings, remediation steps, parts replaced, certificate storage reference"
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:border-teal-600"
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
                  {editingRecord ? 'Update Certificate' : 'Save Compliance Record'}
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
                <ShieldCheck className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424]">
                  Compliance Item #{viewDetailRecord.srNo}: {viewDetailRecord.complianceType}
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
                  <span className="text-[#605e5c] font-semibold text-[11px]">Contractor:</span>
                  <p className="font-semibold text-[#242424] mt-0.5">{viewDetailRecord.contractorName}</p>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Key Contact:</span>
                  <p className="font-medium text-[#242424] mt-0.5">{viewDetailRecord.contractorKeyContact || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Email Address:</span>
                  <p className="font-mono text-[#0f766e] mt-0.5">{viewDetailRecord.contractorEmail || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Hotel Property:</span>
                  <p className="font-medium text-[#242424] mt-0.5">{viewDetailRecord.siteName || 'All Sites'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Issued Date:</span>
                  <p className="font-mono text-[#242424] mt-0.5">{viewDetailRecord.issuedDate}</p>
                </div>
                <div>
                  <span className="text-[#605e5c] font-semibold text-[11px]">Expiry Date:</span>
                  <p className="font-mono font-bold text-[#242424] mt-0.5">{viewDetailRecord.expiryDate}</p>
                </div>
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold text-[11px]">Previous Contractor:</span>
                <p className="font-medium text-[#242424] mt-0.5">{viewDetailRecord.previousContractor || 'None recorded'}</p>
              </div>

              <div>
                <span className="text-[#605e5c] font-semibold text-[11px]">Action Taken / Remediation Notes:</span>
                <p className="bg-[#faf9f8] p-2.5 rounded-xs border border-[#edebe9] text-[#242424] mt-1">
                  {viewDetailRecord.actionTaken || 'No action required; certificate active.'}
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
