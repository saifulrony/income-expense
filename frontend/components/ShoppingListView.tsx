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
  Sparkles,
  Bot,
  Loader2,
  Send,
  Mic,
  MicOff,
  ExternalLink,
} from 'lucide-react';
import { hasGeminiApiKey, parseShoppingListWithGemini } from '@/lib/receipt-scanner';
import { isVoiceRecognitionSupported } from '@/lib/voice-input';
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

  // AI Shopping List Assistant state
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const voiceRecognitionRef = useRef<any>(null);

  const handleAiGenerateShoppingList = async (customText?: string) => {
    const text = (customText || aiPrompt).trim();
    if (!text) return;
    if (!hasGeminiApiKey()) {
      setFeedback('Gemini API key is not configured. Please add it in Settings.');
      return;
    }
    setIsAiLoading(true);
    setAiError(null);
    triggerHaptic('light');

    try {
      const res = await parseShoppingListWithGemini({
        userPrompt: text,
        existingItems: items.map((it) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          estimated_price: it.estimated_price,
          priority: it.priority,
          is_bought: it.is_bought,
        })),
      });

      if (res.items && res.items.length > 0) {
        setItems(res.items);
        saveStoredShoppingList(res.items);
        setFeedback(res.replyMessage || `Updated shopping list with ${res.items.length} items!`);
        setAiPrompt('');
        triggerHaptic('success');
      }
    } catch (err: any) {
      setAiError(err?.message || 'Failed to update shopping items with AI.');
      triggerHaptic('warning');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleToggleVoiceShopping = () => {
    if (isListeningVoice) {
      if (voiceRecognitionRef.current) {
        try {
          voiceRecognitionRef.current.stop();
        } catch { }
      }
      setIsListeningVoice(false);
      return;
    }

    if (!isVoiceRecognitionSupported()) {
      setFeedback('Voice recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    voiceRecognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US';

    recognition.onstart = () => {
      setIsListeningVoice(true);
      setShowAiChat(true);
      setAiError(null);
      triggerHaptic('medium');
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (!transcript.trim()) return;

      setIsListeningVoice(false);
      triggerHaptic('success');
      setAiPrompt(transcript);

      // Pass directly to Gemini AI to add, remove, or edit shopping items
      await handleAiGenerateShoppingList(transcript);
    };

    recognition.onerror = (event: any) => {
      setIsListeningVoice(false);
      if (event.error === 'no-speech') return;
      if (event.error === 'not-allowed') {
        const isHttp = typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        if (isHttp) {
          setAiError(`Microphone access blocked: Mobile browsers require HTTPS for speech recognition. Open via HTTPS: https://${window.location.hostname}:18443`);
        } else {
          setAiError('Microphone permission not allowed. Please tap the lock (🔒) icon in your browser address bar and set Microphone to "Allow".');
        }
      } else {
        setAiError(`Voice error: ${event.error || 'Failed to capture voice'}`);
      }
    };

    recognition.onend = () => {
      setIsListeningVoice(false);
    };

    try {
      recognition.start();
    } catch {
      setIsListeningVoice(false);
      setAiError('Could not start microphone.');
    }
  };

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
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            Shopping List
          </h1>
          <span className="text-[10px] font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
            {items.length}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleShoppingDoneClick}
              className="px-2 sm:px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 sm:gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
              title="Add shopping costs as Expense and clear list"
            >
              <CheckCheck className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
              <span className="hidden sm:inline">Shopping Done</span>
              <span className="font-mono text-[11px] sm:text-xs">
                {symbol}{formatAmount(stats.boughtCount > 0 ? stats.boughtTotal : stats.grandTotal)}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={openCreateSidebar}
            className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
            title="Add new shopping item with category"
          >
            <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <div className="p-2 sm:p-2.5 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 mb-0.5 min-w-0">
            <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="text-[9px] sm:text-[10px] font-bold uppercase truncate">To Buy ({stats.toBuyCount})</span>
          </div>
          <div className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white truncate">
            {symbol}{formatAmount(stats.toBuyTotal)}
          </div>
        </div>

        <div className="p-2 sm:p-2.5 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 mb-0.5 min-w-0">
            <ShoppingCart className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="text-[9px] sm:text-[10px] font-bold uppercase truncate">Checked ({stats.boughtCount})</span>
          </div>
          <div className="text-xs sm:text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
            {symbol}{formatAmount(stats.boughtTotal)}
          </div>
        </div>

        <div className="p-2 sm:p-2.5 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 mb-0.5 min-w-0">
            <Calculator className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="text-[9px] sm:text-[10px] font-bold uppercase truncate">Total</span>
          </div>
          <div className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white truncate">
            {symbol}{formatAmount(stats.grandTotal)}
          </div>
        </div>
      </div>

      {/* Quick Add Bar */}
      <form
        onSubmit={handleQuickAdd}
        className="p-2 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2"
      >
        <input
          type="text"
          placeholder="Quick add item (e.g. Milk, Rice)..."
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          className="min-w-0 flex-1 bg-slate-50 dark:bg-slate-900 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
        />
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <input
            type="number"
            step="any"
            placeholder={`Price (${symbol})`}
            value={quickPrice}
            onChange={(e) => setQuickPrice(e.target.value)}
            className="min-w-0 flex-1 sm:w-28 sm:flex-none bg-slate-50 dark:bg-slate-900 text-xs px-2.5 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 font-mono"
          />
          <button
            type="submit"
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shrink-0 transition-colors cursor-pointer flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAiChat((prev) => !prev);
              triggerHaptic('light');
            }}
            title="AI Smart Shopping List Creator"
            className={`px-2.5 py-2 rounded-md text-xs font-bold shrink-0 transition-all flex items-center justify-center gap-1 border ${
              showAiChat
                ? 'bg-purple-600 text-white border-purple-500 shadow-xs ring-1 ring-purple-400'
                : 'text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 border-purple-200/80 dark:border-purple-800/60'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI List</span>
          </button>
          {/* Voice Microphone Button */}
          <button
            type="button"
            onClick={handleToggleVoiceShopping}
            title={isListeningVoice ? "Listening... Speak to add, remove, or edit items" : "Voice Input: Speak to add, remove, or edit items"}
            className={`p-2 rounded-md text-xs font-bold shrink-0 transition-all flex items-center justify-center border ${
              isListeningVoice
                ? 'bg-rose-500 text-white animate-pulse border-rose-600 ring-2 ring-rose-400'
                : 'text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-800/60'
            }`}
          >
            {isListeningVoice ? (
              <MicOff className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </form>

      {/* AI Shopping List Assistant Chatbox */}
      {showAiChat && (
        <div className="p-3 bg-gradient-to-b from-purple-50/80 via-white to-indigo-50/50 dark:from-purple-950/30 dark:via-slate-900 dark:to-indigo-950/20 border border-purple-200/80 dark:border-purple-800/60 rounded-xl space-y-2.5 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Gemini AI Shopping Creator</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                    Active
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Type or tap microphone to add, remove, or edit items
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAiChat(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick chips */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
            <button
              type="button"
              onClick={() => handleAiGenerateShoppingList('Weekly groceries: 5kg rice, 2L soybean oil, 1 dozen eggs, potatoes, onion, dish soap')}
              className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 whitespace-nowrap shrink-0 transition-colors"
            >
              ⚡ Weekly Groceries (Rice, Oil, Eggs, Onion)
            </button>
            <button
              type="button"
              onClick={() => handleAiGenerateShoppingList('Fresh fruits & veggies: 1kg apples, 1 dozen bananas, carrots, tomatoes')}
              className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 whitespace-nowrap shrink-0 transition-colors"
            >
              ⚡ Fruits & Veggies
            </button>
          </div>

          {aiError && (
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div>{aiError}</div>
                {aiError.includes('HTTPS') && (
                  <a
                    href={typeof window !== 'undefined' ? `https://${window.location.hostname}:18443/shopping` : '#'}
                    className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <span>Open via Secure HTTPS</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <button type="button" onClick={() => setAiError(null)} className="text-rose-400 hover:text-rose-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Voice Listening Banner */}
          {isListeningVoice && (
            <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-rose-500 animate-bounce shrink-0" />
                <span className="font-semibold">Listening... Speak command to add, remove, or edit items</span>
              </div>
              <button
                type="button"
                onClick={handleToggleVoiceShopping}
                className="text-[11px] font-bold text-rose-700 dark:text-rose-300 underline"
              >
                Stop
              </button>
            </div>
          )}

          {/* Prompt Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAiGenerateShoppingList();
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={isAiLoading}
              placeholder="e.g. 'Need 2kg potatoes, 1 dozen eggs', 'Remove milk'..."
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-purple-500"
            />
            {/* Voice Mic inside form */}
            <button
              type="button"
              onClick={handleToggleVoiceShopping}
              disabled={isAiLoading}
              title={isListeningVoice ? "Listening... tap to stop" : "Speak command to add, remove, or edit items"}
              className={`p-1.5 px-2 rounded-lg border transition-all shrink-0 active:scale-95 flex items-center gap-1 ${
                isListeningVoice
                  ? 'bg-rose-500 text-white animate-pulse border-rose-600 ring-2 ring-rose-400'
                  : 'text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 border-purple-200 dark:border-purple-800'
              }`}
            >
              {isListeningVoice ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">Listening</span>
                </>
              ) : (
                <Mic className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="submit"
              disabled={isAiLoading || !aiPrompt.trim()}
              className="py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 shrink-0 shadow-xs active:scale-95 transition-all"
            >
              {isAiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Send</span>
            </button>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 pb-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
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
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all shrink-0 cursor-pointer ${
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
              className={`p-2.5 sm:p-3 bg-white dark:bg-slate-800/90 rounded-[10px] border shadow-xs transition-all flex items-center justify-between gap-2 sm:gap-3 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 min-w-0 overflow-hidden ${
                item.is_bought
                  ? 'opacity-65 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10'
                  : 'border-slate-200/80 dark:border-slate-700/80'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
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
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <h3
                      className={`text-xs font-bold truncate max-w-full ${
                        item.is_bought
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {item.name}
                    </h3>
                    {item.quantity && item.quantity !== '1' && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 shrink-0">
                        {item.quantity}
                      </span>
                    )}
                    {item.priority === 'high' && !item.is_bought && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 shrink-0">
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
                className="flex items-center gap-1 sm:gap-1.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {item.estimated_price && item.estimated_price > 0 && (
                  <span className="text-[11px] sm:text-xs font-bold font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    {symbol}{formatAmount(item.estimated_price)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openEditSidebar(item)}
                  className="p-1 sm:p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title="Edit Item"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="p-1 sm:p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition-colors"
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
