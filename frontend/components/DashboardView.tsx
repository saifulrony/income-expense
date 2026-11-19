'use client';

import React, { useMemo } from 'react';
import { SummaryData, Transaction, Category, User, BudgetOverview } from '@/lib/types';
import SummaryCard from './SummaryCard';
import RecordLedger from './RecordLedger';
import AdSlot from './AdSlot';
import { Target, AlertTriangle, Flame, TrendingDown, TrendingUp, BellRing, CheckCircle2, Circle, Clock } from 'lucide-react';
import { CategoryIcon } from './CategoryIcons';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { filterTransactionsByPeriod } from '@/lib/period-filter';
import { useTranslation } from '@/lib/i18n';
import { computeMonthComparison } from '@/lib/month-comparison';
import { getStoredReminders, toggleReminderCompletion, TaskReminder } from '@/lib/reminders';

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
  onNavigateToReminders?: () => void;
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
  onNavigateToReminders,
  onEditTransaction,
  onDeleteTransaction,
}: DashboardViewProps) {
  const symbol = getCurrencySymbol(user.currency);
  const { t } = useTranslation();

  const [remindersList, setRemindersList] = React.useState<TaskReminder[]>([]);

  React.useEffect(() => {
    const update = () => setRemindersList(getStoredReminders());
    update();
    window.addEventListener('cashflow-reminders-updated', update);
    return () => window.removeEventListener('cashflow-reminders-updated', update);
  }, []);

  const pendingReminders = useMemo(
    () => remindersList.filter((r) => !r.is_completed).slice(0, 3),
    [remindersList]
  );

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

  const monthComparison = useMemo(() => {
    return computeMonthComparison(recentTransactions);
  }, [recentTransactions]);

  const emptyPeriodMessage =
    selectedPeriod === 'today'
      ? t('noTransactionsToday')
      : selectedPeriod === 'this_week'
      ? t('noTransactionsWeek')
      : selectedPeriod === 'this_month'
      ? t('noTransactionsMonth')
      : t('noTransactionsYet');

  return (
    <div className="pb-20 lg:pb-8">
      {/* Top Banner Slot */}
      <AdSlot placement="cashflow_top" className="mb-3" />

      {/* Dribbble Sheet View Heading: Shown in Forest Theme */}
      <div className="theme-forest-title hidden items-center justify-between pt-0.5 pb-1 px-1 mb-2.5">
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Dashboard</h2>
      </div>

      {/* Two-column cockpit layout on desktop, stacked on mobile */}
      <div className="mt-0 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start">
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

      {/* Smart Habit Streak & Previous Month Comparison Pill */}
      {(loggingStreak > 0 || monthComparison.hasPrevMonthData) && (
        <div className="flex items-center justify-between gap-2 px-1">
          {loggingStreak > 0 ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500/30" />
              <span>{loggingStreak}d streak</span>
            </div>
          ) : (
            <div />
          )}

          {monthComparison.hasPrevMonthData && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
                monthComparison.expenseDiff <= 0
                  ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/20 text-rose-700 dark:text-rose-300'
              }`}
              title={`Spending compared to ${monthComparison.prevMonthLabel}`}
            >
              {monthComparison.expenseDiff <= 0 ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5" />
              )}
              <span className="font-mono">
                {monthComparison.expensePct !== null
                  ? `${monthComparison.expenseDiff <= 0 ? '↓' : '↑'} ${Math.abs(monthComparison.expensePct)}% vs ${monthComparison.prevMonthLabel}`
                  : `${monthComparison.expenseDiff <= 0 ? 'Saved' : '+'} ${symbol}${formatAmount(Math.abs(monthComparison.expenseDiff))} vs ${monthComparison.prevMonthLabel}`}
              </span>
            </div>
          )}
        </div>
      )}


      {/* Bill & Task Reminders Preview */}
      {pendingReminders.length > 0 && (
        <div className="p-4 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Bill &amp; Task Reminders
              </h3>
            </div>
            {onNavigateToReminders && (
              <button
                type="button"
                onClick={onNavigateToReminders}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
              >
                View All ({remindersList.filter((r) => !r.is_completed).length})
              </button>
            )}
          </div>

          <div className="space-y-2">
            {pendingReminders.map((rem) => {
              const today = new Date().toISOString().slice(0, 10);
              const isOverdue = rem.due_date < today;
              const isToday = rem.due_date === today;

              return (
                <div
                  key={rem.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={async () => {
                        await toggleReminderCompletion(rem.id);
                        setRemindersList(getStoredReminders());
                      }}
                      className="text-slate-400 hover:text-emerald-500 transition-colors shrink-0"
                      title="Mark done"
                    >
                      <Circle className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {rem.title}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                        <span
                          className={
                            isOverdue
                              ? 'text-rose-500 font-bold'
                              : isToday
                              ? 'text-amber-500 font-bold'
                              : ''
                          }
                        >
                          {isOverdue ? 'Overdue • ' : isToday ? 'Due Today • ' : ''}
                          {rem.due_date}
                        </span>
                        {rem.amount && (
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                            • {symbol}{formatAmount(rem.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {rem.note && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[140px] hidden sm:inline">
                      {rem.note}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Budget Spending Limits Preview */}
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

      {/* Sponsored Ad Slot (Managed from NextPanel Bill Ads) */}
      <AdSlot placement="cashflow_dashboard" />

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
        {/* Bottom Banner Slot */}
        <AdSlot placement="cashflow_bottom" className="mt-3" />
      </div>
      </div>
    </div>
  );
}
