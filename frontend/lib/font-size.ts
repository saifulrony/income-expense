export type FontSize = 'small' | 'normal' | 'large' | 'xlarge';

const KEY = 'system_font_size';
export const FONT_SIZE_CHANGE_EVENT = 'fontsizechange';

export interface FontSizeOption {
  id: FontSize;
  label: string;
  desc: string;
  scaleLabel: string;
}

export const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  { id: 'small', label: 'Small', desc: 'Compact view', scaleLabel: '15px' },
  { id: 'normal', label: 'Default', desc: 'Standard balance', scaleLabel: '16px' },
  { id: 'large', label: 'Large', desc: 'Comfortable reading', scaleLabel: '17px' },
  { id: 'xlarge', label: 'Extra Large', desc: 'Maximum visibility', scaleLabel: '18px' },
];

export function getStoredFontSize(): FontSize {
  if (typeof window === 'undefined') return 'normal';
  const val = localStorage.getItem(KEY);
  if (val === 'small' || val === 'normal' || val === 'large' || val === 'xlarge') {
    return val;
  }
  return 'normal';
}

export function applyFontSize(size?: FontSize) {
  if (typeof window === 'undefined') return;
  const current = size || getStoredFontSize();
  document.documentElement.setAttribute('data-font-size', current);
}

export function setStoredFontSize(size: FontSize) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, size);
  applyFontSize(size);
  window.dispatchEvent(new CustomEvent(FONT_SIZE_CHANGE_EVENT, { detail: size }));
}

