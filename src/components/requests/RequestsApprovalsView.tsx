import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Plus, 
  ShieldCheck, 
  FileText, 
  AlertCircle, 
  Filter, 
  Search, 
  Check, 
  X,
  MessageSquareQuote,
  Building2,
  User,
  Shield,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DataChangeRequest } from '../../types';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';

const requestsExportColumns: ExportColumnOption[] = [
  { id: 'id', label: 'Request ID' },
  { id: 'site', label: 'Hotel / Site' },
  { id: 'module', label: 'Tracker Module' },
  { id: 'recordTitle', label: 'Record Subject / Title' },
  { id: 'requestType', label: 'Request Type' },
  { id: 'requestedBy', label: 'Submitted By' },
  { id: 'requestedByRole', label: 'Submitter Role' },
  { id: 'status', label: 'Status' },
  { id: 'reason', label: 'Reason / Justification' },
  { id: 'reviewedBy', label: 'Reviewed By' },
  { id: 'reviewNotes', label: 'Review Remarks' },
  { id: 'createdAt', label: 'Submission Date' }
];

export const RequestsApprovalsView: React.FC = () => {
  const {
    dataChangeRequests,
    addDataChangeRequest,
    reviewDataChangeRequest,
    currentUserRole,
    currentUserName,
    assignedSite,
    allowedSites,
    sites,
    authProfile,
    canAccessAllSites
  } = useApp();

  const userAssignedHotel = React.useMemo(() => {
    if (assignedSite && assignedSite !== 'All Sites' && assignedSite !== 'all') {
      return assignedSite;
    }
    if (authProfile?.assignedSite && authProfile.assignedSite !== 'All Sites' && authProfile.assignedSite !== 'all') {
      return authProfile.assignedSite;
    }
    const pAny = authProfile as any;
    if (pAny?.assigned_site && pAny.assigned_site !== 'All Sites' && pAny.assigned_site !== 'all') {
      return pAny.assigned_site;
    }
    if (pAny?.hotel && pAny.hotel !== 'All Sites' && pAny.hotel !== 'all') {
      return pAny.hotel;
    }
    if (allowedSites && allowedSites.length > 0 && allowedSites[0] !== 'All Sites' && allowedSites[0] !== 'all') {
      return allowedSites[0];
    }
    const firstReal = sites?.find(s => {
      const name = typeof s === 'string' ? s : s?.name;
      return name && name !== 'All Sites' && name !== 'all';
    });
    if (firstReal) {
      return typeof firstReal === 'string' ? firstReal : firstReal.name;
    }
    return '';
  }, [assignedSite, authProfile, allowedSites, sites]);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const initialForm = {
    site: !canAccessAllSites() 
      ? userAssignedHotel 
      : (userAssignedHotel || allowedSites[0] || ''),
    module: 'Referrals' as DataChangeRequest['module'],
    recordTitle: '',
    recordId: '',
    requestType: 'Edit Correction' as DataChangeRequest['requestType'],
    reason: '',
    proposedChanges: ''
  };

  const [formData, setFormData] = useState(initialForm);

  React.useEffect(() => {
    if (isNewModalOpen) {
      if (!canAccessAllSites()) {
        setFormData(prev => ({ ...prev, site: userAssignedHotel }));
      }
    }
  }, [isNewModalOpen, canAccessAllSites, userAssignedHotel]);

  const [reviewModalRequest, setReviewModalRequest] = useState<DataChangeRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDecision, setReviewDecision] = useState<'Approved' | 'Rejected'>('Approved');

  const canReview = currentUserRole === 'Super Admin' || currentUserRole === 'Admin' || currentUserRole === 'Regional Manager';

  const filteredRequests = useMemo(() => {
    return dataChangeRequests.filter(req => {
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;
      if (moduleFilter !== 'all' && req.module !== moduleFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const str = `${req.recordTitle || ''} ${req.requestedBy || ''} ${req.reason || ''} ${req.site || ''} ${req.id || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [dataChangeRequests, statusFilter, moduleFilter, searchQuery]);

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.recordTitle || !formData.reason) return;

    const effectiveSite = !canAccessAllSites()
      ? userAssignedHotel
      : (formData.site || userAssignedHotel || allowedSites[0] || '');

    addDataChangeRequest({
      requestedBy: currentUserName,
      requestedByRole: currentUserRole,
      site: effectiveSite,
      module: formData.module,
      recordId: formData.recordId || `REC-${Math.floor(Math.random() * 90000 + 10000)}`,
      recordTitle: formData.recordTitle,
      requestType: formData.requestType,
      reason: formData.reason,
      proposedChanges: formData.proposedChanges || formData.reason
    });

    setFormData(initialForm);
    setIsNewModalOpen(false);
  };

  const handleExecuteReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalRequest) return;
    reviewDataChangeRequest(reviewModalRequest.id, reviewDecision, reviewNotes);
    setReviewModalRequest(null);
    setReviewNotes('');
  };

  const pendingCount = dataChangeRequests.filter(r => r.status === 'Pending').length;

  // Export Handlers with Custom Download & PDF/CSV Options
  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    let sourceData = dataChangeRequests;
    if (scope === 'filtered') sourceData = filteredRequests;
    else if (scope === 'custom' && startDate && endDate) {
      sourceData = dataChangeRequests.filter(r => {
        const d = r.createdAt ? r.createdAt.slice(0, 10) : '';
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      });
    }
    return sourceData;
  };

  const calculateDateRangeCount = (startDate: string, endDate: string): number => {
    return dataChangeRequests.filter(r => {
      const d = r.createdAt ? r.createdAt.slice(0, 10) : '';
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
      ? requestsExportColumns.filter(c => selectedColumns.includes(c.id))
      : requestsExportColumns;
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
      ? requestsExportColumns.filter(c => selectedColumns.includes(c.id))
      : requestsExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));

    if (format === 'csv') {
      exportTableToCsv({ filename: 'Change_Requests_Workflow.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'Change_Requests_Workflow.pdf',
        title: 'Data Change Requests & Administrative Approvals Log',
        headers,
        rows,
        orientation
      });
    }
  };

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in">
      {/* UNIFIED CONTAINER */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#edebe9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xs bg-[#f0fdfa] border border-[#5eead4] flex items-center justify-center text-[#0d9488]">
              <MessageSquareQuote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424]">Requests &amp; Approvals Workflow</h1>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px] border border-amber-300">
                    {pendingCount} Pending Review
                  </span>
                )}
              </div>
              <p className="text-xs text-[#605e5c]">
                Submit data entry corrections, deletion requests, or record changes for Regional Manager and Admin review.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ExportDropdown
              moduleName="Change Requests"
              totalRecordCount={dataChangeRequests.length}
              filteredRecordCount={filteredRequests.length}
              defaultOrientation="landscape"
              dateRangeRecordCount={calculateDateRangeCount}
              availableColumns={requestsExportColumns}
              getPreviewData={getExportPreviewData}
              onExport={handlePerformExport}
              buttonVariant="toolbar"
            />

            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-3.5 py-2 bg-[#0d9488] text-white hover:bg-[#0f766e] text-xs font-semibold rounded-xs shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Raise Change Request</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#faf9f8] p-3.5 border border-[#edebe9] rounded-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#323130]">
              <Filter className="w-3.5 h-3.5 text-[#0d9488]" />
              <span>Filter By:</span>
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="p-1.5 text-xs border border-[#8a8886] rounded-xs bg-white text-[#323130]"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>

            <select
              value={moduleFilter}
              onChange={e => setModuleFilter(e.target.value)}
              className="p-1.5 text-xs border border-[#8a8886] rounded-xs bg-white text-[#323130]"
            >
              <option value="all">All Modules</option>
              <option value="Referrals">Referrals</option>
              <option value="Vulnerable SUs">Vulnerable SUs</option>
              <option value="Challenging SUs">Challenging SUs</option>
              <option value="Maintenance">Maintenance</option>
              <option value="SPCD">SPCD</option>
              <option value="Hot Food">Hot Food</option>
              <option value="Laundry">Laundry</option>
              <option value="Escalations">Escalations</option>
            </select>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#8a8886]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search request title, reason, submitter..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#8a8886] rounded-xs bg-white text-[#323130]"
            />
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-[#605e5c] border border-dashed border-[#edebe9] rounded-xs">
              <FileText className="w-8 h-8 mx-auto text-[#8a8886] mb-2 opacity-50" />
              <p className="text-sm font-semibold text-[#323130]">No data change requests found</p>
              <p className="text-xs text-[#8a8886] mt-1">Submit a request if you need an admin to correct or update a record.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#edebe9] border border-[#edebe9] rounded-xs bg-white">
              {filteredRequests.map(req => {
                const isPending = req.status === 'Pending';
                const isApproved = req.status === 'Approved';
                return (
                  <div key={req.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#faf9f8]/60 transition-colors">
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isPending ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          isApproved ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          'bg-red-100 text-red-800 border border-red-300'
                        }`}>
                          {req.status}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#f0fdfa] text-[#0f766e] border border-[#5eead4]">
                          {req.module}
                        </span>
                        <span className="text-[11px] font-bold text-[#242424]">{req.requestType}</span>
                        <span className="text-[11px] text-[#8a8886]">ID: {req.id}</span>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-[#242424]">{req.recordTitle}</h3>
                        <p className="text-xs text-[#605e5c] mt-0.5"><strong>Reason / Correction Note:</strong> {req.reason}</p>
                        {req.proposedChanges && (
                          <p className="text-xs text-[#0d9488] mt-0.5"><strong>Proposed Changes:</strong> {req.proposedChanges}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-[#8a8886] pt-1">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {req.requestedBy} ({req.requestedByRole})</span>
                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {req.site}</span>
                        <span>{new Date(req.createdAt).toLocaleString()}</span>
                      </div>

                      {req.reviewNotes && (
                        <div className="mt-2 p-2 bg-[#faf9f8] border border-[#edebe9] rounded-xs text-[11px] text-[#323130]">
                          <span className="font-semibold text-[#0f766e]">{req.reviewedBy} ({req.reviewedAt ? new Date(req.reviewedAt).toLocaleString() : ''}):</span> {req.reviewNotes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isPending && canReview && (
                        <button
                          onClick={() => {
                            setReviewModalRequest(req);
                            setReviewDecision('Approved');
                            setReviewNotes('');
                          }}
                          className="px-3.5 py-1.5 bg-[#0d9488] text-white hover:bg-[#0f766e] text-xs font-semibold rounded-xs shadow-xs transition-colors"
                        >
                          Review &amp; Decide
                        </button>
                      )}
                      {!isPending && (
                        <div className="text-right text-xs text-[#8a8886]">
                          <div>Reviewed by {req.reviewedBy}</div>
                          <div className="text-[10px]">{req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString() : ''}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* NEW REQUEST MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xl max-w-lg w-full p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#edebe9]">
              <div className="flex items-center gap-2">
                <MessageSquareQuote className="w-5 h-5 text-[#0d9488]" />
                <h3 className="font-bold text-sm text-[#242424]">Raise Data Change or Correction Request</h3>
              </div>
              <button onClick={() => setIsNewModalOpen(false)} className="text-[#8a8886] hover:text-[#323130]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNew} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Target Module *</label>
                  <select
                    value={formData.module}
                    onChange={e => setFormData({ ...formData, module: e.target.value as DataChangeRequest['module'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white"
                  >
                    <option value="Referrals">Referrals</option>
                    <option value="Vulnerable SUs">Vulnerable SUs</option>
                    <option value="Challenging SUs">Challenging SUs</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="SPCD">SPCD</option>
                    <option value="Hot Food">Hot Food</option>
                    <option value="Laundry">Laundry</option>
                    <option value="Escalations">Escalations</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Request Type *</label>
                  <select
                    value={formData.requestType}
                    onChange={e => setFormData({ ...formData, requestType: e.target.value as DataChangeRequest['requestType'] })}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white"
                  >
                    <option value="Edit Correction">Edit Correction</option>
                    <option value="Deletion Request">Deletion Request</option>
                    <option value="New Record Approval">New Record Approval</option>
                    <option value="General Correction">General Correction</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Record Title / Resident Name *</label>
                <input
                  type="text"
                  required
                  value={formData.recordTitle}
                  onChange={e => setFormData({ ...formData, recordTitle: e.target.value })}
                  placeholder="e.g., Ahmad Al-Mansoor (Room 214)"
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Record ID / Ref (Optional)</label>
                  <input
                    type="text"
                    value={formData.recordId}
                    onChange={e => setFormData({ ...formData, recordId: e.target.value })}
                    placeholder="e.g., ref-1 or PORT-8839"
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#323130] mb-1 flex items-center justify-between">
                    <span>Property / Site *</span>
                    {!canAccessAllSites() && (
                      <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1 py-0.2 rounded font-medium flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5 text-teal-600" /> Locked
                      </span>
                    )}
                  </label>
                  {!canAccessAllSites() ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={userAssignedHotel}
                        readOnly
                        disabled
                        className="w-full p-2 pr-7 border border-teal-200 rounded-xs bg-teal-50/50 text-teal-950 font-medium cursor-not-allowed text-xs"
                      />
                      <Lock className="w-3.5 h-3.5 text-teal-600 absolute right-2 top-1/2 -translate-y-1/2" />
                    </div>
                  ) : (
                    <select
                      value={formData.site}
                      onChange={e => setFormData({ ...formData, site: e.target.value })}
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white"
                    >
                      {allowedSites.map((s, idx) => (
                        <option key={`${s}-${idx}`} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Reason for Mistake / Change Required *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Describe why this correction or change is necessary..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white"
                ></textarea>
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Freeform Update &amp; Proposed Details (Text Format)</label>
                <textarea
                  rows={3}
                  value={formData.proposedChanges}
                  onChange={e => setFormData({ ...formData, proposedChanges: e.target.value })}
                  placeholder="Provide full text details or custom explanation if certain fields are not visible..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#edebe9]">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 border border-[#8a8886] text-[#323130] hover:bg-[#f3f2f1] font-semibold rounded-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0d9488] text-white hover:bg-[#0f766e] font-semibold rounded-xs shadow-xs"
                >
                  Submit Request to RMs &amp; Admins
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW DECISION MODAL */}
      {reviewModalRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xl max-w-md w-full p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#edebe9]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0d9488]" />
                <h3 className="font-bold text-sm text-[#242424]">Review Change Request</h3>
              </div>
              <button onClick={() => setReviewModalRequest(null)} className="text-[#8a8886] hover:text-[#323130]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#faf9f8] border border-[#edebe9] rounded-xs space-y-1">
                <div><strong>Record:</strong> {reviewModalRequest.recordTitle}</div>
                <div><strong>Module:</strong> {reviewModalRequest.module} ({reviewModalRequest.requestType})</div>
                <div><strong>Submitted By:</strong> {reviewModalRequest.requestedBy} ({reviewModalRequest.requestedByRole}) at {reviewModalRequest.site}</div>
                <div><strong>Reason:</strong> {reviewModalRequest.reason}</div>
                {reviewModalRequest.proposedChanges && (
                  <div><strong>Proposed:</strong> {reviewModalRequest.proposedChanges}</div>
                )}
              </div>

              <form onSubmit={handleExecuteReview} className="space-y-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Decision *</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 font-semibold text-emerald-700 cursor-pointer">
                      <input
                        type="radio"
                        name="decision"
                        checked={reviewDecision === 'Approved'}
                        onChange={() => setReviewDecision('Approved')}
                      />
                      Approve Request
                    </label>
                    <label className="flex items-center gap-1.5 font-semibold text-red-700 cursor-pointer">
                      <input
                        type="radio"
                        name="decision"
                        checked={reviewDecision === 'Rejected'}
                        onChange={() => setReviewDecision('Rejected')}
                      />
                      Reject Request
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Review Notes / Instructions *</label>
                  <textarea
                    required
                    rows={3}
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    placeholder="Provide notes on approval or reason for rejection..."
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white"
                  ></textarea>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#edebe9]">
                  <button
                    type="button"
                    onClick={() => setReviewModalRequest(null)}
                    className="px-4 py-2 border border-[#8a8886] text-[#323130] hover:bg-[#f3f2f1] font-semibold rounded-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 text-white font-semibold rounded-xs shadow-xs ${
                      reviewDecision === 'Approved' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    Confirm {reviewDecision}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
