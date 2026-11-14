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
import { 
  PieChart, 
  BarChart2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Coins, 
  FileText,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Building,
  Smartphone,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { generateFinancialStatementPDF } from '@/lib/pdf-export';
import CurrencyConverterModal from './CurrencyConverterModal';

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
  const [breakdownType, setBreakdownType] = useState<'expense' | 'income'>('expense');
  const [period, setPeriod] = useState<string>('this_month');
  const [trendView, setTrendView] = useState<'split' | 'net'>('split');
  const [hoveredMonth, setHoveredMonth] = useState<MonthlyTrend | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<CategoryBreakdown | null>(null);

  const [breakdowns, setBreakdowns] = useState<CategoryBreakdown[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [insights, setInsights] = useState<AnalyticsInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConverterOpen, setIsConverterOpen] = useState(false);

  // Calendar State for Expenses by Date
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [monthExpenses, setMonthExpenses] = useState<Transaction[]>([]);

  useEffect(() => {
    loadCalendarExpenses();
  }, [calendarMonth, activeAccountId]);

  const loadCalendarExpenses = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const allTxs = OfflineStorage.getTransactions({
      type: 'expense',
      account_id: activeAccountId,
    });
    const filtered = allTxs.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    setMonthExpenses(filtered);
  };

  // Group expenses by 'YYYY-MM-DD'
  const dailyExpensesMap = React.useMemo(() => {
    const map = new Map<string, { total: number; count: number; transactions: Transaction[] }>();
    monthExpenses.forEach((t) => {
      const dateKey = new Date(t.date).toISOString().split('T')[0];
      const existing = map.get(dateKey) || { total: 0, count: 0, transactions: [] };
      existing.total += t.amount;
      existing.count += 1;
      existing.transactions.push(t);
      map.set(dateKey, existing);
    });
    return map;
  }, [monthExpenses]);

  const calendarGrid = React.useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dayNumber: number;
      dateKey: string;
      isCurrentMonth: boolean;
      totalExpense: number;
      txCount: number;
      isToday: boolean;
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Padding for days before the 1st
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dayNumber: 0,
        dateKey: `pad-${i}`,
        isCurrentMonth: false,
        totalExpense: 0,
        txCount: 0,
        isToday: false,
      });
    }

    // Days of current month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateKey = `${year}-${mStr}-${dStr}`;

      const expenseData = dailyExpensesMap.get(dateKey);
      days.push({
        dayNumber: d,
        dateKey,
        isCurrentMonth: true,
        totalExpense: expenseData ? expenseData.total : 0,
        txCount: expenseData ? expenseData.count : 0,
        isToday: dateKey === todayStr,
      });
    }

    return days;
  }, [calendarMonth, dailyExpensesMap]);

  const monthTotalExpense = React.useMemo(() => {
    return monthExpenses.reduce((sum, t) => sum + t.amount, 0);
  }, [monthExpenses]);

  const maxDailyExpense = React.useMemo(() => {
    let max = 0;
    dailyExpensesMap.forEach((data) => {
      if (data.total > max) max = data.total;
    });
    return max;
  }, [dailyExpensesMap]);

  const activeSpendingDaysCount = dailyExpensesMap.size;

  const selectedDateData = selectedCalendarDate ? dailyExpensesMap.get(selectedCalendarDate) : null;
  const formattedSelectedDate = React.useMemo(() => {
    if (!selectedCalendarDate) return '';
    const [y, m, d] = selectedCalendarDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedCalendarDate]);

  useEffect(() => {
    loadAnalytics();
  }, [breakdownType, period, activeAccountId]);

  const loadAnalytics = async () => {
    try {
      // 1. Instant local read (0ms latency, zero lag!)
      const localCat = OfflineStorage.getCategoryBreakdown(breakdownType, period, activeAccountId);
      const localTrends = OfflineStorage.getMonthlyTrends(activeAccountId);
      const localInsights = OfflineStorage.getAnalyticsInsights(period, activeAccountId);

      setBreakdowns(localCat);
      setTotalAmount(localCat.reduce((sum, b) => sum + b.total_amount, 0));
      setMonthlyTrends(localTrends);
      setInsights(localInsights);
      setLoading(false);

      // 2. If online mode, fetch from backend in background without hanging UI
      if (getAppMode() === 'online') {
        Promise.all([
          api.getCategoryBreakdown(breakdownType, period, activeAccountId).catch(() => null),
          api.getMonthlyTrends(activeAccountId).catch(() => null),
          api.getAnalyticsInsights(period, activeAccountId).catch(() => null),
        ]).then(([catData, trendsData, insightsData]) => {
          if (catData) {
            setBreakdowns(catData.breakdowns || []);
            setTotalAmount(catData.total || 0);
          }
          if (trendsData) setMonthlyTrends(trendsData.trends || []);
          if (insightsData) setInsights(insightsData);
        });
      }
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // SVG Donut calculation
  const radius = 40;
  const circumference = 2 * Math.PI * radius; // ~251.32

  const getCategoryColor = (cat: CategoryBreakdown, index: number) => {
    // If the category already has a unique distinctive color that isn't generic/clashing red
    if (cat.color && cat.color !== '#EF4444' && cat.color !== '#DC2626') {
      return cat.color;
    }
    const palette = breakdownType === 'income' ? HARMONIOUS_INCOME_PALETTE : HARMONIOUS_EXPENSE_PALETTE;
    return palette[index % palette.length];
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
  }, [breakdowns, circumference, breakdownType]);

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
    <div className="space-y-4 pb-24">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Financial Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Cash velocity, habits & performance</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsConverterOpen(true)}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-amber-600 dark:text-amber-400 shadow-xs hover:bg-slate-50 transition-all"
            title="Currency Converter"
          >
            <Coins className="w-4 h-4" />
          </button>

          <button
            onClick={() => generateFinancialStatementPDF(user, summary, [], period)}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-indigo-600 dark:text-indigo-400 shadow-xs hover:bg-slate-50 transition-all"
            title="Download PDF Financial Statement"
          >
            <FileText className="w-4 h-4" />
          </button>

          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 outline-none shadow-xs cursor-pointer"
          >
            <option value="this_month">This Month</option>
            <option value="today">Today</option>
            <option value="this_year">This Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* 1. EXECUTIVE KPI BANNER: SAVINGS RATE & BURN RATE */}
      {insights && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 shadow-lg space-y-4 border border-slate-700/50">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Savings & Capital Health</span>
              </div>
              <div className="text-2xl font-black mt-1 tracking-tight flex items-baseline gap-2">
                <span>{insights.savings_rate.toFixed(1)}%</span>
                <span className="text-xs font-medium text-slate-400">savings rate</span>
              </div>
            </div>

            {/* Health Badge */}
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${
              insights.savings_health === 'High'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : insights.savings_health === 'Healthy'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : insights.savings_health === 'Modest'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {insights.savings_health === 'High' && <CheckCircle2 className="w-3 h-3" />}
              {insights.savings_health === 'Deficit' && <AlertTriangle className="w-3 h-3" />}
              <span>{insights.savings_health}</span>
            </div>
          </div>

          {/* Savings Progress Ratio Bar */}
          <div className="space-y-1.5">
            <div className="h-2 w-full bg-slate-700/60 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 transition-all duration-700"
                style={{ width: `${Math.max(0, Math.min(100, insights.savings_rate))}%` }}
                title={`Savings: ${insights.savings_rate.toFixed(1)}%`}
              />
              <div
                className="bg-rose-500 transition-all duration-700"
                style={{ width: `${Math.max(0, Math.min(100, 100 - insights.savings_rate))}%` }}
                title={`Expenses: ${(100 - insights.savings_rate).toFixed(1)}%`}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span className="text-emerald-400 font-semibold">● Net Retained</span>
              <span className="text-rose-400 font-semibold">● Consumed Flow</span>
            </div>
          </div>

          {/* Sub KPIs Grid: Daily Burn Rate & Projected Month-End */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700/60 text-xs">
            <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/40">
              <div className="text-xs text-slate-400 font-medium">Daily Burn Rate</div>
              <div className="font-extrabold text-sm text-slate-100 font-mono mt-0.5">
                {currency} {formatAmount(insights.daily_average_expense)}
                <span className="text-xs font-normal text-slate-400 font-sans"> / day</span>
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                {insights.expense_diff_pct !== 0 ? (
                  insights.expense_diff_pct > 0 ? (
                    <span className="text-rose-400 flex items-center font-bold">
                      <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> +{insights.expense_diff_pct.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center font-bold">
                      <TrendingDown className="w-2.5 h-2.5 mr-0.5" /> {insights.expense_diff_pct.toFixed(0)}%
                    </span>
                  )
                ) : (
                  <span>Steady pace</span>
                )}
                <span>vs prev</span>
              </div>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/40">
              <div className="text-xs text-slate-400 font-medium">Paced Projection</div>
              <div className="font-extrabold text-sm text-slate-100 font-mono mt-0.5">
                {currency} {formatAmount(insights.projected_month_expense)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                estimated month close
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. CATEGORY BREAKDOWN WITH CIRCULAR DONUT CHART */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-4">
        {/* Header with Title and Outflow/Inflow Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Category Distribution
            </div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {breakdownType === 'expense' ? 'Spending breakdown' : 'Income breakdown'} for {period.replace('_', ' ')}
            </div>
          </div>

          {/* Out vs In Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-700/60 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => {
                setBreakdownType('expense');
                setHoveredCategory(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                breakdownType === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-rose-600'
              }`}
            >
              Cash Out
            </button>
            <button
              onClick={() => {
                setBreakdownType('income');
                setHoveredCategory(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                breakdownType === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'
              }`}
            >
              Cash In
            </button>
          </div>
        </div>

        {breakdowns.length > 0 ? (
          <div className="space-y-4">
            {/* Prominent Circular Donut Chart */}
            <div className="flex justify-center py-2">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Subtle Background Ring */}
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
                      <span className="text-xs text-slate-400 font-bold uppercase truncate max-w-[120px] block">
                        {hoveredCategory.category_name}
                      </span>
                      <span className="text-lg font-black text-slate-900 dark:text-white font-mono block">
                        {hoveredCategory.percentage.toFixed(1)}%
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium block">
                        {currency} {formatAmount(hoveredCategory.total_amount)}
                      </span>
                    </div>
                  ) : (
                    <div className="animate-in fade-in duration-150">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                        {breakdownType === 'expense' ? 'Total Spent' : 'Total Inflow'}
                      </span>
                      <span className="text-base font-black text-slate-900 dark:text-white font-mono truncate max-w-[120px] block mt-0.5">
                        {currency} {formatAmount(totalAmount)}
                      </span>
                      <span className="text-xs text-slate-400 block mt-0.5">
                        {breakdowns.length} categories
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Category Rows (Clean, Spaced, High-Contrast Fintech List) */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 pt-1">
              {breakdowns.map((cat, idx) => {
                const catColor = getCategoryColor(cat, idx);
                const isHovered = hoveredCategory && (hoveredCategory.category_id === cat.category_id || hoveredCategory.category_name === cat.category_name);

                return (
                  <div
                    key={cat.category_id}
                    onMouseEnter={() => setHoveredCategory({ ...cat, color: catColor })}
                    onMouseLeave={() => setHoveredCategory(null)}
                    className={`py-3 flex items-center justify-between -mx-2 px-2.5 rounded-xl transition-all cursor-pointer ${
                      isHovered
                        ? 'bg-slate-100/80 dark:bg-slate-700/50'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-700/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: catColor }}
                      >
                        <CategoryIcon name={cat.icon || 'Tag'} className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {cat.category_name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {cat.count} {cat.count === 1 ? 'transaction' : 'transactions'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-extrabold text-xs text-slate-900 dark:text-white font-mono">
                        {currency} {formatAmount(cat.total_amount)}
                      </div>
                      <div
                        className="inline-block px-2 py-0.5 rounded-md text-xs font-bold font-mono mt-0.5"
                        style={{
                          backgroundColor: `${catColor}18`,
                          color: catColor,
                        }}
                      >
                        {cat.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400">
            No transaction records found for this period.
          </div>
        )}
      </div>

      {/* 3. DAILY EXPENSE CALENDAR (EXPENSES BY DATE) */}
      <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-4">
        {/* Header: Title and Month Navigation */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-500" />
              <span>Expense Calendar</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Daily spending breakdown by date
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
              }}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-bold font-mono px-2 py-1 text-slate-800 dark:text-slate-200 min-w-[105px] text-center">
              {calendarMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>

            <button
              onClick={() => {
                setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
              }}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                const now = new Date();
                setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelectedCalendarDate(now.toISOString().split('T')[0]);
              }}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-1 py-1"
            >
              Today
            </button>
          </div>
        </div>

        {/* Monthly Summary Strip */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block">Total Spent in Month</span>
            <span className="font-extrabold text-sm text-rose-600 dark:text-rose-400 font-mono">
              -{currency} {formatAmount(monthTotalExpense)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block">Active Spending Days</span>
            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
              {activeSpendingDaysCount} days
            </span>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {calendarGrid.map((item, idx) => {
            if (!item.isCurrentMonth) {
              return <div key={idx} className="h-14 rounded-xl" />;
            }

            const isSelected = selectedCalendarDate === item.dateKey;
            const hasExpense = item.totalExpense > 0;

            // Calculate intensity for heatmap
            let bgStyle = 'bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300';
            if (hasExpense && maxDailyExpense > 0) {
              const ratio = item.totalExpense / maxDailyExpense;
              if (ratio > 0.6) {
                bgStyle = 'bg-rose-500 text-white font-bold shadow-xs';
              } else if (ratio > 0.25) {
                bgStyle = 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200/80 dark:border-rose-900/60';
              } else {
                bgStyle = 'bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-950/40';
              }
            }

            return (
              <button
                key={item.dateKey}
                type="button"
                onClick={() => setSelectedCalendarDate(item.dateKey)}
                className={`h-14 rounded-xl p-1 flex flex-col justify-between items-center transition-all text-xs relative ${bgStyle} ${
                  isSelected
                    ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-900 font-bold'
                    : 'hover:scale-105 active:scale-95'
                }`}
              >
                {/* Day number */}
                <span className={`text-xs ${item.isToday ? 'font-black underline decoration-emerald-500 decoration-2' : ''}`}>
                  {item.dayNumber}
                </span>

                {/* Amount snippet or dot indicator */}
                {hasExpense ? (
                  <span className="text-xs font-mono leading-none truncate max-w-full font-bold">
                    {item.totalExpense >= 1000
                      ? `${(item.totalExpense / 1000).toFixed(1)}k`
                      : item.totalExpense.toFixed(0)}
                  </span>
                ) : (
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mb-0.5 opacity-40" />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Date Expense List Card */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>{formattedSelectedDate}</span>
              {selectedDateData && (
                <span className="text-xs text-rose-500 font-mono font-bold">
                  (-{currency} {formatAmount(selectedDateData.total)})
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">
              {selectedDateData ? `${selectedDateData.count} expense${selectedDateData.count === 1 ? '' : 's'}` : 'No spending'}
            </span>
          </div>

          {selectedDateData && selectedDateData.transactions.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {selectedDateData.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: tx.category?.color || '#EF4444' }}
                    >
                      <CategoryIcon name={tx.category?.icon || 'Tag'} className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {tx.note || tx.category?.name || 'Expense'}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {tx.category?.name} {tx.account?.name ? `• ${tx.account.name}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="font-bold text-rose-600 dark:text-rose-400 font-mono shrink-0 ml-2">
                    -{currency} {formatAmount(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/60 dark:border-emerald-900/30 text-center text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              🎉 Zero expenses on this day! All savings retained.
            </div>
          )}
        </div>
      </div>

      {/* 4. CASH FLOW & MONTHLY TRENDS (DUAL VIEW TOGGLE: IN/OUT vs NET) */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-emerald-500" />
              <span>Cash Flow Trends (6 Months)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {hoveredMonth ? (
                <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
                  {hoveredMonth.month}: +{currency}{formatAmount(hoveredMonth.income)} In, -{currency}{formatAmount(hoveredMonth.expense)} Out
                </span>
              ) : (
                'Monthly cash flow overview'
              )}
            </p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-700/60 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setTrendView('split')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                trendView === 'split' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              In / Out
            </button>
            <button
              onClick={() => setTrendView('net')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                trendView === 'net' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              Net Flow
            </button>
          </div>
        </div>

        {/* Dynamic Bar Charts */}
        <div className="grid grid-cols-6 gap-2 pt-6 pb-2 items-end h-44">
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
                  <div className="w-full flex items-end justify-center gap-1.5 h-28 group-hover:opacity-90">
                    <div
                      className="w-2.5 bg-emerald-500 rounded-t-sm transition-all shadow-xs"
                      style={{ height: `${Math.max(incHeight, 4)}%` }}
                    />
                    <div
                      className="w-2.5 bg-rose-500 rounded-t-sm transition-all shadow-xs"
                      style={{ height: `${Math.max(expHeight, 4)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white mt-2 font-medium truncate w-full text-center transition-colors">
                    {trend.month.split(' ')[0]}
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
                  <div className="w-full flex items-end justify-center h-28">
                    <div
                      className={`w-3.5 rounded-t-sm transition-all shadow-xs ${
                        isPositive ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ height: `${Math.max(netHeight, 6)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white mt-2 font-medium truncate w-full text-center transition-colors">
                    {trend.month.split(' ')[0]}
                  </span>
                </div>
              );
            }
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
          {trendView === 'split' ? (
            <>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                Cash In
              </span>
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                Cash Out
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                Net Surplus (+)
              </span>
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                Net Deficit (-)
              </span>
            </>
          )}
        </div>
      </div>

      {/* 4. PAYMENT METHODS BREAKDOWN & WEEKLY RHYTHM */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Payment Method Distribution */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-500" />
              <span>Payment Methods</span>
            </h3>

            {insights.payment_methods.length > 0 ? (
              <div className="space-y-2.5 pt-1">
                {insights.payment_methods.map((method, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center">
                          {getMethodIcon(method.method)}
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {method.method}
                        </span>
                        <span className="text-xs text-slate-400">({method.count} tx)</span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white font-mono">
                        {currency} {formatAmount(method.amount)}
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(method.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                No expense methods recorded yet.
              </div>
            )}
          </div>

          {/* Weekly Spending Rhythm (Day of Week) */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-500" />
                <span>Weekly Rhythm</span>
              </h3>
              {insights.peak_spending_day && insights.peak_spending_day !== 'None' && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold border border-amber-200/60 dark:border-amber-900/40 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-500" />
                  Peak: {insights.peak_spending_day}
                </span>
              )}
            </div>

            {/* 7 Days Bar representation */}
            <div className="grid grid-cols-7 gap-1.5 pt-4 pb-1 items-end h-28">
              {insights.day_of_week_stats.map((dayStat, idx) => {
                const maxDayExp = Math.max(
                  ...insights.day_of_week_stats.map((d) => d.expense),
                  1
                );
                const isPeak = dayStat.day === insights.peak_spending_day && dayStat.expense > 0;
                const barHeight = Math.round((dayStat.expense / maxDayExp) * 100);

                return (
                  <div key={idx} className="flex flex-col items-center h-full justify-end group">
                    <div className="w-full flex items-end justify-center h-16">
                      <div
                        className={`w-3.5 rounded-t-sm transition-all ${
                          isPeak
                            ? 'bg-amber-500 shadow-xs shadow-amber-500/30'
                            : 'bg-slate-200 dark:bg-slate-700 group-hover:bg-slate-300 dark:group-hover:bg-slate-600'
                        }`}
                        style={{ height: `${Math.max(barHeight, 8)}%` }}
                        title={`${dayStat.day}: ${currency} ${formatAmount(dayStat.expense)}`}
                      />
                    </div>
                    <span className={`text-xs mt-1.5 font-bold ${
                      isPeak ? 'text-amber-500' : 'text-slate-400'
                    }`}>
                      {dayStat.day}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-center text-slate-400 pt-1">
              Distribution of expenses across days of the week
            </div>
          </div>
        </div>
      )}

      {/* 5. TOP EXPENSE SPIKES (LARGEST OUTFLOWS) */}
      {insights && insights.top_expenses.length > 0 && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-rose-500" />
              <span>Largest Expenses in Period</span>
            </h3>
            <span className="text-xs text-slate-400">Top 5 outliers</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {insights.top_expenses.map((tx) => (
              <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs shrink-0"
                    style={{ backgroundColor: tx.color || '#EF4444' }}
                  >
                    <CategoryIcon name={tx.icon || 'ArrowUpRight'} className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                      {tx.note || tx.category_name}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span>{tx.category_name}</span>
                      <span>•</span>
                      <span>{new Date(tx.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="font-bold text-rose-600 dark:text-rose-400 font-mono text-xs">
                  -{currency} {formatAmount(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Currency Converter Modal */}
      <CurrencyConverterModal
        isOpen={isConverterOpen}
        onClose={() => setIsConverterOpen(false)}
        defaultCurrency={currency}
      />
    </div>
  );
}
