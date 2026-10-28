import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, History, CreditCard } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { suTrackerService, type SuDirectoryRow } from '../../services/suTrackerService';
import { suPropertyService } from '../../services/suPropertyService';
import { suEnhancementsService, type OysterCard, type OysterTransaction, type OysterCardEvent } from '../../services/suEnhancementsService';
import {
  OYSTER_CARD_STATUSES, OYSTER_MANUAL_STATUSES, OYSTER_CONDITIONS, availableCardsFor, oysterUsage, summariseUsage, filterOysterTransactions, formatMoney
} from '../../utils/oysterLogic';
import { todayIso } from '../../utils/attendanceLogic';
import { SiteFilterSelect, TrackerExport, RefreshButton, ResetFiltersButton, type TrackerExportColumn } from '../common/TrackerToolbar';
import {
  TrackerHeader, PrimaryButton, TablePanel, SortableTh, ActionsTh, actionsTdCls, EmptyRow, SkeletonRows, theadRowCls, tbodyCls, tdCls
} from '../common/TrackerLayout';
import { useTableControls, usePaged, SearchBox, filterSelectCls } from '../su/tableControls';
import { Field, ErrorBanner, Notice, StatusPill, SuModal, inputCls, primaryBtn, secondaryBtn, dangerBtn, useSuActor, fmtDate, fmtDateTime } from '../su/suUi';

const cardTone = (s: string) => (s === 'Available' ? 'good' : s === 'Issued' ? 'warn' : s === 'Lost' || s === 'Damaged' ? 'bad' : 'neutral') as 'good' | 'warn' | 'bad' | 'neutral';
const txnTone = (s: string) => (s === 'Returned' ? 'good' : s === 'Issued' ? 'warn' : 'bad') as 'good' | 'warn' | 'bad';

/** Runs an async save once at a time and reports its error inside the dialog. */
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
  return { busy, error, run, setError };
}

/** Name and reference for every Service User, archived and discharged included, so history never shows a bare id. */
export function useSuNames() {
  const [names, setNames] = useState<Map<string, { name: string; ref: string }>>(new Map());
  useEffect(() => {
    let alive = true;
    suPropertyService.getServiceUsers(undefined, { includeArchived: true }).then(res => {
      if (!alive || !res.success) return;
      setNames(new Map(res.data.map(u => [u.id, { name: `${u.firstName} ${u.lastName}`, ref: u.externalReference || u.suReference }] as [string, { name: string; ref: string }])));
    });
    return () => { alive = false; };
  }, []);
  return names;
}

/* ====================================================================================== Oyster Cards page */
type Dialog =
  | { kind: 'register' } | { kind: 'edit'; card: OysterCard } | { kind: 'balance'; card: OysterCard }
  | { kind: 'issue'; card: OysterCard } | { kind: 'return'; txn: OysterTransaction } | { kind: 'history'; card: OysterCard };

/** Oyster cards held by each property: register them, keep their balances, issue them and take them back. */
export const OysterCardsSection: React.FC<{ tabSwitcher?: React.ReactNode }> = ({ tabSwitcher }) => {
  const { sites, isSitePermitted, defaultSiteFilter } = useApp();
  const actor = useSuActor();
  const names = useSuNames();
  const [cards, setCards] = useState<OysterCard[]>([]);
  const [txns, setTxns] = useState<OysterTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'zero' | 'low'>('all');
  // Follows the property chosen in the top bar (and the user's permitted properties)
  const [siteFilter, setSiteFilter] = useState<string>(defaultSiteFilter);
  useEffect(() => { setSiteFilter(defaultSiteFilter); }, [defaultSiteFilter]);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const [c, t] = await Promise.all([suEnhancementsService.listOysterCards(), suEnhancementsService.listOysterTransactions()]);
    setLoading(false);
    if (!c.success) { setError(c.error || 'Could not load Oyster cards.'); return; }
    if (!t.success) { setError(t.error || 'Could not load card usage records.'); return; }
    setCards(c.data); setTxns(t.data);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const holderName = (c: OysterCard) => (c.suId ? names.get(c.suId)?.name || '' : '');
  const tc = useTableControls<OysterCard>('cardRef', {
    cardRef: c => c.cardRef, site: c => c.siteName, status: c => c.status, balance: c => Number(c.currentBalance ?? -1), holder: c => holderName(c)
  });

  const openLoan = useMemo(() => new Map(txns.filter(t => t.status === 'Issued').map(t => [t.cardId, t] as [string, OysterTransaction])), [txns]);
  const permitted = useMemo(() => cards.filter(c => isSitePermitted(c.siteName, 'all')), [cards, isSitePermitted]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return permitted.filter(c => {
      if (!isSitePermitted(c.siteName, siteFilter)) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      const bal = Number(c.currentBalance ?? 0);
      if (balanceFilter === 'zero' && bal !== 0) return false;
      if (balanceFilter === 'low' && !(bal > 0 && bal < LOW_BALANCE)) return false;
      if (!q) return true;
      const holder = c.suId ? `${names.get(c.suId)?.name || ''} ${names.get(c.suId)?.ref || ''}` : '';
      return `${c.cardRef} ${holder} ${c.siteName}`.toLowerCase().includes(q);
    });
  }, [permitted, names, search, statusFilter, balanceFilter, siteFilter, isSitePermitted]);
  const sorted = tc.sortRows(filtered);
  const paged = usePaged(sorted, tc.page, tc.pageSize);

  const counts = useMemo(() => {
    const scoped = permitted.filter(c => isSitePermitted(c.siteName, siteFilter));
    return { total: scoped.length, available: scoped.filter(c => c.status === 'Available').length, issued: scoped.filter(c => c.status === 'Issued').length };
  }, [permitted, siteFilter, isSitePermitted]);

  const filtersActive = !!search || statusFilter !== 'all' || balanceFilter !== 'all' || siteFilter !== defaultSiteFilter;
  const resetFilters = () => { setSearch(''); setStatusFilter('all'); setBalanceFilter('all'); setSiteFilter(defaultSiteFilter); tc.resetPage(); };
  const done = async (msg: string) => { setDialog(null); setMessage(msg); await load(); };

  const exportCols: TrackerExportColumn<OysterCard>[] = [
    { id: 'cardRef', label: 'Card reference', get: c => c.cardRef },
    { id: 'site', label: 'Property', get: c => c.siteName },
    { id: 'status', label: 'Status', get: c => c.status },
    { id: 'balance', label: 'Current balance', get: c => (c.currentBalance == null ? '' : Number(c.currentBalance).toFixed(2)) },
    { id: 'updated', label: 'Balance updated', get: c => fmtDate(c.balanceUpdatedAt) },
    { id: 'updatedBy', label: 'Balance updated by', get: c => c.balanceUpdatedBy },
    { id: 'holder', label: 'Held by', get: c => holderName(c) },
    { id: 'issued', label: 'Issued on', get: c => fmtDate(c.issuedDate) },
    { id: 'notes', label: 'Notes', get: c => c.notes }
  ];

  const th = (key: string, label: string) => <SortableTh key={key} label={label} active={tc.sortKey === key} asc={tc.asc} onSort={() => tc.sortBy(key)} />;

  return (
    <div className="space-y-4">
      <TrackerHeader
        icon={<CreditCard className="w-5 h-5" />}
        title="Oyster Cards"
        tabs={tabSwitcher}
        countLabel={loading || error ? undefined : `${filtered.length} Cards`}
        description="Cards held by each property: registered, topped up by hand, issued to a Service User and returned. Balances are recorded by staff, not checked with Transport for London."
        actions={
          <>
            <RefreshButton onClick={load} loading={loading} />
            <TrackerExport<OysterCard> moduleName="Oyster Cards" filename="Oyster_Cards" title="Oyster Cards" allRows={permitted} filteredRows={filtered} columns={exportCols} dateOf={c => c.balanceUpdatedAt || c.updatedAt || ''} />
            {actor.canEdit && <PrimaryButton onClick={() => { setMessage(''); setDialog({ kind: 'register' }); }} label="+ Register Card" />}
          </>
        }
        summary={<div className="flex items-center gap-1.5 text-xs mt-3"><StatusPill status={`${counts.available} available`} tone="good" /><StatusPill status={`${counts.issued} issued`} tone="warn" /><StatusPill status={`${counts.total} in this view`} /></div>}
        notice={message ? <div className="mt-3"><Notice tone="ok">{message}</Notice></div> : undefined}
        filtersClassName="flex flex-wrap lg:flex-nowrap items-center gap-2"
        filters={
          <>
            <SearchBox value={search} onChange={v => { setSearch(v); tc.resetPage(); }} placeholder="Search card, holder or property..." />
            <SiteFilterSelect value={siteFilter} onChange={v => { setSiteFilter(v); tc.resetPage(); }} />
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); tc.resetPage(); }} className={filterSelectCls} aria-label="Card status">
              <option value="all">All Statuses</option>{OYSTER_CARD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={balanceFilter} onChange={e => { setBalanceFilter(e.target.value as 'all' | 'zero' | 'low'); tc.resetPage(); }} className={filterSelectCls} aria-label="Balance">
              <option value="all">Any balance</option><option value="low">{`Low (under £${LOW_BALANCE})`}</option><option value="zero">Empty (£0.00)</option>
            </select>
            <ResetFiltersButton onClick={resetFilters} active={filtersActive} />
          </>
        }
      />

      <TablePanel totalItems={filtered.length} page={tc.page} pageSize={tc.pageSize} onPage={tc.setPage} onPageSize={tc.setPageSize} error={error} onRetry={load} errorTitle="Could not load Oyster cards">
        <table className="w-full text-left text-xs border-collapse min-w-[900px]">
          <thead>
            <tr className={theadRowCls}>
              {th('cardRef', 'Card reference')}{th('site', 'Property')}{th('status', 'Status')}{th('balance', 'Current balance')}{th('holder', 'Held by')}
              <ActionsTh />
            </tr>
          </thead>
          <tbody className={tbodyCls}>
            {loading ? <SkeletonRows cols={6} /> : paged.length === 0 ? (
              <EmptyRow colSpan={6} icon={<CreditCard className="w-8 h-8" />}
                title={cards.length === 0 ? 'No Oyster cards registered' : 'No cards match your filters'}
                hint={cards.length === 0 && actor.canEdit ? "Click '+ Register Card' to add the cards this property holds." : undefined} />
            ) : paged.map(c => {
              const loan = openLoan.get(c.id);
              const holder = c.suId ? names.get(c.suId) : undefined;
              return (
                <tr key={c.id} className="hover:bg-[#f3f8fd] transition-colors align-top">
                  <td className={`${tdCls} font-mono font-semibold`}>{c.cardRef}</td>
                  <td className={tdCls}>{c.siteName}</td>
                  <td className={tdCls}><StatusPill status={c.status} tone={cardTone(c.status)} /></td>
                  <td className={tdCls}>{formatMoney(c.currentBalance)}{c.balanceUpdatedAt && <div className="text-[10px] text-neutral-500">updated {fmtDate(c.balanceUpdatedAt)}{c.balanceUpdatedBy ? ` by ${c.balanceUpdatedBy}` : ''}</div>}</td>
                  <td className={tdCls}>{c.status === 'Issued' ? <>{holder?.name || 'Service User'}<div className="text-[10px] text-neutral-500">{holder?.ref} · since {fmtDate(c.issuedDate)}</div></> : <span className="text-neutral-400">—</span>}</td>
                  <td className={actionsTdCls}>
                    <div className="flex gap-1.5 justify-end flex-wrap">
                      <button type="button" className={secondaryBtn} onClick={() => setDialog({ kind: 'history', card: c })}><History className="w-3 h-3 inline mr-1" />History</button>
                      {actor.canEdit && c.status !== 'Deactivated' && <button type="button" className={secondaryBtn} onClick={() => { setMessage(''); setDialog({ kind: 'balance', card: c }); }}>Update balance</button>}
                      {actor.canEdit && c.status === 'Available' && <button type="button" className={primaryBtn} onClick={() => { setMessage(''); setDialog({ kind: 'issue', card: c }); }}>Issue to SU</button>}
                      {actor.canEdit && loan && <button type="button" className={primaryBtn} onClick={() => { setMessage(''); setDialog({ kind: 'return', txn: loan }); }}>Return card</button>}
                      {actor.canEdit && c.status !== 'Issued' && c.status !== 'Deactivated' && <button type="button" className={secondaryBtn} onClick={() => { setMessage(''); setDialog({ kind: 'edit', card: c }); }}>Edit</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TablePanel>

      {dialog?.kind === 'register' && <RegisterDialog sites={sites.map((s: any) => s.name)} defaultSite={siteFilter !== 'all' ? siteFilter : ''} user={actor.name} onClose={() => setDialog(null)} onDone={() => done('Oyster card registered.')} />}
      {dialog?.kind === 'edit' && <EditDialog card={dialog.card} sites={sites.map((s: any) => s.name)} user={actor.name} onClose={() => setDialog(null)} onDone={() => done('Card updated.')} />}
      {dialog?.kind === 'balance' && <BalanceDialog card={dialog.card} onClose={() => setDialog(null)} onDone={() => done('Balance recorded.')} />}
      {dialog?.kind === 'issue' && <OysterIssueDialog cards={cards} lockedCardId={dialog.card.id} siteName={dialog.card.siteName} onClose={() => setDialog(null)} onDone={() => done('Card issued.')} />}
      {dialog?.kind === 'return' && <OysterReturnDialog txn={dialog.txn} suName={names.get(dialog.txn.suId)?.name} onClose={() => setDialog(null)} onDone={() => done('Card return recorded.')} />}
      {dialog?.kind === 'history' && <CardHistoryDialog card={dialog.card} txns={txns.filter(t => t.cardId === dialog.card.id)} names={names} onClose={() => setDialog(null)} />}
    </div>
  );
};

/** Cards below this recorded balance are flagged "low" in the balance filter. */
const LOW_BALANCE = 3;

const RegisterDialog: React.FC<{ sites: string[]; defaultSite: string; user: string; onClose: () => void; onDone: () => void }> = ({ sites, defaultSite, user, onClose, onDone }) => {
  const { allowedSites, canAccessAllSites } = useApp();
  const options = canAccessAllSites() ? sites : (allowedSites || []);
  const [cardRef, setCardRef] = useState('');
  const [siteName, setSiteName] = useState(defaultSite || (options.length === 1 ? options[0] : ''));
  const [balance, setBalance] = useState('');
  const [notes, setNotes] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  return (
    <SuModal title="Register Oyster card" onClose={onClose}>
      <ErrorBanner message={error} />
      <Field label="Card reference number" required><input className={inputCls} value={cardRef} onChange={e => setCardRef(e.target.value)} maxLength={100} autoFocus /></Field>
      <Field label="Property holding the card" required hint="Every card belongs to one property. Only that property can issue it.">
        <select className={inputCls} value={siteName} onChange={e => setSiteName(e.target.value)}><option value="">Select property...</option>{options.map(s => <option key={s} value={s}>{s}</option>)}</select>
      </Field>
      <Field label="Current balance (£)" required><input className={inputCls} inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value)} /></Field>
      <Field label="Notes"><textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={busy} onClick={() => run(() => suEnhancementsService.registerOysterCard({ cardRef, siteName, balance, notes }, user))}>{busy ? 'Saving...' : 'Register card'}</button>
      </div>
    </SuModal>
  );
};

const EditDialog: React.FC<{ card: OysterCard; sites: string[]; user: string; onClose: () => void; onDone: () => void }> = ({ card, sites, user, onClose, onDone }) => {
  const { allowedSites, canAccessAllSites } = useApp();
  const options = canAccessAllSites() ? sites : (allowedSites || []);
  const [cardRef, setCardRef] = useState(card.cardRef);
  const [siteName, setSiteName] = useState(card.siteName);
  const [status, setStatus] = useState(card.status);
  const [notes, setNotes] = useState(card.notes || '');
  const { busy, error, run } = useSubmit(onDone);
  return (
    <SuModal title={`Edit card ${card.cardRef}`} onClose={onClose}>
      <ErrorBanner message={error} />
      <Field label="Card reference number" required><input className={inputCls} value={cardRef} onChange={e => setCardRef(e.target.value)} maxLength={100} /></Field>
      <Field label="Property" required><select className={inputCls} value={siteName} onChange={e => setSiteName(e.target.value)}>{Array.from(new Set([card.siteName, ...options])).map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
      <Field label="Status" hint="Cards are issued and returned from the Issue and Return buttons, not from here.">
        <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>{OYSTER_MANUAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
      </Field>
      <Field label="Notes"><textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={busy || !cardRef.trim()} onClick={() => run(() => suEnhancementsService.updateOysterCard(card, { cardRef: cardRef.trim(), siteName, status, notes }, user))}>{busy ? 'Saving...' : 'Save'}</button>
      </div>
    </SuModal>
  );
};

const BalanceDialog: React.FC<{ card: OysterCard; onClose: () => void; onDone: () => void }> = ({ card, onClose, onDone }) => {
  const [balance, setBalance] = useState(card.currentBalance == null ? '' : String(card.currentBalance));
  const [note, setNote] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  const out = card.status === 'Issued';
  return (
    <SuModal title={`Update balance: ${card.cardRef}`} onClose={onClose}>
      <ErrorBanner message={error} />
      {out && <Notice tone="warn">This card is out with a Service User. A balance change now is marked on the usage record, and no "amount used" is worked out for it afterwards.</Notice>}
      <Field label="Balance now on the card (£)" required><input className={inputCls} inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value)} autoFocus /></Field>
      <Field label={out ? 'Why did it change? (for example a top-up)' : 'Note (optional)'} required={out}><textarea className={inputCls} rows={2} value={note} onChange={e => setNote(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={busy} onClick={() => run(() => suEnhancementsService.setOysterBalance(card, balance, note))}>{busy ? 'Saving...' : 'Save balance'}</button>
      </div>
    </SuModal>
  );
};

/**
 * Issue an available card to a Service User. Used from the Oyster Cards page (card chosen) and from a funding request
 * (cards of the request's property offered). The server and database allow only an available card of the right property.
 */
export const OysterIssueDialog: React.FC<{
  cards: OysterCard[]; siteName: string; lockedCardId?: string; preferredCardId?: string; fundingRequestId?: string; suHint?: string;
  onClose: () => void; onDone: () => void;
}> = ({ cards, siteName, lockedCardId, preferredCardId, fundingRequestId, suHint, onClose, onDone }) => {
  const { sites } = useApp();
  const available = useMemo(() => availableCardsFor(cards, siteName), [cards, siteName]);
  const [cardId, setCardId] = useState(lockedCardId || (preferredCardId && available.some(c => c.id === preferredCardId) ? preferredCardId : ''));
  const [directory, setDirectory] = useState<SuDirectoryRow[]>([]);
  const [suId, setSuId] = useState('');
  const [suSearch, setSuSearch] = useState(suHint || '');
  const [balance, setBalance] = useState('');
  const [issuedDate, setIssuedDate] = useState(todayIso());
  const { busy, error, run } = useSubmit(onDone);

  useEffect(() => { suTrackerService.loadSuDirectory(sites.map((s: any) => ({ id: s.id, name: s.name }))).then(r => { if (r.success) setDirectory(r.data); }); }, [sites]);
  const card = cards.find(c => c.id === cardId);
  useEffect(() => { if (card?.currentBalance != null) setBalance(String(card.currentBalance)); }, [card?.id]);   // handover balance starts from the recorded one

  const matches = useMemo(() => {
    const q = suSearch.trim().toLowerCase();
    const list = directory.filter(r => !q || `${r.su.firstName} ${r.su.lastName} ${r.su.externalReference || ''} ${r.su.suReference} ${r.roomNo}`.toLowerCase().includes(q));
    // people at this property first
    return list.sort((a, b) => Number(b.siteName.toLowerCase() === siteName.toLowerCase()) - Number(a.siteName.toLowerCase() === siteName.toLowerCase())).slice(0, 100);
  }, [directory, suSearch, siteName]);

  return (
    <SuModal title={`Issue Oyster card · ${siteName}`} onClose={onClose}>
      <ErrorBanner message={error} />
      {available.length === 0 && !lockedCardId && <Notice tone="warn">No Oyster cards are available at {siteName}. Register a card for this property, or wait for one to be returned.</Notice>}
      <Field label="Card" required>
        {lockedCardId ? <div className="px-2.5 py-1.5 bg-neutral-100 border border-[#e5e5e5] rounded-xs font-mono">{card?.cardRef}</div> : (
          <select className={inputCls} value={cardId} onChange={e => setCardId(e.target.value)}>
            <option value="">Select an available card...</option>
            {available.map(c => <option key={c.id} value={c.id}>{c.cardRef} · balance {formatMoney(c.currentBalance)}</option>)}
          </select>
        )}
      </Field>
      <Field label="Service User" required>
        <input className={`${inputCls} mb-1.5`} placeholder="Search by name, reference or room..." value={suSearch} onChange={e => setSuSearch(e.target.value)} aria-label="Search Service Users" />
        <select className={inputCls} size={5} value={suId} onChange={e => setSuId(e.target.value)} aria-label="Service User">
          {matches.map(r => <option key={r.su.id} value={r.su.id}>{r.su.firstName} {r.su.lastName} · {r.su.externalReference || r.su.suReference}{r.roomNo ? ` · Room ${r.roomNo}` : ''}{r.siteName && r.siteName.toLowerCase() !== siteName.toLowerCase() ? ` · ${r.siteName}` : ''}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Balance at handover (£)" required hint="Check the card and enter what it shows."><input className={inputCls} inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value)} /></Field>
        <Field label="Date issued"><input type="date" className={inputCls} value={issuedDate} max={todayIso()} onChange={e => setIssuedDate(e.target.value)} /></Field>
      </div>
      {fundingRequestId && <Notice>This issue is linked to the funding request and moves it to Issued.</Notice>}
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={busy || !cardId || !suId}
          onClick={() => run(() => suEnhancementsService.issueOysterCard({ cardId, suId, fundingRequestId, balance, issuedDate }))}>{busy ? 'Issuing...' : 'Issue card'}</button>
      </div>
    </SuModal>
  );
};

/** Take a card back. The actual remaining balance is required; a card in good condition returns to the property's stock. */
export const OysterReturnDialog: React.FC<{ txn: OysterTransaction; suName?: string; onClose: () => void; onDone: () => void }> = ({ txn, suName, onClose, onDone }) => {
  const [condition, setCondition] = useState<string>('Good');
  const [balance, setBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [returnedDate, setReturnedDate] = useState(todayIso());
  const { busy, error, run } = useSubmit(onDone);
  return (
    <SuModal title={`Return card ${txn.cardRef}`} onClose={onClose}>
      <ErrorBanner message={error} />
      <p className="text-neutral-600">Issued to {suName || 'Service User'} on {fmtDate(txn.issuedDate)} with {formatMoney(txn.balanceAtIssue)} on the card.</p>
      <Field label="Condition of the card" required>
        <select className={inputCls} value={condition} onChange={e => setCondition(e.target.value)}>
          {OYSTER_CONDITIONS.map(c => <option key={c} value={c}>{c === 'Good' ? 'Good: can be used again' : c === 'Damaged' ? 'Damaged: not reusable' : 'Lost: not returned'}</option>)}
        </select>
      </Field>
      {condition !== 'Lost' && <Field label="Actual remaining balance on the card (£)" required><input className={inputCls} inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value)} autoFocus /></Field>}
      {condition !== 'Lost' && <Field label="Date returned"><input type="date" className={inputCls} value={returnedDate} min={txn.issuedDate} max={todayIso()} onChange={e => setReturnedDate(e.target.value)} /></Field>}
      <Field label={condition === 'Good' ? 'Notes (optional)' : 'What happened'} required={condition !== 'Good'}><textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      {condition === 'Good' && <Notice>The card goes back into stock at {txn.siteName} with the balance you enter.</Notice>}
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={condition === 'Good' ? primaryBtn : dangerBtn} disabled={busy}
          onClick={() => run(() => suEnhancementsService.returnOysterCard(txn, { condition, balance, notes, returnedDate: condition === 'Lost' ? undefined : returnedDate }))}>{busy ? 'Saving...' : condition === 'Lost' ? 'Write off card' : 'Record return'}</button>
      </div>
    </SuModal>
  );
};

const CardHistoryDialog: React.FC<{ card: OysterCard; txns: OysterTransaction[]; names: Map<string, { name: string; ref: string }>; onClose: () => void }> = ({ card, txns, names, onClose }) => {
  const [events, setEvents] = useState<OysterCardEvent[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { suEnhancementsService.listOysterEvents(card.id).then(r => { if (r.success) setEvents(r.data); else { setError(r.error || 'Could not load history.'); setEvents([]); } }); }, [card.id]);
  return (
    <SuModal title={`Card history: ${card.cardRef}`} onClose={onClose} wide>
      <ErrorBanner message={error} />
      <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-neutral-500" /><span className="font-mono">{card.cardRef}</span><span>{card.siteName}</span><StatusPill status={card.status} tone={cardTone(card.status)} /><span className="ml-auto">{formatMoney(card.currentBalance)}</span></div>
      <div>
        <h4 className="font-bold text-neutral-700 mb-1">Usage &amp; Handover History</h4>
        {txns.length === 0 ? <p className="text-neutral-500">This card has not been issued yet.</p> : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-xs">
            {txns.map(t => {
              const u = oysterUsage(t);
              return (
                <li key={t.id} className="p-2 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="font-semibold">{names.get(t.suId)?.name || 'Service User'}</span><StatusPill status={t.status} tone={txnTone(t.status)} />
                  <span>{fmtDate(t.issuedDate)} → {t.returnedDate ? fmtDate(t.returnedDate) : 'still out'}</span>
                  <span>{formatMoney(t.balanceAtIssue)} → {t.status === 'Issued' ? '—' : formatMoney(t.balanceAtReturn)}</span>
                  <span className="text-neutral-500">{u.calculable ? `balance difference ${formatMoney(u.amount)}` : u.reason}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div>
        <h4 className="font-bold text-neutral-700 mb-1">Balance and status history</h4>
        {events === null ? <p className="text-neutral-500">Loading...</p> : events.length === 0 ? <p className="text-neutral-500">Nothing recorded.</p> : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-xs">
            {events.map(e => (
              <li key={e.id} className="p-2 flex flex-wrap gap-x-3">
                <span className="font-semibold">{e.eventType}</span>
                {e.fromStatus !== e.toStatus && e.toStatus && <span>{e.fromStatus ? `${e.fromStatus} → ` : ''}{e.toStatus}</span>}
                {e.balance != null && <span>{e.previousBalance != null ? `${formatMoney(e.previousBalance)} → ` : ''}{formatMoney(e.balance)}</span>}
                {e.details && <span className="text-neutral-600">{e.details}</span>}
                <span className="ml-auto text-neutral-500">{e.changedBy} · {fmtDateTime(e.changedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SuModal>
  );
};

/* ==================================================================================== usage tables */
const UsageCell: React.FC<{ t: OysterTransaction }> = ({ t }) => {
  const u = oysterUsage(t);
  return u.calculable
    ? <span title="Difference between the recorded balances. It is not confirmed spending.">{formatMoney(u.amount)}</span>
    : <span className="text-neutral-500 text-[11px]" title={u.reason}>Not calculable<span className="block text-[10px]">{u.reason}</span></span>;
};

/** Oyster card use for one Service User, shown on their profile. */
export const SuOysterUsage: React.FC<{ suId: string; suName: string }> = ({ suId, suName }) => {
  const { transportFundingRequests } = useApp();
  const actor = useSuActor();
  const [txns, setTxns] = useState<OysterTransaction[] | null>(null);
  const [error, setError] = useState('');
  const [returning, setReturning] = useState<OysterTransaction | null>(null);
  const load = useCallback(async () => {
    const res = await suEnhancementsService.listOysterTransactions({ suId });
    if (res.success) setTxns(res.data); else { setError(res.error || 'Could not load Oyster card use.'); setTxns([]); }
  }, [suId]);
  useEffect(() => { if (actor.canEdit) void load(); }, [load, actor.canEdit]);
  if (!actor.canEdit || txns === null) return null;
  const requestOf = (id?: string | null) => transportFundingRequests.find(r => r.id === id);
  return (
    <div className="border border-neutral-200 rounded-lg p-3 bg-white text-xs space-y-2">
      <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-neutral-500" /><span className="font-bold text-neutral-800">Funding usage: Oyster cards</span></div>
      <ErrorBanner message={error} />
      {txns.length === 0 ? <p className="text-neutral-500">No Oyster card has been issued to this Service User.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-bold text-neutral-500 uppercase"><tr>{['Card', 'Property', 'Issued', 'Returned', 'At handover', 'At return', 'Balance difference', 'Funding request', 'Status', ''].map(h => <th key={h} className="p-1.5 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-neutral-200">
              {txns.map(t => {
                const req = requestOf(t.fundingRequestId);
                return (
                  <tr key={t.id} className="align-top">
                    <td className="p-1.5 font-mono">{t.cardRef}</td><td className="p-1.5">{t.siteName}</td><td className="p-1.5">{fmtDate(t.issuedDate)}</td>
                    <td className="p-1.5">{t.returnedDate ? fmtDate(t.returnedDate) : '—'}</td><td className="p-1.5">{formatMoney(t.balanceAtIssue)}</td>
                    <td className="p-1.5">{t.status === 'Issued' ? '—' : formatMoney(t.balanceAtReturn)}</td><td className="p-1.5"><UsageCell t={t} /></td>
                    <td className="p-1.5">{t.fundingRequestId ? (req ? <>{req.mainAppRef}<div className="text-[10px] text-neutral-500">{req.status}</div></> : <span className="text-neutral-500">Linked</span>) : <span className="text-neutral-400">None</span>}</td>
                    <td className="p-1.5"><StatusPill status={t.status} tone={txnTone(t.status)} /></td>
                    <td className="p-1.5">{t.status === 'Issued' && <button type="button" className={secondaryBtn} onClick={() => setReturning(t)}>Return card</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-neutral-500">The balance difference is shown only when both balances are recorded and nothing changed the balance while the card was out. It is not treated as confirmed spending.</p>
      {returning && <OysterReturnDialog txn={returning} suName={suName} onClose={() => setReturning(null)} onDone={async () => { setReturning(null); await load(); }} />}
    </div>
  );
};

/** Oyster card usage records on the Funding page, with search, filters, sorting, paging and export. */
export const OysterUsageView: React.FC<{ tabs?: React.ReactNode }> = ({ tabs }) => {
  const { isSitePermitted, defaultSiteFilter, transportFundingRequests } = useApp();
  const names = useSuNames();
  const [txns, setTxns] = useState<OysterTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [site, setSite] = useState<string>(defaultSiteFilter);
  useEffect(() => { setSite(defaultSiteFilter); }, [defaultSiteFilter]);
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('all');
  const [calc, setCalc] = useState<'all' | 'yes' | 'no'>('all');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const r = await suEnhancementsService.listOysterTransactions();
    setLoading(false);
    if (r.success) setTxns(r.data); else setError(r.error || 'Could not load Oyster card use.');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const suText = useCallback((id: string) => `${names.get(id)?.name || ''} ${names.get(id)?.ref || ''}`, [names]);
  const requestOf = useCallback((id?: string | null) => transportFundingRequests.find(r => r.id === id), [transportFundingRequests]);
  const permitted = useMemo(() => txns.filter(t => isSitePermitted(t.siteName, 'all')), [txns, isSitePermitted]);
  const filtered = useMemo(() => {
    const base = filterOysterTransactions(permitted, { site, query, from, to, status }, suText);
    return calc === 'all' ? base : base.filter(t => (t.status !== 'Issued' && oysterUsage(t).calculable) === (calc === 'yes'));
  }, [permitted, site, query, from, to, status, calc, suText]);
  const tc = useTableControls<OysterTransaction>('issued', {
    su: t => names.get(t.suId)?.name || '', site: t => t.siteName, card: t => t.cardRef, issued: t => t.issuedDate, returned: t => t.returnedDate || '',
    start: t => Number(t.balanceAtIssue), end: t => Number(t.balanceAtReturn ?? -1), diff: t => { const u = oysterUsage(t); return u.calculable ? u.amount || 0 : -1; },
    request: t => requestOf(t.fundingRequestId)?.mainAppRef || '', status: t => t.status
  });
  const sorted = tc.sortRows(filtered);
  const paged = usePaged(sorted, tc.page, tc.pageSize);
  const totals = useMemo(() => summariseUsage(filtered), [filtered]);

  const filtersActive = !!query || !!from || !!to || status !== 'all' || calc !== 'all' || site !== defaultSiteFilter;
  const resetFilters = () => { setQuery(''); setFrom(''); setTo(''); setStatus('all'); setCalc('all'); setSite(defaultSiteFilter); tc.resetPage(); };

  const diffText = (t: OysterTransaction) => { const u = oysterUsage(t); return u.calculable ? Number(u.amount).toFixed(2) : `Not calculable: ${u.reason}`; };
  const exportCols: TrackerExportColumn<OysterTransaction>[] = [
    { id: 'su', label: 'Service User', get: t => names.get(t.suId)?.name },
    { id: 'suRef', label: 'Service User reference', get: t => names.get(t.suId)?.ref },
    { id: 'site', label: 'Property', get: t => t.siteName },
    { id: 'card', label: 'Card reference', get: t => t.cardRef },
    { id: 'issued', label: 'Issued', get: t => fmtDate(t.issuedDate) },
    { id: 'issuedBy', label: 'Issued by', get: t => t.issuedBy },
    { id: 'returned', label: 'Returned', get: t => (t.returnedDate ? fmtDate(t.returnedDate) : '') },
    { id: 'start', label: 'Starting balance', get: t => Number(t.balanceAtIssue).toFixed(2) },
    { id: 'end', label: 'Ending balance', get: t => (t.status === 'Issued' || t.balanceAtReturn == null ? '' : Number(t.balanceAtReturn).toFixed(2)) },
    { id: 'diff', label: 'Balance difference', get: t => (t.status === 'Issued' ? '' : diffText(t)) },
    { id: 'condition', label: 'Condition on return', get: t => t.returnCondition },
    { id: 'request', label: 'Funding request', get: t => requestOf(t.fundingRequestId)?.mainAppRef },
    { id: 'requestStatus', label: 'Request status', get: t => requestOf(t.fundingRequestId)?.status },
    { id: 'status', label: 'Status', get: t => t.status }
  ];
  const th = (key: string, label: string) => <SortableTh key={key} label={label} active={tc.sortKey === key} asc={tc.asc} onSort={() => tc.sortBy(key)} />;

  return (
    <div className="space-y-4">
      <TrackerHeader
        icon={<CreditCard className="w-5 h-5" />}
        title="Oyster Card Usage"
        tabs={tabs}
        countLabel={loading || error ? undefined : `${filtered.length} Records`}
        description="Every Oyster card issued against funding, from handover to return. The balance difference is the gap between the two balances staff recorded; it is not confirmed spending."
        actions={
          <>
            <RefreshButton onClick={load} loading={loading} />
            <TrackerExport<OysterTransaction> moduleName="Oyster Card Usage" filename="Oyster_Card_Usage" title="Oyster Card Usage" allRows={permitted} filteredRows={filtered} columns={exportCols} dateOf={t => t.issuedDate} />
          </>
        }
        summary={
          <div className="flex items-center gap-1.5 flex-wrap text-xs mt-3">
            <StatusPill status={`${totals.open} out now`} tone="warn" />
            <StatusPill status={`${formatMoney(totals.balanceDifferenceTotal)} recorded balance difference (${totals.reliable} reliable)`} tone="good" />
            {totals.notCalculable > 0 && <StatusPill status={`${totals.notCalculable} not calculable`} />}
          </div>
        }
        filtersClassName="flex flex-wrap items-center gap-2"
        filters={
          <>
            <SearchBox value={query} onChange={v => { setQuery(v); tc.resetPage(); }} placeholder="Search Service User, reference or card..." />
            <SiteFilterSelect value={site} onChange={v => { setSite(v); tc.resetPage(); }} />
            <label className="text-[11px] text-neutral-600 flex items-center gap-1">Issued from <input type="date" className={`${filterSelectCls} w-auto`} value={from} onChange={e => { setFrom(e.target.value); tc.resetPage(); }} aria-label="Issued from" /></label>
            <label className="text-[11px] text-neutral-600 flex items-center gap-1">to <input type="date" className={`${filterSelectCls} w-auto`} value={to} onChange={e => { setTo(e.target.value); tc.resetPage(); }} aria-label="Issued to" /></label>
            <select value={status} onChange={e => { setStatus(e.target.value); tc.resetPage(); }} className={filterSelectCls} aria-label="Status">
              <option value="all">All Status</option><option value="Issued">Out now</option><option value="Returned">Returned</option><option value="Lost">Lost</option>
            </select>
            <select value={calc} onChange={e => { setCalc(e.target.value as 'all' | 'yes' | 'no'); tc.resetPage(); }} className={filterSelectCls} aria-label="Balance difference">
              <option value="all">Any balance difference</option><option value="yes">Calculable</option><option value="no">Not calculable</option>
            </select>
            <ResetFiltersButton onClick={resetFilters} active={filtersActive} />
          </>
        }
      />

      <TablePanel totalItems={filtered.length} page={tc.page} pageSize={tc.pageSize} onPage={tc.setPage} onPageSize={tc.setPageSize} error={error} onRetry={load} errorTitle="Could not load Oyster card use">
        <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
          <thead>
            <tr className={theadRowCls}>
              {th('su', 'Service User')}{th('site', 'Property')}{th('card', 'Card')}{th('issued', 'Issued')}{th('returned', 'Returned')}
              {th('start', 'Starting balance')}{th('end', 'Ending balance')}{th('diff', 'Balance difference')}{th('request', 'Funding request')}{th('status', 'Status')}
            </tr>
          </thead>
          <tbody className={tbodyCls}>
            {loading ? <SkeletonRows cols={10} /> : paged.length === 0 ? (
              <EmptyRow colSpan={10} icon={<CreditCard className="w-8 h-8" />} title={txns.length === 0 ? 'No Oyster cards have been issued yet' : 'No records match your filters'} />
            ) : paged.map(t => {
              const su = names.get(t.suId);
              const req = requestOf(t.fundingRequestId);
              return (
                <tr key={t.id} className="hover:bg-[#f3f8fd] transition-colors align-top">
                  <td className={tdCls}>{su?.name || 'Service User'}<div className="text-[10px] text-neutral-500">{su?.ref}</div></td>
                  <td className={tdCls}>{t.siteName}</td><td className={`${tdCls} font-mono`}>{t.cardRef}</td>
                  <td className={tdCls}>{fmtDate(t.issuedDate)}</td><td className={tdCls}>{t.returnedDate ? fmtDate(t.returnedDate) : '—'}</td>
                  <td className={tdCls}>{formatMoney(t.balanceAtIssue)}</td><td className={tdCls}>{t.status === 'Issued' ? '—' : formatMoney(t.balanceAtReturn)}</td>
                  <td className={tdCls}><UsageCell t={t} /></td>
                  <td className={tdCls}>{t.fundingRequestId ? (req ? <>{req.mainAppRef}<div className="text-[10px] text-neutral-500">{req.status}</div></> : 'Linked') : <span className="text-neutral-400">None</span>}</td>
                  <td className={tdCls}><StatusPill status={t.status} tone={txnTone(t.status)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TablePanel>
    </div>
  );
};
