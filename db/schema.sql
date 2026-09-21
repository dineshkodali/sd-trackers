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
  can_manage_finance BOOLEAN DEFAULT FALSE,
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
-- PART 7B: STATUS PAGE MONITORING (see db/migrations/003_status_monitoring.sql)
--
-- Uptime roll-up, incidents, incident timelines and maintenance windows for
-- the public status page. Written only by the server's status monitor
-- (service role); the page reads a sanitised snapshot from GET /api/status.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.status_daily (
  service_id TEXT NOT NULL,
  day DATE NOT NULL,
  checks_total INT NOT NULL DEFAULT 0,
  checks_operational INT NOT NULL DEFAULT 0,
  checks_degraded INT NOT NULL DEFAULT 0,
  checks_partial INT NOT NULL DEFAULT 0,
  checks_major INT NOT NULL DEFAULT 0,
  checks_maintenance INT NOT NULL DEFAULT 0,
  avg_latency_ms INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (service_id, day)
);

CREATE TABLE IF NOT EXISTS public.status_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  impact TEXT NOT NULL CHECK (impact IN ('degraded_performance', 'partial_outage', 'major_outage', 'maintenance')),
  status TEXT NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  service_ids TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('auto', 'manual')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_incidents_started ON public.status_incidents(started_at DESC);

CREATE TABLE IF NOT EXISTS public.status_incident_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.status_incidents(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_incident_updates_incident ON public.status_incident_updates(incident_id, created_at);

CREATE TABLE IF NOT EXISTS public.status_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  impact TEXT,
  service_ids TEXT[] NOT NULL DEFAULT '{}',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_status_maintenance_window ON public.status_maintenance(starts_at, ends_at);

-- Adds one monitor cycle to the daily roll-up: one element per service,
-- {"service_id": "...", "status": "...", "latency_ms": 123}.
CREATE OR REPLACE FUNCTION public.status_record_checks(p_day DATE, p_checks JSONB)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO public.status_daily AS d (
    service_id, day, checks_total, checks_operational, checks_degraded,
    checks_partial, checks_major, checks_maintenance, avg_latency_ms, updated_at
  )
  SELECT
    c->>'service_id',
    p_day,
    1,
    (c->>'status' = 'operational')::int,
    (c->>'status' = 'degraded_performance')::int,
    (c->>'status' = 'partial_outage')::int,
    (c->>'status' = 'major_outage')::int,
    (c->>'status' = 'maintenance')::int,
    NULLIF(c->>'latency_ms', '')::int,
    NOW()
  FROM jsonb_array_elements(p_checks) AS c
  ON CONFLICT (service_id, day) DO UPDATE SET
    checks_total = d.checks_total + 1,
    checks_operational = d.checks_operational + EXCLUDED.checks_operational,
    checks_degraded = d.checks_degraded + EXCLUDED.checks_degraded,
    checks_partial = d.checks_partial + EXCLUDED.checks_partial,
    checks_major = d.checks_major + EXCLUDED.checks_major,
    checks_maintenance = d.checks_maintenance + EXCLUDED.checks_maintenance,
    avg_latency_ms = CASE
      WHEN EXCLUDED.avg_latency_ms IS NULL THEN d.avg_latency_ms
      WHEN d.avg_latency_ms IS NULL THEN EXCLUDED.avg_latency_ms
      ELSE ((d.avg_latency_ms::bigint * d.checks_total + EXCLUDED.avg_latency_ms) / (d.checks_total + 1))::int
    END,
    updated_at = NOW();
$$;

DO $$
DECLARE
  status_tables TEXT[] := ARRAY['status_daily', 'status_incidents', 'status_incident_updates', 'status_maintenance'];
  t TEXT;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY status_tables
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      'service_role_all_' || t, t
    );
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.status_record_checks(DATE, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.status_record_checks(DATE, JSONB) TO service_role;

-- =====================================================================
-- PART 8: FINANCE MODULE (Multi-site, Configurable Approvals & Reconciliation)
-- =====================================================================

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.organizations (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'SD Commercial Operations', 'sd-commercial', 'active')
ON CONFLICT (id) DO NOTHING;

-- 2. Finance Vendors
CREATE TABLE IF NOT EXISTS public.finance_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.organizations(id),
  vendor_name TEXT NOT NULL,
  vendor_reference TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  payment_details JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_vendors_org ON public.finance_vendors(organization_id, status);

-- 3. Finance Bills
CREATE TABLE IF NOT EXISTS public.finance_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.organizations(id),
  site_id TEXT NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  vendor_id UUID REFERENCES public.finance_vendors(id) ON DELETE SET NULL,
  bill_number TEXT NOT NULL,
  bill_type TEXT NOT NULL CHECK (
    bill_type IN ('vendor_invoice', 'credit_card_expense', 'delivery_note', 'other_expense')
  ),
  bill_date DATE NOT NULL,
  due_date DATE,
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  description TEXT,
  purchase_reference TEXT,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft', 'submitted', 'under_review', 'verification_pending', 'query_raised',
      'awaiting_approval', 'approved', 'rejected', 'payment_pending', 'partially_paid',
      'paid', 'reconciliation_pending', 'reconciled', 'cancelled'
    )
  ),
  final_approved_by UUID REFERENCES public.profiles(id),
  final_approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_bills_org_status ON public.finance_bills(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_finance_bills_site ON public.finance_bills(site_id);
CREATE INDEX IF NOT EXISTS idx_finance_bills_vendor ON public.finance_bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_finance_bills_submitted_at ON public.finance_bills(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_bills_due_date ON public.finance_bills(due_date);

-- 4. Bill Items
CREATE TABLE IF NOT EXISTS public.finance_bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_bill_items_bill ON public.finance_bill_items(bill_id);

-- 5. Bill Attachments
CREATE TABLE IF NOT EXISTS public.finance_bill_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'finance-documents',
  storage_path TEXT NOT NULL,
  attachment_type TEXT NOT NULL CHECK (
    attachment_type IN (
      'vendor_invoice', 'delivery_note', 'credit_card_receipt', 'purchase_order', 'proof_of_delivery', 'other'
    )
  ),
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_bill_attachments_bill ON public.finance_bill_attachments(bill_id);

-- 6. Verification Profiles & Members
CREATE TABLE IF NOT EXISTS public.finance_verification_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  profile_type TEXT NOT NULL CHECK (
    profile_type IN (
      'site_verification', 'procurement_verification', 'finance_verification', 'management_verification', 'custom'
    )
  ),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_profile_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.finance_verification_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, user_id)
);

-- 7. Verification Tasks & Responses
CREATE TABLE IF NOT EXISTS public.finance_verification_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.finance_verification_profiles(id),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  instructions TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (
    status IN ('assigned', 'in_progress', 'submitted', 'returned', 'cancelled')
  ),
  result TEXT CHECK (
    result IS NULL OR result IN ('verified', 'query', 'rejected', 'needs_more_information')
  ),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_tasks_assigned ON public.finance_verification_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_finance_tasks_bill ON public.finance_verification_tasks(bill_id);

CREATE TABLE IF NOT EXISTS public.finance_verification_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.finance_verification_tasks(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (
    result IN ('verified', 'query', 'rejected', 'needs_more_information')
  ),
  comments TEXT,
  responded_by UUID NOT NULL REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Routing Rules
CREATE TABLE IF NOT EXISTS public.finance_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  bill_type TEXT,
  min_amount NUMERIC(14,2) CHECK (min_amount IS NULL OR min_amount >= 0),
  max_amount NUMERIC(14,2) CHECK (max_amount IS NULL OR max_amount >= 0),
  verification_profile_id UUID REFERENCES public.finance_verification_profiles(id) ON DELETE SET NULL,
  requires_external_approval BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (min_amount IS NULL OR max_amount IS NULL OR min_amount <= max_amount)
);

-- 9. Approval Requests & Responses
CREATE TABLE IF NOT EXISTS public.finance_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  routing_rule_id UUID REFERENCES public.finance_routing_rules(id) ON DELETE SET NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  approval_type TEXT NOT NULL CHECK (
    approval_type IN ('department_approval', 'manager_approval', 'finance_final_approval')
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'in_progress', 'approved', 'rejected', 'returned', 'cancelled')
  ),
  request_message TEXT,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_approvals_assigned ON public.finance_approval_requests(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_finance_approvals_bill ON public.finance_approval_requests(bill_id);

CREATE TABLE IF NOT EXISTS public.finance_approval_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES public.finance_approval_requests(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (
    decision IN ('approved', 'rejected', 'query', 'returned')
  ),
  comments TEXT,
  responded_by UUID NOT NULL REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Bill Queries & Responses
CREATE TABLE IF NOT EXISTS public.finance_bill_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  query_type TEXT NOT NULL CHECK (
    query_type IN ('missing_document', 'amount_discrepancy', 'delivery_confirmation', 'vendor_clarification', 'other')
  ),
  question TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (
    priority IN ('low', 'normal', 'high', 'urgent')
  ),
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'in_progress', 'responded', 'resolved', 'closed')
  ),
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_queries_assigned ON public.finance_bill_queries(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_finance_queries_bill ON public.finance_bill_queries(bill_id);

CREATE TABLE IF NOT EXISTS public.finance_query_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES public.finance_bill_queries(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  responded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Manual Reconciliation Records
CREATE TABLE IF NOT EXISTS public.finance_reconciliation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  reconciliation_type TEXT NOT NULL CHECK (
    reconciliation_type IN ('invoice_delivery_note', 'invoice_purchase_reference', 'invoice_payment', 'other')
  ),
  reference_number TEXT,
  expected_amount NUMERIC(14,2),
  actual_amount NUMERIC(14,2),
  variance_amount NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (
    status IN ('not_started', 'in_progress', 'matched', 'partial_match', 'discrepancy', 'resolved')
  ),
  notes TEXT,
  matched_by UUID REFERENCES auth.users(id),
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_bill ON public.finance_reconciliation_records(bill_id);
CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_status ON public.finance_reconciliation_records(status);

-- 12. Payment Records
CREATE TABLE IF NOT EXISTS public.finance_payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  payment_reference TEXT,
  payment_amount NUMERIC(14,2) NOT NULL CHECK (payment_amount > 0),
  payment_date DATE,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    payment_status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')
  ),
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_payment_records_bill ON public.finance_payment_records(bill_id);

-- 13. Audit Trails & Status History
CREATE TABLE IF NOT EXISTS public.finance_bill_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_bill_history_bill ON public.finance_bill_status_history(bill_id);

CREATE TABLE IF NOT EXISTS public.finance_workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.finance_bills(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_workflow_events_bill ON public.finance_workflow_events(bill_id);

-- Apply updated_at trigger across finance tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'organizations', 'finance_vendors', 'finance_bills', 'finance_verification_profiles',
    'finance_verification_tasks', 'finance_routing_rules', 'finance_approval_requests',
    'finance_bill_queries', 'finance_reconciliation_records', 'finance_payment_records'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', tbl, tbl);
  END LOOP;
END $$;

-- Helpers and RLS
CREATE OR REPLACE FUNCTION public.is_finance_user(p_user_id UUID, p_org_id UUID DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  RETURN v_role IN ('Super Admin', 'Admin', 'Finance Admin', 'Finance Manager', 'Finance Staff');
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_finance_site(p_user_id UUID, p_site_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_role TEXT;
  v_assigned TEXT;
BEGIN
  SELECT role, assigned_site INTO v_role, v_assigned FROM public.profiles WHERE id = p_user_id;
  IF v_role IN ('Super Admin', 'Admin', 'Finance Admin', 'Finance Manager', 'Finance Staff', 'Regional Manager') THEN
    RETURN TRUE;
  END IF;
  IF v_assigned = 'All Sites' OR v_assigned = p_site_id THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.property_user_assignments 
    WHERE user_id = p_user_id AND (property_id = p_site_id OR p_site_id = ANY(assigned_properties))
  );
END;
$$;

-- Enable RLS across all finance tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bill_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_verification_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_profile_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_verification_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_verification_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_approval_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bill_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_query_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_reconciliation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bill_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_workflow_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
  finance_tables TEXT[] := ARRAY[
    'organizations', 'finance_vendors', 'finance_bills', 'finance_bill_items',
    'finance_bill_attachments', 'finance_verification_profiles', 'finance_profile_members',
    'finance_verification_tasks', 'finance_verification_responses', 'finance_routing_rules',
    'finance_approval_requests', 'finance_approval_responses', 'finance_bill_queries',
    'finance_query_responses', 'finance_reconciliation_records', 'finance_payment_records',
    'finance_bill_status_history', 'finance_workflow_events'
  ];
BEGIN
  FOREACH t IN ARRAY finance_tables LOOP
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "finance_bills_select_policy" ON public.finance_bills;
CREATE POLICY "finance_bills_select_policy" ON public.finance_bills
FOR SELECT TO authenticated
USING (
  public.is_finance_user(auth.uid(), organization_id)
  OR public.can_access_finance_site(auth.uid(), site_id)
  OR submitted_by = auth.uid()
);

DROP POLICY IF EXISTS "finance_bills_insert_policy" ON public.finance_bills;
CREATE POLICY "finance_bills_insert_policy" ON public.finance_bills
FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND public.can_access_finance_site(auth.uid(), site_id)
);

DROP POLICY IF EXISTS "finance_bills_update_policy" ON public.finance_bills;
CREATE POLICY "finance_bills_update_policy" ON public.finance_bills
FOR UPDATE TO authenticated
USING (
  public.is_finance_user(auth.uid(), organization_id)
  OR (submitted_by = auth.uid() AND status IN ('draft', 'query_raised'))
);

DO $$
DECLARE
  child_tbl TEXT;
  child_tables TEXT[] := ARRAY[
    'finance_bill_items', 'finance_bill_attachments', 'finance_verification_tasks',
    'finance_approval_requests', 'finance_bill_queries', 'finance_reconciliation_records',
    'finance_payment_records', 'finance_bill_status_history', 'finance_workflow_events'
  ];
BEGIN
  FOREACH child_tbl IN ARRAY child_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', child_tbl || '_select_policy', child_tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.finance_bills b 
          WHERE b.id = %I.bill_id AND (
            public.is_finance_user(auth.uid(), b.organization_id)
            OR public.can_access_finance_site(auth.uid(), b.site_id)
            OR b.submitted_by = auth.uid()
          )
        )
      )', child_tbl || '_select_policy', child_tbl, child_tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', child_tbl || '_all_policy', child_tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      child_tbl || '_all_policy', child_tbl
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
CREATE POLICY "organizations_select_policy" ON public.organizations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "finance_vendors_select_policy" ON public.finance_vendors;
CREATE POLICY "finance_vendors_select_policy" ON public.finance_vendors FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "finance_vendors_manage_policy" ON public.finance_vendors;
CREATE POLICY "finance_vendors_manage_policy" ON public.finance_vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Workflow RPC State Machine Functions
CREATE OR REPLACE FUNCTION public.fn_finance_submit_bill(p_bill_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bill RECORD;
BEGIN
  SELECT * INTO v_bill FROM public.finance_bills WHERE id = p_bill_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
  END IF;
  IF v_bill.status NOT IN ('draft', 'query_raised') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bill is not in a submittable state');
  END IF;

  UPDATE public.finance_bills
  SET status = 'submitted', updated_at = NOW()
  WHERE id = p_bill_id;

  INSERT INTO public.finance_bill_status_history (bill_id, old_status, new_status, changed_by, reason)
  VALUES (p_bill_id, v_bill.status, 'submitted', auth.uid(), 'Bill submitted for review');

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (p_bill_id, 'bill_submitted', auth.uid(), jsonb_build_object('total_amount', v_bill.total_amount));

  RETURN jsonb_build_object('success', true, 'status', 'submitted');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_finance_final_approval(p_bill_id UUID, p_comments TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bill RECORD;
  v_user_role TEXT;
BEGIN
  SELECT * INTO v_bill FROM public.finance_bills WHERE id = p_bill_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  IF v_user_role NOT IN ('Super Admin', 'Admin', 'Finance Admin', 'Finance Manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Finance can grant final approval');
  END IF;

  IF v_bill.submitted_by = auth.uid() AND v_user_role NOT IN ('Super Admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Segregation of duties: Submitter cannot grant final approval');
  END IF;

  UPDATE public.finance_bills
  SET status = 'approved',
      final_approved_by = auth.uid(),
      final_approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_bill_id;

  INSERT INTO public.finance_bill_status_history (bill_id, old_status, new_status, changed_by, reason)
  VALUES (p_bill_id, v_bill.status, 'approved', auth.uid(), COALESCE(p_comments, 'Final Finance Approval granted'));

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (p_bill_id, 'approval_decided', auth.uid(), jsonb_build_object('decision', 'approved', 'comments', p_comments));

  RETURN jsonb_build_object('success', true, 'status', 'approved');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_finance_reject_bill(p_bill_id UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bill RECORD;
BEGIN
  SELECT * INTO v_bill FROM public.finance_bills WHERE id = p_bill_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
  END IF;

  UPDATE public.finance_bills
  SET status = 'rejected',
      rejected_by = auth.uid(),
      rejected_at = NOW(),
      rejection_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_bill_id;

  INSERT INTO public.finance_bill_status_history (bill_id, old_status, new_status, changed_by, reason)
  VALUES (p_bill_id, v_bill.status, 'rejected', auth.uid(), p_reason);

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (p_bill_id, 'approval_decided', auth.uid(), jsonb_build_object('decision', 'rejected', 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'status', 'rejected');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_finance_raise_query(
  p_bill_id UUID,
  p_query_type TEXT,
  p_question TEXT,
  p_assigned_to UUID,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_query_id UUID;
  v_old_status TEXT;
BEGIN
  SELECT status INTO v_old_status FROM public.finance_bills WHERE id = p_bill_id;

  INSERT INTO public.finance_bill_queries (bill_id, raised_by, assigned_to, query_type, question, priority, status)
  VALUES (p_bill_id, auth.uid(), p_assigned_to, p_query_type, p_question, p_priority, 'open')
  RETURNING id INTO v_query_id;

  UPDATE public.finance_bills
  SET status = 'query_raised', updated_at = NOW()
  WHERE id = p_bill_id;

  INSERT INTO public.finance_bill_status_history (bill_id, old_status, new_status, changed_by, reason)
  VALUES (p_bill_id, v_old_status, 'query_raised', auth.uid(), 'Query raised: ' || p_question);

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (p_bill_id, 'query_raised', auth.uid(), jsonb_build_object('query_id', v_query_id, 'type', p_query_type));

  RETURN jsonb_build_object('success', true, 'query_id', v_query_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_finance_respond_query(
  p_query_id UUID,
  p_response_text TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bill_id UUID;
BEGIN
  SELECT bill_id INTO v_bill_id FROM public.finance_bill_queries WHERE id = p_query_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Query not found');
  END IF;

  INSERT INTO public.finance_query_responses (query_id, response_text, responded_by)
  VALUES (p_query_id, p_response_text, auth.uid());

  UPDATE public.finance_bill_queries
  SET status = 'responded', updated_at = NOW()
  WHERE id = p_query_id;

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (v_bill_id, 'query_responded', auth.uid(), jsonb_build_object('query_id', p_query_id));

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_finance_record_reconciliation(
  p_bill_id UUID,
  p_reconciliation_type TEXT,
  p_reference_number TEXT,
  p_expected_amount NUMERIC,
  p_actual_amount NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rec_id UUID;
  v_variance NUMERIC;
  v_rec_status TEXT;
BEGIN
  v_variance := COALESCE(p_actual_amount, 0) - COALESCE(p_expected_amount, 0);
  IF v_variance = 0 THEN
    v_rec_status := 'matched';
  ELSE
    v_rec_status := 'discrepancy';
  END IF;

  INSERT INTO public.finance_reconciliation_records (
    bill_id, reconciliation_type, reference_number, expected_amount, actual_amount,
    variance_amount, status, notes, matched_by, reconciled_at
  )
  VALUES (
    p_bill_id, p_reconciliation_type, p_reference_number, p_expected_amount, p_actual_amount,
    v_variance, v_rec_status, p_notes, auth.uid(), NOW()
  )
  RETURNING id INTO v_rec_id;

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (p_bill_id, 'reconciliation_completed', auth.uid(), jsonb_build_object('reconciliation_id', v_rec_id, 'status', v_rec_status, 'variance', v_variance));

  RETURN jsonb_build_object('success', true, 'reconciliation_id', v_rec_id, 'status', v_rec_status, 'variance', v_variance);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_finance_record_payment(
  p_bill_id UUID,
  p_payment_reference TEXT,
  p_payment_amount NUMERIC,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_payment_status TEXT DEFAULT 'paid'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bill RECORD;
  v_paid_total NUMERIC;
  v_new_bill_status TEXT;
BEGIN
  SELECT * INTO v_bill FROM public.finance_bills WHERE id = p_bill_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
  END IF;

  INSERT INTO public.finance_payment_records (
    bill_id, payment_reference, payment_amount, payment_date, payment_status, recorded_by
  )
  VALUES (
    p_bill_id, p_payment_reference, p_payment_amount, p_payment_date, p_payment_status, auth.uid()
  );

  SELECT COALESCE(SUM(payment_amount), 0) INTO v_paid_total
  FROM public.finance_payment_records
  WHERE bill_id = p_bill_id AND payment_status = 'paid';

  IF v_paid_total >= v_bill.total_amount THEN
    v_new_bill_status := 'paid';
  ELSIF v_paid_total > 0 THEN
    v_new_bill_status := 'partially_paid';
  ELSE
    v_new_bill_status := 'payment_pending';
  END IF;

  UPDATE public.finance_bills
  SET status = v_new_bill_status, updated_at = NOW()
  WHERE id = p_bill_id;

  INSERT INTO public.finance_bill_status_history (bill_id, old_status, new_status, changed_by, reason)
  VALUES (p_bill_id, v_bill.status, v_new_bill_status, auth.uid(), 'Payment recorded: ' || p_payment_reference || ' (' || p_payment_amount || ')');

  INSERT INTO public.finance_workflow_events (bill_id, event_type, actor_user_id, metadata)
  VALUES (p_bill_id, 'payment_recorded', auth.uid(), jsonb_build_object('amount', p_payment_amount, 'reference', p_payment_reference));

  RETURN jsonb_build_object('success', true, 'bill_status', v_new_bill_status, 'total_paid', v_paid_total);
END;
$$;

-- =====================================================================
-- PART 9: SCHEMA VERSION MARKER
-- =====================================================================
INSERT INTO public.app_settings (id, value, updated_by)
VALUES ('schema_version', '{"version": "2026-09-20.1-finance"}'::jsonb, 'migration')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW();

-- Ask PostgREST to pick up new tables and columns immediately.

-- ============================================================================
-- Seed Default Finance Vendors
-- ============================================================================
INSERT INTO public.finance_vendors (id, organization_id, vendor_name, vendor_reference, contact_email, contact_phone, status)
VALUES 
  ('00000000-0000-0000-0001-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Apex Facilities & Commercial Cleaning Ltd', 'APEX-FAC-01', 'accounts@apexfacilities.co.uk', '+44 20 7946 0912', 'active'),
  ('00000000-0000-0000-0001-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Brakes Foodservice Wholesale', 'BRAKES-UK-88', 'orders@brake.co.uk', '+44 34 5606 9090', 'active'),
  ('00000000-0000-0000-0001-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Total Commercial Laundry Solutions', 'TOT-LAU-09', 'billing@totallaundry.co.uk', '+44 16 1496 0233', 'active'),
  ('00000000-0000-0000-0001-000000000004'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'British Gas Business Energy', 'BG-UTIL-44', 'business@britishgas.co.uk', '+44 33 0100 0050', 'active'),
  ('00000000-0000-0000-0001-000000000005'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Enterprise Rent-A-Car Commercial', 'ENT-FLEET-12', 'commercial@enterprise.co.uk', '+44 80 0800 2277', 'active'),
  ('00000000-0000-0000-0001-000000000006'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Direct Site Supplies & Maintenance Ltd', 'DSS-MAINT-77', 'helpdesk@directsitesupplies.co.uk', '+44 12 1496 0888', 'active')
ON CONFLICT (id) DO UPDATE SET
  vendor_name = EXCLUDED.vendor_name,
  vendor_reference = EXCLUDED.vendor_reference,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone;

NOTIFY pgrst, 'reload schema';

