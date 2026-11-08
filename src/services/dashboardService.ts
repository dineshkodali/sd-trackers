import { getBrowserSupabaseClient } from '../lib/supabaseClient';
import { authHeaders, fetchWithTimeout, getApiBaseUrl, getApiUrl, isDirectSupabaseActive, shouldPreferDirectSupabase } from './apiService';
import {
  cleanDashboardName,
  sanitizeLayout,
  MAX_DASHBOARDS_PER_USER,
  type DashboardLayout,
  type DashboardRecord,
} from '../config/dashboardWidgets';

/**
 * Client for personal dashboards. Uses the Express API when present and Supabase
 * (row-level security: own rows only) on static hosts. If the dashboards table has
 * not been installed yet, dashboards are kept on this device only.
 */

export type DashboardStorage = 'database' | 'device';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const useDirect = () => (shouldPreferDirectSupabase() || isDirectSupabaseActive()) && !getApiBaseUrl();
const isMissingTable = (code?: string) => code === '42P01' || code === 'PGRST205';

class NotInstalled extends Error {}
class Unreachable extends Error {}

const localKey = (uid: string) => `sd_dashboards_${uid}`;

function readLocal(uid: string): DashboardRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(localKey(uid)) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(r => r && typeof r.id === 'string')
      .map(r => ({ id: r.id, name: cleanDashboardName(r.name), isDefault: r.isDefault === true, layout: sanitizeLayout(r.layout), updatedAt: r.updatedAt }));
  } catch {
    return [];
  }
}

function writeLocal(uid: string, rows: DashboardRecord[]) {
  try { localStorage.setItem(localKey(uid), JSON.stringify(rows)); } catch { /* storage full or blocked */ }
}

const fromRow = (r: any): DashboardRecord => ({
  id: r.id,
  name: cleanDashboardName(r.name),
  isDefault: r.is_default === true,
  layout: sanitizeLayout(r.layout),
  updatedAt: r.updated_at,
});

async function express(path: string, init: RequestInit = {}): Promise<any> {
  let res: Response;
  try {
    res = await fetchWithTimeout(getApiUrl(path), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init.headers || {}) },
    }, 8000);
  } catch {
    throw new Unreachable('Server unreachable');
  }
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON body */ }
  if (json?.notInstalled) throw new NotInstalled();
  if (res.status === 404 && !json) throw new Unreachable('API not available');
  if (res.status >= 502 && !json?.error) throw new Unreachable('Server unreachable');
  if (!res.ok || json?.success === false) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
}

function directError(error: any): never {
  if (isMissingTable(error?.code)) throw new NotInstalled();
  if (error?.code === '54000') throw new Error(`You can have up to ${MAX_DASHBOARDS_PER_USER} dashboards.`);
  throw new Error('Could not reach the database.');
}

async function remoteList(): Promise<DashboardRecord[]> {
  if (!useDirect()) {
    try {
      const json = await express('/api/dashboards');
      return (json.dashboards || []).map((d: any) => ({ ...d, layout: sanitizeLayout(d.layout) }));
    } catch (e) {
      if (!(e instanceof Unreachable)) throw e;
    }
  }
  const sb = getBrowserSupabaseClient();
  if (!sb) throw new Unreachable('No database connection');
  const { data, error } = await sb.from('user_dashboards').select('*').order('created_at');
  if (error) directError(error);
  return (data || []).map(fromRow);
}

async function remoteSave(uid: string, d: DashboardRecord): Promise<void> {
  if (!useDirect()) {
    try {
      await express(`/api/dashboards/${d.id}`, { method: 'PUT', body: JSON.stringify({ name: d.name, layout: d.layout }) });
      return;
    } catch (e) {
      if (!(e instanceof Unreachable)) throw e;
    }
  }
  const sb = getBrowserSupabaseClient();
  if (!sb) throw new Unreachable('No database connection');
  const { error } = await sb.from('user_dashboards').upsert(
    { id: d.id, user_id: uid, name: d.name, layout: d.layout, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
  if (error) directError(error);
}

async function remoteDelete(d: string): Promise<void> {
  if (!useDirect()) {
    try { await express(`/api/dashboards/${d}`, { method: 'DELETE' }); return; } catch (e) { if (!(e instanceof Unreachable)) throw e; }
  }
  const sb = getBrowserSupabaseClient();
  if (!sb) throw new Unreachable('No database connection');
  const { error } = await sb.from('user_dashboards').delete().eq('id', d);
  if (error) directError(error);
}

async function remoteSetDefault(uid: string, id: string | null): Promise<void> {
  if (!useDirect()) {
    try { await express('/api/dashboards/default', { method: 'POST', body: JSON.stringify({ id }) }); return; } catch (e) { if (!(e instanceof Unreachable)) throw e; }
  }
  const sb = getBrowserSupabaseClient();
  if (!sb) throw new Unreachable('No database connection');
  const cleared = await sb.from('user_dashboards').update({ is_default: false }).eq('user_id', uid).eq('is_default', true);
  if (cleared.error) directError(cleared.error);
  if (id) {
    const { error } = await sb.from('user_dashboards').update({ is_default: true }).eq('id', id);
    if (error) directError(error);
  }
}

/** Run a remote write; fall back to this device when the table is missing or the server is unreachable. */
async function writeThrough(remote: () => Promise<void>, local: () => void): Promise<DashboardStorage> {
  try {
    await remote();
    local();
    return 'database';
  } catch (e) {
    if (e instanceof NotInstalled || e instanceof Unreachable) {
      local();
      return 'device';
    }
    throw e;
  }
}

export const dashboardService = {
  newId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
  },

  async list(uid: string): Promise<{ dashboards: DashboardRecord[]; storage: DashboardStorage }> {
    if (!UUID.test(uid)) return { dashboards: readLocal(uid), storage: 'device' };
    try {
      const dashboards = await remoteList();
      writeLocal(uid, dashboards);
      return { dashboards, storage: 'database' };
    } catch (e) {
      if (e instanceof NotInstalled || e instanceof Unreachable) return { dashboards: readLocal(uid), storage: 'device' };
      throw e;
    }
  },

  async save(uid: string, d: DashboardRecord, all: DashboardRecord[]): Promise<DashboardStorage> {
    const clean: DashboardRecord = { ...d, name: cleanDashboardName(d.name), layout: sanitizeLayout(d.layout) };
    const next = all.some(x => x.id === clean.id) ? all.map(x => (x.id === clean.id ? clean : x)) : [...all, clean];
    if (!UUID.test(uid)) { writeLocal(uid, next); return 'device'; }
    return writeThrough(() => remoteSave(uid, clean), () => writeLocal(uid, next));
  },

  async remove(uid: string, id: string, all: DashboardRecord[]): Promise<DashboardStorage> {
    const next = all.filter(x => x.id !== id);
    if (!UUID.test(uid)) { writeLocal(uid, next); return 'device'; }
    return writeThrough(() => remoteDelete(id), () => writeLocal(uid, next));
  },

  async setDefault(uid: string, id: string | null, all: DashboardRecord[]): Promise<DashboardStorage> {
    const next = all.map(x => ({ ...x, isDefault: x.id === id }));
    if (!UUID.test(uid)) { writeLocal(uid, next); return 'device'; }
    return writeThrough(() => remoteSetDefault(uid, id), () => writeLocal(uid, next));
  },
};

export type { DashboardLayout };
