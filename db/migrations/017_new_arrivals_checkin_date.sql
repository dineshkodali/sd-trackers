-- New arrivals: check-in date
ALTER TABLE public.new_arrivals_records ADD COLUMN IF NOT EXISTS check_in_date TEXT;
NOTIFY pgrst, 'reload schema';
