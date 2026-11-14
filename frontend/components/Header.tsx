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

  return (
    <header className="sticky top-0 z-30 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md px-4 pt-[max(env(safe-area-inset-top,0px),12px)] pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
            <Wallet className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              CashFlow
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              {user ? (user.full_name || user.email.split('@')[0]) : 'Income & Expense'}
            </p>
          </div>
        </div>

        {/* Active Account Switcher Pill */}
        {user && accounts.length > 0 && (
          <button
            onClick={onOpenAccountSwitcher}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-full text-xs font-bold shadow-sm active:scale-95 transition-all text-slate-800 dark:text-slate-100 hover:border-emerald-500"
            title="Switch between Personal, Family, Business accounts"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor:
                  activeAccountId === 'all' ? '#6366F1' : activeAccount?.color || '#10B981',
              }}
            />
            <span className="max-w-[95px] truncate text-[11px] font-bold">
              {accountDisplayName}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        )}

        <div className="flex items-center gap-1.5">
          {user && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              {user.currency}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm active:scale-95 transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}

