'use client';

import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet, Calendar } from 'lucide-react';
import { SummaryData } from '@/lib/types';

interface SummaryCardProps {
  summary: SummaryData;
  currency: string;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
}

export default function SummaryCard({
  summary,
  currency,
  selectedPeriod,
  onPeriodChange,
}: SummaryCardProps) {
  const periods = [
    { id: 'today', label: 'Today' },
    { id: 'this_week', label: 'Week' },
    { id: 'this_month', label: 'Month' },
    { id: 'all', label: 'All Time' },
  ];

  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-3">
      {/* Timeframe selector chips */}
      <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {periods.map((p) => (
          <button
            key={p.id}
            onClick={() => onPeriodChange(p.id)}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-medium transition-all text-center whitespace-nowrap ${
              selectedPeriod === p.id
                ? 'bg-slate-900 text-white dark:bg-emerald-600 shadow-sm'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Main Net Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-5 text-white shadow-xl">
        <div className="flex items-center justify-between text-slate-300 text-xs mb-1">
          <span className="flex items-center gap-1.5 font-medium tracking-wide uppercase text-[11px]">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            Net Balance (Cash In - Out)
          </span>
          <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
            {currency}
          </span>
        </div>

        <div className="text-3xl font-extrabold tracking-tight mt-1">
          {summary.net_balance >= 0 ? '' : '-'}
          {currency} {formatAmount(Math.abs(summary.net_balance))}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
          <span>{summary.total_count} recorded transactions</span>
          <span className="text-[11px] text-emerald-400">
            {summary.net_balance >= 0 ? 'Surplus' : 'Deficit'}
          </span>
        </div>
      </div>

      {/* Dual Cash In / Cash Out cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Cash In (Income) */}
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Cash In
            </span>
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
            +{currency} {formatAmount(summary.total_income)}
          </div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/70 mt-1">
            {summary.income_count} receipts
          </div>
        </div>

        {/* Cash Out (Expense) */}
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
              Cash Out
            </span>
            <div className="w-7 h-7 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-lg font-bold text-rose-700 dark:text-rose-400">
            -{currency} {formatAmount(summary.total_expense)}
          </div>
          <div className="text-[11px] text-rose-600/80 dark:text-rose-400/70 mt-1">
            {summary.expense_count} expenditures
          </div>
        </div>
      </div>
    </div>
  );
}
