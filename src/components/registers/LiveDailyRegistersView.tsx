import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Calendar, 
  Hotel, 
  Search, 
  Plus, 
  SlidersHorizontal, 
  Lock,
  RefreshCw 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { getActiveRegisterExportConfig, executeRegisterExport } from './registerExportConfigs';
import { LiveRegisterStatsSection } from './LiveRegisterStatsSection';
import { RoomListSection } from './RoomListSection';
import { UserGuideSection } from './UserGuideSection';
import { DailyRegisterSection } from './DailyRegisterSection';
import { RegisterValidationSection } from './RegisterValidationSection';
import { LanguageSummarySection } from './LanguageSummarySection';
import { NewArrivalsSection } from './NewArrivalsSection';
import { RegisterSummarySection } from './RegisterSummarySection';
import { LiveRegisterKpiCards } from './LiveRegisterKpiCards';

export type DailyRegisterTab = 
  | 'stats'
  | 'roomList'
  | 'userGuide'
  | 'dailyRegister'
  | 'validation'
  | 'languages'
  | 'newArrivals'
  | 'summary';

interface SheetTabConfig {
  id: DailyRegisterTab;
  label: string;
  pillClass?: string;
  isUnderline?: boolean;
}

const SHEET_TABS: SheetTabConfig[] = [
  { id: 'stats', label: 'Live Register Statistics' },
  { id: 'roomList', label: 'Room List', pillClass: 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]' },
  { id: 'userGuide', label: 'User Guide', pillClass: 'bg-[#9ca3af] text-white hover:bg-[#6b7280]' },
  { id: 'dailyRegister', label: 'Daily Register', pillClass: 'bg-[#16a34a] text-white hover:bg-[#15803d]' },
  { id: 'validation', label: 'Cross Checks & Validation', pillClass: 'bg-[#d1d5db] text-[#1f2937] hover:bg-[#9ca3af]' },
  { id: 'languages', label: 'Language Summary' },
  { id: 'newArrivals', label: 'New Arrivals' },
  { id: 'summary', label: 'Summary', pillClass: 'bg-[#f59e0b] text-white hover:bg-[#d97706]' }
];

export const LiveDailyRegistersView: React.FC = () => {
  const {
    sites,
    assignedSite,
    canAccessAllSites,
    dailyRegisterRooms,
    dailyRegisterRecords,
    newArrivalsRecords,
    evictionRecords,
    dispersalRecords,
    currentUserRole,
    canCreateRecord,
    syncFromDatabase
  } = useApp();

  const [isSyncing, setIsSyncing] = useState(false);
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncFromDatabase();
    } finally {
      setIsSyncing(false);
    }
  };

  const [activeTab, setActiveTab] = useState<DailyRegisterTab>('dailyRegister');

  useEffect(() => {
    if (activeTab === 'newArrivals') {
      handleManualSync();
    }
  }, [activeTab]);

  const [selectedSite, setSelectedSite] = useState<string>(() => {
    return assignedSite && assignedSite !== 'All Sites' ? assignedSite : 'all';
  });
  const [registerDate, setRegisterDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'Occupied' | 'Vacant'>('all');

  // Unified dynamic action triggers
  const [createTrigger, setCreateTrigger] = useState(0);
  const [customizeTrigger, setCustomizeTrigger] = useState(0);

  // Strict Site Isolation
  const effectiveSite = !canAccessAllSites() && assignedSite && assignedSite !== 'All Sites'
    ? assignedSite
    : selectedSite;

  const availableSites = useMemo(() => {
    return (sites || []).map(s => typeof s === 'string' ? s : s?.name).filter(Boolean);
  }, [sites]);

  const isSiteMatch = (recordSite?: string | null, targetSite?: string | null) => {
    if (!targetSite || targetSite === 'all' || targetSite === 'All Sites') return true;
    if (!recordSite) return false;
    const r = recordSite.trim().toLowerCase();
    const t = targetSite.trim().toLowerCase();
    return r === t || r === 'all sites' || r.includes(t) || t.includes(r);
  };

  // Scoped Data strictly bounded by effectiveSite
  const scopedRooms = useMemo(() => {
    return dailyRegisterRooms.filter(r => isSiteMatch(r.hotel, effectiveSite));
  }, [dailyRegisterRooms, effectiveSite]);

  const scopedRecords = useMemo(() => {
    return dailyRegisterRecords.filter(r => isSiteMatch(r.hotel, effectiveSite));
  }, [dailyRegisterRecords, effectiveSite]);

  const scopedArrivals = useMemo(() => {
    return newArrivalsRecords.filter(a => isSiteMatch(a.hotel, effectiveSite));
  }, [newArrivalsRecords, effectiveSite]);

  const scopedEvictions = useMemo(() => {
    return evictionRecords.filter(e => isSiteMatch(e.hotel, effectiveSite));
  }, [evictionRecords, effectiveSite]);

  // Operational KPI calculations
  const activeResidentsCount = useMemo(() => {
    return scopedRecords.filter(r => r.occupied === 'Yes' || !r.occupied).length;
  }, [scopedRecords]);

  const totalCapacity = useMemo(() => {
    return scopedRooms.reduce((sum, r) => sum + (Number(r.currentMaxOccupancy) || 0), 0);
  }, [scopedRooms]);

  const availableBedspaces = useMemo(() => {
    return scopedRooms.reduce((sum, r) => sum + (Number(r.bedspacesAvailable) || 0), 0);
  }, [scopedRooms]);

  const voidBedspaces = useMemo(() => {
    return scopedRooms.reduce((sum, r) => sum + (Number(r.voidBedspaces) || 0), 0);
  }, [scopedRooms]);

  const occupancyRate = totalCapacity > 0 
    ? Math.min(100, Math.round((activeResidentsCount / totalCapacity) * 100))
    : 0;

  // Active dynamic export configuration matching all other application pages
  const exportConfig = useMemo(() => {
    return getActiveRegisterExportConfig({
      activeTab,
      effectiveSite,
      registerDate,
      scopedRooms,
      scopedRecords,
      scopedArrivals,
      searchQuery,
      occupancyFilter
    });
  }, [
    activeTab,
    effectiveSite,
    registerDate,
    scopedRooms,
    scopedRecords,
    scopedArrivals,
    searchQuery,
    occupancyFilter
  ]);

  const handleExportPreview = (options: {
    scope: ExportScope;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    orientation: ExportOrientation;
    isCompact: boolean;
  }) => {
    const raw = exportConfig.getData(options.scope, options.startDate, options.endDate).slice(0, 5);
    const cols = options.selectedColumns && options.selectedColumns.length > 0
      ? exportConfig.columns.filter(c => options.selectedColumns!.includes(c.id))
      : exportConfig.columns.filter(c => c.defaultSelected !== false);
    const headers = cols.map(c => c.label);
    const rows = raw.map(item => exportConfig.formatRow(item, cols));
    return { headers, rows };
  };

  const handlePerformExport = (options: {
    format: ExportFormat;
    scope: ExportScope;
    orientation: ExportOrientation;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => {
    executeRegisterExport({
      ...options,
      config: exportConfig,
      effectiveSite
    });
  };

  const isCustomizableTab = ['dailyRegister', 'roomList', 'newArrivals'].includes(activeTab);

  // Tab Badge Resolver
  const getTabBadge = (id: DailyRegisterTab) => {
    if (id === 'roomList') return scopedRooms.length;
    if (id === 'dailyRegister') return activeResidentsCount;
    if (id === 'newArrivals') return scopedArrivals.length;
    return undefined;
  };

  // Dynamic Add / Log label
  const getCreateButtonLabel = () => {
    if (activeTab === 'dailyRegister') return '+ Log Service User';
    if (activeTab === 'roomList') return '+ Add Room';
    if (activeTab === 'newArrivals') return '+ Log Intake Arrival';
    return null;
  };

  const createLabel = getCreateButtonLabel();

  return (
    <div className="space-y-3">
      {/* 1. View Header with Dynamic Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#0d9488]" />
            <h1 className="text-xl font-bold text-[#242424] tracking-tight">
              Live Daily Registers (AASC Headcount)
            </h1>
            <span className="text-xs bg-teal-50 text-[#0d9488] font-bold px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0d9488] animate-pulse" />
              Live Operations
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Real-time room occupancy roster, bedspace inventory, service user headcount, and Home Office arrivals/evictions.
          </p>
        </div>

        {/* Dynamic Header Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs cursor-pointer transition-colors"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#0d9488]' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync with DB'}</span>
          </button>

          {currentUserRole === 'Super Admin' && isCustomizableTab && (
            <button
              onClick={() => setCustomizeTrigger(prev => prev + 1)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs cursor-pointer"
              title="Customize Table Schema"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#0d9488]" />
              <span>Customize</span>
            </button>
          )}

          {/* Unified Export Dropdown (Standard split-button with live modal preview matching all pages) */}
          <ExportDropdown
            moduleName={exportConfig.moduleName}
            totalRecordCount={exportConfig.totalCount}
            filteredRecordCount={exportConfig.filteredCount}
            defaultOrientation="landscape"
            availableColumns={exportConfig.columns}
            getPreviewData={handleExportPreview}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />

          {/* Dynamic + Log / Record Button */}
          {canCreateRecord() && createLabel && (
            <button
              onClick={() => setCreateTrigger(prev => prev + 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs text-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{createLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Exact Spreadsheet Sheet Tabs (Matches User Spreadsheet Layout & Colors) */}
      <div className="bg-[#f3f2f1] border border-[#d2d0ce] rounded-xs p-1.5 flex items-center gap-1.5 overflow-x-auto shadow-2xs">
        {SHEET_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const badge = getTabBadge(tab.id);
          const style = tab.pillClass
            ? `${tab.pillClass} px-3 py-1 rounded shadow-xs ${isActive ? 'ring-2 ring-offset-1 ring-black/30 scale-[1.03]' : 'opacity-90 hover:opacity-100'}`
            : tab.isUnderline
            ? `px-2.5 py-1 border-b-2 rounded-t ${isActive ? 'border-[#16a34a] text-[#16a34a] font-bold bg-white/60' : 'border-[#16a34a]/60 text-[#323130] hover:text-black hover:bg-white/40'}`
            : `px-2.5 py-1 rounded ${isActive ? 'bg-white text-[#242424] font-bold shadow-xs' : 'text-[#605e5c] hover:text-[#242424] hover:bg-white/50'}`;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${style}`}
            >
              <span>{tab.label}</span>
              {badge !== undefined && badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  tab.pillClass ? 'bg-white/20 text-white' : tab.isUnderline ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Consolidated Unified Filter Toolbar (ONE Place for All Filters) */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs p-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Hotel Scope & Isolation Filter */}
          {canAccessAllSites() ? (
            <div className="flex items-center gap-1.5">
              <Hotel className="w-3.5 h-3.5 text-[#0d9488]" />
              <span className="font-semibold text-[#605e5c]">Hotel:</span>
              <select
                value={selectedSite}
                onChange={e => setSelectedSite(e.target.value)}
                className="p-1 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#0d9488] cursor-pointer"
              >
                <option value="all">All Hotels &amp; Sites</option>
                {availableSites.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-100 border border-neutral-300 rounded text-xs">
              <Lock className="w-3 h-3 text-[#0f766e]" />
              <span className="font-semibold text-neutral-600">Site Scope:</span>
              <span className="font-bold text-[#0f766e]">{assignedSite || 'Assigned Hotel'}</span>
              <span className="text-[10px] bg-neutral-200 text-neutral-700 px-1 rounded font-mono">Isolated</span>
            </div>
          )}

          {/* Date Picker */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#0d9488]" />
            <span className="font-semibold text-[#605e5c]">Date:</span>
            <input 
              type="date"
              value={registerDate}
              onChange={e => setRegisterDate(e.target.value)}
              className="p-1 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs focus:outline-2 focus:outline-[#0d9488] cursor-pointer font-medium"
            />
          </div>

          {/* Dynamic Contextual Filters */}
          {activeTab === 'dailyRegister' && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#605e5c]">Occupancy:</span>
              <select
                value={occupancyFilter}
                onChange={e => setOccupancyFilter(e.target.value as any)}
                className="p-1 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs cursor-pointer"
              >
                <option value="all">All Rooms</option>
                <option value="Occupied">Occupied Only</option>
                <option value="Vacant">Vacant Only</option>
              </select>
            </div>
          )}

          {/* Consolidated Search Input */}
          <div className="relative min-w-[220px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-[#605e5c] absolute left-2.5 top-2 pointer-events-none" />
            <input 
              type="text"
              placeholder={`Search ${SHEET_TABS.find(t => t.id === activeTab)?.label}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-6 py-1 bg-white border border-[#8a8886] rounded-xs text-xs text-[#242424] placeholder:text-[#a19f9d] focus:outline-none focus:border-[#0d9488]"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-neutral-400 hover:text-neutral-700 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Live Headcount Summary Pill */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] bg-teal-50 text-[#0d9488] font-bold px-2 py-0.5 rounded border border-teal-200">
            {activeResidentsCount} SUs Present · {availableBedspaces} Beds Free · {scopedRooms.length} Rooms
          </span>
        </div>
      </div>

      {/* 4. Operational KPI Metrics Scorecard */}
      <LiveRegisterKpiCards
        activeResidentsCount={activeResidentsCount}
        totalCapacity={totalCapacity}
        occupancyRate={occupancyRate}
        availableBedspaces={availableBedspaces}
        roomCount={scopedRooms.length}
        voidBedspaces={voidBedspaces}
        pendingArrivalsCount={scopedArrivals.length}
      />

      {/* 5. Active Tab Viewport Area */}
      <div className="w-full">
        {activeTab === 'dailyRegister' && (
          <DailyRegisterSection
            selectedSite={effectiveSite}
            registerDate={registerDate}
            onDateChange={setRegisterDate}
            searchQuery={searchQuery}
            occupancyFilter={occupancyFilter}
            createTrigger={createTrigger}
            customizeTrigger={customizeTrigger}
          />
        )}

        {activeTab === 'roomList' && (
          <RoomListSection 
            selectedSite={effectiveSite}
            searchQuery={searchQuery}
            createTrigger={createTrigger}
            customizeTrigger={customizeTrigger}
          />
        )}

        {activeTab === 'newArrivals' && (
          <NewArrivalsSection 
            selectedSite={effectiveSite}
            searchQuery={searchQuery}
            createTrigger={createTrigger}
            customizeTrigger={customizeTrigger}
          />
        )}

        {activeTab === 'stats' && (
          <LiveRegisterStatsSection
            records={scopedRecords}
            selectedSite={effectiveSite}
            selectedDate={registerDate}
          />
        )}

        {activeTab === 'summary' && (
          <RegisterSummarySection
            rooms={scopedRooms}
            records={scopedRecords}
            selectedSite={effectiveSite}
          />
        )}

        {activeTab === 'validation' && (
          <RegisterValidationSection
            records={scopedRecords}
            rooms={scopedRooms}
            selectedSite={effectiveSite}
          />
        )}

        {activeTab === 'languages' && (
          <LanguageSummarySection
            records={scopedRecords}
            selectedSite={effectiveSite}
          />
        )}


        {activeTab === 'userGuide' && (
          <UserGuideSection />
        )}
      </div>
    </div>
  );
};
