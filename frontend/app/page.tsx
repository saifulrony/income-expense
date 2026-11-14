'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, getAuthToken, getAppMode } from '@/lib/api';
import { OfflineStorage } from '@/lib/offline-storage';
import { User, SummaryData, Transaction, Category, BudgetOverview, SubAccount } from '@/lib/types';
import { GoogleDriveService } from '@/lib/google-drive';
import { OfflineSyncService } from '@/lib/offline-sync';
import { applyTheme } from '@/lib/theme';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import DashboardView from '@/components/DashboardView';
import HistoryView from '@/components/HistoryView';
import AnalyticsView from '@/components/AnalyticsView';
import SettingsView from '@/components/SettingsView';
import TransactionModal from '@/components/TransactionModal';
import AccountManagerModal from '@/components/AccountManagerModal';
import AuthView from '@/components/AuthView';
import PinLockView from '@/components/PinLockView';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');

  // Sub-Accounts (Multi-Ledger: Personal, Family, Business)
  const [accounts, setAccounts] = useState<SubAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>('all');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Security App Lock
  const [isLocked, setIsLocked] = useState(false);
  const [securityPin, setSecurityPin] = useState<string | null>(null);

  // App Data
  const [summary, setSummary] = useState<SummaryData>({
    total_income: 0,
    total_expense: 0,
    net_balance: 0,
    income_count: 0,
    expense_count: 0,
    total_count: 0,
    period: 'this_month',
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetOverview, setBudgetOverview] = useState<BudgetOverview | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Check auth and PIN lock on startup
  useEffect(() => {
    // Safety watchdog: ensure loading spinner NEVER hangs more than 1.5s
    const timer = setTimeout(() => {
      setAuthChecking(false);
    }, 1500);

    checkAuth().finally(() => {
      clearTimeout(timer);
      setAuthChecking(false);
    });

    return () => clearTimeout(timer);
  }, []);

  const checkAuth = async () => {
    try {
      // Check PIN lock & apply theme
      if (typeof window !== 'undefined') {
        applyTheme();
        const pin = localStorage.getItem('app_security_pin');
        if (pin && pin.length === 4) {
          setSecurityPin(pin);
          setIsLocked(true);
        }
      }

      const token = await getAuthToken();
      if (!token) {
        setUser(null);
        return;
      }
      const res = await api.getProfile();
      setUser(res.user);

      // Restore active account preference if saved
      if (typeof window !== 'undefined') {
        const savedAcc = localStorage.getItem('active_account_id');
        if (savedAcc) {
          setActiveAccountId(savedAcc);
        }
      }

      // Auto-sync any offline transactions in background
      OfflineSyncService.sync().then((synced) => {
        if (synced > 0) {
          loadAppData();
        }
      }).catch(() => {});
    } catch {
      setUser(null);
    }
  };

  const handleSelectAccount = (id: string) => {
    setActiveAccountId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_account_id', id);
    }
  };

  // Load app data
  const loadAppData = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Instant local read (0ms latency, zero UI lag!)
      const localSum = OfflineStorage.getSummary(selectedPeriod, activeAccountId);
      const localTxs = OfflineStorage.getTransactions({ account_id: activeAccountId });
      const localCats = OfflineStorage.getCategories();
      const localBuds = OfflineStorage.getBudgets();
      const localAccs = OfflineStorage.getAccounts();

      setSummary(localSum);
      setTransactions(localTxs);
      setCategories(localCats);
      setBudgetOverview(localBuds);
      setAccounts(localAccs);

      // 2. If online mode, fetch from cloud server in background without blocking UI
      if (getAppMode() === 'online') {
        setIsRefreshing(true);
        Promise.all([
          api.getSummary(selectedPeriod, undefined, undefined, activeAccountId).catch(() => localSum),
          api.getTransactions({ limit: 100, account_id: activeAccountId }).catch(() => ({ transactions: localTxs })),
          api.getCategories().catch(() => ({ categories: localCats })),
          api.getBudgets().catch(() => localBuds),
          api.getAccounts().catch(() => ({ accounts: localAccs })),
        ])
          .then(([cloudSum, cloudTx, cloudCat, cloudBud, cloudAcc]) => {
            if (cloudSum) setSummary(cloudSum);
            if (cloudTx?.transactions) setTransactions(cloudTx.transactions);
            if (cloudCat?.categories) setCategories(cloudCat.categories);
            if (cloudBud) setBudgetOverview(cloudBud);
            if (cloudAcc?.accounts) setAccounts(cloudAcc.accounts);
          })
          .finally(() => {
            setIsRefreshing(false);
          });
      }
    } catch (err) {
      console.error('Error fetching app data:', err);
    }
  }, [user, selectedPeriod, activeAccountId]);

  useEffect(() => {
    if (user) {
      loadAppData();
    }
  }, [user, selectedPeriod, activeAccountId, loadAppData]);

  // Automated Google Drive Cloud Sync Trigger (if enabled)
  const triggerAutoCloudSync = async () => {
    if (typeof window === 'undefined') return;
    const isAutoSync = localStorage.getItem('auto_drive_sync') === 'true';
    const driveToken = GoogleDriveService.getAccessToken();

    if (isAutoSync && driveToken) {
      try {
        const payload = await api.exportBackup();
        const driveFile = await GoogleDriveService.uploadBackup(payload, driveToken);
        await api.recordBackupLog({
          file_id: driveFile.id,
          file_name: driveFile.name,
          record_size: payload.transactions.length,
        });
      } catch (e) {
        console.error('Automated Google Drive sync failed:', e);
      }
    }
  };

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsModalOpen(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      // 1. Instant local delete (0ms!)
      OfflineStorage.deleteTransaction(id);

      // 2. Immediately update dashboard and stats
      const updatedTxs = OfflineStorage.getTransactions({ account_id: activeAccountId });
      const updatedSum = OfflineStorage.getSummary(selectedPeriod, activeAccountId);
      const updatedAccs = OfflineStorage.getAccounts();
      const updatedBuds = OfflineStorage.getBudgets();

      setTransactions(updatedTxs);
      setSummary(updatedSum);
      setAccounts(updatedAccs);
      setBudgetOverview(updatedBuds);

      // 3. If online, sync delete in background
      if (getAppMode() === 'online') {
        api.deleteTransaction(id).catch(() => {});
        triggerAutoCloudSync();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete transaction');
    }
  };

  const handleSaveTransaction = async (formData: {
    account_id?: string;
    amount: number;
    type: 'income' | 'expense';
    category_id: string;
    payment_method: string;
    note: string;
    receipt_image?: string;
    date: string;
  }) => {
    try {
      // 1. Save directly to local on-device database first (0ms latency, zero UI lag!)
      let savedTx: Transaction;
      if (editingTransaction) {
        savedTx = OfflineStorage.updateTransaction(editingTransaction.id, formData);
      } else {
        savedTx = OfflineStorage.createTransaction({
          account_id: formData.account_id,
          amount: formData.amount,
          type: formData.type,
          category_id: formData.category_id,
          payment_method: formData.payment_method || 'cash',
          note: formData.note || '',
          receipt_image: formData.receipt_image,
          date: formData.date || new Date().toISOString(),
        });
      }

      // 2. Immediately update all stats and lists on screen (INSTANT STATS CHANGE!)
      const updatedTxs = OfflineStorage.getTransactions({ account_id: activeAccountId });
      const updatedSum = OfflineStorage.getSummary(selectedPeriod, activeAccountId);
      const updatedAccs = OfflineStorage.getAccounts();
      const updatedBuds = OfflineStorage.getBudgets();

      setTransactions(updatedTxs);
      setSummary(updatedSum);
      setAccounts(updatedAccs);
      setBudgetOverview(updatedBuds);

      // 3. If online mode, sync to cloud server in background without blocking UI
      if (getAppMode() === 'online') {
        const syncPromise = editingTransaction
          ? api.updateTransaction(editingTransaction.id, formData)
          : api.createTransaction(formData);

        syncPromise.catch((err) => {
          console.warn('Background server sync queued:', err.message);
          OfflineSyncService.enqueue({
            id: savedTx.id,
            amount: formData.amount,
            type: formData.type,
            category_id: formData.category_id,
            payment_method: formData.payment_method,
            note: formData.note,
            receipt_image: formData.receipt_image,
            date: formData.date,
            created_at: new Date().toISOString(),
          }).catch(() => {});
        });

        triggerAutoCloudSync();
      }
    } catch (err: any) {
      console.error('Failed to save transaction:', err);
      alert('Error saving transaction: ' + err.message);
    }
  };

  const handleCreateCategory = async (name: string, type: 'income' | 'expense') => {
    const res = await api.createCategory({ name, type });
    setCategories((prev) => [...prev, res.category]);
    return res.category;
  };

  // PIN Lock Screen
  if (isLocked && securityPin) {
    return (
      <PinLockView
        correctPin={securityPin}
        onUnlocked={() => setIsLocked(false)}
      />
    );
  }

  // Auth state check loading spinner
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
        <span className="text-xs font-semibold text-slate-500">Loading CashFlow...</span>
      </div>
    );
  }

  // If not logged in, show Auth View
  if (!user) {
    return (
      <AuthView
        onSuccess={(newUser) => {
          setUser(newUser);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <Header
        user={user}
        accounts={accounts}
        activeAccountId={activeAccountId}
        onOpenAccountSwitcher={() => setIsAccountModalOpen(true)}
        onRefresh={loadAppData}
        isRefreshing={isRefreshing}
      />

      {/* Main Content Area */}
      <main className="max-w-md mx-auto px-4 pt-4 pb-20">
        {currentTab === 'dashboard' && (
          <DashboardView
            summary={summary}
            recentTransactions={transactions.slice(0, 6)}
            categories={categories}
            user={user}
            budgetOverview={budgetOverview}
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            onOpenAddModal={handleOpenAddModal}
            onNavigateToHistory={() => setCurrentTab('history')}
            onNavigateToSettings={() => setCurrentTab('settings')}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {currentTab === 'history' && (
          <HistoryView
            transactions={transactions}
            categories={categories}
            currency={user.currency}
            user={user}
            summary={summary}
            onEdit={handleEditTransaction}
            onDelete={handleDeleteTransaction}
            onOpenAddModal={() => handleOpenAddModal()}
          />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsView
            currency={user.currency}
            user={user}
            summary={summary}
            activeAccountId={activeAccountId}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            user={user}
            categories={categories}
            accounts={accounts}
            activeAccountId={activeAccountId}
            budgetOverview={budgetOverview}
            onUpdateUser={setUser}
            onSelectAccount={handleSelectAccount}
            onRefreshAccounts={loadAppData}
            onLogout={() => setUser(null)}
            onDataRestored={loadAppData}
          />
        )}
      </main>

      {/* Add / Edit Transaction Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveTransaction}
        categories={categories}
        accounts={accounts}
        defaultAccountId={activeAccountId}
        currency={user.currency}
        initialData={editingTransaction}
        onDelete={handleDeleteTransaction}
        onCreateCategory={handleCreateCategory}
      />

      {/* Account Manager Modal */}
      <AccountManagerModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        accounts={accounts}
        activeAccountId={activeAccountId}
        onSelectAccount={handleSelectAccount}
        onRefresh={loadAppData}
        currency={user.currency}
      />

      {/* Mobile-first Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAddModal={() => handleOpenAddModal()}
      />
    </div>
  );
}
