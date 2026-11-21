/**
 * Operations Dashboard - Supabase Realtime for the tables the dashboard reads that the app-wide realtime layer
 * (realtimeService.ts) does not cover: rooms, placements, residents, PEEP, follow-ups, room issues and the check logs.
 *
 * One shared channel for the whole app, reference-counted: it opens with the first dashboard that asks for it and
 * is removed when the last one goes. It carries no data into the screen - an event only says "this table changed",
 * and the dashboard then re-reads the authoritative rows (so RLS, soft deletes and archiving are always applied by
 * the database, never guessed from a payload).
 *
 * Duplicate events (the same commit delivered twice, e.g. around a reconnect) are dropped by a commit key. After any
 * gap - channel re-subscribed, network back, tab visible again after a while - listeners are told to resync.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from '../lib/supabaseClient';

/** Tables whose changes move a dashboard number but are not patched into AppContext. Must be in the supabase_realtime publication (migration 039). */
export const OPERATIONS_REALTIME_TABLES = [
  'properties', 'property_rooms', 'room_beds', 'placements', 'service_users',
  'peep_plans', 'absence_followups', 'room_issues', 'room_checks', 'welfare_checks',
  // Service User profile: attendance calendar and GP details
  'su_attendance_records', 'gp_registrations'
] as const;

export type OperationsTable = typeof OPERATIONS_REALTIME_TABLES[number];
export type OperationsLinkState = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface OperationsChange {
  table: string; eventType: string; id: string;
  /** su_id of the changed row, when it has one */
  suId: string;
  /** the changed row as the database sent it (the new row, or the old row for a delete) */
  row: Record<string, any> | null;
}
type ChangeListener = (c: OperationsChange) => void;
type StateListener = (s: OperationsLinkState) => void;
type ResyncListener = (reason: 'reconnected' | 'online' | 'visible') => void;

const DEDUPE_WINDOW = 200;
const HIDDEN_RESYNC_MS = 60_000;
const RETRY_MS = 5_000;

class OperationsRealtime {
  private channel: RealtimeChannel | null = null;
  private refs = 0;
  private state: OperationsLinkState = 'offline';
  private everLive = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private hiddenAt: number | null = null;
  private seen: string[] = [];
  private seenSet = new Set<string>();
  private changeListeners = new Set<ChangeListener>();
  private stateListeners = new Set<StateListener>();
  private resyncListeners = new Set<ResyncListener>();
  private bound = false;

  getState(): OperationsLinkState { return this.state; }

  /** Open the shared channel (if needed) and attach listeners. Returns the cleanup. */
  acquire(handlers: { onChange: ChangeListener; onState?: StateListener; onResync?: ResyncListener }): () => void {
    this.changeListeners.add(handlers.onChange);
    if (handlers.onState) { this.stateListeners.add(handlers.onState); handlers.onState(this.state); }
    if (handlers.onResync) this.resyncListeners.add(handlers.onResync);
    this.refs++;
    if (this.refs === 1) this.open();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.changeListeners.delete(handlers.onChange);
      if (handlers.onState) this.stateListeners.delete(handlers.onState);
      if (handlers.onResync) this.resyncListeners.delete(handlers.onResync);
      this.refs = Math.max(0, this.refs - 1);
      if (this.refs === 0) this.close();
    };
  }

  private setState(s: OperationsLinkState) {
    if (this.state === s) return;
    this.state = s;
    this.stateListeners.forEach(l => { try { l(s); } catch { /* a listener must not break the others */ } });
  }

  private bindBrowserEvents() {
    if (this.bound || typeof window === 'undefined') return;
    this.bound = true;
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private unbindBrowserEvents() {
    if (!this.bound || typeof window === 'undefined') return;
    this.bound = false;
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private onOnline = () => {
    if (this.refs === 0) return;
    this.rebuild();
    this.resync('online');
  };
  private onOffline = () => { if (this.refs > 0) this.setState('offline'); };
  private onVisibility = () => {
    if (this.refs === 0) return;
    if (document.visibilityState === 'hidden') { this.hiddenAt = Date.now(); return; }
    const away = this.hiddenAt ? Date.now() - this.hiddenAt : 0;
    this.hiddenAt = null;
    if (away >= HIDDEN_RESYNC_MS) this.resync('visible'); // browsers throttle hidden tabs: events may have been missed
  };

  private resync(reason: 'reconnected' | 'online' | 'visible') {
    this.resyncListeners.forEach(l => { try { l(reason); } catch { /* ignore */ } });
  }

  private open() {
    if (typeof window === 'undefined' || this.channel) return;
    this.bindBrowserEvents();
    const client = getBrowserSupabaseClient();
    if (!client) { this.setState('offline'); return; }
    this.setState(this.everLive ? 'reconnecting' : 'connecting');
    try {
      let ch = client.channel(`sdtracker_ops_dashboard_${Date.now()}`);
      for (const table of OPERATIONS_REALTIME_TABLES) {
        ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, (payload: any) => this.handle(table, payload));
      }
      ch.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          const wasGap = this.everLive;
          this.everLive = true;
          this.setState('live');
          if (wasGap) this.resync('reconnected'); // anything that changed while the link was down is re-read
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.setState('reconnecting');
          this.scheduleRetry();
        } else if (status === 'CLOSED') {
          if (this.refs > 0) { this.setState(navigator.onLine === false ? 'offline' : 'reconnecting'); this.scheduleRetry(); }
        }
      });
      this.channel = ch;
    } catch {
      this.setState('reconnecting');
      this.scheduleRetry();
    }
  }

  private scheduleRetry() {
    if (this.retryTimer || this.refs === 0) return;
    this.retryTimer = setTimeout(() => { this.retryTimer = null; if (this.refs > 0) this.rebuild(); }, RETRY_MS);
  }

  private teardownChannel() {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    if (this.channel) {
      try { getBrowserSupabaseClient()?.removeChannel(this.channel); } catch { /* already gone */ }
      this.channel = null;
    }
  }

  private rebuild() { this.teardownChannel(); this.open(); }

  private close() {
    this.teardownChannel();
    this.unbindBrowserEvents();
    this.everLive = false;
    this.seen = []; this.seenSet.clear();
    this.setState('offline');
  }

  private handle(table: string, payload: any) {
    const row = payload?.new && Object.keys(payload.new).length ? payload.new : payload?.old || {};
    const id = String(row.id ?? '');
    const eventType = String(payload?.eventType || 'UPDATE').toUpperCase();
    // The commit timestamp makes the key unique per change, so a redelivery is dropped but a later edit of the same row is not.
    const key = `${table}|${eventType}|${id}|${payload?.commit_timestamp ?? ''}|${row.updated_at ?? row.updatedAt ?? ''}`;
    if (this.seenSet.has(key)) return;
    this.seenSet.add(key); this.seen.push(key);
    if (this.seen.length > DEDUPE_WINDOW) this.seenSet.delete(this.seen.shift()!);
    const change: OperationsChange = { table, eventType, id, suId: String(row.su_id ?? ''), row: Object.keys(row).length ? row : null };
    this.changeListeners.forEach(l => { try { l(change); } catch { /* ignore */ } });
  }
}

export const operationsRealtime = new OperationsRealtime();
