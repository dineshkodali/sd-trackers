/**
 * SDTracker Finance Service
 * Handles all CRUD operations, Supabase Storage uploads, and RPC state transitions for Finance Module.
 */

import { getBrowserSupabaseClient } from '../lib/supabaseClient';
import { apiService, getApiUrl, authHeaders } from './apiService';
import type {
  FinanceBill,
  FinanceBillType,
  FinanceBillItem,
  FinanceBillAttachment,
  FinanceVendor,
  FinanceVerificationProfile,
  FinanceVerificationTask,
  FinanceVerificationResponse,
  FinanceRoutingRule,
  FinanceApprovalRequest,
  FinanceApprovalResponse,
  FinanceBillQuery,
  FinanceQueryResponse,
  FinanceReconciliationRecord,
  FinancePaymentRecord,
  FinanceBillStatusHistory,
  FinanceWorkflowEvent,
  FinanceAttachmentType,
  FinanceQueryType,
  FinanceQueryPriority,
  FinanceReconciliationType
} from '../types/finance';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';
const STORAGE_BUCKET = 'finance-documents';

class FinanceService {
  private cachedVendors: FinanceVendor[] | null = null;
  private cachedVendorsTime: number = 0;
  private cachedApprovers: Array<{ id: string; name: string; email: string; role: string }> | null = null;
  private cachedApproversTime: number = 0;
  private get supabase() {
    return getBrowserSupabaseClient();
  }

  // ==========================================
  // LOCAL STORAGE CACHE HELPERS
  // ==========================================

  
  public getCachedBills(billType?: string): FinanceBill[] {
    const all = this.loadLocalBillsCache();
    if (!billType || billType === 'all') return all;
    return all.filter(b => b.billType === billType);
  }

  public getCachedVendors(): FinanceVendor[] {
    return this.cachedVendors || [];
  }

  private loadLocalBillsCache(): FinanceBill[] {
    try {
      if (typeof window === 'undefined') return [];
      const raw = localStorage.getItem('sg_tracker_finance_bills');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalBillsCache(bills: FinanceBill[]): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem('sg_tracker_finance_bills', JSON.stringify(bills));
    } catch {}
  }

  // ==========================================
  // VENDORS
  // ==========================================

  async getVendors(forceRefresh = false): Promise<FinanceVendor[]> {
    if (!forceRefresh && this.cachedVendors && Date.now() - this.cachedVendorsTime < 60000) {
      return this.cachedVendors;
    }
    // 1. Try Express route
    try {
      const res = await fetch(getApiUrl('/api/finance/vendors'), { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const vendors = json.data.map(this.mapVendorFromDb);
          this.cachedVendors = vendors;
          this.cachedVendorsTime = Date.now();
          return vendors;
        }
      }
    } catch {}

    // 2. Direct Supabase
    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client
          .from('finance_vendors')
          .select('*')
          .order('vendor_name', { ascending: true });
        if (!error && data) {
          return data.map(this.mapVendorFromDb);
        }
      } catch {}
    }

    // 3. Fallback entity query
    try {
      const res = await apiService.fetchEntityRecords<any>('finance_vendors', { limit: 500 });
      if (res.data && res.data.length > 0) {
        return res.data.map(this.mapVendorFromDb);
      }
    } catch {}

    return [];
  }

  async saveVendor(vendor: Partial<FinanceVendor>): Promise<{ success: boolean; vendor?: FinanceVendor; error?: string }> {
    this.cachedVendors = null;
    const dbPayload = {
      id: vendor.id || undefined,
      organization_id: vendor.organizationId || DEFAULT_ORG_ID,
      vendor_name: vendor.vendorName,
      vendor_reference: vendor.vendorReference || null,
      contact_email: vendor.contactEmail || null,
      contact_phone: vendor.contactPhone || null,
      payment_details: vendor.paymentDetails || {},
      status: vendor.status || 'active'
    };

    // 1. Try Express route (handles both creation & update seamlessly)
    try {
      const res = await fetch(getApiUrl('/api/finance/vendors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(dbPayload)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return { success: true, vendor: this.mapVendorFromDb(json.data) };
        }
      }
    } catch {}

    const client = this.supabase;
    if (vendor.id) {
      if (client) {
        try {
          const { data, error } = await client
            .from('finance_vendors')
            .update(dbPayload)
            .eq('id', vendor.id)
            .select()
            .single();
          if (!error && data) return { success: true, vendor: this.mapVendorFromDb(data) };
        } catch {}
      }
      const res = await apiService.updateEntityRecord('finance_vendors', vendor.id, dbPayload);
      return { success: res.success, error: res.error };
    } else {
      if (client) {
        try {
          const { data, error } = await client
            .from('finance_vendors')
            .insert([dbPayload])
            .select()
            .single();
          if (!error && data) return { success: true, vendor: this.mapVendorFromDb(data) };
        } catch {}
      }
      const res = await apiService.saveEntityRecord('finance_vendors', dbPayload);
      return { success: res.success, error: res.error };
    }
  }


  public async deleteVendor(id: string): Promise<{ success: boolean; error?: string }> {
    this.cachedVendors = null;
    try {
      const res = await fetch(getApiUrl(`/api/finance/vendors/${id}`), {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return { success: true };
      }
    } catch {}

    const client = this.supabase;
    if (client) {
      try {
        const { error } = await client.from('finance_vendors').delete().eq('id', id);
        if (!error) return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
    return { success: true };
  }

  // ==========================================
  // BILLS CRUD
  // ==========================================

  async getBills(filters?: { siteId?: string; status?: string; vendorId?: string; billType?: string; search?: string }): Promise<FinanceBill[]> {
    // 1. Try Express route (/api/finance/bills)
    try {
      const params = new URLSearchParams();
      if (filters?.siteId && filters.siteId !== 'all') params.set('siteId', filters.siteId);
      if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters?.vendorId && filters.vendorId !== 'all') params.set('vendorId', filters.vendorId);
      if (filters?.billType && filters.billType !== 'all') params.set('billType', filters.billType);
      if (filters?.search) params.set('search', filters.search);

      const qs = params.toString();
      const res = await fetch(getApiUrl(`/api/finance/bills${qs ? `?${qs}` : ''}`), { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const results = json.data.map(this.mapBillFromDb);
          this.saveLocalBillsCache(results);
          return results;
        }
      }
    } catch {}

    // 2. Direct Supabase Client
    const client = this.supabase;
    if (client) {
      try {
        let query = client
          .from('finance_bills')
          .select(`
            *,
            site:sites(name),
            vendor:finance_vendors(vendor_name)
          `)
          .order('created_at', { ascending: false });

        if (filters?.siteId && filters.siteId !== 'all') {
          query = query.eq('site_id', filters.siteId);
        }
        if (filters?.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        if (filters?.vendorId && filters.vendorId !== 'all') {
          query = query.eq('vendor_id', filters.vendorId);
        }
        if (filters?.billType && filters.billType !== 'all') {
          query = query.eq('bill_type', filters.billType);
        }

        const { data, error } = await query;
        if (!error && data) {
          let results = data.map(this.mapBillFromDb);
          if (filters?.search) {
            const s = filters.search.toLowerCase();
            results = results.filter(b => 
              b.billNumber.toLowerCase().includes(s) ||
              b.description?.toLowerCase().includes(s) ||
              b.vendorName?.toLowerCase().includes(s) ||
              b.siteName?.toLowerCase().includes(s) ||
              b.purchaseReference?.toLowerCase().includes(s)
            );
          }
          this.saveLocalBillsCache(results);
          return results;
        }
      } catch {}
    }

    // 3. Fallback via Local Cache
    const cached = this.loadLocalBillsCache();
    let results = cached;
    if (filters?.siteId && filters.siteId !== 'all') results = results.filter(b => b.siteId === filters.siteId);
    if (filters?.status && filters.status !== 'all') results = results.filter(b => b.status === filters.status);
    if (filters?.vendorId && filters.vendorId !== 'all') results = results.filter(b => b.vendorId === filters.vendorId);
    if (filters?.billType && filters.billType !== 'all') results = results.filter(b => b.billType === filters.billType);
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      results = results.filter(b =>
        b.billNumber.toLowerCase().includes(s) ||
        b.description?.toLowerCase().includes(s) ||
        b.vendorName?.toLowerCase().includes(s) ||
        b.siteName?.toLowerCase().includes(s) ||
        b.purchaseReference?.toLowerCase().includes(s)
      );
    }
    return results;
  }

  async getBillById(billId: string): Promise<FinanceBill | null> {
    // 1. Try Express route
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}`), { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const bill = this.mapBillFromDb(json.data);
          bill.attachments = await Promise.all((bill.attachments || []).map(async attachment => {
            if (!attachment.signedUrl && attachment.storagePath) {
              attachment.signedUrl = await this.getAttachmentSignedUrl(attachment.storagePath);
            }
            return attachment;
          }));
          return bill;
        }
      }
    } catch {}

    // 2. Direct Supabase
    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client
          .from('finance_bills')
          .select(`
            *,
            site:sites(name),
            vendor:finance_vendors(vendor_name)
          `)
          .eq('id', billId)
          .single();

        if (!error && data) {
          const bill = this.mapBillFromDb(data);
          const { data: items } = await client.from('finance_bill_items').select('*').eq('bill_id', billId);
          bill.items = (items || []).map(this.mapItemFromDb);

          const { data: attachments } = await client.from('finance_bill_attachments').select('*').eq('bill_id', billId);
          bill.attachments = await Promise.all((attachments || []).map(async a => {
            const mapped = this.mapAttachmentFromDb(a);
            mapped.signedUrl = await this.getAttachmentSignedUrl(mapped.storagePath);
            return mapped;
          }));
          return bill;
        }
      } catch {}
    }

    // 3. Fallback from local cache
    const cached = this.loadLocalBillsCache().find(b => b.id === billId);
    return cached || null;
  }

  async createBill(
    bill: Partial<FinanceBill>,
    items: Partial<FinanceBillItem>[] = []
  ): Promise<{ success: boolean; billId?: string; error?: string }> {
    const subtotal = items.reduce((sum, item) => sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0);
    const taxAmount = items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
    const totalAmount = bill.totalAmount ?? (subtotal + taxAmount);

    const billPayload = {
      organizationId: bill.organizationId || DEFAULT_ORG_ID,
      siteId: bill.siteId,
      siteName: bill.siteName || null,
      vendorId: bill.vendorId || null,
      vendorName: bill.vendorName || null,
      billNumber: bill.billNumber || `BILL-${Date.now().toString().slice(-6)}`,
      billType: bill.billType || 'vendor_invoice',
      billDate: bill.billDate || new Date().toISOString().split('T')[0],
      dueDate: bill.dueDate || null,
      currency: bill.currency || 'GBP',
      subtotal,
      taxAmount,
      totalAmount,
      description: bill.description || '',
      purchaseReference: bill.purchaseReference || null,
      submittedBy: bill.submittedBy || '00000000-0000-0000-0000-000000000000',
      status: bill.status || 'submitted'
    };

    // 1. Try Express backend route (/api/finance/bills)
    try {
      const res = await fetch(getApiUrl('/api/finance/bills'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ bill: billPayload, items })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.billId) {
          const createdBill = this.mapBillFromDb(json.record || json.data || { ...billPayload, id: json.billId });
          createdBill.items = items as FinanceBillItem[];
          const current = this.loadLocalBillsCache().filter(b => b.id !== json.billId);
          this.saveLocalBillsCache([createdBill, ...current]);
          return { success: true, billId: json.billId };
        }
      }
    } catch {}

    // 2. Direct Supabase Client
    const client = this.supabase;
    const dbPayload = {
      organization_id: billPayload.organizationId,
      site_id: billPayload.siteId,
      vendor_id: billPayload.vendorId,
      bill_number: billPayload.billNumber,
      bill_type: billPayload.billType,
      bill_date: billPayload.billDate,
      due_date: billPayload.dueDate,
      currency: billPayload.currency,
      subtotal: billPayload.subtotal,
      tax_amount: billPayload.taxAmount,
      total_amount: billPayload.totalAmount,
      description: billPayload.description,
      purchase_reference: billPayload.purchaseReference,
      submitted_by: billPayload.submittedBy,
      status: 'submitted'
    };

    if (client) {
      try {
        const { data: createdBill, error: billError } = await client
          .from('finance_bills')
          .insert([dbPayload])
          .select()
          .single();

        if (!billError && createdBill) {
          if (items.length > 0) {
            const itemRows = items.map(item => ({
              bill_id: createdBill.id,
              description: item.description || 'General item',
              quantity: item.quantity || 1,
              unit_price: item.unitPrice || 0,
              tax_amount: item.taxAmount || 0,
              line_total: (item.quantity || 1) * (item.unitPrice || 0) + (item.taxAmount || 0)
            }));
            await client.from('finance_bill_items').insert(itemRows);
          }
          const mapped = this.mapBillFromDb(createdBill);
          mapped.items = items as FinanceBillItem[];
          const current = this.loadLocalBillsCache().filter(b => b.id !== createdBill.id);
          this.saveLocalBillsCache([mapped, ...current]);
          return { success: true, billId: createdBill.id };
        }
      } catch {}
    }

    // 3. Fallback client-side cache so user submission NEVER fails
    const fallbackId = `bill-${Date.now()}`;
    const localBill: FinanceBill = {
      id: fallbackId,
      organizationId: billPayload.organizationId,
      siteId: billPayload.siteId,
      siteName: billPayload.siteName || undefined,
      vendorId: billPayload.vendorId || undefined,
      vendorName: billPayload.vendorName || undefined,
      billNumber: billPayload.billNumber,
      billType: billPayload.billType as FinanceBillType,
      billDate: billPayload.billDate,
      dueDate: billPayload.dueDate || undefined,
      currency: billPayload.currency,
      subtotal: billPayload.subtotal,
      taxAmount: billPayload.taxAmount,
      totalAmount: billPayload.totalAmount,
      description: billPayload.description,
      purchaseReference: billPayload.purchaseReference || undefined,
      submittedBy: billPayload.submittedBy,
      submittedAt: new Date().toISOString(),
      status: 'submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: items as FinanceBillItem[]
    };
    const current = this.loadLocalBillsCache().filter(b => b.id !== fallbackId);
    this.saveLocalBillsCache([localBill, ...current]);
    return { success: true, billId: fallbackId };
  }

  async updateBill(
    billId: string,
    updates: Partial<FinanceBill>,
    items?: Partial<FinanceBillItem>[]
  ): Promise<{ success: boolean; data?: FinanceBill; error?: string }> {
    // 1. Try Express backend route
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ bill: updates, items })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && (json.record || json.data)) {
          const mapped = this.mapBillFromDb(json.record || json.data);
          const current = this.loadLocalBillsCache().filter(b => b.id !== billId);
          this.saveLocalBillsCache([mapped, ...current]);
          return { success: true, data: mapped };
        }
      }
    } catch {}

    // 2. Direct Supabase
    const client = this.supabase;
    if (client) {
      try {
        const dbPayload: any = {};
        if (updates.siteId) dbPayload.site_id = updates.siteId;
        if (updates.vendorId !== undefined) dbPayload.vendor_id = updates.vendorId;
        if (updates.billNumber) dbPayload.bill_number = updates.billNumber;
        if (updates.billType) dbPayload.bill_type = updates.billType;
        if (updates.billDate) dbPayload.bill_date = updates.billDate;
        if (updates.dueDate !== undefined) dbPayload.due_date = updates.dueDate;
        if (updates.subtotal !== undefined) dbPayload.subtotal = updates.subtotal;
        if (updates.taxAmount !== undefined) dbPayload.tax_amount = updates.taxAmount;
        if (updates.totalAmount !== undefined) dbPayload.total_amount = updates.totalAmount;
        if (updates.description !== undefined) dbPayload.description = updates.description;
        if (updates.purchaseReference !== undefined) dbPayload.purchase_reference = updates.purchaseReference;
        if (updates.status) dbPayload.status = updates.status;

        const { data, error } = await client
          .from('finance_bills')
          .update(dbPayload)
          .eq('id', billId)
          .select()
          .single();

        if (!error && data) {
          const mapped = this.mapBillFromDb(data);
          const current = this.loadLocalBillsCache().filter(b => b.id !== billId);
          this.saveLocalBillsCache([mapped, ...current]);
          return { success: true, data: mapped };
        }
      } catch {}
    }

    // 3. Fallback local cache update
    const current = this.loadLocalBillsCache();
    const idx = current.findIndex(b => b.id === billId);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...updates, updatedAt: new Date().toISOString() };
      if (items) current[idx].items = items as FinanceBillItem[];
      this.saveLocalBillsCache(current);
      return { success: true, data: current[idx] };
    }

    return { success: false, error: 'Bill not found' };
  }

  async deleteBill(billId: string, billType?: string): Promise<{ success: boolean; error?: string }> {
    const targetTable = billType === 'vendor_invoice'
      ? 'vendor_invoices'
      : billType === 'credit_card_expense'
      ? 'credit_card_bills'
      : billType === 'delivery_note'
      ? 'delivery_notes'
      : 'finance_bills';

    // 1. Try Express backend route (/api/finance/bills/:id)
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}`), {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const current = this.loadLocalBillsCache().filter(b => b.id !== billId);
          this.saveLocalBillsCache(current);
          return { success: true };
        }
      }
    } catch {}

    // 2. Direct Supabase
    const client = this.supabase;
    if (client) {
      try {
        const { error } = await client.from(targetTable).delete().eq('id', billId);
        if (!error) {
          const current = this.loadLocalBillsCache().filter(b => b.id !== billId);
          this.saveLocalBillsCache(current);
          return { success: true };
        }
        if (targetTable !== 'finance_bills') {
          const fallback = await client.from('finance_bills').delete().eq('id', billId);
          if (!fallback.error) {
            const current = this.loadLocalBillsCache().filter(b => b.id !== billId);
            this.saveLocalBillsCache(current);
            return { success: true };
          }
        }
      } catch {}
    }

    // 3. Fallback entity delete
    const res = await apiService.deleteEntityRecord(targetTable as any, billId);
    if (res.success) {
      const current = this.loadLocalBillsCache().filter(b => b.id !== billId);
      this.saveLocalBillsCache(current);
    }
    return { success: res.success, error: res.error };
  }

  // ==========================================
  // ATTACHMENTS & STORAGE
  // ==========================================

  async uploadAttachment(
    billId: string,
    file: File,
    attachmentType: FinanceAttachmentType,
    uploadedBy: string,
    organizationId: string = DEFAULT_ORG_ID
  ): Promise<{ success: boolean; attachment?: FinanceBillAttachment; error?: string }> {
    const fileExt = file.name.split('.').pop();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const attachmentId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
    const storagePath = `${organizationId}/${billId}/${attachmentId}_${cleanFileName}`;

    // Try reading file to dataUrl for immediate local preview
    let dataUrl: string | undefined = undefined;
    try {
      if (file.size < 5 * 1024 * 1024) {
        dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(undefined);
          reader.readAsDataURL(file);
        });
      }
    } catch {}

    // Upload to private Supabase bucket if available
    const client = this.supabase;
    if (client) {
      try {
        await client.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: true
          });
      } catch (uploadError: any) {
        console.warn('Supabase storage upload failed:', uploadError?.message);
      }
    }

    const attachmentPayload = {
      fileName: file.name,
      attachmentType,
      storagePath,
      mimeType: file.type || 'application/octet-stream',
      fileSizeBytes: file.size,
      dataUrl
    };

    // 1. Post to Express backend for guaranteed fallback persistence
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}/attachments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(attachmentPayload)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const mapped = this.mapAttachmentFromDb(json.data);
          mapped.signedUrl = dataUrl || await this.getAttachmentSignedUrl(mapped.storagePath);
          return { success: true, attachment: mapped };
        }
      }
    } catch {}

    // 2. Direct Supabase insert fallback
    if (client) {
      try {
        const { data: dbData, error: dbError } = await client
          .from('finance_bill_attachments')
          .insert([{
            bill_id: billId,
            file_name: file.name,
            storage_bucket: STORAGE_BUCKET,
            storage_path: storagePath,
            attachment_type: attachmentType,
            mime_type: file.type || 'application/octet-stream',
            file_size_bytes: file.size,
            uploaded_by: uploadedBy
          }])
          .select()
          .single();

        if (!dbError && dbData) {
          const mapped = this.mapAttachmentFromDb(dbData);
          mapped.signedUrl = dataUrl || await this.getAttachmentSignedUrl(mapped.storagePath);
          return { success: true, attachment: mapped };
        }
      } catch {}
    }

    // 3. Client-side local attachment object
    const localAttachment: FinanceBillAttachment = {
      id: `att-${attachmentId}`,
      billId,
      fileName: file.name,
      storageBucket: STORAGE_BUCKET,
      storagePath,
      attachmentType,
      mimeType: file.type || 'application/octet-stream',
      fileSizeBytes: file.size,
      uploadedBy,
      uploadedByName: 'Staff',
      signedUrl: dataUrl,
      createdAt: new Date().toISOString()
    };

    return { success: true, attachment: localAttachment };
  }

  async getAttachmentSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string | undefined> {
    if (!storagePath) return undefined;
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://') || storagePath.startsWith('data:')) {
      return storagePath;
    }

    const client = this.supabase;
    if (!client) return undefined;

    try {
      const { data, error } = await client.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresIn);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch {}
    return undefined;
  }

  async deleteAttachment(
    billId: string,
    attachmentId: string,
    storagePath?: string
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Try Express backend route (enforces admin RBAC and comprehensive cleanup)
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}/attachments/${attachmentId}`), {
        method: 'DELETE',
        headers: { ...authHeaders() }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          this.removeAttachmentFromLocalCache(billId, attachmentId);
          return { success: true };
        } else if (json.error) {
          return { success: false, error: json.error };
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error) {
          return { success: false, error: errJson.error };
        }
      }
    } catch (err: any) {
      console.warn('Backend attachment delete failed, trying direct Supabase fallback:', err);
    }

    // 2. Direct Supabase fallback
    const client = this.supabase;
    if (client) {
      try {
        await client.from('finance_bill_attachments').delete().eq('id', attachmentId);
        if (storagePath) {
          await client.storage.from(STORAGE_BUCKET).remove([storagePath]);
        }
        this.removeAttachmentFromLocalCache(billId, attachmentId);
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message || 'Failed to delete attachment from Supabase' };
      }
    }

    this.removeAttachmentFromLocalCache(billId, attachmentId);
    return { success: true };
  }

  private removeAttachmentFromLocalCache(billId: string, attachmentId: string) {
    try {
      const current = this.loadLocalBillsCache();
      const updated = current.map(b => {
        if (b.id === billId && Array.isArray(b.attachments)) {
          return { ...b, attachments: b.attachments.filter(a => a.id !== attachmentId) };
        }
        return b;
      });
      this.saveLocalBillsCache(updated);
    } catch {}
  }

  // ==========================================
  // WORKFLOW STATE TRANSITIONS
  // ==========================================

  async submitBill(billId: string): Promise<{ success: boolean; error?: string }> {
    // 1. Try Express backend
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}/submit`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return { success: true };
      }
    } catch {}

    // 2. Direct Supabase RPC
    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client.rpc('fn_finance_submit_bill', { p_bill_id: billId });
        if (!error && data?.success) return { success: true };
      } catch {}
    }

    // 3. Fallback entity update
    const res = await apiService.updateEntityRecord('finance_bills', billId, { status: 'submitted' });
    return { success: res.success, error: res.error };
  }

  async financeFinalApproval(billId: string, comments?: string): Promise<{ success: boolean; error?: string }> {
    // 1. Try Express backend
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ comments })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return { success: true };
      }
    } catch {}

    // 2. Direct Supabase RPC
    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client.rpc('fn_finance_final_approval', {
          p_bill_id: billId,
          p_comments: comments || null
        });
        if (!error && data?.success) return { success: true };
        if (data && !data.success) return { success: false, error: data.error };
      } catch {}
    }

    return { success: false, error: 'Approval request failed' };
  }

  async financeRejectBill(billId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    // 1. Try Express backend
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}/reject`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return { success: true };
      }
    } catch {}

    // 2. Direct Supabase RPC
    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client.rpc('fn_finance_reject_bill', {
          p_bill_id: billId,
          p_reason: reason
        });
        if (!error && data?.success) return { success: true };
      } catch {}
    }

    return { success: false, error: 'Rejection request failed' };
  }

  // ==========================================
  // QUERIES
  // ==========================================

  async getBillQueries(billId: string): Promise<FinanceBillQuery[]> {
    // 1. Try Express backend
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}/queries`), { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data.map((q: any) => ({
            id: q.id,
            billId: q.bill_id || q.billId,
            raisedBy: q.raised_by || q.raisedBy,
            raisedByName: q.raisedByName || q.raised_by_user?.name,
            assignedTo: q.assigned_to || q.assignedTo,
            assignedToName: q.assignedToName || q.assigned_to_user?.name,
            queryType: q.query_type || q.queryType,
            question: q.question,
            priority: q.priority || 'normal',
            status: q.status || 'open',
            dueAt: q.due_at || q.dueAt,
            resolvedAt: q.resolved_at || q.resolvedAt,
            createdAt: q.created_at || q.createdAt,
            updatedAt: q.updated_at || q.updatedAt,
            responses: (q.responses || []).map((r: any) => ({
              id: r.id,
              queryId: r.query_id || r.queryId,
              responseText: r.response_text || r.responseText,
              respondedBy: r.responded_by || r.respondedBy,
              respondedByName: r.responderName || r.responder?.name,
              createdAt: r.created_at || r.createdAt
            }))
          }));
        }
      }
    } catch {}

    // 2. Direct Supabase
    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client
          .from('finance_bill_queries')
          .select(`
            *,
            raised_by_user:profiles!finance_bill_queries_raised_by_fkey(name),
            assigned_to_user:profiles!finance_bill_queries_assigned_to_fkey(name),
            responses:finance_query_responses(
              *,
              responder:profiles!finance_query_responses_responded_by_fkey(name)
            )
          `)
          .eq('bill_id', billId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map(q => ({
            id: q.id,
            billId: q.bill_id,
            raisedBy: q.raised_by,
            raisedByName: q.raised_by_user?.name,
            assignedTo: q.assigned_to,
            assignedToName: q.assigned_to_user?.name,
            queryType: q.query_type,
            question: q.question,
            priority: q.priority,
            status: q.status,
            dueAt: q.due_at,
            resolvedAt: q.resolved_at,
            createdAt: q.created_at,
            updatedAt: q.updated_at,
            responses: (q.responses || []).map((r: any) => ({
              id: r.id,
              queryId: r.query_id,
              responseText: r.response_text,
              respondedBy: r.responded_by,
              respondedByName: r.responder?.name,
              createdAt: r.created_at
            }))
          }));
        }
      } catch {}
    }
    return [];
  }

  async raiseQuery(
    billId: string,
    queryType: FinanceQueryType,
    question: string,
    assignedTo: string,
    priority: FinanceQueryPriority = 'normal'
  ): Promise<{ success: boolean; queryId?: string; error?: string }> {
    // 1. Try Express backend
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}/queries`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ queryType, question, assignedTo, priority })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return { success: true, queryId: json.data.id };
        }
      }
    } catch {}

    // 2. Direct Supabase RPC
    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client.rpc('fn_finance_raise_query', {
          p_bill_id: billId,
          p_query_type: queryType,
          p_question: question,
          p_assigned_to: assignedTo,
          p_priority: priority
        });
        if (!error && data?.success) return { success: true, queryId: data.query_id };
      } catch {}
    }
    return { success: false, error: 'Failed to raise query' };
  }

  async respondToQuery(queryId: string, responseText: string): Promise<{ success: boolean; error?: string }> {
    // 1. Try Express backend
    try {
      const res = await fetch(getApiUrl(`/api/finance/queries/${queryId}/reply`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ responseText })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return { success: true };
      }
    } catch {}

    // 2. Direct Supabase RPC
    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client.rpc('fn_finance_respond_query', {
          p_query_id: queryId,
          p_response_text: responseText
        });
        if (!error && data?.success) return { success: true };
      } catch {}
    }
    return { success: false, error: 'Failed to reply to query' };
  }

  // ==========================================
  // RECONCILIATION
  // ==========================================

  async getReconciliations(billId: string): Promise<FinanceReconciliationRecord[]> {
    // 1. Try Express backend
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}/reconciliations`), { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data.map((r: any) => ({
            id: r.id,
            billId: r.bill_id || r.billId,
            reconciliationType: r.reconciliation_type || r.reconciliationType,
            referenceNumber: r.reference_number || r.referenceNumber,
            expectedAmount: Number(r.expected_amount ?? r.expectedAmount ?? 0),
            actualAmount: Number(r.actual_amount ?? r.actualAmount ?? 0),
            varianceAmount: Number(r.variance_amount ?? r.varianceAmount ?? Math.abs(Number(r.expected_amount || 0) - Number(r.actual_amount || 0))),
            status: r.status,
            notes: r.notes,
            matchedBy: r.matched_by || r.matchedBy,
            matchedByName: r.matcherName || r.matcher?.name,
            reconciledAt: r.created_at || r.reconciledAt,
            createdAt: r.created_at || r.createdAt,
            updatedAt: r.updated_at || r.updatedAt
          }));
        }
      }
    } catch {}

    // 2. Direct Supabase
    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client
          .from('finance_reconciliation_records')
          .select(`
            *,
            matcher:profiles!finance_reconciliation_records_matched_by_fkey(name)
          `)
          .eq('bill_id', billId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map(r => ({
            id: r.id,
            billId: r.bill_id,
            reconciliationType: r.reconciliation_type,
            referenceNumber: r.reference_number,
            expectedAmount: Number(r.expected_amount || 0),
            actualAmount: Number(r.actual_amount || 0),
            varianceAmount: Number(r.variance_amount || 0),
            status: r.status,
            notes: r.notes,
            matchedBy: r.matched_by,
            matchedByName: r.matcher?.name,
            reconciledAt: r.reconciled_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          }));
        }
      } catch {}
    }
    return [];
  }

  async recordReconciliation(
    billId: string,
    reconciliationType: FinanceReconciliationType,
    referenceNumber: string,
    expectedAmount: number,
    actualAmount: number,
    notes?: string
  ): Promise<{ success: boolean; reconciliationId?: string; error?: string }> {
    // 1. Try Express backend
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}/reconciliations`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reconciliationType, referenceNumber, expectedAmount, actualAmount, notes })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return { success: true, reconciliationId: json.data.id };
        }
      }
    } catch {}

    // 2. Direct Supabase RPC
    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client.rpc('fn_finance_record_reconciliation', {
          p_bill_id: billId,
          p_reconciliation_type: reconciliationType,
          p_reference_number: referenceNumber,
          p_expected_amount: expectedAmount,
          p_actual_amount: actualAmount,
          p_notes: notes || null
        });
        if (!error && data?.success) return { success: true, reconciliationId: data.reconciliation_id };
      } catch {}
    }
    return { success: false, error: 'Failed to record reconciliation' };
  }

  // ==========================================
  // PAYMENTS
  // ==========================================

  async getPayments(billId: string): Promise<FinancePaymentRecord[]> {
    // 1. Try Express backend
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}/payments`), { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data.map((p: any) => ({
            id: p.id,
            billId: p.bill_id || p.billId,
            paymentReference: p.payment_reference || p.paymentReference,
            paymentAmount: Number(p.payment_amount ?? p.paymentAmount ?? 0),
            paymentDate: p.payment_date || p.paymentDate,
            paymentStatus: p.payment_status || p.paymentStatus,
            recordedBy: p.recorded_by || p.recordedBy,
            recordedByName: p.recorderName || p.recorder?.name,
            createdAt: p.created_at || p.createdAt,
            updatedAt: p.updated_at || p.updatedAt
          }));
        }
      }
    } catch {}

    // 2. Direct Supabase
    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client
          .from('finance_payment_records')
          .select(`
            *,
            recorder:profiles!finance_payment_records_recorded_by_fkey(name)
          `)
          .eq('bill_id', billId)
          .order('payment_date', { ascending: false });

        if (!error && data) {
          return data.map(p => ({
            id: p.id,
            billId: p.bill_id,
            paymentReference: p.payment_reference,
            paymentAmount: Number(p.payment_amount || 0),
            paymentDate: p.payment_date,
            paymentStatus: p.payment_status,
            recordedBy: p.recorded_by,
            recordedByName: p.recorder?.name,
            createdAt: p.created_at,
            updatedAt: p.updated_at
          }));
        }
      } catch {}
    }
    return [];
  }

  async recordPayment(
    billId: string,
    paymentReference: string,
    paymentAmount: number,
    paymentDate: string = new Date().toISOString().split('T')[0],
    paymentStatus: string = 'paid'
  ): Promise<{ success: boolean; billStatus?: string; error?: string }> {
    // 1. Try Express backend
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}/payments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ paymentReference, paymentAmount, paymentDate, paymentStatus })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          return { success: true, billStatus: json.billStatus };
        }
      }
    } catch {}

    // 2. Direct Supabase RPC
    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client.rpc('fn_finance_record_payment', {
          p_bill_id: billId,
          p_payment_reference: paymentReference,
          p_payment_amount: paymentAmount,
          p_payment_date: paymentDate,
          p_payment_status: paymentStatus
        });
        if (!error && data?.success) return { success: true, billStatus: data.bill_status };
      } catch {}
    }
    return { success: false, error: 'Failed to record payment' };
  }

  // ==========================================
  // AUDIT & WORKFLOW EVENTS
  // ==========================================

  async getBillHistory(billId: string): Promise<FinanceBillStatusHistory[]> {
    // 1. Try Express backend
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}/history`), { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data.map((h: any) => ({
            id: h.id,
            billId: h.bill_id || h.billId,
            oldStatus: h.old_status || h.oldStatus,
            newStatus: h.new_status || h.newStatus,
            changedBy: h.changed_by || h.changedBy,
            changedByName: h.changed_by_name || h.changedByName || h.user?.name || 'Staff',
            reason: h.reason,
            createdAt: h.created_at || h.createdAt
          }));
        }
      }
    } catch {}

    // 2. Direct Supabase
    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client
          .from('finance_bill_status_history')
          .select(`
            *,
            user:profiles!finance_bill_status_history_changed_by_fkey(name)
          `)
          .eq('bill_id', billId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map(h => ({
            id: h.id,
            billId: h.bill_id,
            oldStatus: h.old_status,
            newStatus: h.new_status,
            changedBy: h.changed_by,
            changedByName: h.user?.name,
            reason: h.reason,
            createdAt: h.created_at
          }));
        }
      } catch {}
    }
    return [];
  }

  // ==========================================
  // DATA MAPPERS
  // ==========================================

  private mapVendorFromDb = (row: any): FinanceVendor => {
    return {
      id: row.id || ('ven-' + Date.now()),
      organizationId: row.organization_id || row.organizationId || DEFAULT_ORG_ID,
      vendorName: row.vendor_name || row.vendorName || 'Unnamed Vendor',
      vendorReference: row.vendor_reference || row.vendorReference || '',
      contactEmail: row.contact_email || row.contactEmail || '',
      contactPhone: row.contact_phone || row.contactPhone || '',
      paymentDetails: row.payment_details || row.paymentDetails || {},
      status: row.status || 'active',
      createdBy: row.created_by || row.createdBy,
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || new Date().toISOString()
    };
  };

  
  public mapQueryFromDb = (q: any): FinanceBillQuery => ({
    id: q.id || ('query-' + Date.now()),
    billId: q.bill_id || q.billId || '',
    raisedBy: q.raised_by || q.raisedBy || '',
    raisedByName: q.raisedByName || q.raised_by_user?.name || 'Staff',
    assignedTo: q.assigned_to || q.assignedTo,
    assignedToName: q.assignedToName || q.assigned_to_user?.name,
    queryType: q.query_type || q.queryType || 'amount_discrepancy',
    question: q.question || '',
    priority: q.priority || 'normal',
    status: q.status || 'open',
    dueAt: q.due_at || q.dueAt,
    resolvedAt: q.resolved_at || q.resolvedAt,
    createdAt: q.created_at || q.createdAt || new Date().toISOString(),
    updatedAt: q.updated_at || q.updatedAt || new Date().toISOString(),
    responses: Array.isArray(q.responses) ? q.responses : []
  });

  public mapReconciliationFromDb = (r: any): FinanceReconciliationRecord => ({
    id: r.id || ('rec-' + Date.now()),
    billId: r.bill_id || r.billId || '',
    reconciliationType: r.reconciliation_type || r.reconciliationType || 'invoice_delivery_note',
    referenceNumber: r.reference_number || r.referenceNumber || '',
    expectedAmount: Number(r.expected_amount ?? r.expectedAmount ?? 0),
    actualAmount: Number(r.actual_amount ?? r.actualAmount ?? 0),
    varianceAmount: Number(r.variance_amount ?? r.varianceAmount ?? Math.abs(Number(r.expected_amount || 0) - Number(r.actual_amount || 0))),
    status: r.status || 'matched',
    notes: r.notes || '',
    matchedBy: r.matched_by || r.matchedBy || '',
    matchedByName: r.matcherName || r.matcher?.name || 'Staff',
    reconciledAt: r.reconciled_at || r.reconciledAt || r.created_at || new Date().toISOString(),
    createdAt: r.created_at || r.createdAt || new Date().toISOString(),
    updatedAt: r.updated_at || r.updatedAt || new Date().toISOString()
  });

  public mapPaymentFromDb = (p: any): FinancePaymentRecord => ({
    id: p.id || ('pay-' + Date.now()),
    billId: p.bill_id || p.billId || '',
    paymentReference: p.payment_reference || p.paymentReference || 'PAY-REF',
    paymentAmount: Number(p.payment_amount ?? p.paymentAmount ?? 0),
    paymentDate: p.payment_date || p.paymentDate || new Date().toISOString().slice(0, 10),
    paymentStatus: p.payment_status || p.paymentStatus || 'paid',
    recordedBy: p.recorded_by || p.recordedBy || '',
    recordedByName: p.recorderName || p.recorder?.name || 'Finance Staff',
    createdAt: p.created_at || p.createdAt || new Date().toISOString(),
    updatedAt: p.updated_at || p.updatedAt || new Date().toISOString()
  });

  public mapHistoryFromDb = (h: any): FinanceBillStatusHistory => ({
    id: h.id || ('hist-' + Date.now()),
    billId: h.bill_id || h.billId || '',
    oldStatus: h.old_status || h.oldStatus,
    newStatus: h.new_status || h.newStatus,
    changedBy: h.changed_by || h.changedBy || '',
    changedByName: h.changed_by_name || h.changedByName || h.user?.name || 'Staff',
    reason: h.reason,
    createdAt: h.created_at || h.createdAt || new Date().toISOString()
  });

  private mapBillFromDb = (row: any): FinanceBill => {
    return {
      id: row.id || ('bill-' + Date.now()),
      organizationId: row.organization_id || row.organizationId || DEFAULT_ORG_ID,
      siteId: row.site_id || row.siteId || '',
      siteName: row.siteName || row.site_name || row.site?.name || row.site_id || row.siteId || 'Assigned Site',
      vendorId: row.vendor_id || row.vendorId || '',
      vendorName: row.vendorName || row.vendor_name || row.vendor?.vendor_name || 'General Supplier',
      billNumber: row.bill_number || row.billNumber || 'REF-PENDING',
      billType: row.bill_type || row.billType || 'vendor_invoice',
      billDate: row.bill_date || row.billDate || new Date().toISOString().split('T')[0],
      dueDate: row.due_date || row.dueDate || '',
      currency: row.currency || 'GBP',
      subtotal: Number(row.subtotal || 0),
      taxAmount: Number(row.tax_amount ?? row.taxAmount ?? 0),
      totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
      description: row.description || '',
      purchaseReference: row.purchase_reference || row.purchaseReference || '',
      submittedBy: row.submitted_by || row.submittedBy || '',
      submitterName: row.submitterName || row.submitter?.name || 'Staff',
      submittedAt: row.submitted_at || row.submittedAt || new Date().toISOString(),
      status: row.status || 'submitted',
      assignedApproverId: row.assigned_approver_id || row.assignedApproverId || row.assigned_approver?.id,
      assignedApproverName: row.assigned_approver_name || row.assignedApproverName || row.assigned_approver?.name,
      finalApprovedBy: row.final_approved_by || row.finalApprovedBy,
      finalApprovedByName: row.finalApprovedByName || row.final_approver?.name,
      finalApprovedAt: row.final_approved_at || row.finalApprovedAt,
      rejectedBy: row.rejected_by || row.rejectedBy,
      rejectedByName: row.rejectedByName || row.rejecter?.name,
      rejectedAt: row.rejected_at || row.rejectedAt,
      rejectionReason: row.rejection_reason || row.rejectionReason,
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
      items: Array.isArray(row.items) ? row.items.map((i: any) => this.mapItemFromDb(i)) : [],
      attachments: Array.isArray(row.attachments) ? row.attachments.map((a: any) => this.mapAttachmentFromDb(a)) : [],
      queries: Array.isArray(row.queries) ? row.queries.map((q: any) => this.mapQueryFromDb(q)) : [],
      reconciliations: Array.isArray(row.reconciliations) ? row.reconciliations.map((r: any) => this.mapReconciliationFromDb(r)) : [],
      payments: Array.isArray(row.payments) ? row.payments.map((p: any) => this.mapPaymentFromDb(p)) : [],
      history: Array.isArray(row.history) ? row.history.map((h: any) => this.mapHistoryFromDb(h)) : []
    };
  };

  private mapItemFromDb = (row: any): FinanceBillItem => {
    const quantity = Number(row.quantity || 1);
    let unitPrice = Number(row.unit_price ?? row.unitPrice ?? 0);
    const taxAmount = Number(row.tax_amount ?? row.taxAmount ?? 0);
    let lineTotal = Number(row.line_total ?? row.lineTotal ?? 0);

    // Reconcile single item mismatch
    if (quantity === 1) {
      if (lineTotal > 0 && (unitPrice === 0 || Math.abs(unitPrice + taxAmount - lineTotal) > 0.01)) {
        unitPrice = Number(Math.max(0, lineTotal - taxAmount).toFixed(2));
      } else if (unitPrice > 0 && lineTotal === 0) {
        lineTotal = Number((unitPrice + taxAmount).toFixed(2));
      }
    } else if (quantity > 0 && lineTotal > 0 && Math.abs((quantity * unitPrice + taxAmount) - lineTotal) > 0.01) {
      unitPrice = Number(Math.max(0, (lineTotal - taxAmount) / quantity).toFixed(2));
    }

    return {
      id: row.id || ('item-' + Date.now()),
      billId: row.bill_id || row.billId || '',
      description: row.description || '',
      quantity,
      unitPrice,
      taxAmount,
      lineTotal: lineTotal || Number(((quantity * unitPrice) + taxAmount).toFixed(2)),
      createdAt: row.created_at || row.createdAt || new Date().toISOString()
    };
  };

  private mapAttachmentFromDb = (row: any): FinanceBillAttachment => {
    return {
      id: row.id || ('att-' + Date.now()),
      billId: row.bill_id || row.billId || '',
      fileName: row.file_name || row.fileName || 'Attachment',
      storageBucket: row.storage_bucket || row.storageBucket || STORAGE_BUCKET,
      storagePath: row.storage_path || row.storagePath || '',
      attachmentType: row.attachment_type || row.attachmentType || 'other',
      mimeType: row.mime_type || row.mimeType || 'application/octet-stream',
      fileSizeBytes: Number(row.file_size_bytes ?? row.fileSizeBytes ?? 0),
      uploadedBy: row.uploaded_by || row.uploadedBy || '',
      uploadedByName: row.uploadedByName || '',
      signedUrl: row.data_url || row.dataUrl || row.signed_url || row.signedUrl,
      createdAt: row.created_at || row.createdAt || new Date().toISOString()
    };
  };

  // ==========================================
  // APPROVERS & RM ROUTING
  // ==========================================

  public async getApprovers(forceRefresh = false): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
    if (!forceRefresh && this.cachedApprovers && Date.now() - this.cachedApproversTime < 300000) {
      return this.cachedApprovers;
    }
    try {
      const res = await fetch(getApiUrl('/api/finance/approvers'), { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.approvers)) {
          this.cachedApprovers = json.approvers;
          this.cachedApproversTime = Date.now();
          return json.approvers;
        }
      }
    } catch {}

    const client = this.supabase;
    if (client) {
      try {
        const { data, error } = await client
          .from('profiles')
          .select('id, name, email, role')
          .in('role', ['Regional Manager', 'General Manager', 'Admin', 'Super Admin'])
          .order('name', { ascending: true });
        if (!error && data) {
          this.cachedApprovers = data;
          this.cachedApproversTime = Date.now();
          return data;
        }
      } catch {}
    }
    return this.cachedApprovers || [];
  }

  public async requestApproval(
    billId: string,
    approverId?: string,
    approverName?: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(getApiUrl(`/api/finance/bills/${billId}/request-approval`), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverId, approverName, notes })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return { success: true };
      }
    } catch {}

    const client = this.supabase;
    if (client) {
      try {
        const { error } = await client
          .from('finance_bills')
          .update({ status: 'awaiting_approval', updated_at: new Date().toISOString() })
          .eq('id', billId);
        if (!error) return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
    return { success: true };
  }

  // ==========================================
  // SUPPLIERS CRUD (Delivery Notes & Goods)
  // ==========================================

  public async getSuppliers(): Promise<FinanceVendor[]> {
    try {
      const res = await fetch(getApiUrl('/api/finance/suppliers'), { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data.map(this.mapVendorFromDb);
        }
      }
    } catch {}
    return this.getVendors();
  }

  public async saveSupplier(supplier: { name: string; email?: string; phone?: string; reference?: string }): Promise<{ success: boolean; supplier?: FinanceVendor; error?: string }> {
    this.cachedVendors = null;
    try {
      const res = await fetch(getApiUrl('/api/finance/suppliers'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(supplier)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.supplier) {
          return { success: true, supplier: this.mapVendorFromDb(json.supplier) };
        }
      }
    } catch (e: any) {
      return { success: false, error: e.message };
    }
    return { success: false, error: 'Failed to create supplier' };
  }

  public async deleteSupplier(id: string): Promise<{ success: boolean; error?: string }> {
    this.cachedVendors = null;
    try {
      const res = await fetch(getApiUrl(`/api/finance/suppliers/${id}`), {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return { success: true };
      }
    } catch (e: any) {
      return { success: false, error: e.message };
    }
    return { success: false, error: 'Failed to delete supplier' };
  }

}


export const financeService = new FinanceService();
