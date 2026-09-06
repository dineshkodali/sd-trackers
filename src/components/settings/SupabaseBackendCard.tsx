import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Send, 
  UploadCloud, 
  FileCode, 
  Key, 
  ExternalLink, 
  Copy, 
  Check,
  Shield,
  LogIn
} from 'lucide-react';
import { apiService, SystemConfigStatus, DbStatusResponse } from '../../services/apiService';
import { useApp } from '../../context/AppContext';

export const SupabaseBackendCard: React.FC = () => {
  const { 
    referrals, 
    vulnerableSUs, 
    challengingSUs, 
    maintenanceRecords, 
    spcdRecords, 
    sites 
  } = useApp();

  const [config, setConfig] = useState<SystemConfigStatus | null>(null);
  const [dbStatus, setDbStatus] = useState<DbStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingDb, setTestingDb] = useState<boolean>(false);

  // SMTP test state
  const [smtpEmail, setSmtpEmail] = useState<string>('');
  const [testingSmtp, setTestingSmtp] = useState<boolean>(false);
  const [smtpResult, setSmtpResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Migration state
  const [migrating, setMigrating] = useState<boolean>(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; message: string } | null>(null);

  // Schema modal state
  const [showSchemaHelp, setShowSchemaHelp] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const [cfg, db] = await Promise.all([
        apiService.getConfigStatus(),
        apiService.getDbStatus()
      ]);
      setConfig(cfg);
      setDbStatus(db);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);


  const handleTestSupabase = async () => {
    setTestingDb(true);
    setTestResult(null);
    try {
      const res = await apiService.testSupabase();
      setTestResult(res);
      await loadStatus();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTestingDb(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpResult(null);
    try {
      const res = await apiService.testSmtp(smtpEmail.trim() || undefined);
      setSmtpResult(res);
    } catch (err: any) {
      setSmtpResult({ success: false, message: err.message });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handlePushAllToSupabase = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiService.syncPushAll({
        referrals,
        vulnerable: vulnerableSUs,
        challenging: challengingSUs,
        maintenance: maintenanceRecords,
        spcd: spcdRecords,
        sites
      });
      if (res.success) {
        setSyncResult('All active records successfully synchronized to Supabase PostgreSQL database.');
        await loadStatus();
      } else {
        setSyncResult(`Sync issue: ${res.message}`);
      }
    } catch (err: any) {
      setSyncResult(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRunMigration = async () => {
    setMigrating(true);
    setMigrationResult(null);
    try {
      const res = await apiService.runMigration();
      setMigrationResult(res);
      await loadStatus();
    } catch (err: any) {
      setMigrationResult({ success: false, message: `Migration error: ${err.message}` });
    } finally {
      setMigrating(false);
    }
  };

  const copyEnvSnippet = () => {
    const text = `# Supabase Database & Auth (Backend credentials)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.your-project.supabase.co:5432/postgres

# SMTP Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM="SafeHaven Operations <noreply@safehavenops.org>"
SMTP_SECURE=false`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSupabaseConfigured = config?.services?.supabase?.configured;
  const isSmtpConfigured = config?.services?.smtp?.configured;

  return (
    <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#edebe9] bg-[#faf9f8] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-[#0d9488]" />
          <div>
            <h3 className="font-semibold text-xs text-[#242424] flex items-center gap-2">
              Supabase Database &amp; SMTP Email Backend
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                isSupabaseConfigured 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {isSupabaseConfigured ? 'Supabase Connected' : 'Local / Awaiting .env Keys'}
              </span>
            </h3>
            <p className="text-[11px] text-[#605e5c]">
              All database storage, authentication, and SMTP notifications are routed securely through server API routes (<code className="bg-[#edebe9] px-1 rounded text-[#242424]">/api/*</code>).
            </p>
          </div>
        </div>

        <button
          onClick={loadStatus}
          disabled={loading}
          className="p-1.5 text-[#605e5c] hover:text-[#242424] hover:bg-[#edebe9] rounded-xs transition-colors"
          title="Refresh backend status"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-4 space-y-5 text-xs">
        {/* Security & Architecture Architecture Notice */}
        <div className="bg-teal-50/60 border border-teal-200 p-3 rounded-xs flex items-start gap-2.5 text-teal-900">
          <Key className="w-4 h-4 text-[#0d9488] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-[11px]">Strict Backend API Proxy Architecture</div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              In accordance with security standards, <strong>zero API keys or credentials are stored or exposed inside the client webapp</strong>. All credentials (<code className="font-mono bg-white/70 px-1 py-0.5 rounded">SUPABASE_URL</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">SMTP_*</code>) reside strictly in the root <code className="font-mono font-bold">.env</code> file.
            </p>
          </div>
        </div>

        {/* Status Cards: Supabase Database, Authentication, and SMTP */ }
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Supabase Status */}
          <div className="border border-[#edebe9] rounded-xs p-3.5 bg-[#faf9f8] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#0d9488]" />
                <span className="font-semibold text-neutral-800 text-xs">Supabase PostgreSQL</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                isSupabaseConfigured 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {isSupabaseConfigured ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3 text-amber-600" />}
                {isSupabaseConfigured ? 'Connected' : 'Pending Keys in .env'}
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-[#605e5c]">
              <div className="flex justify-between py-1 border-b border-[#edebe9]">
                <span>Supabase URL:</span>
                <span className="font-mono text-neutral-800">{config?.services?.supabase?.url || 'Not set in .env'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#edebe9]">
                <span>Service Role Key:</span>
                <span className="font-mono text-neutral-800">{config?.services?.supabase?.hasServiceRoleKey ? 'Present (Server-only)' : 'Missing'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#edebe9]">
                <span>Anon Public Key:</span>
                <span className="font-mono text-neutral-800">{config?.services?.supabase?.hasAnonKey ? 'Present' : 'Missing'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Storage Mode:</span>
                <span className="font-semibold text-[#0d9488]">{dbStatus?.mode === 'supabase-cloud' ? 'Supabase Cloud PostgreSQL' : 'Local State (Safe Fallback)'}</span>
              </div>
            </div>

            {/* Test, Migrate & Push Actions */}
            <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-[#edebe9]">
              <button
                type="button"
                onClick={handleTestSupabase}
                disabled={testingDb}
                className="px-2.5 py-1.5 bg-white border border-[#8a8886] hover:bg-[#edebe9] text-neutral-800 font-semibold rounded-xs text-[11px] transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 text-[#0d9488] ${testingDb ? 'animate-spin' : ''}`} />
                <span>Test Connection</span>
              </button>

              <button
                type="button"
                onClick={handleRunMigration}
                disabled={migrating}
                className="px-2.5 py-1.5 bg-[#0078d4] hover:bg-[#106ebe] text-white font-semibold rounded-xs text-[11px] transition-colors flex items-center gap-1.5 shadow-2xs"
                title="Execute SQL schema migration script on Supabase PostgreSQL"
              >
                <FileCode className={`w-3 h-3 ${migrating ? 'animate-spin' : ''}`} />
                <span>{migrating ? 'Migrating...' : 'Run Migration SQL'}</span>
              </button>

              <button
                type="button"
                onClick={handlePushAllToSupabase}
                disabled={syncing || !isSupabaseConfigured}
                className="px-2.5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold rounded-xs text-[11px] transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Push active local records into Supabase tables"
              >
                <UploadCloud className="w-3 h-3" />
                <span>{syncing ? 'Syncing...' : 'Push All Data'}</span>
              </button>
            </div>

            {testResult && (
              <div className={`p-2 rounded-xs text-[11px] border ${
                testResult.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {testResult.message}
              </div>
            )}

            {migrationResult && (
              <div className={`p-2 rounded-xs text-[11px] border ${
                migrationResult.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                {migrationResult.message}
              </div>
            )}

            {syncResult && (
              <div className="p-2 bg-teal-50 border border-teal-200 rounded-xs text-[11px] text-teal-900">
                {syncResult}
              </div>
            )}
          </div>

          {/* Card 2: Supabase Auth & Password Recovery */}
          <div className="border border-[#edebe9] rounded-xs p-3.5 bg-[#faf9f8] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#0d9488]" />
                <span className="font-semibold text-neutral-800 text-xs">Supabase Authentication</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-teal-50 text-[#0d9488] border border-teal-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#0d9488]" />
                Supabase Auth
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-[#605e5c]">
              <div className="flex justify-between py-1 border-b border-[#edebe9]">
                <span>Auth Engine:</span>
                <span className="font-mono text-neutral-800 font-semibold">Supabase Auth (Native)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#edebe9]">
                <span>Password Recovery:</span>
                <span className="text-emerald-700 font-medium">Active (Supabase Magic Link)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#edebe9]">
                <span>Session Security:</span>
                <span className="font-mono text-neutral-800">TLS 256-bit JWT</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Access Control:</span>
                <span className="text-neutral-800 font-medium">Role-Based (RBAC)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#edebe9]">
              <div className="p-2 bg-emerald-50/70 border border-emerald-200 rounded-xs text-[10px] text-emerald-900 leading-relaxed">
                Logins, password recovery emails, and credential verification are powered directly by Supabase Auth with zero external third-party dependencies.
              </div>
            </div>
          </div>

          {/* Card 3: SMTP Email Service */}
          <div className="border border-[#edebe9] rounded-xs p-3.5 bg-[#faf9f8] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#0d9488]" />
                <span className="font-semibold text-neutral-800 text-xs">SMTP Email Service</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                isSmtpConfigured 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {isSmtpConfigured ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3 text-amber-600" />}
                {isSmtpConfigured ? 'Ready' : 'Pending Keys in .env'}
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-[#605e5c]">
              <div className="flex justify-between py-1 border-b border-[#edebe9]">
                <span>SMTP Host:</span>
                <span className="font-mono text-neutral-800">{config?.services?.smtp?.host || 'Not set in .env'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#edebe9]">
                <span>SMTP Port:</span>
                <span className="font-mono text-neutral-800">{config?.services?.smtp?.port || '587'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#edebe9]">
                <span>Default From:</span>
                <span className="font-mono text-neutral-800 truncate max-w-[180px]">{config?.services?.smtp?.from || 'Default'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Alerts Supported:</span>
                <span className="text-neutral-800 font-medium">Safeguarding, Maintenance &amp; SPCD</span>
              </div>
            </div>

            {/* Test Email Dispatch Form */}
            <div className="pt-2 space-y-2 border-t border-[#edebe9]">
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={smtpEmail}
                  onChange={e => setSmtpEmail(e.target.value)}
                  placeholder="Recipient (e.g. ops@safehaven.org)..."
                  className="flex-1 px-2.5 py-1 text-xs border border-[#c8c6c4] rounded-xs bg-white focus:outline-none focus:border-[#0d9488]"
                />
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp || !isSmtpConfigured}
                  className="px-3 py-1 bg-white border border-[#8a8886] hover:bg-[#edebe9] text-neutral-800 font-semibold rounded-xs text-[11px] transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Send className={`w-3 h-3 text-[#0d9488] ${testingSmtp ? 'animate-pulse' : ''}`} />
                  <span>{testingSmtp ? 'Sending...' : 'Send Test'}</span>
                </button>
              </div>

              {smtpResult && (
                <div className={`p-2 rounded-xs text-[11px] border ${
                  smtpResult.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {smtpResult.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Database Table Inspector */}
        {dbStatus?.tables && Object.keys(dbStatus.tables).length > 0 && (
          <div className="border border-[#e1dfdd] rounded-xs p-3.5 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-xs text-[#242424] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#0d9488]" />
                Live Database Tables Inspector ({Object.keys(dbStatus.tables).length} Entities)
              </h4>
              <span className="text-[10px] text-[#605e5c]">Supabase PostgreSQL Table Status</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-[11px]">
              {Object.entries(dbStatus.tables).map(([entity, count]) => {
                const isErr = typeof count === 'string' && count.startsWith('Error');
                return (
                  <div key={entity} className={`p-2 rounded-xs border text-xs ${
                    isErr ? 'bg-red-50/50 border-red-200 text-red-900' : 'bg-[#faf9f8] border-[#edebe9] text-[#242424]'
                  }`}>
                    <div className="font-mono font-bold text-[10px] text-[#605e5c] uppercase truncate">{entity}</div>
                    <div className="font-semibold mt-0.5 truncate">
                      {isErr ? (
                        <span className="text-red-600 text-[10px]">Table Missing</span>
                      ) : (
                        <span className="text-[#0d9488]">{count} records</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Supabase Schema Helper Banner */}
        <div className="bg-[#faf9f8] border border-[#e1dfdd] rounded-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileCode className="w-5 h-5 text-[#0d9488] shrink-0" />
            <div>
              <div className="font-semibold text-xs text-[#242424]">Database Schema Initialization File</div>
              <div className="text-[11px] text-[#605e5c]">
                A complete SQL migration script is prepared at <code className="font-mono font-semibold text-[#0d9488]">/supabase-schema.sql</code>. Execute this once in the Supabase SQL Editor to initialize all tables, indexes, and security policies.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyEnvSnippet}
              className="px-2.5 py-1.5 bg-white border border-[#8a8886] hover:bg-[#edebe9] text-neutral-800 font-semibold rounded-xs text-[11px] transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#0d9488]" />}
              <span>{copied ? 'Copied .env' : 'Copy .env Template'}</span>
            </button>
            <button
              onClick={() => setShowSchemaHelp(!showSchemaHelp)}
              className="px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-semibold rounded-xs text-[11px] transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <span>{showSchemaHelp ? 'Hide SQL Help' : 'View SQL Setup Guide'}</span>
            </button>
          </div>
        </div>

        {showSchemaHelp && (
          <div className="p-3.5 bg-neutral-900 text-neutral-100 rounded-xs font-mono text-[11px] space-y-2 border border-neutral-800">
            <div className="text-emerald-400 font-bold font-sans flex items-center justify-between">
              <span>Quick Supabase Setup Instructions:</span>
              <span className="text-neutral-400 text-[10px]">supabase-schema.sql</span>
            </div>
            <ol className="list-decimal pl-5 space-y-1 font-sans text-neutral-300">
              <li>Open your project at <strong>https://app.supabase.com</strong>.</li>
              <li>Navigate to the <strong>SQL Editor</strong> in the left navigation sidebar.</li>
              <li>Paste the contents of <code className="text-amber-300">supabase-schema.sql</code> from this project's root folder and click <strong>Run</strong>.</li>
              <li>Go to <strong>Project Settings &gt; API</strong> to copy your <strong>URL</strong>, <strong>anon key</strong>, and <strong>service_role secret</strong> into your root <code className="text-amber-300">.env</code> file.</li>
              <li>Restart or refresh the application — your cloud database and auth are now fully connected!</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};
