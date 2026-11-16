export type BottomBarStyle = 'fab' | 'inout';

const KEY = 'bottom_bar_style';
export const BOTTOM_BAR_STYLE_EVENT = 'bottombarstylechange';

/** 'fab' = standard bottom tabs with center (+); 'inout' = full-width dual Cash In & Out dock without tab bar. */
export function getBottomBarStyle(): BottomBarStyle {
  if (typeof window === 'undefined') return 'fab';
  return localStorage.getItem(KEY) === 'inout' ? 'inout' : 'fab';
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
