import React, { useState, useMemo } from 'react';
import { 
  Trash2, 
  Plus, 
  Search, 
  Edit3, 
  Eye, 
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UtensilsCrossed,
  Calendar,
  Sun,
  Moon,
  Utensils,
  X,
  PlusCircle,
  FileText,
  AlertCircle,
  Building2,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FoodWastageRecord, FoodWastageItem } from '../../types';
import { Pagination } from '../common/Pagination';
import { useTableSchema } from '../../hooks/useTableSchema';
import { FOOD_WASTAGE_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { AttachmentsSection } from '../common/AttachmentsSection';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';

const DEFAULT_UNITS = ['kg', 'grams', 'litres', 'portions', 'trays'];

const foodWastageExportColumns: ExportColumnOption[] = [
  { id: 'site', label: 'Hotel / Site', defaultSelected: true },
  { id: 'date', label: 'Date', defaultSelected: true },
  { id: 'mealType', label: 'Meal Type', defaultSelected: true },
  { id: 'foodWastage', label: 'Food Item(s)', defaultSelected: true },
  { id: 'quantity', label: 'Quantity Wasted', defaultSelected: true },
  { id: 'unit', label: 'Unit', defaultSelected: true },
  { id: 'comments', label: 'Remarks / Notes', defaultSelected: true }
];

interface FormItemRow {
  id: string;
  foodItem: string;
  quantity: string;
  unit: string;
  remarks: string;
}

export const FoodWastageView: React.FC = () => {
  const {
    foodWastageRecords,
    addFoodWastageRecord,
    updateFoodWastageRecord,
    deleteFoodWastageRecord,
    getFieldOptions,
    addFieldOption,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    assignedSite,
    canAccessAllSites,
    sites,
    requestConfirmation
  } = useApp();

  const {
    columns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<FoodWastageRecord>('foodWastage', FOOD_WASTAGE_TABLE_COLUMNS);

  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [mealTypeFilter, setMealTypeFilter] = useState<string>('all');
  const [foodItemFilter, setFoodItemFilter] = useState<string>('all');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FoodWastageRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<FoodWastageRecord | null>(null);

  // Form State
  const [formSite, setFormSite] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formMealType, setFormMealType] = useState<'Breakfast' | 'Lunch' | 'Dinner'>('Lunch');
  const [formComments, setFormComments] = useState('');
  const [formAttachments, setFormAttachments] = useState<any[]>([]);
  const [formItems, setFormItems] = useState<FormItemRow[]>([
    { id: '1', foodItem: '', quantity: '', unit: 'kg', remarks: '' }
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Add Item Modal inside Form
  const [isAddQuickItemOpen, setIsAddQuickItemOpen] = useState(false);
  const [newQuickItemName, setNewQuickItemName] = useState('');
  const [newQuickItemUnit, setNewQuickItemUnit] = useState('kg');
  const [activeItemRowTargetIndex, setActiveItemRowTargetIndex] = useState<number | null>(null);

  // Field options master lists
  const configuredFoodItems = useMemo(() => {
    const opts = getFieldOptions('foodItems', false);
    return opts.length > 0 ? opts : [
      { id: 'f1', label: 'Rice / Biryani', value: 'Rice / Biryani' },
      { id: 'f2', label: 'Chicken Curry / Stew', value: 'Chicken Curry / Stew' },
      { id: 'f3', label: 'Beef / Lamb Stew', value: 'Beef / Lamb Stew' },
      { id: 'f4', label: 'Fish / Seafood Dish', value: 'Fish / Seafood Dish' },
      { id: 'f5', label: 'Vegetable Curry / Daal', value: 'Vegetable Curry / Daal' },
      { id: 'f6', label: 'Pasta / Noodles', value: 'Pasta / Noodles' },
      { id: 'f7', label: 'Bread / Naan / Rolls', value: 'Bread / Naan / Rolls' },
      { id: 'f8', label: 'Soup / Broth', value: 'Soup / Broth' },
      { id: 'f9', label: 'Breakfast Items (Eggs/Beans)', value: 'Breakfast Items (Eggs/Beans)' },
      { id: 'f10', label: 'Fresh Salad / Greens', value: 'Fresh Salad / Greens' },
      { id: 'f11', label: 'Fruit / Fresh Produce', value: 'Fruit / Fresh Produce' },
      { id: 'f12', label: 'Dairy / Milk / Yoghurt', value: 'Dairy / Milk / Yoghurt' }
    ];
  }, [getFieldOptions]);

  const configuredUnits = useMemo(() => {
    const opts = getFieldOptions('wastageUnits', false);
    return opts.length > 0 ? opts.map(o => o.value) : DEFAULT_UNITS;
  }, [getFieldOptions]);

  // Unique food items in records for filter dropdown
  const allAvailableFoodItemNames = useMemo(() => {
    const set = new Set<string>();
    configuredFoodItems.forEach(i => set.add(i.value || i.label));
    foodWastageRecords.forEach(r => {
      if (Array.isArray(r.items)) {
        r.items.forEach(it => { if (it.foodItem) set.add(it.foodItem); });
      } else if (r.foodWastage) {
        set.add(r.foodWastage);
      }
    });
    return Array.from(set).sort();
  }, [configuredFoodItems, foodWastageRecords]);

  // Site isolation filter
  const accessibleRecords = useMemo(() => {
    if (canAccessAllSites()) return foodWastageRecords;
    if (!assignedSite || assignedSite === 'All Sites') return foodWastageRecords;
    return foodWastageRecords.filter(r => r.site?.toLowerCase() === assignedSite.toLowerCase());
  }, [foodWastageRecords, canAccessAllSites, assignedSite]);

  // Main filtering
  const filteredRecords = useMemo(() => {
    return accessibleRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (r.site && r.site.toLowerCase().includes(q)) ||
        (r.foodWastage && r.foodWastage.toLowerCase().includes(q)) ||
        (r.mealType && r.mealType.toLowerCase().includes(q)) ||
        (r.quantity && String(r.quantity).toLowerCase().includes(q)) ||
        (r.comments && r.comments.toLowerCase().includes(q)) ||
        (Array.isArray(r.items) && r.items.some(i => i.foodItem.toLowerCase().includes(q) || (i.remarks && i.remarks.toLowerCase().includes(q))));

      const matchesSite = siteFilter === 'all' || r.site === siteFilter;
      const matchesMealType = mealTypeFilter === 'all' || (r.mealType || 'Lunch') === mealTypeFilter;
      
      const matchesFoodItem = foodItemFilter === 'all' || (
        (Array.isArray(r.items) && r.items.some(it => it.foodItem === foodItemFilter)) ||
        r.foodWastage === foodItemFilter ||
        r.foodWastage?.toLowerCase().includes(foodItemFilter.toLowerCase())
      );

      const recordDate = r.date || '';
      const matchesStartDate = !startDateFilter || recordDate >= startDateFilter;
      const matchesEndDate = !endDateFilter || recordDate <= endDateFilter;

      return matchesSearch && matchesSite && matchesMealType && matchesFoodItem && matchesStartDate && matchesEndDate;
    });
  }, [accessibleRecords, searchQuery, siteFilter, mealTypeFilter, foodItemFilter, startDateFilter, endDateFilter]);

  // Meal-wise wastage summaries: Breakfast, Lunch, Dinner (grouped by unit without cross-unit mixing)
  const mealWastageSummaries = useMemo(() => {
    const summaries: Record<'Breakfast' | 'Lunch' | 'Dinner', Record<string, number>> = {
      Breakfast: {},
      Lunch: {},
      Dinner: {}
    };

    filteredRecords.forEach(rec => {
      const rawMeal = rec.mealType || 'Lunch';
      const meal = (rawMeal === 'Breakfast' || rawMeal === 'Dinner' ? rawMeal : 'Lunch') as 'Breakfast' | 'Lunch' | 'Dinner';

      if (Array.isArray(rec.items) && rec.items.length > 0) {
        rec.items.forEach(item => {
          const qty = parseFloat(String(item.quantity)) || 0;
          const unit = (item.unit || rec.unit || 'portions').trim();
          if (qty > 0) {
            summaries[meal][unit] = (summaries[meal][unit] || 0) + qty;
          }
        });
      } else {
        const qty = parseFloat(String(rec.quantity)) || 0;
        const unit = (rec.unit || 'portions').trim();
        if (qty > 0) {
          summaries[meal][unit] = (summaries[meal][unit] || 0) + qty;
        }
      }
    });

    return summaries;
  }, [filteredRecords]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc' 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredRecords, sortKey, sortOrder]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRecords.slice(startIndex, startIndex + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const availableSites = useMemo(() => {
    return (sites || []).map(s => typeof s === 'string' ? s : s?.name).filter(Boolean);
  }, [sites]);

  // Form Open / Close Handlers
  const handleOpenCreateModal = () => {
    setEditingRecord(null);
    setFormSite(assignedSite && assignedSite !== 'All Sites' ? assignedSite : (availableSites[0] || 'Brit Hotel'));
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormMealType('Lunch');
    setFormComments('');
    setFormAttachments([]);
    setFormItems([{ id: '1', foodItem: '', quantity: '', unit: 'kg', remarks: '' }]);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (rec: FoodWastageRecord) => {
    setEditingRecord(rec);
    setFormSite(rec.site || (assignedSite && assignedSite !== 'All Sites' ? assignedSite : (availableSites[0] || 'Brit Hotel')));
    setFormDate(rec.date || new Date().toISOString().slice(0, 10));
    setFormMealType((rec.mealType === 'Breakfast' || rec.mealType === 'Dinner' ? rec.mealType : 'Lunch') as any);
    setFormComments(rec.comments || '');
    setFormAttachments(Array.isArray(rec.attachments) ? rec.attachments : []);
    
    if (Array.isArray(rec.items) && rec.items.length > 0) {
      setFormItems(rec.items.map((it, idx) => ({
        id: String(it.id || idx + 1),
        foodItem: it.foodItem || '',
        quantity: String(it.quantity || ''),
        unit: it.unit || 'kg',
        remarks: it.remarks || ''
      })));
    } else {
      setFormItems([{
        id: '1',
        foodItem: rec.foodWastage || '',
        quantity: String(rec.quantity || ''),
        unit: rec.unit || 'kg',
        remarks: ''
      }]);
    }
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Form Items Rows Manipulation
  const handleAddItemRow = () => {
    setFormItems(prev => [
      ...prev,
      { id: Math.random().toString(36).slice(2, 9), foodItem: '', quantity: '', unit: 'kg', remarks: '' }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) {
      setFormItems([{ id: '1', foodItem: '', quantity: '', unit: 'kg', remarks: '' }]);
      return;
    }
    setFormItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemFieldChange = (index: number, field: keyof FormItemRow, value: string) => {
    setFormItems(prev => prev.map((item, idx) => idx === index ? { ...item, [field]: value } : item));
  };

  // Quick Add Food Item
  const handleOpenQuickAddModal = (targetRowIndex: number) => {
    setActiveItemRowTargetIndex(targetRowIndex);
    setNewQuickItemName('');
    setNewQuickItemUnit('kg');
    setIsAddQuickItemOpen(true);
  };

  const handleSaveQuickFoodItem = () => {
    const trimmed = newQuickItemName.trim();
    if (!trimmed) {
      alert('Please enter a valid food item name.');
      return;
    }
    const exists = configuredFoodItems.some(o => (o.value || o.label).toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      alert(`Food item "${trimmed}" already exists in the master list.`);
      if (activeItemRowTargetIndex !== null) {
        handleItemFieldChange(activeItemRowTargetIndex, 'foodItem', trimmed);
      }
      setIsAddQuickItemOpen(false);
      return;
    }

    if (addFieldOption) {
      addFieldOption({
        category: 'foodItems',
        label: trimmed,
        value: trimmed,
        color: 'amber',
        description: 'User-configured kitchen food item',
        isActive: true,
        isSystem: false
      });
    }

    if (activeItemRowTargetIndex !== null) {
      handleItemFieldChange(activeItemRowTargetIndex, 'foodItem', trimmed);
      handleItemFieldChange(activeItemRowTargetIndex, 'unit', newQuickItemUnit);
    }

    setIsAddQuickItemOpen(false);
  };

  // Form Submission
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formSite) {
      setFormError('Please select a site / hotel.');
      return;
    }
    if (!formDate) {
      setFormError('Please select a date.');
      return;
    }
    if (formItems.length === 0) {
      setFormError('Please add at least one food wastage item row.');
      return;
    }

    // Validate each row
    for (let i = 0; i < formItems.length; i++) {
      const row = formItems[i];
      if (!row.foodItem.trim()) {
        setFormError(`Row ${i + 1}: Please select or enter a Food Item.`);
        return;
      }
      const qtyNum = parseFloat(row.quantity);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        setFormError(`Row ${i + 1}: Please enter a valid positive quantity for "${row.foodItem}".`);
        return;
      }
      if (!row.unit.trim()) {
        setFormError(`Row ${i + 1}: Please select a unit of measurement.`);
        return;
      }
    }

    const structuredItems: FoodWastageItem[] = formItems.map(row => ({
      id: row.id,
      foodItem: row.foodItem.trim(),
      quantity: parseFloat(row.quantity) || 0,
      unit: row.unit.trim(),
      remarks: row.remarks.trim() || undefined
    }));

    // Generate summary strings for tabular, legacy column and report compatibility
    const foodWastageSummary = structuredItems.map(i => `${i.foodItem} (${i.quantity} ${i.unit})`).join(', ');
    const quantitySummary = structuredItems.map(i => `${i.quantity} ${i.unit}`).join(', ');
    const primaryUnit = structuredItems.length === 1 ? structuredItems[0].unit : (
      structuredItems.every(i => i.unit === structuredItems[0].unit) ? structuredItems[0].unit : 'Mixed'
    );

    const payload = {
      site: formSite,
      date: formDate,
      mealType: formMealType,
      foodWastage: foodWastageSummary,
      quantity: quantitySummary,
      unit: primaryUnit,
      items: structuredItems,
      comments: formComments.trim(),
      attachments: formAttachments || []
    };

    if (editingRecord) {
      updateFoodWastageRecord(editingRecord.id, payload);
    } else {
      addFoodWastageRecord(payload as any);
    }

    setIsFormModalOpen(false);
  };

  const handleDeleteRecord = (id: string) => {
    if (requestConfirmation) {
      requestConfirmation({
        title: 'Delete Food Wastage Record',
        message: 'Are you sure you want to delete this food wastage log? This action cannot be undone.',
        isDanger: true,
        onConfirm: async () => {
          deleteFoodWastageRecord(id);
        }
      });
    } else {
      if (window.confirm('Are you sure you want to delete this food wastage log?')) {
        deleteFoodWastageRecord(id);
      }
    }
  };

  // Export functionality
  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    let sourceData = accessibleRecords;
    if (scope === 'filtered') sourceData = sortedRecords;
    else if (scope === 'custom' && startDate && endDate) {
      sourceData = accessibleRecords.filter(d => {
        const val = d.date || '';
        return (!startDate || val >= startDate) && (!endDate || val <= endDate);
      });
    }
    return sourceData;
  };

  const calculateDateRangeCount = (startDate: string, endDate: string): number => {
    return accessibleRecords.filter(d => {
      const val = d.date || '';
      return (!startDate || val >= startDate) && (!endDate || val <= endDate);
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
      ? foodWastageExportColumns.filter(c => selectedColumns.includes(c.id))
      : foodWastageExportColumns;
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
      ? foodWastageExportColumns.filter(c => selectedColumns.includes(c.id))
      : foodWastageExportColumns;
    const headers = cols.map(c => c.label);
    const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));

    if (format === 'csv') {
      exportTableToCsv({ filename: `Food_Wastage_Tracker_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows });
    } else {
      exportTableToPdf({
        filename: `Food_Wastage_Tracker_${new Date().toISOString().slice(0, 10)}.pdf`,
        title: 'Commercial Food Wastage Tracker Audit Report',
        subtitle: `Site Scope: ${siteFilter === 'all' ? 'All Permitted Sites' : siteFilter} | Meal: ${mealTypeFilter === 'all' ? 'All Meals' : mealTypeFilter}`,
        headers,
        rows,
        orientation
      });
    }
  };

  // Helper format for unit totals without mixing units
  const formatUnitTotals = (unitMap: Record<string, number>) => {
    const entries = Object.entries(unitMap);
    if (entries.length === 0) return '0 recorded wastage';
    return entries.map(([unit, qty]) => `${qty % 1 === 0 ? qty : qty.toFixed(1)} ${unit}`).join(' • ');
  };

  return (
    <div className="space-y-4">
      {/* Top Banner, Header, Actions & Filters in ONE unified section */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xs">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424] tracking-tight">Food Wastage Tracker</h1>
                <span className="text-xs bg-amber-50 text-amber-900 font-semibold px-2 py-0.5 rounded-xs border border-amber-200">
                  {filteredRecords.length} Wastage Records
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Log and monitor daily food wastage items, multi-item batches, and kitchen compliance notes across Breakfast, Lunch, and Dinner.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {currentUserRole === 'Super Admin' && (
              <button
                type="button"
                onClick={() => setIsSchemaModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-neutral-50 text-neutral-700 border border-[#e5e5e5] rounded-xs shadow-2xs transition-colors"
                title="Super Admin: Customize table columns, headers, and fields"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0078d4]" />
                <span>Customize Table</span>
              </button>
            )}

            <ExportDropdown
              moduleName="Food Wastage"
              totalRecordCount={accessibleRecords.length}
              filteredRecordCount={filteredRecords.length}
              defaultOrientation="landscape"
              dateRangeRecordCount={calculateDateRangeCount}
              availableColumns={foodWastageExportColumns}
              getPreviewData={getExportPreviewData}
              onExport={handlePerformExport}
              buttonVariant="toolbar"
            />

            {canCreateRecord() && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Log Food Wastage</span>
              </button>
            )}
          </div>
        </div>

        {/* Meal-wise Wastage Summaries (Breakfast, Lunch, Dinner - separated by unit) */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 md:grid-cols-3 gap-3 select-none">
          {/* Breakfast Summary Card */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-xs p-3 flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded">
              <Sun className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">Breakfast Wastage</span>
                <span className="text-[10px] bg-amber-200/80 text-amber-900 font-semibold px-1.5 py-0.2 rounded">
                  Morning
                </span>
              </div>
              <p className="text-xs font-semibold text-amber-900 mt-1 truncate" title={formatUnitTotals(mealWastageSummaries.Breakfast)}>
                {formatUnitTotals(mealWastageSummaries.Breakfast)}
              </p>
              <span className="text-[10px] text-amber-700/80">Unit totals maintained separately</span>
            </div>
          </div>

          {/* Lunch Summary Card */}
          <div className="bg-teal-50/60 border border-teal-200/80 rounded-xs p-3 flex items-start gap-3">
            <div className="p-2 bg-teal-100 text-teal-800 rounded">
              <Utensils className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-950 uppercase tracking-wide">Lunch Wastage</span>
                <span className="text-[10px] bg-teal-200/80 text-teal-900 font-semibold px-1.5 py-0.2 rounded">
                  Midday
                </span>
              </div>
              <p className="text-xs font-semibold text-teal-900 mt-1 truncate" title={formatUnitTotals(mealWastageSummaries.Lunch)}>
                {formatUnitTotals(mealWastageSummaries.Lunch)}
              </p>
              <span className="text-[10px] text-teal-700/80">Unit totals maintained separately</span>
            </div>
          </div>

          {/* Dinner Summary Card */}
          <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-xs p-3 flex items-start gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-800 rounded">
              <Moon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">Dinner Wastage</span>
                <span className="text-[10px] bg-indigo-200/80 text-indigo-900 font-semibold px-1.5 py-0.2 rounded">
                  Evening
                </span>
              </div>
              <p className="text-xs font-semibold text-indigo-900 mt-1 truncate" title={formatUnitTotals(mealWastageSummaries.Dinner)}>
                {formatUnitTotals(mealWastageSummaries.Dinner)}
              </p>
              <span className="text-[10px] text-indigo-700/80">Unit totals maintained separately</span>
            </div>
          </div>
        </div>

        {/* Integrated Filter Controls */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search Box */}
          <div className="relative lg:col-span-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search wastage..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] placeholder-neutral-400 focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
            />
          </div>

          {/* Meal Type Filter */}
          <select
            value={mealTypeFilter}
            onChange={e => { setMealTypeFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
          >
            <option value="all">All Meal Types (Breakfast, Lunch, Dinner)</option>
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
          </select>

          {/* Food Item Filter */}
          <select
            value={foodItemFilter}
            onChange={e => { setFoodItemFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
          >
            <option value="all">All Food Items ({allAvailableFoodItemNames.length})</option>
            {allAvailableFoodItemNames.map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          {/* Site Filter */}
          {canAccessAllSites() ? (
            <select
              value={siteFilter}
              onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Sites</option>
              {availableSites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <div className="px-3 py-1.5 bg-neutral-100 border border-[#e5e5e5] rounded-xs text-xs text-neutral-600 flex items-center gap-1.5 truncate">
              <Building2 className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="truncate">{assignedSite || 'Assigned Site'}</span>
            </div>
          )}

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDateFilter}
              onChange={e => { setStartDateFilter(e.target.value); setCurrentPage(1); }}
              className="w-1/2 px-2 py-1 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] outline-hidden"
              title="Date From"
            />
            <span className="text-neutral-400 text-xs">&ndash;</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={e => { setEndDateFilter(e.target.value); setCurrentPage(1); }}
              className="w-1/2 px-2 py-1 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] outline-hidden"
              title="Date To"
            />
          </div>
        </div>
      </div>

      {/* Main Table: Date | Meal Type | Food Item | Quantity Wasted | Unit | Remarks | Actions */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs min-h-[500px] lg:min-h-[calc(100vh-270px)] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[950px]">
            <thead className="bg-[#f3f2f1] text-[#242424] font-semibold border-b border-[#edebe9] select-none whitespace-nowrap">
              <tr>
                <th
                  onClick={() => handleSort('date')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-[#edebe9] transition-colors w-28"
                  title="Sort by Date"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Date</span>
                    {sortKey === 'date' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('mealType')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-[#edebe9] transition-colors w-28"
                  title="Sort by Meal Type"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Meal Type</span>
                    {sortKey === 'mealType' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('site')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-[#edebe9] transition-colors w-36"
                  title="Sort by Property"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Site / Hotel</span>
                    {sortKey === 'site' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />
                    )}
                  </div>
                </th>
                <th className="py-2.5 px-3 min-w-[220px]">Food Item(s)</th>
                <th className="py-2.5 px-3 w-32">Quantity Wasted</th>
                <th className="py-2.5 px-3 w-24">Unit</th>
                <th className="py-2.5 px-3 min-w-[180px]">Remarks</th>
                <th className="py-2.5 px-3 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[#605e5c]">
                    <UtensilsCrossed className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="font-semibold text-neutral-700">No Food Wastage records found.</p>
                    <p className="text-xs text-neutral-400 mt-1">Try adjusting filters or record a new wastage log.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(record => {
                  const hasMultiItems = Array.isArray(record.items) && record.items.length > 0;
                  const mealType = record.mealType || 'Lunch';

                  return (
                    <tr key={record.id} className="hover:bg-[#faf9f8] transition-colors">
                      {/* Date */}
                      <td className="py-2.5 px-3 font-mono text-[#323130] whitespace-nowrap">
                        {record.date || '—'}
                      </td>

                      {/* Meal Type Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          mealType === 'Breakfast'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : mealType === 'Dinner'
                            ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                            : 'bg-teal-100 text-teal-900 border border-teal-200'
                        }`}>
                          {mealType === 'Breakfast' && <Sun className="w-3 h-3 text-amber-700" />}
                          {mealType === 'Dinner' && <Moon className="w-3 h-3 text-indigo-700" />}
                          {mealType === 'Lunch' && <Utensils className="w-3 h-3 text-teal-700" />}
                          <span>{mealType}</span>
                        </span>
                      </td>

                      {/* Site */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-medium text-[#0f766e] bg-teal-50 px-2 py-0.5 rounded border border-teal-100 text-xs">
                          {record.site || '—'}
                        </span>
                      </td>

                      {/* Food Item(s) */}
                      <td className="py-2.5 px-3">
                        {hasMultiItems ? (
                          <div className="space-y-1">
                            {record.items!.map((it, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-[#242424]">{it.foodItem}</span>
                                {it.remarks && (
                                  <span className="text-[11px] text-neutral-400 italic">({it.remarks})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="font-semibold text-[#242424]">{record.foodWastage || '—'}</span>
                        )}
                      </td>

                      {/* Quantity Wasted */}
                      <td className="py-2.5 px-3 font-mono">
                        {hasMultiItems ? (
                          <div className="space-y-1">
                            {record.items!.map((it, idx) => (
                              <div key={idx} className="font-semibold text-[#b45309]">
                                {it.quantity}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="font-mono text-[#b45309] bg-amber-50 px-1.5 py-0.5 rounded font-semibold">
                            {record.quantity || '—'}
                          </span>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="py-2.5 px-3">
                        {hasMultiItems ? (
                          <div className="space-y-1">
                            {record.items!.map((it, idx) => (
                              <div key={idx} className="text-neutral-600 text-xs">
                                {it.unit}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-neutral-600 text-xs">{record.unit || '—'}</span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="py-2.5 px-3 text-[#323130] max-w-xs">
                        <span className="line-clamp-2" title={record.comments || ''}>
                          {record.comments || '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingRecord(record)}
                            className="p-1 hover:bg-[#f3f2f1] text-[#605e5c] hover:text-[#242424] rounded"
                            title="View Record Dossier"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEditRecord() && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(record)}
                              className="p-1 hover:bg-[#f3f2f1] text-[#0d9488] rounded"
                              title="Edit Record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDeleteRecord() && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(record.id)}
                              className="p-1 hover:bg-red-50 text-[#a4262c] rounded"
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

        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredRecords.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {/* Multi-Item Food Wastage Modal (Create / Edit) */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xs shadow-xl border border-[#edebe9] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#f3f8fd] px-5 py-3.5 border-b border-[#5eead4] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#0d9488] text-white rounded-xs">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-[#242424]">
                    {editingRecord ? `Edit Food Wastage Log` : `Log Food Wastage Record`}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Capture individual or multi-item food wastage for Breakfast, Lunch, or Dinner.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-white rounded-xs border border-transparent hover:border-[#5eead4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveForm} className="overflow-y-auto p-5 space-y-4 flex-1">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-xs text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Site, Date, Meal Type Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-xs text-[#605e5c] block mb-1">
                    Property / Hotel *
                  </label>
                  <select
                    value={formSite}
                    onChange={e => setFormSite(e.target.value)}
                    disabled={!canAccessAllSites()}
                    className="w-full p-2 border border-[#8a8886] rounded-xs text-xs bg-white text-[#323130] disabled:bg-neutral-100"
                    required
                  >
                    {availableSites.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-xs text-[#605e5c] block mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#0d9488]" />
                    <span>Date of Wastage *</span>
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full p-2 border border-[#8a8886] rounded-xs text-xs bg-white text-[#323130] font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-xs text-[#605e5c] block mb-1">
                    Meal Type *
                  </label>
                  <select
                    value={formMealType}
                    onChange={e => setFormMealType(e.target.value as any)}
                    className="w-full p-2 border border-[#8a8886] rounded-xs text-xs bg-white text-[#323130] font-semibold"
                    required
                  >
                    <option value="Breakfast">Breakfast (Morning Service)</option>
                    <option value="Lunch">Lunch (Midday Service)</option>
                    <option value="Dinner">Dinner (Evening Service)</option>
                  </select>
                </div>
              </div>

              {/* Multi-Item Food Wastage Table */}
              <div className="border border-[#e1dfdd] rounded-xs overflow-hidden">
                <div className="bg-[#f3f2f1] px-3 py-2 border-b border-[#e1dfdd] flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-[#242424]">
                    <Utensils className="w-3.5 h-3.5 text-[#0d9488]" />
                    <span>Food Items Wasted in this Batch ({formItems.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0d9488] hover:text-[#0f766e] bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded border border-teal-200 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Item Row</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#faf9f8] text-[#242424] font-semibold border-b border-[#edebe9]">
                      <tr>
                        <th className="p-2 min-w-[200px]">Food Item *</th>
                        <th className="p-2 w-28">Quantity *</th>
                        <th className="p-2 w-32">Unit of Measurement *</th>
                        <th className="p-2 min-w-[150px]">Remarks / Item Notes</th>
                        <th className="p-2 text-center w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edebe9]">
                      {formItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-[#faf9f8]">
                          {/* Searchable / Configured Food Item with Quick Add */}
                          <td className="p-1.5 align-top">
                            <div className="flex items-center gap-1">
                              <select
                                value={item.foodItem}
                                onChange={e => {
                                  if (e.target.value === '__add_new__') {
                                    handleOpenQuickAddModal(idx);
                                  } else {
                                    handleItemFieldChange(idx, 'foodItem', e.target.value);
                                  }
                                }}
                                className="w-full p-1.5 border border-[#8a8886] rounded-xs text-xs bg-white text-[#323130] font-medium focus:border-[#0d9488]"
                                required
                              >
                                <option value="">-- Select Food Item --</option>
                                {configuredFoodItems.map(opt => (
                                  <option key={opt.id} value={opt.value || opt.label}>
                                    {opt.label || opt.value}
                                  </option>
                                ))}
                                <option value="__add_new__" className="text-[#0d9488] font-bold">
                                  + Add New Item to Master List...
                                </option>
                              </select>
                              <button
                                type="button"
                                onClick={() => handleOpenQuickAddModal(idx)}
                                className="p-1.5 bg-neutral-100 hover:bg-teal-50 hover:text-[#0d9488] text-neutral-600 rounded border border-[#e5e5e5]"
                                title="Add New Item to Master List"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Numeric Quantity */}
                          <td className="p-1.5 align-top">
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              placeholder="e.g. 5"
                              value={item.quantity}
                              onChange={e => handleItemFieldChange(idx, 'quantity', e.target.value)}
                              className="w-full p-1.5 border border-[#8a8886] rounded-xs font-mono text-xs bg-white text-[#323130] focus:border-[#0d9488]"
                              required
                            />
                          </td>

                          {/* Unit of Measurement */}
                          <td className="p-1.5 align-top">
                            <select
                              value={item.unit}
                              onChange={e => handleItemFieldChange(idx, 'unit', e.target.value)}
                              className="w-full p-1.5 border border-[#8a8886] rounded-xs text-xs bg-white text-[#323130]"
                              required
                            >
                              {configuredUnits.map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>

                          {/* Row Remarks */}
                          <td className="p-1.5 align-top">
                            <input
                              type="text"
                              placeholder="e.g. Unserved tray, Spoilage"
                              value={item.remarks}
                              onChange={e => handleItemFieldChange(idx, 'remarks', e.target.value)}
                              className="w-full p-1.5 border border-[#8a8886] rounded-xs text-xs bg-white text-[#323130]"
                            />
                          </td>

                          {/* Action (Remove Row) */}
                          <td className="p-1.5 text-center align-top">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              disabled={formItems.length === 1 && !item.foodItem && !item.quantity}
                              className="p-1 text-neutral-400 hover:text-red-600 rounded hover:bg-red-50 disabled:opacity-30"
                              title="Remove Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* General Remarks */}
              <div>
                <label className="font-semibold text-xs text-[#605e5c] block mb-1">
                  Overall Kitchen Remarks / Disposal Notes
                </label>
                <textarea
                  rows={2}
                  value={formComments}
                  onChange={e => setFormComments(e.target.value)}
                  placeholder="e.g. Disposed via contracted food waste bin. Thermometer calibrated."
                  className="w-full p-2 border border-[#8a8886] rounded-xs text-xs text-[#323130]"
                />
              </div>

              {/* Attachments Section */}
              <AttachmentsSection
                attachments={formAttachments}
                onChange={setFormAttachments}
                allowUpload={true}
                entityName="Food Wastage"
              />

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#edebe9]">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 border border-[#8a8886] rounded-xs text-xs text-[#323130] hover:bg-[#f3f2f1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold rounded-xs shadow-xs"
                >
                  {editingRecord ? 'Save Changes' : 'Save Wastage Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Food Item Dialog */}
      {isAddQuickItemOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xs shadow-2xl border border-[#edebe9] w-full max-w-sm p-4 space-y-3 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-2">
              <div className="flex items-center gap-1.5 font-bold text-sm text-[#242424]">
                <Plus className="w-4 h-4 text-[#0d9488]" />
                <span>Add Food Item to Master List</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddQuickItemOpen(false)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Item Name *
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Steamed Rice, Roast Lamb"
                value={newQuickItemName}
                onChange={e => setNewQuickItemName(e.target.value)}
                className="w-full p-2 border border-[#8a8886] rounded-xs text-xs text-[#323130]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Default Measurement Unit *
              </label>
              <select
                value={newQuickItemUnit}
                onChange={e => setNewQuickItemUnit(e.target.value)}
                className="w-full p-2 border border-[#8a8886] rounded-xs text-xs text-[#323130]"
              >
                {configuredUnits.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f0f0f0]">
              <button
                type="button"
                onClick={() => setIsAddQuickItemOpen(false)}
                className="px-3 py-1.5 border border-[#8a8886] text-xs rounded-xs text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuickFoodItem}
                className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-xs font-semibold text-white rounded-xs shadow-xs"
              >
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic View Modal */}
      {viewingRecord && (
        <DynamicRecordViewModal<FoodWastageRecord>
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          title={`Food Wastage Dossier - ${viewingRecord.foodWastage || viewingRecord.id}`}
          columns={columns}
          record={viewingRecord}
          onEdit={() => {
            const rec = viewingRecord;
            setViewingRecord(null);
            handleOpenEditModal(rec);
          }}
          canEdit={canEditRecord()}
        />
      )}

      {/* Super Admin Table Customizer */}
      <TableSchemaEditorModal<FoodWastageRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Food Wastage Tracker"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
