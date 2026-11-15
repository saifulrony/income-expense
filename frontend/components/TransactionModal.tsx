'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Clock
} from 'lucide-react';
import { Category, Transaction, SubAccount } from '@/lib/types';
import { CategoryIcon } from './CategoryIcons';
import { api } from '@/lib/api';
import { getCurrencySymbol } from '@/lib/currency';
import { getCurrentTimeInputValue, formatLocalDate, hasExplicitTime } from '@/lib/time-settings';

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
  
  // Secondary / more options (hidden by default to keep modal minimal)
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // Category Searchable Dropdown state
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [newCatName, setNewCatName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

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
      setAmount('');
      setAccountId(defaultAccountId && defaultAccountId !== 'all' ? defaultAccountId : (accounts[0]?.id ?? ''));
      setPaymentMethod('Cash');
      setNote('');
      setReceiptImage('');
      setDate(formatLocalDate(new Date()));
      setTime(getCurrentTimeInputValue());
      setIsRecurring(false);
      setShowMoreOptions(false);
      setIsCategoryDropdownOpen(false);
      setCategorySearch('');
      setError('');
    }
  }, [initialData, accounts, defaultAccountId, isOpen]);

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

    const effectiveTime = time || getCurrentTimeInputValue();
    const combinedDate = new Date(`${date}T${effectiveTime}:00`);
    const finalIso = isNaN(combinedDate.getTime()) ? new Date().toISOString() : combinedDate.toISOString();

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

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div 
        className="w-full max-w-sm sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[14px] sm:rounded-[10px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-150 border border-slate-100 dark:border-slate-800 gpu-layer"
      >
        {/* 1. Header with Type Toggle & Close */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
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
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Cash Out</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setIsCategoryDropdownOpen(false);
                setCategorySearch('');
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Cash In</span>
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
        <form onSubmit={handleSubmit} className="px-4 pb-4 pt-1 space-y-3">
          {error && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md text-rose-600 dark:text-rose-400 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Amount Display */}
          <div className="text-center py-1">
            <div className="flex items-center justify-center">
              <span className={`text-xl font-bold font-mono mr-1.5 ${
                type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {type === 'income' ? '+' : '-'}{symbol}
              </span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                className={`text-3xl font-extrabold font-mono bg-transparent outline-none text-center w-48 tracking-tight placeholder-slate-300 dark:placeholder-slate-700 ${
                  type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                }`}
                required
              />
            </div>
          </div>

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

          {/* Submit Action */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 rounded-md text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] ${
                type === 'income'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
              }`}
            >
              {loading ? (
                <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {initialData
                      ? 'Update Record'
                      : type === 'income'
                      ? 'Save Cash In'
                      : 'Save Cash Out'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Delete Option (When editing) */}
          {initialData && onDelete && (
            <div className="text-center pt-0.5">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this transaction?')) {
                    onDelete(initialData.id);
                    onClose();
                  }
                }}
                className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Entry</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
