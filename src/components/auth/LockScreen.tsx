import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Shield, Lock, AlertTriangle, KeyRound, CheckCircle2, Delete, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const LockScreen: React.FC = () => {
  const {
    loginWithPin,
    loginWithGoogle,
    authError,
    unauthorizedEmail,
    pinConfigured,
    googleConfigured,
    clearAuthError,
  } = useAuth();

  const [pin, setPin] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [lockedOutSeconds, setLockedOutSeconds] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the hidden input on load and click
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockedOutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockedOutSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedOutSeconds]);

  // Handle PIN submission
  const handlePinSubmit = async (pinToSubmit: string) => {
    if (pinToSubmit.length !== 6 || isSubmitting || lockedOutSeconds > 0) return;

    setIsSubmitting(true);
    setLocalError(null);
    clearAuthError();

    const result = await loginWithPin(pinToSubmit);

    setIsSubmitting(false);
    if (!result.success) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
      setLocalError(result.error || 'Incorrect PIN');

      if (result.lockedOut && result.remainingAttempts === 0) {
        setLockedOutSeconds(15 * 60);
      }

      // Refocus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Handle number click on virtual keypad
  const handleDigitClick = (digit: string) => {
    if (isSubmitting || lockedOutSeconds > 0) return;
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 6) {
        handlePinSubmit(nextPin);
      }
    }
  };

  // Handle backspace
  const handleBackspace = () => {
    if (isSubmitting || lockedOutSeconds > 0) return;
    setPin((prev) => prev.slice(0, -1));
    setLocalError(null);
  };

  // Handle physical keyboard input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isSubmitting || lockedOutSeconds > 0) return;

    if (e.key >= '0' && e.key <= '9') {
      if (pin.length < 6) {
        const nextPin = pin + e.key;
        setPin(nextPin);
        if (nextPin.length === 6) {
          handlePinSubmit(nextPin);
        }
      }
    } else if (e.key === 'Backspace') {
      handleBackspace();
    } else if (e.key === 'Enter' && pin.length === 6) {
      handlePinSubmit(pin);
    }
  };

  // Handle paste (e.g. if user copies 6 digits)
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      e.preventDefault();
      setPin(pasted);
      handlePinSubmit(pasted);
    }
  };

  const errorMessage = localError || authError;

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="min-h-screen w-full flex items-center justify-center bg-[#070b12] text-slate-100 p-4 relative overflow-hidden font-sans select-none cursor-default"
    >
      {/* Hidden input to capture physical keyboard and mobile paste */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={pin}
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="opacity-0 absolute w-0 h-0 pointer-events-none"
        autoFocus
      />

      {/* Cybernetic Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Security Card */}
      <div
        className={`relative w-full max-w-sm bg-slate-900/90 backdrop-blur-2xl border border-slate-800/80 rounded-3xl p-7 shadow-2xl shadow-black/90 flex flex-col items-center text-center z-10 transition-transform ${
          shake ? 'animate-shake' : ''
        }`}
      >
        {/* Animated Security Emblem */}
        <div className="relative mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center">
            <Lock className="w-3 h-3 text-emerald-400" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          Trade Compass
        </h1>
        <p className="text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-widest">
          Personal Financial OS • Restricted Access
        </p>

        {/* PIN Prompt */}
        <div className="mt-5 mb-3">
          <p className="text-xs font-semibold text-slate-300">
            Enter 6-Digit Master Security PIN
          </p>
        </div>

        {/* 6 PIN Indicator Slots */}
        <div className="flex items-center gap-3 my-2">
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 flex items-center justify-center ${
                  isFilled
                    ? 'bg-emerald-400 shadow-md shadow-emerald-400/50 scale-110'
                    : 'border-2 border-slate-700 bg-slate-950/60'
                }`}
              />
            );
          })}
        </div>

        {/* Error Alert Display */}
        {errorMessage && (
          <div className="w-full mt-4 p-2.5 rounded-xl bg-red-950/70 border border-red-500/40 text-left flex items-start gap-2 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-red-200">
              <span className="font-semibold block">{errorMessage}</span>
              {lockedOutSeconds > 0 && (
                <span className="text-red-300/80 block mt-0.5">
                  Locked out for {Math.floor(lockedOutSeconds / 60)}m {lockedOutSeconds % 60}s
                </span>
              )}
            </div>
          </div>
        )}

        {/* Loading Spinner during Verification */}
        {isSubmitting && (
          <p className="text-xs text-emerald-400 font-medium animate-pulse mt-3">
            Verifying cryptographic token...
          </p>
        )}

        {/* Numeric Touch Keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] mt-5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={isSubmitting || lockedOutSeconds > 0}
              onClick={() => handleDigitClick(digit)}
              className="h-14 rounded-2xl bg-slate-800/60 hover:bg-slate-750 active:bg-emerald-500/20 active:scale-95 border border-slate-750 hover:border-slate-600 text-lg font-semibold text-white transition-all flex items-center justify-center shadow-sm disabled:opacity-40 disabled:pointer-events-none"
            >
              {digit}
            </button>
          ))}

          {/* Clear button */}
          <button
            type="button"
            disabled={isSubmitting || lockedOutSeconds > 0 || pin.length === 0}
            onClick={() => setPin('')}
            className="h-14 rounded-2xl bg-slate-800/30 hover:bg-slate-800/60 active:scale-95 text-xs uppercase tracking-wider font-semibold text-slate-400 transition-all flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
          >
            Clear
          </button>

          {/* 0 button */}
          <button
            type="button"
            disabled={isSubmitting || lockedOutSeconds > 0}
            onClick={() => handleDigitClick('0')}
            className="h-14 rounded-2xl bg-slate-800/60 hover:bg-slate-750 active:bg-emerald-500/20 active:scale-95 border border-slate-750 hover:border-slate-600 text-lg font-semibold text-white transition-all flex items-center justify-center shadow-sm disabled:opacity-40 disabled:pointer-events-none"
          >
            0
          </button>

          {/* Backspace button */}
          <button
            type="button"
            disabled={isSubmitting || lockedOutSeconds > 0 || pin.length === 0}
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-slate-800/30 hover:bg-slate-800/60 active:scale-95 text-slate-300 transition-all flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
            title="Backspace"
          >
            <Delete className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Optional Google Login Fallback */}
        {googleConfigured && (
          <div className="w-full mt-5 pt-4 border-t border-slate-800/80">
            <Button
              variant="outline"
              onClick={loginWithGoogle}
              className="w-full h-10 border-slate-800 hover:bg-slate-800 text-slate-300 text-xs rounded-xl flex items-center justify-center gap-2"
            >
              <span>Or sign in with Google</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Security Badges */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 w-full grid grid-cols-2 gap-2 text-[10px] text-slate-400">
          <div className="flex items-center gap-1 justify-center">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Zero-Trust Gate</span>
          </div>
          <div className="flex items-center gap-1 justify-center">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>30-Day Encrypted Key</span>
          </div>
        </div>
      </div>
    </div>
  );
};
