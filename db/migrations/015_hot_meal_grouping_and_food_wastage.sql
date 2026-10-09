-- =====================================================================
-- Migration 015: Hot Meal Grouping, Daily Counts & Food Wastage Enhancements
--
-- 1. Updates public.food_wastage_records to support:
--    - meal_type (Breakfast, Lunch, Dinner)
--    - unit (kg, grams, litres, portions, trays)
--    - items (structured JSONB array of { foodItem, quantity, unit, remarks })
-- 2. Indexes for meal_type querying and filtering
-- =====================================================================

-- 1. Add columns to food_wastage_records if not exist
ALTER TABLE public.food_wastage_records
  ADD COLUMN IF NOT EXISTS meal_type TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 2. Create index on meal_type for performant filtering
CREATE INDEX IF NOT EXISTS idx_food_wastage_meal_type ON public.food_wastage_records(meal_type);

-- 3. Ensure permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_wastage_records TO authenticated;
GRANT ALL ON public.food_wastage_records TO service_role;
