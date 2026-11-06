-- =====================================================================
-- Migration 026: Page Access Management (per-user page / action permissions)
--
-- Model: a user with NO rows in user_page_permissions behaves exactly as before
-- (role rules only). A user WITH rows is restricted: a page that is absent is
-- denied and each action needs its flag. Overrides only restrict - they never
-- elevate a user above their role. Super Admin accounts are never restricted.
--
-- Enforcement layers:
--   1. Express /api/db/* and /api/page-access/* (server/pagePermissions.ts)
--   2. Postgres RLS (RESTRICTIVE policies, below) - covers browser -> Supabase
--      direct mode on static hosts (AWS Amplify) where Express is not in the path.
--
-- SAFE & IDEMPOTENT: can be re-run in the Supabase SQL Editor.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_page_permissions (
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page_id     TEXT NOT NULL CHECK (page_id ~ '^[A-Za-z0-9_]{1,64}$'),
  can_view    BOOLEAN NOT NULL DEFAULT FALSE,
  can_create  BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit    BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete  BOOLEAN NOT NULL DEFAULT FALSE,
  can_export  BOOLEAN NOT NULL DEFAULT FALSE,
  can_approve BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by  UUID,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, page_id)
);

CREATE TABLE IF NOT EXISTS public.page_access_audit (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id         UUID,
  actor_name       TEXT NOT NULL,
  target_user_id   UUID NOT NULL,
  target_user_name TEXT,
  action           TEXT NOT NULL CHECK (action IN ('UPDATE', 'RESET', 'COPY')),
  previous         JSONB,
  new_permissions  JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_page_access_audit_target ON public.page_access_audit(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_access_audit_created ON public.page_access_audit(created_at DESC);

ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_access_audit ENABLE ROW LEVEL SECURITY;

-- Super Admin check (SECURITY DEFINER so it works regardless of profiles RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_uid AND role = 'Super Admin' AND lower(coalesce(status, 'active')) = 'active'
  );
$$;

-- Table privileges: nobody writes these tables directly; writes go through the
-- functions below (Super Admin only). Reads are limited by RLS.
REVOKE ALL ON public.user_page_permissions FROM anon, authenticated;
REVOKE ALL ON public.page_access_audit FROM anon, authenticated;
GRANT SELECT ON public.user_page_permissions TO authenticated;
GRANT SELECT ON public.page_access_audit TO authenticated;
GRANT ALL ON public.user_page_permissions TO service_role;
GRANT ALL ON public.page_access_audit TO service_role;

DROP POLICY IF EXISTS upp_select_own_or_super ON public.user_page_permissions;
CREATE POLICY upp_select_own_or_super ON public.user_page_permissions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_super_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS paa_select_super ON public.page_access_audit;
CREATE POLICY paa_select_super ON public.page_access_audit
  FOR SELECT TO authenticated
  USING ((SELECT public.is_super_admin((SELECT auth.uid()))));

-- Evaluate the override layer for the calling user (used by RLS below).
CREATE OR REPLACE FUNCTION public.page_perm_allowed(p_page TEXT, p_action TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  has_rows BOOLEAN;
  ok BOOLEAN;
BEGIN
  IF uid IS NULL THEN RETURN TRUE; END IF;                    -- service role / non-user contexts: other policies decide
  IF public.is_super_admin(uid) THEN RETURN TRUE; END IF;
  SELECT EXISTS (SELECT 1 FROM public.user_page_permissions WHERE user_id = uid) INTO has_rows;
  IF NOT has_rows THEN RETURN TRUE; END IF;                   -- not restricted: role rules only
  SELECT CASE p_action
           WHEN 'view'    THEN can_view
           WHEN 'create'  THEN can_create AND can_view
           WHEN 'edit'    THEN can_edit AND can_view
           WHEN 'delete'  THEN can_delete AND can_view
           WHEN 'export'  THEN can_export AND can_view
           WHEN 'approve' THEN can_approve AND can_view
           ELSE FALSE
         END
    INTO ok
    FROM public.user_page_permissions
   WHERE user_id = uid AND page_id = p_page;
  RETURN COALESCE(ok, FALSE);
END;
$$;

-- Internal writer. service_role only: the caller (Express, after verifying the
-- Super Admin token, or the wrapper below) supplies the actor.
CREATE OR REPLACE FUNCTION public.page_access_apply(
  p_actor UUID, p_actor_name TEXT, p_target UUID, p_perms JSONB, p_action TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_role TEXT;
  target_name TEXT;
  prev JSONB;
  key TEXT;
  val JSONB;
BEGIN
  IF p_actor IS NOT NULL AND p_actor = p_target THEN
    RAISE EXCEPTION 'You cannot change your own page permissions' USING ERRCODE = '42501';
  END IF;
  SELECT role, name INTO target_role, target_name FROM public.profiles WHERE id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002'; END IF;
  IF target_role = 'Super Admin' THEN
    RAISE EXCEPTION 'Super Admin access cannot be restricted' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_object_agg(page_id, jsonb_build_object(
           'view', can_view, 'create', can_create, 'edit', can_edit,
           'delete', can_delete, 'export', can_export, 'approve', can_approve)), '{}'::jsonb)
    INTO prev FROM public.user_page_permissions WHERE user_id = p_target;

  DELETE FROM public.user_page_permissions WHERE user_id = p_target;

  IF p_perms IS NOT NULL AND jsonb_typeof(p_perms) = 'object' THEN
    FOR key, val IN SELECT * FROM jsonb_each(p_perms) LOOP
      IF key !~ '^[A-Za-z0-9_]{1,64}$' OR jsonb_typeof(val) <> 'object' THEN CONTINUE; END IF;
      INSERT INTO public.user_page_permissions
        (user_id, page_id, can_view, can_create, can_edit, can_delete, can_export, can_approve, updated_by, updated_at)
      VALUES (
        p_target, key,
        COALESCE((val->>'view')::boolean, FALSE),
        COALESCE((val->>'create')::boolean, FALSE) AND COALESCE((val->>'view')::boolean, FALSE),
        COALESCE((val->>'edit')::boolean, FALSE) AND COALESCE((val->>'view')::boolean, FALSE),
        COALESCE((val->>'delete')::boolean, FALSE) AND COALESCE((val->>'view')::boolean, FALSE),
        COALESCE((val->>'export')::boolean, FALSE) AND COALESCE((val->>'view')::boolean, FALSE),
        COALESCE((val->>'approve')::boolean, FALSE) AND COALESCE((val->>'view')::boolean, FALSE),
        p_actor, NOW());
    END LOOP;
  END IF;

  INSERT INTO public.page_access_audit (actor_id, actor_name, target_user_id, target_user_name, action, previous, new_permissions)
  VALUES (p_actor, COALESCE(NULLIF(p_actor_name, ''), 'Super Admin'), p_target, target_name,
          p_action, prev,
          (SELECT COALESCE(jsonb_object_agg(page_id, jsonb_build_object(
             'view', can_view, 'create', can_create, 'edit', can_edit,
             'delete', can_delete, 'export', can_export, 'approve', can_approve)), '{}'::jsonb)
             FROM public.user_page_permissions WHERE user_id = p_target));

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.page_access_apply(UUID, TEXT, UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.page_access_apply(UUID, TEXT, UUID, JSONB, TEXT) TO service_role;

-- Browser-callable wrapper (direct Supabase mode). Verifies the caller is a Super Admin.
CREATE OR REPLACE FUNCTION public.save_user_page_permissions(p_target UUID, p_perms JSONB, p_action TEXT DEFAULT 'UPDATE')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  actor_name TEXT;
BEGIN
  IF uid IS NULL OR NOT public.is_super_admin(uid) THEN
    RAISE EXCEPTION 'Only a Super Admin can manage page access' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('UPDATE', 'RESET', 'COPY') THEN p_action := 'UPDATE'; END IF;
  SELECT COALESCE(name, email) INTO actor_name FROM public.profiles WHERE id = uid;
  RETURN public.page_access_apply(uid, actor_name, p_target, p_perms, p_action);
END;
$$;

REVOKE ALL ON FUNCTION public.save_user_page_permissions(UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_user_page_permissions(UUID, JSONB, TEXT) TO authenticated, service_role;

-- Restrictive RLS: ANDed with every existing permissive policy, so users with no
-- override rows are completely unaffected. Mapping mirrors TABLE_PAGE_MAP in
-- src/config/pagePermissionsConfig.ts.
DO $$
DECLARE
  m TEXT[][] := ARRAY[
    ['referrals','referrals'],['vulnerable_residents','vulnerable'],['challenging_behavior','challenging'],
    ['maintenance_records','maintenance'],['spcd_records','spcd'],['laundry_logs','laundry'],
    ['daily_laundry_logs','laundry'],['hot_food_logs','food'],['escalations','escalations'],
    ['documents','documents'],['public_transport_records','publicTransport'],['transport_feedback','publicTransport'],
    ['transport_challenges','publicTransport'],['transport_funding_requests','publicTransport'],['oyster_cards','publicTransport'],
    ['compliance_records','compliance'],['gp_appointments','gpAppointments'],['gp_registrations','gpAppointments'],
    ['rfa_welfare_checks','rfaWelfare'],['dispersal_records','dispersal'],['booklet_collections','booklets'],
    ['vcs_agencies','vcsDirectory'],['data_change_requests','requests'],['ir_records','irTracker'],
    ['food_wastage_records','foodWastage'],['daily_register_rooms','dailyRegisters'],['daily_register_records','dailyRegisters'],
    ['new_arrivals_records','dailyRegisters'],['eviction_records','dailyRegisters'],['welfare_checks','welfareChecks'],
    ['food_surveys','foodSurveys'],['food_meal_ratings','foodSurveys'],['room_checks','roomChecks'],
    ['room_check_items','roomChecks'],['peep_plans','peepTracker'],['peep_plan_history','peepTracker'],
    ['su_attendance_records','suAttendance'],['absence_followups','suAttendance'],['mh_complaint_welfare_checks','mhComplaintWelfare'],
    ['housekeeping_logs','housekeeping'],['housekeeping_room_logs','housekeeping'],['food_consumption_reports','foodConsumption'],
    ['food_box_requests','foodConsumption'],['ho_report_templates','documentBuilder'],['ho_report_records','documentBuilder'],
    ['doc_builder','documentBuilder']
  ];
  i INT;
  t TEXT;
  p TEXT;
BEGIN
  FOR i IN 1 .. array_length(m, 1) LOOP
    t := m[i][1]; p := m[i][2];
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    -- Only tables (not views) can carry policies.
    IF (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.' || t)) NOT IN ('r', 'p') THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS pap_view ON public.%I', t);
    EXECUTE format('CREATE POLICY pap_view ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT public.page_perm_allowed(%L, ''view'')))', t, p);

    EXECUTE format('DROP POLICY IF EXISTS pap_create ON public.%I', t);
    EXECUTE format('CREATE POLICY pap_create ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((SELECT public.page_perm_allowed(%L, ''create'')))', t, p);

    EXECUTE format('DROP POLICY IF EXISTS pap_edit ON public.%I', t);
    EXECUTE format('CREATE POLICY pap_edit ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING ((SELECT public.page_perm_allowed(%L, ''edit''))) WITH CHECK ((SELECT public.page_perm_allowed(%L, ''edit'')))', t, p, p);

    EXECUTE format('DROP POLICY IF EXISTS pap_delete ON public.%I', t);
    EXECUTE format('CREATE POLICY pap_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING ((SELECT public.page_perm_allowed(%L, ''delete'')))', t, p);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
