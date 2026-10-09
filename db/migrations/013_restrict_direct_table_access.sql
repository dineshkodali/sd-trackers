-- =====================================================================
-- 013 — Restrict direct PostgREST access for signed-in users
--
-- Security audit 2026-10-08: the tables below had RLS policies of the form
--   FOR ALL TO authenticated USING (true) WITH CHECK (true)
-- Every staff member receives a Supabase access token at sign-in, so any of
-- them could read, change or delete every site's service-user, property,
-- placement, check and finance-workflow rows directly through the Supabase
-- REST API, bypassing the server's site isolation and role checks.
--
-- After this migration only the server (service_role) can access these
-- tables; the browser must go through /api, which enforces authorization.
--
-- Also applied automatically: db/schema.sql (run at server start) ends with
-- these same statements. Run this file manually only for databases whose schema is not managed by the server. The browser "direct Supabase
-- fallback" (src/lib/directSupabaseAdapter.ts) will stop working for these
-- tables, which is the intended effect.
-- =====================================================================

DO $$
DECLARE
  t TEXT;
  locked_tables TEXT[] := ARRAY[
    'welfare_checks', 'food_surveys', 'food_meal_ratings', 'room_checks', 'room_check_items',
    'properties', 'property_rooms', 'property_facilities', 'property_assets',
    'property_compliance', 'property_documents', 'property_contacts',
    'service_users', 'service_user_contacts', 'service_user_household',
    'service_user_support', 'service_user_documents', 'placements'
  ];
BEGIN
  FOREACH t IN ARRAY locked_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'p_' || t || '_auth_all', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Finance child tables: drop the permissive write-all policy and the anon
-- grant. The site/finance-scoped SELECT policies remain in place.
DO $$
DECLARE
  t TEXT;
  finance_children TEXT[] := ARRAY[
    'finance_bill_items', 'finance_bill_attachments', 'finance_verification_tasks',
    'finance_approval_requests', 'finance_bill_queries', 'finance_reconciliation_records',
    'finance_payment_records', 'finance_bill_status_history', 'finance_workflow_events'
  ];
BEGIN
  FOREACH t IN ARRAY finance_children LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all_policy', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations', 'finance_vendors', 'finance_bills', 'finance_verification_profiles',
    'finance_profile_members', 'finance_routing_rules', 'finance_approval_responses',
    'finance_verification_responses', 'finance_query_responses'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "finance_vendors_manage_policy" ON public.finance_vendors;

-- Legacy audit log: signed-in users could insert entries with any identity.
DROP POLICY IF EXISTS p_audit_logs_auth_insert ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM authenticated;

-- Fail closed when the caller has no profile role (auth.uid() is NULL for the
-- service role), instead of NULL NOT IN (...) silently skipping the check.
DO $$
BEGIN
  IF to_regprocedure('public.fn_finance_final_approval(uuid, text)') IS NOT NULL THEN
    RAISE NOTICE 'Re-run db/migrations/004_finance_module.sql (now fail-closed) to refresh fn_finance_final_approval.';
  END IF;
END $$;
