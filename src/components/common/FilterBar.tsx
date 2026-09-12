import React, { useState, useRef, useEffect } from 'react';
import { RotateCcw, Download, Filter, Lock, FileText, FileSpreadsheet, ChevronDown, LayoutGrid, List } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SearchInput } from './SearchInput';

interface FilterBarProps {
  siteFilter: string;
  setSiteFilter: (val: string) => void;
  monthFilter: string;
  setMonthFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onReset: () => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  onOpenExport?: (format: 'pdf' | 'csv') => void;
  totalFilteredCount: number;
  searchStorageKey?: string;
  searchPlaceholder?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  siteFilter,
  setSiteFilter,
  monthFilter,
  setMonthFilter,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  onReset,
  onExportCsv,
  onExportPdf,
  onOpenExport,
  totalFilteredCount,
  searchStorageKey = 'safeguarding_filter_bar',
  searchPlaceholder = 'Filter by name, Port/NASS ref, room, or notes...'
}) => {
  const { allowedSites, canAccessAllSites, isMobileCompactView, setIsMobileCompactView } = useApp();
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const isSiteLocked = !canAccessAllSites();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportClick = (format: 'pdf' | 'csv') => {
    setIsExportMenuOpen(false);
    if (onOpenExport) {
      onOpenExport(format);
    } else if (format === 'pdf' && onExportPdf) {
      onExportPdf();
    } else if (format === 'csv' && onExportCsv) {
      onExportCsv();
    }
  };

  return (
    <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs mb-4 p-3.5">
      <div className="flex flex-wrap items-end gap-3 text-xs">
        {/* Hotel / Site */}
        <div className="flex-1 min-w-[150px]">
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-[#605e5c]">Hotel / Site</label>
            {isSiteLocked && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-700 font-semibold">
                <Lock className="w-2.5 h-2.5" /> Locked
              </span>
            )}
          </div>
          <select
            id="filter-site"
            value={siteFilter}
            onChange={e => setSiteFilter(e.target.value)}
            disabled={isSiteLocked}
            className={`w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5] ${
              isSiteLocked ? 'bg-[#faf9f8] cursor-not-allowed opacity-80' : ''
            }`}
          >
            {canAccessAllSites() && <option value="all">All Permitted Sites ({allowedSites.length})</option>}
            {allowedSites.map((s, idx) => (
              <option key={`${s}-${idx}`} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Month */}
        <div className="flex-1 min-w-[130px]">
          <label className="font-semibold text-[#605e5c] block mb-1">Month / Period</label>
          <select
            id="filter-month"
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
          >
            <option value="all">All Months</option>
            <option value="2026-06">June 2026</option>
            <option value="2026-05">May 2026</option>
            <option value="2026-04">April 2026</option>
            <option value="2026-03">March 2026</option>
            <option value="2026-02">February 2026</option>
            <option value="2026-01">January 2026</option>
          </select>
        </div>

        {/* Status */}
        <div className="flex-1 min-w-[120px]">
          <label className="font-semibold text-[#605e5c] block mb-1">Status</label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
          >
            <option value="all">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In progress">In progress</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        {/* Search Input with Recent Searches */}
        <div className="flex-[2] min-w-[200px]">
          <label className="font-semibold text-[#605e5c] block mb-1">Quick Search</label>
          <SearchInput
            id="filter-search"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={searchPlaceholder}
            storageKey={searchStorageKey}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-reset-filters"
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs font-semibold transition-colors"
            title="Reset Filters"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#605e5c]" />
            <span>Reset</span>
          </button>

          {/* Unified Export dropdown button */}
          {(onOpenExport || onExportPdf || onExportCsv) && (
            <div className="relative" ref={exportDropdownRef}>
              <div className="flex items-center">
                <button
                  id="btn-export-main"
                  onClick={() => handleExportClick('pdf')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#f3f8fd] hover:bg-[#f0fdfa] text-[#0f766e] border border-[#71afe5] rounded-l-xs font-semibold transition-colors"
                  title="Export records"
                >
                  <Download className="w-3.5 h-3.5 text-[#0d9488]" />
                  <span>Export</span>
                </button>
                <button
                  id="btn-export-dropdown-toggle"
                  onClick={() => setIsExportMenuOpen(prev => !prev)}
                  className="px-1.5 py-2 bg-[#f3f8fd] hover:bg-[#f0fdfa] text-[#0f766e] border border-l-0 border-[#71afe5] rounded-r-xs font-semibold transition-colors"
                  title="Choose export format (PDF or CSV)"
                  aria-expanded={isExportMenuOpen}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-[#edebe9] rounded-xs shadow-lg py-1 z-30 text-xs text-[#323130]">
                  <button
                    onClick={() => handleExportClick('pdf')}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#faf9f8] transition-colors"
                  >
                    <FileText className="w-4 h-4 text-[#7f6000]" />
                    <div>
                      <div className="font-semibold text-[#242424]">Export PDF</div>
                      <div className="text-[10px] text-[#605e5c]">Official report layout</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleExportClick('csv')}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#faf9f8] transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#107c10]" />
                    <div>
                      <div className="font-semibold text-[#242424]">Export CSV</div>
                      <div className="text-[10px] text-[#605e5c]">Excel spreadsheet</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#edebe9] text-[11px] text-[#605e5c] flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span>
            Matching records: <strong className="text-[#242424]">{totalFilteredCount}</strong>
          </span>
          <span className="hidden sm:inline text-[10px] text-neutral-400">
            Instant search & filter with recent search history
          </span>
        </div>

        {/* View Mode Switcher: Compact Cards vs Full Table */}
        <div className="flex items-center bg-[#f3f2f1] p-0.5 rounded border border-[#edebe9]">
          <button
            id="btn-toggle-view-cards"
            type="button"
            onClick={() => setIsMobileCompactView(true)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              isMobileCompactView 
                ? 'bg-white text-[#0d9488] shadow-xs' 
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
            title="Compact Cards View (Mobile Optimized)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Cards</span>
          </button>
          <button
            id="btn-toggle-view-table"
            type="button"
            onClick={() => setIsMobileCompactView(false)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              !isMobileCompactView 
                ? 'bg-white text-[#0d9488] shadow-xs' 
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
            title="Full Table View (Desktop Grid)"
          >
            <List className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>
    </div>
  );
};
