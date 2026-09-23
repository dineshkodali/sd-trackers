import React from 'react';
import { Users, Bed, AlertTriangle, UserPlus } from 'lucide-react';

interface LiveRegisterKpiCardsProps {
  activeResidentsCount: number;
  totalCapacity: number;
  occupancyRate: number;
  availableBedspaces: number;
  roomCount: number;
  voidBedspaces: number;
  pendingArrivalsCount: number;
}

export const LiveRegisterKpiCards: React.FC<LiveRegisterKpiCardsProps> = ({
  activeResidentsCount,
  totalCapacity,
  occupancyRate,
  availableBedspaces,
  roomCount,
  voidBedspaces,
  pendingArrivalsCount
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* SUs Present */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs p-2.5 shadow-xs space-y-1">
        <div className="flex items-center justify-between text-[#605e5c] text-xs">
          <span className="font-medium flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#0d9488]" /> SUs Present
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
            occupancyRate > 95 ? 'bg-amber-100 text-amber-900' : 'bg-teal-50 text-teal-800'
          }`}>
            {occupancyRate}%
          </span>
        </div>
        <div className="text-xl font-bold text-[#242424]">
          {activeResidentsCount} <span className="text-xs font-normal text-neutral-500">/ {totalCapacity || '—'} cap</span>
        </div>
        <div className="w-full bg-neutral-200 h-1 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${occupancyRate > 95 ? 'bg-amber-500' : 'bg-[#0d9488]'}`} 
            style={{ width: `${occupancyRate}%` }} 
          />
        </div>
      </div>

      {/* Available Beds */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs p-2.5 shadow-xs space-y-1">
        <div className="flex items-center justify-between text-[#605e5c] text-xs">
          <span className="font-medium flex items-center gap-1.5">
            <Bed className="w-3.5 h-3.5 text-emerald-600" /> Available Beds
          </span>
          <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
            Ready
          </span>
        </div>
        <div className="text-xl font-bold text-emerald-700">
          {availableBedspaces} <span className="text-xs font-normal text-neutral-500">bedspaces</span>
        </div>
        <div className="text-[11px] text-neutral-500">
          Across {roomCount} rooms
        </div>
      </div>

      {/* Void Bedspaces */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs p-2.5 shadow-xs space-y-1">
        <div className="flex items-center justify-between text-[#605e5c] text-xs">
          <span className="font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Void Bedspaces
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
            voidBedspaces > 0 ? 'bg-amber-50 text-amber-800' : 'bg-neutral-100 text-neutral-600'
          }`}>
            {voidBedspaces > 0 ? 'Action Req' : 'Zero Voids'}
          </span>
        </div>
        <div className="text-xl font-bold text-amber-800">
          {voidBedspaces} <span className="text-xs font-normal text-neutral-500">voids</span>
        </div>
        <div className="text-[11px] text-neutral-500">
          Requires maintenance
        </div>
      </div>

      {/* Intake Arrivals */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs p-2.5 shadow-xs space-y-1">
        <div className="flex items-center justify-between text-[#605e5c] text-xs">
          <span className="font-medium flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5 text-blue-600" /> Intake Arrivals
          </span>
          <span className="text-[10px] bg-blue-50 text-blue-800 font-bold px-1.5 py-0.2 rounded">
            Queue
          </span>
        </div>
        <div className="text-xl font-bold text-blue-800">
          {pendingArrivalsCount} <span className="text-xs font-normal text-neutral-500">pending</span>
        </div>
        <div className="text-[11px] text-neutral-500">
          Awaiting room allocation
        </div>
      </div>
    </div>
  );
};
