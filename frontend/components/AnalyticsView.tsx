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
import { getCurrencySymbol } from '@/lib/currency';
import { 
  PieChart, 
  BarChart2, 
  Coins, 
  FileText,
  CreditCard,
  Wallet,
  Calendar,
  Flame,
  Building,
  Smartphone
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
  const [isConverterOpen, setIsConverterOpen] = useState(false);

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

      setBreakdowns(localCat);
      setTotalAmount(localCat.reduce((sum, b) => sum + b.total_amount, 0));
      setMonthlyTrends(localTrends);
      setInsights(localInsights);
      setPeriodSummary(localSum);
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
    <div className="space-y-3.5 pb-24">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <PieChart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Analytics</span>
        </h2>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsConverterOpen(true)}
            className="p-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-amber-600 dark:text-amber-400 shadow-xs hover:bg-slate-50 transition-all"
            title="Currency Converter"
          >
            <Coins className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => generateFinancialStatementPDF(user, summary, [], period)}
            className="p-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-indigo-600 dark:text-indigo-400 shadow-xs hover:bg-slate-50 transition-all"
            title="Download PDF"
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
              +{symbol}{formatAmount(periodSummary.total_income)}
            </span>
          </div>

          {/* Outflow */}
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
              Outflow
            </span>
            <span className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5 block truncate">
              -{symbol}{formatAmount(periodSummary.total_expense)}
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
              {periodSummary.net_balance >= 0 ? '+' : '-'}{symbol}{formatAmount(Math.abs(periodSummary.net_balance))}
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
                {symbol}{formatAmount(insights.daily_average_expense)}/d
              </span>
            </div>
          </div>
        )}
      </div>

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
                        {symbol}{formatAmount(hoveredCategory.total_amount)}
                      </span>
                    </div>
                  ) : (
                    <div className="animate-in fade-in duration-150">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Total
                      </span>
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono truncate max-w-[110px] block mt-0.5">
                        {symbol}{formatAmount(totalAmount)}
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
                        {symbol}{formatAmount(cat.total_amount)}
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
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold">
                • {hoveredMonth.month.split(' ')[0]}
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
                  <div className="w-full flex items-end justify-center h-24">
                    <div
                      className={`w-3 rounded-t-sm transition-all ${
                        isPositive ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ height: `${Math.max(netHeight, 6)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white mt-1.5 font-medium truncate w-full text-center transition-colors">
                    {trend.month.split(' ')[0]}
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
                        {symbol}{formatAmount(method.amount)}
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

      {/* 5. TOP EXPENSE OUTFLOWS */}
      {insights && insights.top_expenses.length > 0 && (
        <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
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
                    -{symbol}{formatAmount(tx.amount)}
                  </span>
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
