import React from 'react';
import { RegisterDispersalSection } from './RegisterDispersalSection';
import { RegisterEvictionSection } from './RegisterEvictionSection';

interface DispersalAndEvictionSectionProps {
  selectedSite: string;
  searchQuery?: string;
  activeSubTab: 'dispersal' | 'eviction';
  onSubTabChange: (tab: 'dispersal' | 'eviction') => void;
  dispersalCount: number;
  evictionCount: number;
  dispersalExportTrigger?: { format: 'csv' | 'pdf'; ts: number } | null;
  evictionCreateTrigger?: number;
  evictionExportTrigger?: { format: 'csv' | 'pdf'; ts: number } | null;
  evictionCustomizeTrigger?: number;
}

export const DispersalAndEvictionSection: React.FC<DispersalAndEvictionSectionProps> = ({
  selectedSite,
  searchQuery,
  activeSubTab,
  onSubTabChange,
  dispersalCount,
  evictionCount,
  dispersalExportTrigger,
  evictionCreateTrigger,
  evictionExportTrigger,
  evictionCustomizeTrigger
}) => {
  return (
    <div className="space-y-4">
      {/* Sub-navigation pills */}
      <div className="flex items-center gap-2 border-b border-[#e1dfdd] pb-2">
        <button
          onClick={() => onSubTabChange('dispersal')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'dispersal'
              ? 'bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-xs'
              : 'text-[#605e5c] hover:bg-neutral-100'
          }`}
        >
          <span>Section 95 Dispersal Manifest</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-indigo-100 text-indigo-800">
            {dispersalCount}
          </span>
        </button>

        <button
          onClick={() => onSubTabChange('eviction')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'eviction'
              ? 'bg-red-50 text-red-800 border border-red-200 shadow-xs'
              : 'text-[#605e5c] hover:bg-neutral-100'
          }`}
        >
          <span>Cessation &amp; Eviction Notices</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-red-100 text-red-800">
            {evictionCount}
          </span>
        </button>
      </div>

      {/* Content Area */}
      {activeSubTab === 'dispersal' ? (
        <RegisterDispersalSection
          selectedSite={selectedSite}
          searchQuery={searchQuery}
          exportTrigger={dispersalExportTrigger}
        />
      ) : (
        <RegisterEvictionSection
          selectedSite={selectedSite}
          searchQuery={searchQuery}
          createTrigger={evictionCreateTrigger}
          exportTrigger={evictionExportTrigger}
          customizeTrigger={evictionCustomizeTrigger}
        />
      )}
    </div>
  );
};
