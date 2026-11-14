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

export default function SummaryCard({
  selectedPeriod,
  onPeriodChange,
}: SummaryCardProps) {
  const periods = [
    { id: 'today', label: 'Today' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'all', label: 'All Time' },
  ];

  return (
    <div className="flex items-center justify-between gap-1.5 p-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[10px] shadow-xs">
      {periods.map((p) => {
        const isSelected = selectedPeriod === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onPeriodChange(p.id)}
            className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all text-center whitespace-nowrap ${
              isSelected
                ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
