-- =====================================================================
-- 022: Transport funding requests - six-stage workflow, enforced in the database
--
--   1 Draft -> 2 Submitted -> 3 Under Review -> 4 Decision (Approved / Rejected / Clarification Required)
--     -> 5 Issued -> 6 Completed          (Cancelled is an exit; Rejected and Completed are final)
--
--  * Status and every decision/issue/completion column can change only through transition_transport_funding():
--    a trigger refuses any other change, including calls straight to the generic API.
--  * The function checks the role, the move, required fields, and that nobody decides their own request.
--  * Every status change is written to transport_funding_status_history by the function (append-only).
--  * Once a request leaves Draft / Clarification Required its content is locked; only attachments and notes JSON can change.
--  * Only Draft or Cancelled requests can be deleted.
--  * Additive and safe to re-run. Existing rows are left as they are (the status check is NOT VALID, so old values do not block it).
--
-- Rollback (only if nothing has been recorded yet):
--   DROP FUNCTION IF EXISTS public.transition_transport_funding(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB);
--   DROP TRIGGER IF EXISTS trg_transport_funding_guard ON public.transport_funding_requests;
--   DROP TRIGGER IF EXISTS trg_transport_funding_delete_guard ON public.transport_funding_requests;
--   DROP TABLE IF EXISTS public.transport_funding_status_history;
-- =====================================================================

ALTER TABLE public.transport_funding_requests ADD COLUMN IF NOT EXISTS requested_by_id TEXT;
ALTER TABLE public.transport_funding_requests ADD COLUMN IF NOT EXISTS requested_by TEXT;
ALTER TABLE public.transport_funding_requests ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.transport_funding_requests ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE public.transport_funding_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.transport_funding_requests ADD COLUMN IF NOT EXISTS issued_by TEXT;
ALTER TABLE public.transport_funding_requests ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;
ALTER TABLE public.transport_funding_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.transport_funding_requests ADD COLUMN IF NOT EXISTS completion_notes TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transport_funding_status_check') THEN
    ALTER TABLE public.transport_funding_requests ADD CONSTRAINT transport_funding_status_check
      CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Clarification Required', 'Approved', 'Rejected', 'Issued', 'Completed', 'Cancelled')) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.transport_funding_status_history (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES public.transport_funding_requests(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  changed_by_id TEXT,
  changed_by TEXT,
  changed_role TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tf_history_request ON public.transport_funding_status_history(request_id, changed_at);

-- Columns that only the workflow may change; the rest of the request is editable only while it is a draft or awaiting clarification
CREATE OR REPLACE FUNCTION public.transport_funding_guard() RETURNS TRIGGER AS $$
DECLARE
  in_workflow BOOLEAN := COALESCE(current_setting('app.funding_workflow', true), '') = 'on';
  open_keys TEXT[] := ARRAY['updated_at', 'attachments', 'attachment_url', 'file_url', 'data'];
  locked_keys TEXT[] := ARRAY['status', 'ho_initials', 'decision', 'rejection_reason', 'approved_transport_method', 'payment_amount', 'journey_urn',
    'approved_by', 'approval_date', 'internal_comments', 'requested_by_id', 'requested_by', 'submitted_at', 'reviewed_by', 'reviewed_at',
    'issued_by', 'issued_at', 'completed_at', 'completion_notes'];
  new_j JSONB; old_j JSONB;
  locked_new JSONB; locked_old JSONB; content_new JSONB; content_old JSONB;
BEGIN
  IF in_workflow THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('Draft', 'Submitted') THEN
      RAISE EXCEPTION 'A funding request can only be created as a draft or submitted' USING ERRCODE = '42501';
    END IF;
    IF NEW.decision IS NOT NULL OR NEW.approved_by IS NOT NULL OR NEW.journey_urn IS NOT NULL OR NEW.payment_amount IS NOT NULL
       OR NEW.rejection_reason IS NOT NULL OR NEW.approved_transport_method IS NOT NULL OR NEW.ho_initials IS NOT NULL
       OR NEW.internal_comments IS NOT NULL OR NEW.issued_at IS NOT NULL OR NEW.completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Decision details can only be set through the approval workflow' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  new_j := to_jsonb(NEW); old_j := to_jsonb(OLD);
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO locked_new FROM jsonb_each(new_j) e(k, v) WHERE k = ANY(locked_keys);
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO locked_old FROM jsonb_each(old_j) e(k, v) WHERE k = ANY(locked_keys);
  IF locked_new IS DISTINCT FROM locked_old THEN
    RAISE EXCEPTION 'Status and decision details can only be changed through the approval workflow' USING ERRCODE = '42501';
  END IF;

  IF OLD.status NOT IN ('Draft', 'Clarification Required') THEN
    SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO content_new FROM jsonb_each(new_j) e(k, v) WHERE k <> ALL(locked_keys) AND k <> ALL(open_keys);
    SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO content_old FROM jsonb_each(old_j) e(k, v) WHERE k <> ALL(locked_keys) AND k <> ALL(open_keys);
    IF content_new IS DISTINCT FROM content_old THEN
      RAISE EXCEPTION 'This request can no longer be edited (status: %)', OLD.status USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_transport_funding_guard ON public.transport_funding_requests;
CREATE TRIGGER trg_transport_funding_guard BEFORE INSERT OR UPDATE ON public.transport_funding_requests
  FOR EACH ROW EXECUTE PROCEDURE public.transport_funding_guard();

-- First history row when a request is created
CREATE OR REPLACE FUNCTION public.transport_funding_created_history() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.transport_funding_status_history (id, request_id, from_status, to_status, note, changed_by_id, changed_by)
  VALUES ('tfh-' || gen_random_uuid()::text, NEW.id, NULL, NEW.status, 'Request created', NEW.requested_by_id, NEW.requested_by);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_transport_funding_created_history ON public.transport_funding_requests;
CREATE TRIGGER trg_transport_funding_created_history AFTER INSERT ON public.transport_funding_requests
  FOR EACH ROW EXECUTE PROCEDURE public.transport_funding_created_history();

CREATE OR REPLACE FUNCTION public.transport_funding_delete_guard() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status NOT IN ('Draft', 'Cancelled') THEN
    RAISE EXCEPTION 'Only a draft or cancelled request can be deleted' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_transport_funding_delete_guard ON public.transport_funding_requests;
CREATE TRIGGER trg_transport_funding_delete_guard BEFORE DELETE ON public.transport_funding_requests
  FOR EACH ROW EXECUTE PROCEDURE public.transport_funding_delete_guard();

-- The single way to move a request between stages. p_fields: approvedTransportMethod, paymentAmount, journeyUrn, completionNotes.
CREATE OR REPLACE FUNCTION public.transition_transport_funding(p_id TEXT, p_to TEXT, p_note TEXT, p_user_id TEXT, p_user_name TEXT, p_role TEXT, p_fields JSONB)
RETURNS public.transport_funding_requests AS $$
DECLARE
  r public.transport_funding_requests;
  deciders TEXT[] := ARRAY['Super Admin', 'Admin', 'Regional Manager'];
  reviewers TEXT[] := ARRAY['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager'];
  site_roles TEXT[] := ARRAY['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager', 'Staff'];
  note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  f JSONB := COALESCE(p_fields, '{}'::jsonb);
  allowed BOOLEAN := FALSE;
  by_requester BOOLEAN;
  old_status TEXT;
BEGIN
  SELECT * INTO r FROM public.transport_funding_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funding request not found' USING ERRCODE = 'P0002'; END IF;
  old_status := r.status;
  by_requester := r.requested_by_id IS NOT NULL AND r.requested_by_id = p_user_id;

  -- the move itself, and who may make it
  IF r.status = 'Draft' AND p_to = 'Submitted' THEN allowed := p_role = ANY(site_roles);
  ELSIF r.status = 'Clarification Required' AND p_to = 'Submitted' THEN allowed := p_role = ANY(site_roles);
  ELSIF r.status = 'Submitted' AND p_to = 'Under Review' THEN allowed := p_role = ANY(reviewers);
  ELSIF r.status = 'Under Review' AND p_to IN ('Approved', 'Rejected', 'Clarification Required') THEN
    allowed := p_role = ANY(deciders);
    IF allowed AND by_requester THEN RAISE EXCEPTION 'You cannot decide a request you raised yourself' USING ERRCODE = '42501'; END IF;
  ELSIF r.status = 'Approved' AND p_to = 'Issued' THEN allowed := p_role = ANY(site_roles);
  ELSIF r.status = 'Issued' AND p_to = 'Completed' THEN allowed := p_role = ANY(site_roles);
  ELSIF r.status IN ('Draft', 'Submitted', 'Clarification Required') AND p_to = 'Cancelled' THEN allowed := by_requester OR p_role = ANY(deciders);
  ELSIF r.status IN ('Approved', 'Issued') AND p_to = 'Cancelled' THEN allowed := p_role = ANY(deciders);
  ELSE
    RAISE EXCEPTION 'A % request cannot move to %', r.status, p_to USING ERRCODE = '23505';
  END IF;
  IF NOT allowed THEN RAISE EXCEPTION 'Your role cannot make this change' USING ERRCODE = '42501'; END IF;

  -- required details
  IF p_to IN ('Rejected', 'Clarification Required') AND (note IS NULL OR length(note) < 3) THEN RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023'; END IF;
  IF r.status IN ('Approved', 'Issued') AND p_to = 'Cancelled' AND (note IS NULL OR length(note) < 3) THEN RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023'; END IF;
  IF p_to = 'Approved' THEN
    IF NULLIF(btrim(COALESCE(f ->> 'approvedTransportMethod', '')), '') IS NULL THEN RAISE EXCEPTION 'The approved transport method is required' USING ERRCODE = '22023'; END IF;
    IF NOT (COALESCE(f ->> 'paymentAmount', '') ~ '^[0-9]+(\.[0-9]{1,2})?$') THEN RAISE EXCEPTION 'The approved amount must be a number of zero or more' USING ERRCODE = '22023'; END IF;
  END IF;
  IF p_to = 'Issued' AND NULLIF(btrim(COALESCE(f ->> 'journeyUrn', '')), '') IS NULL THEN RAISE EXCEPTION 'The travelcard or journey reference is required' USING ERRCODE = '22023'; END IF;

  PERFORM set_config('app.funding_workflow', 'on', true);
  UPDATE public.transport_funding_requests SET
    status = p_to,
    submitted_at = CASE WHEN p_to = 'Submitted' THEN NOW() ELSE submitted_at END,
    reviewed_by = CASE WHEN p_to = 'Under Review' THEN p_user_name ELSE reviewed_by END,
    reviewed_at = CASE WHEN p_to = 'Under Review' THEN NOW() ELSE reviewed_at END,
    decision = CASE WHEN p_to IN ('Approved', 'Rejected', 'Clarification Required') THEN p_to ELSE decision END,
    approved_by = CASE WHEN p_to = 'Approved' THEN p_user_name ELSE approved_by END,
    approval_date = CASE WHEN p_to IN ('Approved', 'Rejected') THEN NOW() ELSE approval_date END,
    approved_transport_method = CASE WHEN p_to = 'Approved' THEN btrim(f ->> 'approvedTransportMethod') ELSE approved_transport_method END,
    payment_amount = CASE WHEN p_to = 'Approved' THEN (f ->> 'paymentAmount')::numeric ELSE payment_amount END,
    rejection_reason = CASE WHEN p_to IN ('Rejected', 'Clarification Required') THEN note ELSE rejection_reason END,
    journey_urn = CASE WHEN p_to = 'Issued' THEN btrim(f ->> 'journeyUrn') ELSE journey_urn END,
    issued_by = CASE WHEN p_to = 'Issued' THEN p_user_name ELSE issued_by END,
    issued_at = CASE WHEN p_to = 'Issued' THEN NOW() ELSE issued_at END,
    completed_at = CASE WHEN p_to = 'Completed' THEN NOW() ELSE completed_at END,
    completion_notes = CASE WHEN p_to = 'Completed' THEN NULLIF(btrim(COALESCE(f ->> 'completionNotes', '')), '') ELSE completion_notes END
  WHERE id = p_id RETURNING * INTO r;
  PERFORM set_config('app.funding_workflow', 'off', true);

  INSERT INTO public.transport_funding_status_history (id, request_id, from_status, to_status, note, changed_by_id, changed_by, changed_role)
  VALUES ('tfh-' || gen_random_uuid()::text, p_id, old_status, p_to, note, p_user_id, p_user_name, p_role);
  RETURN r;
END; $$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.transition_transport_funding(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_transport_funding(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO service_role;

ALTER TABLE public.transport_funding_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transport_funding_status_history FROM anon, authenticated;
GRANT ALL ON public.transport_funding_status_history TO service_role;

NOTIFY pgrst, 'reload schema';
