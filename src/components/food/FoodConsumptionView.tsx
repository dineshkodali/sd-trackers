import React, { useState, useMemo, useEffect } from 'react';
import { Utensils, Calendar, Plus, Trash2, Edit3, Search, Eye, CheckCircle2, Inbox, Database, Check, RotateCcw, Coffee, Soup, BookmarkPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FoodConsumptionReport, FoodConsumptionItem, FoodBoxRequest, FieldOptionCategory } from '../../types';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';

const DEFAULT_BREAKFAST_ITEMS = [
  'Eggs', 'Bread', 'Milk', 'Cereal', 'Cheese', 'Butter', 'Juice', 'Jam', 'Baked Beans', 'Halal Sausages', 'Porridge', 'Fresh Fruit'
];

const DEFAULT_LUNCH_ITEMS = [
  'Southern fried chicken', 'Southern fried tofu', 'Salad', 'Chips', 'Pasta Bolognese', 'Jacket Potatoes', 'Sandwiches & Wraps', 'Beef Burger', 'Vegetable Curry', 'Soup & Roll'
];

const DEFAULT_DINNER_ITEMS = [
  'Beef massaman curry', 'Cauliflower massaman curry', 'Rice', 'Salad', 'Roast Chicken', 'Vegetable Lasagne', 'Shepherd\'s Pie', 'Fish & Chips', 'Halal Lamb Stew', 'Vegetable Biryani'
];

const QUANTITY_PRESETS = [
  '1 Tray', '2 Trays', '3 Trays', '4 Trays',
  '1 Portion', '2 Portions', 'Portions',
  'Individual Packs', 'Bags', 'Loaves', 'Cartons'
];

const CONSUMPTION_PRESETS = ['100%', '90%', '75%', '50%', '25%', '0%'];
const BINNED_PRESETS = ['0%', '10%', '25%', '50%', '75%', '100%'];
const RATING_PRESETS = [
  { val: '10', label: '10 - Excellent' },
  { val: '9', label: '9 - Very Good' },
  { val: '8', label: '8 - Good' },
  { val: '7', label: '7 - Satisfactory' },
  { val: '6', label: '6 - Acceptable' },
  { val: '5', label: '5 - Fair' },
  { val: '4', label: '4 - Below Average' },
  { val: '3', label: '3 - Poor' },
  { val: '2', label: '2 - Very Poor' },
  { val: '1', label: '1 - Unacceptable' }
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

interface EditableFoodItem extends FoodConsumptionItem {
  isCustom?: boolean;
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
    getFieldOptions,
    addFieldOption,
    deleteFieldOption,
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

  // Dynamic Food Items from Database
  const dbBreakfastOptions = useMemo(() => {
    const list = getFieldOptions('foodBreakfastItems');
    if (list.length > 0) return list.map(o => o.value || o.label);
    return DEFAULT_BREAKFAST_ITEMS;
  }, [getFieldOptions]);

  const dbLunchOptions = useMemo(() => {
    const list = getFieldOptions('foodLunchItems');
    if (list.length > 0) return list.map(o => o.value || o.label);
    return DEFAULT_LUNCH_ITEMS;
  }, [getFieldOptions]);

  const dbDinnerOptions = useMemo(() => {
    const list = getFieldOptions('foodDinnerItems');
    if (list.length > 0) return list.map(o => o.value || o.label);
    return DEFAULT_DINNER_ITEMS;
  }, [getFieldOptions]);

  const getOptionsForMeal = (meal: 'Breakfast' | 'Lunch' | 'Dinner') => {
    if (meal === 'Breakfast') return dbBreakfastOptions;
    if (meal === 'Lunch') return dbLunchOptions;
    return dbDinnerOptions;
  };

  const getCategoryForMeal = (meal: 'Breakfast' | 'Lunch' | 'Dinner'): FieldOptionCategory => {
    if (meal === 'Breakfast') return 'foodBreakfastItems';
    if (meal === 'Lunch') return 'foodLunchItems';
    return 'foodDinnerItems';
  };

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
  const [isManagePresetsOpen, setIsManagePresetsOpen] = useState(false);
  const [presetModalMeal, setPresetModalMeal] = useState<'Breakfast' | 'Lunch' | 'Dinner'>('Breakfast');
  const [newPresetItemName, setNewPresetItemName] = useState('');

  // Modal states for Food Box Requests / Complaints
  const [isBoxModalOpen, setIsBoxModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<FoodBoxRequest | null>(null);

  // Form State for Report Modal
  const [currentItems, setCurrentItems] = useState<EditableFoodItem[]>([]);
  const [feedbackComments, setFeedbackComments] = useState('Menu Satisfactory.');
  const [formMealFilter, setFormMealFilter] = useState<'ALL' | 'Breakfast' | 'Lunch' | 'Dinner'>('ALL');
  const [savedDbItemsNotice, setSavedDbItemsNotice] = useState<string | null>(null);

  // Standard Pier Avenue default menu loader
  const loadDefaultMenu = () => {
    const items: EditableFoodItem[] = [];
    const bItems = ['Eggs', 'Bread', 'Milk', 'Cereal', 'Cheese', 'Butter', 'Juice', 'Jam'];
    const lItems = ['Southern fried chicken', 'Southern fried tofu', 'Salad', 'Chips'];
    const dItems = ['Beef massaman curry', 'Cauliflower massaman curry', 'Rice', 'Salad'];

    bItems.forEach((it, i) => {
      items.push({
        id: `bf-${Date.now()}-${i}`,
        meal: 'Breakfast',
        item: it,
        quantityVol: '1 Portion',
        consumptionPercent: '100%',
        binnedPercent: '0%',
        rating: '8',
        remarks: ''
      });
    });

    lItems.forEach((it, i) => {
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

    dItems.forEach((it, i) => {
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
    loadDefaultMenu();
    setFormMealFilter('ALL');
    setIsReportModalOpen(true);
  };

  const handleAddItem = (meal: 'Breakfast' | 'Lunch' | 'Dinner') => {
    const available = getOptionsForMeal(meal);
    const defaultDish = available[0] || '';
    setCurrentItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        meal,
        item: defaultDish,
        quantityVol: meal === 'Breakfast' ? '1 Portion' : '1 Tray',
        consumptionPercent: '100%',
        binnedPercent: '0%',
        rating: '8',
        remarks: '',
        isCustom: false
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setCurrentItems(prev => prev.filter((_, i) => i !== index));
  };

  // 1-Click quick fill action
  const handleMarkAll100Consumed = () => {
    setCurrentItems(prev => prev.map(item => ({
      ...item,
      consumptionPercent: '100%',
      binnedPercent: '0%',
      rating: item.rating === '0' || !item.rating ? '8' : item.rating
    })));
  };

  // Save a custom item to database options
  const handleSaveItemToDatabase = (meal: 'Breakfast' | 'Lunch' | 'Dinner', dishName: string) => {
    if (!dishName.trim()) return;
    const cat = getCategoryForMeal(meal);
    addFieldOption({
      category: cat,
      label: dishName.trim(),
      value: dishName.trim(),
      color: meal === 'Breakfast' ? 'amber' : meal === 'Lunch' ? 'emerald' : 'blue',
      description: `User-defined ${meal} dish`,
      isActive: true,
      isSystem: false
    });
    setSavedDbItemsNotice(`Saved "${dishName}" to ${meal} database presets!`);
    setTimeout(() => setSavedDbItemsNotice(null), 3500);
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
                <button
                  type="button"
                  onClick={() => setIsManagePresetsOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#cbd5e1] rounded-xs text-xs font-semibold text-[#475569] bg-white hover:bg-[#f8fafc] transition-colors"
                  title="Configure dishes library in database"
                >
                  <Database className="w-3.5 h-3.5 text-teal-600" />
                  Dishes Library
                </button>

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
                  placeholder="Search dish, hotel, notes..."
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
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {items.length} items logged
                        </span>
                      </div>
                      <p className="text-xs text-[#64748b] mt-1 flex items-center gap-2 flex-wrap">
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
                            setFormMealFilter('ALL');
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

      {/* CREATE / EDIT FOOD CONSUMPTION REPORT MODAL — STREAMLINED & INTUITIVE */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xs shadow-2xl border border-[#cbd5e1] max-w-5xl w-full max-h-[94vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {editingReport ? 'Edit Daily Food Consumption Report' : 'New Daily Food Consumption Report (In & Out)'}
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    Dropdown dish selections with dynamic DB presets, quick consumption sync, and custom item options.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => { setIsReportModalOpen(false); setEditingReport(null); }} 
                className="text-slate-400 hover:text-white font-bold p-1 text-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Actions & Meal Filters Bar */}
            <div className="px-5 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2 text-xs">
              {/* Meal Filter Tabs inside form */}
              <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-[#cbd5e1]">
                <button
                  type="button"
                  onClick={() => setFormMealFilter('ALL')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    formMealFilter === 'ALL'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Meals ({currentItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFormMealFilter('Breakfast')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                    formMealFilter === 'Breakfast'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  <Coffee className="w-3 h-3" />
                  Breakfast ({currentItems.filter(i => i.meal === 'Breakfast').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFormMealFilter('Lunch')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                    formMealFilter === 'Lunch'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-800 hover:bg-emerald-50'
                  }`}
                >
                  <Utensils className="w-3 h-3" />
                  Lunch ({currentItems.filter(i => i.meal === 'Lunch').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFormMealFilter('Dinner')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                    formMealFilter === 'Dinner'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-sky-800 hover:bg-sky-50'
                  }`}
                >
                  <Soup className="w-3 h-3" />
                  Dinner ({currentItems.filter(i => i.meal === 'Dinner').length})
                </button>
              </div>

              {/* 1-Click Fast Actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleMarkAll100Consumed}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-semibold text-[11px] flex items-center gap-1 shadow-2xs"
                  title="Sets consumption 100% and binned 0% on all items"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  Mark All 100% Consumed
                </button>

                <button
                  type="button"
                  onClick={loadDefaultMenu}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded font-semibold text-[11px] flex items-center gap-1 shadow-2xs"
                  title="Reload default Pier Avenue standard 16 items"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  Reset to Standard Menu
                </button>

                <button
                  type="button"
                  onClick={() => handleAddItem(formMealFilter === 'ALL' ? 'Lunch' : formMealFilter)}
                  className="px-2.5 py-1 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded font-semibold text-[11px] flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3 h-3" />
                  Add Dish Row
                </button>
              </div>
            </div>

            {/* Database Notice Toast */}
            {savedDbItemsNotice && (
              <div className="px-5 py-2 bg-teal-50 border-b border-teal-200 text-teal-800 text-xs font-semibold flex items-center justify-between animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  {savedDbItemsNotice}
                </div>
                <button onClick={() => setSavedDbItemsNotice(null)} className="text-teal-700 hover:text-teal-900 font-bold">✕</button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);

                const data = {
                  date: (formData.get('date') as string) || selectedDate,
                  site: (formData.get('site') as string) || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || '')),
                  items: currentItems.map(it => ({
                    id: it.id,
                    meal: it.meal,
                    item: it.item,
                    quantityVol: it.quantityVol,
                    consumptionPercent: it.consumptionPercent,
                    binnedPercent: it.binnedPercent,
                    rating: it.rating,
                    remarks: it.remarks || ''
                  })),
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
              {/* Header Info Block */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Date</label>
                  <input
                    type="date"
                    name="date"
                    defaultValue={editingReport?.date || selectedDate || new Date().toISOString().slice(0, 10)}
                    required
                    className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Hotel / Property</label>
                  <select
                    name="site"
                    defaultValue={editingReport?.site || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || ''))}
                    required
                    className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded font-semibold text-slate-800"
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
                    className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Items Table with Meal & Dish Dropdowns */}
              <div className="border border-[#cbd5e1] rounded overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-[#475569] font-bold border-b border-[#cbd5e1]">
                      <tr>
                        <th className="py-2.5 px-3 w-32">Meal Type</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Dish / Item (DB Dropdown)</th>
                        <th className="py-2.5 px-3 w-32">Quantity / Vol</th>
                        <th className="py-2.5 px-3 w-28">Consumption %</th>
                        <th className="py-2.5 px-3 w-28">Binned %</th>
                        <th className="py-2.5 px-3 w-32">Rating (1-10)</th>
                        <th className="py-2.5 px-3">Remarks / Notes</th>
                        <th className="py-2.5 px-2 text-center w-10">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0]">
                      {currentItems
                        .filter(it => formMealFilter === 'ALL' || it.meal === formMealFilter)
                        .map((item, originalIdx) => {
                          // Find index in main currentItems array
                          const idx = currentItems.findIndex(i => i.id === item.id);
                          const mealOptions = getOptionsForMeal(item.meal);
                          const isCustomMode = item.isCustom || (!mealOptions.includes(item.item) && item.item.trim() !== '');

                          return (
                            <tr 
                              key={item.id || idx} 
                              className={`transition-colors ${
                                item.meal === 'Breakfast' 
                                  ? 'hover:bg-amber-50/30' 
                                  : item.meal === 'Lunch' 
                                  ? 'hover:bg-emerald-50/30' 
                                  : 'hover:bg-sky-50/30'
                              }`}
                            >
                              {/* 1. Meal Type Dropdown */}
                              <td className="py-2 px-3 align-top">
                                <select
                                  value={item.meal}
                                  onChange={e => {
                                    const newMeal = e.target.value as 'Breakfast' | 'Lunch' | 'Dinner';
                                    const newOpts = getOptionsForMeal(newMeal);
                                    setCurrentItems(prev => prev.map((r, i) => i === idx ? {
                                      ...r,
                                      meal: newMeal,
                                      // If current item isn't in new meal options, default to first option
                                      item: newOpts.includes(r.item) ? r.item : (newOpts[0] || r.item),
                                      isCustom: false
                                    } : r));
                                  }}
                                  className={`w-full px-2 py-1 rounded text-xs font-bold border ${
                                    item.meal === 'Breakfast'
                                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                                      : item.meal === 'Lunch'
                                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                      : 'bg-sky-50 text-sky-900 border-sky-300'
                                  }`}
                                >
                                  <option value="Breakfast">Breakfast</option>
                                  <option value="Lunch">Lunch</option>
                                  <option value="Dinner">Dinner</option>
                                </select>
                              </td>

                              {/* 2. Dish / Item Dropdown with Custom Input & Save to DB */}
                              <td className="py-2 px-3 align-top space-y-1.5">
                                <select
                                  value={isCustomMode ? '__custom__' : item.item}
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (val === '__custom__') {
                                      setCurrentItems(prev => prev.map((r, i) => i === idx ? {
                                        ...r,
                                        isCustom: true
                                      } : r));
                                    } else {
                                      setCurrentItems(prev => prev.map((r, i) => i === idx ? {
                                        ...r,
                                        item: val,
                                        isCustom: false
                                      } : r));
                                    }
                                  }}
                                  className="w-full px-2 py-1 bg-white border border-[#cbd5e1] rounded font-semibold text-slate-800 text-xs"
                                >
                                  <optgroup label={`${item.meal} Preset Dishes (${mealOptions.length})`}>
                                    {mealOptions.map((opt, oIdx) => (
                                      <option key={`${opt}-${oIdx}`} value={opt}>{opt}</option>
                                    ))}
                                  </optgroup>
                                  <option value="__custom__">➕ Enter Custom Item...</option>
                                </select>

                                {/* Custom Text Input & Save to DB button */}
                                {isCustomMode && (
                                  <div className="flex items-center gap-1 animate-fadeIn">
                                    <input
                                      type="text"
                                      value={item.item === '__custom__' ? '' : item.item}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, item: val } : r));
                                      }}
                                      placeholder={`Enter custom ${item.meal.toLowerCase()} item...`}
                                      className="flex-1 px-2 py-0.5 bg-yellow-50/50 border border-amber-300 rounded text-xs font-semibold"
                                      autoFocus
                                    />
                                    {item.item && item.item !== '__custom__' && !mealOptions.includes(item.item) && (
                                      <button
                                        type="button"
                                        onClick={() => handleSaveItemToDatabase(item.meal, item.item)}
                                        className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded text-[10px] font-bold flex items-center gap-1 shrink-0"
                                        title="Save this dish permanently to database dropdown presets"
                                      >
                                        <BookmarkPlus className="w-3 h-3 text-teal-600" />
                                        Save to DB
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* 3. Quantity / Vol Preset Dropdown */}
                              <td className="py-2 px-3 align-top">
                                <div className="space-y-1">
                                  <select
                                    value={QUANTITY_PRESETS.includes(item.quantityVol) ? item.quantityVol : '__other__'}
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (val !== '__other__') {
                                        setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, quantityVol: val } : r));
                                      }
                                    }}
                                    className="w-full px-2 py-1 bg-white border border-[#cbd5e1] rounded text-xs"
                                  >
                                    {QUANTITY_PRESETS.map(q => <option key={q} value={q}>{q}</option>)}
                                    <option value="__other__">Custom...</option>
                                  </select>
                                  {!QUANTITY_PRESETS.includes(item.quantityVol) && (
                                    <input
                                      type="text"
                                      value={item.quantityVol}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, quantityVol: val } : r));
                                      }}
                                      placeholder="e.g. 5 Litres"
                                      className="w-full px-2 py-0.5 border border-[#cbd5e1] rounded text-[11px]"
                                    />
                                  )}
                                </div>
                              </td>

                              {/* 4. Consumption % Dropdown (Auto-updates Binned %) */}
                              <td className="py-2 px-3 align-top">
                                <select
                                  value={String(item.consumptionPercent)}
                                  onChange={e => {
                                    const val = e.target.value;
                                    // Auto-calculate binned % based on consumption
                                    let calcBinned = '0%';
                                    if (val === '100%') calcBinned = '0%';
                                    else if (val === '90%') calcBinned = '10%';
                                    else if (val === '75%') calcBinned = '25%';
                                    else if (val === '50%') calcBinned = '50%';
                                    else if (val === '25%') calcBinned = '75%';
                                    else if (val === '0%') calcBinned = '100%';

                                    setCurrentItems(prev => prev.map((r, i) => i === idx ? {
                                      ...r,
                                      consumptionPercent: val,
                                      binnedPercent: calcBinned
                                    } : r));
                                  }}
                                  className="w-full px-2 py-1 bg-white border border-[#cbd5e1] rounded font-bold text-emerald-700 text-xs"
                                >
                                  {CONSUMPTION_PRESETS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </td>

                              {/* 5. Binned % Dropdown */}
                              <td className="py-2 px-3 align-top">
                                <select
                                  value={String(item.binnedPercent)}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, binnedPercent: val } : r));
                                  }}
                                  className="w-full px-2 py-1 bg-white border border-[#cbd5e1] rounded font-bold text-rose-700 text-xs"
                                >
                                  {BINNED_PRESETS.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                              </td>

                              {/* 6. Rating Dropdown (01-10) */}
                              <td className="py-2 px-3 align-top">
                                <select
                                  value={String(item.rating)}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, rating: val } : r));
                                  }}
                                  className="w-full px-2 py-1 bg-white border border-[#cbd5e1] rounded font-bold text-slate-800 text-xs"
                                >
                                  {RATING_PRESETS.map(r => (
                                    <option key={r.val} value={r.val}>{r.label}</option>
                                  ))}
                                </select>
                              </td>

                              {/* 7. Remarks Input */}
                              <td className="py-2 px-3 align-top">
                                <input
                                  type="text"
                                  value={item.remarks || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, remarks: val } : r));
                                  }}
                                  placeholder="e.g. Popular with residents..."
                                  className="w-full px-2 py-1 border border-[#cbd5e1] rounded text-xs bg-white text-slate-700"
                                />
                              </td>

                              {/* 8. Delete Row */}
                              <td className="py-2 px-2 text-center align-top">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
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

                {/* Add Item in Table Footer */}
                <div className="p-2.5 bg-slate-50 border-t border-[#cbd5e1] flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Showing {currentItems.filter(it => formMealFilter === 'ALL' || it.meal === formMealFilter).length} of {currentItems.length} dishes
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddItem('Breakfast')}
                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-semibold text-[11px] flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Breakfast Dish
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddItem('Lunch')}
                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-semibold text-[11px] flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Lunch Dish
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddItem('Dinner')}
                      className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded font-semibold text-[11px] flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Dinner Dish
                    </button>
                  </div>
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
                  className="w-full px-3 py-2 border border-[#cbd5e1] rounded font-semibold bg-emerald-50/40 text-slate-800 text-xs"
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

      {/* MANAGE DATABASE PRESETS MODAL */}
      {isManagePresetsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xs shadow-2xl border border-[#cbd5e1] max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-teal-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Food Dishes Database Library</h3>
                  <p className="text-[11px] text-slate-500">Add or manage standard dishes in the Supabase field_options table.</p>
                </div>
              </div>
              <button onClick={() => setIsManagePresetsOpen(false)} className="font-bold text-slate-400 hover:text-slate-800">✕</button>
            </div>

            {/* Meal Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded">
              {(['Breakfast', 'Lunch', 'Dinner'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setPresetModalMeal(m)}
                  className={`flex-1 py-1 text-xs font-bold rounded transition-all ${
                    presetModalMeal === m ? 'bg-white text-teal-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m} ({getOptionsForMeal(m).length})
                </button>
              ))}
            </div>

            {/* Add New Preset Item */}
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!newPresetItemName.trim()) return;
                addFieldOption({
                  category: getCategoryForMeal(presetModalMeal),
                  label: newPresetItemName.trim(),
                  value: newPresetItemName.trim(),
                  color: presetModalMeal === 'Breakfast' ? 'amber' : presetModalMeal === 'Lunch' ? 'emerald' : 'blue',
                  description: `${presetModalMeal} dish`,
                  isActive: true,
                  isSystem: false
                });
                setNewPresetItemName('');
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={newPresetItemName}
                onChange={e => setNewPresetItemName(e.target.value)}
                placeholder={`New ${presetModalMeal} dish name...`}
                className="flex-1 px-3 py-1.5 border border-[#cbd5e1] rounded text-xs"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add to DB
              </button>
            </form>

            {/* Existing Options List */}
            <div className="max-h-60 overflow-y-auto divide-y border rounded text-xs">
              {getFieldOptions(getCategoryForMeal(presetModalMeal)).map(opt => (
                <div key={opt.id} className="p-2 flex items-center justify-between hover:bg-slate-50">
                  <span className="font-semibold text-slate-800">{opt.label || opt.value}</span>
                  {!opt.isSystem && (
                    <button
                      onClick={() => deleteFieldOption(opt.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                      title="Delete dish option"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setIsManagePresetsOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded"
              >
                Done
              </button>
            </div>
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
                    setFormMealFilter('ALL');
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
