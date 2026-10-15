import React, { useState, useMemo, useEffect } from 'react';
import { 
  Utensils, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Inbox, 
  Download,
  Filter,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FoodConsumptionReport, FoodConsumptionItem, FoodBoxRequest } from '../../types';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';

const DEFAULT_BREAKFAST_ITEMS = [
  'Eggs', 'Bread', 'Milk', 'Cereal', 'Cheese', 'Butter', 'Juice', 'Jam'
];

const DEFAULT_LUNCH_ITEMS = [
  'Southern fried chicken', 'Southern fried tofu', 'Salad', 'Chips'
];

const DEFAULT_DINNER_ITEMS = [
  'Beef massaman curry', 'Cauliflower massaman curry', 'Rice', 'Salad'
];

const foodConsumptionExportColumns: ExportColumnOption[] = [
  { id: 'date', label: 'Date' },
  { id: 'site', label: 'Hotel / Property' },
  { id: 'itemsCount', label: 'Total Items Recorded' },
  { id: 'avgRating', label: 'Avg Rating (1-10)' },
  { id: 'feedbackComments', label: 'Overall Feedback / Comments' },
  { id: 'reportedBy', label: 'Reported By' }
];

const foodBoxExportColumns: ExportColumnOption[] = [
  { id: 'date', label: 'Date' },
  { id: 'site', label: 'Hotel / Property' },
  { id: 'roomNo', label: 'Room No.' },
  { id: 'type', label: 'Type' },
  { id: 'reason', label: 'Reason / Special Diet Requirements' },
  { id: 'status', label: 'Status' },
  { id: 'remarks', label: 'Remarks / Resolution' }
];

export interface FoodConsumptionViewProps {
  initialTab?: 'daily_report' | 'box_requests';
  showInternalTabs?: boolean;
}

export const FoodConsumptionView: React.FC<FoodConsumptionViewProps> = ({
  initialTab = 'daily_report',
  showInternalTabs = true
}) => {
  const {
    foodConsumptionReports,
    addFoodConsumptionReport,
    updateFoodConsumptionReport,
    deleteFoodConsumptionReport,
    foodBoxRequests,
    addFoodBoxRequest,
    updateFoodBoxRequest,
    deleteFoodBoxRequest,
    allowedSites,
    assignedSite,
    canAccessAllSites,
    isSitePermitted,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    requestConfirmation
  } = useApp();

  const [activeTab, setActiveTab] = useState<'daily_report' | 'box_requests'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [siteFilter, setSiteFilter] = useState(() => {
    if (assignedSite && assignedSite !== 'All Sites' && assignedSite !== 'all') return assignedSite;
    return 'all';
  });

  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [boxSearchQuery, setBoxSearchQuery] = useState('');
  const [boxStatusFilter, setBoxStatusFilter] = useState('all');
  const [boxTypeFilter, setBoxTypeFilter] = useState('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (assignedSite === 'All Sites' || assignedSite === 'all') {
      if (canAccessAllSites() || (allowedSites && allowedSites.length > 1)) {
        setSiteFilter('all');
      }
    } else if (assignedSite) {
      setSiteFilter(assignedSite);
    }
  }, [assignedSite, canAccessAllSites, allowedSites]);

  // Modal states for Daily Food Report
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<FoodConsumptionReport | null>(null);
  const [viewingReport, setViewingReport] = useState<FoodConsumptionReport | null>(null);

  // Modal states for Food Box Requests / Complaints
  const [isBoxModalOpen, setIsBoxModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<FoodBoxRequest | null>(null);

  // Interactive items for Report modal
  const [currentItems, setCurrentItems] = useState<FoodConsumptionItem[]>([]);
  const [feedbackComments, setFeedbackComments] = useState('Menu Satisfactory.');

  const initReportItems = () => {
    const items: FoodConsumptionItem[] = [];
    DEFAULT_BREAKFAST_ITEMS.forEach((it, i) => {
      items.push({
        id: `bf-${Date.now()}-${i}`,
        meal: 'Breakfast',
        item: it,
        quantityVol: '',
        consumptionPercent: '100%',
        binnedPercent: '0%',
        rating: '8',
        remarks: ''
      });
    });
    DEFAULT_LUNCH_ITEMS.forEach((it, i) => {
      items.push({
        id: `lu-${Date.now()}-${i}`,
        meal: 'Lunch',
        item: it,
        quantityVol: '1 Tray',
        consumptionPercent: '100%',
        binnedPercent: '0%',
        rating: '7',
        remarks: ''
      });
    });
    DEFAULT_DINNER_ITEMS.forEach((it, i) => {
      items.push({
        id: `di-${Date.now()}-${i}`,
        meal: 'Dinner',
        item: it,
        quantityVol: '1 Tray',
        consumptionPercent: '100%',
        binnedPercent: '0%',
        rating: '7',
        remarks: ''
      });
    });
    setCurrentItems(items);
    setFeedbackComments('Menu Satisfactory.');
  };

  const handleOpenCreateReport = () => {
    initReportItems();
    setIsReportModalOpen(true);
  };

  const handleAddItem = (meal: 'Breakfast' | 'Lunch' | 'Dinner') => {
    setCurrentItems(prev => [
      ...prev,
      {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        meal,
        item: '',
        quantityVol: meal === 'Breakfast' ? '1 Portion' : '1 Tray',
        consumptionPercent: '100%',
        binnedPercent: '0%',
        rating: '8',
        remarks: ''
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setCurrentItems(prev => prev.filter((_, i) => i !== index));
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    return (foodConsumptionReports || []).filter(r => {
      if (!isSitePermitted(r.site, siteFilter)) return false;
      if (selectedDate && r.date !== selectedDate) return false;
      if (reportSearchQuery.trim()) {
        const query = reportSearchQuery.toLowerCase();
        const text = `${r.site} ${r.feedbackComments || ''} ${r.reportedBy || ''} ${(r.items || []).map(i => `${i.item} ${i.meal} ${i.remarks || ''}`).join(' ')}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [foodConsumptionReports, isSitePermitted, siteFilter, selectedDate, reportSearchQuery]);

  // Filtered box requests
  const filteredBoxRequests = useMemo(() => {
    return (foodBoxRequests || []).filter(b => {
      if (!isSitePermitted(b.site, siteFilter)) return false;
      if (boxStatusFilter !== 'all' && b.status !== boxStatusFilter) return false;
      if (boxTypeFilter !== 'all' && b.type !== boxTypeFilter) return false;
      if (boxSearchQuery.trim()) {
        const query = boxSearchQuery.toLowerCase();
        const text = `${b.roomNo} ${b.site} ${b.type} ${b.reason} ${b.status} ${b.remarks || ''}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [foodBoxRequests, isSitePermitted, siteFilter, boxStatusFilter, boxTypeFilter, boxSearchQuery]);

  const paginatedBoxRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBoxRequests.slice(start, start + pageSize);
  }, [filteredBoxRequests, currentPage, pageSize]);

  // Export handlers
  const handleExportReports = (opts: {
    format: ExportFormat;
    scope: ExportScope;
    orientation: ExportOrientation;
    selectedColumns?: string[];
  }) => {
    const raw = filteredReports;
    const selectedCols = opts.selectedColumns && opts.selectedColumns.length > 0
      ? foodConsumptionExportColumns.filter(c => opts.selectedColumns!.includes(c.id))
      : foodConsumptionExportColumns;

    const headers = selectedCols.map(c => c.label);
    const rows = raw.map(row => {
      const items = row.items || [];
      const ratings = items.map(i => Number(i.rating)).filter(n => !isNaN(n) && n > 0);
      const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '—';
      return selectedCols.map(c => {
        if (c.id === 'itemsCount') return String(items.length);
        if (c.id === 'avgRating') return avg;
        return String((row as any)[c.id] ?? '');
      });
    });

    if (opts.format === 'csv') {
      exportTableToCsv({
        filename: `food_consumption_reports_${selectedDate || 'all'}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: `Food Consumption Reports – ${selectedDate || 'All Dates'}`,
        headers,
        rows,
        filename: `food_consumption_reports_${selectedDate || 'all'}.pdf`,
        orientation: opts.orientation
      });
    }
  };

  const handleExportBoxes = (opts: {
    format: ExportFormat;
    scope: ExportScope;
    orientation: ExportOrientation;
    selectedColumns?: string[];
  }) => {
    const raw = filteredBoxRequests;
    const selectedCols = opts.selectedColumns && opts.selectedColumns.length > 0
      ? foodBoxExportColumns.filter(c => opts.selectedColumns!.includes(c.id))
      : foodBoxExportColumns;

    const headers = selectedCols.map(c => c.label);
    const rows = raw.map(row => selectedCols.map(c => String((row as any)[c.id] ?? '')));

    if (opts.format === 'csv') {
      exportTableToCsv({
        filename: `food_box_requests_${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: `Food Box Requests & Complaints Register`,
        headers,
        rows,
        filename: `food_box_requests_${new Date().toISOString().slice(0, 10)}.pdf`,
        orientation: opts.orientation
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls Card */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xs bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#1e293b] flex items-center gap-2">
                Food Consumption (In & Out) Log
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Pier Avenue Standard
                </span>
              </h1>
              <p className="text-xs text-[#64748b]">
                Record daily Breakfast, Lunch, and Dinner meal consumption, binned percentages, ratings, and manage special dietary food boxes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'daily_report' && (
              <>
                <ExportDropdown
                  moduleName="Food Consumption Reports"
                  onExport={handleExportReports}
                  availableColumns={foodConsumptionExportColumns}
                  totalRecordCount={foodConsumptionReports.length}
                  filteredRecordCount={filteredReports.length}
                />
                {canCreateRecord() && (
                  <button
                    onClick={handleOpenCreateReport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New Daily Food Report
                  </button>
                )}
              </>
            )}

            {activeTab === 'box_requests' && (
              <>
                <ExportDropdown
                  moduleName="Food Box Requests"
                  onExport={handleExportBoxes}
                  availableColumns={foodBoxExportColumns}
                  totalRecordCount={foodBoxRequests.length}
                  filteredRecordCount={filteredBoxRequests.length}
                />
                {canCreateRecord() && (
                  <button
                    onClick={() => {
                      setEditingBox(null);
                      setIsBoxModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Food Box / Complaint
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Optional Internal Sub-Tabs if not rendered inside FoodView */}
        {showInternalTabs && (
          <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xs border border-[#e2e8f0] mt-4">
            <button
              onClick={() => setActiveTab('daily_report')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold transition-all ${
                activeTab === 'daily_report'
                  ? 'bg-white text-[#0d9488] shadow-2xs border border-[#cbd5e1]'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Daily Food Consumption Reports ({foodConsumptionReports.length})
            </button>
            <button
              onClick={() => setActiveTab('box_requests')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold transition-all ${
                activeTab === 'box_requests'
                  ? 'bg-white text-[#0d9488] shadow-2xs border border-[#cbd5e1]'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              Food Box Requests & Special Diets ({foodBoxRequests.length})
            </button>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[#f1f5f9] items-center">
          {activeTab === 'daily_report' ? (
            <>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[#94a3b8]" />
                <input
                  type="text"
                  placeholder="Search item, remarks, hotel..."
                  value={reportSearchQuery}
                  onChange={e => setReportSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden"
                />
              </div>

              <div>
                <select
                  value={siteFilter}
                  onChange={e => setSiteFilter(e.target.value)}
                  disabled={!canAccessAllSites() && (allowedSites || []).length <= 1}
                  className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden font-semibold text-[#1e293b]"
                >
                  {(canAccessAllSites() || (allowedSites && allowedSites.length > 1)) && (
                    <option value="all">
                      {canAccessAllSites() ? `All Properties (${allowedSites.length})` : `All Assigned Sites (${allowedSites.length})`}
                    </option>
                  )}
                  {allowedSites.map((s, idx) => (
                    <option key={`${s}-${idx}`} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden font-semibold text-[#1e293b]"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xs border border-slate-300 transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-600 rounded-xs border border-slate-300 transition-colors"
                >
                  View All Dates
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[#94a3b8]" />
                <input
                  type="text"
                  placeholder="Search room no, reason, site..."
                  value={boxSearchQuery}
                  onChange={e => { setBoxSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden"
                />
              </div>

              <div>
                <select
                  value={siteFilter}
                  onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); }}
                  disabled={!canAccessAllSites() && (allowedSites || []).length <= 1}
                  className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden font-semibold text-[#1e293b]"
                >
                  {(canAccessAllSites() || (allowedSites && allowedSites.length > 1)) && (
                    <option value="all">
                      {canAccessAllSites() ? `All Properties (${allowedSites.length})` : `All Assigned Sites (${allowedSites.length})`}
                    </option>
                  )}
                  {allowedSites.map((s, idx) => (
                    <option key={`${s}-${idx}`} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={boxTypeFilter}
                  onChange={e => { setBoxTypeFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden"
                >
                  <option value="all">All Request Types</option>
                  <option value="Request">Request</option>
                  <option value="Complaint">Complaint</option>
                  <option value="Special Box">Special Box</option>
                  <option value="Dietary Adjustment">Dietary Adjustment</option>
                </select>
              </div>

              <div>
                <select
                  value={boxStatusFilter}
                  onChange={e => { setBoxStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden"
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Active">Active</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: DAILY FOOD CONSUMPTION REPORT */}
      {activeTab === 'daily_report' && (
        <div className="space-y-4">
          {filteredReports.length === 0 ? (
            <div className="bg-white border border-[#e5e5e5] rounded-xs p-8 text-center shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <Utensils className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#1e293b]">
                No Food Consumption Report Found for {selectedDate || 'the selected criteria'}
              </h3>
              <p className="text-xs text-[#64748b] max-w-md mx-auto">
                No daily logs match your filter. You can initialize a new daily report with standard Breakfast, Lunch, and Dinner dishes ready to record.
              </p>
              {canCreateRecord() && (
                <button
                  onClick={handleOpenCreateReport}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Daily Food Report Now
                </button>
              )}
            </div>
          ) : (
            filteredReports.map(report => {
              const items = report.items || [];
              const breakfastItems = items.filter(i => i.meal === 'Breakfast');
              const lunchItems = items.filter(i => i.meal === 'Lunch');
              const dinnerItems = items.filter(i => i.meal === 'Dinner');

              const ratings = items.map(i => Number(i.rating)).filter(n => !isNaN(n) && n > 0);
              const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '—';

              const canEdit = canEditRecord(report.site);
              const canDelete = canDeleteRecord();

              return (
                <div key={report.id} className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden">
                  {/* Card Header */}
                  <div className="p-4 bg-[#f8fafc] border-b border-[#e2e8f0] flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#1e293b]">{report.site}</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                          Date: {report.date}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Avg Rating: {avgRating} / 10
                        </span>
                      </div>
                      <p className="text-xs text-[#64748b] mt-1 flex items-center gap-2">
                        <span>Feedback / Comments:</span>
                        <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {report.feedbackComments || 'Menu Satisfactory.'}
                        </span>
                        {report.reportedBy && (
                          <span className="text-[11px] text-slate-500">
                            (Reported by: {report.reportedBy})
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setViewingReport(report)}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xs border border-slate-300 flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Dossier
                      </button>

                      {canEdit && (
                        <button
                          onClick={() => {
                            setEditingReport(report);
                            setCurrentItems(report.items || []);
                            setFeedbackComments(report.feedbackComments || 'Menu Satisfactory.');
                            setIsReportModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xs border border-amber-300 flex items-center gap-1 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit Report
                        </button>
                      )}

                      {canDelete && (
                        <button
                          onClick={() => {
                            requestConfirmation({
                              title: 'Delete Food Report',
                              message: `Permanently delete Food Consumption Report for ${report.site} on ${report.date}?`,
                              confirmLabel: 'Delete Report',
                              isDanger: true,
                              onConfirm: async () => deleteFoodConsumptionReport(report.id)
                            });
                          }}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xs border border-transparent hover:border-rose-200 transition-colors"
                          title="Delete Report"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Complete Breakfast, Lunch & Dinner Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#f1f5f9] text-[#475569] font-bold border-b border-[#e2e8f0]">
                        <tr>
                          <th className="py-2.5 px-3">Meal Category</th>
                          <th className="py-2.5 px-3">Items / Dishes</th>
                          <th className="py-2.5 px-3">Quantity / Vol</th>
                          <th className="py-2.5 px-3">Consumption (%)</th>
                          <th className="py-2.5 px-3">Binned (%)</th>
                          <th className="py-2.5 px-3">Rating (01-10)</th>
                          <th className="py-2.5 px-3">Remarks / Resident Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f5f9]">
                        {/* Breakfast Section */}
                        {breakfastItems.map((it, idx) => (
                          <tr key={`bf-${idx}`} className="hover:bg-amber-50/20">
                            {idx === 0 && (
                              <td rowSpan={breakfastItems.length} className="py-2.5 px-3 font-bold text-amber-700 bg-amber-50/40 border-r border-[#f1f5f9] align-top">
                                Breakfast ({breakfastItems.length})
                              </td>
                            )}
                            <td className="py-2 px-3 font-semibold text-[#1e293b]">{it.item}</td>
                            <td className="py-2 px-3 text-[#64748b]">{it.quantityVol || '—'}</td>
                            <td className="py-2 px-3 font-bold text-emerald-700">{it.consumptionPercent}</td>
                            <td className="py-2 px-3 font-bold text-rose-600">{it.binnedPercent}</td>
                            <td className="py-2 px-3 font-bold text-slate-800">{it.rating}</td>
                            <td className="py-2 px-3 text-[#64748b]">{it.remarks || '—'}</td>
                          </tr>
                        ))}

                        {/* Lunch Section */}
                        {lunchItems.map((it, idx) => (
                          <tr key={`lu-${idx}`} className="hover:bg-emerald-50/20">
                            {idx === 0 && (
                              <td rowSpan={lunchItems.length} className="py-2.5 px-3 font-bold text-emerald-700 bg-emerald-50/40 border-r border-[#f1f5f9] align-top">
                                Lunch ({lunchItems.length})
                              </td>
                            )}
                            <td className="py-2 px-3 font-semibold text-[#1e293b]">{it.item}</td>
                            <td className="py-2 px-3 text-[#64748b]">{it.quantityVol || '—'}</td>
                            <td className="py-2 px-3 font-bold text-emerald-700">{it.consumptionPercent}</td>
                            <td className="py-2 px-3 font-bold text-rose-600">{it.binnedPercent}</td>
                            <td className="py-2 px-3 font-bold text-slate-800">{it.rating}</td>
                            <td className="py-2 px-3 text-[#64748b]">{it.remarks || '—'}</td>
                          </tr>
                        ))}

                        {/* Dinner Section */}
                        {dinnerItems.map((it, idx) => (
                          <tr key={`di-${idx}`} className="hover:bg-sky-50/20">
                            {idx === 0 && (
                              <td rowSpan={dinnerItems.length} className="py-2.5 px-3 font-bold text-sky-700 bg-sky-50/40 border-r border-[#f1f5f9] align-top">
                                Dinner ({dinnerItems.length})
                              </td>
                            )}
                            <td className="py-2 px-3 font-semibold text-[#1e293b]">{it.item}</td>
                            <td className="py-2 px-3 text-[#64748b]">{it.quantityVol || '—'}</td>
                            <td className="py-2 px-3 font-bold text-emerald-700">{it.consumptionPercent}</td>
                            <td className="py-2 px-3 font-bold text-rose-600">{it.binnedPercent}</td>
                            <td className="py-2 px-3 font-bold text-slate-800">{it.rating}</td>
                            <td className="py-2 px-3 text-[#64748b]">{it.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: FOOD BOX REQUESTS & COMPLAINTS */}
      {activeTab === 'box_requests' && (
        <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden flex flex-col justify-between min-h-[400px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Date</th>
                  <th className="py-2.5 px-3 font-semibold">Hotel / Property</th>
                  <th className="py-2.5 px-3 font-semibold">Room No.</th>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Reason / Special Requirements</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {paginatedBoxRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#94a3b8]">
                      No food box requests or complaints found for current filters. Click "Add Food Box / Complaint" to register special diet requests.
                    </td>
                  </tr>
                ) : (
                  paginatedBoxRequests.map(box => {
                    const canEdit = canEditRecord(box.site);
                    const canDelete = canDeleteRecord();

                    return (
                      <tr key={box.id} className="hover:bg-[#f8fafc] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[#1e293b]">{box.date}</td>
                        <td className="py-2.5 px-3 text-[#475569]">{box.site}</td>
                        <td className="py-2.5 px-3 font-bold text-[#1e293b]">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            {box.roomNo.toLowerCase().startsWith('room') ? box.roomNo : `Room ${box.roomNo}`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            box.type === 'Complaint' 
                              ? 'bg-rose-50 text-rose-700 border-rose-200' 
                              : box.type === 'Special Box'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-teal-50 text-teal-700 border-teal-200'
                          }`}>
                            {box.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-md text-[#334155] font-medium">
                          {box.reason}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            box.status === 'Resolved' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : box.status === 'Active'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {box.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {canEdit && (
                              <button
                                onClick={() => {
                                  setEditingBox(box);
                                  setIsBoxModalOpen(true);
                                }}
                                className="p-1 text-[#64748b] hover:text-amber-600 hover:bg-amber-50 rounded"
                                title="Edit box request"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}

                            {canDelete && (
                              <button
                                onClick={() => {
                                  requestConfirmation({
                                    title: 'Delete Food Box Request',
                                    message: `Permanently delete special food box entry for ${box.roomNo}?`,
                                    confirmLabel: 'Delete Entry',
                                    isDanger: true,
                                    onConfirm: async () => deleteFoodBoxRequest(box.id)
                                  });
                                }}
                                className="p-1 text-[#64748b] hover:text-rose-600 hover:bg-rose-50 rounded"
                                title="Delete box request"
                              >
                                <Trash2 className="w-4 h-4" />
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

          <div className="p-3 border-t border-[#e2e8f0] bg-white">
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={filteredBoxRequests.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
            />
          </div>
        </div>
      )}

      {/* CREATE / EDIT FOOD CONSUMPTION REPORT MODAL */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xs shadow-xl border border-[#cbd5e1] max-w-5xl w-full max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#1e293b]">
                  {editingReport ? 'Edit Daily Food Consumption Report' : 'New Daily Food Consumption Report (In & Out)'}
                </h2>
                <p className="text-xs text-[#64748b]">
                  Fill in quantities, consumption %, binned %, and ratings (01-10) for Breakfast, Lunch, and Dinner.
                </p>
              </div>
              <button 
                onClick={() => { setIsReportModalOpen(false); setEditingReport(null); }} 
                className="font-bold text-[#64748b] hover:text-[#1e293b] p-1 text-lg"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);

                const data = {
                  date: (formData.get('date') as string) || selectedDate,
                  site: (formData.get('site') as string) || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || '')),
                  items: currentItems,
                  feedbackComments: feedbackComments,
                  reportedBy: (formData.get('reportedBy') as string) || currentUserRole || 'Staff Member'
                };

                if (editingReport) {
                  updateFoodConsumptionReport(editingReport.id, data);
                } else {
                  addFoodConsumptionReport(data);
                }

                setIsReportModalOpen(false);
                setEditingReport(null);
              }}
              className="flex-1 overflow-y-auto p-5 space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xs border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Date</label>
                  <input
                    type="date"
                    name="date"
                    defaultValue={editingReport?.date || selectedDate || new Date().toISOString().slice(0, 10)}
                    required
                    className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Hotel / Property</label>
                  <select
                    name="site"
                    defaultValue={editingReport?.site || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || ''))}
                    required
                    className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded-xs font-semibold"
                  >
                    {allowedSites.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Reported By</label>
                  <input
                    type="text"
                    name="reportedBy"
                    defaultValue={editingReport?.reportedBy || currentUserRole || 'Staff Member'}
                    required
                    className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded-xs font-semibold"
                  />
                </div>
              </div>

              {/* Breakfast Matrix */}
              <div className="border border-amber-200 rounded-xs overflow-hidden">
                <div className="bg-amber-100/70 px-3 py-2 flex items-center justify-between border-b border-amber-200">
                  <span className="font-bold text-amber-900">Breakfast Monitoring</span>
                  <button
                    type="button"
                    onClick={() => handleAddItem('Breakfast')}
                    className="px-2 py-1 bg-white hover:bg-amber-50 text-amber-800 text-[11px] font-bold rounded border border-amber-300 flex items-center gap-1 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" /> Add Breakfast Item
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-amber-50/50 font-bold text-[#475569] border-b border-amber-100">
                      <tr>
                        <th className="p-2 text-left">Item / Dish</th>
                        <th className="p-2 text-left">Quantity/Vol</th>
                        <th className="p-2 text-left">Consumption (%)</th>
                        <th className="p-2 text-left">Binned (%)</th>
                        <th className="p-2 text-left">Rating (01-10)</th>
                        <th className="p-2 text-left">Remarks</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100/60">
                      {currentItems.map((item, idx) => {
                        if (item.meal !== 'Breakfast') return null;
                        return (
                          <tr key={idx} className="hover:bg-amber-50/30">
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.item}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, item: val } : r));
                                }}
                                className="w-full px-2 py-1 border border-[#cbd5e1] rounded font-semibold bg-white"
                                placeholder="Item name"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.quantityVol}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, quantityVol: val } : r));
                                }}
                                className="w-24 px-2 py-1 border border-[#cbd5e1] rounded bg-white"
                                placeholder="e.g. 1 Portion"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.consumptionPercent}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, consumptionPercent: val } : r));
                                }}
                                className="w-20 px-2 py-1 border border-[#cbd5e1] rounded font-semibold text-emerald-700 bg-white"
                                placeholder="100%"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.binnedPercent}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, binnedPercent: val } : r));
                                }}
                                className="w-20 px-2 py-1 border border-[#cbd5e1] rounded font-semibold text-rose-700 bg-white"
                                placeholder="0%"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.rating}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, rating: val } : r));
                                }}
                                className="w-16 px-2 py-1 border border-[#cbd5e1] rounded font-bold text-center bg-white"
                                placeholder="0-10"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.remarks || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, remarks: val } : r));
                                }}
                                className="w-full px-2 py-1 border border-[#cbd5e1] rounded bg-white"
                                placeholder="Remarks..."
                              />
                            </td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Lunch Matrix */}
              <div className="border border-emerald-200 rounded-xs overflow-hidden">
                <div className="bg-emerald-100/70 px-3 py-2 flex items-center justify-between border-b border-emerald-200">
                  <span className="font-bold text-emerald-900">Lunch Monitoring</span>
                  <button
                    type="button"
                    onClick={() => handleAddItem('Lunch')}
                    className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded border border-emerald-300 flex items-center gap-1 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" /> Add Lunch Item
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-emerald-50/50 font-bold text-[#475569] border-b border-emerald-100">
                      <tr>
                        <th className="p-2 text-left">Item / Dish</th>
                        <th className="p-2 text-left">Quantity/Vol</th>
                        <th className="p-2 text-left">Consumption (%)</th>
                        <th className="p-2 text-left">Binned (%)</th>
                        <th className="p-2 text-left">Rating (01-10)</th>
                        <th className="p-2 text-left">Remarks</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100/60">
                      {currentItems.map((item, idx) => {
                        if (item.meal !== 'Lunch') return null;
                        return (
                          <tr key={idx} className="hover:bg-emerald-50/30">
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.item}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, item: val } : r));
                                }}
                                className="w-full px-2 py-1 border border-[#cbd5e1] rounded font-semibold bg-white"
                                placeholder="Item name"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.quantityVol}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, quantityVol: val } : r));
                                }}
                                className="w-24 px-2 py-1 border border-[#cbd5e1] rounded bg-white"
                                placeholder="e.g. 1 Tray"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.consumptionPercent}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, consumptionPercent: val } : r));
                                }}
                                className="w-20 px-2 py-1 border border-[#cbd5e1] rounded font-semibold text-emerald-700 bg-white"
                                placeholder="100%"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.binnedPercent}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, binnedPercent: val } : r));
                                }}
                                className="w-20 px-2 py-1 border border-[#cbd5e1] rounded font-semibold text-rose-700 bg-white"
                                placeholder="0%"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.rating}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, rating: val } : r));
                                }}
                                className="w-16 px-2 py-1 border border-[#cbd5e1] rounded font-bold text-center bg-white"
                                placeholder="0-10"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.remarks || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, remarks: val } : r));
                                }}
                                className="w-full px-2 py-1 border border-[#cbd5e1] rounded bg-white"
                                placeholder="Remarks..."
                              />
                            </td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dinner Matrix */}
              <div className="border border-sky-200 rounded-xs overflow-hidden">
                <div className="bg-sky-100/70 px-3 py-2 flex items-center justify-between border-b border-sky-200">
                  <span className="font-bold text-sky-900">Dinner Monitoring</span>
                  <button
                    type="button"
                    onClick={() => handleAddItem('Dinner')}
                    className="px-2 py-1 bg-white hover:bg-sky-50 text-sky-800 text-[11px] font-bold rounded border border-sky-300 flex items-center gap-1 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" /> Add Dinner Item
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-sky-50/50 font-bold text-[#475569] border-b border-sky-100">
                      <tr>
                        <th className="p-2 text-left">Item / Dish</th>
                        <th className="p-2 text-left">Quantity/Vol</th>
                        <th className="p-2 text-left">Consumption (%)</th>
                        <th className="p-2 text-left">Binned (%)</th>
                        <th className="p-2 text-left">Rating (01-10)</th>
                        <th className="p-2 text-left">Remarks</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100/60">
                      {currentItems.map((item, idx) => {
                        if (item.meal !== 'Dinner') return null;
                        return (
                          <tr key={idx} className="hover:bg-sky-50/30">
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.item}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, item: val } : r));
                                }}
                                className="w-full px-2 py-1 border border-[#cbd5e1] rounded font-semibold bg-white"
                                placeholder="Item name"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.quantityVol}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, quantityVol: val } : r));
                                }}
                                className="w-24 px-2 py-1 border border-[#cbd5e1] rounded bg-white"
                                placeholder="e.g. 1 Tray"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.consumptionPercent}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, consumptionPercent: val } : r));
                                }}
                                className="w-20 px-2 py-1 border border-[#cbd5e1] rounded font-semibold text-emerald-700 bg-white"
                                placeholder="100%"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.binnedPercent}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, binnedPercent: val } : r));
                                }}
                                className="w-20 px-2 py-1 border border-[#cbd5e1] rounded font-semibold text-rose-700 bg-white"
                                placeholder="0%"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.rating}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, rating: val } : r));
                                }}
                                className="w-16 px-2 py-1 border border-[#cbd5e1] rounded font-bold text-center bg-white"
                                placeholder="0-10"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.remarks || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, remarks: val } : r));
                                }}
                                className="w-full px-2 py-1 border border-[#cbd5e1] rounded bg-white"
                                placeholder="Remarks..."
                              />
                            </td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Feedback Comments */}
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase mb-1">
                  Overall Menu Feedback / Resident Comments
                </label>
                <input
                  type="text"
                  value={feedbackComments}
                  onChange={e => setFeedbackComments(e.target.value)}
                  placeholder="e.g. Menu Satisfactory. Special diets fulfilled."
                  className="w-full px-3 py-2 border border-[#cbd5e1] rounded font-semibold bg-emerald-50/40 text-slate-800"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#e2e8f0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsReportModalOpen(false); setEditingReport(null); }}
                  className="px-4 py-2 border border-[#cbd5e1] rounded-xs text-xs font-semibold text-[#475569] hover:bg-[#f8fafc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs"
                >
                  {editingReport ? 'Save Report Changes' : 'Save Daily Food Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW FULL REPORT DOSSIER MODAL */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xs shadow-xl border border-[#cbd5e1] max-w-4xl w-full p-5 space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-[#1e293b]">
                  Daily Food Consumption Report – {viewingReport.site}
                </h2>
                <p className="text-xs text-[#64748b]">
                  Date: {viewingReport.date} | Reported by: {viewingReport.reportedBy || 'Staff'}
                </p>
              </div>
              <button onClick={() => setViewingReport(null)} className="font-bold text-[#64748b] hover:text-[#1e293b] p-1 text-lg">
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded border border-slate-200">
              <div><span className="font-bold text-slate-700">Date:</span> {viewingReport.date}</div>
              <div><span className="font-bold text-slate-700">Hotel:</span> {viewingReport.site}</div>
              <div><span className="font-bold text-slate-700">Feedback:</span> {viewingReport.feedbackComments || 'Menu Satisfactory.'}</div>
            </div>

            <div className="flex-1 overflow-y-auto border rounded text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#f8fafc] font-bold text-[#475569] border-b">
                  <tr>
                    <th className="p-2.5">Meal</th>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5">Quantity/Vol</th>
                    <th className="p-2.5">Consumption (%)</th>
                    <th className="p-2.5">Binned (%)</th>
                    <th className="p-2.5">Rating (01-10)</th>
                    <th className="p-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {(viewingReport.items || []).map((it, idx) => (
                    <tr key={idx} className={it.meal === 'Breakfast' ? 'bg-amber-50/10' : it.meal === 'Lunch' ? 'bg-emerald-50/10' : 'bg-sky-50/10'}>
                      <td className="p-2.5 font-bold text-[#0d9488]">{it.meal}</td>
                      <td className="p-2.5 font-bold text-slate-800">{it.item}</td>
                      <td className="p-2.5">{it.quantityVol || '—'}</td>
                      <td className="p-2.5 font-semibold text-emerald-600">{it.consumptionPercent}</td>
                      <td className="p-2.5 font-semibold text-rose-600">{it.binnedPercent}</td>
                      <td className="p-2.5 font-bold">{it.rating}</td>
                      <td className="p-2.5 text-slate-500">{it.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              {canEditRecord(viewingReport.site) && (
                <button
                  onClick={() => {
                    const rep = viewingReport;
                    setViewingReport(null);
                    setEditingReport(rep);
                    setCurrentItems(rep.items || []);
                    setFeedbackComments(rep.feedbackComments || 'Menu Satisfactory.');
                    setIsReportModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded border border-amber-300 flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Report
                </button>
              )}
              <button
                onClick={() => setViewingReport(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT FOOD BOX MODAL */}
      {isBoxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xs shadow-xl border border-[#cbd5e1] max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-[#1e293b]">
                  {editingBox ? 'Edit Food Box Request / Complaint' : 'Log Food Box Request or Complaint'}
                </h2>
                <p className="text-xs text-[#64748b]">
                  Track special diet boxes (no salt, non-spicy, allergies) and resident complaints.
                </p>
              </div>
              <button onClick={() => { setIsBoxModalOpen(false); setEditingBox(null); }} className="font-bold text-[#64748b] hover:text-[#1e293b] p-1 text-lg">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);

                const data = {
                  date: (formData.get('date') as string) || new Date().toISOString().slice(0, 10),
                  site: (formData.get('site') as string) || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || '')),
                  roomNo: (formData.get('roomNo') as string) || '',
                  type: (formData.get('type') as string) || 'Request',
                  reason: (formData.get('reason') as string) || '',
                  status: (formData.get('status') as string) || 'Pending',
                  remarks: (formData.get('remarks') as string) || ''
                };

                if (editingBox) {
                  updateFoodBoxRequest(editingBox.id, data);
                } else {
                  addFoodBoxRequest(data);
                }

                setIsBoxModalOpen(false);
                setEditingBox(null);
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Date</label>
                  <input
                    type="date"
                    name="date"
                    defaultValue={editingBox?.date || new Date().toISOString().slice(0, 10)}
                    required
                    className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded font-semibold bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Hotel / Property</label>
                  <select
                    name="site"
                    defaultValue={editingBox?.site || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || ''))}
                    required
                    className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded font-semibold bg-white"
                  >
                    {allowedSites.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Room No.</label>
                <input
                  type="text"
                  name="roomNo"
                  defaultValue={editingBox?.roomNo || ''}
                  required
                  placeholder="e.g. NF 2, PWH 01 & 08, AWH 12"
                  className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded font-bold bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Type</label>
                  <select
                    name="type"
                    defaultValue={editingBox?.type || 'Special Box'}
                    className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded bg-white font-medium"
                  >
                    <option value="Request">Request</option>
                    <option value="Complaint">Complaint</option>
                    <option value="Special Box">Special Box</option>
                    <option value="Dietary Adjustment">Dietary Adjustment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={editingBox?.status || 'Pending'}
                    className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded bg-white font-medium"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Active">Active</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Reason / Dietary Requirements</label>
                <textarea
                  name="reason"
                  rows={2}
                  defaultValue={editingBox?.reason || ''}
                  required
                  placeholder="e.g. Requested for a Special Box as he doesnt eat foods with salt / spicy foods..."
                  className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Remarks / Action Taken</label>
                <input
                  type="text"
                  name="remarks"
                  defaultValue={editingBox?.remarks || ''}
                  placeholder="e.g. Special box arranged with catering chef..."
                  className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded bg-white"
                />
              </div>

              <div className="pt-3 border-t border-[#e2e8f0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsBoxModalOpen(false); setEditingBox(null); }}
                  className="px-4 py-2 border border-[#cbd5e1] rounded-xs text-xs font-semibold text-[#475569] hover:bg-[#f8fafc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
