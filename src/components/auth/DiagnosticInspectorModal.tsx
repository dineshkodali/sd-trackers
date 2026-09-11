import React, { useState, useEffect } from 'react';
import { 
  X, 
  Terminal, 
  KeyRound, 
  Clock, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RotateCw, 
  Copy, 
  ShieldCheck,
  Activity,
  Server
} from 'lucide-react';
import { diagnosticLogger, DiagnosticEvent, parseJwtPayload } from '../../utils/diagnosticLogger';
import { apiService } from '../../services/apiService';

interface DiagnosticInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentToken?: string | null;
  currentProfile?: any;
}

export const DiagnosticInspectorModal: React.FC<DiagnosticInspectorModalProps> = ({
  isOpen,
  onClose,
  currentToken,
  currentProfile
}) => {
  const [events, setEvents] = useState<DiagnosticEvent[]>(() => diagnosticLogger.getRecentEvents(100));
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Subscribe to diagnostic events
  useEffect(() => {
    if (!isOpen) return;
    const unsub = diagnosticLogger.subscribe(newEvents => {
      setEvents(newEvents);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedToken = parseJwtPayload(currentToken || localStorage.getItem('sg_tracker_token'));

  const filteredEvents = selectedCategory === 'all' 
    ? events 
    : events.filter(e => e.category === selectedCategory);

  const handleCopyReport = () => {
    const report = `=== SD Operations Diagnostics Summary ===
Timestamp: ${new Date().toISOString()}
Token Status: ${parsedToken.statusDescription}
Token Expire At: ${parsedToken.expiresAtFormatted || 'N/A'}
Token User UID: ${parsedToken.userId || 'N/A'}
Active Profile: ${JSON.stringify(currentProfile || {}, null, 2)}
=== Recent Diagnostic Events ===
${events.slice(0, 15).map(e => `[${e.timestamp}] [${e.category.toUpperCase()}] [${e.level.toUpperCase()}] ${e.title}: ${e.details}`).join('\n')}`;

    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const runLiveTest = async () => {
    setTestingEndpoint(true);
    setTestResult(null);
    try {
      const startTime = performance.now();
      const statusRes = await apiService.getAuthStatus();
      const dbStatus = await apiService.getDbStatus();
      const token = currentToken || localStorage.getItem('sg_tracker_token');
      let meRes: any = { note: 'No token' };
      if (token) {
        meRes = await apiService.verifySession(token);
      }
      const duration = Math.round(performance.now() - startTime);

      const summary = `Diagnostic Check Passed in ${duration}ms:
- Supabase: ${statusRes.configured ? 'Configured & Online' : 'Local Fallback'}
- Database Status: ${dbStatus.mode} (Connected: ${dbStatus.connected})
- Session Check: ${meRes.success ? `Authenticated as ${meRes.user?.email}` : (meRes.error || 'Unauthenticated')}
- Active Token Expiry: ${parsedToken.statusDescription}`;

      setTestResult(summary);
      diagnosticLogger.logSessionStatus(
        meRes.success ? 'active' : 'unauthenticated',
        `Diagnostics run: DB ${dbStatus.mode}, Session ${meRes.success ? 'OK' : 'NONE'}`
      );
    } catch (err: any) {
      setTestResult(`Diagnostic Check Failed: ${err.message}`);
      diagnosticLogger.logSessionStatus('invalidated', `Live test error: ${err.message}`);
    } finally {
      setTestingEndpoint(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xs shadow-xl border border-[#edebe9] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#f8f9fa] border-b border-[#edebe9] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#0078d4]/10 text-[#0078d4] rounded">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#201f1e] flex items-center gap-2">
                Authentication & Supabase Diagnostic Inspector
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono px-2 py-0.5 rounded font-semibold">
                  LIVE STREAM
                </span>
              </h2>
              <p className="text-xs text-[#605e5c]">
                Real-time tracking of Supabase session status, JWT token expiration, and database profile retrieval
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#605e5c] hover:text-[#201f1e] p-1.5 rounded-full hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Key Metric Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Card 1: Session Status */}
            <div className="bg-[#faf9f8] border border-[#edebe9] rounded-xs p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[#323130] uppercase text-[11px] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#0078d4]" />
                  Session State
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  parsedToken.hasToken && !parsedToken.isExpired
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {parsedToken.hasToken && !parsedToken.isExpired ? 'Active' : 'Unauthenticated'}
                </span>
              </div>
              <p className="text-[11px] text-[#605e5c] leading-snug">
                {parsedToken.hasToken 
                  ? (parsedToken.isExpired ? 'Session expired' : 'Cryptographic session valid') 
                  : 'No active session token'}
              </p>
              <div className="mt-3 pt-2 border-t border-[#edebe9] text-[10px] font-mono text-[#8a8886]">
                UID: {parsedToken.userId || 'N/A'}
              </div>
            </div>

            {/* Card 2: Token Expiration */}
            <div className="bg-[#faf9f8] border border-[#edebe9] rounded-xs p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[#323130] uppercase text-[11px] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Token Expiration
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  !parsedToken.hasToken ? 'bg-neutral-100 text-neutral-600' :
                  parsedToken.isExpired ? 'bg-rose-100 text-rose-800' :
                  parsedToken.remainingSeconds < 300 ? 'bg-amber-100 text-amber-800' :
                  'bg-emerald-100 text-emerald-800'
                }`}>
                  {!parsedToken.hasToken ? 'None' : parsedToken.isExpired ? 'Expired' : 'Valid'}
                </span>
              </div>
              <p className="text-[11px] text-[#201f1e] font-medium leading-snug">
                {parsedToken.statusDescription}
              </p>
              <div className="mt-3 pt-2 border-t border-[#edebe9] text-[10px] font-mono text-[#8a8886]">
                Expires: {parsedToken.expiresAtFormatted || 'N/A'}
              </div>
            </div>

            {/* Card 3: Database Profile Status */}
            <div className="bg-[#faf9f8] border border-[#edebe9] rounded-xs p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[#323130] uppercase text-[11px] flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  Database Profile
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-sky-100 text-sky-800">
                  {currentProfile?.role || 'Available'}
                </span>
              </div>
              <p className="text-[11px] text-[#605e5c] leading-snug">
                {currentProfile 
                  ? `${currentProfile.name || currentProfile.email} (${currentProfile.role || 'Staff'})` 
                  : 'Profile retrieved upon login'}
              </p>
              <div className="mt-3 pt-2 border-t border-[#edebe9] text-[10px] font-mono text-[#8a8886]">
                Site: {currentProfile?.assignedSite || 'All Sites'}
              </div>
            </div>
          </div>

          {/* Test Runner Strip */}
          <div className="p-3 bg-[#f3f9fd] border border-[#c7e0f4] rounded-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[#0078d4]" />
              <div>
                <span className="font-bold text-[#201f1e] block">Live Health & Token Validator</span>
                <span className="text-[11px] text-[#605e5c]">Runs an instantaneous live query on Supabase, auth session, and profile endpoints</span>
              </div>
            </div>
            <button
              type="button"
              id="btn-run-live-diagnostics"
              onClick={runLiveTest}
              disabled={testingEndpoint}
              className="px-4 py-2 bg-[#0078d4] hover:bg-[#005a9e] text-white text-xs font-semibold rounded-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${testingEndpoint ? 'animate-spin' : ''}`} />
              <span>{testingEndpoint ? 'Testing Connectivity...' : 'Run Diagnostics'}</span>
            </button>
          </div>

          {/* Test Results output if any */}
          {testResult && (
            <div className="p-3 bg-neutral-900 text-emerald-400 font-mono text-[11px] rounded-xs whitespace-pre-wrap">
              {testResult}
            </div>
          )}

          {/* Event Stream Filter & Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-2 border-t border-[#edebe9]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-[#605e5c] mr-1">Filter Stream:</span>
              {['all', 'session', 'token', 'profile', 'permission', 'audit'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium uppercase tracking-wider cursor-pointer transition-colors ${
                    selectedCategory === cat 
                      ? 'bg-[#0078d4] text-white' 
                      : 'bg-neutral-100 hover:bg-neutral-200 text-[#323130]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyReport}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-[#323130] text-xs font-medium rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#605e5c]" />}
                <span>{copied ? 'Copied' : 'Copy Log Report'}</span>
              </button>
              <button
                type="button"
                onClick={() => diagnosticLogger.clearLogs()}
                className="px-3 py-1.5 bg-white border border-[#edebe9] hover:bg-neutral-50 text-rose-600 text-xs font-medium rounded-xs transition-colors cursor-pointer"
              >
                Clear Stream
              </button>
            </div>
          </div>

          {/* Live Diagnostic Events Terminal Window */}
          <div className="border border-neutral-800 rounded-xs bg-neutral-950 text-neutral-200 p-4 font-mono text-[11px] space-y-2 h-72 overflow-y-auto">
            {filteredEvents.length === 0 ? (
              <div className="h-full flex items-center justify-center text-neutral-500 italic">
                No diagnostic events captured in category "{selectedCategory}".
              </div>
            ) : (
              filteredEvents.map(ev => {
                const color = 
                  ev.level === 'error' ? 'text-rose-400 font-bold' :
                  ev.level === 'warn' ? 'text-amber-400 font-semibold' :
                  ev.level === 'success' ? 'text-emerald-400 font-semibold' : 'text-sky-300';
                return (
                  <div key={ev.id} className="border-b border-neutral-900 pb-1.5 last:border-0 leading-tight">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-neutral-500 text-[10px]">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                      <span className={`uppercase text-[9px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 ${color}`}>
                        {ev.category}
                      </span>
                      <span className="text-neutral-100 font-semibold">{ev.title}</span>
                    </div>
                    <p className="text-neutral-400 text-[10px] pl-2 mt-0.5 break-words">{ev.details}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#f8f9fa] border-t border-[#edebe9] flex items-center justify-between text-xs text-[#605e5c]">
          <span>Diagnostic events automatically capture all database profile retrievals, token lifespans, and audit middleware dispatches.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-[#201f1e] font-semibold rounded-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
