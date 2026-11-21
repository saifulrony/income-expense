'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Repeat, Plus, Trash2, Power, Check } from 'lucide-react';
import { Category, RecurringTransaction } from '@/lib/types';
import { CategoryIcon } from './CategoryIcons';
import { api } from '@/lib/api';
import { getCurrencySymbol } from '@/lib/currency';

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  currency: string;
}

export default function RecurringModal({
  isOpen,
  onClose,
  categories,
  currency,
}: RecurringModalProps) {
  const symbol = getCurrencySymbol(currency);
  const [recurringRules, setRecurringRules] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Swipe-down to close for bottom sheet on mobile
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isVerticalDragRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDragY(0);
      setIsDragging(false);
      isVerticalDragRef.current = null;
    }
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    startTimeRef.current = Date.now();
    isVerticalDragRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t || isVerticalDragRef.current === false) return;
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;

    if (isVerticalDragRef.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      isVerticalDragRef.current = Math.abs(dy) > Math.abs(dx) && dy > 0;
      if (isVerticalDragRef.current) {
        setIsDragging(true);
      }
    }

    if (isVerticalDragRef.current) {
      setDragY(Math.max(0, dy));
    }
  };

  const handleTouchEnd = () => {
    if (!isVerticalDragRef.current) {
      setIsDragging(false);
      return;
    }
    const elapsed = Math.max(1, Date.now() - startTimeRef.current);
    const velocity = dragY / elapsed;
    const shouldClose = dragY > 80 || velocity > 0.4;

    setIsDragging(false);
    setDragY(0);
    isVerticalDragRef.current = null;

    if (shouldClose) {
      onClose();
    }
  };

  // New rule state
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const res = await api.getRecurring();
      setRecurringRules(res.recurring || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.toggleRecurring(id);
      loadRules();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring rule?')) return;
    try {
      await api.deleteRecurring(id);
      loadRules();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || !categoryId) return;

    try {
      await api.createRecurring({
        amount: numAmount,
        type,
        category_id: categoryId,
        payment_method: paymentMethod,
        note: note.trim(),
        frequency,
      });
      setAmount('');
      setNote('');
      setShowAddForm(false);
      loadRules();
    } catch (e) {
      console.error(e);
    }
  };

  const handleProcessDue = async () => {
    try {
      const res = await api.processDueRecurring();
      alert(`Success! Generated ${res.created_transactions} due transactions.`);
      loadRules();
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 transition-opacity animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={
          isDragging
            ? {
                transform: `translate3d(0, ${dragY}px, 0)`,
                transition: 'none',
              }
            : undefined
        }
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[14px] sm:rounded-[10px] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-150 gpu-layer will-change-transform"
      >
        {/* Drag Pill for Bottom Sheet */}
        <div className="pt-2 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Recurring Transactions
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Auto-generate repeating salary, rent, or bills.
            </p>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              New Rule
            </button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <form onSubmit={handleCreate} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-[10px] border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`py-1.5 rounded-md text-xs font-bold ${
                    type === 'income' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Cash In
                </button>
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`py-1.5 rounded-md text-xs font-bold ${
                    type === 'expense' ? 'bg-rose-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Cash Out
                </button>
              </div>

              <div>
                <input
                  type="number"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
                  required
                >
                  <option value="">Category</option>
                  {categories.filter((c) => c.type === type).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <input
                type="text"
                placeholder="Note (e.g. Netflix subscription)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
              />

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 text-white rounded-md text-xs font-bold shadow"
              >
                Save Recurring Rule
              </button>
            </form>
          )}

          {/* List of rules */}
          {recurringRules.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No recurring rules set. Create one to automate repetitive transactions!
            </p>
          ) : (
            <div className="space-y-2">
              {recurringRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-3 rounded-[10px] border flex items-center justify-between ${
                    rule.is_active
                      ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center text-white shrink-0 text-xs"
                      style={{ backgroundColor: rule.category?.color || '#3B82F6' }}
                    >
                      <CategoryIcon name={rule.category?.icon || 'Tag'} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                        {rule.note || rule.category?.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {rule.frequency.toUpperCase()} • Next: {new Date(rule.next_run).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={`text-xs font-bold ${
                        rule.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {rule.type === 'income' ? '+' : '-'}{symbol}{rule.amount.toFixed(2)}
                    </div>

                    <button
                      onClick={() => handleToggle(rule.id)}
                      className={`p-1.5 rounded-md text-xs ${
                        rule.is_active
                          ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                          : 'text-slate-400 bg-slate-100 dark:bg-slate-800'
                      }`}
                      title={rule.is_active ? 'Pause Rule' : 'Activate Rule'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Process Due Button */}
          {recurringRules.length > 0 && (
            <button
              onClick={handleProcessDue}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-xs font-bold transition-all"
            >
              Check & Run Due Transactions Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

