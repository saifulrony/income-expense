'use client';

import React, { useState } from 'react';
import { Transaction } from '@/lib/types';
import { CategoryIcon } from './CategoryIcons';
import { Trash2, Edit2, FileText, X } from 'lucide-react';

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
  const [showReceipt, setShowReceipt] = useState(false);
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
    });
  };

  return (
    <>
      <div className="group relative flex items-center justify-between p-3.5 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs hover:border-slate-200 dark:hover:border-slate-700 transition-all">
        <div className="flex items-center gap-3 min-w-0">
          {/* Category Icon Badge */}
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs"
            style={{ backgroundColor: transaction.category?.color || (isIncome ? '#10B981' : '#EF4444') }}
          >
            <CategoryIcon name={transaction.category?.icon || 'Tag'} className="w-5 h-5" />
          </div>

          {/* Text description and details */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
              <span className="truncate">{transaction.note || transaction.category?.name || (isIncome ? 'Income' : 'Expense')}</span>
              {transaction.receipt_image && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReceipt(true);
                  }}
                  className="text-indigo-500 hover:text-indigo-600 shrink-0 p-0.5"
                  title="View Receipt"
                >
                  <FileText className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{formatDate(transaction.date)}</span>
              <span>•</span>
              <span className="capitalize">{transaction.payment_method || 'Cash'}</span>
              {transaction.account?.name && (
                <>
                  <span>•</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: `${transaction.account.color}15`,
                      color: transaction.account.color,
                    }}
                  >
                    {transaction.account.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Amount and Action buttons */}
        <div className="flex items-center gap-2.5 shrink-0 ml-2">
          <div className="text-right">
            <div
              className={`font-bold text-base font-mono tracking-tight ${
                isIncome
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {isIncome ? '+' : '-'}{currency} {formatAmount(transaction.amount)}
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {transaction.category?.name}
            </div>
          </div>

          {/* Action icons */}
          {(onEdit || onDelete) && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(transaction);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
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
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-95 transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full-screen Receipt Modal */}
      {showReceipt && transaction.receipt_image && (
        <div
          onClick={() => setShowReceipt(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-sm w-full bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Receipt Attachment
              </span>
              <button
                onClick={() => setShowReceipt(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={transaction.receipt_image}
                alt="Receipt"
                className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
