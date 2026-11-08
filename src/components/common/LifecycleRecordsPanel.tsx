import React, { useCallback, useEffect, useState } from 'react';
import { ArchiveRestore, History } from 'lucide-react';
import { lifecycleService } from '../../services/lifecycleService';
import { canRestoreRecords, type LifecycleEntity, type LifecycleEvent, type LifecycleRow } from '../../config/recordLifecycle';

export type LifecycleSection = 'Active' | 'Archived' | 'Deleted';

interface TabsProps {
  value: LifecycleSection;
  onChange: (v: LifecycleSection) => void;
  /** Counts shown next to Archived / Deleted once those lists have loaded. */
  counts?: Partial<Record<LifecycleSection, number>>;
}

const SECTIONS: Array<{ id: LifecycleSection; label: string }> = [
  { id: 'Active', label: 'Active Records' },
  { id: 'Archived', label: 'Archived Records' },
  { id: 'Deleted', label: 'Deleted Records' },
];

/** Section selector, styled like the page's existing tabs. */
export const LifecycleTabs: React.FC<TabsProps> = ({ value, onChange, counts }) => (
  <div role="tablist" aria-label="Record status" className="flex gap-1 border-b border-[#e1dfdd] overflow-x-auto">
    {SECTIONS.map(s => (
      <button
        key={s.id}
        role="tab"
        type="button"
        aria-selected={value === s.id}
        onClick={() => onChange(s.id)}
        className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
          value === s.id ? 'border-[#0d9488] text-[#0f766e]' : 'border-transparent text-[#605e5c] hover:text-[#242424]'
        }`}
      >
        {s.label}{typeof counts?.[s.id] === 'number' && s.id !== 'Active' ? ` (${counts[s.id]})` : ''}
      </button>
    ))}
  </div>
);

const fmt = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

interface PanelProps {
  entity: LifecycleEntity;
  state: 'Archived' | 'Deleted';
  role: string;
  /** Changes after any archive / delete / restore so the list reloads. */
  reloadKey: number;
  onRestore: (row: LifecycleRow) => void;
  onLoaded?: (state: 'Archived' | 'Deleted', count: number) => void;
}

const ACTION_LABEL: Record<string, string> = { archive: 'Archived', delete: 'Deleted', restore: 'Restored' };

export const LifecycleRecordsPanel: React.FC<PanelProps> = ({ entity, state, role, reloadKey, onRestore, onLoaded }) => {
  const [rows, setRows] = useState<LifecycleRow[] | null>(null);
  const [installed, setInstalled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [events, setEvents] = useState<LifecycleEvent[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const isSuperAdmin = canRestoreRecords(role);
  const isArchived = state === 'Archived';
  const typeLabel = entity === 'users' ? 'users' : 'properties';

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await lifecycleService.list(entity, state);
      setRows(res.rows);
      setInstalled(res.installed);
      onLoaded?.(state, res.rows.length);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || 'Could not load records.');
    }
  }, [entity, state, onLoaded]);

  useEffect(() => { setRows(null); setOpenHistory(null); void load(); }, [load, reloadKey]);

  const toggleHistory = async (id: string) => {
    if (openHistory === id) { setOpenHistory(null); return; }
    setOpenHistory(id);
    setEvents(null);
    setHistoryError(null);
    try { setEvents(await lifecycleService.history(entity, id)); } catch (e: any) { setHistoryError(e?.message || 'Could not load history.'); }
  };

  if (rows === null) return <p className="p-6 text-xs text-[#605e5c]" aria-busy="true">Loading…</p>;
  if (error) return <p role="alert" className="p-6 text-xs text-[#a4262c]">{error}</p>;
  if (!installed) {
    return <p className="p-6 text-xs text-[#605e5c]">Archived and deleted records are not available until the database update (migration 028) is applied.</p>;
  }
  if (rows.length === 0) {
    return <p className="p-6 text-xs text-[#605e5c]">{isArchived ? `No archived ${typeLabel}.` : `No deleted ${typeLabel}.`}</p>;
  }

  return (
    <div>
      {!isSuperAdmin && <p className="px-4 py-2 text-xs text-[#605e5c] border-b border-[#edebe9]">Only a Super Admin can restore records.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#edebe9] text-[#605e5c] font-semibold bg-[#faf9f8] whitespace-nowrap">
              <th className="p-3">{entity === 'users' ? 'Name' : 'Property'}</th>
              <th className="p-3">Type</th>
              <th className="p-3">{isArchived ? 'Archived' : 'Deleted'}</th>
              <th className="p-3">{isArchived ? 'Archived by' : 'Deleted by'}</th>
              <th className="p-3">{isArchived ? 'Reason' : 'Previous status'}</th>
              {isSuperAdmin && <th className="p-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <React.Fragment key={r.id}>
                <tr className="border-b border-[#edebe9] align-top">
                  <td className="p-3">
                    <div className="font-semibold text-[#242424]">{r.label}</div>
                    {r.detail && <div className="text-[11px] text-[#605e5c]">{r.detail}</div>}
                  </td>
                  <td className="p-3 text-[#323130]">{r.recordType}</td>
                  <td className="p-3 text-[#323130] whitespace-nowrap">{fmt(r.changedAt)}</td>
                  <td className="p-3 text-[#323130]">{r.changedBy || '—'}</td>
                  <td className="p-3 text-[#323130]">
                    {isArchived
                      ? (r.reason || '—')
                      : [r.previousState === 'Archived' ? 'Archived' : null, r.previousStatus].filter(Boolean).join(' · ') || 'Active'}
                    {!isArchived && r.reason ? <div className="text-[11px] text-[#605e5c]">{r.reason}</div> : null}
                  </td>
                  {isSuperAdmin && (
                    <td className="p-3 text-right whitespace-nowrap">
                      <button type="button" onClick={() => toggleHistory(r.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 mr-1.5 text-[11px] font-semibold border border-[#8a8886] rounded-xs bg-white text-[#323130] hover:bg-[#edebe9]">
                        <History className="w-3.5 h-3.5" />History
                      </button>
                      <button type="button" onClick={() => onRestore(r)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold border border-[#0d9488] rounded-xs bg-[#0d9488] text-white hover:bg-[#0f766e]">
                        <ArchiveRestore className="w-3.5 h-3.5" />Restore
                      </button>
                    </td>
                  )}
                </tr>
                {isSuperAdmin && openHistory === r.id && (
                  <tr className="border-b border-[#edebe9] bg-[#faf9f8]">
                    <td colSpan={6} className="p-3">
                      {historyError ? <p className="text-[#a4262c]">{historyError}</p>
                        : events === null ? <p className="text-[#605e5c]">Loading history…</p>
                        : events.length === 0 ? <p className="text-[#605e5c]">No history recorded.</p>
                        : (
                          <ul className="space-y-1">
                            {events.map(e => (
                              <li key={e.id} className="text-[#323130]">
                                <span className="font-semibold">{ACTION_LABEL[e.action] || e.action}</span> {e.previousState} → {e.newState} by {e.actorName}{e.actorRole ? ` (${e.actorRole})` : ''} · {fmt(e.createdAt)}{e.reason ? ` · ${e.reason}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const LifecycleNoticeBar: React.FC<{ notice: { type: 'success' | 'error'; text: string } | null; onDismiss: () => void }> = ({ notice, onDismiss }) => {
  if (!notice) return null;
  const ok = notice.type === 'success';
  return (
    <div role="status" className={`flex items-center justify-between gap-3 px-3 py-2 text-xs border rounded-xs ${ok ? 'bg-[#f0fdfa] border-[#99f6e4] text-[#0f766e]' : 'bg-[#fdf3f2] border-[#f1998e] text-[#a4262c]'}`}>
      <span>{notice.text}</span>
      <button type="button" onClick={onDismiss} className="font-semibold hover:underline">Dismiss</button>
    </div>
  );
};
