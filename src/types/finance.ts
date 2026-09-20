/**
 * SDTracker Finance Module Types
 */

export type FinanceBillType = 'vendor_invoice' | 'credit_card_expense' | 'delivery_note' | 'other_expense';

export type FinanceBillStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'verification_pending'
  | 'query_raised'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'payment_pending'
  | 'partially_paid'
  | 'paid'
  | 'reconciliation_pending'
  | 'reconciled'
  | 'cancelled';

export type FinanceAttachmentType =
  | 'vendor_invoice'
  | 'delivery_note'
  | 'credit_card_receipt'
  | 'purchase_order'
  | 'proof_of_delivery'
  | 'other';

export type FinanceVerificationProfileType =
  | 'site_verification'
  | 'procurement_verification'
  | 'finance_verification'
  | 'management_verification'
  | 'custom';

export type FinanceTaskStatus = 'assigned' | 'in_progress' | 'submitted' | 'returned' | 'cancelled';
export type FinanceVerificationResult = 'verified' | 'query' | 'rejected' | 'needs_more_information';

export type FinanceApprovalType = 'department_approval' | 'manager_approval' | 'finance_final_approval';
export type FinanceApprovalStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'returned' | 'cancelled';
export type FinanceApprovalDecision = 'approved' | 'rejected' | 'query' | 'returned';

export type FinanceQueryType =
  | 'missing_document'
  | 'amount_discrepancy'
  | 'delivery_confirmation'
  | 'vendor_clarification'
  | 'other';

export type FinanceQueryPriority = 'low' | 'normal' | 'high' | 'urgent';
export type FinanceQueryStatus = 'open' | 'in_progress' | 'responded' | 'resolved' | 'closed';

export type FinanceReconciliationType =
  | 'invoice_delivery_note'
  | 'invoice_purchase_reference'
  | 'invoice_payment'
  | 'other';

export type FinanceReconciliationStatus =
  | 'not_started'
  | 'in_progress'
  | 'matched'
  | 'partial_match'
  | 'discrepancy'
  | 'resolved';

export type FinancePaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';

export interface FinanceVendor {
  id: string;
  organizationId: string;
  vendorName: string;
  vendorReference?: string;
  contactEmail?: string;
  contactPhone?: string;
  paymentDetails?: Record<string, any>;
  status: 'active' | 'inactive';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceBillItem {
  id: string;
  billId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  lineTotal: number;
  createdAt?: string;
}

export interface FinanceBillAttachment {
  id: string;
  billId: string;
  fileName: string;
  storageBucket: string;
  storagePath: string;
  attachmentType: FinanceAttachmentType;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: string;
  uploadedByName?: string;
  createdAt: string;
  signedUrl?: string;
}

export interface FinanceBill {
  id: string;
  organizationId: string;
  siteId: string;
  siteName?: string;
  vendorId?: string;
  vendorName?: string;
  billNumber: string;
  billType: FinanceBillType;
  billDate: string;
  dueDate?: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  description?: string;
  purchaseReference?: string;
  submittedBy: string;
  submitterName?: string;
  submittedAt: string;
  status: FinanceBillStatus;
  finalApprovedBy?: string;
  finalApprovedByName?: string;
  finalApprovedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  items?: FinanceBillItem[];
  attachments?: FinanceBillAttachment[];
  queriesCount?: number;
  unresolvedQueriesCount?: number;
}

export interface FinanceVerificationProfile {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  profileType: FinanceVerificationProfileType;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceVerificationTask {
  id: string;
  billId: string;
  profileId: string;
  profileName?: string;
  assignedTo: string;
  assignedToName?: string;
  assignedBy: string;
  assignedByName?: string;
  instructions?: string;
  dueAt?: string;
  status: FinanceTaskStatus;
  result?: FinanceVerificationResult;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  responses?: FinanceVerificationResponse[];
}

export interface FinanceVerificationResponse {
  id: string;
  taskId: string;
  result: FinanceVerificationResult;
  comments?: string;
  respondedBy: string;
  respondedByName?: string;
  respondedAt: string;
}

export interface FinanceRoutingRule {
  id: string;
  organizationId: string;
  name: string;
  priority: number;
  billType?: string;
  minAmount?: number;
  maxAmount?: number;
  verificationProfileId?: string;
  requiresExternalApproval: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceApprovalRequest {
  id: string;
  billId: string;
  routingRuleId?: string;
  requestedBy: string;
  requestedByName?: string;
  assignedTo: string;
  assignedToName?: string;
  approvalType: FinanceApprovalType;
  status: FinanceApprovalStatus;
  requestMessage?: string;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
  responses?: FinanceApprovalResponse[];
}

export interface FinanceApprovalResponse {
  id: string;
  approvalRequestId: string;
  decision: FinanceApprovalDecision;
  comments?: string;
  respondedBy: string;
  respondedByName?: string;
  respondedAt: string;
}

export interface FinanceBillQuery {
  id: string;
  billId: string;
  raisedBy: string;
  raisedByName?: string;
  assignedTo: string;
  assignedToName?: string;
  queryType: FinanceQueryType;
  question: string;
  priority: FinanceQueryPriority;
  status: FinanceQueryStatus;
  dueAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  responses?: FinanceQueryResponse[];
}

export interface FinanceQueryResponse {
  id: string;
  queryId: string;
  responseText: string;
  respondedBy: string;
  respondedByName?: string;
  createdAt: string;
}

export interface FinanceReconciliationRecord {
  id: string;
  billId: string;
  reconciliationType: FinanceReconciliationType;
  referenceNumber?: string;
  expectedAmount?: number;
  actualAmount?: number;
  varianceAmount?: number;
  status: FinanceReconciliationStatus;
  notes?: string;
  matchedBy?: string;
  matchedByName?: string;
  reconciledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancePaymentRecord {
  id: string;
  billId: string;
  paymentReference?: string;
  paymentAmount: number;
  paymentDate?: string;
  paymentStatus: FinancePaymentStatus;
  recordedBy: string;
  recordedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceBillStatusHistory {
  id: string;
  billId: string;
  oldStatus?: string;
  newStatus: string;
  changedBy: string;
  changedByName?: string;
  reason?: string;
  createdAt: string;
}

export interface FinanceWorkflowEvent {
  id: string;
  billId: string;
  eventType: string;
  actorUserId: string;
  actorUserName?: string;
  metadata: Record<string, any>;
  createdAt: string;
}
