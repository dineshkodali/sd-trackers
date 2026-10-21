-- =====================================================================
-- 019: let the browser read/write the room-management tables
--
-- Migration 016 revoked all browser access to these tables ("only the server reads/writes them").
-- The production site is static hosting with no /api backend, so the app talks to Supabase directly and
-- every read fails with "permission denied for table room_beds". This applies the same access the other
-- app tables already have (see db/enable-direct-supabase-rls.sql). Safe to run more than once.
--
-- Run in the Supabase SQL Editor.
-- =====================================================================
DO $$
DECLARE
  t TEXT;
  room_tables TEXT[] := ARRAY[
    'room_beds', 'inventory_items', 'property_inventory_stock', 'room_inventory',
    'inventory_movements', 'room_kit_templates', 'room_issues', 'room_activity_log'
  ];
BEGIN
  FOREACH t IN ARRAY room_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('GRANT ALL ON public.%I TO authenticated, anon, service_role', t);

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'direct_auth_all_' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'direct_anon_all_' || t, t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', 'direct_auth_all_' || t, t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)', 'direct_anon_all_' || t, t);
    ELSE
      RAISE NOTICE 'Table public.% does not exist - run 016_room_management.sql first', t;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
