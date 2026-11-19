'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  ListFilter,
  Calendar,
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
  LayoutGrid,
  Trash2,
  Calculator,
  FileText,
  Tag,
  BellRing
} from 'lucide-react';
import { User, SubAccount } from '@/lib/types';
import { getCurrencySymbol } from '@/lib/currency';
import AdSlot from './AdSlot';
import { useTranslation } from '@/lib/i18n';

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
  const { t } = useTranslation();
  // Hash state tracking for active settings subpage
  const [activeHash, setActiveHash] = useState<string>('');
  // Expand Settings sub-menu: default to true if currently in settings
  const [isSettingsExpanded, setIsSettingsExpanded] = useState<boolean>(true);

  // Touch swipe-left-to-close gesture state
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDragX(0);
      setIsDragging(false);
      isHorizontalSwipeRef.current = null;
    }
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isOpen) return;
    const t = e.touches[0];
    if (!t) return;
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    startTimeRef.current = Date.now();
    isHorizontalSwipeRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isOpen) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;

    if (isHorizontalSwipeRef.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      isHorizontalSwipeRef.current = Math.abs(dx) > Math.abs(dy) && dx < 0;
      if (isHorizontalSwipeRef.current) {
        setIsDragging(true);
      }
    }

    if (isHorizontalSwipeRef.current) {
      setDragX(Math.min(0, dx));
    }
  };

  const handleTouchEnd = () => {
    if (!isHorizontalSwipeRef.current) {
      setIsDragging(false);
      return;
    }
    const elapsed = Math.max(1, Date.now() - startTimeRef.current);
    const velocity = dragX / elapsed; // px per ms
    const shouldClose = dragX < -65 || velocity < -0.35;

    setIsDragging(false);
    setDragX(0);
    isHorizontalSwipeRef.current = null;

    if (shouldClose) {
      onClose();
    }
  };

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

  const isOffline = typeof window !== 'undefined' && localStorage.getItem('app_mode') === 'offline';

  const navItems = [
    { id: 'dashboard', label: t('dashboard'), icon: Home, path: '/' },
    { id: 'history', label: t('cashBookHistory'), icon: ListFilter, path: '/history' },
    { id: 'calendar', label: t('calendar'), icon: Calendar, path: '/calendar' },
    { id: 'reminders', label: 'Reminders & Bills', icon: BellRing, path: '/reminders' },
    { id: 'analytics', label: t('analyticsReports'), icon: PieChart, path: '/analytics' },
    { id: 'categories', label: 'Categories', icon: Tag, path: '/categories' },
    { id: 'calculator', label: t('cashCalculator'), icon: Calculator, path: '/calculator' },
    { id: 'notes', label: t('notes'), icon: FileText, path: '/notes' },
    { id: 'trash', label: t('deletedTransactions'), icon: Trash2, path: '/trash' },
    { id: 'settings', label: t('settings'), icon: Settings, path: '/settings' },
    { id: 'settings#theme', label: 'Theme & Appearance', icon: Palette, path: '/settings#theme' },
    { id: 'settings#backup', label: t('backupRestore'), icon: CloudUpload, path: '/settings#backup' },
    { id: 'settings#security', label: t('securityPinLock'), icon: ShieldCheck, path: '/settings#security' },
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
    <>
      {/* Backdrop (mobile overlay only — sidebar is persistent on desktop) */}
      {isOpen && (
        <div
          onClick={onClose}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={{
            opacity: isDragging ? Math.max(0.15, 1 + dragX / 300) : 1,
          }}
          className="fixed inset-0 z-50 bg-black/60 transition-opacity animate-in fade-in duration-150 lg:hidden"
        />
      )}

      {/* Sidebar Panel: slide-over on mobile, docked rail on lg+ */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={
          isDragging && isOpen
            ? {
              transform: `translate3d(${dragX}px, 0, 0)`,
              transition: 'none',
            }
            : undefined
        }
        className={`sidebar-drawer-panel fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] lg:w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl lg:shadow-none flex flex-col justify-between !rounded-none rounded-none transition-transform duration-200 ease-out will-change-transform ${isOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none lg:pointer-events-auto'
          } lg:translate-x-0`}
      >

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Header Bar */}
          <div
            className="sidebar-drawer-header flex items-center justify-between px-4 pb-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10 !rounded-none rounded-none shadow-none"
            style={{
              paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), calc(var(--safe-area-inset-top, 0px) + 16px), 24px)'
            }}
          >
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
              className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors lg:hidden"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Navigation Links */}
          <div className="p-3 space-y-1 mt-1">
            {/* All Menu Items */}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isSettingsSub = item.id.startsWith('settings#');
              const subHash = isSettingsSub ? item.id.split('#')[1] : '';
              const isActive = isSettingsSub
                ? currentTab === 'settings' && activeHash === subHash
                : item.id === 'settings'
                ? currentTab === 'settings' && (!activeHash || activeHash === 'main' || activeHash === 'datetime' || activeHash === 'ledgers' || activeHash === 'account')
                : currentTab === item.id;

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
          </div>
        </div>

        {/* Sidebar Ad Slot */}
        <AdSlot placement="cashflow_sidebar" className="mx-3 my-2" />

        {/* Bottom Actions: Logout / Mode */}
        <div className="sidebar-drawer-footer p-4 border-t border-slate-100 dark:border-slate-800 space-y-2 shrink-0 bg-white dark:bg-slate-900 !rounded-none rounded-none shadow-none">
          {onLogout && (
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('signOut')}</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
