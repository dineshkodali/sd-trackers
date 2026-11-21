/**
 * Operations Dashboard - Recent Activity (pure).
 *
 * Source: the audit trail only. Data writes are audited by the server inside the write itself (server clock, verified
 * user, entity type and id), so a row here is a real change made by a real person. Nothing is generated from Realtime
 * events, and nothing is shown for a record that merely appears in a task list.
 *
 * One change = one row: rows are de-duplicated by audit id, and by (entity, record, action, user) inside the same minute
 * (a form that saves twice in a burst is one activity).
 */

export interface AuditRow {
  id: string;
  timestamp: string;
  action: string;
  module?: string;
  targetItem?: string;
  performedByUser?: string;
  site?: string;
  entityType?: string;
  entityId?: string;
}

export type ActivityVerb = 'Created' | 'Updated' | 'Archived' | 'Restored' | 'Deleted';
const VERBS: Record<string, ActivityVerb> = { CREATE: 'Created', UPDATE: 'Updated', ARCHIVE: 'Archived', RESTORE: 'Restored', DELETE: 'Deleted' };

/** Audit entity key -> the page that owns that record. Anything not listed gets no link (it is never guessed). */
export const ENTITY_PAGE: Record<string, string> = {
  maintenance: 'maintenance', compliance: 'compliance', escalations: 'escalations', welfareChecks: 'welfareChecks', roomChecks: 'roomChecks',
  dispersal: 'dispersal', newArrivals: 'dailyRegisters', evictions: 'dailyRegisters', dailyRegisterRooms: 'dailyRegisters', dailyRegisterRecords: 'dailyRegisters',
  laundry: 'laundry', peepPlans: 'peepTracker', absenceFollowups: 'suAttendance', suAttendance: 'suAttendance', serviceUsers: 'suUsers',
  properties: 'propertyManagement', propertyRooms: 'propertyManagement', referrals: 'referrals', vulnerable: 'vulnerable', challenging: 'challenging',
  publicTransport: 'publicTransport', irRecords: 'irTracker', spcd: 'spcd'
};

export interface ActivityRow {
  id: string;
  /** ISO timestamp, server-generated */
  at: string;
  module: string;
  record: string;
  verb: ActivityVerb;
  by: string;
  site: string;
  /** null when the owning page is unknown */
  page: string | null;
  /** null for a deleted record (nothing left to open) or when no id was stored */
  recordId: string | null;
}

const minuteOf = (iso: string) => iso.slice(0, 16);

export function selectRecentActivity(
  logs: AuditRow[],
  opts: { limit?: number; inScope: (site: string | undefined) => boolean }
): ActivityRow[] {
  const limit = opts.limit ?? 12;
  const rows = logs
    .filter(l => VERBS[String(l.action)] && !!l.timestamp && !Number.isNaN(new Date(l.timestamp).getTime()) && opts.inScope(l.site))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() || String(b.id).localeCompare(String(a.id)));

  const seenIds = new Set<string>();
  const seenBursts = new Set<string>();
  const out: ActivityRow[] = [];
  for (const l of rows) {
    if (seenIds.has(l.id)) continue;
    seenIds.add(l.id);
    const burst = [l.entityType || l.module, l.entityId || l.targetItem, l.action, l.performedByUser, minuteOf(new Date(l.timestamp).toISOString())].join('|');
    if (seenBursts.has(burst)) continue;
    seenBursts.add(burst);
    const verb = VERBS[l.action];
    const page = l.entityType ? ENTITY_PAGE[l.entityType] ?? null : null;
    out.push({
      id: l.id, at: new Date(l.timestamp).toISOString(), module: l.module || l.entityType || '—', record: l.targetItem || l.entityId || '—', verb,
      by: l.performedByUser || '—', site: l.site || '—', page,
      recordId: verb === 'Deleted' || !l.entityId ? null : l.entityId
    });
    if (out.length >= limit) break;
  }
  return out;
}
