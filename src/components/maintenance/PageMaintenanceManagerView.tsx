import React from 'react';
import { Wrench, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageMaintenanceSection } from '../settings/PageMaintenanceSection';

export const PageMaintenanceManagerView: React.FC = () => {
  const { currentUserRole } = useApp();

  if (currentUserRole !== 'Super Admin') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Access Restricted</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Page Maintenance Mode controls are only accessible to Super Admins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-300 flex items-center justify-center shrink-0">
          <Wrench className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-neutral-900">Page Maintenance Mode</h1>
          <p className="text-xs text-neutral-500">
            Temporarily take individual pages offline during updates. Regular users see the maintenance screen; Super Admins retain full access.
          </p>
        </div>
        <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
          Super Admin Only
        </span>
      </div>

      {/* Maintenance Controls */}
      <PageMaintenanceSection />
    </div>
  );
};
