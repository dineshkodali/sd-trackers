import React, { useEffect, useRef, useState } from 'react';
import { IconCheck as Check, IconChevronDown as ChevronDown, IconCopy as Copy, IconEye as Eye, IconLayoutDashboard as LayoutDashboard, IconDots as MoreHorizontal, IconPencil as Pencil, IconPlus as Plus, IconRotate as RotateCcw, IconStar as Star, IconTrash as Trash2 } from '@tabler/icons-react';
import type { DashboardRecord } from '../../config/dashboardWidgets';
import type { DashboardStorage } from '../../services/dashboardService';

interface Props {
  dashboards: DashboardRecord[];
  active: DashboardRecord;
  isBuiltIn: boolean;
  isEditing: boolean;
  busy: boolean;
  error: string | null;
  storage: DashboardStorage;
  canAddDashboard: boolean;
  draftName: string;
  previewing: boolean;
  onTogglePreview: () => void;
  onDraftName: (name: string) => void;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onEdit: () => void;
  onAddWidget: () => void;
  onReset: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const btn = 'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xs border transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnSecondary = `${btn} bg-white border-[#8a8886] text-[#323130] hover:bg-[#edebe9]`;
const btnPrimary = `${btn} bg-[#0d9488] border-[#0d9488] text-white hover:bg-[#0f766e]`;
const menuItem = 'w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-[#323130] hover:bg-[#f3f2f1] disabled:opacity-50 disabled:cursor-not-allowed';

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, close: () => void, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, ref, close]);
}

const NameForm: React.FC<{ initial: string; label: string; submitLabel: string; onSubmit: (name: string) => void; onClose: () => void }> = ({ initial, label, submitLabel, onSubmit, onClose }) => {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="absolute right-0 top-full mt-1 w-64 bg-white border border-[#e1dfdd] rounded-xs shadow-lg z-40 p-3 space-y-2"
      onSubmit={e => { e.preventDefault(); if (value.trim()) { onSubmit(value.trim()); onClose(); } }}
    >
      <label className="block text-xs font-semibold text-[#323130]" htmlFor="dashboard-name-input">{label}</label>
      <input
        id="dashboard-name-input"
        autoFocus
        value={value}
        maxLength={60}
        onChange={e => setValue(e.target.value)}
        className="w-full px-2.5 py-1.5 text-xs border border-[#8a8886] rounded-xs focus:outline-none focus:border-[#0d9488]"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
        <button type="submit" disabled={!value.trim()} className={btnPrimary}>{submitLabel}</button>
      </div>
    </form>
  );
};

export const DashboardToolbar: React.FC<Props> = (p) => {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);
  useOutsideClose(selectorRef, () => setSelectorOpen(false), selectorOpen);
  useOutsideClose(optionsRef, () => { setOptionsOpen(false); setRenameOpen(false); }, optionsOpen || renameOpen);
  useOutsideClose(addRef, () => setAddOpen(false), addOpen);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1dfdd] pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative" ref={selectorRef}>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={selectorOpen}
              disabled={p.isEditing}
              onClick={() => setSelectorOpen(o => !o)}
              className={`${btnSecondary} max-w-[16rem]`}
              title={p.isEditing ? 'Save or cancel your changes to switch dashboards' : 'Switch dashboard'}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />
              <span className="truncate">{p.active.name}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>
            {selectorOpen && (
              <ul role="listbox" className="absolute left-0 top-full mt-1 w-64 bg-white border border-[#e1dfdd] rounded-xs shadow-lg z-40 py-1 max-h-72 overflow-auto">
                {p.dashboards.map(d => (
                  <li key={d.id} role="option" aria-selected={d.id === p.active.id}>
                    <button type="button" className={menuItem} onClick={() => { p.onSelect(d.id); setSelectorOpen(false); }}>
                      <Check className={`w-3.5 h-3.5 shrink-0 ${d.id === p.active.id ? 'text-[#0d9488]' : 'invisible'}`} />
                      <span className="truncate flex-1">{d.name}</span>
                      {d.isDefault && <span className="text-[11px] text-[#605e5c]">Default</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {p.isEditing && (
            <input
              aria-label="Dashboard name"
              value={p.draftName}
              maxLength={60}
              placeholder="Dashboard name"
              onChange={e => p.onDraftName(e.target.value)}
              className="px-2.5 py-2 text-xs border border-[#8a8886] rounded-xs w-52 focus:outline-none focus:border-[#0d9488]"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {p.isEditing ? (
            <>
              <button type="button" onClick={p.onAddWidget} className={btnSecondary}><Plus className="w-3.5 h-3.5" />Add widget</button>
              <button type="button" onClick={p.onTogglePreview} aria-pressed={p.previewing} className={btnSecondary}><Eye className="w-3.5 h-3.5" />{p.previewing ? 'Back to editing' : 'Preview'}</button>
              <button type="button" onClick={p.onReset} className={btnSecondary}><RotateCcw className="w-3.5 h-3.5" />Reset layout</button>
              <button type="button" onClick={p.onCancel} disabled={p.busy} className={btnSecondary}>Cancel</button>
              <button type="button" onClick={p.onSave} disabled={p.busy} className={btnPrimary}>{p.busy ? 'Saving…' : 'Save changes'}</button>
            </>
          ) : (
            <>
              <div className="relative" ref={addRef}>
                <button type="button" disabled={!p.canAddDashboard || p.busy} onClick={() => setAddOpen(o => !o)} className={btnSecondary} title={p.canAddDashboard ? undefined : 'Dashboard limit reached'}>
                  <Plus className="w-3.5 h-3.5" />Add dashboard
                </button>
                {addOpen && <NameForm initial="" label="Dashboard name" submitLabel="Create" onSubmit={p.onCreate} onClose={() => setAddOpen(false)} />}
              </div>
              <button type="button" onClick={p.onEdit} className={btnSecondary}><Pencil className="w-3.5 h-3.5" />Edit dashboard</button>
              <div className="relative" ref={optionsRef}>
                <button type="button" aria-haspopup="menu" aria-expanded={optionsOpen} aria-label="Dashboard options" onClick={() => { setOptionsOpen(o => !o); setRenameOpen(false); }} className={btnSecondary}>
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {optionsOpen && !renameOpen && (
                  <div role="menu" className="absolute right-0 top-full mt-1 w-56 bg-white border border-[#e1dfdd] rounded-xs shadow-lg z-40 py-1">
                    <button role="menuitem" className={menuItem} disabled={p.isBuiltIn || p.busy} onClick={() => setRenameOpen(true)}><Pencil className="w-3.5 h-3.5" />Rename</button>
                    <button role="menuitem" className={menuItem} disabled={!p.canAddDashboard || p.busy} onClick={() => { setOptionsOpen(false); p.onDuplicate(); }}><Copy className="w-3.5 h-3.5" />Duplicate</button>
                    <button role="menuitem" className={menuItem} disabled={p.active.isDefault || p.busy} onClick={() => { setOptionsOpen(false); p.onSetDefault(); }}><Star className="w-3.5 h-3.5" />{p.active.isDefault ? 'Default dashboard' : 'Set as default'}</button>
                    <button role="menuitem" className={menuItem} disabled={p.isBuiltIn || p.busy} onClick={() => { setOptionsOpen(false); p.onDelete(); }}><Trash2 className="w-3.5 h-3.5 text-[#a4262c]" />Delete</button>
                  </div>
                )}
                {renameOpen && <NameForm initial={p.active.name} label="Rename dashboard" submitLabel="Rename" onSubmit={p.onRename} onClose={() => { setRenameOpen(false); setOptionsOpen(false); }} />}
              </div>
            </>
          )}
        </div>
      </div>

      {p.error && <p role="alert" className="text-xs text-[#a4262c]">{p.error}</p>}
      {p.storage === 'device' && !p.isBuiltIn && (
        <p className="text-xs text-[#605e5c]">Dashboards are saved on this device only until the database update (migration 027) is applied.</p>
      )}
      {p.isEditing && p.isBuiltIn && (
        <p className="text-xs text-[#605e5c]">Saving creates your own copy. The default dashboard stays available.</p>
      )}
    </div>
  );
};
