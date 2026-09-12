import { monitorEventLoopDelay } from 'perf_hooks';
import {
  getSupabaseAdmin,
  getSupabasePublishableKey,
  getSupabaseSecretKey,
  getSupabaseUrl,
} from '../supabase.js';
import { getMailer, isSmtpConfigured } from '../mailer.js';

/**
 * Health probes behind the public status page.
 *
 * Each probe checks one user-facing SDTracker service against the real
 * dependency it relies on. `message` is shown publicly, so it never carries
 * hostnames, error text or configuration details; diagnostic detail goes in
 * `detail`, which is only written to the server log.
 */

export type ServiceStatus =
  | 'operational'
  | 'degraded_performance'
  | 'partial_outage'
  | 'major_outage'
  | 'maintenance';

export interface ProbeResult {
  status: ServiceStatus;
  latencyMs: number | null;
  message: string;
  /** Server log only - never sent to the status page. */
  detail?: string;
}

export interface StartupJobs {
  /** null while the boot migration is still running. */
  migrationApplied: boolean | null;
  seedErrors: number;
  startedAt: number;
}

export interface ProbeContext {
  selfBaseUrl: string;
  startup: StartupJobs;
  /** Whether the status tables could be read - proof the schema is in place. */
  statusStoreAvailable: boolean | null;
}

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  probe: (ctx: ProbeContext) => Promise<ProbeResult>;
}

const PROBE_TIMEOUT_MS = 8_000;
const SMTP_TIMEOUT_MS = 15_000;
const SMTP_VERIFY_EVERY_MS = 5 * 60_000;
const NOTIFICATION_WINDOW_MS = 60 * 60_000;
const STARTUP_GRACE_MS = 10 * 60_000;

const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
eventLoopDelay.enable();

const operational = (latencyMs: number | null, message = 'Operating normally'): ProbeResult => ({
  status: 'operational',
  latencyMs,
  message,
});

function bySpeed(latencyMs: number, slowAfterMs: number): ProbeResult {
  return latencyMs > slowAfterMs
    ? { status: 'degraded_performance', latencyMs, message: 'Slower than normal response times', detail: `${latencyMs} ms` }
    : operational(latencyMs);
}

function describeError(err: unknown): string {
  const e = err as { name?: string; message?: string; code?: string } | undefined;
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'timed out';
  return String(e?.code ? `${e.code} ${e.message}` : e?.message || err).slice(0, 200);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const isMissingTable = (code?: string) => code === '42P01' || code === 'PGRST205';

interface HttpProbeOptions {
  headers?: Record<string, string>;
  slowAfterMs: number;
  accept: (res: Response, body: string) => boolean;
}

async function probeHttp(url: string, opts: HttpProbeOptions): Promise<ProbeResult> {
  const started = performance.now();
  try {
    const res = await fetch(url, {
      headers: opts.headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const body = await res.text();
    const latencyMs = Math.round(performance.now() - started);
    if (res.status >= 500) {
      return { status: 'major_outage', latencyMs, message: 'Not responding correctly', detail: `HTTP ${res.status}` };
    }
    if (res.status === 429) {
      return { status: 'degraded_performance', latencyMs, message: 'Under heavy load', detail: 'HTTP 429' };
    }
    if (!opts.accept(res, body)) {
      return { status: 'partial_outage', latencyMs, message: 'Responding with unexpected results', detail: `HTTP ${res.status}` };
    }
    return bySpeed(latencyMs, opts.slowAfterMs);
  } catch (err) {
    return { status: 'major_outage', latencyMs: null, message: 'Not responding', detail: describeError(err) };
  }
}

/** A one-row read through the Supabase data API, as the application performs it. */
async function probeTable(table: string, slowAfterMs: number): Promise<ProbeResult> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { status: 'major_outage', latencyMs: null, message: 'Not available', detail: 'Supabase is not configured' };
  }
  const started = performance.now();
  try {
    const { error } = await admin
      .from(table)
      .select('id')
      .limit(1)
      .abortSignal(AbortSignal.timeout(PROBE_TIMEOUT_MS));
    const latencyMs = Math.round(performance.now() - started);
    if (error) {
      return isMissingTable(error.code)
        ? { status: 'partial_outage', latencyMs, message: 'Some records are unavailable', detail: `${table}: table missing` }
        : { status: 'major_outage', latencyMs, message: 'Not responding', detail: `${table}: ${error.code || ''} ${error.message}` };
    }
    return bySpeed(latencyMs, slowAfterMs);
  } catch (err) {
    return { status: 'major_outage', latencyMs: null, message: 'Not responding', detail: `${table}: ${describeError(err)}` };
  }
}

// SMTP verification opens a real session with the mail provider, so it is
// rate-limited independently of the monitor interval.
let smtpCheck: { at: number; ok: boolean; latencyMs: number | null; detail?: string } | null = null;

async function verifySmtp() {
  if (smtpCheck && Date.now() - smtpCheck.at < SMTP_VERIFY_EVERY_MS) return smtpCheck;
  const mailer = getMailer();
  const started = performance.now();
  try {
    if (!mailer) throw new Error('transporter unavailable');
    await withTimeout(mailer.verify(), SMTP_TIMEOUT_MS);
    smtpCheck = { at: Date.now(), ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    smtpCheck = { at: Date.now(), ok: false, latencyMs: null, detail: describeError(err) };
  }
  return smtpCheck;
}

export const SERVICES: ServiceDefinition[] = [
  {
    id: 'web',
    name: 'Web Application',
    description: 'The SDTracker website and user interface',
    probe: ctx =>
      probeHttp((process.env.STATUS_WEB_URL || '').trim() || `${ctx.selfBaseUrl}/`, {
        slowAfterMs: 3_000,
        accept: (res, body) => res.ok && /<html|<!doctype/i.test(body),
      }),
  },
  {
    id: 'auth',
    name: 'Authentication',
    description: 'Sign-in, sessions and password resets',
    probe: async () => {
      const url = getSupabaseUrl();
      const key = getSupabasePublishableKey() || getSupabaseSecretKey();
      if (!url || !key) {
        return { status: 'major_outage', latencyMs: null, message: 'Sign-in is unavailable', detail: 'Supabase is not configured' };
      }
      return probeHttp(`${url.trim().replace(/\/+$/, '')}/auth/v1/health`, {
        headers: { apikey: key.trim() },
        slowAfterMs: 2_000,
        accept: res => res.ok,
      });
    },
  },
  {
    id: 'database',
    name: 'Database',
    description: 'Record storage and retrieval',
    probe: () => probeTable('sites', 1_500),
  },
  {
    id: 'api',
    name: 'API Services',
    description: 'Application API used by the web app',
    probe: async ctx => {
      const result = await probeHttp(`${ctx.selfBaseUrl}/api/health`, {
        slowAfterMs: 1_000,
        accept: (res, body) => res.ok && body.includes('"status":"ok"'),
      });
      const lagMs = Math.round(eventLoopDelay.percentile(99) / 1e6);
      eventLoopDelay.reset();
      if (result.status === 'operational' && lagMs > 500) {
        return { ...result, status: 'degraded_performance', message: 'Slower than normal response times', detail: `event loop p99 ${lagMs} ms` };
      }
      return result;
    },
  },
  {
    id: 'files',
    name: 'File & Document Services',
    description: 'Document register and record attachments',
    probe: () => probeTable('documents', 2_000),
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Email alerts and notification delivery',
    probe: async () => {
      if (!isSmtpConfigured()) {
        return { status: 'partial_outage', latencyMs: null, message: 'Email notifications are not being delivered', detail: 'SMTP is not configured' };
      }
      const smtp = await verifySmtp();
      if (!smtp.ok) {
        return { status: 'partial_outage', latencyMs: null, message: 'Email notifications are delayed', detail: `SMTP verify failed: ${smtp.detail}` };
      }

      const admin = getSupabaseAdmin();
      if (admin) {
        try {
          const since = new Date(Date.now() - NOTIFICATION_WINDOW_MS).toISOString();
          const { data, error } = await admin
            .from('email_notification_logs')
            .select('status')
            .gte('dispatched_at', since)
            .limit(500)
            .abortSignal(AbortSignal.timeout(PROBE_TIMEOUT_MS));
          if (!error && data && data.length > 0) {
            const failed = data.filter(row => row.status === 'failed').length;
            const ratio = failed / data.length;
            const detail = `${failed}/${data.length} deliveries failed in the last hour`;
            if (failed >= 3 && ratio >= 0.5) {
              return { status: 'partial_outage', latencyMs: smtp.latencyMs, message: 'Some email notifications are failing to send', detail };
            }
            if (failed >= 2 && ratio >= 0.2) {
              return { status: 'degraded_performance', latencyMs: smtp.latencyMs, message: 'Some email notifications are delayed', detail };
            }
          }
        } catch {
          // The delivery log is supporting evidence only; SMTP itself verified.
        }
      }
      return operational(smtp.latencyMs);
    },
  },
  {
    id: 'reporting',
    name: 'Reporting',
    description: 'Reports, audit trail and exports',
    probe: () => probeTable('audit_trails', 3_000),
  },
  {
    id: 'jobs',
    name: 'Background Jobs',
    description: 'Scheduled and startup processing',
    probe: async ctx => {
      const { migrationApplied, seedErrors, startedAt } = ctx.startup;
      if (migrationApplied === null) {
        return Date.now() - startedAt < STARTUP_GRACE_MS
          ? operational(null, 'Startup tasks are running')
          : { status: 'degraded_performance', latencyMs: null, message: 'Some scheduled tasks are delayed', detail: 'boot migration has not finished' };
      }
      if (!migrationApplied && ctx.statusStoreAvailable === false) {
        return { status: 'degraded_performance', latencyMs: null, message: 'Some scheduled tasks are pending', detail: 'boot migration not applied and status tables are missing' };
      }
      if (seedErrors > 0) {
        return { status: 'degraded_performance', latencyMs: null, message: 'Some scheduled tasks reported errors', detail: `${seedErrors} reference data seed error(s)` };
      }
      return operational(null);
    },
  },
];
