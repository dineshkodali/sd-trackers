import React from 'react';

export type SUTabType = 'personal' | 'contact' | 'household' | 'accommodation' | 'support' | 'documents';

interface ServiceUserFormHeaderProps {
  serviceUserToEdit?: any;
  activeTab: SUTabType;
  setActiveTab: (tab: SUTabType) => void;
  householdCount: number;
  docsCount?: number;
}

export const ServiceUserFormHeader: React.FC<ServiceUserFormHeaderProps> = ({
  serviceUserToEdit,
  activeTab,
  setActiveTab,
  householdCount,
  docsCount = 0
}) => {
  return (
    <>
      {/* Tab Navigation */}
      {(
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
            Accommodation &amp; Room
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
