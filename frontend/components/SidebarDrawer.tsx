'use client';

import React from 'react';
import { 
  Home, 
  ListFilter, 
  PieChart, 
  Settings, 
  X, 
  Wallet, 
  LogOut, 
  CheckCircle2, 
  ShieldCheck, 
  Users, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { User, SubAccount } from '@/lib/types';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  user: User | null;
  accounts: SubAccount[];
  activeAccountId: string;
  onSelectAccount: (id: string) => void;
  onLogout?: () => void;
}

export default function SidebarDrawer({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
  user,
  accounts,
  activeAccountId,
  onSelectAccount,
  onLogout,
}: SidebarDrawerProps) {
  if (!isOpen) return null;

  const isOffline = typeof window !== 'undefined' && localStorage.getItem('app_mode') === 'offline';

  const navItems = [
    { id: 'dashboard', label: 'Home Dashboard', icon: Home, path: '/' },
    { id: 'history', label: 'Cash Book / History', icon: ListFilter, path: '/history' },
    { id: 'analytics', label: 'Analytics & Calendar', icon: PieChart, path: '/analytics' },
    { id: 'settings', label: 'Settings & Backups', icon: Settings, path: '/settings' },
  ];

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Sidebar Panel */}
      <div className="relative w-72 max-w-[82vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
        {/* Top Header & User Card */}
        <div>
          {/* Header Bar */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <Wallet className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block leading-tight">
                  CashFlow
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Personal Finance v2.0
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User Profile Info Card */}
          {user && (
            <div className="p-4 mx-3 mt-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user.full_name || 'Active User'}
                </span>
                {isOffline ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Offline
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Cloud
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                {user.email}
              </p>
              <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Default Currency</span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {user.currency}
                </span>
              </div>
            </div>
          )}

          {/* Primary Navigation Links */}
          <div className="p-3 space-y-1 mt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-1">
              Menu Navigation
            </span>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 stroke-[2.5]' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub-Accounts Section */}
          {accounts.length > 0 && (
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-1">
                Accounts / Ledgers
              </span>
              <button
                onClick={() => {
                  onSelectAccount('all');
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                  activeAccountId === 'all'
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span>All Accounts</span>
                </div>
                {activeAccountId === 'all' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />}
              </button>

              {accounts.map((acc) => {
                const isSelected = activeAccountId === acc.id;
                return (
                  <button
                    key={acc.id}
                    onClick={() => {
                      onSelectAccount(acc.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: acc.color }}
                      />
                      <span className="truncate">{acc.name}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Actions: Logout / Mode */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {onLogout && (
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          )}

          <div className="text-center text-[10px] text-slate-400 font-mono pt-1">
            CashFlow • 100% Offline Capable
          </div>
        </div>
      </div>
    </div>
  );
}
