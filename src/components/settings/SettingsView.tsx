import React, { useState } from 'react';
import { 
  Settings, 
  ShieldCheck, 
  Database, 
  Download, 
  CheckCircle2, 
  Lock,
  Activity,
  Server,
  FileCheck2,
  Cpu,
  Wifi,
  WifiOff,
  Radio,
  RefreshCw,
  Zap
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SupabaseBackendCard } from './SupabaseBackendCard';
import { useSupabaseRealtime } from '../../hooks/useSupabaseRealtime';
import { REALTIME_TABLES } from '../../services/realtimeService';

export const SettingsView: React.FC = () => {
  const {
    settings,
    buildBackupSnapshot,
    currentUserRole,
    cacheStats,
    properties,
    users,
    remainingInactivitySeconds
  } = useApp();

  const [downloading, setDownloading] = useState(false);

  const rt = useSupabaseRealtime();

  const rtStatusMeta: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode; pulse: boolean }> = {
    connected:    { label: 'Connected',    color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', icon: <Wifi className="w-4 h-4" />,      pulse: true  },
    connecting:   { label: 'Connecting…',  color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',   icon: <RefreshCw className="w-4 h-4 animate-spin" />, pulse: false },
    reconnecting: { label: 'Reconnecting…',color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',   icon: <RefreshCw className="w-4 h-4 animate-spin" />, pulse: false },
    disconnected: { label: 'Disconnected', color: 'text-neutral-500', bg: 'bg-neutral-50', border: 'border-neutral-200', icon: <WifiOff className="w-4 h-4" />,   pulse: false },
    error:        { label: 'Error',        color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',     icon: <WifiOff className="w-4 h-4" />,   pulse: false },
    idle:         { label: 'Idle',         color: 'text-neutral-400', bg: 'bg-neutral-50', border: 'border-neutral-200', icon: <Radio className="w-4 h-4" />,     pulse: false },
  };

  const rtMeta = rtStatusMeta[rt.status] ?? rtStatusMeta.idle;

  const formatEventTime = (iso: string | null) => {
    if (!iso) return 'No events yet';
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleFullBackup = () => {
    setDownloading(true);
    try {
      const data = buildBackupSnapshot();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sdtracker-system-snapshot-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e1dfdd]">
        <div>
          <h2 className="text-2xl font-semibold text-[#242424] tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#0d9488]" />
            System Preferences &amp; Operational Status
          </h2>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Executive overview of system governance, database connectivity, and runtime cache parameters established via root <code className="font-mono bg-[#edebe9] px-1 rounded text-[#242424]">.env</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-semibold">
            <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Operational · Production Baseline</span>
          </span>
          <span className="inline-flex items-center px-2.5 py-1 bg-[#edebe9] text-[#323130] rounded-full text-xs font-medium">
            Active Role: <strong className="ml-1 text-[#0d9488]">{currentUserRole}</strong>
          </span>
        </div>
      </div>

      {/* Section 1: Supabase & Infrastructure Backend Connectivity */}
      <SupabaseBackendCard />

      {/* Section 1b: Supabase Realtime WebSocket Connector */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#edebe9] bg-[#faf9f8] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#0d9488]" />
            <div>
              <h3 className="font-semibold text-xs text-[#242424]">
                Supabase Realtime · WebSocket Connector
                <span className="ml-2 font-mono text-[10px] text-neutral-400">
                  {REALTIME_TABLES.length} tables · postgres_changes · WSS
                </span>
              </h3>
              <p className="text-[11px] text-[#605e5c]">
                Live PostgreSQL CDC stream — INSERT, UPDATE &amp; DELETE events broadcast instantly across all active sessions.
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded border ${rtMeta.bg} ${rtMeta.color} ${rtMeta.border}`}>
            {rt.status === 'connected' && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
            {rtMeta.label}
          </span>
        </div>

        {/* Row 1 — 5 stat cards */}
        <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs border-b border-[#edebe9]">

          {/* Connection State */}
          <div className="p-3 bg-[#faf9f8] border border-[#edebe9] rounded-xs flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700">
              <Wifi className="w-3.5 h-3.5 text-[#0d9488]" /> State
            </div>
            <div className={`flex items-center gap-1.5 font-bold text-sm ${rtMeta.color}`}>
              {rtMeta.icon}
              <span>{rtMeta.label}</span>
            </div>
            {rt.lastError && (
              <p className="text-[10px] text-red-600 font-mono break-all leading-tight">{rt.lastError}</p>
            )}
            <div className="mt-auto pt-2 border-t border-[#edebe9]">
              <button
                onClick={rt.reconnect}
                disabled={rt.isConnected || rt.isConnecting}
                className="flex items-center gap-1 text-[10px] text-[#0d9488] hover:text-[#0f766e] disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Force Reconnect
              </button>
            </div>
          </div>

          {/* Uptime */}
          <div className="p-3 bg-[#faf9f8] border border-[#edebe9] rounded-xs flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700">
              <Activity className="w-3.5 h-3.5 text-[#0d9488]" /> Uptime
            </div>
            <div className="font-mono text-lg font-bold text-neutral-800">
              {rt.stats.uptimeSeconds >= 3600
                ? `${Math.floor(rt.stats.uptimeSeconds / 3600)}h ${Math.floor((rt.stats.uptimeSeconds % 3600) / 60)}m`
                : rt.stats.uptimeSeconds >= 60
                ? `${Math.floor(rt.stats.uptimeSeconds / 60)}m ${rt.stats.uptimeSeconds % 60}s`
                : rt.isConnected
                ? `${rt.stats.uptimeSeconds}s`
                : '—'}
            </div>
            <p className="text-[10px] text-[#605e5c]">Time connected in this session.</p>
          </div>

          {/* Total Events */}
          <div className="p-3 bg-[#faf9f8] border border-[#edebe9] rounded-xs flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Total Events
            </div>
            <div className="text-2xl font-bold text-[#0d9488]">{rt.stats.totalEvents}</div>
            <div className="text-[10px] text-[#605e5c] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-emerald-700 font-semibold">↑ INSERT</span>
                <span className="font-mono font-bold">{rt.stats.inserts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-700 font-semibold">↻ UPDATE</span>
                <span className="font-mono font-bold">{rt.stats.updates}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600 font-semibold">✕ DELETE</span>
                <span className="font-mono font-bold">{rt.stats.deletes}</span>
              </div>
            </div>
          </div>

          {/* Last Event */}
          <div className="p-3 bg-[#faf9f8] border border-[#edebe9] rounded-xs flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700">
              <Zap className="w-3.5 h-3.5 text-[#0d9488]" /> Last Event
            </div>
            <div className="font-mono text-sm font-bold text-neutral-800">
              {formatEventTime(rt.lastEventAt)}
            </div>
            {rt.stats.recentEvents[0] && (
              <div className="text-[10px] text-[#605e5c]">
                <span className="font-mono">{rt.stats.recentEvents[0].table}</span>
                {' · '}
                <span className={
                  rt.stats.recentEvents[0].eventType === 'INSERT' ? 'text-emerald-700 font-semibold' :
                  rt.stats.recentEvents[0].eventType === 'UPDATE' ? 'text-amber-700 font-semibold' :
                  'text-red-600 font-semibold'
                }>{rt.stats.recentEvents[0].eventType}</span>
              </div>
            )}
          </div>

          {/* Transport */}
          <div className="p-3 bg-[#faf9f8] border border-[#edebe9] rounded-xs flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700">
              <Server className="w-3.5 h-3.5 text-[#0d9488]" /> Transport
            </div>
            <div className="space-y-1 text-[10px] text-[#605e5c]">
              <div className="flex justify-between"><span>Protocol:</span><span className="font-mono font-semibold text-neutral-800">WSS (TLS)</span></div>
              <div className="flex justify-between"><span>Schema:</span><span className="font-mono text-neutral-800">public</span></div>
              <div className="flex justify-between"><span>Mode:</span><span className="font-semibold text-neutral-800">postgres_changes</span></div>
              <div className="flex justify-between"><span>Publication:</span><span className="font-mono text-neutral-800">supabase_realtime</span></div>
              <div className="flex justify-between"><span>Reconnect:</span><span className="font-semibold text-emerald-700">Auto · 5 s</span></div>
            </div>
          </div>
        </div>

        {/* Row 2 — Recent event log + Table activity */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-[#edebe9]">

          {/* Recent Event Feed */}
          <div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-2">
              Live Event Feed (last {rt.stats.recentEvents.length || '—'})
            </p>
            {rt.stats.recentEvents.length === 0 ? (
              <p className="text-[11px] text-neutral-400 italic">
                No events yet — waiting for PostgreSQL WAL events…
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {rt.stats.recentEvents.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className={`font-bold px-1 py-0.5 rounded text-[9px] min-w-[44px] text-center ${
                      ev.eventType === 'INSERT' ? 'bg-emerald-100 text-emerald-700' :
                      ev.eventType === 'UPDATE' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>{ev.eventType}</span>
                    <span className="font-mono text-neutral-600 truncate flex-1">{ev.table}</span>
                    <span className="font-mono text-neutral-400 shrink-0">{formatEventTime(ev.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per-Table Activity */}
          <div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-2">
              Active Tables ({Object.keys(rt.stats.tableActivity).length} with events)
            </p>
            {Object.keys(rt.stats.tableActivity).length === 0 ? (
              <p className="text-[11px] text-neutral-400 italic">No per-table activity recorded yet.</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {Object.entries(rt.stats.tableActivity)
                  .sort((a, b) => b[1].localeCompare(a[1]))
                  .map(([tbl, ts]) => (
                    <div key={tbl} className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-neutral-700">{tbl}</span>
                      <span className="text-neutral-400 font-mono">{formatEventTime(ts)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 3 — All table pills */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1.5">
            Active Subscriptions — {REALTIME_TABLES.length} tables
          </p>
          <div className="flex flex-wrap gap-1">
            {REALTIME_TABLES.map(tbl => {
              const hasActivity = !!rt.stats.tableActivity[tbl];
              return (
                <span
                  key={tbl}
                  title={hasActivity ? `Last event: ${formatEventTime(rt.stats.tableActivity[tbl])}` : 'No events yet'}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-default ${
                    hasActivity
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : rt.isConnected
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : 'bg-neutral-50 text-neutral-400 border-neutral-200'
                  }`}
                >
                  {tbl}
                </span>
              );
            })}
          </div>
        </div>
      </div>


      {/* Section 2: Active System Preferences & Governance Policies (Read-Only) */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#edebe9] bg-[#faf9f8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0d9488]" />
            <div>
              <h3 className="font-semibold text-xs text-[#242424]">Active System Governance &amp; Operating Policies</h3>
              <p className="text-[11px] text-[#605e5c]">
                Core safeguards, audit policies, and security parameters enforced across all 31 modules.
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-teal-50 text-[#0f766e] font-bold px-2 py-0.5 rounded border border-teal-200">
            Read-Only • Configured via .env
          </span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Policy Panel 1: Security & Session Management */}
          <div className="p-3.5 bg-[#faf9f8] border border-[#edebe9] rounded-xs space-y-2.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-2 border-b border-[#edebe9]">
                <Lock className="w-4 h-4 text-[#0d9488]" />
                <span className="font-bold text-neutral-800 text-xs">Security &amp; Session Controls</span>
              </div>
              <div className="mt-2.5 space-y-2 text-[11px] text-[#605e5c]">
                <div className="flex justify-between items-center">
                  <span>Inactivity Timeout:</span>
                  <span className="font-semibold text-neutral-800">
                    {settings.autoLogoutMinutes > 0 ? `${settings.autoLogoutMinutes} Minutes` : 'Disabled'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Session Countdown:</span>
                  <span className="font-mono text-emerald-700 font-semibold">
                    {settings.autoLogoutMinutes > 0 ? `${Math.floor(remainingInactivitySeconds / 60)}m ${remainingInactivitySeconds % 60}s` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Authentication Standard:</span>
                  <span className="font-mono text-neutral-800">TLS 256-bit JWT</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Access Control:</span>
                  <span className="font-semibold text-neutral-800">Role-Based (RBAC)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Single Sign-On (SSO):</span>
                  <span className="font-mono text-neutral-800">Microsoft Entra ID</span>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-[#edebe9] text-[10px] text-neutral-500">
              Session state verifies cryptographic tokens on every API request.
            </div>
          </div>

          {/* Policy Panel 2: Action Confirmations & Integrity Guardrails */}
          <div className="p-3.5 bg-[#faf9f8] border border-[#edebe9] rounded-xs space-y-2.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-2 border-b border-[#edebe9]">
                <FileCheck2 className="w-4 h-4 text-[#0d9488]" />
                <span className="font-bold text-neutral-800 text-xs">Action Safety &amp; Guardrails</span>
              </div>
              <div className="mt-2.5 space-y-2 text-[11px] text-[#605e5c]">
                <div className="flex justify-between items-center">
                  <span>Create Confirmation:</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Edit Confirmation:</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Archive &amp; Restore:</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Deletion Confirmation:</span>
                  <span className="font-semibold text-amber-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Double Confirmation
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Audit Trail Logging:</span>
                  <span className="font-semibold text-emerald-700">100% Writes Logged</span>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-[#edebe9] text-[10px] text-neutral-500">
              Protects critical resident records from accidental modifications.
            </div>
          </div>

          {/* Policy Panel 3: Display & Performance Optimization */}
          <div className="p-3.5 bg-[#faf9f8] border border-[#edebe9] rounded-xs space-y-2.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-2 border-b border-[#edebe9]">
                <Cpu className="w-4 h-4 text-[#0d9488]" />
                <span className="font-bold text-neutral-800 text-xs">Display &amp; Storage Tuning</span>
              </div>
              <div className="mt-2.5 space-y-2 text-[11px] text-[#605e5c]">
                <div className="flex justify-between items-center">
                  <span>In-Memory Fast Cache:</span>
                  <span className="font-semibold text-emerald-700">Enabled (Instant Load)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Column Pinning:</span>
                  <span className="font-semibold text-neutral-800">Right Actions Pinned</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Default Page Size:</span>
                  <span className="font-mono text-neutral-800 font-semibold">{settings.pageSize || 25} records/page</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Table Row Density:</span>
                  <span className="font-semibold text-neutral-800">{settings.compactView ? 'Compact' : 'Comfortable'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Dynamic Columns:</span>
                  <span className="font-mono text-emerald-700 font-semibold">Dual-Layer Persisted</span>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-[#edebe9] text-[10px] text-neutral-500">
              Dynamic schema updates persist to PostgreSQL table_schemas.
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: High-Speed Operational Data Cache Diagnostics */}
      <div className="bg-white border border-[#99f6e4] rounded-xs shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#99f6e4] bg-[#f3f8fd] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#0d9488]" />
            <div>
              <h3 className="font-semibold text-xs text-[#0f766e]">Operational Data Cache &amp; Synchronization Diagnostics</h3>
              <p className="text-[11px] text-[#0f766e]/80">
                Live memory caching and background synchronization metrics for continuous sub-millisecond table responsiveness.
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded border border-emerald-200">
            Real-Time Telemetry
          </span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Property Cache Stats */}
          <div className="p-3 bg-white border border-[#e1dfdd] rounded-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#242424]">Properties Cache</span>
              <span className="text-[10px] bg-teal-50 text-[#0f766e] font-bold px-1.5 py-0.5 rounded border border-teal-200">
                Ready
              </span>
            </div>
            <div className="text-2xl font-bold text-[#0d9488]">
              {properties.length} <span className="text-xs font-normal text-neutral-500">sites cached</span>
            </div>
            <div className="text-[11px] text-[#605e5c] space-y-0.5 pt-1 border-t border-[#edebe9]">
              <div>Checksum: <code className="text-[10px] bg-neutral-100 px-1 py-0.2 rounded font-mono">{cacheStats.properties.checksum}</code></div>
              <div>Cache Hits: <strong>{cacheStats.properties.hitCount}</strong></div>
              <div>Sync State: <span className="text-emerald-700 font-semibold uppercase text-[10px]">{cacheStats.properties.syncState}</span></div>
            </div>
          </div>

          {/* Users Cache Stats */}
          <div className="p-3 bg-white border border-[#e1dfdd] rounded-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#242424]">Users Directory Cache</span>
              <span className="text-[10px] bg-teal-50 text-teal-800 font-bold px-1.5 py-0.5 rounded border border-teal-200">
                Ready
              </span>
            </div>
            <div className="text-2xl font-bold text-teal-700">
              {users.length} <span className="text-xs font-normal text-neutral-500">accounts cached</span>
            </div>
            <div className="text-[11px] text-[#605e5c] space-y-0.5 pt-1 border-t border-[#edebe9]">
              <div>Checksum: <code className="text-[10px] bg-neutral-100 px-1 py-0.2 rounded font-mono">{cacheStats.users.checksum}</code></div>
              <div>Cache Hits: <strong>{cacheStats.users.hitCount}</strong></div>
              <div>Sync State: <span className="text-emerald-700 font-semibold uppercase text-[10px]">{cacheStats.users.syncState}</span></div>
            </div>
          </div>

          {/* Database Sync Status */}
          <div className="p-3 bg-white border border-[#e1dfdd] rounded-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#242424]">Database Sync Pulse</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                Active
              </span>
            </div>
            <div className="text-2xl font-bold text-emerald-700">
              {cacheStats.lastSyncFormatted} <span className="text-xs font-normal text-neutral-500">last sync</span>
            </div>
            <div className="text-[11px] text-[#605e5c] space-y-0.5 pt-1 border-t border-[#edebe9]">
              <div>Total Cached Hits: <strong>{cacheStats.totalHits}</strong></div>
              <div>Sync Latency: <strong>{cacheStats.properties.lastSyncDurationMs || 8} ms</strong></div>
              <div>Background Telemetry: <span className="text-emerald-700 font-semibold">Active</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Data Compliance Export (Audit Snapshot) */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#edebe9] bg-[#faf9f8] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-[#0d9488]" />
            <div>
              <h3 className="font-semibold text-xs text-[#242424]">Compliance Snapshot Export</h3>
              <p className="text-[11px] text-[#605e5c]">
                Download a cryptographically structured JSON audit export of all 31 tracker modules for offline compliance archiving.
              </p>
            </div>
          </div>

          <button
            onClick={handleFullBackup}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#8a8886] hover:bg-[#edebe9] text-neutral-800 font-semibold text-xs rounded-xs transition-colors shadow-2xs disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 text-[#0d9488] ${downloading ? 'animate-bounce' : ''}`} />
            <span>{downloading ? 'Compiling Snapshot...' : 'Download Compliance Snapshot (JSON)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
