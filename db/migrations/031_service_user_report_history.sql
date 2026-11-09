-- =====================================================================
-- 031: Service User Report History & Super Admin Archive Management
-- Run in Supabase SQL Editor. Safe to run repeatedly (idempotent).
--
-- Dedicated Table: public.service_user_report_history
-- Tracks automatic report history for HO Report Templates and report modules:
--  - Timestamps (generated, saved, downloaded, archived)
--  - File format (PDF, DOCX, XLSX, CSV)
--  - File storage references and secure retrieval
--  - Service User linkage with cascade & audit trail
--  - Strict Super Admin CRUD and deletion protection at database level
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.service_user_report_history (
  id TEXT PRIMARY KEY,
  report_id TEXT,
  su_id TEXT REFERENCES public.service_users(id) ON DELETE CASCADE,
  su_name TEXT NOT NULL,
  su_reference TEXT,
  site TEXT NOT NULL DEFAULT 'All Sites',
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'HO Report',
  report_category TEXT NOT NULL DEFAULT 'Operations',
  file_format TEXT NOT NULL DEFAULT 'docx',
  file_name TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  file_url TEXT,
  storage_bucket TEXT DEFAULT 'report-files',
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'Generated',
  generated_by_id TEXT,
  generated_by_name TEXT NOT NULL,
  generated_by_role TEXT DEFAULT 'Staff',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  saved_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  last_downloaded_at TIMESTAMPTZ,
  download_count INTEGER DEFAULT 0,
  download_history JSONB DEFAULT '[]'::jsonb,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  archived_by TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for auto updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_su_report_history_updated_at'
  ) THEN
    CREATE TRIGGER update_su_report_history_updated_at
      BEFORE UPDATE ON public.service_user_report_history
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Indexes for query speed & inspection readiness
CREATE INDEX IF NOT EXISTS idx_su_report_history_su_id ON public.service_user_report_history(su_id);
CREATE INDEX IF NOT EXISTS idx_su_report_history_site ON public.service_user_report_history(site);
CREATE INDEX IF NOT EXISTS idx_su_report_history_status ON public.service_user_report_history(status);
CREATE INDEX IF NOT EXISTS idx_su_report_history_archived ON public.service_user_report_history(is_archived);
CREATE INDEX IF NOT EXISTS idx_su_report_history_format ON public.service_user_report_history(file_format);
CREATE INDEX IF NOT EXISTS idx_su_report_history_generated_at ON public.service_user_report_history(generated_at DESC);

-- Also add service user columns to ho_report_records if not present
ALTER TABLE public.ho_report_records ADD COLUMN IF NOT EXISTS su_id TEXT;
ALTER TABLE public.ho_report_records ADD COLUMN IF NOT EXISTS su_name TEXT;
ALTER TABLE public.ho_report_records ADD COLUMN IF NOT EXISTS su_reference TEXT;
CREATE INDEX IF NOT EXISTS idx_ho_report_records_su_id ON public.ho_report_records(su_id);

-- Row Level Security (RLS)
ALTER TABLE public.service_user_report_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_user_report_history' AND policyname = 'su_report_history_select_policy'
  ) THEN
    CREATE POLICY su_report_history_select_policy ON public.service_user_report_history
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_user_report_history' AND policyname = 'su_report_history_insert_policy'
  ) THEN
    CREATE POLICY su_report_history_insert_policy ON public.service_user_report_history
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- Database-level Deletion Protection Trigger: Only Super Admin or service_role can delete!
CREATE OR REPLACE FUNCTION public.check_report_history_superadmin_delete()
RETURNS TRIGGER AS $$
DECLARE
  current_role TEXT;
BEGIN
  current_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    current_setting('app.current_user_role', true),
    ''
  );
  -- Check if user is Super Admin or internal service role
  IF current_role != 'Super Admin' AND current_role != 'service_role' AND current_role != '' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Permanent deletion of Service User Report History records is strictly restricted to Super Admin.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_check_report_history_delete'
  ) THEN
    CREATE TRIGGER trg_check_report_history_delete
      BEFORE DELETE ON public.service_user_report_history
      FOR EACH ROW EXECUTE FUNCTION public.check_report_history_superadmin_delete();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

