import React, { useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Card, Chip, EmptyState, btnCls, fmtDate } from '../roomUi';
import type { RoomTabProps } from './tabTypes';

/** Room-check inspections (Room Checks page) that belong to this room. */
export const ChecksTab: React.FC<RoomTabProps> = ({ room, property }) => {
  const { roomChecks, sites, setActivePage } = useApp();
  const siteName = useMemo(() => sites.find(s => s.id === property?.siteId)?.name || '', [sites, property?.siteId]);

  const mine = useMemo(() => (roomChecks || [])
    .filter(c => c.roomId === room.id || (String(c.roomNumber).trim().toLowerCase() === String(room.roomNumber).trim().toLowerCase() && (!siteName || String(c.siteName).toLowerCase() === siteName.toLowerCase())))
    .sort((a, b) => String(b.inspectionDate).localeCompare(String(a.inspectionDate))), [roomChecks, room.id, room.roomNumber, siteName]);

  const tone = (s: string) => (/pass/i.test(s) ? 'green' : /fail/i.test(s) ? 'red' : 'amber');

  return (
    <Card title={<><ClipboardList className="w-3.5 h-3.5 text-[#0d9488]" /> Room checks ({mine.length})</>} actions={<button type="button" className={btnCls} onClick={() => setActivePage('roomChecks')}>Open Room Checks</button>}>
      {mine.length === 0 ? <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="No room checks recorded for this room" hint="Inspections done on the Room Checks page for this room number appear here." /> : (
        <table className="w-full text-xs">
          <thead><tr className="text-left text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]"><th className="py-1 pr-2">Date</th><th className="py-1 pr-2">Officer</th><th className="py-1 pr-2">Result</th><th className="py-1">Comments</th></tr></thead>
          <tbody>
            {mine.map(c => (
              <tr key={c.id} className="border-b border-[#f1f5f9] align-top">
                <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDate(c.inspectionDate)}</td>
                <td className="py-1.5 pr-2">{c.officerName || '—'}</td>
                <td className="py-1.5 pr-2"><Chip tone={tone(String(c.overallStatus))}>{String(c.overallStatus)}</Chip></td>
                <td className="py-1.5 text-[#475569]">{c.finalComments || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
};
