-- =====================================================================
-- Migration 012: Centralised Service User & Property Management
--
-- Dedicated Tables:
-- 1. public.properties
-- 2. public.property_rooms
-- 3. public.property_facilities
-- 4. public.property_assets
-- 5. public.property_compliance
-- 6. public.property_documents
-- 7. public.property_contacts
-- 8. public.service_users
-- 9. public.service_user_contacts
-- 10. public.service_user_household
-- 11. public.service_user_support
-- 12. public.service_user_documents
-- 13. public.placements
-- 14. public.audit_logs
--
-- Column extensions:
-- - sites: site_code, site_name, address_line_1, address_line_2, county, postcode
-- - welfare_checks, food_surveys, room_checks: su_id, property_id, room_id
-- =====================================================================

-- Auto-update trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Extend existing public.sites table with master fields
-- ---------------------------------------------------------------------
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS site_code TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS site_name TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS address_line_1 TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS address_line_2 TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS county TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS postcode TEXT;

-- Backfill site_name from name where null
UPDATE public.sites SET site_name = name WHERE site_name IS NULL AND name IS NOT NULL;
UPDATE public.sites SET site_code = 'SITE-' || LPAD(SUBSTRING(id FROM '[0-9]+'), 6, '0') WHERE site_code IS NULL AND id ~ '[0-9]+';

-- =====================================================================
-- 1. PROPERTIES TABLE
-- =====================================================================
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

-- =====================================================================
-- 2. PROPERTY ROOMS TABLE
-- =====================================================================
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

-- =====================================================================
-- 3. PROPERTY FACILITIES TABLE
-- =====================================================================
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

-- =====================================================================
-- 4. PROPERTY ASSETS / INVENTORY TABLE
-- =====================================================================
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

-- =====================================================================
-- 5. PROPERTY COMPLIANCE TABLE
-- =====================================================================
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

-- =====================================================================
-- 6. PROPERTY DOCUMENTS TABLE
-- =====================================================================
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

-- =====================================================================
-- 7. PROPERTY CONTACTS TABLE
-- =====================================================================
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

-- =====================================================================
-- 8. SERVICE USERS MASTER TABLE
-- =====================================================================
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

-- =====================================================================
-- 9. SERVICE USER CONTACTS TABLE
-- =====================================================================
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

-- =====================================================================
-- 10. SERVICE USER HOUSEHOLD TABLE
-- =====================================================================
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

-- =====================================================================
-- 11. SERVICE USER SUPPORT TABLE
-- =====================================================================
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

-- =====================================================================
-- 12. SERVICE USER DOCUMENTS TABLE
-- =====================================================================
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

-- =====================================================================
-- 13. PLACEMENTS MASTER TABLE
-- =====================================================================
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

-- =====================================================================
-- 14. MASTER AUDIT LOGS TABLE
-- =====================================================================
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

-- =====================================================================
-- 15. EXTEND OPERATIONAL TABLES (Welfare, Food Surveys, Room Checks)
-- =====================================================================
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

NOTIFY pgrst, 'reload schema';
