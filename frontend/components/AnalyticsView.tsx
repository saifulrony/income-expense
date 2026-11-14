'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { 
  CategoryBreakdown, 
  MonthlyTrend, 
  User, 
  SummaryData, 
  AnalyticsInsights,
  PaymentMethodStat,
  DayOfWeekStat,
  TopExpenseItem
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

export default function AnalyticsView({ currency, user, summary, activeAccountId }: AnalyticsViewProps) {
  const [breakdownType, setBreakdownType] = useState<'expense' | 'income'>('expense');
  const [period, setPeriod] = useState<string>('this_month');
  const [trendView, setTrendView] = useState<'split' | 'net'>('split');
  const [hoveredMonth, setHoveredMonth] = useState<MonthlyTrend | null>(null);
  const [categoryViewMode, setCategoryViewMode] = useState<'bar' | 'donut'>('bar');
  const [hoveredCategory, setHoveredCategory] = useState<CategoryBreakdown | null>(null);

  const [breakdowns, setBreakdowns] = useState<CategoryBreakdown[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [insights, setInsights] = useState<AnalyticsInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConverterOpen, setIsConverterOpen] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [breakdownType, period, activeAccountId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [catData, trendsData, insightsData] = await Promise.all([
        api.getCategoryBreakdown(breakdownType, period, activeAccountId),
        api.getMonthlyTrends(activeAccountId),
        api.getAnalyticsInsights(period, activeAccountId).catch(() => null),
      ]);
      setBreakdowns(catData.breakdowns || []);
      setTotalAmount(catData.total || 0);
      setMonthlyTrends(trendsData.trends || []);
      if (insightsData) {
        setInsights(insightsData);
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

  // Pre-calculate clean, non-overlapping donut slices
  const donutSlices = React.useMemo(() => {
    let currentOffset = 0;
    const gap = breakdowns.length > 1 ? 1.5 : 0; // Clean hairline separator between categories
    return breakdowns.map((cat) => {
      const rawLength = (cat.percentage / 100) * circumference;
      const sliceLength = Math.max(0, rawLength - gap);
      const dashOffset = -currentOffset;
      currentOffset += rawLength;
      return {
        ...cat,
        sliceLength,
        dashOffset,
      };
    });
  }, [breakdowns, circumference]);

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
          <p className="text-[11px] text-slate-400">Cash velocity, habits & performance</p>
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
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Savings & Capital Health</span>
              </div>
              <div className="text-2xl font-black mt-1 tracking-tight flex items-baseline gap-2">
                <span>{insights.savings_rate.toFixed(1)}%</span>
                <span className="text-xs font-medium text-slate-400">savings rate</span>
              </div>
            </div>

            {/* Health Badge */}
            <div className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
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
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span className="text-emerald-400 font-semibold">● Net Retained</span>
              <span className="text-rose-400 font-semibold">● Consumed Flow</span>
            </div>
          </div>

          {/* Sub KPIs Grid: Daily Burn Rate & Projected Month-End */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700/60 text-xs">
            <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/40">
              <div className="text-[10px] text-slate-400 font-medium">Daily Burn Rate</div>
              <div className="font-extrabold text-sm text-slate-100 font-mono mt-0.5">
                {currency} {formatAmount(insights.daily_average_expense)}
                <span className="text-[10px] font-normal text-slate-400 font-sans"> / day</span>
              </div>
              <div className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
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
                <span>vs prev period</span>
              </div>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/40">
              <div className="text-[10px] text-slate-400 font-medium">Paced Projection</div>
              <div className="font-extrabold text-sm text-slate-100 font-mono mt-0.5">
                {currency} {formatAmount(insights.projected_month_expense)}
              </div>
              <div className="text-[9px] text-slate-400 mt-1">
                estimated month close
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. CATEGORY BREAKDOWN (REVOLUT / APPLE CARD FINTECH STYLE) */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-4">
        {/* Header with Title, Outflow/Inflow Toggle, and Bar/Ring View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Category Distribution
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {currency} {formatAmount(totalAmount)}
              <span className="text-[11px] font-medium text-slate-400 font-sans ml-2">
                total {breakdownType === 'expense' ? 'spent' : 'received'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Style Switcher (Spectrum Bar vs Donut Ring) */}
            <div className="flex bg-slate-100 dark:bg-slate-700/60 p-0.5 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setCategoryViewMode('bar')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  categoryViewMode === 'bar'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Spectrum Bar View"
              >
                Bar
              </button>
              <button
                onClick={() => setCategoryViewMode('donut')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  categoryViewMode === 'donut'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Donut Ring View"
              >
                Ring
              </button>
            </div>

            {/* Out vs In Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-700/60 p-0.5 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setBreakdownType('expense')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  breakdownType === 'expense'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-rose-600'
                }`}
              >
                Cash Out
              </button>
              <button
                onClick={() => setBreakdownType('income')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  breakdownType === 'income'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'
                }`}
              >
                Cash In
              </button>
            </div>
          </div>
        </div>

        {breakdowns.length > 0 ? (
          <div className="space-y-4">
            {/* Visual Representation Area */}
            {categoryViewMode === 'bar' ? (
              /* Spectrum Bar View (Clean, Modern, Space-Efficient) */
              <div className="space-y-2 pt-1">
                <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                  {breakdowns.map((cat, idx) => (
                    <div
                      key={cat.category_id || idx}
                      onMouseEnter={() => setHoveredCategory(cat)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className="h-full rounded-full transition-all duration-300 cursor-pointer hover:opacity-80"
                      style={{
                        width: `${Math.max(cat.percentage, 2)}%`,
                        backgroundColor: cat.color || '#3B82F6',
                      }}
                      title={`${cat.category_name}: ${cat.percentage.toFixed(1)}% (${currency} ${formatAmount(cat.total_amount)})`}
                    />
                  ))}
                </div>
                {hoveredCategory && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between px-1 animate-in fade-in">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {hoveredCategory.category_name}
                    </span>
                    <span className="font-mono">
                      {currency} {formatAmount(hoveredCategory.total_amount)} ({hoveredCategory.percentage.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Refined Donut View (Delicate 7px stroke with centered typography) */
              <div className="flex justify-center py-2">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="7"
                      className="text-slate-100 dark:text-slate-700/40"
                    />
                    {donutSlices.map((slice, idx) => (
                      <circle
                        key={slice.category_id || idx}
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke={slice.color || '#3B82F6'}
                        strokeWidth="7"
                        strokeDasharray={`${slice.sliceLength} ${circumference}`}
                        strokeDashoffset={slice.dashOffset}
                        strokeLinecap="butt"
                        className="transition-all duration-500 hover:opacity-80 cursor-pointer"
                        onMouseEnter={() => setHoveredCategory(slice)}
                        onMouseLeave={() => setHoveredCategory(null)}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2 pointer-events-none">
                    {hoveredCategory ? (
                      <>
                        <span className="text-[10px] text-slate-400 font-semibold truncate max-w-[100px]">
                          {hoveredCategory.category_name}
                        </span>
                        <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {hoveredCategory.percentage.toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {currency} {formatAmount(hoveredCategory.total_amount)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Total</span>
                        <span className="text-xs font-black text-slate-900 dark:text-white font-mono truncate max-w-[100px]">
                          {currency} {formatAmount(totalAmount)}
                        </span>
                        <span className="text-[9px] text-slate-400">{breakdowns.length} categories</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Category Rows (Clean, Spaced, High-Contrast Fintech List) */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 pt-1">
              {breakdowns.map((cat) => (
                <div
                  key={cat.category_id}
                  className="py-3 flex items-center justify-between group hover:bg-slate-50/60 dark:hover:bg-slate-700/30 -mx-2 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: cat.color || '#3B82F6' }}
                    >
                      <CategoryIcon name={cat.icon || 'Tag'} className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {cat.category_name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {cat.count} {cat.count === 1 ? 'transaction' : 'transactions'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-extrabold text-xs text-slate-900 dark:text-white font-mono">
                      {currency} {formatAmount(cat.total_amount)}
                    </div>
                    <div
                      className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold font-mono mt-0.5"
                      style={{
                        backgroundColor: `${cat.color || '#3B82F6'}18`,
                        color: cat.color || '#3B82F6',
                      }}
                    >
                      {cat.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400">
            No transaction records found for this period.
          </div>
        )}
      </div>

      {/* 3. CASH FLOW & MONTHLY TRENDS (DUAL VIEW TOGGLE: IN/OUT vs NET) */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-emerald-500" />
              <span>Cash Flow Trends (6 Months)</span>
            </h3>
            <p className="text-[10px] text-slate-400">
              {hoveredMonth ? (
                <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
                  {hoveredMonth.month}: +{currency}{formatAmount(hoveredMonth.income)} In, -{currency}{formatAmount(hoveredMonth.expense)} Out (Net: {hoveredMonth.net >= 0 ? '+' : ''}{currency}{formatAmount(hoveredMonth.net)})
                </span>
              ) : (
                'Hover or tap bar for exact figures'
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
                  <span className="text-[10px] text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white mt-2 font-medium truncate w-full text-center transition-colors">
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
                  <span className="text-[10px] text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white mt-2 font-medium truncate w-full text-center transition-colors">
                    {trend.month.split(' ')[0]}
                  </span>
                </div>
              );
            }
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[11px]">
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
                        <span className="text-[10px] text-slate-400">({method.count} tx)</span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white font-mono">
                        {currency} {formatAmount(method.amount)}
                      </div>
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
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold border border-amber-200/60 dark:border-amber-900/40 flex items-center gap-1">
                  <Flame className="w-2.5 h-2.5 text-amber-500" />
                  Peak: {insights.peak_spending_day}
                </span>
              )}
            </div>

            {/* 7 Days Bar representation */}
            <div className="grid grid-cols-7 gap-1 pt-4 pb-1 items-end h-28">
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
                        className={`w-3 rounded-t-sm transition-all ${
                          isPeak
                            ? 'bg-amber-500 shadow-sm shadow-amber-500/30'
                            : 'bg-slate-200 dark:bg-slate-700 group-hover:bg-slate-300 dark:group-hover:bg-slate-600'
                        }`}
                        style={{ height: `${Math.max(barHeight, 8)}%` }}
                        title={`${dayStat.day}: ${currency} ${formatAmount(dayStat.expense)}`}
                      />
                    </div>
                    <span className={`text-[10px] mt-1.5 font-bold ${
                      isPeak ? 'text-amber-500' : 'text-slate-400'
                    }`}>
                      {dayStat.day}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-center text-slate-400 pt-1">
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
            <span className="text-[10px] text-slate-400">Top 5 outliers</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {insights.top_expenses.map((tx) => (
              <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-[11px] shrink-0"
                    style={{ backgroundColor: tx.color || '#EF4444' }}
                  >
                    <CategoryIcon name={tx.icon || 'ArrowUpRight'} className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {tx.note || tx.category_name}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
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
