-- =====================================================================
-- Migration 005: Create IR Tracker (Incident Reports) Table
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ir_records (
  id TEXT PRIMARY KEY,
  site TEXT,
  date TEXT,
  su_name TEXT,
  port_ref TEXT,
  ir_summary TEXT,
  incident_time TEXT,
  in_for_1st_review TEXT,
  ct_1st_review TEXT,
  in_for_2nd_review TEXT,
  ct_2nd_review TEXT,
  submitted_to_crh TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  attachment_url TEXT,
  file_url TEXT,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_ir_site ON public.ir_records(site);
CREATE INDEX IF NOT EXISTS idx_ir_date ON public.ir_records(date);
CREATE INDEX IF NOT EXISTS idx_ir_su_name ON public.ir_records(su_name);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_ir_records_updated_at ON public.ir_records;
CREATE TRIGGER trg_ir_records_updated_at
  BEFORE UPDATE ON public.ir_records
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Row Level Security
ALTER TABLE public.ir_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ir_records FROM anon;
GRANT ALL ON public.ir_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ir_records TO authenticated;

DROP POLICY IF EXISTS service_role_all_ir_records ON public.ir_records;
CREATE POLICY service_role_all_ir_records ON public.ir_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Inform PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
