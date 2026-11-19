'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  BellRing,
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  Trash2,
  Pencil,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Receipt,
  X,
  Tag,
  Check,
  Repeat,
} from 'lucide-react';
import {
  TaskReminder,
  ReminderRecurrence,
  getRecurrenceLabel,
  getStoredReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  toggleReminderCompletion,
  advanceRecurringReminder,
  checkDueReminders,
  triggerReminderNotificationNow,
} from '@/lib/reminders';
import { Category } from '@/lib/types';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { triggerHaptic } from '@/lib/haptics';

interface RemindersViewProps {
  currency?: string;
  categories?: Category[];
  onLogAsExpense?: (data: { amount?: number; note: string; category_id?: string; date: string }) => void;
}

export default function RemindersView({
  currency = 'BDT',
  categories = [],
  onLogAsExpense,
}: RemindersViewProps) {
  const symbol = getCurrencySymbol(currency);
  const [reminders, setReminders] = useState<TaskReminder[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<TaskReminder | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formDueTime, setFormDueTime] = useState('09:00');
  const [formRecurrence, setFormRecurrence] = useState<ReminderRecurrence>('none');
  const [formNote, setFormNote] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Touch swipe-right-to-close gesture state for the right sidebar
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isModalOpen) {
      setDragX(0);
      setIsDragging(false);
      isHorizontalSwipeRef.current = null;
    }
  }, [isModalOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isModalOpen) return;
    const t = e.touches[0];
    if (!t) return;
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    startTimeRef.current = Date.now();
    isHorizontalSwipeRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isModalOpen) return;
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
      setIsModalOpen(false);
    }
  };

  const loadReminders = () => {
    setReminders(getStoredReminders());
  };

  useEffect(() => {
    loadReminders();
    checkDueReminders(symbol);
    window.addEventListener('cashflow-reminders-updated', loadReminders);
    return () => window.removeEventListener('cashflow-reminders-updated', loadReminders);
  }, [symbol]);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Summary counts
  const overdueList = useMemo(
    () => reminders.filter((r) => !r.is_completed && r.due_date < todayStr),
    [reminders, todayStr]
  );
  const todayList = useMemo(
    () => reminders.filter((r) => !r.is_completed && r.due_date === todayStr),
    [reminders, todayStr]
  );
  const upcomingList = useMemo(
    () => reminders.filter((r) => !r.is_completed && r.due_date > todayStr),
    [reminders, todayStr]
  );

  const filteredReminders = useMemo(() => {
    if (filter === 'pending') return reminders.filter((r) => !r.is_completed);
    if (filter === 'completed') return reminders.filter((r) => r.is_completed);
    return reminders;
  }, [reminders, filter]);

  const openCreateModal = () => {
    setEditingReminder(null);
    setFormTitle('');
    setFormAmount('');
    setFormDueDate(todayStr);
    setFormDueTime('09:00');
    setFormRecurrence('none');
    setFormNote('');
    setFormCategoryId('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: TaskReminder) => {
    setEditingReminder(item);
    setFormTitle(item.title);
    setFormAmount(item.amount ? String(item.amount) : '');
    setFormDueDate(item.due_date);
    setFormDueTime(item.due_time || '09:00');
    setFormRecurrence(item.recurrence || 'none');
    setFormNote(item.note || '');
    setFormCategoryId(item.category_id || '');
    setIsModalOpen(true);
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDueDate) return;

    triggerHaptic('success');
    const amt = formAmount.trim() ? parseFloat(formAmount) : undefined;

    if (editingReminder) {
      await updateReminder(
        editingReminder.id,
        {
          title: formTitle,
          amount: amt,
          due_date: formDueDate,
          due_time: formDueTime,
          recurrence: formRecurrence,
          note: formNote,
          category_id: formCategoryId || undefined,
        },
        symbol
      );
      setFeedback({ type: 'success', text: 'Reminder updated & notification rescheduled!' });
    } else {
      await createReminder(
        {
          title: formTitle,
          amount: amt,
          due_date: formDueDate,
          due_time: formDueTime,
          recurrence: formRecurrence,
          note: formNote,
          category_id: formCategoryId || undefined,
        },
        symbol
      );
      setFeedback({ type: 'success', text: 'Reminder created! You will be notified on the due date.' });
    }

    loadReminders();
    setIsModalOpen(false);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleToggle = async (id: string) => {
    triggerHaptic('light');
    await toggleReminderCompletion(id, symbol);
    loadReminders();
  };

  const handleAdvanceRecurring = async (item: TaskReminder) => {
    triggerHaptic('success');
    const updated = await advanceRecurringReminder(item.id, symbol);
    loadReminders();
    if (updated) {
      setFeedback({
        type: 'success',
        text: `Rolled over "${updated.title}" to next ${getRecurrenceLabel(updated.recurrence).toLowerCase()} cycle (${updated.due_date} • ${updated.due_time})!`,
      });
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleNotifyNow = async (item: TaskReminder) => {
    triggerHaptic('success');
    await triggerReminderNotificationNow(item, symbol);
    setFeedback({
      type: 'success',
      text: `Alert sent for "${item.title}" to Notification Icon & Lock Screen!`,
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDelete = async (id: string) => {
    triggerHaptic('warning');
    if (confirm('Delete this reminder?')) {
      await deleteReminder(id);
      loadReminders();
    }
  };

  const handleConvertExpense = async (item: TaskReminder) => {
    triggerHaptic('success');
    if (onLogAsExpense) {
      onLogAsExpense({
        amount: item.amount,
        note: item.title + (item.note ? ` (${item.note})` : ''),
        category_id: item.category_id,
        date: item.due_date,
      });
      if (item.recurrence && item.recurrence !== 'none') {
        await advanceRecurringReminder(item.id, symbol);
        loadReminders();
      } else if (!item.is_completed) {
        await toggleReminderCompletion(item.id, symbol);
        loadReminders();
      }
    }
  };

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );

  return (
    <div className="space-y-4 pb-20 lg:pb-8 animate-in fade-in duration-200">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-md animate-in slide-in-from-top-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Reminders</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Never forget electric bills, credit cards, rent, or recurring tasks
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Reminder</span>
        </button>
      </div>

      {/* 3 Actionable Summary Cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Overdue */}
        <div className="p-3 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Overdue</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            {overdueList.length}
          </div>
        </div>

        {/* Due Today */}
        <div className="p-3 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Due Today</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            {todayList.length}
          </div>
        </div>

        {/* Upcoming */}
        <div className="p-3 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 mb-1">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Upcoming</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            {upcomingList.length}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200/80 dark:border-slate-700/80 pb-2">
        <button
          type="button"
          onClick={() => setFilter('pending')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
            filter === 'pending'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Pending ({reminders.filter((r) => !r.is_completed).length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
            filter === 'all'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          All ({reminders.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('completed')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
            filter === 'completed'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Completed ({reminders.filter((r) => r.is_completed).length})
        </button>
      </div>

      {/* Reminder List */}
      <div className="space-y-2">
        {filteredReminders.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2">
            <BellRing className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {filter === 'completed'
                ? 'No completed reminders yet'
                : 'No pending reminders'}
            </h3>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Tap &quot;New Reminder&quot; to set an alert for your electric bill, credit card, rent, or subscription.
            </p>
          </div>
        ) : (
          filteredReminders.map((item) => {
            const isOverdue = !item.is_completed && item.due_date < todayStr;
            const isToday = !item.is_completed && item.due_date === todayStr;
            const cat = categories.find((c) => c.id === item.category_id);

            return (
              <div
                key={item.id}
                className={`p-3.5 bg-white dark:bg-slate-800/90 rounded-[10px] border shadow-xs transition-all flex items-start justify-between gap-3 ${
                  item.is_completed
                    ? 'opacity-60 border-slate-200 dark:border-slate-800'
                    : isOverdue
                    ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
                    : isToday
                    ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10'
                    : 'border-slate-200/80 dark:border-slate-700/80'
                }`}
              >
                {/* Checkbox & Details */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => handleToggle(item.id)}
                    className="mt-0.5 text-slate-400 hover:text-emerald-500 transition-colors shrink-0"
                    title={item.is_completed ? 'Mark uncompleted' : 'Mark completed'}
                  >
                    {item.is_completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={`text-xs font-bold truncate ${
                          item.is_completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {item.title}
                      </h3>

                      {/* Status Badges */}
                      {isOverdue && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          Overdue
                        </span>
                      )}
                      {isToday && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          Due Today
                        </span>
                      )}
                      {cat && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                          {cat.name}
                        </span>
                      )}
                      {item.recurrence && item.recurrence !== 'none' && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 inline-flex items-center gap-1">
                          <Repeat className="w-2.5 h-2.5" />
                          <span>{getRecurrenceLabel(item.recurrence)}</span>
                        </span>
                      )}
                    </div>

                    {/* Note */}
                    {item.note && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.note}
                      </p>
                    )}

                    {/* Due Date & Amount line */}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{item.due_date}</span>
                        {item.due_time && <span>• {item.due_time}</span>}
                      </span>

                      {item.amount && item.amount > 0 && (
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                          {symbol}{formatAmount(item.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {onLogAsExpense && !item.is_completed && (
                    <button
                      type="button"
                      onClick={() => handleConvertExpense(item)}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 dark:text-emerald-300 transition-colors flex items-center gap-1"
                      title="Log as Expense in Ledger"
                    >
                      <Receipt className="w-3 h-3" />
                      <span className="hidden sm:inline">Pay &amp; Log</span>
                    </button>
                  )}
                  {item.recurrence && item.recurrence !== 'none' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceRecurring(item)}
                      className="p-1.5 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title={`Roll over to next ${getRecurrenceLabel(item.recurrence).toLowerCase()} cycle`}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleNotifyNow(item)}
                    className="p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                    title="Send Alert to Notification Icon & Lock Screen"
                  >
                    <BellRing className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    title="Edit Reminder"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Delete Reminder"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Right Sidebar (Portaled directly to document.body) */}
      {mounted && isModalOpen && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex justify-end">
            {/* Backdrop */}
            <div
              onClick={() => setIsModalOpen(false)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              style={{
                opacity: isDragging ? Math.max(0.15, 1 - dragX / 280) : 1,
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            />

            {/* Right Sidebar Panel */}
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
              {/* Subtle left-edge swipe handle bar */}
              <div
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-12 rounded-full bg-slate-300/80 dark:bg-slate-700/80 pointer-events-none z-20"
                aria-hidden="true"
              />

              {/* Panel Header */}
              <div
                className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900"
                style={{
                  paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <BellRing className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
                      {editingReminder ? 'Edit Reminder' : 'Set New Reminder & Alert'}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      Schedule notification &amp; recurring alert
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                  title="Close Sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Full-height Form Wrapper */}
              <form
                onSubmit={handleSaveReminder}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                {/* Scrollable Fields Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
                  {/* Task Title */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Task / Bill Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pay Electric Bill, Credit Card Due, Rent"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  {/* Date & Time Row */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Due Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formDueDate}
                        onChange={(e) => setFormDueDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Alert Time
                      </label>
                      <input
                        type="time"
                        value={formDueTime}
                        onChange={(e) => setFormDueTime(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  {/* Recurring / Repeat Frequency Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Repeat / Recurring Schedule</span>
                    </label>
                    <select
                      value={formRecurrence}
                      onChange={(e) => setFormRecurrence(e.target.value as ReminderRecurrence)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 cursor-pointer font-medium"
                    >
                      <option value="none">One-time (Do not repeat)</option>
                      <option value="hourly">Per Hour (Every Hour)</option>
                      <option value="daily">Per Day (Every Day)</option>
                      <option value="weekly">Per Week (Every Week)</option>
                      <option value="monthly">Per Month (Every Month)</option>
                    </select>
                  </div>

                  {/* Amount & Category Row */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Expected Amount ({symbol})
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 1500"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Category (Optional)
                      </label>
                      <select
                        value={formCategoryId}
                        onChange={(e) => setFormCategoryId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-2.5 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        <option value="">No Category</option>
                        {expenseCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Custom Note */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Note / Instruction
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Pay before 5 PM, don't forget!"
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                {/* Bottom-most Docked Action Footer */}
                <div
                  className="px-4 sm:px-5 pt-3.5 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 mt-auto"
                  style={{
                    paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 14px), 16px)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 px-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-3 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95"
                  >
                    {editingReminder ? 'Update Reminder' : 'Set Reminder'}
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
