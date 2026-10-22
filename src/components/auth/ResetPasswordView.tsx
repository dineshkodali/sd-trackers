/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Logo } from '../common/Logo';
import { ShieldCheck, Lock, KeyRound, Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff, ShieldAlert, Clock } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { getBrowserSupabaseClient } from '../../lib/supabaseClient';

interface ResetPasswordViewProps {
  initialMode?: 'request' | 'otp' | 'link';
  onBackToLogin?: () => void;
}

export function ResetPasswordView({ initialMode, onBackToLogin }: ResetPasswordViewProps) {
  // Navigation / view mode: 'request' | 'otp' | 'link' | 'success'
  const [mode, setMode] = useState<'request' | 'otp' | 'link' | 'success'>(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname === '/forgot-password') return 'request';
    }
    return initialMode || 'request';
  });
  
  // Form fields
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [tokenHash, setTokenHash] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & loading states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [expiredLinkNotice, setExpiredLinkNotice] = useState<string | null>(null);
  
  // 25-Second Rate Limit Cooldown State
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);

  // Active Countdown Timer for Rate Limits
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          setRateLimitNotice(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Initialize from URL parameters (query string, hash fragment, and PKCE code)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pathname = window.location.pathname;
    const hash = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : '';
    const search = window.location.search.startsWith('?') ? window.location.search.substring(1) : '';
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(search);

    const urlTokenHash = searchParams.get('token_hash') || hashParams.get('token_hash');
    const urlAccessToken = hashParams.get('access_token') || searchParams.get('access_token');
    const urlEmail = searchParams.get('email') || hashParams.get('email');
    const urlType = hashParams.get('type') || searchParams.get('type');
    const urlCode = searchParams.get('code') || hashParams.get('code');
    const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
    const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');

    if (urlEmail) {
      setEmail(decodeURIComponent(urlEmail));
    }

    if (errorCode === 'otp_expired' || (errorDesc && errorDesc.toLowerCase().includes('expired'))) {
      setExpiredLinkNotice(
        'The password reset link has expired. You can enter your 6-digit email code below, or request a fresh reset link.'
      );
      setMode('otp');
      return;
    }

    // Handle PKCE code exchange
    if (urlCode) {
      const supabase = getBrowserSupabaseClient();
      if (supabase) {
        setLoading(true);
        supabase.auth.exchangeCodeForSession(urlCode).then(({ data, error }) => {
          setLoading(false);
          if (!error && data?.session) {
            setAccessToken(data.session.access_token);
            if (data.session.user?.email) {
              setEmail(data.session.user.email);
            }
            setMode('link');
          } else if (error) {
            setExpiredLinkNotice(error.message || 'Recovery code is invalid or has expired.');
            setMode('otp');
          }
        }).catch(() => setLoading(false));
        return;
      }
    }

    if (urlAccessToken && (urlType === 'recovery' || !urlType)) {
      setAccessToken(urlAccessToken);
      setMode('link');
      return;
    }

    if (urlTokenHash) {
      setTokenHash(urlTokenHash);
      setMode('link');
      return;
    }

    if (pathname === '/forgot-password') {
      setMode('request');
    }
  }, []);

  // Password Requirements Checks (Supabase requires the app requires at least 12 characters)
  const isLengthValid = newPassword.length >= 12;
  const isMatchValid = Boolean(confirmPassword && newPassword === confirmPassword);
  const isFormValid = isLengthValid && isMatchValid;

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { label: 'None', score: 0, color: 'bg-slate-700' };
    let score = 0;
    if (pwd.length >= 12) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

    switch (score) {
      case 1:
        return { label: 'Acceptable', score: 25, color: 'bg-rose-500' };
      case 2:
        return { label: 'Fair', score: 50, color: 'bg-amber-500' };
      case 3:
        return { label: 'Good', score: 75, color: 'bg-sky-500' };
      case 4:
        return { label: 'Strong', score: 100, color: 'bg-emerald-500' };
      default:
        return { label: 'Acceptable', score: 25, color: 'bg-rose-500' };
    }
  };

  const strength = getPasswordStrength(newPassword);

  // 1. Handle Request Password Reset
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);
    setRateLimitNotice(null);

    if (cooldownSeconds > 0) {
      setRateLimitNotice(`Please wait ${cooldownSeconds} seconds before requesting another reset email.`);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your registered staff email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiService.resetPassword(cleanEmail);

      // Handle Supabase's rate-limit protection gracefully
      if (res.rateLimited || res.waitSeconds || (res.error && res.error.toLowerCase().includes('seconds'))) {
        const wait = res.waitSeconds || parseInt(res.error?.match(/(\d+) seconds/)?.[1] || '25', 10);
        setCooldownSeconds(wait);
        setRateLimitNotice(`Please wait ${wait} seconds before requesting another reset email.`);
        setErrorMessage(null);
        return;
      }

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessNotice(
          res.message || `Password recovery link dispatched to ${cleanEmail}. Please check your inbox and click the reset link.`
        );
        // Set standard 25s cooldown after successful dispatch to prevent duplicate clicks
        setCooldownSeconds(25);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch password recovery email.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Confirm Reset Password (via Session, OTP, or Token Hash)
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isLengthValid) {
      setErrorMessage('New password must be at least 12 characters long.');
      return;
    }

    if (!isMatchValid) {
      setErrorMessage('Passwords do not match. Please re-enter carefully.');
      return;
    }

    setLoading(true);
    try {
      // Step A: Attempt password update via browser Supabase client if active recovery session exists
      const supabase = getBrowserSupabaseClient();
      let updatedViaSupabase = false;

      if (supabase) {
        try {
          if (accessToken) {
            try {
              await supabase.auth.setSession({ access_token: accessToken, refresh_token: '' });
            } catch {}
          }
          const { error: sbUpdateErr } = await supabase.auth.updateUser({ password: newPassword });
          if (!sbUpdateErr) {
            updatedViaSupabase = true;
          }
        } catch (_) {}
      }

      if (updatedViaSupabase) {
        setMode('success');
        return;
      }

      // Step B: Update via recovery accessToken if available
      if (accessToken) {
        const res = await apiService.updateUserPassword(newPassword, accessToken);
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          setMode('success');
        }
        return;
      }

      // Step C: Update via OTP code or Token hash
      const cleanEmail = email.trim().toLowerCase();
      const cleanOtp = otpCode.trim();

      if (!tokenHash && !cleanOtp) {
        setErrorMessage('Please provide the 6-digit verification code or click the link from your email.');
        return;
      }

      const res = await apiService.confirmResetPassword({
        email: cleanEmail || undefined,
        otpCode: cleanOtp || undefined,
        tokenHash: tokenHash || undefined,
        newPassword
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setMode('success');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToLogin = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/');
    }
    if (onBackToLogin) {
      onBackToLogin();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <Logo size="lg" onDark />
          <button type="button" onClick={handleReturnToLogin} className="text-xs text-slate-400 hover:text-white cursor-pointer">
            Back to sign in
          </button>
        </div>

        <div className="bg-[#1e293b] border border-slate-700 rounded-md p-6 sm:p-7">
          <h1 className="text-lg font-semibold text-white">
            {mode === 'success' ? 'Password updated' : mode === 'request' ? 'Reset your password' : 'Set a new password'}
          </h1>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            {mode === 'success'
              ? 'You can now sign in with your new password.'
              : mode === 'request'
                ? 'Enter your staff email address and we will send you a link.'
                : mode === 'link'
                  ? 'Enter your new password below.'
                  : 'Enter the code from your email and choose a new password.'}
          </p>

            {rateLimitNotice && (
              <div role="alert" className="mb-4 p-3 bg-amber-950/40 border-amber-500/40 text-amber-200 border rounded-sm text-xs">{rateLimitNotice}</div>
            )}
            {expiredLinkNotice && (
              <div role="alert" className="mb-4 p-3 bg-amber-950/40 border-amber-500/40 text-amber-200 border rounded-sm text-xs">{expiredLinkNotice}</div>
            )}
            {errorMessage && (
              <div role="alert" className="mb-4 p-3 bg-red-950/40 border-red-500/40 text-red-200 border rounded-sm text-xs">{errorMessage}</div>
            )}
            {successNotice && (
              <div role="alert" className="mb-4 p-3 bg-teal-950/40 border-teal-500/40 text-teal-200 border rounded-sm text-xs">{successNotice}</div>
            )}

          {mode === 'success' && (
            <button type="button" onClick={handleReturnToLogin} className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-sm text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              Sign in
            </button>
          )}

          {mode === 'request' && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-xs font-medium text-slate-300 mb-1.5">Email</label>
                <input id="reset-email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-sm text-sm text-white focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500" />
              </div>
              <button type="submit" disabled={loading || cooldownSeconds > 0} className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-sm text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                {loading ? 'Sending...' : cooldownSeconds > 0 ? `Send again in ${cooldownSeconds}s` : 'Send reset link'}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setErrorMessage(null); setMode('otp'); }}
                  className="text-xs text-teal-400 hover:text-teal-300 cursor-pointer"
                >
                  I already have a link or code
                </button>
              </div>
            </form>
          )}

          {(mode === 'otp' || mode === 'link') && (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div>
                <label htmlFor="reset-email2" className="block text-xs font-medium text-slate-300 mb-1.5">Email</label>
                <input id="reset-email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-sm text-sm text-white focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500" />
              </div>

              {!tokenHash && !accessToken && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="reset-code" className="block text-xs font-medium text-slate-300">Code from email</label>
                    <button
                      type="button"
                      onClick={handleRequestReset}
                      disabled={cooldownSeconds > 0}
                      className="text-xs text-teal-400 hover:text-teal-300 disabled:opacity-50 cursor-pointer"
                    >
                      {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend email'}
                    </button>
                  </div>
                  <input
                    id="reset-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-sm text-sm text-white focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono tracking-widest"
                  />
                </div>
              )}

              <div>
                <label htmlFor="reset-new" className="block text-xs font-medium text-slate-300 mb-1.5">New password</label>
                <div className="relative">
                  <input id="reset-new" type={showPassword ? 'text' : 'password'} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-sm text-sm text-white focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 pr-16" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 text-xs text-slate-400 hover:text-slate-200 cursor-pointer">
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Strength</span>
                      <span className="text-slate-300">{strength.label}</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-sm overflow-hidden">
                      <div className={`h-full ${strength.color}`} style={{ width: `${strength.score}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="reset-confirm" className="block text-xs font-medium text-slate-300 mb-1.5">Confirm new password</label>
                <div className="relative">
                  <input id="reset-confirm" type={showConfirmPassword ? 'text' : 'password'} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-sm text-sm text-white focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 pr-16" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 px-3 text-xs text-slate-400 hover:text-slate-200 cursor-pointer">
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <ul className="text-xs space-y-1">
                <li className={isLengthValid ? 'text-emerald-400' : 'text-slate-400'}>{isLengthValid ? 'Done: ' : ''}At least 12 characters</li>
                <li className={isMatchValid ? 'text-emerald-400' : 'text-slate-400'}>{isMatchValid ? 'Done: ' : ''}Passwords match</li>
              </ul>

              <button type="submit" disabled={loading || !isFormValid} className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-sm text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                {loading ? 'Saving...' : 'Set new password'}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setErrorMessage(null); setMode('request'); }}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Send me a new link
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-4 text-xs text-slate-500">SD Commercial UK Ltd</div>
      </div>
    </div>
  );
}
