'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, Category, User, SummaryData } from '@/lib/types';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  SlidersHorizontal, 
  FileDown, 
  Download, 
  FileText, 
  X, 
  RotateCcw,
  Inbox,
  Plus,
  Calendar as CalendarIcon,
  CheckCircle2
} from 'lucide-react';
import { CategoryIcon } from './CategoryIcons';
import RecordLedger from './RecordLedger';
import { generateFinancialStatementPDF } from '@/lib/pdf-export';
import { exportTransactionsToCSV } from '@/lib/csv-export';
import { getCurrencySymbol, formatAmount } from '@/lib/currency';
import { canAccessFeature, openUpgradeProModal } from '@/lib/billing';

interface HistoryViewProps {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  user: User;
  summary: SummaryData;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onOpenAddModal: () => void;
  initialSubTab?: SubTab;
}

type SubTab = 'daily' | 'calendar' | 'monthly' | 'total';

interface DayGroup {
  dateKey: string;      // "YYYY-MM-DD"
  dayNumber: number;    // e.g. 29
  yearMonth: string;    // e.g. "2026.11"
  dayName: string;      // e.g. "Wed"
  isToday: boolean;
  totalIncome: number;
  totalExpense: number;
  transactions: Transaction[];
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
  initialSubTab = 'daily',
}: HistoryViewProps) {
  const symbol = getCurrencySymbol(currency);
  // Navigation & Subtab State
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(initialSubTab);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);
  
  // Search & Filter State
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Calendar specific state
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  
  // Receipt preview modal
  const [receiptModalImg, setReceiptModalImg] = useState<string | null>(null);

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  const monthYearLabel = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.toLocaleDateString('en-US', { month: 'short' });
    return `${year} ${month}`;
  }, [currentDate]);

  const hasActiveFilter = selectedCategory !== 'all' || typeFilter !== 'all';

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setTypeFilter('all');
    setSearch('');
  };

  // Base filtered transactions according to tab and search/filters
  const filteredTransactions = useMemo(() => {
    const curYear = currentDate.getFullYear();
    const curMonth = currentDate.getMonth();

    return transactions.filter((tx) => {
      const d = new Date(tx.date);

      // Tab date boundaries
      if (activeSubTab === 'daily' || activeSubTab === 'calendar') {
        if (d.getFullYear() !== curYear || d.getMonth() !== curMonth) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

      // Category filter
      if (selectedCategory !== 'all' && tx.category_id !== selectedCategory) return false;

      // Search query filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNote = tx.note?.toLowerCase().includes(q);
        const matchCat = tx.category?.name?.toLowerCase().includes(q);
        const matchMethod = tx.payment_method?.toLowerCase().includes(q);
        const matchAcc = tx.account?.name?.toLowerCase().includes(q);
        if (!matchNote && !matchCat && !matchMethod && !matchAcc) return false;
      }

      return true;
    });
  }, [transactions, activeSubTab, currentDate, typeFilter, selectedCategory, search]);

  // Overall totals for the active view / period
  const { periodIncome, periodExpense, periodNet } = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.type === 'income') {
        income += tx.amount;
      } else if (tx.type === 'expense') {
        expense += tx.amount;
      }
    });
    return {
      periodIncome: income,
      periodExpense: expense,
      periodNet: income - expense,
    };
  }, [filteredTransactions]);

  // Group transactions by day for Daily and Total views
  const dayGroups: DayGroup[] = useMemo(() => {
    const groups: Record<string, DayGroup> = {};
    const todayStr = new Date().toISOString().slice(0, 10);

    filteredTransactions.forEach((tx) => {
      const d = new Date(tx.date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = d.getDate();
      const dateKey = `${year}-${month}-${String(day).padStart(2, '0')}`;

      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateKey,
          dayNumber: day,
          yearMonth: `${year}.${month}`,
          dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
          isToday: dateKey === todayStr,
          totalIncome: 0,
          totalExpense: 0,
          transactions: [],
        };
      }

      if (tx.type === 'income') {
        groups[dateKey].totalIncome += tx.amount;
      } else if (tx.type === 'expense') {
        groups[dateKey].totalExpense += tx.amount;
      }

      groups[dateKey].transactions.push(tx);
    });

    // Sort days descending (most recent date first)
    return Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredTransactions]);

  // Group transactions by month for Monthly tab
  const monthlyGroups = useMemo(() => {
    const monthsMap: Record<string, { year: number; month: number; label: string; income: number; expense: number; count: number }> = {};
    
    // Use all transactions (respecting category/search if set)
    transactions.forEach((tx) => {
      if (selectedCategory !== 'all' && tx.category_id !== selectedCategory) return;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return;

      const d = new Date(tx.date);
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;

      if (!monthsMap[key]) {
        monthsMap[key] = {
          year,
          month,
          label: `${year} ${d.toLocaleDateString('en-US', { month: 'short' })}`,
          income: 0,
          expense: 0,
          count: 0,
        };
      }

      if (tx.type === 'income') {
        monthsMap[key].income += tx.amount;
      } else if (tx.type === 'expense') {
        monthsMap[key].expense += tx.amount;
      }
      monthsMap[key].count++;
    });

    return Object.entries(monthsMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([_, val]) => val);
  }, [transactions, selectedCategory, typeFilter]);

  // Calendar Grid Data for Calendar Tab
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Daily totals map
    const dayTotals: Record<string, { income: number; expense: number; count: number }> = {};
    filteredTransactions.forEach((tx) => {
      const d = new Date(tx.date);
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dayTotals[key]) dayTotals[key] = { income: 0, expense: 0, count: 0 };
      if (tx.type === 'income') dayTotals[key].income += tx.amount;
      if (tx.type === 'expense') dayTotals[key].expense += tx.amount;
      dayTotals[key].count++;
    });

    const grid = [];
    // Leading blanks
    for (let i = 0; i < firstDayIndex; i++) {
      grid.push({ blank: true, key: `blank-${i}` });
    }
    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      grid.push({
        blank: false,
        key: dateKey,
        day,
        dateKey,
        income: dayTotals[dateKey]?.income || 0,
        expense: dayTotals[dateKey]?.expense || 0,
        count: dayTotals[dateKey]?.count || 0,
      });
    }

    return grid;
  }, [currentDate, filteredTransactions]);

  const selectedCalendarTransactions = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return filteredTransactions.filter((tx) => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return key === selectedCalendarDate;
    });
  }, [selectedCalendarDate, filteredTransactions]);

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // CSV Export
  const handleExportCSV = async (exportAll: boolean = false) => {
    const targetTransactions = exportAll
      ? transactions
      : (filteredTransactions.length > 0 ? filteredTransactions : transactions);

    if (!targetTransactions || targetTransactions.length === 0) {
      showToast('No transactions found to export.', 'error');
      return;
    }

    const filename = exportAll || filteredTransactions.length === 0
      ? `transactions_all_${new Date().toISOString().slice(0, 10)}.csv`
      : `transactions_${monthYearLabel.replace(/\s+/g, '_')}.csv`;

    const res = await exportTransactionsToCSV(targetTransactions, filename, currency);
    if (res.success) {
      showToast(`Exported ${res.count} transactions to CSV`, 'success');
    } else {
      showToast(res.error || 'Failed to download CSV.', 'error');
    }
  };

  return (
    <div className="space-y-3 pb-24 max-w-md mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg border text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-rose-600 text-white border-rose-700'
          }`}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-1 opacity-70 hover:opacity-100">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {/* 1. TOP NAVIGATOR (Month + Action Controls) */}
      <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-2 shadow-xs flex items-center justify-between">
        {/* Month Selector */}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
            title="Previous Month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleCurrentMonth}
            className="px-2.5 py-1 text-sm font-bold font-mono text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all"
            title="Jump to current month"
          >
            {monthYearLabel}
          </button>

          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
            title="Next Month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls: Search, Filter, Export */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-2 rounded-md transition-all ${
              isSearchOpen || search
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Search Transactions"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`p-2 rounded-md relative transition-all ${
              isFilterOpen || hasActiveFilter
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Filter Category / Type"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {hasActiveFilter && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Export Statement"
            >
              <FileDown className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-[10px] shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-30 animate-in fade-in zoom-in-95">
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      handleExportCSV(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Export View to CSV</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">({filteredTransactions.length})</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      handleExportCSV(true);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-700/60"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                      <span>Export All to CSV</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">({transactions.length})</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      if (!canAccessFeature('canExportPdf')) {
                        openUpgradeProModal('pdf_report');
                        return;
                      }
                      generateFinancialStatementPDF(
                        user,
                        summary,
                        filteredTransactions.length > 0 ? filteredTransactions : transactions,
                        monthYearLabel
                      );
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>Export PDF Report</span>
                    </div>
                    {!canAccessFeature('canExportPdf') && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold uppercase">
                        Pro
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. SEARCH BAR (When toggled open) */}
      {isSearchOpen && (
        <div className="relative animate-in slide-in-from-top-2 duration-150">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search note, category, account..."
            autoFocus
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md pl-9 pr-9 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 shadow-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 3. FILTER DRAWER (When toggled open) */}
      {isFilterOpen && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[10px] p-3.5 space-y-3 shadow-sm animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Filter Records
            </span>
            {hasActiveFilter && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:text-rose-600"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => setTypeFilter('all')}
              className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                typeFilter === 'all'
                  ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('income')}
              className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                typeFilter === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              Cash In Only
            </button>
            <button
              onClick={() => setTypeFilter('expense')}
              className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                typeFilter === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
              }`}
            >
              Cash Out Only
            </button>
          </div>

          {/* Category Dropdown */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none"
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

      {/* 4. SUB-TABS (Daily | Calendar | Monthly | Total) */}
      <div className="flex items-center border border-slate-200/90 dark:border-slate-800 text-xs font-semibold bg-white dark:bg-slate-900 rounded-[10px] px-1 shadow-xs">
        {(['daily', 'calendar', 'monthly', 'total'] as const).map((tab) => {
          const isActive = activeSubTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`flex-1 py-2.5 text-center capitalize transition-all relative ${
                isActive
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab}
              {isActive && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* 5. TAB CONTENT SECTIONS */}

      {/* === A. DAILY & TOTAL VIEWS (The 2-Column Ledger from the screenshot) === */}
      {(activeSubTab === 'daily' || activeSubTab === 'total') && (
        <RecordLedger
          transactions={filteredTransactions}
          currency={currency}
          onEdit={onEdit}
          onDelete={onDelete}
          onOpenAddModal={onOpenAddModal}
          emptyMessage={
            search || hasActiveFilter
              ? 'No entries match your active search or filters.'
              : `No transactions found for ${activeSubTab === 'daily' ? monthYearLabel : 'this account'}.`
          }
          showHeader={true}
          onViewReceipt={(img) => setReceiptModalImg(img)}
        />
      )}

      {/* === B. CALENDAR VIEW (Interactive Daily Spending Grid) === */}
      {activeSubTab === 'calendar' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/80 dark:border-slate-800 p-3 shadow-xs">
            {/* Weekday Labels */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              <span className="text-rose-500">Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span className="text-rose-500">Sat</span>
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarData.map((cell) => {
                if (cell.blank) {
                  return <div key={cell.key} className="h-14 rounded-md" />;
                }

                const isSelected = selectedCalendarDate === cell.dateKey;
                const hasIncome = (cell.income || 0) > 0;
                const hasExpense = (cell.expense || 0) > 0;

                return (
                  <button
                    key={cell.key}
                    onClick={() => setSelectedCalendarDate(cell.dateKey || '')}
                    className={`h-14 rounded-md flex flex-col items-center justify-between p-1 transition-all border text-xs ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 font-bold shadow-xs'
                        : 'border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="text-xs font-mono text-slate-700 dark:text-slate-200">
                      {cell.day}
                    </span>

                    {/* Green & Rose Dots or Totals */}
                    <div className="w-full flex flex-col items-center gap-0.5">
                      {hasIncome && (
                        <div className="w-full text-center text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate leading-none">
                          +{formatAmount(cell.income || 0).split('.')[0]}
                        </div>
                      )}
                      {hasExpense && (
                        <div className="w-full text-center text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 truncate leading-none">
                          -{formatAmount(cell.expense || 0).split('.')[0]}
                        </div>
                      )}
                      {!hasIncome && !hasExpense && (
                        <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Breakdown for Selected Date */}
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/80 dark:border-slate-800 p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <CalendarIcon className="w-4 h-4 text-emerald-600" />
                <span>{selectedCalendarDate}</span>
              </div>
              <span className="text-xs text-slate-400">
                {selectedCalendarTransactions.length} {selectedCalendarTransactions.length === 1 ? 'record' : 'records'}
              </span>
            </div>

            {selectedCalendarTransactions.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No activity recorded on this day.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {selectedCalendarTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => onEdit(tx)}
                    className="flex items-center justify-between py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-md px-1 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0 text-xs"
                        style={{
                          backgroundColor:
                            tx.category?.color ||
                            (tx.type === 'income' ? '#10B981' : '#EF4444'),
                        }}
                      >
                        <CategoryIcon
                          name={tx.category?.icon || 'Tag'}
                          className="w-3.5 h-3.5"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {tx.note || tx.category?.name || 'Transaction'}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {tx.category?.name} • {tx.account?.name || tx.payment_method || 'Cash'}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`text-xs font-mono font-bold shrink-0 ml-2 ${
                        tx.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      <span className="currency-symbol">{symbol}</span>{formatAmount(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === C. MONTHLY VIEW (Grouped by Month) === */}
      {activeSubTab === 'monthly' && (
        <div className="space-y-3">
          {/* Column Header */}
          <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800/80">
            <span>Month</span>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className="w-20 sm:w-24 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                Cash In
              </span>
              <span className="w-20 sm:w-24 text-right text-rose-600 dark:text-rose-400 font-bold">
                Cash Out
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {monthlyGroups.map((mg) => (
              <div
                key={mg.label}
                onClick={() => {
                  setCurrentDate(new Date(mg.year, mg.month, 1));
                  setActiveSubTab('daily');
                }}
                className="p-3 bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 flex items-center justify-between hover:border-emerald-500 cursor-pointer shadow-xs transition-all"
                title="Tap to open Daily view for this month"
              >
                <div>
                  <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100 block">
                    {mg.label}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {mg.count} {mg.count === 1 ? 'entry' : 'entries'}
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="w-20 sm:w-24 text-right">
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="currency-symbol">{symbol}</span>{formatAmount(mg.income)}
                    </span>
                  </div>
                  <div className="w-20 sm:w-24 text-right">
                    <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                      <span className="currency-symbol">{symbol}</span>{formatAmount(mg.expense)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. FULLSCREEN RECEIPT MODAL */}
      {receiptModalImg && (
        <div
          onClick={() => setReceiptModalImg(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-sm w-full bg-white dark:bg-slate-900 rounded-[10px] overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Receipt Attachment
              </span>
              <button
                type="button"
                onClick={() => setReceiptModalImg(null)}
                className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptModalImg}
                alt="Receipt"
                className="max-h-80 w-auto rounded-md object-contain shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
