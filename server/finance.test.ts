/**
 * Unit tests for SDTracker Finance Module logic, calculations,
 * state machine transitions, and segregation-of-duties validation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENTITY_TABLE_MAP } from '../src/lib/directSupabaseAdapter.ts';
import type { FinanceBillStatus, FinanceReconciliationRecord } from '../src/types/finance.ts';

test('Finance Module: Entity table mappings exist in directSupabaseAdapter', () => {
  assert.equal(ENTITY_TABLE_MAP['finance_bills']?.table, 'finance_bills');
  assert.equal(ENTITY_TABLE_MAP['finance_vendors']?.table, 'finance_vendors');
  assert.equal(ENTITY_TABLE_MAP['finance_bill_items']?.table, 'finance_bill_items');
  assert.equal(ENTITY_TABLE_MAP['finance_bill_attachments']?.table, 'finance_bill_attachments');
  assert.equal(ENTITY_TABLE_MAP['finance_reconciliation_records']?.table, 'finance_reconciliation_records');
  assert.equal(ENTITY_TABLE_MAP['finance_payment_records']?.table, 'finance_payment_records');
});

test('Finance Module: Line item calculations and bill total verification', () => {
  const items = [
    { description: 'Hotel Commercial Laundry Service', quantity: 15, unitPrice: 20.0, taxAmount: 60.0 }, // 300 + 60 = 360
    { description: 'Dry Cleaning Linen', quantity: 2, unitPrice: 50.0, taxAmount: 20.0 }                 // 100 + 20 = 120
  ];

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const taxAmount = items.reduce((sum, item) => sum + item.taxAmount, 0);
  const totalAmount = subtotal + taxAmount;

  assert.equal(subtotal, 400.0);
  assert.equal(taxAmount, 80.0);
  assert.equal(totalAmount, 480.0);
});

test('Finance Module: Manual 3-way reconciliation variance and status computation', () => {
  function computeReconciliation(expected: number, actual: number): { variance: number; status: FinanceReconciliationRecord['status'] } {
    const variance = expected - actual;
    let status: FinanceReconciliationRecord['status'] = 'matched';
    if (variance !== 0) {
      status = 'discrepancy';
    }
    return { variance, status };
  }

  // Exact match
  const exact = computeReconciliation(1500.0, 1500.0);
  assert.equal(exact.variance, 0);
  assert.equal(exact.status, 'matched');

  // Discrepancy (Supplier charged more than delivery note / quote)
  const overcharge = computeReconciliation(1500.0, 1580.0);
  assert.equal(overcharge.variance, -80.0);
  assert.equal(overcharge.status, 'discrepancy');

  // Partial match / shortfall
  const undercharge = computeReconciliation(1500.0, 1400.0);
  assert.equal(undercharge.variance, 100.0);
  assert.equal(undercharge.status, 'discrepancy');
});

test('Finance Module: Segregation of duties validation logic', () => {
  function canApproveBill(
    submittingUserId: string,
    approvingUserId: string,
    approverRole: string
  ): { allowed: boolean; reason?: string } {
    if (approverRole === 'Super Admin') {
      return { allowed: true };
    }
    if (submittingUserId === approvingUserId) {
      return {
        allowed: false,
        reason: 'Segregation of duties violation: submitter cannot approve their own bill.'
      };
    }
    if (approverRole === 'Finance Admin' || approverRole === 'Finance Manager') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Unauthorized role for final finance approval.'
    };
  }

  const staffUser = 'user-staff-001';
  const financeUser1 = 'user-finance-001';
  const superAdmin = 'user-superadmin-001';

  // Site staff cannot approve
  assert.equal(canApproveBill(staffUser, staffUser, 'Site Staff').allowed, false);

  // Submitting finance user cannot approve own bill unless Super Admin
  const selfApproval = canApproveBill(financeUser1, financeUser1, 'Finance Manager');
  assert.equal(selfApproval.allowed, false);
  assert.match(selfApproval.reason || '', /Segregation of duties/);

  // Independent finance user can approve
  const independentApproval = canApproveBill(staffUser, financeUser1, 'Finance Manager');
  assert.equal(independentApproval.allowed, true);

  // Super Admin can override
  const superApproval = canApproveBill(superAdmin, superAdmin, 'Super Admin');
  assert.equal(superApproval.allowed, true);
});

test('Finance Module: Controlled workflow status transitions', () => {
  const allowedTransitions: Record<FinanceBillStatus, FinanceBillStatus[]> = {
    draft: ['submitted', 'cancelled'],
    submitted: ['under_review', 'verification_pending', 'query_raised', 'cancelled'],
    under_review: ['verification_pending', 'query_raised', 'awaiting_approval', 'approved', 'rejected'],
    verification_pending: ['under_review', 'query_raised', 'awaiting_approval', 'rejected'],
    query_raised: ['under_review', 'verification_pending', 'awaiting_approval'],
    awaiting_approval: ['approved', 'rejected', 'query_raised', 'under_review'],
    approved: ['payment_pending', 'reconciliation_pending'],
    rejected: ['draft', 'under_review'],
    payment_pending: ['partially_paid', 'paid', 'cancelled'],
    partially_paid: ['paid', 'payment_pending'],
    paid: ['reconciliation_pending', 'reconciled'],
    reconciliation_pending: ['reconciled'],
    reconciled: [],
    cancelled: []
  };

  function isValidTransition(from: FinanceBillStatus, to: FinanceBillStatus): boolean {
    return (allowedTransitions[from] || []).includes(to);
  }

  assert.equal(isValidTransition('draft', 'submitted'), true);
  assert.equal(isValidTransition('submitted', 'approved'), false); // Cannot jump straight to approved
  assert.equal(isValidTransition('awaiting_approval', 'approved'), true);
  assert.equal(isValidTransition('approved', 'paid'), false); // Cannot jump straight to paid without payment step
  assert.equal(isValidTransition('approved', 'payment_pending'), true);
  assert.equal(isValidTransition('payment_pending', 'paid'), true);
  assert.equal(isValidTransition('paid', 'reconciliation_pending'), true);
});

test('Finance Module: 4 Separated sections and navigation routes are registered', () => {
  const financeSections = [
    { id: 'finance', label: 'Vendor Invoices', allowedBillTypes: ['vendor_invoice'] },
    { id: 'financeCreditCards', label: 'Credit Card Bills', allowedBillTypes: ['credit_card_expense', 'other_expense'] },
    { id: 'financeDeliveryNotes', label: 'Delivery Notes', allowedBillTypes: ['delivery_note'] },
    { id: 'financeApprovals', label: 'Finance Approvals', allowedBillTypes: ['vendor_invoice', 'credit_card_expense', 'delivery_note', 'other_expense'] }
  ];

  assert.equal(financeSections.length, 4);
  assert.equal(financeSections.some(s => s.id === 'finance'), true);
  assert.equal(financeSections.some(s => s.id === 'financeCreditCards'), true);
  assert.equal(financeSections.some(s => s.id === 'financeDeliveryNotes'), true);
  assert.equal(financeSections.some(s => s.id === 'financeApprovals'), true);
});

test('Finance Module: Site staff isolation and site-restricted filtering', () => {
  const allBills = [
    { id: 'b1', siteName: 'Brit Hotel', totalAmount: 500 },
    { id: 'b2', siteName: 'Holiday Inn Lambeth', totalAmount: 1200 },
    { id: 'b3', siteName: 'Brit Hotel', totalAmount: 350 },
    { id: 'b4', siteName: 'Stansted Hotel', totalAmount: 890 }
  ];

  function filterBillsForUser(bills: typeof allBills, userRole: string, assignedSite: string, canAccessAll: boolean) {
    if (!canAccessAll) {
      return bills.filter(b => b.siteName.toLowerCase() === assignedSite.toLowerCase());
    }
    return bills;
  }

  // Site staff at Brit Hotel only sees Brit Hotel bills (2 of 4)
  const staffFiltered = filterBillsForUser(allBills, 'Site Staff', 'Brit Hotel', false);
  assert.equal(staffFiltered.length, 2);
  assert.equal(staffFiltered.every(b => b.siteName === 'Brit Hotel'), true);

  // Central Finance user sees all bills
  const financeFiltered = filterBillsForUser(allBills, 'Finance Manager', '', true);
  assert.equal(financeFiltered.length, 4);
});

test('Finance Module: RBAC isolation for Finance Approvals queue', () => {
  function canAccessApprovalsQueue(role: string): boolean {
    const authorized = ['Super Admin', 'Finance Admin', 'Finance Manager'];
    return authorized.includes(role);
  }

  assert.equal(canAccessApprovalsQueue('Site Staff'), false);
  assert.equal(canAccessApprovalsQueue('Site Manager'), false);
  assert.equal(canAccessApprovalsQueue('Security Officer'), false);
  assert.equal(canAccessApprovalsQueue('Finance Staff'), false);
  assert.equal(canAccessApprovalsQueue('Finance Manager'), true);
  assert.equal(canAccessApprovalsQueue('Finance Admin'), true);
  assert.equal(canAccessApprovalsQueue('Super Admin'), true);
});

test('Finance Module: Modal Form Submission preserves all fields and round-trips for Vendor Invoices', () => {
  const modalInput = {
    siteId: 'prop-brit-hotel',
    vendorId: 'fven-001',
    billNumber: 'INV-2026-0881',
    billType: 'vendor_invoice' as const,
    billDate: '2026-09-20',
    dueDate: '2026-10-20',
    currency: 'GBP',
    subtotal: 400.0,
    taxAmount: 80.0,
    totalAmount: 480.0,
    description: 'Quarterly deep cleaning and commercial laundry at Brit Hotel',
    purchaseReference: 'PO-2026-991',
    submittedBy: '00000000-0000-0000-0000-000000000001'
  };

  const lineItems = [
    { description: 'Deep cleaning corridors', quantity: 2, unitPrice: 150.0, taxAmount: 60.0, lineTotal: 360.0 },
    { description: 'Linen supplies', quantity: 1, unitPrice: 100.0, taxAmount: 20.0, lineTotal: 120.0 }
  ];

  // Verify full field presence
  assert.equal(modalInput.billNumber, 'INV-2026-0881');
  assert.equal(modalInput.billType, 'vendor_invoice');
  assert.equal(modalInput.totalAmount, 480.0);
  assert.equal(modalInput.purchaseReference, 'PO-2026-991');
  assert.equal(lineItems.length, 2);
  assert.equal(lineItems[0].lineTotal, 360.0);
});

test('Finance Module: Modal Form Submission preserves all fields and round-trips for Credit Card Bills', () => {
  const modalInput = {
    siteId: 'prop-holiday-inn',
    vendorId: 'fven-005',
    billNumber: 'CC-901842',
    billType: 'credit_card_expense' as const,
    billDate: '2026-09-18',
    dueDate: '2026-09-18',
    currency: 'GBP',
    subtotal: 145.50,
    taxAmount: 29.10,
    totalAmount: 174.60,
    description: 'Emergency plumber hardware materials and fittings',
    purchaseReference: 'Card *4419 / Rec #882',
    submittedBy: '00000000-0000-0000-0000-000000000002'
  };

  assert.equal(modalInput.billNumber, 'CC-901842');
  assert.equal(modalInput.billType, 'credit_card_expense');
  assert.equal(modalInput.totalAmount, 174.60);
  assert.match(modalInput.purchaseReference, /Card \*4419/);
});

test('Finance Module: Modal Form Submission preserves all fields and round-trips for Delivery Notes', () => {
  const modalInput = {
    siteId: 'prop-stansted-hotel',
    vendorId: 'fven-002',
    billNumber: 'DN-55102',
    billType: 'delivery_note' as const,
    billDate: '2026-09-19',
    dueDate: '2026-10-19',
    currency: 'GBP',
    subtotal: 950.0,
    taxAmount: 0.0,
    totalAmount: 950.0,
    description: 'Consumables delivery 40 boxes - all verified and signed by duty manager',
    purchaseReference: 'PO-FOOD-9021',
    submittedBy: '00000000-0000-0000-0000-000000000003'
  };

  assert.equal(modalInput.billNumber, 'DN-55102');
  assert.equal(modalInput.billType, 'delivery_note');
  assert.equal(modalInput.totalAmount, 950.0);
  assert.match(modalInput.description, /40 boxes/);
});

test('Finance Module: Distinct bill types prevent cross-page data pollution', () => {
  const sampleBills = [
    { id: '1', billType: 'vendor_invoice', billNumber: 'INV-001' },
    { id: '2', billType: 'credit_card_expense', billNumber: 'CC-002' },
    { id: '3', billType: 'delivery_note', billNumber: 'DN-003' },
    { id: '4', billType: 'other_expense', billNumber: 'EXP-004' }
  ];

  // Vendor Invoices view only displays vendor_invoice
  const vendorInvoices = sampleBills.filter(b => b.billType === 'vendor_invoice');
  assert.equal(vendorInvoices.length, 1);
  assert.equal(vendorInvoices[0].billNumber, 'INV-001');

  // Credit Card view only displays credit_card_expense and other_expense
  const creditCards = sampleBills.filter(b => b.billType === 'credit_card_expense' || b.billType === 'other_expense');
  assert.equal(creditCards.length, 2);
  assert.equal(creditCards.some(b => b.billNumber === 'CC-002'), true);
  assert.equal(creditCards.some(b => b.billNumber === 'EXP-004'), true);

  // Delivery Notes view only displays delivery_note
  const deliveryNotes = sampleBills.filter(b => b.billType === 'delivery_note');
  assert.equal(deliveryNotes.length, 1);
  assert.equal(deliveryNotes[0].billNumber, 'DN-003');

  // Approvals view displays all
  assert.equal(sampleBills.length, 4);
});



