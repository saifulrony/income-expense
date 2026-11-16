'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { User, SubAccount, SummaryData } from '@/lib/types';
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
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import {
  HeaderStyle,
  getHeaderStyle,
  HEADER_STYLE_EVENT,
  StickyStatsPosition,
  getStickyStatsPosition,
  STICKY_STATS_POS_EVENT,
} from '@/lib/ui-prefs';
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
  currentTab?: string;
  summary?: SummaryData;
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
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
  currentTab = 'dashboard',
  summary,
  selectedPeriod = 'all',
  onPeriodChange,
}: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [headerStyle, setHeaderStyleState] = useState<HeaderStyle>('classic');
  const [statsPos, setStatsPosState] = useState<StickyStatsPosition>('bottom');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isCockpitScrolled, setIsCockpitScrolled] = useState(false);

  React.useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const top = window.scrollY || document.documentElement.scrollTop || 0;
          setIsScrolled((prev) => {
            if (!prev && top > 6) return true;
            if (prev && top <= 2) return false;
            return prev;
          });
          setIsCockpitScrolled((prev) => {
            if (!prev && top > 115) return true;
            if (prev && top < 85) return false;
            return prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    setHeaderStyleState(getHeaderStyle());
    setStatsPosState(getStickyStatsPosition());
    const handleStyleChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as HeaderStyle | undefined;
      setHeaderStyleState(detail === 'sticky' || detail === 'classic' ? detail : getHeaderStyle());
    };
    const handleStatsPosChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as StickyStatsPosition | undefined;
      setStatsPosState(
        detail === 'bottom' || detail === 'top' || detail === 'off' ? detail : getStickyStatsPosition()
      );
    };
    window.addEventListener(HEADER_STYLE_EVENT, handleStyleChange);
    window.addEventListener(STICKY_STATS_POS_EVENT, handleStatsPosChange);
    window.addEventListener('storage', handleStyleChange);
    window.addEventListener('storage', handleStatsPosChange);
    return () => {
      window.removeEventListener(HEADER_STYLE_EVENT, handleStyleChange);
      window.removeEventListener(STICKY_STATS_POS_EVENT, handleStatsPosChange);
      window.removeEventListener('storage', handleStyleChange);
      window.removeEventListener('storage', handleStatsPosChange);
    };
  }, []);

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

  const isCompactSticky = headerStyle === 'sticky' || isScrolled;

  return (
    <>
      <div className="app-header-shelf" aria-hidden="true" />
      <header 
        className={`app-header sticky top-0 ${
          isUserMenuOpen || isAccountDropdownOpen
            ? 'header-dropdown-open !z-[9999]'
            : 'z-40'
        } ${
          isCompactSticky ? 'header-scrolled' : ''
        } px-4 !rounded-none rounded-none`}
        style={{
          zIndex: isUserMenuOpen || isAccountDropdownOpen ? 9999 : 40,
          paddingTop: 'calc(max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px)) + 0.85rem)',
          paddingBottom: '0.75rem',
        }}
      >
        <div
          className="app-header-bg absolute inset-0 -z-10 pointer-events-none"
          aria-hidden="true"
        />
      <div className="max-w-md lg:max-w-4xl mx-auto lg:px-4 flex items-center justify-between gap-1.5 sm:gap-2.5">
        {/* Left Side: Burger Menu + Logo + Title */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="header-btn w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors shrink-0 active:scale-95 lg:hidden"
            aria-label="Open navigation menu"
            title="Menu"
          >
            <Menu className="w-5 h-5 stroke-[2.2]" />
          </button>

          <Link
            href="/"
            onClick={(e) => {
              if (onNavigateToTab) {
                e.preventDefault();
                onNavigateToTab('dashboard');
              }
            }}
            className="flex items-center gap-1.5 sm:gap-2 min-w-0 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer select-none lg:hidden"
            title="CashFlow — Home"
          >
            <div className="header-logo flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Wallet className="w-5 h-5 stroke-[2.4]" />
            </div>

            <span className="header-title font-bold text-sm tracking-tight text-slate-800 dark:text-slate-100 truncate inline-block">
              CashFlow
            </span>
          </Link>
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
                className={`header-account-btn flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-all text-slate-800 dark:text-slate-100 ${
                  isAccountDropdownOpen
                    ? 'bg-slate-200/70 dark:bg-slate-800/90 text-emerald-600 dark:text-emerald-400'
                    : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
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
                <span className="max-w-[76px] min-[380px]:max-w-[96px] sm:max-w-[140px] truncate text-xs">
                  {activeAccountId === 'all' ? (
                    <>
                      <span className="sm:hidden">All</span>
                      <span className="hidden sm:inline">All Accounts</span>
                    </>
                  ) : (
                    accountDisplayName
                  )}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isAccountDropdownOpen ? 'rotate-180 text-emerald-500' : ''
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

          {/* User Profile Menu Button & Dropdown */}
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen((prev) => !prev);
                  setIsAccountDropdownOpen(false);
                }}
                className="header-user-btn w-8 h-8 rounded-full bg-emerald-500/15 dark:bg-emerald-500/25 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-xs active:scale-95 transition-all hover:bg-emerald-500/25 dark:hover:bg-emerald-500/35 focus:outline-none"
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

      {/* Minimal Sticky Summary Cockpit Bar (attaches smoothly under header on scroll when statsPos === 'top') */}
      {currentTab === 'dashboard' && summary && statsPos === 'top' && (
        <div
          className={`sticky-mini-cockpit absolute top-full left-0 right-0 px-3 sm:px-4 pt-1 pb-1.5 transition-all duration-200 ease-out ${
            isCockpitScrolled && !isUserMenuOpen && !isAccountDropdownOpen
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-1.5 pointer-events-none'
          }`}
          aria-hidden={!isCockpitScrolled}
        >
          {(() => {
            const totalIncome = summary.total_income || 0;
            const totalExpense = summary.total_expense || 0;
            const netBalance = summary.net_balance || 0;
            const isPositive = netBalance >= 0;
            const sym = currency || getCurrencySymbol(user?.currency);
            return (
              <div
                className={`summary-card-cockpit max-w-md lg:max-w-4xl mx-auto rounded-[10px] px-2.5 py-1.5 shadow-md border backdrop-blur-md grid grid-cols-3 divide-x text-center ${
                  isPositive
                    ? 'cockpit-positive bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-200/90 dark:border-emerald-800/60 divide-emerald-200/70 dark:divide-emerald-800/50'
                    : 'cockpit-negative bg-rose-50/95 dark:bg-rose-950/90 border-rose-200/90 dark:border-rose-800/60 divide-rose-200/70 dark:divide-rose-800/50'
                }`}
              >
                <div className="px-1.5 flex items-center justify-center gap-1 min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400 shrink-0">
                    In
                  </span>
                  <span className="text-[11px] font-bold font-mono text-emerald-600 dark:text-emerald-400 truncate">
                    <span className="currency-symbol">{sym}</span>{formatAmount(totalIncome)}
                  </span>
                </div>
                <div className="px-1.5 flex items-center justify-center gap-1 min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400 shrink-0">
                    Out
                  </span>
                  <span className="text-[11px] font-bold font-mono text-rose-600 dark:text-rose-400 truncate">
                    <span className="currency-symbol">{sym}</span>{formatAmount(totalExpense)}
                  </span>
                </div>
                <div className="px-1.5 flex items-center justify-center gap-1 min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400 shrink-0">
                    Bal
                  </span>
                  <span
                    className={`text-[11px] font-extrabold font-mono truncate ${
                      isPositive
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    <span className="currency-symbol">{sym}</span>{formatAmount(netBalance)}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}
      </header>
    </>
  );
});

export default Header;
