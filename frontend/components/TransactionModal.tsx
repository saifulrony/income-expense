'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, ArrowDownLeft, ArrowUpRight, Plus, Camera, Image as ImageIcon, Trash2, Repeat } from 'lucide-react';
import { Category, Transaction } from '@/lib/types';
import { CategoryIcon } from './CategoryIcons';
import { api } from '@/lib/api';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
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
  categories: Category[];
  currency: string;
  initialData?: Transaction | null;
  onCreateCategory?: (name: string, type: 'income' | 'expense') => Promise<Category>;
}

export default function TransactionModal({
  isOpen,
  onClose,
  onSubmit,
  categories,
  currency,
  initialData,
  onCreateCategory,
}: TransactionModalProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [note, setNote] = useState<string>('');
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Inline category creation state
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setAmount(String(initialData.amount));
      setCategoryId(initialData.category_id);
      setPaymentMethod(initialData.payment_method || 'Cash');
      setNote(initialData.note || '');
      setReceiptImage(initialData.receipt_image || '');
      setDate(new Date(initialData.date).toISOString().slice(0, 16));
      setIsRecurring(false);
    } else {
      setType('expense');
      setAmount('');
      setPaymentMethod('Cash');
      setNote('');
      setReceiptImage('');
      setDate(new Date().toISOString().slice(0, 16));
      setIsRecurring(false);
      setError('');
    }
  }, [initialData, isOpen]);

  // Set default category when type changes or categories load
  useEffect(() => {
    const available = categories.filter((c) => c.type === type);
    if (available.length > 0 && (!categoryId || !available.some((c) => c.id === categoryId))) {
      setCategoryId(available[0].id);
    }
  }, [type, categories, categoryId]);

  if (!isOpen) return null;

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert file to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptImage(reader.result as string);
    };
    reader.readAsDataURL(file);
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

    try {
      setLoading(true);
      await onSubmit({
        amount: numericAmount,
        type,
        category_id: categoryId,
        payment_method: paymentMethod,
        note: note.trim(),
        receipt_image: receiptImage,
        date: new Date(date).toISOString(),
        is_recurring: isRecurring,
        frequency: frequency,
      });

      // If user checked recurring, register recurring rule
      if (isRecurring && !initialData) {
        await api.createRecurring({
          amount: numericAmount,
          type,
          category_id: categoryId,
          payment_method: paymentMethod,
          note: note.trim(),
          frequency: frequency,
          start_date: new Date(date).toISOString(),
        }).catch(() => {});
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewCategory = async () => {
    if (!newCatName.trim() || !onCreateCategory) return;
    try {
      const created = await onCreateCategory(newCatName.trim(), type);
      setCategoryId(created.id);
      setNewCatName('');
      setShowAddCat(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {initialData ? 'Edit Transaction' : 'Record Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Cash In vs Cash Out Segmented Toggle */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
              Cash In (Income)
            </button>
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              Cash Out (Expense)
            </button>
          </div>

          {/* Amount Input */}
          <div className="text-center py-1">
            <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              Amount
            </label>
            <div className="relative mt-1 flex items-center justify-center">
              <span className="text-2xl font-bold text-slate-400 mr-1.5">{currency}</span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="text-4xl font-extrabold text-slate-900 dark:text-white bg-transparent outline-none text-center w-56 tracking-tight placeholder-slate-300 dark:placeholder-slate-700"
                required
              />
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Category
              </label>
              {onCreateCategory && (
                <button
                  type="button"
                  onClick={() => setShowAddCat(!showAddCat)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Category
                </button>
              )}
            </div>

            {/* Inline add category */}
            {showAddCat && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <input
                  type="text"
                  placeholder="New category name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg text-xs outline-none border border-slate-200 dark:border-slate-600"
                />
                <button
                  type="button"
                  onClick={handleCreateNewCategory}
                  className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                >
                  Save
                </button>
              </div>
            )}

            {/* Category Grid */}
            <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto pr-1">
              {filteredCategories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl text-left border transition-all text-xs ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 text-[10px]"
                      style={{ backgroundColor: cat.color || '#3B82F6' }}
                    >
                      <CategoryIcon name={cat.icon || 'Tag'} className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['Cash', 'Bank Account', 'Mobile Wallet'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2 px-2 rounded-xl text-xs font-medium transition-all text-center ${
                    paymentMethod === method
                      ? 'bg-slate-900 text-white dark:bg-emerald-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Receipt Image Attachment (Mobile Camera / Gallery) */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">
              Receipt Photo / Attachment
            </label>
            {receiptImage ? (
              <div className="relative w-full h-24 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700">
                <img
                  src={receiptImage}
                  alt="Receipt Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setReceiptImage('')}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80"
                  title="Remove Receipt"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs cursor-pointer transition-colors">
                <Camera className="w-4 h-4 text-emerald-500" />
                <span>Snap / Upload Receipt Image</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Recurring Transaction Switch */}
          {!initialData && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-indigo-500" />
                  Make this Recurring
                </span>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
              </label>

              {isRecurring && (
                <div className="flex gap-2 pt-1">
                  {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setFrequency(freq)}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-bold capitalize transition-all ${
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

          {/* Date & Note Inputs */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Note / Description (Optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Grocery shopping at superstore"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 rounded-2xl text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-98 ${
              type === 'income'
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
            }`}
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                {initialData ? 'Update Record' : type === 'income' ? 'Record Cash In' : 'Record Cash Out'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
