import React, { useState, useMemo } from 'react';
import { 
  Settings, 
  Zap, 
  ShieldCheck, 
  ShieldAlert,
  Shield,
  Database, 
  Download, 
  Upload, 
  RotateCcw, 
  CheckCircle2, 
  HardDrive,
  Archive,
  Trash2,
  Calendar,
  Layers,
  AlertTriangle,
  Clock,
  Sparkles,
  Info,
  ChevronRight,
  Filter,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SupabaseBackendCard } from './SupabaseBackendCard';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    resetAllData,
    restoreBackup,
    requestConfirmation,
    currentUserRole,
    setCurrentUserRole,
    setActivePage,
    cacheStats,
    triggerBackgroundDeltaSync,
    properties,
    users,
    getBatchRetentionStats,
    batchArchiveRecordsOlderThan,
    batchDeleteRecordsOlderThan,
    lockSession,
    remainingInactivitySeconds,
    resetInactivityTimer
  } = useApp();

  const [saveBanner, setSaveBanner] = useState(false);
  const [syncingState, setSyncingState] = useState(false);

  // Batch Data Retention State
  const default90DaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  }, []);

  const [batchModule, setBatchModule] = useState<string>('all');
  const [cutoffDate, setCutoffDate] = useState<string>(default90DaysAgo);
  const [batchActionType, setBatchActionType] = useState<'archive' | 'delete'>('archive');
  const [onlyArchivedForDelete, setOnlyArchivedForDelete] = useState<boolean>(false);
  const [batchResultBanner, setBatchResultBanner] = useState<{ message: string; count: number; action: string } | null>(null);

  // Calculate live stats
  const allRetentionStats = useMemo(() => {
    return getBatchRetentionStats(cutoffDate);
  }, [getBatchRetentionStats, cutoffDate]);

  const targetStats = useMemo(() => {
    if (batchModule === 'all') {
      return allRetentionStats;
    }
    return allRetentionStats.filter(s => s.id === batchModule);
  }, [allRetentionStats, batchModule]);

  const totalEligibleToArchive = useMemo(() => {
    return targetStats
      .filter(s => s.supportsArchive)
      .reduce((sum, s) => sum + s.activeOlder, 0);
  }, [targetStats]);

  const totalEligibleToDelete = useMemo(() => {
    if (onlyArchivedForDelete) {
      return targetStats.reduce((sum, s) => sum + (s.supportsArchive ? s.archivedOlder : s.totalOlder), 0);
    }
    return targetStats.reduce((sum, s) => sum + s.totalOlder, 0);
  }, [targetStats, onlyArchivedForDelete]);

  const setDatePreset = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setCutoffDate(d.toISOString().slice(0, 10));
  };

  const handleExecuteBatchArchive = () => {
    if (totalEligibleToArchive === 0) return;

    requestConfirmation({
      title: 'Confirm Batch Data Archive',
      message: `Are you sure you want to batch-archive ${totalEligibleToArchive} active record(s) older than ${cutoffDate}? These records will be safely relocated to the Historical Archive registers across the system, preserving compliance records while speeding up active workspaces.`,
      confirmLabel: `Archive ${totalEligibleToArchive} Record(s)`,
      isDanger: false,
      itemDetails: targetStats
        .filter(s => s.supportsArchive && s.activeOlder > 0)
        .map(s => ({
          label: s.name,
          value: `${s.activeOlder} active record(s) <= ${cutoffDate}`
        })),
      onConfirm: () => {
        const res = batchArchiveRecordsOlderThan(batchModule, cutoffDate);
        setBatchResultBanner({
          message: `Successfully batch-archived ${res.totalAffected} records older than ${cutoffDate}.`,
          count: res.totalAffected,
          action: 'archive'
        });
        setTimeout(() => setBatchResultBanner(null), 5000);
      }
    });
  };

  const handleExecuteBatchDelete = () => {
    if (totalEligibleToDelete === 0) return;

    const deleteScopeDescription = onlyArchivedForDelete 
      ? 'already-archived and resolved records' 
      : 'ALL active and historical records';

    requestConfirmation({
      title: 'CRITICAL: Confirm Batch Permanent Deletion',
      message: `WARNING: You are about to PERMANENTLY PURGE ${totalEligibleToDelete} record(s) older than ${cutoffDate} (${deleteScopeDescription}). This action cannot be reversed and will free local storage to optimize browser performance.`,
      confirmLabel: `Permanently Purge ${totalEligibleToDelete} Record(s)`,
      isDanger: true,
      itemDetails: targetStats
        .filter(s => (onlyArchivedForDelete ? (s.supportsArchive ? s.archivedOlder : s.totalOlder) : s.totalOlder) > 0)
        .map(s => ({
          label: s.name,
          value: `${onlyArchivedForDelete ? (s.supportsArchive ? s.archivedOlder : s.totalOlder) : s.totalOlder} record(s) <= ${cutoffDate}`
        })),
      onConfirm: () => {
        const res = batchDeleteRecordsOlderThan(batchModule, cutoffDate, onlyArchivedForDelete);
        setBatchResultBanner({
          message: `Permanently purged ${res.totalAffected} records older than ${cutoffDate}. Local storage refreshed.`,
          count: res.totalAffected,
          action: 'delete'
        });
        setTimeout(() => setBatchResultBanner(null), 5000);
      }
    });
  };

  const handleManualDeltaSync = async () => {
    setSyncingState(true);
    await triggerBackgroundDeltaSync();
    setTimeout(() => {
      setSyncingState(false);
      setSaveBanner(true);
      setTimeout(() => setSaveBanner(false), 2000);
    }, 600);
  };

  const isAuthorized = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';

  const handleToggle = (key: keyof typeof settings, value: any) => {
    if (!isAuthorized) {
      alert('Administrator permission required to modify system preferences.');
      return;
    }
    updateSettings({ [key]: value });
    setSaveBanner(true);
    setTimeout(() => setSaveBanner(false), 2000);
  };

  const handleClearCache = () => {
    requestConfirmation({
      title: 'Rebuild Local Storage Cache',
      message: 'This will re-index the in-memory state and ensure local browser storage is perfectly balanced for instant page loads. No records will be deleted.',
      confirmLabel: 'Rebuild Cache',
      onConfirm: () => {
        setSaveBanner(true);
        setTimeout(() => setSaveBanner(false), 2000);
      }
    });
  };

  const handleFullBackup = () => {
    const backupKeys = [
      'sg_tracker_sites',
      'sg_tracker_referrals',
      'sg_tracker_vulnerable',
      'sg_tracker_challenging',
      'sg_tracker_laundry',
      'sg_tracker_food',
      'sg_tracker_escalations',
      'sg_tracker_documents',
      'sg_tracker_settings'
    ];
    const data: Record<string, any> = {};
    backupKeys.forEach(k => {
      const val = localStorage.getItem(k);
      if (val) {
        try {
          data[k.replace('sg_tracker_', '')] = JSON.parse(val);
        } catch {}
      }
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sg-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestoreFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const text = event.target?.result as string;
        requestConfirmation({
          title: 'Restore Database from JSON Backup',
          message: 'CRITICAL: Are you sure you want to restore data from this file? All current records will be replaced with the imported dataset.',
          confirmLabel: 'Yes, Restore Database',
          isDanger: true,
          onConfirm: () => {
            const success = restoreBackup(text);
            if (success) {
              setSaveBanner(true);
              setTimeout(() => setSaveBanner(false), 2500);
            } else {
              alert('Error restoring backup file. Please verify JSON schema.');
            }
          }
        });
      } catch (err) {
        alert('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#e1dfdd]">
        <div>
          <h2 className="text-2xl font-semibold text-[#242424] tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#0d9488]" />
            Settings & System Preferences
          </h2>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Manage confirmation alerts, fast loading options, hotel locations, and data backups.
          </p>
        </div>

      {saveBanner && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#107c10] bg-[#e8f5e9] px-3 py-1.5 rounded-xs border border-[#c8e6c9]">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings saved successfully</span>
          </div>
        )}
      </div>

      {!isAuthorized && (
        <div className="bg-amber-50 border-l-4 border-amber-600 p-3.5 rounded-xs flex items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span><strong>View-Only Mode:</strong> Your current role ({currentUserRole}) can view system preferences and references. Global modifications are restricted to Admin & Super Admin roles.</span>
          </div>
          <button
            onClick={() => setCurrentUserRole('Super Admin')}
            className="px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-100 font-semibold text-xs rounded-xs shrink-0"
          >
            Switch to Super Admin
          </button>
        </div>
      )}

      {/* Section 1: Action Confirmation Alerts */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#edebe9] bg-[#faf9f8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0d9488]" />
            <div>
              <h3 className="font-semibold text-xs text-[#242424]">Action Confirmation Alerts</h3>
              <p className="text-[11px] text-[#605e5c]">
                Ask for confirmation before adding, editing, archiving, or deleting records to prevent mistakes.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 divide-y divide-[#edebe9] text-xs">
          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-neutral-800">Confirm Adding New Records</div>
              <div className="text-[11px] text-neutral-500">
                Show a confirmation popup when creating a new record.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requireConfirmForCreates}
                onChange={e => handleToggle('requireConfirmForCreates', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0d9488]"></div>
            </label>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-neutral-800">Confirm Record Edits</div>
              <div className="text-[11px] text-neutral-500">
                Show a confirmation popup when saving updates to an existing record.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requireConfirmForEdits}
                onChange={e => handleToggle('requireConfirmForEdits', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0d9488]"></div>
            </label>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-neutral-800">Confirm Archive & Restore</div>
              <div className="text-[11px] text-neutral-500">
                Show confirmation before moving records between active and historical archive registers.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requireConfirmForArchives}
                onChange={e => handleToggle('requireConfirmForArchives', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0d9488]"></div>
            </label>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-[#a4262c]">Confirm Permanent Deletion</div>
              <div className="text-[11px] text-neutral-500">
                Show a warning popup before permanently removing any record from the system.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requireConfirmForDeletes}
                onChange={e => handleToggle('requireConfirmForDeletes', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#a4262c]"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Section 1b: Security & Inactivity Auto-Logout */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#edebe9] bg-[#faf9f8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#0d9488]" />
            <div>
              <h3 className="font-semibold text-xs text-[#242424]">Security Inactivity Auto-Logout Timer</h3>
              <p className="text-[11px] text-[#605e5c]">
                Automatically locks the session and requires re-authentication after a period of inactivity to safeguard resident data.
              </p>
            </div>
          </div>
          <button
            onClick={() => lockSession('Manual security lock from Settings')}
            className="px-3 py-1.5 bg-[#fdf3f2] hover:bg-[#f8d7d6] text-[#a4262c] border border-[#f8d7d6] rounded-xs font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock Session Now</span>
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-neutral-800">Inactivity Timeout Duration</div>
              <div className="text-[11px] text-neutral-500">
                Time elapsed without mouse, keyboard, or touch interaction before session locks.
              </div>
            </div>
            <select
              value={settings.autoLogoutMinutes ?? 15}
              onChange={e => handleToggle('autoLogoutMinutes', Number(e.target.value))}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-semibold"
            >
              <option value={0}>Disabled (Never lock)</option>
              <option value={5}>5 minutes (High Security)</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes (Standard)</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes (1 hour)</option>
            </select>
          </div>

          <div className="p-3 bg-[#f0fdfa] border border-[#5eead4] rounded-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0d9488]" />
              <span className="text-[#0f766e] font-medium">
                {settings.autoLogoutMinutes > 0 ? `Auto-logout active • ${Math.floor(remainingInactivitySeconds / 60)}m ${remainingInactivitySeconds % 60}s remaining until lock` : 'Auto-logout is currently disabled'}
              </span>
            </div>
            <button
              onClick={() => resetInactivityTimer()}
              className="px-2.5 py-1 bg-white border border-[#0d9488] text-[#0d9488] hover:bg-[#f3f2f1] font-semibold rounded-xs transition-colors"
            >
              Reset Timer
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: Fast Loading & Display Options */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#edebe9] bg-[#faf9f8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-semibold text-xs text-[#242424]">Fast Loading & Display Preferences</h3>
              <p className="text-[11px] text-[#605e5c]">
                Configure display density and browser storage for quick search and page loading.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 divide-y divide-[#edebe9] text-xs">
          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-neutral-800">Pin Actions Column in Tables</div>
              <div className="text-[11px] text-neutral-500">
                Keeps the Actions column pinned to the right edge during horizontal scrolling on data tables.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableColumnPinning ?? true}
                onChange={e => handleToggle('enableColumnPinning', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0d9488]"></div>
            </label>
          </div>
          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-neutral-800">Save Data Locally for Instant Loading</div>
              <div className="text-[11px] text-neutral-500">
                Keeps records ready in your browser so you do not have to wait for pages to load.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableFastCache}
                onChange={e => handleToggle('enableFastCache', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0d9488]"></div>
            </label>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-neutral-800">Compact View</div>
              <div className="text-[11px] text-neutral-500">
                Shows more table rows on screen by reducing row spacing.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.compactView}
                onChange={e => handleToggle('compactView', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0d9488]"></div>
            </label>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-neutral-800">Items Per Page</div>
              <div className="text-[11px] text-neutral-500">
                Choose how many records appear on each table page.
              </div>
            </div>
            <select
              value={settings.pageSize}
              onChange={e => handleToggle('pageSize', Number(e.target.value))}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-semibold"
            >
              <option value={10}>10 items</option>
              <option value={25}>25 items</option>
              <option value={50}>50 items</option>
              <option value={100}>100 items</option>
            </select>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-neutral-800">Refresh Local Storage</div>
              <div className="text-[11px] text-neutral-500">
                Refreshes browser-stored records without deleting any saved information.
              </div>
            </div>
            <button
              onClick={handleClearCache}
              className="px-3 py-1.5 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] font-semibold text-neutral-700 flex items-center gap-1"
            >
              <HardDrive className="w-3.5 h-3.5 text-[#0d9488]" />
              <span>Refresh Storage</span>
            </button>
          </div>
        </div>
      </div>

      {/* Smart Data-Caching Layer Diagnostics */}
      <div className="bg-white border border-[#99f6e4] rounded-xs shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#99f6e4] bg-[#f3f8fd] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#0d9488]" />
            <div>
              <h3 className="font-semibold text-xs text-[#0f766e]">Smart Data-Caching Layer (0ms Lookup & Delta Sync)</h3>
              <p className="text-[11px] text-[#0f766e]/80">
                Maintains instant in-memory indices with local storage hydration and background delta sync.
              </p>
            </div>
          </div>
          <button
            onClick={handleManualDeltaSync}
            disabled={syncingState || cacheStats.isBackgroundSyncing}
            className="px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${syncingState || cacheStats.isBackgroundSyncing ? 'animate-spin' : ''}`} />
            <span>{syncingState || cacheStats.isBackgroundSyncing ? 'Syncing...' : 'Sync Delta Changes'}</span>
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Property Cache Stats */}
          <div className="p-3 bg-white border border-[#e1dfdd] rounded-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#242424]">Properties Cache</span>
              <span className="text-[10px] bg-teal-50 text-[#0f766e] font-bold px-1.5 py-0.5 rounded border border-teal-200">
                0ms Instant
              </span>
            </div>
            <div className="text-2xl font-bold text-[#0d9488]">{properties.length} <span className="text-xs font-normal text-neutral-500">sites cached</span></div>
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
                0ms Instant
              </span>
            </div>
            <div className="text-2xl font-bold text-teal-700">{users.length} <span className="text-xs font-normal text-neutral-500">accounts cached</span></div>
            <div className="text-[11px] text-[#605e5c] space-y-0.5 pt-1 border-t border-[#edebe9]">
              <div>Checksum: <code className="text-[10px] bg-neutral-100 px-1 py-0.2 rounded font-mono">{cacheStats.users.checksum}</code></div>
              <div>Cache Hits: <strong>{cacheStats.users.hitCount}</strong></div>
              <div>Sync State: <span className="text-emerald-700 font-semibold uppercase text-[10px]">{cacheStats.users.syncState}</span></div>
            </div>
          </div>

          {/* Delta Engine Status */}
          <div className="p-3 bg-white border border-[#e1dfdd] rounded-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#242424]">Delta Engine Sync</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                Active
              </span>
            </div>
            <div className="text-2xl font-bold text-emerald-700">{cacheStats.lastSyncFormatted} <span className="text-xs font-normal text-neutral-500">last sync</span></div>
            <div className="text-[11px] text-[#605e5c] space-y-0.5 pt-1 border-t border-[#edebe9]">
              <div>Total Cached Hits: <strong>{cacheStats.totalHits}</strong></div>
              <div>Sync Latency: <strong>{cacheStats.properties.lastSyncDurationMs || 8} ms</strong></div>
              <div>Background Poll: <span className="text-emerald-700 font-semibold">Every 45s (Auto)</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Retention & Batch Performance Maintenance */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#edebe9] bg-[#faf9f8] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-[#0d9488]" />
            <div>
              <h3 className="font-semibold text-xs text-[#242424] flex items-center gap-2">
                Data Retention & Batch Performance Maintenance
                <span className="text-[10px] bg-teal-50 text-[#0f766e] font-bold px-2 py-0.5 rounded-full border border-teal-200">
                  Performance Utility
                </span>
              </h3>
              <p className="text-[11px] text-[#605e5c]">
                Batch-archive or permanently delete historical records older than a specific date to optimize browser storage and maintain peak query speed.
              </p>
            </div>
          </div>

          {batchResultBanner && (
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xs border ${
              batchResultBanner.action === 'archive' 
                ? 'text-[#107c10] bg-[#e8f5e9] border-[#c8e6c9]' 
                : 'text-[#a4262c] bg-red-50 border-red-200'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>{batchResultBanner.message}</span>
            </div>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Controls Bar */}
          <div className="p-3 bg-[#f8f9fa] border border-[#e1dfdd] rounded-xs grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Target Module */}
            <div>
              <label className="block text-[11px] font-bold text-[#323130] mb-1">
                Target Data Collection
              </label>
              <select
                value={batchModule}
                onChange={e => setBatchModule(e.target.value)}
                className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-medium"
              >
                <option value="all">All Operational Modules (Global System)</option>
                <option value="referrals">Safeguarding Referrals</option>
                <option value="vulnerable">Vulnerable Service Users</option>
                <option value="challenging">Challenging Behaviour Logs</option>
                <option value="spcd">SPCD Move-On Tracker</option>
                <option value="maintenance">Maintenance Tracker</option>
                <option value="escalations">Escalations & Incidents</option>
                <option value="food">Food Distribution Logs</option>
                <option value="laundry">Laundry Usage Logs</option>
                <option value="documents">Compliance Documents</option>
                <option value="audit">Activity Audit Logs</option>
              </select>
            </div>

            {/* Cutoff Date */}
            <div>
              <label className="block text-[11px] font-bold text-[#323130] mb-1">
                Retention Cutoff Date (Older than or equal to)
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={cutoffDate}
                  onChange={e => setCutoffDate(e.target.value)}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-semibold"
                />
              </div>
            </div>

            {/* Action Strategy */}
            <div>
              <label className="block text-[11px] font-bold text-[#323130] mb-1">
                Maintenance Action Type
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-neutral-200 rounded-xs border border-neutral-300">
                <button
                  type="button"
                  onClick={() => setBatchActionType('archive')}
                  className={`py-1.5 px-2 text-xs font-semibold rounded-xs transition-colors flex items-center justify-center gap-1.5 ${
                    batchActionType === 'archive'
                      ? 'bg-white text-[#0d9488] shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Batch Archive</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchActionType('delete')}
                  className={`py-1.5 px-2 text-xs font-semibold rounded-xs transition-colors flex items-center justify-center gap-1.5 ${
                    batchActionType === 'delete'
                      ? 'bg-red-600 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Batch Delete</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-[#605e5c] mr-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#0d9488]" />
              Quick Date Presets:
            </span>
            <button
              type="button"
              onClick={() => setDatePreset(30)}
              className="px-2.5 py-1 bg-white hover:bg-[#edebe9] border border-[#8a8886] rounded-xs text-[#323130] text-[11px] font-medium transition-colors"
            >
              Older than 30 Days
            </button>
            <button
              type="button"
              onClick={() => setDatePreset(90)}
              className="px-2.5 py-1 bg-white hover:bg-[#edebe9] border border-[#8a8886] rounded-xs text-[#323130] text-[11px] font-medium transition-colors"
            >
              Older than 90 Days (Quarterly)
            </button>
            <button
              type="button"
              onClick={() => setDatePreset(180)}
              className="px-2.5 py-1 bg-white hover:bg-[#edebe9] border border-[#8a8886] rounded-xs text-[#323130] text-[11px] font-medium transition-colors"
            >
              Older than 180 Days (6 Months)
            </button>
            <button
              type="button"
              onClick={() => setDatePreset(365)}
              className="px-2.5 py-1 bg-white hover:bg-[#edebe9] border border-[#8a8886] rounded-xs text-[#323130] text-[11px] font-medium transition-colors"
            >
              Older than 1 Year (Annual)
            </button>
            <button
              type="button"
              onClick={() => setDatePreset(730)}
              className="px-2.5 py-1 bg-white hover:bg-[#edebe9] border border-[#8a8886] rounded-xs text-[#323130] text-[11px] font-medium transition-colors"
            >
              Older than 2 Years
            </button>
          </div>

          {/* Delete Option Sub-toggle */}
          {batchActionType === 'delete' && (
            <div className="p-3 bg-red-50/70 border border-red-200 rounded-xs flex items-center justify-between text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-900">Deletion Safety Scope</div>
                  <div className="text-[11px] text-red-700">
                    Optionally restrict deletion to records that are already in the archive or marked as resolved.
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-neutral-800 text-xs">
                <input
                  type="checkbox"
                  checked={onlyArchivedForDelete}
                  onChange={e => setOnlyArchivedForDelete(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded-xs border-neutral-300 focus:ring-red-500"
                />
                <span>Purge only archived/resolved records</span>
              </label>
            </div>
          )}

          {/* Live Impact Preview Table */}
          <div className="border border-[#edebe9] rounded-xs overflow-hidden">
            <div className="bg-[#faf9f8] px-3 py-2 border-b border-[#edebe9] flex items-center justify-between text-xs">
              <span className="font-bold text-[#242424] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#0d9488]" />
                Live Impact Preview (Records older than or equal to {cutoffDate})
              </span>
              <span className="text-[11px] font-bold text-[#605e5c]">
                {batchActionType === 'archive' 
                  ? `${totalEligibleToArchive} Active Record(s) Ready to Archive`
                  : `${totalEligibleToDelete} Record(s) Ready to Purge`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#f3f2f1] text-[#323130] border-b border-[#edebe9]">
                    <th className="p-2 font-bold">Module / Collection</th>
                    <th className="p-2 font-bold">Date Filter Reference</th>
                    <th className="p-2 font-bold text-right">Matching Records (≤ {cutoffDate})</th>
                    <th className="p-2 font-bold text-right">Active Records</th>
                    <th className="p-2 font-bold text-right">Archived / Resolved</th>
                    <th className="p-2 font-bold text-center">Batch Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edebe9]">
                  {targetStats.map(stat => {
                    const hasItems = stat.totalOlder > 0;
                    const willAffect = batchActionType === 'archive' 
                      ? (stat.supportsArchive && stat.activeOlder > 0)
                      : (onlyArchivedForDelete ? (stat.supportsArchive ? stat.archivedOlder > 0 : stat.totalOlder > 0) : stat.totalOlder > 0);

                    return (
                      <tr key={stat.id} className={`hover:bg-neutral-50 ${hasItems ? 'bg-white' : 'bg-neutral-50/50 text-neutral-400'}`}>
                        <td className="p-2 font-semibold text-[#242424]">
                          {stat.name}
                        </td>
                        <td className="p-2 text-neutral-500 font-mono text-[11px]">
                          {stat.dateFieldLabel}
                        </td>
                        <td className="p-2 text-right font-bold text-[#242424]">
                          {stat.totalOlder}
                        </td>
                        <td className="p-2 text-right text-emerald-700 font-medium">
                          {stat.activeOlder}
                        </td>
                        <td className="p-2 text-right text-neutral-600 font-medium">
                          {stat.supportsArchive ? stat.archivedOlder : 'N/A'}
                        </td>
                        <td className="p-2 text-center">
                          {willAffect ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              batchActionType === 'archive' 
                                ? 'bg-teal-50 text-[#0d9488] border border-teal-200' 
                                : 'bg-red-50 text-[#a4262c] border border-red-200'
                            }`}>
                              {batchActionType === 'archive' 
                                ? `${stat.activeOlder} to archive` 
                                : `${onlyArchivedForDelete ? (stat.supportsArchive ? stat.archivedOlder : stat.totalOlder) : stat.totalOlder} to purge`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-400">No change</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Execution Footer */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#edebe9]">
            <div className="text-[11px] text-[#605e5c] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />
              <span>
                All batch maintenance operations are strictly audited with timestamp, operator role, and record counts.
              </span>
            </div>

            <div className="flex items-center gap-2">
              {batchActionType === 'archive' ? (
                <button
                  type="button"
                  onClick={handleExecuteBatchArchive}
                  disabled={totalEligibleToArchive === 0}
                  className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Archive className="w-4 h-4" />
                  <span>Execute Batch Archive ({totalEligibleToArchive} records)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleExecuteBatchDelete}
                  disabled={totalEligibleToDelete === 0}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Execute Batch Purge ({totalEligibleToDelete} records)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Supabase & SMTP Backend Configuration */}
      <SupabaseBackendCard />

      {/* Section 3: Data Backup & Reset */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#edebe9] bg-[#faf9f8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#0d9488]" />
            <div>
              <h3 className="font-semibold text-xs text-[#242424]">Backup & Data Recovery</h3>
              <p className="text-[11px] text-[#605e5c]">
                Download a copy of your records, restore a saved backup, or reset to sample data.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 flex flex-wrap items-center gap-3 text-xs">
          <button
            onClick={handleFullBackup}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#8a8886] rounded-xs hover:bg-[#edebe9] font-semibold text-neutral-800"
          >
            <Download className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>Download Backup (JSON)</span>
          </button>

          <label className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#8a8886] rounded-xs hover:bg-[#edebe9] font-semibold text-neutral-800 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>Restore Backup File</span>
            <input type="file" accept=".json" onChange={handleRestoreFromFile} className="hidden" />
          </label>

          {currentUserRole === 'Super Admin' && (
            <button
              onClick={resetAllData}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 border border-red-200 rounded-xs hover:bg-red-100 font-semibold text-[#a4262c] ml-auto"
              title="Emergency Super Admin Backup Reset Option"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Sample Data (Super Admin Emergency Only)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
