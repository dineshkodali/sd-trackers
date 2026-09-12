-- =====================================================================
-- Migration 003: Status page monitoring
--
-- Backs the public status page (/status/) and GET /api/status:
--   status_daily             per-service, per-day check counts (uptime history)
--   status_incidents         incidents, opened automatically by the monitor or by hand
--   status_incident_updates  the timeline of each incident
--   status_maintenance       scheduled maintenance windows
--
-- Only the Express server (service role) reads and writes these tables; the
-- status page receives a sanitised snapshot from the API and never queries
-- them directly. The same block is part of db/schema.sql, so it is applied on
-- server start - run this file by hand only if the boot migration cannot
-- reach the database.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.status_daily (
  service_id TEXT NOT NULL,
  day DATE NOT NULL,
  checks_total INT NOT NULL DEFAULT 0,
  checks_operational INT NOT NULL DEFAULT 0,
  checks_degraded INT NOT NULL DEFAULT 0,
  checks_partial INT NOT NULL DEFAULT 0,
  checks_major INT NOT NULL DEFAULT 0,
  checks_maintenance INT NOT NULL DEFAULT 0,
  avg_latency_ms INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (service_id, day)
);

CREATE TABLE IF NOT EXISTS public.status_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  impact TEXT NOT NULL CHECK (impact IN ('degraded_performance', 'partial_outage', 'major_outage', 'maintenance')),
  status TEXT NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  service_ids TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('auto', 'manual')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_incidents_started ON public.status_incidents(started_at DESC);

CREATE TABLE IF NOT EXISTS public.status_incident_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.status_incidents(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_incident_updates_incident ON public.status_incident_updates(incident_id, created_at);

CREATE TABLE IF NOT EXISTS public.status_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  impact TEXT,
  service_ids TEXT[] NOT NULL DEFAULT '{}',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_status_maintenance_window ON public.status_maintenance(starts_at, ends_at);

-- Adds one monitor cycle to the daily roll-up: one element per service,
-- {"service_id": "...", "status": "...", "latency_ms": 123}.
CREATE OR REPLACE FUNCTION public.status_record_checks(p_day DATE, p_checks JSONB)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO public.status_daily AS d (
    service_id, day, checks_total, checks_operational, checks_degraded,
    checks_partial, checks_major, checks_maintenance, avg_latency_ms, updated_at
  )
  SELECT
    c->>'service_id',
    p_day,
    1,
    (c->>'status' = 'operational')::int,
    (c->>'status' = 'degraded_performance')::int,
    (c->>'status' = 'partial_outage')::int,
    (c->>'status' = 'major_outage')::int,
    (c->>'status' = 'maintenance')::int,
    NULLIF(c->>'latency_ms', '')::int,
    NOW()
  FROM jsonb_array_elements(p_checks) AS c
  ON CONFLICT (service_id, day) DO UPDATE SET
    checks_total = d.checks_total + 1,
    checks_operational = d.checks_operational + EXCLUDED.checks_operational,
    checks_degraded = d.checks_degraded + EXCLUDED.checks_degraded,
    checks_partial = d.checks_partial + EXCLUDED.checks_partial,
    checks_major = d.checks_major + EXCLUDED.checks_major,
    checks_maintenance = d.checks_maintenance + EXCLUDED.checks_maintenance,
    avg_latency_ms = CASE
      WHEN EXCLUDED.avg_latency_ms IS NULL THEN d.avg_latency_ms
      WHEN d.avg_latency_ms IS NULL THEN EXCLUDED.avg_latency_ms
      ELSE ((d.avg_latency_ms::bigint * d.checks_total + EXCLUDED.avg_latency_ms) / (d.checks_total + 1))::int
    END,
    updated_at = NOW();
$$;

DO $$
DECLARE
  status_tables TEXT[] := ARRAY['status_daily', 'status_incidents', 'status_incident_updates', 'status_maintenance'];
  t TEXT;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY status_tables
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      'service_role_all_' || t, t
    );
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.status_record_checks(DATE, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.status_record_checks(DATE, JSONB) TO service_role;

NOTIFY pgrst, 'reload schema';
