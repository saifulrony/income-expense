'use client';

import React, { useState, useEffect } from 'react';
import { api, getAppMode } from '@/lib/api';
import { OfflineStorage } from '@/lib/offline-storage';
import { 
  CategoryBreakdown, 
  MonthlyTrend, 
  User, 
  SummaryData, 
  AnalyticsInsights,
  PaymentMethodStat,
  DayOfWeekStat,
  TopExpenseItem,
  Transaction
} from '@/lib/types';
import { CategoryIcon } from './CategoryIcons';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { 
  PieChart, 
  BarChart2, 
  FileText,
  Download,
  Share2,
  X,
  CreditCard,
  Wallet,
  Calendar,
  Flame,
  Building,
  Smartphone,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { generateFinancialStatementPDF } from '@/lib/pdf-export';
import { exportTransactionsToCSV, exportCategoryBreakdownToCSV } from '@/lib/csv-export';
import { triggerHaptic } from '@/lib/haptics';
import { computePeriodComparison, PeriodComparisonStats } from '@/lib/month-comparison';
import { canAccessFeature, openUpgradeProModal } from '@/lib/billing';

interface AnalyticsViewProps {
  currency: string;
  user: User;
  summary: SummaryData;
  activeAccountId?: string;
}

// Curated fintech harmonious palettes to prevent clashing or redundant muddy colors
const HARMONIOUS_EXPENSE_PALETTE = [
  '#3B82F6', // Blue (Housing & Rent)
  '#F59E0B', // Warm Amber (Food & Dining)
  '#10B981', // Emerald (Transportation)
  '#8B5CF6', // Vibrant Purple (Entertainment)
  '#EC4899', // Pink (Shopping)
  '#06B6D4', // Cyan (Utilities & Bills)
  '#EF4444', // Rose Red (Healthcare)
  '#6366F1', // Indigo (Education)
  '#F97316', // Coral (Personal Care)
  '#64748B', // Slate (General Other)
];

const HARMONIOUS_INCOME_PALETTE = [
  '#10B981', // Emerald (Salary)
  '#059669', // Forest (Business)
  '#06B6D4', // Cyan (Freelance)
  '#3B82F6', // Blue (Investments)
  '#8B5CF6', // Purple (Bonus & Dividends)
  '#F59E0B', // Amber (Gifts & Other)
];

export default function AnalyticsView({ currency, user, summary, activeAccountId }: AnalyticsViewProps) {
  const symbol = getCurrencySymbol(currency);
  const [breakdownType, setBreakdownType] = useState<'expense' | 'income'>('expense');
  const [period, setPeriod] = useState<string>('all');
  const [trendView, setTrendView] = useState<'split' | 'net'>('split');
  const [hoveredMonth, setHoveredMonth] = useState<MonthlyTrend | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<CategoryBreakdown | null>(null);

  const [breakdowns, setBreakdowns] = useState<CategoryBreakdown[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [insights, setInsights] = useState<AnalyticsInsights | null>(null);
  const [periodComparison, setPeriodComparison] = useState<PeriodComparisonStats | null>(null);
  const [topIncomes, setTopIncomes] = useState<
    { id: string; amount: number; note: string; date: string; category_name: string; icon: string; color: string }[]
  >([]);
  const [extraStats, setExtraStats] = useState<{
    avgExpenseTx: number;
    projectedMonthSpend: number;
    expenseToIncomeRatio: number | null;
    noSpendDaysThisMonth: number;
    daysElapsedThisMonth: number;
    biggestSpendDay: { dateLabel: string; amount: number } | null;
  } | null>(null);
  const [periodSummary, setPeriodSummary] = useState<SummaryData>({
    total_income: summary?.total_income || 0,
    total_expense: summary?.total_expense || 0,
    net_balance: summary?.net_balance || 0,
    income_count: summary?.income_count || 0,
    expense_count: summary?.expense_count || 0,
    total_count: summary?.total_count || 0,
    period: 'all',
  });
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExportAnalyticsCSV = async () => {
    try {
      // 1. First get transactions for the active period
      const allTxs = OfflineStorage.getTransactions({ account_id: activeAccountId });
      const filtered = OfflineStorage.filterByPeriod(allTxs, period);

      if (filtered && filtered.length > 0) {
        const filename = `analytics_transactions_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
        const res = await exportTransactionsToCSV(filtered, filename, currency);
        if (res.success) {
          showToast(`Exported ${res.count} transactions to CSV`, 'success');
          return;
        }
      }

      // 2. If no transactions for period, fallback to exporting category breakdown
      if (breakdowns && breakdowns.length > 0) {
        const res = await exportCategoryBreakdownToCSV(breakdowns, breakdownType, period, currency);
        if (res.success) {
          showToast(`Exported ${breakdowns.length} categories to CSV`, 'success');
          return;
        }
      }

      showToast('No data available to export for this period.', 'error');
    } catch (err: any) {
      showToast('Failed to export CSV: ' + (err?.message || 'Unknown error'), 'error');
    }
  };

  const handleShareSummary = async () => {
    triggerHaptic('light');
    const periodLabel = period.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const netSign = periodSummary.net_balance >= 0 ? '+' : '-';
    const shareText = [
      `CashFlow Summary (${periodLabel})`,
      `Cash In: +${symbol}${formatAmount(periodSummary.total_income)}`,
      `Cash Out: -${symbol}${formatAmount(periodSummary.total_expense)}`,
      `Net Balance: ${netSign}${symbol}${formatAmount(Math.abs(periodSummary.net_balance))}`,
      `— Tracked with CashFlow`,
    ].join('\n');

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `CashFlow Summary (${periodLabel})`,
          text: shareText,
        });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        showToast('Summary copied — ready to paste & share!', 'success');
        return;
      }
      showToast('Sharing is not supported on this browser.', 'error');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showToast('Could not share summary.', 'error');
      }
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [breakdownType, period, activeAccountId]);

  const loadAnalytics = async () => {
    try {
      // 1. Instant local read (0ms latency, zero lag!)
      const localCat = OfflineStorage.getCategoryBreakdown(breakdownType, period, activeAccountId);
      const localTrends = OfflineStorage.getMonthlyTrends(activeAccountId);
      const localInsights = OfflineStorage.getAnalyticsInsights(period, activeAccountId);
      const localSum = OfflineStorage.getSummary(period, activeAccountId);
      const allTxs = OfflineStorage.getTransactions({ account_id: activeAccountId });

      setBreakdowns(localCat);
      setTotalAmount(localCat.reduce((sum, b) => sum + b.total_amount, 0));
      setMonthlyTrends(localTrends);
      setInsights(localInsights);
      setPeriodSummary(localSum);
      setPeriodComparison(computePeriodComparison(allTxs, period));

      // Compute Top 5 Incomes for active period
      const periodTxs = OfflineStorage.filterByPeriod(allTxs, period);
      const topInc = periodTxs
        .filter((tx) => tx.type === 'income')
        .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
        .slice(0, 5)
        .map((tx) => ({
          id: tx.id,
          amount: Number(tx.amount) || 0,
          note: tx.note || '',
          date: tx.date,
          category_name: tx.category?.name || 'Income',
          icon: tx.category?.icon || 'ArrowDownLeft',
          color: tx.category?.color || '#10B981',
        }));
      setTopIncomes(topInc);

      // Compute 5 Important Financial Health Stats
      const periodExpenses = periodTxs.filter((tx) => tx.type === 'expense');
      const avgExpenseTx =
        periodExpenses.length > 0
          ? periodExpenses.reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0) / periodExpenses.length
          : 0;

      const expenseToIncomeRatio =
        localSum.total_income > 0
          ? Math.round((localSum.total_expense / localSum.total_income) * 100)
          : null;

      // Current-month run-rate & no-spend days
      const now = new Date();
      const currYear = now.getFullYear();
      const currMonth = now.getMonth();
      const daysElapsedThisMonth = Math.max(1, now.getDate());
      const totalDaysInMonth = new Date(currYear, currMonth + 1, 0).getDate();

      let thisMonthSpend = 0;
      const spendDaysSet = new Set<number>();
      for (const tx of allTxs) {
        if (tx.type !== 'expense' || !tx.date) continue;
        const d = new Date(tx.date);
        if (!isNaN(d.getTime()) && d.getFullYear() === currYear && d.getMonth() === currMonth) {
          thisMonthSpend += Number(tx.amount) || 0;
          spendDaysSet.add(d.getDate());
        }
      }
      const projectedMonthSpend = (thisMonthSpend / daysElapsedThisMonth) * totalDaysInMonth;
      const noSpendDaysThisMonth = Math.max(0, daysElapsedThisMonth - spendDaysSet.size);

      // Biggest single spending day in active period
      const spendByDay = new Map<string, { amount: number; rawDate: Date }>();
      for (const tx of periodExpenses) {
        const d = new Date(tx.date);
        if (isNaN(d.getTime())) continue;
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const prev = spendByDay.get(key);
        spendByDay.set(key, {
          amount: (prev?.amount || 0) + (Number(tx.amount) || 0),
          rawDate: d,
        });
      }
      let biggestSpendDay: { dateLabel: string; amount: number } | null = null;
      spendByDay.forEach((val) => {
        if (!biggestSpendDay || val.amount > biggestSpendDay.amount) {
          biggestSpendDay = {
            dateLabel: val.rawDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            amount: val.amount,
          };
        }
      });

      setExtraStats({
        avgExpenseTx,
        projectedMonthSpend,
        expenseToIncomeRatio,
        noSpendDaysThisMonth,
        daysElapsedThisMonth,
        biggestSpendDay,
      });

      setLoading(false);

      // 2. If online mode, fetch from backend in background without hanging UI
      if (getAppMode() === 'online') {
        Promise.all([
          api.getCategoryBreakdown(breakdownType, period, activeAccountId).catch(() => null),
          api.getMonthlyTrends(activeAccountId).catch(() => null),
          api.getAnalyticsInsights(period, activeAccountId).catch(() => null),
          api.getSummary(period, activeAccountId).catch(() => null),
        ]).then(([catData, trendsData, insightsData, sumData]) => {
          if (catData) {
            setBreakdowns(catData.breakdowns || []);
            setTotalAmount(catData.total || 0);
          }
          if (trendsData) setMonthlyTrends(trendsData.trends || []);
          if (insightsData) setInsights(insightsData);
          if (sumData) setPeriodSummary(sumData);
        });
      }
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  // "2026-06" → "Jun" (keeps already-friendly labels untouched)
  const formatMonthLabel = (m: string) => {
    if (!/^\d{4}-\d{2}/.test(m)) return m.split(' ')[0];
    const d = new Date(`${m.slice(0, 7)}-02T00:00:00`);
    return isNaN(d.getTime()) ? m : d.toLocaleDateString('en-US', { month: 'short' });
  };

  // SVG Donut calculation
  const radius = 40;
  const circumference = 2 * Math.PI * radius; // ~251.32

  // Pre-calculate guaranteed unique, non-colliding colors for each category in the current breakdown
  const categoryColorMap = React.useMemo(() => {
    const map = new Map<string, string>();
    const usedColors = new Set<string>();
    const palette = breakdownType === 'income' ? HARMONIOUS_INCOME_PALETTE : HARMONIOUS_EXPENSE_PALETTE;
    let paletteIdx = 0;

    breakdowns.forEach((cat, idx) => {
      const key = cat.category_id || cat.category_name || String(idx);
      const rawColor = cat.color?.trim();

      // If category has a valid color that hasn't been used yet in this breakdown
      if (rawColor && !usedColors.has(rawColor.toLowerCase())) {
        map.set(key, rawColor);
        usedColors.add(rawColor.toLowerCase());
      } else {
        // Find next unused color from harmonious palette
        let chosenColor = '';
        for (let i = 0; i < palette.length; i++) {
          const candidate = palette[(paletteIdx + i) % palette.length];
          if (!usedColors.has(candidate.toLowerCase())) {
            chosenColor = candidate;
            paletteIdx = (paletteIdx + i + 1) % palette.length;
            break;
          }
        }
        // If all palette colors used, fallback to indexed palette color
        if (!chosenColor) {
          chosenColor = palette[idx % palette.length];
        }
        map.set(key, chosenColor);
        usedColors.add(chosenColor.toLowerCase());
      }
    });

    return map;
  }, [breakdowns, breakdownType]);

  const getCategoryColor = (cat: CategoryBreakdown, index: number) => {
    const key = cat.category_id || cat.category_name || String(index);
    return categoryColorMap.get(key) || cat.color || HARMONIOUS_EXPENSE_PALETTE[index % HARMONIOUS_EXPENSE_PALETTE.length];
  };

  // Pre-calculate clean, non-overlapping donut slices
  const donutSlices = React.useMemo(() => {
    let currentOffset = 0;
    const gap = breakdowns.length > 1 ? 1.5 : 0; // Clean hairline separator between categories
    return breakdowns.map((cat, idx) => {
      const rawLength = (cat.percentage / 100) * circumference;
      const sliceLength = Math.max(0, rawLength - gap);
      const dashOffset = -currentOffset;
      currentOffset += rawLength;
      return {
        ...cat,
        effectiveColor: getCategoryColor(cat, idx),
        sliceLength,
        dashOffset,
      };
    });
  }, [breakdowns, circumference, categoryColorMap]);

  // Helper to get payment method icon
  const getMethodIcon = (method: string) => {
    const m = (method || '').toLowerCase();
    if (m.includes('card') || m.includes('credit') || m.includes('debit')) {
      return <CreditCard className="w-3.5 h-3.5 text-blue-500" />;
    }
    if (m.includes('bank') || m.includes('wire') || m.includes('transfer')) {
      return <Building className="w-3.5 h-3.5 text-purple-500" />;
    }
    if (m.includes('mobile') || m.includes('bkash') || m.includes('nagad') || m.includes('paypal') || m.includes('wallet')) {
      return <Smartphone className="w-3.5 h-3.5 text-amber-500" />;
    }
    return <Wallet className="w-3.5 h-3.5 text-emerald-500" />;
  };

  return (
    <div className="space-y-3.5 pb-24">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg border text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-rose-600 text-white border-rose-700'
          }`}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-1 opacity-70 hover:opacity-100">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <PieChart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Analytics</span>
        </h2>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleShareSummary}
            className="p-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-teal-600 dark:text-teal-400 shadow-xs hover:bg-slate-50 transition-all"
            title="Share Summary"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleExportAnalyticsCSV}
            className="p-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-emerald-600 dark:text-emerald-400 shadow-xs hover:bg-slate-50 transition-all"
            title="Download CSV Statement"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              if (!canAccessFeature('canExportPdf')) {
                openUpgradeProModal('pdf_report');
                return;
              }
              generateFinancialStatementPDF(user, summary, [], period);
            }}
            className="p-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-indigo-600 dark:text-indigo-400 shadow-xs hover:bg-slate-50 transition-all flex items-center gap-1"
            title="Download PDF (Pro)"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>

          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold rounded-md px-2 py-1 text-slate-700 dark:text-slate-200 outline-none shadow-xs cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="this_month">This Month</option>
            <option value="this_week">This Week</option>
            <option value="today">Today</option>
            <option value="this_year">This Year</option>
          </select>
        </div>
      </div>

      {/* 1. MINIMAL FINANCIAL SUMMARY CARD */}
      <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-3.5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
        {/* 3-Column Stats: Inflow, Outflow, Net Balance */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* Inflow */}
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
              Inflow
            </span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block truncate">
              <span className="currency-symbol">{symbol}</span>{formatAmount(periodSummary.total_income)}
            </span>
          </div>

          {/* Outflow */}
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
              Outflow
            </span>
            <span className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5 block truncate">
              <span className="currency-symbol">{symbol}</span>{formatAmount(periodSummary.total_expense)}
            </span>
          </div>

          {/* Net */}
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
              Net
            </span>
            <span className={`text-sm font-black font-mono mt-0.5 block truncate ${
              periodSummary.net_balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
            }`}>
              <span className="currency-symbol">{symbol}</span>{formatAmount(Math.abs(periodSummary.net_balance))}
            </span>
          </div>
        </div>

        {/* Minimal Savings Ratio Strip */}
        {insights && (
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-slate-400">Savings:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                {insights.savings_rate.toFixed(0)}%
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                insights.savings_health === 'High' || insights.savings_health === 'Healthy'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              }`}>
                {insights.savings_health}
              </span>
            </div>

            <div className="flex items-center gap-1 text-slate-400 shrink-0">
              <span>Avg:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
                <span className="currency-symbol">{symbol}</span>{formatAmount(insights.daily_average_expense)}/d
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 1B. PERIOD COMPARISON CARD */}
      {periodComparison ? (
        <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-3.5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              <span>{periodComparison.title}</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {periodComparison.badge}
            </span>
          </div>

          {periodComparison.hasPrevData ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {/* Income Delta */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Income</div>
                  <div className="text-xs font-black text-slate-900 dark:text-white font-mono mt-0.5 truncate">
                    {symbol}{formatAmount(periodComparison.currIncome)}
                  </div>
                  <div className={`text-[10px] font-bold font-mono mt-1 flex items-center gap-0.5 truncate ${
                    periodComparison.incomeDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                  }`}>
                    {periodComparison.incomeDiff >= 0 ? (
                      <TrendingUp className="w-3 h-3 shrink-0" />
                    ) : (
                      <TrendingDown className="w-3 h-3 shrink-0" />
                    )}
                    <span className="truncate">
                      {periodComparison.incomePct !== null
                        ? `${periodComparison.incomePct >= 0 ? '+' : ''}${periodComparison.incomePct}%`
                        : `${periodComparison.incomeDiff >= 0 ? '+' : '-'}${symbol}${formatAmount(Math.abs(periodComparison.incomeDiff))}`}
                    </span>
                  </div>
                </div>

                {/* Spending Delta (Lower spending = Green!) */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Spending</div>
                  <div className="text-xs font-black text-slate-900 dark:text-white font-mono mt-0.5 truncate">
                    {symbol}{formatAmount(periodComparison.currExpense)}
                  </div>
                  <div className={`text-[10px] font-bold font-mono mt-1 flex items-center gap-0.5 truncate ${
                    periodComparison.expenseDiff <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                  }`}>
                    {periodComparison.expenseDiff <= 0 ? (
                      <TrendingDown className="w-3 h-3 shrink-0" />
                    ) : (
                      <TrendingUp className="w-3 h-3 shrink-0" />
                    )}
                    <span className="truncate">
                      {periodComparison.expensePct !== null
                        ? `${periodComparison.expensePct > 0 ? '+' : ''}${periodComparison.expensePct}%`
                        : `${periodComparison.expenseDiff <= 0 ? '-' : '+'}${symbol}${formatAmount(Math.abs(periodComparison.expenseDiff))}`}
                    </span>
                  </div>
                </div>

                {/* Net Saved Delta */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Net Saved</div>
                  <div className={`text-xs font-black font-mono mt-0.5 truncate ${
                    periodComparison.currNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                  }`}>
                    {periodComparison.currNet >= 0 ? '+' : '-'}{symbol}{formatAmount(Math.abs(periodComparison.currNet))}
                  </div>
                  <div className={`text-[10px] font-bold font-mono mt-1 truncate ${
                    periodComparison.netDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                  }`}>
                    {periodComparison.netDiff >= 0 ? '+' : '-'}{symbol}{formatAmount(Math.abs(periodComparison.netDiff))}
                  </div>
                </div>
              </div>

              {/* Human-readable insight summary */}
              <div className={`px-3 py-2 rounded-lg text-[11px] font-semibold flex items-center justify-between gap-2 ${
                periodComparison.expenseDiff <= 0
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40'
                  : 'bg-rose-50/80 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40'
              }`}>
                <span>
                  {periodComparison.expenseDiff <= 0
                    ? `You spent ${symbol}${formatAmount(Math.abs(periodComparison.expenseDiff))} less than ${periodComparison.prevLabel}${periodComparison.expensePct !== null ? ` (${Math.abs(periodComparison.expensePct)}% saved)` : ''}`
                    : `You spent ${symbol}${formatAmount(periodComparison.expenseDiff)} more than ${periodComparison.prevLabel}${periodComparison.expensePct !== null ? ` (+${periodComparison.expensePct}%)` : ''}`}
                </span>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {periodComparison.emptyText}
            </p>
          )}
        </div>
      ) : period === 'all' ? (
        <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-3 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Select a period to compare:</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPeriod('today')}
              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPeriod('this_week')}
              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setPeriod('this_month')}
              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setPeriod('this_year')}
              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
            >
              This Year
            </button>
          </div>
        </div>
      ) : null}

      {/* 2. CATEGORY BREAKDOWN WITH CIRCULAR DONUT CHART */}
      <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
        {/* Header with Title and Outflow/Inflow Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Categories
          </span>

          {/* Out vs In Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-700/60 p-0.5 rounded-md text-xs font-semibold">
            <button
              onClick={() => {
                setBreakdownType('expense');
                setHoveredCategory(null);
              }}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                breakdownType === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-rose-600'
              }`}
            >
              Expense
            </button>
            <button
              onClick={() => {
                setBreakdownType('income');
                setHoveredCategory(null);
              }}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                breakdownType === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-emerald-600'
              }`}
            >
              Income
            </button>
          </div>
        </div>

        {breakdowns.length > 0 ? (
          <div className="space-y-3">
            {/* Prominent Circular Donut Chart */}
            <div className="flex justify-center py-1">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-slate-100 dark:text-slate-700/40"
                  />

                  {/* Slices with Harmonious Non-Clashing Palette */}
                  {donutSlices.map((slice, idx) => {
                    const isHovered = hoveredCategory && (hoveredCategory.category_id === slice.category_id || hoveredCategory.category_name === slice.category_name);
                    return (
                      <circle
                        key={slice.category_id || idx}
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke={slice.effectiveColor}
                        strokeWidth={isHovered ? "10" : "8"}
                        strokeDasharray={`${slice.sliceLength} ${circumference}`}
                        strokeDashoffset={slice.dashOffset}
                        strokeLinecap="butt"
                        className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                        onMouseEnter={() => setHoveredCategory(slice)}
                        onMouseLeave={() => setHoveredCategory(null)}
                      />
                    );
                  })}
                </svg>

                {/* Center Content Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2 pointer-events-none select-none">
                  {hoveredCategory ? (
                    <div className="animate-in fade-in zoom-in-95 duration-150">
                      <span className="text-[11px] text-slate-400 font-bold uppercase truncate max-w-[110px] block">
                        {hoveredCategory.category_name}
                      </span>
                      <span className="text-base font-black text-slate-900 dark:text-white font-mono block">
                        {hoveredCategory.percentage.toFixed(1)}%
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium block truncate max-w-[110px]">
                        <span className="currency-symbol">{symbol}</span>{formatAmount(hoveredCategory.total_amount)}
                      </span>
                    </div>
                  ) : (
                    <div className="animate-in fade-in duration-150">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Total
                      </span>
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono truncate max-w-[110px] block mt-0.5">
                        <span className="currency-symbol">{symbol}</span>{formatAmount(totalAmount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Category Rows (Single-line, minimal) */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 pt-1">
              {breakdowns.map((cat, idx) => {
                const catColor = getCategoryColor(cat, idx);
                const isHovered = hoveredCategory && (hoveredCategory.category_id === cat.category_id || hoveredCategory.category_name === cat.category_name);

                return (
                  <div
                    key={cat.category_id}
                    onMouseEnter={() => setHoveredCategory({ ...cat, color: catColor })}
                    onMouseLeave={() => setHoveredCategory(null)}
                    className={`py-2 flex items-center justify-between -mx-1.5 px-1.5 rounded-md transition-all cursor-pointer ${
                      isHovered
                        ? 'bg-slate-100/80 dark:bg-slate-700/50'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-700/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: catColor }}
                      >
                        <CategoryIcon name={cat.icon || 'Tag'} className="w-3 h-3" />
                      </div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {cat.category_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-xs text-slate-900 dark:text-white font-mono">
                        <span className="currency-symbol">{symbol}</span>{formatAmount(cat.total_amount)}
                      </span>
                      <span
                        className="text-[11px] font-bold font-mono px-1.5 py-0.2 rounded-md"
                        style={{
                          backgroundColor: `${catColor}18`,
                          color: catColor,
                        }}
                      >
                        {cat.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400">
            No records for this period.
          </div>
        )}
      </div>

      {/* 3. CASH FLOW & MONTHLY TRENDS (DUAL VIEW TOGGLE: IN/OUT vs NET) */}
      <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Cash Flow (6M)
            </span>
            {hoveredMonth && (
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold animate-in fade-in duration-100">
                • {formatMonthLabel(hoveredMonth.month)}
                {trendView === 'split' ? (
                  <>
                    {' '}
                    <span className="text-emerald-600 dark:text-emerald-400">
                      +{symbol}{formatAmount(hoveredMonth.income)}
                    </span>{' '}
                    <span className="text-rose-600 dark:text-rose-400">
                      -{symbol}{formatAmount(hoveredMonth.expense)}
                    </span>
                  </>
                ) : (
                  <span className={hoveredMonth.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                    {' '}{hoveredMonth.net >= 0 ? '+' : '-'}{symbol}{formatAmount(Math.abs(hoveredMonth.net))}
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-700/60 p-0.5 rounded-md text-xs font-semibold">
            <button
              onClick={() => setTrendView('split')}
              className={`px-2 py-0.5 rounded-md transition-all ${
                trendView === 'split' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-400'
              }`}
            >
              In/Out
            </button>
            <button
              onClick={() => setTrendView('net')}
              className={`px-2 py-0.5 rounded-md transition-all ${
                trendView === 'net' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-400'
              }`}
            >
              Net
            </button>
          </div>
        </div>

        {/* Dynamic Bar Charts */}
        <div className="grid grid-cols-6 gap-2 pt-4 pb-1 items-end h-36">
          {monthlyTrends.map((trend, i) => {
            if (trendView === 'split') {
              const maxVal = Math.max(
                ...monthlyTrends.map((t) => Math.max(t.income, t.expense)),
                1
              );
              const incHeight = Math.round((trend.income / maxVal) * 100);
              const expHeight = Math.round((trend.expense / maxVal) * 100);

              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredMonth(trend)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  className="flex flex-col items-center h-full justify-end cursor-pointer group"
                >
                  <div className="w-full flex items-end justify-center gap-1 h-24 group-hover:opacity-90">
                    <div
                      className="w-2 bg-emerald-500 rounded-t-sm transition-all"
                      style={{ height: `${Math.max(incHeight, 4)}%` }}
                    />
                    <div
                      className="w-2 bg-rose-500 rounded-t-sm transition-all"
                      style={{ height: `${Math.max(expHeight, 4)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white mt-1.5 font-medium truncate w-full text-center transition-colors">
                    {formatMonthLabel(trend.month)}
                  </span>
                </div>
              );
            } else {
              // Net View
              const maxAbsNet = Math.max(
                ...monthlyTrends.map((t) => Math.abs(t.net)),
                1
              );
              const isPositive = trend.net >= 0;
              const netHeight = Math.round((Math.abs(trend.net) / maxAbsNet) * 100);

              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredMonth(trend)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  className="flex flex-col items-center h-full justify-end cursor-pointer group"
                >
                  <div className="w-full flex items-end justify-center h-24">
                    <div
                      className={`w-3 rounded-t-sm transition-all ${
                        isPositive ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ height: `${Math.max(netHeight, 6)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white mt-1.5 font-medium truncate w-full text-center transition-colors">
                    {formatMonthLabel(trend.month)}
                  </span>
                </div>
              );
            }
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 pt-1.5 border-t border-slate-100 dark:border-slate-700/60 text-[11px]">
          {trendView === 'split' ? (
            <>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                In
              </span>
              <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Out
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Surplus
              </span>
              <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Deficit
              </span>
            </>
          )}
        </div>
      </div>

      {/* 4. PAYMENT METHODS & WEEKLY RHYTHM */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Payment Method Distribution */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Payment Methods
            </span>

            {insights.payment_methods.length > 0 ? (
              <div className="space-y-2 pt-0.5">
                {insights.payment_methods.map((method, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <div className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center shrink-0">
                          {getMethodIcon(method.method)}
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {method.method}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white font-mono shrink-0">
                        <span className="currency-symbol">{symbol}</span>{formatAmount(method.amount)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(method.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-400">
                No expense methods recorded yet.
              </div>
            )}
          </div>

          {/* Weekly Spending Rhythm (Day of Week) */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Weekly Rhythm
              </span>
              {insights.peak_spending_day && insights.peak_spending_day !== 'None' && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold border border-amber-200/60 dark:border-amber-900/40 flex items-center gap-1">
                  <Flame className="w-2.5 h-2.5 text-amber-500" />
                  Peak: {insights.peak_spending_day}
                </span>
              )}
            </div>

            {/* 7 Days Bar representation */}
            <div className="grid grid-cols-7 gap-1 pt-3 pb-0.5 items-end h-24">
              {insights.day_of_week_stats.map((dayStat, idx) => {
                const maxDayExp = Math.max(
                  ...insights.day_of_week_stats.map((d) => d.expense),
                  1
                );
                const isPeak = dayStat.day === insights.peak_spending_day && dayStat.expense > 0;
                const barHeight = Math.round((dayStat.expense / maxDayExp) * 100);

                return (
                  <div key={idx} className="flex flex-col items-center h-full justify-end group">
                    <div className="w-full flex items-end justify-center h-14">
                      <div
                        className={`w-3 rounded-t-sm transition-all ${
                          isPeak
                            ? 'bg-amber-500 shadow-2xs shadow-amber-500/30'
                            : 'bg-slate-200 dark:bg-slate-700 group-hover:bg-slate-300 dark:group-hover:bg-slate-600'
                        }`}
                        style={{ height: `${Math.max(barHeight, 8)}%` }}
                        title={`${dayStat.day}: ${symbol}${formatAmount(dayStat.expense)}`}
                      />
                    </div>
                    <span className={`text-[10px] mt-1 font-bold ${
                      isPeak ? 'text-amber-500' : 'text-slate-400'
                    }`}>
                      {dayStat.day[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. KEY FINANCIAL HEALTH STATS (5 Important Metrics) */}
      {extraStats && (
        <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Key Financial Stats
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {/* Stat 1: Avg Expense Size */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Expense</div>
              <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5 truncate">
                <span className="currency-symbol">{symbol}</span>{formatAmount(extraStats.avgExpenseTx)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Per transaction</div>
            </div>

            {/* Stat 2: Projected Month-End Spend */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Month-End Est.</div>
              <div className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 truncate">
                <span className="currency-symbol">{symbol}</span>{formatAmount(extraStats.projectedMonthSpend)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">At current pace</div>
            </div>

            {/* Stat 3: Expense-to-Income Ratio */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Burn Ratio</div>
              <div className={`text-xs sm:text-sm font-black font-mono mt-0.5 ${
                extraStats.expenseToIncomeRatio === null
                  ? 'text-slate-400'
                  : extraStats.expenseToIncomeRatio <= 60
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : extraStats.expenseToIncomeRatio <= 85
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}>
                {extraStats.expenseToIncomeRatio !== null ? `${extraStats.expenseToIncomeRatio}%` : '—'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Of income spent</div>
            </div>

            {/* Stat 4: No-Spend Days This Month */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">No-Spend Days</div>
              <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {extraStats.noSpendDaysThisMonth} / {extraStats.daysElapsedThisMonth}d
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Zero-spend this mo</div>
            </div>

            {/* Stat 5: Biggest Spending Day */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 col-span-2 sm:col-span-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Biggest Spending Day</div>
              <div className="flex items-baseline justify-between gap-2 mt-0.5">
                <div className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400 font-mono truncate">
                  {extraStats.biggestSpendDay
                    ? `${symbol}${formatAmount(extraStats.biggestSpendDay.amount)}`
                    : '—'}
                </div>
                <div className="text-[10px] font-bold text-slate-400 shrink-0">
                  {extraStats.biggestSpendDay ? extraStats.biggestSpendDay.dateLabel : 'No spend yet'}
                </div>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Highest single-day outflow</div>
            </div>
          </div>
        </div>
      )}

      {/* 6. TOP INCOMES & TOP EXPENSES */}
      {(topIncomes.length > 0 || (insights && insights.top_expenses.length > 0)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Top Incomes */}
          {topIncomes.length > 0 && (
            <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Top Incomes
              </span>

              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {topIncomes.map((tx) => (
                  <div key={tx.id} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs shrink-0"
                        style={{ backgroundColor: tx.color || '#10B981' }}
                      >
                        <CategoryIcon name={tx.icon || 'ArrowDownLeft'} className="w-3 h-3" />
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block">
                          {tx.note || tx.category_name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400">
                        {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                        +<span className="currency-symbol">{symbol}</span>{formatAmount(tx.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Expenses */}
          {insights && insights.top_expenses.length > 0 && (
            <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-500 block">
                Top Expenses
              </span>

              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {insights.top_expenses.map((tx) => (
                  <div key={tx.id} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs shrink-0"
                        style={{ backgroundColor: tx.color || '#EF4444' }}
                      >
                        <CategoryIcon name={tx.icon || 'ArrowUpRight'} className="w-3 h-3" />
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block">
                          {tx.note || tx.category_name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400">
                        {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="font-bold text-rose-600 dark:text-rose-400 font-mono text-xs">
                        -<span className="currency-symbol">{symbol}</span>{formatAmount(tx.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
