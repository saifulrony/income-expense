'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  X,
  Crown,
  Check,
  RotateCcw,
  ShieldCheck,
  Loader2,
  CloudUpload,
  FileSpreadsheet,
  Palette,
  Ban,
  Wallet,
  Lock,
} from 'lucide-react';
import {
  BILLING_CONFIG,
  LivePlanPrices,
  fetchPlayStorePrices,
  purchaseLifetimePro,
  restorePurchases,
  useProStatus,
} from '@/lib/billing';

interface UpgradeProModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PlanTierId = 'monthly' | 'annual' | 'lifetime';

interface PlanTier {
  id: PlanTierId;
  title: string;
  price: string;
  period: string;
  subtext: string;
  badge?: string;
  discountTag?: string;
  originalPrice?: string;
  monthlyBreakdown?: string;
}

const PLAN_TIERS: PlanTier[] = [
  {
    id: 'monthly',
    title: 'Monthly',
    price: '$1.99',
    period: '/month',
    subtext: 'Billed monthly • 7-day free trial • Cancel anytime',
  },
  {
    id: 'annual',
    title: 'Yearly',
    price: '$9.99',
    period: '/year',
    subtext: '$0.83/mo • Billed annually • SAVE 58%',
    badge: 'BEST VALUE',
  },
  {
    id: 'lifetime',
    title: 'Lifetime',
    price: BILLING_CONFIG.lifetimePriceDisplay || '$29.99',
    period: 'one-time',
    subtext: 'Pay once • Own forever • VIP Elite',
    badge: 'ELITE VIP',
  },
];

const PRO_FEATURES = [
  {
    icon: Ban,
    title: '100% Ad-Free Experience',
    desc: 'Zero banners or interruptions across all screens',
  },
  {
    icon: CloudUpload,
    title: 'Google Drive Auto-Sync',
    desc: 'Encrypted cloud backup & multi-device restore',
  },
  {
    icon: FileSpreadsheet,
    title: 'PDF & Excel Statements',
    desc: 'Export bank-grade audit reports & tax summaries',
  },
  {
    icon: Wallet,
    title: 'Unlimited Sub-Accounts',
    desc: 'Manage Personal, Business, Family & Savings ledgers',
  },
  {
    icon: Palette,
    title: 'All Premium Themes',
    desc: 'Unlock OLED Dark, Emerald, Ocean & Amethyst palettes',
  },
];

export default function UpgradeProModal({ isOpen, onClose }: UpgradeProModalProps) {
  const proStatus = useProStatus();
  const [selectedTier, setSelectedTier] = useState<PlanTierId>('annual');
  const [busyAction, setBusyAction] = useState<'buy' | 'restore' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [livePrices, setLivePrices] = useState<LivePlanPrices>({
    monthly: BILLING_CONFIG.monthlyPriceDisplay,
    annual: BILLING_CONFIG.annualPriceDisplay,
    lifetime: BILLING_CONFIG.lifetimePriceDisplay,
  });

  useEffect(() => {
    if (isOpen) {
      fetchPlayStorePrices().then((prices) => setLivePrices(prices));
    }
  }, [isOpen]);

  const planTiers: PlanTier[] = useMemo(
    () => [
      {
        id: 'monthly',
        title: 'Monthly',
        price: livePrices.monthly,
        period: '/month',
        subtext: 'Billed monthly via Google Play • 7-day free trial • Cancel anytime',
        badge: '7-DAY TRIAL',
        monthlyBreakdown: 'Flexible',
      },
      {
        id: 'annual',
        title: 'Yearly',
        price: livePrices.annual,
        period: '/year',
        subtext: '$0.83/mo • Billed annually via Google Play • SAVE 58%',
        badge: 'BEST VALUE',
        discountTag: 'SAVE 58%',
        originalPrice: '$23.88',
        monthlyBreakdown: 'Just $0.83/mo',
      },
      {
        id: 'lifetime',
        title: 'Lifetime',
        price: livePrices.lifetime,
        period: 'one-time',
        subtext: 'One-time Google Play purchase • Own forever • VIP Elite',
        badge: 'ELITE VIP',
        discountTag: 'PAY ONCE',
        monthlyBreakdown: 'Keep Forever',
      },
    ],
    [livePrices]
  );

  if (!isOpen || typeof document === 'undefined') return null;

  const activeTier = planTiers.find((t) => t.id === selectedTier) || planTiers[2];

  const handlePurchase = async () => {
    setBusyAction('buy');
    setFeedback(null);
    try {
      const res = await Promise.race([
        purchaseLifetimePro(selectedTier),
        new Promise<{ success: boolean; message: string }>((resolve) =>
          setTimeout(() => {
            resolve({
              success: false,
              message:
                'Store did not respond in time. If testing on Android, the Test Store fallback has been enabled.',
            });
          }, 9000)
        ),
      ]);
      setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Purchase failed.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestore = async () => {
    setBusyAction('restore');
    setFeedback(null);
    try {
      const res = await Promise.race([
        restorePurchases(),
        new Promise<{ success: boolean; message: string }>((resolve) =>
          setTimeout(() => {
            resolve({
              success: false,
              message: 'Restore request timed out.',
            });
          }, 7000)
        ),
      ]);
      setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Restore failed.' });
    } finally {
      setBusyAction(null);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[20px] sm:rounded-[16px] border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom duration-200"
      >
        {/* Top Hero Header */}
        <div className="relative px-5 pt-5 pb-4 bg-slate-900 dark:bg-slate-950 text-white border-b border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Pro modal"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <Crown className="w-6 h-6 text-slate-950 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight text-white">
                  CashFlow Pro
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  PREMIUM
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Full financial control, cloud sync &amp; zero ads
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 overscroll-contain">
          {/* Active Pro Status Banner */}
          {proStatus.isPro && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>CashFlow Pro is active on your account</span>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-600 text-white">
                ACTIVE
              </span>
            </div>
          )}

          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Features List */}
          <div className="space-y-2.5">
            {PRO_FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {feat.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {feat.desc}
                    </p>
                  </div>
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-1" />
                </div>
              );
            })}
          </div>

          {/* Free vs Pro Transparent Feature Comparison Table */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                What You Get With CashFlow Pro
              </span>
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded font-mono">
                Free vs Pro
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase font-mono text-[9px]">
                    <th className="py-1 px-1.5">Feature</th>
                    <th className="py-1 px-1.5 text-center text-slate-400">Free Starter</th>
                    <th className="py-1 px-1.5 text-center text-emerald-600 dark:text-emerald-400 font-bold">CashFlow Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-[10.5px]">
                  <tr>
                    <td className="py-1.5 px-1.5 font-medium text-slate-700 dark:text-slate-300">Sub-Accounts &amp; Wallets</td>
                    <td className="py-1.5 px-1.5 text-center text-slate-400 font-mono">Max 2</td>
                    <td className="py-1.5 px-1.5 text-center text-emerald-600 dark:text-emerald-400 font-bold font-mono">✓ Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-1.5 font-medium text-slate-700 dark:text-slate-300">Warranties &amp; Receipts</td>
                    <td className="py-1.5 px-1.5 text-center text-slate-400 font-mono">Max 3</td>
                    <td className="py-1.5 px-1.5 text-center text-emerald-600 dark:text-emerald-400 font-bold font-mono">✓ Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-1.5 font-medium text-slate-700 dark:text-slate-300">PDF &amp; Excel Statement Export</td>
                    <td className="py-1.5 px-1.5 text-center text-slate-300 dark:text-slate-600 font-mono">✕</td>
                    <td className="py-1.5 px-1.5 text-center text-emerald-600 dark:text-emerald-400 font-bold">✓ Watermark-Free</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-1.5 font-medium text-slate-700 dark:text-slate-300">Menu Docks &amp; Color Themes</td>
                    <td className="py-1.5 px-1.5 text-center text-slate-400 font-mono">Default</td>
                    <td className="py-1.5 px-1.5 text-center text-emerald-600 dark:text-emerald-400 font-bold">✓ All 12 Styles &amp; Themes</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-1.5 font-medium text-slate-700 dark:text-slate-300">Ad Experience</td>
                    <td className="py-1.5 px-1.5 text-center text-slate-400">Light Promos</td>
                    <td className="py-1.5 px-1.5 text-center text-emerald-600 dark:text-emerald-400 font-bold">✓ 100% Ad-Free</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-1.5 font-medium text-slate-700 dark:text-slate-300">Cloud Sync &amp; Backup</td>
                    <td className="py-1.5 px-1.5 text-center text-slate-400 font-mono">Local Only</td>
                    <td className="py-1.5 px-1.5 text-center text-emerald-600 dark:text-emerald-400 font-bold">✓ Auto Drive &amp; Multi-Device</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Plan Selection Cards (High-Conversion Discount Highlight) */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Choose How To Unlock Pro:
            </span>
            <div className="grid grid-cols-3 gap-2">
              {planTiers.map((tier) => {
                const isSelected = selectedTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedTier(tier.id)}
                    className={`relative p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-500/25 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1 mb-1">
                      {tier.badge && (
                        <span
                          className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded w-fit ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {tier.badge}
                        </span>
                      )}
                      {tier.discountTag && (
                        <span className="text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded bg-amber-500 text-slate-950 font-mono">
                          {tier.discountTag}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        {tier.title}
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        {tier.originalPrice && (
                          <span className="text-[10px] text-slate-400 line-through font-mono">
                            {tier.originalPrice}
                          </span>
                        )}
                        <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                          {tier.price}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {tier.period}
                      </div>
                      {tier.monthlyBreakdown && (
                        <div className={`text-[9.5px] font-bold mt-0.5 ${tier.id === 'annual' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          {tier.monthlyBreakdown}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 pt-0.5">
              {activeTier.subtext}
            </p>
          </div>
        </div>

        {/* Sticky Bottom Google Play Action Footer */}
        <div
          className="px-5 pt-3.5 pb-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5 shrink-0"
          style={{
            paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 14px), 16px)',
          }}
        >
          {proStatus.plan !== 'lifetime_pro' ? (
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handlePurchase}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              {busyAction === 'buy' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span>
                Continue with {activeTier.title} — {activeTier.price}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs transition-all"
            >
              Done
            </button>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleRestore}
              className="hover:text-slate-700 dark:hover:text-slate-200 font-semibold flex items-center gap-1 transition-colors"
            >
              {busyAction === 'restore' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RotateCcw className="w-3 h-3" />
              )}
              <span>Restore Purchase</span>
            </button>

            <div className="flex items-center gap-2">
              <Link href="/privacy" onClick={onClose} className="hover:text-slate-600 dark:hover:text-slate-300">
                Privacy
              </Link>
              <span>•</span>
              <Link href="/terms" onClick={onClose} className="hover:text-slate-600 dark:hover:text-slate-300">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
