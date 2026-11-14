'use client';

import React, { useState, useEffect } from 'react';
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
  ChevronRight,
  ChevronDown,
  Plus,
  Palette,
  CloudUpload,
  User as UserIcon,
  Sliders,
  LayoutGrid
} from 'lucide-react';
import { User, SubAccount } from '@/lib/types';
import { getCurrencySymbol } from '@/lib/currency';

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
  onOpenAccountManager?: () => void;
}

interface SettingsSubPageItem {
  id: string;
  label: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const SETTINGS_PAGES: SettingsSubPageItem[] = [
  {
    id: 'theme',
    label: 'Theme & Appearance',
    badge: 'Light / Dark / $',
    icon: Palette,
    color: 'text-amber-500 dark:text-amber-400',
  },
  {
    id: 'backup',
    label: 'Cloud & Drive Backup',
    badge: 'Google Drive / JSON',
    icon: CloudUpload,
    color: 'text-sky-500 dark:text-sky-400',
  },
  {
    id: 'security',
    label: 'Security & PIN Lock',
    badge: '4-Digit Passcode',
    icon: ShieldCheck,
    color: 'text-emerald-500 dark:text-emerald-400',
  },
  {
    id: 'account',
    label: 'Account & Server Info',
    badge: 'Profile & LAN Endpoint',
    icon: UserIcon,
    color: 'text-indigo-500 dark:text-indigo-400',
  },
  {
    id: 'ledgers',
    label: 'Ledgers & Categories',
    badge: 'Budgets & Schedules',
    icon: Sliders,
    color: 'text-purple-500 dark:text-purple-400',
  },
];

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
  onOpenAccountManager,
}: SidebarDrawerProps) {
  // Hash state tracking for active settings subpage
  const [activeHash, setActiveHash] = useState<string>('');
  // Expand Settings sub-menu: default to true if currently in settings
  const [isSettingsExpanded, setIsSettingsExpanded] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const readHash = () => {
        const h = window.location.hash.replace('#', '');
        setActiveHash(h);
      };
      readHash();
      window.addEventListener('hashchange', readHash);
      return () => window.removeEventListener('hashchange', readHash);
    }
  }, [isOpen, currentTab]);

  useEffect(() => {
    if (currentTab === 'settings') {
      setIsSettingsExpanded(true);
    }
  }, [currentTab]);

  if (!isOpen) return null;

  const isOffline = typeof window !== 'undefined' && localStorage.getItem('app_mode') === 'offline';

  const navItems = [
    { id: 'dashboard', label: 'Home Dashboard', icon: Home, path: '/' },
    { id: 'history', label: 'Cash Book / History', icon: ListFilter, path: '/history' },
    { id: 'analytics', label: 'Analytics & Calendar', icon: PieChart, path: '/analytics' },
  ];

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    onClose();
  };

  const handleSettingsSubPageClick = (subId: string) => {
    if (subId === 'main') {
      onSelectTab('settings');
    } else {
      onSelectTab(`settings#${subId}`);
    }
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
      <div className="relative w-80 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
        
        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Header Bar */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs shadow-emerald-500/20">
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
              className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Navigation Links */}
          <div className="p-3 space-y-1 mt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-1">
              Menu Navigation
            </span>

            {/* Dashboard, History, Analytics */}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
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

            {/* Settings Accordion Header */}
            <div className="pt-1">
              <div 
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
                  currentTab === 'settings'
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <button
                  onClick={() => handleSettingsSubPageClick('main')}
                  className="flex items-center gap-2.5 flex-1 text-left"
                >
                  <Settings className={`w-4 h-4 ${currentTab === 'settings' ? 'text-emerald-600 stroke-[2.5]' : 'text-slate-400'}`} />
                  <span>Settings & Preferences</span>
                </button>

                <button
                  onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                  className="p-1 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Toggle settings sub-menu"
                >
                  {isSettingsExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Nested Settings Pages */}
              {isSettingsExpanded && (
                <div className="ml-3 pl-3 border-l-2 border-slate-200 dark:border-slate-800 space-y-1 mt-1.5 mb-1 animate-in fade-in duration-150">
                  {/* Settings Main Hub / Overview */}
                  <button
                    onClick={() => handleSettingsSubPageClick('main')}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                      currentTab === 'settings' && (!activeHash || activeHash === 'main')
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
                      <span>Settings Hub (All)</span>
                    </div>
                    {currentTab === 'settings' && (!activeHash || activeHash === 'main') && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </button>

                  {/* Individual Sub-pages */}
                  {SETTINGS_PAGES.map((page) => {
                    const PageIcon = page.icon;
                    const isPageActive = currentTab === 'settings' && activeHash === page.id;

                    return (
                      <button
                        key={page.id}
                        onClick={() => handleSettingsSubPageClick(page.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                          isPageActive
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <PageIcon className={`w-3.5 h-3.5 shrink-0 ${page.color}`} />
                          <span className="truncate">{page.label}</span>
                        </div>
                        {isPageActive ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        ) : (
                          <span className="text-[9px] px-1 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 shrink-0">
                            {page.id}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sub-Accounts Section */}
          {accounts.length > 0 && (
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between px-3 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Accounts / Ledgers
                </span>
                {onOpenAccountManager && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAccountManager();
                    }}
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5"
                    title="Manage all accounts"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>Manage</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => {
                  onSelectAccount('all');
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-all ${
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
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-all ${
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
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2 shrink-0 bg-white dark:bg-slate-900">
          {onLogout && (
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition-colors"
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
