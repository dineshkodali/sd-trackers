-- =====================================================================
-- Migration 011: Welfare Checks, Food Survey Checks & Room Checks
--
-- Dedicated Tables:
-- 1. public.welfare_checks
-- 2. public.food_surveys
-- 3. public.food_meal_ratings (child table: 7 days x 3 meals = 21 ratings)
-- 4. public.room_checks
-- 5. public.room_check_items  (child table: 30 inspection questions)
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
-- 1. WELFARE CHECKS TABLE
-- =====================================================================
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

-- =====================================================================
-- 2. FOOD SURVEYS TABLE
-- =====================================================================
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

-- =====================================================================
-- 3. FOOD MEAL RATINGS (Child Table for 21 Meal Ratings Matrix)
-- =====================================================================
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

-- =====================================================================
-- 4. ROOM CHECKS TABLE
-- =====================================================================
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

-- =====================================================================
-- 5. ROOM CHECK ITEMS (Child Table for 30 Inspection Questions)
-- =====================================================================
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

NOTIFY pgrst, 'reload schema';
