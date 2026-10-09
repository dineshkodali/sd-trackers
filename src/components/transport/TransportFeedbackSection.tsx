import React, { useState, useMemo, useCallback } from 'react';
import { 
  MessageSquareWarning, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Eye, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Building2, 
  CheckCircle2, 
  X, 
  Download,
  AlertTriangle,
  ArrowUpDown,
  Car,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TransportFeedbackRecord, TransportImpactLevel } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { AttachmentsSection } from '../common/AttachmentsSection';

export const TRANSPORT_ISSUE_CATEGORIES = [
  'Aspen issue',
  'Ticket issue',
  'Bus/train delay',
  'Missed transport',
  'Incorrect journey information',
  'Pick-up issue',
  'Drop-off issue',
  'Driver/taxi issue',
  'Public transport unavailable',
  'Accessibility issue',
  'Communication issue',
  'Cost/funding issue',
  'Other'
];

const feedbackExportColumns: ExportColumnOption[] = [
  { id: 'srNo', label: 'Sr. No.' },
  { id: 'siteName', label: 'Site Name' },
  { id: 'siteManager', label: 'Site Manager' },
  { id: 'staffPlace', label: 'Staff Place' },
  { id: 'reportingPerson', label: 'Reporting Staff Member' },
  { id: 'transportType', label: 'Transport Type' },
  { id: 'pickupLocation', label: 'Pick-up Location' },
  { id: 'dropLocation', label: 'Drop Location' },
  { id: 'travelDate', label: 'Date of Travel' },
  { id: 'travelTime', label: 'Time of Travel' },
  { id: 'issueCategory', label: 'Transport Issue' },
  { id: 'issueDescription', label: 'Issue Description' },
  { id: 'impactLevel', label: 'Impact Level' },
  { id: 'impactExplanation', label: 'Impact Explanation' },
  { id: 'isResolved', label: 'Resolution Provided?' },
  { id: 'resolutionComments', label: 'Resolution Comments' }
];

export const TransportFeedbackSection: React.FC = () => {
  const { 
    transportFeedbackRecords, 
    addTransportFeedbackRecord, 
    updateTransportFeedbackRecord, 
    deleteTransportFeedbackRecord,
    canAccessAllSites,
    allowedSites,
    assignedSite,
    sites,
    properties,
    authProfile,
    currentUserName,
    canEditRecord,
    canDeleteRecord
  } = useApp();

  const loggedInUserName = useMemo(() => {
    return authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || 'Duty Officer';
  }, [authProfile, currentUserName]);

  const userStaffPlace = useMemo(() => {
    return authProfile?.assignedSite || assignedSite || 'All Sites';
  }, [authProfile, assignedSite]);

  const resolveSiteManager = useCallback((siteIdentifier?: string): string => {
    if (!siteIdentifier) return 'Unassigned';
    const clean = String(siteIdentifier).trim().toLowerCase();
    const foundSite = (sites || []).find(s => {
      const name = typeof s === 'string' ? s : s?.name;
      const id = typeof s === 'object' ? s?.id : '';
      return (name && String(name).toLowerCase() === clean) || (id && String(id).toLowerCase() === clean);
    });
    if (foundSite && typeof foundSite === 'object' && foundSite.leadOfficer) {
      return foundSite.leadOfficer;
    }
    const foundProp = (properties || []).find(p => {
      const name = p?.name;
      const id = p?.id;
      return (name && String(name).toLowerCase() === clean) || (id && String(id).toLowerCase() === clean);
    });
    if (foundProp?.leadOfficer) return foundProp.leadOfficer;
    return 'Site Manager';
  }, [sites, properties]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState<string>(!canAccessAllSites() ? (assignedSite || 'all') : 'all');
  const [impactFilter, setImpactFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [resolutionFilter, setResolutionFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const defaultSite = useMemo(() => {
    const list = (allowedSites || []).filter(s => s && s !== 'All Sites' && s !== 'all');
    return !canAccessAllSites()
      ? (assignedSite || list[0] || (sites[0]?.name ?? ''))
      : (selectedSite !== 'all' ? selectedSite : (list[0] || (sites[0]?.name ?? '')));
  }, [canAccessAllSites, assignedSite, allowedSites, sites, selectedSite]);

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<keyof TransportFeedbackRecord>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TransportFeedbackRecord | null>(null);
  const [viewingItem, setViewingItem] = useState<TransportFeedbackRecord | null>(null);
  const [resolvingItem, setResolvingItem] = useState<TransportFeedbackRecord | null>(null);
  const [quickResolutionText, setQuickResolutionText] = useState('');

  // Form State for Create / Edit
  const initialFormData: Partial<TransportFeedbackRecord> = {
    siteName: defaultSite,
    siteManager: resolveSiteManager(defaultSite),
    staffPlace: userStaffPlace,
    reportingPerson: loggedInUserName,
    reportingPersonId: authProfile?.id,
    transportType: 'Aspen',
    pickupLocation: '',
    dropLocation: '',
    travelDate: new Date().toISOString().split('T')[0],
    travelTime: '09:00',
    issueCategory: 'Aspen issue',
    issueDescription: '',
    impactLevel: 'Medium',
    impactExplanation: '',
    isResolved: 'No',
    resolutionComments: '',
    attachments: []
  };

  const [formData, setFormData] = useState<Partial<TransportFeedbackRecord>>(initialFormData);

  // Scoped Data
  const siteScopedRecords = useMemo(() => {
    return transportFeedbackRecords.filter(r => {
      if (!canAccessAllSites()) {
        const allowed = new Set(allowedSites.map(s => s.toLowerCase().trim()));
        if (assignedSite) allowed.add(assignedSite.toLowerCase().trim());
        return allowed.has((r.siteName || '').toLowerCase().trim());
      }
      return true;
    });
  }, [transportFeedbackRecords, canAccessAllSites, allowedSites, assignedSite]);

  // Filtered & Searched Data
  const filteredRecords = useMemo(() => {
    return siteScopedRecords.filter(r => {
      // Site filter
      if (selectedSite !== 'all' && (r.siteName || '').toLowerCase().trim() !== selectedSite.toLowerCase().trim()) {
        return false;
      }
      // Impact filter
      if (impactFilter !== 'all' && r.impactLevel !== impactFilter) {
        return false;
      }
      // Type filter
      if (typeFilter !== 'all' && r.transportType !== typeFilter) {
        return false;
      }
      // Resolution filter
      if (resolutionFilter !== 'all') {
        const isRes = r.isResolved === 'Yes' || r.isResolved === true;
        if (resolutionFilter === 'resolved' && !isRes) return false;
        if (resolutionFilter === 'unresolved' && isRes) return false;
      }
      // Category filter
      if (categoryFilter !== 'all' && r.issueCategory !== categoryFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches = 
          (r.reportingPerson || '').toLowerCase().includes(q) ||
          (r.siteName || '').toLowerCase().includes(q) ||
          (r.issueCategory || '').toLowerCase().includes(q) ||
          (r.issueDescription || '').toLowerCase().includes(q) ||
          (r.pickupLocation || '').toLowerCase().includes(q) ||
          (r.dropLocation || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [siteScopedRecords, selectedSite, impactFilter, typeFilter, resolutionFilter, categoryFilter, searchQuery]);

  // Sorted Data
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

  // Paginated Data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  // Handle Form Submit (Create / Edit)
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.siteName || !formData.issueCategory || !formData.issueDescription) {
      alert('Please fill in all required fields (Site, Issue Category, and Description).');
      return;
    }

    const payload: Partial<TransportFeedbackRecord> = {
      ...formData,
      siteName: formData.siteName || defaultSite,
      siteManager: resolveSiteManager(formData.siteName || defaultSite),
      staffPlace: userStaffPlace,
      reportingPerson: loggedInUserName,
      reportingPersonId: authProfile?.id
    };

    if (editingItem) {
      updateTransportFeedbackRecord(editingItem.id, payload);
      setEditingItem(null);
    } else {
      addTransportFeedbackRecord(payload as any);
      setIsCreateOpen(false);
    }
  };

  // Quick Resolve
  const handleConfirmResolve = () => {
    if (!resolvingItem) return;
    updateTransportFeedbackRecord(resolvingItem.id, {
      isResolved: 'Yes',
      resolutionComments: quickResolutionText.trim() || 'Issue marked as resolved by staff.'
    });
    setResolvingItem(null);
    setQuickResolutionText('');
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
      ? feedbackExportColumns.filter(c => selectedColumns.includes(c.id))
      : feedbackExportColumns;
    const headers = activeCols.map(c => c.label);
    const rows = rawData.map((item, idx) => {
      const dataItem = {
        ...item,
        srNo: idx + 1,
        isResolved: item.isResolved === 'Yes' || item.isResolved === true ? 'Yes' : 'No'
      };
      return activeCols.map(c => String((dataItem as any)[c.id] ?? ''));
    });

    if (format === 'csv') {
      exportTableToCsv({ filename: 'Transport_Journey_Feedback.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'Transport_Journey_Feedback.pdf',
        title: 'Transport Journey Feedback Log',
        headers,
        rows,
        orientation
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header, Actions & Filters Card */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#242424]">Transport Journey Feedback</h2>
            <p className="text-xs text-neutral-500">Record, categorize, and resolve journey incidents across Aspen and OOH services.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ExportDropdown
              moduleName="Transport Feedback"
              totalRecordCount={transportFeedbackRecords.length}
              filteredRecordCount={filteredRecords.length}
              availableColumns={feedbackExportColumns}
              onExport={handleExport}
              buttonVariant="toolbar"
            />

            <button
              onClick={() => {
                setFormData({
                  ...initialFormData,
                  siteName: !canAccessAllSites() ? (assignedSite || allowedSites[0] || 'Brit Hotel') : (selectedSite !== 'all' ? selectedSite : (allowedSites[0] || 'Brit Hotel')),
                  reportingPerson: currentUserName || ''
                });
                setEditingItem(null);
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#8764b8] hover:bg-[#744da9] text-white rounded-xs shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Report Issue</span>
            </button>
          </div>
        </div>

        {/* Integrated Filter Row */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text"
              placeholder="Search feedback..."
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
            value={impactFilter}
            onChange={(e) => { setImpactFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden transition-all"
          >
            <option value="all">All Impacts</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden transition-all"
          >
            <option value="all">All Types</option>
            <option value="Aspen">Aspen</option>
            <option value="OOH">OOH</option>
          </select>

          <select
            value={resolutionFilter}
            onChange={(e) => { setResolutionFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="unresolved">Unresolved (Open)</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Main Table Model */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden flex flex-col justify-between">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#faf9f8] text-[#323130] font-semibold border-b border-[#e1dfdd] text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3 w-12 text-center border-b border-[#e5e5e5]">Sr.</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Site Name</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Site Manager</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Staff Place</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Reporting Staff</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Type</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Route (Pick-up → Drop)</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Travel Date/Time</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Transport Issue</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Impact</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Resolved?</th>
                <th className="py-2.5 px-3 text-right border-b border-[#e5e5e5]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f2f1]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-neutral-400">
                    <MessageSquareWarning className="w-8 h-8 mx-auto mb-2 opacity-40 text-neutral-400" />
                    No transport feedback records found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, index) => {
                  const srNo = (currentPage - 1) * pageSize + index + 1;
                  const isResolved = item.isResolved === 'Yes' || item.isResolved === true;

                  const impactBadge = {
                    Critical: 'bg-rose-50 text-rose-800 border-rose-200',
                    High: 'bg-orange-50 text-orange-800 border-orange-200',
                    Medium: 'bg-amber-50 text-amber-800 border-amber-200',
                    Low: 'bg-neutral-50 text-neutral-700 border-neutral-200'
                  }[item.impactLevel] || 'bg-neutral-50 text-neutral-700 border-neutral-200';

                  return (
                    <tr 
                      key={item.id} 
                      className="border-b border-[#f3f2f1] hover:bg-[#f8f9fa] transition-colors"
                    >
                      <td className="py-2 px-3 text-center font-mono text-neutral-400 text-[11px]">{srNo}</td>
                      <td className="py-2 px-3 font-medium text-[#242424]">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{item.siteName}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-[#323130] font-medium">
                        <span>{item.siteManager || resolveSiteManager(item.siteName)}</span>
                      </td>
                      <td className="py-2 px-3 text-neutral-600">
                        <span>{item.staffPlace || userStaffPlace}</span>
                      </td>
                      <td className="py-2 px-3 text-[#323130]">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{item.reportingPerson || loggedInUserName}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[11px] font-semibold ${
                          item.transportType === 'Aspen' 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {item.transportType}
                        </span>
                      </td>
                      <td className="py-2 px-3 max-w-[200px]">
                        <div className="truncate font-medium text-[#242424]">{item.pickupLocation || '—'}</div>
                        <div className="truncate text-neutral-500 text-[11px]">→ {item.dropLocation || '—'}</div>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-[#323130] font-mono">
                          <Calendar className="w-3 h-3 text-neutral-400" />
                          <span>{item.travelDate || '—'}</span>
                        </div>
                        {item.travelTime && (
                          <div className="flex items-center gap-1 text-neutral-500 text-[11px] mt-0.5 font-mono">
                            <Clock className="w-3 h-3 text-neutral-400" />
                            <span>{item.travelTime}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 max-w-[180px]">
                        <span className="font-semibold text-[#242424] block truncate">
                          {item.issueCategory}
                        </span>
                        <span className="text-neutral-500 text-[11px] block truncate">
                          {item.issueDescription}
                        </span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[10px] font-bold border ${impactBadge}`}>
                          {item.impactLevel}
                        </span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Resolved
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingItem(item);
                              setQuickResolutionText(item.resolutionComments || '');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 cursor-pointer"
                            title="Click to resolve"
                          >
                            <AlertCircle className="w-3 h-3 text-amber-600" /> Open
                          </button>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingItem(item)}
                            className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded cursor-pointer"
                            title="View Dossier"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEditRecord() && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItem(item);
                                setFormData(item);
                                setIsCreateOpen(true);
                              }}
                              className="p-1 hover:bg-[#edebe9] text-[#0d9488] rounded cursor-pointer"
                              title="Edit Record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDeleteRecord() && (
                            <button
                              type="button"
                              onClick={() => deleteTransportFeedbackRecord(item.id)}
                              className="p-1 hover:bg-red-50 text-[#a4262c] rounded cursor-pointer"
                              title="Delete Record"
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

        {/* Pagination */}
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

      {/* CREATE / EDIT FORM MODAL (Standard SDTracker styling) */}
      {(isCreateOpen || editingItem) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-6">
            <div className="px-4 py-3 bg-[#f3f2f1] border-b border-[#e1dfdd] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="w-4 h-4 text-[#8764b8]" />
                <h3 className="text-sm font-bold text-[#242424]">
                  {editingItem ? 'Edit Transport Journey Feedback' : 'Report Journey Feedback / Issue'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setIsCreateOpen(false); setEditingItem(null); }}
                className="text-[#605e5c] hover:text-[#242424] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-4 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Site Selection */}
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">
                    Site / Hotel *
                  </label>
                  <select
                    value={formData.siteName}
                    disabled={!canAccessAllSites()}
                    onChange={(e) => {
                      const newSite = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        siteName: newSite,
                        siteManager: resolveSiteManager(newSite)
                      }));
                    }}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] disabled:opacity-60 text-xs"
                    required
                  >
                    {allowedSites.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Reporting Staff Member (Locked) */}
                <div>
                  <label className="font-semibold text-[#605e5c] flex items-center justify-between mb-1">
                    <span>Reporting Staff Member *</span>
                    <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-teal-600" /> Logged-in User (Locked)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={loggedInUserName}
                      readOnly
                      disabled
                      className="w-full p-2 pr-8 border border-teal-200 rounded-xs bg-teal-50/50 text-teal-950 font-medium cursor-not-allowed text-xs"
                      title="Locked to logged-in user for accountability and audit logs."
                    />
                    <Lock className="w-3.5 h-3.5 text-teal-600 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Site Manager (Locked) */}
                <div>
                  <label className="font-semibold text-[#605e5c] flex items-center justify-between mb-1">
                    <span>Site Manager</span>
                    <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-teal-600" /> Site Manager (Locked)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={resolveSiteManager(formData.siteName)}
                      readOnly
                      disabled
                      className="w-full p-2 pr-8 border border-neutral-300 rounded-xs bg-neutral-100/70 text-neutral-800 font-medium cursor-not-allowed text-xs"
                      title="Automatically retrieved from site assignment."
                    />
                    <Lock className="w-3.5 h-3.5 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Staff Place (Locked) */}
                <div>
                  <label className="font-semibold text-[#605e5c] flex items-center justify-between mb-1">
                    <span>Staff Place</span>
                    <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-teal-600" /> Staff Place (Locked)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={userStaffPlace}
                      readOnly
                      disabled
                      className="w-full p-2 pr-8 border border-neutral-300 rounded-xs bg-neutral-100/70 text-neutral-800 font-medium cursor-not-allowed text-xs"
                      title="Automatically retrieved from logged-in staff assignment."
                    />
                    <Lock className="w-3.5 h-3.5 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Transport Type */}
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">
                    Type of Transport *
                  </label>
                  <select
                    value={formData.transportType}
                    onChange={(e) => setFormData(prev => ({ ...prev, transportType: e.target.value }))}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    required
                  >
                    <option value="Aspen">Aspen</option>
                    <option value="OOH">OOH (Out of Hours)</option>
                    <option value="Public Train/Bus">Public Train/Bus</option>
                    <option value="Taxi Exception">Taxi Exception</option>
                  </select>
                </div>

                {/* Issue Category */}
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">
                    Transport Issue Category *
                  </label>
                  <select
                    value={formData.issueCategory}
                    onChange={(e) => setFormData(prev => ({ ...prev, issueCategory: e.target.value }))}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    required
                  >
                    {TRANSPORT_ISSUE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Pick-up Location */}
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">
                    Pick-up Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hotel Reception / Station"
                    value={formData.pickupLocation || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, pickupLocation: e.target.value }))}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                  />
                </div>

                {/* Drop Location */}
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">
                    Drop Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hospital / Clinic / Home Office"
                    value={formData.dropLocation || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, dropLocation: e.target.value }))}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                  />
                </div>

                {/* Travel Date */}
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">
                    Date of Travel
                  </label>
                  <input
                    type="date"
                    value={formData.travelDate || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, travelDate: e.target.value }))}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs font-mono"
                  />
                </div>

                {/* Travel Time */}
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">
                    Time of Travel
                  </label>
                  <input
                    type="time"
                    value={formData.travelTime || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, travelTime: e.target.value }))}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs font-mono"
                  />
                </div>

                {/* Impact Level */}
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">
                    Impact Level *
                  </label>
                  <select
                    value={formData.impactLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, impactLevel: e.target.value as TransportImpactLevel }))}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-semibold text-xs"
                    required
                  >
                    <option value="Low">Low - Minor inconvenience</option>
                    <option value="Medium">Medium - Delay under 1 hour</option>
                    <option value="High">High - Missed critical appointment</option>
                    <option value="Critical">Critical - Urgent medical / safety risk</option>
                  </select>
                </div>

                {/* Resolution Status */}
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">
                    Resolution Provided?
                  </label>
                  <select
                    value={formData.isResolved === 'Yes' || formData.isResolved === true ? 'Yes' : 'No'}
                    onChange={(e) => setFormData(prev => ({ ...prev, isResolved: e.target.value as 'Yes' | 'No' }))}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                  >
                    <option value="No">No (Still Open)</option>
                    <option value="Yes">Yes (Resolved)</option>
                  </select>
                </div>
              </div>

              {/* Detailed Description */}
              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">
                  Issue Description *
                </label>
                <textarea
                  rows={3}
                  value={formData.issueDescription || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, issueDescription: e.target.value }))}
                  placeholder="Provide precise details of the journey incident, delay, or failure..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                  required
                />
              </div>

              {/* Impact Explanation */}
              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">
                  Impact Explanation
                </label>
                <textarea
                  rows={2}
                  value={formData.impactExplanation || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, impactExplanation: e.target.value }))}
                  placeholder="Explain the consequence on the service user, appointment, or staff..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                />
              </div>

              {/* Resolution Comments */}
              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">
                  Resolution Comments / Action Taken
                </label>
                <textarea
                  rows={2}
                  value={formData.resolutionComments || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, resolutionComments: e.target.value }))}
                  placeholder="Detail actions taken to resolve or prevent recurrence..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                />
              </div>

              {/* Attachments Section */}
              <AttachmentsSection
                attachments={formData.attachments || []}
                onChange={(attachments) => setFormData(prev => ({ ...prev, attachments }))}
                title="Supporting Proof / Ticket Attachments"
                entityName="Feedback"
              />

              <div className="pt-3 border-t border-[#edebe9] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); setEditingItem(null); }}
                  className="px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] hover:bg-[#f3f2f1] font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#8764b8] hover:bg-[#744da9] text-white rounded-xs font-semibold shadow-2xs text-xs cursor-pointer"
                >
                  {editingItem ? 'Save Changes' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK RESOLVE MODAL */}
      {resolvingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="px-4 py-3 bg-[#f3f2f1] border-b border-[#e1dfdd] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-[#242424]">
                  Mark Issue as Resolved
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResolvingItem(null)}
                className="text-[#605e5c] hover:text-[#242424] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-neutral-500">
                Resolving feedback for <span className="font-semibold text-[#242424]">{resolvingItem.issueCategory}</span> at {resolvingItem.siteName}.
              </p>
              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">
                  Resolution Comments / Corrective Action
                </label>
                <textarea
                  rows={3}
                  value={quickResolutionText}
                  onChange={(e) => setQuickResolutionText(e.target.value)}
                  placeholder="Describe resolution provided, vouchers issued, contractor feedback, etc..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                />
              </div>
              <div className="pt-2 border-t border-[#edebe9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResolvingItem(null)}
                  className="px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] hover:bg-[#f3f2f1] font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResolve}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xs font-semibold text-xs shadow-2xs cursor-pointer"
                >
                  Confirm Resolution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DOSSIER MODAL */}
      {viewingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-6">
            <div className="px-4 py-3 bg-[#f3f2f1] border-b border-[#e1dfdd] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#242424]">
                  Transport Issue Dossier
                </h3>
                <span className="text-[11px] text-neutral-400 font-mono">ID: {viewingItem.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="text-[#605e5c] hover:text-[#242424] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-[#faf9f8] rounded-xs border border-[#edebe9]">
                <div>
                  <span className="text-neutral-400 block text-[11px]">Site Name</span>
                  <span className="font-semibold text-[#242424]">{viewingItem.siteName}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px]">Site Manager</span>
                  <span className="font-semibold text-[#242424]">{viewingItem.siteManager || resolveSiteManager(viewingItem.siteName)}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px]">Staff Place</span>
                  <span className="font-semibold text-[#242424]">{viewingItem.staffPlace || userStaffPlace}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px]">Reporting Staff</span>
                  <span className="font-semibold text-[#242424]">{viewingItem.reportingPerson}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px]">Transport Type</span>
                  <span className="font-semibold text-[#242424]">{viewingItem.transportType}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[11px]">Impact</span>
                  <span className="font-semibold text-[#242424]">{viewingItem.impactLevel}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-[#242424]">Journey Details</span>
                <div className="p-3 bg-[#faf9f8] rounded-xs border border-[#edebe9] space-y-1">
                  <div><span className="text-neutral-500">Pick-up:</span> <strong className="text-[#242424]">{viewingItem.pickupLocation || '—'}</strong></div>
                  <div><span className="text-neutral-500">Drop-off:</span> <strong className="text-[#242424]">{viewingItem.dropLocation || '—'}</strong></div>
                  <div><span className="text-neutral-500">Date/Time:</span> <strong className="text-[#242424]">{viewingItem.travelDate} at {viewingItem.travelTime}</strong></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-[#242424]">Incident Details</span>
                <div className="p-3 bg-[#faf9f8] rounded-xs border border-[#edebe9] space-y-2">
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Category:</span>
                    <span className="font-semibold text-[#242424]">{viewingItem.issueCategory}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Description:</span>
                    <p className="mt-0.5 text-[#323130] whitespace-pre-wrap">{viewingItem.issueDescription}</p>
                  </div>
                  {viewingItem.impactExplanation && (
                    <div>
                      <span className="text-neutral-500 block text-[11px]">Impact Explanation:</span>
                      <p className="mt-0.5 text-[#323130] whitespace-pre-wrap">{viewingItem.impactExplanation}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-[#242424]">Resolution & Audit</span>
                <div className="p-3 bg-[#faf9f8] rounded-xs border border-[#edebe9] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500">Status:</span>
                    {viewingItem.isResolved === 'Yes' || viewingItem.isResolved === true ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Unresolved
                      </span>
                    )}
                  </div>
                  {viewingItem.resolutionComments && (
                    <div>
                      <span className="text-neutral-500 block text-[11px]">Resolution Comments:</span>
                      <p className="mt-0.5 text-[#323130] whitespace-pre-wrap">{viewingItem.resolutionComments}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Attachments Section (Read-Only) */}
              <AttachmentsSection
                attachments={viewingItem.attachments || []}
                readOnly={true}
                title="Evidence & Documents"
              />

              <div className="pt-3 border-t border-[#edebe9] flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingItem(null)}
                  className="px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] hover:bg-[#f3f2f1] font-medium text-xs cursor-pointer"
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
