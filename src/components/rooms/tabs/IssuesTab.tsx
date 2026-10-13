import React, { useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { roomManagementService } from '../../../services/roomManagementService';
import { ISSUE_CATEGORIES, ISSUE_PRIORITIES, type RoomIssue } from '../../../types/roomManagement';
import { Card, Chip, EmptyState, Field, Modal, btnCls, fmtDate, inputCls, issueStatusTone, primaryBtnCls, priorityTone } from '../roomUi';
import type { RoomTabProps } from './tabTypes';

export const IssuesTab: React.FC<RoomTabProps> = ({ room, data, actor, refresh, toast }) => {
  const activeResidents = data.placements.filter(p => p.status === 'Active').length;
  const [showNew, setShowNew] = useState(false);
  const [resolving, setResolving] = useState<RoomIssue | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const open = data.issues.filter(i => i.status === 'Open' || i.status === 'In Progress');
  const closed = data.issues.filter(i => i.status === 'Resolved' || i.status === 'Closed');

  const move = async (issue: RoomIssue, status: string, notes?: string, cost?: number) => {
    const r = await roomManagementService.updateIssueStatus({ room, issue, status, notes, cost, allIssues: data.issues, residents: activeResidents, actor });
    if (r.success) { toast(`Issue ${status.toLowerCase()}`); await refresh(); return true; }
    toast(r.error || 'Could not update the issue.', 'error');
    return false;
  };

  const IssueRow = (i: RoomIssue) => (
    <div key={i.id} className="border border-[#e2e8f0] rounded-xs p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-[#1e293b]">{i.title}</div>
          <div className="text-[10px] text-[#64748b]">{i.issueReference} &middot; {i.category} &middot; raised {fmtDate(i.reportedAt)}{i.reportedBy ? ` by ${i.reportedBy}` : ''}{i.assignedTo ? ` · assigned to ${i.assignedTo}` : ''}{i.dueDate ? ` · due ${fmtDate(i.dueDate)}` : ''}</div>
          {i.description && <p className="text-[11px] text-[#475569] mt-1">{i.description}</p>}
          {i.resolutionNotes && <p className="text-[11px] text-emerald-800 mt-1">Resolution: {i.resolutionNotes}{typeof i.cost === 'number' ? ` (£${i.cost.toFixed(2)})` : ''}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex gap-1"><Chip tone={priorityTone(i.priority)}>{i.priority}</Chip><Chip tone={issueStatusTone(i.status)}>{i.status}</Chip></div>
          {i.blocksRoom && (i.status === 'Open' || i.status === 'In Progress') && <Chip tone="red">Room out of use</Chip>}
        </div>
      </div>
      {(i.status === 'Open' || i.status === 'In Progress') && (
        <div className="mt-2 flex items-center gap-1.5">
          {i.status === 'Open' && <button type="button" className={btnCls} onClick={() => move(i, 'In Progress')}>Start work</button>}
          <button type="button" className={primaryBtnCls} onClick={() => setResolving(i)}>Resolve…</button>
        </div>
      )}
      {i.status === 'Resolved' && <div className="mt-2"><button type="button" className={btnCls} onClick={() => move(i, 'Closed')}>Close</button> <button type="button" className={btnCls} onClick={() => move(i, 'Open')}>Re-open</button></div>}
    </div>
  );

  return (
    <div className="space-y-3">
      <Card title={<><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Open issues ({open.length})</>} actions={<button type="button" className={primaryBtnCls} onClick={() => setShowNew(true)}><Plus className="w-3.5 h-3.5" /> Raise issue</button>}>
        {open.length === 0 ? <EmptyState title="No open issues" hint="Raise one when something in the room is broken, unsafe or needs repair." /> : <div className="space-y-2">{open.map(IssueRow)}</div>}
      </Card>
      <Card title={`Resolved & closed (${closed.length})`} actions={<button type="button" className={btnCls} onClick={() => setShowClosed(s => !s)}>{showClosed ? 'Hide' : 'Show'}</button>}>
        {showClosed ? (closed.length === 0 ? <p className="text-[11px] text-neutral-500">Nothing resolved yet.</p> : <div className="space-y-2">{closed.map(IssueRow)}</div>) : <p className="text-[11px] text-neutral-500">{closed.length} past issue{closed.length === 1 ? '' : 's'}.</p>}
      </Card>

      {showNew && <NewIssueModal roomNumber={room.roomNumber} residents={activeResidents} onClose={() => setShowNew(false)}
        onSave={async v => { const r = await roomManagementService.createIssue({ room, residents: activeResidents, actor, ...v }); if (r.success) { toast('Issue raised'); setShowNew(false); await refresh(); } else toast(r.error || 'Could not raise the issue.', 'error'); }} />}
      {resolving && <ResolveModal issue={resolving} onClose={() => setResolving(null)} onSave={async (notes, cost) => { if (await move(resolving, 'Resolved', notes, cost)) setResolving(null); }} />}
    </div>
  );
};

const NewIssueModal: React.FC<{ roomNumber: string; residents: number; onClose: () => void; onSave: (v: { title: string; category: string; priority: string; description: string; assignedTo: string; dueDate: string; blocksRoom: boolean }) => Promise<void> }> = ({ roomNumber, residents, onClose, onSave }) => {
  const [v, setV] = useState({ title: '', category: 'Maintenance', priority: 'Medium', description: '', assignedTo: '', dueDate: '', blocksRoom: false });
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Raise an issue for room ${roomNumber}`} onClose={onClose}
      footer={<><button type="button" className={btnCls} onClick={onClose}>Cancel</button><button type="button" className={primaryBtnCls} disabled={busy || !v.title.trim()} onClick={async () => { setBusy(true); try { await onSave(v); } finally { setBusy(false); } }}>Raise issue</button></>}>
      <div className="space-y-3">
        <Field label="What is wrong? *" htmlFor="is_title"><input id="is_title" className={inputCls} value={v.title} onChange={e => setV({ ...v, title: e.target.value })} placeholder="e.g. Leaking tap in the en-suite" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" htmlFor="is_cat"><select id="is_cat" className={inputCls} value={v.category} onChange={e => setV({ ...v, category: e.target.value })}>{ISSUE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Priority" htmlFor="is_pri"><select id="is_pri" className={inputCls} value={v.priority} onChange={e => setV({ ...v, priority: e.target.value })}>{ISSUE_PRIORITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Assigned to" htmlFor="is_as"><input id="is_as" className={inputCls} value={v.assignedTo} onChange={e => setV({ ...v, assignedTo: e.target.value })} placeholder="Person or contractor" /></Field>
          <Field label="Due date" htmlFor="is_due"><input id="is_due" type="date" className={inputCls} value={v.dueDate} onChange={e => setV({ ...v, dueDate: e.target.value })} /></Field>
        </div>
        <Field label="Details" htmlFor="is_desc"><textarea id="is_desc" rows={3} className={inputCls} value={v.description} onChange={e => setV({ ...v, description: e.target.value })} /></Field>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" className="accent-[#0d9488] mt-0.5" checked={v.blocksRoom} onChange={e => setV({ ...v, blocksRoom: e.target.checked })} />
          <span><b>The room cannot be used until this is fixed</b><span className="block text-[10px] text-[#64748b]">Marks the room Under Maintenance. It is released automatically when the issue is resolved.{residents > 0 ? ` ${residents} resident${residents > 1 ? 's are' : ' is'} placed here, so move them first.` : ''}</span></span>
        </label>
      </div>
    </Modal>
  );
};

const ResolveModal: React.FC<{ issue: RoomIssue; onClose: () => void; onSave: (notes: string, cost?: number) => Promise<void> }> = ({ issue, onClose, onSave }) => {
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Resolve: ${issue.title}`} onClose={onClose}
      footer={<><button type="button" className={btnCls} onClick={onClose}>Cancel</button><button type="button" className={primaryBtnCls} disabled={busy} onClick={async () => { setBusy(true); try { await onSave(notes, cost === '' ? undefined : Number(cost)); } finally { setBusy(false); } }}>Mark resolved</button></>}>
      <div className="space-y-3">
        <Field label="What was done?" htmlFor="rs_notes"><textarea id="rs_notes" rows={3} className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
        <Field label="Cost (£, optional)" htmlFor="rs_cost"><input id="rs_cost" type="number" min={0} step="0.01" className={inputCls} value={cost} onChange={e => setCost(e.target.value)} /></Field>
        {issue.blocksRoom && <p className="text-[11px] text-sky-900 bg-sky-50 border border-sky-200 rounded-xs px-2 py-1">This issue had taken the room out of use. If no other issue is blocking it, the room goes back into use.</p>}
      </div>
    </Modal>
  );
};
