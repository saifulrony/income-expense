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
