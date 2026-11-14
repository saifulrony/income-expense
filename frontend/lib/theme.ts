export type ThemeMode = 'light' | 'dark' | 'system';

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('app_theme') as ThemeMode;
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'dark';
}

export function applyTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  
  if (mode === 'dark') {
    root.classList.add('dark');
  } else if (mode === 'light') {
    root.classList.remove('dark');
  } else {
    // system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}

export function setStoredTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('app_theme', mode);
  applyTheme(mode);
}
