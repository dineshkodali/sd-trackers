import React from 'react';
import { IconUsers as Users, IconBed as Bed, IconDoor as Door, IconAlertTriangle as AlertTriangle } from '@tabler/icons-react';
import type { RegisterOverview, RoomLine } from '../../utils/registerCounts';

/**
 * Headline counts of the Daily Register. Every figure comes from registerOverview(): each room and each person counted once,
 * for the chosen date. When the house is full it says so, and lists which rooms are full and where spaces are left.
 */

const listRooms = (rooms: RoomLine[], showLeft = false) =>
  rooms.map(r => (showLeft ? `${r.roomNo} (${r.left} left)` : r.roomNo)).join(', ');

const Card: React.FC<{ icon: React.ReactNode; title: string; badge?: React.ReactNode; children: React.ReactNode }> = ({ icon, title, badge, children }) => (
  <div className="bg-white border border-[#e1dfdd] rounded-xs p-2 space-y-0.5 min-w-0">
    <div className="flex items-center justify-between text-[#605e5c] text-[11px]">
      <span className="font-semibold flex items-center gap-1">{icon} {title}</span>
      {badge}
    </div>
    {children}
  </div>
);

const Badge: React.FC<{ tone: 'red' | 'green' | 'grey'; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-xs ${tone === 'red' ? 'bg-red-50 text-red-800' : tone === 'green' ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-100 text-neutral-700'}`}>{children}</span>
);

export const LiveRegisterKpiCards: React.FC<{ overview: RegisterOverview; dateLabel: string }> = ({ overview: o, dateLabel }) => {
  const pct = o.capacity > 0 ? Math.min(100, Math.round((o.present / o.capacity) * 100)) : 0;
  const notes = [
    o.overCapacityRooms.length > 0 && `${o.overCapacityRooms.length} room${o.overCapacityRooms.length === 1 ? '' : 's'} over capacity (${listRooms(o.overCapacityRooms)})`,
    o.notInRoomList > 0 && `${o.notInRoomList} resident${o.notInRoomList === 1 ? '' : 's'} in a room that is not in the room list`,
    o.duplicateRoomRows > 0 && `${o.duplicateRoomRows} repeated room row${o.duplicateRoomRows === 1 ? '' : 's'} ignored (same room entered more than once)`
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Card icon={<Users className="w-3 h-3 text-[#0d9488]" />} title="Service users present" badge={<Badge tone={o.isFull ? 'red' : 'grey'}>{pct}%</Badge>}>
          <div className="text-lg font-bold text-[#242424] leading-tight tabular-nums">{o.present} <span className="text-[11px] font-normal text-neutral-500">of {o.capacity} beds</span></div>
          <div className="text-[10px] text-neutral-500">on {dateLabel}, each person counted once</div>
        </Card>

        <Card icon={<Bed className="w-3 h-3 text-emerald-600" />} title="Bed spaces left" badge={<Badge tone={o.isFull ? 'red' : 'green'}>{o.isFull ? 'Full' : 'Available'}</Badge>}>
          <div className={`text-lg font-bold leading-tight tabular-nums ${o.isFull ? 'text-[#a4262c]' : 'text-emerald-700'}`}>{o.bedsLeft} <span className="text-[11px] font-normal text-neutral-500">{o.isFull ? 'left - all beds are full' : 'free'}</span></div>
          <div className="text-[10px] text-neutral-500">{o.capacity - o.bedsLeft > 0 ? `${Math.max(0, o.capacity - o.bedsLeft)} used` : 'none used'} · {o.capacity} usable beds in {o.rooms - o.voidRooms} rooms</div>
        </Card>

        <Card icon={<Door className="w-3 h-3 text-amber-600" />} title="Full rooms" badge={<Badge tone="grey">{o.fullRooms.length} of {o.rooms - o.voidRooms}</Badge>}>
          <div className="text-lg font-bold text-[#242424] leading-tight tabular-nums">{o.fullRooms.length} <span className="text-[11px] font-normal text-neutral-500">rooms full</span></div>
          <details className="text-[10px] text-neutral-600">
            <summary className="cursor-pointer select-none text-[#0d9488] font-semibold">{o.fullRooms.length > 0 ? 'Show which rooms' : 'No full rooms'}</summary>
            {o.fullRooms.length > 0 && <p className="mt-0.5 break-words">{listRooms(o.fullRooms)}</p>}
          </details>
        </Card>

        <Card icon={<Door className="w-3 h-3 text-emerald-600" />} title="Rooms with space" badge={<Badge tone="grey">{o.emptyRooms} empty</Badge>}>
          <div className="text-lg font-bold text-emerald-700 leading-tight tabular-nums">{o.roomsWithSpace.length} <span className="text-[11px] font-normal text-neutral-500">rooms, {o.bedsLeft} spaces</span></div>
          <details className="text-[10px] text-neutral-600">
            <summary className="cursor-pointer select-none text-[#0d9488] font-semibold">{o.roomsWithSpace.length > 0 ? 'Show where spaces are left' : 'No spaces left'}</summary>
            {o.roomsWithSpace.length > 0 && <p className="mt-0.5 break-words">{listRooms(o.roomsWithSpace, true)}</p>}
          </details>
        </Card>
      </div>
      {notes.length > 0 && (
        <p className="flex items-start gap-1 px-2 py-1 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xs">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{notes.join(' · ')}</span>
        </p>
      )}
    </div>
  );
};
