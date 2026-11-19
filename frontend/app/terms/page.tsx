'use client';

import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsOfServicePage() {
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
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Terms of Service</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">CashFlow — Personal Income &amp; Expense Manager</p>
            </div>
          </div>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">1. Acceptance of Terms</h2>
            <p>
              By downloading, installing, or using CashFlow, you agree to these Terms of Service and our Privacy Policy.
            </p>
          </section>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">2. Informational &amp; Record-Keeping Purpose Only</h2>
            <p>
              CashFlow is a personal budgeting, bookkeeping, and expense-tracking utility. It does not provide financial,
              tax, investment, or legal advice, and does not process bank transfers, loans, or monetary payments.
            </p>
          </section>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">3. User Responsibility for Backups</h2>
            <p>
              In On-Device (Offline) mode, data is stored locally on your device. You are responsible for regularly
              exporting backups (JSON/CSV or Google Drive) to prevent data loss if your device is lost, damaged, or reset.
            </p>
          </section>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">4. In-App Purchases &amp; Refunds</h2>
            <p>
              Optional Pro upgrades and one-time lifetime licenses purchased on Android are billed and managed through
              Google Play Billing under Google Play&apos;s standard refund policies.
            </p>
          </section>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 text-xs">
            <Link href="/privacy" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
              Privacy Policy
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
