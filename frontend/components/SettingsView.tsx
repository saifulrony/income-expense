'use client';

import React, { useState, useEffect } from 'react';
import { User, BackupLog, Category, BudgetOverview } from '@/lib/types';
import { api, getApiUrl, setApiUrl, removeAuthToken, getAppMode, setAppMode } from '@/lib/api';
import { OfflineStorage } from '@/lib/offline-storage';
import { GoogleDriveService, GoogleDriveFile } from '@/lib/google-drive';
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
  ChevronDown
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

  // Currency & API URL
  const [currency, setCurrency] = useState(user.currency || 'USD');
  const [apiUrl, setApiUrlState] = useState('');
  const [isDriveExpanded, setIsDriveExpanded] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);

  useEffect(() => {
    // Load stored Google token
    const token = GoogleDriveService.getAccessToken();
    if (token) {
      setDriveToken(token);
      setIsDriveConnected(true);
    }

    // Load auto sync preference & Theme
    if (typeof window !== 'undefined') {
      const autoSync = localStorage.getItem('auto_drive_sync') === 'true';
      setAutoDriveSync(autoSync);

      const savedPin = localStorage.getItem('app_security_pin');
      if (savedPin) {
        setAppPin(savedPin);
        setIsPinSet(true);
      }

      setThemeMode(getStoredTheme());
    }

    // Load API URL
    getApiUrl().then(setApiUrlState);
  }, []);

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
    setMessage({ type: 'success', text: 'Google Drive authorization token saved!' });
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoDriveSync(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('auto_drive_sync', String(enabled));
    }
    setMessage({
      type: 'success',
      text: enabled ? 'Automated Cloud Backup enabled on transactions!' : 'Automated Cloud Backup disabled.',
    });
  };

  // Perform Google Drive Backup
  const handleBackupToDrive = async () => {
    if (!driveToken) {
      setMessage({ type: 'error', text: 'Please connect your Google Drive token first.' });
      return;
    }

    try {
      setBackupLoading(true);
      setMessage(null);

      const payload = await api.exportBackup();
      const driveFile = await GoogleDriveService.uploadBackup(payload, driveToken);

      await api.recordBackupLog({
        file_id: driveFile.id,
        file_name: driveFile.name,
        record_size: payload.transactions.length,
      });

      setMessage({
        type: 'success',
        text: `Backup uploaded successfully to Google Drive! (${payload.transactions.length} records)`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to upload backup to Google Drive.' });
    } finally {
      setBackupLoading(false);
    }
  };

  // Fetch Google Drive backups list
  const handleListDriveBackups = async () => {
    if (!driveToken) {
      setMessage({ type: 'error', text: 'Please connect Google Drive token first.' });
      return;
    }

    try {
      setRestoreLoading(true);
      const files = await GoogleDriveService.listBackups(driveToken);
      setDriveBackups(files);
      setShowDriveList(true);
      if (files.length === 0) {
        setMessage({ type: 'error', text: 'No income & expense backup files found in Google Drive.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to fetch files from Google Drive.' });
    } finally {
      setRestoreLoading(false);
    }
  };

  // Restore selected backup from Google Drive
  const handleRestoreFromDrive = async (fileId: string) => {
    try {
      setRestoreLoading(true);
      setMessage(null);

      const payload = await GoogleDriveService.downloadBackup(fileId, driveToken);
      const res = await api.importBackup(payload);

      setMessage({
        type: 'success',
        text: `Success! Restored ${res.restored_transactions} transactions and ${res.restored_categories} categories.`,
      });
      setShowDriveList(false);
      onDataRestored();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to restore backup.' });
    } finally {
      setRestoreLoading(false);
    }
  };

  // Direct JSON file download (Local backup)
  const handleDownloadLocalBackup = async () => {
    try {
      const payload = await api.exportBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
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

  // Direct JSON file upload (Local restore)
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

  // Save PIN
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

  // Update Currency
  const handleCurrencyChange = async (newCurr: string) => {
    setCurrency(newCurr);
    try {
      await api.updateProfile({ currency: newCurr });
      onUpdateUser({ ...user, currency: newCurr });
      setMessage({ type: 'success', text: `Default currency changed to ${newCurr}` });
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update currency.' });
    }
  };

  // Update API URL
  const handleSaveApiUrl = async () => {
    if (!apiUrl.trim()) return;
    await setApiUrl(apiUrl.trim());
    setMessage({ type: 'success', text: 'Backend API URL updated!' });
  };

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-emerald-600" />
          Settings & Preferences
        </h2>
      </div>

      {/* Alert banner */}
      {message && (
        <div
          className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-medium border ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* SECTION 1: MANAGE & LEDGERS */}
      <div className="space-y-1.5">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
          Manage & Ledgers
        </div>
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
          {/* Accounts */}
          <button
            onClick={() => setIsAccountModalOpen(true)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Account Ledgers</div>
                <div className="text-xs text-slate-400">{accounts.length} active spaces (Personal, Family...)</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Budgets */}
          <button
            onClick={() => setIsBudgetModalOpen(true)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
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
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Repeat className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Recurring Rules</div>
                <div className="text-xs text-slate-400">Automate recurring bills & salaries</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Categories */}
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
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

      {/* SECTION 2: DATA & CLOUD BACKUP */}
      <div className="space-y-1.5">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
          Cloud & Local Data
        </div>
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
          {/* Google Drive Header Accordion */}
          <div className="p-4 space-y-3">
            <div 
              onClick={() => setIsDriveExpanded(!isDriveExpanded)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Google Drive Sync</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                      isDriveConnected
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {isDriveConnected ? 'Active' : 'Not Connected'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">Sync encrypted backups to your Drive</div>
                </div>
              </div>
              <button 
                type="button"
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {isDriveExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            {/* Quick Actions (always accessible) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleBackupToDrive}
                disabled={backupLoading}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-98 transition-all disabled:opacity-50"
              >
                {backupLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderUp className="w-3.5 h-3.5" />}
                <span>Backup Now</span>
              </button>

              <button
                onClick={handleListDriveBackups}
                disabled={restoreLoading}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold active:scale-98 transition-all disabled:opacity-50"
              >
                {restoreLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderDown className="w-3.5 h-3.5" />}
                <span>Restore List</span>
              </button>
            </div>

            {/* Expandable Drive Configuration */}
            {isDriveExpanded && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-2.5 animate-in slide-in-from-top-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    OAuth Access Token
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={driveToken}
                      onChange={(e) => setDriveToken(e.target.value)}
                      placeholder="Paste Google Drive token..."
                      className="flex-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <button
                      onClick={handleSaveDriveToken}
                      className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-between">
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

            {/* Drive Backup List Drawer */}
            {showDriveList && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <span>Cloud Snapshots</span>
                  <button
                    onClick={() => setShowDriveList(false)}
                    className="text-xs text-slate-400 hover:underline"
                  >
                    Close
                  </button>
                </div>
                {driveBackups.length === 0 ? (
                  <div className="text-xs text-slate-400 py-1">No backups found in app folder.</div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {driveBackups.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs"
                      >
                        <div className="truncate mr-2">
                          <div className="font-semibold truncate text-slate-800 dark:text-slate-200 text-xs">
                            {file.name}
                          </div>
                          <div className="text-xs text-slate-400">
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

          {/* Offline JSON Snapshots */}
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Offline JSON Backup</div>
              <div className="text-xs text-slate-400">Export or restore file directly on device</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDownloadLocalBackup}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1"
                title="Download JSON snapshot"
              >
                <Download className="w-3 h-3" />
                <span>Export</span>
              </button>

              <label className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer">
                <Upload className="w-3 h-3" />
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
      </div>

      {/* SECTION 3: PREFERENCES */}
      <div className="space-y-1.5">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
          Preferences
        </div>
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
          {/* Appearance */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Appearance</div>
                <div className="text-xs text-slate-400">Theme mode</div>
              </div>
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl gap-0.5">
              <button
                onClick={() => handleThemeChange('light')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                  themeMode === 'light'
                    ? 'bg-white dark:bg-slate-600 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sun className="w-3 h-3" />
                <span>Light</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                  themeMode === 'dark'
                    ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Moon className="w-3 h-3" />
                <span>Dark</span>
              </button>
              <button
                onClick={() => handleThemeChange('system')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                  themeMode === 'system'
                    ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Monitor className="w-3 h-3" />
                <span>Auto</span>
              </button>
            </div>
          </div>

          {/* Currency */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Currency Symbol</div>
                <div className="text-xs text-slate-400">Display currency across reports</div>
              </div>
            </div>

            <select
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-2.5 py-1.5 font-bold outline-none cursor-pointer"
            >
              <option value="USD">USD ($)</option>
              <option value="BDT">BDT (৳)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="AUD">AUD (A$)</option>
            </select>
          </div>

          {/* App Security PIN */}
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>App Security PIN</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                      isPinSet ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {isPinSet ? 'Active' : 'Off'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">Require 4-digit code upon launch</div>
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
                className="flex-1 bg-slate-50 dark:bg-slate-900/60 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none text-center font-mono tracking-widest text-slate-800 dark:text-slate-200"
              />
              <button
                onClick={handleSavePin}
                className="px-3.5 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>

          {/* Server URL Config (Collapsible) */}
          <div className="p-4 space-y-2">
            <div 
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-300">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">API Server Endpoint</div>
                  <div className="text-xs text-slate-400">Configure custom backend host</div>
                </div>
              </div>
              <button type="button" className="p-1 text-slate-400">
                {showServerConfig ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            {showServerConfig && (
              <div className="flex gap-2 pt-1 animate-in slide-in-from-top-1">
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrlState(e.target.value)}
                  placeholder="e.g. http://192.168.1.100:18080/api"
                  className="flex-1 bg-slate-50 dark:bg-slate-900/60 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                />
                <button
                  onClick={handleSaveApiUrl}
                  className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: ACCOUNT & SECURITY */}
      <div className="space-y-1.5">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
          Account & Security
        </div>
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
          {/* User Profile Info & Mode Badge */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                {(user.full_name || user.email || 'U')[0].toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{user.full_name || 'Active User'}</span>
                  {getAppMode() === 'offline' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Offline Mode
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Cloud Sync
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {getAppMode() === 'offline' ? 'Stored locally on this device' : user.email}
                </div>
              </div>
            </div>

            {getAppMode() === 'offline' ? (
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Switch to Cloud Account? You can sign in with your email or register.')) {
                    setAppMode('online');
                    await removeAuthToken();
                    onLogout();
                  }
                }}
                className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-emerald-700 transition-colors"
              >
                ☁️ Connect Cloud
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Switch to Offline Device Mode? Your offline records will be loaded on this phone.')) {
                    setAppMode('offline');
                    const offUser = OfflineStorage.getUser();
                    onUpdateUser(offUser);
                    onDataRestored();
                  }
                }}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                📱 Switch Offline
              </button>
            )}
          </div>

          {/* Change Password (Only in Cloud Mode) */}
          {getAppMode() === 'online' && (
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-300">
                  <KeyRound className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Change Account Password
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          )}

          {/* Delete Account */}
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
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-colors text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-500">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {getAppMode() === 'offline' ? 'Wipe Local Device Data' : 'Delete Account & Wipe Data'}
                </div>
                <div className="text-xs text-slate-400">
                  {getAppMode() === 'offline' ? 'Clear all records stored in this phone' : 'Permanently delete cloud financial records'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Sign Out / Exit Mode */}
          <button
            onClick={async () => {
              if (confirm('Exit current account session?')) {
                await removeAuthToken();
                onLogout();
              }
            }}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left text-slate-600 dark:text-slate-400"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-500">
                <LogOut className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold">
                {getAppMode() === 'offline' ? 'Exit Offline Mode' : 'Sign Out of Cloud Account'}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Modals */}
      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        categories={categories}
        currency={user.currency}
        budgetOverview={budgetOverview}
        onRefresh={onDataRestored}
      />

      <RecurringModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        categories={categories}
        currency={user.currency}
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
        currency={user.currency}
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
