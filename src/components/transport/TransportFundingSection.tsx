import React, { useState, useMemo, useCallback } from 'react';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Building2, 
  User, 
  Calendar, 
  FileText, 
  CheckSquare, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  ShieldCheck, 
  Lock, 
  DollarSign, 
  FileCheck2,
  Paperclip,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { 
  TransportFundingRequestRecord, 
  FundingRequestStatus, 
  RecordAttachment 
} from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { AttachmentsSection } from '../common/AttachmentsSection';

export const EXCEPTIONAL_CIRCUMSTANCE_OPTIONS = [
  'Serious medical condition or chronic illness',
  'Disability/accessibility requirement',
  'Emergency requirement',
  'No suitable public transport available',
  'Other approved exceptional circumstance'
];

export const FUNDING_STATUSES: FundingRequestStatus[] = [
  'Draft',
  'Submitted',
  'Under Review',
  'Clarification Required',
  'Approved',
  'Rejected',
  'Completed'
];

const fundingExportColumns: ExportColumnOption[] = [
  { id: 'mainAppRef', label: 'Main App Ref' },
  { id: 'mainAppInitials', label: 'Initials' },
  { id: 'siteName', label: 'Site / Hotel' },
  { id: 'siteManager', label: 'Site Manager' },
  { id: 'staffPlace', label: 'Staff Place' },
  { id: 'reportingPerson', label: 'Reporting Staff' },
  { id: 'groupMember', label: 'SU Name' },
  { id: 'appointmentDate', label: 'Appointment Date' },
  { id: 'appointmentTime', label: 'Appointment Time' },
  { id: 'appointmentNature', label: 'Appointment Nature' },
  { id: 'transportMethod', label: 'Transport Method' },
  { id: 'totalCost', label: 'Total Cost (£)' },
  { id: 'status', label: 'Status' },
  { id: 'journeyUrn', label: 'Journey URN' },
  { id: 'approvedBy', label: 'Approved By' }
];

export const TransportFundingSection: React.FC = () => {
  const {
    transportFundingRequests,
    addTransportFundingRequest,
    updateTransportFundingRequest,
    deleteTransportFundingRequest,
    canAccessAllSites,
    allowedSites,
    assignedSite,
    currentUserName,
    currentUserRole,
    canEditRecord,
    canDeleteRecord,
    authProfile,
    sites,
    properties
  } = useApp();

  const isManagementOrHo = ['Super Admin', 'Admin', 'Regional Manager'].includes(currentUserRole);

  const loggedInUserName = authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || 'Duty Officer';
  const userStaffPlace = authProfile?.assignedSite || assignedSite || 'All Sites';

  const resolveSiteManager = useCallback((siteIdentifier?: string) => {
    if (!siteIdentifier) return 'Site Manager';
    const matchedSite = sites.find(s => s.name === siteIdentifier || s.id === siteIdentifier);
    if (matchedSite?.leadOfficer) return matchedSite.leadOfficer;
    const matchedProp = properties.find((p: any) => (p.propertyName || p.name) === siteIdentifier || p.id === siteIdentifier) as any;
    if (matchedProp?.leadOfficer) return matchedProp.leadOfficer;
    if (matchedProp?.propertyManager) return matchedProp.propertyManager;
    return 'Site Manager';
  }, [sites, properties]);

  const defaultSite = useMemo(() => {
    if (!canAccessAllSites() && assignedSite) return assignedSite;
    if (allowedSites.length > 0) return allowedSites[0];
    if (sites.length > 0) return sites[0].name;
    return '';
  }, [canAccessAllSites, assignedSite, allowedSites, sites]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState<string>(!canAccessAllSites() ? (assignedSite || 'all') : 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [exceptionalFilter, setExceptionalFilter] = useState<string>('all');

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<keyof TransportFundingRequestRecord>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [viewingItem, setViewingItem] = useState<TransportFundingRequestRecord | null>(null);
  const [reviewModalItem, setReviewModalItem] = useState<TransportFundingRequestRecord | null>(null);

  // Initial Form Data for 6-step form
  const emptyFormData: Partial<TransportFundingRequestRecord> = useMemo(() => ({
    siteName: defaultSite,
    siteManager: resolveSiteManager(defaultSite),
    staffPlace: userStaffPlace,
    reportingPerson: loggedInUserName,
    reportingPersonId: authProfile?.id,
    mainAppRef: '',
    mainAppInitials: '',
    groupMember: '',
    phone: '',
    additionalTravellersCount: 0,
    additionalTravellersReason: '',
    childrenAges: '',
    requestDatetime: new Date().toISOString(),
    appointmentDate: '',
    appointmentTime: '10:00',
    accommodationName: defaultSite,
    accommodationAddress: '',
    accommodationPostcode: '',
    appointmentAddress: '',
    appointmentPostcode: '',
    appointmentNature: '',
    distanceMiles: '',
    totalCost: '',
    transportMethod: 'Public Transport',
    hasAspen: 'Yes',
    ticketsRequired: 1,
    exceptionalCriteria: '',
    exceptionalDetails: '',
    status: 'Submitted',
    attachments: []
  }), [defaultSite, resolveSiteManager, userStaffPlace, loggedInUserName, authProfile?.id]);

  const [formData, setFormData] = useState<Partial<TransportFundingRequestRecord>>(emptyFormData);

  // HO / Review Drawer Form
  const [reviewData, setReviewData] = useState<{
    status: FundingRequestStatus;
    decision: string;
    rejectionReason: string;
    approvedTransportMethod: string;
    paymentAmount: number | string;
    journeyUrn: string;
    hoInitials: string;
    internalComments: string;
  }>({
    status: 'Approved',
    decision: 'Approved',
    rejectionReason: '',
    approvedTransportMethod: 'Public Transport Travelcard',
    paymentAmount: '',
    journeyUrn: '',
    hoInitials: 'HO-REV',
    internalComments: ''
  });

  // Site Scoped
  const siteScopedRecords = useMemo(() => {
    return transportFundingRequests.filter(r => {
      if (!canAccessAllSites()) {
        const allowed = new Set(allowedSites.map(s => s.toLowerCase().trim()));
        if (assignedSite) allowed.add(assignedSite.toLowerCase().trim());
        return allowed.has((r.siteName || '').toLowerCase().trim());
      }
      return true;
    });
  }, [transportFundingRequests, canAccessAllSites, allowedSites, assignedSite]);

  // Filtered
  const filteredRecords = useMemo(() => {
    return siteScopedRecords.filter(r => {
      if (selectedSite !== 'all' && (r.siteName || '').toLowerCase().trim() !== selectedSite.toLowerCase().trim()) {
        return false;
      }
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }
      if (methodFilter !== 'all' && !(r.transportMethod || '').toLowerCase().includes(methodFilter.toLowerCase())) {
        return false;
      }
      if (exceptionalFilter !== 'all' && r.exceptionalCriteria !== exceptionalFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches = 
          (r.mainAppRef || '').toLowerCase().includes(q) ||
          (r.mainAppInitials || '').toLowerCase().includes(q) ||
          (r.journeyUrn || '').toLowerCase().includes(q) ||
          (r.groupMember || '').toLowerCase().includes(q) ||
          (r.siteName || '').toLowerCase().includes(q) ||
          (r.appointmentNature || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [siteScopedRecords, selectedSite, statusFilter, methodFilter, exceptionalFilter, searchQuery]);

  // Sorted
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let valA: any = a[sortKey] ?? '';
      let valB: any = b[sortKey] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRecords, sortKey, sortOrder]);

  // Paginated
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  // Status counts for top summary cards
  const counts = useMemo(() => {
    const total = siteScopedRecords.length;
    const draft = siteScopedRecords.filter(r => r.status === 'Draft').length;
    const submitted = siteScopedRecords.filter(r => r.status === 'Submitted').length;
    const underReview = siteScopedRecords.filter(r => r.status === 'Under Review').length;
    const clarification = siteScopedRecords.filter(r => r.status === 'Clarification Required').length;
    const approved = siteScopedRecords.filter(r => r.status === 'Approved').length;
    const rejected = siteScopedRecords.filter(r => r.status === 'Rejected').length;
    const completed = siteScopedRecords.filter(r => r.status === 'Completed').length;
    return { total, draft, submitted, underReview, clarification, approved, rejected, completed };
  }, [siteScopedRecords]);

  // Submit Wizard
  const handleWizardSubmit = (statusToSave: FundingRequestStatus = 'Submitted') => {
    if (!formData.mainAppRef || !formData.mainAppInitials || !formData.appointmentDate) {
      alert('Please provide the Main App Reference, Initials, and Appointment Date.');
      return;
    }
    if (formData.exceptionalCriteria && !formData.exceptionalDetails) {
      alert('Supporting details are required when an exceptional circumstance is selected.');
      return;
    }

    const targetSite = formData.siteName || defaultSite;
    addTransportFundingRequest({
      ...formData,
      siteName: targetSite,
      siteManager: resolveSiteManager(targetSite),
      staffPlace: userStaffPlace,
      reportingPerson: loggedInUserName,
      reportingPersonId: authProfile?.id,
      status: statusToSave
    } as any);

    setIsWizardOpen(false);
    setWizardStep(1);
    setFormData(emptyFormData);
  };

  // Submit Management Review
  const handleSaveReview = () => {
    if (!reviewModalItem) return;
    updateTransportFundingRequest(reviewModalItem.id, {
      status: reviewData.status,
      decision: reviewData.decision,
      rejectionReason: reviewData.rejectionReason,
      approvedTransportMethod: reviewData.approvedTransportMethod,
      paymentAmount: reviewData.paymentAmount,
      journeyUrn: reviewData.journeyUrn || (reviewData.status === 'Approved' ? `URN-${Date.now().toString().slice(-6)}` : ''),
      hoInitials: reviewData.hoInitials,
      internalComments: reviewData.internalComments,
      approvedBy: currentUserName || 'HO Reviewer',
      approvalDate: new Date().toISOString()
    });
    setReviewModalItem(null);
  };

  // Export handlers
  const handleExport = ({
    format,
    scope,
    orientation = 'landscape',
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
    const rawData = scope === 'all' ? sortedRecords : paginatedData;
    const activeCols = selectedColumns && selectedColumns.length > 0 
      ? fundingExportColumns.filter(c => selectedColumns.includes(c.id))
      : fundingExportColumns;
    const headers = activeCols.map(c => c.label);
    const rows = rawData.map(item => {
      const dataItem = {
        ...item,
        totalCost: item.totalCost ? `£${item.totalCost}` : '—'
      };
      return activeCols.map(c => String((dataItem as any)[c.id] ?? ''));
    });

    if (format === 'csv') {
      exportTableToCsv({ filename: 'Transport_Funding_Requests.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'Transport_Funding_Requests.pdf',
        title: 'Transport Funding Requests',
        headers,
        rows,
        orientation
      });
    }
  };

  const statusBadgeStyle: Record<string, string> = {
    Draft: 'bg-[#f3f2f1] text-[#605e5c] border-[#e1dfdd]',
    Submitted: 'bg-blue-50 text-[#0078d4] border-blue-200',
    'Under Review': 'bg-purple-50 text-[#8764b8] border-purple-200',
    'Clarification Required': 'bg-[#fff8f0] text-[#d83b01] border-[#fed9cc]',
    Approved: 'bg-[#f1faf0] text-[#107c41] border-[#c4e8c1]',
    Rejected: 'bg-[#fde7e9] text-[#a4262c] border-[#f3b2b7]',
    Completed: 'bg-[#e6f7f6] text-[#0d9488] border-[#a5eae6]'
  };

  return (
    <div className="space-y-4">
      {/* Top Status Filter Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { label: 'All Requests', key: 'all', count: counts.total, color: 'text-[#242424]' },
          { label: 'Draft', key: 'Draft', count: counts.draft, color: 'text-[#605e5c]' },
          { label: 'Submitted', key: 'Submitted', count: counts.submitted, color: 'text-[#0078d4]' },
          { label: 'Under Review', key: 'Under Review', count: counts.underReview, color: 'text-[#8764b8]' },
          { label: 'Clarification', key: 'Clarification Required', count: counts.clarification, color: 'text-[#d83b01]' },
          { label: 'Approved', key: 'Approved', count: counts.approved, color: 'text-[#107c41]' },
          { label: 'Rejected', key: 'Rejected', count: counts.rejected, color: 'text-[#a4262c]' },
          { label: 'Completed', key: 'Completed', count: counts.completed, color: 'text-[#0d9488]' }
        ].map((item) => {
          const isActive = statusFilter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => { setStatusFilter(item.key); setCurrentPage(1); }}
              className={`p-2.5 rounded-xs border text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-purple-50/70 border-[#8764b8] shadow-2xs ring-1 ring-[#8764b8]'
                  : 'bg-white border-[#e5e5e5] hover:border-[#8764b8]/50 shadow-2xs'
              }`}
            >
              <div className="text-[11px] font-semibold text-[#605e5c] truncate">{item.label}</div>
              <div className={`text-base font-bold mt-0.5 ${isActive ? 'text-[#8764b8]' : item.color}`}>
                {item.count}
              </div>
            </button>
          );
        })}
      </div>

      {/* Header, Actions & Filters Card */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#242424]">Transport Funding Requests</h2>
            <p className="text-xs text-neutral-500">6-stage digital travelcard & exceptional transport grant approval process.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ExportDropdown
              moduleName="Transport Funding Requests"
              totalRecordCount={transportFundingRequests.length}
              filteredRecordCount={filteredRecords.length}
              availableColumns={fundingExportColumns}
              onExport={handleExport}
              buttonVariant="toolbar"
            />

            <button
              type="button"
              onClick={() => {
                const chosenSite = !canAccessAllSites() ? (assignedSite || defaultSite) : (selectedSite !== 'all' ? selectedSite : defaultSite);
                setFormData({
                  ...emptyFormData,
                  siteName: chosenSite,
                  siteManager: resolveSiteManager(chosenSite),
                  staffPlace: userStaffPlace,
                  reportingPerson: loggedInUserName,
                  reportingPersonId: authProfile?.id,
                  accommodationName: chosenSite
                });
                setWizardStep(1);
                setIsWizardOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#8764b8] hover:bg-[#744da9] text-white rounded-xs shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New Funding Request</span>
            </button>
          </div>
        </div>

        {/* Integrated Filter Row */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text"
              placeholder="Search by Ref, Initials, URN, SU name..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] placeholder-neutral-400 focus:bg-white focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden transition-all"
            />
          </div>

          <select
            value={selectedSite}
            onChange={(e) => { setSelectedSite(e.target.value); setCurrentPage(1); }}
            disabled={!canAccessAllSites()}
            className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden transition-all disabled:opacity-60"
          >
            {canAccessAllSites() && <option value="all">All Sites / Hotels</option>}
            {allowedSites.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={exceptionalFilter}
            onChange={(e) => { setExceptionalFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden transition-all"
          >
            <option value="all">All Exceptional Criteria</option>
            {EXCEPTIONAL_CIRCUMSTANCE_OPTIONS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={methodFilter}
            onChange={(e) => { setMethodFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden transition-all"
          >
            <option value="all">All Transport Methods</option>
            <option value="Public Transport">Public Transport</option>
            <option value="Taxi Exception">Taxi Exception</option>
            <option value="Emergency OOH">Emergency OOH</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden flex flex-col justify-between">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#faf9f8] text-[#323130] font-semibold border-b border-[#e1dfdd] text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Ref & Initials</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Site / Hotel</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">SU / Group Member</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Appointment Date</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Appointment Nature</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Method & Cost</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Status</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">URN / Decision</th>
                <th className="py-2.5 px-3 text-right border-b border-[#e5e5e5]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f2f1] text-[#323130]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-neutral-400">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#8764b8]" />
                    No transport funding requests found.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => {
                  const badgeClass = statusBadgeStyle[item.status] || 'bg-[#f3f2f1] text-[#605e5c] border-[#e1dfdd]';

                  return (
                    <tr 
                      key={item.id}
                      className="hover:bg-[#f8f9fa] transition-colors"
                    >
                      <td className="py-2.5 px-3 font-semibold text-[#242424]">
                        <span className="block font-mono text-[#0078d4]">{item.mainAppRef}</span>
                        <span className="text-neutral-500 text-[11px]">Initials: {item.mainAppInitials}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{item.siteName}</span>
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">
                          Mgr: <span className="text-[#242424] font-medium">{item.siteManager || resolveSiteManager(item.siteName)}</span>
                        </div>
                        <div className="text-[10px] text-teal-700 font-medium">
                          Staff: {item.reportingPerson || '—'} ({item.staffPlace || '—'})
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#242424]">
                          {item.groupMember || item.mainAppInitials}
                        </div>
                        {Number(item.additionalTravellersCount) > 0 && (
                          <span className="text-neutral-500 text-[10px]">
                            +{item.additionalTravellersCount} companions
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-medium text-[#242424]">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{item.appointmentDate}</span>
                        </div>
                        <span className="text-neutral-500 text-[11px] block">{item.appointmentTime}</span>
                      </td>
                      <td className="py-2.5 px-3 max-w-[180px]">
                        <span className="font-medium block truncate text-[#242424]">
                          {item.appointmentNature}
                        </span>
                        {item.exceptionalCriteria && (
                          <span className="text-[10px] text-[#d83b01] font-medium block truncate">
                            Ex: {item.exceptionalCriteria}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-[#242424]">
                          £{item.totalCost || '0.00'}
                        </div>
                        <span className="text-neutral-500 text-[11px] block">{item.transportMethod}</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[10px] font-semibold border ${badgeClass}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.journeyUrn ? (
                          <span className="font-mono text-[#107c41] font-semibold block text-[11px]">
                            {item.journeyUrn}
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-[11px]">Pending URN</span>
                        )}
                        {item.decision && isManagementOrHo && (
                          <span className="text-[10px] text-neutral-500 block">
                            Decision: {item.decision}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingItem(item)}
                            className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded cursor-pointer"
                            title="View Full Application"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {/* HO / Management Review Action */}
                          {isManagementOrHo && (
                            <button
                              type="button"
                              onClick={() => {
                                setReviewModalItem(item);
                                setReviewData({
                                  status: item.status,
                                  decision: item.decision || (item.status === 'Approved' ? 'Approved' : 'Approved'),
                                  rejectionReason: item.rejectionReason || '',
                                  approvedTransportMethod: item.approvedTransportMethod || item.transportMethod || 'Public Transport',
                                  paymentAmount: item.paymentAmount || item.totalCost || '',
                                  journeyUrn: item.journeyUrn || '',
                                  hoInitials: item.hoInitials || 'HO-REV',
                                  internalComments: item.internalComments || ''
                                });
                              }}
                              className="p-1 hover:bg-[#edebe9] text-[#8764b8] rounded cursor-pointer"
                              title="Review / Authorize (HO Action)"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDeleteRecord() && (
                            <button
                              type="button"
                              onClick={() => deleteTransportFundingRequest(item.id)}
                              className="p-1 hover:bg-red-50 text-[#a4262c] rounded cursor-pointer"
                              title="Delete Request"
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

        {/* Pagination Bar */}
        <div className="p-3 border-t border-[#edebe9] shrink-0">
          <Pagination
            currentPage={currentPage}
            totalItems={sortedRecords.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* MULTI-STEP DIGITAL FUNDING FORM (6 STEPS) */}
      {isWizardOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-6 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-[#f3f2f1] border-b border-[#e1dfdd] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#242424] flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#8764b8]" />
                  Digital Transport Funding Request Form
                </h3>
                <span className="text-xs text-neutral-500">6-stage travelcard & exceptional transport request workflow</span>
              </div>
              <button
                type="button"
                onClick={() => setIsWizardOpen(false)}
                className="text-[#605e5c] hover:text-[#242424] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="px-4 py-2.5 bg-[#faf9f8] border-b border-[#edebe9] overflow-x-auto">
              <div className="flex items-center justify-between min-w-[500px] text-xs">
                {[
                  { step: 1, label: 'Applicant' },
                  { step: 2, label: 'Appointment' },
                  { step: 3, label: 'Journey' },
                  { step: 4, label: 'Exceptional' },
                  { step: 5, label: 'Evidence' },
                  { step: 6, label: 'Review' }
                ].map((s) => (
                  <div key={s.step} className="flex items-center gap-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                      wizardStep === s.step
                        ? 'bg-[#8764b8] text-white'
                        : wizardStep > s.step
                        ? 'bg-[#107c41] text-white'
                        : 'bg-[#e1dfdd] text-[#605e5c]'
                    }`}>
                      {s.step}
                    </span>
                    <span className={`font-semibold ${wizardStep === s.step ? 'text-[#8764b8]' : wizardStep > s.step ? 'text-[#107c41]' : 'text-[#605e5c]'}`}>
                      {s.label}
                    </span>
                    {s.step < 6 && <ChevronRight className="w-3.5 h-3.5 text-neutral-400 mx-1" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Step Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3.5 text-xs">
              {/* STEP 1: Applicant / SU Details */}
              {wizardStep === 1 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-[#242424]">
                    Step 1: Applicant & Service User Details
                  </h4>

                  {/* Site and Locked Staff Context */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-2.5 bg-neutral-50 border border-neutral-200 rounded-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-[#605e5c] block mb-1">
                        Site / Hotel *
                      </label>
                      <select
                        value={formData.siteName || defaultSite}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(p => ({
                            ...p,
                            siteName: val,
                            siteManager: resolveSiteManager(val),
                            accommodationName: val
                          }));
                        }}
                        disabled={!canAccessAllSites() && !!assignedSite}
                        className="w-full p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs font-semibold focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden disabled:bg-neutral-100 disabled:cursor-not-allowed"
                      >
                        {allowedSites.map(site => (
                          <option key={site} value={site}>{site}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-[11px] font-semibold text-[#605e5c]">
                          Site Manager
                        </label>
                        <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 bg-neutral-200 text-neutral-700 rounded-xs font-mono">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      </div>
                      <input
                        type="text"
                        value={formData.siteManager || resolveSiteManager(formData.siteName || defaultSite)}
                        readOnly
                        disabled
                        className="w-full p-1.5 border border-[#e1dfdd] rounded-xs bg-[#f3f2f1] text-[#605e5c] font-medium text-xs cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-[11px] font-semibold text-[#605e5c]">
                          Staff Place
                        </label>
                        <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 bg-neutral-200 text-neutral-700 rounded-xs font-mono">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      </div>
                      <input
                        type="text"
                        value={userStaffPlace}
                        readOnly
                        disabled
                        className="w-full p-1.5 border border-[#e1dfdd] rounded-xs bg-[#f3f2f1] text-[#605e5c] font-medium text-xs cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-[11px] font-semibold text-[#605e5c]">
                          Reporting Staff Member
                        </label>
                        <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 bg-teal-100 text-teal-800 rounded-xs font-mono">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      </div>
                      <input
                        type="text"
                        value={loggedInUserName}
                        readOnly
                        disabled
                        className="w-full p-1.5 border border-[#e1dfdd] rounded-xs bg-[#f3f2f1] text-[#605e5c] font-semibold text-xs cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Main App Reference Number *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. APP-90214 / CR0-84812"
                        value={formData.mainAppRef || ''}
                        onChange={(e) => setFormData(p => ({ ...p, mainAppRef: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-mono text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Main App Initials *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. A.Z."
                        value={formData.mainAppInitials || ''}
                        onChange={(e) => setFormData(p => ({ ...p, mainAppInitials: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-semibold text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Member of Group with Appointment
                      </label>
                      <input
                        type="text"
                        placeholder="Full name of service user traveling"
                        value={formData.groupMember || ''}
                        onChange={(e) => setFormData(p => ({ ...p, groupMember: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Telephone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+44 7..."
                        value={formData.phone || ''}
                        onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Number of Others Needing to Travel
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.additionalTravellersCount ?? 0}
                        onChange={(e) => setFormData(p => ({ ...p, additionalTravellersCount: parseInt(e.target.value) || 0 }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Age of Children Travelling
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 2, 4 (leave blank if none)"
                        value={formData.childrenAges || ''}
                        onChange={(e) => setFormData(p => ({ ...p, childrenAges: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Reason for Additional Travellers
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Spouse required as translator / Dependent minors with no alternative care..."
                      value={formData.additionalTravellersReason || ''}
                      onChange={(e) => setFormData(p => ({ ...p, additionalTravellersReason: e.target.value }))}
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Appointment Details */}
              {wizardStep === 2 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-[#242424]">
                    Step 2: Appointment & Location Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Date of Appointment *
                      </label>
                      <input
                        type="date"
                        value={formData.appointmentDate || ''}
                        onChange={(e) => setFormData(p => ({ ...p, appointmentDate: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Time of Appointment
                      </label>
                      <input
                        type="time"
                        value={formData.appointmentTime || ''}
                        onChange={(e) => setFormData(p => ({ ...p, appointmentTime: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Nature of Appointment *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Substantive Asylum Interview, Specialist Hospital Appointment..."
                        value={formData.appointmentNature || ''}
                        onChange={(e) => setFormData(p => ({ ...p, appointmentNature: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Current Accommodation Name / Hotel
                      </label>
                      <input
                        type="text"
                        value={formData.accommodationName || ''}
                        onChange={(e) => setFormData(p => ({ ...p, accommodationName: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Current Accommodation Postcode
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. N12 0QA"
                        value={formData.accommodationPostcode || ''}
                        onChange={(e) => setFormData(p => ({ ...p, accommodationPostcode: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] uppercase text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Current Accommodation Address
                      </label>
                      <input
                        type="text"
                        value={formData.accommodationAddress || ''}
                        onChange={(e) => setFormData(p => ({ ...p, accommodationAddress: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Appointment Postcode
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CR9 2BY"
                        value={formData.appointmentPostcode || ''}
                        onChange={(e) => setFormData(p => ({ ...p, appointmentPostcode: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] uppercase text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Appointment Address
                      </label>
                      <input
                        type="text"
                        placeholder="Hospital / Centre full address"
                        value={formData.appointmentAddress || ''}
                        onChange={(e) => setFormData(p => ({ ...p, appointmentAddress: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Journey Details */}
              {wizardStep === 3 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-[#242424]">
                    Step 3: Journey Logistics & Cost Calculation
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Distance of Journey – Round Trip (Miles)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 15.5"
                        value={formData.distanceMiles || ''}
                        onChange={(e) => setFormData(p => ({ ...p, distanceMiles: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Total Estimated Cost of Journey (£) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 18.50"
                        value={formData.totalCost || ''}
                        onChange={(e) => setFormData(p => ({ ...p, totalCost: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-bold text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Transport Method *
                      </label>
                      <select
                        value={formData.transportMethod}
                        onChange={(e) => setFormData(p => ({ ...p, transportMethod: e.target.value }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs font-medium focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      >
                        <option value="Public Transport (Train/Tube)">Public Transport (Train / Tube)</option>
                        <option value="Public Transport (Bus)">Public Transport (Bus)</option>
                        <option value="Taxi Exception (Medical)">Taxi Exception (Medical)</option>
                        <option value="Taxi Exception (Mobility / Accessibility)">Taxi Exception (Mobility / Accessibility)</option>
                        <option value="Emergency OOH Transport">Emergency OOH Transport</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Does SU have a working Aspen Card?
                      </label>
                      <select
                        value={formData.hasAspen === 'Yes' || formData.hasAspen === true ? 'Yes' : 'No'}
                        onChange={(e) => setFormData(p => ({ ...p, hasAspen: e.target.value as 'Yes' | 'No' }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs font-semibold focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No (Aspen Pending / Blocked)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-[#605e5c] block mb-1">
                        Number of Tickets Required
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.ticketsRequired ?? 1}
                        onChange={(e) => setFormData(p => ({ ...p, ticketsRequired: parseInt(e.target.value) || 1 }))}
                        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Exceptional Circumstances */}
              {wizardStep === 4 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-[#242424]">
                    Step 4: Exceptional Circumstances Criteria
                  </h4>
                  <div className="p-3 bg-[#fff8f0] rounded-xs border border-[#fed9cc] text-[#8a3707] text-xs">
                    Public transport is the default for all Home Office funded travel. Exceptional funding requires justification against pre-defined qualifying criteria.
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Qualifying Criteria Category
                    </label>
                    <select
                      value={formData.exceptionalCriteria || ''}
                      onChange={(e) => setFormData(p => ({ ...p, exceptionalCriteria: e.target.value }))}
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs font-medium focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                    >
                      <option value="">None (Standard Public Transport Application)</option>
                      {EXCEPTIONAL_CIRCUMSTANCE_OPTIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {formData.exceptionalCriteria && (
                    <div>
                      <label className="font-semibold text-[#a4262c] block mb-1">
                        Additional Details Supporting Exceptional Circumstances *
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Detailed medical note, specialist recommendation, or physical disability specifics requiring exceptional consideration..."
                        value={formData.exceptionalDetails || ''}
                        onChange={(e) => setFormData(p => ({ ...p, exceptionalDetails: e.target.value }))}
                        className="w-full p-2 border border-[#f3b2b7] bg-white rounded-xs text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5: Evidence Upload */}
              {wizardStep === 5 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-[#242424]">
                    Step 5: Supporting Evidence & Document Upload
                  </h4>
                  <p className="text-neutral-500 text-xs">
                    Please upload supporting documentation such as hospital letter, appointment invitation, or provider booking confirmation.
                  </p>
                  <AttachmentsSection
                    attachments={formData.attachments || []}
                    onChange={(attachments) => setFormData(p => ({ ...p, attachments }))}
                    title="Upload Appointment Letters & Proof"
                    entityName="FundingRequest"
                  />
                </div>
              )}

              {/* STEP 6: Review & Submit */}
              {wizardStep === 6 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-[#242424]">
                    Step 6: Review Application Dossier
                  </h4>
                  <div className="p-3 bg-[#faf9f8] rounded-xs border border-[#e1dfdd] space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Main App Ref</span>
                        <span className="font-bold text-[#0078d4] font-mono text-xs">{formData.mainAppRef}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Initials</span>
                        <span className="font-bold text-[#242424]">{formData.mainAppInitials}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Appointment Date</span>
                        <span className="font-semibold text-[#242424]">{formData.appointmentDate} at {formData.appointmentTime}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Estimated Cost</span>
                        <span className="font-bold text-[#107c41] text-xs">£{formData.totalCost || '0.00'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2 bg-white rounded-xs border border-[#e5e5e5] text-xs">
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Site / Location</span>
                        <span className="font-semibold text-[#242424]">{formData.siteName}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Site Manager (Locked)</span>
                        <span className="font-semibold text-[#242424]">{formData.siteManager || resolveSiteManager(formData.siteName)}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Reporting Staff (Locked)</span>
                        <span className="font-semibold text-teal-800">{loggedInUserName} ({userStaffPlace})</span>
                      </div>
                    </div>

                    <div className="border-t border-[#edebe9] pt-2 space-y-1 text-xs">
                      <div><span className="text-neutral-500">Appointment Nature:</span> <span className="text-[#242424]">{formData.appointmentNature}</span></div>
                      <div><span className="text-neutral-500">Route:</span> <span className="text-[#242424]">From {formData.accommodationName} ({formData.accommodationPostcode}) to {formData.appointmentAddress} ({formData.appointmentPostcode})</span></div>
                      <div><span className="text-neutral-500">Method:</span> <span className="text-[#242424]">{formData.transportMethod} ({formData.ticketsRequired} ticket(s))</span></div>
                      {formData.exceptionalCriteria && (
                        <div className="text-[#d83b01]">
                          <span className="font-semibold">Exceptional Criteria:</span> {formData.exceptionalCriteria} - {formData.exceptionalDetails}
                        </div>
                      )}
                      <div>
                        <span className="text-neutral-500">Evidence Attached:</span> <span className="text-[#242424]">{formData.attachments?.length || 0} document(s)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stepper Footer */}
            <div className="px-4 py-3 bg-[#faf9f8] border-t border-[#edebe9] flex items-center justify-between shrink-0">
              <div>
                {wizardStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setWizardStep(p => p - 1)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] hover:bg-[#f3f2f1] text-xs font-medium cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Previous
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {wizardStep < 6 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(p => p + 1)}
                    className="flex items-center gap-1 px-3.5 py-1.5 bg-[#8764b8] hover:bg-[#744da9] text-white rounded-xs text-xs font-semibold shadow-2xs cursor-pointer"
                  >
                    Next Step <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleWizardSubmit('Draft')}
                      className="px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] hover:bg-[#f3f2f1] text-xs font-medium cursor-pointer"
                    >
                      Save as Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWizardSubmit('Submitted')}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#8764b8] hover:bg-[#744da9] text-white rounded-xs text-xs font-semibold shadow-2xs cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" /> Submit Application
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESTRICTED HO / MANAGEMENT APPROVAL MODAL */}
      {reviewModalItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-6">
            <div className="px-4 py-3 bg-[#f3f2f1] border-b border-[#e1dfdd] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#8764b8]" />
                <h3 className="font-bold text-sm text-[#242424]">
                  Home Office / Management Approval Review
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalItem(null)}
                className="text-[#605e5c] hover:text-[#242424] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="p-2.5 bg-[#faf9f8] rounded-xs border border-[#e1dfdd] flex justify-between">
                <div>
                  <span className="text-neutral-500 block text-[11px]">Applicant Ref</span>
                  <span className="font-bold text-[#242424] text-xs">{reviewModalItem.mainAppRef}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">Estimated Cost</span>
                  <span className="font-bold text-[#242424] text-xs">£{reviewModalItem.totalCost}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">Site</span>
                  <span className="font-semibold text-[#242424]">{reviewModalItem.siteName}</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">
                  Approval Decision Status
                </label>
                <select
                  value={reviewData.status}
                  onChange={(e) => {
                    const st = e.target.value as FundingRequestStatus;
                    setReviewData(p => ({
                      ...p,
                      status: st,
                      decision: st === 'Approved' ? 'Approved' : st === 'Rejected' ? 'Rejected' : st
                    }));
                  }}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-semibold text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                >
                  <option value="Approved">Approved</option>
                  <option value="Clarification Required">Clarification Required</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {reviewData.status === 'Approved' && (
                <div className="space-y-2.5 p-3 bg-[#f1faf0] rounded-xs border border-[#c4e8c1]">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#107c41] mb-1">
                        Generated Journey URN
                      </label>
                      <input
                        type="text"
                        placeholder="URN-2026-..."
                        value={reviewData.journeyUrn || `URN-${Date.now().toString().slice(-6)}`}
                        onChange={(e) => setReviewData(p => ({ ...p, journeyUrn: e.target.value }))}
                        className="w-full p-1.5 border border-[#c4e8c1] rounded-xs bg-white font-mono font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#107c41] mb-1">
                        Approved Payment Amount (£)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={reviewData.paymentAmount || reviewModalItem.totalCost || ''}
                        onChange={(e) => setReviewData(p => ({ ...p, paymentAmount: e.target.value }))}
                        className="w-full p-1.5 border border-[#c4e8c1] rounded-xs bg-white font-bold text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#107c41] mb-1">
                      Approved Transport Method
                    </label>
                    <input
                      type="text"
                      value={reviewData.approvedTransportMethod || reviewModalItem.transportMethod || ''}
                      onChange={(e) => setReviewData(p => ({ ...p, approvedTransportMethod: e.target.value }))}
                      className="w-full p-1.5 border border-[#c4e8c1] rounded-xs bg-white text-xs"
                    />
                  </div>
                </div>
              )}

              {(reviewData.status === 'Rejected' || reviewData.status === 'Clarification Required') && (
                <div>
                  <label className="font-semibold text-[#a4262c] block mb-1">
                    Rejection / Clarification Reason *
                  </label>
                  <textarea
                    rows={2}
                    value={reviewData.rejectionReason}
                    onChange={(e) => setReviewData(p => ({ ...p, rejectionReason: e.target.value }))}
                    placeholder="Provide specific feedback or missing documents required..."
                    className="w-full p-2 border border-[#f3b2b7] bg-white rounded-xs text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                    required
                  />
                </div>
              )}

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">
                  Internal / HO Comments (Confidential)
                </label>
                <textarea
                  rows={2}
                  value={reviewData.internalComments}
                  onChange={(e) => setReviewData(p => ({ ...p, internalComments: e.target.value }))}
                  placeholder="Confidential reviewer notes..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden"
                />
              </div>
            </div>

            <div className="px-4 py-3 bg-[#faf9f8] border-t border-[#edebe9] flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setReviewModalItem(null)}
                className="px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] hover:bg-[#f3f2f1] text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReview}
                className="px-3.5 py-1.5 bg-[#8764b8] hover:bg-[#744da9] text-white rounded-xs text-xs font-semibold shadow-2xs cursor-pointer"
              >
                Confirm Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW APPLICATION DOSSIER */}
      {viewingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-6">
            <div className="px-4 py-3 bg-[#f3f2f1] border-b border-[#e1dfdd] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#242424]">
                  Funding Application Dossier
                </h3>
                <span className="text-xs font-mono text-[#0078d4]">{viewingItem.mainAppRef} • {viewingItem.mainAppInitials}</span>
              </div>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="text-[#605e5c] hover:text-[#242424] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3.5 text-xs max-h-[80vh]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#faf9f8] rounded-xs border border-[#e1dfdd]">
                <div>
                  <span className="text-neutral-500 block text-[11px]">Status</span>
                  <span className="font-bold text-[#242424]">{viewingItem.status}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">Site</span>
                  <span className="font-semibold text-[#242424]">{viewingItem.siteName}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">Total Cost</span>
                  <span className="font-bold text-[#107c41]">£{viewingItem.totalCost}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">Journey URN</span>
                  <span className="font-mono font-bold text-[#0078d4]">{viewingItem.journeyUrn || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2.5 bg-neutral-50 rounded-xs border border-neutral-200 text-xs">
                <div>
                  <span className="text-neutral-500 block text-[11px]">Site Manager</span>
                  <span className="font-semibold text-[#242424]">{viewingItem.siteManager || resolveSiteManager(viewingItem.siteName)}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">Staff Place</span>
                  <span className="font-semibold text-[#242424]">{viewingItem.staffPlace || 'All Sites'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">Reporting Staff Member</span>
                  <span className="font-semibold text-teal-800">{viewingItem.reportingPerson || '—'}</span>
                </div>
              </div>

              <div className="space-y-1 p-3 rounded-xs border border-[#e1dfdd] bg-[#faf9f8]">
                <div className="font-semibold text-[#605e5c]">Appointment Information</div>
                <div><span className="text-neutral-500">Nature:</span> <span className="text-[#242424]">{viewingItem.appointmentNature}</span></div>
                <div><span className="text-neutral-500">Date/Time:</span> <span className="text-[#242424]">{viewingItem.appointmentDate} at {viewingItem.appointmentTime}</span></div>
                <div><span className="text-neutral-500">Appointment Address:</span> <span className="text-[#242424]">{viewingItem.appointmentAddress} ({viewingItem.appointmentPostcode})</span></div>
                <div><span className="text-neutral-500">Origin Accommodation:</span> <span className="text-[#242424]">{viewingItem.accommodationName} ({viewingItem.accommodationPostcode})</span></div>
              </div>

              {viewingItem.exceptionalCriteria && (
                <div className="p-3 bg-[#fff8f0] rounded-xs border border-[#fed9cc]">
                  <span className="font-semibold text-[#8a3707] block">
                    Exceptional Circumstance Justification
                  </span>
                  <div className="mt-1"><span className="text-neutral-500">Criteria:</span> <span className="text-[#242424]">{viewingItem.exceptionalCriteria}</span></div>
                  <div className="mt-0.5"><span className="text-neutral-500">Details:</span> <span className="text-[#242424]">{viewingItem.exceptionalDetails}</span></div>
                </div>
              )}

              {/* Restricted Management Section in Dossier (Only visible to Management) */}
              {isManagementOrHo && (
                <div className="p-3 bg-purple-50/50 rounded-xs border border-purple-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[#8764b8] font-semibold">
                    <Lock className="w-3.5 h-3.5" /> Restricted HO / Internal Approval Record
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div><span className="text-neutral-500">Approved Method:</span> <span className="text-[#242424]">{viewingItem.approvedTransportMethod || '—'}</span></div>
                    <div><span className="text-neutral-500">Payment Amount:</span> <span className="text-[#242424]">£{viewingItem.paymentAmount || '—'}</span></div>
                    <div><span className="text-neutral-500">Approved By:</span> <span className="text-[#242424]">{viewingItem.approvedBy || '—'}</span></div>
                    <div><span className="text-neutral-500">Approval Date:</span> <span className="text-[#242424]">{viewingItem.approvalDate ? new Date(viewingItem.approvalDate).toLocaleDateString() : '—'}</span></div>
                  </div>
                  {viewingItem.internalComments && (
                    <div className="text-[11px] pt-1">
                      <span className="text-neutral-500 block">Internal Comments:</span>
                      <p className="whitespace-pre-wrap text-[#242424]">{viewingItem.internalComments}</p>
                    </div>
                  )}
                  {viewingItem.rejectionReason && (
                    <div className="text-[11px] pt-1 text-[#a4262c]">
                      <span className="font-semibold block">Rejection Reason:</span>
                      <p className="whitespace-pre-wrap">{viewingItem.rejectionReason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Attachments */}
              <AttachmentsSection
                attachments={viewingItem.attachments || []}
                readOnly={true}
                title="Application Evidence & Letters"
              />
            </div>

            <div className="px-4 py-3 bg-[#faf9f8] border-t border-[#edebe9] flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] hover:bg-[#f3f2f1] text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
