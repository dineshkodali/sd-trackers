/**
 * Hooks to access Supabase Realtime connection status, live stats, and table events.
 */

import { useState, useEffect } from 'react';
import {
  realtimeService,
  RealtimeConnectionStatus,
  RealtimeTableChangeEvent,
  RealtimeStats,
  TableChangeHandler
} from '../services/realtimeService';

export interface UseRealtimeResult {
  status: RealtimeConnectionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  lastError: string | null;
  lastEventAt: string | null;
  stats: RealtimeStats;
  reconnect: () => void;
}

export function useSupabaseRealtime(): UseRealtimeResult {
  const [status, setStatus] = useState<RealtimeConnectionStatus>(realtimeService.getStatus());
  const [lastError, setLastError] = useState<string | null>(realtimeService.getLastError());
  const [lastEventAt, setLastEventAt] = useState<string | null>(realtimeService.getLastEventAt());
  const [stats, setStats] = useState<RealtimeStats>(realtimeService.getStats());

  useEffect(() => {
    const unsubStatus = realtimeService.onStatusChange((s, err) => {
      setStatus(s);
      setLastError(err || null);
    });

    const unsubAny = realtimeService.onAny(event => {
      setLastEventAt(event.timestamp);
    });

    const unsubStats = realtimeService.onStats(s => {
      setStats(s);
    });

    return () => {
      unsubStatus();
      unsubAny();
      unsubStats();
    };
  }, []);

  // Tick uptime every second so the UI shows a live counter
  useEffect(() => {
    if (status !== 'connected') return;
    const tick = setInterval(() => {
      setStats(realtimeService.getStats());
    }, 1000);
    return () => clearInterval(tick);
  }, [status]);

  return {
    status,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting' || status === 'reconnecting',
    lastError,
    lastEventAt,
    stats,
    reconnect: () => realtimeService.reconnect()
  };
}

/**
 * Hook to listen for live events on a specific table.
 */
export function useRealtimeTable<T = any>(
  tableName: string,
  onEvent: TableChangeHandler<T>
): void {
  useEffect(() => {
    return realtimeService.onTable(tableName, onEvent);
  }, [tableName, onEvent]);
}
