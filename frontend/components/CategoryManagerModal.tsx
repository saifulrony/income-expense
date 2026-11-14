'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, Tag, Check, Palette } from 'lucide-react';
import { Category, TransactionType } from '@/lib/types';
import { CategoryIcon, availableIcons } from './CategoryIcons';
import { api } from '@/lib/api';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onRefresh: () => void;
}

export default function CategoryManagerModal({
  isOpen,
  onClose,
  categories,
  onRefresh,
}: CategoryManagerModalProps) {
  const [activeTab, setActiveTab] = useState<TransactionType>('expense');
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Tag');
  const [color, setColor] = useState('#EF4444');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const colorPresets = [
    '#10B981', '#059669', '#34D399', '#3B82F6', '#2563EB',
    '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#F59E0B'
  ];

  if (!isOpen) return null;

  const filtered = categories.filter((c) => c.type === activeTab);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      setError('');
      await api.createCategory({
        name: name.trim(),
        type: activeTab,
        icon,
        color,
      });
      setName('');
      setShowAddForm(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, isDefault: boolean) => {
    if (isDefault) {
      alert('Default categories cannot be deleted.');
      return;
    }
    if (!confirm('Delete this category? (Existing transactions will remain in history)')) return;

    try {
      await api.deleteCategory(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Manage Categories
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Tab Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              onClick={() => {
                setActiveTab('expense');
                setColor('#EF4444');
              }}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'expense'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Expense Categories ({categories.filter((c) => c.type === 'expense').length})
            </button>
            <button
              onClick={() => {
                setActiveTab('income');
                setColor('#10B981');
              }}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'income'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Income Categories ({categories.filter((c) => c.type === 'income').length})
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Personalize with custom colors & icons</span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Category
            </button>
          </div>

          {/* Add Category Form */}
          {showAddForm && (
            <form onSubmit={handleCreate} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              {error && (
                <div className="text-xs text-rose-500 font-semibold">{error}</div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1 uppercase">
                  Category Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Subscriptions, Groceries, Dividends"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
                  required
                />
              </div>

              {/* Color Presets */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1 uppercase">
                  Color Tag
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {colorPresets.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full shrink-0 transition-transform flex items-center justify-center ${
                        color === c ? 'scale-110 ring-2 ring-slate-900 dark:ring-white' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Presets */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1 uppercase">
                  Icon
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {availableIcons.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border transition-all ${
                        icon === ic
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-600'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      <CategoryIcon name={ic} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow"
              >
                {loading ? 'Creating...' : 'Save Category'}
              </button>
            </form>
          )}

          {/* List of categories */}
          <div className="space-y-2">
            {filtered.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 text-xs shadow-sm"
                    style={{ backgroundColor: cat.color || '#3B82F6' }}
                  >
                    <CategoryIcon name={cat.icon || 'Tag'} className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {cat.name}
                    </div>
                    <div className="text-xs text-slate-400 capitalize">
                      {cat.is_default ? 'System Default' : 'Custom Category'}
                    </div>
                  </div>
                </div>

                {!cat.is_default && (
                  <button
                    onClick={() => handleDelete(cat.id, cat.is_default)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

