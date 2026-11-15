'use client';

import React, { useMemo } from 'react';
import { SummaryData, Transaction, Category, User, BudgetOverview } from '@/lib/types';
import SummaryCard from './SummaryCard';
import RecordLedger from './RecordLedger';
import { Target, AlertTriangle } from 'lucide-react';
import { CategoryIcon } from './CategoryIcons';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { filterTransactionsByPeriod } from '@/lib/period-filter';

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
  categories = [],
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
  const symbol = getCurrencySymbol(user.currency);

  // Filter transactions strictly by selected time period
  const filteredTransactions = useMemo(() => {
    return filterTransactionsByPeriod(recentTransactions, selectedPeriod);
  }, [recentTransactions, selectedPeriod]);

  const emptyPeriodMessage =
    selectedPeriod === 'today'
      ? 'No transactions recorded for today'
      : selectedPeriod === 'this_week'
      ? 'No transactions recorded for this week'
      : selectedPeriod === 'this_month'
      ? 'No transactions recorded for this month'
      : 'No transactions recorded yet';

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      {/* Dribbble Sheet View Heading: Shown in Forest Theme */}
      <div className="theme-forest-title hidden items-center justify-between pt-0.5 pb-1 px-1">
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Dashboard</h2>
      </div>

      {/* Two-column cockpit layout on desktop, stacked on mobile */}
      <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start">
      <div className="space-y-4 lg:col-span-5">
      {/* Dynamic Net Balance, Cash In, Cash Out Cockpit with Visual Filter Scope */}
      <SummaryCard
        summary={summary}
        currency={symbol}
        selectedPeriod={selectedPeriod}
        onPeriodChange={onPeriodChange}
        onOpenAddModal={onOpenAddModal}
        filteredCount={filteredTransactions.length}
        transactions={filteredTransactions}
        categories={categories}
      />


      {/* Monthly Budget Spending Limits Preview */}
      {budgetOverview && budgetOverview.budgets.length > 0 && (
        <div className="p-4 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Monthly Budgets ({budgetOverview.month})
              </h3>
            </div>
            <button
              onClick={onNavigateToSettings}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
            >
              Manage
            </button>
          </div>

          <div className="space-y-3">
            {budgetOverview.budgets.slice(0, 3).map((b) => (
              <div key={b.budget_id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs"
                      style={{ backgroundColor: b.category_color }}
                    >
                      <CategoryIcon name={b.category_icon} className="w-3 h-3" />
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {b.category_name}
                    </span>
                    {b.status === 'exceeded' && (
                      <span className="text-xs text-rose-500 font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Over
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                    <span className="currency-symbol">{symbol}</span>{formatAmount(b.actual_spent)} / <span className="currency-symbol">{symbol}</span>{formatAmount(b.budget_limit)}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
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

      </div>

      {/* Recent / Filtered Records Section (right column on desktop) */}
      <div className="space-y-2.5 lg:col-span-7">
        <RecordLedger
          transactions={filteredTransactions}
          currency={symbol}
          onEdit={onEditTransaction}
          onDelete={onDeleteTransaction}
          onOpenAddModal={() => onOpenAddModal()}
          emptyMessage={emptyPeriodMessage}
          showHeader={true}
        />
      </div>
      </div>
    </div>
  );
}
