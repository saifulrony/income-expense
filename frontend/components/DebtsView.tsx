'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  HandCoins,
  Plus,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle2,
  Trash2,
  Pencil,
  BellRing,
  PlusCircle,
  User,
  X,
  Scale,
} from 'lucide-react';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { useTranslation } from '@/lib/i18n';
import { triggerHaptic } from '@/lib/haptics';
import {
  recordInAppNotification,
  fireLockScreenOSNotification,
  requestNotificationPermission,
} from '@/lib/notifications';

export interface DebtRecord {
  id: string;
  person_name: string;
  direction: 'payable' | 'receivable'; // payable = Loan Taken, receivable = Loan Given
  total_amount: number;
  paid_amount: number;
  due_date?: string; // YYYY-MM-DD
  note?: string;
  is_settled: boolean;
  created_at: string;
}

const STORAGE_KEY = 'cashflow_debts_tracker';

function getStoredDebts(): DebtRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial: DebtRecord[] = [
        {
          id: 'debt_sample_1',
          person_name: 'Rahim Ahmed',
          direction: 'receivable',
          total_amount: 5000,
          paid_amount: 2000,
          due_date: '2026-12-15',
          note: 'Personal loan',
          is_settled: false,
          created_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveStoredDebts(list: DebtRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save debts', err);
  }
}

interface DebtsViewProps {
  currency?: string;
  onLogTransaction?: (data: {
    type: 'income' | 'expense';
    amount?: number;
    note: string;
    date: string;
  }) => void;
}

export default function DebtsView({ currency = 'BDT', onLogTransaction }: DebtsViewProps) {
  const { t } = useTranslation();
  const symbol = getCurrencySymbol(currency);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'receivable' | 'payable' | 'settled'>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtRecord | null>(null);
  const [paymentDebt, setPaymentDebt] = useState<DebtRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [logToLedger, setLogToLedger] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Touch swipe-right-to-close gesture state
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  // Form states
  const [formPerson, setFormPerson] = useState('');
  const [formDirection, setFormDirection] = useState<'payable' | 'receivable'>('receivable');
  const [formTotal, setFormTotal] = useState('');
  const [formPaid, setFormPaid] = useState('0');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNote, setFormNote] = useState('');

  useEffect(() => {
    setMounted(true);
    setDebts(getStoredDebts());
  }, []);

  const isAnyDrawerOpen = Boolean(isSidebarOpen || paymentDebt);

  useEffect(() => {
    if (!isAnyDrawerOpen) {
      setDragX(0);
      setIsDragging(false);
      isHorizontalSwipeRef.current = null;
    }
  }, [isAnyDrawerOpen]);

  const closeDrawers = () => {
    setIsSidebarOpen(false);
    setPaymentDebt(null);
    setDragX(0);
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isAnyDrawerOpen) return;
    const t = e.touches[0];
    if (!t) return;
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    startTimeRef.current = Date.now();
    isHorizontalSwipeRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isAnyDrawerOpen) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;

    if (isHorizontalSwipeRef.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      isHorizontalSwipeRef.current = Math.abs(dx) > Math.abs(dy) && dx > 0;
      if (isHorizontalSwipeRef.current) {
        setIsDragging(true);
      }
    }

    if (isHorizontalSwipeRef.current) {
      setDragX(Math.max(0, dx));
    }
  };

  const handleTouchEnd = () => {
    if (!isHorizontalSwipeRef.current) {
      setIsDragging(false);
      return;
    }
    const elapsed = Math.max(1, Date.now() - startTimeRef.current);
    const velocity = dragX / elapsed;
    const shouldClose = dragX > 75 || velocity > 0.35;

    setIsDragging(false);
    setDragX(0);
    isHorizontalSwipeRef.current = null;

    if (shouldClose) {
      closeDrawers();
    }
  };

  const stats = useMemo(() => {
    let takenRemaining = 0;
    let givenRemaining = 0;
    let takenCount = 0;
    let givenCount = 0;
    let settledCount = 0;

    debts.forEach((d) => {
      const rem = Math.max(0, (d.total_amount || 0) - (d.paid_amount || 0));
      const isDone = d.is_settled || rem <= 0;
      if (isDone) {
        settledCount += 1;
      } else if (d.direction === 'payable') {
        takenRemaining += rem;
        takenCount += 1;
      } else {
        givenRemaining += rem;
        givenCount += 1;
      }
    });

    return {
      takenRemaining,
      givenRemaining,
      netPosition: givenRemaining - takenRemaining,
      takenCount,
      givenCount,
      settledCount,
    };
  }, [debts]);

  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      const rem = Math.max(0, d.total_amount - d.paid_amount);
      const isDone = d.is_settled || rem <= 0;
      if (filter === 'settled') return isDone;
      if (filter === 'payable') return !isDone && d.direction === 'payable';
      if (filter === 'receivable') return !isDone && d.direction === 'receivable';
      return true;
    });
  }, [debts, filter]);

  const openCreateSidebar = (defaultDir: 'payable' | 'receivable' = 'receivable') => {
    setEditingDebt(null);
    setPaymentDebt(null);
    setFormPerson('');
    setFormDirection(defaultDir);
    setFormTotal('');
    setFormPaid('0');
    setFormDueDate('');
    setFormNote('');
    setIsSidebarOpen(true);
  };

  const openEditSidebar = (d: DebtRecord) => {
    setEditingDebt(d);
    setPaymentDebt(null);
    setFormPerson(d.person_name);
    setFormDirection(d.direction);
    setFormTotal(String(d.total_amount));
    setFormPaid(String(d.paid_amount));
    setFormDueDate(d.due_date || '');
    setFormNote(d.note || '');
    setIsSidebarOpen(true);
  };

  const handleSaveDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const totalNum = parseFloat(formTotal);
    const paidNum = parseFloat(formPaid || '0') || 0;
    if (!formPerson.trim() || isNaN(totalNum) || totalNum <= 0) return;

    triggerHaptic('success');
    const isSettled = paidNum >= totalNum;
    let updated: DebtRecord[];

    if (editingDebt) {
      updated = debts.map((d) =>
        d.id === editingDebt.id
          ? {
              ...d,
              person_name: formPerson.trim(),
              direction: formDirection,
              total_amount: totalNum,
              paid_amount: paidNum,
              due_date: formDueDate || undefined,
              note: formNote.trim() || undefined,
              is_settled: isSettled,
            }
          : d
      );
      setFeedback('Loan updated!');
    } else {
      const newDebt: DebtRecord = {
        id: `debt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        person_name: formPerson.trim(),
        direction: formDirection,
        total_amount: totalNum,
        paid_amount: paidNum,
        due_date: formDueDate || undefined,
        note: formNote.trim() || undefined,
        is_settled: isSettled,
        created_at: new Date().toISOString(),
      };
      updated = [newDebt, ...debts];
      setFeedback(formDirection === 'receivable' ? 'Loan Given recorded!' : 'Loan Taken recorded!');
    }

    setDebts(updated);
    saveStoredDebts(updated);
    setIsSidebarOpen(false);
    setTimeout(() => setFeedback(null), 2500);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDebt) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) return;

    triggerHaptic('success');
    const nextPaid = Math.min(paymentDebt.total_amount, (paymentDebt.paid_amount || 0) + amt);
    const nextSettled = nextPaid >= paymentDebt.total_amount;

    const updated = debts.map((d) =>
      d.id === paymentDebt.id
        ? { ...d, paid_amount: nextPaid, is_settled: nextSettled }
        : d
    );
    setDebts(updated);
    saveStoredDebts(updated);

    if (logToLedger && onLogTransaction) {
      onLogTransaction({
        type: paymentDebt.direction === 'payable' ? 'expense' : 'income',
        amount: amt,
        note:
          paymentDebt.direction === 'payable'
            ? `Loan Repayment to ${paymentDebt.person_name}`
            : `Loan Collected from ${paymentDebt.person_name}`,
        date: new Date().toISOString().slice(0, 10),
      });
    }

    setFeedback(`Saved ${symbol}${formatAmount(amt)} for ${paymentDebt.person_name}!`);
    setPaymentDebt(null);
    setPaymentAmount('');
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleDelete = (id: string) => {
    triggerHaptic('warning');
    if (confirm('Delete this loan record?')) {
      const updated = debts.filter((d) => d.id !== id);
      setDebts(updated);
      saveStoredDebts(updated);
    }
  };

  const handleSendDebtAlert = async (item: DebtRecord) => {
    triggerHaptic('success');
    await requestNotificationPermission();
    const rem = Math.max(0, item.total_amount - item.paid_amount);
    const title =
      item.direction === 'payable'
        ? `💸 Loan Taken: Pay ${item.person_name}`
        : `💰 Loan Given: Collect from ${item.person_name}`;
    const body = `Remaining: ${symbol}${formatAmount(rem)} of ${symbol}${formatAmount(item.total_amount)}${
      item.due_date ? ` • Due ${item.due_date}` : ''
    }`;

    recordInAppNotification({
      type: 'reminder',
      title,
      body,
    });

    await fireLockScreenOSNotification({
      title,
      body,
      tag: `debt_${item.id}`,
    });

    setFeedback(`Alert for "${item.person_name}" sent to Notification Icon & Lock Screen!`);
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-3.5 pb-20 lg:pb-8 animate-in fade-in duration-200">
      {feedback && (
        <div className="p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Minimal Header with Quick Buttons for Loan Given & Loan Taken */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-bold text-slate-900 dark:text-white">
          Loans &amp; Debts
        </h1>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => openCreateSidebar('receivable')}
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shadow-xs flex items-center gap-1 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('loanGiven')}</span>
          </button>
          <button
            type="button"
            onClick={() => openCreateSidebar('payable')}
            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold shadow-xs flex items-center gap-1 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('loanTaken')}</span>
          </button>
        </div>
      </div>

      {/* 3 Minimal Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 mb-0.5">
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-bold uppercase">Given ({stats.givenCount})</span>
          </div>
          <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
            {symbol}{formatAmount(stats.givenRemaining)}
          </div>
        </div>

        <div className="p-2.5 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400 mb-0.5">
            <TrendingDown className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-bold uppercase">Taken ({stats.takenCount})</span>
          </div>
          <div className="text-sm font-black font-mono text-rose-600 dark:text-rose-400 truncate">
            {symbol}{formatAmount(stats.takenRemaining)}
          </div>
        </div>

        <div className="p-2.5 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 mb-0.5">
            <Scale className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-bold uppercase">Net</span>
          </div>
          <div
            className={`text-sm font-black font-mono truncate ${
              stats.netPosition >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {stats.netPosition >= 0 ? '+' : '-'}
            {symbol}{formatAmount(Math.abs(stats.netPosition))}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'all', label: `All (${debts.length})` },
            { id: 'receivable', label: `${t('loanGiven')} (${stats.givenCount})` },
            { id: 'payable', label: `${t('loanTaken')} (${stats.takenCount})` },
            { id: 'settled', label: `${t('done')} (${stats.settledCount})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all shrink-0 ${
              filter === t.id
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Minimal Loan Cards */}
      <div className="space-y-2">
        {filteredDebts.length === 0 ? (
          <div className="p-7 text-center bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-1.5">
            <HandCoins className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              No loan records
            </h3>
            <p className="text-[11px] text-slate-400">
              Tap &quot;Loan Given&quot; or &quot;Loan Taken&quot; above to add a record.
            </p>
          </div>
        ) : (
          filteredDebts.map((item) => {
            const rem = Math.max(0, item.total_amount - item.paid_amount);
            const pct =
              item.total_amount > 0
                ? Math.min(100, Math.round((item.paid_amount / item.total_amount) * 100))
                : 0;
            const isSettled = item.is_settled || rem <= 0;
            const isGiven = item.direction === 'receivable';

            return (
              <div
                key={item.id}
                onClick={() => openEditSidebar(item)}
                className={`p-3 bg-white dark:bg-slate-800/90 rounded-[10px] border shadow-xs transition-all space-y-2 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 ${
                  isSettled
                    ? 'opacity-60 border-slate-200 dark:border-slate-800'
                    : 'border-slate-200/80 dark:border-slate-700/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2.5">
                  {/* Left: Person & Compact Subline */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0 shadow-xs ${
                        isGiven ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    >
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.person_name}
                        </h3>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                            isGiven
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                          }`}
                        >
                          {isGiven ? 'Given' : 'Taken'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {item.due_date ? `Due ${item.due_date}` : item.note || 'No due date'}
                        {item.due_date && item.note ? ` • ${item.note}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Right: Remaining Amount & Minimal Icon Actions */}
                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-right">
                      <div
                        className={`text-xs font-bold font-mono ${
                          isSettled
                            ? 'text-slate-400 line-through'
                            : isGiven
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {symbol}{formatAmount(rem)}
                      </div>
                      <div className="text-[9px] font-mono text-slate-400">
                        of {symbol}{formatAmount(item.total_amount)}
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5">
                      {!isSettled && (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentDebt(item);
                            setIsSidebarOpen(false);
                            setPaymentAmount(String(rem));
                            setLogToLedger(true);
                          }}
                          className="p-1.5 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                          title={isGiven ? 'Collect Loan' : 'Repay Loan'}
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSendDebtAlert(item)}
                        className="p-1.5 rounded text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                        title="Send Reminder Alert"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Minimal 1px Progress Bar (only when partially paid) */}
                {item.paid_amount > 0 && (
                  <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isGiven ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Loan Right Sidebar */}
      {mounted && isSidebarOpen && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex justify-end">
            <div
              onClick={closeDrawers}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              style={{
                opacity: isDragging ? Math.max(0.15, 1 - dragX / 280) : 1,
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            />

            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              style={
                isDragging
                  ? {
                      transform: `translate3d(${dragX}px, 0, 0)`,
                      transition: 'none',
                    }
                  : undefined
              }
              onClick={(e) => e.stopPropagation()}
              className="relative w-80 max-w-[85vw] sm:w-[380px] sm:max-w-[85vw] h-full h-[100dvh] bg-white dark:bg-slate-900 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-slate-800 overflow-hidden will-change-transform"
            >
              <div
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-12 rounded-full bg-slate-300/80 dark:bg-slate-700/80 pointer-events-none z-20"
                aria-hidden="true"
              />

              {/* Header */}
              <div
                className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900"
                style={{
                  paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0 shadow-xs ${
                      formDirection === 'receivable' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  >
                    <HandCoins className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
                      {editingDebt
                        ? `Edit: ${editingDebt.person_name}`
                        : formDirection === 'receivable'
                        ? 'Record Loan Given'
                        : 'Record Loan Taken'}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      {formDirection === 'receivable'
                        ? 'Money you lent to someone'
                        : 'Money you borrowed from someone'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDrawers}
                  className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form
                onSubmit={handleSaveDebt}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
                  {/* Loan Type Switcher */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Loan Type
                    </label>
                    <div className="grid grid-cols-2 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                      <button
                        type="button"
                        onClick={() => setFormDirection('receivable')}
                        className={`py-1.5 rounded text-xs font-bold transition-all ${
                          formDirection === 'receivable'
                            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Loan Given (Lent)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormDirection('payable')}
                        className={`py-1.5 rounded text-xs font-bold transition-all ${
                          formDirection === 'payable'
                            ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Loan Taken (Borrowed)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Person / Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahim Ahmed, Bank, Friend"
                      value={formPerson}
                      onChange={(e) => setFormPerson(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Total Amount ({symbol}) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="e.g. 5000"
                        value={formTotal}
                        onChange={(e) => setFormTotal(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Paid / Returned ({symbol})
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0"
                        value={formPaid}
                        onChange={(e) => setFormPaid(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Due Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Note (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Short note"
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                {/* Docked Footer */}
                <div
                  className="px-4 sm:px-5 pt-3.5 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 mt-auto"
                  style={{
                    paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 14px), 16px)',
                  }}
                >
                  <button
                    type="button"
                    onClick={closeDrawers}
                    className="flex-1 py-2.5 px-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-3 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95"
                  >
                    {editingDebt ? 'Save Changes' : 'Save Loan'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Record Payment / Settlement Right Sidebar */}
      {mounted && paymentDebt && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex justify-end">
            <div
              onClick={closeDrawers}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              style={{
                opacity: isDragging ? Math.max(0.15, 1 - dragX / 280) : 1,
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            />

            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              style={
                isDragging
                  ? {
                      transform: `translate3d(${dragX}px, 0, 0)`,
                      transition: 'none',
                    }
                  : undefined
              }
              onClick={(e) => e.stopPropagation()}
              className="relative w-80 max-w-[85vw] sm:w-[380px] sm:max-w-[85vw] h-full h-[100dvh] bg-white dark:bg-slate-900 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-slate-800 overflow-hidden will-change-transform"
            >
              <div
                className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900"
                style={{
                  paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
                }}
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {paymentDebt.direction === 'receivable' ? 'Collect Loan' : 'Repay Loan'}: {paymentDebt.person_name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Remaining: {symbol}{formatAmount(Math.max(0, paymentDebt.total_amount - paymentDebt.paid_amount))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDrawers}
                  className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={handlePaymentSubmit}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Amount ({symbol})
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      autoFocus
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>

                  {onLogTransaction && (
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={logToLedger}
                        onChange={(e) => setLogToLedger(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        Also log as {paymentDebt.direction === 'payable' ? 'Expense' : 'Income'} in Ledger
                      </span>
                    </label>
                  )}
                </div>

                <div
                  className="px-4 sm:px-5 pt-3.5 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 mt-auto"
                  style={{
                    paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 14px), 16px)',
                  }}
                >
                  <button
                    type="button"
                    onClick={closeDrawers}
                    className="flex-1 py-2.5 px-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-3 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Confirm
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
