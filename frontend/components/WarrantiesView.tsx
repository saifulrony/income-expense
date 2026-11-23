'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Pencil,
  BellRing,
  Search,
  X,
} from 'lucide-react';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { useTranslation } from '@/lib/i18n';
import { triggerHaptic } from '@/lib/haptics';
import { canAccessFeature, openUpgradeProModal, TIER_LIMITS } from '@/lib/billing';
import {
  recordInAppNotification,
  fireLockScreenOSNotification,
  requestNotificationPermission,
} from '@/lib/notifications';

export interface WarrantyItem {
  id: string;
  product_name: string;
  brand_or_store?: string;
  price?: number;
  purchase_date: string; // YYYY-MM-DD
  expiry_date: string;   // YYYY-MM-DD
  serial_or_invoice?: string;
  note?: string;
  created_at: string;
}

const STORAGE_KEY = 'cashflow_warranties_tracker';

function getStoredWarranties(): WarrantyItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const today = new Date();
      const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
        .toISOString()
        .slice(0, 10);
      const initial: WarrantyItem[] = [
        {
          id: 'war_sample_1',
          product_name: 'MacBook Air',
          brand_or_store: 'Apple',
          price: 1199,
          purchase_date: today.toISOString().slice(0, 10),
          expiry_date: nextYear,
          serial_or_invoice: 'C02XG123',
          note: 'AppleCare+ warranty',
          created_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return parsed.map((item: WarrantyItem) => {
      if (item.id === 'war_sample_1' && item.product_name === 'Washing Machine / Home Appliance') {
        return {
          ...item,
          product_name: 'MacBook Air',
          brand_or_store: 'Apple',
          note: 'AppleCare+ warranty',
        };
      }
      return item;
    });
  } catch {
    return [];
  }
}

function saveStoredWarranties(list: WarrantyItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save warranties', err);
  }
}

interface WarrantiesViewProps {
  currency?: string;
}

export default function WarrantiesView({ currency = 'BDT' }: WarrantiesViewProps) {
  const { t } = useTranslation();
  const symbol = getCurrencySymbol(currency);
  const [items, setItems] = useState<WarrantyItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarrantyItem | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form states
  const [formProduct, setFormProduct] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formPurchaseDate, setFormPurchaseDate] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formSerial, setFormSerial] = useState('');
  const [formNote, setFormNote] = useState('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Swipe-to-dismiss gesture state for Right Sidebar Drawer
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isModalOpen) {
      setDragX(0);
      setIsDragging(false);
      isHorizontalSwipeRef.current = null;
    }
  }, [isModalOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isModalOpen) return;
    const t = e.touches[0];
    if (!t) return;
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    startTimeRef.current = Date.now();
    isHorizontalSwipeRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isModalOpen) return;
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
      triggerHaptic('light');
      setIsModalOpen(false);
    }
  };

  useEffect(() => {
    setItems(getStoredWarranties());
  }, []);

  const todayMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const getDaysRemaining = (expiryDate: string) => {
    const exp = new Date(expiryDate + 'T00:00:00').getTime();
    return Math.ceil((exp - todayMs) / 86400000);
  };

  const getWarrantyProgress = (purchaseDate: string, expiryDate: string) => {
    const start = new Date(purchaseDate + 'T00:00:00').getTime();
    const end = new Date(expiryDate + 'T00:00:00').getTime();
    if (end <= start) return 100;
    const pct = Math.round(((todayMs - start) / (end - start)) * 100);
    return Math.max(0, Math.min(100, pct));
  };

  const stats = useMemo(() => {
    let activeCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let coveredValue = 0;

    items.forEach((item) => {
      const days = getDaysRemaining(item.expiry_date);
      if (days < 0) {
        expiredCount += 1;
      } else {
        activeCount += 1;
        coveredValue += item.price || 0;
        if (days <= 30) {
          expiringSoonCount += 1;
        }
      }
    });

    return { activeCount, expiringSoonCount, expiredCount, coveredValue };
  }, [items, todayMs]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        const days = getDaysRemaining(item.expiry_date);
        if (filter === 'active' && days < 0) return false;
        if (filter === 'expiring' && (days < 0 || days > 30)) return false;
        if (filter === 'expired' && days >= 0) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            item.product_name.toLowerCase().includes(q) ||
            (item.brand_or_store || '').toLowerCase().includes(q) ||
            (item.serial_or_invoice || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  }, [items, filter, searchQuery, todayMs]);

  const openCreateModal = () => {
    if (!canAccessFeature('maxWarranties') && items.length >= TIER_LIMITS.starter.maxWarranties) {
      openUpgradeProModal('unlimited_warranties');
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    const nextYear = new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate())
      .toISOString()
      .slice(0, 10);
    setEditingItem(null);
    setFormProduct('');
    setFormBrand('');
    setFormPrice('');
    setFormPurchaseDate(todayStr);
    setFormExpiryDate(nextYear);
    setFormSerial('');
    setFormNote('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: WarrantyItem) => {
    setEditingItem(item);
    setFormProduct(item.product_name);
    setFormBrand(item.brand_or_store || '');
    setFormPrice(item.price ? String(item.price) : '');
    setFormPurchaseDate(item.purchase_date);
    setFormExpiryDate(item.expiry_date);
    setFormSerial(item.serial_or_invoice || '');
    setFormNote(item.note || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProduct.trim() || !formExpiryDate) return;
    triggerHaptic('success');

    const priceNum = formPrice.trim() ? parseFloat(formPrice) : undefined;
    let updated: WarrantyItem[];

    if (editingItem) {
      updated = items.map((it) =>
        it.id === editingItem.id
          ? {
              ...it,
              product_name: formProduct.trim(),
              brand_or_store: formBrand.trim() || undefined,
              price: priceNum,
              purchase_date: formPurchaseDate || it.purchase_date,
              expiry_date: formExpiryDate,
              serial_or_invoice: formSerial.trim() || undefined,
              note: formNote.trim() || undefined,
            }
          : it
      );
      setFeedback('Updated');
    } else {
      const newItem: WarrantyItem = {
        id: `war_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        product_name: formProduct.trim(),
        brand_or_store: formBrand.trim() || undefined,
        price: priceNum,
        purchase_date: formPurchaseDate || new Date().toISOString().slice(0, 10),
        expiry_date: formExpiryDate,
        serial_or_invoice: formSerial.trim() || undefined,
        note: formNote.trim() || undefined,
        created_at: new Date().toISOString(),
      };
      updated = [newItem, ...items];
      setFeedback('Saved');
    }

    setItems(updated);
    saveStoredWarranties(updated);
    setIsModalOpen(false);
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleDelete = (id: string) => {
    triggerHaptic('warning');
    if (confirm('Delete this warranty?')) {
      const updated = items.filter((it) => it.id !== id);
      setItems(updated);
      saveStoredWarranties(updated);
    }
  };

  const handleSendWarrantyAlert = async (item: WarrantyItem) => {
    triggerHaptic('success');
    await requestNotificationPermission();
    const days = getDaysRemaining(item.expiry_date);
    const statusText =
      days < 0
        ? `Expired (${item.expiry_date})`
        : days === 0
        ? `Expires TODAY!`
        : `${days}d remaining (${item.expiry_date})`;

    const title = `Warranty: ${item.product_name}`;
    const body = `${statusText}${item.serial_or_invoice ? ` • #${item.serial_or_invoice}` : ''}`;

    recordInAppNotification({
      type: 'reminder',
      title,
      body,
    });

    await fireLockScreenOSNotification({
      title,
      body,
      tag: `warranty_${item.id}`,
    });

    setFeedback(`Alert set for ${item.product_name}`);
    setTimeout(() => setFeedback(null), 2500);
  };

  return (
    <div className="space-y-3.5 pb-20 lg:pb-8 animate-in fade-in duration-200 max-w-4xl mx-auto">
      {feedback && (
        <div className="py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Minimal Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {t('warranties')}
          </h1>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
            {items.length}
          </span>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('add') || 'Add'}</span>
        </button>
      </div>

      {/* Minimal Stats Strip */}
      <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800/80 text-center">
        <div className="py-1 px-1.5">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block truncate">
            {t('activeWarranty')}
          </span>
          <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
            {stats.activeCount}
          </span>
        </div>
        <div className="py-1 px-1.5 border-x border-slate-200/60 dark:border-slate-800/80">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block truncate">
            ≤ 30d
          </span>
          <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
            {stats.expiringSoonCount}
          </span>
        </div>
        <div className="py-1 px-1.5">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block truncate">
            {symbol} {t('covered') || 'Value'}
          </span>
          <span className="text-xs sm:text-sm font-bold font-mono text-slate-800 dark:text-slate-200 truncate block">
            {formatAmount(stats.coveredValue)}
          </span>
        </div>
      </div>

      {/* Minimal Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          {[
            { id: 'all', label: t('allShort') || 'All', count: items.length },
            { id: 'active', label: t('activeWarranty'), count: stats.activeCount },
            { id: 'expiring', label: '≤ 30d', count: stats.expiringSoonCount },
            { id: 'expired', label: t('expiredWarranty'), count: stats.expiredCount },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                filter === tab.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] opacity-70 font-mono">({tab.count})</span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 text-xs pl-8 pr-7 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Minimal Warranties List */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="py-10 text-center bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/70 dark:border-slate-800/70 shadow-2xs space-y-1.5">
            <ShieldCheck className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              No warranties
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const days = getDaysRemaining(item.expiry_date);
            const isExpired = days < 0;
            const isExpiringSoon = days >= 0 && days <= 30;
            const progress = getWarrantyProgress(item.purchase_date, item.expiry_date);

            return (
              <div
                key={item.id}
                className="p-3 bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200/70 dark:border-slate-800/70 shadow-2xs relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Title & Brand */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {item.product_name}
                      </span>
                      {item.brand_or_store && (
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {item.brand_or_store}
                        </span>
                      )}
                    </div>

                    {/* Metadata: Expiry, Serial, Price */}
                    <div className="flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{item.expiry_date}</span>
                      </span>
                      {item.serial_or_invoice && (
                        <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-slate-800/80 px-1.5 py-0.2 rounded">
                          #{item.serial_or_invoice}
                        </span>
                      )}
                      {item.price && item.price > 0 && (
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {symbol}{formatAmount(item.price)}
                        </span>
                      )}
                    </div>

                    {/* Compact Note (if any) */}
                    {item.note && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1">
                        {item.note}
                      </p>
                    )}
                  </div>

                  {/* Status Badge & Icon Actions */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {isExpired ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
                        Expired
                      </span>
                    ) : isExpiringSoon ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40">
                        {days}d left
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40">
                        {days}d left
                      </span>
                    )}

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleSendWarrantyAlert(item)}
                        className="p-1 rounded text-slate-400 hover:text-amber-500 transition-colors"
                        aria-label="Alert"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 transition-colors"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subtle progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full transition-all ${
                      isExpired ? 'bg-rose-500' : isExpiringSoon ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Minimal Create / Edit Drawer */}
      {mounted && isModalOpen && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex justify-end">
            <div
              onClick={() => setIsModalOpen(false)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              style={{
                opacity: isDragging ? Math.max(0.15, 1 - dragX / 280) : 1,
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
              aria-hidden="true"
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
              className="relative w-80 max-w-[85vw] sm:w-[380px] sm:max-w-[85vw] h-full h-[100dvh] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 overflow-hidden will-change-transform"
            >
              {/* Drag Handle */}
              <div
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-12 rounded-full bg-slate-300/80 dark:bg-slate-700/80 pointer-events-none z-20"
                aria-hidden="true"
              />

              {/* Drawer Header */}
              <div
                className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0"
                style={{
                  paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
                }}
              >
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingItem ? 'Edit Warranty' : 'New Warranty'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Product
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Product name"
                    value={formProduct}
                    onChange={(e) => setFormProduct(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Purchase Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formPurchaseDate}
                      onChange={(e) => setFormPurchaseDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formExpiryDate}
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Brand / Store
                    </label>
                    <input
                      type="text"
                      placeholder="Brand"
                      value={formBrand}
                      onChange={(e) => setFormBrand(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Price ({symbol})
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Amount"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Serial / Invoice
                  </label>
                  <input
                    type="text"
                    placeholder="Invoice or SN"
                    value={formSerial}
                    onChange={(e) => setFormSerial(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional notes"
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200 resize-none"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {t('cancel') || 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95"
                  >
                    {t('save') || 'Save'}
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
