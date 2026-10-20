import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { LockScreen } from './LockScreen';
import { Shield } from 'lucide-react';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#070b12] text-slate-200">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-pulse shadow-lg shadow-emerald-500/20">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold tracking-wider text-slate-400 uppercase">
          Verifying Security Credentials...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LockScreen />;
  }

  return <>{children}</>;
};
