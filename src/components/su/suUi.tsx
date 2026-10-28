import React from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { canViewNhsNumber, canEditSuTrackers } from '../../utils/suTrackerAccess';

/** Shared look for the Service User enhancement screens: the same classes the GP and PEEP trackers use. */
export const inputCls = 'w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] disabled:bg-neutral-100';
export const primaryBtn = 'px-4 py-1.5 bg-[#0d9488] hover:bg-teal-700 text-white rounded-xs text-xs font-semibold disabled:opacity-50 cursor-pointer';
export const secondaryBtn = 'px-3.5 py-1.5 border border-[#e5e5e5] rounded-xs text-xs text-neutral-700 hover:bg-neutral-100 cursor-pointer disabled:opacity-50';
export const dangerBtn = 'px-3.5 py-1.5 bg-white border border-rose-300 text-rose-700 rounded-xs text-xs font-semibold hover:bg-rose-50 cursor-pointer disabled:opacity-50';

/** Roles the server allows to approve or reject archive requests (server/suAccess.ts holds the enforced list). */
const ARCHIVE_APPROVER_ROLES = ['Super Admin', 'Admin', 'Regional Manager'];

/** Who the signed-in user is, for showing or hiding controls. The server re-checks every action. */
export function useSuActor() {
  const { currentUserRole, currentUserName, authProfile, rolePermissions } = useApp();
  const role = currentUserRole as string;
  return {
    role,
    name: currentUserName || 'Authenticated Staff',
    userId: (authProfile as any)?.id as string | undefined,
    isManager: canViewNhsNumber(role),
    canEdit: canEditSuTrackers(role),
    canRequestArchive: canViewNhsNumber(role) && (rolePermissions?.[currentUserRole]?.canArchiveRestore ?? false),
    canDecideArchive: ARCHIVE_APPROVER_ROLES.includes(role)
  };
}

export const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode; hint?: string }> = ({ label, required, children, hint }) => (
  <div>
    <label className="block text-neutral-600 font-medium mb-1 text-xs">{label}{required && <span className="text-red-500"> *</span>}</label>
    {children}
    {hint && <p className="mt-1 text-[10px] text-neutral-500">{hint}</p>}
  </div>
);

export const ErrorBanner: React.FC<{ message?: string }> = ({ message }) =>
  message ? <div role="alert" className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xs text-xs">{message}</div> : null;

export const Notice: React.FC<{ tone?: 'info' | 'warn' | 'ok'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const cls = tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800' : tone === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-sky-50 border-sky-200 text-sky-800';
  return <div className={`p-2.5 border rounded-xs text-xs ${cls}`}>{children}</div>;
};

export const StatusPill: React.FC<{ status: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }> = ({ status, tone = 'neutral' }) => {
  const cls = tone === 'good' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : tone === 'warn' ? 'bg-amber-50 text-amber-800 border-amber-200'
    : tone === 'bad' ? 'bg-rose-50 text-rose-800 border-rose-200'
    : 'bg-neutral-100 text-neutral-800 border-neutral-200';
  return <span className={`px-2 py-0.5 border rounded-xs text-[11px] font-semibold whitespace-nowrap ${cls}`}>{status}</span>;
};

/** A centred dialog with the same frame as the GP registration modal. */
export const SuModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label={title}>
    <div className={`bg-white rounded-xs border border-[#e5e5e5] shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[90vh] flex flex-col overflow-hidden`}>
      <div className="px-5 py-3.5 border-b border-[#e5e5e5] bg-[#faf9f8] flex items-center justify-between">
        <h3 className="font-bold text-sm text-[#242424]">{title}</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-5 space-y-3.5 overflow-y-auto text-xs">{children}</div>
    </div>
  </div>
);

export const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
};
export const fmtDateTime = (d?: string | null) => {
  if (!d) return '—';
  const t = new Date(d);
  return isNaN(t.getTime()) ? String(d) : t.toLocaleString('en-GB');
};
