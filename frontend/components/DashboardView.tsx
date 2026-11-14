'use client';

import React from 'react';
import { SummaryData, Transaction, Category, User } from '@/lib/types';
import SummaryCard from './SummaryCard';
import TransactionItem from './TransactionItem';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Sparkles, Inbox } from 'lucide-react';

interface DashboardViewProps {
  summary: SummaryData;
  recentTransactions: Transaction[];
  categories: Category[];
  user: User;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  onOpenAddModal: (type?: 'income' | 'expense') => void;
  onNavigateToHistory: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export default function DashboardView({
  summary,
  recentTransactions,
  categories,
  user,
  selectedPeriod,
  onPeriodChange,
  onOpenAddModal,
  onNavigateToHistory,
  onEditTransaction,
  onDeleteTransaction,
}: DashboardViewProps) {
  return (
    <div className="space-y-6 pb-24">
      {/* Dynamic Net Balance, Cash In, Cash Out Cockpit */}
      <SummaryCard
        summary={summary}
        currency={user.currency}
        selectedPeriod={selectedPeriod}
        onPeriodChange={onPeriodChange}
      />

      {/* Quick Action Touch Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onOpenAddModal('income')}
          className="flex items-center justify-center gap-2 p-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-2xl text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition-all"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <span>+ Add Cash In</span>
        </button>

        <button
          onClick={() => onOpenAddModal('expense')}
          className="flex items-center justify-center gap-2 p-3.5 bg-rose-600 hover:bg-rose-700 active:scale-98 rounded-2xl text-white font-bold text-xs shadow-md shadow-rose-600/25 transition-all"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <span>- Add Cash Out</span>
        </button>
      </div>

      {/* Recent Transactions Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Recent Activities
          </h3>
          {recentTransactions.length > 0 && (
            <button
              onClick={onNavigateToHistory}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              No transactions recorded yet
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tap + Add Cash In or + Add Cash Out to start tracking.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((tx) => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                currency={user.currency}
                onEdit={onEditTransaction}
                onDelete={onDeleteTransaction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
