'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Pencil,
  BellRing,
  Search,
  Hash,
  Store,
  X,
} from 'lucide-react';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { triggerHaptic } from '@/lib/haptics';
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
          product_name: 'Washing Machine / Home Appliance',
          brand_or_store: 'Official Brand Store',
          price: 35000,
          purchase_date: today.toISOString().slice(0, 10),
          expiry_date: nextYear,
          serial_or_invoice: 'INV-2026-8821',
          note: '2-year compressor & parts warranty card stored in drawer',
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
      setFeedback('Warranty updated!');
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
      setFeedback('Warranty added to tracker!');
    }

    setItems(updated);
    saveStoredWarranties(updated);
    setIsModalOpen(false);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDelete = (id: string) => {
    triggerHaptic('warning');
    if (confirm('Delete this warranty record?')) {
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
        ? `Expired ${Math.abs(days)} days ago (${item.expiry_date})`
        : days === 0
        ? `Expires TODAY (${item.expiry_date})!`
        : `${days} days remaining (Expires ${item.expiry_date})`;

    const title = `🛡️ Warranty Alert: ${item.product_name}`;
    const body = `${statusText}${item.serial_or_invoice ? ` • Invoice/SN: ${item.serial_or_invoice}` : ''}`;

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

    setFeedback(`Warranty alert for "${item.product_name}" sent to Notification Icon & Lock Screen!`);
    setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-8 animate-in fade-in duration-200">
      {feedback && (
        <div className="p-3 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Warranty Tracker</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track electronics, appliances, invoices &amp; warranty expiration dates
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Warranty</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Active</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            {stats.activeCount}
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Expiring ≤30d</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            {stats.expiringSoonCount}
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 mb-1">
            <Store className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Covered Value</span>
          </div>
          <div className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white truncate">
            {symbol}{formatAmount(stats.coveredValue)}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              { id: 'all', label: `All (${items.length})` },
              { id: 'active', label: `Active (${stats.activeCount})` },
              { id: 'expiring', label: `Expiring (${stats.expiringSoonCount})` },
              { id: 'expired', label: `Expired (${stats.expiredCount})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all shrink-0 ${
                filter === t.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search product, brand, serial..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 text-xs pl-8 pr-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Warranties List */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2">
            <ShieldCheck className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              No warranty items found
            </h3>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Add your gadgets, appliances, and invoices to track their warranty expiration dates.
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
                className={`p-3.5 bg-white dark:bg-slate-800/90 rounded-[10px] border shadow-xs transition-all space-y-2.5 ${
                  isExpired
                    ? 'opacity-70 border-slate-200 dark:border-slate-800'
                    : isExpiringSoon
                    ? 'border-amber-300 dark:border-amber-900/60'
                    : 'border-slate-200/80 dark:border-slate-700/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.product_name}
                      </h3>
                      {isExpired ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1">
                          <XCircle className="w-2.5 h-2.5" />
                          <span>Expired ({Math.abs(days)}d ago)</span>
                        </span>
                      ) : isExpiringSoon ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          Expiring in {days}d
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {days} days left
                        </span>
                      )}
                      {item.brand_or_store && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                          {item.brand_or_store}
                        </span>
                      )}
                    </div>

                    {item.note && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {item.note}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Bought: {item.purchase_date}</span>
                        <span>→</span>
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          Exp: {item.expiry_date}
                        </span>
                      </span>
                      {item.serial_or_invoice && (
                        <span className="flex items-center gap-1 font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          <Hash className="w-2.5 h-2.5" />
                          <span>{item.serial_or_invoice}</span>
                        </span>
                      )}
                      {item.price && item.price > 0 && (
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                          {symbol}{formatAmount(item.price)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSendWarrantyAlert(item)}
                      className="p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                      title="Send Warranty Alert to Notification Icon & Lock Screen"
                    >
                      <BellRing className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      title="Edit Warranty"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Delete Warranty"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Lifespan Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isExpired
                        ? 'bg-rose-500'
                        : isExpiringSoon
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          <div
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity animate-in fade-in"
          />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[12px] border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {editingItem ? 'Edit Warranty' : 'Add Product Warranty'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Product / Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook Pro, Samsung Fridge, iPhone 16"
                  value={formProduct}
                  onChange={(e) => setFormProduct(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Purchase Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formPurchaseDate}
                    onChange={(e) => setFormPurchaseDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Warranty Expiry <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Brand / Store
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apple Store, Walton"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Product Price ({symbol})
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 35000"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Serial Number / Invoice ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. SN-9948120 / INV-2026-102"
                  value={formSerial}
                  onChange={(e) => setFormSerial(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Warranty Terms / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2 years parts & service, receipt in folder"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-md text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95"
                >
                  {editingItem ? 'Update Warranty' : 'Save Warranty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
