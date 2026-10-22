import React from 'react';
import { ShieldCheck, X, Edit3 } from 'lucide-react';

export interface DossierField { label: string; value: React.ReactNode; full?: boolean }
export interface DossierSection { title: string; fields: DossierField[] }

/**
 * The read-only "dossier" window, built exactly like the view window every other tracker uses: tinted header with
 * the title, uppercase section headings with an underline, label / value pairs in two columns, and a footer with the
 * record id and a Close button.
 */
export const TrackerDossier: React.FC<{
  title: string;
  sections: DossierSection[];
  recordId?: string;
  onClose: () => void;
  onEdit?: () => void;
  canEdit?: boolean;
  /** Extra blocks after the sections (history, audit...). */
  children?: React.ReactNode;
}> = ({ title, sections, recordId, onClose, onEdit, canEdit, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
      <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#f3f8fd]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#e0f2fe] text-[#0284c7] rounded"><ShieldCheck className="w-5 h-5" /></div>
          <div>
            <h3 className="text-base font-semibold text-[#0f766e]">{title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && onEdit && (
            <button type="button" onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors cursor-pointer">
              <Edit3 className="w-3.5 h-3.5" /><span>Edit Record</span>
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-[#242424]">
        {sections.map(sec => (
          <div key={sec.title} className="space-y-3">
            <div className="pb-1 border-b border-neutral-200">
              <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">{sec.title}</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sec.fields.map(f => (
                <div key={f.label} className={f.full ? 'sm:col-span-2 space-y-1' : 'space-y-1'}>
                  <div className="text-[11px] font-semibold text-[#605e5c] uppercase tracking-wider">{f.label}</div>
                  <div className={f.full ? 'text-xs whitespace-pre-wrap p-3 bg-[#faf9f8] border border-[#e5e5e5] rounded-xs' : 'text-xs'}>
                    {f.value === undefined || f.value === null || f.value === '' ? <span className="text-neutral-400">—</span> : f.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {children}
      </div>

      <div className="px-6 py-3 border-t border-[#edebe9] bg-[#faf9f8] flex items-center justify-between">
        <span className="text-[11px] text-neutral-400 font-mono">Record ID: {recordId || '—'}</span>
        <button type="button" onClick={onClose} className="px-4 py-1.5 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold transition-colors cursor-pointer">Close</button>
      </div>
    </div>
  </div>
);
