import React, { useMemo } from 'react';
import { 
  Building, 
  Bed, 
  Users, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  PieChart, 
  ShieldCheck 
} from 'lucide-react';
import { DailyRegisterRecord, DailyRegisterRoom } from '../../types';

interface RegisterSummarySectionProps {
  rooms: DailyRegisterRoom[];
  records: DailyRegisterRecord[];
  selectedSite: string;
}

export const RegisterSummarySection: React.FC<RegisterSummarySectionProps> = ({
  rooms,
  records,
  selectedSite
}) => {
  const activeRooms = useMemo(() => {
    return selectedSite === 'all'
      ? rooms
      : rooms.filter(r => r.hotel?.toLowerCase() === selectedSite.toLowerCase());
  }, [rooms, selectedSite]);

  const activeRecords = useMemo(() => {
    return selectedSite === 'all'
      ? records.filter(r => r.occupied === 'Yes' || !r.occupied)
      : records.filter(r => r.hotel?.toLowerCase() === selectedSite.toLowerCase() && (r.occupied === 'Yes' || !r.occupied));
  }, [records, selectedSite]);

  // Aggregate metrics
  const totalRooms = activeRooms.length;
  const currentOccupancy = activeRecords.length;

  const totalBedspaces = useMemo(() => {
    return activeRooms.reduce((sum, r) => sum + (Number(r.currentMaxOccupancy) || 0), 0);
  }, [activeRooms]);

  const contractedBedspaces = useMemo(() => {
    return activeRooms.reduce((sum, r) => sum + (Number(r.potentialMaxCapacity) || Number(r.currentMaxOccupancy) || 0), 0);
  }, [activeRooms]);

  const totalVoidBedspaces = useMemo(() => {
    return activeRooms.reduce((sum, r) => sum + (Number(r.voidBedspaces) || 0), 0);
  }, [activeRooms]);

  const occupantsByRoom = useMemo(() => {
    const map = new Map<string, number>();
    activeRecords.forEach(r => {
      const k = (r.roomNo || '').toLowerCase().trim();
      map.set(k, (map.get(k) || 0) + 1);
    });
    return map;
  }, [activeRecords]);

  // Available Rooms (occupants === 0 and voidBedspaces === 0)
  const availableRoomsCount = useMemo(() => {
    return activeRooms.filter(r => {
      const occ = occupantsByRoom.get(r.roomNo.toLowerCase().trim()) || 0;
      return occ === 0 && (r.voidBedspaces || 0) === 0;
    }).length;
  }, [activeRooms, occupantsByRoom]);

  // Bedspaces in Available Rooms
  const bedspacesInAvailableRooms = useMemo(() => {
    return activeRooms.filter(r => {
      const occ = occupantsByRoom.get(r.roomNo.toLowerCase().trim()) || 0;
      return occ === 0 && (r.voidBedspaces || 0) === 0;
    }).reduce((sum, r) => sum + (Number(r.currentMaxOccupancy) || 0), 0);
  }, [activeRooms, occupantsByRoom]);

  // Bedspaces in Shared Rooms (rooms with capacity > 1 that are partially occupied)
  const bedspacesInSharedRooms = useMemo(() => {
    return activeRooms.filter(r => {
      const occ = occupantsByRoom.get(r.roomNo.toLowerCase().trim()) || 0;
      const max = Number(r.currentMaxOccupancy) || 0;
      return max > 1 && occ > 0 && occ < max;
    }).reduce((sum, r) => {
      const occ = occupantsByRoom.get(r.roomNo.toLowerCase().trim()) || 0;
      const max = Number(r.currentMaxOccupancy) || 0;
      return sum + (max - occ);
    }, 0);
  }, [activeRooms, occupantsByRoom]);

  // Breakdown by Room Type
  const roomTypeSummary = useMemo(() => {
    const map = new Map<string, { totalRooms: number; maxCapacity: number; availableRooms: number }>();

    activeRooms.forEach(r => {
      const t = r.roomType || 'Standard';
      if (!map.has(t)) {
        map.set(t, { totalRooms: 0, maxCapacity: 0, availableRooms: 0 });
      }
      const entry = map.get(t)!;
      entry.totalRooms++;
      entry.maxCapacity += Number(r.currentMaxOccupancy) || 0;

      const occ = occupantsByRoom.get(r.roomNo.toLowerCase().trim()) || 0;
      if (occ === 0 && (r.voidBedspaces || 0) === 0) {
        entry.availableRooms++;
      }
    });

    return Array.from(map.entries()).map(([roomType, data]) => ({
      roomType,
      ...data
    })).sort((a, b) => b.totalRooms - a.totalRooms);
  }, [activeRooms, occupantsByRoom]);

  return (
    <div className="space-y-6">
      {/* KPI Highlights Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#605e5c] uppercase">Total Rooms</span>
            <Building className="w-4 h-4 text-[#0d9488]" />
          </div>
          <div className="text-2xl font-bold text-[#242424] mt-1.5">{totalRooms}</div>
          <p className="text-[10px] text-[#605e5c] mt-0.5">{availableRoomsCount} entirely vacant</p>
        </div>

        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#605e5c] uppercase">Total Bedspaces</span>
            <Bed className="w-4 h-4 text-[#4338ca]" />
          </div>
          <div className="text-2xl font-bold text-[#242424] mt-1.5">{totalBedspaces}</div>
          <p className="text-[10px] text-[#605e5c] mt-0.5">{totalVoidBedspaces} void bedspaces</p>
        </div>

        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#605e5c] uppercase">Current Occupancy</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1.5">{currentOccupancy}</div>
          <p className="text-[10px] text-[#605e5c] mt-0.5">
            {totalBedspaces > 0 ? ((currentOccupancy / totalBedspaces) * 100).toFixed(1) : 0}% utilization
          </p>
        </div>

        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#605e5c] uppercase">Contracted Capacity</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-[#242424] mt-1.5">{contractedBedspaces}</div>
          <p className="text-[10px] text-[#605e5c] mt-0.5">Approved Home Office ceiling</p>
        </div>
      </div>

      {/* Vacancy & Available Bedspace Reconciler */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-[#242424] uppercase tracking-wider">
            Available Bedspaces Breakdown
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 bg-[#faf9f8] border border-[#edebe9] rounded">
              <span className="text-[#323130]">Bedspaces in Fully Available Rooms:</span>
              <span className="font-bold text-[#0d9488]">{bedspacesInAvailableRooms}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-[#faf9f8] border border-[#edebe9] rounded">
              <span className="text-[#323130]">Available Bedspaces in Shared Rooms:</span>
              <span className="font-bold text-[#4338ca]">{bedspacesInSharedRooms}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded font-semibold text-emerald-950">
              <span>Total Available Bedspaces to Book:</span>
              <span>{bedspacesInAvailableRooms + bedspacesInSharedRooms}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-[#242424] uppercase tracking-wider">
            Reconciliation & Variance Check
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 bg-[#faf9f8] border border-[#edebe9] rounded">
              <span className="text-[#323130]">Current Occupants + Available + Void:</span>
              <span className="font-mono font-semibold">{currentOccupancy + (bedspacesInAvailableRooms + bedspacesInSharedRooms) + totalVoidBedspaces}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-[#faf9f8] border border-[#edebe9] rounded">
              <span className="text-[#323130]">Total Registered Maximum Capacity:</span>
              <span className="font-mono font-semibold">{totalBedspaces}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded font-semibold text-blue-950">
              <span>Reconciliation Status:</span>
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Reconciled
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Room Type Breakdown Table */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#edebe9] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0d9488]" />
            <h2 className="text-sm font-semibold text-[#242424]">
              Room Type & Capacity Matrix
            </h2>
          </div>
          <span className="text-xs text-[#605e5c]">
            Site: {selectedSite === 'all' ? 'All Sites' : selectedSite}
          </span>
        </div>

        {roomTypeSummary.length === 0 ? (
          <p className="text-xs text-[#605e5c] py-6 text-center">
            No rooms registered in room inventory.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold">
                  <th className="p-2.5">Room Type</th>
                  <th className="p-2.5 text-right">Total Rooms</th>
                  <th className="p-2.5 text-right">Maximum Capacity</th>
                  <th className="p-2.5 text-right">Available Rooms</th>
                  <th className="p-2.5 text-right">Capacity Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edebe9] text-[#323130]">
                {roomTypeSummary.map(row => (
                  <tr key={row.roomType} className="hover:bg-[#faf9f8] transition-colors">
                    <td className="p-2.5 font-semibold text-[#242424]">{row.roomType}</td>
                    <td className="p-2.5 text-right font-medium">{row.totalRooms}</td>
                    <td className="p-2.5 text-right font-medium">{row.maxCapacity} bedspaces</td>
                    <td className="p-2.5 text-right font-bold text-[#0d9488]">{row.availableRooms}</td>
                    <td className="p-2.5 text-right text-[#605e5c]">
                      {totalBedspaces > 0 ? ((row.maxCapacity / totalBedspaces) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
