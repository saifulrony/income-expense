'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { api, getAuthToken, getAppMode, setAppMode, removeAuthToken } from '@/lib/api';
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
import { Loader2, BellRing, X } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/currency';
import {
  HeaderStyle,
  getHeaderStyle,
  HEADER_STYLE_EVENT,
  applyPrivacyMode,
  getAutoLockTimeout,
  LOCK_APP_NOW_EVENT,
} from '@/lib/ui-prefs';
import { triggerHaptic } from '@/lib/haptics';
import { isBiometricEnabled } from '@/lib/biometrics';
import { checkBudgetNotifications, checkMonthEndPerformance } from '@/lib/notifications';
import { checkDueReminders } from '@/lib/reminders';

const HistoryView = dynamic(() => import('@/components/HistoryView'), { ssr: false });
const AnalyticsView = dynamic(() => import('@/components/AnalyticsView'), { ssr: false });
const SettingsView = dynamic(() => import('@/components/SettingsView'), { ssr: false });
const CategoriesView = dynamic(() => import('@/components/CategoriesView'), { ssr: false });
const RemindersView = dynamic(() => import('@/components/RemindersView'), { ssr: false });
const WarrantiesView = dynamic(() => import('@/components/WarrantiesView'), { ssr: false });
const GoalsView = dynamic(() => import('@/components/GoalsView'), { ssr: false });
const ShoppingListView = dynamic(() => import('@/components/ShoppingListView'), { ssr: false });
const DebtsView = dynamic(() => import('@/components/DebtsView'), { ssr: false });
const DeletedTransactionsView = dynamic(() => import('@/components/DeletedTransactionsView'), { ssr: false });
const CashCalculatorView = dynamic(() => import('@/components/CashCalculatorView'), { ssr: false });
const NotesView = dynamic(() => import('@/components/NotesView'), { ssr: false });
const TransactionModal = dynamic(() => import('@/components/TransactionModal'), { ssr: false });
const AccountManagerModal = dynamic(() => import('@/components/AccountManagerModal'), { ssr: false });
const UpgradeProModal = dynamic(() => import('@/components/UpgradeProModal'), { ssr: false });
import { SpeedDialMethod } from '@/components/BottomNav';
import { OPEN_UPGRADE_MODAL_EVENT } from '@/lib/billing';

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
  const [autoScanOnMount, setAutoScanOnMount] = useState(false);
  const [autoVoiceOnMount, setAutoVoiceOnMount] = useState(false);
  const [autoAiChatOnMount, setAutoAiChatOnMount] = useState(false);
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);

  // Header style (classic floating sheet vs sticky bar)
  const [headerStyle, setHeaderStyleState] = useState<HeaderStyle>('classic');
  const [pushBanner, setPushBanner] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    const handlePushBanner = (e: Event) => {
      const detail = (e as CustomEvent).detail as { title?: string; body?: string } | undefined;
      if (detail?.title) {
        setPushBanner({ title: detail.title, body: detail.body || '' });
      }
    };
    window.addEventListener('cashflow-push-banner', handlePushBanner);
    return () => window.removeEventListener('cashflow-push-banner', handlePushBanner);
  }, []);

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  useEffect(() => {
    const onOpenUpgrade = () => setIsUpgradeModalOpen(true);
    window.addEventListener(OPEN_UPGRADE_MODAL_EVENT, onOpenUpgrade);
    return () => window.removeEventListener(OPEN_UPGRADE_MODAL_EVENT, onOpenUpgrade);
  }, []);

  useEffect(() => {
    if (!pushBanner) return;
    const t = setTimeout(() => setPushBanner(null), 5500);
    return () => clearTimeout(t);
  }, [pushBanner]);

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
      if (['history', 'analytics', 'settings', 'trash', 'calendar', 'calculator', 'notes', 'categories', 'reminders', 'warranties', 'goals', 'shopping', 'debts'].includes(path)) {
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
    triggerHaptic('light');
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
        const hasPin = !!(pin && pin.length === 4);
        const hasBio = isBiometricEnabled();
        if (hasPin) {
          setSecurityPin(pin);
        }
        if (hasPin || hasBio) {
          setIsLocked(true);
        }
      }

      // Check if user previously chose Guest mode or was already in offline mode,
      // or if they haven't explicitly signed out and have no token (default to guest mode to avoid repeated logins)
      const hasGuestMode = typeof window !== 'undefined' && (
        localStorage.getItem('cashflow_guest_mode') === 'true' ||
        getAppMode() === 'offline' ||
        (!localStorage.getItem('auth_token') && localStorage.getItem('cashflow_signed_out') !== 'true')
      );

      const token = await getAuthToken();
      if (!token && !hasGuestMode) {
        setUser(null);
        return;
      }

      if (hasGuestMode && (!token || token === 'offline_device_token')) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('cashflow_guest_mode', 'true');
        }
        setAppMode('offline');
        const localUser = OfflineStorage.getUser();
        setUser(localUser);
      } else {
        const res = await api.getProfile();
        setUser(res.user);
      }

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
      // Fallback to local guest user if available
      const localUser = OfflineStorage.getUser();
      if (localUser) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('cashflow_guest_mode', 'true');
        }
        setAppMode('offline');
        setUser(localUser);
      } else {
        setUser(null);
      }
    }
  };

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cashflow_guest_mode');
      localStorage.setItem('cashflow_signed_out', 'true');
    }
    setAppMode('online');
    await removeAuthToken();
    setUser(null);
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

      // Smart notifications evaluation
      checkBudgetNotifications(localBuds, getCurrencySymbol(user?.currency));
      checkMonthEndPerformance(localTxs, getCurrencySymbol(user?.currency));
      checkDueReminders(getCurrencySymbol(user?.currency));

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
            if (cloudBud) {
              setBudgetOverview(cloudBud);
              checkBudgetNotifications(cloudBud, getCurrencySymbol(user?.currency));
            }
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

  // Apply saved privacy mode & handle Android / PWA App Shortcuts (?action=expense | ?action=income)
  useEffect(() => {
    applyPrivacyMode();
    if (!user || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'expense' || action === 'income') {
      setEditingTransaction(null);
      setPrefillAmount(null);
      setPrefillNote('');
      setModalType(action);
      setIsModalOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user]);

  // Enforce 1-Tap "Lock App Now" & Auto-Lock on background/inactivity
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let hiddenAt: number | null = null;

    const lockIfConfigured = () => {
      const pin = localStorage.getItem('app_security_pin');
      const hasPin = !!(pin && pin.length === 4);
      const hasBio = isBiometricEnabled();
      setSecurityPin(hasPin ? pin : null);
      if (hasPin || hasBio) {
        setIsLocked(true);
      }
    };

    const handleLockNow = () => {
      triggerHaptic('medium');
      lockIfConfigured();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (document.visibilityState === 'visible' && hiddenAt !== null) {
        const elapsed = Date.now() - hiddenAt;
        hiddenAt = null;
        const timeout = getAutoLockTimeout();
        if (timeout === 'launch_only') return;
        const thresholdMs =
          timeout === 'immediate' ? 0 : timeout === '1m' ? 60_000 : 300_000;
        if (elapsed >= thresholdMs) {
          lockIfConfigured();
        }
      }
    };

    window.addEventListener(LOCK_APP_NOW_EVENT, handleLockNow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener(LOCK_APP_NOW_EVENT, handleLockNow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleOpenAddModal = (type: 'income' | 'expense' = 'expense') => {
    triggerHaptic('light');
    setEditingTransaction(null);
    setPrefillAmount(null);
    setPrefillNote('');
    setModalType(type);
    setAutoScanOnMount(false);
    setAutoVoiceOnMount(false);
    setAutoAiChatOnMount(false);
    setIsModalOpen(true);
  };

  const handleOpenScanReceipt = () => {
    triggerHaptic('medium');
    setEditingTransaction(null);
    setPrefillAmount(null);
    setPrefillNote('');
    setModalType('expense');
    setAutoScanOnMount(true);
    setAutoVoiceOnMount(false);
    setAutoAiChatOnMount(false);
    setIsModalOpen(true);
  };

  const handleSelectSpeedDialMethod = (method: SpeedDialMethod) => {
    setIsSpeedDialOpen(false);
    if (method === 'scanner') {
      handleOpenScanReceipt();
    } else if (method === 'voice') {
      triggerHaptic('medium');
      setEditingTransaction(null);
      setPrefillAmount(null);
      setPrefillNote('');
      setModalType('expense');
      setAutoScanOnMount(false);
      setAutoVoiceOnMount(true);
      setAutoAiChatOnMount(false);
      setIsModalOpen(true);
    } else if (method === 'ai') {
      triggerHaptic('medium');
      setEditingTransaction(null);
      setPrefillAmount(null);
      setPrefillNote('');
      setModalType('expense');
      setAutoScanOnMount(false);
      setAutoVoiceOnMount(false);
      setAutoAiChatOnMount(true);
      setIsModalOpen(true);
    } else {
      handleOpenAddModal('expense');
    }
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

      // Trigger budget notification check if spending crosses limit
      checkBudgetNotifications(updatedBuds, getCurrencySymbol(user?.currency));

      if (getAppMode() === 'online') {
        api.deleteTransaction(id).catch(() => {});
        triggerAutoCloudSync();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete transaction');
    }
  };

  const handleBatchDeleteTransactions = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    try {
      for (const id of ids) {
        const targetTx = transactions.find((t) => t.id === id);
        OfflineStorage.deleteTransaction(id, targetTx);
        if (getAppMode() === 'online') {
          api.deleteTransaction(id).catch(() => {});
        }
      }

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

      checkBudgetNotifications(updatedBuds, getCurrencySymbol(user?.currency));

      if (getAppMode() === 'online') {
        triggerAutoCloudSync();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete selected transactions');
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

      // Trigger budget notification check if spending crosses limit
      checkBudgetNotifications(updatedBuds, getCurrencySymbol(user?.currency));

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

  const handleBatchSaveTransactions = async (items: Array<{
    account_id?: string;
    amount: number;
    type: 'income' | 'expense';
    category_id: string;
    payment_method: string;
    note: string;
    receipt_image?: string;
    date: string;
  }>) => {
    try {
      for (const item of items) {
        const savedTx = OfflineStorage.createTransaction({
          account_id: item.account_id,
          amount: item.amount,
          type: item.type,
          category_id: item.category_id,
          payment_method: item.payment_method || 'cash',
          note: item.note || '',
          receipt_image: item.receipt_image,
          date: item.date || new Date().toISOString(),
        });

        if (getAppMode() === 'online') {
          api.createTransaction(item).catch((err) => {
            console.warn('Background server sync queued for batch item:', err.message);
            OfflineSyncService.enqueue({
              id: savedTx.id,
              amount: item.amount,
              type: item.type,
              category_id: item.category_id,
              payment_method: item.payment_method || 'cash',
              note: item.note || '',
              receipt_image: item.receipt_image,
              date: item.date || new Date().toISOString(),
              created_at: new Date().toISOString(),
            }).catch(() => {});
          });
        }
      }

      const updatedTxs = OfflineStorage.getTransactions({ account_id: activeAccountId });
      const updatedSum = OfflineStorage.getSummary(selectedPeriod, activeAccountId);
      const updatedAccs = OfflineStorage.getAccounts();
      const updatedBuds = OfflineStorage.getBudgets();

      setTransactions(updatedTxs);
      setSummary(updatedSum);
      setAccounts(updatedAccs);
      setBudgetOverview(updatedBuds);

      checkBudgetNotifications(updatedBuds, getCurrencySymbol(user?.currency));
      if (getAppMode() === 'online') {
        triggerAutoCloudSync();
      }
    } catch (err: any) {
      console.error('Failed to batch save transactions:', err);
      alert('Error saving items: ' + err.message);
      throw err;
    }
  };

  const handleCreateCategory = async (name: string, type: 'income' | 'expense') => {
    const res = await api.createCategory({ name, type });
    setCategories((prev) => [...prev, res.category]);
    return res.category;
  };

  if (isLocked && (securityPin || isBiometricEnabled())) {
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
          if (typeof window !== 'undefined') {
            localStorage.removeItem('cashflow_signed_out');
          }
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
        onLogout={handleLogout}
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
        onLogout={handleLogout}
        onOpenAccountManager={() => setIsAccountModalOpen(true)}
      />

      {/* Main Content Area */}
      {(() => {
        return (
          <>
            <main
              className="app-content-canvas relative z-10 max-w-md lg:max-w-5xl mx-auto px-4 lg:px-8 pt-4 pb-24 lg:pb-10 rounded-[22px]"
              style={{ borderRadius: '22px' }}
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
                  onOpenScanReceipt={handleOpenScanReceipt}
                  onNavigateToHistory={() => handleSelectTab('history')}
                  onNavigateToSettings={() => handleSelectTab('settings')}
                  onNavigateToReminders={() => handleSelectTab('reminders')}
                  onNavigateToCalendar={() => handleSelectTab('calendar')}
                  onEditTransaction={handleEditTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onBatchDeleteTransaction={handleBatchDeleteTransactions}
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
                  onBatchDelete={handleBatchDeleteTransactions}
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
                  onBatchDelete={handleBatchDeleteTransactions}
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
                  transactions={transactions}
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
                  onLogout={handleLogout}
                  onDataRestored={loadAppData}
                  onOpenTrash={() => handleSelectTab('trash')}
                  onNavigateToCategories={() => handleSelectTab('categories')}
                  deletedCount={deletedTransactions.length}
                />
              )}

              {currentTab === 'categories' && (
                <CategoriesView
                  categories={categories}
                  transactions={transactions}
                  budgetOverview={budgetOverview}
                  currency={currencySymbol}
                  onRefresh={loadAppData}
                  onBack={() => handleSelectTab('settings')}
                />
              )}

              {currentTab === 'reminders' && (
                <RemindersView
                  currency={currencySymbol}
                  categories={categories}
                  onLogAsExpense={(data) => {
                    setModalType('expense');
                    setPrefillAmount(data.amount || null);
                    setPrefillNote(data.note || '');
                    setIsModalOpen(true);
                  }}
                />
              )}

              {currentTab === 'warranties' && (
                <WarrantiesView currency={currencySymbol} />
              )}

              {currentTab === 'goals' && (
                <GoalsView
                  currency={currencySymbol}
                  transactions={transactions}
                  summary={summary}
                  categories={categories}
                  accounts={accounts}
                  budgetOverview={budgetOverview}
                />
              )}

              {currentTab === 'shopping' && (
                <ShoppingListView
                  currency={currencySymbol}
                  categories={categories}
                  activeAccountId={activeAccountId}
                  onRefresh={loadAppData}
                  onLogAsExpense={(data) => {
                    setModalType('expense');
                    setPrefillAmount(data.amount || null);
                    setPrefillNote(data.note || '');
                    setIsModalOpen(true);
                  }}
                />
              )}

              {currentTab === 'debts' && (
                <DebtsView
                  currency={currencySymbol}
                  onLogTransaction={(data) => {
                    setModalType(data.type);
                    setPrefillAmount(data.amount || null);
                    setPrefillNote(data.note || '');
                    setIsModalOpen(true);
                  }}
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
                onClose={() => {
                  setIsModalOpen(false);
                  setAutoScanOnMount(false);
                }}
                onSubmit={handleSaveTransaction}
                onBatchSubmit={handleBatchSaveTransactions}
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
                autoScanOnMount={autoScanOnMount}
                onResetAutoScan={() => setAutoScanOnMount(false)}
                autoVoiceOnMount={autoVoiceOnMount}
                onResetAutoVoice={() => setAutoVoiceOnMount(false)}
                autoAiChatOnMount={autoAiChatOnMount}
                onResetAutoAiChat={() => setAutoAiChatOnMount(false)}
                onNavigateToAiSettings={() => {
                  setIsModalOpen(false);
                  handleSelectTab('settings#ai');
                }}
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
              onOpenSpeedDial={() => setIsSpeedDialOpen(true)}
              isSpeedDialOpen={isSpeedDialOpen}
              onCloseSpeedDial={() => setIsSpeedDialOpen(false)}
              onSelectSpeedDialMethod={handleSelectSpeedDialMethod}
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

            {/* Android-Style Heads-Up Push Notification Overlay */}
            {pushBanner && (
              <div
                className="fixed top-0 left-0 right-0 z-[100000] px-3 pointer-events-none flex justify-center animate-in slide-in-from-top-5 duration-200"
                style={{
                  paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 10px), 12px)',
                }}
              >
                <div className="pointer-events-auto w-full max-w-md bg-slate-900/95 dark:bg-slate-800/95 text-white backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl p-3.5 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <BellRing className="w-4 h-4 animate-bounce" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        CashFlow Push Alert • Now
                      </span>
                    </div>
                    <h4 className="text-xs font-extrabold text-white truncate mt-0.5">
                      {pushBanner.title}
                    </h4>
                    <p className="text-[11px] text-slate-300 leading-snug mt-0.5 line-clamp-2">
                      {pushBanner.body}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPushBanner(null)}
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
                    aria-label="Dismiss push notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <UpgradeProModal
              isOpen={isUpgradeModalOpen}
              onClose={() => setIsUpgradeModalOpen(false)}
            />
          </>
        );
      })()}
    </div>
  );
}

