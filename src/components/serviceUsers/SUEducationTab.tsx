import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GraduationCap, Plus } from 'lucide-react';
import { suEnhancementsService, type EducationDetails } from '../../services/suEnhancementsService';
import { EDUCATION_STATUSES } from '../../utils/suEnhancementsLogic';
import { Field, ErrorBanner, Notice, StatusPill, SuModal, inputCls, primaryBtn, secondaryBtn, useSuActor, fmtDate } from '../su/suUi';

const tone = (s: string) => (s === 'Enrolled' ? 'good' : s === 'Not enrolled' || s === 'No longer attending' ? 'warn' : 'neutral') as 'good' | 'warn' | 'neutral';

/**
 * School details for one child. Each school is its own row: a change of school closes the old row and starts a new one,
 * so earlier schools stay on record. No row at all means "not recorded", which is different from "Not enrolled".
 */
export const SUEducationTab: React.FC<{ suId: string; suName: string }> = ({ suId, suName }) => {
  const actor = useSuActor();
  const [rows, setRows] = useState<EducationDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<null | { mode: 'add' | 'edit' | 'change'; row?: EducationDetails }>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const res = await suEnhancementsService.listEducation(suId);
    setLoading(false);
    if (!res.success) { setError(res.error || 'Could not load school details.'); return; }
    setRows(res.data);
  }, [suId]);
  useEffect(() => { void load(); }, [load]);

  if (!actor.canEdit) return <Notice tone="warn">You do not have access to children's education details.</Notice>;
  const current = rows.find(r => r.isCurrent) || null;
  const past = rows.filter(r => !r.isCurrent);

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-teal-700" /><h4 className="font-bold text-neutral-800">Education / school details: {suName}</h4></div>
      <ErrorBanner message={error} />
      {message && <Notice tone="ok">{message}</Notice>}
      {loading ? <p className="text-neutral-500">Loading...</p> : !current ? (
        <div className="border border-dashed border-neutral-300 rounded-lg p-5 text-center space-y-2">
          <p className="text-neutral-600 font-semibold">No school details have been recorded.</p>
          <p className="text-neutral-500">This is not the same as "Not enrolled". Record the child's education status once it is known.</p>
          <button type="button" className={`${primaryBtn} inline-flex items-center gap-1.5`} onClick={() => { setMessage(''); setDialog({ mode: 'add' }); }}><Plus className="w-3.5 h-3.5" /> Add school details</button>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg p-4 bg-white space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill status={current.educationStatus} tone={tone(current.educationStatus)} />
            <span className="font-semibold text-neutral-800">{current.schoolName || 'School not yet known'}</span>
            <div className="flex-1" />
            <button type="button" className={secondaryBtn} onClick={() => { setMessage(''); setDialog({ mode: 'edit', row: current }); }}>Edit</button>
            <button type="button" className={secondaryBtn} onClick={() => { setMessage(''); setDialog({ mode: 'change', row: current }); }}>Change of school</button>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div><dt className="text-neutral-500">Year group / stage</dt><dd>{current.yearGroup || '—'}</dd></div>
            <div><dt className="text-neutral-500">Start date</dt><dd>{fmtDate(current.startDate)}</dd></div>
            <div className="col-span-2"><dt className="text-neutral-500">School address</dt><dd className="whitespace-pre-wrap">{current.schoolAddress || '—'}</dd></div>
            <div className="col-span-2"><dt className="text-neutral-500">School contact</dt><dd>{current.schoolContact || '—'}</dd></div>
            <div className="col-span-2"><dt className="text-neutral-500">Notes</dt><dd className="whitespace-pre-wrap">{current.notes || '—'}</dd></div>
          </dl>
          <p className="text-[10px] text-neutral-500">Last updated by {current.updatedBy || current.createdBy || 'unknown'}</p>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h5 className="font-bold text-neutral-700 mb-1">Previous schools</h5>
          <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white">
            {past.map(r => (
              <li key={r.id} className="p-2.5 flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="font-semibold">{r.schoolName || 'School not recorded'}</span><StatusPill status={r.educationStatus} tone={tone(r.educationStatus)} />
                <span className="ml-auto text-neutral-500">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dialog && (
        <EducationDialog mode={dialog.mode} row={dialog.row} suId={suId} user={actor.name} onClose={() => setDialog(null)}
          onDone={async msg => { setDialog(null); setMessage(msg); await load(); }} />
      )}
    </div>
  );
};

const EducationDialog: React.FC<{ mode: 'add' | 'edit' | 'change'; row?: EducationDetails; suId: string; user: string; onClose: () => void; onDone: (message: string) => void }> = ({ mode, row, suId, user, onClose, onDone }) => {
  const fresh = mode !== 'edit';           // a change of school starts a blank record
  const base = fresh ? undefined : row;
  const [status, setStatus] = useState(base?.educationStatus || (mode === 'change' ? 'Enrolled' : 'Details pending'));
  const [school, setSchool] = useState(base?.schoolName || '');
  const [address, setAddress] = useState(base?.schoolAddress || '');
  const [contact, setContact] = useState(base?.schoolContact || '');
  const [year, setYear] = useState(base?.yearGroup || '');
  const [start, setStart] = useState(base?.startDate || '');
  const [end, setEnd] = useState(base?.endDate || '');
  const [notes, setNotes] = useState(base?.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);

  const submit = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    const input = { suId, educationStatus: status, schoolName: school, schoolAddress: address, schoolContact: contact, yearGroup: year, startDate: start, endDate: end, notes };
    const res = mode === 'change' && row ? await suEnhancementsService.changeSchool(row, input, user)
      : await suEnhancementsService.saveEducation({ ...input, id: mode === 'edit' ? row?.id : undefined }, user);
    lock.current = false; setBusy(false);
    if (!res.success) { setError(res.error || 'Could not save.'); return; }
    onDone(mode === 'change' ? 'Change of school recorded. The previous school is kept in the history.' : 'School details saved.');
  };

  return (
    <SuModal title={mode === 'add' ? 'Add school details' : mode === 'edit' ? 'Edit school details' : 'Change of school'} onClose={onClose}>
      <ErrorBanner message={error} />
      {mode === 'change' && <Notice>The current school ({row?.schoolName || 'not named'}) is closed and kept in the history. Enter the new school below.</Notice>}
      <Field label="Education status" required>
        <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>{EDUCATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
      </Field>
      <Field label="School name" required={status === 'Enrolled'}><input className={inputCls} value={school} onChange={e => setSchool(e.target.value)} maxLength={200} /></Field>
      <Field label="School address"><textarea className={inputCls} rows={2} value={address} onChange={e => setAddress(e.target.value)} /></Field>
      <Field label="School contact (name and phone or email)"><input className={inputCls} value={contact} onChange={e => setContact(e.target.value)} maxLength={200} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Year group / stage"><input className={inputCls} value={year} onChange={e => setYear(e.target.value)} maxLength={60} /></Field>
        <Field label="Start date"><input type="date" className={inputCls} value={start} onChange={e => setStart(e.target.value)} /></Field>
      </div>
      {mode === 'edit' && status === 'No longer attending' && <Field label="End date"><input type="date" className={inputCls} value={end} onChange={e => setEnd(e.target.value)} /></Field>}
      <Field label="Notes" hint="Record only what is needed to support the child's education."><textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
        <button type="button" className={secondaryBtn} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={primaryBtn} onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
      </div>
    </SuModal>
  );
};
