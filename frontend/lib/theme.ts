export type ThemeMode = 'light' | 'dark' | 'volt' | 'forest' | 'ocean' | 'amethyst' | 'sunset' | 'system';

export const ALL_THEME_MODES: ThemeMode[] = ['light', 'dark', 'volt', 'forest', 'ocean', 'amethyst', 'sunset', 'system'];

export const DEFAULT_FOREST_HEADER_COLOR = '#81b9a1';

export function getForestHeaderColor(): string {
  if (typeof window === 'undefined') return DEFAULT_FOREST_HEADER_COLOR;
  return localStorage.getItem('forest_header_color') || DEFAULT_FOREST_HEADER_COLOR;
}

export function setForestHeaderColor(color: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('forest_header_color', color);
  document.documentElement.style.setProperty('--forest-header-bg', color);
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'volt';
  const stored = localStorage.getItem('app_theme') as ThemeMode;
  if (ALL_THEME_MODES.includes(stored)) {
    return stored;
  }
  return 'volt';
}

export function applyTheme(mode?: ThemeMode) {
  if (typeof window === 'undefined') return;
  const currentMode = mode || getStoredTheme();
  const root = document.documentElement;
  
  root.classList.remove('theme-volt', 'theme-light', 'theme-forest', 'theme-ocean', 'theme-amethyst', 'theme-sunset');

  // Synchronize Forest header accent color CSS variable
  const forestColor = getForestHeaderColor();
  root.style.setProperty('--forest-header-bg', forestColor);

  if (currentMode === 'volt') {
    root.classList.add('dark', 'theme-volt');
  } else if (currentMode === 'forest') {
    root.classList.remove('dark');
    root.classList.add('theme-forest');
  } else if (currentMode === 'ocean') {
    root.classList.add('dark', 'theme-ocean');
  } else if (currentMode === 'amethyst') {
    root.classList.add('dark', 'theme-amethyst');
  } else if (currentMode === 'sunset') {
    root.classList.remove('dark');
    root.classList.add('theme-sunset');
  } else if (currentMode === 'dark') {
    root.classList.add('dark');
  } else if (currentMode === 'light') {
    root.classList.remove('dark');
    root.classList.add('theme-light');
  } else {
    // system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('theme-light');
    }
  }
}

export function setStoredTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('app_theme', mode);
  applyTheme(mode);
}
