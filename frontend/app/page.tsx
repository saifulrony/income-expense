'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, getAuthToken } from '@/lib/api';
import { User, SummaryData, Transaction, Category } from '@/lib/types';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import DashboardView from '@/components/DashboardView';
import HistoryView from '@/components/HistoryView';
import AnalyticsView from '@/components/AnalyticsView';
import SettingsView from '@/components/SettingsView';
import TransactionModal from '@/components/TransactionModal';
import AuthView from '@/components/AuthView';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');

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
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Check auth on startup
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setAuthChecking(true);
      const token = await getAuthToken();
      if (!token) {
        setUser(null);
        return;
      }
      const res = await api.getProfile();
      setUser(res.user);
    } catch (err) {
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
      const [sumData, txData, catData] = await Promise.all([
        api.getSummary(selectedPeriod),
        api.getTransactions({ limit: 100 }),
        api.getCategories(),
      ]);

      setSummary(sumData);
      setTransactions(txData.transactions || []);
      setCategories(catData.categories || []);
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

  // Modal Handlers
  const handleOpenAddModal = (presetType?: 'income' | 'expense') => {
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
    date: string;
  }) => {
    if (editingTransaction) {
      await api.updateTransaction(editingTransaction.id, formData);
    } else {
      await api.createTransaction(formData);
    }
    await loadAppData();
  };

  const handleCreateCategory = async (name: string, type: 'income' | 'expense') => {
    const res = await api.createCategory({ name, type });
    setCategories((prev) => [...prev, res.category]);
    return res.category;
  };

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
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            onOpenAddModal={handleOpenAddModal}
            onNavigateToHistory={() => setCurrentTab('history')}
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
