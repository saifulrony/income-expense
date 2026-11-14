'use client';

import React, { useMemo } from 'react';
import { Transaction } from '@/lib/types';
import { CategoryIcon } from './CategoryIcons';
import { Inbox, Plus, FileText } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/currency';

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

export default function RecordLedger({
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
          <div className="flex items-center">
            <span className="w-22 sm:w-24 text-right text-emerald-600 dark:text-emerald-400 font-bold">
              Cash In
            </span>
            <span className="w-22 sm:w-24 text-right text-rose-600 dark:text-rose-400 font-bold">
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
              {/* Left: Big Day Number + Year.Month + Day Pill */}
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100 leading-none">
                  {group.dayNumber}
                </span>
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 leading-tight">
                    {group.yearMonth}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded leading-none w-fit ${
                      group.dayName === 'Sun' || group.dayName === 'Sat'
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {group.dayName}
                  </span>
                </div>
              </div>

              {/* Right: Cash In & Cash Out Day Totals */}
              <div className="flex items-center">
                <div className="w-22 sm:w-24 text-right">
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
                <div className="w-22 sm:w-24 text-right">
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
                  {/* Left: Category Icon, Name, Note, Account */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{
                        backgroundColor:
                          tx.category?.color ||
                          (tx.type === 'income' ? '#10B981' : '#EF4444'),
                      }}
                    >
                      <CategoryIcon
                        name={tx.category?.icon || 'Tag'}
                        className="w-4 h-4"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {tx.category?.name ||
                            (tx.type === 'income' ? 'Income' : 'Expense')}
                        </span>
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
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {tx.note && (
                          <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
                            {tx.note}
                          </span>
                        )}
                        {tx.note &&
                          (tx.account?.name || tx.payment_method) && (
                            <span>•</span>
                          )}
                        {(tx.account?.name || tx.payment_method) && (
                          <span className="truncate text-slate-400">
                            {tx.account?.name || tx.payment_method}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Cash In (Green) & Cash Out (Rose) Columns */}
                  <div className="flex items-center shrink-0">
                    {/* Cash In (Green) */}
                    <div className="w-22 sm:w-24 text-right">
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
                    <div className="w-22 sm:w-24 text-right">
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
}

