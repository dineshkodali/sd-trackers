import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  Building2, 
  ShieldCheck, 
  RefreshCw, 
  X,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiService } from '../../services/apiService';
import { Logo } from '../common/Logo';

export const LoginView: React.FC = () => {
  const { 
    login, 
    authError, 
    authLoading,
    isPasswordRecoveryMode,
    setIsPasswordRecoveryMode,
    recoveryAccessToken,
    recoveryEmail
  } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  // Forgot Password modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatusMessage, setResetStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Set New Password (Recovery) modal
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Supabase Auth service status
  const [authConfigured, setAuthConfigured] = useState<boolean>(true);
  const [statusChecking, setStatusChecking] = useState<boolean>(false);

  useEffect(() => {
    // If browser loaded on /auth/callback, cleanly normalize URL to root
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
      window.history.replaceState(null, '', '/');
    }

    setStatusChecking(true);
    apiService.getAuthStatus().then(status => {
      setAuthConfigured(Boolean(status?.supabaseConfigured ?? true));
    }).catch(() => {
      setAuthConfigured(true);
    }).finally(() => {
      setStatusChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanPass = password ? password.trim() : '';

    if (!cleanEmail) {
      setLocalError('Please enter your staff email address.');
      return;
    }

    if (!cleanPass) {
      setLocalError('Please enter your password.');
      return;
    }

    try {
      const success = await login(cleanEmail, cleanPass);
      if (!success && !authError) {
        setLocalError('Invalid email address or password. Please verify your Supabase credentials.');
      }
    } catch (err: any) {
      setLocalError(err.message || 'Authentication encountered an error. Please try again.');
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetStatusMessage({ type: 'error', text: 'Please enter your registered email address.' });
      return;
    }

    setResetLoading(true);
    setResetStatusMessage(null);
    try {
      const res = await apiService.resetPassword(resetEmail.trim().toLowerCase());
      if (res.error) {
        setResetStatusMessage({ type: 'error', text: res.error });
      } else {
        setResetStatusMessage({
          type: 'success',
          text: `A password reset link has been dispatched to ${resetEmail.trim()}. Please inspect your inbox.`
        });
        setTimeout(() => {
          setIsResetModalOpen(false);
          setResetEmail('');
          setResetStatusMessage(null);
        }, 3500);
      }
    } catch (err: any) {
      setResetStatusMessage({ type: 'error', text: err.message || 'Failed to dispatch reset instructions.' });
    } finally {
      setResetLoading(false);
    }
  };

  const handleUpdateNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryStatus(null);

    if (!newPassword || newPassword.length < 6) {
      setRecoveryStatus({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setRecoveryStatus({ type: 'error', text: 'Passwords do not match. Please re-enter carefully.' });
      return;
    }

    setRecoverySubmitting(true);
    try {
      const res = await apiService.updateUserPassword(newPassword, recoveryAccessToken || undefined);
      if (res.error) {
        setRecoveryStatus({ type: 'error', text: res.error });
      } else {
        setRecoveryStatus({
          type: 'success',
          text: 'Password updated successfully! You can now sign in with your new credentials.'
        });
        if (recoveryEmail) {
          setEmail(recoveryEmail);
        }
        setTimeout(() => {
          setIsPasswordRecoveryMode(false);
          setRecoveryStatus(null);
          setNewPassword('');
          setConfirmPassword('');
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', '/');
          }
        }, 2500);
      }
    } catch (err: any) {
      setRecoveryStatus({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setRecoverySubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#0d9488]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#0284c7]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-slate-800/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main Authentication Card */}
      <div className="w-full max-w-4xl relative z-10 bg-[#1e293b]/90 backdrop-blur-xl border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        
        {/* Left Side: Brand Identity & Compliance Overview (5 cols) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f766e]/30 p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-700/60">
          <div>
            <div className="mb-6">
              <Logo size="lg" />
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-teal-500/10 border border-teal-500/30 px-3 py-1 text-xs font-semibold text-teal-300 mb-4">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>Supabase Authentication</span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight leading-snug">
              SD Commercial Operations Portal
            </h1>
            <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
              Unified compliance and management system for housing operations, safeguarding referrals, resident welfare, and maintenance workflows.
            </p>

            <div className="mt-8 space-y-3 text-xs">
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <div className="w-8 h-8 rounded-md bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Multi-Site Accommodation</div>
                  <div className="text-[11px] text-slate-400">Hotel &amp; property operation tracking</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <div className="w-8 h-8 rounded-md bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Role-Based Access Control</div>
                  <div className="text-[11px] text-slate-400">Governed strictly by Supabase Auth</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Supabase Cloud Auth Active</span>
            </div>
          </div>
        </div>

        {/* Right Side: Enhanced Sign In Form (7 cols) */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between bg-[#1e293b]/70">
          <div>
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider font-bold text-teal-400">
                Staff Authentication
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                Sign in to your account
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter your registered Supabase credentials to access your designated properties.
              </p>
            </div>

            {/* Error Banner */}
            {(localError || authError) && (
              <div className="mb-6 p-3.5 bg-red-950/50 border border-red-500/50 rounded-lg flex items-start gap-3 text-xs text-red-200 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">
                  {localError || authError}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Staff Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. staff@sdcommercial.co.uk"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setIsResetModalOpen(true);
                    }}
                    className="text-[11px] text-teal-400 hover:text-teal-300 transition-colors font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded-sm border-slate-700 bg-slate-900 text-teal-600 focus:ring-teal-500 focus:ring-offset-0"
                  />
                  <span className="text-xs text-slate-400">Remember this device</span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-semibold rounded-lg text-xs shadow-lg shadow-teal-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
                >
                  {authLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Authenticating with Supabase...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In with Supabase</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Footer Security Notice */}
          <div className="pt-6 mt-6 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>TLS 256-bit Encrypted</span>
            </span>
            <span>SD Commercial UK LTD</span>
          </div>
        </div>
      </div>

      {/* PASSWORD RESET MODAL */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-slate-200">
            <div className="px-6 py-4 border-b border-slate-700/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-white">Reset Staff Password</h3>
              </div>
              <button 
                onClick={() => {
                  setIsResetModalOpen(false);
                  setResetStatusMessage(null);
                }} 
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordReset} className="p-6 space-y-4 text-xs">
              <p className="text-slate-400 leading-relaxed">
                Enter your registered Supabase email address. We will dispatch secure password recovery instructions.
              </p>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="staff@sdcommercial.co.uk"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500"
                />
              </div>

              {resetStatusMessage && (
                <div className={`p-3 rounded-lg flex items-start gap-2 ${
                  resetStatusMessage.type === 'error'
                    ? 'bg-red-950/60 text-red-200 border border-red-500/50'
                    : 'bg-teal-950/60 text-teal-200 border border-teal-500/50'
                }`}>
                  {resetStatusMessage.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  )}
                  <span className="font-medium">{resetStatusMessage.text}</span>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetModalOpen(false);
                    setResetStatusMessage(null);
                  }}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {resetLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <span>Send Reset Email</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD RECOVERY / SET NEW PASSWORD MODAL */}
      {isPasswordRecoveryMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#1e293b] border border-teal-500/40 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-200">
            <div className="px-6 py-4 border-b border-slate-700/80 bg-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30">
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Set New Password</h3>
                  <p className="text-[11px] text-teal-400 font-medium">Supabase Password Recovery</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsPasswordRecoveryMode(false);
                  setRecoveryStatus(null);
                  if (typeof window !== 'undefined') {
                    window.history.replaceState(null, '', '/');
                  }
                }} 
                className="text-slate-400 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateNewPassword} className="p-6 space-y-4 text-xs">
              {recoveryEmail ? (
                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/70 text-slate-300 text-[11px]">
                  Account: <span className="font-semibold text-white">{recoveryEmail}</span>
                </div>
              ) : (
                <p className="text-slate-400 leading-relaxed">
                  Enter your new password below. It must be at least 6 characters in length.
                </p>
              )}

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 6 characters"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500"
                />
              </div>

              {recoveryStatus && (
                <div className={`p-3 rounded-lg flex items-start gap-2 ${
                  recoveryStatus.type === 'error'
                    ? 'bg-red-950/60 text-red-200 border border-red-500/50'
                    : 'bg-teal-950/60 text-teal-200 border border-teal-500/50'
                }`}>
                  {recoveryStatus.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  )}
                  <span className="font-medium">{recoveryStatus.text}</span>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordRecoveryMode(false);
                    setRecoveryStatus(null);
                    if (typeof window !== 'undefined') {
                      window.history.replaceState(null, '', '/');
                    }
                  }}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recoverySubmitting}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {recoverySubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Save &amp; Return to Login</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
