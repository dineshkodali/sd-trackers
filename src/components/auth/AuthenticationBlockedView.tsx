import React, { useState } from 'react';
import { 
  ShieldAlert, 
  KeyRound, 
  Clock, 
  ArrowLeft, 
  RotateCw, 
  AlertTriangle, 
  Terminal, 
  CheckCircle2, 
  Mail, 
  Copy, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  XCircle,
  FileText
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { diagnosticLogger, DiagnosticEvent } from '../../utils/diagnosticLogger';

export interface AuthBlockedInfo {
  isBlocked: boolean;
  reason: 'missing_permissions' | 'session_invalidated' | 'account_suspended' | 'token_expired';
  title: string;
  message: string;
  details?: string;
  userEmail?: string;
  userId?: string;
  userRole?: string;
  timestamp: string;
  actionRequired?: string;
}

interface AuthenticationBlockedViewProps {
  blockedInfo: AuthBlockedInfo;
  onReturnToLogin: () => void;
  onRetryVerification?: () => void;
}

export const AuthenticationBlockedView: React.FC<AuthenticationBlockedViewProps> = ({
  blockedInfo,
  onReturnToLogin,
  onRetryVerification
}) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [copied, setCopied] = useState(false);
  const [events, setEvents] = useState<DiagnosticEvent[]>(() => diagnosticLogger.getRecentEvents(30));

  const isSessionIssue = blockedInfo.reason === 'session_invalidated' || blockedInfo.reason === 'token_expired';

  const handleCopyDiagnostics = () => {
    const report = `[SafeHaven Auth Block Report]
Reason: ${blockedInfo.reason}
Title: ${blockedInfo.title}
Message: ${blockedInfo.message}
User Email: ${blockedInfo.userEmail || 'N/A'}
User UID: ${blockedInfo.userId || 'N/A'}
User Role: ${blockedInfo.userRole || 'N/A'}
Timestamp: ${blockedInfo.timestamp}
Details: ${blockedInfo.details || 'None'}
Diagnostic Events:
${events.slice(0, 5).map(e => `[${e.timestamp}] [${e.category.toUpperCase()}] ${e.title}: ${e.details}`).join('\n')}`;

    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  const refreshDiagnostics = () => {
    setEvents(diagnosticLogger.getRecentEvents(30));
  };

  return (
    <div className="min-h-screen bg-[#f3f2f1] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center flex flex-col items-center mb-6">
        <Logo size="lg" />
        <p className="mt-2 text-xs text-[#605e5c] font-medium tracking-wider uppercase">
          SafeHaven Accommodation & Safeguarding System
        </p>
      </div>

      {/* Main Blocked Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white border border-[#edebe9] shadow-sm rounded-xs overflow-hidden">
          {/* Status Header Banner */}
          <div className={`p-6 border-b ${
            isSessionIssue 
              ? 'bg-amber-50/80 border-amber-200 text-amber-950' 
              : 'bg-rose-50/80 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full shrink-0 ${
                isSessionIssue ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {isSessionIssue ? (
                  <Clock className="w-6 h-6" />
                ) : (
                  <ShieldAlert className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    isSessionIssue 
                      ? 'bg-amber-200 text-amber-900 border border-amber-300' 
                      : 'bg-rose-200 text-rose-900 border border-rose-300'
                  }`}>
                    {blockedInfo.reason.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] text-[#605e5c] font-mono">
                    {new Date(blockedInfo.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <h1 className="text-base sm:text-lg font-bold text-[#201f1e] mt-1.5">
                  {blockedInfo.title}
                </h1>
                <p className="text-xs text-[#323130] mt-1 leading-relaxed">
                  {blockedInfo.message}
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Context & Security Notice */}
          <div className="p-6 space-y-5">
            {/* Account & Session Metadata Card */}
            <div className="bg-[#faf9f8] border border-[#edebe9] rounded-xs p-4 text-xs space-y-2.5">
              <div className="font-semibold text-[#323130] flex items-center justify-between border-b border-[#edebe9] pb-1.5">
                <span>Security Context & Identifiers</span>
                <span className="font-mono text-[10px] text-[#8a8886]">UK-GDPR COMPLIANT</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[#605e5c] block">Account Email:</span>
                  <span className="font-mono font-medium text-[#201f1e] break-all">
                    {blockedInfo.userEmail || 'Unidentified staff account'}
                  </span>
                </div>
                <div>
                  <span className="text-[#605e5c] block">Assigned Role:</span>
                  <span className="font-medium text-[#201f1e]">
                    {blockedInfo.userRole || 'Unassigned / Pending Approval'}
                  </span>
                </div>
                <div>
                  <span className="text-[#605e5c] block">User UID:</span>
                  <span className="font-mono text-[10px] text-[#201f1e] truncate block" title={blockedInfo.userId}>
                    {blockedInfo.userId || 'None generated'}
                  </span>
                </div>
                <div>
                  <span className="text-[#605e5c] block">Security Policy:</span>
                  <span className="text-[#201f1e]">
                    {isSessionIssue ? 'Mandatory Session Re-authentication' : 'Strict RBAC Boundary Enforced'}
                  </span>
                </div>
              </div>
            </div>

            {/* Explanation & Remediation Steps */}
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-[#323130] uppercase tracking-wide">
                Required Operational Action
              </h2>
              <div className="p-3.5 bg-[#f3f9fd] border border-[#c7e0f4] rounded-xs text-xs text-[#201f1e] leading-relaxed flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#0078d4] shrink-0 mt-0.5" />
                <div>
                  {blockedInfo.actionRequired || (
                    isSessionIssue ? (
                      <span>
                        Your cryptographic session token has lapsed or was terminated by Supabase security. Click <strong>Return to Sign In</strong> below to re-enter your credentials and generate a fresh session token.
                      </span>
                    ) : (
                      <span>
                        Your credentials are valid, but your database account status is not active or lacks clearance for accommodation modules. Contact your designated <strong>System Administrator</strong> or <strong>Super Admin</strong> to grant appropriate property and role access.
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                id="btn-return-login-blocked"
                onClick={onReturnToLogin}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#0078d4] hover:bg-[#0f766e] text-white text-xs font-semibold rounded-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Sign In Screen</span>
              </button>

              {onRetryVerification && (
                <button
                  type="button"
                  id="btn-retry-auth-verification"
                  onClick={onRetryVerification}
                  className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-[#edebe9] border border-[#8a8886] text-[#323130] text-xs font-medium rounded-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-[#605e5c]" />
                  <span>Re-check Session</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowDiagnostics(!showDiagnostics);
                  refreshDiagnostics();
                }}
                className="w-full sm:w-auto px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-[#323130] text-xs font-medium rounded-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-[#0078d4]" />
                <span>{showDiagnostics ? 'Hide Diagnostic Logs' : 'View Diagnostic Logs'}</span>
                {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Diagnostic Log Viewer Collapsible */}
            {showDiagnostics && (
              <div className="mt-4 border border-[#edebe9] rounded-xs bg-neutral-900 text-neutral-200 p-4 space-y-3 font-mono text-[11px]">
                <div className="flex items-center justify-between border-b border-neutral-700 pb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-neutral-100 text-xs">Diagnostic Console Stream</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyDiagnostics}
                      className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] flex items-center gap-1 transition-colors"
                    >
                      {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy Report'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={refreshDiagnostics}
                      className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] flex items-center gap-1 transition-colors"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {events.length === 0 ? (
                    <p className="text-neutral-500 py-2 text-center italic">No diagnostic events captured yet.</p>
                  ) : (
                    events.map(ev => {
                      const color = 
                        ev.level === 'error' ? 'text-rose-400' :
                        ev.level === 'warn' ? 'text-amber-400' :
                        ev.level === 'success' ? 'text-emerald-400' : 'text-sky-400';
                      return (
                        <div key={ev.id} className="leading-tight py-1 border-b border-neutral-800/60">
                          <div className="flex items-center gap-2">
                            <span className="text-neutral-500 text-[9px]">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                            <span className={`uppercase font-bold text-[9px] ${color}`}>[{ev.category}]</span>
                            <span className="font-semibold text-neutral-200 text-[11px]">{ev.title}</span>
                          </div>
                          <p className="text-neutral-400 text-[10px] pl-4 mt-0.5 break-words">{ev.details}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Support Desk Footer */}
            <div className="border-t border-[#edebe9] pt-4 flex items-center justify-between text-[11px] text-[#605e5c]">
              <span>SafeHaven Compliance Portal &bull; ISO 27001 Security</span>
              <a
                href="mailto:dineshkodali16@gmail.com?subject=SafeHaven%20Access%20Request%20/%20Session%20Issue"
                className="text-[#0078d4] hover:underline flex items-center gap-1 font-medium"
              >
                <Mail className="w-3 h-3" />
                <span>Contact Administrator</span>
              </a>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
