import React, { useState, useEffect } from 'react';
import { IconShield as Shield, IconLock as Lock, IconMail as Mail, IconEye as Eye, IconEyeOff as EyeOff, IconArrowRight as ArrowRight, IconAlertCircle as AlertCircle, IconBuilding as Building2, IconShieldCheck as ShieldCheck, IconRefresh as RefreshCw, IconX as X, IconCircleCheck as CheckCircle2 } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { apiService } from '../../services/apiService';
import { getBrowserSupabaseClient } from '../../lib/supabaseClient';
import { Logo } from '../common/Logo';

interface LoginViewProps {
  onNavigateToResetPassword?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onNavigateToResetPassword }) => {
  const { 
    login, 
    authError, 
    authLoading
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
        setLocalError('Invalid email address or password. Please verify your credentials.');
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
      if (res.rateLimited || res.waitSeconds || (res.error && res.error.includes('seconds'))) {
        const wait = res.waitSeconds || parseInt(res.error?.match(/(\d+) seconds/)?.[1] || '25', 10);
        setResetStatusMessage({
          type: 'error',
          text: `Please wait ${wait} seconds before requesting another reset email.`
        });
        return;
      }

      if (res.error) {
        setResetStatusMessage({ type: 'error', text: res.error });
      } else {
        setResetStatusMessage({
          type: 'success',
          text: res.message || `A password reset link has been dispatched to ${resetEmail.trim()}. Please inspect your inbox.`
        });
        setTimeout(() => {
          setIsResetModalOpen(false);
          setResetEmail('');
          setResetStatusMessage(null);
        }, 3500);
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('unreachable')) {
        setResetStatusMessage({ type: 'error', text: 'Could not connect to authentication service. Please verify your network or try again in a few moments.' });
      } else {
        setResetStatusMessage({ type: 'error', text: msg || 'Failed to dispatch reset instructions.' });
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Logo size="lg" onDark />
        </div>

        <div className="bg-[#1e293b] border border-slate-700 rounded-xs p-6 sm:p-7">
          <h1 className="text-lg font-semibold text-white">Sign in</h1>

          {(localError || authError) && (
            <div role="alert" className="mt-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xs text-xs text-red-200">
              <div>{localError || authError}</div>
              {(authError?.toLowerCase().includes('expired') || authError?.toLowerCase().includes('invalid')) && (
                <button
                  type="button"
                  onClick={() => {
                    setIsResetModalOpen(true);
                    setResetEmail(email || '');
                  }}
                  className="mt-2 text-teal-400 hover:text-teal-300 underline cursor-pointer"
                >
                  Request a new password reset link
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-slate-300 mb-1.5">Email</label>
              <input
                id="login-email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-xs text-sm text-white focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-medium text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToResetPassword) {
                      onNavigateToResetPassword();
                    } else {
                      setResetEmail(email);
                      setIsResetModalOpen(true);
                    }
                  }}
                  className="text-xs text-teal-400 hover:text-teal-300 cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3 pr-16 py-2 bg-slate-900 border border-slate-600 rounded-xs text-sm text-white focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 px-3 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded-xs border-slate-600 bg-slate-900 text-teal-600 focus:ring-teal-500 focus:ring-offset-0"
              />
              <span>Keep me signed in on this device</span>
            </label>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-xs text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {authLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>SD Commercial UK Ltd</span>
          {!statusChecking && !authConfigured && <span className="text-amber-400">Local sign-in only</span>}
        </div>
      </div>


      {/* PASSWORD RESET MODAL */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#1e293b] border border-slate-700 rounded-xs shadow-2xl w-full max-w-md overflow-hidden text-slate-200">
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
                Enter your staff email address and we will send you a link to reset your password.
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
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xs text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500"
                />
              </div>

              {resetStatusMessage && (
                <div className={`p-3 rounded-xs flex items-start gap-2 ${
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
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
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

              <div className="pt-2 text-center border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetModalOpen(false);
                    if (onNavigateToResetPassword) onNavigateToResetPassword();
                  }}
                  className="text-[11px] text-teal-400 hover:text-teal-300 font-medium transition-colors cursor-pointer"
                >
                  Or open full verification &amp; OTP reset page &rarr;
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
