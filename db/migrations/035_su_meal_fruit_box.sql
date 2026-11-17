-- Fruit Box is a fourth daily meal slot in su_meal_records (one row per SU, date and meal).
-- Only the meal_period CHECK changes: existing rows, history, triggers and RLS are untouched.
ALTER TABLE public.su_meal_records DROP CONSTRAINT IF EXISTS su_meal_period;
ALTER TABLE public.su_meal_records
  ADD CONSTRAINT su_meal_period CHECK (meal_period IN ('Breakfast', 'Lunch', 'Dinner', 'Fruit Box'));
