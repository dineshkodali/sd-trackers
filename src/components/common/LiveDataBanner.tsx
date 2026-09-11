import React from 'react';
import { AlertTriangle, WifiOff, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * Tells the user, plainly, when the live database cannot store their work.
 * There is no local fallback any more, so a silent failure would mean lost
 * data; this banner is the visible side of that decision.
 */
export const LiveDataBanner: React.FC = () => {
  const { liveDataStatus, syncFromDatabase, setActivePage, canManageSettings } = useApp();
  const [retrying, setRetrying] = React.useState(false);

  if (liveDataStatus.state !== 'offline' && liveDataStatus.state !== 'degraded') return null;

  const offline = liveDataStatus.state === 'offline';

  const retry = async () => {
    setRetrying(true);
    try {
      await syncFromDatabase();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      id="live-data-banner"
      role="alert"
      className={`mb-4 flex flex-wrap items-start gap-3 rounded-xs border px-3 py-2.5 text-xs ${
        offline ? 'border-red-300 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 text-amber-900'
      }`}
    >
      {offline ? <WifiOff className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="font-semibold">
          {offline ? 'Live database unavailable - changes cannot be saved' : 'Some modules are not connected to the live database'}
        </div>
        <div className="leading-relaxed">{liveDataStatus.message}</div>
        {!offline && liveDataStatus.unavailable.length > 0 && (
          <div className="text-[11px] opacity-90">Affected: {liveDataStatus.unavailable.join(', ')}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!offline && canManageSettings() && (
          <button
            type="button"
            onClick={() => setActivePage('settings')}
            className="rounded-xs border border-current px-2.5 py-1 font-semibold hover:bg-white/60"
          >
            Open Database Settings
          </button>
        )}
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="flex items-center gap-1 rounded-xs border border-current px-2.5 py-1 font-semibold hover:bg-white/60 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    </div>
  );
};
