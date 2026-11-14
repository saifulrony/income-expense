'use client';

import React from 'react';
import { Home, ListFilter, PieChart, Settings, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAddModal: (type: 'income' | 'expense') => void;
}

export default function BottomNav({ currentTab, onSelectTab, onOpenAddModal }: BottomNavProps) {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'history', label: 'History', icon: ListFilter },
    { id: 'analytics', label: 'Analytics', icon: PieChart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom,0px)] pointer-events-none">
      {/* 1. Dual Action Buttons Dock (Floating above the bottom bar) */}
      <div className="max-w-md mx-auto px-4 pb-2.5 pointer-events-auto">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Cash In Button (Green) */}
          <button
            type="button"
            onClick={() => onOpenAddModal('income')}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-600/35 transition-all focus:outline-none"
            aria-label="Add Cash In"
          >
            <ArrowDownLeft className="w-4 h-4 stroke-[3]" />
            <span>Cash In</span>
          </button>

          {/* Cash Out Button (Rose/Red) */}
          <button
            type="button"
            onClick={() => onOpenAddModal('expense')}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-rose-600/35 transition-all focus:outline-none"
            aria-label="Add Cash Out"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[3]" />
            <span>Cash Out</span>
          </button>
        </div>
      </div>

      {/* 2. 4-Tab Bottom Navigation Bar */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pointer-events-auto">
        <div className="max-w-md mx-auto flex items-center justify-around h-14 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                <span className={`text-[11px] ${isActive ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
