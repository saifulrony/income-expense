'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Check, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Plus, 
  Camera, 
  Trash2, 
  Repeat, 
  Calendar as CalendarIcon,
  ChevronDown,
  Search,
  Clock,
  Calculator,
  Delete
} from 'lucide-react';
import { Category, Transaction, SubAccount } from '@/lib/types';
import { CategoryIcon } from './CategoryIcons';
import { api } from '@/lib/api';
import { getCurrencySymbol } from '@/lib/currency';
import { getCurrentTimeInputValue, formatLocalDate, hasExplicitTime, combineDateAndTime } from '@/lib/time-settings';
import { useFlowLabels } from '@/lib/ui-prefs';
import { triggerHaptic } from '@/lib/haptics';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    account_id?: string;
    amount: number;
    type: 'income' | 'expense';
    category_id: string;
    payment_method: string;
    note: string;
    receipt_image?: string;
    date: string;
    is_recurring?: boolean;
    frequency?: 'daily' | 'weekly' | 'monthly';
  }) => Promise<void>;
  onDelete?: (id: string) => void;
  categories: Category[];
  accounts?: SubAccount[];
  defaultAccountId?: string;
  currency: string;
  initialData?: Transaction | null;
  initialType?: 'income' | 'expense';
  prefillAmount?: number | null;
  prefillNote?: string;
  onCreateCategory?: (name: string, type: 'income' | 'expense') => Promise<Category>;
}

export default function TransactionModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  categories,
  accounts = [],
  defaultAccountId,
  currency,
  initialData,
  initialType = 'expense',
  prefillAmount = null,
  prefillNote = '',
  onCreateCategory,
}: TransactionModalProps) {
  const [type, setType] = useState<'income' | 'expense'>(initialType);
  const [amount, setAmount] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [note, setNote] = useState<string>('');
  const [date, setDate] = useState<string>(formatLocalDate(new Date()));
  const [time, setTime] = useState<string>(getCurrentTimeInputValue());
  const symbol = getCurrencySymbol(currency);
  const { inLabel, outLabel } = useFlowLabels();
  
  // Secondary / more options (hidden by default to keep modal minimal)
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // Category Searchable Dropdown state
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [newCatName, setNewCatName] = useState('');

  // Calculator state
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calcExpression, setCalcExpression] = useState('');
  const [calcLiveResult, setCalcLiveResult] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Touch swipe-down-to-close gesture state
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isVerticalDragRef = useRef<boolean | null>(null);
  const formScrollRef = useRef<HTMLFormElement | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const [isAmountFocused, setIsAmountFocused] = useState(false);

  // Immediate synchronized focus so both the modal and the mobile keyboard appear at the exact same time
  useEffect(() => {
    if (!isOpen) {
      setIsAmountFocused(false);
      return;
    }

    setIsAmountFocused(true);

    // Immediate synchronous focus on mount
    if (amountInputRef.current) {
      try {
        amountInputRef.current.focus({ preventScroll: true });
        if (amountInputRef.current.value) {
          amountInputRef.current.select();
        }
      } catch {}
    }

    // Secondary frame check to ensure mobile keyboards trigger synchronously
    const raf = requestAnimationFrame(() => {
      if (amountInputRef.current) {
        try {
          amountInputRef.current.focus({ preventScroll: true });
        } catch {}
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setDragY(0);
      setIsDragging(false);
      setIsSnapping(false);
      isVerticalDragRef.current = null;
    }
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    // Only initiate swipe-to-close if the form scroll container is at the top
    if (formScrollRef.current && formScrollRef.current.scrollTop > 2) {
      isVerticalDragRef.current = false;
      return;
    }
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
    const velocity = dragY / elapsed; // px per ms
    const shouldClose = dragY > 75 || velocity > 0.4;

    setIsDragging(false);
    isVerticalDragRef.current = null;

    if (shouldClose) {
      setDragY(0);
      onClose();
    } else {
      setIsSnapping(true);
      setDragY(0);
      setTimeout(() => {
        setIsSnapping(false);
      }, 190);
    }
  };

  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setAmount(String(initialData.amount));
      setAccountId(initialData.account_id || defaultAccountId || (accounts[0]?.id ?? ''));
      setCategoryId(initialData.category_id);
      setPaymentMethod(initialData.payment_method || 'Cash');
      setNote(initialData.note || '');
      setReceiptImage(initialData.receipt_image || '');

      setDate(formatLocalDate(initialData.date));

      // Extract time intelligently: check initialData.date then created_at
      let extractedTime = '';
      if (hasExplicitTime(initialData.date)) {
        const txDate = new Date(initialData.date);
        if (!isNaN(txDate.getTime())) {
          extractedTime = `${String(txDate.getHours()).padStart(2, '0')}:${String(txDate.getMinutes()).padStart(2, '0')}`;
        }
      } else if (hasExplicitTime(initialData.created_at)) {
        const createDate = new Date(initialData.created_at);
        if (!isNaN(createDate.getTime())) {
          extractedTime = `${String(createDate.getHours()).padStart(2, '0')}:${String(createDate.getMinutes()).padStart(2, '0')}`;
        }
      }
      setTime(extractedTime || getCurrentTimeInputValue());

      setIsRecurring(false);
      setShowMoreOptions(!!initialData.receipt_image);
      setIsCategoryDropdownOpen(false);
      setCategorySearch('');
    } else {
      setType(initialType);
      setAmount(prefillAmount && prefillAmount > 0 ? String(prefillAmount) : '');
      setAccountId(defaultAccountId && defaultAccountId !== 'all' ? defaultAccountId : (accounts[0]?.id ?? ''));
      setPaymentMethod('Cash');
      setNote(prefillNote || '');
      setReceiptImage('');
      setDate(formatLocalDate(new Date()));
      setTime(getCurrentTimeInputValue());
      setIsRecurring(false);
      setShowMoreOptions(false);
      setIsCategoryDropdownOpen(false);
      setCategorySearch('');
      setIsCalculatorOpen(false);
      setCalcExpression('');
      setCalcLiveResult(null);
      setError('');
    }
  }, [initialData, accounts, defaultAccountId, isOpen, initialType, prefillAmount, prefillNote]);

  // Live calculator calculation
  useEffect(() => {
    if (!calcExpression.trim()) {
      setCalcLiveResult(null);
      return;
    }
    const evaluated = evaluateMathExpression(calcExpression);
    if (evaluated !== null) {
      setCalcLiveResult(String(evaluated));
    } else {
      setCalcLiveResult(null);
    }
  }, [calcExpression]);

  // Sync category with active type
  useEffect(() => {
    const available = categories.filter((c) => c.type === type);
    if (available.length > 0 && (!categoryId || !available.some((c) => c.id === categoryId))) {
      setCategoryId(available[0].id);
    }
  }, [type, categories, categoryId]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === categoryId);
  }, [categories, categoryId]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.toLowerCase().trim();
    return categories
      .filter((c) => c.type === type)
      .filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [categories, type, categorySearch]);

  // Calculator helper functions
  const evaluateMathExpression = (expr: string): number | null => {
    try {
      if (!expr || !expr.trim()) return null;
      let sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/%/g, '*0.01');
      
      if (!/^[0-9+\-*/.() ]+$/.test(sanitized)) {
        return null;
      }
      sanitized = sanitized.trim().replace(/[+\-*/.]+$/, '');
      if (!sanitized) return null;

      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.round((result + Number.EPSILON) * 100) / 100;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleCalcToggle = () => {
    if (!isCalculatorOpen) {
      if (amount && !isNaN(Number(amount)) && Number(amount) > 0) {
        setCalcExpression(amount);
      } else {
        setCalcExpression('');
      }
    }
    setIsCalculatorOpen((prev) => !prev);
  };

  const handleCalcAppend = (char: string) => {
    setCalcExpression((prev) => {
      const isOperator = ['+', '-', '×', '÷', '%'].includes(char);
      if (!prev) {
        if (isOperator) return '';
        return char;
      }
      const lastChar = prev.slice(-1);
      const isLastOperator = ['+', '-', '×', '÷'].includes(lastChar);
      if (isOperator && isLastOperator) {
        return prev.slice(0, -1) + char;
      }
      return prev + char;
    });
  };

  const handleCalcClear = () => {
    setCalcExpression('');
  };

  const handleCalcDelete = () => {
    setCalcExpression((prev) => (prev ? prev.slice(0, -1) : ''));
  };

  const handleCalcEquals = () => {
    const evaluated = evaluateMathExpression(calcExpression);
    if (evaluated !== null) {
      setCalcExpression(String(evaluated));
    }
  };

  const handleCalcApply = () => {
    const evaluated = evaluateMathExpression(calcExpression);
    if (evaluated !== null) {
      setAmount(String(evaluated));
    } else if (calcExpression.trim() && !isNaN(Number(calcExpression.trim()))) {
      setAmount(calcExpression.trim());
    }
    setIsCalculatorOpen(false);
  };

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateNewCategory = async () => {
    if (!newCatName.trim() || !onCreateCategory) return;
    try {
      const created = await onCreateCategory(newCatName.trim(), type);
      setCategoryId(created.id);
      setNewCatName('');
      setIsCategoryDropdownOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    const finalIso = combineDateAndTime(date, time);

    try {
      setLoading(true);
      await onSubmit({
        account_id: accountId || undefined,
        amount: numericAmount,
        type,
        category_id: categoryId,
        payment_method: paymentMethod,
        note: note.trim(),
        receipt_image: receiptImage,
        date: finalIso,
        is_recurring: isRecurring,
        frequency: frequency,
      });

      if (isRecurring && !initialData) {
        await api.createRecurring({
          amount: numericAmount,
          type,
          category_id: categoryId,
          payment_method: paymentMethod,
          note: note.trim(),
          frequency: frequency,
          start_date: finalIso,
        }).catch(() => {});
      }

      triggerHaptic('success');
      onClose();
    } catch (err: any) {
      triggerHaptic('warning');
      setError(err.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="modal-backdrop-fade fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      style={{
        paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 20px), 24px)',
        backgroundColor: isDragging
          ? `rgba(0, 0, 0, ${Math.max(0.15, 0.6 - dragY / 500)})`
          : undefined,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`w-full max-w-sm sm:max-w-md max-h-[90vh] sm:max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-[16px] sm:rounded-t-[16px] rounded-b-none !rounded-b-none shadow-2xl overflow-hidden ${
          isDragging || isSnapping ? '' : 'animate-in fade-in zoom-in-98 duration-100'
        } border border-slate-100 dark:border-slate-800 gpu-layer will-change-transform`}
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          maxHeight: 'min(90vh, calc(100% - 24px))',
          transform: isDragging || isSnapping ? `translate3d(0, ${dragY}px, 0)` : undefined,
          transition: isSnapping ? 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
        }}
      >
        {/* Top Swipe Drag Handle Pill */}
        <div className="w-full flex justify-center pt-2 pb-0.5 shrink-0 cursor-grab active:cursor-grabbing">
          <div className="w-9 h-1 rounded-full bg-slate-300/80 dark:bg-slate-700" />
        </div>

        {/* 1. Header with Type Toggle & Close */}
        <div className="flex items-center justify-between px-4 pt-2 pb-2 shrink-0">
          {/* Segmented Type Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-md gap-1">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                setIsCategoryDropdownOpen(false);
                setCategorySearch('');
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
              <span className="truncate">{outLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setIsCategoryDropdownOpen(false);
                setCategorySearch('');
              }}
              style={type === 'income' ? { backgroundColor: '#059669', color: '#ffffff' } : undefined}
              className={`modal-cash-in-tab flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                type === 'income'
                  ? '!bg-emerald-600 !text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
              <span className="truncate">{inLabel}</span>
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Form Body */}
        <form
          ref={formScrollRef}
          onSubmit={handleSubmit}
          className="px-4 pb-5 pt-1 space-y-3 overflow-y-auto overscroll-contain flex-1 min-h-0"
        >
          {error && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md text-rose-600 dark:text-rose-400 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Amount Display */}
          <div className="text-center py-1">
            <div
              onClick={() => amountInputRef.current?.focus()}
              className={`inline-flex items-center justify-center relative px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-text ${
                isAmountFocused
                  ? type === 'income'
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-400 dark:border-rose-600 ring-2 ring-rose-500/20 shadow-xs'
                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <span className={`text-xl font-bold font-mono mr-1.5 transition-colors ${
                type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {type === 'income' ? '+' : '-'}{symbol}
              </span>
              <input
                ref={amountInputRef}
                autoFocus
                type="number"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={() => setIsAmountFocused(true)}
                onBlur={() => setIsAmountFocused(false)}
                placeholder="0.00"
                className={`text-3xl font-extrabold font-mono bg-transparent outline-none text-center w-44 sm:w-48 tracking-tight placeholder-slate-300 dark:placeholder-slate-700 transition-colors ${
                  type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                }`}
                required
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCalcToggle();
                }}
                title={isCalculatorOpen ? 'Close calculator' : 'Open calculator to compute amount'}
                className={`p-1.5 rounded-lg transition-all ml-1 shrink-0 ${
                  isCalculatorOpen
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Calculator className="w-5 h-5 stroke-[2.2]" />
              </button>
            </div>

            {/* Quick Amount Chips */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap mt-2">
              {[50, 100, 500, 1000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setAmount((prev) => {
                      const cur = parseFloat(prev) || 0;
                      return String(Math.round((cur + v) * 100) / 100);
                    })
                  }
                  className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold font-mono text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95 transition-all"
                >
                  +{v >= 1000 ? `${v / 1000}K` : v}
                </button>
              ))}
              {amount && parseFloat(amount) > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount('')}
                  className="px-2 py-1 rounded-md text-[11px] font-bold text-slate-400 hover:text-rose-500 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition-all"
                  title="Clear amount"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Calculator Popup / Keypad */}
          {isCalculatorOpen && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
              {/* Calculator Display */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 flex flex-col items-end justify-center min-h-[50px]">
                <div className="text-xs font-mono text-slate-400 dark:text-slate-500 tracking-wider truncate w-full text-right h-4">
                  {calcExpression || '0'}
                </div>
                <div className="text-base sm:text-lg font-mono font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  {calcLiveResult !== null ? `= ${symbol}${calcLiveResult}` : `${symbol}0.00`}
                </div>
              </div>

              {/* Keypad Grid */}
              <div className="grid grid-cols-4 gap-1.5 text-sm font-semibold select-none font-mono">
                {/* Row 1 */}
                <button
                  type="button"
                  onClick={handleCalcClear}
                  className="py-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 active:scale-95 transition-all text-xs font-bold"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={handleCalcDelete}
                  className="py-2.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center"
                  title="Backspace"
                >
                  <Delete className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcAppend('%')}
                  className="py-2.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all text-xs font-bold"
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcAppend('÷')}
                  className="py-2.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 active:scale-95 transition-all font-bold text-base"
                >
                  ÷
                </button>

                {/* Row 2 */}
                {['7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleCalcAppend(digit)}
                    className="py-2.5 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 transition-all shadow-2xs font-bold"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleCalcAppend('×')}
                  className="py-2.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 active:scale-95 transition-all font-bold text-base"
                >
                  ×
                </button>

                {/* Row 3 */}
                {['4', '5', '6'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleCalcAppend(digit)}
                    className="py-2.5 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 transition-all shadow-2xs font-bold"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleCalcAppend('-')}
                  className="py-2.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 active:scale-95 transition-all font-bold text-base"
                >
                  -
                </button>

                {/* Row 4 */}
                {['1', '2', '3'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleCalcAppend(digit)}
                    className="py-2.5 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 transition-all shadow-2xs font-bold"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleCalcAppend('+')}
                  className="py-2.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 active:scale-95 transition-all font-bold text-base"
                >
                  +
                </button>

                {/* Row 5 */}
                <button
                  type="button"
                  onClick={() => handleCalcAppend('0')}
                  className="py-2.5 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 transition-all shadow-2xs font-bold"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcAppend('.')}
                  className="py-2.5 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 transition-all shadow-2xs font-bold"
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={handleCalcEquals}
                  className="py-2.5 rounded-lg bg-slate-200/90 dark:bg-slate-700/90 text-slate-800 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all font-bold text-base"
                >
                  =
                </button>
                <button
                  type="button"
                  onClick={handleCalcApply}
                  className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all font-bold text-xs shadow-xs"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Note / Description */}
          <div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note / Description (e.g. Grocery, Lunch, Salary)"
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Minimal Searchable Category Dropdown */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Category
              </span>
              {onCreateCategory && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCategoryDropdownOpen(true);
                    setCategorySearch('');
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 font-semibold"
                >
                  <Plus className="w-3 h-3" />
                  <span>New</span>
                </button>
              )}
            </div>

            {/* Dropdown Selector Button */}
            <button
              type="button"
              onClick={() => {
                setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                setCategorySearch('');
              }}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white flex items-center justify-between hover:border-emerald-500 transition-colors shadow-2xs"
            >
              <div className="flex items-center gap-2 truncate">
                {selectedCategory ? (
                  <>
                    <div
                      className="w-4 h-4 rounded-md flex items-center justify-center text-white shrink-0 text-xs shadow-2xs"
                      style={{ backgroundColor: selectedCategory.color || '#10B981' }}
                    >
                      <CategoryIcon name={selectedCategory.icon || 'Tag'} className="w-2.5 h-2.5" />
                    </div>
                    <span className="truncate">{selectedCategory.name}</span>
                  </>
                ) : (
                  <span className="text-slate-400 font-normal">Select a category...</span>
                )}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Searchable Dropdown Floating Popover */}
            {isCategoryDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsCategoryDropdownOpen(false)} 
                />
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  {/* Search Bar */}
                  <div className="p-2 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/90">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        placeholder="Search category..."
                        className="w-full bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 rounded-md pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-500 transition-colors"
                      />
                      {categorySearch && (
                        <button
                          type="button"
                          onClick={() => setCategorySearch('')}
                          className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Categories Scrollable List */}
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/40">
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map((cat) => {
                        const isSelected = categoryId === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setCategoryId(cat.id);
                              setIsCategoryDropdownOpen(false);
                              setCategorySearch('');
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                              isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 font-bold text-emerald-800 dark:text-emerald-300'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-4 h-4 rounded-md flex items-center justify-center text-white shrink-0 shadow-2xs"
                                style={{ backgroundColor: cat.color || '#10B981' }}
                              >
                                <CategoryIcon name={cat.icon || 'Tag'} className="w-2.5 h-2.5" />
                              </div>
                              <span className="truncate">{cat.name}</span>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="py-3 px-3 text-center text-xs text-slate-400">
                        No categories found
                      </div>
                    )}
                  </div>

                  {/* Inline Quick Add Category / Create from search */}
                  {onCreateCategory && (
                    <div className="p-2 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
                      {categorySearch.trim() && !filteredCategories.some(c => c.name.toLowerCase() === categorySearch.trim().toLowerCase()) ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const created = await onCreateCategory(categorySearch.trim(), type);
                            setCategoryId(created.id);
                            setCategorySearch('');
                            setIsCategoryDropdownOpen(false);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create &quot;{categorySearch.trim()}&quot;</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="New category name..."
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreateNewCategory();
                              }
                            }}
                            className="flex-1 bg-white dark:bg-slate-700 px-2.5 py-1 text-xs rounded-md outline-none border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-400"
                          />
                          <button
                            type="button"
                            onClick={handleCreateNewCategory}
                            disabled={!newCatName.trim()}
                            className="bg-emerald-600 disabled:opacity-50 text-white px-2.5 py-1 text-xs font-bold rounded-md hover:bg-emerald-500 transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Inline Meta Strip: Account • Method */}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {/* Account Selector */}
            {accounts.length > 0 ? (
              <div className="relative">
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 pr-5 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none truncate cursor-pointer"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
              </div>
            ) : <div />}

            {/* Payment Method Selector */}
            <div className="relative">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 pr-5 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none truncate cursor-pointer"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Account">Bank</option>
                <option value="Mobile Wallet">Card / Wallet</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Date & Time Selectors */}
          <div className="grid grid-cols-2 gap-1.5">
            {/* Date Selector */}
            <div className="relative flex items-center">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-medium font-mono text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                title="Transaction Date"
              />
            </div>

            {/* Time Selector */}
            <div className="relative flex items-center">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-medium font-mono text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                title="Transaction Time"
              />
            </div>
          </div>

          {/* Subtle "More Options" toggle (Receipt / Recurring) */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium flex items-center gap-1 transition-colors"
            >
              <span>{showMoreOptions ? '− Less options' : '+ Receipt photo / Recurring'}</span>
            </button>

            {showMoreOptions && (
              <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-[10px] border border-slate-200/60 dark:border-slate-700/60 space-y-2 animate-in slide-in-from-top-1 duration-150">
                {/* Receipt Upload */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Receipt Photo
                  </span>
                  {receiptImage ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-600 font-semibold">Attached</span>
                      <button
                        type="button"
                        onClick={() => setReceiptImage('')}
                        className="text-rose-500 hover:text-rose-600 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Recurring Switch */}
                {!initialData && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      <Repeat className="w-3 h-3 text-indigo-500" />
                      Recurring
                    </span>
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                    />
                  </div>
                )}

                {isRecurring && (
                  <div className="flex gap-1 pt-1">
                    {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setFrequency(freq)}
                        className={`flex-1 py-1 rounded-md text-xs font-bold capitalize transition-all ${
                          frequency === freq
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit & Delete Actions in a Single Row when Editing */}
          <div className="pt-2">
            {initialData ? (
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: '#059669', color: '#ffffff' }}
                  className="modal-submit-btn flex-1 py-2.5 rounded-md !text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] !bg-emerald-600 hover:!bg-emerald-700 shadow-emerald-600/25"
                >
                  {loading ? (
                    <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Update</span>
                    </>
                  )}
                </button>

                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this transaction?')) {
                        onDelete(initialData.id);
                        onClose();
                      }
                    }}
                    className="py-2.5 px-4 rounded-md text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] bg-rose-600 hover:bg-rose-700 shadow-rose-600/25 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading}
                style={type === 'income' ? { backgroundColor: '#059669', color: '#ffffff' } : undefined}
                className={`modal-submit-btn w-full py-2.5 rounded-md text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] ${
                  type === 'income'
                    ? '!bg-emerald-600 hover:!bg-emerald-700 shadow-emerald-600/25'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                }`}
              >
                {loading ? (
                  <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>{type === 'income' ? `Save ${inLabel}` : `Save ${outLabel}`}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
