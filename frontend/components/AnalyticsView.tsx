'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CategoryBreakdown, MonthlyTrend } from '@/lib/types';
import { CategoryIcon } from './CategoryIcons';
import { TrendingUp, PieChart, BarChart2, ShieldCheck, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface AnalyticsViewProps {
  currency: string;
}

export default function AnalyticsView({ currency }: AnalyticsViewProps) {
  const [breakdownType, setBreakdownType] = useState<'expense' | 'income'>('expense');
  const [period, setPeriod] = useState<string>('this_month');
  const [breakdowns, setBreakdowns] = useState<CategoryBreakdown[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [breakdownType, period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [catData, trendsData] = await Promise.all([
        api.getCategoryBreakdown(breakdownType, period),
        api.getMonthlyTrends(),
      ]);
      setBreakdowns(catData.breakdowns || []);
      setTotalAmount(catData.total || 0);
      setMonthlyTrends(trendsData.trends || []);
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

  return (
    <div className="space-y-5 pb-20">
      {/* Header and Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <PieChart className="w-5 h-5 text-emerald-600" />
          Financial Analytics
        </h2>

        {/* Period Selector */}
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-300 outline-none"
        >
          <option value="today">Today</option>
          <option value="this_month">This Month</option>
          <option value="this_year">This Year</option>
        </select>
      </div>

      {/* Cash In vs Cash Out Tab Toggle */}
      <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
        <button
          onClick={() => setBreakdownType('expense')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            breakdownType === 'expense'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          Expense Breakdown
        </button>
        <button
          onClick={() => setBreakdownType('income')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            breakdownType === 'income'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          Income Sources
        </button>
      </div>

      {/* Total Section */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">
          Total {breakdownType === 'income' ? 'Cash In' : 'Cash Out'} ({period.replace('_', ' ')})
        </span>
        <span
          className={`text-lg font-bold ${
            breakdownType === 'income' ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {currency} {formatAmount(totalAmount)}
        </span>
      </div>

      {/* Category Breakdown Progress Bars */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Category Distribution
        </h3>

        {breakdowns.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">
            No transaction records found for this period.
          </p>
        ) : (
          <div className="space-y-3.5">
            {breakdowns.map((cat) => (
              <div key={cat.category_id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px]"
                      style={{ backgroundColor: cat.color || '#3B82F6' }}
                    >
                      <CategoryIcon name={cat.icon || 'Tag'} className="w-3 h-3" />
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {cat.category_name}
                    </span>
                    <span className="text-slate-400 text-[10px]">({cat.count} tx)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {currency} {formatAmount(cat.total_amount)}
                    </span>
                    <span className="text-slate-400 ml-1.5 text-[11px] font-mono">
                      {cat.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress track */}
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(cat.percentage, 100)}%`,
                      backgroundColor: cat.color || '#3B82F6',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly Trends (Past 6 Months) */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <BarChart2 className="w-4 h-4 text-emerald-500" />
          Last 6 Months Flow
        </h3>

        <div className="grid grid-cols-6 gap-2 pt-6 pb-2 items-end h-44">
          {monthlyTrends.map((trend, i) => {
            const maxVal = Math.max(
              ...monthlyTrends.map((t) => Math.max(t.income, t.expense)),
              1
            );
            const incHeight = Math.round((trend.income / maxVal) * 100);
            const expHeight = Math.round((trend.expense / maxVal) * 100);

            return (
              <div key={i} className="flex flex-col items-center h-full justify-end group">
                <div className="w-full flex items-end justify-center gap-1 h-28">
                  {/* Income bar */}
                  <div
                    className="w-2.5 bg-emerald-500 rounded-t-sm transition-all"
                    style={{ height: `${Math.max(incHeight, 4)}%` }}
                    title={`Cash In: ${trend.income}`}
                  />
                  {/* Expense bar */}
                  <div
                    className="w-2.5 bg-rose-500 rounded-t-sm transition-all"
                    style={{ height: `${Math.max(expHeight, 4)}%` }}
                    title={`Cash Out: ${trend.expense}`}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-2 font-medium truncate w-full text-center">
                  {trend.month.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[11px]">
          <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            Cash In
          </span>
          <span className="flex items-center gap-1.5 text-rose-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            Cash Out
          </span>
        </div>
      </div>
    </div>
  );
}

