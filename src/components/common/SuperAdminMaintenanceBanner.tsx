import React from 'react';
import { Wrench, EyeOff, Power, CheckCircle2 } from 'lucide-react';

interface SuperAdminMaintenanceBannerProps {
  pageId: string;
  pageName: string;
  onTurnOff: () => void;
}

export const SuperAdminMaintenanceBanner: React.FC<SuperAdminMaintenanceBannerProps> = ({
  pageId,
  pageName,
  onTurnOff
}) => {
  return (
    <div className="mb-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-2 border-amber-400/80 rounded-xs p-3.5 shadow-sm text-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Wrench className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                Maintenance Mode Active
              </span>
              <span className="text-[11px] font-semibold text-neutral-800">
                {pageName}
              </span>
            </div>
            <p className="text-[11px] text-neutral-700 mt-0.5">
              Regular users cannot access this page and are seeing the maintenance screen. You are working in <strong>Super Admin bypass mode</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onTurnOff}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xs shadow-xs transition-colors cursor-pointer"
            title="Turn off maintenance mode to restore access for all staff"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Turn Off Maintenance Mode</span>
          </button>
        </div>
      </div>
    </div>
  );
};
