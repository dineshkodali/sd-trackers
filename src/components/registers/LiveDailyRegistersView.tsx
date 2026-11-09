import { IconX as CloseIcon } from '@tabler/icons-react';
import React, { useState, useMemo, useEffect } from 'react';
import { IconBuilding as Building2, IconSearch as Search, IconPlus as Plus, IconAdjustmentsHorizontal as SlidersHorizontal, IconLock as Lock, IconRefresh as RefreshCw } from '@tabler/icons-react';
import { suPropertyService } from '../../services/suPropertyService';
import { buildRegisterSyncPlan } from '../../utils/registerMasterSync';
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
import { FamilyGroupsSection } from './FamilyGroupsSection';
import { RegisterSummarySection } from './RegisterSummarySection';
import { LiveRegisterKpiCards } from './LiveRegisterKpiCards';
import { RegisterGuestFilters } from './RegisterGuestFilters';
import { useGuestContext } from '../../hooks/useGuestContext';
import {
  NO_GUEST_FILTER, clearRegisterFilterIntent, filterRegisterRecords, isGuestFilterActive, readRegisterFilterIntent,
  type GuestFilter,
} from '../../utils/guestStats';

export type DailyRegisterTab = 
  | 'dailyRegister'
  | 'summary'
  | 'stats'
  | 'roomList'
  | 'newArrivals'
  | 'families'
  | 'languages'
  | 'validation'
  | 'userGuide';

interface SheetTabConfig {
  id: DailyRegisterTab;
  label: string;
}

const SHEET_TABS: SheetTabConfig[] = [
  { id: 'dailyRegister', label: 'Daily Register' },
  { id: 'summary', label: 'Summary & Guest Statistics' },
  { id: 'stats', label: 'Live Register Statistics' },
  { id: 'roomList', label: 'Room List' },
  { id: 'newArrivals', label: 'New Arrivals' },
  { id: 'families', label: 'Family Groups' },
  { id: 'languages', label: 'Language Summary' },
  { id: 'validation', label: 'Cross Checks & Validation' },
  { id: 'userGuide', label: 'User Guide' }
];

export const LiveDailyRegistersView: React.FC = () => {
  const {
    sites,
    assignedSite,
    allowedSites,
    canAccessAllSites,
    navigateToPageWithSearch,
    dailyRegisterRooms,
    dailyRegisterRecords,
    newArrivalsRecords,
    evictionRecords,
    dispersalRecords,
    currentUserRole,
    canCreateRecord,
    isSitePermitted,
    syncFromDatabase,
    defaultSiteFilter,
    liveDataStatus,
    addDailyRegisterRoom,
    addDailyRegisterRecord,
    updateDailyRegisterRecord,
    updateNewArrivalRecord
  } = useApp();

  // Keep the register in line with the Rooms / Service User master data: missing rooms and
  // active placements are added, existing register rows are never touched.
  const latest = React.useRef({ sites, dailyRegisterRooms, dailyRegisterRecords, newArrivalsRecords });
  latest.current = { sites, dailyRegisterRooms, dailyRegisterRecords, newArrivalsRecords };
  const syncing = React.useRef(false);
  const runMasterSync = React.useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      // Old data first: one current placement per resident, so the register follows a single room.
      await suPropertyService.repairPlacements();
      const { sites: s, dailyRegisterRooms: rooms, dailyRegisterRecords: records, newArrivalsRecords: arrivals } = latest.current;
      const plan = await buildRegisterSyncPlan(
        (s || []).map((x: any) => typeof x === 'string' ? { id: x, name: x } : { id: x.id, name: x.name }),
        rooms,
        records,
        arrivals
      );
      plan.rooms.forEach(r => addDailyRegisterRoom(r));
      plan.records.forEach(r => addDailyRegisterRecord(r));
      plan.recordUpdates.forEach(u => updateDailyRegisterRecord(u.id, u.changes));
      plan.arrivalUpdates.forEach(u => updateNewArrivalRecord(u.id, u.changes));
    } catch (err) {
      console.error('Register sync with Rooms / Service Users failed:', err);
    } finally {
      syncing.current = false;
    }
  }, [addDailyRegisterRoom, addDailyRegisterRecord, updateDailyRegisterRecord, updateNewArrivalRecord]);

  const dataReady = liveDataStatus.state === 'live' || liveDataStatus.state === 'degraded';
  useEffect(() => {
    if (!dataReady) return;
    runMasterSync();
    const onMasterChange = () => { runMasterSync(); };
    window.addEventListener('sdtracker:masterDataUpdated', onMasterChange);
    return () => window.removeEventListener('sdtracker:masterDataUpdated', onMasterChange);
  }, [dataReady, runMasterSync, liveDataStatus.lastSyncAt]);

  const [isSyncing, setIsSyncing] = useState(false);
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncFromDatabase();
    } finally {
      setIsSyncing(false);
    }
  };

  // A click on the Dashboard's guest statistics arrives here as a filter. It is read once and cleared.
  const [intent] = useState(() => readRegisterFilterIntent());
  useEffect(() => { if (intent) clearRegisterFilterIntent(); }, [intent]);
  const [guestFilter, setGuestFilter] = useState<GuestFilter>(intent?.filter ?? NO_GUEST_FILTER);
  const { ctx: guestCtx, error: guestCtxError } = useGuestContext();

  const [activeTab, setActiveTab] = useState<DailyRegisterTab>('dailyRegister');

  useEffect(() => {
    if (activeTab === 'newArrivals') {
      handleManualSync();
    }
  }, [activeTab]);

  const [selectedSite, setSelectedSite] = useState<string>(() => {
    const wanted = intent?.site;
    if (!wanted) return defaultSiteFilter;
    if (wanted === 'all') return canAccessAllSites() || (allowedSites || []).length > 1 ? 'all' : defaultSiteFilter;
    return isSitePermitted(wanted) ? wanted : defaultSiteFilter;
  });

  // Always keep selectedSite synchronized automatically with the central top nav bar site filter
  useEffect(() => {
    setSelectedSite(defaultSiteFilter);
  }, [defaultSiteFilter]);

  const [registerDate, setRegisterDate] = useState<string>(() => {
    return intent?.date || new Date().toISOString().slice(0, 10);
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'Occupied' | 'Vacant'>('all');

  // Unified dynamic action triggers
  const [createTrigger, setCreateTrigger] = useState(0);
  const [customizeTrigger, setCustomizeTrigger] = useState(0);

  // Strict Site Isolation - only single-site staff are locked
  const isLockedToSingleSite = !canAccessAllSites() && (allowedSites || []).length <= 1;
  const effectiveSite = isLockedToSingleSite && assignedSite && assignedSite !== 'All Sites'
    ? assignedSite
    : selectedSite;

  const availableSites = useMemo(() => {
    return (sites || []).map(s => typeof s === 'string' ? s : s?.name).filter(Boolean);
  }, [sites]);

  const isSiteMatch = (recordSite?: string | null, targetSite?: string | null) => {
    return isSitePermitted(recordSite, targetSite);
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

  const guestFilteredCount = useMemo(
    () => filterRegisterRecords(scopedRecords, guestCtx, guestFilter, registerDate).length,
    [scopedRecords, guestCtx, guestFilter, registerDate]
  );

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
    <div className="space-y-4">
      {/* Top Banner, Header, Actions, Tabs & Filters in ONE unified section */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 border border-teal-200 text-[#0d9488] rounded-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424] tracking-tight">Live Daily Registers (AASC Headcount)</h1>
              </div>
              <p className="text-xs text-neutral-500">Room occupancy, bedspaces, headcount, arrivals and evictions.</p>
            </div>
          </div>

          {/* Dynamic Header Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-neutral-50 text-neutral-700 border border-[#e5e5e5] rounded-xs shadow-2xs cursor-pointer transition-colors"
              title="Refresh database records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#0d9488]' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync with DB'}</span>
            </button>

            {currentUserRole === 'Super Admin' && isCustomizableTab && (
              <button
                onClick={() => setCustomizeTrigger(prev => prev + 1)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-neutral-50 text-neutral-700 border border-[#e5e5e5] rounded-xs shadow-2xs cursor-pointer"
                title="Customize Table Schema"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0078d4]" />
                <span>Customize Table</span>
              </button>
            )}

            {activeTab !== 'families' && <ExportDropdown
              moduleName={exportConfig.moduleName}
              totalRecordCount={exportConfig.totalCount}
              filteredRecordCount={exportConfig.filteredCount}
              defaultOrientation="landscape"
              availableColumns={exportConfig.columns}
              getPreviewData={handleExportPreview}
              onExport={handlePerformExport}
              buttonVariant="toolbar"
            />}

            {canCreateRecord() && createLabel && (
              <button
                onClick={() => setCreateTrigger(prev => prev + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-2xs text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{createLabel}</span>
              </button>
            )}
          </div>
        </div>

        {/* Professional Spreadsheet Sheet Tabs */}
        <div className="mt-3.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xs p-1 flex items-center gap-1 overflow-x-auto shadow-2xs">
          {SHEET_TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const badge = getTabBadge(tab.id);

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xs ${
                  isActive
                    ? 'bg-white text-[#0f766e] font-bold shadow-xs border border-[#99f6e4] ring-1 ring-[#0d9488]/20'
                    : 'text-[#64748b] hover:text-[#0f172a] hover:bg-white/70 border border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                {badge !== undefined && badge > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Consolidated Unified Filter Row */}
        <div className="mt-3.5 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text"
              placeholder={`Search ${SHEET_TABS.find(t => t.id === activeTab)?.label}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-6 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] placeholder-neutral-400 focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Centralized Static Property / Site Indicator (Synced with Top Nav Bar) */}
          <div 
            className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs shadow-2xs"
            title="Site filter is controlled centrally by the top navigation bar"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />
              <span className="text-neutral-500 font-medium">Site:</span>
              <span className="font-bold text-[#0f766e] truncate">
                {effectiveSite === 'all' || effectiveSite === 'All Sites' || !effectiveSite
                  ? (canAccessAllSites() || (allowedSites && allowedSites.length > 1)
                      ? (canAccessAllSites() ? `All Properties (${sites.length} Hotels)` : `All Assigned (${allowedSites?.length || 0} Sites)`)
                      : 'All Sites')
                  : effectiveSite}
              </span>
            </div>
            <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 shrink-0 flex items-center gap-0.5">
              <Lock className="w-2.5 h-2.5" /> Top Bar
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <input 
              type="date"
              value={registerDate}
              onChange={e => setRegisterDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all cursor-pointer font-medium"
            />
          </div>

          {activeTab === 'dailyRegister' ? (
            <select
              value={occupancyFilter}
              onChange={e => setOccupancyFilter(e.target.value as any)}
              className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all cursor-pointer"
            >
              <option value="all">All Rooms</option>
              <option value="Occupied">Occupied Only</option>
              <option value="Vacant">Vacant Only</option>
            </select>
          ) : (
            <div className="flex items-center justify-end">
              <span className="text-[11px] bg-teal-50 text-[#0d9488] font-bold px-2 py-1 rounded border border-teal-200">
                {activeResidentsCount} SUs · {availableBedspaces} Beds Free · {scopedRooms.length} Rooms
              </span>
            </div>
          )}
        </div>

        {activeTab === 'dailyRegister' && (
          <RegisterGuestFilters
            value={guestFilter}
            onChange={setGuestFilter}
            shown={guestFilteredCount}
            total={scopedRecords.length}
            defaultOpen={!!intent && isGuestFilterActive(intent.filter)}
            familyNote={guestCtxError && guestFilter.family !== 'all' ? `Family groups could not be loaded, so family size uses the people sharing a room. ${guestCtxError}` : null}
          />
        )}
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
            guestFilter={guestFilter}
            guestContext={guestCtx}
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
            selectedDate={registerDate}
            onDateChange={setRegisterDate}
            onSelectFilter={(filter) => {
              setGuestFilter(prev => ({ ...prev, ...filter }));
              setActiveTab('dailyRegister');
            }}
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


        {activeTab === 'families' && (
          <FamilyGroupsSection onOpenProfile={(_suId, reference) => navigateToPageWithSearch('suUsers', reference)} />
        )}

        {activeTab === 'userGuide' && (
          <UserGuideSection />
        )}
      </div>
    </div>
  );
};
