'use client';

import React, { useState } from 'react';
import { Transaction } from '@/lib/types';
import { CategoryIcon } from './CategoryIcons';
import { FileText, X } from 'lucide-react';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { formatTransactionTime } from '@/lib/time-settings';
import { useTranslation, useTranslateCategory } from '@/lib/i18n';
import { useFlowLabels } from '@/lib/ui-prefs';

interface TransactionItemProps {
  transaction: Transaction;
  currency: string;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (id: string) => void;
}

const TransactionItem = React.memo(function TransactionItem({
  transaction,
  currency,
  onEdit,
}: TransactionItemProps) {
  const symbol = getCurrencySymbol(currency);
  const [showReceipt, setShowReceipt] = useState(false);
  const isIncome = transaction.type === 'income';
  const { lang, t } = useTranslation();
  const tCat = useTranslateCategory();
  const { inLabel, outLabel } = useFlowLabels();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const locale = lang === 'bn' ? 'bn-BD' : lang === 'hi' ? 'hi-IN' : lang === 'es' ? 'es-ES' : lang === 'ar' ? 'ar-SA' : 'en-US';
    return d.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    });
  };

  const title = transaction.note || (transaction.category?.name ? tCat(transaction.category.name) : (isIncome ? inLabel : outLabel));
  const hasDistinctCategory = transaction.note && transaction.category?.name;

  return (
    <>
      <div
        onClick={() => onEdit?.(transaction)}
        className="volt-card group flex items-center justify-between p-3.5 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 active:scale-[0.99] transition-all cursor-pointer"
        title="Tap to view or edit"
      >
        {/* Left: Icon + Title & Metadata */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 pr-2">
          <div
            className="volt-icon-chip w-9.5 h-9.5 sm:w-10 sm:h-10 rounded-md flex items-center justify-center text-white shrink-0 shadow-xs"
            style={{ backgroundColor: transaction.category?.color || (isIncome ? '#10B981' : '#EF4444') }}
          >
            <CategoryIcon name={transaction.category?.icon || 'Tag'} className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
              <span className="truncate">{title}</span>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              <span>{formatDate(transaction.date)}</span>
              {formatTransactionTime(transaction) && (
                <span className="font-mono"> • {formatTransactionTime(transaction)}</span>
              )}
              {hasDistinctCategory && <span> • {tCat(transaction.category?.name || '')}</span>}
              {transaction.account?.name && <span> • {transaction.account.name}</span>}
            </div>
          </div>
        </div>

        {/* Right: Amount */}
        <div className="text-right shrink-0 ml-1.5 sm:ml-3">
          <div
            className={`font-bold text-sm sm:text-base font-mono tracking-tight ${
              isIncome
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            <span className="currency-symbol">{symbol}</span>{formatAmount(transaction.amount)}
          </div>
        </div>
      </div>

      {/* Full-screen Receipt Modal */}
      {showReceipt && transaction.receipt_image && (
        <div
          onClick={() => setShowReceipt(false)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-sm w-full bg-white dark:bg-slate-900 rounded-[10px] overflow-hidden shadow-2xl gpu-layer"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Receipt Attachment
              </span>
              <button
                type="button"
                onClick={() => setShowReceipt(false)}
                className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={transaction.receipt_image}
                alt="Receipt"
                className="max-h-[60vh] max-w-full rounded-md object-contain shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default TransactionItem;
