'use client';

import React, { useState, useMemo } from 'react';
import { SummaryData, Transaction, Category } from '@/lib/types';
import { formatAmount } from '@/lib/currency';
import { 
  ChevronDown, 
  X, 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  Coins, 
  CheckCircle2, 
  AlertCircle, 
  BarChart3, 
  Layers, 
  Activity, 
  Scale 
} from 'lucide-react';
import { CategoryIcon } from './CategoryIcons';
import { useFlowLabels } from '@/lib/ui-prefs';
import { useTranslation } from '@/lib/i18n';

interface SummaryCardProps {
  summary?: SummaryData;
  currency?: string;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  onOpenAddModal?: (type: 'income' | 'expense') => void;
  filteredCount?: number;
  transactions?: Transaction[];
  categories?: Category[];
}

export default React.memo(function SummaryCard({
  selectedPeriod,
  onPeriodChange,
  summary,
  currency = '$',
  transactions = [],
  categories = [],
}: SummaryCardProps) {
  const { inLabel, outLabel } = useFlowLabels();
  const { t } = useTranslation();
  const [activeTooltip, setActiveTooltip] = useState<'income' | 'expense' | 'balance' | null>(null);

  // Sub-chart view tabs for each block
  const [incomeTab, setIncomeTab] = useState<'categories' | 'trend' | 'donut'>('categories');
  const [expenseTab, setExpenseTab] = useState<'categories' | 'trend' | 'donut'>('categories');
  const [balanceTab, setBalanceTab] = useState<'gauge' | 'trend' | 'compare'>('gauge');

  // Touch coordinates for horizontal swipe gesture navigation
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = <T extends string>(
    e: React.TouchEvent,
    currentTab: T,
    tabs: readonly T[],
    setTab: (tab: T) => void
  ) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartX;
    setTouchStartX(null);

    // Require at least 40px swipe distance
    if (Math.abs(diffX) > 40) {
      const currentIndex = tabs.indexOf(currentTab);
      if (diffX < 0 && currentIndex < tabs.length - 1) {
        // Swipe Left -> Next View
        setTab(tabs[currentIndex + 1]);
      } else if (diffX > 0 && currentIndex > 0) {
        // Swipe Right -> Previous View
        setTab(tabs[currentIndex - 1]);
      }
    }
  };

  const periods = [
    { id: 'all', label: t('allTime'), shortLabel: t('allShort') },
    { id: 'today', label: t('today'), shortLabel: t('today') },
    { id: 'this_week', label: t('thisWeek'), shortLabel: t('weekShort') },
    { id: 'this_month', label: t('thisMonth'), shortLabel: t('monthShort') },
  ];

  const totalIncome = summary?.total_income || 0;
  const totalExpense = summary?.total_expense || 0;
  const netBalance = summary?.net_balance || 0;
  const isPositive = netBalance >= 0;

  const formattedIn = formatAmount(totalIncome);
  const formattedOut = formatAmount(totalExpense);
  const formattedBal = formatAmount(Math.abs(netBalance));

  const inLen = (currency?.length || 1) + formattedIn.length;
  const outLen = (currency?.length || 1) + formattedOut.length;
  const balLen = (netBalance < 0 ? 1 : 0) + (currency?.length || 1) + formattedBal.length;

  const inWeight = Math.max(8, inLen);
  const outWeight = Math.max(8, outLen);
  const balWeight = Math.max(8, balLen);

  const getMetricSizeClass = (len: number) => {
    if (len >= 14) return 'text-[10px] sm:text-xs tracking-tighter';
    if (len >= 11) return 'text-[11px] sm:text-xs tracking-tight';
    return 'text-xs sm:text-sm';
  };

  // 1. Calculate Income Category Breakdown (lazy: only computed when income drilldown is open)
  const incomeBreakdown = useMemo(() => {
    if (activeTooltip !== 'income') return [];
    const incomeTxs = transactions.filter((t) => t.type === 'income');
    const map = new Map<string, { name: string; icon: string; color: string; total: number; count: number }>();
    
    incomeTxs.forEach((tx) => {
      const catId = tx.category_id || 'other';
      const catObj = categories.find((c) => c.id === tx.category_id) || tx.category;
      const catName = catObj?.name || 'Income';
      const catIcon = catObj?.icon || 'TrendingUp';
      const catColor = catObj?.color || '#10B981';

      if (!map.has(catId)) {
        map.set(catId, { name: catName, icon: catIcon, color: catColor, total: 0, count: 0 });
      }
      const cur = map.get(catId)!;
      cur.total += tx.amount;
      cur.count += 1;
    });

    const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const sum = list.reduce((acc, c) => acc + c.total, 0) || totalIncome || 1;
    return list.map((item) => ({
      ...item,
      percentage: (item.total / sum) * 100,
    }));
  }, [activeTooltip, transactions, categories, totalIncome]);

  // 2. Calculate Expense Category Breakdown (lazy: only computed when expense drilldown is open)
  const expenseBreakdown = useMemo(() => {
    if (activeTooltip !== 'expense') return [];
    const expenseTxs = transactions.filter((t) => t.type === 'expense');
    const map = new Map<string, { name: string; icon: string; color: string; total: number; count: number }>();
    
    expenseTxs.forEach((tx) => {
      const catId = tx.category_id || 'other';
      const catObj = categories.find((c) => c.id === tx.category_id) || tx.category;
      const catName = catObj?.name || 'Expense';
      const catIcon = catObj?.icon || 'Tag';
      const catColor = catObj?.color || '#EF4444';

      if (!map.has(catId)) {
        map.set(catId, { name: catName, icon: catIcon, color: catColor, total: 0, count: 0 });
      }
      const cur = map.get(catId)!;
      cur.total += tx.amount;
      cur.count += 1;
    });

    const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const sum = list.reduce((acc, c) => acc + c.total, 0) || totalExpense || 1;
    return list.map((item) => ({
      ...item,
      percentage: (item.total / sum) * 100,
    }));
  }, [activeTooltip, transactions, categories, totalExpense]);

  // 3. Daily Cash In Trend (lazy: only computed when income drilldown is open)
  const dailyIncomeTrend = useMemo(() => {
    if (activeTooltip !== 'income') return { items: [], max: 1, avg: 0, avgPerTx: 0, count: 0 };
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const map = new Map<string, number>();
    const incomeTxs = transactions.filter((t) => t.type === 'income');
    incomeTxs.forEach((tx) => {
      const d = tx.date ? tx.date.substring(0, 10) : '';
      if (d) {
        map.set(d, (map.get(d) || 0) + tx.amount);
      }
    });
    const sortedDates = Array.from(map.keys()).sort();
    const recentDates = sortedDates.slice(-7);
    const items = recentDates.map((d) => {
      const dateObj = new Date(d);
      const dayLabel = isNaN(dateObj.getTime())
        ? d.slice(5)
        : WEEKDAYS[dateObj.getDay()];
      const amount = map.get(d) || 0;
      return { date: d, label: dayLabel, amount };
    });
    const max = Math.max(...items.map((i) => i.amount), 1);
    const avg = items.length > 0 ? items.reduce((s, i) => s + i.amount, 0) / items.length : 0;
    const avgPerTx = incomeTxs.length > 0 ? totalIncome / incomeTxs.length : 0;
    return { items, max, avg, avgPerTx, count: incomeTxs.length };
  }, [activeTooltip, transactions, totalIncome]);

  // 4. Daily Cash Out Trend (lazy: only computed when expense drilldown is open)
  const dailyExpenseTrend = useMemo(() => {
    if (activeTooltip !== 'expense') return { items: [], max: 1, avg: 0, avgPerTx: 0, count: 0 };
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const map = new Map<string, number>();
    const expenseTxs = transactions.filter((t) => t.type === 'expense');
    expenseTxs.forEach((tx) => {
      const d = tx.date ? tx.date.substring(0, 10) : '';
      if (d) {
        map.set(d, (map.get(d) || 0) + tx.amount);
      }
    });
    const sortedDates = Array.from(map.keys()).sort();
    const recentDates = sortedDates.slice(-7);
    const items = recentDates.map((d) => {
      const dateObj = new Date(d);
      const dayLabel = isNaN(dateObj.getTime())
        ? d.slice(5)
        : WEEKDAYS[dateObj.getDay()];
      const amount = map.get(d) || 0;
      return { date: d, label: dayLabel, amount };
    });
    const max = Math.max(...items.map((i) => i.amount), 1);
    const avg = items.length > 0 ? items.reduce((s, i) => s + i.amount, 0) / items.length : 0;
    const avgPerTx = expenseTxs.length > 0 ? totalExpense / expenseTxs.length : 0;
    return { items, max, avg, avgPerTx, count: expenseTxs.length };
  }, [activeTooltip, transactions, totalExpense]);

  // 5. Balance Ratio, Health & Timeline Flow
  const balanceMetrics = useMemo(() => {
    const totalVolume = totalIncome + totalExpense;
    const incomePercent = totalVolume > 0 ? (totalIncome / totalVolume) * 100 : 50;
    const expensePercent = totalVolume > 0 ? (totalExpense / totalVolume) * 100 : 50;
    
    // Retention/Savings rate (Net / Income)
    let retentionRate = 0;
    if (totalIncome > 0) {
      retentionRate = Math.round(((totalIncome - totalExpense) / totalIncome) * 100);
    } else if (totalExpense > 0) {
      retentionRate = -100;
    }

    const coverage = totalExpense > 0 ? (totalIncome / totalExpense).toFixed(1) : '∞';

    return {
      totalVolume,
      incomePercent,
      expensePercent,
      retentionRate,
      coverage,
    };
  }, [totalIncome, totalExpense]);

  // Cumulative Balance Trajectory Line Points (lazy: only computed when balance drilldown is open)
  const balanceTimeline = useMemo(() => {
    if (activeTooltip !== 'balance') {
      return { points: [], linePath: '', areaPath: '', minVal: 0, maxVal: 0 };
    }
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dateMap = new Map<string, { income: number; expense: number }>();
    transactions.forEach((tx) => {
      const d = tx.date ? tx.date.substring(0, 10) : '';
      if (d) {
        if (!dateMap.has(d)) dateMap.set(d, { income: 0, expense: 0 });
        const cur = dateMap.get(d)!;
        if (tx.type === 'income') cur.income += tx.amount;
        else if (tx.type === 'expense') cur.expense += tx.amount;
      }
    });
    const sortedDates = Array.from(dateMap.keys()).sort();
    let running = 0;
    const pointsData = sortedDates.slice(-8).map((d) => {
      const cur = dateMap.get(d)!;
      running += cur.income - cur.expense;
      const dateObj = new Date(d);
      const label = isNaN(dateObj.getTime()) ? d.slice(5) : WEEKDAYS[dateObj.getDay()];
      return { date: d, label, net: running };
    });

    if (pointsData.length === 0) {
      return { points: [], linePath: '', areaPath: '', minVal: 0, maxVal: 0 };
    }

    const values = pointsData.map((p) => p.net);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 0);
    const range = (maxVal - minVal) || 1;

    const W = 280;
    const H = 75;
    const padX = 14;
    const padY = 12;
    const usableW = W - padX * 2;
    const usableH = H - padY * 2;

    const coords = pointsData.map((pt, i) => {
      const x = pointsData.length === 1 ? W / 2 : padX + (i / (pointsData.length - 1)) * usableW;
      const y = padY + (1 - (pt.net - minVal) / range) * usableH;
      return { ...pt, x, y };
    });

    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const firstX = coords[0].x.toFixed(1);
    const lastX = coords[coords.length - 1].x.toFixed(1);
    const baselineY = (H - 2).toFixed(1);
    const areaPath = `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

    return { points: coords, linePath, areaPath, minVal, maxVal };
  }, [activeTooltip, transactions]);

  // Donut chart slice calculation helper
  const getDonutSlices = (items: { percentage: number; color: string; name: string }[]) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius; // ~188.496
    let accumulated = 0;
    return items.slice(0, 5).map((item) => {
      const sliceLength = (item.percentage / 100) * circumference;
      const offset = -accumulated;
      accumulated += sliceLength;
      return {
        ...item,
        dashArray: `${sliceLength.toFixed(2)} ${(circumference - sliceLength).toFixed(2)}`,
        dashOffset: offset.toFixed(2),
      };
    });
  };

  const incomeDonutSlices = useMemo(() => getDonutSlices(incomeBreakdown), [incomeBreakdown]);
  const expenseDonutSlices = useMemo(() => getDonutSlices(expenseBreakdown), [expenseBreakdown]);

  return (
    <div
      className={`summary-card-cockpit rounded-[10px] p-3 shadow-xs space-y-3 transition-colors duration-200 border ${
        isPositive
          ? 'cockpit-positive bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/90 dark:border-emerald-800/50'
          : 'cockpit-negative bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/90 dark:border-rose-800/50'
      }`}
      style={{
        backgroundColor: isPositive ? '#f0fdf4' : '#fff1f2',
        borderColor: isPositive ? '#bbf7d0' : '#fecdd3',
      }}
    >
      {/* 1. Inset Segmented Time Selection Bar */}
      <div
        className={`period-selector-track flex items-center justify-between gap-1 p-1 rounded-lg border transition-colors ${
          isPositive
            ? 'bg-emerald-100/60 dark:bg-emerald-950/60 border-emerald-200/60 dark:border-emerald-800/40'
            : 'bg-rose-100/60 dark:bg-rose-950/60 border-rose-200/60 dark:border-rose-800/40'
        }`}
      >
        {periods.map((p) => {
          const isSelected = selectedPeriod === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onPeriodChange(p.id)}
              className={`period-btn flex-1 py-1.5 px-1 min-w-0 rounded-lg text-xs transition-all text-center whitespace-nowrap overflow-hidden ${
                isSelected
                  ? isPositive
                    ? 'period-btn-active bg-emerald-500 dark:bg-emerald-500 text-white dark:text-white font-black shadow-sm border border-emerald-400/60'
                    : 'period-btn-active bg-rose-500 dark:bg-rose-500 text-white dark:text-white font-black shadow-sm border border-rose-400/60'
                  : isPositive
                  ? 'border border-transparent text-emerald-950/70 dark:text-emerald-300/80 hover:text-emerald-950 dark:hover:text-emerald-100 font-semibold'
                  : 'border border-transparent text-rose-950/70 dark:text-rose-300/80 hover:text-rose-950 dark:hover:text-rose-100 font-semibold'
              }`}
            >
              <span className={`period-label-full truncate ${isSelected ? 'text-white font-black' : ''}`}>{p.label}</span>
              <span className={`period-label-short truncate hidden ${isSelected ? 'text-white font-black' : ''}`}>{p.shortLabel || p.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Interactive 3-Column Summary Cockpit with Drilldown Triggers */}
      <div
        style={{
          gridTemplateColumns: `${inWeight}fr ${outWeight}fr ${balWeight}fr`,
        }}
        className={`grid divide-x pt-1 text-center ${
          isPositive
            ? 'divide-emerald-200/70 dark:divide-emerald-800/50'
            : 'divide-rose-200/70 dark:divide-rose-800/50'
        }`}
      >
        {/* Block 1: Cash In */}
        <div
          onClick={() => setActiveTooltip((prev) => (prev === 'income' ? null : 'income'))}
          className={`px-1 py-1 rounded-md cursor-pointer transition-all select-none group min-w-0 overflow-hidden ${
            activeTooltip === 'income'
              ? 'bg-emerald-500/15 ring-2 ring-emerald-500/40'
              : 'hover:bg-emerald-500/10'
          }`}
          title="Tap to view Cash In charts"
        >
          <span
            className={`text-[10px] uppercase tracking-wider block leading-tight flex items-center justify-center gap-0.5 sm:gap-1 transition-colors ${
              activeTooltip === 'income'
                ? 'text-emerald-700 dark:text-emerald-300 font-black'
                : isPositive
                ? 'text-emerald-900/70 dark:text-emerald-400/80 font-bold'
                : 'text-rose-900/70 dark:text-rose-400/80 font-bold'
            }`}
          >
            <span className="whitespace-nowrap">{inLabel}</span>
            <ChevronDown
              className={`w-3 h-3 shrink-0 transition-transform duration-200 ${
                activeTooltip === 'income' ? 'rotate-180 text-emerald-600 dark:text-emerald-300 stroke-[2.5]' : 'text-slate-400 opacity-60'
              }`}
            />
          </span>
          <span className={`${getMetricSizeClass(inLen)} font-bold font-mono mt-0.5 block whitespace-nowrap transition-colors ${
            activeTooltip === 'income'
              ? 'text-emerald-600 dark:text-emerald-300 font-black'
              : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            <span className="currency-symbol">{currency}</span>{formattedIn}
          </span>
        </div>

        {/* Block 2: Cash Out */}
        <div
          onClick={() => setActiveTooltip((prev) => (prev === 'expense' ? null : 'expense'))}
          className={`px-1 py-1 rounded-md cursor-pointer transition-all select-none group min-w-0 overflow-hidden ${
            activeTooltip === 'expense'
              ? 'bg-rose-500/15 ring-2 ring-rose-500/40'
              : 'hover:bg-rose-500/10'
          }`}
          title="Tap to view Cash Out charts"
        >
          <span
            className={`text-[10px] uppercase tracking-wider block leading-tight flex items-center justify-center gap-0.5 sm:gap-1 transition-colors ${
              activeTooltip === 'expense'
                ? 'text-rose-700 dark:text-rose-300 font-black'
                : isPositive
                ? 'text-emerald-900/70 dark:text-emerald-400/80 font-bold'
                : 'text-rose-900/70 dark:text-rose-400/80 font-bold'
            }`}
          >
            <span className="whitespace-nowrap">{outLabel}</span>
            <ChevronDown
              className={`w-3 h-3 shrink-0 transition-transform duration-200 ${
                activeTooltip === 'expense' ? 'rotate-180 text-rose-600 dark:text-rose-300 stroke-[2.5]' : 'text-slate-400 opacity-60'
              }`}
            />
          </span>
          <span className={`${getMetricSizeClass(outLen)} font-bold font-mono mt-0.5 block whitespace-nowrap transition-colors ${
            activeTooltip === 'expense'
              ? 'text-rose-600 dark:text-rose-300 font-black'
              : 'text-rose-600 dark:text-rose-400'
          }`}>
            <span className="currency-symbol">{currency}</span>{formattedOut}
          </span>
        </div>

        {/* Block 3: Net Balance */}
        <div
          onClick={() => setActiveTooltip((prev) => (prev === 'balance' ? null : 'balance'))}
          className={`px-1 py-1 rounded-md cursor-pointer transition-all select-none group min-w-0 overflow-hidden ${
            activeTooltip === 'balance'
              ? 'bg-indigo-500/15 ring-2 ring-indigo-500/40'
              : 'hover:bg-indigo-500/10'
          }`}
          title="Tap to view Balance flow chart"
        >
          <span
            className={`text-[10px] uppercase tracking-wider block leading-tight flex items-center justify-center gap-0.5 sm:gap-1 transition-colors ${
              activeTooltip === 'balance'
                ? 'text-indigo-700 dark:text-indigo-300 font-black'
                : isPositive
                ? 'text-emerald-900/70 dark:text-emerald-400/80 font-bold'
                : 'text-rose-900/70 dark:text-rose-400/80 font-bold'
            }`}
          >
            <span className="whitespace-nowrap">{t('balance')}</span>
            <ChevronDown
              className={`w-3 h-3 shrink-0 transition-transform duration-200 ${
                activeTooltip === 'balance' ? 'rotate-180 text-indigo-600 dark:text-indigo-300 stroke-[2.5]' : 'text-slate-400 opacity-60'
              }`}
            />
          </span>
          <span
            className={`${getMetricSizeClass(balLen)} font-bold font-mono mt-0.5 block whitespace-nowrap transition-colors ${
              activeTooltip === 'balance'
                ? isPositive
                  ? 'text-emerald-600 dark:text-emerald-200 font-black'
                  : 'text-rose-600 dark:text-rose-200 font-black'
                : isPositive
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {netBalance < 0 ? '-' : ''}<span className="currency-symbol">{currency}</span>{formattedBal}
          </span>
        </div>
      </div>

      {/* 3. Interactive Tooltip Chart Drawer (Appears below on click) */}
      {activeTooltip && (
        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="p-3 bg-white/95 dark:bg-slate-900/95 rounded-[12px] border border-slate-200/90 dark:border-slate-800 shadow-md space-y-3">
            
            {/* Tooltip Top Bar: Icon + Title + Micro-Sparkline + Close Button */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {activeTooltip === 'income' && (
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/70 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                )}
                {activeTooltip === 'expense' && (
                  <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-950/70 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                    <TrendingDown className="w-3.5 h-3.5" />
                  </div>
                )}
                {activeTooltip === 'balance' && (
                  <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950/70 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Scale className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-none truncate">
                    {activeTooltip === 'income' && `${inLabel} Analytics`}
                    {activeTooltip === 'expense' && `${outLabel} Analytics`}
                    {activeTooltip === 'balance' && 'Net Cash Flow & Health'}
                  </h4>
                  <span className="text-[10px] text-slate-400 leading-tight truncate block mt-0.5">
                    {activeTooltip === 'income' && `${incomeBreakdown.length} income channels • ${dailyIncomeTrend.count} txs`}
                    {activeTooltip === 'expense' && `${expenseBreakdown.length} categories • ${dailyExpenseTrend.count} txs`}
                    {activeTooltip === 'balance' && `Inflow vs Outflow • ${balanceMetrics.retentionRate}% Margin`}
                  </span>
                </div>
              </div>

              {/* Right Side: Close Button */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTooltip(null)}
                  className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
                  title="Close chart"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ========================================================
               BLOCK 1: CASH IN CHARTS & SUB-TABS
               ======================================================== */}
            {activeTooltip === 'income' && (
              <div 
                className="space-y-3"
                onTouchStart={handleTouchStart}
                onTouchEnd={(e) => handleTouchEnd(e, incomeTab, ['categories', 'trend', 'donut'] as const, setIncomeTab)}
              >
                {/* Chart Mode Segmented Selector */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setIncomeTab('categories')}
                    className={`flex-1 py-1 px-1.5 rounded-md transition-all text-center flex items-center justify-center gap-1 whitespace-nowrap ${
                      incomeTab === 'categories'
                        ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-white font-black shadow-xs ring-1 ring-emerald-400/40'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                    }`}
                  >
                    <Layers className="w-3 h-3 shrink-0" />
                    <span>Categories</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomeTab('trend')}
                    className={`flex-1 py-1 px-1.5 rounded-md transition-all text-center flex items-center justify-center gap-1 whitespace-nowrap ${
                      incomeTab === 'trend'
                        ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-white font-black shadow-xs ring-1 ring-emerald-400/40'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                    }`}
                  >
                    <BarChart3 className="w-3 h-3 shrink-0" />
                    <span>Daily Trend</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomeTab('donut')}
                    className={`flex-1 py-1 px-1.5 rounded-md transition-all text-center flex items-center justify-center gap-1 whitespace-nowrap ${
                      incomeTab === 'donut'
                        ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-white font-black shadow-xs ring-1 ring-emerald-400/40'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                    }`}
                  >
                    <PieChart className="w-3 h-3 shrink-0" />
                    <span>Donut</span>
                  </button>
                </div>

                {/* Sub-view A: Categories List & Segmented Bar (Uniform h-[108px]) */}
                {incomeTab === 'categories' && (
                  <div className="h-[108px] flex flex-col justify-start space-y-1.5 animate-in fade-in duration-200">
                    {incomeBreakdown.length > 0 ? (
                      <>
                        <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 shrink-0">
                          {incomeBreakdown.map((item, idx) => (
                            <div
                              key={idx}
                              style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                              title={`${item.name}: ${item.percentage.toFixed(0)}%`}
                              className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                            />
                          ))}
                        </div>

                        <div className="space-y-1 pt-0.5 flex-1 overflow-y-auto pr-1">
                          {incomeBreakdown.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 text-[10px]"
                                  style={{ backgroundColor: item.color }}
                                >
                                  <CategoryIcon name={item.icon} className="w-3 h-3" />
                                </div>
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {item.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                                  <span className="currency-symbol">{currency}</span>{formatAmount(item.total)}
                                </span>
                                <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {item.percentage.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="h-full text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                        <Coins className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        <span>No Cash In records found for this period.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-view B: Daily Cash In Trend Bar Chart (Uniform h-[108px]) */}
                {incomeTab === 'trend' && (
                  <div className="h-[108px] flex flex-col justify-between animate-in fade-in duration-200">
                    {dailyIncomeTrend.items.length > 0 ? (
                      <>
                        <div className="flex items-end justify-between gap-1.5 h-[84px] px-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                          {dailyIncomeTrend.items.map((item, idx) => {
                            const heightPercent = dailyIncomeTrend.max > 0 ? Math.max(8, (item.amount / dailyIncomeTrend.max) * 85) : 8;
                            const isPeak = item.amount === dailyIncomeTrend.max && dailyIncomeTrend.max > 0;
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                <div className="absolute -top-6 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-mono whitespace-nowrap shadow-md">
                                    {currency}{formatAmount(item.amount)}
                                  </span>
                                </div>
                                <div
                                  style={{ height: `${heightPercent}%` }}
                                  className={`w-full max-w-[22px] rounded-t-md transition-all duration-500 ${
                                    isPeak 
                                      ? 'bg-emerald-500 dark:bg-emerald-400 shadow-sm shadow-emerald-500/30' 
                                      : 'bg-emerald-200/90 dark:bg-emerald-900/60 hover:bg-emerald-400'
                                  }`}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between px-1 text-[9px] font-mono text-slate-400">
                          {dailyIncomeTrend.items.map((item, idx) => (
                            <span key={idx} className="flex-1 text-center truncate">{item.label}</span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="h-full text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                        <BarChart3 className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        <span>No timeline trend data available yet.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-view C: Income Donut Ring & Distribution (Uniform h-[108px]) */}
                {incomeTab === 'donut' && (
                  <div className="h-[108px] flex flex-col justify-center animate-in fade-in duration-200">
                    {incomeDonutSlices.length > 0 ? (
                      <div className="flex items-center justify-around">
                        <div className="relative w-[88px] h-[88px] flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 80 80" className="w-full h-full transform -rotate-90">
                            <circle
                              cx="40"
                              cy="40"
                              r="30"
                              fill="none"
                              stroke="currentColor"
                              className="text-slate-100 dark:text-slate-800"
                              strokeWidth="8"
                            />
                            {incomeDonutSlices.map((slice, i) => (
                              <circle
                                key={i}
                                cx="40"
                                cy="40"
                                r="30"
                                fill="none"
                                stroke={slice.color}
                                strokeWidth="8"
                                strokeDasharray={slice.dashArray}
                                strokeDashoffset={slice.dashOffset}
                                className="transition-all duration-700"
                              />
                            ))}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-100">
                              {incomeDonutSlices[0]?.percentage.toFixed(0)}%
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold uppercase truncate max-w-[50px]">
                              {incomeDonutSlices[0]?.name || 'Top'}
                            </span>
                          </div>
                        </div>

                        {/* Top Category Legend */}
                        <div className="space-y-1.5 flex-1 pl-3 min-w-0">
                          {incomeDonutSlices.slice(0, 3).map((slice, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5 truncate pr-1">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{slice.name}</span>
                              </div>
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 shrink-0">
                                {slice.percentage.toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                        <PieChart className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        <span>No distribution data available yet.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Carousel Swipe Pagination Dots Indicator */}
                <div className="flex items-center justify-center gap-1.5 pt-0.5">
                  {(['categories', 'trend', 'donut'] as const).map((tabKey) => (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => setIncomeTab(tabKey)}
                      aria-label={`Switch to ${tabKey}`}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        incomeTab === tabKey
                          ? 'w-5 bg-emerald-500'
                          : 'w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300'
                      }`}
                    />
                  ))}
                </div>

                {/* Key Metrics Stats Footer */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <div className="px-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Avg / Record</span>
                    <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {currency}{formatAmount(dailyIncomeTrend.avgPerTx)}
                    </span>
                  </div>
                  <div className="px-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Daily Avg</span>
                    <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {currency}{formatAmount(dailyIncomeTrend.avg)}
                    </span>
                  </div>
                  <div className="px-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Top Channel</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate block">
                      {incomeBreakdown[0]?.name || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================
               BLOCK 2: CASH OUT CHARTS & SUB-TABS
               ======================================================== */}
            {activeTooltip === 'expense' && (
              <div 
                className="space-y-3"
                onTouchStart={handleTouchStart}
                onTouchEnd={(e) => handleTouchEnd(e, expenseTab, ['categories', 'trend', 'donut'] as const, setExpenseTab)}
              >
                {/* Chart Mode Segmented Selector */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setExpenseTab('categories')}
                    className={`flex-1 py-1 px-1.5 rounded-md transition-all text-center flex items-center justify-center gap-1 whitespace-nowrap ${
                      expenseTab === 'categories'
                        ? 'bg-rose-600 dark:bg-rose-500 text-white dark:text-white font-black shadow-xs ring-1 ring-rose-400/40'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                    }`}
                  >
                    <Layers className="w-3 h-3 shrink-0" />
                    <span>Categories</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseTab('trend')}
                    className={`flex-1 py-1 px-1.5 rounded-md transition-all text-center flex items-center justify-center gap-1 whitespace-nowrap ${
                      expenseTab === 'trend'
                        ? 'bg-rose-600 dark:bg-rose-500 text-white dark:text-white font-black shadow-xs ring-1 ring-rose-400/40'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                    }`}
                  >
                    <BarChart3 className="w-3 h-3 shrink-0" />
                    <span>Daily Burn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseTab('donut')}
                    className={`flex-1 py-1 px-1.5 rounded-md transition-all text-center flex items-center justify-center gap-1 whitespace-nowrap ${
                      expenseTab === 'donut'
                        ? 'bg-rose-600 dark:bg-rose-500 text-white dark:text-white font-black shadow-xs ring-1 ring-rose-400/40'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                    }`}
                  >
                    <PieChart className="w-3 h-3 shrink-0" />
                    <span>Donut</span>
                  </button>
                </div>

                {/* Sub-view A: Categories List & Segmented Bar (Uniform h-[108px]) */}
                {expenseTab === 'categories' && (
                  <div className="h-[108px] flex flex-col justify-start space-y-1.5 animate-in fade-in duration-200">
                    {expenseBreakdown.length > 0 ? (
                      <>
                        <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 shrink-0">
                          {expenseBreakdown.map((item, idx) => (
                            <div
                              key={idx}
                              style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                              title={`${item.name}: ${item.percentage.toFixed(0)}%`}
                              className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                            />
                          ))}
                        </div>

                        <div className="space-y-1 pt-0.5 flex-1 overflow-y-auto pr-1">
                          {expenseBreakdown.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 text-[10px]"
                                  style={{ backgroundColor: item.color }}
                                >
                                  <CategoryIcon name={item.icon} className="w-3 h-3" />
                                </div>
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {item.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
                                  <span className="currency-symbol">{currency}</span>{formatAmount(item.total)}
                                </span>
                                <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {item.percentage.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="h-full text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                        <Coins className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        <span>No Cash Out records found for this period.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-view B: Daily Cash Out Burn Rate Bar Chart (Uniform h-[108px]) */}
                {expenseTab === 'trend' && (
                  <div className="h-[108px] flex flex-col justify-between animate-in fade-in duration-200">
                    {dailyExpenseTrend.items.length > 0 ? (
                      <>
                        <div className="flex items-end justify-between gap-1.5 h-[84px] px-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                          {dailyExpenseTrend.items.map((item, idx) => {
                            const heightPercent = dailyExpenseTrend.max > 0 ? Math.max(8, (item.amount / dailyExpenseTrend.max) * 85) : 8;
                            const isPeak = item.amount === dailyExpenseTrend.max && dailyExpenseTrend.max > 0;
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                <div className="absolute -top-6 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-mono whitespace-nowrap shadow-md">
                                    {currency}{formatAmount(item.amount)}
                                  </span>
                                </div>
                                <div
                                  style={{ height: `${heightPercent}%` }}
                                  className={`w-full max-w-[22px] rounded-t-md transition-all duration-500 ${
                                    isPeak 
                                      ? 'bg-rose-500 dark:bg-rose-400 shadow-sm shadow-rose-500/30' 
                                      : 'bg-rose-200/90 dark:bg-rose-900/60 hover:bg-rose-400'
                                  }`}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between px-1 text-[9px] font-mono text-slate-400">
                          {dailyExpenseTrend.items.map((item, idx) => (
                            <span key={idx} className="flex-1 text-center truncate">{item.label}</span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="h-full text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                        <BarChart3 className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        <span>No expense timeline data available yet.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-view C: Expense Donut Ring (Uniform h-[108px]) */}
                {expenseTab === 'donut' && (
                  <div className="h-[108px] flex flex-col justify-center animate-in fade-in duration-200">
                    {expenseDonutSlices.length > 0 ? (
                      <div className="flex items-center justify-around">
                        <div className="relative w-[88px] h-[88px] flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 80 80" className="w-full h-full transform -rotate-90">
                            <circle
                              cx="40"
                              cy="40"
                              r="30"
                              fill="none"
                              stroke="currentColor"
                              className="text-slate-100 dark:text-slate-800"
                              strokeWidth="8"
                            />
                            {expenseDonutSlices.map((slice, i) => (
                              <circle
                                key={i}
                                cx="40"
                                cy="40"
                                r="30"
                                fill="none"
                                stroke={slice.color}
                                strokeWidth="8"
                                strokeDasharray={slice.dashArray}
                                strokeDashoffset={slice.dashOffset}
                                className="transition-all duration-700"
                              />
                            ))}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-100">
                              {expenseDonutSlices[0]?.percentage.toFixed(0)}%
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold uppercase truncate max-w-[50px]">
                              {expenseDonutSlices[0]?.name || 'Top'}
                            </span>
                          </div>
                        </div>

                        {/* Top Category Legend */}
                        <div className="space-y-1.5 flex-1 pl-3 min-w-0">
                          {expenseDonutSlices.slice(0, 3).map((slice, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5 truncate pr-1">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{slice.name}</span>
                              </div>
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 shrink-0">
                                {slice.percentage.toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                        <PieChart className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        <span>No distribution data available yet.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Carousel Swipe Pagination Dots Indicator */}
                <div className="flex items-center justify-center gap-1.5 pt-0.5">
                  {(['categories', 'trend', 'donut'] as const).map((tabKey) => (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => setExpenseTab(tabKey)}
                      aria-label={`Switch to ${tabKey}`}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        expenseTab === tabKey
                          ? 'w-5 bg-rose-500'
                          : 'w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300'
                      }`}
                    />
                  ))}
                </div>

                {/* Key Metrics Stats Footer */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <div className="px-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Avg / Expense</span>
                    <span className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400">
                      {currency}{formatAmount(dailyExpenseTrend.avgPerTx)}
                    </span>
                  </div>
                  <div className="px-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Daily Burn</span>
                    <span className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400">
                      {currency}{formatAmount(dailyExpenseTrend.avg)}
                    </span>
                  </div>
                  <div className="px-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Top Spend</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate block">
                      {expenseBreakdown[0]?.name || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================
               BLOCK 3: BALANCE CHARTS & SUB-TABS
               ======================================================== */}
            {activeTooltip === 'balance' && (
              <div 
                className="space-y-3"
                onTouchStart={handleTouchStart}
                onTouchEnd={(e) => handleTouchEnd(e, balanceTab, ['gauge', 'trend', 'compare'] as const, setBalanceTab)}
              >
                {/* Chart Mode Segmented Selector */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setBalanceTab('gauge')}
                    className={`flex-1 py-1 px-1.5 rounded-md transition-all text-center flex items-center justify-center gap-1 whitespace-nowrap ${
                      balanceTab === 'gauge'
                        ? 'bg-indigo-600 dark:bg-indigo-500 text-white dark:text-white font-black shadow-xs ring-1 ring-indigo-400/40'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                    }`}
                  >
                    <Activity className="w-3 h-3 shrink-0" />
                    <span>Margin Arc</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceTab('trend')}
                    className={`flex-1 py-1 px-1.5 rounded-md transition-all text-center flex items-center justify-center gap-1 whitespace-nowrap ${
                      balanceTab === 'trend'
                        ? 'bg-indigo-600 dark:bg-indigo-500 text-white dark:text-white font-black shadow-xs ring-1 ring-indigo-400/40'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                    }`}
                  >
                    <TrendingUp className="w-3 h-3 shrink-0" />
                    <span>Net Flow</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceTab('compare')}
                    className={`flex-1 py-1 px-1.5 rounded-md transition-all text-center flex items-center justify-center gap-1 whitespace-nowrap ${
                      balanceTab === 'compare'
                        ? 'bg-indigo-600 dark:bg-indigo-500 text-white dark:text-white font-black shadow-xs ring-1 ring-indigo-400/40'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold'
                    }`}
                  >
                    <BarChart3 className="w-3 h-3 shrink-0" />
                    <span>Compare</span>
                  </button>
                </div>

                {/* Sub-view A: Dribbble Arc Gauge & Health (Uniform h-[108px]) */}
                {balanceTab === 'gauge' && (
                  <div className="h-[108px] flex flex-col justify-between animate-in fade-in duration-200">
                    <div className="flex items-center justify-around">
                      <div className="relative w-28 h-[56px] flex items-end justify-center overflow-hidden shrink-0">
                        <svg viewBox="0 0 100 55" className="w-full h-full">
                          <path
                            d="M 10 50 A 40 40 0 0 1 90 50"
                            fill="none"
                            stroke="currentColor"
                            className="text-slate-200 dark:text-slate-800"
                            strokeWidth="9"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 10 50 A 40 40 0 0 1 90 50"
                            fill="none"
                            stroke={isPositive ? '#10B981' : '#EF4444'}
                            strokeWidth="9"
                            strokeLinecap="round"
                            strokeDasharray={125.66}
                            strokeDashoffset={125.66 - (Math.max(0, Math.min(100, Math.abs(balanceMetrics.retentionRate))) / 100) * 125.66}
                            className="transition-all duration-700 ease-out"
                          />
                        </svg>
                        <div className="absolute bottom-0 inset-x-0 flex flex-col items-center justify-center">
                          <span className="text-xs font-black font-mono leading-none tracking-tight text-slate-900 dark:text-white">
                            {balanceMetrics.retentionRate > 0 ? `+${balanceMetrics.retentionRate}%` : `${balanceMetrics.retentionRate}%`}
                          </span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">
                            Net Margin
                          </span>
                        </div>
                      </div>

                      <div className="space-y-0.5 text-left pl-2">
                        <div className="flex items-center gap-1.5">
                          {isPositive ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {isPositive ? 'Surplus Positive' : 'Deficit Outflow'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight max-w-[140px]">
                          {isPositive 
                            ? 'Cash In covers spending with surplus retained.'
                            : 'Spending outpaces income. Reduce burn or boost inflow.'}
                        </p>
                      </div>
                    </div>

                    {/* 2-Tone Inflow vs Outflow Volume Distribution Bar */}
                    <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Inflow: {balanceMetrics.incomePercent.toFixed(0)}%
                        </span>
                        <span className="text-rose-600 dark:text-rose-400">
                          Outflow: {balanceMetrics.expensePercent.toFixed(0)}%
                        </span>
                      </div>

                      <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                        <div
                          style={{ width: `${balanceMetrics.incomePercent}%` }}
                          className="bg-emerald-500 h-full transition-all duration-500"
                          title={`Inflow: ${balanceMetrics.incomePercent.toFixed(0)}%`}
                        />
                        <div
                          style={{ width: `${balanceMetrics.expensePercent}%` }}
                          className="bg-rose-500 h-full transition-all duration-500"
                          title={`Outflow: ${balanceMetrics.expensePercent.toFixed(0)}%`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-view B: Cumulative Net Cash Flow Curve (Uniform h-[108px]) */}
                {balanceTab === 'trend' && (
                  <div className="h-[108px] flex flex-col justify-between animate-in fade-in duration-200">
                    {balanceTimeline.points.length > 0 ? (
                      <>
                        <div className="h-[82px] w-full relative">
                          <svg viewBox="0 0 280 75" className="w-full h-full overflow-visible">
                            <defs>
                              <linearGradient id="balanceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0.35" />
                                <stop offset="100%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            <path d={balanceTimeline.areaPath} fill="url(#balanceAreaGrad)" />
                            <path
                              d={balanceTimeline.linePath}
                              fill="none"
                              stroke={isPositive ? '#10B981' : '#EF4444'}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {balanceTimeline.points.map((pt, i) => (
                              <circle
                                key={i}
                                cx={pt.x}
                                cy={pt.y}
                                r="3"
                                fill={isPositive ? '#10B981' : '#EF4444'}
                                stroke="#ffffff"
                                strokeWidth="1.5"
                              />
                            ))}
                          </svg>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 px-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span>{balanceTimeline.points[0]?.label || 'Start'}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            Cumulative: {isPositive ? '+' : ''}{currency}{formatAmount(netBalance)}
                          </span>
                          <span>{balanceTimeline.points[balanceTimeline.points.length - 1]?.label || 'Now'}</span>
                        </div>
                      </>
                    ) : (
                      <div className="h-full text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                        <TrendingUp className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        <span>No timeline flow data available yet.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-view C: Dual-Pillar Inflow vs Outflow Comparison (Uniform h-[108px]) */}
                {balanceTab === 'compare' && (
                  <div className="h-[108px] flex flex-col justify-between animate-in fade-in duration-200">
                    <div className="flex items-end justify-center gap-6 h-[82px] px-4 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                      {/* Inflow Pillar */}
                      <div className="flex-1 flex flex-col items-center justify-end h-full">
                        <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                          {currency}{formatAmount(totalIncome)}
                        </span>
                        <div
                          style={{
                            height: `${Math.max(10, (totalIncome / (Math.max(totalIncome, totalExpense) || 1)) * 46)}px`,
                          }}
                          className="w-full max-w-[44px] rounded-t-md bg-emerald-500 dark:bg-emerald-400 shadow-sm shadow-emerald-500/20 transition-all duration-500"
                        />
                        <span className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Inflow</span>
                      </div>

                      {/* Center Delta Badge */}
                      <div className="flex flex-col items-center justify-center mb-3">
                        <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono border ${
                          isPositive
                            ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300/60'
                            : 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300/60'
                        }`}>
                          {isPositive ? `+${currency}${formatAmount(netBalance)}` : `-${currency}${formatAmount(Math.abs(netBalance))}`}
                        </div>
                        <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">Net Delta</span>
                      </div>

                      {/* Outflow Pillar */}
                      <div className="flex-1 flex flex-col items-center justify-end h-full">
                        <span className="text-[9px] font-mono font-bold text-rose-600 dark:text-rose-400 mb-0.5">
                          {currency}{formatAmount(totalExpense)}
                        </span>
                        <div
                          style={{
                            height: `${Math.max(10, (totalExpense / (Math.max(totalIncome, totalExpense) || 1)) * 46)}px`,
                          }}
                          className="w-full max-w-[44px] rounded-t-md bg-rose-500 dark:bg-rose-400 shadow-sm shadow-rose-500/20 transition-all duration-500"
                        />
                        <span className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Outflow</span>
                      </div>
                    </div>

                    <div className="text-center text-[10px] text-slate-400 font-medium">
                      Inflow Coverage: <strong className="text-slate-700 dark:text-slate-200">{balanceMetrics.coverage}x</strong> • Volume: <strong className="font-mono text-slate-700 dark:text-slate-200">{currency}{formatAmount(balanceMetrics.totalVolume)}</strong>
                    </div>
                  </div>
                )}

                {/* Carousel Swipe Pagination Dots Indicator */}
                <div className="flex items-center justify-center gap-1.5 pt-0.5">
                  {(['gauge', 'trend', 'compare'] as const).map((tabKey) => (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => setBalanceTab(tabKey)}
                      aria-label={`Switch to ${tabKey}`}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        balanceTab === tabKey
                          ? 'w-5 bg-indigo-500'
                          : 'w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300'
                      }`}
                    />
                  ))}
                </div>

                {/* Key Metrics Stats Footer */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <div className="px-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Savings Rate</span>
                    <span className={`text-xs font-bold font-mono ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {balanceMetrics.retentionRate}%
                    </span>
                  </div>
                  <div className="px-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Coverage</span>
                    <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                      {balanceMetrics.coverage}x
                    </span>
                  </div>
                  <div className="px-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Cash Status</span>
                    <span className={`text-xs font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {isPositive ? 'Surplus' : 'Deficit'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
