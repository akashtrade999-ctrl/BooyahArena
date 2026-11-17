import React, { useState } from 'react';
import { ConfirmationResult } from 'firebase/auth';
import { Phone, ShieldAlert, X, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithGoogle, sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const [method, setMethod] = useState<'google' | 'phone'>('google');
  const [phoneInput, setPhoneInput] = useState('+91');
  const [otpInput, setOtpInput] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [phoneSetupGuide, setPhoneSetupGuide] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setPhoneSetupGuide(false);
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setPhoneSetupGuide(false);
    const formatted = phoneInput.trim();
    if (!/^\+[1-9]\d{7,14}$/.test(formatted)) {
      setErrorMsg('Enter a valid phone number with country code (e.g. +919876543210).');
      return;
    }

    setLoading(true);
    try {
      const result = await sendPhoneOtp(formatted, 'recaptcha-container');
      setConfirmation(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('operation-not-allowed') ||
        msg.includes('configuration-not-found') ||
        msg.includes('captcha-check-failed')
      ) {
        setPhoneSetupGuide(true);
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      await verifyPhoneOtp(confirmation, otpInput.trim());
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full sm:max-w-md bg-[#131822] border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 id="auth-modal-title" className="text-xl font-bold text-white tracking-tight">
              Player Sign In
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Authenticate to join matches and unlock Room IDs
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close sign in dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-[#0B0E14] border border-white/[0.06] rounded-xl mb-5">
          <button
            type="button"
            onClick={() => {
              setMethod('google');
              setErrorMsg(null);
              setPhoneSetupGuide(false);
            }}
            className={`min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              method === 'google'
                ? 'bg-[#1D2534] text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Google Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod('phone');
              setErrorMsg(null);
            }}
            className={`min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              method === 'phone'
                ? 'bg-[#1D2534] text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mobile OTP
          </button>
        </div>

        {method === 'google' ? (
          <div className="space-y-4">
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleLogin}
              className="w-full min-h-[48px] px-4 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-3 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
            </button>

            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-white/[0.06] text-xs text-slate-400 leading-relaxed">
              <div className="flex items-center gap-2 text-slate-200 font-medium mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Admin Access</span>
              </div>
              Sign in with <span className="font-mono text-slate-200">{BOOTSTRAPPED_ADMIN_EMAIL}</span> to unlock the Admin Operations Console for creating tournaments and settling match prizes.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!confirmation ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label htmlFor="phone-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Mobile Number (with country code)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="phone-input"
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="+919876543210"
                      className="w-full min-h-[44px] pl-10 pr-4 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] px-4 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <span>{loading ? 'Sending OTP...' : 'Send OTP Code'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label htmlFor="otp-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Enter 6-Digit OTP sent to {phoneInput}
                  </label>
                  <input
                    id="otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full min-h-[44px] px-4 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-base font-mono tracking-widest text-center text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmation(null);
                      setOtpInput('');
                    }}
                    className="min-h-[44px] px-4 py-2.5 bg-[#0B0E14] border border-white/10 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition-colors"
                  >
                    Change Number
                  </button>
                  <button
                    type="submit"
                    disabled={loading || otpInput.length < 6}
                    className="flex-1 min-h-[44px] px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-colors"
                  >
                    {loading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>
                </div>
              </form>
            )}
            <div id="recaptcha-container" />
          </div>
        )}

        {phoneSetupGuide && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Enable Phone Auth in Firebase Console</span>
            </div>
            <p className="text-amber-100/80 leading-relaxed">
              Phone OTP requires enabling the Phone provider in your Firebase project:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-amber-100/80">
              <li>Open Firebase Console → Authentication → Sign-in method</li>
              <li>Click Add new provider → Select Phone → Enable &amp; Save</li>
              <li>Add this app domain under Authorized Domains</li>
            </ol>
            <button
              type="button"
              onClick={() => {
                setMethod('google');
                setPhoneSetupGuide(false);
              }}
              className="mt-1 inline-flex items-center text-xs font-semibold text-orange-400 hover:text-orange-300"
            >
              Use Google Sign-In instead →
            </button>
          </div>
        )}

        {errorMsg && (
          <p className="mt-4 p-3 rounded-xl bg-red-950/50 border border-red-500/30 text-xs text-red-200">
            {errorMsg}
          </p>
        )}
      </div>
    </div>
  );
}
