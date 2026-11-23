'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Search,
  Tag,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Check,
  AlertCircle,
  Hash,
  Sparkles,
  Target,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  Wallet,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
} from 'lucide-react';
import { Category, Transaction, TransactionType, BudgetOverview, BudgetStatusItem } from '@/lib/types';
import { CategoryIcon, availableIcons } from './CategoryIcons';
import { api } from '@/lib/api';
import { OfflineStorage } from '@/lib/offline-storage';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { checkBudgetNotifications } from '@/lib/notifications';
import { useTranslation, useTranslateCategory } from '@/lib/i18n';

interface CategoriesViewProps {
  categories: Category[];
  transactions: Transaction[];
  budgetOverview?: BudgetOverview | null;
  currency?: string;
  onRefresh: () => void;
  onBack?: () => void;
}

const COLOR_OPTIONS = [
  { name: 'Emerald Green', hex: '#10B981' },
  { name: 'Dark Emerald', hex: '#059669' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Cyan Blue', hex: '#06B6D4' },
  { name: 'Sky Blue', hex: '#0EA5E9' },
  { name: 'Royal Blue', hex: '#3B82F6' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Rose Red', hex: '#F43F5E' },
  { name: 'Crimson Red', hex: '#EF4444' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Amber Gold', hex: '#F59E0B' },
  { name: 'Slate Gray', hex: '#64748B' },
];

const COLOR_PALETTE = [
  '#10B981', // Emerald
  '#059669', // Dark Emerald
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#0EA5E9', // Sky
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#A855F7', // Purple
  '#D946EF', // Fuchsia
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#64748B', // Slate
];

export default function CategoriesView({
  categories,
  transactions,
  budgetOverview,
  currency = '$',
  onRefresh,
  onBack,
}: CategoriesViewProps) {
  const symbol = getCurrencySymbol(currency);
  const { t } = useTranslation();
  const tCat = useTranslateCategory();
  const [activeTab, setActiveTab] = useState<TransactionType>('expense');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [statsCategory, setStatsCategory] = useState<Category | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states (for Create & Edit)
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formIcon, setFormIcon] = useState('Tag');
  const [formColor, setFormColor] = useState('#10B981');
  const [formBudgetLimit, setFormBudgetLimit] = useState<string>('');
  const [iconSearch, setIconSearch] = useState('');
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Touch swipe-right-to-close gesture state for the right sidebar
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  const isFormOpen = Boolean(isCreateOpen || editingCategory || statsCategory);

  useEffect(() => {
    if (!isFormOpen) {
      setDragX(0);
      setIsDragging(false);
      isHorizontalSwipeRef.current = null;
    }
  }, [isFormOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isFormOpen) return;
    const t = e.touches[0];
    if (!t) return;
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    startTimeRef.current = Date.now();
    isHorizontalSwipeRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isFormOpen) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;

    // Detect horizontal swipe towards right
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
    const velocity = dragX / elapsed; // px per ms
    const shouldClose = dragX > 75 || velocity > 0.35;

    setIsDragging(false);
    setDragX(0);
    isHorizontalSwipeRef.current = null;

    if (shouldClose) {
      closeFormModal();
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute category transaction usage & this month spending
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; thisMonthAmount: number; allTimeAmount: number }> = {};
    categories.forEach((c) => {
      stats[c.id] = { count: 0, thisMonthAmount: 0, allTimeAmount: 0 };
    });

    transactions.forEach((tx) => {
      const catId = tx.category_id;
      if (!catId) return;
      if (!stats[catId]) {
        stats[catId] = { count: 0, thisMonthAmount: 0, allTimeAmount: 0 };
      }
      stats[catId].count += 1;
      stats[catId].allTimeAmount += tx.amount || 0;
      if (tx.date && tx.date.startsWith(currentMonthPrefix)) {
        stats[catId].thisMonthAmount += tx.amount || 0;
      }
    });

    return stats;
  }, [categories, transactions, currentMonthPrefix]);

  // Map category_id -> BudgetStatusItem
  const budgetMap = useMemo(() => {
    const map: Record<string, BudgetStatusItem> = {};
    if (budgetOverview?.budgets) {
      budgetOverview.budgets.forEach((b) => {
        map[b.category_id] = b;
      });
    }
    return map;
  }, [budgetOverview]);

  const expenseCategories = useMemo(() => categories.filter((c) => c.type === 'expense'), [categories]);
  const incomeCategories = useMemo(() => categories.filter((c) => c.type === 'income'), [categories]);

  const budgetedExpenseCount = useMemo(() => {
    return expenseCategories.filter((c) => !!budgetMap[c.id]).length;
  }, [expenseCategories, budgetMap]);

  const exceededExpenseCount = useMemo(() => {
    return expenseCategories.filter((c) => budgetMap[c.id]?.status === 'exceeded').length;
  }, [expenseCategories, budgetMap]);

  // Meaningful monthly financial stats
  const monthlyFinancials = useMemo(() => {
    let monthExpense = 0;
    let monthIncome = 0;

    transactions.forEach((tx) => {
      if (tx.date && tx.date.startsWith(currentMonthPrefix)) {
        if (tx.type === 'expense') monthExpense += tx.amount || 0;
        if (tx.type === 'income') monthIncome += tx.amount || 0;
      }
    });

    // Find top spending category this month
    interface TopCategoryInfo {
      name: string;
      icon: string;
      color: string;
      amount: number;
    }
    let topCat: TopCategoryInfo | null = null;
    for (const c of expenseCategories) {
      const amount = categoryStats[c.id]?.thisMonthAmount || 0;
      if (amount > 0 && (!topCat || amount > topCat.amount)) {
        topCat = {
          name: c.name,
          icon: c.icon || 'Tag',
          color: c.color || '#EF4444',
          amount,
        };
      }
    }

    const totalBudget = budgetOverview?.total_budget || 0;
    const totalSpent = budgetOverview?.total_spent || 0;
    const hasBudget = totalBudget > 0;
    const remainingBudget = totalBudget - totalSpent;
    const percentage = budgetOverview?.percentage || 0;

    return {
      monthExpense,
      monthIncome,
      topCat: topCat as TopCategoryInfo | null,
      hasBudget,
      totalBudget,
      totalSpent,
      remainingBudget,
      percentage,
    };
  }, [transactions, currentMonthPrefix, expenseCategories, categoryStats, budgetOverview]);

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      if (c.type !== activeTab) return false;
      if (!searchQuery.trim()) return true;
      return c.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    });
  }, [categories, activeTab, searchQuery]);

  const openCreateModal = () => {
    setFormName('');
    setFormType(activeTab);
    setFormIcon('Tag');
    setFormColor(activeTab === 'income' ? '#10B981' : '#EF4444');
    setFormBudgetLimit('');
    setIconSearch('');
    setIsIconPickerOpen(false);
    setIsColorPickerOpen(false);
    setIsCreateOpen(true);
    setEditingCategory(null);
    setStatsCategory(null);
    setFeedback(null);
  };

  const openEditModal = (cat: Category, focusBudget = false) => {
    setFormName(cat.name);
    setFormType(cat.type);
    setFormIcon(cat.icon || 'Tag');
    setFormColor(cat.color || '#3B82F6');
    const existingBudget = budgetMap[cat.id];
    setFormBudgetLimit(existingBudget ? String(existingBudget.budget_limit) : '');
    setIconSearch('');
    setIsIconPickerOpen(false);
    setIsColorPickerOpen(false);
    setEditingCategory(cat);
    setStatsCategory(null);
    setIsCreateOpen(false);
    setFeedback(null);
  };

  const openStatsModal = (cat: Category) => {
    setStatsCategory(cat);
    setEditingCategory(null);
    setIsCreateOpen(false);
    setIsIconPickerOpen(false);
    setIsColorPickerOpen(false);
    setFeedback(null);
  };

  const closeFormModal = () => {
    setIsCreateOpen(false);
    setEditingCategory(null);
    setStatsCategory(null);
    setIsIconPickerOpen(false);
    setIsColorPickerOpen(false);
    setFeedback(null);
    setDragX(0);
    setIsDragging(false);
  };

  // Detailed statistics for the currently inspected category (statsCategory)
  const selectedCategoryStats = useMemo(() => {
    if (!statsCategory) return null;
    const catTxs = transactions
      .filter((tx) => tx.category_id === statsCategory.id)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthPrefix = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    let thisMonthTotal = 0;
    let thisMonthCount = 0;
    let lastMonthTotal = 0;
    let allTimeTotal = 0;
    let maxTx: Transaction | null = null;

    catTxs.forEach((tx) => {
      const amt = tx.amount || 0;
      allTimeTotal += amt;
      if (!maxTx || amt > (maxTx.amount || 0)) {
        maxTx = tx;
      }
      if (tx.date?.startsWith(currentMonthPrefix)) {
        thisMonthTotal += amt;
        thisMonthCount += 1;
      } else if (tx.date?.startsWith(prevMonthPrefix)) {
        lastMonthTotal += amt;
      }
    });

    const totalCount = catTxs.length;
    const avgPerEntry = totalCount > 0 ? allTimeTotal / totalCount : 0;

    const totalMonthlyType =
      statsCategory.type === 'expense' ? monthlyFinancials.monthExpense : monthlyFinancials.monthIncome;
    const shareOfMonth = totalMonthlyType > 0 ? Math.round((thisMonthTotal / totalMonthlyType) * 100) : 0;

    const momDiff = thisMonthTotal - lastMonthTotal;
    const momPct =
      lastMonthTotal > 0
        ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
        : thisMonthTotal > 0
        ? 100
        : 0;

    // Build 6-month trend bars
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendMonths: { label: string; prefix: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      trendMonths.push({
        label: monthNames[d.getMonth()],
        prefix,
        amount: 0,
      });
    }
    catTxs.forEach((tx) => {
      const m = trendMonths.find((tm) => tx.date?.startsWith(tm.prefix));
      if (m) m.amount += tx.amount || 0;
    });
    const maxTrendAmount = Math.max(...trendMonths.map((m) => m.amount), 1);

    return {
      thisMonthTotal,
      thisMonthCount,
      lastMonthTotal,
      allTimeTotal,
      totalCount,
      avgPerEntry,
      maxTx: maxTx as Transaction | null,
      shareOfMonth,
      momDiff,
      momPct,
      trendMonths,
      maxTrendAmount,
      recentTxs: catTxs.slice(0, 6),
    };
  }, [statsCategory, transactions, currentMonthPrefix, monthlyFinancials]);

  const handleSaveCategoryAndBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFeedback({ type: 'error', text: 'Please enter a category name.' });
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);

      let targetCatId = editingCategory?.id;

      if (editingCategory) {
        // Update existing category details
        await api.updateCategory(editingCategory.id, {
          name: formName.trim(),
          icon: formIcon,
          color: formColor,
        });
      } else {
        // Create new category
        const res = await api.createCategory({
          name: formName.trim(),
          type: formType,
          icon: formIcon,
          color: formColor,
        });
        targetCatId = res.category.id;
      }

      // Handle Category Monthly Budget (for expense categories)
      if (formType === 'expense' && targetCatId) {
        const numBudget = parseFloat(formBudgetLimit);
        const existingBudget = budgetMap[targetCatId];

        if (!isNaN(numBudget) && numBudget > 0) {
          // Set or update budget
          await api.setBudget({
            category_id: targetCatId,
            amount: numBudget,
          });
          const updatedBuds = OfflineStorage.getBudgets();
          checkBudgetNotifications(updatedBuds, symbol);
        } else if (existingBudget && (!formBudgetLimit.trim() || numBudget === 0)) {
          // User cleared the budget, remove it
          await api.deleteBudget(existingBudget.budget_id);
        }
      }

      setFeedback({
        type: 'success',
        text: `Category "${formName}" ${editingCategory ? 'updated' : 'created'} with budget saved!`,
      });

      onRefresh();
      setTimeout(() => {
        closeFormModal();
      }, 500);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to save changes.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (cat.is_default) {
      alert('Default categories cannot be deleted to protect standard ledger reports.');
      return;
    }

    const usage = categoryStats[cat.id]?.count || 0;
    const confirmMsg = usage > 0
      ? `Delete "${cat.name}"? ${usage} recorded transaction(s) will remain in your history under General.`
      : `Delete category "${cat.name}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      // If budget exists, delete it too
      const existingBudget = budgetMap[cat.id];
      if (existingBudget) {
        await api.deleteBudget(existingBudget.budget_id).catch(() => null);
      }
      await api.deleteCategory(cat.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category.');
    }
  };

  const filteredIcons = useMemo(() => {
    if (!iconSearch.trim()) return availableIcons;
    return availableIcons.filter((i) => i.toLowerCase().includes(iconSearch.toLowerCase().trim()));
  }, [iconSearch]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Minimal Top Header */}
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <h1 className="text-base font-bold text-slate-900 dark:text-white">
          {t("categoriesBudgets") || "Categories & Budgets"}
        </h1>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t("addCategory") || "New Category"}</span>
        </button>
      </div>

      {/* Important Financial Stats */}
      <div className="grid grid-cols-2 gap-3">
        {/* Card 1: Month's Expense Spending */}
        <div className="p-3.5 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-bold">{t("spentThisMonth") || "Month Spending"}</span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white truncate">
            {currency}{formatAmount(monthlyFinancials.monthExpense)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            Across active categories
          </p>
        </div>

        {/* Card 2: Top Expense Category */}
        <div className="p-3.5 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
            <PieChart className="w-4 h-4" />
            <span className="text-xs font-bold">{t("topSpend") || "Top Spending"}</span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white truncate">
            {monthlyFinancials.topCat ? (
              tCat(monthlyFinancials.topCat.name)
            ) : (
              <span className="text-slate-400 text-base font-semibold">None yet</span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {monthlyFinancials.topCat
              ? `${currency}${formatAmount(monthlyFinancials.topCat.amount)} spent this month`
              : 'No expense recorded this month'}
          </p>
        </div>
      </div>

      {/* Tab Switcher & Filter Controls */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Main Income vs Expense Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-md max-w-xs">
            <button
              type="button"
              onClick={() => setActiveTab('expense')}
              className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'expense'
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>{t("expense")} ({expenseCategories.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('income')}
              className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'income'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{t("income")} ({incomeCategories.length})</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab} categories...`}
              className="w-full bg-white dark:bg-slate-800 text-xs pl-9 pr-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category List Cards */}
        <div className="space-y-2">
          {filteredCategories.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80">
              <Tag className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {searchQuery ? (t('noCategoriesFound') || 'No matching categories found') : `${t('noTransactionsYet')}`}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-3 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-bold"
                >
                  {t('addCategory') || 'Create Category'}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredCategories.map((cat) => {
                const stats = categoryStats[cat.id] || { count: 0, thisMonthAmount: 0, allTimeAmount: 0 };
                const budgetItem = cat.type === 'expense' ? budgetMap[cat.id] : null;

                const isExceeded = budgetItem?.status === 'exceeded';
                const isWarning = budgetItem?.status === 'warning';
                const percentClamped = Math.min(100, budgetItem?.percentage || 0);

                return (
                  <div
                    key={cat.id}
                    onClick={() => openEditModal(cat)}
                    className={`p-3 bg-white dark:bg-slate-800/90 rounded-[10px] border shadow-xs transition-all cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 flex flex-col justify-between gap-2 group ${
                      isExceeded
                        ? 'border-rose-300 dark:border-rose-800/80'
                        : isWarning
                        ? 'border-amber-300 dark:border-amber-800/80'
                        : 'border-slate-200/80 dark:border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      {/* Left: Icon + Name & Subtitle */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-white shadow-xs"
                          style={{ backgroundColor: cat.color || '#10B981' }}
                        >
                          <CategoryIcon name={cat.icon || 'Tag'} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {tCat(cat.name)}
                            </h3>
                            {cat.is_default && (
                              <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-400 dark:text-slate-400">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {budgetItem ? (
                              <span>
                                Limit: {currency}{formatAmount(budgetItem.budget_limit)}/mo • {stats.count} {stats.count === 1 ? 'entry' : 'entries'}
                              </span>
                            ) : (
                              <span>
                                {cat.type === 'expense' ? 'Expense' : 'Income'} • {stats.count} {stats.count === 1 ? 'entry' : 'entries'}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Right: Actions / Status */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {budgetItem && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              isExceeded
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : isWarning
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            {isExceeded ? 'Over' : isWarning ? 'Warning' : 'Safe'}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => openStatsModal(cat)}
                          className="p-1.5 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                          title="Category Stats"
                          aria-label={`View stats for ${cat.name}`}
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(cat)}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {!cat.is_default && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Minimal 1.5px progress bar if budget is set */}
                    {budgetItem && (
                      <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percentClamped}%` }}
                        />
                      </div>
                    )}

                    {/* Bottom Stat Row: Spent / Income with Flow Icon & Important Stats */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                      {/* Left: Spent or Earned Stat with Flow Icon */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        {cat.type === 'expense' ? (
                          <div className="w-4 h-4 rounded-full bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-500 shrink-0">
                            <TrendingDown className="w-2.5 h-2.5" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-500 shrink-0">
                            <TrendingUp className="w-2.5 h-2.5" />
                          </div>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {cat.type === 'expense' ? 'Spent this month:' : 'Earned this month:'}
                        </span>
                        <span
                          className={`text-xs font-bold font-mono ${
                            cat.type === 'expense'
                              ? stats.thisMonthAmount > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-500 dark:text-slate-400'
                              : stats.thisMonthAmount > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {currency}{formatAmount(stats.thisMonthAmount)}
                        </span>
                      </div>

                      {/* Right: Important Stats Icon & Indicator */}
                      <div className="flex items-center gap-1 text-[11px] shrink-0 font-medium">
                        {budgetItem ? (
                          isExceeded ? (
                            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold font-mono">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                              <span>Over +{currency}{formatAmount(budgetItem.actual_spent - budgetItem.budget_limit)}</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-mono">
                              <Target className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                              <span>{currency}{formatAmount(budgetItem.remaining)} left ({budgetItem.percentage}%)</span>
                            </span>
                          )
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400 dark:text-slate-400 font-mono">
                            <Wallet className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            <span>Total: {currency}{formatAmount(stats.allTimeAmount)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Right Sidebar (Portaled directly to document.body to prevent top clipping) */}
      {mounted && (isCreateOpen || editingCategory) && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex justify-end">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
              style={{
                opacity: isDragging ? Math.max(0.15, 1 - dragX / 280) : 1,
              }}
              onClick={closeFormModal}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
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
              className="relative w-80 max-w-[85vw] sm:w-[380px] sm:max-w-[85vw] h-full h-[100dvh] bg-white dark:bg-slate-900 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-slate-800 overflow-hidden will-change-transform"
              onClick={(e) => e.stopPropagation()}
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
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center text-white shadow-xs shrink-0"
                    style={{ backgroundColor: formColor }}
                  >
                    <CategoryIcon name={formIcon} className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
                      {editingCategory ? `Edit: ${editingCategory.name}` : `New ${formType === 'income' ? 'Income' : 'Expense'} Category`}
                    </h2>
                    <p className="text-[11px] text-slate-400 capitalize truncate">
                      {formType} category &amp; budget
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                  title="Close Sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Wrapper: full-height flex column so footer always pins to the bottom-most edge */}
              <form
                onSubmit={handleSaveCategoryAndBudget}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                {/* Scrollable Form Fields */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
                  {feedback && (
                  <div
                    className={`p-3 rounded-md flex items-center gap-2 text-xs font-semibold ${
                      feedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                    }`}
                  >
                    {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{feedback.text}</span>
                  </div>
                )}

                {/* Type Switcher (only for new categories) */}
                {!editingCategory && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Category Type
                    </label>
                    <div className="grid grid-cols-2 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                      <button
                        type="button"
                        onClick={() => {
                          setFormType('expense');
                          setFormColor('#EF4444');
                        }}
                        className={`py-1.5 rounded text-xs font-bold transition-all ${
                          formType === 'expense'
                            ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Expense (Cash Out)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormType('income');
                          setFormColor('#10B981');
                          setFormBudgetLimit('');
                        }}
                        className={`py-1.5 rounded text-xs font-bold transition-all ${
                          formType === 'income'
                            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Income (Cash In)
                      </button>
                    </div>
                  </div>
                )}

                {/* Category Name Input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Freelance, Groceries, Rent"
                    className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 font-medium"
                    required
                  />
                </div>

                {/* Monthly Spending Limit (Expense only) */}
                {formType === 'expense' && (
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-md border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Monthly Budget Limit ({currency})</span>
                      </label>
                      {formBudgetLimit && (
                        <button
                          type="button"
                          onClick={() => setFormBudgetLimit('')}
                          className="text-[10px] text-rose-500 hover:underline font-semibold"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                        {currency}
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={formBudgetLimit}
                        onChange={(e) => setFormBudgetLimit(e.target.value)}
                        placeholder="e.g. 500 (No limit if left empty)"
                        className="w-full bg-white dark:bg-slate-900 text-xs pl-7 pr-3 py-2 rounded-md border border-indigo-200 dark:border-indigo-800 outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-medium"
                      />
                    </div>

                    {/* Preset Quick Chips */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-slate-400">Quick set:</span>
                      {['100', '300', '500', '1000'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setFormBudgetLimit(preset)}
                          className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400 transition-colors font-semibold"
                        >
                          {currency}{preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                  {/* Collapsible Icon Selector (Opens Scrollable Grid on Click) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Icon
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsIconPickerOpen((prev) => !prev);
                        setIsColorPickerOpen(false);
                      }}
                      className="w-full flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0 shadow-xs"
                          style={{ backgroundColor: formColor }}
                        >
                          <CategoryIcon name={formIcon} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">
                            {formIcon}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Tap to {isIconPickerOpen ? 'hide' : 'choose'} icon
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                          isIconPickerOpen ? 'rotate-180 text-emerald-500' : ''
                        }`}
                      />
                    </button>

                    {isIconPickerOpen && (
                      <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 p-2 max-h-40 overflow-y-auto overscroll-contain bg-slate-50/70 dark:bg-slate-800/40 rounded-lg border border-slate-200/80 dark:border-slate-700/80 animate-in fade-in duration-150">
                        {availableIcons.map((iconName) => {
                          const isSelected = formIcon === iconName;
                          return (
                            <button
                              key={iconName}
                              type="button"
                              onClick={() => {
                                setFormIcon(iconName);
                                setIsIconPickerOpen(false);
                              }}
                              title={iconName}
                              style={isSelected ? { backgroundColor: formColor } : undefined}
                              className={`h-9 rounded-md flex items-center justify-center transition-all ${
                                isSelected
                                  ? 'text-white shadow-xs ring-2 ring-slate-900/15 dark:ring-white/30 scale-105'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <CategoryIcon name={iconName} className="w-4 h-4" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Collapsible Color Theme Selector (Opens Scrollable Grid on Click) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Color Theme</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsColorPickerOpen((prev) => !prev);
                        setIsIconPickerOpen(false);
                      }}
                      className="w-full flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-8 h-8 rounded-md shrink-0 shadow-xs border border-black/10 dark:border-white/10 flex items-center justify-center text-white"
                          style={{ backgroundColor: formColor }}
                        >
                          <Check className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">
                            {COLOR_OPTIONS.find((c) => c.hex === formColor)?.name || formColor}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Tap to {isColorPickerOpen ? 'hide' : 'choose'} color ({formColor})
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                          isColorPickerOpen ? 'rotate-180 text-emerald-500' : ''
                        }`}
                      />
                    </button>

                    {isColorPickerOpen && (
                      <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 p-2 max-h-40 overflow-y-auto overscroll-contain bg-slate-50/70 dark:bg-slate-800/40 rounded-lg border border-slate-200/80 dark:border-slate-700/80 animate-in fade-in duration-150">
                        {COLOR_OPTIONS.map((c) => {
                          const isSelected = formColor === c.hex;
                          return (
                            <button
                              key={c.hex}
                              type="button"
                              onClick={() => {
                                setFormColor(c.hex);
                                setIsColorPickerOpen(false);
                              }}
                              title={`${c.name} (${c.hex})`}
                              style={{ backgroundColor: c.hex }}
                              className={`h-9 rounded-md flex items-center justify-center transition-all text-white ${
                                isSelected
                                  ? 'shadow-xs ring-2 ring-slate-900 dark:ring-white scale-105'
                                  : 'opacity-85 hover:opacity-100 hover:scale-105 border border-black/10 dark:border-white/10'
                              }`}
                            >
                              {isSelected && <Check className="w-4 h-4 drop-shadow-xs" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
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
                    onClick={closeFormModal}
                    className="flex-1 py-2.5 px-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-md text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Category Stats Right Sidebar (Portaled directly to document.body) */}
      {mounted && statsCategory && selectedCategoryStats && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex justify-end">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
              style={{
                opacity: isDragging ? Math.max(0.15, 1 - dragX / 280) : 1,
              }}
              onClick={closeFormModal}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
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
              className="relative w-80 max-w-[85vw] sm:w-[380px] sm:max-w-[85vw] h-full h-[100dvh] bg-white dark:bg-slate-900 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-slate-800 overflow-hidden will-change-transform"
              onClick={(e) => e.stopPropagation()}
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
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center text-white shadow-xs shrink-0"
                    style={{ backgroundColor: statsCategory.color || '#3B82F6' }}
                  >
                    <CategoryIcon name={statsCategory.icon || 'Tag'} className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
                      {statsCategory.name}
                    </h2>
                    <p className="text-[11px] text-slate-400 capitalize truncate">
                      {statsCategory.type} statistics &amp; insights
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                  title="Close Sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Stats Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
                {/* Primary KPI Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      This Month
                    </span>
                    <div
                      className={`text-base font-bold font-mono mt-0.5 truncate ${
                        statsCategory.type === 'expense'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {currency}{formatAmount(selectedCategoryStats.thisMonthTotal)}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {selectedCategoryStats.thisMonthCount} {selectedCategoryStats.thisMonthCount === 1 ? 'entry' : 'entries'} • {selectedCategoryStats.shareOfMonth}% of month
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      All-Time Total
                    </span>
                    <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5 truncate">
                      {currency}{formatAmount(selectedCategoryStats.allTimeTotal)}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {selectedCategoryStats.totalCount} total {selectedCategoryStats.totalCount === 1 ? 'entry' : 'entries'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Avg / Entry
                    </span>
                    <div className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5 truncate">
                      {currency}{formatAmount(selectedCategoryStats.avgPerEntry)}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Last month: {currency}{formatAmount(selectedCategoryStats.lastMonthTotal)}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Highest Entry
                    </span>
                    <div className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5 truncate">
                      {selectedCategoryStats.maxTx
                        ? `${currency}${formatAmount(selectedCategoryStats.maxTx.amount)}`
                        : `${currency}0.00`}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {selectedCategoryStats.maxTx?.date || 'No records yet'}
                    </p>
                  </div>
                </div>

                {/* Month-over-Month Comparison Badge */}
                <div className="p-3 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      vs Last Month
                    </span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {selectedCategoryStats.momDiff === 0
                        ? 'Same as last month'
                        : `${selectedCategoryStats.momDiff > 0 ? '+' : '-'}${currency}${formatAmount(Math.abs(selectedCategoryStats.momDiff))}`}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      selectedCategoryStats.momDiff === 0
                        ? 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        : (statsCategory.type === 'expense' ? selectedCategoryStats.momDiff > 0 : selectedCategoryStats.momDiff < 0)
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                    }`}
                  >
                    {selectedCategoryStats.momDiff > 0 ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : selectedCategoryStats.momDiff < 0 ? (
                      <ArrowDownRight className="w-3 h-3" />
                    ) : null}
                    {Math.abs(selectedCategoryStats.momPct)}%
                  </span>
                </div>

                {/* Budget Progress Card (for Expense categories) */}
                {statsCategory.type === 'expense' && (
                  <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Monthly Budget</span>
                      </span>
                      {budgetMap[statsCategory.id] ? (
                        <span className="text-[11px] font-bold font-mono text-indigo-700 dark:text-indigo-300">
                          {budgetMap[statsCategory.id].percentage}% used
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEditModal(statsCategory, true)}
                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          + Set Limit
                        </button>
                      )}
                    </div>
                    {budgetMap[statsCategory.id] ? (
                      <>
                        <div className="w-full h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-950 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              budgetMap[statsCategory.id].status === 'exceeded'
                                ? 'bg-rose-500'
                                : budgetMap[statsCategory.id].status === 'warning'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, budgetMap[statsCategory.id].percentage)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          <span>Spent: {currency}{formatAmount(budgetMap[statsCategory.id].actual_spent)}</span>
                          <span>Limit: {currency}{formatAmount(budgetMap[statsCategory.id].budget_limit)}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        No monthly budget limit configured for this category.
                      </p>
                    )}
                  </div>
                )}

                {/* 6-Month Trend Mini Chart */}
                <div className="p-3 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      <span>6-Month Trend</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 items-end h-20 pt-2">
                    {selectedCategoryStats.trendMonths.map((m) => {
                      const heightPct = m.amount > 0 ? Math.max(12, Math.round((m.amount / selectedCategoryStats.maxTrendAmount) * 100)) : 4;
                      const isCurrent = m.prefix === currentMonthPrefix;
                      return (
                        <div key={m.prefix} className="flex flex-col items-center gap-1 h-full justify-end">
                          <div className="w-full flex-1 flex items-end justify-center">
                            <div
                              title={`${m.label}: ${currency}${formatAmount(m.amount)}`}
                              style={{
                                height: `${heightPct}%`,
                                backgroundColor:
                                  m.amount > 0
                                    ? statsCategory.color || (statsCategory.type === 'expense' ? '#EF4444' : '#10B981')
                                    : undefined,
                                opacity: isCurrent ? 1 : 0.65,
                              }}
                              className={`w-full max-w-[22px] rounded-t transition-all ${
                                m.amount === 0 ? 'bg-slate-200 dark:bg-slate-700' : ''
                              }`}
                            />
                          </div>
                          <span
                            className={`text-[9px] font-semibold ${
                              isCurrent ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400'
                            }`}
                          >
                            {m.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Transactions in this Category */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Recent Entries ({selectedCategoryStats.totalCount})
                  </span>
                  {selectedCategoryStats.recentTxs.length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                      No transactions recorded in {statsCategory.name} yet.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedCategoryStats.recentTxs.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {tx.note || statsCategory.name}
                            </p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-2.5 h-2.5" />
                              <span>{tx.date}</span>
                            </p>
                          </div>
                          <span
                            className={`font-bold font-mono shrink-0 ${
                              statsCategory.type === 'expense'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {statsCategory.type === 'expense' ? '-' : '+'}
                            {currency}{formatAmount(tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
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
                  onClick={closeFormModal}
                  className="flex-1 py-2.5 px-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(statsCategory)}
                  className="flex-1 py-2.5 px-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-md text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit &amp; Budget</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
