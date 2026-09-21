import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Search, Truck, AlertCircle, CheckCircle2, Phone, Mail, Hash, Check } from 'lucide-react';
import { financeService } from '../../services/financeService';
import type { FinanceVendor } from '../../types/finance';

interface FinanceSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSupplierAdded?: (supplier: FinanceVendor) => void;
  onSupplierDeleted?: (supplierId: string) => void;
  onSelectSupplier?: (supplier: FinanceVendor) => void;
}

export const FinanceSupplierModal: React.FC<FinanceSupplierModalProps> = ({
  isOpen,
  onClose,
  onSupplierAdded,
  onSupplierDeleted,
  onSelectSupplier
}) => {
  const [suppliers, setSuppliers] = useState<FinanceVendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New Supplier Form
  const [name, setName] = useState('');
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const loadSuppliers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await financeService.getSuppliers();
      const cleanData = (data || []).filter(s => 
        !s.id.startsWith('fven-') &&
        !s.vendorName.includes('Apex Facilities') &&
        !s.vendorName.includes('Direct Site Supplies')
      );
      setSuppliers(cleanData);
    } catch (err: any) {
      setError('Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
      setName('');
      setReference('');
      setEmail('');
      setPhone('');
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredSuppliers = suppliers.filter(s =>
    (s.vendorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.vendorReference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.contactEmail || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a supplier name');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await financeService.saveSupplier({
        name: name.trim(),
        reference: reference.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined
      });

      if (res.success && res.supplier) {
        const newSup = res.supplier;
        setSuppliers(prev => [newSup, ...prev]);
        setName('');
        setReference('');
        setEmail('');
        setPhone('');
        setSuccess(`Supplier "${newSup.vendorName}" registered successfully!`);
        if (onSupplierAdded) onSupplierAdded(newSup);
        if (onSelectSupplier) {
          onSelectSupplier(newSup);
          onClose();
        }
      } else {
        setError(res.error || 'Failed to save supplier');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (supplierId: string, supplierName: string) => {
    if (!window.confirm(`Are you sure you want to remove "${supplierName}"?`)) return;

    setDeletingId(supplierId);
    setError(null);
    try {
      const res = await financeService.deleteSupplier(supplierId);
      if (res.success) {
        setSuppliers(prev => prev.filter(s => s.id !== supplierId));
        setSuccess(`Supplier "${supplierName}" removed.`);
        if (onSupplierDeleted) onSupplierDeleted(supplierId);
      } else {
        setError(res.error || 'Failed to delete supplier');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting supplier');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white border border-[#edebe9] rounded-xs shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#edebe9] bg-[#f8f8f7]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#f0fdf4] text-emerald-700 rounded-xs border border-emerald-200">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#242424]">Manage Suppliers</h2>
              <p className="text-xs text-[#605e5c]">
                Add, manage, and select approved goods suppliers, couriers, and contractors
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#605e5c] hover:text-[#242424] p-1 rounded-xs transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xs border border-red-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-xs border border-emerald-200 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Add Supplier Form */}
          <div className="bg-[#f9f9f8] p-4 rounded-xs border border-[#e1dfdd] space-y-3">
            <h3 className="font-semibold text-xs text-[#242424] flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>Register New Supplier</span>
            </h3>

            <form onSubmit={handleAddSupplier} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#323130] mb-1">
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Booker Wholesale, Bidfood, DPD..."
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#8a8886] rounded-xs focus:outline-none focus:border-[#0d9488]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#323130] mb-1">
                  Reference / Code (Optional)
                </label>
                <div className="relative">
                  <Hash className="w-3.5 h-3.5 text-[#8a8886] absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="e.g. SUP-BOOKER-01"
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-[#8a8886] rounded-xs focus:outline-none focus:border-[#0d9488]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#323130] mb-1">
                  Contact Email (Optional)
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[#8a8886] absolute left-2.5 top-2" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="orders@supplier.co.uk"
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-[#8a8886] rounded-xs focus:outline-none focus:border-[#0d9488]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#323130] mb-1">
                  Contact Phone (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-[#8a8886] absolute left-2.5 top-2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+44 20 ..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-[#8a8886] rounded-xs focus:outline-none focus:border-[#0d9488]"
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold rounded-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Saving...' : 'Register & Select'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Suppliers Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-xs text-[#242424]">
                Registered Suppliers ({filteredSuppliers.length})
              </span>
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-[#8a8886] absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search suppliers..."
                  className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-[#8a8886] rounded-xs focus:outline-none focus:border-[#0d9488]"
                />
              </div>
            </div>

            <div className="border border-[#e1dfdd] rounded-xs overflow-hidden bg-white max-h-60 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#f3f2f1] text-[#242424] font-semibold border-b border-[#edebe9] sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Supplier Name</th>
                    <th className="py-2 px-3">Reference #</th>
                    <th className="py-2 px-3">Contact</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edebe9]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#605e5c]">
                        Loading suppliers...
                      </td>
                    </tr>
                  ) : filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#605e5c]">
                        No suppliers found. Use the form above to register one.
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map(s => (
                      <tr key={s.id} className="hover:bg-[#f9f9f8]">
                        <td className="py-2 px-3 font-semibold text-[#242424]">{s.vendorName}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-[#605e5c]">{s.vendorReference || '—'}</td>
                        <td className="py-2 px-3 text-[#605e5c]">
                          {s.contactEmail || s.contactPhone || '—'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {onSelectSupplier && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectSupplier(s);
                                  onClose();
                                }}
                                className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-[#0d9488] font-semibold rounded-xs border border-teal-200 transition-colors cursor-pointer text-[11px] flex items-center gap-1"
                                title="Use this supplier in form"
                              >
                                <Check className="w-3 h-3" />
                                <span>Select</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(s.id, s.vendorName)}
                              disabled={deletingId === s.id}
                              className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xs transition-colors cursor-pointer disabled:opacity-40"
                              title="Remove Supplier"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#edebe9] bg-[#f8f8f7] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
