import React, { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  ChevronDown, 
  FileText, 
  FileSpreadsheet, 
  Calendar, 
  Layers 
} from 'lucide-react';
import { 
  ExportModal, 
  ExportFormat, 
  ExportScope, 
  ExportColumnOption, 
  ExportOrientation 
} from './ExportModal';

interface ExportDropdownProps {
  moduleName: string;
  totalRecordCount: number;
  filteredRecordCount: number;
  defaultOrientation?: ExportOrientation;
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
  className?: string;
  buttonVariant?: 'primary' | 'secondary' | 'toolbar';
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  moduleName,
  totalRecordCount,
  filteredRecordCount,
  defaultOrientation = 'landscape',
  dateRangeRecordCount,
  availableColumns,
  getPreviewData,
  onExport,
  className = '',
  buttonVariant = 'toolbar'
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openExportModal = (format: ExportFormat) => {
    setSelectedFormat(format);
    setIsMenuOpen(false);
    setIsModalOpen(true);
  };

  const getButtonStyles = () => {
    if (buttonVariant === 'primary') {
      return 'bg-[#0d9488] hover:bg-[#0f766e] text-white border-transparent';
    }
    if (buttonVariant === 'toolbar') {
      return 'bg-white hover:bg-[#edebe9] text-[#323130] border-[#8a8886]';
    }
    return 'bg-[#f3f8fd] hover:bg-[#f0fdfa] text-[#0f766e] border-[#71afe5]';
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <div className="flex items-center">
        {/* Main Export Trigger Button */}
        <button
          type="button"
          onClick={() => openExportModal('pdf')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-l-xs border transition-colors ${getButtonStyles()}`}
          title="Open Export & Review Options"
        >
          <Download className="w-3.5 h-3.5 text-inherit" />
          <span>Export</span>
        </button>

        {/* Dropdown Arrow Toggle Button */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(prev => !prev)}
          className={`px-1.5 py-1.5 text-xs font-semibold rounded-r-xs border border-l-0 transition-colors ${getButtonStyles()}`}
          title="Export format & options"
          aria-expanded={isMenuOpen}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute right-0 mt-1 w-56 bg-white border border-[#edebe9] rounded-xs shadow-lg py-1 z-30 animate-in fade-in duration-100 text-xs text-[#323130]">
          <div className="px-3 py-1.5 text-[10px] font-bold text-[#605e5c] uppercase tracking-wider border-b border-[#edebe9]">
            Export {moduleName}
          </div>

          <button
            type="button"
            onClick={() => openExportModal('pdf')}
            className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-[#f3f8fd] text-[#323130] transition-colors"
          >
            <FileText className="w-4 h-4 text-[#7f6000]" />
            <div>
              <div className="font-semibold">Export as PDF...</div>
              <div className="text-[10px] text-[#605e5c]">Portrait / Landscape document</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => openExportModal('csv')}
            className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-[#f3f8fd] text-[#323130] transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#107c10]" />
            <div>
              <div className="font-semibold">Export as CSV...</div>
              <div className="text-[10px] text-[#605e5c]">Excel / data spreadsheet</div>
            </div>
          </button>

          <div className="my-1 border-t border-[#edebe9]" />

          <button
            type="button"
            onClick={() => openExportModal('pdf')}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 hover:bg-[#faf9f8] text-[#0d9488] transition-colors font-medium text-[11px]"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Custom Date Range / Full Scope...</span>
          </button>
        </div>
      )}

      {/* Modal Dialog with Live Preview */}
      <ExportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Export ${moduleName} Records`}
        moduleName={moduleName}
        defaultFormat={selectedFormat}
        defaultOrientation={defaultOrientation}
        totalRecordCount={totalRecordCount}
        filteredRecordCount={filteredRecordCount}
        dateRangeRecordCount={dateRangeRecordCount}
        availableColumns={availableColumns}
        getPreviewData={getPreviewData}
        onExport={onExport}
      />
    </div>
  );
};
