'use client';

import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet, Plus, Minus } from 'lucide-react';
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
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'all', label: 'All Time' },
  ];

  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const isNetPositive = summary.net_balance >= 0;

  return (
    <div className="space-y-3.5">
      {/* Timeframe Selector Chips */}
      <div className="flex items-center justify-between gap-2 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl">
        {periods.map((p) => {
          const isSelected = selectedPeriod === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onPeriodChange(p.id)}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all text-center whitespace-nowrap ${
                isSelected
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Main Net Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-slate-300">
            <Wallet className="w-4 h-4 text-emerald-400" />
            Net Balance
          </span>
          <span className="bg-white/10 text-emerald-300 text-xs px-2.5 py-1 rounded-full font-semibold">
            {currency}
          </span>
        </div>

        <div className="text-3xl font-extrabold tracking-tight my-2">
          {!isNetPositive && '-'}
          {currency} {formatAmount(Math.abs(summary.net_balance))}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
          <span>{summary.total_count} transactions</span>
          <span className={`font-semibold ${isNetPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isNetPositive ? 'Positive Savings' : 'Net Deficit'}
          </span>
        </div>
      </div>

      {/* Dual Income / Expense Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Income Card */}
        <div
          onClick={() => onOpenAddModal?.('income')}
          className="group relative rounded-3xl bg-emerald-50/80 hover:bg-emerald-100/70 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/50 p-4 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Income
            </span>
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 font-mono truncate">
            +{currency} {formatAmount(summary.total_income)}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 text-xs text-emerald-800/80 dark:text-emerald-400/80">
            <span>{summary.income_count} entries</span>
            <span className="font-bold flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300">
              <Plus className="w-3.5 h-3.5" /> Add
            </span>
          </div>
        </div>

        {/* Expense Card */}
        <div
          onClick={() => onOpenAddModal?.('expense')}
          className="group relative rounded-3xl bg-rose-50/80 hover:bg-rose-100/70 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/50 p-4 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
              Expense
            </span>
            <div className="w-7 h-7 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-base font-extrabold text-rose-700 dark:text-rose-300 font-mono truncate">
            -{currency} {formatAmount(summary.total_expense)}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-rose-200/60 dark:border-rose-900/40 text-xs text-rose-800/80 dark:text-rose-400/80">
            <span>{summary.expense_count} entries</span>
            <span className="font-bold flex items-center gap-0.5 text-rose-700 dark:text-rose-300">
              <Minus className="w-3.5 h-3.5" /> Add
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
