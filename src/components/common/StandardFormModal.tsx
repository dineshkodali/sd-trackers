import React, { useState } from 'react';
import { X, FileText, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export interface StandardFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void> | void;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  children?: React.ReactNode;
}

/**
 * StandardFormModal
 *
 * Canonical UI Brand Kit modal component implementing the reference layout:
 * - Centered overlay (backdrop blur)
 * - Rounded-xs container with border [#e1dfdd] and shadow-2xl
 * - Header with title, subtitle, and close [✕] button
 * - Scrollable body with support for 2-column grids, section dividers, and content cards
 * - Standardized 3-button footer: Left Secondary Action (Clear/Revert) + Right (Cancel + Primary Submit)
 */
export const StandardFormModal: React.FC<StandardFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title = 'Form Record',
  subtitle = 'Submit and track operational records using the standard brand kit pattern.',
  submitLabel = 'Submit',
  children
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(e);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#faf9f8] shrink-0">
          <div>
            <h3 className="text-base font-semibold text-[#242424] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0d9488]" />
              <span>{title}</span>
            </h3>
            {subtitle && (
              <p className="text-[11px] text-neutral-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {children}

          {/* Standard 3-Button Footer */}
          <div className="pt-4 border-t border-[#e1dfdd] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const form = document.querySelector('form');
                if (form) form.reset();
                setError(null);
              }}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-xs hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              Clear Form
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold transition-colors cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{submitLabel}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
