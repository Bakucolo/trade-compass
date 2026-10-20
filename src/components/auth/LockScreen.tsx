import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Shield, Lock, AlertTriangle, KeyRound, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const LockScreen: React.FC = () => {
  const { loginWithGoogle, authError, unauthorizedEmail, googleConfigured, clearAuthError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    setIsSubmitting(true);
    clearAuthError();
    try {
      await loginWithGoogle();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#070b12] text-slate-100 p-4 relative overflow-hidden font-sans">
      {/* Background Cybernetic Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Security Card */}
      <div className="relative w-full max-w-md bg-slate-900/80 backdrop-blur-2xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl shadow-black/80 flex flex-col items-center text-center z-10">
        {/* Animated Security Emblem */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Shield className="w-10 h-10 text-emerald-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>

        {/* Header Text */}
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          TradeFlow Terminal
        </h1>
        <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-widest">
          Personal Financial Operating System
        </p>

        {/* Security Notice / Divider */}
        <div className="w-full my-6 flex items-center gap-3">
          <div className="h-px bg-slate-800 flex-1" />
          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            Restricted Environment
          </span>
          <div className="h-px bg-slate-800 flex-1" />
        </div>

        {/* Unauthorized Account Error Alert */}
        {authError && (
          <div className="w-full mb-6 p-4 rounded-xl bg-red-950/60 border border-red-500/30 text-left flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-semibold text-red-200">Access Restricted</div>
              <div className="text-red-300/80 mt-1">{authError}</div>
              {unauthorizedEmail && (
                <div className="mt-2 text-[11px] font-mono bg-red-900/40 p-1.5 rounded border border-red-800/40 text-red-200 break-all">
                  Attempted: {unauthorizedEmail}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Google Authentication Unconfigured Guidance */}
        {!googleConfigured && (
          <div className="w-full mb-6 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-left flex gap-3">
            <KeyRound className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90">
              <div className="font-semibold text-amber-300">Setup Mode Active</div>
              <div className="text-amber-300/80 mt-1">
                Google OAuth credentials have not been configured in <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-200">.env.local</code> yet.
              </div>
            </div>
          </div>
        )}

        {/* Action Button: Sign in with Google */}
        <div className="w-full space-y-3">
          <Button
            onClick={handleSignIn}
            disabled={isSubmitting}
            className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-xl flex items-center justify-center gap-3 transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            {/* Google SVG Icon */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isSubmitting ? 'Connecting to Google...' : 'Sign in with Google'}</span>
          </Button>

          {!googleConfigured && (
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full h-10 border-slate-800 hover:bg-slate-800 text-slate-300 text-xs rounded-xl flex items-center justify-center gap-1.5"
            >
              <span>Refresh Terminal Session</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Security Guarantee Badges */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 w-full grid grid-cols-2 gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Zero-Trust Gateway</span>
          </div>
          <div className="flex items-center gap-1.5 justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Encrypted Session</span>
          </div>
        </div>
      </div>
    </div>
  );
};
