import React, { useState, useEffect } from 'react';
import { X, Building2, CheckCircle2, AlertCircle, Loader2, Upload, FileText } from 'lucide-react';
import { financeService } from '../../services/financeService';
import type { FinanceVendor } from '../../types/finance';

interface FinanceVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vendorToEdit?: FinanceVendor | null;
}

export const FinanceVendorModal: React.FC<FinanceVendorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vendorToEdit
}) => {
  const [vendorName, setVendorName] = useState('');
  const [vendorReference, setVendorReference] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [bankSortCode, setBankSortCode] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [vendorDocument, setVendorDocument] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vendorToEdit) {
      setVendorName(vendorToEdit.vendorName || '');
      setVendorReference(vendorToEdit.vendorReference || '');
      setContactEmail(vendorToEdit.contactEmail || '');
      setContactPhone(vendorToEdit.contactPhone || '');
      setStatus(vendorToEdit.status || 'active');
      const pd = vendorToEdit.paymentDetails || {};
      setBankSortCode(pd.sortCode || pd.sort_code || '');
      setBankAccountNumber(pd.accountNumber || pd.account_number || '');
      setNotes(pd.notes || '');
      setVendorDocument(null);
    } else {
      setVendorName('');
      setVendorReference('');
      setContactEmail('');
      setContactPhone('');
      setStatus('active');
      setBankSortCode('');
      setBankAccountNumber('');
      setNotes('');
      setVendorDocument(null);
    }
    setError(null);
  }, [vendorToEdit, isOpen]);

  if (!isOpen) return null;

  const handleClearOrRevert = () => {
    if (vendorToEdit) {
      setVendorName(vendorToEdit.vendorName || '');
      setVendorReference(vendorToEdit.vendorReference || '');
      setContactEmail(vendorToEdit.contactEmail || '');
      setContactPhone(vendorToEdit.contactPhone || '');
      setStatus(vendorToEdit.status || 'active');
      const pd = vendorToEdit.paymentDetails || {};
      setBankSortCode(pd.sortCode || pd.sort_code || '');
      setBankAccountNumber(pd.accountNumber || pd.account_number || '');
      setNotes(pd.notes || '');
    } else {
      setVendorName('');
      setVendorReference('');
      setContactEmail('');
      setContactPhone('');
      setStatus('active');
      setBankSortCode('');
      setBankAccountNumber('');
      setNotes('');
    }
    setVendorDocument(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) {
      setError('Vendor name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const paymentDetails = {
        sortCode: bankSortCode.trim() || undefined,
        accountNumber: bankAccountNumber.trim() || undefined,
        notes: notes.trim() || undefined
      };

      const res = await financeService.saveVendor({
        id: vendorToEdit?.id,
        vendorName: vendorName.trim(),
        vendorReference: vendorReference.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        paymentDetails,
        status
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to save vendor');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving vendor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#faf9f8]">
          <div>
            <h3 className="text-base font-semibold text-[#242424] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0d9488]" />
              <span>{vendorToEdit ? 'Edit Vendor / Supplier' : 'Add New Vendor'}</span>
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Register supplier profile, billing reference, and remittance details.
            </p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: 2-Column Responsive Grid */}
          <div className="space-y-3">
            <div className="pb-1 border-b border-neutral-200">
              <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Vendor Profile &amp; Contact Details
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Vendor Name */}
              <div className="sm:col-span-2 space-y-1">
                <label className="font-semibold text-[#605e5c] flex items-center justify-between mb-1">
                  <span>Vendor / Business Name <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={e => setVendorName(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. Apex Commercial Catering Supplies Ltd"
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                />
              </div>

              {/* Vendor Reference */}
              <div className="space-y-1">
                <label className="font-semibold text-[#605e5c] flex items-center justify-between mb-1">
                  <span>Vendor Account Reference</span>
                </label>
                <input
                  type="text"
                  value={vendorReference}
                  onChange={e => setVendorReference(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. APEX-UK-089"
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                />
              </div>

              {/* Operational Status */}
              <div className="space-y-1">
                <label className="font-semibold text-[#605e5c] flex items-center justify-between mb-1">
                  <span>Operational Status</span>
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as 'active' | 'inactive')}
                  disabled={isSubmitting}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Contact Email */}
              <div className="space-y-1">
                <label className="font-semibold text-[#605e5c] flex items-center justify-between mb-1">
                  <span>Accounts / Contact Email</span>
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="billing@vendor.co.uk"
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="font-semibold text-[#605e5c] flex items-center justify-between mb-1">
                  <span>Phone Number</span>
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="+44 20 7946 0912"
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section Divider */}
          <div className="border-t border-[#e1dfdd]" />

          {/* Section 2: Content Card for Remittance & Banking Details */}
          <div className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-3">
            <div className="pb-1 border-b border-neutral-200">
              <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Remittance &amp; Payment Details
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-[#605e5c] block mb-1">Bank Sort Code</label>
                <input
                  type="text"
                  value={bankSortCode}
                  onChange={e => setBankSortCode(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. 20-00-00"
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#605e5c] block mb-1">Account Number</label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={e => setBankAccountNumber(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. 12345678"
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-semibold text-[#605e5c] block mb-1">Remittance Instructions / Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Payment terms, BACS instructions, special requirements..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs resize-y"
                />
              </div>

              {/* Dashed Drop Zone for Vendor Document / Agreement */}
              <div className="sm:col-span-2 space-y-1">
                <label className="font-semibold text-[#605e5c] block mb-1">Supplier Agreement / W9 Form (Optional)</label>
                <label className="border-2 border-dashed border-[#8a8886]/40 hover:border-[#0d9488] bg-white rounded-xs p-5 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group">
                  <Upload className="w-5 h-5 text-neutral-400 group-hover:text-[#0d9488] transition-colors mb-1" />
                  <span className="text-xs font-semibold text-[#323130]">
                    {vendorDocument ? vendorDocument.name : 'Attach Supplier Agreement or Tax Certificate'}
                  </span>
                  <span className="text-[11px] text-neutral-500 mt-0.5">PDF or image up to 10MB</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    disabled={isSubmitting}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setVendorDocument(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#e1dfdd] flex items-center justify-between">
            <button
              type="button"
              onClick={handleClearOrRevert}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-xs hover:bg-neutral-100 transition-colors cursor-pointer"
              title={vendorToEdit ? "Revert unsaved changes to original values" : "Clear all fields"}
            >
              {vendorToEdit ? 'Revert Changes' : 'Clear Form'}
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
                    <span>{vendorToEdit ? 'Save Changes' : 'Save Vendor'}</span>
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
