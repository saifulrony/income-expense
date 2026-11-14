'use client';

import React from 'react';
import { SummaryData, Transaction, Category, User, BudgetOverview } from '@/lib/types';
import SummaryCard from './SummaryCard';
import TransactionItem from './TransactionItem';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Inbox, Target, AlertTriangle } from 'lucide-react';
import { CategoryIcon } from './CategoryIcons';

interface DashboardViewProps {
  summary: SummaryData;
  recentTransactions: Transaction[];
  categories: Category[];
  user: User;
  budgetOverview: BudgetOverview | null;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  onOpenAddModal: (type?: 'income' | 'expense') => void;
  onNavigateToHistory: () => void;
  onNavigateToSettings: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export default function DashboardView({
  summary,
  recentTransactions,
  user,
  budgetOverview,
  selectedPeriod,
  onPeriodChange,
  onOpenAddModal,
  onNavigateToHistory,
  onNavigateToSettings,
  onEditTransaction,
  onDeleteTransaction,
}: DashboardViewProps) {
  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Dynamic Net Balance, Cash In, Cash Out Cockpit */}
      <SummaryCard
        summary={summary}
        currency={user.currency}
        selectedPeriod={selectedPeriod}
        onPeriodChange={onPeriodChange}
        onOpenAddModal={onOpenAddModal}
      />

      {/* Monthly Budget Spending Limits Preview */}
      {budgetOverview && budgetOverview.budgets.length > 0 && (
        <div className="p-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Monthly Budgets ({budgetOverview.month})
              </h3>
            </div>
            <button
              onClick={onNavigateToSettings}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
            >
              Manage
            </button>
          </div>

          <div className="space-y-2.5">
            {budgetOverview.budgets.slice(0, 3).map((b) => (
              <div key={b.budget_id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center text-white text-[9px]"
                      style={{ backgroundColor: b.category_color }}
                    >
                      <CategoryIcon name={b.category_icon} className="w-2.5 h-2.5" />
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {b.category_name}
                    </span>
                    {b.status === 'exceeded' && (
                      <span className="text-[10px] text-rose-500 font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> Over
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 text-[11px]">
                    {user.currency} {formatAmount(b.actual_spent)} / {formatAmount(b.budget_limit)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      b.status === 'exceeded'
                        ? 'bg-rose-600'
                        : b.status === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(b.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
