import React, { useMemo, useState } from 'react';
import { BedDouble, Plus, Trash2, UserRound } from 'lucide-react';
import { roomManagementService } from '../../../services/roomManagementService';
import { BED_TYPES, ITEM_CONDITIONS } from '../../../types/roomManagement';
import { bedViews, freeBeds, residentsWithoutBed } from '../../../utils/roomManagementLogic';
import { residentName } from '../useRoomData';
import { Card, Chip, EmptyState, btnCls, conditionTone, dangerBtnCls, fmtDate, inputCls, primaryBtnCls } from '../roomUi';
import type { RoomTabProps } from './tabTypes';

export const BedsTab: React.FC<RoomTabProps> = ({ room, data, actor, canManage, refresh, toast }) => {
  const active = data.placements.filter(p => p.status === 'Active');
  const past = data.placements.filter(p => p.status !== 'Active').sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  const views = useMemo(() => bedViews(data.beds, data.placements), [data.beds, data.placements]);
  const unassigned = residentsWithoutBed(data.placements);
  const cap = Math.max(1, room.capacity || 1);
  const [bedType, setBedType] = useState<string>('Single');
  const [count, setCount] = useState(Math.max(1, cap - data.beds.length));
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<{ success: boolean; error?: string }>, okMsg?: string) => {
    setBusy(key);
    try {
      const r = await fn();
      if (r.success) { if (okMsg) toast(okMsg); await refresh(); } else toast(r.error || 'That did not work.', 'error');
    } finally { setBusy(null); }
  };

  const addBeds = (n: number) => run('add', () => roomManagementService.addBeds(room, n, bedType, data.beds, actor), `${n} bed${n > 1 ? 's' : ''} added`);

  return (
    <div className="space-y-3">
      <Card
        title={<><BedDouble className="w-3.5 h-3.5 text-[#0d9488]" /> Beds ({data.beds.length}) &middot; capacity {cap}</>}
        actions={canManage ? (
          <div className="flex items-center gap-1.5">
            <select aria-label="Bed type" className={`${inputCls} !w-32`} value={bedType} onChange={e => setBedType(e.target.value)}>
              {BED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input aria-label="Number of beds to add" type="number" min={1} max={20} className={`${inputCls} !w-14`} value={count} onChange={e => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
            <button type="button" className={primaryBtnCls} disabled={busy === 'add'} onClick={() => addBeds(count)}><Plus className="w-3.5 h-3.5" /> Add beds</button>
          </div>
        ) : null}
      >
        {views.length === 0 ? (
          <EmptyState icon={<BedDouble className="w-8 h-8" />} title="No beds set up yet" hint={`This room is set up for ${cap} bed${cap > 1 ? 's' : ''}. Add them so each resident can be given a specific bed.`}>
            {canManage && <button type="button" className={primaryBtnCls} disabled={busy === 'add'} onClick={() => addBeds(cap)}>Add {cap} bed{cap > 1 ? 's' : ''} to match capacity</button>}
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {views.map(v => (
              <div key={v.bed.id} className={`border rounded-xs p-2.5 ${v.state === 'Occupied' ? 'border-purple-200 bg-purple-50/40' : v.state === 'Out of Service' ? 'border-neutral-300 bg-neutral-50' : 'border-emerald-200 bg-emerald-50/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[#1e293b] text-sm">Bed {v.bed.bedLabel}</div>
                  <Chip tone={v.state === 'Occupied' ? 'purple' : v.state === 'Available' ? 'green' : 'grey'}>{v.state}</Chip>
                </div>
                <div className="text-[11px] text-[#64748b] mt-0.5">{v.bed.bedType}{v.bed.mattressCondition ? <> &middot; mattress <Chip tone={conditionTone(v.bed.mattressCondition)}>{v.bed.mattressCondition}</Chip></> : null}</div>
                <div className="mt-1.5 text-xs min-h-[1.25rem]">
                  {v.placement ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-purple-900"><UserRound className="w-3.5 h-3.5" />{residentName(data.suById.get(v.placement.suId), v.placement.suId)}</span>
                  ) : <span className="text-neutral-400">Nobody in this bed</span>}
                </div>
                {canManage && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <select aria-label={`Mattress condition for bed ${v.bed.bedLabel}`} className={`${inputCls} !w-auto !py-1`} value={v.bed.mattressCondition || 'Good'}
                      onChange={e => run(`m-${v.bed.id}`, () => roomManagementService.updateBed(v.bed, { mattressCondition: e.target.value }), 'Mattress condition updated')}>
                      {ITEM_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" className={btnCls} disabled={!!v.placement || busy === `s-${v.bed.id}`}
                      title={v.placement ? 'Move the resident first' : undefined}
                      onClick={() => run(`s-${v.bed.id}`, () => roomManagementService.updateBed(v.bed, { status: v.bed.status === 'Out of Service' ? 'Available' : 'Out of Service' }), v.bed.status === 'Out of Service' ? 'Bed back in service' : 'Bed taken out of service')}>
                      {v.bed.status === 'Out of Service' ? 'Return to service' : 'Out of service'}
                    </button>
                    <button type="button" className={dangerBtnCls} disabled={!!v.placement} title="Delete bed" aria-label={`Delete bed ${v.bed.bedLabel}`}
                      onClick={() => run(`d-${v.bed.id}`, () => roomManagementService.deleteBed(v.bed, data.placements), 'Bed deleted')}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {data.beds.length > 0 && data.beds.length !== cap && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xs px-2 py-1 mt-2">
            {data.beds.length} bed{data.beds.length > 1 ? 's' : ''} set up but the room capacity is {cap}. Change the capacity on the Overview tab or add/remove beds so they match.
          </p>
        )}
      </Card>

      <Card title={<><UserRound className="w-3.5 h-3.5 text-[#0d9488]" /> Current residents ({active.length})</>}>
        {active.length === 0 ? (
          <EmptyState title="Nobody is placed in this room" hint="Place residents from Service Users → Placements. They appear here straight away." />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                <th className="py-1 pr-2">Resident</th><th className="py-1 pr-2">Moved in</th><th className="py-1 pr-2">Placement</th><th className="py-1">Bed</th>
              </tr>
            </thead>
            <tbody>
              {active.map(p => {
                const options = [...freeBeds(data.beds, data.placements), ...data.beds.filter(b => b.id === p.bedId)].sort((a, b) => a.bedLabel.localeCompare(b.bedLabel, undefined, { numeric: true }));
                return (
                  <tr key={p.id} className="border-b border-[#f1f5f9]">
                    <td className="py-1.5 pr-2 font-semibold text-[#1e293b]">{residentName(data.suById.get(p.suId), p.suId)}</td>
                    <td className="py-1.5 pr-2">{fmtDate(p.startDate)}</td>
                    <td className="py-1.5 pr-2 text-[#64748b]">{p.placementReference}{p.placementType ? ` · ${p.placementType}` : ''}</td>
                    <td className="py-1.5">
                      {data.beds.length === 0 ? <span className="text-neutral-400">No beds set up</span> : (
                        <select aria-label={`Bed for ${residentName(data.suById.get(p.suId), p.suId)}`} className={`${inputCls} !w-auto`} value={p.bedId || ''} disabled={busy === `a-${p.id}`}
                          onChange={e => run(`a-${p.id}`, () => roomManagementService.assignBed(p, e.target.value || null, data.beds, data.placements, actor, room.roomNumber), 'Bed updated')}>
                          <option value="">Not assigned</option>
                          {options.map(b => <option key={b.id} value={b.id}>Bed {b.bedLabel} ({b.bedType})</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {unassigned.length > 0 && data.beds.length > 0 && (
          <p className="text-[11px] text-sky-900 bg-sky-50 border border-sky-200 rounded-xs px-2 py-1 mt-2">{unassigned.length} resident{unassigned.length > 1 ? 's have' : ' has'} not been given a bed yet.</p>
        )}
      </Card>

      <Card title={`Previous residents (${past.length})`}>
        {past.length === 0 ? <p className="text-[11px] text-neutral-500">No one has left this room yet.</p> : (
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]"><th className="py-1 pr-2">Resident</th><th className="py-1 pr-2">From</th><th className="py-1 pr-2">To</th><th className="py-1">Outcome</th></tr></thead>
            <tbody>
              {past.slice(0, 50).map(p => (
                <tr key={p.id} className="border-b border-[#f1f5f9]">
                  <td className="py-1.5 pr-2">{residentName(data.suById.get(p.suId), p.suId)}</td>
                  <td className="py-1.5 pr-2">{fmtDate(p.startDate)}</td>
                  <td className="py-1.5 pr-2">{fmtDate(p.endDate)}</td>
                  <td className="py-1.5"><Chip tone="grey">{p.status}</Chip>{p.reason ? <span className="text-[#64748b]"> {p.reason}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};
