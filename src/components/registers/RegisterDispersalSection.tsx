import React, { useState, useMemo, useEffect } from 'react';
import { 
  LogOut, 
  Search, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Building, 
  Download 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DispersalRecord } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';

interface RegisterDispersalSectionProps {
  selectedSite: string;
  searchQuery?: string;
  exportTrigger?: { format: 'csv' | 'pdf'; ts: number } | null;
}

export const RegisterDispersalSection: React.FC<RegisterDispersalSectionProps> = ({ 
  selectedSite,
  searchQuery: externalSearchQuery,
  exportTrigger
}) => {
  const {
    dispersalRecords,
    updateDispersalRecord,
    dailyRegisterRecords,
    updateDailyRegisterRecord,
    canEditRecord
  } = useApp();

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredDispersals = useMemo(() => {
    return dispersalRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (r.suPortNassRef && r.suPortNassRef.toLowerCase().includes(q)) ||
        (r.flatRoomNumber && r.flatRoomNumber.toLowerCase().includes(q)) ||
        (r.siteName && r.siteName.toLowerCase().includes(q));

      const matchesSite = selectedSite === 'all' || r.siteName?.toLowerCase() === selectedSite.toLowerCase();
      
      const isCompleted = r.travelled === 'Yes' || Boolean(r.dateLeftProperty);
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'completed' ? isCompleted : !isCompleted);

      return matchesSearch && matchesSite && matchesStatus;
    });
  }, [dispersalRecords, searchQuery, selectedSite, statusFilter]);

  const paginatedDispersals = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredDispersals.slice(startIndex, startIndex + pageSize);
  }, [filteredDispersals, currentPage, pageSize]);

  // Handle Mark Travelled & Release Room
  const handleMarkTravelled = (rec: DispersalRecord) => {
    if (!canEditRecord()) return;
    const now = new Date().toISOString().slice(0, 10);
    updateDispersalRecord(rec.id, {
      travelled: 'Yes',
      dateLeftProperty: now
    });

    // Automatically update occupancy in daily register for this SU
    const matchedSU = dailyRegisterRecords.find(dr => 
      dr.portRef.toLowerCase().trim() === rec.suPortNassRef.toLowerCase().trim()
    );
    if (matchedSU) {
      updateDailyRegisterRecord(matchedSU.id, {
        occupied: 'No',
        availableToBook: 'Yes'
      });
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Site', 'Room / Flat', 'Port / NASS Ref', 'Dispersal Date', 'Letter Handed Date',
      'Letter Received', 'Travelled', 'Departure Date', 'Reason Failed To Travel'
    ];
    const rows = filteredDispersals.map(r => [
      r.siteName || '', r.flatRoomNumber || '', r.suPortNassRef, r.dispersalDate || '',
      r.dateLetterHandedToSu || '', r.hoDispersalLetterReceived || '', r.travelled || 'No',
      r.dateLeftProperty || '', r.reasonFailedToTravel || ''
    ]);
    exportTableToCsv({ filename: 'Dispersal_Occupancy_Schedule.csv', headers, rows });
  };

  const handleExportPdf = () => {
    const headers = ['Site', 'Room', 'Port / NASS Ref', 'Dispersal Date', 'Letter Handed', 'Travelled', 'Departure Date'];
    const rows = filteredDispersals.map(r => [
      r.siteName || '', r.flatRoomNumber || '', r.suPortNassRef, r.dispersalDate || '',
      r.dateLetterHandedToSu || '', r.travelled || 'No', r.dateLeftProperty || ''
    ]);
    exportTableToPdf({
      filename: `Dispersals_${new Date().toISOString().slice(0, 10)}.pdf`,
      title: 'Section 95 Dispersal Manifest',
      subtitle: `Dispersals & Room Releases for ${selectedSite === 'all' ? 'All Permitted Sites' : selectedSite}`,
      headers,
      rows,
      orientation: 'landscape'
    });
  };

  useEffect(() => {
    if (exportTrigger && exportTrigger.ts > 0) {
      if (exportTrigger.format === 'csv') {
        handleExportCsv();
      } else {
        handleExportPdf();
      }
    }
  }, [exportTrigger]);

  return (
    <div className="space-y-4">

      {/* Table */}
      <div className="bg-white border border-[#e1dfdd] shadow-xs rounded-xs overflow-hidden min-h-[500px] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
                <th className="p-2.5">Hotel / Site</th>
                <th className="p-2.5">Room No.</th>
                <th className="p-2.5">Port / NASS Ref</th>
                <th className="p-2.5">Dispersal Date</th>
                <th className="p-2.5">Letter Handed</th>
                <th className="p-2.5">Letter Received</th>
                <th className="p-2.5">Travelled</th>
                <th className="p-2.5">Departure Date</th>
                <th className="p-2.5">Failed Reason</th>
                <th className="p-2.5 text-right w-36 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9] text-[#323130]">
              {paginatedDispersals.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#605e5c]">
                    <LogOut className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                    <p className="font-semibold text-sm text-[#242424]">No dispersal records found</p>
                    <p className="text-xs text-[#605e5c] mt-0.5">Dispersals logged via the Dispersal Sheet or Home Office instructions will reflect here.</p>
                  </td>
                </tr>
              ) : (
                paginatedDispersals.map(d => {
                  const isCompleted = d.travelled === 'Yes' || Boolean(d.dateLeftProperty);
                  return (
                    <tr key={d.id} className="hover:bg-[#f0fdf4] transition-colors">
                      <td className="p-2.5 font-medium">{d.siteName || '—'}</td>
                      <td className="p-2.5 font-mono font-bold text-[#0f766e]">{d.flatRoomNumber || '—'}</td>
                      <td className="p-2.5 font-mono text-indigo-700">{d.suPortNassRef}</td>
                      <td className="p-2.5 text-[#323130]">{d.dispersalDate || '—'}</td>
                      <td className="p-2.5 text-[#605e5c]">{d.dateLetterHandedToSu || '—'}</td>
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          d.hoDispersalLetterReceived === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {d.hoDispersalLetterReceived || 'No'}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isCompleted ? 'Travelled' : 'Pending'}
                        </span>
                      </td>
                      <td className="p-2.5 text-[#605e5c]">{d.dateLeftProperty || '—'}</td>
                      <td className="p-2.5 text-[#a4262c]">{d.reasonFailedToTravel || '—'}</td>
                      <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                        {!isCompleted && canEditRecord() && (
                          <button
                            onClick={() => handleMarkTravelled(d)}
                            className="px-2 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                            title="Mark as travelled and release room in daily register"
                          >
                            Mark Left
                          </button>
                        )}
                        {isCompleted && (
                          <span className="text-[11px] text-emerald-700 font-semibold flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Room Released
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredDispersals.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>
    </div>
  );
};
