-- =====================================================================
-- Migration 006: Food Wastage Tracker & Live Daily Registers Module Tables
-- =====================================================================

-- 1. Food Wastage Records
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

CREATE INDEX IF NOT EXISTS idx_food_wastage_site ON public.food_wastage_records(site);
CREATE INDEX IF NOT EXISTS idx_food_wastage_date ON public.food_wastage_records(date);

DROP TRIGGER IF EXISTS trg_food_wastage_records_updated_at ON public.food_wastage_records;
CREATE TRIGGER trg_food_wastage_records_updated_at
  BEFORE UPDATE ON public.food_wastage_records
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.food_wastage_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.food_wastage_records FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_wastage_records TO authenticated;

DROP POLICY IF EXISTS p_food_wastage_auth_all ON public.food_wastage_records;
CREATE POLICY p_food_wastage_auth_all ON public.food_wastage_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Daily Register Rooms (Room List & Static Inventory)
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

CREATE INDEX IF NOT EXISTS idx_reg_rooms_hotel ON public.daily_register_rooms(hotel);
CREATE INDEX IF NOT EXISTS idx_reg_rooms_room_no ON public.daily_register_rooms(room_no);

DROP TRIGGER IF EXISTS trg_daily_register_rooms_updated_at ON public.daily_register_rooms;
CREATE TRIGGER trg_daily_register_rooms_updated_at
  BEFORE UPDATE ON public.daily_register_rooms
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.daily_register_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_register_rooms FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_register_rooms TO authenticated;

DROP POLICY IF EXISTS p_daily_register_rooms_auth_all ON public.daily_register_rooms;
CREATE POLICY p_daily_register_rooms_auth_all ON public.daily_register_rooms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Daily Register Records (Occupancy & Resident Roster)
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

CREATE INDEX IF NOT EXISTS idx_reg_records_hotel ON public.daily_register_records(hotel);
CREATE INDEX IF NOT EXISTS idx_reg_records_room_no ON public.daily_register_records(room_no);
CREATE INDEX IF NOT EXISTS idx_reg_records_port_ref ON public.daily_register_records(port_ref);
CREATE INDEX IF NOT EXISTS idx_reg_records_name ON public.daily_register_records(name);
CREATE INDEX IF NOT EXISTS idx_reg_records_reg_date ON public.daily_register_records(register_date);

DROP TRIGGER IF EXISTS trg_daily_register_records_updated_at ON public.daily_register_records;
CREATE TRIGGER trg_daily_register_records_updated_at
  BEFORE UPDATE ON public.daily_register_records
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.daily_register_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_register_records FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_register_records TO authenticated;

DROP POLICY IF EXISTS p_daily_register_records_auth_all ON public.daily_register_records;
CREATE POLICY p_daily_register_records_auth_all ON public.daily_register_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. New Arrivals Records
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

CREATE INDEX IF NOT EXISTS idx_arrivals_hotel ON public.new_arrivals_records(hotel);
CREATE INDEX IF NOT EXISTS idx_arrivals_port_ref ON public.new_arrivals_records(port_reference);

DROP TRIGGER IF EXISTS trg_new_arrivals_records_updated_at ON public.new_arrivals_records;
CREATE TRIGGER trg_new_arrivals_records_updated_at
  BEFORE UPDATE ON public.new_arrivals_records
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.new_arrivals_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.new_arrivals_records FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.new_arrivals_records TO authenticated;

DROP POLICY IF EXISTS p_new_arrivals_records_auth_all ON public.new_arrivals_records;
CREATE POLICY p_new_arrivals_records_auth_all ON public.new_arrivals_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Eviction Records
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

CREATE INDEX IF NOT EXISTS idx_evictions_hotel ON public.eviction_records(hotel);
CREATE INDEX IF NOT EXISTS idx_evictions_port_ref ON public.eviction_records(port_ref);

DROP TRIGGER IF EXISTS trg_eviction_records_updated_at ON public.eviction_records;
CREATE TRIGGER trg_eviction_records_updated_at
  BEFORE UPDATE ON public.eviction_records
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.eviction_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eviction_records FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eviction_records TO authenticated;

DROP POLICY IF EXISTS p_eviction_records_auth_all ON public.eviction_records;
CREATE POLICY p_eviction_records_auth_all ON public.eviction_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
