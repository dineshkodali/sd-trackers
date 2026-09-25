-- =====================================================================
-- 009: HO Report Generator Module (Dedicated Separate Tables)
--
-- Dedicated Tables:
-- 1. public.ho_report_templates  - Master report templates & field schemas
-- 2. public.ho_report_records    - Generated reports (drafts & finalized) prepared in DOCX/PDF
-- 3. public.ho_report_audit_logs - Security & compliance audit trail
--
-- Run this in Supabase Dashboard -> SQL Editor
-- =====================================================================

-- Auto-update trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 1. HO REPORT TEMPLATES TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ho_report_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'Operations',
  is_active BOOLEAN DEFAULT true,
  current_version INTEGER DEFAULT 1,
  field_definitions JSONB DEFAULT '[]'::jsonb,
  layout_config JSONB DEFAULT '{}'::jsonb,
  header_config JSONB DEFAULT '{}'::jsonb,
  footer_config JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_ho_report_templates_updated_at'
  ) THEN
    CREATE TRIGGER update_ho_report_templates_updated_at
      BEFORE UPDATE ON public.ho_report_templates
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ho_report_templates_active ON public.ho_report_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_ho_report_templates_category ON public.ho_report_templates(category);
CREATE INDEX IF NOT EXISTS idx_ho_report_templates_updated_at ON public.ho_report_templates(updated_at DESC);

-- =====================================================================
-- 2. HO REPORT RECORDS TABLE (Generated reports prepared in DOCX / PDF)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ho_report_records (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES public.ho_report_templates(id) ON DELETE SET NULL,
  site TEXT NOT NULL DEFAULT 'All Sites',
  title TEXT NOT NULL,
  document_number TEXT,
  category TEXT DEFAULT 'General',
  status TEXT DEFAULT 'draft',                 -- 'draft' | 'final'
  prepared_format TEXT,                        -- 'docx' | 'pdf' | 'both'
  docx_url TEXT,
  pdf_url TEXT,
  field_values JSONB DEFAULT '{}'::jsonb,
  field_definitions JSONB DEFAULT '[]'::jsonb,
  layout_config JSONB DEFAULT '{}'::jsonb,
  header_config JSONB DEFAULT '{}'::jsonb,
  footer_config JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_by_name TEXT,
  created_by_role TEXT,
  created_by_email TEXT,
  updated_by TEXT,
  updated_by_name TEXT,
  updated_by_role TEXT,
  finalized_at TIMESTAMPTZ,
  finalized_by TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_ho_report_records_updated_at'
  ) THEN
    CREATE TRIGGER update_ho_report_records_updated_at
      BEFORE UPDATE ON public.ho_report_records
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ho_report_records_site ON public.ho_report_records(site);
CREATE INDEX IF NOT EXISTS idx_ho_report_records_status ON public.ho_report_records(status);
CREATE INDEX IF NOT EXISTS idx_ho_report_records_template ON public.ho_report_records(template_id);
CREATE INDEX IF NOT EXISTS idx_ho_report_records_prepared ON public.ho_report_records(prepared_format);
CREATE INDEX IF NOT EXISTS idx_ho_report_records_updated_at ON public.ho_report_records(updated_at DESC);

-- =====================================================================
-- 3. HO REPORT AUDIT LOGS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ho_report_audit_logs (
  id TEXT PRIMARY KEY,
  record_id TEXT,
  template_id TEXT,
  action TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT,
  user_role TEXT,
  user_email TEXT,
  site TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ho_report_audit_record ON public.ho_report_audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_ho_report_audit_action ON public.ho_report_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_ho_report_audit_created ON public.ho_report_audit_logs(created_at DESC);

-- =====================================================================
-- 4. MIGRATE EXISTING TEMPLATES FROM doc_builder (IF PRESENT)
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doc_builder') THEN
    INSERT INTO public.ho_report_templates (
      id, name, description, category, is_active, current_version,
      field_definitions, layout_config, header_config, footer_config,
      created_by, data, created_at, updated_at
    )
    SELECT
      id,
      title AS name,
      COALESCE(data->>'description', '') AS description,
      COALESCE(category, 'General') AS category,
      (status = 'active') AS is_active,
      COALESCE((data->'currentVersion'->>'version')::int, 1) AS current_version,
      COALESCE(data->'currentVersion'->'fieldDefinitions', '[]'::jsonb) AS field_definitions,
      COALESCE(data->'currentVersion'->'layoutConfig', '{}'::jsonb) AS layout_config,
      COALESCE(data->'currentVersion'->'headerConfig', '{}'::jsonb) AS header_config,
      COALESCE(data->'currentVersion'->'footerConfig', '{}'::jsonb) AS footer_config,
      created_by,
      data,
      created_at,
      updated_at
    FROM public.doc_builder
    WHERE record_type = 'template'
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      is_active = EXCLUDED.is_active,
      field_definitions = EXCLUDED.field_definitions,
      layout_config = EXCLUDED.layout_config,
      header_config = EXCLUDED.header_config,
      footer_config = EXCLUDED.footer_config,
      data = EXCLUDED.data,
      updated_at = EXCLUDED.updated_at;

    -- Migrate non-mock generated documents from doc_builder (filtering out doc-incident-rasul-741)
    INSERT INTO public.ho_report_records (
      id, template_id, site, title, document_number, category, status,
      prepared_format, docx_url, pdf_url, field_values, field_definitions,
      layout_config, header_config, footer_config, created_by, created_by_name,
      created_by_role, created_by_email, updated_by, updated_by_name,
      updated_by_role, finalized_at, finalized_by, data, created_at, updated_at
    )
    SELECT
      id,
      template_id,
      site,
      title,
      document_number,
      category,
      status,
      NULL AS prepared_format,
      NULL AS docx_url,
      NULL AS pdf_url,
      field_values,
      COALESCE(data->'fieldDefinitions', '[]'::jsonb) AS field_definitions,
      COALESCE(data->'layoutConfig', '{}'::jsonb) AS layout_config,
      COALESCE(data->'headerConfig', '{}'::jsonb) AS header_config,
      COALESCE(data->'footerConfig', '{}'::jsonb) AS footer_config,
      created_by,
      created_by_name,
      created_by_role,
      created_by_email,
      updated_by,
      updated_by_name,
      updated_by_role,
      finalized_at,
      finalized_by,
      data,
      created_at,
      updated_at
    FROM public.doc_builder
    WHERE record_type = 'document' AND id != 'doc-incident-rasul-741'
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      status = EXCLUDED.status,
      field_values = EXCLUDED.field_values,
      data = EXCLUDED.data,
      updated_at = EXCLUDED.updated_at;

    -- Migrate audit logs from doc_builder
    INSERT INTO public.ho_report_audit_logs (
      id, record_id, template_id, action, user_id, user_name, user_role, user_email, site, details, created_at
    )
    SELECT
      id,
      data->>'documentId' AS record_id,
      template_id,
      COALESCE(title, 'AUDIT_EVENT') AS action,
      created_by AS user_id,
      created_by_name AS user_name,
      created_by_role AS user_role,
      created_by_email AS user_email,
      site,
      COALESCE(data->>'details', '') AS details,
      created_at
    FROM public.doc_builder
    WHERE record_type = 'audit' AND id NOT LIKE '%rasul%'
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
