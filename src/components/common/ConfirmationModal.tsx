import React, { useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ConfirmationModal: React.FC = () => {
  const { confirmModal, closeConfirmation } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && confirmModal) {
        closeConfirmation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmModal, closeConfirmation]);

  if (!confirmModal) return null;

  const {
    title,
    message,
    confirmLabel = 'Confirm Action',
    cancelLabel = 'Cancel',
    isDanger = false,
    itemDetails,
    onConfirm,
    onCancel
  } = confirmModal;

  const handleCancel = () => {
    if (onCancel) onCancel();
    closeConfirmation();
  };

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <div 
      id="confirmation-modal-backdrop" 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-150"
      onClick={handleCancel}
    >
      <div 
        id="confirmation-modal-card"
        className="relative w-full max-w-lg bg-white rounded shadow-2xl border border-[#e1dfdd] overflow-hidden transform transition-all text-[#242424]"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        {/* Header bar */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${isDanger ? 'bg-red-50/80 border-red-200 text-red-900' : 'bg-[#f3f8fd] border-[#e1dfdd] text-[#0f766e]'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isDanger ? 'bg-red-100 text-red-700' : 'bg-[#0d9488]/10 text-[#0d9488]'}`}>
              {isDanger ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="confirm-dialog-title" className="text-base font-semibold tracking-tight">
                {title}
              </h3>
              <p className="text-xs text-neutral-500 font-normal mt-0.5">
                {isDanger ? 'Strict audit confirmation required' : 'Review & confirm submission'}
              </p>
            </div>
          </div>
          <button 
            id="btn-close-modal"
            onClick={handleCancel}
            className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-[#323130] leading-relaxed">
            {message}
          </p>

          {itemDetails && itemDetails.length > 0 && (
            <div className="bg-[#faf9f8] border border-[#edebe9] rounded p-3 text-xs space-y-1.5">
              <div className="font-semibold text-neutral-600 mb-2 border-b border-[#edebe9] pb-1">
                Record Summary & Metadata
              </div>
              {itemDetails.map((detail, idx) => (
                <div key={idx} className="flex justify-between items-start py-0.5">
                  <span className="text-neutral-500 font-medium">{detail.label}:</span>
                  <span className="text-neutral-800 font-semibold text-right max-w-[65%] truncate">
                    {detail.value || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {isDanger && (
            <div className="flex items-start gap-2.5 p-3 text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Audit Compliance Warning:</strong> This operation is logged permanently with your user ID and active role in the audit logs.
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#f8f9fa] border-t border-[#edebe9] flex items-center justify-end gap-3">
          <button
            id="btn-cancel-modal"
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-xs font-semibold text-[#323130] bg-white border border-[#8a8886] rounded hover:bg-[#edebe9] transition-colors focus:outline-none focus:ring-2 focus:ring-[#71afe5]"
          >
            {cancelLabel}
          </button>
          <button
            id="btn-confirm-modal"
            type="button"
            onClick={handleConfirm}
            className={`px-4 py-2 text-xs font-semibold rounded text-white transition-colors focus:outline-none focus:ring-2 ${
              isDanger 
                ? 'bg-[#a4262c] hover:bg-[#8f1f25] focus:ring-red-300' 
                : 'bg-[#0d9488] hover:bg-[#0f766e] focus:ring-[#71afe5]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
