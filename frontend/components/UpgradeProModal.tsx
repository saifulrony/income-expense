'use client';

import React, { useState } from 'react';
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
}

const PLAN_TIERS: PlanTier[] = [
  {
    id: 'monthly',
    title: 'Monthly',
    price: '$0.99',
    period: '/month',
    subtext: 'Billed monthly • Cancel anytime',
  },
  {
    id: 'annual',
    title: 'Yearly',
    price: '$2.99',
    period: '/year',
    subtext: '$0.25/mo • Billed annually',
    badge: 'SAVE 75%',
  },
  {
    id: 'lifetime',
    title: 'Lifetime',
    price: BILLING_CONFIG.lifetimePriceDisplay || '$4.99',
    period: 'one-time',
    subtext: 'Pay once • Own forever',
    badge: 'BEST VALUE',
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
  const [selectedTier, setSelectedTier] = useState<PlanTierId>('lifetime');
  const [busyAction, setBusyAction] = useState<'buy' | 'restore' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen || typeof document === 'undefined') return null;

  const activeTier = PLAN_TIERS.find((t) => t.id === selectedTier) || PLAN_TIERS[2];

  const handlePurchase = async () => {
    setBusyAction('buy');
    setFeedback(null);
    const res = await purchaseLifetimePro(selectedTier);
    setBusyAction(null);
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
  };

  const handleRestore = async () => {
    setBusyAction('restore');
    setFeedback(null);
    const res = await restorePurchases();
    setBusyAction(null);
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
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

          {/* Plan Selection Cards (Standard Google Play Style) */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Choose Your Plan
            </span>
            <div className="grid grid-cols-3 gap-2">
              {PLAN_TIERS.map((tier) => {
                const isSelected = selectedTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedTier(tier.id)}
                    className={`relative p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {tier.badge && (
                      <span
                        className={`inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mb-1.5 w-fit ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {tier.badge}
                      </span>
                    )}
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {tier.title}
                      </div>
                      <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 font-mono">
                        {tier.price}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {tier.period}
                      </div>
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
