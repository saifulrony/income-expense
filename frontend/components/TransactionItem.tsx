'use client';

import React from 'react';
import { Transaction } from '@/lib/types';
import { CategoryIcon } from './CategoryIcons';
import { Trash2, Edit2 } from 'lucide-react';

interface TransactionItemProps {
  transaction: Transaction;
  currency: string;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (id: string) => void;
}

export default function TransactionItem({
  transaction,
  currency,
  onEdit,
  onDelete,
}: TransactionItemProps) {
  const isIncome = transaction.type === 'income';

  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="group relative flex items-center justify-between p-3.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-slate-200 dark:hover:border-slate-700 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        {/* Category Icon Badge */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
          style={{ backgroundColor: transaction.category?.color || (isIncome ? '#10B981' : '#EF4444') }}
        >
          <CategoryIcon name={transaction.category?.icon || 'Tag'} className="w-5 h-5" />
        </div>

        {/* Text description and details */}
        <div className="min-w-0">
          <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
            {transaction.note || transaction.category?.name || (isIncome ? 'Cash In' : 'Cash Out')}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span>{formatDate(transaction.date)}</span>
            <span>•</span>
            <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded text-[10px]">
              {transaction.payment_method || 'Cash'}
            </span>
          </div>
        </div>
      </div>

      {/* Amount and Action buttons */}
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <div className="text-right">
          <div
            className={`font-bold text-sm tracking-tight ${
              isIncome
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isIncome ? '+' : '-'}{currency} {formatAmount(transaction.amount)}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            {transaction.category?.name}
          </div>
        </div>

        {/* Action icons */}
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(transaction);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this transaction?')) {
                    onDelete(transaction.id);
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
