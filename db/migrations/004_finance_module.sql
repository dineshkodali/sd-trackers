-- =====================================================================
-- SDTracker Finance Module Migration (004_finance_module.sql)
--
-- NON-DESTRUCTIVE and IDEMPOTENT.
-- Integrates with SDTracker core schema:
--   - sites.id is TEXT
--   - profiles.id / auth.users.id is UUID
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Keep the existing RBAC matrix compatible while giving Finance its own grant.
ALTER TABLE IF EXISTS public.role_permissions
  ADD COLUMN IF NOT EXISTS can_manage_finance BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO public.role_permissions (
  id, role, can_view_all_properties, can_create_records, can_edit_records,
  can_delete_records, can_archive_restore, can_export_data, can_manage_files,
  can_manage_finance
)
VALUES (
  'Finance Staff', 'Finance Staff', TRUE, TRUE, TRUE,
  FALSE, FALSE, TRUE, TRUE, TRUE
)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  can_view_all_properties = EXCLUDED.can_view_all_properties,
  can_create_records = EXCLUDED.can_create_records,
  can_edit_records = EXCLUDED.can_edit_records,
  can_delete_records = EXCLUDED.can_delete_records,
  can_archive_restore = EXCLUDED.can_archive_restore,
  can_export_data = EXCLUDED.can_export_data,
  can_manage_files = EXCLUDED.can_manage_files,
  can_manage_finance = EXCLUDED.can_manage_finance,
  updated_at = NOW();


-- 1. Organizations table (Multi-tenancy foundation)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default organization if not exists
INSERT INTO public.organizations (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'SD Commercial Operations', 'sd-commercial', 'active')
ON CONFLICT (id) DO NOTHING;

-- 2. Vendors table
CREATE TABLE IF NOT EXISTS public.finance_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.organizations(id),
  vendor_name TEXT NOT NULL,
  vendor_reference TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  payment_details JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_vendors_org ON public.finance_vendors(organization_id, status);

-- 3. Finance Bills table (Central Table)
CREATE TABLE IF NOT EXISTS public.finance_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.organizations(id),
  site_id TEXT NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  vendor_id UUID REFERENCES public.finance_vendors(id) ON DELETE SET NULL,
  bill_number TEXT NOT NULL,
  bill_type TEXT NOT NULL CHECK (
    bill_type IN ('vendor_invoice', 'credit_card_expense', 'delivery_note', 'other_expense')
  ),
  bill_date DATE NOT NULL,
  due_date DATE,
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  description TEXT,
  purchase_reference TEXT,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'submitted',
      'under_review',
      'verification_pending',
      'query_raised',
      'awaiting_approval',
      'approved',
      'rejected',
      'payment_pending',
      'partially_paid',
      'paid',
      'reconciliation_pending',
      'reconciled',
      'cancelled'
    )
  ),
  final_approved_by UUID REFERENCES public.profiles(id),
  final_approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_bills_org_status ON public.finance_bills(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_finance_bills_site ON public.finance_bills(site_id);
CREATE INDEX IF NOT EXISTS idx_finance_bills_vendor ON public.finance_bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_finance_bills_submitted_at ON public.finance_bills(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_bills_due_date ON public.finance_bills(due_date);

-- 4. Bill Line Items
CREATE TABLE IF NOT EXISTS public.finance_bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_bill_items_bill ON public.finance_bill_items(bill_id);

-- 5. Bill Attachments
CREATE TABLE IF NOT EXISTS public.finance_bill_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'finance-documents',
  storage_path TEXT NOT NULL,
  attachment_type TEXT NOT NULL CHECK (
    attachment_type IN (
      'vendor_invoice',
      'delivery_note',
      'credit_card_receipt',
      'purchase_order',
      'proof_of_delivery',
      'other'
    )
  ),
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_bill_attachments_bill ON public.finance_bill_attachments(bill_id);

-- 6. Verification Profiles & Members
CREATE TABLE IF NOT EXISTS public.finance_verification_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  profile_type TEXT NOT NULL CHECK (
    profile_type IN (
      'site_verification',
      'procurement_verification',
      'finance_verification',
      'management_verification',
      'custom'
    )
  ),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_profile_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.finance_verification_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, user_id)
);

-- 7. Verification Tasks & Responses
CREATE TABLE IF NOT EXISTS public.finance_verification_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.finance_verification_profiles(id),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  instructions TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (
    status IN ('assigned', 'in_progress', 'submitted', 'returned', 'cancelled')
  ),
  result TEXT CHECK (
    result IS NULL OR result IN ('verified', 'query', 'rejected', 'needs_more_information')
  ),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_tasks_assigned ON public.finance_verification_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_finance_tasks_bill ON public.finance_verification_tasks(bill_id);

CREATE TABLE IF NOT EXISTS public.finance_verification_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.finance_verification_tasks(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (
    result IN ('verified', 'query', 'rejected', 'needs_more_information')
  ),
  comments TEXT,
  responded_by UUID NOT NULL REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Configurable Routing Rules
CREATE TABLE IF NOT EXISTS public.finance_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  bill_type TEXT,
  min_amount NUMERIC(14,2) CHECK (min_amount IS NULL OR min_amount >= 0),
  max_amount NUMERIC(14,2) CHECK (max_amount IS NULL OR max_amount >= 0),
  verification_profile_id UUID REFERENCES public.finance_verification_profiles(id) ON DELETE SET NULL,
  requires_external_approval BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (min_amount IS NULL OR max_amount IS NULL OR min_amount <= max_amount)
);

-- 9. Approval Requests & Responses
CREATE TABLE IF NOT EXISTS public.finance_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  routing_rule_id UUID REFERENCES public.finance_routing_rules(id) ON DELETE SET NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  approval_type TEXT NOT NULL CHECK (
    approval_type IN ('department_approval', 'manager_approval', 'finance_final_approval')
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'in_progress', 'approved', 'rejected', 'returned', 'cancelled')
  ),
  request_message TEXT,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_approvals_assigned ON public.finance_approval_requests(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_finance_approvals_bill ON public.finance_approval_requests(bill_id);

CREATE TABLE IF NOT EXISTS public.finance_approval_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES public.finance_approval_requests(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (
    decision IN ('approved', 'rejected', 'query', 'returned')
  ),
  comments TEXT,
  responded_by UUID NOT NULL REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Bill Queries & Responses
CREATE TABLE IF NOT EXISTS public.finance_bill_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  query_type TEXT NOT NULL CHECK (
    query_type IN ('missing_document', 'amount_discrepancy', 'delivery_confirmation', 'vendor_clarification', 'other')
  ),
  question TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (
    priority IN ('low', 'normal', 'high', 'urgent')
  ),
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'in_progress', 'responded', 'resolved', 'closed')
  ),
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_queries_assigned ON public.finance_bill_queries(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_finance_queries_bill ON public.finance_bill_queries(bill_id);

CREATE TABLE IF NOT EXISTS public.finance_query_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES public.finance_bill_queries(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  responded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Manual Reconciliation Records
CREATE TABLE IF NOT EXISTS public.finance_reconciliation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  reconciliation_type TEXT NOT NULL CHECK (
    reconciliation_type IN ('invoice_delivery_note', 'invoice_purchase_reference', 'invoice_payment', 'other')
  ),
  reference_number TEXT,
  expected_amount NUMERIC(14,2),
  actual_amount NUMERIC(14,2),
  variance_amount NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (
    status IN ('not_started', 'in_progress', 'matched', 'partial_match', 'discrepancy', 'resolved')
  ),
  notes TEXT,
  matched_by UUID REFERENCES auth.users(id),
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_bill ON public.finance_reconciliation_records(bill_id);
CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_status ON public.finance_reconciliation_records(status);

-- 12. Payment Records
CREATE TABLE IF NOT EXISTS public.finance_payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  payment_reference TEXT,
  payment_amount NUMERIC(14,2) NOT NULL CHECK (payment_amount > 0),
  payment_date DATE,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    payment_status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')
  ),
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_payment_records_bill ON public.finance_payment_records(bill_id);

-- 13. Audit Trails & Status History
CREATE TABLE IF NOT EXISTS public.finance_bill_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_bill_history_bill ON public.finance_bill_status_history(bill_id);

CREATE TABLE IF NOT EXISTS public.finance_workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_workflow_events_bill ON public.finance_workflow_events(bill_id);

-- Apply updated_at trigger across finance tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'organizations', 'finance_vendors', 'finance_bills', 'finance_verification_profiles',
    'finance_verification_tasks', 'finance_routing_rules', 'finance_approval_requests',
    'finance_bill_queries', 'finance_reconciliation_records', 'finance_payment_records'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', tbl, tbl);
  END LOOP;
END $$;

-- =====================================================================
-- RLS & SECURITY HELPER FUNCTIONS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_finance_user(p_user_id UUID, p_org_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  RETURN v_role IN ('Super Admin', 'Admin', 'Finance Admin', 'Finance Manager', 'Finance Staff');
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_finance_site(p_user_id UUID, p_site_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_assigned TEXT;
BEGIN
  SELECT role, assigned_site INTO v_role, v_assigned FROM public.profiles WHERE id = p_user_id;
  IF v_role IN ('Super Admin', 'Admin', 'Finance Admin', 'Finance Manager', 'Finance Staff', 'Regional Manager') THEN
    RETURN TRUE;
  END IF;
  IF v_assigned = 'All Sites' OR v_assigned = p_site_id THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.property_user_assignments 
    WHERE user_id = p_user_id AND (property_id = p_site_id OR p_site_id = ANY(assigned_properties))
  );
END;
$$;

-- Enable RLS across all finance tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bill_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_verification_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_profile_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_verification_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_verification_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_approval_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bill_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_query_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_reconciliation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bill_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_workflow_events ENABLE ROW LEVEL SECURITY;

-- Grants
DO $$
DECLARE
  t TEXT;
  finance_tables TEXT[] := ARRAY[
    'organizations', 'finance_vendors', 'finance_bills', 'finance_bill_items',
    'finance_bill_attachments', 'finance_verification_profiles', 'finance_profile_members',
    'finance_verification_tasks', 'finance_verification_responses', 'finance_routing_rules',
    'finance_approval_requests', 'finance_approval_responses', 'finance_bill_queries',
    'finance_query_responses', 'finance_reconciliation_records', 'finance_payment_records',
    'finance_bill_status_history', 'finance_workflow_events'
  ];
BEGIN
  FOREACH t IN ARRAY finance_tables LOOP
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
  END LOOP;
END $$;

-- Policies for finance_bills
DROP POLICY IF EXISTS "finance_bills_select_policy" ON public.finance_bills;
CREATE POLICY "finance_bills_select_policy" ON public.finance_bills
FOR SELECT TO authenticated
USING (
  public.is_finance_user(auth.uid(), organization_id)
  OR public.can_access_finance_site(auth.uid(), site_id)
  OR submitted_by = auth.uid()
);

DROP POLICY IF EXISTS "finance_bills_insert_policy" ON public.finance_bills;
CREATE POLICY "finance_bills_insert_policy" ON public.finance_bills
FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND public.can_access_finance_site(auth.uid(), site_id)
);

DROP POLICY IF EXISTS "finance_bills_update_policy" ON public.finance_bills;
CREATE POLICY "finance_bills_update_policy" ON public.finance_bills
FOR UPDATE TO authenticated
USING (
  public.is_finance_user(auth.uid(), organization_id)
  OR (submitted_by = auth.uid() AND status IN ('draft', 'query_raised'))
);

-- Child tables policies (inherits bill visibility)
DO $$
DECLARE
  child_tbl TEXT;
  child_tables TEXT[] := ARRAY[
    'finance_bill_items', 'finance_bill_attachments', 'finance_verification_tasks',
    'finance_approval_requests', 'finance_bill_queries', 'finance_reconciliation_records',
    'finance_payment_records', 'finance_bill_status_history', 'finance_workflow_events'
  ];
BEGIN
  FOREACH child_tbl IN ARRAY child_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', child_tbl || '_select_policy', child_tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.finance_bills b 
          WHERE b.id = %I.bill_id AND (
            public.is_finance_user(auth.uid(), b.organization_id)
            OR public.can_access_finance_site(auth.uid(), b.site_id)
            OR b.submitted_by = auth.uid()
          )
        )
      )', child_tbl || '_select_policy', child_tbl, child_tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', child_tbl || '_all_policy', child_tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      child_tbl || '_all_policy', child_tbl
    );
  END LOOP;
END $$;

-- Reference data policies
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
CREATE POLICY "organizations_select_policy" ON public.organizations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "finance_vendors_select_policy" ON public.finance_vendors;
CREATE POLICY "finance_vendors_select_policy" ON public.finance_vendors FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "finance_vendors_manage_policy" ON public.finance_vendors;
CREATE POLICY "finance_vendors_manage_policy" ON public.finance_vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================================
-- WORKFLOW RPC STATE MACHINE FUNCTIONS
-- =====================================================================

-- 1. Submit Bill
CREATE OR REPLACE FUNCTION public.fn_finance_submit_bill(p_bill_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bill RECORD;
BEGIN
  SELECT * INTO v_bill FROM public.finance_bills WHERE id = p_bill_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
  END IF;

  IF v_bill.status NOT IN ('draft', 'query_raised') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bill is not in a submittable state');
  END IF;

  UPDATE public.finance_bills
  SET status = 'submitted', updated_at = NOW()
  WHERE id = p_bill_id;

  INSERT INTO public.finance_bill_status_history (bill_id, old_status, new_status, changed_by, reason)
  VALUES (p_bill_id, v_bill.status, 'submitted', auth.uid(), 'Bill submitted for review');

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (p_bill_id, 'bill_submitted', auth.uid(), jsonb_build_object('total_amount', v_bill.total_amount));

  RETURN jsonb_build_object('success', true, 'status', 'submitted');
END;
$$;

-- 2. Finance Final Approval
CREATE OR REPLACE FUNCTION public.fn_finance_final_approval(p_bill_id UUID, p_comments TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bill RECORD;
  v_user_role TEXT;
BEGIN
  SELECT * INTO v_bill FROM public.finance_bills WHERE id = p_bill_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
  END IF;

  -- Ensure caller is authorized Finance user
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  IF v_user_role NOT IN ('Super Admin', 'Admin', 'Finance Admin', 'Finance Manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Finance can grant final approval');
  END IF;

  -- Disallow self-approval under strict segregation of duties if user submitted the bill
  IF v_bill.submitted_by = auth.uid() AND v_user_role NOT IN ('Super Admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Segregation of duties: Submitter cannot grant final approval');
  END IF;

  UPDATE public.finance_bills
  SET status = 'approved',
      final_approved_by = auth.uid(),
      final_approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_bill_id;

  INSERT INTO public.finance_bill_status_history (bill_id, old_status, new_status, changed_by, reason)
  VALUES (p_bill_id, v_bill.status, 'approved', auth.uid(), COALESCE(p_comments, 'Final Finance Approval granted'));

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (p_bill_id, 'approval_decided', auth.uid(), jsonb_build_object('decision', 'approved', 'comments', p_comments));

  RETURN jsonb_build_object('success', true, 'status', 'approved');
END;
$$;

-- 3. Finance Reject Bill
CREATE OR REPLACE FUNCTION public.fn_finance_reject_bill(p_bill_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bill RECORD;
BEGIN
  SELECT * INTO v_bill FROM public.finance_bills WHERE id = p_bill_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
  END IF;

  UPDATE public.finance_bills
  SET status = 'rejected',
      rejected_by = auth.uid(),
      rejected_at = NOW(),
      rejection_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_bill_id;

  INSERT INTO public.finance_bill_status_history (bill_id, old_status, new_status, changed_by, reason)
  VALUES (p_bill_id, v_bill.status, 'rejected', auth.uid(), p_reason);

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (p_bill_id, 'approval_decided', auth.uid(), jsonb_build_object('decision', 'rejected', 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'status', 'rejected');
END;
$$;

-- 4. Raise Bill Query
CREATE OR REPLACE FUNCTION public.fn_finance_raise_query(
  p_bill_id UUID,
  p_query_type TEXT,
  p_question TEXT,
  p_assigned_to UUID,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_query_id UUID;
  v_old_status TEXT;
BEGIN
  SELECT status INTO v_old_status FROM public.finance_bills WHERE id = p_bill_id;

  INSERT INTO public.finance_bill_queries (bill_id, raised_by, assigned_to, query_type, question, priority, status)
  VALUES (p_bill_id, auth.uid(), p_assigned_to, p_query_type, p_question, p_priority, 'open')
  RETURNING id INTO v_query_id;

  UPDATE public.finance_bills
  SET status = 'query_raised', updated_at = NOW()
  WHERE id = p_bill_id;

  INSERT INTO public.finance_bill_status_history (bill_id, old_status, new_status, changed_by, reason)
  VALUES (p_bill_id, v_old_status, 'query_raised', auth.uid(), 'Query raised: ' || p_question);

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (p_bill_id, 'query_raised', auth.uid(), jsonb_build_object('query_id', v_query_id, 'type', p_query_type));

  RETURN jsonb_build_object('success', true, 'query_id', v_query_id);
END;
$$;

-- 5. Respond to Query
CREATE OR REPLACE FUNCTION public.fn_finance_respond_query(
  p_query_id UUID,
  p_response_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bill_id UUID;
BEGIN
  SELECT bill_id INTO v_bill_id FROM public.finance_bill_queries WHERE id = p_query_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Query not found');
  END IF;

  INSERT INTO public.finance_query_responses (query_id, response_text, responded_by)
  VALUES (p_query_id, p_response_text, auth.uid());

  UPDATE public.finance_bill_queries
  SET status = 'responded', updated_at = NOW()
  WHERE id = p_query_id;

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (v_bill_id, 'query_responded', auth.uid(), jsonb_build_object('query_id', p_query_id));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Record Manual Reconciliation
CREATE OR REPLACE FUNCTION public.fn_finance_record_reconciliation(
  p_bill_id UUID,
  p_reconciliation_type TEXT,
  p_reference_number TEXT,
  p_expected_amount NUMERIC,
  p_actual_amount NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec_id UUID;
  v_variance NUMERIC;
  v_rec_status TEXT;
BEGIN
  v_variance := COALESCE(p_actual_amount, 0) - COALESCE(p_expected_amount, 0);
  IF v_variance = 0 THEN
    v_rec_status := 'matched';
  ELSE
    v_rec_status := 'discrepancy';
  END IF;

  INSERT INTO public.finance_reconciliation_records (
    bill_id, reconciliation_type, reference_number, expected_amount, actual_amount,
    variance_amount, status, notes, matched_by, reconciled_at
  )
  VALUES (
    p_bill_id, p_reconciliation_type, p_reference_number, p_expected_amount, p_actual_amount,
    v_variance, v_rec_status, p_notes, auth.uid(), NOW()
  )
  RETURNING id INTO v_rec_id;

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (p_bill_id, 'reconciliation_completed', auth.uid(), jsonb_build_object('reconciliation_id', v_rec_id, 'status', v_rec_status, 'variance', v_variance));

  RETURN jsonb_build_object('success', true, 'reconciliation_id', v_rec_id, 'status', v_rec_status, 'variance', v_variance);
END;
$$;

-- 7. Record Payment
CREATE OR REPLACE FUNCTION public.fn_finance_record_payment(
  p_bill_id UUID,
  p_payment_reference TEXT,
  p_payment_amount NUMERIC,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_payment_status TEXT DEFAULT 'paid'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bill RECORD;
  v_paid_total NUMERIC;
  v_new_bill_status TEXT;
BEGIN
  SELECT * INTO v_bill FROM public.finance_bills WHERE id = p_bill_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
  END IF;

  INSERT INTO public.finance_payment_records (
    bill_id, payment_reference, payment_amount, payment_date, payment_status, recorded_by
  )
  VALUES (
    p_bill_id, p_payment_reference, p_payment_amount, p_payment_date, p_payment_status, auth.uid()
  );

  SELECT COALESCE(SUM(payment_amount), 0) INTO v_paid_total
  FROM public.finance_payment_records
  WHERE bill_id = p_bill_id AND payment_status = 'paid';

  IF v_paid_total >= v_bill.total_amount THEN
    v_new_bill_status := 'paid';
  ELSIF v_paid_total > 0 THEN
    v_new_bill_status := 'partially_paid';
  ELSE
    v_new_bill_status := 'payment_pending';
  END IF;

  UPDATE public.finance_bills
  SET status = v_new_bill_status, updated_at = NOW()
  WHERE id = p_bill_id;

  INSERT INTO public.finance_bill_status_history (bill_id, old_status, new_status, changed_by, reason)
  VALUES (p_bill_id, v_bill.status, v_new_bill_status, auth.uid(), 'Payment recorded: ' || p_payment_reference || ' (' || p_payment_amount || ')');

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (p_bill_id, 'payment_recorded', auth.uid(), jsonb_build_object('amount', p_payment_amount, 'reference', p_payment_reference));

  RETURN jsonb_build_object('success', true, 'bill_status', v_new_bill_status, 'total_paid', v_paid_total);
END;
$$;

-- ============================================================================
-- Finance Page-Matched Updatable Database Tables / Views
-- Consistent between:
--   "Vendor Invoices"   -> public.vendor_invoices
--   "Credit Card Bills" -> public.credit_card_bills
--   "Delivery Notes"    -> public.delivery_notes
--   "Finance Approvals" -> public.finance_approvals
-- ============================================================================

CREATE OR REPLACE VIEW public.vendor_invoices AS
  SELECT * FROM public.finance_bills
  WHERE bill_type = 'vendor_invoice';

CREATE OR REPLACE VIEW public.credit_card_bills AS
  SELECT * FROM public.finance_bills
  WHERE bill_type = 'credit_card_expense';

CREATE OR REPLACE VIEW public.delivery_notes AS
  SELECT * FROM public.finance_bills
  WHERE bill_type = 'delivery_note';

CREATE OR REPLACE VIEW public.finance_approvals AS
  SELECT * FROM public.finance_approval_requests;

-- Triggers for transparent two-way CRUD
CREATE OR REPLACE FUNCTION trg_vendor_invoices_ins() RETURNS TRIGGER AS $$
BEGIN
  NEW.bill_type := 'vendor_invoice';
  INSERT INTO public.finance_bills VALUES (NEW.*);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_vendor_invoices_insert
INSTEAD OF INSERT ON public.vendor_invoices
FOR EACH ROW EXECUTE FUNCTION trg_vendor_invoices_ins();

CREATE OR REPLACE FUNCTION trg_credit_card_bills_ins() RETURNS TRIGGER AS $$
BEGIN
  NEW.bill_type := 'credit_card_expense';
  INSERT INTO public.finance_bills VALUES (NEW.*);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_credit_card_bills_insert
INSTEAD OF INSERT ON public.credit_card_bills
FOR EACH ROW EXECUTE FUNCTION trg_credit_card_bills_ins();

CREATE OR REPLACE FUNCTION trg_delivery_notes_ins() RETURNS TRIGGER AS $$
BEGIN
  NEW.bill_type := 'delivery_note';
  INSERT INTO public.finance_bills VALUES (NEW.*);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_delivery_notes_insert
INSTEAD OF INSERT ON public.delivery_notes
FOR EACH ROW EXECUTE FUNCTION trg_delivery_notes_ins();

CREATE OR REPLACE FUNCTION trg_finance_view_del() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.finance_bills WHERE id = OLD.id;
  RETURN OLD;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_vendor_invoices_delete
INSTEAD OF DELETE ON public.vendor_invoices
FOR EACH ROW EXECUTE FUNCTION trg_finance_view_del();

CREATE OR REPLACE TRIGGER trg_credit_card_bills_delete
INSTEAD OF DELETE ON public.credit_card_bills
FOR EACH ROW EXECUTE FUNCTION trg_finance_view_del();

CREATE OR REPLACE TRIGGER trg_delivery_notes_delete
INSTEAD OF DELETE ON public.delivery_notes
FOR EACH ROW EXECUTE FUNCTION trg_finance_view_del();


-- ============================================================================
-- Seed Default Finance Vendors
-- ============================================================================
INSERT INTO public.finance_vendors (id, organization_id, vendor_name, vendor_reference, contact_email, contact_phone, status)
VALUES 
  ('00000000-0000-0000-0001-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Apex Facilities & Commercial Cleaning Ltd', 'APEX-FAC-01', 'accounts@apexfacilities.co.uk', '+44 20 7946 0912', 'active'),
  ('00000000-0000-0000-0001-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Brakes Foodservice Wholesale', 'BRAKES-UK-88', 'orders@brake.co.uk', '+44 34 5606 9090', 'active'),
  ('00000000-0000-0000-0001-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Total Commercial Laundry Solutions', 'TOT-LAU-09', 'billing@totallaundry.co.uk', '+44 16 1496 0233', 'active'),
  ('00000000-0000-0000-0001-000000000004'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'British Gas Business Energy', 'BG-UTIL-44', 'business@britishgas.co.uk', '+44 33 0100 0050', 'active'),
  ('00000000-0000-0000-0001-000000000005'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Enterprise Rent-A-Car Commercial', 'ENT-FLEET-12', 'commercial@enterprise.co.uk', '+44 80 0800 2277', 'active'),
  ('00000000-0000-0000-0001-000000000006'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Direct Site Supplies & Maintenance Ltd', 'DSS-MAINT-77', 'helpdesk@directsitesupplies.co.uk', '+44 12 1496 0888', 'active')
ON CONFLICT (id) DO UPDATE SET
  vendor_name = EXCLUDED.vendor_name,
  vendor_reference = EXCLUDED.vendor_reference,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone;

NOTIFY pgrst, 'reload schema';
