import React, { useEffect, useState } from 'react';
import { IconAlertTriangle as AlertTriangle, IconArchiveRestore as ArchiveRestore, IconArchive as Archive, IconTrash as Trash2, IconX as X } from '@tabler/icons-react';
import { LIFECYCLE_ENTITY_LABEL, type LifecycleAction, type LifecycleEntity } from '../../config/recordLifecycle';

export interface LifecycleRequest {
  entity: LifecycleEntity;
  action: LifecycleAction;
  id: string;
  label: string;
}

interface Props {
  request: LifecycleRequest | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

function impact(r: LifecycleRequest): string {
  const kind = LIFECYCLE_ENTITY_LABEL[r.entity].toLowerCase();
  if (r.action === 'restore') {
    return `${r.label} will return to the active ${r.entity === 'users' ? 'user list' : 'properties list'} with its original details and relationships.`;
  }
  const where = r.action === 'archive' ? 'Archived Records' : 'Deleted Records';
  const base = r.entity === 'users'
    ? `${r.label} will be removed from the active user list and can no longer sign in.`
    : `${r.label} will be removed from the active properties list and from new entries.`;
  return `${base} The ${kind} is kept in ${where} with its data, relationships and history. Only a Super Admin can restore it.`;
}

/**
 * One dialog for archive, delete and restore. Archiving takes two separate confirmations:
 * step 1 explains the impact (and takes an optional reason), step 2 asks for a final,
 * explicit confirmation naming the record. Nothing happens until step 2 is confirmed.
 */
export const LifecycleDialog: React.FC<Props> = ({ request, busy, error, onClose, onConfirm }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState('');

  useEffect(() => { setStep(1); setReason(''); }, [request?.id, request?.action]);
  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, busy, onClose]);

  if (!request) return null;

  const twoSteps = request.action === 'archive';
  const isFinalStep = !twoSteps || step === 2;
  const kind = LIFECYCLE_ENTITY_LABEL[request.entity];
  const verb = request.action === 'archive' ? 'Archive' : request.action === 'delete' ? 'Delete' : 'Restore';
  const Icon = request.action === 'archive' ? Archive : request.action === 'delete' ? Trash2 : ArchiveRestore;
  const danger = request.action === 'delete';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="lifecycle-title" className="w-full max-w-md bg-white border border-[#e1dfdd] rounded-xs shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e1dfdd]">
          <h2 id="lifecycle-title" className="text-sm font-semibold text-[#242424] flex items-center gap-2">
            <Icon className={`w-4 h-4 ${danger ? 'text-[#a4262c]' : 'text-[#0d9488]'}`} />
            {isFinalStep && twoSteps ? `Confirm: ${verb.toLowerCase()} ${kind.toLowerCase()}` : `${verb} ${kind.toLowerCase()}`}
          </h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="p-1 text-[#605e5c] hover:text-[#242424]"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-4 py-4 space-y-3 text-xs text-[#323130]">
          {twoSteps && <p className="text-[11px] font-semibold text-[#605e5c]">Step {step} of 2</p>}

          {step === 1 ? (
            <>
              <p className="text-sm font-semibold text-[#242424]">{request.label}</p>
              <p className="leading-relaxed">{impact(request)}</p>
              {request.action !== 'restore' && (
                <div>
                  <label htmlFor="lifecycle-reason" className="block font-semibold mb-1">Reason (optional)</label>
                  <textarea
                    id="lifecycle-reason"
                    value={reason}
                    maxLength={300}
                    rows={2}
                    onChange={e => setReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#8a8886] rounded-xs focus:outline-none focus:border-[#0d9488]"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2 p-3 border border-[#f1998e] bg-[#fdf3f2] rounded-xs text-[#a4262c]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                You are about to archive {kind.toLowerCase()} <strong>{request.label}</strong>. Select {verb} to confirm.
              </p>
            </div>
          )}

          {error && <p role="alert" className="text-[#a4262c]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#e1dfdd]">
          {step === 2 ? (
            <button type="button" disabled={busy} onClick={() => setStep(1)} className="px-3 py-2 text-xs font-semibold border border-[#8a8886] rounded-xs bg-white text-[#323130] hover:bg-[#edebe9] disabled:opacity-50">Back</button>
          ) : (
            <button type="button" disabled={busy} onClick={onClose} className="px-3 py-2 text-xs font-semibold border border-[#8a8886] rounded-xs bg-white text-[#323130] hover:bg-[#edebe9] disabled:opacity-50">Cancel</button>
          )}
          {isFinalStep ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirm(reason)}
              className={`px-3 py-2 text-xs font-semibold rounded-xs border text-white disabled:opacity-50 ${danger ? 'bg-[#a4262c] border-[#a4262c] hover:bg-[#8a1f24]' : 'bg-[#0d9488] border-[#0d9488] hover:bg-[#0f766e]'}`}
            >
              {busy ? 'Working…' : verb}
            </button>
          ) : (
            <button type="button" onClick={() => setStep(2)} className="px-3 py-2 text-xs font-semibold rounded-xs border bg-[#0d9488] border-[#0d9488] text-white hover:bg-[#0f766e]">Continue</button>
          )}
        </div>
      </div>
    </div>
  );
};
