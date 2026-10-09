import React from 'react';
import { Building2, X } from 'lucide-react';
import { PropertyMaster } from '../../types/masterData';

export type PropertyTabType = 'core' | 'ownership' | 'specs' | 'rooms' | 'compliance' | 'facilities' | 'contacts' | 'documents';

interface PropertyFormHeaderProps {
  propertyToEdit?: PropertyMaster | null;
  activeTab: PropertyTabType;
  setActiveTab: (tab: PropertyTabType) => void;
  roomCount: number;
  docCount: number;
  facilitiesCount: number;
  onClose: () => void;
}

export const PropertyFormHeader: React.FC<PropertyFormHeaderProps> = ({
  propertyToEdit,
  activeTab,
  setActiveTab,
  roomCount,
  docCount,
  facilitiesCount,
  onClose
}) => {
  const tabs: Array<{ id: PropertyTabType; label: string }> = [
    { id: 'core', label: 'Core & Address' },
    { id: 'ownership', label: 'Ownership & Lease' },
    { id: 'specs', label: 'Capacity & Specs' },
    { id: 'rooms', label: `Rooms (${roomCount})` },
    { id: 'compliance', label: 'Compliance & Safety' },
    { id: 'facilities', label: `Facilities (${facilitiesCount})` },
    { id: 'contacts', label: 'Key Contacts' },
    { id: 'documents', label: `Documents (${docCount})` }
  ];

  return (
    <>
      {/* Modal Top Header */}
      <div className="flex items-center justify-between p-5 border-b border-[#e5e5e5] bg-[#faf9f8] shrink-0">
        <div>
          <h3 className="font-bold text-sm text-[#242424] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#0d9488]" />
            <span>
              {propertyToEdit ? `Edit Property — ${propertyToEdit.propertyReference}` : 'Add Property Master'}
            </span>
          </h3>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Comprehensive property registration, capacity setup, statutory safety compliance, and facility management.
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xs text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 px-5 pt-2 border-b border-[#e5e5e5] bg-white text-xs select-none overflow-x-auto custom-scrollbar shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 border-b-2 font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-[#0d9488] text-[#0f766e]'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </>
  );
};
