import { supabase } from '../lib/supabaseClient';
import type { NotificationRule, EmailNotificationLog } from '../types';

/**
 * Notification settings read and written straight from the database, for sites hosted without the SDTracker
 * server (static hosting). Only real rows are returned; nothing is invented. Sending email needs the server.
 */

const MASTER_KEY = 'email_notifications_master';

const rowToRule = (r: any): NotificationRule => ({
  id: r.id,
  eventCode: r.event_code,
  module: r.module,
  title: r.title,
  description: r.description || '',
  enabled: r.enabled !== false,
  minSeverity: r.min_severity || 'All',
  recipientRoles: r.recipient_roles || [],
  customRecipients: r.custom_recipients || [],
  customCc: r.custom_cc || [],
  subjectTemplate: r.subject_template || '',
  includeMetadata: r.include_metadata !== false,
  lastDispatchedAt: r.last_dispatched_at,
  dispatchCount: r.dispatch_count || 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  bodyTemplate: r.body_template ?? '',
  includeLink: r.include_link !== false,
  triggerFields: r.trigger_fields || [],
  recipientUsers: r.recipient_users || [],
  notifySiteManager: !!r.notify_site_manager,
  entityTable: r.entity_table ?? undefined,
  eventKind: r.event_kind ?? undefined,
  updatedBy: r.updated_by ?? undefined
});

const isMissingColumn = (e: any) => e?.code === 'PGRST204' || e?.code === '42703' || /could not find the .* column|column .* does not exist/i.test(String(e?.message || ''));

export const emailNotificationDirect = {
  async getRules(): Promise<NotificationRule[] | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.from('email_notification_rules').select('*').order('module', { ascending: true });
    if (error) { console.warn('Notification rules read failed:', error.message); return null; }
    return (data || []).map(rowToRule);
  },

  async updateRule(id: string, updates: Partial<NotificationRule>, by?: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Database not configured' };
    const u: any = updates;
    const base: Record<string, any> = {};
    if (u.enabled !== undefined) base.enabled = !!u.enabled;
    if (u.minSeverity !== undefined) base.min_severity = u.minSeverity;
    if (u.recipientRoles !== undefined) base.recipient_roles = u.recipientRoles;
    if (u.customRecipients !== undefined) base.custom_recipients = u.customRecipients;
    if (u.customCc !== undefined) base.custom_cc = u.customCc;
    if (u.subjectTemplate !== undefined) base.subject_template = u.subjectTemplate;
    if (u.includeMetadata !== undefined) base.include_metadata = !!u.includeMetadata;
    const extra: Record<string, any> = {};
    if (u.bodyTemplate !== undefined) extra.body_template = String(u.bodyTemplate).slice(0, 5000);
    if (u.includeLink !== undefined) extra.include_link = !!u.includeLink;
    if (u.triggerFields !== undefined) extra.trigger_fields = u.triggerFields;
    if (u.recipientUsers !== undefined) extra.recipient_users = u.recipientUsers;
    if (u.notifySiteManager !== undefined) extra.notify_site_manager = !!u.notifySiteManager;
    if (by) extra.updated_by = by;
    base.updated_at = new Date().toISOString();

    let res = await supabase.from('email_notification_rules').update({ ...base, ...extra }).eq('id', id).select('id');
    // Migration 036 not applied yet: still save everything the older table has
    if (res.error && isMissingColumn(res.error)) res = await supabase.from('email_notification_rules').update(base).eq('id', id).select('id');
    if (res.error) return { success: false, error: res.error.message };
    // An update that touches no row means the database refused it (row-level security) or the rule does not exist
    if (!res.data || res.data.length === 0) return { success: false, error: 'The database did not accept the change (no permission to edit notification rules, or the rule no longer exists).' };
    return { success: true };
  },

  async getMaster(): Promise<boolean | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.from('app_settings').select('value').eq('id', MASTER_KEY).maybeSingle();
    if (error) return null;
    const v: any = data?.value;
    return !(v && typeof v === 'object' && v.enabled === false);
  },

  async setMaster(enabled: boolean, by?: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Database not configured' };
    const { error } = await supabase.from('app_settings').upsert({ id: MASTER_KEY, value: { enabled }, updated_by: by || null }, { onConflict: 'id' });
    return error ? { success: false, error: error.message } : { success: true };
  },

  async getLogs(): Promise<EmailNotificationLog[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('email_notification_logs').select('*').order('dispatched_at', { ascending: false }).limit(100);
    if (error) return [];
    return (data || []).map((l: any) => ({
      id: l.id, ruleId: l.rule_id, eventCode: l.event_code, module: l.module, subject: l.subject,
      recipients: l.recipients || [], site: l.site, status: l.status, errorMessage: l.error_message,
      entityId: l.entity_id, payloadSummary: l.payload_summary, dispatchedAt: l.dispatched_at
    }) as EmailNotificationLog);
  }
};
