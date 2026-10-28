import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Users, UserMinus, Plus, ExternalLink, Search } from 'lucide-react';
import { suPropertyService } from '../../services/suPropertyService';
import { suEnhancementsService, type FamilyGroup, type FamilyMember } from '../../services/suEnhancementsService';
import { HOUSEHOLD_RELATIONSHIPS, activeFamilyOf, searchableForHousehold } from '../../utils/suEnhancementsLogic';
import type { ServiceUserMaster } from '../../types/masterData';
import { Field, ErrorBanner, Notice, StatusPill, SuModal, inputCls, primaryBtn, secondaryBtn, dangerBtn, fmtDate } from '../su/suUi';

/**
 * The household of one Service User. It is the shared family record: members added or removed here appear on every linked
 * profile, and changes made on any of those profiles appear here. Members are existing Service Users picked by search;
 * nobody is created, merged or deleted, and each person's own records stay on their own profile.
 */
export const SUHousehold: React.FC<{ serviceUser: ServiceUserMaster; canManage: boolean; onOpenServiceUser?: (suId: string) => void }> = ({ serviceUser, canManage, onOpenServiceUser }) => {
  const [family, setFamily] = useState<FamilyGroup | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [people, setPeople] = useState<Map<string, ServiceUserMaster>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<null | { kind: 'add' } | { kind: 'remove'; member: FamilyMember }>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const mine = await suEnhancementsService.listFamilyMembers({ suId: serviceUser.id });
    if (!mine.success) { setLoading(false); setError(mine.error || 'Could not load the household.'); return; }
    const link = activeFamilyOf(mine.data, serviceUser.id);
    const [all, fams, rows] = await Promise.all([
      suPropertyService.getServiceUsers(undefined, { includeArchived: true }),
      link ? suEnhancementsService.listFamilies() : Promise.resolve({ success: true, data: [] as FamilyGroup[] }),
      link ? suEnhancementsService.listFamilyMembers({ familyId: link.familyId }) : Promise.resolve({ success: true, data: [] as FamilyMember[] })
    ]);
    setLoading(false);
    if (all.success) setPeople(new Map(all.data.map(u => [u.id, u] as [string, ServiceUserMaster])));
    setFamily(link ? (fams.data.find(f => f.id === link.familyId) || null) : null);
    setMembers(link ? rows.data : []);
  }, [serviceUser.id]);
  useEffect(() => { void load(); }, [load]);

  const active = useMemo(() => members.filter(m => m.status === 'Active'), [members]);
  const former = useMemo(() => members.filter(m => m.status === 'Removed'), [members]);
  const nameOf = (id: string) => { const u = people.get(id); return u ? `${u.firstName} ${u.lastName}` : 'Service User'; };
  const done = async (msg: string) => { setDialog(null); setMessage(msg); await load(); };

  const changeRelationship = async (m: FamilyMember, relationship: string) => {
    setError(''); setMessage('');
    const res = await suEnhancementsService.householdSetRelationship(m.familyId, m.suId, relationship);
    if (!res.success) { setError(res.error || 'Could not update the relationship.'); return; }
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-700" />
          <h4 className="font-bold text-xs text-neutral-800">Household{family ? `: ${family.displayName || family.familyRef}` : ''}</h4>
          {active.length > 0 && <StatusPill status={`${active.length} member${active.length === 1 ? '' : 's'}`} tone="good" />}
        </div>
        {canManage && (
          <button type="button" onClick={() => { setMessage(''); setDialog({ kind: 'add' }); }} className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded font-semibold text-xs hover:bg-teal-100 flex items-center gap-1 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /><span>Add household member</span>
          </button>
        )}
      </div>
      <p className="text-[11px] text-neutral-500">Everyone in this household sees the same members on their own profile. Add or remove people from any of their profiles.</p>
      <ErrorBanner message={error} />
      {message && <Notice tone="ok">{message}</Notice>}

      {loading ? <p className="text-xs text-neutral-500">Loading household...</p> : active.length === 0 ? (
        <div className="border border-dashed border-neutral-300 rounded-lg p-5 text-center text-xs text-neutral-500 space-y-1">
          <p className="font-semibold text-neutral-600">{serviceUser.firstName} is not part of a household.</p>
          <p>{canManage ? 'Add an existing Service User to start one. Both profiles will then show it.' : 'A manager can link family members here.'}</p>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-[10px] font-bold text-neutral-500 uppercase">
              <tr><th className="p-2.5">Service User</th><th className="p-2.5">Reference</th><th className="p-2.5">Relationship</th><th className="p-2.5">Linked</th><th className="p-2.5" /></tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {active.map(m => {
                const u = people.get(m.suId);
                const me = m.suId === serviceUser.id;
                return (
                  <tr key={m.id} className={me ? 'bg-teal-50/40' : ''}>
                    <td className="p-2.5 font-semibold">{nameOf(m.suId)}{me && <span className="ml-1.5 text-[10px] font-normal text-teal-700">(this profile)</span>}</td>
                    <td className="p-2.5 font-mono text-[11px]">{u?.externalReference || u?.suReference || '—'}</td>
                    <td className="p-2.5">
                      {canManage ? (
                        <select className={`${inputCls} w-40`} value={m.relationship || ''} onChange={e => changeRelationship(m, e.target.value)} aria-label={`Relationship of ${nameOf(m.suId)}`}>
                          <option value="">Not recorded</option>
                          {Array.from(new Set([...(m.relationship ? [m.relationship] : []), ...HOUSEHOLD_RELATIONSHIPS])).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (m.relationship || <span className="text-neutral-400">Not recorded</span>)}
                    </td>
                    <td className="p-2.5 text-neutral-500">{fmtDate(m.joinedAt)}</td>
                    <td className="p-2.5">
                      <div className="flex gap-1.5 justify-end">
                        {!me && onOpenServiceUser && <button type="button" className={`${secondaryBtn} flex items-center gap-1`} onClick={() => onOpenServiceUser(m.suId)}><ExternalLink className="w-3 h-3" /> Profile</button>}
                        {canManage && <button type="button" className={`${dangerBtn} flex items-center gap-1`} onClick={() => { setMessage(''); setDialog({ kind: 'remove', member: m }); }}><UserMinus className="w-3 h-3" /> {me ? 'Leave' : 'Remove'}</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {former.length > 0 && <p className="text-[11px] text-neutral-500">Previously in this household: {former.map(m => `${nameOf(m.suId)} (left ${fmtDate(m.leftAt)})`).join(', ')}</p>}

      {dialog?.kind === 'add' && <AddDialog serviceUser={serviceUser} familyId={family?.id} members={members} onClose={() => setDialog(null)} onDone={() => done('Household member added. They now see the same household on their own profile.')} />}
      {dialog?.kind === 'remove' && (
        <RemoveDialog member={dialog.member} name={nameOf(dialog.member.suId)} self={dialog.member.suId === serviceUser.id} onClose={() => setDialog(null)}
          onDone={() => done('Removed from the household on every linked profile. The Service User record is unchanged.')} />
      )}
    </div>
  );
};

function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const run = async (fn: () => Promise<{ success: boolean; error?: string }>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    const res = await fn();
    lock.current = false; setBusy(false);
    if (!res.success) { setError(res.error || 'Could not save.'); return; }
    onDone();
  };
  return { busy, error, run };
}

/** Search existing Service Users by name or reference, pick one, say how they are related. */
const AddDialog: React.FC<{ serviceUser: ServiceUserMaster; familyId?: string; members: FamilyMember[]; onClose: () => void; onDone: () => void }> = ({ serviceUser, familyId, members, onClose, onDone }) => {
  const [all, setAll] = useState<ServiceUserMaster[]>([]);
  const [others, setOthers] = useState<FamilyMember[]>([]);
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState('');
  const [relationship, setRelationship] = useState('');
  const [anchorRelationship, setAnchorRelationship] = useState('');
  const { busy, error, run } = useSubmit(onDone);

  useEffect(() => {
    suPropertyService.getServiceUsers().then(r => { if (r.success) setAll(r.data); });
    suEnhancementsService.listFamilyMembers().then(r => { if (r.success) setOthers(r.data); });
  }, []);

  const results = useMemo(() => searchableForHousehold(all, query, serviceUser.id, members, others), [all, query, serviceUser.id, members, others]);
  const picked = all.find(u => u.id === pickedId);
  const pickedElsewhere = results.find(r => r.su.id === pickedId)?.inOtherHousehold;

  return (
    <SuModal title={`Add to ${serviceUser.firstName}'s household`} onClose={onClose} wide>
      <ErrorBanner message={error} />
      <Field label="Find an existing Service User" required hint="Type at least 2 letters of a name, or part of a reference. Only registered Service Users can be added.">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input className={`${inputCls} pl-8`} value={query} onChange={e => { setQuery(e.target.value); setPickedId(''); }} placeholder="Search by name or reference..." autoFocus aria-label="Search Service Users" />
        </div>
      </Field>
      {query.trim().length >= 2 && (
        <div className="max-h-56 overflow-y-auto border border-neutral-200 rounded-xs divide-y divide-neutral-200" role="listbox" aria-label="Matching Service Users">
          {results.length === 0 && <p className="p-3 text-neutral-500">No matching Service Users.</p>}
          {results.map(r => (
            <button key={r.su.id} type="button" role="option" aria-selected={pickedId === r.su.id} disabled={r.inOtherHousehold}
              onClick={() => setPickedId(r.su.id)}
              className={`w-full text-left p-2 flex items-center gap-2 ${r.inOtherHousehold ? 'opacity-50 cursor-not-allowed' : 'hover:bg-teal-50 cursor-pointer'} ${pickedId === r.su.id ? 'bg-teal-50' : ''}`}>
              <span className="flex-1">{r.su.firstName} {r.su.lastName}<span className="block text-[10px] text-neutral-500">{r.su.externalReference || r.su.suReference}{r.su.dateOfBirth ? ` · DOB ${fmtDate(r.su.dateOfBirth)}` : ''}</span></span>
              {r.inOtherHousehold && <span className="text-[10px] text-amber-700">In another household</span>}
            </button>
          ))}
        </div>
      )}
      {picked && !pickedElsewhere && (
        <div className="space-y-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xs">
          <p className="font-semibold">{picked.firstName} {picked.lastName}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${picked.firstName} is ${serviceUser.firstName}'s...`}>
              <select className={inputCls} value={relationship} onChange={e => setRelationship(e.target.value)}><option value="">Not recorded</option>{HOUSEHOLD_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}</select>
            </Field>
            {!familyId && (
              <Field label={`${serviceUser.firstName} is...`} hint="Used to start the household.">
                <select className={inputCls} value={anchorRelationship} onChange={e => setAnchorRelationship(e.target.value)}><option value="">Not recorded</option>{HOUSEHOLD_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}</select>
              </Field>
            )}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={busy || !pickedId || !!pickedElsewhere}
          onClick={() => run(() => suEnhancementsService.householdAdd({ anchorSuId: serviceUser.id, memberSuId: pickedId, relationship, anchorRelationship }))}>{busy ? 'Adding...' : 'Add to household'}</button>
      </div>
    </SuModal>
  );
};

const RemoveDialog: React.FC<{ member: FamilyMember; name: string; self: boolean; onClose: () => void; onDone: () => void }> = ({ member, name, self, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  return (
    <SuModal title={self ? 'Leave household' : `Remove ${name} from the household`} onClose={onClose}>
      <ErrorBanner message={error} />
      <Notice tone="warn">{self ? 'This person leaves the household on every linked profile.' : `${name} is removed from the household on every linked profile.`} Their Service User record, accommodation and history are not changed. A household left with one person is closed.</Notice>
      <Field label="Reason" required><textarea className={inputCls} rows={2} value={reason} onChange={e => setReason(e.target.value)} autoFocus /></Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={dangerBtn} disabled={busy} onClick={() => run(() => suEnhancementsService.householdRemove(member.familyId, member.suId, reason))}>{busy ? 'Removing...' : 'Remove'}</button>
      </div>
    </SuModal>
  );
};
