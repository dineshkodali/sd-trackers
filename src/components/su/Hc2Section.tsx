import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Upload, Trash2, Plus } from 'lucide-react';
import { suEnhancementsService, type Hc2Details } from '../../services/suEnhancementsService';
import { HC2_STATUSES, hc2DisplayStatus } from '../../utils/suEnhancementsLogic';
import { todayIso } from '../../utils/attendanceLogic';
import { Field, ErrorBanner, Notice, StatusPill, inputCls, primaryBtn, secondaryBtn, dangerBtn, useSuActor, fmtDate } from './suUi';

const toneFor = (s: string) => (s === 'Active' || s === 'Issued' ? 'good' : s === 'Expired' || s === 'Rejected' ? 'bad' : s === 'Renewal due' ? 'warn' : 'neutral') as 'good' | 'bad' | 'warn' | 'neutral';

/**
 * HC2 (NHS low income) details for one Service User, shown inside the GP Registration form.
 * Saved on its own button so GP registration fields and HC2 can be changed independently.
 */
export const Hc2Section: React.FC<{ suId: string; readOnly: boolean }> = ({ suId, readOnly }) => {
  const actor = useSuActor();
  const [hc2, setHc2] = useState<Hc2Details | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyDoc, setBusyDoc] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const saveLock = useRef(false);

  const [status, setStatus] = useState('Not applied');
  const [reference, setReference] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!suId) { setHc2(null); return; }
    setLoading(true); setError('');
    const res = await suEnhancementsService.getHc2(suId);
    setLoading(false);
    if (!res.success) { setError(res.error || 'Could not load HC2 details.'); return; }
    setHc2(res.data);
  }, [suId]);

  useEffect(() => { setEditing(false); setMessage(''); void load(); }, [load]);

  const startEdit = () => {
    setStatus(hc2?.status || 'Not applied'); setReference(hc2?.referenceNumber || ''); setIssueDate(hc2?.issueDate || '');
    setExpiryDate(hc2?.expiryDate || ''); setNotes(hc2?.notes || ''); setError(''); setMessage(''); setEditing(true);
  };

  const save = async () => {
    if (saveLock.current) return;           // a double click must not send two requests
    saveLock.current = true; setSaving(true); setError('');
    const res = await suEnhancementsService.saveHc2(
      { id: hc2?.id, suId, status, referenceNumber: reference, issueDate, expiryDate, notes }, actor.name, { canEditIdentifiers: actor.isManager || !hc2 }
    );
    saveLock.current = false; setSaving(false);
    if (!res.success) { setError(res.error || 'Could not save HC2 details.'); return; }
    setEditing(false); setMessage('HC2 details saved.');
    await load();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusyDoc(true); setError(''); setMessage('');
    const res = await suEnhancementsService.uploadHc2Document(suId, file);
    setBusyDoc(false);
    if (!res.success) { setError(res.error || 'Upload failed.'); return; }
    setMessage('Document attached.'); await load();
  };

  const openDoc = async () => {
    setBusyDoc(true); setError('');
    const res = await suEnhancementsService.getHc2DocumentUrl(suId);
    setBusyDoc(false);
    if (!res.success) { setError(res.error || 'Could not open the document.'); return; }
    window.open(res.data, '_blank', 'noopener,noreferrer');
  };

  const removeDoc = async () => {
    if (!window.confirm('Remove the attached HC2 document? The HC2 details are kept.')) return;
    setBusyDoc(true); setError('');
    const res = await suEnhancementsService.removeHc2Document(suId);
    setBusyDoc(false);
    if (!res.success) { setError(res.error || 'Could not remove the document.'); return; }
    setMessage('Document removed.'); await load();
  };

  if (!suId) return null;
  const shown = hc2 ? hc2DisplayStatus(hc2.status, hc2.expiryDate || undefined, todayIso()) : '';

  return (
    <div className="border border-[#e5e5e5] rounded-xs p-3 space-y-2.5" aria-label="HC2 details">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">HC2 certificate {loading && <span className="normal-case font-normal">(loading...)</span>}</div>
        {!readOnly && actor.canEdit && !editing && hc2 && <button type="button" className={secondaryBtn} onClick={startEdit}>Edit HC2</button>}
      </div>
      <ErrorBanner message={error} />
      {message && <Notice tone="ok">{message}</Notice>}

      {!loading && !hc2 && !editing && (
        <div className="space-y-2">
          <p className="text-neutral-500">No HC2 details have been recorded for this Service User.</p>
          {!readOnly && actor.canEdit && <button type="button" className={`${primaryBtn} flex items-center gap-1.5`} onClick={startEdit}><Plus className="w-3.5 h-3.5" /> Add HC2 details</button>}
        </div>
      )}

      {hc2 && !editing && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-neutral-500">Status</div><StatusPill status={shown} tone={toneFor(shown)} /></div>
            <div><div className="text-neutral-500">Reference number</div><div>{actor.isManager ? (hc2.referenceNumber || '—') : <span className="text-neutral-400">Restricted</span>}</div></div>
            <div><div className="text-neutral-500">Issue date</div><div>{fmtDate(hc2.issueDate)}</div></div>
            <div><div className="text-neutral-500">Expiry date</div><div>{fmtDate(hc2.expiryDate)}</div></div>
            <div className="col-span-2"><div className="text-neutral-500">Notes</div><div className="whitespace-pre-wrap">{hc2.notes || '—'}</div></div>
          </div>
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-[#e5e5e5]">
            <FileText className="w-3.5 h-3.5 text-neutral-500" />
            {actor.isManager ? (
              hc2.documentName ? (
                <>
                  <button type="button" className="text-teal-700 underline cursor-pointer" onClick={openDoc} disabled={busyDoc}>{hc2.documentName}</button>
                  {!readOnly && <button type="button" className={`${dangerBtn} flex items-center gap-1`} onClick={removeDoc} disabled={busyDoc}><Trash2 className="w-3 h-3" /> Remove</button>}
                </>
              ) : <span className="text-neutral-500">No document attached</span>
            ) : <span className="text-neutral-400">{hc2.documentUploadedAt ? 'A document is attached (managers can open it)' : 'No document attached'}</span>}
            {!readOnly && actor.canEdit && (
              <label className={`${secondaryBtn} flex items-center gap-1 ${busyDoc ? 'opacity-50 pointer-events-none' : ''}`}>
                <Upload className="w-3 h-3" /> {hc2.documentUploadedAt ? 'Replace document' : 'Upload document'}
                <input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png" onChange={onFile} disabled={busyDoc} />
              </label>
            )}
          </div>
          <p className="text-[10px] text-neutral-500">Documents are stored privately and opened through a link that expires after a minute.</p>
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <Field label="Status" required>
            <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>{HC2_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
          </Field>
          {(actor.isManager || !hc2) && <Field label="Reference number"><input className={inputCls} value={reference} onChange={e => setReference(e.target.value)} maxLength={60} /></Field>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue date"><input type="date" className={inputCls} value={issueDate} onChange={e => setIssueDate(e.target.value)} /></Field>
            <Field label="Expiry date"><input type="date" className={inputCls} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></Field>
          </div>
          <Field label="Notes"><textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            <button type="button" className={primaryBtn} onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save HC2'}</button>
          </div>
        </div>
      )}
    </div>
  );
};
