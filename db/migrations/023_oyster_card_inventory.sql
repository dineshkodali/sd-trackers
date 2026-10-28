-- =====================================================================
-- 023: Oyster cards as property inventory, with issue / return transactions
--
--  * oyster_cards now describes a physical card held by a PROPERTY (site_name), with a card reference, a recorded balance
--    and a status: Available, Issued, Lost, Damaged or Deactivated. su_id is the current holder and is set only while issued.
--  * oyster_card_transactions is one row per loan: card, SU, property, linked funding request, balance at handover,
--    return date, balance at return, condition. It is the single record the SU profile and the Funding page read from,
--    so a loan is never counted twice. The card reference is copied onto the row so history survives later edits.
--  * oyster_card_events (existing) becomes the card's history of registrations, balance changes, issues, returns and status changes.
--  * Issuing and returning happen only through issue_oyster_card() / return_oyster_card(): one transaction that locks the card,
--    checks it is available at the right property, writes the loan, the history and (when linked) moves the funding request on.
--    A trigger refuses any other change to status, holder or issue details.
--  * Balances are manual records. A balance difference is not treated as spending: the loan is flagged balance_adjusted if the
--    balance was changed while the card was out, and the app only shows an "amount used" when the figures are reliable.
--  * Additive. Existing rows are kept; new rules are NOT VALID so old data cannot block the migration. Safe to re-run.
--
-- Rollback (only if nothing has been recorded yet):
--   DROP FUNCTION IF EXISTS public.issue_oyster_card(TEXT,TEXT,TEXT,NUMERIC,DATE,TEXT,TEXT,TEXT);
--   DROP FUNCTION IF EXISTS public.return_oyster_card(TEXT,NUMERIC,TEXT,TEXT,DATE,TEXT,TEXT,TEXT);
--   DROP FUNCTION IF EXISTS public.set_oyster_balance(TEXT,NUMERIC,TEXT,TEXT,TEXT);
--   DROP TABLE IF EXISTS public.oyster_card_transactions;
--   ALTER TABLE public.transport_funding_requests DROP COLUMN IF EXISTS oyster_card_id;
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cards belong to a property, not to a person
-- ---------------------------------------------------------------------
ALTER TABLE public.oyster_cards ALTER COLUMN su_id DROP NOT NULL;
ALTER TABLE public.oyster_cards ALTER COLUMN issued_date DROP NOT NULL;
ALTER TABLE public.oyster_cards ALTER COLUMN issued_by DROP NOT NULL;
ALTER TABLE public.oyster_cards ALTER COLUMN status SET DEFAULT 'Available';
ALTER TABLE public.oyster_cards ADD COLUMN IF NOT EXISTS site_name TEXT;
ALTER TABLE public.oyster_cards ADD COLUMN IF NOT EXISTS current_balance NUMERIC(8,2);
ALTER TABLE public.oyster_cards ADD COLUMN IF NOT EXISTS balance_updated_at TIMESTAMPTZ;
ALTER TABLE public.oyster_cards ADD COLUMN IF NOT EXISTS balance_updated_by TEXT;

-- Cards recorded under the first design keep their balance and take their holder's property
UPDATE public.oyster_cards c
   SET current_balance = COALESCE(c.current_balance, c.recorded_balance),
       site_name = COALESCE(c.site_name, s.name)
  FROM public.service_users u
  JOIN public.sites s ON s.id = u.site_id
 WHERE c.su_id = u.id AND (c.site_name IS NULL OR c.current_balance IS NULL);

ALTER TABLE public.oyster_cards DROP CONSTRAINT IF EXISTS oyster_status;
ALTER TABLE public.oyster_cards DROP CONSTRAINT IF EXISTS oyster_status_v2;
ALTER TABLE public.oyster_cards ADD CONSTRAINT oyster_status_v2
  CHECK (status IN ('Available', 'Issued', 'Lost', 'Damaged', 'Deactivated', 'Active', 'Replaced', 'Returned')) NOT VALID;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oyster_property_required') THEN
    ALTER TABLE public.oyster_cards ADD CONSTRAINT oyster_property_required CHECK (site_name IS NOT NULL AND btrim(site_name) <> '') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oyster_issued_has_holder') THEN
    ALTER TABLE public.oyster_cards ADD CONSTRAINT oyster_issued_has_holder CHECK (status <> 'Issued' OR su_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oyster_available_no_holder') THEN
    ALTER TABLE public.oyster_cards ADD CONSTRAINT oyster_available_no_holder CHECK (status <> 'Available' OR su_id IS NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oyster_balance_recorded') THEN
    ALTER TABLE public.oyster_cards ADD CONSTRAINT oyster_balance_recorded CHECK (status NOT IN ('Available', 'Issued') OR current_balance IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oyster_current_balance_nonneg') THEN
    ALTER TABLE public.oyster_cards ADD CONSTRAINT oyster_current_balance_nonneg CHECK (current_balance IS NULL OR current_balance >= 0) NOT VALID;
  END IF;
END $$;

-- A physical card exists once; only a deactivated card frees its reference
DROP INDEX IF EXISTS public.uq_oyster_live_card_ref;
CREATE UNIQUE INDEX IF NOT EXISTS uq_oyster_card_ref ON public.oyster_cards(lower(btrim(card_ref))) WHERE status <> 'Deactivated';
CREATE INDEX IF NOT EXISTS idx_oyster_cards_site ON public.oyster_cards(site_name, status);

-- ---------------------------------------------------------------------
-- History
-- ---------------------------------------------------------------------
ALTER TABLE public.oyster_card_events ALTER COLUMN su_id DROP NOT NULL;
ALTER TABLE public.oyster_card_events ADD COLUMN IF NOT EXISTS balance NUMERIC(8,2);
ALTER TABLE public.oyster_card_events ADD COLUMN IF NOT EXISTS previous_balance NUMERIC(8,2);
ALTER TABLE public.oyster_card_events ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- ---------------------------------------------------------------------
-- Loans: one row per issue, closed by the return. The only place issue/return facts live.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oyster_card_transactions (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES public.oyster_cards(id) ON DELETE RESTRICT,
  card_ref TEXT NOT NULL,
  su_id TEXT NOT NULL REFERENCES public.service_users(id) ON DELETE CASCADE,
  site_name TEXT NOT NULL,
  funding_request_id TEXT REFERENCES public.transport_funding_requests(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Issued',
  issued_date DATE NOT NULL,
  issued_by TEXT NOT NULL,
  issued_by_id TEXT,
  balance_at_issue NUMERIC(8,2) NOT NULL,
  returned_date DATE,
  returned_by TEXT,
  balance_at_return NUMERIC(8,2),
  return_condition TEXT,
  return_notes TEXT,
  balance_adjusted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT oyster_txn_status CHECK (status IN ('Issued', 'Returned', 'Lost')),
  CONSTRAINT oyster_txn_issue_balance CHECK (balance_at_issue >= 0),
  CONSTRAINT oyster_txn_return_balance CHECK (balance_at_return IS NULL OR balance_at_return >= 0),
  CONSTRAINT oyster_txn_condition CHECK (return_condition IS NULL OR return_condition IN ('Good', 'Damaged', 'Lost')),
  CONSTRAINT oyster_txn_return_dates CHECK (returned_date IS NULL OR returned_date >= issued_date),
  CONSTRAINT oyster_txn_returned_complete CHECK (status <> 'Returned' OR (returned_date IS NOT NULL AND balance_at_return IS NOT NULL AND return_condition IN ('Good', 'Damaged')))
);
CREATE INDEX IF NOT EXISTS idx_oyster_txn_su ON public.oyster_card_transactions(su_id, issued_date DESC);
CREATE INDEX IF NOT EXISTS idx_oyster_txn_site ON public.oyster_card_transactions(site_name, issued_date DESC);
CREATE INDEX IF NOT EXISTS idx_oyster_txn_card ON public.oyster_card_transactions(card_id, issued_date DESC);
-- A card can be out with only one person at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_oyster_txn_one_open_per_card ON public.oyster_card_transactions(card_id) WHERE status = 'Issued';
-- One loan per funding request, so the request is never recorded twice
CREATE UNIQUE INDEX IF NOT EXISTS uq_oyster_txn_one_per_request ON public.oyster_card_transactions(funding_request_id)
  WHERE funding_request_id IS NOT NULL AND status IN ('Issued', 'Returned');

-- The card the site chose on the request form (a choice, not a booking: the card is only held when it is issued)
ALTER TABLE public.transport_funding_requests ADD COLUMN IF NOT EXISTS oyster_card_id TEXT REFERENCES public.oyster_cards(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- Guard: status, holder and issue details change only through the issue / return functions
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.oyster_cards_guard() RETURNS TRIGGER AS $$
DECLARE
  in_workflow BOOLEAN := COALESCE(current_setting('app.oyster_workflow', true), '') = 'on';
BEGIN
  IF in_workflow THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'Available' OR NEW.su_id IS NOT NULL OR NEW.issued_date IS NOT NULL THEN
      RAISE EXCEPTION 'New cards are registered as available; issue them to a Service User from the Oyster Cards page' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND (NEW.status = 'Issued' OR OLD.status = 'Issued') THEN
    RAISE EXCEPTION 'A card is issued or returned only through the issue and return actions' USING ERRCODE = '42501';
  END IF;
  IF NEW.su_id IS DISTINCT FROM OLD.su_id OR NEW.issued_date IS DISTINCT FROM OLD.issued_date OR NEW.issued_by IS DISTINCT FROM OLD.issued_by THEN
    RAISE EXCEPTION 'The holder of a card changes only through the issue and return actions' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'Issued' AND (NEW.site_name IS DISTINCT FROM OLD.site_name OR NEW.card_ref IS DISTINCT FROM OLD.card_ref) THEN
    RAISE EXCEPTION 'A card that is out on loan cannot change property or reference' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_oyster_cards_guard ON public.oyster_cards;
CREATE TRIGGER trg_oyster_cards_guard BEFORE INSERT OR UPDATE ON public.oyster_cards
  FOR EACH ROW EXECUTE PROCEDURE public.oyster_cards_guard();

-- Loans are never edited or removed except by the return function
CREATE OR REPLACE FUNCTION public.oyster_txn_guard() RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(current_setting('app.oyster_workflow', true), '') = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Oyster card history cannot be deleted' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'Cards are issued only through the issue action' USING ERRCODE = '42501'; END IF;
  RAISE EXCEPTION 'Oyster card loans change only through the return action' USING ERRCODE = '42501';
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_oyster_txn_guard ON public.oyster_card_transactions;
CREATE TRIGGER trg_oyster_txn_guard BEFORE INSERT OR UPDATE OR DELETE ON public.oyster_card_transactions
  FOR EACH ROW EXECUTE PROCEDURE public.oyster_txn_guard();

-- ---------------------------------------------------------------------
-- History rows are written by the database itself
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.oyster_card_event_trigger() RETURNS TRIGGER AS $$
DECLARE
  ev TEXT := NULLIF(current_setting('app.oyster_event', true), '');
  txn TEXT := NULLIF(current_setting('app.oyster_txn', true), '');
  note TEXT := NULLIF(current_setting('app.oyster_note', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.oyster_card_events (id, card_id, su_id, event_type, to_status, balance, details, changed_by)
    VALUES ('oce-' || gen_random_uuid()::text, NEW.id, NEW.su_id, 'Registered', NEW.status, NEW.current_balance, NEW.notes, COALESCE(NEW.updated_by, NEW.created_by));
  ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.current_balance IS DISTINCT FROM OLD.current_balance THEN
    INSERT INTO public.oyster_card_events (id, card_id, su_id, event_type, from_status, to_status, balance, previous_balance, transaction_id, details, changed_by)
    VALUES ('oce-' || gen_random_uuid()::text, NEW.id, COALESCE(NEW.su_id, OLD.su_id),
            COALESCE(ev, CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'Status changed' ELSE 'Balance updated' END),
            OLD.status, NEW.status, NEW.current_balance, OLD.current_balance, txn, note, NEW.updated_by);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_oyster_cards_events ON public.oyster_cards;
CREATE TRIGGER trg_oyster_cards_events AFTER INSERT OR UPDATE ON public.oyster_cards FOR EACH ROW EXECUTE PROCEDURE public.oyster_card_event_trigger();

-- ---------------------------------------------------------------------
-- Issue a card to a Service User (one transaction)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_oyster_card(p_card_id TEXT, p_su_id TEXT, p_funding_request_id TEXT, p_balance NUMERIC, p_issued_date DATE, p_user_id TEXT, p_user_name TEXT, p_role TEXT)
RETURNS public.oyster_card_transactions AS $$
DECLARE
  site_roles TEXT[] := ARRAY['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager', 'Staff'];
  c public.oyster_cards;
  su RECORD;
  req RECORD;
  txn public.oyster_card_transactions;
  issue_day DATE := COALESCE(p_issued_date, CURRENT_DATE);
  txn_id TEXT := 'otx-' || gen_random_uuid()::text;
BEGIN
  IF NOT (p_role = ANY(site_roles)) THEN RAISE EXCEPTION 'Your role cannot issue Oyster cards' USING ERRCODE = '42501'; END IF;
  IF p_balance IS NULL OR p_balance < 0 THEN RAISE EXCEPTION 'The balance at handover is required' USING ERRCODE = '22023'; END IF;
  IF issue_day > CURRENT_DATE THEN RAISE EXCEPTION 'The issue date cannot be in the future' USING ERRCODE = '22023'; END IF;

  SELECT * INTO c FROM public.oyster_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card not found' USING ERRCODE = 'P0002'; END IF;
  IF c.status <> 'Available' THEN RAISE EXCEPTION 'This card is not available (it is %)', lower(c.status) USING ERRCODE = '23505'; END IF;

  SELECT id, status, archive_status INTO su FROM public.service_users WHERE id = p_su_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service user not found' USING ERRCODE = 'P0002'; END IF;
  IF su.archive_status <> 'Active' OR su.status IN ('Archived', 'Discharged') THEN RAISE EXCEPTION 'A card cannot be issued to an archived or discharged Service User' USING ERRCODE = '22023'; END IF;

  IF p_funding_request_id IS NOT NULL THEN
    SELECT id, site_name, status INTO req FROM public.transport_funding_requests WHERE id = p_funding_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Funding request not found' USING ERRCODE = 'P0002'; END IF;
    IF lower(btrim(req.site_name)) <> lower(btrim(c.site_name)) THEN RAISE EXCEPTION 'The card belongs to a different property from the request' USING ERRCODE = '22023'; END IF;
    IF req.status <> 'Approved' THEN RAISE EXCEPTION 'The funding request must be approved before a card is issued (it is %)', lower(req.status) USING ERRCODE = '23505'; END IF;
  END IF;

  PERFORM set_config('app.oyster_workflow', 'on', true);
  INSERT INTO public.oyster_card_transactions (id, card_id, card_ref, su_id, site_name, funding_request_id, status, issued_date, issued_by, issued_by_id, balance_at_issue)
  VALUES (txn_id, c.id, c.card_ref, p_su_id, c.site_name, p_funding_request_id, 'Issued', issue_day, p_user_name, p_user_id, p_balance)
  RETURNING * INTO txn;

  PERFORM set_config('app.oyster_event', 'Issued', true);
  PERFORM set_config('app.oyster_txn', txn_id, true);
  PERFORM set_config('app.oyster_note', CASE WHEN c.current_balance IS DISTINCT FROM p_balance THEN 'Balance confirmed at handover' ELSE NULL END, true);
  UPDATE public.oyster_cards
     SET status = 'Issued', su_id = p_su_id, issued_date = issue_day, issued_by = p_user_name, current_balance = p_balance,
         balance_updated_at = NOW(), balance_updated_by = p_user_name, updated_by = p_user_name
   WHERE id = c.id;
  PERFORM set_config('app.oyster_workflow', 'off', true);
  PERFORM set_config('app.oyster_event', '', true);
  PERFORM set_config('app.oyster_txn', '', true);
  PERFORM set_config('app.oyster_note', '', true);

  -- The request moves to Issued in the same transaction; its journey reference is the card reference
  IF p_funding_request_id IS NOT NULL THEN
    PERFORM public.transition_transport_funding(p_funding_request_id, 'Issued', NULL, p_user_id, p_user_name, p_role, jsonb_build_object('journeyUrn', c.card_ref));
  END IF;
  RETURN txn;
END; $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Return (or write off) a card. A returned card always records its actual remaining balance.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_oyster_card(p_txn_id TEXT, p_balance_at_return NUMERIC, p_condition TEXT, p_notes TEXT, p_returned_date DATE, p_user_id TEXT, p_user_name TEXT, p_role TEXT)
RETURNS public.oyster_card_transactions AS $$
DECLARE
  site_roles TEXT[] := ARRAY['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager', 'Staff'];
  t public.oyster_card_transactions;
  c public.oyster_cards;
  note TEXT := NULLIF(btrim(COALESCE(p_notes, '')), '');
  return_day DATE := COALESCE(p_returned_date, CURRENT_DATE);
  new_card_status TEXT;
  req_status TEXT;
BEGIN
  IF NOT (p_role = ANY(site_roles)) THEN RAISE EXCEPTION 'Your role cannot return Oyster cards' USING ERRCODE = '42501'; END IF;
  IF p_condition NOT IN ('Good', 'Damaged', 'Lost') THEN RAISE EXCEPTION 'Choose the condition of the card' USING ERRCODE = '22023'; END IF;
  IF p_condition <> 'Lost' AND (p_balance_at_return IS NULL OR p_balance_at_return < 0) THEN RAISE EXCEPTION 'Enter the actual remaining balance on the card' USING ERRCODE = '22023'; END IF;
  IF p_condition <> 'Good' AND note IS NULL THEN RAISE EXCEPTION 'Add a note describing the damage or loss' USING ERRCODE = '22023'; END IF;
  IF return_day > CURRENT_DATE THEN RAISE EXCEPTION 'The return date cannot be in the future' USING ERRCODE = '22023'; END IF;

  SELECT * INTO t FROM public.oyster_card_transactions WHERE id = p_txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found' USING ERRCODE = 'P0002'; END IF;
  IF t.status <> 'Issued' THEN RAISE EXCEPTION 'This card has already been returned' USING ERRCODE = '23505'; END IF;
  IF return_day < t.issued_date THEN RAISE EXCEPTION 'The return date cannot be before the issue date' USING ERRCODE = '22023'; END IF;
  SELECT * INTO c FROM public.oyster_cards WHERE id = t.card_id FOR UPDATE;

  new_card_status := CASE p_condition WHEN 'Good' THEN 'Available' WHEN 'Damaged' THEN 'Damaged' ELSE 'Lost' END;

  PERFORM set_config('app.oyster_workflow', 'on', true);
  UPDATE public.oyster_card_transactions
     SET status = CASE WHEN p_condition = 'Lost' THEN 'Lost' ELSE 'Returned' END,
         returned_date = return_day, returned_by = p_user_name,
         balance_at_return = CASE WHEN p_condition = 'Lost' THEN NULL ELSE p_balance_at_return END,
         return_condition = p_condition, return_notes = note
   WHERE id = p_txn_id RETURNING * INTO t;

  PERFORM set_config('app.oyster_event', CASE WHEN p_condition = 'Lost' THEN 'Lost' ELSE 'Returned' END, true);
  PERFORM set_config('app.oyster_txn', p_txn_id, true);
  PERFORM set_config('app.oyster_note', COALESCE(note, ''), true);
  UPDATE public.oyster_cards
     SET status = new_card_status, su_id = NULL, issued_date = NULL, issued_by = NULL,
         current_balance = CASE WHEN p_condition = 'Lost' THEN current_balance ELSE p_balance_at_return END,
         balance_updated_at = CASE WHEN p_condition = 'Lost' THEN balance_updated_at ELSE NOW() END,
         balance_updated_by = CASE WHEN p_condition = 'Lost' THEN balance_updated_by ELSE p_user_name END,
         updated_by = p_user_name
   WHERE id = t.card_id;
  PERFORM set_config('app.oyster_workflow', 'off', true);
  PERFORM set_config('app.oyster_event', '', true);
  PERFORM set_config('app.oyster_txn', '', true);
  PERFORM set_config('app.oyster_note', '', true);

  -- A returned card completes its funding request; a lost one leaves the request open for follow-up
  IF t.funding_request_id IS NOT NULL AND p_condition <> 'Lost' THEN
    SELECT status INTO req_status FROM public.transport_funding_requests WHERE id = t.funding_request_id;
    IF req_status = 'Issued' THEN
      PERFORM public.transition_transport_funding(t.funding_request_id, 'Completed', NULL, p_user_id, p_user_name, p_role,
        jsonb_build_object('completionNotes', 'Oyster card ' || t.card_ref || ' returned with a recorded balance of ' || p_balance_at_return::text));
    END IF;
  END IF;
  RETURN t;
END; $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Update a recorded balance (top-up or correction). A change while the card is out is flagged on the loan.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_oyster_balance(p_card_id TEXT, p_balance NUMERIC, p_note TEXT, p_user_name TEXT, p_role TEXT)
RETURNS public.oyster_cards AS $$
DECLARE
  site_roles TEXT[] := ARRAY['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager', 'Staff'];
  c public.oyster_cards;
BEGIN
  IF NOT (p_role = ANY(site_roles)) THEN RAISE EXCEPTION 'Your role cannot update card balances' USING ERRCODE = '42501'; END IF;
  IF p_balance IS NULL OR p_balance < 0 THEN RAISE EXCEPTION 'The balance must be zero or more' USING ERRCODE = '22023'; END IF;
  SELECT * INTO c FROM public.oyster_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card not found' USING ERRCODE = 'P0002'; END IF;
  IF c.status = 'Deactivated' THEN RAISE EXCEPTION 'A deactivated card cannot be updated' USING ERRCODE = '23505'; END IF;
  IF c.status = 'Issued' AND NULLIF(btrim(COALESCE(p_note, '')), '') IS NULL THEN RAISE EXCEPTION 'Say why the balance changed while the card is out (for example a top-up)' USING ERRCODE = '22023'; END IF;

  PERFORM set_config('app.oyster_event', 'Balance updated', true);
  PERFORM set_config('app.oyster_note', COALESCE(NULLIF(btrim(p_note), ''), ''), true);
  UPDATE public.oyster_cards SET current_balance = p_balance, balance_updated_at = NOW(), balance_updated_by = p_user_name, updated_by = p_user_name
   WHERE id = p_card_id RETURNING * INTO c;
  PERFORM set_config('app.oyster_event', '', true);
  PERFORM set_config('app.oyster_note', '', true);

  IF c.status = 'Issued' THEN
    PERFORM set_config('app.oyster_workflow', 'on', true);
    UPDATE public.oyster_card_transactions SET balance_adjusted = TRUE WHERE card_id = p_card_id AND status = 'Issued';
    PERFORM set_config('app.oyster_workflow', 'off', true);
  END IF;
  RETURN c;
END; $$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.issue_oyster_card(TEXT,TEXT,TEXT,NUMERIC,DATE,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.return_oyster_card(TEXT,NUMERIC,TEXT,TEXT,DATE,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_oyster_balance(TEXT,NUMERIC,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_oyster_card(TEXT,TEXT,TEXT,NUMERIC,DATE,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.return_oyster_card(TEXT,NUMERIC,TEXT,TEXT,DATE,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_oyster_balance(TEXT,NUMERIC,TEXT,TEXT,TEXT) TO service_role;

-- ---------------------------------------------------------------------
-- updated_at, RLS and server-only access for the new table
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_oyster_card_transactions_updated_at ON public.oyster_card_transactions;
CREATE TRIGGER trg_oyster_card_transactions_updated_at BEFORE UPDATE ON public.oyster_card_transactions FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
ALTER TABLE public.oyster_card_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oyster_card_transactions FROM anon, authenticated;
GRANT ALL ON public.oyster_card_transactions TO service_role;

NOTIFY pgrst, 'reload schema';
