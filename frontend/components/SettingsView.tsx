'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { flushSync } from 'react-dom';
import { User, BackupLog, Category, BudgetOverview } from '@/lib/types';
import { api, getApiUrl, setApiUrl, removeAuthToken, getAppMode, setAppMode } from '@/lib/api';
import { OfflineStorage } from '@/lib/offline-storage';
import { exportTransactionsToCSV, downloadFile } from '@/lib/csv-export';
import { GoogleDriveService, GoogleDriveFile, GoogleUserProfile } from '@/lib/google-drive';
import { getCurrencySymbol, getDecimalMode, setDecimalMode, DecimalMode } from '@/lib/currency';
import {
  Cloud,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Settings as SettingsIcon,
  Coins,
  Server,
  UserCheck,
  FolderDown,
  FolderUp,
  Target,
  Repeat,
  Lock,
  Zap,
  Tag,
  Sun,
  Moon,
  Monitor,
  KeyRound,
  Trash2,
  ShieldAlert,
  Palette,
  Wallet,
  Home,
  Calendar,
  PieChart,
  Calculator,
  BellRing,
  ShoppingBag,
  ChevronRight,
  ChevronDown,
  Camera,
  User as UserIcon,
  ShieldCheck,
  Clock,
  Check,
  Waves,
  Gem,
  Sunset,
  Plus,
  PlusCircle,
  ArrowDownLeft,
  Crown,
  Eye,
  EyeOff,
  Timer,
  Fingerprint,
  ArrowUpRight,
  Loader2,
  ALargeSmall,
  Sliders,
  Globe,
  Bell,
  AlertTriangle,
  Trophy,
  LayoutGrid,
  ListFilter,
  HandCoins,
  FileText,
  Sparkles,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  getReceiptScanMode,
  setReceiptScanMode,
  ReceiptScanMode,
  testGeminiApiKey,
} from '@/lib/receipt-scanner';
import {
  useBottomNavConfig,
  AVAILABLE_NAV_ITEMS,
  DEFAULT_BOTTOM_NAV_CONFIG,
  BottomNavActionId,
} from '@/lib/bottom-nav-config';
import {
  getNotificationPreferences,
  setNotificationPreferences,
  sendTestNotification,
  requestNotificationPermission,
  checkNotificationPermission,
  NotificationPreferences,
} from '@/lib/notifications';
import { LANGUAGE_OPTIONS, useTranslation } from '@/lib/i18n';
import {
  BottomBarStyle,
  getBottomBarStyle,
  setBottomBarStyle,
  HeaderStyle,
  getHeaderStyle,
  setHeaderStyle,
  StickyStatsPosition,
  getStickyStatsPosition,
  setStickyStatsPosition,
  FlowLabelPreset,
  FlowLabelsConfig,
  getFlowLabels,
  setFlowLabels,
  usePrivacyMode,
  AutoLockTimeout,
  getAutoLockTimeout,
  setAutoLockTimeout,
  triggerLockAppNow,
  QuickAddTrigger,
  getQuickAddTrigger,
  setQuickAddTrigger,
  QUICK_ADD_TRIGGER_EVENT,
} from '@/lib/ui-prefs';
import { triggerHaptic } from '@/lib/haptics';
import { isBiometricEnabled, enableBiometricUnlock, disableBiometric } from '@/lib/biometrics';
import { FontSize, FONT_SIZE_OPTIONS, getStoredFontSize, setStoredFontSize } from '@/lib/font-size';
import BudgetModal from './BudgetModal';
import RecurringModal from './RecurringModal';
import CategoryManagerModal from './CategoryManagerModal';
import PasswordModal from './PasswordModal';
import DeleteAccountModal from './DeleteAccountModal';
import AccountManagerModal from './AccountManagerModal';
import UpgradeProModal from './UpgradeProModal';
import PinSetupModal, { PinModalMode } from './PinSetupModal';
import { useProStatus, getCurrentTier, TIER_LIMITS } from '@/lib/billing';
import { SubAccount } from '@/lib/types';
import {
  ThemeMode,
  getStoredTheme,
  setStoredTheme,
  getForestHeaderColor,
  setForestHeaderColor,
  DEFAULT_FOREST_HEADER_COLOR
} from '@/lib/theme';
import {
  TimeFormat,
  TimeMode,
  DateFormat,
  getTimeFormat,
  setTimeFormat,
  getTimeMode,
  setTimeMode,
  getManualTime,
  setManualTime,
  getDateFormat,
  setDateFormat,
  getTimezone,
  formatTime,
  formatDate,
  getEffectiveCurrentTime,
} from '@/lib/time-settings';

interface SettingsViewProps {
  user: User;
  categories: Category[];
  accounts: SubAccount[];
  activeAccountId: string;
  budgetOverview: BudgetOverview | null;
  onUpdateUser: (user: User) => void;
  onSelectAccount: (id: string) => void;
  onRefreshAccounts: () => void;
  onLogout: () => void;
  onDataRestored: () => void;
  onOpenTrash?: () => void;
  onNavigateToCategories?: () => void;
  deletedCount?: number;
}

type SubPage = 'main' | 'theme' | 'backup' | 'security' | 'account' | 'ledgers' | 'datetime' | 'ai';

const THEME_NAMES: Record<ThemeMode, string> = {
  forest: 'Forest Sheet',
  volt: 'Volt (Dribbble)',
  dark: 'Obsidian Slate',
  light: 'Light (Forest)',
  ocean: 'Midnight Ocean',
  amethyst: 'Royal Amethyst',
  sunset: 'Sunset Coral',
  system: 'System Auto',
};

const LiveDigitalClock = React.memo(function LiveDigitalClock({
  timeFormat,
  dateFormat,
  timeMode,
  manualTime,
}: {
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  timeMode: TimeMode;
  manualTime: string;
}) {
  const [clockTime, setClockTime] = useState<Date>(() => getEffectiveCurrentTime());

  useEffect(() => {
    setClockTime(getEffectiveCurrentTime());
    const timer = setInterval(() => {
      setClockTime(getEffectiveCurrentTime());
    }, 1000);
    return () => clearInterval(timer);
  }, [timeMode, manualTime]);

  return (
    <div className="py-3 px-4 text-center bg-slate-50 dark:bg-slate-900/60 rounded-[10px] border border-slate-100 dark:border-slate-800">
      <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
        {formatTime(clockTime, timeFormat)}
      </div>
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 font-mono">
        {formatDate(clockTime, dateFormat)} • {clockTime.toLocaleDateString('en-US', { weekday: 'long' })}
      </div>
    </div>
  );
});

export const HEADER_COLOR_PRESETS = [
  { name: 'Sage Mist', hex: '#81b9a1' },
  { name: 'Pine Mid', hex: '#4a7c59' },
  { name: 'Emerald', hex: '#2d6a4f' },
  { name: 'Forest', hex: '#24523b' },
  { name: 'Dark Jade', hex: '#1b4332' },
  { name: 'Ocean Slate', hex: '#3a6b7c' },
  { name: 'Terracotta', hex: '#9c593f' },
  { name: 'Plum Fig', hex: '#5a3d52' },
];

export default function SettingsView({
  user,
  categories,
  accounts,
  activeAccountId,
  budgetOverview,
  onUpdateUser,
  onSelectAccount,
  onRefreshAccounts,
  onLogout,
  onDataRestored,
  onOpenTrash,
  onNavigateToCategories,
  deletedCount = 0,
}: SettingsViewProps) {
  const { lang, setLang, t } = useTranslation();
  // Navigation Sub-Page state
  const [subPage, setSubPage] = useState<SubPage>('main');

  // Google Drive state
  const [driveToken, setDriveToken] = useState<string>('');
  const [driveProfile, setDriveProfile] = useState<GoogleUserProfile | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [showClientIdConfig, setShowClientIdConfig] = useState(false);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [autoDriveSync, setAutoDriveSync] = useState(false);
  const [driveBackups, setDriveBackups] = useState<GoogleDriveFile[]>([]);
  const [showDriveList, setShowDriveList] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isResetDataModalOpen, setIsResetDataModalOpen] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const proStatus = useProStatus();
  const [privacyMode, setPrivacyMode] = usePrivacyMode();
  const [autoLockTimeout, setAutoLockTimeoutState] = useState<AutoLockTimeout>(() => getAutoLockTimeout());
  const [biometricEnabled, setBiometricEnabledState] = useState<boolean>(() => isBiometricEnabled());
  const [pinModalState, setPinModalState] = useState<{ open: boolean; mode: PinModalMode }>({
    open: false,
    mode: 'setup',
  });
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResettingData, setIsResettingData] = useState(false);
  const [geminiKey, setGeminiKeyState] = useState<string>(() => getGeminiApiKey());
  const [scanMode, setScanModeState] = useState<ReceiptScanMode>(() => getReceiptScanMode());
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [testApiResult, setTestApiResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Theme & Appearance
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [decimalMode, setDecimalModeState] = useState<DecimalMode>('2');

  // System Font Size
  const [fontSize, setFontSizeState] = useState<FontSize>('normal');

  useEffect(() => {
    setFontSizeState(getStoredFontSize());
  }, []);

  const handleFontSizeChange = (size: FontSize) => {
    setFontSizeState(size);
    setStoredFontSize(size);
  };

  // Quick Add (+) Trigger Behavior
  const [quickAddTrigger, setQuickAddTriggerState] = useState<QuickAddTrigger>(() => getQuickAddTrigger());

  useEffect(() => {
    setQuickAddTriggerState(getQuickAddTrigger());
    const handleQuickAddChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as QuickAddTrigger | undefined;
      if (detail) setQuickAddTriggerState(detail);
    };
    window.addEventListener(QUICK_ADD_TRIGGER_EVENT, handleQuickAddChange);
    return () => window.removeEventListener(QUICK_ADD_TRIGGER_EVENT, handleQuickAddChange);
  }, []);

  const handleQuickAddTriggerChange = (trigger: QuickAddTrigger) => {
    triggerHaptic('light');
    setQuickAddTriggerState(trigger);
    setQuickAddTrigger(trigger);
  };

  // Bottom bar quick-action style (mobile)
  const [bottomBarStyle, setBottomBarStyleState] = useState<BottomBarStyle>('fab');
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  const styleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBottomBarStyleState(getBottomBarStyle());
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (styleDropdownRef.current && !styleDropdownRef.current.contains(event.target as Node)) {
        setIsStyleDropdownOpen(false);
      }
    }
    if (isStyleDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isStyleDropdownOpen]);

  const handleBottomBarStyleChange = (style: BottomBarStyle) => {
    setBottomBarStyleState(style);
    setBottomBarStyle(style);
    setIsStyleDropdownOpen(false);
  };

  // Bottom Navigation Buttons & Layout Customization
  const [navConfig, setNavConfig] = useBottomNavConfig();

  const handleButtonCountChange = (count: number) => {
    triggerHaptic('light');
    const safeCount = Math.max(3, Math.min(6, count));
    const newItems = [...navConfig.items];
    const fallbackOrder: BottomNavActionId[] = [
      'dashboard',
      'history',
      'calendar',
      'add',
      'shopping',
      'analytics',
      'reminders',
      'goals',
    ];
    while (newItems.length < safeCount) {
      const next = fallbackOrder.find((id) => !newItems.includes(id)) || 'dashboard';
      newItems.push(next);
    }
    const safeHighlight =
      navConfig.highlightIndex >= safeCount
        ? Math.floor(safeCount / 2)
        : navConfig.highlightIndex;

    setNavConfig({
      buttonCount: safeCount,
      items: newItems.slice(0, safeCount),
      highlightIndex: safeHighlight,
    });
  };

  const handleSlotItemChange = (slotIndex: number, itemId: BottomNavActionId) => {
    triggerHaptic('light');
    const newItems = [...navConfig.items];
    newItems[slotIndex] = itemId;
    setNavConfig({
      ...navConfig,
      items: newItems,
    });
  };

  const handleToggleSlotHighlight = (slotIndex: number) => {
    triggerHaptic('light');
    setNavConfig({
      ...navConfig,
      highlightIndex: navConfig.highlightIndex === slotIndex ? -1 : slotIndex,
    });
  };

  const handleResetNavConfig = () => {
    triggerHaptic('medium');
    setNavConfig(DEFAULT_BOTTOM_NAV_CONFIG);
  };

  // Header Style (Classic Floating Sheet vs Sticky Bar)
  const [headerStyle, setHeaderStyleState] = useState<HeaderStyle>('classic');
  const [stickyStatsPos, setStickyStatsPosState] = useState<StickyStatsPosition>('bottom');
  const [flowLabels, setFlowLabelsState] = useState<FlowLabelsConfig>({
    preset: 'cash',
    inLabel: 'Cash In',
    outLabel: 'Cash Out',
  });
  const [customInInput, setCustomInInput] = useState<string>('Cash In');
  const [customOutInput, setCustomOutInput] = useState<string>('Cash Out');

  useEffect(() => {
    setHeaderStyleState(getHeaderStyle());
    setStickyStatsPosState(getStickyStatsPosition());
    const storedLabels = getFlowLabels();
    setFlowLabelsState(storedLabels);
    setCustomInInput(storedLabels.inLabel);
    setCustomOutInput(storedLabels.outLabel);
  }, []);

  const handleFlowPresetChange = (preset: FlowLabelPreset) => {
    const next: FlowLabelsConfig =
      preset === 'cash'
        ? { preset: 'cash', inLabel: 'Cash In', outLabel: 'Cash Out' }
        : preset === 'income_expense'
          ? { preset: 'income_expense', inLabel: 'Income', outLabel: 'Expense' }
          : {
            preset: 'custom',
            inLabel: customInInput.trim() || flowLabels.inLabel || 'Cash In',
            outLabel: customOutInput.trim() || flowLabels.outLabel || 'Cash Out',
          };
    setFlowLabelsState(next);
    setCustomInInput(next.inLabel);
    setCustomOutInput(next.outLabel);
    setFlowLabels(next);
  };

  const handleCustomFlowLabelsChange = (inVal: string, outVal: string) => {
    setCustomInInput(inVal);
    setCustomOutInput(outVal);
    const next: FlowLabelsConfig = {
      preset: 'custom',
      inLabel: inVal.trim() || 'Cash In',
      outLabel: outVal.trim() || 'Cash Out',
    };
    setFlowLabelsState(next);
    setFlowLabels(next);
  };

  const handleHeaderStyleChange = (style: HeaderStyle) => {
    setHeaderStyleState(style);
    setHeaderStyle(style);
  };

  const handleStickyStatsPosChange = (pos: StickyStatsPosition) => {
    setStickyStatsPosState(pos);
    setStickyStatsPosition(pos);
  };

  useEffect(() => {
    setDecimalModeState(getDecimalMode());
    const handleDecimalUpdate = () => {
      setDecimalModeState(getDecimalMode());
    };
    window.addEventListener('decimal_mode_changed', handleDecimalUpdate);
    return () => window.removeEventListener('decimal_mode_changed', handleDecimalUpdate);
  }, []);

  // Time & Date Preferences
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>('12h');
  const [timeMode, setTimeModeState] = useState<TimeMode>('auto');
  const [manualTime, setManualTimeState] = useState<string>('12:00');
  const [dateFormat, setDateFormatState] = useState<DateFormat>('YYYY-MM-DD');

  // Security PIN
  const [appPin, setAppPin] = useState('');
  const [isPinSet, setIsPinSet] = useState(false);

  // Currency, Name & API URL
  const [currency, setCurrency] = useState(user.currency || 'USD');
  const [fullName, setFullName] = useState(user.full_name || '');
  const [apiUrl, setApiUrlState] = useState('');
  const [isDriveExpanded, setIsDriveExpanded] = useState(false);

  // Forest theme custom header accent color
  const [forestColor, setForestColor] = useState<string>(DEFAULT_FOREST_HEADER_COLOR);
  const [customHexInput, setCustomHexInput] = useState<string>(DEFAULT_FOREST_HEADER_COLOR);

  // Smart Notifications Preferences
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(getNotificationPreferences());
  const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'default'>('default');

  useEffect(() => {
    checkNotificationPermission().then(setNotifPermission);
  }, []);

  const handleToggleNotifMaster = async (enabled: boolean) => {
    triggerHaptic('light');
    if (enabled) {
      const granted = await requestNotificationPermission();
      setNotifPermission(granted ? 'granted' : 'denied');
    }
    const updated = { ...notifPrefs, enabled };
    setNotifPrefs(updated);
    setNotificationPreferences(updated);
    setMessage({
      type: 'success',
      text: enabled ? 'Smart notifications enabled!' : 'Notifications stopped.',
    });
  };

  const handleUpdateNotifSubPref = (key: keyof NotificationPreferences, value: boolean) => {
    triggerHaptic('light');
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    setNotificationPreferences(updated);
  };

  const handleSendTestNotification = async () => {
    triggerHaptic('medium');
    await requestNotificationPermission();
    await sendTestNotification(getCurrencySymbol(currency));
    setMessage({ type: 'success', text: 'Test notification triggered!' });
  };

  useEffect(() => {
    // Read URL hash on load (e.g. #theme, #datetime, #backup, #security, #account, #ledgers)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (['theme', 'backup', 'security', 'account', 'ledgers', 'datetime', 'time', 'ai'].includes(hash)) {
        setSubPage(hash === 'time' ? 'datetime' : (hash as SubPage));
      }

      const handleHashChange = () => {
        const h = window.location.hash.replace('#', '');
        if (['theme', 'backup', 'security', 'account', 'ledgers', 'datetime', 'time', 'ai'].includes(h)) {
          setSubPage(h === 'time' ? 'datetime' : (h as SubPage));
        } else {
          setSubPage('main');
        }
      };
      window.addEventListener('hashchange', handleHashChange);

      // Load time settings
      setTimeFormatState(getTimeFormat());
      setTimeModeState(getTimeMode());
      setManualTimeState(getManualTime());
      setDateFormatState(getDateFormat());

      // Load stored Google token & profile
      const token = GoogleDriveService.getAccessToken();
      const profile = GoogleDriveService.getUserProfile();
      const savedClientId = GoogleDriveService.getClientId();
      if (savedClientId) setGoogleClientId(savedClientId);
      if (token) {
        setDriveToken(token);
        setDriveProfile(profile);
        setIsDriveConnected(true);
      }

      // Load auto sync preference & Theme
      const autoSync = localStorage.getItem('auto_drive_sync') === 'true';
      setAutoDriveSync(autoSync);

      const savedPin = localStorage.getItem('app_security_pin');
      if (savedPin) {
        setAppPin(savedPin);
        setIsPinSet(true);
      }

      setThemeMode(getStoredTheme());
      setForestColor(getForestHeaderColor());
      setCustomHexInput(getForestHeaderColor());

      // Load API URL
      getApiUrl().then(setApiUrlState);

      // Load Gemini API Key & Scan Mode
      setGeminiKeyState(getGeminiApiKey());
      setScanModeState(getReceiptScanMode());

      return () => {
        window.removeEventListener('hashchange', handleHashChange);
      };
    }
  }, []);

  const navigateTo = (page: SubPage) => {
    setSubPage(page);
    if (typeof window !== 'undefined') {
      if (page === 'main') {
        window.history.pushState(null, '', window.location.pathname);
      } else {
        window.location.hash = page;
      }
    }
  };

  const handleThemeChange = (mode: ThemeMode, e?: React.MouseEvent<HTMLButtonElement>) => {
    if (mode === themeMode) return;

    const x = e ? e.clientX : typeof window !== 'undefined' ? window.innerWidth / 2 : 200;
    const y = e ? e.clientY : typeof window !== 'undefined' ? window.innerHeight / 3 : 200;
    const endRadius =
      typeof window !== 'undefined'
        ? Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
        : 1000;

    const applySwitch = () => {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.add('disable-transitions');
      }
      flushSync(() => {
        setThemeMode(mode);
        setStoredTheme(mode);
      });
      if (typeof document !== 'undefined') {
        void document.documentElement.offsetHeight;
      }
    };

    const doc = typeof document !== 'undefined' ? (document as any) : null;
    if (doc && typeof doc.startViewTransition === 'function') {
      try {
        const transition = doc.startViewTransition(() => {
          applySwitch();
        });
        transition.ready
          .then(() => {
            document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${endRadius}px at ${x}px ${y}px)`,
                ],
              },
              {
                duration: 320,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                pseudoElement: '::view-transition-new(root)',
              }
            );
          })
          .catch(() => { });
        transition.finished.finally(() => {
          document.documentElement.classList.remove('disable-transitions');
        });
        return;
      } catch { }
    }

    // Fallback: Pure instant 1-frame switch without loader
    applySwitch();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof document !== 'undefined') {
          document.documentElement.classList.remove('disable-transitions');
        }
      });
    });
  };

  const handleForestColorChange = (newColor: string, e?: React.MouseEvent<HTMLButtonElement>) => {
    setForestColor(newColor);
    setCustomHexInput(newColor);
    setForestHeaderColor(newColor);
    if (themeMode !== 'forest') {
      handleThemeChange('forest', e);
    }
  };

  const handleTimeFormatChange = (fmt: TimeFormat) => {
    setTimeFormatState(fmt);
    setTimeFormat(fmt);
    setMessage({
      type: 'success',
      text: `Time format updated to ${fmt === '12h' ? '12-Hour (AM/PM)' : '24-Hour'}`,
    });
  };

  const handleTimeModeChange = (mode: TimeMode) => {
    setTimeModeState(mode);
    setTimeMode(mode);
    setMessage({
      type: 'success',
      text: mode === 'auto' ? 'Time mode set to Automatic (Device Clock).' : 'Time mode set to Manual Mode.',
    });
  };

  const handleSaveManualTime = (newTime: string) => {
    setManualTimeState(newTime);
    setManualTime(newTime);
    setMessage({
      type: 'success',
      text: `Manual time set to ${newTime}`,
    });
  };

  const handleDateFormatChange = (df: DateFormat) => {
    setDateFormatState(df);
    setDateFormat(df);
    setMessage({
      type: 'success',
      text: `Date format updated to ${df}`,
    });
  };

  const handleGoogleSignIn = async () => {
    setMessage(null);
    const effectiveClientId = googleClientId.trim() || GoogleDriveService.getClientId();
    if (!effectiveClientId) {
      await handleSaveToPersonalDriveFolder();
      return;
    }

    try {
      setIsDriveConnecting(true);
      const res = await GoogleDriveService.signInWithGoogle(effectiveClientId);
      setDriveToken(res.token);
      setDriveProfile(res.profile);
      setIsDriveConnected(true);
      setAutoDriveSync(true);
      localStorage.setItem('auto_drive_sync', 'true');
      setShowClientIdConfig(false);
      setMessage({
        type: 'success',
        text: `Connected to Google Drive${res.profile?.name ? ` as ${res.profile.name}` : ''}! Auto-sync is active.`,
      });
      try {
        const files = await GoogleDriveService.listBackups(res.token);
        setDriveBackups(files);
      } catch (e) { }
    } catch (err: any) {
      if (err.message === 'MISSING_CLIENT_ID') {
        await handleSaveToPersonalDriveFolder();
      } else {
        setMessage({
          type: 'error',
          text: err.message || 'Failed to sign in with Google.',
        });
      }
    } finally {
      setIsDriveConnecting(false);
    }
  };

  const handleDisconnectDrive = () => {
    GoogleDriveService.disconnect();
    setDriveToken('');
    setDriveProfile(null);
    setIsDriveConnected(false);
    setAutoDriveSync(false);
    setDriveBackups([]);
    setMessage({ type: 'success', text: 'Disconnected from Google Drive.' });
  };

  const handleSaveClientId = () => {
    if (!googleClientId.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid Google OAuth Client ID.' });
      return;
    }
    GoogleDriveService.setClientId(googleClientId.trim());
    setMessage({ type: 'success', text: 'Google Client ID saved! Now tap Sign in with Google.' });
    setShowClientIdConfig(false);
  };

  const handleSaveDriveToken = () => {
    if (!driveToken.trim()) {
      GoogleDriveService.clearAccessToken();
      setIsDriveConnected(false);
      setMessage({ type: 'success', text: 'Google Drive disconnected.' });
      return;
    }
    GoogleDriveService.setAccessToken(driveToken.trim());
    setIsDriveConnected(true);
    setMessage({ type: 'success', text: 'Google Drive token saved!' });
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoDriveSync(enabled);
    localStorage.setItem('auto_drive_sync', enabled ? 'true' : 'false');
    setMessage({
      type: 'success',
      text: enabled ? 'Automated Drive sync enabled.' : 'Automated Drive sync disabled.',
    });
  };

  const handleBackupToDrive = async () => {
    try {
      setBackupLoading(true);
      setMessage(null);

      let activeToken = isDriveConnected && driveToken.trim() ? driveToken.trim() : '';

      // Cash Book style: if not connected yet, automatically prompt Google Account Picker
      // if an OAuth Client ID is present, or fall back to native OS/Drive Share & Save!
      if (!activeToken) {
        const effectiveClientId = googleClientId.trim() || GoogleDriveService.getClientId();
        if (effectiveClientId) {
          const authRes = await GoogleDriveService.signInWithGoogle(effectiveClientId);
          activeToken = authRes.token;
          setDriveToken(authRes.token);
          setDriveProfile(authRes.profile);
          setIsDriveConnected(true);
          setAutoDriveSync(true);
          localStorage.setItem('auto_drive_sync', 'true');
        } else {
          await handleSaveToPersonalDriveFolder();
          return;
        }
      }

      const backupData = await api.exportBackup();
      const res = await GoogleDriveService.uploadBackup(backupData, activeToken);

      await api.recordBackupLog({
        file_id: res.id,
        file_name: res.name,
        record_size: 0,
      });

      setMessage({ type: 'success', text: `Backed up to Google Drive (${res.name})` });
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setMessage({ type: 'error', text: err.message || 'Google Drive backup failed.' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleListDriveBackups = async () => {
    if (!isDriveConnected || !driveToken.trim()) {
      setIsDriveExpanded(true);
      setMessage({ type: 'error', text: 'Please connect Google Drive first.' });
      return;
    }

    try {
      setRestoreLoading(true);
      setMessage(null);
      const files = await GoogleDriveService.listBackups(driveToken.trim());
      setDriveBackups(files);
      setShowDriveList(true);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to list Google Drive backups.' });
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleRestoreFromDrive = async (fileId: string) => {
    if (!confirm('Restore from this backup? Existing data will be overwritten.')) return;

    try {
      setRestoreLoading(true);
      setMessage(null);
      const payload = await GoogleDriveService.downloadBackup(fileId, driveToken.trim());
      const res = await api.importBackup(payload);

      await api.recordBackupLog({
        file_id: fileId,
        file_name: 'Restored snapshot',
        record_size: 0,
      });

      setMessage({
        type: 'success',
        text: `Restored ${res.restored_transactions} transactions successfully!`,
      });
      setShowDriveList(false);
      onDataRestored();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Restore failed.' });
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleDownloadCSVBackup = async () => {
    try {
      const data = await api.exportBackup();
      const txs = data?.transactions || [];
      if (txs.length === 0) {
        setMessage({ type: 'error', text: 'No transactions found to export to CSV.' });
        return;
      }
      const filename = `income_expense_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
      const res = await exportTransactionsToCSV(txs, filename, currency);
      if (res.success) {
        setMessage({ type: 'success', text: `Downloaded ${res.count} transactions as CSV!` });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to download CSV.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to export transactions to CSV.' });
    }
  };

  const handleDownloadLocalBackup = async () => {
    try {
      const data = await api.exportBackup();
      const filename = `income_expense_backup_${new Date().toISOString().slice(0, 10)}.json`;
      const ok = await downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
      if (ok) {
        setMessage({ type: 'success', text: 'Local backup JSON downloaded successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to download local backup file.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to download local backup file.' });
    }
  };

  const handleSaveToPersonalDriveFolder = async () => {
    try {
      const data = await api.exportBackup();
      const fileName = `income_expense_backup_${new Date().toISOString().slice(0, 10)}.json`;
      const jsonStr = JSON.stringify(data, null, 2);

      // 1. Mobile Native Share Sheet (Android / iOS -> "Save to Drive" -> pick any personal folder)
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const jsonFile = new File([jsonStr], fileName, { type: 'application/json' });
        const canShareJson = typeof navigator.canShare === 'function' && navigator.canShare({ files: [jsonFile] });
        if (canShareJson) {
          await navigator.share({
            files: [jsonFile],
            title: fileName,
            text: 'Save backup to your personal Google Drive folder',
          });
          setMessage({ type: 'success', text: 'Backup shared! Select Google Drive and choose your folder.' });
          return;
        }

        const txtFile = new File([jsonStr], fileName, { type: 'text/plain' });
        const canShareTxt = typeof navigator.canShare === 'function' && navigator.canShare({ files: [txtFile] });
        if (canShareTxt) {
          await navigator.share({
            files: [txtFile],
            title: fileName,
            text: 'Save backup to your personal Google Drive folder',
          });
          setMessage({ type: 'success', text: 'Backup shared! Select Google Drive and choose your folder.' });
          return;
        }
      }

      // 2. Native OS Save File Picker (Desktop Chrome / Edge / supported Android browsers)
      if (typeof window !== 'undefined' && typeof (window as any).showSaveFilePicker === 'function') {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'JSON Backup File',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        setMessage({ type: 'success', text: `Saved ${fileName} to your selected folder!` });
        return;
      }

      // 3. Fallback: direct browser download or native share
      await downloadFile(jsonStr, fileName, 'application/json');
      setMessage({
        type: 'success',
        text: `Downloaded ${fileName}. You can now move or upload it to your Google Drive folder.`,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // User closed the share sheet or folder picker
      setMessage({ type: 'error', text: 'Could not save backup file.' });
    }
  };

  const handleUploadLocalBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await api.importBackup(payload);
      setMessage({
        type: 'success',
        text: `Restored ${res.restored_transactions} transactions from file!`,
      });
      onDataRestored();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Invalid backup file format.' });
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmResetAllData = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (resetConfirmText.trim().toLowerCase() !== 'delete all') return;
    try {
      setIsResettingData(true);
      await api.resetAllData();
      onSelectAccount('all');
      onRefreshAccounts();
      onDataRestored();
      setIsResetDataModalOpen(false);
      setResetConfirmText('');
      setMessage({
        type: 'success',
        text: 'All transactions, budgets, and custom data have been permanently deleted.',
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'Failed to delete all data.',
      });
    } finally {
      setIsResettingData(false);
    }
  };

  const handleSavePin = () => {
    if (appPin.length === 4) {
      localStorage.setItem('app_security_pin', appPin);
      setIsPinSet(true);
      setMessage({ type: 'success', text: 'App Security PIN set successfully!' });
    } else if (appPin.length === 0) {
      localStorage.removeItem('app_security_pin');
      setIsPinSet(false);
      setMessage({ type: 'success', text: 'App Security PIN disabled.' });
    } else {
      setMessage({ type: 'error', text: 'PIN must be exactly 4 digits.' });
    }
  };

  const handleCurrencyChange = async (newCurr: string) => {
    setCurrency(newCurr);
    try {
      await api.updateProfile({ currency: newCurr });
      onUpdateUser({ ...user, currency: newCurr });
      setMessage({ type: 'success', text: `Default currency changed to ${getCurrencySymbol(newCurr)}` });
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update currency.' });
    }
  };

  const handleDecimalModeChange = (mode: DecimalMode) => {
    setDecimalMode(mode);
    setDecimalModeState(mode);
    setMessage({
      type: 'success',
      text: mode === '0' ? 'Decimal format set to whole numbers (e.g. 5)' : 'Decimal format set to two decimals (e.g. 5.00)',
    });
  };

  const handleSaveName = async () => {
    if (!fullName.trim()) return;
    try {
      await api.updateProfile({ full_name: fullName.trim() });
      onUpdateUser({ ...user, full_name: fullName.trim() });
      setMessage({ type: 'success', text: 'Profile name updated!' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update name.' });
    }
  };

  const handleSaveApiUrl = async () => {
    if (!apiUrl.trim()) return;
    await setApiUrl(apiUrl.trim());
    setMessage({ type: 'success', text: 'Backend API URL updated!' });
  };

  const handleSaveGeminiKey = () => {
    triggerHaptic('success');
    const trimmed = geminiKey.trim();
    setGeminiApiKey(trimmed);
    setGeminiKeyState(trimmed);
    if (trimmed) {
      setReceiptScanMode('ai');
      setScanModeState('ai');
    }
    setMessage({ type: 'success', text: 'Gemini AI Receipt Scanner key saved successfully!' });
  };

  const handleClearGeminiKey = () => {
    setGeminiApiKey('');
    setGeminiKeyState('');
    setTestApiResult(null);
    setMessage({ type: 'success', text: 'Gemini AI API Key cleared.' });
  };

  const handleScanModeChange = (mode: ReceiptScanMode) => {
    triggerHaptic('light');
    setScanModeState(mode);
    setReceiptScanMode(mode);
    setMessage({
      type: 'success',
      text: mode === 'ai' ? 'Switched to Smart AI Mode (Gemini Vision)' : 'Switched to Without AI Mode (100% Offline)',
    });
  };

  const handleTestGeminiKey = async () => {
    triggerHaptic('medium');
    setIsTestingApiKey(true);
    setTestApiResult(null);
    try {
      const res = await testGeminiApiKey(geminiKey);
      setTestApiResult(res);
      if (res.ok) {
        triggerHaptic('success');
      } else {
        triggerHaptic('warning');
      }
    } finally {
      setIsTestingApiKey(false);
    }
  };

  const handleSignOut = async () => {
    if (confirm(getAppMode() === 'offline' ? 'Exit offline session?' : 'Sign out of your account?')) {
      await removeAuthToken();
      onLogout();
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Alert banner */}
      {message && (
        <div
          className={`p-3.5 rounded-[10px] flex items-center justify-between gap-2.5 text-xs font-medium border animate-in fade-in duration-150 ${message.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}


      {/* ========================================================== */}
      {/* VIEW A: MAIN SETTINGS HUB (Compact, Organized, Minimalist) */}
      {/* ========================================================== */}
      {subPage === 'main' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-emerald-600" />
              <span>{t('settings')}</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">General Preferences</span>
          </div>

          {/* CashFlow Pro Membership Card */}
          <button
            type="button"
            onClick={() => setIsProModalOpen(true)}
            className="w-full text-left p-3.5 rounded-[12px] bg-slate-900 dark:bg-slate-800/95 hover:bg-slate-800 dark:hover:bg-slate-800 text-white border border-slate-800 dark:border-slate-700/80 shadow-sm transition-all flex items-center justify-between gap-3 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
                <Crown className="w-5 h-5 text-slate-950 fill-slate-950" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold tracking-tight flex items-center gap-2">
                  <span>{TIER_LIMITS[getCurrentTier()].name}</span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${getCurrentTier() === 'elite'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : getCurrentTier() === 'pro'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                      }`}
                  >
                    {getCurrentTier() === 'starter' ? 'UPGRADE' : 'ACTIVE'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {getCurrentTier() === 'elite'
                    ? 'CashFlow Elite • All Pro Perks + Family & Business Ledger'
                    : getCurrentTier() === 'pro'
                      ? 'CashFlow Pro • Cloud Sync • PDF Reports • Unlimited Wallets'
                      : 'Starter Plan • 2 Wallets • Upgrade for PDF Reports & Themes'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {/* 1. Language, Currency & Decimals, Transaction Labels, Date & Time */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/90 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
            {/* Language Selector */}
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{t('language')}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {t('languageDesc')}
                  </div>
                </div>
              </div>

              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as any)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500 cursor-pointer shadow-2xs shrink-0 max-w-[170px]"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.flag} {opt.nativeLabel}
                  </option>
                ))}
              </select>
            </div>

            {/* Currency Symbol */}
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Coins className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Currency</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Primary currency symbol for ledger
                  </div>
                </div>
              </div>

              <select
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold font-mono rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500 cursor-pointer shadow-2xs shrink-0"
              >
                <option value="BDT">৳ BDT (Taka)</option>
                <option value="USD">$ USD (Dollar)</option>
                <option value="EUR">€ EUR (Euro)</option>
                <option value="GBP">£ GBP (Pound)</option>
                <option value="INR">₹ INR (Rupee)</option>
              </select>
            </div>

            {/* Decimal Places */}
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                  <Coins className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Decimal Precision</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Display cents/paisa decimals
                  </div>
                </div>
              </div>

              <select
                value={decimalMode}
                onChange={(e) => handleDecimalModeChange(e.target.value as DecimalMode)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500 cursor-pointer shadow-2xs shrink-0"
              >
                <option value="2">2 Decimals (5.00)</option>
                <option value="0">No Decimals (5)</option>
              </select>
            </div>

            {/* Flow Labels: Cash In/Out vs Income/Expense vs Custom */}
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{t('transactionLabels')}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {t('transactionLabelsDesc')}
                    </div>
                  </div>
                </div>

                <select
                  value={flowLabels.preset}
                  onChange={(e) => handleFlowPresetChange(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500 cursor-pointer shadow-2xs shrink-0"
                >
                  <option value="cash">Cash In / Cash Out</option>
                  <option value="income_expense">Income / Expense</option>
                  <option value="custom">Custom Labels...</option>
                </select>
              </div>

              {flowLabels.preset === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-1 animate-in fade-in duration-150">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                      Inflow Name
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      value={customInInput}
                      onChange={(e) => handleCustomFlowLabelsChange(e.target.value, customOutInput)}
                      placeholder="e.g. Deposit"
                      className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                      Outflow Name
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      value={customOutInput}
                      onChange={(e) => handleCustomFlowLabelsChange(customInInput, e.target.value)}
                      placeholder="e.g. Withdraw"
                      className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Time Format */}
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Time Format &amp; Clock</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    12-hour (AM/PM) vs 24-hour military clock
                  </div>
                </div>
              </div>

              <select
                value={timeFormat}
                onChange={(e) => handleTimeFormatChange(e.target.value as TimeFormat)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500 cursor-pointer shadow-2xs shrink-0"
              >
                <option value="12h">12-Hour (AM/PM)</option>
                <option value="24h">24-Hour (Military)</option>
              </select>
            </div>

            {/* Clock Sync Mode (Auto vs Manual) */}
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Clock Sync Mode</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Live device clock or fixed custom time
                    </div>
                  </div>
                </div>

                <select
                  value={timeMode}
                  onChange={(e) => handleTimeModeChange(e.target.value as TimeMode)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500 cursor-pointer shadow-2xs shrink-0"
                >
                  <option value="auto">Auto (Live Clock)</option>
                  <option value="manual">Manual Fixed Time</option>
                </select>
              </div>

              {timeMode === 'manual' && (
                <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                  <input
                    type="time"
                    value={manualTime}
                    onChange={(e) => handleSaveManualTime(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-900/60 text-xs font-mono font-bold px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const hh = String(now.getHours()).padStart(2, '0');
                      const mm = String(now.getMinutes()).padStart(2, '0');
                      handleSaveManualTime(`${hh}:${mm}`);
                    }}
                    className="px-2.5 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
                  >
                    Sync Now
                  </button>
                </div>
              )}
            </div>

            {/* Date Format */}
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Date Format</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Date display across ledger &amp; statements
                  </div>
                </div>
              </div>

              <select
                value={dateFormat}
                onChange={(e) => handleDateFormatChange(e.target.value as DateFormat)}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold font-mono rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500 cursor-pointer shadow-2xs shrink-0"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
          </div>

          {/* Notifications & Important Alerts */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/90 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
            {/* Master Toggle */}
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${notifPrefs.enabled
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                >
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Smart Notifications</span>
                    {!notifPrefs.enabled ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                        Stopped
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {notifPrefs.enabled
                      ? 'Budget alerts, limit warnings & month-end reports'
                      : 'All notifications & alerts are paused'}
                  </div>
                </div>
              </div>

              {/* Master Toggle Switch */}
              <button
                type="button"
                onClick={() => handleToggleNotifMaster(!notifPrefs.enabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${notifPrefs.enabled ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                aria-label="Toggle notifications"
                title={notifPrefs.enabled ? 'Turn off notifications' : 'Turn on notifications'}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${notifPrefs.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {/* Granular Notification Options */}
            {notifPrefs.enabled && (
              <>
                {/* Over Budget Alert Toggle */}
                <div className="px-4 py-2.5 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Over-Budget Warnings
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Alert immediately when category spend exceeds 100% of budget
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdateNotifSubPref('overBudgetAlerts', !notifPrefs.overBudgetAlerts)}
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${notifPrefs.overBudgetAlerts ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${notifPrefs.overBudgetAlerts ? 'translate-x-3' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {/* Approaching Budget Warning (85%+) */}
                <div className="px-4 py-2.5 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Approaching Limit Warnings
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Early reminder when spending reaches 85% of monthly limit
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdateNotifSubPref('budgetWarningAlerts', !notifPrefs.budgetWarningAlerts)}
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${notifPrefs.budgetWarningAlerts ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${notifPrefs.budgetWarningAlerts ? 'translate-x-3' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {/* Month-End Performance & Celebrations */}
                <div className="px-4 py-2.5 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Trophy className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Month-End Performance
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Summary report &amp; celebration when you save money or beat your budget
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdateNotifSubPref('monthEndReport', !notifPrefs.monthEndReport)}
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${notifPrefs.monthEndReport ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${notifPrefs.monthEndReport ? 'translate-x-3' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {/* Test Notification Row */}
                <div className="px-4 py-2.5 flex items-center justify-between gap-2 bg-slate-50/30 dark:bg-slate-900/20">
                  <span className="text-[11px] text-slate-400">
                    System Permission:{' '}
                    <strong
                      className={
                        notifPermission === 'granted'
                          ? 'text-emerald-500'
                          : notifPermission === 'denied'
                            ? 'text-rose-500'
                            : 'text-slate-500'
                      }
                    >
                      {notifPermission === 'granted'
                        ? 'Allowed'
                        : notifPermission === 'denied'
                          ? 'Blocked in OS'
                          : 'System Default'}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleSendTestNotification}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    Send Test Alert
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 2. Ledgers, Budgets, Recurring & Custom Categories (Unique to Settings) */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/90 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Sub-Accounts</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{accounts.length} active spaces (Personal, Family...)</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => setIsBudgetModalOpen(true)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{t('monthlyBudgets')}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{budgetOverview?.budgets?.length || 0} category spending limits</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => setIsRecurringModalOpen(true)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Recurring Schedules</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Automate repeating salaries &amp; bills</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateToCategories ? onNavigateToCategories() : setIsCategoryModalOpen(true)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Custom Categories</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{categories.length} income &amp; expense categories</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* AI & Receipt Scanner Navigation */}
            <button
              type="button"
              onClick={() => navigateTo('ai')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Receipt Scanner &amp; AI</span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${scanMode === 'ai'
                      ? geminiKey ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                      {scanMode === 'ai' ? (geminiKey ? 'With AI (Active)' : 'With AI (Key Needed)') : 'Without AI (Offline)'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Switch With AI (Gemini) or Without AI (100% Offline)
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Theme & Appearance Navigation */}
            <button
              type="button"
              onClick={() => navigateTo('theme')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Theme &amp; Appearance</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Color themes, header colors &amp; styles</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Backup & Restore Navigation */}
            <button
              type="button"
              onClick={() => navigateTo('backup')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Cloud &amp; Drive Backup</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Google Drive sync &amp; local export/import</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Security & PIN Lock Navigation */}
            <button
              type="button"
              onClick={() => navigateTo('security')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Security &amp; PIN Lock</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Biometrics, 4-digit PIN &amp; auto-lock timer</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Account & Server Navigation */}
            <button
              type="button"
              onClick={() => navigateTo('account')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Account &amp; Server Info</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Profile info, backend REST URL &amp; reset</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW G: AI & RECEIPT SCANNER PAGE (`ai`)                   */}
      {/* ========================================================== */}
      {subPage === 'ai' && (
        <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Receipt Scanner &amp; AI Settings
              </span>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${scanMode === 'ai'
              ? geminiKey ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}>
              {scanMode === 'ai' ? (geminiKey ? 'With AI (Active)' : 'With AI (API Key Needed)') : 'Without AI (Offline)'}
            </span>
          </div>

          {/* Mode Selection Cards: With AI vs Without AI */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[12px] border border-slate-200/90 dark:border-slate-700/80 p-4 space-y-3 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Choose Scanner Mode</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Select how receipt and bill photos are processed in CashFlow
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option 1: With AI */}
              <div
                onClick={() => handleScanModeChange('ai')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between relative ${scanMode === 'ai'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/40 dark:bg-slate-900/40'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">With AI</div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Google Gemini Vision</div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="scan_mode"
                    checked={scanMode === 'ai'}
                    onChange={() => handleScanModeChange('ai')}
                    className="accent-emerald-600 w-4 h-4 mt-1"
                  />
                </div>
                <div className="mt-2.5 space-y-1">
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                    Smart 99.9% auto-extraction: extracts total amount, store name, date, itemized list &amp; category.
                  </p>
                  <p className="text-[10px] text-slate-400">Requires free Google Gemini API Key</p>
                </div>
              </div>

              {/* Option 2: Without AI */}
              <div
                onClick={() => handleScanModeChange('offline')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between relative ${scanMode === 'offline'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/40 dark:bg-slate-900/40'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Without AI</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">100% Offline Mode</div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="scan_mode"
                    checked={scanMode === 'offline'}
                    onChange={() => handleScanModeChange('offline')}
                    className="accent-emerald-600 w-4 h-4 mt-1"
                  />
                </div>
                <div className="mt-2.5 space-y-1">
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                    Direct photo attachment: attaches receipt picture directly to transaction on device. Zero cloud calls.
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">✓ Zero API Key Required</p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Mode Configuration Details */}
          {scanMode === 'ai' && (
            <div className="bg-white dark:bg-slate-800/90 rounded-[12px] border border-slate-200/90 dark:border-slate-700/80 p-4 space-y-3.5 shadow-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">Gemini API Key</h3>
                    <p className="text-[11px] text-slate-400">Powers smart receipt recognition</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${geminiKey ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  }`}>
                  {geminiKey ? 'Key Configured' : 'Key Needed'}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={geminiKey}
                    onChange={(e) => {
                      setGeminiKeyState(e.target.value);
                      setTestApiResult(null);
                    }}
                    placeholder="AIzaSy... (Paste Gemini API Key)"
                    className="flex-1 bg-slate-50 dark:bg-slate-900/60 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleSaveGeminiKey}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-all shadow-xs"
                  >
                    Save
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestGeminiKey}
                    disabled={isTestingApiKey || !geminiKey.trim()}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isTestingApiKey ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Testing Connection...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>Test Connection</span>
                      </>
                    )}
                  </button>

                  {geminiKey && (
                    <button
                      type="button"
                      onClick={handleClearGeminiKey}
                      className="px-3 py-1.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md font-medium transition-colors"
                    >
                      Clear Key
                    </button>
                  )}
                </div>

                {testApiResult && (
                  <div className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150 ${testApiResult.ok
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}>
                    {testApiResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    )}
                    <span>{testApiResult.message}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1.5 font-bold text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Get Free Google Gemini Key (aistudio.google.com)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Google provides free API keys with generous limits (15 requests/minute), perfect for scanning receipts and grocery bills at zero cost.
                </p>
              </div>
            </div>
          )}

          {/* Offline Mode Details */}
          {scanMode === 'offline' && (
            <div className="bg-white dark:bg-slate-800/90 rounded-[12px] border border-slate-200/90 dark:border-slate-700/80 p-4 space-y-2 shadow-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Without AI (Offline Mode) Active</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                You can upload or photograph receipt bills anytime. The photo will be directly attached to your transaction without asking for any API key or connecting to external servers.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleScanModeChange('ai')}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                >
                  Want automatic text and price extraction? Switch to With AI mode →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW B: THEME & DISPLAY PAGE (`theme`)                    */}
      {/* ========================================================== */}
      {subPage === 'theme' && (
        <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
          {/* Page Title */}
          <div className="flex items-center gap-2 px-1 pb-0.5">
            <Palette className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Theme &amp; Appearance
            </span>
          </div>

          {/* Unified Clean Preferences Card */}
          <div
            className="appearance-theme-card bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden transition-colors duration-200"
            style={themeMode === 'forest' ? {
              backgroundColor: `color-mix(in srgb, ${forestColor} 14%, white)`,
              borderColor: `color-mix(in srgb, ${forestColor} 35%, rgba(0, 0, 0, 0.12))`,
            } : undefined}
          >
            {/* 1. Appearance Theme Row */}
            <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 pr-2">
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>Appearance Theme</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select application visual color scheme
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <select
                  value={themeMode}
                  onChange={(e) => handleThemeChange(e.target.value as ThemeMode)}
                  className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 outline-none shadow-xs cursor-pointer min-w-[200px]"
                >
                  <option value="forest">🌲 Forest Sheet (Dribbble)</option>
                  <option value="volt">⚡ Volt (Dribbble)</option>
                  <option value="dark">🌙 Dark Mode</option>
                  <option value="light">☀️ Light (Forest)</option>
                  <option value="ocean">🌊 Midnight Ocean</option>
                  <option value="amethyst">💎 Royal Amethyst</option>
                  <option value="sunset">🌅 Sunset Coral</option>
                  <option value="system">🖥️ System Auto</option>
                </select>
              </div>
            </div>

            {/* 2. Header Accent Color (Shown when Forest Theme is active) */}
            {themeMode === 'forest' && (
              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/40 dark:bg-emerald-950/20">
                <div className="min-w-0 pr-2">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-2xs border border-white/60 shrink-0"
                      style={{ backgroundColor: forestColor }}
                    />
                    <span>Header Accent Color</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Curated shades &amp; custom hex for the Forest Sheet theme
                  </p>
                </div>
                <div className="shrink-0 flex items-center flex-wrap gap-2">
                  {/* Preset Dropdown */}
                  <select
                    value={
                      HEADER_COLOR_PRESETS.some(
                        (p) => p.hex.toLowerCase() === forestColor.toLowerCase()
                      )
                        ? forestColor.toLowerCase()
                        : 'custom'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        handleForestColorChange(e.target.value);
                      }
                    }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-100 outline-none shadow-xs cursor-pointer"
                  >
                    {HEADER_COLOR_PRESETS.map((preset) => (
                      <option key={preset.hex} value={preset.hex.toLowerCase()}>
                        {preset.name}
                      </option>
                    ))}
                    {!HEADER_COLOR_PRESETS.some(
                      (p) => p.hex.toLowerCase() === forestColor.toLowerCase()
                    ) && <option value="custom">Custom Color</option>}
                  </select>

                  {/* Native Picker Swatch & Hex input */}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs">
                    <label
                      htmlFor="custom-color-picker"
                      className="w-5 h-5 rounded-full cursor-pointer shadow-2xs border border-black/15 shrink-0 relative overflow-hidden flex items-center justify-center active:scale-95 transition-transform"
                      style={{ backgroundColor: forestColor }}
                      title="Click to open color picker"
                    >
                      <input
                        id="custom-color-picker"
                        type="color"
                        value={forestColor}
                        onChange={(e) => handleForestColorChange(e.target.value)}
                        className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                      />
                    </label>
                    <input
                      type="text"
                      value={customHexInput}
                      onChange={(e) => {
                        setCustomHexInput(e.target.value);
                        if (/^#([0-9A-F]{3}){1,2}$/i.test(e.target.value)) {
                          handleForestColorChange(e.target.value);
                        }
                      }}
                      placeholder="#81B9A1"
                      maxLength={7}
                      className="bg-transparent text-[11px] font-mono font-bold text-slate-800 dark:text-slate-100 outline-none w-16 uppercase"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleForestColorChange('#81b9a1')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors shrink-0"
                    title="Reset to default Sage Mist (#81b9a1)"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* 3. System Font Size Row */}
            <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 pr-2">
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ALargeSmall className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>System Font Size</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Scale typography across all views
                </p>
              </div>
              <div className="shrink-0 flex items-center">
                <select
                  value={fontSize}
                  onChange={(e) => handleFontSizeChange(e.target.value as FontSize)}
                  className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 outline-none shadow-xs cursor-pointer min-w-[200px]"
                >
                  {FONT_SIZE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label} ({opt.scaleLabel})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. Quick Add (+) Action Menu */}
            <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 pr-2">
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Quick Add (+) Action Menu</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Choose shortcut popup animation when pressing center (+) button
                </p>
              </div>
              <div className="shrink-0 flex items-center">
                <select
                  value={quickAddTrigger}
                  onChange={(e) => handleQuickAddTriggerChange(e.target.value as QuickAddTrigger)}
                  className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 outline-none shadow-xs cursor-pointer min-w-[200px]"
                >
                  <option value="single_tap">⚡ Single Tap (Instant Popup Menu)</option>
                  <option value="long_press">⏱️ Long Press (Hold for Popup, Tap for Manual)</option>
                  <option value="direct">✍️ Direct Manual Entry Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bottom Navigation Style Card (In-List Realistic Visual Preview Dropdown) */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Bottom Navigation Style
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/20">
                      16 Styles
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Select pattern with photorealistic previews inside the menu</p>
                </div>
              </div>

              {/* Custom Dropdown Trigger */}
              <div className="relative w-full sm:w-80" ref={styleDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsStyleDropdownOpen((prev) => !prev)}
                  className="w-full text-left p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all flex items-center justify-between gap-2.5 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Active Realistic Dock Thumbnail (w-28 h-7) */}
                    <div className="w-28 h-7 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-end shrink-0 overflow-hidden relative shadow-2xs select-none">
                      {bottomBarStyle === "fab" && (
                        <div className="w-full h-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative">
                          <Home className="w-2 h-2 text-emerald-600" />
                          <BellRing className="w-2 h-2 text-slate-400" />
                          <div className="w-4 h-4 -mt-2 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs border border-white dark:border-slate-800"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                          <ShoppingBag className="w-2 h-2 text-slate-400" />
                          <PieChart className="w-2 h-2 text-slate-400" />
                        </div>
                      )}
                      {bottomBarStyle === "notch" && (
                        <div className="w-full h-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative">
                          <svg viewBox="0 0 40 8" className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-1.5 overflow-visible">
                            <path d="M 0,8 C 10,8 14,1 20,1 C 26,1 30,8 40,8" fill="none" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1" />
                          </svg>
                          <Home className="w-2 h-2 text-emerald-600" />
                          <BellRing className="w-2 h-2 text-slate-400" />
                          <div className="w-4 h-4 -mt-2 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs border border-white dark:border-slate-800 relative z-10"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                          <ShoppingBag className="w-2 h-2 text-slate-400" />
                          <PieChart className="w-2 h-2 text-slate-400" />
                        </div>
                      )}
                      {bottomBarStyle === "indicator" && (
                        <div className="w-full h-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative">
                          <span className="absolute top-0 left-[6%] w-3 h-0.5 bg-emerald-600 rounded-full" />
                          <Home className="w-2 h-2 text-emerald-600" />
                          <BellRing className="w-2 h-2 text-slate-400" />
                          <div className="w-4 h-4 -mt-2 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs border border-white dark:border-slate-800"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                          <ShoppingBag className="w-2 h-2 text-slate-400" />
                          <PieChart className="w-2 h-2 text-slate-400" />
                        </div>
                      )}
                      {bottomBarStyle === "inout" && (
                        <div className="w-full h-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-center px-1">
                          <div className="grid grid-cols-2 gap-1 w-full px-0.5">
                            <div className="h-4 rounded bg-emerald-600 text-white flex items-center justify-center text-[6px] font-bold gap-0.5"><ArrowDownLeft className="w-1.5 h-1.5 stroke-[3]" /> In</div>
                            <div className="h-4 rounded bg-rose-600 text-white flex items-center justify-center text-[6px] font-bold gap-0.5"><ArrowUpRight className="w-1.5 h-1.5 stroke-[3]" /> Out</div>
                          </div>
                        </div>
                      )}
                      {bottomBarStyle === "pill" && (
                        <div className="w-full h-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1">
                          <span className="py-0.5 px-1.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[6px] font-bold flex items-center gap-0.5"><Home className="w-1.5 h-1.5" /> Home</span>
                          <BellRing className="w-2 h-2 text-slate-400" />
                          <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2 h-2 stroke-[3]" /></div>
                          <ShoppingBag className="w-2 h-2 text-slate-400" />
                          <PieChart className="w-2 h-2 text-slate-400" />
                        </div>
                      )}
                      {bottomBarStyle === "floating" && (
                        <div className="w-full pb-0.5 flex justify-center">
                          <div className="w-[94%] h-5 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-around px-1.5">
                            <Home className="w-2 h-2 text-emerald-600" />
                            <BellRing className="w-2 h-2 text-slate-400" />
                            <div className="w-3.5 h-3.5 -mt-1 rounded-full bg-emerald-600 text-white flex items-center justify-center border border-white dark:border-slate-800"><Plus className="w-2 h-2 stroke-[3]" /></div>
                            <ShoppingBag className="w-2 h-2 text-slate-400" />
                            <PieChart className="w-2 h-2 text-slate-400" />
                          </div>
                        </div>
                      )}
                      {bottomBarStyle === "glass" && (
                        <div className="w-full h-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-t border-white/50 dark:border-slate-700/60 flex items-center justify-around px-1">
                          <Home className="w-2 h-2 text-emerald-600" />
                          <BellRing className="w-2 h-2 text-slate-400" />
                          <div className="w-4 h-4 -mt-2 rounded-full bg-emerald-600/90 text-white flex items-center justify-center shadow-xs border border-white/60"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                          <ShoppingBag className="w-2 h-2 text-slate-400" />
                          <PieChart className="w-2 h-2 text-slate-400" />
                        </div>
                      )}
                      {bottomBarStyle === "dot" && (
                        <div className="w-full h-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1">
                          <div className="flex flex-col items-center"><Home className="w-2 h-2 text-emerald-600" /><span className="w-1 h-1 rounded-full bg-emerald-600 shadow-[0_0_4px_rgba(16,185,129,0.9)]" /></div>
                          <BellRing className="w-2 h-2 text-slate-400" />
                          <div className="w-3.5 h-3.5 -mt-1.5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs"><Plus className="w-2 h-2 stroke-[3]" /></div>
                          <ShoppingBag className="w-2 h-2 text-slate-400" />
                          <PieChart className="w-2 h-2 text-slate-400" />
                        </div>
                      )}
                      {bottomBarStyle === "compact" && (
                        <div className="w-full h-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1">
                          <Home className="w-1.5 h-1.5 text-emerald-600" />
                          <BellRing className="w-1.5 h-1.5 text-slate-400" />
                          <div className="w-3 h-3 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2 h-2 stroke-[3]" /></div>
                          <ShoppingBag className="w-1.5 h-1.5 text-slate-400" />
                          <PieChart className="w-1.5 h-1.5 text-slate-400" />
                        </div>
                      )}
                      {bottomBarStyle === "bubble" && (
                        <div className="w-full h-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1">
                          <span className="p-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/20 text-emerald-600"><Home className="w-1.5 h-1.5" /></span>
                          <BellRing className="w-1.5 h-1.5 text-slate-400" />
                          <div className="w-3.5 h-3.5 rounded bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2 h-2 stroke-[3]" /></div>
                          <ShoppingBag className="w-1.5 h-1.5 text-slate-400" />
                          <PieChart className="w-1.5 h-1.5 text-slate-400" />
                        </div>
                      )}
                      {bottomBarStyle === "badge" && (
                        <div className="w-full h-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1">
                          <span className="p-0.5 rounded border border-emerald-500/60 bg-emerald-500/10 text-emerald-600"><Home className="w-1.5 h-1.5" /></span>
                          <BellRing className="w-1.5 h-1.5 text-slate-400" />
                          <div className="w-3.5 h-3.5 rounded bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2 h-2 stroke-[3]" /></div>
                          <ShoppingBag className="w-1.5 h-1.5 text-slate-400" />
                          <PieChart className="w-1.5 h-1.5 text-slate-400" />
                        </div>
                      )}
                      {bottomBarStyle === "wave" && (
                        <div className="w-full h-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative">
                          <Home className="w-2 h-2 text-emerald-600" />
                          <BellRing className="w-2 h-2 text-slate-400" />
                          <div className="relative"><span className="w-4 h-4 rounded-full bg-emerald-500/30 animate-ping absolute -top-1 -left-1 pointer-events-none" /><div className="w-3.5 h-3.5 -mt-1.5 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-xs relative z-10"><Plus className="w-2 h-2 stroke-[3]" /></div></div>
                          <ShoppingBag className="w-2 h-2 text-slate-400" />
                          <PieChart className="w-2 h-2 text-slate-400" />
                        </div>
                      )}
                      {bottomBarStyle === "liquid_hump" && (
                        <div className="w-full h-6 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative overflow-visible">
                          <svg viewBox="0 0 32 7" className="absolute -top-1.5 left-[12%] -translate-x-1/2 w-7 h-1.5 overflow-visible">
                            <path d="M 0,7 C 6,7 10,0.5 16,0.5 C 22,0.5 26,7 32,7" fill="white" className="stroke-slate-300 dark:stroke-slate-600 dark:fill-slate-800" strokeWidth="1" />
                          </svg>
                          <Home className="w-2.5 h-2.5 text-emerald-600 -translate-y-1 relative z-10" />
                          <BellRing className="w-2 h-2 text-slate-400" />
                          <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                          <ShoppingBag className="w-2 h-2 text-slate-400" />
                          <PieChart className="w-2 h-2 text-slate-400" />
                        </div>
                      )}
                      {bottomBarStyle === "liquid_dip" && (
                        <div className="w-full h-6 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative overflow-visible">
                          <svg viewBox="0 0 32 7" className="absolute -top-[1px] left-[12%] -translate-x-1/2 w-7 h-1.5 overflow-visible">
                            <path d="M 0,0 C 4,0 7,1.5 9,3 C 11,5.5 13,6.5 16,6.5 C 19,6.5 21,5.5 23,3 C 25,1.5 28,0 32,0 L 32,0 L 0,0 Z" className="fill-slate-100 dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-600" strokeWidth="0.8" />
                          </svg>
                          <div className="absolute -top-1.5 left-[12%] -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-2xs border border-white dark:border-slate-800 z-10"><Home className="w-2 h-2" /></div>
                          <span className="w-2.5" />
                          <BellRing className="w-2 h-2 text-slate-400" />
                          <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2 h-2 stroke-[3]" /></div>
                          <ShoppingBag className="w-2 h-2 text-slate-400" />
                          <PieChart className="w-2 h-2 text-slate-400" />
                        </div>
                      )}
                      {bottomBarStyle === "liquid_glow" && (
                        <div className="w-full h-6 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative overflow-visible">
                          <svg viewBox="0 0 36 7" className="absolute -top-1.5 left-[12%] -translate-x-1/2 w-8 h-1.5 overflow-visible">
                            <path d="M 0,7 C 8,7 12,0.5 18,0.5 C 24,0.5 28,7 36,7" fill="white" className="stroke-emerald-400/50 dark:fill-slate-800" strokeWidth="1" />
                          </svg>
                          <div className="relative flex items-center justify-center"><span className="w-4 h-4 rounded-full bg-emerald-500/30 blur-2xs absolute" /><Home className="w-2.5 h-2.5 text-emerald-500 relative z-10" /></div>
                          <BellRing className="w-2 h-2 text-slate-400" />
                          <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                          <ShoppingBag className="w-2 h-2 text-slate-400" />
                          <PieChart className="w-2 h-2 text-slate-400" />
                        </div>
                      )}
                      {bottomBarStyle === "curved_hole" && (
                        <div className="w-full h-6 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative overflow-visible">
                          <svg viewBox="0 0 36 10" className="absolute -top-[1px] left-[50%] -translate-x-1/2 w-9 h-2.5 overflow-visible">
                            <path d="M 0,0 L 0,0.5 C 6,0.5 9,9 18,9 C 27,9 30,0.5 36,0.5 L 36,0 Z" className="fill-slate-100 dark:fill-slate-900" />
                          </svg>
                          <Home className="w-2 h-2 text-slate-400" />
                          <BellRing className="w-2 h-2 text-slate-400" />
                          <div className="w-4 h-4 -mt-1 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs border border-white dark:border-slate-800 z-10"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                          <ShoppingBag className="w-2 h-2 text-slate-400" />
                          <PieChart className="w-2 h-2 text-slate-400" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate text-slate-800 dark:text-slate-100">
                        {bottomBarStyle === "fab" && "Raised Center FAB"}
                        {bottomBarStyle === "notch" && "Scooped Notch Cutout"}
                        {bottomBarStyle === "indicator" && "Top Line Indicator"}
                        {bottomBarStyle === "inout" && "Dual Cash In & Out"}
                        {bottomBarStyle === "pill" && "Active Expanding Pill"}
                        {bottomBarStyle === "floating" && "Floating Island Dock"}
                        {bottomBarStyle === "glass" && "Frosted Glassmorphism"}
                        {bottomBarStyle === "dot" && "Minimalist Glowing Dot"}
                        {bottomBarStyle === "compact" && "Ultra-Compact Slim"}
                        {bottomBarStyle === "bubble" && "Soft Bubble Pods"}
                        {bottomBarStyle === "badge" && "Fintech Neon Badge"}
                        {bottomBarStyle === "wave" && "Curved Wave Halo"}
                        {bottomBarStyle === "liquid_hump" && "Liquid Convex Wave"}
                        {bottomBarStyle === "liquid_dip" && "Liquid Scoop Cradle"}
                        {bottomBarStyle === "liquid_glow" && "Liquid Glow Arch"}
                        {bottomBarStyle === "curved_hole" && "Curved Cutout Hole"}
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Change Dock Pattern
                      </span>
                    </div>
                  </div>

                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isStyleDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown Menu Panel (Each item has real photorealistic miniature dock preview) */}
                {isStyleDropdownOpen && (
                  <div className="absolute top-full mt-1.5 right-0 w-full sm:w-96 max-h-[420px] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl z-50 p-2 space-y-1.5 overscroll-contain animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <span>Exact Visual Previews</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">16 Figma Patterns</span>
                    </div>

                    {[
                      { id: "fab", name: "1. Raised Center FAB", badge: "Classic" },
                      { id: "notch", name: "2. Scooped Notch Cutout", badge: "Curved" },
                      { id: "indicator", name: "3. Top Line Indicator", badge: "Minimal" },
                      { id: "inout", name: "4. Dual Cash In & Out", badge: "Fast Dock" },
                      { id: "pill", name: "5. Active Expanding Pill", badge: "Dynamic" },
                      { id: "floating", name: "6. Floating Island Dock", badge: "Capsule" },
                      { id: "glass", name: "7. Frosted Glassmorphism", badge: "Liquid" },
                      { id: "dot", name: "8. Minimalist Glowing Dot", badge: "iOS Dot" },
                      { id: "compact", name: "9. Ultra-Compact Slim", badge: "42px Micro" },
                      { id: "bubble", name: "10. Soft Bubble Pods", badge: "Segmented" },
                      { id: "badge", name: "11. Fintech Neon Badge", badge: "Cyber" },
                      { id: "wave", name: "12. Curved Wave Halo", badge: "Animated" },
                      { id: "liquid_hump", name: "13. Liquid Convex Wave", badge: "Liquid Peak" },
                      { id: "liquid_dip", name: "14. Liquid Scoop Cradle", badge: "Morph Cradle" },
                      { id: "liquid_glow", name: "15. Liquid Glow Arch", badge: "Neon Orb" },
                      { id: "curved_hole", name: "16. Curved Cutout Hole", badge: "Flutter Hole" },
                    ].map((item) => {
                      const isSelected = bottomBarStyle === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleBottomBarStyleChange(item.id as BottomBarStyle)}
                          className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between gap-2.5 border ${isSelected
                            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 ring-1 ring-emerald-500/20"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/70 border-slate-100 dark:border-slate-800"
                            }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Realistic Miniature Dock Box (w-32 h-8) */}
                            <div className="w-32 h-8 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-end shrink-0 overflow-hidden relative shadow-2xs select-none">
                              {item.id === "fab" && (
                                <div className="w-full h-7 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative">
                                  <Home className="w-2.5 h-2.5 text-emerald-600" />
                                  <BellRing className="w-2.5 h-2.5 text-slate-400" />
                                  <div className="w-4.5 h-4.5 -mt-2.5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs border border-white dark:border-slate-800"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                                  <ShoppingBag className="w-2.5 h-2.5 text-slate-400" />
                                  <PieChart className="w-2.5 h-2.5 text-slate-400" />
                                </div>
                              )}
                              {item.id === "notch" && (
                                <div className="w-full h-7 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative">
                                  <svg viewBox="0 0 48 9" className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-2 overflow-visible">
                                    <path d="M 0,9 C 11,9 16,1 24,1 C 32,1 37,9 48,9" fill="none" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="1" />
                                  </svg>
                                  <Home className="w-2.5 h-2.5 text-emerald-600" />
                                  <BellRing className="w-2.5 h-2.5 text-slate-400" />
                                  <div className="w-4.5 h-4.5 -mt-2.5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs border border-white dark:border-slate-800 relative z-10"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                                  <ShoppingBag className="w-2.5 h-2.5 text-slate-400" />
                                  <PieChart className="w-2.5 h-2.5 text-slate-400" />
                                </div>
                              )}
                              {item.id === "indicator" && (
                                <div className="w-full h-7 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative">
                                  <span className="absolute top-0 left-[6%] w-4 h-0.5 bg-emerald-600 rounded-full" />
                                  <Home className="w-2.5 h-2.5 text-emerald-600" />
                                  <BellRing className="w-2.5 h-2.5 text-slate-400" />
                                  <div className="w-4.5 h-4.5 -mt-2.5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs border border-white dark:border-slate-800"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                                  <ShoppingBag className="w-2.5 h-2.5 text-slate-400" />
                                  <PieChart className="w-2.5 h-2.5 text-slate-400" />
                                </div>
                              )}
                              {item.id === "inout" && (
                                <div className="w-full h-7 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-center px-1">
                                  <div className="grid grid-cols-2 gap-1 w-full px-0.5">
                                    <div className="h-5 rounded bg-emerald-600 text-white flex items-center justify-center text-[7px] font-bold gap-0.5"><ArrowDownLeft className="w-2 h-2 stroke-[3]" /> In</div>
                                    <div className="h-5 rounded bg-rose-600 text-white flex items-center justify-center text-[7px] font-bold gap-0.5"><ArrowUpRight className="w-2 h-2 stroke-[3]" /> Out</div>
                                  </div>
                                </div>
                              )}
                              {item.id === "pill" && (
                                <div className="w-full h-7 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1">
                                  <span className="py-0.5 px-1.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[6.5px] font-bold flex items-center gap-0.5"><Home className="w-2 h-2" /> Home</span>
                                  <BellRing className="w-2.5 h-2.5 text-slate-400" />
                                  <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                                  <ShoppingBag className="w-2.5 h-2.5 text-slate-400" />
                                  <PieChart className="w-2.5 h-2.5 text-slate-400" />
                                </div>
                              )}
                              {item.id === "floating" && (
                                <div className="w-full pb-0.5 flex justify-center">
                                  <div className="w-[94%] h-6 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-around px-2">
                                    <Home className="w-2.5 h-2.5 text-emerald-600" />
                                    <BellRing className="w-2.5 h-2.5 text-slate-400" />
                                    <div className="w-4 h-4 -mt-1 rounded-full bg-emerald-600 text-white flex items-center justify-center border border-white dark:border-slate-800"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                                    <ShoppingBag className="w-2.5 h-2.5 text-slate-400" />
                                    <PieChart className="w-2.5 h-2.5 text-slate-400" />
                                  </div>
                                </div>
                              )}
                              {item.id === "glass" && (
                                <div className="w-full h-7 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border-t border-white/50 dark:border-slate-700/60 flex items-center justify-around px-1.5">
                                  <Home className="w-2.5 h-2.5 text-emerald-600" />
                                  <BellRing className="w-2.5 h-2.5 text-slate-400" />
                                  <div className="w-4.5 h-4.5 -mt-2.5 rounded-full bg-emerald-600/90 text-white flex items-center justify-center shadow-xs border border-white/60"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                                  <ShoppingBag className="w-2.5 h-2.5 text-slate-400" />
                                  <PieChart className="w-2.5 h-2.5 text-slate-400" />
                                </div>
                              )}
                              {item.id === "dot" && (
                                <div className="w-full h-7 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1.5">
                                  <div className="flex flex-col items-center"><Home className="w-2.5 h-2.5 text-emerald-600" /><span className="w-1 h-1 rounded-full bg-emerald-600 shadow-[0_0_4px_rgba(16,185,129,0.9)]" /></div>
                                  <BellRing className="w-2.5 h-2.5 text-slate-400" />
                                  <div className="w-4 h-4 -mt-2 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                                  <ShoppingBag className="w-2.5 h-2.5 text-slate-400" />
                                  <PieChart className="w-2.5 h-2.5 text-slate-400" />
                                </div>
                              )}
                              {item.id === "compact" && (
                                <div className="w-full h-5 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1">
                                  <Home className="w-2 h-2 text-emerald-600" />
                                  <BellRing className="w-2 h-2 text-slate-400" />
                                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2 h-2 stroke-[3]" /></div>
                                  <ShoppingBag className="w-2 h-2 text-slate-400" />
                                  <PieChart className="w-2 h-2 text-slate-400" />
                                </div>
                              )}
                              {item.id === "bubble" && (
                                <div className="w-full h-7 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1">
                                  <span className="p-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/20 text-emerald-600"><Home className="w-2 h-2" /></span>
                                  <BellRing className="w-2 h-2 text-slate-400" />
                                  <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                                  <ShoppingBag className="w-2 h-2 text-slate-400" />
                                  <PieChart className="w-2 h-2 text-slate-400" />
                                </div>
                              )}
                              {item.id === "badge" && (
                                <div className="w-full h-7 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1">
                                  <span className="p-0.5 rounded-full border border-emerald-500/60 bg-emerald-500/10 text-emerald-600"><Home className="w-2 h-2" /></span>
                                  <BellRing className="w-2 h-2 text-slate-400" />
                                  <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                                  <ShoppingBag className="w-2 h-2 text-slate-400" />
                                  <PieChart className="w-2 h-2 text-slate-400" />
                                </div>
                              )}
                              {item.id === "wave" && (
                                <div className="w-full h-7 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-around px-1.5 relative">
                                  <Home className="w-2.5 h-2.5 text-emerald-600" />
                                  <BellRing className="w-2.5 h-2.5 text-slate-400" />
                                  <div className="relative"><span className="w-4 h-4 rounded-full bg-emerald-500/30 animate-ping absolute -top-1 -left-1 pointer-events-none" /><div className="w-4 h-4 -mt-2 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-xs relative z-10"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div></div>
                                  <ShoppingBag className="w-2.5 h-2.5 text-slate-400" />
                                  <PieChart className="w-2.5 h-2.5 text-slate-400" />
                                </div>
                              )}
                              {item.id === "liquid_hump" && (
                                <div className="w-full h-7 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative overflow-visible">
                                  <svg viewBox="0 0 40 8" className="absolute -top-2 left-[12%] -translate-x-1/2 w-9 h-2 overflow-visible">
                                    <path d="M 0,8 C 8,8 13,0.5 20,0.5 C 27,0.5 32,8 40,8" fill="white" className="stroke-slate-300 dark:stroke-slate-600 dark:fill-slate-800" strokeWidth="1.2" />
                                  </svg>
                                  <Home className="w-3 h-3 text-emerald-600 -translate-y-1 relative z-10" />
                                  <BellRing className="w-2.5 h-2.5 text-slate-400" />
                                  <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                                  <ShoppingBag className="w-2.5 h-2.5 text-slate-400" />
                                  <PieChart className="w-2.5 h-2.5 text-slate-400" />
                                </div>
                              )}
                              {item.id === "liquid_dip" && (
                                <div className="w-full h-7 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative overflow-visible">
                                  <svg viewBox="0 0 40 8" className="absolute -top-[1px] left-[12%] -translate-x-1/2 w-9 h-2 overflow-visible">
                                    <path d="M 0,0 C 5,0 8,1.5 10,3 C 13,6 16,7.5 20,7.5 C 24,7.5 27,6 30,3 C 32,1.5 35,0 40,0 L 40,0 L 0,0 Z" className="fill-slate-100 dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-600" strokeWidth="1" />
                                  </svg>
                                  <div className="absolute -top-2 left-[12%] -translate-x-1/2 w-4.5 h-4.5 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-xs border border-white dark:border-slate-800 z-10"><Home className="w-2.5 h-2.5" /></div>
                                  <span className="w-3" />
                                  <BellRing className="w-2.5 h-2.5 text-slate-400" />
                                  <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                                  <ShoppingBag className="w-2.5 h-2.5 text-slate-400" />
                                  <PieChart className="w-2.5 h-2.5 text-slate-400" />
                                </div>
                              )}
                              {item.id === "liquid_glow" && (
                                <div className="w-full h-7 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative overflow-visible">
                                  <svg viewBox="0 0 44 8" className="absolute -top-2 left-[12%] -translate-x-1/2 w-10 h-2 overflow-visible">
                                    <path d="M 0,8 C 10,8 14,0.5 22,0.5 C 30,0.5 34,8 44,8" fill="white" className="stroke-emerald-400/50 dark:fill-slate-800" strokeWidth="1.2" />
                                  </svg>
                                  <div className="relative flex items-center justify-center"><span className="w-5 h-5 rounded-full bg-emerald-500/30 blur-2xs absolute" /><Home className="w-3 h-3 text-emerald-500 relative z-10" /></div>
                                  <BellRing className="w-2.5 h-2.5 text-slate-400" />
                                  <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Plus className="w-2.5 h-2.5 stroke-[3]" /></div>
                                  <ShoppingBag className="w-2.5 h-2.5 text-slate-400" />
                                  <PieChart className="w-2.5 h-2.5 text-slate-400" />
                                </div>
                              )}
                              {item.id === "curved_hole" && (
                                <div className="w-full h-7 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-around px-1 relative overflow-visible">
                                  <svg viewBox="0 0 40 12" className="absolute -top-[1px] left-[50%] -translate-x-1/2 w-10 h-3 overflow-visible">
                                    <path d="M 0,0 L 0,0.5 C 7,0.5 10,11 20,11 C 30,11 33,0.5 40,0.5 L 40,0 Z" className="fill-slate-100 dark:fill-slate-900" />
                                  </svg>
                                  <Home className="w-2.5 h-2.5 text-slate-400" />
                                  <BellRing className="w-2.5 h-2.5 text-slate-400" />
                                  <div className="w-4.5 h-4.5 -mt-1 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs border border-white dark:border-slate-800 z-10"><Plus className="w-3 h-3 stroke-[3]" /></div>
                                  <ShoppingBag className="w-2.5 h-2.5 text-slate-400" />
                                  <PieChart className="w-2.5 h-2.5 text-slate-400" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <span className={`text-xs font-bold block truncate ${isSelected ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-200"}`}>
                                {item.name}
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                                {item.badge}
                              </span>
                            </div>
                          </div>

                          {isSelected ? (
                            <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-slate-200 dark:border-slate-700 shrink-0 opacity-40" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Navigation Buttons & Layout Customization Card */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-4">
            {/* Card Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Bottom Bar Buttons &amp; Layout
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/20">
                      {navConfig.buttonCount} Buttons
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure how many buttons appear, choose destinations among pages, and select which button to highlight
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetNavConfig}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
                title="Reset to default 5 buttons"
              >
                <RotateCcw className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                Reset Default
              </button>
            </div>

            {/* Live Interactive Dock Miniature Preview */}
            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span>Live Dock Preview</span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                  {navConfig.highlightIndex >= 0 ? `Button ${navConfig.highlightIndex + 1} Highlighted` : 'No Highlight (Flat)'}
                </span>
              </div>

              <div
                className={`w-full bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 p-2.5 relative overflow-visible ${bottomBarStyle === 'liquid_hump' ||
                  bottomBarStyle === 'liquid_dip' ||
                  bottomBarStyle === 'liquid_glow' ||
                  bottomBarStyle === 'curved_hole'
                  ? 'rounded-2xl shadow-none'
                  : bottomBarStyle === 'floating' || bottomBarStyle === 'pill'
                    ? 'rounded-2xl shadow-2xs'
                    : 'rounded-xl shadow-2xs'
                  }`}
              >
                {/* Scooped Notch Curve for Standard & Notch Layouts in Live Preview */}
                {bottomBarStyle !== 'liquid_hump' &&
                  bottomBarStyle !== 'liquid_dip' &&
                  bottomBarStyle !== 'liquid_glow' &&
                  bottomBarStyle !== 'curved_hole' &&
                  navConfig.highlightIndex >= 0 && (
                    <div
                      className="absolute -top-[16px] -translate-x-1/2 w-[72px] h-[16px] pointer-events-none overflow-visible z-10"
                      style={{
                        left: `calc(${((navConfig.highlightIndex + 0.5) / navConfig.buttonCount) * 100}%)`,
                        filter: 'drop-shadow(0 -2px 4px rgba(0,0,0,0.04))',
                      }}
                    >
                      <svg viewBox="0 0 104 20" className="w-full h-full overflow-visible">
                        <path
                          d="M 0,20 C 22,20 35,2 52,2 C 69,2 82,20 104,20 L 104,22 L 0,22 Z"
                          className="fill-white dark:fill-slate-800"
                        />
                        <path
                          d="M 0,20 C 22,20 35,2 52,2 C 69,2 82,20 104,20"
                          fill="none"
                          className="stroke-slate-300 dark:stroke-slate-700"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  )}

                {/* SVG Convex Wave for Liquid Hump in Live Preview */}
                {bottomBarStyle === 'liquid_hump' && navConfig.highlightIndex >= 0 && (
                  <div
                    className="absolute -top-[16px] -translate-x-1/2 w-[68px] h-[17px] pointer-events-none overflow-visible z-10"
                    style={{
                      left: `calc(${((navConfig.highlightIndex + 0.5) / navConfig.buttonCount) * 100}%)`,
                    }}
                  >
                    <svg viewBox="0 0 68 17" className="w-full h-full overflow-visible">
                      <path d="M 0,17 C 14,17 21,1 34,1 C 47,1 54,17 68,17 L 68,18 L 0,18 Z" className="fill-white dark:fill-slate-800" />
                      <path d="M 0,17 C 14,17 21,1 34,1 C 47,1 54,17 68,17" fill="none" className="stroke-slate-300 dark:stroke-slate-700" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
                {/* SVG Concave Notch for Liquid Dip in Live Preview */}
                {bottomBarStyle === 'liquid_dip' && navConfig.highlightIndex >= 0 && (
                  <div
                    className="absolute -top-[1px] -translate-x-1/2 w-[68px] h-[18px] pointer-events-none overflow-visible z-10"
                    style={{
                      left: `calc(${((navConfig.highlightIndex + 0.5) / navConfig.buttonCount) * 100}%)`,
                    }}
                  >
                    <svg viewBox="0 0 68 18" className="w-full h-full overflow-visible">
                      <path d="M 0,0 C 11,0 17,16 34,16 C 51,16 57,0 68,0 L 68,0 L 0,0 Z" className="fill-slate-50 dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-700" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
                {/* Glowing Neon Arch for Liquid Glow in Live Preview */}
                {bottomBarStyle === 'liquid_glow' && navConfig.highlightIndex >= 0 && (
                  <div
                    className="absolute -top-[16px] -translate-x-1/2 w-[80px] h-[17px] pointer-events-none overflow-visible z-10"
                    style={{
                      left: `calc(${((navConfig.highlightIndex + 0.5) / navConfig.buttonCount) * 100}%)`,
                    }}
                  >
                    <svg viewBox="0 0 80 17" className="w-full h-full overflow-visible">
                      <path d="M 0,17 C 18,17 26,1 40,1 C 54,1 62,17 80,17 L 80,18 L 0,18 Z" className="fill-white dark:fill-slate-800" />
                      <path d="M 0,17 C 18,17 26,1 40,1 C 54,1 62,17 80,17" fill="none" className="stroke-emerald-500/60" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
                {/* SVG Cutout Hole for Curved Hole in Live Preview */}
                {bottomBarStyle === 'curved_hole' && navConfig.highlightIndex >= 0 && (
                  <div
                    className="absolute -top-[1px] -translate-x-1/2 w-[76px] h-[24px] pointer-events-none overflow-visible z-10"
                    style={{
                      left: `calc(${((navConfig.highlightIndex + 0.5) / navConfig.buttonCount) * 100}%)`,
                    }}
                  >
                    <svg viewBox="0 0 76 24" className="w-full h-full overflow-visible">
                      <path d="M 0,0 L 0,0.5 C 13,0.5 19,23 38,23 C 57,23 63,0.5 76,0.5 L 76,0 Z" className="fill-slate-50 dark:fill-slate-900" />
                    </svg>
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${navConfig.buttonCount}, minmax(0, 1fr))`,
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  {navConfig.items.slice(0, navConfig.buttonCount).map((itemId, idx) => {
                    const itemMeta = AVAILABLE_NAV_ITEMS.find((x) => x.id === itemId) || AVAILABLE_NAV_ITEMS[1];
                    const IconComponent = itemMeta.icon;
                    const isHighlighted = idx === navConfig.highlightIndex;

                    if (isHighlighted) {
                      if (bottomBarStyle === 'liquid_hump') {
                        return (
                          <div key={`preview-${itemId}-${idx}`} className="flex flex-col items-center justify-center relative z-20">
                            <div className="w-8 h-8 -translate-y-2 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                              <IconComponent className="w-4 h-4 stroke-[2.8]" />
                            </div>
                            <span className="text-[8.5px] font-black text-emerald-600 dark:text-emerald-400 -mt-1 truncate max-w-[50px] leading-tight">
                              {itemMeta.defaultLabel}
                            </span>
                          </div>
                        );
                      }
                      if (bottomBarStyle === 'liquid_dip') {
                        return (
                          <div key={`preview-${itemId}-${idx}`} className="flex flex-col items-center justify-center relative z-20">
                            <div className="w-8 h-8 -mt-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center border-2 border-white dark:border-slate-800">
                              <IconComponent className="w-4 h-4 stroke-[2.8]" />
                            </div>
                            <span className="text-[8.5px] font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate max-w-[50px] leading-tight">
                              {itemMeta.defaultLabel}
                            </span>
                          </div>
                        );
                      }
                      if (bottomBarStyle === 'liquid_glow') {
                        return (
                          <div key={`preview-${itemId}-${idx}`} className="flex flex-col items-center justify-center relative z-20">
                            <div className="w-8 h-8 -mt-2 rounded-xl bg-emerald-600 text-white flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm shadow-emerald-600/30">
                              <IconComponent className="w-4 h-4 stroke-[2.8]" />
                            </div>
                            <span className="text-[8.5px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5 truncate max-w-[50px] leading-tight">
                              {itemMeta.defaultLabel}
                            </span>
                          </div>
                        );
                      }
                      if (bottomBarStyle === 'curved_hole') {
                        return (
                          <div key={`preview-${itemId}-${idx}`} className="flex flex-col items-center justify-center relative z-20">
                            <div className="w-8 h-8 -mt-2 rounded-full bg-emerald-600 text-white flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm shadow-emerald-600/30">
                              <IconComponent className="w-4 h-4 stroke-[2.8]" />
                            </div>
                            <span className="text-[8.5px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5 truncate max-w-[50px] leading-tight">
                              {itemMeta.defaultLabel}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div key={`preview-${itemId}-${idx}`} className="flex flex-col items-center justify-center relative z-20">
                          <div className="w-8 h-8 -mt-3 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 border-2 border-white dark:border-slate-800 ring-2 ring-emerald-500/20">
                            <IconComponent className="w-4 h-4 stroke-[2.8]" />
                          </div>
                          <span className="text-[8.5px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5 truncate max-w-[50px] leading-tight">
                            {itemMeta.defaultLabel}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`preview-${itemId}-${idx}`}
                        className="flex flex-col items-center justify-center gap-0.5 py-1 text-slate-600 dark:text-slate-400"
                      >
                        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[8.5px] font-semibold text-slate-600 dark:text-slate-400 truncate max-w-[48px] leading-tight">
                          {itemMeta.defaultLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step 1: Select Button Count */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span>1. How many buttons to show on bottom bar:</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[3, 4, 5, 6].map((count) => {
                  const isSelected = navConfig.buttonCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handleButtonCountChange(count)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                    >
                      <span className="text-sm font-black font-mono">{count}</span>
                      <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium leading-none">
                        {count === 5 ? '5 Buttons (Default)' : `${count} Buttons`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Assign Pages/Actions to each Slot */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>2. Select which buttons / pages to show:</span>
                <span className="text-[10px] font-normal text-slate-400">Tap star to highlight button</span>
              </label>

              <div className="space-y-2">
                {Array.from({ length: navConfig.buttonCount }).map((_, slotIdx) => {
                  const currentItemId = navConfig.items[slotIdx] || 'dashboard';
                  const currentMeta = AVAILABLE_NAV_ITEMS.find((x) => x.id === currentItemId) || AVAILABLE_NAV_ITEMS[1];
                  const CurrentIcon = currentMeta.icon;
                  const isHighlighted = slotIdx === navConfig.highlightIndex;

                  const slotLabel =
                    slotIdx === 0
                      ? 'Button 1 (Left)'
                      : slotIdx === navConfig.buttonCount - 1
                        ? `Button ${slotIdx + 1} (Right)`
                        : slotIdx === Math.floor(navConfig.buttonCount / 2)
                          ? `Button ${slotIdx + 1} (Center)`
                          : `Button ${slotIdx + 1}`;

                  return (
                    <div
                      key={slotIdx}
                      className={`p-2.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${isHighlighted
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/80'
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${isHighlighted
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                        >
                          <CurrentIcon className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {slotLabel}
                            </span>
                            {isHighlighted && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                <Sparkles className="w-2.5 h-2.5" /> Highlighted FAB
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 truncate block">
                            {currentMeta.isAction ? 'Action trigger' : 'Navigates to page'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        {/* Page / Action Selection Dropdown */}
                        <select
                          value={currentItemId}
                          onChange={(e) => handleSlotItemChange(slotIdx, e.target.value as BottomNavActionId)}
                          className="flex-1 sm:flex-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-100 outline-none shadow-xs cursor-pointer min-w-[170px]"
                        >
                          <optgroup label="Actions">
                            <option value="add">➕ Quick Add (+ New Entry)</option>
                          </optgroup>
                          <optgroup label="Pages & Views">
                            <option value="dashboard">🏠 Home (Dashboard)</option>
                            <option value="history">📋 Cash Book History</option>
                            <option value="calendar">📅 Calendar View</option>
                            <option value="reminders">🔔 Bill &amp; Task Reminders</option>
                            <option value="analytics">📊 Analytics &amp; Reports</option>
                            <option value="shopping">🛒 Shopping List</option>
                            <option value="goals">🎯 Savings Goals</option>
                            <option value="debts">🤝 Debts &amp; Loans</option>
                            <option value="categories">🏷️ Categories</option>
                            <option value="warranties">🛡️ Warranty Tracker</option>
                            <option value="calculator">🧮 Cash Calculator</option>
                            <option value="notes">📝 Notes &amp; Memos</option>
                            <option value="settings">⚙️ Settings</option>
                            <option value="trash">🗑️ Recycle Bin</option>
                          </optgroup>
                        </select>

                        {/* Highlight Toggle Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleSlotHighlight(slotIdx)}
                          className={`p-1.5 rounded-lg border text-xs font-bold transition-all shrink-0 flex items-center justify-center cursor-pointer ${isHighlighted
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500'
                            }`}
                          title={isHighlighted ? 'Remove highlighted style' : 'Set as highlighted FAB button (like plus button)'}
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Highlighted Button Selector (Elevated FAB) */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>3. Which button to highlight (Elevated FAB):</span>
                </label>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                The highlighted button is raised above the dock in a prominent circular FAB button with vibrant green shadow (just like the original + button).
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setNavConfig({ ...navConfig, highlightIndex: -1 });
                  }}
                  className={`p-2 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer ${navConfig.highlightIndex === -1
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                >
                  None (Flat Bar)
                </button>

                {Array.from({ length: navConfig.buttonCount }).map((_, idx) => {
                  const itemMeta = AVAILABLE_NAV_ITEMS.find((x) => x.id === navConfig.items[idx]) || AVAILABLE_NAV_ITEMS[1];
                  const isSelected = navConfig.highlightIndex === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setNavConfig({ ...navConfig, highlightIndex: idx });
                      }}
                      className={`p-2 rounded-lg text-xs font-bold border transition-all text-center truncate cursor-pointer ${isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                    >
                      Button {idx + 1}: {itemMeta.defaultLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Header Style Card */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Header Style</h3>
                <p className="text-xs text-slate-400">Choose top navigation appearance and scroll behavior</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Option A: Classic Floating Sheet (The signature look) */}
              <button
                type="button"
                onClick={() => handleHeaderStyleChange('classic')}
                className={`p-3 rounded-md border text-left transition-all ${headerStyle === 'classic'
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                  }`}
              >
                <div className="flex flex-col items-center justify-center mb-2 w-full h-11 bg-slate-100 dark:bg-slate-900/60 rounded-md p-1 relative overflow-hidden">
                  <div className="w-full h-3.5 bg-emerald-600/70 rounded-xs mb-1" />
                  <div className="w-full flex-1 bg-white dark:bg-slate-800 rounded-t-lg shadow-sm border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className={`text-xs font-bold text-center ${headerStyle === 'classic' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
                  }`}>
                  Floating Sheet
                </div>
                <p className="text-[10px] text-slate-400 text-center leading-tight mt-0.5">
                  Deep header at top that collapses to sticky bar on scroll
                </p>
              </button>

              {/* Option B: Sticky Bar */}
              <button
                type="button"
                onClick={() => handleHeaderStyleChange('sticky')}
                className={`p-3 rounded-md border text-left transition-all ${headerStyle === 'sticky'
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                  }`}
              >
                <div className="flex flex-col items-center justify-between mb-2 w-full h-11 bg-slate-100 dark:bg-slate-900/60 rounded-md p-1 relative overflow-hidden">
                  <div className="w-full h-4 bg-emerald-600 rounded-xs flex items-center justify-center text-[8px] text-white font-mono shadow-xs">
                    Sticky Top
                  </div>
                  <div className="w-full h-4 bg-white dark:bg-slate-800 rounded-xs border border-dashed border-slate-300 dark:border-slate-600" />
                </div>
                <div className={`text-xs font-bold text-center ${headerStyle === 'sticky' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
                  }`}>
                  Sticky Bar
                </div>
                <p className="text-[10px] text-slate-400 text-center leading-tight mt-0.5">
                  Always compact bar fixed to the top
                </p>
              </button>
            </div>
          </div>

          {/* Scrolled Summary Stats Position Card */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Scrolled Summary Bar</h3>
                <p className="text-xs text-slate-400">Where to show compact In / Out / Balance stats when scrolling</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleStickyStatsPosChange('bottom')}
                className={`p-2.5 rounded-md border text-center transition-all flex flex-col items-center justify-between ${stickyStatsPos === 'bottom'
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                  }`}
              >
                <div className="flex flex-col justify-end mb-2 w-full h-10 bg-slate-100 dark:bg-slate-900/60 rounded-md p-1 gap-0.5">
                  <div className="w-full h-2.5 bg-emerald-500/80 rounded-2xs text-[6px] text-white font-mono flex items-center justify-center">
                    In • Out • Bal
                  </div>
                  <div className="grid grid-cols-2 gap-0.5 w-full">
                    <div className="h-2.5 bg-emerald-600 rounded-2xs" />
                    <div className="h-2.5 bg-rose-600 rounded-2xs" />
                  </div>
                </div>
                <div className={`text-[11px] font-bold ${stickyStatsPos === 'bottom' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
                  }`}>
                  Above Cash In/Out
                </div>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                  Docked above bottom buttons
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleStickyStatsPosChange('top')}
                className={`p-2.5 rounded-md border text-center transition-all flex flex-col items-center justify-between ${stickyStatsPos === 'top'
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                  }`}
              >
                <div className="flex flex-col justify-start mb-2 w-full h-10 bg-slate-100 dark:bg-slate-900/60 rounded-md p-1 gap-0.5">
                  <div className="w-full h-2.5 bg-slate-400/50 dark:bg-slate-700 rounded-2xs" />
                  <div className="w-full h-3 bg-emerald-500/80 rounded-2xs text-[6px] text-white font-mono flex items-center justify-center">
                    In • Out • Bal
                  </div>
                </div>
                <div className={`text-[11px] font-bold ${stickyStatsPos === 'top' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
                  }`}>
                  Below Header
                </div>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                  Attached under top header
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleStickyStatsPosChange('off')}
                className={`p-2.5 rounded-md border text-center transition-all flex flex-col items-center justify-between ${stickyStatsPos === 'off'
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                  }`}
              >
                <div className="flex items-center justify-center mb-2 w-full h-10 bg-slate-100 dark:bg-slate-900/60 rounded-md p-1">
                  <span className="text-[9px] font-mono text-slate-400">Off</span>
                </div>
                <div className={`text-[11px] font-bold ${stickyStatsPos === 'off' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
                  }`}>
                  Hidden
                </div>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                  Only show main top card
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW: TIME & DATE SETTINGS PAGE (`datetime`)               */}
      {/* ========================================================== */}
      {subPage === 'datetime' && (
        <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Time & Date Settings
            </span>
          </div>

          {/* 1. Live Digital Clock & System Time Banner */}
          <div className="p-4 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {timeMode === 'auto' ? 'Active System Clock' : 'Manual App Clock'}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {getTimezone()}
              </span>
            </div>

            <LiveDigitalClock
              timeFormat={timeFormat}
              dateFormat={dateFormat}
              timeMode={timeMode}
              manualTime={manualTime}
            />
          </div>

          {/* 2. Time Format (12h vs 24h) */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Time Format</h3>
                <p className="text-xs text-slate-400">Choose 12-hour AM/PM or 24-hour military display</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleTimeFormatChange('12h')}
                className={`py-3 px-3 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all ${timeFormat === '12h'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                  }`}
              >
                <span className="font-bold text-sm">12-Hour</span>
                <span className="text-[11px] font-mono opacity-80">e.g. 02:30 PM</span>
              </button>

              <button
                type="button"
                onClick={() => handleTimeFormatChange('24h')}
                className={`py-3 px-3 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all ${timeFormat === '24h'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                  }`}
              >
                <span className="font-bold text-sm">24-Hour</span>
                <span className="text-[11px] font-mono opacity-80">e.g. 14:30</span>
              </button>
            </div>
          </div>

          {/* 3. Set Time (Time Source & Manual Configuration) */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Set Time Source</h3>
                <p className="text-xs text-slate-400">Sync with device system clock or manually set custom time</p>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleTimeModeChange('auto')}
                className={`py-2.5 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 border transition-all ${timeMode === 'auto'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
              >
                <span>⚡ Automatic (Device)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTimeModeChange('manual')}
                className={`py-2.5 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 border transition-all ${timeMode === 'manual'
                  ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
              >
                <span>🕒 Set Time Manually</span>
              </button>
            </div>

            {/* Manual Time Input & Controls (Visible when manual mode active) */}
            {timeMode === 'manual' && (
              <div className="mt-3 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-[10px] border border-amber-200/80 dark:border-amber-900/40 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Adjust Custom App Time
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const hh = String(now.getHours()).padStart(2, '0');
                      const mm = String(now.getMinutes()).padStart(2, '0');
                      handleSaveManualTime(`${hh}:${mm}`);
                    }}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Sync to Now
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={manualTime}
                    onChange={(e) => handleSaveManualTime(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-800 text-sm font-mono font-bold px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-white"
                  />
                  <div className="text-xs font-mono font-bold px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                    {formatTime(getEffectiveCurrentTime(), timeFormat)}
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Quick Presets
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'Morning', time: '09:00' },
                      { label: 'Noon', time: '12:00' },
                      { label: 'Evening', time: '18:00' },
                      { label: 'Night', time: '21:00' },
                    ].map((preset) => (
                      <button
                        key={preset.time}
                        type="button"
                        onClick={() => handleSaveManualTime(preset.time)}
                        className={`py-1.5 px-2 rounded-md text-[11px] font-bold font-mono border transition-all text-center ${manualTime === preset.time
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Date Format */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Date Format</h3>
                <p className="text-xs text-slate-400">Choose date layout shown across history and reports</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { format: 'YYYY-MM-DD' as DateFormat, label: 'YYYY-MM-DD', sub: '2026-11-15' },
                { format: 'DD/MM/YYYY' as DateFormat, label: 'DD/MM/YYYY', sub: '15/11/2026' },
                { format: 'MM/DD/YYYY' as DateFormat, label: 'MM/DD/YYYY', sub: '11/15/2026' },
              ].map((df) => (
                <button
                  key={df.format}
                  type="button"
                  onClick={() => handleDateFormatChange(df.format)}
                  className={`py-2.5 px-2 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-0.5 border transition-all ${dateFormat === df.format
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                    }`}
                >
                  <span className="font-mono text-xs">{df.label}</span>
                  <span className="text-[10px] font-mono text-slate-400">{df.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 5. Live Transaction Preview Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-[10px] border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Live Preview in CashFlow
            </span>
            <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-md border border-slate-100 dark:border-slate-700 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                  ☕
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Coffee & Refreshment
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                    {formatDate(getEffectiveCurrentTime(), dateFormat)} • <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatTime(getEffectiveCurrentTime(), timeFormat)}</span>
                  </div>
                </div>
              </div>
              <div className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                -{getCurrencySymbol(currency)}3.50
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW C: BACKUP & RESTORE PAGE (`backup`)                  */}
      {/* ========================================================== */}
      {subPage === 'backup' && (
        <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Backup & Restore
            </span>
          </div>

          {/* Storage Mode Toggle Card */}
          <div className="p-4 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Active Storage Mode</h3>
                <p className="text-xs text-slate-400">
                  {getAppMode() === 'offline' ? 'Storing 100% offline on this device' : 'Connected to cloud REST API'}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${getAppMode() === 'offline' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                {getAppMode() === 'offline' ? 'On-Device' : 'Cloud Sync'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (getAppMode() !== 'offline') {
                    if (confirm('Switch to On-Device Mode?')) {
                      setAppMode('offline');
                      const offUser = OfflineStorage.getUser();
                      onUpdateUser(offUser);
                      onDataRestored();
                    }
                  }
                }}
                className={`py-2 px-2.5 rounded-md border text-xs font-bold whitespace-nowrap transition-all ${getAppMode() === 'offline'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
              >
                On-Device
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (getAppMode() !== 'online') {
                    if (confirm('Switch to Cloud Sync Mode?')) {
                      setAppMode('online');
                      await removeAuthToken();
                      onLogout();
                    }
                  }
                }}
                className={`py-2 px-2.5 rounded-md border text-xs font-bold whitespace-nowrap transition-all ${getAppMode() === 'online'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
              >
                Cloud Sync
              </button>
            </div>
          </div>

          {/* 1. Unified Google Drive Backup & Restore Card (Cash Book Style) */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Cloud className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                    <span className="truncate">Google Drive Backup</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase whitespace-nowrap shrink-0 ${isDriveConnected
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                      }`}>
                      {isDriveConnected ? 'Connected' : '1-Click Ready'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Export or restore your cash book directly with Google Drive
                  </p>
                </div>
              </div>
            </div>

            {/* Connected Gmail Account Pill (when signed in) */}
            {isDriveConnected && (
              <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-md border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  {driveProfile?.picture ? (
                    <img
                      src={driveProfile.picture}
                      alt=""
                      className="w-7 h-7 rounded-full border border-emerald-500/40 shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {driveProfile?.name ? driveProfile.name[0].toUpperCase() : 'G'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {driveProfile?.name || 'Google Account'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {driveProfile?.email || 'Google Drive Connected'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDisconnectDrive}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md border border-rose-200 dark:border-rose-900 whitespace-nowrap transition-colors shrink-0 ml-2"
                >
                  Disconnect
                </button>
              </div>
            )}

            {/* Primary 1-Click Actions (Always Enabled — Cash Book Style) */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleBackupToDrive}
                disabled={backupLoading}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold whitespace-nowrap shadow-xs active:scale-98 transition-all disabled:opacity-50"
              >
                {backupLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <FolderUp className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>Export to Drive</span>
              </button>

              {isDriveConnected ? (
                <button
                  type="button"
                  onClick={handleListDriveBackups}
                  disabled={restoreLoading}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-md text-xs font-bold whitespace-nowrap active:scale-98 transition-all disabled:opacity-50"
                >
                  {restoreLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <FolderDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <span>Restore Drive</span>
                </button>
              ) : (
                <label className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-md text-xs font-bold whitespace-nowrap active:scale-98 transition-all cursor-pointer">
                  <FolderDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Restore Drive</span>
                  <input
                    type="file"
                    accept=".json,application/json,text/plain"
                    onChange={handleUploadLocalBackup}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Automated Sync on Save Toggle */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-md flex items-center justify-between border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block leading-tight">
                    Automated Sync on Every Record
                  </span>
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    Silently uploads backup to Drive when you add or edit a transaction
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoDriveSync}
                disabled={!isDriveConnected}
                onChange={(e) => handleToggleAutoSync(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded cursor-pointer disabled:opacity-40"
              />
            </div>

            {/* Direct Device JSON Download & Developer OAuth Config */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadCSVBackup}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 rounded-md text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 transition-all"
                  title="Export all transactions as CSV spreadsheet"
                >
                  <Download className="w-3 h-3 shrink-0" />
                  <span>Download CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadLocalBackup}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 transition-all"
                >
                  <Download className="w-3 h-3 shrink-0" />
                  <span>Download JSON</span>
                </button>
                <label className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0 cursor-pointer">
                  <Upload className="w-3 h-3 shrink-0" />
                  <span>Import JSON</span>
                  <input
                    type="file"
                    accept=".json,application/json,text/plain"
                    onChange={handleUploadLocalBackup}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => setShowClientIdConfig(!showClientIdConfig)}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium whitespace-nowrap"
              >
                {showClientIdConfig ? 'Hide API Key' : 'API Settings'}
              </button>
            </div>

            {/* Optional Developer Google OAuth Client ID Configuration */}
            {showClientIdConfig && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-md space-y-2 animate-in fade-in">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Google OAuth Client ID (Optional)</span>
                  <span className="text-[10px] text-slate-400 font-normal">For silent background API sync</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    placeholder="xxxx.apps.googleusercontent.com"
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-900 dark:text-white outline-none font-mono placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveClientId}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold whitespace-nowrap transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Advanced Manual Token Collapsible Toggle */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => setIsDriveExpanded(!isDriveExpanded)}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium inline-flex items-center gap-1"
              >
                <span>Advanced: Manual Access Token</span>
                {isDriveExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            </div>

            {/* Expandable Drive Manual Token Configuration */}
            {isDriveExpanded && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-2 animate-in slide-in-from-top-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Manual Google OAuth Token (Optional Fallback)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={driveToken}
                      onChange={(e) => setDriveToken(e.target.value)}
                      placeholder="Paste manual Bearer token..."
                      className="flex-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <button
                      onClick={handleSaveDriveToken}
                      className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-xs font-bold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Drive Backup List */}
            {showDriveList && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-[10px] border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <span>Cloud Snapshots</span>
                  <button onClick={() => setShowDriveList(false)} className="text-xs text-slate-400 hover:underline">
                    Close
                  </button>
                </div>
                {driveBackups.length === 0 ? (
                  <div className="text-xs text-slate-400 py-1">No backups found in Google Drive app folder.</div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {driveBackups.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs"
                      >
                        <div className="truncate mr-2">
                          <div className="font-semibold truncate text-slate-800 dark:text-slate-200 text-xs">
                            {file.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(file.createdTime).toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestoreFromDrive(file.id)}
                          className="px-2 py-0.5 bg-emerald-600 text-white rounded text-xs font-bold shrink-0"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Reset / Delete All Data Danger Card */}
          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-[10px] border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Reset / Delete All Data</span>
              </h3>
              <p className="text-xs text-rose-700/80 dark:text-rose-300/70 mt-0.5">
                Permanently erase all transactions, budgets, and custom categories
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setResetConfirmText('');
                setIsResetDataModalOpen(true);
              }}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold whitespace-nowrap shrink-0 shadow-xs transition-all active:scale-98"
            >
              Delete All
            </button>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW D: SECURITY & PIN LOCK PAGE (`security`)             */}
      {/* ========================================================== */}
      {subPage === 'security' && (
        <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Security &amp; PIN
            </span>
          </div>

          {/* 2. Privacy Mode Toggle Card (Synced with Header Eye Icon) */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${privacyMode
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300'
                }`}>
                {privacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Privacy Balance Blur
                </h3>
                <p className="text-xs text-slate-400">
                  Blur all monetary figures when opening the app in public
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={privacyMode}
              onClick={() => {
                triggerHaptic('light');
                setPrivacyMode(!privacyMode);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${privacyMode ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${privacyMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>

          {/* Phone Lock (Fingerprint / Face / Screen Lock) Card */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${biometricEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300'
                  }`}>
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Phone Lock (Fingerprint / Face / Pattern)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Use your phone&apos;s own screen lock to open CashFlow
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={biometricEnabled}
                onClick={async () => {
                  triggerHaptic('light');
                  if (biometricEnabled) {
                    disableBiometric();
                    setBiometricEnabledState(false);
                    setMessage({ type: 'success', text: 'Phone Lock turned off.' });
                    return;
                  }
                  const res = await enableBiometricUnlock();
                  if (res.success) {
                    setBiometricEnabledState(true);
                    setMessage({ type: 'success', text: res.message });
                  } else {
                    setMessage({ type: 'error', text: res.message });
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${biometricEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${biometricEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {biometricEnabled && !isPinSet && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  Protected with device screen lock
                </span>
                <button
                  type="button"
                  onClick={() => triggerLockAppNow()}
                  className="px-2.5 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
                >
                  <Lock className="w-3 h-3" />
                  <span>Lock Now</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. App Security PIN Card (Clean Banking-Grade UX) */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${isPinSet
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  }`}>
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>App Security PIN</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${isPinSet
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                      }`}>
                      {isPinSet ? 'Active' : 'Off'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {isPinSet
                      ? 'Protected with 4-digit passcode'
                      : 'Lock CashFlow with a 4-digit passcode'}
                  </p>
                </div>
              </div>

              {!isPinSet ? (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setPinModalState({ open: true, mode: 'setup' });
                  }}
                  className="px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shrink-0 transition-all active:scale-95"
                >
                  Set Up PIN
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => triggerLockAppNow()}
                  className="px-2.5 py-1.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1 shrink-0 transition-all active:scale-95"
                >
                  <Lock className="w-3 h-3" />
                  <span>Lock Now</span>
                </button>
              )}
            </div>

            {/* Active PIN Actions + Auto-Lock Timer (Shown ONLY when PIN is enabled) */}
            {isPinSet && (
              <>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setPinModalState({ open: true, mode: 'change' });
                    }}
                    className="py-2 px-3 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold transition-all active:scale-[0.99]"
                  >
                    Change PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setPinModalState({ open: true, mode: 'disable' });
                    }}
                    className="py-2 px-3 rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 border border-rose-200/70 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all active:scale-[0.99]"
                  >
                    Turn Off PIN
                  </button>
                </div>

                {/* Auto-Lock Timeout Selector */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <Timer className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Auto-Lock When Switching Apps</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {(
                      [
                        { id: 'immediate', label: 'Immediately' },
                        { id: '1m', label: 'After 1 min' },
                        { id: '5m', label: 'After 5 min' },
                        { id: 'launch_only', label: 'Launch Only' },
                      ] as { id: AutoLockTimeout; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setAutoLockTimeout(opt.id);
                          setAutoLockTimeoutState(opt.id);
                          setMessage({ type: 'success', text: `Auto-lock set to ${opt.label}` });
                        }}
                        className={`py-1.5 px-2 rounded-md border text-[11px] font-bold transition-all ${autoLockTimeout === opt.id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Cloud Account Password */}
          {getAppMode() === 'online' && (
            <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">Cloud Password</h3>
                  <p className="text-xs text-slate-400">Change cloud account credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md text-xs font-bold transition-all"
              >
                Update
              </button>
            </div>
          )}

          {/* Privacy Note */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-[10px] border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Offline First Privacy</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Your financial transactions are never tracked or shared. All on-device records remain encrypted strictly on your physical phone storage.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW E: ACCOUNT INFO & SERVER PAGE (`account`)             */}
      {/* ========================================================== */}
      {subPage === 'account' && (
        <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Account Info
            </span>
          </div>

          {/* Profile Card */}
          {(() => {
            const isGuestUser =
              user.id === 'device-offline-user' ||
              user.email === 'offline@device.local' ||
              user.email?.includes('@device.local') ||
              user.email === 'guest@cashflow.app' ||
              user.full_name === 'Offline Account' ||
              user.full_name === 'Guest Account' ||
              getAppMode() === 'offline';
            const displayUserName = isGuestUser ? 'Guest Account' : user.full_name || 'Active User';
            const displayUserEmail = isGuestUser ? 'guest@cashflow.app' : user.email;

            return (
              <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg font-mono">
                    {displayUserName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {displayUserName}
                      </h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${isGuestUser
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        }`}>
                        {isGuestUser ? 'Guest (On-Device)' : 'Cloud'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono truncate">{displayUserEmail}</p>
                  </div>
                </div>

                {/* Edit Profile Name */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Display Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={displayUserName}
                      className="flex-1 bg-slate-50 dark:bg-slate-900/60 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={handleSaveName}
                      className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-xs font-bold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Backend API Server Endpoint Card */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">API Server Endpoint</h3>
                <p className="text-xs text-slate-400">Configure host URL (for LAN & Windows sync)</p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrlState(e.target.value)}
                placeholder="http://192.168.177.131:18080/api"
                className="flex-1 bg-slate-50 dark:bg-slate-900/60 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono outline-none"
              />
              <button
                onClick={handleSaveApiUrl}
                className="px-3.5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-xs font-bold"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Gemini AI Smart Receipt Scanner Configuration */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">Smart Receipt Scanner (AI)</h3>
                  <p className="text-xs text-slate-400">Google Gemini Multimodal Vision API</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${geminiKey ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                {geminiKey ? 'Active' : 'Setup Required'}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Auto-extracts total, store name, date, and category from receipt &amp; bill photos. Free from Google AI Studio.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={geminiKey}
                onChange={(e) => setGeminiKeyState(e.target.value)}
                placeholder="AIzaSy... (Paste Gemini API Key)"
                className="flex-1 bg-slate-50 dark:bg-slate-900/60 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono outline-none"
              />
              <button
                onClick={handleSaveGeminiKey}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-all shadow-xs"
              >
                Save
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold text-[11px]"
              >
                <span>Get Free Gemini Key (aistudio.google.com)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              {geminiKey && (
                <button
                  type="button"
                  onClick={handleClearGeminiKey}
                  className="text-rose-500 hover:text-rose-600 text-[11px] font-medium"
                >
                  Clear Key
                </button>
              )}
            </div>
          </div>

          {/* Danger Zone: Wipe / Delete */}
          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-[10px] border border-rose-200/80 dark:border-rose-900/60 space-y-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
              <ShieldAlert className="w-4 h-4" />
              <span>Danger Zone</span>
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300/80 leading-relaxed">
              Resetting all data will permanently remove all transactions, budgets, recurring schedules, and custom categories.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setResetConfirmText('');
                  setIsResetDataModalOpen(true);
                }}
                className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset / Delete All Data</span>
              </button>

              {getAppMode() === 'online' && (
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="py-2 px-3 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md text-xs font-bold transition-all"
                >
                  Delete Cloud Account
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW F: LEDGERS & CATEGORIES PAGE (`ledgers`)              */}
      {/* ========================================================== */}
      {subPage === 'ledgers' && (
        <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Sub-Accounts & Spaces
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
            {/* Sub-Accounts */}
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Sub-Accounts</div>
                  <div className="text-xs text-slate-400">{accounts.length} active spaces (Personal, Family...)</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Monthly Budgets */}
            <button
              onClick={() => setIsBudgetModalOpen(true)}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Monthly Budgets</div>
                  <div className="text-xs text-slate-400">{budgetOverview?.budgets?.length || 0} category spending limits</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Recurring Rules */}
            <button
              onClick={() => setIsRecurringModalOpen(true)}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Recurring Schedules</div>
                  <div className="text-xs text-slate-400">Automate repeating salaries & subscriptions</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Categories */}
            <button
              onClick={() => onNavigateToCategories ? onNavigateToCategories() : setIsCategoryModalOpen(true)}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Custom Categories</div>
                  <div className="text-xs text-slate-400">{categories.length} income & expense categories</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {/* Legal, Privacy & Google Play Compliance Links */}
      <div className="pt-2 pb-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
        <Link href="/privacy" className="hover:text-emerald-600 dark:hover:text-emerald-400 font-semibold transition-colors">
          Privacy Policy
        </Link>
        <span>•</span>
        <Link href="/terms" className="hover:text-emerald-600 dark:hover:text-emerald-400 font-semibold transition-colors">
          Terms of Service
        </Link>
        <span>•</span>
        <Link href="/delete-account" className="hover:text-rose-500 font-semibold transition-colors">
          Delete Account &amp; Data
        </Link>
      </div>

      {/* ========================================================== */}
      {/* MODALS (Kept available for actions on all sub-pages)        */}
      {/* ========================================================== */}
      <UpgradeProModal
        isOpen={isProModalOpen}
        onClose={() => setIsProModalOpen(false)}
      />

      <PinSetupModal
        isOpen={pinModalState.open}
        mode={pinModalState.mode}
        currentPin={typeof window !== 'undefined' ? localStorage.getItem('app_security_pin') : null}
        onClose={() => setPinModalState((prev) => ({ ...prev, open: false }))}
        onComplete={(newPin) => {
          if (newPin) {
            localStorage.setItem('app_security_pin', newPin);
            setAppPin(newPin);
            setIsPinSet(true);
            setMessage({
              type: 'success',
              text: pinModalState.mode === 'change' ? 'Security PIN updated!' : '4-digit Security PIN enabled!',
            });
          } else {
            localStorage.removeItem('app_security_pin');
            disableBiometric();
            setAppPin('');
            setIsPinSet(false);
            setBiometricEnabledState(false);
            setMessage({ type: 'success', text: 'App Security PIN turned off.' });
          }
        }}
      />

      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        categories={categories}
        currency={getCurrencySymbol(user.currency)}
        budgetOverview={budgetOverview}
        onRefresh={onDataRestored}
      />

      <RecurringModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        categories={categories}
        currency={getCurrencySymbol(user.currency)}
      />

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onRefresh={onDataRestored}
      />

      <AccountManagerModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        accounts={accounts}
        activeAccountId={activeAccountId}
        onSelectAccount={onSelectAccount}
        onRefresh={onRefreshAccounts}
        currency={getCurrencySymbol(user.currency)}
      />

      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onAccountDeleted={onLogout}
        userEmail={user.email}
      />

      {/* Reset / Delete All Data Confirmation Modal */}
      {isResetDataModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !isResettingData && setIsResetDataModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[12px] border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/70 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delete All Data?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  This will permanently delete all your transactions, budgets, recurring schedules, and custom categories. This action cannot be undone.
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmResetAllData} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Please type <span className="font-mono font-bold text-rose-600 dark:text-rose-400 select-all">delete all</span> to confirm:
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="delete all"
                  autoFocus
                  disabled={isResettingData}
                  className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-rose-500 dark:focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={isResettingData}
                  onClick={() => {
                    setIsResetDataModalOpen(false);
                    setResetConfirmText('');
                  }}
                  className="px-3.5 py-2 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetConfirmText.trim().toLowerCase() !== 'delete all' || isResettingData}
                  className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  {isResettingData ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete All Data</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
