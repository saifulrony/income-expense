'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Target,
  Plus,
  Trophy,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle2,
  Trash2,
  Pencil,
  X,
  Wallet,
  Sparkles,
  Activity,
  Tag,
  Layers,
} from 'lucide-react';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { useTranslation } from '@/lib/i18n';
import { triggerHaptic } from '@/lib/haptics';
import {
  Transaction,
  SummaryData,
  Category,
  SubAccount,
  BudgetOverview,
} from '@/lib/types';

export type DynamicGoalSource =
  | 'net_balance'      // Total Net Balance (All-Time Income - Expense)
  | 'monthly_savings'  // This Month's Net Savings (Month Income - Month Expense)
  | 'monthly_income'   // This Month's Total Income
  | 'category_month'   // Specific Category (This Month)
  | 'category_all'     // Specific Category (All-Time)
  | 'account_balance'; // Specific Sub-Account Net Balance

export interface DynamicFinancialGoal {
  id: string;
  title: string;
  target_amount: number;
  source: DynamicGoalSource;
  allocation_pct?: number; // e.g. 100% of net_balance allocated to this goal
  category_id?: string;
  account_id?: string;
  target_date?: string; // YYYY-MM-DD
  color: string;
  note?: string;
  created_at: string;
}

const STORAGE_KEY = 'cashflow_dynamic_goals_v2';

const GOAL_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
];

function roundNiceTarget(baseValue: number, fallback: number): number {
  if (baseValue <= 0) return fallback;
  // Set an inspiring next milestone ~1.25x to 1.5x above current value, rounded nicely
  const raw = baseValue * 1.25;
  const magnitude = Math.pow(10, Math.max(2, Math.floor(Math.log10(raw)) - 1));
  return Math.ceil(raw / magnitude) * magnitude;
}

interface GoalsViewProps {
  currency?: string;
  transactions?: Transaction[];
  summary?: SummaryData;
  categories?: Category[];
  accounts?: SubAccount[];
  budgetOverview?: BudgetOverview | null;
}

export default function GoalsView({
  currency = 'BDT',
  transactions = [],
  summary,
  categories = [],
  accounts = [],
}: GoalsViewProps) {
  const { t } = useTranslation();
  const symbol = getCurrencySymbol(currency);
  const [goals, setGoals] = useState<DynamicFinancialGoal[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<DynamicFinancialGoal | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Touch swipe-right-to-close gesture state for the right sidebar
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formSource, setFormSource] = useState<DynamicGoalSource>('net_balance');
  const [formAllocationPct, setFormAllocationPct] = useState('100');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formColor, setFormColor] = useState('#10B981');
  const [formNote, setFormNote] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) {
      setDragX(0);
      setIsDragging(false);
      isHorizontalSwipeRef.current = null;
    }
  }, [isSidebarOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isSidebarOpen) return;
    const t = e.touches[0];
    if (!t) return;
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    startTimeRef.current = Date.now();
    isHorizontalSwipeRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSidebarOpen) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;

    if (isHorizontalSwipeRef.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      isHorizontalSwipeRef.current = Math.abs(dx) > Math.abs(dy) && dx > 0;
      if (isHorizontalSwipeRef.current) {
        setIsDragging(true);
      }
    }

    if (isHorizontalSwipeRef.current) {
      setDragX(Math.max(0, dx));
    }
  };

  const handleTouchEnd = () => {
    if (!isHorizontalSwipeRef.current) {
      setIsDragging(false);
      return;
    }
    const elapsed = Math.max(1, Date.now() - startTimeRef.current);
    const velocity = dragX / elapsed;
    const shouldClose = dragX > 75 || velocity > 0.35;

    setIsDragging(false);
    setDragX(0);
    isHorizontalSwipeRef.current = null;

    if (shouldClose) {
      setIsSidebarOpen(false);
    }
  };

  // 1. Compute live metrics directly from user's real Income & Expense transactions
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const ledgerMetrics = useMemo(() => {
    let allTimeIncome = 0;
    let allTimeExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;
    const categoryMonthTotals: Record<string, number> = {};
    const categoryAllTotals: Record<string, number> = {};
    const accountNetBalances: Record<string, number> = {};

    transactions.forEach((tx) => {
      const amt = tx.amount || 0;
      const isIncome = tx.type === 'income';
      const isThisMonth = Boolean(tx.date && tx.date.startsWith(currentMonthPrefix));

      if (isIncome) {
        allTimeIncome += amt;
        if (isThisMonth) monthIncome += amt;
      } else {
        allTimeExpense += amt;
        if (isThisMonth) monthExpense += amt;
      }

      if (tx.category_id) {
        categoryAllTotals[tx.category_id] = (categoryAllTotals[tx.category_id] || 0) + amt;
        if (isThisMonth) {
          categoryMonthTotals[tx.category_id] = (categoryMonthTotals[tx.category_id] || 0) + amt;
        }
      }

      if (tx.account_id) {
        accountNetBalances[tx.account_id] =
          (accountNetBalances[tx.account_id] || 0) + (isIncome ? amt : -amt);
      }
    });

    // Fallback to summary if transactions array is filtered
    const netBalance =
      transactions.length > 0
        ? allTimeIncome - allTimeExpense
        : summary?.net_balance || 0;

    const monthSavings = monthIncome - monthExpense;
    const savingsRatePct =
      monthIncome > 0
        ? Math.round((monthSavings / monthIncome) * 100)
        : allTimeIncome > 0
        ? Math.round(((allTimeIncome - allTimeExpense) / allTimeIncome) * 100)
        : 0;

    return {
      allTimeIncome,
      allTimeExpense,
      netBalance,
      monthIncome,
      monthExpense,
      monthSavings,
      savingsRatePct,
      categoryMonthTotals,
      categoryAllTotals,
      accountNetBalances,
    };
  }, [transactions, summary, currentMonthPrefix]);

  // 2. Load or auto-initialize dynamic goals from real ledger numbers
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DynamicFinancialGoal[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setGoals(parsed);
          return;
        }
      }

      // Auto-create dynamic goals seeded directly from the user's real ledger numbers
      const netTarget = roundNiceTarget(Math.max(0, ledgerMetrics.netBalance), 50000);
      const monthSavTarget = roundNiceTarget(Math.max(0, ledgerMetrics.monthSavings), 20000);
      const monthIncTarget = roundNiceTarget(Math.max(0, ledgerMetrics.monthIncome), 25000);

      const initialDynamic: DynamicFinancialGoal[] = [
        {
          id: 'dyn_net_reserve',
          title: 'Emergency Fund',
          target_amount: netTarget,
          source: 'net_balance',
          allocation_pct: 100,
          color: '#10B981',
          created_at: new Date().toISOString(),
        },
        {
          id: 'dyn_monthly_savings',
          title: 'Monthly Savings Target',
          target_amount: monthSavTarget,
          source: 'monthly_savings',
          allocation_pct: 100,
          color: '#3B82F6',
          created_at: new Date().toISOString(),
        },
        {
          id: 'dyn_monthly_income',
          title: 'Monthly Income Target',
          target_amount: monthIncTarget,
          source: 'monthly_income',
          allocation_pct: 100,
          color: '#6366F1',
          created_at: new Date().toISOString(),
        },
      ];
      setGoals(initialDynamic);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDynamic));
    } catch {
      // ignore
    }
  }, [ledgerMetrics.netBalance, ledgerMetrics.monthSavings, ledgerMetrics.monthIncome]);

  const saveGoals = (list: DynamicFinancialGoal[]) => {
    setGoals(list);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch {}
    }
  };

  // 3. Dynamically evaluate current live amount for any goal from ledger entries
  const evaluateGoalLiveAmount = (goal: DynamicFinancialGoal): {
    currentAmount: number;
    sourceLabel: string;
  } => {
    const pctFactor = Math.max(1, Math.min(100, goal.allocation_pct || 100)) / 100;

    switch (goal.source) {
      case 'monthly_savings':
        return {
          currentAmount: Math.max(0, ledgerMetrics.monthSavings * pctFactor),
          sourceLabel:
            pctFactor < 1
              ? `${goal.allocation_pct}% Monthly Savings`
              : 'Monthly Savings',
        };
      case 'monthly_income':
        return {
          currentAmount: Math.max(0, ledgerMetrics.monthIncome * pctFactor),
          sourceLabel:
            pctFactor < 1
              ? `${goal.allocation_pct}% Monthly Income`
              : 'Monthly Income',
        };
      case 'category_month': {
        const cat = categories.find((c) => c.id === goal.category_id);
        const amt = goal.category_id ? ledgerMetrics.categoryMonthTotals[goal.category_id] || 0 : 0;
        return {
          currentAmount: amt,
          sourceLabel: `${cat?.name || 'Category'} (Month)`,
        };
      }
      case 'category_all': {
        const cat = categories.find((c) => c.id === goal.category_id);
        const amt = goal.category_id ? ledgerMetrics.categoryAllTotals[goal.category_id] || 0 : 0;
        return {
          currentAmount: amt,
          sourceLabel: `${cat?.name || 'Category'} (All-Time)`,
        };
      }
      case 'account_balance': {
        const acc = accounts.find((a) => a.id === goal.account_id);
        const amt =
          acc?.balance !== undefined
            ? acc.balance
            : goal.account_id
            ? ledgerMetrics.accountNetBalances[goal.account_id] || 0
            : ledgerMetrics.netBalance;
        return {
          currentAmount: Math.max(0, amt * pctFactor),
          sourceLabel: `${acc?.name || 'Account'} Balance`,
        };
      }
      case 'net_balance':
      default:
        return {
          currentAmount: Math.max(0, ledgerMetrics.netBalance * pctFactor),
          sourceLabel:
            pctFactor < 1
              ? `${goal.allocation_pct}% Net Balance`
              : 'Net Balance',
        };
    }
  };

  // Enrich goals with live computed numbers
  const evaluatedGoals = useMemo(() => {
    return goals.map((g) => {
      const { currentAmount, sourceLabel } = evaluateGoalLiveAmount(g);
      const pct =
        g.target_amount > 0
          ? Math.min(100, Math.round((currentAmount / g.target_amount) * 100))
          : 0;
      const remaining = Math.max(0, g.target_amount - currentAmount);
      const isCompleted = pct >= 100 && g.target_amount > 0;
      return {
        ...g,
        currentAmount,
        sourceLabel,
        pct,
        remaining,
        isCompleted,
      };
    });
  }, [goals, ledgerMetrics, categories, accounts]);

  const stats = useMemo(() => {
    let completedCount = 0;
    let activeCount = 0;
    let avgPctSum = 0;

    evaluatedGoals.forEach((g) => {
      avgPctSum += g.pct;
      if (g.isCompleted) completedCount += 1;
      else activeCount += 1;
    });

    const overallPct =
      evaluatedGoals.length > 0 ? Math.round(avgPctSum / evaluatedGoals.length) : 0;
    return { completedCount, activeCount, overallPct };
  }, [evaluatedGoals]);

  const filteredGoals = useMemo(() => {
    return evaluatedGoals.filter((g) => {
      if (filter === 'active') return !g.isCompleted;
      if (filter === 'completed') return g.isCompleted;
      return true;
    });
  }, [evaluatedGoals, filter]);

  const openCreateSidebar = () => {
    setEditingGoal(null);
    setFormTitle('');
    setFormTarget(String(roundNiceTarget(Math.max(0, ledgerMetrics.netBalance), 50000)));
    setFormSource('net_balance');
    setFormAllocationPct('100');
    setFormCategoryId(categories[0]?.id || '');
    setFormAccountId(accounts[0]?.id || '');
    setFormDate('');
    setFormColor('#10B981');
    setFormNote('');
    setIsSidebarOpen(true);
  };

  const openEditSidebar = (goal: DynamicFinancialGoal) => {
    setEditingGoal(goal);
    setFormTitle(goal.title);
    setFormTarget(String(goal.target_amount));
    setFormSource(goal.source || 'net_balance');
    setFormAllocationPct(String(goal.allocation_pct || 100));
    setFormCategoryId(goal.category_id || categories[0]?.id || '');
    setFormAccountId(goal.account_id || accounts[0]?.id || '');
    setFormDate(goal.target_date || '');
    setFormColor(goal.color || '#10B981');
    setFormNote(goal.note || '');
    setIsSidebarOpen(true);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const targetNum = parseFloat(formTarget);
    const allocNum = Math.max(1, Math.min(100, parseFloat(formAllocationPct || '100') || 100));
    if (!formTitle.trim() || isNaN(targetNum) || targetNum <= 0) return;

    triggerHaptic('success');
    let updated: DynamicFinancialGoal[];

    if (editingGoal) {
      updated = goals.map((g) =>
        g.id === editingGoal.id
          ? {
              ...g,
              title: formTitle.trim(),
              target_amount: targetNum,
              source: formSource,
              allocation_pct: allocNum,
              category_id:
                formSource === 'category_month' || formSource === 'category_all'
                  ? formCategoryId || undefined
                  : undefined,
              account_id: formSource === 'account_balance' ? formAccountId || undefined : undefined,
              target_date: formDate || undefined,
              color: formColor,
              note: formNote.trim() || undefined,
            }
          : g
      );
      setFeedback('Dynamic goal updated!');
    } else {
      const newGoal: DynamicFinancialGoal = {
        id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: formTitle.trim(),
        target_amount: targetNum,
        source: formSource,
        allocation_pct: allocNum,
        category_id:
          formSource === 'category_month' || formSource === 'category_all'
            ? formCategoryId || undefined
            : undefined,
        account_id: formSource === 'account_balance' ? formAccountId || undefined : undefined,
        target_date: formDate || undefined,
        color: formColor,
        note: formNote.trim() || undefined,
        created_at: new Date().toISOString(),
      };
      updated = [newGoal, ...goals];
      setFeedback('Dynamic goal created & linked to your ledger!');
    }

    saveGoals(updated);
    setIsSidebarOpen(false);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDelete = (id: string) => {
    triggerHaptic('warning');
    if (confirm('Remove this goal?')) {
      const updated = goals.filter((g) => g.id !== id);
      saveGoals(updated);
    }
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-8 animate-in fade-in duration-200">
      {feedback && (
        <div className="p-3 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          Savings Goals
        </h1>
        <button
          type="button"
          onClick={openCreateSidebar}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('newGoal')}</span>
        </button>
      </div>

      {/* Top 3 KPI Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Balance</div>
          <div className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white truncate mt-0.5">
            {symbol}{formatAmount(ledgerMetrics.netBalance)}
          </div>
        </div>

        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Month Saved</div>
          <div
            className={`text-sm sm:text-base font-black font-mono truncate mt-0.5 ${
              ledgerMetrics.monthSavings >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {ledgerMetrics.monthSavings < 0 ? '-' : ''}
            {symbol}{formatAmount(Math.abs(ledgerMetrics.monthSavings))}
          </div>
        </div>

        <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('progress')}</div>
          <div className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white mt-0.5">
            {stats.completedCount}/{evaluatedGoals.length} <span className="text-[11px] text-slate-400 font-normal">({stats.overallPct}%)</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200/70 dark:border-slate-800 pb-2">
        {(
          [
            { id: 'all', label: `All (${evaluatedGoals.length})` },
            { id: 'active', label: `${t('active')} (${stats.activeCount})` },
            { id: 'completed', label: `Done (${stats.completedCount})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
              filter === t.id
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Dynamic Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredGoals.length === 0 ? (
          <div className="md:col-span-2 p-8 text-center bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-1.5">
            <Target className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              No goals in this view
            </h3>
            <p className="text-[11px] text-slate-400">
              Tap &quot;New Goal&quot; to set a savings target.
            </p>
          </div>
        ) : (
          filteredGoals.map((goal) => (
            <div
              key={goal.id}
              onClick={() => openEditSidebar(goal)}
              className="p-3.5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs space-y-2.5 flex flex-col justify-between cursor-pointer transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: goal.color || '#10B981' }}
                    >
                      {goal.isCompleted ? <Trophy className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {goal.title}
                        </h3>
                        {goal.isCompleted && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            Done
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                        {goal.sourceLabel}
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => openEditSidebar(goal)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(goal.id)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Amount vs Target */}
                <div className="flex items-baseline justify-between text-xs pt-0.5">
                  <div className="font-mono">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {symbol}{formatAmount(goal.currentAmount)}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {' '}/ {symbol}{formatAmount(goal.target_amount)}
                    </span>
                  </div>
                  <span
                    className="text-xs font-extrabold font-mono"
                    style={{ color: goal.color || '#10B981' }}
                  >
                    {goal.pct}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700/80 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${goal.pct}%`,
                      backgroundColor: goal.color || '#10B981',
                    }}
                  />
                </div>
              </div>

              {/* Minimal Footer */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                <span>
                  {goal.remaining > 0
                    ? `Remaining: ${symbol}${formatAmount(goal.remaining)}`
                    : `Achieved (+${symbol}${formatAmount(Math.max(0, goal.currentAmount - goal.target_amount))})`}
                </span>
                {goal.target_date && (
                  <span className="flex items-center gap-1 font-mono">
                    <Calendar className="w-3 h-3" />
                    <span>{goal.target_date}</span>
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Dynamic Goal Right Sidebar (Portaled directly to document.body) */}
      {mounted && isSidebarOpen && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex justify-end">
            {/* Backdrop */}
            <div
              onClick={() => setIsSidebarOpen(false)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              style={{
                opacity: isDragging ? Math.max(0.15, 1 - dragX / 280) : 1,
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            />

            {/* Right Sidebar Panel */}
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              style={
                isDragging
                  ? {
                      transform: `translate3d(${dragX}px, 0, 0)`,
                      transition: 'none',
                    }
                  : undefined
              }
              onClick={(e) => e.stopPropagation()}
              className="relative w-80 max-w-[85vw] sm:w-[380px] sm:max-w-[85vw] h-full h-[100dvh] bg-white dark:bg-slate-900 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-slate-800 overflow-hidden will-change-transform"
            >
              {/* Subtle left-edge swipe handle bar */}
              <div
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-12 rounded-full bg-slate-300/80 dark:bg-slate-700/80 pointer-events-none z-20"
                aria-hidden="true"
              />

              {/* Panel Header */}
              <div
                className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900"
                style={{
                  paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: formColor }}
                  >
                    <Target className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
                      {editingGoal ? 'Edit Dynamic Goal' : 'New Dynamic Goal'}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      Auto-tracks your Income &amp; Expense entries
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                  title="Close Sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Full-height Form */}
              <form
                onSubmit={handleSaveGoal}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Goal Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Emergency Reserve, Monthly Savings Target"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  {/* Live Ledger Data Source Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Tracking Source</span>
                    </label>
                    <select
                      value={formSource}
                      onChange={(e) => setFormSource(e.target.value as DynamicGoalSource)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 cursor-pointer font-medium"
                    >
                      <option value="net_balance">
                        Net Balance ({symbol}{formatAmount(ledgerMetrics.netBalance)})
                      </option>
                      <option value="monthly_savings">
                        Monthly Savings ({symbol}{formatAmount(ledgerMetrics.monthSavings)})
                      </option>
                      <option value="monthly_income">
                        Monthly Income ({symbol}{formatAmount(ledgerMetrics.monthIncome)})
                      </option>
                      <option value="category_month">
                        Category (This Month)
                      </option>
                      <option value="category_all">
                        Category (All Time)
                      </option>
                      {accounts.length > 0 && (
                        <option value="account_balance">
                          Sub-Account Balance
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Category Picker if Category source chosen */}
                  {(formSource === 'category_month' || formSource === 'category_all') && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Select Linked Category</span>
                      </label>
                      <select
                        value={formCategoryId}
                        onChange={(e) => setFormCategoryId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.type === 'income' ? 'Income' : 'Expense'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Account Picker if Sub-Account source chosen */}
                  {formSource === 'account_balance' && accounts.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Select Linked Sub-Account</span>
                      </label>
                      <select
                        value={formAccountId}
                        onChange={(e) => setFormAccountId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({symbol}{formatAmount(acc.balance || 0)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Target Milestone ({symbol}) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="e.g. 100000"
                        value={formTarget}
                        onChange={(e) => setFormTarget(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Allocation %
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={formAllocationPct}
                        onChange={(e) => setFormAllocationPct(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Target Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Color Theme</span>
                    </label>
                    <div className="flex items-center gap-2 pt-0.5">
                      {GOAL_COLORS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setFormColor(hex)}
                          style={{ backgroundColor: hex }}
                          className={`w-6 h-6 rounded-full transition-transform ${
                            formColor === hex ? 'scale-125 ring-2 ring-slate-900 dark:ring-white' : 'opacity-80'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Note / Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Automatically tracks net balance progress"
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                {/* Bottom-most Docked Action Footer */}
                <div
                  className="px-4 sm:px-5 pt-3.5 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 mt-auto"
                  style={{
                    paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 14px), 16px)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="flex-1 py-2.5 px-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-3 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95"
                  >
                    {editingGoal ? 'Save Changes' : 'Create Goal'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
