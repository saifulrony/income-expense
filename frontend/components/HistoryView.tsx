'use client';

import React, { useState } from 'react';
import { Transaction, Category, User, SummaryData } from '@/lib/types';
import TransactionItem from './TransactionItem';
import { Search, ArrowDownLeft, ArrowUpRight, Inbox, Download, FileText } from 'lucide-react';
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

  const filtered = transactions.filter((tx) => {
    // Type filter
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

    // Category filter
    if (selectedCategory !== 'all' && tx.category_id !== selectedCategory) return false;

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
    <div className="space-y-4 pb-20">
      {/* Search Bar & Export Actions */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, category, method..."
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 shadow-sm"
          />
        </div>
        <button
          onClick={handleExportCSV}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold flex items-center gap-1 shadow-sm shrink-0"
          title="Export CSV"
        >
          <Download className="w-3.5 h-3.5" />
          <span>CSV</span>
        </button>
        <button
          onClick={() => generateFinancialStatementPDF(user, summary, filtered, 'filtered')}
          className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs font-bold flex items-center gap-1 shadow-sm shrink-0"
          title="Export PDF Statement"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>PDF</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setTypeFilter('all')}
          className={`py-1.5 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            typeFilter === 'all'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          All Records ({transactions.length})
        </button>
        <button
          onClick={() => setTypeFilter('income')}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            typeFilter === 'income'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          Cash In Only
        </button>
        <button
          onClick={() => setTypeFilter('expense')}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            typeFilter === 'expense'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          Cash Out Only
        </button>
      </div>

      {/* Category Filter dropdown */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>Showing {filtered.length} entries</span>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-transparent font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.type === 'income' ? 'Cash In' : 'Cash Out'})
            </option>
          ))}
        </select>
      </div>

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
