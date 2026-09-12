import React from 'react';
import { ShieldAlert, ArrowLeft, Lock, Building2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AccessDeniedViewProps {
  pageName?: string;
  requiredRole?: string;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  pageName = 'this administrative module',
  requiredRole = 'Administrator'
}) => {
  const { currentUserRole, assignedSite, setActivePage } = useApp();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-[#e1dfdd] rounded-xs shadow-lg p-6 text-center space-y-5 animate-fade-in">
        <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-[#242424] tracking-tight">
            Access Restricted by RBAC Policy
          </h2>
          <p className="text-xs text-[#605e5c] leading-relaxed">
            You do not have permission to view or manage <strong className="text-[#323130]">{pageName}</strong>.
          </p>
        </div>

        <div className="bg-[#f8f9fa] border border-[#edebe9] rounded-xs p-3.5 text-left text-xs space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-[#edebe9]">
            <span className="text-[#605e5c]">Your Current Role:</span>
            <span className="font-semibold px-2 py-0.5 rounded bg-neutral-200 text-neutral-800 text-[11px]">
              {currentUserRole}
            </span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-[#edebe9]">
            <span className="text-[#605e5c]">Required Authorization:</span>
            <span className="font-semibold text-amber-800 flex items-center gap-1 text-[11px]">
              <Lock className="w-3 h-3 text-amber-700" />
              {requiredRole}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#605e5c] pt-0.5">
            <span>Assigned Property:</span>
            <span className="font-medium text-[#0f766e] flex items-center gap-1">
              <Building2 className="w-3 h-3 text-[#0d9488]" />
              {assignedSite || 'Assigned Hotel'}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-[#797775] leading-normal">
          If you require access to this section for operational duties, please contact your System Administrator to request a role elevation.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setActivePage('dashboard')}
            className="w-full py-2 px-4 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold rounded-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Operations Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
