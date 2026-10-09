import React from 'react';
import { ShieldCheck, PlaneTakeoff } from 'lucide-react';
import { ServiceUserMaster } from '../../types/masterData';

interface ServiceUserFormFooterProps {
  onClose: () => void;
  isSubmitting: boolean;
  serviceUserToEdit?: ServiceUserMaster | null;
  formMode: 'standard' | 'arrival';
}

export const ServiceUserFormFooter: React.FC<ServiceUserFormFooterProps> = ({
  onClose,
  isSubmitting,
  serviceUserToEdit,
  formMode
}) => {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-[#e5e5e5]">
      <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-[#0d9488]" />
        <span>Immutable cryptographic audit logging active</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-1.5 border border-[#e5e5e5] text-neutral-700 rounded-xs hover:bg-neutral-100 transition-colors font-medium cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-1.5 bg-[#0d9488] text-white rounded-xs hover:bg-teal-700 transition-colors font-semibold shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
        >
          {isSubmitting ? (
            'Saving...'
          ) : serviceUserToEdit ? (
            'Save Changes'
          ) : formMode === 'arrival' ? (
            <>
              <PlaneTakeoff className="w-3.5 h-3.5" />
              <span>Complete Arrival &amp; Allocation</span>
            </>
          ) : (
            'Create Service User'
          )}
        </button>
      </div>
    </div>
  );
};
