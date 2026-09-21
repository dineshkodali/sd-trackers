import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  Lock, 
  Loader2,
  Truck,
  ShieldCheck,
  CreditCard,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { financeService } from '../../services/financeService';
import { FinanceSupplierModal } from './FinanceSupplierModal';
import { ManageableSelect } from '../common/ManageableSelect';
import type { FinanceBill, FinanceBillItem, FinanceBillType, FinanceVendor } from '../../types/finance';

interface FinanceBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  billToEdit?: FinanceBill | null;
  vendors: FinanceVendor[];
  defaultBillType?: FinanceBillType;
  title?: string;
}

export const FinanceBillModal: React.FC<FinanceBillModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  billToEdit,
  vendors: initialVendors,
  defaultBillType = 'vendor_invoice',
  title
}) => {
  const { properties, assignedSite, canAccessAllSites, authProfile, currentUserRole } = useApp();

  const isEmployee = authProfile?.role === 'Employee' || authProfile?.role === 'Staff';

  // Strict page bill type (locked to the specific page)
  const billType: FinanceBillType = billToEdit?.billType || defaultBillType;

  // Base state
  const [siteId, setSiteId] = useState<string>('');
  const [vendorId, setVendorId] = useState<string>('');
  const [vendorName, setVendorName] = useState<string>('');
  const [billNumber, setBillNumber] = useState<string>('');
  const [billDate, setBillDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [purchaseReference, setPurchaseReference] = useState<string>('');

  // Amounts
  const [totalAmountInput, setTotalAmountInput] = useState<number>(0);
  const [subtotalInput, setSubtotalInput] = useState<number>(0);
  const [taxAmountInput, setTaxAmountInput] = useState<number>(0);

  // Delivery-specific state
  const [deliveryCondition, setDeliveryCondition] = useState<'good' | 'damaged'>('good');

  // Credit card specific state
  const [cardReference, setCardReference] = useState<string>('');

  // Optional itemized line items breakdown
  const [showItemizedLines, setShowItemizedLines] = useState<boolean>(false);
  const [items, setItems] = useState<Array<{ description: string; quantity: number; unitPrice: number; taxAmount: number }>>([
    { description: 'Goods / Services', quantity: 1, unitPrice: 0, taxAmount: 0 }
  ]);

  // Suppliers state
  const [allVendors, setAllVendors] = useState<FinanceVendor[]>(() => {
    return (initialVendors || []).filter(v => 
      !v.id.startsWith('fven-') && 
      !v.vendorName.includes('Apex Facilities') && 
      !v.vendorName.includes('Direct Site Supplies')
    );
  });
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  // Approval Routing
  const [approvers, setApprovers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [routeToApproval, setRouteToApproval] = useState(true);
  const [selectedApproverId, setSelectedApproverId] = useState<string>('');
  const [approvalNotes, setApprovalNotes] = useState<string>('');

  // Attachments
  const [files, setFiles] = useState<Array<{ file: File; type: any }>>([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableProperties = useMemo(() => {
    if (canAccessAllSites()) return properties;
    return properties.filter(p => p.id === assignedSite || p.name === assignedSite);
  }, [properties, assignedSite, canAccessAllSites]);

  // Sync vendors and approvers on open
  useEffect(() => {
    if (!isOpen) return;

    financeService.getVendors().then(v => {
      if (v) {
        const clean = v.filter(item => 
          !item.id.startsWith('fven-') && 
          !item.vendorName.includes('Apex Facilities') && 
          !item.vendorName.includes('Direct Site Supplies')
        );
        setAllVendors(clean);
      }
    });

    financeService.getApprovers().then(list => {
      if (list && list.length > 0) {
        setApprovers(list);
        if (!selectedApproverId) {
          const rm = list.find(a => a.role === 'Regional Manager') || list[0];
          if (rm) setSelectedApproverId(rm.id);
        }
      }
    });
  }, [isOpen]);

  // Hydrate fields on open or edit
  useEffect(() => {
    if (!isOpen) return;

    if (billToEdit) {
      setSiteId(billToEdit.siteId);
      setVendorId(billToEdit.vendorId || '');
      setVendorName(billToEdit.vendorName || '');
      setBillNumber(billToEdit.billNumber);
      setBillDate(billToEdit.billDate);
      setDueDate(billToEdit.dueDate || '');
      setDescription(billToEdit.description || '');
      setPurchaseReference(billToEdit.purchaseReference || '');
      const editTotal = Number(billToEdit.totalAmount || 0);
      const editTax = Number(billToEdit.taxAmount || 0);
      const editSub = billToEdit.billType === 'credit_card_expense' 
        ? editTotal 
        : (billToEdit.subtotal !== undefined ? Number(billToEdit.subtotal) : (editTotal - editTax));

      setTotalAmountInput(editTotal);
      setSubtotalInput(editSub);
      setTaxAmountInput(editTax);
      setRouteToApproval(billToEdit.status === 'awaiting_approval' || billToEdit.status === 'submitted');
      if (billToEdit.assignedApproverId) setSelectedApproverId(billToEdit.assignedApproverId);
      if (billToEdit.items && billToEdit.items.length > 0) {
        setItems(billToEdit.items.map(i => {
          const q = Number(i.quantity || 1);
          let u = Number(i.unitPrice ?? 0);
          const t = Number(i.taxAmount ?? 0);
          const lt = Number(i.lineTotal ?? (q * u + t));
          if (q === 1 && lt > 0 && (u === 0 || Math.abs(u + t - lt) > 0.01)) {
            u = Number((lt - t).toFixed(2));
          }
          return {
            description: i.description,
            quantity: q,
            unitPrice: u,
            taxAmount: t
          };
        }));
        setShowItemizedLines(billToEdit.items.length > 1);
      }
    } else {
      const prefix = billType === 'credit_card_expense' ? 'CC' : billType === 'delivery_note' ? 'DN' : 'INV';
      setSiteId(availableProperties[0]?.id || assignedSite || '');
      setVendorId('');
      setVendorName('');
      setBillNumber(`${prefix}-${Date.now().toString().slice(-6)}`);
      setBillDate(new Date().toISOString().split('T')[0]);
      setDueDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
      setDescription('');
      setPurchaseReference('');
      setTotalAmountInput(0);
      setSubtotalInput(0);
      setTaxAmountInput(0);
      setDeliveryCondition('good');
      setCardReference('');
      setRouteToApproval(true);
      setApprovalNotes('');
      setShowItemizedLines(false);
      setItems([{ description: 'Goods / Services', quantity: 1, unitPrice: 0, taxAmount: 0 }]);
      setFiles([]);
    }
    setError(null);
  }, [billToEdit, isOpen, billType, availableProperties, assignedSite]);

  if (!isOpen) return null;

  const handleVendorChange = (selectedId: string) => {
    const selected = allVendors.find(v => v.id === selectedId);
    setVendorId(selectedId);
    setVendorName(selected?.vendorName || '');
  };

  // Amount auto-balancing for invoices
  const handleTotalChange = (val: number) => {
    setTotalAmountInput(val);
    if (taxAmountInput === 0) {
      setSubtotalInput(val);
    } else {
      setSubtotalInput(Number(Math.max(0, val - taxAmountInput).toFixed(2)));
    }
  };

  const handleSubtotalChange = (val: number) => {
    setSubtotalInput(val);
    setTotalAmountInput(Number((val + (taxAmountInput || 0)).toFixed(2)));
  };

  const handleTaxChange = (val: number) => {
    setTaxAmountInput(val);
    setTotalAmountInput(Number(((subtotalInput || 0) + val).toFixed(2)));
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0, taxAmount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems(prev => {
      const updated = prev.map((item, i) => i === index ? { ...item, [field]: value } : item);
      const newSub = updated.reduce((sum, item) => sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0);
      const newTax = updated.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
      setSubtotalInput(Number(newSub.toFixed(2)));
      setTaxAmountInput(Number(newTax.toFixed(2)));
      setTotalAmountInput(Number((newSub + newTax).toFixed(2)));
      return updated;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      const uploadType = billType === 'delivery_note' 
        ? 'delivery_note' 
        : billType === 'credit_card_expense' 
        ? 'credit_card_receipt' 
        : 'vendor_invoice';
      const newFiles = selected.map(f => ({ file: f, type: uploadType }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId) {
      setError('Please select a property / site.');
      return;
    }
    if (!billNumber.trim()) {
      setError('Reference / ticket number is required.');
      return;
    }
    if (!vendorName.trim()) {
      setError(billType === 'delivery_note' ? 'Please enter the supplier / carrier name.' : billType === 'credit_card_expense' ? 'Please enter the merchant / store name.' : 'Please enter the supplier / vendor name.');
      return;
    }

    // Amounts validation
    if (totalAmountInput <= 0) {
      setError('Total amount must be greater than £0.00');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const selectedProperty = availableProperties.find(p => p.id === siteId || p.name === siteId);
      const resolvedSiteName = selectedProperty?.name || siteId;
      const billStatus = routeToApproval ? 'awaiting_approval' : (billToEdit?.status || 'submitted');

      // Notes composition
      let finalDescription = description.trim();
      if (billType === 'delivery_note') {
        finalDescription = `[Condition: ${deliveryCondition === 'good' ? 'Good Order' : 'Damaged / Discrepancy'}] ${finalDescription}`;
      } else if (billType === 'credit_card_expense' && cardReference.trim()) {
        finalDescription = `[Card Ref: ${cardReference.trim()}] ${finalDescription}`;
      }

      // Compute final financial values
      let finalTax = Number((taxAmountInput || 0).toFixed(2));
      let finalTotal = Number((totalAmountInput || 0).toFixed(2));
      let finalSubtotal = Number((subtotalInput || 0).toFixed(2));

      if (billType === 'credit_card_expense') {
        finalTax = 0;
        finalSubtotal = finalTotal;
      } else {
        // Vendor invoice
        if (finalTax === 0) {
          finalSubtotal = finalTotal;
        } else if (Math.abs((finalSubtotal + finalTax) - finalTotal) > 0.01) {
          finalSubtotal = Number(Math.max(0, finalTotal - finalTax).toFixed(2));
        }
      }

      // Prepare line items
      let finalItems: Partial<FinanceBillItem>[] = [];
      if (showItemizedLines && items.length > 0) {
        finalItems = items.map(it => {
          const qty = Number(it.quantity || 1);
          const uPrice = Number(it.unitPrice || 0);
          const tax = Number(it.taxAmount || 0);
          return {
            description: it.description || (billType === 'delivery_note' ? 'Delivered Goods' : 'Expense item'),
            quantity: qty,
            unitPrice: uPrice,
            taxAmount: tax,
            lineTotal: Number(((qty * uPrice) + tax).toFixed(2))
          };
        });
      } else {
        finalItems = [{
          description: finalDescription || (billType === 'delivery_note' ? 'Goods Received' : billType === 'credit_card_expense' ? 'Card Transaction' : 'Vendor Services'),
          quantity: 1,
          unitPrice: finalSubtotal,
          taxAmount: finalTax,
          lineTotal: finalTotal
        }];
      }

      const billData: Partial<FinanceBill> = {
        siteId,
        siteName: resolvedSiteName,
        vendorId: vendorId || undefined,
        vendorName: vendorName.trim(),
        billNumber: billNumber.trim(),
        billType,
        billDate,
        dueDate: billType === 'vendor_invoice' ? (dueDate || undefined) : undefined,
        currency: 'GBP',
        subtotal: finalSubtotal,
        taxAmount: finalTax,
        totalAmount: finalTotal,
        description: finalDescription,
        purchaseReference: purchaseReference.trim() || undefined,
        submittedBy: authProfile?.id || '00000000-0000-0000-0000-000000000000',
        status: billStatus
      };

      let result: { success: boolean; billId?: string; error?: string };
      if (billToEdit) {
        const updateRes = await financeService.updateBill(billToEdit.id, billData, finalItems);
        result = { success: updateRes.success, billId: billToEdit.id, error: updateRes.error };
      } else {
        result = await financeService.createBill(billData, finalItems);
      }

      if (!result.success || !result.billId) {
        throw new Error(result.error || 'Failed to submit record');
      }

      // If routed to approval, record approver and concern notes
      if (routeToApproval && result.billId) {
        const targetApprover = approvers.find(a => a.id === selectedApproverId);
        await financeService.requestApproval(
          result.billId,
          selectedApproverId || undefined,
          targetApprover?.name || undefined,
          approvalNotes.trim() || (isEmployee ? 'Submitted by site staff for review' : undefined)
        );
      }

      // Upload files if any
      if (files.length > 0) {
        for (const f of files) {
          await financeService.uploadAttachment(
            result.billId,
            f.file,
            f.type,
            authProfile?.id || '00000000-0000-0000-0000-000000000000',
            authProfile?.name || 'Staff'
          );
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form title resolution
  const resolvedTitle = title || (
    billToEdit 
      ? (billType === 'delivery_note' ? 'Edit Site Delivery Note' : billType === 'credit_card_expense' ? 'Edit Card Expense' : 'Edit Vendor Invoice')
      : (billType === 'delivery_note' ? 'Log Site Delivery Note' : billType === 'credit_card_expense' ? 'Log Corporate Card Expense' : 'Upload Vendor Invoice')
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
        <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#faf9f8] shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-xs ${
                  billType === 'delivery_note' ? 'bg-amber-100 text-amber-800' :
                  billType === 'credit_card_expense' ? 'bg-indigo-100 text-indigo-800' :
                  'bg-teal-100 text-[#0d9488]'
                }`}>
                  {billType === 'delivery_note' ? <Truck className="w-4 h-4" /> :
                   billType === 'credit_card_expense' ? <CreditCard className="w-4 h-4" /> :
                   <FileText className="w-4 h-4" />}
                </div>
                <h3 className="text-base font-bold text-[#242424]">
                  {resolvedTitle}
                </h3>
              </div>
              <p className="text-[11px] text-[#605e5c] mt-0.5 ml-7">
                {billType === 'delivery_note' 
                  ? 'Record goods arrival at site and attach the signed courier/supplier docket'
                  : billType === 'credit_card_expense'
                  ? 'Log direct card transactions, purchases, and attach photographic proof of receipt'
                  : 'Submit official supplier invoices for review, site sign-off, and payout authorization'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#605e5c] hover:text-[#242424] p-1 rounded-xs transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Scroll Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            
            {/* Staff notice */}
            {isEmployee && (
              <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-xs flex items-center gap-2.5 text-teal-950">
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="text-[11px]">
                  <strong>Site Staff Mode:</strong> Fill in the details below and upload your ticket/document. Your record will be routed to your Regional Manager for verification.
                </span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Property / Site & Vendor / Supplier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Property / Site */}
              <div className="space-y-1">
                <label className="font-semibold text-[#605e5c] flex items-center justify-between mb-1">
                  <span>Property / Site <span className="text-red-500">*</span></span>
                </label>
                {isEmployee && assignedSite ? (
                  <div className="relative">
                    <input
                      type="text"
                      disabled
                      value={availableProperties.find(p => p.id === assignedSite || p.name === assignedSite)?.name || assignedSite}
                      className="w-full p-2 pr-8 border border-teal-200 rounded-xs bg-teal-50/50 text-teal-950 font-medium cursor-not-allowed text-xs"
                    />
                    <Lock className="w-3.5 h-3.5 text-teal-600 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                ) : (
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-[#8a8886] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <select
                      value={siteId}
                      onChange={e => setSiteId(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="w-full pl-8 p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                    >
                      <option value="">Select Property...</option>
                      {availableProperties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Supplier / Vendor / Merchant */}
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#605e5c]">
                    <span>
                      {billType === 'delivery_note' ? 'Supplier / Carrier Name' :
                       billType === 'credit_card_expense' ? 'Merchant / Store Name' :
                       'Supplier / Vendor Name'} <span className="text-red-500">*</span>
                    </span>
                  </label>
                  {billType !== 'credit_card_expense' && (
                    <button
                      type="button"
                      onClick={() => setIsSupplierModalOpen(true)}
                      className="text-[10px] text-[#0d9488] hover:text-[#0f766e] font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <Truck className="w-3 h-3" />
                      <span>Manage Suppliers</span>
                    </button>
                  )}
                </div>
{billType === 'credit_card_expense' ? (
                  <ManageableSelect
                    label="Merchant / Store"
                    value={vendorName}
                    onChange={value => {
                      setVendorName(value);
                      setVendorId('');
                    }}
                    optionCategory="financeCardMerchants"
                    allowQuickAdd={['Super Admin', 'Admin'].includes(authProfile?.role || currentUserRole)}
                    showManageActions={['Super Admin', 'Admin'].includes(authProfile?.role || currentUserRole)}
                    required
                    disabled={isSubmitting}
                    placeholder="Select merchant / store..."
                  />
                ) : (
                  <select
                    value={vendorId}
                    onChange={e => handleVendorChange(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs font-medium"
                  >
                    <option value="">Select supplier / vendor...</option>
                    {allVendors.map(v => (
                      <option key={v.id} value={v.id}>{v.vendorName}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* CONDITIONAL SECTION: DELIVERY NOTES                                        */}
            {/* ========================================================================= */}
            {billType === 'delivery_note' && (
              <div className="space-y-4 border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Delivery Note / Consignment # <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={billNumber}
                      onChange={e => setBillNumber(e.target.value)}
                      required
                      placeholder="e.g. DN-90412 or tracking ref"
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Date Delivered <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={billDate}
                      onChange={e => setBillDate(e.target.value)}
                      required
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      PO / Goods Inward Reference (Optional)
                    </label>
                    <input
                      type="text"
                      value={purchaseReference}
                      onChange={e => setPurchaseReference(e.target.value)}
                      placeholder="e.g. PO-2026-0881"
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Condition on Arrival
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setDeliveryCondition('good')}
                        className={`flex-1 py-1.5 px-2 rounded-xs font-semibold text-center border transition-colors cursor-pointer text-[11px] ${
                          deliveryCondition === 'good'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                            : 'bg-white border-[#8a8886]/40 text-[#605e5c]'
                        }`}
                      >
                        ✓ Goods in Good Order
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryCondition('damaged')}
                        className={`flex-1 py-1.5 px-2 rounded-xs font-semibold text-center border transition-colors cursor-pointer text-[11px] ${
                          deliveryCondition === 'damaged'
                            ? 'bg-red-50 border-red-500 text-red-800'
                            : 'bg-white border-[#8a8886]/40 text-[#605e5c]'
                        }`}
                      >
                        ⚠ Damaged / Discrepancy
                      </button>
                    </div>
                  </div>
                </div>

                {/* Delivery value and VAT inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-3 rounded-xs border border-[#e1dfdd]">
                  <div>
                    <label className="font-semibold text-[#0d9488] block mb-1">
                      Delivery Value (£) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-[#0d9488]">£</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={totalAmountInput || ''}
                        onChange={e => handleTotalChange(parseFloat(e.target.value) || 0)}
                        required
                        placeholder="0.00"
                        className="w-full pl-7 p-2 border border-[#0d9488] rounded-xs bg-teal-50/20 text-base font-extrabold text-[#0d9488]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">Subtotal (£)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400">£</span>
                      <input
                        type="number"
                        step="0.01"
                        value={subtotalInput || ''}
                        onChange={e => handleSubtotalChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full pl-7 p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">VAT / Tax (£)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400">£</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={taxAmountInput || ''}
                        onChange={e => handleTaxChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full pl-7 p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">
                    Goods Summary / Packages Received <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    required
                    placeholder="e.g. 14 crates food provisions, 4 boxes cleaning chemicals, all checked against packing list..."
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs resize-y"
                  />
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* CONDITIONAL SECTION: CREDIT CARD EXPENSES                                  */}
            {/* ========================================================================= */}
            {billType === 'credit_card_expense' && (
              <div className="space-y-4 border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Receipt / Transaction Ref <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={billNumber}
                      onChange={e => setBillNumber(e.target.value)}
                      required
                      placeholder="e.g. CC-40291"
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Transaction Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={billDate}
                      onChange={e => setBillDate(e.target.value)}
                      required
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Total Spent (£) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-neutral-500">£</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={totalAmountInput || ''}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setTotalAmountInput(val);
                          setSubtotalInput(val);
                          setTaxAmountInput(0);
                        }}
                        required
                        placeholder="0.00"
                        className="w-full pl-7 p-2 border border-[#8a8886] rounded-xs bg-white text-base font-extrabold text-[#0d9488]"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Card / Account Used (Optional)
                    </label>
                    <input
                      type="text"
                      value={cardReference}
                      onChange={e => setCardReference(e.target.value)}
                      placeholder="e.g. Visa ending 4419, Manager Fuel Card"
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Purchase / PO Reference (Optional)
                    </label>
                    <input
                      type="text"
                      value={purchaseReference}
                      onChange={e => setPurchaseReference(e.target.value)}
                      placeholder="e.g. EXP-REF-100"
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-[#605e5c] block mb-1">
                    Expense Purpose &amp; Operational Justification <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    required
                    placeholder="e.g. Urgent replacement radiator valve purchased from Screwfix for Flat 3..."
                    className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs resize-y"
                  />
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* CONDITIONAL SECTION: VENDOR INVOICES                                       */}
            {/* ========================================================================= */}
            {billType === 'vendor_invoice' && (
              <div className="space-y-4 border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Invoice Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={billNumber}
                      onChange={e => setBillNumber(e.target.value)}
                      required
                      placeholder="e.g. INV-10492"
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Invoice Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={billDate}
                      onChange={e => setBillDate(e.target.value)}
                      required
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    />
                  </div>
                </div>

                {/* Direct Amounts Input */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-3 rounded-xs border border-[#e1dfdd]">
                  <div>
                    <label className="font-semibold text-[#0d9488] block mb-1">
                      Total Payable (£) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-[#0d9488]">£</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={totalAmountInput || ''}
                        onChange={e => handleTotalChange(parseFloat(e.target.value) || 0)}
                        required
                        placeholder="0.00"
                        className="w-full pl-7 p-2 border border-[#0d9488] rounded-xs bg-teal-50/20 text-base font-extrabold text-[#0d9488]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Subtotal (£)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400">£</span>
                      <input
                        type="number"
                        step="0.01"
                        value={subtotalInput || ''}
                        onChange={e => handleSubtotalChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full pl-7 p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      VAT / Tax (£)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400">£</span>
                      <input
                        type="number"
                        step="0.01"
                        value={taxAmountInput || ''}
                        onChange={e => handleTaxChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full pl-7 p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      PO / Purchase Reference (Optional)
                    </label>
                    <input
                      type="text"
                      value={purchaseReference}
                      onChange={e => setPurchaseReference(e.target.value)}
                      placeholder="e.g. PO-2026-0881"
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[#605e5c] block mb-1">
                      Invoice Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="e.g. Monthly maintenance contract payment"
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs"
                    />
                  </div>
                </div>

                {/* Collapsible Itemized Lines (Optional) */}
                <div className="border border-[#e1dfdd] rounded-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowItemizedLines(!showItemizedLines)}
                    className="w-full px-3 py-2 bg-[#f3f2f1] hover:bg-[#edebe9] flex items-center justify-between font-semibold text-[11px] text-[#323130] transition-colors cursor-pointer"
                  >
                    <span>Add Itemized Line Items Breakdown (Optional)</span>
                    {showItemizedLines ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showItemizedLines && (
                    <div className="p-3 bg-white space-y-2">
                      {items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-[#faf9f8] p-2 rounded-xs border border-[#edebe9]">
                          <div className="col-span-5">
                            <input
                              type="text"
                              placeholder="Item description"
                              value={item.description}
                              onChange={e => handleItemChange(idx, 'description', e.target.value)}
                              className="w-full p-1.5 border border-[#8a8886] rounded-xs bg-white text-xs"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              min="1"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full p-1.5 border border-[#8a8886] rounded-xs bg-white text-xs"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Price"
                              value={item.unitPrice || ''}
                              onChange={e => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full p-1.5 border border-[#8a8886] rounded-xs bg-white text-xs"
                            />
                          </div>
                          <div className="col-span-2 text-right font-mono font-semibold text-[#242424]">
                            £{(((item.quantity || 1) * (item.unitPrice || 0)) + (item.taxAmount || 0)).toFixed(2)}
                          </div>
                          <div className="col-span-1 text-center">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-neutral-400 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="text-xs text-[#0d9488] hover:underline font-semibold flex items-center gap-1 cursor-pointer pt-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Line</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Document Attachment Dropzone (Single Clean Uploader) */}
            <div className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-2">
              <label className="font-semibold text-[#605e5c] block mb-1">
                {billType === 'delivery_note' ? 'Signed Delivery Note / Ticket Document' :
                 billType === 'credit_card_expense' ? 'Card Receipt / Transaction Slip' :
                 'Invoice Document / PDF Scan'} <span className="text-red-500">*</span>
              </label>

              <label className="border-2 border-dashed border-[#8a8886]/40 hover:border-[#0d9488] bg-white rounded-xs p-5 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group">
                <Upload className="w-6 h-6 text-neutral-400 group-hover:text-[#0d9488] transition-colors mb-1" />
                <span className="text-xs font-semibold text-[#323130]">
                  Click or drag file to attach {billType === 'delivery_note' ? 'delivery note' : billType === 'credit_card_expense' ? 'receipt' : 'invoice'}
                </span>
                <span className="text-[11px] text-neutral-500 mt-0.5">PDF, PNG, JPG, JPEG up to 15MB</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  disabled={isSubmitting}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {files.length > 0 && (
                <div className="space-y-1 pt-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-white border border-[#e1dfdd] p-2 rounded-xs text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />
                        <span className="truncate font-medium text-[#323130]">{f.file.name}</span>
                        <span className="text-[10px] text-neutral-400">({(f.file.size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(i)}
                        className="text-neutral-400 hover:text-red-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. RM Approval Routing */}
            <div className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={routeToApproval}
                    onChange={e => setRouteToApproval(e.target.checked)}
                    className="w-4 h-4 text-[#0d9488] rounded-xs border-neutral-300 focus:ring-[#0d9488]"
                  />
                  <span className="font-semibold text-xs text-[#242424]">
                    {billType === 'delivery_note' 
                      ? 'Route to Regional Manager for Goods Receipt Sign-Off'
                      : 'Route Record for Immediate Regional Manager Approval'}
                  </span>
                </label>
              </div>

              {routeToApproval && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#323130] mb-1">
                      Assigned Approver (Regional Manager) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedApproverId}
                      onChange={e => setSelectedApproverId(e.target.value)}
                      required={routeToApproval}
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] text-xs font-medium"
                    >
                      {approvers.length === 0 ? (
                        <option value="">Loading approvers...</option>
                      ) : (
                        approvers.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.role})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#323130] mb-1">
                      Notes for Approver (Optional)
                    </label>
                    <input
                      type="text"
                      value={approvalNotes}
                      onChange={e => setApprovalNotes(e.target.value)}
                      placeholder="e.g. Urgent signoff, delivery complete"
                      className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#e1dfdd]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{billToEdit ? 'Save Changes' : (routeToApproval ? 'Submit for Approval' : 'Save Record')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Supplier Modal for Adding/Removing Delivery & Invoice Suppliers */}
      <FinanceSupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        onSupplierAdded={s => {
          setAllVendors(prev => [s, ...prev]);
          setVendorId(s.id);
          setVendorName(s.vendorName);
        }}
        onSupplierDeleted={id => {
          setAllVendors(prev => prev.filter(v => v.id !== id));
          if (vendorId === id) {
            setVendorId('');
            setVendorName('');
          }
        }}
        onSelectSupplier={s => {
          setVendorId(s.id);
          setVendorName(s.vendorName);
        }}
      />
    </>
  );
};
