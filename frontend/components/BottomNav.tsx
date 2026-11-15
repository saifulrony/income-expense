'use client';

import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface BottomNavProps {
  onOpenAddModal: (type: 'income' | 'expense') => void;
  summary?: {
    income: number;
    expense: number;
    balance: number;
  };
  currency?: string;
  // Optional for backward compatibility if passed
  currentTab?: string;
  onSelectTab?: (tab: string) => void;
}

const BottomNav = React.memo(function BottomNav({ 
  onOpenAddModal,
}: BottomNavProps) {
  return (
    <div 
      className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-4 py-2.5 gpu-layer"
      style={{
        paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 8px), calc(var(--safe-area-inset-bottom, 0px) + 8px), 10px)'
      }}
    >
      {/* Dual Action Buttons Dock (Cash In & Cash Out) */}
      <div className="max-w-md mx-auto">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Cash In Button (Green) */}
          <button
            type="button"
            onClick={() => onOpenAddModal('income')}
            className="cash-in-btn flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-sm transition-colors focus:outline-none"
            aria-label="Add Cash In"
          >
            <ArrowDownLeft className="w-4 h-4 stroke-[3]" />
            <span>Cash In</span>
          </button>

          {/* Cash Out Button (Rose/Red) */}
          <button
            type="button"
            onClick={() => onOpenAddModal('expense')}
            className="cash-out-btn flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-sm shadow-sm transition-colors focus:outline-none"
            aria-label="Add Cash Out"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[3]" />
            <span>Cash Out</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default BottomNav;
