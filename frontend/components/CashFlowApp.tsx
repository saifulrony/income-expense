'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { api, getAuthToken, getAppMode } from '@/lib/api';
import { OfflineStorage } from '@/lib/offline-storage';
import { User, SummaryData, Transaction, Category, BudgetOverview, SubAccount } from '@/lib/types';
import { GoogleDriveService } from '@/lib/google-drive';
import { OfflineSyncService } from '@/lib/offline-sync';
import { applyTheme } from '@/lib/theme';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import SidebarDrawer from '@/components/SidebarDrawer';
import DashboardView from '@/components/DashboardView';
import AuthView from '@/components/AuthView';
import PinLockView from '@/components/PinLockView';
import { Loader2 } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/currency';
import { HeaderStyle, getHeaderStyle, HEADER_STYLE_EVENT } from '@/lib/ui-prefs';

const HistoryView = dynamic(() => import('@/components/HistoryView'), { ssr: false });
const AnalyticsView = dynamic(() => import('@/components/AnalyticsView'), { ssr: false });
const SettingsView = dynamic(() => import('@/components/SettingsView'), { ssr: false });
const DeletedTransactionsView = dynamic(() => import('@/components/DeletedTransactionsView'), { ssr: false });
const CashCalculatorView = dynamic(() => import('@/components/CashCalculatorView'), { ssr: false });
const NotesView = dynamic(() => import('@/components/NotesView'), { ssr: false });
const TransactionModal = dynamic(() => import('@/components/TransactionModal'), { ssr: false });
const AccountManagerModal = dynamic(() => import('@/components/AccountManagerModal'), { ssr: false });

interface CashFlowAppProps {
  initialTab?: string;
}

export default function CashFlowApp({ initialTab = 'dashboard' }: CashFlowAppProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentTab, setCurrentTab] = useState(initialTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('all');

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
    period: 'all',
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deletedTransactions, setDeletedTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetOverview, setBudgetOverview] = useState<BudgetOverview | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('expense');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [prefillAmount, setPrefillAmount] = useState<number | null>(null);
  const [prefillNote, setPrefillNote] = useState<string>('');

  // Header style (classic floating sheet vs sticky bar)
  const [headerStyle, setHeaderStyleState] = useState<HeaderStyle>('classic');

  useEffect(() => {
    setHeaderStyleState(getHeaderStyle());
    const handleHeaderStyleChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as HeaderStyle | undefined;
      setHeaderStyleState(detail === 'sticky' || detail === 'classic' ? detail : getHeaderStyle());
    };
    window.addEventListener(HEADER_STYLE_EVENT, handleHeaderStyleChange);
    window.addEventListener('storage', handleHeaderStyleChange);
    return () => {
      window.removeEventListener(HEADER_STYLE_EVENT, handleHeaderStyleChange);
      window.removeEventListener('storage', handleHeaderStyleChange);
    };
  }, []);

  // Synchronize URL and handle back/forward browser buttons
  useEffect(() => {
    const syncTabFromUrl = () => {
      if (typeof window === 'undefined') return;
      const path = window.location.pathname.replace(/^\/|\/$/g, '');
      if (['history', 'analytics', 'settings', 'trash', 'calendar', 'calculator', 'notes'].includes(path)) {
        setCurrentTab(path);
      } else {
        setCurrentTab('dashboard');
      }
    };

    syncTabFromUrl();
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, []);

  const handleSelectTab = (tab: string) => {
    const [baseTab, hash] = tab.split('#');
    setCurrentTab(baseTab);
    if (typeof window !== 'undefined') {
      const targetPath = baseTab === 'dashboard' ? '/' : `/${baseTab}${hash ? `#${hash}` : ''}`;
      if (window.location.pathname !== (baseTab === 'dashboard' ? '/' : `/${baseTab}`) || window.location.hash !== (hash ? `#${hash}` : '')) {
        window.history.pushState({ tab: baseTab }, '', targetPath);
      }
      if (hash) {
        window.location.hash = hash;
      } else if (window.location.hash) {
        window.history.replaceState({ tab: baseTab }, '', baseTab === 'dashboard' ? '/' : `/${baseTab}`);
      }
      // Broadcast hashchange so views like SettingsView instantly react
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  };

  // Check auth and PIN lock on startup
  useEffect(() => {
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

      if (typeof window !== 'undefined') {
        const savedAcc = localStorage.getItem('active_account_id');
        if (savedAcc) {
          setActiveAccountId(savedAcc);
        }
      }

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
      const localSum = OfflineStorage.getSummary(selectedPeriod, activeAccountId);
      const localTxs = OfflineStorage.getTransactions({ account_id: activeAccountId });
      const localDeletedTxs = OfflineStorage.getDeletedTransactions(activeAccountId);
      const localCats = OfflineStorage.getCategories();
      const localBuds = OfflineStorage.getBudgets();
      const localAccs = OfflineStorage.getAccounts();

      setSummary(localSum);
      setTransactions(localTxs);
      setDeletedTransactions(localDeletedTxs);
      setCategories(localCats);
      setBudgetOverview(localBuds);
      setAccounts(localAccs);

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

  useEffect(() => {
    const handleInlineTxUpdate = () => {
      const localTxs = OfflineStorage.getTransactions({ account_id: activeAccountId });
      setTransactions(localTxs);
    };
    window.addEventListener('cashflow:transactions-updated', handleInlineTxUpdate);
    return () => window.removeEventListener('cashflow:transactions-updated', handleInlineTxUpdate);
  }, [activeAccountId]);

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

  const handleOpenAddModal = (type: 'income' | 'expense' = 'expense') => {
    setEditingTransaction(null);
    setPrefillAmount(null);
    setPrefillNote('');
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleRecordCashFromCalculator = (
    type: 'income' | 'expense',
    amount: number,
    breakdownNote: string
  ) => {
    setEditingTransaction(null);
    setPrefillAmount(amount);
    setPrefillNote(breakdownNote);
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsModalOpen(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const targetTx = transactions.find((t) => t.id === id);
      OfflineStorage.deleteTransaction(id, targetTx);

      const updatedTxs = OfflineStorage.getTransactions({ account_id: activeAccountId });
      const updatedDeletedTxs = OfflineStorage.getDeletedTransactions(activeAccountId);
      const updatedSum = OfflineStorage.getSummary(selectedPeriod, activeAccountId);
      const updatedAccs = OfflineStorage.getAccounts();
      const updatedBuds = OfflineStorage.getBudgets();

      setTransactions(updatedTxs);
      setDeletedTransactions(updatedDeletedTxs);
      setSummary(updatedSum);
      setAccounts(updatedAccs);
      setBudgetOverview(updatedBuds);

      if (getAppMode() === 'online') {
        api.deleteTransaction(id).catch(() => {});
        triggerAutoCloudSync();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete transaction');
    }
  };

  const handleRestoreTransaction = async (id: string) => {
    const restored = OfflineStorage.restoreTransaction(id);
    if (!restored) return;

    const updatedTxs = OfflineStorage.getTransactions({ account_id: activeAccountId });
    const updatedDeletedTxs = OfflineStorage.getDeletedTransactions(activeAccountId);
    const updatedSum = OfflineStorage.getSummary(selectedPeriod, activeAccountId);
    const updatedAccs = OfflineStorage.getAccounts();
    const updatedBuds = OfflineStorage.getBudgets();

    setTransactions(updatedTxs);
    setDeletedTransactions(updatedDeletedTxs);
    setSummary(updatedSum);
    setAccounts(updatedAccs);
    setBudgetOverview(updatedBuds);

    if (getAppMode() === 'online') {
      api
        .createTransaction({
          account_id: restored.account_id,
          amount: restored.amount,
          type: restored.type,
          category_id: restored.category_id,
          payment_method: restored.payment_method,
          note: restored.note,
          receipt_image: restored.receipt_image,
          date: restored.date,
        })
        .then(() => loadAppData())
        .catch(() => {});
      triggerAutoCloudSync();
    }
  };

  const handleRestoreAllTransactions = async () => {
    const restoredList = OfflineStorage.restoreAllTransactions();
    if (restoredList.length === 0) return;

    const updatedTxs = OfflineStorage.getTransactions({ account_id: activeAccountId });
    const updatedDeletedTxs = OfflineStorage.getDeletedTransactions(activeAccountId);
    const updatedSum = OfflineStorage.getSummary(selectedPeriod, activeAccountId);
    const updatedAccs = OfflineStorage.getAccounts();
    const updatedBuds = OfflineStorage.getBudgets();

    setTransactions(updatedTxs);
    setDeletedTransactions(updatedDeletedTxs);
    setSummary(updatedSum);
    setAccounts(updatedAccs);
    setBudgetOverview(updatedBuds);

    if (getAppMode() === 'online') {
      Promise.all(
        restoredList.map((restored) =>
          api
            .createTransaction({
              account_id: restored.account_id,
              amount: restored.amount,
              type: restored.type,
              category_id: restored.category_id,
              payment_method: restored.payment_method,
              note: restored.note,
              receipt_image: restored.receipt_image,
              date: restored.date,
            })
            .catch(() => null)
        )
      ).then(() => loadAppData());
      triggerAutoCloudSync();
    }
  };

  const handlePermanentDeleteTransaction = (id: string) => {
    OfflineStorage.permanentlyDeleteTransaction(id);
    setDeletedTransactions(OfflineStorage.getDeletedTransactions(activeAccountId));
  };

  const handleEmptyTrash = () => {
    OfflineStorage.emptyTrash();
    setDeletedTransactions([]);
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

      const updatedTxs = OfflineStorage.getTransactions({ account_id: activeAccountId });
      const updatedSum = OfflineStorage.getSummary(selectedPeriod, activeAccountId);
      const updatedAccs = OfflineStorage.getAccounts();
      const updatedBuds = OfflineStorage.getBudgets();

      setTransactions(updatedTxs);
      setSummary(updatedSum);
      setAccounts(updatedAccs);
      setBudgetOverview(updatedBuds);

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

  if (isLocked && securityPin) {
    return (
      <PinLockView
        correctPin={securityPin}
        onUnlocked={() => setIsLocked(false)}
      />
    );
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
        <span className="text-xs font-semibold text-slate-500">Loading CashFlow...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthView
        onSuccess={(newUser) => {
          setUser(newUser);
        }}
      />
    );
  }

  const currencySymbol = getCurrencySymbol(user?.currency);

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-emerald-500 selection:text-white lg:pl-72">
      {/* Top Header */}
      <Header
        user={user}
        accounts={accounts}
        activeAccountId={activeAccountId}
        onSelectAccount={handleSelectAccount}
        currency={currencySymbol}
        onOpenAccountSwitcher={() => setIsAccountModalOpen(true)}
        onRefresh={loadAppData}
        isRefreshing={isRefreshing}
        onToggleSidebar={() => setIsSidebarOpen(true)}
        onLogout={() => setUser(null)}
        onNavigateToTab={handleSelectTab}
        currentTab={currentTab}
        summary={summary}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
      />

      {/* Left Sidebar Navigation Drawer */}
      <SidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        user={user}
        accounts={accounts}
        activeAccountId={activeAccountId}
        onSelectAccount={handleSelectAccount}
        onLogout={() => setUser(null)}
        onOpenAccountManager={() => setIsAccountModalOpen(true)}
      />

      {/* Main Content Area */}
      {(() => {
        return (
          <>
            <main
              className="app-content-canvas relative z-10 max-w-md lg:max-w-5xl mx-auto px-4 lg:px-8 pt-4 pb-24 lg:pb-10"
            >
              {currentTab === 'dashboard' && (
                <DashboardView
                  summary={summary}
                  recentTransactions={transactions}
                  categories={categories}
                  user={user}
                  budgetOverview={budgetOverview}
                  selectedPeriod={selectedPeriod}
                  onPeriodChange={setSelectedPeriod}
                  onOpenAddModal={handleOpenAddModal}
                  onNavigateToHistory={() => handleSelectTab('history')}
                  onNavigateToSettings={() => handleSelectTab('settings')}
                  onEditTransaction={handleEditTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              )}

              {currentTab === 'history' && (
                <HistoryView
                  transactions={transactions}
                  categories={categories}
                  currency={currencySymbol}
                  user={user}
                  summary={summary}
                  onEdit={handleEditTransaction}
                  onDelete={handleDeleteTransaction}
                  onOpenAddModal={() => handleOpenAddModal('expense')}
                  initialSubTab="daily"
                />
              )}

              {currentTab === 'calendar' && (
                <HistoryView
                  transactions={transactions}
                  categories={categories}
                  currency={currencySymbol}
                  user={user}
                  summary={summary}
                  onEdit={handleEditTransaction}
                  onDelete={handleDeleteTransaction}
                  onOpenAddModal={() => handleOpenAddModal('expense')}
                  initialSubTab="calendar"
                />
              )}

              {currentTab === 'analytics' && (
                <AnalyticsView
                  currency={currencySymbol}
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
                  onOpenTrash={() => handleSelectTab('trash')}
                  deletedCount={deletedTransactions.length}
                />
              )}

              {currentTab === 'trash' && (
                <DeletedTransactionsView
                  deletedTransactions={deletedTransactions}
                  currency={currencySymbol}
                  onRestore={handleRestoreTransaction}
                  onRestoreAll={handleRestoreAllTransactions}
                  onPermanentDelete={handlePermanentDeleteTransaction}
                  onEmptyTrash={handleEmptyTrash}
                  onBack={() => handleSelectTab('dashboard')}
                />
              )}

              {currentTab === 'calculator' && (
                <CashCalculatorView
                  currency={currencySymbol}
                  onRecordCash={handleRecordCashFromCalculator}
                  onBack={() => handleSelectTab('dashboard')}
                />
              )}

              {currentTab === 'notes' && (
                <NotesView
                  onBack={() => handleSelectTab('dashboard')}
                />
              )}
            </main>

            {/* Add / Edit Transaction Modal */}
            {isModalOpen && (
              <TransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSaveTransaction}
                categories={categories}
                accounts={accounts}
                defaultAccountId={activeAccountId}
                currency={currencySymbol}
                initialData={editingTransaction}
                initialType={modalType}
                prefillAmount={prefillAmount}
                prefillNote={prefillNote}
                onDelete={handleDeleteTransaction}
                onCreateCategory={handleCreateCategory}
              />
            )}

            {/* Account Manager Modal */}
            {isAccountModalOpen && (
              <AccountManagerModal
                isOpen={isAccountModalOpen}
                onClose={() => setIsAccountModalOpen(false)}
                accounts={accounts}
                activeAccountId={activeAccountId}
                onSelectAccount={handleSelectAccount}
                onRefresh={loadAppData}
                currency={currencySymbol}
                mode="modal"
              />
            )}

            {/* Bottom Tab Navigation with Center Quick-Add FAB (mobile only) */}
            <BottomNav
              onOpenAddModal={handleOpenAddModal}
              currentTab={currentTab}
              onSelectTab={handleSelectTab}
              summary={{
                income: summary.total_income,
                expense: summary.total_expense,
                balance: summary.net_balance,
              }}
              currency={currencySymbol}
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
            />
          </>
        );
      })()}
    </div>
  );
}

