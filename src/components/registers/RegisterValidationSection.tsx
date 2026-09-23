import React, { useMemo } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Bed, 
  Building, 
  Users 
} from 'lucide-react';
import { DailyRegisterRecord, DailyRegisterRoom } from '../../types';

interface RegisterValidationSectionProps {
  rooms: DailyRegisterRoom[];
  records: DailyRegisterRecord[];
  selectedSite: string;
}

interface ValidationIssue {
  id: string;
  category: string;
  severity: 'error' | 'warning' | 'info';
  item: string;
  roomNo?: string;
  message: string;
  suggestedAction: string;
}

export const RegisterValidationSection: React.FC<RegisterValidationSectionProps> = ({
  rooms,
  records,
  selectedSite
}) => {
  const issues = useMemo(() => {
    const list: ValidationIssue[] = [];

    // Filter by site if applicable
    const activeRooms = selectedSite === 'all' 
      ? rooms 
      : rooms.filter(r => r.hotel?.toLowerCase() === selectedSite.toLowerCase());
    
    const activeRecords = selectedSite === 'all'
      ? records
      : records.filter(r => r.hotel?.toLowerCase() === selectedSite.toLowerCase());

    const roomLookup = new Map(activeRooms.map(r => [r.roomNo.toLowerCase().trim(), r]));
    const occupantsByRoom = new Map<string, DailyRegisterRecord[]>();

    activeRecords.forEach(r => {
      const k = (r.roomNo || '').toLowerCase().trim();
      if (!occupantsByRoom.has(k)) occupantsByRoom.set(k, []);
      occupantsByRoom.get(k)!.push(r);
    });

    // 1. Capacity & Over-Occupancy validation
    occupantsByRoom.forEach((occupants, roomNoKey) => {
      const room = roomLookup.get(roomNoKey);
      const activeCount = occupants.filter(o => o.occupied === 'Yes' || !o.occupied).length;
      if (room) {
        if (activeCount > room.currentMaxOccupancy) {
          list.push({
            id: `over-occ-${roomNoKey}`,
            category: 'Maximum Capacity',
            severity: 'error',
            item: `Room ${room.roomNo}`,
            roomNo: room.roomNo,
            message: `Over-occupancy detected: ${activeCount} residents assigned to room with maximum capacity of ${room.currentMaxOccupancy}.`,
            suggestedAction: 'Transfer excess service user or update room inventory maximum capacity.'
          });
        }
      } else {
        list.push({
          id: `unreg-room-${roomNoKey}`,
          category: 'Room Inventory',
          severity: 'warning',
          item: `Room ${occupants[0]?.roomNo || roomNoKey}`,
          roomNo: occupants[0]?.roomNo,
          message: `Residents assigned to Room ${occupants[0]?.roomNo}, but this room is not registered in Room Inventory.`,
          suggestedAction: 'Add this room into the Room List inventory tab.'
        });
      }
    });

    // 2. Void Reason Validation
    activeRecords.forEach(r => {
      if (r.isVoid === 'Yes' && (!r.voidReason || r.voidReason.trim() === '')) {
        list.push({
          id: `void-reason-rec-${r.id}`,
          category: 'Void Reason',
          severity: 'error',
          item: `${r.name} (Room ${r.roomNo})`,
          roomNo: r.roomNo,
          message: 'Room/Bed marked as Void, but no Void Reason was provided.',
          suggestedAction: 'Enter a valid void reason (e.g. Maintenance, Deep Clean, Decant).'
        });
      }
    });

    activeRooms.forEach(rm => {
      if (rm.voidBedspaces > 0 && (!rm.voidReason || rm.voidReason.trim() === '')) {
        list.push({
          id: `void-reason-rm-${rm.id}`,
          category: 'Void Reason',
          severity: 'error',
          item: `Room ${rm.roomNo} Inventory`,
          roomNo: rm.roomNo,
          message: `${rm.voidBedspaces} void bedspaces specified without a mandatory Void Reason.`,
          suggestedAction: 'Update room inventory to document why bedspaces are void.'
        });
      }
    });

    // 3. Required Fields & Demographic Validation
    activeRecords.forEach(r => {
      if (!r.portRef || r.portRef.trim() === '') {
        list.push({
          id: `port-ref-${r.id}`,
          category: 'Required Fields',
          severity: 'error',
          item: `${r.name || 'Resident'} in Room ${r.roomNo}`,
          roomNo: r.roomNo,
          message: 'Missing Home Office Port Reference.',
          suggestedAction: 'Enter official Port Reference.'
        });
      }
      if (!r.name || r.name.trim() === '') {
        list.push({
          id: `name-${r.id}`,
          category: 'Required Fields',
          severity: 'error',
          item: `Room ${r.roomNo}`,
          roomNo: r.roomNo,
          message: 'Service user name is blank.',
          suggestedAction: 'Enter full official name of service user.'
        });
      }
      if (!r.nationality || r.nationality.trim() === '') {
        list.push({
          id: `nat-${r.id}`,
          category: 'Demographics',
          severity: 'warning',
          item: `${r.name} (Room ${r.roomNo})`,
          roomNo: r.roomNo,
          message: 'Nationality is unspecified or blank.',
          suggestedAction: 'Update service user record with country of origin.'
        });
      }
      if (!r.language || r.language.trim() === '') {
        list.push({
          id: `lang-${r.id}`,
          category: 'Demographics',
          severity: 'warning',
          item: `${r.name} (Room ${r.roomNo})`,
          roomNo: r.roomNo,
          message: 'Primary language is unspecified or blank.',
          suggestedAction: 'Enter language or dialect for welfare and translation compliance.'
        });
      }
    });

    return list;
  }, [rooms, records, selectedSite]);

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Summary Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#605e5c] uppercase">Validation Status</span>
            {errorCount === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
          </div>
          <div className={`text-2xl font-bold mt-2 ${errorCount === 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {errorCount === 0 ? 'Fully Compliant' : `${errorCount} Errors Found`}
          </div>
          <p className="text-[11px] text-[#605e5c] mt-1">
            Site: {selectedSite === 'all' ? 'All Sites' : selectedSite}
          </p>
        </div>

        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#605e5c] uppercase">Critical Errors</span>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-700 mt-2">
            {errorCount}
          </div>
          <p className="text-[11px] text-[#605e5c] mt-1">
            Blocks compliance submission
          </p>
        </div>

        <div className="bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#605e5c] uppercase">Warnings & Notices</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">
            {warningCount}
          </div>
          <p className="text-[11px] text-[#605e5c] mt-1">
            Missing demographics or unlinked rooms
          </p>
        </div>
      </div>

      {/* Issues Table Panel */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#edebe9] pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0d9488]" />
            <h2 className="text-sm font-semibold text-[#242424]">
              Cross Checks & Data Quality Validation Results
            </h2>
          </div>
          <span className="text-xs text-[#605e5c]">
            {issues.length} total checks evaluated
          </span>
        </div>

        {issues.length === 0 ? (
          <div className="py-12 text-center text-[#605e5c]">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
            <p className="font-semibold text-sm text-[#242424]">All registers & rooms are 100% valid</p>
            <p className="text-xs text-[#605e5c] mt-0.5">No capacity overages, missing required fields, or void discrepancies found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold">
                  <th className="p-2.5 w-20">Severity</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Target Record</th>
                  <th className="p-2.5">Validation Message</th>
                  <th className="p-2.5">Action Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edebe9] text-[#323130]">
                {issues.map(issue => (
                  <tr key={issue.id} className="hover:bg-[#faf9f8] transition-colors">
                    <td className="p-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        issue.severity === 'error'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {issue.severity}
                      </span>
                    </td>
                    <td className="p-2.5 font-semibold text-[#242424]">{issue.category}</td>
                    <td className="p-2.5 font-medium text-[#0f766e]">{issue.item}</td>
                    <td className="p-2.5 text-[#323130]">{issue.message}</td>
                    <td className="p-2.5 text-xs text-[#4338ca]">{issue.suggestedAction}</td>
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
