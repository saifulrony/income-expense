'use client';

import React, { useMemo, useState, useRef } from 'react';
import { Transaction } from '@/lib/types';
import { Inbox, Plus, FileText, ArrowDown, ArrowUp, ArrowUpDown, Trash2, Check } from 'lucide-react';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { formatTransactionTime } from '@/lib/time-settings';
import { api } from '@/lib/api';
import { OfflineStorage, getAppMode } from '@/lib/offline-storage';

interface RecordLedgerProps {
  transactions: Transaction[];
  currency: string;
  onEdit: (tx: Transaction) => void;
  onDelete?: (id: string) => void;
  onOpenAddModal?: () => void;
  emptyMessage?: string;
  showHeader?: boolean;
  onViewReceipt?: (imageUrl: string) => void;
}

/** Touch row that swipes left to reveal a delete action (mobile). */
function SwipeRow({
  children,
  onClick,
  onDelete,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const baseDx = useRef(0);
  const horizontal = useRef<boolean | null>(null);

  const REVEAL = 72;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    baseDx.current = dx;
    horizontal.current = null;
    setDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!onDelete) return;
    const deltaX = e.touches[0].clientX - startX.current;
    const deltaY = e.touches[0].clientY - startY.current;
    if (horizontal.current === null && (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8)) {
      horizontal.current = Math.abs(deltaX) > Math.abs(deltaY);
    }
    if (!horizontal.current) return;
    const next = Math.max(-REVEAL - 12, Math.min(0, baseDx.current + deltaX));
    setDx(next);
  };

  const handleTouchEnd = () => {
    setDragging(false);
    setDx((cur) => (cur < -REVEAL / 2 ? -REVEAL : 0));
  };

  return (
    <div className="relative overflow-hidden">
      {/* Revealed delete action */}
      {onDelete && dx < 0 && (
        <button
          type="button"
          onClick={() => {
            setDx(0);
            onDelete();
          }}
          className="absolute inset-y-0 right-0 w-[72px] bg-rose-600 text-white flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold"
          aria-label="Delete record"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      )}

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (dx !== 0) {
            setDx(0);
          } else {
            onClick();
          }
        }}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform 180ms ease',
        }}
        className="relative bg-inherit"
      >
        {children}
      </div>
    </div>
  );
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

type SortField = 'date' | 'income' | 'expense';
type SortOrder = 'asc' | 'desc';

const RecordLedger = React.memo(function RecordLedger({
  transactions,
  currency,
  onEdit,
  onDelete,
  onOpenAddModal,
  emptyMessage = 'No transactions recorded',
  showHeader = true,
  onViewReceipt,
}: RecordLedgerProps) {
  const symbol = getCurrencySymbol(currency);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [noteOverrides, setNoteOverrides] = useState<Record<string, string>>({});
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pressStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const getDisplayTitle = (tx: Transaction) => {
    if (noteOverrides[tx.id] !== undefined) {
      return noteOverrides[tx.id];
    }
    return tx.note || tx.category?.name || (tx.type === 'income' ? 'Income' : 'Expense');
  };

  const startLongPress = (tx: Transaction, clientX: number, clientY: number) => {
    if (editingNoteId === tx.id) return;
    clearLongPress();
    longPressTriggeredRef.current = false;
    pressStartPosRef.current = { x: clientX, y: clientY };

    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(15);
        } catch {}
      }
      setEditingNoteId(tx.id);
      setEditingNoteText(getDisplayTitle(tx));
    }, 420);
  };

  const handlePressMove = (clientX: number, clientY: number) => {
    if (!pressStartPosRef.current) return;
    const dx = Math.abs(clientX - pressStartPosRef.current.x);
    const dy = Math.abs(clientY - pressStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      clearLongPress();
    }
  };

  const saveInlineNote = (tx: Transaction, rawText?: string) => {
    const textToSave = rawText !== undefined ? rawText : editingNoteText;
    const trimmed = textToSave.trim();
    setEditingNoteId(null);
    if (!trimmed || trimmed === getDisplayTitle(tx)) {
      return;
    }

    setNoteOverrides((prev) => ({ ...prev, [tx.id]: trimmed }));

    const payload = {
      account_id: tx.account_id,
      amount: tx.amount,
      type: tx.type,
      category_id: tx.category_id,
      payment_method: tx.payment_method || 'Cash',
      note: trimmed,
      receipt_image: tx.receipt_image,
      date: tx.date,
    };

    try {
      OfflineStorage.updateTransaction(tx.id, payload);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cashflow:transactions-updated'));
      }
      if (getAppMode() === 'online') {
        api.updateTransaction(tx.id, payload).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to update note inline:', err);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else {
        // Toggle back to default date descending
        setSortField('date');
        setSortOrder('desc');
      }
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
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

  // Sort groups and transactions inside them based on sortField & sortOrder
  const sortedDayGroups = useMemo(() => {
    const list = [...dayGroups];

    if (sortField === 'income') {
      list.sort((a, b) => {
        const diff = sortOrder === 'desc' ? b.totalIncome - a.totalIncome : a.totalIncome - b.totalIncome;
        return diff !== 0 ? diff : b.dateKey.localeCompare(a.dateKey);
      });
    } else if (sortField === 'expense') {
      list.sort((a, b) => {
        const diff = sortOrder === 'desc' ? b.totalExpense - a.totalExpense : a.totalExpense - b.totalExpense;
        return diff !== 0 ? diff : b.dateKey.localeCompare(a.dateKey);
      });
    } else {
      list.sort((a, b) => {
        return sortOrder === 'desc'
          ? b.dateKey.localeCompare(a.dateKey)
          : a.dateKey.localeCompare(b.dateKey);
      });
    }

    // Inside each group, sort transactions to match
    return list.map((g) => {
      const txs = [...g.transactions];
      if (sortField === 'income') {
        txs.sort((a, b) => {
          const aVal = a.type === 'income' ? a.amount : -1;
          const bVal = b.type === 'income' ? b.amount : -1;
          return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
        });
      } else if (sortField === 'expense') {
        txs.sort((a, b) => {
          const aVal = a.type === 'expense' ? a.amount : -1;
          const bVal = b.type === 'expense' ? b.amount : -1;
          return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
        });
      }
      return { ...g, transactions: txs };
    });
  }, [dayGroups, sortField, sortOrder]);

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
      {/* Column Headers for Cash In (Green) and Cash Out (Rose) - Sortable */}
      {showHeader && (
        <div className="flex items-center justify-between px-2.5 sm:px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800/80 select-none">
          <button
            type="button"
            onClick={() => handleSort('date')}
            className={`flex items-center gap-1 whitespace-nowrap hover:text-slate-800 dark:hover:text-slate-200 transition-colors ${
              sortField === 'date' ? 'text-slate-900 dark:text-white font-extrabold' : ''
            }`}
            title="Sort by Date"
          >
            <span className="whitespace-nowrap">Details</span>
            {sortField === 'date' && (
              sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 shrink-0 stroke-[2.5]" /> : <ArrowUp className="w-3 h-3 shrink-0 stroke-[2.5]" />
            )}
          </button>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {/* Sortable Cash In Header */}
            <button
              type="button"
              onClick={() => handleSort('income')}
              className={`w-[66px] sm:w-24 !tracking-normal text-right flex items-center justify-end gap-0.5 sm:gap-1 px-0.5 sm:px-1 py-0.5 rounded whitespace-nowrap transition-all cursor-pointer ${
                sortField === 'income'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 font-black'
                  : 'text-emerald-600/80 dark:text-emerald-400/80 hover:text-emerald-600 hover:bg-emerald-500/10 font-bold'
              }`}
              title="Click to sort by Cash In amount"
            >
              <span className="whitespace-nowrap">Cash In</span>
              {sortField === 'income' ? (
                sortOrder === 'desc' ? (
                  <ArrowDown className="w-3 h-3 shrink-0 stroke-[2.5]" />
                ) : (
                  <ArrowUp className="w-3 h-3 shrink-0 stroke-[2.5]" />
                )
              ) : (
                <ArrowUpDown className="w-2.5 h-2.5 shrink-0 opacity-40 hover:opacity-100" />
              )}
            </button>

            {/* Sortable Cash Out Header */}
            <button
              type="button"
              onClick={() => handleSort('expense')}
              className={`w-[66px] sm:w-24 !tracking-normal text-right flex items-center justify-end gap-0.5 sm:gap-1 px-0.5 sm:px-1 py-0.5 rounded whitespace-nowrap transition-all cursor-pointer ${
                sortField === 'expense'
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30 font-black'
                  : 'text-rose-600/80 dark:text-rose-400/80 hover:text-rose-600 hover:bg-rose-500/10 font-bold'
              }`}
              title="Click to sort by Cash Out amount"
            >
              <span className="whitespace-nowrap">Cash Out</span>
              {sortField === 'expense' ? (
                sortOrder === 'desc' ? (
                  <ArrowDown className="w-3 h-3 shrink-0 stroke-[2.5]" />
                ) : (
                  <ArrowUp className="w-3 h-3 shrink-0 stroke-[2.5]" />
                )
              ) : (
                <ArrowUpDown className="w-2.5 h-2.5 shrink-0 opacity-40 hover:opacity-100" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Date Groups */}
      <div className="space-y-2.5">
        {sortedDayGroups.map((group) => (
          <div
            key={group.dateKey}
            className="volt-ledger-group bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-none"
          >
            {/* Date Header Row */}
            <div className="volt-date-header flex items-center justify-between py-2 px-3 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800/80">
              {/* Left: Organized Date Badge with Day-of-Week above Day Number */}
              <div className="flex items-center gap-2.5">
                {/* Calendar Date Block: Day of week on top, Day number below */}
                <div className="volt-date-block w-11 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs flex flex-col items-center justify-center shrink-0">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider leading-none mb-0.5 ${
                      group.dayName === 'Sun' || group.dayName === 'Sat'
                        ? 'text-rose-500 dark:text-rose-400'
                        : 'text-slate-500 dark:text-slate-400'
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
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/50 leading-none w-fit mt-0.5">
                      Today
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Cash In & Cash Out Day Totals */}
              <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                <div className="w-[66px] sm:w-24 text-right">
                  <span
                    className={`text-xs font-mono font-bold truncate block ${
                      group.totalIncome > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <span className="currency-symbol">{symbol}</span>{formatAmount(group.totalIncome)}
                  </span>
                </div>
                <div className="w-[66px] sm:w-24 text-right">
                  <span
                    className={`text-xs font-mono font-bold truncate block ${
                      group.totalExpense > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <span className="currency-symbol">{symbol}</span>{formatAmount(group.totalExpense)}
                  </span>
                </div>
              </div>
            </div>

            {/* Individual Records for that Day */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {group.transactions.map((tx) => (
                <SwipeRow
                  key={tx.id}
                  onClick={() => {
                    if (longPressTriggeredRef.current) {
                      longPressTriggeredRef.current = false;
                      return;
                    }
                    if (editingNoteId === tx.id) return;
                    onEdit(tx);
                  }}
                  onDelete={
                    onDelete
                      ? () => {
                          if (window.confirm('Delete this record? This cannot be undone.')) {
                            onDelete(tx.id);
                          }
                        }
                      : undefined
                  }
                >
                <div
                  className="ledger-row-front tx-row-in flex items-center justify-between py-2.5 px-2.5 sm:px-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  title="Tap to edit • long-press Details to rename inline • swipe left to delete"
                >
                  {/* Left: Description / Note (Primary), Time below, Receipt */}
                  <div
                    className="min-w-0 flex-1 pr-1.5 sm:pr-2 select-none"
                    onTouchStart={(e) => {
                      const t = e.touches[0];
                      if (t) startLongPress(tx, t.clientX, t.clientY);
                    }}
                    onTouchMove={(e) => {
                      const t = e.touches[0];
                      if (t) handlePressMove(t.clientX, t.clientY);
                    }}
                    onTouchEnd={clearLongPress}
                    onTouchCancel={clearLongPress}
                    onMouseDown={(e) => {
                      if (e.button === 0) startLongPress(tx, e.clientX, e.clientY);
                    }}
                    onMouseMove={(e) => handlePressMove(e.clientX, e.clientY)}
                    onMouseUp={clearLongPress}
                    onMouseLeave={clearLongPress}
                    onContextMenu={(e) => {
                      if (editingNoteId !== tx.id) {
                        e.preventDefault();
                        clearLongPress();
                        longPressTriggeredRef.current = true;
                        setEditingNoteId(tx.id);
                        setEditingNoteText(getDisplayTitle(tx));
                      }
                    }}
                  >
                    <div
                      className="flex items-start gap-1.5"
                      onClick={(e) => {
                        if (editingNoteId === tx.id) e.stopPropagation();
                      }}
                      onTouchStart={(e) => {
                        if (editingNoteId === tx.id) e.stopPropagation();
                      }}
                    >
                      <span
                        key={editingNoteId === tx.id ? `edit-${tx.id}` : `view-${tx.id}`}
                        ref={(el) => {
                          if (el && editingNoteId === tx.id && document.activeElement !== el) {
                            el.focus();
                            try {
                              const range = document.createRange();
                              range.selectNodeContents(el);
                              range.collapse(false);
                              const sel = window.getSelection();
                              sel?.removeAllRanges();
                              sel?.addRange(range);
                            } catch {}
                          }
                        }}
                        contentEditable={editingNoteId === tx.id}
                        suppressContentEditableWarning
                        onInput={(e) => setEditingNoteText(e.currentTarget.textContent || '')}
                        onKeyDown={(e) => {
                          if (editingNoteId !== tx.id) return;
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveInlineNote(tx, e.currentTarget.textContent || '');
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingNoteId(null);
                          }
                        }}
                        onBlur={(e) => {
                          if (editingNoteId === tx.id) {
                            saveInlineNote(tx, e.currentTarget.textContent || '');
                          }
                        }}
                        className={`text-xs font-bold text-slate-800 dark:text-slate-100 break-words leading-snug outline-none ${
                          editingNoteId === tx.id ? 'cursor-text select-text' : 'line-clamp-2'
                        }`}
                      >
                        {getDisplayTitle(tx)}
                      </span>
                      {editingNoteId === tx.id ? (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            saveInlineNote(tx);
                          }}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            saveInlineNote(tx);
                          }}
                          className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 shrink-0 p-0.5 active:scale-95"
                          title="Save title"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.8]" />
                        </button>
                      ) : (
                        tx.receipt_image && (
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
                        )
                      )}
                    </div>
                    {formatTransactionTime(tx) && (
                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate leading-tight mt-0.5">
                        {formatTransactionTime(tx)}
                      </div>
                    )}
                  </div>

                  {/* Right: Cash In (Green) & Cash Out (Rose) Columns */}
                  <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                    {/* Cash In (Green) */}
                    <div className="w-[66px] sm:w-24 text-right">
                      {tx.type === 'income' ? (
                        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate block">
                          <span className="currency-symbol">{symbol}</span>{formatAmount(tx.amount)}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-slate-300 dark:text-slate-600">
                          -
                        </span>
                      )}
                    </div>

                    {/* Cash Out (Rose) */}
                    <div className="w-[66px] sm:w-24 text-right">
                      {tx.type === 'expense' ? (
                        <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 truncate block">
                          <span className="currency-symbol">{symbol}</span>{formatAmount(tx.amount)}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-slate-300 dark:text-slate-600">
                          -
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                </SwipeRow>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default RecordLedger;

