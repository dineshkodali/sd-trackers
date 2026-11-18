/**
 * Central notification registry (pure functions, no I/O).
 *
 * The list of modules that can send "New record" / "Record updated" emails is NOT hand-maintained:
 * it is derived from ENTITY_REGISTRY, the same table every page's saves already go through, so a new
 * page that is added to the API shows up in Email Notifications Management automatically.
 */

export interface RegistryEntity { page: string; table: string; write?: string; alias?: boolean }

export interface NotificationModuleInfo {
  table: string;
  label: string;
  /** Record fields (camelCase) an administrator can pick to limit "Record updated" emails. */
  fields: string[];
}

/** Tables that never send record emails: system configuration, audit/history, child rows and high-frequency technical writes. */
export const NOTIFICATION_EXCLUDED_TABLES = new Set([
  'audit_trails', 'field_options', 'role_permissions', 'app_settings', 'table_schemas',
  'email_notification_rules', 'email_notification_logs', 'password_audit_logs', 'profiles', 'user_groups',
  'property_user_assignments', 'ho_report_audit_logs', 'su_meal_records', 'su_meal_record_history',
  'oyster_card_events', 'oyster_card_transactions', 'peep_plan_history', 'transport_funding_status_history',
  'finance_bill_items', 'finance_bill_attachments', 'room_check_items'
]);

/**
 * Tables that already had a hand-written "<x>.created" rule before this registry. That rule IS the
 * "New record" setting for the module, so the admin sees one switch and no email is sent twice.
 */
export const LEGACY_CREATED_RULES: Record<string, string> = {
  referrals: 'referral.created',
  vulnerable_residents: 'vulnerable.created',
  escalations: 'escalation.created',
  compliance_records: 'compliance.created',
  maintenance_records: 'maintenance.created',
  public_transport_records: 'transport.created',
  gp_appointments: 'gp.created',
  rfa_welfare_checks: 'welfare.created',
  dispersal_records: 'dispersal.created',
  data_change_requests: 'change_request.created'
};

/** Columns that change on every save and say nothing about the record itself. */
export const IGNORED_CHANGE_FIELDS = new Set([
  'id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'lastModifiedAt', 'lastModifiedBy', 'modifiedAt', 'modifiedBy',
  'auditTrail', 'auditLog', 'history', 'statusHistory', 'data', 'dailyCounts', 'version', 'syncedAt', 'recordedAt'
]);

export const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());

export const genericEventCode = (table: string, kind: 'created' | 'updated') => `record.${table}.${kind}`;
export const genericRuleId = (table: string, kind: 'created' | 'updated') => `rule-rec-${table}-${kind}`;

export function buildModuleRegistry(
  entities: Record<string, RegistryEntity>,
  tableColumns: Record<string, Set<string> | string[]>
): NotificationModuleInfo[] {
  const byTable = new Map<string, NotificationModuleInfo>();
  for (const def of Object.values(entities)) {
    if (!def || def.alias) continue;
    if (def.write === 'none' || def.write === 'append') continue;
    if (NOTIFICATION_EXCLUDED_TABLES.has(def.table)) continue;
    if (byTable.has(def.table)) continue;
    const cols = tableColumns[def.table];
    const fields = Array.from(cols || [])
      .map(toCamel)
      .filter(f => !IGNORED_CHANGE_FIELDS.has(f))
      .sort();
    byTable.set(def.table, { table: def.table, label: def.page.replace(/\s+-\s+.*$/, ''), fields });
  }
  return Array.from(byTable.values()).sort((a, b) => a.label.localeCompare(b.label));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Fields whose value really changed, ignoring technical ones. */
export function changedFields(before: Record<string, any> | null | undefined, incoming: Record<string, any>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(incoming || {})) {
    if (IGNORED_CHANGE_FIELDS.has(k)) continue;
    if (!same(before ? before[k] : undefined, v)) out.push(k);
  }
  return out;
}

/** Whether an update should email, given the rule's selected trigger fields (empty = any meaningful change). */
export function updateMatchesTrigger(changed: string[], triggerFields: string[] | undefined): boolean {
  if (changed.length === 0) return false;
  if (!triggerFields || triggerFields.length === 0) return true;
  return changed.some(f => triggerFields.includes(f));
}

export const SAMPLE_RECORD_FIELDS = ['site', 'siteName', 'roomNo', 'priority', 'status', 'description', 'createdBy', 'updatedBy'];
