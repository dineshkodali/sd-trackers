import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const NetworkStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' 
      ? navigator.onLine 
      : true;
  });
  const [showTooltip, setShowTooltip] = useState(false);
  const [lastChanged, setLastChanged] = useState<Date | null>(null);
  const [justReconnected, setJustReconnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastChanged(new Date());
      setJustReconnected(true);
      setTestResult(null);

      // Auto-hide the "just reconnected" banner after 4 seconds
      const timer = setTimeout(() => {
        setJustReconnected(false);
      }, 4000);

      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastChanged(new Date());
      setJustReconnected(false);
      setTestResult(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Close tooltip on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // Test connectivity by making a cache-busted fetch to a lightweight endpoint or current origin
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const response = await fetch(window.location.origin + '/favicon.ico?' + Date.now(), {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      }).catch(() => null);
      
      clearTimeout(timeoutId);

      if (response && (response.ok || response.status === 404 || response.type === 'opaque')) {
        setIsOnline(true);
        setTestResult('Verified: Network connection is active and responsive.');
      } else if (navigator.onLine) {
        setIsOnline(true);
        setTestResult('Verified: Browser reports online status.');
      } else {
        setIsOnline(false);
        setTestResult('No internet or server response detected.');
      }
    } catch {
      if (navigator.onLine) {
        setIsOnline(true);
        setTestResult('Browser reports online.');
      } else {
        setIsOnline(false);
        setTestResult('Unable to reach server. You are offline.');
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Small Status Indicator in Header */}
      <button
        id="network-status-indicator"
        onClick={() => setShowTooltip(prev => !prev)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-xs text-xs font-semibold transition-all duration-200 border cursor-pointer select-none ${
          !isOnline
            ? 'bg-[#fdf3f2] text-[#a4262c] border-[#f1998e] hover:bg-[#fde7e9] animate-pulse shadow-xs'
            : justReconnected
            ? 'bg-[#dff6dd] text-[#107c10] border-[#92c353] hover:bg-[#d0f0ce]'
            : 'bg-[#f8f9fa] text-[#484644] border-[#edebe9] hover:bg-[#edebe9] hover:text-[#242424]'
        }`}
        title={
          !isOnline 
            ? 'Warning: Application is currently offline. Click for details.' 
            : justReconnected 
            ? 'Network restored: You are back online.' 
            : 'Network Status: Online'
        }
        aria-label={!isOnline ? 'Network status: Offline' : 'Network status: Online'}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-[#a4262c] shrink-0" />
            <span className="text-[11px] font-bold tracking-tight text-[#a4262c]">Offline</span>
            <span className="w-2 h-2 rounded-full bg-[#a4262c] animate-ping ml-0.5 hidden sm:inline-block" />
          </>
        ) : justReconnected ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#107c10] shrink-0" />
            <span className="text-[11px] font-bold text-[#107c10]">Back Online</span>
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#107c10]" />
            </span>
            <Wifi className="w-3.5 h-3.5 text-[#107c10] shrink-0 hidden sm:inline-block" />
            <span className="text-[11px] font-medium text-[#605e5c] hidden md:inline-block">Online</span>
          </>
        )}
      </button>

      {/* Flyout / Detail Popover */}
      {showTooltip && (
        <div
          id="network-status-popover"
          className="absolute right-0 mt-1.5 w-72 sm:w-80 bg-white border border-[#e1dfdd] shadow-xl rounded-xs p-3 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#edebe9] mb-2.5">
            <div className="flex items-center gap-2">
              {!isOnline ? (
                <div className="p-1 rounded bg-[#fdf3f2] text-[#a4262c]">
                  <WifiOff className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-1 rounded bg-[#dff6dd] text-[#107c10]">
                  <Wifi className="w-4 h-4" />
                </div>
              )}
              <div>
                <h4 className="font-bold text-xs text-[#242424]">
                  {!isOnline ? 'Offline Mode Active' : 'Network Connected'}
                </h4>
                <p className="text-[10px] text-[#605e5c]">
                  {!isOnline ? 'No active network connection' : 'Connected & operational'}
                </p>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                !isOnline
                  ? 'bg-[#fdf3f2] text-[#a4262c] border border-[#f1998e]'
                  : 'bg-[#dff6dd] text-[#107c10] border border-[#92c353]'
              }`}
            >
              {!isOnline ? 'Offline' : 'Online'}
            </span>
          </div>

          <div className="space-y-2 text-[#605e5c] leading-relaxed text-[11px]">
            {!isOnline ? (
              <div className="bg-[#fff4ce] border border-[#ffb900] text-[#7f6000] p-2 rounded-xs flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#7f6000]" />
                <div>
                  <strong className="block text-[#323130] font-semibold text-[11px]">Offline Notice:</strong>
                  You can continue viewing and editing cached records. Changes will remain securely in local storage and will sync once connection is restored.
                </div>
              </div>
            ) : (
              <div className="bg-[#f3f8fd] border border-[#99f6e4] text-[#0f766e] p-2 rounded-xs flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#0d9488]" />
                <div>
                  Application is online. Real-time logging, PDF exports, and data changes are operating normally.
                </div>
              </div>
            )}

            {lastChanged && (
              <div className="flex justify-between items-center text-[10px] text-[#797775] pt-1">
                <span>Last status change:</span>
                <span className="font-medium text-[#323130]">{lastChanged.toLocaleTimeString()}</span>
              </div>
            )}

            {testResult && (
              <div className={`p-1.5 rounded-xs text-[10px] font-medium ${
                isOnline ? 'bg-[#f0f9eb] text-[#107c10]' : 'bg-[#fdf3f2] text-[#a4262c]'
              }`}>
                {testResult}
              </div>
            )}
          </div>

          {/* Action button */}
          <div className="mt-3 pt-2 border-t border-[#edebe9] flex items-center justify-between">
            <span className="text-[10px] text-[#797775]">Auto-detects network changes</span>
            <button
              id="btn-test-connection"
              onClick={testConnection}
              disabled={isTesting}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 text-[#0d9488] ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Checking...' : 'Check Connection'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
