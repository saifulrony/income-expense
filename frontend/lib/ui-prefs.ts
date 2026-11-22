import { useState, useEffect } from 'react';
import { translate, APP_LANGUAGE_EVENT } from './i18n';

export type BottomBarStyle =
  | 'fab'
  | 'notch'
  | 'pill'
  | 'floating'
  | 'indicator'
  | 'inout'
  | 'dot'
  | 'glass'
  | 'bubble'
  | 'badge'
  | 'compact'
  | 'wave'
  | 'liquid_hump'
  | 'liquid_dip'
  | 'liquid_glow'
  | 'curved_hole';

const KEY = 'bottom_bar_style';
export const BOTTOM_BAR_STYLE_EVENT = 'bottombarstylechange';

export const VALID_BOTTOM_BAR_STYLES: BottomBarStyle[] = [
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

/** 
 * 'fab'         = standard bottom tabs with raised center (+); 
 * 'notch'       = curved scooped notch cutout cradling center (+); 
 * 'pill'        = modern active expanding pill capsule; 
 * 'floating'    = detached floating island dock; 
 * 'indicator'   = minimalist bar with top accent indicator line; 
 * 'inout'       = full-width dual Cash In & Out dock without tab bar;
 * 'dot'         = modern minimalist glowing dot indicator;
 * 'glass'       = liquid frosted glassmorphic translucent dock;
 * 'bubble'      = floating soft bubble pod for active tab;
 * 'badge'       = sleek fintech neon bordered badge;
 * 'compact'     = ultra-thin compact 44px dock;
 * 'wave'        = organic floating curved wave center;
 * 'liquid_hump' = fluid animated liquid convex wave peak (Dribbble wave);
 * 'liquid_dip'  = fluid animated scooped cradle with floating orb (Dribbble cradle);
 * 'liquid_glow' = fluid animated neon glow arch with vibrant orb (Dribbble glow);
 * 'curved_hole' = organic curved cutout hole cradling center (+) with body background visible around (Flutter Curved Nav).
 */
export function getBottomBarStyle(): BottomBarStyle {
  if (typeof window === 'undefined') return 'fab';
  const val = localStorage.getItem(KEY) as BottomBarStyle;
  if (VALID_BOTTOM_BAR_STYLES.includes(val)) {
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

const PRIVACY_MODE_KEY = 'cashflow_privacy_mode';
export const PRIVACY_MODE_EVENT = 'privacymodechange';

export function getPrivacyMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PRIVACY_MODE_KEY) === 'true';
}

export function applyPrivacyMode(enabled?: boolean) {
  if (typeof window === 'undefined') return;
  const active = typeof enabled === 'boolean' ? enabled : getPrivacyMode();
  if (active) {
    document.documentElement.setAttribute('data-privacy-mode', 'true');
  } else {
    document.documentElement.removeAttribute('data-privacy-mode');
  }
}

export function setPrivacyMode(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRIVACY_MODE_KEY, enabled ? 'true' : 'false');
  applyPrivacyMode(enabled);
  window.dispatchEvent(new CustomEvent(PRIVACY_MODE_EVENT, { detail: enabled }));
}

export function usePrivacyMode(): [boolean, (val: boolean) => void] {
  const [privacy, setPrivacyState] = useState<boolean>(false);

  useEffect(() => {
    const initial = getPrivacyMode();
    setPrivacyState(initial);
    applyPrivacyMode(initial);

    const handleChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const next = typeof detail === 'boolean' ? detail : getPrivacyMode();
      setPrivacyState(next);
      applyPrivacyMode(next);
    };

    window.addEventListener(PRIVACY_MODE_EVENT, handleChange);
    window.addEventListener('storage', handleChange);
    return () => {
      window.removeEventListener(PRIVACY_MODE_EVENT, handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

  const update = (val: boolean) => {
    setPrivacyMode(val);
    setPrivacyState(val);
  };

  return [privacy, update];
}

export type AutoLockTimeout = 'immediate' | '1m' | '5m' | 'launch_only';

const AUTO_LOCK_KEY = 'cashflow_auto_lock_timeout';
export const AUTO_LOCK_EVENT = 'cashflow_autolock_change';
export const LOCK_APP_NOW_EVENT = 'cashflow_lock_app_now';

export function getAutoLockTimeout(): AutoLockTimeout {
  if (typeof window === 'undefined') return 'launch_only';
  const val = localStorage.getItem(AUTO_LOCK_KEY);
  if (val === 'immediate' || val === '1m' || val === '5m' || val === 'launch_only') {
    return val;
  }
  return 'launch_only';
}

export function setAutoLockTimeout(timeout: AutoLockTimeout) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTO_LOCK_KEY, timeout);
  window.dispatchEvent(new CustomEvent(AUTO_LOCK_EVENT, { detail: timeout }));
}

export function triggerLockAppNow() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LOCK_APP_NOW_EVENT));
}

export type QuickAddTrigger = 'single_tap' | 'long_press' | 'direct';

const QUICK_ADD_TRIGGER_KEY = 'cashflow_quick_add_trigger';
export const QUICK_ADD_TRIGGER_EVENT = 'cashflowquickaddtriggerchange';

export function getQuickAddTrigger(): QuickAddTrigger {
  if (typeof window === 'undefined') return 'long_press';
  const val = localStorage.getItem(QUICK_ADD_TRIGGER_KEY) as QuickAddTrigger;
  if (val === 'single_tap' || val === 'long_press' || val === 'direct') {
    return val;
  }
  return 'long_press';
}

export function setQuickAddTrigger(trigger: QuickAddTrigger) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(QUICK_ADD_TRIGGER_KEY, trigger);
  window.dispatchEvent(new CustomEvent(QUICK_ADD_TRIGGER_EVENT, { detail: trigger }));
}

export function useQuickAddTrigger(): QuickAddTrigger {
  const [trigger, setTrigger] = useState<QuickAddTrigger>(() => getQuickAddTrigger());

  useEffect(() => {
    setTrigger(getQuickAddTrigger());
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as QuickAddTrigger | undefined;
      setTrigger(detail || getQuickAddTrigger());
    };
    window.addEventListener(QUICK_ADD_TRIGGER_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(QUICK_ADD_TRIGGER_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return trigger;
}
