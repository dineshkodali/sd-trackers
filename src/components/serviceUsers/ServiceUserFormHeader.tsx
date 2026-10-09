import React from 'react';
import { PlaneTakeoff, UserPlus } from 'lucide-react';

export type SUTabType = 'personal' | 'contact' | 'household' | 'accommodation' | 'support' | 'documents';

interface ServiceUserFormHeaderProps {
  serviceUserToEdit?: any;
  formMode: 'standard' | 'arrival';
  setFormMode: (mode: 'standard' | 'arrival') => void;
  activeTab: SUTabType;
  setActiveTab: (tab: SUTabType) => void;
  householdCount: number;
  docsCount?: number;
}

export const ServiceUserFormHeader: React.FC<ServiceUserFormHeaderProps> = ({
  serviceUserToEdit,
  formMode,
  setFormMode,
  activeTab,
  setActiveTab,
  householdCount,
  docsCount = 0
}) => {
  return (
    <>
      {/* Mode Switcher for New Users */}
      {!serviceUserToEdit && (
        <div className="px-6 py-2 bg-neutral-50 border-b border-[#e5e5e5] flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mr-2">Form Mode:</span>
          <button
            type="button"
            onClick={() => setFormMode('standard')}
            className={`px-3 py-1 text-xs font-semibold rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              formMode === 'standard'
                ? 'bg-white text-teal-800 border border-[#0d9488] shadow-xs'
                : 'text-neutral-600 hover:bg-neutral-200/60 border border-transparent'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>Full Registration</span>
          </button>
          <button
            type="button"
            onClick={() => setFormMode('arrival')}
            className={`px-3 py-1 text-xs font-semibold rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              formMode === 'arrival'
                ? 'bg-white text-teal-800 border border-[#0d9488] shadow-xs'
                : 'text-neutral-600 hover:bg-neutral-200/60 border border-transparent'
            }`}
          >
            <PlaneTakeoff className="w-3.5 h-3.5 text-amber-600" />
            <span>Quick Arrival Logging</span>
          </button>
        </div>
      )}

      {/* Tab Navigation for Standard Mode */}
      {formMode === 'standard' && (
        <div className="flex items-center gap-1 px-6 pt-2 border-b border-[#e5e5e5] bg-white text-xs shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`px-3 py-2 border-b-2 font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'personal' ? 'border-[#0d9488] text-teal-800' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Personal &amp; Reference
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className={`px-3 py-2 border-b-2 font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'contact' ? 'border-[#0d9488] text-teal-800' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Contact &amp; Emergency
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('accommodation')}
            className={`px-3 py-2 border-b-2 font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'accommodation' ? 'border-[#0d9488] text-teal-800' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {serviceUserToEdit ? 'Accommodation & Room' : 'Initial Accommodation'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('household')}
            className={`px-3 py-2 border-b-2 font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'household' ? 'border-[#0d9488] text-teal-800' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Household ({householdCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('support')}
            className={`px-3 py-2 border-b-2 font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'support' ? 'border-[#0d9488] text-teal-800' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Needs &amp; Safeguarding
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-2 border-b-2 font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'documents' ? 'border-[#0d9488] text-teal-800' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Documents {docsCount > 0 ? `(${docsCount})` : ''}
          </button>
        </div>
      )}
    </>
  );
};
