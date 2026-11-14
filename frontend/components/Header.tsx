'use client';

import React from 'react';
import { User, SubAccount } from '@/lib/types';
import { Wallet, RefreshCw, ChevronDown, Menu } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  accounts: SubAccount[];
  activeAccountId: string;
  onOpenAccountSwitcher: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onToggleSidebar: () => void;
}

export default function Header({
  user,
  accounts,
  activeAccountId,
  onOpenAccountSwitcher,
  onRefresh,
  isRefreshing,
  onToggleSidebar,
}: HeaderProps) {
  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const accountDisplayName =
    activeAccountId === 'all' ? 'All Accounts' : activeAccount?.name || 'Personal';
  const isOffline = typeof window !== 'undefined' && localStorage.getItem('app_mode') === 'offline';

  return (
    <header className="sticky top-0 z-30 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md px-4 pt-[max(env(safe-area-inset-top,0px),14px)] pb-3 border-b border-slate-200/70 dark:border-slate-800/70">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {/* Hamburger Burger Menu Button */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="w-8 h-8 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 active:scale-95 shadow-xs"
            aria-label="Open navigation menu"
            title="Menu"
          >
            <Menu className="w-4.5 h-4.5 stroke-[2.2]" />
          </button>

          <div className="w-8 h-8 rounded-md bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs shadow-emerald-500/20 shrink-0">
            <Wallet className="w-4.5 h-4.5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                CashFlow
              </h1>
              {isOffline ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 leading-none">
                  Offline
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 leading-none">
                  Cloud
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
              {user ? (user.full_name || user.email.split('@')[0]) : 'Personal Finance'}
            </p>
          </div>
        </div>

        {/* Right Action Section */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Active Account Switcher Pill */}
          {user && accounts.length > 0 && (
            <button
              onClick={onOpenAccountSwitcher}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold shadow-xs active:scale-95 transition-all text-slate-800 dark:text-slate-100 hover:border-emerald-500"
              title="Switch account"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    activeAccountId === 'all' ? '#6366F1' : activeAccount?.color || '#10B981',
                }}
              />
              <span className="max-w-[80px] sm:max-w-[100px] truncate text-xs">
                {accountDisplayName}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-8 h-8 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-xs active:scale-95 transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}

