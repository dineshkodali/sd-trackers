/**
 * Small shared UI pieces for the Room Management screens (same look as the rest of the app).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export const inputCls =
  'w-full px-2.5 py-1.5 bg-white border border-[#d4d4d4] rounded-xs text-xs text-[#1e293b] focus:outline-none focus:border-[#0d9488] disabled:bg-[#f5f5f5] disabled:text-neutral-500';
export const labelCls = 'block text-[10px] font-bold text-[#475569] uppercase mb-0.5';
export const btnCls =
  'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-[#f0fdfa] text-[#334155] border border-[#cbd5e1] hover:border-[#0d9488] rounded-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
export const primaryBtnCls =
  'inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
export const dangerBtnCls =
  'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-red-50 text-red-700 border border-red-300 rounded-xs transition-colors cursor-pointer disabled:opacity-50';

export type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'teal' | 'grey';
const TONES: Record<Tone, string> = {
  neutral: 'bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]',
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-300',
  red: 'bg-red-50 text-red-700 border-red-200',
  blue: 'bg-sky-50 text-sky-800 border-sky-200',
  purple: 'bg-purple-50 text-purple-800 border-purple-200',
  teal: 'bg-teal-50 text-teal-800 border-teal-200',
  grey: 'bg-neutral-100 text-neutral-600 border-neutral-300',
};

export const Chip: React.FC<{ tone?: Tone; children: React.ReactNode; title?: string }> = ({ tone = 'neutral', children, title }) => (
  <span title={title} className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-xs border whitespace-nowrap ${TONES[tone]}`}>
    {children}
  </span>
);

export const roomStatusTone = (status?: string): Tone => {
  switch (status) {
    case 'Available': return 'green';
    case 'Reserved': return 'blue';
    case 'Partially Occupied': return 'teal';
    case 'Occupied': return 'purple';
    case 'Under Maintenance': case 'Maintenance': return 'amber';
    case 'Blocked': case 'Unavailable': return 'red';
    case 'Void': case 'Decommissioned': return 'grey';
    default: return 'neutral';
  }
};
export const cleaningTone = (s?: string): Tone => (s === 'Clean' || s === 'Inspected' ? 'green' : s === 'Dirty' ? 'amber' : s === 'Deep Clean Due' ? 'red' : 'neutral');
export const conditionTone = (s?: string): Tone => (s === 'Excellent' || s === 'Good' ? 'green' : s === 'Fair' ? 'amber' : s === 'Poor' || s === 'Needs Replacement' ? 'red' : 'neutral');
export const itemStatusTone = (s?: string): Tone => (s === 'In Room' ? 'green' : s === 'Damaged' ? 'amber' : s === 'Missing' ? 'red' : 'grey');
export const priorityTone = (s?: string): Tone => (s === 'Urgent' ? 'red' : s === 'High' ? 'amber' : s === 'Medium' ? 'blue' : 'neutral');
export const issueStatusTone = (s?: string): Tone => (s === 'Open' ? 'red' : s === 'In Progress' ? 'amber' : s === 'Resolved' ? 'green' : 'grey');

export const Field: React.FC<{ label: string; htmlFor?: string; className?: string; hint?: string; children: React.ReactNode }> = ({ label, htmlFor, className, hint, children }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className={labelCls}>{label}</label>
    {children}
    {hint && <p className="text-[10px] text-[#64748b] mt-0.5">{hint}</p>}
  </div>
);

export const Card: React.FC<{ title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, actions, children, className }) => (
  <section className={`bg-white border border-[#e2e8f0] rounded-xs shadow-2xs ${className || ''}`}>
    {(title || actions) && (
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#f1f5f9] bg-[#fafafa]">
        <h3 className="text-xs font-bold text-[#1e293b] flex items-center gap-1.5">{title}</h3>
        <div className="flex items-center gap-1.5">{actions}</div>
      </div>
    )}
    <div className="p-3">{children}</div>
  </section>
);

export const Stat: React.FC<{ label: string; value: React.ReactNode; sub?: string; tone?: Tone }> = ({ label, value, sub, tone = 'neutral' }) => (
  <div className={`border rounded-xs px-3 py-2 ${TONES[tone]}`}>
    <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</div>
    <div className="text-lg font-bold leading-tight">{value}</div>
    {sub && <div className="text-[10px] opacity-80">{sub}</div>}
  </div>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; hint?: string; children?: React.ReactNode }> = ({ icon, title, hint, children }) => (
  <div className="text-center py-8 px-4 text-neutral-500">
    {icon && <div className="flex justify-center mb-2 text-neutral-300">{icon}</div>}
    <p className="text-xs font-semibold text-neutral-600">{title}</p>
    {hint && <p className="text-[11px] mt-0.5">{hint}</p>}
    {children && <div className="mt-3 flex justify-center gap-2">{children}</div>}
  </div>
);

export const Modal: React.FC<{ title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: string }> = ({ title, onClose, children, footer, width = 'max-w-lg' }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className={`bg-white rounded-xs shadow-2xl w-full ${width} max-h-[90vh] flex flex-col border border-[#e5e5e5] text-xs`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5e5] bg-[#faf9f8] shrink-0">
          <h3 className="font-bold text-neutral-800 text-sm">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-xs text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#e5e5e5] bg-[#faf9f8] shrink-0">{footer}</div>}
      </div>
    </div>
  );
};

export interface ToastState { message: string; type: 'success' | 'error' | 'info' }
/** Tiny toast: `const { show, node } = useToast();` then render `{node}` somewhere visible. */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((message: string, type: ToastState['type'] = 'success') => {
    setToast({ message, type });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), type === 'error' ? 6000 : 3500);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const node = toast ? (
    <div role="status" className={`fixed bottom-4 right-4 z-[90] max-w-sm flex items-start gap-2 px-3 py-2 rounded-xs text-xs font-semibold shadow-lg border ${
      toast.type === 'success' ? 'bg-[#f0fdf4] text-[#166534] border-[#86efac]' : toast.type === 'error' ? 'bg-[#fef2f2] text-[#b91c1c] border-[#fca5a5]' : 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]'
    }`}>
      {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : toast.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
      <span>{toast.message}</span>
    </div>
  ) : null;
  return { show, node };
}

/** "3 Oct 2026" style date, or an em dash. */
export const fmtDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso).slice(0, 10) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const fmtDateTime = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};
export const dateInput = (iso?: string): string => (iso ? String(iso).slice(0, 10) : '');
