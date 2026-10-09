import React, { useState, useMemo, useCallback } from 'react';
import { 
  BarChart3, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Eye, 
  ShieldAlert, 
  Building2, 
  User, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  X, 
  AlertTriangle,
  Car,
  Bus,
  TrendingUp,
  FileSpreadsheet,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TransportChallengeRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';

const challengesExportColumns: ExportColumnOption[] = [
  { id: 'recordNo', label: '#' },
  { id: 'siteName', label: 'Site Name' },
  { id: 'siteManager', label: 'Site Manager' },
  { id: 'staffPlace', label: 'Staff Place' },
  { id: 'reportingPerson', label: 'Reporting Staff Member' },
  { id: 'reportingPeriod', label: 'Reporting Period' },
  { id: 'guidanceShared', label: 'Guidance Shared with SUs' },
  { id: 'trackerInUse', label: 'Tracker in Use' },
  { id: 'publicTransportDefault', label: 'PT Used as Default' },
  { id: 'taxiRestricted', label: 'Taxi Restricted to Exceptions' },
  { id: 'ptJourneysCount', label: 'No. of PT Journeys' },
  { id: 'taxiRequestsRaised', label: 'Taxi Raised' },
  { id: 'taxiRequestsApproved', label: 'Taxi Approved' },
  { id: 'taxiRequestsDeclined', label: 'Taxi Declined' },
  { id: 'siteChallenges', label: 'Main Site Challenges' },
  { id: 'commonIssues', label: 'Common Issues' },
  { id: 'teamFeedback', label: 'Team Feedback' },
  { id: 'hasSgConcerns', label: 'SG Concerns' },
  { id: 'sgDetails', label: 'Safeguarding Details' },
  { id: 'comments', label: 'Additional Comments' }
];

export const TransportChallengesSection: React.FC = () => {
  const {
    transportChallengeRecords,
    addTransportChallengeRecord,
    updateTransportChallengeRecord,
    deleteTransportChallengeRecord,
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

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState<string>(!canAccessAllSites() ? (assignedSite || 'all') : 'all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [sgFilter, setSgFilter] = useState('all');

  const defaultSite = useMemo(() => {
    const list = (allowedSites || []).filter(s => s && s !== 'All Sites' && s !== 'all');
    return !canAccessAllSites()
      ? (assignedSite || list[0] || (sites[0]?.name ?? ''))
      : (selectedSite !== 'all' ? selectedSite : (list[0] || (sites[0]?.name ?? '')));
  }, [canAccessAllSites, assignedSite, allowedSites, sites, selectedSite]);

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<keyof TransportChallengeRecord>('reportingPeriod');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TransportChallengeRecord | null>(null);
  const [viewingItem, setViewingItem] = useState<TransportChallengeRecord | null>(null);

  // Form State
  const initialFormState: Partial<TransportChallengeRecord> = {
    siteName: defaultSite,
    siteManager: resolveSiteManager(defaultSite),
    staffPlace: userStaffPlace,
    reportingPerson: loggedInUserName,
    reportingPersonId: authProfile?.id,
    reportingPeriod: 'October 2026',
    guidanceShared: 'Yes',
    trackerInUse: 'Yes',
    publicTransportDefault: 'Yes',
    taxiRestricted: 'Yes',
    ptJourneysCount: 0,
    taxiRequestsRaised: 0,
    taxiRequestsApproved: 0,
    taxiRequestsDeclined: 0,
    siteChallenges: '',
    commonIssues: '',
    teamFeedback: '',
    hasSgConcerns: 'No',
    sgDetails: '',
    comments: ''
  };

  const [formData, setFormData] = useState<Partial<TransportChallengeRecord>>(initialFormState);

  // Scoped Data
  const siteScopedRecords = useMemo(() => {
    return transportChallengeRecords.filter(r => {
      if (!canAccessAllSites()) {
        const allowed = new Set(allowedSites.map(s => s.toLowerCase().trim()));
        if (assignedSite) allowed.add(assignedSite.toLowerCase().trim());
        return allowed.has((r.siteName || '').toLowerCase().trim());
      }
      return true;
    });
  }, [transportChallengeRecords, canAccessAllSites, allowedSites, assignedSite]);

  // Unique periods for dropdown
  const uniquePeriods = useMemo(() => {
    const set = new Set(siteScopedRecords.map(r => r.reportingPeriod).filter(Boolean));
    return Array.from(set);
  }, [siteScopedRecords]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return siteScopedRecords.filter(r => {
      if (selectedSite !== 'all' && (r.siteName || '').toLowerCase().trim() !== selectedSite.toLowerCase().trim()) {
        return false;
      }
      if (periodFilter !== 'all' && r.reportingPeriod !== periodFilter) {
        return false;
      }
      if (sgFilter !== 'all') {
        const hasSg = r.hasSgConcerns === 'Yes' || r.hasSgConcerns === true;
        if (sgFilter === 'yes' && !hasSg) return false;
        if (sgFilter === 'no' && hasSg) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches = 
          (r.siteName || '').toLowerCase().includes(q) ||
          (r.siteManager || '').toLowerCase().includes(q) ||
          (r.reportingPeriod || '').toLowerCase().includes(q) ||
          (r.siteChallenges || '').toLowerCase().includes(q) ||
          (r.commonIssues || '').toLowerCase().includes(q) ||
          (r.teamFeedback || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [siteScopedRecords, selectedSite, periodFilter, sgFilter, searchQuery]);

  // Sorted Records
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

  // Save Form
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.siteName || !formData.reportingPeriod) {
      alert('Please fill in required fields (Site Name and Reporting Period).');
      return;
    }

    const payload: Partial<TransportChallengeRecord> = {
      ...formData,
      siteName: formData.siteName || defaultSite,
      siteManager: resolveSiteManager(formData.siteName || defaultSite),
      staffPlace: userStaffPlace,
      reportingPerson: loggedInUserName,
      reportingPersonId: authProfile?.id
    };

    if (editingItem) {
      updateTransportChallengeRecord(editingItem.id, payload);
      setEditingItem(null);
    } else {
      addTransportChallengeRecord(payload as any);
      setIsCreateOpen(false);
    }
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
      ? challengesExportColumns.filter(c => selectedColumns.includes(c.id))
      : challengesExportColumns;
    const headers = activeCols.map(c => c.label);
    const rows = rawData.map((item, idx) => {
      const dataItem = {
        ...item,
        recordNo: idx + 1,
        guidanceShared: item.guidanceShared === 'Yes' || item.guidanceShared === true ? 'Yes' : 'No',
        trackerInUse: item.trackerInUse === 'Yes' || item.trackerInUse === true ? 'Yes' : 'No',
        publicTransportDefault: item.publicTransportDefault === 'Yes' || item.publicTransportDefault === true ? 'Yes' : 'No',
        taxiRestricted: item.taxiRestricted === 'Yes' || item.taxiRestricted === true ? 'Yes' : 'No',
        hasSgConcerns: item.hasSgConcerns === 'Yes' || item.hasSgConcerns === true ? 'Yes' : 'No'
      };
      return activeCols.map(c => String((dataItem as any)[c.id] ?? ''));
    });

    if (format === 'csv') {
      exportTableToCsv({ filename: 'Site_Transport_Challenges.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'Site_Transport_Challenges.pdf',
        title: 'Site Transport Operational Challenges',
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
            <h2 className="text-sm font-bold text-[#242424]">Site Transport Operational Challenges</h2>
            <p className="text-xs text-neutral-500">Track monthly operational challenges, public transport adoption, and safeguarding flags across sites.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ExportDropdown
              moduleName="Transport Challenges"
              totalRecordCount={transportChallengeRecords.length}
              filteredRecordCount={filteredRecords.length}
              availableColumns={challengesExportColumns}
              onExport={handleExport}
              buttonVariant="toolbar"
            />

            <button
              onClick={() => {
                setFormData({
                  ...initialFormState,
                  siteName: !canAccessAllSites() ? (assignedSite || allowedSites[0] || 'Brit Hotel') : (selectedSite !== 'all' ? selectedSite : (allowedSites[0] || 'Brit Hotel')),
                  siteManager: currentUserName || 'Site Manager'
                });
                setEditingItem(null);
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#8764b8] hover:bg-[#744da9] text-white rounded-xs shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New Monthly Log</span>
            </button>
          </div>
        </div>

        {/* Integrated Filter Row */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text"
              placeholder="Search challenges, manager, period..."
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
            value={periodFilter}
            onChange={(e) => { setPeriodFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden transition-all"
          >
            <option value="all">All Reporting Periods</option>
            {uniquePeriods.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            value={sgFilter}
            onChange={(e) => { setSgFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#8764b8] focus:ring-1 focus:ring-[#8764b8] outline-hidden transition-all"
          >
            <option value="all">All Safeguarding Statuses</option>
            <option value="yes">With SG Concerns</option>
            <option value="no">No SG Concerns</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden flex flex-col justify-between">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#faf9f8] text-[#323130] font-semibold border-b border-[#e1dfdd] text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3 w-12 text-center border-b border-[#e5e5e5]">#</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Site & Manager</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Period</th>
                <th className="py-2.5 px-3 text-center border-b border-[#e5e5e5]">Guidance</th>
                <th className="py-2.5 px-3 text-center border-b border-[#e5e5e5]">Tracker</th>
                <th className="py-2.5 px-3 text-center border-b border-[#e5e5e5]">PT Default</th>
                <th className="py-2.5 px-3 text-center border-b border-[#e5e5e5]">PT Journeys</th>
                <th className="py-2.5 px-3 text-center border-b border-[#e5e5e5]">Taxi (Req / App / Dec)</th>
                <th className="py-2.5 px-3 border-b border-[#e5e5e5]">Site Challenges</th>
                <th className="py-2.5 px-3 text-center border-b border-[#e5e5e5]">SG Status</th>
                <th className="py-2.5 px-3 text-right border-b border-[#e5e5e5]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f2f1] text-[#323130]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-neutral-400">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#8764b8]" />
                    No monthly operational challenge records found.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, index) => {
                  const recordNo = (currentPage - 1) * pageSize + index + 1;
                  const isGuidance = item.guidanceShared === 'Yes' || item.guidanceShared === true;
                  const isTracker = item.trackerInUse === 'Yes' || item.trackerInUse === true;
                  const isPtDefault = item.publicTransportDefault === 'Yes' || item.publicTransportDefault === true;
                  const hasSg = item.hasSgConcerns === 'Yes' || item.hasSgConcerns === true;

                  return (
                    <tr 
                      key={item.id} 
                      className="hover:bg-[#f8f9fa] transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-neutral-400">{recordNo}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#242424] flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{item.siteName}</span>
                        </div>
                        <div className="text-neutral-500 text-[11px] mt-0.5">
                          Mgr: {item.siteManager}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-medium text-[#242424] flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{item.reportingPeriod}</span>
                        </div>
                        <div className="text-neutral-400 text-[10px] mt-0.5">
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isGuidance ? (
                          <span className="inline-flex items-center text-[#107c41] font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-0.5" /> Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[#a4262c] font-semibold text-[11px]">
                            <XCircle className="w-3.5 h-3.5 mr-0.5" /> No
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isTracker ? (
                          <span className="inline-flex items-center text-[#107c41] font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-0.5" /> Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[#a4262c] font-semibold text-[11px]">
                            <XCircle className="w-3.5 h-3.5 mr-0.5" /> No
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isPtDefault ? (
                          <span className="inline-flex items-center text-[#107c41] font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-0.5" /> Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[#d83b01] font-semibold text-[11px]">
                            <XCircle className="w-3.5 h-3.5 mr-0.5" /> No
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-[#8764b8]">
                        {item.ptJourneysCount || 0}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="font-semibold text-[#242424]">{item.taxiRequestsRaised || 0}</span>
                        <span className="text-neutral-400 mx-1">/</span>
                        <span className="text-[#107c41] font-semibold">{item.taxiRequestsApproved || 0}</span>
                        <span className="text-neutral-400 mx-1">/</span>
                        <span className="text-[#a4262c] font-semibold">{item.taxiRequestsDeclined || 0}</span>
                      </td>
                      <td className="py-2.5 px-3 max-w-[200px]">
                        <span className="block truncate font-medium text-[#242424]">
                          {item.siteChallenges || 'No major challenges noted'}
                        </span>
                        {item.commonIssues && (
                          <span className="block truncate text-neutral-500 text-[11px]">
                            Issues: {item.commonIssues}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {hasSg ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[10px] font-bold bg-[#fde7e9] text-[#a4262c] border border-[#f3b2b7]">
                            <ShieldAlert className="w-3 h-3 mr-1" /> Concerns
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[10px] font-medium bg-[#f3f2f1] text-[#605e5c] border border-[#e1dfdd]">
                            None
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingItem(item)}
                            className="p-1 hover:bg-[#edebe9] text-[#605e5c] hover:text-[#242424] rounded cursor-pointer"
                            title="View Summary Dossier"
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
                              onClick={() => deleteTransportChallengeRecord(item.id)}
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

      {/* CREATE / EDIT MODAL */}
      {(isCreateOpen || editingItem) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-6">
            <div className="px-4 py-3 bg-[#f3f2f1] border-b border-[#e1dfdd] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#8764b8]" />
                <h3 className="text-sm font-bold text-[#242424]">
                  {editingItem ? 'Edit Monthly Transport Operational Summary' : 'New Monthly Transport Operational Summary'}
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

                {/* Reporting Period */}
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">
                    Reporting Period (Month/Year) *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. October 2026 / Q4 2026"
                    value={formData.reportingPeriod || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, reportingPeriod: e.target.value }))}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    required
                  />
                </div>

                {/* PT Journeys Count */}
                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">
                    No. of Public Transport Journeys
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.ptJourneysCount ?? 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, ptJourneysCount: parseInt(e.target.value) || 0 }))}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                  />
                </div>
              </div>

              {/* Operational Policies Status */}
              <div className="p-3 bg-[#faf9f8] rounded-xs border border-[#e1dfdd] space-y-2">
                <span className="font-semibold text-[#323130] block text-xs">
                  Operational Adherence Checklist
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#323130]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.guidanceShared === 'Yes' || formData.guidanceShared === true}
                      onChange={(e) => setFormData(prev => ({ ...prev, guidanceShared: e.target.checked ? 'Yes' : 'No' }))}
                      className="rounded-xs text-[#8764b8] focus:ring-[#8764b8]"
                    />
                    <span>Transport Guidance Shared with SUs</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.trackerInUse === 'Yes' || formData.trackerInUse === true}
                      onChange={(e) => setFormData(prev => ({ ...prev, trackerInUse: e.target.checked ? 'Yes' : 'No' }))}
                      className="rounded-xs text-[#8764b8] focus:ring-[#8764b8]"
                    />
                    <span>Transport Tracker in Active Use</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.publicTransportDefault === 'Yes' || formData.publicTransportDefault === true}
                      onChange={(e) => setFormData(prev => ({ ...prev, publicTransportDefault: e.target.checked ? 'Yes' : 'No' }))}
                      className="rounded-xs text-[#8764b8] focus:ring-[#8764b8]"
                    />
                    <span>Public Transport Used as Default</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.taxiRestricted === 'Yes' || formData.taxiRestricted === true}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxiRestricted: e.target.checked ? 'Yes' : 'No' }))}
                      className="rounded-xs text-[#8764b8] focus:ring-[#8764b8]"
                    />
                    <span>Taxi Use Restricted to Exceptions</span>
                  </label>
                </div>
              </div>

              {/* Taxi Exception Statistics */}
              <div className="p-3 bg-[#fff8f0] rounded-xs border border-[#fed9cc] space-y-2">
                <span className="font-semibold text-[#8a3707] block text-xs">
                  Taxi Exception Tracking
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#605e5c] mb-1">
                      Raised
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.taxiRequestsRaised ?? 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxiRequestsRaised: parseInt(e.target.value) || 0 }))}
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#605e5c] mb-1">
                      Approved
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.taxiRequestsApproved ?? 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxiRequestsApproved: parseInt(e.target.value) || 0 }))}
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#107c41] font-semibold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#605e5c] mb-1">
                      Declined
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.taxiRequestsDeclined ?? 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxiRequestsDeclined: parseInt(e.target.value) || 0 }))}
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#a4262c] font-semibold text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Narrative fields */}
              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">
                  Main Site Challenges
                </label>
                <textarea
                  rows={2}
                  value={formData.siteChallenges || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, siteChallenges: e.target.value }))}
                  placeholder="Outline logistical or route challenges faced by the property this month..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">
                  Common Transport Issues
                </label>
                <textarea
                  rows={2}
                  value={formData.commonIssues || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, commonIssues: e.target.value }))}
                  placeholder="e.g. repeated bus route changes, Aspen tap failures, language barriers..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">
                  Team Feedback on Transport Process
                </label>
                <textarea
                  rows={2}
                  value={formData.teamFeedback || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, teamFeedback: e.target.value }))}
                  placeholder="Staff observations, user sentiment, training needs..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                />
              </div>

              {/* Safeguarding Section */}
              <div className="p-3 bg-[#fde7e9] rounded-xs border border-[#f3b2b7] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#a4262c]" />
                    <span className="text-xs font-semibold text-[#a4262c]">
                      Safeguarding (SG) Concerns Flagged?
                    </span>
                  </div>
                  <select
                    value={formData.hasSgConcerns === 'Yes' || formData.hasSgConcerns === true ? 'Yes' : 'No'}
                    onChange={(e) => setFormData(prev => ({ ...prev, hasSgConcerns: e.target.value as 'Yes' | 'No' }))}
                    className="p-1.5 text-xs rounded-xs border border-[#f3b2b7] bg-white font-semibold text-[#a4262c]"
                  >
                    <option value="No">No Concerns</option>
                    <option value="Yes">Yes (Concerns Raised)</option>
                  </select>
                </div>
                {(formData.hasSgConcerns === 'Yes' || formData.hasSgConcerns === true) && (
                  <div>
                    <label className="block text-[11px] font-medium text-[#a4262c] mb-1">
                      Safeguarding Details & Actions Taken
                    </label>
                    <textarea
                      rows={2}
                      value={formData.sgDetails || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, sgDetails: e.target.value }))}
                      placeholder="Detail safeguarding risks identified and mitigations initiated..."
                      className="w-full p-2 text-xs rounded-xs border border-[#f3b2b7] bg-white text-[#323130]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold text-[#605e5c] block mb-1">
                  Additional Comments
                </label>
                <textarea
                  rows={2}
                  value={formData.comments || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                  placeholder="Any further management notes..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                />
              </div>

              <div className="px-4 py-3 bg-[#faf9f8] border-t border-[#edebe9] flex items-center justify-end gap-2 shrink-0 -mx-4 -mb-4 mt-2">
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); setEditingItem(null); }}
                  className="px-3 py-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] hover:bg-[#f3f2f1] text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#8764b8] hover:bg-[#744da9] text-white rounded-xs text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  {editingItem ? 'Save Changes' : 'Record Monthly Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DOSSIER MODAL */}
      {viewingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-6">
            <div className="px-4 py-3 bg-[#f3f2f1] border-b border-[#e1dfdd] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-[#242424]">
                  Site Transport Operations Dossier
                </h3>
                <span className="text-xs text-neutral-500">{viewingItem.siteName} • {viewingItem.reportingPeriod}</span>
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
                  <span className="text-neutral-500 block text-[11px]">Site Manager</span>
                  <span className="font-semibold text-[#242424]">{viewingItem.siteManager}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">PT Journeys</span>
                  <span className="font-bold text-[#8764b8] text-sm">{viewingItem.ptJourneysCount || 0}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">Taxi Raised / Appr</span>
                  <span className="font-semibold text-[#242424]">
                    {viewingItem.taxiRequestsRaised || 0} / {viewingItem.taxiRequestsApproved || 0}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[11px]">SG Flag</span>
                  <span className={`font-semibold ${viewingItem.hasSgConcerns === 'Yes' || viewingItem.hasSgConcerns === true ? 'text-[#a4262c]' : 'text-[#107c41]'}`}>
                    {viewingItem.hasSgConcerns === 'Yes' || viewingItem.hasSgConcerns === true ? 'Concerns Flagged' : 'No Concerns'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-semibold text-[#605e5c]">Adherence & Controls</div>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xs border border-[#e1dfdd] bg-[#faf9f8]">
                  <div>Guidance Shared: <span className="font-semibold text-[#242424]">{viewingItem.guidanceShared || 'No'}</span></div>
                  <div>Tracker In Use: <span className="font-semibold text-[#242424]">{viewingItem.trackerInUse || 'No'}</span></div>
                  <div>PT Default: <span className="font-semibold text-[#242424]">{viewingItem.publicTransportDefault || 'No'}</span></div>
                  <div>Taxi Restricted: <span className="font-semibold text-[#242424]">{viewingItem.taxiRestricted || 'No'}</span></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-semibold text-[#605e5c]">Narrative Summary</div>
                <div className="p-3 rounded-xs border border-[#e1dfdd] space-y-2">
                  <div>
                    <span className="text-neutral-500 block">Main Site Challenges:</span>
                    <p className="mt-0.5 whitespace-pre-wrap text-[#242424]">{viewingItem.siteChallenges || 'None reported'}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Common Transport Issues:</span>
                    <p className="mt-0.5 whitespace-pre-wrap text-[#242424]">{viewingItem.commonIssues || 'None reported'}</p>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Team Feedback:</span>
                    <p className="mt-0.5 whitespace-pre-wrap text-[#242424]">{viewingItem.teamFeedback || 'None reported'}</p>
                  </div>
                  {viewingItem.sgDetails && (
                    <div className="p-2.5 bg-[#fde7e9] rounded-xs border border-[#f3b2b7]">
                      <span className="text-[#a4262c] font-semibold block">Safeguarding Details:</span>
                      <p className="mt-0.5 whitespace-pre-wrap text-[#a4262c]">{viewingItem.sgDetails}</p>
                    </div>
                  )}
                  {viewingItem.comments && (
                    <div>
                      <span className="text-neutral-500 block">Additional Comments:</span>
                      <p className="mt-0.5 whitespace-pre-wrap text-[#242424]">{viewingItem.comments}</p>
                    </div>
                  )}
                </div>
              </div>
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
