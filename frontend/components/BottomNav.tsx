'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import {
  BottomBarStyle,
  getBottomBarStyle,
  BOTTOM_BAR_STYLE_EVENT,
  StickyStatsPosition,
  getStickyStatsPosition,
  STICKY_STATS_POS_EVENT,
  useFlowLabels,
  useQuickAddTrigger,
} from '@/lib/ui-prefs';
import {
  useBottomNavConfig,
  getNavItemMeta,
  BottomNavActionId,
} from '@/lib/bottom-nav-config';
import { formatAmount } from '@/lib/currency';
import { useTranslation } from '@/lib/i18n';
import { triggerHaptic } from '@/lib/haptics';

interface BottomNavProps {
  onOpenAddModal: (type: 'income' | 'expense') => void;
  onOpenSpeedDial?: () => void;
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

const BottomNav = React.memo(function BottomNav({
  onOpenAddModal,
  onOpenSpeedDial,
  summary,
  currency = '$',
  currentTab = 'dashboard',
  onSelectTab,
}: BottomNavProps) {
  const { inLabel, outLabel } = useFlowLabels();
  const { t } = useTranslation();
  const quickAddTrigger = useQuickAddTrigger();
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef(false);
  const [navConfig] = useBottomNavConfig();
  const { buttonCount, items, highlightIndex } = navConfig;
  const activeItems = items.slice(0, buttonCount);

  // Center action style: single Quick Add (+) or one-tap Cash In & Out pair
  const [barStyle, setBarStyle] = useState<BottomBarStyle>('fab');
  const [statsPos, setStatsPos] = useState<StickyStatsPosition>('bottom');
  const [isCockpitScrolled, setIsCockpitScrolled] = useState(false);

  // Dynamic color synchronization ensuring the notch arch matches the dock background 100%
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockColors, setDockColors] = useState<{ bg: string; border: string }>({
    bg: 'var(--bottom-dock-bg)',
    border: 'var(--bottom-dock-border)',
  });

  useEffect(() => {
    const syncColors = () => {
      if (dockRef.current) {
        const computed = window.getComputedStyle(dockRef.current);
        const bg = computed.backgroundColor;
        const border = computed.borderTopColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          setDockColors({
            bg,
            border:
              border && border !== 'rgba(0, 0, 0, 0)' && border !== 'transparent'
                ? border
                : 'var(--bottom-dock-border)',
          });
        }
      }
    };

    syncColors();
    requestAnimationFrame(syncColors);

    const observer = new MutationObserver(syncColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    window.addEventListener('resize', syncColors);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncColors);
    };
  }, [barStyle]);

  useEffect(() => {
    setBarStyle(getBottomBarStyle());
    setStatsPos(getStickyStatsPosition());
    const handleChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as BottomBarStyle | undefined;
      const validStyles: BottomBarStyle[] = [
        'fab',
        'notch',
        'pill',
        'floating',
        'indicator',
        'inout',
        'dot',
        'glass',
        'bubble',
        'badge',
        'compact',
        'wave',
      ];
      setBarStyle(detail && validStyles.includes(detail) ? detail : getBottomBarStyle());
    };
    const handleStatsPosChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as StickyStatsPosition | undefined;
      setStatsPos(
        detail === 'bottom' || detail === 'top' || detail === 'off'
          ? detail
          : getStickyStatsPosition()
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

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen for bulk delete / selection mode from RecordLedger
  const [isBulkSelectionActive, setIsBulkSelectionActive] = useState(false);

  useEffect(() => {
    const handleBulkMode = (e: Event) => {
      const detail = (e as CustomEvent).detail as { active?: boolean } | undefined;
      setIsBulkSelectionActive(Boolean(detail?.active));
    };
    window.addEventListener('cashflow-bulk-selection-mode', handleBulkMode);
    return () => window.removeEventListener('cashflow-bulk-selection-mode', handleBulkMode);
  }, []);

  const shouldShowStickyStats =
    statsPos === 'bottom' &&
    currentTab === 'dashboard' &&
    isCockpitScrolled &&
    !!summary &&
    !isBulkSelectionActive;

  const renderMinimalStatsStrip = () => {
    if (!shouldShowStickyStats || !summary) return null;
    const netBal = summary.balance;
    const isPositive = netBal >= 0;
    const fmtBal = formatAmount(Math.abs(netBal));
    const fmtIn = formatAmount(summary.income);
    const fmtOut = formatAmount(summary.expense);

    return (
      <div className="pb-1.5 pt-0.5 animate-in fade-in slide-in-from-bottom-1 duration-150">
        <div className="bg-slate-100/90 dark:bg-slate-800/90 rounded-md px-2.5 py-1 flex items-center justify-between text-xs border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
          <div className="flex items-center gap-1.5 font-mono text-[10px] sm:text-[11px]">
            <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-0.5">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-sans font-semibold">
                In
              </span>
              +{currency}
              {fmtIn}
            </span>
            <span className="text-slate-300 dark:text-slate-600 font-light">•</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-sans font-semibold">
                Out
              </span>
              -{currency}
              {fmtOut}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
              Net:
            </span>
            <span
              className={`text-[10px] sm:text-[11px] font-extrabold font-mono whitespace-nowrap ${
                isPositive
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              <span className="currency-symbol">{currency}</span>
              {fmtBal}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Helper to resolve metadata and click handling for an item
  const getItemDetails = (itemId: BottomNavActionId, idx: number) => {
    const meta = getNavItemMeta(itemId);
    const Icon = meta.icon;
    const isHighlighted = idx === highlightIndex;
    const isAddAction = itemId === 'add';
    const isActive = !isAddAction && currentTab === itemId;
    const label = t(meta.labelKey as any) || meta.defaultLabel;

    const handlePressStart = () => {
      if (!isAddAction) return;
      isLongPressActiveRef.current = false;
      if (quickAddTrigger === 'long_press') {
        longPressTimerRef.current = setTimeout(() => {
          isLongPressActiveRef.current = true;
          triggerHaptic('medium');
          if (onOpenSpeedDial) onOpenSpeedDial();
          else onOpenAddModal('expense');
        }, 450);
      }
    };

    const handlePressEnd = () => {
      if (!isAddAction) return;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const handleClick = () => {
      if (isAddAction) {
        if (isLongPressActiveRef.current) {
          isLongPressActiveRef.current = false;
          return;
        }
        if (quickAddTrigger === 'single_tap') {
          triggerHaptic('light');
          if (onOpenSpeedDial) {
            onOpenSpeedDial();
          } else {
            onOpenAddModal('expense');
          }
        } else {
          triggerHaptic('light');
          onOpenAddModal('expense');
        }
      } else if (onSelectTab) {
        onSelectTab(itemId);
      }
    };

    return {
      meta,
      Icon,
      isHighlighted,
      isAddAction,
      isActive,
      label,
      handleClick,
      handlePressStart,
      handlePressEnd,
    };
  };

  // Common Grid Style based on buttonCount
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${buttonCount}, minmax(0, 1fr))`,
    alignItems: 'center',
    gap: '0.25rem',
  };

  // 1. Dual Action Buttons Dock: 2 buttons taking the whole bottom width without tab bar
  if (barStyle === 'inout') {
    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-4 py-2.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 8px), calc(var(--safe-area-inset-bottom, 0px) + 8px), 10px)',
        }}
      >
        <div
          className="max-w-md mx-auto rounded-b-none !rounded-b-none"
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        >
          {renderMinimalStatsStrip()}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onOpenAddModal('income')}
              className="cash-in-btn flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm whitespace-nowrap shadow-sm transition-colors focus:outline-none"
              aria-label={`Add ${inLabel}`}
            >
              <ArrowDownLeft className="w-4 h-4 stroke-[3] shrink-0" />
              <span className="truncate">{inLabel}</span>
            </button>

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

  // 2. Floating Island Dock
  if (barStyle === 'floating') {
    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-x border-slate-200/90 dark:border-slate-800 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] rounded-t-2xl rounded-b-none !rounded-b-none px-3 py-1.5 gpu-layer lg:hidden"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto rounded-b-none !rounded-b-none">
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick } = getItemDetails(id, idx);
              if (isHighlighted) {
                return (
                  <div key={`${id}-${idx}`} className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleClick}
                      className="bottom-fab -mt-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/35 border-3 border-white dark:border-slate-900 active:scale-95 transition-all"
                      style={{ width: '48px', height: '48px' }}
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="w-5 h-5 stroke-[2.8]" />
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={`${id}-${idx}`}
                  type="button"
                  onClick={handleClick}
                  className={`bottom-tab flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-colors min-w-0 ${
                    isActive
                      ? 'bottom-tab-active text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-2'}`} />
                  <span
                    className={`text-[10px] leading-none truncate max-w-[56px] ${
                      isActive ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 3. Scooped Notch Bar
  if (barStyle === 'notch') {
    const hasHighlight = highlightIndex >= 0 && highlightIndex < buttonCount;
    return (
      <div
        ref={dockRef}
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        {hasHighlight && (
          <div
            className="absolute -top-[19px] -translate-x-1/2 w-[104px] h-[20px] pointer-events-none overflow-visible transition-all duration-200"
            style={{
              left: `calc(${((highlightIndex + 0.5) / buttonCount) * 100}%)`,
              filter: 'drop-shadow(0 -2px 4px rgba(0,0,0,0.04))',
            }}
          >
            <svg viewBox="0 0 104 20" className="w-full h-full">
              <path
                d="M 0,20 C 22,20 35,2 52,2 C 69,2 82,20 104,20 L 104,22 L 0,22 Z"
                style={{ fill: dockColors.bg }}
              />
              <path
                d="M 0,20 C 22,20 35,2 52,2 C 69,2 82,20 104,20"
                fill="none"
                style={{ stroke: dockColors.border }}
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
        <div className="max-w-md mx-auto relative z-10 rounded-b-none !rounded-b-none">
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick } = getItemDetails(id, idx);
              if (isHighlighted) {
                return (
                  <div key={`${id}-${idx}`} className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleClick}
                      className="bottom-fab -mt-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/35 border-3 active:scale-95 transition-all"
                      style={{ width: '48px', height: '48px', borderColor: dockColors.bg }}
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="w-5 h-5 stroke-[2.8]" />
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={`${id}-${idx}`}
                  type="button"
                  onClick={handleClick}
                  className={`bottom-tab flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-colors min-w-0 ${
                    isActive
                      ? 'bottom-tab-active text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-2'}`} />
                  <span
                    className={`text-[10px] leading-none truncate max-w-[56px] ${
                      isActive ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 4. Active Expanding Pill
  if (barStyle === 'pill') {
    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 py-2 gpu-layer lg:hidden rounded-b-none !rounded-b-none"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 8px), calc(var(--safe-area-inset-bottom, 0px) + 8px), 10px)',
        }}
      >
        <div className="max-w-md mx-auto rounded-b-none !rounded-b-none">
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick } = getItemDetails(id, idx);
              if (isHighlighted) {
                return (
                  <div key={`${id}-${idx}`} className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleClick}
                      className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 active:scale-95 transition-all shrink-0"
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="w-5 h-5 stroke-[2.8]" />
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={`${id}-${idx}`}
                  type="button"
                  onClick={handleClick}
                  className={`bottom-tab flex items-center justify-center gap-1.5 transition-all duration-200 min-w-0 ${
                    isActive
                      ? 'py-1.5 px-2.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs shadow-2xs'
                      : 'p-2 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  {isActive && (
                    <span className="text-[11px] leading-tight font-bold whitespace-nowrap truncate max-w-[52px]">
                      {label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 5. Top Line Indicator
  if (barStyle === 'indicator') {
    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-0.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto rounded-b-none !rounded-b-none">
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick } = getItemDetails(id, idx);
              if (isHighlighted) {
                return (
                  <div key={`${id}-${idx}`} className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleClick}
                      className="bottom-fab -mt-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 border-4 border-white dark:border-slate-900 active:scale-95 transition-all"
                      style={{ width: '50px', height: '50px' }}
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="w-5 h-5 stroke-[2.6]" />
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={`${id}-${idx}`}
                  type="button"
                  onClick={handleClick}
                  className={`bottom-tab relative flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 rounded-md transition-colors min-w-0 ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shadow-xs animate-in fade-in duration-150" />
                  )}
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-2'}`} />
                  <span
                    className={`text-[10px] leading-none truncate max-w-[56px] ${
                      isActive ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 6. Dot Indicator Style
  if (barStyle === 'dot') {
    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-1 gpu-layer lg:hidden rounded-b-none !rounded-b-none"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto rounded-b-none !rounded-b-none">
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick } = getItemDetails(id, idx);
              if (isHighlighted) {
                return (
                  <div key={`${id}-${idx}`} className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleClick}
                      className="bottom-fab -mt-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/35 border-3 border-white dark:border-slate-900 active:scale-95 transition-all"
                      style={{ width: '48px', height: '48px' }}
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="w-5 h-5 stroke-[2.8]" />
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={`${id}-${idx}`}
                  type="button"
                  onClick={handleClick}
                  className={`bottom-tab relative flex flex-col items-center justify-center gap-0.5 py-1 rounded-md transition-all min-w-0 ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  <span
                    className={`text-[10px] leading-none truncate max-w-[56px] ${
                      isActive ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {label}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-200 mt-0.5 ${
                      isActive
                        ? 'bg-emerald-600 dark:bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)] scale-100'
                        : 'opacity-0 scale-50'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 7. Frosted Glassmorphism
  if (barStyle === 'glass') {
    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-white/50 dark:border-slate-700/50 shadow-[0_-8px_32px_rgba(0,0,0,0.1)] px-3 pt-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto rounded-b-none !rounded-b-none">
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick } = getItemDetails(id, idx);
              if (isHighlighted) {
                return (
                  <div key={`${id}-${idx}`} className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleClick}
                      className="bottom-fab -mt-6 rounded-full bg-emerald-600/90 hover:bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-500/40 backdrop-blur-md border-3 border-white/80 dark:border-slate-800/80 active:scale-95 transition-all"
                      style={{ width: '50px', height: '50px' }}
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="w-6 h-6 stroke-[2.8]" />
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={`${id}-${idx}`}
                  type="button"
                  onClick={handleClick}
                  className={`bottom-tab flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-colors min-w-0 ${
                    isActive
                      ? 'bottom-tab-active text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-2'}`} />
                  <span
                    className={`text-[10px] leading-none truncate max-w-[56px] ${
                      isActive ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 8. Soft Bubble Pod
  if (barStyle === 'bubble') {
    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 py-2 gpu-layer lg:hidden rounded-b-none !rounded-b-none"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 8px), calc(var(--safe-area-inset-bottom, 0px) + 8px), 10px)',
        }}
      >
        <div className="max-w-md mx-auto rounded-b-none !rounded-b-none">
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick } = getItemDetails(id, idx);
              if (isHighlighted) {
                return (
                  <div key={`${id}-${idx}`} className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleClick}
                      className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 active:scale-95 transition-all"
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="w-5 h-5 stroke-[2.8]" />
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={`${id}-${idx}`}
                  type="button"
                  onClick={handleClick}
                  className={`bottom-tab flex flex-col items-center justify-center gap-0.5 py-1.5 px-1.5 rounded-xl transition-all duration-200 min-w-0 ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 shadow-xs'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  <span
                    className={`text-[10px] leading-tight truncate max-w-[56px] ${
                      isActive ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 9. Fintech Neon Badge
  if (barStyle === 'badge') {
    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 py-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto rounded-b-none !rounded-b-none">
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick } = getItemDetails(id, idx);
              if (isHighlighted) {
                return (
                  <div key={`${id}-${idx}`} className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleClick}
                      className="w-10 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 active:scale-95 transition-all"
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="w-5 h-5 stroke-[2.8]" />
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={`${id}-${idx}`}
                  type="button"
                  onClick={handleClick}
                  className={`bottom-tab relative flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-lg transition-all duration-150 min-w-0 ${
                    isActive
                      ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                      : 'border border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  <span
                    className={`text-[9.5px] leading-tight truncate max-w-[56px] ${
                      isActive ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 10. Ultra-Compact Slim
  if (barStyle === 'compact') {
    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-2px_12px_rgba(0,0,0,0.04)] px-2 py-1 gpu-layer lg:hidden rounded-b-none !rounded-b-none"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 4px), calc(var(--safe-area-inset-bottom, 0px) + 4px), 6px)',
        }}
      >
        <div className="max-w-md mx-auto rounded-b-none !rounded-b-none">
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick } = getItemDetails(id, idx);
              if (isHighlighted) {
                return (
                  <div key={`${id}-${idx}`} className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleClick}
                      className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-sm active:scale-95 transition-all"
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="w-4 h-4 stroke-[3]" />
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={`${id}-${idx}`}
                  type="button"
                  onClick={handleClick}
                  className={`bottom-tab flex items-center justify-center gap-1 py-1 px-1.5 rounded-md transition-colors min-w-0 ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  <span
                    className={`text-[10px] leading-none truncate max-w-[56px] ${
                      isActive ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 11. Curved Wave Halo
  if (barStyle === 'wave') {
    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto rounded-b-none !rounded-b-none">
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick } = getItemDetails(id, idx);
              if (isHighlighted) {
                return (
                  <div key={`${id}-${idx}`} className="flex justify-center relative">
                    <span className="absolute -top-7 w-14 h-14 rounded-full bg-emerald-500/15 dark:bg-emerald-400/10 animate-ping pointer-events-none" />
                    <button
                      type="button"
                      onClick={handleClick}
                      className="bottom-fab -mt-6 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 hover:from-emerald-500 hover:to-teal-300 text-white flex items-center justify-center shadow-xl shadow-emerald-600/35 ring-4 ring-emerald-500/20 active:scale-95 transition-all z-10"
                      style={{ width: '52px', height: '52px' }}
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="w-6 h-6 stroke-[3]" />
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={`${id}-${idx}`}
                  type="button"
                  onClick={handleClick}
                  className={`bottom-tab flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-colors min-w-0 ${
                    isActive
                      ? 'bottom-tab-active text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-2'}`} />
                  <span
                    className={`text-[10px] leading-none truncate max-w-[56px] ${
                      isActive ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 12. Standard Tab Navigation with Center Quick Add (+) button (Default 'fab')
  return (
    <div
      className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none"
      style={{
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderBottom: 'none',
        paddingBottom:
          'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
      }}
    >
      <div className="max-w-md mx-auto rounded-b-none !rounded-b-none">
        {renderMinimalStatsStrip()}
        <div style={gridStyle}>
          {activeItems.map((id, idx) => {
            const { Icon, isHighlighted, isActive, label, handleClick } = getItemDetails(id, idx);
            if (isHighlighted) {
              return (
                <div key={`${id}-${idx}`} className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleClick}
                    className="bottom-fab -mt-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 border-4 border-white dark:border-slate-900 active:scale-95 transition-all"
                    style={{ width: '52px', height: '52px' }}
                    aria-label={label}
                    title={label}
                  >
                    <Icon className="w-6 h-6 stroke-[2.6]" />
                  </button>
                </div>
              );
            }
            return (
              <button
                key={`${id}-${idx}`}
                type="button"
                onClick={handleClick}
                className={`bottom-tab flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-colors min-w-0 ${
                  isActive
                    ? 'bottom-tab-active text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-2'}`} />
                <span
                  className={`text-[10px] leading-none truncate max-w-[56px] ${
                    isActive ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default BottomNav;
