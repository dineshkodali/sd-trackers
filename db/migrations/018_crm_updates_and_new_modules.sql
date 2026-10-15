-- =====================================================================
-- Migration 018: CRM Updates & New Modules
--
-- 1. Updates to existing tables:
--    - maintenance_records (reported_time, actual_closed_time, before/after pictures)
--    - dispersal_records (type_of_dispersal)
--    - ir_records (witnesses)
--    - referrals (further_updates)
--    - role_permissions (enable can_edit_records for Staff)
-- 2. New Dedicated Modules:
--    - public.mh_complaint_welfare_checks
--    - public.daily_laundry_logs
--    - public.housekeeping_logs
--    - public.housekeeping_room_logs
--    - public.food_consumption_reports
--    - public.food_box_requests
-- =====================================================================

-- 1. Maintenance & Defect Management Updates
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS reported_time TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS actual_closed_time TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS before_picture_url TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS before_picture_date TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS after_picture_url TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS after_picture_date TEXT;

-- 2. Dispersal Sheet Type of Dispersal Update
ALTER TABLE public.dispersal_records ADD COLUMN IF NOT EXISTS type_of_dispersal TEXT DEFAULT 'Dispersal';

-- 3. IR Tracker Witnesses Update
ALTER TABLE public.ir_records ADD COLUMN IF NOT EXISTS witnesses TEXT;

-- 4. Safeguarding Referrals Ongoing Updates
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS further_updates TEXT;

-- 5. Staff Role Permissions: Enable Edit Records
UPDATE public.role_permissions 
SET can_edit_records = TRUE, updated_at = NOW() 
WHERE id = 'Staff' OR role = 'Staff';

-- 6. MH-Complaint Welfare Checks Table
CREATE TABLE IF NOT EXISTS public.mh_complaint_welfare_checks (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  site_name TEXT NOT NULL,
  room_or_flat_no TEXT,
  name TEXT NOT NULL,
  dob TEXT,
  port_or_nass_ref TEXT,
  mh_ticket_ref TEXT NOT NULL,
  complaint_category TEXT,
  complaint_details TEXT NOT NULL,
  action_taken TEXT,
  status TEXT DEFAULT 'Open',
  duty_staff TEXT,
  notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  attachment_url TEXT,
  file_url TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mhc_welfare_site ON public.mh_complaint_welfare_checks(site_name);
CREATE INDEX IF NOT EXISTS idx_mhc_welfare_date ON public.mh_complaint_welfare_checks(date);
CREATE INDEX IF NOT EXISTS idx_mhc_welfare_ticket ON public.mh_complaint_welfare_checks(mh_ticket_ref);

-- 7. Daily Laundry Logs Table
CREATE TABLE IF NOT EXISTS public.daily_laundry_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  site TEXT NOT NULL,
  house TEXT,
  room_no TEXT NOT NULL,
  quantity_received TEXT NOT NULL,
  batches TEXT NOT NULL DEFAULT '1',
  done_by TEXT NOT NULL,
  remarks TEXT,
  logged_by TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  attachment_url TEXT,
  file_url TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_laundry_site ON public.daily_laundry_logs(site);
CREATE INDEX IF NOT EXISTS idx_daily_laundry_date ON public.daily_laundry_logs(date);
CREATE INDEX IF NOT EXISTS idx_daily_laundry_room ON public.daily_laundry_logs(room_no);

-- 8. Housekeeping Logs Table (Daily Communal Checklist)
CREATE TABLE IF NOT EXISTS public.housekeeping_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  site TEXT NOT NULL,
  communal_areas_swept_mopped BOOLEAN DEFAULT true,
  windows_wiped BOOLEAN DEFAULT true,
  furniture_dusted BOOLEAN DEFAULT true,
  staff_toilets_cleaned BOOLEAN DEFAULT true,
  mirrors_cleaned BOOLEAN DEFAULT true,
  fridges_cleaned BOOLEAN DEFAULT false,
  lifts_stairs_cleaned BOOLEAN DEFAULT false,
  offices_cleaned BOOLEAN DEFAULT false,
  inspected_by TEXT NOT NULL,
  notes TEXT,
  room_logs JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  attachment_url TEXT,
  file_url TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_housekeeping_site ON public.housekeeping_logs(site);
CREATE INDEX IF NOT EXISTS idx_housekeeping_date ON public.housekeeping_logs(date);

-- 9. Housekeeping Room Logs Table (Individual Room Cleaning Lines)
CREATE TABLE IF NOT EXISTS public.housekeeping_room_logs (
  id TEXT PRIMARY KEY,
  housekeeping_id TEXT REFERENCES public.housekeeping_logs(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  site TEXT NOT NULL,
  room_no TEXT NOT NULL,
  shower_heads BOOLEAN DEFAULT true,
  bedding BOOLEAN DEFAULT true,
  washroom BOOLEAN DEFAULT true,
  floor BOOLEAN DEFAULT true,
  cleaned_by TEXT NOT NULL,
  notes TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_housekeeping_room_site ON public.housekeeping_room_logs(site);
CREATE INDEX IF NOT EXISTS idx_housekeeping_room_date ON public.housekeeping_room_logs(date);

-- 10. Food Consumption Daily Reports Table
CREATE TABLE IF NOT EXISTS public.food_consumption_reports (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  site TEXT NOT NULL,
  feedback_comments TEXT,
  reported_by TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  attachment_url TEXT,
  file_url TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_consumption_site ON public.food_consumption_reports(site);
CREATE INDEX IF NOT EXISTS idx_food_consumption_date ON public.food_consumption_reports(date);

-- 11. Food Box Requests & Complaints Table
CREATE TABLE IF NOT EXISTS public.food_box_requests (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  site TEXT NOT NULL,
  room_no TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Request',
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  logged_by TEXT,
  remarks TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  attachment_url TEXT,
  file_url TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_box_site ON public.food_box_requests(site);
CREATE INDEX IF NOT EXISTS idx_food_box_date ON public.food_box_requests(date);
CREATE INDEX IF NOT EXISTS idx_food_box_room ON public.food_box_requests(room_no);

-- Enable Row Level Security (RLS) on all new tables
ALTER TABLE public.mh_complaint_welfare_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_laundry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_room_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_consumption_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_box_requests ENABLE ROW LEVEL SECURITY;

-- Allow full access for authenticated users (governed by application RBAC & role permissions)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users mh_complaint_welfare_checks' AND tablename = 'mh_complaint_welfare_checks') THEN
    CREATE POLICY "Allow authenticated users mh_complaint_welfare_checks" ON public.mh_complaint_welfare_checks FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users daily_laundry_logs' AND tablename = 'daily_laundry_logs') THEN
    CREATE POLICY "Allow authenticated users daily_laundry_logs" ON public.daily_laundry_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users housekeeping_logs' AND tablename = 'housekeeping_logs') THEN
    CREATE POLICY "Allow authenticated users housekeeping_logs" ON public.housekeeping_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users housekeeping_room_logs' AND tablename = 'housekeeping_room_logs') THEN
    CREATE POLICY "Allow authenticated users housekeeping_room_logs" ON public.housekeeping_room_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users food_consumption_reports' AND tablename = 'food_consumption_reports') THEN
    CREATE POLICY "Allow authenticated users food_consumption_reports" ON public.food_consumption_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users food_box_requests' AND tablename = 'food_box_requests') THEN
    CREATE POLICY "Allow authenticated users food_box_requests" ON public.food_box_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
