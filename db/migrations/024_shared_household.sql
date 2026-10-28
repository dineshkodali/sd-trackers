-- =====================================================================
-- 024: Shared household, managed from any member's profile
--
--  * The household IS the family group from migration 021 (family_groups + family_members): one record that every linked
--    Service User points at, so what is added or removed from one profile shows on all of them. Nothing new is stored.
--  * add_household_member() links an existing Service User to the household of another. If the first person has no household
--    yet it is created in the same transaction, with both people in it. People already in a different household are refused.
--  * remove_household_member() ends one person's membership (the row is kept as history; the Service User is untouched).
--    A household left with one person is closed.
--  * set_household_relationship() changes how a member is described (father, mother, son...).
--  * All three lock the household / people involved, so two staff changing the same household at once cannot leave it inconsistent.
--  * Additive and safe to re-run.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.add_household_member(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT);
--   DROP FUNCTION IF EXISTS public.remove_household_member(TEXT,TEXT,TEXT,TEXT,TEXT);
--   DROP FUNCTION IF EXISTS public.set_household_relationship(TEXT,TEXT,TEXT,TEXT,TEXT);
-- =====================================================================

CREATE OR REPLACE FUNCTION public.add_household_member(p_anchor_su TEXT, p_member_su TEXT, p_relationship TEXT, p_anchor_relationship TEXT, p_user TEXT, p_role TEXT)
RETURNS public.family_members AS $$
DECLARE
  managers TEXT[] := ARRAY['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager'];
  n INTEGER;
  bad INTEGER;
  anchor_family TEXT;
  member_family TEXT;
  anchor_last TEXT;
  fam TEXT;
  row_out public.family_members;
BEGIN
  IF NOT (p_role = ANY(managers)) THEN RAISE EXCEPTION 'Your role cannot change a household' USING ERRCODE = '42501'; END IF;
  IF p_anchor_su IS NULL OR p_member_su IS NULL THEN RAISE EXCEPTION 'Choose the Service User to add' USING ERRCODE = '22023'; END IF;
  IF p_anchor_su = p_member_su THEN RAISE EXCEPTION 'A person cannot be linked to themselves' USING ERRCODE = '22023'; END IF;

  -- lock both people in a fixed order so two simultaneous changes cannot deadlock
  PERFORM 1 FROM public.service_users WHERE id IN (p_anchor_su, p_member_su) ORDER BY id FOR UPDATE;
  SELECT count(*) INTO n FROM public.service_users WHERE id IN (p_anchor_su, p_member_su);
  IF n <> 2 THEN RAISE EXCEPTION 'Service user not found' USING ERRCODE = 'P0002'; END IF;
  SELECT count(*) INTO bad FROM public.service_users WHERE id IN (p_anchor_su, p_member_su) AND (archive_status <> 'Active' OR status = 'Archived');
  IF bad > 0 THEN RAISE EXCEPTION 'Archived Service Users cannot be added to a household' USING ERRCODE = '22023'; END IF;

  SELECT family_id INTO anchor_family FROM public.family_members WHERE su_id = p_anchor_su AND status = 'Active';
  SELECT family_id INTO member_family FROM public.family_members WHERE su_id = p_member_su AND status = 'Active';

  IF member_family IS NOT NULL AND member_family IS NOT DISTINCT FROM anchor_family THEN
    RAISE EXCEPTION 'This person is already in this household' USING ERRCODE = '23505';
  END IF;
  IF member_family IS NOT NULL THEN
    RAISE EXCEPTION 'This person is already in another household. Remove them from it first.' USING ERRCODE = '23505';
  END IF;

  IF anchor_family IS NULL THEN
    SELECT last_name INTO anchor_last FROM public.service_users WHERE id = p_anchor_su;
    fam := 'fam-' || gen_random_uuid()::text;
    INSERT INTO public.family_groups (id, display_name, status, created_by, updated_by)
    VALUES (fam, COALESCE(NULLIF(btrim(anchor_last), ''), 'Household') || ' household', 'Active', p_user, p_user);
    INSERT INTO public.family_members (id, family_id, su_id, relationship, status, added_by, updated_by)
    VALUES ('fmem-' || gen_random_uuid()::text, fam, p_anchor_su, NULLIF(btrim(COALESCE(p_anchor_relationship, '')), ''), 'Active', p_user, p_user);
  ELSE
    fam := anchor_family;
    PERFORM 1 FROM public.family_groups WHERE id = fam FOR UPDATE;
  END IF;

  INSERT INTO public.family_members (id, family_id, su_id, relationship, status, added_by, updated_by)
  VALUES ('fmem-' || gen_random_uuid()::text, fam, p_member_su, NULLIF(btrim(COALESCE(p_relationship, '')), ''), 'Active', p_user, p_user)
  RETURNING * INTO row_out;
  RETURN row_out;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.remove_household_member(p_family_id TEXT, p_su_id TEXT, p_reason TEXT, p_user TEXT, p_role TEXT)
RETURNS public.family_groups AS $$
DECLARE
  managers TEXT[] := ARRAY['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager'];
  fam public.family_groups;
  remaining INTEGER;
BEGIN
  IF NOT (p_role = ANY(managers)) THEN RAISE EXCEPTION 'Your role cannot change a household' USING ERRCODE = '42501'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO fam FROM public.family_groups WHERE id = p_family_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Household not found' USING ERRCODE = 'P0002'; END IF;

  UPDATE public.family_members SET status = 'Removed', left_at = NOW(), removal_reason = btrim(p_reason), updated_by = p_user
   WHERE family_id = p_family_id AND su_id = p_su_id AND status = 'Active';
  IF NOT FOUND THEN RAISE EXCEPTION 'That person is not an active member of this household' USING ERRCODE = 'P0002'; END IF;

  SELECT count(*) INTO remaining FROM public.family_members WHERE family_id = p_family_id AND status = 'Active';
  IF remaining < 2 THEN
    UPDATE public.family_members SET status = 'Removed', left_at = NOW(), removal_reason = 'Household ended: only one member left', updated_by = p_user
     WHERE family_id = p_family_id AND status = 'Active';
    UPDATE public.family_groups SET status = 'Closed', updated_by = p_user WHERE id = p_family_id RETURNING * INTO fam;
  ELSE
    SELECT * INTO fam FROM public.family_groups WHERE id = p_family_id;
  END IF;
  RETURN fam;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_household_relationship(p_family_id TEXT, p_su_id TEXT, p_relationship TEXT, p_user TEXT, p_role TEXT)
RETURNS public.family_members AS $$
DECLARE
  managers TEXT[] := ARRAY['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager'];
  row_out public.family_members;
BEGIN
  IF NOT (p_role = ANY(managers)) THEN RAISE EXCEPTION 'Your role cannot change a household' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.family_groups WHERE id = p_family_id FOR UPDATE;
  UPDATE public.family_members SET relationship = NULLIF(btrim(COALESCE(p_relationship, '')), ''), updated_by = p_user
   WHERE family_id = p_family_id AND su_id = p_su_id AND status = 'Active' RETURNING * INTO row_out;
  IF NOT FOUND THEN RAISE EXCEPTION 'That person is not an active member of this household' USING ERRCODE = 'P0002'; END IF;
  RETURN row_out;
END; $$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.add_household_member(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_household_member(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_household_relationship(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_household_member(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_household_member(TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_household_relationship(TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
