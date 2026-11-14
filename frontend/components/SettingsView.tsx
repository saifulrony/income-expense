'use client';

import React, { useState, useEffect } from 'react';
import { User, BackupLog, Category, BudgetOverview } from '@/lib/types';
import { api, getApiUrl, setApiUrl, removeAuthToken } from '@/lib/api';
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
  Zap
} from 'lucide-react';
import BudgetModal from './BudgetModal';
import RecurringModal from './RecurringModal';

interface SettingsViewProps {
  user: User;
  categories: Category[];
  budgetOverview: BudgetOverview | null;
  onUpdateUser: (user: User) => void;
  onLogout: () => void;
  onDataRestored: () => void;
}

export default function SettingsView({
  user,
  categories,
  budgetOverview,
  onUpdateUser,
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

  // Security PIN
  const [appPin, setAppPin] = useState('');
  const [isPinSet, setIsPinSet] = useState(false);

  // Currency & API URL
  const [currency, setCurrency] = useState(user.currency || 'USD');
  const [apiUrl, setApiUrlState] = useState('');

  useEffect(() => {
    // Load stored Google token
    const token = GoogleDriveService.getAccessToken();
    if (token) {
      setDriveToken(token);
      setIsDriveConnected(true);
    }

    // Load auto sync preference
    if (typeof window !== 'undefined') {
      const autoSync = localStorage.getItem('auto_drive_sync') === 'true';
      setAutoDriveSync(autoSync);

      const savedPin = localStorage.getItem('app_security_pin');
      if (savedPin) {
        setAppPin(savedPin);
        setIsPinSet(true);
      }
    }

    // Load API URL
    getApiUrl().then(setApiUrlState);
  }, []);

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

      {/* Budgets & Recurring Shortcuts */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setIsBudgetModalOpen(true)}
          className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 shadow-sm text-left hover:border-indigo-500 transition-all flex flex-col justify-between"
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-2">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">Category Budgets</div>
            <div className="text-[10px] text-slate-400">
              {budgetOverview?.budgets?.length || 0} active limits
            </div>
          </div>
        </button>

        <button
          onClick={() => setIsRecurringModalOpen(true)}
          className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 shadow-sm text-left hover:border-indigo-500 transition-all flex flex-col justify-between"
        >
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-2">
            <Repeat className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">Recurring Rules</div>
            <div className="text-[10px] text-slate-400">Automate repeat salary & bills</div>
          </div>
        </button>
      </div>

      {/* Google Drive Cloud Backup Card */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Google Drive Backup
              </h3>
              <p className="text-[11px] text-slate-400">
                Securely store cash flow records in your Google Drive
              </p>
            </div>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
              isDriveConnected
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
            }`}
          >
            {isDriveConnected ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        {/* Token input for Google Drive API */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
            Google Drive OAuth Access Token
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={driveToken}
              onChange={(e) => setDriveToken(e.target.value)}
              placeholder="Paste Google OAuth token"
              className="flex-1 bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
            />
            <button
              onClick={handleSaveDriveToken}
              className="px-3.5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold"
            >
              Save
            </button>
          </div>
        </div>

        {/* Auto Sync Toggle */}
        <div className="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Automated Cloud Sync
            </span>
          </div>
          <input
            type="checkbox"
            checked={autoDriveSync}
            onChange={(e) => handleToggleAutoSync(e.target.checked)}
            className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
          />
        </div>

        {/* Action Buttons: Backup Now & Restore */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleBackupToDrive}
            disabled={backupLoading}
            className="flex items-center justify-center gap-2 py-3 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 active:scale-98 transition-all"
          >
            {backupLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FolderUp className="w-4 h-4" />
            )}
            Backup to Drive
          </button>

          <button
            onClick={handleListDriveBackups}
            disabled={restoreLoading}
            className="flex items-center justify-center gap-2 py-3 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold active:scale-98 transition-all"
          >
            {restoreLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FolderDown className="w-4 h-4" />
            )}
            Restore from Drive
          </button>
        </div>

        {/* Drive Backups List Modal/Dropdown */}
        {showDriveList && (
          <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
              <span>Select a Backup File to Restore:</span>
              <button
                onClick={() => setShowDriveList(false)}
                className="text-[11px] text-slate-400 hover:underline"
              >
                Close
              </button>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {driveBackups.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs"
                >
                  <div className="truncate mr-2">
                    <div className="font-semibold truncate text-slate-800 dark:text-slate-200">
                      {file.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(file.createdTime).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestoreFromDrive(file.id)}
                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold shrink-0"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Local File Backup & Restore (Offline Support) */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Offline JSON Backup & Import
        </h3>
        <p className="text-[11px] text-slate-500">
          Save an offline JSON snapshot directly on your phone, or import an existing backup file.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleDownloadLocalBackup}
            className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            Download JSON
          </button>

          <label className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-200 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleUploadLocalBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Security App Lock (PIN / Biometric) */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              App Security PIN Lock
            </h3>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
            isPinSet ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-400'
          }`}>
            {isPinSet ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        <p className="text-[11px] text-slate-500">
          Require a 4-digit security PIN whenever the app is opened on this phone.
        </p>

        <div className="flex gap-2">
          <input
            type="password"
            maxLength={4}
            placeholder="4-digit PIN (leave empty to disable)"
            value={appPin}
            onChange={(e) => setAppPin(e.target.value)}
            className="flex-1 bg-slate-50 dark:bg-slate-700 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 outline-none text-center font-mono tracking-widest"
          />
          <button
            onClick={handleSavePin}
            className="px-3.5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold"
          >
            Save PIN
          </button>
        </div>
      </div>

      {/* Preferences & Profile */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Preferences & Profile
        </h3>

        {/* User Info */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-500" />
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {user.full_name || 'Active User'}
              </div>
              <div className="text-[10px] text-slate-400">{user.email}</div>
            </div>
          </div>
        </div>

        {/* Currency Picker */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Coins className="w-4 h-4 text-amber-500" />
            <span>Currency Symbol</span>
          </div>
          <select
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-1.5 font-bold outline-none"
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

        {/* Backend API Server Endpoint Configuration (Mobile physical test friendly) */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-indigo-500" />
            Backend API Server URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrlState(e.target.value)}
              placeholder="e.g. http://192.168.1.100:8080/api"
              className="flex-1 bg-slate-50 dark:bg-slate-700 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 outline-none"
            />
            <button
              onClick={handleSaveApiUrl}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-[11px] font-bold"
            >
              Update
            </button>
          </div>
        </div>
      </div>

      {/* Logout button */}
      <button
        onClick={async () => {
          if (confirm('Log out of this device?')) {
            await removeAuthToken();
            onLogout();
          }
        }}
        className="w-full py-3.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-bold border border-rose-200 dark:border-rose-800 flex items-center justify-center gap-2 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Log Out Session
      </button>

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
    </div>
  );
}
