-- =====================================================================
-- SD Operations - Supabase Database Schema
--
-- NON-DESTRUCTIVE and IDEMPOTENT. This script is executed on every server
-- boot (server/migrate.ts) and by POST /api/db/migrate, so it must be safe to
-- run any number of times against a database that already holds live data:
--
--   * tables are only ever CREATE ... IF NOT EXISTS - never dropped;
--   * new columns are added with ADD COLUMN IF NOT EXISTS and are nullable;
--   * triggers, policies and functions are replaced in place.
--
-- The previous version of this file began with DROP TABLE ... CASCADE for
-- every table, which would have erased all operational data on each restart
-- wherever the Postgres port was reachable.
--
-- The whole script runs inside one transaction (see server/migrate.ts), so a
-- failure part-way leaves the database exactly as it was.
-- =====================================================================

-- Auto-update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- PART 1: CORE TABLES (existing - definitions unchanged)
-- =====================================================================

-- 1. User Profiles (synchronized with Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
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
CREATE TABLE IF NOT EXISTS public.sites (
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
CREATE TABLE IF NOT EXISTS public.user_groups (
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

-- 5. Laundry Logs (resident intake + weekly/monthly property logs)
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

-- 6. Hot Food Logs (meal deliveries + weekly vendor buffet matrices)
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

-- 7. Audit Trails
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

-- 8. Safeguarding Referrals
CREATE TABLE IF NOT EXISTS public.referrals (
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
CREATE TABLE IF NOT EXISTS public.vulnerable_residents (
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

-- 10. Challenging Behaviour Incidents
CREATE TABLE IF NOT EXISTS public.challenging_behavior (
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
CREATE TABLE IF NOT EXISTS public.maintenance_records (
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

-- 12. SPCD Case Tracker
CREATE TABLE IF NOT EXISTS public.spcd_records (
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
CREATE TABLE IF NOT EXISTS public.escalations (
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
CREATE TABLE IF NOT EXISTS public.documents (
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
CREATE TABLE IF NOT EXISTS public.data_change_requests (
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
CREATE TABLE IF NOT EXISTS public.password_audit_logs (
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
-- PART 2: TABLES FOR MODULES THAT PREVIOUSLY LIVED ONLY IN BROWSER STORAGE
--
-- Every row carries typed columns for reporting and SQL queries, plus a
-- `data` JSONB copy of the full application record so that no field -
-- including administrator-defined custom columns - is lost on a round trip.
-- =====================================================================

-- 19. Public Transport Approvals
CREATE TABLE IF NOT EXISTS public.public_transport_records (
  id TEXT PRIMARY KEY,
  approval_urn TEXT,
  su_names TEXT,
  port_refs TEXT,
  accommodation_address TEXT,
  site_name TEXT,
  appointment_date TEXT,
  appointment_time TEXT,
  appointment_location TEXT,
  distance_miles NUMERIC,
  mode_of_transport TEXT,
  exceptional_circumstances TEXT,
  status TEXT,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. SD-Compliance Certificates & Contracts
CREATE TABLE IF NOT EXISTS public.compliance_records (
  id TEXT PRIMARY KEY,
  sr_no INTEGER,
  compliance_type TEXT,
  contractor_name TEXT,
  contractor_key_contact TEXT,
  contractor_email TEXT,
  issued_date TEXT,
  expiry_date TEXT,
  status TEXT,
  action_taken TEXT,
  previous_contractor TEXT,
  site_name TEXT,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. GP Appointments
CREATE TABLE IF NOT EXISTS public.gp_appointments (
  id TEXT PRIMARY KEY,
  room_no TEXT,
  port_reference TEXT,
  referral_sent_on TEXT,
  appointment_date TEXT,
  time_of_gp TEXT,
  comments TEXT,
  status TEXT,
  site_name TEXT,
  su_name TEXT,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. RFA Welfare Checks
CREATE TABLE IF NOT EXISTS public.rfa_welfare_checks (
  id TEXT PRIMARY KEY,
  date TEXT,
  site_name TEXT,
  room_or_flat_no TEXT,
  name TEXT,
  dob TEXT,
  group_name TEXT,
  gender TEXT,
  port_or_nass_ref TEXT,
  vulnerability TEXT,
  action_taken TEXT,
  mh_ticket TEXT,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. Dispersal Sheet
CREATE TABLE IF NOT EXISTS public.dispersal_records (
  id TEXT PRIMARY KEY,
  sno INTEGER,
  site_name TEXT,
  date_received TEXT,
  su_port_nass_ref TEXT,
  reason_for_departure TEXT,
  flat_room_number TEXT,
  dispersal_date TEXT,
  date_letter_handed_to_su TEXT,
  ia_exit_briefing_completed TEXT,
  ho_dispersal_letter_received TEXT,
  travelled TEXT,
  date_left_property TEXT,
  incident_warning_completed TEXT,
  reason_failed_to_travel TEXT,
  second_dispersal_date TEXT,
  date_second_letter_handed TEXT,
  second_ia_exit_briefing_completed TEXT,
  second_dispersal_travelled TEXT,
  second_date_left_property TEXT,
  second_incident_warning_completed TEXT,
  reason_failed_to_travel_second TEXT,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. Booklets to be Collected
CREATE TABLE IF NOT EXISTS public.booklet_collections (
  id TEXT PRIMARY KEY,
  hotel_name TEXT,
  agent_name TEXT,
  booklet_type TEXT,
  language TEXT,
  number_for_collection INTEGER,
  collected_booklets INTEGER,
  booklets_received INTEGER,
  status TEXT,
  notes TEXT,
  last_updated TEXT,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. SD VCS Support Agencies
CREATE TABLE IF NOT EXISTS public.vcs_agencies (
  id TEXT PRIMARY KEY,
  hotel_name TEXT,
  agency_name TEXT,
  category TEXT,
  services_provided TEXT,
  contact_person TEXT,
  contact_number TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_verified BOOLEAN,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 26. Field Options & Master Setup (dropdown vocabularies)
CREATE TABLE IF NOT EXISTS public.field_options (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  label TEXT,
  value TEXT,
  color TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 27. Role Permissions (RBAC matrix - one row per role, id = role name)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  can_view_all_properties BOOLEAN DEFAULT FALSE,
  can_create_records BOOLEAN DEFAULT FALSE,
  can_edit_records BOOLEAN DEFAULT FALSE,
  can_delete_records BOOLEAN DEFAULT FALSE,
  can_archive_restore BOOLEAN DEFAULT FALSE,
  can_export_data BOOLEAN DEFAULT FALSE,
  can_manage_properties BOOLEAN DEFAULT FALSE,
  can_manage_files BOOLEAN DEFAULT FALSE,
  can_manage_users BOOLEAN DEFAULT FALSE,
  can_manage_settings BOOLEAN DEFAULT FALSE,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 28. Application Settings (key/value; id 'global' holds system preferences)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY,
  value JSONB,
  updated_by TEXT,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 29. Table Schemas (administrator-defined column layouts per module)
CREATE TABLE IF NOT EXISTS public.table_schemas (
  id TEXT PRIMARY KEY,
  module_key TEXT NOT NULL,
  columns JSONB,
  updated_by TEXT,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- PART 3: ADDITIVE COLUMNS ON EXISTING TABLES
-- Full-fidelity record copy. Nullable, so existing rows are unaffected and
-- keep reading through their typed columns until they are next saved.
-- =====================================================================
ALTER TABLE public.referrals                 ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.vulnerable_residents      ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.challenging_behavior      ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.maintenance_records       ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.spcd_records              ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.sites                     ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.laundry_logs              ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.hot_food_logs             ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.escalations               ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.documents                 ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.user_groups               ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.data_change_requests      ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.property_user_assignments ADD COLUMN IF NOT EXISTS data JSONB;

-- Audit rows name the module and the human-readable subject explicitly, so an
-- entry is never left without a link to the record it describes (BUG-026).
ALTER TABLE public.audit_trails ADD COLUMN IF NOT EXISTS module TEXT;
ALTER TABLE public.audit_trails ADD COLUMN IF NOT EXISTS target_label TEXT;

-- =====================================================================
-- PART 4: PROFILE CREATION TRIGGER ON AUTH.USERS INSERT
--
-- The role is read from raw_app_meta_data, which only the service role can
-- set. It was previously read from raw_user_meta_data, which the person
-- signing up controls - with public sign-up enabled, anyone could register
-- as 'Super Admin'. Accounts that were not provisioned by an administrator
-- are created Inactive and cannot transact until an administrator activates
-- them. Administrator-created accounts are upserted to Active by
-- POST /api/auth/signup immediately after creation.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  granted_role TEXT := NULLIF(NEW.raw_app_meta_data->>'role', '');
BEGIN
  INSERT INTO public.profiles (id, email, name, role, assigned_site, status, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(granted_role, 'Staff'),
    COALESCE(NULLIF(NEW.raw_app_meta_data->>'assigned_site', ''), 'All Sites'),
    CASE WHEN granted_role IS NULL THEN 'Inactive' ELSE 'Active' END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- PART 5: UPDATED_AT TRIGGERS (replaced in place)
-- =====================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'sites', 'user_groups', 'property_user_assignments', 'laundry_logs',
    'hot_food_logs', 'audit_trails', 'referrals', 'vulnerable_residents',
    'challenging_behavior', 'maintenance_records', 'spcd_records', 'escalations',
    'documents', 'data_change_requests', 'password_audit_logs', 'email_notification_rules',
    'public_transport_records', 'compliance_records', 'gp_appointments', 'rfa_welfare_checks',
    'dispersal_records', 'booklet_collections', 'vcs_agencies', 'field_options',
    'role_permissions', 'app_settings', 'table_schemas'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || t || '_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column()',
      'trg_' || t || '_updated_at', t
    );
  END LOOP;
END $$;

-- Triggers created by earlier versions of this script under different names.
DROP TRIGGER IF EXISTS trg_prop_user_assignments_updated_at ON public.property_user_assignments;
DROP TRIGGER IF EXISTS trg_vulnerable_updated_at ON public.vulnerable_residents;
DROP TRIGGER IF EXISTS trg_challenging_updated_at ON public.challenging_behavior;
DROP TRIGGER IF EXISTS trg_maintenance_updated_at ON public.maintenance_records;
DROP TRIGGER IF EXISTS trg_spcd_updated_at ON public.spcd_records;

-- =====================================================================
-- PART 6: PERFORMANCE INDEXES
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_sites_name ON public.sites(name);
CREATE INDEX IF NOT EXISTS idx_laundry_logs_site ON public.laundry_logs(site);
CREATE INDEX IF NOT EXISTS idx_hot_food_logs_site ON public.hot_food_logs(site);
CREATE INDEX IF NOT EXISTS idx_audit_trails_timestamp ON public.audit_trails(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trails_user_id ON public.audit_trails(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trails_entity ON public.audit_trails(entity_type, entity_id);
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
CREATE INDEX IF NOT EXISTS idx_transport_site ON public.public_transport_records(site_name);
CREATE INDEX IF NOT EXISTS idx_compliance_site ON public.compliance_records(site_name);
CREATE INDEX IF NOT EXISTS idx_compliance_expiry ON public.compliance_records(expiry_date);
CREATE INDEX IF NOT EXISTS idx_gp_site ON public.gp_appointments(site_name);
CREATE INDEX IF NOT EXISTS idx_rfa_site ON public.rfa_welfare_checks(site_name);
CREATE INDEX IF NOT EXISTS idx_dispersal_site ON public.dispersal_records(site_name);
CREATE INDEX IF NOT EXISTS idx_booklets_hotel ON public.booklet_collections(hotel_name);
CREATE INDEX IF NOT EXISTS idx_vcs_hotel ON public.vcs_agencies(hotel_name);
CREATE INDEX IF NOT EXISTS idx_field_options_category ON public.field_options(category, sort_order);

-- =====================================================================
-- PART 7: ROW LEVEL SECURITY
--
-- All application data is read and written by the Express server using the
-- service role, which enforces authentication, attribution and the audit
-- trail. Browsers never need direct table access; the only direct query a
-- browser makes is reading its own profile after signing in.
--
-- Earlier migrations granted the anon role (whose key ships in the browser
-- bundle) full access to several tables, and granted every authenticated
-- account - which, with public sign-up enabled, means anyone - full CRUD on
-- every table. Every existing policy on these tables is therefore dropped and
-- replaced with the minimal set below.
-- =====================================================================
DO $$
DECLARE
  app_tables TEXT[] := ARRAY[
    'profiles', 'sites', 'user_groups', 'property_user_assignments', 'laundry_logs',
    'hot_food_logs', 'audit_trails', 'referrals', 'vulnerable_residents',
    'challenging_behavior', 'maintenance_records', 'spcd_records', 'escalations',
    'documents', 'data_change_requests', 'password_audit_logs', 'email_notification_rules',
    'email_notification_logs', 'public_transport_records', 'compliance_records',
    'gp_appointments', 'rfa_welfare_checks', 'dispersal_records', 'booklet_collections',
    'vcs_agencies', 'field_options', 'role_permissions', 'app_settings', 'table_schemas',
    -- legacy tables from 001_modules_migration.sql, kept for their data but locked down
    'audit_logs', 'food_records', 'laundry_records'
  ];
  t TEXT;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY app_tables
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      'service_role_all_' || t, t
    );
  END LOOP;
END $$;

-- A signed-in user may read exactly one row: their own profile.
-- Ensure all operational tables have dedicated attachments and generated file link columns
DO $$
DECLARE
  operational_tables TEXT[] := ARRAY[
    'referrals', 'vulnerable_residents', 'challenging_behavior', 'maintenance_records',
    'spcd_records', 'sites', 'laundry_logs', 'hot_food_logs', 'escalations', 'documents',
    'data_change_requests', 'public_transport_records', 'compliance_records', 'gp_appointments',
    'rfa_welfare_checks', 'dispersal_records', 'booklet_collections', 'vcs_agencies'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY operational_tables
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT ''[]''::jsonb', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS attachment_url TEXT', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS file_url TEXT', t);
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- PART 8: SCHEMA VERSION MARKER
-- =====================================================================
INSERT INTO public.app_settings (id, value, updated_by)
VALUES ('schema_version', '{"version": "2026-09-11.1"}'::jsonb, 'migration')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW();

-- Ask PostgREST to pick up new tables and columns immediately.
NOTIFY pgrst, 'reload schema';
