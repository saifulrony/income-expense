'use client';

import React, { useState } from 'react';
import { User, SubAccount } from '@/lib/types';
import { 
  Wallet, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight,
  Menu, 
  User as UserIcon, 
  LogOut, 
  ShieldCheck, 
  Palette, 
  CloudUpload,
  Sliders
} from 'lucide-react';
import { getCurrencySymbol } from '@/lib/currency';
import AccountManagerModal from './AccountManagerModal';

interface HeaderProps {
  user: User | null;
  accounts: SubAccount[];
  activeAccountId: string;
  onOpenAccountSwitcher?: () => void;
  onSelectAccount?: (accountId: string) => void;
  currency?: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  onToggleSidebar: () => void;
  onLogout?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

const Header = React.memo(function Header({
  user,
  accounts,
  activeAccountId,
  onOpenAccountSwitcher,
  onSelectAccount,
  currency,
  onRefresh,
  isRefreshing,
  onToggleSidebar,
  onLogout,
  onNavigateToTab,
}: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

  // Close menus on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsAccountDropdownOpen(false);
      }
    };
    if (isUserMenuOpen || isAccountDropdownOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isUserMenuOpen, isAccountDropdownOpen]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const accountDisplayName =
    activeAccountId === 'all' ? 'All Accounts' : activeAccount?.name || 'Personal';
  const isOffline = typeof window !== 'undefined' && localStorage.getItem('app_mode') === 'offline';

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const handleNavigate = (target: string) => {
    setIsUserMenuOpen(false);
    if (onNavigateToTab) {
      onNavigateToTab(target);
    }
  };

  return (
    <header 
      className="sticky top-0 z-30 bg-slate-50 dark:bg-slate-950 px-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80"
      style={{
        paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), calc(var(--safe-area-inset-top, 0px) + 16px), 24px)'
      }}
    >
      <div className="max-w-md mx-auto flex items-center justify-between gap-2.5">
        {/* Left Side: Burger Menu + Logo + Title */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="w-8 h-8 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 active:scale-95 shadow-xs"
            aria-label="Open navigation menu"
            title="Menu"
          >
            <Menu className="w-4.5 h-4.5 stroke-[2.2]" />
          </button>

          <div className="w-8 h-8 rounded-md bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs shadow-emerald-500/20 shrink-0">
            <Wallet className="w-4.5 h-4.5 stroke-[2.2]" />
          </div>
        </div>

        {/* Right Side: Account Switcher + Refresh + User Profile Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Active Account Switcher Pill & Anchored Dropdown */}
          {user && accounts.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsAccountDropdownOpen((prev) => !prev);
                  setIsUserMenuOpen(false);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-md text-xs font-semibold shadow-xs active:scale-95 transition-all text-slate-800 dark:text-slate-100 ${
                  isAccountDropdownOpen
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                }`}
                title="Switch sub-account"
                aria-expanded={isAccountDropdownOpen}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      activeAccountId === 'all' ? '#6366F1' : activeAccount?.color || '#10B981',
                  }}
                />
                <span className="max-w-[70px] sm:max-w-[100px] truncate text-xs">
                  {accountDisplayName}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isAccountDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AccountManagerModal
                isOpen={isAccountDropdownOpen}
                mode="dropdown"
                onClose={() => setIsAccountDropdownOpen(false)}
                accounts={accounts}
                activeAccountId={activeAccountId}
                onSelectAccount={(accId) => {
                  if (onSelectAccount) {
                    onSelectAccount(accId);
                  }
                  setIsAccountDropdownOpen(false);
                }}
                onRefresh={onRefresh}
                currency={currency || user?.currency || 'BDT'}
              />
            </div>
          )}

          {/* Refresh Data Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-8 h-8 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-xs active:scale-95 transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* User Profile Menu Button & Dropdown */}
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen((prev) => !prev);
                  setIsAccountDropdownOpen(false);
                }}
                className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-xs shadow-xs active:scale-95 transition-all hover:border-emerald-500 focus:outline-none"
                aria-label="User profile menu"
                title={user.full_name || user.email}
              >
                {getInitials(user.full_name, user.email)}
              </button>

              {/* User Dropdown Menu Popover */}
              {isUserMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    onClick={() => setIsUserMenuOpen(false)}
                    className="fixed inset-0 z-40"
                  />

                  {/* Dropdown Container */}
                  <div className="absolute right-0 top-full mt-3 w-72 max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-3 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                    {/* User Profile Info Card */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-[10px] border border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {getInitials(user.full_name, user.email)}
                          </div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {user.full_name || 'Active User'}
                          </span>
                        </div>
                        {isOffline ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                            Offline
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
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
                          {getCurrencySymbol(user.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Profile Navigation Links */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-1">
                        Profile & Settings
                      </span>

                      <button
                        onClick={() => handleNavigate('settings#account')}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-indigo-500" />
                          <span>Account & Server Info</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>

                      <button
                        onClick={() => handleNavigate('settings#security')}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          <span>Security & PIN Lock</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>

                      <button
                        onClick={() => handleNavigate('settings#theme')}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Palette className="w-4 h-4 text-amber-500" />
                          <span>Theme & Appearance</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>

                      <button
                        onClick={() => handleNavigate('settings#backup')}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <CloudUpload className="w-4 h-4 text-sky-500" />
                          <span>Cloud & Drive Backup</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>

                    {/* Sign Out Action */}
                    {onLogout && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onLogout();
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
});

export default Header;
