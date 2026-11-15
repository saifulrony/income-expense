'use client';

import React, { useMemo } from 'react';
import { Transaction } from '@/lib/types';
import { Inbox, Plus, FileText } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/currency';
import { formatTransactionTime } from '@/lib/time-settings';

interface RecordLedgerProps {
  transactions: Transaction[];
  currency: string;
  onEdit: (tx: Transaction) => void;
  onOpenAddModal?: () => void;
  emptyMessage?: string;
  showHeader?: boolean;
  onViewReceipt?: (imageUrl: string) => void;
}

interface DayGroup {
  dateKey: string;
  dayNumber: number;
  yearMonth: string;
  dayName: string;
  isToday: boolean;
  totalIncome: number;
  totalExpense: number;
  transactions: Transaction[];
}

const RecordLedger = React.memo(function RecordLedger({
  transactions,
  currency,
  onEdit,
  onOpenAddModal,
  emptyMessage = 'No transactions recorded',
  showHeader = true,
  onViewReceipt,
}: RecordLedgerProps) {
  const symbol = getCurrencySymbol(currency);
  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Group transactions by day
  const dayGroups: DayGroup[] = useMemo(() => {
    const groups: Record<string, DayGroup> = {};
    const todayStr = new Date().toISOString().slice(0, 10);

    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = d.getDate();
      const dateKey = `${year}-${month}-${String(day).padStart(2, '0')}`;

      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateKey,
          dayNumber: day,
          yearMonth: `${year}.${month}`,
          dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
          isToday: dateKey === todayStr,
          totalIncome: 0,
          totalExpense: 0,
          transactions: [],
        };
      }

      if (tx.type === 'income') {
        groups[dateKey].totalIncome += tx.amount;
      } else if (tx.type === 'expense') {
        groups[dateKey].totalExpense += tx.amount;
      }

      groups[dateKey].transactions.push(tx);
    });

    return Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-[10px] border border-dashed border-slate-200 dark:border-slate-800">
        <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {emptyMessage}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Record your cash in and cash out to start tracking your daily balance.
        </p>
        {onOpenAddModal && (
          <button
            onClick={onOpenAddModal}
            className="mt-3 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-md shadow-sm transition-all inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Record</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Column Headers for Cash In (Green) and Cash Out (Rose) */}
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/60 dark:border-slate-800/60">
          <span>Details</span>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="w-20 sm:w-24 text-right text-emerald-600 dark:text-emerald-400 font-bold">
              Cash In
            </span>
            <span className="w-20 sm:w-24 text-right text-rose-600 dark:text-rose-400 font-bold">
              Cash Out
            </span>
          </div>
        </div>
      )}

      {/* Date Groups */}
      <div className="space-y-2.5">
        {dayGroups.map((group) => (
          <div
            key={group.dateKey}
            className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs"
          >
            {/* Date Header Row */}
            <div className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800">
              {/* Left: Organized Date Badge with Day-of-Week above Day Number */}
              <div className="flex items-center gap-2.5">
                {/* Calendar Date Block: Day of week on top, Day number below */}
                <div className="w-11 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs flex flex-col items-center justify-center shrink-0">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider leading-none mb-0.5 ${
                      group.dayName === 'Sun' || group.dayName === 'Sat'
                        ? 'text-rose-500 dark:text-rose-400'
                        : 'text-slate-400 dark:text-slate-400'
                    }`}
                  >
                    {group.dayName}
                  </span>
                  <span className="text-base font-black font-mono text-slate-800 dark:text-slate-100 leading-none">
                    {group.dayNumber}
                  </span>
                </div>

                {/* Year.Month & Today badge below the date */}
                <div className="flex flex-col justify-center">
                  <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-200 leading-tight">
                    {group.yearMonth}
                  </span>
                  {group.isToday && (
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800/50 leading-none w-fit mt-0.5">
                      Today
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Cash In & Cash Out Day Totals */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="w-20 sm:w-24 text-right">
                  <span
                    className={`text-xs font-mono font-bold ${
                      group.totalIncome > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {symbol}{formatAmount(group.totalIncome)}
                  </span>
                </div>
                <div className="w-20 sm:w-24 text-right">
                  <span
                    className={`text-xs font-mono font-bold ${
                      group.totalExpense > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {symbol}{formatAmount(group.totalExpense)}
                  </span>
                </div>
              </div>
            </div>

            {/* Individual Records for that Day */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {group.transactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => onEdit(tx)}
                  className="flex items-center justify-between py-2.5 px-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  title="Tap to edit"
                >
                  {/* Left: Description / Note (Primary), Time, Receipt */}
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {tx.note ||
                          tx.category?.name ||
                          (tx.type === 'income' ? 'Income' : 'Expense')}
                      </span>
                      {formatTransactionTime(tx) && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                          {formatTransactionTime(tx)}
                        </span>
                      )}
                      {tx.receipt_image && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewReceipt?.(tx.receipt_image || '');
                          }}
                          className="text-indigo-500 hover:text-indigo-600 shrink-0 p-0.5"
                          title="View Receipt"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right: Cash In (Green) & Cash Out (Rose) Columns */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {/* Cash In (Green) */}
                    <div className="w-20 sm:w-24 text-right">
                      {tx.type === 'income' ? (
                        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{symbol}{formatAmount(tx.amount)}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-slate-300 dark:text-slate-600">
                          -
                        </span>
                      )}
                    </div>

                    {/* Cash Out (Rose) */}
                    <div className="w-20 sm:w-24 text-right">
                      {tx.type === 'expense' ? (
                        <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                          -{symbol}{formatAmount(tx.amount)}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-slate-300 dark:text-slate-600">
                          -
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default RecordLedger;

