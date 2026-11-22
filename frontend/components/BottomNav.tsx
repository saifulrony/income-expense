'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus } from 'lucide-react';
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

export type SpeedDialMethod = 'scanner' | 'voice' | 'ai' | 'manual';

interface BottomNavProps {
  onOpenAddModal: (type: 'income' | 'expense') => void;
  onOpenSpeedDial?: () => void;
  isSpeedDialOpen?: boolean;
  onCloseSpeedDial?: () => void;
  onSelectSpeedDialMethod?: (method: SpeedDialMethod) => void;
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
  isSpeedDialOpen = false,
  onCloseSpeedDial,
  onSelectSpeedDialMethod,
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
  const [canvasBg, setCanvasBg] = useState<string>('var(--background)');
  const [dockColors, setDockColors] = useState<{ bg: string; border: string }>({
    bg: 'var(--bottom-dock-bg)',
    border: 'var(--bottom-dock-border)',
  });

  useEffect(() => {
    const syncColors = () => {
      if (dockRef.current) {
        const dockEl = (dockRef.current.closest('.bottom-action-dock') as HTMLElement | null) || dockRef.current;
        const computed = window.getComputedStyle(dockEl);
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

    const syncCanvas = () => {
      const canvas = document.querySelector('.app-content-canvas');
      if (canvas) {
        const c = window.getComputedStyle(canvas).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') setCanvasBg(c);
      }
    };
    const syncAll = () => {
      syncColors();
      syncCanvas();
    };
    syncAll();
    requestAnimationFrame(syncAll);

    const observer = new MutationObserver(syncAll);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    window.addEventListener("resize", syncAll);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncAll);
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
        'liquid_hump',
        'liquid_dip',
        'liquid_glow',
        'curved_hole',
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

  // Click outside listener when speed dial is open (no dark backdrop overlay)
  useEffect(() => {
    if (!isSpeedDialOpen || !onCloseSpeedDial) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.bottom-fab')) return;
      onCloseSpeedDial();
    };
    const timer = setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
      window.addEventListener('touchstart', handleOutsideClick);
    }, 60);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isSpeedDialOpen, onCloseSpeedDial]);

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
      longPressTimerRef.current = setTimeout(() => {
        isLongPressActiveRef.current = true;
        triggerHaptic('medium');
        if (onOpenSpeedDial) onOpenSpeedDial();
      }, 350);
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
        triggerHaptic('light');
        onOpenAddModal('expense');
      } else if (onSelectTab) {
        onSelectTab(itemId);
      }
    };

    const pressHandlers = isAddAction
      ? {
          onClick: handleClick,
          onTouchStart: handlePressStart,
          onTouchEnd: handlePressEnd,
          onTouchCancel: handlePressEnd,
          onMouseDown: handlePressStart,
          onMouseUp: handlePressEnd,
          onMouseLeave: handlePressEnd,
        }
      : {
          onClick: handleClick,
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
      pressHandlers,
    };
  };

  // Common Grid Style based on buttonCount
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${buttonCount}, minmax(0, 1fr))`,
    alignItems: 'center',
    gap: '0.25rem',
  };

  // Active item index calculation for sliding liquid animations (liquid_hump, liquid_dip)
  const currentActiveIndex = activeItems.findIndex((id, idx) => {
    const { isAddAction } = getItemDetails(id, idx);
    return !isAddAction && currentTab === id;
  });
  const effectiveIndex = currentActiveIndex >= 0 ? currentActiveIndex : 0;
  const activePercent = ((effectiveIndex + 0.5) / buttonCount) * 100;

  // 4 Radial speed-dial shortcut buttons radiating symmetrically along a circular arc centered on the FAB
  const speedDialActions = [
    {
      id: 'scanner' as SpeedDialMethod,
      label: 'Scan Receipt',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none" stroke="currentColor">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="6.5" y="7.5" width="11" height="9" rx="2" fill="currentColor" fillOpacity="0.25" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.5" strokeWidth="1.8" fill="#FFFFFF" fillOpacity="0.85" stroke="currentColor" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="#34D399" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      bg: 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-400 hover:from-emerald-500 hover:to-teal-300 text-white shadow-emerald-600/35 ring-2 ring-white/30 dark:ring-white/15',
      x: -88,
      y: -48,
      delayMs: 0,
    },
    {
      id: 'voice' as SpeedDialMethod,
      label: 'Voice Entry',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none" stroke="currentColor">
          <rect x="9" y="3" width="6" height="10" rx="3" fill="currentColor" fillOpacity="0.25" strokeWidth="2" />
          <path d="M5 10v1a7 7 0 0 0 14 0v-1" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="12" y1="18" x2="12" y2="22" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="8" y1="22" x2="16" y2="22" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M2.5 11c0-1.8.8-3.3 2-4.2" stroke="#C7D2FE" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M21.5 11c0-1.8-.8-3.3-2-4.2" stroke="#C7D2FE" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
      bg: 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 hover:from-indigo-500 hover:to-violet-400 text-white shadow-indigo-600/35 ring-2 ring-white/30 dark:ring-white/15',
      x: -35,
      y: -94,
      delayMs: 40,
    },
    {
      id: 'ai' as SpeedDialMethod,
      label: 'Gemini AI',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none">
          <defs>
            <linearGradient id="dock-gemini-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="60%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#FDE047" />
            </linearGradient>
          </defs>
          <path
            d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z"
            fill="url(#dock-gemini-grad)"
          />
          <path
            d="M19 2C19 3.66 17.66 5 16 5C17.66 5 19 6.34 19 8C19 6.34 20.34 5 22 5C20.34 5 19 3.66 19 2Z"
            fill="#FFFFFF"
            opacity="0.95"
          />
          <circle cx="5" cy="19" r="1.5" fill="#FFFFFF" opacity="0.85" />
        </svg>
      ),
      bg: 'bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-amber-500 hover:from-violet-500 hover:via-fuchsia-500 hover:to-amber-400 text-white shadow-purple-600/40 ring-2 ring-white/40 dark:ring-white/20',
      x: 35,
      y: -94,
      delayMs: 80,
    },
    {
      id: 'manual' as SpeedDialMethod,
      label: 'Calculator',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none" stroke="currentColor">
          <rect x="4" y="2" width="16" height="20" rx="3.5" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
          <rect x="7" y="5" width="10" height="4" rx="1" fill="#FFFFFF" fillOpacity="0.85" stroke="none" />
          <circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="12" r="1" fill="#38BDF8" stroke="none" />
          <circle cx="8" cy="15.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="15.5" r="1" fill="#38BDF8" stroke="none" />
          <circle cx="8" cy="19" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="19" r="1" fill="#10B981" stroke="none" />
        </svg>
      ),
      bg: 'bg-gradient-to-tr from-slate-800 via-slate-700 to-slate-600 hover:bg-slate-700 text-white shadow-slate-900/35 ring-2 ring-white/20 dark:ring-white/10',
      x: 88,
      y: -48,
      delayMs: 120,
    },
  ];

  // Reusable Quick Add FAB renderer: morphs into red cross when speed dial opens
  const renderFabButton = (key: string, pressHandlers: any, label: string, size = '48px') => {
    return (
      <div key={key} className="flex justify-center relative">
        {isSpeedDialOpen && (
          <>
            {/* Radial Speed Dial Dial Origin Container - centered exactly on the FAB center */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 pointer-events-none z-40">
              {/* Arc Track Guide centered exactly on the FAB */}
              <div
                className="absolute left-1/2 bottom-0 -translate-x-1/2 w-52 h-26 rounded-t-full border border-dashed border-white/20 dark:border-white/10 pointer-events-none animate-in fade-in duration-200"
              />
              {/* 4 Radial Buttons perfectly balanced around the FAB */}
              {speedDialActions.map((act) => (
                <div
                  key={act.id}
                  style={{
                    transform: `translate3d(calc(-50% + ${act.x}px), calc(-50% + ${act.y}px), 0px) scale(1)`,
                    transition: 'transform 290ms cubic-bezier(0.34, 1.45, 0.64, 1), opacity 200ms ease-out',
                    transitionDelay: `${act.delayMs}ms`,
                  }}
                  className="absolute left-0 top-0 flex flex-col items-center group cursor-pointer pointer-events-auto animate-in fade-in zoom-in-50 duration-250 w-24 -ml-0"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('medium');
                      if (onCloseSpeedDial) onCloseSpeedDial();
                      if (onSelectSpeedDialMethod) onSelectSpeedDialMethod(act.id);
                    }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl active:scale-90 hover:scale-105 transition-all shrink-0 ${act.bg}`}
                    title={act.label}
                  >
                    {act.icon}
                  </button>
                  <span className="text-[10px] font-bold text-slate-800 dark:text-slate-100 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2 py-0.5 rounded-full border border-slate-200/80 dark:border-slate-700/80 shadow-md whitespace-nowrap mt-1 pointer-events-none tracking-tight text-center">
                    {act.label}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          {...(isSpeedDialOpen ? { onClick: onCloseSpeedDial } : pressHandlers)}
          className={`bottom-fab -mt-5 rounded-full text-white flex items-center justify-center shadow-lg border-3 border-white dark:border-slate-900 active:scale-95 transition-all duration-300 relative z-40 cursor-pointer ${
            isSpeedDialOpen
              ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/40 ring-4 ring-rose-500/25'
              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/35 ring-0'
          }`}
          style={{ width: size, height: size }}
          aria-label={isSpeedDialOpen ? 'Close shortcuts' : label}
          title={isSpeedDialOpen ? 'Close shortcuts' : label}
        >
          <div
            className={`transition-transform duration-300 transform ${
              isSpeedDialOpen ? 'rotate-45' : 'rotate-0'
            }`}
          >
            <Plus className="w-5 h-5 stroke-[2.8]" />
          </div>
        </button>
      </div>
    );
  };

  // Notched curve hump at the top of the bottom menu for highlighted button (Quick Add FAB)
  const hasHighlight = highlightIndex >= 0 && highlightIndex < buttonCount;
  const renderNotchCurve = (pad = '0.375rem') => {
    if (!hasHighlight) return null;
    return (
      <div
        className="absolute -translate-x-1/2 w-[104px] h-[20px] pointer-events-none overflow-visible transition-all duration-200 z-10"
        style={{
          left: `calc(${((highlightIndex + 0.5) / buttonCount) * 100}%)`,
          filter: 'drop-shadow(rgba(0, 0, 0, 0.04) 0px -2px 4px)',
          bottom: `calc(100% + ${pad} + 0.5px)`,
        }}
      >
        <svg viewBox="0 0 104 20" className="w-full h-full overflow-visible">
          <path
            d="M 0,20 C 22,20 35,2 52,2 C 69,2 82,20 104,20 L 104,22 L 0,22 Z"
            style={{ fill: dockColors.bg }}
          />
          <path
            d="M 0,20 C 22,20 35,2 52,2 C 69,2 82,20 104,20"
            fill="none"
            strokeWidth="1.2"
            strokeLinecap="round"
            style={{ stroke: dockColors.border }}
          />
        </svg>
      </div>
    );
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
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-x border-slate-200/90 dark:border-slate-800 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] rounded-t-2xl rounded-b-none !rounded-b-none px-3 py-1.5 gpu-layer lg:hidden overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none">
          {renderNotchCurve()}
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick, pressHandlers } = getItemDetails(id, idx);
              if (isHighlighted) {
                return renderFabButton(`${id}-${idx}`, pressHandlers, label, '48px');
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
    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div ref={dockRef} className="max-w-md mx-auto relative z-10 rounded-b-none !rounded-b-none">
          {renderNotchCurve()}
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick, pressHandlers } = getItemDetails(id, idx);
              if (isHighlighted) {
                return renderFabButton(`${id}-${idx}`, pressHandlers, label, '48px');
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
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 py-2 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 8px), calc(var(--safe-area-inset-bottom, 0px) + 8px), 10px)',
        }}
      >
        <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none">
          {renderNotchCurve('0.5rem')}
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick, pressHandlers } = getItemDetails(id, idx);
              if (isHighlighted) {
                return renderFabButton(`${id}-${idx}`, pressHandlers, label, '40px');
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
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-0.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none">
          {renderNotchCurve()}
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick, pressHandlers } = getItemDetails(id, idx);
              if (isHighlighted) {
                return renderFabButton(`${id}-${idx}`, pressHandlers, label, '50px');
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
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-1 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none">
          {renderNotchCurve()}
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick, pressHandlers } = getItemDetails(id, idx);
              if (isHighlighted) {
                return renderFabButton(`${id}-${idx}`, pressHandlers, label, '48px');
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
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-white/50 dark:border-slate-700/50 shadow-[0_-8px_32px_rgba(0,0,0,0.1)] px-3 pt-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none">
          {renderNotchCurve()}
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick, pressHandlers } = getItemDetails(id, idx);
              if (isHighlighted) {
                return renderFabButton(`${id}-${idx}`, pressHandlers, label, '50px');
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
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 py-2 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 8px), calc(var(--safe-area-inset-bottom, 0px) + 8px), 10px)',
        }}
      >
        <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none">
          {renderNotchCurve('0.5rem')}
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick, pressHandlers } = getItemDetails(id, idx);
              if (isHighlighted) {
                return renderFabButton(`${id}-${idx}`, pressHandlers, label, '40px');
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
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 py-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none">
          {renderNotchCurve()}
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick, pressHandlers } = getItemDetails(id, idx);
              if (isHighlighted) {
                return renderFabButton(`${id}-${idx}`, pressHandlers, label, '40px');
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
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-2px_12px_rgba(0,0,0,0.04)] px-2 py-1 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 4px), calc(var(--safe-area-inset-bottom, 0px) + 4px), 6px)',
        }}
      >
        <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none">
          {renderNotchCurve()}
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick, pressHandlers } = getItemDetails(id, idx);
              if (isHighlighted) {
                return renderFabButton(`${id}-${idx}`, pressHandlers, label, '34px');
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
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none">
          {renderNotchCurve()}
          {renderMinimalStatsStrip()}
          <div style={gridStyle}>
            {activeItems.map((id, idx) => {
              const { Icon, isHighlighted, isActive, label, handleClick, pressHandlers } = getItemDetails(id, idx);
              if (isHighlighted) {
                return renderFabButton(`${id}-${idx}`, pressHandlers, label, '52px');
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

  // 12. Liquid Convex Wave Peak (Dribbble 1)
  if (barStyle === 'liquid_hump') {
    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] px-3 pt-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none overflow-visible">
          {/* Animated Convex Liquid Hump Dome (Rises smoothly ABOVE the dock's top edge) */}
          <div
            className="absolute -translate-x-1/2 w-[88px] h-[17px] pointer-events-none overflow-visible transition-all duration-350 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10"
            style={{
              left: `calc(${activePercent}%)`,
              bottom: 'calc(100% + 0.375rem + 0.5px)',
              filter: 'drop-shadow(0 -3px 6px rgba(0,0,0,0.06))',
            }}
          >
            <svg viewBox="0 0 88 17" className="w-full h-full overflow-visible">
              <path
                d="M 0,17 C 18,17 26,1.5 44,1.5 C 62,1.5 70,17 88,17 L 88,19 L 0,19 Z"
                style={{ fill: dockColors.bg }}
              />
              <path
                d="M 0,17 C 18,17 26,1.5 44,1.5 C 62,1.5 70,17 88,17"
                fill="none"
                style={{ stroke: dockColors.border }}
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div ref={dockRef} className="relative w-full z-20">
            {renderMinimalStatsStrip()}
            <div style={gridStyle}>
              {activeItems.map((id, idx) => {
                const { Icon, isHighlighted, isActive: isActiveRaw, label, handleClick, pressHandlers } = getItemDetails(id, idx);
                const isItemUnderPeak = !isHighlighted && idx === effectiveIndex;
                if (isHighlighted) {
                  return renderFabButton(`${id}-${idx}`, pressHandlers, label, '44px');
                }
                return (
                  <button
                    key={`${id}-${idx}`}
                    type="button"
                    onClick={handleClick}
                    className={`bottom-tab relative flex flex-col items-center justify-center gap-0.5 min-w-0 transition-all duration-350 py-1.5 ${
                      isItemUnderPeak
                        ? 'bottom-tab-active text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                    aria-label={label}
                    aria-current={isItemUnderPeak ? 'page' : undefined}
                  >
                    <div
                      className={`w-6 h-6 flex items-center justify-center transition-all duration-350 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                        isItemUnderPeak
                          ? '-translate-y-2 scale-110 text-emerald-600 dark:text-emerald-400'
                          : 'scale-100 opacity-80'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isItemUnderPeak ? 'stroke-[2.5]' : 'stroke-2'}`} />
                    </div>
                    <span
                      className={`text-[10px] leading-none truncate max-w-[56px] transition-all duration-350 ${
                        isItemUnderPeak
                          ? 'font-bold text-emerald-600 dark:text-emerald-400 mt-0.5'
                          : 'font-medium'
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
      </div>
    );
  }

  // 13. Liquid Scoop Cradle with Floating Orb Badge (Dribbble 2)
  if (barStyle === 'liquid_dip') {
    const activeMeta = getItemDetails(activeItems[effectiveIndex] || 'dashboard', effectiveIndex);
    const ActiveIcon = activeMeta.Icon;

    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] px-3 pt-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none overflow-visible">
          {/* Downward scoop carved into the dock top edge: covers the dock border line and uses the page canvas color so it reads as one continuous wave */}
          <div
            className="absolute -translate-x-1/2 w-[98px] h-[27px] pointer-events-none overflow-hidden transition-all duration-350 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10"
            style={{
              left: `calc(${activePercent}%)`,
              top: 'calc(-0.375rem - 1px)',
            }}
          >
            <svg viewBox="0 0 98 27" className="w-full h-full overflow-visible">
              <path
                d="M 0,0 L 0,1 C 16,1 24,25 49,25 C 74,25 82,1 98,1 L 98,0 Z"
                style={{ fill: canvasBg }}
              />
            </svg>
          </div>

          {/* Elevated Floating Circular Orb Badge: positioned nestled below at top: -6px with borderRadius: 28px */}
          <div
            className="absolute -translate-x-1/2 w-10 h-10 bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center border-2 border-white dark:border-slate-800 transition-all duration-350 ease-[cubic-bezier(0.34,1.56,0.64,1)] pointer-events-none z-20"
            style={{
              left: `calc(${activePercent}%)`,
              top: '-30px',
              borderRadius: '28px',
            }}
          >
            <span key={`${activeItems[effectiveIndex]}-${currentTab}`} className="liquid-draw-icon flex items-center justify-center">
              <ActiveIcon className="w-5 h-5 stroke-[2.6]" />
            </span>
          </div>

          <div ref={dockRef} className="relative w-full z-10">
            {renderMinimalStatsStrip()}
            <div style={gridStyle}>
              {activeItems.map((id, idx) => {
                const { Icon, isHighlighted, isActive: isActiveRaw, label, handleClick, pressHandlers } = getItemDetails(id, idx);
                const isActive = !isHighlighted && idx === effectiveIndex;
                if (isHighlighted) {
                  return renderFabButton(`${id}-${idx}`, pressHandlers, label, '44px');
                }
                return (
                  <button
                    key={`${id}-${idx}`}
                    type="button"
                    onClick={handleClick}
                    className={`bottom-tab relative flex flex-col items-center justify-center gap-0.5 min-w-0 transition-all duration-300 py-1.5 ${
                      isActive
                        ? 'bottom-tab-active text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                    aria-label={label}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <div className={`w-6 h-6 flex items-center justify-center transition-all duration-300 ${isActive ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}`}>
                      <Icon className="w-5 h-5 stroke-2" />
                    </div>
                    <span
                      className={`text-[10px] leading-none truncate max-w-[56px] transition-all duration-300 ${
                        isActive
                          ? 'font-bold text-emerald-600 dark:text-emerald-400 mt-0.5'
                          : 'font-medium'
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
      </div>
    );
  }

  // 14. Liquid Neon Glow Arch (Dribbble 3)
  if (barStyle === 'liquid_glow') {
    const activeMeta = getItemDetails(activeItems[effectiveIndex] || 'dashboard', effectiveIndex);
    const ActiveIcon = activeMeta.Icon;

    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] px-3 pt-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none overflow-visible">
          {/* Animated Liquid Arch Dome (Rises smoothly ABOVE the dock's top edge) */}
          <div
            className="absolute -translate-x-1/2 w-[100px] h-[20px] pointer-events-none overflow-visible transition-all duration-350 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10"
            style={{
              left: `calc(${activePercent}%)`,
              bottom: 'calc(100% + 0.375rem + 0.5px)',
            }}
          >
            <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
              <path
                d="M 0,20 C 22,20 32,2 50,2 C 68,2 78,20 100,20 L 100,22 L 0,22 Z"
                style={{ fill: dockColors.bg }}
              />
            </svg>
          </div>

          {/* Sliding Solid Vibrant Circular Orb Button (matching Dribbble 3) */}
          <div
            className="absolute -translate-x-1/2 w-10 h-10 bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-lg shadow-emerald-600/35 transition-all duration-350 ease-[cubic-bezier(0.34,1.56,0.64,1)] pointer-events-none z-20"
            style={{
              left: `calc(${activePercent}%)`,
              top: '-10px',
              borderRadius: '28px',
            }}
          >
            <ActiveIcon className="w-5 h-5 stroke-[2.6]" />
          </div>

          <div ref={dockRef} className="relative w-full z-20">
            {renderMinimalStatsStrip()}
            <div style={gridStyle}>
              {activeItems.map((id, idx) => {
                const { Icon, isHighlighted, isActive: isActiveRaw, label, handleClick, pressHandlers } = getItemDetails(id, idx);
                const isItemUnderOrb = !isHighlighted && idx === effectiveIndex;
                if (isHighlighted) {
                  return renderFabButton(`${id}-${idx}`, pressHandlers, label, '44px');
                }
                return (
                  <button
                    key={`${id}-${idx}`}
                    type="button"
                    onClick={handleClick}
                    className={`bottom-tab relative flex flex-col items-center justify-center gap-0.5 min-w-0 transition-all duration-300 py-1.5 ${
                      isItemUnderOrb
                        ? 'bottom-tab-active text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                    aria-label={label}
                    aria-current={isItemUnderOrb ? 'page' : undefined}
                  >
                    <div
                      className={`w-6 h-6 flex items-center justify-center transition-all duration-350 ${
                        isItemUnderOrb ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
                      }`}
                    >
                      <Icon className="w-5 h-5 stroke-2" />
                    </div>
                    <span
                      className={`text-[10px] leading-none truncate max-w-[56px] transition-all duration-350 ${
                        isItemUnderOrb
                          ? 'font-bold text-emerald-600 dark:text-emerald-400 mt-0.5'
                          : 'font-medium'
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
      </div>
    );
  }

  // 16. Curved Cutout Hole with Submerged FAB (Flutter Curved Nav Bar)
  if (barStyle === 'curved_hole') {
    const targetHighlight = hasHighlight ? highlightIndex : Math.floor(buttonCount / 2);
    const holePercent = ((targetHighlight + 0.5) / buttonCount) * 100;

    return (
      <div
        className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] px-3 pt-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottom: 'none',
          paddingBottom:
            'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
        }}
      >
        <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none overflow-visible">
          {/* Deep Organic U-shaped Cutout Hole (Flutter style) carved into the top edge */}
          <div
            className="absolute -translate-x-1/2 w-[104px] h-[36px] pointer-events-none overflow-visible transition-all duration-350 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10"
            style={{
              left: `calc(${holePercent}%)`,
              top: 'calc(-0.375rem - 1px)',
            }}
          >
            <svg viewBox="0 0 104 36" className="w-full h-full overflow-visible">
              <path
                d="M 0,0 L 0,1 C 18,1 26,34 52,34 C 78,34 86,1 104,1 L 104,0 Z"
                style={{ fill: canvasBg }}
              />
            </svg>
          </div>

          <div ref={dockRef} className="relative w-full z-20">
            {renderMinimalStatsStrip()}
            <div style={gridStyle}>
              {activeItems.map((id, idx) => {
                const { Icon, isHighlighted, isActive, label, handleClick, pressHandlers } = getItemDetails(id, idx);
                if (isHighlighted) {
                  return (
                    <div key={`${id}-${idx}`} className="flex justify-center items-center relative z-20">
                      <button
                        type="button"
                        {...pressHandlers}
                        className="bottom-fab -mt-4 w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/35 border-4 border-white dark:border-slate-800 active:scale-95 transition-all"
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
                    className={`bottom-tab relative flex flex-col items-center justify-center gap-0.5 min-w-0 transition-all duration-300 py-1.5 ${
                      isActive
                        ? 'bottom-tab-active text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                    aria-label={label}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <div
                      className={`w-6 h-6 flex items-center justify-center transition-all duration-300 ${
                        isActive ? 'scale-110' : 'scale-100'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                    </div>
                    <span
                      className={`text-[10px] leading-none truncate max-w-[56px] transition-all duration-300 ${
                        isActive
                          ? 'font-bold text-emerald-600 dark:text-emerald-400 mt-0.5'
                          : 'font-medium'
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
      </div>
    );
  }

  // 15. Standard Tab Navigation with Center Quick Add (+) button (Default 'fab')
  return (
    <div
      className="bottom-action-dock fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 pt-1.5 gpu-layer lg:hidden rounded-b-none !rounded-b-none overflow-visible"
      style={{
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderBottom: 'none',
        paddingBottom:
          'max(calc(env(safe-area-inset-bottom, 0px) + 6px), calc(var(--safe-area-inset-bottom, 0px) + 6px), 8px)',
      }}
    >
      <div className="max-w-md mx-auto relative rounded-b-none !rounded-b-none">
        {renderNotchCurve()}
        {renderMinimalStatsStrip()}
        <div style={gridStyle}>
          {activeItems.map((id, idx) => {
            const { Icon, isHighlighted, isActive, label, handleClick, pressHandlers } = getItemDetails(id, idx);
            if (isHighlighted) {
              return renderFabButton(`${id}-${idx}`, pressHandlers, label, '52px');
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
