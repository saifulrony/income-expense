'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, getAuthToken } from '@/lib/api';
import { User, SummaryData, Transaction, Category, BudgetOverview } from '@/lib/types';
import { GoogleDriveService } from '@/lib/google-drive';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import DashboardView from '@/components/DashboardView';
import HistoryView from '@/components/HistoryView';
import AnalyticsView from '@/components/AnalyticsView';
import SettingsView from '@/components/SettingsView';
import TransactionModal from '@/components/TransactionModal';
import AuthView from '@/components/AuthView';
import PinLockView from '@/components/PinLockView';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');

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
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setAuthChecking(true);

      // Check PIN lock
      if (typeof window !== 'undefined') {
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
    } catch {
      setUser(null);
    } finally {
      setAuthChecking(false);
    }
  };

  // Load app data
  const loadAppData = useCallback(async () => {
    if (!user) return;
    try {
      setIsRefreshing(true);
      const [sumData, txData, catData, budData] = await Promise.all([
        api.getSummary(selectedPeriod),
        api.getTransactions({ limit: 100 }),
        api.getCategories(),
        api.getBudgets().catch(() => null),
      ]);

      setSummary(sumData);
      setTransactions(txData.transactions || []);
      setCategories(catData.categories || []);
      if (budData) {
        setBudgetOverview(budData);
      }
    } catch (err) {
      console.error('Error fetching app data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [user, selectedPeriod]);

  useEffect(() => {
    if (user) {
      loadAppData();
    }
  }, [user, selectedPeriod, loadAppData]);

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
      await api.deleteTransaction(id);
      await loadAppData();
      triggerAutoCloudSync();
    } catch (err: any) {
      alert(err.message || 'Failed to delete transaction');
    }
  };

  const handleSaveTransaction = async (formData: {
    amount: number;
    type: 'income' | 'expense';
    category_id: string;
    payment_method: string;
    note: string;
    receipt_image?: string;
    date: string;
  }) => {
    if (editingTransaction) {
      await api.updateTransaction(editingTransaction.id, formData);
    } else {
      await api.createTransaction(formData);
    }
    await loadAppData();
    triggerAutoCloudSync();
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
            onEdit={handleEditTransaction}
            onDelete={handleDeleteTransaction}
            onOpenAddModal={() => handleOpenAddModal()}
          />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsView currency={user.currency} />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            user={user}
            categories={categories}
            budgetOverview={budgetOverview}
            onUpdateUser={setUser}
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
        currency={user.currency}
        initialData={editingTransaction}
        onCreateCategory={handleCreateCategory}
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
