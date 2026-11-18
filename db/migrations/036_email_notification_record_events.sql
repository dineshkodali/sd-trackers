-- Central email notifications: "New record" and "Record updated" rules per module.
-- Reuses email_notification_rules (one row per event). Adds only the columns the new settings need.
-- The master ON/OFF switch is stored in app_settings (id = 'email_notifications_master', value = {"enabled": true|false});
-- a missing row means ON, so nothing changes until a Super Admin switches it off.
ALTER TABLE public.email_notification_rules ADD COLUMN IF NOT EXISTS body_template TEXT;
ALTER TABLE public.email_notification_rules ADD COLUMN IF NOT EXISTS include_link BOOLEAN DEFAULT true;
ALTER TABLE public.email_notification_rules ADD COLUMN IF NOT EXISTS trigger_fields JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.email_notification_rules ADD COLUMN IF NOT EXISTS recipient_users JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.email_notification_rules ADD COLUMN IF NOT EXISTS notify_site_manager BOOLEAN DEFAULT false;
ALTER TABLE public.email_notification_rules ADD COLUMN IF NOT EXISTS entity_table TEXT;
ALTER TABLE public.email_notification_rules ADD COLUMN IF NOT EXISTS event_kind TEXT;
ALTER TABLE public.email_notification_rules ADD COLUMN IF NOT EXISTS updated_by TEXT;
CREATE INDEX IF NOT EXISTS idx_notif_rules_entity ON public.email_notification_rules(entity_table);
