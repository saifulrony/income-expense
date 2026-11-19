'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingBag,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Pencil,
  Receipt,
  X,
  ShoppingCart,
  Calculator,
  CheckCheck,
} from 'lucide-react';
import { Category } from '@/lib/types';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { triggerHaptic } from '@/lib/haptics';
import { OfflineStorage } from '@/lib/offline-storage';
import { api, getAppMode } from '@/lib/api';
import {
  recordInAppNotification,
  fireLockScreenOSNotification,
  requestNotificationPermission,
  checkBudgetNotifications,
} from '@/lib/notifications';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;            // e.g. "2 kg", "1 pack"
  estimated_price?: number;
  priority: 'high' | 'normal' | 'low';
  is_bought: boolean;
  note?: string;
  created_at: string;
}

const STORAGE_KEY = 'cashflow_shopping_list';

function getStoredShoppingList(): ShoppingItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial: ShoppingItem[] = [
        {
          id: 'shop_1',
          name: 'Fresh Groceries & Vegetables',
          quantity: '1 week supply',
          estimated_price: 850,
          priority: 'high',
          is_bought: false,
          created_at: new Date().toISOString(),
        },
        {
          id: 'shop_2',
          name: 'Cooking Oil (5L)',
          quantity: '1 bottle',
          estimated_price: 920,
          priority: 'normal',
          is_bought: false,
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

function saveStoredShoppingList(list: ShoppingItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save shopping list', err);
  }
}

interface ShoppingListViewProps {
  currency?: string;
  categories?: Category[];
  activeAccountId?: string;
  onRefresh?: () => void;
  onLogAsExpense?: (data: { amount?: number; note: string; date: string }) => void;
}

export default function ShoppingListView({
  currency = 'BDT',
  categories = [],
  activeAccountId = 'all',
  onRefresh,
}: ShoppingListViewProps) {
  const symbol = getCurrencySymbol(currency);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'to_buy' | 'bought'>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Touch swipe-right-to-close gesture state
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  // Quick Add state
  const [quickName, setQuickName] = useState('');
  const [quickPrice, setQuickPrice] = useState('');

  // Sidebar Form states
  const [formName, setFormName] = useState('');
  const [formQty, setFormQty] = useState('1');
  const [formPrice, setFormPrice] = useState('');
  const [formPriority, setFormPriority] = useState<'high' | 'normal' | 'low'>('normal');
  const [formNote, setFormNote] = useState('');

  useEffect(() => {
    setMounted(true);
    setItems(getStoredShoppingList());
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) {
      setDragX(0);
      setIsDragging(false);
      isHorizontalSwipeRef.current = null;
    }
  }, [isSidebarOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isSidebarOpen) return;
    const t = e.touches[0];
    if (!t) return;
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    startTimeRef.current = Date.now();
    isHorizontalSwipeRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSidebarOpen) return;
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
      setIsSidebarOpen(false);
    }
  };

  const stats = useMemo(() => {
    let toBuyCount = 0;
    let toBuyTotal = 0;
    let boughtCount = 0;
    let boughtTotal = 0;

    items.forEach((it) => {
      const p = it.estimated_price || 0;
      if (it.is_bought) {
        boughtCount += 1;
        boughtTotal += p;
      } else {
        toBuyCount += 1;
        toBuyTotal += p;
      }
    });

    return {
      toBuyCount,
      toBuyTotal,
      boughtCount,
      boughtTotal,
      grandTotal: toBuyTotal + boughtTotal,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items
      .filter((it) => {
        if (filter === 'to_buy') return !it.is_bought;
        if (filter === 'bought') return it.is_bought;
        return true;
      })
      .sort((a, b) => {
        if (a.is_bought !== b.is_bought) return a.is_bought ? 1 : -1;
        const prioWeight = { high: 0, normal: 1, low: 2 };
        return prioWeight[a.priority] - prioWeight[b.priority];
      });
  }, [items, filter]);

  /**
   * Complete shopping:
   * 1. Records the total cost of bought items (or all items if completing the whole list) as an Expense in the ledger
   * 2. Sends notification to the Header Notification Bell Icon, Phone Lock Screen, and in-page toast
   * 3. Clears the completed items from the shopping list
   */
  const completeShoppingAndClear = async (
    completedItems: ShoppingItem[],
    remainingItems: ShoppingItem[]
  ) => {
    if (completedItems.length === 0) return;
    triggerHaptic('success');

    const totalCost = completedItems.reduce((sum, it) => sum + (it.estimated_price || 0), 0);
    const itemNames = completedItems.map((it) => it.name).join(', ');
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Find Shopping & Groceries category (or fallback to first expense category)
    const allCats = categories.length > 0 ? categories : OfflineStorage.getCategories();
    const shoppingCat =
      allCats.find(
        (c) =>
          c.type === 'expense' &&
          (c.name.toLowerCase().includes('shopping') || c.name.toLowerCase().includes('grocer'))
      ) ||
      allCats.find((c) => c.type === 'expense') ||
      allCats[0];

    // 2. Automatically add to Expense ledger if totalCost > 0
    if (totalCost > 0 && shoppingCat) {
      const targetAccountId =
        activeAccountId && activeAccountId !== 'all'
          ? activeAccountId
          : OfflineStorage.getAccounts().find((a) => a.is_default)?.id ||
            OfflineStorage.getAccounts()[0]?.id;

      OfflineStorage.createTransaction({
        account_id: targetAccountId,
        amount: totalCost,
        type: 'expense',
        category_id: shoppingCat.id,
        payment_method: 'cash',
        note: `Shopping: ${itemNames}`,
        date: todayStr,
      });

      if (getAppMode() === 'online') {
        api
          .createTransaction({
            account_id: targetAccountId,
            amount: totalCost,
            type: 'expense',
            category_id: shoppingCat.id,
            payment_method: 'cash',
            note: `Shopping: ${itemNames}`,
            date: todayStr,
          })
          .catch(() => null);
      }

      checkBudgetNotifications(OfflineStorage.getBudgets(), symbol);
      if (onRefresh) {
        onRefresh();
      }
    }

    // 3. Clear the completed items from the shopping list
    setItems(remainingItems);
    saveStoredShoppingList(remainingItems);

    // 4. Fire Notification (In-App Bell Icon + Phone Lock Screen + Toast)
    const notifTitle = '🛍️ Shopping Done — Added as Expense';
    const notifBody =
      totalCost > 0
        ? `${symbol}${formatAmount(totalCost)} (${itemNames}) was added to your Expenses and cleared from your shopping list.`
        : `Completed shopping (${itemNames}) and cleared your shopping list.`;

    recordInAppNotification({
      type: 'reminder',
      title: notifTitle,
      body: notifBody,
      category_id: shoppingCat?.id,
    });

    await requestNotificationPermission();
    await fireLockScreenOSNotification({
      title: notifTitle,
      body: notifBody,
      tag: `shopping_done_${Date.now()}`,
    });

    setFeedback(notifBody);
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;
    triggerHaptic('success');

    const newItem: ShoppingItem = {
      id: `shop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: quickName.trim(),
      quantity: '1',
      estimated_price: quickPrice.trim() ? parseFloat(quickPrice) : undefined,
      priority: 'normal',
      is_bought: false,
      created_at: new Date().toISOString(),
    };

    const updated = [newItem, ...items];
    setItems(updated);
    saveStoredShoppingList(updated);
    setQuickName('');
    setQuickPrice('');
  };

  const openCreateSidebar = () => {
    setEditingItem(null);
    setFormName('');
    setFormQty('1');
    setFormPrice('');
    setFormPriority('normal');
    setFormNote('');
    setIsSidebarOpen(true);
  };

  const openEditSidebar = (it: ShoppingItem) => {
    setEditingItem(it);
    setFormName(it.name);
    setFormQty(it.quantity || '1');
    setFormPrice(it.estimated_price ? String(it.estimated_price) : '');
    setFormPriority(it.priority || 'normal');
    setFormNote(it.note || '');
    setIsSidebarOpen(true);
  };

  const handleSaveSidebar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    triggerHaptic('success');

    const priceNum = formPrice.trim() ? parseFloat(formPrice) : undefined;
    let updated: ShoppingItem[];

    if (editingItem) {
      updated = items.map((it) =>
        it.id === editingItem.id
          ? {
              ...it,
              name: formName.trim(),
              quantity: formQty.trim() || '1',
              estimated_price: priceNum,
              priority: formPriority,
              note: formNote.trim() || undefined,
            }
          : it
      );
      setFeedback('Item updated!');
    } else {
      const newItem: ShoppingItem = {
        id: `shop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: formName.trim(),
        quantity: formQty.trim() || '1',
        estimated_price: priceNum,
        priority: formPriority,
        is_bought: false,
        note: formNote.trim() || undefined,
        created_at: new Date().toISOString(),
      };
      updated = [newItem, ...items];
      setFeedback('Added to shopping list!');
    }

    setItems(updated);
    saveStoredShoppingList(updated);
    setIsSidebarOpen(false);
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleToggleBought = async (id: string) => {
    triggerHaptic('light');
    const updated = items.map((it) => (it.id === id ? { ...it, is_bought: !it.is_bought } : it));

    // Check if ALL items in the shopping list are now checked/done!
    const allDone = updated.length > 0 && updated.every((it) => it.is_bought);
    if (allDone) {
      await completeShoppingAndClear(updated, []);
      return;
    }

    setItems(updated);
    saveStoredShoppingList(updated);
  };

  const handleShoppingDoneClick = async () => {
    const boughtItems = items.filter((it) => it.is_bought);
    if (boughtItems.length > 0) {
      const remaining = items.filter((it) => !it.is_bought);
      await completeShoppingAndClear(boughtItems, remaining);
    } else if (items.length > 0) {
      // User tapped "Shopping Done" to finish the entire list at once
      await completeShoppingAndClear(items, []);
    }
  };

  const handleDelete = (id: string) => {
    triggerHaptic('warning');
    const updated = items.filter((it) => it.id !== id);
    setItems(updated);
    saveStoredShoppingList(updated);
  };

  return (
    <div className="space-y-3.5 pb-20 lg:pb-8 animate-in fade-in duration-200">
      {feedback && (
        <div className="p-3 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white">
            Shopping List
          </h1>
          <p className="text-[11px] text-slate-400">
            Check all items or tap &quot;Shopping Done&quot; to auto-log as Expense &amp; clear list
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleShoppingDoneClick}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shadow-xs flex items-center gap-1 transition-all active:scale-95"
              title="Add shopping costs as Expense and clear list"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>
                Shopping Done (
                {symbol}
                {formatAmount(stats.boughtCount > 0 ? stats.boughtTotal : stats.grandTotal)})
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={openCreateSidebar}
            className="px-2.5 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-md text-xs font-bold shadow-xs flex items-center gap-1 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 mb-0.5">
            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-bold uppercase">To Buy ({stats.toBuyCount})</span>
          </div>
          <div className="text-sm font-black font-mono text-slate-900 dark:text-white truncate">
            {symbol}{formatAmount(stats.toBuyTotal)}
          </div>
        </div>

        <div className="p-2.5 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 mb-0.5">
            <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-bold uppercase">Checked ({stats.boughtCount})</span>
          </div>
          <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
            {symbol}{formatAmount(stats.boughtTotal)}
          </div>
        </div>

        <div className="p-2.5 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 mb-0.5">
            <Calculator className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-bold uppercase">Total Cost</span>
          </div>
          <div className="text-sm font-black font-mono text-slate-900 dark:text-white truncate">
            {symbol}{formatAmount(stats.grandTotal)}
          </div>
        </div>
      </div>

      {/* Quick Add Bar */}
      <form
        onSubmit={handleQuickAdd}
        className="p-2 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center gap-2"
      >
        <input
          type="text"
          placeholder="Quick add item (e.g. Milk, Rice)..."
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          className="flex-1 bg-slate-50 dark:bg-slate-900 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
        />
        <input
          type="number"
          step="any"
          placeholder={`Price (${symbol})`}
          value={quickPrice}
          onChange={(e) => setQuickPrice(e.target.value)}
          className="w-24 sm:w-28 bg-slate-50 dark:bg-slate-900 text-xs px-2.5 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 font-mono"
        />
        <button
          type="submit"
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shrink-0 transition-colors"
        >
          + Add
        </button>
      </form>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'all', label: `All (${items.length})` },
              { id: 'to_buy', label: `To Buy (${stats.toBuyCount})` },
              { id: 'bought', label: `Checked (${stats.boughtCount})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                filter === t.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2">
            <ShoppingBag className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Shopping list is empty
            </h3>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Add items above. When you finish shopping, their costs are automatically logged to Expenses and cleared!
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleToggleBought(item.id)}
              className={`p-3 bg-white dark:bg-slate-800/90 rounded-[10px] border shadow-xs transition-all flex items-center justify-between gap-3 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 ${
                item.is_bought
                  ? 'opacity-65 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10'
                  : 'border-slate-200/80 dark:border-slate-700/80'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleBought(item.id);
                  }}
                  className="text-slate-400 hover:text-emerald-500 transition-colors shrink-0"
                >
                  {item.is_bought ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3
                      className={`text-xs font-bold truncate ${
                        item.is_bought
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {item.name}
                    </h3>
                    {item.quantity && item.quantity !== '1' && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                        {item.quantity}
                      </span>
                    )}
                    {item.priority === 'high' && !item.is_bought && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                        Urgent
                      </span>
                    )}
                  </div>
                  {item.note && (
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.note}</p>
                  )}
                </div>
              </div>

              <div
                className="flex items-center gap-1.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {item.estimated_price && item.estimated_price > 0 && (
                  <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-200">
                    {symbol}{formatAmount(item.estimated_price)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openEditSidebar(item)}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title="Edit Item"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition-colors"
                  title="Delete Item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Shopping Item Right Sidebar */}
      {mounted && isSidebarOpen && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex justify-end">
            <div
              onClick={() => setIsSidebarOpen(false)}
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
                  <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
                      {editingItem ? 'Edit Shopping Item' : 'Add Shopping Item'}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      Auto-logs to Expense when shopping is done
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form
                onSubmit={handleSaveSidebar}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Item Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Basmati Rice, Olive Oil"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Quantity / Unit
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 2 kg, 1 pack"
                        value={formQty}
                        onChange={(e) => setFormQty(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Price ({symbol})
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 450"
                        value={formPrice}
                        onChange={(e) => setFormPrice(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Priority
                    </label>
                    <select
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value as 'high' | 'normal' | 'low')}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="normal">Normal</option>
                      <option value="high">Urgent / High</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Note (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Store or brand note"
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div
                  className="px-4 sm:px-5 pt-3.5 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 mt-auto"
                  style={{
                    paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 14px), 16px)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="flex-1 py-2.5 px-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-3 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {editingItem ? 'Save Changes' : 'Add to List'}
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
