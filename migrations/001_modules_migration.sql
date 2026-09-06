-- =====================================================================
-- SafeHaven Operations - Module Migration & Centralized Audit Tracking
-- Script 001: laundry_logs, hot_food_logs, audit_trails, property_user_assignments
-- =====================================================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create or Replace Updated At Timestamp Trigger Function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- MODULE 1: laundry_logs
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.laundry_logs (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES public.sites(id) ON DELETE SET NULL,
  site TEXT NOT NULL,
  room_no TEXT,
  resident_name TEXT,
  ref TEXT,
  date TEXT,
  tokens_issued INTEGER DEFAULT 0,
  bag_count INTEGER DEFAULT 0,
  dirty_laundry_sent INTEGER DEFAULT 0,
  clean_laundry_returned INTEGER DEFAULT 0,
  discrepancies TEXT,
  discrepancy_count INTEGER DEFAULT 0,
  remarks_actions_taken TEXT,
  status TEXT DEFAULT 'Queued',
  staff_initials TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all required audit tracking columns exist if table pre-existed
ALTER TABLE public.laundry_logs ADD COLUMN IF NOT EXISTS site_id TEXT REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.laundry_logs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.laundry_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.laundry_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Auto-update updated_at Trigger
DROP TRIGGER IF EXISTS trg_laundry_logs_updated_at ON public.laundry_logs;
CREATE TRIGGER trg_laundry_logs_updated_at
BEFORE UPDATE ON public.laundry_logs
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Backwards compatibility alias
CREATE TABLE IF NOT EXISTS public.laundry_records (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  room_no TEXT,
  resident_name TEXT,
  ref TEXT,
  date TEXT,
  tokens_issued INTEGER DEFAULT 0,
  bag_count INTEGER DEFAULT 0,
  dirty_laundry_sent INTEGER DEFAULT 0,
  clean_laundry_returned INTEGER DEFAULT 0,
  discrepancies TEXT,
  discrepancy_count INTEGER DEFAULT 0,
  remarks_actions_taken TEXT,
  status TEXT DEFAULT 'Queued',
  staff_initials TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- MODULE 2: hot_food_logs
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hot_food_logs (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES public.sites(id) ON DELETE SET NULL,
  site TEXT NOT NULL,
  date TEXT,
  meal_type TEXT,
  vendor_name TEXT,
  supplier_name TEXT,
  meals_delivered INTEGER DEFAULT 0,
  temperature_c NUMERIC,
  quality_check TEXT DEFAULT 'Pass',
  staff_name TEXT,
  staff_signoff TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure required columns exist
ALTER TABLE public.hot_food_logs ADD COLUMN IF NOT EXISTS site_id TEXT REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.hot_food_logs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.hot_food_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.hot_food_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Auto-update updated_at Trigger
DROP TRIGGER IF EXISTS trg_hot_food_logs_updated_at ON public.hot_food_logs;
CREATE TRIGGER trg_hot_food_logs_updated_at
BEFORE UPDATE ON public.hot_food_logs
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Backwards compatibility alias
CREATE TABLE IF NOT EXISTS public.food_records (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  date TEXT,
  meal_type TEXT,
  vendor_name TEXT,
  supplier_name TEXT,
  meals_delivered INTEGER DEFAULT 0,
  temperature_c NUMERIC,
  quality_check TEXT DEFAULT 'Pass',
  staff_name TEXT,
  staff_signoff TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- MODULE 3: audit_trails
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.audit_trails (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  "user" TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT,
  action TEXT,
  details TEXT,
  site TEXT,
  entity_type TEXT,
  entity_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure required columns exist
ALTER TABLE public.audit_trails ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_trails ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_trails ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.audit_trails ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Auto-update updated_at Trigger
DROP TRIGGER IF EXISTS trg_audit_trails_updated_at ON public.audit_trails;
CREATE TRIGGER trg_audit_trails_updated_at
BEFORE UPDATE ON public.audit_trails
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Backwards compatibility alias
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  "user" TEXT,
  role TEXT,
  action TEXT,
  details TEXT,
  site TEXT,
  entity_type TEXT,
  entity_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- MODULE 4: property_user_assignments
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.property_user_assignments (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  user_name TEXT,
  group_id TEXT,
  group_name TEXT,
  property_id TEXT REFERENCES public.sites(id) ON DELETE CASCADE,
  property_name TEXT,
  role TEXT DEFAULT 'Staff',
  assigned_properties TEXT[],
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure required columns exist
ALTER TABLE public.property_user_assignments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.property_user_assignments ADD COLUMN IF NOT EXISTS property_id TEXT REFERENCES public.sites(id) ON DELETE CASCADE;
ALTER TABLE public.property_user_assignments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.property_user_assignments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.property_user_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Auto-update updated_at Trigger
DROP TRIGGER IF EXISTS trg_prop_user_assignments_updated_at ON public.property_user_assignments;
CREATE TRIGGER trg_prop_user_assignments_updated_at
BEFORE UPDATE ON public.property_user_assignments
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- =====================================================================
-- INDEXES & PERFORMANCE OPTIMIZATIONS
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_laundry_logs_site ON public.laundry_logs(site);
CREATE INDEX IF NOT EXISTS idx_hot_food_logs_site ON public.hot_food_logs(site);
CREATE INDEX IF NOT EXISTS idx_audit_trails_timestamp ON public.audit_trails(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_prop_user_assign_user ON public.property_user_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_prop_user_assign_prop ON public.property_user_assignments(property_id);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================
ALTER TABLE public.laundry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hot_food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_user_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- Authenticated Access Policies
DROP POLICY IF EXISTS "Allow authenticated laundry_logs" ON public.laundry_logs;
CREATE POLICY "Allow authenticated laundry_logs" ON public.laundry_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated hot_food_logs" ON public.hot_food_logs;
CREATE POLICY "Allow authenticated hot_food_logs" ON public.hot_food_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated audit_trails" ON public.audit_trails;
CREATE POLICY "Allow authenticated audit_trails" ON public.audit_trails FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated prop_user_assignments" ON public.property_user_assignments;
CREATE POLICY "Allow authenticated prop_user_assignments" ON public.property_user_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anonymous Staging / API Access Policies
DROP POLICY IF EXISTS "Allow anon laundry_logs" ON public.laundry_logs;
CREATE POLICY "Allow anon laundry_logs" ON public.laundry_logs FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon hot_food_logs" ON public.hot_food_logs;
CREATE POLICY "Allow anon hot_food_logs" ON public.hot_food_logs FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon audit_trails" ON public.audit_trails;
CREATE POLICY "Allow anon audit_trails" ON public.audit_trails FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon prop_user_assignments" ON public.property_user_assignments;
CREATE POLICY "Allow anon prop_user_assignments" ON public.property_user_assignments FOR ALL TO anon USING (true) WITH CHECK (true);
