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
import { useTranslation, useTranslateCategory } from '@/lib/i18n';
import { useFlowLabels } from '@/lib/ui-prefs';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { 
  PieChart, 
  BarChart2, 
  FileText,
  Download,
  X,
  CreditCard,
  Wallet,
  Calendar,
  Flame,
  Building,
  Smartphone,
  TrendingUp,
  TrendingDown,
  Target,
  Trophy,
  HandCoins,
  Scale,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Clock
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
  transactions?: Transaction[];
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

// Smooth cubic Bezier spline path generator for area and line charts
function getSmoothPath(points: { x: number; y: number }[]): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export interface DebtsSummaryStats {
  receivableTotal: number;
  receivableCollected: number;
  receivableRemaining: number;
  receivablePct: number;
  payableTotal: number;
  payableRepaid: number;
  payableRemaining: number;
  payablePct: number;
  netPosition: number;
  settledCount: number;
  totalCount: number;
}

export interface GoalsSummaryStats {
  totalTarget: number;
  totalAchieved: number;
  portfolioPct: number;
  totalGoalsCount: number;
  completedGoalsCount: number;
  goalsList: Array<{
    id: string;
    title: string;
    color: string;
    target_amount: number;
    currentAmount: number;
    pct: number;
    remaining: number;
  }>;
}

export interface WarrantiesSummaryStats {
  totalCount: number;
  activeCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  totalValue: number;
  nextExpiringItem: {
    product_name: string;
    daysLeft: number;
    expiry_date: string;
  } | null;
}

export default function AnalyticsView({
  currency,
  user,
  summary,
  activeAccountId,
  transactions: propTransactions,
}: AnalyticsViewProps) {
  const symbol = getCurrencySymbol(currency);
  const { t } = useTranslation();
  const tCat = useTranslateCategory();
  const { inLabel, outLabel } = useFlowLabels();
  const [breakdownType, setBreakdownType] = useState<'expense' | 'income'>('expense');
  const [period, setPeriod] = useState<string>('all');
  const [comparePeriod, setComparePeriod] = useState<string>('this_month');
  const [trendView, setTrendView] = useState<'split' | 'net'>('split');
  const [chartType, setChartType] = useState<'area' | 'line' | 'bars'>('area');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<MonthlyTrend | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<CategoryBreakdown | null>(null);

  const [debtsStats, setDebtsStats] = useState<DebtsSummaryStats | null>(null);
  const [goalsStats, setGoalsStats] = useState<GoalsSummaryStats | null>(null);
  const [warrantiesStats, setWarrantiesStats] = useState<WarrantiesSummaryStats | null>(null);

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
  }, [breakdownType, period, activeAccountId, propTransactions, comparePeriod]);

  const handleComparePeriodChange = (newPeriod: string) => {
    triggerHaptic('light');
    setComparePeriod(newPeriod);
    const allTxs =
      propTransactions && propTransactions.length > 0
        ? propTransactions
        : OfflineStorage.getTransactions({ account_id: activeAccountId });
    setPeriodComparison(computePeriodComparison(allTxs, newPeriod));
  };

  const loadAnalytics = async () => {
    try {
      const allTxs =
        propTransactions && propTransactions.length > 0
          ? propTransactions
          : OfflineStorage.getTransactions({ account_id: activeAccountId });

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
      setPeriodComparison(computePeriodComparison(allTxs, comparePeriod));

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

      // 1B. Loans & Debts Analysis
      try {
        if (typeof window !== 'undefined') {
          let rawDebts = localStorage.getItem('cashflow_debts_tracker');
          let parsedDebts: any[] = [];
          if (!rawDebts) {
            // Seed initial sample debt tracker if not created yet
            parsedDebts = [
              {
                id: 'debt_sample_1',
                person_name: 'Personal Loan Record',
                direction: 'receivable',
                total_amount: 5000,
                paid_amount: 2000,
                due_date: '2026-12-15',
                note: 'Personal loan tracker',
                is_settled: false,
                created_at: new Date().toISOString(),
              },
            ];
            try {
              localStorage.setItem('cashflow_debts_tracker', JSON.stringify(parsedDebts));
            } catch {}
          } else {
            try {
              parsedDebts = JSON.parse(rawDebts);
            } catch {
              parsedDebts = [];
            }
          }

          let recTotal = 0, recColl = 0, payTotal = 0, payRep = 0, settled = 0;
          parsedDebts.forEach((d) => {
            const tot = Number(d.total_amount) || 0;
            const paid = Number(d.paid_amount) || 0;
            const isSettled = d.is_settled || paid >= tot;
            if (isSettled) settled++;
            if (d.direction === 'receivable') {
              recTotal += tot;
              recColl += paid;
            } else {
              payTotal += tot;
              payRep += paid;
            }
          });
          const recRem = Math.max(0, recTotal - recColl);
          const payRem = Math.max(0, payTotal - payRep);
          setDebtsStats({
            receivableTotal: recTotal,
            receivableCollected: recColl,
            receivableRemaining: recRem,
            receivablePct: recTotal > 0 ? Math.min(100, Math.round((recColl / recTotal) * 100)) : 0,
            payableTotal: payTotal,
            payableRepaid: payRep,
            payableRemaining: payRem,
            payablePct: payTotal > 0 ? Math.min(100, Math.round((payRep / payTotal) * 100)) : 0,
            netPosition: recRem - payRem,
            settledCount: settled,
            totalCount: parsedDebts.length,
          });
        }
      } catch (err) {
        console.error('Failed to compute debts stats:', err);
      }

      // 1C. Financial Goals Analysis
      try {
        if (typeof window !== 'undefined') {
          let rawGoals = localStorage.getItem('cashflow_dynamic_goals_v2');
          let parsedGoals: any[] = [];
          if (!rawGoals) {
            // Seed initial dynamic goals based on real numbers if not created yet
            const netTarget = Math.max(50000, Math.ceil(((localSum.net_balance > 0 ? localSum.net_balance : 25000) * 1.5) / 5000) * 5000);
            parsedGoals = [
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
                target_amount: 20000,
                source: 'monthly_savings',
                allocation_pct: 100,
                color: '#3B82F6',
                created_at: new Date().toISOString(),
              },
            ];
            try {
              localStorage.setItem('cashflow_dynamic_goals_v2', JSON.stringify(parsedGoals));
            } catch {}
          } else {
            try {
              parsedGoals = JSON.parse(rawGoals);
            } catch {
              parsedGoals = [];
            }
          }

          const netBal = localSum.net_balance >= 0 ? localSum.net_balance : 0;
          let totTarget = 0;
          let totAchieved = 0;
          let completedCount = 0;

          const goalsList = parsedGoals.map((g: any) => {
            const target = Number(g.target_amount) || 0;
            totTarget += target;
            let currentAmount = 0;
            if (g.source === 'monthly_savings') {
              currentAmount = Math.max(0, localSum.total_income - localSum.total_expense);
            } else if (g.source === 'monthly_income') {
              currentAmount = localSum.total_income;
            } else {
              const factor = (Number(g.allocation_pct) || 100) / 100;
              currentAmount = Math.max(0, netBal * factor);
            }
            totAchieved += currentAmount;
            const pct = target > 0 ? Math.min(100, Math.round((currentAmount / target) * 100)) : 0;
            if (pct >= 100) completedCount++;
            return {
              id: g.id || String(Math.random()),
              title: g.title || 'Goal',
              color: g.color || '#10B981',
              target_amount: target,
              currentAmount,
              pct,
              remaining: Math.max(0, target - currentAmount),
            };
          });

          setGoalsStats({
            totalTarget: totTarget,
            totalAchieved: totAchieved,
            portfolioPct: totTarget > 0 ? Math.min(100, Math.round((totAchieved / totTarget) * 100)) : 0,
            totalGoalsCount: parsedGoals.length,
            completedGoalsCount: completedCount,
            goalsList: goalsList.slice(0, 4),
          });
        }
      } catch (err) {
        console.error('Failed to compute goals stats:', err);
      }

      // 1D. Warranties & Asset Protection Analysis
      try {
        if (typeof window !== 'undefined') {
          let rawWarranties = localStorage.getItem('cashflow_warranties_tracker');
          let parsedWarranties: any[] = [];
          if (!rawWarranties) {
            const today = new Date();
            const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()).toISOString().slice(0, 10);
            parsedWarranties = [
              {
                id: 'war_sample_1',
                product_name: 'Washing Machine / Home Appliance',
                brand_or_store: 'Official Brand Store',
                price: 35000,
                purchase_date: today.toISOString().slice(0, 10),
                expiry_date: nextYear,
                serial_or_invoice: 'INV-2026-8821',
                note: 'Appliance warranty card',
                created_at: new Date().toISOString(),
              },
            ];
            try {
              localStorage.setItem('cashflow_warranties_tracker', JSON.stringify(parsedWarranties));
            } catch {}
          } else {
            try {
              parsedWarranties = JSON.parse(rawWarranties);
            } catch {
              parsedWarranties = [];
            }
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let active = 0, expSoon = 0, expired = 0, totalVal = 0;
          let nextExpItem: any = null;
          let minPositiveDays = Infinity;

          parsedWarranties.forEach((w: any) => {
            totalVal += Number(w.price) || 0;
            if (w.expiry_date) {
              const exp = new Date(w.expiry_date);
              exp.setHours(0, 0, 0, 0);
              const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays < 0) {
                expired++;
              } else if (diffDays <= 30) {
                expSoon++;
                if (diffDays < minPositiveDays) {
                  minPositiveDays = diffDays;
                  nextExpItem = { product_name: w.product_name, daysLeft: diffDays, expiry_date: w.expiry_date };
                }
              } else {
                active++;
                if (diffDays < minPositiveDays) {
                  minPositiveDays = diffDays;
                  nextExpItem = { product_name: w.product_name, daysLeft: diffDays, expiry_date: w.expiry_date };
                }
              }
            } else {
              active++;
            }
          });

          setWarrantiesStats({
            totalCount: parsedWarranties.length,
            activeCount: active,
            expiringSoonCount: expSoon,
            expiredCount: expired,
            totalValue: totalVal,
            nextExpiringItem: nextExpItem,
          });
        }
      } catch (err) {
        console.error('Failed to compute warranties stats:', err);
      }

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
            <option value="all">{t('allTime')}</option>
            <option value="this_month">{t('thisMonth')}</option>
            <option value="this_week">{t('thisWeek')}</option>
            <option value="today">{t('today')}</option>
            <option value="this_year">{t('thisYear')}</option>
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
              {inLabel}
            </span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block truncate">
              <span className="currency-symbol">{symbol}</span>{formatAmount(periodSummary.total_income)}
            </span>
          </div>

          {/* Outflow */}
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
              {outLabel}
            </span>
            <span className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5 block truncate">
              <span className="currency-symbol">{symbol}</span>{formatAmount(periodSummary.total_expense)}
            </span>
          </div>

          {/* Net */}
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
              {t('net')}
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
              <span className="text-slate-400">{t('savingsHealth')}</span>
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
      <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-3.5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate">
              Period Comparison
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline">
              • vs Previous
            </span>
          </div>

          {/* Interactive Period Switcher Pills with live active indicator */}
          <div className="flex items-center gap-1 shrink-0">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'this_week', label: 'Week' },
                { id: 'this_month', label: 'Month' },
                { id: 'this_year', label: 'Year' },
              ] as const
            ).map((p) => {
              const isActive = comparePeriod === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleComparePeriodChange(p.id)}
                  className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {periodComparison && periodComparison.hasData ? (
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
                      : periodComparison.prevIncome === 0 && periodComparison.currIncome > 0
                      ? 'New'
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
                      : periodComparison.prevExpense === 0 && periodComparison.currExpense > 0
                      ? 'New'
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
                {periodComparison.hasPrevData
                  ? periodComparison.expenseDiff <= 0
                    ? `You spent ${symbol}${formatAmount(Math.abs(periodComparison.expenseDiff))} less than ${periodComparison.prevLabel}${periodComparison.expensePct !== null ? ` (${Math.abs(periodComparison.expensePct)}% saved)` : ''}`
                    : `You spent ${symbol}${formatAmount(periodComparison.expenseDiff)} more than ${periodComparison.prevLabel}${periodComparison.expensePct !== null ? ` (+${periodComparison.expensePct}%)` : ''}`
                  : periodComparison.currCount > 0
                  ? `You spent ${symbol}${formatAmount(periodComparison.currExpense)} in ${periodComparison.currentLabel} (${periodComparison.currCount} records; no records in ${periodComparison.prevLabel} to compare against yet)`
                  : periodComparison.emptyText}
              </span>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-slate-400 leading-relaxed py-1">
            {periodComparison?.emptyText || 'No transactions found for this period comparison.'}
          </p>
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
                        {tCat(hoveredCategory.category_name)}
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
                        {tCat(cat.category_name)}
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

      {/* 3. CASH FLOW & FINANCIAL TRENDS (AREA / LINE / BARS + IN-OUT / NET) */}
      <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
        {/* Header with Title, Mode Switcher, and Chart Type Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate">
              Financial Trends (6M)
            </span>
            {hoveredMonth && (
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold animate-in fade-in duration-100 hidden sm:inline">
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

          <div className="flex items-center gap-1.5">
            {/* Chart Type Selector: Area | Line | Bars */}
            <div className="flex bg-slate-100 dark:bg-slate-700/60 p-0.5 rounded-md text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChartType('area')}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  chartType === 'area'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title="Area Chart with smooth gradient"
              >
                Area
              </button>
              <button
                type="button"
                onClick={() => setChartType('line')}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  chartType === 'line'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title="Line Chart with spline curves"
              >
                Line
              </button>
              <button
                type="button"
                onClick={() => setChartType('bars')}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  chartType === 'bars'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title="Classic Bar Chart"
              >
                Bars
              </button>
            </div>

            {/* In/Out vs Net Switcher */}
            <div className="flex bg-slate-100 dark:bg-slate-700/60 p-0.5 rounded-md text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTrendView('split')}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  trendView === 'split' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-400'
                }`}
              >
                In/Out
              </button>
              <button
                type="button"
                onClick={() => setTrendView('net')}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  trendView === 'net' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-400'
                }`}
              >
                Net
              </button>
            </div>
          </div>
        </div>

        {/* Hovered Month stats for mobile view */}
        {hoveredMonth && (
          <div className="sm:hidden px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-[11px] font-mono flex items-center justify-between">
            <span className="font-bold text-slate-600 dark:text-slate-300">{formatMonthLabel(hoveredMonth.month)}</span>
            {trendView === 'split' ? (
              <div className="flex items-center gap-2 font-bold">
                <span className="text-emerald-600 dark:text-emerald-400">+{symbol}{formatAmount(hoveredMonth.income)}</span>
                <span className="text-rose-600 dark:text-rose-400">-{symbol}{formatAmount(hoveredMonth.expense)}</span>
              </div>
            ) : (
              <span className={`font-bold ${hoveredMonth.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {hoveredMonth.net >= 0 ? '+' : '-'}{symbol}{formatAmount(Math.abs(hoveredMonth.net))}
              </span>
            )}
          </div>
        )}

        {/* 3A. Area / Line SVG Curves */}
        {monthlyTrends.length > 0 && (chartType === 'area' || chartType === 'line') && (() => {
          const w = 340;
          const h = 136;
          const padLeft = 24;
          const padRight = 24;
          const padTop = 18;
          const padBottom = 26;
          const plotW = w - padLeft - padRight;
          const plotH = h - padTop - padBottom;
          const count = monthlyTrends.length;
          const getX = (i: number) => padLeft + (i / Math.max(1, count - 1)) * plotW;
          const baselineY = h - padBottom;

          if (trendView === 'split') {
            const maxVal = Math.max(...monthlyTrends.map((t) => Math.max(t.income, t.expense)), 100);
            const incPoints = monthlyTrends.map((t, i) => ({
              x: getX(i),
              y: padTop + (1 - (t.income / maxVal)) * plotH,
            }));
            const expPoints = monthlyTrends.map((t, i) => ({
              x: getX(i),
              y: padTop + (1 - (t.expense / maxVal)) * plotH,
            }));

            const incLine = getSmoothPath(incPoints);
            const expLine = getSmoothPath(expPoints);
            const incArea = `${incLine} L ${incPoints[incPoints.length - 1].x.toFixed(1)} ${baselineY} L ${incPoints[0].x.toFixed(1)} ${baselineY} Z`;
            const expArea = `${expLine} L ${expPoints[expPoints.length - 1].x.toFixed(1)} ${baselineY} L ${expPoints[0].x.toFixed(1)} ${baselineY} Z`;

            return (
              <div className="relative pt-1 pb-1">
                <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36 overflow-visible select-none">
                  <defs>
                    <linearGradient id="areaIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.38" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="areaExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid guide lines */}
                  <line x1={padLeft} y1={padTop} x2={w - padRight} y2={padTop} stroke="currentColor" strokeDasharray="3 3" className="text-slate-200 dark:text-slate-700/50" strokeWidth="0.75" />
                  <line x1={padLeft} y1={padTop + plotH / 2} x2={w - padRight} y2={padTop + plotH / 2} stroke="currentColor" strokeDasharray="3 3" className="text-slate-200 dark:text-slate-700/50" strokeWidth="0.75" />
                  <line x1={padLeft} y1={baselineY} x2={w - padRight} y2={baselineY} stroke="currentColor" className="text-slate-200 dark:text-slate-700/80" strokeWidth="1" />

                  {/* Area Fills */}
                  {chartType === 'area' && (
                    <>
                      <path d={incArea} fill="url(#areaIncomeGrad)" />
                      <path d={expArea} fill="url(#areaExpenseGrad)" />
                    </>
                  )}

                  {/* Curve Strokes */}
                  <path d={incLine} fill="none" stroke="#10B981" strokeWidth={chartType === 'area' ? '2.2' : '2.6'} strokeLinecap="round" strokeLinejoin="round" />
                  <path d={expLine} fill="none" stroke="#F43F5E" strokeWidth={chartType === 'area' ? '2.2' : '2.6'} strokeLinecap="round" strokeLinejoin="round" />

                  {/* Active Month Hairline & Dots */}
                  {hoveredPointIndex !== null && (
                    <>
                      <line
                        x1={getX(hoveredPointIndex)}
                        y1={padTop}
                        x2={getX(hoveredPointIndex)}
                        y2={baselineY}
                        stroke="#94A3B8"
                        strokeDasharray="2 2"
                        strokeWidth="1"
                      />
                      <circle cx={incPoints[hoveredPointIndex].x} cy={incPoints[hoveredPointIndex].y} r="4.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
                      <circle cx={expPoints[hoveredPointIndex].x} cy={expPoints[hoveredPointIndex].y} r="4.5" fill="#F43F5E" stroke="#FFFFFF" strokeWidth="2" />
                    </>
                  )}

                  {/* X-axis Month Labels */}
                  {monthlyTrends.map((t, i) => (
                    <text
                      key={t.month}
                      x={getX(i)}
                      y={h - 8}
                      textAnchor="middle"
                      className={`text-[10px] font-mono select-none transition-colors ${
                        hoveredPointIndex === i
                          ? 'fill-slate-900 dark:fill-white font-black'
                          : 'fill-slate-400 font-semibold'
                      }`}
                    >
                      {formatMonthLabel(t.month)}
                    </text>
                  ))}

                  {/* Transparent Interactive Hover Slices */}
                  {monthlyTrends.map((t, i) => {
                    const sliceW = plotW / count;
                    return (
                      <rect
                        key={`hit_${t.month}`}
                        x={getX(i) - sliceW / 2}
                        y={padTop}
                        width={sliceW}
                        height={plotH + padBottom}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => {
                          setHoveredPointIndex(i);
                          setHoveredMonth(t);
                        }}
                        onMouseLeave={() => {
                          setHoveredPointIndex(null);
                          setHoveredMonth(null);
                        }}
                      />
                    );
                  })}
                </svg>
              </div>
            );
          } else {
            // Net Balance Trend
            const minNet = Math.min(...monthlyTrends.map((t) => t.net), 0);
            const maxNet = Math.max(...monthlyTrends.map((t) => t.net), 0);
            const range = Math.max(maxNet - minNet, 100);
            const zeroY = padTop + (maxNet / range) * plotH;

            const netPoints = monthlyTrends.map((t, i) => ({
              x: getX(i),
              y: padTop + ((maxNet - t.net) / range) * plotH,
            }));

            const netLine = getSmoothPath(netPoints);
            const netArea = `${netLine} L ${netPoints[netPoints.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${netPoints[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;

            return (
              <div className="relative pt-1 pb-1">
                <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36 overflow-visible select-none">
                  <defs>
                    <linearGradient id="areaNetGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity="0.38" />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* Grid & Zero Baseline */}
                  <line x1={padLeft} y1={padTop} x2={w - padRight} y2={padTop} stroke="currentColor" strokeDasharray="3 3" className="text-slate-200 dark:text-slate-700/50" strokeWidth="0.75" />
                  <line x1={padLeft} y1={zeroY} x2={w - padRight} y2={zeroY} stroke="currentColor" className="text-slate-400 dark:text-slate-500" strokeWidth="1.2" strokeDasharray="4 3" />
                  <line x1={padLeft} y1={baselineY} x2={w - padRight} y2={baselineY} stroke="currentColor" className="text-slate-200 dark:text-slate-700/80" strokeWidth="1" />

                  {/* Area Fill */}
                  {chartType === 'area' && (
                    <path d={netArea} fill="url(#areaNetGrad)" />
                  )}

                  {/* Curve Stroke */}
                  <path d={netLine} fill="none" stroke="#6366F1" strokeWidth={chartType === 'area' ? '2.4' : '2.8'} strokeLinecap="round" strokeLinejoin="round" />

                  {/* Active Point Indicator */}
                  {hoveredPointIndex !== null && (
                    <>
                      <line
                        x1={getX(hoveredPointIndex)}
                        y1={padTop}
                        x2={getX(hoveredPointIndex)}
                        y2={baselineY}
                        stroke="#94A3B8"
                        strokeDasharray="2 2"
                        strokeWidth="1"
                      />
                      <circle
                        cx={netPoints[hoveredPointIndex].x}
                        cy={netPoints[hoveredPointIndex].y}
                        r="5"
                        fill={monthlyTrends[hoveredPointIndex].net >= 0 ? '#10B981' : '#F43F5E'}
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                    </>
                  )}

                  {/* X-axis Month Labels */}
                  {monthlyTrends.map((t, i) => (
                    <text
                      key={t.month}
                      x={getX(i)}
                      y={h - 8}
                      textAnchor="middle"
                      className={`text-[10px] font-mono select-none transition-colors ${
                        hoveredPointIndex === i
                          ? 'fill-slate-900 dark:fill-white font-black'
                          : 'fill-slate-400 font-semibold'
                      }`}
                    >
                      {formatMonthLabel(t.month)}
                    </text>
                  ))}

                  {/* Transparent Interactive Hover Slices */}
                  {monthlyTrends.map((t, i) => {
                    const sliceW = plotW / count;
                    return (
                      <rect
                        key={`hit_net_${t.month}`}
                        x={getX(i) - sliceW / 2}
                        y={padTop}
                        width={sliceW}
                        height={plotH + padBottom}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => {
                          setHoveredPointIndex(i);
                          setHoveredMonth(t);
                        }}
                        onMouseLeave={() => {
                          setHoveredPointIndex(null);
                          setHoveredMonth(null);
                        }}
                      />
                    );
                  })}
                </svg>
              </div>
            );
          }
        })()}

        {/* 3B. Dynamic Bar Chart (when Bars selected) */}
        {monthlyTrends.length > 0 && chartType === 'bars' && (
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
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 pt-1.5 border-t border-slate-100 dark:border-slate-700/60 text-[11px]">
          {trendView === 'split' ? (
            <>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Inflow
              </span>
              <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Outflow
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Net Balance Trend
              </span>
            </>
          )}
        </div>
      </div>

      {/* 3B. LOANS & DEBTS ANALYTICS CARD */}
      {debtsStats && (
        <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Loans & Debts Analysis
              </span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              debtsStats.netPosition >= 0
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40'
            }`}>
              {debtsStats.netPosition >= 0 ? 'Net Asset' : 'Net Liability'}
            </span>
          </div>

          {/* 2-Column Split: Lent (Receivable) vs Borrowed (Payable) */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Money Lent */}
            <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Money Lent
                </span>
                <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {debtsStats.receivablePct}%
                </span>
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                <span className="currency-symbol">{symbol}</span>{formatAmount(debtsStats.receivableRemaining)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Total: {symbol}{formatAmount(debtsStats.receivableTotal)}
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full bg-emerald-100 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${debtsStats.receivablePct}%` }} />
              </div>
            </div>

            {/* Money Borrowed */}
            <div className="p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                  Money Borrowed
                </span>
                <span className="text-[10px] font-bold font-mono text-rose-600 dark:text-rose-400">
                  {debtsStats.payablePct}%
                </span>
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                <span className="currency-symbol">{symbol}</span>{formatAmount(debtsStats.payableRemaining)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Total: {symbol}{formatAmount(debtsStats.payableTotal)}
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full bg-rose-100 dark:bg-rose-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: `${debtsStats.payablePct}%` }} />
              </div>
            </div>
          </div>

          {/* Ratio Strip & Net Position */}
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <HandCoins className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">Net Lending Position:</span>
              <span className={`font-bold font-mono ${
                debtsStats.netPosition >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {debtsStats.netPosition >= 0 ? '+' : '-'}{symbol}{formatAmount(Math.abs(debtsStats.netPosition))}
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 font-mono shrink-0">
              {debtsStats.settledCount}/{debtsStats.totalCount} Settled
            </span>
          </div>
        </div>
      )}

      {/* 3C. FINANCIAL GOALS ANALYTICS CARD */}
      {goalsStats && (
        <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Financial Goals Progress
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <Trophy className="w-3 h-3" />
              <span>{goalsStats.portfolioPct}% Reached</span>
            </div>
          </div>

          {/* Portfolio Target vs Achieved Header */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Achieved / Target</span>
                <div className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  <span className="text-emerald-600 dark:text-emerald-400">{symbol}{formatAmount(goalsStats.totalAchieved)}</span>
                  <span className="text-slate-400 text-xs font-normal"> / {symbol}{formatAmount(goalsStats.totalTarget)}</span>
                </div>
              </div>
              <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                {goalsStats.completedGoalsCount} of {goalsStats.totalGoalsCount} Completed
              </span>
            </div>

            {/* Overall Portfolio Progress Bar */}
            <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, goalsStats.portfolioPct)}%` }}
              />
            </div>
          </div>

          {/* Top Goals breakdown bars */}
          {goalsStats.goalsList.length > 0 && (
            <div className="space-y-2 pt-1">
              {goalsStats.goalsList.map((g) => (
                <div key={g.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                      {g.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {symbol}{formatAmount(g.currentAmount)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        / {symbol}{formatAmount(g.target_amount)}
                      </span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.2 rounded"
                        style={{ backgroundColor: `${g.color}20`, color: g.color }}
                      >
                        {g.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, g.pct)}%`,
                        backgroundColor: g.color || '#10B981',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3D. WARRANTIES & ASSET PROTECTION CARD */}
      {warrantiesStats && (
        <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Warranties & Protection
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
              <span>{warrantiesStats.totalCount} Protected Assets</span>
            </div>
          </div>

          {/* Protected Value Strip */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Protected Value
              </span>
              <div className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                <span className="currency-symbol">{symbol}</span>{formatAmount(warrantiesStats.totalValue)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Active Status</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {warrantiesStats.activeCount} Covered
                </span>
              </div>
            </div>
          </div>

          {/* Multi-segment Warranty Distribution Bar */}
          <div className="space-y-1.5">
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden flex">
              {warrantiesStats.totalCount > 0 && (
                <>
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${(warrantiesStats.activeCount / warrantiesStats.totalCount) * 100}%` }}
                    title={`Active: ${warrantiesStats.activeCount}`}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: `${(warrantiesStats.expiringSoonCount / warrantiesStats.totalCount) * 100}%` }}
                    title={`Expiring Soon (<30d): ${warrantiesStats.expiringSoonCount}`}
                  />
                  <div
                    className="h-full bg-rose-500 transition-all"
                    style={{ width: `${(warrantiesStats.expiredCount / warrantiesStats.totalCount) * 100}%` }}
                    title={`Expired: ${warrantiesStats.expiredCount}`}
                  />
                </>
              )}
            </div>

            {/* Distribution Legend */}
            <div className="flex items-center justify-between text-[11px] font-medium pt-0.5">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active ({warrantiesStats.activeCount})
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Expiring &lt;30d ({warrantiesStats.expiringSoonCount})
              </span>
              <span className="flex items-center gap-1 text-rose-500">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Expired ({warrantiesStats.expiredCount})
              </span>
            </div>
          </div>

          {/* Upcoming expiration highlight chip */}
          {warrantiesStats.nextExpiringItem && (
            <div className="p-2 rounded-md bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[11px] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 truncate">
                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  Next expiry: {warrantiesStats.nextExpiringItem.product_name}
                </span>
              </div>
              <span className="font-bold text-amber-600 dark:text-amber-400 font-mono shrink-0">
                {warrantiesStats.nextExpiringItem.daysLeft}d left
              </span>
            </div>
          )}
        </div>
      )}

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
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('avgExpense')}</div>
              <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5 truncate">
                <span className="currency-symbol">{symbol}</span>{formatAmount(extraStats.avgExpenseTx)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Per transaction</div>
            </div>

            {/* Stat 2: Projected Month-End Spend */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('monthEndEst')}</div>
              <div className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 truncate">
                <span className="currency-symbol">{symbol}</span>{formatAmount(extraStats.projectedMonthSpend)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">At current pace</div>
            </div>

            {/* Stat 3: Expense-to-Income Ratio */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('burnRatio')}</div>
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
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('noSpendDays')}</div>
              <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {extraStats.noSpendDaysThisMonth} / {extraStats.daysElapsedThisMonth}d
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Zero-spend this mo</div>
            </div>

            {/* Stat 5: Biggest Spending Day */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 col-span-2 sm:col-span-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('highestSpendDay')}</div>
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
              <div className="text-[10px] text-slate-400 mt-0.5">{t('highestSingleDay')}</div>
            </div>
          </div>
        </div>
      )}

      {/* 6. TOP INCOMES & TOP EXPENSES */}
      {(topIncomes.length > 0 || (insights && insights.top_expenses.length > 0)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Top Incomes */}
          {topIncomes.length > 0 && (() => {
            const maxIncome = Math.max(...topIncomes.map((t) => t.amount), 1);
            return (
              <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                    Top Incomes
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">
                    Relative Scale
                  </span>
                </div>

                <div className="space-y-2.5 divide-y divide-slate-100 dark:divide-slate-700/60">
                  {topIncomes.map((tx, idx) => {
                    const pct = Math.max(8, Math.min(100, Math.round((tx.amount / maxIncome) * 100)));
                    return (
                      <div key={tx.id} className="pt-2 first:pt-0 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className="text-[10px] font-mono font-bold text-slate-400 w-3 shrink-0">
                              #{idx + 1}
                            </span>
                            <div
                              className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs shrink-0"
                              style={{ backgroundColor: tx.color || '#10B981' }}
                            >
                              <CategoryIcon name={tx.icon || 'ArrowDownLeft'} className="w-3 h-3" />
                            </div>
                            <div className="truncate">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block">
                                {tx.note || tCat(tx.category_name)}
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

                        {/* Visual Proportional Scale Bar */}
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Top Expenses */}
          {insights && insights.top_expenses.length > 0 && (() => {
            const maxExpense = Math.max(...insights.top_expenses.map((t) => t.amount), 1);
            return (
              <div className="bg-white dark:bg-slate-800/90 rounded-[10px] p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-500 block">
                    Top Expenses
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">
                    Relative Scale
                  </span>
                </div>

                <div className="space-y-2.5 divide-y divide-slate-100 dark:divide-slate-700/60">
                  {insights.top_expenses.map((tx, idx) => {
                    const pct = Math.max(8, Math.min(100, Math.round((tx.amount / maxExpense) * 100)));
                    return (
                      <div key={tx.id} className="pt-2 first:pt-0 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className="text-[10px] font-mono font-bold text-slate-400 w-3 shrink-0">
                              #{idx + 1}
                            </span>
                            <div
                              className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs shrink-0"
                              style={{ backgroundColor: tx.color || '#EF4444' }}
                            >
                              <CategoryIcon name={tx.icon || 'ArrowUpRight'} className="w-3 h-3" />
                            </div>
                            <div className="truncate">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block">
                                {tx.note || tCat(tx.category_name)}
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

                        {/* Visual Proportional Scale Bar */}
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
