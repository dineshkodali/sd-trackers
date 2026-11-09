-- =====================================================================
-- Migration 032: Direct Supabase RLS Policies for HO Reports & Report History
--
-- Enables Row Level Security and creates direct CRUD policies for
-- authenticated and anon roles on:
-- 1. ho_report_templates
-- 2. ho_report_records
-- 3. ho_report_audit_logs
-- 4. service_user_report_history
--
-- Run this in Supabase Dashboard -> SQL Editor
-- SAFE & IDEMPOTENT: Can be safely re-run multiple times.
-- =====================================================================

DO $$
DECLARE
  tables_to_permit TEXT[] := ARRAY[
    'ho_report_templates',
    'ho_report_records',
    'ho_report_audit_logs',
    'service_user_report_history'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables_to_permit
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      -- Ensure RLS is active
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      -- Grant standard table privileges to all runtime roles
      EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
      EXECUTE format('GRANT ALL ON public.%I TO anon', t);

      -- Clean up previous versions of direct policies
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'direct_auth_all_' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'direct_anon_all_' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'direct_auth_select_' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'direct_auth_insert_' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'direct_auth_update_' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'direct_auth_delete_' || t, t);

      -- Policy 1: Authenticated users have full CRUD access
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        'direct_auth_all_' || t, t
      );

      -- Policy 2: Anonymous / direct client connections have full CRUD access
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
        'direct_anon_all_' || t, t
      );
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

