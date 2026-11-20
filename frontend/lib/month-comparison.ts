import { Transaction } from './types';

export interface PeriodComparisonStats {
  period: string; // 'today' | 'this_week' | 'this_month' | 'this_year' | 'all'
  title: string;
  badge: string;
  currentLabel: string;
  prevLabel: string;
  emptyText: string;

  // Backwards compatibility with MonthComparisonStats
  currentMonthLabel: string;
  prevMonthLabel: string;
  hasPrevMonthData: boolean;

  hasPrevData: boolean;
  hasData: boolean;
  currCount: number;
  prevCount: number;
  currIncome: number;
  prevIncome: number;
  incomeDiff: number;
  incomePct: number | null;
  currExpense: number;
  prevExpense: number;
  expenseDiff: number;
  expensePct: number | null;
  currNet: number;
  prevNet: number;
  netDiff: number;
}

export type MonthComparisonStats = PeriodComparisonStats;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseTxDate(raw?: string): Date | null {
  if (!raw) return null;
  // If YYYY-MM-DD date-only string, use local midday to avoid timezone boundary drift
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Computes financial comparison between the current selected period and its preceding equivalent period.
 * Supported periods: 'today', 'this_week', 'this_month', 'this_year' (returns null for 'all').
 */
export function computePeriodComparison(
  transactions: Transaction[],
  period: string = 'this_month'
): PeriodComparisonStats | null {
  if (!period || period === 'all' || period === 'all_time') {
    return null;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0..11
  const currentDate = now.getDate();

  let currStart: Date;
  let currEnd: Date;
  let prevStart: Date;
  let prevEnd: Date;

  let title = '';
  let badge = '';
  let currentLabel = '';
  let prevLabel = '';
  let emptyText = '';

  switch (period) {
    case 'today': {
      currStart = new Date(currentYear, currentMonth, currentDate, 0, 0, 0, 0);
      currEnd = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999);
      prevStart = new Date(currentYear, currentMonth, currentDate - 1, 0, 0, 0, 0);
      prevEnd = new Date(currentYear, currentMonth, currentDate - 1, 23, 59, 59, 999);

      title = 'Today vs Yesterday';
      badge = 'Day Comparison';
      currentLabel = 'Today';
      prevLabel = 'Yesterday';
      emptyText = "No records from yesterday yet. Once you have transactions across both days, you'll see exact savings & spending comparisons here.";
      break;
    }

    case 'this_week': {
      // Monday-start week
      const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon ...
      const diffToMonday = (dayOfWeek + 6) % 7;
      currStart = new Date(currentYear, currentMonth, currentDate - diffToMonday, 0, 0, 0, 0);
      currEnd = new Date(currStart.getTime() + 7 * 86400000 - 1);
      prevStart = new Date(currStart.getTime() - 7 * 86400000);
      prevEnd = new Date(currStart.getTime() - 1);

      title = 'This Week vs Last Week';
      badge = 'Week Comparison';
      currentLabel = 'This Week';
      prevLabel = 'Last Week';
      emptyText = "No records from last week yet. Once you have transactions across two weeks, you'll see exact savings & spending comparisons here.";
      break;
    }

    case 'this_year': {
      currStart = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      currEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
      prevStart = new Date(currentYear - 1, 0, 1, 0, 0, 0, 0);
      prevEnd = new Date(currentYear - 1, 11, 31, 23, 59, 59, 999);

      title = `${currentYear} vs ${currentYear - 1}`;
      badge = 'Year Comparison';
      currentLabel = `${currentYear}`;
      prevLabel = `${currentYear - 1}`;
      emptyText = `No records in ${currentYear - 1} yet. Once you have transactions across two years, you'll see exact savings & spending comparisons here.`;
      break;
    }

    case 'this_month':
    default: {
      currStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      currEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
      prevStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
      prevEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

      const currMonthName = MONTH_SHORT[currentMonth];
      const prevMonthName = MONTH_SHORT[prevStart.getMonth()];

      title = `${currMonthName} vs ${prevMonthName}`;
      badge = 'Month Comparison';
      currentLabel = currMonthName;
      prevLabel = prevMonthName;
      emptyText = `No records in ${prevMonthName} yet. Once you have transactions across two months, you'll see exact savings & spending comparisons here.`;
      break;
    }
  }

  const currStartMs = currStart.getTime();
  const currEndMs = currEnd.getTime();
  const prevStartMs = prevStart.getTime();
  const prevEndMs = prevEnd.getTime();

  let currIncome = 0;
  let currExpense = 0;
  let prevIncome = 0;
  let prevExpense = 0;
  let currCount = 0;
  let prevCount = 0;

  for (const tx of transactions || []) {
    const d = parseTxDate(tx?.date);
    if (!d) continue;
    const t = d.getTime();
    const amt = Number(tx.amount) || 0;

    if (t >= currStartMs && t <= currEndMs) {
      currCount++;
      if (tx.type === 'income') currIncome += amt;
      else currExpense += amt;
    } else if (t >= prevStartMs && t <= prevEndMs) {
      prevCount++;
      if (tx.type === 'income') prevIncome += amt;
      else prevExpense += amt;
    }
  }

  const incomeDiff = currIncome - prevIncome;
  const expenseDiff = currExpense - prevExpense;
  const currNet = currIncome - currExpense;
  const prevNet = prevIncome - prevExpense;
  const netDiff = currNet - prevNet;

  const incomePct = prevIncome > 0 ? Math.round((incomeDiff / prevIncome) * 100) : null;
  const expensePct = prevExpense > 0 ? Math.round((expenseDiff / prevExpense) * 100) : null;
  const hasData = currCount > 0 || prevCount > 0;

  // Custom empty text when both current and previous periods have 0 transactions
  const finalEmptyText =
    currCount === 0 && prevCount === 0
      ? `No records found in ${currentLabel} or ${prevLabel} yet. Once you add transactions, comparisons will appear here.`
      : emptyText;

  return {
    period,
    title,
    badge,
    currentLabel,
    prevLabel,
    emptyText: finalEmptyText,

    // Backwards compatibility for MonthComparisonStats
    currentMonthLabel: currentLabel,
    prevMonthLabel: prevLabel,
    hasPrevMonthData: prevCount > 0,

    hasPrevData: prevCount > 0,
    hasData,
    currCount,
    prevCount,
    currIncome,
    prevIncome,
    incomeDiff,
    incomePct,
    currExpense,
    prevExpense,
    expenseDiff,
    expensePct,
    currNet,
    prevNet,
    netDiff,
  };
}

/**
 * Backwards compatibility helper for existing callers that only need monthly stats
 */
export function computeMonthComparison(transactions: Transaction[]): MonthComparisonStats {
  const result = computePeriodComparison(transactions, 'this_month');
  if (result) return result;

  // Fallback safe default
  const now = new Date();
  const currMonth = now.getMonth();
  const prevDate = new Date(now.getFullYear(), currMonth - 1, 1);
  return {
    period: 'this_month',
    title: `${MONTH_SHORT[currMonth]} vs ${MONTH_SHORT[prevDate.getMonth()]}`,
    badge: 'Month Comparison',
    currentLabel: MONTH_SHORT[currMonth],
    prevLabel: MONTH_SHORT[prevDate.getMonth()],
    emptyText: `No records in ${MONTH_SHORT[prevDate.getMonth()]} yet.`,
    currentMonthLabel: MONTH_SHORT[currMonth],
    prevMonthLabel: MONTH_SHORT[prevDate.getMonth()],
    hasPrevMonthData: false,
    hasPrevData: false,
    hasData: false,
    currCount: 0,
    prevCount: 0,
    currIncome: 0,
    prevIncome: 0,
    incomeDiff: 0,
    incomePct: null,
    currExpense: 0,
    prevExpense: 0,
    expenseDiff: 0,
    expensePct: null,
    currNet: 0,
    prevNet: 0,
    netDiff: 0,
  };
}
