'use client';

import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { User, BackupLog, Category, BudgetOverview } from '@/lib/types';
import { api, getApiUrl, setApiUrl, removeAuthToken, getAppMode, setAppMode } from '@/lib/api';
import { OfflineStorage } from '@/lib/offline-storage';
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
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
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
  ArrowUpRight,
  Loader2,
  ALargeSmall,
  Sliders
} from 'lucide-react';
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
} from '@/lib/ui-prefs';
import { FontSize, FONT_SIZE_OPTIONS, getStoredFontSize, setStoredFontSize } from '@/lib/font-size';
import BudgetModal from './BudgetModal';
import RecurringModal from './RecurringModal';
import CategoryManagerModal from './CategoryManagerModal';
import PasswordModal from './PasswordModal';
import DeleteAccountModal from './DeleteAccountModal';
import AccountManagerModal from './AccountManagerModal';
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
}

type SubPage = 'main' | 'theme' | 'backup' | 'security' | 'account' | 'ledgers' | 'datetime';

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
}: SettingsViewProps) {
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

  // Bottom bar quick-action style (mobile)
  const [bottomBarStyle, setBottomBarStyleState] = useState<BottomBarStyle>('fab');

  useEffect(() => {
    setBottomBarStyleState(getBottomBarStyle());
  }, []);

  const handleBottomBarStyleChange = (style: BottomBarStyle) => {
    setBottomBarStyleState(style);
    setBottomBarStyle(style);
  };

  // Header Style (Classic Floating Sheet vs Sticky Bar)
  const [headerStyle, setHeaderStyleState] = useState<HeaderStyle>('classic');
  const [stickyStatsPos, setStickyStatsPosState] = useState<StickyStatsPosition>('bottom');

  useEffect(() => {
    setHeaderStyleState(getHeaderStyle());
    setStickyStatsPosState(getStickyStatsPosition());
  }, []);

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

  useEffect(() => {
    // Read URL hash on load (e.g. #theme, #datetime, #backup, #security, #account, #ledgers)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (['theme', 'backup', 'security', 'account', 'ledgers', 'datetime', 'time'].includes(hash)) {
        setSubPage(hash === 'time' ? 'datetime' : (hash as SubPage));
      }

      const handleHashChange = () => {
        const h = window.location.hash.replace('#', '');
        if (['theme', 'backup', 'security', 'account', 'ledgers', 'datetime', 'time'].includes(h)) {
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
      return () => {
        window.removeEventListener('hashchange', handleHashChange);
      };
    }

    // Load API URL
    getApiUrl().then(setApiUrlState);
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
          .catch(() => {});
        transition.finished.finally(() => {
          document.documentElement.classList.remove('disable-transitions');
        });
        return;
      } catch {}
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
      setShowClientIdConfig(true);
      setMessage({
        type: 'error',
        text: 'Please configure your Google OAuth Client ID first to enable 1-click Google Sign-in.'
      });
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
      // Automatically refresh backups list
      try {
        const files = await GoogleDriveService.listBackups(res.token);
        setDriveBackups(files);
      } catch (e) {}
    } catch (err: any) {
      if (err.message === 'MISSING_CLIENT_ID') {
        setShowClientIdConfig(true);
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
    if (!isDriveConnected || !driveToken.trim()) {
      setIsDriveExpanded(true);
      setMessage({ type: 'error', text: 'Please connect Google Drive first.' });
      return;
    }

    try {
      setBackupLoading(true);
      setMessage(null);
      const backupData = await api.exportBackup();
      const res = await GoogleDriveService.uploadBackup(backupData, driveToken.trim());

      await api.recordBackupLog({
        file_id: res.id,
        file_name: res.name,
        record_size: 0,
      });

      setMessage({ type: 'success', text: `Backed up to Google Drive (${res.name})` });
    } catch (err: any) {
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

  const handleDownloadLocalBackup = async () => {
    try {
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `income_expense_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Local backup JSON downloaded successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to download local backup file.' });
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
          className={`p-3.5 rounded-[10px] flex items-center justify-between gap-2.5 text-xs font-medium border animate-in fade-in duration-150 ${
            message.type === 'success'
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
              <span>Settings</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">CashFlow Preferences</span>
          </div>

          {/* 1. Profile Summary Card (Tap to open 'account') */}
          <div
            onClick={() => navigateTo('account')}
            className="p-4 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-between cursor-pointer hover:border-emerald-500/80 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg font-mono">
                {(user.full_name || user.email || 'U')[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {user.full_name || 'Active User'}
                  </h3>
                  {getAppMode() === 'offline' ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      On-Device
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Cloud Sync
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[200px]">
                  {user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-slate-400 group-hover:text-emerald-500 transition-colors">
              <span className="text-xs font-semibold">Account</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* 2. Menu Navigation Group: PREFERENCES & APPEARANCE */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
              Appearance & Localization
            </div>
            <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/90 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
              {/* Theme & Display */}
              <button
                onClick={() => navigateTo('theme')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Theme & Currency</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Dark / Light theme, currency symbol</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 capitalize">
                    {themeMode} • {getCurrencySymbol(user.currency)} • {decimalMode === '0' ? 'No Dec' : '2 Dec'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>

              {/* Time & Date Settings */}
              <button
                onClick={() => navigateTo('datetime')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Time & Date Settings</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Set time, 12h/24h format, date style</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    {timeFormat === '12h' ? '12-Hour' : '24-Hour'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            </div>
          </div>

          {/* 3. Menu Navigation Group: DATA & STORAGE */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
              Data & Storage
            </div>
            <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/90 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
              {/* Backup & Restore */}
              <button
                onClick={() => navigateTo('backup')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Backup & Restore</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Google Drive sync, JSON export & import</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                    isDriveConnected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                    {isDriveConnected ? 'Drive Connected' : 'Local Only'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>

              {/* Accounts & Sub-Accounts */}
              <button
                onClick={() => navigateTo('ledgers')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Sub-Accounts & Categories</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Multi-account spaces, budgets, categories</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {accounts.length} sub-accounts
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            </div>
          </div>

          {/* 4. Menu Navigation Group: SECURITY & ACCOUNT */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
              Security & Privacy
            </div>
            <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/90 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
              {/* Security & PIN */}
              <button
                onClick={() => navigateTo('security')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Security & PIN Lock</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">App lock PIN code, cloud password</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                    isPinSet ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {isPinSet ? 'PIN Active' : 'Off'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>

              {/* Account Info & Server */}
              <button
                onClick={() => navigateTo('account')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-300">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Account Info & Server</div>
                    <div className="text-xs text-slate-400">Profile name, backend server host</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Quick Sign Out Button */}
          <div className="pt-2">
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 px-4 rounded-[10px] bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>{getAppMode() === 'offline' ? 'Exit Offline Mode' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW B: THEME & DISPLAY PAGE (`theme`)                    */}
      {/* ========================================================== */}
      {subPage === 'theme' && (
        <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              onClick={() => navigateTo('main')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Settings</span>
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Theme & Currency
            </span>
          </div>

          {/* Appearance Card */}
          <div 
            className="appearance-theme-card bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3 transition-colors duration-200"
            style={themeMode === 'forest' ? {
              backgroundColor: `color-mix(in srgb, ${forestColor} 18%, white)`,
              borderColor: `color-mix(in srgb, ${forestColor} 35%, rgba(0, 0, 0, 0.12))`,
            } : undefined}
          >
            <div className="flex items-center gap-3">
              <div 
                className="theme-card-icon w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400 transition-colors"
                style={themeMode === 'forest' ? {
                  backgroundColor: `color-mix(in srgb, ${forestColor} 32%, white)`,
                  color: `color-mix(in srgb, ${forestColor} 80%, black)`,
                } : undefined}
              >
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Appearance Theme</h3>
                <p className="text-xs text-slate-400">Select application visual color scheme</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                type="button"
                onClick={(e) => handleThemeChange('forest', e)}
                style={themeMode === 'forest' ? {
                  borderColor: forestColor,
                  backgroundColor: `color-mix(in srgb, ${forestColor} 22%, white)`,
                  color: '#133827',
                } : undefined}
                className={`py-3 px-2 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1.5 border transition-all ${
                  themeMode === 'forest'
                    ? 'ring-2 font-black shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span 
                    className="w-3 h-3 rounded-full border border-white/60 shadow-2xs shrink-0" 
                    style={{ backgroundColor: forestColor }}
                  />
                  <span 
                    className="text-[10px] px-1 py-0.2 rounded text-white font-extrabold uppercase tracking-tight"
                    style={{ backgroundColor: forestColor }}
                  >
                    Dribbble
                  </span>
                </div>
                <span>Forest Sheet</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleThemeChange('volt', e)}
                className={`py-3 px-2 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1.5 border transition-all ${
                  themeMode === 'volt'
                    ? 'border-yellow-400 bg-yellow-400/10 text-yellow-300 ring-2 ring-yellow-400/30'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-[10px] px-1 py-0.2 rounded bg-yellow-400 text-slate-950 font-extrabold uppercase tracking-tight">New</span>
                </div>
                <span>Volt (Dribbble)</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleThemeChange('dark', e)}
                className={`py-3 px-2 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1.5 border transition-all ${
                  themeMode === 'dark'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <Moon className="w-4 h-4 text-emerald-500" />
                <span>Dark</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleThemeChange('light', e)}
                className={`py-3 px-2 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1.5 border transition-all ${
                  themeMode === 'light'
                    ? 'border-emerald-700 bg-emerald-100/60 text-emerald-900 ring-2 ring-emerald-700/30 font-extrabold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Sun className="w-4 h-4 text-emerald-700" />
                  <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-800 text-white font-extrabold uppercase tracking-tight">New</span>
                </div>
                <span>Light (Forest)</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleThemeChange('ocean', e)}
                className={`py-3 px-2 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1.5 border transition-all ${
                  themeMode === 'ocean'
                    ? 'border-cyan-400 bg-cyan-400/10 text-cyan-700 dark:text-cyan-300 ring-2 ring-cyan-400/30'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Waves className="w-4 h-4 text-cyan-400" />
                  <span className="text-[10px] px-1 py-0.2 rounded bg-gradient-to-r from-cyan-400 to-sky-500 text-slate-950 font-extrabold uppercase tracking-tight">New</span>
                </div>
                <span>Midnight Ocean</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleThemeChange('amethyst', e)}
                className={`py-3 px-2 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1.5 border transition-all ${
                  themeMode === 'amethyst'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/30'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Gem className="w-4 h-4 text-purple-400" />
                  <span className="text-[10px] px-1 py-0.2 rounded bg-gradient-to-r from-purple-500 to-violet-600 text-white font-extrabold uppercase tracking-tight">New</span>
                </div>
                <span>Royal Amethyst</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleThemeChange('sunset', e)}
                className={`py-3 px-2 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1.5 border transition-all ${
                  themeMode === 'sunset'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-2 ring-orange-500/30'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Sunset className="w-4 h-4 text-orange-500" />
                  <span className="text-[10px] px-1 py-0.2 rounded bg-gradient-to-r from-orange-500 to-rose-500 text-white font-extrabold uppercase tracking-tight">New</span>
                </div>
                <span>Sunset Coral</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleThemeChange('system', e)}
                className={`py-3 px-2 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1.5 border transition-all ${
                  themeMode === 'system'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <Monitor className="w-4 h-4 text-indigo-500" />
                <span>Auto</span>
              </button>
            </div>

            {/* Header Color Customizer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full shadow-2xs border border-white/60 shrink-0"
                    style={{ backgroundColor: forestColor }}
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                      Header Accent Color
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Curated shades & custom color picker for the Forest Sheet theme
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md">
                  {forestColor.toUpperCase()}
                </span>
              </div>

              {/* Preset Swatches */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-0.5">
                {HEADER_COLOR_PRESETS.map((preset) => {
                  const isSelected = forestColor.toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => handleForestColorChange(preset.hex)}
                      title={`${preset.name} (${preset.hex})`}
                      className={`group relative p-1.5 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                        isSelected
                          ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <span
                        className="w-6 h-6 rounded-full shadow-2xs border border-black/10 flex items-center justify-center transition-transform group-hover:scale-105 shrink-0"
                        style={{ backgroundColor: preset.hex }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </span>
                      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate w-full text-center">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Picker Row */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex-1">
                  <label
                    htmlFor="custom-color-picker"
                    className="w-6 h-6 rounded-full cursor-pointer shadow-2xs border border-black/15 shrink-0 relative overflow-hidden flex items-center justify-center active:scale-95 transition-transform"
                    style={{ backgroundColor: forestColor }}
                    title="Click to open color palette"
                  >
                    <input
                      id="custom-color-picker"
                      type="color"
                      value={forestColor}
                      onChange={(e) => handleForestColorChange(e.target.value)}
                      className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider leading-tight">
                      Custom Color (Hex)
                    </span>
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
                      className="bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-none w-full uppercase"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleForestColorChange('#81b9a1')}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors shrink-0"
                  title="Reset to default Sage Mist (#81b9a1)"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* System Font Size Card */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <ALargeSmall className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">System Font Size</h3>
                <p className="text-xs text-slate-400">Scale typography from small to large across the app</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {FONT_SIZE_OPTIONS.map((opt) => {
                const isSelected = fontSize === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleFontSizeChange(opt.id)}
                    className={`p-3 rounded-md border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    <div className="h-7 flex items-center justify-center">
                      <span
                        className={`font-black text-slate-800 dark:text-slate-100 ${
                          opt.id === 'small'
                            ? 'text-xs'
                            : opt.id === 'normal'
                            ? 'text-sm'
                            : opt.id === 'large'
                            ? 'text-base'
                            : 'text-lg'
                        }`}
                      >
                        Aa
                      </span>
                    </div>
                    <div
                      className={`text-xs font-bold ${
                        isSelected
                          ? 'text-blue-700 dark:text-blue-300 font-extrabold'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {opt.scaleLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions Style Card */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <PlusCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Bottom Menu Style</h3>
                <p className="text-xs text-slate-400">Choose mobile bottom navigation layout</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Option A: Bottom Tabs with Add (+) */}
              <button
                type="button"
                onClick={() => handleBottomBarStyleChange('fab')}
                className={`p-3 rounded-md border text-left transition-all ${
                  bottomBarStyle === 'fab'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center justify-center mb-2">
                  <span className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Plus className="w-4.5 h-4.5 stroke-[2.6]" />
                  </span>
                </div>
                <div className={`text-xs font-bold text-center ${
                  bottomBarStyle === 'fab' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
                }`}>
                  Bottom Tabs (+)
                </div>
                <p className="text-[10px] text-slate-400 text-center leading-tight mt-0.5">
                  Navigation bar with center Add (+) button
                </p>
              </button>

              {/* Option B: Dual Cash In / Cash Out Dock (No Tab Bar) */}
              <button
                type="button"
                onClick={() => handleBottomBarStyleChange('inout')}
                className={`p-3 rounded-md border text-left transition-all ${
                  bottomBarStyle === 'inout'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 mb-2 w-full">
                  <span className="flex-1 py-1.5 px-1.5 rounded-md bg-emerald-600 text-white flex items-center justify-center gap-1 text-[10px] font-bold shadow-xs">
                    <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.8]" />
                    <span>In</span>
                  </span>
                  <span className="flex-1 py-1.5 px-1.5 rounded-md bg-rose-600 text-white flex items-center justify-center gap-1 text-[10px] font-bold shadow-xs">
                    <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.8]" />
                    <span>Out</span>
                  </span>
                </div>
                <div className={`text-xs font-bold text-center ${
                  bottomBarStyle === 'inout' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
                }`}>
                  Cash In &amp; Out
                </div>
                <p className="text-[10px] text-slate-400 text-center leading-tight mt-0.5">
                  Two full-width buttons without bottom menu bar
                </p>
              </button>
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
                className={`p-3 rounded-md border text-left transition-all ${
                  headerStyle === 'classic'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex flex-col items-center justify-center mb-2 w-full h-11 bg-slate-100 dark:bg-slate-900/60 rounded-md p-1 relative overflow-hidden">
                  <div className="w-full h-3.5 bg-emerald-600/70 rounded-xs mb-1" />
                  <div className="w-full flex-1 bg-white dark:bg-slate-800 rounded-t-lg shadow-sm border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className={`text-xs font-bold text-center ${
                  headerStyle === 'classic' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
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
                className={`p-3 rounded-md border text-left transition-all ${
                  headerStyle === 'sticky'
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
                <div className={`text-xs font-bold text-center ${
                  headerStyle === 'sticky' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
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
                className={`p-2.5 rounded-md border text-center transition-all flex flex-col items-center justify-between ${
                  stickyStatsPos === 'bottom'
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
                <div className={`text-[11px] font-bold ${
                  stickyStatsPos === 'bottom' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
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
                className={`p-2.5 rounded-md border text-center transition-all flex flex-col items-center justify-between ${
                  stickyStatsPos === 'top'
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
                <div className={`text-[11px] font-bold ${
                  stickyStatsPos === 'top' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
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
                className={`p-2.5 rounded-md border text-center transition-all flex flex-col items-center justify-between ${
                  stickyStatsPos === 'off'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center justify-center mb-2 w-full h-10 bg-slate-100 dark:bg-slate-900/60 rounded-md p-1">
                  <span className="text-[9px] font-mono text-slate-400">Off</span>
                </div>
                <div className={`text-[11px] font-bold ${
                  stickyStatsPos === 'off' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
                }`}>
                  Hidden
                </div>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                  Only show main top card
                </p>
              </button>
            </div>
          </div>

          {/* Currency Symbol Card */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Currency Symbol</h3>
                <p className="text-xs text-slate-400">Select symbol displayed across reports and cards</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 pt-1">
              {[
                { code: 'USD', symbol: '$' },
                { code: 'BDT', symbol: '৳' },
                { code: 'EUR', symbol: '€' },
                { code: 'GBP', symbol: '£' },
                { code: 'INR', symbol: '₹' },
              ].map((c) => {
                const isSelected = currency === c.code || getCurrencySymbol(currency) === c.symbol;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleCurrencyChange(c.code)}
                    className={`py-3 rounded-md text-sm font-black font-mono flex items-center justify-center border transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    {c.symbol}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Decimal Formatting Precision Card */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/90 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-mono font-black text-xs">
                .00
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Decimal Format</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Choose whether amounts show decimals (5.00) or whole numbers (5)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleDecimalModeChange('2')}
                className={`p-3 rounded-[10px] border text-left transition-all ${
                  decimalMode === '2'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                    5.00
                  </span>
                  {decimalMode === '2' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">With Decimals</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Standard precision (e.g. 5.00)</div>
              </button>

              <button
                type="button"
                onClick={() => handleDecimalModeChange('0')}
                className={`p-3 rounded-[10px] border text-left transition-all ${
                  decimalMode === '0'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base font-extrabold font-mono text-slate-800 dark:text-slate-200">
                    5
                  </span>
                  {decimalMode === '0' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">No Decimals</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Whole integer numbers (e.g. 5)</div>
              </button>
            </div>
          </div>

          {/* Quick link to Time & Date Settings */}
          <button
            type="button"
            onClick={() => navigateTo('datetime')}
            className="w-full p-3.5 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-left hover:border-emerald-500/80 transition-all shadow-xs group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Time & Date Settings</h4>
                <p className="text-xs text-slate-400">Set clock mode (Auto/Manual), 12h/24h format, date layout</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                {timeFormat.toUpperCase()}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500" />
            </div>
          </button>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW: TIME & DATE SETTINGS PAGE (`datetime`)               */}
      {/* ========================================================== */}
      {subPage === 'datetime' && (
        <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              onClick={() => navigateTo('main')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Settings</span>
            </button>
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
                className={`py-3 px-3 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
                  timeFormat === '12h'
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
                className={`py-3 px-3 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
                  timeFormat === '24h'
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
                className={`py-2.5 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  timeMode === 'auto'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <span>⚡ Automatic (Device)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTimeModeChange('manual')}
                className={`py-2.5 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  timeMode === 'manual'
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
                        className={`py-1.5 px-2 rounded-md text-[11px] font-bold font-mono border transition-all text-center ${
                          manualTime === preset.time
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
                  className={`py-2.5 px-2 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-0.5 border transition-all ${
                    dateFormat === df.format
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
            <button
              type="button"
              onClick={() => navigateTo('main')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Settings</span>
            </button>
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
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                getAppMode() === 'offline' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
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
                className={`py-2.5 px-3 rounded-md border text-xs font-bold transition-all ${
                  getAppMode() === 'offline'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                📱 On-Device (Local)
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
                className={`py-2.5 px-3 rounded-md border text-xs font-bold transition-all ${
                  getAppMode() === 'online'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                ☁️ Cloud Sync
              </button>
            </div>
          </div>

          {/* Google Drive Card */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Google Drive Cloud Sync</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                      isDriveConnected
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {isDriveConnected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">1-Click Google Sign-In with automatic encrypted backups</p>
                </div>
              </div>
            </div>

            {/* 1-Click Google Sign-In Status / Connect */}
            {isDriveConnected ? (
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-md border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  {driveProfile?.picture ? (
                    <img
                      src={driveProfile.picture}
                      alt=""
                      className="w-8 h-8 rounded-full border border-emerald-500/40 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {driveProfile?.name ? driveProfile.name[0].toUpperCase() : 'G'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {driveProfile?.name || 'Google Drive Connected'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {driveProfile?.email || '1-Click Cloud Sync Active'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDisconnectDrive}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md border border-rose-200 dark:border-rose-900 transition-colors shrink-0 ml-2"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isDriveConnecting}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-md text-xs font-bold text-slate-800 dark:text-slate-100 shadow-xs transition-all active:scale-98 disabled:opacity-50"
                >
                  {isDriveConnecting ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                  ) : (
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                  )}
                  <span>Sign in with Google (1-Click Sync)</span>
                </button>
                <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
                  <span>Sign in once to sync backups automatically.</span>
                  <button
                    type="button"
                    onClick={() => setShowClientIdConfig(!showClientIdConfig)}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    {showClientIdConfig ? 'Hide Client ID' : 'OAuth Client ID'}
                  </button>
                </div>
              </div>
            )}

            {/* Google OAuth Client ID Configuration (one-time setup if needed) */}
            {showClientIdConfig && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-md space-y-2 animate-in fade-in">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Google OAuth Client ID</span>
                  <span className="text-[10px] text-slate-400 font-normal">One-time setup</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  In Google Cloud Console, create an OAuth Web Client ID with origin <code className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:18000'}</code>.
                </p>
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
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Automated Sync on Save Toggle */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-md flex items-center justify-between border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block leading-tight">
                    Automated Sync on Every Record
                  </span>
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    Silently uploads backup to Drive every time you add or edit a transaction
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

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleBackupToDrive}
                disabled={backupLoading || !isDriveConnected}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold shadow-xs active:scale-98 transition-all disabled:opacity-50"
              >
                {backupLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderUp className="w-3.5 h-3.5" />}
                <span>Backup Now</span>
              </button>

              <button
                onClick={handleListDriveBackups}
                disabled={restoreLoading || !isDriveConnected}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md text-xs font-bold active:scale-98 transition-all disabled:opacity-50"
              >
                {restoreLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderDown className="w-3.5 h-3.5" />}
                <span>Restore List</span>
              </button>
            </div>

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

          {/* Offline JSON Snapshots Card */}
          <div className="p-4 bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Offline JSON Snapshot</h3>
              <p className="text-xs text-slate-400">Download or upload database file directly</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDownloadLocalBackup}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md text-xs font-bold flex items-center gap-1"
                title="Download JSON snapshot"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>

              <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Import</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleUploadLocalBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW D: SECURITY & PIN LOCK PAGE (`security`)             */}
      {/* ========================================================== */}
      {subPage === 'security' && (
        <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              onClick={() => navigateTo('main')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Settings</span>
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Security & PIN
            </span>
          </div>

          {/* App Security PIN Card */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>App Security PIN</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                      isPinSet ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {isPinSet ? 'Active' : 'Off'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Require 4-digit code upon app launch</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="password"
                maxLength={4}
                placeholder="4-digit PIN (leave empty to turn off)"
                value={appPin}
                onChange={(e) => setAppPin(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-900/60 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none text-center font-mono tracking-widest text-slate-800 dark:text-slate-200"
              />
              <button
                onClick={handleSavePin}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-xs font-bold shadow-xs hover:bg-slate-800"
              >
                Save PIN
              </button>
            </div>
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
            <button
              type="button"
              onClick={() => navigateTo('main')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Settings</span>
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Account Info
            </span>
          </div>

          {/* Profile Card */}
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg font-mono">
                {(user.full_name || user.email || 'U')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {user.full_name || 'Active User'}
                  </h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {getAppMode() === 'offline' ? 'On-Device' : 'Cloud'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono truncate">{user.email}</p>
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
                  placeholder="Your Name"
                  className="flex-1 bg-slate-50 dark:bg-slate-900/60 text-xs px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200 font-semibold"
                />
                <button
                  onClick={handleSaveName}
                  className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-xs font-bold"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

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

          {/* Danger Zone: Wipe / Delete */}
          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-[10px] border border-rose-200/80 dark:border-rose-900/60 space-y-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
              <ShieldAlert className="w-4 h-4" />
              <span>Danger Zone</span>
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300/80 leading-relaxed">
              {getAppMode() === 'offline'
                ? 'Wiping data will clear all offline transactions, category settings, and budget limits from this phone.'
                : 'Deleting your cloud account will permanently remove all cloud financial history and sync metadata.'}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  if (getAppMode() === 'offline') {
                    if (confirm('Wipe all local offline transactions, accounts, and budgets from this device?')) {
                      OfflineStorage.clearAll();
                      onLogout();
                    }
                  } else {
                    setIsDeleteModalOpen(true);
                  }
                }}
                className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold transition-all shadow-xs"
              >
                {getAppMode() === 'offline' ? 'Wipe Local Device Data' : 'Delete Cloud Account'}
              </button>
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
            <button
              type="button"
              onClick={() => navigateTo('main')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Settings</span>
            </button>
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
              onClick={() => setIsCategoryModalOpen(true)}
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

      {/* ========================================================== */}
      {/* MODALS (Kept available for actions on all sub-pages)        */}
      {/* ========================================================== */}
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
    </div>
  );
}
