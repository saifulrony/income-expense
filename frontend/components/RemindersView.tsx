'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import {
  TaskReminder,
  getStoredReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  toggleReminderCompletion,
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
  const [formNote, setFormNote] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadReminders = () => {
    setReminders(getStoredReminders());
  };

  useEffect(() => {
    loadReminders();
    window.addEventListener('cashflow-reminders-updated', loadReminders);
    return () => window.removeEventListener('cashflow-reminders-updated', loadReminders);
  }, []);

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
    await toggleReminderCompletion(id);
    loadReminders();
  };

  const handleDelete = async (id: string) => {
    triggerHaptic('warning');
    if (confirm('Delete this reminder?')) {
      await deleteReminder(id);
      loadReminders();
    }
  };

  const handleConvertExpense = (item: TaskReminder) => {
    triggerHaptic('success');
    if (onLogAsExpense) {
      onLogAsExpense({
        amount: item.amount,
        note: item.title + (item.note ? ` (${item.note})` : ''),
        category_id: item.category_id,
        date: item.due_date,
      });
      // Automatically complete the reminder
      if (!item.is_completed) {
        toggleReminderCompletion(item.id);
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
            <span>Reminders &amp; Bill Tasks</span>
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

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          {/* Backdrop */}
          <div
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity animate-in fade-in"
          />

          {/* Modal Card */}
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[12px] border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <BellRing className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {editingReminder ? 'Edit Reminder' : 'Set New Reminder & Alert'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveReminder} className="p-4 space-y-3.5">
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

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-md text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95"
                >
                  {editingReminder ? 'Update Reminder' : 'Set Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
