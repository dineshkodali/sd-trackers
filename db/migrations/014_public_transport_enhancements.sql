-- =====================================================================
-- Migration 014: Public Transport Module Enhancements
-- 
-- 1. public.transport_feedback (journey feedback / issues)
-- 2. public.transport_challenges (hotel/site monthly operational reporting)
-- 3. public.transport_funding_requests (structured funding request & HO approvals)
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
-- 1. TRANSPORT FEEDBACK TABLE
-- =====================================================================
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

-- =====================================================================
-- 2. TRANSPORT CHALLENGES TABLE
-- =====================================================================
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

-- =====================================================================
-- 3. TRANSPORT FUNDING REQUESTS TABLE
-- =====================================================================
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
