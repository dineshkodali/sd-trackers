import React, { useEffect, useRef, useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { apiService, authHeaders, getApiUrl } from '../../services/apiService';
import { useApp } from '../../context/AppContext';
import type { TransportFundingRequestRecord } from '../../types';
import {
  FUNDING_STAGES, stageOf, availableFundingTransitions, validateFundingTransition, FINAL_FUNDING_STATUSES, type TransitionInput
} from '../../utils/fundingWorkflow';
import type { OysterCard, OysterTransaction } from '../../services/suEnhancementsService';
import { isOysterMethod, formatMoney } from '../../utils/oysterLogic';
import { OysterIssueDialog, OysterReturnDialog } from './OysterCardsSection';
import { Field, ErrorBanner, Notice, SuModal, inputCls, primaryBtn, secondaryBtn, dangerBtn, fmtDateTime, fmtDate } from '../su/suUi';

interface HistoryRow { id: string; fromStatus?: string | null; toStatus: string; note?: string | null; changedBy?: string; changedRole?: string; changedAt?: string }

const APPROVED_METHODS = ['Public Transport Travelcard', 'Oyster card (property stock)', 'Exceptional transport (taxi / private hire)', 'Other approved transport'];

/**
 * The six-stage workflow for one funding request: Draft, Submitted, Under review, Decision, Issued, Completed.
 * It shows where the request is, the history, and only the moves the signed-in user may make. The server and the
 * database re-check every move.
 */
export const FundingWorkflowModal: React.FC<{ item: TransportFundingRequestRecord; cards: OysterCard[]; txns: OysterTransaction[]; onClose: () => void; onChanged: () => void }> = ({ item, cards, txns, onClose, onChanged }) => {
  const { currentUserRole, authProfile } = useApp();
  const userId = (authProfile as any)?.id as string | undefined;
  const requestedById = (item as any).requestedById as string | undefined;
  // An Oyster request is issued by handing over a card, and completed by taking it back, so those moves go through the card dialogs
  const oyster = isOysterMethod(item.transportMethod);
  const loan = txns.find(t => t.fundingRequestId === item.id);
  const [oysterDialog, setOysterDialog] = useState<'issue' | 'return' | null>(null);
  const moves = availableFundingTransitions(item.status, currentUserRole as string, userId, requestedById)
    .filter(m => !(oyster && m.to === 'Completed' && loan?.status === 'Issued'));

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [chosen, setChosen] = useState<string>('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState(item.approvedTransportMethod || (isOysterMethod(item.transportMethod) ? APPROVED_METHODS[1] : item.transportMethod?.toLowerCase().includes('public') ? APPROVED_METHODS[0] : APPROVED_METHODS[2]));
  const [amount, setAmount] = useState(String(item.paymentAmount ?? item.totalCost ?? ''));
  const [reference, setReference] = useState('');
  const [completion, setCompletion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);

  const loadHistory = async () => {
    const res = await apiService.fetchEntityRecords<HistoryRow>('transportFundingHistory' as any, { eq: { request_id: item.id }, order: 'changed_at.asc', limit: 200 });
    if (res.success) setHistory(res.data);
  };
  useEffect(() => { void loadHistory(); }, [item.id, item.status]);

  const current = stageOf(item.status);
  const edge = moves.find(m => m.to === chosen);

  const submit = async () => {
    if (lock.current || !edge) return;
    const input: TransitionInput = { note, approvedTransportMethod: method, paymentAmount: amount, journeyUrn: reference, completionNotes: completion };
    const invalid = validateFundingTransition(item.status, edge.to, input);
    if (invalid) { setError(invalid); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const res = await fetch(getApiUrl(`/api/transport-funding/${encodeURIComponent(item.id)}/transition`), {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ to: edge.to, ...input })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) { setError(json?.error || `The change was not saved (HTTP ${res.status}).`); return; }
      onChanged();
      onClose();
    } catch (err: any) {
      setError(`Network error: ${err.message}`);
    } finally {
      lock.current = false; setBusy(false);
    }
  };

  const outcomeTag = item.status === 'Rejected' || item.status === 'Cancelled' || item.status === 'Clarification Required' ? item.status : '';

  return (
    <SuModal title={`Funding request: ${item.mainAppRef} (${item.mainAppInitials})`} onClose={onClose} wide>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="list" aria-label="Request stages">
        {FUNDING_STAGES.map((s, i) => {
          const done = current > s.n || (current === s.n && FINAL_FUNDING_STATUSES.includes(item.status) && item.status === 'Completed');
          const active = current === s.n && !done;
          return (
            <React.Fragment key={s.n}>
              <div role="listitem" aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs border text-[11px] font-semibold whitespace-nowrap ${done ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : active ? 'bg-[#f3e8ff] text-[#6b3fa0] border-[#d8b4fe]' : 'bg-neutral-50 text-neutral-400 border-neutral-200'}`}>
                {done ? <Check className="w-3 h-3" /> : <span>{s.n}</span>}{s.label}
              </div>
              {i < FUNDING_STAGES.length - 1 && <span className="text-neutral-300">›</span>}
            </React.Fragment>
          );
        })}
      </div>
      {outcomeTag && <Notice tone={item.status === 'Clarification Required' ? 'warn' : 'info'}>
        {item.status === 'Clarification Required' ? `More information is needed: ${item.rejectionReason || 'see the history below'}.`
          : item.status === 'Rejected' ? `Rejected: ${item.rejectionReason || 'see the history below'}.` : 'This request was cancelled.'}
      </Notice>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#faf9f8] rounded-xs border border-[#e1dfdd]">
        <div><span className="text-neutral-500 block text-[11px]">Site</span><span className="font-semibold">{item.siteName}</span></div>
        <div><span className="text-neutral-500 block text-[11px]">Appointment</span><span className="font-semibold">{item.appointmentDate || '—'}</span></div>
        <div><span className="text-neutral-500 block text-[11px]">Requested</span><span className="font-semibold">{item.transportMethod || '—'} · £{item.totalCost ?? '—'}</span></div>
        <div><span className="text-neutral-500 block text-[11px]">Travelcard / journey ref</span><span className="font-semibold font-mono">{item.journeyUrn || '—'}</span></div>
      </div>

      <ErrorBanner message={error} />

      {oyster && (
        <div className="p-3 border border-[#b3d6f2] bg-[#eef6ff] rounded-xs space-y-1.5">
          <div className="font-bold text-[#005a9e]">Oyster card</div>
          {loan ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Card <span className="font-mono font-semibold">{loan.cardRef}</span></span>
              <span>Issued {fmtDate(loan.issuedDate)} with {formatMoney(loan.balanceAtIssue)}</span>
              {loan.status === 'Issued' ? <span className="font-semibold text-amber-800">Out now</span>
                : <span>{loan.status === 'Returned' ? `Returned ${fmtDate(loan.returnedDate)} with ${formatMoney(loan.balanceAtReturn)}` : 'Lost'}</span>}
              {loan.status === 'Issued' && <button type="button" className={primaryBtn} onClick={() => setOysterDialog('return')}>Return card</button>}
            </div>
          ) : (
            <p className="text-neutral-700">{cards.find(c => c.id === item.oysterCardId) ? `Card chosen on the form: ${cards.find(c => c.id === item.oysterCardId)!.cardRef}. ` : ''}No card has been issued yet. Once the request is approved, use "Mark travelcard / transport issued" to hand one over.</p>
          )}
        </div>
      )}

      {oysterDialog === 'issue' && (
        <OysterIssueDialog cards={cards} siteName={item.siteName} preferredCardId={item.oysterCardId} fundingRequestId={item.id} suHint={item.mainAppRef}
          onClose={() => setOysterDialog(null)} onDone={() => { onChanged(); onClose(); }} />
      )}
      {oysterDialog === 'return' && loan && (
        <OysterReturnDialog txn={loan} onClose={() => setOysterDialog(null)} onDone={() => { onChanged(); onClose(); }} />
      )}

      {moves.length === 0 ? (
        <Notice>{FINAL_FUNDING_STATUSES.includes(item.status) ? 'This request is closed.' : 'There is nothing for you to do on this request at this stage.'}</Notice>
      ) : (
        <div className="space-y-2.5 border border-[#e5e5e5] rounded-xs p-3">
          <div className="font-bold text-neutral-700 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#8764b8]" /> What would you like to do?</div>
          <div className="flex gap-2 flex-wrap">
            {moves.map(m => (
              <button key={m.to} type="button" onClick={() => { setError(''); if (oyster && m.to === 'Issued') { setOysterDialog('issue'); return; } setChosen(m.to); }}
                className={`${m.to === 'Rejected' || m.to === 'Cancelled' ? dangerBtn : secondaryBtn} ${chosen === m.to ? 'ring-2 ring-[#8764b8]' : ''}`}>{m.label}</button>
            ))}
          </div>

          {edge && (
            <div className="space-y-2.5 pt-2 border-t border-[#e5e5e5]">
              {edge.to === 'Approved' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Approved transport" required>
                    <select className={inputCls} value={method} onChange={e => setMethod(e.target.value)}>{APPROVED_METHODS.map(o => <option key={o} value={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Approved amount (£)" required><input className={inputCls} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
                </div>
              )}
              {edge.to === 'Issued' && <Field label="Travelcard or journey reference" required><input className={inputCls} value={reference} onChange={e => setReference(e.target.value)} maxLength={200} /></Field>}
              {edge.to === 'Completed' && <Field label="Completion notes (optional)"><textarea className={inputCls} rows={2} value={completion} onChange={e => setCompletion(e.target.value)} /></Field>}
              {(edge.note || edge.to === 'Approved') && (
                <Field label={edge.to === 'Rejected' ? 'Reason for rejecting' : edge.to === 'Clarification Required' ? 'What is needed' : 'Comment'} required={edge.note === 'required'}>
                  <textarea className={inputCls} rows={2} value={note} onChange={e => setNote(e.target.value)} />
                </Field>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" className={secondaryBtn} onClick={() => setChosen('')} disabled={busy}>Back</button>
                <button type="button" className={edge.to === 'Rejected' || edge.to === 'Cancelled' ? dangerBtn : primaryBtn} onClick={submit} disabled={busy}>{busy ? 'Saving...' : `Confirm: ${edge.label}`}</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <h4 className="font-bold text-neutral-700 mb-1">History</h4>
        {history.length === 0 ? <p className="text-neutral-500">No history recorded yet.</p> : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-xs">
            {history.map(h => (
              <li key={h.id} className="p-2 flex flex-wrap gap-x-3">
                <span className="font-semibold">{h.fromStatus ? `${h.fromStatus} → ` : ''}{h.toStatus}</span>
                {h.note && <span className="text-neutral-600">{h.note}</span>}
                <span className="ml-auto text-neutral-500">{h.changedBy}{h.changedRole ? ` (${h.changedRole})` : ''} · {fmtDateTime(h.changedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SuModal>
  );
};
