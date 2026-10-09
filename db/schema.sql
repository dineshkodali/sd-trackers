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

-- 30. IR Tracker (Incident Reports)
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

-- 31. Food Wastage Records
CREATE TABLE IF NOT EXISTS public.food_wastage_records (
  id TEXT PRIMARY KEY,
  site TEXT,
  date TEXT,
  food_wastage TEXT,
  quantity TEXT,
  comments TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  attachment_url TEXT,
  file_url TEXT,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 32. Daily Register Rooms (Room List & Static Inventory)
CREATE TABLE IF NOT EXISTS public.daily_register_rooms (
  id TEXT PRIMARY KEY,
  hotel TEXT,
  room_no TEXT,
  floor TEXT,
  room_type TEXT,
  current_max_occupancy INT DEFAULT 0,
  current_occupancy INT DEFAULT 0,
  su_cohort TEXT,
  bedspaces_available INT DEFAULT 0,
  void_bedspaces INT DEFAULT 0,
  void_reason TEXT,
  size_sqm NUMERIC,
  max_room_type TEXT,
  potential_max_capacity INT DEFAULT 0,
  steps_to_increase_capacity TEXT,
  date TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 33. Daily Register Records (Occupancy & Resident Roster)
CREATE TABLE IF NOT EXISTS public.daily_register_records (
  id TEXT PRIMARY KEY,
  hotel TEXT,
  room_no TEXT,
  floor TEXT,
  room_makeup TEXT,
  single_bed INT DEFAULT 0,
  double_bed INT DEFAULT 0,
  single_bunk INT DEFAULT 0,
  double_bunk INT DEFAULT 0,
  cot INT DEFAULT 0,
  su_makeup TEXT,
  port_ref TEXT,
  name TEXT,
  check_in_date TEXT,
  contact_no TEXT,
  email TEXT,
  dob TEXT,
  age INT,
  age_group TEXT,
  nationality TEXT,
  language TEXT,
  gender TEXT,
  su_comments TEXT,
  available_to_book TEXT DEFAULT 'No',
  is_void TEXT DEFAULT 'No',
  void_reason TEXT,
  maintenance_date_from TEXT,
  allocation_to_be_reviewed TEXT DEFAULT 'No',
  occupied TEXT DEFAULT 'Yes',
  register_date TEXT,
  daily_occupancy JSONB DEFAULT '{}'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 34. New Arrivals Records
CREATE TABLE IF NOT EXISTS public.new_arrivals_records (
  id TEXT PRIMARY KEY,
  port_reference TEXT,
  name TEXT,
  dob TEXT,
  country TEXT,
  language TEXT,
  contact_number TEXT,
  hotel TEXT,
  room TEXT,
  email TEXT,
  aspen_card TEXT,
  status TEXT DEFAULT 'Arrived',
  attachments JSONB DEFAULT '[]'::jsonb,
  data JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 35. Eviction Records
CREATE TABLE IF NOT EXISTS public.eviction_records (
  id TEXT PRIMARY KEY,
  hotel TEXT,
  room_no TEXT,
  port_ref TEXT,
  su_name TEXT,
  notice_date TEXT,
  eviction_date TEXT,
  eviction_reason TEXT,
  status TEXT DEFAULT 'Notice Issued',
  notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
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
    COALESCE(NULLIF(NEW.raw_app_meta_data->>'assigned_site', ''), 'Pending Assignment'),
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
    'role_permissions', 'app_settings', 'table_schemas', 'ir_records',
    'food_wastage_records', 'daily_register_rooms', 'daily_register_records', 'new_arrivals_records', 'eviction_records'
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
CREATE INDEX IF NOT EXISTS idx_ir_site ON public.ir_records(site);
CREATE INDEX IF NOT EXISTS idx_ir_date ON public.ir_records(date);
CREATE INDEX IF NOT EXISTS idx_ir_su_name ON public.ir_records(su_name);
CREATE INDEX IF NOT EXISTS idx_food_wastage_site ON public.food_wastage_records(site);
CREATE INDEX IF NOT EXISTS idx_food_wastage_date ON public.food_wastage_records(date);
CREATE INDEX IF NOT EXISTS idx_reg_rooms_hotel ON public.daily_register_rooms(hotel);
CREATE INDEX IF NOT EXISTS idx_reg_rooms_room_no ON public.daily_register_rooms(room_no);
CREATE INDEX IF NOT EXISTS idx_reg_records_hotel ON public.daily_register_records(hotel);
CREATE INDEX IF NOT EXISTS idx_reg_records_room_no ON public.daily_register_records(room_no);
CREATE INDEX IF NOT EXISTS idx_reg_records_port_ref ON public.daily_register_records(port_ref);
CREATE INDEX IF NOT EXISTS idx_arrivals_hotel ON public.new_arrivals_records(hotel);
CREATE INDEX IF NOT EXISTS idx_arrivals_port_ref ON public.new_arrivals_records(port_reference);
CREATE INDEX IF NOT EXISTS idx_evictions_hotel ON public.eviction_records(hotel);
CREATE INDEX IF NOT EXISTS idx_evictions_port_ref ON public.eviction_records(port_ref);

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
    'ir_records', 'food_wastage_records', 'daily_register_rooms', 'daily_register_records',
    'new_arrivals_records', 'eviction_records',
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
    'rfa_welfare_checks', 'dispersal_records', 'booklet_collections', 'vcs_agencies', 'ir_records',
    'food_wastage_records', 'daily_register_rooms', 'daily_register_records', 'new_arrivals_records', 'eviction_records'
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
  RETURN v_role IN ('Super Admin', 'Admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_finance_site(p_user_id UUID, p_site_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_role TEXT;
  v_assigned TEXT;
BEGIN
  SELECT role, assigned_site INTO v_role, v_assigned FROM public.profiles WHERE id = p_user_id;
  IF v_role IN ('Super Admin', 'Admin', 'Regional Manager') THEN
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
  IF v_user_role IS NULL OR v_user_role NOT IN ('Super Admin', 'Admin') THEN
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

-- =====================================================================
-- PART 10: DOCUMENT BUILDER MODULE (Single Unified Table: doc_builder)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.doc_builder (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL DEFAULT 'document', -- 'template' | 'document' | 'audit'
  template_id TEXT,
  site TEXT NOT NULL DEFAULT 'All Sites',
  title TEXT NOT NULL,
  document_number TEXT,
  category TEXT DEFAULT 'General',
  status TEXT DEFAULT 'draft',
  field_values JSONB DEFAULT '{}',
  created_by TEXT,
  created_by_name TEXT,
  created_by_role TEXT,
  created_by_email TEXT,
  updated_by TEXT,
  updated_by_name TEXT,
  updated_by_role TEXT,
  finalized_at TIMESTAMPTZ,
  finalized_by TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_doc_builder_updated_at'
  ) THEN
    CREATE TRIGGER update_doc_builder_updated_at
      BEFORE UPDATE ON public.doc_builder
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- =====================================================================
-- PART 11: HO REPORT GENERATOR MODULE (Dedicated Separate Tables)
-- =====================================================================

-- 1. HO Report Templates Table
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

-- 2. HO Report Records Table (Generated documents prepared in DOCX/PDF)
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

-- 3. HO Report Audit Logs Table
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
-- =====================================================================
-- SUPABASE REALTIME REPLICATION CONFIGURATION
-- =====================================================================

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'ir_records',
    'maintenance_records',
    'data_change_requests',
    'escalations',
    'referrals',
    'vulnerable_residents',
    'challenging_behavior',
    'laundry_logs',
    'hot_food_logs',
    'public_transport_records',
    'compliance_records',
    'gp_appointments',
    'rfa_welfare_checks',
    'dispersal_records',
    'booklet_collections',
    'vcs_agencies',
    'food_wastage_records',
    'daily_register_rooms',
    'daily_register_records',
    'new_arrivals_records',
    'eviction_records',
    'sites',
    'finance_bills',
    'documents',
    'ho_report_records',
    'audit_trails',
    'email_notification_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', tbl);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'ir_records',
    'maintenance_records',
    'data_change_requests',
    'escalations',
    'referrals',
    'vulnerable_residents',
    'challenging_behavior',
    'laundry_logs',
    'hot_food_logs',
    'public_transport_records',
    'compliance_records',
    'gp_appointments',
    'rfa_welfare_checks',
    'dispersal_records',
    'booklet_collections',
    'vcs_agencies',
    'food_wastage_records',
    'daily_register_rooms',
    'daily_register_records',
    'new_arrivals_records',
    'eviction_records',
    'sites',
    'finance_bills',
    'documents',
    'ho_report_records',
    'audit_trails',
    'email_notification_logs',
    'welfare_checks',
    'food_surveys',
    'food_meal_ratings',
    'room_checks',
    'room_check_items'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY tables LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables 
          WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
        ) THEN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
        END IF;
      END IF;
    END LOOP;
  END IF;
END $$;

-- =====================================================================
-- PART 12: WELFARE CHECKS, FOOD SURVEY CHECKS & ROOM CHECKS
-- =====================================================================

-- Welfare Checks
CREATE TABLE IF NOT EXISTS public.welfare_checks (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES public.sites(id) ON DELETE SET NULL,
  site_name TEXT NOT NULL,
  service_user_id TEXT,
  port_reference TEXT NOT NULL,
  flat_number TEXT,
  officer_id TEXT,
  officer_name TEXT,
  check_datetime TIMESTAMPTZ DEFAULT NOW(),
  safeguarding_statement_agreement BOOLEAN DEFAULT false,
  valid_port_reference BOOLEAN DEFAULT true,
  location_type TEXT,
  location_other TEXT,
  contact_method TEXT,
  contact_method_other TEXT,
  wants_welfare_engagement BOOLEAN DEFAULT true,
  family_or_individual TEXT DEFAULT 'Individual',
  gp_registered BOOLEAN DEFAULT false,
  gp_details TEXT,
  physical_health_change BOOLEAN DEFAULT false,
  physical_health_details TEXT,
  coronavirus_awareness BOOLEAN DEFAULT false,
  coronavirus_symptoms_awareness BOOLEAN DEFAULT false,
  previous_coronavirus BOOLEAN DEFAULT false,
  knows_symptom_action BOOLEAN DEFAULT false,
  knows_worsening_contact BOOLEAN DEFAULT false,
  knows_assistance_contact BOOLEAN DEFAULT false,
  mental_health_change BOOLEAN DEFAULT false,
  mental_health_details TEXT,
  other_welfare_issues TEXT,
  maintenance_issues TEXT,
  safeguarding_concerns TEXT,
  window_restrictors_intact BOOLEAN DEFAULT true,
  smoke_alarms_working BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'Completed',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_welfare_checks_site ON public.welfare_checks(site_name);
CREATE INDEX IF NOT EXISTS idx_welfare_checks_site_id ON public.welfare_checks(site_id);
CREATE INDEX IF NOT EXISTS idx_welfare_checks_port_ref ON public.welfare_checks(port_reference);
CREATE INDEX IF NOT EXISTS idx_welfare_checks_datetime ON public.welfare_checks(check_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_welfare_checks_created_at ON public.welfare_checks(created_at DESC);

DROP TRIGGER IF EXISTS trg_welfare_checks_updated_at ON public.welfare_checks;
CREATE TRIGGER trg_welfare_checks_updated_at
  BEFORE UPDATE ON public.welfare_checks
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.welfare_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.welfare_checks FROM anon;
GRANT ALL ON public.welfare_checks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.welfare_checks TO authenticated;

DROP POLICY IF EXISTS p_welfare_checks_auth_all ON public.welfare_checks;
CREATE POLICY p_welfare_checks_auth_all ON public.welfare_checks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Food Surveys
CREATE TABLE IF NOT EXISTS public.food_surveys (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES public.sites(id) ON DELETE SET NULL,
  site_name TEXT NOT NULL,
  port_reference TEXT NOT NULL,
  house_officer_name TEXT,
  overall_food_quality TEXT,
  server_quality TEXT,
  dining_area_cleanliness TEXT,
  overall_food_rating TEXT,
  menu_diversity TEXT,
  favourite_dish TEXT,
  least_favourite_dish TEXT,
  suggested_dishes TEXT,
  food_allergies TEXT,
  portion_sizes TEXT,
  known_allergies TEXT,
  dietary_requirements TEXT,
  takeaway_awareness BOOLEAN DEFAULT false,
  snack_awareness BOOLEAN DEFAULT false,
  other_feedback TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_surveys_site ON public.food_surveys(site_name);
CREATE INDEX IF NOT EXISTS idx_food_surveys_site_id ON public.food_surveys(site_id);
CREATE INDEX IF NOT EXISTS idx_food_surveys_port_ref ON public.food_surveys(port_reference);
CREATE INDEX IF NOT EXISTS idx_food_surveys_created_at ON public.food_surveys(created_at DESC);

DROP TRIGGER IF EXISTS trg_food_surveys_updated_at ON public.food_surveys;
CREATE TRIGGER trg_food_surveys_updated_at
  BEFORE UPDATE ON public.food_surveys
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.food_surveys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.food_surveys FROM anon;
GRANT ALL ON public.food_surveys TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_surveys TO authenticated;

DROP POLICY IF EXISTS p_food_surveys_auth_all ON public.food_surveys;
CREATE POLICY p_food_surveys_auth_all ON public.food_surveys
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Food Meal Ratings
CREATE TABLE IF NOT EXISTS public.food_meal_ratings (
  id TEXT PRIMARY KEY,
  food_survey_id TEXT NOT NULL REFERENCES public.food_surveys(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  rating TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_meal_ratings_survey ON public.food_meal_ratings(food_survey_id);
CREATE INDEX IF NOT EXISTS idx_food_meal_ratings_day_meal ON public.food_meal_ratings(day_of_week, meal_type);

ALTER TABLE public.food_meal_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.food_meal_ratings FROM anon;
GRANT ALL ON public.food_meal_ratings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_meal_ratings TO authenticated;

DROP POLICY IF EXISTS p_food_meal_ratings_auth_all ON public.food_meal_ratings;
CREATE POLICY p_food_meal_ratings_auth_all ON public.food_meal_ratings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Room Checks
CREATE TABLE IF NOT EXISTS public.room_checks (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES public.sites(id) ON DELETE SET NULL,
  site_name TEXT NOT NULL,
  room_number TEXT NOT NULL,
  aic_reference TEXT,
  officer_id TEXT,
  officer_name TEXT,
  inspection_date TEXT NOT NULL,
  overall_status TEXT NOT NULL DEFAULT 'Passed',
  final_comments TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_checks_site ON public.room_checks(site_name);
CREATE INDEX IF NOT EXISTS idx_room_checks_site_id ON public.room_checks(site_id);
CREATE INDEX IF NOT EXISTS idx_room_checks_room ON public.room_checks(room_number);
CREATE INDEX IF NOT EXISTS idx_room_checks_status ON public.room_checks(overall_status);
CREATE INDEX IF NOT EXISTS idx_room_checks_inspection_date ON public.room_checks(inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_room_checks_created_at ON public.room_checks(created_at DESC);

DROP TRIGGER IF EXISTS trg_room_checks_updated_at ON public.room_checks;
CREATE TRIGGER trg_room_checks_updated_at
  BEFORE UPDATE ON public.room_checks
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.room_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_checks FROM anon;
GRANT ALL ON public.room_checks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_checks TO authenticated;

DROP POLICY IF EXISTS p_room_checks_auth_all ON public.room_checks;
CREATE POLICY p_room_checks_auth_all ON public.room_checks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Room Check Items
CREATE TABLE IF NOT EXISTS public.room_check_items (
  id TEXT PRIMARY KEY,
  room_check_id TEXT NOT NULL REFERENCES public.room_checks(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  question_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  response TEXT NOT NULL,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_check_items_check ON public.room_check_items(room_check_id);
CREATE INDEX IF NOT EXISTS idx_room_check_items_key ON public.room_check_items(question_key);
CREATE INDEX IF NOT EXISTS idx_room_check_items_sort ON public.room_check_items(sort_order);

ALTER TABLE public.room_check_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_check_items FROM anon;
GRANT ALL ON public.room_check_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_check_items TO authenticated;

DROP POLICY IF EXISTS p_room_check_items_auth_all ON public.room_check_items;
CREATE POLICY p_room_check_items_auth_all ON public.room_check_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================================
-- PART 6: CENTRALISED SERVICE USER & PROPERTY MANAGEMENT MASTER TABLES
-- =====================================================================

-- Extend existing public.sites table with master fields
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS site_code TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS site_name TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS address_line_1 TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS address_line_2 TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS county TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS postcode TEXT;

-- Backfill site_name from name where null
UPDATE public.sites SET site_name = name WHERE site_name IS NULL AND name IS NOT NULL;

-- 1. Properties
CREATE TABLE IF NOT EXISTS public.properties (
  id TEXT PRIMARY KEY,
  property_reference TEXT UNIQUE,
  property_name TEXT NOT NULL,
  property_type TEXT DEFAULT 'HMO',
  site_id TEXT REFERENCES public.sites(id) ON DELETE SET NULL,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  county TEXT,
  postcode TEXT,
  ownership_type TEXT DEFAULT 'Leased',
  provider TEXT,
  landlord TEXT,
  property_manager TEXT,
  maximum_occupancy INTEGER DEFAULT 0,
  bedrooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  number_of_floors INTEGER DEFAULT 1,
  accessibility_information TEXT,
  status TEXT DEFAULT 'Active',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_site_id ON public.properties(site_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_ref ON public.properties(property_reference);

DROP TRIGGER IF EXISTS trg_properties_updated_at ON public.properties;
CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.properties FROM anon;
GRANT ALL ON public.properties TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;

DROP POLICY IF EXISTS p_properties_auth_all ON public.properties;
CREATE POLICY p_properties_auth_all ON public.properties
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Property Rooms
CREATE TABLE IF NOT EXISTS public.property_rooms (
  id TEXT PRIMARY KEY,
  room_reference TEXT UNIQUE,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  room_name TEXT,
  room_type TEXT DEFAULT 'Bedroom',
  floor TEXT DEFAULT 'Ground',
  capacity INTEGER DEFAULT 1,
  size TEXT,
  status TEXT DEFAULT 'Available',
  occupancy_status TEXT DEFAULT 'Available',
  description TEXT,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_rooms_prop_id ON public.property_rooms(property_id);
CREATE INDEX IF NOT EXISTS idx_property_rooms_status ON public.property_rooms(status);
CREATE INDEX IF NOT EXISTS idx_property_rooms_occupancy ON public.property_rooms(occupancy_status);
CREATE INDEX IF NOT EXISTS idx_property_rooms_ref ON public.property_rooms(room_reference);

DROP TRIGGER IF EXISTS trg_property_rooms_updated_at ON public.property_rooms;
CREATE TRIGGER trg_property_rooms_updated_at
  BEFORE UPDATE ON public.property_rooms
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.property_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_rooms FROM anon;
GRANT ALL ON public.property_rooms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_rooms TO authenticated;

DROP POLICY IF EXISTS p_property_rooms_auth_all ON public.property_rooms;
CREATE POLICY p_property_rooms_auth_all ON public.property_rooms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Property Facilities
CREATE TABLE IF NOT EXISTS public.property_facilities (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  facility_name TEXT NOT NULL,
  facility_type TEXT,
  is_available BOOLEAN DEFAULT true,
  details TEXT,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_facilities_prop_id ON public.property_facilities(property_id);

DROP TRIGGER IF EXISTS trg_property_facilities_updated_at ON public.property_facilities;
CREATE TRIGGER trg_property_facilities_updated_at
  BEFORE UPDATE ON public.property_facilities
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.property_facilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_facilities FROM anon;
GRANT ALL ON public.property_facilities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_facilities TO authenticated;

DROP POLICY IF EXISTS p_property_facilities_auth_all ON public.property_facilities;
CREATE POLICY p_property_facilities_auth_all ON public.property_facilities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Property Assets
CREATE TABLE IF NOT EXISTS public.property_assets (
  id TEXT PRIMARY KEY,
  asset_reference TEXT UNIQUE,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES public.property_rooms(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  serial_number TEXT,
  quantity INTEGER DEFAULT 1,
  condition TEXT DEFAULT 'Good',
  purchase_date DATE,
  warranty_expiry DATE,
  status TEXT DEFAULT 'Active',
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_assets_prop_id ON public.property_assets(property_id);
CREATE INDEX IF NOT EXISTS idx_property_assets_room_id ON public.property_assets(room_id);
CREATE INDEX IF NOT EXISTS idx_property_assets_category ON public.property_assets(category);

DROP TRIGGER IF EXISTS trg_property_assets_updated_at ON public.property_assets;
CREATE TRIGGER trg_property_assets_updated_at
  BEFORE UPDATE ON public.property_assets
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.property_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_assets FROM anon;
GRANT ALL ON public.property_assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_assets TO authenticated;

DROP POLICY IF EXISTS p_property_assets_auth_all ON public.property_assets;
CREATE POLICY p_property_assets_auth_all ON public.property_assets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Property Compliance
CREATE TABLE IF NOT EXISTS public.property_compliance (
  id TEXT PRIMARY KEY,
  compliance_reference TEXT,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  certificate_number TEXT,
  inspection_date DATE,
  expiry_date DATE,
  provider TEXT,
  status TEXT DEFAULT 'Valid',
  document_id TEXT,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_compliance_prop_id ON public.property_compliance(property_id);
CREATE INDEX IF NOT EXISTS idx_property_compliance_expiry ON public.property_compliance(expiry_date);
CREATE INDEX IF NOT EXISTS idx_property_compliance_status ON public.property_compliance(status);

DROP TRIGGER IF EXISTS trg_property_compliance_updated_at ON public.property_compliance;
CREATE TRIGGER trg_property_compliance_updated_at
  BEFORE UPDATE ON public.property_compliance
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.property_compliance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_compliance FROM anon;
GRANT ALL ON public.property_compliance TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_compliance TO authenticated;

DROP POLICY IF EXISTS p_property_compliance_auth_all ON public.property_compliance;
CREATE POLICY p_property_compliance_auth_all ON public.property_compliance
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Property Documents
CREATE TABLE IF NOT EXISTS public.property_documents (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  reference_number TEXT,
  file_url TEXT,
  issue_date DATE,
  expiry_date DATE,
  verification_status TEXT DEFAULT 'Pending',
  uploaded_by TEXT,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_documents_prop_id ON public.property_documents(property_id);

DROP TRIGGER IF EXISTS trg_property_documents_updated_at ON public.property_documents;
CREATE TRIGGER trg_property_documents_updated_at
  BEFORE UPDATE ON public.property_documents
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_documents FROM anon;
GRANT ALL ON public.property_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_documents TO authenticated;

DROP POLICY IF EXISTS p_property_documents_auth_all ON public.property_documents;
CREATE POLICY p_property_documents_auth_all ON public.property_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Property Contacts
CREATE TABLE IF NOT EXISTS public.property_contacts (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  organisation TEXT,
  role TEXT,
  phone TEXT,
  email TEXT,
  contact_type TEXT DEFAULT 'Landlord',
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_contacts_prop_id ON public.property_contacts(property_id);

DROP TRIGGER IF EXISTS trg_property_contacts_updated_at ON public.property_contacts;
CREATE TRIGGER trg_property_contacts_updated_at
  BEFORE UPDATE ON public.property_contacts
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.property_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_contacts FROM anon;
GRANT ALL ON public.property_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_contacts TO authenticated;

DROP POLICY IF EXISTS p_property_contacts_auth_all ON public.property_contacts;
CREATE POLICY p_property_contacts_auth_all ON public.property_contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Service Users
CREATE TABLE IF NOT EXISTS public.service_users (
  id TEXT PRIMARY KEY,
  su_reference TEXT UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  preferred_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  nationality TEXT,
  preferred_language TEXT,
  interpreter_required BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Active',
  external_reference TEXT,
  case_reference TEXT,
  referral_date DATE,
  arrival_date DATE,
  site_id TEXT REFERENCES public.sites(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_users_status ON public.service_users(status);
CREATE INDEX IF NOT EXISTS idx_service_users_site_id ON public.service_users(site_id);
CREATE INDEX IF NOT EXISTS idx_service_users_ref ON public.service_users(su_reference);
CREATE INDEX IF NOT EXISTS idx_service_users_ext_ref ON public.service_users(external_reference);

DROP TRIGGER IF EXISTS trg_service_users_updated_at ON public.service_users;
CREATE TRIGGER trg_service_users_updated_at
  BEFORE UPDATE ON public.service_users
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.service_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_users FROM anon;
GRANT ALL ON public.service_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_users TO authenticated;

DROP POLICY IF EXISTS p_service_users_auth_all ON public.service_users;
CREATE POLICY p_service_users_auth_all ON public.service_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. Service User Contacts
CREATE TABLE IF NOT EXISTS public.service_user_contacts (
  id TEXT PRIMARY KEY,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  mobile TEXT,
  alternative_phone TEXT,
  email TEXT,
  preferred_contact_method TEXT DEFAULT 'Mobile',
  emergency_contact_name TEXT,
  emergency_contact_relationship TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_email TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_user_contacts_su_id ON public.service_user_contacts(su_id);

DROP TRIGGER IF EXISTS trg_service_user_contacts_updated_at ON public.service_user_contacts;
CREATE TRIGGER trg_service_user_contacts_updated_at
  BEFORE UPDATE ON public.service_user_contacts
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.service_user_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_user_contacts FROM anon;
GRANT ALL ON public.service_user_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_user_contacts TO authenticated;

DROP POLICY IF EXISTS p_service_user_contacts_auth_all ON public.service_user_contacts;
CREATE POLICY p_service_user_contacts_auth_all ON public.service_user_contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. Service User Household
CREATE TABLE IF NOT EXISTS public.service_user_household (
  id TEXT PRIMARY KEY,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth DATE,
  relationship TEXT NOT NULL,
  gender TEXT,
  contact TEXT,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_user_household_su_id ON public.service_user_household(su_id);

DROP TRIGGER IF EXISTS trg_service_user_household_updated_at ON public.service_user_household;
CREATE TRIGGER trg_service_user_household_updated_at
  BEFORE UPDATE ON public.service_user_household
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.service_user_household ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_user_household FROM anon;
GRANT ALL ON public.service_user_household TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_user_household TO authenticated;

DROP POLICY IF EXISTS p_service_user_household_auth_all ON public.service_user_household;
CREATE POLICY p_service_user_household_auth_all ON public.service_user_household
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. Service User Support
CREATE TABLE IF NOT EXISTS public.service_user_support (
  id TEXT PRIMARY KEY,
  support_reference TEXT,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'Medium',
  start_date DATE,
  end_date DATE,
  assigned_staff TEXT,
  status TEXT DEFAULT 'Open',
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_user_support_su_id ON public.service_user_support(su_id);
CREATE INDEX IF NOT EXISTS idx_service_user_support_status ON public.service_user_support(status);

DROP TRIGGER IF EXISTS trg_service_user_support_updated_at ON public.service_user_support;
CREATE TRIGGER trg_service_user_support_updated_at
  BEFORE UPDATE ON public.service_user_support
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.service_user_support ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_user_support FROM anon;
GRANT ALL ON public.service_user_support TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_user_support TO authenticated;

DROP POLICY IF EXISTS p_service_user_support_auth_all ON public.service_user_support;
CREATE POLICY p_service_user_support_auth_all ON public.service_user_support
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 12. Service User Documents
CREATE TABLE IF NOT EXISTS public.service_user_documents (
  id TEXT PRIMARY KEY,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  reference_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  verification_status TEXT DEFAULT 'Pending',
  storage_reference TEXT,
  file_url TEXT,
  uploaded_by TEXT,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_user_documents_su_id ON public.service_user_documents(su_id);

DROP TRIGGER IF EXISTS trg_service_user_documents_updated_at ON public.service_user_documents;
CREATE TRIGGER trg_service_user_documents_updated_at
  BEFORE UPDATE ON public.service_user_documents
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.service_user_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_user_documents FROM anon;
GRANT ALL ON public.service_user_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_user_documents TO authenticated;

DROP POLICY IF EXISTS p_service_user_documents_auth_all ON public.service_user_documents;
CREATE POLICY p_service_user_documents_auth_all ON public.service_user_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 13. Placements
CREATE TABLE IF NOT EXISTS public.placements (
  id TEXT PRIMARY KEY,
  placement_reference TEXT UNIQUE,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES public.sites(id),
  property_id TEXT NOT NULL REFERENCES public.properties(id),
  room_id TEXT NOT NULL REFERENCES public.property_rooms(id),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Active',
  placement_type TEXT DEFAULT 'Standard',
  reason TEXT,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_placements_su_id ON public.placements(su_id);
CREATE INDEX IF NOT EXISTS idx_placements_site_id ON public.placements(site_id);
CREATE INDEX IF NOT EXISTS idx_placements_property_id ON public.placements(property_id);
CREATE INDEX IF NOT EXISTS idx_placements_room_id ON public.placements(room_id);
CREATE INDEX IF NOT EXISTS idx_placements_status ON public.placements(status);
CREATE INDEX IF NOT EXISTS idx_placements_ref ON public.placements(placement_reference);

DROP TRIGGER IF EXISTS trg_placements_updated_at ON public.placements;
CREATE TRIGGER trg_placements_updated_at
  BEFORE UPDATE ON public.placements
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.placements FROM anon;
GRANT ALL ON public.placements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.placements TO authenticated;

DROP POLICY IF EXISTS p_placements_auth_all ON public.placements;
CREATE POLICY p_placements_auth_all ON public.placements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 14. Master Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM anon;
GRANT ALL ON public.audit_logs TO service_role;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

DROP POLICY IF EXISTS p_audit_logs_auth_select ON public.audit_logs;
CREATE POLICY p_audit_logs_auth_select ON public.audit_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS p_audit_logs_auth_insert ON public.audit_logs;
CREATE POLICY p_audit_logs_auth_insert ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- 15. Operational Tables Linkage
ALTER TABLE public.welfare_checks ADD COLUMN IF NOT EXISTS su_id TEXT REFERENCES public.service_users(id) ON DELETE SET NULL;
ALTER TABLE public.welfare_checks ADD COLUMN IF NOT EXISTS property_id TEXT REFERENCES public.properties(id) ON DELETE SET NULL;
ALTER TABLE public.welfare_checks ADD COLUMN IF NOT EXISTS room_id TEXT REFERENCES public.property_rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_welfare_checks_su_id ON public.welfare_checks(su_id);
CREATE INDEX IF NOT EXISTS idx_welfare_checks_property_id ON public.welfare_checks(property_id);
CREATE INDEX IF NOT EXISTS idx_welfare_checks_room_id ON public.welfare_checks(room_id);

ALTER TABLE public.food_surveys ADD COLUMN IF NOT EXISTS su_id TEXT REFERENCES public.service_users(id) ON DELETE SET NULL;
ALTER TABLE public.food_surveys ADD COLUMN IF NOT EXISTS property_id TEXT REFERENCES public.properties(id) ON DELETE SET NULL;
ALTER TABLE public.food_surveys ADD COLUMN IF NOT EXISTS room_id TEXT REFERENCES public.property_rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_food_surveys_su_id ON public.food_surveys(su_id);
CREATE INDEX IF NOT EXISTS idx_food_surveys_property_id ON public.food_surveys(property_id);
CREATE INDEX IF NOT EXISTS idx_food_surveys_room_id ON public.food_surveys(room_id);

ALTER TABLE public.room_checks ADD COLUMN IF NOT EXISTS su_id TEXT REFERENCES public.service_users(id) ON DELETE SET NULL;
ALTER TABLE public.room_checks ADD COLUMN IF NOT EXISTS property_id TEXT REFERENCES public.properties(id) ON DELETE SET NULL;
ALTER TABLE public.room_checks ADD COLUMN IF NOT EXISTS room_id TEXT REFERENCES public.property_rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_room_checks_su_id ON public.room_checks(su_id);
CREATE INDEX IF NOT EXISTS idx_room_checks_property_id ON public.room_checks(property_id);
CREATE INDEX IF NOT EXISTS idx_room_checks_room_id ON public.room_checks(room_id);

-- =====================================================================
-- Security lockdown (audit 2026-10-08) — see db/migrations/013_restrict_direct_table_access.sql
-- Runs last so it overrides the permissive policies created above on every run.
-- =====================================================================
DO $$
DECLARE
  t TEXT;
  locked_tables TEXT[] := ARRAY[
    'welfare_checks', 'food_surveys', 'food_meal_ratings', 'room_checks', 'room_check_items',
    'properties', 'property_rooms', 'property_facilities', 'property_assets',
    'property_compliance', 'property_documents', 'property_contacts',
    'service_users', 'service_user_contacts', 'service_user_household',
    'service_user_support', 'service_user_documents', 'placements'
  ];
BEGIN
  FOREACH t IN ARRAY locked_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'p_' || t || '_auth_all', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Finance child tables: drop the permissive write-all policy and the anon
-- grant. The site/finance-scoped SELECT policies remain in place.
DO $$
DECLARE
  t TEXT;
  finance_children TEXT[] := ARRAY[
    'finance_bill_items', 'finance_bill_attachments', 'finance_verification_tasks',
    'finance_approval_requests', 'finance_bill_queries', 'finance_reconciliation_records',
    'finance_payment_records', 'finance_bill_status_history', 'finance_workflow_events'
  ];
BEGIN
  FOREACH t IN ARRAY finance_children LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all_policy', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations', 'finance_vendors', 'finance_bills', 'finance_verification_profiles',
    'finance_profile_members', 'finance_routing_rules', 'finance_approval_responses',
    'finance_verification_responses', 'finance_query_responses'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "finance_vendors_manage_policy" ON public.finance_vendors;

-- Legacy audit log: signed-in users could insert entries with any identity.
-- =====================================================================
-- 30. Public Transport Enhancements (014)
-- =====================================================================

-- 30.1. Transport Feedback Table
CREATE TABLE IF NOT EXISTS public.transport_feedback (
  id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  reporting_person TEXT NOT NULL,
  transport_type TEXT NOT NULL DEFAULT 'Aspen',
  pickup_location TEXT,
  drop_location TEXT,
  travel_date DATE,
  travel_time TEXT,
  issue_category TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  impact_level TEXT NOT NULL DEFAULT 'Medium',
  impact_explanation TEXT,
  is_resolved BOOLEAN DEFAULT false,
  resolution_comments TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_feedback_site ON public.transport_feedback(site_name);
CREATE INDEX IF NOT EXISTS idx_transport_feedback_date ON public.transport_feedback(travel_date DESC);
CREATE INDEX IF NOT EXISTS idx_transport_feedback_impact ON public.transport_feedback(impact_level);
CREATE INDEX IF NOT EXISTS idx_transport_feedback_resolved ON public.transport_feedback(is_resolved);

DROP TRIGGER IF EXISTS trg_transport_feedback_updated_at ON public.transport_feedback;
CREATE TRIGGER trg_transport_feedback_updated_at
  BEFORE UPDATE ON public.transport_feedback
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.transport_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transport_feedback FROM anon;
GRANT ALL ON public.transport_feedback TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_feedback TO authenticated;

DROP POLICY IF EXISTS p_transport_feedback_auth_all ON public.transport_feedback;
CREATE POLICY p_transport_feedback_auth_all ON public.transport_feedback
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 30.2. Transport Challenges Table
CREATE TABLE IF NOT EXISTS public.transport_challenges (
  id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  site_manager TEXT,
  reporting_period TEXT NOT NULL,
  guidance_shared BOOLEAN DEFAULT false,
  tracker_in_use BOOLEAN DEFAULT true,
  public_transport_default BOOLEAN DEFAULT true,
  taxi_restricted BOOLEAN DEFAULT true,
  pt_journeys_count INTEGER DEFAULT 0,
  taxi_requests_raised INTEGER DEFAULT 0,
  taxi_requests_approved INTEGER DEFAULT 0,
  taxi_requests_declined INTEGER DEFAULT 0,
  site_challenges TEXT,
  common_issues TEXT,
  team_feedback TEXT,
  has_sg_concerns BOOLEAN DEFAULT false,
  sg_details TEXT,
  comments TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_challenges_site ON public.transport_challenges(site_name);
CREATE INDEX IF NOT EXISTS idx_transport_challenges_period ON public.transport_challenges(reporting_period);

DROP TRIGGER IF EXISTS trg_transport_challenges_updated_at ON public.transport_challenges;
CREATE TRIGGER trg_transport_challenges_updated_at
  BEFORE UPDATE ON public.transport_challenges
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.transport_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transport_challenges FROM anon;
GRANT ALL ON public.transport_challenges TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_challenges TO authenticated;

DROP POLICY IF EXISTS p_transport_challenges_auth_all ON public.transport_challenges;
CREATE POLICY p_transport_challenges_auth_all ON public.transport_challenges
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 30.3. Transport Funding Requests Table
CREATE TABLE IF NOT EXISTS public.transport_funding_requests (
  id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  main_app_ref TEXT NOT NULL,
  main_app_initials TEXT NOT NULL,
  group_member TEXT,
  phone TEXT,
  additional_travellers_count INTEGER DEFAULT 0,
  additional_travellers_reason TEXT,
  children_ages TEXT,
  request_datetime TIMESTAMPTZ DEFAULT NOW(),
  appointment_date DATE,
  appointment_time TEXT,
  evidence_url TEXT,
  accommodation_name TEXT,
  accommodation_address TEXT,
  accommodation_postcode TEXT,
  appointment_address TEXT,
  appointment_postcode TEXT,
  appointment_nature TEXT,
  distance_miles NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  transport_method TEXT DEFAULT 'Public Transport',
  has_aspen BOOLEAN DEFAULT false,
  tickets_required INTEGER DEFAULT 1,
  exceptional_criteria TEXT,
  exceptional_details TEXT,
  status TEXT NOT NULL DEFAULT 'Submitted',
  ho_initials TEXT,
  decision TEXT,
  rejection_reason TEXT,
  approved_transport_method TEXT,
  payment_amount NUMERIC(10,2),
  journey_urn TEXT,
  approved_by TEXT,
  approval_date TIMESTAMPTZ,
  internal_comments TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_funding_site ON public.transport_funding_requests(site_name);
CREATE INDEX IF NOT EXISTS idx_transport_funding_ref ON public.transport_funding_requests(main_app_ref);
CREATE INDEX IF NOT EXISTS idx_transport_funding_status ON public.transport_funding_requests(status);
CREATE INDEX IF NOT EXISTS idx_transport_funding_urn ON public.transport_funding_requests(journey_urn);

DROP TRIGGER IF EXISTS trg_transport_funding_updated_at ON public.transport_funding_requests;
CREATE TRIGGER trg_transport_funding_updated_at
  BEFORE UPDATE ON public.transport_funding_requests
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.transport_funding_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transport_funding_requests FROM anon;
GRANT ALL ON public.transport_funding_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_funding_requests TO authenticated;

DROP POLICY IF EXISTS p_transport_funding_auth_all ON public.transport_funding_requests;
CREATE POLICY p_transport_funding_auth_all ON public.transport_funding_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

