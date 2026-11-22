'use client';

import React, { useMemo } from 'react';
import { SummaryData, Transaction, Category, User, BudgetOverview } from '@/lib/types';
import SummaryCard from './SummaryCard';
import RecordLedger from './RecordLedger';
import AdSlot from './AdSlot';
import { Target, AlertTriangle, Flame } from 'lucide-react';
import { CategoryIcon } from './CategoryIcons';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { filterTransactionsByPeriod } from '@/lib/period-filter';
import { useTranslation, useTranslateCategory } from '@/lib/i18n';

interface DashboardViewProps {
  summary: SummaryData;
  recentTransactions: Transaction[];
  categories: Category[];
  user: User;
  budgetOverview: BudgetOverview | null;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  onOpenAddModal: (type?: 'income' | 'expense') => void;
  onOpenScanReceipt?: () => void;
  onNavigateToHistory: () => void;
  onNavigateToSettings: () => void;
  onNavigateToReminders?: () => void;
  onNavigateToCalendar?: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onBatchDeleteTransaction?: (ids: string[]) => void;
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
  onOpenScanReceipt,
  onNavigateToHistory,
  onNavigateToSettings,
  onNavigateToReminders,
  onNavigateToCalendar,
  onEditTransaction,
  onDeleteTransaction,
  onBatchDeleteTransaction,
}: DashboardViewProps) {
  const symbol = getCurrencySymbol(user.currency);
  const { t } = useTranslation();
  const tCat = useTranslateCategory();

  // Filter transactions strictly by selected time period
  const filteredTransactions = useMemo(() => {
    return filterTransactionsByPeriod(recentTransactions, selectedPeriod);
  }, [recentTransactions, selectedPeriod]);

  // Calculate consecutive daily logging streak (retention & habit gamification)
  const loggingStreak = useMemo(() => {
    if (!recentTransactions || recentTransactions.length === 0) return 0;
    const daySet = new Set<string>();
    for (const tx of recentTransactions) {
      if (!tx.date) continue;
      const d = new Date(tx.date);
      if (isNaN(d.getTime())) continue;
      daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    const today = new Date();
    const keyOf = (dt: Date) => `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
    const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!daySet.has(keyOf(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
      if (!daySet.has(keyOf(cursor))) return 0;
    }
    let streak = 0;
    while (daySet.has(keyOf(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [recentTransactions]);

  const emptyPeriodMessage =
    selectedPeriod === 'today'
      ? t('noTransactionsToday')
      : selectedPeriod === 'this_week'
      ? t('noTransactionsWeek')
      : selectedPeriod === 'this_month'
      ? t('noTransactionsMonth')
      : selectedPeriod === 'this_year'
      ? (t('noTransactionsYear') || 'No transactions recorded for this year')
      : t('noTransactionsYet');

  return (
    <div className="pb-20 lg:pb-8 space-y-4">
      {/* Top Banner Slot */}
      <AdSlot placement="cashflow_top" className="mb-2" />

      {/* Full-Width Dynamic Net Balance, Cash In, Cash Out Cockpit */}
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

      {/* Monthly Budget Spending Limits Preview (If Configured) */}
      {budgetOverview && budgetOverview.budgets.length > 0 && (
        <div className="p-4 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                {t('monthlyBudgets')} ({budgetOverview.month})
              </h3>
            </div>
            <button
              onClick={onNavigateToSettings}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
            >
              {t('manage')}
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
                      {tCat(b.category_name)}
                    </span>
                    {b.status === 'exceeded' && (
                      <span className="text-xs text-rose-500 font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> {t('over')}
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

      {/* Sponsored Ad Slot (Managed from NextPanel Bill Ads) */}
      <AdSlot placement="cashflow_dashboard" />

      {/* Full-Width Recent / Filtered Records Section */}
      <div className="space-y-2.5">
        <RecordLedger
          transactions={filteredTransactions}
          currency={symbol}
          onEdit={onEditTransaction}
          onDelete={onDeleteTransaction}
          onBatchDelete={onBatchDeleteTransaction}
          onOpenAddModal={() => onOpenAddModal()}
          emptyMessage={emptyPeriodMessage}
          showHeader={true}
          onOpenCalendar={onNavigateToCalendar}
        />
        {/* Bottom Banner Slot */}
        <AdSlot placement="cashflow_bottom" className="mt-3" />
      </div>
    </div>
  );
}
