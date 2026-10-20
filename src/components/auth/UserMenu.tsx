import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogOut, ShieldCheck, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const UserMenu: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => {
  const { user, isAuthenticated, logout, bypassMode } = useAuth();

  if (!isAuthenticated || !user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border border-slate-800/80 bg-slate-900/60 hover:border-emerald-500/40 hover:bg-slate-800 text-slate-200",
            collapsed && "justify-center px-0 w-9 h-9 mx-auto"
          )}
          title={`Signed in as ${user.email}`}
        >
          <div className="relative shrink-0 w-5 h-5 rounded-full overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name || 'User'}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="h-3 w-3 text-emerald-400" />
            )}
          </div>
          {!collapsed && (
            <div className="flex items-center justify-between flex-1 min-w-0 text-left">
              <span className="truncate text-xs font-medium text-slate-200">
                {user.name || user.email.split('@')[0]}
              </span>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded font-mono shrink-0">
                AUTH
              </span>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 bg-slate-900 border-slate-800 text-slate-200 shadow-2xl z-50" align="end" side="top">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold leading-none text-white">{user.name || 'Owner'}</p>
            <p className="text-xs leading-none text-slate-400 truncate">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-800" />
        <div className="px-2 py-1.5 text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{bypassMode ? 'Bypass Mode Active' : 'Google Identity Verified'}</span>
        </div>
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuItem
          onClick={() => logout()}
          className="text-red-400 focus:text-red-300 focus:bg-red-950/40 cursor-pointer flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out of Terminal</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
