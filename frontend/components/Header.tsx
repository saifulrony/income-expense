'use client';

import React from 'react';
import { User, SubAccount } from '@/lib/types';
import { Wallet, RefreshCw, ChevronDown } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  accounts: SubAccount[];
  activeAccountId: string;
  onOpenAccountSwitcher: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export default function Header({
  user,
  accounts,
  activeAccountId,
  onOpenAccountSwitcher,
  onRefresh,
  isRefreshing,
}: HeaderProps) {
  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const accountDisplayName =
    activeAccountId === 'all' ? 'All Accounts' : activeAccount?.name || 'Personal';
  const isOffline = typeof window !== 'undefined' && localStorage.getItem('app_mode') === 'offline';

  return (
    <header className="sticky top-0 z-30 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md px-4 pt-[max(env(safe-area-inset-top,0px),14px)] pb-3 border-b border-slate-200/70 dark:border-slate-800/70">
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
            <Wallet className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                CashFlow
              </h1>
              {isOffline ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 leading-none">
                  Offline
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 leading-none">
                  Cloud
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight truncate">
              {user ? (user.full_name || user.email.split('@')[0]) : 'Personal Finance'}
            </p>
          </div>
        </div>

        {/* Right Action Section */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active Account Switcher Pill */}
          {user && accounts.length > 0 && (
            <button
              onClick={onOpenAccountSwitcher}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-semibold shadow-xs active:scale-95 transition-all text-slate-800 dark:text-slate-100 hover:border-emerald-500"
              title="Switch account"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    activeAccountId === 'all' ? '#6366F1' : activeAccount?.color || '#10B981',
                }}
              />
              <span className="max-w-[100px] truncate text-xs">
                {accountDisplayName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-xs active:scale-95 transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}

