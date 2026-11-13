import React, { useEffect, useId } from 'react';
import { IconX as CloseIcon, IconAlertCircle as AlertCircle } from '@tabler/icons-react';

/**
 * The shell every form modal uses: overlay, titled header with a close button, a body that scrolls on its own, and a
 * footer that stays in view with Cancel on the left of the primary action. Escape closes it.
 * Forms supply only their fields (as ModalFormSection blocks).
 */
interface StandardModalProps {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  /** When given, the body and footer form one <form>; the primary button submits it */
  onSubmit?: (e: React.FormEvent) => void;
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  /** Shown above the footer, e.g. a validation summary */
  error?: React.ReactNode;
  /** A strip between the header and the body (e.g. "Recording Check 1 of 2") */
  banner?: React.ReactNode;
  /** Extra header content on the right, before the close button */
  headerExtra?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

const WIDTH = { md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-4xl' } as const;

export const StandardModal: React.FC<StandardModalProps> = ({
  title, subtitle, icon, onClose, onSubmit, submitLabel = 'Save', cancelLabel = 'Cancel', submitting, error, banner, headerExtra, size = 'lg', children
}) => {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const body = (
    <>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">{children}</div>
      <div className="shrink-0 border-t border-[#e1dfdd] bg-white px-4 sm:px-6 py-3">
        {error && (
          <p role="alert" className="mb-2 flex items-start gap-1.5 text-xs text-red-700"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{error}</p>
        )}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-1.5 border border-neutral-300 text-neutral-700 rounded-xs hover:bg-neutral-100 transition-colors cursor-pointer text-xs font-medium">
            {cancelLabel}
          </button>
          {onSubmit && (
            <button type="submit" disabled={submitting} className="px-5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] disabled:opacity-60 text-white font-semibold rounded-xs transition-colors shadow-2xs cursor-pointer text-xs">
              {submitting ? 'Saving…' : submitLabel}
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-2 sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={`bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full ${WIDTH[size]} max-h-[94vh] flex flex-col`}>
        <div className="px-4 sm:px-6 py-3.5 border-b border-[#e1dfdd] bg-[#faf9f8] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon}
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-bold text-[#242424] truncate">{title}</h2>
              {subtitle && <p className="text-[11px] text-neutral-500 truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerExtra}
            <button type="button" aria-label="Close" onClick={onClose} className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors cursor-pointer">
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        {banner}
        {onSubmit ? <form onSubmit={onSubmit} noValidate className="flex-1 min-h-0 flex flex-col">{body}</form> : <div className="flex-1 min-h-0 flex flex-col">{body}</div>}
      </div>
    </div>
  );
};

/** A titled group of fields on a 12-column grid (two columns on wider screens, one on a phone). */
export const ModalFormSection: React.FC<{ title: string; number?: number; description?: string; children: React.ReactNode }> = ({ title, number, description, children }) => (
  <section className="bg-[#faf9f8] border border-[#e5e5e5] rounded-xs p-4 space-y-3">
    <div className="pb-1.5 border-b border-neutral-200">
      <h3 className="font-semibold text-neutral-800 text-xs">{number ? `${number}. ` : ''}{title}</h3>
      {description && <p className="text-[11px] text-neutral-500 mt-0.5">{description}</p>}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">{children}</div>
  </section>
);

/** One labelled field: label above, required mark, hint, error. `full` spans both columns (use for notes and long text). */
export const FormField: React.FC<{
  label: string; htmlFor?: string; required?: boolean; hint?: string; error?: string; full?: boolean; children: React.ReactNode;
}> = ({ label, htmlFor, required, hint, error, full, children }) => (
  <div className={full ? 'sm:col-span-2' : ''}>
    <label htmlFor={htmlFor} className="block font-medium text-neutral-700 mb-1">
      {label}{required && <span className="text-red-600" aria-hidden="true"> *</span>}
    </label>
    {children}
    {hint && !error && <p className="text-[10px] text-neutral-500 mt-0.5">{hint}</p>}
    {error && <p role="alert" className="text-red-600 text-[10px] mt-0.5">{error}</p>}
  </div>
);
