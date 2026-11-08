import { getBrowserSupabaseClient } from '../lib/supabaseClient';
import { authHeaders, fetchWithTimeout, getApiBaseUrl, getApiUrl, isDirectSupabaseActive, shouldPreferDirectSupabase } from './apiService';
import {
  LIFECYCLE_ENTITY_LABEL,
  LIFECYCLE_TABLE,
  cleanReason,
  type LifecycleAction,
  type LifecycleEntity,
  type LifecycleEvent,
  type LifecycleRow,
  type LifecycleState,
} from '../config/recordLifecycle';

/**
 * Client for archive, recoverable delete and restore of Users and Properties.
 * Uses the Express API when present and Supabase RPC on static hosts. Neither path is
 * trusted: the API and the database function both re-check role, scope and transition.
 */

const useDirect = () => (shouldPreferDirectSupabase() || isDirectSupabaseActive()) && !getApiBaseUrl();

class ApiRefusal extends Error {}

async function expressJson(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetchWithTimeout(getApiUrl(path), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init.headers || {}) },
  }, 10000);
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok || json?.success === false) {
    if (json?.error) throw new ApiRefusal(json.error);
    throw new Error(`Request failed (${res.status})`);
  }
  return json;
}

const asState = (v: unknown): LifecycleState => (v === 'Archived' || v === 'Deleted' ? v : 'Active');

function directRow(entity: LifecycleEntity, r: any): LifecycleRow {
  return {
    id: String(r.id),
    label: entity === 'users' ? (r.name || r.email) : (r.name || String(r.id)),
    recordType: LIFECYCLE_ENTITY_LABEL[entity],
    state: asState(r.lifecycle_state),
    previousState: r.lifecycle_prev_state ? asState(r.lifecycle_prev_state) : null,
    previousStatus: r.lifecycle_prev_status,
    changedAt: r.lifecycle_changed_at,
    changedBy: r.lifecycle_changed_by_name,
    reason: r.lifecycle_reason,
    detail: entity === 'users' ? [r.email, r.role].filter(Boolean).join(' · ') : [r.pid, r.city].filter(Boolean).join(' · '),
  };
}

export const lifecycleService = {
  /** Archived or deleted records the signed-in user may see. `installed: false` = migration 028 not applied yet. */
  async list(entity: LifecycleEntity, state: 'Archived' | 'Deleted'): Promise<{ rows: LifecycleRow[]; installed: boolean }> {
    if (!useDirect()) {
      try {
        const json = await expressJson(`/api/lifecycle/${entity}?state=${state}`);
        return { rows: json.rows || [], installed: json.installed !== false };
      } catch (e) {
        if (e instanceof ApiRefusal) throw e;
        // Express unreachable: fall through to direct Supabase.
      }
    }
    const sb = getBrowserSupabaseClient();
    if (!sb) throw new Error('Database connection unavailable.');
    const { data, error } = await sb.from(LIFECYCLE_TABLE[entity]).select('*').eq('lifecycle_state', state).order('lifecycle_changed_at', { ascending: false });
    if (error) {
      if (['42703', '42P01', 'PGRST205'].includes((error as any).code)) return { rows: [], installed: false };
      throw new Error('Could not load records.');
    }
    return { rows: (data || []).map(r => directRow(entity, r)), installed: true };
  },

  async apply(entity: LifecycleEntity, id: string, action: LifecycleAction, reason?: string): Promise<void> {
    const clean = cleanReason(reason);
    if (!useDirect()) {
      try {
        await expressJson(`/api/lifecycle/${entity}/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: JSON.stringify({ reason: clean }) });
        return;
      } catch (e) {
        if (e instanceof ApiRefusal) throw e;
        // Express unreachable: fall through to direct Supabase.
      }
    }
    const sb = getBrowserSupabaseClient();
    if (!sb) throw new Error('Database connection unavailable.');
    const { error } = await sb.rpc('lifecycle_apply_self', { p_entity: entity, p_id: id, p_action: action, p_reason: clean || null });
    if (error) {
      if (['42883', 'PGRST202'].includes((error as any).code)) {
        throw new Error('Archive and deleted records are not installed yet. Apply migration 028 in the database.');
      }
      throw new Error(error.message);
    }
  },

  /** Lifecycle history for one record (Super Admin only). */
  async history(entity: LifecycleEntity, id: string): Promise<LifecycleEvent[]> {
    if (!useDirect()) {
      try {
        const json = await expressJson(`/api/lifecycle/${entity}/${encodeURIComponent(id)}/history`);
        return json.events || [];
      } catch (e) {
        if (e instanceof ApiRefusal) throw e;
      }
    }
    const sb = getBrowserSupabaseClient();
    if (!sb) throw new Error('Database connection unavailable.');
    const { data, error } = await sb.from('record_lifecycle_events').select('*').eq('entity', entity).eq('record_id', id).order('created_at', { ascending: false }).limit(100);
    if (error) throw new Error('Could not load history.');
    return (data || []).map((e: any) => ({
      id: e.id, entity: e.entity, recordId: e.record_id, recordLabel: e.record_label, action: e.action,
      previousState: e.previous_state, newState: e.new_state, actorName: e.actor_name, actorRole: e.actor_role,
      reason: e.reason, createdAt: e.created_at,
    }));
  },
};
