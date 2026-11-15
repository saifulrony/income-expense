'use client';

import React from 'react';
import { SummaryData } from '@/lib/types';

interface SummaryCardProps {
  summary?: SummaryData;
  currency?: string;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  onOpenAddModal?: (type: 'income' | 'expense') => void;
}

const SummaryCard = React.memo(function SummaryCard({
  selectedPeriod,
  onPeriodChange,
  summary,
  currency = '$',
}: SummaryCardProps) {
  const periods = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
  ];

  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const totalIncome = summary?.total_income || 0;
  const totalExpense = summary?.total_expense || 0;
  const netBalance = summary?.net_balance || 0;
  const totalCount = summary?.total_count || 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[10px] p-2.5 shadow-xs space-y-2.5">
      {/* 1. Inset Segmented Time Selection Bar */}
      <div className="flex items-center justify-between gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg">
        {periods.map((p) => {
          const isSelected = selectedPeriod === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onPeriodChange(p.id)}
              className={`flex-1 py-1.5 px-2 rounded-md text-xs transition-all text-center whitespace-nowrap ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* 2. Integrated 3-Column Summary Cockpit (Seamless Inside Single Card) */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800/80 pt-1 text-center">
        {/* Total Cash In */}
        <div className="px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block leading-tight">
            Total Cash In
          </span>
          <span className="text-xs sm:text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
            +{currency}{formatAmount(totalIncome)}
          </span>
        </div>

        {/* Total Cash Out */}
        <div className="px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block leading-tight">
            Total Cash Out
          </span>
          <span className="text-xs sm:text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 block truncate">
            -{currency}{formatAmount(totalExpense)}
          </span>
        </div>

        {/* Balance */}
        <div className="px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block leading-tight">
            Balance
          </span>
          <span
            className={`text-xs sm:text-sm font-bold font-mono mt-0.5 block truncate ${
              netBalance >= 0
                ? 'text-slate-900 dark:text-white'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {netBalance >= 0 ? '+' : '-'}{currency}{formatAmount(Math.abs(netBalance))}
          </span>
        </div>
      </div>
    </div>
  );
});

export default SummaryCard;
