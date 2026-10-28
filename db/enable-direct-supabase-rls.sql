-- =====================================================================
-- Enable Direct Supabase RLS Policies for AWS Amplify / Static Hosting
--
-- This script enables direct read/write access for authenticated users
-- (and public/anon read access where appropriate) so that the application
-- hosted on AWS Amplify can connect directly to Supabase PostgREST
-- without requiring an Express backend server.
--
-- SAFE & IDEMPOTENT: Can be run multiple times in Supabase SQL Editor.
-- =====================================================================

DO $$
DECLARE
  app_tables TEXT[] := ARRAY[
    'profiles',
    'sites',
    'user_groups',
    'property_user_assignments',
    'laundry_logs',
    'hot_food_logs',
    'audit_trails',
    'referrals',
    'vulnerable_residents',
    'challenging_behavior',
    'maintenance_records',
    'spcd_records',
    'escalations',
    'documents',
    'data_change_requests',
    'password_audit_logs',
    'email_notification_rules',
    'email_notification_logs',
    'public_transport_records',
    'compliance_records',
    'gp_appointments',
    'rfa_welfare_checks',
    'dispersal_records',
    'booklet_collections',
    'vcs_agencies',
    'field_options',
    'role_permissions',
    'app_settings',
    'table_schemas',
    'audit_logs',
    'food_records',
    'laundry_records',
    'properties',
    'property_rooms',
    'property_facilities',
    'property_assets',
    'property_compliance',
    'property_documents',
    'property_contacts',
    'service_users',
    'service_user_contacts',
    'service_user_household',
    'service_user_support',
    'service_user_documents',
    'placements',
    'welfare_checks',
    'food_surveys',
    'food_meal_ratings',
    'room_checks',
    'room_check_items',
    'ir_records',
    'food_wastage_records',
    'daily_register_rooms',
    'daily_register_records',
    'new_arrivals_records',
    'eviction_records',
    -- Room management (migration 016). That migration locks these to the server only, which breaks
    -- the app on static hosting where the browser talks to Supabase directly.
    'room_beds',
    'inventory_items',
    'property_inventory_stock',
    'room_inventory',
    'inventory_movements',
    'room_kit_templates',
    'room_issues',
    'room_activity_log',
    -- CRM updates & new modules (migration 018)
    'mh_complaint_welfare_checks',
    'daily_laundry_logs',
    'housekeeping_logs',
    'housekeeping_room_logs',
    'food_consumption_reports',
    'food_box_requests',
    -- GP, PEEP & attendance (migration 020)
    'gp_registrations',
    'peep_plans',
    'peep_plan_history',
    'su_attendance_records',
    'absence_followups',
    -- Service User enhancements (migration 021)
    'su_hc2_details',
    'oyster_cards',
    'oyster_card_events',
    'su_meal_records',
    'su_meal_record_history',
    'su_education_details',
    'family_groups',
    'family_members',
    'su_archive_requests',
    -- Transport funding workflow (migration 022)
    'transport_funding_requests',
    'transport_funding_status_history',
    -- Oyster card inventory (migration 023)
    'oyster_card_transactions'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY app_tables
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
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'direct_anon_read_' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'direct_anon_all_' || t, t);

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

-- Allow anon to create audit logs and self-register/reset password audits
DO $$
BEGIN
  IF to_regclass('public.audit_trails') IS NOT NULL THEN
    DROP POLICY IF EXISTS "direct_anon_insert_audit" ON public.audit_trails;
    CREATE POLICY "direct_anon_insert_audit" ON public.audit_trails FOR INSERT TO anon WITH CHECK (true);
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "direct_anon_insert_profiles" ON public.profiles;
    CREATE POLICY "direct_anon_insert_profiles" ON public.profiles FOR INSERT TO anon WITH CHECK (true);
    DROP POLICY IF EXISTS "direct_anon_update_profiles" ON public.profiles;
    CREATE POLICY "direct_anon_update_profiles" ON public.profiles FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;

  IF to_regclass('public.sites') IS NOT NULL THEN
    DROP POLICY IF EXISTS "direct_anon_update_sites" ON public.sites;
    CREATE POLICY "direct_anon_update_sites" ON public.sites FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;


-- Allow authenticated & anon to run workflow RPCs
DO $$
BEGIN
  IF to_regprocedure('public.request_su_archive(TEXT,TEXT,TEXT,TEXT,TEXT)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.request_su_archive(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, anon;
  END IF;
  IF to_regprocedure('public.decide_su_archive_request(TEXT,TEXT,TEXT,TEXT,TEXT)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.decide_su_archive_request(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, anon;
  END IF;
  IF to_regprocedure('public.add_household_member(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.add_household_member(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, anon;
  END IF;
  IF to_regprocedure('public.remove_household_member(TEXT,TEXT,TEXT,TEXT,TEXT)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.remove_household_member(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, anon;
  END IF;
  IF to_regprocedure('public.set_household_relationship(TEXT,TEXT,TEXT,TEXT,TEXT)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.set_household_relationship(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, anon;
  END IF;
  IF to_regprocedure('public.transition_transport_funding(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.transition_transport_funding(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated, anon;
  END IF;
  IF to_regprocedure('public.issue_oyster_card(TEXT,TEXT,TEXT,NUMERIC,DATE,TEXT,TEXT,TEXT)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.issue_oyster_card(TEXT,TEXT,TEXT,NUMERIC,DATE,TEXT,TEXT,TEXT) TO authenticated, anon;
  END IF;
  IF to_regprocedure('public.return_oyster_card(TEXT,NUMERIC,TEXT,TEXT,DATE,TEXT,TEXT,TEXT)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.return_oyster_card(TEXT,NUMERIC,TEXT,TEXT,DATE,TEXT,TEXT,TEXT) TO authenticated, anon;
  END IF;
  IF to_regprocedure('public.set_oyster_balance(TEXT,NUMERIC,TEXT,TEXT,TEXT)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.set_oyster_balance(TEXT,NUMERIC,TEXT,TEXT,TEXT) TO authenticated, anon;
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

