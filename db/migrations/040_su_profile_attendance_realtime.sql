-- =====================================================================
-- 040: Service User profile - live attendance calendar and GP details
--
-- Findings (see docs/SDTRACKER_NEW_ARRIVALS_PROFILE_ATTENDANCE.md):
--  * Attendance already exists: public.su_attendance_records (migration 020), one row per Service User per day
--    (UNIQUE (su_id, attendance_date)), status Present/Absent, su_id -> public.service_users(id). Reused as is.
--  * GP / pharmacy / NHS number already exist: public.gp_registrations (migration 020, one per Service User) and
--    public.service_users.gp_registration (migration 030). Reused as is.
--  * Dietary requirements and safeguarding comments already exist as Service User support rows (public.service_user_support).
--  * Row Level Security and the per-page restrictive policies for these tables already exist (migrations 025, 026).
--
-- So NO table, column, constraint, index or policy is added. The only gap: these two tables were not published to
-- Supabase Realtime, so the profile could not follow another user's change. This adds them (idempotent), with
-- REPLICA IDENTITY FULL so DELETE/UPDATE events carry the old row (needed to know whose attendance was removed).
--
-- Realtime delivers a change only to a session that may SELECT the row (RLS applies); the profile also re-reads through its
-- normal RLS-enforced query. Safe to run more than once; absent tables are skipped.
--
-- Rollback (stops live updates only; data and behaviour are otherwise unchanged):
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.su_attendance_records;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.gp_registrations;
--   ALTER TABLE public.su_attendance_records REPLICA IDENTITY DEFAULT;
--   ALTER TABLE public.gp_registrations REPLICA IDENTITY DEFAULT;
-- =====================================================================

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['su_attendance_records', 'gp_registrations'];
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
