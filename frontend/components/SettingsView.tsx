'use client';

import React, { useState, useEffect } from 'react';
import { User, BackupLog, Category, BudgetOverview } from '@/lib/types';
import { api, getApiUrl, setApiUrl, removeAuthToken, getAppMode, setAppMode } from '@/lib/api';
import { OfflineStorage } from '@/lib/offline-storage';
import { GoogleDriveService, GoogleDriveFile } from '@/lib/google-drive';
import { getCurrencySymbol } from '@/lib/currency';
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
  ShieldCheck
} from 'lucide-react';
import BudgetModal from './BudgetModal';
import RecurringModal from './RecurringModal';
import CategoryManagerModal from './CategoryManagerModal';
import PasswordModal from './PasswordModal';
import DeleteAccountModal from './DeleteAccountModal';
import AccountManagerModal from './AccountManagerModal';
import { SubAccount } from '@/lib/types';
import { ThemeMode, getStoredTheme, setStoredTheme } from '@/lib/theme';

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

type SubPage = 'main' | 'theme' | 'backup' | 'security' | 'account' | 'ledgers';

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

  // Security PIN
  const [appPin, setAppPin] = useState('');
  const [isPinSet, setIsPinSet] = useState(false);

  // Currency, Name & API URL
  const [currency, setCurrency] = useState(user.currency || 'USD');
  const [fullName, setFullName] = useState(user.full_name || '');
  const [apiUrl, setApiUrlState] = useState('');
  const [isDriveExpanded, setIsDriveExpanded] = useState(false);

  useEffect(() => {
    // Read URL hash on load (e.g. #theme, #backup, #security, #account, #ledgers)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (['theme', 'backup', 'security', 'account', 'ledgers'].includes(hash)) {
        setSubPage(hash as SubPage);
      }

      const handleHashChange = () => {
        const h = window.location.hash.replace('#', '');
        if (['theme', 'backup', 'security', 'account', 'ledgers'].includes(h)) {
          setSubPage(h as SubPage);
        } else {
          setSubPage('main');
        }
      };
      window.addEventListener('hashchange', handleHashChange);

      // Load stored Google token
      const token = GoogleDriveService.getAccessToken();
      if (token) {
        setDriveToken(token);
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
      return () => window.removeEventListener('hashchange', handleHashChange);
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

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    setStoredTheme(mode);
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
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
              Appearance & Localization
            </div>
            <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
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
                    <div className="text-xs text-slate-400">Dark / Light theme, currency symbol</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 capitalize">
                    {themeMode} • {getCurrencySymbol(user.currency)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            </div>
          </div>

          {/* 3. Menu Navigation Group: DATA & STORAGE */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
              Data & Storage
            </div>
            <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
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
                    <div className="text-xs text-slate-400">Google Drive sync, JSON export & import</div>
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

              {/* Accounts & Ledgers */}
              <button
                onClick={() => navigateTo('ledgers')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Ledgers & Categories</div>
                    <div className="text-xs text-slate-400">Multi-ledger spaces, budgets, categories</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">
                    {accounts.length} ledgers
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            </div>
          </div>

          {/* 4. Menu Navigation Group: SECURITY & ACCOUNT */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
              Security & Privacy
            </div>
            <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
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
                    <div className="text-xs text-slate-400">App lock PIN code, cloud password</div>
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
          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Appearance Theme</h3>
                <p className="text-xs text-slate-400">Select application visual color scheme</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`py-3 px-3 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1.5 border transition-all ${
                  themeMode === 'light'
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`py-3 px-3 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1.5 border transition-all ${
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
                onClick={() => handleThemeChange('system')}
                className={`py-3 px-3 rounded-md text-xs font-bold flex flex-col items-center justify-center gap-1.5 border transition-all ${
                  themeMode === 'system'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <Monitor className="w-4 h-4 text-indigo-500" />
                <span>Auto</span>
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

          {/* Live Preview Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-[10px] border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Live Preview
            </span>
            <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-md border border-slate-100 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Sample Inflow</span>
              <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                +{getCurrencySymbol(currency)}4,850.00
              </span>
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
            <div 
              onClick={() => setIsDriveExpanded(!isDriveExpanded)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
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
                      {isDriveConnected ? 'Active' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Automated encrypted backups to your Drive</p>
                </div>
              </div>
              <button type="button" className="p-1 text-slate-400">
                {isDriveExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleBackupToDrive}
                disabled={backupLoading}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold shadow-xs active:scale-98 transition-all disabled:opacity-50"
              >
                {backupLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderUp className="w-3.5 h-3.5" />}
                <span>Backup to Drive</span>
              </button>

              <button
                onClick={handleListDriveBackups}
                disabled={restoreLoading}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md text-xs font-bold active:scale-98 transition-all disabled:opacity-50"
              >
                {restoreLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderDown className="w-3.5 h-3.5" />}
                <span>Restore List</span>
              </button>
            </div>

            {/* Expandable Drive Configuration */}
            {isDriveExpanded && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-2.5 animate-in slide-in-from-top-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Google OAuth Access Token
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={driveToken}
                      onChange={(e) => setDriveToken(e.target.value)}
                      placeholder="Paste token..."
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

                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-md flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Automated Sync on Save
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoDriveSync}
                    onChange={(e) => handleToggleAutoSync(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                  />
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
              Ledgers & Spaces
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800/90 rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
            {/* Account Ledgers */}
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Account Ledgers</div>
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
