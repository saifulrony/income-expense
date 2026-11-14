'use client';

import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet, Calendar } from 'lucide-react';
import { SummaryData } from '@/lib/types';

interface SummaryCardProps {
  summary: SummaryData;
  currency: string;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  onOpenAddModal?: (type: 'income' | 'expense') => void;
}

export default function SummaryCard({
  summary,
  currency,
  selectedPeriod,
  onPeriodChange,
  onOpenAddModal,
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

      {/* Dual Cash In / Cash Out interactive cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Cash In (Income) */}
        <div
          onClick={() => onOpenAddModal?.('income')}
          className="group relative rounded-2xl bg-emerald-50/70 hover:bg-emerald-50 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-900/40 p-3.5 shadow-sm cursor-pointer transition-all active:scale-[0.98]"
          title="Tap to record Cash In"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <span>Cash In</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200 opacity-80 group-hover:opacity-100">
                + Add
              </span>
            </span>
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 font-mono truncate">
            +{currency} {formatAmount(summary.total_income)}
          </div>
          <div className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60 mt-0.5">
            {summary.income_count} receipts recorded
          </div>
        </div>

        {/* Cash Out (Expense) */}
        <div
          onClick={() => onOpenAddModal?.('expense')}
          className="group relative rounded-2xl bg-rose-50/70 hover:bg-rose-50 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 border border-rose-200/60 dark:border-rose-900/40 p-3.5 shadow-sm cursor-pointer transition-all active:scale-[0.98]"
          title="Tap to record Cash Out"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1">
              <span>Cash Out</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-rose-200/60 dark:bg-rose-800/60 text-rose-800 dark:text-rose-200 opacity-80 group-hover:opacity-100">
                - Add
              </span>
            </span>
            <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-base font-extrabold text-rose-700 dark:text-rose-400 font-mono truncate">
            -{currency} {formatAmount(summary.total_expense)}
          </div>
          <div className="text-[10px] text-rose-600/70 dark:text-rose-400/60 mt-0.5">
            {summary.expense_count} expenditures recorded
          </div>
        </div>
      </div>
    </div>
  );
}
