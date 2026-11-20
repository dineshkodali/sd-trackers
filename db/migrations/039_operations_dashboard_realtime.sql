-- =====================================================================
-- 039: Operations Dashboard - Realtime for the master-data tables it reads
--
-- The dashboard's room, resident, PEEP, follow-up, room-issue and check numbers come from tables that were not
-- in the supabase_realtime publication, so an edit by another user only showed after a manual refresh or the 5-minute
-- poll. This adds them (idempotent), with REPLICA IDENTITY FULL so DELETE/UPDATE events carry the old row.
--
-- Adds NO table, column, policy or data. RLS is unchanged: Realtime delivers a change only to a session that is
-- allowed to SELECT the row, and the dashboard re-reads through its normal (RLS-enforced) queries anyway.
-- Safe to run more than once; tables that do not exist in a given environment are skipped.
-- =====================================================================

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'properties', 'property_rooms', 'room_beds', 'placements', 'service_users',
    'peep_plans', 'absence_followups', 'room_issues', 'room_checks', 'welfare_checks'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', tbl);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY tables LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl)
         AND NOT EXISTS (
           SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
         ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
      END IF;
    END LOOP;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
