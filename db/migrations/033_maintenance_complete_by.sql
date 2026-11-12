-- =====================================================================
-- Migration 033: Maintenance "Complete By" as a real column
--
-- The Complete By time of a defect (reported time + its CAT 1 / 2 / 3 timescale) has
-- only ever been stored as "closeDueDate" inside the JSON text held in
-- maintenance_records.notes, so it could not be indexed, filtered or compared in SQL.
--
-- This adds maintenance_records.complete_by (TIMESTAMPTZ) and fills it once from that
-- JSON. The JSON copy is left exactly as it is: the application writes both.
--
--   * Additive only: one nullable column, one index, one helper function.
--   * No existing column or row value is changed; only complete_by is written.
--   * Stored times are UK wall-clock times, so they are read as Europe/London.
--   * A value that cannot be read as a date is left NULL instead of failing.
--
-- Run in Supabase Dashboard -> SQL Editor. SAFE & IDEMPOTENT: can be re-run.
-- Rollback notes are at the bottom.
-- =====================================================================

-- 'YYYY-MM-DD HH:MM' or 'YYYY-MM-DD' (end of that day) in UK time -> instant. NULL when unreadable.
CREATE OR REPLACE FUNCTION public.sd_uk_local_to_timestamptz(p_value TEXT)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF p_value IS NULL OR p_value !~ '^\d{4}-\d{2}-\d{2}([ T]\d{1,2}:\d{2})?' THEN
    RETURN NULL;
  END IF;
  IF p_value ~ '^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}' THEN
    RETURN (replace(substring(p_value from '^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}'), 'T', ' '))::timestamp AT TIME ZONE 'Europe/London';
  END IF;
  RETURN ((substring(p_value from '^\d{4}-\d{2}-\d{2}'))::date + TIME '23:59') AT TIME ZONE 'Europe/London';
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;   -- e.g. 2026-02-31
END;
$$;

ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS complete_by TIMESTAMPTZ;

-- One-time fill from the JSON held in notes. Rows already filled are not touched again.
UPDATE public.maintenance_records
   SET complete_by = public.sd_uk_local_to_timestamptz(substring(notes from '"closeDueDate":"([^"]+)"'))
 WHERE complete_by IS NULL
   AND notes LIKE '{%'
   AND notes LIKE '%"closeDueDate":"2%';

-- Open defects by Complete By: what an overdue check reads.
CREATE INDEX IF NOT EXISTS idx_maintenance_records_complete_by
  ON public.maintenance_records (complete_by)
  WHERE complete_by IS NOT NULL AND defect_status IS DISTINCT FROM 'Completed';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Check after running (read-only):
--   SELECT count(*) AS total,
--          count(complete_by) AS with_complete_by,
--          count(*) FILTER (WHERE complete_by IS NULL AND notes LIKE '%"closeDueDate":"2%') AS unreadable
--     FROM public.maintenance_records;
--
-- Rollback (the JSON copy in notes is untouched, so nothing is lost):
--   DROP INDEX IF EXISTS public.idx_maintenance_records_complete_by;
--   ALTER TABLE public.maintenance_records DROP COLUMN IF EXISTS complete_by;
--   DROP FUNCTION IF EXISTS public.sd_uk_local_to_timestamptz(TEXT);
-- ---------------------------------------------------------------------
