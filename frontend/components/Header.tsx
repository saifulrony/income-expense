'use client';

import React from 'react';
import { User } from '@/lib/types';
import { Wallet, RefreshCw } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export default function Header({ user, onRefresh, isRefreshing }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md px-4 pt-[max(env(safe-area-inset-top,0px),12px)] pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Wallet className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              CashFlow
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              {user ? `Hello, ${user.full_name || user.email.split('@')[0]}` : 'Income & Expense'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              {user.currency}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm active:scale-95 transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}

