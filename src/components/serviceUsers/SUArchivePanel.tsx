import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, ShieldCheck } from 'lucide-react';
import { suEnhancementsService, type ArchiveRequest } from '../../services/suEnhancementsService';
import { archiveActionsFor } from '../../utils/suEnhancementsLogic';
import type { ServiceUserMaster } from '../../types/masterData';
import { Field, ErrorBanner, Notice, StatusPill, SuModal, inputCls, primaryBtn, secondaryBtn, dangerBtn, useSuActor, fmtDateTime } from '../su/suUi';

type Dialog = { kind: 'request'; type: 'Archive' | 'Restore' } | { kind: 'decide'; request: ArchiveRequest; decision: 'Approved' | 'Rejected' | 'Cancelled' };

/**
 * Archive / restore workflow for one Service User. The server and the database enforce who may request and decide,
 * and that nobody decides their own request; this panel only shows the actions that are available to the signed-in user.
 */
export const SUArchivePanel: React.FC<{ serviceUser: ServiceUserMaster; onChanged: () => void }> = ({ serviceUser, onChanged }) => {
  const actor = useSuActor();
  const [requests, setRequests] = useState<ArchiveRequest[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const load = useCallback(async () => {
    if (!actor.isManager) return;
    const res = await suEnhancementsService.listArchiveRequests({ suId: serviceUser.id });
    if (res.success) setRequests(res.data); else setError(res.error || 'Could not load archive requests.');
  }, [serviceUser.id, actor.isManager]);
  useEffect(() => { void load(); }, [load, serviceUser.archiveStatus]);

  const state = serviceUser.archiveStatus || 'Active';
  const pending = requests.find(r => r.status === 'Pending') || null;
  const can = archiveActionsFor(serviceUser, { request: actor.canRequestArchive, decide: actor.canDecideArchive }, pending, actor.userId);
  if (state === 'Active' && !can.canRequestArchive && requests.length === 0) return null;

  const after = async (msg: string) => { setDialog(null); setMessage(msg); await load(); onChanged(); };

  return (
    <div className={`border rounded-xs p-3.5 text-xs space-y-2.5 ${state === 'Archived' ? 'bg-neutral-100 border-neutral-300' : state === 'Active' ? 'bg-white border-[#e5e5e5]' : 'bg-amber-50 border-amber-200'}`} aria-label="Archive status">
      <div className="flex items-center gap-2 flex-wrap">
        {state === 'Archived' ? <Archive className="w-4 h-4 text-neutral-600" /> : <ShieldCheck className="w-4 h-4 text-teal-700" />}
        <span className="font-bold text-neutral-800">Archive status</span>
        <StatusPill status={state} tone={state === 'Archived' ? 'neutral' : state === 'Active' ? 'good' : 'warn'} />
        <div className="flex-1" />
        {can.canRequestArchive && <button type="button" className={`${secondaryBtn} flex items-center gap-1`} onClick={() => { setMessage(''); setDialog({ kind: 'request', type: 'Archive' }); }}><Archive className="w-3 h-3" /> Request archive</button>}
        {can.canRequestRestore && <button type="button" className={`${secondaryBtn} flex items-center gap-1`} onClick={() => { setMessage(''); setDialog({ kind: 'request', type: 'Restore' }); }}><ArchiveRestore className="w-3 h-3" /> Request restore</button>}
      </div>
      {state === 'Archived' && <p className="text-neutral-600">This record is archived and read-only for routine edits. Everything recorded for this person is kept. Restoring needs an approved request.</p>}
      <ErrorBanner message={error} />
      {message && <Notice tone="ok">{message}</Notice>}

      {pending && (
        <div className="bg-white border border-amber-200 rounded-xs p-2.5 space-y-1.5">
          <div><span className="font-semibold">{pending.requestType} requested</span> by {pending.requestedBy} on {fmtDateTime(pending.requestedAt)}</div>
          <div className="text-neutral-700 whitespace-pre-wrap">Reason: {pending.reason}</div>
          <div className="flex gap-2 flex-wrap">
            {can.canDecide && <button type="button" className={primaryBtn} onClick={() => setDialog({ kind: 'decide', request: pending, decision: 'Approved' })}>Approve</button>}
            {can.canDecide && <button type="button" className={dangerBtn} onClick={() => setDialog({ kind: 'decide', request: pending, decision: 'Rejected' })}>Reject</button>}
            {can.canCancel && <button type="button" className={secondaryBtn} onClick={() => setDialog({ kind: 'decide', request: pending, decision: 'Cancelled' })}>Cancel my request</button>}
            {!can.canDecide && !can.canCancel && <span className="text-amber-800">Waiting for an authorised approver{pending.requestedById === actor.userId ? ' (you cannot approve your own request)' : ''}.</span>}
          </div>
        </div>
      )}

      {requests.filter(r => r.status !== 'Pending').length > 0 && (
        <details>
          <summary className="cursor-pointer text-neutral-600 font-semibold">Request history ({requests.filter(r => r.status !== 'Pending').length})</summary>
          <ul className="mt-1.5 divide-y divide-neutral-200 border border-neutral-200 rounded-xs bg-white">
            {requests.filter(r => r.status !== 'Pending').map(r => (
              <li key={r.id} className="p-2 space-y-0.5">
                <div className="flex gap-2 flex-wrap"><span className="font-semibold">{r.requestType}</span><StatusPill status={r.status} tone={r.status === 'Approved' ? 'good' : r.status === 'Rejected' ? 'bad' : 'neutral'} /><span className="ml-auto text-neutral-500">{fmtDateTime(r.requestedAt)}</span></div>
                <div className="text-neutral-600">Requested by {r.requestedBy}: {r.reason}</div>
                {r.decidedBy && <div className="text-neutral-600">{r.status} by {r.decidedBy} on {fmtDateTime(r.decidedAt)}{r.decisionReason ? `: ${r.decisionReason}` : ''}</div>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {dialog?.kind === 'request' && <RequestDialog su={serviceUser} type={dialog.type} onClose={() => setDialog(null)} onDone={() => after(dialog.type === 'Archive' ? 'Archive request sent for approval.' : 'Restore request sent for approval.')} />}
      {dialog?.kind === 'decide' && <DecisionDialog su={serviceUser} request={dialog.request} decision={dialog.decision} onClose={() => setDialog(null)}
        onDone={() => after(dialog.decision === 'Approved' ? (dialog.request.requestType === 'Archive' ? 'Archived. The record and its history are kept.' : 'Restored to active.') : dialog.decision === 'Rejected' ? 'Request rejected.' : 'Request cancelled.')} />}
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
    if (!res.success) { setError(res.error || 'Could not complete the request.'); return; }
    onDone();
  };
  return { busy, error, run };
}

const RequestDialog: React.FC<{ su: ServiceUserMaster; type: 'Archive' | 'Restore'; onClose: () => void; onDone: () => void }> = ({ su, type, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  return (
    <SuModal title={`${type === 'Archive' ? 'Request archive' : 'Request restore'}: ${su.firstName} ${su.lastName}`} onClose={onClose}>
      <ErrorBanner message={error} />
      <Notice>{type === 'Archive'
        ? 'Nothing is deleted. Once an authorised approver agrees, the person leaves the active lists and their records stay available to authorised staff.'
        : 'Once an authorised approver agrees, the person returns to the active lists with the status they had before.'}</Notice>
      <Field label="Reason" required><textarea className={inputCls} rows={3} value={reason} onChange={e => setReason(e.target.value)} autoFocus /></Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={busy} onClick={() => run(() => suEnhancementsService.requestArchive(su.id, type, reason))}>{busy ? 'Sending...' : 'Send for approval'}</button>
      </div>
    </SuModal>
  );
};

const DecisionDialog: React.FC<{ su: ServiceUserMaster; request: ArchiveRequest; decision: 'Approved' | 'Rejected' | 'Cancelled'; onClose: () => void; onDone: () => void }> = ({ su, request, decision, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  const verb = decision === 'Approved' ? `Approve ${request.requestType.toLowerCase()}` : decision === 'Rejected' ? 'Reject request' : 'Cancel request';
  return (
    <SuModal title={`${verb}: ${su.firstName} ${su.lastName}`} onClose={onClose}>
      <ErrorBanner message={error} />
      <p><span className="text-neutral-500">Requested by {request.requestedBy}:</span> {request.reason}</p>
      {decision === 'Approved' && <Notice tone="warn">{request.requestType === 'Archive' ? 'This removes the person from active lists. Nothing is deleted.' : 'This returns the person to the active lists.'}</Notice>}
      <Field label={decision === 'Rejected' ? 'Reason for rejecting' : 'Comment (optional)'} required={decision === 'Rejected'}><textarea className={inputCls} rows={2} value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Back</button>
        <button type="button" className={decision === 'Rejected' ? dangerBtn : primaryBtn} disabled={busy} onClick={() => run(() => suEnhancementsService.decideArchive(request.id, decision, reason))}>{busy ? 'Saving...' : verb}</button>
      </div>
    </SuModal>
  );
};

/** All pending requests across Service Users, for approvers. Shows nothing when there are none. */
export const ArchiveRequestsQueue: React.FC<{ nameOf: (suId: string) => string; onChanged: () => void }> = ({ nameOf, onChanged }) => {
  const actor = useSuActor();
  const [requests, setRequests] = useState<ArchiveRequest[]>([]);
  const [dialog, setDialog] = useState<null | { request: ArchiveRequest; decision: 'Approved' | 'Rejected' }>(null);
  const load = useCallback(async () => {
    if (!actor.isManager) return;
    const res = await suEnhancementsService.listArchiveRequests({ status: 'Pending' });
    if (res.success) setRequests(res.data);
  }, [actor.isManager]);
  useEffect(() => { void load(); }, [load]);
  if (!actor.isManager || requests.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xs p-3 text-xs space-y-2" aria-label="Pending archive requests">
      <div className="font-bold text-amber-900">Archive requests waiting ({requests.length})</div>
      <ul className="divide-y divide-amber-200">
        {requests.map(r => {
          const mine = r.requestedById === actor.userId;
          return (
            <li key={r.id} className="py-1.5 flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{nameOf(r.suId)}</span><span>{r.requestType} requested by {r.requestedBy}</span><span className="text-neutral-600">— {r.reason}</span>
              <div className="flex-1" />
              {actor.canDecideArchive && !mine && <>
                <button type="button" className={primaryBtn} onClick={() => setDialog({ request: r, decision: 'Approved' })}>Approve</button>
                <button type="button" className={dangerBtn} onClick={() => setDialog({ request: r, decision: 'Rejected' })}>Reject</button>
              </>}
              {mine && <span className="text-amber-800">Your request</span>}
            </li>
          );
        })}
      </ul>
      {dialog && (
        <DecisionDialog su={{ id: dialog.request.suId, firstName: nameOf(dialog.request.suId), lastName: '' } as ServiceUserMaster} request={dialog.request} decision={dialog.decision}
          onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); onChanged(); }} />
      )}
    </div>
  );
};
