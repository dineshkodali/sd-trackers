import React from 'react';
import { 
  Wrench, 
  ArrowLeft, 
  RefreshCw, 
  Building2, 
  AlertTriangle,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface PageMaintenanceViewProps {
  pageName?: string;
  customMessage?: string;
}

export const PageMaintenanceView: React.FC<PageMaintenanceViewProps> = ({
  pageName = 'This Module',
  customMessage
}) => {
  const { currentUserRole, assignedSite, setActivePage } = useApp();

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white border border-[#e1dfdd] rounded-xs shadow-xl p-6 sm:p-8 text-center space-y-6 animate-fade-in relative overflow-hidden">
        {/* Subtle accent border on top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

        {/* Animated Badge Icon */}
        <div className="relative mx-auto w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
          <Wrench className="w-8 h-8 text-amber-600 animate-pulse" />
          <span className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 shadow-xs">
            <AlertTriangle className="w-3 h-3" />
          </span>
        </div>

        {/* Title and Page Identity */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Scheduled Maintenance Mode</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-[#242424] tracking-tight">
            This page is currently under maintenance
          </h2>

          <p className="text-xs sm:text-sm text-[#605e5c] leading-relaxed max-w-md mx-auto">
            {customMessage || (
              <>
                <strong className="text-[#323130] font-semibold">{pageName}</strong> is undergoing updates and active configuration. Access is temporarily restricted to prevent data inconsistencies while changes are being made.
              </>
            )}
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-[#faf9f8] border border-[#edebe9] rounded-xs p-4 text-left text-xs space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-[#edebe9]">
            <span className="text-[#605e5c]">Module In Progress:</span>
            <span className="font-semibold text-neutral-800 bg-white px-2 py-0.5 rounded border border-neutral-200">
              {pageName}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-[#edebe9]">
            <span className="text-[#605e5c]">Access Status:</span>
            <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              Restricted to Super Admin
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-[#edebe9]">
            <span className="text-[#605e5c]">Your Active Role:</span>
            <span className="font-medium text-[#323130]">
              {currentUserRole}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#605e5c] pt-0.5">
            <span>Assigned Property:</span>
            <span className="font-medium text-[#0f766e] flex items-center gap-1">
              <Building2 className="w-3 h-3 text-[#0d9488]" />
              {assignedSite || 'All Sites'}
            </span>
          </div>
        </div>

        {/* Notice for Regular Users */}
        <div className="p-3 bg-neutral-50 rounded-xs border border-neutral-200 text-left flex items-start gap-2.5 text-[11px] text-[#605e5c]">
          <ShieldCheck className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Super Admins are currently performing verified adjustments. Once completed, the Super Admin will turn Maintenance Mode off and this page will automatically become visible to all authorized staff.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => setActivePage('dashboard')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold rounded-xs shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Executive Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#8a8886] hover:bg-[#edebe9] text-[#242424] text-xs font-medium rounded-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-neutral-600" />
            <span>Check Availability</span>
          </button>
        </div>
      </div>
    </div>
  );
};
