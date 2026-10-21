-- =====================================================================
-- 020: GP registrations, PEEP plans, SU attendance and absence follow-ups
--
-- Design notes
--  * service_users.id is TEXT in this database, so every su_id here is TEXT with a foreign key to
--    public.service_users(id). (A UUID column could not reference it.)
--  * Name, DOB, port reference and room are NOT copied into these tables: they are read from the Service User
--    master / active placement, so a change there shows everywhere without a second update.
--  * Sensitive tables are granted to signed-in users only (role "authenticated"), never to "anon".
--  * Safe to re-run. Nothing here changes or deletes existing data.
--
-- Rollback (only if nothing has been recorded yet):
--   DROP TABLE IF EXISTS public.absence_followups, public.su_attendance_records,
--     public.peep_plan_history, public.peep_plans, public.gp_registrations;
-- =====================================================================

-- ---------------------------------------------------------------------
-- GP registrations: one current registration per Service User
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gp_registrations (
  id TEXT PRIMARY KEY,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  gp_practice TEXT,
  pharmacy TEXT,
  nhs_number TEXT,
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gp_registrations_one_per_su UNIQUE (su_id),
  -- NHS numbers are kept as text; when given they must be 10 digits (spaces allowed)
  CONSTRAINT gp_registrations_nhs_format CHECK (nhs_number IS NULL OR nhs_number = '' OR regexp_replace(nhs_number, '\s', '', 'g') ~ '^[0-9]{10}$')
);
CREATE INDEX IF NOT EXISTS idx_gp_registrations_su ON public.gp_registrations(su_id);

-- ---------------------------------------------------------------------
-- PEEP plans (Personal Emergency Evacuation Plan) and their change history
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.peep_plans (
  id TEXT PRIMARY KEY,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  mobility_type TEXT,
  risk_level TEXT NOT NULL,
  companion TEXT,
  emergency_alarm TEXT,
  assistance TEXT,
  evacuation_procedure TEXT,
  safe_exit_routes TEXT,
  developed_by TEXT,
  plan_date DATE,
  review_date DATE,
  last_reviewed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Active',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT peep_plans_risk_level CHECK (risk_level IN ('Low', 'Medium', 'High')),
  CONSTRAINT peep_plans_status CHECK (status IN ('Active', 'Archived'))
);
CREATE INDEX IF NOT EXISTS idx_peep_plans_su ON public.peep_plans(su_id);
CREATE INDEX IF NOT EXISTS idx_peep_plans_review ON public.peep_plans(review_date);
-- Only one active plan per resident
CREATE UNIQUE INDEX IF NOT EXISTS uq_peep_plans_one_active_per_su ON public.peep_plans(su_id) WHERE status = 'Active';

CREATE TABLE IF NOT EXISTS public.peep_plan_history (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  su_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  change_type TEXT NOT NULL,            -- Created | Updated | Reviewed | Archived
  snapshot JSONB NOT NULL,              -- the plan as it was saved
  changed_fields TEXT,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_peep_history_plan ON public.peep_plan_history(plan_id, changed_at DESC);

-- ---------------------------------------------------------------------
-- Attendance: one record per resident per day. No record = "Not recorded", never an absence.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.su_attendance_records (
  id TEXT PRIMARY KEY,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  attendance_status TEXT NOT NULL,
  additional_notes TEXT,
  recorded_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT su_attendance_status CHECK (attendance_status IN ('Present', 'Absent')),
  CONSTRAINT su_attendance_one_per_day UNIQUE (su_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_su_attendance_date ON public.su_attendance_records(attendance_date);
CREATE INDEX IF NOT EXISTS idx_su_attendance_su_date ON public.su_attendance_records(su_id, attendance_date DESC);

-- ---------------------------------------------------------------------
-- Absence follow-ups: persistent, one per absence episode and threshold
-- (episode = the resident + the first day of the unbroken run of recorded absences)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.absence_followups (
  id TEXT PRIMARY KEY,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  absence_start_date DATE NOT NULL,
  threshold_days INTEGER NOT NULL,
  threshold_reached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consecutive_days INTEGER,
  status TEXT NOT NULL DEFAULT 'Open',
  assigned_to TEXT,
  follow_up_notes TEXT,
  action_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  due_date DATE,
  last_action_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT absence_followups_status CHECK (status IN ('Open', 'In Progress', 'Resolved')),
  CONSTRAINT absence_followups_threshold CHECK (threshold_days > 0),
  CONSTRAINT absence_followups_one_per_episode UNIQUE (su_id, absence_start_date, threshold_days)
);
CREATE INDEX IF NOT EXISTS idx_absence_followups_status ON public.absence_followups(status);

-- ---------------------------------------------------------------------
-- updated_at triggers, RLS and access (signed-in users only)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['gp_registrations', 'peep_plans', 'peep_plan_history', 'su_attendance_records', 'absence_followups'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF t <> 'peep_plan_history' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || t || '_updated_at', t);
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column()', 'trg_' || t || '_updated_at', t);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT ALL ON public.%I TO authenticated, service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'auth_all_' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', 'auth_all_' || t, t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
