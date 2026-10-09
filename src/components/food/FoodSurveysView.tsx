import React, { useState, useMemo } from 'react';
import { BulkActionToolbar } from '../common/BulkActionToolbar';
import { 
  Soup, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  Star,
  CheckCircle2,
  Utensils,
  Calendar,
  Building2,
  Info,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FoodSurveyRecord, FoodMealRating, MealRatingValue } from '../../types';
import { SiteServiceUserSelector } from '../common/SiteServiceUserSelector';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption } from '../common/ExportModal';
import { useTableSchema } from '../../hooks/useTableSchema';
import { FOOD_SURVEYS_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { TableColumnConfig } from '../../types/tableSchema';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES: Array<'Breakfast' | 'Lunch' | 'Dinner'> = ['Breakfast', 'Lunch', 'Dinner'];
const RATING_OPTIONS: MealRatingValue[] = ['Excellent', 'Very good', 'Good', 'Fair', 'Poor'];

const foodSurveyExportColumns: ExportColumnOption[] = [
  { id: 'createdAt', label: 'Survey Date', defaultSelected: true },
  { id: 'siteName', label: 'Site / Hotel', defaultSelected: true },
  { id: 'portReference', label: 'Port Reference', defaultSelected: true },
  { id: 'houseOfficerName', label: 'House Officer', defaultSelected: true },
  { id: 'overallFoodQuality', label: 'Overall Quality', defaultSelected: true },
  { id: 'serverQuality', label: 'Server Quality', defaultSelected: true },
  { id: 'diningAreaCleanliness', label: 'Cleanliness', defaultSelected: true },
  { id: 'overallFoodRating', label: 'Overall Food Rating', defaultSelected: true },
  { id: 'menuDiversity', label: 'Menu Diversity', defaultSelected: true },
  { id: 'favouriteDish', label: 'Favourite Dish', defaultSelected: true },
  { id: 'leastFavouriteDish', label: 'Least Favourite Dish', defaultSelected: true }
];

export const FoodSurveysView: React.FC = () => {
  const {
    foodSurveys,
    addFoodSurvey,
    updateFoodSurvey,
    deleteFoodSurvey,
    canAccessAllSites,
    assignedSite,
    sites,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    currentUserName,
    authProfile
  , requestConfirmation } = useApp();

  const loggedInUserName = authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || (currentUserRole ? `${currentUserRole} (User)` : 'Duty Officer');

  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const handleToggleSelectAll = () => { setSelectedIds(prev => prev.length ? [] : paginatedData?.map(p => p.id) || []); };
  const handleToggleSelect = (e: any, id: string) => { e.stopPropagation(); setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (typeof requestConfirmation !== 'undefined') {
      requestConfirmation({
        title: 'Delete Selected', message: 'Are you sure you want to delete selected items?', isDanger: true,
        onConfirm: async () => { /* Add logic */ setSelectedIds([]); }
      });
    }
  };

  const [siteFilter, setSiteFilter] = useState(!canAccessAllSites() ? assignedSite : 'all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<keyof FoodSurveyRecord>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FoodSurveyRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);

  // Table Customization Schema Hook
  const {
    columns: schemaColumns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<FoodSurveyRecord>('foodSurveys', FOOD_SURVEYS_TABLE_COLUMNS);

  // Form State
  const defaultMealRatings: FoodMealRating[] = useMemo(() => {
    const arr: FoodMealRating[] = [];
    for (const day of DAYS_OF_WEEK) {
      for (const meal of MEAL_TYPES) {
        arr.push({
          dayOfWeek: day,
          mealType: meal,
          rating: 'Good'
        });
      }
    }
    return arr;
  }, []);

  const initialFormState: Partial<FoodSurveyRecord> = {
    siteName: sites[0]?.name || assignedSite || 'Brit Hotel',
    portReference: '',
    houseOfficerName: loggedInUserName,
    overallFoodQuality: 'Good',
    serverQuality: 'Good',
    diningAreaCleanliness: 'Good',
    overallFoodRating: 'Good',
    menuDiversity: 'Good',
    favouriteDish: '',
    leastFavouriteDish: '',
    suggestedDishes: '',
    foodAllergies: '',
    portionSizes: 'Adequate',
    knownAllergies: '',
    dietaryRequirements: '',
    takeawayAwareness: true,
    snackAwareness: true,
    otherFeedback: '',
    mealRatings: defaultMealRatings
  };

  const [formData, setFormData] = useState<Partial<FoodSurveyRecord>>(initialFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'details' | 'matrix' | 'service' | 'feedback'>('details');

  // Filter records by site permissions & search
  const accessibleRecords = useMemo(() => {
    if (canAccessAllSites()) return foodSurveys;
    if (!assignedSite || assignedSite === 'All Sites') return foodSurveys;
    return foodSurveys.filter(r => r.siteName?.toLowerCase() === assignedSite.toLowerCase());
  }, [foodSurveys, canAccessAllSites, assignedSite]);

  const filteredRecords = useMemo(() => {
    return accessibleRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (r.portReference && r.portReference.toLowerCase().includes(q)) ||
        (r.siteName && r.siteName.toLowerCase().includes(q)) ||
        (r.houseOfficerName && r.houseOfficerName.toLowerCase().includes(q)) ||
        (r.favouriteDish && r.favouriteDish.toLowerCase().includes(q));

      const matchesSite = siteFilter === 'all' || r.siteName === siteFilter;
      const matchesRating = ratingFilter === 'all' || r.overallFoodQuality === ratingFilter;

      return matchesSearch && matchesSite && matchesRating;
    });
  }, [accessibleRecords, searchQuery, siteFilter, ratingFilter]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      if (sortOrder === 'asc') {
        return String(valA).localeCompare(String(valB));
      }
      return String(valB).localeCompare(String(valA));
    });
  }, [filteredRecords, sortKey, sortOrder]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.siteName) errors.siteName = 'Site is required';
    if (!formData.portReference?.trim()) errors.portReference = 'Port Reference is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreate = () => {
    setFormData({
      ...initialFormState,
      houseOfficerName: loggedInUserName,
      siteName: sites[0]?.name || (assignedSite !== 'All Sites' ? assignedSite : 'Brit Hotel'),
      mealRatings: defaultMealRatings
    });
    setFormErrors({});
    setIsEditing(false);
    setActiveTab('details');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (rec: FoodSurveyRecord) => {
    // Ensure mealRatings is populated
    let ratings = rec.mealRatings;
    if (!ratings || ratings.length === 0) {
      ratings = defaultMealRatings;
    }
    setFormData({ ...rec, houseOfficerName: rec.houseOfficerName || loggedInUserName, mealRatings: ratings });
    setFormErrors({});
    setIsEditing(true);
    setActiveTab('details');
    setIsFormOpen(true);
  };

  const handleOpenView = (rec: FoodSurveyRecord) => {
    setSelectedRecord(rec);
    setIsViewOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const dataToSave = {
      ...formData,
      houseOfficerName: formData.houseOfficerName || loggedInUserName
    };

    if (isEditing && formData.id) {
      await updateFoodSurvey(formData.id, dataToSave);
    } else {
      await addFoodSurvey(dataToSave as any);
    }
    setIsFormOpen(false);
  };

  const handleMealRatingChange = (day: string, meal: 'Breakfast' | 'Lunch' | 'Dinner', rating: MealRatingValue) => {
    setFormData(prev => {
      const existing = [...(prev.mealRatings || [])];
      const idx = existing.findIndex(r => r.dayOfWeek === day && r.mealType === meal);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], rating };
      } else {
        existing.push({ dayOfWeek: day, mealType: meal, rating });
      }
      return { ...prev, mealRatings: existing };
    });
  };

  const getMealRating = (day: string, meal: 'Breakfast' | 'Lunch' | 'Dinner', ratingsList?: FoodMealRating[]) => {
    const list = ratingsList || formData.mealRatings || [];
    const found = list.find(r => r.dayOfWeek === day && r.mealType === meal);
    return found?.rating || 'Good';
  };

  const handlePerformExport = (options: {
    format: 'csv' | 'pdf';
    orientation: 'portrait' | 'landscape';
    selectedColumns?: string[];
  }) => {
    const cols = options.selectedColumns && options.selectedColumns.length > 0
      ? foodSurveyExportColumns.filter(c => options.selectedColumns?.includes(c.id))
      : foodSurveyExportColumns;
    const headers = cols.map(c => c.label);
    const rows = filteredRecords.map(r => cols.map(c => {
      if (c.id === 'createdAt') return r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB') : '';
      return String((r as any)[c.id] ?? '');
    }));

    if (options.format === 'csv') {
      exportTableToCsv({ filename: 'Food_Surveys_Export.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'Food_Surveys_Export.pdf',
        title: 'Food Survey Registry',
        subtitle: `Site Scope: ${siteFilter === 'all' ? 'All Sites' : siteFilter}`,
        headers,
        rows,
        orientation: options.orientation || 'landscape'
      });
    }
  };

  const getRatingBadge = (rating?: string) => {
    switch (rating) {
      case 'Excellent':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Very good':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'Good':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Fair':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Poor':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  const renderColumnCell = (col: TableColumnConfig<FoodSurveyRecord>, record: FoodSurveyRecord) => {
    if (col.renderCell) {
      return col.renderCell((record as any)[col.key], record);
    }

    const value = (record as any)[col.key];

    if (col.badgeColors && value) {
      const badgeClass = col.badgeColors[value] || 'bg-neutral-100 text-neutral-800';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeClass}`}>
          {value}
        </span>
      );
    }

    if (col.key === 'createdAt') {
      return (
        <span className="font-medium text-neutral-800">
          {record.createdAt ? new Date(record.createdAt).toLocaleDateString('en-GB') : '—'}
        </span>
      );
    }

    if (col.key === 'portReference') {
      return <span className="font-mono text-[#0d9488] font-bold">{value || '—'}</span>;
    }

    if (col.key === 'overallFoodRating' || col.key === 'overallFoodQuality' || col.key === 'serverQuality' || col.key === 'diningAreaCleanliness' || col.key === 'menuDiversity') {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getRatingBadge(value)}`}>
          {value || '—'}
        </span>
      );
    }

    if (col.type === 'checkbox') {
      return value ? (
        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Yes</span>
        </span>
      ) : (
        <span className="text-neutral-400">No</span>
      );
    }

    if (value === null || value === undefined || value === '') {
      return <span className="text-neutral-400">—</span>;
    }

    return <span className="text-neutral-700 truncate max-w-[200px] inline-block">{String(value)}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Header */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xs">
              <Soup className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#242424] tracking-tight">Food Surveys &amp; Meal Quality</h1>
              <p className="text-xs text-neutral-500">Collect weekly meal quality matrices and resident catering feedback across all properties.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUserRole === 'Super Admin' && (
              <button
                type="button"
                id="btn-customize-food-table"
                onClick={() => setIsSchemaModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
                title="Super Admin: Customize table columns, headers, and fields"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>Customize Table</span>
              </button>
            )}

            <ExportDropdown 
              moduleName="Food Surveys"
              totalRecordCount={accessibleRecords.length}
              filteredRecordCount={filteredRecords.length}
              availableColumns={foodSurveyExportColumns}
              onExport={handlePerformExport}
            />

            {canCreateRecord() && (
              <button
                type="button"
                id="btn-create-food-survey"
                onClick={handleOpenCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-medium rounded-xs transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Food Survey</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Port Ref, House Officer, Dish..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            />
          </div>

          <div>
            <select
              value={siteFilter}
              onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); }}
              disabled={!canAccessAllSites()}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Properties / Sites</option>
              {sites.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={ratingFilter}
              onChange={e => { setRatingFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Overall Ratings</option>
              {RATING_OPTIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden flex flex-col justify-between min-h-[520px] lg:min-h-[calc(100vh-270px)]">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold select-none">
                {visibleColumns.map(col => {
                  const isSorted = sortKey === col.key;
                  return (
                    <th 
                      key={String(col.key)} 
                      className="py-2.5 px-3 cursor-pointer hover:bg-[#edebe9] transition-colors"
                      onClick={() => {
                        if (sortKey === col.key) {
                          setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortKey(col.key as keyof FoodSurveyRecord);
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.label}</span>
                        {isSorted ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="py-2.5 px-3 text-right w-24 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10 select-none">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-neutral-400">
                    <Soup className="w-8 h-8 mx-auto mb-2 text-neutral-300 opacity-60" />
                    <p className="font-medium text-xs">No food surveys recorded yet</p>
                    <p className="text-[11px] mt-0.5">Click "New Food Survey" to input a weekly meal review.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(rec => (
                  <tr key={rec.id} className="group hover:bg-[#fbfbfa] transition-colors">
                    {visibleColumns.map(col => (
                      <td key={String(col.key)} className="py-2.5 px-3">
                        {renderColumnCell(col, rec)}
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-right sticky right-0 bg-white group-hover:bg-[#fbfbfa] shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenView(rec)}
                          title="View Matrix & Feedback"
                          className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEditRecord() && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(rec)}
                            title="Edit Survey"
                            className="p-1 text-neutral-500 hover:text-blue-600 hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteRecord() && (
                          <button
                            type="button"
                            onClick={() => deleteFoodSurvey(rec.id)}
                            title="Delete Survey"
                            className="p-1 text-neutral-500 hover:text-red-600 hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
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

        {/* Pagination */}
        <div className="px-3 py-2 border-t border-[#f0f0f0] flex items-center justify-between shrink-0">
          <Pagination
            currentPage={currentPage}
            totalItems={filteredRecords.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* CREATE / EDIT FOOD SURVEY MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-3 sm:p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e1dfdd] bg-[#faf9f8] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Soup className="w-5 h-5 text-emerald-600" />
                <div>
                  <h2 className="text-sm font-bold text-[#242424]">{isEditing ? 'Edit Food Survey' : 'Record Weekly Food Survey'}</h2>
                  <p className="text-[11px] text-neutral-500">Log resident feedback and rating across all 21 weekly meal slots.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 pt-2 pb-0 border-b border-[#e5e5e5] flex gap-1 bg-[#faf9f8] text-xs font-medium">
              {[
                { id: 'details', label: '1. Survey Details' },
                { id: 'matrix', label: '2. 21 Meal Ratings Matrix' },
                { id: 'service', label: '3. Service & Dining' },
                { id: 'feedback', label: '4. Dishes & Dietary' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-2 border-b-2 font-medium transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? 'border-[#0d9488] text-[#0d9488]'
                      : 'border-transparent text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* TAB 1: DETAILS */}
              {activeTab === 'details' && (
                <div className="space-y-4">
                  {/* Central Master SU Selector */}
                  <div className="p-3 bg-white border border-emerald-100 rounded-lg shadow-2xs space-y-2">
                    <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                      Master Data Selection
                    </div>
                    <SiteServiceUserSelector
                      selectedSiteId={formData.siteId}
                      selectedSuId={formData.suId}
                      onSelect={(sel) => {
                        setFormData(prev => ({
                          ...prev,
                          siteName: sel.siteName,
                          siteId: sel.siteId,
                          suId: sel.suId,
                          propertyId: sel.propertyId,
                          roomId: sel.roomId,
                          portReference: sel.suReference || prev.portReference
                        }));
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Port Reference Number of SU *</label>
                      <input
                        type="text"
                        placeholder="e.g. 1049281"
                        value={formData.portReference}
                        onChange={e => setFormData({ ...formData, portReference: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs font-mono"
                      />
                      {formErrors.portReference && <p className="text-red-500 text-[10px] mt-0.5">{formErrors.portReference}</p>}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-medium text-neutral-700">House Officer Name</label>
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Locked to session</span>
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={formData.houseOfficerName || loggedInUserName}
                        className="w-full p-2 border border-[#e1dfdd] rounded-xs bg-[#f3f2f1] text-[#323130] font-medium text-xs cursor-not-allowed select-none outline-hidden"
                      />
                      <p className="text-[10px] text-neutral-400 mt-0.5">Audit log records this survey under your verified staff account.</p>
                    </div>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Overall Food Quality Rating</label>
                      <select
                        value={formData.overallFoodQuality}
                        onChange={e => setFormData({ ...formData, overallFoodQuality: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                      >
                        {RATING_OPTIONS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: WEEKLY MEAL MATRIX (21 RATINGS) */}
              {activeTab === 'matrix' && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xs flex items-center justify-between text-blue-900">
                    <div className="flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-blue-700 shrink-0" />
                      <span className="font-semibold text-xs">Weekly 21 Meal Ratings Matrix (Monday — Sunday)</span>
                    </div>
                    <span className="text-[11px] text-blue-700 font-medium">Ratings: Excellent, Very good, Good, Fair, Poor</span>
                  </div>

                  <div className="border border-[#e5e5e5] rounded-xs overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-700 font-semibold">
                          <th className="py-2.5 px-3">Day of Week</th>
                          <th className="py-2.5 px-3">Breakfast</th>
                          <th className="py-2.5 px-3">Lunch</th>
                          <th className="py-2.5 px-3">Dinner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f0f0]">
                        {DAYS_OF_WEEK.map(day => (
                          <tr key={day} className="hover:bg-[#fbfbfa]">
                            <td className="py-2.5 px-3 font-semibold text-neutral-800">{day}</td>
                            {MEAL_TYPES.map(meal => {
                              const currentRating = getMealRating(day, meal);
                              return (
                                <td key={meal} className="py-2 px-3">
                                  <select
                                    value={currentRating}
                                    onChange={e => handleMealRatingChange(day, meal, e.target.value as MealRatingValue)}
                                    className={`w-full p-1.5 border rounded-xs text-xs font-medium ${getRatingBadge(currentRating)}`}
                                  >
                                    {RATING_OPTIONS.map(opt => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: SERVICE & DINING */}
              {activeTab === 'service' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Quality of Servers / Catering Staff</label>
                      <select
                        value={formData.serverQuality}
                        onChange={e => setFormData({ ...formData, serverQuality: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                      >
                        {RATING_OPTIONS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Cleanliness of Dining Area</label>
                      <select
                        value={formData.diningAreaCleanliness}
                        onChange={e => setFormData({ ...formData, diningAreaCleanliness: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                      >
                        {RATING_OPTIONS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Overall Food Rating</label>
                      <select
                        value={formData.overallFoodRating}
                        onChange={e => setFormData({ ...formData, overallFoodRating: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                      >
                        {RATING_OPTIONS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Diversity of Menu and Choices</label>
                      <select
                        value={formData.menuDiversity}
                        onChange={e => setFormData({ ...formData, menuDiversity: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                      >
                        {RATING_OPTIONS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#f0f0f0] space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.takeawayAwareness}
                        onChange={e => setFormData({ ...formData, takeawayAwareness: e.target.checked })}
                        className="rounded border-neutral-300 text-[#0d9488]"
                      />
                      <span className="text-neutral-700 text-xs">Resident is aware of takeaway lunch box provision</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.snackAwareness}
                        onChange={e => setFormData({ ...formData, snackAwareness: e.target.checked })}
                        className="rounded border-neutral-300 text-[#0d9488]"
                      />
                      <span className="text-neutral-700 text-xs">Resident is aware of snack provision</span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 4: DISHES & DIETARY */}
              {activeTab === 'feedback' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Dish Liked Most</label>
                      <input
                        type="text"
                        placeholder="e.g. Chicken Biryani, Roast Potatoes"
                        value={formData.favouriteDish || ''}
                        onChange={e => setFormData({ ...formData, favouriteDish: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Dish Liked Least</label>
                      <input
                        type="text"
                        placeholder="e.g. Boiled Fish, Plain Rice"
                        value={formData.leastFavouriteDish || ''}
                        onChange={e => setFormData({ ...formData, leastFavouriteDish: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-medium text-neutral-700 mb-1">Suggested Dishes &amp; Preferred Cuisines</label>
                      <input
                        type="text"
                        placeholder="e.g. More vegetarian options, Halal chicken stew"
                        value={formData.suggestedDishes || ''}
                        onChange={e => setFormData({ ...formData, suggestedDishes: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Portion Sizes</label>
                      <select
                        value={formData.portionSizes}
                        onChange={e => setFormData({ ...formData, portionSizes: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                      >
                        <option value="Adequate">Adequate</option>
                        <option value="Too Small">Too Small</option>
                        <option value="Too Large">Too Large</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Known Allergies / Intolerances</label>
                      <input
                        type="text"
                        placeholder="e.g. Nuts, Dairy, Gluten, Shellfish"
                        value={formData.knownAllergies || ''}
                        onChange={e => setFormData({ ...formData, knownAllergies: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-medium text-neutral-700 mb-1">Special Dietary / Religious Requirements</label>
                      <input
                        type="text"
                        placeholder="e.g. Halal only, Kosher, Diabetic, Vegan"
                        value={formData.dietaryRequirements || ''}
                        onChange={e => setFormData({ ...formData, dietaryRequirements: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-medium text-neutral-700 mb-1">Other Catering Feedback / Notes</label>
                      <textarea
                        rows={3}
                        placeholder="Any additional feedback on meal temperatures, service speed, or packaging..."
                        value={formData.otherFeedback || ''}
                        onChange={e => setFormData({ ...formData, otherFeedback: e.target.value })}
                        className="w-full p-2 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="pt-4 border-t border-[#e5e5e5] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3 py-1.5 border border-neutral-300 text-neutral-700 rounded-xs hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-medium rounded-xs transition-colors shadow-2xs cursor-pointer"
                >
                  {isEditing ? 'Save Changes' : 'Submit Food Survey'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL VIEW MODAL */}
      {isViewOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-3 sm:p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#e1dfdd] bg-[#faf9f8] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Soup className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-[#242424]">Food Survey — SU {selectedRecord.portReference}</h3>
                  <p className="text-[11px] text-neutral-500">{selectedRecord.siteName} • {selectedRecord.createdAt ? new Date(selectedRecord.createdAt).toLocaleDateString() : ''}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsViewOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50 p-3 rounded-xs border border-neutral-200">
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Port Reference</span>
                  <span className="font-mono font-bold text-[#0d9488]">{selectedRecord.portReference}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Property</span>
                  <span className="font-semibold">{selectedRecord.siteName}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">House Officer</span>
                  <span>{selectedRecord.houseOfficerName || 'Officer'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Overall Quality</span>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold border ${getRatingBadge(selectedRecord.overallFoodQuality)}`}>
                    {selectedRecord.overallFoodQuality || 'Good'}
                  </span>
                </div>
              </div>

              {/* 21 Meal Ratings Matrix View */}
              <div className="border border-neutral-200 rounded-xs overflow-hidden">
                <div className="bg-[#faf9f8] px-3 py-2 border-b border-neutral-200 font-semibold text-neutral-800 flex items-center justify-between">
                  <span>Weekly 21 Meal Ratings Matrix</span>
                  <span className="text-[11px] text-neutral-500 font-normal">Ratings recorded by resident</span>
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#fcfbfa] border-b border-neutral-200 text-neutral-600 font-medium">
                      <th className="py-2 px-3">Day</th>
                      <th className="py-2 px-3">Breakfast</th>
                      <th className="py-2 px-3">Lunch</th>
                      <th className="py-2 px-3">Dinner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {DAYS_OF_WEEK.map(day => (
                      <tr key={day}>
                        <td className="py-2 px-3 font-medium text-neutral-800">{day}</td>
                        {MEAL_TYPES.map(meal => {
                          const r = getMealRating(day, meal, selectedRecord.mealRatings);
                          return (
                            <td key={meal} className="py-2 px-3">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${getRatingBadge(r)}`}>
                                {r}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Service & Feedback grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 border border-neutral-200 rounded-xs space-y-1.5">
                  <h4 className="font-semibold text-neutral-800">Dining &amp; Service Ratings</h4>
                  <p><strong>Server Quality:</strong> {selectedRecord.serverQuality || 'Good'}</p>
                  <p><strong>Dining Area Cleanliness:</strong> {selectedRecord.diningAreaCleanliness || 'Good'}</p>
                  <p><strong>Menu Diversity:</strong> {selectedRecord.menuDiversity || 'Good'}</p>
                  <p><strong>Portion Sizes:</strong> {selectedRecord.portionSizes || 'Adequate'}</p>
                </div>

                <div className="p-3 border border-neutral-200 rounded-xs space-y-1.5">
                  <h4 className="font-semibold text-neutral-800">Preferences &amp; Dietary</h4>
                  <p><strong>Liked Most:</strong> {selectedRecord.favouriteDish || '—'}</p>
                  <p><strong>Liked Least:</strong> {selectedRecord.leastFavouriteDish || '—'}</p>
                  <p><strong>Suggested Dishes:</strong> {selectedRecord.suggestedDishes || '—'}</p>
                  <p><strong>Allergies / Special Dietary:</strong> {selectedRecord.knownAllergies || selectedRecord.dietaryRequirements || 'None reported'}</p>
                </div>
              </div>

              {selectedRecord.otherFeedback && (
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xs">
                  <span className="font-semibold text-neutral-800 block mb-1">Additional Feedback:</span>
                  <p className="text-neutral-700 whitespace-pre-wrap">{selectedRecord.otherFeedback}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-[#e1dfdd] bg-[#faf9f8] flex justify-end">
              <button
                type="button"
                onClick={() => setIsViewOpen(false)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xs transition-colors cursor-pointer text-xs"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Table Customization Modal for Super Admin */}
      <TableSchemaEditorModal<FoodSurveyRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Food Surveys"
        columns={schemaColumns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
