'use client';

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Transaction } from '@/lib/types';
import {
  Inbox,
  Plus,
  FileText,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Trash2,
  Check,
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  X,
  CheckSquare,
  Square,
  ListChecks,
} from 'lucide-react';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { formatTransactionTime } from '@/lib/time-settings';
import { api } from '@/lib/api';
import { OfflineStorage, getAppMode } from '@/lib/offline-storage';
import { useFlowLabels } from '@/lib/ui-prefs';
import { useTranslation } from '@/lib/i18n';
import { triggerHaptic } from '@/lib/haptics';

interface RecordLedgerProps {
  transactions: Transaction[];
  currency: string;
  onEdit: (tx: Transaction) => void;
  onDelete?: (id: string) => void;
  onBatchDelete?: (ids: string[]) => void;
  onOpenAddModal?: () => void;
  emptyMessage?: string;
  showHeader?: boolean;
  onViewReceipt?: (imageUrl: string) => void;
  onOpenCalendar?: () => void;
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
        style={
          dx !== 0 || dragging
            ? {
              transform: `translate3d(${dx}px, 0, 0)`,
              transition: dragging ? 'none' : 'transform 180ms ease',
            }
            : undefined
        }
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const RecordLedger = React.memo(function RecordLedger({
  transactions,
  currency,
  onEdit,
  onDelete,
  onBatchDelete,
  onOpenAddModal,
  emptyMessage = 'No transactions recorded',
  showHeader = true,
  onViewReceipt,
  onOpenCalendar,
}: RecordLedgerProps) {
  const symbol = getCurrencySymbol(currency);
  const { inLabel, outLabel } = useFlowLabels();
  const { t } = useTranslation();

  // Bulk Selection & Batch Delete State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Notify system (e.g. BottomNav sticky stats) when bulk selection mode is active
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('cashflow-bulk-selection-mode', {
        detail: { active: isSelectionMode },
      })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('cashflow-bulk-selection-mode', {
          detail: { active: false },
        })
      );
    };
  }, [isSelectionMode]);

  const toggleSelectTx = useCallback((id: string) => {
    triggerHaptic('light');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    triggerHaptic('medium');
    setSelectedIds((prev) => {
      if (prev.size === transactions.length) {
        return new Set();
      }
      return new Set(transactions.map((t) => t.id));
    });
  }, [transactions]);

  const toggleSelectDayGroup = useCallback((groupTxs: Transaction[]) => {
    triggerHaptic('light');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allGroupSelected = groupTxs.every((t) => next.has(t.id));
      if (allGroupSelected) {
        groupTxs.forEach((t) => next.delete(t.id));
      } else {
        groupTxs.forEach((t) => next.add(t.id));
      }
      return next;
    });
  }, []);

  const handleExecuteBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const confirmed = window.confirm(
      `Delete ${count} selected ${count === 1 ? 'record' : 'records'}? They can be restored from Trash if needed.`
    );
    if (!confirmed) return;

    triggerHaptic('warning');
    const idsToDelete = Array.from(selectedIds);
    if (onBatchDelete) {
      onBatchDelete(idsToDelete);
    } else if (onDelete) {
      idsToDelete.forEach((id) => onDelete(id));
    }
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, [selectedIds, onBatchDelete, onDelete]);

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cashflow_ledger_view_mode');
        if (saved === 'calendar' || saved === 'list') {
          return saved;
        }
      } catch { }
    }
    return 'list';
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cashflow_ledger_view_mode');
      if (saved === 'calendar' || saved === 'list') {
        setViewMode(saved);
      }
    } catch { }
  }, []);

  const toggleViewMode = () => {
    triggerHaptic('light');
    setViewMode((prev) => {
      const next = prev === 'list' ? 'calendar' : 'list';
      try {
        localStorage.setItem('cashflow_ledger_view_mode', next);
      } catch (e) {
        console.error('Failed to save ledger view mode preference', e);
      }
      return next;
    });
  };
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [expandedDayKeys, setExpandedDayKeys] = useState<Record<string, boolean>>({});
  const toggleDayTotals = (key: string) =>
    setExpandedDayKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  const [noteOverrides, setNoteOverrides] = useState<Record<string, string>>({});

  // Distinct months present in transactions (YYYY-MM), sorted descending (latest first)
  const appearingMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      if (!isNaN(d.getTime())) {
        set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    });

    if (set.size === 0) {
      const now = new Date();
      set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }

    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const [customNavMonths, setCustomNavMonths] = useState<string[]>([]);
  const [selectedCalDayKey, setSelectedCalDayKey] = useState<string | null>(() => {
    if (transactions && transactions.length > 0) {
      const d = new Date(transactions[0].date);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [isDateDrawerOpen, setIsDateDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [drawerDragX, setDrawerDragX] = useState(0);
  const [isDrawerDragging, setIsDrawerDragging] = useState(false);
  const drawerStartX = useRef(0);
  const drawerStartY = useRef(0);
  const drawerStartTime = useRef(0);
  const isDrawerHorizontal = useRef<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    drawerStartX.current = t.clientX;
    drawerStartY.current = t.clientY;
    drawerStartTime.current = Date.now();
    isDrawerHorizontal.current = null;
  };

  const handleDrawerTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const diffX = t.clientX - drawerStartX.current;
    const diffY = t.clientY - drawerStartY.current;

    if (isDrawerHorizontal.current === null && (Math.abs(diffX) > 6 || Math.abs(diffY) > 6)) {
      isDrawerHorizontal.current = Math.abs(diffX) > Math.abs(diffY) && diffX > 0;
      if (isDrawerHorizontal.current) setIsDrawerDragging(true);
    }

    if (isDrawerHorizontal.current) {
      setDrawerDragX(Math.max(0, diffX));
    }
  };

  const handleDrawerTouchEnd = () => {
    if (!isDrawerHorizontal.current) {
      setIsDrawerDragging(false);
      return;
    }
    const elapsed = Math.max(1, Date.now() - drawerStartTime.current);
    const velocity = drawerDragX / elapsed;
    setIsDrawerDragging(false);
    setDrawerDragX(0);
    isDrawerHorizontal.current = null;

    if (drawerDragX > 80 || velocity > 0.35) {
      setIsDateDrawerOpen(false);
    }
  };
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
        } catch { }
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
        api.updateTransaction(tx.id, payload).catch(() => { });
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

  // Group transactions by day (uses fast array lookup instead of Intl.DateTimeFormat per row)
  const dayGroups: DayGroup[] = useMemo(() => {
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
          dayName: WEEKDAYS[d.getDay()] || 'Day',
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
      } else {
        txs.sort((a, b) => {
          const timeA = new Date(a.date).getTime() || 0;
          const timeB = new Date(b.date).getTime() || 0;
          return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });
      }
      return { ...g, transactions: txs };
    });
  }, [dayGroups, sortField, sortOrder]);

  // Dynamically calculate Cash In and Cash Out column widths based on the largest amount
  // so large numbers (e.g. ৳10,000,000.00) never truncate while keeping columns compact for normal numbers
  const { inColWidth, outColWidth } = useMemo(() => {
    let maxInLen = Math.max(7, inLabel.length + 2);
    let maxOutLen = Math.max(8, outLabel.length + 2);

    for (const g of sortedDayGroups) {
      const dayInLen = symbol.length + formatAmount(g.totalIncome).length;
      const dayOutLen = symbol.length + formatAmount(g.totalExpense).length;
      if (dayInLen > maxInLen) maxInLen = dayInLen;
      if (dayOutLen > maxOutLen) maxOutLen = dayOutLen;

      for (const tx of g.transactions) {
        const len = symbol.length + formatAmount(tx.amount).length;
        if (tx.type === 'income') {
          if (len > maxInLen) maxInLen = len;
        } else {
          if (len > maxOutLen) maxOutLen = len;
        }
      }
    }

    return {
      inColWidth: Math.max(74, Math.ceil(maxInLen * 7.2) + 4),
      outColWidth: Math.max(74, Math.ceil(maxOutLen * 7.2) + 4),
    };
  }, [sortedDayGroups, symbol, inLabel, outLabel]);

  // List of all months to render in the calendar view
  const monthsToRender = useMemo(() => {
    return Array.from(new Set([...appearingMonths, ...customNavMonths])).sort((a, b) => b.localeCompare(a));
  }, [appearingMonths, customNavMonths]);

  // Compute month calendar cells & statistics dynamically for any given year and month
  const getMonthData = useCallback((year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);

    let totIncome = 0;
    let totExpense = 0;
    let totCount = 0;

    const dayDataMap: Record<number, { income: number; expense: number; count: number; transactions: Transaction[] }> = {};

    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!dayDataMap[day]) {
          dayDataMap[day] = { income: 0, expense: 0, count: 0, transactions: [] };
        }
        if (tx.type === 'income') {
          dayDataMap[day].income += tx.amount;
          totIncome += tx.amount;
        } else if (tx.type === 'expense') {
          dayDataMap[day].expense += tx.amount;
          totExpense += tx.amount;
        }
        dayDataMap[day].count += 1;
        totCount += 1;
        dayDataMap[day].transactions.push(tx);
      }
    });

    const cells: Array<{
      blank: boolean;
      key: string;
      day?: number;
      dateKey?: string;
      isToday?: boolean;
      income?: number;
      expense?: number;
      count?: number;
      transactions?: Transaction[];
    }> = [];

    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ blank: true, key: `blank-${year}-${month}-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const data = dayDataMap[day] || { income: 0, expense: 0, count: 0, transactions: [] };
      cells.push({
        blank: false,
        key: dateKey,
        day,
        dateKey,
        isToday: dateKey === todayStr,
        income: data.income,
        expense: data.expense,
        count: data.count,
        transactions: data.transactions,
      });
    }

    return {
      year,
      month,
      calendarCells: cells,
      monthTotalIncome: totIncome,
      monthTotalExpense: totExpense,
      monthTotalCount: totCount,
    };
  }, [transactions]);

  const selectedDayTransactions = useMemo(() => {
    if (!selectedCalDayKey) return [];
    return transactions.filter((tx) => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return key === selectedCalDayKey;
    });
  }, [selectedCalDayKey, transactions]);

  const selectedDayTotals = useMemo(() => {
    let inc = 0;
    let exp = 0;
    selectedDayTransactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') inc += amt;
      else exp += amt;
    });
    return {
      income: inc,
      expense: exp,
      balance: inc - exp,
    };
  }, [selectedDayTransactions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDateDrawerOpen) {
        setIsDateDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDateDrawerOpen]);

  const handlePrevMonth = (baseYear: number, baseMonth: number) => {
    let newYear = baseYear;
    let newMonth = baseMonth - 1;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    const newKey = `${newYear}-${String(newMonth + 1).padStart(2, '0')}`;
    setCustomNavMonths((prev) => Array.from(new Set([...prev, newKey])));
  };

  const handleNextMonth = (baseYear: number, baseMonth: number) => {
    let newYear = baseYear;
    let newMonth = baseMonth + 1;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    const newKey = `${newYear}-${String(newMonth + 1).padStart(2, '0')}`;
    setCustomNavMonths((prev) => Array.from(new Set([...prev, newKey])));
  };

  const renderTransactionRow = (tx: Transaction) => {
    const isSelected = selectedIds.has(tx.id);

    if (isSelectionMode) {
      return (
        <div
          key={tx.id}
          onClick={() => toggleSelectTx(tx.id)}
          className={`ledger-row-front flex items-center justify-between py-2.5 px-2.5 sm:px-3 cursor-pointer transition-all select-none ${isSelected
            ? 'bg-rose-50/80 dark:bg-rose-950/40 border-l-4 border-rose-500'
            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
            }`}
        >
          {/* Checkbox */}
          <div className="mr-2.5 shrink-0">
            {isSelected ? (
              <div className="w-5 h-5 rounded-md bg-rose-600 text-white flex items-center justify-center shadow-xs animate-in zoom-in-75 duration-100">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
            )}
          </div>

          {/* Left: Description / Note (Primary), Time below, Receipt */}
          <div className="min-w-0 flex-1 pr-1">
            <div className="flex items-start gap-1.5">
              <span className="text-xs sm:text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate block">
                {getDisplayTitle(tx)}
              </span>
              {tx.receipt_image && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewReceipt?.(tx.receipt_image!);
                  }}
                  className="inline-flex items-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              <span className="font-mono">{formatTransactionTime(tx.date)}</span>
              {tx.category && (
                <span className="truncate max-w-[120px]">{tx.category.name}</span>
              )}
            </div>
          </div>

          {/* Right: Amounts in separate columns matching the header */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Cash In Column */}
            <div style={{ width: `${inColWidth}px` }} className="sm:!w-auto sm:min-w-[96px] text-right">
              {tx.type === 'income' ? (
                <span className="text-xs sm:text-[13px] font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  <span className="currency-symbol mr-0.5">{symbol}</span>{formatAmount(tx.amount)}
                </span>
              ) : null}
            </div>

            {/* Cash Out Column */}
            <div style={{ width: `${outColWidth}px` }} className="sm:!w-auto sm:min-w-[96px] text-right">
              {tx.type === 'expense' ? (
                <span className="text-xs sm:text-[13px] font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                  <span className="currency-symbol mr-0.5">{symbol}</span>{formatAmount(tx.amount)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    return (
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
          className="ledger-row-front flex items-center justify-between py-2.5 px-2.5 sm:px-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
          title="Tap to edit • long-press Details to rename inline • swipe left to delete"
        >
          {/* Left: Description / Note (Primary), Time below, Receipt */}
          <div
            className="min-w-0 flex-1 pr-1 select-none"
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
                    } catch { }
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
                className={`text-xs font-bold text-slate-800 dark:text-slate-100 break-words leading-snug outline-none ${editingNoteId === tx.id ? 'cursor-text select-text' : 'line-clamp-2'
                  }`}
              >
                {getDisplayTitle(tx)}
              </span>
              {editingNoteId === tx.id && (
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
              )}
            </div>
            {formatTransactionTime(tx) && (
              <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate leading-tight mt-0.5">
                {formatTransactionTime(tx)}
              </div>
            )}
          </div>

          {/* Right: Cash In (Green) & Cash Out (Rose) Columns */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Cash In (Green) */}
            <div style={{ width: `${inColWidth}px` }} className="sm:!w-auto sm:min-w-[96px] text-right">
              {tx.type === 'income' ? (
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap block">
                  <span className="currency-symbol">{symbol}</span>{formatAmount(tx.amount)}
                </span>
              ) : (
                <span className="text-xs font-mono text-slate-300 dark:text-slate-600">
                  -
                </span>
              )}
            </div>

            {/* Cash Out (Rose) */}
            <div style={{ width: `${outColWidth}px` }} className="sm:!w-auto sm:min-w-[96px] text-right">
              {tx.type === 'expense' ? (
                <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap block">
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
    );
  };

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
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => handleSort('date')}
              className={`flex items-center gap-1 whitespace-nowrap hover:text-slate-800 dark:hover:text-slate-200 transition-colors ${sortField === 'date' ? 'text-slate-900 dark:text-white font-extrabold' : ''
                }`}
              title="Sort by Date"
            >
              <span className="whitespace-nowrap">{t('details')}</span>
            </button>

            {/* 1-Tap Toggle between List View and Month Calendar of all entries */}
            <button
              type="button"
              onClick={toggleViewMode}
              className={`w-6 h-6 rounded flex items-center justify-center transition-all focus:outline-none ${viewMode === 'calendar'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95'
                }`}
              aria-label={viewMode === 'calendar' ? 'Switch to List view' : 'Calendar view of active month'}
              title={viewMode === 'calendar' ? 'Switch to List view' : 'Calendar view of active month'}
            >
              {viewMode === 'calendar' ? (
                <List className="w-3.5 h-3.5" />
              ) : (
                <Calendar className="w-3.5 h-3.5" />
              )}
            </button>

            {/* 1-Tap Toggle for Bulk Selection & Batch Delete */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsSelectionMode((prev) => !prev);
                if (isSelectionMode) setSelectedIds(new Set());
              }}
              className={`w-6 h-6 rounded flex items-center justify-center transition-all focus:outline-none active:scale-95 ${isSelectionMode
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              title={isSelectionMode ? 'Exit Selection Mode' : 'Bulk Select & Delete'}
              aria-label={isSelectionMode ? 'Exit Selection Mode' : 'Bulk Select & Delete'}
            >
              {isSelectionMode ? (
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <ListChecks className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Sortable Cash In Header */}
            <button
              type="button"
              onClick={() => handleSort('income')}
              style={{ width: `${inColWidth}px` }}
              className={`sm:!w-auto sm:min-w-[96px] !tracking-normal text-right flex items-center justify-end gap-0.5 sm:gap-1 px-0.5 sm:px-1 py-0.5 rounded whitespace-nowrap transition-all cursor-pointer ${sortField === 'income'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 font-black'
                : 'text-emerald-600/80 dark:text-emerald-400/80 hover:text-emerald-600 hover:bg-emerald-500/10 font-bold'
                }`}
              title={`Click to sort by ${inLabel} amount`}
            >
              <span className="whitespace-nowrap">{inLabel}</span>
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
              style={{ width: `${outColWidth}px` }}
              className={`sm:!w-auto sm:min-w-[96px] !tracking-normal text-right flex items-center justify-end gap-0.5 sm:gap-1 px-0.5 sm:px-1 py-0.5 rounded whitespace-nowrap transition-all cursor-pointer ${sortField === 'expense'
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30 font-black'
                : 'text-rose-600/80 dark:text-rose-400/80 hover:text-rose-600 hover:bg-rose-500/10 font-bold'
                }`}
              title={`Click to sort by ${outLabel} amount`}
            >
              <span className="whitespace-nowrap">{outLabel}</span>
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

      {/* View Switch: Calendar of Active Month VS Chronological List */}
      {viewMode === 'calendar' ? (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Render Calendar Block for each appearing month */}
          {monthsToRender.map((mKey) => {
            const yr = parseInt(mKey.slice(0, 4), 10);
            const mo = parseInt(mKey.slice(5, 7), 10) - 1;
            const mData = getMonthData(yr, mo);

            return (
              <div key={mKey} className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-3 shadow-none">
                {/* Month Navigator Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white font-mono truncate">
                      {MONTH_NAMES[mo]} {yr}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      ({mData.monthTotalCount} {mData.monthTotalCount === 1 ? 'entry' : 'entries'})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Month Cashflow Quick Summary */}
                    <div className="hidden xs:flex items-center gap-2 mr-1 text-[10px] font-mono font-bold">
                      {mData.monthTotalIncome > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          +{symbol}{formatAmount(mData.monthTotalIncome).split('.')[0]}
                        </span>
                      )}
                      {mData.monthTotalExpense > 0 && (
                        <span className="text-rose-600 dark:text-rose-400">
                          -{symbol}{formatAmount(mData.monthTotalExpense).split('.')[0]}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePrevMonth(yr, mo)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNextMonth(yr, mo)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Weekdays Row */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 select-none">
                  <span className="text-rose-500">Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span className="text-rose-500">Sat</span>
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {mData.calendarCells.map((cell) => {
                    if (cell.blank) {
                      return <div key={cell.key} className="h-12 sm:h-14 rounded-md" />;
                    }

                    const isSelected = selectedCalDayKey === cell.dateKey;
                    const hasIncome = (cell.income || 0) > 0;
                    const hasExpense = (cell.expense || 0) > 0;
                    const hasEntries = (cell.count || 0) > 0;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => {
                          if (cell.dateKey) {
                            setSelectedCalDayKey(cell.dateKey);
                            setIsDateDrawerOpen(true);
                          }
                        }}
                        className={`h-12 sm:h-14 rounded-md flex flex-col items-center justify-between p-1 transition-all border text-xs select-none ${isSelected
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-1 ring-emerald-500/30 shadow-xs'
                          : cell.isToday
                            ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/10'
                            : 'border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                      >
                        <div className="w-full flex items-center justify-between">
                          <span className={`text-[11px] font-mono leading-none ${isSelected ? 'font-black text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
                            }`}>
                            {cell.day}
                          </span>
                          {cell.isToday && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          )}
                        </div>

                        <div className="w-full flex flex-col items-center gap-0.5 leading-none">
                          {hasIncome && (
                            <span className="w-full text-center text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate leading-none">
                              +{formatAmount(cell.income || 0).split('.')[0]}
                            </span>
                          )}
                          {hasExpense && (
                            <span className="w-full text-center text-[9px] font-mono font-bold text-rose-600 dark:text-rose-400 truncate leading-none">
                              -{formatAmount(cell.expense || 0).split('.')[0]}
                            </span>
                          )}
                          {!hasEntries && (
                            <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Slide-over Right Sidebar Drawer for Selected Date Transactions */}
          {mounted && isDateDrawerOpen && selectedCalDayKey && typeof document !== 'undefined' &&
            createPortal(
              <div className="fixed inset-0 z-[99999] flex justify-end">
                {/* Backdrop overlay */}
                <div
                  onClick={() => setIsDateDrawerOpen(false)}
                  onTouchStart={handleDrawerTouchStart}
                  onTouchMove={handleDrawerTouchMove}
                  onTouchEnd={handleDrawerTouchEnd}
                  onTouchCancel={handleDrawerTouchEnd}
                  style={{
                    opacity: isDrawerDragging ? Math.max(0.15, 1 - drawerDragX / 280) : 1,
                  }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
                  aria-hidden="true"
                />

                {/* Right Sidebar Drawer Panel */}
                <div
                  onTouchStart={handleDrawerTouchStart}
                  onTouchMove={handleDrawerTouchMove}
                  onTouchEnd={handleDrawerTouchEnd}
                  onTouchCancel={handleDrawerTouchEnd}
                  style={
                    isDrawerDragging
                      ? {
                        transform: `translate3d(${drawerDragX}px, 0, 0)`,
                        transition: 'none',
                      }
                      : undefined
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-80 max-w-[85vw] sm:w-[400px] sm:max-w-[85vw] h-full h-[100dvh] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 overflow-hidden will-change-transform"
                >
                  <div
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-12 rounded-full bg-slate-300/80 dark:bg-slate-700/80 pointer-events-none z-20"
                    aria-hidden="true"
                  />

                  {/* Header */}
                  <div
                    className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900"
                    style={{
                      paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono truncate">
                            {selectedCalDayKey}
                          </h3>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {selectedDayTransactions.length} {selectedDayTransactions.length === 1 ? 'record' : 'records'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium block truncate">
                          {(() => {
                            const [y, m, d] = selectedCalDayKey.split('-').map(Number);
                            const dateObj = new Date(y, m - 1, d);
                            return dateObj.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
                          })()}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDateDrawerOpen(false)}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Day Summary Strip */}
                  <div className="px-4 py-2 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        +{symbol}{formatAmount(selectedDayTotals.income)}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        -{symbol}{formatAmount(selectedDayTotals.expense)}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono font-extrabold">
                      <span className="text-slate-400 font-normal mr-1">Net:</span>
                      <span className={selectedDayTotals.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {selectedDayTotals.balance >= 0 ? '+' : '-'}{symbol}{formatAmount(Math.abs(selectedDayTotals.balance))}
                      </span>
                    </div>
                  </div>

                  {/* Scrollable Transactions List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1 overscroll-contain">
                    {selectedDayTransactions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 text-xs px-4">
                        <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2 stroke-1" />
                        <p>No transactions recorded on this date.</p>
                      </div>
                    ) : (
                      selectedDayTransactions.map(renderTransactionRow)
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 shrink-0 mt-auto"
                    style={{
                      paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 14px), 16px)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setIsDateDrawerOpen(false)}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
                    >
                      Close
                    </button>

                    {onOpenAddModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsDateDrawerOpen(false);
                          onOpenAddModal();
                        }}
                        className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Transaction
                      </button>
                    )}
                  </div>
                </div>
              </div>,
              document.body
            )
          }
        </div>
      ) : (
        /* Date Groups */
        <div className="space-y-2.5">
          {sortedDayGroups.map((group) => (
            <div
              key={group.dateKey}
              className="volt-ledger-group bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-none"
            >
              {/* Date Header Row (tap anywhere to show/hide Cash In & Cash Out day totals) */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={Boolean(expandedDayKeys[group.dateKey])}
                onClick={() => toggleDayTotals(group.dateKey)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleDayTotals(group.dateKey);
                  }
                }}
                className="volt-date-header flex items-center justify-between py-2 px-3 bg-transparent border-b border-slate-200/80 dark:border-slate-800/80 cursor-pointer select-none"
                title="Tap to show/hide day totals"
              >
                {/* Left: Organized Date Badge with Day-of-Week above Day Number */}
                <div className="flex items-center gap-2.5">
                  {isSelectionMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectDayGroup(group.transactions);
                      }}
                      className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Select all on this day"
                    >
                      {group.transactions.every((t) => selectedIds.has(t.id)) ? (
                        <div className="w-5 h-5 rounded-md bg-rose-600 text-white flex items-center justify-center shadow-xs animate-in zoom-in-75 duration-100">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
                      )}
                    </button>
                  )}

                  {/* Calendar Date Block: Day of week on top, Day number below */}
                  <div className="volt-date-block w-11 py-1 rounded-[8px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs flex flex-col items-center justify-center shrink-0">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider leading-none mb-0.5 ${group.dayName === 'Sun' || group.dayName === 'Sat'
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
                    <span className="text-xs font-medium font-mono text-slate-500 dark:text-slate-400 leading-tight">
                      {group.yearMonth}
                    </span>
                    {group.isToday && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/50 leading-none w-fit mt-0.5">
                        Today
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Cash In & Cash Out Day Totals (shown only after tapping the header row) */}
                {expandedDayKeys[group.dateKey] ? (
                  <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 animate-in fade-in duration-150">
                    <div style={{ width: `${inColWidth}px` }} className="sm:!w-auto sm:min-w-[96px] text-right">
                      <span
                        className={`text-xs font-mono font-bold whitespace-nowrap block ${group.totalIncome > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-400 dark:text-slate-500'
                          }`}
                      >
                        <span className="currency-symbol">{symbol}</span>{formatAmount(group.totalIncome)}
                      </span>
                    </div>

                    <div style={{ width: `${outColWidth}px` }} className="sm:!w-auto sm:min-w-[96px] text-right">
                      <span
                        className={`text-xs font-mono font-bold whitespace-nowrap block ${group.totalExpense > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-400 dark:text-slate-500'
                          }`}
                      >
                        <span className="currency-symbol">{symbol}</span>{formatAmount(group.totalExpense)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Individual Records for that Day */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {group.transactions.map(renderTransactionRow)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Bulk Action Bar when Selection Mode is Active */}
      {isSelectionMode && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xl p-2.5 sm:px-4 flex items-center justify-between gap-2.5 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-all shrink-0"
            >
              {selectedIds.size === transactions.length ? (
                <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>{selectedIds.size === transactions.length ? 'Deselect All' : 'Select All'}</span>
            </button>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
              {selectedIds.size} / {transactions.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSelectedIds(new Set());
                setIsSelectionMode(false);
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={handleExecuteBatchDelete}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${selectedIds.size > 0
                ? 'bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-rose-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default RecordLedger;

