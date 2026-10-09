/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  Mail, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  ShieldAlert,
  Clock,
  Sparkles
} from 'lucide-react';
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
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        {/* Main Card */}
        <div className="bg-[#1e293b]/90 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
          
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-slate-700/60 bg-gradient-to-b from-slate-800/50 to-transparent">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shadow-inner">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-white tracking-tight">
                    SD Commercial Portal
                  </h1>
                  <p className="text-[11px] text-teal-400 font-medium">
                    Housing Operations & Security
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReturnToLogin}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            </div>

            <div className="mt-2">
              <h2 className="text-xl font-bold text-white">
                {mode === 'success' 
                  ? 'Password Reset Complete' 
                  : mode === 'request' 
                    ? 'Forgot Password' 
                    : mode === 'link' 
                      ? 'Set New Password' 
                      : 'Verify Code & Set Password'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {mode === 'success'
                  ? 'Your credentials have been securely updated. You can now access the portal.'
                  : mode === 'request'
                    ? 'Enter your registered email address to receive password recovery instructions.'
                    : mode === 'link'
                      ? 'Your recovery session has been verified. Enter your new password below.'
                      : 'Enter the verification code sent to your email and your new password.'}
              </p>
            </div>

            {/* Navigation Tabs (when not in success mode) */}
            {mode !== 'success' && (
              <div className="flex gap-2 mt-5 p-1 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('request');
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
                    mode === 'request'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  1. Request Reset Link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('otp');
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
                    mode === 'otp' || mode === 'link'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  2. Set New Password
                </button>
              </div>
            )}
          </div>

          {/* Body Content */}
          <div className="p-8">
            {/* Rate-Limit Cooldown Notice */}
            {rateLimitNotice && (
              <div className="mb-6 p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-start gap-3 text-xs text-amber-200">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block text-amber-300 mb-0.5">Rate Limit Protection</span>
                  <span>{rateLimitNotice}</span>
                </div>
              </div>
            )}

            {/* Expired Link Alert */}
            {expiredLinkNotice && (
              <div className="mb-6 p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-start gap-3 text-xs text-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block text-amber-300 mb-0.5">Link Notice</span>
                  <span>{expiredLinkNotice}</span>
                </div>
              </div>
            )}

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mb-6 p-3.5 bg-rose-950/40 border border-rose-500/50 rounded-xl flex items-start gap-3 text-xs text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            {/* Success Notice Alert */}
            {successNotice && (
              <div className="mb-6 p-3.5 bg-teal-950/40 border border-teal-500/50 rounded-xl flex items-start gap-3 text-xs text-teal-200">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div className="flex-1">{successNotice}</div>
              </div>
            )}

            {/* MODE: SUCCESS */}
            {mode === 'success' && (
              <div className="text-center py-6 space-y-5">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Password Successfully Updated!</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Your password has been changed. You can now sign in to your SD Operations portal account with your new credentials.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleReturnToLogin}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-semibold rounded-xl text-xs shadow-lg shadow-teal-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Proceed to Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* MODE: REQUEST LINK / FORGOT PASSWORD */}
            {mode === 'request' && (
              <form onSubmit={handleRequestReset} className="space-y-5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">
                    Registered Staff Email Address *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. staff@sdcdms.co.uk"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    We will send a secure password recovery link to your registered email address.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || cooldownSeconds > 0}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-semibold rounded-xl text-xs shadow-lg shadow-teal-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Sending Recovery Email...</span>
                      </>
                    ) : cooldownSeconds > 0 ? (
                      <>
                        <Clock className="w-4 h-4 text-white" />
                        <span>Resend available in {cooldownSeconds}s</span>
                      </>
                    ) : (
                      <>
                        <span>Send Recovery Email</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setMode('otp');
                    }}
                    className="text-[11px] text-teal-400 hover:text-teal-300 font-medium transition-colors cursor-pointer"
                  >
                    Already have a recovery link or code? Set new password &rarr;
                  </button>
                </div>
              </form>
            )}

            {/* MODE: LINK OR OTP (SET NEW PASSWORD) */}
            {(mode === 'otp' || mode === 'link') && (
              <form onSubmit={handleConfirmReset} className="space-y-4 text-xs">
                {/* Email field */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">
                    Staff Email Address *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. staff@sdcdms.co.uk"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                    />
                  </div>
                </div>

                {/* 6-Digit OTP field (only when not direct link) */}
                {!tokenHash && !accessToken && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block font-semibold text-slate-300">
                        Verification Code (Optional if using link)
                      </label>
                      <button
                        type="button"
                        onClick={handleRequestReset}
                        disabled={cooldownSeconds > 0}
                        className="text-[11px] text-teal-400 hover:text-teal-300 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {cooldownSeconds > 0 ? `Resend (${cooldownSeconds}s)` : 'Resend Email'}
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        maxLength={8}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="e.g. 123456"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm font-mono tracking-widest text-teal-300 placeholder-slate-500 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* New Password */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">
                    New Password *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 12 characters"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password strength indicator */}
                  {newPassword && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Strength:</span>
                        <span className="font-semibold text-slate-300">{strength.label}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${strength.color}`}
                          style={{ width: `${strength.score}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Requirements Checklist */}
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5 text-[11px]">
                  <div className="font-semibold text-slate-300 mb-1">Password Requirements:</div>
                  <div className={`flex items-center gap-2 ${isLengthValid ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isLengthValid ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span>At least 12 characters</span>
                  </div>
                  <div className={`flex items-center gap-2 ${isMatchValid ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isMatchValid ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span>Passwords match</span>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || !isFormValid}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-semibold rounded-xl text-xs shadow-lg shadow-teal-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <span>Reset Password</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setMode('request');
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    Need a fresh recovery email? Click here
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Footer Security Badges */}
          <div className="px-8 py-4 bg-slate-900/80 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>TLS 256-bit Encrypted Password Gateway</span>
            </span>
            <span>SD Commercial UK LTD</span>
          </div>

        </div>
      </div>
    </div>
  );
}
export default ResetPasswordView;
