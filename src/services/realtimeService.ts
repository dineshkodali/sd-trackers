/**
 * SDTracker Supabase Realtime Service
 *
 * Production-ready WebSocket subscription layer for live operational updates.
 * 46 tables covered - all unique tables in ENTITY_REGISTRY.
 * Enhanced with event statistics: counts, per-table activity, event log, uptime.
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from '../lib/supabaseClient';
import { fromDatabaseRow } from '../../server/schemaAdapter.ts';

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export type RealtimeConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface RealtimeTableChangeEvent<T = any> {
  table: string;
  eventType: RealtimeEventType;
  record: T;
  oldRecord?: Partial<T>;
  id: string;
  site?: string;
  timestamp: string;
}

export type TableChangeHandler<T = any> = (event: RealtimeTableChangeEvent<T>) => void;
export type StatusChangeHandler = (status: RealtimeConnectionStatus, error?: string | null) => void;
export type ReconnectHandler = () => void;

export const REALTIME_TABLES = [
  // Core operational
  'ir_records',
  'maintenance_records',
  'data_change_requests',
  'escalations',
  'referrals',
  'vulnerable_residents',
  'challenging_behavior',
  'spcd_records',
  'laundry_logs',
  'hot_food_logs',
  'public_transport_records',
  'compliance_records',
  'gp_appointments',
  'rfa_welfare_checks',
  'dispersal_records',
  'booklet_collections',
  'food_wastage_records',
  // Register & arrivals
  'daily_register_rooms',
  'daily_register_records',
  'new_arrivals_records',
  'eviction_records',
  // People & access
  'sites',
  'profiles',
  'user_groups',
  'property_user_assignments',
  'role_permissions',
  // Finance
  'finance_bills',
  'vendor_invoices',
  'credit_card_bills',
  'delivery_notes',
  'finance_approvals',
  'finance_vendors',
  'finance_bill_items',
  'finance_bill_attachments',
  // Documents & VCS
  'documents',
  'vcs_agencies',
  // HO Reports
  'ho_report_templates',
  'ho_report_records',
  'ho_report_audit_logs',
  // Config & system
  'field_options',
  'app_settings',
  'table_schemas',
  'email_notification_rules',
  'email_notification_logs',
  'password_audit_logs',
  'audit_trails',
] as const;

export type RealtimeTableName = typeof REALTIME_TABLES[number];

export interface RealtimeEventLogEntry {
  table: string;
  eventType: RealtimeEventType;
  id: string;
  timestamp: string;
}

export interface RealtimeStats {
  totalEvents: number;
  inserts: number;
  updates: number;
  deletes: number;
  connectedAt: string | null;
  uptimeSeconds: number;
  tableActivity: Record<string, string>;
  recentEvents: RealtimeEventLogEntry[];
}

class RealtimeService {
  private channel: RealtimeChannel | null = null;
  private status: RealtimeConnectionStatus = 'idle';
  private tableHandlers: Map<string, Set<TableChangeHandler>> = new Map();
  private anyHandlers: Set<TableChangeHandler> = new Set();
  private statusHandlers: Set<StatusChangeHandler> = new Set();
  private reconnectHandlers: Set<ReconnectHandler> = new Set();
  private statsHandlers: Set<(s: RealtimeStats) => void> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastError: string | null = null;
  private lastEventAt: string | null = null;
  private networkOnline = typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true;

  private connectedAt: string | null = null;
  private totalEvents = 0;
  private insertCount = 0;
  private updateCount = 0;
  private deleteCount = 0;
  private tableActivity: Record<string, string> = {};
  private recentEvents: RealtimeEventLogEntry[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  public getStatus(): RealtimeConnectionStatus { return this.status; }
  public getLastError(): string | null { return this.lastError; }
  public getLastEventAt(): string | null { return this.lastEventAt; }

  public getStats(): RealtimeStats {
    const uptimeSeconds = this.connectedAt
      ? Math.floor((Date.now() - new Date(this.connectedAt).getTime()) / 1000)
      : 0;
    return {
      totalEvents: this.totalEvents,
      inserts: this.insertCount,
      updates: this.updateCount,
      deletes: this.deleteCount,
      connectedAt: this.connectedAt,
      uptimeSeconds,
      tableActivity: { ...this.tableActivity },
      recentEvents: [...this.recentEvents],
    };
  }

  private notifyStats() {
    const stats = this.getStats();
    this.statsHandlers.forEach(h => { try { h(stats); } catch { /* ignore */ } });
  }

  private setStatus(newStatus: RealtimeConnectionStatus, error?: string | null) {
    if (this.status === newStatus && this.lastError === (error ?? null)) return;
    this.status = newStatus;
    this.lastError = error ?? null;
    if (newStatus === 'connected' && !this.connectedAt) {
      this.connectedAt = new Date().toISOString();
    }
    if (newStatus === 'disconnected' || newStatus === 'idle') {
      this.connectedAt = null;
    }
    this.statusHandlers.forEach(h => { try { h(newStatus, error); } catch (err) { console.error('[RealtimeService] Status handler error:', err); } });
  }

  private handleOnline = () => {
    this.networkOnline = true;
    if (this.status === 'disconnected' || this.status === 'error') {
      this.setStatus('reconnecting');
      this.reconnect();
    }
  };

  private handleOffline = () => {
    this.networkOnline = false;
    this.setStatus('disconnected', 'Network offline');
  };

  public subscribe(): void {
    if (typeof window === 'undefined') return;
    if (this.channel) return;

    const client = getBrowserSupabaseClient();
    if (!client) { this.setStatus('disconnected', 'Database client not initialized'); return; }

    this.setStatus('connecting');

    try {
      const channelName = `sdtracker_realtime_${Date.now()}`;
      let ch = client.channel(channelName);

      REALTIME_TABLES.forEach(table => {
        ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, (payload: any) => this.handlePostgresChange(table, payload));
      });

      ch.subscribe((state, err) => {
        if (state === 'SUBSCRIBED') {
          this.setStatus('connected', null);
        } else if (state === 'TIMED_OUT') {
          this.setStatus('reconnecting', 'Subscription timed out');
          this.scheduleReconnect();
        } else if (state === 'CLOSED') {
          if (this.status === 'connected') this.setStatus('disconnected', 'Channel closed');
        } else if (state === 'CHANNEL_ERROR') {
          const errMsg = (err as any)?.message || 'Realtime channel error';
          this.setStatus('error', errMsg);
          this.scheduleReconnect();
        }
      });

      this.channel = ch;
    } catch (err: any) {
      console.error('[RealtimeService] Failed to initialize realtime channel:', err);
      this.setStatus('error', err?.message || String(err));
      this.scheduleReconnect();
    }
  }

  private handlePostgresChange(tableName: string, payload: any) {
    try {
      const eventType: RealtimeEventType = (payload.eventType || 'UPDATE').toUpperCase() as RealtimeEventType;
      const rawNew = payload.new || {};
      const rawOld = payload.old || {};

      const mappedNew = eventType !== 'DELETE' ? fromDatabaseRow(tableName, rawNew) : null;
      const mappedOld = rawOld && Object.keys(rawOld).length > 0 ? fromDatabaseRow(tableName, rawOld) : null;

      const record = mappedNew || mappedOld || rawNew || rawOld;
      const id = String(record?.id || rawNew?.id || rawOld?.id || '');
      const site = record?.site || record?.siteName || record?.assignedSite || rawNew?.site || rawOld?.site;

      const timestamp = new Date().toISOString();
      this.lastEventAt = timestamp;

      this.totalEvents++;
      if (eventType === 'INSERT') this.insertCount++;
      else if (eventType === 'UPDATE') this.updateCount++;
      else if (eventType === 'DELETE') this.deleteCount++;
      this.tableActivity[tableName] = timestamp;
      this.recentEvents = [{ table: tableName, eventType, id, timestamp }, ...this.recentEvents].slice(0, 20);
      this.notifyStats();

      const event: RealtimeTableChangeEvent = { table: tableName, eventType, record, oldRecord: mappedOld || undefined, id, site, timestamp };

      this.tableHandlers.get(tableName)?.forEach(h => { try { h(event); } catch (e) { console.error(`[RealtimeService] Handler error for ${tableName}:`, e); } });
      this.anyHandlers.forEach(h => { try { h(event); } catch (e) { console.error('[RealtimeService] Global handler error:', e); } });
    } catch (err) {
      console.error(`[RealtimeService] Failed to process event for ${tableName}:`, err);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.reconnect(); }, 5000);
  }

  public reconnect(): void {
    if (!this.networkOnline) return;
    this.unsubscribe();
    this.subscribe();
    this.reconnectHandlers.forEach(h => { try { h(); } catch (err) { console.error('[RealtimeService] Reconnect handler error:', err); } });
  }

  public unsubscribe(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.channel) {
      try { getBrowserSupabaseClient()?.removeChannel(this.channel); } catch (err) { console.warn('[RealtimeService] Error removing channel:', err); }
      this.channel = null;
    }
    this.setStatus('disconnected', null);
  }

  public onTable(tableName: string, handler: TableChangeHandler): () => void {
    if (!this.tableHandlers.has(tableName)) this.tableHandlers.set(tableName, new Set());
    const handlers = this.tableHandlers.get(tableName)!;
    handlers.add(handler);
    return () => { handlers.delete(handler); if (handlers.size === 0) this.tableHandlers.delete(tableName); };
  }

  public onAny(handler: TableChangeHandler): () => void {
    this.anyHandlers.add(handler);
    return () => this.anyHandlers.delete(handler);
  }

  public onStatusChange(handler: StatusChangeHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status, this.lastError);
    return () => this.statusHandlers.delete(handler);
  }

  public onReconnect(handler: ReconnectHandler): () => void {
    this.reconnectHandlers.add(handler);
    return () => this.reconnectHandlers.delete(handler);
  }

  public onStats(handler: (stats: RealtimeStats) => void): () => void {
    this.statsHandlers.add(handler);
    handler(this.getStats());
    return () => this.statsHandlers.delete(handler);
  }
}

export const realtimeService = new RealtimeService();
