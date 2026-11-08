-- =====================================================================
-- Migration 028: Archive and recoverable deletion for Users and Properties
--
-- Users live in public.profiles (plus their Supabase Auth login) and Properties in
-- public.sites. Each row gets a lifecycle state: Active, Archived or Deleted. Nothing is
-- removed: archived and deleted rows stay in place with who did it, when and why.
--
-- Enforcement is in the database, not just the app:
--   * lifecycle columns can only be changed by public.lifecycle_apply(), which checks the
--     actor's role, site scope and the allowed transitions itself;
--   * only a Super Admin can restore (archived or deleted) records;
--   * the browser roles (anon / authenticated) cannot hard-delete these rows or edit a
--     row that is not Active;
--   * archiving or deleting a user also blocks their sign-in (auth.users.banned_until);
--     restoring to Active lifts the block.
-- Every change is written to record_lifecycle_events and to the existing audit_trails.
--
-- Requires migration 026 (public.is_super_admin). SAFE & IDEMPOTENT: re-runnable.
-- Rollback notes are at the bottom.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Lifecycle columns (kept apart from each table's own "status")
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles', 'sites'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT ''Active''', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS lifecycle_prev_state TEXT', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS lifecycle_prev_status TEXT', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS lifecycle_reason TEXT', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS lifecycle_changed_at TIMESTAMPTZ', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS lifecycle_changed_by UUID', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS lifecycle_changed_by_name TEXT', t);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_lifecycle_state_check') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (lifecycle_state IN (''Active'', ''Archived'', ''Deleted''))', t, t || '_lifecycle_state_check');
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(lifecycle_state)', 'idx_' || t || '_lifecycle_state', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2. History
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.record_lifecycle_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity          TEXT NOT NULL CHECK (entity IN ('users', 'properties')),
  record_id       TEXT NOT NULL,
  record_label    TEXT,
  action          TEXT NOT NULL CHECK (action IN ('archive', 'delete', 'restore')),
  previous_state  TEXT NOT NULL,
  new_state       TEXT NOT NULL,
  previous_status TEXT,
  actor_id        UUID,
  actor_name      TEXT NOT NULL,
  actor_role      TEXT,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_record ON public.record_lifecycle_events(entity, record_id, created_at DESC);

ALTER TABLE public.record_lifecycle_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.record_lifecycle_events FROM anon, authenticated;
GRANT SELECT ON public.record_lifecycle_events TO authenticated;
GRANT ALL ON public.record_lifecycle_events TO service_role;

-- Same helper as migration 026 (identical definition, safe to repeat).
CREATE OR REPLACE FUNCTION public.is_super_admin(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_uid AND role = 'Super Admin' AND lower(coalesce(status, 'active')) = 'active'
  );
$$;

-- Lifecycle history is readable by Super Admin only. Nobody writes it directly.
DROP POLICY IF EXISTS lifecycle_events_select_super_admin ON public.record_lifecycle_events;
CREATE POLICY lifecycle_events_select_super_admin ON public.record_lifecycle_events
  FOR SELECT TO authenticated USING ((SELECT public.is_super_admin((SELECT auth.uid()))));

-- ---------------------------------------------------------------------
-- 3. Guard trigger: lifecycle columns move only through lifecycle_apply()
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lifecycle_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  via_fn  BOOLEAN := coalesce(current_setting('sd.lifecycle_fn', true), '') = '1';
  caller  TEXT := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', current_user);
  browser BOOLEAN;
BEGIN
  browser := caller IN ('anon', 'authenticated');

  IF TG_OP = 'INSERT' THEN
    IF NOT via_fn THEN
      NEW.lifecycle_state := 'Active';
      NEW.lifecycle_prev_state := NULL;
      NEW.lifecycle_prev_status := NULL;
      NEW.lifecycle_reason := NULL;
      NEW.lifecycle_changed_at := NULL;
      NEW.lifecycle_changed_by := NULL;
      NEW.lifecycle_changed_by_name := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT via_fn AND (
         NEW.lifecycle_state IS DISTINCT FROM OLD.lifecycle_state
      OR NEW.lifecycle_prev_state IS DISTINCT FROM OLD.lifecycle_prev_state
      OR NEW.lifecycle_prev_status IS DISTINCT FROM OLD.lifecycle_prev_status
      OR NEW.lifecycle_reason IS DISTINCT FROM OLD.lifecycle_reason
      OR NEW.lifecycle_changed_at IS DISTINCT FROM OLD.lifecycle_changed_at
      OR NEW.lifecycle_changed_by IS DISTINCT FROM OLD.lifecycle_changed_by
      OR NEW.lifecycle_changed_by_name IS DISTINCT FROM OLD.lifecycle_changed_by_name
    ) THEN
      RAISE EXCEPTION 'Archive, delete and restore must go through lifecycle_apply()' USING ERRCODE = '42501';
    END IF;
    IF NOT via_fn AND browser AND OLD.lifecycle_state <> 'Active' THEN
      RAISE EXCEPTION 'Archived or deleted records cannot be edited. A Super Admin must restore the record first.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE
  IF NOT via_fn AND browser THEN
    RAISE EXCEPTION 'Records cannot be permanently deleted. Use delete (recoverable) instead.' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_lifecycle_guard ON public.profiles;
CREATE TRIGGER trg_profiles_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lifecycle_guard();
DROP TRIGGER IF EXISTS trg_sites_lifecycle_guard ON public.sites;
CREATE TRIGGER trg_sites_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.lifecycle_guard();

-- ---------------------------------------------------------------------
-- 4. The one function that changes lifecycle state
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lifecycle_rank(p_role TEXT) RETURNS INT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_role
    WHEN 'Super Admin' THEN 6 WHEN 'Admin' THEN 5 WHEN 'Regional Manager' THEN 4
    WHEN 'General Manager' THEN 3 WHEN 'Area Manager' THEN 2 WHEN 'Staff' THEN 1 ELSE 99 END;
$$;

-- A person's sites: their profile assignment plus Property Assignments, lower-cased.
CREATE OR REPLACE FUNCTION public.lifecycle_user_sites(p_uid UUID) RETURNS TEXT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT s), ARRAY[]::TEXT[]) FROM (
    SELECT lower(trim(x)) AS s FROM public.profiles p, unnest(string_to_array(coalesce(p.assigned_site, ''), ',')) AS x WHERE p.id = p_uid
    UNION
    SELECT lower(trim(a.property_name)) FROM public.property_user_assignments a WHERE a.user_id = p_uid
    UNION
    SELECT lower(trim(x)) FROM public.property_user_assignments a, unnest(coalesce(a.assigned_properties, ARRAY[]::TEXT[])) AS x WHERE a.user_id = p_uid
  ) q WHERE s IS NOT NULL AND s <> '' AND s <> 'pending assignment';
$$;

CREATE OR REPLACE FUNCTION public.lifecycle_apply(
  p_entity TEXT, p_id TEXT, p_action TEXT, p_actor UUID, p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  actor        public.profiles%ROWTYPE;
  actor_sites  TEXT[];
  actor_global BOOLEAN;
  rec          JSONB;
  cur_state    TEXT;
  prev_state   TEXT;
  new_state    TEXT;
  tgt_sites    TEXT[];
  tgt_role     TEXT;
  tgt_status   TEXT;
  label        TEXT;
  reason       TEXT := left(nullif(btrim(coalesce(p_reason, '')), ''), 300);
  restore_status TEXT;
BEGIN
  IF p_entity NOT IN ('users', 'properties') OR p_action NOT IN ('archive', 'delete', 'restore') THEN
    RAISE EXCEPTION 'Invalid request' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO actor FROM public.profiles WHERE id = p_actor;
  IF NOT FOUND OR actor.lifecycle_state <> 'Active' OR lower(coalesce(actor.status, 'active')) <> 'active' THEN
    RAISE EXCEPTION 'Your account is not allowed to do this.' USING ERRCODE = '42501';
  END IF;
  IF actor.role NOT IN ('Super Admin', 'Admin', 'General Manager', 'Area Manager', 'Staff') THEN
    RAISE EXCEPTION 'Your role cannot change the status of this record.' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'restore' AND actor.role <> 'Super Admin' THEN
    RAISE EXCEPTION 'Only a Super Admin can restore records.' USING ERRCODE = '42501';
  END IF;

  actor_sites  := public.lifecycle_user_sites(actor.id);
  actor_global := actor.role IN ('Super Admin', 'Admin', 'Regional Manager') OR actor_sites && ARRAY['all sites', 'all'];

  -- Load and lock the target.
  IF p_entity = 'users' THEN
    SELECT to_jsonb(t) INTO rec FROM public.profiles t WHERE t.id::TEXT = p_id FOR UPDATE;
  ELSE
    SELECT to_jsonb(t) INTO rec FROM public.sites t WHERE t.id = p_id FOR UPDATE;
  END IF;
  IF rec IS NULL THEN RAISE EXCEPTION 'Record not found.' USING ERRCODE = 'P0002'; END IF;

  cur_state  := coalesce(rec ->> 'lifecycle_state', 'Active');
  prev_state := rec ->> 'lifecycle_prev_state';
  tgt_status := rec ->> 'status';

  IF p_entity = 'users' THEN
    label      := coalesce(nullif(rec ->> 'name', ''), rec ->> 'email');
    tgt_role   := rec ->> 'role';
    tgt_sites  := public.lifecycle_user_sites((rec ->> 'id')::UUID);
  ELSE
    label      := coalesce(nullif(rec ->> 'name', ''), p_id);
    tgt_sites  := ARRAY[lower(btrim(coalesce(rec ->> 'name', '')))];
  END IF;

  -- Decide the transition.
  IF p_action = 'restore' THEN
    IF cur_state = 'Active' THEN RAISE EXCEPTION 'This record is already active.' USING ERRCODE = '22023'; END IF;
    new_state := CASE WHEN cur_state = 'Deleted' AND prev_state = 'Archived' THEN 'Archived' ELSE 'Active' END;
  ELSE
    IF cur_state = 'Deleted' THEN RAISE EXCEPTION 'This record is already deleted.' USING ERRCODE = '22023'; END IF;
    IF p_action = 'archive' AND cur_state = 'Archived' THEN RAISE EXCEPTION 'This record is already archived.' USING ERRCODE = '22023'; END IF;
    new_state := CASE WHEN p_action = 'archive' THEN 'Archived' ELSE 'Deleted' END;

    IF actor.role <> 'Super Admin' THEN
      -- Scope: every site of the target must be one of the actor's.
      IF NOT actor_global THEN
        IF coalesce(array_length(tgt_sites, 1), 0) = 0 OR NOT (tgt_sites <@ actor_sites) THEN
          RAISE EXCEPTION 'This record is outside your assigned sites.' USING ERRCODE = '42501';
        END IF;
      END IF;
      IF p_entity = 'users' AND public.lifecycle_rank(tgt_role) >= public.lifecycle_rank(actor.role) THEN
        RAISE EXCEPTION 'You can only manage users with a lower role than yours.' USING ERRCODE = '42501';
      END IF;
    END IF;

    IF p_entity = 'users' THEN
      IF p_id = actor.id::TEXT THEN RAISE EXCEPTION 'You cannot archive or delete your own account.' USING ERRCODE = '42501'; END IF;
      IF tgt_role = 'Super Admin' AND (
           SELECT count(*) FROM public.profiles WHERE role = 'Super Admin' AND lifecycle_state = 'Active' AND id::TEXT <> p_id
         ) = 0 THEN
        RAISE EXCEPTION 'The last active Super Admin cannot be archived or deleted.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- Restoring must not create a duplicate of a record that is still in use.
  IF p_action = 'restore' AND new_state = 'Active' THEN
    IF p_entity = 'properties' THEN
      IF EXISTS (
        SELECT 1 FROM public.sites s
        WHERE s.id <> p_id AND s.lifecycle_state = 'Active'
          AND (lower(btrim(s.name)) = lower(btrim(coalesce(rec ->> 'name', '')))
               OR (nullif(btrim(coalesce(rec ->> 'pid', '')), '') IS NOT NULL AND lower(btrim(coalesce(s.pid, ''))) = lower(btrim(rec ->> 'pid'))))
      ) THEN
        RAISE EXCEPTION 'An active property with the same name or PID already exists. Rename or remove it before restoring.' USING ERRCODE = '23505';
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM public.profiles s WHERE s.id::TEXT <> p_id AND s.lifecycle_state = 'Active' AND lower(s.email) = lower(rec ->> 'email')) THEN
        RAISE EXCEPTION 'An active user with the same email already exists.' USING ERRCODE = '23505';
      END IF;
    END IF;
  END IF;

  -- Apply. The flag lets the guard trigger accept the lifecycle columns for this statement only.
  PERFORM set_config('sd.lifecycle_fn', '1', true);

  IF p_entity = 'users' THEN
    -- Remember the account's own status so it comes back as it was; an archived/deleted user is Inactive.
    restore_status := CASE WHEN p_action = 'restore' THEN coalesce(nullif(rec ->> 'lifecycle_prev_status', ''), 'Active') ELSE NULL END;
    UPDATE public.profiles SET
      lifecycle_state = new_state,
      lifecycle_prev_state = CASE WHEN p_action = 'restore' THEN NULL ELSE cur_state END,
      lifecycle_prev_status = CASE WHEN p_action = 'restore' THEN lifecycle_prev_status WHEN cur_state = 'Active' THEN tgt_status ELSE coalesce(lifecycle_prev_status, tgt_status) END,
      lifecycle_reason = CASE WHEN p_action = 'restore' THEN lifecycle_reason ELSE reason END,
      lifecycle_changed_at = NOW(), lifecycle_changed_by = actor.id, lifecycle_changed_by_name = coalesce(actor.name, actor.email),
      status = CASE WHEN new_state = 'Active' THEN coalesce(restore_status, status) ELSE 'Inactive' END,
      updated_at = NOW()
    WHERE id::TEXT = p_id;

    -- Block or unblock sign-in.
    BEGIN
      UPDATE auth.users SET banned_until = CASE WHEN new_state = 'Active' THEN NULL ELSE 'infinity'::TIMESTAMPTZ END WHERE id::TEXT = p_id;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE WARNING 'Could not update auth.users.banned_until for %; sign-in is still blocked by the profile status.', p_id;
    END;
  ELSE
    UPDATE public.sites SET
      lifecycle_state = new_state,
      lifecycle_prev_state = CASE WHEN p_action = 'restore' THEN NULL ELSE cur_state END,
      lifecycle_prev_status = CASE WHEN p_action = 'restore' THEN lifecycle_prev_status WHEN cur_state = 'Active' THEN tgt_status ELSE coalesce(lifecycle_prev_status, tgt_status) END,
      lifecycle_reason = CASE WHEN p_action = 'restore' THEN lifecycle_reason ELSE reason END,
      lifecycle_changed_at = NOW(), lifecycle_changed_by = actor.id, lifecycle_changed_by_name = coalesce(actor.name, actor.email),
      updated_at = NOW()
    WHERE id = p_id;
  END IF;

  INSERT INTO public.record_lifecycle_events
    (entity, record_id, record_label, action, previous_state, new_state, previous_status, actor_id, actor_name, actor_role, reason)
  VALUES (p_entity, p_id, label, p_action, cur_state, new_state, tgt_status, actor.id, coalesce(actor.name, actor.email), actor.role, reason);

  -- Also recorded in the existing audit trail.
  BEGIN
    INSERT INTO public.audit_trails (id, "user", user_id, role, action, details, site, entity_type, entity_id)
    VALUES ('audit-' || gen_random_uuid()::TEXT, coalesce(actor.name, actor.email), actor.id, actor.role,
            upper(p_action), format('%s %s "%s": %s -> %s%s',
              CASE p_entity WHEN 'users' THEN 'User' ELSE 'Property' END, p_action, label, cur_state, new_state,
              CASE WHEN reason IS NOT NULL THEN ' (' || reason || ')' ELSE '' END),
            CASE WHEN p_entity = 'properties' THEN label ELSE 'All' END, p_entity, p_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit_trails insert skipped: %', SQLERRM;
  END;

  RETURN jsonb_build_object('success', TRUE, 'from', cur_state, 'to', new_state, 'label', label);
END;
$$;

REVOKE ALL ON FUNCTION public.lifecycle_apply(TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lifecycle_apply(TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.lifecycle_user_sites(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lifecycle_user_sites(UUID) TO service_role;

-- Browser-callable wrapper (direct Supabase mode): always acts as the signed-in user.
CREATE OR REPLACE FUNCTION public.lifecycle_apply_self(p_entity TEXT, p_id TEXT, p_action TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  RETURN public.lifecycle_apply(p_entity, p_id, p_action, auth.uid(), p_reason);
END;
$$;
REVOKE ALL ON FUNCTION public.lifecycle_apply_self(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lifecycle_apply_self(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ROLLBACK (manual):
--   DROP TRIGGER IF EXISTS trg_profiles_lifecycle_guard ON public.profiles;
--   DROP TRIGGER IF EXISTS trg_sites_lifecycle_guard ON public.sites;
--   DROP FUNCTION IF EXISTS public.lifecycle_apply_self(TEXT, TEXT, TEXT, TEXT);
--   DROP FUNCTION IF EXISTS public.lifecycle_apply(TEXT, TEXT, TEXT, UUID, TEXT);
--   DROP FUNCTION IF EXISTS public.lifecycle_user_sites(UUID), public.lifecycle_rank(TEXT), public.lifecycle_guard();
--   Records still Archived/Deleted must be set back to Active first; then drop the lifecycle_* columns
--   and public.record_lifecycle_events.
