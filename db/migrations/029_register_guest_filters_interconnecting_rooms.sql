-- 029: Daily Register Aspen card + interconnecting rooms.
-- Run in the Supabase SQL Editor after 028. Safe to run more than once. Nothing is dropped and no
-- existing row is changed, apart from the one additive back-fill of aspen_card noted below.
--
-- Access control: daily_register_rooms and daily_register_records already have row level security
-- and page-access policies (migration 026). The new columns live on those tables, so those
-- policies cover them. The trigger below adds the rule RLS cannot express: only Super Admin,
-- Admin, General Manager and Area Manager may create or change interconnecting-room links
-- (Staff can still allocate guests to those rooms).

/* ---------------------------------------------------------------- Aspen card on the register */

ALTER TABLE public.daily_register_records ADD COLUMN IF NOT EXISTS aspen_card TEXT;

-- Back-fill from New Arrivals (which already holds the card) for rows that have none, matched on Port Ref.
UPDATE public.daily_register_records r
   SET aspen_card = a.aspen_card
  FROM (
    SELECT DISTINCT ON (lower(btrim(port_reference))) lower(btrim(port_reference)) AS ref, aspen_card
      FROM public.new_arrivals_records
     WHERE coalesce(btrim(port_reference), '') <> '' AND coalesce(btrim(aspen_card), '') <> ''
     ORDER BY lower(btrim(port_reference)), updated_at DESC NULLS LAST
  ) a
 WHERE coalesce(btrim(r.aspen_card), '') = ''
   AND lower(btrim(r.port_ref)) = a.ref;

/* ------------------------------------------------------------------- Interconnecting rooms */

ALTER TABLE public.daily_register_rooms ADD COLUMN IF NOT EXISTS room_category TEXT NOT NULL DEFAULT 'Standard';
ALTER TABLE public.daily_register_rooms ADD COLUMN IF NOT EXISTS interconnect_group TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_register_rooms_room_category_check') THEN
    ALTER TABLE public.daily_register_rooms
      ADD CONSTRAINT daily_register_rooms_room_category_check CHECK (room_category IN ('Standard', 'Interconnecting'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_register_rooms_interconnect_group
  ON public.daily_register_rooms (interconnect_group) WHERE interconnect_group IS NOT NULL;

CREATE OR REPLACE FUNCTION public.daily_register_rooms_interconnect_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller TEXT := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', current_user);
  actor_role TEXT;
  touched BOOLEAN;
BEGIN
  NEW.interconnect_group := nullif(btrim(coalesce(NEW.interconnect_group, '')), '');
  NEW.room_category := coalesce(nullif(btrim(NEW.room_category), ''), 'Standard');

  -- A standard room is in no group; a room in a group is interconnecting; an interconnecting room needs a group.
  IF NEW.room_category = 'Standard' THEN
    NEW.interconnect_group := NULL;
  ELSIF NEW.interconnect_group IS NULL THEN
    RAISE EXCEPTION 'An interconnecting room must belong to a group of connected rooms' USING ERRCODE = '23514';
  END IF;

  touched := CASE TG_OP
    WHEN 'INSERT' THEN NEW.interconnect_group IS NOT NULL
    ELSE NEW.interconnect_group IS DISTINCT FROM OLD.interconnect_group OR NEW.room_category IS DISTINCT FROM OLD.room_category
  END;

  -- The API (service role) has already checked the caller's role; browsers talking to Supabase directly are checked here.
  IF touched AND caller NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
    IF actor_role IS NULL OR actor_role NOT IN ('Super Admin', 'Admin', 'General Manager', 'Area Manager') THEN
      RAISE EXCEPTION 'Only a manager can change interconnecting room links' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.interconnect_group IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.daily_register_rooms o
       WHERE o.interconnect_group = NEW.interconnect_group
         AND o.id <> NEW.id
         AND lower(btrim(coalesce(o.hotel, ''))) <> lower(btrim(coalesce(NEW.hotel, '')))
    ) THEN
      RAISE EXCEPTION 'Interconnecting rooms must be in the same property' USING ERRCODE = '23514';
    END IF;
    IF (SELECT count(*) FROM public.daily_register_rooms o WHERE o.interconnect_group = NEW.interconnect_group AND o.id <> NEW.id) >= 6 THEN
      RAISE EXCEPTION 'A group can connect at most 6 rooms' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_register_rooms_interconnect_guard ON public.daily_register_rooms;
CREATE TRIGGER trg_daily_register_rooms_interconnect_guard
  BEFORE INSERT OR UPDATE ON public.daily_register_rooms
  FOR EACH ROW EXECUTE FUNCTION public.daily_register_rooms_interconnect_guard();

-- ROLLBACK (manual, only if needed):
--   DROP TRIGGER IF EXISTS trg_daily_register_rooms_interconnect_guard ON public.daily_register_rooms;
--   DROP FUNCTION IF EXISTS public.daily_register_rooms_interconnect_guard();
--   ALTER TABLE public.daily_register_rooms DROP COLUMN IF EXISTS interconnect_group, DROP COLUMN IF EXISTS room_category;
--   ALTER TABLE public.daily_register_records DROP COLUMN IF EXISTS aspen_card;

NOTIFY pgrst, 'reload schema';
