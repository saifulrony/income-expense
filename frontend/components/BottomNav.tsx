'use client';

import React, { useState, useEffect } from 'react';
import { Home, Calendar, PieChart, Calculator, Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import {
  BottomBarStyle,
  getBottomBarStyle,
  BOTTOM_BAR_STYLE_EVENT,
  StickyStatsPosition,
  getStickyStatsPosition,
  STICKY_STATS_POS_EVENT,
  useFlowLabels,
} from '@/lib/ui-prefs';
import { formatAmount } from '@/lib/currency';
import { useTranslation } from '@/lib/i18n';

interface BottomNavProps {
  onOpenAddModal: (type: 'income' | 'expense') => void;
  summary?: {
    income: number;
    expense: number;
    balance: number;
  };
  currency?: string;
  currentTab?: string;
  onSelectTab?: (tab: string) => void;
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
}

const TABS = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'analytics', label: 'Analytics', icon: PieChart },
  { id: 'calculator', label: 'Calculator', icon: Calculator },
];

const BottomNav = React.memo(function BottomNav({
  onOpenAddModal,
  summary,
  currency = '$',
  currentTab = 'dashboard',
  onSelectTab,
  selectedPeriod = 'all',
  onPeriodChange,
}: BottomNavProps) {
  const { inLabel, outLabel } = useFlowLabels();
  const { t } = useTranslation();
  const tabs = [
    { id: 'dashboard', label: t('home'), icon: Home },
    { id: 'calendar', label: t('calendar'), icon: Calendar },
    { id: 'analytics', label: t('analytics'), icon: PieChart },
    { id: 'calculator', label: t('calculator'), icon: Calculator },
  ];
  const leftTabs = tabs.slice(0, 2);
  const rightTabs = tabs.slice(2);

  // Center action style: single Quick Add (+) or one-tap Cash In & Out pair
  const [barStyle, setBarStyle] = useState<BottomBarStyle>('fab');
  const [statsPos, setStatsPos] = useState<StickyStatsPosition>('bottom');
  const [isCockpitScrolled, setIsCockpitScrolled] = useState(false);

  useEffect(() => {
    setBarStyle(getBottomBarStyle());
    setStatsPos(getStickyStatsPosition());
    const handleChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as BottomBarStyle | undefined;
      setBarStyle(detail === 'inout' || detail === 'fab' ? detail : getBottomBarStyle());
    };
    const handleStatsPosChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as StickyStatsPosition | undefined;
      setStatsPos(
        detail === 'bottom' || detail === 'top' || detail === 'off' ? detail : getStickyStatsPosition()
      );
    };
    window.addEventListener(BOTTOM_BAR_STYLE_EVENT, handleChange);
    window.addEventListener(STICKY_STATS_POS_EVENT, handleStatsPosChange);
    window.addEventListener('storage', handleChange);
    window.addEventListener('storage', handleStatsPosChange);
    return () => {
      window.removeEventListener(BOTTOM_BAR_STYLE_EVENT, handleChange);
      window.removeEventListener(STICKY_STATS_POS_EVENT, handleStatsPosChange);
      window.removeEventListener('storage', handleChange);
      window.removeEventListener('storage', handleStatsPosChange);
    };
  }, []);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const top = window.scrollY || document.documentElement.scrollTop || 0;
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

  const showBottomStats =
    statsPos === 'bottom' && currentTab === 'dashboard' && isCockpitScrolled && !!summary;

  const renderMinimalStatsStrip = () => {
    if (!summary) return null;
    const isPositive = summary.balance >= 0;
    const fmtIn = formatAmount(summary.income);
    const fmtOut = formatAmount(summary.expense);
    const fmtBal = formatAmount(summary.balance);
    const inW = Math.max(7, (currency?.length || 1) + fmtIn.length + 3);
    const outW = Math.max(7, (currency?.length || 1) + fmtOut.length + 3);
    const balW = Math.max(7, (currency?.length || 1) + fmtBal.length + 3);

    return (
      <div
        className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
          showBottomStats ? 'grid-rows-[1fr] opacity-100 mb-2' : 'grid-rows-[0fr] opacity-0 mb-0 pointer-events-none'
        }`}
        aria-hidden={!showBottomStats}
      >
        <div className="overflow-hidden">
          <div
            style={{
              gridTemplateColumns: `${inW}fr ${outW}fr ${balW}fr`,
            }}
            className={`rounded-lg px-2 py-1.5 border grid divide-x text-center ${
              isPositive
                ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-200/80 dark:border-emerald-800/60 divide-emerald-200/70 dark:divide-emerald-800/50'
                : 'bg-rose-50/90 dark:bg-rose-950/50 border-rose-200/80 dark:border-rose-800/60 divide-rose-200/70 dark:divide-rose-800/50'
            }`}
          >
            <div className="px-1 flex items-center justify-center gap-1 min-w-0">
              <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 shrink-0">
                {t('inShort')}
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                <span className="currency-symbol">{currency}</span>{fmtIn}
              </span>
            </div>
            <div className="px-1 flex items-center justify-center gap-1 min-w-0">
              <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 shrink-0">
                {t('outShort')}
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold font-mono text-rose-600 dark:text-rose-400 whitespace-nowrap">
                <span className="currency-symbol">{currency}</span>{fmtOut}
              </span>
            </div>
            <div className="px-1 flex items-center justify-center gap-1 min-w-0">
              <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 shrink-0">
                {t('balShort')}
              </span>
              <span
                className={`text-[10px] sm:text-[11px] font-extrabold font-mono whitespace-nowrap ${
                  isPositive
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                <span className="currency-symbol">{currency}</span>{fmtBal}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTab = (tab: (typeof TABS)[number]) => {
    const Icon = tab.icon;
    const isActive = currentTab === tab.id;
    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => onSelectTab?.(tab.id)}
        className={`bottom-tab flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-colors min-w-0 ${
          isActive
            ? 'bottom-tab-active text-emerald-600 dark:text-emerald-400'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
        aria-label={tab.label}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-2'}`} />
        <span className={`text-[10px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>
          {tab.label}
        </span>
      </button>
    );
  };

  // 1. Dual Action Buttons Dock: 2 buttons taking the whole bottom width without tab bar
  if (barStyle === 'inout') {
    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-4 py-2.5 gpu-layer lg:hidden"
        style={{
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 8px), calc(var(--safe-area-inset-bottom, 0px) + 8px), 10px)',
        }}
      >
        <div className="max-w-md mx-auto">
          {renderMinimalStatsStrip()}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Cash In Button (Green) */}
            <button
              type="button"
              onClick={() => onOpenAddModal('income')}
              className="cash-in-btn flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm whitespace-nowrap shadow-sm transition-colors focus:outline-none"
              aria-label={`Add ${inLabel}`}
            >
              <ArrowDownLeft className="w-4 h-4 stroke-[3] shrink-0" />
              <span className="truncate">{inLabel}</span>
            </button>

            {/* Cash Out Button (Rose/Red) */}
            <button
              type="button"
              onClick={() => onOpenAddModal('expense')}
              className="cash-out-btn flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-sm whitespace-nowrap shadow-sm transition-colors focus:outline-none"
              aria-label={`Add ${outLabel}`}
            >
              <ArrowUpRight className="w-4 h-4 stroke-[3] shrink-0" />
              <span className="truncate">{outLabel}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Standard Tab Navigation with Center Quick Add (+) button
  return (
    <div
      className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-1.5 gpu-layer lg:hidden"
      style={{
        paddingBottom:
          'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
      }}
    >
      <div className="max-w-md mx-auto">
        {renderMinimalStatsStrip()}
        <div className="grid grid-cols-5 items-center gap-1">
          {leftTabs.map(renderTab)}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => onOpenAddModal('expense')}
              className="bottom-fab -mt-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 border-4 border-white dark:border-slate-900 active:scale-95 transition-all"
              style={{ width: '52px', height: '52px' }}
              aria-label="Add transaction"
              title="Add transaction (Cash In / Cash Out)"
            >
              <Plus className="w-6 h-6 stroke-[2.6]" />
            </button>
          </div>

          {rightTabs.map(renderTab)}
        </div>
      </div>
    </div>
  );
});

export default BottomNav;
