'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function DeleteAccountPage() {
  const [wiped, setWiped] = useState(false);

  const handleWipeLocalData = () => {
    if (typeof window === 'undefined') return;
    if (
      !window.confirm(
        'Are you sure you want to permanently erase all local CashFlow transactions, accounts, budgets, and settings on this device? This cannot be undone.'
      )
    ) {
      return;
    }
    try {
      localStorage.clear();
      sessionStorage.clear();
      setWiped(true);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to CashFlow
          </Link>
          <span className="text-[11px] font-mono text-slate-400">Google Play Data Deletion Policy</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Account &amp; Data Deletion</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">CashFlow — Personal Income &amp; Expense Manager</p>
            </div>
          </div>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">How to Delete Your Cloud Account In-App</h2>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Open <strong>CashFlow</strong> and sign in to your account.</li>
              <li>Open the navigation menu and go to <strong>Settings → Account &amp; Security</strong>.</li>
              <li>Tap <strong>Delete Account Permanently</strong> and confirm.</li>
              <li>All associated user profile info, wallets, categories, budgets, and transactions are permanently purged immediately with zero retention period.</li>
            </ol>
          </section>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">How to Erase Local On-Device Data</h2>
            <p>
              If you use CashFlow in <strong>On-Device (Offline)</strong> mode, no data is stored on our servers. You can
              erase all local data instantly by uninstalling the app or clicking the button below:
            </p>
          </section>

          {wiped ? (
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              All local CashFlow data on this device has been permanently deleted.
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-3">
              <div className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>This permanently clears all local transactions, wallets, notes, and settings on this browser/device.</span>
              </div>
              <button
                type="button"
                onClick={handleWipeLocalData}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
              >
                Erase All Local Data Now
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 text-xs">
            <Link href="/privacy" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
