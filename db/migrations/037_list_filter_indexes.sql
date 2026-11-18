-- Indexes for the filters and sorts the app actually issues, on the tables that grow every day.
-- Existing site / id / reference indexes are left as they are. Nothing here is created for a column that does not exist,
-- so the script is safe to run on any copy of the database and safe to re-run.
--
-- What is deliberately NOT here: trigram / full-text indexes. The app still searches records in the browser, so a text
-- index would cost every write and never be used. Add them together with database-side search (see the performance notes).
DO $$
DECLARE
  spec TEXT[][] := ARRAY[
    -- index name, table, column list
    ['idx_audit_trails_site_ts',       'audit_trails',            'site, timestamp DESC'],
    ['idx_maintenance_status',         'maintenance_records',     'defect_status'],
    ['idx_maintenance_reported_date',  'maintenance_records',     'reported_date DESC'],
    ['idx_referrals_status',           'referrals',               'status'],
    ['idx_referrals_date_referred',    'referrals',               'date_referred DESC'],
    ['idx_escalations_status',         'escalations',             'status'],
    ['idx_escalations_created',        'escalations',             'created_at DESC'],
    ['idx_compliance_status',          'compliance_records',      'status'],
    ['idx_transport_appt_date',        'public_transport_records','appointment_date DESC'],
    ['idx_transport_status',           'public_transport_records','status'],
    ['idx_gp_appt_date',               'gp_appointments',         'appointment_date DESC'],
    ['idx_rfa_date',                   'rfa_welfare_checks',      'date DESC'],
    ['idx_reg_records_register_date',  'daily_register_records',  'register_date DESC'],
    ['idx_laundry_logs_date',          'laundry_logs',            'date DESC'],
    ['idx_hot_food_logs_date',         'hot_food_logs',           'date DESC'],
    ['idx_housekeeping_logs_date',     'housekeeping_logs',       'date DESC'],
    ['idx_arrivals_status',            'new_arrivals_records',    'status'],
    ['idx_su_meal_records_su_date',    'su_meal_records',         'su_id, meal_date DESC']
  ];
  i INT;
  col TEXT;
  all_exist BOOLEAN;
BEGIN
  FOR i IN 1 .. array_length(spec, 1) LOOP
    all_exist := to_regclass('public.' || spec[i][2]) IS NOT NULL;
    IF all_exist THEN
      FOREACH col IN ARRAY string_to_array(regexp_replace(spec[i][3], '\s+(ASC|DESC)', '', 'gi'), ',') LOOP
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = spec[i][2] AND column_name = trim(col)
        ) THEN all_exist := false; END IF;
      END LOOP;
    END IF;
    IF all_exist THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)', spec[i][1], spec[i][2], spec[i][3]);
    END IF;
  END LOOP;
END $$;
