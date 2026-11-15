'use client';

import dynamic from 'next/dynamic';

const CashFlowApp = dynamic(() => import('@/components/CashFlowApp'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
      <span className="text-xs font-semibold text-slate-500">Loading CashFlow...</span>
    </div>
  ),
});

export default function HistoryPage() {
  return <CashFlowApp initialTab="history" />;
}
