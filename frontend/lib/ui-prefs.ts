import { useState, useEffect } from 'react';
import { translate, APP_LANGUAGE_EVENT } from './i18n';

export type BottomBarStyle = 'fab' | 'notch' | 'pill' | 'floating' | 'indicator' | 'inout';

const KEY = 'bottom_bar_style';
export const BOTTOM_BAR_STYLE_EVENT = 'bottombarstylechange';

/** 
 * 'fab'       = standard bottom tabs with raised center (+); 
 * 'notch'     = curved scooped notch cutout cradling center (+); 
 * 'pill'      = modern active expanding pill capsule; 
 * 'floating'  = detached floating island dock; 
 * 'indicator' = minimalist bar with top accent indicator line; 
 * 'inout'     = full-width dual Cash In & Out dock without tab bar. 
 */
export function getBottomBarStyle(): BottomBarStyle {
  if (typeof window === 'undefined') return 'fab';
  const val = localStorage.getItem(KEY);
  if (val === 'notch' || val === 'pill' || val === 'floating' || val === 'indicator' || val === 'inout') {
    return val;
  }
  return 'fab';
}

export function setBottomBarStyle(style: BottomBarStyle) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, style);
  // Live-update any mounted BottomNav without a reload
  window.dispatchEvent(new CustomEvent(BOTTOM_BAR_STYLE_EVENT, { detail: style }));
}

export type HeaderStyle = 'classic' | 'sticky';

const HEADER_KEY = 'header_style';
export const HEADER_STYLE_EVENT = 'headerstylechange';

/**
 * 'classic' = signature floating sheet canvas at top that collapses into a compact sticky bar on scroll
 * 'sticky'  = always compact navigation bar pinned to the top of the viewport
 */
export function getHeaderStyle(): HeaderStyle {
  if (typeof window === 'undefined') return 'classic';
  return localStorage.getItem(HEADER_KEY) === 'sticky' ? 'sticky' : 'classic';
}

export function applyHeaderStyle(style?: HeaderStyle) {
  if (typeof window === 'undefined') return;
  const current = style || getHeaderStyle();
  document.documentElement.setAttribute('data-header-style', current);
}

export function setHeaderStyle(style: HeaderStyle) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HEADER_KEY, style);
  applyHeaderStyle(style);
  window.dispatchEvent(new CustomEvent(HEADER_STYLE_EVENT, { detail: style }));
}

export type StickyStatsPosition = 'bottom' | 'top' | 'off';

const STATS_POS_KEY = 'sticky_stats_position';
export const STICKY_STATS_POS_EVENT = 'stickystatsposchange';

/**
 * 'bottom' = minimal summary bar docked just above the bottom Cash In & Out buttons on scroll
 * 'top'    = minimal summary bar attached below the top sticky header on scroll
 * 'off'    = disabled
 */
export function getStickyStatsPosition(): StickyStatsPosition {
  if (typeof window === 'undefined') return 'bottom';
  const val = localStorage.getItem(STATS_POS_KEY);
  if (val === 'top' || val === 'off' || val === 'bottom') return val;
  return 'bottom';
}

export function setStickyStatsPosition(pos: StickyStatsPosition) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STATS_POS_KEY, pos);
  window.dispatchEvent(new CustomEvent(STICKY_STATS_POS_EVENT, { detail: pos }));
}

export type FlowLabelPreset = 'cash' | 'income_expense' | 'custom';

export interface FlowLabelsConfig {
  preset: FlowLabelPreset;
  inLabel: string;
  outLabel: string;
}

const FLOW_LABELS_KEY = 'flow_labels_config';
export const FLOW_LABELS_EVENT = 'flowlabelschange';

export function getFlowLabels(): FlowLabelsConfig {
  if (typeof window === 'undefined') {
    return { preset: 'cash', inLabel: 'Cash In', outLabel: 'Cash Out' };
  }
  try {
    const raw = localStorage.getItem(FLOW_LABELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.inLabel === 'string' && typeof parsed.outLabel === 'string') {
        return {
          preset: parsed.preset || 'custom',
          inLabel: parsed.inLabel.trim() || 'Cash In',
          outLabel: parsed.outLabel.trim() || 'Cash Out',
        };
      }
    }
  } catch {}
  return { preset: 'cash', inLabel: 'Cash In', outLabel: 'Cash Out' };
}

export function setFlowLabels(config: FlowLabelsConfig) {
  if (typeof window === 'undefined') return;
  const normalized: FlowLabelsConfig = {
    preset: config.preset,
    inLabel:
      config.preset === 'cash'
        ? 'Cash In'
        : config.preset === 'income_expense'
        ? 'Income'
        : config.inLabel.trim() || 'Cash In',
    outLabel:
      config.preset === 'cash'
        ? 'Cash Out'
        : config.preset === 'income_expense'
        ? 'Expense'
        : config.outLabel.trim() || 'Cash Out',
  };
  localStorage.setItem(FLOW_LABELS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(FLOW_LABELS_EVENT, { detail: normalized }));
}

export function useFlowLabels(): FlowLabelsConfig {
  const [labels, setLabels] = useState<FlowLabelsConfig>(() => getFlowLabels());
  const [, setLangTick] = useState(0);

  useEffect(() => {
    setLabels(getFlowLabels());
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as FlowLabelsConfig | undefined;
      setLabels(detail || getFlowLabels());
    };
    const handleLangUpdate = () => {
      setLangTick((n) => n + 1);
    };
    window.addEventListener(FLOW_LABELS_EVENT, handleUpdate);
    window.addEventListener(APP_LANGUAGE_EVENT, handleLangUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(FLOW_LABELS_EVENT, handleUpdate);
      window.removeEventListener(APP_LANGUAGE_EVENT, handleLangUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  if (labels.preset === 'cash') {
    return {
      preset: 'cash',
      inLabel: translate('cashIn'),
      outLabel: translate('cashOut'),
    };
  }
  if (labels.preset === 'income_expense') {
    return {
      preset: 'income_expense',
      inLabel: translate('income'),
      outLabel: translate('expense'),
    };
  }
  return labels;
}
