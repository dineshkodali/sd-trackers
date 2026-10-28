-- =====================================================================
-- Migration 025: Enable Direct Supabase RLS Policies for AWS Amplify / Static Hosting
--
-- Tables from migrations 020, 021, 022, 023, and 024:
-- su_hc2_details, oyster_cards, oyster_card_events, oyster_card_transactions,
-- su_meal_records, su_meal_record_history, su_education_details,
-- family_groups, family_members, su_archive_requests, transport_funding_requests,
-- transport_funding_status_history, gp_registrations, peep_plans, peep_plan_history,
-- su_attendance_records, absence_followups, mh_complaint_welfare_checks,
-- daily_laundry_logs, housekeeping_logs, housekeeping_room_logs,
-- food_consumption_reports, food_box_requests
--
-- Grants SELECT, INSERT, UPDATE, DELETE permissions and configures RLS
-- policies for anon and authenticated roles so that the static frontend on
-- AWS Amplify (or any deployment without an Express backend proxy) can query
-- and mutate records directly via Supabase PostgREST.
--
-- SAFE & IDEMPOTENT: Can be safely re-run multiple times in Supabase SQL Editor.
-- =====================================================================

DO $$
DECLARE
  tables_to_permit TEXT[] := ARRAY[
    'su_hc2_details',
    'oyster_cards',
    'oyster_card_events',
    'oyster_card_transactions',
    'su_meal_records',
    'su_meal_record_history',
    'su_education_details',
    'family_groups',
    'family_members',
    'su_archive_requests',
    'transport_funding_requests',
    'transport_funding_status_history',
    'gp_registrations',
    'peep_plans',
    'peep_plan_history',
    'su_attendance_records',
    'absence_followups',
    'mh_complaint_welfare_checks',
    'daily_laundry_logs',
    'housekeeping_logs',
    'housekeeping_room_logs',
    'food_consumption_reports',
    'food_box_requests'
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

-- ---------------------------------------------------------------------
-- Grant EXECUTE on workflow functions to authenticated & anon roles
-- ---------------------------------------------------------------------
DO $$
BEGIN
  -- Archive request & decision RPCs
  IF to_regprocedure('public.request_su_archive(TEXT,TEXT,TEXT,TEXT,TEXT)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.request_su_archive(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, anon;
  END IF;
  IF to_regprocedure('public.decide_su_archive_request(TEXT,TEXT,TEXT,TEXT,TEXT)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.decide_su_archive_request(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, anon;
  END IF;

  -- Household RPCs
  IF to_regprocedure('public.add_household_member(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.add_household_member(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, anon;
  END IF;
  IF to_regprocedure('public.remove_household_member(TEXT,TEXT,TEXT,TEXT,TEXT)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.remove_household_member(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, anon;
  END IF;
  IF to_regprocedure('public.set_household_relationship(TEXT,TEXT,TEXT,TEXT,TEXT)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.set_household_relationship(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, anon;
  END IF;

  -- Transport funding workflow transition RPC
  IF to_regprocedure('public.transition_transport_funding(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.transition_transport_funding(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated, anon;
  END IF;

  -- Oyster card inventory & issue/return RPCs
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

-- ---------------------------------------------------------------------
-- Notify PostgREST to reload the schema cache immediately
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
