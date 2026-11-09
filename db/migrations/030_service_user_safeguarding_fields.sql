-- 030: Service User Safeguarding, Evacuation & GP Fields
-- Run in the Supabase SQL Editor after 029. Safe to run more than once.
--
-- Adds essential inspection and safeguarding information to public.service_users:
--  - disability_category: Configurable disability category dropdown
--  - disability_type: Disability detail / specification
--  - vulnerable: 'Yes' / 'No' indicator
--  - personal_evacuation_plan: 'PEEP – Personal Emergency Evacuation Plan' / 'GEEP – General Emergency Evacuation Plan'
--  - gp_registration: Assigned GP Surgery Practice Name (one of 4 surgeries)

ALTER TABLE public.service_users ADD COLUMN IF NOT EXISTS disability_category TEXT DEFAULT 'None';
ALTER TABLE public.service_users ADD COLUMN IF NOT EXISTS disability_type TEXT;
ALTER TABLE public.service_users ADD COLUMN IF NOT EXISTS vulnerable TEXT NOT NULL DEFAULT 'No';
ALTER TABLE public.service_users ADD COLUMN IF NOT EXISTS personal_evacuation_plan TEXT NOT NULL DEFAULT 'GEEP – General Emergency Evacuation Plan';
ALTER TABLE public.service_users ADD COLUMN IF NOT EXISTS gp_registration TEXT;

-- Constraint checks for validated dropdown options
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_users_vulnerable_check') THEN
    ALTER TABLE public.service_users
      ADD CONSTRAINT service_users_vulnerable_check CHECK (vulnerable IN ('Yes', 'No'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_users_pep_check') THEN
    ALTER TABLE public.service_users
      ADD CONSTRAINT service_users_pep_check CHECK (personal_evacuation_plan IN (
        'PEEP – Personal Emergency Evacuation Plan',
        'GEEP – General Emergency Evacuation Plan'
      ));
  END IF;
END $$;

-- Indexes for safeguarding queries, inspection reporting and filtering
CREATE INDEX IF NOT EXISTS idx_service_users_vulnerable ON public.service_users(vulnerable);
CREATE INDEX IF NOT EXISTS idx_service_users_pep ON public.service_users(personal_evacuation_plan);
CREATE INDEX IF NOT EXISTS idx_service_users_disability_cat ON public.service_users(disability_category);
CREATE INDEX IF NOT EXISTS idx_service_users_gp ON public.service_users(gp_registration);

