-- =====================================================================
-- 021: HC2, Oyster cards, per-SU meals, education, family groups, SU archive approval
--
-- Design notes
--  * service_users.id is TEXT, so every su_id is TEXT with a foreign key to public.service_users(id).
--  * Additive only: new tables, new columns with defaults, new triggers/functions. No data is changed or deleted.
--  * All new tables are reachable only by the server (service_role); the browser goes through /api, which enforces
--    roles and site scope (same model as migration 013).
--  * Archive approval is enforced IN THE DATABASE: a trigger on service_users refuses any change to status
--    'Archived' / archive_status unless it is made by the request/decision functions below, and those functions
--    refuse a decision by the requester. The functions run in one transaction and lock the rows they change.
--  * Safe to re-run.
--
-- Rollback (only if nothing has been recorded yet):
--   DROP FUNCTION IF EXISTS public.replace_oyster_card(TEXT,TEXT,TEXT,TEXT,TEXT);
--   DROP FUNCTION IF EXISTS public.request_su_archive(TEXT,TEXT,TEXT,TEXT,TEXT);
--   DROP FUNCTION IF EXISTS public.decide_su_archive_request(TEXT,TEXT,TEXT,TEXT,TEXT);
--   DROP TRIGGER IF EXISTS trg_service_users_archive_guard ON public.service_users;
--   DROP TABLE IF EXISTS public.su_archive_requests, public.family_members, public.family_groups,
--     public.su_education_details, public.su_meal_record_history, public.su_meal_records,
--     public.oyster_card_events, public.oyster_cards, public.su_hc2_details;
--   ALTER TABLE public.service_users DROP COLUMN IF EXISTS archive_status, DROP COLUMN IF EXISTS archived_at,
--     DROP COLUMN IF EXISTS archived_pre_status;
-- =====================================================================

-- ---------------------------------------------------------------------
-- service_users: archive state, kept separate from the operational status
-- ---------------------------------------------------------------------
ALTER TABLE public.service_users ADD COLUMN IF NOT EXISTS archive_status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.service_users ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE public.service_users ADD COLUMN IF NOT EXISTS archived_pre_status TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_users_archive_status_check') THEN
    ALTER TABLE public.service_users ADD CONSTRAINT service_users_archive_status_check
      CHECK (archive_status IN ('Active', 'Pending approval', 'Archived', 'Restoration pending'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_service_users_archive_status ON public.service_users(archive_status);

-- ---------------------------------------------------------------------
-- Feature 1: HC2 details (one current record per SU). Document lives in a private bucket.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.su_hc2_details (
  id TEXT PRIMARY KEY,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  reference_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'Not applied',
  notes TEXT,
  document_path TEXT,
  document_name TEXT,
  document_uploaded_at TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT su_hc2_one_per_su UNIQUE (su_id),
  CONSTRAINT su_hc2_status CHECK (status IN ('Not applied', 'Applied', 'Issued', 'Active', 'Expired', 'Rejected', 'Renewal due')),
  CONSTRAINT su_hc2_dates CHECK (issue_date IS NULL OR expiry_date IS NULL OR expiry_date >= issue_date)
);
CREATE INDEX IF NOT EXISTS idx_su_hc2_expiry ON public.su_hc2_details(expiry_date);

-- ---------------------------------------------------------------------
-- Feature 2: Oyster cards. Every card issue is its own row; history is never overwritten.
-- Balance is a manual record only (no integration exists to verify it).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oyster_cards (
  id TEXT PRIMARY KEY,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  card_ref TEXT NOT NULL,
  issued_date DATE NOT NULL,
  issued_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Issued',
  recorded_balance NUMERIC(8,2),
  balance_recorded_at TIMESTAMPTZ,
  notes TEXT,
  replaces_card_id TEXT REFERENCES public.oyster_cards(id) ON DELETE SET NULL,
  replacement_reason TEXT,
  returned_date DATE,
  return_notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT oyster_status CHECK (status IN ('Issued', 'Active', 'Lost', 'Replaced', 'Returned', 'Deactivated')),
  CONSTRAINT oyster_ref_not_blank CHECK (length(btrim(card_ref)) > 0),
  CONSTRAINT oyster_balance_nonneg CHECK (recorded_balance IS NULL OR recorded_balance >= 0),
  CONSTRAINT oyster_returned_needs_date CHECK (status <> 'Returned' OR returned_date IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_oyster_cards_su ON public.oyster_cards(su_id, issued_date DESC);
-- The same physical card cannot be live for two issues at once
CREATE UNIQUE INDEX IF NOT EXISTS uq_oyster_live_card_ref ON public.oyster_cards(lower(btrim(card_ref))) WHERE status IN ('Issued', 'Active');

CREATE TABLE IF NOT EXISTS public.oyster_card_events (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES public.oyster_cards(id) ON DELETE CASCADE,
  su_id TEXT NOT NULL,
  event_type TEXT NOT NULL,           -- Issued | Status changed | Updated
  from_status TEXT,
  to_status TEXT,
  details TEXT,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oyster_events_card ON public.oyster_card_events(card_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.oyster_card_event_trigger() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.oyster_card_events (id, card_id, su_id, event_type, to_status, details, changed_by)
    VALUES ('oce-' || gen_random_uuid()::text, NEW.id, NEW.su_id, 'Issued', NEW.status, NEW.notes, COALESCE(NEW.updated_by, NEW.created_by));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.oyster_card_events (id, card_id, su_id, event_type, from_status, to_status, details, changed_by)
    VALUES ('oce-' || gen_random_uuid()::text, NEW.id, NEW.su_id, 'Status changed', OLD.status, NEW.status,
            COALESCE(NULLIF(NEW.replacement_reason, ''), NULLIF(NEW.return_notes, ''), NEW.notes), NEW.updated_by);
  ELSIF NEW.card_ref IS DISTINCT FROM OLD.card_ref OR NEW.recorded_balance IS DISTINCT FROM OLD.recorded_balance
        OR NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO public.oyster_card_events (id, card_id, su_id, event_type, from_status, to_status, details, changed_by)
    VALUES ('oce-' || gen_random_uuid()::text, NEW.id, NEW.su_id, 'Updated', OLD.status, NEW.status,
            CASE WHEN NEW.recorded_balance IS DISTINCT FROM OLD.recorded_balance
                 THEN 'Recorded balance changed from ' || COALESCE(OLD.recorded_balance::text, 'none') || ' to ' || COALESCE(NEW.recorded_balance::text, 'none')
                 ELSE 'Details updated' END, NEW.updated_by);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_oyster_cards_events ON public.oyster_cards;
CREATE TRIGGER trg_oyster_cards_events AFTER INSERT OR UPDATE ON public.oyster_cards FOR EACH ROW EXECUTE PROCEDURE public.oyster_card_event_trigger();

-- Replace a card in one transaction: the old card is closed (Replaced or Lost) and the new one issued, linked to it.
CREATE OR REPLACE FUNCTION public.replace_oyster_card(p_old_card_id TEXT, p_new_card_ref TEXT, p_reason TEXT, p_old_status TEXT, p_user TEXT)
RETURNS public.oyster_cards AS $$
DECLARE
  old_card public.oyster_cards;
  new_card public.oyster_cards;
BEGIN
  IF p_old_status NOT IN ('Replaced', 'Lost') THEN RAISE EXCEPTION 'The old card must be marked Replaced or Lost' USING ERRCODE = '22023'; END IF;
  IF p_new_card_ref IS NULL OR length(btrim(p_new_card_ref)) = 0 THEN RAISE EXCEPTION 'The new card reference is required' USING ERRCODE = '22023'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN RAISE EXCEPTION 'A replacement reason is required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO old_card FROM public.oyster_cards WHERE id = p_old_card_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card not found' USING ERRCODE = 'P0002'; END IF;
  IF old_card.status NOT IN ('Issued', 'Active', 'Lost') THEN RAISE EXCEPTION 'Only a live or lost card can be replaced' USING ERRCODE = '23505'; END IF;
  IF lower(btrim(p_new_card_ref)) = lower(btrim(old_card.card_ref)) THEN RAISE EXCEPTION 'The new card reference must be different from the old one' USING ERRCODE = '22023'; END IF;

  UPDATE public.oyster_cards SET status = p_old_status, replacement_reason = btrim(p_reason), updated_by = p_user WHERE id = p_old_card_id;
  INSERT INTO public.oyster_cards (id, su_id, card_ref, issued_date, issued_by, status, replaces_card_id, replacement_reason, created_by, updated_by)
  VALUES ('oys-' || gen_random_uuid()::text, old_card.su_id, btrim(p_new_card_ref), CURRENT_DATE, p_user, 'Issued', p_old_card_id, btrim(p_reason), p_user, p_user)
  RETURNING * INTO new_card;
  RETURN new_card;
END; $$ LANGUAGE plpgsql;
REVOKE ALL ON FUNCTION public.replace_oyster_card(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_oyster_card(TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;

-- ---------------------------------------------------------------------
-- Feature 3: per-SU meals. One row per SU, date and meal. Provision and consumption are separate statuses.
-- "No row" means not yet recorded; the UI shows it as Pending.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.su_meal_records (
  id TEXT PRIMARY KEY,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  meal_date DATE NOT NULL,
  meal_period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT,
  recorded_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT su_meal_period CHECK (meal_period IN ('Breakfast', 'Lunch', 'Dinner')),
  CONSTRAINT su_meal_status CHECK (status IN ('Pending', 'Provided', 'Accepted', 'Declined', 'Not available', 'Not applicable')),
  CONSTRAINT su_meal_one_per_slot UNIQUE (su_id, meal_date, meal_period)
);
CREATE INDEX IF NOT EXISTS idx_su_meal_date ON public.su_meal_records(meal_date);

CREATE TABLE IF NOT EXISTS public.su_meal_record_history (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES public.su_meal_records(id) ON DELETE CASCADE,
  su_id TEXT NOT NULL,
  meal_date DATE NOT NULL,
  meal_period TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  notes TEXT,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_su_meal_history_record ON public.su_meal_record_history(record_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.su_meal_history_trigger() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO public.su_meal_record_history (id, record_id, su_id, meal_date, meal_period, from_status, to_status, notes, changed_by)
    VALUES ('smh-' || gen_random_uuid()::text, NEW.id, NEW.su_id, NEW.meal_date, NEW.meal_period,
            CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, NEW.status, NEW.notes, COALESCE(NEW.updated_by, NEW.recorded_by));
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_su_meal_history ON public.su_meal_records;
CREATE TRIGGER trg_su_meal_history AFTER INSERT OR UPDATE ON public.su_meal_records FOR EACH ROW EXECUTE PROCEDURE public.su_meal_history_trigger();

-- ---------------------------------------------------------------------
-- Feature 4: education. One row per school placement, so a change of school keeps the old row (is_current = false).
-- No row = not recorded. 'Not enrolled' is a confirmed status, distinct from missing information.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.su_education_details (
  id TEXT PRIMARY KEY,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  school_name TEXT,
  school_address TEXT,
  school_contact TEXT,
  year_group TEXT,
  education_status TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT su_education_status CHECK (education_status IN ('Not enrolled', 'Application in progress', 'Enrolled', 'Details pending', 'No longer attending')),
  CONSTRAINT su_education_dates CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
  CONSTRAINT su_education_enrolled_needs_school CHECK (education_status <> 'Enrolled' OR length(btrim(COALESCE(school_name, ''))) > 0)
);
CREATE INDEX IF NOT EXISTS idx_su_education_su ON public.su_education_details(su_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_su_education_one_current ON public.su_education_details(su_id) WHERE is_current;

-- ---------------------------------------------------------------------
-- Feature 5: family groups link existing SUs. Removing a member keeps the row (status 'Removed') as history.
-- An SU can be in only one active family, so an incorrect second link is refused by the database.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_groups (
  id TEXT PRIMARY KEY,
  family_ref TEXT,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT family_groups_status CHECK (status IN ('Active', 'Closed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_family_groups_ref ON public.family_groups(lower(btrim(family_ref))) WHERE family_ref IS NOT NULL AND btrim(family_ref) <> '';

CREATE TABLE IF NOT EXISTS public.family_members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  relationship TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  removal_reason TEXT,
  added_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT family_members_status CHECK (status IN ('Active', 'Removed')),
  CONSTRAINT family_members_removed_has_date CHECK (status <> 'Removed' OR left_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON public.family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_su ON public.family_members(su_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_family_members_one_active_family ON public.family_members(su_id) WHERE status = 'Active';

-- ---------------------------------------------------------------------
-- Feature 6: archive / restore requests
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.su_archive_requests (
  id TEXT PRIMARY KEY,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'Archive',
  status TEXT NOT NULL DEFAULT 'Pending',
  reason TEXT NOT NULL,
  requested_by_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by_id TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  prior_su_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT su_archive_type CHECK (request_type IN ('Archive', 'Restore')),
  CONSTRAINT su_archive_status CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  CONSTRAINT su_archive_reason CHECK (length(btrim(reason)) >= 3),
  CONSTRAINT su_archive_decided_fields CHECK (status = 'Pending' OR (decided_by_id IS NOT NULL AND decided_at IS NOT NULL)),
  CONSTRAINT su_archive_rejection_reason CHECK (status <> 'Rejected' OR length(btrim(COALESCE(decision_reason, ''))) >= 3),
  -- Separation of duties: nobody approves or rejects their own request (cancelling their own is allowed)
  CONSTRAINT su_archive_no_self_decision CHECK (status NOT IN ('Approved', 'Rejected') OR decided_by_id <> requested_by_id)
);
CREATE INDEX IF NOT EXISTS idx_su_archive_su ON public.su_archive_requests(su_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_su_archive_status ON public.su_archive_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_su_archive_one_pending ON public.su_archive_requests(su_id) WHERE status = 'Pending';

-- Guard: the archive columns and the 'Archived' status can only be changed by the workflow functions below
CREATE OR REPLACE FUNCTION public.service_users_archive_guard() RETURNS TRIGGER AS $$
DECLARE
  in_workflow BOOLEAN := COALESCE(current_setting('app.su_archive_workflow', true), '') = 'on';
BEGIN
  IF in_workflow THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Archived' OR NEW.archive_status <> 'Active' THEN
      RAISE EXCEPTION 'Service users cannot be created as archived' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.archive_status IS DISTINCT FROM OLD.archive_status
       OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
       OR NEW.archived_pre_status IS DISTINCT FROM OLD.archived_pre_status
       OR (NEW.status IS DISTINCT FROM OLD.status AND (NEW.status = 'Archived' OR OLD.status = 'Archived')) THEN
      RAISE EXCEPTION 'Archiving and restoring a service user requires an approved request' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_service_users_archive_guard ON public.service_users;
CREATE TRIGGER trg_service_users_archive_guard BEFORE INSERT OR UPDATE ON public.service_users
  FOR EACH ROW EXECUTE PROCEDURE public.service_users_archive_guard();

-- Raise an archive or restore request (atomic; locks the SU row so simultaneous requests are serialised)
CREATE OR REPLACE FUNCTION public.request_su_archive(p_su_id TEXT, p_type TEXT, p_reason TEXT, p_user_id TEXT, p_user_name TEXT)
RETURNS public.su_archive_requests AS $$
DECLARE
  su RECORD;
  req public.su_archive_requests;
BEGIN
  IF p_type NOT IN ('Archive', 'Restore') THEN RAISE EXCEPTION 'Invalid request type' USING ERRCODE = '22023'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023'; END IF;
  SELECT id, status, archive_status INTO su FROM public.service_users WHERE id = p_su_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service user not found' USING ERRCODE = 'P0002'; END IF;
  IF su.archive_status IN ('Pending approval', 'Restoration pending') THEN
    RAISE EXCEPTION 'A request is already pending for this service user' USING ERRCODE = '23505';
  END IF;
  IF p_type = 'Archive' AND su.archive_status <> 'Active' THEN RAISE EXCEPTION 'Service user is already archived' USING ERRCODE = '23505'; END IF;
  IF p_type = 'Restore' AND su.archive_status <> 'Archived' THEN RAISE EXCEPTION 'Only an archived service user can be restored' USING ERRCODE = '23505'; END IF;

  INSERT INTO public.su_archive_requests (id, su_id, request_type, status, reason, requested_by_id, requested_by, prior_su_status)
  VALUES ('sar-' || gen_random_uuid()::text, p_su_id, p_type, 'Pending', btrim(p_reason), p_user_id, p_user_name, su.status)
  RETURNING * INTO req;

  PERFORM set_config('app.su_archive_workflow', 'on', true);
  UPDATE public.service_users
     SET archive_status = CASE WHEN p_type = 'Archive' THEN 'Pending approval' ELSE 'Restoration pending' END
   WHERE id = p_su_id;
  PERFORM set_config('app.su_archive_workflow', 'off', true);
  RETURN req;
END; $$ LANGUAGE plpgsql;

-- Approve, reject or cancel a pending request (atomic; the request row is locked)
CREATE OR REPLACE FUNCTION public.decide_su_archive_request(p_request_id TEXT, p_decision TEXT, p_decision_reason TEXT, p_user_id TEXT, p_user_name TEXT)
RETURNS public.su_archive_requests AS $$
DECLARE
  req public.su_archive_requests;
  su RECORD;
BEGIN
  IF p_decision NOT IN ('Approved', 'Rejected', 'Cancelled') THEN RAISE EXCEPTION 'Invalid decision' USING ERRCODE = '22023'; END IF;
  SELECT * INTO req FROM public.su_archive_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002'; END IF;
  IF req.status <> 'Pending' THEN RAISE EXCEPTION 'This request has already been decided' USING ERRCODE = '23505'; END IF;
  IF p_decision IN ('Approved', 'Rejected') AND req.requested_by_id = p_user_id THEN
    RAISE EXCEPTION 'You cannot approve or reject your own request' USING ERRCODE = '42501';
  END IF;
  IF p_decision = 'Cancelled' AND req.requested_by_id <> p_user_id THEN
    RAISE EXCEPTION 'Only the requester can cancel a request' USING ERRCODE = '42501';
  END IF;
  IF p_decision = 'Rejected' AND (p_decision_reason IS NULL OR length(btrim(p_decision_reason)) < 3) THEN
    RAISE EXCEPTION 'A reason is required to reject a request' USING ERRCODE = '22023';
  END IF;

  SELECT id, status, archive_status, archived_pre_status INTO su FROM public.service_users WHERE id = req.su_id FOR UPDATE;
  UPDATE public.su_archive_requests
     SET status = p_decision, decided_by_id = p_user_id, decided_by = p_user_name, decided_at = NOW(),
         decision_reason = NULLIF(btrim(COALESCE(p_decision_reason, '')), '')
   WHERE id = p_request_id RETURNING * INTO req;

  PERFORM set_config('app.su_archive_workflow', 'on', true);
  IF p_decision = 'Approved' AND req.request_type = 'Archive' THEN
    UPDATE public.service_users SET archived_pre_status = status, status = 'Archived', archive_status = 'Archived', archived_at = NOW() WHERE id = req.su_id;
  ELSIF p_decision = 'Approved' THEN
    UPDATE public.service_users
       SET status = COALESCE(NULLIF(su.archived_pre_status, 'Archived'), 'Active'), archive_status = 'Active', archived_at = NULL, archived_pre_status = NULL
     WHERE id = req.su_id;
  ELSE
    UPDATE public.service_users SET archive_status = CASE WHEN req.request_type = 'Archive' THEN 'Active' ELSE 'Archived' END WHERE id = req.su_id;
  END IF;
  PERFORM set_config('app.su_archive_workflow', 'off', true);
  RETURN req;
END; $$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.request_su_archive(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decide_su_archive_request(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_su_archive(TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.decide_su_archive_request(TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;

-- ---------------------------------------------------------------------
-- updated_at triggers, RLS, and server-only access
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['su_hc2_details', 'oyster_cards', 'oyster_card_events', 'su_meal_records', 'su_meal_record_history',
                         'su_education_details', 'family_groups', 'family_members', 'su_archive_requests'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF t NOT IN ('oyster_card_events', 'su_meal_record_history') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || t || '_updated_at', t);
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column()', 'trg_' || t || '_updated_at', t);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Private bucket for HC2 documents: not public, and no storage policies, so only the server (signed URLs) can reach it
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('su-health-documents', 'su-health-documents', false)
    ON CONFLICT (id) DO UPDATE SET public = false;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
