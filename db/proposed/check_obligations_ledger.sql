-- DRAFT - NOT APPLIED - UNTESTED. See db/proposed/README.md.
--
-- Optional ledger for the twice-monthly Room / Welfare check obligations.
--
-- The app does NOT need this to work: obligations are derived on the fly from rooms, placements and recorded checks
-- (src/utils/checkObligations.ts), for any month, including past ones. A ledger is only worth adding if you want
--   (a) a frozen record of what was required at the time (e.g. for audit), or
--   (b) a scheduler that sends reminders / marks overdue without anyone opening the app.
-- Both need a place to run a job (hosting/scheduler decision still open), so this stays a draft.
--
-- Rows are written by a job, never by users. A completed visit is referenced, not copied.

CREATE TABLE IF NOT EXISTS public.check_obligations (
  id            TEXT PRIMARY KEY,                     -- 'room|<room_id>|2026-11|1'
  check_type    TEXT NOT NULL CHECK (check_type IN ('room', 'welfare')),
  month         TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  period        SMALLINT NOT NULL CHECK (period IN (1, 2)),
  deadline      DATE NOT NULL,                        -- London calendar date, inclusive
  site_id       TEXT REFERENCES public.sites(id) ON DELETE SET NULL,
  property_id   TEXT REFERENCES public.properties(id) ON DELETE SET NULL,
  room_id       TEXT REFERENCES public.property_rooms(id) ON DELETE SET NULL,
  su_id         TEXT REFERENCES public.service_users(id) ON DELETE SET NULL,
  responsible   TEXT,                                 -- name at the time it was generated
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'completed', 'completed_late', 'overdue', 'exempt')),
  visit_id      TEXT,                                 -- room_checks.id or welfare_checks.id that satisfied it
  visit_date    DATE,
  exempt_reason TEXT,                                 -- required when status = 'exempt' (e.g. hospital stay)
  exempt_by     TEXT,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (check_type, month, period, room_id, su_id)
);

CREATE INDEX IF NOT EXISTS idx_check_obligations_month ON public.check_obligations(month, check_type, status);
CREATE INDEX IF NOT EXISTS idx_check_obligations_site  ON public.check_obligations(site_id, deadline);

-- Row level security must follow the same site scoping as room_checks / welfare_checks before this is used.
-- ALTER TABLE public.check_obligations ENABLE ROW LEVEL SECURITY;
-- (policy intentionally left unwritten in a draft)
