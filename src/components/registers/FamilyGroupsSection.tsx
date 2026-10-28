import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Users, UserMinus, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suTrackerService, type SuDirectoryRow } from '../../services/suTrackerService';
import { suEnhancementsService, type FamilyGroup, type FamilyMember } from '../../services/suEnhancementsService';
import { FAMILY_RELATIONSHIPS, addableToFamily, activeFamilyOf } from '../../utils/suEnhancementsLogic';
import { SiteFilterSelect, TrackerExport, RefreshButton, ResetFiltersButton, type TrackerExportColumn } from '../common/TrackerToolbar';
import { TrackerHeader, PrimaryButton } from '../common/TrackerLayout';
import { Pagination } from '../common/Pagination';
import { usePaged, SearchBox, filterSelectCls } from '../su/tableControls';
import { Field, ErrorBanner, Notice, StatusPill, SuModal, inputCls, primaryBtn, secondaryBtn, dangerBtn, useSuActor, fmtDate } from '../su/suUi';

interface FamilyExportRow { family: FamilyGroup; member: FamilyMember | null }

/**
 * Family groups in the Daily Register. A group only links existing Service User records: nobody is created or merged,
 * and each person's health, transport, meals, education and case information stays on their own profile.
 * Removing a member ends the link (kept as history) and leaves the person and their records untouched.
 */
export const FamilyGroupsSection: React.FC<{ onOpenProfile?: (suId: string, reference: string) => void }> = ({ onOpenProfile }) => {
  const { sites, isSitePermitted, defaultSiteFilter } = useApp();
  const actor = useSuActor();
  const [directory, setDirectory] = useState<SuDirectoryRow[]>([]);
  // Follows the property chosen in the top bar (and the user's permitted properties)
  const [siteFilter, setSiteFilter] = useState<string>(defaultSiteFilter);
  useEffect(() => { setSiteFilter(defaultSiteFilter); }, [defaultSiteFilter]);
  const [families, setFamilies] = useState<FamilyGroup[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Active' | 'Closed' | 'all'>('Active');
  const [relationshipFilter, setRelationshipFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'newest' | 'members'>('name');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialog, setDialog] = useState<null | { kind: 'create' } | { kind: 'add'; family: FamilyGroup } | { kind: 'remove'; member: FamilyMember } | { kind: 'relationship'; member: FamilyMember }>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const [dir, fam, mem] = await Promise.all([suTrackerService.loadSuDirectory(sites), suEnhancementsService.listFamilies(), suEnhancementsService.listFamilyMembers()]);
    setLoading(false);
    const failed = [dir, fam, mem].find(r => !r.success);
    if (failed) { setError(failed.error || 'Could not load family groups.'); return; }
    setDirectory(dir.data.filter(r => isSitePermitted(r.siteName, 'all'))); setFamilies(fam.data); setMembers(mem.data);
  }, [sites, isSitePermitted]);
  useEffect(() => { void load(); }, [load]);

  const suById = useMemo(() => new Map(directory.map(r => [r.su.id, r] as const)), [directory]);
  const nameOf = (suId: string) => { const s = suById.get(suId)?.su; return s ? `${s.firstName} ${s.lastName}` : 'a Service User'; };
  const activeOf = useCallback((familyId: string) => members.filter(m => m.familyId === familyId && m.status === 'Active'), [members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = families.filter(f => {
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      const active = activeOf(f.id);
      // A family shows under a property when any active member lives there; groups without members show everywhere
      if (siteFilter !== 'all' && active.length > 0 && !active.some(m => isSitePermitted(suById.get(m.suId)?.siteName, siteFilter))) return false;
      if (relationshipFilter !== 'all' && !active.some(m => m.relationship === relationshipFilter)) return false;
      if (!q) return true;
      const names = members.filter(m => m.familyId === f.id).map(m => { const s = suById.get(m.suId)?.su; return `${s?.firstName || ''} ${s?.lastName || ''} ${s?.externalReference || ''} ${s?.suReference || ''}`; }).join(' ');
      return `${f.displayName || ''} ${f.familyRef || ''} ${names}`.toLowerCase().includes(q);
    });
    const label = (f: FamilyGroup) => (f.displayName || f.familyRef || '').toLowerCase();
    return list.sort((a, b) =>
      sortBy === 'newest' ? String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        : sortBy === 'members' ? activeOf(b.id).length - activeOf(a.id).length || label(a).localeCompare(label(b))
        : label(a).localeCompare(label(b), undefined, { numeric: true }));
  }, [families, members, suById, search, statusFilter, relationshipFilter, siteFilter, sortBy, activeOf, isSitePermitted]);
  const paged = usePaged(filtered, page, pageSize);

  const filtersActive = !!search || statusFilter !== 'Active' || relationshipFilter !== 'all' || sortBy !== 'name' || siteFilter !== defaultSiteFilter;
  const resetFilters = () => { setSearch(''); setStatusFilter('Active'); setRelationshipFilter('all'); setSortBy('name'); setSiteFilter(defaultSiteFilter); setPage(1); };
  const done = async (msg: string) => { setDialog(null); setMessage(msg); await load(); };

  // One export row per member (current and former), so the whole family history is in the file
  const toRows = useCallback((list: FamilyGroup[]): FamilyExportRow[] =>
    list.flatMap(f => { const ms = members.filter(m => m.familyId === f.id); return ms.length ? ms.map(m => ({ family: f, member: m })) : [{ family: f, member: null }]; }), [members]);
  const allRows = useMemo(() => toRows(families), [families, toRows]);
  const filteredRows = useMemo(() => toRows(filtered), [filtered, toRows]);
  const exportCols: TrackerExportColumn<FamilyExportRow>[] = [
    { id: 'family', label: 'Family', get: x => x.family.displayName },
    { id: 'ref', label: 'Family reference', get: x => x.family.familyRef },
    { id: 'familyStatus', label: 'Family status', get: x => x.family.status },
    { id: 'member', label: 'Member', get: x => (x.member ? nameOf(x.member.suId) : '') },
    { id: 'suRef', label: 'Port / SU reference', get: x => (x.member ? suById.get(x.member.suId)?.su.externalReference || suById.get(x.member.suId)?.su.suReference : '') },
    { id: 'property', label: 'Property', get: x => (x.member ? suById.get(x.member.suId)?.siteName : '') },
    { id: 'room', label: 'Room', get: x => (x.member ? suById.get(x.member.suId)?.roomNo : '') },
    { id: 'relationship', label: 'Relationship', get: x => x.member?.relationship },
    { id: 'memberStatus', label: 'Membership', get: x => x.member?.status },
    { id: 'joined', label: 'Linked on', get: x => (x.member ? fmtDate(x.member.joinedAt) : '') },
    { id: 'left', label: 'Left on', get: x => (x.member?.leftAt ? fmtDate(x.member.leftAt) : '') },
    { id: 'reason', label: 'Reason for leaving', get: x => x.member?.removalReason }
  ];

  return (
    <div className="space-y-4">
      <TrackerHeader
        icon={<Users className="w-5 h-5" />}
        title="Family Groups"
        countLabel={loading || error ? undefined : `${filtered.length} Families`}
        description="Related Service Users linked by staff. Sharing a room or address does not link anyone, and each person's records stay on their own profile."
        actions={
          <>
            <RefreshButton onClick={load} loading={loading} />
            <TrackerExport<FamilyExportRow> moduleName="Family Groups" filename="Family_Groups" title="Family Groups" allRows={allRows} filteredRows={filteredRows} columns={exportCols} dateOf={x => x.member?.joinedAt || x.family.createdAt || ''} />
            {actor.isManager && <PrimaryButton onClick={() => { setMessage(''); setDialog({ kind: 'create' }); }} label="+ New Family Group" />}
          </>
        }
        notice={message ? <div className="mt-3"><Notice tone="ok">{message}</Notice></div> : undefined}
        filtersClassName="flex flex-wrap lg:flex-nowrap items-center gap-2"
        filters={
          <>
            <SearchBox value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search family, member or reference..." />
            <SiteFilterSelect value={siteFilter} onChange={v => { setSiteFilter(v); setPage(1); }} />
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as 'Active' | 'Closed' | 'all'); setPage(1); }} className={filterSelectCls} aria-label="Family status">
              <option value="Active">Active Families</option><option value="Closed">Closed Families</option><option value="all">All Families</option>
            </select>
            <select value={relationshipFilter} onChange={e => { setRelationshipFilter(e.target.value); setPage(1); }} className={filterSelectCls} aria-label="Relationship">
              <option value="all">Any Relationship</option>{FAMILY_RELATIONSHIPS.map(r => <option key={r} value={r}>{`Has a ${r.toLowerCase()}`}</option>)}
            </select>
            <select value={sortBy} onChange={e => { setSortBy(e.target.value as 'name' | 'newest' | 'members'); setPage(1); }} className={filterSelectCls} aria-label="Sort families">
              <option value="name">Sort: Name</option><option value="newest">Sort: Newest</option><option value="members">Sort: Most members</option>
            </select>
            <ResetFiltersButton onClick={resetFilters} active={filtersActive} />
          </>
        }
      />
      <ErrorBanner message={error} />
      {loading && <p className="text-xs text-neutral-500">Loading family groups...</p>}
      {!loading && filtered.length === 0 && (
        <div className="bg-white border border-dashed border-neutral-300 rounded-xs p-8 text-center text-xs text-neutral-500">
          {families.length === 0 ? 'No family groups have been created yet.' : 'No family groups match your filters.'}
        </div>
      )}
      {paged.map(f => {
        const active = activeOf(f.id);
        const former = members.filter(m => m.familyId === f.id && m.status === 'Removed');
        return (
          <div key={f.id} className="bg-white border border-[#e5e5e5] rounded-xs">
            <div className="px-4 py-2.5 border-b border-[#e5e5e5] bg-[#faf9f8] flex items-center gap-2 flex-wrap">
              <Users className="w-4 h-4 text-teal-700" />
              <span className="font-bold text-xs text-neutral-800">{f.displayName || f.familyRef}</span>
              {f.familyRef && f.displayName && <span className="text-[11px] text-neutral-500">Ref {f.familyRef}</span>}
              <StatusPill status={f.status} tone={f.status === 'Active' ? 'good' : 'neutral'} />
              <span className="text-[11px] text-neutral-500">{active.length} member{active.length === 1 ? '' : 's'}</span>
              <div className="flex-1" />
              {actor.isManager && f.status === 'Active' && <button type="button" className={secondaryBtn} onClick={() => { setMessage(''); setDialog({ kind: 'add', family: f }); }}>Add member</button>}
            </div>
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-neutral-200">
                {active.length === 0 && <tr><td className="p-3 text-neutral-500">No active members.</td></tr>}
                {active.map(m => {
                  const row = suById.get(m.suId);
                  const su = row?.su;
                  return (
                    <tr key={m.id}>
                      <td className="p-2.5">{su ? `${su.firstName} ${su.lastName}` : 'Service User not available to you'}<div className="text-[10px] text-neutral-500">{su?.externalReference || su?.suReference}{row?.roomNo ? ` · Room ${row.roomNo}` : ''}{row?.siteName ? ` · ${row.siteName}` : ''}</div></td>
                      <td className="p-2.5">{m.relationship || <span className="text-neutral-400">Relationship not recorded</span>}</td>
                      <td className="p-2.5 text-neutral-500">Linked {fmtDate(m.joinedAt)}</td>
                      <td className="p-2.5">
                        <div className="flex gap-1.5 justify-end flex-wrap">
                          {su && onOpenProfile && <button type="button" className={`${secondaryBtn} flex items-center gap-1`} onClick={() => onOpenProfile(su.id, su.externalReference || su.suReference)}><ExternalLink className="w-3 h-3" /> Profile</button>}
                          {actor.isManager && <button type="button" className={secondaryBtn} onClick={() => { setMessage(''); setDialog({ kind: 'relationship', member: m }); }}>Relationship</button>}
                          {actor.isManager && <button type="button" className={`${dangerBtn} flex items-center gap-1`} onClick={() => { setMessage(''); setDialog({ kind: 'remove', member: m }); }}><UserMinus className="w-3 h-3" /> Remove</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {former.length > 0 && (
              <div className="px-4 py-2 border-t border-[#e5e5e5] text-[11px] text-neutral-500">
                Previously linked: {former.map(m => `${nameOf(m.suId)} (left ${fmtDate(m.leftAt)})`).join(', ')}
              </div>
            )}
          </div>
        );
      })}
      {!loading && filtered.length > 0 && (
        <div className="bg-white border border-[#e5e5e5] rounded-xs overflow-hidden">
          <Pagination currentPage={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
        </div>
      )}

      {dialog?.kind === 'create' && <CreateDialog directory={directory} members={members} user={actor.name} onClose={() => setDialog(null)} onDone={() => done('Family group created.')} />}
      {dialog?.kind === 'add' && <AddMemberDialog family={dialog.family} directory={directory} members={members} user={actor.name} onClose={() => setDialog(null)} onDone={() => done('Member added.')} />}
      {dialog?.kind === 'remove' && <RemoveDialog member={dialog.member} name={suById.get(dialog.member.suId)?.su ? nameOf(dialog.member.suId) : 'this Service User'} user={actor.name} onClose={() => setDialog(null)} onDone={() => done('Member removed from the family group. Their Service User record is unchanged.')} />}
      {dialog?.kind === 'relationship' && <RelationshipDialog member={dialog.member} user={actor.name} onClose={() => setDialog(null)} onDone={() => done('Relationship updated.')} />}
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

/** Pick existing Service Users: search, then tick the ones to link. Anyone already in an active family is not offered. */
const MemberPicker: React.FC<{ directory: SuDirectoryRow[]; members: FamilyMember[]; chosen: Record<string, string>; setChosen: (v: Record<string, string>) => void }> = ({ directory, members, chosen, setChosen }) => {
  const [q, setQ] = useState('');
  const available = useMemo(() => {
    const ok = new Set(addableToFamily(directory.map(r => r.su), members).map(s => s.id));
    const needle = q.trim().toLowerCase();
    return directory.filter(r => ok.has(r.su.id) && (!needle || `${r.su.firstName} ${r.su.lastName} ${r.su.externalReference || ''} ${r.su.suReference} ${r.roomNo}`.toLowerCase().includes(needle))).slice(0, 50);
  }, [directory, members, q]);
  return (
    <div className="space-y-2">
      <input className={inputCls} placeholder="Search Service Users by name, reference or room..." value={q} onChange={e => setQ(e.target.value)} aria-label="Search Service Users" />
      <div className="max-h-52 overflow-y-auto border border-neutral-200 rounded-xs divide-y divide-neutral-200">
        {available.length === 0 && <p className="p-3 text-neutral-500">No available Service Users match. People already in a family group are not listed.</p>}
        {available.map(r => {
          const on = r.su.id in chosen;
          return (
            <div key={r.su.id} className="p-2 flex items-center gap-2">
              <input type="checkbox" checked={on} aria-label={`Select ${r.su.firstName} ${r.su.lastName}`} onChange={e => { const next = { ...chosen }; if (e.target.checked) next[r.su.id] = ''; else delete next[r.su.id]; setChosen(next); }} />
              <div className="flex-1">{r.su.firstName} {r.su.lastName}<div className="text-[10px] text-neutral-500">{r.su.externalReference || r.su.suReference}{r.roomNo ? ` · Room ${r.roomNo}` : ''}</div></div>
              {on && <select className={`${inputCls} w-36`} value={chosen[r.su.id]} onChange={e => setChosen({ ...chosen, [r.su.id]: e.target.value })} aria-label="Relationship"><option value="">Relationship...</option>{FAMILY_RELATIONSHIPS.map(x => <option key={x} value={x}>{x}</option>)}</select>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CreateDialog: React.FC<{ directory: SuDirectoryRow[]; members: FamilyMember[]; user: string; onClose: () => void; onDone: () => void }> = ({ directory, members, user, onClose, onDone }) => {
  const [name, setName] = useState('');
  const [ref, setRef] = useState('');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const { busy, error, run } = useSubmit(onDone);
  return (
    <SuModal title="New family group" onClose={onClose} wide>
      <ErrorBanner message={error} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Family name"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder="e.g. The Ahmadi family" /></Field>
        <Field label="Family reference (optional)"><input className={inputCls} value={ref} onChange={e => setRef(e.target.value)} maxLength={60} /></Field>
      </div>
      <Field label="Members" hint="Choose existing Service Users. At least one member is needed to create the group here; more can be added later."><MemberPicker directory={directory} members={members} chosen={chosen} setChosen={setChosen} /></Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={busy || Object.keys(chosen).length === 0}
          onClick={() => run(async () => {
            const fam = await suEnhancementsService.createFamily({ displayName: name, familyRef: ref }, user);
            if (!fam.success) return fam;
            const failures: string[] = [];
            for (const [suId, rel] of Object.entries(chosen)) {
              const m = await suEnhancementsService.addFamilyMember(fam.data.id, suId, rel, user);
              if (!m.success) failures.push(m.error || 'a member could not be added');
            }
            if (failures.length) return { success: false, error: `The group was created but ${failures.length} member(s) were not added: ${failures[0]} Close this window and use Add member on the new group to finish. Do not create it again.` };
            return { success: true };
          })}>{busy ? 'Creating...' : 'Create group'}</button>
      </div>
    </SuModal>
  );
};

const AddMemberDialog: React.FC<{ family: FamilyGroup; directory: SuDirectoryRow[]; members: FamilyMember[]; user: string; onClose: () => void; onDone: () => void }> = ({ family, directory, members, user, onClose, onDone }) => {
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const { busy, error, run } = useSubmit(onDone);
  return (
    <SuModal title={`Add members to ${family.displayName || family.familyRef}`} onClose={onClose} wide>
      <ErrorBanner message={error} />
      <MemberPicker directory={directory} members={members} chosen={chosen} setChosen={setChosen} />
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={busy || Object.keys(chosen).length === 0}
          onClick={() => run(async () => {
            for (const [suId, rel] of Object.entries(chosen)) {
              if (activeFamilyOf(members, suId)) return { success: false, error: 'One of the selected Service Users is already in a family group.' };
              const m = await suEnhancementsService.addFamilyMember(family.id, suId, rel, user);
              if (!m.success) return m;
            }
            return { success: true };
          })}>{busy ? 'Adding...' : 'Add selected'}</button>
      </div>
    </SuModal>
  );
};

const RemoveDialog: React.FC<{ member: FamilyMember; name: string; user: string; onClose: () => void; onDone: () => void }> = ({ member, name, user, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  return (
    <SuModal title="Remove from family group" onClose={onClose}>
      <ErrorBanner message={error} />
      <Notice tone="warn">This ends the link between {name} and the family only. Their Service User record and all their tracking history are kept.</Notice>
      <Field label="Reason" required><textarea className={inputCls} rows={2} value={reason} onChange={e => setReason(e.target.value)} autoFocus /></Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={dangerBtn} disabled={busy} onClick={() => run(() => suEnhancementsService.removeFamilyMember(member, reason, user))}>{busy ? 'Removing...' : 'Remove from family'}</button>
      </div>
    </SuModal>
  );
};

const RelationshipDialog: React.FC<{ member: FamilyMember; user: string; onClose: () => void; onDone: () => void }> = ({ member, user, onClose, onDone }) => {
  const [rel, setRel] = useState(member.relationship || '');
  const { busy, error, run } = useSubmit(onDone);
  return (
    <SuModal title="Update relationship" onClose={onClose}>
      <ErrorBanner message={error} />
      <Field label="Relationship to the family"><select className={inputCls} value={rel} onChange={e => setRel(e.target.value)}><option value="">Not recorded</option>{FAMILY_RELATIONSHIPS.map(x => <option key={x} value={x}>{x}</option>)}</select></Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={busy} onClick={() => run(() => suEnhancementsService.updateFamilyRelationship(member, rel, user))}>{busy ? 'Saving...' : 'Save'}</button>
      </div>
    </SuModal>
  );
};

/** Family on an individual's profile: who they are grouped with, linking through to each member. */
export const SuFamilyPanel: React.FC<{ suId: string; onOpenProfile?: (suId: string) => void }> = ({ suId, onOpenProfile }) => {
  const actor = useSuActor();
  const [state, setState] = useState<null | { family: FamilyGroup; others: Array<{ member: FamilyMember; name: string }> } | 'none'>(null);
  useEffect(() => {
    if (!actor.canEdit) return;
    let alive = true;
    (async () => {
      const mine = await suEnhancementsService.listFamilyMembers({ suId });
      const link = mine.success ? activeFamilyOf(mine.data, suId) : null;
      if (!link) { if (alive) setState('none'); return; }
      const [fams, all, dir] = await Promise.all([suEnhancementsService.listFamilies(), suEnhancementsService.listFamilyMembers({ familyId: link.familyId }), suTrackerService.loadSuDirectory([])]);
      const family = fams.success ? fams.data.find(f => f.id === link.familyId) : null;
      if (!family || !alive) { if (alive) setState('none'); return; }
      const names = new Map((dir.success ? dir.data : []).map(r => [r.su.id, `${r.su.firstName} ${r.su.lastName}`] as [string, string]));
      setState({ family, others: all.success ? all.data.filter(m => m.status === 'Active' && m.suId !== suId).map(m => ({ member: m, name: names.get(m.suId) || 'Service User' })) : [] });
    })();
    return () => { alive = false; };
  }, [suId, actor.canEdit]);
  if (!actor.canEdit || state === null) return null;
  if (state === 'none') return <div className="border border-neutral-200 rounded-lg p-3 bg-white text-xs flex items-center gap-2"><Users className="w-4 h-4 text-neutral-500" /><span className="font-bold text-neutral-800">Family group</span><span className="text-neutral-500">Not part of a family group</span></div>;
  return (
    <div className="border border-neutral-200 rounded-lg p-3 bg-white text-xs space-y-1.5">
      <div className="flex items-center gap-2"><Users className="w-4 h-4 text-teal-700" /><span className="font-bold text-neutral-800">Family group: {state.family.displayName || state.family.familyRef}</span></div>
      {state.others.length === 0 ? <p className="text-neutral-500">No other active members.</p> : (
        <ul className="flex flex-wrap gap-2">{state.others.map(o => (
          <li key={o.member.id}>
            {onOpenProfile ? <button type="button" className="text-teal-700 underline cursor-pointer" onClick={() => onOpenProfile(o.member.suId)}>{o.name}</button> : o.name}
            {o.member.relationship && <span className="text-neutral-500"> ({o.member.relationship})</span>}
          </li>
        ))}</ul>
      )}
    </div>
  );
};
