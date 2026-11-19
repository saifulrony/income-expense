'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  X,
  Crown,
  Check,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  BILLING_CONFIG,
  purchaseLifetimePro,
  restorePurchases,
  unlockViaRewardedAd,
  useProStatus,
} from '@/lib/billing';

interface UpgradeProModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRO_BENEFITS = [
  'Remove all ads permanently across the entire app',
  'Unlock all 6 curated color themes (Volt, Forest, Ocean, Amethyst)',
  'Unlimited wallets & accounts (Cash, Bank, bKash, Nagad, Cards)',
  'Clean PDF Financial Statements & CSV exports',
  'Automatic Google Drive backup & multi-device restore',
];

export default function UpgradeProModal({ isOpen, onClose }: UpgradeProModalProps) {
  const proStatus = useProStatus();
  const [busyAction, setBusyAction] = useState<'buy' | 'reward' | 'restore' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleBuyLifetime = async () => {
    setBusyAction('buy');
    setFeedback(null);
    const res = await purchaseLifetimePro();
    setBusyAction(null);
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
  };

  const handleRewardedUnlock = async () => {
    setBusyAction('reward');
    setFeedback(null);
    const res = await unlockViaRewardedAd();
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

  const daysRemaining =
    proStatus.plan === 'rewarded_pass' && proStatus.expiresAt
      ? Math.max(1, Math.ceil((proStatus.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;

  return createPortal(
    <div
      onClick={onClose}
      className="modal-backdrop-fade fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[16px] sm:rounded-[16px] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom"
      >
        {/* Header Banner */}
        <div className="relative p-5 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 text-white">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Pro modal"
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-white/15 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 text-amber-300" />
                No Monthly Subscription
              </div>
              <h2 className="text-lg font-black tracking-tight mt-0.5">CashFlow Lifetime Pro</h2>
            </div>
          </div>
          <p className="text-xs text-emerald-50/90 mt-2 leading-relaxed">
            Pay once, own forever — or unlock free for 7 days by watching one optional short video.
          </p>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Active Entitlement Banner */}
          {proStatus.isPro && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                {proStatus.plan === 'lifetime_pro'
                  ? 'Lifetime Pro is active on this device!'
                  : `7-Day Rewarded Pro Pass active (${daysRemaining}d remaining)`}
              </span>
            </div>
          )}

          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`p-3 rounded-lg border text-xs font-semibold ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Benefits List */}
          <ul className="space-y-2.5">
            {PRO_BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200">
                <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            {proStatus.plan !== 'lifetime_pro' && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleBuyLifetime}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
              >
                {busyAction === 'buy' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Crown className="w-4 h-4 text-amber-300" />
                )}
                <span>Unlock Lifetime Pro — {BILLING_CONFIG.lifetimePriceDisplay} (One-Time)</span>
              </button>
            )}

            {!proStatus.isPro && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleRewardedUnlock}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 font-bold text-xs transition-all flex items-center justify-center gap-2"
              >
                {busyAction === 'reward' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PlayCircle className="w-4 h-4" />
                )}
                <span>No Card? Watch 1 Short Video → Free {BILLING_CONFIG.rewardPassDays}-Day Pro Pass</span>
              </button>
            )}

            {/* Mandatory Play Store Restore Purchases Button */}
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleRestore}
              className="w-full py-2 px-3 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              {busyAction === 'restore' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>Restore Previous Purchase</span>
            </button>
          </div>

          {/* Compliance Footer */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center text-[10px] text-slate-400 space-y-1">
            <p>One-time purchase processed securely via Google Play Billing. Never auto-renews.</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/privacy" onClick={onClose} className="hover:text-emerald-500 underline">
                Privacy Policy
              </Link>
              <span>•</span>
              <Link href="/terms" onClick={onClose} className="hover:text-emerald-500 underline">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
