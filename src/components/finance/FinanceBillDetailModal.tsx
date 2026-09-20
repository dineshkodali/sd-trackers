import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  CheckCircle,
  XCircle,
  HelpCircle,
  Scale,
  CreditCard,
  History,
  Download,
  Upload,
  MessageSquare,
  AlertTriangle,
  Clock,
  Building,
  User,
  ExternalLink,
  Plus,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { financeService } from '../../services/financeService';
import type {
  FinanceBill,
  FinanceBillQuery,
  FinanceReconciliationRecord,
  FinancePaymentRecord,
  FinanceBillStatusHistory,
  FinanceAttachmentType
} from '../../types/finance';

interface FinanceBillDetailModalProps {
  billId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const FinanceBillDetailModal: React.FC<FinanceBillDetailModalProps> = ({
  billId,
  isOpen,
  onClose,
  onRefresh
}) => {
  const { authProfile, isFinanceUser, canManageFinance } = useApp();

  const [activeTab, setActiveTab] = useState<'details' | 'attachments' | 'approval' | 'queries' | 'reconciliation' | 'payments' | 'history'>('details');
  const [bill, setBill] = useState<FinanceBill | null>(null);
  const [queries, setQueries] = useState<FinanceBillQuery[]>([]);
  const [reconciliations, setReconciliations] = useState<FinanceReconciliationRecord[]>([]);
  const [payments, setPayments] = useState<FinancePaymentRecord[]>([]);
  const [history, setHistory] = useState<FinanceBillStatusHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Approval Form states
  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [isProcessingDecision, setIsProcessingDecision] = useState(false);

  // Query Form states
  const [showNewQueryBox, setShowNewQueryBox] = useState(false);
  const [newQueryType, setNewQueryType] = useState<'missing_document' | 'amount_discrepancy' | 'delivery_confirmation' | 'vendor_clarification' | 'other'>('amount_discrepancy');
  const [newQueryQuestion, setNewQueryQuestion] = useState('');
  const [queryReplyTexts, setQueryReplyTexts] = useState<Record<string, string>>({});

  // Reconciliation Form states
  const [showNewRecBox, setShowNewRecBox] = useState(false);
  const [recType, setRecType] = useState<'invoice_delivery_note' | 'invoice_purchase_reference' | 'invoice_payment' | 'other'>('invoice_delivery_note');
  const [recRefNumber, setRecRefNumber] = useState('');
  const [recExpected, setRecExpected] = useState<number>(0);
  const [recActual, setRecActual] = useState<number>(0);
  const [recNotes, setRecNotes] = useState('');

  // Payment Form states
  const [showPaymentBox, setShowPaymentBox] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Attachment upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<FinanceAttachmentType>('delivery_note');
  const [isUploading, setIsUploading] = useState(false);

  const loadBillDetails = async () => {
    if (!billId) return;
    setIsLoading(true);
    setActionError(null);
    try {
      const fullBill = await financeService.getBillById(billId);
      if (fullBill) {
        setBill(fullBill);
        setRecExpected(fullBill.totalAmount);
        setRecActual(fullBill.totalAmount);
        setPaymentAmount(fullBill.totalAmount);
      }
      const [qs, recs, pays, hist] = await Promise.all([
        financeService.getBillQueries(billId),
        financeService.getReconciliations(billId),
        financeService.getPayments(billId),
        financeService.getBillHistory(billId)
      ]);
      setQueries(qs);
      setReconciliations(recs);
      setPayments(pays);
      setHistory(hist);
    } catch (err: any) {
      setActionError('Failed to load bill details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && billId) {
      loadBillDetails();
      setActiveTab('details');
      setShowRejectBox(false);
      setShowNewQueryBox(false);
      setShowNewRecBox(false);
      setShowPaymentBox(false);
      setActionSuccess(null);
    }
  }, [isOpen, billId]);

  if (!isOpen || !billId) return null;

  // Final Approval Handlers
  const handleApprove = async () => {
    setIsProcessingDecision(true);
    setActionError(null);
    try {
      const res = await financeService.financeFinalApproval(billId, approvalComments);
      if (!res.success) throw new Error(res.error || 'Approval failed');
      setActionSuccess('Bill has received final approval from Finance.');
      await loadBillDetails();
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsProcessingDecision(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setActionError('Please specify a rejection reason.');
      return;
    }
    setIsProcessingDecision(true);
    setActionError(null);
    try {
      const res = await financeService.financeRejectBill(billId, rejectionReason);
      if (!res.success) throw new Error(res.error || 'Rejection failed');
      setActionSuccess('Bill has been rejected.');
      setShowRejectBox(false);
      await loadBillDetails();
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsProcessingDecision(false);
    }
  };

  // Query Handlers
  const handleCreateQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueryQuestion.trim()) return;
    try {
      const res = await financeService.raiseQuery(
        billId,
        newQueryType,
        newQueryQuestion,
        bill?.submittedBy || authProfile?.id || '00000000-0000-0000-0000-000000000000'
      );
      if (!res.success) throw new Error(res.error);
      setNewQueryQuestion('');
      setShowNewQueryBox(false);
      await loadBillDetails();
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleReplyQuery = async (queryId: string) => {
    const text = queryReplyTexts[queryId];
    if (!text || !text.trim()) return;
    try {
      const res = await financeService.respondToQuery(queryId, text.trim());
      if (!res.success) throw new Error(res.error);
      setQueryReplyTexts(prev => ({ ...prev, [queryId]: '' }));
      await loadBillDetails();
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Reconciliation Handler
  const handleCreateReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await financeService.recordReconciliation(
        billId,
        recType,
        recRefNumber,
        recExpected,
        recActual,
        recNotes
      );
      if (!res.success) throw new Error(res.error);
      setShowNewRecBox(false);
      await loadBillDetails();
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Payment Handler
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) {
      setActionError('Payment amount must be greater than zero.');
      return;
    }
    try {
      const res = await financeService.recordPayment(
        billId,
        paymentRef || `TXN-${Date.now().toString().slice(-6)}`,
        paymentAmount,
        paymentDate
      );
      if (!res.success) throw new Error(res.error);
      setShowPaymentBox(false);
      await loadBillDetails();
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Attachment Upload Handler
  const handleUploadAttachment = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    try {
      const res = await financeService.uploadAttachment(
        billId,
        uploadFile,
        uploadType,
        authProfile?.id || '00000000-0000-0000-0000-000000000000'
      );
      if (!res.success) throw new Error(res.error);
      setUploadFile(null);
      await loadBillDetails();
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const statusBadgeColor = (status?: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'paid': return 'bg-blue-50 text-blue-800 border-blue-300';
      case 'partially_paid': return 'bg-sky-50 text-sky-800 border-sky-300';
      case 'rejected': return 'bg-rose-50 text-rose-800 border-rose-300';
      case 'query_raised': return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'submitted':
      case 'under_review':
      case 'awaiting_approval': return 'bg-purple-50 text-purple-800 border-purple-300';
      case 'reconciled': return 'bg-teal-50 text-teal-800 border-teal-300';
      default: return 'bg-gray-50 text-gray-700 border-gray-300';
    }
  };

  const isSubmitter = !!authProfile?.id && bill?.submittedBy === authProfile.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#faf9f8] shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[#242424] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0d9488]" />
                <span>{bill?.billNumber || 'Bill Details'}</span>
              </h3>
              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-xs border uppercase ${statusBadgeColor(bill?.status)}`}>
                {bill?.status?.replace('_', ' ') || 'loading...'}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {bill?.siteName || 'Property'} • {bill?.vendorName || 'Direct Expense'} • Due: {bill?.dueDate || 'Immediate'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action alerts */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xs text-xs text-red-700 flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xs text-xs text-emerald-800 flex items-center gap-2 shrink-0">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-[#e1dfdd] px-6 bg-[#faf9f8] overflow-x-auto text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'details' ? 'border-[#0d9488] text-[#0d9488]' : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Bill &amp; Items
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attachments')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'attachments' ? 'border-[#0d9488] text-[#0d9488]' : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Attachments ({bill?.attachments?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('approval')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'approval' ? 'border-[#0d9488] text-[#0d9488]' : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Finance Approval
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('queries')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'queries' ? 'border-[#0d9488] text-[#0d9488]' : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Queries ({queries.filter(q => q.status !== 'resolved').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reconciliation')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'reconciliation' ? 'border-[#0d9488] text-[#0d9488]' : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Reconciliation ({reconciliations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'payments' ? 'border-[#0d9488] text-[#0d9488]' : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Payments ({payments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'history' ? 'border-[#0d9488] text-[#0d9488]' : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Audit History
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs bg-white">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-neutral-400">Loading bill details...</div>
          ) : (
            <>
              {/* TAB 1: DETAILS & ITEMS */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  {/* Summary Card */}
                  <div className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#605e5c] block">Total Amount</span>
                        <span className="text-xl font-extrabold text-[#0d9488]">£{bill?.totalAmount?.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#605e5c] block">Subtotal</span>
                        <span className="text-sm font-semibold text-[#242424]">£{bill?.subtotal?.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#605e5c] block">Tax / VAT</span>
                        <span className="text-sm font-semibold text-[#242424]">£{bill?.taxAmount?.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#605e5c] block">Bill Date</span>
                        <span className="text-sm font-semibold text-[#242424]">{bill?.billDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section Divider */}
                  <div className="border-t border-[#e1dfdd]" />

                  {/* Section 1: 2-Column Responsive Grid for Document & Property Details */}
                  <div className="space-y-3">
                    <div className="pb-1 border-b border-neutral-200">
                      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Document &amp; Property Details</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <label className="font-semibold text-[#605e5c] block">Property / Site</label>
                        <div className="p-2 border border-[#e1dfdd] rounded-xs bg-[#faf9f8] text-[#242424] font-medium">
                          {bill?.siteName || bill?.siteId}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-[#605e5c] block">Vendor / Supplier</label>
                        <div className="p-2 border border-[#e1dfdd] rounded-xs bg-[#faf9f8] text-[#242424] font-medium">
                          {bill?.vendorName || 'Direct Expense'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-[#605e5c] block">Purchase Order / Ref</label>
                        <div className="p-2 border border-[#e1dfdd] rounded-xs bg-[#faf9f8] text-[#242424] font-medium">
                          {bill?.purchaseReference || 'N/A'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-[#605e5c] block">Submitted By</label>
                        <div className="p-2 border border-[#e1dfdd] rounded-xs bg-[#faf9f8] text-[#242424] font-medium">
                          {bill?.submitterName || bill?.submittedBy}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-[#605e5c] block">Submission Date</label>
                        <div className="p-2 border border-[#e1dfdd] rounded-xs bg-[#faf9f8] text-[#242424] font-medium">
                          {bill?.submittedAt ? new Date(bill.submittedAt).toLocaleString() : 'N/A'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-[#605e5c] block">Final Approved By</label>
                        <div className="p-2 border border-[#e1dfdd] rounded-xs bg-[#faf9f8] text-[#242424] font-medium">
                          {bill?.finalApprovedByName || 'Pending Finance Sign-off'}
                        </div>
                      </div>
                    </div>

                    {bill?.description && (
                      <div className="p-3 border border-[#e1dfdd] rounded-xs bg-[#faf9f8] text-xs mt-2">
                        <span className="font-semibold text-[#605e5c]">Notes / Description: </span>
                        <span className="text-[#242424]">{bill.description}</span>
                      </div>
                    )}
                  </div>

                  {/* Section Divider */}
                  <div className="border-t border-[#e1dfdd]" />

                  {/* Section 2: Content Card for Itemized Breakdown */}
                  <div className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-3">
                    <div className="pb-1 border-b border-neutral-200">
                      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Itemized Breakdown</h4>
                    </div>
                    <div className="bg-white rounded-xs border border-[#e1dfdd] overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#faf9f8] text-[#605e5c] border-b border-[#e1dfdd] font-semibold">
                          <tr>
                            <th className="py-2.5 px-4">Description</th>
                            <th className="py-2.5 px-3 text-right">Quantity</th>
                            <th className="py-2.5 px-3 text-right">Unit Price</th>
                            <th className="py-2.5 px-3 text-right">Tax (£)</th>
                            <th className="py-2.5 px-4 text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e1dfdd]">
                          {bill?.items && bill.items.length > 0 ? (
                            bill.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-neutral-50/50">
                                <td className="py-2.5 px-4 font-medium text-[#242424]">{item.description}</td>
                                <td className="py-2.5 px-3 text-right text-neutral-600">{item.quantity}</td>
                                <td className="py-2.5 px-3 text-right text-neutral-600">£{item.unitPrice.toFixed(2)}</td>
                                <td className="py-2.5 px-3 text-right text-neutral-600">£{item.taxAmount.toFixed(2)}</td>
                                <td className="py-2.5 px-4 text-right font-bold text-[#242424]">£{item.lineTotal.toFixed(2)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-neutral-400">No itemized lines recorded</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ATTACHMENTS */}
              {activeTab === 'attachments' && (
                <div className="space-y-6">
                  {/* Content Card: Upload Supporting Document */}
                  <div className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-4">
                    <div className="pb-1 border-b border-neutral-200">
                      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                        Upload Supporting Document
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                      <div className="space-y-1">
                        <label className="font-semibold text-[#605e5c] block">Attachment Classification</label>
                        <select
                          value={uploadType}
                          onChange={e => setUploadType(e.target.value as FinanceAttachmentType)}
                          disabled={isUploading}
                          className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                        >
                          <option value="vendor_invoice">Vendor Invoice</option>
                          <option value="delivery_note">Delivery Note / Proof</option>
                          <option value="credit_card_receipt">Credit Card Receipt</option>
                          <option value="purchase_order">Purchase Order</option>
                          <option value="other">Other Document</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        disabled={!uploadFile || isUploading}
                        onClick={handleUploadAttachment}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer h-[38px]"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploading ? 'Uploading Document...' : 'Attach Document to Bill'}</span>
                      </button>
                    </div>

                    {/* Dashed Drop Zone */}
                    <label className="border-2 border-dashed border-[#8a8886]/40 hover:border-[#0d9488] bg-white rounded-xs p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group">
                      <Upload className="w-6 h-6 text-neutral-400 group-hover:text-[#0d9488] transition-colors mb-1.5" />
                      <span className="text-xs font-semibold text-[#323130]">
                        {uploadFile ? uploadFile.name : 'Click to select or drop supporting file here'}
                      </span>
                      <span className="text-[11px] text-neutral-500 mt-0.5">
                        {uploadFile ? `${(uploadFile.size / 1024).toFixed(1)} KB selected` : 'PDF, PNG, JPG, or WEBP up to 15MB'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        className="hidden"
                        disabled={isUploading}
                        onChange={e => setUploadFile(e.target.files ? e.target.files[0] : null)}
                      />
                    </label>
                  </div>

                  {/* Section Divider */}
                  <div className="border-t border-[#e1dfdd]" />

                  {/* Content Card: Existing Attachments */}
                  <div className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-3">
                    <div className="pb-1 border-b border-neutral-200">
                      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                        Attached Documents ({bill?.attachments?.length || 0})
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {bill?.attachments && bill.attachments.length > 0 ? (
                        bill.attachments.map(att => (
                          <div key={att.id} className="bg-white p-3 rounded-xs border border-[#e1dfdd] flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <div className="w-8 h-8 rounded-xs bg-teal-50 border border-teal-200 text-[#0d9488] flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-semibold text-[#242424] truncate">{att.fileName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-neutral-100 text-neutral-600 font-medium uppercase">
                                    {(att.attachmentType || 'document').replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[10px] text-neutral-400">
                                    {(att.fileSizeBytes / 1024).toFixed(0)} KB
                                  </span>
                                </div>
                              </div>
                            </div>
                            {att.signedUrl ? (
                              <a
                                href={att.signedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0d9488] hover:underline bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-xs shrink-0"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>View</span>
                              </a>
                            ) : (
                              <span className="text-[10px] text-neutral-400">Stored</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-8 text-center text-xs text-neutral-400 bg-white rounded-xs border border-dashed border-[#8a8886]/40">
                          No supporting attachments uploaded yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: FINANCE APPROVAL */}
              {activeTab === 'approval' && (
                <div className="space-y-6">
                  <div className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-4">
                    <div className="pb-1 border-b border-neutral-200">
                      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                        Finance Approval Governance
                      </h4>
                    </div>

                    <p className="text-xs text-neutral-600 leading-relaxed">
                      SDTracker strictly enforces that Site Staff may submit bills, but only authorized Central Finance
                      personnel can authorize bill payment. All reviews, queries, and verifications culminate in final
                      Finance Sign-off.
                    </p>

                    {bill?.status === 'approved' && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xs flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-emerald-900">Approved for Payment</p>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            Signed off by {bill.finalApprovedByName || 'Finance Admin'} on{' '}
                            {bill.finalApprovedAt ? new Date(bill.finalApprovedAt).toLocaleDateString() : 'N/A'}.
                          </p>
                        </div>
                      </div>
                    )}

                    {bill?.status === 'rejected' && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xs flex items-center gap-3">
                        <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-red-900">Bill Rejected</p>
                          <p className="text-[11px] text-red-700 mt-0.5">
                            Reason: {bill.rejectionReason || 'No reason provided.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Segregation of Duties Check */}
                    {isSubmitter && isFinanceUser() && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xs text-xs text-amber-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          Notice: You submitted this bill. Under standard segregation of duties, another Finance team
                          member should execute the final approval.
                        </span>
                      </div>
                    )}

                    {/* Notice for non-finance users */}
                    {!isFinanceUser() && bill?.status !== 'approved' && bill?.status !== 'rejected' && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xs text-xs text-blue-800 flex items-center gap-2 font-medium">
                        <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>
                          Pending Central Finance review and sign-off. Site staff may monitor the status and answer questions in the Queries tab.
                        </span>
                      </div>
                    )}

                    {/* Finance Decision Controls */}
                    {bill?.status !== 'approved' && bill?.status !== 'rejected' && isFinanceUser() && (
                      <div className="pt-3 border-t border-[#e1dfdd] space-y-4">
                        <div className="space-y-1">
                          <label className="font-semibold text-[#605e5c] block">
                            Approval Comments (Optional)
                          </label>
                          <input
                            type="text"
                            value={approvalComments}
                            onChange={e => setApprovalComments(e.target.value)}
                            placeholder="e.g. Invoiced amounts match PO and approved quote"
                            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                          />
                        </div>

                        {!showRejectBox ? (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={isProcessingDecision}
                              onClick={handleApprove}
                              className="flex items-center gap-1.5 px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs transition-colors cursor-pointer text-xs disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Grant Final Finance Approval</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowRejectBox(true)}
                              className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-xs font-semibold transition-colors cursor-pointer text-xs"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject Bill</span>
                            </button>
                          </div>
                        ) : (
                          <div className="border border-red-200 rounded-xs bg-red-50/50 p-4 space-y-3">
                            <label className="block text-xs font-bold text-red-900">
                              Reason for Rejection <span className="text-red-600">*</span>
                            </label>
                            <textarea
                              rows={2}
                              value={rejectionReason}
                              onChange={e => setRejectionReason(e.target.value)}
                              placeholder="Explain why this bill cannot be approved (e.g. duplicate billing, delivery note missing)..."
                              className="w-full p-2 border border-red-300 rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-colors text-xs"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isProcessingDecision}
                                onClick={handleReject}
                                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xs disabled:opacity-50 transition-colors cursor-pointer"
                              >
                                Confirm Rejection
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowRejectBox(false)}
                                className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-xs hover:bg-neutral-100 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: QUERIES */}
              {activeTab === 'queries' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                        Queries &amp; Two-Way Clarifications
                      </h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Ask questions or request clarifications on invoice line items, proofs of delivery, or variances.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNewQueryBox(!showNewQueryBox)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0d9488] bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Raise New Query</span>
                    </button>
                  </div>

                  {/* New Query Box */}
                  {showNewQueryBox && (
                    <form onSubmit={handleCreateQuery} className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-3">
                      <div className="pb-1 border-b border-neutral-200">
                        <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Submit New Query</h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="font-semibold text-[#605e5c] block">Query Classification</label>
                          <select
                            value={newQueryType}
                            onChange={e => setNewQueryType(e.target.value as any)}
                            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                          >
                            <option value="amount_discrepancy">Amount Discrepancy</option>
                            <option value="missing_document">Missing Delivery Note / Document</option>
                            <option value="delivery_confirmation">Delivery Confirmation</option>
                            <option value="vendor_clarification">Vendor Clarification</option>
                            <option value="other">Other Inquiry</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-[#605e5c] block">Question / Clarification Needed <span className="text-red-500">*</span></label>
                        <textarea
                          rows={2}
                          required
                          value={newQueryQuestion}
                          onChange={e => setNewQueryQuestion(e.target.value)}
                          placeholder="Please provide clarification on the invoice line item or delivery confirmation..."
                          className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-[#e1dfdd]">
                        <button
                          type="button"
                          onClick={() => setShowNewQueryBox(false)}
                          className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-xs hover:bg-neutral-100 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] rounded-xs transition-colors cursor-pointer"
                        >
                          Send Query
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Section Divider */}
                  <div className="border-t border-[#e1dfdd]" />

                  {/* Query Cards */}
                  <div className="space-y-3">
                    {queries.length > 0 ? (
                      queries.map(q => (
                        <div key={q.id} className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-2 py-0.5 rounded-xs bg-amber-50 text-amber-800 border border-amber-300 font-bold uppercase">
                                {(q.queryType || 'general').replace(/_/g, ' ')}
                              </span>
                              <span className="text-xs text-neutral-500">
                                Raised by {q.raisedByName || 'User'} on {new Date(q.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs border ${
                              q.status === 'resolved' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}>
                              {q.status}
                            </span>
                          </div>

                          <p className="text-xs font-medium text-[#242424] bg-white p-2.5 rounded-xs border border-[#e1dfdd]">
                            {q.question}
                          </p>

                          {/* Response thread */}
                          {q.responses && q.responses.length > 0 && (
                            <div className="pl-3 border-l-2 border-[#0d9488] space-y-2">
                              {q.responses.map(r => (
                                <div key={r.id} className="text-xs bg-white p-2.5 rounded-xs border border-[#e1dfdd]">
                                  <p className="font-semibold text-[#0d9488] text-[11px]">
                                    {r.respondedByName || 'Staff Member'} • {new Date(r.createdAt).toLocaleString()}
                                  </p>
                                  <p className="text-neutral-700 mt-0.5">{r.responseText}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reply box */}
                          {q.status !== 'resolved' && (
                            <div className="flex items-center gap-2 pt-2 border-t border-[#e1dfdd]">
                              <input
                                type="text"
                                value={queryReplyTexts[q.id] || ''}
                                onChange={e => setQueryReplyTexts(prev => ({ ...prev, [q.id]: e.target.value }))}
                                placeholder="Type a response or clarification..."
                                className="flex-1 p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleReplyQuery(q.id)}
                                className="px-4 py-2 text-xs font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] rounded-xs transition-colors cursor-pointer shrink-0"
                              >
                                Reply
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-neutral-400 bg-white rounded-xs border border-dashed border-[#8a8886]/40">
                        No queries raised on this bill.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: RECONCILIATION */}
              {activeTab === 'reconciliation' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                        Manual 3-Way Reconciliation Worksheet
                      </h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Compare vendor invoice amounts against delivery notes and purchase records.
                      </p>
                    </div>
                    {isFinanceUser() && (
                      <button
                        type="button"
                        onClick={() => setShowNewRecBox(!showNewRecBox)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0d9488] bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Record Check</span>
                      </button>
                    )}
                  </div>

                  {showNewRecBox && (
                    <form onSubmit={handleCreateReconciliation} className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-3">
                      <div className="pb-1 border-b border-neutral-200">
                        <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Add Reconciliation Check</h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="font-semibold text-[#605e5c] block">Check Type</label>
                          <select
                            value={recType}
                            onChange={e => setRecType(e.target.value as any)}
                            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                          >
                            <option value="invoice_delivery_note">Invoice vs Delivery Note</option>
                            <option value="invoice_purchase_reference">Invoice vs PO Ref</option>
                            <option value="invoice_payment">Invoice vs Payment</option>
                            <option value="other">Other Manual Check</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-[#605e5c] block">Expected (£)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={recExpected}
                            onChange={e => setRecExpected(parseFloat(e.target.value) || 0)}
                            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-[#605e5c] block">Actual Invoiced (£)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={recActual}
                            onChange={e => setRecActual(parseFloat(e.target.value) || 0)}
                            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-[#605e5c] block">Notes &amp; Explanation</label>
                          <input
                            type="text"
                            value={recNotes}
                            onChange={e => setRecNotes(e.target.value)}
                            placeholder="Items match delivery note DN-881 signed by site manager..."
                            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-[#e1dfdd]">
                        <button
                          type="button"
                          onClick={() => setShowNewRecBox(false)}
                          className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-xs hover:bg-neutral-100 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] rounded-xs transition-colors cursor-pointer"
                        >
                          Save Reconciliation
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Section Divider */}
                  <div className="border-t border-[#e1dfdd]" />

                  {/* Reconciliation Table */}
                  <div className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-3">
                    <div className="pb-1 border-b border-neutral-200">
                      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Reconciliation Records</h4>
                    </div>
                    <div className="bg-white rounded-xs border border-[#e1dfdd] overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#faf9f8] text-[#605e5c] border-b border-[#e1dfdd] font-semibold">
                          <tr>
                            <th className="py-2.5 px-4">Type</th>
                            <th className="py-2.5 px-3 text-right">Expected</th>
                            <th className="py-2.5 px-3 text-right">Actual</th>
                            <th className="py-2.5 px-3 text-right">Variance</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-4">Matched By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e1dfdd]">
                          {reconciliations.length > 0 ? (
                            reconciliations.map(r => (
                              <tr key={r.id} className="hover:bg-neutral-50/50">
                                <td className="py-2.5 px-4 font-medium text-[#242424]">
                                  {(r.reconciliationType || 'general').replace(/_/g, ' ')}
                                  {r.notes && <p className="text-[10px] text-neutral-500 font-normal">{r.notes}</p>}
                                </td>
                                <td className="py-2.5 px-3 text-right text-neutral-600">£{r.expectedAmount?.toFixed(2)}</td>
                                <td className="py-2.5 px-3 text-right text-neutral-600">£{r.actualAmount?.toFixed(2)}</td>
                                <td className={`py-2.5 px-3 text-right font-bold ${
                                  r.varianceAmount === 0 ? 'text-[#0d9488]' : 'text-red-600'
                                }`}>
                                  £{r.varianceAmount?.toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={`px-2 py-0.5 rounded-xs border text-[10px] font-semibold uppercase ${
                                    r.status === 'matched' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'
                                  }`}>
                                    {r.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-neutral-500">
                                  {r.matchedByName || 'Finance User'}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-neutral-400">
                                No manual reconciliation checks recorded yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: PAYMENTS */}
              {activeTab === 'payments' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                        Payment &amp; Disbursal Records
                      </h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Tracks payment reference numbers, dates, and amounts disbursed for this bill.
                      </p>
                    </div>
                    {isFinanceUser() && (
                      <button
                        type="button"
                        onClick={() => setShowPaymentBox(!showPaymentBox)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0d9488] bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Record Payment</span>
                      </button>
                    )}
                  </div>

                  {showPaymentBox && (
                    <form onSubmit={handleRecordPayment} className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-3">
                      <div className="pb-1 border-b border-neutral-200">
                        <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Log Payment Record</h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="font-semibold text-[#605e5c] block">Reference / Transaction ID <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            required
                            value={paymentRef}
                            onChange={e => setPaymentRef(e.target.value)}
                            placeholder="e.g. BACS-449102"
                            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-[#605e5c] block">Amount (£) <span className="text-red-500">*</span></label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={paymentAmount}
                            onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="font-semibold text-[#605e5c] block">Payment Date <span className="text-red-500">*</span></label>
                          <input
                            type="date"
                            required
                            value={paymentDate}
                            onChange={e => setPaymentDate(e.target.value)}
                            className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-[#e1dfdd]">
                        <button
                          type="button"
                          onClick={() => setShowPaymentBox(false)}
                          className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-xs hover:bg-neutral-100 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] rounded-xs transition-colors cursor-pointer"
                        >
                          Save Payment
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Section Divider */}
                  <div className="border-t border-[#e1dfdd]" />

                  {/* Payments Table */}
                  <div className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-3">
                    <div className="pb-1 border-b border-neutral-200">
                      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Disbursement History</h4>
                    </div>
                    <div className="bg-white rounded-xs border border-[#e1dfdd] overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#faf9f8] text-[#605e5c] border-b border-[#e1dfdd] font-semibold">
                          <tr>
                            <th className="py-2.5 px-4">Payment Reference</th>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-4">Recorded By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e1dfdd]">
                          {payments.length > 0 ? (
                            payments.map(p => (
                              <tr key={p.id} className="hover:bg-neutral-50/50">
                                <td className="py-2.5 px-4 font-semibold text-[#242424]">{p.paymentReference}</td>
                                <td className="py-2.5 px-3 text-neutral-600">{p.paymentDate || 'N/A'}</td>
                                <td className="py-2.5 px-3 text-right font-bold text-[#0d9488]">£{p.paymentAmount?.toFixed(2)}</td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded-xs border border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px] font-semibold uppercase">
                                    {p.paymentStatus}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-neutral-500">{p.recordedByName || 'Finance'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-neutral-400">
                                No payment records registered yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: AUDIT HISTORY */}
              {activeTab === 'history' && (
                <div className="space-y-6">
                  <div className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-3">
                    <div className="pb-1 border-b border-neutral-200">
                      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                        State Machine &amp; Workflow Audit Trail
                      </h4>
                    </div>

                    <div className="bg-white rounded-xs border border-[#e1dfdd] p-4 divide-y divide-[#e1dfdd]">
                      {history.length > 0 ? (
                        history.map(h => (
                          <div key={h.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                            <div className="w-7 h-7 rounded-xs bg-[#faf9f8] border border-[#e1dfdd] flex items-center justify-center text-neutral-600 shrink-0 mt-0.5">
                              <Clock className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#242424]">
                                  {h.oldStatus ? `${(h.oldStatus || '').replace(/_/g, ' ')} → ${(h.newStatus || '').replace(/_/g, ' ')}` : `Initial Status: ${(h.newStatus || '').replace(/_/g, ' ')}`}
                                </span>
                                <span className="text-[10px] text-neutral-400">
                                  {new Date(h.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-neutral-600 mt-0.5">{h.reason || 'Status updated.'}</p>
                              <p className="text-[10px] text-neutral-400 mt-0.5">Actor: {h.changedByName || 'System'}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-6 text-center text-neutral-400 text-xs">No audit events recorded</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Standard Footer */}
        <div className="px-6 py-4 border-t border-[#e1dfdd] bg-[#faf9f8] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={loadBillDetails}
            className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-xs hover:bg-neutral-100 transition-colors cursor-pointer flex items-center gap-1.5"
            title="Reload latest bill details and workflow state"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh Record</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold transition-colors cursor-pointer text-xs"
            >
              Close
            </button>
            {activeTab === 'approval' && isFinanceUser() && bill?.status !== 'approved' && bill?.status !== 'rejected' && !showRejectBox ? (
              <button
                type="button"
                disabled={isProcessingDecision}
                onClick={handleApprove}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs transition-colors cursor-pointer text-xs disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Grant Approval</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs transition-colors cursor-pointer text-xs"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
