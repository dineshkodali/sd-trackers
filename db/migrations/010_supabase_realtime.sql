-- =====================================================================
-- 010: Supabase Realtime Architecture for SDTracker
-- Enables PostgreSQL Replication & Publishes ALL Tables to supabase_realtime
-- 46 tables covered - matches full ENTITY_REGISTRY
-- =====================================================================

-- 1. Set REPLICA IDENTITY FULL on all operational tables
--    (needed so UPDATE/DELETE events carry the full old row)
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    -- Core operational
    'ir_records', 'maintenance_records', 'data_change_requests',
    'escalations', 'referrals', 'vulnerable_residents',
    'challenging_behavior', 'spcd_records', 'laundry_logs', 'hot_food_logs',
    'public_transport_records', 'compliance_records', 'gp_appointments',
    'rfa_welfare_checks', 'dispersal_records', 'booklet_collections',
    'food_wastage_records',
    -- Register & arrivals
    'daily_register_rooms', 'daily_register_records',
    'new_arrivals_records', 'eviction_records',
    -- People & access
    'sites', 'profiles', 'user_groups', 'property_user_assignments',
    'role_permissions',
    -- Finance
    'finance_bills', 'vendor_invoices', 'credit_card_bills',
    'delivery_notes', 'finance_approvals', 'finance_vendors',
    'finance_bill_items', 'finance_bill_attachments',
    -- Documents & VCS
    'documents', 'vcs_agencies',
    -- HO Reports
    'ho_report_templates', 'ho_report_records', 'ho_report_audit_logs',
    -- Config & system
    'field_options', 'app_settings', 'table_schemas',
    'email_notification_rules', 'email_notification_logs',
    'password_audit_logs', 'audit_trails'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', tbl);
    END IF;
  END LOOP;
END $$;

-- 2. Add all tables to the supabase_realtime publication (idempotent)
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    -- Core operational
    'ir_records', 'maintenance_records', 'data_change_requests',
    'escalations', 'referrals', 'vulnerable_residents',
    'challenging_behavior', 'spcd_records', 'laundry_logs', 'hot_food_logs',
    'public_transport_records', 'compliance_records', 'gp_appointments',
    'rfa_welfare_checks', 'dispersal_records', 'booklet_collections',
    'food_wastage_records',
    -- Register & arrivals
    'daily_register_rooms', 'daily_register_records',
    'new_arrivals_records', 'eviction_records',
    -- People & access
    'sites', 'profiles', 'user_groups', 'property_user_assignments',
    'role_permissions',
    -- Finance
    'finance_bills', 'vendor_invoices', 'credit_card_bills',
    'delivery_notes', 'finance_approvals', 'finance_vendors',
    'finance_bill_items', 'finance_bill_attachments',
    -- Documents & VCS
    'documents', 'vcs_agencies',
    -- HO Reports
    'ho_report_templates', 'ho_report_records', 'ho_report_audit_logs',
    -- Config & system
    'field_options', 'app_settings', 'table_schemas',
    'email_notification_rules', 'email_notification_logs',
    'password_audit_logs', 'audit_trails'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY tables LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = tbl
      ) THEN
        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
            AND schemaname = 'public'
            AND tablename = tbl
        ) THEN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
        END IF;
      END IF;
    END LOOP;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
