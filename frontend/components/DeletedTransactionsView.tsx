'use client';

import React, { useState, useMemo } from 'react';
import { Transaction } from '@/lib/types';
import { formatAmount } from '@/lib/currency';
import { formatDate, formatTime } from '@/lib/time-settings';
import { CategoryIcon } from './CategoryIcons';
import { useFlowLabels } from '@/lib/ui-prefs';
import { useTranslation } from '@/lib/i18n';
import {
  Trash2,
  RotateCcw,
  Search,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  X,
} from 'lucide-react';

interface DeletedTransactionsViewProps {
  deletedTransactions: Transaction[];
  currency: string;
  onRestore: (id: string) => void;
  onRestoreAll: () => void;
  onPermanentDelete: (id: string) => void;
  onEmptyTrash: () => void;
  onBack?: () => void;
}

export default function DeletedTransactionsView({
  deletedTransactions,
  currency,
  onRestore,
  onRestoreAll,
  onPermanentDelete,
  onEmptyTrash,
  onBack,
}: DeletedTransactionsViewProps) {
  const { inLabel, outLabel } = useFlowLabels();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deletedTransactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (!q) return true;
      const noteMatch = (tx.note || '').toLowerCase().includes(q);
      const catMatch = (tx.category?.name || '').toLowerCase().includes(q);
      const accMatch = (tx.account?.name || '').toLowerCase().includes(q);
      const amtMatch = String(tx.amount).includes(q);
      return noteMatch || catMatch || accMatch || amtMatch;
    });
  }, [deletedTransactions, search, typeFilter]);

  const stats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const tx of filtered) {
      if (tx.type === 'income') totalIn += Number(tx.amount) || 0;
      else totalOut += Number(tx.amount) || 0;
    }
    return { totalIn, totalOut };
  }, [filtered]);

  return (
    <div className="space-y-3.5 pb-24">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
              <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="truncate">{t('deletedTransactions')}</span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                {deletedTransactions.length}
              </span>
            </h2>
          </div>
        </div>

        {deletedTransactions.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onRestoreAll}
              className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap flex items-center gap-1 shadow-xs transition-all active:scale-98"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('restoreAll')}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmEmptyOpen(true)}
              className="px-2.5 py-1.5 rounded-md bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 text-rose-600 dark:text-rose-400 text-xs font-bold whitespace-nowrap flex items-center gap-1 transition-all active:scale-98"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('emptyTrash')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Search & Type Filter */}
      {deletedTransactions.length > 0 && (
        <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-3 shadow-xs space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search deleted notes, category, amount..."
                className="w-full pl-8 pr-7 py-1.5 rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/70 p-0.5 rounded-md">
              {(['all', 'income', 'expense'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                    typeFilter === t
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'income' ? inLabel : outLabel}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5 text-[11px] font-mono">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                In: <span className="currency-symbol">{currency}</span>{formatAmount(stats.totalIn)}
              </span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">
                Out: <span className="currency-symbol">{currency}</span>{formatAmount(stats.totalOut)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Deleted Transactions List */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-8 text-center space-y-2 shadow-xs">
          <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {deletedTransactions.length === 0
              ? 'Trash is empty'
              : 'No deleted transactions match your filter'}
          </div>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
            {deletedTransactions.length === 0
              ? 'Any transaction you delete will appear here so you can restore it anytime or delete it permanently.'
              : 'Try clearing your search or switching the filter tab above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => {
            const isIncome = tx.type === 'income';
            const catColor = tx.category?.color || (isIncome ? '#10B981' : '#EF4444');
            const deletedTimeStr = tx.deleted_at
              ? `${formatDate(tx.deleted_at)} • ${formatTime(tx.deleted_at)}`
              : formatDate(tx.updated_at || tx.date);

            return (
              <div
                key={tx.id}
                className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-3 shadow-xs flex items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 mt-0.5"
                    style={{ backgroundColor: catColor }}
                  >
                    <CategoryIcon name={tx.category?.icon || 'MoreHorizontal'} className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {tx.note || tx.category?.name || (isIncome ? 'Cash In' : 'Cash Out')}
                      </span>
                      {tx.account?.name && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                          {tx.account.name}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400">
                      <span>{tx.category?.name || 'General'}</span>
                      <span>•</span>
                      <span>Record: {formatDate(tx.date)}</span>
                      <span>•</span>
                      <span className="text-rose-500/80 dark:text-rose-400/80">
                        Deleted: {deletedTimeStr}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
                      isIncome
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isIncome ? (
                      <ArrowDownLeft className="w-3 h-3 shrink-0" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3 shrink-0" />
                    )}
                    <span>
                      {isIncome ? '+' : '-'}
                      <span className="currency-symbol">{currency}</span>
                      {formatAmount(tx.amount)}
                    </span>
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onRestore(tx.id)}
                      className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 text-[10px] font-bold flex items-center gap-1 transition-colors"
                      title="Restore transaction"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onPermanentDelete(tx.id)}
                      className="p-1 rounded bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60 transition-colors"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Empty Trash Modal */}
      {confirmEmptyOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setConfirmEmptyOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[12px] border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/70 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Empty Trash Permanently?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  All {deletedTransactions.length} deleted transaction{deletedTransactions.length === 1 ? '' : 's'} in Trash will be permanently erased and cannot be recovered.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmEmptyOpen(false)}
                className="px-3.5 py-2 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onEmptyTrash();
                  setConfirmEmptyOpen(false);
                }}
                className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Empty Trash</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
