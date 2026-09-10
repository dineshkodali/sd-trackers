-- =====================================================================
-- SafeHaven Operations - Supabase Database Schema (Clean Rebuild)
-- Drops ALL existing tables and recreates canonical-only schema.
-- No duplicate/legacy tables. Supabase Auth-integrated profiles.
-- =====================================================================

-- =====================================================================
-- PHASE 1: DROP ALL EXISTING TABLES (ordered by foreign key deps)
-- =====================================================================
DROP TABLE IF EXISTS public.email_notification_logs CASCADE;
DROP TABLE IF EXISTS public.email_notification_rules CASCADE;
DROP TABLE IF EXISTS public.password_audit_logs CASCADE;
DROP TABLE IF EXISTS public.data_change_requests CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.escalations CASCADE;
DROP TABLE IF EXISTS public.spcd_records CASCADE;
DROP TABLE IF EXISTS public.maintenance_records CASCADE;
DROP TABLE IF EXISTS public.challenging_behavior CASCADE;
DROP TABLE IF EXISTS public.vulnerable_residents CASCADE;
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.audit_trails CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.hot_food_logs CASCADE;
DROP TABLE IF EXISTS public.food_records CASCADE;
DROP TABLE IF EXISTS public.laundry_logs CASCADE;
DROP TABLE IF EXISTS public.laundry_records CASCADE;
DROP TABLE IF EXISTS public.property_user_assignments CASCADE;
DROP TABLE IF EXISTS public.user_groups CASCADE;
DROP TABLE IF EXISTS public.sites CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Also drop any old legacy tables
DROP TABLE IF EXISTS public.legacy_activity_log CASCADE;
DROP TABLE IF EXISTS public.legacy_export_cache CASCADE;
DROP TABLE IF EXISTS public.legacy_role_matrix CASCADE;
DROP TABLE IF EXISTS public.legacy_audit_snapshot CASCADE;

-- =====================================================================
-- PHASE 2: EXTENSIONS & UTILITY FUNCTIONS
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Auto-update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- PHASE 3: CREATE ALL CANONICAL TABLES
-- =====================================================================

-- 1. User Profiles (synchronized with Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT DEFAULT 'Staff',
  assigned_site TEXT DEFAULT 'All Sites',
  status TEXT DEFAULT 'Active',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Properties & Sites
CREATE TABLE public.sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pid TEXT,
  address TEXT,
  city TEXT,
  total_rooms INTEGER DEFAULT 0,
  active_residents INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Operational',
  manager_name TEXT,
  manager_email TEXT,
  manager_phone TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User Groups
CREATE TABLE public.user_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  assigned_property TEXT,
  assigned_properties TEXT[],
  user_ids TEXT[],
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Property User Assignments (User <-> Property mapping)
CREATE TABLE public.property_user_assignments (
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

-- 5. Laundry Logs (canonical — replaces old laundry_records)
CREATE TABLE public.laundry_logs (
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

-- 6. Hot Food Logs (canonical — replaces old food_records)
CREATE TABLE public.hot_food_logs (
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

-- 7. Audit Trails (canonical — replaces old audit_logs)
CREATE TABLE public.audit_trails (
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

-- 8. Safeguarding Referrals
CREATE TABLE public.referrals (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  su_name TEXT NOT NULL,
  su_port_reference TEXT,
  port_ref TEXT,
  room_number TEXT,
  date_referred TEXT,
  referral_type TEXT,
  reason TEXT,
  status TEXT DEFAULT 'Pending Review',
  priority TEXT DEFAULT 'Medium',
  actions_taken TEXT,
  assigned_to TEXT,
  notes TEXT,
  follow_up_date TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Vulnerable Service Users
CREATE TABLE public.vulnerable_residents (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  su_name TEXT NOT NULL,
  su_port_reference TEXT,
  room_or_flat_no TEXT,
  vulnerability_category TEXT,
  risk_level TEXT DEFAULT 'Medium',
  description TEXT,
  care_plan TEXT,
  emergency_contact TEXT,
  medical_notes TEXT,
  status TEXT DEFAULT 'Active',
  last_review_date TEXT,
  next_review_date TEXT,
  flagged_by TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Challenging Behavior Incidents
CREATE TABLE public.challenging_behavior (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  name TEXT NOT NULL,
  port_ref TEXT,
  room_or_flat_no TEXT,
  date_of_incident TEXT,
  type_of_issue TEXT,
  risk_to_others TEXT,
  description TEXT,
  police_involved BOOLEAN DEFAULT FALSE,
  police_cad_number TEXT,
  warning_issued BOOLEAN DEFAULT FALSE,
  warning_level TEXT,
  actions_taken TEXT,
  status TEXT DEFAULT 'Open',
  logged_by TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Maintenance & Defects
CREATE TABLE public.maintenance_records (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  room_or_area TEXT,
  defect_status TEXT DEFAULT 'Reported',
  description TEXT,
  contractor TEXT,
  contractor_quote NUMERIC DEFAULT 0,
  priority TEXT DEFAULT 'Routine',
  reported_date TEXT,
  completion_date TEXT,
  sign_off_status TEXT DEFAULT 'Pending',
  notes TEXT,
  category TEXT,
  reported_by TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. SPCD Compliance Declarations
CREATE TABLE public.spcd_records (
  id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  su_name TEXT NOT NULL,
  su_port_reference TEXT,
  check_type TEXT,
  status TEXT DEFAULT 'Valid',
  declaration_date TEXT,
  officer_name TEXT,
  verified BOOLEAN DEFAULT TRUE,
  comments TEXT,
  expires_date TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Escalations
CREATE TABLE public.escalations (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  severity TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'Open',
  description TEXT,
  reported_by TEXT,
  assigned_to TEXT,
  resolution_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Documents
CREATE TABLE public.documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  site TEXT,
  file_url TEXT,
  file_size TEXT,
  uploaded_by TEXT,
  uploaded_date TEXT,
  version TEXT DEFAULT '1.0',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Data Change Requests
CREATE TABLE public.data_change_requests (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  action_type TEXT,
  requested_by TEXT,
  site TEXT,
  status TEXT DEFAULT 'Pending',
  payload JSONB,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Password Audit Logs
CREATE TABLE public.password_audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  admin_email TEXT,
  target_email TEXT,
  target_user_id TEXT,
  action TEXT,
  status TEXT,
  error TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Email Notification Rules
CREATE TABLE IF NOT EXISTS public.email_notification_rules (
  id TEXT PRIMARY KEY,
  event_code TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  min_severity TEXT DEFAULT 'All',
  recipient_roles JSONB DEFAULT '[]'::jsonb,
  custom_recipients JSONB DEFAULT '[]'::jsonb,
  custom_cc JSONB DEFAULT '[]'::jsonb,
  subject_template TEXT,
  include_metadata BOOLEAN DEFAULT true,
  last_dispatched_at TIMESTAMPTZ,
  dispatch_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Email Notification Delivery Logs
CREATE TABLE IF NOT EXISTS public.email_notification_logs (
  id TEXT PRIMARY KEY,
  rule_id TEXT,
  event_code TEXT NOT NULL,
  module TEXT NOT NULL,
  subject TEXT NOT NULL,
  recipients JSONB DEFAULT '[]'::jsonb,
  site TEXT,
  status TEXT DEFAULT 'delivered',
  error_message TEXT,
  entity_id TEXT,
  payload_summary TEXT,
  dispatched_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- PHASE 4: AUTO-CREATE PROFILE TRIGGER ON AUTH.USERS INSERT
-- =====================================================================

-- This function creates a profiles row automatically when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, assigned_site, status, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Staff'),
    COALESCE(NEW.raw_user_meta_data->>'assigned_site', 'All Sites'),
    'Active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- PHASE 5: UPDATED_AT TRIGGERS
-- =====================================================================

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_sites_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_user_groups_updated_at BEFORE UPDATE ON public.user_groups FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_prop_user_assignments_updated_at BEFORE UPDATE ON public.property_user_assignments FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_laundry_logs_updated_at BEFORE UPDATE ON public.laundry_logs FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_hot_food_logs_updated_at BEFORE UPDATE ON public.hot_food_logs FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_audit_trails_updated_at BEFORE UPDATE ON public.audit_trails FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_referrals_updated_at BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_vulnerable_updated_at BEFORE UPDATE ON public.vulnerable_residents FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_challenging_updated_at BEFORE UPDATE ON public.challenging_behavior FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_maintenance_updated_at BEFORE UPDATE ON public.maintenance_records FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_spcd_updated_at BEFORE UPDATE ON public.spcd_records FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_escalations_updated_at BEFORE UPDATE ON public.escalations FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_data_change_requests_updated_at BEFORE UPDATE ON public.data_change_requests FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_password_audit_logs_updated_at BEFORE UPDATE ON public.password_audit_logs FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER trg_email_notification_rules_updated_at BEFORE UPDATE ON public.email_notification_rules FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- =====================================================================
-- PHASE 6: PERFORMANCE INDEXES
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_sites_name ON public.sites(name);
CREATE INDEX IF NOT EXISTS idx_laundry_logs_site ON public.laundry_logs(site);
CREATE INDEX IF NOT EXISTS idx_hot_food_logs_site ON public.hot_food_logs(site);
CREATE INDEX IF NOT EXISTS idx_audit_trails_timestamp ON public.audit_trails(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trails_user_id ON public.audit_trails(user_id);
CREATE INDEX IF NOT EXISTS idx_prop_user_assign_user ON public.property_user_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_site ON public.referrals(site);
CREATE INDEX IF NOT EXISTS idx_vulnerable_site ON public.vulnerable_residents(site);
CREATE INDEX IF NOT EXISTS idx_challenging_site ON public.challenging_behavior(site);
CREATE INDEX IF NOT EXISTS idx_maintenance_site ON public.maintenance_records(site);
CREATE INDEX IF NOT EXISTS idx_spcd_site ON public.spcd_records(site_name);
CREATE INDEX IF NOT EXISTS idx_escalations_site ON public.escalations(site);
CREATE INDEX IF NOT EXISTS idx_notif_rules_module ON public.email_notification_rules(module);
CREATE INDEX IF NOT EXISTS idx_notif_logs_event ON public.email_notification_logs(event_code);
CREATE INDEX IF NOT EXISTS idx_notif_logs_dispatched ON public.email_notification_logs(dispatched_at DESC);

-- =====================================================================
-- PHASE 7: ROW LEVEL SECURITY (Authenticated-only, no anon access)
-- =====================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_user_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hot_food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vulnerable_residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenging_behavior ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spcd_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notification_logs ENABLE ROW LEVEL SECURITY;

-- Schema grants (authenticated and service_role only — NO anon grants)
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- RLS Policies: Authenticated users get full CRUD on all tables
-- (Fine-grained role-based policies can be added later)
CREATE POLICY "authenticated_profiles_all" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_sites_all" ON public.sites FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_user_groups_all" ON public.user_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_prop_assign_all" ON public.property_user_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_laundry_all" ON public.laundry_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_food_all" ON public.hot_food_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_audit_all" ON public.audit_trails FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_referrals_all" ON public.referrals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_vulnerable_all" ON public.vulnerable_residents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_challenging_all" ON public.challenging_behavior FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_maintenance_all" ON public.maintenance_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_spcd_all" ON public.spcd_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_escalations_all" ON public.escalations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_documents_all" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_dcr_all" ON public.data_change_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_pwd_audit_all" ON public.password_audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_notif_rules_all" ON public.email_notification_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_notif_logs_all" ON public.email_notification_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role bypass policies (service_role bypasses RLS by default, but explicit for clarity)
CREATE POLICY "service_profiles_all" ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_sites_all" ON public.sites FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_user_groups_all" ON public.user_groups FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_prop_assign_all" ON public.property_user_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_laundry_all" ON public.laundry_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_food_all" ON public.hot_food_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_audit_all" ON public.audit_trails FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_referrals_all" ON public.referrals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_vulnerable_all" ON public.vulnerable_residents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_challenging_all" ON public.challenging_behavior FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_maintenance_all" ON public.maintenance_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_spcd_all" ON public.spcd_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_escalations_all" ON public.escalations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_documents_all" ON public.documents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_dcr_all" ON public.data_change_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_pwd_audit_all" ON public.password_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_notif_rules_all" ON public.email_notification_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_notif_logs_all" ON public.email_notification_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

