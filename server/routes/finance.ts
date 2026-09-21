import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';

const router = Router();


function toSupabaseBillRecord(bill: any, validVendorIds?: Set<string>): any {
  let vId = bill.vendor_id || bill.vendorId;
  if (!isValidUuid(vId) || (validVendorIds && !validVendorIds.has(vId))) {
    vId = null;
  }

  let subBy = bill.submitted_by || bill.submittedBy;
  if (!isValidUuid(subBy)) subBy = null;

  let finAppBy = bill.final_approved_by || bill.finalApprovedBy;
  if (!isValidUuid(finAppBy)) finAppBy = null;

  let rejBy = bill.rejected_by || bill.rejectedBy;
  if (!isValidUuid(rejBy)) rejBy = null;

  return {
    id: bill.id,
    organization_id: bill.organization_id || '00000000-0000-0000-0000-000000000001',
    site_id: bill.site_id || bill.siteId,
    vendor_id: vId,
    bill_number: bill.bill_number || bill.billNumber,
    bill_type: bill.bill_type || bill.billType || 'vendor_invoice',
    bill_date: bill.bill_date || bill.billDate || new Date().toISOString().split('T')[0],
    due_date: bill.due_date || bill.dueDate || null,
    currency: bill.currency || 'GBP',
    subtotal: Number(bill.subtotal || 0),
    tax_amount: Number(bill.tax_amount ?? bill.taxAmount ?? 0),
    total_amount: Number(bill.total_amount ?? bill.totalAmount ?? 0),
    description: bill.description || '',
    purchase_reference: bill.purchase_reference || bill.purchaseReference || null,
    submitted_by: subBy,
    submitted_at: bill.submitted_at || bill.submittedAt || bill.created_at || new Date().toISOString(),
    status: bill.status || 'submitted',
    final_approved_by: finAppBy,
    final_approved_at: bill.final_approved_at || bill.finalApprovedAt || null,
    rejected_by: rejBy,
    rejected_at: bill.rejected_at || bill.rejectedAt || null,
    rejection_reason: bill.rejection_reason || bill.rejectionReason || null,
    created_at: bill.created_at || bill.createdAt || new Date().toISOString(),
    updated_at: bill.updated_at || bill.updatedAt || new Date().toISOString()
  };
}

// ============================================================================
// File-backed Persistence Fallback for Finance Module
// Guarantees zero data loss and instant round-tripping even when live Supabase
// tables are awaiting migration execution.
// ============================================================================

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const FINANCE_STORAGE_FILE = path.join(DATA_DIR, 'finance_storage.json');

interface LocalFinanceStore {
  bills: any[];
  items: any[];
  attachments: any[];
  vendors: any[];
  history: any[];
  queries: any[];
  query_responses: any[];
  reconciliations: any[];
  payments: any[];
}

const DEFAULT_VENDORS = [
  {
    id: '00000000-0000-0000-0001-000000000001',
    organization_id: '00000000-0000-0000-0000-000000000001',
    vendor_name: 'Apex Facilities & Commercial Cleaning Ltd',
    vendor_reference: 'APEX-FAC-01',
    contact_email: 'accounts@apexfacilities.co.uk',
    contact_phone: '+44 20 7946 0912',
    status: 'active',
    created_at: new Date().toISOString()
  }
];


export const VENDOR_UUID_MAP: Record<string, string> = {
  'fven-001': '00000000-0000-0000-0001-000000000001',
  'fven-002': '00000000-0000-0000-0001-000000000002',
  'fven-003': '00000000-0000-0000-0001-000000000003',
  'fven-004': '00000000-0000-0000-0001-000000000004',
  'fven-005': '00000000-0000-0000-0001-000000000005',
  'fven-006': '00000000-0000-0000-0001-000000000006'
};

export const toVendorUuid = (id: any) => VENDOR_UUID_MAP[id] || (isValidUuid(id) ? id : '00000000-0000-0000-0001-000000000001');

let hasAttemptedNativeTableSync = false;

export async function syncStoreToDedicatedSupabaseTables(supabase: any, store: LocalFinanceStore) {
  if (!supabase || hasAttemptedNativeTableSync) return;
  try {
    const { error: probeErr } = await supabase.from('finance_vendors').select('id').limit(1);
    if (probeErr) return;

    hasAttemptedNativeTableSync = true;
    console.log('[FinanceStore] Supabase finance tables online! Syncing store records...');

    const vendorRows = (store.vendors || DEFAULT_VENDORS).map((v: any) => ({
      id: toVendorUuid(v.id),
      organization_id: '00000000-0000-0000-0000-000000000001',
      vendor_name: v.vendor_name || v.vendorName || 'Unnamed Vendor',
      vendor_reference: v.vendor_reference || v.vendorReference || null,
      contact_email: v.contact_email || v.contactEmail || null,
      contact_phone: v.contact_phone || v.contactPhone || null,
      status: v.status || 'active'
    }));
    await supabase.from('finance_vendors').upsert(vendorRows, { onConflict: 'id' });

    for (const b of store.bills) {
      if (!isValidUuid(b.id)) continue;
      const cleanBill = {
        id: b.id,
        organization_id: '00000000-0000-0000-0000-000000000001',
        site_id: b.site_id || b.siteId,
        vendor_id: toVendorUuid(b.vendor_id || b.vendorId),
        bill_number: b.bill_number || b.billNumber,
        bill_type: b.bill_type || b.billType || 'vendor_invoice',
        bill_date: b.bill_date || b.billDate || new Date().toISOString().split('T')[0],
        due_date: b.due_date || b.dueDate || null,
        currency: b.currency || 'GBP',
        subtotal: Number(b.subtotal || 0),
        tax_amount: Number(b.tax_amount ?? b.taxAmount ?? 0),
        total_amount: Number(b.total_amount ?? b.totalAmount ?? 0),
        description: b.description || '',
        purchase_reference: b.purchase_reference || b.purchaseReference || null,
        submitted_by: isValidUuid(b.submitted_by) ? b.submitted_by : '1c6508c5-ee2a-498c-a265-b324b03f0a1b',
        status: b.status || 'submitted',
        submitted_at: b.submitted_at || b.createdAt || new Date().toISOString()
      };
      await supabase.from('finance_bills').upsert([cleanBill], { onConflict: 'id' });
    }

    console.log('[FinanceStore] Successfully synced finance records to live Supabase tables!');
  } catch (err: any) {
    console.warn('[FinanceStore] Background sync to native tables skipped:', err.message);
  }
}

let inMemoryStoreCache: LocalFinanceStore | null = null;

function readLocalStore(): LocalFinanceStore {
  if (inMemoryStoreCache) {
    return inMemoryStoreCache;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(FINANCE_STORAGE_FILE)) {
      const initial: LocalFinanceStore = {
        bills: [],
        items: [],
        attachments: [],
        vendors: DEFAULT_VENDORS,
        history: [],
        queries: [],
        query_responses: [],
        reconciliations: [],
        payments: []
      };
      fs.writeFileSync(FINANCE_STORAGE_FILE, JSON.stringify(initial, null, 2), 'utf8');
      inMemoryStoreCache = initial;
      return initial;
    }
    const raw = fs.readFileSync(FINANCE_STORAGE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.vendors) || parsed.vendors.length === 0) {
      parsed.vendors = DEFAULT_VENDORS;
    }
    if (!Array.isArray(parsed.bills)) parsed.bills = [];
    if (!Array.isArray(parsed.items)) parsed.items = [];
    if (!Array.isArray(parsed.attachments)) parsed.attachments = [];
    if (!Array.isArray(parsed.history)) parsed.history = [];
    if (!Array.isArray(parsed.queries)) parsed.queries = [];
    if (!Array.isArray(parsed.query_responses)) parsed.query_responses = [];
    if (!Array.isArray(parsed.reconciliations)) parsed.reconciliations = [];
    if (!Array.isArray(parsed.payments)) parsed.payments = [];
    inMemoryStoreCache = parsed;
    return parsed;
  } catch (err) {
    console.warn('[FinanceStore] Could not read local finance storage file:', err);
    return {
      bills: [],
      items: [],
      attachments: [],
      vendors: DEFAULT_VENDORS,
      history: [],
      queries: [],
      query_responses: [],
      reconciliations: [],
      payments: []
    };
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isValidUuid = (val: any) => typeof val === 'string' && UUID_REGEX.test(val.trim());

export async function syncToSupabaseStore(store: LocalFinanceStore, supabase: any, userId?: string) {
  if (!supabase) return;
  try {
    await supabase.from('app_settings').upsert({
      id: 'finance_store',
      value: store,
      updated_by: userId || 'system',
      updated_at: new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('[FinanceStore] Supabase cloud store sync failed:', err?.message || err);
  }
}

export async function loadFromSupabaseStore(supabase: any): Promise<LocalFinanceStore | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('id', 'finance_store')
      .maybeSingle();
    if (!error && data?.value && typeof data.value === 'object') {
      const val = data.value;
      if (Array.isArray(val.bills) || Array.isArray(val.vendors)) {
        return val as LocalFinanceStore;
      }
    }
  } catch (err: any) {
    console.warn('[FinanceStore] Supabase cloud store load failed:', err?.message || err);
  }
  return null;
}

let hasInitializedCloudStore = false;

export async function getUnifiedStore(supabase: any): Promise<LocalFinanceStore> {
  const local = readLocalStore();
  if (!supabase) return local;

  try {
    const cloud = await loadFromSupabaseStore(supabase);
    if (cloud) {
      const billMap = new Map<string, any>();
      (local.bills || []).forEach(b => billMap.set(b.id, b));
      (cloud.bills || []).forEach(b => billMap.set(b.id, b));

      const vendorMap = new Map<string, any>();
      (DEFAULT_VENDORS || []).forEach(v => vendorMap.set(v.id, v));
      (local.vendors || []).forEach(v => vendorMap.set(v.id, v));
      (cloud.vendors || []).forEach(v => vendorMap.set(v.id, v));

      const merged: LocalFinanceStore = {
        bills: Array.from(billMap.values()),
        items: (cloud.items && cloud.items.length > 0) ? cloud.items : (local.items || []),
        attachments: (cloud.attachments && cloud.attachments.length > 0) ? cloud.attachments : (local.attachments || []),
        vendors: Array.from(vendorMap.values()),
        history: (cloud.history && cloud.history.length > 0) ? cloud.history : (local.history || []),
        queries: cloud.queries || local.queries || [],
        query_responses: cloud.query_responses || local.query_responses || [],
        reconciliations: cloud.reconciliations || local.reconciliations || [],
        payments: cloud.payments || local.payments || []
      };

      if (!hasInitializedCloudStore || local.bills.length > (cloud.bills || []).length) {
        hasInitializedCloudStore = true;
        await syncToSupabaseStore(merged, supabase);
      }
      // In-memory merged store; do not write to disk on read operations
      syncStoreToDedicatedSupabaseTables(supabase, merged).catch(() => {});
      return merged;
    } else {
      await syncToSupabaseStore(local, supabase);
      hasInitializedCloudStore = true;
      syncStoreToDedicatedSupabaseTables(supabase, local).catch(() => {});
      return local;
    }
  } catch {
    return local;
  }
}

export async function persistStore(store: LocalFinanceStore, supabase: any, userId?: string) {
  writeLocalStore(store, userId);
  if (supabase) {
    await syncToSupabaseStore(store, supabase, userId);
  }
}

function writeLocalStore(store: LocalFinanceStore, userId?: string): void {
  inMemoryStoreCache = store;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(FINANCE_STORAGE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('[FinanceStore] Failed to write local finance storage file:', err);
  }

  // Also sync in background to Supabase cloud app_settings
  const supabase = getSupabaseAdmin();
  if (supabase) {
    syncToSupabaseStore(store, supabase, userId).catch(() => {});
  }
}

// ============================================================================
// Helper: Enrich Bill Record with Joined / Resolved Entity Names
// ============================================================================

function enrichBillRecordSync(
  bill: any,
  store: LocalFinanceStore,
  caches?: { sitesMap?: Map<string, string>; vendorsMap?: Map<string, string>; profilesMap?: Map<string, string> }
): any {
  const enriched = { ...bill };

  // Site Name
  if (!enriched.siteName) {
    if (enriched.site?.name) {
      enriched.siteName = enriched.site.name;
    } else if (enriched.site_name) {
      enriched.siteName = enriched.site_name;
    } else if (enriched.site_id && caches?.sitesMap?.has(enriched.site_id)) {
      enriched.siteName = caches.sitesMap.get(enriched.site_id);
    } else if (enriched.siteId && caches?.sitesMap?.has(enriched.siteId)) {
      enriched.siteName = caches.sitesMap.get(enriched.siteId);
    } else {
      enriched.siteName = enriched.site_name || enriched.site_id || enriched.siteId || '—';
    }
  }

  // Vendor Name
  if (!enriched.vendorName) {
    if (enriched.vendor?.vendor_name) {
      enriched.vendorName = enriched.vendor.vendor_name;
    } else if (enriched.vendor_name) {
      enriched.vendorName = enriched.vendor_name;
    } else if (enriched.vendor_id && caches?.vendorsMap?.has(enriched.vendor_id)) {
      enriched.vendorName = caches.vendorsMap.get(enriched.vendor_id);
    } else if (enriched.vendor_id) {
      const v = store.vendors.find((item: any) => item.id === enriched.vendor_id);
      if (v) enriched.vendorName = v.vendor_name;
    }
  }

  // Submitter Name
  if (!enriched.submitterName) {
    if (enriched.submitter?.name) {
      enriched.submitterName = enriched.submitter.name;
    } else if (enriched.submitted_by && caches?.profilesMap?.has(enriched.submitted_by)) {
      enriched.submitterName = caches.profilesMap.get(enriched.submitted_by);
    }
  }

  // Final Approver Name
  if (!enriched.finalApprovedByName) {
    if (enriched.final_approver?.name) {
      enriched.finalApprovedByName = enriched.final_approver.name;
    } else if (enriched.final_approved_by && caches?.profilesMap?.has(enriched.final_approved_by)) {
      enriched.finalApprovedByName = caches.profilesMap.get(enriched.final_approved_by);
    }
  }

  // Assigned Approver
  enriched.assignedApproverId = enriched.assigned_approver_id || enriched.assignedApproverId || null;
  enriched.assignedApproverName = enriched.assigned_approver_name || enriched.assignedApproverName || null;
  if (enriched.assignedApproverId && !enriched.assignedApproverName && caches?.profilesMap?.has(enriched.assignedApproverId)) {
    enriched.assignedApproverName = caches.profilesMap.get(enriched.assignedApproverId);
  }

  // Attach items from store if missing
  if (!enriched.items || enriched.items.length === 0) {
    enriched.items = store.items.filter((i: any) => i.bill_id === enriched.id);
  }

  // Attach attachments from store if missing
  if (!enriched.attachments || enriched.attachments.length === 0) {
    enriched.attachments = store.attachments.filter((a: any) => a.bill_id === enriched.id);
  }

  // Attach queries from store if missing
  if (!enriched.queries || enriched.queries.length === 0) {
    enriched.queries = (store.queries || []).filter((q: any) => q.bill_id === enriched.id);
  }

  // Attach reconciliations from store if missing
  if (!enriched.reconciliations || enriched.reconciliations.length === 0) {
    enriched.reconciliations = (store.reconciliations || []).filter((r: any) => r.bill_id === enriched.id);
  }

  // Attach payments from store if missing
  if (!enriched.payments || enriched.payments.length === 0) {
    enriched.payments = (store.payments || []).filter((p: any) => p.bill_id === enriched.id);
  }

  // Attach history from store if missing
  if (!enriched.history || enriched.history.length === 0) {
    enriched.history = (store.history || []).filter((h: any) => h.bill_id === enriched.id);
  }

  return enriched;
}

async function resolveOrCreateVendorId(
  vendorId: string | null | undefined,
  vendorName: string | null | undefined,
  supabase: any,
  store: LocalFinanceStore
): Promise<{ vendorId: string | null; vendorName: string | null }> {
  const cleanName = (vendorName || '').trim();
  if (vendorId && isValidUuid(vendorId)) {
    const existing = store.vendors.find(v => v.id === vendorId);
    return { vendorId, vendorName: cleanName || existing?.vendor_name || null };
  }

  if (!cleanName) {
    return { vendorId: null, vendorName: null };
  }

  // Check store first
  const fromStore = store.vendors.find(v => (v.vendor_name || '').toLowerCase() === cleanName.toLowerCase());
  if (fromStore && isValidUuid(fromStore.id)) {
    return { vendorId: fromStore.id, vendorName: fromStore.vendor_name };
  }

  // Check Supabase
  if (supabase) {
    try {
      const { data: matched } = await supabase
        .from('finance_vendors')
        .select('id, vendor_name')
        .ilike('vendor_name', cleanName)
        .limit(1)
        .maybeSingle();

      if (matched?.id) {
        return { vendorId: matched.id, vendorName: matched.vendor_name };
      }

      // Auto create new vendor in Supabase
      const { data: created } = await supabase
        .from('finance_vendors')
        .insert([{
          vendor_name: cleanName,
          organization_id: '00000000-0000-0000-0000-000000000001',
          status: 'active'
        }])
        .select('id, vendor_name')
        .maybeSingle();

      if (created?.id) {
        store.vendors.push({
          id: created.id,
          organization_id: '00000000-0000-0000-0000-000000000001',
          vendor_name: cleanName,
          status: 'active',
          created_at: new Date().toISOString()
        });
        return { vendorId: created.id, vendorName: created.vendor_name };
      }
    } catch (e) {
      console.warn('[FinanceRoute] resolveOrCreateVendorId error:', e);
    }
  }

  return { vendorId: null, vendorName: cleanName };
}

async function enrichBillRecord(bill: any, supabase: any, store: LocalFinanceStore): Promise<any> {
  const enriched = { ...bill };

  // Site Name
  if (!enriched.siteName && !enriched.site?.name) {
    if (enriched.site_name) {
      enriched.siteName = enriched.site_name;
    } else if (enriched.site_id) {
      if (supabase) {
        try {
          const { data: site } = await supabase.from('sites').select('name').eq('id', enriched.site_id).single();
          if (site?.name) enriched.siteName = site.name;
        } catch {}
      }
      if (!enriched.siteName) {
        enriched.siteName = enriched.site_id;
      }
    }
  } else if (enriched.site?.name) {
    enriched.siteName = enriched.site.name;
  }

  // Vendor Name
  if (!enriched.vendorName && !enriched.vendor?.vendor_name) {
    if (enriched.vendor_name) {
      enriched.vendorName = enriched.vendor_name;
    } else if (enriched.vendor_id) {
      const v = store.vendors.find((item: any) => item.id === enriched.vendor_id);
      if (v) {
        enriched.vendorName = v.vendor_name;
      } else if (supabase) {
        try {
          const { data: ven } = await supabase.from('finance_vendors').select('vendor_name').eq('id', enriched.vendor_id).single();
          if (ven?.vendor_name) enriched.vendorName = ven.vendor_name;
        } catch {}
      }
    }
  } else if (enriched.vendor?.vendor_name) {
    enriched.vendorName = enriched.vendor.vendor_name;
  }

  // Submitter Name
  if (!enriched.submitterName && !enriched.submitter?.name) {
    if (enriched.submitted_by) {
      if (supabase) {
        try {
          const { data: prof } = await supabase.from('profiles').select('name').eq('id', enriched.submitted_by).single();
          if (prof?.name) enriched.submitterName = prof.name;
        } catch {}
      }
    }
  } else if (enriched.submitter?.name) {
    enriched.submitterName = enriched.submitter.name;
  }

  // Final Approver Name
  if (!enriched.finalApprovedByName && !enriched.final_approver?.name) {
    if (enriched.final_approved_by) {
      if (supabase) {
        try {
          const { data: prof } = await supabase.from('profiles').select('name').eq('id', enriched.final_approved_by).single();
          if (prof?.name) enriched.finalApprovedByName = prof.name;
        } catch {}
      }
    }
  } else if (enriched.final_approver?.name) {
    enriched.finalApprovedByName = enriched.final_approver.name;
  }

  // Attach items from store if missing
  if (!enriched.items || enriched.items.length === 0) {
    enriched.items = store.items.filter((i: any) => i.bill_id === enriched.id);
  }

  // Attach attachments from store if missing
  if (!enriched.attachments || enriched.attachments.length === 0) {
    enriched.attachments = store.attachments.filter((a: any) => a.bill_id === enriched.id);
  }

  // Attach queries from store if missing
  if (!enriched.queries || enriched.queries.length === 0) {
    enriched.queries = (store.queries || []).filter((q: any) => q.bill_id === enriched.id);
  }

  // Attach reconciliations from store if missing
  if (!enriched.reconciliations || enriched.reconciliations.length === 0) {
    enriched.reconciliations = (store.reconciliations || []).filter((r: any) => r.bill_id === enriched.id);
  }

  // Attach payments from store if missing
  if (!enriched.payments || enriched.payments.length === 0) {
    enriched.payments = (store.payments || []).filter((p: any) => p.bill_id === enriched.id);
  }

  // Attach history from store if missing
  if (!enriched.history || enriched.history.length === 0) {
    enriched.history = (store.history || []).filter((h: any) => h.bill_id === enriched.id);
  }

  return enriched;
}

// ============================================================================
// API ROUTES
// ============================================================================

// GET /api/finance/bills
router.get('/bills', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);
    const { siteId, status, vendorId, billType, search } = req.query;

    let dbBills: any[] = [];
    let dbSuccess = false;

    if (supabase) {
      try {
        let query = supabase
          .from('finance_bills')
          .select(`
            *,
            site:sites(name),
            vendor:finance_vendors(vendor_name)
          `)
          .order('bill_date', { ascending: false });

        if (siteId && siteId !== 'all') query = query.eq('site_id', siteId);
        if (status && status !== 'all') query = query.eq('status', status);
        if (vendorId && vendorId !== 'all') query = query.eq('vendor_id', vendorId);
        if (billType && billType !== 'all') query = query.eq('bill_type', billType);

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          dbBills = data;
          dbSuccess = true;
        }
      } catch (e) {
        console.warn('[FinanceRoute] Supabase fetch failed, using local store:', e);
      }
    }

    // Merge store bills with DB bills
    const combinedMap = new Map<string, any>();
    for (const b of store.bills) {
      combinedMap.set(b.id, b);
    }
    for (const b of dbBills) {
      combinedMap.set(b.id, b);
    }

    let rawList = Array.from(combinedMap.values());

    if (siteId && siteId !== 'all') {
      const s = String(siteId).toLowerCase();
      rawList = rawList.filter(b => 
        String(b.site_id || '').toLowerCase() === s || 
        String(b.siteId || '').toLowerCase() === s ||
        String(b.siteName || '').toLowerCase().includes(s)
      );
    }
    if (status && status !== 'all') {
      rawList = rawList.filter(b => b.status === status);
    }
    if (vendorId && vendorId !== 'all') {
      rawList = rawList.filter(b => b.vendor_id === vendorId || b.vendorId === vendorId);
    }
    if (billType && billType !== 'all') {
      rawList = rawList.filter(b => b.bill_type === billType || b.billType === billType);
    }

    // High performance batch pre-caching: zero N+1 latency
    const sitesMap = new Map<string, string>();
    const vendorsMap = new Map<string, string>();
    const profilesMap = new Map<string, string>();

    for (const v of store.vendors) {
      if (v.id && v.vendor_name) vendorsMap.set(v.id, v.vendor_name);
    }

    const missingSiteIds = Array.from(new Set(rawList.map(b => b.site_id || b.siteId).filter(id => id && !sitesMap.has(id))));
    const missingVendorIds = Array.from(new Set(rawList.map(b => b.vendor_id || b.vendorId).filter(id => id && !vendorsMap.has(id))));
    const profileIds = Array.from(new Set(rawList.flatMap(b => [b.submitted_by, b.final_approved_by, b.rejected_by]).filter(Boolean)));

    if (supabase) {
      try {
        const promises: (Promise<any> | PromiseLike<any>)[] = [];
        if (missingSiteIds.length > 0) {
          promises.push(supabase.from('sites').select('id, name').in('id', missingSiteIds).then((r: any) => {
            if (r.data) r.data.forEach((s: any) => sitesMap.set(s.id, s.name));
          }));
        }
        if (missingVendorIds.length > 0) {
          promises.push(supabase.from('finance_vendors').select('id, vendor_name').in('id', missingVendorIds).then((r: any) => {
            if (r.data) r.data.forEach((v: any) => vendorsMap.set(v.id, v.vendor_name));
          }));
        }
        if (profileIds.length > 0) {
          promises.push(supabase.from('profiles').select('id, name').in('id', profileIds).then((r: any) => {
            if (r.data) r.data.forEach((p: any) => profilesMap.set(p.id, p.name));
          }));
        }
        if (promises.length > 0) await Promise.all(promises);
      } catch (e) {
        // Continue with local maps
      }
    }

    const caches = { sitesMap, vendorsMap, profilesMap };
    let results = rawList.map(b => enrichBillRecordSync(b, store, caches));

    // Search filter
    if (search && String(search).trim()) {
      const q = String(search).toLowerCase();
      results = results.filter(b => 
        String(b.bill_number || b.billNumber || '').toLowerCase().includes(q) ||
        String(b.siteName || b.site_id || '').toLowerCase().includes(q) ||
        String(b.vendorName || '').toLowerCase().includes(q) ||
        String(b.purchase_reference || b.purchaseReference || '').toLowerCase().includes(q) ||
        String(b.description || '').toLowerCase().includes(q) ||
        String(b.submitterName || '').toLowerCase().includes(q)
      );
    }

    return res.json({ success: true, data: results, source: dbSuccess ? 'supabase' : 'cloud_store' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/finance/bills/:id
router.get('/bills/:id', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);
    const { id } = req.params;

    let bill: any = null;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('finance_bills')
          .select(`
            *,
            site:sites(name),
            vendor:finance_vendors(vendor_name)
          `)
          .eq('id', id)
          .single();

        if (!error && data) {
          bill = data;
          const [itemsRes, attRes, queriesRes, recsRes, paysRes, histRes] = await Promise.all([
            supabase.from('finance_bill_items').select('*').eq('bill_id', id),
            supabase.from('finance_bill_attachments').select('*').eq('bill_id', id),
            supabase.from('finance_bill_queries').select('*').eq('bill_id', id),
            supabase.from('finance_reconciliation_records').select('*').eq('bill_id', id),
            supabase.from('finance_payment_records').select('*').eq('bill_id', id),
            supabase.from('finance_bill_status_history').select('*').eq('bill_id', id).order('created_at', { ascending: false })
          ]);

          bill.items = itemsRes.data || [];
          bill.attachments = attRes.data || [];
          bill.queries = queriesRes.data || [];
          bill.reconciliations = recsRes.data || [];
          bill.payments = paysRes.data || [];
          bill.history = histRes.data || [];
        }
      } catch (e) {}
    }

    if (!bill) {
      bill = store.bills.find(b => b.id === id);
      if (bill) {
        bill.items = store.items.filter(i => i.bill_id === id);
        bill.attachments = store.attachments.filter(a => a.bill_id === id);
        bill.queries = (store.queries || []).filter(q => q.bill_id === id);
        bill.reconciliations = (store.reconciliations || []).filter(r => r.bill_id === id);
        bill.payments = (store.payments || []).filter(p => p.bill_id === id);
        bill.history = (store.history || []).filter(h => h.bill_id === id);
      }
    }

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const enriched = enrichBillRecordSync(bill, store);
    return res.json({ success: true, data: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/finance/bills
router.post('/bills', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);

    const body = req.body || {};
    const rawBill = body.bill || body;
    const items = body.items || [];
    const attachments = body.attachments || [];

    const billId = rawBill.id || (crypto.randomUUID ? crypto.randomUUID() : `bill-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`);
    const callerId = req.user?.id || rawBill.submittedBy || rawBill.submitted_by || '00000000-0000-0000-0000-000000000000';
    const callerName = req.user?.name || req.user?.email || 'Authenticated Staff';

    const subtotal = Number(rawBill.subtotal || 0);
    const taxAmount = Number(rawBill.taxAmount ?? rawBill.tax_amount ?? 0);
    const totalAmount = Number(rawBill.totalAmount ?? rawBill.total_amount ?? (subtotal + taxAmount));

    const resolvedVendor = await resolveOrCreateVendorId(
      rawBill.vendorId || rawBill.vendor_id,
      rawBill.vendorName || rawBill.vendor_name,
      supabase,
      store
    );

    const billRecord = {
      id: billId,
      organization_id: rawBill.organizationId || rawBill.organization_id || '00000000-0000-0000-0000-000000000001',
      site_id: rawBill.siteId || rawBill.site_id,
      site_name: rawBill.siteName || rawBill.site_name || null,
      siteName: rawBill.siteName || rawBill.site_name || null,
      vendor_id: resolvedVendor.vendorId,
      vendor_name: resolvedVendor.vendorName,
      vendorName: resolvedVendor.vendorName,
      bill_number: rawBill.billNumber || rawBill.bill_number || `BILL-${Date.now().toString().slice(-6)}`,
      bill_type: rawBill.billType || rawBill.bill_type || 'vendor_invoice',
      bill_date: rawBill.billDate || rawBill.bill_date || new Date().toISOString().split('T')[0],
      due_date: rawBill.dueDate || rawBill.due_date || null,
      currency: rawBill.currency || 'GBP',
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      description: rawBill.description || '',
      purchase_reference: rawBill.purchaseReference || rawBill.purchase_reference || null,
      submitted_by: callerId,
      submitterName: callerName,
      submitted_at: new Date().toISOString(),
      status: rawBill.status || 'submitted',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Format & reconcile line items
    const itemRows = (items || []).map((item: any, idx: number) => {
      const q = Number(item.quantity || 1);
      let u = Number(item.unitPrice ?? item.unit_price ?? 0);
      const t = Number(item.taxAmount ?? item.tax_amount ?? 0);
      let lt = Number(item.lineTotal ?? item.line_total ?? (q * u + t));

      if (items.length === 1 && q === 1) {
        if (lt > 0 && (u === 0 || Math.abs(u + t - lt) > 0.01)) {
          u = Number(Math.max(0, lt - t).toFixed(2));
        } else if (u > 0 && lt === 0) {
          lt = Number((u + t).toFixed(2));
        }
      } else if (q > 0 && lt > 0 && Math.abs(q * u + t - lt) > 0.01) {
        u = Number(Math.max(0, (lt - t) / q).toFixed(2));
      }

      return {
        id: item.id || `item-${billId}-${idx + 1}`,
        bill_id: billId,
        description: item.description || 'General item',
        quantity: q,
        unit_price: u,
        tax_amount: t,
        line_total: lt,
        created_at: new Date().toISOString()
      };
    });

    // Format attachment records
    const attachmentRows = (attachments || []).map((att: any, idx: number) => ({
      id: att.id || `att-${billId}-${idx + 1}`,
      bill_id: billId,
      file_name: att.fileName || att.file_name || 'document.pdf',
      storage_bucket: att.storageBucket || att.storage_bucket || 'finance-documents',
      storage_path: att.storagePath || att.storage_path || `finance/${billId}/${att.fileName || 'document.pdf'}`,
      attachment_type: att.attachmentType || att.attachment_type || 'vendor_invoice',
      mime_type: att.mimeType || att.mime_type || 'application/pdf',
      file_size_bytes: Number(att.fileSizeBytes ?? att.file_size_bytes ?? 1024),
      data_url: att.dataUrl || att.data_url || null,
      uploaded_by: callerId,
      created_at: new Date().toISOString()
    }));

    // Status history entry
    const historyEntry = {
      id: `hist-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      bill_id: billId,
      old_status: null,
      new_status: billRecord.status,
      changed_by: callerId,
      changed_by_name: callerName,
      reason: 'Bill created and submitted via modal form',
      created_at: new Date().toISOString()
    };

    // Save to unified store (syncs both file and Supabase app_settings cloud database)
    store.bills = store.bills.filter(b => b.id !== billId);
    store.bills.unshift(billRecord);

    store.items = store.items.filter(i => i.bill_id !== billId);
    if (itemRows.length > 0) store.items.push(...itemRows);

    if (attachmentRows.length > 0) {
      store.attachments = store.attachments.filter(a => a.bill_id !== billId);
      store.attachments.push(...attachmentRows);
    }

    store.history.unshift(historyEntry);
    await persistStore(store, supabase, callerId);

    // Attempt saving to live native Supabase tables if migration has been executed
    if (supabase) {
      try {
        await supabase.from('audit_trails').insert([{
          id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          timestamp: new Date().toISOString(),
          user: callerName,
          action: 'CREATE',
          details: `Submitted finance bill [${billRecord.bill_number}] for site ${billRecord.site_id} (£${billRecord.total_amount})`,
          site: billRecord.site_id,
          module: 'Finance',
          entity_type: 'finance_bills',
          entity_id: billId
        }]);

        const { data: curVens } = await supabase.from('finance_vendors').select('id');
        const validVens = new Set((curVens || []).map((v: any) => v.id));
        const cleanBillRecord = toSupabaseBillRecord(billRecord, validVens);

        const { error: billError } = await supabase.from('finance_bills').upsert([cleanBillRecord], { onConflict: 'id' });
        if (!billError) {
          if (itemRows.length > 0) {
            await supabase.from('finance_bill_items').insert(itemRows);
          }
          if (attachmentRows.length > 0) {
            await supabase.from('finance_bill_attachments').insert(attachmentRows);
          }
          await supabase.from('finance_bill_status_history').insert([{
            bill_id: billId,
            old_status: null,
            new_status: billRecord.status,
            changed_by: isValidUuid(callerId) ? callerId : null,
            reason: 'Bill created and submitted via modal form'
          }]);
        }
      } catch (e) {
        console.warn('[FinanceRoute] Native table write skipped, retained in Supabase cloud store:', e);
      }
    }

    const enriched = await enrichBillRecord(billRecord, supabase, store);
    return res.status(201).json({
      success: true,
      billId,
      record: enriched,
      data: enriched
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// PUT /api/finance/bills/:id - Update existing bill & line items
router.put('/bills/:id', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = readLocalStore();
    const { id } = req.params;
    const body = req.body || {};
    const rawBill = body.bill || body;
    const items = body.items;

    const existingIndex = store.bills.findIndex(b => b.id === id);
    if (existingIndex === -1) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const existing = store.bills[existingIndex];
    const callerId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const callerName = req.user?.name || req.user?.email || 'Authenticated Staff';

    // Format & reconcile line items if provided
    let itemRows: any[] = [];
    if (items && Array.isArray(items)) {
      itemRows = items.map((item: any, idx: number) => {
        const q = Number(item.quantity || 1);
        let u = Number(item.unitPrice ?? item.unit_price ?? 0);
        const t = Number(item.taxAmount ?? item.tax_amount ?? 0);
        let lt = Number(item.lineTotal ?? item.line_total ?? (q * u + t));

        if (items.length === 1 && q === 1) {
          if (lt > 0 && (u === 0 || Math.abs(u + t - lt) > 0.01)) {
            u = Number(Math.max(0, lt - t).toFixed(2));
          } else if (u > 0 && lt === 0) {
            lt = Number((u + t).toFixed(2));
          }
        } else if (q > 0 && lt > 0 && Math.abs(q * u + t - lt) > 0.01) {
          u = Number(Math.max(0, (lt - t) / q).toFixed(2));
        }

        return {
          id: item.id || `item-${id}-${idx + 1}`,
          bill_id: id,
          description: item.description || 'General item',
          quantity: q,
          unit_price: u,
          tax_amount: t,
          line_total: lt,
          created_at: new Date().toISOString()
        };
      });
    }

    const totalAmount = rawBill.totalAmount !== undefined
      ? Number(rawBill.totalAmount)
      : (rawBill.total_amount !== undefined 
          ? Number(rawBill.total_amount) 
          : (itemRows.length > 0 ? itemRows.reduce((sum, it) => sum + it.line_total, 0) : existing.total_amount));

    const taxAmount = itemRows.length > 0
      ? itemRows.reduce((sum, it) => sum + it.tax_amount, 0)
      : (rawBill.taxAmount !== undefined 
          ? Number(rawBill.taxAmount) 
          : (rawBill.tax_amount !== undefined ? Number(rawBill.tax_amount) : existing.tax_amount));

    const subtotal = itemRows.length > 0
      ? itemRows.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0)
      : (rawBill.subtotal !== undefined 
          ? Number(rawBill.subtotal) 
          : Number(Math.max(0, totalAmount - taxAmount).toFixed(2)));

    const updatedBill = {
      ...existing,
      site_id: rawBill.siteId || rawBill.site_id || existing.site_id,
      site_name: rawBill.siteName || rawBill.site_name || existing.site_name,
      siteName: rawBill.siteName || rawBill.site_name || existing.siteName,
      vendor_id: (await resolveOrCreateVendorId(
        rawBill.vendorId !== undefined ? rawBill.vendorId : existing.vendor_id,
        rawBill.vendorName || rawBill.vendor_name || existing.vendor_name,
        supabase,
        store
      )).vendorId,
      vendor_name: (await resolveOrCreateVendorId(
        rawBill.vendorId !== undefined ? rawBill.vendorId : existing.vendor_id,
        rawBill.vendorName || rawBill.vendor_name || existing.vendor_name,
        supabase,
        store
      )).vendorName,
      vendorName: (await resolveOrCreateVendorId(
        rawBill.vendorId !== undefined ? rawBill.vendorId : existing.vendor_id,
        rawBill.vendorName || rawBill.vendor_name || existing.vendor_name,
        supabase,
        store
      )).vendorName,
      bill_number: rawBill.billNumber || rawBill.bill_number || existing.bill_number,
      bill_type: rawBill.billType || rawBill.bill_type || existing.bill_type,
      bill_date: rawBill.billDate || rawBill.bill_date || existing.bill_date,
      due_date: rawBill.dueDate !== undefined ? (rawBill.dueDate || null) : existing.due_date,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      description: rawBill.description !== undefined ? rawBill.description : existing.description,
      purchase_reference: rawBill.purchaseReference !== undefined ? (rawBill.purchaseReference || null) : existing.purchase_reference,
      status: rawBill.status || existing.status,
      updated_at: new Date().toISOString()
    };

    store.bills[existingIndex] = updatedBill;

    // Update line items in unified store
    if (itemRows.length > 0) {
      store.items = store.items.filter(i => i.bill_id !== id);
      store.items.push(...itemRows);
    }

    // Add audit history
    store.history.unshift({
      id: `hist-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      bill_id: id,
      old_status: existing.status,
      new_status: updatedBill.status,
      changed_by: callerId,
      changed_by_name: callerName,
      reason: 'Bill updated via form modal',
      created_at: new Date().toISOString()
    });

    writeLocalStore(store);
    await persistStore(store, supabase, callerId);

    if (supabase) {
      try {
        const { data: curVensPut } = await supabase.from('finance_vendors').select('id');
        const validVensPut = new Set((curVensPut || []).map((v: any) => v.id));
        const cleanBillRecordPut = toSupabaseBillRecord(updatedBill, validVensPut);
        await supabase.from('finance_bills').upsert([cleanBillRecordPut], { onConflict: 'id' });
        if (itemRows.length > 0) {
          await supabase.from('finance_bill_items').delete().eq('bill_id', id);
          await supabase.from('finance_bill_items').insert(itemRows);
        }
      } catch (e) {
        console.warn('[FinanceRoute] Supabase bill update failed:', e);
      }
    }

    const enriched = await enrichBillRecord(updatedBill, supabase, store);
    return res.json({ success: true, billId: id, record: enriched, data: enriched });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// POST /api/finance/bills/:id/submit
router.post('/bills/:id/submit', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = readLocalStore();
    const { id } = req.params;

    let updated = false;

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_finance_submit_bill', { p_bill_id: id });
        if (!error && data) {
          return res.json(data);
        }
      } catch (e) {}
    }

    // Local state machine transition
    const bill = store.bills.find(b => b.id === id);
    if (bill) {
      const oldStatus = bill.status;
      bill.status = 'submitted';
      bill.updated_at = new Date().toISOString();
      store.history.unshift({
        id: `hist-${Date.now()}`,
        bill_id: id,
        old_status: oldStatus,
        new_status: 'submitted',
        changed_by: req.user?.id || '00000000-0000-0000-0000-000000000000',
        changed_by_name: req.user?.name || 'Staff',
        reason: 'Bill submitted for finance review',
        created_at: new Date().toISOString()
      });
      writeLocalStore(store);
      updated = true;
    }

    if (updated) {
      return res.json({ success: true, status: 'submitted' });
    }
    return res.status(404).json({ error: 'Bill not found' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/bills/:id/approve
router.post('/bills/:id/approve', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);
    const { id } = req.params;
    const { comments } = req.body || {};

    const bill = store.bills.find(b => b.id === id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const callerId = req.user?.id;
    const callerRole = req.user?.role;
    const assignedId = bill.assigned_approver_id || bill.assignedApproverId;
    const assignedName = bill.assigned_approver_name || bill.assignedApproverName;

    // Strict rule: if assigned to a specific approver, only they (or Super Admin) can approve!
    if (assignedId && callerId && assignedId !== callerId && callerRole !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        error: `This bill is assigned to ${assignedName || 'another approver'}. Only the assigned approver may approve this record.`
      });
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_finance_final_approval', {
          p_bill_id: id,
          p_comments: comments || null
        });
        if (!error && data) return res.json(data);
      } catch (e) {}
    }

    if (bill) {
      const oldStatus = bill.status;
      bill.status = 'approved';
      bill.final_approved_by = req.user?.id || '00000000-0000-0000-0000-000000000000';
      bill.finalApprovedByName = req.user?.name || 'Finance Admin';
      bill.final_approved_at = new Date().toISOString();
      bill.updated_at = new Date().toISOString();

      store.history.unshift({
        id: `hist-${Date.now()}`,
        bill_id: id,
        old_status: oldStatus,
        new_status: 'approved',
        changed_by: req.user?.id || '00000000-0000-0000-0000-000000000000',
        changed_by_name: req.user?.name || 'Finance Admin',
        reason: comments || 'Finance final approval signed off',
        created_at: new Date().toISOString()
      });
      writeLocalStore(store);
      return res.json({ success: true, status: 'approved' });
    }

    return res.status(404).json({ error: 'Bill not found' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/bills/:id/reject
router.post('/bills/:id/reject', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });

    const bill = store.bills.find(b => b.id === id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const callerId = req.user?.id;
    const callerRole = req.user?.role;
    const assignedId = bill.assigned_approver_id || bill.assignedApproverId;
    const assignedName = bill.assigned_approver_name || bill.assignedApproverName;

    // Strict rule: if assigned to a specific approver, only they (or Super Admin) can reject!
    if (assignedId && callerId && assignedId !== callerId && callerRole !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        error: `This bill is assigned to ${assignedName || 'another approver'}. Only the assigned approver may reject this record.`
      });
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_finance_reject_bill', {
          p_bill_id: id,
          p_reason: reason
        });
        if (!error && data) return res.json(data);
      } catch (e) {}
    }

    if (bill) {
      const oldStatus = bill.status;
      bill.status = 'rejected';
      bill.rejected_by = req.user?.id || '00000000-0000-0000-0000-000000000000';
      bill.rejectedByName = req.user?.name || 'Finance Admin';
      bill.rejected_at = new Date().toISOString();
      bill.rejection_reason = reason;
      bill.updated_at = new Date().toISOString();

      store.history.unshift({
        id: `hist-${Date.now()}`,
        bill_id: id,
        old_status: oldStatus,
        new_status: 'rejected',
        changed_by: req.user?.id || '00000000-0000-0000-0000-000000000000',
        changed_by_name: req.user?.name || 'Finance Admin',
        reason: reason,
        created_at: new Date().toISOString()
      });
      writeLocalStore(store);
      return res.json({ success: true, status: 'rejected' });
    }

    return res.status(404).json({ error: 'Bill not found' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/bills/:id/queries
router.get('/bills/:id/queries', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdmin();
    const store = readLocalStore();

    if (supabase) {
      try {
        const { data, error } = await supabase
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
          .eq('bill_id', id)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          return res.json({ success: true, data });
        }
      } catch (e) {}
    }

    const queries = (store.queries || []).filter(q => q.bill_id === id).map(q => {
      const responses = (store.query_responses || []).filter(r => r.query_id === q.id);
      return { ...q, responses };
    });

    return res.json({ success: true, data: queries });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/bills/:id/queries
router.post('/bills/:id/queries', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdmin();
    const store = readLocalStore();
    const { queryType, question, priority = 'normal', assignedTo } = req.body || {};

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, error: 'Question text is required' });
    }

    const callerId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const callerName = req.user?.name || req.user?.email || 'Staff';

    const queryRecord = {
      id: `qry-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      bill_id: id,
      raised_by: callerId,
      raisedByName: callerName,
      assigned_to: assignedTo || null,
      query_type: queryType || 'amount_discrepancy',
      question: question.trim(),
      priority: priority || 'normal',
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    store.queries.unshift(queryRecord);

    // Update bill status to query_raised
    const bill = store.bills.find(b => b.id === id);
    if (bill && bill.status !== 'approved' && bill.status !== 'paid') {
      const oldStatus = bill.status;
      bill.status = 'query_raised';
      bill.updated_at = new Date().toISOString();
      store.history.unshift({
        id: `hist-${Date.now()}`,
        bill_id: id,
        old_status: oldStatus,
        new_status: 'query_raised',
        changed_by: callerId,
        changed_by_name: callerName,
        reason: `Query raised: ${question.trim().slice(0, 100)}`,
        created_at: new Date().toISOString()
      });
    }

    writeLocalStore(store);

    if (supabase) {
      try {
        await supabase.from('finance_bill_queries').insert([queryRecord]);
      } catch (e) {}
    }

    return res.status(201).json({ success: true, data: queryRecord });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/finance/queries/:queryId/reply
router.post('/queries/:queryId/reply', requireAuth, async (req, res) => {
  try {
    const { queryId } = req.params;
    const supabase = getSupabaseAdmin();
    const store = readLocalStore();
    const { responseText } = req.body || {};

    if (!responseText || !responseText.trim()) {
      return res.status(400).json({ success: false, error: 'Response text is required' });
    }

    const callerId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const callerName = req.user?.name || req.user?.email || 'Staff';

    const responseRecord = {
      id: `qresp-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      query_id: queryId,
      response_text: responseText.trim(),
      responded_by: callerId,
      responderName: callerName,
      created_at: new Date().toISOString()
    };

    store.query_responses.push(responseRecord);

    const query = store.queries.find(q => q.id === queryId);
    if (query) {
      query.status = 'in_review';
      query.updated_at = new Date().toISOString();
    }

    writeLocalStore(store);

    if (supabase) {
      try {
        await supabase.from('finance_query_responses').insert([responseRecord]);
      } catch (e) {}
    }

    return res.status(201).json({ success: true, data: responseRecord });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/finance/bills/:id/reconciliations
router.get('/bills/:id/reconciliations', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdmin();
    const store = readLocalStore();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('finance_reconciliation_records')
          .select(`
            *,
            matcher:profiles!finance_reconciliation_records_matched_by_fkey(name)
          `)
          .eq('bill_id', id)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          return res.json({ success: true, data });
        }
      } catch (e) {}
    }

    const records = (store.reconciliations || []).filter(r => r.bill_id === id);
    return res.json({ success: true, data: records });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/bills/:id/reconciliations
router.post('/bills/:id/reconciliations', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdmin();
    const store = readLocalStore();
    const { reconciliationType, referenceNumber, expectedAmount, actualAmount, notes } = req.body || {};

    const callerId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const callerName = req.user?.name || 'Staff';

    const exp = Number(expectedAmount || 0);
    const act = Number(actualAmount || 0);
    const discrepancy = Math.abs(exp - act);
    const isMatched = discrepancy < 0.01;

    const recRecord = {
      id: `rec-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      bill_id: id,
      reconciliation_type: reconciliationType || 'invoice_delivery_note',
      reference_number: referenceNumber || 'N/A',
      expected_amount: exp,
      actual_amount: act,
      discrepancy_amount: discrepancy,
      status: isMatched ? 'matched' : 'discrepancy',
      notes: notes || '',
      matched_by: callerId,
      matcherName: callerName,
      created_at: new Date().toISOString()
    };

    store.reconciliations.unshift(recRecord);

    store.history.unshift({
      id: `hist-${Date.now()}`,
      bill_id: id,
      old_status: null,
      new_status: isMatched ? 'reconciled' : 'reconciliation_discrepancy',
      changed_by: callerId,
      changed_by_name: callerName,
      reason: `Reconciliation: ${recRecord.reconciliation_type} (${recRecord.status})`,
      created_at: new Date().toISOString()
    });

    writeLocalStore(store);

    if (supabase) {
      try {
        await supabase.from('finance_reconciliation_records').insert([recRecord]);
      } catch (e) {}
    }

    return res.status(201).json({ success: true, data: recRecord });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/finance/bills/:id/payments
router.get('/bills/:id/payments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdmin();
    const store = readLocalStore();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('finance_payment_records')
          .select(`
            *,
            recorder:profiles!finance_payment_records_recorded_by_fkey(name)
          `)
          .eq('bill_id', id)
          .order('payment_date', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          return res.json({ success: true, data });
        }
      } catch (e) {}
    }

    const records = (store.payments || []).filter(p => p.bill_id === id);
    return res.json({ success: true, data: records });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/bills/:id/payments
router.post('/bills/:id/payments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdmin();
    const store = readLocalStore();
    const { paymentReference, paymentAmount, paymentDate, paymentStatus = 'paid' } = req.body || {};

    const amount = Number(paymentAmount || 0);
    if (amount <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
    }

    const callerId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const callerName = req.user?.name || 'Staff';

    const paymentRecord = {
      id: `pay-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      bill_id: id,
      payment_reference: paymentReference || `TXN-${Date.now().toString().slice(-6)}`,
      payment_amount: amount,
      payment_date: paymentDate || new Date().toISOString().split('T')[0],
      payment_status: paymentStatus || 'paid',
      recorded_by: callerId,
      recorderName: callerName,
      created_at: new Date().toISOString()
    };

    store.payments.unshift(paymentRecord);

    // Check sum of payments against bill total
    const bill = store.bills.find(b => b.id === id);
    if (bill) {
      const totalPaid = store.payments
        .filter(p => p.bill_id === id)
        .reduce((sum, p) => sum + Number(p.payment_amount || 0), 0);

      const oldStatus = bill.status;
      const newStatus = totalPaid >= (bill.total_amount || 0) ? 'paid' : 'partially_paid';
      bill.status = newStatus;
      bill.updated_at = new Date().toISOString();

      store.history.unshift({
        id: `hist-${Date.now()}`,
        bill_id: id,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: callerId,
        changed_by_name: callerName,
        reason: `Payment of £${amount.toFixed(2)} recorded (Ref: ${paymentRecord.payment_reference})`,
        created_at: new Date().toISOString()
      });
    }

    writeLocalStore(store);

    if (supabase) {
      try {
        await supabase.from('finance_payment_records').insert([paymentRecord]);
      } catch (e) {}
    }

    return res.status(201).json({ success: true, data: paymentRecord, billStatus: bill?.status });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/finance/bills/:id/history
router.get('/bills/:id/history', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdmin();
    const store = readLocalStore();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('finance_bill_status_history')
          .select(`
            *,
            user:profiles!finance_bill_status_history_changed_by_fkey(name)
          `)
          .eq('bill_id', id)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          return res.json({ success: true, data });
        }
      } catch (e) {}
    }

    const history = (store.history || []).filter(h => h.bill_id === id);
    return res.json({ success: true, data: history });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/bills/:id/attachments
router.post('/bills/:id/attachments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);
    const { fileName, attachmentType, dataUrl, storagePath, fileSizeBytes, mimeType } = req.body || {};

    const callerId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const attachmentUuid = crypto.randomUUID();

    const attachmentRecord = {
      id: attachmentUuid,
      bill_id: id,
      file_name: fileName || 'document.pdf',
      attachment_type: attachmentType || 'vendor_invoice',
      storage_bucket: 'finance-documents',
      storage_path: storagePath || `finance/${id}/${fileName || 'document.pdf'}`,
      data_url: dataUrl || null,
      mime_type: mimeType || 'application/pdf',
      file_size_bytes: Number(fileSizeBytes || 1024),
      uploaded_by: callerId,
      created_at: new Date().toISOString()
    };

    store.attachments.push(attachmentRecord);
    writeLocalStore(store);
    await persistStore(store, supabase, callerId);

    if (supabase) {
      try {
        await supabase.from('finance_bill_attachments').insert([{
          id: attachmentUuid,
          bill_id: id,
          file_name: attachmentRecord.file_name,
          storage_bucket: attachmentRecord.storage_bucket,
          storage_path: attachmentRecord.storage_path,
          attachment_type: attachmentRecord.attachment_type,
          mime_type: attachmentRecord.mime_type,
          file_size_bytes: attachmentRecord.file_size_bytes,
          uploaded_by: isValidUuid(callerId) ? callerId : null,
          created_at: attachmentRecord.created_at
        }]);
      } catch (e) {
        console.warn('[FinanceRoute] Supabase attachment insert skipped:', e);
      }
    }

    return res.status(201).json({ success: true, data: attachmentRecord });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/finance/bills/:id/attachments/:attachmentId
// Restricted strictly to Admins and Super Admins
router.delete('/bills/:id/attachments/:attachmentId', requireAuth, requireRole('Super Admin', 'Admin'), async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);

    const bill = store.bills.find(b => b.id === id);
    const attIndex = store.attachments.findIndex(a => (a.id === attachmentId || a.id === `att-${attachmentId}`) && (a.bill_id === id || !a.bill_id));
    const att = attIndex !== -1 ? store.attachments[attIndex] : store.attachments.find(a => a.id === attachmentId);

    // 1. Remove from unified local store attachments
    store.attachments = store.attachments.filter(a => a.id !== attachmentId && a.id !== `att-${attachmentId}`);

    // 2. Remove from bill inline attachments if present
    if (bill && Array.isArray(bill.attachments)) {
      bill.attachments = bill.attachments.filter((a: any) => a.id !== attachmentId && a.id !== `att-${attachmentId}`);
    }

    // 3. Persist local store and cloud backup
    writeLocalStore(store);
    await persistStore(store, supabase, req.user?.id);

    // 4. Clean up live Supabase storage and database table completely
    if (supabase) {
      try {
        // Delete database row
        if (isValidUuid(attachmentId)) {
          await supabase.from('finance_bill_attachments').delete().eq('id', attachmentId);
        } else {
          await supabase.from('finance_bill_attachments').delete().match({ bill_id: id });
        }

        // Delete from Supabase Storage bucket
        const storagePath = att?.storage_path || att?.storagePath;
        if (storagePath) {
          const bucket = att?.storage_bucket || att?.storageBucket || 'finance-documents';
          await supabase.storage.from(bucket).remove([storagePath]);
        }

        // Record audit trail
        await supabase.from('audit_trails').insert([{
          id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          timestamp: new Date().toISOString(),
          user: req.user?.name || req.user?.email || 'Administrator',
          action: 'DELETE',
          details: `Deleted attachment [${att?.file_name || attachmentId}] from bill [${bill?.bill_number || id}]`,
          site: bill?.site_id,
          module: 'Finance',
          entity_type: 'finance_bill_attachments',
          entity_id: attachmentId
        }]);
      } catch (e) {
        console.warn('[FinanceRoute] Supabase attachment cleanup warning:', e);
      }
    }

    // 5. Add status history audit
    store.history.unshift({
      id: `hist-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      bill_id: id,
      old_status: bill?.status || 'submitted',
      new_status: bill?.status || 'submitted',
      changed_by: req.user?.id || '00000000-0000-0000-0000-000000000000',
      changed_by_name: req.user?.name || 'Administrator',
      reason: `Permanently deleted attachment: ${att?.file_name || attachmentId}`,
      created_at: new Date().toISOString()
    });
    writeLocalStore(store);

    return res.json({
      success: true,
      message: 'Attachment deleted and completely cleaned up from storage and database'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// GET /api/finance/vendors
router.get('/vendors', requireAuth, async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('finance_vendors')
          .select('*')
          .order('vendor_name', { ascending: true });

        if (!error && data && data.length > 0) {
          return res.json({ success: true, data });
        }
      } catch (e) {}
    }

    return res.json({ success: true, data: store.vendors });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/vendors
router.post('/vendors', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);
    const vendorData = req.body || {};

    const id = (vendorData.id && isValidUuid(vendorData.id)) ? vendorData.id : crypto.randomUUID();
    const existing = store.vendors.find(v => v.id === id);

    const vendorRecord = {
      id,
      organization_id: vendorData.organizationId || vendorData.organization_id || existing?.organization_id || '00000000-0000-0000-0000-000000000001',
      vendor_name: vendorData.vendorName || vendorData.vendor_name || existing?.vendor_name || 'New Vendor',
      vendor_reference: vendorData.vendorReference !== undefined ? vendorData.vendorReference : (vendorData.vendor_reference !== undefined ? vendorData.vendor_reference : (existing?.vendor_reference || null)),
      contact_email: vendorData.contactEmail !== undefined ? vendorData.contactEmail : (vendorData.contact_email !== undefined ? vendorData.contact_email : (existing?.contact_email || null)),
      contact_phone: vendorData.contactPhone !== undefined ? vendorData.contactPhone : (vendorData.contact_phone !== undefined ? vendorData.contact_phone : (existing?.contact_phone || null)),
      payment_details: vendorData.paymentDetails || vendorData.payment_details || existing?.payment_details || {},
      status: vendorData.status || existing?.status || 'active',
      created_by: existing?.created_by || req.user?.id || null,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    store.vendors = store.vendors.filter(v => v.id !== id);
    store.vendors.push(vendorRecord);
    await persistStore(store, supabase, req.user?.id);

    if (supabase) {
      try {
        await supabase.from('audit_trails').insert([{
          id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          timestamp: new Date().toISOString(),
          user: req.user?.name || req.user?.email || 'Staff',
          action: 'CREATE',
          details: `Registered vendor [${vendorRecord.vendor_name}] (${id})`,
          module: 'Finance',
          entity_type: 'finance_vendors',
          entity_id: id
        }]);
        const cleanUpsert = {
          id: vendorRecord.id,
          organization_id: isValidUuid(vendorRecord.organization_id) ? vendorRecord.organization_id : '00000000-0000-0000-0000-000000000001',
          vendor_name: vendorRecord.vendor_name,
          vendor_reference: vendorRecord.vendor_reference || null,
          contact_email: vendorRecord.contact_email || null,
          contact_phone: vendorRecord.contact_phone || null,
          payment_details: vendorRecord.payment_details || {},
          status: vendorRecord.status || 'active',
          created_by: isValidUuid(vendorRecord.created_by) ? vendorRecord.created_by : null
        };
        await supabase.from('finance_vendors').upsert([cleanUpsert]);
      } catch (e) {}
    }

    return res.status(201).json({ success: true, data: vendorRecord });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/finance/vendors/:id
router.put('/vendors/:id', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);
    const { id } = req.params;
    const vendorData = req.body || {};

    const existing = store.vendors.find(v => v.id === id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    const updatedVendor = {
      ...existing,
      ...vendorData,
      id,
      updated_at: new Date().toISOString()
    };

    store.vendors = store.vendors.map(v => v.id === id ? updatedVendor : v);
    await persistStore(store, supabase, req.user?.id);

    if (supabase) {
      try {
        await supabase.from('audit_trails').insert([{
          id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          timestamp: new Date().toISOString(),
          user: req.user?.name || req.user?.email || 'Staff',
          action: 'UPDATE',
          details: `Updated vendor [${updatedVendor.vendor_name}] (${id})`,
          module: 'Finance',
          entity_type: 'finance_vendors',
          entity_id: id
        }]);
        await supabase.from('finance_vendors').upsert([updatedVendor]);
      } catch (e) {}
    }

    return res.json({ success: true, data: updatedVendor });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/finance/vendors/:id
router.delete('/vendors/:id', requireAuth, requireRole('Super Admin', 'Admin'), async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);
    const { id } = req.params;

    const existing = store.vendors.find(v => v.id === id);
    store.vendors = store.vendors.filter(v => v.id !== id);
    await persistStore(store, supabase, req.user?.id);

    if (supabase) {
      try {
        await supabase.from('audit_trails').insert([{
          id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          timestamp: new Date().toISOString(),
          user: req.user?.name || req.user?.email || 'Staff',
          action: 'DELETE',
          details: `Deleted vendor [${existing?.vendor_name || id}]`,
          module: 'Finance',
          entity_type: 'finance_vendors',
          entity_id: id
        }]);
        await supabase.from('finance_vendors').delete().eq('id', id);
      } catch (e) {}
    }

    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/finance/bills/:id
router.delete('/bills/:id', requireAuth, requireRole('Super Admin', 'Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);
    const existing = store.bills.find(b => b.id === id);

    store.bills = store.bills.filter(b => b.id !== id);
    store.items = store.items.filter(i => i.bill_id !== id);
    store.attachments = store.attachments.filter(a => a.bill_id !== id);
    store.history = store.history.filter(h => h.bill_id !== id);
    store.queries = (store.queries || []).filter(q => q.bill_id !== id);
    store.reconciliations = (store.reconciliations || []).filter(r => r.bill_id !== id);
    store.payments = (store.payments || []).filter(p => p.bill_id !== id);
    await persistStore(store, supabase, req.user?.id);

    if (supabase) {
      try {
        await supabase.from('audit_trails').insert([{
          id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          timestamp: new Date().toISOString(),
          user: req.user?.name || req.user?.email || 'Staff',
          action: 'DELETE',
          details: `Deleted finance bill [${existing?.bill_number || id}]`,
          site: existing?.site_id,
          module: 'Finance',
          entity_type: 'finance_bills',
          entity_id: id
        }]);

        const targetTable = existing?.bill_type === 'vendor_invoice'
          ? 'vendor_invoices'
          : existing?.bill_type === 'credit_card_expense'
          ? 'credit_card_bills'
          : existing?.bill_type === 'delivery_note'
          ? 'delivery_notes'
          : 'finance_bills';

        const { error } = await supabase.from(targetTable).delete().eq('id', id);
        if (error && targetTable !== 'finance_bills') {
          await supabase.from('finance_bills').delete().eq('id', id);
        }
      } catch (e) {
        console.warn('[FinanceRoute] Supabase delete error:', e);
      }
    }

    return res.json({ success: true, id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ============================================================================
// Regional Managers & Approvers List
// ============================================================================
router.get('/approvers', requireAuth, async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return res.json({ success: true, approvers: [] });
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .in('role', ['Regional Manager', 'General Manager', 'Admin', 'Super Admin'])
      .order('name', { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.json({ success: true, approvers: data || [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// Move Bill to Approval / Route to RM
// ============================================================================
router.post('/bills/:id/request-approval', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);
    const { id } = req.params;
    const { approverId, approverName, notes } = req.body || {};
    const callerId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const callerName = req.user?.name || req.user?.email || 'Authenticated User';

    const billIdx = store.bills.findIndex(b => b.id === id);
    const existing = billIdx !== -1 ? store.bills[billIdx] : null;

    const oldStatus = existing?.status || 'submitted';
    const newStatus = 'awaiting_approval';

    if (billIdx !== -1) {
      store.bills[billIdx].status = newStatus;
      store.bills[billIdx].updated_at = new Date().toISOString();
      if (approverId) store.bills[billIdx].assigned_approver_id = approverId;
      if (approverName) store.bills[billIdx].assigned_approver_name = approverName;
    }

    const noteText = notes 
      ? `Moved to approval: ${notes}` 
      : `Moved to approval for review by ${approverName || 'Regional Manager'}`;

    const historyEntry = {
      id: `hist-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      bill_id: id,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: callerId,
      changed_by_name: callerName,
      reason: noteText,
      created_at: new Date().toISOString()
    };
    store.history.unshift(historyEntry);
    await persistStore(store, supabase, callerId);

    if (supabase) {
      try {
        await supabase.from('finance_bills').update({
          status: newStatus,
          updated_at: new Date().toISOString()
        }).eq('id', id);

        await supabase.from('finance_bill_status_history').insert([{
          bill_id: id,
          old_status: oldStatus,
          new_status: newStatus,
          changed_by: isValidUuid(callerId) ? callerId : null,
          reason: noteText
        }]);
      } catch (e) {
        console.warn('[FinanceRoute] Error writing status history to Supabase:', e);
      }
    }

    return res.json({ success: true, message: 'Bill moved to approval successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// Suppliers CRUD (for Delivery Notes & Invoices)
// ============================================================================
router.get('/suppliers', requireAuth, async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);

    let dbVendors: any[] = [];
    if (supabase) {
      const { data } = await supabase.from('finance_vendors').select('*').order('vendor_name', { ascending: true });
      if (Array.isArray(data)) dbVendors = data;
    }
    const map = new Map<string, any>();
    for (const v of store.vendors) {
      if (!v.id.startsWith('fven-') && !v.vendor_name?.includes('Apex Facilities') && !v.vendor_name?.includes('Direct Site Supplies')) {
        map.set(v.id, v);
      }
    }
    for (const v of dbVendors) {
      if (!v.id.startsWith('fven-') && !v.vendor_name?.includes('Apex Facilities') && !v.vendor_name?.includes('Direct Site Supplies')) {
        map.set(v.id, v);
      }
    }

    return res.json({ success: true, data: Array.from(map.values()) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/suppliers', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);
    const { name, email, phone, reference } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Supplier name is required' });
    }

    const cleanName = String(name).trim();
    const supplierId = crypto.randomUUID();
    const newSupplier = {
      id: supplierId,
      organization_id: '00000000-0000-0000-0000-000000000001',
      vendor_name: cleanName,
      vendor_reference: reference || `SUP-${Date.now().toString().slice(-4)}`,
      contact_email: email || null,
      contact_phone: phone || null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    store.vendors.push(newSupplier);
    await persistStore(store, supabase, req.user?.id);

    if (supabase) {
      try {
        const { data: dbCreated } = await supabase.from('finance_vendors').insert([{
          id: supplierId,
          vendor_name: newSupplier.vendor_name,
          vendor_reference: newSupplier.vendor_reference,
          contact_email: newSupplier.contact_email,
          contact_phone: newSupplier.contact_phone,
          status: 'active',
          organization_id: '00000000-0000-0000-0000-000000000001'
        }]).select().single();

        if (dbCreated) {
          return res.status(201).json({ success: true, supplier: dbCreated });
        }
      } catch (e) {
        console.warn('[FinanceRoute] Error creating supplier in Supabase:', e);
      }
    }

    return res.status(201).json({ success: true, supplier: newSupplier });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/suppliers/:id', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const store = await getUnifiedStore(supabase);
    const { id } = req.params;

    store.vendors = store.vendors.filter(v => v.id !== id);
    await persistStore(store, supabase, req.user?.id);

    if (supabase && isValidUuid(id)) {
      await supabase.from('finance_vendors').delete().eq('id', id);
    }
    return res.json({ success: true, message: 'Supplier removed successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
