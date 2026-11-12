/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Logo } from '../common/Logo';
import { apiService } from '../../services/apiService';
import { getBrowserSupabaseClient } from '../../lib/supabaseClient';
import {
  resolveRecovery, classifyAuthError, recoveryMessage, parseRecoveryParams, hasRecoveryParams,
  type RecoveryResult
} from '../../auth/recoveryFlow';
import { checkNewPassword, MIN_PASSWORD_LENGTH } from '../../auth/passwordPolicy';

interface ResetPasswordViewProps {
  initialMode?: 'request' | 'otp' | 'link';
  onBackToLogin?: () => void;
}

/**
 * The only password reset / account setup page.
 *
 * It never exchanges a recovery token itself: `resolveRecovery` (src/auth/recoveryFlow.ts) does that once per page load
 * and this page, and the app context, read the same result. Using a token twice is what used to make links
 * "expire" on the first real click.
 */
export function ResetPasswordView({ initialMode, onBackToLogin }: ResetPasswordViewProps) {
  const [mode, setMode] = useState<'checking' | 'request' | 'otp' | 'link' | 'success'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/forgot-password') return 'request';
      if (hasRecoveryParams(parseRecoveryParams(window.location.search, window.location.hash))) return 'checking';
    }
    return initialMode || 'request';
  });

  const [recovery, setRecovery] = useState<RecoveryResult | null>(null);
  const [isSetup, setIsSetup] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) { setRateLimitNotice(null); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Read the outcome of the one-time link exchange (shared with the app context).
  useEffect(() => {
    let alive = true;
    resolveRecovery(getBrowserSupabaseClient() as any).then(result => {
      if (!alive) return;
      setRecovery(result);
      if (result.status === 'ready') {
        if (result.email) setEmail(result.email);
        setIsSetup(result.setup);
        setMode('link');
      } else if (result.status === 'error') {
        if (result.email) setEmail(result.email);
        setErrorMessage(result.message);
        setMode('request');
      } else {
        setMode(m => (m === 'checking' ? 'request' : m));
      }
    });
    return () => { alive = false; };
  }, []);

  const passwordCheck = checkNewPassword(newPassword, confirmPassword);
  const isLengthValid = passwordCheck.lengthOk;
  const isMatchValid = passwordCheck.matches;

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { label: 'None', score: 0, color: 'bg-slate-700' };
    let score = 0;
    if (pwd.length >= MIN_PASSWORD_LENGTH) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;
    switch (score) {
      case 2: return { label: 'Fair', score: 50, color: 'bg-amber-500' };
      case 3: return { label: 'Good', score: 75, color: 'bg-sky-500' };
      case 4: return { label: 'Strong', score: 100, color: 'bg-emerald-500' };
      default: return { label: 'Acceptable', score: 25, color: 'bg-rose-500' };
    }
  };
  const strength = getPasswordStrength(newPassword);

  // 1. Request a reset email
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
      if (res.rateLimited || res.waitSeconds || (res.error && res.error.toLowerCase().includes('seconds'))) {
        const wait = res.waitSeconds || parseInt(res.error?.match(/(\d+) seconds/)?.[1] || '25', 10);
        setCooldownSeconds(wait);
        setRateLimitNotice(`Please wait ${wait} seconds before requesting another reset email.`);
        return;
      }
      if (res.error) {
        setErrorMessage(recoveryMessage(classifyAuthError(res.error)) === recoveryMessage('other') ? res.error : recoveryMessage(classifyAuthError(res.error)));
      } else {
        // Same wording whether or not the address has an account.
        setSuccessNotice(`If ${cleanEmail} has an account, a reset email is on its way. The link works once; check your spam folder if it does not arrive within a few minutes.`);
        setCooldownSeconds(25);
      }
    } catch (err: any) {
      setErrorMessage(recoveryMessage(classifyAuthError(err?.message)));
    } finally {
      setLoading(false);
    }
  };

  // 2. Set the new password
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!passwordCheck.ok) {
      setErrorMessage(passwordCheck.error);
      return;
    }

    setLoading(true);
    try {
      // A. Link from the email: the exchange already produced a session (or, failing that, an access token for the server).
      if (mode === 'link' && recovery?.status === 'ready') {
        if (recovery.hasSession) {
          const supabase = getBrowserSupabaseClient();
          if (!supabase) { setErrorMessage(recoveryMessage('other')); return; }
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) {
            setErrorMessage(recoveryMessage(classifyAuthError(error.message, (error as any).code)));
            return;
          }
          // End the recovery session and every other session of this account.
          try { await supabase.auth.signOut({ scope: 'global' }); } catch { /* the password is already changed */ }
          setMode('success');
          return;
        }
        if (recovery.accessToken) {
          const res = await apiService.updateUserPassword(newPassword, recovery.accessToken);
          if (res.error) {
            setErrorMessage(recoveryMessage(classifyAuthError(res.error)) === recoveryMessage('other') ? res.error : recoveryMessage(classifyAuthError(res.error)));
            return;
          }
          setMode('success');
          return;
        }
      }

      // B. Email + 6-digit code (never a token from the address bar)
      const cleanEmail = email.trim().toLowerCase();
      const cleanOtp = otpCode.trim();
      if (!cleanEmail || !cleanOtp) {
        setErrorMessage('Enter your email address and the 6-digit code from the email, or open the link in the email.');
        return;
      }
      const res = await apiService.confirmResetPassword({ email: cleanEmail, otpCode: cleanOtp, newPassword });
      if (res.error) {
        setErrorMessage(recoveryMessage(classifyAuthError(res.error)) === recoveryMessage('other') ? res.error : recoveryMessage(classifyAuthError(res.error)));
        return;
      }
      setMode('success');
    } catch (err: any) {
      setErrorMessage(recoveryMessage(classifyAuthError(err?.message)));
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

  const heading = mode === 'success'
    ? (isSetup ? 'Password set' : 'Password updated')
    : mode === 'request' ? 'Reset your password'
      : mode === 'checking' ? 'Checking your link'
        : isSetup ? 'Set your password' : 'Set a new password';

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <Logo size="lg" onDark />
          <button type="button" onClick={handleReturnToLogin} className="text-xs text-slate-400 hover:text-white cursor-pointer">
            Back to sign in
          </button>
        </div>

        <div className="bg-[#1e293b] border border-slate-700 rounded-xs p-6 sm:p-7">
          <h1 className="text-lg font-semibold text-white">{heading}</h1>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            {mode === 'success'
              ? 'You can now sign in with your new password.'
              : mode === 'checking'
                ? 'One moment.'
                : mode === 'request'
                  ? 'Enter your staff email address and we will send you a link.'
                  : mode === 'link'
                    ? (isSetup ? 'Choose a password for your account.' : 'Enter your new password below.')
                    : 'Enter the code from your email and choose a new password.'}
          </p>

          {rateLimitNotice && (
            <div role="alert" className="mb-4 p-3 bg-amber-950/40 border-amber-500/40 text-amber-200 border rounded-xs text-xs">{rateLimitNotice}</div>
          )}
          {errorMessage && (
            <div role="alert" className="mb-4 p-3 bg-red-950/40 border-red-500/40 text-red-200 border rounded-xs text-xs">{errorMessage}</div>
          )}
          {successNotice && (
            <div role="status" className="mb-4 p-3 bg-teal-950/40 border-teal-500/40 text-teal-200 border rounded-xs text-xs">{successNotice}</div>
          )}

          {mode === 'checking' && <p className="text-xs text-slate-400" aria-busy="true">Checking your link…</p>}

          {mode === 'success' && (
            <button type="button" onClick={handleReturnToLogin} className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-xs text-sm cursor-pointer">
              Sign in
            </button>
          )}

          {mode === 'request' && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-xs font-medium text-slate-300 mb-1.5">Email</label>
                <input id="reset-email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-xs text-sm text-white focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500" />
              </div>
              <button type="submit" disabled={loading || cooldownSeconds > 0} className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-xs text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                {loading ? 'Sending...' : cooldownSeconds > 0 ? `Send again in ${cooldownSeconds}s` : 'Send reset link'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => { setErrorMessage(null); setMode('otp'); }} className="text-xs text-teal-400 hover:text-teal-300 cursor-pointer">
                  I have a 6-digit code
                </button>
              </div>
            </form>
          )}

          {(mode === 'otp' || mode === 'link') && (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div>
                <label htmlFor="reset-email2" className="block text-xs font-medium text-slate-300 mb-1.5">Email</label>
                <input id="reset-email2" type="email" required value={email} readOnly={mode === 'link' && !!email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-xs text-sm text-white focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500" />
              </div>

              {mode === 'otp' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="reset-code" className="block text-xs font-medium text-slate-300">Code from email</label>
                    <button type="button" onClick={handleRequestReset} disabled={cooldownSeconds > 0} className="text-xs text-teal-400 hover:text-teal-300 disabled:opacity-50 cursor-pointer">
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
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-xs text-sm text-white focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono tracking-widest"
                  />
                </div>
              )}

              <div>
                <label htmlFor="reset-new" className="block text-xs font-medium text-slate-300 mb-1.5">{isSetup ? 'Password' : 'New password'}</label>
                <div className="relative">
                  <input id="reset-new" type={showPassword ? 'text' : 'password'} required autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-xs text-sm text-white focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 pr-16" />
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
                    <div className="w-full h-1 bg-slate-800 rounded-xs overflow-hidden">
                      <div className={`h-full ${strength.color}`} style={{ width: `${strength.score}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="reset-confirm" className="block text-xs font-medium text-slate-300 mb-1.5">Confirm password</label>
                <div className="relative">
                  <input id="reset-confirm" type={showConfirmPassword ? 'text' : 'password'} required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-xs text-sm text-white focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 pr-16" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 px-3 text-xs text-slate-400 hover:text-slate-200 cursor-pointer">
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <ul className="text-xs space-y-1">
                <li className={isLengthValid ? 'text-emerald-400' : 'text-slate-400'}>{isLengthValid ? 'Done: ' : ''}At least {MIN_PASSWORD_LENGTH} characters</li>
                <li className={isMatchValid ? 'text-emerald-400' : 'text-slate-400'}>{isMatchValid ? 'Done: ' : ''}Passwords match</li>
              </ul>

              <button type="submit" disabled={loading || !passwordCheck.ok} className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-xs text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                {loading ? 'Saving...' : isSetup ? 'Set password' : 'Set new password'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => { setErrorMessage(null); setMode('request'); }} className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer">
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
