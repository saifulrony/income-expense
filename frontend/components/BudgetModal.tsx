'use client';

import React, { useState } from 'react';
import { X, Target, Check, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Category, BudgetOverview, BudgetStatusItem } from '@/lib/types';
import { CategoryIcon } from './CategoryIcons';
import { api } from '@/lib/api';
import { getCurrencySymbol } from '@/lib/currency';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  currency: string;
  budgetOverview: BudgetOverview | null;
  onRefresh: () => void;
}

export default function BudgetModal({
  isOpen,
  onClose,
  categories,
  currency,
  budgetOverview,
  onRefresh,
}: BudgetModalProps) {
  const symbol = getCurrencySymbol(currency);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid budget amount');
      return;
    }

    if (!selectedCatId) {
      setError('Please select a category');
      return;
    }

    try {
      setLoading(true);
      await api.setBudget({
        category_id: selectedCatId,
        amount: numAmount,
      });
      setAmount('');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to set budget');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await api.deleteBudget(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to remove budget');
    }
  };

  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[14px] sm:rounded-[10px] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Category Budgets & Limits
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md text-rose-600 dark:text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Form to Set / Update Budget */}
          <form onSubmit={handleSaveBudget} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-[10px] border border-slate-200 dark:border-slate-700 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Set Category Spending Limit
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 block mb-1 font-semibold">
                  Expense Category
                </label>
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
                  required
                >
                  <option value="">Select Category</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1 font-semibold">
                  Monthly Limit ({symbol})
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 300"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold shadow-md shadow-indigo-600/25 flex items-center justify-center gap-1.5 transition-all"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Category Budget
                </>
              )}
            </button>
          </form>

          {/* Active Budgets List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Active Category Budgets
            </h3>

            {!budgetOverview || budgetOverview.budgets.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No monthly budgets set yet. Set a spending limit above to avoid overspending!
              </p>
            ) : (
              <div className="space-y-3">
                {budgetOverview.budgets.map((b) => {
                  const isExceeded = b.status === 'exceeded';
                  const isWarning = b.status === 'warning';

                  return (
                    <div
                      key={b.budget_id}
                      className={`p-3.5 rounded-[10px] border transition-all ${
                        isExceeded
                          ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                          : isWarning
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
                          : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs"
                            style={{ backgroundColor: b.category_color || '#EF4444' }}
                          >
                            <CategoryIcon name={b.category_icon || 'Tag'} className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {b.category_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-md uppercase ${
                              isExceeded
                                ? 'bg-rose-600 text-white'
                                : isWarning
                                ? 'bg-amber-500 text-white'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            {isExceeded ? 'Exceeded' : isWarning ? 'Warning' : 'On Track'}
                          </span>
                          <button
                            onClick={() => handleDeleteBudget(b.budget_id)}
                            className="text-slate-400 hover:text-rose-500 p-1"
                            title="Delete Budget"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-slate-500">
                          Spent: <strong className="text-slate-800 dark:text-slate-200">{symbol}{formatAmount(b.actual_spent)}</strong>
                        </span>
                        <span className="text-slate-500">
                          Limit: <strong className="text-slate-800 dark:text-slate-200">{symbol}{formatAmount(b.budget_limit)}</strong>
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isExceeded ? 'bg-rose-600' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(b.percentage, 100)}%` }}
                        />
                      </div>
                      <div className="text-xs text-right mt-1 text-slate-400 font-mono">
                        {b.percentage.toFixed(0)}% used • {b.remaining >= 0 ? `${symbol}${formatAmount(b.remaining)} left` : `Over by ${symbol}${formatAmount(Math.abs(b.remaining))}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

