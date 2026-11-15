import { Transaction } from './types';

/**
 * Filter transactions by selected time period using local calendar time
 */
export function filterTransactionsByPeriod(
  transactions: Transaction[],
  period: string = 'all'
): Transaction[] {
  if (!period || period === 'all' || period === 'all_time') {
    return transactions;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  // Start of today: 00:00:00.000 local time
  const startOfToday = new Date(currentYear, currentMonth, currentDate, 0, 0, 0, 0);
  const endOfToday = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999);

  // Start of this week (Monday start):
  const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = (dayOfWeek + 6) % 7;
  const startOfWeek = new Date(currentYear, currentMonth, currentDate - diffToMonday, 0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  // Start of this month:
  const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

  // Start of last month:
  const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
  const endOfLastMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

  // Start of this year:
  const startOfYear = new Date(currentYear, 0, 1, 0, 0, 0, 0);
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

  return transactions.filter((tx) => {
    if (!tx.date) return true;
    const txDate = new Date(tx.date);
    if (isNaN(txDate.getTime())) return true;

    switch (period) {
      case 'today':
        return txDate >= startOfToday && txDate <= endOfToday;

      case 'this_week':
        return txDate >= startOfWeek && txDate < endOfWeek;

      case 'this_month':
        return txDate >= startOfMonth && txDate <= endOfMonth;

      case 'last_month':
        return txDate >= startOfLastMonth && txDate <= endOfLastMonth;

      case 'this_year':
        return txDate >= startOfYear && txDate <= endOfYear;

      default:
        return true;
    }
  });
}

export function getPeriodLabel(period: string = 'all'): string {
  switch (period) {
    case 'today':
      return 'Today';
    case 'this_week':
      return 'This Week';
    case 'this_month':
      return 'This Month';
    case 'last_month':
      return 'Last Month';
    case 'this_year':
      return 'This Year';
    case 'all':
    default:
      return 'All Time';
  }
}

