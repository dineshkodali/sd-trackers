import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  X, 
  FileText, 
  Shield, 
  Wrench, 
  AlertTriangle, 
  AlertCircle, 
  Zap, 
  Utensils, 
  Shirt, 
  Building2, 
  ChevronRight, 
  ChevronDown, 
  SlidersHorizontal, 
  CornerDownLeft,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export type SearchCategory = 
  | 'all' 
  | 'referrals' 
  | 'spcd' 
  | 'maintenance' 
  | 'vulnerable' 
  | 'challenging' 
  | 'escalations' 
  | 'food' 
  | 'laundry' 
  | 'properties';

interface GlobalSearchResult {
  id: string;
  category: SearchCategory;
  categoryLabel: string;
  targetPage: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  site?: string;
  room?: string;
  ref?: string;
  matchContext?: string;
  rawRecord: any;
  searchFilterQuery: string;
}

export const GlobalSearchBar: React.FC = () => {
  const {
    referrals,
    vulnerableSUs,
    challengingSUs,
    maintenanceRecords,
    spcdRecords,
    escalations,
    foodRecords,
    laundryRecords,
    sites,
    navigateToPageWithSearch
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('all');
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcut: Ctrl+K or Cmd+K or "/"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in another input/textarea
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (!isInput && e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setIsMobileSearchOpen(false);
        inputRef.current?.blur();
        mobileInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When mobile search opens, autofocus
  useEffect(() => {
    if (isMobileSearchOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 50);
    }
  }, [isMobileSearchOpen]);

  // Comprehensive Multi-term Search
  const resultsByCategory = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return {
        referrals: [],
        spcd: [],
        maintenance: [],
        vulnerable: [],
        challenging: [],
        escalations: [],
        food: [],
        laundry: [],
        properties: []
      };
    }

    const tokens = trimmed.split(/\s+/).filter(Boolean);

    const matchesAllTokens = (fields: (string | undefined | null | number)[]): boolean => {
      const combined = fields.filter(f => f !== undefined && f !== null).map(f => String(f).toLowerCase()).join(' ');
      return tokens.every(token => combined.includes(token));
    };

    // 1. Safeguarding Referrals
    const matchedReferrals: GlobalSearchResult[] = referrals
      .filter(r => matchesAllTokens([
        r.suName,
        r.portRef,
        r.mosaicId,
        r.site,
        r.referralType,
        r.referralCouncil,
        r.status,
        r.urgency,
        r.officerLeadingHotel,
        r.notesActionTaken
      ]))
      .slice(0, 8)
      .map(r => ({
        id: `ref-${r.id}`,
        category: 'referrals',
        categoryLabel: 'Safeguarding Referral',
        targetPage: 'referrals',
        title: r.suName,
        subtitle: `${r.site} • ${r.referralType || 'Referral'}`,
        badge: r.status,
        badgeColor: r.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-teal-100 text-blue-800',
        site: r.site,
        ref: r.portRef || r.mosaicId,
        matchContext: r.notesActionTaken ? `Notes: ${r.notesActionTaken.substring(0, 75)}...` : undefined,
        rawRecord: r,
        searchFilterQuery: r.suName || r.portRef
      }));

    // 2. Safeguarding & SPCD Tracker
    const matchedSPCD: GlobalSearchResult[] = spcdRecords
      .filter(s => matchesAllTokens([
        s.suName,
        s.suPortReference,
        s.roomNumber,
        s.siteName,
        s.staffReporting,
        s.briefDescriptionActionTaken,
        s.sgReview,
        s.followUpNotes,
        s.updates
      ]))
      .slice(0, 8)
      .map(s => ({
        id: `spcd-${s.id}`,
        category: 'spcd',
        categoryLabel: 'Safeguarding SPCD',
        targetPage: 'spcd',
        title: s.suName,
        subtitle: `${s.siteName} • Room ${s.roomNumber || 'N/A'}`,
        badge: s.sgReview,
        badgeColor: 'bg-teal-100 text-teal-800',
        site: s.siteName,
        room: s.roomNumber,
        ref: s.suPortReference,
        matchContext: s.briefDescriptionActionTaken ? s.briefDescriptionActionTaken.substring(0, 80) + '...' : undefined,
        rawRecord: s,
        searchFilterQuery: s.suName || s.suPortReference
      }));

    // 3. Maintenance & Repairs
    const matchedMaintenance: GlobalSearchResult[] = maintenanceRecords
      .filter(m => matchesAllTokens([
        m.id,
        m.description,
        m.location,
        m.site,
        m.room,
        m.priority,
        m.defectStatus,
        m.action,
        m.raisedBy,
        m.progress
      ]))
      .slice(0, 8)
      .map(m => ({
        id: `maint-${m.id}`,
        category: 'maintenance',
        categoryLabel: 'Maintenance Defect',
        targetPage: 'maintenance',
        title: `${m.id}: ${m.description.substring(0, 45)}${m.description.length > 45 ? '...' : ''}`,
        subtitle: `${m.site} • ${m.location || m.room || 'General'}`,
        badge: `${m.priority} • ${m.defectStatus}`,
        badgeColor: m.defectStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800',
        site: m.site,
        room: m.room,
        ref: m.id,
        matchContext: m.progress ? `Progress: ${m.progress.substring(0, 75)}...` : undefined,
        rawRecord: m,
        searchFilterQuery: m.id
      }));

    // 4. Vulnerable SUs
    const matchedVulnerable: GlobalSearchResult[] = vulnerableSUs
      .filter(v => matchesAllTokens([
        v.suName,
        v.portOrNassRef,
        v.roomOrFlatNo,
        v.site,
        v.vulnerability,
        v.riskLevel,
        v.status,
        v.allocatedWorker,
        v.notesActionTaken
      ]))
      .slice(0, 8)
      .map(v => ({
        id: `vuln-${v.id}`,
        category: 'vulnerable',
        categoryLabel: 'Vulnerable Resident',
        targetPage: 'vulnerable',
        title: v.suName,
        subtitle: `${v.site} • Room ${v.roomOrFlatNo}`,
        badge: `${v.riskLevel} Risk • ${v.status}`,
        badgeColor: v.riskLevel === 'Critical' || v.riskLevel === 'High' ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-amber-50 text-amber-800',
        site: v.site,
        room: v.roomOrFlatNo,
        ref: v.portOrNassRef,
        matchContext: v.vulnerability ? `Vulnerability: ${v.vulnerability.substring(0, 75)}...` : undefined,
        rawRecord: v,
        searchFilterQuery: v.suName || v.portOrNassRef
      }));

    // 5. Challenging Behaviour
    const matchedChallenging: GlobalSearchResult[] = challengingSUs
      .filter(c => matchesAllTokens([
        c.name,
        c.portRef,
        c.site,
        c.typeOfIssue,
        c.incidentDescription,
        c.riskFactor,
        c.status,
        c.actionTaken
      ]))
      .slice(0, 8)
      .map(c => ({
        id: `chal-${c.id}`,
        category: 'challenging',
        categoryLabel: 'Challenging Behaviour',
        targetPage: 'challenging',
        title: c.name,
        subtitle: `${c.site} • ${c.typeOfIssue}`,
        badge: `${c.riskFactor || 'Risk'} • ${c.status}`,
        badgeColor: 'bg-purple-100 text-purple-800',
        site: c.site,
        ref: c.portRef,
        matchContext: c.incidentDescription ? `Incident: ${c.incidentDescription.substring(0, 75)}...` : undefined,
        rawRecord: c,
        searchFilterQuery: c.name || c.portRef
      }));

    // 6. Incident Escalations
    const matchedEscalations: GlobalSearchResult[] = escalations
      .filter(e => matchesAllTokens([
        e.suName,
        e.suPortNassRef,
        e.siteName,
        e.site,
        e.incidentType,
        e.personReporting,
        e.status,
        e.incidentNotes,
        e.actionTaken,
        e.wlIssued
      ]))
      .slice(0, 8)
      .map(e => ({
        id: `esc-${e.id}`,
        category: 'escalations',
        categoryLabel: 'Incident Escalation',
        targetPage: 'escalations',
        title: e.suName || e.incidentType || 'Incident',
        subtitle: `${e.siteName || e.site} • ${e.incidentType}`,
        badge: e.status,
        badgeColor: e.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800 font-semibold',
        site: e.siteName || e.site,
        ref: e.suPortNassRef,
        matchContext: e.incidentNotes ? e.incidentNotes.substring(0, 80) + '...' : undefined,
        rawRecord: e,
        searchFilterQuery: e.suName || e.suPortNassRef || e.incidentType
      }));

    // 7. Hot Food & Nutrition
    const matchedFood: GlobalSearchResult[] = foodRecords
      .filter(f => matchesAllTokens([
        f.residentName,
        f.roomNo,
        f.site,
        f.dietaryRequirement,
        f.mealType,
        f.status,
        f.deliveredBy,
        f.notes
      ]))
      .slice(0, 6)
      .map(f => ({
        id: `food-${f.id}`,
        category: 'food',
        categoryLabel: 'Food & Nutrition',
        targetPage: 'food',
        title: f.residentName,
        subtitle: `${f.site} • Room ${f.roomNo} • ${f.dietaryRequirement}`,
        badge: `${f.mealType}: ${f.status}`,
        badgeColor: f.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-800',
        site: f.site,
        room: f.roomNo,
        matchContext: f.notes ? `Note: ${f.notes}` : undefined,
        rawRecord: f,
        searchFilterQuery: f.residentName
      }));

    // 8. Laundry Services
    const matchedLaundry: GlobalSearchResult[] = laundryRecords
      .filter(l => matchesAllTokens([
        l.residentName,
        l.roomNo,
        l.ref,
        l.site,
        l.status,
        l.staffInitials,
        l.notes
      ]))
      .slice(0, 6)
      .map(l => ({
        id: `laundry-${l.id}`,
        category: 'laundry',
        categoryLabel: 'Laundry Log',
        targetPage: 'laundry',
        title: l.residentName,
        subtitle: `${l.site} • Room ${l.roomNo} • Ref: ${l.ref || 'N/A'}`,
        badge: l.status,
        badgeColor: l.status === 'Collected' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800',
        site: l.site,
        room: l.roomNo,
        ref: l.ref,
        matchContext: l.notes ? `Note: ${l.notes}` : undefined,
        rawRecord: l,
        searchFilterQuery: l.residentName || l.ref
      }));

    // 9. Properties & Hotels
    const matchedProperties: GlobalSearchResult[] = sites
      .filter(p => matchesAllTokens([
        p.name,
        p.pid,
        p.city,
        p.council,
        p.leadOfficer,
        p.status
      ]))
      .slice(0, 6)
      .map(p => ({
        id: `prop-${p.id}`,
        category: 'properties',
        categoryLabel: 'Accommodation Property',
        targetPage: 'properties',
        title: p.name,
        subtitle: `${p.city} • PID: ${p.pid || 'N/A'} • ${p.activeResidents || 0} Residents`,
        badge: p.status,
        badgeColor: p.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
        site: p.name,
        ref: p.pid,
        matchContext: p.leadOfficer ? `Lead Officer: ${p.leadOfficer}` : undefined,
        rawRecord: p,
        searchFilterQuery: p.name
      }));

    return {
      referrals: matchedReferrals,
      spcd: matchedSPCD,
      maintenance: matchedMaintenance,
      vulnerable: matchedVulnerable,
      challenging: matchedChallenging,
      escalations: matchedEscalations,
      food: matchedFood,
      laundry: matchedLaundry,
      properties: matchedProperties
    };
  }, [
    query,
    referrals,
    spcdRecords,
    maintenanceRecords,
    vulnerableSUs,
    challengingSUs,
    escalations,
    foodRecords,
    laundryRecords,
    sites
  ]);

  // Flattened displayed list according to selected category
  const displayedResults = useMemo(() => {
    if (selectedCategory === 'all') {
      return [
        ...resultsByCategory.referrals,
        ...resultsByCategory.spcd,
        ...resultsByCategory.maintenance,
        ...resultsByCategory.vulnerable,
        ...resultsByCategory.challenging,
        ...resultsByCategory.escalations,
        ...resultsByCategory.food,
        ...resultsByCategory.laundry,
        ...resultsByCategory.properties
      ];
    }
    return resultsByCategory[selectedCategory] || [];
  }, [selectedCategory, resultsByCategory]);

  const totalResultsCount = 
    resultsByCategory.referrals.length +
    resultsByCategory.spcd.length +
    resultsByCategory.maintenance.length +
    resultsByCategory.vulnerable.length +
    resultsByCategory.challenging.length +
    resultsByCategory.escalations.length +
    resultsByCategory.food.length +
    resultsByCategory.laundry.length +
    resultsByCategory.properties.length;

  // Handle keyboard navigation inside results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < displayedResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : displayedResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < displayedResults.length) {
        handleSelectResult(displayedResults[selectedIndex]);
      } else if (displayedResults.length > 0) {
        handleSelectResult(displayedResults[0]);
      }
    }
  };

  const handleSelectResult = (item: GlobalSearchResult) => {
    navigateToPageWithSearch(item.targetPage, item.searchFilterQuery);
    setIsOpen(false);
    setIsMobileSearchOpen(false);
    setQuery('');
  };

  const handleQuickJump = (page: string, defaultCategory: SearchCategory) => {
    setSelectedCategory(defaultCategory);
    navigateToPageWithSearch(page, '');
    setIsOpen(false);
    setIsMobileSearchOpen(false);
    setQuery('');
  };

  // Helper to render Category Icon
  const getCategoryIcon = (cat: SearchCategory) => {
    switch (cat) {
      case 'referrals':
        return <FileText className="w-3.5 h-3.5 text-[#0d9488]" />;
      case 'spcd':
        return <Shield className="w-3.5 h-3.5 text-[#0f766e]" />;
      case 'maintenance':
        return <Wrench className="w-3.5 h-3.5 text-[#d13438]" />;
      case 'vulnerable':
        return <AlertTriangle className="w-3.5 h-3.5 text-[#d83b01]" />;
      case 'challenging':
        return <AlertCircle className="w-3.5 h-3.5 text-[#7c3aed]" />;
      case 'escalations':
        return <Zap className="w-3.5 h-3.5 text-[#b146c2]" />;
      case 'food':
        return <Utensils className="w-3.5 h-3.5 text-[#107c10]" />;
      case 'laundry':
        return <Shirt className="w-3.5 h-3.5 text-[#0078d4]" />;
      case 'properties':
        return <Building2 className="w-3.5 h-3.5 text-[#4f6bed]" />;
      default:
        return <Search className="w-3.5 h-3.5 text-[#605e5c]" />;
    }
  };

  // Category filter tabs data
  const categoryTabs: { id: SearchCategory; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: totalResultsCount },
    { id: 'referrals', label: 'Referrals', count: resultsByCategory.referrals.length },
    { id: 'spcd', label: 'Safeguarding SPCD', count: resultsByCategory.spcd.length },
    { id: 'maintenance', label: 'Maintenance', count: resultsByCategory.maintenance.length },
    { id: 'vulnerable', label: 'Vulnerable', count: resultsByCategory.vulnerable.length },
    { id: 'challenging', label: 'Challenging', count: resultsByCategory.challenging.length },
    { id: 'escalations', label: 'Escalations', count: resultsByCategory.escalations.length },
    { id: 'food', label: 'Food', count: resultsByCategory.food.length },
    { id: 'laundry', label: 'Laundry', count: resultsByCategory.laundry.length },
    { id: 'properties', label: 'Properties', count: resultsByCategory.properties.length }
  ];

  return (
    <div className="relative flex-1 max-w-xl mx-2 sm:mx-4" ref={containerRef}>
      {/* Desktop & Tablet Search Bar */}
      <div className="hidden sm:flex items-center w-full bg-[#f8f9fa] hover:bg-white focus-within:bg-white border border-[#c8c6c4] focus-within:border-[#0d9488] focus-within:ring-1 focus-within:ring-[#0d9488] rounded-xs shadow-2xs transition-all duration-150">
        {/* Category Pre-Filter Dropdown Selector */}
        <div className="relative border-r border-[#e1dfdd] shrink-0">
          <select
            id="global-search-category-select"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value as SearchCategory)}
            className="h-8 pl-2.5 pr-6 text-[11px] font-medium text-[#323130] bg-transparent border-0 cursor-pointer focus:outline-none appearance-none hover:text-[#0d9488]"
            title="Filter by category"
          >
            <option value="all">All Categories</option>
            <option value="referrals">Referrals</option>
            <option value="spcd">Safeguarding / SPCD</option>
            <option value="maintenance">Maintenance Defects</option>
            <option value="vulnerable">Vulnerable Residents</option>
            <option value="challenging">Challenging Behaviour</option>
            <option value="escalations">Escalations</option>
            <option value="food">Hot Food</option>
            <option value="laundry">Laundry</option>
            <option value="properties">Properties</option>
          </select>
          <ChevronDown className="w-3 h-3 absolute right-1.5 top-2.5 text-[#8a8886] pointer-events-none" />
        </div>

        {/* Input */}
        <div className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 ml-2.5 text-[#8a8886] shrink-0 pointer-events-none" />
          <input
            id="global-header-search-input"
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setIsOpen(true);
              setSelectedIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedCategory === 'all' 
                ? "Search residents, referrals, maintenance, safeguarding... (Ctrl+K)"
                : `Search in ${categoryTabs.find(t => t.id === selectedCategory)?.label || 'category'}...`
            }
            className="w-full py-1.5 pl-2 pr-16 text-xs text-[#323130] bg-transparent outline-none placeholder-[#8a8886]"
          />

          {/* Right Action: Clear or Shortcut hint */}
          <div className="absolute right-2 flex items-center gap-1">
            {query ? (
              <button
                id="btn-clear-global-search"
                onClick={() => {
                  setQuery('');
                  setSelectedIndex(-1);
                  inputRef.current?.focus();
                }}
                className="p-1 text-[#8a8886] hover:text-[#323130] rounded-xs hover:bg-[#edebe9]"
                title="Clear query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-[#797775] bg-[#f3f2f1] border border-[#d2d0ce] rounded-xs shadow-2xs select-none">
                Ctrl K
              </kbd>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Button (Visible on screens < 640px) */}
      <div className="sm:hidden flex items-center">
        <button
          id="btn-mobile-search-toggle"
          onClick={() => setIsMobileSearchOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#323130] hover:bg-[#edebe9] border border-[#8a8886] rounded-xs transition-colors"
          title="Open Global Search"
          aria-label="Open Global Search"
        >
          <Search className="w-3.5 h-3.5 text-[#0d9488]" />
          <span className="text-[11px] font-medium text-[#605e5c]">Search...</span>
        </button>
      </div>

      {/* Mobile Full-Screen / Overlay Search Drawer */}
      {isMobileSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col p-3 sm:hidden animate-fade-in">
          <div className="bg-white rounded-xs shadow-2xl border border-[#c8c6c4] flex flex-col max-h-[90vh] overflow-hidden">
            {/* Mobile Search Header */}
            <div className="p-2 border-b border-[#edebe9] flex items-center gap-2">
              <Search className="w-4 h-4 text-[#0d9488] ml-1 shrink-0" />
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                }}
                placeholder="Search residents, maintenance, safeguarding..."
                className="flex-1 py-1.5 text-xs text-[#323130] outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 text-[#8a8886] hover:text-[#323130]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsMobileSearchOpen(false)}
                className="px-2 py-1 text-xs font-semibold text-[#0d9488] hover:bg-[#f3f2f1] rounded-xs"
              >
                Done
              </button>
            </div>

            {/* Mobile Category Filters */}
            <div className="flex gap-1 overflow-x-auto p-2 border-b border-[#f3f2f1] bg-[#faf9f8] no-scrollbar">
              {categoryTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                    selectedCategory === tab.id
                      ? 'bg-[#0d9488] text-white'
                      : 'bg-white text-[#605e5c] border border-[#e1dfdd]'
                  }`}
                >
                  {tab.label} {tab.count > 0 ? `(${tab.count})` : ''}
                </button>
              ))}
            </div>

            {/* Mobile Results View */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-[#f3f2f1]">
              {!query.trim() ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-[#605e5c] mb-2 font-medium">Quick Category Jump:</p>
                  <div className="grid grid-cols-2 gap-1.5 text-left text-xs">
                    <button
                      onClick={() => handleQuickJump('referrals', 'referrals')}
                      className="p-2 rounded border border-[#e1dfdd] hover:bg-[#f3f8fd] flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#0d9488]" />
                      <span>Referrals</span>
                    </button>
                    <button
                      onClick={() => handleQuickJump('spcd', 'spcd')}
                      className="p-2 rounded border border-[#e1dfdd] hover:bg-[#f3f8fd] flex items-center gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5 text-[#0f766e]" />
                      <span>Safeguarding (SPCD)</span>
                    </button>
                    <button
                      onClick={() => handleQuickJump('maintenance', 'maintenance')}
                      className="p-2 rounded border border-[#e1dfdd] hover:bg-[#f3f8fd] flex items-center gap-1.5"
                    >
                      <Wrench className="w-3.5 h-3.5 text-[#d13438]" />
                      <span>Maintenance</span>
                    </button>
                    <button
                      onClick={() => handleQuickJump('vulnerable', 'vulnerable')}
                      className="p-2 rounded border border-[#e1dfdd] hover:bg-[#f3f8fd] flex items-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-[#d83b01]" />
                      <span>Vulnerable SUs</span>
                    </button>
                  </div>
                </div>
              ) : displayedResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#605e5c]">
                  No records found matching "{query}".
                </div>
              ) : (
                displayedResults.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectResult(item)}
                    className="p-2.5 hover:bg-[#f3f8fd] cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-[#0d9488] uppercase tracking-wider flex items-center gap-1">
                        {getCategoryIcon(item.category)}
                        {item.categoryLabel}
                      </span>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${item.badgeColor || 'bg-neutral-100 text-neutral-800'}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-xs text-[#242424]">{item.title}</div>
                    <div className="text-[11px] text-[#605e5c] mt-0.5">{item.subtitle}</div>
                    {item.matchContext && (
                      <div className="text-[10px] text-[#797775] mt-1 bg-[#faf9f8] p-1 rounded font-mono truncate">
                        {item.matchContext}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Search Dropdown Flyout */}
      {isOpen && (
        <div 
          id="global-search-dropdown-menu"
          className="hidden sm:block absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#c8c6c4] rounded-xs shadow-2xl z-50 max-h-[520px] flex flex-col overflow-hidden text-xs divide-y divide-[#edebe9] animate-fade-in"
        >
          {/* Header Bar with Category Filter Tabs */}
          <div className="bg-[#faf9f8] p-2.5 border-b border-[#edebe9]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#323130]">
                <Search className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>
                  {query.trim() 
                    ? `Search Results (${totalResultsCount} matches)` 
                    : 'Global Search & Quick Jump'}
                </span>
              </div>
              <span className="text-[10px] text-[#797775] flex items-center gap-1">
                <span>Navigate</span> <kbd className="px-1 bg-white border border-[#d2d0ce] rounded text-[9px]">↑↓</kbd>
                <span>Select</span> <kbd className="px-1 bg-white border border-[#d2d0ce] rounded text-[9px]">↵</kbd>
                <span>Close</span> <kbd className="px-1 bg-white border border-[#d2d0ce] rounded text-[9px]">Esc</kbd>
              </span>
            </div>

            {/* Quick Category Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              {categoryTabs.map(tab => {
                const isActive = selectedCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`filter-tab-${tab.id}`}
                    onClick={() => {
                      setSelectedCategory(tab.id);
                      setSelectedIndex(-1);
                    }}
                    className={`px-2 py-0.5 text-[11px] rounded font-medium shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                      isActive 
                        ? 'bg-[#0d9488] text-white shadow-xs font-semibold' 
                        : 'bg-white text-[#605e5c] hover:text-[#242424] hover:bg-[#edebe9] border border-[#d2d0ce]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {query.trim() && (
                      <span className={`text-[9px] px-1 rounded-full ${isActive ? 'bg-white/25 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body: Empty query suggestions or Match List */}
          <div className="overflow-y-auto max-h-[380px] divide-y divide-[#f3f2f1]">
            {!query.trim() ? (
              <div className="p-4 bg-white">
                <div className="text-[11px] font-bold text-[#797775] uppercase tracking-wider mb-2">
                  Direct Category Access
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    id="quick-jump-referrals"
                    onClick={() => handleQuickJump('referrals', 'referrals')}
                    className="p-2.5 rounded-xs border border-[#edebe9] hover:border-[#0d9488] hover:bg-[#f3f8fd] text-left transition-all group flex items-start gap-2"
                  >
                    <FileText className="w-4 h-4 text-[#0d9488] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs text-[#242424] group-hover:text-[#0d9488]">Safeguarding Referrals</div>
                      <div className="text-[10px] text-[#605e5c] mt-0.5">Mosaic, LA Cases & Actions</div>
                    </div>
                  </button>

                  <button
                    id="quick-jump-spcd"
                    onClick={() => handleQuickJump('spcd', 'spcd')}
                    className="p-2.5 rounded-xs border border-[#edebe9] hover:border-[#0f766e] hover:bg-[#f3f8fd] text-left transition-all group flex items-start gap-2"
                  >
                    <Shield className="w-4 h-4 text-[#0f766e] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs text-[#242424] group-hover:text-[#0f766e]">SPCD Safeguarding</div>
                      <div className="text-[10px] text-[#605e5c] mt-0.5">Incident logs & SG reviews</div>
                    </div>
                  </button>

                  <button
                    id="quick-jump-maintenance"
                    onClick={() => handleQuickJump('maintenance', 'maintenance')}
                    className="p-2.5 rounded-xs border border-[#edebe9] hover:border-[#d13438] hover:bg-[#fdf3f4] text-left transition-all group flex items-start gap-2"
                  >
                    <Wrench className="w-4 h-4 text-[#d13438] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs text-[#242424] group-hover:text-[#d13438]">Maintenance & Repairs</div>
                      <div className="text-[10px] text-[#605e5c] mt-0.5">CAT 1–3 defects & contractor logs</div>
                    </div>
                  </button>

                  <button
                    id="quick-jump-vulnerable"
                    onClick={() => handleQuickJump('vulnerable', 'vulnerable')}
                    className="p-2.5 rounded-xs border border-[#edebe9] hover:border-[#d83b01] hover:bg-[#fff9f5] text-left transition-all group flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-[#d83b01] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs text-[#242424] group-hover:text-[#d83b01]">Vulnerable Residents</div>
                      <div className="text-[10px] text-[#605e5c] mt-0.5">Health, medical & pregnant SUs</div>
                    </div>
                  </button>

                  <button
                    id="quick-jump-challenging"
                    onClick={() => handleQuickJump('challenging', 'challenging')}
                    className="p-2.5 rounded-xs border border-[#edebe9] hover:border-[#7c3aed] hover:bg-[#fbf7fe] text-left transition-all group flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-[#7c3aed] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs text-[#242424] group-hover:text-[#7c3aed]">Challenging Behaviour</div>
                      <div className="text-[10px] text-[#605e5c] mt-0.5">Aggression & room damage logs</div>
                    </div>
                  </button>

                  <button
                    id="quick-jump-escalations"
                    onClick={() => handleQuickJump('escalations', 'escalations')}
                    className="p-2.5 rounded-xs border border-[#edebe9] hover:border-[#b146c2] hover:bg-[#faf5fc] text-left transition-all group flex items-start gap-2"
                  >
                    <Zap className="w-4 h-4 text-[#b146c2] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs text-[#242424] group-hover:text-[#b146c2]">Incident Escalations</div>
                      <div className="text-[10px] text-[#605e5c] mt-0.5">Warning letters & multi-agency</div>
                    </div>
                  </button>
                </div>

                <div className="mt-3.5 pt-3 border-t border-[#edebe9] text-[11px] text-[#605e5c] flex items-center justify-between">
                  <span>💡 Tip: Type a resident name, Port reference, room number, or defect ID.</span>
                  <span className="font-medium text-[#0d9488]">Instant search across 9 categories</span>
                </div>
              </div>
            ) : displayedResults.length === 0 ? (
              <div className="p-8 text-center bg-white">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                  <Search className="w-5 h-5" />
                </div>
                <div className="font-semibold text-sm text-[#242424]">No matching records found</div>
                <p className="text-xs text-[#605e5c] mt-1 max-w-sm mx-auto">
                  We could not find any records matching <strong className="text-neutral-900 font-semibold">"{query}"</strong> in {selectedCategory === 'all' ? 'any category' : categoryTabs.find(t => t.id === selectedCategory)?.label}.
                </p>
                {selectedCategory !== 'all' && (
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className="mt-3 px-3 py-1 text-xs font-semibold text-[#0d9488] bg-[#f0fdfa] hover:bg-[#ccfbf1] rounded-xs border border-[#99f6e4] transition-colors"
                  >
                    Switch to Search All Categories
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#edebe9]">
                {displayedResults.map((result, idx) => {
                  const isSelected = selectedIndex === idx;
                  return (
                    <div
                      key={result.id}
                      id={`search-result-${result.id}`}
                      onClick={() => handleSelectResult(result)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`p-3 cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                        isSelected ? 'bg-[#f0fdfa]' : 'hover:bg-[#f3f8fd] bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="p-1.5 rounded-xs bg-[#f3f2f1] border border-[#e1dfdd] mt-0.5 shrink-0">
                          {getCategoryIcon(result.category)}
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Top Row: Category tag and Reference */}
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-[10px] font-bold text-[#0d9488] uppercase tracking-wider">
                              {result.categoryLabel}
                            </span>
                            {result.ref && (
                              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700">
                                {result.ref}
                              </span>
                            )}
                            {result.room && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-50 text-[#0f766e] font-semibold">
                                Room {result.room}
                              </span>
                            )}
                            {result.site && (
                              <span className="text-[10px] text-[#605e5c]">
                                {result.site}
                              </span>
                            )}
                          </div>

                          {/* Record Title */}
                          <div className="font-semibold text-xs text-[#242424] leading-snug">
                            {result.title}
                          </div>

                          {/* Record Subtitle */}
                          <div className="text-[11px] text-[#605e5c] mt-0.5 leading-snug">
                            {result.subtitle}
                          </div>

                          {/* Match snippet preview */}
                          {result.matchContext && (
                            <div className="mt-1 text-[11px] text-[#605e5c] bg-[#faf9f8] p-1 rounded-xs border border-[#edebe9] font-mono text-[10px] truncate max-w-lg">
                              {result.matchContext}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right metadata badge & jump button */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {result.badge && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${result.badgeColor || 'bg-neutral-100 text-neutral-800'}`}>
                            {result.badge}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0d9488] group-hover:underline">
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          {displayedResults.length > 0 && (
            <div className="p-2 bg-[#f8f9fa] border-t border-[#edebe9] flex items-center justify-between text-[11px] text-[#605e5c]">
              <span>Showing {displayedResults.length} records</span>
              <span className="flex items-center gap-1 text-[#0d9488] font-medium">
                <span>Click any result to jump to that tracker</span>
                <CornerDownLeft className="w-3 h-3" />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
