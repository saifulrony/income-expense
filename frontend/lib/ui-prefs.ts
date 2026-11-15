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
