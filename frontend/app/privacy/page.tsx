'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
          <span className="text-[11px] font-mono text-slate-400">Effective: Nov 2026</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Privacy Policy</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">CashFlow — Personal Income &amp; Expense Manager</p>
            </div>
          </div>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">1. Offline-First &amp; Local Data Storage</h2>
            <p>
              CashFlow is designed with privacy first. When using On-Device (Offline) mode, all of your financial entries,
              categories, notes, budgets, and wallets are stored exclusively on your own device. We do not collect, sell,
              or transmit your local financial records to third-party data brokers.
            </p>
          </section>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">2. Optional Cloud Sync &amp; Backups</h2>
            <p>
              If you explicitly choose to create an online sync account or connect your personal Google Drive for backups,
              your account email and encrypted financial data are transmitted securely over HTTPS solely to synchronize
              your records across your devices and restore backups upon your request.
            </p>
          </section>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">3. Permissions &amp; Device Access</h2>
            <p>
              CashFlow only requests minimal permissions strictly required for app functionality (such as Internet access
              for optional cloud sync or currency conversion). We do not access your contacts, SMS messages, call logs,
              or bank login credentials.
            </p>
          </section>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">4. Advertising &amp; Purchases</h2>
            <p>
              Free versions of the app may display optional, user-initiated rewarded ads or non-intrusive ads provided by
              Google AdMob, which may use anonymous advertising identifiers in accordance with Google&apos;s Privacy Policy.
              One-time in-app purchases are processed securely through Google Play Billing; we never see or store your
              payment card details.
            </p>
          </section>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">5. Data Deletion &amp; Your Rights</h2>
            <p>
              You own 100% of your data. You may export your full data as CSV/PDF/JSON or permanently delete your account
              and all stored records at any time from Settings or via our{' '}
              <Link href="/delete-account" className="text-emerald-600 dark:text-emerald-400 font-semibold underline">
                Account &amp; Data Deletion page
              </Link>.
            </p>
          </section>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">6. Children&apos;s Privacy</h2>
            <p>
              CashFlow is a general-audience personal finance utility and is not directed to children under the age of 13.
              We do not knowingly collect personal information from children.
            </p>
          </section>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 text-xs">
            <Link href="/terms" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
              Terms of Service
            </Link>
            <Link href="/delete-account" className="text-rose-600 dark:text-rose-400 font-semibold hover:underline">
              Delete Account &amp; Data
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
