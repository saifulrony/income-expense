'use client';

import React, { useState } from 'react';
import { Transaction, Category, User, SummaryData } from '@/lib/types';
import TransactionItem from './TransactionItem';
import { 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Inbox, 
  Download, 
  FileText, 
  Calendar, 
  SlidersHorizontal, 
  X,
  FileDown,
  RotateCcw
} from 'lucide-react';
import { generateFinancialStatementPDF } from '@/lib/pdf-export';

interface HistoryViewProps {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  user: User;
  summary: SummaryData;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onOpenAddModal: () => void;
}

export default function HistoryView({
  transactions,
  categories,
  currency,
  user,
  summary,
  onEdit,
  onDelete,
  onOpenAddModal,
}: HistoryViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'this_month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const hasActiveFilter =
    dateFilter !== 'all' || selectedCategory !== 'all' || startDate !== '' || endDate !== '';

  const handleResetFilters = () => {
    setDateFilter('all');
    setSelectedCategory('all');
    setStartDate('');
    setEndDate('');
  };

  const filtered = transactions.filter((tx) => {
    // Type filter
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

    // Category filter
    if (selectedCategory !== 'all' && tx.category_id !== selectedCategory) return false;

    // Date filter
    if (dateFilter === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      const txDateStr = new Date(tx.date).toISOString().slice(0, 10);
      if (txDateStr !== todayStr) return false;
    } else if (dateFilter === 'this_month') {
      const now = new Date();
      const txDate = new Date(tx.date);
      if (txDate.getFullYear() !== now.getFullYear() || txDate.getMonth() !== now.getMonth()) return false;
    } else if (dateFilter === 'custom') {
      if (startDate) {
        const txDate = new Date(tx.date);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (txDate < start) return false;
      }
      if (endDate) {
        const txDate = new Date(tx.date);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (txDate > end) return false;
      }
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNote = tx.note?.toLowerCase().includes(q);
      const matchCat = tx.category?.name?.toLowerCase().includes(q);
      const matchMethod = tx.payment_method?.toLowerCase().includes(q);
      if (!matchNote && !matchCat && !matchMethod) return false;
    }

    return true;
  });

  // Calculate filtered stats
  const filteredIncome = filtered
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
  const filteredExpense = filtered
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);
  const filteredNet = filteredIncome - filteredExpense;

  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Export to CSV function
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      alert('No transactions to export.');
      return;
    }

    const headers = ['Date', 'Type', 'Category', 'Amount', 'Currency', 'Payment Method', 'Note'];
    const rows = filtered.map((tx) => [
      `"${new Date(tx.date).toISOString().slice(0, 19)}"`,
      `"${tx.type.toUpperCase()}"`,
      `"${tx.category?.name || ''}"`,
      tx.amount,
      `"${currency}"`,
      `"${tx.payment_method || 'Cash'}"`,
      `"${(tx.note || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 pb-20">
      {/* Sleek Minimal Header */}
      <div className="space-y-2">
        {/* Row 1: Search + Filter Toggle + Export Menu */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search note, category, method..."
              className="w-full bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 shadow-xs transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`relative p-2.5 rounded-2xl border text-xs font-semibold flex items-center justify-center transition-all ${
              isFilterOpen || hasActiveFilter
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 shadow-xs'
                : 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs'
            }`}
            title="Toggle Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {hasActiveFilter && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {/* Export Action with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-2.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center shadow-xs transition-all"
              title="Export Transactions"
            >
              <FileDown className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 py-1.5 z-30 animate-in fade-in zoom-in-95">
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      handleExportCSV();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Export to CSV</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      generateFinancialStatementPDF(user, summary, filtered, 'filtered');
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Export PDF Report</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Sleek Segmented Type Control */}
        <div className="grid grid-cols-3 gap-1 bg-slate-200/60 dark:bg-slate-800/70 p-1 rounded-2xl">
          <button
            onClick={() => setTypeFilter('all')}
            className={`py-1.5 rounded-xl text-xs font-semibold transition-all ${
              typeFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({transactions.length})
          </button>
          <button
            onClick={() => setTypeFilter('income')}
            className={`flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              typeFilter === 'income'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Cash In
          </button>
          <button
            onClick={() => setTypeFilter('expense')}
            className={`flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              typeFilter === 'expense'
                ? 'bg-rose-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Cash Out
          </button>
        </div>

        {/* Collapsible Filter Panel Drawer */}
        {isFilterOpen && (
          <div className="bg-white dark:bg-slate-800/95 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-3.5 space-y-3 shadow-sm animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-700/60">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Filter Ledger
              </span>
              {hasActiveFilter && (
                <button
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:text-rose-600"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All</span>
                </button>
              )}
            </div>

            {/* Date Range Chips */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Timeframe
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                {(['all', 'today', 'this_month', 'custom'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setDateFilter(period)}
                    className={`py-1.5 px-3 rounded-xl font-medium whitespace-nowrap transition-all ${
                      dateFilter === period
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {period === 'all' && 'All Dates'}
                    {period === 'today' && 'Today'}
                    {period === 'this_month' && 'This Month'}
                    {period === 'custom' && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Custom
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Pickers */}
            {dateFilter === 'custom' && (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                    From
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                    To
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Category Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type === 'income' ? 'Cash In' : 'Cash Out'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Filter Summary Stats Pill (Only shown if filtering or search active) */}
      {(hasActiveFilter || search || typeFilter !== 'all') && (
        <div className="bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl px-3.5 py-2 flex items-center justify-between text-xs border border-slate-200/50 dark:border-slate-700/50 animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              +{currency} {formatAmount(filteredIncome)}
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              -{currency} {formatAmount(filteredExpense)}
            </span>
          </div>
        </div>
      )}

      {/* Transactions Feed */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
          <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            No transactions found
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {search || typeFilter !== 'all' || selectedCategory !== 'all'
              ? 'Try adjusting your search query or filters.'
              : 'Start logging your cash flow by recording your first transaction.'}
          </p>
          <button
            onClick={onOpenAddModal}
            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md"
          >
            Record Cash In / Out
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => (
            <TransactionItem
              key={tx.id}
              transaction={tx}
              currency={currency}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
