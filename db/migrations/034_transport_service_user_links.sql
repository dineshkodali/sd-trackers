-- =====================================================================
-- Migration 034: link transport records to the Service User they are about
--
-- Until now the transport forms stored the person as typed text (names, "main app ref", occupant ref). This adds nullable
-- id columns so a record points at the actual Service User, and makes sure the room-move table exists.
--
--   * Additive only: nullable columns, no existing value changed, no row removed.
--   * transport_room_move_requests is used by the application (server/schemaAdapter.ts, AppContext) but no earlier migration
--     created it, so it is created here if it is missing (IF NOT EXISTS - an existing table is left alone).
--   * Older records keep their typed text; they simply have no Service User id until someone links them.
--
-- Run in Supabase Dashboard -> SQL Editor. SAFE & IDEMPOTENT: can be re-run.
-- Rollback notes are at the bottom.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.transport_room_move_requests (
  id TEXT PRIMARY KEY,
  su_id TEXT,
  occupant_name TEXT,
  request_id TEXT,
  site_name TEXT,
  current_room TEXT,
  new_room TEXT,
  occupant_ref TEXT,
  requesting_staff TEXT,
  request_date TEXT,
  requested_move_date TEXT,
  preferred_transport_time TEXT,
  people_count INTEGER,
  bags_count INTEGER,
  transport_required BOOLEAN,
  transport_type TEXT,
  move_reason TEXT,
  accessibility_requirements TEXT,
  support_required TEXT,
  estimated_cost NUMERIC,
  approval_required BOOLEAN,
  approval_status TEXT,
  assigned_transport TEXT,
  completion_status TEXT,
  completion_date TEXT,
  staff_comments TEXT,
  notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  attachment_url TEXT,
  file_url TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transport_room_move_requests ADD COLUMN IF NOT EXISTS su_id TEXT;
ALTER TABLE public.transport_room_move_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.transport_room_move_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.transport_room_move_requests ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.transport_room_move_requests ADD COLUMN IF NOT EXISTS occupant_name TEXT;
ALTER TABLE public.public_transport_records      ADD COLUMN IF NOT EXISTS su_ids JSONB;
ALTER TABLE public.transport_feedback            ADD COLUMN IF NOT EXISTS su_id TEXT;
ALTER TABLE public.transport_feedback            ADD COLUMN IF NOT EXISTS su_name TEXT;
ALTER TABLE public.transport_feedback            ADD COLUMN IF NOT EXISTS su_reference TEXT;
ALTER TABLE public.transport_funding_requests    ADD COLUMN IF NOT EXISTS su_id TEXT;

CREATE INDEX IF NOT EXISTS idx_transport_room_move_su ON public.transport_room_move_requests(su_id);
CREATE INDEX IF NOT EXISTS idx_transport_feedback_su ON public.transport_feedback(su_id);
CREATE INDEX IF NOT EXISTS idx_transport_funding_su ON public.transport_funding_requests(su_id);

DROP TRIGGER IF EXISTS trg_transport_room_move_requests_updated_at ON public.transport_room_move_requests;
CREATE TRIGGER trg_transport_room_move_requests_updated_at
  BEFORE UPDATE ON public.transport_room_move_requests
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.transport_room_move_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transport_room_move_requests FROM anon;
GRANT ALL ON public.transport_room_move_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_room_move_requests TO authenticated;

DROP POLICY IF EXISTS p_transport_room_move_requests_auth_all ON public.transport_room_move_requests;
CREATE POLICY p_transport_room_move_requests_auth_all ON public.transport_room_move_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Rollback (typed text on the records is untouched, so nothing is lost):
--   ALTER TABLE public.public_transport_records   DROP COLUMN IF EXISTS su_ids;
--   ALTER TABLE public.transport_feedback         DROP COLUMN IF EXISTS su_id, DROP COLUMN IF EXISTS su_name, DROP COLUMN IF EXISTS su_reference;
--   ALTER TABLE public.transport_funding_requests DROP COLUMN IF EXISTS su_id;
--   (leave transport_room_move_requests in place if it holds data)
-- ---------------------------------------------------------------------
