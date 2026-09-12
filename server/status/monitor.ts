import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '../supabase.js';
import { SERVICES, type ProbeResult, type ServiceStatus, type StartupJobs } from './probes.js';

/**
 * Background status monitor.
 *
 * Probes every service on an interval, turns raw results into a confirmed
 * status (one failed check does not change what the page shows), opens and
 * resolves incidents automatically, and keeps the 90-day uptime roll-up.
 *
 * GET /api/status is served from the in-memory snapshot built here, so the
 * public endpoint never reaches the database or a dependency per request.
 * State is persisted to the status_* tables when they exist; without them the
 * monitor still works, but history resets on restart (`persisted: false`).
 */

function intervalSeconds(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(n, 3), 3600) : fallback;
}

const INTERVAL_MS = intervalSeconds(process.env.STATUS_CHECK_INTERVAL_SECONDS, 10) * 1000;
/** Consecutive checks needed before a status change is shown (1 = immediate failure reflection). */
const CONFIRM_CHECKS = 1;
/** Consecutive healthy checks before an automatic incident is resolved. */
const RESOLVE_AFTER_HEALTHY_CHECKS = 5;
const HISTORY_DAYS = 90;
const PAST_INCIDENT_LIMIT = 25;
const TIME_ZONE = 'Europe/London';

export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type Impact = Exclude<ServiceStatus, 'operational'>;

export interface IncidentUpdate {
  status: IncidentStatus;
  message: string;
  at: string;
}

export interface Incident {
  id: string;
  title: string;
  impact: Impact;
  status: IncidentStatus;
  serviceIds: string[];
  description: string;
  source: 'auto' | 'manual';
  startedAt: string;
  resolvedAt: string | null;
  updates: IncidentUpdate[];
}

export interface Maintenance {
  id: string;
  title: string;
  description: string;
  impact: string;
  /** Empty means every service. */
  serviceIds: string[];
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

interface DayCounts {
  total: number;
  operational: number;
  degraded: number;
  partial: number;
  major: number;
  maintenance: number;
}

interface ServiceState {
  confirmed: ServiceStatus | null;
  message: string;
  candidate: ServiceStatus | null;
  candidateCount: number;
  badStreak: number;
  healthyStreak: number;
  latencyMs: number | null;
  checkedAt: string | null;
}

interface CheckRow {
  service_id: string;
  status: ServiceStatus;
  latency_ms: number | null;
}

const SEVERITY: Record<ServiceStatus, number> = {
  operational: 0,
  maintenance: 1,
  degraded_performance: 2,
  partial_outage: 3,
  major_outage: 4,
};

const IMPACT_LABEL: Record<Impact, string> = {
  degraded_performance: 'Degraded performance',
  partial_outage: 'Partial outage',
  major_outage: 'Major outage',
  maintenance: 'Maintenance',
};

const IMPACT_SUMMARY: Record<Impact, string> = {
  degraded_performance: 'Some users may experience slower than normal response times.',
  partial_outage: 'Some features may be unavailable or fail intermittently.',
  major_outage: 'The service is currently unavailable for most users.',
  maintenance: 'The service is undergoing maintenance.',
};

const COUNT_KEY: Record<ServiceStatus, keyof DayCounts> = {
  operational: 'operational',
  degraded_performance: 'degraded',
  partial_outage: 'partial',
  major_outage: 'major',
  maintenance: 'maintenance',
};

const isBad = (status: ServiceStatus) => status !== 'operational' && status !== 'maintenance';
const isMissingTable = (code?: string) => code === '42P01' || code === 'PGRST205';
const emptyCounts = (): DayCounts => ({ total: 0, operational: 0, degraded: 0, partial: 0, major: 0, maintenance: 0 });

const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const londonDay = (date: Date) => dayFormatter.format(date);

/** The last `count` calendar days in London time, oldest first, as YYYY-MM-DD. */
function lastDays(count: number): string[] {
  const [y, m, d] = londonDay(new Date()).split('-').map(Number);
  const today = Date.UTC(y, m - 1, d);
  return Array.from({ length: count }, (_, i) =>
    new Date(today - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}

function rowToIncident(row: any): Incident {
  return {
    id: row.id,
    title: row.title,
    impact: row.impact,
    status: row.status,
    serviceIds: row.service_ids || [],
    description: row.description || '',
    source: row.source,
    startedAt: row.started_at,
    resolvedAt: row.resolved_at,
    updates: (row.status_incident_updates || [])
      .map((u: any) => ({ status: u.status, message: u.message, at: u.created_at }))
      .sort((a: IncidentUpdate, b: IncidentUpdate) => a.at.localeCompare(b.at)),
  };
}

function rowToMaintenance(row: any): Maintenance {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    impact: row.impact || '',
    serviceIds: row.service_ids || [],
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  };
}

class StatusMonitor {
  private selfBaseUrl = '';
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastCycleAt: number | null = null;
  private startup: StartupJobs = { migrationApplied: null, seedErrors: 0, startedAt: Date.now() };
  private readonly states = new Map<string, ServiceState>();
  private incidents: Incident[] = [];
  /** Incidents that exist only in memory because the store rejected or could not take them. */
  private readonly unsaved = new Set<string>();
  private maintenance: Maintenance[] = [];
  /** day -> service -> counts, used when the status tables are unavailable. */
  private readonly memoryDays = new Map<string, Map<string, DayCounts>>();
  /** day -> counts summed across services, as last read from status_daily. */
  private storedDays = new Map<string, DayCounts>();
  private storeAvailable: boolean | null = null;
  private storeWarned = false;

  constructor() {
    for (const svc of SERVICES) {
      this.states.set(svc.id, {
        confirmed: null,
        message: 'Checking…',
        candidate: null,
        candidateCount: 0,
        badStreak: 0,
        healthyStreak: 0,
        latencyMs: null,
        checkedAt: null,
      });
    }
  }

  async triggerCycle() {
    await this.runCycle();
  }

  recordProcessError(type: string, detail: string) {
    const targetId = type.toLowerCase().includes('db') ? 'database' : 'web';
    const state = this.states.get(targetId) || this.states.get('web');
    if (state) {
      state.confirmed = 'degraded_performance';
      state.message = `Process error detected (${type})`;
      state.badStreak++;
    }
    const now = new Date();
    const open = this.incidents.find(i => i.source === 'auto' && !i.resolvedAt && (i.serviceIds.includes('web') || i.serviceIds.includes(targetId)));
    if (!open) {
      const incident: Incident = {
        id: randomUUID(),
        title: `Process runtime warning (${type})`,
        impact: 'degraded_performance',
        status: 'investigating',
        serviceIds: [targetId],
        description: `Process error detected: ${detail.slice(0, 200)}`,
        source: 'auto',
        startedAt: now.toISOString(),
        resolvedAt: null,
        updates: [
          { status: 'investigating', message: `Monitor detected process exception: ${detail.slice(0, 120)}`, at: now.toISOString() }
        ]
      };
      this.incidents.unshift(incident);
    }
  }

  setStartupResult(result: { migrationApplied: boolean; seedErrors: number }) {
    this.startup = { ...this.startup, ...result };
  }

  start(selfBaseUrl: string) {
    if (this.timer || process.env.STATUS_MONITOR === 'off') return;
    this.selfBaseUrl = selfBaseUrl.replace(/\/+$/, '');
    const tick = () => {
      this.runCycle().catch(err => console.error('[Status] Monitor cycle failed:', err));
    };
    tick();
    this.timer = setInterval(tick, INTERVAL_MS);
    this.timer.unref();
    console.log(`[Status] Monitoring ${SERVICES.length} services every ${INTERVAL_MS / 1000}s`);
  }

  private async runCycle() {
    if (this.running) return;
    this.running = true;
    try {
      await this.loadStore();
      const now = new Date();
      const inMaintenance = this.activeMaintenance(now.getTime());

      const results = await Promise.all(
        SERVICES.map(async (svc): Promise<ProbeResult> => {
          try {
            return await svc.probe({
              selfBaseUrl: this.selfBaseUrl,
              startup: this.startup,
              statusStoreAvailable: this.storeAvailable,
            });
          } catch (err) {
            return { status: 'major_outage', latencyMs: null, message: 'Status check failed', detail: String((err as Error)?.message || err) };
          }
        }),
      );

      const checks: CheckRow[] = [];
      for (const [i, svc] of SERVICES.entries()) {
        const raw = results[i];
        const state = this.states.get(svc.id)!;
        const previous = state.confirmed;
        const maintained = inMaintenance.some(m => m.serviceIds.length === 0 || m.serviceIds.includes(svc.id));

        this.applyResult(state, maintained ? { ...raw, status: 'maintenance', message: 'Scheduled maintenance in progress' } : raw, now);

        const confirmed = state.confirmed!;
        if (confirmed !== previous && (previous !== null || isBad(confirmed))) {
          const log = isBad(confirmed) ? console.warn : console.log;
          log(`[Status] ${svc.name}: ${previous ?? 'starting'} -> ${confirmed}${raw.detail ? ` (${raw.detail})` : ''}`);
        }
        if (!maintained) await this.reconcileIncident(svc.id, svc.name, state, now);
        checks.push({ service_id: svc.id, status: this.effectiveStatus(svc.id, confirmed), latency_ms: raw.latencyMs });
      }

      await this.recordChecks(checks, now);
      this.lastCycleAt = Date.now();
    } finally {
      this.running = false;
    }
  }

  private applyResult(state: ServiceState, result: ProbeResult, now: Date) {
    state.latencyMs = result.latencyMs;
    state.checkedAt = now.toISOString();
    state.badStreak = isBad(result.status) ? state.badStreak + 1 : 0;
    state.healthyStreak = result.status === 'operational' ? state.healthyStreak + 1 : 0;

    const confirm = () => {
      state.confirmed = result.status;
      state.message = result.message;
      state.candidate = null;
      state.candidateCount = 0;
    };

    // First check, no change, entering/leaving maintenance, or any failure: show immediately.
    if (
      state.confirmed === null ||
      state.confirmed === result.status ||
      state.confirmed === 'maintenance' ||
      result.status === 'maintenance' ||
      isBad(result.status)
    ) {
      confirm();
      return;
    }

    state.candidateCount = state.candidate === result.status ? state.candidateCount + 1 : 1;
    state.candidate = result.status;
    // A service flapping between failure levels is still failing: confirm on
    // the bad streak even when the exact level has not repeated.
    if (state.candidateCount >= CONFIRM_CHECKS || (isBad(result.status) && state.badStreak >= CONFIRM_CHECKS)) {
      confirm();
    }
  }

  private async reconcileIncident(serviceId: string, serviceName: string, state: ServiceState, now: Date) {
    const status = state.confirmed!;
    const at = now.toISOString();
    const open = this.incidents.find(i => i.source === 'auto' && !i.resolvedAt && i.serviceIds.includes(serviceId));

    if (isBad(status) && state.badStreak >= CONFIRM_CHECKS) {
      const impact = status as Impact;
      if (!open) {
        const incident: Incident = {
          id: randomUUID(),
          title: `${IMPACT_LABEL[impact]}: ${serviceName}`,
          impact,
          status: 'investigating',
          serviceIds: [serviceId],
          description: `${IMPACT_SUMMARY[impact]} This was detected automatically by SDTracker monitoring.`,
          source: 'auto',
          startedAt: at,
          resolvedAt: null,
          updates: [],
        };
        this.incidents.unshift(incident);
        await this.saveIncident(incident, true);
        await this.addUpdate(incident, 'investigating', `Automated monitoring detected ${IMPACT_LABEL[impact].toLowerCase()} affecting ${serviceName}. We are investigating.`, at);
        return;
      }
      if (open.status === 'monitoring') {
        await this.addUpdate(open, 'investigating', `The issue affecting ${serviceName} has recurred. We are investigating.`, at);
      }
      if (open.impact !== impact) {
        const direction = SEVERITY[impact] > SEVERITY[open.impact] ? 'increased' : 'reduced';
        open.impact = impact;
        open.title = `${IMPACT_LABEL[impact]}: ${serviceName}`;
        open.description = `${IMPACT_SUMMARY[impact]} This was detected automatically by SDTracker monitoring.`;
        await this.addUpdate(open, open.status, `Impact has ${direction} to ${IMPACT_LABEL[impact].toLowerCase()}.`, at);
      }
      return;
    }

    if (!open || status !== 'operational') return;
    if (state.healthyStreak >= RESOLVE_AFTER_HEALTHY_CHECKS) {
      open.resolvedAt = at;
      const minutes = Math.max(1, Math.round((RESOLVE_AFTER_HEALTHY_CHECKS * INTERVAL_MS) / 60_000));
      await this.addUpdate(open, 'resolved', `${serviceName} has been operating normally for ${minutes} minutes. This incident has been resolved.`, at);
    } else if (open.status !== 'monitoring') {
      await this.addUpdate(open, 'monitoring', `${serviceName} is responding normally again. We are monitoring to confirm full recovery.`, at);
    }
  }

  private async addUpdate(incident: Incident, status: IncidentStatus, message: string, at: string) {
    incident.status = status;
    incident.updates.push({ status, message, at });
    console.log(`[Status] Incident "${incident.title}": ${status}`);
    await this.saveIncident(incident, false);

    const admin = this.storeAvailable ? getSupabaseAdmin() : null;
    if (!admin || this.unsaved.has(incident.id)) return;
    const { error } = await admin
      .from('status_incident_updates')
      .insert({ incident_id: incident.id, status, message, created_at: at });
    if (error) console.warn(`[Status] Incident update not persisted: ${error.message}`);
  }

  private async saveIncident(incident: Incident, isNew: boolean) {
    const admin = this.storeAvailable ? getSupabaseAdmin() : null;
    if (!admin) {
      this.unsaved.add(incident.id);
      return;
    }
    const row = {
      id: incident.id,
      title: incident.title,
      impact: incident.impact,
      status: incident.status,
      service_ids: incident.serviceIds,
      description: incident.description,
      source: incident.source,
      started_at: incident.startedAt,
      resolved_at: incident.resolvedAt,
      updated_at: new Date().toISOString(),
    };
    const { error } = isNew
      ? await admin.from('status_incidents').insert(row)
      : await admin.from('status_incidents').update(row).eq('id', incident.id);
    if (error) {
      console.warn(`[Status] Incident not persisted: ${error.message}`);
      if (isNew) this.unsaved.add(incident.id);
    }
  }

  /** Refresh incidents, maintenance and uptime from the store (picks up manual edits). */
  private async loadStore() {
    const admin = getSupabaseAdmin();
    if (!admin) {
      this.storeAvailable = false;
      return;
    }

    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
    const maintenanceSince = new Date(Date.now() - 7 * 86_400_000).toISOString();
    try {
      const [incidentsRes, maintenanceRes, daysRes] = await Promise.all([
        admin
          .from('status_incidents')
          .select('id,title,impact,status,service_ids,description,source,started_at,resolved_at,status_incident_updates(status,message,created_at)')
          .or(`resolved_at.is.null,started_at.gte."${since}"`)
          .order('started_at', { ascending: false })
          .limit(100),
        admin
          .from('status_maintenance')
          .select('id,title,description,impact,service_ids,starts_at,ends_at,status')
          .neq('status', 'cancelled')
          .gte('ends_at', maintenanceSince)
          .order('starts_at', { ascending: true })
          .limit(50),
        admin
          .from('status_daily')
          .select('day,checks_total,checks_operational,checks_degraded,checks_partial,checks_major,checks_maintenance')
          .gte('day', lastDays(HISTORY_DAYS)[0])
          .limit(HISTORY_DAYS * SERVICES.length * 2),
      ]);

      const error = incidentsRes.error || maintenanceRes.error || daysRes.error;
      if (error) {
        if (isMissingTable(error.code)) {
          this.storeAvailable = false;
          if (!this.storeWarned) {
            console.warn('[Status] status_* tables not found: incidents and uptime are kept in memory until db/migrations/003_status_monitoring.sql is applied.');
            this.storeWarned = true;
          }
        } else {
          console.warn(`[Status] Could not read the status store: ${error.message}`);
        }
        return;
      }

      const unsaved = this.incidents.filter(i => this.unsaved.has(i.id));
      this.incidents = [...unsaved, ...(incidentsRes.data || []).map(rowToIncident)];
      this.maintenance = (maintenanceRes.data || []).map(rowToMaintenance);

      const days = new Map<string, DayCounts>();
      for (const row of daysRes.data || []) {
        const counts = days.get(row.day) ?? emptyCounts();
        counts.total += row.checks_total;
        counts.operational += row.checks_operational;
        counts.degraded += row.checks_degraded;
        counts.partial += row.checks_partial;
        counts.major += row.checks_major;
        counts.maintenance += row.checks_maintenance;
        days.set(row.day, counts);
      }
      this.storedDays = days;
      this.storeAvailable = true;
    } catch (err) {
      console.warn(`[Status] Could not read the status store: ${(err as Error)?.message || err}`);
    }
  }

  private async recordChecks(checks: CheckRow[], now: Date) {
    const day = londonDay(now);
    const byService = this.memoryDays.get(day) ?? new Map<string, DayCounts>();
    this.memoryDays.set(day, byService);
    for (const check of checks) {
      const counts = byService.get(check.service_id) ?? emptyCounts();
      counts.total += 1;
      counts[COUNT_KEY[check.status]] += 1;
      byService.set(check.service_id, counts);
    }
    const oldest = lastDays(HISTORY_DAYS)[0];
    for (const key of this.memoryDays.keys()) {
      if (key < oldest) this.memoryDays.delete(key);
    }

    const admin = this.storeAvailable ? getSupabaseAdmin() : null;
    if (!admin) return;
    const { error } = await admin.rpc('status_record_checks', { p_day: day, p_checks: checks });
    if (error) {
      console.warn(`[Status] Uptime not persisted: ${error.message}`);
      return;
    }
    // Reflect this cycle until the next store refresh re-reads the totals.
    const stored = this.storedDays.get(day) ?? emptyCounts();
    for (const check of checks) {
      stored.total += 1;
      stored[COUNT_KEY[check.status]] += 1;
    }
    this.storedDays.set(day, stored);
  }

  private activeMaintenance(now: number): Maintenance[] {
    return this.maintenance.filter(
      m => m.status !== 'cancelled' && m.status !== 'completed' && Date.parse(m.startsAt) <= now && now < Date.parse(m.endsAt),
    );
  }

  /** A manually declared incident can report worse than the probes measure. */
  private effectiveStatus(serviceId: string, measured: ServiceStatus): ServiceStatus {
    return this.incidents
      .filter(i => i.source === 'manual' && !i.resolvedAt && i.serviceIds.includes(serviceId))
      .reduce<ServiceStatus>((worst, i) => (SEVERITY[i.impact] > SEVERITY[worst] ? i.impact : worst), measured);
  }

  private uptimeDays() {
    const useStore = this.storeAvailable === true;
    return lastDays(HISTORY_DAYS).map(date => {
      if (useStore) return { date, ...(this.storedDays.get(date) ?? emptyCounts()) };
      const counts = emptyCounts();
      for (const service of this.memoryDays.get(date)?.values() ?? []) {
        for (const key of Object.keys(counts) as (keyof DayCounts)[]) counts[key] += service[key];
      }
      return { date, ...counts };
    });
  }

  /** The public, sanitised view served by GET /api/status. */
  snapshot() {
    const now = Date.now();
    const stale = this.lastCycleAt !== null && now - this.lastCycleAt > INTERVAL_MS * 3;

    const services = SERVICES.map(svc => {
      const state = this.states.get(svc.id)!;
      let status: ServiceStatus | 'unknown' = state.confirmed ? this.effectiveStatus(svc.id, state.confirmed) : 'unknown';
      let message = state.message;
      if (svc.id === 'jobs' && stale) {
        status = 'partial_outage';
        message = 'Status checks are delayed';
      }
      return {
        id: svc.id,
        name: svc.name,
        description: svc.description,
        status,
        message,
        latencyMs: state.latencyMs,
        checkedAt: state.checkedAt,
      };
    });

    const active = this.incidents.filter(i => !i.resolvedAt);
    const past = this.incidents
      .filter(i => i.resolvedAt)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, PAST_INCIDENT_LIMIT);

    const maintenance = this.maintenance.map(m => {
      const starts = Date.parse(m.startsAt);
      const ends = Date.parse(m.endsAt);
      const status = m.status === 'completed' || ends <= now ? 'completed' : starts <= now ? 'in_progress' : 'scheduled';
      return { ...m, status };
    });

    return {
      generatedAt: new Date(now).toISOString(),
      monitor: {
        intervalSeconds: INTERVAL_MS / 1000,
        lastCheckAt: this.lastCycleAt ? new Date(this.lastCycleAt).toISOString() : null,
        stale,
        persisted: this.storeAvailable === true,
      },
      services,
      incidents: { active, past },
      maintenance,
      uptime: { timeZone: TIME_ZONE, days: this.uptimeDays() },
    };
  }
}

export const statusMonitor = new StatusMonitor();
