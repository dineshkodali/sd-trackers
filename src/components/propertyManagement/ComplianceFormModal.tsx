import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';
import { suPropertyDetailsService } from '../../services/suPropertyDetailsService';
import { PropertyCompliance } from '../../types/masterData';

interface ComplianceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  complianceToEdit?: PropertyCompliance | null;
  onSuccess: () => void;
}

export const ComplianceFormModal: React.FC<ComplianceFormModalProps> = ({
  isOpen,
  onClose,
  propertyId,
  complianceToEdit,
  onSuccess
}) => {
  const [type, setType] = useState('Gas Safety');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [inspectionDate, setInspectionDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [provider, setProvider] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (complianceToEdit) {
        setType(complianceToEdit.type);
        setCertificateNumber(complianceToEdit.certificateNumber || '');
        setInspectionDate(complianceToEdit.inspectionDate || '');
        setExpiryDate(complianceToEdit.expiryDate || '');
        setProvider(complianceToEdit.provider || '');
        setNotes(complianceToEdit.notes || '');
      } else {
        setType('Gas Safety');
        setCertificateNumber('');
        setInspectionDate(new Date().toISOString().split('T')[0]);
        // Default expiry 1 year ahead
        const exp = new Date();
        exp.setFullYear(exp.getFullYear() + 1);
        setExpiryDate(exp.toISOString().split('T')[0]);
        setProvider('');
        setNotes('');
      }
      setErrorMsg('');
    }
  }, [isOpen, complianceToEdit]);

  if (!isOpen) return null;

  // Auto-calculate status based on expiryDate
  const calculateStatus = (expDate?: string): PropertyCompliance['status'] => {
    if (!expDate) return 'Missing';
    const now = new Date();
    const expiry = new Date(expDate);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Expired';
    if (diffDays <= 30) return 'Expiring Soon';
    return 'Valid';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type.trim()) {
      setErrorMsg('Compliance type is required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const status = calculateStatus(expiryDate);
      const res = await suPropertyDetailsService.savePropertyCompliance({
        id: complianceToEdit?.id,
        propertyId,
        type,
        certificateNumber: certificateNumber.trim(),
        inspectionDate: inspectionDate || undefined,
        expiryDate: expiryDate || undefined,
        provider: provider.trim(),
        status,
        notes: notes.trim()
      });
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to save compliance record.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xs shadow-2xl w-full max-w-md border border-[#e5e5e5] overflow-hidden text-xs">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e5e5e5] bg-[#faf9f8]">
          <h3 className="font-bold text-neutral-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0d9488]" />
            <span>{complianceToEdit ? 'Edit Compliance Certificate' : 'Add Compliance Certificate'}</span>
          </h3>
          <button onClick={onClose} className="p-1 rounded-xs text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 bg-red-50 text-red-700 rounded-xs border border-red-200 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-neutral-600 font-medium mb-1">Compliance Type *</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            >
              <option value="Gas Safety">Gas Safety (CP12)</option>
              <option value="Electrical Safety">Electrical Safety (EICR)</option>
              <option value="EPC">Energy Performance (EPC)</option>
              <option value="Fire Safety">Fire Safety / Alarm Testing</option>
              <option value="Fire Risk Assessment">Fire Risk Assessment (FRA)</option>
              <option value="Smoke Alarm">Smoke Alarm Verification</option>
              <option value="CO Alarm">Carbon Monoxide (CO) Alarm Verification</option>
              <option value="Legionella">Legionella Risk Assessment</option>
              <option value="Property Inspection">Periodic Property Inspection</option>
              <option value="Other">Other Certificate</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Certificate / URN</label>
              <input
                type="text"
                value={certificateNumber}
                onChange={e => setCertificateNumber(e.target.value)}
                placeholder="e.g. CP12-8829"
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488] font-mono"
              />
            </div>
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Provider / Inspector</label>
              <input
                type="text"
                value={provider}
                onChange={e => setProvider(e.target.value)}
                placeholder="e.g. British Gas, Direct Safe"
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Inspection Date</label>
              <input
                type="date"
                value={inspectionDate}
                onChange={e => setInspectionDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              />
            </div>
            <div>
              <label className="block text-neutral-600 font-medium mb-1">Expiry Date *</label>
              <input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-600 font-medium mb-1">Notes / Remedial Actions</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Remedial work completed on boiler valve before sign-off."
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e5e5e5]">
            <button type="button" onClick={onClose} className="px-3 py-1.5 border border-[#e5e5e5] rounded-xs text-neutral-600 hover:bg-neutral-100 cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 bg-[#0d9488] text-white rounded-xs font-semibold hover:bg-teal-700 cursor-pointer shadow-xs">
              {isSubmitting ? 'Saving...' : complianceToEdit ? 'Save Changes' : 'Add Compliance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
