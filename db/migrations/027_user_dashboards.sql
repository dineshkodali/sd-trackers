-- =====================================================================
-- Migration 027: Personal dashboards
--
-- One row per dashboard a user has created. A dashboard stores only the widget
-- selection, order, size and options (layout JSON). It holds no business data and
-- grants no access: widgets still read data through the existing RLS policies and
-- the app only renders widgets for pages the user can already view.
--
-- Each user can see and change only their own rows (RLS). Not even an Admin can
-- read another user's dashboards through the API.
--
-- SAFE & IDEMPOTENT: can be re-run in the Supabase SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_dashboards (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  layout     JSONB NOT NULL DEFAULT '{"version":1,"widgets":[]}'::jsonb
             CHECK (jsonb_typeof(layout) = 'object' AND pg_column_size(layout) <= 32768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_dashboards_user ON public.user_dashboards(user_id);
-- At most one default dashboard per user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_dashboards_default ON public.user_dashboards(user_id) WHERE is_default;

ALTER TABLE public.user_dashboards ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_dashboards FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_dashboards TO authenticated, service_role;

DROP POLICY IF EXISTS user_dashboards_select_own ON public.user_dashboards;
CREATE POLICY user_dashboards_select_own ON public.user_dashboards
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_dashboards_insert_own ON public.user_dashboards;
CREATE POLICY user_dashboards_insert_own ON public.user_dashboards
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_dashboards_update_own ON public.user_dashboards;
CREATE POLICY user_dashboards_update_own ON public.user_dashboards
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_dashboards_delete_own ON public.user_dashboards;
CREATE POLICY user_dashboards_delete_own ON public.user_dashboards
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- Cap dashboards per user (matches MAX_DASHBOARDS_PER_USER in the app).
CREATE OR REPLACE FUNCTION public.user_dashboards_limit() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT count(*) FROM public.user_dashboards WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'Dashboard limit reached' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_user_dashboards_limit ON public.user_dashboards;
CREATE TRIGGER trg_user_dashboards_limit BEFORE INSERT ON public.user_dashboards
  FOR EACH ROW EXECUTE FUNCTION public.user_dashboards_limit();

NOTIFY pgrst, 'reload schema';
