'use client';

import { useState, useEffect } from 'react';
import {
  Home,
  ListFilter,
  Calendar,
  BellRing,
  ShoppingBag,
  PieChart,
  Target,
  HandCoins,
  Tag,
  Shield,
  Calculator,
  FileText,
  Settings,
  Trash2,
  Plus,
  LucideIcon,
} from 'lucide-react';

export type BottomNavActionId =
  | 'add'
  | 'dashboard'
  | 'history'
  | 'calendar'
  | 'reminders'
  | 'shopping'
  | 'analytics'
  | 'goals'
  | 'debts'
  | 'categories'
  | 'warranties'
  | 'calculator'
  | 'notes'
  | 'settings'
  | 'trash';

export interface BottomNavItemMeta {
  id: BottomNavActionId;
  labelKey: string;
  defaultLabel: string;
  icon: LucideIcon;
  isAction?: boolean;
}

export const AVAILABLE_NAV_ITEMS: BottomNavItemMeta[] = [
  { id: 'add', labelKey: 'quickAdd', defaultLabel: 'Quick Add (+)', icon: Plus, isAction: true },
  { id: 'dashboard', labelKey: 'home', defaultLabel: 'Home', icon: Home },
  { id: 'history', labelKey: 'cashBookHistory', defaultLabel: 'Cash Book', icon: ListFilter },
  { id: 'calendar', labelKey: 'calendar', defaultLabel: 'Calendar', icon: Calendar },
  { id: 'reminders', labelKey: 'reminders', defaultLabel: 'Reminders', icon: BellRing },
  { id: 'analytics', labelKey: 'analytics', defaultLabel: 'Analytics', icon: PieChart },
  { id: 'shopping', labelKey: 'shopping', defaultLabel: 'Shopping List', icon: ShoppingBag },
  { id: 'goals', labelKey: 'goals', defaultLabel: 'Savings Goals', icon: Target },
  { id: 'debts', labelKey: 'debts', defaultLabel: 'Debts & Loans', icon: HandCoins },
  { id: 'categories', labelKey: 'categories', defaultLabel: 'Categories', icon: Tag },
  { id: 'warranties', labelKey: 'warranties', defaultLabel: 'Warranty Tracker', icon: Shield },
  { id: 'calculator', labelKey: 'calculator', defaultLabel: 'Cash Calculator', icon: Calculator },
  { id: 'notes', labelKey: 'notes', defaultLabel: 'Notes', icon: FileText },
  { id: 'settings', labelKey: 'settings', defaultLabel: 'Settings', icon: Settings },
  { id: 'trash', labelKey: 'trash', defaultLabel: 'Recycle Bin', icon: Trash2 },
];

export interface BottomNavCustomConfig {
  buttonCount: number; // 3, 4, 5, or 6
  items: BottomNavActionId[];
  highlightIndex: number; // -1 for None, or 0 to buttonCount-1
}

export const DEFAULT_BOTTOM_NAV_CONFIG: BottomNavCustomConfig = {
  buttonCount: 5,
  items: ['dashboard', 'reminders', 'add', 'shopping', 'analytics'],
  highlightIndex: 2, // 3rd slot ('add') is highlighted like classic plus button
};

const STORAGE_KEY = 'cashflow_bottom_nav_custom_config_v2';
export const BOTTOM_NAV_CONFIG_EVENT = 'bottomnavcustomconfigchange';

export function getBottomNavConfig(): BottomNavCustomConfig {
  if (typeof window === 'undefined') return DEFAULT_BOTTOM_NAV_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.buttonCount === 'number' &&
        Array.isArray(parsed.items) &&
        typeof parsed.highlightIndex === 'number'
      ) {
        const count = Math.max(3, Math.min(6, parsed.buttonCount));
        const validItemIds = new Set(AVAILABLE_NAV_ITEMS.map((x) => x.id));
        const safeItems: BottomNavActionId[] = [];

        for (let i = 0; i < count; i++) {
          const item = parsed.items[i];
          if (item && validItemIds.has(item)) {
            safeItems.push(item);
          } else {
            safeItems.push(DEFAULT_BOTTOM_NAV_CONFIG.items[i] || 'dashboard');
          }
        }

        const safeHighlight =
          parsed.highlightIndex >= -1 && parsed.highlightIndex < count
            ? parsed.highlightIndex
            : Math.floor(count / 2);

        return {
          buttonCount: count,
          items: safeItems,
          highlightIndex: safeHighlight,
        };
      }
    }
  } catch {}
  return DEFAULT_BOTTOM_NAV_CONFIG;
}

export function setBottomNavConfig(config: BottomNavCustomConfig) {
  if (typeof window === 'undefined') return;
  const count = Math.max(3, Math.min(6, config.buttonCount));
  const safeItems = config.items.slice(0, count);

  // If fewer items than count, pad with sensible defaults
  const fallbackOrder: BottomNavActionId[] = [
    'dashboard',
    'history',
    'calendar',
    'add',
    'shopping',
    'analytics',
  ];
  while (safeItems.length < count) {
    const next = fallbackOrder.find((id) => !safeItems.includes(id)) || 'dashboard';
    safeItems.push(next);
  }

  const safeHighlight =
    config.highlightIndex >= -1 && config.highlightIndex < count
      ? config.highlightIndex
      : -1;

  const sanitized: BottomNavCustomConfig = {
    buttonCount: count,
    items: safeItems,
    highlightIndex: safeHighlight,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  window.dispatchEvent(new CustomEvent(BOTTOM_NAV_CONFIG_EVENT, { detail: sanitized }));
}

export function useBottomNavConfig(): [
  BottomNavCustomConfig,
  (cfg: BottomNavCustomConfig) => void
] {
  const [config, setConfigState] = useState<BottomNavCustomConfig>(() => getBottomNavConfig());

  useEffect(() => {
    setConfigState(getBottomNavConfig());
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as BottomNavCustomConfig | undefined;
      setConfigState(detail || getBottomNavConfig());
    };
    window.addEventListener(BOTTOM_NAV_CONFIG_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(BOTTOM_NAV_CONFIG_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const update = (newConfig: BottomNavCustomConfig) => {
    setBottomNavConfig(newConfig);
    setConfigState(newConfig);
  };

  return [config, update];
}

export function getNavItemMeta(id: string): BottomNavItemMeta {
  return AVAILABLE_NAV_ITEMS.find((x) => x.id === id) || AVAILABLE_NAV_ITEMS[1];
}
