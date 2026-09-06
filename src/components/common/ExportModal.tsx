import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  FileText, 
  FileSpreadsheet, 
  Calendar, 
  Download, 
  Layers, 
  Filter, 
  Check, 
  Clock,
  Maximize2,
  Minimize2,
  ListFilter,
  Eye,
  Settings2,
  Table,
  Sliders,
  Compass,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export type ExportFormat = 'pdf' | 'csv';
export type ExportScope = 'filtered' | 'all' | 'custom';
export type ExportOrientation = 'portrait' | 'landscape';

export interface ExportColumnOption {
  id: string;
  label: string;
  defaultSelected?: boolean;
}

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  moduleName: string;
  defaultFormat?: ExportFormat;
  defaultOrientation?: ExportOrientation;
  totalRecordCount: number;
  filteredRecordCount: number;
  dateRangeRecordCount?: (startDate: string, endDate: string) => number;
  availableColumns?: ExportColumnOption[];
  getPreviewData?: (options: {
    scope: ExportScope;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    orientation: ExportOrientation;
    isCompact: boolean;
  }) => { headers: string[]; rows: (string | number)[][] };
  onExport: (options: {
    format: ExportFormat;
    scope: ExportScope;
    orientation: ExportOrientation;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  title,
  moduleName,
  defaultFormat = 'pdf',
  defaultOrientation = 'landscape',
  totalRecordCount,
  filteredRecordCount,
  dateRangeRecordCount,
  availableColumns,
  getPreviewData,
  onExport
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config');
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [orientation, setOrientation] = useState<ExportOrientation>(defaultOrientation);
  const [scope, setScope] = useState<ExportScope>('filtered');
  const [isCompact, setIsCompact] = useState<boolean>(false);
  
  // Custom date range defaults to last 30 days
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const thirtyDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const [startDate, setStartDate] = useState<string>(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Column selection state
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);

  // Initialize selected columns
  useEffect(() => {
    if (availableColumns && availableColumns.length > 0) {
      setSelectedColumnIds(
        availableColumns
          .filter(c => c.defaultSelected !== false)
          .map(c => c.id)
      );
    }
  }, [availableColumns, isOpen]);

  // Sync format & orientation if defaults change when opened
  useEffect(() => {
    if (isOpen) {
      setFormat(defaultFormat);
      setOrientation(defaultOrientation);
      setActiveTab('config');
    }
  }, [isOpen, defaultFormat, defaultOrientation]);

  // Compute preview data if callback provided
  const previewData = useMemo(() => {
    if (!isOpen || !getPreviewData) return null;
    try {
      return getPreviewData({
        scope,
        startDate: scope === 'custom' ? startDate : undefined,
        endDate: scope === 'custom' ? endDate : undefined,
        selectedColumns: availableColumns ? selectedColumnIds : undefined,
        orientation,
        isCompact
      });
    } catch {
      return null;
    }
  }, [isOpen, getPreviewData, scope, startDate, endDate, availableColumns, selectedColumnIds, orientation, isCompact]);

  if (!isOpen) return null;

  const toggleColumn = (id: string) => {
    setSelectedColumnIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least 1 column selected
        return prev.filter(c => c !== id);
      }
      return [...prev, id];
    });
  };

  const handleSelectAllColumns = () => {
    if (availableColumns) {
      setSelectedColumnIds(availableColumns.map(c => c.id));
    }
  };

  const handleDeselectAllColumns = () => {
    if (availableColumns && availableColumns.length > 0) {
      setSelectedColumnIds([availableColumns[0].id]);
    }
  };

  const setPreset = (preset: '7days' | '30days' | 'thisMonth' | 'last3Months' | 'ytd') => {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    let start = '';

    if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = d.toISOString().slice(0, 10);
    } else if (preset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      start = d.toISOString().slice(0, 10);
    } else if (preset === 'thisMonth') {
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    } else if (preset === 'last3Months') {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      start = d.toISOString().slice(0, 10);
    } else if (preset === 'ytd') {
      start = `${now.getFullYear()}-01-01`;
    }

    setStartDate(start);
    setEndDate(end);
    setScope('custom');
  };

  const calculatedCount = () => {
    if (scope === 'all') return totalRecordCount;
    if (scope === 'filtered') return filteredRecordCount;
    if (scope === 'custom') {
      if (dateRangeRecordCount) {
        return dateRangeRecordCount(startDate, endDate);
      }
      return filteredRecordCount;
    }
    return totalRecordCount;
  };

  const countToExport = calculatedCount();

  const handleDownload = () => {
    onExport({
      format,
      scope,
      orientation,
      startDate: scope === 'custom' ? startDate : undefined,
      endDate: scope === 'custom' ? endDate : undefined,
      selectedColumns: availableColumns ? selectedColumnIds : undefined,
      isCompact
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-3 sm:p-4">
      <div 
        className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#edebe9] bg-[#faf9f8] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#f0fdfa] text-[#0d9488] rounded-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 id="export-dialog-title" className="text-sm font-bold text-[#242424]">
                {title || `Export ${moduleName} Records`}
              </h3>
              <p className="text-[11px] text-[#605e5c]">
                Configure layout orientation, data fields, density, and preview before downloading.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-[#edebe9] rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#edebe9] bg-white px-5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'config'
                ? 'border-[#0d9488] text-[#0d9488]'
                : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Configure Export</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-[#0d9488] text-[#0d9488]'
                : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Export Review &amp; Data Preview</span>
            <span className="text-[10px] bg-[#f0fdfa] text-[#0f766e] font-bold px-1.5 py-0.2 rounded-full">
              {countToExport}
            </span>
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-5 space-y-4 text-xs text-[#323130] overflow-y-auto flex-1">
          
          {activeTab === 'config' ? (
            <>
              {/* Section 1: Choose Format & Orientation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Format Selection */}
                <div>
                  <label className="block text-xs font-bold text-[#242424] mb-2 uppercase tracking-wider">
                    1. Select Export Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {/* PDF Option */}
                    <button
                      type="button"
                      onClick={() => setFormat('pdf')}
                      className={`p-2.5 rounded-xs border text-left transition-all flex flex-col justify-between ${
                        format === 'pdf'
                          ? 'border-[#0d9488] bg-[#f0f6fc] ring-1 ring-[#0d9488]'
                          : 'border-[#edebe9] bg-white hover:bg-[#faf9f8]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-[#7f6000]">
                          <FileText className="w-4 h-4" />
                          <span>PDF Document</span>
                        </div>
                        {format === 'pdf' && (
                          <div className="w-3.5 h-3.5 rounded-full bg-[#0d9488] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10.5px] text-[#605e5c] mt-1.5">
                        Official document with audit headers &amp; print format.
                      </p>
                    </button>

                    {/* CSV Option */}
                    <button
                      type="button"
                      onClick={() => setFormat('csv')}
                      className={`p-2.5 rounded-xs border text-left transition-all flex flex-col justify-between ${
                        format === 'csv'
                          ? 'border-[#0d9488] bg-[#f0f6fc] ring-1 ring-[#0d9488]'
                          : 'border-[#edebe9] bg-white hover:bg-[#faf9f8]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-[#107c10]">
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>CSV SpreadSheet</span>
                        </div>
                        {format === 'csv' && (
                          <div className="w-3.5 h-3.5 rounded-full bg-[#0d9488] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10.5px] text-[#605e5c] mt-1.5">
                        Tabular dataset for Excel, Sheets &amp; Power BI analysis.
                      </p>
                    </button>
                  </div>
                </div>

                {/* PDF Orientation Layout */}
                <div>
                  <label className="block text-xs font-bold text-[#242424] mb-2 uppercase tracking-wider flex items-center justify-between">
                    <span>2. Document Page Layout</span>
                    {format === 'pdf' && (
                      <span className="text-[10px] text-[#0d9488] font-normal normal-case">
                        PDF Layout Orientation
                      </span>
                    )}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Landscape */}
                    <button
                      type="button"
                      onClick={() => setOrientation('landscape')}
                      className={`p-2.5 rounded-xs border text-left transition-all flex flex-col justify-between ${
                        orientation === 'landscape'
                          ? 'border-[#0d9488] bg-[#f0f6fc] ring-1 ring-[#0d9488]'
                          : 'border-[#edebe9] bg-white hover:bg-[#faf9f8]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-[#242424]">
                          <div className="w-4 h-3 border border-[#0d9488] bg-[#dbeafe] rounded-[1px]" />
                          <span>Landscape</span>
                        </div>
                        {orientation === 'landscape' && (
                          <div className="w-3.5 h-3.5 rounded-full bg-[#0d9488] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10.5px] text-[#605e5c] mt-1.5">
                        Wide layout (Recommended for registers &amp; multi-column data).
                      </p>
                    </button>

                    {/* Portrait */}
                    <button
                      type="button"
                      onClick={() => setOrientation('portrait')}
                      className={`p-2.5 rounded-xs border text-left transition-all flex flex-col justify-between ${
                        orientation === 'portrait'
                          ? 'border-[#0d9488] bg-[#f0f6fc] ring-1 ring-[#0d9488]'
                          : 'border-[#edebe9] bg-white hover:bg-[#faf9f8]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-[#242424]">
                          <div className="w-3 h-4 border border-[#0d9488] bg-[#dbeafe] rounded-[1px]" />
                          <span>Portrait</span>
                        </div>
                        {orientation === 'portrait' && (
                          <div className="w-3.5 h-3.5 rounded-full bg-[#0d9488] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10.5px] text-[#605e5c] mt-1.5">
                        Vertical layout (Standard document format for fewer columns).
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: Choose Data Fields / Columns to Export */}
              {availableColumns && availableColumns.length > 0 && (
                <div className="border border-[#edebe9] rounded-xs p-3 bg-[#faf9f8]">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-[#242424] uppercase tracking-wider flex items-center gap-1.5">
                      <ListFilter className="w-3.5 h-3.5 text-[#0d9488]" />
                      <span>3. Select Data Fields to Export ({selectedColumnIds.length}/{availableColumns.length})</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllColumns}
                        className="text-[11px] text-[#0d9488] hover:underline font-semibold"
                      >
                        Select All
                      </button>
                      <span className="text-neutral-300">|</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllColumns}
                        className="text-[11px] text-[#605e5c] hover:underline font-semibold"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {availableColumns.map(col => {
                      const isChecked = selectedColumnIds.includes(col.id);
                      return (
                        <label
                          key={col.id}
                          onClick={() => toggleColumn(col.id)}
                          className={`flex items-center gap-2 p-1.5 rounded-xs border cursor-pointer transition-colors text-xs select-none ${
                            isChecked 
                              ? 'bg-[#f3f8fd] border-[#5eead4] text-[#0f766e] font-semibold' 
                              : 'bg-white border-[#edebe9] text-[#605e5c] hover:bg-[#f3f2f1]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent onClick
                            className="rounded-xs text-[#0d9488] focus:ring-[#0d9488]"
                          />
                          <span className="truncate">{col.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 3: Layout Density & Compact View */}
              <div className="border border-[#edebe9] rounded-xs p-3 bg-white flex items-center justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-[#f0fdfa] text-[#0d9488] rounded-xs mt-0.5">
                    {isCompact ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-bold text-[#242424] text-xs">Compact Density &amp; High-Efficiency Spacing</div>
                    <div className="text-[11px] text-[#605e5c]">
                      Reduces padding and typography scale to fit higher density of data onto each exported page.
                    </div>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCompact}
                    onChange={e => setIsCompact(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#d2d0ce] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0d9488]"></div>
                </label>
              </div>

              {/* Section 4: Choose Scope / Range */}
              <div>
                <label className="block text-xs font-bold text-[#242424] mb-2 uppercase tracking-wider">
                  4. Select Scope or Date Range
                </label>
                <div className="space-y-2">
                  {/* Option: Current Filtered View */}
                  <label 
                    className={`flex items-start gap-3 p-2.5 border rounded-xs cursor-pointer transition-all ${
                      scope === 'filtered'
                        ? 'border-[#0d9488] bg-[#f0f6fc]'
                        : 'border-[#edebe9] bg-white hover:bg-[#faf9f8]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportScope"
                      value="filtered"
                      checked={scope === 'filtered'}
                      onChange={() => setScope('filtered')}
                      className="mt-0.5 text-[#0d9488] focus:ring-[#0d9488]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#242424] flex items-center gap-1.5">
                          <Filter className="w-3.5 h-3.5 text-[#0d9488]" />
                          Current Filtered View
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#f0fdfa] text-[#0f766e] rounded">
                          {filteredRecordCount} records
                        </span>
                      </div>
                      <p className="text-[11px] text-[#605e5c] mt-0.5">
                        Includes only records matching your currently active search query, hotel site, and status filters.
                      </p>
                    </div>
                  </label>

                  {/* Option: Full Export */}
                  <label 
                    className={`flex items-start gap-3 p-2.5 border rounded-xs cursor-pointer transition-all ${
                      scope === 'all'
                        ? 'border-[#0d9488] bg-[#f0f6fc]'
                        : 'border-[#edebe9] bg-white hover:bg-[#faf9f8]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportScope"
                      value="all"
                      checked={scope === 'all'}
                      onChange={() => setScope('all')}
                      className="mt-0.5 text-[#0d9488] focus:ring-[#0d9488]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#242424] flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-teal-700" />
                          Full Register Export (All Records)
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-neutral-100 text-neutral-800 rounded">
                          {totalRecordCount} total
                        </span>
                      </div>
                      <p className="text-[11px] text-[#605e5c] mt-0.5">
                        Exports complete dataset history across all permitted sites and statuses.
                      </p>
                    </div>
                  </label>

                  {/* Option: Custom Date Range */}
                  <label 
                    className={`flex items-start gap-3 p-2.5 border rounded-xs cursor-pointer transition-all ${
                      scope === 'custom'
                        ? 'border-[#0d9488] bg-[#f0f6fc]'
                        : 'border-[#edebe9] bg-white hover:bg-[#faf9f8]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportScope"
                      value="custom"
                      checked={scope === 'custom'}
                      onChange={() => setScope('custom')}
                      className="mt-0.5 text-[#0d9488] focus:ring-[#0d9488]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#242424] flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-amber-700" />
                          Custom Date Range
                        </span>
                        {scope === 'custom' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-50 text-amber-900 border border-amber-200 rounded">
                            {countToExport} records in range
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#605e5c] mt-0.5">
                        Export specific date intervals for periodic compliance or auditing.
                      </p>

                      {/* Sub-inputs when Custom is selected */}
                      {scope === 'custom' && (
                        <div className="mt-3 pt-2.5 border-t border-[#d2e3f3] space-y-2">
                          {/* Presets */}
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => setPreset('7days')}
                              className="px-2 py-1 bg-white border border-[#c7dbe6] hover:bg-[#f0fdfa] text-[10px] rounded font-semibold text-[#0f766e]"
                            >
                              Last 7 Days
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreset('30days')}
                              className="px-2 py-1 bg-white border border-[#c7dbe6] hover:bg-[#f0fdfa] text-[10px] rounded font-semibold text-[#0f766e]"
                            >
                              Last 30 Days
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreset('thisMonth')}
                              className="px-2 py-1 bg-white border border-[#c7dbe6] hover:bg-[#f0fdfa] text-[10px] rounded font-semibold text-[#0f766e]"
                            >
                              This Month
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreset('last3Months')}
                              className="px-2 py-1 bg-white border border-[#c7dbe6] hover:bg-[#f0fdfa] text-[10px] rounded font-semibold text-[#0f766e]"
                            >
                              Last 3 Months
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreset('ytd')}
                              className="px-2 py-1 bg-white border border-[#c7dbe6] hover:bg-[#f0fdfa] text-[10px] rounded font-semibold text-[#0f766e]"
                            >
                              Year to Date
                            </button>
                          </div>

                          {/* Date Inputs */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="block text-[10px] font-semibold text-[#605e5c] mb-0.5">
                                Start Date (From)
                              </label>
                              <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-[#605e5c] mb-0.5">
                                End Date (To)
                              </label>
                              <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Ready Summary Bar with Review CTA */}
              <div className="p-3 bg-[#f3f8fd] border border-[#99f6e4] rounded-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#0d9488]" />
                  <div>
                    <span className="font-semibold text-[#0f766e]">Export Configuration Summary:</span>
                    <div className="text-[11px] text-[#605e5c]">
                      Format: <strong>{format.toUpperCase()}</strong> • Layout: <strong>{orientation}</strong> • Density:{' '}
                      <strong>{isCompact ? 'Compact' : 'Standard'}</strong> • Scope:{' '}
                      <strong>{scope === 'all' ? 'All Records' : scope === 'filtered' ? 'Current Filter' : `${startDate} - ${endDate}`}</strong>
                      {availableColumns && (
                        <span> • Fields: <strong>{selectedColumnIds.length}/{availableColumns.length}</strong></span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white border border-[#0d9488] text-[#0d9488] hover:bg-[#f0fdfa] rounded-xs transition-colors shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Review Output</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </>
          ) : (
            /* Review & Preview Tab */
            <div className="space-y-3">
              {/* Preview Status Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#f8f9fa] border border-[#e1dfdd] rounded-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-[#f0fdfa] text-[#0d9488]">
                    <Table className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-[#242424] text-xs">Live Document Data Review</span>
                    <p className="text-[11px] text-[#605e5c]">
                      Verifying layout structure, columns, and sample entries before file generation.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 bg-white border border-[#c7dbe6] text-[#0f766e] rounded font-semibold">
                    Format: {format.toUpperCase()}
                  </span>
                  <span className="px-2 py-0.5 bg-white border border-[#c7dbe6] text-[#0f766e] rounded font-semibold capitalize">
                    Layout: {orientation}
                  </span>
                  <span className="px-2 py-0.5 bg-white border border-[#c7dbe6] text-[#0f766e] rounded font-semibold">
                    Density: {isCompact ? 'Compact' : 'Standard'}
                  </span>
                  <span className="px-2 py-0.5 bg-[#0d9488] text-white rounded font-bold">
                    {countToExport} Records
                  </span>
                </div>
              </div>

              {/* Data Table Review */}
              {previewData && previewData.headers.length > 0 ? (
                <div className="border border-[#e1dfdd] rounded-xs overflow-hidden bg-white shadow-2xs">
                  <div className="max-h-[320px] overflow-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="sticky top-0 bg-[#0d9488] text-white z-10">
                        <tr>
                          <th className="p-2 border-r border-[#0f766e] w-8 text-center text-[10px]">#</th>
                          {previewData.headers.map((h, i) => (
                            <th key={i} className="p-2 font-semibold border-r border-[#0f766e] whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edebe9]">
                        {previewData.rows.length === 0 ? (
                          <tr>
                            <td colSpan={previewData.headers.length + 1} className="p-8 text-center text-[#605e5c]">
                              No matching records found for the selected scope/range.
                            </td>
                          </tr>
                        ) : (
                          previewData.rows.slice(0, 10).map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-[#faf9f8]'}>
                              <td className="p-2 text-center text-[10px] text-[#8a8886] font-mono border-r border-[#edebe9]">
                                {rIdx + 1}
                              </td>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-2 border-r border-[#edebe9] text-[#323130] max-w-[200px] truncate">
                                  {cell !== null && cell !== undefined ? String(cell) : '—'}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-2 bg-[#f3f2f1] border-t border-[#edebe9] flex items-center justify-between text-[10.5px] text-[#605e5c]">
                    <span>
                      Showing preview of {Math.min(10, previewData.rows.length)} of {countToExport} total items.
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('config')}
                      className="text-[#0d9488] hover:underline font-semibold"
                    >
                      ← Adjust Columns or Scope
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-[#c7dbe6] rounded-xs bg-[#f8fbff]">
                  <CheckCircle2 className="w-8 h-8 text-[#0d9488] mx-auto mb-2" />
                  <div className="font-semibold text-[#242424] text-xs">Ready for {format.toUpperCase()} Generation</div>
                  <p className="text-[11px] text-[#605e5c] mt-1 max-w-md mx-auto">
                    The document will be compiled in <strong>{orientation}</strong> layout containing <strong>{countToExport}</strong> records with strict safeguarding headers.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#edebe9] bg-[#faf9f8] flex items-center justify-between gap-2.5 shrink-0">
          <div className="text-[11px] text-[#605e5c]">
            Target: <strong>{countToExport} records</strong> in <strong>{orientation}</strong> {format.toUpperCase()}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded-xs shadow-xs transition-colors ${
                format === 'pdf' ? 'bg-[#7f6000] hover:bg-[#684f00]' : 'bg-[#107c10] hover:bg-[#0e6b0e]'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {format.toUpperCase()} ({countToExport})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
