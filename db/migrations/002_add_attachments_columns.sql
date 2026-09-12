-- =====================================================================
-- Migration 002: Add Dedicated Attachments & File Link Columns Across All Tables
-- =====================================================================

DO $$
DECLARE
  operational_tables TEXT[] := ARRAY[
    'referrals', 'vulnerable_residents', 'challenging_behavior', 'maintenance_records',
    'spcd_records', 'sites', 'laundry_logs', 'hot_food_logs', 'escalations', 'documents',
    'data_change_requests', 'public_transport_records', 'compliance_records', 'gp_appointments',
    'rfa_welfare_checks', 'dispersal_records', 'booklet_collections', 'vcs_agencies'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY operational_tables
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT ''[]''::jsonb', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS attachment_url TEXT', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS file_url TEXT', t);
    END IF;
  END LOOP;
END $$;

-- Inform PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
