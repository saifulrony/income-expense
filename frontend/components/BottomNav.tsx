'use client';

import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/currency';

interface BottomNavProps {
  onOpenAddModal: (type: 'income' | 'expense') => void;
  summary?: {
    income: number;
    expense: number;
    balance: number;
  };
  currency?: string;
  // Optional for backward compatibility if passed
  currentTab?: string;
  onSelectTab?: (tab: string) => void;
}

export default function BottomNav({ 
  onOpenAddModal,
  summary,
  currency = 'USD'
}: BottomNavProps) {
  const symbol = getCurrencySymbol(currency);
  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom,0px),12px)]">
      {/* 1. Compact 3-Column Summary Stats Bar */}
      {summary && (
        <div className="max-w-md mx-auto mb-2.5">
          <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800 bg-slate-50 dark:bg-slate-800/80 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 py-2 px-1 text-center">
            {/* Total Cash In (Green) */}
            <div className="px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block leading-tight">
                Total Cash In
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
                +{symbol}{formatAmount(summary.income)}
              </span>
            </div>

            {/* Total Cash Out (Red/Rose) */}
            <div className="px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block leading-tight">
                Total Cash Out
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 block truncate">
                -{symbol}{formatAmount(summary.expense)}
              </span>
            </div>

            {/* Net Balance */}
            <div className="px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block leading-tight">
                Balance
              </span>
              <span
                className={`text-xs sm:text-sm font-bold font-mono mt-0.5 block truncate ${
                  summary.balance >= 0
                    ? 'text-slate-900 dark:text-white'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {summary.balance < 0 ? '-' : '+'}{symbol}{formatAmount(Math.abs(summary.balance))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Dual Action Buttons Dock (Cash In & Cash Out) */}
      <div className="max-w-md mx-auto">
        <div className="grid grid-cols-2 gap-3">
          {/* Cash In Button (Green) */}
          <button
            type="button"
            onClick={() => onOpenAddModal('income')}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-md shadow-emerald-600/30 transition-all focus:outline-none"
            aria-label="Add Cash In"
          >
            <ArrowDownLeft className="w-4 h-4 stroke-[3]" />
            <span>Cash In</span>
          </button>

          {/* Cash Out Button (Rose/Red) */}
          <button
            type="button"
            onClick={() => onOpenAddModal('expense')}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-sm shadow-md shadow-rose-600/30 transition-all focus:outline-none"
            aria-label="Add Cash Out"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[3]" />
            <span>Cash Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
